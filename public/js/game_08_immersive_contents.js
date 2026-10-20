// public/js/game_08_immersive_contents.js
// 🌟 대마법 시대 (Age of High Magic) — 간결·직관·자동형(관리 불필요) 몰입 콘텐츠 10선 통합 모듈
import { GameDB } from './data.js';

const LORE_CHAPTERS = {
  R01: { title: '제1장: 알트리아의 여명', relic: '[알트리아] 알드릭의 부러진 검초', guardianTitle: '알트리아 수호자', desc: '국왕 알드릭이 세운 초심자의 요람이자 고대 에테르 결계의 첫 번째 차원 조각 역사서.' },
  R02: { title: '제2장: 실버바인의 눈물', relic: '[실버바인] 실바나의 은빛 세계수 잎', guardianTitle: '실버바인 수호자', desc: '타락한 세계수의 뿌리에서 흐르는 은빛 마나와 요정 여왕 실바나의 결의.' },
  R03: { title: '제3장: 칼라드루의 대장간 불꽃', relic: '[칼라드루] 토르딘의 룬 망치 파편', guardianTitle: '칼라드루 수호자', desc: '붉은 협곡 깊은 곳, 드워프 명장 토르딘이 벼려낸 고대 룬 문자 기록.' },
  R04: { title: '제4장: 물안개에 잠긴 엘론드', relic: '[엘론드] 수중신전의 푸른 조개성배', guardianTitle: '엘론드 수호자', desc: '가라앉은 수중 신전과 물의 정령왕좌에 깃든 푸른 서약의 노래.' },
  R05: { title: '제5장: 모라안 사막의 신기루', relic: '[모라안] 황금 파라오의 태양 인장', guardianTitle: '모라안 수호자', desc: '황금 모래 아래 잠든 고대 파라오의 비문과 오아시스 순례자들의 기록.' },
  R06: { title: '제6장: 핏빛 달이 뜨는 늪', relic: '[블러드문] 금기된 연금술사의 호문쿨루스 핵', guardianTitle: '블러드문 수호자', desc: '블러드문 늪지대에 유배된 고대 연금술사들의 금기된 비망록.' },
  R07: { title: '제7장: 발레노스 검은 항해일지', relic: '[발레노스] 유령선장의 심해 나침반', guardianTitle: '발레노스 수호자', desc: '난파선 무덤을 떠도는 유령선단과 대해적 시대의 마지막 나침반.' },
  R08: { title: '제8장: 만년설의 프로스트홀드', relic: '[프로스트홀드] 서리거인의 빙결정 심장', guardianTitle: '프로스트홀드 수호자', desc: '서리거인의 숨결이 얼어붙은 수정동굴 속 고대 북방 전사들의 서사시.' },
  R09: { title: '제9장: 이그니스 화염의 심장', relic: '[이그니스] 불멸의 홍련 정령석', guardianTitle: '이그니스 수호자', desc: '대지가 끓어오르는 분화구에서 발굴된 고대 화염 정령의 계약서.' },
  R10: { title: '제10장: 다크우드의 침묵', relic: '[다크우드] 망자 파수꾼의 검은 등불', guardianTitle: '다크우드 수호자', desc: '까마귀 야영지 파수꾼들이 기록한 망자의 지하묘지 봉인 일지.' },
  R11: { title: '제11장: 윈드스톰 천공의 노래', relic: '[윈드스톰] 폭풍새의 황금 깃털', guardianTitle: '윈드스톰 수호자', desc: '돌풍의 절벽 너머 폭풍새가 지키는 하늘맞이 제단의 고대 풍속화.' },
  R12: { title: '제12장: 아르카나 마공학 백서', relic: '[아르카나] 고대 타이탄의 태엽 코어', guardianTitle: '아르카나 수호자', desc: '깨진 중력의 뜰에 떠 있는 고대 부유선과 기계신 타이탄의 설계도.' },
  R13: { title: '제13장: 네더게이트 심연의 경계', relic: '[네더게이트] 흑요석 파수대의 차원 열쇠', guardianTitle: '네더게이트 수호자', desc: '차원문 중심부에서 관측된 이계 에테르 파동과 흑요석 파수대의 맹세.' },
  R14: { title: '제14장: 드래곤피크 용혈의 맹약', relic: '[드래곤피크] 지크프리트의 고룡 비늘', guardianTitle: '드래곤피크 수호자', desc: '불탄 기사단 훈련소에 남겨진 용사 지크프리트와 고룡의 결투록.' },
  R15: { title: '제15장: 이터니티 영원의 회랑', relic: '[이터니티] 카엘런의 영원 에테르 성배', guardianTitle: '이터니티 수호자', desc: '부서진 기억의 길 끝에서 마주한 배교자 카엘런과 대마법 시대의 진실.' }
};

