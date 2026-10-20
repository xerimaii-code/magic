// js/game_06_net_ws.js — 수파베이스 온라인 검증 · 중앙 서버 WebSocket 실시간 멀티플레이 동기화
// ============================================================================
// ☁️ Supabase 인증 · 이메일/캐릭터명 중복체크 · 캐릭터 3슬롯 · 창고 계정공유 · 동시접속 차단 · 자동저장 엔진
// ============================================================================
let supabaseClient = null;
let isSupabaseRemoteConnected = false;
let isCentralServerConnected = false;
let lastWsSyncTime = 0;
let currentAuthMode = 'login';
let currentAccountUser = null; // { id, email }
let accountCharacters = [null, null, null];
let activeSlotIndex = null;
let activeCharacterId = null;
let currentSessionToken = null;
let pendingCreateSlotIndex = 0;
let selectedCreateClass = 'knight';
let verifiedSignupEmail = null;
let verifiedCharName = null;
let pendingDeleteSlotIndex = null;
let autoSaveTimerId = null;
let debounceSaveTimerId = null;
let sessionHeartbeatTimerId = null;
let realtimeSubscription = null;
let isGameSessionActive = false;

// UUID v4 생성기 (Supabase uuid 컬럼 타입 완벽 호환)
function generateValidUUID() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function isValidUUID(str) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(str || ''));
}

// 결정론적 비밀번호 해시 인코더 (magic_accounts.active_session_token 내부에 pw:<hash> 형태로 병행 저장하여
// Supabase 이메일 미인증 상태나 브라우저 변경 시에도 비밀번호 불일치 오류 없이 100% 검증)
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
  const b64 = btoa(unescape(encodeURIComponent(password)));
  return `${hex}_${b64}`;
}

function buildAccountTokenString(pwHash, sessionToken = '') {
  return `pw:${pwHash || ''}|sess:${sessionToken || ''}`;
}

function parseAccountTokenString(tokenStr) {
  const s = String(tokenStr || '');
  if (!s.startsWith('pw:')) {
    return { pwHash: null, sessionToken: s || null };
  }
  const parts = s.split('|sess:');
  return {
    pwHash: parts[0].slice(3) || null,
    sessionToken: parts[1] || null
  };
}

// 🌟 동일 계정 내 다른 캐릭터는 동시 접속을 허용하고, '동일 캐릭터(charId)' 중복 진입 시에만 이전 캐릭터를 종료!
const sessionBroadcastChannel = (typeof BroadcastChannel !== 'undefined')
  ? new BroadcastChannel('magic_rpg_session_sync')
  : null;

if (sessionBroadcastChannel) {
  sessionBroadcastChannel.onmessage = (ev) => {
    const msg = ev.data;
    if (!msg || !isGameSessionActive || !activeCharacterId) return;
    if (msg.type === 'NEW_CHAR_SESSION' && msg.charId === activeCharacterId && msg.sessionToken !== currentSessionToken) {
      handleForceDisconnectByOtherBrowser();
    }
  };
}

// 📱 모바일/태블릿 회원가입·로그인·캐릭터생성 시 가상 키보드가 입력창과 버튼을 가리지 않도록 자동 스크롤 및 뷰포트 조정
function setupAuthKeyboardViewportHandler() {
  const updateViewportHeight = () => {
    const vv = window.visualViewport;
    const vh = vv ? vv.height : window.innerHeight;
    document.documentElement.style.setProperty('--vvh', `${vh}px`);
    const isKeyboardOpen = vh < window.screen.height * 0.72 || vh < 520;
    document.body.classList.toggle('keyboard-open', isKeyboardOpen);
  };

  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', updateViewportHeight);
    window.visualViewport.addEventListener('scroll', updateViewportHeight);
  }
  window.addEventListener('resize', updateViewportHeight);
  updateViewportHeight();

  const authInputs = document.querySelectorAll('#auth-overlay-ui input, #char-select-ui input, #char-delete-modal input, #supabase-config-modal input');
  authInputs.forEach(inp => {
    inp.addEventListener('focus', () => {
      document.body.classList.add('keyboard-open');
      setTimeout(() => {
        try {
          inp.scrollIntoView({ behavior: 'smooth', block: 'center' });
        } catch (e) {}
      }, 180);
    });
    inp.addEventListener('blur', () => {
      setTimeout(updateViewportHeight, 150);
    });
  });
}

