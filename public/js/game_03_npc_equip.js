// js/game_03_npc_equip.js — 마을/야영지 NPC 상점/창고 · 스탯 분배 · 장비창 · 퀵슬롯 드래그
// ============================================================================
// 💬 마을/야영지 NPC 상호작용 창 (서클별 마법상인 습득 & 용병단장 & 최상위 포커스)
// ============================================================================
let currentNpcSkillCircle = 'ALL';

window.setNpcSkillCircle = function(circleVal) {
  currentNpcSkillCircle = circleVal;
  renderNpcSkillMerchantBody();
};

window.learnSkillFromNpc = function(skillId) {
  const mySkills = SKILLS_DB[player.class] || [];
  const sk = mySkills.find(s => s.id === skillId);
  if (!sk) return;
  if (!player.learnedSkills) window.initDefaultLearnedSkills(player.class);
  if (player.learnedSkills.has(sk.id)) {
    window.addChat(`ℹ️ [${sk.name}] 이미 습득한 스킬입니다.`, 'log-sys');
    return;
  }
  if (!sk.npcLearn) {
    window.addChat(`🔒 [${sk.name}] ${sk.circle}서클 상위 기술은 필드/던전 몬스터 사냥 시 드롭되는 마법서·비급서를 통해 습득할 수 있습니다!`, 'log-hit');
    return;
  }
  const reqLv = sk.reqLv || 1;
  if (player.level < reqLv) {
    window.addChat(`🔒 [레벨 부족] '${sk.name}' 스킬은 Lv.${reqLv} 이상부터 습득할 수 있습니다! (현재 Lv.${player.level})`, 'log-hit');
    return;
  }
  const cost = sk.learnGold || 0;
  if (player.gold < cost) {
    window.addChat(`⚠️ [스킬 습득] 골드가 부족합니다! (필요: ${cost} G)`, 'log-hit');
    return;
  }
  player.gold -= cost;
  player.learnedSkills.add(sk.id);
  recalcMaxHpMp(true);
  window.addChat(`✨ [스킬 습득 완료!] '${sk.name} (${sk.circle ? sk.circle + '서클' : '패시브'})' 기술을 배웠습니다!`, 'log-kill');
  window.triggerAutoSave?.('skill_learn', true);
  updateStatusHUD();
  renderNpcSkillMerchantBody();
  if (!document.getElementById('skill-ui').classList.contains('hidden')) {
    window.renderSkills();
  }
};

function renderNpcSkillMerchantBody() {
  const bodyEl = document.getElementById('npc-modal-body');
  if (!bodyEl) return;
  if (!player.learnedSkills) window.initDefaultLearnedSkills(player.class);

  const mySkills = SKILLS_DB[player.class] || [];
  const circles = Array.from(new Set(mySkills.map(s => s.circle || 0))).sort((a, b) => a - b);

  let tabHtml = `<div style="display:flex; gap:3px; flex-wrap:wrap; margin-bottom:5px;">`;
  tabHtml += `<button class="circle-tab-btn ${currentNpcSkillCircle === 'ALL' ? 'active' : ''}" onclick="setNpcSkillCircle('ALL')">전체</button>`;
  circles.forEach(c => {
    const label = c === 0 ? '패시브' : `${c}서클`;
    tabHtml += `<button class="circle-tab-btn ${String(currentNpcSkillCircle) === String(c) ? 'active' : ''}" onclick="setNpcSkillCircle('${c}')">${label}</button>`;
  });
  tabHtml += `</div>`;

  const npcRuleDesc = player.class === 'wizard'
    ? '마법사는 <b>1~2서클</b>을 NPC에게 배우고, <b>3~6서클</b>은 몬스터 마법서 드롭으로 습득합니다.'
    : `${CLASS_STATS[player.class].name}는 <b>패시브·1서클</b>을 NPC에게 배우고, <b>2~3서클</b>은 몬스터 비급서 드롭으로 습득합니다.`;

  let html = `
    <div style="font-size:10px; color:#93c5fd; margin-bottom:5px; display:flex; justify-content:space-between; align-items:center;">
      <span>${npcRuleDesc}</span>
      <button class="shop-buy-btn" style="padding:3px 6px; font-size:9.5px;" onclick="openSkillBookFromNpc()">📕 내 스킬북</button>
    </div>
    ${tabHtml}
    <div class="shop-list">
  `;

  const filtered = currentNpcSkillCircle === 'ALL'
    ? mySkills
    : mySkills.filter(s => String(s.circle || 0) === String(currentNpcSkillCircle));

  let lastCircleHeader = -1;
  filtered.forEach(sk => {
    const cNum = sk.circle || 0;
    if (currentNpcSkillCircle === 'ALL' && cNum !== lastCircleHeader) {
      lastCircleHeader = cNum;
      const cTitle = cNum === 0 ? '🛡️ 패시브 (상시 효과 - NPC 습득)' : `✨ ${cNum}서클 (${sk.npcLearn ? 'NPC 습득 가능' : `몬스터 마법서/비급 드롭 Lv.${sk.dropMinLv || 15}+`})`;
      html += `<div style="font-size:10px; font-weight:bold; color:#fde047; background:#272015; padding:3px 6px; border-left:3px solid #facc15; border-radius:3px; margin-top:2px;">${cTitle}</div>`;
    }

    const isLearned = player.learnedSkills.has(sk.id);
    const reqLv = sk.reqLv || 1;
    const circleBadge = sk.circle ? `${sk.circle}서클` : `패시브·Lv.${reqLv}`;
    let rightSide = '';
    if (isLearned) {
      rightSide = `<span style="font-size:10px; color:#4ade80; font-weight:bold; white-space:nowrap;">습득 완료 ✔️</span>`;
    } else if (sk.npcLearn) {
      const cost = sk.learnGold || 0;
      if (player.level < reqLv) {
        rightSide = `<span style="font-size:9px; color:#fbbf24; background:#272015; border:1px solid #b45309; padding:2px 5px; border-radius:4px; white-space:nowrap;">🔒 Lv.${reqLv} 해금<br>(💰${cost}G)</span>`;
      } else {
        rightSide = `<button class="shop-buy-btn" style="background:#15803d; border-color:#4ade80;" onclick="learnSkillFromNpc('${sk.id}')">${cost > 0 ? `💰${cost}G 습득` : '무료 습득'}</button>`;
      }
    } else {
      rightSide = `<span style="font-size:9px; color:#fca5a5; background:#2a1215; border:1px solid #7f1d1d; padding:2px 5px; border-radius:4px; white-space:nowrap;">🔒 몬스터 드롭<br>(Lv.${sk.dropMinLv || 15}+)</span>`;
    }

    html += `
      <div class="shop-row" style="${isLearned ? '' : (sk.npcLearn ? 'border-color:#60a5fa;' : 'opacity:0.85;')}">
        <div style="display:flex; align-items:center; gap:7px; min-width:0; flex:1;">
          ${window.getSkillIconHTML(sk.name, 30)}
          <div style="min-width:0; flex:1;">
            <div style="font-weight:bold; color:#facc15; font-size:11px;">[${circleBadge}] ${sk.name} <span style="font-size:9px; color:#38bdf8;">(${sk.type}/${sk.range || '본인'})</span></div>
            <div style="font-size:9.5px; color:#d1d5db;">${sk.effect} ${sk.mp ? `| MP:${sk.mp}` : ''} | 쿨:${sk.cool || 0}s</div>
          </div>
        </div>
        ${rightSide}
      </div>
    `;
  });

  html += `</div>`;
  bodyEl.innerHTML = html;
}

window.openSkillBookFromNpc = function() {
  const skUi = document.getElementById('skill-ui');
  if (!skUi) return;
  skUi.classList.remove('hidden');
  window.bringModalToFront?.(skUi);
  window.renderSkills(currentSkillTab);
  window.centerModalOnScreen?.(skUi);
};

window.openNpcModal = function(npc) {
  ensureAllGameModals();

  if (npc.role === 'WORLDMAP') {
    window.openWorldMapUI();
    return;
  }

  const modal = document.getElementById('npc-modal-ui');
  const titleEl = document.getElementById('npc-modal-title');
  const bodyEl = document.getElementById('npc-modal-body');
  if (!modal || !titleEl || !bodyEl) return;

  const helpTopicMap = {
    SKILL: 'skill',
    MERCENARY: 'merc',
    QUEST: 'quest',
    BANK: 'bank',
    SCROLL: 'scroll',
    MERCHANT: 'merchant',
    GUIDE: 'guide'
  };
  const helpTopic = helpTopicMap[npc.role] || 'inventory';
  titleEl.innerHTML = `💬 ${npc.name} <button class="help-q-btn" onclick="showHelpModal('${helpTopic}', event)" title="도움말">?</button>`;
  bodyEl.innerHTML = '';
  modal.classList.remove('hidden');
  window.bringModalToFront?.(modal);
  setTimeout(() => window.centerModalOnScreen?.(modal), 0);

  if (npc.role === 'GUIDE') {
    window.addChat(`💬 [${npc.name}] "모험가님 환영합니다! 기초 조작부터 용병 보급·카이팅, 서클 마법, 장비 강화, 파티 점사, 몬스터 도감까지 안내해 드릴게요!"`, 'log-chat', 'chat');
    window.renderBeginnerGuideNpcBody('basic');
    return;
  }
  else if (npc.role === 'BANK') {
    window.addChat(`💬 [${npc.name}] "계정 내 모든 캐릭터가 함께 공유하는 통합 창고입니다. 물품과 골드를 안전하게 보관해 드리지요."`, 'log-chat', 'chat');
    window.renderBankWarehouseModal?.();
  }
  else if (npc.role === 'MERCENARY') {
    window.addChat(`💬 [${npc.name}] "용병단에 온 것을 환영하네! 든든한 정예 용병 1명을 고용하거나 반환·부활시킬 수 있다네!"`, 'log-chat', 'chat');
    const reviveCost = getMercReviveCost();
    let html = `
      <div style="font-size:10px; color:#fde047; margin-bottom:5px; display:flex; justify-content:space-between; align-items:center;">
        <span><b>[정예 용병 관리소]</b> 보유 골드: 💰<b>${player.gold.toLocaleString()} G</b></span>
        <button class="shop-buy-btn" style="padding:2px 6px; font-size:9.5px; background:#1e3a8a; border-color:#60a5fa;" onclick="openNpcModal({name:'마법상인 엘린', role:'SKILL'})">📘 기초마법/비급 습득</button>
      </div>
    `;

    if (mercenary.hired) {
      const curMeta = MERC_CLASS_META[mercenary.class] || MERC_CLASS_META.knight;
      html += `
        <div class="shop-row" style="border-color:${mercenary.isDead ? '#ef4444' : '#4ade80'}; margin-bottom:5px; background:#1c1917; flex-wrap:wrap;">
          <div style="min-width:0; flex:1;">
            <div style="font-weight:bold; color:#fff; font-size:11px;">동행 용병: ${window.getClassIconHTML ? window.getClassIconHTML(mercenary.class, 15) : curMeta.icon} ${normalizeMercenaryDisplayName(mercenary.name, mercenary.class)} (Lv.${mercenary.level})</div>
            <div style="font-size:9.5px; color:${mercenary.isDead ? '#fca5a5' : '#4ade80'};">상태: ${mercenary.isDead ? '💀 전사 (부활 필요)' : `● 생존 (HP ${Math.ceil(mercenary.hp)}/${mercenary.maxHp})`}</div>
            <div style="font-size:8.5px; color:#93c5fd; margin-top:1px;">※ 다른 용병으로 바꾸려면 먼저 [🔄 용병 반환]을 진행하세요.</div>
          </div>
          <div style="display:flex; gap:4px; flex-shrink:0;">
            ${mercenary.isDead
              ? `<button class="shop-buy-btn" style="background:#dc2626; border-color:#fca5a5;" onclick="reviveMercenary()">✨ 부활 (${reviveCost}G)</button>`
              : `<button class="shop-buy-btn" style="background:#1e3a8a; border-color:#60a5fa;" onclick="toggleMercUI()">🎒 관리창</button>`}
            <button class="shop-buy-btn" style="background:#7f1d1d; border-color:#f87171;" onclick="requestReturnMercenary()">🔄 용병 반환</button>
          </div>
        </div>
      `;
    }

    html += `<div class="shop-list">`;
    const startWeapMap = GameDB.SystemConfig?.startWeaponsByClass || { knight: 'W_SW01', ranger: 'W_BW01', wizard: 'W_ST01' };
    Object.keys(MERC_CLASS_META).forEach(cKey => {
      const m = MERC_CLASS_META[cKey];
      const isCurrent = mercenary.hired && mercenary.class === cKey;
      const cost = m.hireCost;
      const defaultWeapName = window.itemDict?.[startWeapMap[cKey]]?.name || '기본 무기';
      let actionHtml = '';
      if (isCurrent) {
        actionHtml = `<span style="font-size:10px; color:#4ade80; font-weight:bold; white-space:nowrap;">고용중 ✔️</span>`;
      } else if (mercenary.hired) {
        actionHtml = `<button class="shop-buy-btn" style="background:#374151; border-color:#6b7280; color:#d1d5db;" onclick="requestReturnMercenary()">🔄 반환 후 고용</button>`;
      } else {
        actionHtml = `<button class="shop-buy-btn" onclick="requestHireMercenary('${cKey}')">💰 ${cost}G 고용</button>`;
      }
      html += `
        <div class="shop-row" style="${isCurrent ? 'border-color:#facc15;' : ''}">
          <div>
            <div style="font-weight:bold; color:#fde047; font-size:11px;">${window.getClassIconHTML ? window.getClassIconHTML(cKey, 15) : m.icon} ${normalizeMercenaryDisplayName(m.name, cKey)} <span style="font-size:9.5px; color:#93c5fd;">[${m.roleName}]</span></div>
            <div style="font-size:9px; color:#d1d5db;">${m.desc}</div>
            <div style="font-size:8.5px; color:#86efac;">🗡️ 기본 장착 지급: ${defaultWeapName}${cKey === 'knight' ? ' + 나무 방패' : ''}</div>
          </div>
          ${actionHtml}
        </div>
      `;
    });

    html += `
      <div class="shop-row" style="margin-top:3px;">
        <div>
          <div style="font-weight:bold; color:#fde047; font-size:11px;">⚔️ 용병단장의 전술 축복 (300 G)</div>
          <div style="font-size:9.5px; color:#d1d5db;">5분간 플레이어 & 용병 공·방·공이속 강화</div>
        </div>
        <button class="shop-buy-btn" onclick="requestMercenaryBless()">💰 300G 축복</button>
      </div>
    </div>`;
    bodyEl.innerHTML = html;
  }
  else if (npc.role === 'MERCHANT') {
    const reg = GameDB.Regions.find(r => r.id === currentRegionKey);
    const isCamp = reg && reg.hubType === 'CAMP';
    window.addChat(`💬 [${npc.name}] "모험에 필요한 물약과 기본 장비를 구비하고 있네!"`, 'log-chat', 'chat');
    const shopItems = [...(GameDB.Shops?.generalItems || ['C_P01', 'C_P02', 'C_P03', 'C_P04', 'C_P05', 'S_RE01', 'W_SW01', 'W_SW02', 'W_BW01', 'W_BW02', 'W_ST01', 'W_ST02', 'W_SH01', 'A_HE01', 'A_TS01', 'A_AR01', 'A_AR02', 'A_GL01', 'A_BE01', 'A_SH01', 'A_CL01', 'AC_N01', 'AC_E01', 'AC_R01'])];
    if (isCamp) shopItems.push(...(GameDB.Shops?.campExtraItems || ['S_WE01', 'S_AR01']));
    let html = `<div style="font-size:10.5px; color:#fde047; margin-bottom:5px;">보유 골드: 💰<span id="shop-gold-txt">${Number(player.gold || 0).toLocaleString()}</span> G</div><div class="shop-list">`;
    shopItems.forEach(id => {
      const it = window.itemDict[id];
      if (!it || it.questOnly) return;
      const unitPrice = it.price || 100;
      const dynEff = it.healHp ? `HP ${it.healHp} 즉시 회복 (쿨 ${it.cool ?? 0.5}초)` : (it.healMp ? `MP ${it.healMp} 즉시 회복 (쿨 ${it.cool ?? 0.5}초)` : (it.effect || ''));
      const defWithMDef = it.def ? `방어+${it.def}${it.mDef ? `·마방+${it.mDef}` : ''}` : (it.mDef ? `마방+${it.mDef}` : dynEff);
      const statTxt = it.pAtk ? `공격+${it.pAtk} (${it.atkSpeed || 1.0}s)` : (it.mAtk ? `마공+${it.mAtk} (${it.atkSpeed || 1.4}s)` : defWithMDef);
      html += `
        <div class="shop-row">
          <div style="display:flex; align-items:center; gap:8px; min-width:0; flex:1;">
            ${window.getItemIconHTML(id)}
            <div style="min-width:0; flex:1;">
              <div style="font-weight:bold; color:#fff; font-size:11px; display:flex; align-items:center; gap:5px; flex-wrap:wrap;">
                <span>[일반] ${it.name}</span>
                <span style="color:#fde047; font-size:10px; font-weight:800; background:rgba(250,204,21,0.12); border:1px solid rgba(250,204,21,0.4); padding:0 4px; border-radius:3px;">💰${unitPrice.toLocaleString()}G</span>
              </div>
              <div style="font-size:9.5px; color:#9ca3af;">${statTxt}</div>
            </div>
          </div>
          <div style="display:flex; gap:2px; margin-top:4px; flex-shrink:0;">
            <button class="shop-buy-btn" title="${unitPrice.toLocaleString()}G" onclick="buyShopItem('${id}', ${unitPrice}, 1)">x1</button>
            <button class="shop-buy-btn" title="${(unitPrice * 10).toLocaleString()}G" onclick="buyShopItem('${id}', ${unitPrice}, 10)">x10</button>
            <button class="shop-buy-btn" style="background:#dc2626;" title="${(unitPrice * 50).toLocaleString()}G" onclick="buyShopItem('${id}', ${unitPrice}, 50)">x50</button>
          </div>
        </div>
      `;
    });
    html += `</div>`;
    bodyEl.innerHTML = html;
  }
  else if (npc.role === 'SCROLL') {
    window.addChat(`💬 [${npc.name}] "무기는 +6까지, 방어구와 장신구는 +4까지 100% 안전하게 강화할 수 있는 마법 주문서라네!"`, 'log-chat', 'chat');
    const scrollItems = [...(GameDB.Shops?.scrollShopItems || ['S_RE01', 'S_WE01', 'S_AR01'])];
    let html = `<div style="font-size:10.5px; color:#c084fc; margin-bottom:5px;">보유 골드: 💰<span id="shop-gold-txt">${Number(player.gold || 0).toLocaleString()}</span> G</div><div class="shop-list">`;
    scrollItems.forEach(id => {
      const it = window.itemDict[id];
      if (!it) return;
      const sPrice = it.price || 500;
      html += `
        <div class="shop-row">
          <div style="display:flex; align-items:center; gap:8px; min-width:0; flex:1;">
            ${window.getItemIconHTML(id)}
            <div style="min-width:0; flex:1;">
              <div style="font-weight:bold; color:#fde047; font-size:11px; display:flex; align-items:center; gap:5px; flex-wrap:wrap;">
                <span>${it.name}</span>
                <span style="color:#fef08a; font-size:10px; font-weight:800; background:rgba(250,204,21,0.14); border:1px solid rgba(250,204,21,0.45); padding:0 4px; border-radius:3px;">💰${sPrice.toLocaleString()}G</span>
              </div>
              <div style="font-size:9.5px; color:#d1d5db;">${it.effect}</div>
            </div>
          </div>
          <div style="display:flex; gap:2px; margin-top:4px; flex-shrink:0;">
            <button class="shop-buy-btn" title="${sPrice.toLocaleString()}G" onclick="buyShopItem('${id}', ${sPrice}, 1)">x1</button>
            <button class="shop-buy-btn" title="${(sPrice * 10).toLocaleString()}G" onclick="buyShopItem('${id}', ${sPrice}, 10)">x10</button>
            <button class="shop-buy-btn" style="background:#dc2626;" title="${(sPrice * 50).toLocaleString()}G" onclick="buyShopItem('${id}', ${sPrice}, 50)">x50</button>
          </div>
        </div>
      `;
    });
    html += `</div>`;
    bodyEl.innerHTML = html;
  }
  else if (npc.role === 'SKILL') {
    window.addChat(`💬 [${npc.name}] "기초 서클 마법과 기술은 이곳에서 전수받을 수 있고, 고위 서클 비전서는 몬스터를 토벌해 얻을 수 있다네."`, 'log-chat', 'chat');
    currentNpcSkillCircle = 'ALL';
    renderNpcSkillMerchantBody();
  }
  else if (npc.role === 'QUEST') {
    window.addChat(`💬 [${npc.name}] "각 지역의 마지막 보스 임무를 완수하면 상점·드롭으로 구할 수 없는 [퀘스트전용] 고성능 무기를 하사하겠네!"`, 'log-chat', 'chat');
    bodyEl.innerHTML = buildQuestListHTML(true);
    setTimeout(() => window.focusLastActiveQuestRow?.(), 40);
  }
};

