// js/game_04_combat_spawn.js — 앱 부트 · 버프/클래스 전용 아이콘 · 가방/강화 · 스킬 시전 · 몬스터 스폰
window.onload = async () => {
  if (window._magicBootStarted) return;
  window._magicBootStarted = true;
  ensureAllGameModals();
  initOptionSystem();
  // 새로고침 즉시 저장된 이메일을 먼저 복원하고, 수파베이스 온라인 체크를 비동기로 즉시 시작 (황색 대기 지연 방지!)
  window.restoreRememberedEmailToInput?.();
  await loadEnvConfig();
  const authInitPromise = window.initAuthAndCharacterSystem?.();

  try {
    const res = await fetch('./asset/item.json');
    if (res.ok) window.itemJsonData = await res.json();
  } catch (e) { console.warn("item.json fallback mode"); }

  if (window.itemJsonData) {
    await loadItemSheetSprites(window.itemJsonData);
  }

  await loadWorldMapTmj();
  await loadRegionTmjPortals("R01", 4000, 16000);

  GameDB.Items.Weapons.forEach(i => window.itemDict[i.id] = i);
  GameDB.Items.Armors.forEach(i => window.itemDict[i.id] = i);
  GameDB.Items.Consumables.forEach(i => window.itemDict[i.id] = i);
  GameDB.Items.Accessories.forEach(i => window.itemDict[i.id] = i);
  GameDB.Items.QuestItems.forEach(i => window.itemDict[i.id] = i);

  app = new PIXI.Application({ 
    width: Math.max(wrapper?.clientWidth || 0, window.innerWidth || 360),
    height: Math.max(wrapper?.clientHeight || 0, window.innerHeight || 640),
    resizeTo: wrapper, 
    backgroundColor: 0x0a0c10, 
    resolution: window.devicePixelRatio || 1, 
    autoDensity: true,
    powerPreference: "high-performance" 
  });

  window.forceResizePixiApp = function() {
    if (!app || !app.renderer) return;
    const wrapEl = document.getElementById('game-wrapper') || wrapper;
    const w = Math.max(wrapEl?.clientWidth || 0, window.innerWidth || 360);
    const h = Math.max(wrapEl?.clientHeight || 0, window.innerHeight || 640);
    if (w > 0 && h > 0) {
      app.renderer.resize(w, h);
      if (typeof app.resize === 'function' && (wrapEl?.clientWidth || 0) > 0 && (wrapEl?.clientHeight || 0) > 0) {
        try { app.resize(); } catch (e) {}
      }
      if (cameraContainer && player && typeof currentWorldWidth === 'number' && typeof currentWorldHeight === 'number') {
        const halfW = w / 2;
        const halfH = h / 2;
        const camX = currentWorldWidth > w
          ? Math.max(halfW, Math.min(currentWorldWidth - halfW, player.x || 0))
          : currentWorldWidth / 2;
        const camY = currentWorldHeight > h
          ? Math.max(halfH, Math.min(currentWorldHeight - halfH, player.y || 0))
          : currentWorldHeight / 2;
        cameraContainer.x = Math.round(halfW - camX);
        cameraContainer.y = Math.round(halfH - camY);
      }
      if (window.MapChunkManager && player && typeof window.MapChunkManager.updateActiveChunks === 'function') {
        window.MapChunkManager.updateActiveChunks(player.y || 0, true);
      }
    }
  };



  app.ticker.autoStart = true;
  app.ticker.maxFPS = 60;
  if (app.ticker.stopWhenPaused) {
    app.ticker.stopWhenPaused = false;
  }
  wrapper.appendChild(app.view);
  cameraContainer = new PIXI.Container();
  app.stage.addChild(cameraContainer);

  bgContainer = new PIXI.Container();
  cameraContainer.addChild(bgContainer);

window.bottomMagicCircleG = new PIXI.Graphics();
cameraContainer.addChild(window.bottomMagicCircleG);

  entityContainer = new PIXI.Container();
  cameraContainer.addChild(entityContainer);
  uiContainer = new PIXI.Container();
  cameraContainer.addChild(uiContainer);

  mainG = new PIXI.Graphics();
  entityContainer.addChild(mainG);
  window.fxG = new PIXI.Graphics();
  uiContainer.addChild(window.fxG);
  uiG = new PIXI.Graphics();
  uiContainer.addChild(uiG);
  pCtx = new PixiCtx(mainG);
  mCtx = mCanvas.getContext('2d');

  setupVirtualJoystickEvents();

  PlayerSpriteManager.container = entityContainer;
  await loadCustomSprites();

  window.addEventListener('resize', () => {
    window.forceResizePixiApp?.();
    ['equip-ui', 'inventory-ui', 'skill-ui', 'quest-ui', 'npc-modal-ui', 'option-ui', 'merc-ui', 'party-control-modal', 'game-tip-modal', 'trade-modal-ui'].forEach(id => {
      const el = document.getElementById(id);
      if (el && !el.classList.contains('hidden')) window.centerModalOnScreen?.(el);
    });
  });

  document.addEventListener('fullscreenchange', () => {
    window.forceResizePixiApp?.();
    setTimeout(() => window.forceResizePixiApp?.(), 80);
  });

  if (typeof ResizeObserver !== 'undefined' && wrapper) {
    const ro = new ResizeObserver(() => {
      window.forceResizePixiApp?.();
    });
    ro.observe(wrapper);
  }

  let _lastMinimapOpenTs = 0;
  const handleMinimapOpen = (e) => {
    if (e) {
      if (e.cancelable) e.preventDefault();
      e.stopPropagation();
    }
    const now = Date.now();
    if (now - _lastMinimapOpenTs < 240) return;
    _lastMinimapOpenTs = now;
    window._mapModalOpenedAt = now;
    window.openRegionDetailMap?.();
  };
  const minimapContainerEl = document.getElementById('minimap-container');
  if (minimapContainerEl) {
    minimapContainerEl.addEventListener('touchend', handleMinimapOpen, { passive: false });
    minimapContainerEl.addEventListener('pointerup', handleMinimapOpen);
    minimapContainerEl.addEventListener('click', handleMinimapOpen);
  }
  if (mCanvas) {
    mCanvas.addEventListener('touchend', handleMinimapOpen, { passive: false });
    mCanvas.addEventListener('pointerup', handleMinimapOpen);
    mCanvas.addEventListener('click', handleMinimapOpen);
  }

  bindQuickSlotEvents();
  app.ticker.add(gameLoop);
  app.ticker.add(() => window.updateHotbarCooldowns());

  ['equip-ui', 'inventory-ui', 'skill-ui', 'quest-ui', 'npc-modal-ui', 'option-ui', 'merc-ui', 'stat-alloc-modal', 'immersive-20-modal', 'party-control-modal', 'game-tip-modal', 'trade-modal-ui'].forEach(id => makeDraggable(id));
  setupChatWindowDragAndResize();
  await authInitPromise;
};

window.startGame = function(selectedClass, customCharName = null, savedCharRecord = null, deferDisplay = false) {
  ensureAllGameModals();
  window.partyState = null;
  window.clearAllOtherPlayersVisuals?.();
  window.otherPlayers = [];
  window.sweepOrphanPixiVisuals?.();

  if (!selectedClass || !CLASS_STATS[selectedClass]) {
    selectedClass = (savedCharRecord?.class && CLASS_STATS[savedCharRecord.class]) ? savedCharRecord.class : 'knight';
  }
  const sysCfg = GameDB.SystemConfig || {};
  player.class = selectedClass;
  player.name = customCharName || CLASS_STATS[selectedClass].name;

  let bStats = CLASS_STATS[selectedClass].fixedBaseStats;
  player.stats = { STR: bStats.str, DEX: bStats.dex, INT: bStats.int, CON: bStats.con };
  player.level = 1;
  player.exp = 0;
  player.maxExp = 100;
  player.statPoints = 0;
  player.statResetUsed = 0;
  player.gold = sysCfg.startGold ?? 600;
  player.bankGold = window.accountStorage?.bankGold || 0;
  player.weaponPlus = 0;
  player.armorPlus = 0;
  player.quests = {};
  window.initDefaultLearnedSkills(selectedClass);

  player.inventory = Array(100).fill(null);
  player.equip = createEmptyEquipObj();
  player.gmSpeedMult = 1;
  player.activeBuffs = {
    SHIELD: 0, WIND_WALK: 0, RAGE: 0, HASTE: 0, ELIXIR: 0,
    HOLY_WEAPON: 0, ENCHANT_STAT: 0, MENTAL_FOCUS: 0, MANA_SHIELD: 0,
    HOLY_WALK: 0, SHADOW_FANG: 0, IMMUNE: 0, ABSOLUTE_BARRIER: 0,
    ADV_SPIRIT: 0, SUMMON_GOLEM: 0, ARCHMAGE: 0, EAGLE_EYE: 0,
    LIGHT: 0, MERC_BLESS: 0,
    ELVEN_GRACE: 0, NATURES_FURY: 0, SOUL_BARRIER: 0, COUNTER: 0,
    IRON_SKIN: 0, GUARDIAN_ARMOR: 0
  };
  mercenary.hired = false;
  mercenary.isDead = false;
  window.autoSlots = new Set();

  if (!savedCharRecord) {
    // 신규 캐릭터 생성 시 data.js의 SystemConfig.startItems 및 startWeaponsByClass 지급
    const startItems = sysCfg.startItems || [
      { id: 'C_P01', qty: 20 },
      { id: 'C_P03', qty: 20 },
      { id: 'S_RE01', qty: 5 },
      { id: 'A_TS01', qty: 1, gradeIdx: 0 }
    ];
    startItems.forEach(st => giveItem(st.id, st.qty || 1, typeof st.gradeIdx === 'number' ? st.gradeIdx : null));

    const startWeapMap = sysCfg.startWeaponsByClass || { wizard: 'W_ST01', ranger: 'W_BW01', knight: 'W_SW01' };
    const startWeapId = startWeapMap[selectedClass] || 'W_SW01';
    giveItem(startWeapId, 1, 0);

    const activeSkills = SKILLS_DB[selectedClass].filter(s => s.type !== '패시브' && player.learnedSkills.has(s.id));
    window.skillSlots = Array(11).fill(null);
    window.skillSlots[1] = { type: 'item', itemType: 'C_P01' };
    window.skillSlots[2] = { type: 'item', itemType: 'C_P03' };
    if (activeSkills[0]) window.skillSlots[3] = { type: 'skill', name: activeSkills[0].name };
    if (activeSkills[1]) window.skillSlots[4] = { type: 'skill', name: activeSkills[1].name };
    window.skillSlots[9] = { type: 'item', itemType: 'S_RE01' };

    let wIdx = player.inventory.findIndex(i => i && i.type === startWeapId);
    if (wIdx > -1) player.equip.weapon = wIdx;
    let tsIdx = player.inventory.findIndex(i => i && i.type === 'A_TS01');
    if (tsIdx > -1) player.equip.tshirt = tsIdx;
    window.sortPlayerInventory?.(true);

    recalcMaxHpMp(false);
    player.hp = player.maxHp;
    player.mp = player.maxMp;
  } else {
    // 저장된 캐릭터 데이터 복원
    window.applySavedCharacterRecordToState?.(savedCharRecord);
  }

  document.getElementById('class-icon').innerHTML = window.getClassIconHTML ? window.getClassIconHTML(player.class, 26) : (CLASS_STATS[player.class]?.icon || '🛡️');
  if (!deferDisplay) {
    const authOverlay = document.getElementById('auth-overlay-ui');
    if (authOverlay) authOverlay.style.display = 'none';
    document.getElementById('char-select-ui').style.display = 'none';
    document.getElementById('game-wrapper').style.display = 'flex';
  }

  window.forceResizePixiApp?.();
  requestAnimationFrame(() => window.forceResizePixiApp?.());
  setTimeout(() => window.forceResizePixiApp?.(), 50);
  setTimeout(() => window.forceResizePixiApp?.(), 200);
  setTimeout(() => window.forceResizePixiApp?.(), 450);

  const targetMap = savedCharRecord?.map_key || sysCfg.startMap || 'R01_sub1';
  const targetPos = (savedCharRecord && savedCharRecord.pos_x && savedCharRecord.pos_y)
    ? { x: Number(savedCharRecord.pos_x), y: Number(savedCharRecord.pos_y) }
    : (sysCfg.startSpawn || null);

  currentMapKey = targetMap;
  currentRegionKey = String(targetMap).split('_')[0] || 'R01';
  const initSpawn = targetPos || window.HardcodedMapDB?.[targetMap]?.spawn || { x: 2000, y: 14250 };
  if (initSpawn && initSpawn.x && initSpawn.y) {
    player.x = Number(initSpawn.x);
    player.y = Number(initSpawn.y);
    player.targetX = player.x;
    player.targetY = player.y;
  }

  loadMapData(targetMap, targetPos);
  renderHotbarSlots();
  updateStatusHUD();
  window.updateMercHUD();
  window.renderQuestUI();

  if (window.SoundSystem) {
    window.SoundSystem.bgmUnlocked = true;
    window.SoundSystem.updateBgmState?.();
  }
};

function updateStatusHUD() {
  if (!player) return;
  recalcMaxHpMp(false);
  document.getElementById('hud-hp-bar').style.width = `${Math.max(0, (player.hp / player.maxHp) * 100)}%`;
  document.getElementById('hud-hp-txt').innerText = `${Math.ceil(player.hp)}/${player.maxHp}`;
  document.getElementById('hud-mp-bar').style.width = `${Math.max(0, (player.mp / player.maxMp) * 100)}%`;
  document.getElementById('hud-mp-txt').innerText = `${Math.ceil(player.mp)}/${player.maxMp}`;

  let expPercent = Math.min(100, Math.floor((player.exp / player.maxExp) * 100));
  document.getElementById('btm-lv').innerText = player.level;
  document.getElementById('btm-exp').innerText = `${expPercent}%`;
  document.getElementById('btm-gold').innerText = Number(player.gold || 0).toLocaleString();
  document.getElementById('exp-bar-fill').style.width = `${expPercent}%`;

  const cStats = calculateCombatStats(false);
  const atkDisplay = player.class === 'wizard' ? cStats.totalMAtk : cStats.totalAtk;
  const btmAtkEl = document.getElementById('btm-atk');
  const btmDefEl = document.getElementById('btm-def');
  if (btmAtkEl) btmAtkEl.innerText = atkDisplay;
  if (btmDefEl) btmDefEl.innerText = `${cStats.totalDef}/${cStats.totalMDef || 0}`;

  const classIconEl = document.getElementById('class-icon');
  if (classIconEl) {
    if (player.statPoints > 0) classIconEl.classList.add('stat-glow');
    else classIconEl.classList.remove('stat-glow');
  }
}
window.updateStatusHUD = updateStatusHUD;

// 🎨 클래스 전용 커스텀 SVG 아이콘 생성기 (마법사 🔮 사각 깨짐 완벽 해결 및 전사/궁수/마법사 전용 아트워크)
window.getClassIconHTML = function(classKey = 'knight', size = 24) {
  const s = Number(size) || 24;
  if (classKey === 'wizard') {
    return `<svg width="${s}" height="${s}" viewBox="0 0 32 32" style="display:inline-block;vertical-align:middle;filter:drop-shadow(0 1px 2px rgba(0,0,0,0.85));"><defs><radialGradient id="wizOrb_${s}" cx="50%" cy="45%" r="55%"><stop offset="0%" stop-color="#e0f2fe"/><stop offset="45%" stop-color="#38bdf8"/><stop offset="85%" stop-color="#9333ea"/><stop offset="100%" stop-color="#3b0764"/></radialGradient></defs><circle cx="16" cy="16" r="13.5" fill="#1e1b4b" stroke="#c084fc" stroke-width="2"/><line x1="8" y1="25" x2="21" y2="12" stroke="#f59e0b" stroke-width="3" stroke-linecap="round"/><path d="M15 7 C20 5 26 11 24 16 C26 12 22 7 15 7 Z" fill="#fde047"/><circle cx="20.5" cy="11.5" r="5.2" fill="url(#wizOrb_${s})" stroke="#fef08a" stroke-width="1.4"/><polygon points="20.5,4 21.7,7.5 25,8.5 21.7,9.5 20.5,13 19.3,9.5 16,8.5 19.3,7.5" fill="#ffffff" opacity="0.92"/><circle cx="10" cy="11" r="1.4" fill="#38bdf8"/><circle cx="25" cy="21" r="1.3" fill="#f472b6"/></svg>`;
  }
  if (classKey === 'ranger') {
    return `<svg width="${s}" height="${s}" viewBox="0 0 32 32" style="display:inline-block;vertical-align:middle;filter:drop-shadow(0 1px 2px rgba(0,0,0,0.85));"><defs><linearGradient id="rngBg_${s}" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#10b981"/><stop offset="100%" stop-color="#064e3b"/></linearGradient></defs><circle cx="16" cy="16" r="13.5" fill="url(#rngBg_${s})" stroke="#34d399" stroke-width="2"/><path d="M11 6 C21 10 21 22 11 26" fill="none" stroke="#facc15" stroke-width="2.5" stroke-linecap="round"/><line x1="11" y1="6.5" x2="11" y2="25.5" stroke="#e2e8f0" stroke-width="1.3"/><line x1="7" y1="16" x2="24" y2="16" stroke="#fef08a" stroke-width="2.2" stroke-linecap="round"/><polygon points="26,16 21,13 22,16 21,19" fill="#38bdf8"/></svg>`;
  }
  return `<svg width="${s}" height="${s}" viewBox="0 0 32 32" style="display:inline-block;vertical-align:middle;filter:drop-shadow(0 1px 2px rgba(0,0,0,0.85));"><defs><linearGradient id="kntSh_${s}" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#ef4444"/><stop offset="100%" stop-color="#7f1d1d"/></linearGradient></defs><path d="M16 3 L27 7 V15 C27 22.5 21.8 27.2 16 29.5 C10.2 27.2 5 22.5 5 15 V7 Z" fill="url(#kntSh_${s})" stroke="#facc15" stroke-width="2"/><path d="M16 6 L24 9 V14.8 C24 20.5 20 24.2 16 26.2 C12 24.2 8 20.5 8 14.8 V9 Z" fill="none" stroke="#fef08a" stroke-width="0.9" stroke-opacity="0.7"/><path d="M16 7 V24 M11 13 H21" stroke="#fde047" stroke-width="2.4" stroke-linecap="round"/><circle cx="16" cy="13" r="2.2" fill="#ffffff"/></svg>`;
};

