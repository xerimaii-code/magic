/**
 * aiAgentRunner.js
 * =====================================================================
 * Age of Magic - 자율형 인간화 AI 에이전트 시스템 (Human-like AI Agent Runner)
 * - xerimaii@gmail.com 600명 풀(슬롯 100~699) 생성 후 100명씩 배치 순환 로테이션 & CPU 65% 이하 자동 제어
 * - 인간 플레이어와 100% 동일한 전체 마법/기술(GameDB.Skills 83종: 전사 W01~10, 궁수 AS1~5/A01~15, 마법사 MP1~3/M01~50) 구사
 * - 인간 플레이어와 동일한 전투/버프/힐/디버프/보스 장판 회피/물약/인챈트/스킬북 습득/용병 스킬 제어
 * - AI끼리의 파티에 인간 플레이어 합류 허용 및 인간 플레이어의 파티장 요구 즉시 위임 지원
 * =====================================================================
 */
let WebSocket;
try {
  WebSocket = require('ws');
} catch (_) {
  const http = require('http');
  const crypto = require('crypto');
  const { EventEmitter } = require('events');

  class FallbackWebSocket extends EventEmitter {
    constructor(urlStr) {
      super();
      this.readyState = 0;
      const u = new URL(urlStr);
      const key = crypto.randomBytes(16).toString('base64');
      const req = http.request({
        hostname: u.hostname || '127.0.0.1',
        port: Number(u.port || 80),
        path: (u.pathname || '/ws') + (u.search || ''),
        headers: {
          Connection: 'Upgrade',
          Upgrade: 'websocket',
          'Sec-WebSocket-Version': '13',
          'Sec-WebSocket-Key': key
        }
      });
      req.on('upgrade', (res, socket, head) => {
        try { socket.setNoDelay(true); } catch (_) {}
        this.socket = socket;
        this.readyState = 1;
        let recvBuffer = (head && head.length > 0) ? Buffer.from(head) : Buffer.alloc(0);
        socket.on('data', (chunk) => {
          recvBuffer = Buffer.concat([recvBuffer, chunk]);
          while (recvBuffer.length >= 2) {
            const opcode = recvBuffer[0] & 0x0f;
            if (opcode === 0x08) {
              this.readyState = 3;
              socket.end();
              this.emit('close');
              return;
            }
            const isMasked = Boolean(recvBuffer[1] & 0x80);
            let payloadLen = recvBuffer[1] & 0x7f;
            let offset = 2;
            if (payloadLen === 126) {
              if (recvBuffer.length < 4) return;
              payloadLen = recvBuffer.readUInt16BE(2);
              offset = 4;
            } else if (payloadLen === 127) {
              if (recvBuffer.length < 10) return;
              payloadLen = Number(recvBuffer.readBigUInt64BE(2));
              offset = 10;
            }
            const totalLen = offset + (isMasked ? 4 : 0) + payloadLen;
            if (recvBuffer.length < totalLen) return;
            let dataBuf = recvBuffer.slice(offset + (isMasked ? 4 : 0), totalLen);
            if (isMasked) {
              const mask = recvBuffer.slice(offset, offset + 4);
              dataBuf = Buffer.from(dataBuf);
              for (let i = 0; i < payloadLen; i++) dataBuf[i] ^= mask[i % 4];
            }
            recvBuffer = recvBuffer.slice(totalLen);
            if (opcode === 0x01 || opcode === 0x02) {
              this.emit('message', dataBuf);
            }
          }
        });
        socket.on('close', () => {
          if (this.readyState !== 3) {
            this.readyState = 3;
            this.emit('close');
          }
        });
        socket.on('error', (err) => this.emit('error', err));
        this.emit('open');
      });
      req.on('error', (err) => {
        this.readyState = 3;
        this.emit('error', err);
        this.emit('close');
      });
      req.end();
    }
    send(data) {
      if (this.readyState !== 1 || !this.socket || this.socket.destroyed) return;
      const payload = Buffer.isBuffer(data) ? data : Buffer.from(String(data), 'utf8');
      const len = payload.length;
      const mask = crypto.randomBytes(4);
      let header;
      if (len < 126) {
        header = Buffer.alloc(6);
        header[0] = 0x81;
        header[1] = 0x80 | len;
        mask.copy(header, 2);
      } else if (len < 65536) {
        header = Buffer.alloc(8);
        header[0] = 0x81;
        header[1] = 0x80 | 126;
        header.writeUInt16BE(len, 2);
        mask.copy(header, 4);
      } else {
        header = Buffer.alloc(14);
        header[0] = 0x81;
        header[1] = 0x80 | 127;
        header.writeBigUInt64BE(BigInt(len), 2);
        mask.copy(header, 10);
      }
      const masked = Buffer.alloc(len);
      for (let i = 0; i < len; i++) masked[i] = payload[i] ^ mask[i % 4];
      this.socket.write(Buffer.concat([header, masked]));
    }
    close() {
      if (this.readyState === 3) return;
      this.readyState = 3;
      if (this.socket && !this.socket.destroyed) {
        try { this.socket.end(); } catch (_) {}
      }
      this.emit('close');
    }
  }
  FallbackWebSocket.CONNECTING = 0;
  FallbackWebSocket.OPEN = 1;
  FallbackWebSocket.CLOSING = 2;
  FallbackWebSocket.CLOSED = 3;
  WebSocket = FallbackWebSocket;
}
const {
  AI_ACCOUNT_EMAIL,
  AI_SLOT_START,
  AI_TOTAL_POOL,
  REGION_CONFIGS,
  PERSONALITIES,
  INVITE_WEIGHT_MAP,
  FULL_SKILL_DB,
  getLearnedSkillsForClass,
  supabaseRest,
  ensure50AICharactersSeeded,
  resetAndReseedAICharacters
} = require('./seed_ai_50.js');

// ─── 내장 폴백 지원하는 Redis Lazy Sync & Bulk Upsert 로더 (I/O 극대화 절감) ───
let updateAgentState, handleAgentLogout, syncDirtyAgentsToSupabase, startBatchSyncWorker;
try {
  ({
    updateAgentState,
    handleAgentLogout,
    syncDirtyAgentsToSupabase,
    startBatchSyncWorker
  } = require('./redis_sync_manager.js'));
} catch (_) {
  const _dirtySet = new Set();
  const _stateMap = new Map();
  let _batchTimer = null;
  updateAgentState = async (id, state) => {
    if (!id || !state) return;
    _stateMap.set(String(id), state);
    _dirtySet.add(String(id));
  };
  syncDirtyAgentsToSupabase = async () => {
    if (_dirtySet.size === 0) return;
    const ids = Array.from(_dirtySet);
    const batch = ids.map(id => _stateMap.get(id)).filter(Boolean);
    if (batch.length === 0) return;
    try {
      await supabaseRest('magic_characters?on_conflict=id', 'POST', batch, 'resolution=merge-duplicates,return=minimal');
      ids.forEach(id => _dirtySet.delete(id));
    } catch (e) {}
  };
  handleAgentLogout = async (id, state) => {
    if (state) _stateMap.set(String(id), { ...state, session_token: null });
    const rec = _stateMap.get(String(id));
    if (!rec) return;
    try {
      await supabaseRest('magic_characters?on_conflict=id', 'POST', [rec], 'resolution=merge-duplicates,return=minimal');
      _dirtySet.delete(String(id));
    } catch (e) {
      _dirtySet.add(String(id));
    }
  };
  startBatchSyncWorker = (ms = 240000) => {
    if (_batchTimer) return _batchTimer;
    _batchTimer = setInterval(() => syncDirtyAgentsToSupabase(), ms);
    return _batchTimer;
  };
}

try { require('dotenv').config(); } catch (_) {}
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const PORT = Number(process.env.PORT || 4000);
const SERVER_WS_URL = process.env.SERVER_WS_URL || `ws://127.0.0.1:${PORT}/ws`;
let maxConcurrentAI = Math.min(AI_TOTAL_POOL, Math.max(0, Number(process.env.MAX_CONCURRENT_AI || 100)));
const MAX_PARTY_MEMBERS = 5;
const MAX_AGENTS_PER_MAP = 8; // 단일 맵(필드/던전) 최대 상주 인원 캡(7~9명 기준 8명)
const CPU_LIMIT_PCT = Math.min(85, Math.max(35, Number(process.env.MAX_CPU_PERCENT || 65)));

// 📊 AI 러너 실시간 CPU 점유율 모니터 (최대 65% 이하 자동 스로틀링 보장)
let _lastCpuUsage = process.cpuUsage();
let _lastCpuCheckTs = Date.now();
let currentRunnerCpuPct = 10;
setInterval(() => {
  const now = Date.now();
  const elapsedUs = Math.max(1000, (now - _lastCpuCheckTs) * 1000);
  const diff = process.cpuUsage(_lastCpuUsage);
  _lastCpuUsage = process.cpuUsage();
  _lastCpuCheckTs = now;
  const rawPct = ((diff.user + diff.system) / elapsedUs) * 100;
  currentRunnerCpuPct = Math.round(currentRunnerCpuPct * 0.6 + rawPct * 0.4);
}, 1000);

// 100명 에이전트 중앙 통합 루프 타이머 (개별 setInterval 100개 생성으로 인한 타이머 오버헤드 제거)
let masterAiTickTimer = null;
let rotationCursor = 0; // 600명 풀(6개 조 x 100명) 순차 순환 커서
let lastRegionChatReplyTs = new Map(); // mapKey -> timestamp (일반 지역채팅 동시 응답 폭주 방지)

const fastHypot = (dx, dy) => Math.sqrt(dx * dx + dy * dy);

// 특정 맵에 현재 상주 중인 AI 에이전트 인원수 조회
function getMapAgentCount(mapKey, excludeCharId = null) {
  let cnt = 0;
  for (let i = 0; i < activeAgents.length; i++) {
    const a = activeAgents[i];
    if (!a || a.isLoggingOut || (excludeCharId && a.charId === excludeCharId)) continue;
    if (a.mapKey === mapKey) cnt++;
  }
  return cnt;
}

// 15개 지역(R01~R15) 필드(_sub1) 및 던전(_dungeon) 총 30개 맵에 고르게 분산 배치 & 맵당 최대 8명 캡 보장
function pickBalancedMapPlacement(level, slotIndex, excludeCharId = null, preferredRegionKey = null) {
  let baseIdx = 0;
  if (preferredRegionKey) {
    const foundIdx = REGION_CONFIGS.findIndex(r => r.id === preferredRegionKey);
    if (foundIdx >= 0) baseIdx = foundIdx;
  } else {
    for (let i = REGION_CONFIGS.length - 1; i >= 0; i--) {
      if (level >= REGION_CONFIGS[i].minLv) {
        baseIdx = i;
        break;
      }
    }
  }

  // 레벨에 맞는 지역을 최우선으로 탐색하고, 인원 캡(8명) 도달 시 인접 지역(±1, ±2...)의 필드/던전으로 자동 분산
  const regionOrder = [baseIdx];
  for (let offset = 1; offset < REGION_CONFIGS.length; offset++) {
    if (baseIdx - offset >= 0) regionOrder.push(baseIdx - offset);
    if (baseIdx + offset < REGION_CONFIGS.length) regionOrder.push(baseIdx + offset);
  }

  const preferDungeonFirst = (slotIndex % 3 === 0);
  let bestCandidate = null;
  let minPop = Infinity;

  for (let r = 0; r < regionOrder.length; r++) {
    const regCfg = REGION_CONFIGS[regionOrder[r]];
    const mapTypes = preferDungeonFirst ? ['dungeon', 'sub1'] : ['sub1', 'dungeon'];
    for (let m = 0; m < mapTypes.length; m++) {
      const mType = mapTypes[m];
      const mapKey = `${regCfg.id}_${mType}`;
      const pop = getMapAgentCount(mapKey, excludeCharId);
      if (pop < MAX_AGENTS_PER_MAP) {
        const calcSafeHuntPos = (isDung, cfg) => {
          if (isDung) {
            return {
              x: Math.round(750 + ((slotIndex * 197) % 1500)),
              y: Math.round(750 + ((slotIndex * 263) % 1500))
            };
          }
          const zoneCenters = [
            { x: cfg.townX || 2000, y: Math.max(1400, (cfg.townY || 14250) - 950) },
            { x: cfg.fieldX || 1800, y: cfg.fieldY || 9200 },
            { x: cfg.dungeonX || 2100, y: (cfg.dungeonY || 5200) + 420 },
            { x: cfg.bossX || 2000, y: (cfg.bossY || 1850) + 420 }
          ];
          const zc = zoneCenters[slotIndex % zoneCenters.length];
          let px = Math.round(zc.x + (((slotIndex * 173) % 760) - 380));
          let py = Math.round(zc.y + (((slotIndex * 389) % 760) - 380));
          px = Math.max(350, Math.min(3650, px));
          py = Math.max(1200, Math.min(13600, py));
          if (fastHypot(px - cfg.townX, py - cfg.townY) <= 820) {
            py = Math.max(1200, (cfg.townY || 14250) - 920);
          }
          return { x: px, y: py };
        };
        // 정원 미만인 첫 적정 레벨 맵 중 인원이 적은 곳 선택
        if (r <= 2 && pop <= 5) {
          const isDung = (mType === 'dungeon');
          const pos = calcSafeHuntPos(isDung, regCfg);
          return {
            regionKey: regCfg.id,
            mapKey,
            x: pos.x,
            y: pos.y
          };
        }
        if (pop < minPop) {
          minPop = pop;
          const isDung = (mType === 'dungeon');
          const pos = calcSafeHuntPos(isDung, regCfg);
          bestCandidate = {
            regionKey: regCfg.id,
            mapKey,
            x: pos.x,
            y: pos.y
          };
        }
      }
    }
    if (bestCandidate && minPop < MAX_AGENTS_PER_MAP) break;
  }

  if (bestCandidate) return bestCandidate;

  const fallbackReg = REGION_CONFIGS[slotIndex % REGION_CONFIGS.length];
  const isDung = (slotIndex % 2 === 1);
  return {
    regionKey: fallbackReg.id,
    mapKey: isDung ? `${fallbackReg.id}_dungeon` : `${fallbackReg.id}_sub1`,
    x: isDung ? Math.round(1000 + (slotIndex % 10) * 110) : Math.round(1400 + (slotIndex % 10) * 120),
    y: isDung ? Math.round(1000 + (slotIndex % 10) * 110) : Math.round(8400 + (slotIndex % 12) * 320)
  };
}

// 인간 플레이어와 동일한 전체 스킬 DB (83종 + 레거시 호환)
const SKILL_DB = FULL_SKILL_DB;

const POTION_HEAL_MAP = {
  C_HP01: { hp: 185 },
  C_HP02: { hp: 520 },
  C_HP03: { hp: 650 },
  C_HP04: { hp: 950 },
  C_HP05: { hp: 1600 },
  C_P01:  { hp: 185 },
  C_P02:  { hp: 520 },
  C_P03:  { mp: 120 },
  C_P04:  { mp: 320 },
  C_P05:  { hp: 1600 },
  C_MP01: { mp: 120 },
  C_MP02: { mp: 320 },
  C_MP03: { mp: 480 },
  C_MP04: { mp: 750 }
};

let currentGroqModel = 'llama-3.3-70b-versatile';
let allAiDbRecords = [];
let activeAgents = [];

async function initGroqModel() {
  if (!GROQ_API_KEY) return;
  try {
    const res = await fetch('https://api.groq.com/openai/v1/models', {
      headers: { Authorization: `Bearer ${GROQ_API_KEY}` }
    });
    if (!res.ok) return;
    const data = await res.json();
    const availableIds = (data.data || []).map(m => m.id);
    const priorityPreferences = [
      'qwen/qwen3-32b',
      'llama-3.3-70b-versatile',
      'llama-3.1-8b-instant',
      'gemma2-9b-it'
    ];
    let picked = priorityPreferences.find(mId => availableIds.includes(mId));
    if (!picked) {
      picked = availableIds.find(id =>
        !id.includes('whisper') &&
        !id.includes('guard') &&
        !id.includes('tts')
      );
    }
    if (picked) {
      currentGroqModel = picked;
      console.log(`✔ [Groq LLM 모델 세팅 완료] 활성 모델: ${currentGroqModel}`);
    }
  } catch (err) {
    console.warn(`⚠️ [Groq 모델 조회 폴백] 기본 모델(${currentGroqModel}) 유지`);
  }
}