let currentGuideTab = 'basic';
window.renderBeginnerGuideNpcBody = function(tabKey = 'basic') {
  currentGuideTab = tabKey || currentGuideTab || 'basic';
  const bodyEl = document.getElementById('npc-modal-body');
  if (!bodyEl) return;

  const tabs = [
    { key: 'basic', label: '🕹️ 조작·자동사냥' },
    { key: 'class', label: '⚔️ 직업·스킬·스탯' },
    { key: 'merc',  label: '🛡️ 용병·전술·보급' },
    { key: 'equip', label: '✨ 장비·강화·가방' },
    { key: 'party', label: '🎗️ 파티·보스·월드' },
    { key: 'ether', label: '📖 몬스터 도감' }
  ];

  const tabBarHtml = `
    <div style="display:grid; grid-template-columns:repeat(3, 1fr); gap:4px; margin-bottom:6px;">
      ${tabs.map(t => `
        <button type="button" onclick="renderBeginnerGuideNpcBody('${t.key}')"
          style="padding:5px 4px; border-radius:5px; font-size:11px; font-weight:bold; cursor:pointer; border:1px solid ${currentGuideTab === t.key ? '#facc15' : '#3d3020'}; background:${currentGuideTab === t.key ? '#78350f' : '#141210'}; color:${currentGuideTab === t.key ? '#fde047' : '#d1d5db'};">
          ${t.label}
        </button>
      `).join('')}
    </div>
  `;

  let contentHtml = '';
  if (currentGuideTab === 'basic') {
    contentHtml = `
      <div style="display:flex; flex-direction:column; gap:6px; font-size:12px; line-height:1.55; color:#f3f4f6;">
        <div style="background:#161922; border:1px solid #4a3b2c; border-radius:6px; padding:7px 9px;">
          <div style="color:#fde047; font-weight:bold; font-size:12.5px; margin-bottom:3px;">1️⃣ 이동 · 타겟팅 · 자동사냥</div>
          • <b>이동 조작</b>: 화면 좌하단 드래그(가상 조이스틱) 또는 바닥 터치/방향키(WASD)로 이동합니다.<br>
          • <b>자동사냥(AUTO)</b>: 우하단 <b>[⚔️자동]</b> 버튼을 켜면 주변 몬스터 추적·공격 및 아이템 루팅을 자동으로 수행합니다.<br>
          • <b>🧭 퀘스트 방향 안내</b>: 진행 중인 퀘스트 지역에 있으면 캐릭터 주변에 연한 노란 화살표가 목표(몬스터/NPC) 방향을 가리킵니다 (옵션에서 ON/OFF).
        </div>
        <div style="background:#161922; border:1px solid #4a3b2c; border-radius:6px; padding:7px 9px;">
          <div style="color:#38bdf8; font-weight:bold; font-size:12.5px; margin-bottom:3px;">2️⃣ 퀵슬롯 등록 & 스킬/물약 자동 발동</div>
          • <b>슬롯 등록</b>: 가방(물약/주문서)이나 스킬북에서 항목을 터치한 뒤 하단 퀵슬롯(1~0)을 터치하거나 드래그해 등록합니다.<br>
          • <b>⚡ 자동 사용 설정</b>: 하단 퀵슬롯 아이콘을 <b>위로 스와이프(또는 마우스 우클릭)</b>하면 붉은 테두리가 켜지며 사냥 중 자동으로 물약 복용·버프·공격스킬을 시전합니다!
        </div>
        <div style="background:#161922; border:1px solid #4a3b2c; border-radius:6px; padding:7px 9px;">
          <div style="color:#4ade80; font-weight:bold; font-size:12.5px; margin-bottom:3px;">3️⃣ 미니맵 클릭 → 지역 상세 지도</div>
          • 우상단 <b>미니맵</b>이나 지역명 배지를 터치하면 현재 지역의 <b>거점(S/S1)·사냥터·보스(B)·던전(D)</b> 구조와 내 위치를 한눈에 볼 수 있습니다.
        </div>
      </div>
    `;
  } else if (currentGuideTab === 'class') {
    contentHtml = `
      <div style="display:flex; flex-direction:column; gap:6px; font-size:12px; line-height:1.55; color:#f3f4f6;">
        <div style="background:#161922; border:1px solid #4a3b2c; border-radius:6px; padding:7px 9px;">
          <div style="color:#fde047; font-weight:bold; font-size:12.5px; margin-bottom:3px;">⚔️ 3대 클래스 & 핵심 스탯</div>
          • <b>인간전사 (주스탯 STR / 보조 CON)</b>: 검·방패 착용, 높은 체력과 방패 블록률을 자랑합니다. <b>배쉬(기절)·휠윈드(광역)·차지(돌진)</b>와 방어 버프 <b>아이언 월·배틀 크라이</b>로 선봉을 지킵니다.<br>
          • <b>엘프궁수 (주스탯 DEX / 보조 CON)</b>: 양손활 원거리 고속 사격·치명타·회피에 특화되며, <b>멀티샷·애로우 레인·네이처스 터치(자가/아군 치유)</b>를 사용합니다.<br>
          • <b>엘프마법사 (주스탯 INT / 보조 CON)</b>: 1~6서클 원소 광역 마법과 <b>힐링·그레이터 힐·쉴드·헤이스트·이뮨 투 함</b>으로 파티와 용병을 지원합니다.
        </div>
        <div style="background:#161922; border:1px solid #4a3b2c; border-radius:6px; padding:7px 9px;">
          <div style="color:#60a5fa; font-weight:bold; font-size:12.5px; margin-bottom:3px;">📕 서클 기술 습득 & [미습득] 표시</div>
          • <b>기초 기술</b>: 마을의 <b>마법상인 엘린</b>에게서 골드로 즉시 습득합니다.<br>
          • <b>상위 서클 기술</b>: 필드·던전 몬스터가 드롭하는 <b>마법서/비급서</b>로 습득하며, 내가 아직 배우지 못한 책은 가방 슬롯에 초록색 <b>[미습득]</b> 표시가 뜹니다!
        </div>
      </div>
    `;
  } else if (currentGuideTab === 'merc') {
    contentHtml = `
      <div style="display:flex; flex-direction:column; gap:6px; font-size:12px; line-height:1.55; color:#f3f4f6;">
        <div style="background:#161922; border:1px solid #4a3b2c; border-radius:6px; padding:7px 9px;">
          <div style="color:#fde047; font-weight:bold; font-size:12.5px; margin-bottom:3px;">🛡️ 정예 용병 고용 & ⚡아이템 자동 보급</div>
          • 마을/야영지의 <b>용병단장 카셀</b>에게서 전사·궁수·마법사 용병 중 1명을 고용할 수 있습니다.<br>
          • 용병 관리창(또는 가방)의 <b>[⚡아이템보급]</b> 버튼을 누르면 플레이어 가방에 있는 장비 중 현재 용병 장비보다 좋은 장비를 자동으로 가져와 착용합니다!
        </div>
        <div style="background:#161922; border:1px solid #4a3b2c; border-radius:6px; padding:7px 9px;">
          <div style="color:#4ade80; font-weight:bold; font-size:12.5px; margin-bottom:3px;">🏃 용병 전술 카이팅 & 위기 생존 AI</div>
          • <b>카이팅 & 점사</b>: 몬스터가 용병에게 접근하면 피격 전에 먼저 회피 기동을 수행한 뒤 플레이어의 타겟을 함께 점사합니다 (궁수/마법사는 플레이어가 공격하기 좋은 각도로 원을 그리며 회피).<br>
          • <b>위기 생존</b>: 물약이 떨어지고 체력이 <b>20% 이하</b>가 되면 무리하게 싸우지 않고 플레이어 주변을 돌며 생존 기동을 수행합니다.
        </div>
      </div>
    `;
  } else if (currentGuideTab === 'equip') {
    contentHtml = `
      <div style="display:flex; flex-direction:column; gap:6px; font-size:12px; line-height:1.55; color:#f3f4f6;">
        <div style="background:#161922; border:1px solid #4a3b2c; border-radius:6px; padding:7px 9px;">
          <div style="color:#fde047; font-weight:bold; font-size:12.5px; margin-bottom:3px;">✨ 안전 강화 구간 (+6 / +4) & 각성</div>
          • <b>무기 강화</b>: <b>+6까지 100% 안전 강화</b> | +7(방관+5%), +9(쿨감-8%), +10 이상(보스추뎀+10%)<br>
          • <b>방어구/장신구</b>: <b>+4까지 100% 안전 강화</b> | +7(피감+3%), +9(쿨감-2%), +10 이상(보스피감+4%·올스탯+1)<br>
          • 중반 지역 이후부터는 적정 등급 장비를 착용하고 안전 강화(+6/+4)를 맞추면 물약 소모를 크게 줄이며 쾌적하게 사냥할 수 있습니다!
        </div>
        <div style="background:#161922; border:1px solid #4a3b2c; border-radius:6px; padding:7px 9px;">
          <div style="color:#38bdf8; font-weight:bold; font-size:12.5px; margin-bottom:3px;">🎒 가방 다중 판매 · 수량 선택 판매</div>
          • 단건 판매 시 화면 암전 없이 부드러운 <b>수량 선택창</b>이 뜨며, <b>[다중 선택]</b> 체크 후 여러 아이템과 중첩 수량을 한 번에 일괄 판매할 수 있습니다.
        </div>
      </div>
    `;
  } else if (currentGuideTab === 'party') {
    contentHtml = `
      <div style="display:flex; flex-direction:column; gap:6px; font-size:12px; line-height:1.55; color:#f3f4f6;">
        <div style="background:#161922; border:1px solid #4a3b2c; border-radius:6px; padding:7px 9px;">
          <div style="color:#fde047; font-weight:bold; font-size:12.5px; margin-bottom:3px;">🎗️ 파티 사냥 (자유사냥 vs 점사모드)</div>
          • <b>자동사냥 유지 초대</b>: 파티 요청이 와도 자동사냥이 끊기지 않으며, 10초 무반응 시 초대창이 자동 종료됩니다.<br>
          • <b>🎯 점사모드</b>: 파티장이 점사모드 선택 시 모든 파티원과 용병이 파티장의 타겟을 최우선으로 함께 공격하여 보스와 정예 몬스터를 빠르게 제압합니다!
        </div>
        <div style="background:#161922; border:1px solid #4a3b2c; border-radius:6px; padding:7px 9px;">
          <div style="color:#86efac; font-weight:bold; font-size:12.5px; margin-bottom:3px;">🌐 전 유저 실시간 서버 시간대 동기화</div>
          • 모든 플레이어와 몬스터·보스·차원 마나 기류(날씨)는 동일한 서버 시간대를 공유하며 실시간 동기화됩니다.
        </div>
      </div>
    `;
  } else if (currentGuideTab === 'ether') {
    contentHtml = `
      <div style="display:flex; flex-direction:column; gap:6px; font-size:12px; line-height:1.52; color:#f3f4f6;">
        <div style="background:#161922; border:1px solid #4a3b2c; border-radius:6px; padding:7px 9px;">
          <div style="color:#fde047; font-weight:bold; font-size:12.5px; margin-bottom:3px;">📖 지역별 몬스터 · 드롭 도감</div>
          • 우상단 미니맵 아래의 <b>[📖 몬스터 도감]</b> 버튼을 누르면 15개 지역의 출현 몬스터·보스 정보와 <b>드롭 장비·마법서</b>를 한눈에 확인할 수 있습니다.<br>
          • 현재 지역의 몬스터는 도감에서 <b>[📍이동]</b> 버튼을 눌러 서식 위치로 바로 찾아갈 수 있습니다.
        </div>
        <div style="background:#161922; border:1px solid #4a3b2c; border-radius:6px; padding:7px 9px;">
          <div style="color:#38bdf8; font-weight:bold; font-size:12.5px; margin-bottom:3px;">★거대 몬스터 & 💰행운 보너스 골드</div>
          • 사냥터에서 일반 몬스터보다 약 2배 거대한 <b>[★거대 몬스터]</b>가 자연스럽게 출현하며, 처치 시 <b>경험치·골드 2배 이상 및 높은 장비 드롭률</b>을 제공합니다.<br>
          • 일반 사냥 중에도 일정 확률로 <b>💰행운 보너스 골드</b>가 즉시 지급됩니다.
        </div>
        <button type="button" class="auth-primary-btn" style="padding:7px; font-size:12px;" onclick="closeNpcModal(); window.toggleImmersive20Modal && window.toggleImmersive20Modal();">📖 몬스터 · 드롭 도감 바로 열기</button>
      </div>
    `;
  }

  bodyEl.innerHTML = `
    <div style="padding:2px 2px 4px 2px;">
      ${tabBarHtml}
      <div style="max-height:46dvh; overflow-y:auto; padding-right:2px;">
        ${contentHtml}
      </div>
    </div>
  `;
};

// 📦 계정 공유 창고 상태 (같은 계정의 모든 캐릭터가 공유)
window.accountStorage = window.accountStorage || {
  bankGold: 0,
  bankItems: Array(GameDB.SupabaseConfig?.maxStorageSlots || 60).fill(null)
};

window.renderBankWarehouseModal = function() {
  const bodyEl = document.getElementById('npc-modal-body');
  if (!bodyEl) return;
  const maxSlots = GameDB.SupabaseConfig?.maxStorageSlots || 60;
  if (!Array.isArray(window.accountStorage.bankItems)) {
    window.accountStorage.bankItems = Array(maxSlots).fill(null);
  }
  while (window.accountStorage.bankItems.length < maxSlots) {
    window.accountStorage.bankItems.push(null);
  }
  player.bankGold = window.accountStorage.bankGold || 0;

  const usedBankCount = window.accountStorage.bankItems.filter(Boolean).length;
  const eqSet = new Set(Object.values(player.equip || {}).filter(v => v !== null && v !== undefined).map(Number));

  // 창고 슬롯 HTML
  let bankGridHtml = '';
  for (let i = 0; i < maxSlots; i++) {
    const inst = window.accountStorage.bankItems[i];
    if (!inst) {
      bankGridHtml += `<div class="inv-slot" style="width:36px; height:36px; opacity:0.38;"></div>`;
      continue;
    }
    const def = window.itemDict[inst.type] || { name: inst.type };
    const bdCol = def.questOnly ? '#e879f9' : (inst.gradeColor || '#475569');
    const plusBadge = (inst.plus && inst.plus > 0) ? `<span style="position:absolute; top:0; right:1px; font-size:8px; font-weight:bold; color:#fde047; background:rgba(0,0,0,0.8); padding:0 2px; border-radius:2px;">+${inst.plus}</span>` : '';
    const qtyBadge = (inst.qty && inst.qty > 1) ? `<span class="qty">${inst.qty}</span>` : '';
    bankGridHtml += `
      <div class="inv-slot" style="width:36px; height:36px; border-color:${bdCol};" title="[창고] ${def.name} (터치하여 가방으로 찾기)" onclick="withdrawItemFromBank(${i})">
        ${plusBadge}
        ${window.getItemIconHTML(inst.type)}
        ${qtyBadge}
      </div>
    `;
  }

  // 내 가방 아이템(장착 중인 아이템 제외) HTML
  let bagItemsHtml = '';
  player.inventory.forEach((inst, idx) => {
    if (!inst || eqSet.has(idx)) return;
    const def = window.itemDict[inst.type] || { name: inst.type };
    const gCol = def.questOnly ? '#e879f9' : (inst.gradeColor || '#fff');
    const plusTxt = inst.plus > 0 ? `+${inst.plus} ` : '';
    const qtyTxt = inst.qty > 1 ? ` x${inst.qty}` : '';
    bagItemsHtml += `
      <div class="shop-row" style="padding:3px 6px;">
        <div style="display:flex; align-items:center; gap:6px; min-width:0; flex:1;">
          ${window.getItemIconHTML(inst.type)}
          <span style="font-size:10.5px; font-weight:bold; color:${gCol}; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${plusTxt}${def.name}${qtyTxt}</span>
        </div>
        <button class="shop-buy-btn" style="padding:3px 7px; font-size:9.5px; background:#065f46; border-color:#34d399;" onclick="depositItemToBank(${idx})">📥 보관</button>
      </div>
    `;
  });
  if (!bagItemsHtml) {
    bagItemsHtml = `<div style="text-align:center; color:#9ca3af; font-size:10px; padding:8px;">보관 가능한 가방 아이템이 없습니다. (장착 중인 장비는 해제 후 보관 가능)</div>`;
  }

  bodyEl.innerHTML = `
    <div style="display:flex; flex-direction:column; gap:6px;">
      <!-- 골드 & 성소 회복 -->
      <div style="background:#161922; border:1px solid #4a3b2c; border-radius:6px; padding:6px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
          <div>
            <div style="font-size:10.5px; color:#e5e7eb;">💰 캐릭터 보유: <b style="color:#fde047;">${player.gold.toLocaleString()} G</b></div>
            <div style="font-size:10.5px; color:#93c5fd;">🏦 계정 창고 골드: <b id="bank-gold-txt">${window.accountStorage.bankGold.toLocaleString()} G</b></div>
          </div>
          <button class="shop-buy-btn" style="background:#15803d; border-color:#4ade80; padding:4px 7px; font-size:9.5px;" onclick="bankAction('heal')">✨ 무료 HP/MP 회복</button>
        </div>
        <div style="display:grid; grid-template-columns: repeat(4, 1fr); gap:3px;">
          <button class="shop-buy-btn" style="padding:3px 2px; font-size:9.5px;" onclick="bankAction('deposit', 1000)">+1천 입금</button>
          <button class="shop-buy-btn" style="padding:3px 2px; font-size:9.5px;" onclick="bankAction('deposit_all')">전액 입금</button>
          <button class="shop-buy-btn" style="padding:3px 2px; font-size:9.5px; background:#1e3a8a; border-color:#60a5fa;" onclick="bankAction('withdraw', 1000)">-1천 출금</button>
          <button class="shop-buy-btn" style="padding:3px 2px; font-size:9.5px; background:#1e3a8a; border-color:#60a5fa;" onclick="bankAction('withdraw_all')">전액 출금</button>
        </div>
      </div>

      <!-- 계정 공유 아이템 창고 그리드 -->
      <div style="background:#11141b; border:1px solid #b45309; border-radius:6px; padding:6px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
          <span style="font-size:11px; font-weight:bold; color:#fde047;">📦 계정 공유 창고 (${usedBankCount}/${maxSlots})</span>
          <span style="font-size:9px; color:#86efac;">아이템 터치 시 가방으로 즉시 수령</span>
        </div>
        <div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(36px, 1fr)); gap:3px; max-height:118px; overflow-y:auto; padding:2px; background:#090b10; border-radius:4px;">
          ${bankGridHtml}
        </div>
      </div>

      <!-- 내 가방에서 창고로 맡기기 -->
      <div style="background:#14171f; border:1px solid #3d3020; border-radius:6px; padding:6px;">
        <div style="font-size:11px; font-weight:bold; color:#93c5fd; margin-bottom:4px;">🎒 내 가방 물품 창고에 맡기기</div>
        <div style="display:flex; flex-direction:column; gap:3px; max-height:130px; overflow-y:auto;">
          ${bagItemsHtml}
        </div>
      </div>
    </div>
  `;
};

window.depositItemToBank = function(invIdx) {
  const inst = player.inventory[invIdx];
  if (!inst) return;
  const eqSet = new Set(Object.values(player.equip || {}).filter(v => v !== null && v !== undefined).map(Number));
  if (eqSet.has(invIdx)) {
    window.addChat(`⚠️ [창고] 장착 중인 장비는 먼저 해제한 후 맡길 수 있습니다.`, 'log-hit');
    return;
  }
  const maxSlots = GameDB.SupabaseConfig?.maxStorageSlots || 60;
  const isStackable = inst.type.startsWith('C_') || inst.type.startsWith('S_') || inst.type.startsWith('Q_') || inst.type.startsWith('BOOK_');

  if (isStackable) {
    const existIdx = window.accountStorage.bankItems.findIndex(b => b && b.type === inst.type);
    if (existIdx > -1) {
      window.accountStorage.bankItems[existIdx].qty = (window.accountStorage.bankItems[existIdx].qty || 1) + (inst.qty || 1);
      player.inventory[invIdx] = null;
      const iName = window.itemDict[inst.type]?.name || inst.type;
      window.addChat(`📦 [창고 보관] '${iName}' x${inst.qty || 1}개를 계정 공유 창고에 맡겼습니다.`, 'log-sys');
      window.renderBankWarehouseModal();
      if (!document.getElementById('inventory-ui').classList.contains('hidden')) renderInventory();
      renderHotbarSlots();
      updateStatusHUD();
      window.triggerAutoSave?.('bank_deposit_item', true);
      return;
    }
  }

  let emptyIdx = window.accountStorage.bankItems.findIndex(b => b === null || b === undefined);
  if (emptyIdx === -1 && window.accountStorage.bankItems.length < maxSlots) {
    emptyIdx = window.accountStorage.bankItems.length;
  }
  if (emptyIdx === -1 || emptyIdx >= maxSlots) {
    window.addChat(`⚠️ [창고 가득참] 계정 공유 창고에 빈 슬롯이 없습니다!`, 'log-hit');
    return;
  }

  window.accountStorage.bankItems[emptyIdx] = JSON.parse(JSON.stringify(inst));
  player.inventory[invIdx] = null;
  const iName = window.itemDict[inst.type]?.name || inst.type;
  window.addChat(`📦 [창고 보관] '${iName}' 아이템을 계정 공유 창고에 보관했습니다.`, 'log-sys');
  window.renderBankWarehouseModal();
  if (!document.getElementById('inventory-ui').classList.contains('hidden')) renderInventory();
  renderHotbarSlots();
  updateStatusHUD();
  window.triggerAutoSave?.('bank_deposit_item', true);
};

window.withdrawItemFromBank = function(bankIdx) {
  const inst = window.accountStorage.bankItems[bankIdx];
  if (!inst) return;

  const isStackable = inst.type.startsWith('C_') || inst.type.startsWith('S_') || inst.type.startsWith('Q_') || inst.type.startsWith('BOOK_');
  if (isStackable) {
    const bagExist = player.inventory.find(it => it && it.type === inst.type);
    if (bagExist) {
      bagExist.qty = (bagExist.qty || 1) + (inst.qty || 1);
      window.accountStorage.bankItems[bankIdx] = null;
      const iName = window.itemDict[inst.type]?.name || inst.type;
      window.addChat(`📤 [창고 수령] 계정 창고에서 '${iName}' x${inst.qty || 1}개를 가방으로 찾았습니다.`, 'log-sys');
      window.renderBankWarehouseModal();
      if (!document.getElementById('inventory-ui').classList.contains('hidden')) renderInventory();
      renderHotbarSlots();
      updateStatusHUD();
      window.triggerAutoSave?.('bank_withdraw_item', true);
      return;
    }
  }

  const emptyBagIdx = player.inventory.findIndex(it => it === null || it === undefined);
  if (emptyBagIdx === -1) {
    window.addChat(`⚠️ [가방 가득참] 캐릭터 가방에 빈 공간이 없습니다!`, 'log-hit');
    return;
  }

  player.inventory[emptyBagIdx] = JSON.parse(JSON.stringify(inst));
  window.accountStorage.bankItems[bankIdx] = null;
  const iName = window.itemDict[inst.type]?.name || inst.type;
  window.addChat(`📤 [창고 수령] 계정 창고에서 '${iName}' 아이템을 가방으로 찾았습니다.`, 'log-sys');
  window.renderBankWarehouseModal();
  if (!document.getElementById('inventory-ui').classList.contains('hidden')) renderInventory();
  renderHotbarSlots();
  updateStatusHUD();
  window.triggerAutoSave?.('bank_withdraw_item', true);
};

