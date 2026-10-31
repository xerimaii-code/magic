/**
 * redis_sync_manager.js
 * ============================================================================
 * [Supabase(PostgreSQL) 디스크 I/O 극한 최적화 모듈]
 * - Redis 중간 캐시 기반 지연 동기화(Lazy Sync) + 일괄 배치(Bulk Upsert) 워커
 *
 * [핵심 아키텍처]
 * 1. 실시간 상태 업데이트 (Redis 전용 - Supabase 호출 0회)
 *    - 캐릭터/AI 상태 변경 시 `SET agent_state:{id}` (JSON 직렬화)
 *    - 변경된 캐릭터 ID를 `SADD dirty_agents {id}`로 저장 대상 표시
 *    - Redis Pipeline(multi/exec)을 사용해 RTT(왕복 지연) 최소화
 *
 * 2. 백그라운드 배치 동기화 워커 (Worker - 1~5분 주기)
 *    - `setInterval` 스케줄러로 주기적 실행 (기본 3분 = 180,000ms)
 *    - `SMEMBERS dirty_agents`로 변경된 캐릭터 ID 목록 일괄 조회
 *    - `MGET agent_state:{id}...`로 최신 상태 데이터를 한 번에 읽어 배열 구성
 *    - Supabase `magic_characters` 테이블에 단 한 번의 네트워크 요청으로 Bulk Upsert 수행
 *      (`Prefer: resolution=merge-duplicates,return=minimal`로 응답 I/O까지 최소화)
 *
 * 3. 안전한 후처리 및 예외 처리 (Data Loss Prevention)
 *    - Supabase Bulk Upsert가 성공한 ID들만 `SREM dirty_agents`로 안전하게 제거
 *    - 네트워크/DB 일시 장애 시 `dirty_agents`에서 제거하지 않아 다음 주기에 100% 자동 재시도
 *    - 전송 도중(In-Flight) 추가 변경이 발생한 캐릭터는 버전 대조를 통해 누락 없이 다음 배치에 보존
 *    - 캐릭터 로그아웃(세션 종료) 시 즉시 Supabase에 저장 후 `SREM dirty_agents` 처리
 *      (다수 AI 동시 로테이션 로그아웃 시 50ms 마이크로 배칭으로 단 1회 Bulk Upsert 병합)
 *    - 프로세스 종료(SIGINT, SIGTERM) 시 잔여 dirty_agents 전체 즉시 플러시(Graceful Shutdown)
 * ============================================================================
 */

const fs = require('fs');
const path = require('path');

function loadEnvIfNeeded() {
  const candidates = [
    path.join(__dirname, '.env'),
    path.join(__dirname, 'public', '.env'),
    path.join(__dirname, '..', '.env')
  ];
  for (const envPath of candidates) {
    if (!fs.existsSync(envPath)) continue;
    try {
      const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue;
        const eqIdx = trimmed.indexOf('=');
        const key = trimmed.slice(0, eqIdx).trim();
        const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']+|["']+$/g, '');
        if (!process.env[key]) process.env[key] = val;
      }
    } catch (_) {}
  }
}
loadEnvIfNeeded();

