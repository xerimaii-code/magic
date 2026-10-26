// js/ui_option.js
import { GameDB } from './data.js';

export const OptionState = {
  lootGrade: 0,
  sfxOn: true,
  sfxVolume: 75,
  bgmOn: true,
  bgmVolume: 55,
  smoothCamera: true,
  cameraStage: GameDB?.SystemConfig?.camera?.defaultStage || 2,
  cameraAutoZoom: GameDB?.SystemConfig?.camera?.autoZoomEnabled !== false,
  vibrationOn: false,
  powerSaveOn: false,
  keepScreenAwake: true,
  questGuideArrow: true,
  // 🌟 인게임 기본 화면 모드는 가로모드('landscape')로 고정 (유저가 명시적으로 'portrait'를 저장한 경우에만 세로모드)
  screenMode: (() => {
    try {
      const saved = localStorage.getItem('MAGIC_SAVED_SCREEN_MODE');
      return saved === 'portrait' ? 'portrait' : 'landscape';
    } catch (e) {
      return 'landscape';
    }
  })()
};

export const GameOptions = OptionState;

const GRADE_NAMES = (GameDB?.ItemGrades || []).map(g => `${g.name} 이상`);
const FALLBACK_GRADE_NAMES = [
  "일반 이상 (전체루팅)",
  "고급 이상 (x1.05, 옵션1)",
  "희귀 이상 (x1.10, 옵션2~3)",
  "전설 이상 (x1.15, 옵션3~4)",
  "초월만 (x1.25, 옵션5)"
];

function parseGradeIndex(grade, btnIndex = -1) {
  if (typeof grade === 'number') {
    if (btnIndex >= 0) return btnIndex;
    return Math.max(0, Math.min(4, grade));
  }
  const g = String(grade || '').toLowerCase();
  if (g.includes('초월') || g.includes('trans') || g === '4') return 4;
  if (g.includes('전설') || g.includes('legend') || g === '3') return 3;
  if (g.includes('희귀') || g.includes('rare') || g === '2') return 2;
  if (g.includes('고급') || g.includes('adv') || g === '1') return 1;
  if (btnIndex >= 0) return btnIndex;
  return 0;
}

export function getItemGradeIndex(itemOrId, itemDict = {}) {
  if (!itemOrId) return 0;
  const itemId = typeof itemOrId === 'object' ? itemOrId.type : itemOrId;
  if (
    itemId === 'gold' ||
    itemId.startsWith('C_') ||
    itemId.startsWith('S_') ||
    itemId.startsWith('Q_') ||
    itemId.startsWith('BOOK_')
  ) {
    return 99;
  }

  if (typeof itemOrId === 'object' && typeof itemOrId.gradeIdx === 'number') {
    return itemOrId.gradeIdx;
  }

  const def = itemDict[itemId];
  if (def && typeof def.fixedGrade === 'number') return def.fixedGrade;

  if (itemId.endsWith('05')) return 3;
  if (itemId.endsWith('04')) return 2;
  if (itemId.endsWith('03')) return 2;
  if (itemId.endsWith('02')) return 1;
  if (itemId.endsWith('01')) return 0;

  const price = def?.price || 0;
  if (price >= 20000) return 3;
  if (price >= 3000) return 2;
  if (price >= 500) return 1;
  return 0;
}

export function shouldLootItem(itemOrId, itemDict = {}) {
  const itemGrade = getItemGradeIndex(itemOrId, itemDict);
  if (itemGrade === 99) return true;
  return itemGrade >= OptionState.lootGrade;
}

export function getSerializedOptions() {
  return {
    sfxOn: Boolean(OptionState.sfxOn),
    sfxVolume: Math.max(0, Math.min(100, Number(OptionState.sfxVolume) ?? 75)),
    bgmOn: Boolean(OptionState.bgmOn),
    bgmVolume: Math.max(0, Math.min(100, Number(OptionState.bgmVolume) ?? 55)),
    smoothCamera: Boolean(OptionState.smoothCamera),
    cameraStage: Math.max(1, Math.min(3, Number(OptionState.cameraStage) || 2)),
    cameraAutoZoom: Boolean(OptionState.cameraAutoZoom),
    lootGrade: Math.max(0, Math.min(4, Number(OptionState.lootGrade) || 0)),
    vibrationOn: Boolean(OptionState.vibrationOn),
    powerSaveOn: Boolean(OptionState.powerSaveOn),
    keepScreenAwake: OptionState.keepScreenAwake !== false,
    questGuideArrow: OptionState.questGuideArrow !== false,
    screenMode: OptionState.screenMode === 'portrait' ? 'portrait' : 'landscape'
  };
}

