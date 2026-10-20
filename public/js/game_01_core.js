// js/game_01_core.js — 코어 상태 · 아이템 생성기 · 스킬 SVG · 대화창 · 월드맵 · 안전지대

let bgLeaveTimer = null;
let bgSaveLogoutTimer = null;
let centralWs = null;
window._clientBuildVersion = null;
window._versionReloading = false;
window._pendingPatchReload = false;
window._patchModalShownForVer = null;

window.executeImmediatePatchReload = function() {
  if (window._versionReloading) return;
  window._versionReloading = true;
  try {
    if (window.triggerAutoSave) window.triggerAutoSave('version_auto_reload', true);
  } catch (e) {}
  setTimeout(() => {
    try {
      window.location.reload();
    } catch (e) {}
  }, 180);
};

// 🔄 서버 데이타/패치 수정 감지:
// - 포그라운드 플레이 중일 때: window.showSystemAlertModal로 [신규 패치 적용 알림 팝업 + 새로고침 버튼] 표시
// - 백그라운드에서 복귀했을 때(visibilitychange): 즉시 자동 새로고침
window.dismissPatchReloadModal = function() {
  window.closeSystemAlertModal?.();
  window.addChat?.("ℹ️ [패치 나중에 적용] 현재 게임을 계속 진행합니다. 캐릭터 선택창 이동 또는 재접속 시 자동 반영됩니다.", "log-sys");
};

window.checkServerVersionAndAutoReload = async function(incomingVer = null, fromVisibilityReturn = false) {
  if (window._versionReloading) return;
  try {
    let ver = incomingVer;
    if (!ver) {
      const res = await fetch(`/api/version?t=${Date.now()}`, { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        ver = data?.version || null;
      }
    }
    if (!ver) return;
    if (!window._clientBuildVersion) {
      window._clientBuildVersion = ver;
      return;
    }
    if (window._clientBuildVersion !== ver) {
      window._pendingPatchReload = true;
      try {
        if (window.triggerAutoSave) window.triggerAutoSave('version_patch_detected', true);
      } catch (e) {}

      // 로그인 화면이거나 캐릭터 선택창일 때(비게임 상태)는 즉시 자동 새로고침!
      const inActiveGameplay = (typeof isGameSessionActive !== 'undefined' && isGameSessionActive);
      if (!inActiveGameplay) {
        window.executeImmediatePatchReload();
        return;
      }

      // 인게임 플레이 중일 때는 강제로 게임을 닫거나 새로고침하지 않고 사용자가 직접 선택하도록 안내!
      if (window._patchModalShownForVer !== ver && !document.hidden) {
        window._patchModalShownForVer = ver;
        window.addChat?.("✨ [신규 패치 알림] 서버 데이터가 업데이트되었습니다. 원하실 때 새로고침하거나 계속 플레이하실 수 있습니다.", "log-kill");
        window.showSystemAlertModal?.(
          '✨ 신규 패치 업데이트 안내',
          `서버 데이터가 새롭게 업데이트되었습니다.\n현재 캐릭터 데이터는 안전하게 저장되었습니다.\n지금 바로 새로고침하시겠습니까, 아니면 계속 플레이하시겠습니까?`,
          `<button type="button" class="auth-sub-btn" style="flex:1; font-size:12px; padding:10px 10px;" onclick="window.dismissPatchReloadModal()">계속 게임하기</button>
           <button type="button" class="auth-primary-btn" style="flex:1.2; font-size:12.5px; padding:10px 12px;" onclick="window.executeImmediatePatchReload()">🔄 지금 새로고침</button>`
        );
      }
    }
  } catch (e) {}
};

// 📉 데이터 절약: WebSocket 실시간 연결 중에는 패킷으로 버전을 수신하므로 불필요한 HTTP 폴링 생략
setInterval(() => {
  if (!document.hidden && !(centralWs && centralWs.readyState === WebSocket.OPEN)) {
    window.checkServerVersionAndAutoReload();
  }
}, 45000);

window.addEventListener('focus', () => {
  if (!(centralWs && centralWs.readyState === WebSocket.OPEN)) {
    window.checkServerVersionAndAutoReload();
  }
});
window.addEventListener('pageshow', () => {
  window.checkServerVersionAndAutoReload();
});

// ⛶ 게임 시작 및 진입 시 자동 전체화면 진입 헬퍼
window.tryEnterFullscreenMode = function() {
  try {
    const docEl = document.documentElement;
    if (!document.fullscreenElement && !document.webkitFullscreenElement) {
      if (docEl.requestFullscreen) {
        docEl.requestFullscreen().catch(() => {});
      } else if (docEl.webkitRequestFullscreen) {
        docEl.webkitRequestFullscreen();
      } else if (docEl.msRequestFullscreen) {
        docEl.msRequestFullscreen();
      }
    }
  } catch (e) {}
};

// 🛡️ 터치 민감도 개선: 중복 터치(고스트 클릭 / 너무 빠른 두번 터치) 방지 디바운스 헬퍼
const _uiTouchActionTimestamps = new Map();
window.isUiTouchDebounced = function(actionKey, cooldownMs = 260) {
  const now = Date.now();
  const prev = _uiTouchActionTimestamps.get(actionKey) || 0;
  if (now - prev < cooldownMs) return true;
  _uiTouchActionTimestamps.set(actionKey, now);
  return false;
};

// 브라우저 기본 alert 차단 및 인게임 비암전 모달로 일원화
window.alert = function(msg) {
  window.showSystemAlertModal?.('알림', String(msg || ''));
};







// ============================================================================
// 🛠️ PixiCtx 안전 색상 파서 패치 (rgba / #rgb / #rrggbb 변환 시 Color NaN 오류 원천 차단)
// ============================================================================
function parseSafePixiColor(col, fallbackAlpha = 1) {
  if (col === null || col === undefined || col === '' || col === 'none') return null;
  if (typeof col === 'number') {
    return { hex: Number.isFinite(col) ? col : 0xffffff, alpha: fallbackAlpha };
  }
  const s = String(col).trim();
  if (s.startsWith('rgba') || s.startsWith('rgb')) {
    const m = s.match(/rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)(?:\s*,\s*([\d.]+))?\s*\)/i);
    if (m) {
      const r = Math.max(0, Math.min(255, Math.round(Number(m[1]) || 0)));
      const g = Math.max(0, Math.min(255, Math.round(Number(m[2]) || 0)));
      const b = Math.max(0, Math.min(255, Math.round(Number(m[3]) || 0)));
      const a = m[4] !== undefined ? Math.max(0, Math.min(1, Number(m[4]))) : fallbackAlpha;
      return { hex: (r << 16) | (g << 8) | b, alpha: a };
    }
    return { hex: 0x94a3b8, alpha: 0.5 };
  }
  if (s.startsWith('#')) {
    let hexStr = s.slice(1).trim();
    if (hexStr.length === 3) {
      hexStr = hexStr[0] + hexStr[0] + hexStr[1] + hexStr[1] + hexStr[2] + hexStr[2];
    }
    const parsed = parseInt(hexStr, 16);
    return { hex: Number.isFinite(parsed) ? parsed : 0xffffff, alpha: fallbackAlpha };
  }
  const num = parseInt(s, 16);
  return { hex: Number.isFinite(num) ? num : 0xffffff, alpha: fallbackAlpha };
}

if (PixiCtx && PixiCtx.prototype) {
  PixiCtx.prototype.poly = function(pts, fill, stroke = '#111111', lw = 2) {
    const sInfo = (stroke && lw > 0) ? parseSafePixiColor(stroke, 1) : null;
    if (sInfo) this.g.lineStyle(lw, sInfo.hex, sInfo.alpha);
    else this.g.lineStyle(0);

    const fInfo = fill ? parseSafePixiColor(fill, 1) : null;
    if (fInfo) this.g.beginFill(fInfo.hex, fInfo.alpha);

    if (Array.isArray(pts) && pts.length > 0) {
      const p0 = this._t(pts[0][0], pts[0][1]);
      this.g.moveTo(p0.x, p0.y);
      for (let i = 1; i < pts.length; i++) {
        const p = this._t(pts[i][0], pts[i][1]);
        this.g.lineTo(p.x, p.y);
      }
      this.g.closePath();
    }
    if (fInfo) this.g.endFill();
  };

  PixiCtx.prototype.ellipse = function(cx, cy, rx, ry, fill, stroke = '#111111', lw = 2) {
    const sInfo = (stroke && lw > 0) ? parseSafePixiColor(stroke, 1) : null;
    if (sInfo) this.g.lineStyle(lw, sInfo.hex, sInfo.alpha);
    else this.g.lineStyle(0);

    const fInfo = fill ? parseSafePixiColor(fill, 1) : null;
    if (fInfo) this.g.beginFill(fInfo.hex, fInfo.alpha);

    const pts = [];
    for (let i = 0; i <= 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      pts.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]);
    }
    const p0 = this._t(pts[0][0], pts[0][1]);
    this.g.moveTo(p0.x, p0.y);
    for (let i = 1; i < pts.length; i++) {
      const p = this._t(pts[i][0], pts[i][1]);
      this.g.lineTo(p.x, p.y);
    }
    this.g.closePath();
    if (fInfo) this.g.endFill();
  };

  PixiCtx.prototype.curveFill = function(sx, sy, cp1x, cp1y, cp2x, cp2y, ex, ey, fill, stroke = '#111111', lw = 2) {
    const sInfo = (stroke && lw > 0) ? parseSafePixiColor(stroke, 1) : null;
    if (sInfo) this.g.lineStyle(lw, sInfo.hex, sInfo.alpha);
    else this.g.lineStyle(0);

    const fInfo = fill ? parseSafePixiColor(fill, 1) : null;
    if (fInfo) this.g.beginFill(fInfo.hex, fInfo.alpha);

    const p0 = this._t(sx, sy);
    this.g.moveTo(p0.x, p0.y);
    for (let i = 1; i <= 10; i++) {
      const t = i / 10;
      const xt = Math.pow(1 - t, 3) * sx + 3 * Math.pow(1 - t, 2) * t * cp1x + 3 * (1 - t) * t * t * cp2x + Math.pow(t, 3) * ex;
      const yt = Math.pow(1 - t, 3) * sy + 3 * Math.pow(1 - t, 2) * t * cp1y + 3 * (1 - t) * t * t * cp2y + Math.pow(t, 3) * ey;
      const p = this._t(xt, yt);
      this.g.lineTo(p.x, p.y);
    }
    this.g.closePath();
    if (fInfo) this.g.endFill();
  };
}

const CLASS_STATS = {
  knight: { ...GameDB.Classes.HUMAN_WARRIOR, fixedBaseStats: GameDB.Classes.HUMAN_WARRIOR },
  ranger: { ...GameDB.Classes.ELF_ARCHER,    fixedBaseStats: GameDB.Classes.ELF_ARCHER },
  wizard: { ...GameDB.Classes.ELF_MAGE,      fixedBaseStats: GameDB.Classes.ELF_MAGE }
};

