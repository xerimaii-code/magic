// js/game_02_merc_party.js — 용병(Mercenary) 동반 시스템 · 파티(Party) 시스템 · HUD
// ============================================================================
// 🛡️ 용병(Mercenary) 1인 동반 시스템 (스프라이트 없이 코드 렌더링 + 스마트 AI + 전용 인벤토리/장비)
// ============================================================================
const MERC_CLASS_META = GameDB.Mercenaries || {
  knight: { name: "수호기사 리처드", roleName: "인간전사", icon: "🛡️", hireCost: 500, desc: "전열 탱킹 · 배쉬 스턴 · 방패 블록 특화" },
  ranger: { name: "숲속의 실비아", roleName: "엘프궁수", icon: "🏹", hireCost: 600, desc: "원거리 폭딜 · 카이팅 · 네이처스 터치 보조힐" },
  wizard: { name: "아크메이지 루시안", roleName: "엘프마법사", icon: "🔮", hireCost: 700, desc: "광역/단일 극딜 · 큐어 고효율 힐링 · 버프" }
};
if (MERC_CLASS_META.ranger) MERC_CLASS_META.ranger.name = "숲속의 실비아";
if (MERC_CLASS_META.wizard) MERC_CLASS_META.wizard.icon = "🔮";

function normalizeMercenaryDisplayName(rawName, mClass = 'knight') {
  const fallback = MERC_CLASS_META[mClass]?.name || (mClass === 'ranger' ? '숲속의 실비아' : (mClass === 'wizard' ? '아크메이지 루시안' : '수호기사 리처드'));
  if (!rawName) return fallback;
  return String(rawName).replace('숲의명사수 실비아', '숲속의 실비아').replace('숲의 명사수 실비아', '숲속의 실비아');
}

let mercenary = {
  hired: false,
  isDead: false,
  class: 'knight',
  name: "수호기사 리처드",
  level: 1,
  exp: 0,
  maxExp: 100,
  x: 1960,
  y: 14280,
  dir: 'down',
  isWalking: false,
  hp: 300,
  maxHp: 300,
  mp: 120,
  maxMp: 120,
  stance: 'SUPPORT', // 'ATTACK' (공격) | 'STANDBY' (대기) | 'SUPPORT' (보조)
  stats: { STR: 13, DEX: 3, INT: 1, CON: 3 },
  inventory: Array(24).fill(null),
  equip: { weapon: null, shield: null, helmet: null, tshirt: null, armor: null, cloak: null, gloves: null, belt: null, boots: null, necklace: null, earring1: null, earring2: null, ring1: null, ring2: null },
  weaponPlus: 0,
  armorPlus: 0,
  activeBuffs: { ELIXIR: 0, SHIELD: 0, HASTE: 0 },
  lastAttackTime: 0,
  lastSkillTime: 0,
  lastHealTime: 0,
  lastHpPotionTime: 0,
  lastMpPotionTime: 0,
  lastCombatTime: 0,
  attackerMonster: null,
  targetMonster: null,
  manaRechargeWait: false,
  nameTag: null
};
window.mercenary = mercenary;