window.bankAction = function(mode, customAmt = null) {
  const stepGold = customAmt || GameDB.Shops?.bankGoldStep || 1000;
  window.accountStorage.bankGold = Number(window.accountStorage.bankGold) || 0;

  if (mode === 'deposit') {
    if (player.gold < stepGold) {
      window.addChat(`⚠️ [창고] 입금할 골드(${stepGold.toLocaleString()} G)가 부족합니다.`, 'log-hit');
      return;
    }
    player.gold -= stepGold;
    window.accountStorage.bankGold += stepGold;
    player.bankGold = window.accountStorage.bankGold;
    window.addChat(`🏦 [창고 입금] ${stepGold.toLocaleString()} G를 계정 창고에 보관했습니다. (보관 중: ${window.accountStorage.bankGold.toLocaleString()} G)`, 'log-sys');
  } else if (mode === 'deposit_all') {
    if (player.gold <= 0) {
      window.addChat(`⚠️ [창고] 입금할 보유 골드가 없습니다.`, 'log-hit');
      return;
    }
    const amt = player.gold;
    player.gold = 0;
    window.accountStorage.bankGold += amt;
    player.bankGold = window.accountStorage.bankGold;
    window.addChat(`🏦 [창고 전액입금] ${amt.toLocaleString()} G를 계정 창고에 보관했습니다.`, 'log-sys');
  } else if (mode === 'withdraw') {
    if (window.accountStorage.bankGold < stepGold) {
      window.addChat(`⚠️ [창고] 출금할 보관 골드(${stepGold.toLocaleString()} G)가 부족합니다.`, 'log-hit');
      return;
    }
    window.accountStorage.bankGold -= stepGold;
    player.gold += stepGold;
    player.bankGold = window.accountStorage.bankGold;
    window.addChat(`🏦 [창고 출금] ${stepGold.toLocaleString()} G를 인출했습니다. (잔여 보관: ${window.accountStorage.bankGold.toLocaleString()} G)`, 'log-sys');
  } else if (mode === 'withdraw_all') {
    if (window.accountStorage.bankGold <= 0) {
      window.addChat(`⚠️ [창고] 출금할 보관 골드가 없습니다.`, 'log-hit');
      return;
    }
    const amt = window.accountStorage.bankGold;
    window.accountStorage.bankGold = 0;
    player.gold += amt;
    player.bankGold = 0;
    window.addChat(`🏦 [창고 전액출금] ${amt.toLocaleString()} G를 모두 인출했습니다.`, 'log-sys');
  } else if (mode === 'heal') {
    player.hp = player.maxHp;
    player.mp = player.maxMp;
    if (mercenary.hired && !mercenary.isDead) {
      mercenary.hp = mercenary.maxHp;
      mercenary.mp = mercenary.maxMp;
      mercenary.manaRechargeWait = false;
      window.updateMercHUD();
    }
    activeEffects.push({ type: 'buff', x: player.x, y: player.y, life: 30, maxLife: 30 });
    window.addChat(`✨ [성소 치유] 플레이어와 동행 용병의 HP/MP가 모두 회복되었습니다!`, 'log-kill');
  }
  window.renderBankWarehouseModal?.();
  updateStatusHUD();
  window.triggerAutoSave?.('bank_gold', true);
};

window.requestMercenaryBless = function() {
  const blessCost = GameDB.Shops?.mercenaryBlessCost ?? 300;
  if (player.gold < blessCost) {
    window.addChat(`⚠️ [용병단] 골드가 부족합니다! (필요: ${blessCost} G)`, 'log-hit');
    return;
  }
  window.showSystemAlertModal(
    '⚔️ 용병단장의 전술 축복 확인',
    `💰 ${blessCost} G를 지불하여 5분간 플레이어와 동행 용병에게 전술 축복(공격력·방어력·공이속 강화)을 부여하시겠습니까?`,
    `
      <button type="button" class="auth-sub-btn" style="flex:1;" onclick="closeSystemAlertModal()">취소</button>
      <button type="button" class="auth-primary-btn" style="flex:1;" onclick="closeSystemAlertModal(); mercenaryBless();">⚔️ 축복 확인</button>
    `
  );
};

window.mercenaryBless = function() {
  const blessCost = GameDB.Shops?.mercenaryBlessCost ?? 300;
  const blessDurMs = (GameDB.Shops?.mercenaryBlessDurSec ?? 300) * 1000;
  if (player.gold < blessCost) {
    window.addChat(`⚠️ [용병단] 골드가 부족합니다! (필요: ${blessCost} G)`, 'log-hit');
    return;
  }
  player.gold -= blessCost;
  const stackCap = 3600000;
  player.activeBuffs.MERC_BLESS = Math.min(stackCap, Math.max(0, player.activeBuffs.MERC_BLESS || 0) + blessDurMs);
  player.activeBuffs.ELIXIR = Math.min(stackCap, Math.max(0, player.activeBuffs.ELIXIR || 0) + blessDurMs);
  player.activeBuffs.SHIELD = Math.min(stackCap, Math.max(0, player.activeBuffs.SHIELD || 0) + blessDurMs);
  player.activeBuffs.HASTE = Math.min(stackCap, Math.max(0, player.activeBuffs.HASTE || 0) + blessDurMs);
  if (mercenary.hired && !mercenary.isDead) {
    mercenary.activeBuffs.MERC_BLESS = Math.min(stackCap, Math.max(0, mercenary.activeBuffs.MERC_BLESS || 0) + blessDurMs);
    mercenary.activeBuffs.ELIXIR = Math.min(stackCap, Math.max(0, mercenary.activeBuffs.ELIXIR || 0) + blessDurMs);
    mercenary.activeBuffs.SHIELD = Math.min(stackCap, Math.max(0, mercenary.activeBuffs.SHIELD || 0) + blessDurMs);
    mercenary.activeBuffs.HASTE = Math.min(stackCap, Math.max(0, mercenary.activeBuffs.HASTE || 0) + blessDurMs);
  }
  activeEffects.push({ type: 'buff', x: player.x, y: player.y, life: 35, maxLife: 35 });
  window.addChat(`⚔️ [용병단장의 축복] ${Math.round(blessDurMs / 60000)}분간 플레이어 및 용병에게 공격력·방어력·공이속 강화 버프가 부여되었습니다!`, 'log-kill');
  window.updateBuffUI();
  updateStatusHUD();
  window.triggerAutoSave?.('merc_bless', false);
};

window.closeNpcModal = function() {
  const modal = document.getElementById('npc-modal-ui');
  if (modal) {
    modal.classList.remove('active-modal');
    modal.classList.add('hidden');
  }
};

window.questUiTab = 'active'; // 'active' | 'region' | 'done'
window.questUiDoneRegionFilter = 'ALL';

window.setQuestUiTab = function(tabName) {
  window.questUiTab = tabName || 'active';
  window.renderQuestUI();
};

window.setQuestDoneRegionFilter = function(regId) {
  window.questUiDoneRegionFilter = regId || 'ALL';
  window.renderQuestUI();
};

window.guideToQuestTarget = function(qId) {
  const q = (GameDB.Quests || []).find(x => x && x.id === qId);
  if (!q || !window.player) return;
  const st = player.quests?.[q.id] || { status: 'AVAILABLE', count: 0 };
  const regObj = (GameDB.Regions || []).find(r => r.id === q.region);
  const regName = regObj ? regObj.name : q.region;

  if (q.region !== currentRegionKey) {
    window.addChat(`🧭 [${q.name}] 임무는 [${regName}] 지역 퀘스트입니다. 마을 포탈(아리아)을 통해 이동하세요.`, 'log-sys');
    return;
  }

  const ui = document.getElementById('quest-ui');
  if (ui) ui.classList.add('hidden');

  if (st.status === 'ACTIVE' && st.count < q.reqCount && q.targetName) {
    const liveMob = (monsterList || []).find(m => m && !m.isDead && ((m.rawName || m.name || '').includes(q.targetName)));
    if (liveMob && typeof window.findPath === 'function') {
      player.targetEntity = { type: 'MONSTER', ref: liveMob };
      player.path = window.findPath(player.x, player.y, liveMob.x, liveMob.y);
      player.isMoving = true;
      player.manualMoving = false;
      updateTopTargetUI?.(liveMob);
      window.addChat(`🧭 퀘스트 목표 '${q.targetName}' 위치로 이동합니다.`, 'log-sys');
      return;
    }

    const mobDef = (GameDB.Monsters || []).find(m => m && m.name && m.name.includes(q.targetName));
    if (mobDef && window.ImmersiveSystem?.getMonsterHabitatPoint) {
      const habitat = window.ImmersiveSystem.getMonsterHabitatPoint(mobDef);
      if (habitat && typeof window.findPath === 'function') {
        const path = window.findPath(player.x, player.y, habitat.x, habitat.y);
        if (Array.isArray(path) && path.length > 0) {
          player.targetEntity = null;
          player.path = path;
          player.isMoving = true;
          player.manualMoving = false;
          window.addChat(`🧭 퀘스트 목표 '${q.targetName}' 서식지 [${habitat.name}]로 자동 이동합니다.`, 'log-sys');
          return;
        }
      }
    }
  }

  const qNpc = (npcList || []).find(n => n && n.role === 'QUEST');
  if (qNpc && typeof window.findPath === 'function') {
    player.targetEntity = { type: 'NPC', ref: qNpc };
    player.path = window.findPath(player.x, player.y, qNpc.x, qNpc.y);
    player.isMoving = true;
    player.manualMoving = false;
    window.addChat(`🧭 퀘스트 NPC '${qNpc.name}'에게 이동합니다.`, 'log-sys');
  } else {
    window.addChat(`🧭 [${regName}] '${q.objective}' 목표를 확인하세요. (캐릭터 주변 방향 화살표 안내 활성화됨)`, 'log-sys');
  }
};

window.toggleQuestUI = function() {
  const ui = document.getElementById('quest-ui');
  if (!ui) return;
  const wasHidden = ui.classList.contains('hidden');
  ui.classList.toggle('hidden');
  if (!ui.classList.contains('hidden')) {
    // 창을 새로 열 때는 항상 '진행중' 탭을 기본 표시하여 긴 리스트 스크롤 현상 원천 차단
    window.questUiTab = 'active';
    window.bringModalToFront?.(ui);
    window.renderQuestUI();
    if (wasHidden && !ui._hasCustomDragPos) {
      window.centerModalOnScreen?.(ui);
    }
  }
};

function getQuestRewardItemId(q) {
  if (q.rewardByClass && q.rewardByClass[player.class]) {
    return q.rewardByClass[player.class];
  }
  return q.rewardItem;
}

function getRegionNameById(regId) {
  const r = (GameDB.Regions || []).find(x => x && x.id === regId);
  return r ? r.name : (regId || 'R01');
}

function renderSingleQuestRowHTML(q, st, isFromNpc = false, compactDone = false) {
  const rewardId = getQuestRewardItemId(q);
  const rItem = window.itemDict?.[rewardId]?.name || rewardId;
  const regName = getRegionNameById(q.region);
  const isReady = st.status === 'ACTIVE' && st.count >= q.reqCount;
  const pct = Math.min(100, Math.round(((st.count || 0) / Math.max(1, q.reqCount || 1)) * 100));

  if (compactDone && st.status === 'DONE') {
    return `
      <div class="shop-row" style="border-color:#2d3748; background:#12141a; padding:4px 7px; margin-bottom:2px; opacity:0.86;">
        <div style="flex:1; min-width:0;">
          <div style="display:flex; align-items:center; gap:5px; flex-wrap:wrap;">
            <span style="font-size:9px; background:#1e293b; color:#93c5fd; padding:0 4px; border-radius:3px;">${regName}</span>
            <span style="font-weight:bold; color:${q.isRegionFinale ? '#e879f9' : '#d1d5db'}; font-size:11.5px;">[${q.id}] ${q.name}</span>
          </div>
          <div style="font-size:9.5px; color:#9ca3af; margin-top:1px;">🎯 ${q.objective} · 보상: <b>${rItem}</b> x${q.rewardQty}</div>
        </div>
        <span style="font-size:10px; color:#4ade80; font-weight:bold; white-space:nowrap;">완료 ✔️</span>
      </div>
    `;
  }

  let btnHtml = '';
  if (isFromNpc) {
    if (st.status === 'AVAILABLE' || st.status === 'ABANDONED') {
      btnHtml = `<button class="shop-buy-btn" onclick="acceptQuest('${q.id}')">${st.everAccepted ? '재수락' : '수락하기'}</button>`;
    } else if (st.status === 'ACTIVE') {
      if (isReady) {
        btnHtml = `<button class="shop-buy-btn" style="background:#16a34a; border-color:#4ade80; box-shadow:0 0 8px rgba(34,197,94,0.45);" onclick="completeQuest('${q.id}')">🎁 보상 수령</button>`;
      } else {
        btnHtml = `<span style="font-size:9.5px; color:#fde047; font-weight:bold; white-space:nowrap;">진행 (${st.count}/${q.reqCount})</span>`;
      }
    } else {
      btnHtml = `<span style="font-size:10px; color:#6b7280; white-space:nowrap;">완료됨 ✔️</span>`;
    }
  } else {
    if (st.status === 'ACTIVE') {
      btnHtml = `<div style="display:flex; flex-direction:column; gap:4px; align-items:flex-end; flex-shrink:0;">`;
      if (isReady) {
        btnHtml += `<span style="font-size:9px; color:#4ade80; font-weight:bold; background:#052e16; padding:2px 5px; border:1px solid #22c55e; border-radius:4px; white-space:nowrap;">달성! (NPC 보상)</span>`;
      } else {
        btnHtml += `<span style="font-size:9.5px; color:#fde047; font-weight:bold; white-space:nowrap;">진행 (${st.count}/${q.reqCount})</span>`;
      }
      btnHtml += `<div style="display:flex; gap:3px;">`;
      if (q.region === currentRegionKey) {
        btnHtml += `<button type="button" class="shop-buy-btn" style="background:#1e3a8a; border-color:#60a5fa; padding:2px 5px; font-size:9px;" onclick="guideToQuestTarget('${q.id}')">📍안내</button>`;
      }
      btnHtml += `<button type="button" class="shop-buy-btn" style="background:#7f1d1d; border-color:#f87171; padding:2px 6px; font-size:9px;" onclick="abandonQuest('${q.id}')">포기</button>`;
      btnHtml += `</div></div>`;
    } else if (st.status === 'ABANDONED') {
      btnHtml = `<div style="display:flex; flex-direction:column; gap:3px; align-items:flex-end; flex-shrink:0;">
        <span style="font-size:9px; color:#fca5a5;">포기 상태</span>
        <button type="button" class="shop-buy-btn" style="background:#1d4ed8; border-color:#60a5fa; padding:2px 7px; font-size:9.5px;" onclick="resumeQuest('${q.id}')">🔄 재진행</button>
      </div>`;
    } else if (st.status === 'DONE') {
      btnHtml = `<span style="font-size:10px; color:#4ade80; font-weight:bold; white-space:nowrap;">완료됨 ✔️</span>`;
    } else {
      btnHtml = `<div style="display:flex; flex-direction:column; gap:3px; align-items:flex-end; flex-shrink:0;">
        <span style="font-size:9px; color:#93c5fd;">미수락 (NPC)</span>
        ${q.region === currentRegionKey ? `<button type="button" class="shop-buy-btn" style="background:#1e3a8a; border-color:#60a5fa; padding:2px 6px; font-size:9px;" onclick="guideToQuestTarget('${q.id}')">📍NPC이동</button>` : ''}
      </div>`;
    }
  }

  const rowBorder = isReady ? '#22c55e' : (st.status === 'ACTIVE' ? '#eab308' : (st.status === 'ABANDONED' ? '#7f1d1d' : '#3d3020'));
  const progressBarHtml = st.status === 'ACTIVE' ? `
    <div style="width:100%; height:5px; background:#090d16; border:1px solid #374151; border-radius:999px; overflow:hidden; margin-top:3px;">
      <div style="width:${pct}%; height:100%; background:${isReady ? 'linear-gradient(90deg,#16a34a,#4ade80)' : 'linear-gradient(90deg,#ca8a04,#fde047)'}; transition:width 0.2s;"></div>
    </div>
  ` : '';

  return `
    <div class="shop-row" ${st.status === 'ACTIVE' ? 'data-active-quest-row="true"' : ''} style="border-color:${rowBorder}; padding:6px 7px; margin-bottom:2px; flex-shrink:0;">
      <div style="flex:1; min-width:0;">
        <div style="display:flex; align-items:center; gap:4px; margin-bottom:1px; flex-wrap:wrap;">
          <span style="font-size:9px; background:#1e293b; border:1px solid #334155; color:#bae6fd; padding:0 4px; border-radius:3px; font-weight:bold;">📍${regName}</span>
          ${q.chapter ? `<span style="font-size:9px; color:#38bdf8; font-weight:bold;">📖 ${q.chapter}</span>` : ''}
        </div>
        <div style="font-weight:bold; color:${q.isRegionFinale ? '#e879f9' : '#facc15'}; font-size:12.5px; line-height:1.25;">[${q.id}] ${q.name}</div>
        ${q.story ? `<div style="font-size:10.5px; color:#cbd5e1; margin:1px 0; line-height:1.25;">"${q.story}"</div>` : ''}
        <div style="font-size:11.2px; color:#fff; line-height:1.25;">🎯 목표: ${q.objective}</div>
        <div style="font-size:9px; color:${q.isRegionFinale ? '#fde047' : '#93c5fd'}; margin-top:1px;">보상: EXP +${(Number(q.exp) || 0).toLocaleString()} / 💰${(Number(q.gold) || 0).toLocaleString()} G / <b>${rItem}</b> x${q.rewardQty}</div>
        ${progressBarHtml}
      </div>
      <div>${btnHtml}</div>
    </div>
  `;
}