const SUPABASE_URL = (process.env.SUPABASE_URL || 'https://fkztpigrlobgkgammvji.supabase.co').replace(/^["']+|["']+$/g, '');
const SUPABASE_KEY = (process.env.SUPABASE_KEY || 'sb_publishable_7scBWfFfF8FJW4qrdcthvw_Rf7q_XcR').replace(/^["']+|["']+$/g, '');
const REDIS_URL = process.env.REDIS_URL || 'redis://127.0.0.1:6379';

// 기본 배치 주기: 3분(180,000ms) - 환경변수 BATCH_SYNC_INTERVAL_MS로 1~5분(60000~300000) 조절 가능
const DEFAULT_BATCH_INTERVAL_MS = Math.max(
  30000,
  Number(process.env.BATCH_SYNC_INTERVAL_MS || 180000)
);

// Redis 키 네임스페이스 상수
const STATE_KEY_PREFIX = 'agent_state:';
const DIRTY_SET_KEY = 'dirty_agents';
const CHAR_TABLE = 'magic_characters';

// ============================================================================
// 내장 인메모리 폴백 어댑터 (Redis 미설치/오프라인 환경에서도 동일한 명령어 규격 100% 보장)
// ============================================================================
class InMemoryRedisFallback {
  constructor() {
    this.kv = new Map();
    this.sets = new Map();
    this.isOpen = true;
    this.isFallback = true;
  }
  async connect() {
    this.isOpen = true;
    return this;
  }
  async quit() {
    this.isOpen = false;
  }
  async set(key, val) {
    this.kv.set(String(key), String(val));
    return 'OK';
  }
  async get(key) {
    return this.kv.has(String(key)) ? this.kv.get(String(key)) : null;
  }
  async mGet(keys) {
    if (!Array.isArray(keys) || keys.length === 0) return [];
    return keys.map(k => (this.kv.has(String(k)) ? this.kv.get(String(k)) : null));
  }
  async del(keys) {
    const arr = Array.isArray(keys) ? keys : [keys];
    let removed = 0;
    for (const k of arr) {
      if (this.kv.delete(String(k))) removed++;
    }
    return removed;
  }
  async sAdd(setKey, members) {
    const sk = String(setKey);
    if (!this.sets.has(sk)) this.sets.set(sk, new Set());
    const setObj = this.sets.get(sk);
    const arr = Array.isArray(members) ? members : [members];
    let added = 0;
    for (const m of arr) {
      const str = String(m);
      if (!setObj.has(str)) {
        setObj.add(str);
        added++;
      }
    }
    return added;
  }
  async sMembers(setKey) {
    const setObj = this.sets.get(String(setKey));
    return setObj ? Array.from(setObj) : [];
  }
  async sRem(setKey, members) {
    const setObj = this.sets.get(String(setKey));
    if (!setObj) return 0;
    const arr = Array.isArray(members) ? members : [members];
    let removed = 0;
    for (const m of arr) {
      if (setObj.delete(String(m))) removed++;
    }
    return removed;
  }
  async sCard(setKey) {
    const setObj = this.sets.get(String(setKey));
    return setObj ? setObj.size : 0;
  }
  multi() {
    const ops = [];
    const self = this;
    const chain = {
      set(k, v) { ops.push(() => self.set(k, v)); return chain; },
      sAdd(k, m) { ops.push(() => self.sAdd(k, m)); return chain; },
      sRem(k, m) { ops.push(() => self.sRem(k, m)); return chain; },
      del(k) { ops.push(() => self.del(k)); return chain; },
      async exec() {
        const results = [];
        for (const fn of ops) results.push(await fn());
        return results;
      }
    };
    return chain;
  }
}

// ============================================================================
// Redis 클라이언트 초기화 (공식 `redis` 패키지 우선 사용 + 장애 시 자동 폴백)
// ============================================================================
let redisClient = new InMemoryRedisFallback();
let redisInitPromise = null;

async function initRedisClient() {
  if (redisInitPromise) return redisInitPromise;
  redisInitPromise = (async () => {
    if (process.env.DISABLE_REDIS === 'true') {
      console.log(`ℹ [RedisSync] DISABLE_REDIS=true 설정됨 -> 인메모리 지연 동기화 캐시 모드로 동작합니다.`);
      return redisClient;
    }
    try {
      const { createClient } = require('redis');
      const client = createClient({
        url: REDIS_URL,
        socket: {
          connectTimeout: 2500,
          reconnectStrategy: (retries) => {
            if (retries > 5) return false; // 로컬 Redis 미구동 시 무한 블로킹 방지 및 폴백 유지
            return Math.min(retries * 300, 1500);
          }
        }
      });

      client.on('error', (err) => {
        if (redisClient === client && !client.isOpen) {
          console.warn(`⚠️ [RedisSync] Redis 연결 중단 감지 -> 인메모리 캐시 폴백 전환: ${err.message}`);
          redisClient = new InMemoryRedisFallback();
        }
      });

      await client.connect();
      redisClient = client;
      console.log(`✔ [RedisSync] Redis 서버 연결 완료 (${REDIS_URL}) - Lazy Sync & Bulk Upsert 활성화`);
    } catch (err) {
      redisClient = new InMemoryRedisFallback();
      console.log(`ℹ [RedisSync] Redis 서버 미감지(${err.message}) -> 내장 Redis 호환 인메모리 캐시 모드로 지연 동기화(Bulk Upsert)를 수행합니다.`);
    }
    return redisClient;
  })();
  return redisInitPromise;
}

// 캐릭터별 상태 변경 버전 추적 (네트워크 전송 도중 상태가 또 변경된 경우 SREM 누락 방지용)
const stateVersionMap = new Map(); // charId -> integer version
let isBatchSyncRunning = false;
let batchWorkerTimer = null;

// 통계 모니터링 카운터
const syncStats = {
  redisWrites: 0,
  supabaseBulkCalls: 0,
  supabaseRowsSynced: 0,
  logoutFlushes: 0,
  lastSyncAt: null
};

// ============================================================================
// Supabase 최소 I/O 전용 Bulk Upsert 헬퍼
// - Prefer: resolution=merge-duplicates,return=minimal 헤더로 응답 직렬화/네트워크 I/O 제거
// ============================================================================
async function supabaseBulkUpsertCharacters(records) {
  if (!Array.isArray(records) || records.length === 0) return true;
  if (!SUPABASE_URL || !SUPABASE_KEY || typeof fetch === 'undefined') return false;

  const url = `${SUPABASE_URL}/rest/v1/${CHAR_TABLE}?on_conflict=id`;
  const headers = {
    'Content-Type': 'application/json',
    apikey: SUPABASE_KEY,
    // return=minimal: PostgreSQL이 UPSERT된 전체 JSONB 행을 다시 읽고 직렬화해 반환하는 디스크/네트워크 비용 제거
    Prefer: 'resolution=merge-duplicates,return=minimal'
  };
  if (SUPABASE_KEY.startsWith('eyJ')) {
    headers.Authorization = `Bearer ${SUPABASE_KEY}`;
  }

  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(records)
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`Supabase Bulk Upsert HTTP ${res.status}: ${errText.slice(0, 200)}`);
  }

  syncStats.supabaseBulkCalls++;
  syncStats.supabaseRowsSynced += records.length;
  syncStats.lastSyncAt = new Date().toISOString();
  return true;
}

// ============================================================================
// [요구사항 1] 실시간 상태 업데이트 (Redis 전용 - Supabase 호출 금지)
// - SET agent_state:{id} <JSON>
// - SADD dirty_agents {id}
// ============================================================================
async function updateAgentState(agentId, stateObject) {
  if (!agentId || !stateObject) return false;
  const idStr = String(agentId);
  const stateKey = `${STATE_KEY_PREFIX}${idStr}`;

  // 상태 변경 버전 증가 (배치 플러시 도중 덮어쓰기 감지용)
  const nextVer = (stateVersionMap.get(idStr) || 0) + 1;
  stateVersionMap.set(idStr, nextVer);

  const payloadToStore = {
    ...stateObject,
    id: idStr,
    updated_at: stateObject.updated_at || new Date().toISOString()
  };
  const serialized = JSON.stringify(payloadToStore);

  try {
    await initRedisClient();
    // Redis Pipeline(multi)으로 SET과 SADD를 단일 네트워크 왕복(1 RTT)으로 묶어 처리
    const pipeline = redisClient.multi();
    pipeline.set(stateKey, serialized);
    pipeline.sAdd(DIRTY_SET_KEY, idStr);
    await pipeline.exec();
    syncStats.redisWrites++;
    return true;
  } catch (err) {
    // Redis 일시 오류 시 인메모리 폴백에 즉시 기록하여 유실 차단
    if (!redisClient.isFallback) {
      redisClient = new InMemoryRedisFallback();
    }
    await redisClient.set(stateKey, serialized);
    await redisClient.sAdd(DIRTY_SET_KEY, idStr);
    return true;
  }
}

/**
 * Redis에 캐싱된 특정 캐릭터의 최신 상태 조회 (캐릭터 선택창 조회 시 최신 상태 오버레이용)
 */
async function getAgentState(agentId) {
  if (!agentId) return null;
  try {
    await initRedisClient();
    const raw = await redisClient.get(`${STATE_KEY_PREFIX}${String(agentId)}`);
    return raw ? JSON.parse(raw) : null;
  } catch (_) {
    return null;
  }
}

/**
 * 복수 캐릭터의 Redis 최신 상태 일괄 조회 (MGET)
 */
async function getMultipleAgentStates(agentIds) {
  if (!Array.isArray(agentIds) || agentIds.length === 0) return new Map();
  const resultMap = new Map();
  try {
    await initRedisClient();
    const keys = agentIds.map(id => `${STATE_KEY_PREFIX}${String(id)}`);
    const rawList = await redisClient.mGet(keys);
    for (let i = 0; i < agentIds.length; i++) {
      if (rawList && rawList[i]) {
        try {
          resultMap.set(String(agentIds[i]), JSON.parse(rawList[i]));
        } catch (_) {}
      }
    }
  } catch (_) {}
  return resultMap;
}

// ============================================================================
// [요구사항 2 & 3] 백그라운드 배치 동기화 워커 (Bulk Upsert & 안전한 SREM 후처리)
// - SMEMBERS dirty_agents 조회
// - MGET agent_state:{id} 일괄 로드 후 배열 병합
// - Supabase 단 1회 Bulk Upsert 요청 (대량일 경우 안전한 청크 분할 지원)
// - 성공한 ID만 SREM dirty_agents 수행
// ============================================================================
async function syncDirtyAgentsToSupabase(reason = 'scheduled_batch') {
  if (isBatchSyncRunning) return { synced: 0, skipped: true };
  isBatchSyncRunning = true;

  try {
    await initRedisClient();

    // 1. dirty_agents Set에서 변경된 캐릭터 ID 목록 조회 (SMEMBERS)
    const dirtyIds = await redisClient.sMembers(DIRTY_SET_KEY);
    if (!Array.isArray(dirtyIds) || dirtyIds.length === 0) {
      return { synced: 0 };
    }

    // 2. 스냅샷 시점의 각 캐릭터 상태 버전 기록 및 Redis MGET으로 최신 상태 일괄 조회
    const snapshotVersions = new Map();
    const stateKeys = [];
    for (const rawId of dirtyIds) {
      const idStr = String(rawId);
      snapshotVersions.set(idStr, stateVersionMap.get(idStr) || 0);
      stateKeys.push(`${STATE_KEY_PREFIX}${idStr}`);
    }

    const rawStates = await redisClient.mGet(stateKeys);
    const recordsToUpsert = [];
    const validIdsForBatch = [];
    const orphanIdsToClean = [];

    for (let i = 0; i < dirtyIds.length; i++) {
      const idStr = String(dirtyIds[i]);
      const rawJson = rawStates ? rawStates[i] : null;
      if (!rawJson) {
        orphanIdsToClean.push(idStr);
        continue;
      }
      try {
        const parsed = JSON.parse(rawJson);
        if (parsed && parsed.id) {
          recordsToUpsert.push(parsed);
          validIdsForBatch.push(idStr);
        } else {
          orphanIdsToClean.push(idStr);
        }
      } catch (_) {
        orphanIdsToClean.push(idStr);
      }
    }

    if (orphanIdsToClean.length > 0) {
      await redisClient.sRem(DIRTY_SET_KEY, orphanIdsToClean);
    }

    if (recordsToUpsert.length === 0) {
      return { synced: 0 };
    }

    // 3. Supabase에 단 한 번의 네트워크 요청으로 일괄 저장 (Bulk Upsert)
    //    (최대 200명까지 단일 패킷으로 전송하여 I/O 트랜잭션 오버헤드 최소화)
    const MAX_BULK_CHUNK = 200;
    const successfullySyncedIds = [];

    for (let offset = 0; offset < recordsToUpsert.length; offset += MAX_BULK_CHUNK) {
      const chunkRecords = recordsToUpsert.slice(offset, offset + MAX_BULK_CHUNK);
      const chunkIds = validIdsForBatch.slice(offset, offset + MAX_BULK_CHUNK);

      try {
        await supabaseBulkUpsertCharacters(chunkRecords);
        // 저장이 성공한 ID들 중, HTTP 요청 도중 새로운 상태 변경이 없었던 ID만 SREM 대상에 추가
        for (const cid of chunkIds) {
          const verBefore = snapshotVersions.get(cid) || 0;
          const verNow = stateVersionMap.get(cid) || 0;
          if (verNow === verBefore) {
            successfullySyncedIds.push(cid);
          }
        }
      } catch (chunkErr) {
        console.error(`⚠️ [RedisSync] Supabase 일괄 저장 실패 (${reason}, 대상 ${chunkRecords.length}건) - dirty_agents 유지하여 다음 주기에 재시도합니다:`, chunkErr.message);
      }
    }

    // 4. 안전한 후처리: Supabase 저장이 성공적으로 완료된 ID들만 dirty_agents Set에서 제거 (SREM)
    if (successfullySyncedIds.length > 0) {
      await redisClient.sRem(DIRTY_SET_KEY, successfullySyncedIds);
    }

    console.log(`✔ [RedisSync 배치 완료] 사유: ${reason} | 일괄 저장: ${recordsToUpsert.length}명 (단일 Bulk Upsert) | SREM 완료: ${successfullySyncedIds.length}명`);
    return { synced: recordsToUpsert.length, removedDirty: successfullySyncedIds.length };
  } catch (err) {
    console.error(`❌ [RedisSync 워커 오류] (${reason}):`, err.message);
    return { synced: 0, error: err.message };
  } finally {
    isBatchSyncRunning = false;
  }
}

// ============================================================================
// [요구사항 3-2] 로그아웃(세션 종료) 시 즉시 Supabase 저장 예외 처리
// - 단일 유저/에이전트 로그아웃 시 즉시 Supabase로 Upsert 후 dirty_agents에서 SREM
// - 다수의 AI 에이전트가 동시에 교대(Rotation) 로그아웃할 때는 50ms 마이크로 배치로 묶어
//   수십 번의 개별 API 호출 대신 단 1회의 Bulk Upsert로 병합 처리!
// ============================================================================
const pendingLogoutMap = new Map(); // charId -> { record, resolvers: [] }
let logoutFlushTimer = null;

async function flushPendingLogouts() {
  logoutFlushTimer = null;
  if (pendingLogoutMap.size === 0) return;

  const entries = Array.from(pendingLogoutMap.entries());
  pendingLogoutMap.clear();

  const ids = entries.map(([id]) => id);
  const records = entries.map(([, item]) => item.record);

  try {
    await supabaseBulkUpsertCharacters(records);
    syncStats.logoutFlushes += records.length;
    // 즉시 저장이 성공한 로그아웃 캐릭터들을 dirty_agents에서 제거 (SREM)
    await initRedisClient();
    await redisClient.sRem(DIRTY_SET_KEY, ids);

    for (const [, item] of entries) {
      item.resolvers.forEach(r => r(true));
    }
  } catch (err) {
    console.error(`⚠️ [RedisSync 로그아웃 즉시 저장 실패] (${records.length}명) -> dirty_agents에 유지하여 배치 워커가 안전하게 재저장합니다:`, err.message);
    // 실패 시 데이터 유실 방지를 위해 dirty_agents에 보존 (SADD)
    try {
      await initRedisClient();
      await redisClient.sAdd(DIRTY_SET_KEY, ids);
    } catch (_) {}

    for (const [, item] of entries) {
      item.resolvers.forEach(r => r(false));
    }
  }
}

/**
 * 캐릭터 로그아웃(세션 종료) 시 호출되는 즉시 저장 함수
 * @param {string} agentId 캐릭터 ID
 * @param {object} finalStateObject 로그아웃 시점의 최종 캐릭터 레코드
 */
async function handleAgentLogout(agentId, finalStateObject) {
  if (!agentId) return false;
  const idStr = String(agentId);

  // 1. 최종 상태를 Redis에 먼저 반영 (session_token: null 보장)
  let recordToSave = finalStateObject;
  if (!recordToSave) {
    recordToSave = await getAgentState(idStr);
  }
  if (!recordToSave) return false;

  recordToSave = {
    ...recordToSave,
    id: idStr,
    session_token: null,
    updated_at: new Date().toISOString()
  };

  await updateAgentState(idStr, recordToSave);

  // 2. 마이크로 배치 큐(40ms)에 등록하여 즉시 Supabase에 저장 (동시 다발 로그아웃 시 1회 요청으로 자동 병합)
  return new Promise((resolve) => {
    const existing = pendingLogoutMap.get(idStr);
    if (existing) {
      existing.record = recordToSave;
      existing.resolvers.push(resolve);
    } else {
      pendingLogoutMap.set(idStr, { record: recordToSave, resolvers: [resolve] });
    }
    if (!logoutFlushTimer) {
      logoutFlushTimer = setTimeout(flushPendingLogouts, 40);
    }
  });
}

// ============================================================================
// 주기적 백그라운드 배치 워커 스케줄러 시작 및 Graceful Shutdown 등록
// ============================================================================
let shutdownHooksRegistered = false;

function registerGracefulShutdownHooks() {
  if (shutdownHooksRegistered) return;
  shutdownHooksRegistered = true;

  const gracefulFlush = async (sig) => {
    console.log(`\n🛑 [RedisSync] ${sig} 시그널 감지 -> 종료 전 미동기화(dirty_agents) 데이터 긴급 일괄 저장 수행...`);
    try {
      if (logoutFlushTimer) {
        clearTimeout(logoutFlushTimer);
        await flushPendingLogouts();
      }
      await syncDirtyAgentsToSupabase(`graceful_shutdown_${sig}`);
    } catch (e) {
      console.error(`⚠️ [RedisSync] 종료 플러시 중 오류:`, e.message);
    }
  };

  process.once('SIGINT', async () => {
    await gracefulFlush('SIGINT');
    process.exit(0);
  });
  process.once('SIGTERM', async () => {
    await gracefulFlush('SIGTERM');
    process.exit(0);
  });
}

function startBatchSyncWorker(customIntervalMs = DEFAULT_BATCH_INTERVAL_MS) {
  initRedisClient().catch(() => {});
  registerGracefulShutdownHooks();

  if (batchWorkerTimer) return batchWorkerTimer;

  const intervalMs = Math.max(30000, Number(customIntervalMs) || DEFAULT_BATCH_INTERVAL_MS);
  console.log(`⏱️ [RedisSync 워커 가동] 주기: ${Math.round(intervalMs / 1000)}초 (${(intervalMs / 60000).toFixed(1)}분) 간격으로 dirty_agents 일괄 Bulk Upsert 수행`);

  batchWorkerTimer = setInterval(() => {
    syncDirtyAgentsToSupabase('interval_worker').catch(() => {});
  }, intervalMs);

  if (typeof batchWorkerTimer.unref === 'function') {
    batchWorkerTimer.unref();
  }
  return batchWorkerTimer;
}

function getSyncStats() {
  return { ...syncStats };
}

module.exports = {
  STATE_KEY_PREFIX,
  DIRTY_SET_KEY,
  initRedisClient,
  updateAgentState,
  getAgentState,
  getMultipleAgentStates,
  syncDirtyAgentsToSupabase,
  handleAgentLogout,
  startBatchSyncWorker,
  supabaseBulkUpsertCharacters,
  getSyncStats
};
