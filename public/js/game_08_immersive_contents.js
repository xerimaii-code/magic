// public/js/game_08_immersive_contents.js
// 📖 지역별 몬스터 · 드롭 도감 및 필드 자연 이벤트 (영구 스탯 보너스 없음 · 설명이 필요 없는 직관적 구성)
import { GameDB } from './data.js';

export const ImmersiveSystem = {
  selectedRegion: null,
  state: {
    totalKills: 0,
    giantKills: 0,
    bossKills: 0,
    luckyGoldCount: 0,
    luckyGoldTotal: 0,
    bestiaryKills: {},
    lastBriefedBoss: ''
  },

  init() {
    this.loadFromLocal();
    this.injectHubButton();
    setInterval(() => {
      this.injectHubButton();
    }, 4000);
  },

  saveToLocal() {
    try {
      const key = `MAGIC_MONSTER_CODEX_${window.activeCharacterId || 'default'}`;
      localStorage.setItem(key, JSON.stringify(this.state));
    } catch (e) {}
  },

  loadFromLocal() {
    try {
      const key = `MAGIC_MONSTER_CODEX_${window.activeCharacterId || 'default'}`;
      const raw = localStorage.getItem(key);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          this.state.totalKills = Number(parsed.totalKills) || 0;
          this.state.giantKills = Number(parsed.giantKills) || 0;
          this.state.bossKills = Number(parsed.bossKills) || 0;
          this.state.luckyGoldCount = Number(parsed.luckyGoldCount) || 0;
          this.state.luckyGoldTotal = Number(parsed.luckyGoldTotal) || 0;
          if (parsed.bestiaryKills && typeof parsed.bestiaryKills === 'object') {
            this.state.bestiaryKills = parsed.bestiaryKills;
          }
        }
      }
    } catch (e) {}
  },

  // 밸런스 보호: 영구 스탯 보너스는 일절 부여하지 않음
  getPassiveBonusSummary() {
    return { atkBonus: 0, defBonus: 0, hpBonus: 0, goldExpBonusPct: 0, speciesCount: 0, totalMastery: 0 };
  },

  onBossEngage(bossMob) {
    if (!bossMob || !bossMob.isBoss) return;
    const bName = (bossMob.rawName || bossMob.name || '보스').replace(/^★거대\s*/, '').replace(/^\[.*?\]\s*/, '').trim();
    if (this.state.lastBriefedBoss === bName) return;
    this.state.lastBriefedBoss = bName;
    if (window.mercenary?.hired && !window.mercenary.isDead) {
      window.mercenary.chatBubble = { text: '보스전 집중 공격!', expiresAt: Date.now() + 3000 };
    }
  },

  onMonsterKilled(mob, hitDmg = 0) {
    if (!mob) return;
    const rawName = (mob.rawName || mob.name || '')
      .replace(/^👑?\[★거대정예\]\s*/, '')
      .replace(/^★거대\s*/, '')
      .replace(/^\[.*?\]\s*/, '')
      .trim();
    if (!rawName) return;

    this.state.totalKills = (this.state.totalKills || 0) + 1;
    this.state.bestiaryKills[rawName] = (this.state.bestiaryKills[rawName] || 0) + 1;

    if (mob.isBoss) {
      this.state.bossKills = (this.state.bossKills || 0) + 1;
    } else if (mob.isElite) {
      this.state.giantKills = (this.state.giantKills || 0) + 1;
      const bonusG = Math.max(35, (mob.lv || window.player?.level || 1) * 10);
      if (window.player) {
        window.player.gold = (Number(window.player.gold) || 0) + bonusG;
        window.updateStatusHUD?.();
      }
      if (Array.isArray(window.floatingTexts) && window.player) {
        window.floatingTexts.push({
          x: mob.x || window.player.x,
          y: (mob.y || window.player.y) - 46,
          text: `★거대 보너스 +${bonusG.toLocaleString()}G`,
          color: 0xfacc15,
          fontSize: 12,
          life: 30,
          maxLife: 30
        });
      }
    } else if (Math.random() < 0.032) {
      // 사냥 중 자연스럽게 터지는 행운 보너스 골드
      this.state.luckyGoldCount = (this.state.luckyGoldCount || 0) + 1;
      const luckyGold = Math.max(50, (mob.lv || window.player?.level || 1) * 15);
      this.state.luckyGoldTotal = (this.state.luckyGoldTotal || 0) + luckyGold;
      if (window.player) {
        window.player.gold = (Number(window.player.gold) || 0) + luckyGold;
        window.updateStatusHUD?.();
      }
      if (Array.isArray(window.floatingTexts) && window.player) {
        window.floatingTexts.push({
          x: mob.x || window.player.x,
          y: (mob.y || window.player.y) - 46,
          text: `💰행운 +${luckyGold.toLocaleString()}G`,
          color: 0xfde047,
          fontSize: 12,
          life: 30,
          maxLife: 30
        });
      }
    }

    this.saveToLocal();
  },

  injectHubButton() {
    const rightHud = document.querySelector('#game-wrapper .right-hud');
    if (!rightHud) return;
    if (document.getElementById('ether-20-hub-btn')) return;

    const btn = document.createElement('button');
    btn.id = 'ether-20-hub-btn';
    btn.type = 'button';
    btn.title = '지역별 몬스터 및 드롭 아이템 도감 열기';
    btn.style.cssText = 'margin-top:2px; background:rgba(15, 23, 42, 0.92); border:1px solid #38bdf8; border-radius:4px; padding:2px 7px; font-size:10px; font-weight:bold; color:#bae6fd; cursor:pointer; pointer-events:auto; box-shadow:0 2px 5px rgba(0,0,0,0.75); white-space:nowrap; touch-action:manipulation;';
    btn.innerHTML = '📖 몬스터 도감';
    btn.onclick = (e) => {
      e.stopPropagation();
      this.toggleModal();
    };
    const safeBadge = document.getElementById('safe-zone-badge');
    if (safeBadge) rightHud.insertBefore(btn, safeBadge);
    else rightHud.appendChild(btn);
  },

  selectRegion(regId) {
    this.selectedRegion = regId;
    this.renderModal();
  },

  moveToMonster(mobId) {
    const mobDef = (GameDB.Monsters || []).find(m => m.id === Number(mobId));
    if (!mobDef || !window.player) return;
    const curReg = window.currentRegionKey || 'R01';
    if (mobDef.region !== curReg) {
      window.addChat?.(`📍 '${mobDef.name}' 몬스터는 [${mobDef.region}] 지역에 서식합니다. 먼저 월드맵(마을 포탈)에서 해당 지역으로 이동하세요.`, 'log-sys');
      return;
    }

    // 현재 맵 내 살아있는 해당 몬스터 중 가장 가까운 개체 탐색
    const liveList = Array.isArray(window.monsterList) ? window.monsterList : [];
    let nearest = null;
    let minDist = Infinity;
    liveList.forEach(m => {
      if (!m || m.isDead) return;
      const baseName = (m.rawName || m.name || '').replace(/^★거대\s*/, '').trim();
      if (baseName === mobDef.name || m.mobId === mobDef.id) {
        const d = Math.hypot(m.x - window.player.x, m.y - window.player.y);
        if (d < minDist) {
          minDist = d;
          nearest = m;
        }
      }
    });

    const mModal = document.getElementById('immersive-20-modal');
    if (mModal) mModal.classList.add('hidden');

    if (nearest && typeof window.findPath === 'function') {
      window.player.targetEntity = { type: 'MONSTER', ref: nearest };
      window.player.path = window.findPath(window.player.x, window.player.y, nearest.x, nearest.y);
      window.player.isMoving = true;
      window.player.manualMoving = false;
      window.updateTopTargetUI?.(nearest);
      window.addChat?.(`📍 '${mobDef.name}' 서식 위치로 이동합니다.`, 'log-sys');
    } else {
      window.addChat?.(`📍 현재 필드에서 '${mobDef.name}' 개체를 찾지 못했습니다. (던전 서식 몬스터이거나 리스폰 대기 중)`, 'log-sys');
    }
  },

  toggleModal() {
    let m = document.getElementById('immersive-20-modal');
    if (!m) {
      m = document.createElement('div');
      m.id = 'immersive-20-modal';
      m.className = 'modal-panel hidden';
      m.style.cssText = 'width:min(94vw, 372px); max-height:78dvh; z-index:9300; display:flex; flex-direction:column; padding:6px !important;';
      (document.getElementById('game-wrapper') || document.body).appendChild(m);
      if (typeof window.makeDraggable === 'function') {
        try { window.makeDraggable('immersive-20-modal'); } catch (e) {}
      }
    }
    m.classList.toggle('hidden');
    if (!m.classList.contains('hidden')) {
      this.loadFromLocal();
      this.selectedRegion = window.currentRegionKey || 'R01';
      this.renderModal();
      window.bringModalToFront?.(m);
      window.centerModalOnScreen?.(m);
    }
  },

  renderModal() {
    const m = document.getElementById('immersive-20-modal');
    if (!m) return;
    const s = this.state;
    const regions = GameDB.Regions || [];
    const curRegId = this.selectedRegion || window.currentRegionKey || 'R01';
    const curRegObj = regions.find(r => r.id === curRegId) || regions[0];
    const regMobs = (GameDB.Monsters || []).filter(mob => mob.region === curRegId);
    const allMobsCount = (GameDB.Monsters || []).length || 52;
    const discoveredCount = Object.keys(s.bestiaryKills || {}).length;

    const itemDict = window.itemDict || {};
    const myClass = window.player?.class || 'knight';

    const mobCardsHtml = regMobs.map(mob => {
      const isBoss = String(mob.name || '').includes('(B)');
      const killCnt = s.bestiaryKills?.[mob.name] || 0;
      const dropIds = Array.isArray(mob.drop) ? mob.drop : [];
      const dropNames = dropIds.map(id => {
        const def = itemDict[id];
        if (!def) return null;
        const isQuest = id.startsWith('Q_');
        const col = isQuest ? '#fde047' : (id.startsWith('W_') || id.startsWith('A_') || id.startsWith('AC_') ? '#93c5fd' : '#d1d5db');
        return `<span style="background:#0f172a; border:1px solid #334155; color:${col}; padding:1px 5px; border-radius:4px; font-size:10.5px;">${def.name}</span>`;
      }).filter(Boolean);

      // 해당 몬스터 레벨(Lv.15 이상)에서 드롭 가능한 내 직업 스킬북 표시
      const lv = mob.lv || 1;
      if (lv >= 15) {
        const books = Object.values(itemDict).filter(it =>
          it && it.id && it.id.startsWith('BOOK_') &&
          it.reqClass === myClass &&
          lv >= (it.dropMinLv - 2) && lv <= (it.dropMaxLv + 10)
        ).slice(0, 2);
        books.forEach(bk => {
          const unlearned = typeof window.isSkillLearned === 'function' ? !window.isSkillLearned(bk.skillId) : false;
          dropNames.push(
            `<span style="background:${unlearned ? '#422006' : '#0f172a'}; border:1px solid ${unlearned ? '#facc15' : '#334155'}; color:${unlearned ? '#fde047' : '#a7f3d0'}; padding:1px 5px; border-radius:4px; font-size:10.5px;">📕${bk.skillName}${unlearned ? '(미습득)' : ''}</span>`
          );
        });
      }

      const isCurrentReg = curRegId === (window.currentRegionKey || 'R01');

      return `
        <div style="background:#14171f; border:1px solid ${isBoss ? '#dc2626' : '#2d3748'}; border-radius:6px; padding:6px 8px; display:flex; flex-direction:column; gap:3px;">
          <div style="display:flex; justify-content:space-between; align-items:center; gap:4px;">
            <div style="display:flex; align-items:center; gap:5px; flex-wrap:wrap;">
              <span style="color:${isBoss ? '#facc15' : '#f3f4f6'}; font-weight:bold; font-size:12.5px;">${isBoss ? '👑 ' : ''}${mob.name}</span>
              <span style="font-size:10.5px; color:#38bdf8; font-weight:bold;">Lv.${mob.lv}</span>
              <span style="font-size:10px; padding:0 4px; border-radius:3px; background:${mob.aggro === 'Y' ? '#7f1d1d' : '#1e293b'}; color:${mob.aggro === 'Y' ? '#fca5a5' : '#94a3b8'};">${mob.aggro === 'Y' ? '선공' : '비선공'}·${mob.type || '물리'}</span>
            </div>
            <div style="display:flex; align-items:center; gap:4px;">
              <span style="font-size:11px; color:${killCnt > 0 ? '#4ade80' : '#6b7280'}; font-weight:bold;">처치 ${killCnt.toLocaleString()}</span>
              ${isCurrentReg ? `<button type="button" onclick="window.ImmersiveSystem.moveToMonster(${mob.id})" style="background:#1e3a8a; border:1px solid #60a5fa; color:#e0f2fe; border-radius:4px; padding:1px 6px; font-size:10px; font-weight:bold; cursor:pointer;">📍이동</button>` : ''}
            </div>
          </div>
          <div style="font-size:11px; color:#9ca3af;">
            HP <b style="color:#e5e7eb;">${Number(mob.hp || 0).toLocaleString()}</b> · 공격 <b style="color:#fca5a5;">${mob.atk}</b> · 방어 <b style="color:#93c5fd;">${mob.def}</b> · EXP <b style="color:#fde047;">${Number(mob.exp || 0).toLocaleString()}</b>
          </div>
          <div style="display:flex; flex-wrap:wrap; gap:3px; margin-top:1px;">
            ${dropNames.length > 0 ? dropNames.join('') : '<span style="font-size:10.5px; color:#6b7280;">기본 골드 및 물약</span>'}
          </div>
        </div>
      `;
    }).join('');

    m.innerHTML = `
      <div class="modal-header drag-handle" style="padding:5px 8px; font-size:13.5px;">📖 몬스터 · 드롭 도감 <button class="help-q-btn" onclick="showHelpModal('immersive', event)" title="몬스터 도감 도움말">?</button></div>
      <button class="close-x-btn" onclick="window.ImmersiveSystem.toggleModal()">✖</button>

      <div style="display:grid; grid-template-columns:repeat(4, 1fr); gap:4px; background:#0f172a; border:1px solid #334155; border-radius:6px; padding:5px 6px; margin-bottom:5px; text-align:center; font-size:11px;">
        <div><div style="color:#94a3b8; font-size:10px;">도감 발견</div><div style="color:#38bdf8; font-weight:bold;">${discoveredCount}/${allMobsCount}종</div></div>
        <div><div style="color:#94a3b8; font-size:10px;">총 처치</div><div style="color:#4ade80; font-weight:bold;">${(s.totalKills || 0).toLocaleString()}</div></div>
        <div><div style="color:#94a3b8; font-size:10px;">★거대 처치</div><div style="color:#facc15; font-weight:bold;">${(s.giantKills || 0).toLocaleString()}</div></div>
        <div><div style="color:#94a3b8; font-size:10px;">👑보스 토벌</div><div style="color:#f43f5e; font-weight:bold;">${(s.bossKills || 0).toLocaleString()}</div></div>
      </div>

      <div style="display:flex; gap:4px; overflow-x:auto; padding-bottom:4px; margin-bottom:4px; scrollbar-width:thin;">
        ${regions.map(r => {
          const active = r.id === curRegId;
          return `<button type="button" onclick="window.ImmersiveSystem.selectRegion('${r.id}')" style="flex:0 0 auto; padding:4px 8px; border-radius:5px; font-size:11px; font-weight:bold; cursor:pointer; background:${active ? '#78350f' : '#14171f'}; border:1px solid ${active ? '#facc15' : '#374151'}; color:${active ? '#fde047' : '#cbd5e1'};">${r.name} <span style="font-size:9.5px; opacity:0.85;">(${r.lvRange})</span></button>`;
        }).join('')}
      </div>

      <div style="font-size:11px; color:#fde047; background:rgba(120,53,15,0.25); border:1px solid rgba(250,204,21,0.3); border-radius:5px; padding:4px 7px; margin-bottom:5px; display:flex; justify-content:space-between; align-items:center;">
        <span>🗺️ <b>${curRegObj?.name || ''}</b> (${curRegObj?.lvRange || ''})</span>
        <span style="color:#cbd5e1; font-size:10.5px;">필드 사냥 시 <b>★거대 몬스터(보상 2배+)</b>가 출현합니다</span>
      </div>

      <div style="display:flex; flex-direction:column; gap:5px; overflow-y:auto; max-height:calc(78dvh - 145px); padding-right:2px;">
        ${mobCardsHtml}
      </div>
    `;
  }
};

window.ImmersiveSystem = ImmersiveSystem;
window.toggleImmersive20Modal = () => ImmersiveSystem.toggleModal();
if (document.readyState === 'loading') {
  window.addEventListener('DOMContentLoaded', () => ImmersiveSystem.init());
} else {
  ImmersiveSystem.init();
}