// 🎨 2D RPG 스프라이트 시트 감성의 다층 파츠·프레임 애니메이션 용병 렌더러
// - 본인 오라(황금 비콘)와 절대 겹치지 않도록 내 용병(스카이시안/코랄/슬레이트 보조 마커)과 타 유저 용병(은은한 인디고 그림자 링)을 완벽 분리!
// - 6프레임 스텝 보행 사이클, 4프레임 공격 모션, 관절형 팔/다리/부츠/건틀릿, 눈동자·하이라이트·머리카락·투구·망토·무기 디테일 구현
function drawMercenary(ctx, x, y, m, tick, now, isOtherMerc = false) {
  if (!m || !m.hired || m.isDead) return;
  ctx.save();

  // 피격 리코일 및 공격 런지 반영 (묵직한 타격감)
  let hitOffX = 0, hitOffY = 0;
  const hitElapsed = now - (m.lastHitTime || 0);
  if (hitElapsed >= 0 && hitElapsed < 170) {
    const rf = Math.sin((hitElapsed / 170) * Math.PI) * 5.5;
    const hAng = typeof m.lastHitAngle === 'number' ? m.lastHitAngle : 0;
    hitOffX = Math.cos(hAng) * rf;
    hitOffY = Math.sin(hAng) * rf * 0.65;
  }
  ctx.translate(x + hitOffX, y + hitOffY);

  // 1) 바닥 그림자 및 오라 링 (내 용병 vs 타 플레이어 용병 확연한 시각적 구분!)
  ctx.ellipse(0, 3, 13.5, 13.5 * ISO_TILT, 'rgba(0,0,0,0.46)', null, 0);
  if (isOtherMerc) {
    // 타 플레이어 용병: 차분한 퍼플-인디고 점선형 이중 바닥 링 + 약간 축소된 스케일(0.90)로 내 용병과 즉시 구별
    ctx.ellipse(0, 3, 13.0, 13.0 * ISO_TILT, 'rgba(99, 102, 241, 0.08)', 'rgba(129, 140, 248, 0.62)', 1.3);
    ctx.ellipse(0, 3, 9.5, 9.5 * ISO_TILT, null, 'rgba(165, 180, 252, 0.38)', 0.9);
  } else {
    // 내 동행 용병: 선명한 에메랄드-시안 이중 후광 + 좌우 골드-시안 윙 비콘 + 머리 위 다이아몬드 계약 인장
    const auraCol = m.stance === 'ATTACK' ? '#fb7185' : (m.stance === 'STANDBY' ? '#94a3b8' : '#2dd4bf');
    const auraFill = m.stance === 'ATTACK' ? 'rgba(251, 113, 133, 0.16)' : (m.stance === 'STANDBY' ? 'rgba(148, 163, 184, 0.12)' : 'rgba(45, 212, 191, 0.16)');
    const auraRx = 16.0 + Math.sin(tick * 0.09) * 1.1;
    const auraRy = auraRx * ISO_TILT;
    ctx.ellipse(0, 3, auraRx, auraRy, auraFill, auraCol, 2.0);
    ctx.ellipse(0, 3, auraRx * 0.76, auraRy * 0.76, null, '#fef08a', 1.1);
    // 좌·우 날개형 내 용병 식별 비콘
    ctx.poly([[-auraRx - 3.5, 3], [-auraRx + 1.2, 0.8], [-auraRx + 1.2, 5.2]], '#fef08a', auraCol, 1.0);
    ctx.poly([[auraRx + 3.5, 3], [auraRx - 1.2, 0.8], [auraRx - 1.2, 5.2]], '#fef08a', auraCol, 1.0);

    if ((m.setTier || 0) >= 1) {
      const setCol = m.setTier >= 3 ? '#e879f9' : (m.setTier === 2 ? '#c084fc' : '#60a5fa');
      const setRx = 18.8 + Math.cos(tick * 0.1) * 1.2;
      ctx.ellipse(0, 3, setRx, setRx * ISO_TILT, null, setCol, 1.4);
    }
  }

  // 2) 스프라이트 시트 방식의 이산(Discrete) 프레임 계산 (보행 6프레임, 공격 4프레임, 대기 숨쉬기 2프레임)
  const atkElapsed = now - (m.lastAttackTime || 0);
  const isAtk = atkElapsed >= 0 && atkElapsed < 380;
  const atkFrame = isAtk ? Math.min(3, Math.floor((atkElapsed / 380) * 4)) : 0; // 0:준비, 1:타격직전, 2:임팩트, 3:회수
  const walkFrame = m.isWalking ? (Math.floor(tick * 0.24) % 6) : -1;
  const strideTable = [0, 3.8, 2.2, 0, -3.8, -2.2];
  const liftTable   = [0, -2.4, -1.2, 0, -2.4, -1.2];
  const walkSwing = walkFrame >= 0 ? strideTable[walkFrame] : 0;
  const leftLift  = walkFrame >= 0 ? (walkFrame < 3 ? liftTable[walkFrame] : 0) : 0;
  const rightLift = walkFrame >= 0 ? (walkFrame >= 3 ? liftTable[walkFrame] : 0) : 0;
  const idleBob   = m.isWalking ? (Math.abs(walkSwing) * -0.45) : (Math.floor(tick * 0.06) % 2 === 0 ? 0 : -1.1);

  const isUp = m.dir === 'up';
  const flipX = m.dir === 'left' ? -1 : 1;
  const capeWave = m.isWalking ? (walkSwing * 0.55) : (Math.sin(tick * 0.09) * 1.2);

  ctx.translate(0, idleBob);
  const mercBaseScale = isOtherMerc ? 0.90 : 1.02;
  ctx.scale(flipX * mercBaseScale, mercBaseScale);

  // 공통 피부톤 및 음영
  const skinBase = '#ffe4b5';
  const skinShade = '#f5cba7';

  if (m.class === 'knight') {
    // =========================================================================
    // 🛡️ 1) 인간전사 용병 (가디언 가렌): 로얄 성기사 플레이트 아머 & 날개 투구 & 라이온하트 방패 & 룬 브로드소드
    // =========================================================================
    // [배면 망토 - 후면 시점(isUp)일 때는 최상단에 한 번 더 그림]
    const drawKnightCape = (alphaBoost = false) => {
      ctx.poly([
        [-11, -26], [11, -26],
        [15 - capeWave, 0], [6 - capeWave * 0.7, 2],
        [-6 - capeWave * 0.7, 2], [-15 - capeWave, 0]
      ], '#991b1b', '#450a0a', 1.3);
      ctx.poly([
        [-8, -25], [8, -25],
        [11 - capeWave * 0.8, -1], [-11 - capeWave * 0.8, -1]
      ], '#dc2626', null, 0);
      // 망토 하단 황금 테두리 라인
      ctx.poly([
        [-14.5 - capeWave, -1.5], [14.5 - capeWave, -1.5],
        [15 - capeWave, 0], [-15 - capeWave, 0]
      ], '#facc15', '#78350f', 0.8);
      if (alphaBoost) {
        // 뒷모습일 때 망토 중앙 황금 십자 문양
        ctx.poly([[-1.5, -20], [1.5, -20], [1.5, -6], [-1.5, -6]], '#fde047', '#92400e', 0.8);
        ctx.poly([[-5, -15], [5, -15], [5, -12], [-5, -12]], '#fde047', '#92400e', 0.8);
      }
    };
    if (!isUp) drawKnightCape(false);

    // [관절형 다리 · 무릎 보호대(Poleyns) · 강철 그리브 부츠]
    const lX = -5 + walkSwing * 0.65;
    const rX = 5 - walkSwing * 0.65;
    // 왼다리
    ctx.poly([[lX - 3, -9], [lX + 3, -9], [lX + 3.2, -2 + leftLift], [lX - 3.2, -2 + leftLift]], '#334155', '#0f172a', 1.1);
    ctx.poly([[lX - 3.5, -2 + leftLift], [lX + 3.5, -2 + leftLift], [lX + 4, 3.5 + leftLift], [lX - 4, 3.5 + leftLift]], '#94a3b8', '#0f172a', 1.2);
    ctx.ellipse(lX, -2.2 + leftLift, 3.2, 2.0, '#e2e8f0', '#1e293b', 1.0); // 무릎갑주
    ctx.poly([[lX - 4, 2 + leftLift], [lX + 4.5, 2 + leftLift], [lX + 4.5, 4 + leftLift], [lX - 4, 4 + leftLift]], '#facc15', '#78350f', 0.8);
    // 오른다리
    ctx.poly([[rX - 3, -9], [rX + 3, -9], [rX + 3.2, -2 + rightLift], [rX - 3.2, -2 + rightLift]], '#334155', '#0f172a', 1.1);
    ctx.poly([[rX - 3.5, -2 + rightLift], [rX + 3.5, -2 + rightLift], [rX + 4, 3.5 + rightLift], [rX - 4, 3.5 + rightLift]], '#94a3b8', '#0f172a', 1.2);
    ctx.ellipse(rX, -2.2 + rightLift, 3.2, 2.0, '#e2e8f0', '#1e293b', 1.0);
    ctx.poly([[rX - 4, 2 + rightLift], [rX + 4.5, 2 + rightLift], [rX + 4.5, 4 + rightLift], [rX - 4, 4 + rightLift]], '#facc15', '#78350f', 0.8);

    // [몸통 판금 흉갑 · 황금 서코트(Tabard) · 허리 벨트 · 골반 타셋(Tassets)]
    ctx.poly([[-10, -25], [10, -25], [9, -8], [-9, -8]], '#cbd5e1', '#0f172a', 1.4);
    // 흉갑 상단 하이라이트 & 음영
    ctx.poly([[-8.5, -24], [0, -24], [-1, -13], [-7.5, -13]], '#f8fafc', null, 0);
    ctx.poly([[0, -24], [8.5, -24], [7.5, -13], [1, -13]], '#94a3b8', null, 0);
    // 좌우 골반 타셋(Tassets)
    ctx.poly([[-9.5, -10], [-4, -10], [-5, -4], [-10.5, -5]], '#94a3b8', '#1e293b', 1.1);
    ctx.poly([[4, -10], [9.5, -10], [10.5, -5], [5, -4]], '#94a3b8', '#1e293b', 1.1);
    // 중앙 붉은 성기사 서코트 & 황금 십자 엠블럼
    ctx.poly([[-4.2, -24], [4.2, -24], [4.8, -3], [0, -1], [-4.8, -3]], '#b91c1c', '#facc15', 1.1);
    ctx.poly([[-1.1, -21], [1.1, -21], [1.1, -11], [-1.1, -11]], '#fef08a', null, 0);
    ctx.poly([[-3.2, -17.5], [3.2, -17.5], [3.2, -15.5], [-3.2, -15.5]], '#fef08a', null, 0);
    // 허리 벨트 & 버클
    ctx.poly([[-9.5, -11], [9.5, -11], [9.5, -8.2], [-9.5, -8.2]], '#451a03', '#111', 1.0);
    ctx.poly([[-2.5, -11.5], [2.5, -11.5], [2.5, -7.8], [-2.5, -7.8]], '#facc15', '#78350f', 1.0);

    // [양쪽 다층 견갑(Pauldrons)]
    ctx.ellipse(-11.5, -22, 5.5, 4.2, '#e2e8f0', '#0f172a', 1.3);
    ctx.poly([[-16, -22], [-7, -22], [-8, -19.5], [-15, -19.5]], '#facc15', '#78350f', 0.9);
    ctx.ellipse(11.5, -22, 5.5, 4.2, '#cbd5e1', '#0f172a', 1.3);
    ctx.poly([[7, -22], [16, -22], [15, -19.5], [8, -19.5]], '#facc15', '#78350f', 0.9);

    if (isUp) drawKnightCape(true);

    // [머리 · 이목구비 · 성기사 날개 투구 & 붉은 깃털 장식]
    ctx.ellipse(0, -33.5, 8.6, 8.4, skinBase, '#111', 1.2);
    if (!isUp) {
      // 얼굴 음영, 갈색 앞머리, 또렷한 눈동자와 하이라이트
      ctx.ellipse(0, -31.5, 7.6, 5.2, skinShade, null, 0);
      ctx.ellipse(0, -31.0, 7.2, 4.8, skinBase, null, 0);
      // 눈 (흰자 + 푸른 홍채 + 안광)
      ctx.ellipse(-3.2, -32.2, 1.7, 1.9, '#ffffff', '#0f172a', 0.8);
      ctx.ellipse(3.2, -32.2, 1.7, 1.9, '#ffffff', '#0f172a', 0.8);
      ctx.ellipse(-3.0, -32.1, 1.1, 1.3, '#1d4ed8', null, 0);
      ctx.ellipse(3.4, -32.1, 1.1, 1.3, '#1d4ed8', null, 0);
      ctx.ellipse(-3.4, -32.7, 0.55, 0.55, '#ffffff', null, 0);
      ctx.ellipse(3.0, -32.7, 0.55, 0.55, '#ffffff', null, 0);
      // 눈썹
      ctx.poly([[-5.0, -34.6], [-1.5, -34.0], [-1.5, -33.3], [-5.0, -33.9]], '#78350f', null, 0);
      ctx.poly([[1.5, -34.0], [5.0, -34.6], [5.0, -33.9], [1.5, -33.3]], '#78350f', null, 0);
      // 투구 볼가리개(Cheek guards)
      ctx.poly([[-9.2, -35], [-6.2, -35], [-5.5, -27.5], [-8.8, -28.5]], '#cbd5e1', '#1e293b', 1.1);
      ctx.poly([[6.2, -35], [9.2, -35], [8.8, -28.5], [5.5, -27.5]], '#94a3b8', '#1e293b', 1.1);
    }
    // 투구 돔 & 황금 왕관 크레스트
    ctx.curveFill(-9.5, -34.5, -10.5, -46, 10.5, -46, 9.5, -34.5, '#e2e8f0', '#0f172a', 1.4);
    ctx.poly([[-9.8, -36], [9.8, -36], [10.4, -33.5], [0, -32.2], [-10.4, -33.5]], '#facc15', '#78350f', 1.1);
    // 투구 좌우 작은 은빛 날개 장식
    ctx.poly([[-9.5, -37], [-14.5, -42], [-13, -36], [-9.5, -34.5]], '#f8fafc', '#1e293b', 1.0);
    ctx.poly([[9.5, -37], [14.5, -42], [13, -36], [9.5, -34.5]], '#f8fafc', '#1e293b', 1.0);
    // 풍성한 2단 붉은/황금 깃털 플룸
    ctx.curveFill(0, -43, 5, -54, 15, -49, 10 - capeWave * 0.4, -38, '#dc2626', '#450a0a', 1.2);
    ctx.curveFill(0, -43, 3, -51, 11, -47, 7 - capeWave * 0.3, -39, '#fde047', null, 0);

    // [왼팔 & 라이온하트 카이트 쉴드]
    const shOffY = m.isWalking ? -walkSwing * 0.25 : 0;
    ctx.poly([[-17, -23 + shOffY], [-6.5, -23 + shOffY], [-5.5, -10 + shOffY], [-11.5, -3.5 + shOffY], [-17.5, -10 + shOffY]], '#1e3a8a', '#facc15', 1.6);
    ctx.poly([[-15, -21 + shOffY], [-8.5, -21 + shOffY], [-7.5, -10.5 + shOffY], [-11.5, -6 + shOffY], [-15.5, -10.5 + shOffY]], '#2563eb', null, 0);
    // 방패 황금 십자 & 중앙 보석
    ctx.poly([[-12.3, -20.5 + shOffY], [-10.7, -20.5 + shOffY], [-10.7, -6.5 + shOffY], [-12.3, -6.5 + shOffY]], '#fef08a', '#b45309', 0.7);
    ctx.poly([[-15, -15 + shOffY], [-8, -15 + shOffY], [-8, -13.2 + shOffY], [-15, -13.2 + shOffY]], '#fef08a', '#b45309', 0.7);
    ctx.ellipse(-11.5, -14.1 + shOffY, 1.8, 1.8, '#ef4444', '#ffffff', 0.8);

    // [오른팔 건틀릿 & 룬 브로드소드 (4프레임 스윙 애니메이션)]
    ctx.save();
    ctx.translate(11.5, -18);
    const swAngles = [-0.32, -0.85, 1.05, 0.42];
    const swRot = isAtk ? swAngles[atkFrame] : (-0.22 + walkSwing * 0.05);
    ctx.rotate(swRot);
    // 오른팔 & 강철 건틀릿
    ctx.poly([[-2.5, -3], [2.5, -3], [3, 4], [-2, 4]], '#94a3b8', '#0f172a', 1.1);
    ctx.ellipse(0.5, 3.5, 2.6, 2.2, '#facc15', '#78350f', 1.0);
    // 검 손잡이(Hilt) & 폼멜 보석 & 크로스가드
    ctx.poly([[-1.8, 2], [1.8, 2], [1.8, 8], [-1.8, 8]], '#78350f', '#111', 1.0);
    ctx.ellipse(0, 8.8, 2.2, 2.2, '#facc15', '#78350f', 1.0);
    ctx.poly([[-6.5, 0], [6.5, 0], [5.5, 2.8], [-5.5, 2.8]], '#facc15', '#78350f', 1.1);
    ctx.ellipse(0, 1.4, 1.6, 1.6, '#38bdf8', null, 0);
    // 검신 (외곽 날 + 중앙 핏줄 홈 + 빛 반사)
    ctx.poly([[-3.0, 0], [3.0, 0], [2.4, -27], [0, -34], [-2.4, -27]], '#f8fafc', '#334155', 1.2);
    ctx.poly([[0, 0], [2.4, 0], [1.8, -26], [0, -33]], '#cbd5e1', null, 0);
    ctx.poly([[-0.8, -2], [0.8, -2], [0.5, -24], [-0.5, -24]], '#38bdf8', null, 0);
    // 공격 임팩트 프레임일 때 검기 슬래시 아크 표시
    if (isAtk && (atkFrame === 1 || atkFrame === 2)) {
      ctx.curveFill(-2, -32, 16, -24, 20, -4, 4, 8, 'rgba(254, 240, 138, 0.45)', '#fef08a', 1.4);
    }
    ctx.restore();
  }
  else if (m.class === 'ranger') {
    // =========================================================================
    // 🏹 2) 엘프궁수 용병 (실바나 윈드): 에메랄드 레인저 튜닉 & 화살통 & 엘프 금발 브레이드 & 황금 리커브 보우
    // =========================================================================
    const drawRangerCapeAndQuiver = () => {
      // 숲의 에메랄드 망토
      ctx.poly([
        [-10, -25], [10, -25],
        [13.5 - capeWave, -1], [0, 1.5], [-13.5 - capeWave, -1]
      ], '#14532d', '#052e16', 1.2);
      ctx.poly([
        [-13 - capeWave, -2.2], [13 - capeWave, -2.2],
        [13.5 - capeWave, -0.8], [-13.5 - capeWave, -0.8]
      ], '#fde047', null, 0);
      // 등 뒤 가죽 화살통(Quiver) & 깃털 화살 3발
      ctx.poly([[-9, -27], [-4.5, -28], [-2, -12], [-6.5, -11]], '#78350f', '#270e02', 1.1);
      ctx.poly([[-10.5, -31], [-9.2, -31], [-7.5, -26], [-8.8, -26]], '#fef08a', '#ca8a04', 0.8);
      ctx.poly([[-8.5, -32], [-7.2, -32], [-6.0, -26], [-7.3, -26]], '#4ade80', '#14532d', 0.8);
      ctx.poly([[-6.5, -30.5], [-5.2, -30.5], [-4.5, -26], [-5.8, -26]], '#38bdf8', '#0369a1', 0.8);
    };
    if (!isUp) drawRangerCapeAndQuiver();

    // [날렵한 엘프 레인저 다리 & 가죽 롱부츠 (6프레임 스텝)]
    const lX = -4.5 + walkSwing * 0.7;
    const rX = 4.5 - walkSwing * 0.7;
    // 왼다리
    ctx.poly([[lX - 2.6, -9], [lX + 2.6, -9], [lX + 2.4, -2 + leftLift], [lX - 2.4, -2 + leftLift]], '#fef3c7', '#451a03', 1.0);
    ctx.poly([[lX - 3.0, -2.5 + leftLift], [lX + 3.0, -2.5 + leftLift], [lX + 3.4, 3.5 + leftLift], [lX - 3.2, 3.5 + leftLift]], '#3f6212', '#14532d', 1.2);
    ctx.poly([[lX - 3.3, -2.8 + leftLift], [lX + 3.3, -2.8 + leftLift], [lX + 3.0, -1.0 + leftLift], [lX - 3.0, -1.0 + leftLift]], '#eab308', null, 0);
    // 오른다리
    ctx.poly([[rX - 2.6, -9], [rX + 2.6, -9], [rX + 2.4, -2 + rightLift], [rX - 2.4, -2 + rightLift]], '#fef3c7', '#451a03', 1.0);
    ctx.poly([[rX - 3.0, -2.5 + rightLift], [rX + 3.0, -2.5 + rightLift], [rX + 3.4, 3.5 + rightLift], [rX - 3.2, 3.5 + rightLift]], '#3f6212', '#14532d', 1.2);
    ctx.poly([[rX - 3.3, -2.8 + rightLift], [rX + 3.3, -2.8 + rightLift], [rX + 3.0, -1.0 + rightLift], [rX - 3.0, -1.0 + rightLift]], '#eab308', null, 0);

    // [엘븐 가죽 아머 튜닉 · 크로스 스트랩 · 황금 나뭇잎 브로치]
    ctx.poly([[-8.8, -24], [8.8, -24], [9.8, -6], [-9.8, -6]], '#15803d', '#052e16', 1.3);
    ctx.poly([[-4.5, -24], [4.5, -24], [5.5, -5.5], [0, -3.5], [-5.5, -5.5]], '#166534', '#4ade80', 1.0);
    // 가슴 크로스 가죽 스트랩 & 허리 벨트
    ctx.poly([[-7.5, -23], [-5.2, -23], [6.5, -9], [4.2, -9]], '#78350f', '#270e02', 0.9);
    ctx.poly([[-9.2, -11], [9.2, -11], [9.2, -8.5], [-9.2, -8.5]], '#78350f', '#270e02', 1.0);
    ctx.ellipse(0, -9.7, 2.4, 1.8, '#fde047', '#b45309', 0.9);
    // 어깨 가죽 견갑
    ctx.ellipse(-9.8, -21.5, 4.5, 3.2, '#166534', '#fde047', 1.1);
    ctx.ellipse(9.8, -21.5, 4.5, 3.2, '#166534', '#fde047', 1.1);

    if (isUp) drawRangerCapeAndQuiver();

    // [엘프 귀 · 금발 브레이드 머리카락 · 에메랄드 눈동자 · 후드 & 서클릿]
    // 뾰족한 엘프 귀
    ctx.poly([[-14.2, -33.5], [-7.5, -35.2], [-7.5, -30.2]], skinBase, '#111', 1.0);
    ctx.poly([[14.2, -33.5], [7.5, -35.2], [7.5, -30.2]], skinBase, '#111', 1.0);
    // 금발 옆머리 브레이드(땋은 머리)
    ctx.poly([[-8.5, -31], [-6.2, -31], [-7.2, -21], [-9.5, -22]], '#fef08a', '#ca8a04', 0.9);
    ctx.poly([[6.2, -31], [8.5, -31], [9.5, -22], [7.2, -21]], '#fef08a', '#ca8a04', 0.9);
    // 얼굴
    ctx.ellipse(0, -33, 8.0, 8.0, skinBase, '#111', 1.2);
    if (!isUp) {
      // 금발 앞머리 & 초록빛 엘프 눈동자
      ctx.poly([[-7.5, -36], [0, -34], [-3, -38], [-7.5, -35]], '#fef08a', null, 0);
      ctx.poly([[0, -34], [7.5, -36], [7.5, -35], [3, -38]], '#fef08a', null, 0);
      ctx.ellipse(-3.0, -32.2, 1.6, 1.8, '#ffffff', '#052e16', 0.8);
      ctx.ellipse(3.0, -32.2, 1.6, 1.8, '#ffffff', '#052e16', 0.8);
      ctx.ellipse(-2.9, -32.1, 1.05, 1.25, '#10b981', null, 0);
      ctx.ellipse(3.1, -32.1, 1.05, 1.25, '#10b981', null, 0);
      ctx.ellipse(-3.2, -32.6, 0.5, 0.5, '#ffffff', null, 0);
      ctx.ellipse(2.8, -32.6, 0.5, 0.5, '#ffffff', null, 0);
      // 이마 엘븐 골드 서클릿 & 에메랄드 보석
      ctx.poly([[-7.5, -36.5], [7.5, -36.5], [7.5, -35.0], [-7.5, -35.0]], '#facc15', '#b45309', 0.8);
      ctx.ellipse(0, -35.8, 1.6, 1.6, '#34d399', '#ffffff', 0.7);
    }
    // 에메랄드 후드 & 바람의 깃털
    ctx.curveFill(-9.8, -33.5, -11.5, -46, 11.5, -46, 9.8, -33.5, '#15803d', '#052e16', 1.4);
    ctx.poly([[-8.5, -34.5], [0, -37], [8.5, -34.5], [9.5, -33], [0, -35.5], [-9.5, -33]], '#fde047', '#78350f', 0.8);
    ctx.poly([[2, -42], [12, -50], [9, -42], [5, -39]], '#4ade80', '#052e16', 1.0);
    ctx.poly([[4, -41], [14, -46], [8, -38]], '#fef08a', '#ca8a04', 0.8);

    // [양팔 가죽 브레이서 & 황금 엘븐 리커브 그레이트보우 (4프레임 활시위 당김 모션)]
    ctx.save();
    ctx.translate(10.5, -17.5);
    if (isAtk) ctx.rotate(atkFrame === 2 ? -0.06 : 0.08);
    // 활을 쥔 오른팔
    ctx.poly([[-4, -2], [2.5, -2], [2.5, 1.5], [-4, 1.5]], '#166534', '#052e16', 1.0);
    ctx.ellipse(2.8, -0.2, 2.0, 1.8, skinBase, '#111', 0.8);
    // 리커브 보우 상·하단 곡선 림(Limbs)
    ctx.curveFill(1.5, -18, 11.5, -10, 11.5, 10, 1.5, 18, null, '#eab308', 2.5);
    ctx.curveFill(2.2, -15, 9.2, -8, 9.2, 8, 2.2, 15, null, '#fef08a', 1.2);
    ctx.ellipse(5.5, 0, 2.2, 3.2, '#10b981', '#fde047', 1.0); // 활 중심 에메랄드 그립
    // 활시위 (공격 프레임에 따라 뒤로 팽팽하게 당겨짐)
    const pullX = isAtk ? (atkFrame === 0 ? -3 : (atkFrame === 1 ? -7.5 : (atkFrame === 2 ? 1.5 : -1))) : 1.0;
    ctx.poly([[1.5, -17.5], [2.3, -17.5], [pullX + 0.8, 0], [pullX, 0]], '#e2e8f0', null, 0);
    ctx.poly([[pullX, 0], [pullX + 0.8, 0], [2.3, 17.5], [1.5, 17.5]], '#e2e8f0', null, 0);
    // 시위를 당기는 왼손 & 마력 화살 장전 표현
    if (isAtk && atkFrame <= 2) {
      ctx.ellipse(pullX, 0, 2.0, 2.0, skinBase, '#111', 0.8);
      ctx.poly([[pullX, -1.0], [14, -1.0], [14, 1.0], [pullX, 1.0]], '#fef08a', '#ca8a04', 0.8);
      ctx.poly([[13, -3.2], [18.5, 0], [13, 3.2]], '#2dd4bf', '#ffffff', 1.0);
    }
    ctx.restore();
  }
  else {
    // =========================================================================
    // 🔮 3) 엘프마법사 용병 (아크메이지 루나): 성운 아스트랄 로브 & 은빛 장발 & 마도서(Grimoire) & 천공 크리스탈 스태프
    // =========================================================================
    const drawMageBackCloak = () => {
      ctx.poly([
        [-11.5, -25], [11.5, -25],
        [16.5 - capeWave, 2], [0, 4], [-16.5 - capeWave, 2]
      ], '#2e1065', '#0f172a', 1.3);
      // 은빛 장발 뒷머리 물결
      ctx.poly([
        [-8.5, -31], [8.5, -31],
        [10.5 - capeWave * 0.6, -12], [6, -9], [0, -11], [-6, -9], [-10.5 - capeWave * 0.6, -12]
      ], '#e9d5ff', '#581c87', 1.0);
    };
    if (!isUp) drawMageBackCloak();

    // [비단 마법사 부츠 (6프레임 보행)]
    const lX = -4.2 + walkSwing * 0.55;
    const rX = 4.2 - walkSwing * 0.55;
    ctx.poly([[lX - 2.8, -5], [lX + 2.8, -5], [lX + 3.2, 3.5 + leftLift], [lX - 3.2, 3.5 + leftLift]], '#312e81', '#facc15', 1.1);
    ctx.poly([[rX - 2.8, -5], [rX + 2.8, -5], [rX + 3.2, 3.5 + rightLift], [rX - 3.2, 3.5 + rightLift]], '#312e81', '#facc15', 1.1);

    // [아스트랄 다층 로브 & 황금 룬 스톨(Stole) & 마나 보석 벨트]
    ctx.poly([[-10.5, -24], [10.5, -24], [14.5, 2], [-14.5, 2]], '#4c1d95', '#1e1b4b', 1.4);
    ctx.poly([[-6.5, -24], [6.5, -24], [8.8, 2], [-8.8, 2]], '#6d28d9', '#facc15', 1.1);
    // 중앙 황금 룬 스톨
    ctx.poly([[-2.8, -23], [2.8, -23], [3.6, 1.5], [0, 3], [-3.6, 1.5]], '#facc15', '#78350f', 0.9);
    ctx.poly([[-1.4, -21], [1.4, -21], [1.8, 0], [-1.8, 0]], '#38bdf8', null, 0);
    // 허리 코르셋 벨트 & 마나 크리스탈
    ctx.poly([[-9.5, -12], [9.5, -12], [9.5, -9], [-9.5, -9]], '#1e1b4b', '#facc15', 1.0);
    ctx.ellipse(0, -10.5, 2.5, 2.2, '#38bdf8', '#ffffff', 0.9);
    // 부유형 아케인 견갑(Epaulettes)
    ctx.ellipse(-10.8, -21.5, 5.2, 3.5, '#c084fc', '#facc15', 1.2);
    ctx.ellipse(10.8, -21.5, 5.2, 3.5, '#c084fc', '#facc15', 1.2);

    if (isUp) drawMageBackCloak();

    // [엘프 마법사 얼굴 · 은빛 옆머리 · 보랏빛 신비 눈동자 · 아스트랄 고깔모자]
    ctx.poly([[-13.8, -33], [-7.5, -34.8], [-7.5, -30]], skinBase, '#111', 1.0);
    ctx.poly([[13.8, -33], [7.5, -34.8], [7.5, -30]], skinBase, '#111', 1.0);
    ctx.ellipse(0, -33, 8.0, 8.0, skinBase, '#111', 1.2);
    if (!isUp) {
      // 은빛 라벤더 옆머리 & 앞머리
      ctx.poly([[-8.5, -33], [-6.0, -33], [-6.8, -21], [-9.2, -22]], '#f3e8ff', '#6b21a8', 0.9);
      ctx.poly([[6.0, -33], [8.5, -33], [9.2, -22], [6.8, -21]], '#f3e8ff', '#6b21a8', 0.9);
      ctx.poly([[-7.5, -36], [0, -33.5], [7.5, -36], [6, -38], [-6, -38]], '#f3e8ff', null, 0);
      // 신비로운 자수정/시안 오드아이 느낌의 눈동자 & 안광
      ctx.ellipse(-3.0, -32.0, 1.65, 1.85, '#ffffff', '#1e1b4b', 0.8);
      ctx.ellipse(3.0, -32.0, 1.65, 1.85, '#ffffff', '#1e1b4b', 0.8);
      ctx.ellipse(-2.9, -31.9, 1.1, 1.3, '#a855f7', null, 0);
      ctx.ellipse(3.1, -31.9, 1.1, 1.3, '#38bdf8', null, 0);
      ctx.ellipse(-3.3, -32.5, 0.55, 0.55, '#ffffff', null, 0);
      ctx.ellipse(2.7, -32.5, 0.55, 0.55, '#ffffff', null, 0);
    }
    // 아크메이지 넓은 챙 고깔모자 & 황금 별 버클
    ctx.ellipse(0, -37.2, 15.2, 4.4, '#3b0764', '#facc15', 1.4);
    ctx.poly([[-9.8, -37.2], [9.8, -37.2], [4.5, -53.5], [-3.5, -50.5]], '#581c87', '#1e1b4b', 1.4);
    ctx.poly([[4.5, -53.5], [11.5, -48.5], [5.5, -44.5], [1.5, -48.5]], '#4c1d95', '#1e1b4b', 1.2);
    // 모자 리본 밴드 & 중앙 황금 스타 엠블럼
    ctx.poly([[-9.2, -39.5], [9.2, -39.5], [9.6, -37.0], [-9.6, -37.0]], '#facc15', '#78350f', 0.9);
    ctx.ellipse(0, -38.3, 2.3, 2.3, '#38bdf8', '#ffffff', 0.9);

    // [왼손에 펼친 고대 마도서(Arcane Grimoire)]
    const bookBob = Math.sin(tick * 0.14) * 1.5;
    ctx.poly([[-15.5, -17 + bookBob], [-10.5, -19 + bookBob], [-10.5, -11 + bookBob], [-15.5, -9 + bookBob]], '#7c2d12', '#facc15', 1.0);
    ctx.poly([[-10.5, -19 + bookBob], [-5.5, -17 + bookBob], [-5.5, -9 + bookBob], [-10.5, -11 + bookBob]], '#fef3c7', '#ca8a04', 0.9);
    if (isAtk) {
      ctx.ellipse(-10.5, -21 + bookBob, 3.2, 3.2, 'rgba(56, 189, 248, 0.45)', '#e0f2fe', 1.0);
    }

    // [오른손 천공 날개 크리스탈 스태프 & 공전 마나 오브]
    ctx.save();
    ctx.translate(12.5, -16);
    const stAngles = [-0.1, -0.35, 0.55, 0.2];
    ctx.rotate(isAtk ? stAngles[atkFrame] : (-0.08 + walkSwing * 0.03));
    // 오른손 소매 & 손
    ctx.poly([[-3, -3], [2.5, -3], [3, 2], [-2.5, 2]], '#6d28d9', '#facc15', 1.0);
    ctx.ellipse(0.5, 0, 2.0, 2.0, skinBase, '#111', 0.8);
    // 스태프 샤프트
    ctx.poly([[-1.6, -24], [1.6, -24], [1.6, 16], [-1.6, 16]], '#b45309', '#451a03', 1.1);
    // 스태프 상단 황금 초승달 크래들 & 좌우 천사 날개
    ctx.poly([[-6.5, -23], [-2, -26], [-2, -20], [-5.5, -19]], '#fef08a', '#b45309', 1.0);
    ctx.poly([[6.5, -23], [2, -26], [2, -20], [5.5, -19]], '#fef08a', '#b45309', 1.0);
    const orbPulse = (isAtk ? 7.2 : 5.4) + Math.sin(tick * 0.14) * 1.2;
    ctx.ellipse(0, -27.5, orbPulse * 1.25, orbPulse * 1.25, 'rgba(56, 189, 248, 0.28)', null, 0);
    ctx.ellipse(0, -27.5, orbPulse, orbPulse, '#38bdf8', '#ffffff', 1.4);
    ctx.ellipse(-1.2, -28.8, orbPulse * 0.42, orbPulse * 0.42, '#ffffff', null, 0);
    ctx.restore();
  }

  ctx.restore();
}

