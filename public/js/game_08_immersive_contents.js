// public/js/game_08_immersive_contents.js
// 🌟 대마법 시대 (Age of High Magic) — 세계관 일관성 유지 · 밸런스 무영향 몰입형 콘텐츠 20종 통합 모듈
import { GameDB } from './data.js';

const LORE_CHAPTERS = {
  R01: { title: '제1장: 알트리아의 여명', desc: '국왕 알드릭이 세운 초심자의 요람이자 고대 에테르 결계의 첫 번째 기점.' },
  R02: { title: '제2장: 실버바인의 눈물', desc: '타락한 세계수의 뿌리에서 흐르는 은빛 마나와 요정 여왕 실바나의 결의.' },
  R03: { title: '제3장: 칼라드루의 대장간 불꽃', desc: '붉은 협곡 깊은 곳, 드워프 명장 토르딘이 벼려낸 고대 룬 문자 기록.' },
  R04: { title: '제4장: 물안개에 잠긴 엘론드', desc: '가라앉은 수중 신전과 물의 정령왕좌에 깃든 푸른 서약의 노래.' },
  R05: { title: '제5장: 모라안 사막의 신기루', desc: '황금 모래 아래 잠든 고대 파라오의 비문과 오아시스 순례자들의 기록.' },
  R06: { title: '제6장: 핏빛 달이 뜨는 늪', desc: '블러드문 늪지대에 유배된 고대 연금술사들의 금기된 비망록.' },
  R07: { title: '제7장: 발레노스 검은 항해일지', desc: '난파선 무덤을 떠도는 유령선단과 대해적 시대의 마지막 나침반.' },
  R08: { title: '제8장: 만년설의 프로스트홀드', desc: '서리거인의 숨결이 얼어붙은 수정동굴 속 고대 북방 전사들의 서사시.' },
  R09: { title: '제9장: 이그니스 화염의 심장', desc: '대지가 끓어오르는 분화구에서 발굴된 고대 화염 정령의 계약서.' },
  R10: { title: '제10장: 다크우드의 침묵', desc: '까마귀 야영지 파수꾼들이 기록한 망자의 지하묘지 봉인 일지.' },
  R11: { title: '제11장: 윈드스톰 천공의 노래', desc: '돌풍의 절벽 너머 폭풍새가 지키는 하늘맞이 제단의 고대 풍속화.' },
  R12: { title: '제12장: 아르카나 마공학 백서', desc: '깨진 중력의 뜰에 떠 있는 고대 부유선과 기계신 타이탄의 설계도.' },
  R13: { title: '제13장: 네더게이트 심연의 경계', desc: '차원문 중심부에서 관측된 이계 에테르 파동과 흑요석 파수대의 맹세.' },
  R14: { title: '제14장: 드래곤피크 용혈의 맹약', desc: '불탄 기사단 훈련소에 남겨진 용사 지크프리트와 고룡의 결투록.' },
  R15: { title: '제15장: 이터니티 영원의 회랑', desc: '부서진 기억의 길 끝에서 마주한 배교자 카엘런과 대마법 시대의 진실.' }
};

const BARD_STORIES = [
  '🎵 "알트리아의 바람은 언제나 첫걸음을 내딛는 모험가의 등을 다정히 밀어준다네."',
  '🎵 "실버바인의 은빛 잎사귀가 흔들릴 때면, 옛 요정들의 자장가가 숲을 메운다오."',
  '🎵 "칼라드루의 모루 소리가 멈추지 않는 한, 왕국의 방패는 결코 부서지지 않으리!"',
  '🎵 "발레노스 수평선 너머 보랏빛 오로라가 피어오르면, 고대 항해자들의 별자리가 길을 밝힌다네."',
  '🎵 "모닥불 앞에 둘러앉은 동료의 미소야말로, 그 어떤 비전 마법보다 따뜻한 축복이라오."'
];