// 🌟 수파베이스(캐릭터 char_data.options 및 계정 공유 설정)에서 옵션 불러오기 (아무 브라우저 접속 시 동일 환경 복원)
export function loadCharacterOptions(charRecordOrOpts) {
  if (!charRecordOrOpts) return;
  const opts =
    charRecordOrOpts.char_data?.options ||
    charRecordOrOpts.options ||
    (typeof charRecordOrOpts.sfxOn === 'boolean' || typeof charRecordOrOpts.lootGrade === 'number' ? charRecordOrOpts : null);
  if (!opts || typeof opts !== 'object') return;

  if (typeof opts.sfxOn === 'boolean') OptionState.sfxOn = opts.sfxOn;
  if (typeof opts.sfxVolume === 'number') OptionState.sfxVolume = Math.max(0, Math.min(100, opts.sfxVolume));
  if (typeof opts.bgmOn === 'boolean') OptionState.bgmOn = opts.bgmOn;
  if (typeof opts.bgmVolume === 'number') OptionState.bgmVolume = Math.max(0, Math.min(100, opts.bgmVolume));
  if (typeof opts.smoothCamera === 'boolean') OptionState.smoothCamera = opts.smoothCamera;
  if (typeof opts.cameraStage === 'number') OptionState.cameraStage = Math.max(1, Math.min(3, opts.cameraStage));
  if (typeof opts.cameraAutoZoom === 'boolean') OptionState.cameraAutoZoom = opts.cameraAutoZoom;
  if (typeof opts.lootGrade === 'number') OptionState.lootGrade = Math.max(0, Math.min(4, opts.lootGrade));
  if (typeof opts.vibrationOn === 'boolean') OptionState.vibrationOn = opts.vibrationOn;
  if (typeof opts.powerSaveOn === 'boolean') OptionState.powerSaveOn = opts.powerSaveOn;
  if (typeof opts.keepScreenAwake === 'boolean') OptionState.keepScreenAwake = opts.keepScreenAwake;
  if (typeof opts.questGuideArrow === 'boolean') OptionState.questGuideArrow = opts.questGuideArrow;
  if (opts.screenMode === 'landscape' || opts.screenMode === 'portrait') {
    OptionState.screenMode = opts.screenMode;
    try { localStorage.setItem('MAGIC_SAVED_SCREEN_MODE', opts.screenMode); } catch (e) {}
  } else {
    try {
      const localMode = localStorage.getItem('MAGIC_SAVED_SCREEN_MODE');
      OptionState.screenMode = (localMode === 'portrait') ? 'portrait' : 'landscape';
    } catch (e) {
      OptionState.screenMode = 'landscape';
    }
  }

  // 인게임 화면(#game-wrapper)이 활성화된 상태에서만 화면 모드를 즉시 전환 (로그인/캐릭터선택창은 항상 세로모드 유지)
  const gw = document.getElementById('game-wrapper');
  if (gw && gw.style.display !== 'none' && typeof window.setLandscapeMode === 'function') {
    window.setLandscapeMode(OptionState.screenMode === 'landscape', true);
  }
  window.syncGameWakeLock?.();

  if (window.player) {
    window.player.options = getSerializedOptions();
  }
  window.SoundSystem?.updateBgmState?.();
  const optUi = document.getElementById('option-ui');
  if (optUi && !optUi.classList.contains('hidden')) {
    renderOptionUI();
  }
}

// 🌟 변경된 옵션을 브라우저가 아닌 수파베이스(캐릭터 레코드 & 계정 공유 데이터)에 즉시 저장 요청
function persistOptionPrefs() {
  const serialized = getSerializedOptions();
  try {
    if (typeof localStorage !== 'undefined' && serialized.screenMode) {
      localStorage.setItem('MAGIC_SAVED_SCREEN_MODE', serialized.screenMode);
    }
  } catch (e) {}
  if (window.player) {
    window.player.options = serialized;
  }
  if (window.accountStorage && typeof window.accountStorage === 'object') {
    window.accountStorage.options = serialized;
  }
  if (window.saveOptionsToSupabase) {
    window.saveOptionsToSupabase(serialized);
  } else if (window.triggerAutoSave) {
    window.triggerAutoSave('option_change', true);
  }
}