function getMercReviveCost() {
  if (!mercenary.hired) return 0;
  const pctCost = Math.floor(player.gold * 0.10);
  const lvBaseCost = Math.max(100, mercenary.level * 35);
  return Math.max(lvBaseCost, pctCost);
}

// 아이템의 개별 인챈트 수치 조회 헬퍼 (구버전 세이브 호환 포함)
function getItemPlusValue(inst, slotKey = null, owner = 'player') {
  if (!inst) return 0;
  if (typeof inst.plus === 'number') return inst.plus;
  if (owner === 'player') {
    if (slotKey === 'weapon' && player.weaponPlus > 0) return player.weaponPlus;
    if (slotKey && slotKey !== 'weapon' && player.armorPlus > 0) return player.armorPlus;
  }
  return 0;
}

// 고강화(+7, +9, +10) 달성 시 공·방 인플레이션을 억제하면서 체감 가치를 높이는 특수 유틸리티 보너스 계산기
function getHighEnchantUtilityBonuses(plus, isWeapon = false) {
  const b = { armorPenPct: 0, coolReducePct: 0, bossDmgPct: 0, dmgReducePct: 0, bossDmgReducePct: 0, mpCostReducePct: 0, allStat: 0, extraHp: 0, extraMp: 0, labels: [] };
  if (plus <= 0) return b;
  if (isWeapon) {
    if (plus >= 7) {
      b.armorPenPct += 5 + Math.max(0, plus - 10) * 2;
      b.labels.push(`+7 방어관통 +${b.armorPenPct}%`);
    }
    if (plus >= 9) {
      b.coolReducePct += 8;
      b.labels.push(`+9 스킬쿨감 -8%`);
    }
    if (plus >= 10) {
      b.bossDmgPct += 10 + (plus - 10) * 3;
      b.labels.push(`+${plus} 보스추뎀 +${b.bossDmgPct}%`);
    }
  } else {
    if (plus >= 5) {
      b.extraHp += 25;
      b.extraMp += 15;
    }
    if (plus >= 7) {
      b.dmgReducePct += 3;
      b.labels.push(`+7 피해감쇄 +3%`);
    }
    if (plus >= 9) {
      b.coolReducePct += 2;
      b.mpCostReducePct += 3;
      b.labels.push(`+9 쿨감-2%·MP소모-3%`);
    }
    if (plus >= 10) {
      b.bossDmgReducePct += 4;
      b.allStat += 1 + (plus - 10);
      b.labels.push(`+${plus} 보스피감+4%·올스탯+${b.allStat}`);
    }
  }
  return b;
}

function calculateMercCombatStats() {
  if (!mercenary.hired) {
    return { totalAtk: 10, totalMAtk: 10, totalDef: 5, totalMDef: 5, maxHp: 200, maxMp: 100, atkSpeedSec: 1.0, critRate: 8, drainBonus: 0, armorPenPct: 0, bossDmgPct: 0, dmgReducePct: 0, bossDmgReducePct: 0 };
  }
  const bCfg = CLASS_STATS[mercenary.class] || CLASS_STATS.knight;
  const lv = mercenary.level;

  const base = bCfg.fixedBaseStats;
  let sSTR = base.str + (mercenary.class === 'knight' ? (lv - 1) * 2 : Math.floor((lv - 1) * 0.4));
  let sDEX = base.dex + (mercenary.class === 'ranger' ? (lv - 1) * 2 : Math.floor((lv - 1) * 0.5));
  let sINT = base.int + (mercenary.class === 'wizard' ? (lv - 1) * 2 : Math.floor((lv - 1) * 0.4));
  let sCON = base.con + (lv - 1) * 1;

  if ((mercenary.activeBuffs?.ENCHANT_STAT || 0) > 0) {
    sSTR += 2; sDEX += 2; sINT += 2; sCON += 2;
  }
  if ((mercenary.activeBuffs?.MERC_BLESS || 0) > 0) {
    sSTR += 3; sDEX += 3; sINT += 3; sCON += 3;
  }

  let bonusHp = 0, bonusMp = 0, critBonus = 0, drainBonus = 0;
  let weaponAtk = 0, magicAtk = 0, atkSpeedSec = mercenary.class === 'ranger' ? 0.85 : (mercenary.class === 'wizard' ? 1.3 : 1.05);
  let sumDef = 0, sumMDef = 0;
  let enchantAtkBonus = 0, enchantDefBonus = 0;
  let armorPenPct = 0, bossDmgPct = 0, dmgReducePct = 0, bossDmgReducePct = 0;
  let totalEquipPlus = 0;

  const allSlots = ['weapon', 'shield', 'helmet', 'tshirt', 'armor', 'cloak', 'gloves', 'belt', 'boots', 'necklace', 'earring1', 'earring2', 'ring1', 'ring2'];
  allSlots.forEach(slot => {
    const eqIdx = mercenary.equip[slot];
    if (eqIdx !== null && eqIdx !== undefined && mercenary.inventory[eqIdx]) {
      const inst = mercenary.inventory[eqIdx];
      const def = window.itemDict[inst.type] || {};
      const mult = inst.mult || (typeof def.fixedGrade === 'number' ? GameDB.ItemGrades[def.fixedGrade].mult : 1.0);
      const itemPlus = getItemPlusValue(inst, slot, 'mercenary');
      totalEquipPlus += itemPlus;
      const hiBon = getHighEnchantUtilityBonuses(itemPlus, slot === 'weapon');

      armorPenPct += hiBon.armorPenPct;
      bossDmgPct += hiBon.bossDmgPct;
      dmgReducePct += hiBon.dmgReducePct;
      bossDmgReducePct += hiBon.bossDmgReducePct;
      bonusHp += hiBon.extraHp;
      bonusMp += hiBon.extraMp;
      if (hiBon.allStat > 0) {
        sSTR += hiBon.allStat; sDEX += hiBon.allStat; sINT += hiBon.allStat; sCON += hiBon.allStat;
      }

      if (slot === 'weapon') {
        weaponAtk += Math.round((def.pAtk || 0) * mult);
        magicAtk += Math.round((def.mAtk || 0) * mult);
        enchantAtkBonus += itemPlus * 3 + Math.min(6, Math.max(0, itemPlus - 6) * 2);
        if (def.atkSpeed) atkSpeedSec = def.atkSpeed;
      } else {
        if (def.def) sumDef += Math.round(def.def * mult);
        if (def.mDef) sumMDef += Math.round(def.mDef * mult);
        if (def.pAtk) weaponAtk += def.pAtk;
        if (def.mAtk) magicAtk += def.mAtk;
        enchantDefBonus += itemPlus * 2 + Math.min(4, Math.max(0, itemPlus - 4) * 1);
      }
      if (def.bonusStats?.mDef) sumMDef += def.bonusStats.mDef;
      if (def.weight) {
        bonusHp += def.weight * 2;
        bonusMp += Math.floor(def.weight * 0.8);
      }
      if (def.bonusMp) bonusMp += def.bonusMp;
      if (def.drain) drainBonus += def.drain;
      if (def.bonusStats) {
        sSTR += def.bonusStats.STR || 0;
        sDEX += def.bonusStats.DEX || 0;
        sINT += def.bonusStats.INT || 0;
        sCON += def.bonusStats.CON || 0;
        bonusHp += def.bonusStats.maxHp || 0;
        bonusMp += def.bonusStats.maxMp || 0;
        critBonus += def.bonusStats.crit || 0;
        drainBonus += def.bonusStats.drain || 0;
      }
      if (Array.isArray(inst.options)) {
        inst.options.forEach(opt => {
          if (opt.key === 'STR') sSTR += opt.val;
          else if (opt.key === 'DEX') sDEX += opt.val;
          else if (opt.key === 'INT') sINT += opt.val;
          else if (opt.key === 'CON') sCON += opt.val;
          else if (opt.key === 'maxHp') bonusHp += opt.val;
          else if (opt.key === 'maxMp') bonusMp += opt.val;
          else if (opt.key === 'crit') critBonus += opt.val;
          else if (opt.key === 'drain') drainBonus += opt.val;
          else if (opt.key === 'mDef') sumMDef += opt.val;
        });
      }
    }
  });

  const mainVal = mercenary.class === 'knight' ? sSTR : (mercenary.class === 'ranger' ? sDEX : sINT);
  let buffAtk = ((mercenary.activeBuffs?.SHADOW_FANG || 0) > 0 ? 15 : 0) + ((mercenary.activeBuffs?.HOLY_WEAPON || 0) > 0 ? 12 : 0);
  let totalAtk = Math.floor(mainVal * 1.4 + weaponAtk + enchantAtkBonus + buffAtk + lv * 2.2 + 12);
  let totalMAtk = Math.floor(sINT * 1.7 + magicAtk + enchantAtkBonus + buffAtk + lv * 2.5 + 15);
  const ironSkinDef = (mercenary.activeBuffs?.IRON_SKIN || 0) > 0 ? 16 : 0;
  const ironSkinMDef = (mercenary.activeBuffs?.IRON_SKIN || 0) > 0 ? 12 : 0;
  const guardArmorDef = (mercenary.activeBuffs?.GUARDIAN_ARMOR || 0) > 0 ? 32 : 0;
  const guardArmorMDef = (mercenary.activeBuffs?.GUARDIAN_ARMOR || 0) > 0 ? 24 : 0;
  if ((mercenary.activeBuffs?.IRON_SKIN || 0) > 0) dmgReducePct += 8;
  if ((mercenary.activeBuffs?.GUARDIAN_ARMOR || 0) > 0) { dmgReducePct += 15; bossDmgReducePct += 10; }
  let totalDef = Math.floor(sCON * 0.85 + sumDef + enchantDefBonus + ironSkinDef + guardArmorDef + ((mercenary.activeBuffs?.SHIELD || 0) > 0 ? 10 : 0) + ((mercenary.activeBuffs?.MERC_BLESS || 0) > 0 ? 10 : 0) + lv * 1.35 + (mercenary.class === 'knight' ? 12 : 4));
  let totalMDef = Math.floor((bCfg.baseMDef || 6) + (lv - 1) * (bCfg.mDefPerLv || 1.2) + sINT * 0.55 + sCON * 0.35 + sumMDef + Math.floor(enchantDefBonus * 0.8) + ironSkinMDef + guardArmorMDef + ((mercenary.activeBuffs?.SHIELD || 0) > 0 ? 8 : 0) + ((mercenary.activeBuffs?.LIGHT || 0) > 0 ? 8 : 0) + ((mercenary.activeBuffs?.SOUL_BARRIER || 0) > 0 ? 22 : 0) + ((mercenary.activeBuffs?.MERC_BLESS || 0) > 0 ? 10 : 0));

  if ((mercenary.activeBuffs?.ELIXIR || 0) > 0) {
    totalAtk = Math.floor(totalAtk * 1.12);
    totalMAtk = Math.floor(totalMAtk * 1.12);
    atkSpeedSec *= 0.92;
  }
  if ((mercenary.activeBuffs?.MERC_BLESS || 0) > 0) {
    totalAtk = Math.floor(totalAtk * 1.10);
    totalMAtk = Math.floor(totalMAtk * 1.10);
    atkSpeedSec *= 0.92;
  }
  if ((mercenary.activeBuffs?.HASTE || 0) > 0) atkSpeedSec *= 0.80;
  if ((mercenary.activeBuffs?.NATURES_FURY || 0) > 0) atkSpeedSec *= 0.82;

  let maxHp = bCfg.baseHp + (lv - 1) * 32 + sCON * 14 + bonusHp;
  if (mercenary.class === 'knight') maxHp = Math.floor(maxHp * 1.18);
  let maxMp = bCfg.baseMp + (lv - 1) * 15 + sINT * 10 + bonusMp;
  if ((mercenary.activeBuffs?.GUARDIAN_ARMOR || 0) > 0) {
    maxHp = Math.floor(maxHp * 1.15);
  }
  if ((mercenary.activeBuffs?.ADV_SPIRIT || 0) > 0) {
    maxHp = Math.floor(maxHp * 1.2);
    maxMp = Math.floor(maxMp * 1.2);
  }

  // 🌟 용병 전용 장비 인챈트 세트 효과 (착용 장비 총 강화 수치 합계 기준 1~3단계 세트 각성!)
  let setTier = 0;
  let setLabel = '미발동 (총 +5 이상시 발동)';
  if (totalEquipPlus >= 18) {
    setTier = 3;
    setLabel = '★★★ 신성 각성 세트(총+18↑: 공+25%·HP+30%·방+18·피흡+6%)';
    totalAtk = Math.floor(totalAtk * 1.25);
    totalMAtk = Math.floor(totalMAtk * 1.25);
    maxHp = Math.floor(maxHp * 1.30);
    totalDef += 18;
    atkSpeedSec *= 0.86;
    critBonus += 12;
    drainBonus += 6;
    bossDmgPct += 15;
    bossDmgReducePct += 12;
  } else if (totalEquipPlus >= 10) {
    setTier = 2;
    setLabel = '★★ 정예 기사 세트(총+10↑: 공+14%·HP+18%·방+10·피흡+3%)';
    totalAtk = Math.floor(totalAtk * 1.14);
    totalMAtk = Math.floor(totalMAtk * 1.14);
    maxHp = Math.floor(maxHp * 1.18);
    totalDef += 10;
    atkSpeedSec *= 0.92;
    critBonus += 7;
    drainBonus += 3;
    bossDmgReducePct += 6;
  } else if (totalEquipPlus >= 5) {
    setTier = 1;
    setLabel = '★ 숙련 용병 세트(총+5↑: 공+7%·HP+10%·방+5·치명+4%)';
    totalAtk = Math.floor(totalAtk * 1.07);
    totalMAtk = Math.floor(totalMAtk * 1.07);
    maxHp = Math.floor(maxHp * 1.10);
    totalDef += 5;
    critBonus += 4;
  }
  mercenary.setTier = setTier;
  mercenary.totalEquipPlus = totalEquipPlus;

  return {
    totalAtk, totalMAtk, totalDef, totalMDef, maxHp, maxMp,
    atkSpeedSec: Math.max(0.42, Number(atkSpeedSec.toFixed(2))),
    critRate: Math.min(75, 6 + Math.floor(sDEX * 0.35) + critBonus),
    drainBonus,
    armorPenPct: Math.min(55, armorPenPct),
    bossDmgPct: Math.min(65, bossDmgPct),
    dmgReducePct: Math.min(28, dmgReducePct),
    bossDmgReducePct: Math.min(38, bossDmgReducePct),
    totalEquipPlus, setTier, setLabel,
    effSTR: sSTR, effDEX: sDEX, effINT: sINT, effCON: sCON
  };
}

function syncMercStats(fullHeal = false) {
  if (!mercenary.hired) return;
  const ms = calculateMercCombatStats();
  mercenary.maxHp = ms.maxHp;
  mercenary.maxMp = ms.maxMp;
  if (fullHeal) {
    mercenary.hp = mercenary.maxHp;
    mercenary.mp = mercenary.maxMp;
  } else {
    mercenary.hp = Math.min(mercenary.maxHp, mercenary.hp);
    mercenary.mp = Math.min(mercenary.maxMp, mercenary.mp);
  }
}

// 용병 레벨 및 클래스에 맞는 적정 기본 장비(무기/방패/투구/갑옷/장갑/신발/망토) 세트 산출 헬퍼
function getMercStarterGearByLevel(mercClass, mercLv = 1) {
  const lv = Math.max(1, Number(mercLv) || 1);
  const wTier = lv >= 140 ? '05' : (lv >= 75 ? '04' : (lv >= 35 ? '03' : (lv >= 12 ? '02' : '01')));
  const aTier = lv >= 150 ? '05' : (lv >= 80 ? '04' : (lv >= 40 ? '03' : (lv >= 15 ? '02' : '01')));
  const sTier = lv >= 90 ? '03' : (lv >= 30 ? '02' : '01');

  const weaponPrefix = mercClass === 'wizard' ? 'W_ST' : (mercClass === 'ranger' ? 'W_BW' : 'W_SW');
  const gearList = [
    { slot: 'weapon', id: `${weaponPrefix}${wTier}` },
    { slot: 'armor',  id: `A_AR${aTier}` },
    { slot: 'helmet', id: `A_HE${aTier}` },
    { slot: 'gloves', id: `A_GL${aTier}` },
    { slot: 'boots',  id: `A_SH${aTier}` },
    { slot: 'cloak',  id: `A_CL${aTier}` }
  ];
  if (mercClass === 'knight') {
    gearList.splice(1, 0, { slot: 'shield', id: `W_SH${sTier}` });
  }
  return gearList;
}

// 클래스별 · 레벨별 기본 무기 및 기본 방어구 보장 헬퍼 (용병 고용/복원 시 용병 레벨에 적당한 기본 장비 자동 지급 및 장착)
function ensureMercDefaultEquipment(mercClass, forceUpgradeStarter = false) {
  const mercLv = Math.max(1, Number(mercenary.level || player?.level) || 1);
  const starterGear = getMercStarterGearByLevel(mercClass, mercLv);

  if (!Array.isArray(mercenary.inventory) || mercenary.inventory.length < 24) {
    mercenary.inventory = Array(24).fill(null);
  }
  if (!mercenary.equip || typeof mercenary.equip !== 'object') {
    mercenary.equip = createEmptyEquipObj();
  }

  starterGear.forEach(({ slot, id }) => {
    const curEqIdx = mercenary.equip[slot];
    const curInst = (curEqIdx !== null && curEqIdx !== undefined) ? mercenary.inventory[curEqIdx] : null;
    const curDef = curInst ? window.itemDict?.[curInst.type] : null;

    if (curInst && curDef && isItemMatchingSlot(curDef, slot) && canMercEquipItem(curDef)) {
      if (forceUpgradeStarter && curInst.isMercStarter && (!curInst.plus || curInst.plus <= 0) && curInst.type !== id) {
        const newInst = createItemInstance(id, 1, false, 0);
        newInst.isMercStarter = true;
        mercenary.inventory[curEqIdx] = newInst;
      }
      return;
    }

    mercenary.equip[slot] = null;
    let bagIdx = mercenary.inventory.findIndex(inst => {
      if (!inst) return false;
      const def = window.itemDict?.[inst.type];
      return def && isItemMatchingSlot(def, slot) && canMercEquipItem(def);
    });
    if (bagIdx === -1) {
      let emptyIdx = mercenary.inventory.findIndex(i => i === null);
      if (emptyIdx === -1 && slot === 'weapon') emptyIdx = 0;
      if (emptyIdx > -1) {
        const gInst = createItemInstance(id, 1, false, 0);
        gInst.isMercStarter = true;
        mercenary.inventory[emptyIdx] = gInst;
        bagIdx = emptyIdx;
      }
    }
    if (bagIdx > -1) {
      mercenary.equip[slot] = bagIdx;
    }
  });
}