async function callGroqChatCompletion(messages) {
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${GROQ_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: currentGroqModel,
      messages,
      response_format: { type: 'json_object' },
      max_tokens: 160,
      temperature: 0.78
    })
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Groq HTTP ${res.status}: ${txt.slice(0, 120)}`);
  }
  return res.json();
}

function getRegionCfg(regionKey) {
  return REGION_CONFIGS.find(r => r.id === regionKey) || REGION_CONFIGS[0];
}

function getMapBounds(mapKey) {
  const mStr = String(mapKey || "");
  const isDungeon = mStr.includes("dungeon") || mStr.endsWith("_sub3");
  if (isDungeon) {
    return { isDungeon: true, minX: 220, maxX: 2780, minY: 220, maxY: 2780, centerX: 1500, centerY: 1500 };
  }
  return { isDungeon: false, minX: 260, maxX: 3740, minY: 800, maxY: 13600, centerX: 2000, centerY: 9200 };
}

function isInTownSafeZone(mapKey, x, y) {
  if (!mapKey || String(mapKey).includes('dungeon') || String(mapKey).endsWith('_sub3')) return false;
  const regKey = String(mapKey).split('_')[0] || 'R01';
  const cfg = getRegionCfg(regKey);
  // 서버(magic_server.js) 및 클라이언트(HardcodedMapDB)의 심리스 마을 안전지대 반경(780px)과 100% 일치
  if (fastHypot(x - cfg.townX, y - cfg.townY) <= 780) return true;
  return false;
}

function angleToDirString(rad) {
  if (typeof rad !== 'number' || isNaN(rad)) return 'down';
  const deg = ((rad * 180) / Math.PI + 360) % 360;
  if (deg >= 45 && deg < 135) return 'down';
  if (deg >= 135 && deg < 225) return 'left';
  if (deg >= 225 && deg < 315) return 'up';
  return 'right';
}

class AIAgentClient {
  constructor(dbRow, isInitialBoot = false) {
    this.dbRow = dbRow;
    const cd = dbRow.char_data || {};

    this.charId = dbRow.id;
    this.userId = dbRow.user_id;
    this.slotIndex = Number(dbRow.slot_index);
    this.name = dbRow.name || `모험가${this.slotIndex}`;
    this.charClass = dbRow.class || 'knight';
    this.level = Number(dbRow.level) || 15;
    this.exp = Number(dbRow.exp) || 0;
    this.maxExp = Number(cd.maxExp) || Math.floor(100 * Math.pow(this.level, 1.38));
    this.gold = Math.max(Number(dbRow.gold) || 0, 300000 + this.level * 20000);

    const initReg = dbRow.region_key || this.pickBestRegionForLevel();
    const initMap = dbRow.map_key || `${initReg}_sub1`;
    const currentMapPop = getMapAgentCount(initMap, this.charId);

    if (currentMapPop >= MAX_AGENTS_PER_MAP || (isInitialBoot && (this.slotIndex % 3 === 0))) {
      const balanced = pickBalancedMapPlacement(this.level, this.slotIndex, this.charId, initReg);
      this.regionKey = balanced.regionKey;
      this.mapKey = balanced.mapKey;
      this.x = balanced.x;
      this.y = balanced.y;
    } else {
      this.regionKey = initReg;
      this.mapKey = initMap;
      const bounds = getMapBounds(this.mapKey);
      const regCfg = getRegionCfg(this.regionKey);
      this.x = Number(dbRow.pos_x) || (bounds.isDungeon ? (900 + (this.slotIndex % 10) * 110) : (1500 + (this.slotIndex % 10) * 110));
      this.y = Number(dbRow.pos_y) || (bounds.isDungeon ? (900 + (this.slotIndex % 10) * 110) : (8500 + (this.slotIndex % 12) * 320));
      this.x = Math.max(bounds.minX, Math.min(bounds.maxX, this.x));
      this.y = Math.max(bounds.minY, Math.min(bounds.maxY, this.y));
      if (isInTownSafeZone(this.mapKey, this.x, this.y)) {
        this.x = (regCfg.fieldX || 1800) + ((this.slotIndex % 7) - 3) * 90;
        this.y = (regCfg.fieldY || 9200) + ((this.slotIndex % 8) - 4) * 120;
      }
    }

    this.angle = 0;
    this.dir = 'down';
    this.isWalking = false;
    this.moveX = null;
    this.moveY = null;

    this.maxHp = Number(cd.maxHp) || (220 + this.level * 40);
    this.hp = Math.min(this.maxHp, Number(cd.hp) || this.maxHp);
    this.maxMp = Number(cd.maxMp) || (140 + this.level * 26);
    this.mp = Math.min(this.maxMp, Number(cd.mp) || this.maxMp);

    this.stats = cd.stats || {
      STR: 16 + this.level,
      DEX: 16 + this.level,
      CON: 15 + this.level,
      INT: 16 + this.level,
      str: 16 + this.level,
      dex: 16 + this.level,
      con: 15 + this.level,
      int: 16 + this.level,
      wis: 14 + this.level,
      statPoints: 0
    };
    this.equip = cd.equip || {};
    this.inventory = Array.isArray(cd.inventory) ? cd.inventory : [];

    // 인간 플레이어와 동등한 전체 스킬셋 부여
    const baseSkills = getLearnedSkillsForClass(this.charClass, this.level);
    const savedSkills = Array.isArray(cd.learnedSkills) ? cd.learnedSkills : [];
    this.learnedSkills = Array.from(new Set([...savedSkills, ...baseSkills]));

    this.mercenary = cd.mercenary || null;
    if (this.mercenary) {
      this.mercenary.hired = true;
      this.mercenary.isDead = false;
      this.mercenary.x = this.x + 42;
      this.mercenary.y = this.y + 32;
      this.mercenary.dir = 'down';
      this.mercenary.hp = this.mercenary.maxHp || 500;
      this.mercenary.mp = this.mercenary.maxMp || 250;
      this.mercenary.stance = 'ATTACK';
      this.mercenary.learnedSkills = getLearnedSkillsForClass(this.mercenary.class || 'knight', this.mercenary.level || this.level);
      this.mercenary.skillCooldowns = {};
    }

    // 고유 성향 및 페르소나 부여
    let hash = this.slotIndex * 17;
    for (let i = 0; i < this.name.length; i++) hash += this.name.charCodeAt(i);
    this.personality = cd.personality || PERSONALITIES[hash % PERSONALITIES.length];
    this.autoInviteChance = typeof cd.autoInviteChance === 'number'
      ? cd.autoInviteChance
      : INVITE_WEIGHT_MAP[hash % INVITE_WEIGHT_MAP.length];

    // 생애 주기 및 600명 풀 -> 100명씩 자연스러운 순환 로테이션 (초기 기동 시 15~90분 균등 위상 분산, 이후 35~95분)
    this.sessionStart = Date.now();
    const phaseMinutes = isInitialBoot
      ? (15 + ((this.slotIndex - AI_SLOT_START) % 75) + Math.floor(Math.random() * 6))
      : (35 + Math.floor(Math.random() * 60));
    this.sessionDuration = phaseMinutes * 60 * 1000;
    this.isLoggingOut = false;
    this._isDirty = false;
    this.sessionToken = `ai_sess_${this.slotIndex}_${Date.now()}`;

    this.ws = null;
    this.state = 'HUNTING';
    this.isShopping = false;

    this.targetMob = null;
    this.targetMobId = null;
    this.skillCooldowns = {};
    this.activeBuffs = {}; // buffKey -> expireTimestamp
    this.lastAttackTime = 0;
    this.lastRegenTime = Date.now();
    this.lastItemManageTime = Date.now();
    this.lastMapCheckTime = Date.now();
    this.lastSupabaseSyncTime = Date.now() - ((this.slotIndex * 613) % 60000);
    this.lastBuffPotTime = 0;

    // 끼임(Stuck) 방지 추적
    this.stuckCheckTime = Date.now();
    this.lastStuckX = this.x;
    this.lastStuckY = this.y;

    // 서버 권위 월드 상태
    this.worldPlayers = new Map();
    this.worldMonsters = new Map();
    this.worldItems = new Map();

    // 파티 및 소셜 상태
    this.partyData = null;
    this.pendingPartyInvite = null;
    this.followTargetName = null;
    this.followDist = this.charClass === 'knight' ? 65 : 155;
    this.lastProactiveInviteCheck = Date.now();
    this.lastPartyInviteTime = 0;
    this.invitedHistory = new Map();
    this.rejectedTargets = new Set();
    this.lastLeaderFieldPos = null;   // 파티장이 사냥터에 있었을 때의 마지막 필드/던전 좌표 (마을 귀환 시 대기/자유사냥 앵커)
    this.preShopReturnSpot = null;    // 물약 사러 마을 가기 직전 사냥터 좌표 (파티장/파티원 복귀용)
    this.isRegroupingToLeader = false;// 추종 거리 초과 후 리더에게 복귀 중인지 여부 (경계 진동 방지 히스테리시스)
    this.wasLeaderInTown = false;     // 직전 틱에 파티장이 마을 안전지대에 있었는지 여부
    this.lastShopChatTs = 0;          // 마을 정비 안내 파티채팅 쿨타임
    this.activeTradeId = null;        // 플레이어와의 거래 세션 ID

    // LLM 채팅 히스토리
    this.chatHistory = [];
    this.combatMemory = '최근 필드에서 용병과 함께 순조롭게 사냥 중입니다.';
    this.lastAiCallTime = 0;
    this.lastTalkedUser = null;
    this.lastTalkTime = 0;

    this.recalculateCombatPower();
    this.connect();
  }

  pickBestRegionForLevel() {
    for (let i = REGION_CONFIGS.length - 1; i >= 0; i--) {
      const r = REGION_CONFIGS[i];
      if (this.level >= r.minLv) return r.id;
    }
    return 'R01';
  }

  hasBuff(buffKey) {
    return Boolean(this.activeBuffs[buffKey] && this.activeBuffs[buffKey] > Date.now());
  }

  recalculateCombatPower() {
    let pAtk = 18 + this.level * 3.5;
    let mAtk = 18 + this.level * 3.6;
    let pDef = 10 + Math.floor(this.level * 1.5);
    let mDef = 8 + Math.floor(this.level * 1.3);
    let critBonus = 0;
    let coolReduce = 0;

    for (const item of Object.values(this.equip || {})) {
      if (!item || !item.stats) continue;
      pAtk += Number(item.stats.pAtk || 0);
      mAtk += Number(item.stats.mAtk || 0);
      pDef += Number(item.stats.pDef || 0);
      mDef += Number(item.stats.mDef || 0);
      critBonus += Number(item.stats.crit || 0);
    }

    // 인간 플레이어와 동일한 패시브 스킬 보너스 반영
    for (const skId of (this.learnedSkills || [])) {
      const sk = SKILL_DB[skId];
      if (!sk || sk.type !== 'passive') continue;
      if (sk.bonusPAtk) pAtk += sk.bonusPAtk;
      if (sk.bonusMAtk) mAtk += sk.bonusMAtk;
      if (sk.bonusPDef) pDef += sk.bonusPDef;
      if (sk.bonusCrit) critBonus += sk.bonusCrit;
      if (sk.bonusCoolReduce) coolReduce += sk.bonusCoolReduce;
    }

    // 활성 버프 효과 반영
    if (this.hasBuff('RAGE') || this.hasBuff('SHADOW_FANG') || this.hasBuff('NATURES_FURY') || this.hasBuff('ATK_POT')) {
      pAtk *= 1.18;
      mAtk *= 1.18;
    }
    if (this.hasBuff('ENCHANT_STAT') || this.hasBuff('ADV_SPIRIT')) {
      pAtk *= 1.12;
      mAtk *= 1.12;
      pDef += 12;
      mDef += 12;
    }
    if (this.hasBuff('SHIELD')) {
      pDef += 18 + Math.floor(this.level * 0.4);
    }
    if (this.hasBuff('ARCHMAGE')) {
      mAtk *= 1.28;
      coolReduce += 35;
    }

    if (this.charClass === 'ranger') pAtk = Math.round(pAtk * 1.14);
    if (this.charClass === 'knight') pAtk = Math.round(pAtk * 1.08);
    if (this.charClass === 'wizard') mAtk = Math.round(mAtk * 1.14);

    this.pAtk = Math.round(pAtk);
    this.mAtk = Math.round(mAtk);
    this.pDef = Math.round(pDef);
    this.mDef = Math.round(mDef);
    this.critRate = Math.min(75, (this.charClass === 'ranger' ? 24 : 15) + critBonus + (this.hasBuff('EAGLE_EYE') ? 10 : 0));
    this.coolReducePct = Math.min(50, coolReduce);
  }

  getBaseMoveSpeedFrame60() {
    // 플레이어(data.js)와 100% 동일한 상용 MMORPG 헤이스트 전 기본 이동속도 (60FPS 기준 프레임당 픽셀)
    const base = this.charClass === 'ranger' ? 2.02 : (this.charClass === 'wizard' ? 1.85 : 1.90);
    const spdBoost = (this.hasBuff('HOLY_WALK') || this.hasBuff('WIND_WALK') || this.hasBuff('HASTE')) ? 1.18 : 1.0;
    return Number((base * spdBoost).toFixed(2));
  }

  buildPlayerSyncPayload(isFull = false) {
    const curSpd60 = this.getBaseMoveSpeedFrame60();
    const rx = Math.round(this.x);
    const ry = Math.round(this.y);
    const rMoveX = (this.isWalking && typeof this.moveX === 'number') ? Math.round(this.moveX) : rx;
    const rMoveY = (this.isWalking && typeof this.moveY === 'number') ? Math.round(this.moveY) : ry;

    if (!isFull) {
      // 📉 루프백 대역폭 50%+ 절감을 위한 델타 페이로드 (이름/직업/장비/최대HP 등 정적 메타데이터 제외)
      const deltaPayload = {
        charId: this.charId,
        x: rx,
        y: ry,
        moveX: rMoveX,
        moveY: rMoveY,
        speed: curSpd60,
        dir: this.dir || 'down',
        isWalking: Boolean(this.isWalking),
        lastAttackTime: this.lastAttackTime || 0,
        hp: Math.round(this.hp),
        mp: Math.round(this.mp),
        targetMobId: this.targetMobId || null
      };
      if (this.mercenary && this.mercenary.hired) {
        deltaPayload.mercenary = {
          x: Math.round(this.mercenary.x || rx + 40),
          y: Math.round(this.mercenary.y || ry + 30),
          dir: this.mercenary.dir || 'down',
          isWalking: Boolean(this.mercenary.isWalking),
          lastAttackTime: this.mercenary.lastAttackTime || 0,
          hp: Math.round(this.mercenary.hp || 250),
          mp: Math.round(this.mercenary.mp || 100)
        };
      }
      return deltaPayload;
    }

    const wType = this.equip?.weapon?.type || (this.charClass === 'ranger' ? 'W_BW02' : (this.charClass === 'wizard' ? 'W_ST02' : 'W_SW02'));
    return {
      charId: this.charId,
      name: this.name,
      class: this.charClass,
      level: this.level,
      x: rx,
      y: ry,
      moveX: rMoveX,
      moveY: rMoveY,
      speed: curSpd60,
      dir: this.dir || 'down',
      isWalking: Boolean(this.isWalking),
      lastAttackTime: this.lastAttackTime || 0,
      hp: Math.round(this.hp),
      maxHp: Math.round(this.maxHp),
      mp: Math.round(this.mp),
      maxMp: Math.round(this.maxMp),
      targetMobId: this.targetMobId || null,
      weaponType: wType,
      hasShield: this.charClass === 'knight',
      isAI: true,
      mercenary: this.mercenary && this.mercenary.hired ? {
        hired: true,
        isDead: Boolean(this.mercenary.isDead),
        class: this.mercenary.class || 'knight',
        name: this.mercenary.name || '용병',
        level: this.mercenary.level || this.level,
        x: Math.round(this.mercenary.x || rx + 40),
        y: Math.round(this.mercenary.y || ry + 30),
        speed: Number((curSpd60 * 1.02).toFixed(2)),
        dir: this.mercenary.dir || 'down',
        isWalking: Boolean(this.mercenary.isWalking),
        stance: this.mercenary.stance || 'ATTACK',
        lastAttackTime: this.mercenary.lastAttackTime || 0,
        hp: Math.round(this.mercenary.hp || 250),
        maxHp: Math.round(this.mercenary.maxHp || 250),
        mp: Math.round(this.mercenary.mp || 100),
        maxMp: Math.round(this.mercenary.maxMp || 100)
      } : null
    };
  }

  connect() {
    if (this.isLoggingOut) return;
    try {
      this.ws = new WebSocket(SERVER_WS_URL);
    } catch (err) {
      return;
    }

    this.ws.on('open', () => {
      this._lastFullSyncTs = Date.now();
      this.sendWs({
        type: 'ENTER_CHAR',
        charId: this.charId,
        userId: this.userId,
        sessionToken: this.sessionToken,
        mapKey: this.mapKey,
        regionKey: this.regionKey,
        player: this.buildPlayerSyncPayload(true)
      });

      if (!this.loopTimer) {
        this.startLoop();
      }
    });

    this.ws.on('message', (raw) => {
      let msg = null;
      try {
        const str = Buffer.isBuffer(raw) ? raw.toString('utf8') : String(raw);
        msg = JSON.parse(str);
      } catch (e) {
        return;
      }
      this.handleServerMessage(msg);
    });

    this.ws.on('close', () => {
      this.partyData = null;
      // 🛡️ 소켓 종료 시 루프 플래그 해제 및 메모리 누수 원천 차단
      if (this.loopTimer && typeof this.loopTimer === 'object') {
        clearInterval(this.loopTimer);
      }
      this.loopTimer = null;
    });

    this.ws.on('error', () => {});
  }

  sendWs(payload) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(JSON.stringify(payload));
      } catch (e) {}
    }
  }

  handleServerMessage(msg) {
    if (!msg || !msg.type) return;

    switch (msg.type) {
      case 'MAP_INIT_STATE': {
        this.worldMonsters.clear();
        for (const m of (msg.monsters || [])) {
          if (m && m.id) {
            this.worldMonsters.set(String(m.id), m);
          }
        }
        this.worldItems.clear();
        for (const it of (msg.groundItems || [])) {
          if (it && it.uid) {
            this.worldItems.set(String(it.uid), it);
          }
        }
        this.worldPlayers.clear();
        for (const p of (msg.players || [])) {
          if (p && p.charId && p.charId !== this.charId) {
            this.worldPlayers.set(p.charId, p);
          }
        }
        break;
      }

      case 'WORLD_STATE_TICK': {
        if (Array.isArray(msg.ms)) {
          for (const tup of msg.ms) {
            const mId = String(tup[0]);
            const existing = this.worldMonsters.get(mId) || { id: mId, name: '몬스터', lv: this.level };
            existing.x = tup[1];
            existing.y = tup[2];
            existing.hp = tup[3];
            existing.isDead = Boolean(tup[4]);
            if (tup[6] !== undefined) existing.maxHp = tup[6];
            this.worldMonsters.set(mId, existing);
          }
        }

        if (Array.isArray(msg.players)) {
          for (const p of msg.players) {
            if (!p || !p.charId || p.charId === this.charId) continue;
            const prev = this.worldPlayers.get(p.charId) || {};
            this.worldPlayers.set(p.charId, { ...prev, ...p });
          }
        }
        if (Array.isArray(msg.allCharIds)) {
          const validSet = new Set(msg.allCharIds);
          for (const cid of this.worldPlayers.keys()) {
            if (!validSet.has(cid)) this.worldPlayers.delete(cid);
          }
        }

        if (msg.party !== undefined) {
          this.onPartyUpdated(msg.party);
        }
        break;
      }

      case 'MONSTERS_SPAWNED': {
        for (const m of (msg.monsters || [])) {
          if (m && m.id) this.worldMonsters.set(String(m.id), m);
        }
        break;
      }

      case 'MONSTER_RESPAWNED': {
        if (msg.monster && msg.monster.id) {
          const mId = String(msg.monster.id);
          const existing = this.worldMonsters.get(mId) || {};
          this.worldMonsters.set(mId, { ...existing, ...msg.monster, isDead: false });
        }
        break;
      }

      case 'MONSTER_DAMAGED': {
        const mId = String(msg.mobId);
        const mob = this.worldMonsters.get(mId);
        if (mob) {
          mob.hp = msg.hp;
          if (typeof msg.x === 'number') mob.x = msg.x;
          if (typeof msg.y === 'number') mob.y = msg.y;
        }
        if (msg.attackerCharId === this.charId) {
          if (msg.drainHeal) this.hp = Math.min(this.maxHp, this.hp + Number(msg.drainHeal));
          if (msg.mpDrain) this.mp = Math.min(this.maxMp, this.mp + Number(msg.mpDrain));
        }
        break;
      }

      case 'GM_MASS_KILL': {
        for (const mob of this.worldMonsters.values()) {
          if (mob && !mob.isDead) {
            mob.isDead = true;
            mob.hp = 0;
          }
        }
        this.targetMob = null;
        this.targetMobId = null;
        this.lastAiDecisionTime = Date.now() - 160;
        if (Array.isArray(msg.newGroundItems)) {
          for (const it of msg.newGroundItems) {
            if (it && it.uid) this.worldItems.set(String(it.uid), it);
          }
        }
        break;
      }

      case 'MONSTER_KILLED': {
        const mId = String(msg.mobId);
        const mob = this.worldMonsters.get(mId);
        if (mob) {
          mob.isDead = true;
          mob.hp = 0;
        }
        if (this.targetMobId === mId) {
          this.targetMob = null;
          this.targetMobId = null;
          // 타겟 사망 시 다음 타겟 탐색이 최대 0.2~0.3초 이내(인간 수준 반응속도)에 이루어지도록 의사결정 타이머 당김
          this.lastAiDecisionTime = Date.now() - 160;
        }
        if (Array.isArray(msg.newGroundItems)) {
          for (const it of msg.newGroundItems) {
            if (it && it.uid) this.worldItems.set(String(it.uid), it);
          }
        }
        if (Array.isArray(msg.contributors) && msg.contributors.includes(this.charId)) {
          const shareCount = Math.max(1, msg.contributors.length);
          const partyBonus = shareCount > 1 ? (1 + (shareCount - 1) * 0.25) : 1;
          const expGain = Math.floor(((msg.baseExp || 30) * partyBonus) / shareCount);
          const goldGain = Math.floor(((msg.droppedGold || 20) * partyBonus) / shareCount);
          this.gainExpAndGold(expGain, goldGain);
        }
        break;
      }

      case 'MONSTER_ATTACK_EVENT': {
        if (msg.targetCharId === this.charId) {
          if (this.hasBuff('ABSOLUTE_BARRIER')) break;
          const rawAtk = Number(msg.mobAtk) || 15;
          if (msg.targetType === 'mercenary' && this.mercenary && this.mercenary.hired) {
            let dmg = Math.max(1, Math.round(rawAtk * 0.72));
            if (this.hasBuff('IMMUNE')) dmg = Math.max(1, Math.floor(dmg * 0.55));
            this.mercenary.hp = Math.max(1, (this.mercenary.hp || 200) - dmg);
          } else {
            // 전사 카운터 어택 반격
            if (this.hasBuff('COUNTER') && msg.mobId) {
              delete this.activeBuffs.COUNTER;
              this.sendWs({
                type: 'PLAYER_ACTION_FX',
                charId: this.charId,
                mapKey: this.mapKey,
                fxKind: 'combat_react',
                reactType: 'counter',
                x: Math.round(this.x),
                y: Math.round(this.y)
              });
              const attackerMob = this.worldMonsters.get(String(msg.mobId));
              if (attackerMob && !attackerMob.isDead) {
                this.performAttackOnMob(attackerMob, SKILL_DB.W02, Date.now(), false);
              }
              break;
            }
            const defVal = msg.isMagic ? this.mDef : this.pDef;
            let dmg = Math.max(1, Math.round(rawAtk * (100 / (100 + defVal))));
            if (this.hasBuff('IMMUNE') || this.hasBuff('SOUL_BARRIER')) dmg = Math.max(1, Math.floor(dmg * 0.55));
            if (this.hasBuff('MANA_SHIELD') && this.mp >= Math.ceil(dmg * 0.5)) {
              const absorb = Math.floor(dmg * 0.5);
              this.mp -= absorb;
              dmg -= absorb;
            }
            this.hp = Math.max(1, this.hp - dmg);
            this.checkDrinkPotion();
          }
        }
        break;
      }

      case 'BOSS_TELEGRAPH_START': {
        // 인간 플레이어처럼 보스 광역 장판 예고 시 회피 기동(닷지 스텝 / 텔레포트 / 무적기 / 보행 이탈)
        const bx = Number(msg.x) || 0;
        const by = Number(msg.y) || 0;
        const rad = Number(msg.radius) || 165;
        if (fastHypot(this.x - bx, this.y - by) <= rad + 25) {
          this.evadeBossTelegraph(bx, by, rad);
        }
        break;
      }

      case 'GROUND_ITEM_ADDED': {
        if (msg.item && msg.item.uid) {
          this.worldItems.set(String(msg.item.uid), msg.item);
        }
        break;
      }

      case 'GROUND_ITEM_REMOVED': {
        if (msg.itemUid) {
          this.worldItems.delete(String(msg.itemUid));
        }
        break;
      }

      case 'GROUND_ITEMS_SYNC': {
        this.worldItems.clear();
        for (const it of (msg.groundItems || [])) {
          if (it && it.uid) this.worldItems.set(String(it.uid), it);
        }
        break;
      }

      case 'ITEM_PICKUP_CONFIRMED': {
        if (msg.item) {
          this.onLootedItem(msg.item);
        }
        break;
      }

      case 'PARTY_INVITE_RECEIVED': {
        this.onPartyInviteReceived(msg);
        break;
      }

      case 'PARTY_STATE_UPDATE': {
        this.onPartyUpdated(msg.party);
        break;
      }

      case 'TRADE_INVITE_RECEIVED': {
        this.onTradeInviteReceived(msg);
        break;
      }

      case 'TRADE_STATE_SYNC': {
        this.onTradeStateSync(msg);
        break;
      }

      case 'TRADE_COMMIT_EXECUTE': {
        this.onTradeCommitExecute(msg);
        break;
      }

      case 'TRADE_CANCELLED': {
        this.activeTradeId = null;
        break;
      }

      case 'REMOTE_ALLY_SUPPORT': {
        if (msg.targetCharId === this.charId) {
          if (msg.healAmt) {
            this.hp = Math.min(this.maxHp, this.hp + Number(msg.healAmt));
          }
          if (msg.buffKey) {
            this.activeBuffs[msg.buffKey] = Date.now() + (Number(msg.durMs) || 180000);
            this.recalculateCombatPower();
          }
        }
        break;
      }

      case 'REMOTE_CHAT': {
        this.onChatReceived(msg);
        break;
      }

      case 'GM_TELEPORT': {
        if (msg.mapKey) {
          const rKey = String(msg.mapKey).split('_')[0] || this.regionKey;
          this.teleportToMap(rKey, msg.mapKey, msg.x || 2000, msg.y || 13500);
        }
        break;
      }

      case 'FORCE_CLIENT_SAVE':
      case 'SERVER_SHUTDOWN_NOTICE':
      case 'SERVER_REBOOT_COUNTDOWN': {
        if (msg.type !== 'SERVER_REBOOT_COUNTDOWN' || msg.secondsLeft === 15 || msg.secondsLeft === 5 || msg.secondsLeft === 2) {
          this.saveToSupabase(false);
        }
        break;
      }
    }
  }

  evadeBossTelegraph(bx, by, rad) {
    const now = Date.now();
    const bounds = getMapBounds(this.mapKey);
    const escAngle = Math.atan2(this.y - by, this.x - bx) || (Math.random() * Math.PI * 2);
    const escDist = rad + 95;
    const nx = Math.max(bounds.minX, Math.min(bounds.maxX, bx + Math.cos(escAngle) * escDist));
    const ny = Math.max(bounds.minY, Math.min(bounds.maxY, by + Math.sin(escAngle) * escDist));

    // 궁수 닷지 스텝 또는 마법사 텔레포트 보유 시 즉시 회피 도약
    if (this.charClass === 'ranger' && this.learnedSkills.includes('AS3') && this.mp >= 10 && now - (this.skillCooldowns.AS3 || 0) >= 3000) {
      this.mp -= 10;
      this.skillCooldowns.AS3 = now;
      this.x = nx;
      this.y = ny;
      this.sendWs({
        type: 'PLAYER_ACTION_FX',
        charId: this.charId,
        mapKey: this.mapKey,
        fxKind: 'teleport',
        x: Math.round(this.x),
        y: Math.round(this.y),
        skillName: '닷지 스텝'
      });
      return;
    }
    if (this.charClass === 'wizard' && this.learnedSkills.includes('M38') && this.mp >= 110 && now - (this.skillCooldowns.M38 || 0) >= 28000) {
      this.mp -= 110;
      this.skillCooldowns.M38 = now;
      this.activeBuffs.ABSOLUTE_BARRIER = now + 8000;
      this.sendWs({
        type: 'PLAYER_ACTION_FX',
        charId: this.charId,
        mapKey: this.mapKey,
        fxKind: 'ally_buff',
        x: Math.round(this.x),
        y: Math.round(this.y),
        skillName: '앱솔루트 배리어'
      });
      return;
    }

    this.moveX = nx;
    this.moveY = ny;
    this.isWalking = true;
    if (this.mercenary && this.mercenary.hired) {
      this.mercenary.x = nx + 35;
      this.mercenary.y = ny + 25;
    }
  }

  onPartyUpdated(partySnap) {
    const prevFocusTarget = this.partyData?.leaderTargetMobId || null;
    const prevMode = this.partyData?.partyMode || 'FREE';
    this.partyData = partySnap || null;
    if (!this.partyData) {
      this.followTargetName = null;
      this.lastLeaderFieldPos = null;
      this.isRegroupingToLeader = false;
      this.wasLeaderInTown = false;
      return;
    }

    if (this.partyData.leaderCharId && this.partyData.leaderCharId !== this.charId) {
      const leaderMem = (this.partyData.members || []).find(m => m.charId === this.partyData.leaderCharId);
      const leaderInTown = Boolean(
        this.partyData.leaderInSafeZone ||
        (leaderMem && isInTownSafeZone(leaderMem.mapKey || this.mapKey, Number(leaderMem.x) || 2000, Number(leaderMem.y) || 14250))
      );

      // 파티장이 점사(FOCUS) 타겟을 변경했거나 모드가 변경된 경우 딜레이 없이 다음 틱에 즉시 반영
      if (
        (this.partyData.partyMode === 'FOCUS' && this.partyData.leaderTargetMobId && this.partyData.leaderTargetMobId !== prevFocusTarget) ||
        this.partyData.partyMode !== prevMode
      ) {
        this.lastAiDecisionTime = 0;
      }

      if (leaderMem) {
        this.followTargetName = leaderMem.name;
        const targetBounds = getMapBounds(leaderMem.mapKey || this.mapKey);
        const lx = Number(leaderMem.x) || targetBounds.centerX;
        const ly = Number(leaderMem.y) || targetBounds.centerY;

        if (!leaderInTown) {
          this.lastLeaderFieldPos = {
            regionKey: leaderMem.regionKey || String(leaderMem.mapKey || this.mapKey).split('_')[0],
            mapKey: leaderMem.mapKey || this.mapKey,
            x: lx,
            y: ly
          };
          // 파티장이 마을에서 물약을 사고 사냥터로 돌아온 순간: 임시 자유사냥 타겟을 정리하고 점사모드(FOCUS) 등 원래 모드로 즉시 복귀!
          if (this.wasLeaderInTown) {
            this.wasLeaderInTown = false;
            this.lastAiDecisionTime = 0;
            if (this.partyData.partyMode === 'FOCUS') {
              const focusId = this.partyData.leaderTargetMobId;
              if (!focusId || String(this.targetMobId) !== String(focusId)) {
                this.targetMob = null;
                this.targetMobId = null;
              }
            }
          }
          if (leaderMem.mapKey && leaderMem.mapKey !== this.mapKey && this.state !== 'SHOPPING') {
            const tx = Math.max(targetBounds.minX, Math.min(targetBounds.maxX, lx + (Math.random() * 60 - 30)));
            const ty = Math.max(targetBounds.minY, Math.min(targetBounds.maxY, ly + (Math.random() * 60 - 30)));
            this.teleportToMap(
              leaderMem.regionKey || String(leaderMem.mapKey).split('_')[0],
              leaderMem.mapKey,
              tx,
              ty
            );
          }
        } else {
          // 파티장이 물약 구매/정비를 위해 마을 안전지대에 진입한 경우:
          // 현재 지역 및 사냥터 위치를 그대로 유지하고 올 때까지 자유사냥으로 전환!
          this.wasLeaderInTown = true;
          this.isRegroupingToLeader = false;
          if (!this.lastLeaderFieldPos && !isInTownSafeZone(this.mapKey, this.x, this.y)) {
            this.lastLeaderFieldPos = {
              regionKey: this.regionKey,
              mapKey: this.mapKey,
              x: this.x,
              y: this.y
            };
          }
        }
      }
    } else {
      // 본인이 파티장이 되었거나 솔로인 경우
      this.followTargetName = null;
      this.isRegroupingToLeader = false;
      this.wasLeaderInTown = false;
    }
  }

  // =====================================================================
  // 메인 자율 루프 (전투, 1~6서클 스킬/마법, 버프/힐, 루팅, 용병 제어)
  // =====================================================================
  startLoop() {
    const now = Date.now();
    this.lastTickTime = now;
    // 100명의 에이전트가 동일 밀리초에 동시에 몬스터 탐색을 수행하지 않도록 슬롯 기반 위상 분산
    this.lastAiDecisionTime = now - ((this.slotIndex * 37) % 360);
    this.lastSyncSentTime = now - ((this.slotIndex * 19) % 220);
    this._lastSentMoveX = Math.round(this.x);
    this._lastSentMoveY = Math.round(this.y);
    this._lastSentWalk = false;
    this.loopTimer = true;
    ensureMasterAiLoopRunning();
  }

  stepTick(now, cpuLoadPct = 15) {
    if (this.isLoggingOut || !this.loopTimer) return;
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    const dtMs = Math.min(240, Math.max(20, now - (this.lastTickTime || (now - 100))));
    this.lastTickTime = now;

    // 1) 세션 만료 체크 (Graceful Logout -> 600명 풀에서 다음 순번 에이전트 자동 교체 투입)
    if (now - this.sessionStart >= this.sessionDuration) {
      this.gracefulLogout();
      return;
    }

    // 2) 자연 회복 (2초마다)
    if (now - this.lastRegenTime >= 2000) {
      this.lastRegenTime = now;
      const mpPassiveBonus = this.learnedSkills.includes('MP2') ? 6 : 0;
      const focusBonus = this.hasBuff('MENTAL_FOCUS') ? 5 : 0;
      this.hp = Math.min(this.maxHp, this.hp + 8 + Math.floor(this.level * 0.5));
      this.mp = Math.min(this.maxMp, this.mp + 7 + Math.floor(this.level * 0.5) + mpPassiveBonus + focusBonus);
      this.checkDrinkPotion();
    }

    // 3) 주기적 장비 평가, 안전 인챈트(+6/+4), 가방 정리, 물약 도핑 (10초마다)
    if (now - this.lastItemManageTime >= 10000) {
      this.lastItemManageTime = now;
      this.manageEquipmentAndEnchant();
      this.sellJunkItemsInBag();
      this.checkMercenaryNeeds();
      this.checkBuffPotions(now);
      if (this.invitedHistory.size > 30) this.invitedHistory.clear();
      if (this.rejectedTargets.size > 30) this.rejectedTargets.clear();
    }

    // 4) 실시간 상태 업데이트 (Redis 전용 Lazy Sync - Supabase 직접 호출 0회!)
    //    이동(x, y), 체력(hp, mp), 경험치/인벤토리 변경 시 Redis에만 가볍게 기록하고,
    //    실제 Supabase 저장은 백그라운드 배치 워커가 주기적(3~5분) Bulk Upsert 1회로 처리합니다.
    const posMoved = Math.abs(Math.round(this.x) - (this._lastRedisX ?? Math.round(this.x))) >= 25 ||
                     Math.abs(Math.round(this.y) - (this._lastRedisY ?? Math.round(this.y))) >= 25;
    const vitalsChanged = Math.abs(Math.round(this.hp) - (this._lastRedisHp ?? Math.round(this.hp))) >= 25 ||
                          Math.abs(Math.round(this.mp) - (this._lastRedisMp ?? Math.round(this.mp))) >= 25;
    if ((this._isDirty || posMoved || vitalsChanged) && (now - this.lastSupabaseSyncTime >= 3500)) {
      this.lastSupabaseSyncTime = now + ((this.slotIndex * 67) % 1500);
      this._isDirty = false;
      this._lastRedisX = Math.round(this.x);
      this._lastRedisY = Math.round(this.y);
      this._lastRedisHp = Math.round(this.hp);
      this._lastRedisMp = Math.round(this.mp);
      this.saveToSupabase(false);
    }

    // 5) CPU 점유율(65% 캡) 연동 적응형 의사결정 주기 (평시 350ms, 부하 52%+ 시 460ms, 60%+ 시 580ms)
    const decisionInterval = cpuLoadPct >= (CPU_LIMIT_PCT - 5) ? 580 : (cpuLoadPct >= (CPU_LIMIT_PCT - 13) ? 460 : 350);
    if (now - (this.lastAiDecisionTime || 0) >= decisionInterval) {
      this.lastAiDecisionTime = now;
      this.processBuffsAndPartySupport(now);
      this.checkProactivePartyInvite(now);
      this.checkSmartMapNavigation(now);
      this.checkAndResolveStuck(now);
      if (this.state !== 'SHOPPING') {
        this.executeCombatAndLootRoutine(now);
      }
    }

    // 6) 매 100ms마다 에이전트 및 동반 용병 연속 이동 업데이트
    if (this.state !== 'SHOPPING') {
      this.updateMovement(dtMs);
    }
    this.updateMercenaryRoutine(dtMs, now);

    // 7) PLAYER_SYNC 스로틀링: 목표 지점(moveX, moveY) 변경 시 또는 200ms(부하 시 280ms) 주기로만 전송, 정지/비전투 시 950ms 주기 전송
    const curMoveX = (this.isWalking && typeof this.moveX === 'number') ? Math.round(this.moveX) : Math.round(this.x);
    const curMoveY = (this.isWalking && typeof this.moveY === 'number') ? Math.round(this.moveY) : Math.round(this.y);
    const moveTargetChanged = (
      Boolean(this.isWalking) !== Boolean(this._lastSentWalk) ||
      (this.isWalking && (Math.abs(curMoveX - (this._lastSentMoveX || 0)) >= 8 || Math.abs(curMoveY - (this._lastSentMoveY || 0)) >= 8))
    );
    const isActiveNow = Boolean(
      this.isWalking ||
      Boolean(this.targetMob && !this.targetMob.isDead) ||
      (this.mercenary && this.mercenary.isWalking) ||
      (now - (this.lastAttackTime || 0) < 1000) ||
      (this.mercenary && (now - (this.mercenary.lastAttackTime || 0) < 1000))
    );
    const activeSyncGap = cpuLoadPct >= (CPU_LIMIT_PCT - 8) ? 280 : 200;
    const idleSyncGap = cpuLoadPct >= (CPU_LIMIT_PCT - 8) ? 1200 : 900;
    const elapsedSinceSync = now - (this.lastSyncSentTime || 0);
    const shouldSendSync =
      moveTargetChanged ||
      (isActiveNow && elapsedSinceSync >= activeSyncGap) ||
      (!isActiveNow && elapsedSinceSync >= idleSyncGap);

    if (shouldSendSync) {
      this.lastSyncSentTime = now;
      this._lastSentMoveX = curMoveX;
      this._lastSentMoveY = curMoveY;
      this._lastSentWalk = Boolean(this.isWalking);
      const needFullMeta = (now - (this._lastFullSyncTs || 0)) >= 12000;
      if (needFullMeta) this._lastFullSyncTs = now;
      this.sendWs({
        type: 'PLAYER_SYNC',
        charId: this.charId,
        mapKey: this.mapKey,
        regionKey: this.regionKey,
        player: this.buildPlayerSyncPayload(needFullMeta)
      });
    }
  }

  checkBuffPotions(now) {
    if (this.state === 'SHOPPING' || now - this.lastBuffPotTime < 180000) return;
    // 헤이스트 전 기본 이동속도를 자연스럽게 유지하기 위해 자동 가속 물약 상시 복용은 제외하고 공격력 물약만 도핑
    const atkIdx = this.inventory.findIndex(it => it && it.type === 'C_ATK01' && (it.count || 1) > 0);
    if (atkIdx > -1) {
      this.inventory[atkIdx].count = (this.inventory[atkIdx].count || 1) - 1;
      if (this.inventory[atkIdx].count <= 0) this.inventory.splice(atkIdx, 1);
      this.activeBuffs.ATK_POT = now + 300000;
      this.lastBuffPotTime = now;
      this.recalculateCombatPower();
    }
  }

  checkAndResolveStuck(now) {
    const bounds = getMapBounds(this.mapKey);
    const goalDist = (typeof this.moveX === 'number' && typeof this.moveY === 'number')
      ? fastHypot(this.moveX - this.x, this.moveY - this.y)
      : 0;
    if (this.isWalking && goalDist > 30) {
      if (now - this.stuckCheckTime >= 2500) {
        const moved = fastHypot(this.x - this.lastStuckX, this.y - this.lastStuckY);
        if (moved < 12) {
          const isFollower = Boolean(this.partyData && this.partyData.leaderCharId && this.partyData.leaderCharId !== this.charId);
          const angle = Math.random() * Math.PI * 2;
          const jumpDist = isFollower ? 95 : 220;
          let nx = Math.max(bounds.minX, Math.min(bounds.maxX, this.x + Math.cos(angle) * jumpDist));
          let ny = Math.max(bounds.minY, Math.min(bounds.maxY, this.y + Math.sin(angle) * jumpDist));
          if (isInTownSafeZone(this.mapKey, nx, ny)) {
            if (isFollower && this.lastLeaderFieldPos && this.lastLeaderFieldPos.mapKey === this.mapKey) {
              nx = this.lastLeaderFieldPos.x + (Math.random() * 120 - 60);
              ny = this.lastLeaderFieldPos.y + (Math.random() * 120 - 60);
            } else {
              const regCfg = getRegionCfg(this.regionKey);
              nx = (regCfg.fieldX || bounds.centerX) + (Math.random() * 160 - 80);
              ny = (regCfg.fieldY || bounds.centerY) + (Math.random() * 160 - 80);
            }
          }
          this.x = Math.max(bounds.minX, Math.min(bounds.maxX, nx));
          this.y = Math.max(bounds.minY, Math.min(bounds.maxY, ny));
          this.targetMob = null;
          this.targetMobId = null;
          this.isWalking = false;
        }
        this.lastStuckX = this.x;
        this.lastStuckY = this.y;
        this.stuckCheckTime = now;
      }
    } else {
      if (this.isWalking && goalDist <= 30) {
        this.isWalking = false;
      }
      this.lastStuckX = this.x;
      this.lastStuckY = this.y;
      this.stuckCheckTime = now;
    }
  }

  executeCombatAndLootRoutine(now) {
    const bounds = getMapBounds(this.mapKey);
    const isPartyLeader = Boolean(this.partyData && this.partyData.leaderCharId === this.charId);
    const isPartyFollower = Boolean(this.partyData && this.partyData.leaderCharId && this.partyData.leaderCharId !== this.charId);
    const isPartyFocusMode = Boolean(this.partyData && this.partyData.partyMode === 'FOCUS');
    const prevTargetId = this.targetMobId;

    // 1. 파티 팔로워의 경우 현재 파티장의 위치 및 마을 귀환(물약 구매/정비) 상태를 먼저 파악
    let leaderLive = null;
    let leaderOnSameMap = false;
    let leaderInTown = false;
    let leaderInCombatZone = false;

    if (isPartyFollower) {
      const leaderMem = (this.partyData.members || []).find(m => m.charId === this.partyData.leaderCharId);
      const leaderWorld = this.worldPlayers.get(this.partyData.leaderCharId);
      const leaderMapKey = leaderMem?.mapKey || this.mapKey;

      if (leaderWorld && typeof leaderWorld.x === 'number' && (!leaderMem?.mapKey || leaderMem.mapKey === this.mapKey)) {
        leaderLive = leaderWorld;
        leaderOnSameMap = true;
      } else if (leaderMem && (!leaderMem.mapKey || leaderMem.mapKey === this.mapKey)) {
        leaderLive = leaderMem;
        leaderOnSameMap = true;
      }

      const checkX = Number(leaderLive?.x ?? leaderMem?.x ?? 2000);
      const checkY = Number(leaderLive?.y ?? leaderMem?.y ?? 14250);
      leaderInTown = Boolean(
        this.partyData.leaderInSafeZone ||
        isInTownSafeZone(leaderMapKey, checkX, checkY)
      );

      // 파티장이 다른 맵의 사냥터(마을 안전지대가 아닌 곳)에 있다면 즉시 해당 사냥터로 합류!
      // 반대로 파티장이 물약을 사러 마을에 간 경우(leaderInTown === true)에는 현재 사냥터/던전을 그대로 유지!
      if (!leaderOnSameMap && leaderMem && leaderMem.mapKey && leaderMem.mapKey !== this.mapKey) {
        if (!leaderInTown) {
          const targetBounds = getMapBounds(leaderMem.mapKey);
          const tx = Math.max(targetBounds.minX, Math.min(targetBounds.maxX, (leaderMem.x || targetBounds.centerX) + (Math.random() * 80 - 40)));
          const ty = Math.max(targetBounds.minY, Math.min(targetBounds.maxY, (leaderMem.y || targetBounds.centerY) + (Math.random() * 80 - 40)));
          this.teleportToMap(leaderMem.regionKey || String(leaderMem.mapKey).split('_')[0], leaderMem.mapKey, tx, ty);
          return;
        }
      }

      leaderInCombatZone = Boolean(leaderOnSameMap && leaderLive && typeof leaderLive.x === 'number' && !leaderInTown);

      if (leaderInCombatZone) {
        this.lastLeaderFieldPos = {
          regionKey: this.regionKey,
          mapKey: this.mapKey,
          x: leaderLive.x,
          y: leaderLive.y
        };
        // 파티장이 마을에서 돌아왔거나 미니맵 워프로 같은 맵의 먼 사냥터(1150px 초과)로 이동한 경우 즉시 곁으로 합류
        const distFromLdrNow = fastHypot(leaderLive.x - this.x, leaderLive.y - this.y);
        if (distFromLdrNow > 1150) {
          const formAngle = ((this.slotIndex % 8) / 8) * Math.PI * 2;
          const formDist = 68 + (this.slotIndex % 3) * 24;
          const wx = Math.max(bounds.minX, Math.min(bounds.maxX, leaderLive.x + Math.cos(formAngle) * formDist));
          const wy = Math.max(bounds.minY, Math.min(bounds.maxY, leaderLive.y + Math.sin(formAngle) * formDist));
          if (!isInTownSafeZone(this.mapKey, wx, wy)) {
            this.x = Math.round(wx);
            this.y = Math.round(wy);
            this.moveX = this.x;
            this.moveY = this.y;
            this.isWalking = false;
            this.targetMob = null;
            this.targetMobId = null;
            if (this.mercenary && this.mercenary.hired) {
              this.mercenary.x = this.x + 38;
              this.mercenary.y = this.y + 26;
              this.mercenary.isWalking = false;
            }
            this.sendWs({
              type: 'PLAYER_ACTION_FX',
              charId: this.charId,
              mapKey: this.mapKey,
              fxKind: 'teleport',
              x: this.x,
              y: this.y,
              skillName: '파티 집결'
            });
          }
        }
        // 파티장이 마을 정비 후 사냥터로 복귀한 순간: 점사모드(FOCUS)였다면 임시 자유사냥 타겟을 정리하고 즉시 점사모드로 복귀!
        if (this.wasLeaderInTown) {
          this.wasLeaderInTown = false;
          if (isPartyFocusMode) {
            const fId = this.partyData.leaderTargetMobId || leaderLive?.targetMobId || null;
            if (!fId || String(this.targetMobId) !== String(fId)) {
              this.targetMob = null;
              this.targetMobId = null;
            }
          }
        }
      } else {
        // 파티장이 마을에 가 있거나 사냥터에 없는 동안: 현재 사냥 위치 앵커를 고정하고 올 때까지 자유사냥 수행
        this.wasLeaderInTown = true;
        this.isRegroupingToLeader = false;
        if (!this.lastLeaderFieldPos || this.lastLeaderFieldPos.mapKey !== this.mapKey) {
          if (!isInTownSafeZone(this.mapKey, this.x, this.y)) {
            this.lastLeaderFieldPos = { regionKey: this.regionKey, mapKey: this.mapKey, x: this.x, y: this.y };
          } else {
            const regCfg = getRegionCfg(this.regionKey);
            this.lastLeaderFieldPos = {
              regionKey: this.regionKey,
              mapKey: this.mapKey,
              x: bounds.isDungeon ? bounds.centerX : (regCfg.fieldX || bounds.centerX),
              y: bounds.isDungeon ? bounds.centerY : (regCfg.fieldY || bounds.centerY)
            };
          }
        }
      }
    }

    // 🌟 핵심 규칙: 점사모드(FOCUS)일 때 파티장이 사냥터에 있으면 점사모드 유지, 파티장이 물약 사러 마을에 가면 돌아올 때까지 자동으로 자유사냥(effectiveFocusMode = false)!
    const isEffectiveFocusMode = Boolean(isPartyFollower && isPartyFocusMode && leaderInCombatZone);

    // 0. 현재 타겟 몬스터 생존/유효성 선검증
    if (this.targetMobId) {
      const liveMob = this.worldMonsters.get(String(this.targetMobId));
      if (!liveMob || liveMob.isDead || liveMob.hp <= 0 || isInTownSafeZone(this.mapKey, liveMob.x, liveMob.y)) {
        this.targetMob = null;
        this.targetMobId = null;
      } else if (isPartyFollower && leaderInCombatZone) {
        const dMobToLeader = fastHypot(liveMob.x - leaderLive.x, liveMob.y - leaderLive.y);
        if (dMobToLeader > 560) {
          this.targetMob = null;
          this.targetMobId = null;
        } else {
          this.targetMob = liveMob;
        }
      } else if (isPartyFollower && !leaderInCombatZone && this.lastLeaderFieldPos) {
        // 파티장이 마을에 간 동안에도 현재 사냥터 구역(앵커 반경 720px) 밖으로 너무 멀리 벗어나지 않도록 관리
        const dMobToAnchor = fastHypot(liveMob.x - this.lastLeaderFieldPos.x, liveMob.y - this.lastLeaderFieldPos.y);
        if (dMobToAnchor > 720) {
          this.targetMob = null;
          this.targetMobId = null;
        } else {
          this.targetMob = liveMob;
        }
      } else {
        this.targetMob = liveMob;
      }
    }

    // B. 파티 팔로워(Follower) 모드 및 리더 타겟 최우선 동기화 (파티장이 사냥터에 있을 때 작동)
    if (isPartyFollower && leaderInCombatZone) {
      const focusId = this.partyData.leaderTargetMobId || leaderLive?.targetMobId || null;
      let focusMob = focusId ? this.worldMonsters.get(String(focusId)) : null;
      if (focusMob && (focusMob.isDead || focusMob.hp <= 0 || isInTownSafeZone(this.mapKey, focusMob.x, focusMob.y))) {
        focusMob = null;
      }
      if (!focusMob) {
        let bestLdrDist = isEffectiveFocusMode ? 280 : 360;
        for (const m of this.worldMonsters.values()) {
          if (!m || m.isDead || m.hp <= 0 || isInTownSafeZone(this.mapKey, m.x, m.y)) continue;
          const dLdr = fastHypot(m.x - leaderLive.x, m.y - leaderLive.y);
          if (dLdr < bestLdrDist) {
            bestLdrDist = dLdr;
            focusMob = m;
          }
        }
      }
      if (focusMob) {
        this.targetMob = focusMob;
        this.targetMobId = String(focusMob.id);
      } else if (isEffectiveFocusMode) {
        // 점사 모드에서 사냥터의 파티장이 아직 타겟팅한 몬스터가 없으면 임의로 이탈하지 않고 파티장 대형 유지
        this.targetMob = null;
        this.targetMobId = null;
      }
    }

    // A. 주변 바닥 아이템 실시간 루팅 (파티장 또는 교전 중일 때는 발밑 85px 이내만 즉시 줍고 전투 흐름 유지!)
    const hasActivePartyTarget = Boolean(isPartyFollower && this.targetMob && !this.targetMob.isDead && this.targetMob.hp > 0);
    let nearestItem = null;
    let minItemDist = (isPartyLeader || hasActivePartyTarget) ? 85 : 180;
    for (const item of this.worldItems.values()) {
      if (!item || isInTownSafeZone(this.mapKey, item.x, item.y)) continue;
      if (isPartyFollower && leaderInCombatZone && fastHypot(item.x - leaderLive.x, item.y - leaderLive.y) > 360) continue;
      if (isPartyFollower && !leaderInCombatZone && this.lastLeaderFieldPos && fastHypot(item.x - this.lastLeaderFieldPos.x, item.y - this.lastLeaderFieldPos.y) > 480) continue;
      const d = fastHypot(item.x - this.x, item.y - this.y);
      if (d < minItemDist) {
        minItemDist = d;
        nearestItem = item;
      }
    }
    if (nearestItem) {
      if (minItemDist <= 62) {
        this.sendWs({
          type: 'PICKUP_GROUND_ITEM',
          charId: this.charId,
          mapKey: this.mapKey,
          itemUid: nearestItem.uid
        });
        this.worldItems.delete(String(nearestItem.uid));
      } else if (!isPartyLeader && !hasActivePartyTarget) {
        this.moveX = nearestItem.x;
        this.moveY = nearestItem.y;
        this.isWalking = true;
        return;
      }
    }

    // 파티 팔로워 추종 거리(Leash) 및 히스테리시스 관리 (경계 진동 원천 차단)
    if (isPartyFollower && leaderInCombatZone) {
      const distToLeader = fastHypot(leaderLive.x - this.x, leaderLive.y - this.y);
      const maxFollowLeash = hasActivePartyTarget ? 560 : (isEffectiveFocusMode ? 185 : 265);
      const regroupFinishDist = isEffectiveFocusMode ? 115 : 145;
      if (distToLeader > maxFollowLeash || (this.isRegroupingToLeader && distToLeader > regroupFinishDist)) {
        this.isRegroupingToLeader = true;
        this.targetMob = null;
        this.targetMobId = null;
        const formAngle = ((this.slotIndex % 8) / 8) * Math.PI * 2;
        const formDist = Math.min(this.followDist || 90, 105);
        let tx = Math.max(bounds.minX, Math.min(bounds.maxX, leaderLive.x + Math.cos(formAngle) * formDist));
        let ty = Math.max(bounds.minY, Math.min(bounds.maxY, leaderLive.y + Math.sin(formAngle) * formDist));
        if (isInTownSafeZone(this.mapKey, tx, ty)) {
          const rCfg = getRegionCfg(this.regionKey);
          const outAng = Math.atan2(leaderLive.y - (rCfg.townY || 14250), leaderLive.x - (rCfg.townX || 2000)) + (((this.slotIndex % 5) - 2) * 0.28);
          tx = Math.max(bounds.minX, Math.min(bounds.maxX, leaderLive.x + Math.cos(outAng) * 65));
          ty = Math.max(bounds.minY, Math.min(bounds.maxY, leaderLive.y + Math.sin(outAng) * 65));
        }
        this.moveX = tx;
        this.moveY = ty;
        this.isWalking = true;
        return;
      } else {
        this.isRegroupingToLeader = false;
      }
    } else if (!isPartyFollower && this.followTargetName) {
      let targetUser = null;
      for (const p of this.worldPlayers.values()) {
        if (p.name === this.followTargetName) {
          targetUser = p;
          break;
        }
      }
      if (targetUser && !isInTownSafeZone(this.mapKey, targetUser.x, targetUser.y)) {
        const distToUser = fastHypot(targetUser.x - this.x, targetUser.y - this.y);
        if (distToUser > this.followDist + 40) {
          this.targetMob = null;
          this.targetMobId = null;
          const ang = Math.atan2(targetUser.y - this.y, targetUser.x - this.x);
          this.moveX = Math.max(bounds.minX, Math.min(bounds.maxX, targetUser.x - Math.cos(ang) * this.followDist));
          this.moveY = Math.max(bounds.minY, Math.min(bounds.maxY, targetUser.y - Math.sin(ang) * this.followDist));
          this.isWalking = true;
          return;
        }
      }
    }

    // C. 신규 몬스터 타겟팅
    // - 사냥터에 있는 점사모드(isEffectiveFocusMode === true)가 아닐 때(즉 자유사냥이거나, 점사모드 중 파티장이 마을에 물약 사러 간 동안) 주변 몬스터를 자유 사냥!
    if (!this.targetMob && !isEffectiveFocusMode) {
      const holdAnchor = (!leaderInCombatZone && isPartyFollower && this.lastLeaderFieldPos && this.lastLeaderFieldPos.mapKey === this.mapKey)
        ? this.lastLeaderFieldPos
        : null;

      const collectCandidates = (maxSearchDist) => {
        const list = [];
        for (const m of this.worldMonsters.values()) {
          if (!m || m.isDead || m.hp <= 0) continue;
          if (isInTownSafeZone(this.mapKey, m.x, m.y)) continue;
          if (isPartyFollower && leaderInCombatZone) {
            const dLeader = fastHypot(m.x - leaderLive.x, m.y - leaderLive.y);
            if (dLeader > 480) continue;
          } else if (holdAnchor) {
            // 파티장이 마을에 간 동안에는 현재 사냥터 구역(holdAnchor 반경 650px) 내의 몬스터를 사냥하며 구역 유지!
            const dAnchor = fastHypot(m.x - holdAnchor.x, m.y - holdAnchor.y);
            if (dAnchor > 650) continue;
          }
          const d = fastHypot(m.x - this.x, m.y - this.y);
          if (d <= maxSearchDist) list.push({ mob: m, dist: d });
        }
        return list;
      };

      let candidates = collectCandidates(1450);
      if (candidates.length === 0 && !isPartyFollower) {
        candidates = collectCandidates(16000);
      }

      if (candidates.length > 0) {
        candidates.sort((a, b) => {
          const aNearBoss = Boolean(a.mob.isBoss && a.dist <= 320);
          const bNearBoss = Boolean(b.mob.isBoss && b.dist <= 320);
          if (aNearBoss !== bNearBoss) return aNearBoss ? -1 : 1;
          return a.dist - b.dist;
        });
        this.targetMob = candidates[0].mob;
        this.targetMobId = String(this.targetMob.id);
      }
    }

    // 파티장인 AI의 타겟이 변경된 즉시 서버에 동기화 패킷 전송 (파티원 점사 지연 0ms 보장!)
    if (isPartyLeader && this.targetMobId !== prevTargetId) {
      this.sendWs({
        type: 'PLAYER_SYNC',
        charId: this.charId,
        mapKey: this.mapKey,
        regionKey: this.regionKey,
        player: this.buildPlayerSyncPayload()
      });
    }

    // D. 타겟 교전 기동 (근거리 차지 W07 / 원거리 카이팅 / 1~6서클 스마트 스킬 시전)
    if (this.targetMob) {
      const mob = this.targetMob;
      const dist = fastHypot(mob.x - this.x, mob.y - this.y);
      const isRanged = this.charClass === 'ranger' || this.charClass === 'wizard';
      const maxAtkRange = isRanged ? 285 : 68;

      // 1) 전사(knight): 80~260px 거리에서 '차지(W07)' 스킬로 돌진
      if (this.charClass === 'knight' && dist >= 80 && dist <= 260 && this.learnedSkills.includes('W07')) {
        const chargeSkill = SKILL_DB.W07;
        if (this.mp >= chargeSkill.mp && now - (this.skillCooldowns.W07 || 0) >= chargeSkill.cd) {
          this.skillCooldowns.W07 = now;
          this.mp -= chargeSkill.mp;
          const prevX = this.x;
          const prevY = this.y;
          const ang = Math.atan2(mob.y - this.y, mob.x - this.x);
          this.x = Math.max(bounds.minX, Math.min(bounds.maxX, mob.x - Math.cos(ang) * 38));
          this.y = Math.max(bounds.minY, Math.min(bounds.maxY, mob.y - Math.sin(ang) * 38));
          this.angle = ang;
          this.dir = angleToDirString(ang);
          this.isWalking = false;
          this.performAttackOnMob(mob, chargeSkill, now, false, prevX, prevY);
          return;
        }
      }

      // 2) 원거리 직업(ranger/wizard): 적이 115px 이내로 붙으면 플레이어처럼 일정한 궤적으로 부드럽게 카이팅 (파티 추종 반경 내에서만!)
      if (isRanged && (dist < 115 || (this.kiteUntil && now < this.kiteUntil && dist < 165))) {
        if (!this.kiteUntil || now >= this.kiteUntil || this.moveX === null || this.moveY === null) {
          this.kiteUntil = now + 700;
          this.orbitDir = this.orbitDir || (Math.random() < 0.5 ? 1 : -1);
          const awayAngle = Math.atan2(this.y - mob.y, this.x - mob.x) + this.orbitDir * 0.45;
          let kx = Math.max(bounds.minX, Math.min(bounds.maxX, this.x + Math.cos(awayAngle) * 145));
          let ky = Math.max(bounds.minY, Math.min(bounds.maxY, this.y + Math.sin(awayAngle) * 145));
          if (isPartyFollower && leaderInCombatZone && fastHypot(kx - leaderLive.x, ky - leaderLive.y) > 520) {
            const toLdr = Math.atan2(leaderLive.y - this.y, leaderLive.x - this.x);
            kx = Math.max(bounds.minX, Math.min(bounds.maxX, this.x + Math.cos(toLdr) * 120));
            ky = Math.max(bounds.minY, Math.min(bounds.maxY, this.y + Math.sin(toLdr) * 120));
          } else if (isPartyFollower && !leaderInCombatZone && this.lastLeaderFieldPos && fastHypot(kx - this.lastLeaderFieldPos.x, ky - this.lastLeaderFieldPos.y) > 580) {
            const toAnc = Math.atan2(this.lastLeaderFieldPos.y - this.y, this.lastLeaderFieldPos.x - this.x);
            kx = Math.max(bounds.minX, Math.min(bounds.maxX, this.x + Math.cos(toAnc) * 120));
            ky = Math.max(bounds.minY, Math.min(bounds.maxY, this.y + Math.sin(toAnc) * 120));
          }
          if (isInTownSafeZone(this.mapKey, kx, ky)) {
            kx = this.x;
            ky = this.y;
          }
          this.moveX = kx;
          this.moveY = ky;
        }
        this.isWalking = true;
        return;
      }

      // 3) 사거리 밖이면 적의 사거리 안쪽(원거리 230px, 근거리 50px)까지 확실히 접근하여 사거리 경계 멈춤 방지
      if (dist > maxAtkRange) {
        const approachAng = Math.atan2(mob.y - this.y, mob.x - this.x);
        const stopDist = isRanged ? Math.max(140, maxAtkRange - 55) : Math.max(42, maxAtkRange - 18);
        this.moveX = Math.max(bounds.minX, Math.min(bounds.maxX, mob.x - Math.cos(approachAng) * stopDist));
        this.moveY = Math.max(bounds.minY, Math.min(bounds.maxY, mob.y - Math.sin(approachAng) * stopDist));
        this.isWalking = true;
        return;
      }

      // 4) 사거리 안이면 정지 후 인간 플레이어와 동일한 스킬/평타 공격
      this.isWalking = false;
      this.moveX = Math.round(this.x);
      this.moveY = Math.round(this.y);
      this.angle = Math.atan2(mob.y - this.y, mob.x - this.x);
      this.dir = angleToDirString(this.angle);

      const hasteMult = (this.hasBuff('HASTE') || this.hasBuff('WIND_WALK') || this.hasBuff('ELVEN_GRACE')) ? 0.82 : 1.0;
      const baseAtkInterval = this.charClass === 'ranger' ? 660 : (this.charClass === 'knight' ? 720 : 820);
      const atkInterval = Math.round(baseAtkInterval * hasteMult);

      if (now - this.lastAttackTime >= atkInterval) {
        this.lastAttackTime = now;
        const chosenSkill = this.pickSmartCombatSkill(mob, now, this.learnedSkills, this.mp, this.skillCooldowns);
        this.performAttackOnMob(mob, chosenSkill, now, false);
      }
    } else {
      // 비전투 시(타겟이 없을 때) 이동:
      if (isPartyFollower) {
        if (leaderInCombatZone) {
          // 1) 파티장이 사냥터에 있을 때: 이미 보행 중이더라도 리더가 이동했으면 목표 지점을 실시간 갱신하여 지그재그/뒤처짐 없이 대형(68~116px) 유지!
          const formAngle = ((this.slotIndex % 8) / 8) * Math.PI * 2;
          const formDist = 68 + (this.slotIndex % 3) * 24;
          let tx = Math.max(bounds.minX, Math.min(bounds.maxX, leaderLive.x + Math.cos(formAngle) * formDist));
          let ty = Math.max(bounds.minY, Math.min(bounds.maxY, leaderLive.y + Math.sin(formAngle) * formDist));
          if (isInTownSafeZone(this.mapKey, tx, ty)) {
            tx = leaderLive.x;
            ty = leaderLive.y;
          }
          const distToForm = fastHypot(tx - this.x, ty - this.y);
          if (distToForm > 42 && !isInTownSafeZone(this.mapKey, tx, ty)) {
            if (!this.isWalking || this.moveX === null || fastHypot(tx - this.moveX, ty - this.moveY) > 45) {
              this.moveX = tx;
              this.moveY = ty;
              this.isWalking = true;
            }
          } else {
            this.isWalking = false;
          }
        } else if (!this.isWalking) {
          // 2) 파티장이 물약 사러 마을에 간 동안: 맵 중앙(regCfg.fieldY)으로 멀리 끌려가지 않고, 현재 사냥 구역(lastLeaderFieldPos) 반경 220px 내에서만 순찰 대기!
          const holdAnchor = (this.lastLeaderFieldPos && this.lastLeaderFieldPos.mapKey === this.mapKey)
            ? this.lastLeaderFieldPos
            : { x: this.x, y: this.y };
          const distToHold = fastHypot(holdAnchor.x - this.x, holdAnchor.y - this.y);
          const ang = distToHold > 260
            ? (Math.atan2(holdAnchor.y - this.y, holdAnchor.x - this.x) + (Math.random() * 0.6 - 0.3))
            : (Math.random() * Math.PI * 2);
          const stepD = 120 + Math.random() * 120;
          const nx = Math.max(bounds.minX, Math.min(bounds.maxX, (distToHold > 260 ? this.x : holdAnchor.x) + Math.cos(ang) * stepD));
          const ny = Math.max(bounds.minY, Math.min(bounds.maxY, (distToHold > 260 ? this.y : holdAnchor.y) + Math.sin(ang) * stepD));
          if (!isInTownSafeZone(this.mapKey, nx, ny)) {
            this.moveX = nx;
            this.moveY = ny;
            this.isWalking = true;
          } else {
            const regCfg = getRegionCfg(this.regionKey);
            const fallbackX = (holdAnchor && !isInTownSafeZone(this.mapKey, holdAnchor.x, holdAnchor.y))
              ? holdAnchor.x
              : (bounds.isDungeon ? bounds.centerX : (regCfg.fieldX || bounds.centerX));
            const fallbackY = (holdAnchor && !isInTownSafeZone(this.mapKey, holdAnchor.x, holdAnchor.y))
              ? holdAnchor.y
              : (bounds.isDungeon ? bounds.centerY : (regCfg.fieldY || bounds.centerY));
            this.moveX = Math.max(bounds.minX, Math.min(bounds.maxX, fallbackX + (Math.random() * 240 - 120)));
            this.moveY = Math.max(bounds.minY, Math.min(bounds.maxY, fallbackY + (Math.random() * 240 - 120)));
            this.isWalking = true;
          }
        }
      } else if (!this.isWalking) {
        // 파티장 또는 솔로 AI: 현재 맵 경계(필드 vs 던전) 및 사냥터 중심점을 향해 자연스럽게 순찰 이동
        const regCfg = getRegionCfg(this.regionKey);
        const anchorX = bounds.isDungeon ? bounds.centerX : (regCfg.fieldX || bounds.centerX);
        const anchorY = bounds.isDungeon ? bounds.centerY : (regCfg.fieldY || bounds.centerY);
        const distToAnchor = fastHypot(anchorX - this.x, anchorY - this.y);
        const angle = distToAnchor > 1800
          ? (Math.atan2(anchorY - this.y, anchorX - this.x) + (Math.random() * 0.8 - 0.4))
          : (Math.random() * Math.PI * 2);
        const dist = 320 + Math.random() * 280;
        const nextX = Math.max(bounds.minX, Math.min(bounds.maxX, this.x + Math.cos(angle) * dist));
        const nextY = Math.max(bounds.minY, Math.min(bounds.maxY, this.y + Math.sin(angle) * dist));
        if (!isInTownSafeZone(this.mapKey, nextX, nextY)) {
          this.moveX = nextX;
          this.moveY = nextY;
          this.isWalking = true;
        } else {
          this.moveX = Math.max(bounds.minX, Math.min(bounds.maxX, anchorX + (Math.random() * 300 - 150)));
          this.moveY = Math.max(bounds.minY, Math.min(bounds.maxY, anchorY + (Math.random() * 300 - 150)));
          this.isWalking = true;
        }
      }
    }
  }

  pickSmartCombatSkill(targetMob, now, learnedList, currentMp, cooldownMap) {
    if (!learnedList || learnedList.length === 0) return null;

    let nearbyCount = 0;
    for (const m of this.worldMonsters.values()) {
      if (m && !m.isDead && m.hp > 0 && fastHypot(m.x - targetMob.x, m.y - targetMob.y) <= 190) {
        nearbyCount++;
      }
    }

    const coolFactor = Math.max(0.5, 1 - (this.coolReducePct || 0) / 100);
    const usable = learnedList
      .map(id => SKILL_DB[id])
      .filter(sk => {
        if (!sk) return false;
        if (sk.type !== 'attack' && sk.type !== 'stun' && sk.type !== 'debuff') return false;
        if (currentMp < (sk.mp || 0)) return false;
        const effCd = (sk.cd || 2000) * coolFactor;
        return (now - (cooldownMap[sk.id] || 0)) >= effCd;
      });

    if (usable.length === 0) return null;

    // 1) 보스이거나 강적인데 아직 방어력 감소 디버프가 안 걸려 있다면 디버프(둠, 디스펠 매직, 워크라이, 인탱글 등) 우선 시전
    if ((targetMob.isBoss || nearbyCount >= 3) && (!targetMob.defDownUntil || targetMob.defDownUntil < now)) {
      const debuffs = usable.filter(sk => sk.defDown || sk.stunSec);
      if (debuffs.length > 0 && Math.random() < 0.45) {
        debuffs.sort((a, b) => (b.circle || 1) - (a.circle || 1));
        return debuffs[0];
      }
    }

    // 2) 주변에 몬스터가 2마리 이상 몰려 있으면 광역(AoE) 마법/스킬 최우선 선택 (미티어 스웜, 앱솔루트 제로, 블리자드, 애로우 레인, 휠윈드 등)
    if (nearbyCount >= 2) {
      const aoeSkills = usable.filter(sk => sk.aoe);
      if (aoeSkills.length > 0) {
        aoeSkills.sort((a, b) => ((b.mult || 1) * (b.hits || 1)) - ((a.mult || 1) * (a.hits || 1)));
        const topPool = aoeSkills.slice(0, Math.min(3, aoeSkills.length));
        return topPool[Math.floor(Math.random() * topPool.length)];
      }
    }

    // 3) 단일 대상 고배율 스킬/마법 (헬 파이어, 워드 오브 데스, 데스 레이, 스나이퍼 샷, 게일 샷, 이럽션, 피어스 애로우 등)
    usable.sort((a, b) => ((b.mult || 1) * (b.hits || 1)) - ((a.mult || 1) * (a.hits || 1)));
    const topChoices = usable.slice(0, Math.min(3, usable.length));
    return topChoices[Math.floor(Math.random() * topChoices.length)];
  }

  performAttackOnMob(mob, skill, now, isMercAtk = false, startXOverride = null, startYOverride = null) {
    const attackerX = isMercAtk && this.mercenary ? this.mercenary.x : this.x;
    const attackerY = isMercAtk && this.mercenary ? this.mercenary.y : this.y;
    const actorClass = isMercAtk && this.mercenary ? this.mercenary.class : this.charClass;
    const basePower = actorClass === 'wizard' ? this.mAtk : this.pAtk;

    let mult = isMercAtk ? 0.82 : 1.0;
    let mobIds = [String(mob.id)];
    const opts = {};

    if (skill) {
      if (isMercAtk && this.mercenary) {
        this.mercenary.mp = Math.max(0, (this.mercenary.mp || 100) - (skill.mp || 0));
        this.mercenary.skillCooldowns = this.mercenary.skillCooldowns || {};
        this.mercenary.skillCooldowns[skill.id] = now;
      } else {
        this.mp = Math.max(0, this.mp - (skill.mp || 0));
        this.skillCooldowns[skill.id] = now;
      }

      mult = (skill.mult || 1.5) * (isMercAtk ? 0.82 : 1.0);
      opts.isSkill = true;
      opts.skillName = skill.name;
      if (skill.hits) opts.hits = skill.hits;
      if (skill.stunSec) opts.stunSec = skill.stunSec;
      if (skill.defDown) opts.defDown = true;
      if (skill.drainPct) opts.drainPct = skill.drainPct;
      if (skill.mpDrain) opts.mpDrain = skill.mpDrain;

      const maxT = skill.maxTargets || 5;
      if (skill.aoe) {
        for (const other of this.worldMonsters.values()) {
          if (!other || other.isDead || other.hp <= 0 || String(other.id) === String(mob.id)) continue;
          if (fastHypot(other.x - mob.x, other.y - mob.y) <= 195) {
            mobIds.push(String(other.id));
            if (mobIds.length >= maxT) break;
          }
        }
      }

      const rawSkillDmg = Math.max(5, Math.round(basePower * mult));
      this.sendWs({
        type: 'PLAYER_SKILL',
        charId: this.charId,
        mapKey: this.mapKey,
        skillName: skill.name,
        circleLv: skill.circle || 1,
        casterClass: actorClass,
        casterX: Math.round(attackerX),
        casterY: Math.round(attackerY),
        startX: Math.round(startXOverride ?? attackerX),
        startY: Math.round(startYOverride ?? attackerY),
        tx: Math.round(mob.x),
        ty: Math.round(mob.y),
        mobId: String(mob.id),
        isAoe: Boolean(skill.aoe),
        skyDrop: Boolean(skill.skyDrop),
        dmgMult: mult,
        dmgAmount: rawSkillDmg,
        isMerc: isMercAtk
      });
    } else {
      const wType = actorClass === 'ranger' ? 'W_BW03' : (actorClass === 'wizard' ? 'W_ST03' : 'W_SW03');
      this.sendWs({
        type: 'PLAYER_ACTION_FX',
        charId: this.charId,
        mapKey: this.mapKey,
        fxKind: 'basic_atk',
        casterClass: actorClass,
        isRanged: actorClass === 'ranger' || actorClass === 'wizard',
        isMerc: isMercAtk,
        mobId: String(mob.id),
        sx: Math.round(attackerX),
        sy: Math.round(attackerY),
        tx: Math.round(mob.x),
        ty: Math.round(mob.y),
        dir: angleToDirString(Math.atan2(mob.y - attackerY, mob.x - attackerX)),
        weaponType: wType
      });
    }

    const rawDmg = Math.max(5, Math.round(basePower * mult * (0.92 + Math.random() * 0.16)));
    const dmgType = actorClass === 'wizard' ? 'magic' : (actorClass === 'ranger' ? 'ranged' : 'melee');

    this.sendWs({
      type: 'PLAYER_ATTACK_MONSTER',
      charId: this.charId,
      mapKey: this.mapKey,
      mobIds,
      rawDmg,
      dmgType,
      attackerLv: this.level,
      attackerX: Math.round(attackerX),
      attackerY: Math.round(attackerY),
      isMercAtk,
      cStats: {
        hitBonus: 18,
        armorPenPct: 12,
        bossDmgPct: 18,
        critRate: this.critRate || (actorClass === 'ranger' ? 28 : 18),
        critDmgMult: (actorClass === 'ranger' && this.learnedSkills.includes('AS5')) ? 1.85 : 1.65,
        drainBonus: this.hasBuff('SHADOW_FANG') ? 7 : 4
      },
      opts
    });
  }

  updateMovement(dtMs) {
    if (!this.isWalking || this.moveX === null || this.moveY === null) return;
    const dx = this.moveX - this.x;
    const dy = this.moveY - this.y;
    const dist = fastHypot(dx, dy);
    // 상용 MMORPG 기본 속도(헤이스트 전 60FPS 기준 1.85~2.02 px/frame = 초당 111~121.2 px)
    const speedPxPerSec = this.getBaseMoveSpeedFrame60() * 60;
    const speedPx = speedPxPerSec * (dtMs / 1000);

    const bounds = getMapBounds(this.mapKey);
    if (dist <= speedPx) {
      this.x = Math.max(bounds.minX, Math.min(bounds.maxX, this.moveX));
      this.y = Math.max(bounds.minY, Math.min(bounds.maxY, this.moveY));
      this.isWalking = false;
    } else {
      const ang = Math.atan2(dy, dx);
      this.angle = ang;
      this.dir = angleToDirString(ang);
      this.x = Math.max(bounds.minX, Math.min(bounds.maxX, this.x + Math.cos(ang) * speedPx));
      this.y = Math.max(bounds.minY, Math.min(bounds.maxY, this.y + Math.sin(ang) * speedPx));
    }
  }

  updateMercenaryRoutine(dtMs, now) {
    const m = this.mercenary;
    if (!m || !m.hired || m.isDead) return;

    // 용병 자연 회복 및 물약 음용
    m.mp = Math.min(m.maxMp || 200, (m.mp || 100) + 2);
    if (m.hp < m.maxHp * 0.58) {
      const potIdx = (m.inventory || []).findIndex(it => it && String(it.type).startsWith('C_HP') && it.count > 0);
      if (potIdx > -1) {
        const pot = m.inventory[potIdx];
        const healAmt = POTION_HEAL_MAP[pot.type]?.hp || 160;
        m.hp = Math.min(m.maxHp, m.hp + healAmt);
        pot.count--;
        if (pot.count <= 0) m.inventory.splice(potIdx, 1);
        m.requirePotion = false;
        this.sendWs({
          type: 'PLAYER_ACTION_FX',
          charId: this.charId,
          mapKey: this.mapKey,
          fxKind: 'potion',
          isMerc: true,
          subType: 'hp',
          amount: healAmt,
          x: Math.round(m.x),
          y: Math.round(m.y)
        });
      } else {
        m.requirePotion = true;
      }
    }

    const target = this.targetMob;
    const ownerSpdPxPerSec = this.getBaseMoveSpeedFrame60() * 60;
    const mSpeed = ownerSpdPxPerSec * 1.02 * (dtMs / 1000);

    if (target && !target.isDead && target.hp > 0 && this.state === 'HUNTING') {
      const dist = fastHypot(target.x - m.x, target.y - m.y);
      const isRanged = m.class === 'ranger' || m.class === 'wizard';
      const atkRange = isRanged ? 255 : 64;

      if (isRanged && (dist < 105 || (m.kiteUntil && now < m.kiteUntil && dist < 148))) {
        if (!m.kiteUntil || now >= m.kiteUntil) m.kiteUntil = now + 600;
        const awayAng = Math.atan2(m.y - target.y, m.x - target.x) + 0.35;
        m.x += Math.cos(awayAng) * mSpeed * 0.88;
        m.y += Math.sin(awayAng) * mSpeed * 0.88;
        m.dir = angleToDirString(awayAng);
        m.isWalking = true;
      } else if (dist > atkRange) {
        const ang = Math.atan2(target.y - m.y, target.x - m.x);
        const stepM = Math.min(mSpeed, dist - (atkRange - 8));
        m.x += Math.cos(ang) * stepM;
        m.y += Math.sin(ang) * stepM;
        m.dir = angleToDirString(ang);
        m.isWalking = true;
      } else {
        m.isWalking = false;
        m.dir = angleToDirString(Math.atan2(target.y - m.y, target.x - m.x));
        if (now - (m.lastAttackTime || 0) >= 860) {
          m.lastAttackTime = now;
          m.skillCooldowns = m.skillCooldowns || {};
          const mercSk = (Math.random() < 0.45)
            ? this.pickSmartCombatSkill(target, now, m.learnedSkills || [], m.mp || 100, m.skillCooldowns)
            : null;
          this.performAttackOnMob(target, mercSk, now, true);
        }
      }
    } else {
      const desiredX = this.x + (this.dir === 'left' ? 44 : -44);
      const desiredY = this.y + 28;
      const distToSpot = fastHypot(desiredX - m.x, desiredY - m.y);
      const followThreshold = m.isWalking ? 18 : 48;
      if (distToSpot > followThreshold) {
        const ang = Math.atan2(desiredY - m.y, desiredX - m.x);
        const stepM = Math.min(distToSpot, mSpeed);
        m.x += Math.cos(ang) * stepM;
        m.y += Math.sin(ang) * stepM;
        m.dir = angleToDirString(ang);
        m.isWalking = true;
      } else {
        m.isWalking = false;
      }
    }
  }

  // =====================================================================
  // 경제 활동, 스킬북 습득, 장비 평가/인챈트, 물약 및 마을 정비
  // =====================================================================
  onLootedItem(item) {
    if (!item) return;
    this._isDirty = true;
    if (item.type === 'gold') {
      this.gold += Number(item.amount || item.count || 100);
      return;
    }
    // 스킬북(BOOK_*) 루팅 시 인간 플레이어처럼 즉시 스킬 습득
    const tCode = String(item.type || item.id || '');
    if (tCode.startsWith('BOOK_')) {
      const unlocked = getLearnedSkillsForClass(this.charClass, this.level + 5);
      for (const skId of unlocked) {
        if (!this.learnedSkills.includes(skId)) {
          this.learnedSkills.push(skId);
          this.combatMemory = `사냥 중 마법서/교범(${item.name || tCode})을 획득하여 새로운 기술을 익혔습니다.`;
          break;
        }
      }
      return;
    }
    this.inventory.push(item);
    this.manageEquipmentAndEnchant();
  }

  calcEquipScore(item) {
    if (!item) return 0;
    const st = item.stats || {};
    const base = (st.pAtk || item.pAtk || 0) + (st.mAtk || item.mAtk || 0) + (st.pDef || item.pDef || 0) * 1.3 + (st.mDef || item.mDef || 0) * 1.2;
    const ench = (item.enchantLevel || item.plus || 0) * 5;
    const grade = (item.gradeIdx || 0) * 12;
    return base + ench + grade;
  }

  canClassEquipWeapon(charClass, itemType) {
    if (!itemType || !String(itemType).startsWith('W_')) return true;
    if (charClass === 'knight') return String(itemType).startsWith('W_SW');
    if (charClass === 'ranger') return String(itemType).startsWith('W_BW');
    if (charClass === 'wizard') return String(itemType).startsWith('W_ST');
    return true;
  }

  manageEquipmentAndEnchant() {
    if (!Array.isArray(this.inventory) || this.inventory.length === 0) return;

    // 1) 본인 장비 자동 비교 및 장착
    for (let i = this.inventory.length - 1; i >= 0; i--) {
      const it = this.inventory[i];
      if (!it || !it.slot) continue;
      if (it.slot === 'weapon' && !this.canClassEquipWeapon(this.charClass, it.type || it.id)) continue;

      const currentEq = this.equip[it.slot];
      if (this.calcEquipScore(it) > this.calcEquipScore(currentEq)) {
        this.inventory.splice(i, 1);
        if (currentEq) this.inventory.push(currentEq);
        this.equip[it.slot] = it;
        this.recalculateCombatPower();
        this.combatMemory = `사냥 중 더 좋은 장비(${it.name})를 획득하여 바로 장착했습니다.`;
      }
    }

    // 2) 동반 용병 장비 자동 비교 및 장착
    if (this.mercenary && this.mercenary.hired && this.mercenary.equip) {
      for (let i = this.inventory.length - 1; i >= 0; i--) {
        const it = this.inventory[i];
        if (!it || !it.slot) continue;
        if (it.slot === 'weapon' && !this.canClassEquipWeapon(this.mercenary.class, it.type || it.id)) continue;

        const mercCur = this.mercenary.equip[it.slot];
        if (this.calcEquipScore(it) > this.calcEquipScore(mercCur)) {
          this.inventory.splice(i, 1);
          if (mercCur) this.inventory.push(mercCur);
          this.mercenary.equip[it.slot] = it;
        }
      }
    }

    // 3) 인챈트 수행 및 멀티플레이 강화 이펙트 브로드캐스트
    const wScrollIdx = this.inventory.findIndex(it => it && (it.type === 'S_WPN01' || it.type === 'S_WE01') && (it.count || 1) > 0);
    if (wScrollIdx > -1) {
      const targets = [this.equip?.weapon, this.mercenary?.equip?.weapon].filter(Boolean);
      const underSafe = targets.find(w => (w.enchantLevel || 0) < 7);
      if (underSafe) {
        underSafe.enchantLevel = (underSafe.enchantLevel || 0) + 1;
        underSafe.plus = underSafe.enchantLevel;
        if (underSafe.stats?.pAtk) underSafe.stats.pAtk += 3;
        if (underSafe.stats?.mAtk) underSafe.stats.mAtk += 3;
        underSafe.name = `+${underSafe.enchantLevel} [${underSafe.gradeName || '고급'}] ${underSafe.baseName || '무기'}`;
        this.inventory[wScrollIdx].count = (this.inventory[wScrollIdx].count || 1) - 1;
        if (this.inventory[wScrollIdx].count <= 0) this.inventory.splice(wScrollIdx, 1);
        this.recalculateCombatPower();
        this.sendWs({
          type: 'PLAYER_ACTION_FX',
          charId: this.charId,
          mapKey: this.mapKey,
          fxKind: 'enchant',
          success: true,
          plus: underSafe.enchantLevel,
          x: Math.round(this.x),
          y: Math.round(this.y)
        });
      }
    }

    const aScrollIdx = this.inventory.findIndex(it => it && (it.type === 'S_ARM01' || it.type === 'S_AR01') && (it.count || 1) > 0);
    if (aScrollIdx > -1) {
      const armorSlots = ['armor', 'helmet', 'boots', 'gloves', 'cloak'];
      for (const s of armorSlots) {
        const eq = this.equip?.[s];
        if (eq && (eq.enchantLevel || 0) < 5) {
          eq.enchantLevel = (eq.enchantLevel || 0) + 1;
          eq.plus = eq.enchantLevel;
          if (eq.stats?.pDef) eq.stats.pDef += 2;
          eq.name = `+${eq.enchantLevel} [${eq.gradeName || '고급'}] ${eq.baseName || '방어구'}`;
          this.inventory[aScrollIdx].count = (this.inventory[aScrollIdx].count || 1) - 1;
          if (this.inventory[aScrollIdx].count <= 0) this.inventory.splice(aScrollIdx, 1);
          this.recalculateCombatPower();
          break;
        }
      }
    }
  }

  sellJunkItemsInBag() {
    if (!Array.isArray(this.inventory)) return;
    const kept = [];
    for (const it of this.inventory) {
      if (!it) continue;
      const t = String(it.type || it.id || '');
      const isConsumableOrScroll = t.startsWith('C_') || t.startsWith('S_') || t.startsWith('BOOK_');
      if (isConsumableOrScroll) {
        kept.push(it);
        continue;
      }
      if ((it.gradeIdx || 0) === 0 && (it.enchantLevel || 0) === 0) {
        this.gold += 350 + this.level * 15;
      } else {
        kept.push(it);
      }
    }
    this.inventory = kept;
  }

  quickFieldResupplyPotions() {
    const hpPotType = this.level >= 120 ? 'C_HP04' : (this.level >= 60 ? 'C_HP03' : (this.level >= 25 ? 'C_HP02' : 'C_HP01'));
    const mpPotType = this.level >= 100 ? 'C_MP03' : (this.level >= 40 ? 'C_MP02' : 'C_MP01');
    const ensureInv = (arr, type, count) => {
      const found = arr.find(i => i && i.type === type);
      if (found) found.count = Math.max(found.count, count);
      else arr.push({ id: `field_${type}_${Date.now()}`, type, count });
    };
    ensureInv(this.inventory, hpPotType, 250);
    ensureInv(this.inventory, mpPotType, 200);
    if (this.mercenary && this.mercenary.hired) {
      this.mercenary.inventory = this.mercenary.inventory || [];
      ensureInv(this.mercenary.inventory, hpPotType, 150);
      ensureInv(this.mercenary.inventory, mpPotType, 100);
      this.mercenary.requirePotion = false;
    }
  }

  checkDrinkPotion() {
    if (this.hp < this.maxHp * 0.62) {
      const hpPotIdx = this.inventory.findIndex(it => it && (String(it.type).startsWith('C_HP') || it.type === 'C_P01' || it.type === 'C_P02') && (it.count || 1) > 0);
      if (hpPotIdx > -1) {
        const pot = this.inventory[hpPotIdx];
        const healAmt = POTION_HEAL_MAP[pot.type]?.hp || 185;
        this.hp = Math.min(this.maxHp, this.hp + healAmt);
        pot.count = (pot.count || 1) - 1;
        if (pot.count <= 0) this.inventory.splice(hpPotIdx, 1);
        this.sendWs({
          type: 'PLAYER_ACTION_FX',
          charId: this.charId,
          mapKey: this.mapKey,
          fxKind: 'potion',
          subType: 'hp',
          amount: healAmt,
          x: Math.round(this.x),
          y: Math.round(this.y)
        });
      } else if (this.targetMob && this.targetMob.isBoss) {
        this.quickFieldResupplyPotions();
      } else if (!this.isShopping) {
        this.routineTownShopping();
      }
    }

    if (this.mp < this.maxMp * 0.38) {
      const mpPotIdx = this.inventory.findIndex(it => it && (String(it.type).startsWith('C_MP') || it.type === 'C_P03' || it.type === 'C_P04') && (it.count || 1) > 0);
      if (mpPotIdx > -1) {
        const pot = this.inventory[mpPotIdx];
        const mpAmt = POTION_HEAL_MAP[pot.type]?.mp || 120;
        this.mp = Math.min(this.maxMp, this.mp + mpAmt);
        pot.count = (pot.count || 1) - 1;
        if (pot.count <= 0) this.inventory.splice(mpPotIdx, 1);
        this.sendWs({
          type: 'PLAYER_ACTION_FX',
          charId: this.charId,
          mapKey: this.mapKey,
          fxKind: 'potion',
          subType: 'mp',
          amount: mpAmt,
          x: Math.round(this.x),
          y: Math.round(this.y)
        });
      } else if (this.targetMob && this.targetMob.isBoss) {
        this.quickFieldResupplyPotions();
      } else if (!this.isShopping) {
        this.routineTownShopping();
      }
    }
  }

  checkMercenaryNeeds() {
    if (!this.mercenary || !this.mercenary.hired) return;
    if (this.mercenary.requirePotion) {
      const myHpPot = this.inventory.find(it => it && (String(it.type).startsWith('C_HP') || it.type === 'C_P01' || it.type === 'C_P02') && it.count > 60);
      if (myHpPot) {
        myHpPot.count -= 50;
        this.mercenary.inventory = this.mercenary.inventory || [];
        const mPot = this.mercenary.inventory.find(it => it.type === myHpPot.type);
        if (mPot) mPot.count += 50;
        else this.mercenary.inventory.push({ id: `merc_pot_${Date.now()}`, type: myHpPot.type, count: 50 });
        this.mercenary.requirePotion = false;
        this.combatMemory = `동반 용병(${this.mercenary.name})에게 체력 물약을 나눠주었습니다.`;
      } else if (this.targetMob && this.targetMob.isBoss) {
        this.quickFieldResupplyPotions();
      } else if (!this.isShopping) {
        this.routineTownShopping();
      }
    }
  }

  routineTownShopping() {
    if (this.isShopping || this.isLoggingOut) return;
    this.isShopping = true;
    this.state = 'SHOPPING';

    // 마을 귀환 직전 사냥터 위치를 저장하여 파티장/파티원이 정비를 마치고 원래 사냥터로 정확히 복귀하도록 보장!
    if (!isInTownSafeZone(this.mapKey, this.x, this.y)) {
      this.preShopReturnSpot = {
        regionKey: this.regionKey,
        mapKey: this.mapKey,
        x: Math.round(this.x),
        y: Math.round(this.y)
      };
    } else if (this.lastLeaderFieldPos) {
      this.preShopReturnSpot = { ...this.lastLeaderFieldPos };
    }

    this.targetMob = null;
    this.targetMobId = null;
    this.isWalking = false;

    const now = Date.now();
    if (this.partyData && (this.partyData.members || []).length > 1 && now - (this.lastShopChatTs || 0) >= 45000) {
      this.lastShopChatTs = now;
      const isLeader = this.partyData.leaderCharId === this.charId;
      const msgTxt = isLeader
        ? `/파티 물약 사러 마을 잠깐 다녀올게요! 다녀올 동안 현 위치에서 자유사냥하고 계세요~`
        : `/파티 물약 보충하러 마을 상점 잠깐 다녀올게요~`;
      this.sendWs({
        type: 'CHAT_MSG',
        charId: this.charId,
        mapKey: this.mapKey,
        regionKey: this.regionKey,
        sender: this.name,
        text: msgTxt
      });
    }

    const regCfg = getRegionCfg(this.regionKey);
    const townMapKey = `${this.regionKey}_sub1`;
    // 마을 중앙 스폰 지점(플레이어 위치)과 겹치지 않도록 상점 NPC 주변 원형 궤도(반경 95~165px)로 분산 배치
    const shopAng = ((this.slotIndex % 12) / 12) * Math.PI * 2 + (Math.random() * 0.35 - 0.175);
    const shopRad = 95 + (this.slotIndex % 4) * 22 + Math.random() * 18;
    const shopX = (regCfg.townX || 2000) + Math.cos(shopAng) * shopRad;
    const shopY = (regCfg.townY || 14250) + Math.sin(shopAng) * shopRad;
    this.teleportToMap(this.regionKey, townMapKey, shopX, shopY);

    setTimeout(() => {
      if (this.isLoggingOut) return;
      this.sellJunkItemsInBag();
      this.hp = this.maxHp;
      this.mp = this.maxMp;

      const hpPotType = this.level >= 120 ? 'C_HP04' : (this.level >= 60 ? 'C_HP03' : (this.level >= 25 ? 'C_HP02' : 'C_HP01'));
      const mpPotType = this.level >= 100 ? 'C_MP03' : (this.level >= 40 ? 'C_MP02' : 'C_MP01');

      const ensureInv = (arr, type, count) => {
        const found = arr.find(i => i && i.type === type);
        if (found) found.count = Math.max(found.count, count);
        else arr.push({ id: `shop_${type}_${Date.now()}`, type, count });
      };

      ensureInv(this.inventory, hpPotType, 350);
      ensureInv(this.inventory, mpPotType, 250);
      ensureInv(this.inventory, 'C_SPD01', 100);
      ensureInv(this.inventory, 'C_ATK01', 100);
      ensureInv(this.inventory, 'S_WPN01', 3);
      ensureInv(this.inventory, 'S_ARM01', 3);

      if (this.mercenary && this.mercenary.hired) {
        this.mercenary.isDead = false;
        this.mercenary.hp = this.mercenary.maxHp;
        this.mercenary.mp = this.mercenary.maxMp;
        this.mercenary.inventory = this.mercenary.inventory || [];
        ensureInv(this.mercenary.inventory, hpPotType, 180);
        ensureInv(this.mercenary.inventory, mpPotType, 120);
        this.mercenary.requirePotion = false;
      }

      this.manageEquipmentAndEnchant();
      this.combatMemory = `마을 안전지대에 귀환해 잡템을 처분하고 본인 및 용병의 물약/주문서를 보충했습니다.`;

      this.state = 'HUNTING';
      this.isShopping = false;

      // 파티 중일 때는 무작위 맵이 아니라 파티원들이 대기/사냥 중인 원래 사냥터(또는 파티장 위치)로 정확히 복귀!
      if (this.partyData) {
        const isLeader = this.partyData.leaderCharId === this.charId;
        if (!isLeader) {
          const leaderMem = (this.partyData.members || []).find(m => m.charId === this.partyData.leaderCharId);
          if (leaderMem && leaderMem.mapKey && !isInTownSafeZone(leaderMem.mapKey, leaderMem.x || 2000, leaderMem.y || 14250)) {
            const tb = getMapBounds(leaderMem.mapKey);
            const rx = Math.max(tb.minX, Math.min(tb.maxX, (leaderMem.x || tb.centerX) + (Math.random() * 60 - 30)));
            const ry = Math.max(tb.minY, Math.min(tb.maxY, (leaderMem.y || tb.centerY) + (Math.random() * 60 - 30)));
            this.teleportToMap(leaderMem.regionKey || String(leaderMem.mapKey).split('_')[0], leaderMem.mapKey, rx, ry);
            return;
          }
        }
        if (this.preShopReturnSpot && this.preShopReturnSpot.mapKey && !isInTownSafeZone(this.preShopReturnSpot.mapKey, this.preShopReturnSpot.x, this.preShopReturnSpot.y)) {
          const ret = this.preShopReturnSpot;
          this.teleportToMap(ret.regionKey || this.regionKey, ret.mapKey, ret.x, ret.y);
          if (isLeader && (this.partyData.members || []).length > 1) {
            this.sendWs({
              type: 'CHAT_MSG',
              charId: this.charId,
              mapKey: this.mapKey,
              regionKey: this.regionKey,
              sender: this.name,
              text: `/파티 물약 보충해서 복귀했습니다! 다시 같이 사냥해요 ㄱㄱ`
            });
          }
          return;
        }
      }

      const validPreSpot = (this.preShopReturnSpot && this.preShopReturnSpot.mapKey && !isInTownSafeZone(this.preShopReturnSpot.mapKey, this.preShopReturnSpot.x, this.preShopReturnSpot.y))
        ? this.preShopReturnSpot
        : null;
      const nextSpot = validPreSpot || pickBalancedMapPlacement(this.level, this.slotIndex, this.charId, this.regionKey);
      this.teleportToMap(nextSpot.regionKey, nextSpot.mapKey, nextSpot.x, nextSpot.y);
    }, 3500);
  }

  gainExpAndGold(expGain, goldGain) {
    this._isDirty = true;
    this.exp += Number(expGain || 0);
    this.gold += Number(goldGain || 0);
    let leveledUp = false;

    while (this.exp >= this.maxExp && this.level < 250) {
      this.exp -= this.maxExp;
      this.level++;
      leveledUp = true;
      this.maxExp = Math.floor(100 * Math.pow(this.level, 1.38));
      this.maxHp += this.charClass === 'knight' ? 45 : (this.charClass === 'ranger' ? 34 : 26);
      this.maxMp += this.charClass === 'wizard' ? 36 : 18;
      this.hp = this.maxHp;
      this.mp = this.maxMp;

      // 인간 플레이어처럼 레벨업 스탯 포인트 자동 배분
      if (this.charClass === 'knight') {
        this.stats.STR = (this.stats.STR || 20) + 2;
        this.stats.CON = (this.stats.CON || 18) + 1;
      } else if (this.charClass === 'ranger') {
        this.stats.DEX = (this.stats.DEX || 20) + 2;
        this.stats.CON = (this.stats.CON || 16) + 1;
      } else {
        this.stats.INT = (this.stats.INT || 20) + 2;
        this.stats.CON = (this.stats.CON || 15) + 1;
      }

      // 레벨업 시 상위 서클 스킬/마법 자동 해금
      this.learnedSkills = Array.from(new Set([...this.learnedSkills, ...getLearnedSkillsForClass(this.charClass, this.level)]));

      if (this.mercenary && this.mercenary.hired) {
        this.mercenary.level = this.level;
        this.mercenary.maxHp += 35;
        this.mercenary.hp = this.mercenary.maxHp;
        this.mercenary.learnedSkills = getLearnedSkillsForClass(this.mercenary.class, this.level);
      }
      this.recalculateCombatPower();
    }

    if (leveledUp) {
      this.sendWs({
        type: 'PLAYER_ACTION_FX',
        charId: this.charId,
        mapKey: this.mapKey,
        fxKind: 'level_up',
        level: this.level,
        x: Math.round(this.x),
        y: Math.round(this.y)
      });
    }
  }

  // =====================================================================
  // 5. 자가 버프, 용병 힐/버프, 파티원 힐/버프 지원 (1~6서클 전체 마법 활용)
  // =====================================================================
  processBuffsAndPartySupport(now) {
    if (this.state === 'SHOPPING' || this.hp <= 0) return;

    // A. 본인/용병/파티원 응급 힐링 (M13 그레이트 힐, M07 힐링, A01 네이처스 터치)
    const healId = this.charClass === 'wizard'
      ? (this.learnedSkills.includes('M13') ? 'M13' : (this.learnedSkills.includes('M07') ? 'M07' : null))
      : (this.charClass === 'ranger' && this.learnedSkills.includes('A01') ? 'A01' : null);
    const healSkill = healId ? SKILL_DB[healId] : null;

    if (healSkill && this.mp >= healSkill.mp && (now - (this.skillCooldowns[healSkill.id] || 0) >= healSkill.cd)) {
      const healAmt = (healSkill.heal || 150) + this.level * 4;

      // 1) 본인 체력이 68% 이하일 때 자가 힐
      if ((this.hp / this.maxHp) <= 0.68) {
        this.mp -= healSkill.mp;
        this.skillCooldowns[healSkill.id] = now;
        this.hp = Math.min(this.maxHp, this.hp + healAmt);
        this.sendWs({
          type: 'PLAYER_ACTION_FX',
          charId: this.charId,
          mapKey: this.mapKey,
          fxKind: 'ally_buff',
          skillName: healSkill.name,
          healAmt,
          x: Math.round(this.x),
          y: Math.round(this.y)
        });
        return;
      }

      // 2) 내 용병 체력이 68% 이하일 때 용병 힐
      if (this.mercenary && this.mercenary.hired && !this.mercenary.isDead && (this.mercenary.hp / this.mercenary.maxHp) <= 0.68) {
        this.mp -= healSkill.mp;
        this.skillCooldowns[healSkill.id] = now;
        this.mercenary.hp = Math.min(this.mercenary.maxHp, this.mercenary.hp + healAmt);
        this.sendWs({
          type: 'PLAYER_ACTION_FX',
          charId: this.charId,
          mapKey: this.mapKey,
          fxKind: 'ally_buff',
          isMerc: true,
          skillName: healSkill.name,
          healAmt,
          x: Math.round(this.mercenary.x),
          y: Math.round(this.mercenary.y)
        });
        return;
      }

      // 3) 파티원 체력이 72% 이하일 때 파티원 힐
      if (this.partyData && Array.isArray(this.partyData.members)) {
        const injuredMember = this.partyData.members.find(m =>
          m && m.charId !== this.charId && m.hp > 0 && m.maxHp > 0 && (m.hp / m.maxHp) <= 0.72 && (!m.mapKey || m.mapKey === this.mapKey)
        );
        if (injuredMember) {
          this.mp -= healSkill.mp;
          this.skillCooldowns[healSkill.id] = now;
          this.sendWs({
            type: 'ALLY_SUPPORT',
            charId: this.charId,
            casterCharId: this.charId,
            casterName: this.name,
            targetCharId: injuredMember.charId,
            skillId: healSkill.id,
            skillName: healSkill.name,
            healAmt,
            x: Math.round(injuredMember.x || this.x),
            y: Math.round(injuredMember.y || this.y)
          });
          return;
        }
      }
    }

    // B. 직업별 핵심 버프 유지 및 파티원 버프 지원 (쉴드, 인챈트 스탯, 헤이스트, 뮨, 어드밴스드 스피릿, 아크메이지 폼, 이글 아이, 윈드 워크, 레이지 등)
    const buffCandidates = this.learnedSkills
      .map(id => SKILL_DB[id])
      .filter(sk => sk && sk.type === 'buff' && sk.buffKey && this.mp >= (sk.mp || 0) && (now - (this.skillCooldowns[sk.id] || 0) >= Math.max(8000, sk.cd || 5000)));

    for (const bSk of buffCandidates) {
      if (!this.hasBuff(bSk.buffKey)) {
        this.mp -= (bSk.mp || 0);
        this.skillCooldowns[bSk.id] = now;
        const durMs = (bSk.dur || 60) * 1000;
        this.activeBuffs[bSk.buffKey] = now + durMs;
        this.recalculateCombatPower();

        this.sendWs({
          type: 'PLAYER_ACTION_FX',
          charId: this.charId,
          mapKey: this.mapKey,
          fxKind: 'ally_buff',
          skillName: bSk.name,
          x: Math.round(this.x),
          y: Math.round(this.y)
        });

        // 파티원이 있고 아군 시전 가능한 버프(뮨, 어드밴스드 스피릿, 헤이스트, 인챈트 스탯, 쉴드, 이글 아이 등)라면 파티원에게도 시전!
        if (bSk.allyCast && this.partyData && Array.isArray(this.partyData.members)) {
          for (const pm of this.partyData.members) {
            if (pm && pm.charId !== this.charId && (!pm.mapKey || pm.mapKey === this.mapKey)) {
              this.sendWs({
                type: 'ALLY_SUPPORT',
                charId: this.charId,
                casterCharId: this.charId,
                casterName: this.name,
                targetCharId: pm.charId,
                skillId: bSk.id,
                skillName: bSk.name,
                buffKey: bSk.buffKey,
                durMs,
                healAmt: 0,
                x: Math.round(pm.x || this.x),
                y: Math.round(pm.y || this.y)
              });
            }
          }
        }
        break;
      }
    }
  }

  checkProactivePartyInvite(now) {
    if (now - this.lastProactiveInviteCheck < 15000) return;
    this.lastProactiveInviteCheck = now;
    if (now - this.lastPartyInviteTime < 120000) return;
    if (this.autoInviteChance <= 0) return;

    const currentMemberCount = this.partyData?.members?.length || 1;
    if (currentMemberCount >= MAX_PARTY_MEMBERS) return;
    if (this.partyData && this.partyData.leaderCharId !== this.charId) return;

    const candidates = [];
    for (const p of this.worldPlayers.values()) {
      if (!p || p.charId === this.charId) continue;
      if (p.partyId) continue;
      if (this.rejectedTargets.has(p.name)) continue;
      const lastInv = this.invitedHistory.get(p.name) || 0;
      if (now - lastInv < 300000) continue;
      if (Math.abs((p.level || 1) - this.level) > 25) continue;
      if (fastHypot((p.x || 0) - this.x, (p.y || 0) - this.y) <= 750) {
        candidates.push(p);
      }
    }

    if (candidates.length === 0) return;
    if (Math.random() <= this.autoInviteChance * 0.15) {
      const target = candidates[Math.floor(Math.random() * candidates.length)];
      this.invitedHistory.set(target.name, now);
      this.lastPartyInviteTime = now;
      this.sendWs({
        type: 'CHAT_MSG',
        charId: this.charId,
        mapKey: this.mapKey,
        regionKey: this.regionKey,
        sender: this.name,
        text: `/파티초대 ${target.name}`
      });
    }
  }

  onPartyInviteReceived(msg) {
    const inviterCharId = msg.inviterCharId;
    const inviterName = msg.inviterName || '모험가';
    const isHumanInviter = !String(inviterCharId || '').startsWith('a1000000-') && !msg.inviterIsAI;
    this.pendingPartyInvite = { inviterCharId, inviterName, partyId: msg.partyId };

    // 인간 플레이어가 초대한 경우: 기존에 AI끼리 파티 중이었더라도 탈퇴 후 즉시 수락하거나 합류 허용!
    if (isHumanInviter) {
      if (this.partyData) {
        this.sendWs({ type: 'PARTY_LEAVE_REQ', charId: this.charId });
        this.partyData = null;
      }
      setTimeout(() => {
        this.sendWs({
          type: 'PARTY_INVITE_RESP',
          charId: this.charId,
          inviterCharId,
          accept: true
        });
        const humanGreetings = [
          `${inviterName}님 초대 감사합니다! 같이 열렙해요 ㄱㄱ`,
          `반갑습니다~ 오더 내려주시면 바로 따라갈게요!`,
          `파티 수락했습니다 ㅎㅎ 잘 부탁드려요!`
        ];
        setTimeout(() => {
          this.sendWs({
            type: 'CHAT_MSG',
            charId: this.charId,
            mapKey: this.mapKey,
            regionKey: this.regionKey,
            sender: this.name,
            text: `/파티 ${humanGreetings[Math.floor(Math.random() * humanGreetings.length)]}`
          });
        }, 500);
      }, 200);
      return;
    }

    const currentMemberCount = this.partyData?.members?.length || 1;
    if (this.partyData || currentMemberCount >= MAX_PARTY_MEMBERS) {
      this.sendWs({
        type: 'PARTY_INVITE_RESP',
        charId: this.charId,
        inviterCharId,
        accept: false
      });
      return;
    }

    if (this.autoInviteChance === 0 && Math.random() < 0.65) {
      this.sendWs({
        type: 'PARTY_INVITE_RESP',
        charId: this.charId,
        inviterCharId,
        accept: false
      });
      return;
    }

    this.sendWs({
      type: 'PARTY_INVITE_RESP',
      charId: this.charId,
      inviterCharId,
      accept: true
    });
  }

  checkSmartMapNavigation(now) {
    if (this.partyData) {
      if (this.partyData.leaderCharId !== this.charId) return;
      // 파티원 중 실제 플레이어(Human)가 있거나 마을 정비 중인 파티원이 있으면 임의로 타 지역으로 워프하지 않고 현재 사냥터 유지!
      const hasHumanOrTownMember = (this.partyData.members || []).some(m =>
        m && (!String(m.charId || '').startsWith('a1000000-') || m.inSafeZone)
      );
      if (hasHumanOrTownMember) return;
    }
    if (now - this.lastMapCheckTime < 35000) return;
    this.lastMapCheckTime = now;
    if (this.state !== 'HUNTING') return;

    const currentMapPop = getMapAgentCount(this.mapKey, null);
    const bestRegion = this.pickBestRegionForLevel();

    // 현재 맵 인원이 캡(8명)을 초과했거나, 레벨업으로 적정 지역이 변경된 경우 여유로운 맵/던전으로 자동 분산 이동
    if (currentMapPop > MAX_AGENTS_PER_MAP || this.regionKey !== bestRegion) {
      const targetSpot = pickBalancedMapPlacement(this.level, this.slotIndex, this.charId, bestRegion);
      if (targetSpot.mapKey !== this.mapKey) {
        this.teleportToMap(targetSpot.regionKey, targetSpot.mapKey, targetSpot.x, targetSpot.y);
      }
    }
  }

  // 🤝 플레이어가 AI 에이전트에게 거래를 신청했을 때 자연스럽게 수락 및 대응
  onTradeInviteReceived(msg) {
    if (!msg || !msg.tradeId) return;
    if (this.activeTradeId || this.isLoggingOut) {
      this.sendWs({
        type: 'TRADE_INVITE_RESP',
        charId: this.charId,
        tradeId: msg.tradeId,
        accept: false
      });
      return;
    }
    this.activeTradeId = msg.tradeId;
    setTimeout(() => {
      this.sendWs({
        type: 'TRADE_INVITE_RESP',
        charId: this.charId,
        tradeId: msg.tradeId,
        accept: true
      });
    }, 350);
  }

  onTradeStateSync(msg) {
    const t = msg?.trade;
    if (!t || t.tradeId !== this.activeTradeId) return;
    const isA = t.playerA?.charId === this.charId;
    const mySide = isA ? t.playerA : t.playerB;
    const otherSide = isA ? t.playerB : t.playerA;
    if (!mySide || !otherSide) return;

    // 상대방(플레이어)이 등록완료(잠금)를 누르면 AI도 잠금 -> 거래확정 진행
    if (otherSide.locked && !mySide.locked) {
      setTimeout(() => {
        if (this.activeTradeId !== t.tradeId) return;
        this.sendWs({
          type: 'TRADE_LOCK_REQ',
          charId: this.charId,
          tradeId: t.tradeId,
          locked: true,
          items: mySide.items || [],
          gold: mySide.gold || 0,
          freeSlots: Math.max(10, 100 - (this.inventory?.length || 0)),
          currentGold: this.gold || 0
        });
      }, 450);
    } else if (otherSide.locked && mySide.locked && !mySide.confirmed) {
      setTimeout(() => {
        if (this.activeTradeId !== t.tradeId) return;
        this.sendWs({
          type: 'TRADE_CONFIRM_REQ',
          charId: this.charId,
          tradeId: t.tradeId,
          offerVersion: t.offerVersion
        });
      }, 500);
    }
  }

  onTradeCommitExecute(msg) {
    if (!msg || !msg.tradeTxId) return;
    this.activeTradeId = null;
    const givenGold = Math.max(0, Number(msg.giveGold) || 0);
    const recvGold = Math.max(0, Number(msg.receiveGold) || 0);
    this.gold = Math.max(0, (this.gold || 0) - givenGold + recvGold);
    if (Array.isArray(msg.receiveItems)) {
      msg.receiveItems.forEach(it => {
        if (it && it.type) {
          this.inventory.push({
            ...it,
            count: it.qty || it.count || 1
          });
        }
      });
      this.manageEquipmentAndEnchant();
    }
    this._isDirty = true;
  }

  teleportToMap(regionKey, mapKey, x = 2000, y = 9000) {
    this.regionKey = regionKey || this.regionKey;
    this.mapKey = mapKey || `${this.regionKey}_sub1`;
    this.x = Math.round(x);
    this.y = Math.round(y);
    this.targetMob = null;
    this.targetMobId = null;
    this.isWalking = false;
    if (this.mercenary && this.mercenary.hired) {
      const mAng = ((this.slotIndex % 8) / 8) * Math.PI * 2 + 0.4;
      this.mercenary.x = Math.round(this.x + Math.cos(mAng) * 42);
      this.mercenary.y = Math.round(this.y + Math.sin(mAng) * 32);
      this.mercenary.isWalking = false;
    }
    this.worldMonsters.clear();
    this.worldItems.clear();
    this.worldPlayers.clear();
    this._lastFullSyncTs = Date.now();
    this.sendWs({
      type: 'CHANGE_MAP',
      charId: this.charId,
      mapKey: this.mapKey,
      player: this.buildPlayerSyncPayload(true)
    });
  }

  // =====================================================================
  // 6. 대규모 언어 모델(Groq LLM) 자연어 채팅 처리 및 파티장 위임/Action 실행
  // =====================================================================
  async onChatReceived(msg) {
    if (!msg || msg.charId === this.charId) return;
    const rawSender = String(msg.sender || '').trim();
    const senderName = rawSender
      .replace(/^👑\[운영자\]\s*/, '')
      .replace(/^👑\[GM전체\]\s*/, '')
      .replace(/^📢\[전체\]\s*/, '')
      .replace(/^🎗️\[파티\]\s*/, '')
      .replace(/^\[지역\]\s*/, '')
      .replace(/님의 귓속말$/, '')
      .trim();
    const text = String(msg.text || '').trim();
    if (!text || senderName === this.name) return;

    const ignorePhrases = ['파티 초대 감사합니다', '먼저 들어가볼게요', '솔플 중이에요', '열렙해요 ㄱㄱ', '수락했습니다! 잘 부탁드려요', '파티장 넘겨드렸습니다'];
    if (ignorePhrases.some(p => text.includes(p))) return;

    // 인간 플레이어가 파티장 권한을 요구한 경우 즉시 위임 처리!
    const isPartyLeaderRequest =
      (text.includes('파티장') || text.includes('파장')) &&
      (text.includes('주') || text.includes('줘') || text.includes('넘겨') || text.includes('위임') || text.includes('양보') || text.includes('요구') || text.includes('달라') || text.includes('할게'));

    if (isPartyLeaderRequest && this.partyData && this.partyData.leaderCharId === this.charId) {
      const memberMatch = (this.partyData.members || []).find(m => m.charId === msg.charId || m.name === senderName);
      if (memberMatch) {
        this.sendWs({
          type: 'PARTY_DELEGATE_REQ',
          charId: this.charId,
          targetCharId: memberMatch.charId
        });
        setTimeout(() => {
          this.sendWs({
            type: 'CHAT_MSG',
            charId: this.charId,
            mapKey: this.mapKey,
            regionKey: this.regionKey,
            sender: this.name,
            text: `/파티 넵! ${senderName}님께 파티장 넘겨드렸습니다~ 오더 내려주세요 ㅎㅎ`
          });
        }, 350);
        return;
      }
    }

    const chatStyle = msg.chatStyle || 'region';
    const isWhisperToMe = chatStyle === 'whisper' && rawSender.includes('귓속말');
    const isPartyChat = chatStyle === 'party' && this.partyData;
    const baseName = this.name.replace(/[0-9]/g, '');
    let isAddressedToMe = text.includes(this.name) || (baseName.length >= 2 && text.includes(baseName));

    if (!isAddressedToMe && this.lastTalkedUser === senderName && (Date.now() - this.lastTalkTime < 60000)) {
      isAddressedToMe = true;
    }

    // 다른 맵(예: 필드 <-> 던전)에서 보낸 일반 지역채팅은 직접 호명하지 않은 경우 무시
    if (chatStyle === 'region' && msg.mapKey && msg.mapKey !== this.mapKey && !isAddressedToMe) {
      return;
    }

    if (!isWhisperToMe && !isPartyChat && !isAddressedToMe) {
      const senderEnt = this.worldPlayers.get(msg.charId);
      if (senderEnt && fastHypot((senderEnt.x || 0) - this.x, (senderEnt.y || 0) - this.y) <= 420) {
        if (text.includes('파티') || text.includes('님') || text.includes('혹시') || text.includes('?') || text.includes('힐') || text.includes('버프')) {
          const lastMapReply = lastRegionChatReplyTs.get(this.mapKey) || 0;
          if (Date.now() - lastMapReply >= 6000) {
            lastRegionChatReplyTs.set(this.mapKey, Date.now());
            isAddressedToMe = true;
          }
        }
      }
    }

    if (!isWhisperToMe && !isPartyChat && !isAddressedToMe) return;

    if (Date.now() - this.lastAiCallTime < 25000) return;
    this.lastAiCallTime = Date.now();
    this.lastTalkedUser = senderName;
    this.lastTalkTime = Date.now();

    const availableRegions = REGION_CONFIGS.map(r => `${r.id}_sub1(Lv.${r.minLv}~${r.maxLv})`).join(', ');
    const learnedNames = this.learnedSkills.slice(-12).map(id => SKILL_DB[id]?.name || id).join(', ');
    const leaderName = this.partyData
      ? ((this.partyData.members || []).find(m => m.charId === this.partyData.leaderCharId)?.name || '없음')
      : '없음';

    const situationContext = `
