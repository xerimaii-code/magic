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
  powerSaveOn: false
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
    powerSaveOn: Boolean(OptionState.powerSaveOn)
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

  window.toggleFullScreen = function() {
    try {
      if (!document.fullscreenElement && !document.webkitFullscreenElement) {
        const docEl = document.documentElement;
        if (docEl.requestFullscreen) docEl.requestFullscreen();
        else if (docEl.webkitRequestFullscreen) docEl.webkitRequestFullscreen();
        window.addChat?.(`🖥️ [화면 설정] 전체화면 모드로 전환되었습니다.`, 'log-sys');
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
    <div style="display:flex; flex-direction:column; gap:6px; padding:4px; font-size:10.5px; overflow-y:auto; max-height:calc(68dvh - 42px); color:#e5e7eb;">

      <!-- 🔊 사운드 설정 -->
      <div style="background:#14171f; border:1px solid #3d3020; border-radius:6px; padding:6px; display:flex; flex-direction:column; gap:5px; overflow:hidden;">
        <div style="color:#facc15; font-weight:bold; border-bottom:1px solid #292018; padding-bottom:2px; display:flex; justify-content:space-between; align-items:center;">
          <span>🔊 사운드</span>
          <span style="font-size:8.5px; color:#86efac;">☁️ 수파베이스 계정 연동</span>
        </div>

        <!-- 효과음 (SFX) -->
        <div style="display:flex; align-items:center; justify-content:space-between; gap:4px; background:#0c0e14; padding:4px 5px; border-radius:5px; border:1px solid #2d3748; width:100%; overflow:hidden;">
          <div style="flex:0 0 52px; min-width:52px;">
            <div style="font-weight:bold; color:#fde047; font-size:9.5px; white-space:nowrap;">⚔️ 효과음</div>
            <div style="font-size:7.5px; color:#9ca3af; white-space:nowrap;">타격·스킬</div>
          </div>
          <div style="flex:1 1 0%; min-width:0; display:flex; align-items:center; gap:3px;">
            <input type="range" min="0" max="100" value="${OptionState.sfxVolume}" style="flex:1 1 0%; width:100%; min-width:0; max-width:100%; height:16px; margin:0; accent-color:#4ade80; cursor:pointer;" oninput="updateSoundOption('sfxVol', this.value)" onchange="updateSoundOption('sfxVol', this.value)">
            <span id="opt-sfx-vol-txt" style="flex:0 0 26px; width:26px; text-align:right; font-size:8.5px; color:#4ade80; font-weight:bold;">${OptionState.sfxVolume}%</span>
          </div>
          <button class="shop-buy-btn" style="flex:0 0 auto; min-width:46px; padding:3px 6px; font-size:9px; white-space:nowrap; background:${sfxBtnBg}; border-color:${sfxBtnBd};" onclick="updateSoundOption('sfxOn', !OptionState.sfxOn)">
            ${OptionState.sfxOn ? '🔊 ON' : '🔇 OFF'}
          </button>
        </div>

        <!-- 배경음 (BGM) -->
        <div style="display:flex; align-items:center; justify-content:space-between; gap:4px; background:#0c0e14; padding:4px 5px; border-radius:5px; border:1px solid #2d3748; width:100%; overflow:hidden;">
          <div style="flex:0 0 52px; min-width:52px;">
            <div style="font-weight:bold; color:#93c5fd; font-size:9.5px; white-space:nowrap;">🎵 배경음</div>
            <div style="font-size:7.5px; color:#9ca3af; white-space:nowrap;">마을·필드</div>
          </div>
          <div style="flex:1 1 0%; min-width:0; display:flex; align-items:center; gap:3px;">
            <input type="range" min="0" max="100" value="${OptionState.bgmVolume}" style="flex:1 1 0%; width:100%; min-width:0; max-width:100%; height:16px; margin:0; accent-color:#60a5fa; cursor:pointer;" oninput="updateSoundOption('bgmVol', this.value)" onchange="updateSoundOption('bgmVol', this.value)">
            <span id="opt-bgm-vol-txt" style="flex:0 0 26px; width:26px; text-align:right; font-size:8.5px; color:#93c5fd; font-weight:bold;">${OptionState.bgmVolume}%</span>
          </div>
          <button class="shop-buy-btn" style="flex:0 0 auto; min-width:46px; padding:3px 6px; font-size:9px; white-space:nowrap; background:${bgmBtnBg}; border-color:${bgmBtnBd};" onclick="updateSoundOption('bgmOn', !OptionState.bgmOn)">
            ${OptionState.bgmOn ? '🎵 ON' : '🔇 OFF'}
          </button>
        </div>
      </div>

      <!-- 🎥 카메라 시야 배율 및 스마트 시점 -->
      <div style="background:#14171f; border:1px solid #3d3020; border-radius:6px; padding:6px; display:flex; flex-direction:column; gap:5px;">
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
        <div style="display:flex; gap:4px;">
          <button class="shop-buy-btn" style="flex:1.35; background:${trackBtnBg}; border-color:${trackBtnBd}; padding:4px 5px; font-size:9.5px;" onclick="toggleSmoothCameraOption()">
            🎯 시점추적: ${OptionState.smoothCamera ? 'ON' : 'OFF'}
          </button>
          <button class="shop-buy-btn" style="flex:0.85; background:#374151; border-color:#6b7280; padding:4px 5px; font-size:9.5px;" onclick="toggleFullScreen()">⛶ 전체화면</button>
        </div>
      </div>

      <!-- 💎 자동사냥 장비 루팅 등급 -->
      <div style="background:#14171f; border:1px solid #3d3020; border-radius:6px; padding:6px; display:flex; flex-direction:column; gap:4px;">
        <div style="color:#facc15; font-weight:bold;">💎 자동사냥 장비 루팅 등급</div>
        <div style="display:grid; grid-template-columns: repeat(5, 1fr); gap:3px;">
          <button class="shop-buy-btn" style="padding:4px 2px; font-size:9px; text-align:center; ${btnStyle(0)}" onclick="setLootGradeOption(0)">일반+</button>
          <button class="shop-buy-btn" style="padding:4px 2px; font-size:9px; text-align:center; ${btnStyle(1)}" onclick="setLootGradeOption(1)">고급+</button>
          <button class="shop-buy-btn" style="padding:4px 2px; font-size:9px; text-align:center; ${btnStyle(2)}" onclick="setLootGradeOption(2)">희귀+</button>
          <button class="shop-buy-btn" style="padding:4px 2px; font-size:9px; text-align:center; ${btnStyle(3)}" onclick="setLootGradeOption(3)">전설+</button>
          <button class="shop-buy-btn" style="padding:4px 2px; font-size:9px; text-align:center; ${btnStyle(4)}" onclick="setLootGradeOption(4)">초월만</button>
        </div>
      </div>

      <!-- 👤 계정 및 캐릭터 관리 (월드맵 버튼 제거 완료) -->
      <div style="background:#1a1612; border:1px solid #b45309; border-radius:6px; padding:6px; display:flex; flex-direction:column; gap:5px;">
        <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #3d3020; padding-bottom:2px;">
          <span style="color:#fde047; font-weight:bold;">👤 계정 및 접속 관리</span>
          <span id="opt-autosave-badge" style="font-size:8.5px; color:#4ade80;">☁️ 수파베이스 동기화됨</span>
        </div>
        <div style="display:flex; gap:6px;">
          <button class="shop-buy-btn" style="flex:1.15; background:#1e3a8a; border-color:#60a5fa; padding:6px 6px; font-size:10.5px;" onclick="returnToCharacterSelect()">🔄 캐릭터 선택</button>
          <button class="shop-buy-btn" style="flex:1; background:#7f1d1d; border-color:#f87171; padding:6px 6px; font-size:10.5px;" onclick="logoutAccount()">🚪 로그아웃</button>
        </div>
      </div>

    </div>
  `;
}
window.renderOptionUI = renderOptionUI;