// 용병 고용 확인 모달 요청 (클릭 시 바로 골드가 나가지 않고 반드시 확인 단계를 거침)
window.hireMercenary = function(mercClass) {
  window.requestHireMercenary(mercClass);
};

window.requestHireMercenary = function(mercClass) {
  const meta = MERC_CLASS_META[mercClass];
  if (!meta) return;

  if (mercenary.hired) {
    window.showSystemAlertModal(
      '🛡️ 용병 반환 후 고용 안내',
      `현재 동행 중인 용병 [${mercenary.name}]이(가) 있습니다.
다른 용병으로 교체하려면 먼저 NPC 창 상단의 [🔄 용병 반환] 버튼으로 기존 용병을 반환해주세요.`
    );
    return;
  }

  const cost = meta.hireCost;
  if (player.gold < cost) {
    window.addChat(`⚠️ [용병단] 고용 골드가 부족합니다! (필요: ${cost.toLocaleString()} G / 보유: ${player.gold.toLocaleString()} G)`, 'log-hit');
    window.showSystemAlertModal(
      '⚠️ 고용 골드 부족',
      `'${meta.name} (${meta.roleName})' 용병을 고용하려면 ${cost.toLocaleString()} G가 필요합니다.
현재 보유 골드: ${player.gold.toLocaleString()} G`
    );
    return;
  }

  const targetLv = Math.max(1, player.level || 1);
  const starterList = getMercStarterGearByLevel(mercClass, targetLv);
  const starterNames = starterList.map(g => window.itemDict?.[g.id]?.name || g.id).join(' + ');

  window.showSystemAlertModal(
    '🤝 정예 용병 고용 확인',
    `[${meta.icon} ${meta.name} (${meta.roleName} · Lv.${targetLv})]
• 레벨 맞춤 기본 지급 무장: ${starterNames}
• 고용 비용: 💰 ${cost.toLocaleString()} G (고용 후 잔액: ${(player.gold - cost).toLocaleString()} G)

정말로 이 용병을 고용하시겠습니까?`,
    `
      <button type="button" class="auth-sub-btn" style="flex:1;" onclick="closeSystemAlertModal()">취소</button>
      <button type="button" class="auth-primary-btn" style="flex:1;" onclick="closeSystemAlertModal(); confirmHireMercenary('${mercClass}');">💰 고용 확인</button>
    `
  );
};

window.confirmHireMercenary = function(mercClass) {
  const meta = MERC_CLASS_META[mercClass];
  if (!meta || mercenary.hired) return;
  const cost = meta.hireCost;
  if (player.gold < cost) {
    window.addChat(`⚠️ [용병단] 고용 골드가 부족합니다! (필요: ${cost} G)`, 'log-hit');
    return;
  }

  player.gold -= cost;
  mercenary.hired = true;
  mercenary.isDead = false;
  mercenary.class = mercClass;
  mercenary.name = meta.name;
  mercenary.level = Math.max(1, player.level);
  mercenary.exp = 0;
  mercenary.maxExp = Math.floor(100 * Math.pow(mercenary.level, 1.42));
  mercenary.x = player.x - 45;
  mercenary.y = player.y + 28;
  mercenary.stance = 'SUPPORT';
  mercenary.inventory = Array(24).fill(null);
  mercenary.equip = createEmptyEquipObj();
  mercenary.activeBuffs = { ELIXIR: 0, SHIELD: 0, HASTE: 0 };
  mercenary.manaRechargeWait = false;

  // 용병 레벨 및 클래스에 맞는 적정 기본 장비 풀세트 자동 지급 및 장착
  ensureMercDefaultEquipment(mercClass, true);
  const hpPotType = mercenary.level >= 25 ? 'C_P02' : 'C_P01';
  const mpPotType = mercenary.level >= 25 ? 'C_P04' : 'C_P03';
  giveItemToMerc(hpPotType, 15);
  giveItemToMerc(mpPotType, 15);
  giveItemToMerc('C_P05', 2);
  autoEquipMercBestItems();

  syncMercStats(true);
  activeEffects.push({ type: 'buff', x: mercenary.x, y: mercenary.y, targetRef: mercenary, life: 35, maxLife: 35, skillName: '인챈트 스탯' });
  window.broadcastMultiplayerActionFx?.('ally_buff', { isMerc: true, x: Math.round(mercenary.x), y: Math.round(mercenary.y), skillName: '인챈트 스탯' });
  window.updateMercHUD();
  updateStatusHUD();
  window.triggerAutoSave?.('merc_hire', true);
  window.addChat(`🤝 [용병 합류] '${meta.name} (${meta.roleName}, Lv.${mercenary.level})' 용병이 전용 기본 무기를 장착하고 합류했습니다!`, 'log-kill');

  const npcModal = document.getElementById('npc-modal-ui');
  if (npcModal && !npcModal.classList.contains('hidden')) {
    window.openNpcModal({ name: "용병단장 카셀", role: "MERCENARY" });
  }
};

// 사용하던 용병을 NPC에게 반환하고 다른 용병을 고용할 수 있도록 하는 반환 워크플로우
window.requestReturnMercenary = function() {
  if (!mercenary.hired) return;
  const curMeta = MERC_CLASS_META[mercenary.class] || MERC_CLASS_META.knight;
  window.showSystemAlertModal(
    '🔄 사용 중인 용병 반환 확인',
    `현재 동행 중인 [${curMeta.icon} ${mercenary.name} (Lv.${mercenary.level})] 용병을 용병단에 반환하시겠습니까?

• 용병에게 전달했거나 강화한 장비·아이템은 플레이어 가방(가방 가득 참 시 계정 창고)으로 안전하게 회수됩니다.
• 반환 후 다른 클래스의 용병을 새로 고용할 수 있습니다.`,
    `
      <button type="button" class="auth-sub-btn" style="flex:1;" onclick="closeSystemAlertModal()">취소</button>
      <button type="button" class="auth-danger-btn" style="flex:1;" onclick="closeSystemAlertModal(); executeReturnMercenary();">🔄 반환 확인</button>
    `
  );
};

window.executeReturnMercenary = function() {
  if (!mercenary.hired) return;
  const oldName = mercenary.name;
  let returnedCount = 0;

  // 용병 가방의 아이템 중 기본 무상 스타터 장비(미강화)를 제외한 플레이어 지급/강화 아이템 회수
  mercenary.inventory.forEach((inst, idx) => {
    if (!inst) return;
    const isUnupgradedStarter = inst.isMercStarter && (!inst.plus || inst.plus <= 0);
    if (isUnupgradedStarter) return;
    const saved = giveItem(inst.type, inst.qty || 1, inst.gradeIdx ?? null, inst);
    if (saved) {
      returnedCount++;
    } else if (window.accountStorage && Array.isArray(window.accountStorage.bankItems)) {
      const emptyBankIdx = window.accountStorage.bankItems.findIndex(b => !b);
      if (emptyBankIdx > -1) {
        window.accountStorage.bankItems[emptyBankIdx] = JSON.parse(JSON.stringify(inst));
        returnedCount++;
      }
    }
    mercenary.inventory[idx] = null;
  });

  mercenary.hired = false;
  mercenary.isDead = false;
  mercenary.targetMonster = null;
  mercenary.attackerMonster = null;
  mercenary.inventory = Array(24).fill(null);
  mercenary.equip = createEmptyEquipObj();
  if (player.friendlyTarget && player.friendlyTarget.type === 'MERC') {
    player.friendlyTarget = null;
  }
  if (mercenary.nameTag) mercenary.nameTag.visible = false;

  const mercModal = document.getElementById('merc-ui');
  if (mercModal) mercModal.classList.add('hidden');

  window.updateMercHUD();
  updateStatusHUD();
  renderHotbarSlots();
  if (!document.getElementById('inventory-ui').classList.contains('hidden')) renderInventory();
  window.triggerAutoSave?.('merc_return', true);

  window.addChat(`🔄 [용병 반환 완료] '${oldName}' 용병을 용병단에 반환했습니다.${returnedCount > 0 ? ` (아이템 ${returnedCount}종 회수 완료)` : ''} 이제 다른 용병을 고용할 수 있습니다!`, 'log-sys');

  const npcModal = document.getElementById('npc-modal-ui');
  if (npcModal && !npcModal.classList.contains('hidden')) {
    window.openNpcModal({ name: "용병단장 카셀", role: "MERCENARY" });
  }
};

window.reviveMercenary = function() {
  if (!mercenary.hired || !mercenary.isDead) return;
  let cost = getMercReviveCost();
  if (player.gold < cost) cost = Math.floor(player.gold * 0.5);
  window.showSystemAlertModal(
    '✨ 용병 부활 확인',
    `전투 불능 상태인 [${mercenary.name}] 용병을 부활시키겠습니까?
• 부활 비용: 💰 ${cost.toLocaleString()} G (보유: ${player.gold.toLocaleString()} G)`,
    `
      <button type="button" class="auth-sub-btn" style="flex:1;" onclick="closeSystemAlertModal()">취소</button>
      <button type="button" class="auth-primary-btn" style="flex:1;" onclick="closeSystemAlertModal(); confirmReviveMercenary();">✨ 부활 확인</button>
    `
  );
};

window.confirmReviveMercenary = function() {
  if (!mercenary.hired || !mercenary.isDead) return;
  let cost = getMercReviveCost();
  if (player.gold < cost) cost = Math.floor(player.gold * 0.5);
  player.gold = Math.max(0, player.gold - cost);
  mercenary.isDead = false;
  syncMercStats(true);
  mercenary.x = player.x - 42;
  mercenary.y = player.y + 28;
  mercenary.targetMonster = null;
  mercenary.attackerMonster = null;
  mercenary.manaRechargeWait = false;

  activeEffects.push({ type: 'buff', x: mercenary.x, y: mercenary.y, targetRef: mercenary, life: 35, maxLife: 35, skillName: '그레이트 힐' });
  window.broadcastMultiplayerActionFx?.('ally_buff', { isMerc: true, x: Math.round(mercenary.x), y: Math.round(mercenary.y), skillName: '그레이트 힐' });
  window.addChat(`✨ [용병 부활] 용병단장에게 ${cost.toLocaleString()} G를 지급하고 '${mercenary.name}' 용병을 부활시켰습니다!`, 'log-kill');
  window.updateMercHUD();
  updateStatusHUD();
  window.triggerAutoSave?.('merc_revive', true);

  const npcModal = document.getElementById('npc-modal-ui');
  if (npcModal && !npcModal.classList.contains('hidden')) {
    window.openNpcModal({ name: "용병단장 카셀", role: "MERCENARY" });
  }
  const mercModal = document.getElementById('merc-ui');
  if (mercModal && !mercModal.classList.contains('hidden')) {
    window.renderMercUI();
  }
};

window.restoreMercenaryState = function(savedMerc) {
  if (!savedMerc || !savedMerc.hired) return;
  Object.assign(mercenary, savedMerc);
  mercenary.name = normalizeMercenaryDisplayName(mercenary.name, mercenary.class || 'knight');
  mercenary.equip = window.migrateAndNormalizeEquip(mercenary.equip, mercenary.inventory);
  ensureMercDefaultEquipment(mercenary.class || 'knight');
  mercenary.x = player.x - 45;
  mercenary.y = player.y + 28;
  syncMercStats(false);
  window.updateMercHUD();
};

// 용병 인벤토리 아이템 지급 (착용 중인 아이템과 절대 합쳐지지 않고, 모든 장비는 1개씩 독립 슬롯 보장!)
function giveItemToMerc(itemId, qty = 1, prebuiltInst = null) {
  const def = window.itemDict[itemId];
  const isEquip = def && ['한손검', '양손활', '양손지팡이', '방패', '투구', '갑옷', '장갑', '망토', '신발', '반지', '목걸이', '귀걸이', '티셔츠', '벨트'].some(t => def.type?.includes(t));
  const equippedSet = new Set(Object.values(mercenary.equip || {}).filter(v => v !== null && v !== undefined).map(Number));

  if (!isEquip) {
    let existIdx = mercenary.inventory.findIndex((i, idx) => i && i.type === itemId && !equippedSet.has(idx));
    if (existIdx > -1) {
      mercenary.inventory[existIdx].qty += qty;
      return mercenary.inventory[existIdx];
    }
    let emptyIdx = mercenary.inventory.findIndex(i => i === null);
    if (emptyIdx > -1) {
      mercenary.inventory[emptyIdx] = createItemInstance(itemId, qty, false);
      return mercenary.inventory[emptyIdx];
    }
    return null;
  }

  let emptyIdx = mercenary.inventory.findIndex(i => i === null);
  if (emptyIdx > -1) {
    const baseInst = prebuiltInst ? { ...prebuiltInst, qty: 1 } : createItemInstance(itemId, 1, false);
    baseInst.uid = 'eq_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
    baseInst.plus = typeof baseInst.plus === 'number' ? baseInst.plus : 0;
    mercenary.inventory[emptyIdx] = baseInst;
    return mercenary.inventory[emptyIdx];
  }
  return null;
}

function canMercEquipItem(iData) {
  if (!iData) return false;
  const isSword = iData.type.includes('검');
  const isBow = iData.type.includes('활');
  const isStaff = iData.type.includes('지팡이');
  const isShield = iData.type.includes('방패');

  if (isSword || isBow || isStaff || isShield) {
    if (mercenary.class === 'knight' && (isBow || isStaff)) return false;
    if (mercenary.class === 'ranger' && !isBow) return false;
    if (mercenary.class === 'wizard' && !isStaff) return false;
  }
  return true;
}

// 14부위 장착 슬롯 정의 (투구1, 목걸이1, 귀걸이2, 반지2, 장갑1, 무기1, 방패1, 벨트1, 갑옷1, 신발1, 티셔츠1, 망토1)
const ALL_EQUIP_SLOT_KEYS = [
  'helmet', 'earring1', 'earring2',
  'necklace', 'tshirt', 'cloak',
  'weapon', 'armor', 'shield',
  'gloves', 'belt',
  'ring1', 'boots', 'ring2'
];

const EQUIP_SLOT_LABELS = {
  helmet: '투구',
  necklace: '목걸이',
  earring1: '귀걸이1',
  earring2: '귀걸이2',
  ring1: '반지1',
  ring2: '반지2',
  gloves: '장갑',
  weapon: '무기',
  shield: '방패',
  belt: '벨트',
  armor: '갑옷',
  boots: '신발',
  tshirt: '티셔츠',
  cloak: '망토'
};

function createEmptyEquipObj() {
  return {
    weapon: null, shield: null,
    helmet: null, tshirt: null, armor: null, cloak: null,
    gloves: null, belt: null, boots: null,
    necklace: null, earring1: null, earring2: null,
    ring1: null, ring2: null
  };
}

// 구버전 세이브의 10슬롯 데이터를 14슬롯으로 안전하게 마이그레이션 및 정규화
window.migrateAndNormalizeEquip = function(equipObj, invArray = null) {
  const base = createEmptyEquipObj();
  if (!equipObj || typeof equipObj !== 'object') return base;
  ALL_EQUIP_SLOT_KEYS.forEach(k => {
    if (equipObj[k] !== null && equipObj[k] !== undefined && equipObj[k] !== '') {
      const n = Number(equipObj[k]);
      base[k] = (!Number.isNaN(n) && (!invArray || invArray[n])) ? n : null;
    } else {
      base[k] = null;
    }
  });
  if (invArray) {
    // 구버전에서 갑옷 슬롯에 티셔츠가 들어있던 경우 티셔츠 슬롯으로 이동
    if (base.armor !== null && invArray[base.armor]) {
      const d = window.itemDict?.[invArray[base.armor].type];
      if (d?.type?.includes('티셔츠') && base.tshirt === null) {
        base.tshirt = base.armor;
        base.armor = null;
      }
    }
    // 구버전에서 신발 슬롯에 벨트가 들어있던 경우 벨트 슬롯으로 이동
    if (base.boots !== null && invArray[base.boots]) {
      const d = window.itemDict?.[invArray[base.boots].type];
      if (d?.type?.includes('벨트') && base.belt === null) {
        base.belt = base.boots;
        base.boots = null;
      }
    }
    // 구버전에서 목걸이 슬롯에 귀걸이가 들어있던 경우 귀걸이1 슬롯으로 이동
    if (base.necklace !== null && invArray[base.necklace]) {
      const d = window.itemDict?.[invArray[base.necklace].type];
      if (d?.type?.includes('귀걸이') && base.earring1 === null) {
        base.earring1 = base.necklace;
        base.necklace = null;
      }
    }
  }
  Object.assign(equipObj, base);
  return equipObj;
};

let earringReplaceToggle = 2;
let ringReplaceToggle = 2;

function isItemMatchingSlot(def, slotKey) {
  if (!def || !def.type) return false;
  if (slotKey === 'weapon') return def.type.includes('검') || def.type.includes('활') || def.type.includes('지팡이');
  if (slotKey === 'shield') return def.type.includes('방패');
  if (slotKey === 'helmet') return def.type.includes('투구');
  if (slotKey === 'tshirt') return def.type.includes('티셔츠');
  if (slotKey === 'armor') return def.type.includes('갑옷');
  if (slotKey === 'cloak') return def.type.includes('망토');
  if (slotKey === 'gloves') return def.type.includes('장갑');
  if (slotKey === 'belt') return def.type.includes('벨트');
  if (slotKey === 'boots') return def.type.includes('신발');
  if (slotKey === 'necklace') return def.type.includes('목걸이');
  if (slotKey === 'earring1' || slotKey === 'earring2') return def.type.includes('귀걸이');
  if (slotKey === 'ring1' || slotKey === 'ring2') return def.type.includes('반지');
  return false;
}