[내 실시간 상태]
- 캐릭터명: ${this.name} (Lv.${this.level} ${this.charClass === 'knight' ? '인간전사' : (this.charClass === 'ranger' ? '엘프궁수' : '엘프마법사')})
- HP: ${Math.round(this.hp)}/${Math.round(this.maxHp)}, MP: ${Math.round(this.mp)}/${Math.round(this.maxMp)}, 골드: ${this.gold.toLocaleString()} G
- 동반 용병: ${this.mercenary?.name || '없음'} (Lv.${this.mercenary?.level || this.level})
- 현재 맵: ${this.mapKey} (지역: ${this.regionKey})
- 파티 상태: ${this.partyData ? `파티 참여 중 (파티장: ${leaderName}, 인원: ${this.partyData.members?.length || 1}/5명)` : '솔로 플레이 중'}
- 최근 사냥 기억: ${this.combatMemory}
- 주력 보유 스킬: [${learnedNames}]
- 내 고유 성향/말투: ${this.personality}
- 이동 가능 맵 코드: [${availableRegions}, R01_dungeon ~ R15_dungeon]`;

    const tag = isWhisperToMe ? `[귓속말]` : (isPartyChat ? `[파티채팅]` : `[일반채팅]`);
    this.chatHistory.push({ role: 'user', content: `${tag} ${senderName}: ${text}` });
    if (this.chatHistory.length > 6) this.chatHistory.shift();

    try {
      const completion = await callGroqChatCompletion([
        {
          role: 'system',
          content: `당신은 모바일/PC MMORPG 'Age of Magic'을 플레이 중인 실제 한국인 유저입니다.