// 로컬 DB 미러 (오프라인 시에도 동일한 magic_ 테이블 구조로 보존 및 온라인 복귀 시 자동 마이그레이션)
function getLocalMirrorTable(tableName) {
  try {
    const raw = localStorage.getItem(`MAGIC_DB_${tableName}`);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

function setLocalMirrorTable(tableName, rows) {
  try {
    localStorage.setItem(`MAGIC_DB_${tableName}`, JSON.stringify(rows));
  } catch (e) {}
}

function getEffectiveSupabaseCreds() {
  const clean = (v) => String(v || '').trim().replace(/^["']+|["']+$/g, '').replace('fkztpigrlobgkgarnnvji.supabase.co', 'fkztpigrlobgkgammvji.supabase.co');
  const url = clean(localStorage.getItem('MAGIC_SUPABASE_URL') || GameDB.SupabaseConfig?.url || 'https://fkztpigrlobgkgammvji.supabase.co');
  const key = clean(localStorage.getItem('MAGIC_SUPABASE_ANON_KEY') || GameDB.SupabaseConfig?.anonKey || '');
  return { url, key };
}

window.toggleSupabaseConfigModal = function() {
  const modal = document.getElementById('supabase-config-modal');
  if (!modal) return;
  if (modal.style.display === 'none' || !modal.style.display) {
    const { url, key } = getEffectiveSupabaseCreds();
    const urlInp = document.getElementById('cfg-supabase-url');
    const keyInp = document.getElementById('cfg-supabase-key');
    if (urlInp) urlInp.value = url !== 'YOUR_SUPABASE_URL' ? url : '';
    if (keyInp) keyInp.value = key !== 'YOUR_SUPABASE_ANON_KEY' ? key : '';
    modal.style.display = 'flex';
  } else {
    modal.style.display = 'none';
  }
};

window.saveSupabaseConfigFromUI = async function() {
  const urlVal = (document.getElementById('cfg-supabase-url')?.value || '').trim().replace(/^["']+|["']+$/g, '');
  const keyVal = (document.getElementById('cfg-supabase-key')?.value || '').trim().replace(/^["']+|["']+$/g, '');
  if (urlVal && keyVal) {
    try {
      localStorage.setItem('MAGIC_SUPABASE_URL', urlVal);
      localStorage.setItem('MAGIC_SUPABASE_ANON_KEY', keyVal);
    } catch (e) {}
  } else {
    try {
      localStorage.removeItem('MAGIC_SUPABASE_URL');
      localStorage.removeItem('MAGIC_SUPABASE_ANON_KEY');
    } catch (e) {}
  }
  document.getElementById('supabase-config-modal').style.display = 'none';
  await initSupabaseConnection();
};

let isSupabaseOnlineVerified = false;
window.isSupabaseOnlineVerified = false;

function setAuthButtonsOnlineState(isOnline, statusMessage = '') {
  const badge = document.getElementById('db-conn-badge');
  const submitBtn = document.getElementById('auth-action-btn');
  const checkBtn = document.getElementById('btn-check-email');
  const statusMsg = document.getElementById('auth-status-msg');

  isSupabaseOnlineVerified = Boolean(isOnline);
  window.isSupabaseOnlineVerified = Boolean(isOnline);

  if (badge) {
    badge.innerText = '';
    if (isOnline) {
      badge.classList.add('online');
      badge.classList.remove('offline');
      badge.title = '🟢 수파베이스(Supabase) 실시간 온라인 연결됨 (클릭 시 설정)';
    } else {
      badge.classList.remove('online');
      badge.classList.add('offline');
      badge.title = '🔴 수파베이스(Supabase) 오프라인 — 온라인 상태에서만 로그인·회원가입 가능 (클릭 시 설정)';
    }
  }

  if (submitBtn) {
    submitBtn.disabled = !isOnline;
    submitBtn.style.opacity = isOnline ? '1' : '0.55';
    submitBtn.style.cursor = isOnline ? 'pointer' : 'not-allowed';
  }
  if (checkBtn) {
    checkBtn.disabled = !isOnline;
    checkBtn.style.opacity = isOnline ? '1' : '0.55';
  }
  if (statusMsg && statusMessage) {
    statusMsg.style.color = isOnline ? '#4ade80' : '#f87171';
    statusMsg.innerText = statusMessage;
  } else if (statusMsg && isOnline && statusMsg.innerText.includes('수파베이스')) {
    statusMsg.innerText = '';
  }
}

async function initSupabaseConnection() {
  const { url, key } = getEffectiveSupabaseCreds();
  const badge = document.getElementById('db-conn-badge');
  const accTable = GameDB.SupabaseConfig?.tables?.accounts || 'magic_accounts';

  // 체크 시작 시 황색(미확인) 상태에서는 로그인/회원가입 버튼 비활성화
  if (badge) {
    badge.classList.remove('online', 'offline');
    badge.title = '🟡 수파베이스(Supabase) 온라인 접속 확인 중...';
  }
  isSupabaseOnlineVerified = false;
  window.isSupabaseOnlineVerified = false;

  let clientReady = false;
  if (url && key && url.startsWith('http') && key !== 'YOUR_SUPABASE_ANON_KEY' && window.supabase?.createClient) {
    try {
      if (!supabaseClient) {
        supabaseClient = window.supabase.createClient(url, key, {
          auth: { persistSession: true, autoRefreshToken: true }
        });
      }
      clientReady = true;
    } catch (err) {
      console.warn('[Supabase 초기화 오류]', err);
      supabaseClient = null;
    }
  }

  // 1) 브라우저 -> Supabase 직접 실시간 쿼리 검증 (3.5초 타임아웃)
  let directOnlineOk = false;
  if (clientReady && supabaseClient) {
    try {
      const pingPromise = supabaseClient.from(accTable).select('user_id').limit(1);
      const timeoutPromise = new Promise(resolve => setTimeout(() => resolve({ error: new Error('timeout') }), 3500));
      const res = await Promise.race([pingPromise, timeoutPromise]);
      if (res && !res.error) {
        directOnlineOk = true;
      }
    } catch (e) {}
  }

  // 2) 중앙 서버(/api/supabase/ping) 경유 Supabase 온라인 검증
  let serverOnlineOk = false;
  if (!directOnlineOk) {
    const srvPing = await callCentralServerApi('/api/supabase/ping', 'GET');
    if (srvPing && srvPing.ok && srvPing.online) {
      serverOnlineOk = true;
    }
  }

  if (directOnlineOk || serverOnlineOk) {
    isSupabaseRemoteConnected = directOnlineOk;
    setAuthButtonsOnlineState(true, '');
    return true;
  }

  // 오프라인 또는 황색(연결 실패) 상태 -> 로컬 미러 폴백 절대 금지! 로그인/회원가입 즉시 차단!
  isSupabaseRemoteConnected = false;
  setAuthButtonsOnlineState(false, '⚠️ 수파베이스(Supabase) 온라인 연결 실패: 온라인(🟢) 상태에서만 로그인·회원가입이 가능합니다.');
  return false;
}
window.initSupabaseConnection = initSupabaseConnection;

// ============================================================================
// 🌐 중앙 Node.js 멀티플레이 서버(magic_server.js) REST 호출 헬퍼
// ============================================================================
async function callCentralServerApi(endpoint, method = 'POST', bodyObj = null) {
  try {
    const opts = {
      method,
      headers: { 'Content-Type': 'application/json' }
    };
    if (bodyObj && method !== 'GET') {
      opts.body = JSON.stringify(bodyObj);
    }
    const res = await fetch(endpoint, opts);
    if (!res.ok) return null;
    const data = await res.json();
    isCentralServerConnected = true;
    return data;
  } catch (e) {
    return null;
  }
}

// ============================================================================
// 🌐 중앙 서버 실시간 WebSocket 연결 및 패킷 핸들러
// ============================================================================
function connectCentralMultiplayerSocket() {
  if (typeof WebSocket === 'undefined') return;
  try {
    if (centralWs && (centralWs.readyState === WebSocket.OPEN || centralWs.readyState === WebSocket.CONNECTING)) {
      return;
    }
    const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${proto}//${location.host}/ws`;
    centralWs = new WebSocket(wsUrl);
    centralWs.binaryType = 'arraybuffer';

    centralWs.onopen = () => {
      isCentralServerConnected = true;
      if (isGameSessionActive && activeCharacterId && currentAccountUser) {
        sendCentralWsPacket({
          type: 'ENTER_CHAR',
          userId: currentAccountUser.id,
          email: currentAccountUser.email || '',
          charId: activeCharacterId,
          sessionToken: currentSessionToken,
          mapKey: currentMapKey,
          regionKey: currentRegionKey,
          player: buildMultiplayerPlayerSnapshot()
        });
      }
    };

    const _wsTextDecoder = typeof TextDecoder !== 'undefined' ? new TextDecoder('utf-8') : null;
    centralWs.onmessage = async (ev) => {
      try {
        let rawStr = '';
        if (typeof ev.data === 'string') {
          rawStr = ev.data;
        } else if (ev.data instanceof ArrayBuffer) {
          rawStr = _wsTextDecoder ? _wsTextDecoder.decode(new Uint8Array(ev.data)) : String.fromCharCode(...new Uint8Array(ev.data));
        } else if (typeof Blob !== 'undefined' && ev.data instanceof Blob) {
          rawStr = await ev.data.text();
        }
        if (!rawStr) return;
        const msg = JSON.parse(rawStr);
        handleCentralServerPacket(msg);
      } catch (e) {
        console.error("Central WS Message Error:", e);
      }
    };

    centralWs.onclose = () => {
      isCentralServerConnected = false;
      centralWs = null;
      setTimeout(() => {
        if (isGameSessionActive) connectCentralMultiplayerSocket();
      }, 3500);
    };

    centralWs.onerror = () => {};
  } catch (e) {}
}

function sendCentralWsPacket(payload) {
  if (centralWs && centralWs.readyState === WebSocket.OPEN) {
    try {
      centralWs.send(JSON.stringify(payload));
      return true;
    } catch (e) {}
  }
  return false;
}
window.sendCentralWsPacket = sendCentralWsPacket;

function isServerAuthoritativeMode() {
  return Boolean(isCentralServerConnected && centralWs && centralWs.readyState === WebSocket.OPEN);
}

function normalizeClientMapKey(rawKey) {
  const k = String(rawKey || 'R01_sub1').trim();
  const rId = k.split('_')[0] || 'R01';
  if (k.endsWith('_dungeon') || k.endsWith('_sub3')) return `${rId}_dungeon`;
  return `${rId}_sub1`;
}

function buildMultiplayerPlayerSnapshot() {
  const curTargetMobId = (player.targetEntity?.type === 'MONSTER' && player.targetEntity.ref && !player.targetEntity.ref.isDead)
    ? String(player.targetEntity.ref.id)
    : null;
  return {
    charId: activeCharacterId,
    userId: currentAccountUser?.id,
    email: currentAccountUser?.email || '',
    name: player.name,
    class: player.class,
    level: player.level || 1,
    x: Math.round(player.x || 2000),
    y: Math.round(player.y || 14250),
    dir: player.dir || 'down',
    isWalking: Boolean(player.isWalking || player.isMoving),
    lastAttackTime: player.lastAttackTime || 0,
    targetMobId: curTargetMobId,
    hp: Math.ceil(player.hp || 100),
    maxHp: player.maxHp || 100,
    mp: Math.ceil(player.mp || 50),
    maxMp: player.maxMp || 50,
    weaponType: player.weaponType || 'NONE',
    hasShield: Boolean(player.equip?.shield !== null && player.equip?.shield !== undefined && player.inventory?.[player.equip.shield]),
    isAdmin: Boolean(player.isAdmin),
    partyId: window.partyState?.partyId || null,
    isPartyLeader: Boolean(window.partyState && window.partyState.leaderCharId === activeCharacterId),
    mapKey: currentMapKey,
    regionKey: currentRegionKey,
    mercenary: (mercenary && mercenary.hired) ? {
      hired: true,
      isDead: Boolean(mercenary.isDead),
      class: mercenary.class,
      name: mercenary.name,
      dir: mercenary.dir || 'down',
      isWalking: Boolean(mercenary.isWalking),
      stance: mercenary.stance || 'SUPPORT',
      setTier: mercenary.setTier || 0,
      lastAttackTime: mercenary.lastAttackTime || 0,
      x: Math.round(mercenary.x || player.x),
      y: Math.round(mercenary.y || player.y),
      hp: Math.ceil(mercenary.hp || 100),
      maxHp: mercenary.maxHp || 100,
      mp: Math.ceil(mercenary.mp || 50),
      maxMp: mercenary.maxMp || 50
    } : null
  };
}

window.broadcastMultiplayerActionFx = function(fxKind, extra = {}) {
  const cid = activeCharacterId || window.activeCharacterId;
  if (!isGameSessionActive || !cid) return;
  sendCentralWsPacket({
    type: 'PLAYER_ACTION_FX',
    fxKind,
    charId: cid,
    mapKey: currentMapKey,
    regionKey: currentRegionKey,
    ...extra
  });
};

// 💬 캐릭터 머리 위 말풍선 설정 및 Pixi 렌더링 헬퍼 (현재 지역 플레이어 공유)
window.setEntitySpeechBubble = function(entity, rawText, durationMs = 4800) {
  if (!entity || !rawText) return;
  const cleanText = String(rawText).replace(/^\/(전체|지역|외침|일반)\s+/, '').trim();
  if (!cleanText || cleanText.startsWith('/')) return;
  entity.chatBubble = {
    text: cleanText.length > 36 ? (cleanText.slice(0, 36) + '…') : cleanText,
    expiresAt: Date.now() + durationMs
  };
};

// 🛡️ 용병 클래스 전용 배지 렌더러: 용병 필드 네임택 바로 앞에 클래스별 전용 엠블럼(전사 방패검 / 궁수 엘프활 / 마법사 마도서·오브 스태프) 표시
function drawMercClassBadgeNextToNameTag(uiG, mClass, tagObj, centerX, nameBottomY) {
  if (!uiG || !tagObj) return;
  const badgeSize = 15;
  const gap = 4;
  const textW = Math.max(36, tagObj.width || 68);
  const textH = Math.max(13, tagObj.height || 15);
  const totalW = badgeSize + gap + textW;
  const startX = Math.round(centerX - totalW / 2);

  tagObj.x = Math.round(startX + badgeSize + gap + textW / 2);
  tagObj.y = Math.round(nameBottomY);

  const bx = Math.round(startX + badgeSize / 2);
  const by = Math.round(nameBottomY - textH / 2);

  if (mClass === 'ranger') {
    // 🏹 엘프궁수 전용 에메랄드-골드 활·화살 배지
    uiG.lineStyle(1.3, 0x34d399, 0.98);
    uiG.beginFill(0x064e3b, 0.95);
    uiG.drawRoundedRect(bx - 7.5, by - 7.5, 15, 15, 4);
    uiG.endFill();
    // 활 몸체 곡선 & 시위 & 황금 화살
    uiG.lineStyle(1.6, 0xfacc15, 1);
    uiG.moveTo(bx - 2.5, by - 4.8);
    uiG.lineTo(bx + 2.5, by);
    uiG.lineTo(bx - 2.5, by + 4.8);
    uiG.lineStyle(1.0, 0xe2e8f0, 0.9);
    uiG.moveTo(bx - 2.5, by - 4.5);
    uiG.lineTo(bx - 2.5, by + 4.5);
    uiG.lineStyle(1.5, 0xfef08a, 1);
    uiG.moveTo(bx - 4.5, by);
    uiG.lineTo(bx + 4.5, by);
    uiG.lineStyle(0);
    uiG.beginFill(0x38bdf8, 1);
    uiG.drawPolygon([bx + 5.2, by, bx + 2.2, by - 2.2, bx + 2.2, by + 2.2]);
    uiG.endFill();
  } else if (mClass === 'wizard') {
    // 🔮 엘프마법사 전용 아케인 퍼플-시안 크리스탈 스태프 배지
    uiG.lineStyle(1.3, 0xc084fc, 0.98);
    uiG.beginFill(0x1e1b4b, 0.95);
    uiG.drawRoundedRect(bx - 7.5, by - 7.5, 15, 15, 4);
    uiG.endFill();
    uiG.lineStyle(1.6, 0xf59e0b, 1);
    uiG.moveTo(bx - 4.2, by + 4.2);
    uiG.lineTo(bx + 2.2, by - 2.2);
    uiG.lineStyle(1.1, 0xfef08a, 1);
    uiG.beginFill(0x38bdf8, 1);
    uiG.drawCircle(bx + 2.2, by - 2.2, 3.0);
    uiG.endFill();
    uiG.lineStyle(0);
    uiG.beginFill(0xffffff, 0.95);
    uiG.drawCircle(bx + 1.5, by - 2.8, 1.1);
    uiG.endFill();
  } else {
    // 🛡️ 인간전사 전용 로얄 크림슨-골드 방패·검 배지
    uiG.lineStyle(1.3, 0xfacc15, 0.98);
    uiG.beginFill(0x7f1d1d, 0.95);
    uiG.drawRoundedRect(bx - 7.5, by - 7.5, 15, 15, 4);
    uiG.endFill();
    uiG.lineStyle(1.2, 0xfef08a, 1);
    uiG.beginFill(0xdc2626, 1);
    uiG.drawPolygon([bx, by - 5.2, bx + 4.5, by - 3.2, bx + 3.8, by + 2.2, bx, by + 5.2, bx - 3.8, by + 2.2, bx - 4.5, by - 3.2]);
    uiG.endFill();
    uiG.lineStyle(1.5, 0xffffff, 1);
    uiG.moveTo(bx, by - 3.6);
    uiG.lineTo(bx, by + 3.6);
    uiG.moveTo(bx - 2.6, by - 0.8);
    uiG.lineTo(bx + 2.6, by - 0.8);
    uiG.lineStyle(0);
  }
}

// 🎗️ 파티별 고유 배지 색상 팔레트 (같은 파티원은 파티장/파티원 모두 동일한 배지 색상 공유!)
const PARTY_BADGE_THEMES = [
  { bg: 0x065f46, bd: 0x34d399, txt: 0xa7f3d0 }, // 에메랄드 그린 (내 파티 기본)
  { bg: 0x1e3a8a, bd: 0x60a5fa, txt: 0xdbeafe }, // 로얄 블루
  { bg: 0x581c87, bd: 0xc084fc, txt: 0xf3e8ff }, // 아메시스트 퍼플
  { bg: 0x7c2d12, bd: 0xfb923c, txt: 0xffedd5 }, // 앰버 오렌지
  { bg: 0x831843, bd: 0xf472b6, txt: 0xfce7f3 }, // 크림슨 핑크
  { bg: 0x164e63, bd: 0x22d3ee, txt: 0xcffafe }  // 시안 틸
];

function getPartyBadgeThemeByPartyId(partyId, isSameParty) {
  if (isSameParty) return PARTY_BADGE_THEMES[0];
  const pidStr = String(partyId || '');
  let h = 0;
  for (let i = 0; i < pidStr.length; i++) h = (h * 31 + pidStr.charCodeAt(i)) >>> 0;
  const idx = 1 + (h % (PARTY_BADGE_THEMES.length - 1));
  return PARTY_BADGE_THEMES[idx];
}

// 🎗️ 파티 배지 렌더러: 같은 파티원은 모두 동일한 배지 색상으로 표시 (파티장은 👑 아이콘으로 구분)
function drawPartyRibbonAboveEntity(uiG, uiContainer, entity, cx, nameBottomY, isLeader, isSameParty, customNameTag = null, partyId = null) {
  if (!entity) return;
  const tagObj = customNameTag || entity.nameTag;
  const nameH = (tagObj && tagObj.height > 0) ? tagObj.height : 16;

  const labelStr = isLeader ? '👑파티' : '🎗️파티';
  const badgeW = isLeader ? 42 : 40;
  const badgeH = 14;

  const left = Math.round(cx - badgeW / 2);
  const bottom = Math.round(nameBottomY - nameH - 2);
  const top = bottom - badgeH;
  const centerY = Math.round(top + badgeH / 2);

  const theme = getPartyBadgeThemeByPartyId(partyId || entity.partyId, isSameParty);

  uiG.lineStyle(1.3, theme.bd, 0.98);
  uiG.beginFill(theme.bg, 0.94);
  uiG.drawRoundedRect(left, top, badgeW, badgeH, 4);
  uiG.endFill();
  uiG.lineStyle(0);

  if (!entity.partyRibbonText) {
    entity.partyRibbonText = createCrispPixiText(labelStr, 9.5, theme.txt);
    entity.partyRibbonText._lastFill = theme.txt;
    entity.partyRibbonText.anchor.set(0.5, 0.5);
    uiContainer.addChild(entity.partyRibbonText);
  }
  if (entity.partyRibbonText.text !== labelStr) {
    entity.partyRibbonText.text = labelStr;
  }
  if (entity.partyRibbonText._lastFill !== theme.txt) {
    entity.partyRibbonText._lastFill = theme.txt;
    entity.partyRibbonText.style.fill = theme.txt;
  }
  entity.partyRibbonText.visible = true;
  entity.partyRibbonText.x = Math.round(cx);
  entity.partyRibbonText.y = centerY;
}

function renderEntitySpeechBubble(uiG, uiContainer, entity, anchorX, topY, now) {
  if (!entity) return;
  const b = entity.chatBubble;
  if (!b || !b.text || now >= b.expiresAt) {
    if (entity.bubbleTextObj) entity.bubbleTextObj.visible = false;
    return;
  }
  if (!entity.bubbleTextObj) {
    entity.bubbleTextObj = createCrispPixiText(b.text, 11, 0xfef9c3);
    entity.bubbleTextObj.anchor.set(0.5, 1);
    uiContainer.addChild(entity.bubbleTextObj);
  }
  if (entity.bubbleTextObj.text !== b.text) {
    entity.bubbleTextObj.text = b.text;
  }
  entity.bubbleTextObj.visible = true;
  const bx = Math.round(anchorX);
  const by = Math.round(topY - 6);
  entity.bubbleTextObj.x = bx;
  entity.bubbleTextObj.y = by - 5;

  const padX = 12;
  const padY = 6;
  const bw = Math.max(38, Math.round(entity.bubbleTextObj.width + padX));
  const bh = Math.max(20, Math.round(entity.bubbleTextObj.height + padY));
  const rx = Math.round(bx - bw / 2);
  const ry = Math.round(by - 5 - bh + 2);

  uiG.lineStyle(1.5, 0xfacc15, 0.92);
  uiG.beginFill(0x0f172a, 0.88);
  uiG.drawRoundedRect(rx, ry, bw, bh, 7);
  uiG.moveTo(bx - 4, ry + bh);
  uiG.lineTo(bx, ry + bh + 5);
  uiG.lineTo(bx + 4, ry + bh);
  uiG.endFill();
  uiG.lineStyle(0);
}

// 🛡️ 클라이언트 개발자도구(DevTools) 콘솔 변조 방지 및 서버 부하 분산 동기화
let _lastSentSyncSnapshotStr = '';
let _authorizedAdminFlag = false;
window.tickMultiplayerSync = function(now) {
  if (!isGameSessionActive || !activeCharacterId) return;
  // 개발자 도구 콘솔에서 임의로 player.isAdmin = true 또는 비정상 스탯/레벨 변조 시 즉시 차단 및 복구
  if (player.isAdmin && !_authorizedAdminFlag) {
    player.isAdmin = false;
    document.getElementById('gm-mode-badge')?.classList.add('hidden');
    document.getElementById('gm-quick-cmd-bar')?.classList.add('hidden');
  }
  if (player.level > 250 && !_authorizedAdminFlag) {
    player.level = 250;
  }
  const maxAllowedStat = 150 + (player.level || 1) * 6;
  if (!_authorizedAdminFlag && player.stats) {
    ['STR', 'DEX', 'INT', 'CON'].forEach(k => {
      if (player.stats[k] > maxAllowedStat) player.stats[k] = maxAllowedStat;
    });
  }

  const mercMovingOrAtk = Boolean(mercenary && mercenary.hired && !mercenary.isDead && (mercenary.isWalking || (now - (mercenary.lastAttackTime || 0) < 600)));
  const isActiveMoveOrAtk = Boolean(player.isWalking || player.isMoving || (now - (player.lastAttackTime || 0) < 600) || mercMovingOrAtk);
  // 📉 데이터 절약: 이동/전투 중에는 110ms로 부드럽게 동기화하고, 정지 대기 중에는 1400ms~4500ms로 전송 빈도를 낮춰 패킷 절약!
  const minInterval = isActiveMoveOrAtk ? 110 : 1400;
  if (now - lastWsSyncTime < minInterval) return;

  const snap = buildMultiplayerPlayerSnapshot();
  const mSnapStr = snap.mercenary ? `${snap.mercenary.x},${snap.mercenary.y},${snap.mercenary.hp},${snap.mercenary.stance}` : 'none';
  const keyStateStr = `${snap.x},${snap.y},${snap.dir},${snap.isWalking},${snap.hp},${snap.mp},${snap.level},${snap.weaponType},${mSnapStr}`;
  if (!isActiveMoveOrAtk && keyStateStr === _lastSentSyncSnapshotStr && (now - lastWsSyncTime < 4500)) {
    return;
  }
  _lastSentSyncSnapshotStr = keyStateStr;
  lastWsSyncTime = now;

  sendCentralWsPacket({
    type: 'PLAYER_SYNC',
    charId: activeCharacterId,
    mapKey: currentMapKey,
    regionKey: currentRegionKey,
    player: snap
  });
};

window.broadcastMultiplayerSkill = function(skillName, tx, ty, isAoe = false, circleLv = 1, dmgMult = 1.5, dmgAmount = 0, extra = {}) {
  const cid = activeCharacterId || window.activeCharacterId;
  if (!isGameSessionActive || !cid) return;
  sendCentralWsPacket({
    type: 'PLAYER_SKILL',
    charId: cid,
    mapKey: currentMapKey,
    regionKey: currentRegionKey,
    casterClass: extra.casterClass || player.class,
    casterX: extra.casterX ?? Math.round(player.x),
    casterY: extra.casterY ?? Math.round(player.y),
    startX: extra.startX ?? Math.round(player.x),
    startY: extra.startY ?? Math.round(player.y),
    mobId: extra.mobId || null,
    skyDrop: Boolean(extra.skyDrop),
    skillName,
    tx: Math.round(tx),
    ty: Math.round(ty),
    isAoe: Boolean(isAoe),
    circleLv: Number(circleLv) || 1,
    dmgMult: Number(dmgMult) || 1.5,
    dmgAmount: Number(dmgAmount) || 0
  });
};

window.sendMultiplayerChat = function() {
  const inp = document.getElementById('chat-msg-input');
  if (!inp) return;
  let text = (inp.value || '').trim();
  if (!text) return;

  const sel = document.getElementById('chat-channel-select');
  if (sel && !text.startsWith('/')) {
    if (sel.value === 'world') text = `/전체 ${text}`;
    else if (sel.value === 'region') text = `/지역 ${text}`;
    else if (sel.value === 'party') text = `/파티 ${text}`;
    else if (sel.value === 'gm' && player.isAdmin) text = `/공지 ${text}`;
  }

  chatCommandHistory.push(text);
  if (chatCommandHistory.length > 50) chatCommandHistory.shift();
  chatHistoryIdx = -1;
  inp.value = '';

  const sender = player.name || '모험가';

  if (!text.startsWith('/') || text.startsWith('/지역 ') || text.startsWith('/전체 ')) {
    window.setEntitySpeechBubble(player, text, 4800);
  }

  if (isServerAuthoritativeMode()) {
    sendCentralWsPacket({
      type: 'CHAT_MSG',
      charId: activeCharacterId,
      sender,
      text,
      mapKey: currentMapKey,
      regionKey: currentRegionKey
    });
    return;
  }

  // 오프라인 폴백
  if (text.startsWith('/')) {
    const cmd = text.split(/\s+/)[0].toLowerCase();
    if (cmd === '/?' || cmd === '/도움말' || cmd === '/명령어') {
      if (player.isAdmin) {
        window.addChat(`👑 [운영자(GM) 도움말] /누구 · /공지 · /무적 · /투명 · /완전회복 · /레벨 · /골드 · /스탯 · /스킬마스터 · /올강화 · /소환 · /보스소환 · /학살 · /이동 · /출두 · /소환유저`, 'log-kill', 'gm');
      } else {
        window.addChat(`💬 [일반 도움말] /누구 · /전체 <할말> · /지역 <할말> · /귓속말 <이름> <할말> · /좌표 · /청소 · /운영자모드`, 'log-sys', 'sys');
      }
      return;
    }
    if (cmd === '/누구' || cmd === '/who') {
      window.addChat(`👥 [접속자] 본인: ${player.name} (Lv.${player.level || 1})`, 'log-sys');
      return;
    }
    if (cmd === '/운영자모드' || cmd === '/운영자') {
      const pwArg = (text.split(/\s+/)[1] || '').trim();
      if (!pwArg) {
        if (player.isAdmin) {
          applyAdminModeState(false);
          window.addChat(`🛡️ [운영자 모드 해제] 일반 모험가 모드로 전환되었습니다.`, 'log-sys');
        } else {
          window.addChat(`🔒 사용법: /운영자모드 <비밀번호>`, 'log-hit');
        }
        return;
      }
      if (pwArg !== '90051254') {
        window.addChat(`🚫 비밀번호가 일치하지 않습니다.`, 'log-hit');
        return;
      }
      applyAdminModeState(true);
      window.addChat(`👑 [운영자 모드 활성화] GM 권한이 활성화되었습니다. ('/명령어'로 확인)`, 'log-kill', 'gm');
      return;
    }
    if (cmd === '/운영자해제') {
      applyAdminModeState(false);
      window.addChat(`🛡️ [운영자 모드 해제] 일반 모험가 모드로 전환되었습니다.`, 'log-sys');
      return;
    }
  }
  window.addChat(`💬 [${sender}] ${text}`, 'log-chat', 'chat');
};

function applyAdminModeState(isAdmin, extra = {}) {
  _authorizedAdminFlag = Boolean(isAdmin);
  player.isAdmin = Boolean(isAdmin);
  if (typeof extra.gmInvincible === 'boolean') player.gmInvincible = extra.gmInvincible;
  if (typeof extra.gmInvisible === 'boolean') player.gmInvisible = extra.gmInvisible;
  if (typeof extra.gmSpeedMult === 'number') player.gmSpeedMult = extra.gmSpeedMult;
  if (typeof extra.gmAtkMult === 'number') player.gmAtkMult = extra.gmAtkMult;

  const gmBadge = document.getElementById('gm-mode-badge');
  const gmQuickBar = document.getElementById('gm-quick-cmd-bar');
  const gmTab = document.getElementById('chat-tab-gm');
  const gmChItem = document.getElementById('chat-ch-gm-item');
  if (gmBadge) gmBadge.classList.toggle('hidden', !player.isAdmin);
  if (gmQuickBar) gmQuickBar.classList.toggle('hidden', !player.isAdmin);
  if (gmTab) gmTab.classList.toggle('hidden', !player.isAdmin);
  if (gmChItem) gmChItem.classList.toggle('hidden', !player.isAdmin);
  if (!player.isAdmin && currentChatTab === 'gm') {
    window.setChatTab?.('all');
  } else {
    window.applyChatFilter?.();
  }
}

let gmNoticeTimerId = null;
function showGmNoticeBanner(sender, text) {
  const banner = document.getElementById('gm-notice-banner');
  const txtEl = document.getElementById('gm-notice-text');
  if (!banner || !txtEl) return;
  txtEl.innerText = `[운영자 ${sender} 공지] ${text}`;
  banner.classList.remove('hidden');
  if (gmNoticeTimerId) clearTimeout(gmNoticeTimerId);
  gmNoticeTimerId = setTimeout(() => {
    banner.classList.add('hidden');
  }, 8500);
}

function cleanupOtherPlayerVisuals(oldOp) {
  if (!oldOp) return;
  if (oldOp.nameTag && oldOp.nameTag.parent) {
    oldOp.nameTag.parent.removeChild(oldOp.nameTag);
    oldOp.nameTag.destroy();
    oldOp.nameTag = null;
  }
  if (oldOp.bubbleTextObj && oldOp.bubbleTextObj.parent) {
    oldOp.bubbleTextObj.parent.removeChild(oldOp.bubbleTextObj);
    oldOp.bubbleTextObj.destroy();
    oldOp.bubbleTextObj = null;
  }
  if (oldOp.partyRibbonText && oldOp.partyRibbonText.parent) {
    oldOp.partyRibbonText.parent.removeChild(oldOp.partyRibbonText);
    oldOp.partyRibbonText.destroy();
    oldOp.partyRibbonText = null;
  }
  if (oldOp.mercenary?.nameTag && oldOp.mercenary.nameTag.parent) {
    oldOp.mercenary.nameTag.parent.removeChild(oldOp.mercenary.nameTag);
    oldOp.mercenary.nameTag.destroy();
    oldOp.mercenary.nameTag = null;
  }
  destroyOtherPlayerSprite(oldOp);
}

function syncAuthoritativePlayersList(playersArr, isDelta = false, allCharIds = null) {
  if (!Array.isArray(playersArr)) return;
  const incomingMap = new Map();
  playersArr.forEach(p => {
    if (!p || p.charId === activeCharacterId) return;
    incomingMap.set(p.charId, p);
  });

  const validIdSet = Array.isArray(allCharIds) ? new Set(allCharIds) : null;

  if (Array.isArray(window.otherPlayers)) {
    window.otherPlayers.forEach(oldOp => {
      if (!oldOp) return;
      const shouldRemove = isDelta
        ? (validIdSet ? !validIdSet.has(oldOp.charId) : false)
        : !incomingMap.has(oldOp.charId);
      if (shouldRemove) {
        cleanupOtherPlayerVisuals(oldOp);
      }
    });
  }

  const nowTs = Date.now();
  const baseMap = new Map();
  if (isDelta && Array.isArray(window.otherPlayers)) {
    window.otherPlayers.forEach(op => {
      if (op && op.charId && op.charId !== activeCharacterId) {
        if (!validIdSet || validIdSet.has(op.charId)) {
          baseMap.set(op.charId, op);
        }
      }
    });
  }

  incomingMap.forEach((newP, cId) => {
    const existing = baseMap.get(cId) || (window.otherPlayers || []).find(o => o && o.charId === cId);
    const isMiniOnly = Boolean(newP.mOnly || newP._minimapOnly);
    if (existing) {
      const movedDelta = Math.hypot((newP.x || 0) - (existing.serverX ?? existing.x ?? 0), (newP.y || 0) - (existing.serverY ?? existing.y ?? 0));
      const distFromRender = Math.hypot((newP.x || 0) - (existing.x ?? newP.x ?? 0), (newP.y || 0) - (existing.y ?? newP.y ?? 0));
      const classBaseSpd = CLASS_STATS[newP.class || existing.class]?.baseSpeed || 1.90;
      const reportedSpd = typeof newP.speed === 'number' ? newP.speed : (existing.speed || classBaseSpd);

      // 100ms(6프레임) 동안 현재 화면 위치에서 새 서버 위치까지 끊김 없이 등속으로 도달하도록 보간 속도 산출
      existing._interpSpeed = distFromRender > 0.5
        ? Math.max(reportedSpd * 0.88, Math.min(reportedSpd * 1.45, distFromRender / 6.0))
        : reportedSpd;
      existing.speed = reportedSpd;
      existing.lastPacketTime = nowTs;

      if (movedDelta > 0.5 || newP.isWalking) {
        existing.lastMoveVisualTime = nowTs;
      }
      existing.serverX = newP.x;
      existing.serverY = newP.y;
      if (typeof newP.moveX === 'number') existing.moveX = newP.moveX;
      if (typeof newP.moveY === 'number') existing.moveY = newP.moveY;
      existing.isMinimapOnly = isMiniOnly;
      if (!isMiniOnly) {
        existing.serverDir = newP.dir || existing.serverDir || existing.dir;
        if (!existing.isWalking || !existing.dir) {
          existing.dir = newP.dir || existing.dir;
        }
        existing.serverWalking = Boolean(newP.isWalking || movedDelta > 0.5);
        existing.isWalking = Boolean(existing.serverWalking || (nowTs - (existing.lastMoveVisualTime || 0) < 240));
        existing.lastAttackTime = newP.lastAttackTime || existing.lastAttackTime || 0;
        existing.hp = newP.hp ?? existing.hp;
        existing.maxHp = newP.maxHp ?? existing.maxHp;
        existing.mp = newP.mp ?? existing.mp;
        existing.maxMp = newP.maxMp ?? existing.maxMp;
        existing.weaponType = newP.weaponType || existing.weaponType;
        if (newP.hasShield !== undefined) existing.hasShield = Boolean(newP.hasShield);
      }
      existing.level = newP.level || existing.level;
      existing.name = newP.name || existing.name;
      existing.class = newP.class || existing.class;
      existing.isAdmin = Boolean(newP.isAdmin ?? existing.isAdmin);
      existing.gmInvisible = Boolean(newP.gmInvisible ?? existing.gmInvisible);
      existing.partyId = newP.partyId !== undefined ? newP.partyId : existing.partyId;
      existing.isPartyLeader = Boolean(newP.isPartyLeader ?? existing.isPartyLeader);
      if (newP.targetMobId !== undefined) existing.targetMobId = newP.targetMobId;

      if (!isMiniOnly) {
        if (newP.mercenary && newP.mercenary.hired) {
          if (existing.mercenary) {
            const mRenderDist = Math.hypot(
              (newP.mercenary.x || 0) - (existing.mercenary.x ?? newP.mercenary.x ?? 0),
              (newP.mercenary.y || 0) - (existing.mercenary.y ?? newP.mercenary.y ?? 0)
            );
            const mReportedSpd = typeof newP.mercenary.speed === 'number' ? newP.mercenary.speed : (reportedSpd * 1.02);
            const mInterpSpd = mRenderDist > 0.5
              ? Math.max(mReportedSpd * 0.88, Math.min(mReportedSpd * 1.45, mRenderDist / 6.0))
              : mReportedSpd;
            existing.mercenary = {
              ...existing.mercenary,
              ...newP.mercenary,
              x: existing.mercenary.x ?? newP.mercenary.x,
              y: existing.mercenary.y ?? newP.mercenary.y,
              serverX: newP.mercenary.x,
              serverY: newP.mercenary.y,
              speed: mReportedSpd,
              _interpSpeed: mInterpSpd,
              serverWalking: Boolean(newP.mercenary.isWalking || mRenderDist > 0.5),
              lastMoveVisualTime: (newP.mercenary.isWalking || mRenderDist > 0.5) ? nowTs : (existing.mercenary.lastMoveVisualTime || 0),
              lastAttackTime: Math.max(existing.mercenary.lastAttackTime || 0, newP.mercenary.lastAttackTime || 0),
              nameTag: existing.mercenary.nameTag || null
            };
          } else {
            existing.mercenary = {
              ...newP.mercenary,
              serverX: newP.mercenary.x,
              serverY: newP.mercenary.y,
              speed: newP.mercenary.speed || (reportedSpd * 1.02),
              _interpSpeed: newP.mercenary.speed || (reportedSpd * 1.02),
              serverWalking: Boolean(newP.mercenary.isWalking),
              lastMoveVisualTime: newP.mercenary.isWalking ? nowTs : 0,
              nameTag: null
            };
          }
        } else if (newP.mercenary === null && !newP._delta) {
          if (existing.mercenary?.nameTag?.parent) {
            existing.mercenary.nameTag.parent.removeChild(existing.mercenary.nameTag);
            existing.mercenary.nameTag.destroy();
          }
          existing.mercenary = null;
        }
      }
      baseMap.set(cId, existing);
    } else {
      const initSpd = newP.speed || CLASS_STATS[newP.class]?.baseSpeed || 1.90;
      baseMap.set(cId, {
        ...newP,
        speed: initSpd,
        _interpSpeed: initSpd,
        serverDir: newP.dir || 'down',
        serverWalking: Boolean(newP.isWalking),
        lastPacketTime: nowTs,
        isMinimapOnly: isMiniOnly,
        serverX: newP.x,
        serverY: newP.y,
        lastMoveVisualTime: newP.isWalking ? nowTs : 0,
        nameTag: null
      });
    }
  });

  window.otherPlayers = Array.from(baseMap.values());
  if (window.partyState && Array.isArray(window.partyState.members) && window.partyState.members.length > 0) {
    window.updateMercHUD?.();
  }
}

window.serverTimeOffset = 0;
window.getSyncedServerTime = function() {
  return Date.now() + (window.serverTimeOffset || 0);
};
window._monsterIdMap = new Map();

function getFastMonsterById(mobId) {
  let m = window._monsterIdMap.get(mobId);
  if (m) return m;
  for (let i = 0; i < monsterList.length; i++) {
    if (monsterList[i].id === mobId) {
      window._monsterIdMap.set(mobId, monsterList[i]);
      return monsterList[i];
    }
  }
  return null;
}

function syncAuthoritativeMonstersFull(serverMonsters) {
  if (!Array.isArray(serverMonsters)) return;
  const oldMap = new Map();
  monsterList.forEach(m => oldMap.set(m.id, m));

  const nextList = [];
  window._monsterIdMap.clear();
  serverMonsters.forEach(sm => {
    const existing = oldMap.get(sm.id);
    if (existing) {
      oldMap.delete(sm.id);
      Object.assign(existing, sm, {
        serverX: sm.x,
        serverY: sm.y,
        nameTag: existing.nameTag
      });
      if (existing.isDead && existing.nameTag) existing.nameTag.visible = false;
      nextList.push(existing);
      window._monsterIdMap.set(existing.id, existing);
    } else {
      const baseMob = (GameDB.Monsters || []).find(bm => bm.id === sm.mobId || bm.name === sm.name) || sm;
      const created = createMonsterInstance(sm.id, baseMob, sm.x, sm.y, sm.isBoss);
      Object.assign(created, sm, {
        serverX: sm.x,
        serverY: sm.y
      });
      nextList.push(created);
      window._monsterIdMap.set(created.id, created);
    }
  });

  // 제거된 몬스터 이름표 정리
  oldMap.forEach(removed => {
    if (removed.nameTag && removed.nameTag.parent) {
      removed.nameTag.parent.removeChild(removed.nameTag);
      removed.nameTag.destroy();
      removed.nameTag = null;
    }
  });

  monsterList = nextList;
}

function syncAuthoritativeGroundItems(serverItems) {
  if (!Array.isArray(serverItems)) return;
  const incomingMap = new Map();
  serverItems.forEach(it => {
    if (it && it.uid) incomingMap.set(it.uid, it);
  });

  for (let i = itemList.length - 1; i >= 0; i--) {
    const localIt = itemList[i];
    if (!localIt.uid || !incomingMap.has(localIt.uid)) {
      destroyItemGraphics(localIt);
      itemList.splice(i, 1);
    } else {
      incomingMap.delete(localIt.uid);
    }
  }

  incomingMap.forEach(newIt => {
    itemList.push({ ...newIt });
  });
}

function handleCentralServerPacket(msg) {
  if (!msg || !msg.type) return;

  if (typeof msg.serverTime === 'number' && msg.serverTime > 0) {
    const newOffset = msg.serverTime - Date.now();
    window.serverTimeOffset = window.serverTimeOffset === 0
      ? newOffset
      : Math.round(window.serverTimeOffset * 0.8 + newOffset * 0.2);
  }

  if (msg.buildVersion) {
    window.checkServerVersionAndAutoReload?.(msg.buildVersion);
  }
  if (msg.type === 'SERVER_VERSION_UPDATED' && msg.version) {
    window.checkServerVersionAndAutoReload?.(msg.version);
    return;
  }

  if (msg.type === 'SERVER_REBOOT_COUNTDOWN') {
    const sec = Number(msg.secondsLeft) || 0;
    const reasonStr = msg.reason || '정기 점검 및 최적화';
    if (sec > 0) {
      showGmNoticeBanner(msg.sender || '시스템', `⏳ [${reasonStr}] ${sec}초 후 서버가 자동 재부팅됩니다! (데이터 안전 자동 저장됨)`);
    } else {
      showGmNoticeBanner(msg.sender || '시스템', `🔄 서버 재부팅을 시작합니다. 잠시 후 자동 재연결됩니다!`);
    }
    if (sec === 20 || sec === 10 || sec === 5 || sec <= 2) {
      window.triggerAutoSave?.('server_reboot_countdown', true);
    }
    return;
  }

  if (msg.type === 'FORCE_CLIENT_SAVE' || msg.type === 'SERVER_SHUTDOWN_NOTICE') {
    window.triggerAutoSave?.('server_reboot', true);
    return;
  }

  // 1) 동일 캐릭터 중복 접속 차단
  if (msg.type === 'FORCE_DISCONNECT_SAME_CHAR') {
    if (isGameSessionActive && msg.charId === activeCharacterId && msg.newSessionToken !== currentSessionToken) {
      handleForceDisconnectByOtherBrowser();
    }
    return;
  }

  if (msg.type === 'PLAYER_LEFT_MAP' && msg.charId) {
    if (Array.isArray(window.otherPlayers)) {
      const rem = window.otherPlayers.find(o => o && o.charId === msg.charId);
      if (rem) {
        if (rem.nameTag?.parent) rem.nameTag.parent.removeChild(rem.nameTag);
        if (rem.bubbleTextObj?.parent) rem.bubbleTextObj.parent.removeChild(rem.bubbleTextObj);
        if (rem.partyRibbonText?.parent) rem.partyRibbonText.parent.removeChild(rem.partyRibbonText);
        destroyOtherPlayerSprite(rem);
      }
      window.otherPlayers = window.otherPlayers.filter(o => o && o.charId !== msg.charId);
      window.updateMercHUD?.();
    }
    return;
  }

  if (msg.type === 'PARTY_INVITE_RECEIVED') {
    window.showPartyInvitePopup?.(msg);
    return;
  }

  if (msg.type === 'PARTY_STATE_UPDATE') {
    window.partyState = msg.party || null;
    if (window.partyState && window.partyState.partyMode) {
      window.partyAutoHuntMode = window.partyState.partyMode;
    }
    if (player) {
      player.partyId = window.partyState ? window.partyState.partyId : null;
      player.isPartyLeader = Boolean(window.partyState && window.partyState.leaderCharId === activeCharacterId);
    }
    window.updateMercHUD?.();
    const pModal = document.getElementById('party-control-modal');
    if (pModal && !pModal.classList.contains('hidden')) {
      if (!window.partyState) window.closePartyControlModal?.();
      else window.renderPartyControlModal?.();
    }
    return;
  }

  // 🌟 타 플레이어(및 타 플레이어 용병) 평타·원거리 화살/마법탄·물약·인챈트·텔레포트·버프/힐 100% 동기화
  if (msg.type === 'REMOTE_PLAYER_ACTION_FX' && msg.charId !== activeCharacterId) {
    if (msg.mapKey && normalizeClientMapKey(msg.mapKey) !== normalizeClientMapKey(currentMapKey)) return;
    const op = (window.otherPlayers || []).find(o => o && o.charId === msg.charId);
    const followEntity = msg.isMerc ? (op?.mercenary || null) : (op || null);

    if (msg.fxKind === 'basic_atk') {
      const sx = Number(msg.sx) || (followEntity ? followEntity.x : (op?.x || player.x));
      const sy = Number(msg.sy) || (followEntity ? followEntity.y : (op?.y || player.y));
      const tx = Number(msg.tx) || sx;
      const ty = Number(msg.ty) || sy;
      const cCls = msg.casterClass || (msg.isMerc ? op?.mercenary?.class : op?.class) || 'knight';

      if (msg.isMerc && op && op.mercenary) {
        op.mercenary.lastAttackTime = Date.now();
        op.mercenary.dir = (tx >= sx) ? 'right' : 'left';
      } else if (op) {
        op.lastAttackTime = Date.now();
        op.spriteFrame = 0;
        op.lastSpriteFrameTime = Date.now();
        const dx = tx - sx;
        const dy = ty - sy;
        if (Math.abs(dx) > 1 || Math.abs(dy) > 1) {
          if (Math.abs(dx) > Math.abs(dy)) op.dir = dx > 0 ? 'right' : 'left';
          else op.dir = dy > 0 ? 'down' : 'up';
        }
      }

      if (Math.hypot(sx - player.x, sy - player.y) <= 850) {
        SoundSystem.playBasicAttack?.(cCls);
      }

      if (msg.isRanged || cCls === 'ranger' || cCls === 'wizard') {
        const foundMob = (msg.mobId && monsterList.find(m => m.id === msg.mobId && !m.isDead)) ||
          monsterList.find(m => !m.isDead && Math.hypot(m.x - tx, m.y - ty) <= 65);
        const targetRef = foundMob || { x: tx, y: ty, isDead: false };
        projectiles.push({
          x: sx,
          y: sy - 15,
          startX: sx,
          startY: sy - 15,
          lastTargetX: targetRef.x,
          lastTargetY: targetRef.y,
          target: targetRef,
          speed: 14,
          type: cCls === 'ranger' ? 'arrow' : 'magic',
          dmg: 0,
          visualOnly: true,
          skillName: null,
          isAoe: false
        });
      }
    } else if (msg.fxKind === 'potion') {
      const px = msg.x || followEntity?.x || op?.x || player.x;
      const py = msg.y || followEntity?.y || op?.y || player.y;
      const sub = msg.subType || 'hp';
      activeEffects.push({ type: 'potion', subType: sub, x: px, y: py, targetRef: followEntity, life: 30, maxLife: 30, skillName: msg.skillName || '물약' });
      if (msg.amount) {
        floatingTexts.push({ x: px, y: py - 45, text: `+${msg.amount} ${sub === 'mp' ? 'MP' : 'HP'}`, color: sub === 'mp' ? 0x60a5fa : 0x4ade80, life: 28 });
      }
    } else if (msg.fxKind === 'teleport') {
      const tx = msg.x || op?.x || player.x;
      const ty = msg.y || op?.y || player.y;
      if (op && typeof msg.x === 'number' && typeof msg.y === 'number') {
        op.x = msg.x;
        op.y = msg.y;
        op.serverX = msg.x;
        op.serverY = msg.y;
      }
      activeEffects.push({ type: 'buff', x: tx, y: ty, life: 25, maxLife: 25, skillName: msg.skillName || '텔레포트' });
    } else if (msg.fxKind === 'enchant') {
      const ex = msg.x || followEntity?.x || op?.x || player.x;
      const ey = msg.y || followEntity?.y || op?.y || player.y;
      if (msg.success) {
        activeEffects.push({ type: 'buff', x: ex, y: ey, targetRef: followEntity, life: 28, maxLife: 28, skillName: '인챈트 스탯' });
        floatingTexts.push({ x: ex, y: ey - 52, text: `✨ +${msg.plus} 강화 성공!`, color: 0xfacc15, life: 38 });
      } else {
        floatingTexts.push({ x: ex, y: ey - 52, text: `💔 강화 실패`, color: 0xf87171, life: 34 });
      }
    } else if (msg.fxKind === 'combat_react') {
      const rx = op?.x || msg.x || player.x;
      const ry = op?.y || msg.y || player.y;
      const rType = msg.reactType || 'dodge';
      const label = rType === 'counter' ? '⚔️ COUNTER!' : (rType === 'block' ? '🛡️ BLOCK!' : '💨 DODGE!');
      const col = rType === 'dodge' ? 0x38bdf8 : 0xfacc15;
      floatingTexts.push({ x: rx, y: ry - 45, text: label, color: col, life: 28 });
    } else if (msg.fxKind === 'level_up') {
      const lx = op?.x || msg.x || player.x;
      const ly = op?.y || msg.y || player.y;
      floatingTexts.push({ x: lx, y: ly - 55, text: `🎉 Lv.${msg.level || ''}!`, color: 0xfacc15, life: 45 });
      activeEffects.push({ type: 'buff', x: lx, y: ly, targetRef: op, life: 35, maxLife: 35, skillName: '어드밴스드 스피릿' });
    } else if (msg.fxKind === 'ally_buff') {
      const targetEntity = msg.targetCharId
        ? (msg.targetCharId === activeCharacterId ? player : ((window.otherPlayers || []).find(o => o && o.charId === msg.targetCharId) || followEntity))
        : followEntity;
      const bx = msg.x || targetEntity?.x || op?.x || player.x;
      const by = msg.y || targetEntity?.y || op?.y || player.y;
      activeEffects.push({ type: 'buff', x: bx, y: by, targetRef: targetEntity || null, life: 30, maxLife: 30, skillName: msg.skillName || '힐링' });
      if (msg.healAmt) {
        floatingTexts.push({ x: bx, y: by - 46, text: `+${msg.healAmt} HP`, color: 0x4ade80, life: 30 });
      } else if (msg.skillName) {
        floatingTexts.push({ x: bx, y: by - 46, text: `✨ ${msg.skillName}`, color: 0xfde047, life: 28 });
      }
    }
    return;
  }

  // 2) 맵 진입/이동 시 서버 권위 초기 상태(몬스터/바닥아이템/타플레이어/보스타이머) 전체 동기화
  if (msg.type === 'MAP_INIT_STATE') {
    if (normalizeClientMapKey(msg.mapKey) !== normalizeClientMapKey(currentMapKey)) return;
    if (typeof msg.bossRespawnTimer === 'number') bossRespawnTimer = msg.bossRespawnTimer;
    syncAuthoritativeMonstersFull(msg.monsters || []);
    syncAuthoritativeGroundItems(msg.groundItems || []);
    syncAuthoritativePlayersList(msg.players || []);
    return;
  }

  // 3) 100ms 서버 권위 틱 스냅샷 수신 (모든 유저가 동일한 몬스터 좌표·체력·보스타이머 공유)
  if (msg.type === 'WORLD_STATE_TICK') {
    if (normalizeClientMapKey(msg.mapKey) !== normalizeClientMapKey(currentMapKey)) return;
    if (typeof msg.bossRespawnTimer === 'number') bossRespawnTimer = msg.bossRespawnTimer;
    if (msg.party !== undefined) {
      window.partyState = msg.party || null;
      if (window.partyState && window.partyState.partyMode) {
        window.partyAutoHuntMode = window.partyState.partyMode;
      }
      if (player) {
        player.partyId = window.partyState ? window.partyState.partyId : null;
        player.isPartyLeader = Boolean(window.partyState && window.partyState.leaderCharId === activeCharacterId);
      }
    }

    // A. 초경량 튜플 패킷(msg.ms: [id, x, y, hp, isDead, mp, maxHp, stunUntil, defDownUntil, respawnTimer]) 복원
    if (Array.isArray(msg.ms)) {
      for (let i = 0; i < msg.ms.length; i++) {
        const tup = msg.ms[i];
        if (!Array.isArray(tup)) continue;
        const m = getFastMonsterById(tup[0]);
        if (m) {
          const distM = Math.hypot((tup[1] || 0) - (m.x ?? tup[1] ?? 0), (tup[2] || 0) - (m.y ?? tup[2] ?? 0));
          const defMobSpd = m.isBoss ? 1.82 : 1.45;
          m._interpSpeed = distM > 0.4 ? Math.max(0.45, Math.min(2.45, distM / 6.0)) : defMobSpd;
          m.serverX = tup[1];
          m.serverY = tup[2];
          if (tup[3] !== undefined) m.hp = tup[3];
          const deadFlag = Boolean(tup[4]);
          if (!m.isDead && deadFlag && m.nameTag) m.nameTag.visible = false;
          if (m.isDead && !deadFlag) {
            m.x = tup[1];
            m.y = tup[2];
          }
          m.isDead = deadFlag;
          if (tup.length >= 9) {
            if (tup[5] !== undefined) m.mp = tup[5];
            if (tup[6] !== undefined) m.maxHp = tup[6];
            m.stunUntil = tup[7] || 0;
            m.defDownUntil = tup[8] || 0;
            if (tup[9] !== undefined) m.respawnTimer = tup[9];
          } else {
            if (tup[5] !== undefined) m.respawnTimer = tup[5];
            m.stunUntil = tup[6] || 0;
            m.defDownUntil = tup[7] || 0;
          }
        }
      }
      if (player.targetEntity?.type === 'MONSTER' && player.targetEntity.ref) {
        updateTopTargetUI(player.targetEntity.ref);
      }
    } else if (Array.isArray(msg.monsters)) {
      for (let i = 0; i < msg.monsters.length; i++) {
        const sm = msg.monsters[i];
        const m = getFastMonsterById(sm.id);
        if (m) {
          const distM = Math.hypot((sm.x || 0) - (m.x ?? sm.x ?? 0), (sm.y || 0) - (m.y ?? sm.y ?? 0));
          m._interpSpeed = distM > 0.4 ? Math.max(0.45, Math.min(2.45, distM / 6.0)) : (m.isBoss ? 1.82 : 1.45);
          m.serverX = sm.x;
          m.serverY = sm.y;
          if (sm.hp !== undefined) m.hp = sm.hp;
          if (sm.maxHp !== undefined) m.maxHp = sm.maxHp;
          if (sm.mp !== undefined) m.mp = sm.mp;
          if (sm.maxMp !== undefined) m.maxMp = sm.maxMp;
          if (sm.isDead !== undefined) m.isDead = sm.isDead;
          if (sm.respawnTimer !== undefined) m.respawnTimer = sm.respawnTimer;
          m.stunUntil = sm.stunUntil || 0;
          m.defDownUntil = sm.defDownUntil || 0;
          if (m.isDead && m.nameTag) m.nameTag.visible = false;
        }
      }
      if (player.targetEntity?.type === 'MONSTER' && player.targetEntity.ref) {
        updateTopTargetUI(player.targetEntity.ref);
      }
    }

    if (Array.isArray(msg.players) || Array.isArray(msg.allCharIds)) {
      syncAuthoritativePlayersList(msg.players || [], Boolean(msg.playersDelta || msg.allCharIds), msg.allCharIds);
    }
    return;
  }

  // 4) 서버 권위 몬스터 피격 브로드캐스트 (같은 곳을 보는 모든 유저 화면에서 동시에 피깎임·타격이펙트·데미지 텍스트 표시!)
  if (msg.type === 'MONSTER_DAMAGED') {
    if (normalizeClientMapKey(msg.mapKey) !== normalizeClientMapKey(currentMapKey)) return;
    const ent = getFastMonsterById(msg.mobId);
    if (!ent) return;

    ent.hp = msg.hp;
    ent.maxHp = msg.maxHp;
    if (typeof msg.x === 'number') ent.serverX = msg.x;
    if (typeof msg.y === 'number') ent.serverY = msg.y;
    if (msg.stunUntil) ent.stunUntil = msg.stunUntil;
    if (msg.defDownUntil) ent.defDownUntil = msg.defDownUntil;

    const isMyAtk = msg.attackerCharId === activeCharacterId;
    if (msg.isMiss) {
      floatingTexts.push({ x: ent.x, y: ent.y - 35, text: `MISS!`, color: 0x9ca3af, life: 30 });
      return;
    }

    ent.lastHitTime = Date.now();
    ent.lastHitAngle = msg.hitAngle || 0;
    ent.lastHitCrit = Boolean(msg.isCrit);

    const isSkillHit = Boolean(msg.isSkill);
    if (isMyAtk) {
      SoundSystem.playPhysicalHit('monster', 'hit', Boolean(msg.isCrit));
      if (!msg.isMercAtk) {
        window.triggerCameraShake?.(msg.isCrit ? 4.8 : (isSkillHit ? 2.8 : 1.5), msg.isCrit ? 150 : 90);
      }
    }

    activeEffects.push({
      type: 'hit_particle',
      targetType: 'monster',
      x: ent.x,
      y: ent.y,
      hitAngle: msg.hitAngle || 0,
      hasDirection: true,
      dmgType: msg.dmgType || 'melee',
      isSkill: isSkillHit,
      isCrit: Boolean(msg.isCrit),
      life: msg.isCrit ? 28 : (isSkillHit ? 23 : 19),
      maxLife: msg.isCrit ? 28 : (isSkillHit ? 23 : 19)
    });

    const dmgKind = msg.isCrit ? 'crit' : (isSkillHit ? 'skill' : (msg.isMercAtk ? 'merc' : 'normal'));
    const dmgNumStr = Number(msg.dmg || 0).toLocaleString();
    const txtLabel = msg.isCrit
      ? `💥CRIT! -${dmgNumStr}`
      : (isSkillHit ? `✦ -${dmgNumStr}` : (msg.isMercAtk ? `⚔-${dmgNumStr}` : `-${dmgNumStr}`));
    const txtCol = msg.isCrit
      ? 0xfacc15
      : (msg.isMercAtk ? 0x34d399 : (isSkillHit ? (msg.dmgType === 'magic' ? 0x38bdf8 : 0xe879f9) : (msg.dmgType === 'magic' ? 0x7dd3fc : 0xfef08a)));
    const jitterX = (Math.random() - 0.5) * 14 + (msg.isMercAtk ? 14 : 0);
    floatingTexts.push({
      x: ent.x + jitterX,
      y: ent.y - (msg.isCrit ? 44 : 36),
      text: txtLabel,
      color: txtCol,
      dmgKind,
      fontSize: msg.isCrit ? 16.5 : (isSkillHit ? 14.5 : (msg.isMercAtk ? 11.5 : 13)),
      strokeColor: msg.isCrit ? '#7f1d1d' : '#000000',
      life: msg.isCrit ? 44 : 35,
      maxLife: msg.isCrit ? 44 : 35
    });

    // 내 공격일 경우 피흡/마나흡수 반영
    if (isMyAtk) {
      if (msg.drainHeal && msg.drainHeal > 0) {
        if (msg.isMercAtk && mercenary.hired && !mercenary.isDead) {
          mercenary.hp = Math.min(mercenary.maxHp, mercenary.hp + msg.drainHeal);
        } else {
          player.hp = Math.min(player.maxHp, player.hp + msg.drainHeal);
        }
      }
      if (msg.mpDrain && msg.mpDrain > 0 && !msg.isMercAtk) {
        player.mp = Math.min(player.maxMp, player.mp + msg.mpDrain);
      }
      updateStatusHUD();
    }

    if (player.targetEntity?.type === 'MONSTER' && player.targetEntity.ref === ent) {
      updateTopTargetUI(ent);
    }
    return;
  }

  // 5) 서버 권위 몬스터 사망 & 드롭 아이템 생성 브로드캐스트
  if (msg.type === 'MONSTER_KILLED') {
    if (normalizeClientMapKey(msg.mapKey) !== normalizeClientMapKey(currentMapKey)) return;
    const ent = monsterList.find(m => m.id === msg.mobId);
    if (ent) {
      ent.isDead = true;
      ent.hp = 0;
      ent.respawnTimer = msg.respawnTimer || (ent.isBoss ? 300 : 12);
      if (ent.nameTag) ent.nameTag.visible = false;
      if (mercenary.targetMonster === ent) mercenary.targetMonster = null;
      if (mercenary.attackerMonster === ent) mercenary.attackerMonster = null;
      if (player.lastHitByMonster === ent) player.lastHitByMonster = null;
      if (player.savedBossTarget === ent) player.savedBossTarget = null;

      if (msg.isGmSpawned) {
        if (ent.nameTag && ent.nameTag.parent) {
          ent.nameTag.parent.removeChild(ent.nameTag);
          ent.nameTag.destroy();
        }
        const mIdx = monsterList.indexOf(ent);
        if (mIdx > -1) monsterList.splice(mIdx, 1);
      }
    }

    SoundSystem.playMonsterDeath(msg.rawName || msg.mobName, msg.isBoss);
    if (msg.isBoss) {
      bossRespawnTimer = msg.bossRespawnTimer || 300;
      window.addChat(`🏆 [보스 토벌] '${msg.mobName}'을(를) 처치했습니다! (다음 보스 리스폰: 5분 후)`, 'log-kill');
    }

    // 서버가 생성한 드롭 아이템을 모든 유저의 바닥에 동일하게 배치
    if (Array.isArray(msg.newGroundItems)) {
      msg.newGroundItems.forEach(gIt => {
        if (!itemList.some(existing => existing.uid === gIt.uid)) {
          itemList.push({ ...gIt });
        }
      });
    }

    const isContributor = Array.isArray(msg.contributors) && msg.contributors.includes(activeCharacterId);
    const isKiller = msg.killerCharId === activeCharacterId;

    if (isContributor || isKiller) {
      const mName = msg.mobName || '';
      window.ImmersiveSystem?.onMonsterKilled?.(ent || { rawName: msg.rawName || mName, name: mName, isBoss: Boolean(msg.isBoss), lv: msg.mobLv || 1 }, 0);
      GameDB.Quests.forEach(q => {
        const st = player.quests[q.id];
        if (st && st.status === 'ACTIVE' && mName.includes(q.targetName)) {
          st.count = Math.min(q.reqCount, st.count + 1);
          window.renderQuestUI();
        }
      });

      const expGain = calcBalancedKillExp(msg.baseExp || 18, player.level || 1, msg.mobLv || ent?.lv || player.level, Boolean(msg.isBoss));
      floatingTexts.push({ x: msg.x || player.x, y: (msg.y || player.y) - 52, text: `EXP +${expGain}`, color: 0x38bdf8, life: 42 });
      gainExp(expGain);

      if (isKiller && msg.droppedGold && msg.droppedGold > 0) {
        player.gold += msg.droppedGold;
        floatingTexts.push({ x: msg.x || player.x, y: (msg.y || player.y) - 45, text: `+${Number(msg.droppedGold).toLocaleString()} G`, color: 0xfacc15, life: 38 });
      }
      updateStatusHUD();
      window.triggerAutoSave?.(msg.isBoss ? 'boss_kill' : 'mob_kill', Boolean(msg.isBoss));
    }

    if (ent && player.targetEntity && player.targetEntity.ref === ent) {
      if (player.savedBossTarget && !player.savedBossTarget.isDead) {
        const resumeBoss = player.savedBossTarget;
        player.savedBossTarget = null;
        player.targetEntity = { type: 'MONSTER', ref: resumeBoss };
        updateTopTargetUI(resumeBoss);
      } else {
        window.clearTarget();
      }
    }
    return;
  }

  // 6) 서버 권위 몬스터 리스폰 & GM 몬스터 소환 & GM 학살 동기화
  if (msg.type === 'MONSTER_RESPAWNED') {
    if (normalizeClientMapKey(msg.mapKey) !== normalizeClientMapKey(currentMapKey)) return;
    const sm = msg.monster;
    if (!sm) return;
    if (typeof msg.bossRespawnTimer === 'number') bossRespawnTimer = msg.bossRespawnTimer;
    const ent = monsterList.find(m => m.id === sm.id);
    if (ent) {
      ent.isDead = false;
      ent.hp = sm.hp;
      ent.maxHp = sm.maxHp;
      ent.mp = sm.mp;
      ent.maxMp = sm.maxMp;
      ent.x = sm.x;
      ent.y = sm.y;
      ent.serverX = sm.x;
      ent.serverY = sm.y;
      ent.stunUntil = 0;
      ent.defDownUntil = 0;
      if (ent.isBoss) {
        window.addChat(`👑 [보스 출현] '${ent.name}'이(가) 성역에 다시 나타났습니다!`, 'log-kill');
      }
    }
    return;
  }

  if (msg.type === 'MONSTERS_SPAWNED' && Array.isArray(msg.monsters)) {
    if (normalizeClientMapKey(msg.mapKey) !== normalizeClientMapKey(currentMapKey)) return;
    msg.monsters.forEach(sm => {
      if (monsterList.some(m => m.id === sm.id)) return;
      const baseMob = (GameDB.Monsters || []).find(bm => bm.id === sm.mobId || bm.name === sm.name) || sm;
      const created = createMonsterInstance(sm.id, baseMob, sm.x, sm.y, sm.isBoss);
      Object.assign(created, sm, { serverX: sm.x, serverY: sm.y });
      monsterList.push(created);
      activeEffects.push({ type: 'buff', x: sm.x, y: sm.y, life: 30, maxLife: 30, skillName: '소환' });
    });
    return;
  }

  if (msg.type === 'GM_MASS_KILL') {
    if (normalizeClientMapKey(msg.mapKey) !== normalizeClientMapKey(currentMapKey)) return;
    if (typeof msg.bossRespawnTimer === 'number') bossRespawnTimer = msg.bossRespawnTimer;
    monsterList.forEach(m => {
      if (!m.isDead) {
        m.isDead = true;
        m.hp = 0;
        if (m.nameTag) m.nameTag.visible = false;
        activeEffects.push({ type: 'wizard', x: m.x, y: m.y, life: 28, maxLife: 28, skillName: '라이트닝', isAoe: true, aoeRadius: 90 });
      }
    });
    if (Array.isArray(msg.newGroundItems)) {
      msg.newGroundItems.forEach(gIt => {
        if (!itemList.some(e => e.uid === gIt.uid)) itemList.push({ ...gIt });
      });
    }
    if (msg.killerCharId === activeCharacterId) {
      if (msg.totalExp > 0) gainExp(msg.totalExp);
      if (msg.totalGold > 0) player.gold += msg.totalGold;
      updateStatusHUD();
      window.triggerAutoSave?.('gm_mass_kill', true);
    }
    window.clearTarget();
    return;
  }

  // 7) 서버 권위 몬스터 공격 & 보스 장판 예고/폭발 동기화
  if (msg.type === 'MONSTER_ATTACK_EVENT') {
    if (normalizeClientMapKey(msg.mapKey) !== normalizeClientMapKey(currentMapKey)) return;
    const m = monsterList.find(mob => mob.id === msg.mobId);
    if (m) {
      m.lastAtkTime = Date.now();
      m.atkAngle = msg.atkAngle || 0;
    }
    const mx = m ? m.x : msg.x;
    const my = m ? m.y : msg.y;

    if (msg.isMagic || msg.isBoss) {
      activeEffects.push({
        type: 'magic_circle',
        x: mx,
        y: my + 11,
        casterRef: m || { x: mx, y: my },
        aoeRadius: msg.isBoss ? 92 : 54,
        isBossCircle: Boolean(msg.isBoss),
        life: 55,
        maxLife: 55,
        skillName: msg.skillName || '보스 심연 마법진'
      });
    }

    // 타 플레이어가 맞는 경우 타격 파티클만 표시
    if (msg.targetCharId !== activeCharacterId) {
      const op = (window.otherPlayers || []).find(o => o && o.charId === msg.targetCharId);
      if (op) {
        activeEffects.push({
          type: 'hit_particle',
          targetType: 'player',
          x: op.x,
          y: op.y,
          hitAngle: msg.atkAngle || 0,
          hasDirection: true,
          dmgType: msg.isMagic ? 'magic' : 'melee',
          isCrit: Boolean(msg.isBoss),
          life: 20,
          maxLife: 20
        });
      }
      return;
    }

    // 내 용병이 피격된 경우
    const now = Date.now();
    if (msg.targetType === 'mercenary' && mercenary.hired && !mercenary.isDead) {
      if (msg.gmBlocked || player.gmInvincible || player.isInvincible) return;
      if (m) mercenary.attackerMonster = m;
      mercenary.lastCombatTime = now;
      const ms = calculateMercCombatStats();
      const lvGap = Math.max(0, (msg.mobLv || 1) - mercenary.level);
      const rawMobAtk = (msg.mobAtk || 10) * (msg.isMagic ? 1.1 : 1.0) * (1 + lvGap * 0.10);
      let dmg = calcMonsterDamageToDefender(rawMobAtk, ms.totalDef, msg.mobLv || 1, msg.isBoss, ms.dmgReducePct, ms.bossDmgReducePct, false, Boolean(msg.isMagic), ms.totalMDef || 0);
      if ((mercenary.activeBuffs?.IMMUNE || 0) > 0) dmg = Math.max(2, Math.floor(dmg * 0.55));
      mercenary.hp = Math.max(0, mercenary.hp - dmg);
      mercenary.lastHitTime = now;
      mercenary.lastHitAngle = (m?.atkAngle ?? msg?.atkAngle ?? 0);
      activeEffects.push({
        type: 'hit_particle',
        targetType: 'mercenary',
        x: mercenary.x,
        y: mercenary.y,
        hitAngle: msg.atkAngle || 0,
        hasDirection: true,
        dmgType: msg.isMagic ? 'magic' : 'melee',
        isCrit: Boolean(msg.isBoss),
        life: 20,
        maxLife: 20
      });
      floatingTexts.push({ x: mercenary.x, y: mercenary.y - 40, text: `-${dmg}`, color: 0xfb923c, life: 28 });
      if (mercenary.hp <= 0) {
        mercenary.isDead = true;
        mercenary.targetMonster = null;
        mercenary.attackerMonster = null;
        window.addChat(`💀 [용병 전사] '${mercenary.name}' 용병이 전투 불능 상태가 되었습니다!`, 'log-hit');
      }
      window.updateMercHUD();
      return;
    }

    // 내 캐릭터가 피격된 경우
    if (msg.gmBlocked || player.gmInvincible || player.isInvincible) {
      floatingTexts.push({ x: player.x, y: player.y - 45, text: `🛡️ GM 무적!`, color: 0xfacc15, life: 28 });
      return;
    }

    player.lastCombatTime = now;
    if (m) {
      player.lastHitByMonster = m;
      player.lastHitByTime = now;
      const isLockedPartyFocus = Boolean(
        window.isAutoAttack &&
        window.partyState &&
        window.partyState.leaderCharId &&
        window.partyState.leaderCharId !== activeCharacterId &&
        (window.partyAutoHuntMode || window.partyState.partyMode) === 'FOCUS' &&
        player.targetEntity?.type === 'MONSTER' &&
        player.targetEntity.ref &&
        !player.targetEntity.ref.isDead
      );
      if (!player.manualMoving && !isLockedPartyFocus) {
        const curTargetMob = (player.targetEntity?.type === 'MONSTER' && !player.targetEntity.ref?.isDead) ? player.targetEntity.ref : null;
        if (!curTargetMob) {
          player.targetEntity = { type: 'MONSTER', ref: m };
          updateTopTargetUI(m);
        } else if (curTargetMob !== m && curTargetMob.isBoss && !m.isBoss) {
          player.savedBossTarget = curTargetMob;
          player.targetEntity = { type: 'MONSTER', ref: m };
          player.path = [];
          updateTopTargetUI(m);
        }
      }
    }

    const cStats = calculateCombatStats(false);
    if (player.activeBuffs.COUNTER > 0 && m) {
      player.activeBuffs.COUNTER = 0;
      floatingTexts.push({ x: player.x, y: player.y - 45, text: `⚔️ COUNTER!`, color: 0xfacc15, life: 32 });
      window.broadcastMultiplayerActionFx?.('combat_react', { reactType: 'counter', x: Math.round(player.x), y: Math.round(player.y) });
      window.applyDamage(m, Math.floor(cStats.totalAtk * 2.5), 'melee', { attacker: 'player', forceCrit: true });
      return;
    }
    if (player.activeBuffs.ABSOLUTE_BARRIER > 0) {
      floatingTexts.push({ x: player.x, y: player.y - 45, text: `🌟 IMMUNE!`, color: 0xfde047, life: 30 });
      return;
    }

    const lvGap = Math.max(0, (msg.mobLv || 1) - player.level);
    const effEvade = Math.max(2, cStats.evadeRate - lvGap * 3);
    const effBlock = Math.max(0, cStats.blockRate - lvGap * 2);

    if (Math.random() * 100 < effEvade) {
      SoundSystem.playPhysicalHit(player.class, 'dodge');
      floatingTexts.push({ x: player.x, y: player.y - 45, text: `💨 DODGE!`, color: 0x38bdf8, life: 30 });
      window.broadcastMultiplayerActionFx?.('combat_react', { reactType: 'dodge', x: Math.round(player.x), y: Math.round(player.y) });
    } else if (Math.random() * 100 < effBlock) {
      SoundSystem.playPhysicalHit(player.class, 'block');
      player.blockTime = now + 400;
      floatingTexts.push({ x: player.x, y: player.y - 45, text: `🛡️ BLOCK!`, color: 0xfacc15, life: 30 });
      window.broadcastMultiplayerActionFx?.('combat_react', { reactType: 'block', x: Math.round(player.x), y: Math.round(player.y) });
    } else {
      SoundSystem.playPhysicalHit(player.class, 'hit');
      const rawMobAtk = (msg.mobAtk || 10) * (msg.isMagic ? 1.12 : 1.0) * (1 + lvGap * 0.11);
      let dmg = calcMonsterDamageToDefender(rawMobAtk, cStats.totalDef, msg.mobLv || 1, msg.isBoss, cStats.dmgReducePct, cStats.bossDmgReducePct, true, Boolean(msg.isMagic), cStats.totalMDef || 0);
      if (player.activeBuffs.IMMUNE > 0) dmg = Math.max(2, Math.floor(dmg * 0.55));
      if (player.activeBuffs.MANA_SHIELD > 0 && player.mp >= Math.ceil(dmg * 0.5)) {
        const mpAbsorb = Math.floor(dmg * 0.5);
        player.mp -= mpAbsorb;
        dmg -= mpAbsorb;
      }
      player.hp = Math.max(0, player.hp - dmg);
      player.lastHitTime = now;
      player.lastHitAngle = (m?.atkAngle ?? msg?.atkAngle ?? 0);
      window.triggerCameraShake?.(2.2, 95);
      activeEffects.push({
        type: 'hit_particle',
        targetType: 'player',
        x: player.x,
        y: player.y,
        hitAngle: msg.atkAngle || 0,
        hasDirection: true,
        dmgType: msg.isMagic ? 'magic' : 'melee',
        isCrit: Boolean(msg.isBoss),
        life: 22,
        maxLife: 22
      });
      floatingTexts.push({ x: player.x, y: player.y - 40, text: `-${dmg}`, color: 0xf87171, life: 30 });
      updateStatusHUD();

      if (player.hp <= 0) {
        player.hp = player.maxHp;
        player.mp = player.maxMp;
        window.addChat(`💀 [사망] 전투 불능 상태가 되어 마을 정중앙 안전지대로 후송되었습니다.`, 'log-hit');
        useReturnScroll();
        updateStatusHUD();
      }
    }
    return;
  }

  if (msg.type === 'BOSS_TELEGRAPH_START') {
    if (normalizeClientMapKey(msg.mapKey) !== normalizeClientMapKey(currentMapKey)) return;
    const boss = monsterList.find(m => m.id === msg.bossId);
    bossTelegraphs.push({
      boss: boss || { isDead: false, lv: 50, atk: 200 },
      x: msg.x,
      y: msg.y,
      radius: msg.radius || 165,
      startTime: Date.now(),
      duration: msg.duration || 1500
    });
    activeEffects.push({
      type: 'magic_circle',
      x: msg.bossX || msg.x,
      y: (msg.bossY || msg.y) + 6,
      aoeRadius: 115,
      isBossCircle: true,
      life: 90,
      maxLife: 90,
      skillName: '보스 심연 마법진'
    });
    activeEffects.push({
      type: 'boss_telegraph',
      x: msg.x,
      y: msg.y,
      aoeRadius: msg.radius || 165,
      life: 90,
      maxLife: 90
    });
    SoundSystem.playSkill('카오스 필드', 'wizard', 6, true);
    floatingTexts.push({ x: msg.bossX || msg.x, y: (msg.bossY || msg.y) - 62, text: `⚠️ 보스 광역기 예고! (1.5초)`, color: 0xf43f5e, life: 45 });
    return;
  }

  if (msg.type === 'BOSS_TELEGRAPH_EXPLODE') {
    if (normalizeClientMapKey(msg.mapKey) !== normalizeClientMapKey(currentMapKey)) return;
    bossTelegraphs = [];
    SoundSystem.playSkill('미티어 스웜', 'wizard', 6, false);
    activeEffects.push({
      type: 'wizard',
      x: msg.x,
      y: msg.y,
      life: 38,
      maxLife: 38,
      skillName: '카오스 필드',
      isAoe: true,
      aoeRadius: msg.radius || 165
    });

    const inSafe = isInsideSafeZone(player.x, player.y);
    if (!inSafe && Math.hypot(player.x - msg.x, player.y - msg.y) <= (msg.radius || 165)) {
      if (player.gmInvincible || player.isInvincible || player.activeBuffs.ABSOLUTE_BARRIER > 0) {
        floatingTexts.push({ x: player.x, y: player.y - 48, text: `🌟 무적방어!`, color: 0xfde047, life: 32 });
      } else {
        const cStats = calculateCombatStats(false);
        const lvGap = Math.max(0, (msg.bossLv || 1) - player.level);
        const rawBossAoe = (msg.bossAtk || 100) * 1.48 * (1 + lvGap * 0.10);
        let aoeDmg = calcMonsterDamageToDefender(rawBossAoe, cStats.totalDef, msg.bossLv || 1, true, cStats.dmgReducePct, cStats.bossDmgReducePct, true, true, cStats.totalMDef || 0);
        if (player.activeBuffs.IMMUNE > 0) aoeDmg = Math.max(5, Math.floor(aoeDmg * 0.55));
        player.hp = Math.max(0, player.hp - aoeDmg);
        SoundSystem.playPhysicalHit(player.class, 'hit');
        floatingTexts.push({ x: player.x, y: player.y - 48, text: `💥광역피격 -${aoeDmg}`, color: 0xef4444, life: 38 });
        updateStatusHUD();
        if (player.hp <= 0) {
          player.hp = player.maxHp;
          player.mp = player.maxMp;
          window.addChat(`💀 [사망] 보스의 광역 마법에 휩쓸려 마을 안전지대로 후송되었습니다.`, 'log-hit');
          useReturnScroll();
        }
      }
    }
    return;
  }

  // 8) 바닥 아이템 루팅 확정 및 제거/추가 동기화
  if (msg.type === 'ITEM_PICKUP_CONFIRMED' && msg.item) {
    awardPickedItemToPlayer(msg.item);
    return;
  }

  if (msg.type === 'GROUND_ITEM_REMOVED' && msg.itemUid) {
    const idx = itemList.findIndex(it => it.uid === msg.itemUid);
    if (idx > -1) {
      destroyItemGraphics(itemList[idx]);
      itemList.splice(idx, 1);
    }
    return;
  }

  if (msg.type === 'GROUND_ITEM_ADDED' && msg.item) {
    if (normalizeClientMapKey(msg.mapKey) === normalizeClientMapKey(currentMapKey)) {
      if (!itemList.some(it => it.uid === msg.item.uid)) {
        itemList.push({ ...msg.item });
      }
    }
    return;
  }

  if (msg.type === 'GROUND_ITEMS_SYNC' && Array.isArray(msg.groundItems)) {
    if (normalizeClientMapKey(msg.mapKey) === normalizeClientMapKey(currentMapKey)) {
      syncAuthoritativeGroundItems(msg.groundItems);
    }
    return;
  }

  // 9) 운영자(GM) 권한 상태 및 명령어 효과 처리
  if (msg.type === 'ADMIN_MODE_CHANGED') {
    applyAdminModeState(msg.isAdmin, msg);
    return;
  }

  if (msg.type === 'SERVER_SYS_MSG') {
    window.addChat(msg.text, msg.logClass || 'log-sys', msg.logClass === 'log-kill' ? 'gm' : 'sys');
    return;
  }

  if (msg.type === 'CLEAR_CHAT_BOX') {
    const cb = document.getElementById('chat-box');
    if (cb) cb.innerHTML = '';
    return;
  }

  if (msg.type === 'GM_NOTICE') {
    showGmNoticeBanner(msg.sender || 'GM', msg.text || '');
    window.addChat(`📢 [운영자 공지 - ${msg.sender || 'GM'}] ${msg.text}`, 'log-gm', 'gm');
    return;
  }

  if (msg.type === 'GM_TELEPORT') {
    const destMap = msg.mapKey || currentMapKey;
    const tx = Number(msg.x) || 2000;
    const ty = Number(msg.y) || 14250;
    if (normalizeClientMapKey(destMap) !== normalizeClientMapKey(currentMapKey)) {
      loadMapData(destMap, { x: tx, y: ty });
    } else {
      const safePt = findSafeSpot(tx, ty);
      player.x = safePt.x;
      player.y = safePt.y;
      player.targetX = safePt.x;
      player.targetY = safePt.y;
      player.path = [];
      player.isMoving = false;
      if (mercenary.hired && !mercenary.isDead) {
        mercenary.x = safePt.x - 45;
        mercenary.y = safePt.y + 25;
      }
      activeEffects.push({ type: 'buff', x: player.x, y: player.y, life: 30, maxLife: 30, skillName: '텔레포트' });
    }
    window.addChat(`🌀 [공간 이동] ${msg.label || destMap} 위치로 이동했습니다.`, 'log-kill', 'gm');
    window.triggerAutoSave?.('gm_teleport', true);
    return;
  }

  if (msg.type === 'GM_KICKED') {
    window.showSystemAlertModal('🚫 서버 접속 종료', msg.reason || '운영자에 의해 접속이 종료되었습니다.');
    window.returnToCharacterSelect?.();
    return;
  }

  if (msg.type === 'GM_DIRECT_MOD') {
    const act = msg.action;
    if (act === 'FULL_RECOVERY') {
      recalcMaxHpMp(false);
      player.hp = player.maxHp;
      player.mp = player.maxMp;
      if (mercenary.hired) {
        mercenary.isDead = false;
        mercenary.hp = mercenary.maxHp;
        mercenary.mp = mercenary.maxMp;
      }
      activeEffects.push({ type: 'buff', x: player.x, y: player.y, life: 35, maxLife: 35, skillName: '그레이트 힐' });
      floatingTexts.push({ x: player.x, y: player.y - 52, text: `👑 완전 회복!`, color: 0x4ade80, life: 40 });
    } else if (act === 'SET_LEVEL') {
      const newLv = Math.max(1, Math.min(999, Number(msg.value) || 1));
      player.level = newLv;
      player.exp = 0;
      player.maxExp = calcRequiredExpForLevel(player.level);
      player.statPoints = Math.max(player.statPoints, (newLv - 1) * 3);
      recalcMaxHpMp(false);
      player.hp = player.maxHp;
      player.mp = player.maxMp;
      if (mercenary.hired) {
        mercenary.level = newLv;
        syncMercStats(true);
      }
      floatingTexts.push({ x: player.x, y: player.y - 60, text: `👑 Lv.${newLv} 달성!`, color: 0xfacc15, life: 55 });
    } else if (act === 'ADD_EXP') {
      gainExp(Number(msg.value) || 100);
    } else if (act === 'ADD_GOLD') {
      player.gold = Math.max(0, player.gold + (Number(msg.value) || 0));
      floatingTexts.push({ x: player.x, y: player.y - 50, text: `💰 +${Number(msg.value).toLocaleString()} G`, color: 0xfacc15, life: 45 });
    } else if (act === 'SET_STAT') {
      const st = String(msg.statType || '').toUpperCase();
      const v = Math.max(1, Number(msg.value) || 10);
      if (st === '힘' || st === 'STR') player.stats.STR = v;
      else if (st === '민첩' || st === 'DEX') player.stats.DEX = v;
      else if (st === '지능' || st === 'INT') player.stats.INT = v;
      else if (st === '체력' || st === 'CON') player.stats.CON = v;
      else if (st === '올스탯' || st === 'ALL' || st === '전체') {
        player.stats = { STR: v, DEX: v, INT: v, CON: v };
      }
      recalcMaxHpMp(true);
      window.addChat(`👑 [GM 스탯 설정] 스탯(${st})이 ${v}(으)로 적용되었습니다!`, 'log-kill', 'gm');
    } else if (act === 'ADD_STAT_POINTS') {
      player.statPoints = Math.max(0, (player.statPoints || 0) + (Number(msg.value) || 0));
      window.addChat(`👑 [GM 스탯포인트] 잔여 스탯 포인트가 ${player.statPoints}점으로 설정되었습니다.`, 'log-kill', 'gm');
    } else if (act === 'RESET_STATS') {
      const bStats = CLASS_STATS[player.class]?.fixedBaseStats || { str: 10, dex: 5, int: 5, con: 5 };
      player.stats = { STR: bStats.str, DEX: bStats.dex, INT: bStats.int, CON: bStats.con };
      player.statPoints = (player.level - 1) * (bStats.statPerLv || 3);
      recalcMaxHpMp(true);
      window.addChat(`👑 [GM 스탯초기화] 모든 투자 스탯이 초기화되었습니다. (잔여 포인트: ${player.statPoints})`, 'log-kill', 'gm');
    } else if (act === 'LEARN_ALL_SKILLS') {
      const allSk = SKILLS_DB[player.class] || [];
      allSk.forEach(s => player.learnedSkills.add(s.id));
      recalcMaxHpMp(true);
      if (!document.getElementById('skill-ui').classList.contains('hidden')) window.renderSkills('active');
      window.addChat(`👑 [GM 올스킬 마스터] 현재 클래스의 모든 서클(${allSk.length}종) 스킬을 영구 습득했습니다!`, 'log-kill', 'gm');
    } else if (act === 'CHANGE_CLASS') {
      const newCls = msg.value || 'knight';
      player.class = newCls;
      document.getElementById('class-icon').innerHTML = window.getClassIconHTML ? window.getClassIconHTML(newCls, 26) : (CLASS_STATS[newCls]?.icon || '🛡️');
      window.initDefaultLearnedSkills(newCls);
      const allSk = SKILLS_DB[newCls] || [];
      allSk.forEach(s => player.learnedSkills.add(s.id));
      recalcMaxHpMp(true);
      window.addChat(`👑 [GM 직업 변경] 클래스가 '${CLASS_STATS[newCls]?.name}'(으)로 변경되었습니다!`, 'log-kill', 'gm');
    } else if (act === 'FULL_BUFFS') {
      const dur = 600000;
      ['HASTE', 'SHIELD', 'ENCHANT_STAT', 'ADV_SPIRIT', 'EAGLE_EYE', 'ELIXIR', 'IMMUNE', 'HOLY_WALK', 'SHADOW_FANG'].forEach(k => {
        player.activeBuffs[k] = dur;
      });
      recalcMaxHpMp(true);
      window.updateBuffUI();
      activeEffects.push({ type: 'buff', x: player.x, y: player.y, life: 36, maxLife: 36, skillName: '어드밴스드 스피릿' });
      floatingTexts.push({ x: player.x, y: player.y - 52, text: `✨ GM 축복 풀버프!`, color: 0xfacc15, life: 45 });
    } else if (act === 'GIVE_ITEM' && msg.item) {
      const inst = msg.item;
      giveItem(inst.type, inst.qty || 1, inst.gradeIdx ?? null, inst);
      if (!document.getElementById('inventory-ui').classList.contains('hidden')) renderInventory();
    } else if (act === 'ENCHANT_ALL_EQUIP') {
      const plusVal = Number(msg.value) || 10;
      Object.values(player.equip).forEach(slotIdx => {
        if (slotIdx !== null && slotIdx !== undefined && player.inventory[slotIdx]) {
          player.inventory[slotIdx].plus = plusVal;
        }
      });
      player.weaponPlus = plusVal;
      player.armorPlus = plusVal;
      recalcMaxHpMp(true);
      if (!document.getElementById('inventory-ui').classList.contains('hidden')) renderInventory();
    } else if (act === 'CLEAR_INVENTORY') {
      const eqSet = new Set(Object.values(player.equip).filter(v => v !== null && v !== undefined).map(Number));
      for (let i = 0; i < player.inventory.length; i++) {
        if (!eqSet.has(i)) player.inventory[i] = null;
      }
      if (!document.getElementById('inventory-ui').classList.contains('hidden')) renderInventory();
      window.addChat(`🧹 [GM 가방비우기] 장착 중인 장비를 제외한 가방 아이템을 모두 비웠습니다.`, 'log-kill', 'gm');
    }

    if (!document.getElementById('equip-ui').classList.contains('hidden')) renderEquipUI();
    updateStatusHUD();
    window.updateMercHUD?.();
    window.triggerAutoSave?.('gm_direct_mod', true);
    return;
  }

  // 10) 타 플레이어(및 타 플레이어 용병)의 스킬·마법·화살 투사체·하늘 낙하 마법·직선 빔·마법진 100% 동기화
  if (msg.type === 'REMOTE_SKILL_EFFECT' && msg.charId !== activeCharacterId && (!msg.mapKey || normalizeClientMapKey(msg.mapKey) === normalizeClientMapKey(currentMapKey))) {
    const remSkillName = String(msg.skillName || '매직 미사일');
    const remCircleLv = Number(msg.circleLv) || 1;
    const op = (window.otherPlayers || []).find(o => o && o.charId === msg.charId);
    const cClass = msg.casterClass || (msg.isMerc ? op?.mercenary?.class : op?.class) || 'wizard';
    const casterEnt = msg.isMerc ? (op?.mercenary || null) : (op || null);
    const sx = Number(msg.casterX ?? msg.sx) || (casterEnt ? casterEnt.x : (op ? op.x : player.x));
    const sy = Number(msg.casterY ?? msg.sy) || (casterEnt ? casterEnt.y : (op ? op.y : player.y));
    const originX = Number(msg.startX) || sx;
    const originY = Number(msg.startY) || sy;
    const tx = Number(msg.tx) || sx;
    const ty = Number(msg.ty) || sy;

    if (msg.isMerc && op && op.mercenary) {
      op.mercenary.lastAttackTime = Date.now();
      op.mercenary.dir = (tx >= sx) ? 'right' : 'left';
    } else if (op && !msg.isMerc) {
      op.lastAttackTime = Date.now();
      op.spriteFrame = 0;
      op.lastSpriteFrameTime = Date.now();
      const dx = tx - originX;
      const dy = ty - originY;
      if (Math.abs(dx) > 1 || Math.abs(dy) > 1) {
        if (Math.abs(dx) > Math.abs(dy)) op.dir = dx > 0 ? 'right' : 'left';
        else op.dir = dy > 0 ? 'down' : 'up';
      }
      if (remSkillName.includes('차지')) {
        op.x = sx;
        op.y = sy;
        op.serverX = sx;
        op.serverY = sy;
      }
    }

    // 화면 시야 근처일 때 상대방 스킬 효과음도 현장감 있게 재생
    if (Math.hypot(sx - player.x, sy - player.y) <= 950) {
      SoundSystem.playSkill?.(remSkillName, cClass, remCircleLv, false);
    }

    const isRemNonCombat = remSkillName.includes('힐') || remSkillName.includes('큐어') || (remSkillName.includes('실드') && !remSkillName.includes('스트라이크')) || remSkillName.includes('배리어') || remSkillName.includes('텔레포트') || remSkillName.includes('헤이스트') || remSkillName.includes('스킨') || remSkillName.includes('스피릿') || remSkillName.includes('워크') || remSkillName.includes('이뮨') || remSkillName.includes('뮨');
    if (!isRemNonCombat && remCircleLv >= 3) {
      activeEffects.push({
        type: 'magic_circle',
        x: sx,
        y: sy + 2,
        casterRef: casterEnt,
        aoeRadius: 54 + remCircleLv * 12,
        circleLv: remCircleLv,
        dmgMult: Number(msg.dmgMult) || 1.8,
        dmgAmount: Number(msg.dmgAmount) || 350,
        isBossCircle: false,
        life: 58 + remCircleLv * 6,
        maxLife: 58 + remCircleLv * 6,
        skillName: remSkillName
      });
    }

    const isRangedSkill = (cClass === 'ranger' || cClass === 'wizard') && !isRemNonCombat;
    const aoeR = msg.isAoe ? (145 + remCircleLv * 10) : 68;

    if (isRangedSkill) {
      const castAngle = Math.atan2(ty - sy, tx - sx);
      if (remSkillName.includes("콜드 빔") || remSkillName.includes("데스 레이") || remSkillName.includes("콘 오브 콜드")) {
        activeEffects.push({
          type: 'wizard',
          x: tx, y: ty,
          startX: sx, startY: sy - 18,
          casterRef: casterEnt,
          angle: castAngle,
          life: 32, maxLife: 32,
          skillName: remSkillName,
          isAoe: Boolean(msg.isAoe),
          aoeRadius: aoeR
        });
      }
      const isSkySpell = Boolean(
        msg.skyDrop ||
        remSkillName.includes("라이트닝") ||
        remSkillName.includes("썬더 볼트") ||
        remSkillName.includes("메테오") ||
        remSkillName.includes("미티어") ||
        remSkillName.includes("아이스 스톰") ||
        remSkillName.includes("블리자드") ||
        remSkillName.includes("앱솔루트 제로") ||
        remSkillName.includes("둠") ||
        remSkillName.includes("워드 오브 데스") ||
        remSkillName.includes("카오스 필드") ||
        remSkillName.includes("애로우 레인")
      );
      const camTopY = (typeof camera !== 'undefined' && typeof camera.y === 'number') ? (camera.y - 95) : (ty - 520);
      const skyStartY = Math.min(camTopY, ty - 460);
      const skyOffsetX = (remSkillName.includes("메테오") || remSkillName.includes("미티어")) ? 95 : 0;
      const projStartX = isSkySpell ? (tx + skyOffsetX) : sx;
      const projStartY = isSkySpell ? skyStartY : (sy - 15);
      const targetMob = (msg.mobId && monsterList.find(m => m.id === msg.mobId && !m.isDead)) ||
        monsterList.find(m => !m.isDead && Math.hypot(m.x - tx, m.y - ty) <= 75) ||
        { x: tx, y: ty, isDead: false };

      projectiles.push({
        x: projStartX, y: projStartY,
        startX: projStartX, startY: projStartY,
        lastTargetX: targetMob.x ?? tx,
        lastTargetY: targetMob.y ?? ty,
        isSkyDrop: isSkySpell,
        skyTotalDist: isSkySpell ? Math.max(180, Math.hypot(tx - projStartX, (ty - 15) - projStartY)) : 0,
        casterRef: casterEnt || { x: sx, y: sy },
        target: targetMob,
        speed: isSkySpell ? 24 : 15,
        type: cClass === 'ranger' ? 'arrow' : 'magic',
        dmg: 0,
        visualOnly: true,
        skillName: remSkillName,
        isAoe: Boolean(msg.isAoe),
        aoeRadius: aoeR
      });
    } else {
      const castAng = Math.atan2(ty - originY, tx - originX);
      activeEffects.push({
        type: cClass,
        x: tx,
        y: ty,
        startX: originX,
        startY: originY,
        angle: castAng,
        casterRef: casterEnt,
        life: msg.isAoe ? 36 : 32,
        maxLife: msg.isAoe ? 36 : 32,
        skillName: remSkillName,
        isAoe: Boolean(msg.isAoe),
        aoeRadius: aoeR
      });
    }
    return;
  }

  // 11) 타 플레이어가 나에게 시전한 힐/버프 실시간 적용
  if (msg.type === 'REMOTE_ALLY_SUPPORT' && msg.targetCharId === activeCharacterId) {
    if (msg.healAmt && msg.healAmt > 0) {
      player.hp = Math.min(player.maxHp, player.hp + msg.healAmt);
      floatingTexts.push({ x: player.x, y: player.y - 48, text: `💚+${msg.healAmt} HP (${msg.casterName})`, color: 0x4ade80, life: 36 });
      activeEffects.push({ type: 'buff', x: player.x, y: player.y, targetRef: player, life: 32, maxLife: 32, skillName: msg.skillName || '힐링' });
      window.addChat(`🌿 [동료 치유] '${msg.casterName}'님이 ${msg.skillName || '힐링'}으로 HP를 ${msg.healAmt} 회복시켜 주었습니다!`, 'log-sys');
      updateStatusHUD();
    } else if (msg.buffKey) {
      const durMs = msg.durMs || 180000;
      player.activeBuffs[msg.buffKey] = Math.min(3600000, Math.max(0, player.activeBuffs[msg.buffKey] || 0) + durMs);
      recalcMaxHpMp(true);
      floatingTexts.push({ x: player.x, y: player.y - 48, text: `✨${msg.skillName}!`, color: 0xfde047, life: 36 });
      activeEffects.push({ type: 'buff', x: player.x, y: player.y, targetRef: player, life: 32, maxLife: 32, skillName: msg.skillName || '쉴드' });
      window.addChat(`✨ [동료 버프] '${msg.casterName}'님이 '${msg.skillName}' 버프를 부여했습니다!`, 'log-sys');
      window.updateBuffUI();
      updateStatusHUD();
    }
    return;
  }

  // 12) 멀티플레이 실시간 채팅 수신 및 현재 지역 플레이어 머리 위 말풍선 브로드캐스트 표시
  if (msg.type === 'MOBILE_BG_SERVER_LOGOUT') {
    if (!msg.charId || msg.charId === activeCharacterId) {
      window.executeMobileBgLogoutToCharSelect?.();
    }
    return;
  }

  if (msg.type === 'REMOTE_CHAT') {
    let logClass = 'log-chat';
    let cat = 'chat';
    if (msg.chatStyle === 'party') { logClass = 'log-party'; cat = 'party'; }
    else if (msg.chatStyle === 'whisper') { logClass = 'log-whisper'; cat = 'whisper'; }
    else if (msg.chatStyle === 'world') { logClass = 'log-world'; cat = 'chat'; }
    else if (msg.isAdmin) { logClass = 'log-gm'; cat = 'chat'; }
    window.addChat(`💬 [${msg.sender || '모험가'}] ${msg.text}`, logClass, cat);

    if (msg.chatStyle !== 'whisper') {
      const bubbleStr = msg.bubbleText || msg.text || '';
      if (msg.charId && msg.charId === activeCharacterId) {
        window.setEntitySpeechBubble(player, bubbleStr, 4800);
      } else if (Array.isArray(window.otherPlayers)) {
        const speaker = window.otherPlayers.find(o => o && ((msg.charId && o.charId === msg.charId) || o.name === msg.sender));
        if (speaker) {
          window.setEntitySpeechBubble(speaker, bubbleStr, 4800);
        }
      }
    }
  }
}