const MERC_DIALOGUES = {
  knight: [
    '🛡️ "주군의 등 뒤는 제가 목숨을 걸고 지키겠습니다. 안심하고 전진하십시오!"',
    '🛡️ "방패에 새겨진 상처는 우리의 영광스러운 훈장입니다."',
    '🛡️ "적의 공세가 거셉니다. 제가 선두에서 진형을 유지하겠습니다!"'
  ],
  ranger: [
    '🏹 "바람의 결이 좋아요. 주군이 노리시는 표적은 결코 놓치지 않아요!"',
    '🏹 "숲의 발걸음으로 주군 곁을 맴돌며 빈틈없이 엄호할게요."',
    '🏹 "멀리서 다가오는 기척까지 모두 읽고 있으니 걱정 마세요!"'
  ],
  wizard: [
    '🔮 "에테르의 파동이 주군과 공명하고 있어요. 언제든 치유와 비전 마법을 펼칠 준비가 됐답니다."',
    '🔮 "고대 마법서의 한 구절보다 주군과 함께 걷는 이 여정이 더 신비로워요."',
    '🔮 "마나 순환이 안정적이네요. 주군의 타겟에 화력을 집중하겠습니다!"'
  ]
};

export const ImmersiveSystem = {
  activeTab: 'overview',
  state: {
    bestiaryKills: {},                                // 1. 몬스터 생태 도감
    activeTitle: '에테르 모험가',                     // 2. 지역 수호 칭호
    unlockedTitles: ['에테르 모험가', '알트리아의 개척자'],
    goblinEncounters: 0,                              // 3. 에테르 환영 정령 조우 기록
    riftEliteKills: 0,                                // 4. 차원 균열 변이체 관측 기록
    etherWeaponElement: '성광(HOLY)',                 // 5. 무기 5대 원소 공명 (시각/명판 연출)
    lastBossContributionRank: 1,                      // 6. 보스 토벌 전당 기록
    loreFragments: ['R01'],                           // 7. 에테르 연대기 15장
    campfireTicks: 0,                                 // 8. 안전지대 모닥불 온기 & 음유시인 담화
    lastBardStory: BARD_STORIES[0],
    weatherMode: '에테르 미풍 (맑음)',                // 9. 차원 마나 기류 날씨
    mercBondPoints: 0,                                // 10. 용병 유대감 & 교감 대사
    lastMercLine: '동행 중인 용병과 교감을 나누어 보세요.',
    bounties: [],                                     // 11. 왕립 학회 생태 조사 과제 (명예 점수)
    scholarPoints: 0,
    weaponMastery: { sword: 0, bow: 0, staff: 0 },    // 12. 무기 계열별 수련 인장
    combatMedals: { totalKills: 0, bossKills: 0, maxHitDamage: 0, maxCombo: 0 },
    relics: ['알드릭의 부러진 검초'],                 // 13. 고대 에테르 유물 박물관
    akashaNotes: ['차원 여행자 아카샤의 첫 번째 관측기: 에테르는 기억을 품고 흐른다.'], // 14. 아카샤의 전설 비화
    dailyHoroscope: '🌟 [알드릭의 사자자리] 담대한 발걸음 끝에 고대의 전승이 모습을 드러냅니다.', // 15. 12성좌 운세
    guildRank: 'C (견습 수호자)',                     // 16. 모험가 길드 명예 서훈
    lastBriefedBoss: null,                            // 17. 지역 보스 전승 도감
    customWeaponInscription: '에테르의 수호검',       // 18. 대장장이 토르딘의 무기 명판 각인
    visitedRegions: ['R01'],                          // 19. 15차원 대륙 답사 발자취 지도(%)
    currentCombo: 0,                                  // 20. 연속 사냥 콤보 마일스톤
    lastKillTs: 0
  },

  init() {
    this.loadFromLocal();
    if (!this.state.bounties || this.state.bounties.length === 0) {
      this.rollDailyBounties();
    }
    this.injectHubButton();
    setInterval(() => {
      this.injectHubButton();
      this.worldEnvironmentTick();
    }, 4000);
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

  rollDailyBounties() {
    const lv = window.player?.level || 1;
    const pool = (GameDB.Monsters || []).filter(m => !m.name.includes('(B)') && Math.abs((m.lv || 1) - lv) <= 18);
    const picked = (pool.length >= 3 ? pool : (GameDB.Monsters || []).slice(0, 4)).slice(0, 3);
    this.state.bounties = picked.map((m, idx) => ({
      id: `BNT_${idx + 1}`,
      targetName: m.name,
      reqCount: 15 + idx * 10,
      curCount: 0,
      done: false,
      honorReward: (idx + 1) * 25
    }));
    this.saveToLocal();
  },

  onMonsterKilled(mob, hitDmg = 0) {
    if (!mob) return;
    const now = Date.now();
    const rawName = (mob.rawName || mob.name || '').replace(/^\[.*?\]\s*/, '').trim();
    if (!rawName) return;

    this.state.currentCombo = (now - this.state.lastKillTs <= 12000) ? (this.state.currentCombo + 1) : 1;
    this.state.lastKillTs = now;
    if (this.state.currentCombo > this.state.combatMedals.maxCombo) {
      this.state.combatMedals.maxCombo = this.state.currentCombo;
    }
    if (this.state.currentCombo > 0 && this.state.currentCombo % 25 === 0) {
      window.addChat?.(`⚡ [전투 기록: ${this.state.currentCombo} COMBO 달성!] 에테르 공명 훈장이 갱신되었습니다!`, 'log-sys');
    }

    this.state.bestiaryKills[rawName] = (this.state.bestiaryKills[rawName] || 0) + 1;
    this.state.combatMedals.totalKills++;
    if (hitDmg > this.state.combatMedals.maxHitDamage) {
      this.state.combatMedals.maxHitDamage = hitDmg;
    }

    const cls = window.player?.class || 'knight';
    if (cls === 'knight') this.state.weaponMastery.sword++;
    else if (cls === 'ranger') this.state.weaponMastery.bow++;
    else this.state.weaponMastery.staff++;

    if (window.mercenary?.hired && !window.mercenary?.isDead) {
      this.state.mercBondPoints++;
    }

    if (this.state.bestiaryKills[rawName] === 30) {
      const t = `${rawName} 연구가`;
      if (!this.state.unlockedTitles.includes(t)) {
        this.state.unlockedTitles.push(t);
        this.state.activeTitle = t;
        window.addChat?.(`🎖️ [명예 칭호 해금] 생태 도감 30회 기록 달성으로 '${t}' 칭호를 획득했습니다!`, 'log-sys');
      }
    }

    if (!mob.isBoss && Math.random() < 0.02) {
      this.state.goblinEncounters++;
      window.addChat?.(`✨ [에테르 환영 정령 관측] 전장 너머로 반짝이는 고대 에테르 정령의 흔적을 도감에 기록했습니다! (누적 ${this.state.goblinEncounters}회)`, 'log-sys');
    } else if (!mob.isBoss && Math.random() < 0.018) {
      this.state.riftEliteKills++;
      const note = `아카샤의 관측기 #${this.state.akashaNotes.length + 1}: [${rawName}] 주변에서 미세한 차원 파동이 확인되었다.`;
      if (this.state.akashaNotes.length < 15 && !this.state.akashaNotes.includes(note)) {
        this.state.akashaNotes.push(note);
      }
    }

    if (mob.isBoss) {
      this.state.combatMedals.bossKills++;
      const rk = window.currentRegionKey || 'R01';
      if (!this.state.loreFragments.includes(rk)) this.state.loreFragments.push(rk);
      const relic = `[${rk}] ${rawName}의 기념 성물`;
      if (!this.state.relics.includes(relic)) this.state.relics.push(relic);
      const bossTitle = `${rawName} 정복자`;
      if (!this.state.unlockedTitles.includes(bossTitle)) this.state.unlockedTitles.push(bossTitle);
      window.addChat?.(`🏆 [보스 전승 기록 & 성물 해금] '${relic}'이(가) 박물관에 전시되었습니다!`, 'log-kill');
    }

    this.state.bounties.forEach(b => {
      if (!b.done && rawName.includes(b.targetName)) {
        b.curCount = Math.min(b.reqCount, b.curCount + 1);
        if (b.curCount >= b.reqCount) {
          b.done = true;
          this.state.scholarPoints = (this.state.scholarPoints || 0) + (b.honorReward || 25);
          window.addChat?.(`🏛️ [왕립 학회 생태 조사 완료] '${b.targetName}' 조사 완수! 학회 명예 점수 +${b.honorReward || 25} P 획득!`, 'log-sys');
        }
      }
    });

    const sc = this.state.combatMedals.totalKills + this.state.combatMedals.bossKills * 50 + (this.state.scholarPoints || 0);
    this.state.guildRank = sc >= 2500
      ? 'SSS (에테르 그랜드마스터)'
      : (sc >= 1000 ? 'SS (차원 집행관)' : (sc >= 400 ? 'S (미스릴 가디언)' : (sc >= 150 ? 'A (왕립 정예기사)' : 'B (숙련 수호자)')));

    this.saveToLocal();
  },

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
      '에테르 미풍 (맑음)',
      '엘론드 은빛 물안개',
      '마나 유성우 밤하늘',
      '칼라드루 노을빛 기류',
      '아르카나 오로라 파동'
    ];
    if (Math.random() < 0.15) {
      this.state.weatherMode = wList[Math.floor(Math.random() * wList.length)];
    }
    if (typeof window.isInsideSafeZone === 'function' && window.isInsideSafeZone(window.player.x, window.player.y)) {
      this.state.campfireTicks = (this.state.campfireTicks || 0) + 1;
    }
  },

  injectHubButton() {
    const rightHud = document.querySelector('#game-wrapper .right-hud');
    if (!rightHud) return;
    if (document.getElementById('ether-20-hub-btn')) return;

    const btn = document.createElement('button');
    btn.id = 'ether-20-hub-btn';
    btn.type = 'button';
    btn.title = '대마법 시대 20종 세계관 몰입형 도감·연대기 열기 (밸런스 무영향)';
    btn.style.cssText = 'margin-top:2px; background:rgba(15, 23, 42, 0.90); border:1px solid #38bdf8; border-radius:4px; padding:2px 6px; font-size:9px; font-weight:bold; color:#bae6fd; cursor:pointer; pointer-events:auto; box-shadow:0 2px 5px rgba(0,0,0,0.75); white-space:nowrap;';
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

  selectTitle(titleStr) {
    if (!this.state.unlockedTitles.includes(titleStr)) return;
    this.state.activeTitle = titleStr;
    this.saveToLocal();
    window.addChat?.(`🎖️ [칭호 장착] 대표 명예 칭호가 '[${titleStr}]'(으)로 변경되었습니다.`, 'log-sys');
    this.renderModal();
  },

  cycleWeaponElement() {
    const elems = ['성광(HOLY)', '홍련(FIRE)', '빙결(FROST)', '질풍(WIND)', '성운(ASTRAL)'];
    const idx = elems.indexOf(this.state.etherWeaponElement);
    this.state.etherWeaponElement = elems[(idx + 1) % elems.length];
    this.saveToLocal();
    window.addChat?.(`✨ [에테르 공명 연출] 무기 시각 공명 색채가 '${this.state.etherWeaponElement}'(으)로 전환되었습니다. (전투 밸런스 무영향)`, 'log-sys');
    this.renderModal();
  },

  listenBardSong() {
    const nextSong = BARD_STORIES[Math.floor(Math.random() * BARD_STORIES.length)];
    this.state.lastBardStory = nextSong;
    this.state.campfireTicks = (this.state.campfireTicks || 0) + 1;
    this.saveToLocal();
    window.addChat?.(`🔥 [모닥불 음유시인] ${nextSong}`, 'log-sys');
    this.renderModal();
  },

  talkWithMercenary() {
    const mClass = window.mercenary?.hired ? (window.mercenary.class || 'knight') : 'knight';
    const pool = MERC_DIALOGUES[mClass] || MERC_DIALOGUES.knight;
    const line = pool[Math.floor(Math.random() * pool.length)];
    this.state.lastMercLine = line;
    this.state.mercBondPoints = (this.state.mercBondPoints || 0) + 1;
    this.saveToLocal();
    window.addChat?.(`🤝 [용병 교감] ${line}`, 'log-sys');
    this.renderModal();
  },

  drawHoroscope() {
    const signs = [
      '🌟 [알드릭의 사자자리] 담대한 발걸음 끝에 고대의 전승이 모습을 드러냅니다.',
      '🌙 [실바나의 은빛활자리] 숲의 정령들이 당신의 여정에 평온한 숨결을 불어넣습니다.',
      '🔥 [토르딘의 모루자리] 강철 같은 의지가 어떤 시련 앞에서도 흔들리지 않습니다.',
      '💧 [엘론드의 물병자리] 맑은 호수처럼 고요한 집중력이 마나의 흐름을 밝힙니다.',
      '⚡ [윈드스톰의 매자리] 순풍을 탄 날개처럼 막힘없는 모험이 펼쳐집니다.',
      '🔮 [아르카나의 천칭자리] 지혜로운 판단이 파티와 동료를 승리로 이끕니다.'
    ];
    this.state.dailyHoroscope = signs[Math.floor(Math.random() * signs.length)];
    this.saveToLocal();
    window.addChat?.(`🔮 [12성좌 별자리 관측] ${this.state.dailyHoroscope}`, 'log-sys');
    this.renderModal();
  },

  saveWeaponInscription() {
    const inp = document.getElementById('imm-weapon-inscribe-input');
    if (!inp) return;
    const val = (inp.value || '').trim().slice(0, 18);
    if (!val) return;
    this.state.customWeaponInscription = val;
    this.saveToLocal();
    window.addChat?.(`🔨 [토르딘의 명판 각인] 무기 명판에 "${val}" 문구가 새겨졌습니다!`, 'log-sys');
    this.renderModal();
  },

  toggleModal() {
    let m = document.getElementById('immersive-20-modal');
    if (!m) {
      m = document.createElement('div');
      m.id = 'immersive-20-modal';
      m.className = 'modal-panel hidden';
      m.style.cssText = 'width:min(94vw, 370px); max-height:78dvh; z-index:9300; display:flex; flex-direction:column;';
      (document.getElementById('game-wrapper') || document.body).appendChild(m);
      if (typeof window.makeDraggable === 'function') {
        try { window.makeDraggable('immersive-20-modal'); } catch (e) {}
      }
    }
    m.classList.toggle('hidden');
    if (!m.classList.contains('hidden')) {
      this.loadFromLocal();
      this.renderModal();
      window.bringModalToFront?.(m);
      window.centerModalOnScreen?.(m);
    }
  },

  renderModal() {
    const m = document.getElementById('immersive-20-modal');
    if (!m) return;
    const s = this.state;
    const pct = Math.min(100, Math.round((s.visitedRegions.length / 15) * 100));
    const curReg = (GameDB.Regions || []).find(r => r.id === (window.currentRegionKey || 'R01')) || GameDB.Regions?.[0] || { id: 'R01', name: '알트리아', boss: '고블린 족장' };

    const tabBtnStyle = (k) => this.activeTab === k
      ? 'flex:1; padding:4px 3px; font-size:10px; font-weight:bold; background:#78350f; border:1px solid #facc15; color:#fde047; border-radius:4px; cursor:pointer;'
      : 'flex:1; padding:4px 3px; font-size:10px; font-weight:bold; background:#14171f; border:1px solid #374151; color:#9ca3af; border-radius:4px; cursor:pointer;';

    let bodyHtml = '';
    if (this.activeTab === 'overview') {
      bodyHtml = `
        <!-- [콘텐츠 2, 9, 15, 16, 20] 칭호 · 길드서훈 · 별자리 · 마나기류 · 콤보 -->
        <div style="background:#14171f; border:1px solid #3d3020; border-radius:6px; padding:6px;">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <span style="color:#fde047; font-weight:bold;">🎖️ [2] 수호 칭호: <span style="color:#4ade80;">[${s.activeTitle}]</span></span>
            <span style="font-size:9.5px; color:#38bdf8; font-weight:bold;">[16] 길드: ${s.guildRank}</span>
          </div>
          <div style="display:flex; gap:3px; flex-wrap:wrap; margin-top:4px;">
            ${s.unlockedTitles.map(t => `<button type="button" onclick="window.ImmersiveSystem.selectTitle('${t.replace(/'/g, "\\'")}')" style="padding:2px 5px; font-size:9px; border-radius:3px; cursor:pointer; border:1px solid ${s.activeTitle === t ? '#4ade80' : '#4b5563'}; background:${s.activeTitle === t ? '#052e16' : '#090b10'}; color:${s.activeTitle === t ? '#86efac' : '#cbd5e1'};">${t}</button>`).join('')}
          </div>
          <div style="font-size:10px; color:#cbd5e1; margin-top:5px; display:flex; justify-content:space-between; align-items:center; gap:4px;">
            <span>[15] ${s.dailyHoroscope}</span>
            <button type="button" class="shop-buy-btn" style="padding:2px 6px; font-size:9px;" onclick="window.ImmersiveSystem.drawHoroscope()">🔮운세관측</button>
          </div>
          <div style="font-size:10px; color:#93c5fd; margin-top:3px;">[9] 차원 마나기류: <b>${s.weatherMode}</b> · [20] 최고 콤보: <b>${s.combatMedals.maxCombo.toLocaleString()}</b> (총 처치 ${s.combatMedals.totalKills.toLocaleString()})</div>
        </div>

        <!-- [콘텐츠 11] 왕립 학회 생태 조사 과제 -->
        <div style="background:#14171f; border:1px solid #3d3020; border-radius:6px; padding:6px;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:3px;">
            <span style="color:#fde047; font-weight:bold;">🏛️ [11] 알트리아 왕립 학회 생태 조사 (명예 ${s.scholarPoints || 0} P)</span>
            <button type="button" class="shop-buy-btn" style="padding:1px 6px; font-size:8.5px;" onclick="window.ImmersiveSystem.rollDailyBounties(); window.ImmersiveSystem.renderModal();">🔄과제갱신</button>
          </div>
          ${s.bounties.map(b => `<div style="display:flex; justify-content:space-between; font-size:10.5px; padding:1.5px 0;"><span>• ${b.targetName} (${b.curCount}/${b.reqCount})</span><b style="color:${b.done ? '#4ade80' : '#93c5fd'};">${b.done ? '조사완료 ✔️' : `명예 +${b.honorReward || 25}P`}</b></div>`).join('')}
        </div>

        <!-- [콘텐츠 5, 10, 12, 18] 무기 명판 각인 · 원소 공명 · 숙련 인장 · 용병 유대 -->
        <div style="background:#14171f; border:1px solid #3d3020; border-radius:6px; padding:6px;">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <span style="color:#fde047; font-weight:bold;">⚔️ [18] 무기 명판: <span style="color:#f43f5e;">"${s.customWeaponInscription}"</span></span>
            <button type="button" class="shop-buy-btn" style="padding:2px 6px; font-size:9px; background:#1e3a8a; border-color:#60a5fa;" onclick="window.ImmersiveSystem.cycleWeaponElement()">[5] 공명: ${s.etherWeaponElement}</button>
          </div>
          <div style="display:flex; gap:4px; margin-top:4px;">
            <input id="imm-weapon-inscribe-input" type="text" maxlength="18" value="${s.customWeaponInscription}" placeholder="무기 명판 각인 문구 입력" style="flex:1; background:#090b10; border:1px solid #4b5563; border-radius:4px; color:#fff; font-size:10px; padding:3px 6px;" />
            <button type="button" class="shop-buy-btn" style="padding:3px 8px; font-size:9.5px;" onclick="window.ImmersiveSystem.saveWeaponInscription()">🔨각인</button>
          </div>
          <div style="font-size:10px; color:#93c5fd; margin-top:4px;">[12] 수련 인장 — 검: <b>${s.weaponMastery.sword.toLocaleString()}</b> · 활: <b>${s.weaponMastery.bow.toLocaleString()}</b> · 지팡이: <b>${s.weaponMastery.staff.toLocaleString()}</b></div>
          <div style="font-size:10px; color:#a7f3d0; margin-top:3px; display:flex; justify-content:space-between; align-items:center; gap:4px;">
            <span>[10] 용병 유대(${s.mercBondPoints.toLocaleString()}P): ${s.lastMercLine}</span>
            <button type="button" class="shop-buy-btn" style="padding:2px 6px; font-size:9px; background:#065f46; border-color:#34d399;" onclick="window.ImmersiveSystem.talkWithMercenary()">🤝교감</button>
          </div>
        </div>

        <!-- [콘텐츠 8, 17] 모닥불 음유시인 담화 & 현재 지역 보스 전승 브리핑 -->
        <div style="background:#14171f; border:1px solid #3d3020; border-radius:6px; padding:6px;">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <span style="color:#fde047; font-weight:bold;">🔥 [8] 야영지 모닥불 온기 (${s.campfireTicks || 0}회 휴식)</span>
            <button type="button" class="shop-buy-btn" style="padding:2px 6px; font-size:9px;" onclick="window.ImmersiveSystem.listenBardSong()">🎵음유시인의 노래</button>
          </div>
          <div style="font-size:10px; color:#fef08a; margin-top:3px;">${s.lastBardStory || BARD_STORIES[0]}</div>
          <div style="font-size:10px; color:#fca5a5; margin-top:4px; border-top:1px dashed #374151; padding-top:3px;">
            👑 [17] <b>${curReg.name}</b> 보스 전승 브리핑: 수호 보스 <b>[${curReg.boss || '군주'}]</b> — 장판 예고(1.5초) 시 외곽 회피 기동을 권장합니다.
          </div>
        </div>
      `;
    } else if (this.activeTab === 'bestiary') {
      const entries = Object.entries(s.bestiaryKills || {});
      bodyHtml = `
        <!-- [콘텐츠 1, 3, 4, 6] 몬스터 생태 도감 · 환영 정령 · 균열 변이체 · 보스 전당 -->
        <div style="background:#14171f; border:1px solid #3d3020; border-radius:6px; padding:6px;">
          <div style="color:#fde047; font-weight:bold;">📖 [1] 알트리아 몬스터 생태 도감 (기록된 개체: ${entries.length}종)</div>
          <div style="font-size:10px; color:#93c5fd; margin-top:2px;">
            • [3] 에테르 환영 정령 관측: <b>${s.goblinEncounters}회</b> · [4] 차원 균열 변이체 관측: <b>${s.riftEliteKills}회</b><br>
            • [6] 보스 토벌 전당 누적 기록: <b>${s.combatMedals.bossKills}회</b> (최대 단타 기록: <b>${(s.combatMedals.maxHitDamage || 0).toLocaleString()}</b>)
          </div>
        </div>
        <div style="background:#14171f; border:1px solid #3d3020; border-radius:6px; padding:6px; max-height:38dvh; overflow-y:auto; display:flex; flex-direction:column; gap:3px;">
          ${entries.length === 0
            ? `<div style="color:#9ca3af; font-size:10.5px; text-align:center; padding:12px;">아직 도감에 기록된 몬스터가 없습니다. 필드에서 사냥을 시작해보세요!</div>`
            : entries.map(([mName, cnt]) => `
              <div style="display:flex; justify-content:space-between; align-items:center; background:#0c0e14; padding:4px 7px; border-radius:4px; border:1px solid #2d3748; font-size:10.5px;">
                <span style="color:#e5e7eb; font-weight:bold;">👾 ${mName}</span>
                <span style="color:${cnt >= 30 ? '#4ade80' : '#fde047'}; font-size:9.5px;">토벌 ${cnt.toLocaleString()}회 ${cnt >= 30 ? '🎖️(칭호해금)' : `(칭호까지 ${30 - cnt}회)`}</span>
              </div>
            `).join('')}
        </div>
      `;
    } else {
      bodyHtml = `
        <!-- [콘텐츠 7, 13, 14, 19] 15차원 연대기 · 유물 박물관 · 아카샤 비화 · 대륙 답사율 -->
        <div style="background:#14171f; border:1px solid #3d3020; border-radius:6px; padding:6px;">
          <div style="color:#fde047; font-weight:bold;">🗺️ [19] 15차원 대륙 답사율: <span style="color:#4ade80;">${pct}%</span> (${s.visitedRegions.length}/15 지역)</div>
          <div style="font-size:10px; color:#cbd5e1; margin-top:3px;">[13] 고대 에테르 유물 박물관(${s.relics.length}점): <span style="color:#fde047;">${s.relics.join(', ')}</span></div>
        </div>
        <div style="background:#14171f; border:1px solid #3d3020; border-radius:6px; padding:6px;">
          <div style="color:#38bdf8; font-weight:bold; margin-bottom:3px;">🌌 [14] 차원 여행자 아카샤의 전설 비화</div>
          ${(s.akashaNotes || []).slice(-4).map(n => `<div style="font-size:10px; color:#e0f2fe; padding:1.5px 0;">• ${n}</div>`).join('')}
        </div>
        <div style="background:#14171f; border:1px solid #3d3020; border-radius:6px; padding:6px; max-height:32dvh; overflow-y:auto; display:flex; flex-direction:column; gap:4px;">
          <div style="color:#fde047; font-weight:bold;">📜 [7] 대마법 시대 에테르 연대기 (${s.loreFragments.length}/15장 해금)</div>
          ${Object.entries(LORE_CHAPTERS).map(([rId, ch]) => {
            const unlocked = s.loreFragments.includes(rId) || s.visitedRegions.includes(rId);
            return `
              <div style="background:#0c0e14; border:1px solid ${unlocked ? '#ca8a04' : '#2d3748'}; border-radius:4px; padding:4px 6px; opacity:${unlocked ? '1' : '0.5'};">
                <div style="font-size:10.5px; font-weight:bold; color:${unlocked ? '#fde047' : '#9ca3af'};">${unlocked ? '🔓' : '🔒'} [${rId}] ${ch.title}</div>
                <div style="font-size:9.5px; color:#cbd5e1; margin-top:1px;">${unlocked ? ch.desc : '해당 지역에 진입하거나 보스를 토벌하면 연대기가 해금됩니다.'}</div>
              </div>
            `;
          }).join('')}
        </div>
      `;
    }

    m.innerHTML = `
      <div class="modal-header drag-handle">📘 대마법 시대: 세계관 몰입 콘텐츠 20선</div>
      <button class="close-x-btn" onclick="window.ImmersiveSystem.toggleModal()">✖</button>
      <div style="display:flex; gap:4px; padding:4px 5px 2px 5px;">
        <button type="button" style="${tabBtnStyle('overview')}" onclick="window.ImmersiveSystem.setTab('overview')">🌟 종합·교감(10)</button>
        <button type="button" style="${tabBtnStyle('bestiary')}" onclick="window.ImmersiveSystem.setTab('bestiary')">👾 생태·전당(5)</button>
        <button type="button" style="${tabBtnStyle('lore')}" onclick="window.ImmersiveSystem.setTab('lore')">📜 연대기·유물(5)</button>
      </div>
      <div style="display:flex; flex-direction:column; gap:5px; padding:5px; overflow-y:auto; max-height:calc(78dvh - 76px); font-size:11px; color:#e5e7eb;">
        ${bodyHtml}
      </div>
    `;
  }
};

window.ImmersiveSystem = ImmersiveSystem;
if (document.readyState === 'loading') {
  window.addEventListener('DOMContentLoaded', () => ImmersiveSystem.init());
} else {
  ImmersiveSystem.init();
}