AI나 봇이라는 티를 절대 내지 말고, 부여된 성격과 현재 캐릭터 상황에 맞춰 실제 게이머처럼 자연스럽게 대화하세요.
상대방이 파티 초대를 원하면 PARTY_INVITE, 파티장 위임을 요구하면 PARTY_DELEGATE를 선택하세요.

${situationContext}

상대방('${senderName}')의 말을 읽고 반드시 아래 JSON 형식으로만 응답하세요 (코드블록 없이 순수 JSON만 출력):
{
  "reply": "성격에 맞는 자연스러운 게이머 말투의 1~2문장 대답",
  "action": "NONE" | "FOLLOW" | "STOP_FOLLOW" | "TELEPORT" | "PARTY_ACCEPT" | "PARTY_INVITE" | "PARTY_DELEGATE" | "PARTY_LEAVE" | "HEAL_TARGET" | "BUFF_TARGET" | "GO_TOWN" | "LOGOUT",
  "target": "행동 대상 캐릭터 이름 (없으면 빈 문자열)",
  "map": "TELEPORT 시 이동할 맵 코드 (예: R01_sub1, R02_dungeon 등)",
  "spell": "HEAL_TARGET 또는 BUFF_TARGET 시 사용할 스킬명"
}`
        },
        ...this.chatHistory
      ]);

      let raw = completion.choices?.[0]?.message?.content || '{}';
      raw = raw.replace(/```json/gi, '').replace(/```/g, '').trim();
      const decision = JSON.parse(raw);
      const reply = (decision.reply || '').trim();
      const action = decision.action || 'NONE';

      if (reply) {
        const outText = isWhisperToMe
          ? `/귓속말 ${senderName} ${reply}`
          : (this.partyData ? `/파티 ${reply}` : reply);
        this.sendWs({
          type: 'CHAT_MSG',
          charId: this.charId,
          mapKey: this.mapKey,
          regionKey: this.regionKey,
          sender: this.name,
          text: outText
        });
        this.chatHistory.push({ role: 'assistant', content: reply });
      }

      this.executeLlmAction(action, decision, senderName);
    } catch (err) {
      const fallbackReplies = [
        '아 지금 몹 몰려서 사냥 집중 중입니다 ㅋㅋ 잠시만요!',
        '손이 꼬여서 물약 먹는 중 ㄷㄷ 좀따 말씀드릴게요~',
        '넵 ㅎㅎ 다들 득템하시고 열렙하세요!'
      ];
      const fallback = fallbackReplies[Math.floor(Math.random() * fallbackReplies.length)];
      const outText = isWhisperToMe
        ? `/귓속말 ${senderName} ${fallback}`
        : (this.partyData ? `/파티 ${fallback}` : fallback);
      this.sendWs({
        type: 'CHAT_MSG',
        charId: this.charId,
        mapKey: this.mapKey,
        regionKey: this.regionKey,
        sender: this.name,
        text: outText
      });
    }
  }

  executeLlmAction(action, decision, senderName) {
    if (!action || action === 'NONE') return;
    const targetName = decision.target || senderName;
    let targetPlayer = null;
    for (const p of this.worldPlayers.values()) {
      if (p.name === targetName) {
        targetPlayer = p;
        break;
      }
    }

    switch (action) {
      case 'FOLLOW':
        this.followTargetName = targetName;
        break;
      case 'STOP_FOLLOW':
        this.followTargetName = null;
        break;
      case 'TELEPORT':
        if (decision.map) {
          const rKey = String(decision.map).split('_')[0] || this.regionKey;
          this.teleportToMap(rKey, decision.map, 2000, 9000);
        }
        break;
      case 'PARTY_ACCEPT':
        if (this.pendingPartyInvite) {
          this.sendWs({
            type: 'PARTY_INVITE_RESP',
            charId: this.charId,
            inviterCharId: this.pendingPartyInvite.inviterCharId,
            accept: true
          });
          this.pendingPartyInvite = null;
        }
        break;
      case 'PARTY_INVITE':
        if (targetName) {
          this.sendWs({
            type: 'CHAT_MSG',
            charId: this.charId,
            mapKey: this.mapKey,
            regionKey: this.regionKey,
            sender: this.name,
            text: `/파티초대 ${targetName}`
          });
        }
        break;
      case 'PARTY_DELEGATE':
        if (this.partyData && this.partyData.leaderCharId === this.charId) {
          const mem = (this.partyData.members || []).find(m => m.name === targetName || m.name === senderName);
          if (mem) {
            this.sendWs({
              type: 'PARTY_DELEGATE_REQ',
              charId: this.charId,
              targetCharId: mem.charId
            });
          } else {
            this.sendWs({
              type: 'CHAT_MSG',
              charId: this.charId,
              mapKey: this.mapKey,
              regionKey: this.regionKey,
              sender: this.name,
              text: `/파티위임 ${targetName}`
            });
          }
        }
        break;
      case 'PARTY_LEAVE':
        if (this.partyData) {
          this.sendWs({ type: 'PARTY_LEAVE_REQ', charId: this.charId });
          this.partyData = null;
          this.followTargetName = null;
        }
        break;
      case 'HEAL_TARGET':
        if (targetPlayer) {
          const hName = this.charClass === 'ranger' ? '네이처스 터치' : (this.learnedSkills.includes('M13') ? '그레이트 힐' : '힐링');
          this.sendWs({
            type: 'ALLY_SUPPORT',
            charId: this.charId,
            casterCharId: this.charId,
            casterName: this.name,
            targetCharId: targetPlayer.charId,
            skillId: this.charClass === 'ranger' ? 'A01' : 'M13',
            skillName: hName,
            healAmt: 220 + this.level * 4,
            x: Math.round(targetPlayer.x || this.x),
            y: Math.round(targetPlayer.y || this.y)
          });
        }
        break;
      case 'BUFF_TARGET':
        if (targetPlayer) {
          const bKey = this.charClass === 'ranger' ? 'EAGLE_EYE' : (this.learnedSkills.includes('M41') ? 'ADV_SPIRIT' : 'ENCHANT_STAT');
          const bName = decision.spell || (this.charClass === 'ranger' ? '이글 아이' : (this.learnedSkills.includes('M41') ? '어드밴스드 스피릿' : '인챈트 스탯'));
          this.sendWs({
            type: 'ALLY_SUPPORT',
            charId: this.charId,
            casterCharId: this.charId,
            casterName: this.name,
            targetCharId: targetPlayer.charId,
            skillId: 'M14',
            skillName: bName,
            buffKey: bKey,
            durMs: 300000,
            healAmt: 0,
            x: Math.round(targetPlayer.x || this.x),
            y: Math.round(targetPlayer.y || this.y)
          });
        }
        break;
      case 'GO_TOWN':
        this.routineTownShopping();
        break;
      case 'LOGOUT':
        setTimeout(() => this.gracefulLogout(), 1200);
        break;
    }
  }

  // =====================================================================
  // 생애 주기 종료: 작별 인사 후 Graceful Logout 및 DB 저장
  // =====================================================================
  async gracefulLogout() {
    if (this.isLoggingOut) return;
    this.isLoggingOut = true;

    if (this.partyData) {
      const farewells = [
        '사냥 수고하셨습니다! 저 먼저 들어가볼게요~ 득템하세요!',
        '오늘 파티 사냥 재밌었습니다 ㅎㅎ 먼저 가볼게요 수고하세요!',
        '시간이 돼서 먼저 접습니다~ 다들 수고하셨습니다!'
      ];
      this.sendWs({
        type: 'CHAT_MSG',
        charId: this.charId,
        mapKey: this.mapKey,
        regionKey: this.regionKey,
        sender: this.name,
        text: `/파티 ${farewells[Math.floor(Math.random() * farewells.length)]}`
      });
      this.sendWs({ type: 'PARTY_LEAVE_REQ', charId: this.charId });
    }

    setTimeout(async () => {
      await this.logout();
    }, 1500);
  }

  buildCharacterRecord(isLogout = false) {
    return {
      id: this.charId,
      user_id: this.userId,
      slot_index: this.slotIndex,
      name: this.name,
      class: this.charClass,
      level: this.level,
      exp: this.exp,
      gold: this.gold,
      region_key: this.regionKey,
      map_key: this.mapKey,
      pos_x: Math.round(this.x),
      pos_y: Math.round(this.y),
      session_token: isLogout ? null : this.sessionToken,
      char_data: {
        ...(this.dbRow.char_data || {}),
        isAI: true,
        hp: Math.round(this.hp),
        maxHp: Math.round(this.maxHp),
        mp: Math.round(this.mp),
        maxMp: Math.round(this.maxMp),
        maxExp: this.maxExp,
        stats: this.stats,
        equip: this.equip,
        inventory: this.inventory,
        learnedSkills: this.learnedSkills,
        mercenary: this.mercenary,
        personality: this.personality,
        autoInviteChance: this.autoInviteChance
      },
      updated_at: new Date().toISOString()
    };
  }

  /**
   * [DB I/O 극대화 최적화]
   * - 평시: Supabase에 단건 API를 직접 호출하지 않고 Redis(SET agent_state:{id} + SADD dirty_agents)에만 기록!
   * - 로그아웃: 세션 종료 시 안전하게 Supabase에 즉시 반영 후 SREM 처리합니다.
   */
  async saveToSupabase(isLogout = false) {
    const updatedRecord = this.buildCharacterRecord(isLogout);

    this.dbRow = updatedRecord;
    const memIdx = allAiDbRecords.findIndex(r => r.id === this.charId);
    if (memIdx > -1) allAiDbRecords[memIdx] = updatedRecord;

    if (isLogout) {
      await handleAgentLogout(this.charId, updatedRecord);
    } else {
      await updateAgentState(this.charId, updatedRecord);
    }
  }

  async logout(skipDbSave = false) {
    this.isLoggingOut = true;
    if (this.loopTimer && typeof this.loopTimer === 'object') {
      clearInterval(this.loopTimer);
    }
    this.loopTimer = null;
    this.sendWs({ type: 'LEAVE_CHAR', charId: this.charId });
    if (!skipDbSave) {
      await this.saveToSupabase(true);
    }
    if (this.ws) {
      try {
        this.ws.close();
      } catch (e) {}
      this.ws = null;
    }
    activeAgents = activeAgents.filter(a => a !== this);
  }
}

function ensureMasterAiLoopRunning() {
  if (masterAiTickTimer) return;
  masterAiTickTimer = setInterval(() => {
    const now = Date.now();
    const cpuPct = currentRunnerCpuPct;
    // CPU가 65% 한계에 근접하면 홀/짝 서브배치 분할 틱으로 순간 부하를 즉시 평탄화
    const throttleSubBatch = cpuPct >= CPU_LIMIT_PCT;
    const subParity = Math.floor(now / 100) % 2;
    for (let i = 0; i < activeAgents.length; i++) {
      if (throttleSubBatch && (i % 2 !== subParity)) continue;
      const ag = activeAgents[i];
      if (ag && !ag.isLoggingOut) {
        ag.stepTick(now, cpuPct);
      }
    }
  }, 100);
}

let isFirstRotationWave = true;
let isRebuildingPool = false;
let controlWs = null;

async function manageAgentRotation() {
  if (isRebuildingPool) return;
  try {
    ensureMasterAiLoopRunning();
    const aliveList = [];
    for (let i = 0; i < activeAgents.length; i++) {
      const a = activeAgents[i];
      if (!a) continue;
      const isSocketAlive = !a.isLoggingOut && a.ws && (a.ws.readyState === WebSocket.OPEN || a.ws.readyState === WebSocket.CONNECTING);
      if (isSocketAlive) {
        aliveList.push(a);
      } else {
        // 🛡️ 끊어진 에이전트의 타이머 및 맵 객체 즉시 해제로 메모리 누수 차단
        if (a.loopTimer && typeof a.loopTimer === 'object') {
          clearInterval(a.loopTimer);
        }
        a.loopTimer = null;
        a.worldMonsters?.clear();
        a.worldPlayers?.clear();
        a.worldItems?.clear();
      }
    }
    activeAgents = aliveList;

    // 1) 상시 인원이 줄어든 경우 초과 에이전트 즉시 로그아웃 및 DB 저장
    if (activeAgents.length > maxConcurrentAI) {
      const excessCount = activeAgents.length - maxConcurrentAI;
      const toRemove = activeAgents.splice(maxConcurrentAI, excessCount);
      await Promise.all(toRemove.map(ag => ag.logout(false)));
    }

    // 2) 600명 풀에서 100명씩 순차 순환 로테이션 충원 (라운드 로빈 커서 기반으로 600명 전원이 고르게 교대 접속)
    if (activeAgents.length < maxConcurrentAI && allAiDbRecords.length > 0) {
      const needed = maxConcurrentAI - activeAgents.length;
      const activeIdSet = new Set(activeAgents.map(a => a.charId));
      const totalPoolLen = allAiDbRecords.length;
      let spawned = 0;
      let scanned = 0;

      while (spawned < needed && scanned < totalPoolLen) {
        const idx = rotationCursor % totalPoolLen;
        rotationCursor = (rotationCursor + 1) % totalPoolLen;
        scanned++;
        const candidate = allAiDbRecords[idx];
        if (!candidate || activeIdSet.has(candidate.id)) continue;
        activeIdSet.add(candidate.id);
        activeAgents.push(new AIAgentClient(candidate, isFirstRotationWave));
        spawned++;
      }
      isFirstRotationWave = false;
    }
  } catch (err) {
    console.error('[-] AI 로테이션 관리 오류:', err.message);
  }
}

function sendControlReport(requesterCharId, text, logClass = 'log-kill') {
  if (controlWs && controlWs.readyState === WebSocket.OPEN) {
    try {
      controlWs.send(JSON.stringify({
        type: 'AI_RUNNER_CONTROL_REPORT',
        requesterCharId: requesterCharId || null,
        text,
        logClass
      }));
    } catch (e) {}
  }
}

/**
 * 운영자 명령어 (/모험가상시인원 <숫자>) 처리: 상시 접속 AI 인원 실시간 조정
 */
async function setConcurrentAICount(newMax, requesterCharId = null) {
  if (isRebuildingPool) {
    sendControlReport(requesterCharId, `⚠️ 현재 모험가 풀 재생성 작업이 진행 중입니다. 잠시 후 다시 시도해주세요.`, 'log-hit');
    return;
  }
  const poolLimit = Math.max(1, allAiDbRecords.length || AI_TOTAL_POOL);
  const parsed = Math.max(0, Math.min(poolLimit, Number(newMax) || 0));
  maxConcurrentAI = parsed;
  console.log(`⚡ [GM 상시인원 변경] 상시 로테이션 접속 인원을 ${maxConcurrentAI}명으로 조정합니다. (전체 풀: ${allAiDbRecords.length}명)`);
  await manageAgentRotation();
  sendControlReport(
    requesterCharId,
    `🤖 [GM 상시인원 조정 완료] 모험가 상시 접속 로테이션 인원이 ${maxConcurrentAI}명으로 즉시 변경되었습니다! (현재 접속 AI: ${activeAgents.length}명 / 전체 풀: ${allAiDbRecords.length}명)`,
    'log-kill'
  );
}

/**
 * 운영자 명령어 (/모험가생성 <숫자>) 처리: 기존 AI 전체 삭제 후 신규 생성 및 기본 50명 상시 로테이션 시작
 */
async function rebuildAIPool(newTotalCount = 600, defaultConcurrent = 100, requesterCharId = null) {
  if (isRebuildingPool) {
    sendControlReport(requesterCharId, `⚠️ 이미 모험가 생성 작업이 진행 중입니다. 완료될 때까지 잠시만 기다려주세요.`, 'log-hit');
    return;
  }
  isRebuildingPool = true;
  const targetTotal = Math.max(1, Math.min(1000, Number(newTotalCount) || 600));
  const targetConcurrent = Math.min(targetTotal, Math.max(1, Number(defaultConcurrent) || 100));

  try {
    console.log(`⚙️ [GM 모험가생성 시작] 기존 AI 에이전트 접속 종료 및 삭제 후 ${targetTotal}명 재생성을 시작합니다...`);
    const currentList = [...activeAgents];
    activeAgents = [];
    await Promise.all(currentList.map(ag => ag.logout(true)));

    allAiDbRecords = await resetAndReseedAICharacters(targetTotal);
    maxConcurrentAI = Math.min(allAiDbRecords.length, targetConcurrent);
    isFirstRotationWave = true;
    isRebuildingPool = false;

    await manageAgentRotation();
    console.log(`✔ [GM 모험가생성 완료] 총 ${allAiDbRecords.length}명 생성 완료 / 상시 로테이션 ${maxConcurrentAI}명 접속 가동!`);
    sendControlReport(
      requesterCharId,
      `✅ [GM 모험가생성 완료] 기존 에이전트 삭제 후 신규 모험가 ${allAiDbRecords.length}명(슬롯 ${AI_SLOT_START}~${AI_SLOT_START + allAiDbRecords.length - 1}) DB 생성이 완료되었습니다! (상시 로테이션 접속: ${maxConcurrentAI}명)`,
      'log-kill'
    );
  } catch (err) {
    isRebuildingPool = false;
    console.error('[-] 모험가 재생성 오류:', err.message);
    sendControlReport(
      requesterCharId,
      `❌ [GM 모험가생성 오류] 모험가 재생성 중 오류가 발생했습니다: ${err.message}`,
      'log-hit'
    );
  }
}

function connectRunnerControlSocket() {
  try {
    controlWs = new WebSocket(SERVER_WS_URL);
  } catch (e) {
    setTimeout(connectRunnerControlSocket, 3000);
    return;
  }

  controlWs.on('open', () => {
    try {
      controlWs.send(JSON.stringify({
        type: 'AI_RUNNER_CONTROL_REGISTER',
        totalPool: allAiDbRecords.length,
        maxConcurrentAI,
        activeCount: activeAgents.length
      }));
    } catch (e) {}
  });

  controlWs.on('message', async (raw) => {
    let msg = null;
    try {
      const str = Buffer.isBuffer(raw) ? raw.toString('utf8') : String(raw);
      msg = JSON.parse(str);
    } catch (e) {
      return;
    }
    if (!msg || msg.type !== 'ADMIN_AI_CONTROL') return;

    if (msg.action === 'SET_CONCURRENT') {
      await setConcurrentAICount(msg.concurrentCount, msg.requesterCharId);
    } else if (msg.action === 'REBUILD_POOL') {
      await rebuildAIPool(msg.totalCount || 600, msg.concurrentCount || 100, msg.requesterCharId);
    }
  });

  controlWs.on('close', () => {
    controlWs = null;
    setTimeout(connectRunnerControlSocket, 3000);
  });

  controlWs.on('error', () => {});
}

let runnerStarted = false;
async function startAIAgentRunner() {
  if (runnerStarted) return;
  runnerStarted = true;

  // 백그라운드 Redis -> Supabase 일괄 배치 동기화 워커 가동 (기본 3~4분 주기)
  startBatchSyncWorker(240000);

  await initGroqModel();
  allAiDbRecords = await ensure50AICharactersSeeded(AI_TOTAL_POOL);
  maxConcurrentAI = Math.min(allAiDbRecords.length, maxConcurrentAI);

  connectRunnerControlSocket();

  console.log(`🤖 [AI Agent Runner 가동] ${AI_ACCOUNT_EMAIL} 총 ${allAiDbRecords.length}명 풀(슬롯 ${AI_SLOT_START}~${AI_SLOT_START + allAiDbRecords.length - 1}) 중 동시접속 ${maxConcurrentAI}명 상시 유지 로테이션 가동! (파티 정원: ${MAX_PARTY_MEMBERS}명, Redis Lazy Sync 활성화)`);
  await manageAgentRotation();
  setInterval(manageAgentRotation, 5000);
}

if (require.main === module) {
  startAIAgentRunner();
}

module.exports = {
  WebSocket,
  startAIAgentRunner,
  setConcurrentAICount,
  rebuildAIPool,
  AIAgentClient
};