function resolveEquipSlotKey(def, equipObj) {
  if (!def || !def.type) return 'armor';
  if (def.type.includes('검') || def.type.includes('활') || def.type.includes('지팡이')) return 'weapon';
  if (def.type.includes('방패')) return 'shield';
  if (def.type.includes('투구')) return 'helmet';
  if (def.type.includes('티셔츠')) return 'tshirt';
  if (def.type.includes('갑옷')) return 'armor';
  if (def.type.includes('장갑')) return 'gloves';
  if (def.type.includes('망토')) return 'cloak';
  if (def.type.includes('벨트')) return 'belt';
  if (def.type.includes('신발')) return 'boots';
  if (def.type.includes('목걸이')) return 'necklace';
  if (def.type.includes('귀걸이')) {
    if (equipObj.earring1 === null || equipObj.earring1 === undefined) return 'earring1';
    if (equipObj.earring2 === null || equipObj.earring2 === undefined) return 'earring2';
    earringReplaceToggle = earringReplaceToggle === 1 ? 2 : 1;
    return earringReplaceToggle === 1 ? 'earring1' : 'earring2';
  }
  if (def.type.includes('반지')) {
    if (equipObj.ring1 === null || equipObj.ring1 === undefined) return 'ring1';
    if (equipObj.ring2 === null || equipObj.ring2 === undefined) return 'ring2';
    ringReplaceToggle = ringReplaceToggle === 1 ? 2 : 1;
    return ringReplaceToggle === 1 ? 'ring1' : 'ring2';
  }
  return 'armor';
}

// 아이템 종합 전투력 점수 산출 헬퍼 (플레이어 가방 비교 표시 & 용병 자동 최적 장착 공용)
function getEquipItemPowerScore(inst, targetClass = player?.class || 'knight', ownerType = 'player') {
  if (!inst) return -1;
  const def = window.itemDict?.[inst.type];
  if (!def || !def.type) return -1;
  const isEquip = ['한손검', '양손활', '양손지팡이', '방패', '투구', '갑옷', '장갑', '망토', '신발', '반지', '목걸이', '귀걸이', '티셔츠', '벨트'].some(t => def.type?.includes(t));
  if (!isEquip) return -1;

  // 클래스 착용 제한 검사
  const isSword = def.type.includes('검');
  const isBow = def.type.includes('활');
  const isStaff = def.type.includes('지팡이');
  const isShield = def.type.includes('방패');
  if (isSword || isBow || isStaff || isShield) {
    if (targetClass === 'knight' && (isBow || isStaff)) return -1;
    if (targetClass === 'ranger' && !isBow) return -1;
    if (targetClass === 'wizard' && !isStaff) return -1;
  }

  const mult = inst.mult || (typeof def.fixedGrade === 'number' ? (GameDB.ItemGrades[def.fixedGrade]?.mult || 1.0) : 1.0);
  const plus = getItemPlusValue(inst, isSword || isBow || isStaff ? 'weapon' : 'armor', ownerType);
  const isMage = targetClass === 'wizard';
  const mainStatKey = targetClass === 'knight' ? 'STR' : (targetClass === 'ranger' ? 'DEX' : 'INT');

  let score = 0;
  score += Math.round((def.pAtk || 0) * mult) * (isMage ? 0.6 : 2.8);
  score += Math.round((def.mAtk || 0) * mult) * (isMage ? 3.0 : 0.5);
  score += Math.round((def.def || 0) * mult) * 2.4;
  score += Math.round((def.mDef || 0) * mult) * 2.1;
  score += plus * ((isSword || isBow || isStaff) ? 11.5 : 7.5);
  score += (inst.gradeIdx || 0) * 6.0;
  if (def.weight) score += def.weight * 0.45;
  if (def.bonusMp) score += def.bonusMp * 0.25;
  if (def.bonusHit) score += def.bonusHit * 1.5;
  if (def.drain) score += def.drain * 4.0;
  if (def.coolReduce) score += def.coolReduce * 2.5;

  if (def.bonusStats) {
    score += (def.bonusStats[mainStatKey] || 0) * 3.2;
    score += (def.bonusStats.CON || 0) * 2.2;
    score += (def.bonusStats.maxHp || 0) * 0.18;
    score += (def.bonusStats.maxMp || 0) * 0.14;
    score += (def.bonusStats.crit || 0) * 2.2;
    score += (def.bonusStats.hit || 0) * 1.5;
    score += (def.bonusStats.mDef || 0) * 2.0;
  }
  if (Array.isArray(inst.options)) {
    inst.options.forEach(opt => {
      if (opt.key === mainStatKey) score += opt.val * 3.2;
      else if (opt.key === 'CON') score += opt.val * 2.2;
      else if (opt.key === 'STR' || opt.key === 'DEX' || opt.key === 'INT') score += opt.val * 1.4;
      else if (opt.key === 'maxHp') score += opt.val * 0.18;
      else if (opt.key === 'maxMp') score += opt.val * 0.14;
      else if (opt.key === 'crit') score += opt.val * 2.2;
      else if (opt.key === 'hit') score += opt.val * 1.6;
      else if (opt.key === 'drain') score += opt.val * 3.8;
      else if (opt.key === 'mDef') score += opt.val * 2.1;
    });
  }
  return Math.round(score * 10) / 10;
}
window.getEquipItemPowerScore = getEquipItemPowerScore;

// 플레이어 가방 아이템이 현재 착용 중인 장비보다 더 좋은지 비교하는 헬퍼
function compareBagItemWithEquipped(inst, invIndex) {
  if (!inst || !player) return { isBetter: false, diffScore: 0, targetSlot: null };
  const eqVals = Object.values(player.equip || {}).filter(v => v !== null && v !== undefined).map(Number);
  if (eqVals.includes(Number(invIndex))) return { isBetter: false, diffScore: 0, targetSlot: null };

  const def = window.itemDict?.[inst.type];
  if (!def || !def.type) return { isBetter: false, diffScore: 0, targetSlot: null };
  const candScore = getEquipItemPowerScore(inst, player.class, 'player');
  if (candScore < 0) return { isBetter: false, diffScore: 0, targetSlot: null };

  let candidateSlots = [];
  if (def.type.includes('귀걸이')) candidateSlots = ['earring1', 'earring2'];
  else if (def.type.includes('반지')) candidateSlots = ['ring1', 'ring2'];
  else candidateSlots = [resolveEquipSlotKey(def, player.equip)];

  let compareSlot = candidateSlots[0];
  let worstEquippedScore = Infinity;
  candidateSlots.forEach(sk => {
    const eqIdx = player.equip?.[sk];
    const eqInst = (eqIdx !== null && eqIdx !== undefined) ? player.inventory?.[eqIdx] : null;
    const eqScore = eqInst ? getEquipItemPowerScore(eqInst, player.class, 'player') : 0;
    if (eqScore < worstEquippedScore) {
      worstEquippedScore = eqScore;
      compareSlot = sk;
    }
  });

  const diff = Math.round((candScore - worstEquippedScore) * 10) / 10;
  return {
    isBetter: diff > 0.5,
    diffScore: diff,
    candScore,
    equippedScore: worstEquippedScore === Infinity ? 0 : worstEquippedScore,
    targetSlot: compareSlot
  };
}
window.compareBagItemWithEquipped = compareBagItemWithEquipped;

// 용병 레벨에 따라 자동으로 해금되는 스킬/마법 목록 반환 헬퍼
function getMercUnlockedSkills(mercClass = mercenary.class, mercLv = mercenary.level) {
  const list = SKILLS_DB[mercClass] || [];
  return list.filter(sk => {
    const unlockLv = sk.reqLv || sk.dropMinLv || ((sk.circle || 1) <= 1 ? 1 : ((sk.circle - 1) * 12));
    return mercLv >= unlockLv;
  });
}
window.getMercUnlockedSkills = getMercUnlockedSkills;

function autoEquipMercBestItems(announce = false) {
  if (!mercenary || !mercenary.hired) return [];
  window.migrateAndNormalizeEquip(mercenary.equip, mercenary.inventory);
  const newlyEquippedNames = [];

  const singleSlots = ['weapon', 'shield', 'helmet', 'tshirt', 'armor', 'cloak', 'gloves', 'belt', 'boots', 'necklace'];
  singleSlots.forEach(slotKey => {
    if (slotKey === 'shield' && mercenary.class !== 'knight') {
      mercenary.equip.shield = null;
      return;
    }
    let bestIdx = mercenary.equip[slotKey];
    let bestScore = (bestIdx !== null && bestIdx !== undefined && mercenary.inventory[bestIdx])
      ? getEquipItemPowerScore(mercenary.inventory[bestIdx], mercenary.class, 'mercenary')
      : -1;

    mercenary.inventory.forEach((inst, idx) => {
      if (!inst) return;
      const def = window.itemDict?.[inst.type];
      if (!def || !isItemMatchingSlot(def, slotKey) || !canMercEquipItem(def)) return;
      const sc = getEquipItemPowerScore(inst, mercenary.class, 'mercenary');
      if (sc > bestScore + 0.1) {
        bestScore = sc;
        bestIdx = idx;
      }
    });

    if (bestIdx !== null && bestIdx !== undefined && bestIdx !== mercenary.equip[slotKey] && mercenary.inventory[bestIdx]) {
      mercenary.equip[slotKey] = bestIdx;
      const eqInst = mercenary.inventory[bestIdx];
      const eqDef = window.itemDict?.[eqInst.type];
      if (eqDef) newlyEquippedNames.push(`${eqInst.plus > 0 ? '+' + eqInst.plus + ' ' : ''}${eqDef.name}`);
    }
  });

  // 쌍가락지(ring1, ring2) 및 쌍귀걸이(earring1, earring2) 상위 2개 자동 장착
  [['earring1', 'earring2', '귀걸이'], ['ring1', 'ring2', '반지']].forEach(([s1, s2, typeKeyword]) => {
    const candidates = [];
    mercenary.inventory.forEach((inst, idx) => {
      if (!inst) return;
      const def = window.itemDict?.[inst.type];
      if (!def || !def.type?.includes(typeKeyword)) return;
      candidates.push({ idx, score: getEquipItemPowerScore(inst, mercenary.class, 'mercenary') });
    });
    candidates.sort((a, b) => b.score - a.score);
    const prev1 = mercenary.equip[s1];
    const prev2 = mercenary.equip[s2];
    const next1 = candidates[0] ? candidates[0].idx : null;
    const next2 = candidates[1] ? candidates[1].idx : null;
    if (next1 !== null && next1 !== prev1 && next1 !== prev2) {
      const inst = mercenary.inventory[next1];
      const def = window.itemDict?.[inst.type];
      if (def) newlyEquippedNames.push(`${inst.plus > 0 ? '+' + inst.plus + ' ' : ''}${def.name}`);
    }
    if (next2 !== null && next2 !== prev1 && next2 !== prev2) {
      const inst = mercenary.inventory[next2];
      const def = window.itemDict?.[inst.type];
      if (def) newlyEquippedNames.push(`${inst.plus > 0 ? '+' + inst.plus + ' ' : ''}${def.name}`);
    }
    mercenary.equip[s1] = next1;
    mercenary.equip[s2] = next2;
  });

  syncMercStats(false);
  if (announce && newlyEquippedNames.length > 0) {
    window.addChat(`⚔️ [용병 자동 장착] ${mercenary.name}이(가) 더 좋은 장비(${newlyEquippedNames.join(', ')})를 스스로 착용했습니다!`, 'log-kill');
  }
  return newlyEquippedNames;
}

window.setMercStance = function(newStance) {
  if (!mercenary.hired) return;
  mercenary.stance = newStance;
  if (newStance === 'STANDBY') mercenary.targetMonster = null;
  const labelMap = { ATTACK: '⚔️ 공격(적극교전)', STANDBY: '🛡️ 대기(추종/반격)', SUPPORT: '💚 보조(힐/협공)' };
  window.addChat(`🚩 [용병 스탠스 변경] '${labelMap[newStance] || newStance}' 모드로 전환되었습니다.`, 'log-sys');
  window.updateMercHUD();
  const mercModal = document.getElementById('merc-ui');
  if (mercModal && !mercModal.classList.contains('hidden')) window.renderMercUI();
};

// 아군(용병 / 타 플레이어 / 파티 HUD) 힐·버프 지원 대상 선택기 (전투 몬스터 타겟과 완전 독립!)
window.toggleFriendlyMercTarget = function() {
  if (!mercenary.hired) return;
  if (player.friendlyTarget && player.friendlyTarget.type === 'MERC') {
    player.friendlyTarget = null;
    window.addChat(`💚 [지원 대상 해제] 힐/버프 시전 대상이 '본인(${player.name})'으로 복귀했습니다.`, 'log-sys');
  } else {
    player.friendlyTarget = { type: 'MERC', ref: mercenary, name: mercenary.name };
    window.addChat(`💚 [용병 지원 선택] '${mercenary.name}' 용병이 힐/버프 대상으로 선택되었습니다! (전투 타겟은 유지됨 · 길게 누르면 용병 상태창 오픈)`, 'log-sys');
  }
  window.updateMercHUD();
};

window.partyState = null; // { partyId, leaderCharId, leaderTargetMobId, partyMode: 'FREE'|'FOCUS', members: [...] }
window.partyAutoHuntMode = 'FREE'; // 'FREE' (자유사냥) | 'FOCUS' (점사모드)

window.selectFriendlyOtherPlayer = function(opOrCharId) {
  let op = null;
  let targetId = null;
  let targetName = '동료 모험가';
  if (typeof opOrCharId === 'string') {
    targetId = opOrCharId;
    op = (window.otherPlayers || []).find(o => o && o.charId === targetId);
    const pm = (window.partyState?.members || []).find(m => m && m.charId === targetId);
    if (pm) targetName = pm.name || targetName;
    else if (op) targetName = op.name || targetName;
    if (!op && pm) op = pm;
  } else if (typeof opOrCharId === 'number') {
    op = window.otherPlayers?.[opOrCharId];
    targetId = op?.charId;
    targetName = op?.name || targetName;
  } else if (opOrCharId && typeof opOrCharId === 'object') {
    op = opOrCharId;
    targetId = op.charId;
    targetName = op.name || targetName;
  }
  if (!op && !targetId) return;
  if (targetId === activeCharacterId) {
    player.friendlyTarget = null;
    window.addChat(`💚 [지원 대상] 힐/버프 시전 대상이 '본인(${player.name})'으로 설정되었습니다.`, 'log-sys');
    window.updateMercHUD();
    return;
  }
  if (player.friendlyTarget && player.friendlyTarget.type === 'PLAYER' && (player.friendlyTarget.charId === targetId || player.friendlyTarget.ref === op)) {
    player.friendlyTarget = null;
    window.addChat(`💚 [지원 대상 해제] 힐/버프 시전 대상이 '본인(${player.name})'으로 복귀했습니다.`, 'log-sys');
  } else {
    player.friendlyTarget = { type: 'PLAYER', charId: targetId, ref: op, name: targetName };
    window.addChat(`💚 [파티/아군 지원 선택] '${targetName}'님이 힐/버프 대상으로 선택되었습니다!`, 'log-sys');
  }
  window.updateMercHUD();
};

let _partyHudPressTimer = null;
let _partyHudLongPressed = false;

window.onPartyHudPointerDown = function(ev, charId, isLeaderCard) {
  if (ev) ev.stopPropagation();
  if (ev && ev.button && ev.button !== 0) return;
  _partyHudLongPressed = false;
  clearTimeout(_partyHudPressTimer);
  _partyHudPressTimer = setTimeout(() => {
    _partyHudLongPressed = true;
    // 파티장 HUD를 길게 누르면 파티 설정/제어 윈도우창 오픈!
    window.openPartyControlModal();
  }, 420);
};

window.onPartyHudPointerUp = function(ev, charId, isLeaderCard) {
  if (ev) ev.stopPropagation();
  if (ev && ev.button && ev.button !== 0) return;
  clearTimeout(_partyHudPressTimer);
  if (!_partyHudLongPressed) {
    window.selectFriendlyOtherPlayer(charId);
  }
};

window.onPartyHudCancel = function() {
  clearTimeout(_partyHudPressTimer);
};

window.openPartyControlModal = function() {
  let modal = document.getElementById('party-control-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'party-control-modal';
    modal.className = 'modal-panel hidden';
    modal.style.cssText = 'width:min(92vw, 325px); z-index:9200; background:rgba(15, 18, 26, 0.97); border:2px solid #38bdf8;';
    document.getElementById('game-wrapper')?.appendChild(modal);
    makeDraggable('party-control-modal');
  }
  window.renderPartyControlModal();
  modal.classList.remove('hidden');
  window.bringModalToFront?.(modal);
  window.centerModalOnScreen?.(modal);
};

window.closePartyControlModal = function() {
  document.getElementById('party-control-modal')?.classList.add('hidden');
};

window.requestQuickPartyWith = function(targetName) {
  if (!targetName) return;
  sendCentralWsPacket({
    type: 'CHAT_MSG',
    charId: activeCharacterId,
    mapKey: currentMapKey,
    regionKey: currentRegionKey,
    sender: player.name,
    text: `/파티초대 ${targetName}`
  });
};

window.requestClaimPartyLeader = function() {
  if (!window.partyState) {
    window.addChat(`⚠️ 현재 가입된 파티가 없습니다.`, 'log-hit');
    return;
  }
  if (window.partyState.leaderCharId === activeCharacterId) {
    window.addChat(`👑 이미 현재 파티의 파티장입니다!`, 'log-sys');
    return;
  }
  sendCentralWsPacket({
    type: 'PARTY_CLAIM_LEADER_REQ',
    charId: activeCharacterId
  });
};

window.setPartyAutoHuntMode = function(mode) {
  if (!['FREE', 'FOCUS'].includes(mode)) return;
  window.partyAutoHuntMode = mode;
  if (window.partyState) {
    window.partyState.partyMode = mode;
    sendCentralWsPacket({
      type: 'PARTY_MODE_REQ',
      charId: activeCharacterId,
      partyMode: mode
    });
  }
  window.addChat(
    mode === 'FOCUS'
      ? `🎯 [파티 점사모드] 파티장이 타겟한 몬스터를 집중 공격합니다!`
      : `🏃 [파티 자유사냥] 파티장 근처에서 자유 사냥하며, 몬스터가 없으면 파티장 근처로 이동합니다!`,
    'log-sys'
  );
  window.renderPartyControlModal();
  window.updateMercHUD();
};

window.requestPartyLeave = function() {
  sendCentralWsPacket({ type: 'PARTY_LEAVE_REQ', charId: activeCharacterId });
  window.partyState = null;
  if (player) {
    player.partyId = null;
    player.isPartyLeader = false;
  }
  window.closePartyControlModal();
  window.updateMercHUD();
};

window.requestPartyDelegate = function(targetCharId) {
  if (!window.partyState || window.partyState.leaderCharId !== activeCharacterId) {
    window.addChat(`⚠️ 파티장만 파티장 권한을 위임할 수 있습니다.`, 'log-hit');
    return;
  }
  sendCentralWsPacket({
    type: 'PARTY_DELEGATE_REQ',
    charId: activeCharacterId,
    targetCharId
  });
  window.closePartyControlModal();
};