const BARD_BOSS_HINTS = [
  '🎵 "지역 보스(B)가 붉은 마법진을 그리면 1.5초 뒤 광역기가 떨어진다네! 측면으로 회피하게!"',
  '🎵 "사냥 중 일반 몬스터보다 거대한 [★거대정예] 몬스터를 처치하면 경험치·골드를 2배 이상 얻는다오!"',
  '🎵 "파티장이 [점사모드]를 켜면 용병과 파티원이 일제히 같은 타겟을 집중 타격한다네!"',
  '🎵 "무기는 +6까지, 방어구는 +4까지 실패 없이 100% 안전 강화할 수 있다오."',
  '🎵 "용병 창에서 [⚡아이템보급]을 누르면 가방 속 더 좋은 장비를 자동으로 입혀준다네!"'
];

const MERC_TACTICAL_LINES = {
  knight: {
    combat: '🛡️ "주군의 타겟을 함께 베겠습니다! 선봉은 제게 맡기십시오!"',
    evade: '🛡️ "적의 포위를 피해 전열을 재정비한 뒤 다시 돌격합니다!"',
    boss: '🛡️ "강대한 보스입니다! 제가 시선을 끌 테니 화력을 집중하십시오!"'
  },
  ranger: {
    combat: '🏹 "주군이 노리시는 표적 확인! 측면 각도에서 연속 사격할게요!"',
    evade: '🏹 "주군 쪽으로 원을 그리며 거리를 벌렸어요! 사격 각도는 완벽해요!"',
    boss: '🏹 "보스의 장판 범위를 벗어나며 약점을 정밀 사격하겠습니다!"'
  },
  wizard: {
    combat: '🔮 "에테르 파동 집중! 주군의 타겟에 비전 마법을 쏟아붓겠습니다!"',
    evade: '🔮 "위험 반경에서 이탈 완료! 주군 곁을 돌며 치유와 마법 지원을 이어갈게요!"',
    boss: '🔮 "보스전 마나 기류 파악 완료! 보호막과 회복을 준비하겠습니다!"'
  }
};