// 🎨 버프별 직관적인 맞춤형 SVG 아이콘 아트워크 (모든 기기에서 사각 깨짐 없이 버프 효과를 한눈에 연상)
const BUFF_META = {
  SHIELD:           { label: '쉴드', border: '#38bdf8', svg: `<svg width="20" height="20" viewBox="0 0 28 28"><path d="M14 3 L24 7 V14 C24 20.2 19.5 24.4 14 26 C8.5 24.4 4 20.2 4 14 V7 Z" fill="#0284c7" fill-opacity="0.88" stroke="#7dd3fc" stroke-width="2"/><path d="M14 6 L20 9 V13.8 C20 18 17.2 21 14 22.4 C10.8 21 8 18 8 13.8 V9 Z" fill="#38bdf8" fill-opacity="0.45"/><path d="M14 8 V20 M9.5 13 H18.5" stroke="#e0f2fe" stroke-width="2" stroke-linecap="round"/></svg>` },
  WIND_WALK:        { label: '윈드워크', border: '#34d399', svg: `<svg width="20" height="20" viewBox="0 0 28 28"><circle cx="14" cy="14" r="12" fill="#064e3b" stroke="#34d399" stroke-width="1.8"/><path d="M7 18 L14 18 L16 11 L20 11 L19 21 L7 21 Z" fill="#fde047" stroke="#f59e0b" stroke-width="1"/><path d="M4 11 Q11 7 18 10 M3 15 Q10 12 15 14" fill="none" stroke="#6ee7b7" stroke-width="2" stroke-linecap="round"/><path d="M18 7 C22 5 25 8 22 12 C24 10 25 13 21 15" fill="none" stroke="#ffffff" stroke-width="1.8" stroke-linecap="round"/></svg>` },
  RAGE:             { label: '레이지', border: '#ef4444', svg: `<svg width="20" height="20" viewBox="0 0 28 28"><circle cx="14" cy="14" r="12" fill="#7f1d1d" stroke="#f87171" stroke-width="1.8"/><path d="M14 4 C18 8 22 11 20 18 C19 22 16 24 14 24 C12 24 9 22 8 18 C6 11 10 8 14 4 Z" fill="#ef4444"/><path d="M14 9 C16.5 12 18 14 17 19 C16 21 14 22 14 22 C14 22 12 21 11 19 C10 14 11.5 12 14 9 Z" fill="#fde047"/><line x1="7" y1="21" x2="21" y2="7" stroke="#ffffff" stroke-width="2" stroke-linecap="round"/><line x1="7" y1="7" x2="21" y2="21" stroke="#ffffff" stroke-width="2" stroke-linecap="round"/></svg>` },
  HASTE:            { label: '헤이스트', border: '#facc15', svg: `<svg width="20" height="20" viewBox="0 0 28 28"><circle cx="14" cy="14" r="12" fill="#713f12" stroke="#facc15" stroke-width="1.8"/><polygon points="15,4 7,15 13,15 11,24 21,12 15,12" fill="#fde047" stroke="#ffffff" stroke-width="1"/><path d="M4 9 H8 M3 14 H6 M4 19 H8" stroke="#38bdf8" stroke-width="2" stroke-linecap="round"/></svg>` },
  ELIXIR:           { label: '용사의비약', border: '#f43f5e', svg: `<svg width="20" height="20" viewBox="0 0 28 28"><circle cx="14" cy="14" r="12" fill="#4c0519" stroke="#fb7185" stroke-width="1.8"/><rect x="11" y="4" width="6" height="3" rx="1" fill="#fde047"/><path d="M11 7 L8 14 C6.5 17.5 8.5 23 14 23 C19.5 23 21.5 17.5 20 14 L17 7 Z" fill="#e11d48" stroke="#fecdd3" stroke-width="1.5"/><polygon points="14,11 15.2,14 18.5,14.3 16,16.5 16.8,19.6 14,17.8 11.2,19.6 12,16.5 9.5,14.3 12.8,14" fill="#fde047"/></svg>` },
  HOLY_WEAPON:      { label: '홀리웨폰', border: '#fde047', svg: `<svg width="20" height="20" viewBox="0 0 28 28"><circle cx="14" cy="14" r="12" fill="#422006" stroke="#fde047" stroke-width="1.8"/><line x1="7" y1="21" x2="21" y2="7" stroke="#fef08a" stroke-width="3.2" stroke-linecap="round"/><line x1="8" y1="14" x2="14" y2="20" stroke="#f59e0b" stroke-width="2.4" stroke-linecap="round"/><polygon points="21,4 22,7 25,8 22,9 21,12 20,9 17,8 20,7" fill="#ffffff"/></svg>` },
  ENCHANT_STAT:     { label: '인챈트스탯', border: '#4ade80', svg: `<svg width="20" height="20" viewBox="0 0 28 28"><circle cx="14" cy="14" r="12" fill="#064e3b" stroke="#4ade80" stroke-width="1.8"/><polygon points="14,5 20,12 16.5,12 16.5,22 11.5,22 11.5,12 8,12" fill="#4ade80" stroke="#dcfce7" stroke-width="1.2"/><polygon points="7,9 10,6 10,11" fill="#fde047"/><polygon points="21,9 18,6 18,11" fill="#fde047"/></svg>` },
  MENTAL_FOCUS:     { label: '멘탈포커스', border: '#60a5fa', svg: `<svg width="20" height="20" viewBox="0 0 28 28"><circle cx="14" cy="14" r="12" fill="#1e3a8a" stroke="#60a5fa" stroke-width="1.8"/><path d="M14 5 C14 5 21 13 21 17.5 C21 21.2 17.8 24 14 24 C10.2 24 7 21.2 7 17.5 C7 13 14 5 14 5 Z" fill="#3b82f6" stroke="#bfdbfe" stroke-width="1.5"/><circle cx="14" cy="17" r="3.2" fill="#e0f2fe"/></svg>` },
  MANA_SHIELD:      { label: '마나실드', border: '#c084fc', svg: `<svg width="20" height="20" viewBox="0 0 28 28"><circle cx="14" cy="14" r="12" fill="#2e1065" stroke="#c084fc" stroke-width="2"/><circle cx="14" cy="14" r="8.5" fill="#7e22ce" fill-opacity="0.55" stroke="#38bdf8" stroke-width="1.6" stroke-dasharray="3 2"/><circle cx="14" cy="14" r="4.2" fill="#e0f2fe"/></svg>` },
  HOLY_WALK:        { label: '홀리워크', border: '#fde047', svg: `<svg width="20" height="20" viewBox="0 0 28 28"><circle cx="14" cy="14" r="12" fill="#3b0764" stroke="#fde047" stroke-width="1.8"/><path d="M6 17 C6 10 12 7 15 11 C18 7 23 10 22 17 C19 15 16 16 14 20 C12 16 9 15 6 17 Z" fill="#fef08a" stroke="#f59e0b" stroke-width="1.2"/><polygon points="14,4 11,12 15,12 12,21 19,11 15,11" fill="#38bdf8"/></svg>` },
  SHADOW_FANG:      { label: '쉐도우팽', border: '#a855f7', svg: `<svg width="20" height="20" viewBox="0 0 28 28"><circle cx="14" cy="14" r="12" fill="#1e1b4b" stroke="#a855f7" stroke-width="1.8"/><path d="M7 21 L19 6 L22 9 L9 22 Z" fill="#c084fc" stroke="#f3e8ff" stroke-width="1"/><path d="M8 8 C14 6 20 12 18 20 C16 14 12 11 8 8 Z" fill="#f43f5e" opacity="0.85"/></svg>` },
  IMMUNE:           { label: '뮨', border: '#facc15', svg: `<svg width="20" height="20" viewBox="0 0 28 28"><circle cx="14" cy="14" r="12" fill="#422006" stroke="#facc15" stroke-width="2"/><path d="M14 4 L23 8 V14.5 C23 20 19 23.8 14 25.5 C9 23.8 5 20 5 14.5 V8 Z" fill="#eab308" stroke="#fef9c3" stroke-width="1.6"/><path d="M14 8 V21 M9 14 H19" stroke="#ffffff" stroke-width="2.5" stroke-linecap="round"/></svg>` },
  ABSOLUTE_BARRIER: { label: '무적배리어', border: '#fef08a', svg: `<svg width="20" height="20" viewBox="0 0 28 28"><circle cx="14" cy="14" r="12" fill="#0f172a" stroke="#fef08a" stroke-width="2.2"/><polygon points="14,3 24,14 14,25 4,14" fill="#38bdf8" fill-opacity="0.55" stroke="#ffffff" stroke-width="1.8"/><polygon points="14,7 20,14 14,21 8,14" fill="#fef08a"/></svg>` },
  ADV_SPIRIT:       { label: '스피릿', border: '#fb923c', svg: `<svg width="20" height="20" viewBox="0 0 28 28"><circle cx="14" cy="14" r="12" fill="#431407" stroke="#fb923c" stroke-width="1.8"/><path d="M14 23 C14 23 6 17.5 6 11.5 C6 8.2 8.6 6 11.2 6 C12.8 6 14 7.2 14 7.2 C14 7.2 15.2 6 16.8 6 C19.4 6 22 8.2 22 11.5 C22 17.5 14 23 14 23 Z" fill="#ef4444" stroke="#fde047" stroke-width="1.5"/><circle cx="14" cy="13.5" r="3" fill="#fef08a"/></svg>` },
  SUMMON_GOLEM:     { label: '소환골렘', border: '#d97706', svg: `<svg width="20" height="20" viewBox="0 0 28 28"><circle cx="14" cy="14" r="12" fill="#292524" stroke="#d97706" stroke-width="1.8"/><polygon points="8,7 20,7 23,14 20,22 8,22 5,14" fill="#78716c" stroke="#d6d3d1" stroke-width="1.4"/><rect x="9" y="12" width="3.5" height="2.5" fill="#fde047"/><rect x="15.5" y="12" width="3.5" height="2.5" fill="#fde047"/><line x1="10" y1="18" x2="18" y2="18" stroke="#44403c" stroke-width="2"/></svg>` },
  ARCHMAGE:         { label: '아크메이지', border: '#e879f9', svg: `<svg width="20" height="20" viewBox="0 0 28 28"><circle cx="14" cy="14" r="12" fill="#3b0764" stroke="#e879f9" stroke-width="1.8"/><polygon points="5,20 7,10 11,15 14,7 17,15 21,10 23,20" fill="#fde047" stroke="#ffffff" stroke-width="1.2"/><circle cx="14" cy="16" r="2" fill="#a855f7"/></svg>` },
  EAGLE_EYE:        { label: '이글아이', border: '#38bdf8', svg: `<svg width="20" height="20" viewBox="0 0 28 28"><circle cx="14" cy="14" r="12" fill="#0c4a6e" stroke="#38bdf8" stroke-width="1.8"/><path d="M4 14 Q14 6 24 14 Q14 22 4 14 Z" fill="#e0f2fe" stroke="#38bdf8" stroke-width="1.5"/><circle cx="14" cy="14" r="4" fill="#0284c7"/><circle cx="14" cy="14" r="1.8" fill="#fde047"/></svg>` },
  LIGHT:            { label: '라이트', border: '#fde047', svg: `<svg width="20" height="20" viewBox="0 0 28 28"><circle cx="14" cy="14" r="12" fill="#422006" stroke="#fde047" stroke-width="1.8"/><circle cx="14" cy="14" r="5.5" fill="#fef08a"/><path d="M14 3 V6 M14 22 V25 M3 14 H6 M22 14 H25 M6.5 6.5 L8.8 8.8 M19.2 19.2 L21.5 21.5 M21.5 6.5 L19.2 8.8 M8.8 19.2 L6.5 21.5" stroke="#fde047" stroke-width="2" stroke-linecap="round"/></svg>` },
  MERC_BLESS:       { label: '단장축복', border: '#fbbf24', svg: `<svg width="20" height="20" viewBox="0 0 28 28"><circle cx="14" cy="14" r="12" fill="#451a03" stroke="#fbbf24" stroke-width="1.8"/><line x1="8" y1="5" x2="8" y2="23" stroke="#fde047" stroke-width="2.2" stroke-linecap="round"/><polygon points="9,6 22,8.5 18,12.5 22,16.5 9,16.5" fill="#ef4444" stroke="#fde047" stroke-width="1.2"/></svg>` },
  ELVEN_GRACE:      { label: '그레이스', border: '#4ade80', svg: `<svg width="20" height="20" viewBox="0 0 28 28"><circle cx="14" cy="14" r="12" fill="#064e3b" stroke="#4ade80" stroke-width="1.8"/><path d="M21 7 C12 7 7 12 7 21 C16 21 21 16 21 7 Z" fill="#10b981" stroke="#a7f3d0" stroke-width="1.5"/><path d="M8 20 L18 10" stroke="#fef08a" stroke-width="1.5" stroke-linecap="round"/></svg>` },
  NATURES_FURY:     { label: '퓨리', border: '#22c55e', svg: `<svg width="20" height="20" viewBox="0 0 28 28"><circle cx="14" cy="14" r="12" fill="#14532d" stroke="#22c55e" stroke-width="1.8"/><line x1="6" y1="19" x2="20" y2="7" stroke="#fde047" stroke-width="2"/><polygon points="22,5 17,6 20,10" fill="#4ade80"/><line x1="8" y1="22" x2="22" y2="10" stroke="#a7f3d0" stroke-width="2"/><polygon points="24,8 19,9 22,13" fill="#fde047"/></svg>` },
  SOUL_BARRIER:     { label: '소울배리어', border: '#2dd4bf', svg: `<svg width="20" height="20" viewBox="0 0 28 28"><circle cx="14" cy="14" r="12" fill="#042f2e" stroke="#2dd4bf" stroke-width="1.8"/><path d="M14 5 A9 9 0 1 1 5 14" fill="none" stroke="#5eead4" stroke-width="2.4" stroke-linecap="round"/><path d="M14 23 A9 9 0 0 1 14 5" fill="none" stroke="#38bdf8" stroke-width="2" stroke-dasharray="3 2"/><circle cx="14" cy="14" r="4" fill="#ccfbf1"/></svg>` },
  COUNTER:          { label: '카운터', border: '#f59e0b', svg: `<svg width="20" height="20" viewBox="0 0 28 28"><circle cx="14" cy="14" r="12" fill="#451a03" stroke="#f59e0b" stroke-width="1.8"/><line x1="6" y1="21" x2="21" y2="6" stroke="#e2e8f0" stroke-width="2.5" stroke-linecap="round"/><line x1="22" y1="21" x2="7" y2="6" stroke="#fde047" stroke-width="2.5" stroke-linecap="round"/><circle cx="14" cy="13.5" r="3" fill="#ffffff"/></svg>` },
  IRON_SKIN:        { label: '아이언스킨', border: '#94a3b8', svg: `<svg width="20" height="20" viewBox="0 0 28 28"><circle cx="14" cy="14" r="12" fill="#1e293b" stroke="#94a3b8" stroke-width="1.8"/><path d="M14 4 L23 8 V14.5 C23 20 19 23.8 14 25.5 C9 23.8 5 20 5 14.5 V8 Z" fill="#475569" stroke="#e2e8f0" stroke-width="1.6"/><path d="M14 7 V22" stroke="#cbd5e1" stroke-width="2"/></svg>` },
  GUARDIAN_ARMOR:   { label: '가디언아머', border: '#fde047', svg: `<svg width="20" height="20" viewBox="0 0 28 28"><circle cx="14" cy="14" r="12" fill="#0c4a6e" stroke="#fde047" stroke-width="2"/><path d="M14 4 L23 8 V14.5 C23 20 19 23.8 14 25.5 C9 23.8 5 20 5 14.5 V8 Z" fill="#0284c7" stroke="#fef08a" stroke-width="1.8"/><path d="M14 8 V21 M9 14 H19" stroke="#fde047" stroke-width="2.4" stroke-linecap="round"/></svg>` }
};

window.updateBuffUI = function() {
  let buffUI = document.getElementById('buff-ui');
  if (!buffUI) return;
  buffUI.innerHTML = '';
  let activeBuffCount = 0;
  Object.keys(player.activeBuffs).forEach(key => {
    if (player.activeBuffs[key] > 0) {
      activeBuffCount++;
      let meta = BUFF_META[key] || { label: key, border: '#facc15', svg: `<svg width="20" height="20" viewBox="0 0 28 28"><circle cx="14" cy="14" r="11" fill="#1e293b" stroke="#facc15" stroke-width="2"/><polygon points="14,5 16.5,11 23,11.5 18,16 19.5,22 14,18.5 8.5,22 10,16 5,11.5 11.5,11" fill="#fde047"/></svg>` };
      let sec = Math.ceil(player.activeBuffs[key] / 1000);
      buffUI.innerHTML += `<div title="${meta.label} (${sec}초)" style="background:rgba(10,14,22,0.88); border:1.5px solid ${meta.border || '#facc15'}; border-radius:6px; padding:2px 4px; min-width:34px; color:#fff; display:flex; flex-direction:column; align-items:center; gap:1px; box-shadow:0 2px 5px rgba(0,0,0,0.75);">
        <span style="display:flex;align-items:center;justify-content:center;line-height:1;">${meta.svg}</span>
        <span style="color:#e2e8f0; font-size:8px; font-weight:bold; line-height:1; white-space:nowrap;">${meta.label}</span>
        <span style="color:#fde047; font-size:8.5px; font-weight:bold; line-height:1;">${sec}s</span>
      </div>`;
    }
  });
  // 버프 아이콘이 늘어나 우측 대화 확장 아이콘과 겹칠 수 있으면 대화 아이콘을 버프 아이콘 바로 위로 이동!
  const fab = document.getElementById('chat-toggle-fab');
  if (fab) {
    const viewW = window.innerWidth || 360;
    const estBuffRight = 14 + activeBuffCount * 41;
    const shouldMoveAbove = activeBuffCount >= 5 || (estBuffRight >= viewW - 54);
    fab.classList.toggle('shifted-above-buffs', shouldMoveAbove);
  }
};

let selectedInvIndices = new Set();
let lastTap = 0;
let lastTapIndex = -1;

window.toggleInventory = function() {
  ensureAllGameModals();
  const ui = document.getElementById('inventory-ui');
  if (!ui) return;
  // 가방이 닫혔다가 열릴 때 아이템 위치는 현재 상태 그대로 유지하고, 다중 선택 체크박스만 초기화(해제)!
  const multiChk = document.getElementById('multi-select-toggle');
  if (multiChk) multiChk.checked = false;
  selectedInvIndices.clear();
  window.selectedItemForSlot = null;

  ui.classList.toggle('hidden');
  if (!ui.classList.contains('hidden')) {
    window.bringModalToFront?.(ui);
    renderInventory();
    const detailBox = document.getElementById('item-detail');
    if (detailBox) {
      detailBox.innerHTML = '터치: 상세정보 · 더블터치: 장착/사용 · 하단 슬롯으로 드래그하여 등록';
    }
    window.centerModalOnScreen?.(ui);
  } else {
    hideTouchDragGhost();
  }
};

// 인챈트 성공 확률 계산기 (무기 +6까지 100%, 방어구/장신구 +4까지 100%, 초과 시 단계별 확률)
function getEnchantSuccessChance(curPlus, safeLimit) {
  if (curPlus < safeLimit) return 100;
  const enchCfg = GameDB.SystemConfig?.enchant || {};
  const chances = enchCfg.overStepChances || [65, 50, 38, 28, 20];
  const minChance = enchCfg.minChance ?? 12;
  const overIdx = curPlus - safeLimit;
  if (overIdx >= 0 && overIdx < chances.length) return chances[overIdx];
  const lastVal = chances[chances.length - 1] || 20;
  return Math.max(minChance, lastVal - (overIdx - chances.length + 1) * 2);
}

// 상세창에서 바로 주문서로 해당 슬롯 장비를 강화하는 헬퍼
window.quickEnchantFromDetail = function(targetIdx, scrollItemType) {
  const scrollIdx = player.inventory.findIndex(it => it && it.type === scrollItemType && it.qty > 0);
  if (scrollIdx === -1) {
    window.addChat(`⚠️ 가방에 '${window.itemDict[scrollItemType]?.name || '강화 주문서'}'가 없습니다!`, 'log-hit');
    return;
  }
  enchantScrollType = { scrollIdx, type: scrollItemType };
  executeEnchant(targetIdx);
};

// 인벤토리 및 상태창(장비창) 공용 간결 아이템 정보창 렌더러 (아이템 풀네임 전체 표시 + 불필요한 군더더기 제거)
window.buildConciseItemDetailHTML = function(item, index, mode = 'inventory', slotKey = null, slotLabel = null) {
  if (!item) return `<span style="color:#9ca3af;">아이템을 터치하면 상세 정보가 표시됩니다.</span>`;
  const iData = window.itemDict[item.type] || { name: '알수없음' };
  const isEq = Object.values(player.equip).some(v => v !== null && v !== undefined && Number(v) === index);
  const mult = item.mult || 1.0;
  const gName = iData.questOnly ? '퀘스트' : (item.gradeName || '일반');
  const gColor = iData.questOnly ? '#e879f9' : (item.gradeColor || '#ffffff');
  const isWeapon = Boolean(iData.type && (iData.type.includes('검') || iData.type.includes('활') || iData.type.includes('지팡이')));
  const isArmorOrAcc = Boolean(iData.type && ['방패', '투구', '갑옷', '장갑', '망토', '신발', '반지', '목걸이', '귀걸이', '티셔츠', '벨트'].some(t => iData.type.includes(t)));
  const itemPlus = getItemPlusValue(item, isWeapon ? 'weapon' : (isArmorOrAcc ? 'armor' : null), 'player');
  const plusBadge = itemPlus > 0 ? `<span style="color:#fde047;">+${itemPlus}</span> ` : '';
  const qtyText = item.qty > 1 ? ` <span style="color:#cbd5e1; font-size:11.5px;">(x${item.qty})</span>` : '';

  const statParts = [];
  if (iData.pAtk) {
    const bonusAtk = isWeapon ? (itemPlus * 3 + Math.max(0, itemPlus - 6) * 2) : 0;
    statParts.push(`<span style="color:#fca5a5;">물공 +${Math.round(iData.pAtk * mult)}${bonusAtk > 0 ? `(+${bonusAtk})` : ''}</span>`);
  }
  if (iData.mAtk) {
    const bonusMAtk = isWeapon ? (itemPlus * 3 + Math.max(0, itemPlus - 6) * 2) : 0;
    statParts.push(`<span style="color:#93c5fd;">마공 +${Math.round(iData.mAtk * mult)}${bonusMAtk > 0 ? `(+${bonusMAtk})` : ''}</span>`);
  }
  if (iData.def) {
    const bonusDef = isArmorOrAcc ? (itemPlus * 2 + Math.max(0, itemPlus - 4) * 1) : 0;
    statParts.push(`<span style="color:#4ade80;">방어 +${Math.round(iData.def * mult)}${bonusDef > 0 ? `(+${bonusDef})` : ''}</span>`);
  }
  if (iData.mDef || iData.bonusStats?.mDef) {
    const baseMDefVal = Math.round((iData.mDef || 0) * mult) + (iData.bonusStats?.mDef || 0);
    statParts.push(`<span style="color:#c084fc;">마방 +${baseMDefVal}</span>`);
  }
  if (iData.weight) {
    statParts.push(`<span style="color:#fdba74;">HP+${iData.weight * 2}·MP+${Math.floor(iData.weight * 0.8)}</span>`);
  }
  const liveEffectTxt = iData.healHp
    ? `HP +${iData.healHp}`
    : (iData.healMp ? `MP +${iData.healMp}` : iData.effect);
  if (liveEffectTxt) statParts.push(`<span style="color:#fde047;">${liveEffectTxt}</span>`);
  const buyPriceVal = (iData.price && iData.price > 0) ? iData.price : (iData.questOnly ? 1800 : 100);
  const unitSellVal = Math.max(25, Math.floor(buyPriceVal * 0.35 * (item.mult || 1)));
  statParts.push(`<span style="color:#fde047;">💰가격 ${buyPriceVal.toLocaleString()}G (판매 ${unitSellVal.toLocaleString()}G)</span>`);

  let optHtml = "";
  if (Array.isArray(item.options) && item.options.length > 0) {
    optHtml = `<div style="font-size:11.5px; font-weight:bold; color:#7dd3fc; margin-top:2px;">✨ ${item.options.map(o => `${o.label} +${o.val}${o.unit}`).join(' · ')}</div>`;
  }

  let hiAwakenHtml = "";
  let enchantBtnInline = "";
  if (isWeapon || isArmorOrAcc) {
    const safeLim = isWeapon ? 6 : 4;
    const scrollType = isWeapon ? 'S_WE01' : 'S_AR01';
    const chance = getEnchantSuccessChance(itemPlus, safeLim);
    const hasScroll = player.inventory.some(it => it && it.type === scrollType && it.qty > 0);
    const hiBon = getHighEnchantUtilityBonuses(itemPlus, isWeapon);
    if (hiBon.labels.length > 0) {
      hiAwakenHtml = `<div style="font-size:11px; font-weight:bold; color:#fde047; margin-top:2px;">🌟 ${hiBon.labels.join(' · ')}</div>`;
    }
    if (hasScroll) {
      enchantBtnInline = `<button class="shop-buy-btn" style="padding:3px 7px; font-size:10.5px; background:#6d28d9; border-color:#c084fc;" onclick="quickEnchantFromDetail(${index}, '${scrollType}')">✨+${itemPlus + 1}강화(${chance}%)</button>`;
    }
  }

  const estSellGold = Math.max(25, Math.floor((iData.price || (iData.questOnly ? 1800 : 100)) * 0.35 * (item.mult || 1))) * (item.qty || 1);
  const sellBtnInline = (mode === 'inventory' && !isEq)
    ? `<button class="shop-buy-btn" style="padding:3px 6px; font-size:10px; background:#78350f; border-color:#facc15;" onclick="quickSellSingleItem(${index})">💰판매(${estSellGold.toLocaleString()}G)</button>`
    : '';
  const actionBtnHtml = (mode === 'equip' && slotKey)
    ? `<button class="shop-buy-btn" style="padding:3px 8px; font-size:10.5px; background:#7f1d1d; border-color:#f87171;" onclick="unequipSlotFromPaperdoll('${slotKey}', '${slotLabel || slotKey}')">장착해제</button>`
    : `${sellBtnInline}<button class="shop-buy-btn" style="padding:3px 8px; font-size:10.5px; background:${isEq ? '#7f1d1d' : '#15803d'}; border-color:${isEq ? '#f87171' : '#4ade80'};" onclick="consumeInventoryItem(${index}, false)">${(isWeapon || isArmorOrAcc) ? (isEq ? '장착해제' : '장착') : '사용'}</button>`;

  return `
    <div style="display:flex; align-items:flex-start; justify-content:space-between; gap:6px; border-bottom:1px solid #3d3020; padding-bottom:4px; margin-bottom:4px;">
      <div style="display:flex; align-items:center; gap:6px; min-width:0; flex:1;">
        <div style="flex-shrink:0;">${window.getItemIconHTML(item.type)}</div>
        <div style="color:${gColor}; font-size:13px; font-weight:900; line-height:1.3; white-space:normal; word-break:keep-all; overflow:visible;">
          [${gName}] ${plusBadge}${iData.name}${qtyText}
          <span style="font-size:10.5px; color:#9ca3af; font-weight:bold; margin-left:4px;">${iData.type || ''}</span>
        </div>
      </div>
      <div style="display:flex; align-items:center; gap:4px; flex-shrink:0;">
        ${enchantBtnInline}
        ${actionBtnHtml}
      </div>
    </div>
    <div style="font-size:12px; font-weight:bold; line-height:1.4;">${statParts.join(' <span style="color:#4b5563;">|</span> ') || '<span style="color:#9ca3af;">특수 아이템</span>'}</div>
    ${(() => {
      if (item.type && item.type.startsWith('BOOK_')) {
        const isMyClass = iData.reqClass === player.class;
        const learned = iData.skillId ? isSkillLearned(iData.skillId) : false;
        if (isMyClass && !learned) {
          return `<div style="font-size:11.5px; font-weight:900; color:#4ade80; margin-top:3px; background:rgba(6,95,70,0.45); border:1px solid #34d399; padding:2px 6px; border-radius:4px;">✨ [내 클래스 미습득 기술서/마법서] 사용(더블터치) 시 즉시 습득 가능!</div>`;
        } else if (isMyClass && learned) {
          return `<div style="font-size:11px; font-weight:bold; color:#9ca3af; margin-top:2px;">✔️ 이미 습득한 내 클래스 기술서/마법서입니다.</div>`;
        } else if (iData.reqClass) {
          return `<div style="font-size:11px; font-weight:bold; color:#fca5a5; margin-top:2px;">🔒 [${iData.reqClassLabel || '타 클래스'}] 전용 비전서입니다.</div>`;
        }
      }
      if (mode !== 'inventory' || isEq || !(isWeapon || isArmorOrAcc)) return '';
      const cmp = compareBagItemWithEquipped(item, index);
      if (cmp.isBetter) {
        const sKor = EQUIP_SLOT_LABELS[cmp.targetSlot] || '현재 장비';
        return `<div style="font-size:11px; font-weight:bold; color:#4ade80; margin-top:2px;">▲ [${sKor}] 착용 장비보다 우수함 (종합전투력 +${cmp.diffScore})</div>`;
      }
      return '';
    })()}
    ${optHtml}
    ${hiAwakenHtml}
  `;
};