window.renderPartyControlModal = function() {
  const modal = document.getElementById('party-control-modal');
  if (!modal) return;

  const nearbyPlayers = (window.otherPlayers || [])
    .filter(op => op && op.name && op.charId !== activeCharacterId && (!window.partyState || !(window.partyState.members || []).some(m => m.charId === op.charId)))
    .slice(0, 6);

  const nearbyHtml = nearbyPlayers.length > 0
    ? nearbyPlayers.map(op => {
        const hasPty = Boolean(op.partyId);
        return `
          <div class="shop-row" style="padding:4px 6px; border-color:#374151;">
            <div style="font-size:10px; color:#e5e7eb;">
              <b>${op.name}</b> <span style="color:#93c5fd;">Lv.${op.level || 1}</span>
              <span style="color:${hasPty ? '#fde047' : '#9ca3af'}; font-size:8.5px;">${hasPty ? '[🎗️파티중]' : '[솔로]'}</span>
            </div>
            <button class="shop-buy-btn" style="padding:2px 6px; font-size:9.5px; background:#0284c7; border-color:#38bdf8;" onclick="requestQuickPartyWith('${op.name}')">
              📩 ${hasPty ? '파티합류/요청' : '파티초대'}
            </button>
          </div>
        `;
      }).join('')
    : `<div style="color:#9ca3af; font-size:9.5px; text-align:center; padding:6px;">주변 시야에 다른 모험가가 없습니다.</div>`;

  if (!window.partyState) {
    modal.innerHTML = `
      <div class="modal-header drag-handle" style="background:linear-gradient(90deg, #0c4a6e, #1e293b, #0c4a6e); border-bottom-color:#38bdf8;">
        🎗️ 파티 결성 · 주변 파티 합류 <button class="help-q-btn" onclick="showHelpModal('party', event)">?</button>
      </div>
      <button class="close-x-btn" onclick="closePartyControlModal()">✖</button>
      <div style="display:flex; flex-direction:column; gap:6px; padding:4px; font-size:10.5px;">
        <div style="background:#111827; border:1px solid #374151; border-radius:6px; padding:6px;">
          <div style="color:#fde047; font-weight:bold; margin-bottom:4px;">👥 주변 모험가 및 파티 합류 요청</div>
          <div style="color:#9ca3af; font-size:9px; margin-bottom:4px;">※ 이미 파티 중인 에이전트에게 요청해도 즉시 해당 파티에 합류할 수 있습니다!</div>
          <div style="display:flex; flex-direction:column; gap:3px; max-height:170px; overflow-y:auto;">
            ${nearbyHtml}
          </div>
        </div>
      </div>
    `;
    return;
  }

  const p = window.partyState;
  const isMeLeader = p.leaderCharId === activeCharacterId;
  const curMode = window.partyAutoHuntMode || p.partyMode || 'FREE';

  const membersHtml = (p.members || []).map((m, idx) => {
    const isLdr = m.charId === p.leaderCharId;
    const isMe = m.charId === activeCharacterId;
    return `
      <div class="shop-row" style="padding:4px 6px; border-color:${isLdr ? '#facc15' : '#374151'};">
        <div style="font-size:10.5px; color:#e5e7eb;">
          <b>${isLdr ? '👑' : `${idx + 1}.`} ${m.name}</b> <span style="color:#93c5fd;">Lv.${m.level || 1}</span>
          ${isMe ? '<span style="color:#4ade80; font-size:9px;">(나)</span>' : ''}
        </div>
        <div>
          ${(isMeLeader && !isMe)
            ? `<button class="shop-buy-btn" style="padding:2px 6px; font-size:9.5px; background:#b45309; border-color:#facc15;" onclick="requestPartyDelegate('${m.charId}')">👑 파티장위임</button>`
            : (isLdr ? `<span style="font-size:9.5px; color:#fde047; font-weight:bold;">파티장</span>` : `<span style="font-size:9px; color:#9ca3af;">파티원</span>`)}
        </div>
      </div>
    `;
  }).join('');

  modal.innerHTML = `
    <div class="modal-header drag-handle" style="background:linear-gradient(90deg, #0c4a6e, #1e293b, #0c4a6e); border-bottom-color:#38bdf8;">
      🎗️ 파티 설정 · 전술 제어 <button class="help-q-btn" onclick="showHelpModal('party', event)">?</button>
    </div>
    <button class="close-x-btn" onclick="closePartyControlModal()">✖</button>
    <div style="display:flex; flex-direction:column; gap:6px; padding:4px; font-size:10.5px;">
      <div style="background:#111827; border:1px solid #374151; border-radius:6px; padding:6px;">
        <div style="color:#38bdf8; font-weight:bold; margin-bottom:4px;">⚔️ 자동사냥 시 파티모드 선택</div>
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:4px;">
          <button class="shop-buy-btn" style="padding:5px 4px; font-size:10px; ${curMode === 'FREE' ? 'background:#065f46; border-color:#34d399; color:#ecfdf5;' : 'background:#1f2937; border-color:#4b5563; color:#9ca3af;'}" onclick="setPartyAutoHuntMode('FREE')">
            🏃 자유사냥 (근처유지)
          </button>
          <button class="shop-buy-btn" style="padding:5px 4px; font-size:10px; ${curMode === 'FOCUS' ? 'background:#991b1b; border-color:#f87171; color:#fef2f2;' : 'background:#1f2937; border-color:#4b5563; color:#9ca3af;'}" onclick="setPartyAutoHuntMode('FOCUS')">
            🎯 점사모드 (타겟집중)
          </button>
        </div>
      </div>

      <div style="background:#111827; border:1px solid #374151; border-radius:6px; padding:6px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
          <span style="color:#fde047; font-weight:bold;">👥 파티원 목록 (${(p.members || []).length}/5)</span>
          ${!isMeLeader ? `<button class="shop-buy-btn" style="padding:2px 7px; font-size:9.5px; background:#b45309; border-color:#facc15; color:#fff; font-weight:bold;" onclick="requestClaimPartyLeader()">👑 파티장 요구</button>` : ''}
        </div>
        <div style="display:flex; flex-direction:column; gap:3px;">
          ${membersHtml}
        </div>
      </div>

      ${(p.members || []).length < 5 ? `
      <div style="background:#111827; border:1px solid #374151; border-radius:6px; padding:6px;">
        <div style="color:#93c5fd; font-weight:bold; margin-bottom:4px;">📩 주변 모험가 추가 초대</div>
        <div style="display:flex; flex-direction:column; gap:3px; max-height:95px; overflow-y:auto;">
          ${nearbyHtml}
        </div>
      </div>` : ''}

      <div style="display:flex; gap:5px;">
        ${!isMeLeader ? `<button class="auth-primary-btn" style="flex:1; padding:6px; font-size:10.5px; background:#b45309; border-color:#facc15;" onclick="requestClaimPartyLeader()">👑 파티장 요구</button>` : ''}
        <button class="auth-danger-btn" style="flex:1; padding:6px; font-size:10.5px;" onclick="requestPartyLeave()">🚪 파티 탈퇴</button>
      </div>
    </div>
  `;
};

let _partyInviteExpireTimer = null;
let _partyInviteCountdownInterval = null;

function clearPartyInviteTimers() {
  if (_partyInviteExpireTimer) {
    clearTimeout(_partyInviteExpireTimer);
    _partyInviteExpireTimer = null;
  }
  if (_partyInviteCountdownInterval) {
    clearInterval(_partyInviteCountdownInterval);
    _partyInviteCountdownInterval = null;
  }
}