export const ImmersiveSystem = {
  activeTab: 'core10',
  state: {
    // === 자동형 몰입 콘텐츠 10선 상태 데이터 (수동 조작 불필요 · 사냥 중 자동 누적) ===
    riftEliteKills: 0,                                // [1] 거대 정예 몬스터 출현 & 토벌 (일반 몬스터보다 1.42배 큰 정예 이벤트)
    goblinEncounters: 0,                              // [2] 황금 보물 고블린 돌발 조우
    goblinBonusGoldTotal: 0,
    currentCombo: 0,                                  // [3] 연속 처치 콤보 & 각성 피버 (12초 이내 연속 처치)
    lastKillTs: 0,
    bestiaryKills: {},                                // [4] 몬스터 생태 도감 (처치 자동 기록)
    activeTitle: '알트리아 수호자',                   // [5] 지역 수호 칭호 (30마리 처치 시 자동 해금 및 최신 칭호 자동 적용)
    unlockedTitles: ['알트리아 수호자'],
    weaponMastery: { sword: 0, bow: 0, staff: 0 },    // [6] 무기 숙련도 & 전장의 훈장 (타격/처치 시 자동 누적)
    combatMedals: { totalKills: 0, bossKills: 0, maxHitDamage: 0, maxCombo: 0 },
    relics: ['[알트리아] 알드릭의 부러진 검초'],       // [7] 보스 성물함 & 기여도 전광판
    lastBossContributionRank: 1,
    lastPartyDiceRoll: 95,
    visitedRegions: ['R01'],                          // [8] 15차원 탐사 발자취 & 에테르 연대기
    loreFragments: ['R01'],
    campfireTicks: 0,                                 // [9] 마을 모닥불 자동 온기 & 공략 담화
    lastBardStory: BARD_BOSS_HINTS[0],
    weatherMode: '에테르 미풍 (맑음)',                 // [10] 실시간 차원 기류 & 용병 전술 교감
    mercBondPoints: 0,
    lastMercLine: MERC_TACTICAL_LINES.knight.combat,
    lastBriefedBoss: ''
  },

  init() {
    this.loadFromLocal();
    this.injectHubButton();
    setInterval(() => {
      this.injectHubButton();
      this.worldEnvironmentTick();
    }, 5000);
  },

  saveToLocal() {
    try {
      const key = `MAGIC_IMMERSIVE_20_${window.activeCharacterId || 'default'}`;
      localStorage.setItem(key, JSON.stringify(this.state));
    } catch (e) {}
  },

  loadFromLocal() {
    try {
      const key = `MAGIC_IMMERSIVE_20_${window.activeCharacterId || 'default'}`;
      const raw = localStorage.getItem(key);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          Object.assign(this.state, parsed);
        }
      }
    } catch (e) {}
  },

  // 자동 누적된 패시브 보너스 수치 계산 (별도 관리 없이 플레이어에게 즉시 반영되는 요약치)
  getPassiveBonusSummary() {
    const s = this.state;
    const speciesCount = Object.keys(s.bestiaryKills || {}).length;
    const titleCount = (s.unlockedTitles || []).length;
    const relicCount = (s.relics || []).length;
    const regionCount = (s.visitedRegions || []).length;
    const totalMastery = (s.weaponMastery?.sword || 0) + (s.weaponMastery?.bow || 0) + (s.weaponMastery?.staff || 0);

    const atkBonus = Math.min(35, Math.floor((s.riftEliteKills || 0) / 2) + titleCount * 2 + Math.floor(totalMastery / 80));
    const defBonus = Math.min(28, Math.floor(speciesCount * 1.2) + relicCount * 2);
    const hpBonus = Math.min(450, speciesCount * 15 + regionCount * 12);
    const goldExpBonusPct = Math.min(20, regionCount + Math.floor((s.mercBondPoints || 0) / 50));

    return { atkBonus, defBonus, hpBonus, goldExpBonusPct, speciesCount, totalMastery };
  },

  onBossEngage(bossMob) {
    if (!bossMob || !bossMob.isBoss) return;
    const bName = (bossMob.rawName || bossMob.name || '지역 보스').replace(/^\[.*?\]\s*/, '').trim();
    if (this.state.lastBriefedBoss === bName) return;
    this.state.lastBriefedBoss = bName;
    window.addChat?.(`🚨 [보스 교전 경보] 수호 보스 '${bName}' 교전 돌입! 붉은 광역 예고 장판(1.5초) 시 측면 회피 및 점사를 유지하세요!`, 'log-hit');
    if (window.mercenary?.hired && !window.mercenary.isDead) {
      const mCls = window.mercenary.class || 'knight';
      const line = MERC_TACTICAL_LINES[mCls]?.boss || MERC_TACTICAL_LINES.knight.boss;
      this.state.lastMercLine = line;
      window.mercenary.chatBubble = { text: line.replace(/^.*?"|".*$/g, ''), expiresAt: Date.now() + 4000 };
    }
  },

  onMonsterKilled(mob, hitDmg = 0) {
    if (!mob) return;
    const now = typeof window.getSyncedServerTime === 'function' ? window.getSyncedServerTime() : Date.now();
    const rawName = (mob.rawName || mob.name || '')
      .replace(/^👑?\[★거대정예\]\s*/, '')
      .replace(/^\[.*?\]\s*/, '')
      .trim();
    if (!rawName) return;

    // [1] 👑 거대 정예 몬스터 토벌 자동 기록 (사냥 중 일반 몬스터보다 크게 나타나는 정예 몬스터)
    if (!mob.isBoss && mob.isElite) {
      this.state.riftEliteKills = (this.state.riftEliteKills || 0) + 1;
      const eliteBonusGold = Math.max(40, (mob.lv || window.player?.level || 1) * 12);
      if (window.player) {
        window.player.gold = (Number(window.player.gold) || 0) + eliteBonusGold;
        window.updateStatusHUD?.();
      }
      window.addChat?.(`👑 [1. 거대 정예 몬스터 토벌!] 일반 몬스터보다 거대한 '${rawName}' 정예를 처치하여 추가 골드(+${eliteBonusGold.toLocaleString()} G)와 토벌 기록(${this.state.riftEliteKills}회)을 달성했습니다!`, 'log-kill');
    }

    // [2] 💰 황금 보물 고블린 돌발 출현 (사냥 중 자동 골드 주머니 획득)
    if (!mob.isBoss && Math.random() < 0.026) {
      this.state.goblinEncounters = (this.state.goblinEncounters || 0) + 1;
      const bonusGold = Math.max(60, (window.player?.level || 1) * 18);
      this.state.goblinBonusGoldTotal = (this.state.goblinBonusGoldTotal || 0) + bonusGold;
      if (window.player) {
        window.player.gold = (Number(window.player.gold) || 0) + bonusGold;
        window.updateStatusHUD?.();
      }
      window.addChat?.(`💰 [2. 황금 보물 고블린 조우!] 차원 틈새에서 나타난 보물 고블린에게서 골드 주머니(+${bonusGold.toLocaleString()} G)를 자동 획득했습니다!`, 'log-kill');
    }

    // [3] 🔥 연속 처치 콤보 & 각성 피버 (12초 이내 연속 처치 시 자동 누적, 15콤보 단위 각성 오라)
    this.state.currentCombo = (now - this.state.lastKillTs <= 12000) ? (this.state.currentCombo + 1) : 1;
    this.state.lastKillTs = now;
    if (this.state.currentCombo > (this.state.combatMedals.maxCombo || 0)) {
      this.state.combatMedals.maxCombo = this.state.currentCombo;
    }
    if (this.state.currentCombo > 0 && this.state.currentCombo % 15 === 0) {
      if (window.activeEffects && window.player && window.activeEffects.length < 44) {
        window.activeEffects.push({ type: 'buff', x: window.player.x, y: window.player.y, life: 28, maxLife: 28 });
      }
      if (window.player) {
        window.player.hp = Math.min(window.player.maxHp, (window.player.hp || 1) + Math.max(15, Math.floor((window.player.maxHp || 100) * 0.05)));
        window.updateStatusHUD?.();
      }
      window.addChat?.(`🔥 [3. 연속 사냥 ${this.state.currentCombo} COMBO 피버!] 에테르 각성 오라가 발동되어 체력이 자동 회복됩니다!`, 'log-kill');
    }

    // [4] 📖 몬스터 생태 도감 자동 기록
    this.state.bestiaryKills[rawName] = (this.state.bestiaryKills[rawName] || 0) + 1;
    this.state.combatMedals.totalKills = (this.state.combatMedals.totalKills || 0) + 1;
    if (hitDmg > (this.state.combatMedals.maxHitDamage || 0)) {
      this.state.combatMedals.maxHitDamage = Math.round(hitDmg);
    }

    // [5] 🎖️ 지역 수호 칭호 (몬스터 30마리 처치 시 자동 해금 & 자동 장착)
    const rk = window.currentRegionKey || 'R01';
    const regLore = LORE_CHAPTERS[rk] || LORE_CHAPTERS.R01;
    if (this.state.bestiaryKills[rawName] === 30) {
      const guardianTitle = regLore.guardianTitle || `${rawName} 수호자`;
      if (!this.state.unlockedTitles.includes(guardianTitle)) {
        this.state.unlockedTitles.push(guardianTitle);
      }
      this.state.activeTitle = guardianTitle;
      window.addChat?.(`🎖️ [5. 지역 수호 칭호 자동 해금] '${rawName}' 30마리 토벌 달성! '[${guardianTitle}]' 칭호가 자동 적용되었습니다!`, 'log-kill');
    }

    // [6] ⚔️ 무기 숙련도 자동 성장
    const cls = window.player?.class || 'knight';
    if (cls === 'knight') this.state.weaponMastery.sword = (this.state.weaponMastery.sword || 0) + 1;
    else if (cls === 'ranger') this.state.weaponMastery.bow = (this.state.weaponMastery.bow || 0) + 1;
    else this.state.weaponMastery.staff = (this.state.weaponMastery.staff || 0) + 1;

    // [7] 🏆 보스 토벌 성물함 & 기여도 전광판 자동 등록
    if (mob.isBoss) {
      this.state.combatMedals.bossKills = (this.state.combatMedals.bossKills || 0) + 1;
      this.state.lastBossContributionRank = 1;
      this.state.lastPartyDiceRoll = Math.floor(65 + Math.random() * 36);
      if (!this.state.loreFragments.includes(rk)) this.state.loreFragments.push(rk);
      const relic = regLore.relic || `[${rk}] ${rawName}의 성물`;
      if (!this.state.relics.includes(relic)) this.state.relics.push(relic);
      const bossTitle = `${rawName} 정복자`;
      if (!this.state.unlockedTitles.includes(bossTitle)) {
        this.state.unlockedTitles.push(bossTitle);
        this.state.activeTitle = bossTitle;
      }
      window.addChat?.(`🏆 [7. 보스 성물 자동 수집] '${rawName}' 토벌 성공! 성물 '${relic}'이(가) 도감에 자동 등재되었습니다!`, 'log-kill');
    }

    // [10] 🤝 용병 유대감 & 전투 말풍선 자동 교감
    if (window.mercenary?.hired && !window.mercenary?.isDead) {
      this.state.mercBondPoints = (this.state.mercBondPoints || 0) + 1;
      if (this.state.mercBondPoints % 22 === 0) {
        const mCls = window.mercenary.class || 'knight';
        const line = MERC_TACTICAL_LINES[mCls]?.combat || MERC_TACTICAL_LINES.knight.combat;
        this.state.lastMercLine = line;
        window.mercenary.chatBubble = { text: line.replace(/^.*?"|".*$/g, ''), expiresAt: Date.now() + 3500 };
      }
    }

    this.saveToLocal();
  },

  // [8] 15차원 탐사 발자취 & [9] 마을 모닥불 온기 & [10] 실시간 차원 마나 기류 자동 갱신
  worldEnvironmentTick() {
    if (!window.player) return;
    const rk = window.currentRegionKey || 'R01';
    if (!this.state.visitedRegions.includes(rk)) {
      this.state.visitedRegions.push(rk);
      if (!this.state.loreFragments.includes(rk)) {
        this.state.loreFragments.push(rk);
      }
      this.saveToLocal();
    }

    const wList = [
      '마나 유성우 밤',
      '은빛 물안개 기류',
      '붉은 노을 마나장',
      '에테르 미풍 (맑음)',
      '아르카나 오로라 파동'
    ];
    const sharedNow = typeof window.getSyncedServerTime === 'function' ? window.getSyncedServerTime() : Date.now();
    const regNum = parseInt(String(rk).replace(/\D/g, ''), 10) || 1;
    const weatherIdx = (Math.floor(sharedNow / 180000) + regNum) % wList.length;
    this.state.weatherMode = wList[weatherIdx];

    if (typeof window.isInsideSafeZone === 'function' && window.isInsideSafeZone(window.player.x, window.player.y)) {
      this.state.campfireTicks = (this.state.campfireTicks || 0) + 1;
      if (this.state.campfireTicks % 12 === 0) {
        this.state.lastBardStory = BARD_BOSS_HINTS[Math.floor(Math.random() * BARD_BOSS_HINTS.length)];
      }
    }
  },

  injectHubButton() {
    const rightHud = document.querySelector('#game-wrapper .right-hud');
    if (!rightHud) return;
    if (document.getElementById('ether-20-hub-btn')) return;

    const btn = document.createElement('button');
    btn.id = 'ether-20-hub-btn';
    btn.type = 'button';
    btn.title = '자동형 몰입 콘텐츠 10선 에테르 도감 열기';
    btn.style.cssText = 'margin-top:2px; background:rgba(15, 23, 42, 0.92); border:1px solid #38bdf8; border-radius:4px; padding:2px 6px; font-size:9.5px; font-weight:bold; color:#bae6fd; cursor:pointer; pointer-events:auto; box-shadow:0 2px 5px rgba(0,0,0,0.75); white-space:nowrap; touch-action:manipulation;';
    btn.innerHTML = '📘 에테르 도감';
    btn.onclick = (e) => {
      e.stopPropagation();
      this.toggleModal();
    };
    const safeBadge = document.getElementById('safe-zone-badge');
    if (safeBadge) rightHud.insertBefore(btn, safeBadge);
    else rightHud.appendChild(btn);
  },

  setTab(tabKey) {
    this.activeTab = tabKey;
    this.renderModal();
  },

  toggleModal() {
    let m = document.getElementById('immersive-20-modal');
    if (!m) {
      m = document.createElement('div');
      m.id = 'immersive-20-modal';
      m.className = 'modal-panel hidden';
      m.style.cssText = 'width:min(94vw, 368px); max-height:78dvh; z-index:9300; display:flex; flex-direction:column; padding:5px !important;';
      (document.getElementById('game-wrapper') || document.body).appendChild(m);
      if (typeof window.makeDraggable === 'function') {
        try { window.makeDraggable('immersive-20-modal'); } catch (e) {}
      }
    }
    m.classList.toggle('hidden');
    if (!m.classList.contains('hidden')) {
      this.loadFromLocal();
      this.worldEnvironmentTick();
      this.renderModal();
      window.bringModalToFront?.(m);
      window.centerModalOnScreen?.(m);
    }
  },

  renderModal() {
    const m = document.getElementById('immersive-20-modal');
    if (!m) return;
    const s = this.state;
    const bonus = this.getPassiveBonusSummary();
    const explorePct = Math.min(100, Math.round(((s.visitedRegions?.length || 1) / 15) * 100));

    const tabBtnStyle = (k) => this.activeTab === k
      ? 'flex:1; padding:5px 4px; font-size:12px; font-weight:bold; background:#78350f; border:1px solid #facc15; color:#fde047; border-radius:5px; cursor:pointer;'
      : 'flex:1; padding:5px 4px; font-size:12px; font-weight:bold; background:#14171f; border:1px solid #374151; color:#cbd5e1; border-radius:5px; cursor:pointer;';

    const cardStyle = 'background:#14171f; border:1px solid #3d3020; border-radius:6px; padding:6px 8px; display:flex; flex-direction:column; gap:2px;';
    const badgeAuto = `<span style="font-size:10px; background:#065f46; color:#6ee7b7; border:1px solid #34d399; border-radius:4px; padding:0 5px; font-weight:bold;">자동작동</span>`;

    let bodyHtml = '';
    if (this.activeTab === 'core10') {
      const items10 = [
        {
          num: '01',
          icon: '👑',
          title: '거대 정예 몬스터 출현 (필드 돌발)',
          stat: `토벌 ${s.riftEliteKills || 0}회`,
          desc: '사냥터에서 일반 몬스터보다 1.42배 거대하고 황금 오라를 두른 [★거대정예]가 출현합니다. (처치 시 경험치 2.2배·골드 2.4배 자동 획득)'
        },
        {
          num: '02',
          icon: '💰',
          title: '황금 보물 고블린 조우',
          stat: `출현 ${s.goblinEncounters || 0}회 (+${(s.goblinBonusGoldTotal || 0).toLocaleString()}G)`,
          desc: '사냥 중 차원 틈새에서 돌발 출현하여 추가 골드 주머니를 즉시 자동 지급합니다.'
        },
        {
          num: '03',
          icon: '🔥',
          title: '연속 사냥 콤보 & 각성 피버',
          stat: `현재 ${s.currentCombo || 0} / 최고 ${s.combatMedals?.maxCombo || 0} COMBO`,
          desc: '12초 내 연속 처치 시 콤보가 자동 누적되며, 15콤보마다 각성 오라와 체력 회복이 자동 발동됩니다.'
        },
        {
          num: '04',
          icon: '📖',
          title: '몬스터 생태 도감 (자동 기록)',
          stat: `수집 ${bonus.speciesCount}종 · 총 ${(s.combatMedals?.totalKills || 0).toLocaleString()}마리`,
          desc: '처치한 몬스터가 도감에 자동 기록되며, 수집 종수에 따라 최대 체력이 영구 증가합니다.'
        },
        {
          num: '05',
          icon: '🎖️',
          title: '지역 수호 칭호 (자동 해금)',
          stat: `[${s.activeTitle || '알트리아 수호자'}] (${(s.unlockedTitles || []).length}개 보유)`,
          desc: '지역 몬스터 30마리 처치 시 수호 칭호가 자동 해금되며 모든 칭호 효과가 자동 합산됩니다.'
        },
        {
          num: '06',
          icon: '⚔️',
          title: '무기 숙련도 & 전장의 훈장',
          stat: `검 ${s.weaponMastery?.sword || 0} · 활 ${s.weaponMastery?.bow || 0} · 지팡이 ${s.weaponMastery?.staff || 0}`,
          desc: '전투할수록 주력 무기 숙련도가 자동 상승합니다.'
        },
        {
          num: '07',
          icon: '🏆',
          title: '보스 성물함 & 토벌 전광판',
          stat: `성물 ${(s.relics || []).length}/15개 · 보스 ${s.combatMedals?.bossKills || 0}회`,
          desc: '지역 보스(B) 처치 시 성물이 자동 수집되고 영구 방어 가호가 부여됩니다.'
        },
        {
          num: '08',
          icon: '🗺️',
          title: '15차원 탐사 발자취 & 연대기',
          stat: `탐사율 ${explorePct}% (${(s.visitedRegions || []).length}/15 지역)`,
          desc: '새로운 지역에 진입만 해도 탐사율과 에테르 연대기 역사서가 자동 해금됩니다.'
        },
        {
          num: '09',
          icon: '🏕️',
          title: '마을 모닥불 온기 & 공략 담화',
          stat: `온기 충전 ${s.campfireTicks || 0}회`,
          desc: `${s.lastBardStory || BARD_BOSS_HINTS[0]}`
        },
        {
          num: '10',
          icon: '🌦️',
          title: '실시간 차원 기류 & 용병 교감',
          stat: `${s.weatherMode} · 유대 ${(s.mercBondPoints || 0).toLocaleString()}P`,
          desc: `서버 동기화 기류 및 용병 자동 대사: ${s.lastMercLine || MERC_TACTICAL_LINES.knight.combat}`
        }
      ];

      bodyHtml = `
        <div style="background:linear-gradient(90deg, #1e1b4b, #0f172a); border:1px solid #60a5fa; border-radius:6px; padding:6px 8px; font-size:11.5px; color:#e0f2fe; line-height:1.45;">
          <div style="font-weight:bold; color:#fde047; margin-bottom:2px;">✨ 자동 누적 패시브 효과 (별도 조작 없이 상시 적용 중)</div>
          <div>• 공격력 <b>+${bonus.atkBonus}</b> · 방어력 <b>+${bonus.defBonus}</b> · 최대HP <b>+${bonus.hpBonus}</b> · 골드/경험치 <b>+${bonus.goldExpBonusPct}%</b></div>
        </div>
        ${items10.map(it => `
          <div style="${cardStyle}">
            <div style="display:flex; justify-content:space-between; align-items:center; gap:4px;">
              <span style="color:#fde047; font-weight:bold; font-size:12.5px;">${it.icon} [${it.num}] ${it.title}</span>
              ${badgeAuto}
            </div>
            <div style="color:#4ade80; font-size:11.5px; font-weight:bold;">📊 현황: ${it.stat}</div>
            <div style="color:#d1d5db; font-size:11.5px; line-height:1.38;">${it.desc}</div>
          </div>
        `).join('')}
      `;
    } else {
      const entries = Object.entries(s.bestiaryKills || {});
      bodyHtml = `
        <div style="${cardStyle}">
          <div style="color:#fde047; font-weight:bold; font-size:12.5px;">🏆 수집한 지역 보스 성물 (${(s.relics || []).length}/15)</div>
          <div style="color:#e5e7eb; font-size:11.5px; line-height:1.45; margin-top:2px;">${(s.relics || []).join(' · ')}</div>
        </div>

        <div style="${cardStyle}">
          <div style="color:#fde047; font-weight:bold; font-size:12.5px;">🎖️ 자동 해금된 수호 칭호 (${(s.unlockedTitles || []).length}개)</div>
          <div style="display:flex; gap:4px; flex-wrap:wrap; margin-top:3px;">
            ${(s.unlockedTitles || []).map(t => `<span style="padding:2px 7px; font-size:11px; border-radius:4px; border:1px solid #4ade80; background:#052e16; color:#86efac; font-weight:bold;">${t}</span>`).join('')}
          </div>
        </div>

        <div style="${cardStyle}; max-height:26dvh; overflow-y:auto;">
          <div style="color:#fde047; font-weight:bold; font-size:12.5px; margin-bottom:3px;">📖 몬스터 생태 도감 자동 기록 (${entries.length}종)</div>
          ${entries.length === 0
            ? `<div style="color:#9ca3af; font-size:11.5px; text-align:center; padding:8px;">사냥을 시작하면 처치한 몬스터가 자동으로 기록됩니다!</div>`
            : entries.map(([mName, cnt]) => `
              <div style="display:flex; justify-content:space-between; align-items:center; background:#0c0e14; padding:4px 7px; border-radius:4px; border:1px solid #2d3748; font-size:11.5px; margin-bottom:2px;">
                <span style="color:#f3f4f6; font-weight:bold;">👾 ${mName}</span>
                <span style="color:${cnt >= 30 ? '#4ade80' : '#fde047'}; font-weight:bold;">${cnt.toLocaleString()}회 ${cnt >= 30 ? '🎖️칭호달성' : `(칭호까지 ${30 - cnt}회)`}</span>
              </div>
            `).join('')}
        </div>

        <div style="${cardStyle}; max-height:24dvh; overflow-y:auto;">
          <div style="color:#fde047; font-weight:bold; font-size:12.5px; margin-bottom:3px;">📜 15차원 에테르 연대기 (${(s.loreFragments || []).length}/15장)</div>
          ${Object.entries(LORE_CHAPTERS).map(([rId, ch]) => {
            const unlocked = (s.loreFragments || []).includes(rId) || (s.visitedRegions || []).includes(rId);
            return `
              <div style="background:#0c0e14; border:1px solid ${unlocked ? '#ca8a04' : '#2d3748'}; border-radius:4px; padding:4px 6px; margin-bottom:2px; opacity:${unlocked ? '1' : '0.55'};">
                <div style="font-size:11.5px; font-weight:bold; color:${unlocked ? '#fde047' : '#9ca3af'};">${unlocked ? '🔓' : '🔒'} [${rId}] ${ch.title}</div>
                <div style="font-size:11px; color:#e5e7eb; margin-top:1px; line-height:1.38;">${unlocked ? ch.desc : '해당 지역 진입 또는 보스 처치 시 자동 해금됩니다.'}</div>
              </div>
            `;
          }).join('')}
        </div>
      `;
    }

    m.innerHTML = `
      <div class="modal-header drag-handle" style="padding:5px 8px; font-size:13.5px;">📘 에테르 도감 (자동형 몰입 콘텐츠 10선) <button class="help-q-btn" onclick="showHelpModal('immersive', event)" title="에테르 도감 도움말">?</button></div>
      <button class="close-x-btn" onclick="window.ImmersiveSystem.toggleModal()">✖</button>
      <div style="display:flex; gap:4px; padding:4px 4px 2px 4px;">
        <button type="button" style="${tabBtnStyle('core10')}" onclick="window.ImmersiveSystem.setTab('core10')">⚡ 자동형 콘텐츠 10선</button>
        <button type="button" style="${tabBtnStyle('records')}" onclick="window.ImmersiveSystem.setTab('records')">📖 도감·성물·연대기 기록</button>
      </div>
      <div style="display:flex; flex-direction:column; gap:5px; padding:4px; overflow-y:auto; max-height:calc(78dvh - 68px); font-size:12px; color:#f3f4f6;">
        ${bodyHtml}
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