export function initOptionSystem() {
  let optModal = document.getElementById('option-ui');
  if (!optModal) {
    optModal = document.createElement('div');
    optModal.id = 'option-ui';
    optModal.className = 'modal-panel hidden';
    document.getElementById('game-wrapper')?.appendChild(optModal);
  }

  window.OptionState = OptionState;
  window.getSerializedOptions = getSerializedOptions;
  window.shouldLootItem = shouldLootItem;
  window.getItemGradeIndex = getItemGradeIndex;
  window.loadCharacterOptions = loadCharacterOptions;

  window.toggleOptionUI = function() {
    const ui = document.getElementById('option-ui');
    if (!ui) return;
    ui.classList.toggle('hidden');
    if (!ui.classList.contains('hidden')) {
      renderOptionUI();
      window.bringModalToFront?.(ui);
      window.centerModalOnScreen?.(ui);
      setTimeout(() => window.centerModalOnScreen?.(ui), 10);
    }
  };

  // 💡 크롬 브라우저 전체화면 및 스마트폰 화면 꺼짐(절전모드) 방지 Wake Lock 제어기
  let _wakeLockSentinel = null;
  const isWakeLockSupported = () => Boolean(typeof navigator !== 'undefined' && 'wakeLock' in navigator && typeof navigator.wakeLock?.request === 'function');
  window.isWakeLockSupported = isWakeLockSupported;

  window.requestGameWakeLock = async function() {
    if (!isWakeLockSupported() || !OptionState.keepScreenAwake) return false;
    if (document.visibilityState !== 'visible') return false;
    if (_wakeLockSentinel && !_wakeLockSentinel.released) return true;
    try {
      _wakeLockSentinel = await navigator.wakeLock.request('screen');
      _wakeLockSentinel.addEventListener('release', () => {
        if (OptionState.keepScreenAwake && document.visibilityState === 'visible') {
          setTimeout(() => { window.requestGameWakeLock?.(); }, 400);
        }
      });
      return true;
    } catch (err) {
      return false;
    }
  };

  window.releaseGameWakeLock = async function() {
    if (_wakeLockSentinel) {
      try { await _wakeLockSentinel.release(); } catch (err) {}
      _wakeLockSentinel = null;
    }
  };

  window.syncGameWakeLock = function() {
    if (!isWakeLockSupported()) return;
    if (OptionState.keepScreenAwake) {
      window.requestGameWakeLock();
    } else {
      window.releaseGameWakeLock();
    }
  };

  window.toggleKeepScreenAwakeOption = async function(forceVal) {
    if (!isWakeLockSupported()) {
      window.addChat?.(`⚠️ 현재 브라우저/스마트폰 정책상 화면 항상 켜기(Wake Lock) 기능을 지원하지 않습니다.`, 'log-hit');
      return;
    }
    OptionState.keepScreenAwake = typeof forceVal === 'boolean' ? forceVal : !OptionState.keepScreenAwake;
    persistOptionPrefs();
    if (OptionState.keepScreenAwake) {
      await window.requestGameWakeLock();
      window.addChat?.(`💡 [화면 항상 켜기 ON] 전체화면 및 자동사냥 중 화면 절전모드(꺼짐) 진입을 방지합니다.`, 'log-sys');
    } else {
      await window.releaseGameWakeLock();
      window.addChat?.(`💡 [화면 항상 켜기 OFF] 기기 기본 절전모드 정책을 따릅니다.`, 'log-sys');
    }
    renderOptionUI();
  };

  if (isWakeLockSupported() && !window._wakeLockEventsBound) {
    window._wakeLockEventsBound = true;
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && OptionState.keepScreenAwake) {
        window.requestGameWakeLock();
      }
    });
    document.addEventListener('fullscreenchange', () => {
      if (OptionState.keepScreenAwake) {
        window.requestGameWakeLock();
      }
    });
    window.addEventListener('pointerdown', () => {
      if (OptionState.keepScreenAwake && (!_wakeLockSentinel || _wakeLockSentinel.released)) {
        window.requestGameWakeLock();
      }
    }, { passive: true });
    window.syncGameWakeLock();
  }

  window.setScreenOrientationModeOption = function(mode, fromToggleBtn = false) {
    const nextMode = (mode === 'portrait') ? 'portrait' : 'landscape';
    if (!fromToggleBtn && typeof window.requestToggleLandscapeMode === 'function') {
      const curIsLand = Boolean(window.isLandscapeMode);
      if ((nextMode === 'landscape') !== curIsLand) {
        window.requestToggleLandscapeMode(nextMode === 'landscape');
        return;
      }
    }
    OptionState.screenMode = nextMode;
    try { localStorage.setItem('MAGIC_SAVED_SCREEN_MODE', nextMode); } catch (e) {}
    persistOptionPrefs();
    if (!fromToggleBtn && typeof window.setLandscapeMode === 'function') {
      window.setLandscapeMode(nextMode === 'landscape', true);
    }
    if (!fromToggleBtn) {
      window.addChat?.(
        nextMode === 'landscape'
          ? `🌄 [화면 모드 고정] '가로모드(우측 2중 아크 UI)'로 고정 저장되었습니다. 다음 게임 시작 시에도 가로모드로 자동 시작됩니다.`
          : `📱 [화면 모드 고정] '세로모드(기본 UI)'로 고정 저장되었습니다. 다음 게임 시작 시에도 세로모드로 자동 시작됩니다.`,
        'log-sys'
      );
    }
    const optUi = document.getElementById('option-ui');
    if (optUi && !optUi.classList.contains('hidden')) {
      renderOptionUI();
    }
  };

  window.toggleFullScreen = function() {
    try {
      if (!document.fullscreenElement && !document.webkitFullscreenElement) {
        const docEl = document.documentElement;
        const p = docEl.requestFullscreen ? docEl.requestFullscreen() : (docEl.webkitRequestFullscreen ? docEl.webkitRequestFullscreen() : null);
        if (p && typeof p.then === 'function') {
          p.then(() => { if (OptionState.keepScreenAwake) window.requestGameWakeLock?.(); }).catch(() => {});
        } else if (OptionState.keepScreenAwake) {
          window.requestGameWakeLock?.();
        }
        window.addChat?.(`🖥️ [화면 설정] 전체화면 모드로 전환되었습니다.${OptionState.keepScreenAwake && isWakeLockSupported() ? ' (절전방지 항상켜기 활성)' : ''}`, 'log-sys');
      } else {
        if (document.exitFullscreen) document.exitFullscreen();
        else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
        window.addChat?.(`🖥️ [화면 설정] 창 모드로 전환되었습니다.`, 'log-sys');
      }
    } catch (err) {
      window.addChat?.(`⚠️ [화면 설정] 브라우저 전체화면 전환 제한`, 'log-hit');
    }
  };

  window.toggleSmoothCameraOption = function() {
    OptionState.smoothCamera = !OptionState.smoothCamera;
    persistOptionPrefs();
    window.addChat?.(
      OptionState.smoothCamera
        ? `🎥 [스마트 시점 추적 ON] 이동과 전투 시 카메라가 부드럽게 시선을 따라갑니다. (수파베이스 저장됨)`
        : `🎥 [스마트 시점 추적 OFF] 카메라가 캐릭터 정중앙에 고정됩니다. (수파베이스 저장됨)`,
      'log-sys'
    );
    renderOptionUI();
  };

  window.setCameraZoomMode = function(modeOrStage) {
    if (modeOrStage === 'auto') {
      OptionState.cameraAutoZoom = true;
      window.addChat?.(`🎥 [시야 자동 조정 ON] 마을(1단계) · 일반 사냥(2단계) · 보스 및 다수 교전(3단계) 상황에 맞춰 카메라 배율이 자동 조정됩니다!`, 'log-sys');
    } else {
      const stageNum = Math.max(1, Math.min(3, Number(modeOrStage) || 2));
      OptionState.cameraAutoZoom = false;
      OptionState.cameraStage = stageNum;
      const stInfo = (GameDB?.SystemConfig?.camera?.stages || []).find(s => s.stage === stageNum);
      window.addChat?.(`🎥 [카메라 시야 배율] '${stInfo ? stInfo.name : stageNum + '단계'}' 시야로 설정되었습니다.`, 'log-sys');
    }
    persistOptionPrefs();
    renderOptionUI();
  };

  window.toggleQuestGuideArrowOption = function(forceVal) {
    OptionState.questGuideArrow = typeof forceVal === 'boolean' ? forceVal : !OptionState.questGuideArrow;
    persistOptionPrefs();
    window.addChat?.(
      OptionState.questGuideArrow
        ? `🧭 [퀘스트 방향 화살표 ON] 퀘스트 해당 지역에서 다음 목표(몬스터·NPC·던전) 방향을 연한 화살표로 안내합니다.`
        : `🧭 [퀘스트 방향 화살표 OFF] 퀘스트 방향 안내 화살표를 숨깁니다.`,
      'log-sys'
    );
    renderOptionUI();
  };

  window.setLootGradeOption = function(grade) {
    const buttons = Array.from(document.querySelectorAll('[onclick*="setLootGradeOption"]'));
    let clickedIdx = -1;
    if (window.event && window.event.currentTarget) {
      clickedIdx = buttons.indexOf(window.event.currentTarget);
    }
    const gradeIdx = parseGradeIndex(grade, clickedIdx);
    OptionState.lootGrade = gradeIdx;
    persistOptionPrefs();
    renderOptionUI();
    const gLabel = FALLBACK_GRADE_NAMES[gradeIdx] || GRADE_NAMES[gradeIdx] || '일반 이상';
    window.addChat?.(`💎 [루팅 등급] 장비 루팅 등급이 '${gLabel}'(으)로 수파베이스에 저장되었습니다.`, 'log-sys');
  };

  window.stepSoundVolume = function(key, delta) {
    if (key === 'sfxVol') {
      const next = Math.max(0, Math.min(100, (Number(OptionState.sfxVolume) || 0) + delta));
      window.updateSoundOption('sfxVol', next);
      const sl = document.getElementById('opt-sfx-range-input');
      if (sl) sl.value = String(next);
    } else if (key === 'bgmVol') {
      const next = Math.max(0, Math.min(100, (Number(OptionState.bgmVolume) || 0) + delta));
      window.updateSoundOption('bgmVol', next);
      const sl = document.getElementById('opt-bgm-range-input');
      if (sl) sl.value = String(next);
    }
  };

  window.updateSoundOption = function(key, val) {
    if (key === 'sfxOn') {
      OptionState.sfxOn = Boolean(val);
      window.addChat?.(`🔊 [효과음 설정] 효과음이 ${OptionState.sfxOn ? '켜졌습니다 (ON)' : '꺼졌습니다 (OFF)'}.`, 'log-sys');
      if (OptionState.sfxOn) window.SoundSystem?.playUiClick?.();
    } else if (key === 'sfxVol') {
      OptionState.sfxVolume = Math.max(0, Math.min(100, Number(val) || 0));
      if (OptionState.sfxVolume === 0) OptionState.sfxOn = false;
      else if (!OptionState.sfxOn) OptionState.sfxOn = true;
      const lbl = document.getElementById('opt-sfx-vol-txt');
      if (lbl) lbl.innerText = `${OptionState.sfxVolume}%`;
      window.SoundSystem?.playUiClick?.();
    } else if (key === 'bgmOn') {
      OptionState.bgmOn = Boolean(val);
      if (OptionState.bgmOn && OptionState.bgmVolume === 0) OptionState.bgmVolume = 50;
      window.SoundSystem?.updateBgmState?.();
      window.addChat?.(`🎵 [배경음악 설정] 배경음악이 ${OptionState.bgmOn ? '켜졌습니다 (ON)' : '꺼졌습니다 (OFF)'}.`, 'log-sys');
    } else if (key === 'bgmVol') {
      OptionState.bgmVolume = Math.max(0, Math.min(100, Number(val) || 0));
      if (OptionState.bgmVolume === 0) OptionState.bgmOn = false;
      else if (!OptionState.bgmOn) OptionState.bgmOn = true;
      const lbl = document.getElementById('opt-bgm-vol-txt');
      if (lbl) lbl.innerText = `${OptionState.bgmVolume}%`;
      window.SoundSystem?.updateBgmState?.();
    } else if (key === 'vibration') {
      OptionState.vibrationOn = Boolean(val);
    } else if (key === 'powerSave') {
      OptionState.powerSaveOn = Boolean(val);
    }

    persistOptionPrefs();
    if (key === 'sfxOn' || key === 'bgmOn') {
      renderOptionUI();
    }
  };
}