function syncInventorySelectionDOM() {
  const grid = document.getElementById('inventory-grid');
  if (!grid) return;
  const children = grid.children;
  for (let i = 0; i < children.length; i++) {
    children[i].classList.toggle('selected', selectedInvIndices.has(i));
  }
}

function handleSingleTap(index) {
  if (enchantScrollType) { executeEnchant(index); return; }

  const isMulti = document.getElementById('multi-select-toggle')?.checked || false;
  if (isMulti) {
    if (selectedInvIndices.has(index)) selectedInvIndices.delete(index);
    else selectedInvIndices.add(index);
  } else {
    selectedInvIndices.clear();
    selectedInvIndices.add(index);
  }

  const item = player.inventory[index];
  if (item && (item.type.startsWith('C_P') || item.type === 'S_RE01')) {
    window.selectedItemForSlot = item.type;
  } else {
    window.selectedItemForSlot = null;
  }
  const detailBox = document.getElementById('item-detail');
  if (item && detailBox) {
    detailBox.innerHTML = window.buildConciseItemDetailHTML(item, index, 'inventory');
  }
  const grid = document.getElementById('inventory-grid');
  if (grid && grid.children.length === player.inventory.length) {
    syncInventorySelectionDOM();
  } else {
    renderInventory();
  }
}

window.renderInventory = renderInventory;
function renderInventory() {
  const grid = document.getElementById('inventory-grid');
  if (!grid) return;
  if (window._isTouchDraggingSlot) {
    window._pendingInventoryRenderAfterDrag = true;
    // 드래그 도중에는 DOM 노드를 파괴하지 않고 수량 텍스트만 인플레이스 갱신
    const slots = grid.children;
    for (let i = 0; i < slots.length && i < player.inventory.length; i++) {
      const it = player.inventory[i];
      const qEl = slots[i]?.querySelector?.('.qty');
      if (it && qEl) qEl.innerText = it.qty;
    }
    return;
  }
  grid.innerHTML = '';
  const eqSet = new Set(Object.values(player.equip).filter(v => v !== null && v !== undefined).map(Number));
  const frag = document.createDocumentFragment();

  player.inventory.forEach((item, index) => {
    let div = document.createElement('div');
    let cls = 'inv-slot';
    if (selectedInvIndices.has(index)) cls += ' selected';
    if (item) {
      let iData = window.itemDict[item.type] || { name: '알수없음' };
      const gName = iData.questOnly ? '퀘스트전용' : (item.gradeName || '일반');
      const itemPlus = getItemPlusValue(item, null, 'player');
      const gradeClass = iData.questOnly ? 'grade-bg-quest' : `grade-bg-${item.gradeIdx || 0}`;
      const isBookItem = Boolean(item.type && item.type.startsWith('BOOK_'));
      const isMyClassBook = Boolean(isBookItem && iData.reqClass === player.class);
      const isBookLearned = Boolean(isBookItem && iData.skillId && isSkillLearned(iData.skillId));
      cls += ` ${gradeClass}`;
      if (isMyClassBook && !isBookLearned) {
        cls += ' unlearned-class-book';
      }
      div.className = cls;

      const unitBuyPrice = (iData.price && iData.price > 0) ? iData.price : (iData.questOnly ? 1800 : 100);
      const cmpInfo = !eqSet.has(index) ? compareBagItemWithEquipped(item, index) : { isBetter: false };
      div.innerHTML = window.getItemIconHTML(item.type);
      const bookStatusTitle = isMyClassBook ? (isBookLearned ? ' [✔️습득완료]' : ' [✨내 클래스 미습득 비전서!]') : '';
      div.title = `[${gName}] ${itemPlus > 0 ? '+' + itemPlus + ' ' : ''}${iData.name} (💰${unitBuyPrice.toLocaleString()}G)${cmpInfo.isBetter ? ' [▲현재 착용 장비보다 우수]' : ''}${bookStatusTitle}`;
      if (eqSet.has(index)) {
        let eMark = document.createElement('div');
        eMark.className = 'e-mark';
        eMark.innerText = 'E';
        div.appendChild(eMark);
      } else if (cmpInfo.isBetter) {
        let upMark = document.createElement('div');
        upMark.className = 'upgrade-mark';
        upMark.style.left = '2px';
        upMark.style.right = 'auto';
        upMark.innerText = '▲';
        div.appendChild(upMark);
      }
      if (isMyClassBook) {
        const bBadge = document.createElement('div');
        bBadge.className = `book-status-badge ${isBookLearned ? 'learned' : 'learnable'}`;
        bBadge.innerText = isBookLearned ? '습득' : '미습득';
        div.appendChild(bBadge);
      }
      if (itemPlus > 0) {
        let pMark = document.createElement('div');
        pMark.style.cssText = 'position:absolute; top:1px; right:2px; font-size:8.5px; font-weight:bold; color:#fde047; background:rgba(0,0,0,0.8); padding:0 2px; border-radius:2px; pointer-events:none;';
        pMark.innerText = `+${itemPlus}`;
        div.appendChild(pMark);
      }
      if (item.qty > 1) {
        let qtyMark = document.createElement('div');
        qtyMark.className = 'qty';
        qtyMark.innerText = item.qty;
        div.appendChild(qtyMark);
      }
      div.draggable = true;
      div.ondragstart = (e) => {
        if (document.getElementById('multi-select-toggle')?.checked) {
          e.preventDefault();
          return;
        }
        e.dataTransfer.setData("type", "item");
        e.dataTransfer.setData("itemType", item.type);
      };
      setupTouchDragSource(div, () => ({ type: 'item', itemType: item.type, html: window.getItemIconHTML(item.type) }));

      div.addEventListener('pointerup', () => {
        if (Date.now() - (window._lastInvTouchDragEndTime || 0) < 140) return;
        const now = Date.now();
        const dt = now - lastTap;
        if (lastTapIndex === index && dt < 65) return;
        const isMulti = document.getElementById('multi-select-toggle')?.checked || false;
        if (!isMulti && !enchantScrollType && lastTapIndex === index && dt >= 65 && dt < 290) {
          lastTap = 0;
          lastTapIndex = -1;
          handleDoubleTap(index);
        } else {
          lastTap = now;
          lastTapIndex = index;
          handleSingleTap(index);
        }
      });
    } else {
      div.className = cls;
    }
    frag.appendChild(div);
  });
  grid.appendChild(frag);
}

window.consumeInventoryItem = consumeInventoryItem;
function consumeInventoryItem(index, isAutoTrigger = false) {
  if (!isAutoTrigger && window.isTradeLockedOrActive?.()) return false;
  let item = player.inventory[index];
  if (!item) return false;

  // 마법서 / 기술서(BOOK_*) 더블클릭 습득 처리
  if (item.type.startsWith('BOOK_')) {
    const bookDef = window.itemDict[item.type];
    if (!bookDef) return false;
    if (!player.learnedSkills) window.initDefaultLearnedSkills(player.class);

    if (bookDef.reqClass && bookDef.reqClass !== player.class) {
      window.addChat(`⚠️ [클래스 제한] '${bookDef.name}'은(는) [${bookDef.reqClassLabel}] 전용 비전서입니다!`, 'log-hit');
      return false;
    }
    if (player.learnedSkills.has(bookDef.skillId)) {
      window.addChat(`ℹ️ [이미 습득함] '${bookDef.skillName}' 스킬은 이미 습득한 상태입니다.`, 'log-sys');
      return false;
    }

    player.learnedSkills.add(bookDef.skillId);
    item.qty--;
    if (item.qty <= 0) player.inventory[index] = null;

    activeEffects.push({ type: 'buff', x: player.x, y: player.y, life: 35, maxLife: 35, skillName: '인챈트 스탯' });
    floatingTexts.push({ x: player.x, y: player.y - 55, text: `📘 ${bookDef.skillName} 습득!`, color: 0xfacc15, life: 45 });
    window.broadcastMultiplayerActionFx?.('ally_buff', { x: Math.round(player.x), y: Math.round(player.y), skillName: bookDef.skillName });
    window.addChat(`🎉 [비전서 습득 성공!] '${bookDef.skillName} (${bookDef.circle}서클)' 기술을 완벽히 터득했습니다! (스킬북에서 슬롯 장착 가능)`, 'log-kill');
    window.triggerAutoSave?.('book_learn', true);

    recalcMaxHpMp(true);
    updateStatusHUD();
    if (!document.getElementById('inventory-ui').classList.contains('hidden')) renderInventory();
    if (!document.getElementById('skill-ui').classList.contains('hidden')) window.renderSkills(currentSkillTab);
    return true;
  }

  if (item.type === 'S_RE01') {
    const sDef = window.itemDict['S_RE01'] || {};
    const reCoolMs = (typeof sDef.cool === 'number' ? sDef.cool : 2) * 1000;
    const nowRe = Date.now();
    if (window.lastReturnScrollTime && nowRe - window.lastReturnScrollTime < reCoolMs) {
      const rem = ((reCoolMs - (nowRe - window.lastReturnScrollTime)) / 1000).toFixed(1);
      window.addChat(`⏳ [쿨타임] 귀환 주문서는 ${rem}초 후에 다시 사용할 수 있습니다.`, 'log-hit');
      return false;
    }
    window.lastReturnScrollTime = nowRe;
    item.qty--;
    if (item.qty <= 0) player.inventory[index] = null;
    useReturnScroll();
    renderHotbarSlots();
    if (!document.getElementById('inventory-ui').classList.contains('hidden')) renderInventory();
    window.triggerAutoSave?.('use_return_scroll', true);
    return true;
  }

  if (item.type === 'S_WE01' || item.type === 'S_AR01') {
    enchantScrollType = { scrollIdx: index, type: item.type };
    selectedInvIndices.clear();
    document.getElementById('enchant-indicator')?.classList.remove('hidden');
    window.addChat(`✨ [인챈트 대기] 강화할 ${item.type === 'S_WE01' ? '무기(+6까지 100% 안전)' : '방어구·장신구(+4까지 100% 안전)'}를 가방에서 터치하세요!`, 'log-sys');
    return true;
  }

  let iData = window.itemDict[item.type];
  if (!iData) return false;

  if (['한손검', '양손활', '양손지팡이', '방패', '투구', '갑옷', '장갑', '망토', '신발', '반지', '목걸이', '귀걸이', '티셔츠', '벨트'].some(t => iData.type.includes(t))) {
    window.migrateAndNormalizeEquip(player.equip, player.inventory);
    const isCurrentlyEquipped = Object.keys(player.equip).some(k => player.equip[k] !== null && Number(player.equip[k]) === index);
    if (isCurrentlyEquipped) {
      Object.keys(player.equip).forEach(k => { if (player.equip[k] !== null && Number(player.equip[k]) === index) player.equip[k] = null; });
      SoundSystem.playUiClick?.();
      window.addChat(`🛡️ [장비 해제] '${iData.name}' 장착을 해제했습니다.`, 'log-sys');
    } else {
      const isSword = iData.type.includes('검');
      const isBow = iData.type.includes('활');
      const isStaff = iData.type.includes('지팡이');
      const isShield = iData.type.includes('방패');

      if (isSword || isBow || isStaff || isShield) {
        if (player.class === 'knight' && (isBow || isStaff)) {
          window.addChat(`⚠️ [장착 불가] 인간전사는 검과 방패만 장착할 수 있습니다!`, 'log-hit');
          return false;
        }
        if (player.class === 'ranger' && !isBow) {
          window.addChat(`⚠️ [장착 불가] 엘프궁수는 전용 무기인 '활'만 장착할 수 있습니다!`, 'log-hit');
          return false;
        }
        if (player.class === 'wizard' && !isStaff) {
          window.addChat(`⚠️ [장착 불가] 엘프마법사는 전용 무기인 '지팡이'만 장착할 수 있습니다!`, 'log-hit');
          return false;
        }
      }

      const slotName = resolveEquipSlotKey(iData, player.equip);
      player.equip[slotName] = index;
      SoundSystem.playUiClick?.();
      const slotKor = EQUIP_SLOT_LABELS[slotName] || slotName;
      const plusTxt = item.plus > 0 ? `+${item.plus} ` : '';
      window.addChat(`⚔️ [장비 장착] '${plusTxt}${iData.name}'을(를) [${slotKor}] 슬롯에 장착했습니다!`, 'log-kill');
    }
    recalcMaxHpMp(false);
    if (!document.getElementById('equip-ui').classList.contains('hidden')) renderEquipUI();
    updateStatusHUD();
    renderInventory();
    handleSingleTap(index);
  }
  else if (item.type.includes('C_P') || iData.type === '물약' || iData.type === '버프물약') {
    const now = Date.now();
    const itemCoolSec = typeof iData.cool === 'number' ? iData.cool : 0.5;
    const hpCoolMs = itemCoolSec * 1000;
    const mpCoolMs = itemCoolSec * 1000;

    if (iData.healHp) {
      if (now - lastHpPotionTime < hpCoolMs) {
        if (!isAutoTrigger) {
          const remain = ((hpCoolMs - (now - lastHpPotionTime)) / 1000).toFixed(1);
          window.addChat(`⏳ [쿨타임] ${iData.name}은(는) ${remain}초 후에 다시 사용할 수 있습니다.`, 'log-hit');
        }
        return false;
      }
      lastHpPotionTime = now;
      const hpPctBonus = item.type === 'C_P02' ? Math.floor((player.maxHp || 300) * 0.14) : Math.floor((player.maxHp || 300) * 0.08);
      const totalHealHp = iData.healHp + hpPctBonus;
      player.hp = Math.min(player.maxHp, player.hp + totalHealHp);
      floatingTexts.push({ x: player.x, y: player.y - 45, text: `+${totalHealHp} HP`, color: 0x4ade80, life: 30 });
      activeEffects.push({ type: 'potion', subType: 'hp', x: player.x, y: player.y, targetRef: player, life: 32, maxLife: 32, skillName: iData.name || '체력 물약' });
      window.broadcastMultiplayerActionFx?.('potion', { subType: 'hp', x: Math.round(player.x), y: Math.round(player.y), amount: totalHealHp, skillName: iData.name || '체력 물약' });
    }

    if (iData.healMp) {
      if (now - lastMpPotionTime < mpCoolMs) {
        if (!isAutoTrigger) {
          const remain = ((mpCoolMs - (now - lastMpPotionTime)) / 1000).toFixed(1);
          window.addChat(`⏳ [쿨타임] ${iData.name}은(는) ${remain}초 후에 다시 사용할 수 있습니다.`, 'log-hit');
        }
        return false;
      }
      lastMpPotionTime = now;
      const mpPctBonus = item.type === 'C_P04' ? Math.floor((player.maxMp || 150) * 0.14) : Math.floor((player.maxMp || 150) * 0.08);
      const totalHealMp = iData.healMp + mpPctBonus;
      player.mp = Math.min(player.maxMp, player.mp + totalHealMp);
      floatingTexts.push({ x: player.x, y: player.y - 45, text: `+${totalHealMp} MP`, color: 0x60a5fa, life: 30 });
      activeEffects.push({ type: 'potion', subType: 'mp', x: player.x, y: player.y, targetRef: player, life: 32, maxLife: 32, skillName: iData.name || '마나 물약' });
      window.broadcastMultiplayerActionFx?.('potion', { subType: 'mp', x: Math.round(player.x), y: Math.round(player.y), amount: totalHealMp, skillName: iData.name || '마나 물약' });
    }

    if (item.type === 'C_P05' || iData.type === '버프물약') {
      const durSec = iData.dur || 600;
      player.activeBuffs.ELIXIR = Math.min(3600000, Math.max(0, player.activeBuffs.ELIXIR || 0) + durSec * 1000);
      activeEffects.push({ type: 'potion', subType: 'elixir', x: player.x, y: player.y, targetRef: player, life: 36, maxLife: 36, skillName: iData.name || '용사의 비약' });
      window.broadcastMultiplayerActionFx?.('potion', { subType: 'elixir', x: Math.round(player.x), y: Math.round(player.y), skillName: iData.name || '용사의 비약' });
      window.addChat(`🍷 [버프 물약] ${iData.name} 효과가 ${Math.round(durSec / 60)}분간 지속됩니다!`, 'log-sys');
      window.updateBuffUI();
    }

    item.qty--;
    if (item.qty <= 0) player.inventory[index] = null;
    updateStatusHUD();
    renderHotbarSlots();
  }

  if (!document.getElementById('inventory-ui').classList.contains('hidden')) renderInventory();
  return true;
}

function handleDoubleTap(index) {
  if (enchantScrollType) return;
  consumeInventoryItem(index, false);
}

function useReturnScroll() {
  window.clearTarget();
  disableAutoAttack(`🏡 [안전지대 귀환] 자동사냥이 해제되었습니다.`);
  player.isMoving = false;
  player.isWalking = false;
  player.manualMoving = false;
  player.path = [];
  activeEffects.push({ type: 'buff', x: player.x, y: player.y, life: 35, maxLife: 35 });

  if (currentMapKey.endsWith('_dungeon')) {
    const destMapKey = `${currentRegionKey}_sub1`;
    const destData = HardcodedMapDB[destMapKey];
    window.addChat(`📜 [귀환 주문서] 던전을 탈출하여 ${destData ? destData.title : '마을/야영지'} 안전지대로 귀환합니다!`, 'log-sys');
    loadMapData(destMapKey, destData ? destData.spawn : { x: 2000, y: 14250 });
  } else {
    const destMapKey = `${currentRegionKey}_sub1`;
    const destData = HardcodedMapDB[destMapKey];
    if (currentMapKey !== destMapKey) {
      loadMapData(destMapKey);
    } else if (destData) {
      const safePos = findSafeSpot(destData.spawn.x, destData.spawn.y);
      player.x = safePos.x;
      player.y = safePos.y;
      player.targetX = safePos.x;
      player.targetY = safePos.y;
      window.broadcastMultiplayerActionFx?.('teleport', { x: Math.round(player.x), y: Math.round(player.y), skillName: '귀환 주문서' });
      if (mercenary.hired && !mercenary.isDead) {
        mercenary.x = player.x - 45;
        mercenary.y = player.y + 28;
        mercenary.targetMonster = null;
      }
    }
    window.addChat(`📜 [귀환 주문서] 마을(S)/야영지(S1) 정중앙 안전지대로 귀환했습니다!`, 'log-sys');
  }
}

// 장비 개별 인챈트 실행 (무기 +6 안전 / 방어구·악세사리 +4 안전 / 초과 시 확률 성공 또는 -1 차감)
function executeEnchant(targetIdx) {
  if (window.isTradeLockedOrActive?.()) return;
  const scrollInfo = enchantScrollType;
  enchantScrollType = null;
  document.getElementById('enchant-indicator')?.classList.add('hidden');
  if (!scrollInfo) return;

  let targetItem = player.inventory[targetIdx];
  let scrollItem = player.inventory[scrollInfo.scrollIdx];
  if (!targetItem || !scrollItem) return;

  let iData = window.itemDict[targetItem.type];
  if (!iData) return;

  const isWeapon = iData.type.includes('검') || iData.type.includes('활') || iData.type.includes('지팡이');
  const isArmorOrAcc = ['갑옷', '방패', '투구', '장갑', '신발', '망토', '벨트', '티셔츠', '목걸이', '귀걸이', '반지'].some(t => iData.type.includes(t));

  if ((scrollInfo.type === 'S_WE01' && !isWeapon) || (scrollInfo.type === 'S_AR01' && !isArmorOrAcc)) {
    window.addChat(`⚠️ [인챈트 취소] 주문서 종류와 대상 장비가 일치하지 않습니다. (무기주문서=무기 / 갑옷주문서=방어구·장신구)`, 'log-hit');
    return;
  }

  const safeLimit = isWeapon ? 6 : 4;
  const curPlus = getItemPlusValue(targetItem, isWeapon ? 'weapon' : 'armor', 'player');
  const successRate = getEnchantSuccessChance(curPlus, safeLimit);

  // 주문서 1장 소모
  scrollItem.qty--;
  if (scrollItem.qty <= 0) player.inventory[scrollInfo.scrollIdx] = null;

  const roll = Math.random() * 100;
  if (roll < successRate) {
    targetItem.plus = curPlus + 1;
    activeEffects.push({ type: 'buff', x: player.x, y: player.y, life: 28, maxLife: 28 });
    floatingTexts.push({ x: player.x, y: player.y - 52, text: `✨ 강화 성공! (+${targetItem.plus})`, color: 0xfacc15, life: 40 });
    window.broadcastMultiplayerActionFx?.('enchant', { success: true, plus: targetItem.plus, x: Math.round(player.x), y: Math.round(player.y) });
    window.addChat(`✨ [인챈트 성공!] '${iData.name}' 강화 수치가 +${targetItem.plus}(으)로 상승했습니다! (성공확률 ${successRate}%)`, 'log-kill');
  } else {
    targetItem.plus = Math.max(0, curPlus - 1);
    floatingTexts.push({ x: player.x, y: player.y - 52, text: `💔 강화 실패 (-1 -> +${targetItem.plus})`, color: 0xf87171, life: 40 });
    window.broadcastMultiplayerActionFx?.('enchant', { success: false, plus: targetItem.plus, x: Math.round(player.x), y: Math.round(player.y) });
    window.addChat(`💔 [인챈트 실패] 안전 구간(+${safeLimit}) 초과 강화에 실패하여 '${iData.name}' 수치가 +${curPlus} -> +${targetItem.plus}(으)로 -1 감소했습니다. (확률 ${successRate}%)`, 'log-hit');
  }

  recalcMaxHpMp(false);
  if (!document.getElementById('equip-ui').classList.contains('hidden')) renderEquipUI();
  updateStatusHUD();
  renderHotbarSlots();
  renderInventory();
  handleSingleTap(targetIdx);
  window.triggerAutoSave?.('enchant', true);
}