function buildQuestListHTML(isFromNpc = false) {
  const seenIds = new Set();
  const uniqueQuests = (GameDB.Quests || []).filter(q => {
    if (!q || !q.id || seenIds.has(q.id)) return false;
    seenIds.add(q.id);
    return true;
  });

  if (isFromNpc) {
    let html = `<div style="font-size:10px; color:#4ade80; margin-bottom:5px; flex-shrink:0;">지역 최종 보스 퀘스트 완수 시 <b>[퀘스트전용] 클래스 맞춤 무기</b>가 지급됩니다!</div>`;
    const regionQuests = uniqueQuests.filter(q => q.region === currentRegionKey || player.quests[q.id]?.status === 'ACTIVE');
    const rawQuests = regionQuests.length > 0 ? regionQuests : uniqueQuests.filter(q => q.region === 'R01');

    // NPC 대화창에서도 달성/진행중/수락가능 임무를 맨 위에 배치하고 완료된 임무는 하단에 컴팩트하게 정리 (불필요한 스크롤 제거)
    const activeReady = [];
    const activeInProg = [];
    const availList = [];
    const doneList = [];

    rawQuests.forEach(q => {
      const st = player.quests[q.id] || { status: 'AVAILABLE', count: 0, everAccepted: false };
      if (st.status === 'ACTIVE') {
        if ((st.count || 0) >= q.reqCount) activeReady.push({ q, st });
        else activeInProg.push({ q, st });
      } else if (st.status === 'DONE') {
        doneList.push({ q, st });
      } else {
        availList.push({ q, st });
      }
    });

    html += `<div class="shop-list" style="scroll-behavior:auto;">`;
    [...activeReady, ...activeInProg, ...availList].forEach(({ q, st }) => {
      html += renderSingleQuestRowHTML(q, st, true, false);
    });
    if (doneList.length > 0) {
      html += `<div style="font-size:9.5px; color:#94a3b8; font-weight:bold; margin:4px 0 2px 2px;">✔️ 완료한 임무 (${doneList.length}건)</div>`;
      doneList.forEach(({ q, st }) => {
        html += renderSingleQuestRowHTML(q, st, true, true);
      });
    }
    html += `</div>`;
    return html;
  }

  const activeQuests = uniqueQuests.filter(q => player.quests[q.id]?.status === 'ACTIVE');
  const abandonedQuests = uniqueQuests.filter(q => player.quests[q.id]?.status === 'ABANDONED' && player.quests[q.id]?.everAccepted);
  const doneQuests = uniqueQuests.filter(q => player.quests[q.id]?.status === 'DONE');
  const curRegQuests = uniqueQuests.filter(q => q.region === currentRegionKey);
  const curRegName = getRegionNameById(currentRegionKey);

  const curTab = window.questUiTab || 'active';
  let html = `
    <div style="display:grid; grid-template-columns:repeat(3, 1fr); gap:4px; margin-bottom:4px; flex-shrink:0;">
      <button type="button" onclick="setQuestUiTab('active')" style="padding:5px 4px; border-radius:5px; font-size:10.5px; font-weight:bold; cursor:pointer; background:${curTab === 'active' ? 'linear-gradient(180deg,#92400e,#451a03)' : '#14171f'}; border:1px solid ${curTab === 'active' ? '#facc15' : '#374151'}; color:${curTab === 'active' ? '#fef08a' : '#9ca3af'};">
        🔥 진행중 (${activeQuests.length})
      </button>
      <button type="button" onclick="setQuestUiTab('region')" style="padding:5px 4px; border-radius:5px; font-size:10.5px; font-weight:bold; cursor:pointer; background:${curTab === 'region' ? 'linear-gradient(180deg,#1e3a8a,#172554)' : '#14171f'}; border:1px solid ${curTab === 'region' ? '#60a5fa' : '#374151'}; color:${curTab === 'region' ? '#e0f2fe' : '#9ca3af'};">
        📍 ${curRegName} (${curRegQuests.length})
      </button>
      <button type="button" onclick="setQuestUiTab('done')" style="padding:5px 4px; border-radius:5px; font-size:10.5px; font-weight:bold; cursor:pointer; background:${curTab === 'done' ? 'linear-gradient(180deg,#065f46,#022c22)' : '#14171f'}; border:1px solid ${curTab === 'done' ? '#34d399' : '#374151'}; color:${curTab === 'done' ? '#a7f3d0' : '#9ca3af'};">
        📚 완료 (${doneQuests.length})
      </button>
    </div>
  `;

  if (curTab === 'active') {
    html += `<div style="background:#1a1510; border:1px solid #5a462a; border-radius:5px; padding:4px 7px; margin-bottom:4px; font-size:9.8px; color:#fde047; display:flex; justify-content:space-between; align-items:center; flex-shrink:0;">
      <span>🔥 현재 진행 중: <b>${activeQuests.length}건</b>${abandonedQuests.length > 0 ? ` · 포기: ${abandonedQuests.length}건` : ''}</span>
      <span style="font-size:9px; color:#93c5fd;">※ 수락·보상: 마을/야영지 퀘스트 NPC</span>
    </div>`;

    if (activeQuests.length === 0 && abandonedQuests.length === 0) {
      const nextCurRegQuest = curRegQuests.find(q => {
        const st = player.quests[q.id]?.status;
        return !st || st === 'AVAILABLE';
      });
      html += `<div style="padding:12px 10px; text-align:center; color:#cbd5e1; font-size:10.5px; background:#141210; border:1px dashed #4a3b2c; border-radius:6px; margin-bottom:4px;">
        현재 진행 중인 퀘스트가 없습니다.<br>
        <span style="color:#4ade80; font-size:9.5px;">마을(S) 또는 야영지(S1)의 퀘스트 NPC에게서 새 임무를 수락하세요!</span>
      </div>`;
      if (nextCurRegQuest) {
        const stNext = player.quests[nextCurRegQuest.id] || { status: 'AVAILABLE', count: 0 };
        html += `<div style="font-size:9.5px; color:#fde047; font-weight:bold; margin:2px 0 3px 2px;">💡 현재 지역(${curRegName}) 추천 다음 임무</div>`;
        html += `<div class="shop-list" style="scroll-behavior:auto;">${renderSingleQuestRowHTML(nextCurRegQuest, stNext, false, false)}</div>`;
      }
      return html;
    }

    // 최신/현재 지역 및 달성 완료 임무가 항상 맨 위에 오도록 정렬 (스크롤 없이 즉시 확인!)
    const sortedActive = [...activeQuests].sort((a, b) => {
      const stA = player.quests[a.id];
      const stB = player.quests[b.id];
      const readyA = (stA?.count || 0) >= a.reqCount ? 1 : 0;
      const readyB = (stB?.count || 0) >= b.reqCount ? 1 : 0;
      if (readyA !== readyB) return readyB - readyA;
      const curA = a.region === currentRegionKey ? 1 : 0;
      const curB = b.region === currentRegionKey ? 1 : 0;
      if (curA !== curB) return curB - curA;
      return String(b.id).localeCompare(String(a.id));
    });

    html += `<div class="shop-list" style="scroll-behavior:auto;">`;
    sortedActive.forEach(q => {
      html += renderSingleQuestRowHTML(q, player.quests[q.id], false, false);
    });
    if (abandonedQuests.length > 0) {
      html += `<div style="font-size:9.5px; color:#fca5a5; font-weight:bold; margin:4px 0 2px 2px;">🔄 재진행 가능한 포기 임무 (${abandonedQuests.length}건)</div>`;
      [...abandonedQuests].reverse().forEach(q => {
        html += renderSingleQuestRowHTML(q, player.quests[q.id], false, false);
      });
    }
    html += `</div>`;
    return html;
  }

  if (curTab === 'region') {
    const doneInReg = curRegQuests.filter(q => player.quests[q.id]?.status === 'DONE').length;
    html += `<div style="background:#0f172a; border:1px solid #334155; border-radius:5px; padding:4px 7px; margin-bottom:4px; font-size:10px; color:#bae6fd; display:flex; justify-content:space-between; align-items:center; flex-shrink:0;">
      <span>📍 <b>${curRegName}</b> 지역 임무 현황</span>
      <span style="color:#4ade80; font-weight:bold;">완료 ${doneInReg} / ${curRegQuests.length}건</span>
    </div>`;

    const orderedRegQuests = [...curRegQuests].sort((a, b) => {
      const sA = player.quests[a.id]?.status || 'AVAILABLE';
      const sB = player.quests[b.id]?.status || 'AVAILABLE';
      const rank = { ACTIVE: 0, ABANDONED: 1, AVAILABLE: 2, DONE: 3 };
      return (rank[sA] ?? 2) - (rank[sB] ?? 2);
    });

    html += `<div class="shop-list" style="scroll-behavior:auto;">`;
    orderedRegQuests.forEach(q => {
      const st = player.quests[q.id] || { status: 'AVAILABLE', count: 0, everAccepted: false };
      html += renderSingleQuestRowHTML(q, st, false, st.status === 'DONE');
    });
    html += `</div>`;
    return html;
  }

  // 'done' 탭: 최근 완료 지역 역순 정렬 + 지역별 빠른 필터 제공
  const doneRegions = Array.from(new Set(doneQuests.map(q => q.region))).reverse();
  const selReg = window.questUiDoneRegionFilter || 'ALL';
  const filteredDone = [...doneQuests].reverse().filter(q => selReg === 'ALL' || q.region === selReg);

  html += `<div style="display:flex; justify-content:space-between; align-items:center; gap:6px; background:#0f172a; border:1px solid #334155; border-radius:5px; padding:4px 7px; margin-bottom:4px; font-size:10px; flex-shrink:0;">
    <span style="color:#a7f3d0;">✔️ 누적 완료 임무: <b>${doneQuests.length}건</b></span>
    <select onchange="setQuestDoneRegionFilter(this.value)" style="background:#1e293b; color:#fde047; border:1px solid #475569; border-radius:4px; font-size:9.5px; padding:1px 4px; outline:none;">
      <option value="ALL" ${selReg === 'ALL' ? 'selected' : ''}>전체 지역 (${doneQuests.length})</option>
      ${doneRegions.map(rId => `<option value="${rId}" ${selReg === rId ? 'selected' : ''}>${getRegionNameById(rId)}</option>`).join('')}
    </select>
  </div>`;

  if (filteredDone.length === 0) {
    html += `<div style="padding:16px 10px; text-align:center; color:#9ca3af; font-size:10.5px; background:#141210; border:1px dashed #3d3020; border-radius:6px;">
      아직 완료한 퀘스트 기록이 없습니다.
    </div>`;
    return html;
  }

  html += `<div class="shop-list" style="scroll-behavior:auto;">`;
  filteredDone.forEach(q => {
    html += renderSingleQuestRowHTML(q, player.quests[q.id], false, true);
  });
  html += `</div>`;
  return html;
}

window.renderQuestUI = function() {
  const body = document.getElementById('quest-ui-body');
  if (body) body.innerHTML = buildQuestListHTML(false);

  const npcModal = document.getElementById('npc-modal-ui');
  if (npcModal && !npcModal.classList.contains('hidden')) {
    const npcBody = document.getElementById('npc-modal-body');
    const npcTitle = document.getElementById('npc-modal-title');
    if (npcBody && npcTitle && (npcTitle.innerText.includes('발렌') || npcTitle.innerText.includes('실바나') || npcTitle.innerText.includes('특사') || npcTitle.innerText.includes('아리엘') || npcTitle.innerText.includes('토르딘') || npcTitle.innerText.includes('하킴') || npcTitle.innerText.includes('크로우') || npcTitle.innerText.includes('테오도르') || npcTitle.innerText.includes('볼프강') || npcTitle.innerText.includes('이그나') || npcTitle.innerText.includes('베인') || npcTitle.innerText.includes('제피르') || npcTitle.innerText.includes('루미나') || npcTitle.innerText.includes('단테') || npcTitle.innerText.includes('지크프리트') || npcTitle.innerText.includes('셀레스티아'))) {
      npcBody.innerHTML = buildQuestListHTML(true);
    }
  }

  updateQuestTrackerHUD();
  updateQuestButtonBadge();
  window.focusLastActiveQuestRow?.();
};

function updateQuestButtonBadge() {
  const btn = document.getElementById('bottom-quest-btn');
  if (!btn) return;
  const activeQuests = GameDB.Quests.filter(q => player.quests[q.id]?.status === 'ACTIVE');
  if (activeQuests.length > 0) {
    const readyCount = activeQuests.filter(q => player.quests[q.id].count >= q.reqCount).length;
    btn.classList.add('quest-active');
    if (readyCount > 0) {
      btn.innerHTML = `📜 퀘스트 <span style="color:#4ade80;">(완료${readyCount})</span>`;
    } else {
      btn.innerHTML = `📜 퀘스트 <span style="color:#fde047;">(${activeQuests.length})</span>`;
    }
  } else {
    btn.classList.remove('quest-active');
    btn.innerHTML = `📜 퀘스트`;
  }
}

function updateQuestTrackerHUD() {
  const tracker = document.getElementById('quest-tracker-hud');
  if (!tracker) return;
  const activeQuests = GameDB.Quests.filter(q => player.quests[q.id]?.status === 'ACTIVE');
  if (activeQuests.length === 0) {
    tracker.innerHTML = `<div style="color:#9ca3af; font-size:10px;">📜 진행 중인 퀘스트 없음 (퀘스트 NPC 클릭)</div>`;
    return;
  }
  tracker.innerHTML = activeQuests.map(q => {
    const st = player.quests[q.id];
    const done = st.count >= q.reqCount;
    return `<div style="font-size:11px; color:${done ? '#4ade80' : '#f3f4f6'};">📜 <b>${q.name}</b>: ${st.count}/${q.reqCount} ${done ? '(NPC 보상수령!)' : ''}</div>`;
  }).join('');
}

window.acceptQuest = function(qId) {
  const q = GameDB.Quests.find(x => x.id === qId);
  if (!q) return;
  const prev = player.quests[qId];
  player.quests[qId] = { status: 'ACTIVE', count: prev?.count || 0, everAccepted: true };
  window.addChat(`📜 [퀘스트 수락] ${q.chapter ? `[${q.chapter}] ` : ''}'${q.name}' - ${q.objective}`, 'log-sys');
  if (q.acceptDialog) {
    window.addChat(`💬 ${q.acceptDialog}`, 'log-chat', 'chat');
  }
  window.renderQuestUI();
};

window.abandonQuest = function(qId) {
  const q = GameDB.Quests.find(x => x.id === qId);
  if (!q || !player.quests[qId]) return;
  player.quests[qId] = { status: 'ABANDONED', count: 0, everAccepted: true };
  window.addChat(`🗑️ [퀘스트 포기] '${q.name}' 퀘스트를 포기했습니다.`, 'log-hit');
  window.renderQuestUI();
};

window.resumeQuest = function(qId) {
  const q = GameDB.Quests.find(x => x.id === qId);
  const st = player.quests[qId];
  if (!q || !st || !st.everAccepted || st.status !== 'ABANDONED') return;
  st.status = 'ACTIVE';
  st.count = 0;
  window.addChat(`🔄 [퀘스트 재진행] '${q.name}' 임무를 다시 진행합니다!`, 'log-sys');
  window.renderQuestUI();
};

window.completeQuest = function(qId) {
  const npcModal = document.getElementById('npc-modal-ui');
  if (!npcModal || npcModal.classList.contains('hidden')) {
    window.addChat(`⚠️ [보상 수령 불가] 퀘스트 보상은 마을 또는 야영지의 퀘스트 NPC를 통해서만 수령할 수 있습니다!`, 'log-hit');
    return;
  }
  const q = GameDB.Quests.find(x => x.id === qId);
  const st = player.quests[qId];
  if (!q || !st || st.status !== 'ACTIVE' || st.count < q.reqCount) return;

  st.status = 'DONE';
  st.everAccepted = true;
  player.gold += (q.gold || 0);
  const rewardId = getQuestRewardItemId(q);
  const rewardDef = window.itemDict[rewardId];
  giveItem(rewardId, q.rewardQty || 1, rewardDef?.fixedGrade ?? null);
  gainExp(q.exp || 100);

  window.addChat(`🎉 [퀘스트 완료] '${q.name}' 달성! 보상: [${rewardDef?.name || rewardId}] 획득! (EXP +${Number(q.exp || 0).toLocaleString()}, 💰+${Number(q.gold || 0).toLocaleString()} G)`, 'log-kill');
  if (q.completeDialog) {
    window.addChat(`💬 ${q.completeDialog}`, 'log-chat', 'chat');
  }
  updateStatusHUD();
  window.renderQuestUI();
};

window.buyShopItem = function(itemId, unitPrice, count = 1) {
  const totalPrice = unitPrice * count;
  if (player.gold < totalPrice) {
    window.addChat(`[상점] 골드가 부족합니다! (필요: ${totalPrice.toLocaleString()} G)`, 'log-hit');
    return;
  }
  player.gold -= totalPrice;
  giveItem(itemId, count);
  const it = window.itemDict[itemId];
  window.addChat(`🛒 [구매 완료] ${it ? it.name : itemId} x${count}개를 구매했습니다.`, 'log-sys');
  updateStatusHUD();
  renderHotbarSlots();
  if (!document.getElementById('inventory-ui').classList.contains('hidden')) renderInventory();
};

// ============================================================================
// ⚔️ 스킬 습득 체계, 장비 개별 인챈트, 성장 밸런스(Soft Cap), 인벤토리, 퀵슬롯
// ============================================================================
window.skillSlots = Array(11).fill(null);
window.autoSlots = new Set();
window.isAutoAttack = false;
let skillCooldowns = {};
let lastHpPotionTime = 0;
let lastMpPotionTime = 0;
let lastAutoHealTime = 0;
let lastAutoBuffTime = 0;

let pendingStats = { STR: 0, DEX: 0, INT: 0, CON: 0 };

// 클래스별 기본 시작 스킬 초기화 (learnGold === 0 인 1서클 기본 스킬만 초기 습득, 나머지는 NPC 또는 몬스터 마법서 드롭으로 습득)
window.initDefaultLearnedSkills = function(selectedClass) {
  const cKey = selectedClass || player.class || 'knight';
  const list = SKILLS_DB[cKey] || [];
  const initSet = new Set();
  list.forEach(sk => {
    if (sk.npcLearn && (sk.learnGold === 0 || sk.learnGold === undefined) && (sk.reqLv || 1) <= 1) {
      initSet.add(sk.id);
    }
  });
  player.learnedSkills = initSet;
  return initSet;
};

function isSkillLearned(skillObjOrName) {
  if (!player.learnedSkills) window.initDefaultLearnedSkills(player.class);
  if (!skillObjOrName) return false;
  if (typeof skillObjOrName === 'object') {
    return player.learnedSkills.has(skillObjOrName.id);
  }
  const sk = (SKILLS_DB[player.class] || []).find(s => s.name === skillObjOrName || s.id === skillObjOrName);
  return sk ? player.learnedSkills.has(sk.id) : false;
}

function getPendingTotal() {
  return pendingStats.STR + pendingStats.DEX + pendingStats.INT + pendingStats.CON;
}

window.addStat = function(statName) {
  if (player.statPoints - getPendingTotal() <= 0) return;
  pendingStats[statName]++;
  renderEquipUI();
  window.renderStatAllocModal?.();
};

window.subStat = function(statName) {
  if (pendingStats[statName] <= 0) return;
  pendingStats[statName]--;
  renderEquipUI();
  window.renderStatAllocModal?.();
};

window.addStatBulk = function(statName, amount) {
  if (!pendingStats || !(statName in pendingStats)) return;
  const remain = Math.max(0, (player.statPoints || 0) - getPendingTotal());
  if (amount === 'MAX') {
    if (remain <= 0) return;
    pendingStats[statName] += remain;
  } else if (amount > 0) {
    const add = Math.min(remain, Number(amount) || 0);
    if (add <= 0) return;
    pendingStats[statName] += add;
  } else if (amount < 0) {
    const sub = Math.min(pendingStats[statName], Math.abs(Number(amount) || 0));
    if (sub <= 0) return;
    pendingStats[statName] -= sub;
  }
  SoundSystem.playUiClick?.();
  renderEquipUI();
  window.renderStatAllocModal?.();
};

window.openStatAllocModal = function(ev) {
  if (ev) ev.stopPropagation();
  const modal = document.getElementById('stat-alloc-modal');
  if (!modal) return;
  modal.classList.remove('hidden');
  window.bringModalToFront?.(modal);
  window.renderStatAllocModal();
  window.centerModalOnScreen?.(modal);
};

window.closeStatAllocModal = function() {
  const modal = document.getElementById('stat-alloc-modal');
  if (modal) modal.classList.add('hidden');
};