export function renderOptionUI() {
  const ui = document.getElementById('option-ui');
  if (!ui) return;

  const curGrade = OptionState.lootGrade || 0;
  const btnStyle = (idx) => {
    if (idx === curGrade) {
      return 'border-color:#facc15; background:rgba(120, 53, 15, 0.82); color:#fde047; box-shadow:inset 0 0 6px rgba(250, 204, 21, 0.45); font-weight:bold;';
    }
    return 'border-color:#374151; background:#111418; color:#9ca3af;';
  };

  const camBtnStyle = (isActive) => {
    if (isActive) {
      return 'border-color:#38bdf8; background:#0c4a6e; color:#e0f2fe; box-shadow:inset 0 0 6px rgba(56, 189, 248, 0.45); font-weight:bold;';
    }
    return 'border-color:#374151; background:#111418; color:#9ca3af;';
  };

  const sfxBtnBg = OptionState.sfxOn ? '#15803d' : '#374151';
  const sfxBtnBd = OptionState.sfxOn ? '#4ade80' : '#6b7280';
  const bgmBtnBg = OptionState.bgmOn ? '#1d4ed8' : '#374151';
  const bgmBtnBd = OptionState.bgmOn ? '#60a5fa' : '#6b7280';
  const trackBtnBg = OptionState.smoothCamera ? '#065f46' : '#374151';
  const trackBtnBd = OptionState.smoothCamera ? '#34d399' : '#6b7280';

  ui.innerHTML = `
    <div class="modal-header drag-handle">⚙️ 환경 설정 <button class="help-q-btn" onclick="showHelpModal('option', event)" title="옵션 도움말">?</button></div>
    <button class="close-x-btn" onclick="toggleOptionUI()">✖</button>
    <div class="opt-modal-grid" style="display:flex; flex-direction:column; gap:6px; padding:4px; font-size:10.5px; overflow-y:auto; flex:1 1 auto; min-height:0; color:#e5e7eb;">

      <!-- 🔊 사운드 설정 (가로/세로 어디서나 널찍하고 조작하기 편한 풀와이드 슬라이더 바) -->
      <div class="opt-card opt-card-sound" style="background:#14171f; border:1px solid #3d3020; border-radius:6px; padding:6px 7px; display:flex; flex-direction:column; gap:6px;">
        <div style="color:#facc15; font-weight:bold; border-bottom:1px solid #292018; padding-bottom:2px; display:flex; justify-content:space-between; align-items:center;">
          <span>🔊 사운드 볼륨 조절</span>
          <span style="font-size:8.5px; color:#86efac;">☁️ 계정 연동</span>
        </div>

        <!-- 효과음 (SFX) -->
        <div class="opt-sound-box" style="display:flex; flex-direction:column; gap:4px; background:#0c0e14; padding:5px 7px; border-radius:6px; border:1px solid #2d3748;">
          <div style="display:flex; align-items:center; justify-content:space-between; gap:6px;">
            <div style="display:flex; align-items:center; gap:5px;">
              <span style="font-weight:bold; color:#fde047; font-size:10px;">⚔️ 효과음</span>
              <span style="font-size:8.5px; color:#9ca3af;">(타격·스킬)</span>
            </div>
            <div style="display:flex; align-items:center; gap:5px;">
              <span id="opt-sfx-vol-txt" style="min-width:30px; text-align:right; font-size:10px; color:#4ade80; font-weight:900;">${OptionState.sfxVolume}%</span>
              <button type="button" class="shop-buy-btn opt-sound-toggle-btn" style="min-width:52px; padding:2.5px 7px; font-size:9px; background:${sfxBtnBg}; border-color:${sfxBtnBd};" onclick="updateSoundOption('sfxOn', !OptionState.sfxOn)">
                ${OptionState.sfxOn ? '🔊 ON' : '🔇 OFF'}
              </button>
            </div>
          </div>
          <div style="display:flex; align-items:center; gap:5px; width:100%;">
            <button type="button" class="opt-vol-step-btn" onclick="stepSoundVolume('sfxVol', -10)" title="효과음 -10%">−</button>
            <input id="opt-sfx-range-input" class="opt-vol-slider sfx-slider" type="range" min="0" max="100" value="${OptionState.sfxVolume}" oninput="updateSoundOption('sfxVol', this.value)" onchange="updateSoundOption('sfxVol', this.value)">
            <button type="button" class="opt-vol-step-btn" onclick="stepSoundVolume('sfxVol', 10)" title="효과음 +10%">+</button>
          </div>
        </div>

        <!-- 배경음 (BGM) -->
        <div class="opt-sound-box" style="display:flex; flex-direction:column; gap:4px; background:#0c0e14; padding:5px 7px; border-radius:6px; border:1px solid #2d3748;">
          <div style="display:flex; align-items:center; justify-content:space-between; gap:6px;">
            <div style="display:flex; align-items:center; gap:5px;">
              <span style="font-weight:bold; color:#93c5fd; font-size:10px;">🎵 배경음</span>
              <span style="font-size:8.5px; color:#9ca3af;">(마을·필드)</span>
            </div>
            <div style="display:flex; align-items:center; gap:5px;">
              <span id="opt-bgm-vol-txt" style="min-width:30px; text-align:right; font-size:10px; color:#93c5fd; font-weight:900;">${OptionState.bgmVolume}%</span>
              <button type="button" class="shop-buy-btn opt-sound-toggle-btn" style="min-width:52px; padding:2.5px 7px; font-size:9px; background:${bgmBtnBg}; border-color:${bgmBtnBd};" onclick="updateSoundOption('bgmOn', !OptionState.bgmOn)">
                ${OptionState.bgmOn ? '🎵 ON' : '🔇 OFF'}
              </button>
            </div>
          </div>
          <div style="display:flex; align-items:center; gap:5px; width:100%;">
            <button type="button" class="opt-vol-step-btn" onclick="stepSoundVolume('bgmVol', -10)" title="배경음 -10%">−</button>
            <input id="opt-bgm-range-input" class="opt-vol-slider bgm-slider" type="range" min="0" max="100" value="${OptionState.bgmVolume}" oninput="updateSoundOption('bgmVol', this.value)" onchange="updateSoundOption('bgmVol', this.value)">
            <button type="button" class="opt-vol-step-btn" onclick="stepSoundVolume('bgmVol', 10)" title="배경음 +10%">+</button>
          </div>
        </div>
      </div>

      <!-- 🎥 화면 모드 고정(가로/세로) · 시야 배율 및 스마트 시점 -->
      <div class="opt-card opt-card-camera" style="background:#14171f; border:1px solid #3d3020; border-radius:6px; padding:6px 7px; display:flex; flex-direction:column; gap:5px;">
        <div style="background:#0c0e14; border:1px solid #ca8a04; border-radius:5px; padding:5px 6px; display:flex; flex-direction:column; gap:4px;">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <span style="font-size:9.5px; font-weight:bold; color:#fde047;">🌄/📱 인게임 화면 모드 (기본: 가로)</span>
            <span style="font-size:8.5px; color:#4ade80; font-weight:bold;">${OptionState.screenMode === 'landscape' ? '🌄 가로모드 고정됨' : '📱 세로모드 고정됨'}</span>
          </div>
          <div style="display:grid; grid-template-columns: 1fr 1fr; gap:4px;">
            <button type="button" class="shop-buy-btn" style="padding:4px 4px; font-size:9.5px; text-align:center; ${camBtnStyle(OptionState.screenMode === 'landscape')}" onclick="setScreenOrientationModeOption('landscape')">🌄 가로모드 (기본)</button>
            <button type="button" class="shop-buy-btn" style="padding:4px 4px; font-size:9.5px; text-align:center; ${camBtnStyle(OptionState.screenMode !== 'landscape')}" onclick="setScreenOrientationModeOption('portrait')">📱 세로모드</button>
          </div>
        </div>
        <div style="color:#facc15; font-weight:bold; display:flex; justify-content:space-between; align-items:center;">
          <span>🎥 시야 및 카메라</span>
          <span style="font-size:8.5px; color:#38bdf8;">${OptionState.cameraAutoZoom ? '자동 배율 조정 중' : `${OptionState.cameraStage}단계 고정`}</span>
        </div>
        <div style="display:grid; grid-template-columns: repeat(4, 1fr); gap:3px;">
          <button class="shop-buy-btn" style="padding:4px 2px; font-size:9px; text-align:center; ${camBtnStyle(OptionState.cameraAutoZoom)}" onclick="setCameraZoomMode('auto')">🔄자동조정</button>
          <button class="shop-buy-btn" style="padding:4px 2px; font-size:9px; text-align:center; ${camBtnStyle(!OptionState.cameraAutoZoom && OptionState.cameraStage === 1)}" onclick="setCameraZoomMode(1)">1단계(근접)</button>
          <button class="shop-buy-btn" style="padding:4px 2px; font-size:9px; text-align:center; ${camBtnStyle(!OptionState.cameraAutoZoom && OptionState.cameraStage === 2)}" onclick="setCameraZoomMode(2)">2단계(표준)</button>
          <button class="shop-buy-btn" style="padding:4px 2px; font-size:9px; text-align:center; ${camBtnStyle(!OptionState.cameraAutoZoom && OptionState.cameraStage === 3)}" onclick="setCameraZoomMode(3)">3단계(광각)</button>
        </div>
        <div style="display:grid; grid-template-columns: 1.2fr 0.8fr; gap:4px;">
          <button class="shop-buy-btn" style="background:${trackBtnBg}; border-color:${trackBtnBd}; padding:4px 5px; font-size:9.5px; text-align:center;" onclick="toggleSmoothCameraOption()">
            🎯 시점추적: ${OptionState.smoothCamera ? 'ON' : 'OFF'}
          </button>
          <button class="shop-buy-btn" style="background:#374151; border-color:#6b7280; padding:4px 5px; font-size:9.5px; text-align:center;" onclick="toggleFullScreen()">⛶ 전체화면</button>
        </div>
        ${(typeof window.isWakeLockSupported === 'function' ? window.isWakeLockSupported() : ('wakeLock' in navigator)) ? `
        <label style="display:flex; align-items:center; justify-content:space-between; gap:6px; background:#0c0e14; border:1px solid ${OptionState.keepScreenAwake ? '#34d399' : '#2d3748'}; border-radius:5px; padding:4px 6px; cursor:pointer; user-select:none;">
          <div style="display:flex; align-items:center; gap:5px;">
            <input type="checkbox" ${OptionState.keepScreenAwake ? 'checked' : ''} onchange="toggleKeepScreenAwakeOption(this.checked)" style="width:13px; height:13px; accent-color:#10b981; cursor:pointer; margin:0;">
            <span style="font-size:9px; font-weight:bold; color:${OptionState.keepScreenAwake ? '#6ee7b7' : '#d1d5db'};">💡 화면 항상 켜기 (절전방지)</span>
          </div>
          <span style="font-size:8.5px; color:${OptionState.keepScreenAwake ? '#4ade80' : '#9ca3af'}; font-weight:bold;">${OptionState.keepScreenAwake ? '켜짐' : '꺼짐'}</span>
        </label>
        ` : ''}
        <label style="display:flex; align-items:center; justify-content:space-between; gap:6px; background:#0c0e14; border:1px solid ${OptionState.questGuideArrow !== false ? '#facc15' : '#2d3748'}; border-radius:5px; padding:4px 6px; cursor:pointer; user-select:none;">
          <div style="display:flex; align-items:center; gap:5px;">
            <input type="checkbox" ${OptionState.questGuideArrow !== false ? 'checked' : ''} onchange="toggleQuestGuideArrowOption(this.checked)" style="width:13px; height:13px; accent-color:#eab308; cursor:pointer; margin:0;">
            <span style="font-size:9px; font-weight:bold; color:${OptionState.questGuideArrow !== false ? '#fde047' : '#d1d5db'};">🧭 퀘스트 목표 방향 화살표 표시</span>
          </div>
          <span style="font-size:8.5px; color:${OptionState.questGuideArrow !== false ? '#facc15' : '#9ca3af'}; font-weight:bold;">${OptionState.questGuideArrow !== false ? '켜짐' : '꺼짐'}</span>
        </label>
      </div>

      <!-- 💎 자동사냥 장비 루팅 등급 -->
      <div class="opt-card opt-card-loot" style="background:#14171f; border:1px solid #3d3020; border-radius:6px; padding:6px 7px; display:flex; flex-direction:column; gap:5px; justify-content:center;">
        <div style="color:#facc15; font-weight:bold; display:flex; justify-content:space-between; align-items:center;">
          <span>💎 자동사냥 장비 루팅 등급</span>
          <span style="font-size:8.5px; color:#fde047;">${(FALLBACK_GRADE_NAMES[curGrade] || '일반 이상').split(' ')[0]}</span>
        </div>
        <div style="display:grid; grid-template-columns: repeat(5, 1fr); gap:3.5px;">
          <button class="shop-buy-btn" style="padding:5px 2px; font-size:9.2px; text-align:center; ${btnStyle(0)}" onclick="setLootGradeOption(0)">일반+</button>
          <button class="shop-buy-btn" style="padding:5px 2px; font-size:9.2px; text-align:center; ${btnStyle(1)}" onclick="setLootGradeOption(1)">고급+</button>
          <button class="shop-buy-btn" style="padding:5px 2px; font-size:9.2px; text-align:center; ${btnStyle(2)}" onclick="setLootGradeOption(2)">희귀+</button>
          <button class="shop-buy-btn" style="padding:5px 2px; font-size:9.2px; text-align:center; ${btnStyle(3)}" onclick="setLootGradeOption(3)">전설+</button>
          <button class="shop-buy-btn" style="padding:5px 2px; font-size:9.2px; text-align:center; ${btnStyle(4)}" onclick="setLootGradeOption(4)">초월만</button>
        </div>
      </div>

      <!-- 👤 계정 및 캐릭터 관리 (캐릭터 선택창/로그아웃 시 자동으로 세로모드 전환) -->
      <div class="opt-card opt-card-account" style="background:#1a1612; border:1px solid #b45309; border-radius:6px; padding:6px 7px; display:flex; flex-direction:column; gap:5px; justify-content:center;">
        <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #3d3020; padding-bottom:2px;">
          <span style="color:#fde047; font-weight:bold;">👤 계정 및 접속 관리</span>
          <span id="opt-autosave-badge" style="font-size:8.5px; color:#4ade80;">☁️ 수파베이스 동기화됨</span>
        </div>
        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:6px;">
          <button class="shop-buy-btn" style="background:#1e3a8a; border-color:#60a5fa; padding:6px 6px; font-size:10px; text-align:center;" onclick="returnToCharacterSelect()">🔄 캐릭터 선택</button>
          <button class="shop-buy-btn" style="background:#7f1d1d; border-color:#f87171; padding:6px 6px; font-size:10px; text-align:center;" onclick="logoutAccount()">🚪 로그아웃</button>
        </div>
      </div>

    </div>
  `;
}
window.renderOptionUI = renderOptionUI;