window.showPartyInvitePopup = function(msg) {
  clearPartyInviteTimers();

  // 파티 요청이 도착해도 자동사냥이 절대 풀리거나 멈추지 않도록 보장!
  if (window.isAutoAttack && typeof player !== 'undefined' && player) {
    player.manualMoving = false;
  }

  let pop = document.getElementById('party-invite-popup');
  if (!pop) {
    pop = document.createElement('div');
    pop.id = 'party-invite-popup';
    pop.style.cssText = 'position:fixed; top:56px; left:50%; transform:translateX(-50%); z-index:9600; width:min(88vw, 290px); background:rgba(15, 23, 42, 0.96); border:2px solid #38bdf8; border-radius:8px; padding:10px; box-shadow:0 8px 25px rgba(0,0,0,0.9); color:#fff; pointer-events:auto;';
    document.body.appendChild(pop);
  }

  let remainSec = 10;
  pop.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
      <span style="font-size:12px; font-weight:bold; color:#38bdf8;">🎗️ 파티 초대 도착</span>
      <span id="party-invite-countdown" style="font-size:10px; font-weight:bold; color:#fde047; background:rgba(0,0,0,0.55); padding:1px 6px; border-radius:999px;">⏳ ${remainSec}초 후 닫힘</span>
    </div>
    <div style="font-size:11px; color:#e5e7eb; margin-bottom:8px;">
      <b style="color:#fde047;">${msg.inviterName}</b> (Lv.${msg.inviterLevel || 1})님이 파티에 초대했습니다.
    </div>
    <div style="display:flex; gap:6px;">
      <button class="auth-sub-btn" style="flex:1; padding:5px;" onclick="respondPartyInvite('${msg.inviterCharId}', false)">거절</button>
      <button class="auth-primary-btn" style="flex:1; padding:5px;" onclick="respondPartyInvite('${msg.inviterCharId}', true)">수락</button>
    </div>
  `;
  pop.style.display = 'block';

  _partyInviteCountdownInterval = setInterval(() => {
    remainSec = Math.max(0, remainSec - 1);
    const cdEl = document.getElementById('party-invite-countdown');
    if (cdEl) cdEl.innerText = `⏳ ${remainSec}초 후 닫힘`;
  }, 1000);

  // 10초 이상 반응이 없으면 수락창 자동 닫기 (자동사냥은 그대로 계속 진행!)
  _partyInviteExpireTimer = setTimeout(() => {
    clearPartyInviteTimers();
    const curPop = document.getElementById('party-invite-popup');
    if (curPop && curPop.style.display !== 'none') {
      curPop.style.display = 'none';
      if (window.isAutoAttack && typeof player !== 'undefined' && player) {
        player.manualMoving = false;
      }
      sendCentralWsPacket({
        type: 'PARTY_INVITE_RESP',
        charId: activeCharacterId,
        inviterCharId: msg.inviterCharId,
        accept: false,
        isTimeout: true
      });
      window.addChat?.(`⌛ [파티 초대 만료] 10초 동안 응답이 없어 '${msg.inviterName}'님의 파티 초대창을 자동으로 닫았습니다.`, 'log-sys');
    }
  }, 10000);
};

window.respondPartyInvite = function(inviterCharId, accept) {
  clearPartyInviteTimers();
  const pop = document.getElementById('party-invite-popup');
  if (pop) pop.style.display = 'none';
  if (window.isAutoAttack && typeof player !== 'undefined' && player) {
    player.manualMoving = false;
  }
  sendCentralWsPacket({
    type: 'PARTY_INVITE_RESP',
    charId: activeCharacterId,
    inviterCharId,
    accept: Boolean(accept)
  });
};

let _lastRegHudTxt = '';
let _lastPartyHudHtml = '';
let _lastMercHudSig = '';
let _lastMercTitleKey = '';

window.updateMercHUD = function() {
  const regEl = document.getElementById('current-region-hud');
  if (regEl) {
    const reg = GameDB.Regions.find(r => r.id === currentRegionKey) || GameDB.Regions[0];
    const isDung = currentMapKey.endsWith('_dungeon');
    const nextRegTxt = `📍 ${reg.name} ${isDung ? '[던전]' : `(${reg.lvRange})`}`;
    if (_lastRegHudTxt !== nextRegTxt) {
      _lastRegHudTxt = nextRegTxt;
      regEl.innerText = nextRegTxt;
    }
  }

  // 🎗️ 용병 HUD 바로 밑에 오직 '내 파티원 HUD(체력/마나)'만 표시 (변경 시에만 DOM 갱신하여 렉 원천 차단!)
  const pHud = document.getElementById('party-hud');
  if (pHud) {
    if (window.partyState && Array.isArray(window.partyState.members) && window.partyState.members.length > 0) {
      if (pHud.style.display !== 'flex') pHud.style.display = 'flex';
      const curMode = window.partyAutoHuntMode || window.partyState.partyMode || 'FREE';
      const modeBadge = curMode === 'FOCUS' ? '🎯점사' : '🏃자유';
      const nextPartyHtml = window.partyState.members.map((pm) => {
        const liveOp = pm.charId === activeCharacterId
          ? player
          : ((window.otherPlayers || []).find(o => o && o.charId === pm.charId) || pm);
        const isLeader = pm.charId === window.partyState.leaderCharId;
        const isSel = player.friendlyTarget?.type === 'PLAYER' && (player.friendlyTarget.charId === pm.charId || player.friendlyTarget.ref === liveOp);
        const hpVal = Math.ceil(liveOp.hp ?? pm.hp ?? 100);
        const maxHpVal = Math.max(1, liveOp.maxHp || pm.maxHp || 100);
        const mpVal = Math.ceil(liveOp.mp ?? pm.mp ?? 50);
        const maxMpVal = Math.max(1, liveOp.maxMp || pm.maxMp || 50);
        const hpPct = Math.round(Math.max(0, Math.min(100, (hpVal / maxHpVal) * 100)));
        const mpPct = Math.round(Math.max(0, Math.min(100, (mpVal / maxMpVal) * 100)));
        const borderCol = isSel ? '#4ade80' : (isLeader ? '#facc15' : '#38bdf8');
        return `
          <div onpointerdown="onPartyHudPointerDown(event, '${pm.charId}', ${isLeader})"
               onpointerup="onPartyHudPointerUp(event, '${pm.charId}', ${isLeader})"
               onpointerleave="onPartyHudCancel()"
               onpointercancel="onPartyHudCancel()"
               oncontextmenu="event.preventDefault(); openPartyControlModal();"
               title="터치: 힐/버프 대상 선택 | 길게 누르기: 파티 설정창 열기"
               style="background:rgba(15,20,28,0.93); border:1.5px solid ${borderCol}; box-shadow:${isSel ? '0 0 8px rgba(74,222,128,0.85)' : '0 2px 6px rgba(0,0,0,0.8)'}; border-radius:5px; padding:3px 4px; cursor:pointer; font-size:8.5px; color:#e5e7eb; user-select:none;">
            <div style="display:flex; justify-content:space-between; align-items:center; font-weight:bold;">
              <span style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:58px; color:${isLeader ? '#fde047' : '#e5e7eb'};">${isLeader ? '👑' : '🎗️'}${pm.name}</span>
              <span style="font-size:7.5px; color:${isSel ? '#4ade80' : '#93c5fd'};">${isSel ? '🎯지원' : (isLeader ? modeBadge : `Lv.${liveOp.level || pm.level || 1}`)}</span>
            </div>
            <div class="merc-bar-bg" style="height:5px; margin-top:2px;">
              <div class="merc-bar-fill-hp" style="width:${hpPct}%;"></div>
            </div>
            <div class="merc-bar-bg" style="height:4px; margin-top:1px;">
              <div class="merc-bar-fill-mp" style="width:${mpPct}%;"></div>
            </div>
          </div>
        `;
      }).join('');
      if (_lastPartyHudHtml !== nextPartyHtml) {
        _lastPartyHudHtml = nextPartyHtml;
        pHud.innerHTML = nextPartyHtml;
      }
    } else if (_lastPartyHudHtml !== '') {
      _lastPartyHudHtml = '';
      pHud.style.display = 'none';
      pHud.innerHTML = '';
    }
  }

  const mHud = document.getElementById('merc-hud');
  if (!mHud) return;
  if (!mercenary.hired) {
    if (_lastMercHudSig !== 'unhired') {
      _lastMercHudSig = 'unhired';
      mHud.style.display = 'none';
    }
    return;
  }

  const isMercSelectedForBuff = Boolean(player.friendlyTarget && player.friendlyTarget.type === 'MERC');
  const hpCeil = Math.ceil(mercenary.hp);
  const mpCeil = Math.ceil(mercenary.mp);
  const nextMercSig = `${mercenary.class}|${mercenary.name}|${mercenary.isDead?1:0}|${mercenary.manaRechargeWait?1:0}|${mercenary.stance}|${hpCeil}/${mercenary.maxHp}|${mpCeil}/${mercenary.maxMp}|${isMercSelectedForBuff?1:0}`;
  if (_lastMercHudSig === nextMercSig) return;
  _lastMercHudSig = nextMercSig;

  if (mHud.style.display !== 'flex') mHud.style.display = 'flex';
  mHud.style.borderColor = isMercSelectedForBuff ? '#4ade80' : '#60a5fa';
  mHud.style.boxShadow = isMercSelectedForBuff
    ? '0 0 12px rgba(74, 222, 128, 0.85), inset 0 0 6px rgba(74, 222, 128, 0.35)'
    : '0 2px 8px rgba(0,0,0,0.85)';

  const hintEl = document.getElementById('merc-hud-ally-hint');
  if (hintEl) {
    hintEl.innerHTML = isMercSelectedForBuff
      ? `<span style="color:#4ade80; font-weight:bold;">🎯 힐/버프 지원대상 (홀드:창)</span>`
      : `터치:힐/버프 | 홀드:상태창`;
  }

  const meta = MERC_CLASS_META[mercenary.class] || MERC_CLASS_META.knight;
  const titleEl = document.getElementById('merc-hud-title');
  const stanceEl = document.getElementById('merc-hud-stance');
  const hpBar = document.getElementById('merc-hud-hp-bar');
  const hpTxt = document.getElementById('merc-hud-hp-txt');
  const mpBar = document.getElementById('merc-hud-mp-bar');
  const mpTxt = document.getElementById('merc-hud-mp-txt');

  const titleKey = `${mercenary.class}|${mercenary.name}`;
  if (titleEl && _lastMercTitleKey !== titleKey) {
    _lastMercTitleKey = titleKey;
    titleEl.innerHTML = `${window.getClassIconHTML ? window.getClassIconHTML(mercenary.class, 13) : meta.icon} <span>${normalizeMercenaryDisplayName(mercenary.name, mercenary.class).split(' ').pop()}</span>`;
  }
  if (stanceEl) {
    if (mercenary.isDead) {
      stanceEl.innerText = '💀사망';
      stanceEl.style.background = '#7f1d1d';
      stanceEl.style.color = '#fca5a5';
    } else if (mercenary.manaRechargeWait) {
      stanceEl.innerText = '💧MP충전';
      stanceEl.style.background = '#1e3a8a';
      stanceEl.style.color = '#93c5fd';
    } else if (mercenary.stance === 'ATTACK') {
      stanceEl.innerText = '공격';
      stanceEl.style.background = '#991b1b';
      stanceEl.style.color = '#fecaca';
    } else if (mercenary.stance === 'STANDBY') {
      stanceEl.innerText = '대기';
      stanceEl.style.background = '#1e3a8a';
      stanceEl.style.color = '#bfdbfe';
    } else {
      stanceEl.innerText = '보조';
      stanceEl.style.background = '#065f46';
      stanceEl.style.color = '#6ee7b7';
    }
  }

  const hpPct = mercenary.isDead ? 0 : Math.max(0, Math.min(100, (mercenary.hp / mercenary.maxHp) * 100));
  const mpPct = mercenary.isDead ? 0 : Math.max(0, Math.min(100, (mercenary.mp / mercenary.maxMp) * 100));
  if (hpBar) hpBar.style.width = `${hpPct}%`;
  if (hpTxt) hpTxt.innerText = mercenary.isDead ? '사망 (부활필요)' : `${hpCeil}/${mercenary.maxHp}`;
  if (mpBar) mpBar.style.width = `${mpPct}%`;
  if (mpTxt) mpTxt.innerText = `${mpCeil}/${mercenary.maxMp}`;
};

let selectedMercInvIdx = null;
let lastMercSlotTapTime = 0;
let lastMercSlotTapIdx = -1;
let lastMercEquipTapTime = 0;
let lastMercEquipTapIdx = -1;

window.onMercEquipSlotTap = function(eqIdx) {
  let now = Date.now();
  const dt = now - lastMercEquipTapTime;
  if (lastMercEquipTapIdx === eqIdx && dt < 65) return;
  if (lastMercEquipTapIdx === eqIdx && dt >= 65 && dt < 300) {
    // 더블 탭 성공 시 장착 해제
    window.mercItemAction(eqIdx, 'equipOrUse');
    lastMercEquipTapIdx = -1;
    lastMercEquipTapTime = 0;
  } else {
    // 싱글 탭
    lastMercEquipTapIdx = eqIdx;
    lastMercEquipTapTime = now;
    window.addChat(`💡 더블 터치하여 장착을 해제하세요.`, 'log-sys');
  }
};



window.toggleMercUI = function() {
  ensureAllGameModals();
  const ui = document.getElementById('merc-ui');
  if (!ui) return;
  if (!mercenary.hired) {
    window.addChat(`💡 [용병 안내] 마을(S) 또는 야영지(S1)의 '용병단장 카셀'에게서 용병을 고용할 수 있습니다!`, 'log-sys');
    return;
  }
  ui.classList.toggle('hidden');
  if (!ui.classList.contains('hidden')) {
    window.bringModalToFront?.(ui);
    window.renderMercUI();
    window.centerModalOnScreen?.(ui);
  }
};

window.giveSelectedToMerc = function() {
  if (!mercenary.hired) {
    window.addChat(`⚠️ 먼저 용병단장에게 용병을 고용해주세요!`, 'log-hit');
    return;
  }
  if (selectedInvIndices.size === 0) {
    window.addChat(`⚠️ 가방에서 용병에게 전달할 아이템(장비/물약)을 먼저 터치해 선택하세요.`, 'log-hit');
    return;
  }

  const playerEquipped = new Set(Object.values(player.equip).filter(v => v !== null && v !== undefined).map(Number));
  let transferred = 0;

  selectedInvIndices.forEach(idx => {
    const inst = player.inventory[idx];
    if (!inst) return;
    if (playerEquipped.has(Number(idx))) {
      window.addChat(`⚠️ 장착 중인 장비는 먼저 해제한 뒤 용병에게 전달할 수 있습니다.`, 'log-hit');
      return;
    }
    const def = window.itemDict[inst.type];
    const isEquip = def && ['한손검', '양손활', '양손지팡이', '방패', '투구', '갑옷', '장갑', '망토', '신발', '반지', '목걸이', '귀걸이', '티셔츠', '벨트'].some(t => def.type?.includes(t));

    if (isEquip) {
      const saved = giveItemToMerc(inst.type, 1, inst);
      if (saved) {
        player.inventory[idx] = null;
        transferred++;
        autoEquipMercBestItems(true);
      }
    } else {
      const giveQty = Math.min(inst.qty, 10);
      const saved = giveItemToMerc(inst.type, giveQty);
      if (saved) {
        inst.qty -= giveQty;
        if (inst.qty <= 0) player.inventory[idx] = null;
        transferred++;
      }
    }
  });

  selectedInvIndices.clear();
  if (transferred > 0) {
    window.addChat(`🤝 [아이템 전달] 용병(${mercenary.name})에게 선택한 아이템을 전달했습니다!`, 'log-sys');
    renderHotbarSlots();
    renderInventory();
    if (!document.getElementById('merc-ui').classList.contains('hidden')) window.renderMercUI();
  }
};

// 용병 착용 슬롯/인벤토리 장착·해제·회수 (해제 후 재착용 안 되던 버그 완벽 수정!)
window.mercItemAction = function(rawMercIdx, mode = 'equipOrUse') {
  const mercIdx = Number(rawMercIdx);
  if (Number.isNaN(mercIdx)) return;
  const inst = mercenary.inventory[mercIdx];
  if (!inst) return;
  const def = window.itemDict[inst.type];
  if (!def) return;

  const isCurrentlyEquipped = Object.keys(mercenary.equip).some(k => mercenary.equip[k] !== null && Number(mercenary.equip[k]) === mercIdx);

  if (mode === 'returnToPlayer') {
    if (isCurrentlyEquipped) {
      Object.keys(mercenary.equip).forEach(k => {
        if (mercenary.equip[k] !== null && Number(mercenary.equip[k]) === mercIdx) mercenary.equip[k] = null;
      });
    }
    const saved = giveItem(inst.type, inst.qty || 1, inst.gradeIdx ?? null, inst);
    if (saved) {
      mercenary.inventory[mercIdx] = null;
      if (selectedMercInvIdx === mercIdx) selectedMercInvIdx = null;
      syncMercStats(false);
      window.addChat(`🎒 [아이템 회수] 용병에게서 '${def.name}' 아이템을 플레이어 가방으로 가져왔습니다.`, 'log-sys');
      window.updateMercHUD();
      window.renderMercUI();
      if (!document.getElementById('inventory-ui').classList.contains('hidden')) renderInventory();
    } else {
      window.addChat(`⚠️ 플레이어 가방에 빈 공간이 없습니다!`, 'log-hit');
    }
    return;
  }

  const isEquip = ['한손검', '양손활', '양손지팡이', '방패', '투구', '갑옷', '장갑', '망토', '신발', '반지', '목걸이', '귀걸이', '티셔츠', '벨트'].some(t => def.type?.includes(t));
  if (isEquip) {
    if (isCurrentlyEquipped) {
      Object.keys(mercenary.equip).forEach(k => {
        if (mercenary.equip[k] !== null && Number(mercenary.equip[k]) === mercIdx) mercenary.equip[k] = null;
      });
      selectedMercInvIdx = mercIdx; // 해제한 아이템을 바로 선택 상태로 유지해 원클릭 재착용 지원
      window.addChat(`🛡️ [용병 장비 해제] '${def.name}' 장착을 해제했습니다. (다시 터치하거나 [장착하기]를 누르면 재장착됩니다)`, 'log-sys');
    } else {
      if (!canMercEquipItem(def)) {
        window.addChat(`⚠️ [용병 장착 불가] ${MERC_CLASS_META[mercenary.class].roleName} 용병은 '${def.name}' 무기를 착용할 수 없습니다!`, 'log-hit');
        return;
      }
      const slotName = resolveEquipSlotKey(def, mercenary.equip);
      mercenary.equip[slotName] = mercIdx;
      selectedMercInvIdx = mercIdx;
      const plusTxt = inst.plus > 0 ? `+${inst.plus} ` : '';
      window.addChat(`⚔️ [용병 장비 장착] 용병이 '${plusTxt}${def.name}'을(를) 착용했습니다!`, 'log-kill');
    }
    syncMercStats(false);
    window.updateMercHUD();
    window.renderMercUI();
  } else if (inst.type === 'S_WE01' || inst.type === 'S_AR01') {
    window.mercEnchantScrollType = { scrollIdx: mercIdx, type: inst.type, fromMercBag: true };
    window.addChat(`✨ [용병 장비 인챈트 대기] 용병 가방에서 강화할 ${inst.type === 'S_WE01' ? '무기(+6 안전)' : '방어구·장신구(+4 안전)'}를 터치하세요!`, 'log-sys');
    window.renderMercUI();
  } else if (inst.type.startsWith('C_P')) {
    useMercPotionIndex(mercIdx);
    window.renderMercUI();
  }
};

// 용병 전용 장비 인챈트 실행기 (용병 가방의 주문서 우선 소모, 없으면 플레이어 가방 주문서 사용 가능)
window.enchantMercItem = function(rawTargetIdx, scrollType) {
  const targetIdx = Number(rawTargetIdx);
  const targetItem = mercenary.inventory[targetIdx];
  if (!targetItem) return;
  const iData = window.itemDict[targetItem.type];
  if (!iData) return;

  const isWeapon = iData.type.includes('검') || iData.type.includes('활') || iData.type.includes('지팡이');
  const isArmorOrAcc = ['갑옷', '방패', '투구', '장갑', '신발', '망토', '벨트', '티셔츠', '목걸이', '귀걸이', '반지'].some(t => iData.type.includes(t));
  const reqScroll = scrollType || (isWeapon ? 'S_WE01' : 'S_AR01');

  if ((reqScroll === 'S_WE01' && !isWeapon) || (reqScroll === 'S_AR01' && !isArmorOrAcc)) {
    window.addChat(`⚠️ [용병 인챈트 취소] 주문서 종류와 대상 장비가 일치하지 않습니다.`, 'log-hit');
    window.mercEnchantScrollType = null;
    return;
  }

  // 1순위: 용병 가방에서 주문서 탐색, 2순위: 플레이어 가방에서 주문서 탐색
  let mScrollIdx = mercenary.inventory.findIndex(it => it && it.type === reqScroll && it.qty > 0);
  let pScrollIdx = -1;
  if (mScrollIdx === -1) {
    pScrollIdx = player.inventory.findIndex(it => it && it.type === reqScroll && it.qty > 0);
  }
  if (mScrollIdx === -1 && pScrollIdx === -1) {
    window.addChat(`⚠️ [주문서 부족] 용병 가방 또는 내 가방에 '${window.itemDict[reqScroll]?.name || '마법 주문서'}'가 없습니다!`, 'log-hit');
    window.mercEnchantScrollType = null;
    return;
  }

  if (mScrollIdx > -1) {
    mercenary.inventory[mScrollIdx].qty--;
    if (mercenary.inventory[mScrollIdx].qty <= 0) mercenary.inventory[mScrollIdx] = null;
  } else {
    player.inventory[pScrollIdx].qty--;
    if (player.inventory[pScrollIdx].qty <= 0) player.inventory[pScrollIdx] = null;
  }
  window.mercEnchantScrollType = null;

  const safeLimit = isWeapon ? 6 : 4;
  const curPlus = getItemPlusValue(targetItem, isWeapon ? 'weapon' : 'armor', 'mercenary');
  const successRate = getEnchantSuccessChance(curPlus, safeLimit);

  if (Math.random() * 100 < successRate) {
    targetItem.plus = curPlus + 1;
    SoundSystem.playSkill('인챈트 스탯', 'wizard', 2, false);
    activeEffects.push({ type: 'buff', x: mercenary.x, y: mercenary.y, life: 30, maxLife: 30, skillName: '인챈트 스탯' });
    floatingTexts.push({ x: mercenary.x, y: mercenary.y - 52, text: `✨용병강화 +${targetItem.plus}!`, color: 0xfacc15, life: 40 });
    window.broadcastMultiplayerActionFx?.('enchant', { isMerc: true, success: true, plus: targetItem.plus, x: Math.round(mercenary.x), y: Math.round(mercenary.y) });
    window.addChat(`✨ [용병 인챈트 성공!] 용병의 '${iData.name}' 강화 수치가 +${targetItem.plus}(으)로 상승했습니다! (확률 ${successRate}%)`, 'log-kill');
  } else {
    targetItem.plus = Math.max(0, curPlus - 1);
    SoundSystem.playPhysicalHit('knight', 'hit');
    floatingTexts.push({ x: mercenary.x, y: mercenary.y - 52, text: `💔강화실패 (+${targetItem.plus})`, color: 0xf87171, life: 40 });
    window.broadcastMultiplayerActionFx?.('enchant', { isMerc: true, success: false, plus: targetItem.plus, x: Math.round(mercenary.x), y: Math.round(mercenary.y) });
    window.addChat(`💔 [용병 인챈트 실패] 안전 구간(+${safeLimit}) 초과 강화에 실패하여 '${iData.name}' 수치가 +${curPlus} -> +${targetItem.plus}(으)로 감소했습니다.`, 'log-hit');
  }

  syncMercStats(false);
  window.updateMercHUD();
  renderHotbarSlots();
  if (!document.getElementById('inventory-ui').classList.contains('hidden')) renderInventory();
  selectedMercInvIdx = targetIdx;
  window.renderMercUI();
};

window.quickSupplyMercPotions = function() {
  if (!mercenary.hired) return;
  let supplied = 0;
  ['C_P01', 'C_P02', 'C_P03', 'C_P04', 'C_P05'].forEach(pId => {
    for (let i = 0; i < player.inventory.length; i++) {
      const it = player.inventory[i];
      if (!it || it.type !== pId || it.qty <= 0) continue;
      const moveCnt = Math.min(it.qty, pId === 'C_P05' ? 3 : 15);
      if (giveItemToMerc(pId, moveCnt)) {
        it.qty -= moveCnt;
        if (it.qty <= 0) player.inventory[i] = null;
        supplied += moveCnt;
        break;
      }
    }
  });
  if (supplied > 0) {
    window.addChat(`🧪 [물약 자동 보급] 플레이어 가방에서 물약 ${supplied}개를 가져와 용병 가방으로 보급했습니다!`, 'log-sys');
    renderHotbarSlots();
    if (!document.getElementById('inventory-ui').classList.contains('hidden')) renderInventory();
    window.renderMercUI();
    window.triggerAutoSave?.('merc_supply_pot', false);
  } else {
    window.addChat(`⚠️ 플레이어 가방에 용병에게 전달할 물약이 없거나 용병 가방이 가득 찼습니다.`, 'log-hit');
  }
};

// 🎁 플레이어 가방에 있는 미장착 장비 중 현재 용병 착용 장비보다 더 좋은 장비를 모두 가져와 즉시 장착!
window.quickSupplyMercBestEquipFromPlayer = function() {
  if (!mercenary.hired) return;
  window.migrateAndNormalizeEquip(mercenary.equip, mercenary.inventory);
  const playerEquipped = new Set(Object.values(player.equip || {}).filter(v => v !== null && v !== undefined).map(Number));
  const suppliedNames = [];

  const singleSlots = ['weapon', 'shield', 'helmet', 'tshirt', 'armor', 'cloak', 'gloves', 'belt', 'boots', 'necklace'];
  singleSlots.forEach(slotKey => {
    if (slotKey === 'shield' && mercenary.class !== 'knight') return;
    const curMercEqIdx = mercenary.equip[slotKey];
    const curMercInst = (curMercEqIdx !== null && curMercEqIdx !== undefined) ? mercenary.inventory[curMercEqIdx] : null;
    let bestScore = curMercInst ? getEquipItemPowerScore(curMercInst, mercenary.class, 'mercenary') : -1;
    let bestPlayerInvIdx = -1;

    player.inventory.forEach((inst, pIdx) => {
      if (!inst || playerEquipped.has(pIdx)) return;
      const def = window.itemDict?.[inst.type];
      if (!def || !isItemMatchingSlot(def, slotKey) || !canMercEquipItem(def)) return;
      const sc = getEquipItemPowerScore(inst, mercenary.class, 'mercenary');
      if (sc > bestScore + 0.2) {
        bestScore = sc;
        bestPlayerInvIdx = pIdx;
      }
    });

    if (bestPlayerInvIdx > -1) {
      const winInst = player.inventory[bestPlayerInvIdx];
      const winDef = window.itemDict?.[winInst.type];
      if (curMercEqIdx !== null && curMercEqIdx !== undefined && mercenary.inventory[curMercEqIdx]) {
        const oldMercInst = mercenary.inventory[curMercEqIdx];
        const isUnupgradedStarter = oldMercInst.isMercStarter && (!oldMercInst.plus || oldMercInst.plus <= 0);
        // 기존 장비가 기본 무상 지급품이면 덮어쓰고, 플레이어가 준 장비라면 플레이어 가방 해당 자리와 맞교환!
        player.inventory[bestPlayerInvIdx] = isUnupgradedStarter ? null : oldMercInst;
        mercenary.inventory[curMercEqIdx] = { ...winInst, qty: 1 };
      } else {
        let emptyMercIdx = mercenary.inventory.findIndex(x => x === null);
        if (emptyMercIdx === -1) {
          // 빈 슬롯이 없으면 미장착 기본 스타터 아이템 슬롯을 찾아 교체
          const mercEqSetNow = new Set(Object.values(mercenary.equip).filter(v => v !== null && v !== undefined).map(Number));
          emptyMercIdx = mercenary.inventory.findIndex((x, idx) => x && x.isMercStarter && !mercEqSetNow.has(idx));
        }
        if (emptyMercIdx > -1) {
          player.inventory[bestPlayerInvIdx] = null;
          mercenary.inventory[emptyMercIdx] = { ...winInst, qty: 1 };
          mercenary.equip[slotKey] = emptyMercIdx;
        } else {
          return;
        }
      }
      if (winDef) {
        suppliedNames.push(`${winInst.plus > 0 ? '+' + winInst.plus + ' ' : ''}${winDef.name}`);
      }
    }
  });

  // 쌍귀걸이(earring1, earring2) 및 쌍반지(ring1, ring2) 비교 및 보급
  [['earring1', 'earring2', '귀걸이'], ['ring1', 'ring2', '반지']].forEach(([s1, s2, typeKeyword]) => {
    [s1, s2].forEach(slotKey => {
      const curMercEqIdx = mercenary.equip[slotKey];
      const curMercInst = (curMercEqIdx !== null && curMercEqIdx !== undefined) ? mercenary.inventory[curMercEqIdx] : null;
      let bestScore = curMercInst ? getEquipItemPowerScore(curMercInst, mercenary.class, 'mercenary') : -1;
      let bestPlayerInvIdx = -1;

      player.inventory.forEach((inst, pIdx) => {
        if (!inst || playerEquipped.has(pIdx)) return;
        const def = window.itemDict?.[inst.type];
        if (!def || !def.type?.includes(typeKeyword)) return;
        const sc = getEquipItemPowerScore(inst, mercenary.class, 'mercenary');
        if (sc > bestScore + 0.2) {
          bestScore = sc;
          bestPlayerInvIdx = pIdx;
        }
      });

      if (bestPlayerInvIdx > -1) {
        const winInst = player.inventory[bestPlayerInvIdx];
        const winDef = window.itemDict?.[winInst.type];
        if (curMercEqIdx !== null && curMercEqIdx !== undefined && mercenary.inventory[curMercEqIdx]) {
          const oldMercInst = mercenary.inventory[curMercEqIdx];
          const isUnupgradedStarter = oldMercInst.isMercStarter && (!oldMercInst.plus || oldMercInst.plus <= 0);
          player.inventory[bestPlayerInvIdx] = isUnupgradedStarter ? null : oldMercInst;
          mercenary.inventory[curMercEqIdx] = { ...winInst, qty: 1 };
        } else {
          const emptyMercIdx = mercenary.inventory.findIndex(x => x === null);
          if (emptyMercIdx > -1) {
            player.inventory[bestPlayerInvIdx] = null;
            mercenary.inventory[emptyMercIdx] = { ...winInst, qty: 1 };
            mercenary.equip[slotKey] = emptyMercIdx;
          } else {
            return;
          }
        }
        if (winDef) {
          suppliedNames.push(`${winInst.plus > 0 ? '+' + winInst.plus + ' ' : ''}${winDef.name}`);
        }
      }
    });
  });

  // 용병 가방 내부에 이미 있던 더 좋은 장비도 함께 최적 장착
  const bagUpgrades = autoEquipMercBestItems(false);
  bagUpgrades.forEach(nm => {
    if (!suppliedNames.includes(nm)) suppliedNames.push(nm);
  });

  syncMercStats(false);
  window.updateMercHUD();
  updateStatusHUD();
  renderHotbarSlots();
  if (!document.getElementById('inventory-ui').classList.contains('hidden')) renderInventory();
  window.renderMercUI();

  if (suppliedNames.length > 0) {
    window.addChat(`⚔️ [용병 아이템보급 완료] 플레이어 가방에서 현재 용병 장비보다 우수한 장비 ${suppliedNames.length}종(${suppliedNames.join(', ')})을 가져와 장착했습니다!`, 'log-kill');
    window.triggerAutoSave?.('merc_supply_equip', true);
  } else {
    window.addChat(`ℹ️ [용병 아이템보급] 플레이어 가방에 현재 용병의 착용 장비보다 더 좋은(${MERC_CLASS_META[mercenary.class]?.roleName || '용병'} 착용 가능) 장비가 없습니다.`, 'log-sys');
  }
};

window.onMercInvSlotTap = function(mercIdx) {
  const idx = Number(mercIdx);
  if (window.mercEnchantScrollType) {
    window.enchantMercItem(idx, window.mercEnchantScrollType.type);
    return;
  }
  const now = Date.now();
  const dt = now - lastMercSlotTapTime;
  if (lastMercSlotTapIdx === idx && dt < 65) return;
  // 같은 슬롯을 연속 터치(또는 이미 선택된 슬롯을 한번 더 터치)하면 즉시 장착/해제/복용 실행!
  if (selectedMercInvIdx === idx || (lastMercSlotTapIdx === idx && dt >= 65 && dt < 400)) {
    lastMercSlotTapIdx = -1;
    lastMercSlotTapTime = 0;
    window.mercItemAction(idx, 'equipOrUse');
    return;
  }
  selectedMercInvIdx = idx;
  lastMercSlotTapIdx = idx;
  lastMercSlotTapTime = now;
  window.renderMercUI();
};

window.renderMercUI = function() {
  const body = document.getElementById('merc-ui-body');
  if (!body || !mercenary.hired) return;

  const meta = MERC_CLASS_META[mercenary.class] || MERC_CLASS_META.knight;
  const ms = calculateMercCombatStats();
  const expPct = Math.min(100, Math.floor((mercenary.exp / mercenary.maxExp) * 100));

  const equipSlots = [
    { key: 'weapon', name: '무기' },   { key: 'shield', name: '방패' },   { key: 'helmet', name: '투구' },
    { key: 'tshirt', name: '티셔츠' }, { key: 'armor', name: '갑옷' },    { key: 'cloak', name: '망토' },
    { key: 'gloves', name: '장갑' },   { key: 'belt', name: '벨트' },     { key: 'boots', name: '신발' },
    { key: 'necklace', name: '목걸이' }, { key: 'earring1', name: '귀걸이1' }, { key: 'earring2', name: '귀걸이2' },
    { key: 'ring1', name: '반지1' },   { key: 'ring2', name: '반지2' }
  ];

  let equipGridHtml = `<div style="display:grid; grid-template-columns:repeat(7, 1fr); gap:3px;">`;
  equipSlots.forEach(s => {
    const eqIdx = mercenary.equip[s.key];
    const inst = (eqIdx !== null && eqIdx !== undefined && mercenary.inventory[eqIdx]) ? mercenary.inventory[eqIdx] : null;
    const borderCol = inst?.gradeColor || '#5a462a';
    const plusVal = inst ? getItemPlusValue(inst, s.key, 'mercenary') : 0;
    
    // 장비 슬롯도 더블 터치 시 해제되도록 연결
    equipGridHtml += `
      <div onclick="${inst ? `onMercEquipSlotTap(${eqIdx})` : ''}" title="${inst ? (window.itemDict[inst.type]?.name || s.name) + ' (더블 터치 시 해제)' : s.name}" style="height:36px; background:#141210; border:1.5px solid ${borderCol}; border-radius:5px; display:flex; flex-direction:column; align-items:center; justify-content:center; cursor:pointer; position:relative;">
        ${inst ? window.getItemIconHTML(inst.type) : `<span style="font-size:8px; color:#9ca3af; font-weight:bold;">${s.name}</span>`}
        ${plusVal > 0 ? `<span style="position:absolute; top:1px; right:1px; font-size:7.5px; font-weight:bold; color:#fde047; background:rgba(0,0,0,0.85); padding:0 2px; border-radius:2px;">+${plusVal}</span>` : ''}
      </div>
    `;
  });
  equipGridHtml += `</div>`;

  const mercEqSet = new Set(Object.values(mercenary.equip).filter(v => v !== null && v !== undefined).map(Number));
  let invGridHtml = `<div style="display:grid; grid-template-columns:repeat(6, 1fr); gap:4px; max-height:108px; overflow-y:auto; padding:3px; background:#090b10; border:1px solid #3d3020; border-radius:6px;">`;
  mercenary.inventory.forEach((inst, idx) => {
    const isEq = mercEqSet.has(idx);
    const isSel = selectedMercInvIdx === idx;
    const def = inst ? window.itemDict[inst.type] : null;
    const bCol = isSel ? '#facc15' : (inst ? (def?.questOnly ? '#e879f9' : (inst.gradeColor || '#4b5563')) : '#262626');
    const plusVal = inst ? getItemPlusValue(inst, null, 'mercenary') : 0;
    
    invGridHtml += `
      <div onclick="${inst ? `onMercInvSlotTap(${idx})` : ''}" style="height:36px; background:${isSel ? '#272015' : '#18181b'}; border:${isSel ? '2px' : '1.5px'} solid ${bCol}; border-radius:5px; position:relative; display:flex; align-items:center; justify-content:center; cursor:pointer;">
        ${inst ? window.getItemIconHTML(inst.type) : ''}
        ${isEq ? `<span style="position:absolute; top:1px; left:2px; font-size:7.5px; font-weight:bold; color:#4ade80; background:rgba(0,0,0,0.8); padding:0 2px; border-radius:2px;">E</span>` : ''}
        ${plusVal > 0 ? `<span style="position:absolute; top:1px; right:2px; font-size:7.5px; font-weight:bold; color:#fde047; background:rgba(0,0,0,0.8); padding:0 2px; border-radius:2px;">+${plusVal}</span>` : ''}
        ${inst && inst.qty > 1 ? `<span style="position:absolute; bottom:1px; right:2px; font-size:8px; font-weight:bold; color:#fff; text-shadow:0 0 2px #000;">${inst.qty}</span>` : ''}
      </div>
    `;
  });
  invGridHtml += `</div>`;

  body.innerHTML = `
    <!-- 1. 상단 용병 요약 및 장비 강화 세트 효과 배지 -->
    <div style="background:#1c1917; border:1px solid #5a462a; border-radius:6px; padding:4px 6px; display:flex; flex-direction:column; gap:2px;">
      <div style="display:flex; justify-content:space-between; align-items:center;">
        <div>
          <div style="font-size:11px; font-weight:bold; color:#fde047;">${meta.icon} ${mercenary.name} <span style="color:#fff;">Lv.${mercenary.level}</span></div>
          <div style="font-size:9px; color:#d1d5db;">HP <b style="color:#4ade80;">${Math.ceil(mercenary.hp)}/${ms.maxHp}</b> · MP <b style="color:#60a5fa;">${Math.ceil(mercenary.mp)}/${ms.maxMp}</b> · 공<b>${mercenary.class === 'wizard' ? ms.totalMAtk : ms.totalAtk}</b> · 방<b>${ms.totalDef}</b>/마방<b style="color:#c084fc;">${ms.totalMDef || 0}</b></div>
        </div>
        ${mercenary.isDead ? `<button class="shop-buy-btn" style="background:#dc2626; border-color:#fca5a5; padding:2px 5px;" onclick="reviveMercenary()">부활(${getMercReviveCost()}G)</button>` : `<span style="font-size:9px; color:#4ade80; font-weight:bold;">참전중</span>`}
      </div>
      <div style="font-size:8.5px; color:#93c5fd; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
        🔓 레벨 해금 스킬(${getMercUnlockedSkills().length}종): <span style="color:#fde047;">${getMercUnlockedSkills().slice(-5).map(s => s.name).join(' · ') || '기본공격'}</span>
      </div>
    </div>

    <!-- 2. 스탠스 제어 -->
    <div style="background:#14171f; border:1px solid #3d3020; border-radius:6px; padding:4px;">
      <div style="display:flex; gap:3px;">
        <button class="stance-btn ${mercenary.stance === 'ATTACK' ? 'active-attack' : ''}" onclick="setMercStance('ATTACK')">⚔️ 공격</button>
        <button class="stance-btn ${mercenary.stance === 'STANDBY' ? 'active-standby' : ''}" onclick="setMercStance('STANDBY')">🛡️ 대기</button>
        <button class="stance-btn ${mercenary.stance === 'SUPPORT' ? 'active-support' : ''}" onclick="setMercStance('SUPPORT')">💚 보조</button>
      </div>
    </div>

    <!-- 3. 용병 장착 장비 (14슬롯) -->
    <div style="background:#14171f; border:1px solid #3d3020; border-radius:6px; padding:4px;">
      <div style="font-size:10px; color:#facc15; font-weight:bold; margin-bottom:2px;">🛡️ 착용 장비 (더블 터치 해제)</div>
      ${equipGridHtml}
    </div>

    <!-- 4. 용병 가방 (24슬롯) -->
    <div style="background:#14171f; border:1px solid #3d3020; border-radius:6px; padding:4px;">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:2px;">
        <span style="font-size:10px; color:#facc15; font-weight:bold;">🎒 용병 가방 (터치:상세 / 더블터치:장착)</span>
        <div style="display:flex; gap:3px;">
          <button class="shop-buy-btn" style="padding:2px 5px; font-size:9px; background:#065f46;" onclick="sortMercInventory()">정렬</button>
          <button class="shop-buy-btn" style="padding:2px 5px; font-size:9px; background:#1d4ed8; border-color:#60a5fa;" onclick="quickSupplyMercBestEquipFromPlayer()" title="플레이어 가방에서 현재 용병 장비보다 좋은 장비를 모두 가져와 자동 장착">아이템보급</button>
          <button class="shop-buy-btn" style="padding:2px 5px; font-size:9px; background:#15803d;" onclick="quickSupplyMercPotions()" title="플레이어 가방에서 물약 보급">물약보급</button>
        </div>
      </div>
      ${invGridHtml}
      <!-- 🌟 누락되었던 #merc-item-detail 영역 추가 -->
      <div id="merc-item-detail" style="margin-top:3px; padding:5px 7px; background:#090b10; border:1.5px solid #5a462a; border-radius:5px; font-size:11px; color:#e5e7eb; min-height:68px;">
        아이템을 터치하면 상세 옵션이 표시됩니다.
      </div>
    </div>
  `;

  if (selectedMercInvIdx !== null && mercenary.inventory[selectedMercInvIdx]) {
    window.selectMercInvSlot(selectedMercInvIdx);
  }
};

window.openPlayerInventoryFromMerc = function() {
  const invUi = document.getElementById('inventory-ui');
  if (!invUi) return;
  invUi.classList.remove('hidden');
  window.bringModalToFront?.(invUi);
  renderInventory();
  window.centerModalOnScreen?.(invUi);
};

window.selectMercInvSlot = function(rawMercIdx) {
  const mercIdx = Number(rawMercIdx);
  selectedMercInvIdx = mercIdx;
  const inst = mercenary.inventory[mercIdx];
  const detailEl = document.getElementById('merc-item-detail');
  if (!inst || !detailEl) return;
  const def = window.itemDict[inst.type] || { name: inst.type };
  const isEq = Object.values(mercenary.equip).some(v => v !== null && Number(v) === mercIdx);
  const plusTxt = inst.plus > 0 ? `+${inst.plus} ` : '';

 const mult = inst.mult || 1.0;
  let statHtml = "";
  if (def.pAtk) statHtml += `<span style="color:#fca5a5; font-weight:bold; margin-right:5px;">물공+${Math.round(def.pAtk * mult)}</span>`;
  if (def.mAtk) statHtml += `<span style="color:#93c5fd; font-weight:bold; margin-right:5px;">마공+${Math.round(def.mAtk * mult)}</span>`;
  if (def.def) statHtml += `<span style="color:#4ade80; font-weight:bold; margin-right:5px;">방어+${Math.round(def.def * mult)}</span>`;
  if (def.weight) statHtml += `<span style="color:#fdba74; font-weight:bold; margin-right:5px;">HP+${def.weight * 2}·MP+${Math.floor(def.weight * 0.8)}</span>`;
  
  const liveEffectTxt = def.healHp ? `HP ${def.healHp} 회복` : (def.healMp ? `MP ${def.healMp} 회복` : def.effect);
  if (liveEffectTxt) statHtml += `<span style="color:#fde047; font-weight:bold; margin-right:5px;">${liveEffectTxt}</span>`;

  let optHtml = "";
  if (Array.isArray(inst.options) && inst.options.length > 0) {
    optHtml = `<div style="font-size:10.5px; font-weight:bold; color:#7dd3fc; margin-top:3px;">✨옵션: ` +
      inst.options.map(o => `${o.label}+${o.val}${o.unit}`).join(' · ') + `</div>`;
  }

  // UI 공간 확보를 위해 HTML 구조를 압축
  detailEl.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:4px; font-size:11px; margin-bottom:3px; border-bottom:1px solid #3d3020; padding-bottom:3px; flex-wrap:wrap;">
      <div style="min-width:0; flex:1; white-space:normal; word-break:keep-all; line-height:1.3;">
        <b style="color:${inst.gradeColor || '#fff'}; font-size:12px;">${plusTxt}${def.name}</b>
        <span style="color:#fde047; font-size:10px;">(${def.type || '기타'})</span>
      </div>
      <div style="display:flex; gap:3px; flex-shrink:0;">
        <button class="shop-buy-btn" style="background:#16a34a; padding:3px 6px;" onclick="mercItemAction(${mercIdx}, 'equipOrUse')">${isEq ? '해제' : '장착'}</button>
        <button class="shop-buy-btn" style="background:#1e3a8a; padding:3px 6px;" onclick="mercItemAction(${mercIdx}, 'returnToPlayer')">회수</button>
        <button class="shop-buy-btn" style="background:#b45309; border-color:#f59e0b; padding:3px 6px;" onclick="mercItemQuickSell(${mercIdx})">판매</button>
      </div>
    </div>
    <div style="font-size:11px; line-height:1.3;">${statHtml || '<span style="color:#9ca3af;">효과 없음</span>'}</div>
    ${optHtml}
  `;
};