window.renderStatAllocModal = function() {
  const modal = document.getElementById('stat-alloc-modal');
  const body = document.getElementById('stat-alloc-body');
  if (!modal || !body || modal.classList.contains('hidden')) return;

  const pendTotal = getPendingTotal();
  const remainPts = Math.max(0, (player.statPoints || 0) - pendTotal);
  const cStatsNow = calculateCombatStats(false);
  const cStatsPreview = calculateCombatStats(true);
  const resetCount = getAvailableStatResetCount();
  const nextMilestone = (Math.floor((player.level || 1) / 50) + 1) * 50;

  const statMeta = [
    { key: 'STR', label: '💪 근력 (STR)', desc: '전사 주스탯 · 물리 공격력 증가' },
    { key: 'DEX', label: '🏹 민첩 (DEX)', desc: '궁수 주스탯 · 원거리공격·명중·치명·회피 증가' },
    { key: 'INT', label: '🔮 지능 (INT)', desc: '마법사 주스탯 · 마법공격·최대 MP·힐량 증가' },
    { key: 'CON', label: '🛡️ 체력 (CON)', desc: '전 클래스 공통 · 최대 HP·방어 보조·방패블록 증가' }
  ];

  const rowsHtml = statMeta.map(m => {
    const baseV = player.stats[m.key] || 0;
    const pendV = pendingStats[m.key] || 0;
    const effV = cStatsPreview[`eff${m.key}`] || baseV;
    const eqV = Math.max(0, effV - baseV - pendV);
    return `
      <div class="stat-alloc-row">
        <div class="stat-alloc-info">
          <div class="stat-alloc-title">
            <span>${m.label}</span>
            <span style="color:#ffffff; font-size:13.5px;">${baseV}</span>
            ${eqV > 0 ? `<span style="color:#60a5fa; font-size:11px;">(+${eqV})</span>` : ''}
            ${pendV > 0 ? `<span style="color:#4ade80; font-size:12.5px; font-weight:900;">+${pendV}</span>` : ''}
          </div>
          <div class="stat-alloc-desc">${m.desc}</div>
        </div>
        <div class="stat-alloc-btns">
          <button type="button" class="stat-big-btn" ${pendV <= 0 ? 'disabled' : ''} onclick="addStatBulk('${m.key}', -1)">-1</button>
          <button type="button" class="stat-big-btn" ${remainPts <= 0 ? 'disabled' : ''} onclick="addStatBulk('${m.key}', 1)">+1</button>
          <button type="button" class="stat-big-btn" ${remainPts <= 0 ? 'disabled' : ''} onclick="addStatBulk('${m.key}', 5)">+5</button>
          <button type="button" class="stat-big-btn max-btn" ${remainPts <= 0 ? 'disabled' : ''} onclick="addStatBulk('${m.key}', 'MAX')">MAX</button>
        </div>
      </div>
    `;
  }).join('');

  const diffFmt = (before, after, suffix = '') => {
    const d = after - before;
    if (d === 0) return `<b style="color:#f3f4f6;">${after}${suffix}</b>`;
    return `<span style="color:#9ca3af;">${before}</span> → <b style="color:#4ade80;">${after}${suffix} (+${d}${suffix})</b>`;
  };

  body.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:center; background:#1a150e; border:1.5px solid #ca8a04; border-radius:7px; padding:7px 10px;">
      <span style="font-size:12px; font-weight:bold; color:#fef08a;">✨ 잔여 스탯 포인트</span>
      <span style="font-size:16px; font-weight:900; color:${remainPts > 0 ? '#4ade80' : '#9ca3af'};">${remainPts} P ${pendTotal > 0 ? `<span style="font-size:11px; color:#fde047;">(배분 대기: +${pendTotal})</span>` : ''}</span>
    </div>

    ${rowsHtml}

    <div style="background:#0c0e14; border:1px solid #3d3020; border-radius:7px; padding:8px 10px; font-size:11px; display:grid; grid-template-columns:1fr 1fr; gap:4px 10px;">
      <div>최대 HP: ${diffFmt(cStatsNow.calcMaxHp, cStatsPreview.calcMaxHp)}</div>
      <div>최대 MP: ${diffFmt(cStatsNow.calcMaxMp, cStatsPreview.calcMaxMp)}</div>
      <div>물리공격: ${diffFmt(cStatsNow.totalAtk, cStatsPreview.totalAtk)}</div>
      <div>마법공격: ${diffFmt(cStatsNow.totalMAtk, cStatsPreview.totalMAtk)}</div>
      <div>물리방어: ${diffFmt(cStatsNow.totalDef, cStatsPreview.totalDef)}</div>
      <div>마법방어: ${diffFmt(cStatsNow.totalMDef || 0, cStatsPreview.totalMDef || 0)}</div>
      <div style="grid-column: span 2;">치명/회피/블록: <b style="color:#fde047;">${cStatsPreview.critRate}% / ${cStatsPreview.evadeRate}% / ${cStatsPreview.blockRate}%</b></div>
    </div>

    <div style="display:flex; gap:6px; margin-top:2px;">
      <button type="button" class="auth-primary-btn" style="flex:1.5; padding:10px; font-size:13px; background:${pendTotal > 0 ? 'linear-gradient(180deg, #16a34a, #14532d)' : '#374151'}; border-color:${pendTotal > 0 ? '#4ade80' : '#6b7280'};" onclick="confirmStats()">✔ 스탯 적용 확정 ${pendTotal > 0 ? `(+${pendTotal})` : ''}</button>
      <button type="button" class="auth-sub-btn" style="flex:0.8; padding:10px; font-size:12px;" onclick="resetPendingStats()">초기화</button>
    </div>
    <button type="button" onclick="resetAllocatedStats()" style="width:100%; background:${resetCount > 0 ? '#1e3a8a' : '#1f2937'}; color:${resetCount > 0 ? '#93c5fd' : '#6b7280'}; border:1px solid ${resetCount > 0 ? '#60a5fa' : '#374151'}; border-radius:6px; padding:6px 0; font-size:10.5px; font-weight:bold; cursor:pointer;">🔄 투자 스탯 전체 회수 (${resetCount > 0 ? `가능 ${resetCount}회` : `Lv.${nextMilestone} 해금`})</button>
  `;
};

window.confirmStats = function() {
  const total = getPendingTotal();
  if (total <= 0) return;

  player.stats.STR += pendingStats.STR;
  player.stats.DEX += pendingStats.DEX;
  player.stats.INT += pendingStats.INT;
  player.stats.CON += pendingStats.CON;

  player.statPoints -= total;
  pendingStats = { STR: 0, DEX: 0, INT: 0, CON: 0 };

  recalcMaxHpMp(true);
  window.addChat(`✨ [스탯 적용] 배분한 스탯(+${total})이 캐릭터에 적용되었습니다!`, 'log-sys');
  window.triggerAutoSave?.('stat_confirm', true);
  renderEquipUI();
  window.renderStatAllocModal?.();
  updateStatusHUD();
};

window.resetPendingStats = function() {
  pendingStats = { STR: 0, DEX: 0, INT: 0, CON: 0 };
  renderEquipUI();
  window.renderStatAllocModal?.();
};

function getAvailableStatResetCount() {
  const stepLv = CLASS_STATS[player.class]?.fixedBaseStats?.resetStepLv || 50;
  const totalEarned = Math.floor((player.level || 1) / stepLv);
  const used = player.statResetUsed || 0;
  return Math.max(0, totalEarned - used);
}

window.resetAllocatedStats = function() {
  const stepLv = CLASS_STATS[player.class]?.fixedBaseStats?.resetStepLv || 50;
  const availCount = getAvailableStatResetCount();
  const nextMilestone = (Math.floor((player.level || 1) / stepLv) + 1) * stepLv;

  if (availCount <= 0) {
    window.addChat(`🔒 [스탯 초기화] 스탯 초기화는 ${stepLv}단위 레벨마다 1회씩 해금됩니다! (다음 해금: Lv.${nextMilestone})`, 'log-hit');
    return;
  }

  const base = CLASS_STATS[player.class].fixedBaseStats;
  const invested =
    (player.stats.STR - base.str) +
    (player.stats.DEX - base.dex) +
    (player.stats.INT - base.int) +
    (player.stats.CON - base.con);

  if (invested <= 0) {
    window.addChat(`⚠️ [스탯 초기화] 초기화할 투자 스탯이 없습니다.`, 'log-hit');
    return;
  }

  player.stats = { STR: base.str, DEX: base.dex, INT: base.int, CON: base.con };
  player.statPoints += invested;
  player.statResetUsed = (player.statResetUsed || 0) + 1;
  pendingStats = { STR: 0, DEX: 0, INT: 0, CON: 0 };
  recalcMaxHpMp(false);
  window.addChat(`🔄 [스탯 초기화 완료] 투자했던 스탯 ${invested} 포인트를 모두 회수했습니다! (잔여 초기화권: ${getAvailableStatResetCount()}회)`, 'log-kill');
  renderEquipUI();
  window.renderStatAllocModal?.();
  updateStatusHUD();
};

// 고스탯 구간에서 지나친 선형 폭주를 완화하는 소프트캡(Soft-Cap) 함수
function softScaleStat(statVal) {
  if (statVal <= 90) return statVal;
  if (statVal <= 200) return 90 + (statVal - 90) * 0.82;
  return 90 + 110 * 0.82 + (statVal - 200) * 0.65;
}

function calculateCombatStats(includePending = false) {
  let bonusSTR = 0, bonusDEX = 0, bonusINT = 0, bonusCON = 0;
  let bonusHp = 0, bonusMp = 0, hitBonus = 0, critBonus = 0, drainBonus = 0;
  let weaponAtk = 0, magicAtk = 0, weaponSpeedSec = 1.05;
  let sumDef = 0, sumMDef = 0;
  let enchantAtkBonus = 0, enchantDefBonus = 0, enchantHpBonus = 0;
  let armorPenPct = 0, coolReducePct = 0, bossDmgPct = 0, dmgReducePct = 0, bossDmgReducePct = 0, mpCostReducePct = 0;
  let hasSword = false, hasBow = false, hasStaff = false, hasShield = false;

  if (player.activeBuffs.ENCHANT_STAT > 0) {
    bonusSTR += 2; bonusDEX += 2; bonusINT += 2; bonusCON += 2;
  }
  if ((player.activeBuffs.MERC_BLESS || 0) > 0) {
    bonusSTR += 3; bonusDEX += 3; bonusINT += 3; bonusCON += 3;
  }

  const allSlots = ['weapon', 'shield', 'helmet', 'tshirt', 'armor', 'cloak', 'gloves', 'belt', 'boots', 'necklace', 'earring1', 'earring2', 'ring1', 'ring2'];
  allSlots.forEach(slot => {
    const eqIdx = player.equip[slot];
    if (eqIdx !== null && eqIdx !== undefined && player.inventory[eqIdx]) {
      const inst = player.inventory[eqIdx];
      const def = window.itemDict[inst.type] || {};
      const mult = inst.mult || (typeof def.fixedGrade === 'number' ? GameDB.ItemGrades[def.fixedGrade].mult : 1.0);
      const itemPlus = getItemPlusValue(inst, slot, 'player');
      const hiBon = getHighEnchantUtilityBonuses(itemPlus, slot === 'weapon');

      armorPenPct += hiBon.armorPenPct;
      coolReducePct += hiBon.coolReducePct;
      bossDmgPct += hiBon.bossDmgPct;
      dmgReducePct += hiBon.dmgReducePct;
      bossDmgReducePct += hiBon.bossDmgReducePct;
      mpCostReducePct += hiBon.mpCostReducePct;
      bonusHp += hiBon.extraHp;
      bonusMp += hiBon.extraMp;
      if (hiBon.allStat > 0) {
        bonusSTR += hiBon.allStat; bonusDEX += hiBon.allStat; bonusINT += hiBon.allStat; bonusCON += hiBon.allStat;
      }

      if (slot === 'weapon') {
        weaponAtk += Math.round((def.pAtk || 0) * mult);
        magicAtk += Math.round((def.mAtk || 0) * mult);
        // 고강화 시 단순 공격력 폭증을 억제하고 +7(관통+5%), +9(쿨감-8%), +10(보스추뎀+10%) 유틸리티로 전환!
        enchantAtkBonus += itemPlus * 3 + Math.min(6, Math.max(0, itemPlus - 6) * 2);
        if (def.atkSpeed) weaponSpeedSec = def.atkSpeed;
        if (def.coolReduce) coolReducePct += def.coolReduce;
        if (def.type?.includes('검')) hasSword = true;
        if (def.type?.includes('활')) hasBow = true;
        if (def.type?.includes('지팡이')) hasStaff = true;
      } else {
        if (def.def) sumDef += Math.round(def.def * mult);
        if (def.mDef) sumMDef += Math.round(def.mDef * mult);
        if (def.pAtk) weaponAtk += def.pAtk;
        if (def.mAtk) magicAtk += def.mAtk;
        // 방어구/장신구 고강화 시 단순 방어력 폭증 대신 +7(피해감쇄+3%), +9(쿨감-2%), +10(보스피감+4%·올스탯+1) 부여!
        enchantDefBonus += itemPlus * 2 + Math.min(4, Math.max(0, itemPlus - 4) * 1);
        enchantHpBonus += itemPlus * 8 + Math.min(28, Math.max(0, itemPlus - 4) * 6);
        if (slot === 'shield' && def.type?.includes('방패')) hasShield = true;
      }
      if (def.bonusStats?.mDef) sumMDef += def.bonusStats.mDef;

      if (def.weight) {
        bonusHp += def.weight * 2;
        bonusMp += Math.floor(def.weight * 0.8);
      }
      if (def.bonusMp) bonusMp += def.bonusMp;
      if (def.bonusHit) hitBonus += def.bonusHit;
      if (def.drain) drainBonus += def.drain;

      if (def.bonusStats) {
        bonusSTR += def.bonusStats.STR || 0;
        bonusDEX += def.bonusStats.DEX || 0;
        bonusINT += def.bonusStats.INT || 0;
        bonusCON += def.bonusStats.CON || 0;
        bonusHp  += def.bonusStats.maxHp || 0;
        bonusMp  += def.bonusStats.maxMp || 0;
        hitBonus += def.bonusStats.hit || 0;
        critBonus += def.bonusStats.crit || 0;
        drainBonus += def.bonusStats.drain || 0;
      }

      if (Array.isArray(inst.options)) {
        inst.options.forEach(opt => {
          if (opt.key === 'STR') bonusSTR += opt.val;
          else if (opt.key === 'DEX') bonusDEX += opt.val;
          else if (opt.key === 'INT') bonusINT += opt.val;
          else if (opt.key === 'CON') bonusCON += opt.val;
          else if (opt.key === 'maxHp') bonusHp += opt.val;
          else if (opt.key === 'maxMp') bonusMp += opt.val;
          else if (opt.key === 'hit') hitBonus += opt.val;
          else if (opt.key === 'crit') critBonus += opt.val;
          else if (opt.key === 'drain') drainBonus += opt.val;
          else if (opt.key === 'mDef') sumMDef += opt.val;
        });
      }
    }
  });

  const sSTR = player.stats.STR + bonusSTR + (includePending ? pendingStats.STR : 0);
  const sDEX = player.stats.DEX + bonusDEX + (includePending ? pendingStats.DEX : 0);
  const sINT = player.stats.INT + bonusINT + (includePending ? pendingStats.INT : 0);
  const sCON = player.stats.CON + bonusCON + (includePending ? pendingStats.CON : 0);

  const effScaledSTR = softScaleStat(sSTR);
  const effScaledDEX = softScaleStat(sDEX);
  const effScaledINT = softScaleStat(sINT);
  const effScaledCON = softScaleStat(sCON);

  const mainStatName = CLASS_STATS[player.class].mainStat;
  const mainStatVal = mainStatName === 'STR' ? effScaledSTR : (mainStatName === 'DEX' ? effScaledDEX : effScaledINT);

  // 🌟 전 클래스 패시브 및 버프 효과를 data.js(GameDB.Skills / GameDB.Items)에서 동적 참조
  let passiveAtkBonus = 0;
  let passiveMAtkBonus = 0;
  let passiveDefBonus = 0;
  let passiveMDefBonus = 0;
  let passiveEvadeBonus = 0;
  let passiveBlockBonus = 0;
  let passiveCritDmgPct = 0;
  let passiveMaxHpPct = 0;
  let passiveMaxMpPct = 0;

  const mySkillList = SKILLS_DB[player.class] || [];
  mySkillList.forEach(sk => {
    if (sk.type === '패시브' && isSkillLearned(sk.id)) {
      if (sk.reqWeapon === 'sword' && !hasSword) return;
      if (sk.reqWeapon === 'bow' && !hasBow) return;
      if (sk.reqWeapon === 'staff' && !hasStaff) return;
      if (sk.bonusAtk) passiveAtkBonus += sk.bonusAtk;
      if (sk.bonusMAtk) passiveMAtkBonus += sk.bonusMAtk;
      if (sk.bonusHit) hitBonus += sk.bonusHit;
      if (sk.bonusDef) passiveDefBonus += sk.bonusDef;
      if (sk.bonusMDef) passiveMDefBonus += sk.bonusMDef;
      if (sk.bonusBlock) passiveBlockBonus += sk.bonusBlock;
      if (sk.bonusCrit) critBonus += sk.bonusCrit;
      if (sk.bonusEvade) passiveEvadeBonus += sk.bonusEvade;
      if (sk.bonusArmorPen) armorPenPct += sk.bonusArmorPen;
      if (sk.bonusCoolReduce) coolReducePct += sk.bonusCoolReduce;
      if (sk.bossDmgReducePct) bossDmgReducePct += sk.bossDmgReducePct;
      if (sk.bonusMaxHpPct) passiveMaxHpPct += sk.bonusMaxHpPct;
      if (sk.bonusMaxMpPct) passiveMaxMpPct += sk.bonusMaxMpPct;
      if (sk.bonusCritDmgPct) passiveCritDmgPct += sk.bonusCritDmgPct;
    }
  });

  const allSkillsFlat = [...(GameDB.Skills.Mage || []), ...(GameDB.Skills.Archer || []), ...(GameDB.Skills.Warrior || [])];
  const findBuffSkill = (bKey) => allSkillsFlat.find(s => s.buffKey === bKey);

  if (player.activeBuffs.SHADOW_FANG > 0) {
    const sf = findBuffSkill('SHADOW_FANG');
    passiveAtkBonus += (sf?.bonusAtk ?? 15);
    passiveMAtkBonus += (sf?.bonusMAtk ?? 15);
  }
  if (player.activeBuffs.HOLY_WEAPON > 0) { passiveAtkBonus += 12; passiveMAtkBonus += 12; }

  const elixirDef = window.itemDict?.['C_P05'];
  const elixirAtkMult = 1 + ((elixirDef?.atkBoostPct ?? 12) / 100);
  const rageSk = findBuffSkill('RAGE');
  const rageAtkMult = 1 + ((rageSk?.atkMultPct ?? 32) / 100);
  const rageDefMult = Math.max(0.1, 1 - ((rageSk?.defPenaltyPct ?? 10) / 100));
  const shieldSk = findBuffSkill('SHIELD');
  const ironSkinSk = findBuffSkill('IRON_SKIN');
  const guardianArmorSk = findBuffSkill('GUARDIAN_ARMOR');
  if ((player.activeBuffs.IRON_SKIN || 0) > 0) {
    passiveDefBonus += (ironSkinSk?.bonusDef ?? 16);
    passiveMDefBonus += (ironSkinSk?.bonusMDef ?? 12);
    dmgReducePct += (ironSkinSk?.dmgReducePct ?? 8);
  }
  if ((player.activeBuffs.GUARDIAN_ARMOR || 0) > 0) {
    passiveDefBonus += (guardianArmorSk?.bonusDef ?? 32);
    passiveMDefBonus += (guardianArmorSk?.bonusMDef ?? 24);
    passiveBlockBonus += (guardianArmorSk?.bonusBlock ?? 12);
    dmgReducePct += (guardianArmorSk?.dmgReducePct ?? 15);
    bossDmgReducePct += (guardianArmorSk?.bossDmgReducePct ?? 10);
    passiveMaxHpPct += (guardianArmorSk?.bonusMaxHpPct ?? 15);
  }

  // ⚖️ [장비 의존도 및 맨손/무방비 밸런스 검증 반영]
  // - 무기를 장착하지 않은 맨손 상태에서는 스탯 공격력 효율이 38%로 제한되며 공속이 느려집니다.
  // - 무기 장착 시 무기의 공격력(weaponAtk/magicAtk)과 스탯이 시너지를 내도록 설계하여 상위 장비 파밍·착용 가치를 대폭 높였습니다.
  const hasAnyWeapon = hasSword || hasBow || hasStaff || (player.equip.weapon !== null && Boolean(player.inventory[player.equip.weapon]));
  if (!hasAnyWeapon) {
    weaponSpeedSec = 1.32;
  }
  const armorSlotsList = ['helmet', 'tshirt', 'armor', 'cloak', 'gloves', 'belt', 'boots', 'shield'];
  let equippedArmorCount = 0;
  armorSlotsList.forEach(sk => {
    if (player.equip[sk] !== null && player.equip[sk] !== undefined && player.inventory[player.equip[sk]]) {
      equippedArmorCount++;
    }
  });
  const hasBodyArmor = Boolean(player.equip.armor !== null && player.equip.armor !== undefined && player.inventory[player.equip.armor]);

  const weaponStatSynergy = hasAnyWeapon ? (0.86 + Math.min(0.65, (weaponAtk + enchantAtkBonus) / 115)) : 0.38;
  const magicWeaponSynergy = hasAnyWeapon ? (0.92 + Math.min(0.75, (magicAtk + enchantAtkBonus) / 110)) : 0.42;

  const baseClassAtkMult = CLASS_STATS[player.class]?.atkMult ?? 1.0;
  let rawPAtk = Math.max(4, Math.floor((mainStatVal * weaponStatSynergy + weaponAtk * 1.15 + enchantAtkBonus + passiveAtkBonus) * baseClassAtkMult));
  if (player.activeBuffs.ELIXIR > 0) rawPAtk = Math.floor(rawPAtk * elixirAtkMult);
  if ((player.activeBuffs.MERC_BLESS || 0) > 0) rawPAtk = Math.floor(rawPAtk * 1.10);
  if (player.activeBuffs.RAGE > 0) rawPAtk = Math.floor(rawPAtk * rageAtkMult);

  const baseClassMagicMult = CLASS_STATS[player.class]?.magicMult ?? 1.0;
  let rawMAtk = Math.max(5, Math.floor((effScaledINT * magicWeaponSynergy + magicAtk * 1.18 + enchantAtkBonus + passiveMAtkBonus) * baseClassMagicMult));
  if (player.activeBuffs.ELIXIR > 0) rawMAtk = Math.floor(rawMAtk * elixirAtkMult);
  if ((player.activeBuffs.MERC_BLESS || 0) > 0) rawMAtk = Math.floor(rawMAtk * 1.10);

  // 방어력은 순수 CON 스탯만으로는 낮게(0.38배) 오르며, 갑옷·방어구 착용(sumDef)이 핵심 방어력을 담당합니다.
  let totalDef = Math.floor(effScaledCON * 0.38 + sumDef * 1.08 + enchantDefBonus + passiveDefBonus + (player.activeBuffs.SHIELD > 0 ? (shieldSk?.bonusDef ?? 10) : 0) + ((player.activeBuffs.MERC_BLESS || 0) > 0 ? 10 : 0));
  if (player.activeBuffs.RAGE > 0) totalDef = Math.max(0, Math.floor(totalDef * rageDefMult));

  const elvenGraceSk = findBuffSkill('ELVEN_GRACE');
  const soulBarrierSk = findBuffSkill('SOUL_BARRIER');
  const lightSk = findBuffSkill('LIGHT');
  const baseClass = CLASS_STATS[player.class];

  // 🔮 마법방어력(totalMDef) 산출: 클래스 기본 마방 + 레벨당 마방 + INT/CON 저항 + 장비 마방(sumMDef) + 강화/패시브/버프 누적 합산
  let totalMDef = Math.floor(
    (baseClass.baseMDef ?? 6) +
    (player.level - 1) * (baseClass.mDefPerLv ?? 1.2) +
    effScaledINT * 0.52 +
    effScaledCON * 0.28 +
    sumMDef * 1.10 +
    Math.floor(enchantDefBonus * 0.85) +
    passiveMDefBonus +
    (player.activeBuffs.SHIELD > 0 ? (shieldSk?.bonusMDef ?? 6) : 0) +
    ((player.activeBuffs.LIGHT || 0) > 0 ? (lightSk?.bonusMDef ?? 8) : 0) +
    (player.activeBuffs.ELVEN_GRACE > 0 ? (elvenGraceSk?.bonusMDef ?? 10) : 0) +
    (player.activeBuffs.SOUL_BARRIER > 0 ? (soulBarrierSk?.bonusMDef ?? 25) : 0) +
    ((player.activeBuffs.MERC_BLESS || 0) > 0 ? 10 : 0)
  );

  let blockRate = hasShield ? Math.min(45, 8 + Math.floor(effScaledCON * 0.25) + passiveBlockBonus) : 0;
  let evadeRate = Math.min(52, Math.floor(effScaledDEX * 0.30) + passiveEvadeBonus + (player.activeBuffs.ELVEN_GRACE > 0 ? (elvenGraceSk?.bonusEvade ?? 20) : 0) + (player.activeBuffs.SOUL_BARRIER > 0 ? (soulBarrierSk?.bonusEvade ?? 45) : 0));
  let critRate = Math.min(72, 5 + Math.floor(effScaledDEX * 0.32) + (player.class === 'wizard' ? Math.floor(effScaledINT * 0.18) : 0) + critBonus);
  let critDmgMult = 1.5 + (passiveCritDmgPct / 100);

  const hpPerLv = baseClass.hpPerLv ?? 30;
  const mpPerLv = baseClass.mpPerLv ?? 15;
  const hpPerCon = baseClass.hpPerCon ?? 14;
  const mpPerInt = baseClass.mpPerInt ?? 10;

  let calcMaxHp = baseClass.baseHp + (player.level - 1) * hpPerLv + sCON * hpPerCon + bonusHp + enchantHpBonus;
  let calcMaxMp = baseClass.baseMp + (player.level - 1) * mpPerLv + sINT * mpPerInt + bonusMp;
  if (passiveMaxHpPct > 0) calcMaxHp = Math.floor(calcMaxHp * (1 + passiveMaxHpPct / 100));
  if (passiveMaxMpPct > 0) calcMaxMp = Math.floor(calcMaxMp * (1 + passiveMaxMpPct / 100));
  if (player.activeBuffs.ADV_SPIRIT > 0) {
    const advSk = findBuffSkill('ADV_SPIRIT');
    const advMult = 1 + ((advSk?.bonusMaxHpMpPct ?? 20) / 100);
    calcMaxHp = Math.floor(calcMaxHp * advMult);
    calcMaxMp = Math.floor(calcMaxMp * advMult);
  }

  return {
    totalAtk: rawPAtk,
    totalMAtk: rawMAtk,
    totalDef,
    totalMDef,
    blockRate,
    evadeRate,
    critRate,
    critDmgMult,
    hitBonus: hitBonus + Math.floor(effScaledDEX * 0.35) + (player.activeBuffs.EAGLE_EYE > 0 ? 8 : 0) + ((player.activeBuffs.LIGHT || 0) > 0 ? 6 : 0),
    drainBonus: Math.min(18, drainBonus),
    armorPenPct: Math.min(55, armorPenPct),
    coolReducePct: Math.min(40, coolReducePct),
    bossDmgPct: Math.min(65, bossDmgPct),
    dmgReducePct: Math.min(38, dmgReducePct),
    bossDmgReducePct: Math.min(45, bossDmgReducePct),
    mpCostReducePct: Math.min(30, mpCostReducePct),
    weaponSpeedSec,
    calcMaxHp,
    calcMaxMp,
    hasAnyWeapon,
    hasBodyArmor,
    equippedArmorCount,
    effSTR: sSTR, effDEX: sDEX, effINT: sINT, effCON: sCON
  };
}

function recalcMaxHpMp(healDelta = false) {
  const cStats = calculateCombatStats(false);
  const oldMaxHp = player.maxHp;
  const oldMaxMp = player.maxMp;
  player.maxHp = cStats.calcMaxHp;
  player.maxMp = cStats.calcMaxMp;
  if (healDelta) {
    if (player.maxHp > oldMaxHp) player.hp += (player.maxHp - oldMaxHp);
    if (player.maxMp > oldMaxMp) player.mp += (player.maxMp - oldMaxMp);
  }
  player.hp = Math.min(player.maxHp, player.hp);
  player.mp = Math.min(player.maxMp, player.mp);
}

// ============================================================================
// 🖐️ 모바일/PC 겸용 드래그 앤 드롭 & 단축슬롯 제어
// ============================================================================
let touchDragPayload = null;
window._lastInvTouchDragEndTime = 0;

function hideTouchDragGhost() {
  const ghost = document.getElementById('touch-drag-ghost');
  if (ghost) {
    ghost.style.display = 'none';
    ghost.innerHTML = '';
  }
  touchDragPayload = null;
}
window._isTouchDraggingSlot = false;
window.addEventListener('blur', () => {
  window._isTouchDraggingSlot = false;
  hideTouchDragGhost();
});

function clearHotbarDragHighlights() {
  for (let i = 1; i <= 9; i++) {
    document.getElementById(`slot-${i}`)?.classList.remove('drag-over-target');
  }
}

function resolveQuickSlotAtPoint(clientX, clientY) {
  if (typeof clientX !== 'number' || typeof clientY !== 'number') return null;
  const hitEl = document.elementFromPoint(clientX, clientY);
  const directSlot = hitEl?.closest?.('.slot[data-slot]');
  if (directSlot) {
    const n = Number(directSlot.getAttribute('data-slot'));
    if (n >= 1 && n <= 9) return { slotNum: n, slotEl: directSlot };
  }
  // 모바일 손가락 끝 오차를 고려한 핫바 슬롯(1~9) 여유 히트박스 판정 (±12px)
  for (let i = 1; i <= 9; i++) {
    const sEl = document.getElementById(`slot-${i}`);
    if (!sEl) continue;
    const r = sEl.getBoundingClientRect();
    if (clientX >= r.left - 8 && clientX <= r.right + 8 && clientY >= r.top - 12 && clientY <= r.bottom + 12) {
      return { slotNum: i, slotEl: sEl };
    }
  }
  return null;
}

function setupTouchDragSource(el, payloadGetter) {
  let startX = 0;
  let startY = 0;
  let lastMoveX = 0;
  let lastMoveY = 0;
  let downTime = 0;
  let dragging = false;
  let scrollingGrid = false;
  let scrollContainer = null;
  let startScrollTop = 0;
  const ghost = document.getElementById('touch-drag-ghost');

  el.addEventListener('pointerdown', (e) => {
    if (e.button && e.button !== 0) return;
    if (document.getElementById('multi-select-toggle')?.checked) return;

    startX = e.clientX;
    startY = e.clientY;
    lastMoveX = e.clientX;
    lastMoveY = e.clientY;
    downTime = Date.now();
    dragging = false;
    scrollingGrid = false;
    scrollContainer = el.closest('#inventory-grid, #skill-grid, .inventory-grid, .skill-grid');
    startScrollTop = scrollContainer ? scrollContainer.scrollTop : 0;
    window._isTouchDraggingSlot = false;

    const cleanupListeners = () => {
      window._isTouchDraggingSlot = false;
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onCancel);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
      window.removeEventListener('touchcancel', onCancel);
      clearHotbarDragHighlights();
      if (window._pendingInventoryRenderAfterDrag) {
        window._pendingInventoryRenderAfterDrag = false;
        setTimeout(() => {
          if (!window._isTouchDraggingSlot && !document.getElementById('inventory-ui')?.classList.contains('hidden')) {
            window.renderInventory?.();
          }
        }, 60);
      }
    };

    const handleDragMoveCoords = (cx, cy, rawEv) => {
      const dx = cx - startX;
      const dy = cy - startY;
      const dist = Math.hypot(dx, dy);
      lastMoveX = cx;
      lastMoveY = cy;

      // 📱 스마트폰/터치 환경에서 인벤토리·스킬 그리드 상하 스크롤 제스처 우선 보장!
      if (!dragging && scrollContainer && dist > 6) {
        const heldMs = Date.now() - downTime;
        const isVerticalSwipe = Math.abs(dy) >= Math.abs(dx) * 0.85;
        const rect = scrollContainer.getBoundingClientRect();
        const insideGrid = (cy >= rect.top - 12 && cy <= rect.bottom + 12);
        if (scrollingGrid || (isVerticalSwipe && heldMs < 220 && insideGrid)) {
          scrollingGrid = true;
          window._lastInvTouchDragEndTime = Date.now();
          // 브라우저 기본 스크롤과 함께 직접 scrollTop 보정도 수행하여 모든 모바일 브라우저에서 100% 상하 리스팅 작동 보장
          const targetScroll = startScrollTop - dy;
          if (Math.abs(scrollContainer.scrollTop - targetScroll) > 1) {
            scrollContainer.scrollTop = targetScroll;
          }
          return;
        }
      }

      if (scrollingGrid) {
        window._lastInvTouchDragEndTime = Date.now();
        if (scrollContainer) {
          scrollContainer.scrollTop = startScrollTop - dy;
        }
        return;
      }

      if (!dragging && dist > 9) {
        touchDragPayload = payloadGetter();
        if (!touchDragPayload) return;
        dragging = true;
        window._isTouchDraggingSlot = true;
        if (ghost) {
          ghost.innerHTML = touchDragPayload.html || '📦';
          ghost.style.left = `${cx}px`;
          ghost.style.top = `${cy}px`;
          ghost.style.display = 'flex';
        }
      }
      if (dragging) {
        if (rawEv && rawEv.cancelable) {
          try { rawEv.preventDefault(); } catch (err) {}
        }
        if (ghost) {
          ghost.style.left = `${cx}px`;
          ghost.style.top = `${cy}px`;
        }
        clearHotbarDragHighlights();
        const found = resolveQuickSlotAtPoint(cx, cy);
        if (found && found.slotEl) {
          found.slotEl.classList.add('drag-over-target');
        }
      }
    };

    const finishDropAtCoords = (cx, cy) => {
      cleanupListeners();
      const wasDragging = dragging;
      const activePayload = touchDragPayload;
      dragging = false;
      hideTouchDragGhost();

      if (wasDragging && activePayload) {
        window._lastInvTouchDragEndTime = Date.now();
        const found = resolveQuickSlotAtPoint(cx, cy) || resolveQuickSlotAtPoint(lastMoveX, lastMoveY);
        if (found && found.slotNum >= 1 && found.slotNum <= 9) {
          assignToQuickSlot(found.slotNum, activePayload);
        }
      }
    };

    const onMove = (me) => {
      handleDragMoveCoords(me.clientX, me.clientY, me);
    };

    const onTouchMove = (te) => {
      const t = te.touches?.[0] || te.changedTouches?.[0];
      if (t) handleDragMoveCoords(t.clientX, t.clientY, te);
    };

    const onUp = (ue) => {
      finishDropAtCoords(ue.clientX, ue.clientY);
    };

    const onTouchEnd = (te) => {
      if (!dragging) return;
      const t = te.changedTouches?.[0];
      finishDropAtCoords(t ? t.clientX : lastMoveX, t ? t.clientY : lastMoveY);
    };

    const onCancel = () => {
      // pointercancel이 발생하더라도 이미 핫바 슬롯 위까지 드래그한 상태라면 드롭 성공으로 처리!
      if (dragging && touchDragPayload) {
        const found = resolveQuickSlotAtPoint(lastMoveX, lastMoveY);
        if (found && found.slotNum >= 1 && found.slotNum <= 9) {
          const payloadCopy = touchDragPayload;
          cleanupListeners();
          window._lastInvTouchDragEndTime = Date.now();
          dragging = false;
          hideTouchDragGhost();
          assignToQuickSlot(found.slotNum, payloadCopy);
          return;
        }
      }
      cleanupListeners();
      if (dragging) window._lastInvTouchDragEndTime = Date.now();
      dragging = false;
      hideTouchDragGhost();
    };

    window.addEventListener('pointermove', onMove, { passive: false });
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onCancel);
    window.addEventListener('touchmove', onTouchMove, { passive: false });
    window.addEventListener('touchend', onTouchEnd, { passive: true });
    window.addEventListener('touchcancel', onCancel, { passive: true });
  });
}

function assignToQuickSlot(slotNum, payload) {
  if (payload.type === 'skill') {
    let sInfo = SKILLS_DB[player.class].find(s => s.name === payload.name);
    if (!sInfo) return;
    if (!isSkillLearned(sInfo)) {
      window.addChat(`🔒 [미습득 스킬] '${sInfo.name}'은(는) 아직 습득하지 않았습니다! (${sInfo.npcLearn ? '마법상인 NPC에게서 습득' : '몬스터 사냥 시 마법서/비급 드롭'})`, 'log-hit');
      return;
    }
    if (sInfo.type === '패시브') {
      window.addChat(`⚠️ 패시브 스킬은 단축슬롯에 장착할 수 없습니다.`, 'log-hit');
      return;
    }
    window.skillSlots[slotNum] = { type: 'skill', name: payload.name };
    window.addChat(`📕 [단축슬롯 ${slotNum}번] '${payload.name}' 스킬 장착 완료!`, 'log-sys');
    window.selectedSkillForSlot = null;
  } else if (payload.type === 'item') {
    window.skillSlots[slotNum] = { type: 'item', itemType: payload.itemType };
    const iName = window.itemDict[payload.itemType]?.name || payload.itemType;
    window.addChat(`🎒 [단축슬롯 ${slotNum}번] '${iName}' 아이템 장착 완료!`, 'log-sys');
  }
  renderHotbarSlots();
}

window.renderHotbarSlots = function() {
  for (let i = 1; i <= 9; i++) {
    const slotEl = document.getElementById(`slot-${i}`);
    if (!slotEl) continue;
    const iconEl = slotEl.querySelector('.slot-icon');
    let oldQty = slotEl.querySelector('.slot-qty');
    if (oldQty) oldQty.remove();

    const data = window.skillSlots[i];
    if (!data) {
      iconEl.innerHTML = '';
      slotEl.classList.remove('auto-active');
      window.autoSlots.delete(i);
      continue;
    }

    if (data.type === 'skill') {
      iconEl.innerHTML = window.getSkillIconHTML(data.name, 26);
    } else if (data.type === 'item') {
      iconEl.innerHTML = window.getItemIconHTML(data.itemType);
      const totalQty = player.inventory
        .filter(it => it && it.type === data.itemType)
        .reduce((acc, cur) => acc + cur.qty, 0);
      const qtySpan = document.createElement('span');
      qtySpan.className = 'slot-qty';
      qtySpan.innerText = totalQty;
      qtySpan.style.color = totalQty > 0 ? '#fff' : '#ef4444';
      slotEl.appendChild(qtySpan);
    }
  }
};

window.clearQuickSlot = function(slotNum) {
  if (!window.skillSlots[slotNum]) return;
  const old = window.skillSlots[slotNum];
  const label = old.type === 'skill' ? old.name : (window.itemDict[old.itemType]?.name || old.itemType);
  window.skillSlots[slotNum] = null;
  window.autoSlots.delete(slotNum);
  document.getElementById(`slot-${slotNum}`)?.classList.remove('auto-active');
  renderHotbarSlots();
  window.addChat(`🗑️ [단축슬롯 ${slotNum}번] '${label}' 등록이 해제되었습니다.`, 'log-sys');
};

function bindQuickSlotEvents() {
  for (let i = 1; i <= 9; i++) {
    const slotEl = document.getElementById(`slot-${i}`);
    if (!slotEl) continue;

    let pressTimer = null;
    let longPressTriggered = false;
    let lastTap = 0;

    slotEl.addEventListener('pointerdown', (e) => {
      if (e.button && e.button !== 0) return;
      longPressTriggered = false;
      clearTimeout(pressTimer);
      pressTimer = setTimeout(() => {
        if (window.skillSlots[i]) {
          longPressTriggered = true;
          window.clearQuickSlot(i);
        }
      }, 550);
    });

    slotEl.addEventListener('pointerup', (e) => {
      if (e.button && e.button !== 0) return;
      clearTimeout(pressTimer);
      if (longPressTriggered) return;

      const now = Date.now();
      if (now - lastTap < 300) {
        lastTap = 0;
        window.toggleAutoUse(i);
      } else {
        lastTap = now;
        window.useSlot(i, false);
      }
    });

    slotEl.addEventListener('pointerleave', () => clearTimeout(pressTimer));
    slotEl.addEventListener('pointercancel', () => clearTimeout(pressTimer));
    slotEl.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      window.toggleAutoUse(i);
    });
  }
}

let currentSkillTab = '액티브';
let currentSkillCircleFilter = 'ALL';

window.toggleSkillUI = function() {
  ensureAllGameModals();
  const ui = document.getElementById('skill-ui');
  if (!ui) return;
  ui.classList.toggle('hidden');
  if (!ui.classList.contains('hidden')) {
    window.bringModalToFront?.(ui);
    renderSkills(currentSkillTab);
    window.centerModalOnScreen?.(ui);
  }
};

window.setSkillCircleFilter = function(cVal) {
  currentSkillCircleFilter = String(cVal);
  window.renderSkills();
};

window.renderSkills = function(tabName) {
  if (tabName && tabName !== currentSkillTab) {
    currentSkillTab = tabName;
    currentSkillCircleFilter = 'ALL';
  } else if (tabName) {
    currentSkillTab = tabName;
  }
  if (!player.learnedSkills) window.initDefaultLearnedSkills(player.class);

  document.querySelectorAll('.tab-btn').forEach(b => {
    if (b.innerText.includes(currentSkillTab === 'active' || currentSkillTab === '액티브' ? '액티브' : '패시브')) {
      b.classList.add('active');
    } else {
      b.classList.remove('active');
    }
  });

  window.selectedSkillForSlot = null;
  const detailEl = document.getElementById('skill-detail');
  if (detailEl) {
    detailEl.innerHTML = `스킬을 터치하면 서클·쿨타임·습득처가 표시됩니다. (습득한 스킬만 슬롯 1~9에 장착 가능)`;
  }

  const grid = document.getElementById('skill-grid');
  if (!grid) return;
  grid.innerHTML = '';
  const skills = SKILLS_DB[player.class] || [];

  const isActiveTab = (currentSkillTab === 'active' || currentSkillTab === '액티브');
  let baseFiltered = skills.filter(s => isActiveTab ? s.type !== '패시브' : s.type === '패시브');

  // 서클별 필터 바 동적 생성
  let circleBar = document.getElementById('skill-circle-filter-bar');
  if (!circleBar && grid.parentElement) {
    circleBar = document.createElement('div');
    circleBar.id = 'skill-circle-filter-bar';
    circleBar.style.cssText = 'display:flex; gap:3px; flex-wrap:wrap; margin-bottom:4px;';
    grid.parentElement.insertBefore(circleBar, grid);
  }
  if (circleBar) {
    if (!isActiveTab) {
      circleBar.style.display = 'none';
    } else {
      circleBar.style.display = 'flex';
      const circles = Array.from(new Set(baseFiltered.map(s => s.circle || 1))).sort((a, b) => a - b);
      let barHtml = `<button class="circle-tab-btn ${currentSkillCircleFilter === 'ALL' ? 'active' : ''}" onclick="setSkillCircleFilter('ALL')">전체 서클</button>`;
      circles.forEach(c => {
        barHtml += `<button class="circle-tab-btn ${String(currentSkillCircleFilter) === String(c) ? 'active' : ''}" onclick="setSkillCircleFilter('${c}')">${c}서클</button>`;
      });
      circleBar.innerHTML = barHtml;
    }
  }

  const finalSkills = (isActiveTab && currentSkillCircleFilter !== 'ALL')
    ? baseFiltered.filter(s => String(s.circle || 1) === String(currentSkillCircleFilter))
    : baseFiltered;

  grid.scrollTop = 0;
  let currentCircleGroup = -999;
  finalSkills.forEach(skill => {
    const cNum = skill.circle || 0;
    if (isActiveTab && currentSkillCircleFilter === 'ALL' && cNum !== currentCircleGroup) {
      currentCircleGroup = cNum;
      const hdr = document.createElement('div');
      hdr.style.cssText = 'flex: 0 0 100%; width:100%; font-size:10px; font-weight:bold; color:#fde047; background:#1c1917; border-left:3px solid #facc15; padding:2px 6px; margin:2px 0; border-radius:3px; display:flex; justify-content:space-between;';
      const srcNote = skill.npcLearn ? '마법상인 NPC 습득 가능' : `몬스터 마법서/비급 드롭 (Lv.${skill.dropMinLv || 15}+)`;
      hdr.innerHTML = `<span>✨ ${cNum}서클</span><span style="font-size:9px; color:#93c5fd;">${srcNote}</span>`;
      grid.appendChild(hdr);
    }

    const learned = isSkillLearned(skill);
    const reqLv = skill.reqLv || 1;
    let div = document.createElement('div');
    div.className = 'skill-card';
    div.style.cssText = `background:${learned ? '#1f2937' : '#111318'}; opacity:${learned ? '1' : '0.62'}; padding:4px; border:1.5px solid ${learned ? '#eab308' : '#374151'}; border-radius:6px; cursor:pointer; text-align:center; width:62px; height:68px; display:flex; flex-direction:column; justify-content:center; align-items:center; box-shadow:inset 0 0 5px #000; position:relative;`;
    div.draggable = learned && skill.type !== '패시브';
    div.innerHTML = `
      ${window.getSkillIconHTML(skill.name, 32)}
      <div style="font-size:8.5px; word-break:keep-all; margin-top:3px; font-weight:bold; color:${learned ? '#f3f4f6' : '#9ca3af'}; line-height:1.1;">${skill.name}</div>
      ${!learned ? `<span style="position:absolute; top:1px; left:2px; font-size:8px; color:#fde047; background:rgba(0,0,0,0.85); padding:0 2px; border-radius:3px;">🔒${reqLv > 1 ? 'Lv.' + reqLv : ''}</span>` : ''}
    `;

    div.onclick = () => {
      window.selectedSkillForSlot = (learned && skill.type !== '패시브') ? skill : null;
      const detail = document.getElementById('skill-detail');
      if (detail) {
        const cLabel = skill.circle ? `${skill.circle}서클` : `패시브(요구 Lv.${reqLv})`;
        let acquireHint = '';
        if (learned) {
          acquireHint = skill.type !== '패시브'
            ? `<div style="margin-top:2px; color:#4ade80; font-weight:bold; text-align:center; font-size:9.5px;">💡 하단 슬롯(1~9)으로 드래그하거나 슬롯을 터치해 장착하세요! ${skill.allyCast ? '(용병/타플레이어 지원 가능)' : ''}</div>`
            : `<div style="margin-top:2px; color:#60a5fa; font-weight:bold; text-align:center; font-size:9.5px;">✔️ 습득 완료 (상시 패시브 효과 적용 중)</div>`;
        } else if (skill.npcLearn) {
          const canLearnNow = player.level >= reqLv;
          acquireHint = `<div style="margin-top:3px; display:flex; justify-content:space-between; align-items:center; font-size:9.5px;">
            <span style="color:${canLearnNow ? '#fde047' : '#fca5a5'}; font-weight:bold;">🔒 미습득 (요구 Lv.${reqLv} / 비용: ${skill.learnGold || 0}G)</span>
            <button class="shop-buy-btn" style="padding:2px 7px; font-size:9px; background:${canLearnNow ? '#15803d' : '#374151'}; border-color:${canLearnNow ? '#4ade80' : '#6b7280'};" onclick="learnSkillFromNpc('${skill.id}')">${canLearnNow ? `💰 ${skill.learnGold || 0}G 즉시습득` : `Lv.${reqLv} 필요`}</button>
          </div>`;
        } else {
          acquireHint = `<div style="margin-top:2px; color:#fca5a5; font-weight:bold; text-align:center; font-size:9.5px;">🔒 미습득: Lv.${skill.dropMinLv || 15}+ 몬스터 드롭 [${skill.name}] 비전서 더블터치로 습득</div>`;
        }

        detail.innerHTML = `
          <div style="display:flex; align-items:center; justify-content:space-between; color:#facc15; font-size:13.5px; font-weight:900; margin-bottom:3px; border-bottom:1px solid #3d3020; padding-bottom:3px;">
            <div style="display:flex; align-items:center; gap:6px;">${window.getSkillIconHTML(skill.name, 22)} <span>[${cLabel}] ${skill.name}</span></div>
            <span style="font-size:11.5px; color:#93c5fd; font-weight:bold;">${skill.type}/${skill.range || '본인'} ${skill.mp ? `| MP:${skill.mp}` : ''} | 쿨:${skill.cool || 0}s</span>
          </div>
          <div style="color:#f3f4f6; background:#000; padding:4px 6px; border-radius:4px; font-size:12px; font-weight:bold;">${skill.effect}</div>
          ${acquireHint}
        `;
      }
    };

    if (learned && skill.type !== '패시브') {
      div.ondragstart = (e) => {
        e.dataTransfer.setData("type", "skill");
        e.dataTransfer.setData("name", skill.name);
      };
      setupTouchDragSource(div, () => ({ type: 'skill', name: skill.name, html: window.getSkillIconHTML(skill.name, 28) }));
    }
    grid.appendChild(div);
  });
};

