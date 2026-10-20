// public/js/game_08_immersive_contents.js
// 🌟 대마법 시대 (Age of High Magic) — 세계관 일관성 유지 · 1차(1~10) & 2차(11~20) 몰입형 콘텐츠 20종 통합 모듈
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
  '🎵 [보스 공략 담화] "지역 보스(B)가 붉은 마법진을 그리면 1.5초 뒤 강력한 광역기가 떨어진다네! 측면으로 회피하게!"',
  '🎵 [보스 공략 담화] "전사의 아이언 월과 배틀 크라이는 보스의 강타 피해를 크게 줄여주는 최고의 방패라오."',
  '🎵 [보스 공략 담화] "파티장이 [점사모드]를 켜면 용병과 파티원이 일제히 보스를 집중 타격해 순식간에 제압한다네!"',
  '🎵 [보스 공략 담화] "중반 지역 보스부터는 무기를 +6까지, 방어구를 +4까지 안전 강화해야 물약을 아낄 수 있다오."',
  '🎵 [보스 공략 담화] "모닥불 온기 속에서 숨을 고르고, 용병에게 [⚡아이템보급]을 해주는 것을 잊지 말게나!"'
];

const MERC_TACTICAL_LINES = {
  knight: {
    combat: '🛡️ "주군의 타겟을 함께 베겠습니다! 선봉은 제게 맡기십시오!"',
    evade: '🛡️ "적의 포위를 피해 전열을 재정비한 뒤 다시 돌격합니다!"',
    boss: '🛡️ "강대한 보스입니다! 제가 시선을 끌 테니 주군께서는 화력을 집중하십시오!"'
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

const ZODIAC_12_SIGNS = [
  '🦁 [1성좌: 알드릭의 사자자리] 담대한 돌파력이 빛을 발하며 전장에서 승전보가 울려 퍼집니다.',
  '🦢 [2성좌: 실바나의 백조자리] 은빛 날개의 가호 아래 치유와 평온한 마나 순환이 함께합니다.',
  '🔨 [3성좌: 토르딘의 모루자리] 강철 같은 방어 의지가 어떤 보스의 일격에도 흔들리지 않습니다.',
  '🏺 [4성좌: 엘론드의 물병자리] 맑은 호수의 기운이 깃들어 마법과 스킬의 흐름이 유연해집니다.',
  '🦅 [5성좌: 윈드스톰의 폭풍매자리] 순풍을 탄 화살처럼 빠르고 정확한 기동이 돋보이는 날입니다.',
  '⚖️ [6성좌: 아르카나의 천칭자리] 완벽한 전술 균형으로 파티원과 용병의 호흡이 극대화됩니다.',
  '🦂 [7성좌: 모라안의 황금전갈자리] 사막의 신기루처럼 날카로운 치명타의 기운이 감돕니다.',
  '🦌 [8성좌: 다크우드의 은빛 수사슴자리] 어둠 속에서도 길을 잃지 않는 혜안이 보물을 인도합니다.',
  '🐉 [9성좌: 드래곤피크의 화룡자리] 타오르는 투지가 한계를 넘어 연승 콤보를 달성하게 합니다.',
  '⚓ [10성좌: 발레노스의 닻자리] 거친 파도 속에서도 흔들림 없는 생존력을 발휘합니다.',
  '❄️ [11성좌: 프로스트홀드의 빙관자리] 차가운 이성과 집중력으로 정예 챔피언을 제압합니다.',
  '⏳ [12성좌: 이터니티의 모래시계자리] 차원의 시간을 지배하며 전설적인 발자취를 남깁니다.'
];

export const ImmersiveSystem = {
  activeTab: 'part1',
  state: {
    // === 1차 몰입형 콘텐츠 (1 ~ 10) ===
    bestiaryKills: {},                                // 1. 몬스터 생태 도감 (15개 지역 몬스터 처치 누적)
    activeTitle: '알트리아 수호자',                   // 2. 지역 수호 칭호 시스템
    unlockedTitles: ['알트리아 수호자'],
    goblinEncounters: 0,                              // 3. 에테르 보물 고블린 (돌발 출현 & 골드 주머니)
    goblinBonusGoldTotal: 0,
    riftEliteKills: 0,                                // 4. 균열 엘리트 챔피언 (거대/오라 정예 토벌 기록)
    etherWeaponElement: '화염(FIRE)',                 // 5. 무기 5대 원소 공명 (화염·빙결·뇌전·성광·심연)
    lastBossContributionRank: 1,                      // 6. 보스 기여도 전광판 & 파티 주사위
    lastPartyDiceRoll: 92,
    loreFragments: ['R01'],                           // 7. 에테르 연대기 (15장)
    campfireTicks: 0,                                 // 8. 모닥불 온기 & 음유시인 담화
    lastBardStory: BARD_BOSS_HINTS[0],
    weatherMode: '마나 유성우 밤',                    // 9. 차원 마나 기류 (실시간 날씨 - 서버 시간 동기화)
    mercBondPoints: 0,                                // 10. 용병 유대감 & 전술 대사
    lastMercLine: MERC_TACTICAL_LINES.knight.combat,

    // === 2차 몰입형 콘텐츠 (11 ~ 20) ===
    bounties: [],                                     // 11. 왕립 일일 현상수배 게시판 (3건·물약/골드 보급)
    weaponMastery: { sword: 0, bow: 0, staff: 0 },    // 12. 무기 숙련도 & 전장의 훈장
    combatMedals: { totalKills: 0, bossKills: 0, maxHitDamage: 0, maxCombo: 0 },
    relics: ['[알트리아] 알드릭의 부러진 검초'],       // 13. 고대 에테르 성물함 (15개 지역 상징 성물)
    akashaEncounters: 1,                              // 14. 차원 방랑 상인 아카샤 (엘리트 처치 시 출현·현장 물약 보급)
    akashaSupplyAvailable: true,
    dailyHoroscope: ZODIAC_12_SIGNS[0],               // 15. 에테르 12성좌 오늘의 운세
    guildRank: 'C (견습 수호자)',                     // 16. 모험가 길드 명예 등급 (C ~ SSS)
    lastBriefedBoss: '',                              // 17. 보스 토벌전 전술 브리핑
    customWeaponInscription: '칼라드루의 불꽃검',      // 18. 대장장이 토르딘의 명장 각인
    visitedRegions: ['R01'],                          // 19. 15차원 탐사 발자취 지도 (%)
    currentCombo: 0,                                  // 20. 연속 사냥 콤보 & 각성 피버 (12초 이내, 25콤보 오라)
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

  // [11] 왕립 일일 현상수배 게시판 3건 생성
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
      claimed: false,
      rewardGold: (idx + 1) * 300,
      rewardPotionQty: (idx + 1) * 5
    }));
    this.saveToLocal();
  },

  claimBountyReward(bountyIdx) {
    const b = this.state.bounties?.[bountyIdx];
    if (!b || !b.done || b.claimed) return;
    b.claimed = true;
    if (window.player) {
      window.player.gold = (Number(window.player.gold) || 0) + (b.rewardGold || 300);
      if (typeof window.giveItem === 'function') {
        window.giveItem('C_P01', b.rewardPotionQty || 5);
      }
      window.updateStatusHUD?.();
    }
    this.saveToLocal();
    window.addChat?.(`📋 [왕립 일일 현상수배 보급] '${b.targetName}' 토벌 보상으로 💰${(b.rewardGold || 300).toLocaleString()} G와 체력 물약 x${b.rewardPotionQty || 5}개를 보급받았습니다!`, 'log-kill');
    this.renderModal();
  },

  // [5] 무기 5대 원소 공명 시각 이펙트
  triggerWeaponResonanceFx(x, y) {
    if (!window.activeEffects || !x || !y) return;
    const elem = this.state.etherWeaponElement || '화염(FIRE)';
    let color = 0xf97316;
    if (elem.includes('빙결')) color = 0x38bdf8;
    else if (elem.includes('뇌전')) color = 0xfacc15;
    else if (elem.includes('성광')) color = 0xfef08a;
    else if (elem.includes('심연')) color = 0xa855f7;
    if (window.activeEffects.length < 48) {
      window.activeEffects.push({ type: 'hit_spark', x, y, color, life: 12, maxLife: 12 });
    }
  },

  // [17] 보스 토벌전 전술 브리핑 배너
  onBossEngage(bossMob) {
    if (!bossMob || !bossMob.isBoss) return;
    const bName = (bossMob.rawName || bossMob.name || '지역 보스').replace(/^\[.*?\]\s*/, '').trim();
    if (this.state.lastBriefedBoss === bName) return;
    this.state.lastBriefedBoss = bName;
    window.addChat?.(`🚨 [17. 보스 토벌전 전술 브리핑] 수호 보스 '${bName}' 교전 돌입! 붉은 광역 예고 장판(1.5초) 시 측면 회피 및 파티 점사를 유지하세요!`, 'log-hit');
    if (window.mercenary?.hired && !window.mercenary.isDead) {
      const mCls = window.mercenary.class || 'knight';
      const line = MERC_TACTICAL_LINES[mCls]?.boss || MERC_TACTICAL_LINES.knight.boss;
      this.state.lastMercLine = line;
      window.mercenary.chatBubble = { text: line.replace(/^.*?"|".*$/g, ''), expiresAt: Date.now() + 4000 };
    }
  },

  // [6] 보스 기여도 전광판 & 파티 주사위 배너
  showBossBannerAndDice(bossName, diceVal) {
    const pName = window.player?.name || '모험가';
    window.addChat?.(`🏆 [6. 보스 기여도 전광판] '${bossName}' 토벌 완료! 기여도 1위: [${pName}] · 🎲 파티 전리품 주사위 결과: [${diceVal}점]!`, 'log-kill');
  },

  onMonsterKilled(mob, hitDmg = 0) {
    if (!mob) return;
    const now = typeof window.getSyncedServerTime === 'function' ? window.getSyncedServerTime() : Date.now();
    const rawName = (mob.rawName || mob.name || '').replace(/^\[.*?\]\s*/, '').trim();
    if (!rawName) return;

    // [5] 무기 5대 원소 공명 이펙트
    if (mob.x && mob.y) this.triggerWeaponResonanceFx(mob.x, mob.y);

    // [20] 연속 사냥 콤보 & 각성 피버 (12초 이내 연속 처치, 25콤보 단위 에테르 각성 오라 연출)
    this.state.currentCombo = (now - this.state.lastKillTs <= 12000) ? (this.state.currentCombo + 1) : 1;
    this.state.lastKillTs = now;
    if (this.state.currentCombo > this.state.combatMedals.maxCombo) {
      this.state.combatMedals.maxCombo = this.state.currentCombo;
    }
    if (this.state.currentCombo > 0 && this.state.currentCombo % 25 === 0) {
      if (window.activeEffects && window.player) {
        window.activeEffects.push({ type: 'buff', x: window.player.x, y: window.player.y, life: 32, maxLife: 32 });
      }
      window.addChat?.(`🔥 [20. 연속 사냥 ${this.state.currentCombo} COMBO 각성 피버!] 에테르 각성 오라가 피어오릅니다!`, 'log-kill');
    }

    // [1] 몬스터 생태 도감 & [12] 무기 숙련도 & 전장의 훈장
    this.state.bestiaryKills[rawName] = (this.state.bestiaryKills[rawName] || 0) + 1;
    this.state.combatMedals.totalKills++;
    if (hitDmg > this.state.combatMedals.maxHitDamage) {
      this.state.combatMedals.maxHitDamage = Math.round(hitDmg);
    }

    const cls = window.player?.class || 'knight';
    if (cls === 'knight') this.state.weaponMastery.sword++;
    else if (cls === 'ranger') this.state.weaponMastery.bow++;
    else this.state.weaponMastery.staff++;

    // [10] 용병 유대감 & 전술 대사
    if (window.mercenary?.hired && !window.mercenary?.isDead) {
      this.state.mercBondPoints++;
      if (this.state.mercBondPoints % 20 === 0) {
        const mCls = window.mercenary.class || 'knight';
        const line = MERC_TACTICAL_LINES[mCls]?.combat || MERC_TACTICAL_LINES.knight.combat;
        this.state.lastMercLine = line;
        window.mercenary.chatBubble = { text: line.replace(/^.*?"|".*$/g, ''), expiresAt: Date.now() + 3500 };
      }
    }

    // [2] 지역 수호 칭호 시스템 (몬스터 30마리 토벌 시 세계관 칭호 해금)
    const rk = window.currentRegionKey || 'R01';
    const regLore = LORE_CHAPTERS[rk] || LORE_CHAPTERS.R01;
    if (this.state.bestiaryKills[rawName] === 30) {
      const guardianTitle = regLore.guardianTitle || `${rawName} 수호자`;
      if (!this.state.unlockedTitles.includes(guardianTitle)) {
        this.state.unlockedTitles.push(guardianTitle);
        this.state.activeTitle = guardianTitle;
        window.addChat?.(`🎖️ [2. 지역 수호 칭호 해금] 30마리 토벌 업적 달성으로 '[${guardianTitle}]' 칭호를 획득했습니다!`, 'log-kill');
      }
    }

    // [3] 에테르 보물 고블린 (돌발 출현 & 추가 골드 주머니 드롭)
    if (!mob.isBoss && Math.random() < 0.025) {
      this.state.goblinEncounters++;
      const bonusGold = Math.max(50, (window.player?.level || 1) * 15);
      this.state.goblinBonusGoldTotal = (this.state.goblinBonusGoldTotal || 0) + bonusGold;
      if (window.player) {
        window.player.gold = (Number(window.player.gold) || 0) + bonusGold;
        window.updateStatusHUD?.();
      }
      window.addChat?.(`💰 [3. 에테르 보물 고블린 출현!] 차원 틈새에서 나타난 보물 고블린이 골드 주머니(+${bonusGold.toLocaleString()} G)를 드롭했습니다!`, 'log-kill');
    }
    // [4] 균열 엘리트 챔피언 & [14] 차원 방랑 상인 아카샤 출현
    else if (!mob.isBoss && (mob.isElite || Math.random() < 0.022)) {
      this.state.riftEliteKills++;
      this.state.akashaEncounters = (this.state.akashaEncounters || 0) + 1;
      this.state.akashaSupplyAvailable = true;
      window.addChat?.(`⚡ [4. 균열 엘리트 챔피언 토벌 & 14. 방랑상인 아카샤 출현] 정예 챔피언을 처치하여 아카샤의 현장 물약 보급이 활성화되었습니다!`, 'log-sys');
    }

    // [6, 7, 13] 보스 토벌 시 기여도 전광판 & 파티 주사위, 에테르 연대기(15장), 고대 에테르 성물함 해금
    if (mob.isBoss) {
      this.state.combatMedals.bossKills++;
      this.state.lastBossContributionRank = 1;
      this.state.lastPartyDiceRoll = Math.floor(50 + Math.random() * 51);
      this.showBossBannerAndDice(rawName, this.state.lastPartyDiceRoll);

      if (!this.state.loreFragments.includes(rk)) this.state.loreFragments.push(rk);
      const relic = regLore.relic || `[${rk}] ${rawName}의 성물`;
      if (!this.state.relics.includes(relic)) this.state.relics.push(relic);
      const bossTitle = `${rawName} 정복자`;
      if (!this.state.unlockedTitles.includes(bossTitle)) this.state.unlockedTitles.push(bossTitle);
      window.addChat?.(`🏛️ [7. 에테르 연대기 & 13. 고대 에테르 성물함 해금] '${relic}'이(가) 성물함에 진열되었습니다!`, 'log-kill');
    }

    // [11] 왕립 일일 현상수배 진행
    this.state.bounties.forEach(b => {
      if (!b.done && rawName.includes(b.targetName)) {
        b.curCount = Math.min(b.reqCount, b.curCount + 1);
        if (b.curCount >= b.reqCount) {
          b.done = true;
          window.addChat?.(`📋 [11. 왕립 일일 현상수배 달성] '${b.targetName}' 토벌 완료! 에테르 도감에서 보급품(물약·골드)을 수령하세요!`, 'log-kill');
        }
      }
    });

    // [16] 모험가 길드 명예 등급 (C ~ SSS)
    const sc = this.state.combatMedals.totalKills + this.state.combatMedals.bossKills * 50 + (this.state.loreFragments.length * 30);
    this.state.guildRank = sc >= 2500
      ? 'SSS (에테르 그랜드마스터)'
      : (sc >= 1000 ? 'SS (차원 집행관)' : (sc >= 400 ? 'S (미스릴 가디언)' : (sc >= 150 ? 'A (왕립 정예기사)' : (sc >= 50 ? 'B (숙련 수호자)' : 'C (견습 수호자)'))));

    this.saveToLocal();
  },

  // [9] 차원 마나 기류 (서버 동기화 시간 기반으로 모든 플레이어가 동일한 기류 공유!) & [8] 모닥불 온기 & [19] 15차원 탐사 지도
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
      '은빛 물안개',
      '붉은 노을 기류',
      '에테르 미풍 (맑음)',
      '아르카나 오로라 파동'
    ];
    // 모든 유저가 동일한 서버 시간대(3분 주기)를 기준으로 100% 같은 날씨/기류를 공유!
    const sharedNow = typeof window.getSyncedServerTime === 'function' ? window.getSyncedServerTime() : Date.now();
    const regNum = parseInt(String(rk).replace(/\D/g, ''), 10) || 1;
    const weatherIdx = (Math.floor(sharedNow / 180000) + regNum) % wList.length;
    this.state.weatherMode = wList[weatherIdx];

    if (typeof window.isInsideSafeZone === 'function' && window.isInsideSafeZone(window.player.x, window.player.y)) {
      this.state.campfireTicks = (this.state.campfireTicks || 0) + 1;
    }
  },

  // [14] 차원 방랑 상인 아카샤 현장 물약 보급 지원
  useAkashaFieldSupply() {
    if (!window.player) return;
    if (!this.state.akashaSupplyAvailable) {
      window.addChat?.(`ℹ️ [14. 방랑 상인 아카샤] 필드에서 정예 몬스터를 처치하면 아카샤의 현장 물약 보급이 다시 충전됩니다.`, 'log-sys');
      return;
    }
    this.state.akashaSupplyAvailable = false;
    if (typeof window.giveItem === 'function') {
      window.giveItem('C_P01', 10);
      window.giveItem('C_P02', 5);
    }
    this.saveToLocal();
    window.addChat?.(`🌌 [14. 차원 방랑 상인 아카샤] "차원 틈새에서 당신을 지켜보고 있었어요." 현장 보급품(체력 물약 x10, 마나 물약 x5)을 전달받았습니다!`, 'log-kill');
    this.renderModal();
  },

  injectHubButton() {
    const rightHud = document.querySelector('#game-wrapper .right-hud');
    if (!rightHud) return;
    if (document.getElementById('ether-20-hub-btn')) return;

    const btn = document.createElement('button');
    btn.id = 'ether-20-hub-btn';
    btn.type = 'button';
    btn.title = '대마법 시대 20종 몰입형 에테르 도감 열기';
    btn.style.cssText = 'margin-top:2px; background:rgba(15, 23, 42, 0.92); border:1px solid #38bdf8; border-radius:4px; padding:2px 6px; font-size:9.5px; font-weight:bold; color:#bae6fd; cursor:pointer; pointer-events:auto; box-shadow:0 2px 5px rgba(0,0,0,0.75); white-space:nowrap;';
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
    window.addChat?.(`🎖️ [2. 지역 수호 칭호 장착] 대표 칭호가 '[${titleStr}]'(으)로 변경되었습니다.`, 'log-sys');
    this.renderModal();
  },

  cycleWeaponElement() {
    const elems = ['화염(FIRE)', '빙결(FROST)', '뇌전(THUNDER)', '성광(HOLY)', '심연(ABYSS)'];
    const idx = elems.indexOf(this.state.etherWeaponElement);
    this.state.etherWeaponElement = elems[(idx + 1) % elems.length];
    this.saveToLocal();
    window.addChat?.(`✨ [5. 무기 5대 원소 공명] 무기 타격 원소 이펙트가 '${this.state.etherWeaponElement}'(으)로 공명되었습니다!`, 'log-sys');
    this.renderModal();
  },

  listenBardSong() {
    const nextSong = BARD_BOSS_HINTS[Math.floor(Math.random() * BARD_BOSS_HINTS.length)];
    this.state.lastBardStory = nextSong;
    this.state.campfireTicks = (this.state.campfireTicks || 0) + 1;
    this.saveToLocal();
    window.addChat?.(`🔥 [8. 모닥불 온기 & 음유시인 담화] ${nextSong}`, 'log-sys');
    this.renderModal();
  },

  talkWithMercenary() {
    const mClass = window.mercenary?.hired ? (window.mercenary.class || 'knight') : 'knight';
    const pack = MERC_TACTICAL_LINES[mClass] || MERC_TACTICAL_LINES.knight;
    const pool = [pack.combat, pack.evade, pack.boss];
    const line = pool[Math.floor(Math.random() * pool.length)];
    this.state.lastMercLine = line;
    this.state.mercBondPoints = (this.state.mercBondPoints || 0) + 1;
    if (window.mercenary?.hired && !window.mercenary.isDead) {
      window.mercenary.chatBubble = { text: line.replace(/^.*?"|".*$/g, ''), expiresAt: Date.now() + 3800 };
    }
    this.saveToLocal();
    window.addChat?.(`🤝 [10. 용병 유대감 & 전술 대사] ${line}`, 'log-sys');
    this.renderModal();
  },

  drawHoroscope() {
    this.state.dailyHoroscope = ZODIAC_12_SIGNS[Math.floor(Math.random() * ZODIAC_12_SIGNS.length)];
    this.saveToLocal();
    window.addChat?.(`🔮 [15. 에테르 12성좌 오늘의 운세] ${this.state.dailyHoroscope}`, 'log-sys');
    this.renderModal();
  },

  saveWeaponInscription() {
    const inp = document.getElementById('imm-weapon-inscribe-input');
    if (!inp) return;
    const val = (inp.value || '').trim().slice(0, 18);
    if (!val) return;
    this.state.customWeaponInscription = val;
    this.saveToLocal();
    window.addChat?.(`🔨 [18. 대장장이 토르딘의 명장 각인] 주력 무기에 "${val}" 전설 각인이 새겨졌습니다!`, 'log-sys');
    this.renderModal();
  },

  toggleModal() {
    let m = document.getElementById('immersive-20-modal');
    if (!m) {
      m = document.createElement('div');
      m.id = 'immersive-20-modal';
      m.className = 'modal-panel hidden';
      // 창 크기는 그대로 유지하되 내부 패딩/여백을 최소화하고 글씨 크기를 키움!
      m.style.cssText = 'width:min(94vw, 370px); max-height:78dvh; z-index:9300; display:flex; flex-direction:column; padding:4px !important;';
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
    const pct = Math.min(100, Math.round((s.visitedRegions.length / 15) * 100));
    const curReg = (GameDB.Regions || []).find(r => r.id === (window.currentRegionKey || 'R01')) || GameDB.Regions?.[0] || { id: 'R01', name: '알트리아', boss: '고블린 족장' };

    const tabBtnStyle = (k) => this.activeTab === k
      ? 'flex:1; padding:4px 2px; font-size:11.5px; font-weight:bold; background:#78350f; border:1px solid #facc15; color:#fde047; border-radius:4px; cursor:pointer;'
      : 'flex:1; padding:4px 2px; font-size:11.5px; font-weight:bold; background:#14171f; border:1px solid #374151; color:#cbd5e1; border-radius:4px; cursor:pointer;';

    let bodyHtml = '';
    if (this.activeTab === 'part1') {
      const entries = Object.entries(s.bestiaryKills || {});
      bodyHtml = `
        <!-- [1] 몬스터 생태 도감 & [2] 지역 수호 칭호 시스템 -->
        <div style="background:#14171f; border:1px solid #3d3020; border-radius:5px; padding:5px 6px;">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <span style="color:#fde047; font-weight:bold; font-size:12.5px;">🎖️ [2] 지역 수호 칭호: <span style="color:#4ade80;">[${s.activeTitle}]</span></span>
            <span style="font-size:11px; color:#93c5fd;">[1] 도감 ${entries.length}종</span>
          </div>
          <div style="display:flex; gap:3px; flex-wrap:wrap; margin-top:3px;">
            ${s.unlockedTitles.map(t => `<button type="button" onclick="window.ImmersiveSystem.selectTitle('${t.replace(/'/g, "\\'")}')" style="padding:2px 6px; font-size:11px; border-radius:3px; cursor:pointer; border:1px solid ${s.activeTitle === t ? '#4ade80' : '#4b5563'}; background:${s.activeTitle === t ? '#052e16' : '#090b10'}; color:${s.activeTitle === t ? '#86efac' : '#e5e7eb'};">${t}</button>`).join('')}
          </div>
        </div>

        <!-- [3] 에테르 보물 고블린 & [4] 균열 엘리트 챔피언 & [6] 보스 기여도 전광판 & 파티 주사위 -->
        <div style="background:#14171f; border:1px solid #3d3020; border-radius:5px; padding:5px 6px; font-size:12px; line-height:1.45;">
          <div>💰 <b>[3] 에테르 보물 고블린</b>: 출현 <b>${s.goblinEncounters}회</b> (보너스 +${(s.goblinBonusGoldTotal || 0).toLocaleString()}G)</div>
          <div>⚡ <b>[4] 균열 엘리트 챔피언</b>: 정예 토벌 <b>${s.riftEliteKills}회</b></div>
          <div>🏆 <b>[6] 보스 전광판 & 주사위</b>: 기여도 <b>${s.lastBossContributionRank}위</b> · 최근 주사위 <b>🎲${s.lastPartyDiceRoll || 92}점</b></div>
        </div>

        <!-- [5] 무기 5대 원소 공명 & [9] 차원 마나 기류 & [10] 용병 유대감 & 전술 대사 -->
        <div style="background:#14171f; border:1px solid #3d3020; border-radius:5px; padding:5px 6px; font-size:12px; line-height:1.45;">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <span>✨ <b>[5] 무기 5대 원소 공명</b></span>
            <button type="button" class="shop-buy-btn" style="padding:2px 7px; font-size:11px; background:#1e3a8a; border-color:#60a5fa;" onclick="window.ImmersiveSystem.cycleWeaponElement()">${s.etherWeaponElement} 전환</button>
          </div>
          <div style="color:#93c5fd; margin-top:2px;">🌦️ <b>[9] 차원 마나 기류(실시간 동기화)</b>: <b style="color:#fde047;">${s.weatherMode}</b></div>
          <div style="color:#a7f3d0; margin-top:3px; display:flex; justify-content:space-between; align-items:center; gap:4px;">
            <span style="flex:1;">🤝 <b>[10] 용병 유대(${s.mercBondPoints.toLocaleString()}P)</b>: ${s.lastMercLine}</span>
            <button type="button" class="shop-buy-btn" style="padding:2px 7px; font-size:11px; background:#065f46; border-color:#34d399; flex-shrink:0;" onclick="window.ImmersiveSystem.talkWithMercenary()">전술교감</button>
          </div>
        </div>

        <!-- [8] 모닥불 온기 & 음유시인 담화 -->
        <div style="background:#14171f; border:1px solid #3d3020; border-radius:5px; padding:5px 6px; font-size:12px; line-height:1.45;">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <span style="color:#fde047; font-weight:bold;">🔥 [8] 모닥불 온기 (${s.campfireTicks || 0}회) & 음유시인 담화</span>
            <button type="button" class="shop-buy-btn" style="padding:2px 7px; font-size:11px;" onclick="window.ImmersiveSystem.listenBardSong()">🎵공략담화</button>
          </div>
          <div style="color:#fef08a; margin-top:2px; font-size:11.5px;">${s.lastBardStory || BARD_BOSS_HINTS[0]}</div>
        </div>
      `;
    } else if (this.activeTab === 'part2') {
      bodyHtml = `
        <!-- [11] 왕립 일일 현상수배 게시판 -->
        <div style="background:#14171f; border:1px solid #3d3020; border-radius:5px; padding:5px 6px; font-size:12px;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:3px;">
            <span style="color:#fde047; font-weight:bold; font-size:12.5px;">📋 [11] 왕립 일일 현상수배 게시판</span>
            <button type="button" class="shop-buy-btn" style="padding:2px 6px; font-size:10.5px;" onclick="window.ImmersiveSystem.rollDailyBounties(); window.ImmersiveSystem.renderModal();">🔄임무갱신</button>
          </div>
          ${s.bounties.map((b, idx) => `
            <div style="display:flex; justify-content:space-between; align-items:center; padding:2px 0; font-size:11.5px;">
              <span>• ${b.targetName} (${b.curCount}/${b.reqCount})</span>
              ${b.claimed
                ? `<b style="color:#4ade80;">보급완료 ✔️</b>`
                : (b.done
                  ? `<button type="button" class="shop-buy-btn" style="padding:1px 6px; font-size:10.5px; background:#16a34a; border-color:#4ade80;" onclick="window.ImmersiveSystem.claimBountyReward(${idx})">🎁물약·골드수령</button>`
                  : `<span style="color:#93c5fd;">💰${b.rewardGold || 300}G+물약${b.rewardPotionQty || 5}</span>`)}
            </div>
          `).join('')}
        </div>

        <!-- [12] 무기 숙련도 & 전장의 훈장 & [20] 연속 사냥 콤보 & 각성 피버 -->
        <div style="background:#14171f; border:1px solid #3d3020; border-radius:5px; padding:5px 6px; font-size:12px; line-height:1.45;">
          <div style="color:#fde047; font-weight:bold;">⚔️ [12] 무기 숙련도 & 전장의 훈장</div>
          <div>• 검: <b>${s.weaponMastery.sword.toLocaleString()}</b> · 활: <b>${s.weaponMastery.bow.toLocaleString()}</b> · 지팡이: <b>${s.weaponMastery.staff.toLocaleString()}</b></div>
          <div>• 최고 타격: <b style="color:#f87171;">${(s.combatMedals.maxHitDamage || 0).toLocaleString()}</b> · 총 토벌: <b>${s.combatMedals.totalKills.toLocaleString()}</b> (보스 ${s.combatMedals.bossKills})</div>
          <div style="color:#fbbf24;">🔥 <b>[20] 연속 사냥 콤보 피버</b>: 현재 <b>${s.currentCombo}</b> / 최고 <b>${s.combatMedals.maxCombo} COMBO</b></div>
        </div>

        <!-- [14] 차원 방랑 상인 아카샤 & [15] 에테르 12성좌 운세 & [16] 모험가 길드 명예 등급 -->
        <div style="background:#14171f; border:1px solid #3d3020; border-radius:5px; padding:5px 6px; font-size:12px; line-height:1.45;">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <span>🌌 <b>[14] 방랑상인 아카샤</b> (조우 ${s.akashaEncounters || 1}회)</span>
            <button type="button" class="shop-buy-btn" style="padding:2px 7px; font-size:11px; background:${s.akashaSupplyAvailable ? '#065f46' : '#374151'}; border-color:${s.akashaSupplyAvailable ? '#34d399' : '#6b7280'};" onclick="window.ImmersiveSystem.useAkashaFieldSupply()">${s.akashaSupplyAvailable ? '🧪현장물약보급' : '보급대기'}</button>
          </div>
          <div style="margin-top:3px;">🏅 <b>[16] 길드 명예 등급</b>: <b style="color:#38bdf8;">${s.guildRank}</b></div>
          <div style="margin-top:3px; display:flex; justify-content:space-between; align-items:center; gap:4px;">
            <span style="flex:1; font-size:11.5px;">${s.dailyHoroscope}</span>
            <button type="button" class="shop-buy-btn" style="padding:2px 6px; font-size:10.5px; flex-shrink:0;" onclick="window.ImmersiveSystem.drawHoroscope()">🔮[15]점괘</button>
          </div>
        </div>

        <!-- [17] 보스 토벌전 전술 브리핑 & [18] 대장장이 토르딘의 명장 각인 -->
        <div style="background:#14171f; border:1px solid #3d3020; border-radius:5px; padding:5px 6px; font-size:12px; line-height:1.45;">
          <div>🔨 <b>[18] 토르딘의 명장 각인</b>: <b style="color:#f43f5e;">"${s.customWeaponInscription}"</b></div>
          <div style="display:flex; gap:4px; margin-top:3px;">
            <input id="imm-weapon-inscribe-input" type="text" maxlength="18" value="${s.customWeaponInscription}" placeholder="주력 무기 별칭·전설 문구" style="flex:1; background:#090b10; border:1px solid #4b5563; border-radius:4px; color:#fff; font-size:11.5px; padding:3px 6px;" />
            <button type="button" class="shop-buy-btn" style="padding:3px 8px; font-size:11px;" onclick="window.ImmersiveSystem.saveWeaponInscription()">각인</button>
          </div>
          <div style="color:#fca5a5; margin-top:3px; font-size:11.5px;">🚨 <b>[17] ${curReg.name} 보스 전술 브리핑</b>: 수호 보스 <b>[${curReg.boss || '군주'}]</b> — 광역 장판 예고 시 외곽 회피 및 점사 집중!</div>
        </div>
      `;
    } else {
      const entries = Object.entries(s.bestiaryKills || {});
      bodyHtml = `
        <!-- [19] 15차원 탐사 발자취 지도 & [13] 고대 에테르 성물함 -->
        <div style="background:#14171f; border:1px solid #3d3020; border-radius:5px; padding:5px 6px; font-size:12px; line-height:1.45;">
          <div style="color:#fde047; font-weight:bold; font-size:12.5px;">🗺️ [19] 15차원 탐사 발자취 지도: <span style="color:#4ade80;">${pct}%</span> (${s.visitedRegions.length}/15 지역)</div>
          <div style="color:#e5e7eb; margin-top:2px; font-size:11.5px;">🏺 <b>[13] 고대 에테르 성물함(${s.relics.length}/15)</b>: <span style="color:#fde047;">${s.relics.join(' · ')}</span></div>
        </div>

        <!-- [1] 몬스터 생태 도감 상세 목록 -->
        <div style="background:#14171f; border:1px solid #3d3020; border-radius:5px; padding:5px 6px; max-height:22dvh; overflow-y:auto; display:flex; flex-direction:column; gap:3px;">
          <div style="color:#fde047; font-weight:bold; font-size:12px;">📖 [1] 15개 지역 몬스터 생태 도감 (누적 토벌 기록)</div>
          ${entries.length === 0
            ? `<div style="color:#9ca3af; font-size:11.5px; text-align:center; padding:8px;">아직 처치 기록이 없습니다. 사냥을 시작해보세요!</div>`
            : entries.map(([mName, cnt]) => `
              <div style="display:flex; justify-content:space-between; align-items:center; background:#0c0e14; padding:3px 6px; border-radius:4px; border:1px solid #2d3748; font-size:11.5px;">
                <span style="color:#f3f4f6; font-weight:bold;">👾 ${mName}</span>
                <span style="color:${cnt >= 30 ? '#4ade80' : '#fde047'};">${cnt.toLocaleString()}회 ${cnt >= 30 ? '🎖️수호칭호' : `(칭호 ${30 - cnt}회)`}</span>
              </div>
            `).join('')}
        </div>

        <!-- [7] 에테르 연대기 (15장) -->
        <div style="background:#14171f; border:1px solid #3d3020; border-radius:5px; padding:5px 6px; max-height:26dvh; overflow-y:auto; display:flex; flex-direction:column; gap:3px;">
          <div style="color:#fde047; font-weight:bold; font-size:12px;">📜 [7] 에테르 연대기 15장 (${s.loreFragments.length}/15장 해금)</div>
          ${Object.entries(LORE_CHAPTERS).map(([rId, ch]) => {
            const unlocked = s.loreFragments.includes(rId) || s.visitedRegions.includes(rId);
            return `
              <div style="background:#0c0e14; border:1px solid ${unlocked ? '#ca8a04' : '#2d3748'}; border-radius:4px; padding:4px 6px; opacity:${unlocked ? '1' : '0.55'};">
                <div style="font-size:11.5px; font-weight:bold; color:${unlocked ? '#fde047' : '#9ca3af'};">${unlocked ? '🔓' : '🔒'} [${rId}] ${ch.title}</div>
                <div style="font-size:11px; color:#e5e7eb; margin-top:1px; line-height:1.38;">${unlocked ? ch.desc : '해당 지역 방문 또는 지역 보스 처치 시 해금됩니다.'}</div>
              </div>
            `;
          }).join('')}
        </div>
      `;
    }

    m.innerHTML = `
      <div class="modal-header drag-handle" style="padding:5px 8px; font-size:13px;">📘 에테르 도감 (몰입형 콘텐츠 20종) <button class="help-q-btn" onclick="showHelpModal('immersive', event)" title="에테르 도감 도움말">?</button></div>
      <button class="close-x-btn" onclick="window.ImmersiveSystem.toggleModal()">✖</button>
      <div style="display:flex; gap:3px; padding:3px 3px 2px 3px;">
        <button type="button" style="${tabBtnStyle('part1')}" onclick="window.ImmersiveSystem.setTab('part1')">🌟 1차 도감(1~10)</button>
        <button type="button" style="${tabBtnStyle('part2')}" onclick="window.ImmersiveSystem.setTab('part2')">⚔️ 2차 도감(11~20)</button>
        <button type="button" style="${tabBtnStyle('lore')}" onclick="window.ImmersiveSystem.setTab('lore')">📜 생태·연대기·성물</button>
      </div>
      <div style="display:flex; flex-direction:column; gap:4px; padding:3px; overflow-y:auto; max-height:calc(78dvh - 68px); font-size:12px; color:#f3f4f6;">
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