// ============================================================================
// 🎲 아이템 5등급(일반/고급/희귀/전설/초월) 및 랜덤 마법옵션 + 개별 인챈트(plus) 생성기
// ============================================================================
function createItemInstance(itemId, qty = 1, isBossDrop = false, forceGradeIdx = null, mobLv = 1, initPlus = 0) {
  const def = window.itemDict?.[itemId];
  const isEquip = def && ['한손검', '양손활', '양손지팡이', '방패', '투구', '갑옷', '장갑', '망토', '신발', '반지', '목걸이', '귀걸이', '티셔츠', '벨트'].some(t => def.type?.includes(t));

  if (!isEquip) {
    const fixedG = typeof def?.fixedGrade === 'number' ? def.fixedGrade : 0;
    const gInfo = GameDB.ItemGrades[fixedG] || GameDB.ItemGrades[0];
    return {
      type: itemId,
      qty: qty,
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
    gradeIdx = forceGradeIdx;
  } else {
    const lvTierBonus = Math.min(3.0, Math.max(0, (mobLv - 1) / 90));
    const grades = GameDB.ItemGrades.map(g => {
      let w = isBossDrop ? g.dropWeightBoss : g.dropWeightMob;
      if (mobLv <= 25) {
        if (isBossDrop) {
          if (g.idx === 0) w = 0;
          else if (g.idx === 1) w = 520;
          else if (g.idx === 2) w = 260;
          else if (g.idx === 3) w = 6;
          else if (g.idx === 4) w = 0;
        } else {
          if (g.idx === 0) w = 720;
          else if (g.idx === 1) w = 240;
          else if (g.idx === 2) w = 35;
          else if (g.idx === 3) w = 0.08;
          else if (g.idx === 4) w = 0;
        }
      } else if (mobLv <= 50) {
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

  const gradeInfo = GameDB.ItemGrades[gradeIdx] || GameDB.ItemGrades[0];
  let optCount = gradeInfo.optMin + Math.floor(Math.random() * (gradeInfo.optMax - gradeInfo.optMin + 1));
  if (isBossDrop && mobLv >= 80 && optCount < gradeInfo.optMax) {
    optCount = gradeInfo.optMax;
  }

  const pool = [...GameDB.MagicOptionPool];
  const options = [];
  const bossFloorRatio = isBossDrop ? Math.min(0.55, 0.15 + (mobLv / 500)) : 0;

  for (let i = 0; i < optCount && pool.length > 0; i++) {
    const pickIdx = Math.floor(Math.random() * pool.length);
    const optDef = pool.splice(pickIdx, 1)[0];
    const span = optDef.max - optDef.min;
    const minRoll = optDef.min + Math.floor(span * bossFloorRatio);
    const val = minRoll + Math.floor(Math.random() * (optDef.max - minRoll + 1));
    options.push({ key: optDef.key, label: optDef.label, val: val, unit: optDef.unit });
  }

  return {
    uid: 'eq_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
    type: itemId,
    qty: 1,
    plus: initPlus || 0,
    gradeIdx: gradeIdx,
    gradeName: gradeInfo.name,
    gradeColor: gradeInfo.color,
    mult: gradeInfo.mult,
    options: options
  };
}
window.createItemInstance = createItemInstance;

// 몬스터 레벨에 맞는 마법서(3~6서클) 및 기술서(2~3서클) 드롭 선택기
function pickMonsterSkillBookDrop(mobLv = 1, isBoss = false) {
  const allBooks = Object.values(window.itemDict || {}).filter(it => it && it.id && it.id.startsWith('BOOK_'));
  if (allBooks.length === 0) return null;

  // 몬스터 레벨에 부합하는 서클 필터링 (약간의 여유 범위 부여)
  let eligible = allBooks.filter(b => mobLv >= (b.dropMinLv - 4) && mobLv <= (b.dropMaxLv + 25));
  if (eligible.length === 0) {
    if (mobLv < 20) return null; // Lv.15 미만 초반 몬스터는 1~2서클을 NPC에게 배우므로 드롭 생략
    eligible = allBooks.filter(b => mobLv >= (b.dropMinLv - 10));
  }
  if (eligible.length === 0) return null;

  // 플레이어 현재 클래스의 미습득 스킬북을 60% 확률로 우선 배정하여 체감 재미 향상
  const myClassBooks = eligible.filter(b => b.reqClass === player?.class);
  const unlearnedMyBooks = myClassBooks.filter(b => !player?.learnedSkills?.has(b.skillId));

  let pool = eligible;
  if (unlearnedMyBooks.length > 0 && Math.random() < (isBoss ? 0.75 : 0.55)) {
    pool = unlearnedMyBooks;
  } else if (myClassBooks.length > 0 && Math.random() < 0.50) {
    pool = myClassBooks;
  }
  const picked = pool[Math.floor(Math.random() * pool.length)];
  return picked ? picked.id : null;
}

// 몬스터 레벨/등급에 맞는 적절한 드롭 아이템 결정 헬퍼
function pickMonsterTierDrop(ent, category = 'equip') {
  const lv = ent.lv || 1;
  const rawPool = (ent.drop && ent.drop.length > 0 ? ent.drop : ['C_P01']).filter(id => !window.itemDict[id]?.questOnly);

  if (category === 'consumable') {
    // Lv.15 이상 몬스터 처치 시 일정 확률로 레벨에 맞는 마법서/기술서 드롭!
    if (lv >= 15 && Math.random() < (ent.isBoss ? 0.65 : 0.24)) {
      const bookId = pickMonsterSkillBookDrop(lv, ent.isBoss);
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
  const tierEquips = Object.keys(window.itemDict).filter(id => {
    const d = window.itemDict[id];
    if (!d || d.questOnly) return false;
    if (id.startsWith('C_') || id.startsWith('S_') || id.startsWith('Q_') || id.startsWith('QR_') || id.startsWith('BOOK_')) return false;
    return id.endsWith(tierSuffix) || (!ent.isBoss && id.endsWith(prevSuffix));
  });

  const mergedPool = equipFromMob.length > 0 ? [...equipFromMob, ...equipFromMob, ...tierEquips] : tierEquips;
  if (mergedPool.length === 0) return 'W_SW01';
  return mergedPool[Math.floor(Math.random() * mergedPool.length)];
}

function createCrispPixiText(textStr, fontSize = 11.5, fillCol = 0xffffff) {
  const t = new PIXI.Text(textStr, {
    fontFamily: 'Noto Sans KR, sans-serif',
    fontSize: fontSize,
    fontWeight: 'bold',
    fill: fillCol,
    stroke: '#000000',
    strokeThickness: 2.2,
    dropShadow: false
  });
  t.resolution = Math.max(2, window.devicePixelRatio || 2);
  t.roundPixels = true;
  return t;
}

const SKILLS_DB = {
  knight: GameDB.Skills.Warrior,
  ranger: GameDB.Skills.Archer,
  wizard: GameDB.Skills.Mage
};

window.itemJsonData = null;
window.itemDict = {};
window.tmjCache = {};
window.worldMapTmjZones = [];

// ============================================================================
// 🎨 전 클래스 80종 전체 마법·스킬 이름 맞춤형 커스텀 SVG 그래픽 아이콘 생성기
// ============================================================================
const SKILL_SVG_PROFILES = {
  // 전사 (Warrior 10종)
  "소드 마스터리":   { c1: "#475569", c2: "#0f172a", bd: "#cbd5e1", glyph: "sword", badge: "M" },
  "배쉬":           { c1: "#b91c1c", c2: "#450a0a", bd: "#f87171", glyph: "bash", badge: "1" },
  "디펜스 오라":     { c1: "#1d4ed8", c2: "#172554", bd: "#60a5fa", glyph: "shield", badge: "P" },
  "실드 스트라이크": { c1: "#b45309", c2: "#451a03", bd: "#facc15", glyph: "shield_strike", badge: "1" },
  "휠윈드":         { c1: "#047857", c2: "#022c22", bd: "#34d399", glyph: "whirlwind", badge: "2" },
  "레이지":         { c1: "#dc2626", c2: "#450a0a", bd: "#fca5a5", glyph: "rage", badge: "2" },
  "차지":           { c1: "#d97706", c2: "#451a03", bd: "#fde047", glyph: "charge", badge: "2" },
  "터프니스":       { c1: "#be123c", c2: "#4c0519", bd: "#fda4af", glyph: "heart", badge: "P" },
  "아이언 스킨":     { c1: "#334155", c2: "#0f172a", bd: "#94a3b8", glyph: "shield", badge: "1" },
  "가디언 아머":     { c1: "#0284c7", c2: "#082f49", bd: "#fde047", glyph: "immune_dome", badge: "2" },
  "카운터 어택":     { c1: "#7c3aed", c2: "#2e1065", bd: "#c4b5fd", glyph: "counter", badge: "3" },
  "워크라이":       { c1: "#c2410c", c2: "#431407", bd: "#fdba74", glyph: "roar", badge: "3" },

  // 궁수 (Archer 20종)
  "보우 마스터리":   { c1: "#3f6212", c2: "#1a2e05", bd: "#a3e635", glyph: "bow", badge: "P" },
  "크리티컬 에임":   { c1: "#7e22ce", c2: "#3b0764", bd: "#e879f9", glyph: "crosshair", badge: "P" },
  "데들리 포커스":   { c1: "#991b1b", c2: "#450a0a", bd: "#f87171", glyph: "crit_eye", badge: "P" },
  "파이어 샷":       { c1: "#ea580c", c2: "#431407", bd: "#fb923c", glyph: "fire_arrow", badge: "1" },
  "더블 샷":         { c1: "#a16207", c2: "#422006", bd: "#fde047", glyph: "double_arrow", badge: "1" },
  "네이처스 터치":   { c1: "#15803d", c2: "#052e16", bd: "#4ade80", glyph: "leaf_heal", badge: "1" },
  "인탱글":         { c1: "#166534", c2: "#052e16", bd: "#86efac", glyph: "vine", badge: "1" },
  "이글 아이":       { c1: "#0369a1", c2: "#082f49", bd: "#38bdf8", glyph: "hawk_eye", badge: "1" },
  "윈드 워크":       { c1: "#0d9488", c2: "#042f2e", bd: "#5eead4", glyph: "wing_boot", badge: "1" },
  "닷지 스텝":       { c1: "#0284c7", c2: "#0c4a6e", bd: "#7dd3fc", glyph: "dash_boot", badge: "1" },
  "멀티 샷":         { c1: "#4d7c0f", c2: "#1a2e05", bd: "#bef264", glyph: "multi_arrow", badge: "2" },
  "아이스 샷":       { c1: "#0284c7", c2: "#082f49", bd: "#bae6fd", glyph: "ice_arrow", badge: "2" },
  "피어스 애로우":   { c1: "#6d28d9", c2: "#2e1065", bd: "#c084fc", glyph: "drill_arrow", badge: "2" },
  "엘븐 그레이스":   { c1: "#059669", c2: "#022c22", bd: "#6ee7b7", glyph: "feather", badge: "2" },
  "사일런스 애로우": { c1: "#4338ca", c2: "#1e1b4b", bd: "#a5b4fc", glyph: "mute_arrow", badge: "2" },
  "애로우 레인":     { c1: "#0f766e", c2: "#042f2e", bd: "#2dd4bf", glyph: "arrow_rain", badge: "3" },
  "네이처스 퓨리":   { c1: "#15803d", c2: "#052e16", bd: "#fde047", glyph: "storm_bow", badge: "3" },
  "스나이퍼 샷":     { c1: "#b91c1c", c2: "#450a0a", bd: "#facc15", glyph: "sniper", badge: "3" },
  "소울 배리어":     { c1: "#2563eb", c2: "#172554", bd: "#93c5fd", glyph: "aura_shield", badge: "3" },
  "게일 샷":         { c1: "#0891b2", c2: "#083344", bd: "#67e8f9", glyph: "gale_arrow", badge: "3" },

  // 마법사 1~6서클 (Mage 50종)
  "매직 미사일":     { c1: "#4338ca", c2: "#1e1b4b", bd: "#818cf8", glyph: "arcane_orb", badge: "1" },
  "파이어 애로우":   { c1: "#ea580c", c2: "#431407", bd: "#fdba74", glyph: "fire_bolt", badge: "1" },
  "아이스 다트":     { c1: "#0284c7", c2: "#082f49", bd: "#7dd3fc", glyph: "ice_crystal", badge: "1" },
  "윈드 컷":         { c1: "#059669", c2: "#022c22", bd: "#6ee7b7", glyph: "wind_blade", badge: "1" },
  "라이트":         { c1: "#ca8a04", c2: "#422006", bd: "#fef08a", glyph: "sun_light", badge: "1" },
  "스태프 마스터리": { c1: "#4338ca", c2: "#1e1b4b", bd: "#a5b4fc", glyph: "staff_mastery", badge: "P" },
  "마나 스트림":     { c1: "#0284c7", c2: "#082f49", bd: "#7dd3fc", glyph: "mana_stream", badge: "P" },
  "아케인 위즈덤":   { c1: "#7e22ce", c2: "#3b0764", bd: "#f0abfc", glyph: "arcane_wisdom", badge: "P" },
  "쉴드":           { c1: "#2563eb", c2: "#172554", bd: "#93c5fd", glyph: "shield", badge: "1" },
  "힐링":           { c1: "#059669", c2: "#022c22", bd: "#6ee7b7", glyph: "healing_light", badge: "1" },
  "홀리 웨폰":       { c1: "#d97706", c2: "#451a03", bd: "#fde047", glyph: "holy_sword", badge: "1" },
  "텔레포트":       { c1: "#7c3aed", c2: "#2e1065", bd: "#c4b5fd", glyph: "portal", badge: "1" },

  "파이어 볼":       { c1: "#dc2626", c2: "#450a0a", bd: "#facc15", glyph: "fireball", badge: "2" },
  "콜드 빔":         { c1: "#0369a1", c2: "#082f49", bd: "#38bdf8", glyph: "ice_beam", badge: "2" },
  "라이트닝":       { c1: "#ca8a04", c2: "#422006", bd: "#fef08a", glyph: "lightning", badge: "2" },
  "커스 포이즌":     { c1: "#15803d", c2: "#052e16", bd: "#86efac", glyph: "poison_skull", badge: "2" },
  "그레이트 힐":     { c1: "#15803d", c2: "#052e16", bd: "#fde047", glyph: "great_heal", badge: "2" },
  "큐어":           { c1: "#16a34a", c2: "#052e16", bd: "#bbf7d0", glyph: "holy_cross", badge: "2" },
  "인챈트 스탯":     { c1: "#9333ea", c2: "#3b0764", bd: "#e879f9", glyph: "star_up", badge: "2" },
  "멘탈 포커스":     { c1: "#1d4ed8", c2: "#172554", bd: "#93c5fd", glyph: "mana_drop", badge: "2" },
  "블라인드":       { c1: "#374151", c2: "#111827", bd: "#9ca3af", glyph: "dark_eye", badge: "2" },

  "파이어 월":       { c1: "#c2410c", c2: "#431407", bd: "#fb923c", glyph: "fire_wall", badge: "3" },
  "아이스 스톰":     { c1: "#0284c7", c2: "#0c4a6e", bd: "#bae6fd", glyph: "snow_storm", badge: "3" },
  "체인 라이트닝":   { c1: "#7e22ce", c2: "#2e1065", bd: "#fde047", glyph: "chain_bolt", badge: "3" },
  "뱀파이어 터치":   { c1: "#9f1239", c2: "#4c0519", bd: "#fda4af", glyph: "blood_fang", badge: "3" },
  "슬립":           { c1: "#4f46e5", c2: "#1e1b4b", bd: "#a5b4fc", glyph: "moon_sleep", badge: "3" },
  "사일런스":       { c1: "#6b21a8", c2: "#2e1065", bd: "#d8b4fe", glyph: "seal_rune", badge: "3" },
  "헤이스트":       { c1: "#16a34a", c2: "#052e16", bd: "#86efac", glyph: "haste_wing", badge: "3" },
  "마나 실드":       { c1: "#2563eb", c2: "#1e1b4b", bd: "#60a5fa", glyph: "mana_barrier", badge: "3" },

  "메테오(소)":     { c1: "#b91c1c", c2: "#450a0a", bd: "#f97316", glyph: "meteor", badge: "4" },
  "이럽션":         { c1: "#9a3412", c2: "#431407", bd: "#fdba74", glyph: "lava_pillar", badge: "4" },
  "콘 오브 콜드":   { c1: "#0369a1", c2: "#082f49", bd: "#7dd3fc", glyph: "frost_cone", badge: "4" },
  "디스펠 매직":     { c1: "#4338ca", c2: "#1e1b4b", bd: "#c7d2fe", glyph: "dispel", badge: "4" },
  "커스 파럴라이즈": { c1: "#6d28d9", c2: "#2e1065", bd: "#c4b5fd", glyph: "paralyze", badge: "4" },
  "홀리 워크":       { c1: "#eab308", c2: "#422006", bd: "#fef08a", glyph: "holy_wing", badge: "4" },
  "마나 드레인":     { c1: "#1d4ed8", c2: "#1e1b4b", bd: "#38bdf8", glyph: "vortex", badge: "4" },
  "쉐도우 팽":       { c1: "#312e81", c2: "#090d16", bd: "#818cf8", glyph: "shadow_blade", badge: "4" },
  "아이스 스파이크": { c1: "#0284c7", c2: "#082f49", bd: "#e0f2fe", glyph: "ice_spike", badge: "4" },

  "뮨 (Immune)":     { c1: "#d97706", c2: "#451a03", bd: "#fef08a", glyph: "immune_dome", badge: "5" },
  "데스 레이":       { c1: "#be123c", c2: "#4c0519", bd: "#f43f5e", glyph: "laser_beam", badge: "5" },
  "블리자드":       { c1: "#1d4ed8", c2: "#0c4a6e", bd: "#e0f2fe", glyph: "blizzard", badge: "5" },
  "라이트닝 스톰":   { c1: "#a16207", c2: "#3b0764", bd: "#fde047", glyph: "thunder_storm", badge: "5" },
  "앱솔루트 배리어": { c1: "#ca8a04", c2: "#422006", bd: "#ffffff", glyph: "abs_barrier", badge: "5" },
  "매스 텔레포트":   { c1: "#6d28d9", c2: "#1e1b4b", bd: "#e879f9", glyph: "portal", badge: "5" },
  "어스 바인드":     { c1: "#78350f", c2: "#291505", bd: "#fbbf24", glyph: "earth_chain", badge: "5" },
  "어드밴스드 스피릿":{ c1: "#db2777", c2: "#500724", bd: "#f9a8d4", glyph: "spirit_heart", badge: "5" },
  "서먼 몬스터":     { c1: "#4b5563", c2: "#111827", bd: "#facc15", glyph: "golem", badge: "5" },

  "미티어 스웜":     { c1: "#dc2626", c2: "#450a0a", bd: "#fde047", glyph: "meteor_swarm", badge: "6" },
  "앱솔루트 제로":   { c1: "#0284c7", c2: "#082f49", bd: "#ffffff", glyph: "abs_zero", badge: "6" },
  "헬 파이어":       { c1: "#991b1b", c2: "#2a0404", bd: "#fb923c", glyph: "hell_fire", badge: "6" },
  "둠":             { c1: "#581c87", c2: "#090d16", bd: "#e879f9", glyph: "doom_skull", badge: "6" },
  "타임 스탑":       { c1: "#0f766e", c2: "#042f2e", bd: "#fde047", glyph: "hourglass", badge: "6" },
  "카오스 필드":     { c1: "#701a75", c2: "#1e1b4b", bd: "#f0abfc", glyph: "chaos_void", badge: "6" },
  "워드 오브 데스":   { c1: "#111827", c2: "#000000", bd: "#f43f5e", glyph: "reaper", badge: "6" },
  "아크메이지 폼":   { c1: "#b45309", c2: "#3b0764", bd: "#fef08a", glyph: "crown", badge: "6" }
};

function renderSkillGlyphSVG(glyph, strokeCol = "#fde047") {
  const g = (glyph || "").trim();
  if (g.includes("sword") || g === "bash" || g === "charge" || g === "shadow_blade") {
    return `<path d="M7 25 L23 9 M19 8 L25 8 L25 14 M6 22 L11 27" stroke="#fff" stroke-width="2.6" stroke-linecap="round"/><circle cx="22" cy="11" r="3" fill="${strokeCol}"/>`;
  }
  if (g.includes("shield") || g === "immune_dome" || g === "abs_barrier" || g === "mana_barrier" || g === "aura_shield") {
    return `<path d="M16 5 L26 9 V16 C26 22 21 26 16 28 C11 26 6 22 6 16 V9 Z" fill="rgba(255,255,255,0.18)" stroke="#fff" stroke-width="2.2"/><path d="M16 9 V23 M11 15 H21" stroke="${strokeCol}" stroke-width="2"/>`;
  }
  if (g === "whirlwind" || g === "wind_blade" || g === "gale_arrow") {
    return `<path d="M6 12 Q16 4 26 12 Q18 16 10 15 M6 20 Q16 28 26 19" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/><circle cx="16" cy="16" r="2.5" fill="${strokeCol}"/>`;
  }
  if (g === "rage" || g === "roar") {
    return `<path d="M9 24 C8 15 13 8 16 6 C19 8 24 15 23 24 L18 20 L16 25 L14 20 Z" fill="${strokeCol}" stroke="#fff" stroke-width="1.6"/>`;
  }
  if (g === "counter") {
    return `<path d="M8 24 L24 8 M8 8 L24 24" stroke="#fff" stroke-width="2.5" stroke-linecap="round"/><circle cx="16" cy="16" r="4" fill="${strokeCol}"/>`;
  }
  if (g.includes("arrow") || g === "bow" || g === "storm_bow") {
    return `<path d="M9 7 C20 11 20 21 9 25" fill="none" stroke="${strokeCol}" stroke-width="2.2"/><path d="M7 16 H25 M20 11 L26 16 L20 21" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round"/>`;
  }
  if (g === "crosshair" || g === "sniper" || g === "crit_eye" || g === "hawk_eye") {
    return `<circle cx="16" cy="16" r="8" fill="none" stroke="#fff" stroke-width="2"/><path d="M16 4 V28 M4 16 H28" stroke="${strokeCol}" stroke-width="1.8"/><circle cx="16" cy="16" r="2.5" fill="#ef4444"/>`;
  }
  if (g === "healing_light") {
    return `<circle cx="16" cy="16" r="10" fill="rgba(110,231,183,0.22)" stroke="${strokeCol}" stroke-width="1.5"/><path d="M13 7 H19 V13 H25 V19 H19 V25 H13 V19 H7 V13 H13 Z" fill="#4ade80" stroke="#fff" stroke-width="1.6"/><circle cx="8" cy="8" r="1.5" fill="#fef08a"/><circle cx="24" cy="8" r="1.5" fill="#fef08a"/>`;
  }
  if (g === "great_heal") {
    return `<path d="M4 16 C4 9 9 6 16 6 C23 6 28 9 28 16 C25 13 21 12 16 12 C11 12 7 13 4 16 Z" fill="rgba(253,224,71,0.35)"/><path d="M13 6 H19 V13 H26 V19 H19 V26 H13 V19 H6 V13 H13 Z" fill="${strokeCol}" stroke="#fff" stroke-width="1.8"/><path d="M14 9 H18 V14 H23 V18 H18 V23 H14 V18 H9 V14 H14 Z" fill="#4ade80"/>`;
  }
  if (g === "staff_mastery" || g === "mana_stream" || g === "arcane_wisdom") {
    return `<polygon points="16,4 20,12 28,16 20,20 16,28 12,20 4,16 12,12" fill="${strokeCol}" stroke="#fff" stroke-width="1.5"/><circle cx="16" cy="16" r="4" fill="#fff"/>`;
  }
  if (g.includes("heal") || g === "holy_cross" || g.includes("heart")) {
    return `<path d="M16 26 C16 26 7 20 7 12 C7 8.5 10 7 13 8.5 C14.8 9.5 16 11 16 11 C16 11 17.2 9.5 19 8.5 C22 7 25 8.5 25 12 C25 20 16 26 16 26 Z" fill="${strokeCol}" stroke="#fff" stroke-width="1.6"/>`;
  }
  if (g.includes("fire") || g === "meteor" || g === "meteor_swarm" || g === "lava_pillar" || g === "hell_fire") {
    return `<path d="M16 5 C21 11 25 15 23 22 C21 26 17 27 16 27 C12 27 8 23 9 17 C10 14 13 13 13 9 C14 11 15 12 16 5 Z" fill="${strokeCol}" stroke="#fff" stroke-width="1.6"/>`;
  }
  if (g.includes("ice") || g.includes("frost") || g === "snow_storm" || g === "blizzard" || g === "abs_zero") {
    return `<path d="M16 5 V27 M5 16 H27 M8 8 L24 24 M24 8 L8 24" stroke="#fff" stroke-width="2.1" stroke-linecap="round"/><polygon points="16,10 22,16 16,22 10,16" fill="${strokeCol}"/>`;
  }
  if (g.includes("lightning") || g.includes("bolt") || g === "thunder_storm" || g === "paralyze") {
    return `<polygon points="18,4 8,17 15,17 13,28 24,14 17,14" fill="${strokeCol}" stroke="#fff" stroke-width="1.5"/>`;
  }
  if (g.includes("wing") || g.includes("boot") || g === "feather" || g === "vine") {
    return `<path d="M7 22 C10 12 18 7 26 7 C23 15 19 20 11 24 Z" fill="${strokeCol}" stroke="#fff" stroke-width="1.7"/>`;
  }
  if (g === "hourglass") {
    return `<path d="M9 6 H23 L16 16 L23 26 H9 L16 16 Z" fill="rgba(255,255,255,0.2)" stroke="${strokeCol}" stroke-width="2"/>`;
  }
  if (g === "crown") {
    return `<polygon points="6,23 8,10 13,16 16,8 19,16 24,10 26,23" fill="${strokeCol}" stroke="#fff" stroke-width="1.6"/>`;
  }
  if (g === "golem") {
    return `<rect x="9" y="8" width="14" height="16" rx="3" fill="${strokeCol}" stroke="#fff" stroke-width="1.8"/><circle cx="13" cy="14" r="1.8" fill="#000"/><circle cx="19" cy="14" r="1.8" fill="#000"/>`;
  }
  return `<circle cx="16" cy="16" r="7" fill="${strokeCol}" stroke="#fff" stroke-width="2"/><path d="M16 4 V8 M16 24 V28 M4 16 H8 M24 16 H28" stroke="#fff" stroke-width="1.8"/>`;
}

window.getSkillIconHTML = function(name, size = 34) {
  const p = SKILL_SVG_PROFILES[name] || { c1: "#374151", c2: "#111827", bd: "#facc15", glyph: "arcane_orb", badge: "★" };
  const svgInner = renderSkillGlyphSVG(p.glyph, p.bd);
  return `
    <div style="position:relative; width:${size}px; height:${size}px; margin:auto; border-radius:7px; background:linear-gradient(135deg,${p.c1},${p.c2}); border:1.5px solid ${p.bd}; display:flex; align-items:center; justify-content:center; box-shadow:inset 0 0 6px rgba(0,0,0,0.85), 0 1px 3px rgba(0,0,0,0.6); pointer-events:none; overflow:hidden;">
      <svg viewBox="0 0 32 32" width="${Math.round(size * 0.84)}" height="${Math.round(size * 0.84)}" style="filter:drop-shadow(0 1px 2px rgba(0,0,0,0.85));">${svgInner}</svg>
      <span style="position:absolute; right:1px; bottom:0px; font-size:${Math.max(8, Math.round(size * 0.27))}px; font-weight:900; color:#fff; background:rgba(0,0,0,0.72); padding:0 2.5px; border-radius:3px; line-height:1.15; border:0.5px solid ${p.bd};">${p.badge}</span>
    </div>
  `;
};

function getFallbackEmoji(itemId) {
  if (!itemId) return "📦";
  if (itemId.startsWith("BOOK_")) return "📕";
  if (itemId.includes("W_SW") || itemId.endsWith("_SW")) return "🗡️";
  if (itemId.includes("W_BW") || itemId.endsWith("_BW")) return "🏹";
  if (itemId.includes("W_ST") || itemId.endsWith("_ST")) return "🔮";
  if (itemId.includes("W_SH")) return "🛡️";
  if (itemId.includes("A_HE")) return "👑";
  if (itemId.includes("A_AR")) return "🥋";
  if (itemId.includes("A_SH")) return "🥾";
  if (itemId.includes("A_GL")) return "🧤";
  if (itemId.includes("A_CL")) return "🧣";
  if (itemId.includes("A_TS")) return "👕";
  if (itemId.includes("A_BE")) return "🎗️";
  if (itemId.includes("C_P01") || itemId.includes("C_P02")) return "🧪";
  if (itemId.includes("C_P03") || itemId.includes("C_P04")) return "💧";
  if (itemId.includes("C_P05")) return "🍷";
  if (itemId.includes("S_RE")) return "📜";
  if (itemId.includes("S_WE") || itemId.includes("S_AR")) return "✨";
  if (itemId.includes("AC_N")) return "📿";
  if (itemId.includes("AC_E")) return "💠";
  if (itemId.includes("AC_")) return "💍";
  if (itemId.includes("Q_")) return "🦷";
  return "📦";
}

const _itemIconHtmlCache = new Map();
window.getItemIconHTML = function(itemId) {
  if (!itemId) return `<div style="font-size:20px; line-height:1; pointer-events:none;">📦</div>`;
  if (window.itemJsonData && _itemIconHtmlCache.has(itemId)) {
    return _itemIconHtmlCache.get(itemId);
  }
  if (itemId && itemId.startsWith('BOOK_')) {
    const def = window.itemDict?.[itemId];
    const circle = def?.circle || 3;
    const isMage = def?.reqClass === 'wizard';
    const isRanger = def?.reqClass === 'ranger';
    const bg = isMage ? 'linear-gradient(135deg,#1e3a8a,#3b0764)' : (isRanger ? 'linear-gradient(135deg,#065f46,#022c22)' : 'linear-gradient(135deg,#7f1d1d,#450a0a)');
    const bd = circle >= 5 ? '#f59e0b' : (circle >= 4 ? '#60a5fa' : '#4ade80');
    return `<div style="position:relative; width:30px; height:30px; margin:auto; border-radius:5px; background:${bg}; border:1.5px solid ${bd}; display:flex; align-items:center; justify-content:center; pointer-events:none; box-shadow:inset 0 0 5px #000;">
      <span style="font-size:16px; line-height:1;">${isMage ? '📘' : (isRanger ? '📗' : '📕')}</span>
      <span style="position:absolute; right:1px; bottom:0px; font-size:8.5px; font-weight:bold; color:#fde047; background:rgba(0,0,0,0.8); padding:0 2px; border-radius:2px;">${circle}C</span>
    </div>`;
  }

  let lookupId = itemId === 'S_RE01' ? 'S_AR01' : itemId;
  if (lookupId && lookupId.startsWith('QR_')) {
    if (lookupId.endsWith('_SW')) lookupId = 'W_SW05';
    else if (lookupId.endsWith('_BW')) lookupId = 'W_BW05';
    else if (lookupId.endsWith('_ST')) lookupId = 'W_ST05';
  }
  if (window.itemJsonData && window.itemJsonData.items) {
    let itemDef = window.itemJsonData.items.find(i => i.id === lookupId);
    if (itemDef && itemDef.grid) {
      let bgX = -(itemDef.grid.x * window.itemJsonData.gridSize + window.itemJsonData.margin);
      let bgY = -(itemDef.grid.y * window.itemJsonData.gridSize + window.itemJsonData.margin);
      const htmlStr = `<div style="width:${window.itemJsonData.size}px; height:${window.itemJsonData.size}px; background-image:url('./asset/item.png'); background-position:${bgX}px ${bgY}px; background-size:306px 306px; background-repeat:no-repeat; margin:auto; pointer-events:none;"></div>`;
      _itemIconHtmlCache.set(itemId, htmlStr);
      return htmlStr;
    }
  }
  const fbStr = `<div style="font-size:20px; line-height:1; pointer-events:none;">${getFallbackEmoji(itemId)}</div>`;
  if (window.itemJsonData) _itemIconHtmlCache.set(itemId, fbStr);
  return fbStr;
};

// ============================================================================
// 💬 윈도우형 대화창 (드래그 이동 · 8방향 크기조절 · 우측 하단 아이콘 토글 · GM 명령어 바)
// ============================================================================
let currentChatTab = 'all';
let unreadChatCount = 0;
let chatWindowExpanded = false;
let chatOpacityMode = 0; // 0: 기본, 1: 반투명, 2: 고투명
let chatTextOnlyTransparent = false;
const chatCommandHistory = [];
let chatHistoryIdx = -1;
const recentClosedChatLines = [];

function updateClosedChatHudFeed() {
  const feedEl = document.getElementById('hud-closed-chat-feed');
  const win = document.getElementById('chat-window-ui');
  if (!feedEl) return;
  const isChatClosed = !win || win.classList.contains('hidden');
  if (!isChatClosed || recentClosedChatLines.length === 0) {
    feedEl.classList.add('hidden');
    return;
  }
  feedEl.classList.remove('hidden');
  feedEl.innerHTML = recentClosedChatLines.slice(-3).map(item => {
    const col = item.type === 'log-kill' ? '#4ade80' : (item.type === 'log-hit' ? '#f87171' : (item.type === 'log-whisper' ? '#f472b6' : (item.type === 'log-gm' ? '#fde047' : '#f3f4f6')));
    const safeTxt = String(item.text || '').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return `<div class="hud-closed-chat-line" style="color:${col};">${safeTxt}</div>`;
  }).join('');
}

// 대화창 상단 헤더 투명화 토글: 텍스트 빼고 배경 전부 투명 처리 & 투명 전 조정 줄수(높이) 유지 & 상단 복구 버튼 외 터치 비활성화
window.toggleChatTextOnlyTransparency = function(ev) {
  if (ev) ev.stopPropagation();
  const win = document.getElementById('chat-window-ui');
  const chatBox = document.getElementById('chat-box');
  const btn = document.getElementById('chat-trans-toggle-btn');
  if (!win || !chatBox) return;

  chatTextOnlyTransparent = !win.classList.contains('chat-transparent-mode');
  if (chatTextOnlyTransparent) {
    const boxRect = chatBox.getBoundingClientRect();
    const winRect = win.getBoundingClientRect();
    const lockedBoxH = Math.max(44, Math.min(260, Math.round(boxRect.height || 110)));
    win.dataset.savedWinHeight = win.style.height || `${Math.round(winRect.height)}px`;
    chatBox.style.height = `${lockedBoxH}px`;
    chatBox.style.maxHeight = `${lockedBoxH}px`;
    chatBox.style.flex = 'none';
    win.classList.add('chat-transparent-mode');
    document.body.classList.add('chat-is-transparent');
    if (btn) {
      btn.innerText = '🔄 원래대로';
      btn.title = '터치 시 대화창 원래 상태로 복구';
    }
  } else {
    win.classList.remove('chat-transparent-mode');
    document.body.classList.remove('chat-is-transparent');
    chatBox.style.height = '';
    chatBox.style.maxHeight = '';
    chatBox.style.flex = '1';
    if (win.dataset.savedWinHeight) {
      win.style.height = win.dataset.savedWinHeight;
    }
    if (btn) {
      btn.innerText = '👁️ 투명화';
      btn.title = '터치 시 텍스트만 남기고 배경 투명화 (다시 터치 시 원상태 복구)';
    }
  }
  chatBox.scrollTop = chatBox.scrollHeight;
};

window.toggleChatWindow = function(forceOpen = null) {
  const win = document.getElementById('chat-window-ui');
  const fab = document.getElementById('chat-toggle-fab');
  const badge = document.getElementById('chat-unread-badge');
  if (!win) return;

  const shouldOpen = typeof forceOpen === 'boolean' ? forceOpen : win.classList.contains('hidden');
  if (shouldOpen) {
    win.classList.remove('hidden');
    if (fab) fab.classList.add('active');
    unreadChatCount = 0;
    if (badge) {
      badge.innerText = '0';
      badge.classList.add('hidden');
    }
    window.bringModalToFront?.(win);
    const chatBox = document.getElementById('chat-box');
    if (chatBox) chatBox.scrollTop = chatBox.scrollHeight;
  } else {
    win.classList.add('hidden');
    document.body.classList.remove('chat-is-transparent');
    if (fab) fab.classList.remove('active');
  }
  if (shouldOpen && win.classList.contains('chat-transparent-mode')) {
    document.body.classList.add('chat-is-transparent');
  }
  updateClosedChatHudFeed();
};

window.toggleChatWindowExpand = function() {
  const win = document.getElementById('chat-window-ui');
  if (!win) return;
  chatWindowExpanded = !chatWindowExpanded;
  if (chatWindowExpanded) {
    win.style.width = `${Math.min(window.innerWidth - 16, 660)}px`;
    win.style.height = `${Math.min(Math.round(window.innerHeight * 0.62), 460)}px`;
  } else {
    win.style.width = `${Math.min(window.innerWidth - 20, 460)}px`;
    win.style.height = `230px`;
  }
  const chatBox = document.getElementById('chat-box');
  if (chatBox) chatBox.scrollTop = chatBox.scrollHeight;
};

window.cycleChatWindowOpacity = function() {
  const win = document.getElementById('chat-window-ui');
  if (!win) return;
  chatOpacityMode = (chatOpacityMode + 1) % 3;
  win.classList.remove('opacity-mid', 'opacity-low');
  if (chatOpacityMode === 1) win.classList.add('opacity-mid');
  else if (chatOpacityMode === 2) win.classList.add('opacity-low');
};

const CHAT_CHANNEL_META = {
  normal:  { label: '일반 ▾',   color: '#fde047', border: '#6b5535', bg: '#1f2937' },
  world:   { label: '전체 ▾',   color: '#38bdf8', border: '#0284c7', bg: '#0c4a6e' },
  region:  { label: '지역 ▾',   color: '#86efac', border: '#16a34a', bg: '#064e3b' },
  party:   { label: '파티 ▾',   color: '#67e8f9', border: '#0891b2', bg: '#164e63' },
  whisper: { label: '귓속말 ▾', color: '#f472b6', border: '#db2777', bg: '#500724' },
  cmd:     { label: '명령어 ▾', color: '#c084fc', border: '#9333ea', bg: '#3b0764' },
  gm:      { label: '운영자 ▾', color: '#fef08a', border: '#facc15', bg: '#78350f' }
};

window.updateChatChannelBadgeUI = function(chKey) {
  const sel = document.getElementById('chat-channel-select');
  const btn = document.getElementById('chat-channel-btn');
  const key = CHAT_CHANNEL_META[chKey] ? chKey : 'normal';
  if (sel) sel.value = key;
  if (btn) {
    const m = CHAT_CHANNEL_META[key];
    btn.innerText = m.label;
    btn.style.color = m.color;
    btn.style.borderColor = m.border;
    btn.style.background = m.bg;
  }
};

window.toggleCustomChatChannelMenu = function(ev) {
  if (ev) ev.stopPropagation();
  const pop = document.getElementById('chat-channel-popup');
  if (!pop) return;
  const gmItem = document.getElementById('chat-ch-gm-item');
  if (gmItem) gmItem.classList.toggle('hidden', !window.player?.isAdmin);
  pop.classList.toggle('hidden');
};

document.addEventListener('pointerdown', (e) => {
  const pop = document.getElementById('chat-channel-popup');
  const btn = document.getElementById('chat-channel-btn');
  if (pop && !pop.classList.contains('hidden') && !pop.contains(e.target) && e.target !== btn) {
    pop.classList.add('hidden');
  }
});

window.selectCustomChatChannel = function(chKey, ev) {
  if (ev) ev.stopPropagation();
  const pop = document.getElementById('chat-channel-popup');
  if (pop) pop.classList.add('hidden');
  window.updateChatChannelBadgeUI(chKey);

  const inp = document.getElementById('chat-msg-input');
  if (!inp) return;
  const cur = inp.value.replace(/^\/(전체|외치기|월드|지역|일반|파티|p|귓속말|귓|w|공지)\s*/i, '');
  if (chKey === 'world') inp.value = `/전체 ${cur}`;
  else if (chKey === 'region') inp.value = `/지역 ${cur}`;
  else if (chKey === 'party') inp.value = `/파티 ${cur}`;
  else if (chKey === 'whisper') inp.value = `/귓속말 ${cur}`;
  else if (chKey === 'gm') inp.value = `/공지 ${cur}`;
  else if (chKey === 'cmd') inp.value = cur.startsWith('/') ? cur : `/${cur}`;
  else inp.value = cur;
  inp.focus();
};

window.onChatMsgInputLiveUpdate = function() {
  const inp = document.getElementById('chat-msg-input');
  if (!inp) return;
  const v = inp.value.trim();
  if (!v.startsWith('/')) return;
  const cmd = v.split(/\s+/)[0].toLowerCase();
  if (cmd === '/전체' || cmd === '/외치기' || cmd === '/월드') {
    window.updateChatChannelBadgeUI('world');
  } else if (cmd === '/지역' || cmd === '/일반') {
    window.updateChatChannelBadgeUI('region');
  } else if (['/파티', '/p', '/파티초대', '/초대', '/파티가입', '/파티신청', '/파티합류', '/파티장요구', '/파티장신청', '/파티장양보', '/파장요구', '/파장', '/파티탈퇴', '/파티위임'].includes(cmd)) {
    window.updateChatChannelBadgeUI('party');
  } else if (cmd === '/귓속말' || cmd === '/귓' || cmd === '/w') {
    window.updateChatChannelBadgeUI('whisper');
  } else if (['/공지', '/무적', '/투명', '/완전회복', '/전체버프', '/모든스킬습득', '/올강화', '/보스소환', '/학살', '/몬스터초기화', '/바닥청소', '/소환', '/아이템', '/레벨', '/골드', '/스탯', '/이속', '/이동', '/출두', '/소환유저', '/전체소환', '/운영자모드', '/운영자'].includes(cmd)) {
    window.updateChatChannelBadgeUI(window.player?.isAdmin ? 'gm' : 'cmd');
  } else {
    window.updateChatChannelBadgeUI('cmd');
  }
};

window.onChatChannelSelectChange = function() {
  const sel = document.getElementById('chat-channel-select');
  if (sel) window.selectCustomChatChannel(sel.value);
};

window.triggerAdminRebootServer = function() {
  if (!window.player?.isAdmin) {
    window.addChat?.('🔒 [권한 필요] 운영자 모드(/운영자모드) 활성화 후 사용할 수 있습니다.', 'log-hit');
    return;
  }
  window.fillChatCommand('/서버재부팅', true);
};
window.fillChatCommand = function(cmdStr, autoSend = false) {
  const win = document.getElementById('chat-window-ui');
  if (win && win.classList.contains('hidden')) window.toggleChatWindow(true);
  const inp = document.getElementById('chat-msg-input');
  if (!inp) return;
  inp.value = cmdStr;
  window.onChatMsgInputLiveUpdate?.();
  if (autoSend) {
    window.sendMultiplayerChat?.();
  } else {
    inp.focus();
    inp.setSelectionRange(inp.value.length, inp.value.length);
  }
};

window.handleChatInputKeydown = function(ev) {
  if (ev.key === 'Enter') {
    ev.preventDefault();
    window.sendMultiplayerChat?.();
    return;
  }
  if (ev.key === 'ArrowUp') {
    if (chatCommandHistory.length === 0) return;
    ev.preventDefault();
    if (chatHistoryIdx < chatCommandHistory.length - 1) chatHistoryIdx++;
    const inp = document.getElementById('chat-msg-input');
    if (inp) inp.value = chatCommandHistory[chatCommandHistory.length - 1 - chatHistoryIdx] || '';
  } else if (ev.key === 'ArrowDown') {
    if (chatCommandHistory.length === 0) return;
    ev.preventDefault();
    const inp = document.getElementById('chat-msg-input');
    if (chatHistoryIdx > 0) {
      chatHistoryIdx--;
      if (inp) inp.value = chatCommandHistory[chatCommandHistory.length - 1 - chatHistoryIdx] || '';
    } else {
      chatHistoryIdx = -1;
      if (inp) inp.value = '';
    }
  }
};

function setupChatWindowDragAndResize() {
  const win = document.getElementById('chat-window-ui');
  const header = document.getElementById('chat-win-drag-handle');
  if (!win || !header) return;

  const ensureAbsoluteLeftTop = () => {
    const rect = win.getBoundingClientRect();
    const parentRect = (win.offsetParent || document.body).getBoundingClientRect();
    win.style.bottom = 'auto';
    win.style.right = 'auto';
    win.style.left = `${Math.max(2, rect.left - parentRect.left)}px`;
    win.style.top = `${Math.max(2, rect.top - parentRect.top)}px`;
    win.style.width = `${rect.width}px`;
    win.style.height = `${rect.height}px`;
  };

  win.addEventListener('pointerdown', () => {
    window.bringModalToFront?.(win);
  });

  // 1) 상단 헤더 드래그 이동
  let isDragging = false;
  let dragStartX = 0, dragStartY = 0;
  let initLeft = 0, initTop = 0;

  header.addEventListener('pointerdown', (e) => {
    if (e.target.tagName === 'BUTTON' || e.target.closest('button')) return;
    ensureAbsoluteLeftTop();
    isDragging = true;
    dragStartX = e.clientX;
    dragStartY = e.clientY;
    initLeft = parseFloat(win.style.left) || 0;
    initTop = parseFloat(win.style.top) || 0;
    try { header.setPointerCapture(e.pointerId); } catch (err) {}
  });

  header.addEventListener('pointermove', (e) => {
    if (!isDragging) return;
    const dx = e.clientX - dragStartX;
    const dy = e.clientY - dragStartY;
    const maxL = Math.max(0, window.innerWidth - 80);
    const maxT = Math.max(32, window.innerHeight - 60);
    win.style.left = `${Math.max(-20, Math.min(maxL, initLeft + dx))}px`;
    win.style.top = `${Math.max(32, Math.min(maxT, initTop + dy))}px`;
  });

  const endHeaderDrag = () => { isDragging = false; };
  header.addEventListener('pointerup', endHeaderDrag);
  header.addEventListener('pointercancel', endHeaderDrag);

  // 2) 8방향 모서리/테두리 크기 조절 (Resize Handles)
  const handles = win.querySelectorAll('.chat-resize-handle');
  handles.forEach(handle => {
    let isResizing = false;
    let dir = handle.getAttribute('data-dir') || 'se';
    let rStartX = 0, rStartY = 0;
    let sLeft = 0, sTop = 0, sWidth = 0, sHeight = 0;

    handle.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      ensureAbsoluteLeftTop();
      isResizing = true;
      rStartX = e.clientX;
      rStartY = e.clientY;
      sLeft = parseFloat(win.style.left) || 0;
      sTop = parseFloat(win.style.top) || 0;
      sWidth = parseFloat(win.style.width) || 420;
      sHeight = parseFloat(win.style.height) || 220;
      try { handle.setPointerCapture(e.pointerId); } catch (err) {}
    });

    handle.addEventListener('pointermove', (e) => {
      if (!isResizing) return;
      e.stopPropagation();
      const dx = e.clientX - rStartX;
      const dy = e.clientY - rStartY;
      const minW = 250;
      const minH = 145;
      const maxW = window.innerWidth - 8;
      const maxH = window.innerHeight - 40;

      let newL = sLeft, newT = sTop, newW = sWidth, newH = sHeight;

      if (dir.includes('e')) {
        newW = Math.max(minW, Math.min(maxW - sLeft, sWidth + dx));
      }
      if (dir.includes('s')) {
        newH = Math.max(minH, Math.min(maxH - sTop, sHeight + dy));
      }
      if (dir.includes('w')) {
        const possibleW = sWidth - dx;
        if (possibleW >= minW && sLeft + dx >= 2) {
          newW = possibleW;
          newL = sLeft + dx;
        }
      }
      if (dir.includes('n')) {
        const possibleH = sHeight - dy;
        if (possibleH >= minH && sTop + dy >= 32) {
          newH = possibleH;
          newT = sTop + dy;
        }
      }

      win.style.left = `${Math.round(newL)}px`;
      win.style.top = `${Math.round(newT)}px`;
      win.style.width = `${Math.round(newW)}px`;
      win.style.height = `${Math.round(newH)}px`;
    });

    const endResize = () => { isResizing = false; };
    handle.addEventListener('pointerup', endResize);
    handle.addEventListener('pointercancel', endResize);
  });
}

window.setChatTab = function(tab) {
  currentChatTab = tab;
  document.querySelectorAll('.chat-tab').forEach(el => {
    if (el.getAttribute('data-tab') === tab) el.classList.add('active');
    else el.classList.remove('active');
  });
  if (tab === 'all' || tab === 'chat') window.updateChatChannelBadgeUI?.('normal');
  else if (tab === 'party') window.updateChatChannelBadgeUI?.('party');
  else if (tab === 'whisper') window.updateChatChannelBadgeUI?.('whisper');
  else if (tab === 'gm') {
    window.updateChatChannelBadgeUI?.('gm');
    const gmBar = document.getElementById('gm-quick-cmd-bar');
    if (gmBar && player.isAdmin) gmBar.classList.remove('hidden');
  }
  window.applyChatFilter();
};

window.applyChatFilter = function() {
  const chatBox = document.getElementById('chat-box');
  if (!chatBox) return;
  const excludeSys = document.getElementById('exclude-sys-chk')?.checked || false;
  const isAdminNow = Boolean(window.player?.isAdmin);

  Array.from(chatBox.children).forEach(msgEl => {
    const cat = msgEl.getAttribute('data-cat') || 'sys';
    let show = true;
    // 일반 유저 상태에서는 운영자(gm) 섹션 텍스트 숨김 (전체 공지 배너 외 운영자 로그 비노출)
    if (!isAdminNow && cat === 'gm') show = false;
    if (excludeSys && cat === 'sys') show = false;
    if (currentChatTab === 'sys' && cat !== 'sys') show = false;
    if (currentChatTab === 'chat' && cat !== 'chat' && cat !== 'world' && cat !== 'whisper' && cat !== 'party') show = false;
    if (currentChatTab === 'party' && cat !== 'party') show = false;
    if (currentChatTab === 'whisper' && cat !== 'whisper') show = false;
    if (currentChatTab === 'gm' && cat !== 'gm') show = false;
    msgEl.style.display = show ? 'block' : 'none';
  });
  chatBox.scrollTop = chatBox.scrollHeight;
};

window.addChat = function(text, type = 'log-sys', category = null) {
  const chatBox = document.getElementById('chat-box');
  if (!chatBox) return;
  const el = document.createElement('div');
  el.className = type;

  let cat = category;
  if (!cat) {
    if (type === 'log-party' || text.includes('[파티]')) cat = 'party';
    else if (type === 'log-whisper' || text.includes('귓속말')) cat = 'whisper';
    else if (type === 'log-gm' || (text.startsWith('👑') && !text.includes('[파티'))) cat = 'gm';
    else if (type === 'log-chat' || type === 'log-world' || text.startsWith('💬') || text.startsWith('📢')) cat = 'chat';
    else cat = 'sys';
  }
  el.setAttribute('data-cat', cat);
  el.innerText = text;

  const excludeSys = document.getElementById('exclude-sys-chk')?.checked || false;
  const isAdminNow = Boolean(window.player?.isAdmin);
  let show = true;
  if (!isAdminNow && cat === 'gm') show = false;
  if (excludeSys && cat === 'sys') show = false;
  if (currentChatTab === 'sys' && cat !== 'sys') show = false;
  if (currentChatTab === 'chat' && cat !== 'chat' && cat !== 'world' && cat !== 'whisper' && cat !== 'party') show = false;
  if (currentChatTab === 'party' && cat !== 'party') show = false;
  if (currentChatTab === 'whisper' && cat !== 'whisper') show = false;
  if (currentChatTab === 'gm' && cat !== 'gm') show = false;
  el.style.display = show ? 'block' : 'none';

  chatBox.appendChild(el);
  if (chatBox.children.length > 250) chatBox.removeChild(chatBox.firstChild);
  chatBox.scrollTop = chatBox.scrollHeight;

  recentClosedChatLines.push({ text, type, cat });
  if (recentClosedChatLines.length > 2) recentClosedChatLines.shift();
  updateClosedChatHudFeed();

  const win = document.getElementById('chat-window-ui');
  if (win && win.classList.contains('hidden') && (cat === 'chat' || cat === 'whisper' || cat === 'gm')) {
    unreadChatCount++;
    const badge = document.getElementById('chat-unread-badge');
    if (badge) {
      badge.innerText = unreadChatCount > 99 ? '99+' : String(unreadChatCount);
      badge.classList.remove('hidden');
    }
  }
};

// ============================================================================
// ❓ 전역 도움말(?) 팝업 시스템 & 최상위 모달 포커스(bringModalToFront)
// ============================================================================
const HELP_CONTENTS = {
  merc: {
    title: "⚔️ 용병 제어 · 아이템 보급 · 생존 AI 도움말",
    body: `
      • <b>용병 HUD 터치</b>: 우측 <b>용병 HUD 짧게 터치</b> 시 힐/버프 지원대상으로 지정, <b>길게 누르면</b> 용병 관리창 오픈!<br>
      • <b>⚡ 아이템 보급</b>: 용병 창에서 <b>[⚡아이템보급]</b> 클릭 시 내 가방에 있는 더 좋은 장비와 물약을 자동으로 가져와 착용합니다.<br>
      • <b>전술 스탠스</b>: <b>공격</b>(적극교전) · <b>보조</b>(힐+점사협공) · <b>대기</b>(추종/회피)<br>
      • <b>카이팅·회피 AI</b>: 몬스터 접근 시 피격 전 회피 기동 후 플레이어 타겟을 함께 점사하며, 물약 소진 및 체력 20% 이하 시 플레이어 주변을 돌며 생존 기동합니다.
    `
  },
  equip: {
    title: "🛡️ 14부위 장착 · 스탯 · 고강화 각성 도움말",
    body: `
      • <b>14부위 착용</b>: 투구1·목걸이1·귀걸이2·반지2·장갑1·무기1·방패1·벨트1·갑옷1·신발1·티셔츠1·망토1 (빈 슬롯 터치 시 가방 장비 즉시 장착!)<br>
      • <b>📊 스탯 분배</b>: 좌측 <b>[스탯 분배]</b> 버튼으로 STR(전사)·DEX(궁수)·INT(마법사)·CON(체력/방어)을 성장시킬 수 있습니다.<br>
      • <b>무기 각성</b>: +6 안전 | <b>+7</b> 방어관통+5% · <b>+9</b> 쿨감-8% · <b>+10+</b> 보스추뎀+10%<br>
      • <b>방어구/장신구</b>: +4 안전 | <b>+7</b> 피해감소+3% · <b>+9</b> 쿨감-2% · <b>+10+</b> 보스피감+4%·올스탯+1
    `
  },
  stat: {
    title: "📊 스탯 분배 · 능력치 성장 도움말",
    body: `
      • <b>근력(STR)</b>: 전사 주스탯 · 근접 물리 공격력 및 치명타 피해 상승<br>
      • <b>민첩(DEX)</b>: 궁수 주스탯 · 원거리 물리 공격력, 명중률, 치명타율, 회피율 상승<br>
      • <b>지능(INT)</b>: 마법사 주스탯 · 마법 공격력, 최대 MP, 힐링 회복량 상승<br>
      • <b>체력(CON)</b>: 전 직업 공통 · 최대 HP, 물리/마법 방어 보조, 방패 블록률 상승<br>
      • <b>스탯 초기화</b>: 50레벨 단위마다 무료 스탯 전체 회수 기회가 해금됩니다.
    `
  },
  inventory: {
    title: "🎒 가방 정렬 · 다중 판매 · 인챈트 도움말",
    body: `
      • <b>🧹 정렬 · ⚡ 아이템보급</b>: 물약→장비→주문서 순 자동 정렬 및 <b>[⚡아이템보급]</b>으로 용병에게 상위 장비를 즉시 보급합니다.<br>
      • <b>💰 판매 · 다중 선택</b>: 단건 선택 판매 시 수량 조절창이 뜨며, <b>[다중 선택]</b> 체크 후 여러 아이템이나 복수 수량 묶음을 한 번에 판매/버리기 할 수 있습니다.<br>
      • <b>📕 미습득 표시</b>: 아직 배우지 않은 마법서·비급서는 슬롯 좌상단에 초록색 <b>[미습득]</b> 배지가 표시됩니다.<br>
      • <b>✨ 인챈트</b>: 주문서 더블터치 또는 상세창 [✨강화시도] 버튼으로 장비를 강화합니다.
    `
  },
  skill: {
    title: "📕 서클별 스킬 · 패시브 · 아군버프 도움말",
    body: `
      • <b>패시브 해금</b>: <b>Lv.1</b>(마스터리) → <b>Lv.12</b>(중급오라) → <b>Lv.28</b>(상급각성)<br>
      • <b>습득처</b>: 마법사 1~2서클(NPC)/3~6서클(몬스터 드롭) | 전사·궁수 1서클(NPC)/2~3서클(몬스터 드롭)<br>
      • <b>퀵슬롯 자동 시전</b>: 하단 퀵슬롯에 등록한 스킬/물약을 <b>위로 스와이프(또는 우클릭)</b>하면 자동사냥 시 자동 발동됩니다.<br>
      • <b>아군 힐/버프</b>: 용병 HUD나 파티원 HUD 선택 후 힐링·버프 시전 가능
    `
  },
  quest: {
    title: "📜 퀘스트 · 방향 화살표 · 전용 무기 도움말",
    body: `
      • <b>진행/보상</b>: 각 마을(S)·야영지(S1) 퀘스트 NPC를 통해 수락 및 보상 수령 (현재 진행 중인 마지막 임무로 자동 포커스)<br>
      • <b>🧭 방향 화살표</b>: 퀘스트 해당 지역에 있을 때 다음 목표 방향을 캐릭터 주변 연한 화살표로 안내합니다 (옵션에서 ON/OFF 가능).<br>
      • <b>[퀘스트전용] 보상</b>: 각 지역 최종 보스 임무 완료 시 클래스 맞춤 고성능 무기 지급
    `
  },
  option: {
    title: "⚙️ 서버 동기화 · 절전방지 · 루팅 도움말",
    body: `
      • <b>서버 시간 · 실시간 동기화</b>: 모든 플레이어와 몬스터는 동일한 서버 시간대를 공유하며 수파베이스 DB와 실시간 연동됩니다.<br>
      • <b>💡 화면 항상 켜기</b>: 전체화면 및 자동사냥 중 화면 꺼짐(절전모드)을 방지합니다.<br>
      • <b>🧭 퀘스트 화살표</b>: 퀘스트 목표 방향 화살표 표시 여부를 켜고 끌 수 있습니다.<br>
      • <b>💎 루팅 필터</b>: 설정 등급 이상의 장비만 자동 루팅 (골드·물약·주문서·비전서는 항상 루팅)
    `
  },
  party: {
    title: "🎗️ 파티 시스템 · 점사 모드 도움말",
    body: `
      • <b>비차단 파티 초대</b>: 파티 요청이 와도 <b>자동사냥이 끊기지 않으며</b>, 10초 무반응 시 초대창이 자동으로 닫힙니다.<br>
      • <b>🎯 점사모드 vs 🏃 자유사냥</b>: 파티장이 <b>[점사모드]</b> 설정 시 파티원들과 용병이 파티장의 타겟을 최우선으로 함께 집중 공격합니다.<br>
      • <b>파티원 버프/힐</b>: 우측 파티원 HUD를 짧게 터치하면 지원 대상으로 지정되며, 길게 누르면 파티 설정창이 열립니다.
    `
  },
  immersive: {
    title: "📖 에테르 도감 · 20대 몰입형 콘텐츠 도움말",
    body: `
      • <b>1차 콘텐츠(1~10)</b>: 몬스터 생태 도감, 지역 수호 칭호, 에테르 보물 고블린, 균열 엘리트 챔피언, 무기 5대 원소 공명, 보스 기여도 전광판 & 파티 주사위, 에테르 연대기(15장), 모닥불 온기 & 음유시인 담화, 차원 마나 기류(실시간 날씨), 용병 유대감 & 전술 대사<br>
      • <b>2차 콘텐츠(11~20)</b>: 왕립 일일 현상수배 게시판, 무기 숙련도 & 전장의 훈장, 고대 에테르 성물함, 차원 방랑 상인 아카샤, 에테르 12성좌 오늘의 운세, 모험가 길드 명예 등급, 보스 토벌전 전술 브리핑, 대장장이 토르딘의 명장 각인, 15차원 탐사 발자취 지도, 연속 사냥 콤보 & 각성 피버<br>
      • <b>조작 안내</b>: 상단 탭을 눌러 각 콘텐츠 현황을 확인하고 원소 공명·칭호 장착·각인·보급 수령을 진행하세요.
    `
  },
  guide: {
    title: "🎓 초보자 마을 왕립 가이드 도움말",
    body: `
      • <b>왕립 안내관 루시</b>: 초보자 마을(알트리아) 광장에서 모험가님께 조작법, 전투·자동사냥, 용병 보급·전술, 스킬 서클, 강화, 파티 점사, 에테르 도감 20종까지 게임의 모든 핵심 기능을 안내합니다.<br>
      • 상단 분야별 탭을 눌러 궁금한 항목을 언제든 배경 암전 없이 선명하게 확인하세요!
    `
  },
  bank: {
    title: "🏦 계정 통합 창고 · 성소 회복 도움말",
    body: `
      • <b>계정 공유</b>: 창고에 보관한 아이템(최대 60칸)과 골드는 같은 계정 내 3개 슬롯의 모든 캐릭터가 함께 공유합니다.<br>
      • <b>무료 치유</b>: [✨ 무료 HP/MP 회복] 버튼으로 캐릭터와 용병의 체력/마나를 즉시 100% 회복할 수 있습니다.
    `
  },
  scroll: {
    title: "📜 마법 주문서 · 장비 안전 강화 도움말",
    body: `
      • <b>안전 인챈트 구간</b>: 무기는 <b>+6까지</b>, 방어구·장신구는 <b>+4까지 100% 안전하게 강화</b>됩니다.<br>
      • <b>고강화 도전</b>: 안전 구간 이후 강화 성공 시 방어관통·쿨타임 감소·보스 추가피해 등 강력한 각성 옵션이 해금됩니다.
    `
  },
  merchant: {
    title: "🛒 잡화 상점 · 대량 구매 도움말",
    body: `
      • <b>물약 & 기초장비</b>: 체력/마나 물약, 가속 물약(촐기), 전직업 기본 장비를 판매합니다.<br>
      • <b>묶음 구매</b>: <b>[x1] [x10] [x50]</b> 버튼으로 물약과 귀환 주문서를 빠르게 대량 구매할 수 있습니다.
    `
  },
  chat: {
    title: "💬 대화창 · 명령어 · 투명모드 도움말",
    body: `
      • <b>창 제어</b>: 상단 바를 드래그해 위치를 옮기거나 모서리를 끌어 크기를 조절하고, <b>[💧투명]</b> 버튼으로 배경만 투명하게 전환할 수 있습니다.<br>
      • <b>주요 명령어</b>: <b>/파티초대 이름</b>, <b>/파티탈퇴</b>, <b>/누구</b> 등을 지원합니다.
    `
  },
  class_create: {
    title: "⚔️ 클래스 특징 도움말",
    body: `
      • <b>인간전사(STR)</b>: 검·방패 착용, 높은 체력/방어, 배쉬(기절)·휠윈드(광역)·차지(돌진)·아이언월/배틀크라이(방어버프)<br>
      • <b>엘프궁수(DEX)</b>: 양손활 착용, 원거리 고속 사격·카이팅, 네이처스 터치(자체/아군 힐)<br>
      • <b>엘프마법사(INT)</b>: 지팡이 착용, 1~6서클 광역 마법 및 힐링·쉴드·헤이스트·뮨 아군 지원
    `
  }
};

// 화면 전체 암전(dimming) 없이 최상단에 읽기 편한 크기로 선명하게 뜨는 비차단형 도움말 팝업
window.showHelpModal = function(topicKey, ev) {
  if (ev) ev.stopPropagation();
  let pop = document.getElementById('global-help-popover');
  if (!pop) {
    pop = document.createElement('div');
    pop.id = 'global-help-popover';
    pop.style.cssText = 'position:fixed; top:12px; left:50%; transform:translateX(-50%); z-index:999999; display:none; width:min(94vw, 355px); max-height:78dvh; background:transparent; pointer-events:auto;';
    document.body.appendChild(pop);
    document.addEventListener('pointerdown', (e) => {
      if (pop.style.display !== 'none' && !pop.contains(e.target) && !e.target.classList?.contains('help-q-btn')) {
        pop.style.display = 'none';
      }
    });
  }
  if (pop.style.display === 'block' && pop.getAttribute('data-topic') === topicKey) {
    pop.style.display = 'none';
    return;
  }
  pop.setAttribute('data-topic', topicKey);
  const info = HELP_CONTENTS[topicKey] || HELP_CONTENTS.inventory;
  pop.innerHTML = `
    <div onclick="event.stopPropagation()" style="background:rgba(17, 20, 28, 0.97); border:2px solid #facc15; border-radius:10px; padding:10px 12px; color:#f9fafb; box-shadow:0 8px 24px rgba(0,0,0,0.75); max-height:74dvh; overflow-y:auto;">
      <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #4a3b2c; padding-bottom:6px; margin-bottom:7px; gap:6px;">
        <span style="font-size:13.5px; font-weight:900; color:#fde047; line-height:1.3;">${info.title}</span>
        <button onclick="document.getElementById('global-help-popover').style.display='none'" style="background:#7f1d1d; color:#fff; border:1px solid #f87171; border-radius:5px; padding:2px 8px; font-size:11.5px; font-weight:bold; cursor:pointer; flex-shrink:0;">✕</button>
      </div>
      <div style="font-size:12.5px; line-height:1.58; color:#f3f4f6; word-break:keep-all;">${info.body}</div>
    </div>
  `;
  pop.style.display = 'block';
};

let modalsInitialized = false;
function ensureAllGameModals() {
  if (modalsInitialized) return;
  modalsInitialized = true;

  if (!document.getElementById('dynamic-rpg-modals-style')) {
    const style = document.createElement('style');
    style.id = 'dynamic-rpg-modals-style';
    style.innerHTML = `
      @keyframes mePulse {
        0% { transform: translate(-50%, -50%) scale(1); box-shadow: 0 0 0 0 rgba(74, 222, 128, 0.9); }
        70% { transform: translate(-50%, -50%) scale(1.2); box-shadow: 0 0 0 8px rgba(74, 222, 128, 0); }
        100% { transform: translate(-50%, -50%) scale(1); box-shadow: 0 0 0 0 rgba(74, 222, 128, 0); }
      }
      .rpg-overlay-modal { position:fixed !important; inset:0 !important; width:100vw !important; height:100dvh !important; background:rgba(0,0,0,0.45) !important; backdrop-filter:none !important; z-index:25000 !important; display:none; align-items:center !important; justify-content:center !important; padding:8px !important; pointer-events:auto !important; }
      .rpg-overlay-modal.active-modal { display:flex !important; }
      .rpg-modal-box { position:relative; width:min(92vw, 460px); height:min(86dvh, 820px); flex:0 0 auto; background:#141210; border:2px solid #b45309; border-radius:10px; display:flex; flex-direction:column; overflow:hidden; box-shadow:0 0 35px #000; color:#fff; }
      .rpg-close-floating { position:absolute; top:8px; right:8px; background:rgba(153,27,27,0.9); color:#fff; border:1px solid #f87171; border-radius:6px; padding:4px 10px; cursor:pointer; font-weight:bold; font-size:12px; z-index:60; box-shadow:0 2px 6px #000; }
      .rpg-close-floating:hover { background:#dc2626; }

      /* 모든 모달 창이 화면 크기에 맞게 정중앙에 오도록 설정 및 작은 화면 잘림 방지 */
      .modal-panel {
        max-height: min(76dvh, calc(100dvh - 158px)) !important;
        max-width: min(92vw, 356px) !important;
        width: min(90vw, 348px) !important;
        overflow: hidden !important;
      }
      #option-ui.modal-panel {
        width: min(90vw, 336px) !important;
        max-width: min(92vw, 340px) !important;
      }
      .status-layout {
        height: 360px !important;
      }
      .paperdoll-right {
        display: grid !important;
        grid-template-columns: repeat(3, 1fr) !important;
        grid-template-rows: repeat(5, 1fr) !important;
        align-items: center !important;
        justify-items: center !important;
        padding: 4px 4px 12px 4px !important;
        gap: 4px 3px !important;
      }
      .pd-slot-grid {
        position: relative !important;
        width: 36px !important;
        height: 36px !important;
        margin-bottom: 10px !important;
        background: rgba(12, 14, 20, 0.78);
        border: 1.5px solid #5a462a;
        border-radius: 6px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 18px;
        cursor: pointer;
        box-shadow: inset 0 0 6px rgba(0,0,0,0.85), 0 1px 4px rgba(0,0,0,0.75);
        transition: transform 0.1s, border-color 0.15s;
      }
      .pd-slot-grid:hover {
        border-color: #facc15 !important;
        transform: scale(1.04);
      }
      .pd-slot-grid::after {
        content: attr(data-name);
        position: absolute;
        bottom: -13px;
        font-size: 9.5px;
        color: #e5e7eb;
        font-weight: bold;
        text-shadow: 1px 1px 2px #000, -1px -1px 2px #000;
        white-space: nowrap;
        z-index: 10;
      }
      #item-detail, #skill-detail {
        min-height: 104px !important;
        padding: 8px 10px !important;
        font-size: 12.5px !important;
        line-height: 1.48 !important;
        background: #090b10 !important;
        border: 1.5px solid #5a462a !important;
        border-radius: 6px !important;
      }
      #merc-item-detail {
        min-height: 64px !important;
        padding: 6px 8px !important;
        font-size: 12px !important;
        line-height: 1.45 !important;
      }
      .help-q-btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 18px;
        height: 18px;
        margin-left: 5px;
        border-radius: 50%;
        background: #1e3a8a;
        border: 1px solid #60a5fa;
        color: #eff6ff;
        font-size: 11px;
        font-weight: 900;
        cursor: pointer;
        vertical-align: middle;
        line-height: 1;
        padding: 0;
      }
      .help-q-btn:hover { background: #2563eb; border-color: #fde047; }

      .tmj-portal-zone {
        position:absolute;
        background:transparent !important;
        border:none !important;
        outline:none !important;
        cursor:pointer;
        z-index:25;
      }

      .auto-active {
        border: 2px solid #ef4444 !important;
        box-shadow: 0 0 10px #ef4444, inset 0 0 8px rgba(239, 68, 68, 0.75) !important;
      }

      .detail-me-marker { position:absolute; transform:translate(-50%,-50%); pointer-events:none; z-index:45; }
      .shop-list { display:flex; flex-direction:column; gap:5px; max-height:42vh; overflow-y:auto; padding-right:2px; }
      .shop-row { display:flex; justify-content:space-between; align-items:center; background:#1f1c18; border:1px solid #3d3020; border-radius:6px; padding:5px 7px; gap:6px; }
      .shop-buy-btn { background:#b45309; color:#fff; border:1px solid #facc15; border-radius:4px; padding:4px 8px; font-size:10.5px; font-weight:bold; cursor:pointer; white-space:nowrap; }
      .shop-buy-btn:hover { background:#d97706; }

      #current-region-hud {
        margin-top: 3px;
        background: rgba(15, 23, 42, 0.88);
        border: 1px solid #b45309;
        border-radius: 4px;
        padding: 2px 5px;
        font-size: 9px;
        font-weight: bold;
        color: #fde047;
        text-align: center;
        white-space: nowrap;
        max-width: 108px;
        overflow: hidden;
        text-overflow: ellipsis;
        box-shadow: 0 2px 5px rgba(0,0,0,0.75);
        pointer-events: auto;
        cursor: pointer;
      }
      #merc-hud {
        margin-top: 3px;
        width: 92px;
        background: rgba(17, 20, 26, 0.92);
        border: 1.5px solid #60a5fa;
        border-radius: 6px;
        padding: 3px 5px;
        display: none;
        flex-direction: column;
        gap: 2px;
        cursor: pointer;
        pointer-events: auto;
        box-shadow: 0 2px 8px rgba(0,0,0,0.85);
        transition: transform 0.1s;
      }
      #merc-hud:active { transform: scale(0.96); }
      .merc-hud-top { display:flex; justify-content:space-between; align-items:center; font-size:9px; font-weight:bold; color:#e5e7eb; }
      .merc-stance-badge { font-size:8px; padding:0px 3px; border-radius:3px; font-weight:bold; }
      .merc-bar-bg { position:relative; width:100%; height:7px; background:#1f2937; border:1px solid #000; border-radius:3px; overflow:hidden; }
      .merc-bar-fill-hp { height:100%; background:linear-gradient(90deg, #dc2626, #22c55e); width:100%; transition:width 0.15s; }
      .merc-bar-fill-mp { height:100%; background:linear-gradient(90deg, #1d4ed8, #38bdf8); width:100%; transition:width 0.15s; }
      .merc-bar-txt { position:absolute; inset:0; font-size:7.5px; line-height:6px; text-align:center; color:#fff; font-weight:bold; text-shadow:0 0 2px #000; }

      .stance-btn { flex:1; padding:4px 3px; border-radius:5px; font-size:10px; font-weight:bold; border:1px solid #374151; background:#1f2937; color:#9ca3af; cursor:pointer; }
      .stance-btn.active-attack { background:#7f1d1d; border-color:#f87171; color:#fef2f2; box-shadow:0 0 8px rgba(239,68,68,0.4); }
      .stance-btn.active-standby { background:#1e3a8a; border-color:#60a5fa; color:#eff6ff; box-shadow:0 0 8px rgba(59,130,246,0.4); }
      .stance-btn.active-support { background:#065f46; border-color:#34d399; color:#ecfdf5; box-shadow:0 0 8px rgba(16,185,129,0.4); }
      .circle-tab-btn { padding:3px 7px; border-radius:4px; font-size:10px; font-weight:bold; border:1px solid #3d3020; background:#141210; color:#9ca3af; cursor:pointer; white-space:nowrap; }
      .circle-tab-btn.active { background:#78350f; border-color:#facc15; color:#fde047; }
    `;
    document.head.appendChild(style);
  }

  // 모든 정적 모달 헤더(#equip-ui, #inventory-ui, #skill-ui, #stat-alloc-modal, #quest-ui, #npc-modal-ui, #chat-window-ui)에 ? 도움말 버튼 자동 부착
  const attachHelpBtn = (modalId, topic) => {
    const hdr = document.querySelector(`#${modalId} .modal-header`);
    if (hdr && !hdr.querySelector('.help-q-btn')) {
      const btn = document.createElement('button');
      btn.className = 'help-q-btn';
      btn.title = '도움말 보기';
      btn.innerText = '?';
      btn.onclick = (e) => window.showHelpModal(topic, e);
      hdr.appendChild(btn);
    }
  };
  attachHelpBtn('equip-ui', 'equip');
  attachHelpBtn('inventory-ui', 'inventory');
  attachHelpBtn('skill-ui', 'skill');
  attachHelpBtn('stat-alloc-modal', 'stat');
  attachHelpBtn('quest-ui', 'quest');
  attachHelpBtn('npc-modal-ui', 'guide');

  const chatTitleWrap = document.getElementById('chat-win-title-wrap');
  if (chatTitleWrap && !chatTitleWrap.querySelector('.help-q-btn')) {
    const cBtn = document.createElement('button');
    cBtn.className = 'help-q-btn';
    cBtn.title = '대화창 도움말';
    cBtn.innerText = '?';
    cBtn.onclick = (e) => window.showHelpModal('chat', e);
    chatTitleWrap.insertBefore(cBtn, chatTitleWrap.children[1] || null);
  }

  // 미니맵 아래 현재지역 표시 & 용병 미니 HUD 동적 부착
  const rightHud = document.querySelector('.right-hud');
  if (rightHud) {
    if (!document.getElementById('current-region-hud')) {
      const regHud = document.createElement('div');
      regHud.id = 'current-region-hud';
      regHud.title = '클릭하여 지역 상세 지도 열기';
      regHud.innerText = '📍 알트리아';
      regHud.onclick = (e) => { e.stopPropagation(); window.openRegionDetailMap(); };
      const safeBadge = document.getElementById('safe-zone-badge');
      if (safeBadge) rightHud.insertBefore(regHud, safeBadge);
      else rightHud.appendChild(regHud);
    }

    if (!document.getElementById('merc-hud')) {
      const mHud = document.createElement('div');
      mHud.id = 'merc-hud';
      mHud.title = '터치: 힐/버프 대상 선택 | 길게 누르기: 용병 상태창 열기';
      let mercPressTimer = null;
      let mercLongPressed = false;
      mHud.addEventListener('pointerdown', (e) => {
        e.stopPropagation();
        if (e.button && e.button !== 0) return;
        mercLongPressed = false;
        clearTimeout(mercPressTimer);
        mercPressTimer = setTimeout(() => {
          mercLongPressed = true;
          window.toggleMercUI();
        }, 420);
      });
      mHud.addEventListener('pointerup', (e) => {
        e.stopPropagation();
        if (e.button && e.button !== 0) return;
        clearTimeout(mercPressTimer);
        if (!mercLongPressed) {
          window.toggleFriendlyMercTarget();
        }
      });
      mHud.addEventListener('pointerleave', () => clearTimeout(mercPressTimer));
      mHud.addEventListener('pointercancel', () => clearTimeout(mercPressTimer));
      mHud.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        e.stopPropagation();
        clearTimeout(mercPressTimer);
        window.toggleMercUI();
      });



      mHud.innerHTML = `
  <div class="merc-hud-top">
    <span id="merc-hud-title">🛡️ 전사</span>
    <span id="merc-hud-stance" class="merc-stance-badge" style="background:#065f46; color:#6ee7b7;">보조</span>
  </div>
  <div class="merc-bar-bg">
    <div class="merc-bar-fill-hp" id="merc-hud-hp-bar"></div>
    <span class="merc-bar-txt" id="merc-hud-hp-txt">100/100</span>
  </div>
  <div class="merc-bar-bg">
    <div class="merc-bar-fill-mp" id="merc-hud-mp-bar"></div>
    <span class="merc-bar-txt" id="merc-hud-mp-txt">50/50</span>
  </div>
`;
      const safeBadge = document.getElementById('safe-zone-badge');
      if (safeBadge) rightHud.insertBefore(mHud, safeBadge);
      else rightHud.appendChild(mHud);
    }

    if (!document.getElementById('party-hud')) {
      const pHud = document.createElement('div');
      pHud.id = 'party-hud';
      pHud.style.cssText = 'margin-top:3px; width:92px; display:none; flex-direction:column; gap:2px; pointer-events:auto;';
      const safeBadge = document.getElementById('safe-zone-badge');
      if (safeBadge) rightHud.insertBefore(pHud, safeBadge);
      else rightHud.appendChild(pHud);
    }
  }

  // 가방(인벤토리) 창에 '🧹 정렬' 버튼 및 '🤝 용병전달' 버튼 추가
  const invActions = document.querySelector('#inventory-ui .inv-actions');
  if (invActions && !document.getElementById('sort-inv-btn')) {
    const sortBtn = document.createElement('button');
    sortBtn.id = 'sort-inv-btn';
    sortBtn.style.cssText = 'background:#065f46; border-color:#34d399; color:#ecfdf5; font-weight:bold; padding:4px 7px;';
    sortBtn.title = '물약(체력·마나·버프 고정) → 착장아이템 → 주문서·비전서·기타 순 자동 정렬';
    sortBtn.innerText = '🧹 정렬';
    sortBtn.onclick = () => window.sortPlayerInventory();
    invActions.insertBefore(sortBtn, invActions.firstChild);
  }
  if (invActions && !document.getElementById('give-merc-btn')) {
    const giveBtn = document.createElement('button');
    giveBtn.id = 'give-merc-btn';
    giveBtn.style.cssText = 'background:#1e3a8a; border-color:#60a5fa; color:#eff6ff; font-weight:bold; padding:4px 7px;';
    giveBtn.innerText = '🤝 용병전달';
    giveBtn.onclick = () => window.giveSelectedToMerc();
    invActions.insertBefore(giveBtn, invActions.children[3] || null);
  }

  // 용병 전용 상태창 & 장비/인벤토리 모달 (#merc-ui) 생성 (간소화 & 화면 잘림 방지)
  if (!document.getElementById('merc-ui')) {
    const mercModal = document.createElement('div');
    mercModal.id = 'merc-ui';
    mercModal.className = 'modal-panel hidden';
    mercModal.style.cssText = 'width:min(94vw, 375px); max-height:76vh; display:flex; flex-direction:column;';
    mercModal.innerHTML = `
      <div class="modal-header drag-handle" id="merc-modal-header">⚔️ 용병 상태·가방 <button class="help-q-btn" onclick="showHelpModal('merc', event)" title="용병 도움말">?</button></div>
      <button class="close-x-btn" onclick="toggleMercUI()">✖</button>
      <div id="merc-ui-body" style="flex:1; overflow-y:auto; display:flex; flex-direction:column; gap:5px; padding:5px;"></div>
    `;
    document.getElementById('game-wrapper')?.appendChild(mercModal);
  }

  let wm = document.getElementById('world-map-ui');
  if (!wm) {
    wm = document.createElement('div');
    wm.id = 'world-map-ui';
    (document.getElementById('game-wrapper') || document.body).appendChild(wm);
  }
  wm.className = 'rpg-overlay-modal';
  wm.innerHTML = `
    <div class="rpg-modal-box" style="width:min(92vw, 460px); height:min(86dvh, 820px); flex:0 0 auto;" onclick="event.stopPropagation()">
      <button class="rpg-close-floating" onclick="closeWorldMapUI()">✕ 닫기</button>
      <div id="world-map-bg-box" style="position:relative; width:100%; height:100%; background:#090d16; overflow:hidden;">
        <img src="./map/worldmap.jpg" style="width:100%; height:100%; object-fit:fill; display:block; pointer-events:none; user-select:none;" />
        <div id="world-map-hotspots" style="position:absolute; inset:0; z-index:20;"></div>
      </div>
    </div>
  `;
  wm.onclick = () => window.closeWorldMapUI();

  let sm = document.getElementById('shire-map-ui');
  if (!sm) {
    sm = document.createElement('div');
    sm.id = 'shire-map-ui';
    (document.getElementById('game-wrapper') || document.body).appendChild(sm);
  }
  sm.className = 'rpg-overlay-modal';
  sm.innerHTML = `
    <div class="rpg-modal-box" style="width:min(92vw, 460px); height:min(86dvh, 820px); flex:0 0 auto;" onclick="event.stopPropagation()">
      <div id="detail-map-title-badge" style="position:absolute; top:8px; left:10px; z-index:60; background:rgba(15,23,42,0.88); border:1px solid #facc15; border-radius:6px; padding:4px 10px; font-size:12px; font-weight:bold; color:#fde047; pointer-events:none; box-shadow:0 2px 6px rgba(0,0,0,0.85);">🗺️ 지역 상세 지도</div>
      <button class="rpg-close-floating" onclick="closeShireMapUI()">✕ 닫기</button>
      <div id="detail-map-canvas-wrap" style="position:relative; width:100%; height:100%; background:#090d16; overflow:hidden;">
        <canvas id="detail-map-fallback-canvas" width="400" height="720" style="position:absolute; inset:0; width:100%; height:100%; display:block; pointer-events:none;"></canvas>
        <img id="detail-map-img-el" src="./map/altria.jpg" onerror="this.style.opacity='0'" onload="this.style.opacity='1'" style="position:relative; z-index:5; width:100%; height:100%; object-fit:fill; display:block; pointer-events:none; user-select:none; transition:opacity 0.15s;" />
        <div id="region-detail-overlay" style="position:absolute; inset:0; z-index:20;"></div>
      </div>
    </div>
  `;
  sm.onclick = () => window.closeShireMapUI();

  let nm = document.getElementById('npc-modal-ui');
  if (!nm) {
    nm = document.createElement('div');
    nm.id = 'npc-modal-ui';
    nm.className = 'modal-panel hidden';
    nm.innerHTML = `
      <div class="modal-header drag-handle" id="npc-modal-title">💬 NPC 대화</div>
      <button class="close-x-btn" onclick="closeNpcModal()">✖</button>
      <div id="npc-modal-body" style="flex:1; overflow-y:auto; display:flex; flex-direction:column;"></div>
    `;
    document.getElementById('game-wrapper')?.appendChild(nm);
  }

  let qm = document.getElementById('quest-ui');
  if (!qm) {
    qm = document.createElement('div');
    qm.id = 'quest-ui';
    qm.className = 'modal-panel hidden';
    qm.innerHTML = `
      <div class="modal-header drag-handle">📜 퀘스트 정보 <button class="help-q-btn" onclick="showHelpModal('quest', event)" title="퀘스트 도움말">?</button></div>
      <button class="close-x-btn" onclick="toggleQuestUI()">✖</button>
      <div id="quest-ui-body" style="flex:1; overflow-y:auto; display:flex; flex-direction:column; gap:6px; padding-right:2px;"></div>
    `;
    document.getElementById('game-wrapper')?.appendChild(qm);
  }

  if (!document.getElementById('touch-drag-ghost')) {
    const ghost = document.createElement('div');
    ghost.id = 'touch-drag-ghost';
    document.body.appendChild(ghost);
  }
}

// ============================================================================
// 📂 768x1376 기준 TMJ 포탈(potal) 투명 구역 파서
// ============================================================================
function getRegionMapAssets(regionId) {
  const reg = GameDB.Regions.find(r => r.id === regionId) || GameDB.Regions[0];
  const rawEng = (reg.eng || 'Altria').replace(/\s+/g, '');
  const exactMapName = {
    R01: 'altria', R02: 'SilverVine', R03: 'Kaladru', R04: 'Elrond', R05: 'Moraan',
    R06: 'Bloodmoon', R07: 'Balenos', R08: 'Frosthold', R09: 'Ignis', R10: 'Darkwood',
    R11: 'Windstorm', R12: 'Arcana', R13: 'Nethergate', R14: 'DragonPeak', R15: 'Eternity'
  }[regionId] || rawEng;
  const candidates = Array.from(new Set([
    exactMapName,
    rawEng,
    rawEng.toLowerCase(),
    rawEng === 'Silvervine' ? 'SilverVine' : rawEng
  ]));
  return {
    reg,
    jpgUrls: candidates.map(name => `./map/${name}.jpg`),
    tmjUrls: candidates.map(name => `./map/${name}.tmj`)
  };
}

const ALL_REGION_TMJ_PORTALS = {
  R01: [
    { leftPct: 36.67, topPct: 74.85, widthPct: 36.41, heightPct: 17.54, worldX: 2000, worldY: 14250, zoneType: 'town', label: '초심자의마을(S) 중앙' },
    { leftPct: 7.33,  topPct: 44.30, widthPct: 39.55, heightPct: 24.12, worldX: 1820, worldY: 8620,  zoneType: 'field', label: '속삭이는 들판 입구' },
    { leftPct: 13.62, topPct: 20.32, widthPct: 34.58, heightPct: 18.42, worldX: 1100, worldY: 2280,  zoneType: 'dungeon_entrance', label: '고블린 동굴 입구 앞' },
    { leftPct: 62.34, topPct: 21.35, widthPct: 33.27, heightPct: 19.44, worldX: 2950, worldY: 2820,  zoneType: 'boss_camp', label: '족장의 막사 안전입구' }
  ],
  R02: [
    { leftPct: 35.89, topPct: 18.86, widthPct: 32.48, heightPct: 23.83, worldX: 2050, worldY: 5150,  zoneType: 'boss_camp', label: '타락한 세계수 안전입구' },
    { leftPct: 8.91,  topPct: 45.18, widthPct: 26.98, heightPct: 23.25, worldX: 1420, worldY: 9520,  zoneType: 'field', label: '은빛 덩굴숲 입구' },
    { leftPct: 59.72, topPct: 47.95, widthPct: 33.00, heightPct: 19.15, worldX: 3000, worldY: 9120,  zoneType: 'dungeon_entrance', label: '버려진 벌목장 입구 앞' },
    { leftPct: 30.12, topPct: 73.68, widthPct: 40.86, heightPct: 19.74, worldX: 2020, worldY: 13400, zoneType: 'town', label: '요정의 야영지(S1) 중앙' }
  ],
  R03: [
    { leftPct: 30.65, topPct: 73.25, widthPct: 49.51, heightPct: 23.25, worldX: 2215, worldY: 13580, zoneType: 'town', label: '바위망치마을(S) 중앙' },
    { leftPct: 6.81,  topPct: 47.51, widthPct: 45.32, heightPct: 22.66, worldX: 1180, worldY: 9895,  zoneType: 'field', label: '붉은 협곡 입구' },
    { leftPct: 66.53, topPct: 45.18, widthPct: 31.43, heightPct: 21.64, worldX: 3290, worldY: 8960,  zoneType: 'dungeon_entrance', label: '광신도의 광산 입구 앞' },
    { leftPct: 42.17, topPct: 11.40, widthPct: 41.39, heightPct: 19.44, worldX: 2515, worldY: 3600,  zoneType: 'boss_camp', label: '골렘의 제단 안전입구' }
  ],
  R04: [
    { leftPct: 58.15, topPct: 22.95, widthPct: 37.72, heightPct: 20.91, worldX: 3080, worldY: 5345,  zoneType: 'town', label: '빛의 엘론드(S) 중앙' },
    { leftPct: 3.41,  topPct: 66.08, widthPct: 42.96, heightPct: 30.12, worldX: 995,  worldY: 13460, zoneType: 'field', label: '물안개 호숫가 입구' },
    { leftPct: 59.46, topPct: 58.77, widthPct: 31.43, heightPct: 19.01, worldX: 3005, worldY: 10925, zoneType: 'dungeon_entrance', label: '가라앉은 신전 입구 앞' },
    { leftPct: 6.55,  topPct: 22.22, widthPct: 35.89, heightPct: 21.05, worldX: 980,  worldY: 5460,  zoneType: 'boss_camp', label: '물의 정령왕좌 안전입구' }
  ],
  R05: [
    { leftPct: 6.55,  topPct: 14.77, widthPct: 36.93, heightPct: 24.85, worldX: 1050, worldY: 4050,  zoneType: 'dungeon_entrance', label: '개미지옥 둥지 입구 앞' },
    { leftPct: 55.53, topPct: 25.44, widthPct: 39.03, heightPct: 21.64, worldX: 2950, worldY: 5880,  zoneType: 'boss_camp', label: '고대 파라오 무덤 안전입구' },
    { leftPct: 5.76,  topPct: 51.17, widthPct: 40.86, heightPct: 15.06, worldX: 1680, worldY: 9550,  zoneType: 'field', label: '작열하는 모래언덕 입구' },
    { leftPct: 43.22, topPct: 70.61, widthPct: 44.01, heightPct: 19.01, worldX: 2350, worldY: 13650, zoneType: 'town', label: '오아시스야영지(S1) 중앙' }
  ],
  R06: [
    { leftPct: 34.58, topPct: 78.36, widthPct: 47.67, heightPct: 14.91, worldX: 2335, worldY: 13730, zoneType: 'town', label: '추방자의 야영지(S1) 중앙' },
    { leftPct: 10.74, topPct: 49.42, widthPct: 39.55, heightPct: 20.91, worldX: 1220, worldY: 10060, zoneType: 'field', label: '핏빛 진흙탕 입구' },
    { leftPct: 58.41, topPct: 27.34, widthPct: 38.24, heightPct: 21.49, worldX: 3100, worldY: 6095,  zoneType: 'dungeon_entrance', label: '역병 짐승의 굴 입구 앞' },
    { leftPct: 8.12,  topPct: 13.01, widthPct: 41.91, heightPct: 26.32, worldX: 1165, worldY: 4405,  zoneType: 'boss_camp', label: '맹독 늪지 안전입구' }
  ],
  R07: [
    { leftPct: 37.46, topPct: 14.18, widthPct: 61.56, heightPct: 18.71, worldX: 2720, worldY: 4080,  zoneType: 'boss_camp', label: '해적선장의 오두막 안전입구' },
    { leftPct: 24.10, topPct: 39.91, widthPct: 46.63, heightPct: 16.08, worldX: 1900, worldY: 7620,  zoneType: 'dungeon_entrance', label: '난파선 무덤 입구 앞' },
    { leftPct: 66.01, topPct: 70.03, widthPct: 33.53, heightPct: 13.89, worldX: 2680, worldY: 12150, zoneType: 'field', label: '검은 모래 해변 입구' },
    { leftPct: 6.29,  topPct: 62.87, widthPct: 39.81, heightPct: 26.17, worldX: 1080, worldY: 12150, zoneType: 'town', label: '항구도시 발레노스(S) 중앙' }
  ],
  R08: [
    { leftPct: 44.53, topPct: 71.35, widthPct: 46.36, heightPct: 20.03, worldX: 2710, worldY: 13020, zoneType: 'town', label: '얼음바위 마을(S) 중앙' },
    { leftPct: 10.74, topPct: 45.47, widthPct: 31.96, heightPct: 18.86, worldX: 1070, worldY: 9265,  zoneType: 'field', label: '눈보라 평원 입구' },
    { leftPct: 11.53, topPct: 18.27, widthPct: 37.72, heightPct: 20.32, worldX: 1215, worldY: 4550,  zoneType: 'dungeon_entrance', label: '얼어붙은 수정동굴 입구 앞' },
    { leftPct: 63.65, topPct: 16.08, widthPct: 30.38, heightPct: 21.49, worldX: 3155, worldY: 4510,  zoneType: 'boss_camp', label: '서리거인의 안식처 안전입구' }
  ],
  R09: [
    { leftPct: 11.00, topPct: 77.92, widthPct: 46.10, heightPct: 14.04, worldX: 1360, worldY: 13590, zoneType: 'town', label: '잿빛 야영지(S1) 중앙' },
    { leftPct: 18.86, topPct: 58.77, widthPct: 74.13, heightPct: 12.72, worldX: 2235, worldY: 10900, zoneType: 'field', label: '끓어오르는 대지 입구' },
    { leftPct: 14.67, topPct: 34.36, widthPct: 74.13, heightPct: 13.74, worldX: 2070, worldY: 6595,  zoneType: 'dungeon_entrance', label: '용암 튜브 미궁 입구 앞' },
    { leftPct: 41.65, topPct: 11.55, widthPct: 46.89, heightPct: 17.11, worldX: 2605, worldY: 3435,  zoneType: 'boss_camp', label: '화염마족의 분화구 안전입구' }
  ],
  R10: [
    { leftPct: 11.26, topPct: 73.83, widthPct: 42.96, heightPct: 18.86, worldX: 1310, worldY: 13320, zoneType: 'town', label: '까마귀 야영지(S1) 중앙' },
    { leftPct: 6.81,  topPct: 47.08, widthPct: 47.15, heightPct: 17.69, worldX: 1215, worldY: 9425,  zoneType: 'field', label: '그림자 숲 입구' },
    { leftPct: 65.22, topPct: 28.07, widthPct: 27.24, heightPct: 23.39, worldX: 3155, worldY: 6365,  zoneType: 'dungeon_entrance', label: '망자의 지하묘지 입구 앞' },
    { leftPct: 10.74, topPct: 18.27, widthPct: 39.55, heightPct: 20.18, worldX: 1220, worldY: 4760,  zoneType: 'boss_camp', label: '언데드 군주의 방 안전입구' }
  ],
  R11: [
    { leftPct: 46.10, topPct: 78.22, widthPct: 43.74, heightPct: 14.62, worldX: 2720, worldY: 13685, zoneType: 'town', label: '하늘맞이 마을(S) 중앙' },
    { leftPct: 8.91,  topPct: 44.44, widthPct: 29.60, heightPct: 21.78, worldX: 950,  worldY: 9335,  zoneType: 'field', label: '돌풍의 절벽 입구' },
    { leftPct: 58.15, topPct: 32.31, widthPct: 31.96, heightPct: 17.69, worldX: 2965, worldY: 6585,  zoneType: 'dungeon_entrance', label: '하피의 둥지 입구 앞' },
    { leftPct: 23.05, topPct: 19.74, widthPct: 37.98, heightPct: 11.11, worldX: 1680, worldY: 4265,  zoneType: 'boss_camp', label: '폭풍새의 산란장 안전입구' }
  ],
  R12: [
    { leftPct: 15.98, topPct: 22.81, widthPct: 29.34, heightPct: 18.57, worldX: 1225, worldY: 5135,  zoneType: 'town', label: '마법학회 야영지(S1) 중앙' },
    { leftPct: 57.10, topPct: 41.08, widthPct: 34.05, heightPct: 17.40, worldX: 2965, worldY: 8445,  zoneType: 'field', label: '깨진 중력의 뜰 입구' },
    { leftPct: 16.76, topPct: 55.70, widthPct: 27.50, heightPct: 16.81, worldX: 1220, worldY: 10255, zoneType: 'dungeon_entrance', label: '고대 마공학 부유선 입구 앞' },
    { leftPct: 53.44, topPct: 71.78, widthPct: 33.00, heightPct: 18.71, worldX: 2800, worldY: 13200, zoneType: 'boss_camp', label: '기계신 타이탄 제어실 안전입구' }
  ],
  R13: [
    { leftPct: 58.67, topPct: 66.08, widthPct: 37.72, heightPct: 19.88, worldX: 3100, worldY: 12165, zoneType: 'town', label: '흑요석 야영지(S1) 중앙' },
    { leftPct: 4.45,  topPct: 48.98, widthPct: 40.60, heightPct: 23.83, worldX: 990,  worldY: 10225, zoneType: 'field', label: '핏빛 황무지 입구' },
    { leftPct: 52.91, topPct: 30.56, widthPct: 44.79, heightPct: 23.98, worldX: 3010, worldY: 6805,  zoneType: 'dungeon_entrance', label: '고문관의 미궁 입구 앞' },
    { leftPct: 12.05, topPct: 14.91, widthPct: 30.12, heightPct: 21.93, worldX: 1085, worldY: 4360,  zoneType: 'boss_camp', label: '차원문 중심부 안전입구' }
  ],
  R14: [
    { leftPct: 28.81, topPct: 72.08, widthPct: 46.36, heightPct: 22.66, worldX: 2080, worldY: 13345, zoneType: 'town', label: '용병단 야영지(S1) 중앙' },
    { leftPct: 7.33,  topPct: 42.11, widthPct: 36.41, heightPct: 23.68, worldX: 1020, worldY: 9110,  zoneType: 'field', label: '불탄 기사단 훈련소 입구' },
    { leftPct: 60.77, topPct: 40.50, widthPct: 33.53, heightPct: 20.61, worldX: 3100, worldY: 8130,  zoneType: 'dungeon_entrance', label: '드레이크 부화장 입구 앞' },
    { leftPct: 36.41, topPct: 14.04, widthPct: 49.51, heightPct: 18.86, worldX: 2445, worldY: 3975,  zoneType: 'boss_camp', label: '고룡의 둥지 안전입구' }
  ],
  R15: [
    { leftPct: 31.96, topPct: 73.10, widthPct: 41.12, heightPct: 19.88, worldX: 2100, worldY: 13285, zoneType: 'town', label: '차원의 야영지(S1) 중앙' },
    { leftPct: 9.95,  topPct: 40.94, widthPct: 34.31, heightPct: 23.25, worldX: 1085, worldY: 8890,  zoneType: 'field', label: '부서진 기억의 길 입구' },
    { leftPct: 61.03, topPct: 41.37, widthPct: 33.27, heightPct: 23.98, worldX: 3105, worldY: 8540,  zoneType: 'dungeon_entrance', label: '심연의 회랑 입구 앞' },
    { leftPct: 34.58, topPct: 10.38, widthPct: 36.93, heightPct: 25.00, worldX: 2120, worldY: 3880,  zoneType: 'boss_camp', label: '배교자 카엘런의 옥좌 안전입구' }
  ]
};

function resolveDetailMapWarpTarget(regionId, leftPct, topPct, widthPct, heightPct, rawName, mapData) {
  const cxPct = leftPct + widthPct / 2;
  const cyPct = topPct + heightPct / 2;

  const presetZones = ALL_REGION_TMJ_PORTALS[regionId];
  if (presetZones && presetZones.length > 0) {
    let bestZone = presetZones[0];
    let bestDist = Infinity;
    presetZones.forEach(z => {
      const zcx = z.leftPct + z.widthPct / 2;
      const zcy = z.topPct + z.heightPct / 2;
      const d = Math.hypot(cxPct - zcx, cyPct - zcy);
      if (d < bestDist) {
        bestDist = d;
        bestZone = z;
      }
    });
    if (bestDist <= 28 || widthPct > 0) {
      return {
        worldX: bestZone.worldX,
        worldY: bestZone.worldY,
        zoneType: bestZone.zoneType,
        label: bestZone.label
      };
    }
  }

  const wx = Math.max(160, Math.min(mapData.width - 160, Math.round((cxPct / 100) * mapData.width)));
  const wy = Math.max(160, Math.min(mapData.height - 160, Math.round((cyPct / 100) * mapData.height)));
  return { worldX: wx, worldY: wy, zoneType: 'field', label: '필드 구역' };
}

async function loadRegionTmjPortals(regionId, mapWidth = 4000, mapHeight = 16000) {
  if (window.tmjCache[regionId] && window.tmjCache[regionId].length > 0) {
    return window.tmjCache[regionId];
  }

  const mapData = HardcodedMapDB[`${regionId}_sub1`] || { width: mapWidth, height: mapHeight, spawn: { x: mapWidth / 2, y: mapHeight / 2 } };
  const { tmjUrls } = getRegionMapAssets(regionId);

  for (const url of tmjUrls) {
    try {
      const res = await fetch(url);
      if (!res.ok) continue;
      const tmj = await res.json();

      const baseW = (tmj.width && tmj.tilewidth) ? (tmj.width * tmj.tilewidth) : 768;
      const baseH = (tmj.height && tmj.tileheight) ? (tmj.height * tmj.tileheight) : 1376;

      const zones = [];
      if (Array.isArray(tmj.layers)) {
        tmj.layers.forEach(layer => {
          if (layer.type === 'objectgroup' && Array.isArray(layer.objects)) {
            layer.objects.forEach(obj => {
              const ox = Number(obj.x) || 0;
              const oy = Number(obj.y) || 0;
              const ow = Number(obj.width) || 120;
              const oh = Number(obj.height) || 80;

              const leftPct = (ox / baseW) * 100;
              const topPct = (oy / baseH) * 100;
              const widthPct = (ow / baseW) * 100;
              const heightPct = (oh / baseH) * 100;

              const resolved = resolveDetailMapWarpTarget(regionId, leftPct, topPct, widthPct, heightPct, obj.name || obj.type || '', mapData);

              zones.push({
                leftPct, topPct, widthPct, heightPct,
                worldX: resolved.worldX,
                worldY: resolved.worldY,
                zoneType: resolved.zoneType,
                label: resolved.label
              });
            });
          }
        });
      }

      if (zones.length > 0) {
        window.tmjCache[regionId] = zones;
        return zones;
      }
    } catch (e) {}
  }

  window.tmjCache[regionId] = ALL_REGION_TMJ_PORTALS[regionId] || [];
  return window.tmjCache[regionId];
}

async function loadWorldMapTmj() {
  try {
    const res = await fetch('./map/worldmap.tmj');
    if (!res.ok) return;
    const tmj = await res.json();
    const baseW = (tmj.width && tmj.tilewidth) ? (tmj.width * tmj.tilewidth) : 768;
    const baseH = (tmj.height && tmj.tileheight) ? (tmj.height * tmj.tileheight) : 1376;

    const zones = [];
    if (Array.isArray(tmj.layers)) {
      tmj.layers.forEach(layer => {
        if (layer.type === 'objectgroup' && Array.isArray(layer.objects)) {
          layer.objects.forEach(obj => {
            const ox = Number(obj.x) || 0;
            const oy = Number(obj.y) || 0;
            const ow = Number(obj.width) || 90;
            const oh = Number(obj.height) || 60;

            const leftPct = (ox / baseW) * 100;
            const topPct = (oy / baseH) * 100;
            const widthPct = (ow / baseW) * 100;
            const heightPct = (oh / baseH) * 100;
            const cxPct = leftPct + widthPct / 2;
            const cyPct = topPct + heightPct / 2;

            const oName = (obj.name || obj.type || '').toLowerCase();
            let matchedReg = GameDB.Regions.find(r =>
              oName.includes(r.id.toLowerCase()) ||
              oName.includes(r.name) ||
              oName.includes(r.eng.toLowerCase().replace(/\s+/g, ''))
            );

            if (!matchedReg) {
              let bestDist = Infinity;
              GameDB.Regions.forEach(r => {
                const d = Math.hypot(r.mapX - cxPct, r.mapY - cyPct);
                if (d < bestDist) { bestDist = d; matchedReg = r; }
              });
            }

            if (matchedReg) {
              zones.push({
                regionId: matchedReg.id,
                regionName: matchedReg.name,
                subName: matchedReg.sub1,
                leftPct, topPct, widthPct, heightPct
              });
            }
          });
        }
      });
    }
    if (zones.length > 0) window.worldMapTmjZones = zones;
  } catch (e) {}
}

// ============================================================================
// 🌍 월드맵 & 지역 상세 지도 오픈/렌더링
// ============================================================================
// 플레이어 레벨과 지역 권장 레벨 비교 색상 계산기 (낮음: 흰색 #ffffff <-> 같음: 푸른색 #38bdf8 <-> 높음: 빨간색 #ef4444)
function getWorldMapRegionLevelColor(playerLv, reg) {
  const pLv = Math.max(1, Number(playerLv) || 1);
  const m = String(reg.lvRange || '').match(/(\d+)\s*~\s*(\d+)/);
  const minLv = m ? Number(m[1]) : (Number(reg.minLv) || 1);
  const maxLv = m ? Number(m[2]) : (minLv + 20);

  // 적정 레벨 구간 (같음): 선명한 푸른색
  if (pLv >= minLv - 2 && pLv <= maxLv + 2) {
    return '#38bdf8';
  }
  // 플레이어 레벨보다 낮은 사냥터: 흰색(#ffffff) ~ 연푸른색(#bae6fd) 사이 보간
  if (pLv > maxLv + 2) {
    const underDiff = pLv - maxLv;
    if (underDiff >= 25) return '#ffffff';
    if (underDiff >= 12) return '#e0f2fe';
    return '#93c5fd';
  }
  // 플레이어 레벨보다 높은 사냥터: 푸른색(#38bdf8) ~ 주황(#fb923c) ~ 빨간색(#ef4444) 사이 보간
  const overDiff = minLv - pLv;
  if (overDiff >= 35) return '#dc2626';
  if (overDiff >= 18) return '#ef4444';
  if (overDiff >= 8)  return '#fb923c';
  return '#60a5fa';
}

window.openWorldMapUI = async function() {
  if (window.isUiTouchDebounced?.('openWorldMapUI', 320)) return;
  ensureAllGameModals();
  window.closeNpcModal();
  window.closeShireMapUI();

  if (window.worldMapTmjZones.length === 0) await loadWorldMapTmj();

  const modal = document.getElementById('world-map-ui');
  if (!modal) return;

  const hostParent = document.fullscreenElement || document.webkitFullscreenElement || document.getElementById('game-wrapper') || document.body;
  if (modal.parentElement !== hostParent) {
    hostParent.appendChild(modal);
  }

  window._mapModalOpenedAt = Date.now();
  renderWorldMapHotspots();
  modal.classList.remove('hidden');
  modal.classList.add('active-modal');
  modal.style.display = 'flex';
  modal.style.zIndex = '25000';
};

window.closeWorldMapUI = function() {
  if (window.isUiTouchDebounced?.('closeWorldMapUI', 220)) return;
  const modal = document.getElementById('world-map-ui');
  if (modal) {
    modal.classList.remove('active-modal');
    modal.style.display = 'none';
  }
};

function renderWorldMapHotspots() {
  const container = document.getElementById('world-map-hotspots');
  if (!container) return;
  container.innerHTML = '';

  const pLv = player?.level || 1;
  const renderedDotRegIds = new Set();

  if (window.worldMapTmjZones.length > 0) {
    window.worldMapTmjZones.forEach(z => {
      const regObj = GameDB.Regions.find(r => r.id === z.regionId);
      const zoneEl = document.createElement('div');
      zoneEl.className = 'tmj-portal-zone';
      zoneEl.style.left = `${z.leftPct}%`;
      zoneEl.style.top = `${z.topPct}%`;
      zoneEl.style.width = `${z.widthPct}%`;
      zoneEl.style.height = `${z.heightPct}%`;

      if (regObj && !renderedDotRegIds.has(regObj.id)) {
        renderedDotRegIds.add(regObj.id);
        const dotCol = getWorldMapRegionLevelColor(pLv, regObj);
        const dotEl = document.createElement('span');
        dotEl.className = 'worldmap-lv-dot';
        dotEl.style.background = dotCol;
        dotEl.title = `${regObj.name} (${regObj.lvRange})`;
        zoneEl.appendChild(dotEl);
      }

      zoneEl.onclick = (e) => {
        e.stopPropagation();
        if (Date.now() - (window._mapModalOpenedAt || 0) < 420) return;
        if (window.isUiTouchDebounced?.('worldMapWarp', 400)) return;
        window.closeWorldMapUI();
        loadMapData(`${z.regionId}_sub1`);
        window.addChat(`✈️ [월드맵 이동] '${z.regionName}' - ${z.subName} 안전지대로 이동했습니다!`, 'log-sys');
      };
      container.appendChild(zoneEl);
    });
  } else {
    GameDB.Regions.forEach(reg => {
      const zoneEl = document.createElement('div');
      zoneEl.className = 'tmj-portal-zone';
      zoneEl.style.left = `${reg.mapX - 9}%`;
      zoneEl.style.top = `${reg.mapY - 3.5}%`;
      zoneEl.style.width = `18%`;
      zoneEl.style.height = `7%`;

      if (!renderedDotRegIds.has(reg.id)) {
        renderedDotRegIds.add(reg.id);
        const dotCol = getWorldMapRegionLevelColor(pLv, reg);
        const dotEl = document.createElement('span');
        dotEl.className = 'worldmap-lv-dot';
        dotEl.style.background = dotCol;
        dotEl.title = `${reg.name} (${reg.lvRange})`;
        zoneEl.appendChild(dotEl);
      }

      zoneEl.onclick = (e) => {
        e.stopPropagation();
        if (Date.now() - (window._mapModalOpenedAt || 0) < 420) return;
        if (window.isUiTouchDebounced?.('worldMapWarp', 400)) return;
        window.closeWorldMapUI();
        loadMapData(`${reg.id}_sub1`);
        window.addChat(`✈️ [월드맵 이동] '${reg.name}' - ${reg.sub1} 안전지대로 이동했습니다!`, 'log-sys');
      };
      container.appendChild(zoneEl);
    });
  }
}

window.openRegionDetailMap = async function() {
  if (window.isUiTouchDebounced?.('openRegionDetailMap', 240)) return;
  ensureAllGameModals();
  const mapData = HardcodedMapDB[currentMapKey];
  if (!mapData) return;

  if (mapData.isDungeon) {
    window.addChat(`⚠️ [경고] 던전 내부에서는 상세 지도를 열거나 이동할 수 없습니다!`, 'log-hit');
    return;
  }

  const ui = document.getElementById('shire-map-ui');
  if (!ui) return;

  const hostParent = document.fullscreenElement || document.webkitFullscreenElement || document.getElementById('game-wrapper') || document.body;
  if (ui.parentElement !== hostParent) {
    hostParent.appendChild(ui);
  }

  const { reg, jpgUrls } = getRegionMapAssets(currentRegionKey);
  const titleBadge = document.getElementById('detail-map-title-badge');
  if (titleBadge && reg) {
    titleBadge.innerText = `🗺️ ${reg.name} (${reg.lvRange || '전 구간'}) · 터치하여 이동`;
  }

  const fbCanvas = document.getElementById('detail-map-fallback-canvas');
  if (fbCanvas && typeof minimapOffscreenCanvas !== 'undefined' && minimapOffscreenCanvas) {
    try {
      const fbCtx = fbCanvas.getContext('2d');
      fbCtx.clearRect(0, 0, fbCanvas.width, fbCanvas.height);
      fbCtx.drawImage(minimapOffscreenCanvas, 0, 0, fbCanvas.width, fbCanvas.height);
    } catch (e) {}
  }

  const imgEl = document.getElementById('detail-map-img-el');
  if (imgEl) {
    imgEl.style.opacity = '1';
    imgEl.src = jpgUrls[0];
    imgEl.onerror = () => {
      if (jpgUrls[1] && !imgEl.src.endsWith(jpgUrls[1].replace('./', ''))) {
        imgEl.src = jpgUrls[1];
      } else {
        imgEl.style.opacity = '0';
      }
    };
  }

  await loadRegionTmjPortals(currentRegionKey, mapData.width, mapData.height);

  window._mapModalOpenedAt = Date.now();
  ui.classList.remove('hidden');
  ui.classList.add('active-modal');
  ui.style.display = 'flex';
  ui.style.zIndex = '25000';
  renderRegionDetailOverlay();
};

window.closeShireMapUI = function() {
  if (window.isUiTouchDebounced?.('closeShireMapUI', 220)) return;
  const ui = document.getElementById('shire-map-ui');
  if (ui) {
    ui.classList.remove('active-modal');
    ui.style.display = 'none';
  }
};

function renderRegionDetailOverlay() {
  const overlay = document.getElementById('region-detail-overlay');
  const mapData = HardcodedMapDB[currentMapKey];
  if (!overlay || !mapData) return;
  overlay.innerHTML = '';

  const pxPct = Math.max(2, Math.min(98, (player.x / mapData.width) * 100));
  const pyPct = Math.max(2, Math.min(98, (player.y / mapData.height) * 100));
  const meMarker = document.createElement('div');
  meMarker.id = 'detail-realtime-me-marker';
  meMarker.className = 'detail-me-marker';
  meMarker.style.left = `${pxPct}%`;
  meMarker.style.top = `${pyPct}%`;
  meMarker.innerHTML = `<div style="width:14px; height:14px; background:#22c55e; border:2.5px solid #ffffff; border-radius:50%; animation: mePulse 1.5s infinite;"></div>`;
  overlay.appendChild(meMarker);

  const othersLayer = document.createElement('div');
  othersLayer.id = 'detail-realtime-others-layer';
  othersLayer.style.cssText = 'position:absolute; inset:0; pointer-events:none; z-index:42;';
  overlay.appendChild(othersLayer);
  updateRealtimeDetailMapMarker();

  const tmjZones = window.tmjCache[currentRegionKey] || [];
  tmjZones.forEach(zone => {
    const zoneEl = document.createElement('div');
    zoneEl.className = 'tmj-portal-zone';
    zoneEl.style.left = `${zone.leftPct}%`;
    zoneEl.style.top = `${zone.topPct}%`;
    zoneEl.style.width = `${zone.widthPct}%`;
    zoneEl.style.height = `${zone.heightPct}%`;

    zoneEl.onclick = (e) => {
      e.stopPropagation();
      if (Date.now() - (window._mapModalOpenedAt || 0) < 420) return;
      if (window.isUiTouchDebounced?.('detailMapMove', 380)) return;
      movePlayerViaDetailMap(zone.worldX, zone.worldY, zone.zoneType, zone.label);
    };
    overlay.appendChild(zoneEl);
  });

  overlay.onclick = (e) => {
    if (Date.now() - (window._mapModalOpenedAt || 0) < 420) return;
    if (window.isUiTouchDebounced?.('detailMapMove', 380)) return;
    const rect = overlay.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;
    const pctX = (clickX / rect.width) * 100;
    const pctY = (clickY / rect.height) * 100;

    const resolved = resolveDetailMapWarpTarget(currentRegionKey, pctX, pctY, 0, 0, '', mapData);
    movePlayerViaDetailMap(resolved.worldX, resolved.worldY, resolved.zoneType, resolved.label);
  };
}

function updateRealtimeDetailMapMarker() {
  const ui = document.getElementById('shire-map-ui');
  if (!ui || !ui.classList.contains('active-modal')) return;
  const marker = document.getElementById('detail-realtime-me-marker');
  const mapData = HardcodedMapDB[currentMapKey];
  if (!marker || !mapData) return;

  marker.style.left = `${Math.max(2, Math.min(98, (player.x / mapData.width) * 100))}%`;
  marker.style.top = `${Math.max(2, Math.min(98, (player.y / mapData.height) * 100))}%`;

  const othersLayer = document.getElementById('detail-realtime-others-layer');
  if (othersLayer && Array.isArray(window.otherPlayers)) {
    const myPartyId = window.partyState?.partyId || null;
    othersLayer.innerHTML = window.otherPlayers.map(op => {
      if (!op || op.x === undefined || op.y === undefined || op.gmInvisible) return '';
      const ox = Math.max(2, Math.min(98, (op.x / mapData.width) * 100));
      const oy = Math.max(2, Math.min(98, (op.y / mapData.height) * 100));
      const isSamePty = Boolean(myPartyId && op.partyId === myPartyId);
      const dotCol = isSamePty ? '#34d399' : '#2dd4bf';
      return `<div style="position:absolute; left:${ox}%; top:${oy}%; transform:translate(-50%,-50%); display:flex; flex-direction:column; align-items:center;">
        <div style="width:10px; height:10px; background:${dotCol}; border:2px solid #ffffff; border-radius:50%; box-shadow:0 0 6px #000;"></div>
        <span style="font-size:9px; font-weight:bold; color:#ffffff; text-shadow:1px 1px 2px #000, -1px -1px 2px #000; white-space:nowrap; margin-top:1px;">${op.name || '모험가'}</span>
      </div>`;
    }).join('');
  }
}

// ============================================================================
// 🛡️ 안전지대 (S / S1) 및 사냥터 워프 안전구역(몬스터 스폰 제외 구역) 판정
// ============================================================================
function getSafeZoneInfo(mapKey = currentMapKey) {
  const mapData = HardcodedMapDB[mapKey];
  if (!mapData || mapData.isDungeon) return null;
  const radius = mapData.isSeamlessRegion ? 780 : 500;
  return { x: mapData.spawn.x, y: mapData.spawn.y, radius };
}

function isInsideSafeZone(x, y, mapKey = currentMapKey) {
  const sz = getSafeZoneInfo(mapKey);
  if (!sz) return false;
  return Math.hypot(x - sz.x, y - sz.y) <= sz.radius;
}

function isInsideWarpSafeSpot(x, y, mapKey = currentMapKey) {
  if (isInsideSafeZone(x, y, mapKey)) return true;
  const mapData = HardcodedMapDB[mapKey];
  if (!mapData || mapData.isDungeon) return false;
  const wZones = mapData.warpSafeZones || [];
  for (const wz of wZones) {
    if (Math.hypot(x - wz.x, y - wz.y) <= (wz.radius || 420)) return true;
  }
  return false;
}

function findSafeSpot(tx, ty) {
  if (!checkCollision(tx, ty)) return { x: tx, y: ty };
  for (let r = 30; r <= 450; r += 30) {
    const dirs = [
      [0, r], [0, -r], [r, 0], [-r, 0],
      [r * 0.7, r * 0.7], [-r * 0.7, r * 0.7],
      [r * 0.7, -r * 0.7], [-r * 0.7, -r * 0.7]
    ];
    for (const [dx, dy] of dirs) {
      if (!checkCollision(tx + dx, ty + dy)) {
        return { x: Math.round(tx + dx), y: Math.round(ty + dy) };
      }
    }
  }
  return { x: tx, y: ty };
}

function disableAutoAttack(reasonMsg = null) {
  if (!window.isAutoAttack) return;
  window.isAutoAttack = false;
  document.getElementById('slot-10')?.classList.remove('slot-10-auto');
  window.clearTarget();
  if (reasonMsg) window.addChat(reasonMsg, 'log-sys');
}

function movePlayerViaDetailMap(tx, ty, zoneType = 'field', label = '') {
  window.closeShireMapUI();
  window.clearTarget();
  disableAutoAttack();

  const mapData = HardcodedMapDB[currentMapKey];

  if (zoneType === 'town' && mapData && mapData.spawn) {
    tx = mapData.spawn.x;
    ty = mapData.spawn.y;
  }

  const safePos = findSafeSpot(tx, ty);
  player.x = safePos.x;
  player.y = safePos.y;
  player.targetX = safePos.x;
  player.targetY = safePos.y;
  player.path = [];
  player.isMoving = false;
  player.isWalking = false;
  player.manualMoving = false;
  player.portalCooldown = Date.now() + 800;

  if (mercenary.hired && !mercenary.isDead) {
    mercenary.x = safePos.x - 45;
    mercenary.y = safePos.y + 30;
    mercenary.targetMonster = null;
  }

  if (zoneType === 'town') {
    window.addChat(`🏡 [마을/야영지 복귀] ${label || '마을 정중앙'} 안전지대로 복귀했습니다!`, 'log-sys');
  } else if (zoneType === 'dungeon_entrance') {
    window.addChat(`⚡ [던전 입구 워프] ${label || '던전 입구'} 안전 구역으로 이동했습니다!`, 'log-sys');
  } else if (zoneType === 'boss_camp') {
    window.addChat(`👑 [보스 구역 워프] ${label || '보스 성역 입구'} 안전 구역으로 이동했습니다!`, 'log-sys');
  } else {
    window.addChat(`⚡ [사냥터 워프] ${label || '사냥터 입구'} 안전 구역으로 이동했습니다.`, 'log-sys');
  }
  window.tickMultiplayerSync?.(Date.now() + 5000);
}

function buildSmartFieldPath(sx, sy, tx, ty) {
  const waypoints = [];
  const mapData = HardcodedMapDB[currentMapKey];
  if (mapData && mapData.isSeamlessRegion) {
    if (currentRegionKey === 'R01') {
      if (sy > 11800 && ty < 11400) {
        const bridgeX = Math.abs(sx - 1100) < Math.abs(sx - 2800) ? 1100 : 2800;
        waypoints.push({ x: bridgeX, y: 12000 }, { x: bridgeX, y: 11200 });
      } else if (sy < 11400 && ty > 11800) {
        const bridgeX = Math.abs(sx - 1100) < Math.abs(sx - 2800) ? 1100 : 2800;
        waypoints.push({ x: bridgeX, y: 11200 }, { x: bridgeX, y: 12000 });
      }
      if (Math.max(sy, waypoints[waypoints.length - 1]?.y || sy) > 5100 && ty < 4400) {
        waypoints.push({ x: 2650, y: 5300 }, { x: 2650, y: 4300 });
      } else if (sy < 4400 && ty > 5100) {
        waypoints.push({ x: 2650, y: 4300 }, { x: 2650, y: 5300 });
      }
    } else if (currentRegionKey === 'R05') {
      if (sy > 12800 && ty < 12300) {
        const bypassX = sx < 2350 ? 1650 : 3050;
        waypoints.push({ x: bypassX, y: 12900 }, { x: bypassX, y: 12100 });
      } else if (sy < 12300 && ty > 12800) {
        const bypassX = sx < 2350 ? 1650 : 3050;
        waypoints.push({ x: bypassX, y: 12100 }, { x: bypassX, y: 12900 });
      }
    } else if (currentRegionKey === 'R07') {
      if (sx < 2050 && tx > 2350 && sy > 9500) {
        waypoints.push({ x: 1950, y: 11850 }, { x: 2550, y: 11850 });
      } else if (sx > 2350 && tx < 2050 && sy > 9500) {
        waypoints.push({ x: 2550, y: 11850 }, { x: 1950, y: 11850 });
      }
    }
  }
  waypoints.push({ x: tx, y: ty });
  return waypoints;
}