window.allowDrop = function(ev) {
  ev.preventDefault();
  const slotEl = ev.currentTarget || ev.target?.closest?.('.slot[data-slot]');
  if (slotEl) slotEl.classList.add('drag-over-target');
};

window.dropSkill = function(ev, slotNum) {
  ev.preventDefault();
  clearHotbarDragHighlights();
  let type = ev.dataTransfer?.getData("type");
  if (type === "skill") {
    assignToQuickSlot(slotNum, { type: 'skill', name: ev.dataTransfer.getData("name") });
  } else if (type === "item") {
    assignToQuickSlot(slotNum, { type: 'item', itemType: ev.dataTransfer.getData("itemType") });
  } else if (touchDragPayload) {
    assignToQuickSlot(slotNum, touchDragPayload);
    hideTouchDragGhost();
  }
};

window.toggleAutoUse = function(num) {
  let el = document.getElementById(`slot-${num}`);
  if (!el || !window.skillSlots[num]) return;
  if (window.autoSlots.has(num)) {
    window.autoSlots.delete(num);
    el.classList.remove('auto-active');
    window.addChat(`⏹️ [단축슬롯 ${num}번] 자동 사용 해제`, 'log-sys');
  } else {
    window.autoSlots.add(num);
    el.classList.add('auto-active');
    let slotData = window.skillSlots[num];
    if (slotData?.type === 'item') {
      window.addChat(`🔴 [단축슬롯 ${num}번] 물약 자동 복용 활성화!`, 'log-sys');
    } else {
      window.addChat(`🔴 [단축슬롯 ${num}번] '${slotData.name}' 스킬 자동 발동 활성화!`, 'log-sys');
    }
  }
};