// 즉시 판매 함수 추가
window.mercItemQuickSell = function(mercIdx) {
  const inst = mercenary.inventory[mercIdx];
  if (!inst) return;
  const def = window.itemDict[inst.type];
  const unitSell = Math.max(20, Math.floor((def?.price || 100) * 0.35));
  const goldEarned = unitSell * (inst.qty || 1);
  player.gold += goldEarned;
  mercenary.inventory[mercIdx] = null;
  selectedMercInvIdx = null;
  window.addChat(`💰 [용병 물품 정리] '${def.name}' 처분으로 ${goldEarned.toLocaleString()} G 획득!`, 'log-sys');
  updateStatusHUD();
  window.renderMercUI();
};



function useMercPotionIndex(mercIdx) {
  const inst = mercenary.inventory[mercIdx];
  if (!inst) return false;
  const def = window.itemDict[inst.type];
  if (!def) return false;
  const now = Date.now();

  if (def.healHp) {
    mercenary.lastHpPotionTime = now;
    const pctBonus = inst.type === 'C_P02' ? Math.floor((mercenary.maxHp || 300) * 0.14) : Math.floor((mercenary.maxHp || 300) * 0.08);
    const totalHealHp = def.healHp + pctBonus;
    mercenary.hp = Math.min(mercenary.maxHp, mercenary.hp + totalHealHp);
    floatingTexts.push({ x: mercenary.x, y: mercenary.y - 45, text: `+${totalHealHp} HP`, color: 0x4ade80, life: 28 });
    activeEffects.push({ type: 'potion', subType: 'hp', x: mercenary.x, y: mercenary.y, targetRef: mercenary, life: 30, maxLife: 30, skillName: def.name || '체력 물약' });
    window.broadcastMultiplayerActionFx?.('potion', { subType: 'hp', isMerc: true, x: Math.round(mercenary.x), y: Math.round(mercenary.y), amount: totalHealHp, skillName: def.name || '체력 물약' });
  }
  if (def.healMp) {
    mercenary.lastMpPotionTime = now;
    const pctMpBonus = inst.type === 'C_P04' ? Math.floor((mercenary.maxMp || 150) * 0.14) : Math.floor((mercenary.maxMp || 150) * 0.08);
    const totalHealMp = def.healMp + pctMpBonus;
    mercenary.mp = Math.min(mercenary.maxMp, mercenary.mp + totalHealMp);
    if (mercenary.mp / mercenary.maxMp > 0.15) mercenary.manaRechargeWait = false;
    floatingTexts.push({ x: mercenary.x, y: mercenary.y - 45, text: `+${totalHealMp} MP`, color: 0x60a5fa, life: 28 });
    activeEffects.push({ type: 'potion', subType: 'mp', x: mercenary.x, y: mercenary.y, targetRef: mercenary, life: 30, maxLife: 30, skillName: def.name || '마나 물약' });
    window.broadcastMultiplayerActionFx?.('potion', { subType: 'mp', isMerc: true, x: Math.round(mercenary.x), y: Math.round(mercenary.y), amount: totalHealMp, skillName: def.name || '마나 물약' });
  }
  if (inst.type === 'C_P05' || def.type === '버프물약') {
    const addDur = ((def.dur || 600) * 1000);
    mercenary.activeBuffs.ELIXIR = Math.min(3600000, Math.max(0, mercenary.activeBuffs.ELIXIR || 0) + addDur);
    activeEffects.push({ type: 'potion', subType: 'elixir', x: mercenary.x, y: mercenary.y, targetRef: mercenary, life: 34, maxLife: 34, skillName: def.name || '용사의 비약' });
    window.broadcastMultiplayerActionFx?.('potion', { subType: 'elixir', isMerc: true, x: Math.round(mercenary.x), y: Math.round(mercenary.y), skillName: def.name || '용사의 비약' });
  }

  inst.qty--;
  if (inst.qty <= 0) mercenary.inventory[mercIdx] = null;
  window.updateMercHUD();
  return true;
}