// 💰 단일 선택 판매 시 화면 암전(배경 어두워짐) 없이 수량을 물어보고 판매하는 플로팅 수량 선택창
window.openSellQuantityPopup = function(invIdx) {
  if (window.isTradeLockedOrActive?.()) return;
  const idx = Number(invIdx);
  const inst = player.inventory[idx];
  if (!inst) return;
  const eqSet = new Set(Object.values(player.equip).filter(v => v !== null && v !== undefined).map(Number));
  if (eqSet.has(idx)) {
    window.addChat(`⚠️ 장착 중인 장비는 먼저 해제한 뒤 판매할 수 있습니다.`, 'log-hit');
    return;
  }
  const def = window.itemDict[inst.type] || { name: inst.type };
  const maxQty = Math.max(1, Number(inst.qty) || 1);
  const basePrice = (def?.price && def.price > 0) ? def.price : (def?.questOnly ? 1800 : 100);
  const unitSell = Math.max(25, Math.floor(basePrice * 0.35 * (inst.mult || 1)));

  let pop = document.getElementById('sell-qty-floating-popup');
  if (!pop) {
    pop = document.createElement('div');
    pop.id = 'sell-qty-floating-popup';
    // 🌟 배경 암전(dimming backdrop)을 일절 사용하지 않는 독립 플로팅 팝업!
    pop.style.cssText = 'position:fixed; top:50%; left:50%; transform:translate(-50%, -50%); z-index:9750; width:min(88vw, 295px); background:#111827; border:2px solid #facc15; border-radius:10px; padding:12px; box-shadow:0 6px 20px rgba(0,0,0,0.65); color:#f9fafb; pointer-events:auto;';
    document.body.appendChild(pop);
  }

  pop.dataset.invIdx = String(idx);
  pop.dataset.unitSell = String(unitSell);
  pop.dataset.maxQty = String(maxQty);

  const itemPlus = getItemPlusValue(inst, null, 'player');
  const plusTxt = itemPlus > 0 ? `+${itemPlus} ` : '';

  pop.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #374151; padding-bottom:6px; margin-bottom:8px;">
      <span style="font-size:12.5px; font-weight:bold; color:#fde047;">💰 아이템 판매 ${maxQty > 1 ? '수량 선택' : '확인'}</span>
      <button type="button" onclick="closeSellQuantityPopup()" style="background:none; border:none; color:#9ca3af; font-size:14px; cursor:pointer; padding:0 4px;">✖</button>
    </div>
    <div style="display:flex; align-items:center; gap:8px; background:#1f2937; border:1px solid #374151; border-radius:7px; padding:7px 9px; margin-bottom:8px;">
      <div style="flex-shrink:0;">${window.getItemIconHTML ? window.getItemIconHTML(inst.type) : '📦'}</div>
      <div style="min-width:0; flex:1;">
        <div style="font-size:12px; font-weight:bold; color:${inst.gradeColor || '#fff'}; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${plusTxt}${def.name}</div>
        <div style="font-size:10.5px; color:#93c5fd;">보유 수량: <b>${maxQty}개</b> · 개당 <b>${unitSell.toLocaleString()} G</b></div>
      </div>
    </div>
    ${maxQty > 1 ? `
    <div style="display:flex; flex-direction:column; gap:6px; margin-bottom:9px;">
      <div style="display:flex; align-items:center; justify-content:space-between; gap:4px;">
        <button type="button" class="auth-sub-btn" style="padding:5px 7px; font-size:11px;" onclick="adjustSellQtyInput(-10)">-10</button>
        <button type="button" class="auth-sub-btn" style="padding:5px 8px; font-size:11px;" onclick="adjustSellQtyInput(-1)">-1</button>
        <input id="sell-qty-number-input" type="number" min="1" max="${maxQty}" value="${maxQty}" oninput="onSellQtyInputChange(this.value)" style="width:68px; text-align:center; background:#090b10; color:#fde047; border:1.5px solid #6b5535; border-radius:6px; padding:5px 4px; font-size:13px; font-weight:bold;">
        <button type="button" class="auth-sub-btn" style="padding:5px 8px; font-size:11px;" onclick="adjustSellQtyInput(1)">+1</button>
        <button type="button" class="auth-sub-btn" style="padding:5px 7px; font-size:11px;" onclick="adjustSellQtyInput(10)">+10</button>
        <button type="button" class="shop-buy-btn" style="padding:5px 7px; font-size:10.5px; background:#b45309; border-color:#facc15;" onclick="adjustSellQtyInput(999999)">최대</button>
      </div>
      <input id="sell-qty-range-input" type="range" min="1" max="${maxQty}" value="${maxQty}" oninput="onSellQtyInputChange(this.value)" style="width:100%; accent-color:#facc15; cursor:pointer; margin:0;">
    </div>
    ` : `<input id="sell-qty-number-input" type="hidden" value="1">`}
    <div style="display:flex; justify-content:space-between; align-items:center; background:#090b10; border:1px solid #4b5563; border-radius:6px; padding:6px 9px; margin-bottom:9px; font-size:11.5px;">
      <span style="color:#d1d5db;">판매 획득 골드</span>
      <b id="sell-qty-total-gold" style="color:#fde047; font-size:13px;">💰 ${(unitSell * maxQty).toLocaleString()} G</b>
    </div>
    <div style="display:flex; gap:6px;">
      <button type="button" class="auth-sub-btn" style="flex:1; padding:7px;" onclick="closeSellQuantityPopup()">취소</button>
      <button type="button" class="auth-primary-btn" style="flex:1.2; padding:7px; background:linear-gradient(180deg, #ca8a04, #854d0e); border-color:#fde047;" onclick="confirmSellSingleItemWithQty()">💰 판매하기</button>
    </div>
  `;
  pop.style.display = 'block';
};

window.closeSellQuantityPopup = function() {
  const pop = document.getElementById('sell-qty-floating-popup');
  if (pop) pop.style.display = 'none';
};

window.onSellQtyInputChange = function(rawVal) {
  const pop = document.getElementById('sell-qty-floating-popup');
  if (!pop) return;
  const maxQty = Math.max(1, Number(pop.dataset.maxQty) || 1);
  const unitSell = Math.max(1, Number(pop.dataset.unitSell) || 25);
  const clamped = Math.max(1, Math.min(maxQty, parseInt(rawVal, 10) || 1));
  const numEl = document.getElementById('sell-qty-number-input');
  const rngEl = document.getElementById('sell-qty-range-input');
  const goldEl = document.getElementById('sell-qty-total-gold');
  if (numEl && Number(numEl.value) !== clamped) numEl.value = clamped;
  if (rngEl && Number(rngEl.value) !== clamped) rngEl.value = clamped;
  if (goldEl) goldEl.innerText = `💰 ${(unitSell * clamped).toLocaleString()} G`;
};

window.adjustSellQtyInput = function(delta) {
  const pop = document.getElementById('sell-qty-floating-popup');
  if (!pop) return;
  const maxQty = Math.max(1, Number(pop.dataset.maxQty) || 1);
  const numEl = document.getElementById('sell-qty-number-input');
  const cur = parseInt(numEl?.value, 10) || maxQty;
  const next = delta >= 99999 ? maxQty : Math.max(1, Math.min(maxQty, cur + delta));
  if (numEl) numEl.value = next;
  window.onSellQtyInputChange(next);
};

window.confirmSellSingleItemWithQty = function() {
  if (window.isTradeLockedOrActive?.()) { window.closeSellQuantityPopup?.(); return; }
  const pop = document.getElementById('sell-qty-floating-popup');
  if (!pop) return;
  const idx = Number(pop.dataset.invIdx);
  const inst = player.inventory[idx];
  if (!inst) {
    window.closeSellQuantityPopup();
    return;
  }
  const eqSet = new Set(Object.values(player.equip).filter(v => v !== null && v !== undefined).map(Number));
  if (eqSet.has(idx)) {
    window.closeSellQuantityPopup();
    return;
  }
  const def = window.itemDict[inst.type] || { name: inst.type };
  const curQty = Math.max(1, Number(inst.qty) || 1);
  const numEl = document.getElementById('sell-qty-number-input');
  const sellQty = Math.max(1, Math.min(curQty, parseInt(numEl?.value, 10) || curQty));
  const basePrice = (def?.price && def.price > 0) ? def.price : (def?.questOnly ? 1800 : 100);
  const unitSell = Math.max(25, Math.floor(basePrice * 0.35 * (inst.mult || 1)));
  const earnedGold = unitSell * sellQty;

  if (sellQty >= curQty) {
    player.inventory[idx] = null;
    selectedInvIndices.delete(idx);
  } else {
    inst.qty = curQty - sellQty;
  }

  player.gold += earnedGold;
  window.closeSellQuantityPopup();
  window.addChat(`💰 [아이템 판매] '${def.name}' x${sellQty}개를 판매하여 ${earnedGold.toLocaleString()} G를 획득했습니다.`, 'log-sys');
  window.triggerAutoSave?.('shop_sell', true);
  updateStatusHUD();
  renderHotbarSlots();
  renderInventory();
  const detailBox = document.getElementById('item-detail');
  if (detailBox) {
    if (player.inventory[idx]) {
      detailBox.innerHTML = window.buildConciseItemDetailHTML(player.inventory[idx], idx, 'inventory');
    } else {
      detailBox.innerHTML = `<span style="color:#9ca3af;">아이템을 터치하면 상세 정보가 표시됩니다.</span>`;
    }
  }
};

window.invAction = function(actionType) {
  if (window.isTradeLockedOrActive?.()) return;
  if (selectedInvIndices.size === 0) return;
  const eqSet = new Set(Object.values(player.equip).filter(v => v !== null && v !== undefined).map(Number));
  const isMultiChecked = Boolean(document.getElementById('multi-select-toggle')?.checked);

  // 🌟 단일 선택 상태에서 판매('sell')를 누르면 암전 없는 수량 선택/확인 팝업을 띄워 물어보고 판매!
  if (actionType === 'sell' && !isMultiChecked && selectedInvIndices.size === 1) {
    const onlyIdx = Array.from(selectedInvIndices)[0];
    if (player.inventory[onlyIdx]) {
      window.openSellQuantityPopup(onlyIdx);
      return;
    }
  }

  // 🌟 다중선택(Multi-select) 시 한 상품에 여러 개 수량이 겹쳐 있어도 선택한 모든 슬롯의 전체 수량을 한 번에 일괄 판매!
  let soldGold = 0;
  let soldItemStacks = 0;
  let soldTotalUnits = 0;

  selectedInvIndices.forEach(idx => {
    const inst = player.inventory[idx];
    if (!inst || eqSet.has(Number(idx))) return;
    const def = window.itemDict[inst.type];
    const itemQty = Math.max(1, Number(inst.qty) || 1);

    if (actionType === 'sell') {
      const basePrice = (def?.price && def.price > 0) ? def.price : (def?.questOnly ? 1800 : 100);
      const unitSell = Math.max(25, Math.floor(basePrice * 0.35 * (inst.mult || 1)));
      soldGold += unitSell * itemQty;
      soldItemStacks++;
      soldTotalUnits += itemQty;
    } else if (actionType === 'drop') {
      if (isServerAuthoritativeMode()) {
        sendCentralWsPacket({
          type: 'DROP_ITEM_TO_GROUND',
          charId: activeCharacterId,
          mapKey: currentMapKey,
          x: Math.round(player.x + (Math.random() * 40 - 20)),
          y: Math.round(player.y + (Math.random() * 40 - 20)),
          item: inst
        });
      } else {
        spawnDroppedItemSafe(inst, player.x + (Math.random() * 40 - 20), player.y + (Math.random() * 40 - 20));
      }
    }
    player.inventory[idx] = null;
  });

  if (actionType === 'sell' && soldGold > 0) {
    player.gold += soldGold;
    window.addChat(`💰 [다중 일괄 판매] 선택한 ${soldItemStacks}슬롯(총 ${soldTotalUnits}개) 아이템을 한 번에 처분하여 ${soldGold.toLocaleString()} G를 획득했습니다!`, 'log-sys');
    window.triggerAutoSave?.('shop_sell', true);
  }
  selectedInvIndices.clear();
  updateStatusHUD();
  renderHotbarSlots();
  renderInventory();
};

window.quickSellSingleItem = function(idx) {
  if (window.isTradeLockedOrActive?.()) return;
  if (window.isUiTouchDebounced?.('quickSellSingleItem', 240)) return;
  const inst = player.inventory[idx];
  if (!inst) return;
  const eqSet = new Set(Object.values(player.equip).filter(v => v !== null && v !== undefined).map(Number));
  if (eqSet.has(Number(idx))) {
    window.addChat(`⚠️ 장착 중인 장비는 해제 후 판매할 수 있습니다.`, 'log-hit');
    return;
  }
  const isMultiChecked = Boolean(document.getElementById('multi-select-toggle')?.checked);
  if (isMultiChecked && selectedInvIndices.size > 1) {
    window.invAction('sell');
    return;
  }
  window.openSellQuantityPopup(Number(idx));
};

// ============================================================================
// 🧹 가방(인벤토리) 고정 규칙 정렬 시스템
// - 1순위(맨 앞 고정): 각종 물약 (체력 물약 C_P01·C_P02 -> 마나 물약 C_P03·C_P04 -> 버프 물약 C_P05)
// - 2순위(그다음): 착장 아이템들 (현재 장착 중인 14부위 장비 -> 미장착 장비 부위·등급·강화순)
// - 3순위(나머지 종류별 정렬): 주문서(귀환·무기·갑옷) -> 마법서·비급서(서클순) -> 퀘스트·기타 아이템
// ============================================================================
function getEquipTypeSortOrder(def) {
  if (!def || !def.type) return 99;
  const t = def.type;
  if (t.includes('검') || t.includes('활') || t.includes('지팡이')) return 1;
  if (t.includes('방패')) return 2;
  if (t.includes('투구')) return 3;
  if (t.includes('티셔츠')) return 4;
  if (t.includes('갑옷')) return 5;
  if (t.includes('망토')) return 6;
  if (t.includes('장갑')) return 7;
  if (t.includes('벨트')) return 8;
  if (t.includes('신발')) return 9;
  if (t.includes('목걸이')) return 10;
  if (t.includes('귀걸이')) return 11;
  if (t.includes('반지')) return 12;
  return 50;
}

function getInventoryItemSortRank(inst, equippedSlotIndexMap) {
  const id = inst.type || '';
  const def = window.itemDict?.[id] || {};
  const t = def.type || '';
  const isEquip = ['한손검', '양손활', '양손지팡이', '방패', '투구', '갑옷', '장갑', '망토', '신발', '반지', '목걸이', '귀걸이', '티셔츠', '벨트'].some(k => t.includes(k));

  // 1순위: 각종 물약 (체력 -> 마나 -> 버프 물약 순으로 맨 앞 고정!)
  if (id.startsWith('C_P') || t.includes('물약')) {
    let subRank = 190;
    if (id === 'C_P01') subRank = 101;      // 하급 체력 물약
    else if (id === 'C_P02') subRank = 102; // 상급 체력 물약
    else if (def.healHp && !def.healMp) subRank = 105;
    else if (id === 'C_P03') subRank = 111; // 하급 마나 물약
    else if (id === 'C_P04') subRank = 112; // 상급 마나 물약
    else if (def.healMp) subRank = 115;
    else if (id === 'C_P05' || t.includes('버프물약')) subRank = 121; // 용사의 비약 (버프 물약)
    return { group: 1, sub: subRank, grade: -(inst.gradeIdx || 0), plus: 0, id };
  }

  // 2순위-A: 현재 착용 중인 착장 아이템들 (슬롯 순서대로 배치)
  if (equippedSlotIndexMap.has(inst)) {
    return {
      group: 2,
      sub: equippedSlotIndexMap.get(inst),
      grade: -(inst.gradeIdx || 0),
      plus: -(inst.plus || 0),
      id
    };
  }

  // 2순위-B: 가방 내 미착용 착장 아이템들 (부위별 -> 고등급 -> 고강화 순)
  if (isEquip) {
    return {
      group: 3,
      sub: getEquipTypeSortOrder(def),
      grade: -(inst.gradeIdx || 0),
      plus: -(inst.plus || 0),
      id
    };
  }

  // 3순위-A: 각종 주문서 (귀환 주문서 -> 무기 마법 주문서 -> 갑옷 마법 주문서)
  if (id.startsWith('S_') || t.includes('주문서')) {
    const sOrder = id === 'S_RE01' ? 1 : (id === 'S_WE01' ? 2 : (id === 'S_AR01' ? 3 : 9));
    return { group: 4, sub: sOrder, grade: 0, plus: 0, id };
  }

  // 3순위-B: 마법서 및 기술 비급서 (내 클래스 우선 -> 서클순)
  if (id.startsWith('BOOK_') || t.includes('마법서')) {
    const clsOrder = def.reqClass === player?.class ? 0 : 10;
    return { group: 5, sub: clsOrder + (def.circle || 1), grade: -(inst.gradeIdx || 0), plus: 0, id };
  }

  // 3순위-C: 퀘스트 및 기타 아이템
  return { group: 6, sub: 1, grade: -(inst.gradeIdx || 0), plus: 0, id };
}

function sortInventoryArrayWithEquip(invArray, equipObj) {
  window.migrateAndNormalizeEquip(equipObj, invArray);

  // 1) 현재 장착 중인 아이템 인스턴스와 슬롯 매핑 보존
  const instToSlots = new Map();
  const equippedOrderMap = new Map();
  const slotPriorityOrder = ['weapon', 'shield', 'helmet', 'tshirt', 'armor', 'cloak', 'gloves', 'belt', 'boots', 'necklace', 'earring1', 'earring2', 'ring1', 'ring2'];

  slotPriorityOrder.forEach((slotKey, sIdx) => {
    const eqIdx = equipObj[slotKey];
    if (eqIdx !== null && eqIdx !== undefined && invArray[eqIdx]) {
      const inst = invArray[eqIdx];
      if (!instToSlots.has(inst)) instToSlots.set(inst, []);
      instToSlots.get(inst).push(slotKey);
      if (!equippedOrderMap.has(inst)) equippedOrderMap.set(inst, sIdx + 1);
    }
  });

  // 2) 비장비 소모품/주문서/재료 중 분할된 동일 아이템 스택 합산
  const consolidated = [];
  const stackableMap = new Map();

  invArray.forEach(inst => {
    if (!inst) return;
    const def = window.itemDict?.[inst.type] || {};
    const isEquip = ['한손검', '양손활', '양손지팡이', '방패', '투구', '갑옷', '장갑', '망토', '신발', '반지', '목걸이', '귀걸이', '티셔츠', '벨트'].some(k => def.type?.includes(k));
    if (!isEquip && !instToSlots.has(inst)) {
      if (stackableMap.has(inst.type)) {
        stackableMap.get(inst.type).qty = (stackableMap.get(inst.type).qty || 1) + (inst.qty || 1);
      } else {
        stackableMap.set(inst.type, inst);
        consolidated.push(inst);
      }
    } else {
      consolidated.push(inst);
    }
  });

  // 3) 정렬 규칙(물약 고정 -> 착장장비 -> 나머지 종류별)에 따라 정렬
  consolidated.sort((a, b) => {
    const ra = getInventoryItemSortRank(a, equippedOrderMap);
    const rb = getInventoryItemSortRank(b, equippedOrderMap);
    if (ra.group !== rb.group) return ra.group - rb.group;
    if (ra.sub !== rb.sub) return ra.sub - rb.sub;
    if (ra.grade !== rb.grade) return ra.grade - rb.grade;
    if (ra.plus !== rb.plus) return ra.plus - rb.plus;
    return String(ra.id).localeCompare(String(rb.id));
  });

  // 4) 인벤토리 배열 재배치 및 장착 슬롯 인덱스 완벽 복원
  const totalLen = invArray.length;
  for (let i = 0; i < totalLen; i++) {
    invArray[i] = i < consolidated.length ? consolidated[i] : null;
  }

  ALL_EQUIP_SLOT_KEYS.forEach(k => { equipObj[k] = null; });
  for (let i = 0; i < consolidated.length; i++) {
    const inst = consolidated[i];
    if (instToSlots.has(inst)) {
      instToSlots.get(inst).forEach(slotKey => {
        equipObj[slotKey] = i;
      });
    }
  }
}

window.sortPlayerInventory = function(silent = false) {
  if (!silent && window.isTradeLockedOrActive?.()) return;
  enchantScrollType = null;
  document.getElementById('enchant-indicator')?.classList.add('hidden');
  selectedInvIndices.clear();

  sortInventoryArrayWithEquip(player.inventory, player.equip);

  if (!silent) {
    SoundSystem.playUiClick?.();
    window.addChat(`🧹 [가방 정렬 완료] 1순위 물약(체력·마나·버프 고정) → 2순위 착장장비 → 3순위 주문서·비전서·기타 순으로 정리되었습니다!`, 'log-sys');
  }
  recalcMaxHpMp(false);
  updateStatusHUD();
  renderHotbarSlots();
  if (!document.getElementById('inventory-ui')?.classList.contains('hidden')) renderInventory();
  if (!document.getElementById('equip-ui')?.classList.contains('hidden')) renderEquipUI();
};

window.sortMercInventory = function() {
  if (!mercenary.hired) return;
  window.mercEnchantScrollType = null;
  selectedMercInvIdx = null;
  sortInventoryArrayWithEquip(mercenary.inventory, mercenary.equip);
  SoundSystem.playUiClick?.();
  window.addChat(`🧹 [용병 가방 정렬] 물약 → 착용장비 → 보유장비 → 주문서 순으로 용병 가방을 정리했습니다!`, 'log-sys');
  syncMercStats(false);
  window.updateMercHUD();
  window.renderMercUI();
};


// 플레이어 인벤토리 아이템 지급 (착용 중인 아이템과 절대 병합하지 않으며, 모든 장비는 독립 슬롯으로 분리!)
function giveItem(type, qty = 1, forceGradeIdx = null, prebuiltInst = null) {
  const def = window.itemDict[type];
  const isEquip = def && ['한손검', '양손활', '양손지팡이', '방패', '투구', '갑옷', '장갑', '망토', '신발', '반지', '목걸이', '귀걸이', '티셔츠', '벨트'].some(t => def.type?.includes(t));
  const equippedSet = new Set(Object.values(player.equip || {}).filter(v => v !== null && v !== undefined).map(Number));

  if (!isEquip) {
    let existIdx = player.inventory.findIndex((i, idx) => i && i.type === type && !equippedSet.has(idx));
    if (existIdx > -1) {
      player.inventory[existIdx].qty += qty;
      renderHotbarSlots();
      return player.inventory[existIdx];
    }
    let emptyIdx = player.inventory.findIndex(i => i === null);
    if (emptyIdx > -1) {
      player.inventory[emptyIdx] = createItemInstance(type, qty, false);
      renderHotbarSlots();
      return player.inventory[emptyIdx];
    }
    return null;
  }

  // 장비 아이템은 착용 중인 동일 아이템이 있더라도 절대 합쳐지지 않고 독립된 빈 슬롯에 생성!
  let emptyIdx = player.inventory.findIndex(i => i === null);
  if (emptyIdx > -1) {
    const inst = prebuiltInst ? { ...prebuiltInst, qty: 1 } : createItemInstance(type, 1, false, forceGradeIdx);
    inst.uid = 'eq_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
    inst.plus = typeof inst.plus === 'number' ? inst.plus : 0;
    player.inventory[emptyIdx] = inst;
    renderHotbarSlots();
    return inst;
  }
  return null;
}

window.clearTarget = function(e) {
  if (e) { e.preventDefault(); e.stopPropagation(); }
  player.targetEntity = null;
  document.getElementById('top-target-ui').style.display = 'none';
};

function gainExp(amount) {
  player.maxExp = calcRequiredExpForLevel(player.level || 1);
  const safeAmt = Math.max(1, Math.floor(Number(amount) || 0));
  player.exp += safeAmt;
  let leveledUp = false;
  const clsBase = CLASS_STATS[player.class]?.fixedBaseStats || {};
  const statPerLv = clsBase.statPerLv ?? 3;
  const resetStepLv = clsBase.resetStepLv ?? 50;

  while (player.exp >= player.maxExp) {
    player.exp -= player.maxExp;
    player.level++;
    leveledUp = true;
    player.maxExp = calcRequiredExpForLevel(player.level);
    player.statPoints += statPerLv;
    recalcMaxHpMp(false);
    // 레벨업 시 무조건 100% 풀회복되면 물약 없이 레벨업만으로 무한 사냥이 가능해지므로 최대치의 35%만 보너스 회복
    player.hp = Math.min(player.maxHp, Math.ceil(player.hp + player.maxHp * 0.35));
    player.mp = Math.min(player.maxMp, Math.ceil(player.mp + player.maxMp * 0.35));
    floatingTexts.push({ x: player.x, y: player.y - 65, text: `🎉 LEVEL UP! (Lv.${player.level})`, color: 0x22c55e, life: 60 });
    window.addChat(`🎉 [레벨 업!] 축하합니다! Lv.${player.level} 달성! (스탯 포인트 +${statPerLv} 지급)`, 'log-kill');
    if (player.level % resetStepLv === 0) {
      window.addChat(`🔓 [스탯 초기화 해금] Lv.${player.level} 달성! 장비/스탯 창에서 '투자 스탯 초기화' 가능 횟수가 +1회 충전되었습니다!`, 'log-kill');
    }
  }
  if (leveledUp) {
    window.triggerAutoSave?.('level_up', true);
    window.broadcastMultiplayerActionFx?.('level_up', { level: player.level, x: Math.round(player.x), y: Math.round(player.y) });
  }

  if (mercenary.hired && !mercenary.isDead) {
    mercenary.exp += Math.floor(amount * 0.85);
    mercenary.maxExp = calcRequiredExpForLevel(mercenary.level || 1);
    while (mercenary.exp >= mercenary.maxExp) {
      mercenary.exp -= mercenary.maxExp;
      mercenary.level++;
      mercenary.maxExp = calcRequiredExpForLevel(mercenary.level);
      syncMercStats(false);
      mercenary.hp = Math.min(mercenary.maxHp, Math.ceil(mercenary.hp + mercenary.maxHp * 0.35));
      mercenary.mp = Math.min(mercenary.maxMp, Math.ceil(mercenary.mp + mercenary.maxMp * 0.35));
      const prevSkCnt = getMercUnlockedSkills(mercenary.class, mercenary.level - 1).length;
      const nowSkList = getMercUnlockedSkills(mercenary.class, mercenary.level);
      const newlyUnlocked = nowSkList.slice(prevSkCnt);
      floatingTexts.push({ x: mercenary.x, y: mercenary.y - 55, text: `🎉 용병 Lv.${mercenary.level}!`, color: 0x38bdf8, life: 55 });
      window.addChat(`⚔️ [용병 레벨업!] '${mercenary.name}' 용병이 Lv.${mercenary.level}(으)로 성장했습니다!${newlyUnlocked.length > 0 ? ` (🔓 신규 스킬 자동 해금: ${newlyUnlocked.map(s => s.name).join(', ')})` : ''}`, 'log-sys');
    }
    window.updateMercHUD();
  }

  if (!document.getElementById('equip-ui').classList.contains('hidden')) renderEquipUI();
  window.renderStatAllocModal?.();
  updateStatusHUD();
}

function getAttackInterval() {
  const cStats = calculateCombatStats(false);
  let interval = (cStats.weaponSpeedSec || 1.05) * 1000;
  const hasteSk = (GameDB.Skills.Mage || []).find(s => s.buffKey === 'HASTE');
  const furySk = (GameDB.Skills.Archer || []).find(s => s.buffKey === 'NATURES_FURY');
  const elixirDef = window.itemDict?.['C_P05'];

  if (player.activeBuffs.HASTE > 0) interval /= (1 + ((hasteSk?.atkSpeedPct ?? 30) / 100));
  if (player.activeBuffs.NATURES_FURY > 0) interval /= (1 + ((furySk?.atkSpeedPct ?? 30) / 100));
  if (player.activeBuffs.ELIXIR > 0) interval *= Math.max(0.5, 1 - ((elixirDef?.speedBoostPct ?? 8) / 100));
  return Math.max(300, Math.floor(interval));
}

function getPlayerAttackRange() {
  const baseRange = CLASS_STATS[player.class]?.attackRange ?? ((player.class === 'ranger' || player.class === 'wizard') ? 240 : 64);
  if (player.class === 'knight') return baseRange;
  // 궁수/마법사도 무기(활/지팡이)를 장착하지 않은 맨손 상태에서는 원거리 사격을 할 수 없어 근접 사거리(72px)로 제한!
  const hasWeapon = player.equip.weapon !== null && player.equip.weapon !== undefined && Boolean(player.inventory[player.equip.weapon]);
  if (!hasWeapon) return 72;
  const eagleSk = (GameDB.Skills.Archer || []).find(s => s.buffKey === 'EAGLE_EYE');
  return baseRange + (player.activeBuffs.EAGLE_EYE > 0 ? (eagleSk?.bonusRange ?? 55) : 0);
}

function findNearestAttackableMonster(maxDist = 850) {
  const now = Date.now();
  if (player.lastHitByMonster && !player.lastHitByMonster.isDead && (now - (player.lastHitByTime || 0) < 5000) && !isInsideSafeZone(player.lastHitByMonster.x, player.lastHitByMonster.y)) {
    return player.lastHitByMonster;
  }
  let nearest = null;
  let minDist = maxDist;
  monsterList.forEach(m => {
    if (m.isDead || isInsideSafeZone(m.x, m.y)) return;
    const d = Math.hypot(m.x - player.x, m.y - player.y);
    if (d < minDist) {
      minDist = d;
      nearest = m;
    }
  });
  return nearest;
}

window.handleBasicAttack = function() {
  // 🌟 수동 사냥 시 어택(ATK) 버튼 한 번 누르면 주위 가장 가까운 몬스터를 즉시 타겟팅하고 공격!
  if (!player.targetEntity || player.targetEntity.type !== 'MONSTER' || !player.targetEntity.ref || player.targetEntity.ref.isDead || isInsideSafeZone(player.targetEntity.ref.x, player.targetEntity.ref.y)) {
    const autoTarget = findNearestAttackableMonster(900);
    if (!autoTarget) {
      window.addChat(`⚠️ 주변에 공격할 수 있는 몬스터가 없습니다.`, 'log-hit');
      return;
    }
    player.targetEntity = { type: 'MONSTER', ref: autoTarget };
    updateTopTargetUI(autoTarget);
  }
  let mon = player.targetEntity.ref;
  let now = Date.now();
  if (now - player.lastAttackTime < getAttackInterval()) return;

  let isRanged = (player.class === 'ranger' || player.class === 'wizard');
  let atkRange = getPlayerAttackRange();
  let dist = Math.hypot(mon.x - player.x, mon.y - player.y);

  if (dist <= atkRange) {
    player.isMoving = false; player.isWalking = false; player.path = [];
    let dx = mon.x - player.x;
    let dy = mon.y - player.y;
    if (Math.abs(dx) > Math.abs(dy)) player.dir = dx > 0 ? 'right' : 'left';
    else player.dir = dy > 0 ? 'down' : 'up';

    player.lastAttackTime = now;
    player.lastCombatTime = now;
    PlayerSpriteManager.currentFrame = 0;
    SoundSystem.playBasicAttack(player.class);

    const cStats = calculateCombatStats(false);
    let baseAtk = player.class === 'wizard' ? cStats.totalMAtk * 0.78 : cStats.totalAtk * CLASS_STATS[player.class].atkMult;
    let dmg = Math.floor(baseAtk + player.level * 1.6 + Math.random() * 5);

    window.broadcastMultiplayerActionFx?.('basic_atk', {
      casterClass: player.class,
      isRanged,
      sx: Math.round(player.x),
      sy: Math.round(player.y),
      tx: Math.round(mon.x),
      ty: Math.round(mon.y),
      mobId: mon.id
    });
    if (isRanged) projectiles.push({ x: player.x, y: player.y - 15, lastTargetX: mon.x, lastTargetY: mon.y, target: mon, speed: 13, type: player.class === 'ranger' ? 'arrow' : 'magic', dmg: dmg, skillName: null, isAoe: false, opts: { attacker: 'player' } });
    else window.applyDamage(mon, dmg, 'melee', { attacker: 'player' });
  } else {
    player.path = window.findPath(player.x, player.y, mon.x, mon.y);
    player.isMoving = true; player.manualMoving = false;
  }
};



window.useSlot = function(num, isAutoTrigger = false) {
  if (!isAutoTrigger && window.selectedSkillForSlot) {
    assignToQuickSlot(num, { type: 'skill', name: window.selectedSkillForSlot.name });
    return true;
  }

  let slotData = window.skillSlots[num];
  if (!slotData) return false;

  if (slotData.type === 'item') {
    let invIdx = player.inventory.findIndex(i => i && i.type === slotData.itemType);
    if (invIdx > -1) {
      return consumeInventoryItem(invIdx, isAutoTrigger);
    } else if (!isAutoTrigger) {
      window.addChat(`[System] ${window.itemDict[slotData.itemType]?.name || slotData.itemType} 아이템이 가방에 없습니다.`, 'log-hit');
    }
    return false;
  }

  let sInfo = SKILLS_DB[player.class].find(s => s.name === slotData.name);
  if (!sInfo) return false;

  if (!isSkillLearned(sInfo)) {
    if (!isAutoTrigger) {
      window.addChat(`🔒 [미습득 스킬] '${sInfo.name}'은(는) 아직 배우지 않았습니다!`, 'log-hit');
    }
    return false;
  }

  const now = Date.now();
  const cStatsNow = calculateCombatStats(false);
  let coolMs = (sInfo.cool || 1) * 1000;
  if (cStatsNow.coolReducePct > 0) coolMs *= Math.max(0.55, 1 - cStatsNow.coolReducePct / 100);
  if (player.activeBuffs.ARCHMAGE > 0 && player.class === 'wizard') coolMs *= 0.5;

  if (skillCooldowns[sInfo.name] && now - skillCooldowns[sInfo.name] < coolMs) {
    if (!isAutoTrigger) {
      const remain = ((coolMs - (now - skillCooldowns[sInfo.name])) / 1000).toFixed(1);
      window.addChat(`⏳ [쿨타임] ${sInfo.name} 스킬은 ${remain}초 후에 사용할 수 있습니다.`, 'log-hit');
    }
    return false;
  }

  if (sInfo.reqShield && player.equip.shield === null) {
    if (!isAutoTrigger) window.addChat(`⚠️ [${sInfo.name}] 방패를 장착해야 사용할 수 있는 스킬입니다!`, 'log-hit');
    return false;
  }

  if (sInfo.hpCostPct) {
    const hpCost = Math.floor(player.maxHp * (sInfo.hpCostPct / 100));
    if (player.hp <= hpCost + 10) {
      if (!isAutoTrigger) window.addChat(`⚠️ [${sInfo.name}] 체력이 부족하여 발동할 수 없습니다.`, 'log-hit');
      return false;
    }
    player.hp -= hpCost;
  }

  const effMpCost = Math.max(1, Math.round((sInfo.mp || 0) * Math.max(0.7, 1 - (cStatsNow.mpCostReducePct || 0) / 100)));
  if ((sInfo.mp || 0) > 0 && player.mp < effMpCost) {
    if (!isAutoTrigger) window.addChat("[System] 마나가 부족합니다.", "log-hit");
    return false;
  }

  if (sInfo.name.includes("텔레포트")) {
    player.mp -= effMpCost;
    skillCooldowns[sInfo.name] = now;
    SoundSystem.playSkill(sInfo.name, player.class, sInfo.circle || 1, false);
// 비공격/이동 마법은 마법진 없이 부드러운 파티클만 표현
    const randAngle = Math.random() * Math.PI * 2;
    const dist = 260 + Math.random() * 220;
    const safePt = findSafeSpot(player.x + Math.cos(randAngle) * dist, player.y + Math.sin(randAngle) * dist);
    player.x = safePt.x;
    player.y = safePt.y;
    player.path = [];
    player.isMoving = false;
    if (sInfo.name.includes("매스") && mercenary.hired && !mercenary.isDead) {
      mercenary.x = safePt.x - 42;
      mercenary.y = safePt.y + 24;
    }
    activeEffects.push({ type: 'buff', x: player.x, y: player.y, life: 25, maxLife: 25, skillName: sInfo.name });
    window.broadcastMultiplayerActionFx?.('teleport', { x: Math.round(player.x), y: Math.round(player.y), skillName: sInfo.name });
    window.addChat(`🌀 [${sInfo.name}] 주변 안전 공간으로 도약했습니다!`, 'log-sys');
    updateStatusHUD();
    return true;
  }
  if (sInfo.name.includes("닷지 스텝")) {
    player.mp -= effMpCost;
    skillCooldowns[sInfo.name] = now;
    SoundSystem.playSkill(sInfo.name, player.class, sInfo.circle || 1, false);
    let backAngle = player.targetEntity?.ref
      ? Math.atan2(player.y - player.targetEntity.ref.y, player.x - player.targetEntity.ref.x)
      : Math.PI / 2;
    const safePt = findSafeSpot(player.x + Math.cos(backAngle) * 140, player.y + Math.sin(backAngle) * 140);
    player.x = safePt.x;
    player.y = safePt.y;
    activeEffects.push({ type: 'buff', x: player.x, y: player.y, life: 20, maxLife: 20, skillName: sInfo.name });
    window.broadcastMultiplayerActionFx?.('teleport', { x: Math.round(player.x), y: Math.round(player.y), skillName: sInfo.name });
    window.addChat(`💨 [닷지 스텝] 후방으로 빠르게 회피 도약했습니다!`, 'log-sys');
    updateStatusHUD();
    return true;
  }

  // 🌿 힐링 계열 스킬 (힐링 / 그레이트 힐 / 네이처스 터치) - 본인, 용병 HUD 선택, 타 플레이어 지원!
  if (sInfo.type === '힐링' || sInfo.name.includes("터치") || sInfo.name.includes("힐") || sInfo.name.includes("큐어")) {
    if (sInfo.name !== "뱀파이어 터치" && !sInfo.name.includes("헬 파이어")) {
      player.mp -= effMpCost;
      const baseHeal = sInfo.healFixed || 220;
      const isGreatHeal = sInfo.id === 'M13' || sInfo.name.includes('그레이트');
      const scaleStat = player.class === 'ranger'
        ? Math.floor(cStatsNow.effDEX * 4.2 + (cStatsNow.totalAtk || 0) * 0.65 + player.level * 3.8)
        : Math.floor(cStatsNow.effINT * 4.8 + (cStatsNow.totalMAtk || 0) * 0.85 + player.level * 4.2);

      let healTargetType = 'SELF';
      if (isAutoTrigger) {
        if ((player.hp / player.maxHp) > 0.70 && mercenary.hired && !mercenary.isDead && (mercenary.hp / mercenary.maxHp) <= 0.68) {
          healTargetType = 'MERC';
        }
      } else if (player.friendlyTarget) {
        if (player.friendlyTarget.type === 'MERC' && mercenary.hired && !mercenary.isDead) {
          healTargetType = 'MERC';
        } else if (player.friendlyTarget.type === 'PLAYER' && player.friendlyTarget.ref) {
          healTargetType = 'PLAYER';
        }
      }
      const refMaxHp = healTargetType === 'MERC'
        ? (mercenary.maxHp || 400)
        : (healTargetType === 'PLAYER' ? (player.friendlyTarget?.ref?.maxHp || player.maxHp || 400) : (player.maxHp || 400));
      const pctHealBonus = Math.floor(refMaxHp * (isGreatHeal ? 0.22 : 0.14));
      const healAmt = baseHeal + scaleStat + pctHealBonus;

      skillCooldowns[sInfo.name] = now;
      SoundSystem.playSkill(sInfo.name, player.class, sInfo.circle || 1, false);
// 힐링 계열은 마법진 없이 부드러운 치유 파티클만 표현
      if (healTargetType === 'MERC') {
        mercenary.hp = Math.min(mercenary.maxHp, mercenary.hp + healAmt);
        floatingTexts.push({ x: mercenary.x, y: mercenary.y - 48, text: `+${healAmt} HP`, color: 0x4ade80, life: 34 });
        activeEffects.push({ type: 'buff', x: mercenary.x, y: mercenary.y, life: 30, maxLife: 30, skillName: sInfo.name });
        window.broadcastMultiplayerActionFx?.('ally_buff', { x: Math.round(mercenary.x), y: Math.round(mercenary.y), skillName: sInfo.name, healAmt });
        window.addChat(`🌿 [용병 치유] '${mercenary.name}'에게 ${sInfo.name} 시전! (+${healAmt} HP)`, 'log-sys');
        window.updateMercHUD();
      } else if (healTargetType === 'PLAYER') {
        const targetCharId = player.friendlyTarget.charId || player.friendlyTarget.ref?.charId;
        const liveOp = (window.otherPlayers || []).find(o => o && o.charId === targetCharId) || player.friendlyTarget.ref || {};
        liveOp.maxHp = liveOp.maxHp || 500;
        liveOp.hp = Math.min(liveOp.maxHp, (liveOp.hp || 350) + healAmt);
        const tx = liveOp.x || player.x;
        const ty = liveOp.y || player.y;
        floatingTexts.push({ x: tx, y: ty - 48, text: `+${healAmt} HP`, color: 0x4ade80, life: 34 });
        activeEffects.push({ type: 'buff', x: tx, y: ty, targetRef: liveOp, life: 30, maxLife: 30, skillName: sInfo.name });
        sendCentralWsPacket({
          type: 'ALLY_SUPPORT',
          casterCharId: activeCharacterId,
          targetCharId: targetCharId,
          casterName: player.name,
          skillName: sInfo.name,
          healAmt: healAmt,
          x: Math.round(tx),
          y: Math.round(ty)
        });
        window.addChat(`🌿 [파티/아군 치유] '${player.friendlyTarget.name}'님에게 ${sInfo.name} 시전! (+${healAmt} HP)`, 'log-sys');
        window.updateMercHUD();
      } else {
        player.hp = Math.min(player.maxHp, player.hp + healAmt);
        floatingTexts.push({ x: player.x, y: player.y - 45, text: `+${healAmt} HP`, color: 0x4ade80, life: 32 });
        activeEffects.push({ type: 'buff', x: player.x, y: player.y, life: 30, maxLife: 30, skillName: sInfo.name });
        window.broadcastMultiplayerActionFx?.('ally_buff', { x: Math.round(player.x), y: Math.round(player.y), skillName: sInfo.name, healAmt });
        window.addChat(`🌿 [Skill] ${sInfo.name} 발동! (+${healAmt} HP)`, 'log-sys');
      }
      updateStatusHUD();
      return true;
    }
  }

  // ✨ 버프 계열 스킬 - 본인뿐만 아니라 아군(용병 HUD 선택 / 타 플레이어 선택)에게도 부여 가능!
 const buffKey = sInfo.buffKey || null;
  if (sInfo.type === '버프' || buffKey) {
    player.mp -= effMpCost;
    const durMs = (sInfo.dur && sInfo.dur > 0 ? sInfo.dur : 60) * 1000;
    skillCooldowns[sInfo.name] = now;
    SoundSystem.playSkill(sInfo.name, player.class, sInfo.circle || 1, false);

    const canCastOnAlly = sInfo.allyCast || ['SHIELD', 'HASTE', 'ENCHANT_STAT', 'MENTAL_FOCUS', 'SHADOW_FANG', 'IMMUNE', 'ADV_SPIRIT', 'EAGLE_EYE', 'WIND_WALK', 'ELVEN_GRACE', 'NATURES_FURY', 'SOUL_BARRIER', 'IRON_SKIN', 'GUARDIAN_ARMOR'].includes(buffKey);

    if (!isAutoTrigger && canCastOnAlly && player.friendlyTarget) {
      if (player.friendlyTarget.type === 'MERC' && mercenary.hired && !mercenary.isDead) {
        mercenary.activeBuffs = mercenary.activeBuffs || {};
        if (buffKey) mercenary.activeBuffs[buffKey] = Math.min(3600000, Math.max(0, mercenary.activeBuffs[buffKey] || 0) + durMs);
        syncMercStats(false);
        floatingTexts.push({ x: mercenary.x, y: mercenary.y - 48, text: `✨ ${sInfo.name}!`, color: 0xfde047, life: 34 });
        activeEffects.push({ type: 'buff', x: mercenary.x, y: mercenary.y, targetRef: mercenary, life: 30, maxLife: 30, skillName: sInfo.name });
        window.broadcastMultiplayerActionFx?.('ally_buff', { isMerc: true, x: Math.round(mercenary.x), y: Math.round(mercenary.y), skillName: sInfo.name });
        window.addChat(`✨ [용병 버프 누적] '${mercenary.name}'에게 '${sInfo.name}' 버프가 누적 적용되었습니다! (잔여 ${Math.round((mercenary.activeBuffs[buffKey] || durMs) / 1000)}초)`, 'log-sys');
        window.updateMercHUD();
        updateStatusHUD();
        return true;
      } else if (player.friendlyTarget.type === 'PLAYER' && (player.friendlyTarget.charId || player.friendlyTarget.ref)) {
        const targetCharId = player.friendlyTarget.charId || player.friendlyTarget.ref?.charId;
        const liveOp = (window.otherPlayers || []).find(o => o && o.charId === targetCharId) || player.friendlyTarget.ref || {};
        liveOp.activeBuffs = liveOp.activeBuffs || {};
        if (buffKey) liveOp.activeBuffs[buffKey] = Math.min(3600000, Math.max(0, liveOp.activeBuffs[buffKey] || 0) + durMs);
        const tx = liveOp.x || player.x;
        const ty = liveOp.y || player.y;
        floatingTexts.push({ x: tx, y: ty - 48, text: `✨ ${sInfo.name}!`, color: 0xfde047, life: 34 });
        activeEffects.push({ type: 'buff', x: tx, y: ty, targetRef: liveOp, life: 30, maxLife: 30, skillName: sInfo.name });
        sendCentralWsPacket({
          type: 'ALLY_SUPPORT',
          casterCharId: activeCharacterId,
          targetCharId: targetCharId,
          casterName: player.name,
          skillName: sInfo.name,
          buffKey: buffKey,
          durMs: durMs,
          x: Math.round(tx),
          y: Math.round(ty)
        });
        window.addChat(`✨ [파티/아군 버프] '${player.friendlyTarget.name}'님에게 '${sInfo.name}' 버프를 부여했습니다! (${Math.round(durMs / 1000)}초)`, 'log-sys');
        updateStatusHUD();
        return true;
      }
    }

    if (buffKey) player.activeBuffs[buffKey] = Math.min(3600000, Math.max(0, player.activeBuffs[buffKey] || 0) + durMs);
    recalcMaxHpMp(true);
    activeEffects.push({ type: 'buff', x: player.x, y: player.y, life: 30, maxLife: 30, skillName: sInfo.name });
    window.broadcastMultiplayerActionFx?.('ally_buff', { x: Math.round(player.x), y: Math.round(player.y), skillName: sInfo.name });
    window.addChat(`✨ [Skill] ${sInfo.name} 발동! (${Math.round(durMs / 1000)}초 지속)`, 'log-sys');
    window.updateBuffUI();
    updateStatusHUD();
    return true;
  }

  if (!player.targetEntity || player.targetEntity.type !== 'MONSTER' || !player.targetEntity.ref || player.targetEntity.ref.isDead) {
    if (!isAutoTrigger) {
      const autoTarget = findNearestAttackableMonster(900);
      if (autoTarget) {
        player.targetEntity = { type: 'MONSTER', ref: autoTarget };
        updateTopTargetUI(autoTarget);
      } else {
        window.addChat("[System] 주변에 공격할 몬스터가 없습니다.", "log-hit");
        return false;
      }
    } else {
      return false;
    }
  }

  let mon = player.targetEntity.ref;
  let isRanged = (player.class === 'ranger' || player.class === 'wizard');
  let atkRange = sInfo.dash ? 260 : (isRanged ? getPlayerAttackRange() + 10 : 75);
  let dist = Math.hypot(mon.x - player.x, mon.y - player.y);

  if (dist > atkRange) {
    player.path = window.findPath(player.x, player.y, mon.x, mon.y);
    player.isMoving = true; player.manualMoving = false;
    return false;
  }

  const preDashX = player.x;
  const preDashY = player.y;
  const castAngle = Math.atan2(mon.y - player.y, mon.x - player.x);
  if (sInfo.dash && dist > 50) {
    const dashPt = findSafeSpot(mon.x - Math.cos(castAngle) * 40, mon.y - Math.sin(castAngle) * 40);
    player.x = dashPt.x;
    player.y = dashPt.y;
  }

  player.isMoving = false; player.path = [];
  let dx = mon.x - player.x;
  let dy = mon.y - player.y;
  if (Math.abs(dx) > Math.abs(dy)) player.dir = dx > 0 ? 'right' : 'left';
  else player.dir = dy > 0 ? 'down' : 'up';

  player.mp -= effMpCost;
  skillCooldowns[sInfo.name] = now;
  player.lastAttackTime = now;
  player.lastCombatTime = now;
  PlayerSpriteManager.currentFrame = 0;

  SoundSystem.playSkill(sInfo.name, player.class, sInfo.circle || 1, false);
  const cLv = sInfo.circle || 1;

  const cStats = calculateCombatStats(false);
  const skillMult = sInfo.mult || 1.5;
  const hitCount = sInfo.hits || 1;
  let basePower = player.class === 'wizard' ? cStats.totalMAtk : cStats.totalAtk;
  let finalDmg = Math.floor((basePower + player.level * 2.2) * skillMult);
  const totalExpectedDmg = finalDmg * hitCount;
  const totalSkillMult = skillMult * hitCount;

  // 🌟 마법진 표현: 공격마법 위주로 3서클 이상부터 발동하며, 피해량(totalExpectedDmg/totalSkillMult)에 따라 크기와 색상이 다르게 표현됨!
  const isOffensiveSpell = sInfo.type === '공격' || (sInfo.mult && sInfo.mult > 0);
  if (isOffensiveSpell && cLv >= 3) {
    const baseCircleRadius = 54 + cLv * 12;
    activeEffects.push({
      type: 'magic_circle',
      x: player.x,
      y: player.y + 2,
      casterRef: player,
      aoeRadius: baseCircleRadius,
      circleLv: cLv,
      dmgMult: totalSkillMult,
      dmgAmount: totalExpectedDmg,
      isBossCircle: false,
      life: 58 + cLv * 6,
      maxLife: 58 + cLv * 6,
      skillName: sInfo.name
    });
  }

  let isAoe = Boolean(sInfo && sInfo.range === '광역');
  let aoeRadius = isAoe ? (145 + (sInfo.circle || 1) * 10) : 70;
  const effTargetX = (!isRanged && isAoe) ? player.x : mon.x;
  const effTargetY = (!isRanged && isAoe) ? player.y : mon.y;

  window.broadcastMultiplayerSkill?.(
    sInfo.name,
    effTargetX,
    effTargetY,
    isAoe,
    cLv,
    totalSkillMult,
    totalExpectedDmg,
    {
      mobId: mon.id,
      startX: Math.round(preDashX),
      startY: Math.round(preDashY),
      casterX: Math.round(player.x),
      casterY: Math.round(player.y),
      casterClass: player.class,
      skyDrop: Boolean(sInfo.skyDrop)
    }
  );

  const dmgOpts = {
    attacker: 'player',
    isSkill: true,
    ignoreDef: !!sInfo.ignoreDef,
    forceCrit: !!sInfo.forceCrit,
    stunSec: sInfo.stunSec || 0,
    defDown: !!sInfo.defDown,
    drainPct: sInfo.drainPct || 0,
    mpDrain: sInfo.mpDrain || 0,
    instantKillChance: sInfo.instantKillChance || 0,
    knockback: !!sInfo.knockback,
    hits: hitCount
  };

  updateStatusHUD();
  if (isRanged) {
    // 직선 광선/브레스형 마법(콜드 빔, 데스 레이, 콘 오브 콜드)은 시전자에서 타겟까지 즉시 광선 이펙트 생성!
    if (slotData.name.includes("콜드 빔") || slotData.name.includes("데스 레이") || slotData.name.includes("콘 오브 콜드")) {
      activeEffects.push({
        type: 'wizard',
        x: mon.x, y: mon.y,
        startX: player.x, startY: player.y - 18,
        casterRef: player,
        angle: castAngle,
        life: 32, maxLife: 32,
        skillName: slotData.name,
        isAoe: isAoe,
        aoeRadius: aoeRadius
      });
    }
    const isSkySpell = Boolean(
      sInfo.skyDrop ||
      slotData.name.includes("라이트닝") ||
      slotData.name.includes("썬더 볼트") ||
      slotData.name.includes("메테오") ||
      slotData.name.includes("미티어") ||
      slotData.name.includes("아이스 스톰") ||
      slotData.name.includes("블리자드") ||
      slotData.name.includes("앱솔루트 제로") ||
      slotData.name.includes("둠") ||
      slotData.name.includes("워드 오브 데스") ||
      slotData.name.includes("카오스 필드") ||
      slotData.name.includes("애로우 레인")
    );
    const camTopY = (typeof camera !== 'undefined' && typeof camera.y === 'number') ? (camera.y - 95) : (mon.y - 520);
    const skyStartY = Math.min(camTopY, mon.y - 460);
    const skyOffsetX = (slotData.name.includes("메테오") || slotData.name.includes("미티어")) ? 95 : 0;
    const projStartX = isSkySpell ? (mon.x + skyOffsetX) : player.x;
    const projStartY = isSkySpell ? skyStartY : (player.y - 15);

    projectiles.push({
      x: projStartX, y: projStartY,
      startX: projStartX, startY: projStartY,
      lastTargetX: mon.x, lastTargetY: mon.y,
      isSkyDrop: isSkySpell,
      skyTotalDist: isSkySpell ? Math.max(180, Math.hypot(mon.x - projStartX, (mon.y - 15) - projStartY)) : 0,
      casterRef: player,
      target: mon, speed: isSkySpell ? 24 : 15,
      type: player.class === 'ranger' ? 'arrow' : 'magic',
      dmg: finalDmg, skillName: slotData.name, isAoe: isAoe,
      aoeRadius: aoeRadius,
      maxTargets: sInfo.maxTargets || 5, opts: dmgOpts
    });
  } else {
    if (isAoe) {
      const limit = sInfo.maxTargets || 5;
      const hitMons = [];
      monsterList.forEach(m => {
        if (!m.isDead && hitMons.length < limit && Math.hypot(m.x - player.x, m.y - player.y) <= aoeRadius) {
          hitMons.push(m);
        }
      });
      if (hitMons.length > 0) {
        window.applyDamageBatch(hitMons, finalDmg, 'melee', dmgOpts);
      }
      activeEffects.push({ type: player.class, x: player.x, y: player.y, startX: preDashX, startY: preDashY, angle: castAngle, casterRef: player, life: 36, maxLife: 36, skillName: slotData.name, isAoe: true, aoeRadius: aoeRadius });
    } else {
      window.applyDamageBatch([mon], finalDmg, 'melee', dmgOpts);
      activeEffects.push({ type: player.class, x: mon.x, y: mon.y, startX: preDashX, startY: preDashY, angle: castAngle, casterRef: player, life: 32, maxLife: 32, skillName: slotData.name, isAoe: false, aoeRadius: 68 });
    }
  }
  return true;
};

function getSkillPowerScore(sInfo) {
  if (!sInfo) return 0;
  return Math.round((sInfo.mult || 1.2) * (sInfo.hits || 1) * 100);
}

function getBestSkillForTarget(target) {
  const now = Date.now();
  const cStatsNow = calculateCombatStats(false);
  let attackSlots = [];

  for (let i = 1; i <= 9; i++) {
    if (window.autoSlots.has(i) && window.skillSlots[i] && window.skillSlots[i].type === 'skill') {
      const slotData = window.skillSlots[i]; // ✅ 슬롯 데이터 안전 추출
      const sInfo = SKILLS_DB[player.class]?.find(s => s.name === slotData.name); // ✅ sInfo 정의

      if (!sInfo || !isSkillLearned(sInfo)) continue;
      // 🌟 이름 문자열 비교 대신 데이터에 정의된 속성(buffKey 등) 검사
      if (sInfo.type === '힐링' || sInfo.type === '버프' || sInfo.type === '유틸' || sInfo.buffKey) continue

      let coolMs = (sInfo.cool || 1) * 1000;
      if (cStatsNow.coolReducePct > 0) coolMs *= Math.max(0.55, 1 - cStatsNow.coolReducePct / 100);
      if (player.activeBuffs.ARCHMAGE > 0 && player.class === 'wizard') coolMs *= 0.5;
      if (skillCooldowns[sInfo.name] && now - skillCooldowns[sInfo.name] < coolMs) continue;

      const effMpCost = Math.max(1, Math.round((sInfo.mp || 0) * Math.max(0.7, 1 - (cStatsNow.mpCostReducePct || 0) / 100)));
      if ((sInfo.mp || 0) > 0 && player.mp < effMpCost) continue;
      if (sInfo.reqShield && player.equip.shield === null) continue;

      attackSlots.push({ slot: i, sInfo, power: getSkillPowerScore(sInfo) });
    }
  }

  if (attackSlots.length === 0) return null;

  if (target) {
    const checkCenterX = player.class === 'knight' ? player.x : target.x;
    const checkCenterY = player.class === 'knight' ? player.y : target.y;
    const nearbyMobCount = monsterList.filter(m =>
      !m.isDead &&
      !isInsideSafeZone(m.x, m.y) &&
      (Math.hypot(m.x - checkCenterX, m.y - checkCenterY) <= 180 || Math.hypot(m.x - target.x, m.y - target.y) <= 180)
    ).length;

    const singleSkills = attackSlots.filter(x => x.sInfo.range === '단일');
    const aoeSkills = attackSlots.filter(x => x.sInfo.range === '광역');

    if (nearbyMobCount >= 2 && aoeSkills.length > 0) {
      aoeSkills.sort((a, b) => b.power - a.power);
      return aoeSkills[0].slot;
    }
    if (singleSkills.length > 0) {
      singleSkills.sort((a, b) => b.power - a.power);
      return singleSkills[0].slot;
    }
  }

  attackSlots.sort((a, b) => b.power - a.power);
  return attackSlots[0].slot;
}

// 드롭 아이템이 벽/충돌체 내부에 스폰되지 않도록 안전 좌표를 찾아 배치하는 헬퍼
function spawnDroppedItemSafe(itemObj, rawX, rawY) {
  const safePt = findSafeSpot(rawX, rawY);
  itemList.push({
    ...itemObj,
    x: safePt.x,
    y: safePt.y,
    spawnTime: Date.now()
  });
}

// ============================================================================
// ⚖️ 전투 데미지 & 차등 드롭률 + 마법서/기술서 드롭 & 보스 재타겟팅 복귀
// ============================================================================
// 📉 데이터 절약 & 다단히트/광역기 누락 방지: 복수 타겟·다단히트를 단 1개의 패킷으로 묶어 전송
window.applyDamageBatch = function(targets, rawDmg, dmgType, opts = {}) {
  const validTargets = (Array.isArray(targets) ? targets : [targets]).filter(t => t && !t.isDead);
  if (validTargets.length === 0) return;
  const hitCount = Math.max(1, Math.min(5, Number(opts.hits) || 1));

  if (isServerAuthoritativeMode()) {
    const now = Date.now();
    const isMercAtk = opts.attacker === 'mercenary';
    const cStats = isMercAtk ? calculateMercCombatStats() : calculateCombatStats(false);
    const attackerLv = isMercAtk ? mercenary.level : player.level;
    if (!isMercAtk) player.lastCombatTime = now;
    else mercenary.lastCombatTime = now;

    const atkSrcX = isMercAtk ? mercenary.x : player.x;
    const atkSrcY = isMercAtk ? mercenary.y : player.y;
    sendCentralWsPacket({
      type: 'PLAYER_ATTACK_MONSTER',
      charId: activeCharacterId,
      mapKey: currentMapKey,
      mobIds: validTargets.map(t => t.id),
      rawDmg: Math.max(1, Math.round(rawDmg * (player.gmAtkMult || 1))),
      dmgType: dmgType || 'melee',
      isMercAtk,
      cStats: {
        hitBonus: cStats.hitBonus || 0,
        armorPenPct: cStats.armorPenPct || 0,
        bossDmgPct: cStats.bossDmgPct || 0,
        critRate: cStats.critRate || 8,
        critDmgMult: cStats.critDmgMult || 1.5,
        drainBonus: cStats.drainBonus || 0,
        mDef: cStats.totalMDef || 0
      },
      attackerLv,
      attackerX: Math.round(atkSrcX),
      attackerY: Math.round(atkSrcY),
      opts: {
        ...opts,
        hits: hitCount
      }
    });
    return;
  }

  validTargets.forEach(m => {
    for (let h = 0; h < hitCount; h++) {
      if (!m.isDead) window.applyDamage(m, rawDmg, dmgType, { ...opts, hits: 1 });
    }
  });
};

window.applyDamage = function(ent, rawDmg, dmgType, opts = {}) {
  if (!ent || ent.isDead) return;
  const now = Date.now();
  const isMercAtk = opts.attacker === 'mercenary';
  const cStats = isMercAtk ? calculateMercCombatStats() : calculateCombatStats(false);
  const attackerLv = isMercAtk ? mercenary.level : player.level;

  if (!isMercAtk) player.lastCombatTime = now;
  else mercenary.lastCombatTime = now;

  // 🌐 서버 권위 모드(Server-Authoritative): 모든 몬스터 피격/체력감소/상태이상/사망/드롭을 서버에서 연산 후 전 유저에게 동시 브로드캐스트!
  if (isServerAuthoritativeMode()) {
    window.applyDamageBatch([ent], rawDmg, dmgType, opts);
    return;
  }

  const lvGap = Math.max(0, (ent.lv || 1) - attackerLv);
  if (!opts.forceCrit && lvGap >= 3) {
    const hitChance = Math.max(38, 97 - lvGap * 6 + (cStats.hitBonus || 0));
    if (Math.random() * 100 > hitChance) {
      floatingTexts.push({ x: ent.x, y: ent.y - 35, text: `MISS!`, color: 0x9ca3af, life: 30 });
      return;
    }
  }

  // 몬스터 물리방어(def) / 마법방어(mDef) 비율 감쇄 + 고강화(+7) 방어·속성 관통력 적용
  let monDef = dmgType === 'magic' ? (ent.mDef ?? Math.round((ent.def || 0) * 0.85)) : (ent.def || 0);
  if (ent.defDownUntil && now < ent.defDownUntil) monDef = Math.floor(monDef * 0.75);
  if ((cStats.armorPenPct || 0) > 0) {
    monDef = Math.max(0, Math.floor(monDef * (1 - Math.min(0.65, cStats.armorPenPct / 100))));
  }
  if (opts.ignoreDef) monDef = 0;

  const monDefRatio = monDef / (monDef + 140 + attackerLv * 6);
  let mitigated = Math.max(1, Math.floor((rawDmg - monDef * 0.25) * (1 - monDefRatio * 0.65)));
  if (lvGap > 0) {
    const gapScale = Math.max(0.32, 1 - lvGap * 0.075);
    mitigated = Math.max(1, Math.floor(mitigated * gapScale));
  }

  // 고강화(+10+) 보스 몬스터 추가 피해 보너스 적용
  if (ent.isBoss && (cStats.bossDmgPct || 0) > 0) {
    mitigated = Math.floor(mitigated * (1 + cStats.bossDmgPct / 100));
  }

  let isCrit = opts.forceCrit || (Math.random() * 100 < (cStats.critRate || 8));
  if (isCrit) {
    const mult = cStats.critDmgMult || 1.5;
    mitigated = Math.floor(mitigated * mult);
  }

  if (opts.instantKillChance && !ent.isBoss && Math.random() * 100 < opts.instantKillChance) {
    mitigated = ent.hp;
  }

  if (opts.stunSec && opts.stunSec > 0) ent.stunUntil = now + opts.stunSec * 1000;
  if (opts.defDown) ent.defDownUntil = now + 10000;
  if (opts.knockback && !ent.isBoss) {
    const srcX = isMercAtk ? mercenary.x : player.x;
    const srcY = isMercAtk ? mercenary.y : player.y;
    const ang = Math.atan2(ent.y - srcY, ent.x - srcX);
    const nx = ent.x + Math.cos(ang) * 75;
    const ny = ent.y + Math.sin(ang) * 75;
    if (!checkCollision(nx, ny)) { ent.x = nx; ent.y = ny; }
  }

  const totalDrainPct = Math.min(25, (cStats.drainBonus || 0) + (opts.drainPct || 0));
  if (totalDrainPct > 0) {
    const heal = Math.max(1, Math.floor(mitigated * (totalDrainPct / 100)));
    if (isMercAtk && mercenary.hired && !mercenary.isDead) {
      mercenary.hp = Math.min(mercenary.maxHp, mercenary.hp + heal);
    } else {
      player.hp = Math.min(player.maxHp, player.hp + heal);
    }
  }
  if (opts.mpDrain && !isMercAtk) {
    player.mp = Math.min(player.maxMp, player.mp + opts.mpDrain);
  }

  ent.hp -= mitigated;
  const atkSrcX = isMercAtk ? mercenary.x : player.x;
  const atkSrcY = isMercAtk ? mercenary.y : player.y;
  const hitAng = Math.atan2(ent.y - atkSrcY, ent.x - atkSrcX);
  ent.lastHitTime = now;
  ent.lastHitAngle = hitAng;
  ent.lastHitCrit = Boolean(isCrit);

  const isSkillHit = Boolean(opts.isSkill);
  SoundSystem.playPhysicalHit('monster', 'hit', Boolean(isCrit));
  if (!isMercAtk) {
    window.triggerCameraShake?.(isCrit ? 4.8 : (isSkillHit ? 2.8 : 1.5), isCrit ? 150 : 90);
  }

  // 💥 몬스터 피격 시 공격 각도·스킬·치명타 여부를 반영한 묵직한 2.5D 피격 파티클 생성
  activeEffects.push({
    type: 'hit_particle',
    targetType: 'monster',
    x: ent.x,
    y: ent.y,
    hitAngle: hitAng,
    hasDirection: true,
    dmgType: dmgType,
    isSkill: isSkillHit,
    isCrit: Boolean(isCrit),
    life: isCrit ? 28 : (isSkillHit ? 23 : 19),
    maxLife: isCrit ? 28 : (isSkillHit ? 23 : 19)
  });

  const dmgKind = isCrit ? 'crit' : (isSkillHit ? 'skill' : (isMercAtk ? 'merc' : 'normal'));
  const txtLabel = isCrit
    ? `⚡${mitigated.toLocaleString()}`
    : `-${mitigated.toLocaleString()}`;
  const txtCol = isCrit
    ? 0xfacc15
    : (isMercAtk ? 0x6ee7b7 : (isSkillHit ? (dmgType === 'magic' ? 0x38bdf8 : 0xf472b6) : (dmgType === 'magic' ? 0x93c5fd : 0xfef08a)));
  const jitterX = (Math.random() - 0.5) * 10 + (isMercAtk ? 12 : 0);
  floatingTexts.push({
    x: ent.x + jitterX,
    y: ent.y - (ent.isElite ? 48 : 34),
    text: txtLabel,
    color: txtCol,
    dmgKind,
    fontSize: isCrit ? 13 : (isSkillHit ? 11.5 : (isMercAtk ? 10.5 : 11)),
    strokeColor: '#000000',
    life: isCrit ? 28 : 22,
    maxLife: isCrit ? 28 : 22
  });

  if (ent.hp <= 0) {
    ent.isDead = true;
    window.ImmersiveSystem?.onMonsterKilled?.(ent, mitigated);
    SoundSystem.playMonsterDeath(ent.rawName || ent.name, ent.isBoss);
    if (ent.nameTag) ent.nameTag.visible = false;
    if (mercenary.targetMonster === ent) mercenary.targetMonster = null;
    if (mercenary.attackerMonster === ent) mercenary.attackerMonster = null;
    if (player.lastHitByMonster === ent) player.lastHitByMonster = null;
    if (player.savedBossTarget === ent) player.savedBossTarget = null;

    if (ent.isBoss) {
      bossRespawnTimer = 300;
      ent.respawnTimer = 300;
      window.addChat(`🏆 [보스 토벌] '${ent.name}'을(를) 처치했습니다! (다음 보스 리스폰: 5분 후)`, 'log-kill');
    } else {
      ent.respawnTimer = 12;
    }

    GameDB.Quests.forEach(q => {
      const st = player.quests[q.id];
      if (st && st.status === 'ACTIVE' && ent.name.includes(q.targetName)) {
        st.count = Math.min(q.reqCount, st.count + 1);
        window.renderQuestUI();
      }
    });

    let expGain = calcBalancedKillExp(ent.baseExp || 18, player.level || 1, ent.lv || 1, Boolean(ent.isBoss));
    floatingTexts.push({ x: ent.x, y: ent.y - 52, text: `EXP +${expGain}`, color: 0x38bdf8, life: 42 });
    gainExp(expGain);

    const mobLv = ent.lv || 1;

    if (ent.isBoss) {
      let bossGold = Math.floor((45 + mobLv * 15 + Math.random() * 80) * 10);
      player.gold += bossGold;
      floatingTexts.push({ x: ent.x, y: ent.y - 45, text: `+${bossGold.toLocaleString()} G`, color: 0xfacc15, life: 40 });

      const guaranteedEqId = pickMonsterTierDrop(ent, 'equip');
      const guaranteedEqInst = createItemInstance(guaranteedEqId, 1, true, null, mobLv);
      spawnDroppedItemSafe(guaranteedEqInst, ent.x, ent.y);

      const scrollOrPot = Math.random() < 0.65 ? (Math.random() < 0.5 ? 'S_WE01' : 'S_AR01') : 'C_P05';
      spawnDroppedItemSafe(createItemInstance(scrollOrPot, 1, false), ent.x - 28, ent.y + 12);

      // 보스는 레벨에 맞는 상위 마법서/비급서 추가 드롭 확률 부여
      const bossBookId = pickMonsterSkillBookDrop(mobLv, true);
      if (bossBookId && Math.random() < 0.70) {
        spawnDroppedItemSafe(createItemInstance(bossBookId, 1, true), ent.x, ent.y + 26);
      }

      if (Math.random() < 0.50) {
        const bonusEqId = pickMonsterTierDrop(ent, 'equip');
        const bonusEqInst = createItemInstance(bonusEqId, 1, true, null, mobLv);
        spawnDroppedItemSafe(bonusEqInst, ent.x + 28, ent.y + 12);
      }
    } else {
      if (Math.random() < 0.50) {
        const subRoll = Math.random() * 100;
        if (subRoll < 48) {
          let amt = Math.floor(14 + mobLv * 3.5 + Math.random() * 22);
          player.gold += amt;
          floatingTexts.push({ x: ent.x, y: ent.y - 45, text: `+${amt.toLocaleString()} G`, color: 0xfacc15, life: 35 });
        } else if (subRoll < 82) {
          const pickedCons = pickMonsterTierDrop(ent, 'consumable');
          spawnDroppedItemSafe(createItemInstance(pickedCons, 1, false), ent.x, ent.y);
        } else {
          const pickedEq = pickMonsterTierDrop(ent, 'equip');
          const inst = createItemInstance(pickedEq, 1, false, null, mobLv);
          spawnDroppedItemSafe(inst, ent.x, ent.y);
        }
      }
    }

    // 🌟 보스전 도중 플레이어를 때린 일반 몬스터를 먼저 처치한 경우, 즉시 기억해둔 보스를 다시 타겟팅!
    if (player.targetEntity && player.targetEntity.ref === ent) {
      if (player.savedBossTarget && !player.savedBossTarget.isDead) {
        const resumeBoss = player.savedBossTarget;
        player.savedBossTarget = null;
        player.targetEntity = { type: 'MONSTER', ref: resumeBoss };
        updateTopTargetUI(resumeBoss);
        window.addChat(`🎯 [보스 재타겟팅] 방해하던 몬스터를 처치하고 '${resumeBoss.rawName || resumeBoss.name}' 공격을 재개합니다!`, 'log-sys');
      } else {
        window.clearTarget();
      }
    }
    updateStatusHUD();
    window.triggerAutoSave?.(ent.isBoss ? 'boss_kill' : 'mob_kill', Boolean(ent.isBoss));
  }
};

// ============================================================================
// 🐉 전 지역 구역별 몬스터 클러스터 스폰 (안전지대 및 벽/충돌체 내부 스폰 100% 차단)
// ============================================================================
function spawnAltriaMonsters(mapKey, mapData) {
  monsterList = [];

  const pushSafeMonster = (id, baseMob, x, y, forceBoss = false) => {
    if (!baseMob) return;
    const isBossMob = forceBoss || String(baseMob.name || '').includes('(B)');
    if (!mapData.isDungeon) {
      if (isInsideSafeZone(x, y, mapKey)) {
        const sz = getSafeZoneInfo(mapKey);
        const angle = Math.atan2(y - sz.y, x - sz.x);
        x = sz.x + Math.cos(angle) * (sz.radius + 180);
        y = sz.y + Math.sin(angle) * (sz.radius + 180);
      }
      const wZones = mapData.warpSafeZones || [];
      for (const wz of wZones) {
        if (isBossMob && wz.type === 'boss_camp') continue;
        const dist = Math.hypot(x - wz.x, y - wz.y);
        const rad = wz.radius || 420;
        if (dist <= rad) {
          const ang = dist < 5 ? -Math.PI / 2 : Math.atan2(y - wz.y, x - wz.x);
          x = wz.x + Math.cos(ang) * (rad + 140);
          y = wz.y + Math.sin(ang) * (rad + 140);
        }
      }
    }
    // 벽·바위·건물 등 모든 충돌체 밖의 안전 오픈 좌표로 보정!
    const safePt = findSafeSpot(x, y);
    monsterList.push(createMonsterInstance(id, baseMob, safePt.x, safePt.y, forceBoss));
  };

  if (mapData.isDungeon) {
    let dungMobs = GameDB.Monsters.filter(m => m.region === currentRegionKey && !m.name.includes("(B)"));
    if (currentRegionKey === "R01") dungMobs = GameDB.Monsters.filter(m => m.zone === "goblin_cave");
    else if (currentRegionKey === "R02") dungMobs = GameDB.Monsters.filter(m => m.zone === "lumber_mill" || m.zone === "silver_vine_forest");
    else if (currentRegionKey === "R05") dungMobs = GameDB.Monsters.filter(m => m.zone === "ant_hell");
    else if (currentRegionKey === "R07") dungMobs = GameDB.Monsters.filter(m => m.zone === "shipwreck");

    for (let i = 0; i < 45; i++) {
      let baseMob = dungMobs[i % dungMobs.length];
      let rx = 250 + ((i * 233) % (mapData.width - 500));
      let ry = 250 + ((i * 389) % (mapData.height - 600));
      if (Math.hypot(rx - 1500, ry - 2600) < 350) ry -= 500;
      pushSafeMonster(`dung_${currentRegionKey}_${i}`, baseMob, rx, ry);
    }
    return;
  }

  if (currentRegionKey === "R01") {
    const southMobs = GameDB.Monsters.filter(m => m.zone === "south_plains");
    const southClusters = [
      [1850, 13150], [2200, 13120],
      [1300, 12800], [2600, 12700], [1100, 11100], [2100, 10800], [2900, 10900]
    ];
    southClusters.forEach(([cx, cy], cIdx) => {
      for (let i = 0; i < 6; i++) {
        let mData = southMobs[i % southMobs.length];
        pushSafeMonster(`south_${cIdx}_${i}`, mData, cx + Math.cos(i * 1.1) * (80 + i * 22), cy + Math.sin(i * 1.1) * (80 + i * 22));
      }
    });

    const plainMobs = GameDB.Monsters.filter(m => m.zone === "whispering_plains" || m.zone === "whispering_ruins");
    const plainClusters = [[900, 9200], [2200, 9100], [1450, 8100], [2700, 7800], [1200, 6500], [2400, 6300]];
    plainClusters.forEach(([cx, cy], cIdx) => {
      for (let i = 0; i < 8; i++) {
        let mData = plainMobs[i % plainMobs.length];
        pushSafeMonster(`plain_${cIdx}_${i}`, mData, cx + Math.cos(i * 0.8) * (100 + i * 28), cy + Math.sin(i * 0.8) * (100 + i * 28));
      }
    });

    const gateMobs = GameDB.Monsters.filter(m => m.zone === "whispering_ruins" || m.zone === "goblin_cave");
    [[950, 2750], [1550, 3200]].forEach(([cx, cy], cIdx) => {
      for (let i = 0; i < 8; i++) {
        pushSafeMonster(`gate_${cIdx}_${i}`, gateMobs[i % gateMobs.length], cx + Math.cos(i) * 140, cy + Math.sin(i) * 140);
      }
    });

    const campMobs = GameDB.Monsters.filter(m => m.zone === "chief_camp" || m.zone === "whispering_ruins");
    [[2550, 3100], [3250, 2900], [2950, 2600]].forEach(([cx, cy], cIdx) => {
      for (let i = 0; i < 6; i++) {
        pushSafeMonster(`camp_${cIdx}_${i}`, campMobs[i % campMobs.length], cx + Math.cos(i) * 150, cy + Math.sin(i) * 150);
      }
    });

    const bossData = GameDB.Monsters.find(m => m.id === 104);
    if (bossData) pushSafeMonster("boss_altria", bossData, 2950, 2250, true);
    return;
  }

  if (currentRegionKey === "R02") {
    const outMobs = GameDB.Monsters.filter(m => m.region === "R02" && (m.zone === "fairy_outskirts" || m.zone === "silver_vine_forest"));
    [[1350, 12100], [2650, 11900], [1850, 11100], [2850, 10800], [1200, 10500]].forEach(([cx, cy], cIdx) => {
      for (let i = 0; i < 6; i++) {
        pushSafeMonster(`r02_south_${cIdx}_${i}`, outMobs[i % outMobs.length], cx + Math.cos(i) * 120, cy + Math.sin(i) * 120);
      }
    });

    const vineMobs = GameDB.Monsters.filter(m => m.region === "R02" && m.zone === "silver_vine_forest");
    [[950, 9400], [880, 8800], [1380, 8500], [1150, 7500], [1850, 9100]].forEach(([cx, cy], cIdx) => {
      for (let i = 0; i < 7; i++) {
        pushSafeMonster(`r02_vine_${cIdx}_${i}`, vineMobs[i % vineMobs.length], cx + Math.cos(i * 0.9) * 135, cy + Math.sin(i * 0.9) * 135);
      }
    });

    const millMobs = GameDB.Monsters.filter(m => m.region === "R02" && m.zone === "lumber_mill");
    [[3000, 9650], [2550, 9150], [3380, 9200], [2750, 7400]].forEach(([cx, cy], cIdx) => {
      for (let i = 0; i < 7; i++) {
        pushSafeMonster(`r02_mill_${cIdx}_${i}`, millMobs[i % millMobs.length], cx + Math.cos(i) * 130, cy + Math.sin(i) * 130);
      }
    });

    const treeGuards = GameDB.Monsters.filter(m => m.region === "R02" && (m.zone === "world_tree_camp" || m.zone === "lumber_mill"));
    [[1580, 5250], [2520, 5250], [2050, 5850], [2050, 4950]].forEach(([cx, cy], cIdx) => {
      for (let i = 0; i < 6; i++) {
        pushSafeMonster(`r02_top_${cIdx}_${i}`, treeGuards[i % treeGuards.length], cx + Math.cos(i) * 145, cy + Math.sin(i) * 145);
      }
    });

    const bossData = GameDB.Monsters.find(m => m.id === 108);
    if (bossData) pushSafeMonster("boss_silvervine", bossData, 2050, 4550, true);
    return;
  }

  if (currentRegionKey === "R05") {
    const oasisMobs = GameDB.Monsters.filter(m => m.region === "R05" && (m.zone === "oasis_outskirts" || m.zone === "sand_dunes"));
    [[1350, 12300], [2850, 11400], [1850, 11100], [1150, 10600], [2450, 10200]].forEach(([cx, cy], cIdx) => {
      for (let i = 0; i < 6; i++) {
        pushSafeMonster(`r05_south_${cIdx}_${i}`, oasisMobs[i % oasisMobs.length], cx + Math.cos(i) * 125, cy + Math.sin(i) * 125);
      }
    });

    const duneMobs = GameDB.Monsters.filter(m => m.region === "R05" && m.zone === "sand_dunes");
    [[1150, 9500], [880, 8750], [1550, 8950], [2150, 8400], [1400, 7400]].forEach(([cx, cy], cIdx) => {
      for (let i = 0; i < 7; i++) {
        pushSafeMonster(`r05_dune_${cIdx}_${i}`, duneMobs[i % duneMobs.length], cx + Math.cos(i * 0.9) * 140, cy + Math.sin(i * 0.9) * 140);
      }
    });

    const antMobs = GameDB.Monsters.filter(m => m.region === "R05" && m.zone === "ant_hell");
    [[1050, 4650], [780, 4250], [1420, 4300], [1350, 5600]].forEach(([cx, cy], cIdx) => {
      for (let i = 0; i < 7; i++) {
        pushSafeMonster(`r05_ant_${cIdx}_${i}`, antMobs[i % antMobs.length], cx + Math.cos(i) * 135, cy + Math.sin(i) * 135);
      }
    });

    const tombGuards = GameDB.Monsters.filter(m => m.region === "R05" && (m.zone === "pharaoh_tomb" || m.zone === "sand_dunes"));
    [[2550, 6100], [3350, 6100], [2950, 6650], [2950, 5650]].forEach(([cx, cy], cIdx) => {
      for (let i = 0; i < 6; i++) {
        pushSafeMonster(`r05_tomb_${cIdx}_${i}`, tombGuards[i % tombGuards.length], cx + Math.cos(i) * 145, cy + Math.sin(i) * 145);
      }
    });

    const bossData = GameDB.Monsters.find(m => m.id === 118);
    if (bossData) pushSafeMonster("boss_moraan", bossData, 2950, 5300, true);
    return;
  }

  if (currentRegionKey === "R07") {
    const beachMobs = GameDB.Monsters.filter(m => m.region === "R07" && m.zone === "black_beach");
    [[2950, 13400], [3150, 12400], [2850, 11400], [3200, 10400], [2950, 9400]].forEach(([cx, cy], cIdx) => {
      for (let i = 0; i < 7; i++) {
        pushSafeMonster(`r07_beach_${cIdx}_${i}`, beachMobs[i % beachMobs.length], cx + Math.cos(i * 0.9) * 135, cy + Math.sin(i * 0.9) * 135);
      }
    });

    const wreckMobs = GameDB.Monsters.filter(m => m.region === "R07" && m.zone === "shipwreck");
    [[1650, 8250], [2350, 8150], [1950, 7450], [2850, 7850], [1750, 9100]].forEach(([cx, cy], cIdx) => {
      for (let i = 0; i < 7; i++) {
        pushSafeMonster(`r07_wreck_${cIdx}_${i}`, wreckMobs[i % wreckMobs.length], cx + Math.cos(i) * 130, cy + Math.sin(i) * 130);
      }
    });

    const pirateMobs = GameDB.Monsters.filter(m => m.region === "R07" && (m.zone === "pirate_camp" || m.zone === "shipwreck"));
    [[2250, 4450], [3050, 4450], [2650, 5100], [2850, 6100]].forEach(([cx, cy], cIdx) => {
      for (let i = 0; i < 6; i++) {
        pushSafeMonster(`r07_pirate_${cIdx}_${i}`, pirateMobs[i % pirateMobs.length], cx + Math.cos(i) * 145, cy + Math.sin(i) * 145);
      }
    });

    const bossData = GameDB.Monsters.find(m => m.id === 124);
    if (bossData) pushSafeMonster("boss_balenos", bossData, 2720, 3500, true);
    return;
  }

  const regMobs = GameDB.Monsters.filter(m => m.region === currentRegionKey && !m.name.includes("(B)"));
  const bossMob = GameDB.Monsters.find(m => m.region === currentRegionKey && m.name.includes("(B)"));

  if (regMobs.length > 0 && mapData.isSeamlessRegion) {
    const fieldMobs = regMobs.filter(m => m.zone === "field");
    const dungMobs = regMobs.filter(m => m.zone === "dungeon");
    const guardMobs = regMobs.filter(m => m.zone === "boss_camp");

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

function createMonsterInstance(id, baseMob, x, y, forceBoss = false) {
  const isBoss = forceBoss || String(baseMob.name || '').includes("(B)");
  const isElite = !isBoss && Boolean(baseMob.isElite);
  const isMagicMob = (baseMob.type === '마법' || baseMob.type === '혼합' || (baseMob.mp && baseMob.mp > 0));
  const maxMpVal = isMagicMob ? (baseMob.mp && baseMob.mp > 0 ? baseMob.mp : 100) : 0;
  return {
    id: id,
    lv: baseMob.lv || 1,
    name: baseMob.name,
    rawName: baseMob.rawName || baseMob.name,
    type: baseMob.type,
    hp: baseMob.hp,
    maxHp: baseMob.maxHp || baseMob.hp,
    mp: maxMpVal,
    maxMp: maxMpVal,
    atk: baseMob.atk || 10,
    def: baseMob.def || 2,
    baseExp: baseMob.exp || baseMob.baseExp || 20,
    drop: baseMob.drop || [],
    isBoss: isBoss,
    isElite: isElite,
    scaleMult: baseMob.scaleMult || (isElite ? 1.90 : 1.0),
    isAggro: baseMob.aggro === 'Y' || isElite,
    x: x, y: y,
    spawnX: x, spawnY: y,
    targetX: x, targetY: y,
    isDead: false,
    respawnTimer: 0,
    lastAtkTime: 0,
    stunUntil: 0,
    defDownUntil: 0,
    nameTag: null
  };
}

function destroyItemGraphics(it) {
  if (it.pixiSprite) {
    if (it.pixiSprite.parent) it.pixiSprite.parent.removeChild(it.pixiSprite);
    it.pixiSprite.destroy();
    it.pixiSprite = null;
  }
  if (it.nameTag) {
    if (it.nameTag.parent) it.nameTag.parent.removeChild(it.nameTag);
    it.nameTag.destroy();
    it.nameTag = null;
  }
}

function loadMapData(mapKey, customSpawn = null) {
  const db = window.HardcodedMapDB || {};
  let mapData = db[mapKey] || db["R01_sub1"];
  if (!mapData || !window.DetailFieldRenderer) {
    // 🌟 첫 실행 시 ES 모듈 맵 데이터(HardcodedMapDB / DetailFieldRenderer) 로딩 대기 가드
    setTimeout(() => loadMapData(mapKey, customSpawn), 40);
    return;
  }

  currentRegionKey = mapKey.split('_')[0];
  currentMapKey = mapKey;
  currentWorldWidth = mapData.width;
  currentWorldHeight = mapData.height;

  player.isMoving = false;
  player.isWalking = false;
  player.manualMoving = false;
  player.path = [];
  window.clearTarget();

  if ( window.showGameLoadingScreen ) {
    window.showGameLoadingScreen(`🗺️ ${mapData.title || '차원 지역 이동'}`, '지형 오브젝트 및 충돌 영역 구성 중...', 38);
  } else if (fadeOverlay) {
    fadeOverlay.style.opacity = '1';
  }

  if (window._loadMapDataTimerId) {
    clearTimeout(window._loadMapDataTimerId);
    window._loadMapDataTimerId = null;
  }

  window._loadMapDataTimerId = setTimeout(async () => {
    window._loadMapDataTimerId = null;
    window.addChat(`🗺️ [지역 진입] ${mapData.title}`, "log-sys");
    window.showGameLoadingScreen?.(`🗺️ ${mapData.title || '차원 지역 이동'}`, '에테르 필드 지형 및 미니맵 렌더링 중...', 68);
    wallBoxes = [];
    portalBoxes = [];

    npcList.forEach(n => { if (n.nameTag) { if (n.nameTag.parent) n.nameTag.parent.removeChild(n.nameTag); try { n.nameTag.destroy(); } catch (e) {} n.nameTag = null; } });
    monsterList.forEach(m => { if (m.nameTag) { if (m.nameTag.parent) m.nameTag.parent.removeChild(m.nameTag); try { m.nameTag.destroy(); } catch (e) {} m.nameTag = null; } });
    itemList.forEach(it => destroyItemGraphics(it));
    floatingTexts.forEach(ft => { if (ft.pixiText) { if (ft.pixiText.parent) ft.pixiText.parent.removeChild(ft.pixiText); try { ft.pixiText.destroy(); } catch (e) {} ft.pixiText = null; } });
    if (mercenary.nameTag) {
      if (mercenary.nameTag.parent) mercenary.nameTag.parent.removeChild(mercenary.nameTag);
      try { mercenary.nameTag.destroy(); } catch (e) {}
      mercenary.nameTag = null;
    }
    window.clearAllOtherPlayersVisuals?.();

    npcList = [];
    monsterList = [];
    itemList = [];
    floatingTexts = [];
    activeEffects = [];
    projectiles = [];
    bossTelegraphs = [];
    bgLoaded = false;
    bossRespawnTimer = 0;
    window.sweepOrphanPixiVisuals?.();

    await loadRegionTmjPortals(currentRegionKey, mapData.width, mapData.height);

    while (bgContainer.children.length > 0) {
      let child = bgContainer.getChildAt(0);
      bgContainer.removeChild(child);
      child.destroy({ texture: true, baseTexture: true });
    }

    let sortedObjs = [...mapData.objects].sort((a, b) => a[2] - b[2]);
    sortedObjs.forEach(obj => {
      const [type, x, y, w, h, extra] = obj;
      if (type === OBJ.PORTAL) {
        portalBoxes.push({ x: x, y: y, radius: 85, target: extra });
      } else if (type === OBJ.WALL) {
        wallBoxes.push({ x: x, y: y, width: w, height: h });
      } else if (type === OBJ.CAMPFIRE) {
        // 모닥불 돌담 및 불꽃 중심부 충돌 처리 (화염 위를 걷지 못하도록 현실적 차단)
        const cw = (w || 50) * 1.15;
        const ch = (h || w || 50) * 0.88;
        wallBoxes.push({ x: x - cw / 2, y: y - ch / 2, width: cw, height: ch });
      } else if (type === OBJ.WELL) {
        const cw = (w || 90) * 0.82;
        const ch = (h || w || 90) * 0.72;
        wallBoxes.push({ x: x - cw / 2, y: y - ch / 2, width: cw, height: ch });
      } else if (type === OBJ.BOSS_ALTAR) {
        // 보스 제단 네 귀퉁이 석조 기둥 4개 충돌 처리 (중앙 제단 바닥은 이동 가능)
        for (let i = 0; i < 4; i++) {
          const a = (Math.PI / 2) * i + Math.PI / 4;
          const px = x + Math.cos(a) * w * 0.42;
          const py = y + Math.sin(a) * h * 0.35;
          wallBoxes.push({ x: px - 22, y: py - 32, width: 44, height: 44 });
        }
      } else if (type === OBJ.FAIRY_POND) {
        wallBoxes.push({ x: x - w * 0.46, y: y - h * 0.38, width: w * 0.92, height: h * 0.76 });
      } else if ([OBJ.CHIEF_TENT, OBJ.CORRUPTED_WORLD_TREE, OBJ.LUMBER_MILL, OBJ.ANT_HELL_CRATER, OBJ.PHARAOH_PYRAMID, OBJ.PIRATE_CABIN, OBJ.SHIPWRECK, OBJ.FORTRESS_WALL, OBJ.MINE_ENTRANCE, OBJ.RUNE_ALTAR, OBJ.SUNKEN_TEMPLE, OBJ.WATER_THRONE, OBJ.BEAST_DEN, OBJ.TOXIC_ALTAR, OBJ.CRYSTAL_CAVE, OBJ.FROST_THRONE, OBJ.VOLCANO_CONE, OBJ.DEMON_CRATER, OBJ.UNDEAD_CRYPT, OBJ.LICH_CASTLE, OBJ.HARPY_NEST, OBJ.STORMBIRD_ALTAR, OBJ.ARCANE_AIRSHIP, OBJ.TITAN_DOME, OBJ.TORTURE_FORTRESS, OBJ.NETHER_PORTAL, OBJ.DRAKE_NEST, OBJ.DRAGON_LAIR, OBJ.KAELEN_THRONE, OBJ.GOBLIN_CAVE_ENTRANCE].includes(type)) {
        wallBoxes.push({ x: x - w * 0.38, y: y - h * 0.34, width: w * 0.76, height: h * 0.56 });
        if (type === OBJ.PIRATE_CABIN) {
          // 해적 선장실 전면 좌/우 통나무 성책 충돌 처리 (중앙 정문 개구부는 통과 가능)
          wallBoxes.push({ x: x - w * 0.46, y: y + h * 0.08, width: w * 0.34, height: h * 0.24 });
          wallBoxes.push({ x: x + w * 0.12, y: y + h * 0.08, width: w * 0.34, height: h * 0.24 });
        }
      } else if ([OBJ.VILLAGE_HOUSE, OBJ.WINDMILL, OBJ.DESERT_TENT, OBJ.CAMP_TENT, OBJ.FAIRY_MUSHROOM_HOUSE, OBJ.FAIRY_TENT, OBJ.CARAVAN_WAGON, OBJ.SUNKEN_RUINS, OBJ.HARBOR_HOUSE, OBJ.HARBOR_SHIP, OBJ.ELVEN_ARCH, OBJ.SWAMP_TENT, OBJ.ICE_IGLOO, OBJ.RAVEN_TENT, OBJ.TRAINING_RUINS, OBJ.RIFT_GATE].includes(type)) {
        wallBoxes.push({ x: x - w * 0.40, y: y - h * 0.26, width: w * 0.80, height: h * 0.60 });
      } else if ([OBJ.LOG_PILE, OBJ.CARGO_CRATES, OBJ.ANCHOR_WRECK, OBJ.GIANT_RIBCAGE].includes(type)) {
        const cw = (w || 120) * 0.72;
        const ch = (h || 90) * 0.58;
        wallBoxes.push({ x: x - cw / 2, y: y - ch / 2, width: cw, height: ch });
      } else if ([OBJ.OAK_TREE, OBJ.PINE_TREE, OBJ.DEAD_TREE, OBJ.PALM_TREE, OBJ.CACTUS, OBJ.GIANT_MUSHROOM, OBJ.SILVER_VINE_TREE, OBJ.GLOW_TREE].includes(type)) {
        // 나무 밑동 및 줄기 하단 현실적 충돌 처리 (OBJ.DEAD_TREE 고목나무 누락 수정 포함)
        const tw = (w || 90) * 0.44;
        const th = (w || 90) * 0.42;
        wallBoxes.push({ x: x - tw / 2, y: y - th * 0.25, width: tw, height: th });
      } else if ([OBJ.ROCK, OBJ.SEA_STACK, OBJ.ANCIENT_PILLAR, OBJ.BROKEN_PILLAR, OBJ.OBELISK, OBJ.ICE_SPIRE, OBJ.MANA_CRYSTAL, OBJ.ABYSS_CRYSTAL].includes(type)) {
        const rw = (w || 70) * 0.64;
        const rh = (h || w || 70) * 0.50;
        wallBoxes.push({ x: x - rw / 2, y: y - rh / 2, width: rw, height: rh });
      }
    });

    if (Array.isArray(mapData.extraWallBoxes)) {
      mapData.extraWallBoxes.forEach(wb => wallBoxes.push(wb));
    } else if (mapData.isSeamlessRegion && currentRegionKey === 'R01') {
      wallBoxes.push({ x: 0, y: 11480, width: 960, height: 220 });
      wallBoxes.push({ x: 1240, y: 11480, width: 1420, height: 220 });
      wallBoxes.push({ x: 2940, y: 11480, width: 1060, height: 220 });
      wallBoxes.push({ x: 0, y: 4450, width: 2480, height: 260 });
      wallBoxes.push({ x: 2820, y: 4950, width: 1180, height: 260 });
    }

    // 🗺️ [심리스 청크 스트리밍 매니저] 대형 맵(4000x16000)을 청크로 분리하여 플레이어 활동 구역만 로딩/렌더링하고 오차 없이 이음!
    const chunkHeight = 2000;
    const numChunks = Math.ceil(mapData.height / chunkHeight);

    minimapOffscreenCanvas = document.createElement('canvas');
    minimapOffscreenCanvas.width = Math.round(mapData.width / 10);
    minimapOffscreenCanvas.height = Math.round(mapData.height / 10);
    const miniOffCtx = minimapOffscreenCanvas.getContext('2d');
    miniOffCtx.save();
    miniOffCtx.scale(minimapOffscreenCanvas.width / mapData.width, minimapOffscreenCanvas.height / mapData.height);
    if (mapData.isSeamlessRegion) {
      DetailFieldRenderer.drawRegionField(miniOffCtx, mapData.width, mapData.height, currentRegionKey);
    } else {
      miniOffCtx.fillStyle = mapData.bgColor;
      miniOffCtx.fillRect(0, 0, mapData.width, mapData.height);
    }
    sortedObjs.forEach(obj => {
      const [type, x, y, w, h, extra] = obj;
      DetailFieldRenderer.drawCustomObject(miniOffCtx, type, x, y, w, h, extra);
    });
    miniOffCtx.restore();

    if (window.MapChunkManager && typeof window.MapChunkManager.destroyAll === 'function') {
      window.MapChunkManager.destroyAll();
    }

    window.MapChunkManager = {
      chunkHeight,
      numChunks,
      mapWidth: mapData.width,
      mapHeight: mapData.height,
      regionKey: currentRegionKey,
      isSeamlessRegion: Boolean(mapData.isSeamlessRegion),
      bgColor: mapData.bgColor,
      sortedObjs,
      activeSprites: new Map(),
      lastCenterChunk: -999,

      renderChunkIndex(c) {
        if (c < 0 || c >= this.numChunks) return null;
        if (this.activeSprites.has(c)) return this.activeSprites.get(c);

        const startY = Math.floor(c * this.chunkHeight);
        // 청크 경계선 오차(유격/실선) 0%를 위해 하단 2px 심리스 오버랩 블리딩 적용
        const curH = Math.min(this.chunkHeight + 2, this.mapHeight - startY);
        const chunkCanvas = document.createElement('canvas');
        chunkCanvas.width = this.mapWidth;
        chunkCanvas.height = curH;
        const ctx = chunkCanvas.getContext('2d', { alpha: false });

        ctx.save();
        ctx.translate(0, -startY);
        if (this.isSeamlessRegion) {
          DetailFieldRenderer.drawRegionField(ctx, this.mapWidth, this.mapHeight, this.regionKey);
        } else {
          ctx.fillStyle = this.bgColor;
          ctx.fillRect(0, startY, this.mapWidth, curH);
        }

        for (let i = 0; i < this.sortedObjs.length; i++) {
          const [type, x, y, w, h, extra] = this.sortedObjs[i];
          const objSpan = Math.max(w || 200, h || 200) + 380;
          if (y + objSpan < startY || y - objSpan > startY + curH) continue;
          DetailFieldRenderer.drawCustomObject(ctx, type, x, y, w, h, extra);
        }
        ctx.restore();

        const chunkTex = PIXI.Texture.from(chunkCanvas);
        chunkTex.baseTexture.scaleMode = PIXI.SCALE_MODES.NEAREST;
        if (PIXI.MIPMAP_MODES) chunkTex.baseTexture.mipmap = PIXI.MIPMAP_MODES.OFF;
        const chunkSprite = new PIXI.Sprite(chunkTex);
        chunkSprite.x = 0;
        chunkSprite.y = startY;
        chunkSprite._chunkIdx = c;
        bgContainer.addChild(chunkSprite);
        bgContainer.children.sort((a, b) => (a.y || 0) - (b.y || 0));
        this.activeSprites.set(c, chunkSprite);
        return chunkSprite;
      },

      updateActiveChunks(centerY, force = false) {
        const curChunk = Math.max(0, Math.min(this.numChunks - 1, Math.floor((centerY || 0) / this.chunkHeight)));
        if (!force && curChunk === this.lastCenterChunk) return;
        this.lastCenterChunk = curChunk;

        const minLoad = Math.max(0, curChunk - 1);
        const maxLoad = Math.min(this.numChunks - 1, curChunk + 1);
        for (let c = minLoad; c <= maxLoad; c++) {
          this.renderChunkIndex(c);
        }

        // 활동 지역에서 벗어난 원거리 청크는 즉시 GPU/메모리에서 해제하여 장시간 플레이 시 메모리 누적 방지
        for (const [cIdx, spr] of this.activeSprites.entries()) {
          if (cIdx < curChunk - 1 || cIdx > curChunk + 1) {
            if (spr.parent) spr.parent.removeChild(spr);
            try { spr.destroy({ children: true, texture: true, baseTexture: true }); } catch (e) {}
            this.activeSprites.delete(cIdx);
          }
        }
      },

      destroyAll() {
        for (const [, spr] of this.activeSprites.entries()) {
          if (spr.parent) spr.parent.removeChild(spr);
          try { spr.destroy({ children: true, texture: true, baseTexture: true }); } catch (e) {}
        }
        this.activeSprites.clear();
        this.lastCenterChunk = -999;
      }
    };

    const initSpawnRef = customSpawn ? customSpawn : mapData.spawn;
    window.MapChunkManager.updateActiveChunks(initSpawnRef.y, true);

    // 🌟 첫 실행 시 브라우저 WebGL 텍스처 초기화 지연 방지 (2중 안전 보정)
    requestAnimationFrame(() => {
      if (window.MapChunkManager && bgContainer.children.length === 0) {
        window.MapChunkManager.updateActiveChunks(player.y || initSpawnRef.y, true);
      }
    });
    setTimeout(() => {
      if (window.MapChunkManager && bgContainer.children.length === 0) {
        window.MapChunkManager.updateActiveChunks(player.y || initSpawnRef.y, true);
      }
    }, 120);

    bgLoaded = true;

    const rawSpawn = customSpawn ? customSpawn : mapData.spawn;
    const safeSpawn = findSafeSpot(rawSpawn.x, rawSpawn.y);
    player.x = safeSpawn.x;
    player.y = safeSpawn.y;
    player.targetX = safeSpawn.x;
    player.targetY = safeSpawn.y;
    player.portalCooldown = Date.now() + 2000;

    if (mercenary.hired && !mercenary.isDead) {
      mercenary.x = safeSpawn.x - 45;
      mercenary.y = safeSpawn.y + 28;
      mercenary.targetMonster = null;
      mercenary.attackerMonster = null;
    }

    // 🌟 모든 마을(TOWN)과 야영지(CAMP) 거점에 용병단장 카셀 배치 (어디서나 고용 및 부활 가능)
    if (!mapData.isDungeon) {
      const townX = mapData.spawn.x;
      const townY = mapData.spawn.y;
      const reg = GameDB.Regions.find(r => r.id === currentRegionKey) || GameDB.Regions[0];
      const qNpcName = reg.questNpc || "촌장 발렌";

      if (reg.hubType === "CAMP") {
        if (currentRegionKey === "R01") {
          npcList.push({ x: townX, y: townY - 88, name: "📖 왕립 안내관 루시", role: "GUIDE", color: 0xf472b6 });
        }
        npcList.push(
          { x: townX - 180, y: townY - 60,  name: "잡화상인 마르코",     role: "MERCHANT",  color: 0xfde047 },
          { x: townX,       y: townY - 190, name: qNpcName,             role: "QUEST",     color: 0x4ade80 },
          { x: townX + 180, y: townY - 60,  name: "차원술사 아리아",     role: "WORLDMAP",  color: 0x38bdf8 },
          { x: townX - 160, y: townY + 125, name: "마법상인 엘린",       role: "SKILL",     color: 0x60a5fa },
          { x: townX,       y: townY + 145, name: "창고지기 바르크",     role: "BANK",      color: 0xfbbf24 },
          { x: townX + 160, y: townY + 125, name: "용병단장 카셀",       role: "MERCENARY", color: 0xf87171 }
        );
      } else {
        if (currentRegionKey === "R01") {
          npcList.push({ x: townX, y: townY - 95, name: "📖 왕립 안내관 루시", role: "GUIDE", color: 0xf472b6 });
        }
        npcList.push(
          { x: townX,       y: townY - 230, name: qNpcName,             role: "QUEST",     color: 0x4ade80 },
          { x: townX - 210, y: townY - 130, name: "잡화상인 마르코",     role: "MERCHANT",  color: 0xfde047 },
          { x: townX + 210, y: townY - 130, name: "마법상인 엘린",       role: "SKILL",     color: 0x60a5fa },
          { x: townX - 240, y: townY + 20,  name: "창고지기 바르크",     role: "BANK",      color: 0xfbbf24 },
          { x: townX + 240, y: townY + 20,  name: "용병단장 카셀",       role: "MERCENARY", color: 0xf87171 },
          { x: townX - 170, y: townY + 150, name: "주문서상인 카인",     role: "SCROLL",    color: 0xc084fc },
          { x: townX + 170, y: townY + 150, name: "차원술사 아리아",     role: "WORLDMAP",  color: 0x38bdf8 }
        );
      }
    }

    npcList.forEach(npc => {
      const safeNpcPt = findSafeSpot(npc.x, npc.y);
      npc.x = safeNpcPt.x;
      npc.y = safeNpcPt.y;
    });
    if (isServerAuthoritativeMode()) {
      sendCentralWsPacket({
        type: 'CHANGE_MAP',
        charId: activeCharacterId,
        mapKey: currentMapKey,
        regionKey: currentRegionKey,
        player: buildMultiplayerPlayerSnapshot()
      });
      window.regionPlayersCache = [];
      window.requestRegionPlayersRefresh?.();
    } else {
      spawnAltriaMonsters(mapKey, mapData);
    }
    window.updateMercHUD();
    window.forceResizePixiApp?.();
    window.showGameLoadingScreen?.(`🗺️ ${mapData.title || '차원 지역 이동'}`, '서버 월드 실시간 동기화 완료!', 96);

    setTimeout(() => {
      window.forceResizePixiApp?.();
      if (window.hideGameLoadingScreen) {
        window.hideGameLoadingScreen(80);
      } else if (fadeOverlay) {
        fadeOverlay.style.opacity = '0';
      }
    }, 100);
  }, 120);
}

// 🕹️ 좌측 하단 플로팅 가상 조이스틱 상태
const joystickState = {
  pointerId: null,
  startX: 0,
  startY: 0,
  curX: 0,
  curY: 0,
  active: false,
  angle: 0,
  power: 0,
  downEvent: null
};
window.joystickState = joystickState;

function setupVirtualJoystickEvents() {
  if (!app || !app.view) return;
  const view = app.view;
  const baseEl = document.getElementById('joystick-base');
  const knobEl = document.getElementById('joystick-knob');
  const hintEl = document.getElementById('joystick-hint');
  const maxRadius = 40;

  view.addEventListener('pointerdown', (e) => {
    // 첫 터치/클릭 시 오디오 컨텍스트 및 BGM 자동 활성화
    if (window.SoundSystem && !window.SoundSystem.bgmUnlocked) {
      window.SoundSystem.bgmUnlocked = true;
      window.SoundSystem.updateBgmState?.();
    }

    const wm = document.getElementById('world-map-ui');
    const sm = document.getElementById('shire-map-ui');
    if (wm && wm.classList.contains('active-modal')) return;
    if (sm && sm.classList.contains('active-modal')) return;

    const rect = view.getBoundingClientRect();
    const relX = e.clientX - rect.left;
    const relY = e.clientY - rect.top;

    // 화면 좌측 하단 영역(좌측 60%, 하단 72% 영역) 터치 시 조이스틱 대기 시작, 그 외 영역도 pointerup에서 탭 판정하여 NPC(월드맵) 클릭 관통 버그 원천 차단!
    if (joystickState.pointerId === null) {
      joystickState.pointerId = e.pointerId;
      joystickState.startX = relX;
      joystickState.startY = relY;
      joystickState.curX = relX;
      joystickState.curY = relY;
      joystickState.active = false;
      joystickState.power = 0;
      joystickState.canJoystick = (relX <= rect.width * 0.60 && relY >= rect.height * 0.28);
      joystickState.downEvent = { clientX: e.clientX, clientY: e.clientY };
      try { view.setPointerCapture(e.pointerId); } catch (err) {}
    }
  });

  view.addEventListener('pointermove', (e) => {
    if (joystickState.pointerId !== e.pointerId) return;
    const rect = view.getBoundingClientRect();
    const relX = e.clientX - rect.left;
    const relY = e.clientY - rect.top;
    const dx = relX - joystickState.startX;
    const dy = relY - joystickState.startY;
    const dist = Math.hypot(dx, dy);

    // 터치 후 7px 이상 이어서 움직이면 즉시 가상 조이스틱 자동 스타트!
    if (!joystickState.active && joystickState.canJoystick && dist >= 7) {
      joystickState.active = true;
      player.manualMoving = true;
      player.isMoving = false;
      player.path = [];
      if (baseEl) {
        baseEl.style.display = 'block';
        baseEl.style.left = `${joystickState.startX}px`;
        baseEl.style.top = `${joystickState.startY}px`;
      }
      if (hintEl) hintEl.style.opacity = '0.15';
    }

    if (joystickState.active) {
      const clampedDist = Math.min(maxRadius, dist);
      const ang = Math.atan2(dy, dx);
      joystickState.angle = ang;
      joystickState.power = Math.min(1, clampedDist / maxRadius);
      if (knobEl) {
        const kx = Math.cos(ang) * clampedDist;
        const ky = Math.sin(ang) * clampedDist;
        knobEl.style.transform = `translate(${kx}px, ${ky}px)`;
      }
    }
  });

  const endJoystick = (e) => {
    if (joystickState.pointerId !== e.pointerId) return;
    const wasActive = joystickState.active;
    const savedDown = joystickState.downEvent;

    joystickState.pointerId = null;
    joystickState.active = false;
    joystickState.power = 0;
    joystickState.downEvent = null;

    if (baseEl) baseEl.style.display = 'none';
    if (knobEl) knobEl.style.transform = 'translate(0px, 0px)';
    if (hintEl) hintEl.style.opacity = '0.65';

    if (wasActive) {
      player.isWalking = false;
      player.manualMoving = false;
    } else if (savedDown) {
      // 드래그하지 않고 단순 터치만 한 경우 일반 캔버스 클릭(몬스터/NPC/이동) 처리
      processCanvasTap(savedDown);
    }
  };

  view.addEventListener('pointerup', endJoystick);
  view.addEventListener('pointercancel', endJoystick);
}

function handleCanvasClick(e) {
  // setupVirtualJoystickEvents에서 위임 처리하므로 중복 호출 방지
}

let _lastCanvasTapTs = 0;
function processCanvasTap(e) {
  const nowTap = Date.now();
  if (nowTap - _lastCanvasTapTs < 145) return;
  _lastCanvasTapTs = nowTap;

  const wm = document.getElementById('world-map-ui');
  const sm = document.getElementById('shire-map-ui');
  if (wm && wm.classList.contains('active-modal')) return;
  if (sm && sm.classList.contains('active-modal')) return;

  const rect = app.view.getBoundingClientRect();
  const scaleX = (app.renderer.width / app.renderer.resolution) / rect.width;
  const scaleY = (app.renderer.height / app.renderer.resolution) / rect.height;
  const zoom = camera.zoom || 1;

  const clientX = e.clientX !== undefined ? e.clientX : (e.touches?.[0]?.clientX || 0);
  const clientY = e.clientY !== undefined ? e.clientY : (e.touches?.[0]?.clientY || 0);

  const cx = ((clientX - rect.left) * scaleX) / zoom + camera.x;
  const cy = ((clientY - rect.top) * scaleY) / zoom + camera.y;

  if (checkCollision(player.x, player.y)) {
    const rescued = findSafeSpot(player.x, player.y);
    player.x = rescued.x;
    player.y = rescued.y;
  }

  // 필드 위의 타 플레이어 터치 시 힐/버프 아군 지원 대상으로 선택 + 스마트폰용 플로팅 액션바(거래신청/파티/귓속말) 표시
  if (Array.isArray(window.otherPlayers) && window.otherPlayers.length > 0) {
    const clickedOp = window.otherPlayers.find(op => op && !op.gmInvisible && Math.abs((op.x || 0) - cx) < 42 && cy >= (op.y || 0) - 62 && cy <= (op.y || 0) + 22);
    if (clickedOp) {
      window.selectFriendlyOtherPlayer(clickedOp);
      window.showPlayerTargetActionBar?.(clickedOp);
      return;
    }
  }

  // 필드 위의 용병 캐릭터 터치 시 힐/버프 아군 지원 대상으로 선택 (전투 타겟은 유지됨!)
  if (mercenary.hired && !mercenary.isDead && Math.abs(mercenary.x - cx) < 35 && cy >= mercenary.y - 55 && cy <= mercenary.y + 15) {
    window.toggleFriendlyMercTarget();
    return;
  }

  let clickedNpc = npcList.find(npc => Math.abs(npc.x - cx) < 65 && (cy >= npc.y - 75 && cy <= npc.y + 45));
  if (clickedNpc) {
    if (Math.hypot(clickedNpc.x - player.x, clickedNpc.y - player.y) <= 220) {
      player.isMoving = false; player.path = [];
      window.openNpcModal(clickedNpc);
    } else {
      player.targetEntity = { type: 'NPC', ref: clickedNpc };
      player.targetX = clickedNpc.x; player.targetY = clickedNpc.y;
      player.path = window.findPath(player.x, player.y, clickedNpc.x, clickedNpc.y);
      player.isMoving = true; player.manualMoving = false;
    }
    return;
  }

  let clickedMon = monsterList.find(m => !m.isDead && Math.hypot(m.x - cx, m.y - cy) < (m.isBoss ? 70 : (m.isElite ? 62 : 48)));
  if (clickedMon) {
    player.targetEntity = { type: 'MONSTER', ref: clickedMon };
    player.isMoving = false; player.manualMoving = false; player.path = [];
    updateTopTargetUI(clickedMon);
    return;
  }

  let clickedItem = itemList.find(it => Math.hypot(it.x - cx, it.y - cy) < 45);
  if (clickedItem) {
    player.targetEntity = { type: 'ITEM', ref: clickedItem };
    player.path = window.findPath(player.x, player.y, clickedItem.x, clickedItem.y);
    player.isMoving = true; player.manualMoving = false;
    return;
  }

  player.targetEntity = null;
  window.clearTarget();
  const safeDest = findSafeSpot(cx, cy);
  player.targetX = safeDest.x;
  player.targetY = safeDest.y;
  player.path = window.findPath(player.x, player.y, safeDest.x, safeDest.y);
  player.isMoving = true;
  player.manualMoving = true;
}

function updateTopTargetUI(ent) {
  let tUI = document.getElementById('top-target-ui');
  if (!tUI) return;
  if (!ent || ent.isDead) { tUI.style.display = 'none'; return; }
  tUI.style.display = 'flex';
  const prefix = ent.isElite && !String(ent.name || '').includes('거대정예') ? '👑[★거대정예] ' : '';
  document.getElementById('target-name').innerText = `${prefix}${ent.name}`;
  document.getElementById('target-hp-bar').style.width = `${Math.max(0, (ent.hp / ent.maxHp) * 100)}%`;
}


window.loadMapData = loadMapData;