window.toggleAutoAttack = function() {
  if (!window.isAutoAttack && isInsideSafeZone(player.x, player.y)) {
    window.addChat(`🛡️ [안전지대] 마을(S) 및 야영지(S1) 안전지대 내부에서는 자동사냥을 켤 수 없습니다!`, 'log-hit');
    return;
  }
  window.isAutoAttack = !window.isAutoAttack;
  let el = document.getElementById('slot-10');
  if (window.isAutoAttack) {
    if (el) el.classList.add('slot-10-auto');
    player.manualMoving = false;
    window.addChat(`⚔️ [자동 사냥] 시작! (원거리 클래스는 원형 카이팅 & 피격 시 우선 반격 기동 수행)`, 'log-sys');
  } else {
    if (el) el.classList.remove('slot-10-auto');
    window.clearTarget();
    player.isMoving = false;
    player.path = [];
    window.addChat(`⚔️ [자동 사냥] 종료.`, 'log-sys');
  }
};

window.toggleEquipUI = function() {
  ensureAllGameModals();
  const ui = document.getElementById('equip-ui');
  if (!ui) return;
  ui.classList.toggle('hidden');
  if (!ui.classList.contains('hidden')) {
    window.bringModalToFront?.(ui);
    renderEquipUI();
    window.centerModalOnScreen?.(ui);
  }
};

function renderEquipUI() {
  let statLeft = document.getElementById('stat-left-panel');
  let paperdoll = document.getElementById('paperdoll-panel');
  if (!statLeft || !paperdoll) return;

  const pendTotal = getPendingTotal();
  const remainPts = player.statPoints - pendTotal;
  const cStats = calculateCombatStats(true);

  const statRowHTML = (key, effVal) => {
    const baseVal = player.stats[key];
    const eqBonus = effVal - baseVal - pendingStats[key];
    const addVal = pendingStats[key];
    return `
      <div style="display:flex; justify-content:space-between; align-items:center; padding:0.5px 0; min-height:18px;">
        <span style="font-size:10px;">${key}: <b style="color:#fff;">${baseVal}</b>${eqBonus > 0 ? `<span style="color:#60a5fa;">(+${eqBonus})</span>` : ''}${addVal > 0 ? `<span style="color:#4ade80; font-weight:bold;">(+${addVal})</span>` : ''}</span>
        <div style="display:flex; align-items:center;">
          ${addVal > 0 ? `<button class="stat-btn" onclick="subStat('${key}')">-</button>` : ''}
          <button class="stat-btn" onclick="addStat('${key}')">+</button>
        </div>
      </div>
    `;
  };

  const resetCount = getAvailableStatResetCount();
  const nextMilestone = (Math.floor((player.level || 1) / 50) + 1) * 50;

  statLeft.innerHTML = `
    <div style="text-align:center; color:#facc15; font-size:11.5px; font-weight:bold; line-height:1.15;">${CLASS_STATS[player.class].name} <span style="color:#fff;">Lv.${player.level}</span></div>
    <div style="line-height:1.2;">HP <span class="stat-val" style="color:#fca5a5;">${Math.ceil(player.hp)} / ${cStats.calcMaxHp}</span></div>
    <div style="line-height:1.2;">MP <span class="stat-val" style="color:#93c5fd;">${Math.ceil(player.mp)} / ${cStats.calcMaxMp}</span></div>
    <hr style="border-color:#3d3020; margin:1px 0;">
    <div style="line-height:1.2;">물리공격 <span class="stat-val">${cStats.totalAtk} (${cStats.weaponSpeedSec}s)</span></div>
    <div style="line-height:1.2;">마법공격 <span class="stat-val">${cStats.totalMAtk}</span></div>
    <div style="line-height:1.2;">물리방어 <span class="stat-val" style="color:#4ade80;">${cStats.totalDef} (감쇄+${cStats.dmgReducePct || 0}%)</span></div>
    <div style="line-height:1.2;">마법방어 <span class="stat-val" style="color:#c084fc;">${cStats.totalMDef || 0}</span></div>
    <div style="line-height:1.2;">명중/치명 <span class="stat-val">+${cStats.hitBonus}% / ${cStats.critRate}%</span></div>
    <div style="line-height:1.2;">회피/블록 <span class="stat-val">${cStats.evadeRate}% / ${cStats.blockRate}%</span></div>
    <div style="line-height:1.2;">관통/쿨/보스 <span class="stat-val" style="color:#fde047;">${cStats.armorPenPct || 0}%/-${cStats.coolReducePct || 0}%/+${cStats.bossDmgPct || 0}%</span></div>
    <hr style="border-color:#3d3020; margin:1px 0;">
    <div style="display:flex; justify-content:space-between; align-items:center; background:#1c160d; border:1px solid #a16207; border-radius:4px; padding:1.5px 4px; margin:0.5px 0; flex-shrink:0;">
      <span style="color:#facc15; font-weight:bold; font-size:10px;">잔여: <b style="color:${remainPts > 0 ? '#4ade80' : '#fff'};">${remainPts}P</b></span>
      <button type="button" onclick="openStatAllocModal(event)" style="background:linear-gradient(180deg,#b45309,#78350f); color:#fef08a; border:1px solid #facc15; border-radius:4px; padding:1.5px 5px; font-size:9px; font-weight:bold; cursor:pointer;">📊 스탯창 확대</button>
    </div>
    ${statRowHTML('STR', cStats.effSTR)}
    ${statRowHTML('DEX', cStats.effDEX)}
    ${statRowHTML('INT', cStats.effINT)}
    ${statRowHTML('CON', cStats.effCON)}
    <div style="margin-top:2px; padding-top:2px; display:flex; flex-direction:column; gap:2.5px; flex-shrink:0;">
      <div style="display:flex; gap:3px;">
        <button type="button" onclick="confirmStats()" style="flex:1.4; background:${pendTotal > 0 ? '#16a34a' : '#374151'}; color:#fff; border:1px solid ${pendTotal > 0 ? '#4ade80' : '#6b7280'}; border-radius:4px; padding:3px 0; font-size:10px; font-weight:bold; cursor:pointer; line-height:1.15;">✔ 확인${pendTotal > 0 ? `(+${pendTotal})` : ''}</button>
        ${pendTotal > 0 ? `<button type="button" onclick="resetPendingStats()" style="flex:0.8; background:#7f1d1d; color:#fff; border:1px solid #f87171; border-radius:4px; padding:3px 0; font-size:9.5px; cursor:pointer; line-height:1.15;">취소</button>` : ''}
      </div>
      <button type="button" onclick="resetAllocatedStats()" style="width:100%; background:${resetCount > 0 ? '#1e3a8a' : '#1f2937'}; color:${resetCount > 0 ? '#93c5fd' : '#6b7280'}; border:1px solid ${resetCount > 0 ? '#60a5fa' : '#374151'}; border-radius:4px; padding:3px 0; font-size:9px; font-weight:bold; cursor:pointer; line-height:1.15;">🔄 스탯 초기화 (${resetCount > 0 ? `가능 ${resetCount}회` : `Lv.${nextMilestone} 해금`})</button>
    </div>
  `;

  paperdoll.innerHTML = '';
  window.migrateAndNormalizeEquip(player.equip, player.inventory);

  // 14부위 착용 슬롯 레이아웃 (5행 x 3열 인체 그리드 배치)
  const gridCells = [
    // Row 1: 귀걸이1 - 투구 - 귀걸이2
    { key: 'earring1', name: '귀걸이1', ghost: '💠' },
    { key: 'helmet',   name: '투구',    ghost: '👑' },
    { key: 'earring2', name: '귀걸이2', ghost: '💠' },
    // Row 2: 목걸이 - 티셔츠 - 망토
    { key: 'necklace', name: '목걸이',  ghost: '📿' },
    { key: 'tshirt',   name: '티셔츠',  ghost: '👕' },
    { key: 'cloak',    name: '망토',    ghost: '🧣' },
    // Row 3: 무기 - 갑옷 - 방패
    { key: 'weapon',   name: '무기',    ghost: '🗡️' },
    { key: 'armor',    name: '갑옷',    ghost: '🥋' },
    { key: 'shield',   name: '방패',    ghost: '🛡️' },
    // Row 4: 장갑 - 벨트 - 착용요약 배지
    { key: 'gloves',   name: '장갑',    ghost: '🧤' },
    { key: 'belt',     name: '벨트',    ghost: '🎗️' },
    { key: '_summary', name: '착용현황' },
    // Row 5: 반지1 - 신발 - 반지2
    { key: 'ring1',    name: '반지1',   ghost: '💍' },
    { key: 'boots',    name: '신발',    ghost: '🥾' },
    { key: 'ring2',    name: '반지2',   ghost: '💍' }
  ];

  let equippedCount = 0;
  let totalPlusSum = 0;
  ALL_EQUIP_SLOT_KEYS.forEach(k => {
    const idx = player.equip[k];
    if (idx !== null && idx !== undefined && player.inventory[idx]) {
      equippedCount++;
      totalPlusSum += getItemPlusValue(player.inventory[idx], k, 'player');
    }
  });

  gridCells.forEach(s => {
    if (s.key === '_summary') {
      const badgeDiv = document.createElement('div');
      badgeDiv.style.cssText = 'width:42px; height:36px; margin-bottom:10px; background:rgba(15,23,42,0.85); border:1px dashed #60a5fa; border-radius:6px; display:flex; flex-direction:column; align-items:center; justify-content:center; font-size:8.5px; color:#93c5fd; line-height:1.25; text-align:center; pointer-events:none;';
      badgeDiv.innerHTML = `<span style="color:#fde047; font-weight:bold;">${equippedCount}/14</span><span>강화+${totalPlusSum}</span>`;
      paperdoll.appendChild(badgeDiv);
      return;
    }

    let div = document.createElement('div');
    div.className = 'pd-slot-grid';
    div.setAttribute('data-name', s.name);

    let eqIdx = player.equip[s.key];
    if (eqIdx !== null && eqIdx !== undefined && player.inventory[eqIdx]) {
      const inst = player.inventory[eqIdx];
      const def = window.itemDict[inst.type] || {};
      const gradeClass = def.questOnly ? 'grade-bg-quest' : `grade-bg-${inst.gradeIdx || 0}`;
      div.classList.add(gradeClass);
      if (window._selectedEquipSlotKey === s.key) div.classList.add('selected');
      div.innerHTML = window.getItemIconHTML(inst.type);

      const plus = getItemPlusValue(inst, s.key, 'player');
      const gName = def.questOnly ? '퀘스트전용' : (inst.gradeName || '일반');
      div.title = `[${s.name}] [${gName}] ${plus > 0 ? '+' + plus + ' ' : ''}${def.name || s.name}`;
      if (plus > 0) div.innerHTML += `<div class="pd-plus">+${plus}</div>`;
      div.dataset.lastTap = "0";
      div.addEventListener('pointerup', function() {
        let now = Date.now();
        const dt = now - parseInt(this.dataset.lastTap || '0');
        if (dt < 65) return;
        if (dt >= 65 && dt < 300) {
          window.unequipSlotFromPaperdoll(s.key, s.name);
        } else {
          this.dataset.lastTap = now;
          window._selectedEquipSlotKey = s.key;
          paperdoll.querySelectorAll('.pd-slot-grid').forEach(el => el.classList.remove('selected'));
          div.classList.add('selected');
          const eqDetailBox = document.getElementById('equip-item-detail');
          if (eqDetailBox && window.buildConciseItemDetailHTML) {
            eqDetailBox.innerHTML = window.buildConciseItemDetailHTML(inst, eqIdx, 'equip', s.key, s.name);
          }
        }
      });

    } else {
      // 비어 있는 슬롯 처리 (이 부분도 일관성을 위해 더블 탭으로 동작)
      div.style.background = 'rgba(0,0,0,0.42)';
      div.innerHTML = `<span style="font-size:15px; opacity:0.25; pointer-events:none;">${s.ghost || '📦'}</span>`;
      div.title = `[${s.name}] 비어 있음 (더블 터치 시 가방 내 아이템 자동 착용)`;
      
      div.dataset.lastTap = "0";
      div.addEventListener('pointerup', function() {
        let now = Date.now();
        const dt = now - parseInt(this.dataset.lastTap || '0');
        if (dt < 65) return;
        if (dt >= 65 && dt < 300) {
          window.equipSlotFromPaperdoll(s.key, s.name);
        } else {
          this.dataset.lastTap = now;
        }
      });
    }

    paperdoll.appendChild(div);
  });

  const eqDetailBox = document.getElementById('equip-item-detail');
  if (eqDetailBox) {
    const selKey = window._selectedEquipSlotKey;
    const selIdx = selKey ? player.equip[selKey] : null;
    if (selKey && selIdx !== null && selIdx !== undefined && player.inventory[selIdx] && window.buildConciseItemDetailHTML) {
      eqDetailBox.innerHTML = window.buildConciseItemDetailHTML(player.inventory[selIdx], selIdx, 'equip', selKey, EQUIP_SLOT_LABELS[selKey] || selKey);
    } else {
      eqDetailBox.innerHTML = `<span style="color:#9ca3af; font-size:11px;">장착 슬롯을 터치하면 아이템 풀네임과 핵심 정보가 표시됩니다. (더블터치: 해제)</span>`;
    }
  }
}

window.unequipSlotFromPaperdoll = function(slotKey, slotLabel) {
  const eqIdx = player.equip[slotKey];
  if (eqIdx === null || eqIdx === undefined) return;
  const inst = player.inventory[eqIdx];
  const def = inst ? (window.itemDict[inst.type] || {}) : {};
  player.equip[slotKey] = null;
  if (window._selectedEquipSlotKey === slotKey) window._selectedEquipSlotKey = null;
  SoundSystem.playUiClick?.();
  window.addChat(`🛡️ [장비 해제] [${slotLabel || slotKey}] 슬롯의 '${def.name || slotLabel}' 장착을 해제했습니다.`, 'log-sys');
  recalcMaxHpMp(false);
  renderEquipUI();
  updateStatusHUD();
  if (!document.getElementById('inventory-ui').classList.contains('hidden')) renderInventory();
};

// 캐릭터 정보창(Paperdoll)에서 빈 슬롯을 터치했을 때 가방의 해당 부위 최고 장비를 즉시 찾아 장착
window.equipSlotFromPaperdoll = function(slotKey, slotLabel) {
  const eqSet = new Set(Object.values(player.equip).filter(v => v !== null && v !== undefined).map(Number));
  let bestIdx = -1;
  let bestScore = -1;

  player.inventory.forEach((inst, idx) => {
    if (!inst || eqSet.has(idx)) return;
    const def = window.itemDict[inst.type];
    if (!def || !isItemMatchingSlot(def, slotKey)) return;

    // 클래스 무기/방패 제한 체크
    const isSword = def.type.includes('검');
    const isBow = def.type.includes('활');
    const isStaff = def.type.includes('지팡이');
    const isShield = def.type.includes('방패');
    if (isSword || isBow || isStaff || isShield) {
      if (player.class === 'knight' && (isBow || isStaff)) return;
      if (player.class === 'ranger' && !isBow) return;
      if (player.class === 'wizard' && !isStaff) return;
    }

    const score = (inst.gradeIdx || 0) * 1000 + (inst.plus || 0) * 100 + (def.pAtk || 0) + (def.mAtk || 0) + (def.def || 0) * 2 + (def.reqLv || 1);
    if (score > bestScore) {
      bestScore = score;
      bestIdx = idx;
    }
  });

  if (bestIdx > -1) {
    const picked = player.inventory[bestIdx];
    const def = window.itemDict[picked.type] || { name: picked.type };
    player.equip[slotKey] = bestIdx;
    SoundSystem.playUiClick?.();
    const plusTxt = picked.plus > 0 ? `+${picked.plus} ` : '';
    window.addChat(`⚔️ [정보창 장착] [${slotLabel}] 슬롯에 '${plusTxt}${def.name}'을(를) 장착했습니다!`, 'log-kill');
    recalcMaxHpMp(false);
    renderEquipUI();
    updateStatusHUD();
    if (!document.getElementById('inventory-ui').classList.contains('hidden')) renderInventory();
  } else {
    window.addChat(`ℹ️ [장착 안내] 가방에 착용 가능한 [${slotLabel}] 아이템이 없습니다.`, 'log-sys');
  }
};

let highestModalZ = 250;
window.bringModalToFront = function(modalElOrId) {
  const modal = typeof modalElOrId === 'string' ? document.getElementById(modalElOrId) : modalElOrId;
  if (!modal) return;
  highestModalZ++;
  modal.style.zIndex = highestModalZ;
};

// 각종 모달 창을 현재 화면 크기(해상도/모바일/PC)의 정중앙에 배치하는 헬퍼
window.centerModalOnScreen = function(modalElOrId) {
  const modal = typeof modalElOrId === 'string' ? document.getElementById(modalElOrId) : modalElOrId;
  if (!modal || modal.classList.contains('hidden')) return;
  const wrapperEl = document.getElementById('game-wrapper') || document.body;
  const pw = wrapperEl.clientWidth || window.innerWidth;
  const ph = wrapperEl.clientHeight || window.innerHeight;
  const bottomPanelH = document.getElementById('bottom-panel')?.offsetHeight || 142;
  const isEquipOrStat = modal.id === 'equip-ui' || modal.id === 'stat-alloc-modal';
  const safeTop = isEquipOrStat ? 28 : 40;
  const maxAllowedH = isEquipOrStat
    ? Math.max(340, ph - safeTop - 16)
    : Math.max(230, ph - bottomPanelH - safeTop - 4);

  modal.style.maxHeight = `${maxAllowedH}px`;
  modal.style.transform = 'none';

  const rect = modal.getBoundingClientRect();
  const mw = Math.min(pw - 10, rect.width || 340);
  const mh = Math.min(maxAllowedH, rect.height || 320);

  const leftPx = Math.max(5, Math.min(pw - mw - 5, Math.round((pw - mw) / 2)));
  const availPlayAreaH = isEquipOrStat ? (ph - 12) : (ph - bottomPanelH);
  const topPx  = Math.max(safeTop, Math.min(ph - mh - 8, Math.round((availPlayAreaH - mh) / 2)));
  modal.style.left = `${leftPx}px`;
  modal.style.top  = `${topPx}px`;
};

function makeDraggable(modalId) {
  const modal = typeof modalId === 'string' ? document.getElementById(modalId) : modalId;
  if (!modal || modal._draggableBound) return;
  modal._draggableBound = true;

  let isDragging = false;
  let activeHandle = null;
  let startX = 0;
  let startY = 0;
  let initialLeft = 0;
  let initialTop = 0;

  modal.addEventListener('pointerdown', (e) => {
    window.bringModalToFront(modal);
    const handle = e.target.closest('.drag-handle');
    if (!handle || !modal.contains(handle)) return;
    if (e.target.closest('button, input, select, a')) return;

    isDragging = true;
    activeHandle = handle;

    const rect = modal.getBoundingClientRect();
    const parentRect = (modal.offsetParent || document.body).getBoundingClientRect();
    initialLeft = rect.left - parentRect.left;
    initialTop = rect.top - parentRect.top;

    modal.style.transform = 'none';
    modal.style.left = `${initialLeft}px`;
    modal.style.top = `${initialTop}px`;

    startX = e.clientX;
    startY = e.clientY;
    try {
      handle.setPointerCapture(e.pointerId);
    } catch (err) {}
    e.preventDefault();
  });

  modal.addEventListener('pointermove', (e) => {
    if (!isDragging) return;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    const maxW = window.innerWidth - 60;
    const maxH = window.innerHeight - 60;
    const newLeft = Math.max(-40, Math.min(maxW, initialLeft + dx));
    const newTop = Math.max(5, Math.min(maxH, initialTop + dy));
    modal.style.left = `${newLeft}px`;
    modal.style.top = `${newTop}px`;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
      modal._hasCustomDragPos = true;
    }
  });

  const stopDrag = (e) => {
    if (!isDragging) return;
    isDragging = false;
    if (activeHandle && e && e.pointerId !== undefined) {
      try { activeHandle.releasePointerCapture(e.pointerId); } catch (err) {}
    }
    activeHandle = null;
  };
  modal.addEventListener('pointerup', stopDrag);
  modal.addEventListener('pointercancel', stopDrag);
}
window.makeDraggable = makeDraggable;

