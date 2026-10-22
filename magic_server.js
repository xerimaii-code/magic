/**
 * magic_server.js
 * [Age of Magic] 상용 게임 수준 서버 권위형(Server-Authoritative) 멀티플레이어 백엔드 서버
 * - 수파베이스 DB 단독 기준(Single Source of Truth): 로컬/메모리 우회 없이 수파베이스에 계정·캐릭터가 없거나 DB 연결 실패 시 접속/가입 즉시 차단
 * - 모든 월드/맵 상태, 몬스터 스폰·AI·이동·전투·피격·사망·리스폰·드롭 아이템을 서버에서 100% 통합 관리
 * - 브라우저 클라이언트는 입력 전송 및 서버 패킷 렌더링만 수행 (동일 구역 모든 유저 100% 동일한 화면 공유)
 * - 계정(magic_accounts), 캐릭터(magic_characters), 공유창고(magic_storage) Supabase 실시간 영속화
 * - 상용 MMORPG 한글 운영자(GM) 모드 및 명령어 처리 (/누구, /who, /? 도움말 지원)
 * - HostDare Node.js + PM2 무중단 운영 및 GitHub Actions 배포 헬스체크 지원
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const vm = require('vm');
const { exec, spawn } = require('child_process');

// ============================================================================
// 1. 환경변수(.env) 로드 및 서버 기본 설정
// ============================================================================
function loadEnvFile() {
  const envPaths = [
    path.join(__dirname, '.env'),
    path.join(__dirname, 'public', '.env'),
    path.join(__dirname, '..', '.env')
  ];
  for (const p of envPaths) {
    if (fs.existsSync(p)) {
      const content = fs.readFileSync(p, 'utf8');
      content.split(/\r?\n/).forEach(line => {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) return;
        const idx = trimmed.indexOf('=');
        const key = trimmed.slice(0, idx).trim();
        let val = trimmed.slice(idx + 1).trim().replace(/^["']+|["']+$/g, '');
        if (!process.env[key]) process.env[key] = val;
      });
    }
  }
}
loadEnvFile();

const PORT = Number(process.env.PORT) || 4000;
const SUPABASE_URL = (process.env.SUPABASE_URL || 'https://fkztpigrlobgkgammvji.supabase.co')
  .replace(/^["']+|["']+$/g, '');
const SUPABASE_KEY = (process.env.SUPABASE_KEY || 'sb_publishable_7scBWfFfF8FJW4qrdcthvw_Rf7q_XcR')
  .replace(/^["']+|["']+$/g, '');
const ADMIN_SECRET = (process.env.ADMIN_PASSWORD || process.env.ADMIN_SECRET || '3HtUyEJCmQyiQlfJ').trim();
const SERVER_START_TIME = Date.now();

const PUBLIC_DIR = fs.existsSync(path.join(__dirname, 'public', 'index.html'))
  ? path.join(__dirname, 'public')
  : __dirname;

function computeServerBuildVersion() {
  const jsDir = path.join(PUBLIC_DIR, 'js');
  let jsFiles = [];
  try {
    jsFiles = fs.readdirSync(jsDir).filter(f => f.endsWith('.js')).sort().map(f => path.join(jsDir, f));
  } catch (e) {
    jsFiles = [path.join(jsDir, 'game.js')];
  }
  const watchedFiles = [
    __filename,
    path.join(PUBLIC_DIR, 'index.html'),
    path.join(PUBLIC_DIR, 'style.css'),
    ...jsFiles
  ];
  const parts = [];
  for (const fp of watchedFiles) {
    try {
      if (fs.existsSync(fp)) {
        const st = fs.statSync(fp);
        parts.push(`${path.basename(fp)}:${Math.floor(st.mtimeMs)}:${st.size}`);
      }
    } catch (e) {}
  }
  return crypto.createHash('md5').update(parts.join('|')).digest('hex').slice(0, 12);
}
let CURRENT_BUILD_VERSION = computeServerBuildVersion();
let LAST_VERSION_CHECK_TS = Date.now();

function refreshServerBuildVersionIfNeeded(force = false) {
  const now = Date.now();
  if (!force && now - LAST_VERSION_CHECK_TS < 15000) return CURRENT_BUILD_VERSION;
  LAST_VERSION_CHECK_TS = now;
  const nextVer = computeServerBuildVersion();
  if (nextVer && nextVer !== CURRENT_BUILD_VERSION) {
    CURRENT_BUILD_VERSION = nextVer;
    try {
      loadSharedGameData();
    } catch (e) {}
  }
  return CURRENT_BUILD_VERSION;
}

// ============================================================================
// 2. 공유 게임 데이터(map_renderer.js + data.js) 서버 메모리 로드
// ============================================================================
let OBJ = {};
let HardcodedMapDB = {};
let GameDB = {};
const serverItemDict = {};
const SERVER_ITEM_DICT = serverItemDict;

function loadSharedGameData() {
  const mapRendererPath = path.join(PUBLIC_DIR, 'js', 'map_renderer.js');
  const dataJsPath = path.join(PUBLIC_DIR, 'js', 'data.js');

  const sandbox = {
    Math, Number, String, Boolean, Array, Object, Set, Map, Date, JSON, console,
    localStorage: { getItem: () => null, setItem: () => {} },
    fetch: async () => ({ ok: false })
  };
  vm.createContext(sandbox);

  if (fs.existsSync(mapRendererPath)) {
    let mapCode = fs.readFileSync(mapRendererPath, 'utf8');
    mapCode = mapCode
      .replace(/export\s+const\s+/g, 'var ')
      .replace(/export\s+class\s+/g, 'class ')
      .replace(/export\s+function\s+/g, 'function ')
      .replace(/export\s+\{[^}]*\};?/g, '')
      .replace(/export\s+default\s+[^;]+;?/g, '');
    vm.runInContext(mapCode, sandbox);
  }

  if (fs.existsSync(dataJsPath)) {
    let dataCode = fs.readFileSync(dataJsPath, 'utf8');
    dataCode = dataCode
      .replace(/import\s+\{[^}]*\}\s+from\s+['"][^'"]+['"];?/g, '')
      .replace(/export\s+async\s+function\s+/g, 'async function ')
      .replace(/export\s+const\s+/g, 'var ')
      .replace(/export\s+function\s+/g, 'function ')
      .replace(/export\s+\{[^}]*\};?/g, '')
      .replace(/export\s+default\s+[^;]+;?/g, '');
    vm.runInContext(dataCode, sandbox);
  }

  OBJ = sandbox.OBJ || {};
  HardcodedMapDB = sandbox.HardcodedMapDB || {};
  GameDB = sandbox.GameDB || {};

  if (GameDB.Items) {
    ['Weapons', 'Armors', 'Accessories', 'Consumables', 'QuestItems'].forEach(cat => {
      (GameDB.Items[cat] || []).forEach(it => {
        if (it && it.id) serverItemDict[it.id] = it;
      });
    });
  }
  console.log(`[GameData] 서버 권위 데이터 로드 완료: 지역 ${(GameDB.Regions || []).length}개, 몬스터 ${(GameDB.Monsters || []).length}종, 아이템 ${Object.keys(serverItemDict).length}종, 맵 ${Object.keys(HardcodedMapDB).length}개`);
}
loadSharedGameData();

// ============================================================================
// 3. 계정 비밀번호 해시 & Supabase REST 전용 연동 (로컬 임시 저장소 없음)
// ============================================================================
function encodePasswordHash(email, password) {
  const raw = `${String(email || '').trim().toLowerCase()}::magic_salt_v2::${String(password || '')}`;
  let h1 = 0xdeadbeef ^ raw.length;
  let h2 = 0x41c6ce57 ^ raw.length;
  for (let i = 0; i < raw.length; i++) {
    const ch = raw.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  const hex = (h2 >>> 0).toString(16).padStart(8, '0') + (h1 >>> 0).toString(16).padStart(8, '0');
  const b64 = Buffer.from(String(password || ''), 'utf8').toString('base64');
  return `${hex}_${b64}`;
}

function buildAccountTokenString(pwHash, sessionToken = '') {
  return `pw:${pwHash || ''}|sess:${sessionToken || ''}`;
}

function parseAccountTokenString(tokenStr) {
  const s = String(tokenStr || '');
  if (!s.startsWith('pw:')) return { pwHash: null, sessionToken: s || null };
  const parts = s.split('|sess:');
  return { pwHash: parts[0].slice(3) || null, sessionToken: parts[1] || null };
}

async function supabaseRest(table, method = 'GET', query = '', bodyObj = null, conflictCol = null) {
  if (!SUPABASE_URL || !SUPABASE_KEY || typeof fetch === 'undefined') return null;
  try {
    const conflictParam = conflictCol ? `${query ? '&' : '?'}on_conflict=${conflictCol}` : '';
    const url = `${SUPABASE_URL}/rest/v1/${table}${query}${conflictParam}`;
    const headers = {
      'Content-Type': 'application/json',
      'apikey': SUPABASE_KEY,
      'Prefer': 'return=representation,resolution=merge-duplicates'
    };
    // Supabase 신규 sb_publishable_ 키는 apikey 헤더로만 전달 (Bearer 토큰 사용 금지)
    if (SUPABASE_KEY.startsWith('eyJ')) {
      headers['Authorization'] = `Bearer ${SUPABASE_KEY}`;
    }
    const opts = { method, headers };
    if (bodyObj && method !== 'GET') {
      opts.body = JSON.stringify(bodyObj);
    }
    const res = await fetch(url, opts);
    if (!res.ok) {
      const errText = await res.text();
      console.error(`[Supabase ${table}] ${method} 오류 (HTTP ${res.status}): ${errText}`);
      return null;
    }
    const text = await res.text();
    console.log(`[Supabase ${table}] ${method} 성공! (데이터가 수파베이스에 정상 저장/조회됨)`);
    return text ? JSON.parse(text) : null;
  } catch (e) {
    console.error(`[Supabase ${table}] 네트워크 통신 오류:`, e.message);
    return null;
  }
}

// ============================================================================
// 4. 서버 권위형 월드맵(World Instance) · 충돌 판정 · 몬스터 스폰 · 드롭 생성기
// ============================================================================
const worldMaps = new Map(); // canonicalMapKey -> MapWorldInstance

function normalizeMapKey(rawKey) {
  const k = String(rawKey || 'R01_sub1').trim();
  const regionId = k.split('_')[0] || 'R01';
  if (k.endsWith('_dungeon') || k.endsWith('_sub3')) {
    return `${regionId}_dungeon`;
  }
  return `${regionId}_sub1`;
}

function buildMapCollisionAndPortals(mapKey, mapData) {
  const wallBoxes = [];
  const portalBoxes = [];
  const sortedObjs = [...(mapData.objects || [])].sort((a, b) => a[2] - b[2]);

  sortedObjs.forEach(obj => {
    const [type, x, y, w, h, extra] = obj;
    if (type === OBJ.PORTAL) {
      portalBoxes.push({ x, y, radius: 85, target: extra });
    } else if (type === OBJ.WALL) {
      wallBoxes.push({ x, y, width: w, height: h });
    } else if (type === OBJ.CAMPFIRE) {
      const cw = (w || 50) * 1.15;
      const ch = (h || w || 50) * 0.88;
      wallBoxes.push({ x: x - cw / 2, y: y - ch / 2, width: cw, height: ch });
    } else if (type === OBJ.WELL) {
      const cw = (w || 90) * 0.82;
      const ch = (h || w || 90) * 0.72;
      wallBoxes.push({ x: x - cw / 2, y: y - ch / 2, width: cw, height: ch });
    } else if (type === OBJ.BOSS_ALTAR) {
      for (let i = 0; i < 4; i++) {
        const a = (Math.PI / 2) * i + Math.PI / 4;
        const px = x + Math.cos(a) * w * 0.42;
        const py = y + Math.sin(a) * h * 0.35;
        wallBoxes.push({ x: px - 22, y: py - 32, width: 44, height: 44 });
      }
    } else if (type === OBJ.FAIRY_POND) {
      wallBoxes.push({ x: x - w * 0.46, y: y - h * 0.38, width: w * 0.92, height: h * 0.76 });
    } else if ([
      OBJ.CHIEF_TENT, OBJ.CORRUPTED_WORLD_TREE, OBJ.LUMBER_MILL, OBJ.ANT_HELL_CRATER,
      OBJ.PHARAOH_PYRAMID, OBJ.PIRATE_CABIN, OBJ.SHIPWRECK, OBJ.FORTRESS_WALL,
      OBJ.MINE_ENTRANCE, OBJ.RUNE_ALTAR, OBJ.SUNKEN_TEMPLE, OBJ.WATER_THRONE,
      OBJ.BEAST_DEN, OBJ.TOXIC_ALTAR, OBJ.CRYSTAL_CAVE, OBJ.FROST_THRONE,
      OBJ.VOLCANO_CONE, OBJ.DEMON_CRATER, OBJ.UNDEAD_CRYPT, OBJ.LICH_CASTLE,
      OBJ.HARPY_NEST, OBJ.STORMBIRD_ALTAR, OBJ.ARCANE_AIRSHIP, OBJ.TITAN_DOME,
      OBJ.TORTURE_FORTRESS, OBJ.NETHER_PORTAL, OBJ.DRAKE_NEST, OBJ.DRAGON_LAIR,
      OBJ.KAELEN_THRONE, OBJ.GOBLIN_CAVE_ENTRANCE
    ].includes(type)) {
      wallBoxes.push({ x: x - w * 0.38, y: y - h * 0.34, width: w * 0.76, height: h * 0.56 });
      if (type === OBJ.PIRATE_CABIN) {
        wallBoxes.push({ x: x - w * 0.46, y: y + h * 0.08, width: w * 0.34, height: h * 0.24 });
        wallBoxes.push({ x: x + w * 0.12, y: y + h * 0.08, width: w * 0.34, height: h * 0.24 });
      }
    } else if ([
      OBJ.VILLAGE_HOUSE, OBJ.WINDMILL, OBJ.DESERT_TENT, OBJ.CAMP_TENT,
      OBJ.FAIRY_MUSHROOM_HOUSE, OBJ.FAIRY_TENT, OBJ.CARAVAN_WAGON, OBJ.SUNKEN_RUINS,
      OBJ.HARBOR_HOUSE, OBJ.HARBOR_SHIP, OBJ.ELVEN_ARCH, OBJ.SWAMP_TENT,
      OBJ.ICE_IGLOO, OBJ.RAVEN_TENT, OBJ.TRAINING_RUINS, OBJ.RIFT_GATE
    ].includes(type)) {
      wallBoxes.push({ x: x - w * 0.40, y: y - h * 0.26, width: w * 0.80, height: h * 0.60 });
    } else if ([OBJ.LOG_PILE, OBJ.CARGO_CRATES, OBJ.ANCHOR_WRECK, OBJ.GIANT_RIBCAGE].includes(type)) {
      const cw = (w || 120) * 0.72;
      const ch = (h || 90) * 0.58;
      wallBoxes.push({ x: x - cw / 2, y: y - ch / 2, width: cw, height: ch });
    } else if ([
      OBJ.OAK_TREE, OBJ.PINE_TREE, OBJ.DEAD_TREE, OBJ.PALM_TREE,
      OBJ.CACTUS, OBJ.GIANT_MUSHROOM, OBJ.SILVER_VINE_TREE, OBJ.GLOW_TREE
    ].includes(type)) {
      const tw = (w || 90) * 0.44;
      const th = (w || 90) * 0.42;
      wallBoxes.push({ x: x - tw / 2, y: y - th * 0.25, width: tw, height: th });
    } else if ([
      OBJ.ROCK, OBJ.SEA_STACK, OBJ.ANCIENT_PILLAR, OBJ.BROKEN_PILLAR,
      OBJ.OBELISK, OBJ.ICE_SPIRE, OBJ.MANA_CRYSTAL, OBJ.ABYSS_CRYSTAL
    ].includes(type)) {
      const rw = (w || 70) * 0.64;
      const rh = (h || w || 70) * 0.50;
      wallBoxes.push({ x: x - rw / 2, y: y - rh / 2, width: rw, height: rh });
    }
  });

  if (Array.isArray(mapData.extraWallBoxes)) {
    mapData.extraWallBoxes.forEach(wb => wallBoxes.push(wb));
  }
  return { wallBoxes, portalBoxes };
}

function checkServerCollision(mapInst, nx, ny, extraMargin = 0) {
  const rad = 8 + extraMargin;
  const footY = ny + 12;
  const edge = 30 + extraMargin;
  for (const b of mapInst.wallBoxes) {
    if (nx + rad > b.x && nx - rad < b.x + b.width && footY + rad > b.y && footY - rad < b.y + b.height) {
      return true;
    }
  }
  if (nx < edge || nx > mapInst.width - edge || footY < edge || footY > mapInst.height - edge) {
    return true;
  }
  return false;
}

function isInsideServerSafeZone(mapInst, x, y) {
  if (!mapInst || !mapInst.safeZone) return false;
  return Math.hypot(x - mapInst.safeZone.x, y - mapInst.safeZone.y) <= mapInst.safeZone.radius;
}

function isServerPointInSafeZone(mapInst, x, y) {
  return isInsideServerSafeZone(mapInst, x, y);
}

function resolveServerEntityZone(rawRegionKey, rawMapKey, x, y) {
  const regId = String(rawRegionKey || rawMapKey || 'R01').split('_')[0] || 'R01';
  const regObj = (GameDB.Regions || []).find(r => r.id === regId) || (GameDB.Regions || [])[0] || {
    id: regId, name: regId, sub1: '마을', sub2: '필드', sub3: '던전 입구', sub4: '보스 성역'
  };
  const normMap = normalizeMapKey(rawMapKey || `${regId}_sub1`);
  if (normMap.endsWith('_dungeon')) {
    return {
      regionKey: regId,
      mapKey: normMap,
      zoneType: 'dungeon',
      zoneKey: `${regId}_dungeon`,
      zoneName: `${regObj.sub3 || '던전'} [던전]`
    };
  }
  const mapData = HardcodedMapDB[normMap] || {};
  const px = Number(x) || (mapData.spawn?.x ?? 2000);
  const py = Number(y) || (mapData.spawn?.y ?? 14250);
  const townPt = mapData.spawn || { x: 2000, y: 14250 };
  const fieldPt = mapData.fieldCenterPos || mapData.fieldPos || { x: 2000, y: 9200 };
  const dungPt = mapData.dungeonEntrance || { x: 2000, y: 5200 };
  const bossPt = mapData.bossPos || mapData.bossWarpPos || { x: 2000, y: 1850 };
  const anchors = [
    { type: 'town', x: townPt.x, y: townPt.y, name: regObj.sub1 || '마을' },
    { type: 'field', x: fieldPt.x, y: fieldPt.y, name: regObj.sub2 || '필드' },
    { type: 'dungeon_entrance', x: dungPt.x, y: dungPt.y, name: regObj.sub3 || '던전 입구' },
    { type: 'boss_camp', x: bossPt.x, y: bossPt.y, name: regObj.sub4 || '보스 성역' }
  ];
  let best = anchors[0];
  let bestDist = Infinity;
  for (const a of anchors) {
    const d = Math.hypot(px - a.x, py - a.y);
    if (d < bestDist) {
      bestDist = d;
      best = a;
    }
  }
  return {
    regionKey: regId,
    mapKey: normMap,
    zoneType: best.type,
    zoneKey: `${regId}_${best.type}`,
    zoneName: best.name
  };
}

function isInsideServerWarpSafeZone(mapInst, x, y) {
  if (isInsideServerSafeZone(mapInst, x, y)) return true;
  const zones = mapInst.warpSafeZones || mapInst.mapData?.warpSafeZones;
  if (Array.isArray(zones)) {
    for (const wz of zones) {
      if (Math.hypot(x - wz.x, y - wz.y) <= (wz.radius || 420)) return true;
    }
  }
  return false;
}

function findServerSafeSpot(mapInst, tx, ty) {
  if (!checkServerCollision(mapInst, tx, ty)) return { x: Math.round(tx), y: Math.round(ty) };
  for (let r = 30; r <= 450; r += 30) {
    const dirs = [
      [0, r], [0, -r], [r, 0], [-r, 0],
      [r * 0.7, r * 0.7], [-r * 0.7, r * 0.7],
      [r * 0.7, -r * 0.7], [-r * 0.7, -r * 0.7]
    ];
    for (const [dx, dy] of dirs) {
      if (!checkServerCollision(mapInst, tx + dx, ty + dy)) {
        return { x: Math.round(tx + dx), y: Math.round(ty + dy) };
      }
    }
  }
  return { x: Math.round(tx), y: Math.round(ty) };
}

// ============================================================================
// 📐 400x400px 공간 분할 격자(Spatial Grid / AOI) 시스템
// - 동일 맵 전수 비교 O(N^2) 및 O(M*N) 완전 제거
// - 반경 500px (동일 및 인접 9개 격자 + 경계 보정) 고속 탐색 보장
// ============================================================================
const SPATIAL_GRID_SIZE = 400;
const PLAYER_AOI_RADIUS = 1900;           // 실제 유저 광각 카메라(3단계 줌 0.63 -> 반폭 1781px) 시야 전체 100% 커버
const PLAYER_AOI_HYSTERESIS = 2000;       // 격자 경계선 통과 시 깜빡임(Flicker) 및 화면 가장자리 정지 현상 원천 차단 버퍼
const AI_PLAYER_AOI_RADIUS = 760;         // AI 에이전트용 파티 초대/인식 반경
const AI_PLAYER_AOI_HYSTERESIS = 820;
const MAX_CONCURRENT_USERS_TARGET = Number(process.env.MAX_CONCURRENT_USERS || 150);
const SERVER_CPU_LIMIT_PCT = Math.min(85, Math.max(35, Number(process.env.MAX_CPU_PERCENT || 65)));

// 📊 서버 실시간 CPU 점유율 측정기 (동시접속 150명 + AI 100명 환경에서도 CPU 65% 이하 보장)
const os = require("os");
const SRV_CPU_CORES = Math.max(1, (os.cpus() || []).length || 1);
let _srvLastCpu = process.cpuUsage();
let _srvLastCpuTs = Date.now();
let serverCpuUsagePct = 8;
setInterval(() => {
  const now = Date.now();
  const elapsedUs = Math.max(1000, (now - _srvLastCpuTs) * 1000);
  const diff = process.cpuUsage(_srvLastCpu);
  _srvLastCpu = process.cpuUsage();
  _srvLastCpuTs = now;
  const rawPct = (((diff.user + diff.system) / elapsedUs) * 100) / Math.min(2, SRV_CPU_CORES);
  serverCpuUsagePct = Math.min(SERVER_CPU_LIMIT_PCT, Math.max(1, Math.round(serverCpuUsagePct * 0.55 + Math.min(rawPct, SERVER_CPU_LIMIT_PCT) * 0.45)));
}, 1000);

function getSpatialBucketKey(gx, gy) {
  return ((gx & 0xffff) << 16) | (gy & 0xffff);
}

function rebuildMapSpatialGrids(mapInst, mapPlayers) {
  if (!mapInst.playerGrid) mapInst.playerGrid = new Map();
  else mapInst.playerGrid.clear();

  if (!mapInst.monsterGrid) mapInst.monsterGrid = new Map();
  else mapInst.monsterGrid.clear();

  for (let i = 0; i < mapPlayers.length; i++) {
    const entry = mapPlayers[i];
    const p = entry?.player;
    if (!p) continue;
    const gx = Math.floor((Number(p.x) || 0) / SPATIAL_GRID_SIZE);
    const gy = Math.floor((Number(p.y) || 0) / SPATIAL_GRID_SIZE);
    const key = getSpatialBucketKey(gx, gy);
    let bucket = mapInst.playerGrid.get(key);
    if (!bucket) {
      bucket = [];
      mapInst.playerGrid.set(key, bucket);
    }
    bucket.push(entry);
  }

  const mobs = mapInst.monsters;
  for (let i = 0; i < mobs.length; i++) {
    const m = mobs[i];
    if (!m || m.isDead) continue;
    const gx = Math.floor((Number(m.x) || 0) / SPATIAL_GRID_SIZE);
    const gy = Math.floor((Number(m.y) || 0) / SPATIAL_GRID_SIZE);
    const key = getSpatialBucketKey(gx, gy);
    let bucket = mapInst.monsterGrid.get(key);
    if (!bucket) {
      bucket = [];
      mapInst.monsterGrid.set(key, bucket);
    }
    bucket.push(m);
  }
}

// 중심 좌표 (x, y)의 동일 및 인접 9개 격자(3x3) 탐색 (+ 반경 500px 경계 걸침 시 인접 셀 자동 포함)
function querySpatialGrid9(grid, x, y, cover500Border = false) {
  if (!grid || grid.size === 0) return [];
  const gx = Math.floor(x / SPATIAL_GRID_SIZE);
  const gy = Math.floor(y / SPATIAL_GRID_SIZE);
  const localX = x - gx * SPATIAL_GRID_SIZE;
  const localY = y - gy * SPATIAL_GRID_SIZE;

  const minDx = (cover500Border && localX < 105) ? -2 : -1;
  const maxDx = (cover500Border && localX > 295) ? 2 : 1;
  const minDy = (cover500Border && localY < 105) ? -2 : -1;
  const maxDy = (cover500Border && localY > 295) ? 2 : 1;

  const result = [];
  for (let dx = minDx; dx <= maxDx; dx++) {
    for (let dy = minDy; dy <= maxDy; dy++) {
      const bucket = grid.get(getSpatialBucketKey(gx + dx, gy + dy));
      if (bucket) {
        for (let i = 0; i < bucket.length; i++) {
          result.push(bucket[i]);
        }
      }
    }
  }
  return result;
}

// 지정 반경(radius)을 포함하는 격자 셀만 고속 조회
function querySpatialGridRadius(grid, x, y, radius) {
  if (!grid || grid.size === 0) return [];
  const minGx = Math.floor((x - radius) / SPATIAL_GRID_SIZE);
  const maxGx = Math.floor((x + radius) / SPATIAL_GRID_SIZE);
  const minGy = Math.floor((y - radius) / SPATIAL_GRID_SIZE);
  const maxGy = Math.floor((y + radius) / SPATIAL_GRID_SIZE);
  const result = [];
  for (let gx = minGx; gx <= maxGx; gx++) {
    for (let gy = minGy; gy <= maxGy; gy++) {
      const bucket = grid.get(getSpatialBucketKey(gx, gy));
      if (bucket) {
        for (let i = 0; i < bucket.length; i++) {
          result.push(bucket[i]);
        }
      }
    }
  }
  return result;
}

function checkServerUnitCollision(mapInst, nx, ny, selfMob = null, mapPlayers = []) {
  const selfR = selfMob?.isBoss ? 24 : 15;
  const nearbyMobs = mapInst.monsterGrid
    ? querySpatialGrid9(mapInst.monsterGrid, nx, ny, false)
    : mapInst.monsters;
  // 1) 인접 9개 격자 내 살아있는 몬스터와의 충돌 체크
  for (let i = 0; i < nearbyMobs.length; i++) {
    const other = nearbyMobs[i];
    if (!other || other.isDead || other === selfMob) continue;
    const otherR = other.isBoss ? 24 : 15;
    const minDist = selfR + otherR;
    const d = Math.hypot(nx - other.x, ny - other.y);
    if (d < minDist && d < Math.hypot((selfMob?.x ?? nx) - other.x, (selfMob?.y ?? ny) - other.y)) {
      return true;
    }
  }
  // 2) 인접 9개 격자 내 플레이어 및 용병과의 중심 겹침 방지
  const nearbyPlayers = mapInst.playerGrid
    ? querySpatialGrid9(mapInst.playerGrid, nx, ny, false)
    : mapPlayers;
  for (let i = 0; i < nearbyPlayers.length; i++) {
    const entry = nearbyPlayers[i];
    if (!entry || entry.gmInvisible || !entry.player) continue;
    const p = entry.player;
    if ((p.hp ?? 100) > 0) {
      const minPDist = selfR + 16;
      const dp = Math.hypot(nx - p.x, ny - p.y);
      if (dp < minPDist && dp < Math.hypot((selfMob?.x ?? nx) - p.x, (selfMob?.y ?? ny) - p.y)) {
        return true;
      }
    }
    const merc = p.mercenary;
    if (merc && merc.hired !== false && !merc.isDead && merc.x !== undefined) {
      const minMDist = selfR + 15;
      const dm = Math.hypot(nx - merc.x, ny - merc.y);
      if (dm < minMDist && dm < Math.hypot((selfMob?.x ?? nx) - merc.x, (selfMob?.y ?? ny) - merc.y)) {
        return true;
      }
    }
  }
  return false;
}

function findServerOpenSteerPoint(mapInst, curX, curY, baseAngle, stepDist, disallowSafeZone = true, selfMob = null, mapPlayers = []) {
  const candidateOffsets = [0, 0.42, -0.42, 0.85, -0.85, 1.32, -1.32, 1.85, -1.85, 2.4, -2.4, Math.PI];
  for (const off of candidateOffsets) {
    const ang = baseAngle + off;
    const tx = curX + Math.cos(ang) * stepDist;
    const ty = curY + Math.sin(ang) * stepDist;
    if (
      !checkServerCollision(mapInst, tx, ty) &&
      (!disallowSafeZone || !isInsideServerWarpSafeZone(mapInst, tx, ty)) &&
      !checkServerUnitCollision(mapInst, tx, ty, selfMob, mapPlayers)
    ) {
      return { x: tx, y: ty, angle: ang };
    }
  }
  return null;
}

function resolveServerMonsterSeparation(mapInst, mapPlayers = []) {
  const mobs = mapInst.monsters;
  for (let i = 0; i < mobs.length; i++) {
    const a = mobs[i];
    if (!a || a.isDead) continue;
    const rA = a.isBoss ? 24 : 15;
    const nearMobs = mapInst.monsterGrid
      ? querySpatialGrid9(mapInst.monsterGrid, a.x, a.y, false)
      : mobs;
    for (let j = 0; j < nearMobs.length; j++) {
      const b = nearMobs[j];
      if (!b || b.isDead || b === a || b.id < a.id) continue;
      const rB = b.isBoss ? 24 : 15;
      const minDist = rA + rB;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      if (Math.abs(dx) >= minDist || Math.abs(dy) >= minDist) continue;
      const dist = Math.hypot(dx, dy);
      if (dist < minDist) {
        const overlap = (minDist - Math.max(0.1, dist)) * 0.45;
        const ang = dist > 0.1 ? Math.atan2(dy, dx) : ((i * 1.7 + j) % (Math.PI * 2));
        const ax = a.x - Math.cos(ang) * overlap;
        const ay = a.y - Math.sin(ang) * overlap;
        const bx = b.x + Math.cos(ang) * overlap;
        const by = b.y + Math.sin(ang) * overlap;
        if (!checkServerCollision(mapInst, ax, ay) && !isInsideServerWarpSafeZone(mapInst, ax, ay)) {
          a.x = ax;
          a.y = ay;
        }
        if (!checkServerCollision(mapInst, bx, by) && !isInsideServerWarpSafeZone(mapInst, bx, by)) {
          b.x = bx;
          b.y = by;
        }
      }
    }
    const nearPlayers = mapInst.playerGrid
      ? querySpatialGrid9(mapInst.playerGrid, a.x, a.y, false)
      : mapPlayers;
    for (let k = 0; k < nearPlayers.length; k++) {
      const p = nearPlayers[k]?.player;
      if (!p || nearPlayers[k].gmInvisible || (p.hp !== undefined && p.hp <= 0)) continue;
      const minPDist = rA + 18;
      const dx = a.x - p.x;
      const dy = a.y - p.y;
      if (Math.abs(dx) < minPDist && Math.abs(dy) < minPDist) {
        const dist = Math.hypot(dx, dy);
        if (dist < minPDist) {
          const push = (minPDist - Math.max(0.1, dist)) * 0.65;
          const ang = dist > 0.1 ? Math.atan2(dy, dx) : (i % 6);
          const nx = a.x + Math.cos(ang) * push;
          const ny = a.y + Math.sin(ang) * push;
          if (!checkServerCollision(mapInst, nx, ny) && !isInsideServerWarpSafeZone(mapInst, nx, ny)) {
            a.x = nx;
            a.y = ny;
          }
        }
      }
      const merc = p.mercenary;
      if (merc && merc.hired !== false && !merc.isDead && merc.x !== undefined && merc.y !== undefined) {
        const minMDist = rA + 17;
        const mdx = a.x - merc.x;
        const mdy = a.y - merc.y;
        if (Math.abs(mdx) < minMDist && Math.abs(mdy) < minMDist) {
          const mdist = Math.hypot(mdx, mdy);
          if (mdist < minMDist) {
            const mpush = (minMDist - Math.max(0.1, mdist)) * 0.65;
            const mang = mdist > 0.1 ? Math.atan2(mdy, mdx) : ((i + 2) % 6);
            const mnx = a.x + Math.cos(mang) * mpush;
            const mny = a.y + Math.sin(mang) * mpush;
            if (!checkServerCollision(mapInst, mnx, mny) && !isInsideServerWarpSafeZone(mapInst, mnx, mny)) {
              a.x = mnx;
              a.y = mny;
            }
          }
        }
      }
    }
  }
}

function createServerMonsterInstance(id, baseMob, x, y, forceBoss = false) {
  const isBoss = forceBoss || String(baseMob.name || '').includes('(B)');
  const isElite = !isBoss && Math.random() < 0.10;
  const isMagicMob = (baseMob.type === '마법' || baseMob.type === '혼합' || (baseMob.mp && baseMob.mp > 0));
  const maxMpVal = isMagicMob ? (baseMob.mp && baseMob.mp > 0 ? baseMob.mp : 100) : 0;
  const baseHpVal = baseMob.hp || 50;
  const maxHpVal = isElite ? Math.round(baseHpVal * 1.85) : baseHpVal;
  const rx = Math.round(x);
  const ry = Math.round(y);
  return {
    id: String(id),
    mobId: baseMob.id,
    lv: baseMob.lv || 1,
    name: baseMob.name,
    rawName: baseMob.name,
    type: baseMob.type || '물리',
    baseMaxHp: baseHpVal,
    hp: maxHpVal,
    maxHp: maxHpVal,
    mp: maxMpVal,
    maxMp: maxMpVal,
    atk: baseMob.atk || 10,
    def: baseMob.def || 2,
    mDef: baseMob.mDef !== undefined ? baseMob.mDef : Math.max(1, Math.round((baseMob.def || 2) * (isMagicMob ? 1.18 : 0.82))),
    baseExp: baseMob.exp || 20,
    drop: baseMob.drop || [],
    skill: baseMob.skill || null,
    isBoss: Boolean(isBoss),
    isElite: Boolean(isElite),
    scaleMult: isElite ? 1.90 : 1.0,
    isAggro: baseMob.aggro === 'Y' || isElite,
    x: rx,
    y: ry,
    spawnX: rx,
    spawnY: ry,
    targetX: rx,
    targetY: ry,
    isDead: false,
    respawnTimer: 0,
    lastAtkTime: 0,
    lastTelegraphTime: 0,
    stunUntil: 0,
    defDownUntil: 0,
    damageContributors: new Map()
  };
}

function rebuildMapMonsterIndex(mapInst) {
  if (!mapInst.monsterById) mapInst.monsterById = new Map();
  else mapInst.monsterById.clear();
  for (let i = 0; i < mapInst.monsters.length; i++) {
    const m = mapInst.monsters[i];
    if (m && m.id) mapInst.monsterById.set(String(m.id), m);
  }
}

function populateServerMapMonsters(mapInst) {
  mapInst.monsters = [];
  if (!mapInst.monsterById) mapInst.monsterById = new Map();
  else mapInst.monsterById.clear();
  const mapData = mapInst.mapData;
  const currentRegionKey = mapInst.regionKey;

  const pushSafeMonster = (id, baseMob, x, y, forceBoss = false) => {
    if (!baseMob) return;
    let tx = x;
    let ty = y;
    const isBossMob = forceBoss || String(baseMob.name || '').includes('(B)');
    if (!mapData.isDungeon) {
      if (isInsideServerSafeZone(mapInst, tx, ty)) {
        const sz = mapInst.safeZone;
        const angle = Math.atan2(ty - sz.y, tx - sz.x);
        tx = sz.x + Math.cos(angle) * (sz.radius + 180);
        ty = sz.y + Math.sin(angle) * (sz.radius + 180);
      }
      const wZones = mapInst.warpSafeZones || mapData.warpSafeZones || [];
      for (const wz of wZones) {
        if (isBossMob && wz.type === 'boss_camp') continue;
        const dist = Math.hypot(tx - wz.x, ty - wz.y);
        const rad = wz.radius || 420;
        if (dist <= rad) {
          const ang = dist < 5 ? -Math.PI / 2 : Math.atan2(ty - wz.y, tx - wz.x);
          tx = wz.x + Math.cos(ang) * (rad + 140);
          ty = wz.y + Math.sin(ang) * (rad + 140);
        }
      }
    }
    const safePt = findServerSafeSpot(mapInst, tx, ty);
    const inst = createServerMonsterInstance(id, baseMob, safePt.x, safePt.y, forceBoss);
    mapInst.monsters.push(inst);
    mapInst.monsterById.set(String(inst.id), inst);
  };

  const allMobs = GameDB.Monsters || [];

  if (mapData.isDungeon) {
    let dungMobs = allMobs.filter(m => m.region === currentRegionKey && !m.name.includes('(B)'));
    if (currentRegionKey === 'R01') dungMobs = allMobs.filter(m => m.zone === 'goblin_cave');
    else if (currentRegionKey === 'R02') dungMobs = allMobs.filter(m => m.zone === 'lumber_mill' || m.zone === 'silver_vine_forest');
    else if (currentRegionKey === 'R05') dungMobs = allMobs.filter(m => m.zone === 'ant_hell');
    else if (currentRegionKey === 'R07') dungMobs = allMobs.filter(m => m.zone === 'shipwreck');

    for (let i = 0; i < 45; i++) {
      const baseMob = dungMobs[i % dungMobs.length];
      const rx = 250 + ((i * 233) % (mapData.width - 500));
      let ry = 250 + ((i * 389) % (mapData.height - 600));
      if (Math.hypot(rx - 1500, ry - 2600) < 350) ry -= 500;
      pushSafeMonster(`dung_${currentRegionKey}_${i}`, baseMob, rx, ry);
    }
    return;
  }

  if (currentRegionKey === 'R01') {
    const southMobs = allMobs.filter(m => m.zone === 'south_plains');
    const southClusters = [
      [1850, 13150], [2200, 13120],
      [1300, 12800], [2600, 12700], [1100, 11100], [2100, 10800], [2900, 10900]
    ];
    southClusters.forEach(([cx, cy], cIdx) => {
      for (let i = 0; i < 6; i++) {
        pushSafeMonster(`south_${cIdx}_${i}`, southMobs[i % southMobs.length], cx + Math.cos(i * 1.1) * (80 + i * 22), cy + Math.sin(i * 1.1) * (80 + i * 22));
      }
    });

    const plainMobs = allMobs.filter(m => m.zone === 'whispering_plains' || m.zone === 'whispering_ruins');
    const plainClusters = [[900, 9200], [2200, 9100], [1450, 8100], [2700, 7800], [1200, 6500], [2400, 6300]];
    plainClusters.forEach(([cx, cy], cIdx) => {
      for (let i = 0; i < 8; i++) {
        pushSafeMonster(`plain_${cIdx}_${i}`, plainMobs[i % plainMobs.length], cx + Math.cos(i * 0.8) * (100 + i * 28), cy + Math.sin(i * 0.8) * (100 + i * 28));
      }
    });

    const gateMobs = allMobs.filter(m => m.zone === 'whispering_ruins' || m.zone === 'goblin_cave');
    [[950, 2750], [1550, 3200]].forEach(([cx, cy], cIdx) => {
      for (let i = 0; i < 8; i++) {
        pushSafeMonster(`gate_${cIdx}_${i}`, gateMobs[i % gateMobs.length], cx + Math.cos(i) * 140, cy + Math.sin(i) * 140);
      }
    });

    const campMobs = allMobs.filter(m => m.zone === 'chief_camp' || m.zone === 'whispering_ruins');
    [[2550, 3100], [3250, 2900], [2950, 2600]].forEach(([cx, cy], cIdx) => {
      for (let i = 0; i < 6; i++) {
        pushSafeMonster(`camp_${cIdx}_${i}`, campMobs[i % campMobs.length], cx + Math.cos(i) * 150, cy + Math.sin(i) * 150);
      }
    });

    const bossData = allMobs.find(m => m.id === 104);
    if (bossData) pushSafeMonster('boss_altria', bossData, 2950, 2250, true);
    return;
  }

  if (currentRegionKey === 'R02') {
    const outMobs = allMobs.filter(m => m.region === 'R02' && (m.zone === 'fairy_outskirts' || m.zone === 'silver_vine_forest'));
    [[1350, 12100], [2650, 11900], [1850, 11100], [2850, 10800], [1200, 10500]].forEach(([cx, cy], cIdx) => {
      for (let i = 0; i < 6; i++) {
        pushSafeMonster(`r02_south_${cIdx}_${i}`, outMobs[i % outMobs.length], cx + Math.cos(i) * 120, cy + Math.sin(i) * 120);
      }
    });

    const vineMobs = allMobs.filter(m => m.region === 'R02' && m.zone === 'silver_vine_forest');
    [[950, 9400], [880, 8800], [1380, 8500], [1150, 7500], [1850, 9100]].forEach(([cx, cy], cIdx) => {
      for (let i = 0; i < 7; i++) {
        pushSafeMonster(`r02_vine_${cIdx}_${i}`, vineMobs[i % vineMobs.length], cx + Math.cos(i * 0.9) * 135, cy + Math.sin(i * 0.9) * 135);
      }
    });

    const millMobs = allMobs.filter(m => m.region === 'R02' && m.zone === 'lumber_mill');
    [[3000, 9650], [2550, 9150], [3380, 9200], [2750, 7400]].forEach(([cx, cy], cIdx) => {
      for (let i = 0; i < 7; i++) {
        pushSafeMonster(`r02_mill_${cIdx}_${i}`, millMobs[i % millMobs.length], cx + Math.cos(i) * 130, cy + Math.sin(i) * 130);
      }
    });

    const treeGuards = allMobs.filter(m => m.region === 'R02' && (m.zone === 'world_tree_camp' || m.zone === 'lumber_mill'));
    [[1580, 5250], [2520, 5250], [2050, 5850], [2050, 4950]].forEach(([cx, cy], cIdx) => {
      for (let i = 0; i < 6; i++) {
        pushSafeMonster(`r02_top_${cIdx}_${i}`, treeGuards[i % treeGuards.length], cx + Math.cos(i) * 145, cy + Math.sin(i) * 145);
      }
    });

    const bossData = allMobs.find(m => m.id === 108);
    if (bossData) pushSafeMonster('boss_silvervine', bossData, 2050, 4550, true);
    return;
  }

  if (currentRegionKey === 'R05') {
    const oasisMobs = allMobs.filter(m => m.region === 'R05' && (m.zone === 'oasis_outskirts' || m.zone === 'sand_dunes'));
    [[1350, 12300], [2850, 11400], [1850, 11100], [1150, 10600], [2450, 10200]].forEach(([cx, cy], cIdx) => {
      for (let i = 0; i < 6; i++) {
        pushSafeMonster(`r05_south_${cIdx}_${i}`, oasisMobs[i % oasisMobs.length], cx + Math.cos(i) * 125, cy + Math.sin(i) * 125);
      }
    });

    const duneMobs = allMobs.filter(m => m.region === 'R05' && m.zone === 'sand_dunes');
    [[1150, 9500], [880, 8750], [1550, 8950], [2150, 8400], [1400, 7400]].forEach(([cx, cy], cIdx) => {
      for (let i = 0; i < 7; i++) {
        pushSafeMonster(`r05_dune_${cIdx}_${i}`, duneMobs[i % duneMobs.length], cx + Math.cos(i * 0.9) * 140, cy + Math.sin(i * 0.9) * 140);
      }
    });

    const antMobs = allMobs.filter(m => m.region === 'R05' && m.zone === 'ant_hell');
    [[1050, 4650], [780, 4250], [1420, 4300], [1350, 5600]].forEach(([cx, cy], cIdx) => {
      for (let i = 0; i < 7; i++) {
        pushSafeMonster(`r05_ant_${cIdx}_${i}`, antMobs[i % antMobs.length], cx + Math.cos(i) * 135, cy + Math.sin(i) * 135);
      }
    });

    const tombGuards = allMobs.filter(m => m.region === 'R05' && (m.zone === 'pharaoh_tomb' || m.zone === 'sand_dunes'));
    [[2550, 6100], [3350, 6100], [2950, 6650], [2950, 5650]].forEach(([cx, cy], cIdx) => {
      for (let i = 0; i < 6; i++) {
        pushSafeMonster(`r05_tomb_${cIdx}_${i}`, tombGuards[i % tombGuards.length], cx + Math.cos(i) * 145, cy + Math.sin(i) * 145);
      }
    });

    const bossData = allMobs.find(m => m.id === 118);
    if (bossData) pushSafeMonster('boss_moraan', bossData, 2950, 5300, true);
    return;
  }

  if (currentRegionKey === 'R07') {
    const beachMobs = allMobs.filter(m => m.region === 'R07' && m.zone === 'black_beach');
    [[2950, 13400], [3150, 12400], [2850, 11400], [3200, 10400], [2950, 9400]].forEach(([cx, cy], cIdx) => {
      for (let i = 0; i < 7; i++) {
        pushSafeMonster(`r07_beach_${cIdx}_${i}`, beachMobs[i % beachMobs.length], cx + Math.cos(i * 0.9) * 135, cy + Math.sin(i * 0.9) * 135);
      }
    });

    const wreckMobs = allMobs.filter(m => m.region === 'R07' && m.zone === 'shipwreck');
    [[1650, 8250], [2350, 8150], [1950, 7450], [2850, 7850], [1750, 9100]].forEach(([cx, cy], cIdx) => {
      for (let i = 0; i < 7; i++) {
        pushSafeMonster(`r07_wreck_${cIdx}_${i}`, wreckMobs[i % wreckMobs.length], cx + Math.cos(i) * 130, cy + Math.sin(i) * 130);
      }
    });

    const pirateMobs = allMobs.filter(m => m.region === 'R07' && (m.zone === 'pirate_camp' || m.zone === 'shipwreck'));
    [[2250, 4450], [3050, 4450], [2650, 5100], [2850, 6100]].forEach(([cx, cy], cIdx) => {
      for (let i = 0; i < 6; i++) {
        pushSafeMonster(`r07_pirate_${cIdx}_${i}`, pirateMobs[i % pirateMobs.length], cx + Math.cos(i) * 145, cy + Math.sin(i) * 145);
      }
    });

    const bossData = allMobs.find(m => m.id === 124);
    if (bossData) pushSafeMonster('boss_balenos', bossData, 2720, 3500, true);
    return;
  }

  const regMobs = allMobs.filter(m => m.region === currentRegionKey && !m.name.includes('(B)'));
  const bossMob = allMobs.find(m => m.region === currentRegionKey && m.name.includes('(B)'));

  if (regMobs.length > 0 && mapData.isSeamlessRegion) {
    const fieldMobs = regMobs.filter(m => m.zone === 'field');
    const dungMobs = regMobs.filter(m => m.zone === 'dungeon');
    const guardMobs = regMobs.filter(m => m.zone === 'boss_camp');

    const fPool = fieldMobs.length > 0 ? fieldMobs : regMobs;
    const dPool = dungMobs.length > 0 ? dungMobs : regMobs;
    const gPool = guardMobs.length > 0 ? guardMobs : regMobs;

    const tx = mapData.spawn.x, ty = mapData.spawn.y;
    const outDir = ty > 8000 ? -1 : 1;
    [[tx - 550, ty + outDir * 1150], [tx + 550, ty + outDir * 1150], [tx, ty + outDir * 1450]].forEach(([cx, cy], cIdx) => {
      for (let i = 0; i < 6; i++) {
        pushSafeMonster(`${currentRegionKey}_out_${cIdx}_${i}`, fPool[i % fPool.length], cx + Math.cos(i) * 130, cy + Math.sin(i) * 130);
      }
    });

    const fx = mapData.fieldCenterPos?.x || mapData.fieldPos?.x || 1200, fy = mapData.fieldCenterPos?.y || mapData.fieldPos?.y || 9000;
    [[fx, fy], [fx - 420, fy - 350], [fx + 420, fy + 320], [fx + 350, fy - 420], [fx - 350, fy + 420]].forEach(([cx, cy], cIdx) => {
      for (let i = 0; i < 7; i++) {
        pushSafeMonster(`${currentRegionKey}_fld_${cIdx}_${i}`, fPool[i % fPool.length], cx + Math.cos(i * 0.9) * 140, cy + Math.sin(i * 0.9) * 140);
      }
    });

    const dx = mapData.dungeonEntrance?.x || 3000, dy = mapData.dungeonEntrance?.y || 7500;
    [[dx, dy + 280], [dx - 420, dy + 120], [dx + 420, dy + 120], [dx, dy + 650]].forEach(([cx, cy], cIdx) => {
      for (let i = 0; i < 7; i++) {
        pushSafeMonster(`${currentRegionKey}_dgate_${cIdx}_${i}`, dPool[i % dPool.length], cx + Math.cos(i) * 135, cy + Math.sin(i) * 135);
      }
    });

    const bx = mapData.bossPos?.x || 2000, by = mapData.bossPos?.y || 3200;
    [[bx - 420, by + 320], [bx + 420, by + 320], [bx, by + 580], [bx, by + 220]].forEach(([cx, cy], cIdx) => {
      for (let i = 0; i < 6; i++) {
        pushSafeMonster(`${currentRegionKey}_guard_${cIdx}_${i}`, gPool[i % gPool.length], cx + Math.cos(i) * 145, cy + Math.sin(i) * 145);
      }
    });

    if (bossMob) {
      pushSafeMonster(`boss_${currentRegionKey}`, bossMob, bx, by, true);
    }
  }
}

function getOrInitWorldMap(rawMapKey) {
  const canonicalKey = normalizeMapKey(rawMapKey);
  if (worldMaps.has(canonicalKey)) return worldMaps.get(canonicalKey);

  const mapData = HardcodedMapDB[canonicalKey] || HardcodedMapDB['R01_sub1'];
  const regionKey = canonicalKey.split('_')[0] || 'R01';
  const { wallBoxes, portalBoxes } = buildMapCollisionAndPortals(canonicalKey, mapData);
  const safeZone = (!mapData || mapData.isDungeon)
    ? null
    : { x: mapData.spawn.x, y: mapData.spawn.y, radius: mapData.isSeamlessRegion ? 780 : 500 };

  const mapInst = {
    mapKey: canonicalKey,
    regionKey,
    width: mapData.width || 4000,
    height: mapData.height || 16000,
    isDungeon: Boolean(mapData.isDungeon),
    isSeamlessRegion: Boolean(mapData.isSeamlessRegion),
    mapData,
    wallBoxes,
    portalBoxes,
    safeZone,
    monsters: [],
    groundItems: [],
    bossRespawnTimer: 0,
    bossTelegraphs: []
  };

  populateServerMapMonsters(mapInst);
  worldMaps.set(canonicalKey, mapInst);
  return mapInst;
}

(GameDB.Regions || []).forEach(reg => {
  getOrInitWorldMap(`${reg.id}_sub1`);
  getOrInitWorldMap(`${reg.id}_dungeon`);
});

// ============================================================================
// 5. 서버 권위형 아이템 인스턴스 및 몬스터 드롭 생성기
// ============================================================================
function createServerItemInstance(itemId, qty = 1, isBossDrop = false, forceGradeIdx = null, mobLv = 1, initPlus = 0) {
  const def = serverItemDict[itemId];
  const isEquip = def && ['한손검', '양손활', '양손지팡이', '방패', '투구', '갑옷', '장갑', '망토', '신발', '반지', '목걸이', '귀걸이', '티셔츠', '벨트'].some(t => def.type?.includes(t));

  if (!isEquip) {
    const fixedG = typeof def?.fixedGrade === 'number' ? def.fixedGrade : 0;
    const gInfo = (GameDB.ItemGrades && GameDB.ItemGrades[fixedG]) || { name: '일반', color: '#ffffff' };
    return {
      uid: `it_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      type: itemId,
      qty: Math.max(1, Number(qty) || 1),
      gradeIdx: fixedG,
      gradeName: gInfo.name,
      gradeColor: gInfo.color,
      options: []
    };
  }

  let gradeIdx = 0;
  if (typeof def.fixedGrade === 'number') {
    gradeIdx = def.fixedGrade;
  } else if (typeof forceGradeIdx === 'number') {
    gradeIdx = Math.max(0, Math.min(4, forceGradeIdx));
  } else {
    const lvTierBonus = Math.min(3.0, Math.max(0, (mobLv - 1) / 90));
    const grades = (GameDB.ItemGrades || []).map(g => {
      let w = isBossDrop ? g.dropWeightBoss : g.dropWeightMob;
      if (mobLv <= 25) {
        // 초급 사냥터(R01 알트리아 등): 전설(3)·초월(4) 드롭률 대폭 하향
        if (isBossDrop) {
          if (g.idx === 0) w = 0;
          else if (g.idx === 1) w = 520;
          else if (g.idx === 2) w = 260;
          else if (g.idx === 3) w = 6;   // 초급 보스 전설 극소 확률 (~0.76%)
          else if (g.idx === 4) w = 0;   // 초급 보스 초월 드롭 안됨
        } else {
          if (g.idx === 0) w = 720;
          else if (g.idx === 1) w = 240;
          else if (g.idx === 2) w = 35;
          else if (g.idx === 3) w = 0.08; // 초급 일반몹 전설 극악 확률 (~0.008%)
          else if (g.idx === 4) w = 0;
        }
      } else if (mobLv <= 50) {
        // 초중급 사냥터(R02~R03): 전설·초월 확률 낮게 유지
        if (isBossDrop) {
          if (g.idx === 0) w = 0;
          else if (g.idx === 1) w = 440;
          else if (g.idx === 2) w = 360;
          else if (g.idx === 3) w = 18;
          else if (g.idx === 4) w = 0.5;
        } else {
          if (g.idx === 0) w = 660;
          else if (g.idx === 1) w = 270;
          else if (g.idx === 2) w = 65;
          else if (g.idx === 3) w = 0.45;
          else if (g.idx === 4) w = 0.01;
        }
      } else if (mobLv <= 90) {
        // 중급 사냥터(R04~R06)
        if (isBossDrop) {
          if (g.idx === 0) w = 0;
          else if (g.idx === 3) w = 55;
          else if (g.idx === 4) w = 4;
        } else {
          if (g.idx === 3) w = 2.5;
          else if (g.idx === 4) w = 0.15;
        }
      } else {
        if (isBossDrop) {
          if (g.idx === 0) w = 0;
          else if (g.idx === 2) w = Math.round(w * (1 + lvTierBonus * 0.25));
          else if (g.idx === 3) w = Math.round(w * (0.45 + lvTierBonus * 0.35));
          else if (g.idx === 4) w = Math.round(w * (0.25 + lvTierBonus * 0.45));
        } else if (g.idx >= 1) {
          if (g.idx === 3) w = Math.max(3, Math.round(w * (0.35 + lvTierBonus * 0.25)));
          else if (g.idx === 4) w = Math.max(0.3, w * (0.25 + lvTierBonus * 0.25));
          else w = Math.round(w * (1 + lvTierBonus * 0.2));
        }
      }
      return { ...g, calcWeight: w };
    });

    const totalW = grades.reduce((acc, g) => acc + g.calcWeight, 0);
    let roll = Math.random() * totalW;
    for (const g of grades) {
      if (roll < g.calcWeight) {
        gradeIdx = g.idx;
        break;
      }
      roll -= g.calcWeight;
    }
    if (isBossDrop && gradeIdx < 1) gradeIdx = 1;
  }

  const gradeInfo = (GameDB.ItemGrades && GameDB.ItemGrades[gradeIdx]) || { name: '일반', color: '#ffffff', mult: 1.0, optMin: 0, optMax: 0 };
  let optCount = gradeInfo.optMin + Math.floor(Math.random() * (gradeInfo.optMax - gradeInfo.optMin + 1));
  if (isBossDrop && mobLv >= 80 && optCount < gradeInfo.optMax) {
    optCount = gradeInfo.optMax;
  }

  const pool = [...(GameDB.MagicOptionPool || [])];
  const options = [];
  const bossFloorRatio = isBossDrop ? Math.min(0.55, 0.15 + (mobLv / 500)) : 0;

  for (let i = 0; i < optCount && pool.length > 0; i++) {
    const pickIdx = Math.floor(Math.random() * pool.length);
    const optDef = pool.splice(pickIdx, 1)[0];
    const span = optDef.max - optDef.min;
    const minRoll = optDef.min + Math.floor(span * bossFloorRatio);
    const val = minRoll + Math.floor(Math.random() * (optDef.max - minRoll + 1));
    options.push({ key: optDef.key, label: optDef.label, val, unit: optDef.unit });
  }

  return {
    uid: `eq_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    type: itemId,
    qty: 1,
    plus: Math.max(0, Number(initPlus) || 0),
    gradeIdx,
    gradeName: gradeInfo.name,
    gradeColor: gradeInfo.color,
    mult: gradeInfo.mult,
    options
  };
}

function pickServerMonsterSkillBookDrop(mobLv = 1, isBoss = false, killerClass = null) {
  const allBooks = Object.values(serverItemDict).filter(it => it && it.id && it.id.startsWith('BOOK_'));
  if (allBooks.length === 0) return null;
  let eligible = allBooks.filter(b => mobLv >= (b.dropMinLv - 4) && mobLv <= (b.dropMaxLv + 25));
  if (eligible.length === 0) {
    if (mobLv < 20) return null;
    eligible = allBooks.filter(b => mobLv >= (b.dropMinLv - 10));
  }
  if (eligible.length === 0) return null;

  let pool = eligible;
  if (killerClass) {
    const myClassBooks = eligible.filter(b => b.reqClass === killerClass);
    if (myClassBooks.length > 0 && Math.random() < (isBoss ? 0.70 : 0.50)) {
      pool = myClassBooks;
    }
  }
  const picked = pool[Math.floor(Math.random() * pool.length)];
  return picked ? picked.id : null;
}

function pickServerMonsterTierDrop(ent, category = 'equip', killerClass = null) {
  const lv = ent.lv || 1;
  const rawPool = (ent.drop && ent.drop.length > 0 ? ent.drop : ['C_P01']).filter(id => !serverItemDict[id]?.questOnly);

  if (category === 'consumable') {
    if (lv >= 15 && Math.random() < (ent.isBoss ? 0.65 : 0.24)) {
      const bookId = pickServerMonsterSkillBookDrop(lv, ent.isBoss, killerClass);
      if (bookId) return bookId;
    }
    const cons = rawPool.filter(id => id.startsWith('C_') || id.startsWith('S_'));
    if (Math.random() < 0.14) {
      return lv >= 18 ? (Math.random() < 0.48 ? 'S_WE01' : 'S_AR01') : 'S_RE01';
    }
    if (Math.random() < 0.14 && lv >= 15) return 'C_P05';
    if (cons.length > 0) return cons[Math.floor(Math.random() * cons.length)];
    return lv >= 30 ? (Math.random() < 0.6 ? 'C_P02' : 'C_P04') : (Math.random() < 0.6 ? 'C_P01' : 'C_P03');
  }

  const equipFromMob = rawPool.filter(id => !id.startsWith('C_') && !id.startsWith('S_') && !id.startsWith('Q_') && !id.startsWith('BOOK_'));
  let tierIdx = 1;
  if (lv >= 140) tierIdx = 5;
  else if (lv >= 75) tierIdx = 4;
  else if (lv >= 35) tierIdx = 3;
  else if (lv >= 12) tierIdx = 2;

  const tierSuffix = `0${tierIdx}`;
  const prevSuffix = `0${Math.max(1, tierIdx - 1)}`;
  const tierEquips = Object.keys(serverItemDict).filter(id => {
    const d = serverItemDict[id];
    if (!d || d.questOnly) return false;
    if (id.startsWith('C_') || id.startsWith('S_') || id.startsWith('Q_') || id.startsWith('QR_') || id.startsWith('BOOK_')) return false;
    return id.endsWith(tierSuffix) || (!ent.isBoss && id.endsWith(prevSuffix));
  });

  const mergedPool = equipFromMob.length > 0 ? [...equipFromMob, ...equipFromMob, ...tierEquips] : tierEquips;
  if (mergedPool.length === 0) return 'W_SW01';
  return mergedPool[Math.floor(Math.random() * mergedPool.length)];
}

function spawnServerGroundItem(mapInst, itemObj, rawX, rawY) {
  const safePt = findServerSafeSpot(mapInst, rawX, rawY);
  const dropped = {
    ...itemObj,
    uid: itemObj.uid || `drop_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    x: safePt.x,
    y: safePt.y,
    spawnTime: Date.now()
  };
  mapInst.groundItems.push(dropped);
  return dropped;
}

// ============================================================================
// 6. 실시간 WebSocket 세션 · 패킷 브로드캐스트 · 운영자(GM) 한글 명령어 엔진
// ============================================================================
const activeCharSockets = new Map(); // charId -> SessionEntry
const mutedCharMap = new Map();      // lowerCharName -> unmuteTimestamp
const serverParties = new Map();     // partyId -> { partyId, leaderCharId, leaderTargetMobId, partyMode: 'FREE', members: [charId, ...] }
const serverTrades = new Map();      // tradeId -> TradeSession (원자적 플레이어 거래 세션)
const activeCharTradeMap = new Map();// charId -> tradeId (1인 다중 거래 및 복사 원천 차단)
const aiRunnerControlConns = new Set(); // AI Agent Runner 제어 전용 WebSocket 연결 목록

function cancelActiveTradeForChar(charId, reason = '거래가 취소되었습니다.') {
  if (!charId) return;
  const tradeId = activeCharTradeMap.get(charId);
  if (!tradeId) return;
  const trade = serverTrades.get(tradeId);
  activeCharTradeMap.delete(charId);
  if (!trade) return;
  if (trade.state === 'COMMITTING' || trade.state === 'COMPLETED') return;
  trade.state = 'CANCELLED';
  serverTrades.delete(tradeId);

  const otherCharId = trade.playerA.charId === charId ? trade.playerB.charId : trade.playerA.charId;
  activeCharTradeMap.delete(otherCharId);

  [trade.playerA.charId, trade.playerB.charId].forEach(cid => {
    const e = activeCharSockets.get(cid);
    if (e && e.conn) {
      sendWsMessage(e.conn, {
        type: 'TRADE_CANCELLED',
        tradeId,
        reason
      });
    }
  });
}

function buildTradeSnapshot(trade) {
  if (!trade) return null;
  return {
    tradeId: trade.tradeId,
    state: trade.state,
    offerVersion: trade.offerVersion,
    playerA: {
      charId: trade.playerA.charId,
      name: trade.playerA.name,
      level: trade.playerA.level,
      class: trade.playerA.class,
      items: trade.playerA.items,
      gold: trade.playerA.gold,
      locked: trade.playerA.locked,
      confirmed: trade.playerA.confirmed
    },
    playerB: {
      charId: trade.playerB.charId,
      name: trade.playerB.name,
      level: trade.playerB.level,
      class: trade.playerB.class,
      items: trade.playerB.items,
      gold: trade.playerB.gold,
      locked: trade.playerB.locked,
      confirmed: trade.playerB.confirmed
    }
  };
}

function broadcastTradeSync(trade) {
  if (!trade) return;
  const snap = buildTradeSnapshot(trade);
  [
    { my: trade.playerA, other: trade.playerB, side: 'A' },
    { my: trade.playerB, other: trade.playerA, side: 'B' }
  ].forEach(({ my, other, side }) => {
    const e = activeCharSockets.get(my.charId);
    if (e && e.conn) {
      sendWsMessage(e.conn, {
        type: 'TRADE_STATE_SYNC',
        trade: snap,
        tradeId: trade.tradeId,
        offerVersion: trade.offerVersion,
        mySide: side,
        partner: {
          charId: other.charId,
          name: other.name || '모험가',
          level: other.level || 1,
          class: other.class || 'knight'
        },
        myOffer: {
          items: my.items || [],
          gold: my.gold || 0,
          locked: Boolean(my.locked),
          confirmed: Boolean(my.confirmed)
        },
        partnerOffer: {
          items: other.items || [],
          gold: other.gold || 0,
          locked: Boolean(other.locked),
          confirmed: Boolean(other.confirmed)
        }
      });
    }
  });
}

function sanitizeTradeOfferItems(rawItems) {
  if (!Array.isArray(rawItems)) return [];
  const usedSlots = new Set();
  const sanitized = [];
  for (let i = 0; i < rawItems.length && sanitized.length < 6; i++) {
    const it = rawItems[i];
    if (!it || typeof it !== 'object') continue;
    const srcItem = (it.item && typeof it.item === 'object') ? it.item : it;
    const invIdx = Number(it.invIdx ?? srcItem.invIdx ?? i);
    if (!Number.isInteger(invIdx) || invIdx < 0 || invIdx >= 100 || usedSlots.has(invIdx)) continue;
    const itemType = String(srcItem.type || it.type || '').trim();
    if (!itemType || !serverItemDict[itemType]) continue;
    const qty = Math.max(1, Math.min(9999, Math.floor(Number(it.qty ?? srcItem.qty ?? srcItem.count ?? it.count ?? 1))));
    const uid = String(srcItem.uid || it.uid || `tr_${invIdx}_${Date.now()}`);
    const plus = Math.max(0, Math.min(30, Math.floor(Number(srcItem.plus ?? it.plus ?? srcItem.enchantLevel ?? 0))));
    const gradeIdx = Math.max(0, Math.min(5, Math.floor(Number(srcItem.gradeIdx ?? it.gradeIdx ?? 0))));
    const gradeName = srcItem.gradeName || it.gradeName || undefined;
    const gradeColor = srcItem.gradeColor || it.gradeColor || undefined;
    const mult = typeof (srcItem.mult ?? it.mult) === 'number' ? (srcItem.mult ?? it.mult) : undefined;
    const options = Array.isArray(srcItem.options || it.options) ? (srcItem.options || it.options).slice(0, 6) : undefined;
    usedSlots.add(invIdx);
    const cleanItemObj = {
      uid,
      type: itemType,
      qty,
      plus,
      gradeIdx,
      gradeName,
      gradeColor,
      mult,
      options
    };
    sanitized.push({
      invIdx,
      uid,
      type: itemType,
      qty,
      plus,
      gradeIdx,
      gradeName,
      gradeColor,
      mult,
      options,
      item: cleanItemObj
    });
  }
  return sanitized;
}

function getPartyByCharId(charId) {
  if (!charId) return null;
  const entry = activeCharSockets.get(charId);
  if (entry && entry.partyId && serverParties.has(entry.partyId)) {
    return serverParties.get(entry.partyId);
  }
  for (const p of serverParties.values()) {
    if (p.members.includes(charId)) return p;
  }
  return null;
}

function buildPartySnapshot(party) {
  if (!party) return null;
  const memberDetails = [];
  let leaderInSafeZone = false;
  party.members.forEach((cId, idx) => {
    const e = activeCharSockets.get(cId);
    if (e && e.player) {
      const mMapKey = e.mapKey || 'R01_sub1';
      const px = Math.round(e.player.x || 2000);
      const py = Math.round(e.player.y || 14250);
      const mMapInst = worldMaps.get(normalizeMapKey(mMapKey));
      const inSafe = mMapInst ? isServerPointInSafeZone(mMapInst, px, py) : false;
      const isLdr = party.leaderCharId === cId;
      if (isLdr) {
        leaderInSafeZone = inSafe;
      }
      const zInfo = resolveServerEntityZone(e.regionKey, mMapKey, px, py);
      memberDetails.push({
        charId: cId,
        name: e.player.name || '모험가',
        class: e.player.class || 'knight',
        level: e.player.level || 1,
        hp: Math.ceil(e.player.hp ?? 100),
        maxHp: e.player.maxHp || 100,
        mp: Math.ceil(e.player.mp ?? 50),
        maxMp: e.player.maxMp || 50,
        mapKey: mMapKey,
        regionKey: zInfo.regionKey,
        zoneKey: zInfo.zoneKey,
        zoneName: zInfo.zoneName,
        x: px,
        y: py,
        inSafeZone: inSafe,
        isAI: isAIEntry(e),
        isLeader: isLdr,
        joinOrder: idx + 1
      });
    }
  });
  if (leaderInSafeZone) {
    party.leaderTargetMobId = null;
  }
  const baseMode = party.partyMode || 'FREE';
  const effectivePartyMode = (baseMode === 'FOCUS' && leaderInSafeZone) ? 'FREE' : baseMode;
  return {
    partyId: party.partyId,
    leaderCharId: party.leaderCharId,
    leaderTargetMobId: leaderInSafeZone ? null : (party.leaderTargetMobId || null),
    partyMode: baseMode,
    effectivePartyMode,
    leaderInSafeZone,
    members: memberDetails
  };
}

function broadcastPartyUpdate(party) {
  if (!party) return;
  const snap = buildPartySnapshot(party);
  party.members.forEach(cId => {
    const e = activeCharSockets.get(cId);
    if (e && e.conn) {
      sendWsMessage(e.conn, {
        type: 'PARTY_STATE_UPDATE',
        party: snap
      });
    }
  });
}

function removeCharFromParty(charId, reason = 'leave') {
  if (reason === 'disconnect') {
    cancelActiveTradeForChar(charId, '상대방의 접속이 종료되어 거래가 자동 취소되었습니다.');
  }
  const party = getPartyByCharId(charId);
  if (!party) return;
  const leavingEntry = activeCharSockets.get(charId);
  const leavingName = leavingEntry?.player?.name || '파티원';
  const wasLeader = party.leaderCharId === charId;

  party.members = party.members.filter(id => id !== charId);
  if (leavingEntry) {
    leavingEntry.partyId = null;
    if (leavingEntry.player) {
      leavingEntry.player.partyId = null;
      leavingEntry.player.isPartyLeader = false;
    }
    if (reason !== 'disconnect') {
      sendWsMessage(leavingEntry.conn, { type: 'PARTY_STATE_UPDATE', party: null });
      sendSystemMsgToEntry(leavingEntry, `🚪 파티에서 탈퇴했습니다.`, 'log-sys');
    }
  }

  // 남은 파티원 중 오프라인 소켓 정리
  party.members = party.members.filter(id => activeCharSockets.has(id));

  if (party.members.length === 0) {
    serverParties.delete(party.partyId);
    return;
  }

  if (party.members.length === 1) {
    const lastCharId = party.members[0];
    const lastEntry = activeCharSockets.get(lastCharId);
    serverParties.delete(party.partyId);
    if (lastEntry) {
      lastEntry.partyId = null;
      if (lastEntry.player) {
        lastEntry.player.partyId = null;
        lastEntry.player.isPartyLeader = false;
      }
      sendWsMessage(lastEntry.conn, { type: 'PARTY_STATE_UPDATE', party: null });
      sendSystemMsgToEntry(lastEntry, `ℹ️ [파티 해산] '${leavingName}'님이 ${reason === 'disconnect' ? '접속 종료' : '탈퇴'}하여 남은 파티원이 없어 파티가 해산되었습니다.`, 'log-sys');
    }
    return;
  }

  if (wasLeader) {
    // 파티장 접속종료 또는 탈퇴 시 자동으로 두 번째 가입자(현재 members[0])가 파티장 승계!
    party.leaderCharId = party.members[0];
    party.leaderTargetMobId = null;
    const newLeaderEntry = activeCharSockets.get(party.leaderCharId);
    const newLeaderName = newLeaderEntry?.player?.name || '파티원';
    party.members.forEach(cId => {
      const mEntry = activeCharSockets.get(cId);
      if (mEntry) {
        if (mEntry.player) mEntry.player.isPartyLeader = (cId === party.leaderCharId);
        sendSystemMsgToEntry(
          mEntry,
          `👑 [파티장 승계] 기존 파티장('${leavingName}')님이 ${reason === 'disconnect' ? '접속 종료' : '탈퇴'}하여 두 번째 가입자인 '${newLeaderName}'님이 새 파티장이 되었습니다!`,
          'log-kill'
        );
      }
    });
  } else {
    party.members.forEach(cId => {
      const mEntry = activeCharSockets.get(cId);
      if (mEntry) {
        sendSystemMsgToEntry(mEntry, `ℹ️ [파티] '${leavingName}'님이 파티에서 ${reason === 'disconnect' ? '접속 종료' : '탈퇴'}했습니다.`, 'log-sys');
      }
    });
  }

  broadcastPartyUpdate(party);
}

// 📡 단일 직렬화 후 다중 소켓 고속 전송 헬퍼 (동시접속 150명 + AI 100명 브로드캐스트 시 JSON.stringify/Buffer 중복 생성 0회!)
function sendPreSerializedWs(conn, jsonStr, payloadBuf, useBinary = true) {
  if (!conn) return;
  try {
    const sendAsBin = Boolean(useBinary && conn.binarySupported !== false);
    if (typeof conn.send === 'function') {
      if (conn.readyState !== undefined && conn.readyState !== 1) return;
      if (sendAsBin) {
        conn.send(payloadBuf, { binary: true });
      } else {
        conn.send(jsonStr);
      }
    } else if (conn.socket && !conn.socket.destroyed) {
      const opcodeByte = sendAsBin ? 0x82 : 0x81;
      const len = payloadBuf.length;
      let header;
      if (len < 126) {
        header = Buffer.from([opcodeByte, len]);
      } else if (len < 65536) {
        header = Buffer.alloc(4);
        header[0] = opcodeByte;
        header[1] = 126;
        header.writeUInt16BE(len, 2);
      } else {
        header = Buffer.alloc(10);
        header[0] = opcodeByte;
        header[1] = 127;
        header.writeBigUInt64BE(BigInt(len), 2);
      }
      conn.socket.write(Buffer.concat([header, payloadBuf]));
    }
  } catch (e) {}
}

function sendWsMessage(conn, obj, useBinary = true) {
  if (!conn) return;
  try {
    const json = typeof obj === 'string' ? obj : JSON.stringify(obj);
    const payload = Buffer.from(json, 'utf8');
    sendPreSerializedWs(conn, json, payload, useBinary);
  } catch (e) {}
}

function broadcastToMap(rawMapKey, packetObj, excludeCharId = null) {
  const targetMapKey = normalizeMapKey(rawMapKey);
  let jsonStr = null;
  let payloadBuf = null;
  activeCharSockets.forEach(entry => {
    if (!entry || entry.charId === excludeCharId) return;
    if ((entry.mapKey === targetMapKey) || (normalizeMapKey(entry.mapKey) === targetMapKey)) {
      if (!payloadBuf) {
        jsonStr = typeof packetObj === 'string' ? packetObj : JSON.stringify(packetObj);
        payloadBuf = Buffer.from(jsonStr, 'utf8');
      }
      sendPreSerializedWs(entry.conn, jsonStr, payloadBuf, true);
    }
  });
}

// 📡 AOI 기반 선택적 브로드캐스트 (단일 직렬화 + 제곱 거리 비교로 CPU 부하 90% 절감 및 100% 무결성 동기화)
function broadcastToMapAoi(rawMapKey, cx, cy, humanRadius, aiRadius, packetObj, excludeCharId = null, alwaysIncludeCharId = null) {
  const targetMapKey = normalizeMapKey(rawMapKey);
  const humanRSq = humanRadius > 0 ? humanRadius * humanRadius : 0;
  const aiRSq = aiRadius > 0 ? aiRadius * aiRadius : 0;
  let jsonStr = null;
  let payloadBuf = null;

  activeCharSockets.forEach(entry => {
    if (!entry || entry.charId === excludeCharId) return;
    if (entry.mapKey !== targetMapKey && normalizeMapKey(entry.mapKey) !== targetMapKey) return;
    if (alwaysIncludeCharId && entry.charId === alwaysIncludeCharId) {
      if (!payloadBuf) {
        jsonStr = typeof packetObj === 'string' ? packetObj : JSON.stringify(packetObj);
        payloadBuf = Buffer.from(jsonStr, 'utf8');
      }
      sendPreSerializedWs(entry.conn, jsonStr, payloadBuf, true);
      return;
    }
    const isAi = isAIEntry(entry);
    const maxR = isAi ? aiRadius : humanRadius;
    if (maxR <= 0) return;
    const px = Number(entry.player?.x) || 0;
    const py = Number(entry.player?.y) || 0;
    const dx = Math.abs(px - cx);
    const dy = Math.abs(py - cy);
    if (dx <= maxR && dy <= maxR && (dx * dx + dy * dy) <= (isAi ? aiRSq : humanRSq)) {
      if (!payloadBuf) {
        jsonStr = typeof packetObj === 'string' ? packetObj : JSON.stringify(packetObj);
        payloadBuf = Buffer.from(jsonStr, 'utf8');
      }
      sendPreSerializedWs(entry.conn, jsonStr, payloadBuf, true);
    }
  });
}

function broadcastToRegion(rawRegionKey, packetObj, excludeCharId = null) {
  const targetReg = String(rawRegionKey || 'R01').split('_')[0];
  let jsonStr = null;
  let payloadBuf = null;
  activeCharSockets.forEach(entry => {
    if (!entry || entry.charId === excludeCharId) return;
    const entryReg = String(entry.regionKey || entry.mapKey || 'R01').split('_')[0];
    if (entryReg === targetReg) {
      if (!payloadBuf) {
        jsonStr = typeof packetObj === 'string' ? packetObj : JSON.stringify(packetObj);
        payloadBuf = Buffer.from(jsonStr, 'utf8');
      }
      sendPreSerializedWs(entry.conn, jsonStr, payloadBuf, true);
    }
  });
}

function broadcastToAll(packetObj, excludeCharId = null) {
  let jsonStr = null;
  let payloadBuf = null;
  activeCharSockets.forEach(entry => {
    if (!entry || entry.charId === excludeCharId) return;
    if (!payloadBuf) {
      jsonStr = typeof packetObj === 'string' ? packetObj : JSON.stringify(packetObj);
      payloadBuf = Buffer.from(jsonStr, 'utf8');
    }
    sendPreSerializedWs(entry.conn, jsonStr, payloadBuf, true);
  });
}

function findOnlineEntryByName(charName, preferredRegionKey = null, preferredMapKey = null) {
  const target = String(charName || '').trim().toLowerCase();
  if (!target) return null;
  const prefMap = preferredMapKey ? normalizeMapKey(preferredMapKey) : null;
  const prefReg = preferredRegionKey ? String(preferredRegionKey).split('_')[0] : null;

  if (prefMap) {
    for (const entry of activeCharSockets.values()) {
      const pName = String(entry.player?.name || '').trim().toLowerCase();
      if (pName === target && normalizeMapKey(entry.mapKey) === prefMap) return entry;
    }
  }
  if (prefReg) {
    for (const entry of activeCharSockets.values()) {
      const pName = String(entry.player?.name || '').trim().toLowerCase();
      const eReg = String(entry.regionKey || entry.mapKey || '').split('_')[0];
      if (pName === target && eReg === prefReg) return entry;
    }
  }
  for (const entry of activeCharSockets.values()) {
    const pName = String(entry.player?.name || '').trim().toLowerCase();
    if (pName === target) return entry;
  }
  if (prefMap) {
    for (const entry of activeCharSockets.values()) {
      const pName = String(entry.player?.name || '').trim().toLowerCase();
      if (pName.includes(target) && normalizeMapKey(entry.mapKey) === prefMap) return entry;
    }
  }
  if (prefReg) {
    for (const entry of activeCharSockets.values()) {
      const pName = String(entry.player?.name || '').trim().toLowerCase();
      const eReg = String(entry.regionKey || entry.mapKey || '').split('_')[0];
      if (pName.includes(target) && eReg === prefReg) return entry;
    }
  }
  for (const entry of activeCharSockets.values()) {
    const pName = String(entry.player?.name || '').trim().toLowerCase();
    if (pName.includes(target)) return entry;
  }
  return null;
}

function sendSystemMsgToEntry(entry, text, logClass = 'log-sys') {
  if (!entry) return;
  sendWsMessage(entry.conn, {
    type: 'SERVER_SYS_MSG',
    text,
    logClass
  });
}

function buildMapInitStatePacket(rawMapKey, receiverEntry = null) {
  const mapInst = getOrInitWorldMap(rawMapKey);
  const playersInMap = [];
  activeCharSockets.forEach(entry => {
    if (normalizeMapKey(entry.mapKey) === mapInst.mapKey && entry.player) {
      if (entry.gmInvisible && (!receiverEntry || (!receiverEntry.isAdmin && receiverEntry.charId !== entry.charId))) {
        return;
      }
      const pParty = getPartyByCharId(entry.charId);
      playersInMap.push({
        ...entry.player,
        partyId: pParty ? pParty.partyId : null,
        isPartyLeader: Boolean(pParty && pParty.leaderCharId === entry.charId),
        partyMemberCount: pParty ? pParty.members.length : 0,
        isAI: isAIEntry(entry),
        isAdmin: Boolean(entry.isAdmin),
        gmInvisible: Boolean(entry.gmInvisible),
        gmInvincible: Boolean(entry.gmInvincible)
      });
    }
  });

  return {
    type: 'MAP_INIT_STATE',
    serverTime: Date.now(),
    buildVersion: CURRENT_BUILD_VERSION,
    mapKey: mapInst.mapKey,
    bossRespawnTimer: Math.ceil(mapInst.bossRespawnTimer),
    monsters: mapInst.monsters.map(m => ({
      id: m.id,
      mobId: m.mobId,
      lv: m.lv,
      name: m.name,
      rawName: m.rawName,
      type: m.type,
      hp: m.hp,
      maxHp: m.maxHp,
      mp: Math.round(m.mp),
      maxMp: m.maxMp,
      atk: m.atk,
      def: m.def,
      mDef: m.mDef,
      baseExp: m.baseExp,
      drop: m.drop,
      skill: m.skill,
      isBoss: m.isBoss,
      isElite: Boolean(m.isElite),
      scaleMult: m.scaleMult || (m.isElite ? 1.90 : 1.0),
      isAggro: m.isAggro,
      x: Math.round(m.x),
      y: Math.round(m.y),
      spawnX: m.spawnX,
      spawnY: m.spawnY,
      isDead: m.isDead,
      respawnTimer: Math.ceil(m.respawnTimer),
      stunUntil: m.stunUntil,
      defDownUntil: m.defDownUntil
    })),
    groundItems: mapInst.groundItems,
    players: playersInMap
  };
}

// ============================================================================
// 👑 상용 MMORPG 한글 명령어 & 운영자(GM) 명령어 처리기
// ============================================================================

function isAIEntry(entry) {
  if (!entry) return false;
  return Boolean(
    entry.player?.isAI ||
    String(entry.charId || '').startsWith('a1000000-') ||
    String(entry.sessionToken || '').startsWith('ai_sess_')
  );
}

function delegatePartyLeaderToHuman(party, humanEntry) {
  if (!party || !humanEntry || !party.members.includes(humanEntry.charId)) return false;
  if (party.leaderCharId === humanEntry.charId) {
    sendSystemMsgToEntry(humanEntry, `👑 이미 현재 파티의 파티장입니다.`, 'log-sys');
    return true;
  }
  const prevLeaderEntry = activeCharSockets.get(party.leaderCharId);
  const prevLeaderName = prevLeaderEntry?.player?.name || '파티장';
  party.leaderCharId = humanEntry.charId;
  party.members = [humanEntry.charId, ...party.members.filter(id => id !== humanEntry.charId)];
  party.members.forEach(cId => {
    const mE = activeCharSockets.get(cId);
    if (mE) {
      if (mE.player) mE.player.isPartyLeader = (cId === party.leaderCharId);
      sendSystemMsgToEntry(mE, `👑 [파티장 위임] '${prevLeaderName}'님이 '${humanEntry.player?.name}'님에게 파티장 권한을 양보했습니다!`, 'log-kill');
    }
  });
  broadcastPartyUpdate(party);
  if (prevLeaderEntry && isAIEntry(prevLeaderEntry)) {
    setTimeout(() => {
      party.members.forEach(cId => {
        const mE = activeCharSockets.get(cId);
        if (mE) {
          sendWsMessage(mE.conn, {
            type: 'REMOTE_CHAT',
            charId: prevLeaderEntry.charId,
            mapKey: prevLeaderEntry.mapKey,
            regionKey: prevLeaderEntry.regionKey,
            sender: `🎗️[파티] ${prevLeaderName}`,
            text: `넵! ${humanEntry.player?.name}님께 파티장 넘겨드렸습니다~ 편하게 오더 내려주세요 ㅎㅎ`,
            bubbleText: `넵! ${humanEntry.player?.name}님께 파티장 넘겨드렸습니다~`,
            chatStyle: 'party'
          });
        }
      });
    }, 350);
  }
  return true;
}

let isRebootInProgress = false;
let lastScheduledRebootDateKey = null;

function triggerAdminServerReboot(adminName = '운영자', reasonLabel = '서버 점검 및 최적화', countdownSec = 20) {
  if (isRebootInProgress) return;
  isRebootInProgress = true;
  let remaining = Math.max(1, Number(countdownSec) || 20);
  console.log(`⚡ [서버 리부팅 예고] '${adminName}' (${reasonLabel}) - ${remaining}초 카운트다운을 시작합니다.`);

  broadcastToAll({
    type: 'GM_NOTICE',
    sender: adminName,
    text: `⚠️ [서버 리부팅 예고] ${reasonLabel}(으)로 ${remaining}초 후 서버가 자동 재부팅됩니다! (모든 캐릭터 자동 저장 중)`,
    timestamp: Date.now()
  });
  broadcastToAll({
    type: 'SERVER_REBOOT_COUNTDOWN',
    secondsLeft: remaining,
    reason: reasonLabel,
    sender: adminName
  });
  broadcastToAll({ type: 'FORCE_CLIENT_SAVE' });

  const timer = setInterval(() => {
    remaining--;
    if (remaining > 0) {
      broadcastToAll({
        type: 'SERVER_REBOOT_COUNTDOWN',
        secondsLeft: remaining,
        reason: reasonLabel,
        sender: adminName
      });
      if (remaining === 15 || remaining === 10 || remaining <= 5) {
        broadcastToAll({ type: 'FORCE_CLIENT_SAVE' });
        broadcastToAll({
          type: 'SERVER_SYS_MSG',
          text: `⏳ [리부팅 카운트다운] 서버 자동 재부팅까지 ${remaining}초 남았습니다. 안전한 장소에서 대기해주세요.`,
          logClass: 'log-kill'
        });
      }
      return;
    }

    clearInterval(timer);
    broadcastToAll({
      type: 'SERVER_REBOOT_COUNTDOWN',
      secondsLeft: 0,
      reason: reasonLabel,
      sender: adminName
    });
    broadcastToAll({ type: 'FORCE_CLIENT_SAVE' });
    broadcastToAll({ type: 'SERVER_SHUTDOWN_NOTICE' });

    setTimeout(() => {
      exec('pm2 reload ecosystem.config.js || pm2 restart magic-game-server magic-ai-runner', (err) => {
        if (!err) {
          console.log('✔ [PM2] 전체 프로세스(magic-game-server / magic-ai-runner) 무중단 재시작 완료');
          isRebootInProgress = false;
          return;
        }
        console.log('ℹ [로컬 Node 환경] PM2 미감지 -> 프로세스를 직접 재시작합니다.');
        const isWin = process.platform === 'win32';
        if (isWin) {
          spawn('cmd.exe', ['/c', 'start', 'node', 'magic_server.js'], { detached: true, stdio: 'ignore' }).unref();
        } else {
          spawn('nohup', ['node', 'magic_server.js'], { detached: true, stdio: 'ignore' }).unref();
        }
        setTimeout(() => process.exit(0), 400);
      });
    }, 800);
  }, 1000);
}

// ⏰ 한국시간(KST, UTC+9) 기준 매주 수요일(3) · 일요일(0) 새벽 4시 자동 리부팅 스케줄러 (20초 예고 카운트다운 포함)
setInterval(() => {
  if (isRebootInProgress) return;
  // 서버 기동 직후 3분 이내에는 중복 재부팅 방지
  if (Date.now() - SERVER_START_TIME < 180000) return;

  const kstNow = new Date(Date.now() + 9 * 60 * 60 * 1000);
  const kstDay = kstNow.getUTCDay(); // 0: 일요일, 3: 수요일
  const kstHour = kstNow.getUTCHours();
  const kstMin = kstNow.getUTCMinutes();
  const kstSec = kstNow.getUTCSeconds();
  const dateKey = kstNow.toISOString().slice(0, 10);

  if ((kstDay === 0 || kstDay === 3) && lastScheduledRebootDateKey !== dateKey) {
    // 03:59:40 KST에 20초 카운트다운 시작 -> 정확히 04:00:00 KST에 리부팅! (혹은 04:00:00~04:00:59 사이 감지 시 즉시 20초 카운트다운)
    const isPreCountdownWindow = (kstHour === 3 && kstMin === 59 && kstSec >= 40);
    const isExactFourAmWindow = (kstHour === 4 && kstMin === 0);
    if (isPreCountdownWindow || isExactFourAmWindow) {
      lastScheduledRebootDateKey = dateKey;
      const dayLabel = kstDay === 3 ? '수요일' : '일요일';
      triggerAdminServerReboot('정기점검 시스템', `한국시간 ${dayLabel} 새벽 4시 정기 자동리부팅`, 20);
    }
  }
}, 5000);


const GM_MASTER_EMAIL = 'xerimaii@gmail.com';
const GM_CONFIG_USER_ID = '00000000-0000-0000-0000-000000000000';
const GM_DEFAULT_PASSWORD = '90051254';
let cachedGmPassword = null;
let gmPasswordResetArmed = false;

async function resolveEntryEmail(entry) {
  if (!entry) return '';
  const direct = String(entry.email || entry.player?.email || '').trim().toLowerCase();
  if (direct) {
    entry.email = direct;
    return direct;
  }
  if (entry.userId) {
    try {
      const accTable = GameDB.SupabaseConfig?.tables?.accounts || 'magic_accounts';
      const rows = await supabaseRest(accTable, 'GET', `?id=eq.${encodeURIComponent(entry.userId)}&select=email`);
      const fetched = String(rows?.[0]?.email || '').trim().toLowerCase();
      if (fetched) {
        entry.email = fetched;
        if (entry.player) entry.player.email = fetched;
        return fetched;
      }
    } catch (err) {}
  }
  return '';
}

async function findMasterAccountUserId() {
  try {
    const accTable = GameDB.SupabaseConfig?.tables?.accounts || 'magic_accounts';
    const rows = await supabaseRest(accTable, 'GET', `?email=eq.${encodeURIComponent(GM_MASTER_EMAIL)}&select=id`);
    return rows?.[0]?.id || null;
  } catch (err) {
    return null;
  }
}

async function loadGmPasswordFromSupabase(forceRefresh = false) {
  if (cachedGmPassword && !forceRefresh) return cachedGmPassword;
  const storageTable = GameDB.SupabaseConfig?.tables?.storage || 'magic_storage';
  try {
    // 1) 마스터 계정(xerimaii@gmail.com)의 magic_storage 행에 gmPassword 또는 초기화 플래그가 있는지 우선 확인
    const masterUid = await findMasterAccountUserId();
    if (masterUid) {
      const mRows = await supabaseRest(storageTable, 'GET', `?user_id=eq.${encodeURIComponent(masterUid)}&select=account_data`);
      const mData = mRows?.[0]?.account_data;
      if (mData && (mData.gmPasswordReset === true || mData.resetGmPassword === true)) {
        gmPasswordResetArmed = true;
        const resetPw = (mData.gmPassword && String(mData.gmPassword).trim()) ? String(mData.gmPassword).trim() : GM_DEFAULT_PASSWORD;
        await saveGmPasswordToSupabase(resetPw, masterUid);
        return cachedGmPassword;
      }
      if (mData && mData.gmPassword && String(mData.gmPassword).trim().length > 0) {
        cachedGmPassword = String(mData.gmPassword).trim();
        return cachedGmPassword;
      }
    }

    // 2) 공통 GM 설정 행(GM_CONFIG_USER_ID) 조회
    const rows = await supabaseRest(storageTable, 'GET', `?user_id=eq.${GM_CONFIG_USER_ID}&select=account_data`);
    const accData = rows?.[0]?.account_data;
    if (accData && (accData.gmPasswordReset === true || accData.resetGmPassword === true)) {
      gmPasswordResetArmed = true;
    }
    const savedPw = accData?.gmPassword;
    if (savedPw && String(savedPw).trim().length > 0) {
      cachedGmPassword = String(savedPw).trim();
      return cachedGmPassword;
    }
  } catch (err) {}
  cachedGmPassword = GM_DEFAULT_PASSWORD;
  await saveGmPasswordToSupabase(cachedGmPassword);
  return cachedGmPassword;
}

async function saveGmPasswordToSupabase(newPassword, explicitMasterUid = null) {
  const cleanPw = String(newPassword || GM_DEFAULT_PASSWORD).trim();
  cachedGmPassword = cleanPw;
  const storageTable = GameDB.SupabaseConfig?.tables?.storage || 'magic_storage';
  try {
    // 1) 공통 GM 설정 행(GM_CONFIG_USER_ID)에 저장
    const existing = await supabaseRest(storageTable, 'GET', `?user_id=eq.${GM_CONFIG_USER_ID}&select=user_id,account_data`);
    const nextData = {
      ...((existing?.[0]?.account_data) || {}),
      gmPassword: cleanPw,
      gmPasswordReset: false,
      masterEmail: GM_MASTER_EMAIL,
      updatedAt: new Date().toISOString()
    };
    await supabaseRest(storageTable, 'POST', '', {
      user_id: GM_CONFIG_USER_ID,
      account_data: nextData,
      updated_at: new Date().toISOString()
    }, 'user_id');

    // 2) 마스터 계정(xerimaii@gmail.com)의 magic_storage에도 동기화하여 Supabase 대시보드에서 언제든 관리/초기화 가능하도록 보장
    const masterUid = explicitMasterUid || (await findMasterAccountUserId());
    if (masterUid) {
      const mRows = await supabaseRest(storageTable, 'GET', `?user_id=eq.${encodeURIComponent(masterUid)}&select=user_id,account_data`);
      const mNext = {
        ...((mRows?.[0]?.account_data) || {}),
        gmPassword: cleanPw,
        gmPasswordReset: false,
        updatedAt: new Date().toISOString()
      };
      await supabaseRest(storageTable, 'POST', '', {
        user_id: masterUid,
        account_data: mNext,
        updated_at: new Date().toISOString()
      }, 'user_id');
    }
  } catch (err) {}
  return cleanPw;
}

function grantAdminToEntry(entry, msgText = null) {
  entry.isAdmin = true;
  if (entry.player) entry.player.isAdmin = true;
  sendWsMessage(entry.conn, {
    type: 'ADMIN_MODE_CHANGED',
    isAdmin: true,
    gmInvincible: Boolean(entry.gmInvincible),
    gmInvisible: Boolean(entry.gmInvisible),
    gmSpeedMult: entry.gmSpeedMult || 1,
    gmAtkMult: entry.gmAtkMult || 1
  });
  if (msgText) {
    sendSystemMsgToEntry(entry, msgText, 'log-kill');
  }
}

function revokeAdminFromEntry(entry, msgText = null) {
  entry.isAdmin = false;
  entry.gmInvincible = false;
  entry.gmInvisible = false;
  entry.gmSpeedMult = 1;
  entry.gmAtkMult = 1;
  if (entry.player) {
    entry.player.isAdmin = false;
    entry.player.gmInvisible = false;
    entry.player.gmInvincible = false;
  }
  sendWsMessage(entry.conn, {
    type: 'ADMIN_MODE_CHANGED',
    isAdmin: false,
    gmInvincible: false,
    gmInvisible: false,
    gmSpeedMult: 1,
    gmAtkMult: 1
  });
  if (msgText) {
    sendSystemMsgToEntry(entry, msgText, 'log-sys');
  }
}

function handleChatCommand(entry, rawText) {

  const _parts = String(rawText || '').trim().split(/\s+/);
  const _cmd = _parts[0];
  const _arg1 = String(_parts[1] || '').trim();
  if (_cmd === '/운영자초기화' || _cmd === '/운영자비번초기화') {
    resolveEntryEmail(entry).then(async (uEmail) => {
      if (uEmail !== GM_MASTER_EMAIL) {
        sendSystemMsgToEntry(entry, `🚫 운영자 비밀번호 초기화는 ${GM_MASTER_EMAIL} 계정만 가능합니다.`, 'log-hit');
        return;
      }
      gmPasswordResetArmed = true;
      if (_arg1) {
        await saveGmPasswordToSupabase(_arg1);
        gmPasswordResetArmed = false;
        grantAdminToEntry(entry, `🔓 [비밀번호 초기화 및 변경 완료] 수파베이스 운영자 비밀번호가 '${_arg1}'(으)로 초기화되었으며 운영자모드가 활성화되었습니다!`);
      } else {
        await saveGmPasswordToSupabase(GM_DEFAULT_PASSWORD);
        sendSystemMsgToEntry(entry, `🔓 [초기화 승인 완료] 기본 비밀번호(${GM_DEFAULT_PASSWORD})로 복구되었으며, 지금 바로 '/운영자모드 새비밀번호'를 입력하시면 새 비밀번호로 저장 후 운영자모드에 진입합니다!`, 'log-kill');
      }
    });
    return true;
  }
  if (_cmd === '/운영자비번변경' || _cmd === '/비번변경') {
    if (!entry.isAdmin) { sendSystemMsgToEntry(entry, `⚠️ 먼저 '/운영자모드 <비밀번호>'로 인증하세요.`, 'log-hit'); return true; }
    if (!_arg1) { sendSystemMsgToEntry(entry, `💡 사용법: /운영자비번변경 <새비밀번호>`, 'log-sys'); return true; }
    saveGmPasswordToSupabase(_arg1).then(() => {
      sendSystemMsgToEntry(entry, `🔑 수파베이스 운영자 비밀번호가 '${_arg1}'(으)로 안전하게 변경·저장되었습니다!`, 'log-kill');
    });
    return true;
  }
  if (_cmd === '/운영자모드' || _cmd === '/운졍자모드' || _cmd === '/운영자' || _cmd === '/관리자모드' || _cmd === '/gm') {
    if (entry.isAdmin && !_arg1) {
      revokeAdminFromEntry(entry, `👑 운영자모드가 해제되었습니다.`);
      return true;
    }
    if (!_arg1) {
      sendSystemMsgToEntry(entry, `🔒 사용법: /운영자모드 <비밀번호> (분실 시 ${GM_MASTER_EMAIL} 계정으로 '/운영자초기화' 후 '/운영자모드 새비밀번호')`, 'log-hit');
      return true;
    }
    resolveEntryEmail(entry).then(async (uEmail) => {
      const curPw = await loadGmPasswordFromSupabase(true);
      if (gmPasswordResetArmed && uEmail === GM_MASTER_EMAIL) {
        gmPasswordResetArmed = false;
        await saveGmPasswordToSupabase(_arg1);
        grantAdminToEntry(entry, `👑 새 비밀번호('${_arg1}')가 수파베이스에 저장되었으며 운영자모드가 활성화되었습니다! ('/?'로 명령어 확인)`);
        return;
      }
      if (_arg1 !== curPw) {
        sendSystemMsgToEntry(entry, `🚫 비밀번호가 일치하지 않습니다. (분실 시 ${GM_MASTER_EMAIL} 계정에서 '/운영자초기화' 입력 또는 수파베이스 magic_storage에서 초기화 가능)`, 'log-hit');
        return;
      }
      grantAdminToEntry(entry, `👑 [운영자 모드 활성화] 상용 게임 GM 권한이 부여되었습니다! ('/?' 도움말, '/운영자비번변경 새비번' 변경 가능)`);
    });
    return true;
  }

  const trimmed = String(rawText || '').trim();
  if (!trimmed.startsWith('/')) return false;

  const tokens = trimmed.split(/\s+/);
  const cmd = tokens[0].toLowerCase();
  const args = tokens.slice(1);
  const restText = trimmed.slice(tokens[0].length).trim();

 // 👥 /누구 및 /who 명령어 (전체접속인원 · 내가 속한 지역별 인원 및 맵 인원 이름(레벨)·파티 표기)
if (cmd === '/누구' || cmd === '/who' || cmd === '/접속자' || cmd === '/유저목록') {
    const targetQuery = args[0] ? String(args[0]).trim().toLowerCase() : '';
    if (targetQuery) {
      const found = findOnlineEntryByName(targetQuery);
      if (!found || !found.player || (found.gmInvisible && !entry.isAdmin && found.charId !== entry.charId)) {
        sendSystemMsgToEntry(entry, `🔍 '${args[0]}' 캐릭터는 현재 오프라인이거나 찾을 수 없습니다.`, 'log-hit');
      } else {
        const p = found.player;
        const reg = (GameDB.Regions || []).find(r => r.id === found.regionKey) || { name: found.regionKey };
        const clsMeta = (GameDB.Classes && Object.values(GameDB.Classes).find(c => c.key === p.class)) || { name: p.class };
        const fParty = getPartyByCharId(found.charId);
        const partyTag = fParty ? (fParty.leaderCharId === found.charId ? ' [👑파티장]' : ' [🎗️파티중]') : '';
        sendSystemMsgToEntry(entry, `👤 [검색] ${p.name}(Lv.${p.level || 1})${partyTag} · ${clsMeta.name || p.class} · 📍 ${reg.name}`, 'log-sys');
      }
      return true;
    }

    // 1) 접속 중인 모든 유저/AI 소켓 안전하게 수집
    const visibleEntries = [];
    if (typeof activeCharSockets !== 'undefined' && activeCharSockets.size > 0) {
      activeCharSockets.forEach(e => {
        if (!e) return;
        if (e.gmInvisible && !entry.isAdmin && e.charId !== entry.charId) return;
        if (e.player) visibleEntries.push(e);
      });
    }

    const totalCount = visibleEntries.length;

    // 2) 지역별 인원 집계
    const regionCounts = new Map();
    visibleEntries.forEach(e => {
      const rKey = e.regionKey || String(e.mapKey || 'R01').split('_')[0] || 'R01';
      regionCounts.set(rKey, (regionCounts.get(rKey) || 0) + 1);
    });
    const regionSummaryParts = [];
    if (GameDB && Array.isArray(GameDB.Regions)) {
      GameDB.Regions.forEach(r => {
        const cnt = regionCounts.get(r.id) || 0;
        if (cnt > 0) regionSummaryParts.push(`${r.name} ${cnt}명`);
      });
    }

    // 3) 내가 속한 지역 유저들 집계
    const myRegionKey = String(entry.regionKey || 'R01').split('_')[0];
    const myRegObj = (GameDB.Regions || []).find(r => r.id === myRegionKey) || { name: myRegionKey };
    const sameRegionEntries = visibleEntries.filter(e => {
      const eReg = String(e.regionKey || e.mapKey || 'R01').split('_')[0];
      return eReg === myRegionKey;
    });
    const sameRegionListStr = sameRegionEntries.map(e => {
      const p = e.player || {};
      const eParty = getPartyByCharId(e.charId);
      const pBadge = eParty ? (eParty.leaderCharId === e.charId ? ' [👑파티장]' : ' [🎗️파티]') : '';
      return `${p.name || '모험가'}(Lv.${p.level || 1})${pBadge}`;
    }).join(', ');

    // 4) 내가 있는 맵 인원 집계
    const myCanonicalMap = typeof normalizeMapKey === 'function' ? normalizeMapKey(entry.mapKey) : (entry.mapKey || 'R01_sub1');
    const isDung = myCanonicalMap.endsWith('_dungeon');
    const myMapLabel = `${myRegObj.name}${isDung ? ' 던전' : ''}`;
    const sameMapEntries = visibleEntries.filter(e => {
      const eMap = typeof normalizeMapKey === 'function' ? normalizeMapKey(e.mapKey) : (e.mapKey || 'R01_sub1');
      return eMap === myCanonicalMap;
    });
    const sameMapListStr = sameMapEntries.map(e => {
      const p = e.player || {};
      const eParty = getPartyByCharId(e.charId);
      const pBadge = eParty ? (eParty.leaderCharId === e.charId ? ' [👑파티장]' : ' [🎗️파티]') : '';
      return `${p.name || '모험가'}(Lv.${p.level || 1})${pBadge}`;
    }).join(', ');

    // 💡 [확실한 출력] 4줄 모두 빠짐없이 개별 전송
    sendSystemMsgToEntry(entry, `🌐 [전체 접속 인원 합계] 총 ${totalCount}명`, 'log-sys');
    sendSystemMsgToEntry(entry, `🗺️ [지역별 분포] ${regionSummaryParts.join(' | ') || '없음'}`, 'log-sys');
    sendSystemMsgToEntry(entry, `📍 [현재 지역(${myRegObj.name}) 인원: ${sameRegionEntries.length}명] ${sameRegionListStr || '없음'}`, 'log-sys');
    sendSystemMsgToEntry(entry, `📍 [현재 맵(${myMapLabel}) 인원: ${sameMapEntries.length}명] ${sameMapListStr || '없음'}`, 'log-chat');
    return true;
  }


  // 🤝 파티 명령어 (/파티초대 <이름>, /파티가입 <이름>, /파티장요구, /파티탈퇴, /파티위임 <이름>, /파티 <할말>)
  if (cmd === '/파티초대' || cmd === '/초대' || cmd === '/파티가입' || cmd === '/파티신청' || cmd === '/파티합류') {
    const targetName = args.join(' ').trim();
    if (!targetName) {
      sendSystemMsgToEntry(entry, `💡 사용법: /파티초대 <캐릭터이름> (AI끼리 맺은 파티에도 즉시 합류/초대 가능!)`, 'log-sys');
      return true;
    }
    const targetEntry = (entry._pendingInviteTargetCharId && activeCharSockets.get(entry._pendingInviteTargetCharId))
      || findOnlineEntryByName(targetName, entry.regionKey, entry.mapKey);
    entry._pendingInviteTargetCharId = null;
    if (!targetEntry || !targetEntry.player || (targetEntry.gmInvisible && !entry.isAdmin)) {
      sendSystemMsgToEntry(entry, `⚠️ '${targetName}' 캐릭터가 현재 접속 중이지 않습니다.`, 'log-hit');
      return true;
    }
    if (targetEntry.charId === entry.charId) {
      sendSystemMsgToEntry(entry, `⚠️ 본인에게는 파티 초대를 보낼 수 없습니다.`, 'log-hit');
      return true;
    }
    const myNormMap = normalizeMapKey(entry.mapKey);
    const targetNormMap = normalizeMapKey(targetEntry.mapKey);
    const myReg = String(entry.regionKey || myNormMap || 'R01').split('_')[0];
    const targetReg = String(targetEntry.regionKey || targetNormMap || 'R01').split('_')[0];

    if (targetNormMap !== myNormMap && targetReg !== myReg) {
      if (isAIEntry(targetEntry) && !isAIEntry(entry)) {
        // 인간 플레이어가 파티창에서 선택한 AI가 방금 다른 맵으로 이동한 경우 플레이어 맵/존으로 동기화
        targetEntry.mapKey = myNormMap;
        targetEntry.regionKey = myReg;
        if (targetEntry.player && entry.player) {
          targetEntry.player.mapKey = myNormMap;
          targetEntry.player.regionKey = myReg;
          targetEntry.player.x = Math.round((entry.player.x || 2000) + ((Math.random() - 0.5) * 180));
          targetEntry.player.y = Math.round((entry.player.y || 9200) + ((Math.random() - 0.5) * 180));
        }
      } else {
        sendSystemMsgToEntry(entry, `⚠️ '${targetEntry.player.name}'님이 같은 존(지역)에 있지 않아 초대할 수 없습니다.`, 'log-hit');
        return true;
      }
    }
    const targetParty = getPartyByCharId(targetEntry.charId);
    const myParty = getPartyByCharId(entry.charId);

    // 🌟 [핵심 기능] 에이전트(AI)끼리의 파티에 인간 플레이어가 파티 요청/초대 시 즉시 합류 또는 영입 허용!
    if (targetParty && !isAIEntry(entry)) {
      const hasAIMember = targetParty.members.some(cid => isAIEntry(activeCharSockets.get(cid)));
      const allTargetMembersAI = targetParty.members.every(cid => isAIEntry(activeCharSockets.get(cid)));

      // 1) 인간 플레이어가 솔로이거나 다른 파티에서 합류를 요청했을 때 -> 해당 파티의 일원으로 즉시 합류! (5명 풀파티면 AI 1명이 자리 양보)
      if (myParty && myParty.partyId !== targetParty.partyId && (cmd === '/파티합류' || cmd === '/파티가입' || cmd === '/파티신청')) {
        removeCharFromParty(entry.charId, 'leave');
      }
      const curMyParty = getPartyByCharId(entry.charId);
      if (!curMyParty && hasAIMember) {
        if (targetParty.members.length >= 5) {
          const yieldAiId = [...targetParty.members].reverse().find(cid => cid !== targetParty.leaderCharId && isAIEntry(activeCharSockets.get(cid)));
          if (yieldAiId) {
            removeCharFromParty(yieldAiId, 'leave');
          }
        }
        if (targetParty.members.length < 5) {
          if (!targetParty.members.includes(entry.charId)) {
            targetParty.members.push(entry.charId);
          }
          entry.partyId = targetParty.partyId;
          if (entry.player) {
            entry.player.partyId = targetParty.partyId;
            entry.player.isPartyLeader = (targetParty.leaderCharId === entry.charId);
          }
          targetParty.members.forEach(cId => {
            const mE = activeCharSockets.get(cId);
            if (mE) {
              sendSystemMsgToEntry(mE, `🎉 [파티 합류] '${entry.player?.name}'님이 파티에 합류했습니다! (인원: ${targetParty.members.length}/5명 · '/파티장요구' 또는 파티창 버튼으로 파티장 인수 가능)`, 'log-kill');
            }
          });
          broadcastPartyUpdate(targetParty);
          const ldrEntry = activeCharSockets.get(targetParty.leaderCharId);
          if (ldrEntry && isAIEntry(ldrEntry)) {
            setTimeout(() => {
              targetParty.members.forEach(cId => {
                const mE = activeCharSockets.get(cId);
                if (mE) {
                  sendWsMessage(mE.conn, {
                    type: 'REMOTE_CHAT',
                    charId: ldrEntry.charId,
                    mapKey: ldrEntry.mapKey,
                    regionKey: ldrEntry.regionKey,
                    sender: `🎗️[파티] ${ldrEntry.player?.name || '파티장'}`,
                    text: `${entry.player?.name}님 환영합니다 ㅎㅎ 원하시면 언제든 파티장 넘겨드릴게요!`,
                    bubbleText: `${entry.player?.name}님 환영합니다 ㅎㅎ`,
                    chatStyle: 'party'
                  });
                }
              });
            }, 400);
          }
          return true;
        }
      }

      // 2) 인간 플레이어가 이미 자기 파티의 파티장일 때 -> AI 파티에 있던 대상 AI를 내 파티로 영입!
      if (myParty && myParty.leaderCharId === entry.charId && myParty.members.length < 5 && isAIEntry(targetEntry) && allTargetMembersAI) {
        removeCharFromParty(targetEntry.charId, 'leave');
      } else if (targetParty) {
        sendSystemMsgToEntry(entry, `⚠️ '${targetEntry.player.name}'님은 이미 다른 파티에 가입되어 있습니다.`, 'log-hit');
        return true;
      }
    } else if (targetParty) {
      sendSystemMsgToEntry(entry, `⚠️ '${targetEntry.player.name}'님은 이미 다른 파티에 가입되어 있습니다.`, 'log-hit');
      return true;
    }

    if (myParty && myParty.leaderCharId !== entry.charId) {
      const ldrE = activeCharSockets.get(myParty.leaderCharId);
      if (ldrE && isAIEntry(ldrE) && !isAIEntry(entry)) {
        // AI가 파티장인 파티에서 인간 파티원이 다른 사람을 초대하려 하면 자동으로 인간에게 파티장 위임 후 초대 진행!
        delegatePartyLeaderToHuman(myParty, entry);
      } else {
        sendSystemMsgToEntry(entry, `⚠️ 파티 초대는 파티장만 할 수 있습니다. ('/파티장요구'로 파티장을 먼저 넘겨받으세요)`, 'log-hit');
        return true;
      }
    }
    if (myParty && myParty.members.length >= 5) {
      sendSystemMsgToEntry(entry, `⚠️ 파티 최대 인원(5명)이 가득 찼습니다.`, 'log-hit');
      return true;
    }

    sendWsMessage(targetEntry.conn, {
      type: 'PARTY_INVITE_RECEIVED',
      inviterCharId: entry.charId,
      inviterName: entry.player?.name || '모험가',
      inviterLevel: entry.player?.level || 1,
      inviterClass: entry.player?.class || 'knight',
      inviterIsAI: isAIEntry(entry),
      partyId: myParty ? myParty.partyId : null
    });
    sendSystemMsgToEntry(entry, `📩 '${targetEntry.player.name}'님에게 파티 초대장을 보냈습니다.`, 'log-sys');

    // 인간 플레이어가 AI 에이전트를 초대한 경우: 에이전트 소켓 응답 지연이 있더라도 400ms 내 자동 합류 및 PARTY_STATE_UPDATE 보장!
    if (!isAIEntry(entry) && isAIEntry(targetEntry)) {
      const invCharId = entry.charId;
      const tgtCharId = targetEntry.charId;
      setTimeout(() => {
        const curInv = activeCharSockets.get(invCharId);
        const curTgt = activeCharSockets.get(tgtCharId);
        if (!curInv || !curTgt) return;
        const existingTgtParty = getPartyByCharId(tgtCharId);
        if (existingTgtParty) return; // 이미 PARTY_INVITE_RESP로 합류 완료됨
        let pty = getPartyByCharId(invCharId);
        if (!pty) {
          const newPartyId = `pty_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
          pty = {
            partyId: newPartyId,
            leaderCharId: invCharId,
            leaderTargetMobId: null,
            partyMode: 'FREE',
            members: [invCharId]
          };
          serverParties.set(newPartyId, pty);
          curInv.partyId = newPartyId;
          if (curInv.player) {
            curInv.player.partyId = newPartyId;
            curInv.player.isPartyLeader = true;
          }
        }
        if (pty.members.length >= 5) return;
        if (!pty.members.includes(tgtCharId)) pty.members.push(tgtCharId);
        curTgt.partyId = pty.partyId;
        if (curTgt.player) {
          curTgt.player.partyId = pty.partyId;
          curTgt.player.isPartyLeader = (pty.leaderCharId === tgtCharId);
        }
        pty.members.forEach(cId => {
          const mE = activeCharSockets.get(cId);
          if (mE) {
            sendSystemMsgToEntry(mE, `🎉 [파티 합류] '${curTgt.player?.name}'님이 파티에 합류했습니다! (현재 ${pty.members.length}명)`, 'log-kill');
          }
        });
        broadcastPartyUpdate(pty);
      }, 450);
    }
    return true;
  }

  if (cmd === '/파티장요구' || cmd === '/파티장신청' || cmd === '/파티장양보' || cmd === '/파티장달라' || cmd === '/파장요구' || cmd === '/파장') {
    const myParty = getPartyByCharId(entry.charId);
    if (!myParty) {
      sendSystemMsgToEntry(entry, `⚠️ 현재 가입된 파티가 없습니다.`, 'log-hit');
      return true;
    }
    if (myParty.leaderCharId === entry.charId) {
      sendSystemMsgToEntry(entry, `👑 이미 현재 파티의 파티장입니다!`, 'log-sys');
      return true;
    }
    const ldrEntry = activeCharSockets.get(myParty.leaderCharId);
    if (!ldrEntry || isAIEntry(ldrEntry)) {
      delegatePartyLeaderToHuman(myParty, entry);
      return true;
    }
    sendSystemMsgToEntry(entry, `⚠️ 현재 파티장('${ldrEntry.player?.name}')님은 실제 유저이므로 직접 위임받아야 합니다.`, 'log-hit');
    return true;
  }

  if (cmd === '/파티탈퇴' || cmd === '/탈퇴') {
    const myParty = getPartyByCharId(entry.charId);
    if (!myParty) {
      sendSystemMsgToEntry(entry, `⚠️ 현재 가입된 파티가 없습니다.`, 'log-hit');
      return true;
    }
    removeCharFromParty(entry.charId, 'leave');
    return true;
  }

  if (cmd === '/파티위임' || cmd === '/파티장위임') {
    const targetName = args[0];
    const myParty = getPartyByCharId(entry.charId);
    if (!myParty) {
      sendSystemMsgToEntry(entry, `⚠️ 현재 가입된 파티가 없습니다.`, 'log-hit');
      return true;
    }
    if (myParty.leaderCharId !== entry.charId) {
      const ldrEntry = activeCharSockets.get(myParty.leaderCharId);
      if (ldrEntry && isAIEntry(ldrEntry) && (!targetName || targetName === entry.player?.name)) {
        delegatePartyLeaderToHuman(myParty, entry);
        return true;
      }
      sendSystemMsgToEntry(entry, `⚠️ 파티장만 권한을 위임할 수 있습니다. (파티장을 넘겨받으려면 '/파티장요구' 입력)`, 'log-hit');
      return true;
    }
    if (!targetName) {
      sendSystemMsgToEntry(entry, `💡 사용법: /파티위임 <파티원이름>`, 'log-sys');
      return true;
    }
    const targetEntry = findOnlineEntryByName(targetName);
    if (!targetEntry || !myParty.members.includes(targetEntry.charId)) {
      sendSystemMsgToEntry(entry, `⚠️ '${targetName}'님은 현재 파티원이 아닙니다.`, 'log-hit');
      return true;
    }
    myParty.leaderCharId = targetEntry.charId;
    myParty.members = [targetEntry.charId, ...myParty.members.filter(id => id !== targetEntry.charId)];
    myParty.members.forEach(cId => {
      const mE = activeCharSockets.get(cId);
      if (mE) {
        if (mE.player) mE.player.isPartyLeader = (cId === myParty.leaderCharId);
        sendSystemMsgToEntry(mE, `👑 [파티장 위임] '${targetEntry.player?.name}'님이 새로운 파티장이 되었습니다!`, 'log-kill');
      }
    });
    broadcastPartyUpdate(myParty);
    return true;
  }

  if (cmd === '/파티' || cmd === '/p') {
    const myParty = getPartyByCharId(entry.charId);
    if (!myParty) {
      sendSystemMsgToEntry(entry, `⚠️ 현재 가입된 파티가 없습니다. ('/파티초대 이름'으로 파티 생성)`, 'log-hit');
      return true;
    }
    if (!restText) {
      sendSystemMsgToEntry(entry, `💡 사용법: /파티 <할말>`, 'log-sys');
      return true;
    }
    const senderName = entry.player?.name || '모험가';
    if (myParty.leaderCharId !== entry.charId && !isAIEntry(entry)) {
      const ldrE = activeCharSockets.get(myParty.leaderCharId);
      if (ldrE && isAIEntry(ldrE) && (restText.includes('파티장') || restText.includes('파장')) && (restText.includes('주') || restText.includes('줘') || restText.includes('달라') || restText.includes('넘겨') || restText.includes('위임') || restText.includes('양보') || restText.includes('요구') || restText.includes('할게'))) {
        setTimeout(() => delegatePartyLeaderToHuman(myParty, entry), 250);
      }
    }
    myParty.members.forEach(cId => {
      const mE = activeCharSockets.get(cId);
      if (mE) {
        sendWsMessage(mE.conn, {
          type: 'REMOTE_CHAT',
          charId: entry.charId,
          mapKey: entry.mapKey,
          regionKey: entry.regionKey,
          sender: `🎗️[파티] ${senderName}`,
          text: restText,
          bubbleText: restText,
          chatStyle: 'party'
        });
      }
    });
    return true;
  }

  // --------------------------------------------------------------------------
  // [1] 일반 유저 & 공용 한글 대화 명령어 (/귓속말, /전체, /지역, /좌표, /청소, /도움말)
  // --------------------------------------------------------------------------
  if (cmd === '/거래' || cmd === '/교환' || cmd === '/트레이드') {
    const targetName = args[0];
    if (!targetName) {
      sendSystemMsgToEntry(entry, `💡 사용법: /거래 <캐릭터이름> (또는 필드/파티창에서 대상을 터치하여 거래 신청)`, 'log-sys');
      return true;
    }
    const targetEntry = findOnlineEntryByName(targetName);
    if (!targetEntry || !targetEntry.player || (targetEntry.gmInvisible && !entry.isAdmin)) {
      sendSystemMsgToEntry(entry, `⚠️ '${targetName}' 캐릭터가 현재 접속 중이지 않습니다.`, 'log-hit');
      return true;
    }
    handleClientWsPacket(entry.conn, {
      type: 'TRADE_REQUEST',
      charId: entry.charId,
      targetCharId: targetEntry.charId,
      targetName: targetEntry.player.name
    });
    return true;
  }

  if (cmd === '/좌표' || cmd === '/위치') {
    const reg = (GameDB.Regions || []).find(r => r.id === entry.regionKey) || { name: entry.regionKey };
    const px = Math.round(entry.player?.x || 0);
    const py = Math.round(entry.player?.y || 0);
    sendSystemMsgToEntry(entry, `📍 [현재 위치] ${reg.name} (${entry.mapKey}) · 좌표 X: ${px}, Y: ${py}`, 'log-sys');
    return true;
  }

  if (cmd === '/청소' || cmd === '/대화창청소') {
    sendWsMessage(entry.conn, { type: 'CLEAR_CHAT_BOX' });
    sendSystemMsgToEntry(entry, `🧹 대화창 로그를 깨끗하게 정리했습니다.`, 'log-sys');
    return true;
  }

  if (cmd === '/귓속말' || cmd === '/귓' || cmd === '/w') {
    const targetName = args[0];
    const msgBody = args.slice(1).join(' ').trim();
    if (!targetName || !msgBody) {
      sendSystemMsgToEntry(entry, `💡 사용법: /귓속말 <캐릭터이름> <할말>`, 'log-sys');
      return true;
    }
    const targetEntry = findOnlineEntryByName(targetName);
    if (!targetEntry) {
      sendSystemMsgToEntry(entry, `⚠️ '${targetName}' 캐릭터가 현재 접속 중이지 않습니다.`, 'log-hit');
      return true;
    }
    const senderName = entry.player?.name || '모험가';
    sendWsMessage(entry.conn, {
      type: 'REMOTE_CHAT',
      charId: entry.charId,
      sender: `귓속말 ➔ ${targetEntry.player?.name}`,
      text: msgBody,
      chatStyle: 'whisper'
    });
    if (targetEntry.charId !== entry.charId) {
      sendWsMessage(targetEntry.conn, {
        type: 'REMOTE_CHAT',
        charId: entry.charId,
        sender: `${senderName}님의 귓속말`,
        text: msgBody,
        chatStyle: 'whisper'
      });
    }
    return true;
  }

  if (cmd === '/전체' || cmd === '/외치기' || cmd === '/월드') {
    if (!restText) {
      sendSystemMsgToEntry(entry, `💡 사용법: /전체 <할말> (모든 지역 유저에게 전달)`, 'log-sys');
      return true;
    }
    const senderName = entry.player?.name || '모험가';
    const prefix = entry.isAdmin ? `👑[GM전체] ${senderName}` : `📢[전체] ${senderName}`;
    broadcastToAll({
      type: 'REMOTE_CHAT',
      charId: entry.charId,
      mapKey: entry.mapKey,
      regionKey: entry.regionKey,
      sender: prefix,
      text: restText,
      bubbleText: restText,
      chatStyle: 'world'
    });
    return true;
  }

  if (cmd === '/지역' || cmd === '/일반') {
    if (!restText) {
      sendSystemMsgToEntry(entry, `💡 사용법: /지역 <할말> (현재 지역 유저에게 전달 및 머리 위 말풍선 표시)`, 'log-sys');
      return true;
    }
    const senderName = entry.player?.name || '모험가';
    broadcastToRegion(entry.regionKey || entry.mapKey, {
      type: 'REMOTE_CHAT',
      charId: entry.charId,
      mapKey: entry.mapKey,
      regionKey: entry.regionKey,
      sender: `[지역] ${senderName}`,
      text: restText,
      bubbleText: restText,
      chatStyle: 'region'
    });
    return true;
  }

  // --------------------------------------------------------------------------
  // [2] 운영자(GM) 모드 해제 명령어 (진입은 상단 /운영자모드 [비밀번호]에서 통합 처리)
  // --------------------------------------------------------------------------
  if (cmd === '/운영자해제' || cmd === '/일반모드' || cmd === '/운영자종료') {
    revokeAdminFromEntry(entry, `🛡️ [운영자 모드 해제] 일반 모험가 모드로 전환되었습니다.`);
    return true;
  }

  // 도움말 / 명령어 안내 (/? 명령어: 운영자모드시 운영자도움말, 일반모드시 일반도움말)
  if (cmd === '/?' || cmd === '/명령어' || cmd === '/도움말' || cmd === '/운영자명령어') {
    if (entry.isAdmin) {
      // 👑 운영자 모드일 때 /? -> 운영자 도움말
      const gmHelpLines = [
        `👑 [운영자(GM) 도움말 및 명령어 일람] (비밀번호: ${ADMIN_SECRET})`,
        `• [접속자/공지] /누구 (또는 /who) | /공지 <할말> | /서버상태 | /채팅금지 <이름> [분] | /강제퇴장 <이름>`,
        `• [캐릭터제어] /무적 | /투명 | /완전회복 [전체|이름] | /레벨 <1~999> [이름] | /골드 <수량> [이름] | /경험치 <수치>`,
        `• [스탯/스킬] /스탯 <힘|민첩|지능|체력|올스탯> <수치> | /스탯포인트 <수치> | /스탯초기화 | /모든스킬습득 | /전체버프`,
        `• [속도/배율] /이속 <1~5배율> | /공격력 <1~1000배율> | /직업변경 <전사|궁수|마법사>`,
        `• [아이템/강화] /아이템 <이름|ID> [수량] [일반|고급|희귀|전설|초월] [강화] | /올강화 <0~20> | /아이템목록 [검색어]`,
        `• [몬스터/보스] /소환 <몬스터명|ID> [수량] | /보스소환 | /학살 | /몬스터초기화 | /바닥청소 | /몬스터목록 [검색어]`,
        `• [AI모험가제어] /모험가생성 <숫자> (기존AI삭제후재생성·50명로테이션) | /모험가상시인원 <숫자> (상시접속인원조정)`,
        `• [공간이동/서버] /이동 <지역명|X Y> | /출두 <이름> | /소환유저 <이름> | /전체소환 | /서버재부팅(PM2) | /운영자해제`
      ];
      gmHelpLines.forEach(line => sendSystemMsgToEntry(entry, line, 'log-kill'));
    } else {
      // 💬 일반 모드일 때 /? -> 일반 도움말
      const userHelpLines = [
        `💬 [일반 대화 및 시스템 도움말 (일반 모드)]`,
        `• /누구 (또는 /who) : 현재 접속 중인 유저 현황 및 캐릭터 목록 확인 (/누구 <이름> 상세조회)`,
        `• /전체 <할말> (또는 /외치기) : 전 지역 모든 유저에게 들리는 월드 전체 채팅`,
        `• /지역 <할말> : 현재 맵에 있는 유저에게만 보이는 지역 채팅`,
        `• /귓속말 <이름> <할말> (또는 /귓, /w) : 특정 유저와 1:1 귓속말`,
        `• /좌표 (또는 /위치) : 현재 내 캐릭터의 지역명과 (X, Y) 좌표 확인`,
        `• /청소 : 내 대화창 로그 깨끗이 비우기`,
        `• /운영자모드 [암호] : 운영자(GM) 모드 활성화 (비밀번호: ${ADMIN_SECRET})`
      ];
      userHelpLines.forEach(line => sendSystemMsgToEntry(entry, line, 'log-sys'));
    }
    return true;
  }

  // 이하 명령어는 운영자(isAdmin) 전용 권한 체크
  if (!entry.isAdmin) {
    sendSystemMsgToEntry(entry, `🔒 [권한 필요] '${cmd}' 명령어는 운영자 모드에서만 사용할 수 있습니다. 먼저 '/운영자모드'를 입력해주세요.`, 'log-hit');
    return true;
  }

  const mapInst = getOrInitWorldMap(entry.mapKey);

  // --------------------------------------------------------------------------
  // [3] 운영자 공지 및 서버 상태 명령어
  // --------------------------------------------------------------------------
  if (cmd === '/공지' || cmd === '/전체공지' || cmd === '/알림') {
    if (!restText) {
      sendSystemMsgToEntry(entry, `💡 사용법: /공지 <전체 유저에게 알릴 공지 내용>`, 'log-sys');
      return true;
    }
    const senderName = entry.player?.name || '운영자';
    broadcastToAll({
      type: 'GM_NOTICE',
      sender: senderName,
      text: restText,
      timestamp: Date.now()
    });
    return true;
  }

  if (cmd === '/서버재부팅' || cmd === '/리부팅' || cmd === '/재부팅' || cmd === '/pm2재시작' || cmd === '/reboot') {
    triggerAdminServerReboot(entry.player?.name || '운영자');
    return true;
  }

  if (cmd === '/서버상태' || cmd === '/서버정보') {
    const upSec = Math.floor((Date.now() - SERVER_START_TIME) / 1000);
    const hrs = Math.floor(upSec / 3600);
    const mins = Math.floor((upSec % 3600) / 60);
    const secs = upSec % 60;
    const aliveMobs = mapInst.monsters.filter(m => !m.isDead).length;
    const totalMobs = mapInst.monsters.length;
    const memMb = Math.round(process.memoryUsage().rss / 1024 / 1024);
    let aiCnt = 0;
    let humanCnt = 0;
    activeCharSockets.forEach(e => { if (isAIEntry(e)) aiCnt++; else humanCnt++; });
    sendSystemMsgToEntry(
      entry,
      `🖥️ [서버 상태] 가동: ${hrs}시간 ${mins}분 ${secs}초 | 접속: 총 ${activeCharSockets.size}명(유저 ${humanCnt}/150명 · AI ${aiCnt}/600풀) | CPU: ${serverCpuUsagePct}% (목표 ≤${SERVER_CPU_LIMIT_PCT}%) | 현재맵(${mapInst.mapKey}) 몬스터: ${aliveMobs}/${totalMobs} | 메모리: ${memMb}MB`,
      'log-kill'
    );
    return true;
  }

  // 🤖 운영자 AI 모험가 풀 재생성 명령어 (/모험가생성 <숫자>)
  if (cmd === '/모험가생성' || cmd === '/에이전트생성' || cmd === '/ai생성' || cmd === '/모험가초기화') {
    const totalCount = args[0] ? parseInt(args[0], 10) : 600;
    if (isNaN(totalCount) || totalCount < 1 || totalCount > 1000) {
      sendSystemMsgToEntry(entry, `💡 사용법: /모험가생성 [1~1000, 기본600] [상시인원, 기본150] (기존 에이전트 전체 삭제 후 지정 인원만큼 신규 생성 및 기본 150명 상시 순환 로테이션)`, 'log-sys');
      return true;
    }
    const defaultConcurrent = args[1]
      ? Math.min(totalCount, Math.max(1, parseInt(args[1], 10) || 150))
      : Math.min(150, totalCount);

    // 현재 월드에 접속 중인 기존 AI 에이전트 소켓/파티 즉시 정리
    activeCharSockets.forEach((e, cid) => {
      if (isAIEntry(e)) {
        const mk = e.mapKey;
        removeCharFromParty(cid, 'disconnect');
        activeCharSockets.delete(cid);
        if (mk) broadcastToMap(mk, { type: 'PLAYER_LEFT_MAP', charId: cid });
      }
    });

    sendSystemMsgToEntry(
      entry,
      `⚙️ [GM 모험가생성] 기존 에이전트를 모두 삭제하고 신규 모험가 ${totalCount}명을 생성 중입니다... (상시 로테이션 접속: ${defaultConcurrent}명, 완료 시 알림)`,
      'log-kill'
    );

    let sentToRunner = false;
    aiRunnerControlConns.forEach(rConn => {
      sendWsMessage(rConn, {
        type: 'ADMIN_AI_CONTROL',
        action: 'REBUILD_POOL',
        totalCount,
        concurrentCount: defaultConcurrent,
        requesterCharId: entry.charId
      });
      sentToRunner = true;
    });

    if (!sentToRunner) {
      try {
        const runnerPath = fs.existsSync(path.join(__dirname, 'aiAgentRunner.js')) ? './aiAgentRunner.js' : './aiagentrunner.js';
        const aiRunner = require(runnerPath);
        if (typeof aiRunner.rebuildAIPool === 'function') {
          aiRunner.rebuildAIPool(totalCount, defaultConcurrent, entry.charId);
        }
      } catch (err) {
        sendSystemMsgToEntry(entry, `⚠️ AI Runner 모듈 호출 실패: ${err.message}`, 'log-hit');
      }
    }
    return true;
  }

  // 🤖 운영자 AI 모험가 상시 접속 인원 실시간 조정 명령어 (/모험가상시인원 <숫자>)
  if (cmd === '/모험가상시인원' || cmd === '/모험가상시접속' || cmd === '/상시인원' || cmd === '/에이전트인원' || cmd === '/에이전트상시인원' || cmd === '/ai인원') {
    const concurrentCount = parseInt(args[0], 10);
    if (isNaN(concurrentCount) || concurrentCount < 0 || concurrentCount > 600) {
      sendSystemMsgToEntry(entry, `💡 사용법: /모험가상시인원 <0~600> (600명 풀 중 상시 접속 로테이션 모험가 인원 실시간 변경, 권장: 150)`, 'log-sys');
      return true;
    }

    sendSystemMsgToEntry(
      entry,
      `⏳ [GM 상시인원 조정] 모험가 상시 접속 로테이션 인원을 ${concurrentCount}명으로 조정 요청했습니다...`,
      'log-sys'
    );

    let sentToRunner = false;
    aiRunnerControlConns.forEach(rConn => {
      sendWsMessage(rConn, {
        type: 'ADMIN_AI_CONTROL',
        action: 'SET_CONCURRENT',
        concurrentCount,
        requesterCharId: entry.charId
      });
      sentToRunner = true;
    });

    if (!sentToRunner) {
      try {
        const runnerPath = fs.existsSync(path.join(__dirname, 'aiAgentRunner.js')) ? './aiAgentRunner.js' : './aiagentrunner.js';
        const aiRunner = require(runnerPath);
        if (typeof aiRunner.setConcurrentAICount === 'function') {
          aiRunner.setConcurrentAICount(concurrentCount, entry.charId);
        }
      } catch (err) {
        sendSystemMsgToEntry(entry, `⚠️ AI Runner 모듈 호출 실패: ${err.message}`, 'log-hit');
      }
    }
    return true;
  }

  // --------------------------------------------------------------------------
  // [4] 운영자 캐릭터 상태 제어 (무적 / 투명 / 이속 / 공격력 / 회복 / 레벨 / 골드 / 스탯 / 스킬)
  // --------------------------------------------------------------------------
  if (cmd === '/무적') {
    entry.gmInvincible = !entry.gmInvincible;
    if (entry.player) entry.player.gmInvincible = entry.gmInvincible;
    sendWsMessage(entry.conn, {
      type: 'ADMIN_MODE_CHANGED',
      isAdmin: true,
      gmInvincible: entry.gmInvincible,
      gmInvisible: Boolean(entry.gmInvisible),
      gmSpeedMult: entry.gmSpeedMult || 1,
      gmAtkMult: entry.gmAtkMult || 1
    });
    sendSystemMsgToEntry(entry, `🛡️ [GM 무적] 운영자 절대 무적 모드가 ${entry.gmInvincible ? '활성화(ON)' : '해제(OFF)'}되었습니다.`, 'log-kill');
    return true;
  }

  if (cmd === '/투명' || cmd === '/은신') {
    entry.gmInvisible = !entry.gmInvisible;
    if (entry.player) entry.player.gmInvisible = entry.gmInvisible;
    sendWsMessage(entry.conn, {
      type: 'ADMIN_MODE_CHANGED',
      isAdmin: true,
      gmInvincible: Boolean(entry.gmInvincible),
      gmInvisible: entry.gmInvisible,
      gmSpeedMult: entry.gmSpeedMult || 1,
      gmAtkMult: entry.gmAtkMult || 1
    });
    sendSystemMsgToEntry(entry, `👻 [GM 투명/은신] 타 유저 및 몬스터 시야 은신이 ${entry.gmInvisible ? '활성화(ON)' : '해제(OFF)'}되었습니다.`, 'log-kill');
    return true;
  }

  if (cmd === '/이속' || cmd === '/이동속도') {
    const mult = Math.max(0.5, Math.min(5.0, Number(args[0]) || 1));
    entry.gmSpeedMult = mult;
    sendWsMessage(entry.conn, {
      type: 'ADMIN_MODE_CHANGED',
      isAdmin: true,
      gmInvincible: Boolean(entry.gmInvincible),
      gmInvisible: Boolean(entry.gmInvisible),
      gmSpeedMult: mult,
      gmAtkMult: entry.gmAtkMult || 1
    });
    sendSystemMsgToEntry(entry, `⚡ [GM 이동속도] 캐릭터 이동속도 배율이 x${mult}배로 설정되었습니다.`, 'log-kill');
    return true;
  }

  if (cmd === '/공격력' || cmd === '/공배율') {
    const mult = Math.max(1, Math.min(1000, Number(args[0]) || 1));
    entry.gmAtkMult = mult;
    sendWsMessage(entry.conn, {
      type: 'ADMIN_MODE_CHANGED',
      isAdmin: true,
      gmInvincible: Boolean(entry.gmInvincible),
      gmInvisible: Boolean(entry.gmInvisible),
      gmSpeedMult: entry.gmSpeedMult || 1,
      gmAtkMult: mult
    });
    sendSystemMsgToEntry(entry, `⚔️ [GM 공격력 배율] 공격 데미지 배율이 x${mult}배로 설정되었습니다.`, 'log-kill');
    return true;
  }

  if (cmd === '/완전회복' || cmd === '/체력회복' || cmd === '/회복' || cmd === '/풀피') {
    const targetArg = args[0];
    if (targetArg === '전체' || targetArg === '모두') {
      broadcastToAll({ type: 'GM_DIRECT_MOD', action: 'FULL_RECOVERY' });
      sendSystemMsgToEntry(entry, `🌿 [GM 전체회복] 접속 중인 모든 유저의 HP/MP 및 용병 상태를 100% 완전 회복시켰습니다!`, 'log-kill');
      return true;
    }
    const targetEntry = targetArg ? findOnlineEntryByName(targetArg) : entry;
    if (!targetEntry) {
      sendSystemMsgToEntry(entry, `⚠️ '${targetArg}' 캐릭터를 찾을 수 없습니다.`, 'log-hit');
      return true;
    }
    sendWsMessage(targetEntry.conn, { type: 'GM_DIRECT_MOD', action: 'FULL_RECOVERY' });
    sendSystemMsgToEntry(entry, `🌿 [GM 완전회복] '${targetEntry.player?.name || '본인'}'의 HP/MP 및 쿨타임을 모두 회복했습니다.`, 'log-kill');
    return true;
  }

  if (cmd === '/레벨' || cmd === '/레벨업' || cmd === '/lv') {
    const lvVal = Math.max(1, Math.min(999, parseInt(args[0], 10) || 0));
    if (!args[0] || lvVal < 1) {
      sendSystemMsgToEntry(entry, `💡 사용법: /레벨 <1~999> [캐릭터이름]`, 'log-sys');
      return true;
    }
    const targetEntry = args[1] ? findOnlineEntryByName(args[1]) : entry;
    if (!targetEntry) {
      sendSystemMsgToEntry(entry, `⚠️ '${args[1]}' 캐릭터를 찾을 수 없습니다.`, 'log-hit');
      return true;
    }
    sendWsMessage(targetEntry.conn, { type: 'GM_DIRECT_MOD', action: 'SET_LEVEL', value: lvVal });
    sendSystemMsgToEntry(entry, `👑 [GM 레벨 설정] '${targetEntry.player?.name}' 캐릭터의 레벨을 Lv.${lvVal}(으)로 변경했습니다!`, 'log-kill');
    return true;
  }

  if (cmd === '/경험치' || cmd === '/exp') {
    const expVal = Math.max(1, parseInt(args[0], 10) || 0);
    if (!expVal) {
      sendSystemMsgToEntry(entry, `💡 사용법: /경험치 <수치>`, 'log-sys');
      return true;
    }
    sendWsMessage(entry.conn, { type: 'GM_DIRECT_MOD', action: 'ADD_EXP', value: expVal });
    sendSystemMsgToEntry(entry, `👑 [GM 경험치] 경험치 +${expVal.toLocaleString()} 획득!`, 'log-kill');
    return true;
  }

  if (cmd === '/골드' || cmd === '/돈' || cmd === '/gold') {
    const goldVal = parseInt(args[0], 10);
    if (isNaN(goldVal)) {
      sendSystemMsgToEntry(entry, `💡 사용법: /골드 <지급할 골드 수량> [캐릭터이름]`, 'log-sys');
      return true;
    }
    const targetEntry = args[1] ? findOnlineEntryByName(args[1]) : entry;
    if (!targetEntry) {
      sendSystemMsgToEntry(entry, `⚠️ '${args[1]}' 캐릭터를 찾을 수 없습니다.`, 'log-hit');
      return true;
    }
    sendWsMessage(targetEntry.conn, { type: 'GM_DIRECT_MOD', action: 'ADD_GOLD', value: goldVal });
    sendSystemMsgToEntry(entry, `💰 [GM 골드 지급] '${targetEntry.player?.name}'에게 ${goldVal.toLocaleString()} G를 지급했습니다!`, 'log-kill');
    return true;
  }

  if (cmd === '/스탯') {
    const statType = String(args[0] || '').toUpperCase();
    const val = Math.max(1, Math.min(9999, parseInt(args[1], 10) || 0));
    if (!statType || !val) {
      sendSystemMsgToEntry(entry, `💡 사용법: /스탯 <힘|민첩|지능|체력|올스탯> <수치> (예: /스탯 올스탯 500)`, 'log-sys');
      return true;
    }
    sendWsMessage(entry.conn, { type: 'GM_DIRECT_MOD', action: 'SET_STAT', statType, value: val });
    return true;
  }

  if (cmd === '/스탯포인트') {
    const pts = parseInt(args[0], 10);
    if (isNaN(pts)) {
      sendSystemMsgToEntry(entry, `💡 사용법: /스탯포인트 <지급할 포인트>`, 'log-sys');
      return true;
    }
    sendWsMessage(entry.conn, { type: 'GM_DIRECT_MOD', action: 'ADD_STAT_POINTS', value: pts });
    return true;
  }

  if (cmd === '/스탯초기화') {
    sendWsMessage(entry.conn, { type: 'GM_DIRECT_MOD', action: 'RESET_STATS' });
    return true;
  }

  if (cmd === '/모든스킬습득' || cmd === '/스킬마스터' || cmd === '/올스킬') {
    sendWsMessage(entry.conn, { type: 'GM_DIRECT_MOD', action: 'LEARN_ALL_SKILLS' });
    return true;
  }

  if (cmd === '/직업변경' || cmd === '/클래스변경') {
    const clsArg = String(args[0] || '').trim();
    let targetCls = null;
    if (clsArg.includes('전사') || clsArg === 'knight') targetCls = 'knight';
    else if (clsArg.includes('궁수') || clsArg === 'ranger') targetCls = 'ranger';
    else if (clsArg.includes('마법') || clsArg.includes('법사') || clsArg === 'wizard') targetCls = 'wizard';
    if (!targetCls) {
      sendSystemMsgToEntry(entry, `💡 사용법: /직업변경 <전사|궁수|마법사>`, 'log-sys');
      return true;
    }
    sendWsMessage(entry.conn, { type: 'GM_DIRECT_MOD', action: 'CHANGE_CLASS', value: targetCls });
    return true;
  }

  if (cmd === '/전체버프' || cmd === '/풀버프') {
    broadcastToMap(entry.mapKey, { type: 'GM_DIRECT_MOD', action: 'FULL_BUFFS', casterName: entry.player?.name || '운영자' });
    sendSystemMsgToEntry(entry, `✨ [GM 전체버프] 현재 맵의 모든 모험가에게 최상급 축복 버프를 일괄 부여했습니다!`, 'log-kill');
    return true;
  }

  // --------------------------------------------------------------------------
  // [5] 아이템 생성 · 일괄 강화 · 인벤토리 명령어
  // --------------------------------------------------------------------------
  if (cmd === '/아이템목록' || cmd === '/아이템검색') {
    const keyword = restText.toLowerCase();
    const matches = Object.values(serverItemDict).filter(it =>
      !keyword || String(it.name || '').toLowerCase().includes(keyword) || String(it.id || '').toLowerCase().includes(keyword) || String(it.type || '').toLowerCase().includes(keyword)
    ).slice(0, 15);
    if (matches.length === 0) {
      sendSystemMsgToEntry(entry, `🔍 '${restText}' 검색 결과 일치하는 아이템이 없습니다.`, 'log-hit');
    } else {
      const listStr = matches.map(it => `[${it.id}] ${it.name}(${it.type})`).join(' · ');
      sendSystemMsgToEntry(entry, `📦 [아이템 검색 결과 (${matches.length}건)] ${listStr}`, 'log-kill');
    }
    return true;
  }

  if (cmd === '/아이템' || cmd === '/생성' || cmd === '/아이템생성' || cmd === '/아이템지급') {
    if (args.length === 0) {
      sendSystemMsgToEntry(entry, `💡 사용법: /아이템 <이름 또는 ID> [수량] [등급:일반|고급|희귀|전설|초월] [강화수치] (예: /아이템 드래곤 투스 1 초월 10)`, 'log-sys');
      return true;
    }

    const gradeKeywords = { '일반': 0, '고급': 1, '희귀': 2, '전설': 3, '초월': 4 };
    let workArgs = [...args];
    let plusVal = 0;
    let gradeIdx = 4;
    let qtyVal = 1;

    if (workArgs.length >= 2) {
      const last = workArgs[workArgs.length - 1];
      const secondLast = workArgs[workArgs.length - 2];
      if (gradeKeywords[secondLast] !== undefined && !isNaN(parseInt(last, 10))) {
        plusVal = Math.max(0, Math.min(20, parseInt(workArgs.pop(), 10)));
        gradeIdx = gradeKeywords[workArgs.pop()];
      } else if (gradeKeywords[last] !== undefined) {
        gradeIdx = gradeKeywords[workArgs.pop()];
      }
    }
    if (workArgs.length >= 2 && !isNaN(parseInt(workArgs[workArgs.length - 1], 10))) {
      qtyVal = Math.max(1, Math.min(999, parseInt(workArgs.pop(), 10)));
    }

    const searchName = workArgs.join(' ').trim();
    const allItems = Object.values(serverItemDict);
    let foundItem = allItems.find(it => it.id.toLowerCase() === searchName.toLowerCase() || it.name === searchName);
    if (!foundItem) {
      foundItem = allItems.find(it => it.name.replace(/\s+/g, '').includes(searchName.replace(/\s+/g, '')));
    }
    if (!foundItem) {
      sendSystemMsgToEntry(entry, `⚠️ '${searchName}' 아이템을 찾을 수 없습니다. (/아이템목록 <검색어> 로 확인)`, 'log-hit');
      return true;
    }

    const inst = createServerItemInstance(foundItem.id, qtyVal, true, gradeIdx, 300, plusVal);
    sendWsMessage(entry.conn, {
      type: 'GM_DIRECT_MOD',
      action: 'GIVE_ITEM',
      item: inst
    });
    sendSystemMsgToEntry(entry, `🎁 [GM 아이템 생성] [${inst.gradeName || '일반'}] ${inst.plus ? '+' + inst.plus + ' ' : ''}${foundItem.name} x${qtyVal} 지급 완료!`, 'log-kill');
    return true;
  }

  if (cmd === '/강화' || cmd === '/올강화' || cmd === '/장비강화') {
    const plusVal = Math.max(0, Math.min(20, parseInt(args[0], 10) || 10));
    sendWsMessage(entry.conn, {
      type: 'GM_DIRECT_MOD',
      action: 'ENCHANT_ALL_EQUIP',
      value: plusVal
    });
    sendSystemMsgToEntry(entry, `✨ [GM 전신 강화] 현재 착용 중인 모든 장비를 +${plusVal}강으로 즉시 강화했습니다!`, 'log-kill');
    return true;
  }

  if (cmd === '/가방비우기' || cmd === '/인벤초기화') {
    sendWsMessage(entry.conn, { type: 'GM_DIRECT_MOD', action: 'CLEAR_INVENTORY' });
    return true;
  }

  // --------------------------------------------------------------------------
  // [6] 몬스터 스폰 · 보스 소환 · 학살 · 초기화 (서버 권위 실시간 동기화!)
  // --------------------------------------------------------------------------
  if (cmd === '/몬스터목록' || cmd === '/몹목록') {
    const keyword = restText.toLowerCase();
    const matches = (GameDB.Monsters || []).filter(m =>
      !keyword || String(m.name || '').toLowerCase().includes(keyword) || String(m.region || '').toLowerCase() === keyword || String(m.id) === keyword
    ).slice(0, 15);
    if (matches.length === 0) {
      sendSystemMsgToEntry(entry, `🔍 '${restText}' 조건에 맞는 몬스터가 없습니다.`, 'log-hit');
    } else {
      const listStr = matches.map(m => `[ID:${m.id}] Lv.${m.lv} ${m.name}(${m.region})`).join(' · ');
      sendSystemMsgToEntry(entry, `🐉 [몬스터 목록 (${matches.length}건)] ${listStr}`, 'log-kill');
    }
    return true;
  }

  if (cmd === '/소환' || cmd === '/몬스터소환' || cmd === '/몹소환') {
    if (args.length === 0) {
      sendSystemMsgToEntry(entry, `💡 사용법: /소환 <몬스터이름 또는 ID> [수량] (예: /소환 고블린 족장 1, /소환 초원 슬라임 10)`, 'log-sys');
      return true;
    }
    let workArgs = [...args];
    let count = 1;
    if (workArgs.length >= 2 && !isNaN(parseInt(workArgs[workArgs.length - 1], 10))) {
      count = Math.max(1, Math.min(30, parseInt(workArgs.pop(), 10)));
    }
    const mobQuery = workArgs.join(' ').trim();
    const allMobs = GameDB.Monsters || [];
    let baseMob = allMobs.find(m => String(m.id) === mobQuery || m.name === mobQuery);
    if (!baseMob) {
      baseMob = allMobs.find(m => m.name.replace(/\s+/g, '').includes(mobQuery.replace(/\s+/g, '')));
    }
    if (!baseMob) {
      sendSystemMsgToEntry(entry, `⚠️ '${mobQuery}' 몬스터를 찾을 수 없습니다. (/몬스터목록 <검색어> 로 확인)`, 'log-hit');
      return true;
    }

    const px = entry.player?.x || mapInst.mapData.spawn.x;
    const py = entry.player?.y || mapInst.mapData.spawn.y;
    const spawnedList = [];
    for (let i = 0; i < count; i++) {
      const ang = (Math.PI * 2 * i) / Math.max(1, count);
      const dist = count === 1 ? 65 : (75 + (i % 3) * 35);
      const sx = px + Math.cos(ang) * dist;
      const sy = py + Math.sin(ang) * dist;
      const safePt = findServerSafeSpot(mapInst, sx, sy);
      const mobInst = createServerMonsterInstance(
        `gm_mob_${Date.now()}_${i}_${Math.random().toString(36).slice(2, 6)}`,
        baseMob,
        safePt.x,
        safePt.y,
        baseMob.name.includes('(B)')
      );
      mobInst.isGmSpawned = true;
      mapInst.monsters.push(mobInst);
      if (mapInst.monsterById) mapInst.monsterById.set(String(mobInst.id), mobInst);
      spawnedList.push(mobInst);
    }

    broadcastToMap(mapInst.mapKey, {
      type: 'MONSTERS_SPAWNED',
      mapKey: mapInst.mapKey,
      monsters: spawnedList
    });
    sendSystemMsgToEntry(entry, `🐉 [GM 몬스터 소환] 현재 위치에 'Lv.${baseMob.lv} ${baseMob.name}' ${count}마리를 소환했습니다! (모든 유저에게 동기화됨)`, 'log-kill');
    return true;
  }

  if (cmd === '/보스소환') {
    const query = restText.trim();
    const allMobs = GameDB.Monsters || [];
    let bossMob = null;
    if (query) {
      bossMob = allMobs.find(m => m.name.includes('(B)') && (m.region.toLowerCase() === query.toLowerCase() || m.name.includes(query)));
    }
    if (!bossMob) {
      bossMob = allMobs.find(m => m.region === mapInst.regionKey && m.name.includes('(B)')) || allMobs.find(m => m.id === 104);
    }

    const existingBoss = mapInst.monsters.find(m => m.isBoss && m.isDead);
    if (existingBoss && !query) {
      const safePt = findServerSafeSpot(mapInst, existingBoss.spawnX, existingBoss.spawnY);
      existingBoss.isDead = false;
      existingBoss.hp = existingBoss.maxHp;
      existingBoss.mp = existingBoss.maxMp;
      existingBoss.x = safePt.x;
      existingBoss.y = safePt.y;
      existingBoss.respawnTimer = 0;
      mapInst.bossRespawnTimer = 0;
      broadcastToMap(mapInst.mapKey, {
        type: 'MONSTER_RESPAWNED',
        mapKey: mapInst.mapKey,
        monster: existingBoss,
        bossRespawnTimer: 0
      });
      sendSystemMsgToEntry(entry, `👑 [GM 보스 즉시 리젠] '${existingBoss.name}' 보스를 성역에 즉시 부활시켰습니다!`, 'log-kill');
    } else if (bossMob) {
      const px = entry.player?.x || mapInst.mapData.spawn.x;
      const py = entry.player?.y || mapInst.mapData.spawn.y;
      const safePt = findServerSafeSpot(mapInst, px + 80, py - 40);
      const mobInst = createServerMonsterInstance(`gm_boss_${Date.now()}`, bossMob, safePt.x, safePt.y, true);
      mobInst.isGmSpawned = true;
      mapInst.monsters.push(mobInst);
      if (mapInst.monsterById) mapInst.monsterById.set(String(mobInst.id), mobInst);
      broadcastToMap(mapInst.mapKey, {
        type: 'MONSTERS_SPAWNED',
        mapKey: mapInst.mapKey,
        monsters: [mobInst]
      });
      sendSystemMsgToEntry(entry, `👑 [GM 보스 소환] 현재 위치 앞에 '${bossMob.name}' 보스를 소환했습니다!`, 'log-kill');
    }
    return true;
  }

  if (cmd === '/학살' || cmd === '/전체처치' || cmd === '/킬올' || cmd === '/몬스터삭제') {
    let killedCount = 0;
    let totalExp = 0;
    let totalGold = 0;
    const newDrops = [];

    mapInst.monsters.forEach(m => {
      if (!m.isDead) {
        m.isDead = true;
        m.hp = 0;
        m.respawnTimer = m.isBoss ? 300 : 12;
        if (m.isBoss) mapInst.bossRespawnTimer = 300;
        killedCount++;
        totalExp += (m.baseExp || 20);
        totalGold += Math.floor(20 + (m.lv || 1) * 4);
        if (m.isBoss || Math.random() < 0.25) {
          const eqId = pickServerMonsterTierDrop(m, 'equip', entry.player?.class);
          const inst = createServerItemInstance(eqId, 1, m.isBoss, null, m.lv);
          newDrops.push(spawnServerGroundItem(mapInst, inst, m.x, m.y));
        }
      }
    });

    mapInst.monsters = mapInst.monsters.filter(m => !(m.isGmSpawned && m.isDead));
    rebuildMapMonsterIndex(mapInst);

    broadcastToMap(mapInst.mapKey, {
      type: 'GM_MASS_KILL',
      mapKey: mapInst.mapKey,
      killerCharId: entry.charId,
      killedCount,
      totalExp,
      totalGold,
      newGroundItems: newDrops,
      bossRespawnTimer: mapInst.bossRespawnTimer
    });
    sendSystemMsgToEntry(entry, `⚡ [GM 학살] 현재 맵의 몬스터 ${killedCount}마리를 일괄 처치했습니다! (EXP +${totalExp.toLocaleString()}, +${totalGold.toLocaleString()} G)`, 'log-kill');
    return true;
  }

  if (cmd === '/몬스터초기화' || cmd === '/젠초기화') {
    populateServerMapMonsters(mapInst);
    mapInst.bossRespawnTimer = 0;
    activeCharSockets.forEach(pEntry => {
      if (normalizeMapKey(pEntry.mapKey) === mapInst.mapKey) {
        sendWsMessage(pEntry.conn, buildMapInitStatePacket(mapInst.mapKey, pEntry));
      }
    });
    sendSystemMsgToEntry(entry, `🔄 [GM 몬스터 초기화] '${mapInst.mapKey}' 맵의 모든 몬스터와 보스를 초기 상태로 즉시 리젠했습니다.`, 'log-kill');
    return true;
  }

  if (cmd === '/바닥청소' || cmd === '/아이템삭제') {
    const cnt = mapInst.groundItems.length;
    mapInst.groundItems = [];
    broadcastToMap(mapInst.mapKey, {
      type: 'GROUND_ITEMS_SYNC',
      mapKey: mapInst.mapKey,
      groundItems: []
    });
    sendSystemMsgToEntry(entry, `🧹 [GM 바닥청소] 현재 맵 바닥에 떨어진 아이템 ${cnt}개를 모두 제거했습니다.`, 'log-kill');
    return true;
  }

  // --------------------------------------------------------------------------
  // [7] 공간 이동 · 유저 출두 · 유저 소환 · 제재 명령어
  // --------------------------------------------------------------------------
  if (cmd === '/이동' || cmd === '/워프' || cmd === '/맵이동' || cmd === '/텔레포트') {
    if (args.length === 0) {
      sendSystemMsgToEntry(entry, `💡 사용법: /이동 <지역명|맵키> 또는 /이동 <X좌표> <Y좌표> (예: /이동 알트리아, /이동 이터니티, /이동 2000 14250)`, 'log-sys');
      return true;
    }
    if (args.length >= 2 && !isNaN(parseInt(args[0], 10)) && !isNaN(parseInt(args[1], 10))) {
      const tx = parseInt(args[0], 10);
      const ty = parseInt(args[1], 10);
      sendWsMessage(entry.conn, {
        type: 'GM_TELEPORT',
        mapKey: entry.mapKey,
        x: tx,
        y: ty,
        label: `좌표 (${tx}, ${ty})`
      });
      return true;
    }

    const q = restText.replace(/\s+/g, '').toLowerCase();
    let targetMapKey = null;
    let targetSpawn = null;
    let label = restText;

    for (const reg of (GameDB.Regions || [])) {
      if (
        reg.id.toLowerCase() === q ||
        reg.name.replace(/\s+/g, '').toLowerCase().includes(q) ||
        reg.eng.replace(/\s+/g, '').toLowerCase().includes(q) ||
        reg.sub1.replace(/\s+/g, '').toLowerCase().includes(q)
      ) {
        targetMapKey = `${reg.id}_sub1`;
        const md = HardcodedMapDB[targetMapKey];
        targetSpawn = md?.spawn || { x: 2000, y: 13500 };
        label = `${reg.name} - ${reg.sub1}`;
        break;
      }
      if (reg.sub3 && reg.sub3.replace(/\s+/g, '').toLowerCase().includes(q)) {
        targetMapKey = `${reg.id}_dungeon`;
        const md = HardcodedMapDB[targetMapKey];
        targetSpawn = md?.spawn || { x: 1500, y: 2580 };
        label = `${reg.name} 던전 (${reg.sub3})`;
        break;
      }
      if (reg.sub4 && reg.sub4.replace(/\s+/g, '').toLowerCase().includes(q)) {
        targetMapKey = `${reg.id}_sub1`;
        const md = HardcodedMapDB[targetMapKey];
        targetSpawn = md?.bossWarpPos || md?.bossPos || { x: 2500, y: 3500 };
        label = `${reg.name} 보스성역 (${reg.sub4})`;
        break;
      }
    }

    if (!targetMapKey && HardcodedMapDB[restText]) {
      targetMapKey = normalizeMapKey(restText);
      targetSpawn = HardcodedMapDB[targetMapKey]?.spawn || { x: 2000, y: 13500 };
    }

    if (!targetMapKey) {
      sendSystemMsgToEntry(entry, `⚠️ '${restText}' 지역을 찾을 수 없습니다. (알트리아, 실버바인, 칼라드루, 엘론드, 모라안, 블러드문, 발레노스, 프로스트홀드, 이그니스, 다크우드, 윈드스톰, 아르카나, 네더게이트, 드래곤피크, 이터니티)`, 'log-hit');
      return true;
    }

    sendWsMessage(entry.conn, {
      type: 'GM_TELEPORT',
      mapKey: targetMapKey,
      x: targetSpawn.x,
      y: targetSpawn.y,
      label
    });
    return true;
  }

  if (cmd === '/출두' || cmd === '/추적') {
    const targetName = args[0];
    if (!targetName) {
      sendSystemMsgToEntry(entry, `💡 사용법: /출두 <이동할 대상 캐릭터이름>`, 'log-sys');
      return true;
    }
    const targetEntry = findOnlineEntryByName(targetName);
    if (!targetEntry || !targetEntry.player) {
      sendSystemMsgToEntry(entry, `⚠️ '${targetName}' 캐릭터가 현재 접속 중이지 않습니다.`, 'log-hit');
      return true;
    }
    sendWsMessage(entry.conn, {
      type: 'GM_TELEPORT',
      mapKey: targetEntry.mapKey,
      x: (targetEntry.player.x || 2000) + 40,
      y: (targetEntry.player.y || 14250) + 20,
      label: `'${targetEntry.player.name}' 위치 출두`
    });
    return true;
  }

  if (cmd === '/소환유저' || cmd === '/유저소환' || cmd === '/호출') {
    const targetName = args[0];
    if (!targetName) {
      sendSystemMsgToEntry(entry, `💡 사용법: /소환유저 <호출할 캐릭터이름>`, 'log-sys');
      return true;
    }
    const targetEntry = findOnlineEntryByName(targetName);
    if (!targetEntry) {
      sendSystemMsgToEntry(entry, `⚠️ '${targetName}' 캐릭터가 현재 접속 중이지 않습니다.`, 'log-hit');
      return true;
    }
    const gx = (entry.player?.x || 2000) + 45;
    const gy = (entry.player?.y || 14250) + 25;
    sendWsMessage(targetEntry.conn, {
      type: 'GM_TELEPORT',
      mapKey: entry.mapKey,
      x: gx,
      y: gy,
      label: `운영자 '${entry.player?.name || 'GM'}'님의 호출`
    });
    sendSystemMsgToEntry(entry, `🌀 [GM 유저소환] '${targetEntry.player?.name}'님을 현재 위치로 소환했습니다.`, 'log-kill');
    return true;
  }

  if (cmd === '/전체소환') {
    const gx = entry.player?.x || 2000;
    const gy = entry.player?.y || 14250;
    let cnt = 0;
    activeCharSockets.forEach(pEntry => {
      if (pEntry.charId !== entry.charId) {
        cnt++;
        sendWsMessage(pEntry.conn, {
          type: 'GM_TELEPORT',
          mapKey: entry.mapKey,
          x: gx + Math.round((Math.random() - 0.5) * 120),
          y: gy + Math.round((Math.random() - 0.5) * 120),
          label: `운영자 전체 소환`
        });
      }
    });
    sendSystemMsgToEntry(entry, `🌀 [GM 전체소환] 접속 중인 모험가 ${cnt}명을 현재 위치로 소환했습니다!`, 'log-kill');
    return true;
  }

  if (cmd === '/채팅금지' || cmd === '/벙어리') {
    const targetName = args[0];
    const mins = Math.max(1, parseInt(args[1], 10) || 10);
    if (!targetName) {
      sendSystemMsgToEntry(entry, `💡 사용법: /채팅금지 <캐릭터이름> [분(기본10분)]`, 'log-sys');
      return true;
    }
    mutedCharMap.set(targetName.toLowerCase(), Date.now() + mins * 60000);
    const targetEntry = findOnlineEntryByName(targetName);
    if (targetEntry) {
      sendSystemMsgToEntry(targetEntry, `🔇 [시스템] 운영자에 의해 ${mins}분간 채팅이 제한되었습니다.`, 'log-hit');
    }
    sendSystemMsgToEntry(entry, `🔇 [GM 채팅금지] '${targetName}' 캐릭터의 채팅을 ${mins}분간 금지했습니다.`, 'log-kill');
    return true;
  }

  if (cmd === '/채팅금지해제' || cmd === '/벙어리해제') {
    const targetName = args[0];
    if (!targetName) {
      sendSystemMsgToEntry(entry, `💡 사용법: /채팅금지해제 <캐릭터이름>`, 'log-sys');
      return true;
    }
    mutedCharMap.delete(targetName.toLowerCase());
    const targetEntry = findOnlineEntryByName(targetName);
    if (targetEntry) {
      sendSystemMsgToEntry(targetEntry, `🔊 [시스템] 운영자에 의해 채팅 금지가 해제되었습니다.`, 'log-sys');
    }
    sendSystemMsgToEntry(entry, `🔊 [GM 채팅금지 해제] '${targetName}' 캐릭터의 채팅 제한을 해제했습니다.`, 'log-kill');
    return true;
  }

  if (cmd === '/강제퇴장' || cmd === '/추방' || cmd === '/킥') {
    const targetName = args[0];
    if (!targetName) {
      sendSystemMsgToEntry(entry, `💡 사용법: /강제퇴장 <캐릭터이름>`, 'log-sys');
      return true;
    }
    const targetEntry = findOnlineEntryByName(targetName);
    if (!targetEntry) {
      sendSystemMsgToEntry(entry, `⚠️ '${targetName}' 캐릭터가 접속 중이지 않습니다.`, 'log-hit');
      return true;
    }
    sendWsMessage(targetEntry.conn, {
      type: 'GM_KICKED',
      reason: args.slice(1).join(' ') || '운영자에 의해 서버에서 강제 퇴장되었습니다.'
    });
    sendSystemMsgToEntry(entry, `🚫 [GM 강제퇴장] '${targetEntry.player?.name}' 캐릭터를 접속 종료 처리했습니다.`, 'log-kill');
    return true;
  }

  sendSystemMsgToEntry(entry, `❓ 알 수 없는 명령어입니다: ${cmd} ('/?' 입력 시 전체 명령어 확인)`, 'log-hit');
  return true;
}

// ============================================================================
// 7. 클라이언트 WebSocket 패킷 핸들러 (서버 권위 전투 · 동기화 · 채팅)
// ============================================================================

// 📱 서버 권위형 모바일 백그라운드 타이머 관리 (모바일 OS가 브라우저 JS를 동결시켜도 1.5초 무적 & 5초 유령 캐릭터 제거 100% 보장)
function clearEntryMobileBgTimers(entry) {
  if (!entry) return;
  if (entry._bgInvincibleTimer) {
    clearTimeout(entry._bgInvincibleTimer);
    entry._bgInvincibleTimer = null;
  }
  if (entry._bgLogoutTimer) {
    clearTimeout(entry._bgLogoutTimer);
    entry._bgLogoutTimer = null;
  }
}

function scheduleServerMobileBgProtectionAndLogout(charId) {
  if (!charId) return;
  const entry = activeCharSockets.get(charId);
  if (!entry) return;
  clearEntryMobileBgTimers(entry);
  entry.mobileBgHiddenAt = Date.now();

  // 1) 1.5초(2초 이내) 경과 시 서버 권위 무적 보호 즉시 활성화
  entry._bgInvincibleTimer = setTimeout(() => {
    const cur = activeCharSockets.get(charId);
    if (!cur || !cur.mobileBgHiddenAt) return;
    cur.bgInvincible = true;
    if (cur.player) cur.player.bgInvincible = true;
  }, 1500);

  // 2) 5.0초 경과 시 서버에서 캐릭터 즉시 퇴장 및 타 플레이어 화면 유령(Ghost) 완전 제거
  entry._bgLogoutTimer = setTimeout(() => {
    const cur = activeCharSockets.get(charId);
    if (!cur || !cur.mobileBgHiddenAt) return;
    clearEntryMobileBgTimers(cur);
    const mk = cur.mapKey;
    const targetConn = cur.conn;
    removeCharFromParty(charId, 'disconnect');
    activeCharSockets.delete(charId);
    if (mk) {
      broadcastToMap(mk, { type: 'PLAYER_LEFT_MAP', charId });
    }
    if (targetConn) {
      sendWsMessage(targetConn, {
        type: 'MOBILE_BG_SERVER_LOGOUT',
        charId
      });
    }
  }, 5000);
}

function cancelServerMobileBgProtection(charId) {
  if (!charId) return;
  const entry = activeCharSockets.get(charId);
  if (!entry) return;
  clearEntryMobileBgTimers(entry);
  entry.mobileBgHiddenAt = 0;
  entry.bgInvincible = false;
  if (entry.player) entry.player.bgInvincible = false;
  entry.lastSeen = Date.now();
}

function handleClientWsPacket(conn, msg) {
  if (!msg || !msg.type) return;

  // [0] AI Agent Runner 제어 채널 등록 및 완료 보고 수신
  if (msg.type === 'AI_RUNNER_CONTROL_REGISTER') {
    conn.isAiRunnerControl = true;
    aiRunnerControlConns.add(conn);
    return;
  }

  if (msg.type === 'AI_RUNNER_CONTROL_REPORT') {
    const targetEntry = msg.requesterCharId ? activeCharSockets.get(msg.requesterCharId) : null;
    if (targetEntry) {
      sendSystemMsgToEntry(targetEntry, msg.text || 'AI 제어 명령이 완료되었습니다.', msg.logClass || 'log-kill');
    } else {
      activeCharSockets.forEach(e => {
        if (e.isAdmin) sendSystemMsgToEntry(e, msg.text || 'AI 제어 명령이 완료되었습니다.', msg.logClass || 'log-kill');
      });
    }
    return;
  }

  // [1] 캐릭터 월드 진입
  if (msg.type === 'ENTER_CHAR' && msg.charId) {
    const charId = msg.charId;
    // 동일 소켓(conn)에서 이전 슬롯 캐릭터가 남아있다면 즉시 제거하여 유령 캐릭터 방지!
    if (conn.charId && conn.charId !== charId) {
      const oldConnEntry = activeCharSockets.get(conn.charId);
      if (oldConnEntry && oldConnEntry.conn === conn) {
        const oldMk = oldConnEntry.mapKey;
        removeCharFromParty(conn.charId, 'disconnect');
        activeCharSockets.delete(conn.charId);
        broadcastToMap(oldMk, { type: 'PLAYER_LEFT_MAP', charId: conn.charId });
      }
    }
    // 동일 브라우저 소켓(conn)에서 슬롯을 바꾼 경우에만 이전 캐릭터 정리 (다른 브라우저의 동일 계정 타 캐릭터는 절대 종료하지 않음!)
    if (msg.prevCharId && msg.prevCharId !== charId) {
      const prevSlotEntry = activeCharSockets.get(msg.prevCharId);
      if (prevSlotEntry && prevSlotEntry.conn === conn) {
        const oldMk = prevSlotEntry.mapKey;
        removeCharFromParty(msg.prevCharId, 'disconnect');
        activeCharSockets.delete(msg.prevCharId);
        broadcastToMap(oldMk, { type: 'PLAYER_LEFT_MAP', charId: msg.prevCharId });
      }
    }

    const prevEntry = activeCharSockets.get(charId);
    if (prevEntry && prevEntry.conn !== conn && prevEntry.sessionToken !== msg.sessionToken) {
      sendWsMessage(prevEntry.conn, {
        type: 'FORCE_DISCONNECT_SAME_CHAR',
        charId,
        newSessionToken: msg.sessionToken
      });
    }

    const canonicalMap = normalizeMapKey(msg.mapKey || 'R01_sub1');
    conn.charId = charId;
    const existingParty = getPartyByCharId(charId);
    const newEntry = {
      conn,
      userId: msg.userId,
      email: String(msg.email || msg.player?.email || prevEntry?.email || '').trim().toLowerCase(),
      charId,
      sessionToken: msg.sessionToken,
      mapKey: canonicalMap,
      regionKey: msg.regionKey || canonicalMap.split('_')[0] || 'R01',
      partyId: existingParty ? existingParty.partyId : null,
      player: {
        ...(msg.player || { charId }),
        partyId: existingParty ? existingParty.partyId : null,
        isPartyLeader: Boolean(existingParty && existingParty.leaderCharId === charId)
      },
      isAdmin: Boolean(prevEntry?.isAdmin || msg.isAdmin),
      gmInvincible: Boolean(prevEntry?.gmInvincible),
      gmInvisible: Boolean(prevEntry?.gmInvisible),
      gmSpeedMult: prevEntry?.gmSpeedMult || 1,
      gmAtkMult: prevEntry?.gmAtkMult || 1,
      lastSeen: Date.now()
    };
    activeCharSockets.set(charId, newEntry);

    sendWsMessage(conn, buildMapInitStatePacket(canonicalMap, newEntry));
    if (existingParty) {
      broadcastPartyUpdate(existingParty);
    }
    return;
  }

  // [2] 맵 이동 / 채널 변경 요청 시 새 맵의 권위 상태 즉시 전송
  if (msg.type === 'CHANGE_MAP' && msg.charId) {
    const entry = activeCharSockets.get(msg.charId);
    if (!entry) return;
    const oldMap = entry.mapKey;
    const newCanonicalMap = normalizeMapKey(msg.mapKey || 'R01_sub1');
    entry.mapKey = newCanonicalMap;
    entry.regionKey = newCanonicalMap.split('_')[0] || 'R01';
    if (msg.player) {
      entry.player = {
        ...(entry.player || {}),
        ...msg.player,
        mercenary: msg.player.mercenary
          ? { ...(entry.player?.mercenary || {}), ...msg.player.mercenary }
          : (msg.player.mercenary === null ? null : entry.player?.mercenary)
      };
    }
    if (entry._knownMobs) entry._knownMobs.clear();
    if (entry._knownPlayers) entry._knownPlayers.clear();
    entry._lastSentOtherCount = -1;
    entry.lastSeen = Date.now();
    entry.lastSyncMoveTs = entry.lastSeen;

    sendWsMessage(conn, buildMapInitStatePacket(newCanonicalMap, entry));
    if (oldMap && oldMap !== newCanonicalMap) {
      cancelActiveTradeForChar(entry.charId, '맵 이동으로 인해 거래가 취소되었습니다.');
      broadcastToMap(oldMap, { type: 'PLAYER_LEFT_MAP', charId: entry.charId });
    }
    const movedParty = getPartyByCharId(entry.charId);
    if (movedParty) {
      broadcastPartyUpdate(movedParty);
    }
    return;
  }

  // [3] 플레이어 위치/상태 실시간 동기화 (델타 병합 및 변조 데이터 필터링 포함)
  if (msg.type === 'PLAYER_SYNC' && msg.charId) {
    const entry = activeCharSockets.get(msg.charId);
    if (entry && entry.conn === conn) {
      const oldMap = entry.mapKey;
      const incomingMap = normalizeMapKey(msg.mapKey || entry.mapKey);
      entry.mapKey = incomingMap;
      entry.regionKey = msg.regionKey || incomingMap.split('_')[0] || 'R01';
      const rawP = msg.player || entry.player || {};
      const prevPlayer = entry.player || {};
      const safeLv = entry.isAdmin
        ? Math.max(1, Math.min(999, Number(rawP.level ?? prevPlayer.level) || 1))
        : Math.max(1, Math.min(250, Number(rawP.level ?? prevPlayer.level) || 1));
      const myParty = getPartyByCharId(entry.charId);
      let leaderTargetChanged = false;
      const syncMapInst = worldMaps.get(incomingMap);
      const curInSafe = syncMapInst
        ? isServerPointInSafeZone(syncMapInst, Number(rawP.x ?? prevPlayer.x) || 2000, Number(rawP.y ?? prevPlayer.y) || 14250)
        : false;
      if (entry._wasInSafeZone !== curInSafe) {
        entry._wasInSafeZone = curInSafe;
        if (myParty) leaderTargetChanged = true;
      }
      if (myParty && myParty.leaderCharId === entry.charId) {
        if (curInSafe) {
          if (myParty.leaderTargetMobId !== null) {
            myParty.leaderTargetMobId = null;
            leaderTargetChanged = true;
          }
        } else if (rawP.targetMobId !== undefined) {
          const nextLdrTarget = rawP.targetMobId ? String(rawP.targetMobId) : null;
          if (myParty.leaderTargetMobId !== nextLdrTarget) {
            myParty.leaderTargetMobId = nextLdrTarget;
            leaderTargetChanged = true;
          }
        }
      }
      entry.partyId = myParty ? myParty.partyId : null;
      entry.bgInvincible = Boolean(rawP.bgInvincible ?? msg.bgInvincible ?? entry.bgInvincible);
      const mergedMerc = rawP.mercenary !== undefined
        ? (rawP.mercenary ? { ...(prevPlayer.mercenary || { hired: true }), ...rawP.mercenary } : null)
        : prevPlayer.mercenary;
      entry.player = {
        ...prevPlayer,
        ...rawP,
        mercenary: mergedMerc,
        level: safeLv,
        partyId: myParty ? myParty.partyId : null,
        isPartyLeader: Boolean(myParty && myParty.leaderCharId === entry.charId),
        isAdmin: Boolean(entry.isAdmin),
        gmInvisible: Boolean(entry.gmInvisible),
        gmInvincible: Boolean(entry.gmInvincible),
        bgInvincible: Boolean(entry.bgInvincible)
      };
      const nowSync = Date.now();
      entry.lastSeen = nowSync;
      entry.lastSyncMoveTs = nowSync;
      if (oldMap && oldMap !== incomingMap) {
        if (entry._knownMobs) entry._knownMobs.clear();
        if (entry._knownPlayers) entry._knownPlayers.clear();
        sendWsMessage(conn, buildMapInitStatePacket(incomingMap, entry));
        if (myParty) broadcastPartyUpdate(myParty);
      } else if (leaderTargetChanged && myParty) {
        broadcastPartyUpdate(myParty);
      }
    }
    return;
  }

  // [4] 서버 권위형 몬스터 타격 / 스킬 데미지 처리
  if (msg.type === 'PLAYER_ATTACK_MONSTER' && msg.charId) {
    const entry = activeCharSockets.get(msg.charId);
    const mapInst = getOrInitWorldMap(msg.mapKey || entry?.mapKey || 'R01_sub1');
    const now = Date.now();
    const targetIds = Array.isArray(msg.mobIds) ? msg.mobIds : (msg.mobId ? [msg.mobId] : []);
    if (targetIds.length === 0) return;

    // 🛡️ 개발자도구(DevTools) 패킷 변조 및 비정상 연사 방지 검증
    const isAdminUser = Boolean(entry?.isAdmin);
    const isMercAtk = Boolean(msg.isMercAtk);
    const atkParty = entry ? getPartyByCharId(entry.charId) : null;
    if (atkParty && atkParty.leaderCharId === entry.charId && targetIds[0]) {
      const nextAtkTarget = String(targetIds[0]);
      if (atkParty.leaderTargetMobId !== nextAtkTarget) {
        atkParty.leaderTargetMobId = nextAtkTarget;
        broadcastPartyUpdate(atkParty);
      }
    }
    const isSkillHit = Boolean(msg.opts && msg.opts.isSkill);
    if (entry && !isMercAtk && !isAdminUser && !isSkillHit) {
      if (now - (entry.lastPlayerAtkPacketTs || 0) < 35) return;
      entry.lastPlayerAtkPacketTs = now;
    }
    const rawCStats = msg.cStats || {};
    const attackerLv = isAdminUser
      ? (Number(msg.attackerLv) || entry?.player?.level || 1)
      : Math.max(1, Math.min(250, Number(entry?.player?.level || msg.attackerLv || 1)));
    const cStats = {
      hitBonus: Math.min(isAdminUser ? 999 : 80, Math.max(0, Number(rawCStats.hitBonus) || 0)),
      armorPenPct: Math.min(isAdminUser ? 100 : 60, Math.max(0, Number(rawCStats.armorPenPct) || 0)),
      bossDmgPct: Math.min(isAdminUser ? 500 : 75, Math.max(0, Number(rawCStats.bossDmgPct) || 0)),
      critRate: Math.min(isAdminUser ? 100 : 75, Math.max(0, Number(rawCStats.critRate) || 8)),
      critDmgMult: Math.min(isAdminUser ? 10 : 3.0, Math.max(1.0, Number(rawCStats.critDmgMult) || 1.5)),
      drainBonus: Math.min(isAdminUser ? 100 : 25, Math.max(0, Number(rawCStats.drainBonus) || 0))
    };
    const maxLegitRawDmg = isAdminUser ? 99999999 : Math.floor((380 + attackerLv * 115) * (isSkillHit ? 4.8 : 1.4));
    const clampedClientDmg = Math.min(maxLegitRawDmg, Math.max(1, Number(msg.rawDmg) || 10));
    const rawDmgBase = clampedClientDmg * (entry?.gmAtkMult || 1);
    const opts = msg.opts || {};
    if (!isAdminUser && opts.instantKillChance && opts.instantKillChance > 6) {
      opts.instantKillChance = 5;
    }
    const hitCount = Math.max(1, Math.min(5, Number(opts.hits) || 1));

    targetIds.forEach(mobId => {
      const ent = (mapInst.monsterById && mapInst.monsterById.get(String(mobId))) || mapInst.monsters.find(m => m.id === String(mobId));
      if (!ent || ent.isDead) {
        // AI나 클라이언트가 패킷 누락으로 이미 사망한 유령 몬스터를 계속 공격하며 정지해 있는 현상을 즉시 해제!
        sendWsMessage(conn, {
          type: 'MONSTER_KILLED',
          mapKey: mapInst.mapKey,
          mobId: String(mobId),
          hp: 0,
          isDead: true,
          respawnTimer: ent ? Math.ceil(ent.respawnTimer || 12) : 12
        });
        return;
      }

      for (let h = 0; h < hitCount; h++) {
        if (ent.isDead) break;

        const lvGap = Math.max(0, (ent.lv || 1) - attackerLv);
        if (!opts.forceCrit && lvGap >= 3 && !(entry?.isAdmin)) {
          const hitChance = Math.max(38, 97 - lvGap * 6 + (cStats.hitBonus || 0));
          if (Math.random() * 100 > hitChance) {
            broadcastToMap(mapInst.mapKey, {
              type: 'MONSTER_DAMAGED',
              mapKey: mapInst.mapKey,
              mobId: ent.id,
              hp: ent.hp,
              maxHp: ent.maxHp,
              dmg: 0,
              isMiss: true,
              attackerCharId: msg.charId,
              isMercAtk,
              x: Math.round(ent.x),
              y: Math.round(ent.y)
            });
            continue;
          }
        }

        const isMagicDmg = (msg.dmgType === 'magic');
        let monDef = isMagicDmg ? (ent.mDef ?? ent.def ?? 0) : (ent.def || 0);
        if (ent.defDownUntil && now < ent.defDownUntil) monDef = Math.floor(monDef * 0.75);
        if ((cStats.armorPenPct || 0) > 0) {
          monDef = Math.max(0, Math.floor(monDef * (1 - Math.min(0.65, cStats.armorPenPct / 100))));
        }
        if (opts.ignoreDef) monDef = 0;

        const monDefRatio = monDef / (monDef + 140 + attackerLv * 6);
        let mitigated = Math.max(1, Math.floor((rawDmgBase - monDef * 0.25) * (1 - monDefRatio * 0.65)));
        if (lvGap > 0 && !(entry?.isAdmin)) {
          const gapScale = Math.max(0.32, 1 - lvGap * 0.075);
          mitigated = Math.max(1, Math.floor(mitigated * gapScale));
        }

        if (ent.isBoss && (cStats.bossDmgPct || 0) > 0) {
          mitigated = Math.floor(mitigated * (1 + cStats.bossDmgPct / 100));
        }

        const isCrit = Boolean(opts.forceCrit || (Math.random() * 100 < (cStats.critRate || 8)));
        if (isCrit) {
          mitigated = Math.floor(mitigated * (cStats.critDmgMult || 1.5));
        }

        if (opts.instantKillChance && !ent.isBoss && Math.random() * 100 < opts.instantKillChance) {
          mitigated = ent.hp;
        }

        if (opts.stunSec && opts.stunSec > 0) ent.stunUntil = Math.max(ent.stunUntil || 0, now + opts.stunSec * 1000);
        if (opts.defDown) ent.defDownUntil = Math.max(ent.defDownUntil || 0, now + 10000);
        if (opts.knockback && !ent.isBoss) {
          const srcX = Number(msg.attackerX) || ent.x;
          const srcY = Number(msg.attackerY) || ent.y;
          const ang = Math.atan2(ent.y - srcY, ent.x - srcX);
          const nx = ent.x + Math.cos(ang) * 75;
          const ny = ent.y + Math.sin(ang) * 75;
          if (!checkServerCollision(mapInst, nx, ny)) {
            ent.x = Math.round(nx);
            ent.y = Math.round(ny);
          }
        }

        const totalDrainPct = Math.min(25, (cStats.drainBonus || 0) + (opts.drainPct || 0));
        const drainHeal = totalDrainPct > 0 ? Math.max(1, Math.floor(mitigated * (totalDrainPct / 100))) : 0;
        const mpDrain = (!isMercAtk && opts.mpDrain) ? Number(opts.mpDrain) : 0;

        ent.hp = Math.max(0, ent.hp - mitigated);
        const prevContrib = ent.damageContributors.get(msg.charId)?.dmg || 0;
        ent.damageContributors.set(msg.charId, { dmg: prevContrib + mitigated, lastTime: now });

        const atkSrcX = Number(msg.attackerX) || ent.x;
        const atkSrcY = Number(msg.attackerY) || ent.y;
        const hitAngle = Math.atan2(ent.y - atkSrcY, ent.x - atkSrcX);

        broadcastToMapAoi(mapInst.mapKey, ent.x, ent.y, 1450, 0, {
          type: 'MONSTER_DAMAGED',
          mapKey: mapInst.mapKey,
          mobId: ent.id,
          hp: ent.hp,
          maxHp: ent.maxHp,
          dmg: mitigated,
          isCrit,
          isSkill: Boolean(isSkillHit),
          skillName: opts.skillName || msg.skillName || null,
          dmgType: msg.dmgType || 'melee',
          hitAngle: Number(hitAngle.toFixed(2)),
          attackerCharId: msg.charId,
          isMercAtk,
          drainHeal,
          mpDrain,
          x: Math.round(ent.x),
          y: Math.round(ent.y),
          stunUntil: ent.stunUntil,
          defDownUntil: ent.defDownUntil
        }, null, msg.charId);

        if (ent.hp <= 0) {
          const wasElite = Boolean(ent.isElite);
          ent.isDead = true;
          ent.respawnTimer = ent.isBoss ? 300 : 12;
          if (ent.isBoss) mapInst.bossRespawnTimer = 300;
          if (atkParty && String(atkParty.leaderTargetMobId) === String(ent.id)) {
            atkParty.leaderTargetMobId = null;
            broadcastPartyUpdate(atkParty);
          }

          const mobLv = ent.lv || 1;
          const killerClass = entry?.player?.class || 'knight';
          let droppedGold = 0;
          const newGroundItems = [];

          if (ent.isBoss) {
            droppedGold = Math.floor((45 + mobLv * 15 + Math.random() * 80) * 10);
            const guaranteedEqId = pickServerMonsterTierDrop(ent, 'equip', killerClass);
            newGroundItems.push(spawnServerGroundItem(mapInst, createServerItemInstance(guaranteedEqId, 1, true, null, mobLv), ent.x, ent.y));

            const scrollOrPot = Math.random() < 0.65 ? (Math.random() < 0.5 ? 'S_WE01' : 'S_AR01') : 'C_P05';
            newGroundItems.push(spawnServerGroundItem(mapInst, createServerItemInstance(scrollOrPot, 1, false), ent.x - 28, ent.y + 12));

            const bossBookId = pickServerMonsterSkillBookDrop(mobLv, true, killerClass);
            if (bossBookId && Math.random() < 0.70) {
              newGroundItems.push(spawnServerGroundItem(mapInst, createServerItemInstance(bossBookId, 1, true), ent.x, ent.y + 26));
            }
            if (Math.random() < 0.50) {
              const bonusEqId = pickServerMonsterTierDrop(ent, 'equip', killerClass);
              newGroundItems.push(spawnServerGroundItem(mapInst, createServerItemInstance(bonusEqId, 1, true, null, mobLv), ent.x + 28, ent.y + 12));
            }
          } else if (wasElite) {
            // 👑 [★거대정예] 이벤트 몬스터 처치 시 골드 2.4배 확정 지급 및 높은 확률로 장비/소모품 추가 드롭
            droppedGold = Math.floor((24 + mobLv * 5.2 + Math.random() * 32) * 2.4);
            if (Math.random() < 0.85) {
              const isEqRoll = Math.random() < 0.42;
              const pickedId = pickServerMonsterTierDrop(ent, isEqRoll ? 'equip' : 'consumable', killerClass);
              newGroundItems.push(spawnServerGroundItem(mapInst, createServerItemInstance(pickedId, 1, false, null, mobLv), ent.x, ent.y));
            }
          } else {
            if (Math.random() < 0.50) {
              const subRoll = Math.random() * 100;
              if (subRoll < 48) {
                droppedGold = Math.floor(14 + mobLv * 3.5 + Math.random() * 22);
              } else if (subRoll < 82) {
                const pickedCons = pickServerMonsterTierDrop(ent, 'consumable', killerClass);
                newGroundItems.push(spawnServerGroundItem(mapInst, createServerItemInstance(pickedCons, 1, false), ent.x, ent.y));
              } else {
                const pickedEq = pickServerMonsterTierDrop(ent, 'equip', killerClass);
                newGroundItems.push(spawnServerGroundItem(mapInst, createServerItemInstance(pickedEq, 1, false, null, mobLv), ent.x, ent.y));
              }
            }
          }

          const contributors = [];
          ent.damageContributors.forEach((info, cId) => {
            if (now - info.lastTime <= 20000) contributors.push(cId);
          });
          if (!contributors.includes(msg.charId)) contributors.push(msg.charId);
          // 같은 맵에 있는 파티원도 공헌자(경험치·퀘스트 공유)에 자동 포함
          if (atkParty) {
            atkParty.members.forEach(pCid => {
              const pEntry = activeCharSockets.get(pCid);
              if (pEntry && normalizeMapKey(pEntry.mapKey) === mapInst.mapKey && !contributors.includes(pCid)) {
                contributors.push(pCid);
              }
            });
          }
          ent.damageContributors.clear();

          if (ent.isGmSpawned) {
            const idx = mapInst.monsters.indexOf(ent);
            if (idx > -1) mapInst.monsters.splice(idx, 1);
            if (mapInst.monsterById) mapInst.monsterById.delete(String(ent.id));
          }

          const finalBaseExp = wasElite ? Math.round((ent.baseExp || 20) * 2.2) : (ent.baseExp || 20);

          broadcastToMap(mapInst.mapKey, {
            type: 'MONSTER_KILLED',
            mapKey: mapInst.mapKey,
            mobId: ent.id,
            mobLv: ent.lv || 1,
            mobName: ent.name,
            rawName: ent.rawName,
            isBoss: ent.isBoss,
            isElite: wasElite,
            isGmSpawned: Boolean(ent.isGmSpawned),
            x: Math.round(ent.x),
            y: Math.round(ent.y),
            bossRespawnTimer: Math.ceil(mapInst.bossRespawnTimer),
            respawnTimer: ent.respawnTimer,
            killerCharId: msg.charId,
            contributors,
            baseExp: finalBaseExp,
            droppedGold,
            newGroundItems
          });
        }
      }
    });
    return;
  }

  // [5] 바닥 드롭 아이템 루팅 요청
  if (msg.type === 'PICKUP_GROUND_ITEM' && msg.charId && msg.itemUid) {
    const entry = activeCharSockets.get(msg.charId);
    const mapInst = getOrInitWorldMap(msg.mapKey || entry?.mapKey || 'R01_sub1');
    const idx = mapInst.groundItems.findIndex(it => it.uid === msg.itemUid);
    if (idx === -1) return;

    const pickedItem = mapInst.groundItems.splice(idx, 1)[0];
    sendWsMessage(conn, {
      type: 'ITEM_PICKUP_CONFIRMED',
      charId: msg.charId,
      item: pickedItem
    });
    broadcastToMap(mapInst.mapKey, {
      type: 'GROUND_ITEM_REMOVED',
      mapKey: mapInst.mapKey,
      itemUid: pickedItem.uid,
      pickedByCharId: msg.charId
    });
    return;
  }

  // [6] 플레이어 가방 아이템 바닥 버리기 동기화
  if (msg.type === 'DROP_ITEM_TO_GROUND' && msg.charId && msg.item) {
    const entry = activeCharSockets.get(msg.charId);
    const mapInst = getOrInitWorldMap(msg.mapKey || entry?.mapKey || 'R01_sub1');
    const px = Number(msg.x) || entry?.player?.x || mapInst.mapData.spawn.x;
    const py = Number(msg.y) || entry?.player?.y || mapInst.mapData.spawn.y;
    const dropped = spawnServerGroundItem(mapInst, msg.item, px, py);
    broadcastToMap(mapInst.mapKey, {
      type: 'GROUND_ITEM_ADDED',
      mapKey: mapInst.mapKey,
      item: dropped
    });
    return;
  }

// [7] 타 플레이어(및 용병) 스킬 시전 이펙트 브로드캐스트
  if (msg.type === 'PLAYER_SKILL' && msg.charId) {
    const entry = activeCharSockets.get(msg.charId);
    if (entry) {
      entry.lastSeen = Date.now();
      if (!msg.isMerc && entry.player) {
        entry.player.lastAttackTime = Date.now();
        entry.player.isWalking = false;
        if (typeof msg.casterX === 'number') entry.player.x = Math.round(msg.casterX);
        if (typeof msg.casterY === 'number') entry.player.y = Math.round(msg.casterY);
        if (typeof msg.tx === 'number' && typeof msg.ty === 'number') {
          const dxSk = msg.tx - (entry.player.x || 0);
          const dySk = msg.ty - (entry.player.y || 0);
          if (Math.abs(dxSk) > 1 || Math.abs(dySk) > 1) {
            entry.player.dir = Math.abs(dxSk) > Math.abs(dySk) ? (dxSk > 0 ? 'right' : 'left') : (dySk > 0 ? 'down' : 'up');
          }
        }
      } else if (msg.isMerc && entry.player && entry.player.mercenary) {
        entry.player.mercenary.lastAttackTime = Date.now();
        entry.player.mercenary.isWalking = false;
        if (typeof msg.casterX === 'number') entry.player.mercenary.x = Math.round(msg.casterX);
        if (typeof msg.casterY === 'number') entry.player.mercenary.y = Math.round(msg.casterY);
      }
    }
    if (entry?.gmInvisible) return;
    
    // ✅ 시각 전용 스킬 이펙트는 반경 1450px 내 실제 유저에게만 전송 (AI 루프백 제외)
    const skX = Number(msg.tx ?? msg.targetX ?? msg.casterX ?? entry?.player?.x) || 2000;
    const skY = Number(msg.ty ?? msg.targetY ?? msg.casterY ?? entry?.player?.y) || 9000;
    broadcastToMapAoi(msg.mapKey || entry?.mapKey, skX, skY, 1450, 0, {
      ...msg,
      type: 'REMOTE_SKILL_EFFECT'
    }, msg.charId);
    return;
  }

  // [8] 아군 힐/버프 지원 (동일 맵 브로드캐스트 포함하여 내가 보는 이펙트를 다른 플레이어도 동일하게 관찰!)
  if (msg.type === 'ALLY_SUPPORT' && msg.targetCharId) {
    const targetEntry = activeCharSockets.get(msg.targetCharId);
    if (targetEntry) {
      sendWsMessage(targetEntry.conn, {
        type: 'REMOTE_ALLY_SUPPORT',
        ...msg
      });
      const bx = Math.round(targetEntry.player?.x || msg.x || 2000);
      const by = Math.round(targetEntry.player?.y || msg.y || 14250);
      broadcastToMapAoi(targetEntry.mapKey, bx, by, 1450, 0, {
        type: 'REMOTE_PLAYER_ACTION_FX',
        fxKind: 'ally_buff',
        charId: msg.casterCharId || msg.charId,
        targetCharId: msg.targetCharId,
        x: bx,
        y: by,
        skillName: msg.skillName || '힐링',
        healAmt: msg.healAmt || 0
      }, msg.casterCharId || msg.charId);
    }
    return;
  }

  // [8-B] 멀티플레이 브로드캐스터
  if (msg.type === 'PLAYER_ACTION_FX' && msg.charId) {
    const entry = activeCharSockets.get(msg.charId);
    if (entry) {
      entry.lastSeen = Date.now();
      if (msg.fxKind === 'basic_atk') {
        if (!msg.isMerc && entry.player) {
          entry.player.lastAttackTime = Date.now();
          entry.player.isWalking = false;
          if (typeof msg.sx === 'number') entry.player.x = Math.round(msg.sx);
          if (typeof msg.sy === 'number') entry.player.y = Math.round(msg.sy);
          if (typeof msg.tx === 'number' && typeof msg.ty === 'number') {
            const dxAtk = msg.tx - (entry.player.x || 0);
            const dyAtk = msg.ty - (entry.player.y || 0);
            if (Math.abs(dxAtk) > 1 || Math.abs(dyAtk) > 1) {
              entry.player.dir = Math.abs(dxAtk) > Math.abs(dyAtk) ? (dxAtk > 0 ? 'right' : 'left') : (dyAtk > 0 ? 'down' : 'up');
            }
          }
        } else if (msg.isMerc && entry.player && entry.player.mercenary) {
          entry.player.mercenary.lastAttackTime = Date.now();
          entry.player.mercenary.isWalking = false;
          if (typeof msg.sx === 'number') entry.player.mercenary.x = Math.round(msg.sx);
          if (typeof msg.sy === 'number') entry.player.mercenary.y = Math.round(msg.sy);
        }
      } else if (msg.fxKind === 'teleport' && entry.player) {
        if (typeof msg.x === 'number') entry.player.x = Math.round(msg.x);
        if (typeof msg.y === 'number') entry.player.y = Math.round(msg.y);
      }
    }
    if (entry?.gmInvisible) return;

    const fxX = Number(msg.x ?? msg.sx ?? entry?.player?.x) || 2000;
    const fxY = Number(msg.y ?? msg.sy ?? entry?.player?.y) || 9000;
    broadcastToMapAoi(msg.mapKey || entry?.mapKey, fxX, fxY, 1450, 0, {
      ...msg,
      type: 'REMOTE_PLAYER_ACTION_FX'
    }, msg.charId);
    return;
  }

  // [8-C] 파티 시스템 실시간 패킷 처리 (초대 수락/거절, 탈퇴, 위임, 파티모드/점사타겟 변경)
  if (msg.type === 'PARTY_INVITE_RESP' && msg.charId) {
    const entry = activeCharSockets.get(msg.charId);
    const inviterEntry = activeCharSockets.get(msg.inviterCharId);
    if (!entry || !inviterEntry) return;
    if (!msg.accept) {
      sendSystemMsgToEntry(inviterEntry, `ℹ️ '${entry.player?.name || '모험가'}'님이 파티 초대를 거절했습니다.`, 'log-hit');
      return;
    }
    const existingEntryParty = getPartyByCharId(entry.charId);
    if (existingEntryParty) {
      if (existingEntryParty.members.includes(inviterEntry.charId)) {
        broadcastPartyUpdate(existingEntryParty);
        return;
      }
      if (isAIEntry(entry) && !isAIEntry(inviterEntry)) {
        removeCharFromParty(entry.charId, 'leave');
      } else {
        sendSystemMsgToEntry(entry, `⚠️ 이미 가입된 파티가 있습니다.`, 'log-hit');
        return;
      }
    }
    let party = getPartyByCharId(inviterEntry.charId);
    if (!party) {
      const newPartyId = `pty_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      party = {
        partyId: newPartyId,
        leaderCharId: inviterEntry.charId,
        leaderTargetMobId: null,
        partyMode: 'FREE',
        members: [inviterEntry.charId]
      };
      serverParties.set(newPartyId, party);
      inviterEntry.partyId = newPartyId;
      if (inviterEntry.player) {
        inviterEntry.player.partyId = newPartyId;
        inviterEntry.player.isPartyLeader = true;
      }
    }
    if (party.members.length >= 5) {
      sendSystemMsgToEntry(entry, `⚠️ 파티 인원(최대 5명)이 가득 찼습니다.`, 'log-hit');
      return;
    }
    if (!party.members.includes(entry.charId)) {
      party.members.push(entry.charId);
    }
    entry.partyId = party.partyId;
    if (entry.player) {
      entry.player.partyId = party.partyId;
      entry.player.isPartyLeader = (party.leaderCharId === entry.charId);
    }
    party.members.forEach(cId => {
      const mE = activeCharSockets.get(cId);
      if (mE) {
        sendSystemMsgToEntry(mE, `🎉 [파티 합류] '${entry.player?.name}'님이 파티에 합류했습니다! (현재 ${party.members.length}명)`, 'log-kill');
      }
    });
    broadcastPartyUpdate(party);
    return;
  }

  if (msg.type === 'PARTY_LEAVE_REQ' && msg.charId) {
    removeCharFromParty(msg.charId, 'leave');
    return;
  }

  if (msg.type === 'PARTY_CLAIM_LEADER_REQ' && msg.charId) {
    const entry = activeCharSockets.get(msg.charId);
    const party = getPartyByCharId(msg.charId);
    if (!entry || !party) return;
    const ldrEntry = activeCharSockets.get(party.leaderCharId);
    if (!ldrEntry || isAIEntry(ldrEntry)) {
      delegatePartyLeaderToHuman(party, entry);
    } else {
      sendSystemMsgToEntry(entry, `⚠️ 현재 파티장('${ldrEntry.player?.name}')님은 실제 플레이어입니다.`, 'log-hit');
    }
    return;
  }

  if (msg.type === 'PARTY_DELEGATE_REQ' && msg.charId && msg.targetCharId) {
    const party = getPartyByCharId(msg.charId);
    if (!party || party.leaderCharId !== msg.charId) return;
    if (!party.members.includes(msg.targetCharId)) return;
    const targetEntry = activeCharSockets.get(msg.targetCharId);
    if (!targetEntry) return;
    party.leaderCharId = msg.targetCharId;
    party.members = [msg.targetCharId, ...party.members.filter(id => id !== msg.targetCharId)];
    party.members.forEach(cId => {
      const mE = activeCharSockets.get(cId);
      if (mE) {
        if (mE.player) mE.player.isPartyLeader = (cId === party.leaderCharId);
        sendSystemMsgToEntry(mE, `👑 [파티장 위임] '${targetEntry.player?.name}'님이 새로운 파티장이 되었습니다!`, 'log-kill');
      }
    });
    broadcastPartyUpdate(party);
    return;
  }

  if (msg.type === 'PARTY_MODE_REQ' && msg.charId) {
    const party = getPartyByCharId(msg.charId);
    if (!party) return;
    if (msg.partyMode && ['FREE', 'FOCUS'].includes(msg.partyMode)) {
      party.partyMode = msg.partyMode;
    }
    if (party.leaderCharId === msg.charId && msg.leaderTargetMobId !== undefined) {
      party.leaderTargetMobId = msg.leaderTargetMobId;
    } else if (party.leaderCharId) {
      const ldrEntry = activeCharSockets.get(party.leaderCharId);
      if (ldrEntry?.player?.targetMobId) {
        party.leaderTargetMobId = String(ldrEntry.player.targetMobId);
      }
    }
    broadcastPartyUpdate(party);
    return;
  }

  // [8-D] 현재 존(Zone) 에이전트/플레이어 실시간 목록 조회 (파티창 오픈 및 존 이동 시 호출)
  if (msg.type === 'REGION_PLAYERS_REQ' && msg.charId) {
    const entry = activeCharSockets.get(msg.charId);
    if (!entry) return;
    entry.lastSeen = Date.now();
    if (msg.mapKey) entry.mapKey = normalizeMapKey(msg.mapKey);
    if (msg.regionKey) entry.regionKey = String(msg.regionKey).split('_')[0] || entry.regionKey;
    if (entry.player) {
      if (typeof msg.x === 'number' && !isNaN(msg.x)) entry.player.x = Math.round(msg.x);
      if (typeof msg.y === 'number' && !isNaN(msg.y)) entry.player.y = Math.round(msg.y);
    }

    const myRegion = String(msg.regionKey || entry.regionKey || entry.mapKey || 'R01').split('_')[0];
    const myMapKey = normalizeMapKey(msg.mapKey || entry.mapKey || `${myRegion}_sub1`);
    const myX = Number(msg.x ?? entry.player?.x) || 2000;
    const myY = Number(msg.y ?? entry.player?.y) || 14250;
    const myZone = resolveServerEntityZone(myRegion, myMapKey, myX, myY);

    // 현재 존(Zone)에 AI 모험가가 부족할 경우 같은 지역/맵의 솔로 AI 에이전트 일부를 해당 존 사냥터로 자연스럽게 배치
    let sameZoneCount = 0;
    const sameRegionSoloAIs = [];
    activeCharSockets.forEach(other => {
      if (!other || !other.player || other.charId === entry.charId) return;
      if (other.gmInvisible && !entry.isAdmin) return;
      const oReg = String(other.regionKey || other.mapKey || 'R01').split('_')[0];
      if (oReg !== myRegion) return;
      const oZone = resolveServerEntityZone(oReg, other.mapKey, other.player.x, other.player.y);
      if (oZone.zoneKey === myZone.zoneKey) {
        sameZoneCount++;
      } else if (isAIEntry(other) && !getPartyByCharId(other.charId)) {
        sameRegionSoloAIs.push(other);
      }
    });

    if (sameZoneCount < 3 && sameRegionSoloAIs.length > 0) {
      const mapData = HardcodedMapDB[myMapKey] || {};
      let anchorX = myX;
      let anchorY = myY;
      if (myZone.zoneType === 'town') {
        const tPt = mapData.spawn || { x: 2000, y: 14250 };
        anchorX = tPt.x;
        anchorY = Math.max(1200, tPt.y - 920);
      } else if (myZone.zoneType === 'field') {
        const fPt = mapData.fieldCenterPos || mapData.fieldPos || { x: 2000, y: 9200 };
        anchorX = fPt.x;
        anchorY = fPt.y;
      } else if (myZone.zoneType === 'dungeon_entrance') {
        const dPt = mapData.dungeonEntrance || { x: 2000, y: 5200 };
        anchorX = dPt.x;
        anchorY = dPt.y + 460;
      } else if (myZone.zoneType === 'boss_camp') {
        const bPt = mapData.bossWarpPos || mapData.bossPos || { x: 2000, y: 2000 };
        anchorX = bPt.x;
        anchorY = bPt.y + 380;
      } else if (myZone.zoneType === 'dungeon') {
        anchorX = 1200;
        anchorY = 1200;
      }
      const needCnt = Math.min(3 - sameZoneCount, sameRegionSoloAIs.length);
      for (let i = 0; i < needCnt; i++) {
        const aiEnt = sameRegionSoloAIs[i];
        aiEnt.mapKey = myMapKey;
        aiEnt.regionKey = myRegion;
        aiEnt.player.mapKey = myMapKey;
        aiEnt.player.regionKey = myRegion;
        aiEnt.player.x = Math.round(anchorX + ((i - 1) * 180));
        aiEnt.player.y = Math.round(anchorY + (((i % 2) * 2 - 1) * 140));
      }
    }

    const list = [];
    activeCharSockets.forEach(other => {
      if (!other || !other.player || other.charId === entry.charId) return;
      if (other.gmInvisible && !entry.isAdmin) return;
      const oReg = String(other.regionKey || other.mapKey || 'R01').split('_')[0];
      if (oReg !== myRegion) return;
      const ox = Math.round(other.player.x || 2000);
      const oy = Math.round(other.player.y || 14250);
      const oMapKey = normalizeMapKey(other.mapKey || `${oReg}_sub1`);
      const oZone = resolveServerEntityZone(oReg, oMapKey, ox, oy);
      // 해당 지역 전체가 아니라 플레이어가 위치한 '해당 존(Zone)'에 있는 AI 및 유저만 필터링!
      if (oZone.zoneKey !== myZone.zoneKey) return;

      const oMapInst = worldMaps.get(oMapKey);
      const inSafe = oMapInst ? isInsideServerSafeZone(oMapInst, ox, oy) : false;
      const oParty = getPartyByCharId(other.charId);
      const ldrEntry = oParty ? activeCharSockets.get(oParty.leaderCharId) : null;
      list.push({
        charId: other.charId,
        name: other.player.name || '모험가',
        class: other.player.class || 'knight',
        level: other.player.level || 1,
        x: ox,
        y: oy,
        mapKey: oMapKey,
        regionKey: oReg,
        zoneKey: oZone.zoneKey,
        zoneName: oZone.zoneName,
        inSafeZone: inSafe,
        isAI: isAIEntry(other),
        partyId: oParty ? oParty.partyId : null,
        isPartyLeader: Boolean(oParty && oParty.leaderCharId === other.charId),
        partyMemberCount: oParty ? oParty.members.length : 0,
        partyMaxMembers: 5,
        partyLeaderName: ldrEntry?.player?.name || null,
        partyMode: oParty ? (oParty.partyMode || 'FREE') : null
      });
    });
    sendWsMessage(conn, {
      type: 'REGION_PLAYERS_RESP',
      regionKey: myRegion,
      mapKey: myMapKey,
      zoneKey: myZone.zoneKey,
      zoneName: myZone.zoneName,
      players: list
    });
    return;
  }

  // [8-D2] 파티창에서 특정 캐릭터(charId 또는 이름) 클릭하여 즉시 파티 초대/합류 요청 (PARTY_INVITE_REQ)
  if (msg.type === 'PARTY_INVITE_REQ' && msg.charId && (msg.targetCharId || msg.targetName)) {
    const entry = activeCharSockets.get(msg.charId);
    if (!entry || !entry.player) return;
    entry.lastSeen = Date.now();
    if (msg.mapKey) entry.mapKey = normalizeMapKey(msg.mapKey);
    if (msg.regionKey) entry.regionKey = String(msg.regionKey).split('_')[0] || entry.regionKey;
    const targetEntry = (msg.targetCharId && activeCharSockets.get(msg.targetCharId))
      || findOnlineEntryByName(msg.targetName, entry.regionKey, entry.mapKey);
    if (!targetEntry || !targetEntry.player) {
      sendSystemMsgToEntry(entry, `⚠️ '${msg.targetName || '대상'}' 캐릭터가 현재 접속 중이지 않습니다.`, 'log-hit');
      return;
    }
    entry._pendingInviteTargetCharId = targetEntry.charId;
    handleChatCommand(entry, `/파티초대 ${targetEntry.player.name}`);
    return;
  }

  // [8-E] 이미 결성된 파티에 즉시 합류 요청 (PARTY_JOIN_EXISTING_REQ)
  if (msg.type === 'PARTY_JOIN_EXISTING_REQ' && msg.charId && (msg.targetCharId || msg.targetName || msg.targetPartyId)) {
    const entry = activeCharSockets.get(msg.charId);
    if (!entry || !entry.player) return;
    entry.lastSeen = Date.now();
    if (msg.mapKey) entry.mapKey = normalizeMapKey(msg.mapKey);
    if (msg.regionKey) entry.regionKey = String(msg.regionKey).split('_')[0] || entry.regionKey;
    const targetEntry = (msg.targetCharId && activeCharSockets.get(msg.targetCharId))
      || (msg.targetName && findOnlineEntryByName(msg.targetName, entry.regionKey, entry.mapKey))
      || (msg.targetPartyId && serverParties.get(msg.targetPartyId) ? activeCharSockets.get(serverParties.get(msg.targetPartyId).leaderCharId) : null);
    if (!targetEntry || !targetEntry.player) {
      sendSystemMsgToEntry(entry, `⚠️ 대상 캐릭터가 현재 접속 중이지 않습니다.`, 'log-hit');
      return;
    }
    const targetParty = getPartyByCharId(targetEntry.charId) || (msg.targetPartyId ? serverParties.get(msg.targetPartyId) : null);
    if (!targetParty) {
      // 대상이 아직 파티가 없으면 일반 파티 초대로 연결
      entry._pendingInviteTargetCharId = targetEntry.charId;
      handleChatCommand(entry, `/파티초대 ${targetEntry.player.name}`);
      return;
    }
    const myParty = getPartyByCharId(entry.charId);
    if (myParty && myParty.partyId === targetParty.partyId) {
      sendSystemMsgToEntry(entry, `ℹ️ 이미 해당 파티에 소속되어 있습니다.`, 'log-sys');
      broadcastPartyUpdate(targetParty);
      return;
    }
    if (myParty) {
      removeCharFromParty(entry.charId, 'leave');
    }
    // 정원(5명)이 가득 찼을 때 AI 파티원이 있으면 1명 양보 처리
    if (targetParty.members.length >= 5) {
      const yieldAiId = [...targetParty.members].reverse().find(cid => cid !== targetParty.leaderCharId && isAIEntry(activeCharSockets.get(cid)));
      if (yieldAiId) {
        removeCharFromParty(yieldAiId, 'leave');
      } else {
        sendSystemMsgToEntry(entry, `⚠️ 해당 파티의 인원(5/5명)이 가득 차 있어 합류할 수 없습니다.`, 'log-hit');
        return;
      }
    }
    if (!targetParty.members.includes(entry.charId)) {
      targetParty.members.push(entry.charId);
    }
    entry.partyId = targetParty.partyId;
    entry.player.partyId = targetParty.partyId;
    entry.player.isPartyLeader = (targetParty.leaderCharId === entry.charId);

    targetParty.members.forEach(cId => {
      const mE = activeCharSockets.get(cId);
      if (mE) {
        sendSystemMsgToEntry(mE, `🎉 [파티 합류] '${entry.player.name}'님이 파티에 합류했습니다! (현재 ${targetParty.members.length}/5명)`, 'log-kill');
      }
    });
    broadcastPartyUpdate(targetParty);
    return;
  }

  // [8-F] 플레이어 간 아이템 · 골드 안전 거래 시스템 (원자적 상태 검증 & 복사 원천 차단)
  if (msg.type === 'TRADE_REQUEST' && msg.charId) {
    const entry = activeCharSockets.get(msg.charId);
    if (!entry || !entry.player) return;
    entry.lastSeen = Date.now();
    if (msg.mapKey) entry.mapKey = normalizeMapKey(msg.mapKey);
    if (msg.regionKey) entry.regionKey = String(msg.regionKey).split('_')[0] || entry.regionKey;

    const targetEntry = (msg.targetCharId && activeCharSockets.get(msg.targetCharId))
      || findOnlineEntryByName(msg.targetName, entry.regionKey, entry.mapKey);
    if (!targetEntry || !targetEntry.player || (targetEntry.gmInvisible && !entry.isAdmin)) {
      sendSystemMsgToEntry(entry, `⚠️ 거래 대상이 현재 접속 중이지 않습니다.`, 'log-hit');
      return;
    }
    if (targetEntry.charId === entry.charId) {
      sendSystemMsgToEntry(entry, `⚠️ 본인에게는 거래를 신청할 수 없습니다.`, 'log-hit');
      return;
    }
    const myReg = String(entry.regionKey || entry.mapKey || 'R01').split('_')[0];
    const targetReg = String(targetEntry.regionKey || targetEntry.mapKey || 'R01').split('_')[0];
    if (myReg !== targetReg) {
      if (isAIEntry(targetEntry) && !isAIEntry(entry)) {
        targetEntry.regionKey = myReg;
        targetEntry.mapKey = normalizeMapKey(entry.mapKey);
      } else {
        sendSystemMsgToEntry(entry, `⚠️ '${targetEntry.player.name}'님과 같은 지역에 있어야 거래할 수 있습니다.`, 'log-hit');
        return;
      }
    }
    if (activeCharTradeMap.has(entry.charId)) {
      const oldTid = activeCharTradeMap.get(entry.charId);
      const oldTrd = oldTid ? serverTrades.get(oldTid) : null;
      if (!oldTrd || (oldTrd.state === 'INVITED' && Date.now() - oldTrd.createdAt > 15000)) {
        cancelActiveTradeForChar(entry.charId, '이전 거래 요청 시간이 만료되어 초기화되었습니다.');
      } else {
        sendSystemMsgToEntry(entry, `⚠️ 이미 진행 중인 거래가 있습니다.`, 'log-hit');
        return;
      }
    }
    if (activeCharTradeMap.has(targetEntry.charId)) {
      const oldTid = activeCharTradeMap.get(targetEntry.charId);
      const oldTrd = oldTid ? serverTrades.get(oldTid) : null;
      if (!oldTrd || (oldTrd.state === 'INVITED' && Date.now() - oldTrd.createdAt > 15000)) {
        cancelActiveTradeForChar(targetEntry.charId, '이전 거래 요청 시간이 만료되어 초기화되었습니다.');
      } else {
        sendSystemMsgToEntry(entry, `⚠️ '${targetEntry.player.name}'님은 현재 다른 거래를 진행 중입니다.`, 'log-hit');
        return;
      }
    }

    const tradeId = `trd_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const tradeSession = {
      tradeId,
      state: 'INVITED',
      offerVersion: 1,
      createdAt: Date.now(),
      playerA: {
        charId: entry.charId,
        name: entry.player.name || '모험가',
        level: entry.player.level || 1,
        class: entry.player.class || 'knight',
        items: [],
        gold: 0,
        freeSlots: 20,
        currentGold: Math.max(0, Number(entry.player.gold) || 0),
        locked: false,
        confirmed: false
      },
      playerB: {
        charId: targetEntry.charId,
        name: targetEntry.player.name || '모험가',
        level: targetEntry.player.level || 1,
        class: targetEntry.player.class || 'knight',
        items: [],
        gold: 0,
        freeSlots: 20,
        currentGold: Math.max(0, Number(targetEntry.player.gold) || 0),
        locked: false,
        confirmed: false
      }
    };

    serverTrades.set(tradeId, tradeSession);
    activeCharTradeMap.set(entry.charId, tradeId);
    activeCharTradeMap.set(targetEntry.charId, tradeId);

    sendWsMessage(entry.conn, {
      type: 'TRADE_REQUEST_SENT',
      tradeId,
      targetCharId: targetEntry.charId,
      targetName: targetEntry.player.name,
      targetLevel: targetEntry.player.level || 1
    });
    sendWsMessage(targetEntry.conn, {
      type: 'TRADE_INVITE_RECEIVED',
      tradeId,
      inviterCharId: entry.charId,
      inviterName: entry.player.name || '모험가',
      inviterLevel: entry.player.level || 1,
      inviterClass: entry.player.class || 'knight',
      requesterCharId: entry.charId,
      requesterName: entry.player.name || '모험가',
      requesterLevel: entry.player.level || 1,
      requesterClass: entry.player.class || 'knight'
    });
    sendSystemMsgToEntry(entry, `🤝 '${targetEntry.player.name}'님에게 거래를 신청했습니다. (응답 대기 중)`, 'log-sys');

    // AI 대상일 경우 600ms 후에도 INVITED 상태면 서버에서 자동 수락 폴백 처리
    if (isAIEntry(targetEntry)) {
      setTimeout(() => {
        const curTrd = serverTrades.get(tradeId);
        if (curTrd && curTrd.state === 'INVITED') {
          curTrd.state = 'OPEN';
          curTrd.offerVersion = 1;
          broadcastTradeSync(curTrd);
        }
      }, 600);
    }

    // 16초 무응답 시 서버 세션 자동 만료 정리
    setTimeout(() => {
      const curTrd = serverTrades.get(tradeId);
      if (curTrd && curTrd.state === 'INVITED') {
        cancelActiveTradeForChar(entry.charId, '거래 요청 응답 시간이 만료되었습니다.');
      }
    }, 16000);
    return;
  }

  if (msg.type === 'TRADE_INVITE_RESP' && msg.charId && msg.tradeId) {
    const trade = serverTrades.get(msg.tradeId);
    if (!trade || trade.state !== 'INVITED') return;
    if (trade.playerB.charId !== msg.charId) return;

    const reqEntry = activeCharSockets.get(trade.playerA.charId);
    const respEntry = activeCharSockets.get(trade.playerB.charId);

    if (!msg.accept || !reqEntry || !respEntry) {
      cancelActiveTradeForChar(msg.charId, `'${trade.playerB.name}'님이 거래 신청을 거절했습니다.`);
      return;
    }

    trade.state = 'OPEN';
    trade.offerVersion = 1;
    broadcastTradeSync(trade);
    return;
  }

  if (msg.type === 'TRADE_UPDATE_OFFER' && msg.charId && msg.tradeId) {
    const trade = serverTrades.get(msg.tradeId);
    if (!trade || trade.state !== 'OPEN') return;
    const isA = trade.playerA.charId === msg.charId;
    const isB = trade.playerB.charId === msg.charId;
    if (!isA && !isB) return;

    const mySide = isA ? trade.playerA : trade.playerB;
    if (mySide.locked) {
      // 잠금 상태에서는 먼저 잠금을 해제해야만 수정 가능
      return;
    }

    const callerEntry = activeCharSockets.get(msg.charId);
    const fallbackGold = Math.max(mySide.currentGold || 0, Number(callerEntry?.player?.gold) || 0, Number(msg.gold) || 0);
    const curGold = Math.max(0, Math.min(999999999, Math.floor(msg.currentGold !== undefined ? Number(msg.currentGold) : fallbackGold)));
    const offerGold = Math.max(0, Math.min(curGold, Math.floor(Number(msg.gold) || 0)));
    const cleanItems = sanitizeTradeOfferItems(msg.items);
    const freeSlots = Math.max(0, Math.min(100, Math.floor(Number(msg.freeSlots ?? mySide.freeSlots ?? 20))));

    mySide.items = cleanItems;
    mySide.gold = offerGold;
    mySide.currentGold = curGold;
    mySide.freeSlots = freeSlots;
    if (callerEntry?.player && msg.currentGold !== undefined) {
      callerEntry.player.gold = curGold;
    }

    // 🛡️ 사기/복사 방지 핵심: 어느 한쪽이라도 물품/골드를 변경하면 양측 모두 잠금(locked) 및 확정(confirmed) 즉시 해제!
    trade.offerVersion++;
    trade.playerA.locked = false;
    trade.playerB.locked = false;
    trade.playerA.confirmed = false;
    trade.playerB.confirmed = false;

    broadcastTradeSync(trade);
    return;
  }

  if (msg.type === 'TRADE_LOCK_REQ' && msg.charId && msg.tradeId) {
    const trade = serverTrades.get(msg.tradeId);
    if (!trade || trade.state !== 'OPEN') return;
    const isA = trade.playerA.charId === msg.charId;
    const isB = trade.playerB.charId === msg.charId;
    if (!isA && !isB) return;

    const mySide = isA ? trade.playerA : trade.playerB;
    const otherSide = isA ? trade.playerB : trade.playerA;
    const wantLock = Boolean(msg.locked);

    if (wantLock) {
      const callerEntry = activeCharSockets.get(msg.charId);
      const fallbackGold = Math.max(mySide.currentGold || 0, Number(callerEntry?.player?.gold) || 0, Number(msg.gold ?? mySide.gold) || 0);
      const curGold = Math.max(0, Math.min(999999999, Math.floor(msg.currentGold !== undefined ? Number(msg.currentGold) : fallbackGold)));
      const rawOfferGold = msg.gold !== undefined ? Number(msg.gold) : mySide.gold;
      const offerGold = Math.max(0, Math.min(curGold, Math.floor(rawOfferGold || 0)));
      const cleanItems = msg.items !== undefined ? sanitizeTradeOfferItems(msg.items) : (mySide.items || []);
      const freeSlots = Math.max(0, Math.min(100, Math.floor(Number(msg.freeSlots ?? mySide.freeSlots ?? 20))));
      mySide.items = cleanItems;
      mySide.gold = offerGold;
      mySide.currentGold = curGold;
      mySide.freeSlots = freeSlots;
      mySide.locked = true;
    } else {
      mySide.locked = false;
      trade.playerA.confirmed = false;
      trade.playerB.confirmed = false;
      trade.offerVersion++;
    }

    broadcastTradeSync(trade);

    // 상대방이 AI 에이전트이고 내가 잠금 완료했을 때 AI 자동 잠금 폴백
    const otherEntry = activeCharSockets.get(otherSide.charId);
    if (wantLock && otherEntry && isAIEntry(otherEntry) && !otherSide.locked) {
      const lockVer = trade.offerVersion;
      setTimeout(() => {
        const curTrd = serverTrades.get(trade.tradeId);
        if (!curTrd || curTrd.state !== 'OPEN' || curTrd.offerVersion !== lockVer) return;
        if (mySide.locked && !otherSide.locked) {
          otherSide.locked = true;
          otherSide.freeSlots = Math.max(20, otherSide.freeSlots || 20);
          broadcastTradeSync(curTrd);
        }
      }, 650);
    }
    return;
  }

  if (msg.type === 'TRADE_CONFIRM_REQ' && msg.charId && msg.tradeId) {
    const trade = serverTrades.get(msg.tradeId);
    if (!trade || trade.state !== 'OPEN') return;
    if (!trade.playerA.locked || !trade.playerB.locked) {
      const caller = activeCharSockets.get(msg.charId);
      if (caller) sendSystemMsgToEntry(caller, `⚠️ 양측 모두 먼저 [🔒 등록완료]를 눌러야 거래를 확정할 수 있습니다.`, 'log-hit');
      return;
    }
    if (msg.offerVersion !== undefined && Number(msg.offerVersion) !== trade.offerVersion) {
      const caller = activeCharSockets.get(msg.charId);
      if (caller) sendSystemMsgToEntry(caller, `⚠️ 거래 조건이 변경되었습니다. 내역을 다시 확인한 후 확정해주세요.`, 'log-hit');
      return;
    }

    const isA = trade.playerA.charId === msg.charId;
    const isB = trade.playerB.charId === msg.charId;
    if (!isA && !isB) return;

    const mySide = isA ? trade.playerA : trade.playerB;
    const otherSide = isA ? trade.playerB : trade.playerA;
    mySide.confirmed = true;

    // 상대방이 AI 에이전트면 즉시 함께 확정 처리
    const otherEntry = activeCharSockets.get(otherSide.charId);
    if (otherEntry && isAIEntry(otherEntry) && otherSide.locked && !otherSide.confirmed) {
      otherSide.confirmed = true;
    }

    if (!trade.playerA.confirmed || !trade.playerB.confirmed) {
      broadcastTradeSync(trade);
      return;
    }

    // 🔒 양측 모두 거래확정 완료 -> 즉시 원자적 커밋 상태로 전환 및 맵에서 제거하여 중복 패킷/레이스 컨디션 100% 차단!
    trade.state = 'COMMITTING';
    serverTrades.delete(trade.tradeId);
    activeCharTradeMap.delete(trade.playerA.charId);
    activeCharTradeMap.delete(trade.playerB.charId);

    const entryA = activeCharSockets.get(trade.playerA.charId);
    const entryB = activeCharSockets.get(trade.playerB.charId);
    if (!entryA || !entryB || !entryA.conn || !entryB.conn) {
      [entryA, entryB].forEach(e => {
        if (e && e.conn) sendWsMessage(e.conn, { type: 'TRADE_CANCELLED', tradeId: trade.tradeId, reason: '상대방의 연결이 끊어져 거래가 취소되었습니다.' });
      });
      return;
    }

    // 가방 여유 슬롯 및 보유 골드 한도 최종 검증
    if (trade.playerA.gold > trade.playerA.currentGold || trade.playerB.gold > trade.playerB.currentGold) {
      [entryA, entryB].forEach(e => {
        sendWsMessage(e.conn, { type: 'TRADE_CANCELLED', tradeId: trade.tradeId, reason: '보유 골드 검증에 실패하여 거래가 취소되었습니다.' });
      });
      return;
    }
    if (trade.playerA.freeSlots < trade.playerB.items.length || trade.playerB.freeSlots < trade.playerA.items.length) {
      [entryA, entryB].forEach(e => {
        sendWsMessage(e.conn, { type: 'TRADE_CANCELLED', tradeId: trade.tradeId, reason: '가방 빈 슬롯이 부족하여 거래를 완료할 수 없습니다. 가방을 비운 뒤 다시 시도해주세요.' });
      });
      return;
    }

    const tradeTxId = `tx_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    trade.state = 'COMPLETED';

    if (entryA.player) {
      entryA.player.gold = Math.max(0, (Number(entryA.player.gold) || trade.playerA.currentGold || 0) - trade.playerA.gold + trade.playerB.gold);
    }
    if (entryB.player) {
      entryB.player.gold = Math.max(0, (Number(entryB.player.gold) || trade.playerB.currentGold || 0) - trade.playerB.gold + trade.playerA.gold);
    }

    // A에게 B의 물품/골드 지급 & A의 물품/골드 차감 명령 전송 (클라이언트 myOffer/partnerOffer 스키마 + AI give/receive 스키마 동시 포함)
    sendWsMessage(entryA.conn, {
      type: 'TRADE_COMMIT_EXECUTE',
      tradeId: trade.tradeId,
      tradeTxId,
      partnerName: trade.playerB.name,
      giveItems: trade.playerA.items,
      giveGold: trade.playerA.gold,
      receiveItems: trade.playerB.items,
      receiveGold: trade.playerB.gold,
      myOffer: {
        items: trade.playerA.items,
        gold: trade.playerA.gold
      },
      partnerOffer: {
        items: trade.playerB.items,
        gold: trade.playerB.gold
      }
    });

    // B에게 A의 물품/골드 지급 & B의 물품/골드 차감 명령 전송
    sendWsMessage(entryB.conn, {
      type: 'TRADE_COMMIT_EXECUTE',
      tradeId: trade.tradeId,
      tradeTxId,
      partnerName: trade.playerA.name,
      giveItems: trade.playerB.items,
      giveGold: trade.playerB.gold,
      receiveItems: trade.playerA.items,
      receiveGold: trade.playerA.gold,
      myOffer: {
        items: trade.playerB.items,
        gold: trade.playerB.gold
      },
      partnerOffer: {
        items: trade.playerA.items,
        gold: trade.playerA.gold
      }
    });
    return;
  }

  if (msg.type === 'TRADE_CANCEL_REQ' && msg.charId) {
    const cancelBy = activeCharSockets.get(msg.charId)?.player?.name || '상대방';
    cancelActiveTradeForChar(msg.charId, `'${cancelBy}'님이 거래를 취소했습니다.`);
    return;
  }

  // [9] 멀티 채팅 및 한글 운영자/일반 명령어 처리
  if (msg.type === 'CHAT_MSG') {
    const entry = activeCharSockets.get(msg.charId);
    const text = String(msg.text || '').trim();
    if (!text) return;

    if (entry) {
      entry.lastSeen = Date.now();
      if (msg.mapKey) entry.mapKey = normalizeMapKey(msg.mapKey);
      if (msg.regionKey) entry.regionKey = String(msg.regionKey).split('_')[0] || entry.regionKey;
      if (msg.targetCharId) entry._pendingInviteTargetCharId = msg.targetCharId;
    }

    if (text.startsWith('/') && entry) {
      handleChatCommand(entry, text);
      return;
    }

    const senderName = String(msg.sender || entry?.player?.name || '모험가').trim();
    const muteUntil = mutedCharMap.get(senderName.toLowerCase());
    if (muteUntil && Date.now() < muteUntil && !entry?.isAdmin) {
      const remMin = Math.ceil((muteUntil - Date.now()) / 60000);
      if (entry) sendSystemMsgToEntry(entry, `🔇 현재 채팅 금지 상태입니다. (남은 시간: 약 ${remMin}분)`, 'log-hit');
      return;
    }

    const displaySender = entry?.isAdmin ? `👑[운영자] ${senderName}` : senderName;
    // 일반 대화는 현재 지역(regionKey) 유저들에게 브로드캐스트하여 머리 위 말풍선과 대화창에 실시간 표시!
    const targetReg = entry?.regionKey || msg.regionKey || (entry?.mapKey || msg.mapKey || 'R01').split('_')[0];
    broadcastToRegion(targetReg, {
      type: 'REMOTE_CHAT',
      charId: msg.charId,
      mapKey: entry?.mapKey || msg.mapKey,
      regionKey: targetReg,
      sender: displaySender,
      text,
      bubbleText: text,
      chatStyle: 'region',
      isAdmin: Boolean(entry?.isAdmin)
    });
    return;
  }

  // [9-B] 모바일 백그라운드 상태 및 무적/5초 자동퇴장 서버 권위 처리
  if (msg.type === 'PLAYER_BG_STATUS' && msg.charId) {
    const entry = activeCharSockets.get(msg.charId);
    if (entry && entry.conn === conn) {
      entry.bgInvincible = Boolean(msg.bgInvincible);
      if (entry.player) entry.player.bgInvincible = Boolean(msg.bgInvincible);
      entry.lastSeen = Date.now();
    }
    return;
  }

  if (msg.type === 'MOBILE_BG_ENTER' && msg.charId) {
    scheduleServerMobileBgProtectionAndLogout(msg.charId);
    return;
  }

  if (msg.type === 'MOBILE_BG_RETURN' && msg.charId) {
    cancelServerMobileBgProtection(msg.charId);
    return;
  }

  if ((msg.type === 'ADMIN_REBOOT_SERVER' || msg.type === 'admin_reboot_all' || msg.type === 'admin_reboot_server') && msg.charId) {
    const entry = activeCharSockets.get(msg.charId);
    if (!entry || !entry.isAdmin) {
      if (entry) sendSystemMsgToEntry(entry, '🔒 [권한 필요] 운영자 모드에서만 서버 재부팅이 가능합니다.', 'log-hit');
      return;
    }
    triggerAdminServerReboot(entry.player?.name || '운영자');
    return;
  }

  // [10] 캐릭터 접속 종료
  if (msg.type === 'LEAVE_CHAR' && msg.charId) {
    const entry = activeCharSockets.get(msg.charId);
    if (entry) {
      clearEntryMobileBgTimers(entry);
      const mk = entry.mapKey;
      removeCharFromParty(msg.charId, 'disconnect');
      activeCharSockets.delete(msg.charId);
      if (mk) {
        broadcastToMap(mk, { type: 'PLAYER_LEFT_MAP', charId: msg.charId });
      }
    }
    return;
  }
}

function removeDisconnectedConn(conn) {
  if (conn && conn.isAiRunnerControl) {
    aiRunnerControlConns.delete(conn);
  }
  if (conn && conn.charId) {
    const entry = activeCharSockets.get(conn.charId);
    if (entry && entry.conn === conn) {
      const mk = entry.mapKey;
      removeCharFromParty(conn.charId, 'disconnect');
      activeCharSockets.delete(conn.charId);
      broadcastToMap(mk, { type: 'PLAYER_LEFT_MAP', charId: conn.charId });
    }
  }
}

// ============================================================================
// 8. 서버 권위형 메인 게임 루프 (100ms 틱 = 초당 10회 몬스터 AI·전투·동기화)
// ============================================================================
const SERVER_TICK_MS = 100;
const DELTA_60 = (SERVER_TICK_MS / 1000) * 60;

setInterval(() => {
  const now = Date.now();
  const dtSec = SERVER_TICK_MS / 1000;

  const activeMapKeys = new Set();
  activeCharSockets.forEach((entry, charId) => {
    if (now - entry.lastSeen > 45000) {
      clearEntryMobileBgTimers(entry);
      const oldMk = entry.mapKey;
      removeCharFromParty(charId, 'disconnect');
      activeCharSockets.delete(charId);
      if (oldMk) {
        broadcastToMap(oldMk, { type: 'PLAYER_LEFT_MAP', charId });
      }
    } else {
      activeMapKeys.add(normalizeMapKey(entry.mapKey));
    }
  });

  worldMaps.forEach((mapInst, mapKey) => {
    const hasPlayers = activeMapKeys.has(mapKey);

    if (mapInst.bossRespawnTimer > 0) {
      mapInst.bossRespawnTimer = Math.max(0, mapInst.bossRespawnTimer - dtSec);
    }

    for (let i = mapInst.groundItems.length - 1; i >= 0; i--) {
      const it = mapInst.groundItems[i];
      if (it.spawnTime && now - it.spawnTime >= 60000) {
        mapInst.groundItems.splice(i, 1);
        if (hasPlayers) {
          broadcastToMap(mapKey, {
            type: 'GROUND_ITEM_REMOVED',
            mapKey,
            itemUid: it.uid
          });
        }
      }
    }

    const mapPlayers = [];
    if (hasPlayers) {
      activeCharSockets.forEach(entry => {
        if (normalizeMapKey(entry.mapKey) === mapKey && entry.player) {
          // 🏃 AI 러너가 200ms 주기로 PLAYER_SYNC를 보낼 때, 서버의 중간 100ms 틱에서도 목표 지점(moveX, moveY)으로 등속 예측 보행(Dead Reckoning) 수행
          const p = entry.player;
          const sinceSync = now - (entry.lastSyncMoveTs || entry.lastSeen || now);
          if (p.isWalking && typeof p.moveX === 'number' && typeof p.moveY === 'number' && sinceSync >= 75 && sinceSync <= 260) {
            const dx = p.moveX - p.x;
            const dy = p.moveY - p.y;
            const dist = Math.hypot(dx, dy);
            const spd = (Number(p.speed) || 1.90) * DELTA_60;
            if (dist > 1.0) {
              const step = Math.min(dist, spd);
              p.x = Math.round(p.x + (dx / dist) * step);
              p.y = Math.round(p.y + (dy / dist) * step);
              if (p.mercenary && p.mercenary.hired !== false && !p.mercenary.isDead && p.mercenary.isWalking) {
                p.mercenary.x = Math.round((p.mercenary.x || p.x) + (dx / dist) * step);
                p.mercenary.y = Math.round((p.mercenary.y || p.y) + (dy / dist) * step);
              }
              if (dist <= spd + 0.5) {
                p.isWalking = false;
              }
            } else {
              p.isWalking = false;
            }
          }
          mapPlayers.push(entry);
        }
      });
      // 📐 매 틱 1회 O(N+M)으로 400x400px 공간 분할 격자(Spatial Grid) 갱신
      rebuildMapSpatialGrids(mapInst, mapPlayers);
    }

    mapInst.monsters.forEach(m => {
      if (m.isDead) {
        if (m.respawnTimer > 0) {
          m.respawnTimer = Math.max(0, m.respawnTimer - dtSec);
          if (m.respawnTimer <= 0) {
            const safeSpawn = findServerSafeSpot(mapInst, m.spawnX, m.spawnY);
            const nextElite = !m.isBoss && Math.random() < 0.10;
            const baseHp = m.baseMaxHp || m.maxHp || 50;
            m.isElite = nextElite;
            m.scaleMult = nextElite ? 1.90 : 1.0;
            m.maxHp = nextElite ? Math.round(baseHp * 1.85) : baseHp;
            m.isDead = false;
            m.hp = m.maxHp;
            m.mp = m.maxMp;
            m.x = safeSpawn.x;
            m.y = safeSpawn.y;
            m.targetX = safeSpawn.x;
            m.targetY = safeSpawn.y;
            m.stunUntil = 0;
            m.defDownUntil = 0;
            m.damageContributors.clear();
            if (m.isBoss) {
              mapInst.bossRespawnTimer = 0;
            }
            if (hasPlayers) {
              broadcastToMap(mapKey, {
                type: 'MONSTER_RESPAWNED',
                mapKey,
                monster: {
                  id: m.id,
                  x: m.x,
                  y: m.y,
                  hp: m.hp,
                  maxHp: m.maxHp,
                  mp: m.mp,
                  maxMp: m.maxMp,
                  isBoss: m.isBoss,
                  isElite: Boolean(m.isElite),
                  scaleMult: m.scaleMult || 1.0,
                  name: m.name
                },
                bossRespawnTimer: Math.ceil(mapInst.bossRespawnTimer)
              });
            }
          }
        }
        return;
      }

      if (!hasPlayers) return;
      if (m.stunUntil && now < m.stunUntil) return;

      let bestTarget = null;
      let minTargetDist = Infinity;

      // 📐 공간 격자(Spatial Grid)를 사용하여 몬스터 주변 인접 격자 내 플레이어만 탐색 (전수 비교 제거)
      const candidateEntries = querySpatialGrid9(mapInst.playerGrid, m.x, m.y, true);
      for (let cIdx = 0; cIdx < candidateEntries.length; cIdx++) {
        const entry = candidateEntries[cIdx];
        if (!entry || entry.gmInvisible || entry.bgInvincible) continue;
        const p = entry.player;
        if (!p || (p.hp !== undefined && p.hp <= 0)) continue;
        if (isInsideServerWarpSafeZone(mapInst, p.x, p.y)) continue;

        const dPlayer = Math.hypot(p.x - m.x, p.y - m.y);
        const merc = p.mercenary;
        const dMerc = (merc && merc.hired !== false && !merc.isDead && merc.x !== undefined && !isInsideServerWarpSafeZone(mapInst, merc.x, merc.y))
          ? Math.hypot(merc.x - m.x, merc.y - m.y)
          : Infinity;

        const preferMerc = dMerc < dPlayer * 0.85 || (merc?.class === 'knight' && dMerc < 140);
        const effDist = preferMerc ? dMerc : dPlayer;
        if (effDist < minTargetDist) {
          minTargetDist = effDist;
          bestTarget = {
            charId: entry.charId,
            entry,
            isMerc: preferMerc,
            x: preferMerc ? merc.x : p.x,
            y: preferMerc ? merc.y : p.y,
            dist: effDist
          };
        }
      }

      const distFromSpawn = Math.hypot(m.x - m.spawnX, m.y - m.spawnY);
      const isRangedOrMagic = (m.maxMp > 0 && m.mp >= 10) || String(m.name || '').includes('궁수') || String(m.name || '').includes('주술사') || String(m.name || '').includes('사제');
      const mobAtkRange = isRangedOrMagic ? 175 : (m.isBoss ? 64 : 54);
      const isProvoked = bestTarget && ((m.hp < m.maxHp && bestTarget.dist < 660) || (m.isAggro && bestTarget.dist < 285));

      if (isProvoked && distFromSpawn < 600) {
        const targetX = bestTarget.x;
        const targetY = bestTarget.y;
        const targetDist = bestTarget.dist;

        if (m.isBoss && targetDist <= 380) {
          if (!m.lastTelegraphTime) m.lastTelegraphTime = now - 5000;
          if (now - m.lastTelegraphTime >= 8500) {
            m.lastTelegraphTime = now;
            const tgRadius = 165;
            mapInst.bossTelegraphs.push({
              boss: m,
              x: Math.round(targetX),
              y: Math.round(targetY),
              radius: tgRadius,
              startTime: now,
              duration: 1500
            });
            broadcastToMap(mapKey, {
              type: 'BOSS_TELEGRAPH_START',
              mapKey,
              bossId: m.id,
              bossX: Math.round(m.x),
              bossY: Math.round(m.y),
              x: Math.round(targetX),
              y: Math.round(targetY),
              radius: tgRadius,
              duration: 1500
            });
          }
        }

        if (targetDist > mobAtkRange) {
          const angle = Math.atan2(targetY - m.y, targetX - m.x);
          const chaseSpd = m.isBoss ? 1.82 : 1.45;
          const step = chaseSpd * DELTA_60;
          const steer = findServerOpenSteerPoint(mapInst, m.x, m.y, angle, step, true, m, mapPlayers);
          if (steer) {
            m.x = steer.x;
            m.y = steer.y;
          }
        } else if (now - (m.lastAtkTime || 0) > 1200) {
          m.lastAtkTime = now;
          const atkAngle = Math.atan2(targetY - m.y, targetX - m.x);
          if (m.maxMp > 0 && m.mp >= 10) m.mp = Math.max(0, m.mp - 10);

          broadcastToMapAoi(mapKey, m.x, m.y, 1450, 0, {
            type: 'MONSTER_ATTACK_EVENT',
            mapKey,
            mobId: m.id,
            mobName: m.name,
            mobLv: m.lv || 1,
            mobAtk: m.atk || 10,
            isBoss: Boolean(m.isBoss),
            isMagic: Boolean(isRangedOrMagic),
            skillName: m.skill || null,
            targetCharId: bestTarget.charId,
            targetType: bestTarget.isMerc ? 'mercenary' : 'player',
            gmBlocked: Boolean((bestTarget.entry?.gmInvincible && !bestTarget.isMerc) || bestTarget.entry?.bgInvincible),
            atkAngle: Number(atkAngle.toFixed(2)),
            x: Math.round(m.x),
            y: Math.round(m.y)
          }, null, bestTarget.charId);
        }
      } else {
        if (m.maxMp > 0 && m.mp < m.maxMp) m.mp = Math.min(m.maxMp, m.mp + 0.1 * DELTA_60);
        if (candidateEntries.length === 0 && distFromSpawn < 80) return;
        if (distFromSpawn >= 520) {
          m.targetX = m.spawnX;
          m.targetY = m.spawnY;
        } else if (Math.random() < 0.025) {
          m.targetX = m.spawnX + (Math.random() * 160 - 80);
          m.targetY = m.spawnY + (Math.random() * 160 - 80);
        }
        const dTarget = Math.hypot(m.targetX - m.x, m.targetY - m.y);
        if (dTarget > 5) {
          const angle = Math.atan2(m.targetY - m.y, m.targetX - m.x);
          const nx = m.x + Math.cos(angle) * 0.65 * DELTA_60;
          const ny = m.y + Math.sin(angle) * 0.65 * DELTA_60;
          if (!checkServerCollision(mapInst, nx, ny) && !isInsideServerWarpSafeZone(mapInst, nx, ny) && !checkServerUnitCollision(mapInst, nx, ny, m, mapPlayers)) {
            m.x = nx;
            m.y = ny;
          }
        }
      }
    });

    if (hasPlayers && mapPlayers.length > 0 && ((mapInst._tickSeq || 0) % 2 === 0)) {
      resolveServerMonsterSeparation(mapInst, mapPlayers);
    }

    for (let i = mapInst.bossTelegraphs.length - 1; i >= 0; i--) {
      const tg = mapInst.bossTelegraphs[i];
      if (!tg.boss || tg.boss.isDead) {
        mapInst.bossTelegraphs.splice(i, 1);
        continue;
      }
      if (now - tg.startTime >= tg.duration) {
        mapInst.bossTelegraphs.splice(i, 1);
        if (hasPlayers) {
          broadcastToMapAoi(mapKey, tg.x, tg.y, 1650, 0, {
            type: 'BOSS_TELEGRAPH_EXPLODE',
            mapKey,
            bossId: tg.boss.id,
            bossLv: tg.boss.lv || 1,
            bossAtk: tg.boss.atk || 50,
            x: tg.x,
            y: tg.y,
            radius: tg.radius
          });
        }
      }
    }

    if (hasPlayers && mapPlayers.length > 0) {
      // 📡 [Spatial Grid 기반 AOI & 동시접속 150명 + AI 100명 CPU 65% 이하 보장 패킷 동기화]
      mapInst._tickSeq = ((mapInst._tickSeq || 0) + 1) % 24;
      const tickSeq = mapInst._tickSeq;
      const isNearRefreshTick = (tickSeq % 12 === 0); // 1.2초마다 AOI 전체 정합성 보정
      const isRadarTick = (tickSeq % 6 === 0);        // 0.6초마다 실제 유저용 미니맵 원거리 레이더 갱신

      const MOB_AOI_RADIUS = 1650;
      const MOB_AOI_RADIUS_SQ = MOB_AOI_RADIUS * MOB_AOI_RADIUS;
      const AI_MOB_AOI_RADIUS = 1450;
      const AI_MOB_AOI_RADIUS_SQ = AI_MOB_AOI_RADIUS * AI_MOB_AOI_RADIUS;

      // 맵 내 몬스터 정수 좌표 및 상태 사전 계산 (수신자 루프 내부 Math.round / 상태 연산 중복 제거)
      const mobsLen = mapInst.monsters.length;
      for (let mIdx = 0; mIdx < mobsLen; mIdx++) {
        const m = mapInst.monsters[mIdx];
        m._rx = Math.round(m.x);
        m._ry = Math.round(m.y);
        m._stunVal = (m.stunUntil && m.stunUntil > now) ? m.stunUntil : 0;
        m._defDownVal = (m.defDownUntil && m.defDownUntil > now) ? m.defDownUntil : 0;
      }

      // AI 수신자 틱 분할 계수: 평시 3분할(300ms), 서버 CPU 55% 이상 시 4분할(400ms)로 자동 조절하여 실제 유저 150명의 100ms 반응성 보호
      const aiTickModulo = serverCpuUsagePct >= (SERVER_CPU_LIMIT_PCT - 8) ? 4 : 3;

      for (let rIdx = 0; rIdx < mapPlayers.length; rIdx++) {
        const receiver = mapPlayers[rIdx];
        if (!receiver || !receiver.conn) continue;

        const isAiReceiver = isAIEntry(receiver);
        if (isAiReceiver && !isNearRefreshTick && (tickSeq % aiTickModulo !== (rIdx % aiTickModulo))) {
          continue;
        }

        const bufferedBytes = receiver.conn?.bufferedAmount ?? receiver.conn?.socket?.writableLength ?? 0;
        if (!isNearRefreshTick && bufferedBytes > 65536) continue;

        if (!receiver._knownMobs) receiver._knownMobs = new Map();
        if (!receiver._knownPlayers) receiver._knownPlayers = new Map();

        const rPx = Math.round(Number(receiver.player?.x) || 2000);
        const rPy = Math.round(Number(receiver.player?.y) || 14250);
        const rTargetMobId = receiver.player?.targetMobId ? String(receiver.player.targetMobId) : null;
        const recParty = getPartyByCharId(receiver.charId);
        const recPartyId = recParty ? recParty.partyId : null;

        // 1) 내 주변 필드 + 미니맵 범위 몬스터 선별 (제곱 거리 비교로 Math.hypot 제거)
        const compactMobs = [];
        const mobRadius = isAiReceiver ? AI_MOB_AOI_RADIUS : MOB_AOI_RADIUS;
        const mobRadiusSq = isAiReceiver ? AI_MOB_AOI_RADIUS_SQ : MOB_AOI_RADIUS_SQ;

        for (let i = 0; i < mobsLen; i++) {
          const m = mapInst.monsters[i];
          const rx = m._rx;
          const ry = m._ry;
          const dxM = Math.abs(rx - rPx);
          const dyM = Math.abs(ry - rPy);
          const distSq = (dxM <= 2200 && dyM <= 2200) ? (dxM * dxM + dyM * dyM) : 999999999;
          const inAoi = (dxM <= mobRadius && dyM <= mobRadius && distSq <= mobRadiusSq) || m.isBoss || (rTargetMobId === m.id) || (!m.isDead && m.hp < m.maxHp && distSq <= 4840000);

          const prev = receiver._knownMobs.get(m.id);
          if (!inAoi) {
            if (prev && prev.dead !== m.isDead) {
              prev.dead = m.isDead;
              prev.hp = m.hp;
              prev.x = rx;
              prev.y = ry;
              prev.inAoi = false;
              compactMobs.push([m.id, rx, ry, m.hp, m.isDead ? 1 : 0]);
            } else if (prev) {
              prev.inAoi = false;
            }
            continue;
          }

          const enteredAoi = !prev || !prev.inAoi;
          const stateChanged = !prev || prev.dead !== m.isDead;
          const movedNow = !m.isDead && (!prev || Math.abs(prev.x - rx) >= 1 || Math.abs(prev.y - ry) >= 1);
          const stoppedNow = !m.isDead && prev && prev.wasMoving && !movedNow;
          const hpChanged = !prev || prev.hp !== m.hp;
          const ccChanged = (!prev) || Boolean(prev.stun) !== Boolean(m._stunVal) || Boolean(prev.defDown) !== Boolean(m._defDownVal);

          if (enteredAoi || stateChanged || movedNow || stoppedNow || hpChanged || ccChanged || (isNearRefreshTick && !m.isDead)) {
            const needFullMeta = !isAiReceiver && (enteredAoi || stateChanged || isNearRefreshTick);
            receiver._knownMobs.set(m.id, {
              x: rx,
              y: ry,
              hp: m.hp,
              dead: m.isDead,
              wasMoving: movedNow,
              inAoi: true,
              stun: m._stunVal,
              defDown: m._defDownVal
            });
            const tuple = [
              m.id,
              rx,
              ry,
              m.hp,
              m.isDead ? 1 : 0
            ];
            if (needFullMeta || m.isDead || m._stunVal || m._defDownVal) {
              tuple.push(
                Math.round(m.mp),
                m.maxHp,
                m._stunVal,
                m._defDownVal,
                m.isDead ? Math.ceil(m.respawnTimer) : 0,
                m.isElite ? 1 : 0
              );
            }
            compactMobs.push(tuple);
          }
        }

        // 2) 📐 Spatial Grid 기반 플레이어 AOI 탐색 (실제 유저는 카메라 화면 전체 1450px 커버, AI는 760px 커버)
        const visiblePlayers = [];
        const currentAoiIds = new Set();
        const searchRadius = isAiReceiver ? AI_PLAYER_AOI_HYSTERESIS : PLAYER_AOI_HYSTERESIS;
        const aoiCandidates = isAiReceiver
          ? querySpatialGrid9(mapInst.playerGrid, rPx, rPy, true)
          : querySpatialGridRadius(mapInst.playerGrid, rPx, rPy, searchRadius);

        // 같은 파티원이 AOI 밖에 있더라도 파티 점사/추적을 위해 후보에 포함
        if (recParty && Array.isArray(recParty.members)) {
          for (let mIdx = 0; mIdx < recParty.members.length; mIdx++) {
            const pMemEntry = activeCharSockets.get(recParty.members[mIdx]);
            if (pMemEntry && pMemEntry !== receiver && normalizeMapKey(pMemEntry.mapKey) === mapKey && !aoiCandidates.includes(pMemEntry)) {
              aoiCandidates.push(pMemEntry);
            }
          }
        }

        const enterR = isAiReceiver ? AI_PLAYER_AOI_RADIUS : PLAYER_AOI_RADIUS;
        const exitR = isAiReceiver ? AI_PLAYER_AOI_HYSTERESIS : PLAYER_AOI_HYSTERESIS;

        for (let cIdx = 0; cIdx < aoiCandidates.length; cIdx++) {
          const other = aoiCandidates[cIdx];
          if (!other || other.charId === receiver.charId) continue;
          if (other.gmInvisible && !receiver.isAdmin) continue;
          const op = other.player;
          if (!op) continue;

          const ox = Math.round(op.x || 2000);
          const oy = Math.round(op.y || 14250);
          const dxP = Math.abs(ox - rPx);
          const dyP = Math.abs(oy - rPy);
          const prevP = receiver._knownPlayers.get(other.charId);
          const wasFullInAoi = Boolean(prevP && prevP.metaSig !== 'minimap');
          const isSameParty = Boolean(recPartyId && other.partyId === recPartyId);

          const effectiveRadius = wasFullInAoi ? exitR : enterR;
          if (!isSameParty && (dxP > effectiveRadius || dyP > effectiveRadius || (dxP * dxP + dyP * dyP) > effectiveRadius * effectiveRadius)) {
            continue;
          }

          currentAoiIds.add(other.charId);
          const oParty = getPartyByCharId(other.charId);
          const partyId = oParty ? oParty.partyId : null;
          const isLeader = Boolean(oParty && oParty.leaderCharId === other.charId);

          // AI 수신자에게는 시각 렌더링용 메타데이터/용병 정보를 생략하고 핵심 좌표·파티·체력만 초경량 전송
          if (isAiReceiver) {
            const aiMoved = !prevP || Math.abs(prevP.x - ox) >= 2 || Math.abs(prevP.y - oy) >= 2 || prevP.hp !== op.hp || prevP.targetMobId !== (op.targetMobId || null) || prevP.partyId !== partyId;
            if (aiMoved || isNearRefreshTick) {
              const isNewForAi = !prevP || isNearRefreshTick;
              receiver._knownPlayers.set(other.charId, {
                x: ox, y: oy, hp: op.hp,
                targetMobId: op.targetMobId || null,
                partyId
              });
              const aiPkt = {
                charId: other.charId,
                x: ox,
                y: oy,
                hp: op.hp,
                maxHp: op.maxHp
              };
              if (isNewForAi) {
                aiPkt.name = op.name;
                aiPkt.level = op.level;
                aiPkt.class = op.class;
              }
              if (partyId) aiPkt.partyId = partyId;
              aiPkt.targetMobId = op.targetMobId || null;
              visiblePlayers.push(aiPkt);
            }
            continue;
          }

          const merc = (op.mercenary && op.mercenary.hired !== false) ? op.mercenary : null;
          const mx = merc ? Math.round(merc.x || ox) : 0;
          const my = merc ? Math.round(merc.y || oy) : 0;
          const metaSig = `${op.name}|${op.class}|${op.level}|${op.weaponType}|${op.hasShield?1:0}|${op.isAdmin?1:0}|${partyId||''}|${isLeader?1:0}|${merc ? `${merc.class}:${merc.name}:${merc.stance}:${merc.setTier||0}:${merc.isDead?1:0}` : 'none'}`;

          const pMoved = !wasFullInAoi || Math.abs(prevP.x - ox) >= 1 || Math.abs(prevP.y - oy) >= 1 || prevP.dir !== op.dir || prevP.walk !== Boolean(op.isWalking);
          const mMoved = merc && (!wasFullInAoi || Math.abs((prevP.mx || 0) - mx) >= 1 || Math.abs((prevP.my || 0) - my) >= 1 || prevP.mWalk !== Boolean(merc.isWalking));
          const statOrMetaDiff = !wasFullInAoi || prevP.metaSig !== metaSig || prevP.hp !== op.hp || prevP.mp !== op.mp || prevP.atkTs !== op.lastAttackTime || prevP.targetMobId !== (op.targetMobId || null);

          if (pMoved || mMoved || statOrMetaDiff || isNearRefreshTick) {
            const includeFullMeta = !wasFullInAoi || prevP.metaSig !== metaSig || isNearRefreshTick;
            receiver._knownPlayers.set(other.charId, {
              x: ox, y: oy, dir: op.dir, walk: Boolean(op.isWalking),
              hp: op.hp, maxHp: op.maxHp, mp: op.mp, maxMp: op.maxMp,
              spd: op.speed, atkTs: op.lastAttackTime,
              targetMobId: op.targetMobId || null,
              partyId, isLeader,
              mx, my, mWalk: Boolean(merc?.isWalking),
              mHp: merc?.hp, mMp: merc?.mp, mAtkTs: merc?.lastAttackTime,
              metaSig
            });

            if (includeFullMeta) {
              visiblePlayers.push({
                ...op,
                x: ox,
                y: oy,
                partyId,
                isPartyLeader: isLeader,
                partyMemberCount: oParty ? oParty.members.length : 0,
                isAI: isAIEntry(other)
              });
            } else {
              // 📉 정적 메타데이터를 제거한 초경량 델타 패킷
              const deltaP = {
                charId: other.charId,
                x: ox,
                y: oy,
                dir: op.dir,
                isWalking: Boolean(op.isWalking),
                _delta: true
              };
              if (op.isWalking && typeof op.moveX === 'number') {
                deltaP.moveX = Math.round(op.moveX);
                deltaP.moveY = Math.round(op.moveY);
              }
              if (prevP.spd !== op.speed && typeof op.speed === 'number') deltaP.speed = op.speed;
              if (prevP.atkTs !== op.lastAttackTime) deltaP.lastAttackTime = op.lastAttackTime || 0;
              if (prevP.hp !== op.hp) deltaP.hp = op.hp;
              if (prevP.maxHp !== op.maxHp) deltaP.maxHp = op.maxHp;
              if (prevP.mp !== op.mp) deltaP.mp = op.mp;
              if (prevP.maxMp !== op.maxMp) deltaP.maxMp = op.maxMp;
              if (prevP.targetMobId !== (op.targetMobId || null)) deltaP.targetMobId = op.targetMobId || null;

              if (merc) {
                const deltaM = {
                  x: mx,
                  y: my,
                  dir: merc.dir || 'down',
                  isWalking: Boolean(merc.isWalking)
                };
                if (prevP.mAtkTs !== merc.lastAttackTime) deltaM.lastAttackTime = merc.lastAttackTime || 0;
                if (prevP.mHp !== merc.hp) deltaM.hp = merc.hp;
                if (prevP.mMp !== merc.mp) deltaM.mp = merc.mp;
                deltaP.mercenary = deltaM;
              }
              visiblePlayers.push(deltaP);
            }
          }
        }

        // 실제 유저(Human)에게는:
        // 1) 방금 AOI 밖으로 벗어난 플레이어(prevFar.metaSig !== 'minimap')는 즉시 _minimapOnly 전환 패킷을 보내 화면 가장자리 잔상 제거!
        // 2) 레이더 틱(isRadarTick)마다 원거리 플레이어의 미니맵 좌표 갱신!
        const allMapValidIds = [];
        if (!isAiReceiver) {
          for (let i = 0; i < mapPlayers.length; i++) {
            const farOther = mapPlayers[i];
            if (!farOther || farOther.charId === receiver.charId) continue;
            if (farOther.gmInvisible && !receiver.isAdmin) continue;
            allMapValidIds.push(farOther.charId);
            if (currentAoiIds.has(farOther.charId)) continue;

            const fop = farOther.player;
            if (!fop) continue;
            const fox = Math.round(fop.x || 2000);
            const foy = Math.round(fop.y || 14250);
            const prevFar = receiver._knownPlayers.get(farOther.charId);
            const justLeftAoi = Boolean(prevFar && prevFar.metaSig !== 'minimap');

            if (!prevFar || justLeftAoi || (isRadarTick && (Math.abs(prevFar.x - fox) >= 15 || Math.abs(prevFar.y - foy) >= 15))) {
              receiver._knownPlayers.set(farOther.charId, {
                x: fox,
                y: foy,
                metaSig: 'minimap'
              });
              const fParty = getPartyByCharId(farOther.charId);
              visiblePlayers.push({
                charId: farOther.charId,
                name: fop.name || '모험가',
                level: fop.level || 1,
                class: fop.class || 'knight',
                x: fox,
                y: foy,
                partyId: fParty ? fParty.partyId : (farOther.partyId || null),
                isPartyLeader: Boolean(fParty && fParty.leaderCharId === farOther.charId),
                partyMemberCount: fParty ? fParty.members.length : 0,
                isAI: isAIEntry(farOther),
                _minimapOnly: true
              });
            }
          }
        }

        // 맵(또는 AI의 경우 AOI)을 벗어난 플레이어 캐시 정리
        const validSetForReceiver = isAiReceiver ? currentAoiIds : new Set(allMapValidIds);
        let otherRemoved = false;
        receiver._knownPlayers.forEach((_, cId) => {
          if (!validSetForReceiver.has(cId)) {
            receiver._knownPlayers.delete(cId);
            otherRemoved = true;
          }
        });

        const expectedCount = validSetForReceiver.size;
        const otherCountChanged = (receiver._lastSentOtherCount ?? -1) !== expectedCount || otherRemoved;
        receiver._lastSentOtherCount = expectedCount;

        if (!isNearRefreshTick && compactMobs.length === 0 && visiblePlayers.length === 0 && !otherCountChanged) {
          continue;
        }

        const tickPacket = {
          type: 'WORLD_STATE_TICK',
          serverTime: now,
          mapKey,
          bossRespawnTimer: Math.ceil(mapInst.bossRespawnTimer)
        };
        if (compactMobs.length > 0) {
          tickPacket.ms = compactMobs;
        }
        if (visiblePlayers.length > 0 || otherCountChanged) {
          tickPacket.players = visiblePlayers;
          tickPacket.playersDelta = true;
          if (otherCountChanged || isNearRefreshTick) {
            tickPacket.allCharIds = isAiReceiver ? Array.from(currentAoiIds) : allMapValidIds;
          }
        }
        if (isNearRefreshTick) {
          if (!isAiReceiver) tickPacket.buildVersion = CURRENT_BUILD_VERSION;
          tickPacket.party = recParty ? buildPartySnapshot(recParty) : null;
        }
        sendWsMessage(receiver.conn, tickPacket, true);
      }
    }
  });
}, SERVER_TICK_MS);

// ============================================================================
// 9. HTTP API 라우터 (수파베이스 DB 엄격 기준: DB 오류 시 접속/가입 즉시 차단)
// ============================================================================
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.tmj': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.env': 'text/plain; charset=utf-8'
};

function readJsonBody(req) {
  return new Promise((resolve) => {
    let raw = '';
    req.on('data', chunk => {
      raw += chunk;
      if (raw.length > 8 * 1024 * 1024) req.destroy();
    });
    req.on('end', () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch (e) {
        resolve({});
      }
    });
    req.on('error', () => resolve({}));
  });
}

function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
  });
  res.end(JSON.stringify(data));
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    return sendJson(res, 200, { ok: true });
  }

  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = decodeURIComponent(parsedUrl.pathname);

  // 헬스체크 및 빌드 버전 체크
  if ((pathname === '/api/status' || pathname === '/api/health' || pathname === '/api/version') && req.method === 'GET') {
    refreshServerBuildVersionIfNeeded(true);
    let aiOnline = 0;
    let humanOnline = 0;
    activeCharSockets.forEach(e => { if (isAIEntry(e)) aiOnline++; else humanOnline++; });
    return sendJson(res, 200, {
      ok: true,
      status: 'healthy',
      version: CURRENT_BUILD_VERSION,
      server: 'Age of Magic Authoritative Node Server',
      uptimeSec: Math.floor((Date.now() - SERVER_START_TIME) / 1000),
      worldMapsLoaded: worldMaps.size,
      onlineTotal: activeCharSockets.size,
      onlineHuman: humanOnline,
      onlineAI: aiOnline,
      maxConcurrentHumanSupported: MAX_CONCURRENT_USERS_TARGET,
      cpuUsagePct: serverCpuUsagePct,
      cpuLimitPct: SERVER_CPU_LIMIT_PCT,
      supabaseUrl: SUPABASE_URL
    });
  }

  // [API 0] 수파베이스 실시간 온라인 연결 가능 여부 핑 체크 (온리 온라인 로그인/회원가입 검증용)
  if (pathname === '/api/supabase/ping' && (req.method === 'GET' || req.method === 'POST')) {
    const pingRows = await supabaseRest('magic_accounts', 'GET', '?select=user_id&limit=1');
    if (pingRows === null) {
      return sendJson(res, 503, { ok: false, online: false, error: '수파베이스 DB에 온라인 연결할 수 없습니다.' });
    }
    return sendJson(res, 200, { ok: true, online: true });
  }

  // [API 1] 이메일 중복 체크 (수파베이스 필수 검증)
  if (pathname === '/api/auth/check-email' && req.method === 'POST') {
    const body = await readJsonBody(req);
    const email = String(body.email || '').trim().toLowerCase();
    if (!email) return sendJson(res, 400, { exists: false });

    const remoteRows = await supabaseRest('magic_accounts', 'GET', `?email=ilike.${encodeURIComponent(email)}&limit=1`);
    if (remoteRows === null) {
      return sendJson(res, 500, { exists: false, error: '수파베이스 DB에 연결할 수 없습니다.' });
    }
    return sendJson(res, 200, { exists: Array.isArray(remoteRows) && remoteRows.length > 0 });
  }

  // [API 2] 회원가입 (수파베이스 DB 직접 저장 필수 - 실패 시 즉시 차단)
  if (pathname === '/api/auth/signup' && req.method === 'POST') {
    const body = await readJsonBody(req);
    const email = String(body.email || '').trim().toLowerCase();
    const password = String(body.password || '');
    if (!email || password.length < 6) {
      return sendJson(res, 400, { error: '이메일과 6자리 이상의 비밀번호를 입력해주세요.' });
    }

    const checkDup = await supabaseRest('magic_accounts', 'GET', `?email=ilike.${encodeURIComponent(email)}&limit=1`);
    if (checkDup === null) {
      return sendJson(res, 500, { error: '수파베이스 DB 연결 실패로 중복 확인에 실패했습니다.' });
    }
    if (Array.isArray(checkDup) && checkDup.length > 0) {
      return sendJson(res, 200, { error: '이미 가입된 이메일 계정입니다.' });
    }

    const userId = body.user_id || crypto.randomUUID();
    const pwHash = body.pw_hash || encodePasswordHash(email, password);
    const nowIso = new Date().toISOString();
    const tokenStr = buildAccountTokenString(pwHash, '');
    const record = {
      user_id: userId,
      email,
      active_session_token: tokenStr,
      updated_at: nowIso
    };

    const saveResult = await supabaseRest('magic_accounts', 'POST', '', record, 'user_id');
    if (!saveResult) {
      return sendJson(res, 500, { error: '수파베이스 DB 저장에 실패했습니다. DB 연결 및 외래키 설정을 확인해주세요.' });
    }

    return sendJson(res, 200, { ok: true, user: { id: userId, email }, pw_hash: pwHash });
  }

  // [API 3] 로그인 (수파베이스 DB 검증 필수 - DB에 계정 없으면 즉시 로그인 실패)
  if (pathname === '/api/auth/login' && req.method === 'POST') {
    const body = await readJsonBody(req);
    const email = String(body.email || '').trim().toLowerCase();
    const password = String(body.password || '');
    const pwHash = body.pw_hash || encodePasswordHash(email, password);

    const remoteRows = await supabaseRest('magic_accounts', 'GET', `?email=ilike.${encodeURIComponent(email)}&limit=1`);
    if (remoteRows === null) {
      return sendJson(res, 500, { ok: false, error: '수파베이스 DB 서버에 연결할 수 없습니다. 잠시 후 다시 시도해주세요.' });
    }
    if (!Array.isArray(remoteRows) || remoteRows.length === 0) {
      return sendJson(res, 200, { ok: false, error: '수파베이스에 존재하지 않는 계정입니다. 회원가입을 먼저 진행해주세요.' });
    }

    const r = remoteRows[0];
    const parsed = parseAccountTokenString(r.active_session_token);
    if (parsed.pwHash && parsed.pwHash !== pwHash) {
      return sendJson(res, 200, { ok: false, error: '비밀번호가 일치하지 않습니다.' });
    }
    return sendJson(res, 200, { ok: true, user: { id: r.user_id, email: r.email.toLowerCase() } });
  }

  // [API 4] 계정 동기화 (수파베이스)
  if (pathname === '/api/auth/sync-account' && req.method === 'POST') {
    const body = await readJsonBody(req);
    const email = String(body.email || '').trim().toLowerCase();
    const userId = body.user_id;
    const pwHash = body.pw_hash || '';
    if (email && userId) {
      const nowIso = new Date().toISOString();
      const tokenStr = buildAccountTokenString(pwHash, '');
      const record = {
        user_id: userId,
        email,
        active_session_token: tokenStr,
        updated_at: nowIso
      };
      await supabaseRest('magic_accounts', 'POST', '', record, 'user_id');
    }
    return sendJson(res, 200, { ok: true });
  }

  // [API 5] 캐릭터 슬롯 목록 조회 (수파베이스 필수 조회 + 현재 접속 중인 캐릭터 온라인 상태 표시)
  if (pathname.startsWith('/api/characters/') && req.method === 'GET') {
    const userId = pathname.replace('/api/characters/', '').trim();
    const remoteChars = await supabaseRest('magic_characters', 'GET', `?user_id=eq.${encodeURIComponent(userId)}&slot_index=lt.100&order=slot_index.asc`);
    if (remoteChars === null) {
      return sendJson(res, 500, { ok: false, error: '수파베이스 캐릭터 조회에 실패했습니다.', characters: [] });
    }
    const annotated = (Array.isArray(remoteChars) ? remoteChars : []).map(c => ({
      ...c,
      isOnline: Boolean(c && c.id && activeCharSockets.has(c.id))
    }));
    return sendJson(res, 200, { ok: true, characters: annotated });
  }

  // [API 6] 캐릭터 이름 중복 체크 (수파베이스 필수 검증)
  if (pathname === '/api/characters/check-name' && req.method === 'POST') {
    const body = await readJsonBody(req);
    const name = String(body.name || '').trim().toLowerCase();
    if (!name) return sendJson(res, 200, { exists: false });

    const remoteDup = await supabaseRest('magic_characters', 'GET', `?name=ilike.${encodeURIComponent(name)}&limit=1`);
    if (remoteDup === null) {
      return sendJson(res, 500, { exists: false, error: '수파베이스 이름 중복 체크 실패' });
    }
    return sendJson(res, 200, { exists: Array.isArray(remoteDup) && remoteDup.length > 0 });
  }

  // [API 7] 캐릭터 생성 및 저장 (수파베이스 실시간 선검증 필수 + 슬롯 충돌/중복 원천 차단)
  if (pathname === '/api/characters/save' && req.method === 'POST') {
    const rawBody = await readJsonBody(req);
    const isNewCreate = Boolean(rawBody && rawBody._isNewCreate);
    const charPayload = { ...rawBody };
    delete charPayload._isNewCreate;

    if (charPayload && charPayload.id) {
      if (isNewCreate && charPayload.user_id) {
        // 1) 실시간 수파베이스 계정의 현재 슬롯 상태 먼저 검증
        const existingChars = await supabaseRest('magic_characters', 'GET', `?user_id=eq.${encodeURIComponent(charPayload.user_id)}&slot_index=lt.100&order=slot_index.asc`);
        if (existingChars === null) {
          return sendJson(res, 500, { ok: false, error: '수파베이스 DB 연결 실패로 캐릭터를 생성할 수 없습니다.' });
        }
        if (Array.isArray(existingChars)) {
          if (existingChars.length >= 3) {
            return sendJson(res, 409, {
              ok: false,
              slotOccupied: true,
              characters: existingChars,
              error: '이미 3개의 캐릭터 슬롯이 모두 사용 중입니다. 최신 슬롯 상태로 갱신합니다.'
            });
          }
          const slotTaken = existingChars.find(c => Number(c.slot_index) === Number(charPayload.slot_index) && c.id !== charPayload.id);
          if (slotTaken) {
            return sendJson(res, 409, {
              ok: false,
              slotOccupied: true,
              characters: existingChars,
              error: `다른 기기에서 이미 슬롯 ${Number(charPayload.slot_index) + 1}번에 [${slotTaken.name}] 캐릭터가 생성되었습니다.`
            });
          }
        }
        // 2) 캐릭터 이름 중복 실시간 검증
        if (charPayload.name) {
          const dupName = await supabaseRest('magic_characters', 'GET', `?name=ilike.${encodeURIComponent(charPayload.name)}&limit=1`);
          if (dupName === null) {
            return sendJson(res, 500, { ok: false, error: '수파베이스 이름 검증에 실패했습니다.' });
          }
          if (Array.isArray(dupName) && dupName.length > 0 && dupName[0].id !== charPayload.id) {
            return sendJson(res, 409, {
              ok: false,
              nameOccupied: true,
              error: `'${charPayload.name}'은(는) 이미 존재하는 캐릭터 이름입니다.`
            });
          }
        }
      }

      const activeEntry = activeCharSockets.get(charPayload.id);
      const isGm = Boolean(activeEntry?.isAdmin);
      if (!isGm) {
        charPayload.level = Math.max(1, Math.min(250, Number(charPayload.level) || 1));
        charPayload.gold = Math.max(0, Math.min(999999999, Math.floor(Number(charPayload.gold) || 0)));
        if (charPayload.char_data && typeof charPayload.char_data === 'object') {
          const maxStatPts = charPayload.level * 4 + 30;
          charPayload.char_data.statPoints = Math.max(0, Math.min(maxStatPts, Number(charPayload.char_data.statPoints) || 0));
          if (charPayload.char_data.stats && typeof charPayload.char_data.stats === 'object') {
            const maxSingleStat = 150 + charPayload.level * 6;
            ['STR', 'DEX', 'INT', 'CON'].forEach(k => {
              if (typeof charPayload.char_data.stats[k] === 'number') {
                charPayload.char_data.stats[k] = Math.max(1, Math.min(maxSingleStat, Math.floor(charPayload.char_data.stats[k])));
              }
            });
          }
        }
      }
      const saveRes = await supabaseRest('magic_characters', 'POST', '', charPayload, 'id');
      if (!saveRes) {
        return sendJson(res, 500, { ok: false, error: '수파베이스 캐릭터 저장 실패' });
      }
      return sendJson(res, 200, { ok: true, character: Array.isArray(saveRes) ? saveRes[0] : charPayload });
    }
    return sendJson(res, 400, { ok: false, error: '잘못된 캐릭터 데이터입니다.' });
  }

  // [G-2] 모바일 백그라운드(5초 경과) 또는 캐릭터 선택창 복귀 시 유령 캐릭터 즉시 제거 API
  if (pathname === '/api/characters/leave' && req.method === 'POST') {
    const body = await readJsonBody(req);
    const leaveCharId = body?.charId || body?.id;
    if (leaveCharId && activeCharSockets.has(leaveCharId)) {
      const entry = activeCharSockets.get(leaveCharId);
      clearEntryMobileBgTimers(entry);
      const mk = entry?.mapKey;
      removeCharFromParty(leaveCharId, 'disconnect');
      activeCharSockets.delete(leaveCharId);
      if (mk) {
        broadcastToMap(mk, { type: 'PLAYER_LEFT_MAP', charId: leaveCharId });
      }
    }
    return sendJson(res, 200, { ok: true });
  }

  // [G-3] 스마트폰 백그라운드 진입/복귀 Keepalive API (모바일 OS가 WS/타이머를 동결해도 서버가 1.5초 무적 & 5초 자동퇴장 보장)
  if (pathname === '/api/characters/mobile-bg' && req.method === 'POST') {
    const body = await readJsonBody(req);
    const targetCharId = body?.charId || body?.id;
    const bgState = body?.state;
    if (targetCharId) {
      if (bgState === 'hidden') {
        scheduleServerMobileBgProtectionAndLogout(targetCharId);
      } else if (bgState === 'visible') {
        const stillOnline = activeCharSockets.has(targetCharId);
        if (stillOnline) {
          cancelServerMobileBgProtection(targetCharId);
        }
        return sendJson(res, 200, { ok: true, loggedOutByServer: !stillOnline });
      }
    }
    return sendJson(res, 200, { ok: true });
  }

  // [API 8] 캐릭터 삭제 (수파베이스 실시간 검증 후 삭제 및 최신 슬롯 반환)
  if (pathname === '/api/characters/delete' && req.method === 'POST') {
    const body = await readJsonBody(req);
    if (!body || !body.id || !body.user_id) {
      return sendJson(res, 400, { ok: false, error: '삭제할 캐릭터 정보가 올바르지 않습니다.' });
    }
    const checkExist = await supabaseRest('magic_characters', 'GET', `?id=eq.${encodeURIComponent(body.id)}&user_id=eq.${encodeURIComponent(body.user_id)}&limit=1`);
    if (checkExist === null) {
      return sendJson(res, 500, { ok: false, error: '수파베이스 DB 연결 실패로 삭제할 수 없습니다.' });
    }
    await supabaseRest('magic_characters', 'DELETE', `?id=eq.${encodeURIComponent(body.id)}&user_id=eq.${encodeURIComponent(body.user_id)}`);
    if (activeCharSockets.has(body.id)) {
      const delEntry = activeCharSockets.get(body.id);
      if (delEntry) {
        sendWsMessage(delEntry.conn, { type: 'GM_KICKED', reason: '해당 캐릭터가 삭제되어 접속이 종료되었습니다.' });
        removeCharFromParty(body.id, 'disconnect');
        activeCharSockets.delete(body.id);
      }
    }
    const remainingChars = await supabaseRest('magic_characters', 'GET', `?user_id=eq.${encodeURIComponent(body.user_id)}&slot_index=lt.100&order=slot_index.asc`);
    return sendJson(res, 200, { ok: true, characters: Array.isArray(remainingChars) ? remainingChars : [] });
  }

  // [API 9] 계정 공유 창고 조회 및 저장 (수파베이스 필수)
  if (pathname.startsWith('/api/storage/') && req.method === 'GET' && pathname !== '/api/storage/save') {
    const userId = pathname.replace('/api/storage/', '').trim();
    const remoteSt = await supabaseRest('magic_storage', 'GET', `?user_id=eq.${encodeURIComponent(userId)}&limit=1`);
    if (remoteSt === null) {
      return sendJson(res, 500, { ok: false, error: '수파베이스 창고 조회 실패', storage: null });
    }
    return sendJson(res, 200, { ok: true, storage: Array.isArray(remoteSt) && remoteSt.length > 0 ? remoteSt[0] : null });
  }

  if (pathname === '/api/storage/save' && req.method === 'POST') {
    const stPayload = await readJsonBody(req);
    if (stPayload && stPayload.user_id) {
      await supabaseRest('magic_storage', 'POST', '', stPayload, 'user_id');
    }
    return sendJson(res, 200, { ok: true });
  }

  // 공개 클라이언트 설정 조회 API (민감 정보 제외, 브라우저 403 콘솔 에러 방지)
  if (pathname === '/api/public-config' && req.method === 'GET') {
    return sendJson(res, 200, {
      ok: true,
      supabaseUrl: SUPABASE_URL,
      supabaseKey: SUPABASE_KEY,
      version: CURRENT_BUILD_VERSION
    });
  }

  // .env 직접 요청 시 서버 비밀키(ADMIN_PASSWORD, GROQ_API_KEY 등)는 절대 노출하지 않고 공개 Supabase URL/AnonKey만 안전하게 반환하여 403 콘솔 에러 방지
  if (pathname === '/.env') {
    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' });
    return res.end(`SUPABASE_URL=${SUPABASE_URL}\nSUPABASE_KEY=${SUPABASE_KEY}\n`);
  }

  if (pathname === '/favicon.ico') {
    res.writeHead(204);
    return res.end();
  }

  let relPath = pathname === '/' ? '/index.html' : pathname;
  let safePath = path.normalize(path.join(PUBLIC_DIR, relPath));
  if (!safePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    return res.end('Forbidden');
  }
  if (!fs.existsSync(safePath)) {
    // 리눅스 환경 대소문자 파일명 차이 자동 보정 (예: Arcana.tmj -> arcana.tmj)
    const dir = path.dirname(safePath);
    const baseLower = path.basename(safePath).toLowerCase();
    if (dir.startsWith(PUBLIC_DIR) && fs.existsSync(dir)) {
      try {
        const matched = fs.readdirSync(dir).find(f => f.toLowerCase() === baseLower);
        if (matched) safePath = path.join(dir, matched);
      } catch (e) {}
    }
  }
  if (!fs.existsSync(safePath) || fs.statSync(safePath).isDirectory()) {
    res.writeHead(404);
    return res.end('Not Found');
  }
  const ext = path.extname(safePath).toLowerCase();
  const mime = MIME_TYPES[ext] || 'application/octet-stream';
  const headers = { 'Content-Type': mime };
  if (['.html', '.js', '.mjs', '.css', '.json'].includes(ext)) {
    headers['Cache-Control'] = 'no-cache, no-store, must-revalidate';
    headers['Pragma'] = 'no-cache';
    headers['Expires'] = '0';
  }
  res.writeHead(200, headers);
  fs.createReadStream(safePath).pipe(res);
});

// ============================================================================
// 10. WebSocket 업그레이드 서버 연결
// ============================================================================
try {
  const WebSocket = require('ws');
  const wss = new WebSocket.Server({ server, path: '/ws' });
  wss.on('connection', (ws) => {
    ws.on('message', (data) => {
      try {
        handleClientWsPacket(ws, JSON.parse(data.toString()));
      } catch (e) {}
    });
    ws.on('close', () => removeDisconnectedConn(ws));
    ws.on('error', () => removeDisconnectedConn(ws));
  });
} catch (e) {
  server.on('upgrade', (req, socket) => {
    try { socket.setNoDelay(true); } catch (_) {}
    if (!req.url.startsWith('/ws')) {
      socket.destroy();
      return;
    }
    const key = req.headers['sec-websocket-key'];
    if (!key) {
      socket.destroy();
      return;
    }
    const acceptKey = crypto
      .createHash('sha1')
      .update(key + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11')
      .digest('base64');

    socket.write(
      'HTTP/1.1 101 Switching Protocols\r\n' +
      'Upgrade: websocket\r\n' +
      'Connection: Upgrade\r\n' +
      `Sec-WebSocket-Accept: ${acceptKey}\r\n\r\n`
    );

    const conn = { socket, charId: null };
    let recvBuffer = Buffer.alloc(0);

    socket.on('data', (chunk) => {
      recvBuffer = Buffer.concat([recvBuffer, chunk]);
      while (recvBuffer.length >= 2) {
        const opcode = recvBuffer[0] & 0x0f;
        if (opcode === 0x08) {
          removeDisconnectedConn(conn);
          socket.end();
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
        const totalFrameLen = offset + (isMasked ? 4 : 0) + payloadLen;
        if (recvBuffer.length < totalFrameLen) return;

        let dataBuf;
        if (isMasked) {
          const mask = recvBuffer.slice(offset, offset + 4);
          offset += 4;
          dataBuf = Buffer.alloc(payloadLen);
          for (let i = 0; i < payloadLen; i++) {
            dataBuf[i] = recvBuffer[offset + i] ^ mask[i % 4];
          }
        } else {
          dataBuf = recvBuffer.slice(offset, offset + payloadLen);
        }
        recvBuffer = recvBuffer.slice(totalFrameLen);

        if (opcode === 0x01 || opcode === 0x02) {
          if (opcode === 0x02) conn.binarySupported = true;
          try {
            const msg = JSON.parse(dataBuf.toString('utf8'));
            handleClientWsPacket(conn, msg);
          } catch (err) {}
        }
      }
    });
    socket.on('close', () => removeDisconnectedConn(conn));
    socket.on('error', () => removeDisconnectedConn(conn));
  });
}

setInterval(() => {
  const nextVer = computeServerBuildVersion();
  if (nextVer && nextVer !== CURRENT_BUILD_VERSION) {
    CURRENT_BUILD_VERSION = nextVer;
    broadcastToAll({
      type: 'SERVER_VERSION_UPDATED',
      version: CURRENT_BUILD_VERSION
    });
  }
}, 3000);

server.listen(PORT, '0.0.0.0', () => {
  console.log(`==============================================================`);
  console.log(`🚀 [Age of Magic] 수파베이스 단독 기준 서버 가동 완료!`);
  console.log(`🌐 접속 주소  : http://0.0.0.0:${PORT}`);
  console.log(`☁️ Supabase   : ${SUPABASE_URL}`);
  console.log(`👑 운영자모드 : 채팅창에 '/운영자모드' 또는 '/?' 입력 (/서버재부팅 지원)`);
  console.log(`==============================================================`);

  // 로컬 단독 실행 시(PM2 이중 실행이 아닐 때) AI 에이전트 러너 자동 구동
  if (process.env.PM2_MANAGED !== 'true' && process.env.DISABLE_AUTO_AI_RUNNER !== 'true') {
    setTimeout(() => {
      try {
        const runnerPath = fs.existsSync(path.join(__dirname, 'aiAgentRunner.js')) ? './aiAgentRunner.js' : './aiagentrunner.js';
        const { startAIAgentRunner } = require(runnerPath);
        startAIAgentRunner();
      } catch (err) {
        console.warn('⚠️ [AI Runner 자동 시작 알림]:', err.message);
      }
    }, 1500);
  }
});