let app, cameraContainer, bgContainer, entityContainer, uiContainer, mCtx;
let mainG, uiG, pCtx;
let playerNameTag = null;
const wrapper = document.getElementById('canvas-wrapper');
const fadeOverlay = document.getElementById('fade-overlay');
const mCanvas = document.getElementById('minimapCanvas');

let tick = 0;
let currentWorldWidth = 4000;
let currentWorldHeight = 16000;
let minimapOffscreenCanvas = null;
let bgLoaded = false;

let wallBoxes = [];
let portalBoxes = [];
let npcList = [];
let monsterList = [];
let itemList = [];
let floatingTexts = [];
let activeEffects = [];
let projectiles = [];
let bossTelegraphs = [];
let currentRegionKey = "R01";
let currentMapKey = "R01_sub1";
let bossRespawnTimer = 0;
let enchantScrollType = null;

Object.defineProperties(window, {
  wallBoxes: { get: () => wallBoxes, set: (v) => { wallBoxes = v; }, configurable: true },
  portalBoxes: { get: () => portalBoxes, set: (v) => { portalBoxes = v; }, configurable: true },
  npcList: { get: () => npcList, set: (v) => { npcList = v; }, configurable: true },
  monsterList: { get: () => monsterList, set: (v) => { monsterList = v; }, configurable: true },
  itemList: { get: () => itemList, set: (v) => { itemList = v; }, configurable: true },
  floatingTexts: { get: () => floatingTexts, set: (v) => { floatingTexts = v; }, configurable: true },
  activeEffects: { get: () => activeEffects, set: (v) => { activeEffects = v; }, configurable: true },
  projectiles: { get: () => projectiles, set: (v) => { projectiles = v; }, configurable: true },
  bossTelegraphs: { get: () => bossTelegraphs, set: (v) => { bossTelegraphs = v; }, configurable: true },
  currentRegionKey: { get: () => currentRegionKey, set: (v) => { currentRegionKey = v; }, configurable: true },
  currentMapKey: { get: () => currentMapKey, set: (v) => { currentMapKey = v; }, configurable: true },
  currentMapData: { get: () => (window.HardcodedMapDB && (window.HardcodedMapDB[currentMapKey] || window.HardcodedMapDB['R01_sub1'])) || null, configurable: true },
  mapData: { get: () => (window.HardcodedMapDB && (window.HardcodedMapDB[currentMapKey] || window.HardcodedMapDB['R01_sub1'])) || null, configurable: true }
});

let player = {
  name: "모험가",
  x: 2000, y: 14250, speed: 2.85, targetX: 2000, targetY: 14250,
  isMoving: false, manualMoving: false, dir: 'down', isWalking: false,
  targetEntity: null, savedBossTarget: null, lastHitByMonster: null, lastHitByTime: 0,
  orbitDir: 1, lastOrbitSwitch: 0, stuckCheckX: 2000, stuckCheckY: 14250, stuckTimer: 0,
  lastAttackTime: 0, lastCombatTime: 0, blockTime: 0, portalCooldown: 0,
  class: 'knight', level: 1, exp: 0, maxExp: 100, gold: 500, hp: 550, maxHp: 550, mp: 120, maxMp: 120,
  learnedSkills: new Set(),
  inventory: Array(100).fill(null), path: [],
  equip: createEmptyEquipObj(),
  weaponType: 'NONE', weaponPlus: 0, armorPlus: 0,
  stats: { STR: 13, DEX: 3, INT: 1, CON: 3 }, statPoints: 0, statResetUsed: 0,
  activeBuffs: { SHIELD: 0, WIND_WALK: 0, RAGE: 0, HASTE: 0, ELIXIR: 0 },
  quests: {}
};
window.player = player;
let camera = { x: 0, y: 0, shakeIntensity: 0, shakeUntil: 0, shakeDur: 120 };
window.triggerCameraShake = function(intensity = 2.8, durationMs = 110) {
  const now = Date.now();
  if (now < (camera.shakeUntil || 0) && (camera.shakeIntensity || 0) > intensity) return;
  camera.shakeIntensity = intensity;
  camera.shakeDur = durationMs;
  camera.shakeUntil = now + durationMs;
};

function checkCollision(nx, ny, extraMargin = 0) {
  let rad = 8 + extraMargin;
  let footY = ny + 12;
  let edge = 30 + extraMargin;

  for (let b of wallBoxes) {
    if (nx + rad > b.x && nx - rad < b.x + b.width && footY + rad > b.y && footY - rad < b.y + b.height) return true;
  }
  if (bgLoaded && (nx < edge || nx > currentWorldWidth - edge || footY < edge || footY > currentWorldHeight - edge)) return true;
  return false;
}

// 🛡️ 플레이어·몬스터·타플레이어·용병 상호 충돌체 판정 (겹침 방지 & 이미 겹친 경우 바깥으로 빠져나가는 이동은 허용)
function checkUnitCollision(nx, ny, selfEntity = player, ignoreTargetRef = null) {
  const curX = selfEntity?.x ?? nx;
  const curY = selfEntity?.y ?? ny;
  const selfRadius = selfEntity?.isBoss ? 22 : 14;

  // 1) 살아있는 몬스터들과의 충돌 체크 (바운딩 박스 사전 필터링으로 CPU 부하 98% 절감)
  for (let i = 0; i < monsterList.length; i++) {
    const m = monsterList[i];
    if (!m || m.isDead || m === selfEntity || m === ignoreTargetRef) continue;
    if (Math.abs(nx - m.x) > 46 || Math.abs(ny - m.y) > 46) continue;
    const mRad = m.isBoss ? 22 : 14;
    const minDist = selfRadius + mRad;
    const nextDist = Math.hypot(nx - m.x, ny - m.y);
    if (nextDist < minDist) {
      const curDist = Math.hypot(curX - m.x, curY - m.y);
      if (nextDist < curDist) return true;
    }
  }

  // 2) 타 플레이어 및 타 플레이어 용병과의 자리 겹침 방지 체크
  if (Array.isArray(window.otherPlayers)) {
    for (let i = 0; i < window.otherPlayers.length; i++) {
      const op = window.otherPlayers[i];
      if (!op || op === selfEntity || op.gmInvisible || op.x === undefined || op.isMinimapOnly) continue;
      const minDist = selfRadius + 14;
      const nextDist = Math.hypot(nx - op.x, ny - op.y);
      if (nextDist < minDist && nextDist < Math.hypot(curX - op.x, curY - op.y)) return true;

      if (op.mercenary && op.mercenary.hired && !op.mercenary.isDead && op.mercenary !== selfEntity && op.mercenary.x !== undefined) {
        const om = op.mercenary;
        const nextOmDist = Math.hypot(nx - om.x, ny - om.y);
        if (nextOmDist < minDist && nextOmDist < Math.hypot(curX - om.x, curY - om.y)) return true;
      }
    }
  }

  // 3) 내 용병과 플레이어/몬스터 간 겹침 방지 체크
  if (mercenary.hired && !mercenary.isDead && selfEntity !== mercenary) {
    const minMDist = selfRadius + 14;
    const nextMDist = Math.hypot(nx - mercenary.x, ny - mercenary.y);
    if (nextMDist < minMDist && nextMDist < Math.hypot(curX - mercenary.x, curY - mercenary.y)) {
      return true;
    }
  }

  // 4) 몬스터 또는 용병이 이동할 때 플레이어와 겹치지 않도록 체크
  if (selfEntity !== player && (player.hp || 0) > 0) {
    const minPDist = selfRadius + 14;
    const nextPDist = Math.hypot(nx - player.x, ny - player.y);
    if (nextPDist < minPDist && nextPDist < Math.hypot(curX - player.x, curY - player.y)) {
      return true;
    }
  }
  return false;
}

// 겹쳐 있는 플레이어-몬스터-타플레이어 간 부드러운 밀어내기 분리(Separation)
function resolveClientEntitySeparation(delta = 1) {
  if (!bgLoaded) return;
  const inSafeNow = isInsideSafeZone(player.x, player.y);
  const isPlayerActivelyMoving = Boolean(player.isWalking || player.isMoving || joystickState?.active);

  // A) 플레이어와 몬스터 간 겹침 해소 (플레이어 이동 중 뒤에서 밀려 이동속도가 가속되는 현상 원천 차단!)
  for (let i = 0; i < monsterList.length; i++) {
    const m = monsterList[i];
    if (!m || m.isDead) continue;
    const dx = player.x - m.x;
    const dy = player.y - m.y;
    if (Math.abs(dx) > 42 || Math.abs(dy) > 42) continue;
    const minDist = (m.isBoss ? 23 : 15) + 14;
    const dist = Math.hypot(dx, dy);
    if (dist < minDist) {
      const overlap = Math.min(0.45, (minDist - Math.max(0.1, dist)) * 0.25) * Math.min(1.1, delta);
      const ang = dist > 0.1 ? Math.atan2(dy, dx) : ((i * 1.3) % (Math.PI * 2));
      if (!isPlayerActivelyMoving) {
        const pnx = player.x + Math.cos(ang) * overlap;
        const pny = player.y + Math.sin(ang) * overlap;
        if (!checkCollision(pnx, pny)) {
          player.x = pnx;
          player.y = pny;
        }
      }
      if (!isServerAuthoritativeMode()) {
        const mnx = m.x - Math.cos(ang) * overlap;
        const mny = m.y - Math.sin(ang) * overlap;
        if (!checkCollision(mnx, mny) && !isInsideSafeZone(mnx, mny)) {
          m.x = mnx;
          m.y = mny;
        }
      }
    }
  }

  // B) 내 용병과 플레이어 / 몬스터 / 타 플레이어 / 타 플레이어 용병 간 자리 겹침 완전 해소!
  if (mercenary.hired && !mercenary.isDead) {
    // B-1) 내 용병 <-> 내 플레이어 분리 (용병만 밀어내고 플레이어는 밀지 않음)
    const dxPM = mercenary.x - player.x;
    const dyPM = mercenary.y - player.y;
    const distPM = Math.hypot(dxPM, dyPM);
    const minPM = 28;
    if (distPM < minPM) {
      const push = (minPM - Math.max(0.1, distPM)) * 0.45 * Math.min(1.1, delta);
      const ang = distPM > 0.1 ? Math.atan2(dyPM, dxPM) : 2.4;
      const mnx = mercenary.x + Math.cos(ang) * push;
      const mny = mercenary.y + Math.sin(ang) * push;
      if (!checkCollision(mnx, mny)) {
        mercenary.x = mnx;
        mercenary.y = mny;
      }
    }
    // B-2) 내 용병 <-> 몬스터 분리
    for (let i = 0; i < monsterList.length; i++) {
      const m = monsterList[i];
      if (!m || m.isDead) continue;
      const dx = mercenary.x - m.x;
      const dy = mercenary.y - m.y;
      if (Math.abs(dx) > 42 || Math.abs(dy) > 42) continue;
      const minDist = (m.isBoss ? 24 : 15) + 14;
      const dist = Math.hypot(dx, dy);
      if (dist < minDist) {
        const push = (minDist - Math.max(0.1, dist)) * 0.42 * Math.min(1.1, delta);
        const ang = dist > 0.1 ? Math.atan2(dy, dx) : (i * 1.1);
        const mnx = mercenary.x + Math.cos(ang) * push;
        const mny = mercenary.y + Math.sin(ang) * push;
        if (!checkCollision(mnx, mny)) {
          mercenary.x = mnx;
          mercenary.y = mny;
        }
      }
    }
  }

  // B-3) 플레이어 및 내 용병 <-> 타 플레이어 및 타 플레이어 용병 간 자리 겹침 해소
  if (Array.isArray(window.otherPlayers)) {
    for (let i = 0; i < window.otherPlayers.length; i++) {
      const op = window.otherPlayers[i];
      if (!op || op.gmInvisible || op.x === undefined || op.isMinimapOnly) continue;
      const minDist = 26;
      const dx = player.x - op.x;
      const dy = player.y - op.y;
      const dist = Math.hypot(dx, dy);
      if (!inSafeNow && !isPlayerActivelyMoving && dist < minDist) {
        const push = Math.min(0.4, (minDist - Math.max(0.1, dist)) * 0.25) * Math.min(1.1, delta);
        const ang = dist > 0.1 ? Math.atan2(dy, dx) : (i + 0.5);
        const pnx = player.x + Math.cos(ang) * push;
        const pny = player.y + Math.sin(ang) * push;
        if (!checkCollision(pnx, pny)) {
          player.x = pnx;
          player.y = pny;
        }
      }

      if (mercenary.hired && !mercenary.isDead) {
        // 내 용병 <-> 타 플레이어 분리
        const dxMO = mercenary.x - op.x;
        const dyMO = mercenary.y - op.y;
        const dMO = Math.hypot(dxMO, dyMO);
        if (dMO < 28) {
          const push = (28 - Math.max(0.1, dMO)) * 0.45 * Math.min(1.5, delta);
          const ang = dMO > 0.1 ? Math.atan2(dyMO, dxMO) : (i + 1.2);
          const mnx = mercenary.x + Math.cos(ang) * push;
          const mny = mercenary.y + Math.sin(ang) * push;
          if (!checkCollision(mnx, mny)) {
            mercenary.x = mnx;
            mercenary.y = mny;
          }
        }
        // 내 용병 <-> 타 플레이어의 용병 분리
        if (op.mercenary && op.mercenary.hired && !op.mercenary.isDead && op.mercenary.x !== undefined) {
          const om = op.mercenary;
          const dxMM = mercenary.x - om.x;
          const dyMM = mercenary.y - om.y;
          const dMM = Math.hypot(dxMM, dyMM);
          if (dMM < 28) {
            const push = (28 - Math.max(0.1, dMM)) * 0.48 * Math.min(1.5, delta);
            const ang = dMM > 0.1 ? Math.atan2(dyMM, dxMM) : (i + 2.1);
            const mnx = mercenary.x + Math.cos(ang) * push;
            const mny = mercenary.y + Math.sin(ang) * push;
            if (!checkCollision(mnx, mny)) {
              mercenary.x = mnx;
              mercenary.y = mny;
            }
          }
          // 플레이어 <-> 타 플레이어 용병 분리
          const dxPOm = player.x - om.x;
          const dyPOm = player.y - om.y;
          const dPOm = Math.hypot(dxPOm, dyPOm);
          if (!inSafeNow && dPOm < 25) {
            const push = (25 - Math.max(0.1, dPOm)) * 0.35 * Math.min(1.5, delta);
            const ang = dPOm > 0.1 ? Math.atan2(dyPOm, dxPOm) : (i + 0.8);
            const pnx = player.x + Math.cos(ang) * push;
            const pny = player.y + Math.sin(ang) * push;
            if (!checkCollision(pnx, pny)) {
              player.x = pnx;
              player.y = pny;
            }
          }
        }
      }
    }
  }

  // C) 로컬 모드일 때 몬스터끼리의 겹침 해소
  if (!isServerAuthoritativeMode()) {
    for (let i = 0; i < monsterList.length; i++) {
      const a = monsterList[i];
      if (!a || a.isDead) continue;
      const rA = a.isBoss ? 22 : 14;
      for (let j = i + 1; j < monsterList.length; j++) {
        const b = monsterList[j];
        if (!b || b.isDead) continue;
        const minDist = rA + (b.isBoss ? 22 : 14);
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.hypot(dx, dy);
        if (dist < minDist) {
          const push = (minDist - Math.max(0.1, dist)) * 0.4;
          const ang = dist > 0.1 ? Math.atan2(dy, dx) : ((i + j) % 6);
          const ax = a.x - Math.cos(ang) * push;
          const ay = a.y - Math.sin(ang) * push;
          const bx = b.x + Math.cos(ang) * push;
          const by = b.y + Math.sin(ang) * push;
          if (!checkCollision(ax, ay) && !isInsideSafeZone(ax, ay)) { a.x = ax; a.y = ay; }
          if (!checkCollision(bx, by) && !isInsideSafeZone(bx, by)) { b.x = bx; b.y = by; }
        }
      }
    }
  }
}

window.findPath = function(startX, startY, targetX, targetY) {
  const gridSize = 35;
  let startNode = { x: Math.round(startX / gridSize) * gridSize, y: Math.round(startY / gridSize) * gridSize };
  let targetNode = { x: Math.round(targetX / gridSize) * gridSize, y: Math.round(targetY / gridSize) * gridSize };

  if (Math.hypot(targetNode.x - startNode.x, targetNode.y - startNode.y) > 1800) {
    return buildSmartFieldPath(startX, startY, targetX, targetY);
  }

  const targetMobRef = player.targetEntity?.type === 'MONSTER' ? player.targetEntity.ref : null;
  let openList = [{ x: startNode.x, y: startNode.y, g: 0, h: 0, f: 0, parent: null }];
  let closedSet = new Set();
  let safeGuard = 0;

  while (openList.length > 0 && safeGuard < 850) {
    safeGuard++;
    openList.sort((a, b) => a.f - b.f);
    let current = openList.shift();
    let key = `${current.x},${current.y}`;

    if (Math.hypot(current.x - targetNode.x, current.y - targetNode.y) <= gridSize * 1.6) {
      let path = [];
      let curr = current;
      while (curr.parent) { path.push({ x: curr.x, y: curr.y }); curr = curr.parent; }
      path.reverse();
      path.push({ x: targetX, y: targetY });
      return path;
    }

    closedSet.add(key);
    let neighbors = [
      { x: current.x, y: current.y - gridSize }, { x: current.x, y: current.y + gridSize },
      { x: current.x - gridSize, y: current.y }, { x: current.x + gridSize, y: current.y },
      { x: current.x - gridSize, y: current.y - gridSize }, { x: current.x + gridSize, y: current.y - gridSize },
      { x: current.x - gridSize, y: current.y + gridSize }, { x: current.x + gridSize, y: current.y + gridSize }
    ];

    for (let n of neighbors) {
      let nKey = `${n.x},${n.y}`;
      if (closedSet.has(nKey) || checkCollision(n.x, n.y, 10)) continue;
      const unitBlocked = checkUnitCollision(n.x, n.y, player, targetMobRef);
      let stepCost = Math.hypot(n.x - current.x, n.y - current.y) + (unitBlocked ? 85 : 0);
      let gScore = current.g + stepCost;
      let hScore = Math.hypot(n.x - targetNode.x, n.y - targetNode.y);
      let fScore = gScore + hScore;
      let existing = openList.find(node => node.x === n.x && node.y === n.y);
      if (!existing) openList.push({ x: n.x, y: n.y, g: gScore, h: hScore, f: fScore, parent: current });
      else if (gScore < existing.g) { existing.g = gScore; existing.f = fScore; existing.parent = current; }
    }
  }
  return buildSmartFieldPath(startX, startY, targetX, targetY);
};

window.updateHotbarCooldowns = function() {
  const now = Date.now();
  const cStatsNow = calculateCombatStats(false);

  // 1~9번 슬롯 쿨타임 계산
  for (let i = 1; i <= 9; i++) {
    const slotEl = document.getElementById(`slot-${i}`);
    if (!slotEl) continue;
    const overlay = slotEl.querySelector('.cooldown-overlay');
    if (!overlay) continue;

    let percent = 0;
    const slotData = window.skillSlots[i];

    if (slotData) {
      if (slotData.type === 'skill') {
        const sInfo = SKILLS_DB[player.class]?.find(s => s.name === slotData.name);
        if (sInfo && skillCooldowns[sInfo.name]) {
          let coolMs = (sInfo.cool || 1) * 1000;
          if (cStatsNow.coolReducePct > 0) coolMs *= Math.max(0.55, 1 - cStatsNow.coolReducePct / 100);
          if (player.activeBuffs?.ARCHMAGE > 0 && player.class === 'wizard') coolMs *= 0.5;

          const elapsed = now - skillCooldowns[sInfo.name];
          if (elapsed < coolMs) {
            percent = 100 - (elapsed / coolMs * 100);
          }
        }
      } else if (slotData.type === 'item') {
        const iData = window.itemDict[slotData.itemType];
        if (iData && (iData.type === '물약' || iData.type === '버프물약' || slotData.itemType.startsWith('C_P'))) {
          const coolMs = (iData.cool || 0.5) * 1000;
          let lastTime = 0;
          if (iData.healHp) lastTime = lastHpPotionTime;
          else if (iData.healMp) lastTime = lastMpPotionTime;
          else if (iData.type === '버프물약') lastTime = lastHpPotionTime;

          if (lastTime > 0) {
            const elapsed = now - lastTime;
            if (elapsed < coolMs) {
              percent = 100 - (elapsed / coolMs * 100);
            }
          }
        }
      }
    }
    overlay.style.height = `${percent}%`;
  }

  // 0번(기본 공격) 슬롯 쿨타임 계산
  const slot10El = document.getElementById('slot-10');
  if (slot10El) {
    const overlay10 = slot10El.querySelector('.cooldown-overlay');
    if (overlay10) {
      let percent10 = 0;
      const atkInterval = getAttackInterval();
      const elapsedAtk = now - (player.lastAttackTime || 0);
      if (elapsedAtk < atkInterval) {
        percent10 = 100 - (elapsedAtk / atkInterval * 100);
      }
      overlay10.style.height = `${percent10}%`;
    }
  }
};




window.focusLastActiveQuestRow = function() {
  // 진행 중 임무 및 보상 수령 가능 임무가 항상 최상단에 배치되므로 주루룩 올라가는 강제 스크롤 애니메이션 없이 즉시 상단 고정
  document.querySelectorAll('#quest-ui-body .shop-list, #npc-modal-body .shop-list').forEach(listEl => {
    listEl.scrollTop = 0;
  });
};