// js/data.js
import { OBJ, HardcodedMapDB, DetailFieldRenderer, Renderer, initAllMaps } from './map_renderer.js';

function sanitizeSupabaseValue(rawVal) {
  if (!rawVal) return "";
  return String(rawVal)
    .trim()
    .replace(/^["']+|["']+$/g, "")
    .replace("fkztpigrlobgkgarnnvji.supabase.co", "fkztpigrlobgkgammvji.supabase.co");
}

// 🌟 정통 MMORPG 레벨별 필요 경험치(maxExp) 공식 (Lv.1~65 초고속 광속 레벨업 방지 및 구간별 점진적 성장 밸런스)
export function calcRequiredExpForLevel(lv) {
  const L = Math.max(1, Number(lv) || 1);
  if (L <= 1) return 140;
  const base = 140 * Math.pow(L, 1.72);
  const mid = L > 15 ? Math.pow(L - 15, 2.15) * 28 : 0;
  const high = L > 45 ? Math.pow(L - 45, 2.40) * 65 : 0;
  const end = L > 100 ? Math.pow(L - 100, 2.65) * 140 : 0;
  return Math.floor(base + mid + high + end);
}

// 🌟 플레이어와 몬스터 간 레벨 차이에 따른 획득 경험치 보정 및 1회 처치 최대 경험치 상한 계산기
export function calcBalancedKillExp(rawExp, playerLv = 1, mobLv = 1, isBoss = false) {
  const pLv = Math.max(1, Number(playerLv) || 1);
  const mLv = Math.max(1, Number(mobLv) || 1);
  let exp = Math.max(1, Number(rawExp) || 15);

  const overGap = mLv - pLv;   // 몬스터가 플레이어보다 높은 레벨 차이
  const underGap = pLv - mLv;  // 플레이어가 몬스터보다 높은 레벨 차이

  // 1) 자신보다 과도하게 높은 레벨(+8 초과)의 몬스터 처치/쩔 사냥 시 경험치 페널티 적용 (광속 점프 원천 차단)
  if (overGap > 8) {
    const penalty = Math.max(0.04, 1 - (overGap - 8) * 0.11);
    exp = Math.max(1, Math.floor(exp * penalty));
  } else if (overGap >= 1 && overGap <= 5) {
    // 적정 상위 몬스터(+1~+5) 사냥 시 소폭 보너스 (+5%~+15%)
    exp = Math.floor(exp * (1 + overGap * 0.03));
  }

  // 2) 자신보다 너무 낮은 저레벨 몬스터(-15 미만) 학살 시 경험치 감쇄
  if (underGap > 15) {
    const lowScale = Math.max(0.08, 1 - (underGap - 15) * 0.045);
    exp = Math.max(1, Math.floor(exp * lowScale));
  }

  // 3) 단일 몬스터 1마리 처치 시 현재 레벨 필요 경험치(maxExp)의 일정 비율을 초과하지 않도록 상한 캡 적용
  const curMaxExp = calcRequiredExpForLevel(pLv);
  const maxSingleKillRatio = pLv <= 5 ? 0.34 : (isBoss ? 0.42 : 0.18);
  const capExp = Math.max(15, Math.floor(curMaxExp * maxSingleKillRatio));
  return Math.min(exp, capExp);
}

export async function loadEnvConfig() {
  try {
    const res = await fetch('./.env');
    if (res.ok) {
      const text = await res.text();
      text.split('\n').forEach(line => {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
          const [key, ...values] = trimmed.split('=');
          const k = key.trim();
          const v = sanitizeSupabaseValue(values.join('='));
          if (k === 'SUPABASE_URL' && v) GameDB.SupabaseConfig.url = v;
          if (k === 'SUPABASE_KEY' && v) GameDB.SupabaseConfig.anonKey = v;
        }
      });
    }
  } catch (err) {}
}

export const GameDB = {
  calcRequiredExpForLevel,
  calcBalancedKillExp,

  // 0. Supabase 연동 및 세션 설정
  SupabaseConfig: {
    url: sanitizeSupabaseValue((typeof localStorage !== 'undefined' && localStorage.getItem('MAGIC_SUPABASE_URL')) || "https://fkztpigrlobgkgammvji.supabase.co"),
    anonKey: sanitizeSupabaseValue((typeof localStorage !== 'undefined' && localStorage.getItem('MAGIC_SUPABASE_ANON_KEY')) || "sb_publishable_7scBWfFfF8FJW4qrdcthvw_Rf7q_XcR"),
    tables: {
      accounts: "magic_accounts",
      characters: "magic_characters",
      storage: "magic_storage"
    },
    maxCharacterSlots: 3,
    maxStorageSlots: 60,
    autoSaveIntervalMs: 15000,
    combatSaveDebounceMs: 2500,
    sessionHeartbeatMs: 4000
  },

  // 0.5 게임 전역 밸런스·초기화·카메라·인챈트 설정
  SystemConfig: {
    startRegion: "R01",
    startMap: "R01_sub1",
    startSpawn: { x: 2000, y: 14250 },
    startGold: 600,
    startItems: [
      { id: "C_P01", qty: 20 },
      { id: "C_P03", qty: 20 },
      { id: "S_RE01", qty: 5 },
      { id: "A_TS01", qty: 1, gradeIdx: 0 }
    ],
    startWeaponsByClass: {
      knight: "W_SW01",
      ranger: "W_BW01",
      wizard: "W_ST01"
    },
    autoPotion: {
      hpRatioThreshold: 0.70,
      mpRatioThreshold: 0.20,
      mercHpRatioThreshold: 0.70,
      mercMpRatioThreshold: 0.20,
      autoHealIntervalMs: 1000,
      autoBuffCheckIntervalMs: 800
    },
    naturalRegen: {
      intervalMs: 2500,
      safeHpPct: 0.055,
      restHpPct: 0.018,
      combatHpPct: 0.005,
      safeMpPct: 0.065,
      restMpPct: 0.032,
      combatMpPct: 0.014
    },
    enchant: {
      weaponSafeLimit: 6,
      armorSafeLimit: 4,
      overStepChances: [65, 50, 38, 28, 20],
      minChance: 12
    },
    camera: {
      defaultStage: 2,
      autoZoomEnabled: true,
      stages: [
        { stage: 1, name: "1단계 (기본 원거리)", scale: 0.86, desc: "기존보다 넓어진 쾌적한 기본 시야" },
        { stage: 2, name: "2단계 (넓은 시야·권장)", scale: 0.74, desc: "필드 이동과 전투에 최적화된 중장거리 시야" },
        { stage: 3, name: "3단계 (광각 파노라마)", scale: 0.63, desc: "보스전 및 다수 몬스터 파악에 유리한 광각 시야" }
      ]
    }
  },

  // 1. 세계관 및 기본 배경 (Age of High Magic)
  Lore: {
    era: "대마법 시대 (Age of High Magic)",
    story: "마나의 근원인 '에테르 코어'가 파괴되며 세계가 15개의 차원 조각으로 분열된 중세 판타지.",
    figures: {
      ALDRIC: { name: "국왕 알드릭", race: "인간", region: "R01", desc: "붕괴된 제국을 수습하고 알트리아를 지키는 전사왕" },
      SYLVANA: { name: "대장로 실바나", race: "엘프", region: "R04", desc: "마나 폭주로부터 엘프들을 보호하며 엘론드에 결계를 친 대마법사" },
      KAELEN: { name: "배교자 카엘런", race: "타락한 마법사", region: "R15", desc: "세계를 분열시킨 원흉이자 끝없는 생명력을 탐하는 메인 빌런" }
    }
  },

  // 2. 클래스 및 스탯 시스템 (총합 20, 레벨업당 +3, 50단위 레벨마다 스탯 초기화 가능)
  Classes: {
    HUMAN_WARRIOR: {
      key: "knight", name: "인간전사", icon: "🛡️", mainStat: "STR",
      str: 13, dex: 3, int: 1, con: 3,
      baseHp: 240, baseMp: 95, hpPerLv: 22, mpPerLv: 13, hpPerCon: 11, mpPerInt: 10,
      baseMDef: 6, mDefPerLv: 1.0,
      atkMult: 1.05, magicMult: 0.2, attackRange: 64, baseSpeed: 1.90,
      statPerLv: 3, resetUnlockLv: 50, resetStepLv: 50,
      desc: "높은 체력과 근접 방어력, 단일·광역 검술에 특화된 최전방 클래스"
    },
    ELF_ARCHER: {
      key: "ranger", name: "엘프궁수", icon: "🏹", mainStat: "DEX",
      str: 3, dex: 15, int: 3, con: 3,
      baseHp: 215, baseMp: 180, hpPerLv: 21, mpPerLv: 15, hpPerCon: 11, mpPerInt: 11,
      baseMDef: 10, mDefPerLv: 1.35,
      atkMult: 1.14, magicMult: 0.72, attackRange: 255, baseSpeed: 2.02,
      statPerLv: 3, resetUnlockLv: 50, resetStepLv: 50,
      desc: "빠른 기동성과 원거리 치명타, 정령 보조 치유에 특화된 밸런스 클래스"
    },
    ELF_MAGE: {
      key: "wizard", name: "엘프마법사", icon: "🔮", mainStat: "INT",
      str: 1, dex: 2, int: 14, con: 3,
      baseHp: 165, baseMp: 270, hpPerLv: 18, mpPerLv: 14, hpPerCon: 9, mpPerInt: 10,
      baseMDef: 12, mDefPerLv: 1.5,
      atkMult: 0.45, magicMult: 1.18, attackRange: 240, baseSpeed: 1.85,
      statPerLv: 3, resetUnlockLv: 50, resetStepLv: 50,
      desc: "강력한 단일·광역 원소 마법과 고위 성마법 힐·버프를 구사하는 클래스"
    }
  },

  // 2.5 용병 및 상점 설정 (data.js에서 통합 관리)
  Mercenaries: {
    knight: { name: "수호기사 리처드", roleName: "인간전사", icon: "🛡️", hireCost: 500, desc: "전열 탱킹 · 배쉬 스턴 · 방패 블록 특화", atkRange: 68, normalSkill: "배쉬", normalMult: 1.7, ultSkill: "차지", ultMult: 2.4 },
    ranger: { name: "숲속의 실비아", roleName: "엘프궁수", icon: "🏹", hireCost: 600, desc: "원거리 폭딜 · 카이팅 · 네이처스 터치 보조힐", atkRange: 245, normalSkill: "피어스 애로우", normalMult: 2.15, ultSkill: "스나이퍼 샷", ultMult: 3.65 },
    wizard: { name: "아크메이지 루시안", roleName: "엘프마법사", icon: "🔮", hireCost: 700, desc: "광역/단일 극딜 · 큐어 고효율 힐링 · 버프", atkRange: 225, normalSkill: "라이트닝", normalMult: 2.15, ultSkill: "헬 파이어", ultMult: 3.5 }
  },

  Shops: {
    generalItems: ["C_P01", "C_P02", "C_P03", "C_P04", "C_P05", "S_RE01", "W_SW01", "W_SW02", "W_BW01", "W_BW02", "W_ST01", "W_ST02", "W_SH01", "A_HE01", "A_TS01", "A_AR01", "A_AR02", "A_GL01", "A_BE01", "A_SH01", "A_CL01", "AC_N01", "AC_E01", "AC_R01"],
    campExtraItems: ["S_WE01", "S_AR01"],
    scrollShopItems: ["S_RE01", "S_WE01", "S_AR01"],
    mercenaryBlessCost: 300,
    mercenaryBlessDurSec: 300,
    bankGoldStep: 1000
  },

  // 3. 월드맵 15개 지역 데이터 (마을(S) 및 야영지(S1) 거점 용병단장·마법상인 지원)
  Regions: [
    { id: "R01", name: "알트리아", eng: "Altria", theme: "초원", hubType: "TOWN", minLv: 1, lvRange: "Lv.1~20", mapX: 50, mapY: 84, sub1: "초심자의 마을(S)", sub2: "속삭이는 들판", sub3: "고블린 동굴", sub4: "족장의 막사", questNpc: "국왕 알드릭의 특사 발렌" },
    { id: "R02", name: "실버바인", eng: "Silvervine", theme: "숲", hubType: "CAMP", minLv: 15, lvRange: "Lv.20~35", mapX: 20, mapY: 80, sub1: "요정의 야영지(S1)", sub2: "은빛 덩굴숲", sub3: "버려진 벌목장", sub4: "타락한 세계수", questNpc: "숲지기 아리엘" },
    { id: "R03", name: "칼라드루", eng: "Kaladru", theme: "바위산", hubType: "TOWN", minLv: 30, lvRange: "Lv.35~50", mapX: 82, mapY: 53, sub1: "바위망치 마을(S)", sub2: "붉은 협곡", sub3: "광신도의 광산", sub4: "골렘의 제단", questNpc: "대장장이 토르딘" },
    { id: "R04", name: "엘론드", eng: "Elrond", theme: "호수/마법도시", hubType: "TOWN", minLv: 45, lvRange: "Lv.50~65", mapX: 51, mapY: 58, sub1: "빛의 엘론드(S)", sub2: "물안개 호숫가", sub3: "가라앉은 신전", sub4: "물의 정령왕좌", questNpc: "대장로 실바나" },
    { id: "R05", name: "모라안", eng: "Moraan", theme: "사막", hubType: "CAMP", minLv: 60, lvRange: "Lv.65~80", mapX: 28, mapY: 67, sub1: "오아시스 상단(S1)", sub2: "작열하는 모래언덕", sub3: "개미지옥 둥지", sub4: "고대 파라오 무덤", questNpc: "대상단장 하킴" },
    { id: "R06", name: "블러드문", eng: "Bloodmoon", theme: "늪지대", hubType: "CAMP", minLv: 75, lvRange: "Lv.80~95", mapX: 75, mapY: 70, sub1: "추방자들의 야영지(S1)", sub2: "핏빛 진흙탕", sub3: "역병 짐승의 굴", sub4: "맹독 늪지 깊은곳", questNpc: "추방자 대장 크로우" },
    { id: "R07", name: "발레노스", eng: "Balenos", theme: "해안가", hubType: "TOWN", minLv: 90, lvRange: "Lv.95~110", mapX: 83, mapY: 86, sub1: "항구도시 발레노스(S)", sub2: "검은 모래 해변", sub3: "난파선 무덤", sub4: "해적선장의 선실", questNpc: "해군 제독 테오도르" },
    { id: "R08", name: "프로스트홀드", eng: "Frosthold", theme: "설원", hubType: "TOWN", minLv: 105, lvRange: "Lv.110~130", mapX: 82, mapY: 31, sub1: "얼음바위 마을(S)", sub2: "눈보라 평원", sub3: "얼어붙은 수정동굴", sub4: "서리거인의 안식처", questNpc: "설원 족장 볼프강" },
    { id: "R09", name: "이그니스", eng: "Ignis", theme: "화산", hubType: "CAMP", minLv: 125, lvRange: "Lv.130~150", mapX: 20, mapY: 38, sub1: "잿빛 야영지(S1)", sub2: "끓어오르는 대지", sub3: "용암 튜브 미궁", sub4: "화염마족의 분화구", questNpc: "화염감시자 이그나" },
    { id: "R10", name: "다크우드", eng: "Darkwood", theme: "저주받은숲", hubType: "CAMP", minLv: 145, lvRange: "Lv.150~170", mapX: 20, mapY: 54, sub1: "까마귀 야영지(S1)", sub2: "그림자 숲", sub3: "망자의 지하묘지", sub4: "언데드 군주의 방", questNpc: "퇴마사 베인" },
    { id: "R11", name: "윈드스톰", eng: "Windstorm", theme: "고산협곡", hubType: "TOWN", minLv: 165, lvRange: "Lv.170~190", mapX: 53, mapY: 45, sub1: "하늘맞이 마을(S)", sub2: "돌풍의 절벽", sub3: "하피의 둥지", sub4: "폭풍새의 산란장", questNpc: "천공지기 제피르" },
    { id: "R12", name: "아르카나", eng: "Arcana", theme: "부유도", hubType: "CAMP", minLv: 185, lvRange: "Lv.190~220", mapX: 51, mapY: 33, sub1: "마법학회 전초기지(S1)", sub2: "깨진 중력의 뜰", sub3: "고대 마공학 부유선", sub4: "기계신 타이탄 제어실", questNpc: "수석 학자 루미나" },
    { id: "R13", name: "네더게이트", eng: "Nethergate", theme: "마계입구", hubType: "CAMP", minLv: 215, lvRange: "Lv.220~260", mapX: 21, mapY: 23, sub1: "흑요석 철책(S1)", sub2: "핏빛 황무지", sub3: "고문관의 미궁", sub4: "차원문 중심부", questNpc: "심연파수대장 단테" },
    { id: "R14", name: "드래곤피크", eng: "Dragon Peak", theme: "용의둥지", hubType: "TOWN", minLv: 255, lvRange: "Lv.260~300", mapX: 51, mapY: 16, sub1: "최후의 용병단(S)", sub2: "불탄 기사단 훈련소", sub3: "드레이크 부화장", sub4: "고룡의 둥지", questNpc: "용사냥꾼 지크프리트" },
    { id: "R15", name: "이터니티", eng: "Eternity", theme: "공허의중심", hubType: "CAMP", minLv: 290, lvRange: "Lv.300~∞", mapX: 83, mapY: 16, sub1: "차원의 틈새(S1)", sub2: "부서진 기억의 길", sub3: "심연의 회랑", sub4: "배교자 카엘런의 옥좌", questNpc: "차원 수호자 셀레스티아" }
  ],

  // 4. 아이템 5등급 및 랜덤 마법옵션 공식 (피흡 +1~5% 반영)
  ItemGrades: [
    { idx: 0, key: "NORMAL",       name: "일반", mult: 1.00, optMin: 0, optMax: 0, color: "#ffffff", dropWeightMob: 600, dropWeightBoss: 0 },
    { idx: 1, key: "ADVANCED",     name: "고급", mult: 1.05, optMin: 1, optMax: 1, color: "#4ade80", dropWeightMob: 280, dropWeightBoss: 300 },
    { idx: 2, key: "RARE",         name: "희귀", mult: 1.10, optMin: 2, optMax: 3, color: "#60a5fa", dropWeightMob: 100, dropWeightBoss: 450 },
    { idx: 3, key: "LEGENDARY",    name: "전설", mult: 1.15, optMin: 3, optMax: 4, color: "#f59e0b", dropWeightMob: 18,  dropWeightBoss: 200 },
    { idx: 4, key: "TRANSCENDENT", name: "초월", mult: 1.25, optMin: 5, optMax: 5, color: "#e879f9", dropWeightMob: 2,   dropWeightBoss: 50 }
  ],

  MagicOptionPool: [
    { key: "STR",   label: "STR",      min: 1,  max: 5,   unit: "" },
    { key: "DEX",   label: "DEX",      min: 1,  max: 5,   unit: "" },
    { key: "INT",   label: "INT",      min: 1,  max: 5,   unit: "" },
    { key: "CON",   label: "CON",      min: 1,  max: 5,   unit: "" },
    { key: "maxHp", label: "최대HP",   min: 15, max: 110, unit: "" },
    { key: "maxMp", label: "최대MP",   min: 15, max: 110, unit: "" },
    { key: "mDef",  label: "마법방어", min: 2,  max: 12,  unit: "" },
    { key: "hit",   label: "명중률",   min: 1,  max: 5,   unit: "%" },
    { key: "crit",  label: "크리티컬", min: 1,  max: 5,   unit: "%" },
    { key: "drain", label: "피흡",     min: 1,  max: 5,   unit: "%" }
  ],

  // 4.1 ~ 4.4 아이템 DB (전 지역 R01~R15 마지막 보스 퀘스트 전용 보상 무기 완비)
  Items: {
    Weapons: [
      { id: "W_SW01", name: "낡은 롱소드", type: "한손검", reqLv: 1, pAtk: 11, mAtk: 0, atkSpeed: 1.05, price: 150, note: "초기지급" },
      { id: "W_SW02", name: "강철 브로드소드", type: "한손검", reqLv: 12, pAtk: 26, mAtk: 0, atkSpeed: 1.1, price: 800, note: "필드 드롭" },
      { id: "W_SW03", name: "미스릴 소드", type: "한손검", reqLv: 35, pAtk: 48, mAtk: 0, atkSpeed: 1.0, price: 3500, note: "중급 드롭" },
      { id: "W_SW04", name: "뱀파이어 블레이드", type: "한손검", reqLv: 75, pAtk: 76, mAtk: 12, atkSpeed: 1.0, drain: 4, price: 12000, note: "피흡 4% 내장" },
      { id: "W_SW05", name: "드래곤 투스", type: "한손검", reqLv: 140, pAtk: 125, mAtk: 15, atkSpeed: 0.9, drain: 3, price: 50000, note: "최상위 드롭 무기" },

      { id: "W_ST01", name: "참나무 지팡이", type: "양손지팡이", reqLv: 1, pAtk: 3, mAtk: 14, atkSpeed: 1.4, price: 150, note: "초기지급" },
      { id: "W_ST02", name: "뼈 지팡이", type: "양손지팡이", reqLv: 12, pAtk: 6, mAtk: 30, atkSpeed: 1.4, price: 800, note: "필드 드롭" },
      { id: "W_ST03", name: "크리스탈 스태프", type: "양손지팡이", reqLv: 35, pAtk: 10, mAtk: 58, atkSpeed: 1.35, bonusMp: 60, price: 3500, note: "마나+60" },
      { id: "W_ST04", name: "대마법사의 지팡이", type: "양손지팡이", reqLv: 75, pAtk: 15, mAtk: 90, atkSpeed: 1.3, bonusMp: 110, coolReduce: 5, price: 12000, note: "캐스팅-5%" },
      { id: "W_ST05", name: "공허의 지팡이", type: "양손지팡이", reqLv: 140, pAtk: 24, mAtk: 145, atkSpeed: 1.25, bonusMp: 180, price: 50000, note: "최상위 드롭 무기" },

      { id: "W_BW01", name: "짧은 활", type: "양손활", reqLv: 1, pAtk: 14, mAtk: 4, atkSpeed: 0.78, bonusHit: 3, price: 150, note: "초기지급 · 명중+3%" },
      { id: "W_BW02", name: "합성궁", type: "양손활", reqLv: 12, pAtk: 29, mAtk: 8, atkSpeed: 0.78, bonusHit: 4, drain: 1, price: 800, note: "필드 드롭 · 피흡 1%" },
      { id: "W_BW03", name: "엘븐 보우", type: "양손활", reqLv: 35, pAtk: 53, mAtk: 18, atkSpeed: 0.74, bonusHit: 6, drain: 2, price: 3500, note: "명중+6% · 피흡 2%" },
      { id: "W_BW04", name: "실피드의 날개", type: "양손활", reqLv: 75, pAtk: 84, mAtk: 28, atkSpeed: 0.68, bonusHit: 8, drain: 4, price: 12000, note: "공속 특화 · 피흡 4%" },
      { id: "W_BW05", name: "천상의 빛 (활)", type: "양손활", reqLv: 140, pAtk: 136, mAtk: 42, atkSpeed: 0.64, bonusHit: 12, drain: 5, price: 50000, note: "최상위 신궁 · 피흡 5%" },

      { id: "W_SH01", name: "나무 방패", type: "방패", reqLv: 1, def: 6, mDef: 2, block: 6, price: 200, note: "전사 전용" },
      { id: "W_SH02", name: "강철 카이트 쉴드", type: "방패", reqLv: 30, def: 16, mDef: 7, block: 11, price: 1200, note: "필드 드롭" },
      { id: "W_SH03", name: "이지스의 방패", type: "방패", reqLv: 90, def: 42, mDef: 18, block: 16, price: 8000, note: "마법방어+18" },

      // 🌟 [퀘스트 전용] 각 지역(R01~R15) 마지막 보스 퀘스트 완료 시 지급되는 상점·드롭 불가 클래스 맞춤 고성능 무기
      { id: "QR_R01_SW", name: "[퀘스트전용] 알드릭 국왕의 하사검", type: "한손검", pAtk: 36, mAtk: 0, atkSpeed: 0.98, price: 1800, questOnly: true, sellable: true, fixedGrade: 2, effect: "STR+3 · 최대HP+60 · 피흡+2%", bonusStats: { STR: 3, maxHp: 60, drain: 2 } },
      { id: "QR_R01_BW", name: "[퀘스트전용] 초원 감시자의 장궁", type: "양손활", pAtk: 34, mAtk: 8, atkSpeed: 0.78, price: 1800, questOnly: true, sellable: true, fixedGrade: 2, effect: "DEX+3 · 명중+5% · 치명+3%", bonusStats: { DEX: 3, hit: 5, crit: 3 } },
      { id: "QR_R01_ST", name: "[퀘스트전용] 에테르 수습생의 마법봉", type: "양손지팡이", pAtk: 6, mAtk: 42, atkSpeed: 1.35, price: 1800, questOnly: true, sellable: true, fixedGrade: 2, effect: "INT+4 · 최대MP+80", bonusStats: { INT: 4, maxMp: 80 } },

      { id: "QR_R02_SW", name: "[퀘스트전용] 세계수 수호자의 은빛검", type: "한손검", pAtk: 54, mAtk: 8, atkSpeed: 0.96, price: 3500, questOnly: true, sellable: true, fixedGrade: 2, effect: "STR+4 · CON+2 · 피흡+3%", bonusStats: { STR: 4, CON: 2, drain: 3 } },
      { id: "QR_R02_BW", name: "[퀘스트전용] 요정여왕의 은빛활", type: "양손활", pAtk: 50, mAtk: 16, atkSpeed: 0.75, price: 3500, questOnly: true, sellable: true, fixedGrade: 2, effect: "DEX+4 · 치명+4% · 피흡+2%", bonusStats: { DEX: 4, crit: 4, drain: 2 } },
      { id: "QR_R02_ST", name: "[퀘스트전용] 정화된 세계수의 가지", type: "양손지팡이", pAtk: 10, mAtk: 64, atkSpeed: 1.32, price: 3500, questOnly: true, sellable: true, fixedGrade: 2, effect: "INT+5 · 최대MP+110", bonusStats: { INT: 5, maxMp: 110 } },

      { id: "QR_R03_SW", name: "[퀘스트전용] 칼라드루 룬파괴검", type: "한손검", pAtk: 68, mAtk: 10, atkSpeed: 0.94, price: 6500, questOnly: true, sellable: true, fixedGrade: 3, effect: "STR+5 · CON+3 · 피흡+3%", bonusStats: { STR: 5, CON: 3, drain: 3 } },
      { id: "QR_R03_BW", name: "[퀘스트전용] 붉은 협곡의 관통궁", type: "양손활", pAtk: 63, mAtk: 18, atkSpeed: 0.73, price: 6500, questOnly: true, sellable: true, fixedGrade: 3, effect: "DEX+5 · 치명+5% · 명중+4%", bonusStats: { DEX: 5, crit: 5, hit: 4 } },
      { id: "QR_R03_ST", name: "[퀘스트전용] 고대 골렘 핵 지팡이", type: "양손지팡이", pAtk: 12, mAtk: 80, atkSpeed: 1.28, price: 6500, questOnly: true, sellable: true, fixedGrade: 3, effect: "INT+6 · 최대HP+90 · 최대MP+120", bonusStats: { INT: 6, maxHp: 90, maxMp: 120 } },

      { id: "QR_R04_SW", name: "[퀘스트전용] 실바나의 물결검", type: "한손검", pAtk: 84, mAtk: 16, atkSpeed: 0.92, price: 10000, questOnly: true, sellable: true, fixedGrade: 3, effect: "STR+6 · 피흡+4% · 최대HP+110", bonusStats: { STR: 6, drain: 4, maxHp: 110 } },
      { id: "QR_R04_BW", name: "[퀘스트전용] 물안개 정령왕의 활", type: "양손활", pAtk: 78, mAtk: 24, atkSpeed: 0.70, price: 10000, questOnly: true, sellable: true, fixedGrade: 3, effect: "DEX+6 · 명중+6% · 치명+5%", bonusStats: { DEX: 6, hit: 6, crit: 5 } },
      { id: "QR_R04_ST", name: "[퀘스트전용] 대장로 실바나의 성서봉", type: "양손지팡이", pAtk: 16, mAtk: 98, atkSpeed: 1.25, price: 10000, questOnly: true, sellable: true, fixedGrade: 3, effect: "INT+7 · 최대MP+150", bonusStats: { INT: 7, maxMp: 150 } },

      { id: "QR_R05_SW", name: "[퀘스트전용] 태양왕 파라오의 황금검", type: "한손검", pAtk: 100, mAtk: 20, atkSpeed: 0.90, price: 15000, questOnly: true, sellable: true, fixedGrade: 3, effect: "STR+7 · CON+4 · 피흡+4%", bonusStats: { STR: 7, CON: 4, drain: 4 } },
      { id: "QR_R05_BW", name: "[퀘스트전용] 사막 폭풍의 신기루활", type: "양손활", pAtk: 94, mAtk: 28, atkSpeed: 0.68, price: 15000, questOnly: true, sellable: true, fixedGrade: 3, effect: "DEX+7 · 치명+6% · 피흡+3%", bonusStats: { DEX: 7, crit: 6, drain: 3 } },
      { id: "QR_R05_ST", name: "[퀘스트전용] 파라오의 영혼홀", type: "양손지팡이", pAtk: 20, mAtk: 118, atkSpeed: 1.22, price: 15000, questOnly: true, sellable: true, fixedGrade: 3, effect: "INT+8 · 피흡+3% · 최대MP+180", bonusStats: { INT: 8, drain: 3, maxMp: 180 } },

      { id: "QR_R06_SW", name: "[퀘스트전용] 히드라 슬레이어 대검", type: "한손검", pAtk: 118, mAtk: 22, atkSpeed: 0.88, price: 22000, questOnly: true, sellable: true, fixedGrade: 3, effect: "STR+8 · 피흡+5% · 최대HP+150", bonusStats: { STR: 8, drain: 5, maxHp: 150 } },
      { id: "QR_R06_BW", name: "[퀘스트전용] 맹독 파수꾼의 마궁", type: "양손활", pAtk: 112, mAtk: 32, atkSpeed: 0.67, price: 22000, questOnly: true, sellable: true, fixedGrade: 3, effect: "DEX+8 · 치명+6% · 피흡+4%", bonusStats: { DEX: 8, crit: 6, drain: 4 } },
      { id: "QR_R06_ST", name: "[퀘스트전용] 핏빛 달의 마도서봉", type: "양손지팡이", pAtk: 22, mAtk: 138, atkSpeed: 1.20, price: 22000, questOnly: true, sellable: true, fixedGrade: 3, effect: "INT+9 · 최대MP+210 · 치명+4%", bonusStats: { INT: 9, maxMp: 210, crit: 4 } },

      { id: "QR_R07_SW", name: "[퀘스트전용] 대해적 바르보의 패왕검", type: "한손검", pAtk: 138, mAtk: 25, atkSpeed: 0.86, price: 32000, questOnly: true, sellable: true, fixedGrade: 4, effect: "STR+9 · CON+5 · 피흡+5%", bonusStats: { STR: 9, CON: 5, drain: 5 } },
      { id: "QR_R07_BW", name: "[퀘스트전용] 심해 폭풍의 제독궁", type: "양손활", pAtk: 130, mAtk: 38, atkSpeed: 0.65, price: 32000, questOnly: true, sellable: true, fixedGrade: 4, effect: "DEX+9 · 명중+7% · 치명+7%", bonusStats: { DEX: 9, hit: 7, crit: 7 } },
      { id: "QR_R07_ST", name: "[퀘스트전용] 심연 해류의 산호장", type: "양손지팡이", pAtk: 25, mAtk: 162, atkSpeed: 1.18, price: 32000, questOnly: true, sellable: true, fixedGrade: 4, effect: "INT+10 · 최대MP+250 · 피흡+4%", bonusStats: { INT: 10, maxMp: 250, drain: 4 } },

      { id: "QR_R08_SW", name: "[퀘스트전용] 서리거인의 빙결검", type: "한손검", pAtk: 162, mAtk: 30, atkSpeed: 0.85, price: 45000, questOnly: true, sellable: true, fixedGrade: 4, effect: "STR+10 · CON+6 · 최대HP+220", bonusStats: { STR: 10, CON: 6, maxHp: 220 } },
      { id: "QR_R08_BW", name: "[퀘스트전용] 만년설 눈보라의 신궁", type: "양손활", pAtk: 154, mAtk: 42, atkSpeed: 0.64, price: 45000, questOnly: true, sellable: true, fixedGrade: 4, effect: "DEX+10 · 치명+8% · 피흡+4%", bonusStats: { DEX: 10, crit: 8, drain: 4 } },
      { id: "QR_R08_ST", name: "[퀘스트전용] 절대영도의 크리스탈봉", type: "양손지팡이", pAtk: 28, mAtk: 190, atkSpeed: 1.15, price: 45000, questOnly: true, sellable: true, fixedGrade: 4, effect: "INT+11 · 최대MP+300", bonusStats: { INT: 11, maxMp: 300 } },

      { id: "QR_R09_SW", name: "[퀘스트전용] 이프리트의 홍련마검", type: "한손검", pAtk: 190, mAtk: 40, atkSpeed: 0.84, price: 62000, questOnly: true, sellable: true, fixedGrade: 4, effect: "STR+12 · 피흡+5% · 치명+6%", bonusStats: { STR: 12, drain: 5, crit: 6 } },
      { id: "QR_R09_BW", name: "[퀘스트전용] 업화의 불사조 장궁", type: "양손활", pAtk: 180, mAtk: 50, atkSpeed: 0.63, price: 62000, questOnly: true, sellable: true, fixedGrade: 4, effect: "DEX+12 · 치명+9% · 명중+8%", bonusStats: { DEX: 12, crit: 9, hit: 8 } },
      { id: "QR_R09_ST", name: "[퀘스트전용] 화염군주의 마석장", type: "양손지팡이", pAtk: 32, mAtk: 225, atkSpeed: 1.12, price: 62000, questOnly: true, sellable: true, fixedGrade: 4, effect: "INT+13 · 최대MP+360 · 치명+6%", bonusStats: { INT: 13, maxMp: 360, crit: 6 } },

      { id: "QR_R10_SW", name: "[퀘스트전용] 리치킹의 칠흑룬검", type: "한손검", pAtk: 222, mAtk: 45, atkSpeed: 0.82, price: 85000, questOnly: true, sellable: true, fixedGrade: 4, effect: "STR+14 · 피흡+5% · 최대HP+320", bonusStats: { STR: 14, drain: 5, maxHp: 320 } },
      { id: "QR_R10_BW", name: "[퀘스트전용] 사령군주의 영혼추적궁", type: "양손활", pAtk: 210, mAtk: 58, atkSpeed: 0.62, price: 85000, questOnly: true, sellable: true, fixedGrade: 4, effect: "DEX+14 · 치명+10% · 피흡+5%", bonusStats: { DEX: 14, crit: 10, drain: 5 } },
      { id: "QR_R10_ST", name: "[퀘스트전용] 영원한 안식의 네크로봉", type: "양손지팡이", pAtk: 38, mAtk: 265, atkSpeed: 1.10, price: 85000, questOnly: true, sellable: true, fixedGrade: 4, effect: "INT+15 · 최대MP+420 · 피흡+5%", bonusStats: { INT: 15, maxMp: 420, drain: 5 } },

      { id: "QR_R11_SW", name: "[퀘스트전용] 천공 뇌신의 폭풍검", type: "한손검", pAtk: 258, mAtk: 55, atkSpeed: 0.80, price: 115000, questOnly: true, sellable: true, fixedGrade: 4, effect: "STR+16 · DEX+6 · 피흡+5%", bonusStats: { STR: 16, DEX: 6, drain: 5 } },
      { id: "QR_R11_BW", name: "[퀘스트전용] 천공 군주의 뇌전궁", type: "양손활", pAtk: 245, mAtk: 68, atkSpeed: 0.60, price: 115000, questOnly: true, sellable: true, fixedGrade: 4, effect: "DEX+16 · 치명+11% · 명중+10%", bonusStats: { DEX: 16, crit: 11, hit: 10 } },
      { id: "QR_R11_ST", name: "[퀘스트전용] 폭풍의 눈 에테르장", type: "양손지팡이", pAtk: 42, mAtk: 310, atkSpeed: 1.08, price: 115000, questOnly: true, sellable: true, fixedGrade: 4, effect: "INT+17 · 최대MP+500", bonusStats: { INT: 17, maxMp: 500 } },

      { id: "QR_R12_SW", name: "[퀘스트전용] 기계신 타이탄의 초합금검", type: "한손검", pAtk: 300, mAtk: 65, atkSpeed: 0.78, price: 150000, questOnly: true, sellable: true, fixedGrade: 4, effect: "STR+18 · CON+10 · 최대HP+450", bonusStats: { STR: 18, CON: 10, maxHp: 450 } },
      { id: "QR_R12_BW", name: "[퀘스트전용] 마공학 초중력 레일보우", type: "양손활", pAtk: 285, mAtk: 80, atkSpeed: 0.58, price: 150000, questOnly: true, sellable: true, fixedGrade: 4, effect: "DEX+18 · 치명+12% · 피흡+5%", bonusStats: { DEX: 18, crit: 12, drain: 5 } },
      { id: "QR_R12_ST", name: "[퀘스트전용] 아크메이지 마공학 코어봉", type: "양손지팡이", pAtk: 48, mAtk: 365, atkSpeed: 1.05, price: 150000, questOnly: true, sellable: true, fixedGrade: 4, effect: "INT+20 · 최대MP+600 · 치명+8%", bonusStats: { INT: 20, maxMp: 600, crit: 8 } },

      { id: "QR_R13_SW", name: "[퀘스트전용] 마신 발록의 심연단죄검", type: "한손검", pAtk: 355, mAtk: 80, atkSpeed: 0.76, price: 200000, questOnly: true, sellable: true, fixedGrade: 4, effect: "STR+22 · 피흡+5% · 최대HP+600", bonusStats: { STR: 22, drain: 5, maxHp: 600 } },
      { id: "QR_R13_BW", name: "[퀘스트전용] 마계 파수꾼의 지옥화살궁", type: "양손활", pAtk: 338, mAtk: 95, atkSpeed: 0.57, price: 200000, questOnly: true, sellable: true, fixedGrade: 4, effect: "DEX+22 · 치명+14% · 피흡+5%", bonusStats: { DEX: 22, crit: 14, drain: 5 } },
      { id: "QR_R13_ST", name: "[퀘스트전용] 차원문 지배자의 마도장", type: "양손지팡이", pAtk: 55, mAtk: 430, atkSpeed: 1.02, price: 200000, questOnly: true, sellable: true, fixedGrade: 4, effect: "INT+24 · 최대MP+750 · 피흡+5%", bonusStats: { INT: 24, maxMp: 750, drain: 5 } },

      { id: "QR_R14_SW", name: "[퀘스트전용] 에이션트 드래곤 슬레이어", type: "한손검", pAtk: 420, mAtk: 100, atkSpeed: 0.75, price: 260000, questOnly: true, sellable: true, fixedGrade: 4, effect: "STR+26 · CON+15 · 피흡+5% · 최대HP+800", bonusStats: { STR: 26, CON: 15, drain: 5, maxHp: 800 } },
      { id: "QR_R14_BW", name: "[퀘스트전용] 고룡의 심장 관통신궁", type: "양손활", pAtk: 400, mAtk: 115, atkSpeed: 0.55, price: 260000, questOnly: true, sellable: true, fixedGrade: 4, effect: "DEX+26 · 치명+16% · 명중+12%", bonusStats: { DEX: 26, crit: 16, hit: 12 } },
      { id: "QR_R14_ST", name: "[퀘스트전용] 용왕의 역린 대마법장", type: "양손지팡이", pAtk: 65, mAtk: 510, atkSpeed: 1.00, price: 260000, questOnly: true, sellable: true, fixedGrade: 4, effect: "INT+28 · 최대MP+950 · 치명+10%", bonusStats: { INT: 28, maxMp: 950, crit: 10 } },

      { id: "QR_R15_SW", name: "[퀘스트전용] 이터니티 창세의 에테르신검", type: "한손검", pAtk: 520, mAtk: 150, atkSpeed: 0.72, price: 350000, questOnly: true, sellable: true, fixedGrade: 4, effect: "STR+35 · CON+20 · 피흡+5% · 최대HP+1200", bonusStats: { STR: 35, CON: 20, drain: 5, maxHp: 1200 } },
      { id: "QR_R15_BW", name: "[퀘스트전용] 이터니티 성좌의 에테르신궁", type: "양손활", pAtk: 495, mAtk: 160, atkSpeed: 0.52, price: 350000, questOnly: true, sellable: true, fixedGrade: 4, effect: "DEX+35 · 치명+20% · 피흡+5% · 명중+15%", bonusStats: { DEX: 35, crit: 20, drain: 5, hit: 15 } },
      { id: "QR_R15_ST", name: "[퀘스트전용] 이터니티 영겁의 에테르신장", type: "양손지팡이", pAtk: 85, mAtk: 640, atkSpeed: 0.95, price: 350000, questOnly: true, sellable: true, fixedGrade: 4, effect: "INT+38 · 최대MP+1500 · 피흡+5% · 치명+15%", bonusStats: { INT: 38, maxMp: 1500, drain: 5, crit: 15 } },

      { id: "QR_HIGH_SW", name: "[퀘스트전용] 에테르 수호기사의 신검", type: "한손검", pAtk: 150, mAtk: 30, atkSpeed: 0.85, price: 40000, questOnly: true, sellable: true, fixedGrade: 4, effect: "STR+10 · 피흡+5% · 최대HP+200", bonusStats: { STR: 10, drain: 5, maxHp: 200 } },
      { id: "QR_HIGH_BW", name: "[퀘스트전용] 에테르 천공의 신궁", type: "양손활", pAtk: 142, mAtk: 38, atkSpeed: 0.65, price: 40000, questOnly: true, sellable: true, fixedGrade: 4, effect: "DEX+10 · 치명+7% · 명중+6%", bonusStats: { DEX: 10, crit: 7, hit: 6 } },
      { id: "QR_HIGH_ST", name: "[퀘스트전용] 에테르 아크메이지 신장", type: "양손지팡이", pAtk: 28, mAtk: 175, atkSpeed: 1.18, price: 40000, questOnly: true, sellable: true, fixedGrade: 4, effect: "INT+10 · 최대MP+250 · 치명+5%", bonusStats: { INT: 10, maxMp: 250, crit: 5 } }
    ],
    Armors: [
      { id: "A_HE01", name: "가죽 헬름", type: "투구", reqLv: 1, def: 2, mDef: 1, price: 150 },
      { id: "A_HE02", name: "사슬 투구", type: "투구", reqLv: 15, def: 6, mDef: 3, price: 500 },
      { id: "A_HE03", name: "강철 투구", type: "투구", reqLv: 40, def: 12, mDef: 7, price: 1500 },
      { id: "A_HE04", name: "미스릴 헬름", type: "투구", reqLv: 80, def: 22, mDef: 14, price: 4500 },
      { id: "A_HE05", name: "드래곤 헬름", type: "투구", reqLv: 150, def: 36, mDef: 24, price: 15000 },
      { id: "A_AR01", name: "낡은 가죽갑옷", type: "갑옷", reqLv: 1, def: 6, mDef: 2, price: 250 },
      { id: "A_AR02", name: "링 메일", type: "갑옷", reqLv: 15, def: 14, mDef: 6, price: 900 },
      { id: "A_AR03", name: "플레이트 메일", type: "갑옷", reqLv: 40, def: 28, mDef: 13, price: 2800 },
      { id: "A_AR04", name: "실버 아머", type: "갑옷", reqLv: 80, def: 46, mDef: 24, price: 8500 },
      { id: "A_AR05", name: "타이탄 아머", type: "갑옷", reqLv: 150, def: 75, mDef: 42, price: 25000 },
      { id: "A_SH01", name: "가죽 부츠", type: "신발", reqLv: 1, def: 2, mDef: 1, price: 120 },
      { id: "A_SH02", name: "징박힌 부츠", type: "신발", reqLv: 15, def: 4, mDef: 2, price: 450 },
      { id: "A_SH03", name: "강철 부츠", type: "신발", reqLv: 40, def: 8, mDef: 5, price: 1200 },
      { id: "A_SH04", name: "요정의 부츠", type: "신발", reqLv: 80, def: 15, mDef: 10, price: 3800 },
      { id: "A_SH05", name: "바람의 발걸음", type: "신발", reqLv: 150, def: 25, mDef: 17, price: 12000 },
      { id: "A_GL01", name: "헝겊 장갑", type: "장갑", reqLv: 1, def: 2, mDef: 1, price: 100 },
      { id: "A_GL02", name: "가죽 장갑", type: "장갑", reqLv: 15, def: 4, mDef: 2, price: 400 },
      { id: "A_GL03", name: "건틀렛", type: "장갑", reqLv: 40, def: 8, mDef: 5, price: 1100 },
      { id: "A_GL04", name: "오우거 장갑", type: "장갑", reqLv: 80, def: 15, mDef: 9, price: 3500 },
      { id: "A_GL05", name: "용기사의 장갑", type: "장갑", reqLv: 150, def: 26, mDef: 16, price: 11000 },
      { id: "A_CL01", name: "낡은 망토", type: "망토", reqLv: 1, def: 2, mDef: 3, price: 150 },
      { id: "A_CL02", name: "여행자 망토", type: "망토", reqLv: 15, def: 4, mDef: 7, price: 500 },
      { id: "A_CL03", name: "수호의 망토", type: "망토", reqLv: 40, def: 8, mDef: 15, price: 1600 },
      { id: "A_CL04", name: "뱀파이어 망토", type: "망토", reqLv: 80, def: 14, mDef: 26, drain: 2, price: 5500 },
      { id: "A_CL05", name: "대천사의 날개", type: "망토", reqLv: 150, def: 24, mDef: 40, price: 18000 },
      { id: "A_BE01", name: "밧줄 벨트", type: "벨트", reqLv: 1, weight: 10, def: 1, mDef: 1, price: 200 },
      { id: "A_BE02", name: "가죽 벨트", type: "벨트", reqLv: 15, weight: 20, def: 3, mDef: 2, price: 600 },
      { id: "A_BE03", name: "징박힌 벨트", type: "벨트", reqLv: 40, weight: 30, def: 6, mDef: 5, price: 1800 },
      { id: "A_BE04", name: "트롤의 벨트", type: "벨트", reqLv: 80, weight: 50, def: 10, mDef: 9, price: 6000 },
      { id: "A_BE05", name: "타이탄의 벨트", type: "벨트", reqLv: 150, weight: 100, def: 18, mDef: 16, price: 20000 },
      { id: "A_TS01", name: "낡은 면티", type: "티셔츠", reqLv: 1, def: 2, mDef: 2, price: 100 },
      { id: "A_TS02", name: "실크 티셔츠", type: "티셔츠", reqLv: 20, def: 5, mDef: 6, price: 400 },
      { id: "A_TS03", name: "요정의 티셔츠", type: "티셔츠", reqLv: 50, def: 10, mDef: 12, price: 1500 }
    ],
    Accessories: [
      { id: "AC_N01", name: "뼈 목걸이", type: "목걸이", reqLv: 1, def: 1, mDef: 3, effect: "마방+3 · HP+25", bonusStats: { maxHp: 25 }, price: 500 },
      { id: "AC_N02", name: "은 목걸이", type: "목걸이", reqLv: 25, def: 3, mDef: 7, effect: "방어+3 · 마방+7 · MP+20", bonusStats: { maxMp: 20 }, price: 1500 },
      { id: "AC_N03", name: "루비 목걸이", type: "목걸이", reqLv: 55, def: 4, mDef: 12, effect: "마방+12 · STR+2 · HP+40", bonusStats: { STR: 2, maxHp: 40 }, price: 3000 },
      { id: "AC_N04", name: "사파이어 목걸이", type: "목걸이", reqLv: 55, def: 4, mDef: 15, effect: "마방+15 · INT+2 · MP+50", bonusStats: { INT: 2, maxMp: 50 }, price: 3000 },
      { id: "AC_N05", name: "빛의 목걸이", type: "목걸이", reqLv: 120, def: 8, mDef: 26, effect: "마방+26 · 올스탯+3 · 피흡+2%", bonusStats: { STR: 3, DEX: 3, INT: 3, CON: 3, drain: 2 }, price: 15000 },
      { id: "AC_E01", name: "구리 귀걸이", type: "귀걸이", reqLv: 1, def: 2, mDef: 2, effect: "방어+2 · 마방+2", price: 500 },
      { id: "AC_E02", name: "은 귀걸이", type: "귀걸이", reqLv: 25, def: 4, mDef: 6, effect: "방어+4 · 마방+6", price: 1500 },
      { id: "AC_E03", name: "오크 귀걸이", type: "귀걸이", reqLv: 55, def: 5, mDef: 10, effect: "마방+10 · HP+45 · STR+1", bonusStats: { maxHp: 45, STR: 1 }, price: 3000 },
      { id: "AC_E04", name: "엘프 귀걸이", type: "귀걸이", reqLv: 55, def: 5, mDef: 13, effect: "마방+13 · MP+45 · DEX+1", bonusStats: { maxMp: 45, DEX: 1 }, price: 3000 },
      { id: "AC_E05", name: "지휘관 귀걸이", type: "귀걸이", reqLv: 120, def: 7, mDef: 22, effect: "마방+22 · 공격력+6 · 명중+3%", pAtk: 6, mAtk: 6, bonusStats: { hit: 3 }, price: 15000 },
      { id: "AC_R01", name: "구리 반지", type: "반지", reqLv: 1, def: 1, mDef: 3, effect: "마방+3 · 명중+2%", bonusStats: { hit: 2 }, price: 400 },
      { id: "AC_R02", name: "수호 반지", type: "반지", reqLv: 25, def: 3, mDef: 8, effect: "방어+3 · 마방+8", price: 1200 },
      { id: "AC_R03", name: "저항 반지", type: "반지", reqLv: 55, def: 5, mDef: 15, effect: "방어+5 · 마방+15 · HP+30", bonusStats: { maxHp: 30 }, price: 3500 },
      { id: "AC_R04", name: "심연 반지", type: "반지", reqLv: 95, def: 6, mDef: 22, effect: "마방+22 · MP+60 · 치명+3%", bonusStats: { maxMp: 60, crit: 3 }, price: 8000 },
      { id: "AC_R05", name: "절대 반지", type: "반지", reqLv: 150, def: 10, mDef: 32, effect: "마방+32 · 올스탯+4 · 치명+4%", bonusStats: { STR: 4, DEX: 4, INT: 4, CON: 4, crit: 4 }, price: 30000 }
    ],
    Consumables: [
      { id: "C_P01", name: "하급 체력 물약", type: "물약", healHp: 95, price: 30, effect: "HP +95 회복", cool: 0.5 },
      { id: "C_P02", name: "상급 체력 물약", type: "물약", healHp: 330, price: 120, effect: "HP +330 회복", cool: 0.5 },
      { id: "C_P03", name: "하급 마나 물약", type: "물약", healMp: 60, price: 40, effect: "MP +60 회복", cool: 0.5 },
      { id: "C_P04", name: "상급 마나 물약", type: "물약", healMp: 185, price: 150, effect: "MP +185 회복", cool: 0.5 },
      { id: "C_P05", name: "용사의 비약", type: "버프물약", price: 300, dur: 600, atkBoostPct: 12, speedBoostPct: 8, effect: "10분간 공격력+12% · 공속+8%", cool: 0.5 },
      { id: "S_RE01", name: "귀환 주문서", type: "주문서", price: 100, effect: "현재 지역 안전지대로 즉시 귀환", cool: 2 },
      { id: "S_WE01", name: "무기 마법 주문서", type: "주문서", price: 1500, safeLimit: 6, effect: "무기 강화 (+6까지 안전)", cool: 0 },
      { id: "S_AR01", name: "갑옷 마법 주문서", type: "주문서", price: 1200, safeLimit: 4, effect: "방어구·장신구 강화 (+4까지 안전)", cool: 0 }
    ],
    QuestItems: [
      { id: "Q_I01", name: "고블린 족장의 이빨", type: "전리품", price: 1000, effect: "상점에 판매 가능한 희귀 전리품", note: "알트리아 퀘스트" },
      { id: "Q_I02", name: "정화된 세계수 잎", type: "전리품", price: 1000, effect: "상점에 판매 가능한 희귀 전리품", note: "실버바인 퀘스트" },
      { id: "Q_I03", name: "붉은 협곡 광석", type: "전리품", price: 1000, effect: "상점에 판매 가능한 희귀 전리품", note: "칼라드루 퀘스트" },
      { id: "Q_I04", name: "가라앉은 여신의 눈물", type: "전리품", price: 1500, effect: "상점에 판매 가능한 희귀 전리품", note: "엘론드 퀘스트" },
      { id: "Q_I05", name: "파라오의 황금 열쇠", type: "전리품", price: 2200, effect: "상점에 판매 가능한 희귀 전리품", note: "모라안 퀘스트" }
    ]
  },

  // 5. 스킬 및 마법 DB (전수조사 완료: 하늘 낙하형 skyDrop 플래그 및 공격/버프/힐링/유틸 구분)
  Skills: {
    Mage: [
      // 패시브 (0서클 - 레벨별 해금: Lv.1 / Lv.12 / Lv.28)
      { id: "MP1", circle: 0, reqLv: 1,  npcLearn: true, learnGold: 0,   name: "스태프 마스터리", type: "패시브", range: "-", mp: 0, cool: 0, reqWeapon: "staff", bonusMAtk: 12, bonusHit: 3, effect: "[요구 Lv.1] 지팡이 착용 시 마법공격력 +12, 명중 +3% 상시 증가", dur: -1 },
      { id: "MP2", circle: 0, reqLv: 12, npcLearn: true, learnGold: 300, name: "마나 스트림",     type: "패시브", range: "-", mp: 0, cool: 0, bonusMaxMpPct: 15, bonusMpRegen: 6, effect: "[요구 Lv.12] 최대 MP +15%, 자연 마나 회복량 +6 상시 증가", dur: -1 },
      { id: "MP3", circle: 0, reqLv: 28, npcLearn: true, learnGold: 800, name: "아케인 위즈덤",   type: "패시브", range: "-", mp: 0, cool: 0, bonusCrit: 7, bonusCoolReduce: 6, effect: "[요구 Lv.28] 마법 치명타율 +7%, 모든 마법 쿨타임 -6% 상시 적용", dur: -1 },
      // 1서클 (M01 ~ M08)
      { id: "M01", circle: 1, reqLv: 1, npcLearn: true, learnGold: 0,   name: "매직 미사일", type: "공격", range: "단일", mp: 3,  cool: 0.5, mult: 1.28, effect: "마법공격력의 128% 비전 탄환", dur: 0 },
      { id: "M02", circle: 1, reqLv: 1, npcLearn: true, learnGold: 0,   name: "파이어 애로우", type: "공격", range: "단일", mp: 5,  cool: 0.9, mult: 1.55, effect: "마공 155% 화염 화살 + 화상(3초)", dur: 3 },
      { id: "M03", circle: 1, reqLv: 2, npcLearn: true, learnGold: 150, name: "아이스 다트", type: "공격", range: "단일", mp: 4,  cool: 0.9, mult: 1.40, effect: "마공 140% 빙결창 + 이속감소(2초)", dur: 2 },
      { id: "M04", circle: 1, reqLv: 4, npcLearn: true, learnGold: 200, name: "윈드 컷", type: "공격", range: "광역", mp: 8,  cool: 1.6, mult: 1.25, maxTargets: 3, effect: "마공 125% 칼바람 (광역 3명)", dur: 0 },
      { id: "M05", circle: 1, reqLv: 3, npcLearn: true, learnGold: 150, name: "라이트", type: "버프", buffKey: "LIGHT", bonusHit: 5, bonusMDef: 5, allyCast: true, range: "아군/본인", mp: 4,  cool: 2.0, effect: "대상(본인/용병/타플레이어) 명중률 +5% · 마법방어 +5 증가 (600초)", dur: 600 },
      { id: "M06", circle: 1, reqLv: 5, npcLearn: true, learnGold: 250, name: "쉴드", type: "버프", buffKey: "SHIELD", bonusDef: 8, bonusMDef: 8, allyCast: true, range: "아군/본인", mp: 10, cool: 3.5, effect: "대상(본인/용병/타플레이어) 물리·마법 방어력 +8 (300초)", dur: 300 },
      { id: "M07", circle: 1, reqLv: 4, npcLearn: true, learnGold: 250, name: "힐링", type: "힐링", allyCast: true, range: "아군/본인", mp: 10, cool: 1.8, healFixed: 95, effect: "대상(본인/용병/타플레이어)의 HP를 즉시 회복", dur: 0 },
      { id: "M08", circle: 1, reqLv: 6, npcLearn: true, learnGold: 300, name: "텔레포트", type: "유틸", range: "본인", mp: 10, cool: 1.5, effect: "주변 안전 위치로 공간 도약", dur: 0 },
      // 2서클 (M09 ~ M16)
      { id: "M09", circle: 2, reqLv: 10, npcLearn: true, learnGold: 600, name: "파이어 볼", type: "공격", range: "광역", mp: 14, cool: 2.2, mult: 1.90, maxTargets: 5, effect: "마공 190% 화염 폭발 (광역 5명)", dur: 0 },
      { id: "M10", circle: 2, reqLv: 9,  npcLearn: true, learnGold: 500, name: "콜드 빔", type: "공격", range: "단일", mp: 12, cool: 1.5, mult: 2.05, effect: "마공 205% 극저온 냉기 광선", dur: 0 },
      { id: "M11", circle: 2, reqLv: 10, npcLearn: true, learnGold: 550, name: "라이트닝", type: "공격", skyDrop: true, range: "단일", mp: 14, cool: 1.8, mult: 2.25, effect: "마공 225% 하늘에서 내리꽂히는 콜라이트닝 낙뢰 강타", dur: 0 },
      { id: "M12", circle: 2, reqLv: 11, npcLearn: true, learnGold: 500, name: "커스 포이즌", type: "디버프", range: "단일", mp: 10, cool: 3.2, mult: 1.65, effect: "마공 165% 맹독 저주 (15초)", dur: 15 },
      { id: "M13", circle: 2, reqLv: 12, npcLearn: true, learnGold: 700, name: "그레이트 힐", type: "힐링", allyCast: true, range: "아군/본인", mp: 20, cool: 2.2, healFixed: 225, effect: "고위 성마법으로 대상(본인/용병/타플레이어) HP 대량 회복", dur: 0 },
      { id: "M14", circle: 2, reqLv: 12, npcLearn: true, learnGold: 650, name: "인챈트 스탯", type: "버프", buffKey: "ENCHANT_STAT", bonusAllStat: 2, allyCast: true, range: "아군/본인", mp: 25, cool: 4.0, effect: "대상(본인/용병/타플레이어) STR, DEX, INT +2 (300초)", dur: 300 },
      { id: "M15", circle: 2, reqLv: 13, npcLearn: true, learnGold: 650, name: "멘탈 포커스", type: "버프", buffKey: "MENTAL_FOCUS", bonusMpRegen: 8, allyCast: true, range: "아군/본인", mp: 20, cool: 5.0, effect: "대상 마나 자연 회복량 +8 (300초)", dur: 300 },
      { id: "M16", circle: 2, reqLv: 11, npcLearn: true, learnGold: 500, name: "블라인드", type: "디버프", range: "단일", mp: 14, cool: 3.5, mult: 1.45, effect: "암흑 구체 + 적 명중률 감소 (10초)", dur: 10 },
      // 3서클 (M17 ~ M24)
      { id: "M17", circle: 3, npcLearn: false, dropMinLv: 18, dropMaxLv: 65, name: "파이어 월", type: "공격", range: "광역", mp: 28, cool: 4.5, mult: 2.30, maxTargets: 5, effect: "마공 230% 화염 장벽 (광역 5명)", dur: 5 },
      { id: "M18", circle: 3, npcLearn: false, dropMinLv: 20, dropMaxLv: 70, name: "아이스 스톰", type: "공격", skyDrop: true, range: "광역", mp: 32, cool: 5.0, mult: 2.55, maxTargets: 6, effect: "마공 255% 상공 눈보라 폭풍 낙하 + 동결(2초)", dur: 2 },
      { id: "M19", circle: 3, npcLearn: false, dropMinLv: 22, dropMaxLv: 75, name: "체인 라이트닝", type: "공격", skyDrop: true, range: "광역", mp: 30, cool: 3.8, mult: 2.25, maxTargets: 4, effect: "마공 225% 낙뢰 및 연쇄 번개 (4명)", dur: 0 },
      { id: "M20", circle: 3, npcLearn: false, dropMinLv: 24, dropMaxLv: 75, name: "뱀파이어 터치", type: "공격", range: "단일", mp: 22, cool: 3.2, mult: 1.85, drainPct: 50, effect: "마공 185%, 피해량 50% 생명력 흡수", dur: 0 },
      { id: "M21", circle: 3, npcLearn: false, dropMinLv: 20, dropMaxLv: 70, name: "슬립", type: "디버프", range: "단일", mp: 18, cool: 6.0, mult: 1.35, stunSec: 3.5, effect: "수면 마법으로 3.5초 행동불가", dur: 4 },
      { id: "M22", circle: 3, npcLearn: false, dropMinLv: 25, dropMaxLv: 80, name: "사일런스", type: "디버프", range: "단일", mp: 20, cool: 6.5, mult: 1.50, effect: "적 마법 봉인 및 충격 (6초)", dur: 6 },
      { id: "M23", circle: 3, npcLearn: false, dropMinLv: 22, dropMaxLv: 85, name: "헤이스트", type: "버프", buffKey: "HASTE", speedPct: 30, atkSpeedPct: 30, allyCast: true, range: "아군/본인", mp: 35, cool: 4.0, effect: "대상(본인/용병/타플레이어) 공·이속 30% 증가 (300초)", dur: 300 },
      { id: "M24", circle: 3, npcLearn: false, dropMinLv: 28, dropMaxLv: 90, name: "마나 실드", type: "버프", buffKey: "MANA_SHIELD", range: "본인", mp: 40, cool: 10.0, effect: "받는 피해의 50%를 MP로 대신 흡수 (300초)", dur: 300 },
      // 4서클 (M25 ~ M33)
      { id: "M25", circle: 4, npcLearn: false, dropMinLv: 50, dropMaxLv: 130, name: "메테오(소)", type: "공격", skyDrop: true, range: "광역", mp: 48, cool: 6.5, mult: 3.50, maxTargets: 6, effect: "마공 350% 하늘에서 거대 운석 낙하 (광역 6명)", dur: 0 },
      { id: "M26", circle: 4, npcLearn: false, dropMinLv: 52, dropMaxLv: 130, name: "이럽션", type: "공격", range: "단일", mp: 38, cool: 2.8, mult: 3.80, effect: "마공 380% 대지 용암 분출", dur: 0 },
      { id: "M27", circle: 4, npcLearn: false, dropMinLv: 55, dropMaxLv: 135, name: "콘 오브 콜드", type: "공격", range: "광역", mp: 42, cool: 4.8, mult: 2.90, maxTargets: 5, effect: "마공 290% 부채꼴 절대냉기", dur: 2 },
      { id: "M28", circle: 4, npcLearn: false, dropMinLv: 55, dropMaxLv: 135, name: "디스펠 매직", type: "디버프", range: "단일", mp: 28, cool: 5.5, mult: 2.10, defDown: true, effect: "마공 210% + 적 방어력 약화 (10초)", dur: 10 },
      { id: "M29", circle: 4, npcLearn: false, dropMinLv: 60, dropMaxLv: 140, name: "커스 파럴라이즈", type: "디버프", range: "단일", mp: 35, cool: 7.5, mult: 1.80, stunSec: 3.5, effect: "마공 180% + 마비 3.5초", dur: 4 },
      { id: "M30", circle: 4, npcLearn: false, dropMinLv: 58, dropMaxLv: 140, name: "홀리 워크", type: "버프", buffKey: "HOLY_WALK", speedPct: 50, allyCast: true, range: "아군/본인", mp: 30, cool: 5.0, effect: "이동속도 50% 쾌속 증가 (120초)", dur: 120 },
      { id: "M31", circle: 4, npcLearn: false, dropMinLv: 55, dropMaxLv: 135, name: "마나 드레인", type: "공격", range: "단일", mp: 18, cool: 4.5, mult: 1.95, mpDrain: 55, effect: "마공 195% + MP 55 흡수", dur: 0 },
      { id: "M32", circle: 4, npcLearn: false, dropMinLv: 62, dropMaxLv: 145, name: "쉐도우 팽", type: "버프", buffKey: "SHADOW_FANG", bonusAtk: 15, bonusMAtk: 15, allyCast: true, range: "아군/본인", mp: 40, cool: 5.0, effect: "대상(본인/용병/타플레이어) 공격력 +15 (300초)", dur: 300 },
      { id: "M33", circle: 4, npcLearn: false, dropMinLv: 65, dropMaxLv: 150, name: "아이스 스파이크", type: "공격", range: "단일", mp: 40, cool: 3.2, mult: 3.50, defDown: true, effect: "마공 350% 얼음 가시 + 방깎(8초)", dur: 8 },
      // 5서클 (M34 ~ M42)
      { id: "M34", circle: 5, npcLearn: false, dropMinLv: 100, dropMaxLv: 220, name: "뮨 (Immune)", type: "버프", buffKey: "IMMUNE", dmgReducePct: 45, allyCast: true, range: "아군/본인", mp: 75, cool: 18.0, effect: "대상 신성 결계로 받는 피해 45% 감소 (20초)", dur: 20 },
      { id: "M35", circle: 5, npcLearn: false, dropMinLv: 105, dropMaxLv: 220, name: "데스 레이", type: "공격", range: "단일", mp: 65, cool: 5.5, mult: 5.40, ignoreDef: true, effect: "방어 관통 마공 540% 죽음의 광선", dur: 0 },
      { id: "M36", circle: 5, npcLearn: false, dropMinLv: 110, dropMaxLv: 230, name: "블리자드", type: "공격", skyDrop: true, range: "광역", mp: 85, cool: 8.5, mult: 4.10, maxTargets: 8, stunSec: 2.0, effect: "마공 410% 상공 극지 폭설 낙하(8명) + 빙결", dur: 3 },
      { id: "M37", circle: 5, npcLearn: false, dropMinLv: 115, dropMaxLv: 230, name: "라이트닝 스톰", type: "공격", skyDrop: true, range: "광역", mp: 80, cool: 7.5, mult: 4.40, maxTargets: 6, stunSec: 1.5, effect: "마공 440% 하늘에서 쏟아지는 뇌전 폭풍 + 기절(1.5초)", dur: 1.5 },
      { id: "M38", circle: 5, npcLearn: false, dropMinLv: 120, dropMaxLv: 240, name: "앱솔루트 배리어", type: "버프", buffKey: "ABSOLUTE_BARRIER", range: "본인", mp: 110, cool: 28.0, effect: "8초간 모든 피해 완전 무적 배리어", dur: 8 },
      { id: "M39", circle: 5, npcLearn: false, dropMinLv: 105, dropMaxLv: 220, name: "매스 텔레포트", type: "유틸", range: "본인", mp: 55, cool: 8.0, effect: "용병과 함께 안전 구역 순간이동", dur: 0 },
      { id: "M40", circle: 5, npcLearn: false, dropMinLv: 115, dropMaxLv: 230, name: "어스 바인드", type: "디버프", range: "광역", mp: 60, cool: 10.0, mult: 2.40, stunSec: 3.5, effect: "주변 적 대지 속박 3.5초 행동불가", dur: 4 },
      { id: "M41", circle: 5, npcLearn: false, dropMinLv: 120, dropMaxLv: 240, name: "어드밴스드 스피릿", type: "버프", buffKey: "ADV_SPIRIT", bonusMaxHpMpPct: 20, allyCast: true, range: "아군/본인", mp: 70, cool: 8.0, effect: "대상(본인/용병/타플레이어) 최대 HP/MP 20% 증가 (300초)", dur: 300 },
      { id: "M42", circle: 5, npcLearn: false, dropMinLv: 125, dropMaxLv: 250, name: "서먼 몬스터", type: "버프", buffKey: "SUMMON_GOLEM", range: "본인", mp: 85, cool: 18.0, effect: "수호 골렘 소환 자동 지원공격 (120초)", dur: 120 },
      // 6서클 (M43 ~ M50)
      { id: "M43", circle: 6, npcLearn: false, dropMinLv: 170, dropMaxLv: 999, name: "미티어 스웜", type: "공격", skyDrop: true, range: "광역", mp: 130, cool: 12.0, mult: 6.80, maxTargets: 10, effect: "마공 680% 대기권 대회전 유성우 폭격 (10명)", dur: 0 },
      { id: "M44", circle: 6, npcLearn: false, dropMinLv: 175, dropMaxLv: 999, name: "앱솔루트 제로", type: "공격", skyDrop: true, range: "광역", mp: 120, cool: 11.0, mult: 5.80, maxTargets: 8, stunSec: 2.5, effect: "마공 580% 절대영도 빙하 낙하 + 완전동결(2.5초)", dur: 3 },
      { id: "M45", circle: 6, npcLearn: false, dropMinLv: 180, dropMaxLv: 999, name: "헬 파이어", type: "공격", range: "단일", mp: 110, cool: 7.0, mult: 8.20, effect: "마공 820% 지옥 화염 단일 극딜", dur: 0 },
      { id: "M46", circle: 6, npcLearn: false, dropMinLv: 185, dropMaxLv: 999, name: "둠", type: "디버프", skyDrop: true, range: "단일", mp: 95, cool: 12.0, mult: 5.20, defDown: true, effect: "마공 520% 천공 파멸의 심판 낙하 + 방어 붕괴", dur: 10 },
      { id: "M47", circle: 6, npcLearn: false, dropMinLv: 200, dropMaxLv: 999, name: "타임 스탑", type: "디버프", range: "광역", mp: 150, cool: 25.0, mult: 3.20, stunSec: 4.5, maxTargets: 8, effect: "주변 모든 적 4.5초간 시간정지", dur: 5 },
      { id: "M48", circle: 6, npcLearn: false, dropMinLv: 190, dropMaxLv: 999, name: "카오스 필드", type: "공격", skyDrop: true, range: "광역", mp: 140, cool: 13.0, mult: 5.20, ignoreDef: true, maxTargets: 10, effect: "방어 무시 마공 520% 차원 공허 폭격 낙하", dur: 0 },
      { id: "M49", circle: 6, npcLearn: false, dropMinLv: 210, dropMaxLv: 999, name: "워드 오브 데스", type: "공격", skyDrop: true, range: "단일", mp: 160, cool: 16.0, mult: 7.20, instantKillChance: 12, effect: "마공 720% 천공 사신의 단두대 낙하 (일반몹 12% 즉사)", dur: 0 },
      { id: "M50", circle: 6, npcLearn: false, dropMinLv: 220, dropMaxLv: 999, name: "아크메이지 폼", type: "버프", buffKey: "ARCHMAGE", coolReduceMult: 0.5, range: "본인", mp: 140, cool: 35.0, effect: "30초간 모든 마법 쿨타임 50% 감소", dur: 30 }
    ],
    Archer: [
      // 패시브(0서클) & 1서클 (요정 밸런스 정밀 상향 패치 적용)
      { id: "AS1", circle: 0, reqLv: 1,  npcLearn: true, learnGold: 0,   name: "보우 마스터리", type: "패시브", range: "-", mp: 0, cool: 0, reqWeapon: "bow", bonusAtk: 18, bonusHit: 5, effect: "[요구 Lv.1] 활 장착 시 물리공격력 +18, 명중 +5% 상시 증가", dur: -1 },
      { id: "AS4", circle: 0, reqLv: 12, npcLearn: true, learnGold: 300, name: "크리티컬 에임", type: "패시브", range: "-", mp: 0, cool: 0, bonusCrit: 10, bonusEvade: 6, effect: "[요구 Lv.12] 치명타 확률 +10%, 회피율 +6% 상시 증가", dur: -1 },
      { id: "AS5", circle: 0, reqLv: 28, npcLearn: true, learnGold: 800, name: "데들리 포커스", type: "패시브", range: "-", mp: 0, cool: 0, bonusCritDmgPct: 32, bonusArmorPen: 10, effect: "[요구 Lv.28] 치명타 피해 +32%, 방어관통 +10% 상시 증가", dur: -1 },
      { id: "A04", circle: 1, reqLv: 1,  npcLearn: true, learnGold: 0,   name: "파이어 샷", type: "공격", range: "단일", mp: 6,  cool: 1.2, mult: 1.70, effect: "물공 170% 화염 화살 사격 + 화상(3초)", dur: 3 },
      { id: "AS2", circle: 1, reqLv: 1,  npcLearn: true, learnGold: 0,   name: "더블 샷", type: "액티브", range: "단일", mp: 9,  cool: 1.5, mult: 1.18, hits: 2, effect: "연속 2회 초고속 사격 (118% x 2타 = 236%)", dur: 0 },
      { id: "A01", circle: 1, reqLv: 3,  npcLearn: true, learnGold: 200, name: "네이처스 터치", type: "힐링", allyCast: true, range: "아군/본인", mp: 10, cool: 1.8, healFixed: 150, effect: "자연의 치유력으로 대상(본인/용병/타플레이어) HP 즉시 대량 회복", dur: 0 },
      { id: "A02", circle: 1, reqLv: 4,  npcLearn: true, learnGold: 200, name: "인탱글", type: "디버프", range: "단일", mp: 10, cool: 3.5, mult: 1.75, stunSec: 2.2, defDown: true, effect: "덩굴 속박 물공 175% + 2.2초 속박 및 방어약화", dur: 4 },
      { id: "A03", circle: 1, reqLv: 5,  npcLearn: true, learnGold: 250, name: "이글 아이", type: "버프", buffKey: "EAGLE_EYE", bonusRange: 65, bonusHit: 8, bonusCrit: 6, bonusAtk: 10, allyCast: true, range: "아군/본인", mp: 14, cool: 3.5, effect: "사거리+65 · 명중+8% · 치명+6% · 공격력+10 (300초)", dur: 300 },
      { id: "A05", circle: 1, reqLv: 6,  npcLearn: true, learnGold: 250, name: "윈드 워크", type: "버프", buffKey: "WIND_WALK", speedPct: 25, atkSpeedPct: 12, allyCast: true, range: "아군/본인", mp: 12, cool: 3.5, effect: "대상 이동속도 25% · 공격속도 12% 증가 (300초)", dur: 300 },
      { id: "AS3", circle: 1, reqLv: 7,  npcLearn: true, learnGold: 300, name: "닷지 스텝", type: "유틸", range: "본인", mp: 10, cool: 3.0, effect: "후방으로 즉시 회피 도약", dur: 0 },
      // 2서클 (A06 ~ A10)
      { id: "A06", circle: 2, npcLearn: false, dropMinLv: 15, dropMaxLv: 80, name: "멀티 샷", type: "공격", range: "광역", mp: 15, cool: 2.2, mult: 1.75, maxTargets: 5, effect: "물공 175% 부채꼴 연사 (광역 5명)", dur: 0 },
      { id: "A07", circle: 2, npcLearn: false, dropMinLv: 18, dropMaxLv: 85, name: "아이스 샷", type: "공격", range: "단일", mp: 14, cool: 2.5, mult: 2.05, stunSec: 2.2, effect: "물공 205% 빙결 화살 + 동결(2.2초)", dur: 2.5 },
      { id: "A08", circle: 2, npcLearn: false, dropMinLv: 24, dropMaxLv: 95, name: "피어스 애로우", type: "공격", range: "단일", mp: 18, cool: 2.8, mult: 2.45, ignoreDef: true, effect: "방어력 무시 물공 245% 관통 화살", dur: 0 },
      { id: "A09", circle: 2, npcLearn: false, dropMinLv: 28, dropMaxLv: 100, name: "엘븐 그레이스", type: "버프", buffKey: "ELVEN_GRACE", bonusEvade: 25, bonusMDef: 16, allyCast: true, range: "아군/본인", mp: 22, cool: 5.0, effect: "엘프의 가호로 회피율 +25% · 마법방어 +16 (240초)", dur: 240 },
      { id: "A10", circle: 2, npcLearn: false, dropMinLv: 32, dropMaxLv: 110, name: "사일런스 애로우", type: "디버프", range: "단일", mp: 18, cool: 4.5, mult: 2.00, defDown: true, effect: "물공 200% + 적 마법 봉인 및 방어약화 (4초)", dur: 4 },
      // 3서클 (A11 ~ A15)
      { id: "A11", circle: 3, npcLearn: false, dropMinLv: 60, dropMaxLv: 999, name: "애로우 레인", type: "공격", skyDrop: true, range: "광역", mp: 34, cool: 4.5, mult: 3.10, maxTargets: 7, effect: "물공 310% 하늘에서 쏟아지는 화살 폭우 (광역 7명)", dur: 0 },
      { id: "A12", circle: 3, npcLearn: false, dropMinLv: 65, dropMaxLv: 999, name: "네이처스 퓨리", type: "버프", buffKey: "NATURES_FURY", atkSpeedPct: 35, bonusAtk: 15, allyCast: true, range: "아군/본인", mp: 35, cool: 8.0, effect: "공격속도 35% · 물리공격력 +15 폭풍 증가 (180초)", dur: 180 },
      { id: "A13", circle: 3, npcLearn: false, dropMinLv: 75, dropMaxLv: 999, name: "스나이퍼 샷", type: "공격", range: "단일", mp: 42, cool: 5.5, mult: 4.50, forceCrit: true, ignoreDef: true, effect: "방어무시 물공 450% 필살 저격 (100% 확정 치명타)", dur: 0 },
      { id: "A14", circle: 3, npcLearn: false, dropMinLv: 80, dropMaxLv: 999, name: "소울 배리어", type: "버프", buffKey: "SOUL_BARRIER", bonusEvade: 50, bonusMDef: 35, dmgReducePct: 25, allyCast: true, range: "아군/본인", mp: 45, cool: 16.0, effect: "영혼 장막으로 회피율+50% · 마방+35 · 피해감소 25% (25초)", dur: 25 },
      { id: "A15", circle: 3, npcLearn: false, dropMinLv: 70, dropMaxLv: 999, name: "게일 샷", type: "공격", range: "단일", mp: 38, cool: 4.2, mult: 3.60, knockback: true, effect: "물공 360% 질풍 탄환 + 강풍 넉백", dur: 0 }
    ],
    Warrior: [
      // 패시브(0서클) & 1서클
      { id: "W01", circle: 0, reqLv: 1,  npcLearn: true, learnGold: 0,   name: "소드 마스터리", type: "패시브", range: "-", mp: 0, cool: 0, reqWeapon: "sword", bonusAtk: 12, bonusHit: 3, effect: "[요구 Lv.1] 검 착용 시 물리공격력 +12, 명중 +3% 상시 증가", dur: -1 },
      { id: "W03", circle: 0, reqLv: 12, npcLearn: true, learnGold: 300, name: "디펜스 오라", type: "패시브", range: "-", mp: 0, cool: 0, bonusDef: 8, bonusMDef: 6, bonusBlock: 6, effect: "[요구 Lv.12] 물리방어 +8, 마법방어 +6, 방패 블록률 +6% 상시 증가", dur: -1 },
      { id: "W08", circle: 0, reqLv: 28, npcLearn: true, learnGold: 800, name: "터프니스", type: "패시브", range: "-", mp: 0, cool: 0, bonusMaxHpPct: 18, bossDmgReducePct: 5, effect: "[요구 Lv.28] 최대 HP +18%, 보스 피격 피해 -5% 상시 적용", dur: -1 },
      { id: "W02", circle: 1, reqLv: 1,  npcLearn: true, learnGold: 0,   name: "배쉬", type: "액티브", range: "단일", mp: 8,  cool: 2.2, mult: 1.75, stunSec: 1.2, effect: "물공 175% 강타 + 기절 1.2초", dur: 0 },
      { id: "W04", circle: 1, reqLv: 1,  npcLearn: true, learnGold: 0,   name: "실드 스트라이크", type: "액티브", range: "단일", mp: 12, cool: 3.2, mult: 1.55, stunSec: 2.0, reqShield: true, effect: "방패 장착 시 물공 155% + 기절 2초", dur: 0 },
      // 2서클 (W05 ~ W07)
      { id: "W05", circle: 2, npcLearn: false, dropMinLv: 15, dropMaxLv: 85, name: "휠윈드", type: "액티브", range: "광역", mp: 22, cool: 4.0, mult: 1.25, hits: 3, maxTargets: 5, effect: "주변 광역 회전베기 물공 125% x 3타", dur: 0 },
      { id: "W06", circle: 2, npcLearn: false, dropMinLv: 22, dropMaxLv: 95, name: "레이지", type: "버프", buffKey: "RAGE", atkMultPct: 32, defPenaltyPct: 18, range: "본인", mp: 0, hpCostPct: 6, cool: 14.0, effect: "HP 6% 소모, 물공 32% 증가 (35초)", dur: 35 },
      { id: "W07", circle: 2, npcLearn: false, dropMinLv: 20, dropMaxLv: 90, name: "차지", type: "액티브", range: "단일", mp: 16, cool: 4.5, mult: 2.10, dash: true, stunSec: 1.5, effect: "대상에게 즉시 돌진 타격(210%) + 기절 1.5초", dur: 0 },
      // 3서클 (W09 ~ W10)
      { id: "W09", circle: 3, npcLearn: false, dropMinLv: 55, dropMaxLv: 999, name: "카운터 어택", type: "버프", buffKey: "COUNTER", range: "본인", mp: 22, cool: 7.5, effect: "5초간 다음 피격 무시 후 250% 치명 반격", dur: 5 },
      { id: "W10", circle: 3, npcLearn: false, dropMinLv: 65, dropMaxLv: 999, name: "워크라이", type: "디버프", range: "광역", mp: 28, cool: 8.5, mult: 1.85, maxTargets: 6, defDown: true, effect: "전장의 포효 광역 185% + 적 방어력 약화(12초)", dur: 12 }
    ]
  },

  // 6. 몬스터 DB (초고속 레벨업 방지를 위해 구간별 경험치 정밀 리밸런싱 완료)
  Monsters: [
    // R01 알트리아 (Lv.1~20)
    { id: 101,  name: "초원 슬라임", lv: 2,  region: "R01", zone: "south_plains", aggro: "N", type: "물리", hp: 90,   mp: 0,   atk: 13, def: 3,  exp: 18,   drop: ["C_P01", "W_SW01", "W_BW01", "W_ST01", "A_TS01"] },
    { id: 1011, name: "푸른 초원 슬라임", lv: 4,  region: "R01", zone: "south_plains", aggro: "N", type: "물리", hp: 155,  mp: 0,   atk: 19, def: 5,  exp: 30,   drop: ["C_P01", "A_GL01", "A_SH01", "A_CL01"] },
    { id: 102,  name: "들판 고블린", lv: 7,  region: "R01", zone: "whispering_plains", aggro: "Y", type: "물리", hp: 290,  mp: 10,  atk: 32, def: 10, exp: 52,   drop: ["A_HE01", "W_SH01", "C_P01", "A_AR01", "A_BE01"] },
    { id: 1021, name: "고블린 궁수", lv: 10, region: "R01", zone: "whispering_plains", aggro: "Y", type: "물리", hp: 440,  mp: 20,  atk: 46, def: 14, exp: 80,   drop: ["W_BW01", "A_SH01", "C_P01", "AC_R01", "AC_E01"] },
    { id: 103,  name: "고블린 주술사", lv: 13, region: "R01", zone: "whispering_ruins", aggro: "Y", type: "마법", hp: 590,  mp: 80,  atk: 58, def: 18, exp: 112,  skill: "파이어 애로우", drop: ["W_ST01", "C_P03", "S_RE01", "AC_N01", "W_ST02"] },
    { id: 1031, name: "동굴 고블린 전사", lv: 15, region: "R01", zone: "goblin_cave", aggro: "Y", type: "물리", hp: 760,  mp: 20,  atk: 70, def: 22, exp: 148,  drop: ["W_SW02", "A_AR01", "C_P02", "A_HE02", "A_SH02"] },
    { id: 1032, name: "동굴 어둠 주술사", lv: 17, region: "R01", zone: "goblin_cave", aggro: "Y", type: "마법", hp: 890,  mp: 120, atk: 80, def: 25, exp: 178,  skill: "파이어 애로우", drop: ["W_ST02", "C_P04", "S_AR01", "A_GL02", "A_CL02"] },
    { id: 1033, name: "족장의 친위대장", lv: 18, region: "R01", zone: "chief_camp", aggro: "Y", type: "물리", hp: 1100, mp: 40,  atk: 90, def: 29, exp: 215,  drop: ["W_SW02", "W_BW02", "A_AR02", "S_WE01", "A_SH02"] },
    { id: 104,  name: "고블린 족장(B)", lv: 20, region: "R01", zone: "chief_boss", aggro: "Y", type: "혼합", hp: 4000, mp: 300, atk: 125, def: 36, exp: 1150, skill: "배쉬", drop: ["A_AR02", "W_BW02", "W_SW02", "W_ST02", "S_WE01", "Q_I01"] },

    // R02 실버바인 (Lv.20~35)
    { id: 105,  name: "숲 늑대", lv: 22, region: "R02", zone: "fairy_outskirts", aggro: "Y", type: "물리", hp: 1280, mp: 0,   atk: 104, def: 33, exp: 270,  drop: ["A_CL02", "A_SH02", "C_P02", "A_GL02"] },
    { id: 1051, name: "은빛 독버섯 정령", lv: 25, region: "R02", zone: "silver_vine_forest", aggro: "N", type: "마법", hp: 1550, mp: 80,  atk: 118, def: 38, exp: 335,  drop: ["C_P02", "C_P04", "A_TS02", "AC_N02"] },
    { id: 106,  name: "오염된 엔트", lv: 28, region: "R02", zone: "silver_vine_forest", aggro: "Y", type: "물리", hp: 1980, mp: 20,  atk: 134, def: 44, exp: 405,  drop: ["W_ST02", "A_HE02", "S_AR01", "A_BE02"] },
    { id: 1061, name: "벌목장 거미", lv: 30, region: "R02", zone: "lumber_mill", aggro: "Y", type: "물리", hp: 2250, mp: 30,  atk: 146, def: 48, exp: 455,  drop: ["A_GL02", "A_BE02", "C_P02", "AC_R02"] },
    { id: 107,  name: "타락한 픽시", lv: 32, region: "R02", zone: "lumber_mill", aggro: "N", type: "마법", hp: 2150, mp: 100, atk: 160, def: 46, exp: 505,  drop: ["A_TS02", "C_P03", "S_RE01", "AC_E02"] },
    { id: 1071, name: "세계수 타락수호목", lv: 34, region: "R02", zone: "world_tree_camp", aggro: "Y", type: "혼합", hp: 2700, mp: 120, atk: 175, def: 54, exp: 565,  drop: ["W_BW02", "A_AR02", "S_WE01", "W_SH02"] },
    { id: 108,  name: "부패한 세계수(B)", lv: 35, region: "R02", zone: "world_tree_boss", aggro: "Y", type: "마법", hp: 9000, mp: 500, atk: 220, def: 62, exp: 2800, drop: ["W_BW03", "W_SW03", "W_ST03", "AC_E03", "S_WE01", "Q_I02"] },

    // R03 칼라드루 (Lv.35~50)
    { id: 109,  name: "협곡 오크", lv: 38, region: "R03", zone: "field", aggro: "Y", type: "물리", hp: 3000, mp: 0,   atk: 195, def: 60, exp: 680,  drop: ["W_SW02", "A_BE03", "C_P02", "A_HE03"] },
    { id: 1091, name: "붉은협곡 오크전사", lv: 42, region: "R03", zone: "field", aggro: "Y", type: "물리", hp: 3600, mp: 20,  atk: 218, def: 66, exp: 810,  drop: ["A_HE03", "C_P02", "A_SH03", "A_GL03"] },
    { id: 110,  name: "광신도 암살자", lv: 45, region: "R03", zone: "dungeon", aggro: "Y", type: "물리", hp: 4100, mp: 60,  atk: 242, def: 72, exp: 940,  drop: ["W_BW03", "S_AR01", "A_CL03"] },
    { id: 111,  name: "제단 바위골렘", lv: 48, region: "R03", zone: "boss_camp", aggro: "Y", type: "물리", hp: 4850, mp: 0,   atk: 265, def: 82, exp: 1080, drop: ["A_AR03", "Q_I03", "S_WE01", "W_SH02"] },
    { id: 112,  name: "광신도 대사제(B)", lv: 50, region: "R03", zone: "boss", aggro: "Y", type: "마법", hp: 15000, mp: 800, atk: 325, def: 92, exp: 5200, drop: ["W_SW03", "W_BW03", "W_ST03", "A_AR03", "S_WE01", "Q_I03"] },

    // R04 엘론드 (Lv.50~65)
    { id: 113,  name: "호수 정령", lv: 54, region: "R04", zone: "field", aggro: "N", type: "마법", hp: 5500, mp: 200, atk: 290, def: 88,  exp: 1320, drop: ["W_ST03", "C_P04", "A_TS03"] },
    { id: 1131, name: "물안개 세이렌", lv: 58, region: "R04", zone: "field", aggro: "Y", type: "마법", hp: 6200, mp: 250, atk: 318, def: 95,  exp: 1560, drop: ["A_CL03", "C_P04", "AC_N03", "AC_E04"] },
    { id: 114,  name: "신전 수호골렘", lv: 61, region: "R04", zone: "dungeon", aggro: "Y", type: "물리", hp: 7000, mp: 100, atk: 345, def: 104, exp: 1780, drop: ["W_SH02", "S_AR01", "A_AR03", "AC_R03"] },
    { id: 1141, name: "심연의 물정령", lv: 63, region: "R04", zone: "boss_camp", aggro: "Y", type: "마법", hp: 7800, mp: 300, atk: 370, def: 110, exp: 1960, drop: ["AC_N04", "S_WE01", "W_ST03"] },
    { id: 115,  name: "물의 정령왕(B)", lv: 65, region: "R04", zone: "boss", aggro: "Y", type: "혼합", hp: 24500, mp: 2000, atk: 440, def: 125, exp: 8800, drop: ["A_AR04", "AC_E04", "W_ST03", "W_SW03", "W_BW03", "Q_I04"] },

    // R05 모라안 (Lv.65~80)
    { id: 116,  name: "사막 전갈", lv: 67, region: "R05", zone: "oasis_outskirts", aggro: "Y", type: "물리", hp: 8800,  mp: 0,   atk: 395, def: 118, exp: 2250, drop: ["A_SH03", "C_P05", "C_P02", "A_GL03"] },
    { id: 1161, name: "모래언덕 독사", lv: 70, region: "R05", zone: "sand_dunes", aggro: "Y", type: "물리", hp: 9800,  mp: 30,  atk: 422, def: 124, exp: 2520, drop: ["A_GL03", "C_P02", "S_AR01", "AC_N03"] },
    { id: 1162, name: "고대 유적 해골병사", lv: 73, region: "R05", zone: "sand_dunes", aggro: "Y", type: "물리", hp: 10800, mp: 40,  atk: 450, def: 132, exp: 2820, drop: ["W_SW03", "A_HE03", "C_P04", "A_AR03"] },
    { id: 117,  name: "개미지옥 병정벌레", lv: 75, region: "R05", zone: "ant_hell", aggro: "Y", type: "물리", hp: 11800, mp: 50,  atk: 480, def: 140, exp: 3100, drop: ["A_AR03", "AC_N03", "S_WE01", "A_BE04"] },
    { id: 1171, name: "개미지옥 여왕거미", lv: 77, region: "R05", zone: "ant_hell", aggro: "Y", type: "혼합", hp: 13000, mp: 200, atk: 508, def: 146, exp: 3380, drop: ["W_ST03", "AC_N04", "S_AR01", "A_SH04"] },
    { id: 1172, name: "파라오의 고대수호병", lv: 78, region: "R05", zone: "pharaoh_tomb", aggro: "Y", type: "혼합", hp: 14200, mp: 180, atk: 535, def: 152, exp: 3680, drop: ["A_HE04", "W_SH02", "S_WE01", "A_GL04"] },
    { id: 118,  name: "파라오 람세스(B)", lv: 80, region: "R05", zone: "pharaoh_boss", aggro: "Y", type: "혼합", hp: 39500, mp: 1500, atk: 620, def: 168, exp: 14500, drop: ["A_HE04", "W_SW04", "W_BW04", "W_ST04", "S_WE01", "Q_I05"] },

    // R06 블러드문 (Lv.80~95)
    { id: 120,  name: "늪지 리자드맨", lv: 83, region: "R06", zone: "field", aggro: "Y", type: "물리", hp: 15600, mp: 50,  atk: 565, def: 160, exp: 4100, drop: ["W_BW03", "A_BE04", "C_P02", "A_SH04"] },
    { id: 1201, name: "핏빛 진흙악어", lv: 87, region: "R06", zone: "field", aggro: "Y", type: "물리", hp: 17200, mp: 0,   atk: 600, def: 170, exp: 4550, drop: ["A_SH04", "S_AR01", "A_AR04"] },
    { id: 1202, name: "역병 감염야수", lv: 91, region: "R06", zone: "dungeon", aggro: "Y", type: "물리", hp: 19000, mp: 80,  atk: 640, def: 180, exp: 5050, drop: ["A_GL04", "S_WE01", "A_HE04"] },
    { id: 1203, name: "맹독 늪지독사", lv: 93, region: "R06", zone: "boss_camp", aggro: "Y", type: "마법", hp: 20500, mp: 200, atk: 680, def: 188, exp: 5500, drop: ["AC_R03", "C_P05", "A_CL04"] },
    { id: 121,  name: "역병의 히드라(B)", lv: 95, region: "R06", zone: "boss", aggro: "Y", type: "마법", hp: 55000, mp: 1000, atk: 790, def: 208, exp: 20000, drop: ["A_CL04", "A_GL04", "W_SW04", "W_BW04", "W_ST04", "S_WE01"] },

    // R07 발레노스 (Lv.95~110)
    { id: 122,  name: "유령 해적", lv: 98,  region: "R07", zone: "black_beach", aggro: "Y", type: "물리", hp: 22800, mp: 0,   atk: 720, def: 198, exp: 6000,  drop: ["AC_R04", "W_SH02", "C_P02", "A_SH04"] },
    { id: 1221, name: "검은해변 약탈자", lv: 101, region: "R07", zone: "black_beach", aggro: "Y", type: "물리", hp: 25000, mp: 60,  atk: 755, def: 208, exp: 6600,  drop: ["A_SH04", "A_GL04", "C_P05", "W_SH03"] },
    { id: 1222, name: "화산암석 골렘", lv: 103, region: "R07", zone: "black_beach", aggro: "Y", type: "물리", hp: 27500, mp: 0,   atk: 795, def: 222, exp: 7150,  drop: ["A_AR04", "S_AR01", "A_HE04"] },
    { id: 123,  name: "난파선 망령선원", lv: 105, region: "R07", zone: "shipwreck", aggro: "Y", type: "마법", hp: 29500, mp: 350, atk: 830, def: 230, exp: 7700,  drop: ["W_ST04", "C_P04", "S_WE01", "AC_R04"] },
    { id: 1231, name: "심해 해골갑판장", lv: 107, region: "R07", zone: "shipwreck", aggro: "Y", type: "물리", hp: 32000, mp: 100, atk: 870, def: 240, exp: 8400,  drop: ["W_SW04", "A_CL04", "S_AR01", "W_SH03"] },
    { id: 1232, name: "해적선장 친위대", lv: 109, region: "R07", zone: "pirate_camp", aggro: "Y", type: "혼합", hp: 34500, mp: 200, atk: 910, def: 250, exp: 9200,  drop: ["W_BW04", "A_HE04", "S_WE01", "AC_E05"] },
    { id: 124,  name: "선장 바르보(B)", lv: 110, region: "R07", zone: "pirate_boss", aggro: "Y", type: "혼합", hp: 80000, mp: 800, atk: 1050, def: 275, exp: 29500, drop: ["W_BW04", "W_SW04", "W_ST04", "AC_E05", "W_SH03", "S_WE01"] },

    // R08 프로스트홀드 (Lv.110~130)
    { id: 125,  name: "서리 늑대", lv: 114, region: "R08", zone: "field", aggro: "Y", type: "물리", hp: 38000, mp: 0,   atk: 960,  def: 260, exp: 10500, drop: ["A_SH04", "C_P05", "A_AR04"] },
    { id: 1251, name: "눈보라 얼음거미", lv: 120, region: "R08", zone: "dungeon", aggro: "Y", type: "물리", hp: 43000, mp: 100, atk: 1040, def: 280, exp: 12300, drop: ["A_CL04", "S_AR01", "AC_R04"] },
    { id: 126,  name: "눈보라 빙결정령", lv: 126, region: "R08", zone: "boss_camp", aggro: "Y", type: "마법", hp: 48000, mp: 400, atk: 1120, def: 298, exp: 14000, drop: ["W_ST04", "S_WE01", "AC_N05"] },
    { id: 127,  name: "서리 거인(B)", lv: 130, region: "R08", zone: "boss", aggro: "Y", type: "혼합", hp: 115000, mp: 1000, atk: 1300, def: 330, exp: 42000, drop: ["A_CL04", "AC_R04", "AC_N05", "W_SH03", "S_WE01"] },

    // R09 이그니스 (Lv.130~150)
    { id: 128,  name: "화염 임프", lv: 135, region: "R09", zone: "field", aggro: "Y", type: "마법", hp: 55000, mp: 300, atk: 1210, def: 320, exp: 16800, drop: ["C_P04", "AC_N05", "A_SH05"] },
    { id: 1281, name: "용암 골렘", lv: 142, region: "R09", zone: "dungeon", aggro: "Y", type: "물리", hp: 62000, mp: 0,   atk: 1310, def: 350, exp: 19600, drop: ["A_AR05", "S_AR01", "A_GL05"] },
    { id: 129,  name: "불의 트롤전사", lv: 147, region: "R09", zone: "boss_camp", aggro: "Y", type: "물리", hp: 69000, mp: 100, atk: 1400, def: 375, exp: 22400, drop: ["W_SW05", "S_WE01", "A_HE05"] },
    { id: 130,  name: "이프리트(B)", lv: 150, region: "R09", zone: "boss", aggro: "Y", type: "마법", hp: 158000, mp: 5000, atk: 1620, def: 415, exp: 60000, drop: ["W_SW05", "W_BW05", "W_ST05", "A_AR05", "S_WE01"] },

    // R10 다크우드 (Lv.150~170)
    { id: 131,  name: "해골 기사", lv: 155, region: "R10", zone: "field", aggro: "Y", type: "물리", hp: 78000, mp: 0,   atk: 1520, def: 398, exp: 26500, drop: ["A_GL05", "W_SW04", "A_HE05"] },
    { id: 1311, name: "지하묘지 망령", lv: 162, region: "R10", zone: "dungeon", aggro: "Y", type: "마법", hp: 88000, mp: 500, atk: 1630, def: 425, exp: 30800, drop: ["W_ST05", "S_AR01", "A_CL05"] },
    { id: 132,  name: "암흑 사제", lv: 167, region: "R10", zone: "boss_camp", aggro: "Y", type: "마법", hp: 98000, mp: 800, atk: 1750, def: 455, exp: 35000, drop: ["AC_R05", "S_WE01", "AC_N05"] },
    { id: 133,  name: "리치 킹(B)", lv: 170, region: "R10", zone: "boss", aggro: "Y", type: "마법", hp: 220000, mp: 10000, atk: 2040, def: 500, exp: 84000, drop: ["W_BW05", "W_ST05", "AC_N05", "A_CL05", "S_WE01"] },

    // R11 윈드스톰 (Lv.170~190)
    { id: 134,  name: "하피", lv: 175, region: "R11", zone: "field", aggro: "Y", type: "물리", hp: 110000, mp: 200, atk: 1900, def: 485, exp: 40500, drop: ["A_SH05", "A_GL05"] },
    { id: 1341, name: "둥지 말벌여왕", lv: 182, region: "R11", zone: "dungeon", aggro: "Y", type: "물리", hp: 122000, mp: 250, atk: 2040, def: 515, exp: 46200, drop: ["W_BW05", "S_AR01", "AC_E05"] },
    { id: 135,  name: "폭풍 정령수호자", lv: 187, region: "R11", zone: "boss_camp", aggro: "Y", type: "마법", hp: 136000, mp: 600, atk: 2180, def: 550, exp: 52500, drop: ["A_CL05", "S_WE01", "A_BE05"] },
    { id: 136,  name: "폭풍의 눈(B)", lv: 190, region: "R11", zone: "boss", aggro: "Y", type: "혼합", hp: 295000, mp: 5000, atk: 2520, def: 605, exp: 115000, drop: ["A_CL05", "AC_R05", "W_BW05", "S_WE01"] },

    // R12 아르카나 (Lv.190~220)
    { id: 137,  name: "강철 가고일", lv: 200, region: "R12", zone: "field", aggro: "Y", type: "물리", hp: 158000, mp: 0,   atk: 2380, def: 588, exp: 61500,  drop: ["A_AR05", "A_BE05", "W_SH03"] },
    { id: 1371, name: "부유선 마공학골렘", lv: 208, region: "R12", zone: "dungeon", aggro: "Y", type: "물리", hp: 176000, mp: 200, atk: 2560, def: 630, exp: 71000,  drop: ["W_SH03", "S_AR01", "A_HE05"] },
    { id: 138,  name: "타이탄 파수꾼", lv: 215, region: "R12", zone: "boss_camp", aggro: "Y", type: "혼합", hp: 200000, mp: 400, atk: 2750, def: 675, exp: 82500,  drop: ["A_GL05", "S_WE01", "AC_R05"] },
    { id: 139,  name: "타이탄(B)", lv: 220, region: "R12", zone: "boss", aggro: "Y", type: "혼합", hp: 400000, mp: 0,   atk: 3180, def: 750, exp: 168000, drop: ["A_GL05", "A_AR05", "AC_R05", "S_WE01"] },

    // R13 네더게이트 (Lv.220~260)
    { id: 140,  name: "서큐버스", lv: 230, region: "R13", zone: "field", aggro: "Y", type: "마법", hp: 232000, mp: 1500, atk: 3040, def: 720, exp: 101000, drop: ["W_ST05", "AC_N05", "A_CL05"] },
    { id: 1401, name: "미궁 고문관오크", lv: 242, region: "R13", zone: "dungeon", aggro: "Y", type: "물리", hp: 260000, mp: 300,  atk: 3320, def: 778, exp: 118000, drop: ["A_HE05", "S_AR01", "W_SW05"] },
    { id: 141,  name: "마계 심연근위대", lv: 252, region: "R13", zone: "boss_camp", aggro: "Y", type: "혼합", hp: 295000, mp: 800,  atk: 3600, def: 835, exp: 136000, drop: ["W_SW05", "S_WE01", "A_AR05"] },
    { id: 142,  name: "발록(B)", lv: 260, region: "R13", zone: "boss", aggro: "Y", type: "마법", hp: 570000, mp: 20000, atk: 4180, def: 930, exp: 265000, drop: ["A_HE05", "W_BW05", "W_SW05", "W_ST05", "S_WE01"] },

    // R14 드래곤피크 (Lv.260~300)
    { id: 143,  name: "레드 드레이크", lv: 270, region: "R14", zone: "field", aggro: "Y", type: "혼합", hp: 340000, mp: 1000, atk: 3980, def: 900,  exp: 168000, drop: ["W_SW05", "A_AR05", "A_GL05"] },
    { id: 1431, name: "부화장 화염드래곤", lv: 282, region: "R14", zone: "dungeon", aggro: "Y", type: "혼합", hp: 390000, mp: 1500, atk: 4360, def: 985,  exp: 196000, drop: ["A_AR05", "S_AR01", "AC_R05"] },
    { id: 144,  name: "고룡 수호드래곤", lv: 292, region: "R14", zone: "boss_camp", aggro: "Y", type: "혼합", hp: 435000, mp: 2000, atk: 4750, def: 1060, exp: 230000, drop: ["W_BW05", "S_WE01", "AC_N05"] },
    { id: 145,  name: "에이션트 레드(B)", lv: 300, region: "R14", zone: "boss", aggro: "Y", type: "혼합", hp: 830000, mp: 50000, atk: 5500, def: 1180, exp: 450000, drop: ["W_SW05", "W_BW05", "W_ST05", "A_AR05", "AC_R05"] },

    // R15 이터니티 (Lv.300~∞)
    { id: 146,  name: "공허의 기사", lv: 320, region: "R15", zone: "field", aggro: "Y", type: "물리", hp: 510000, mp: 0,    atk: 5200, def: 1140, exp: 290000, drop: ["A_CL05", "W_ST05", "A_AR05"] },
    { id: 1461, name: "심연의 망령군주", lv: 332, region: "R15", zone: "dungeon", aggro: "Y", type: "마법", hp: 585000, mp: 5000, atk: 5780, def: 1250, exp: 345000, drop: ["W_ST05", "S_AR01", "AC_R05"] },
    { id: 147,  name: "카엘런의 근위대", lv: 342, region: "R15", zone: "boss_camp", aggro: "Y", type: "혼합", hp: 680000, mp: 8000, atk: 6450, def: 1375, exp: 410000, drop: ["AC_R05", "S_WE01", "W_SW05"] },
    { id: 148,  name: "배교자 카엘런(B)", lv: 350, region: "R15", zone: "boss", aggro: "Y", type: "마법", hp: 1680000, mp: 99999, atk: 7750, def: 1560, exp: 1500000, drop: ["W_SW05", "W_ST05", "W_BW05", "A_AR05", "AC_R05"] }
  ],

  // 7. 지역별 퀘스트 DB (대마법 시대 메인 서사: 파괴된 에테르 코어 조각 수복과 배교자 카엘런 추적 연대기)
  Quests: [
    // [제1장: 알트리아 (R01) - 에테르 파편과 고블린의 봉기]
    { id: "Q001", region: "R01", chapter: "제1장: 왕국의 여명", name: "자경단의 첫 임무", objective: "초원 슬라임 5마리 처치", targetType: "kill", targetName: "슬라임", reqCount: 5, exp: 80, gold: 200, rewardItem: "C_P01", rewardQty: 10,
      story: "에테르 코어가 붕괴된 이후, 알트리아 남부 초원의 순했던 슬라임들조차 폭주하는 마나 잔류물에 오염되어 여행자들을 습격하고 있습니다.",
      acceptDialog: "특사 발렌: \"모험가여, 마나 폭주로 남부 초원의 슬라임들이 흉포해졌네. 먼저 마을 외곽의 초원 슬라임 5마리를 정리해 자경단의 자질을 증명해 주게.\"",
      completeDialog: "특사 발렌: \"훌륭한 솜씨군! 하지만 이건 시작에 불과하네. 북쪽 들판에서 더 불길한 움직임이 포착되었어.\"" },
    { id: "Q002", region: "R01", chapter: "제1장: 왕국의 여명", name: "들판의 약탈자들", objective: "들판 고블린 8마리 처치", targetType: "kill", targetName: "들판 고블린", reqCount: 8, exp: 200, gold: 400, rewardItem: "A_AR01", rewardQty: 1,
      story: "속삭이는 들판의 고블린 무리가 왕국 보급 마차를 습격하고 있습니다. 그들 배후에 누군가 마력 무기를 공급하고 있다는 소문이 돕니다.",
      acceptDialog: "특사 발렌: \"들판 고블린들이 보급로를 차단하고 있네. 들판 고블린 8마리를 소탕하고 보급로를 되찾아주게!\"",
      completeDialog: "특사 발렌: \"보급로가 열렸군! 고블린들의 화살촉에서 낯선 암흑 마력의 흔적이 발견되었네.\"" },
    { id: "Q003", region: "R01", chapter: "제1장: 왕국의 여명", name: "원거리 위협 제거", objective: "고블린 궁수 8마리 처치", targetType: "kill", targetName: "고블린 궁수", reqCount: 8, exp: 340, gold: 600, rewardItem: "A_HE01", rewardQty: 1,
      story: "폐허 수풀에 매복한 고블린 궁수들이 정찰병들을 저격하고 있습니다. 원거리 저격수들을 먼저 제압해야 북부로 진격할 수 있습니다.",
      acceptDialog: "특사 발렌: \"고블린 궁수들의 독화살 때문에 자경단이 접근하지 못하고 있네. 고블린 궁수 8마리를 처치해 주게.\"",
      completeDialog: "특사 발렌: \"매복조가 무너졌군! 이제 그들에게 사악한 주술을 불어넣는 주술사들을 추격할 차례네.\"" },
    { id: "Q004", region: "R01", chapter: "제1장: 왕국의 여명", name: "주술사의 음모", objective: "고블린 주술사 5마리 처치", targetType: "kill", targetName: "주술사", reqCount: 5, exp: 520, gold: 900, rewardItem: "A_SH02", rewardQty: 1,
      story: "배교자 카엘런의 추종자들이 고블린 주술사들에게 금단의 화염 비전을 전수했습니다. 유적지의 주술 의식을 저지해야 합니다.",
      acceptDialog: "특사 발렌: \"속삭이는 유적에서 고블린 주술사들이 검은 불꽃을 피워 올리고 있네. 주술사 5마리를 처단해 의식을 멈춰주게!\"",
      completeDialog: "특사 발렌: \"주술사들의 지팡이에 '카엘런의 낙인'이 새겨져 있었군... 동굴 깊은 곳에 에테르 파편이 숨겨져 있는 게 분명하네!\"" },
    { id: "Q005", region: "R01", chapter: "제1장: 왕국의 여명", name: "깊은 동굴 속으로", objective: "고블린 동굴 내부 몬스터 10마리 처치", targetType: "kill", targetName: "동굴", reqCount: 10, exp: 880, gold: 1500, rewardItem: "S_RE01", rewardQty: 5,
      story: "고블린 동굴 내부는 오염된 에테르 광맥으로 가득합니다. 동굴 내부의 정예 고블린 전사와 어둠 주술사들을 돌파하고 심층부를 정찰하세요.",
      acceptDialog: "특사 발렌: \"북서쪽 고블린 동굴로 진입해 동굴 내부 몬스터 10마리를 토벌하고 적의 본거지를 와해시켜 주게.\"",
      completeDialog: "특사 발렌: \"동굴 수비대가 무너졌네! 이제 북동쪽 족장의 막사로 진격할 시간일세.\"" },
    { id: "Q006", region: "R01", chapter: "제1장: 왕국의 여명", name: "막사의 친위대 돌파", objective: "족장의 친위대장 6마리 처치", targetType: "kill", targetName: "친위대장", reqCount: 6, exp: 1300, gold: 2200, rewardItem: "S_AR01", rewardQty: 1,
      story: "고블린 족장의 막사 앞을 철통같이 지키는 친위대장들은 강철 갑주로 무장하고 있습니다. 친위대를 격파해야 족장과 대면할 수 있습니다.",
      acceptDialog: "특사 발렌: \"족장의 막사 입구를 지키는 친위대장 6마리를 쓰러뜨리고 최종 결전의 길을 열어주게!\"",
      completeDialog: "특사 발렌: \"장하네! 친위대가 모두 쓰러졌어. 이제 막사 깊은 곳의 고블린 족장만 남았네!\"" },
    { id: "Q007", region: "R01", isRegionFinale: true, chapter: "제1장: 왕국의 여명 [최종장]", name: "[최종] 알트리아의 평화", objective: "고블린 족장(B) 1회 처치", targetType: "kill", targetName: "고블린 족장(B)", reqCount: 1, exp: 3000, gold: 5000, rewardByClass: { knight: "QR_R01_SW", ranger: "QR_R01_BW", wizard: "QR_R01_ST" }, rewardItem: "QR_R01_SW", rewardQty: 1,
      story: "첫 번째 에테르 조각을 삼켜 거대한 괴력을 얻은 고블린 족장을 처단하고, 알드릭 국왕이 하사하는 왕실 수호자의 전용 무기를 수여받으세요.",
      acceptDialog: "특사 발렌: \"드디어 결전의 순간일세! 에테르 파편의 힘으로 폭주한 고블린 족장(B)을 처단하고 알트리아에 평화를 되찾아주게!\"",
      completeDialog: "특사 발렌: \"알트리아의 영웅이여! 그대가 회수한 첫 번째 에테르 파편 덕분에 왕국이 숨을 돌렸네. 알드릭 폐하의 명으로 이 전용 무기를 하사하노라! 이제 실버바인 숲의 아리엘을 찾아가 보게.\"" },

    // [제2장: 실버바인 (R02) - 타락한 세계수의 눈물]
    { id: "Q021", region: "R02", chapter: "제2장: 은빛 숲의 비명", name: "요정 야영지 수호", objective: "숲 늑대 8마리 처치", targetType: "kill", targetName: "숲 늑대", reqCount: 8, exp: 1800, gold: 3000, rewardItem: "C_P02", rewardQty: 10,
      story: "실버바인의 세계수가 오염된 마나를 내뿜자, 숲의 늑대들이 광기에 사로잡혀 요정들의 야영지를 위협하고 있습니다.",
      acceptDialog: "숲지기 아리엘: \"이방인이여, 세계수가 병들면서 숲 늑대들이 눈이 붉게 충혈된 채 야영지를 습격하고 있어요. 숲 늑대 8마리를 잠재워 주세요.\"",
      completeDialog: "숲지기 아리엘: \"고마워요! 하지만 은빛 덩굴숲 안쪽의 고목들까지 타락에 물들고 있답니다.\"" },
    { id: "Q022", region: "R02", chapter: "제2장: 은빛 숲의 비명", name: "은빛 덩굴숲 정화", objective: "오염된 엔트 8마리 처치", targetType: "kill", targetName: "엔트", reqCount: 8, exp: 2900, gold: 4500, rewardItem: "S_AR01", rewardQty: 1,
      story: "수백 년간 숲을 지키던 수호목 엔트들이 검은 수액을 흘리며 침입자들을 무차별 공격하고 있습니다.",
      acceptDialog: "숲지기 아리엘: \"고통받는 숲의 정령들을 해방해야 해요. 오염된 엔트 8마리를 처치해 타락의 확산을 막아주세요.\"",
      completeDialog: "숲지기 아리엘: \"엔트들의 뿌리에서 죽음의 룬 파편이 나왔어요. 버려진 벌목장 쪽에서 사악한 주술이 흘러나오고 있어요!\"" },
    { id: "Q023", region: "R02", chapter: "제2장: 은빛 숲의 비명", name: "버려진 벌목장 탈환", objective: "타락한 픽시 또는 거미 10마리 처치", targetType: "kill", targetName: "픽시", reqCount: 10, exp: 4000, gold: 6000, rewardItem: "A_TS03", rewardQty: 1,
      story: "버려진 벌목장을 점거한 타락한 픽시들이 세계수의 뿌리에 맹독과 저주를 주입하고 있습니다.",
      acceptDialog: "숲지기 아리엘: \"벌목장의 타락한 픽시 10마리를 정화해 세계수로 이어지는 독기 통로를 차단해 주세요!\"",
      completeDialog: "숲지기 아리엘: \"독기가 잦아들었어요! 이제 북쪽 성역의 부패한 세계수 핵을 정화할 차례예요.\"" },
    { id: "Q024", region: "R02", isRegionFinale: true, chapter: "제2장: 은빛 숲의 비명 [최종장]", name: "[최종] 타락한 세계수 정화", objective: "부패한 세계수(B) 1회 처치", targetType: "kill", targetName: "부패한 세계수(B)", reqCount: 1, exp: 8200, gold: 12000, rewardByClass: { knight: "QR_R02_SW", ranger: "QR_R02_BW", wizard: "QR_R02_ST" }, rewardItem: "QR_R02_SW", rewardQty: 1,
      story: "카엘런이 심어둔 심연의 씨앗이 세계수를 거대한 마수로 변이시켰습니다. 부패한 세계수를 쓰러뜨리고 두 번째 에테르 코어 조각을 정화하세요.",
      acceptDialog: "숲지기 아리엘: \"부패한 세계수(B)의 심장부에 박힌 오염된 코어를 꺾어주세요! 요정 여왕님의 축복이 그대와 함께할 거예요.\"",
      completeDialog: "숲지기 아리엘: \"세계수에 다시 은빛 새순이 돋아났어요! 요정 왕국의 보물인 이 무기를 받아주세요. 다음 단서는 칼라드루 바위산의 대장장이 토르딘에게 있답니다!\"" },

    // [제3장: 칼라드루 (R03) - 붉은 협곡과 광신도의 제단]
    { id: "Q031", region: "R03", chapter: "제3장: 강철과 광신", name: "붉은 협곡의 오크 토벌", objective: "협곡 오크 10마리 처치", targetType: "kill", targetName: "오크", reqCount: 10, exp: 4600, gold: 7000, rewardItem: "C_P02", rewardQty: 15,
      story: "칼라드루 산맥의 오크 부족이 광신도 교단에 매수되어 바위망치 마을의 대장간 철광석 수송대를 습격하고 있습니다.",
      acceptDialog: "대장장이 토르딘: \"허허, 오크 놈들이 광신도들과 손잡고 광산을 가로막았구먼! 붉은 협곡의 오크 10마리를 본때 있게 혼내주게!\"",
      completeDialog: "대장장이 토르딘: \"시원하구먼! 하지만 진짜 문제는 광산 안쪽에 숨어든 광신도 암살자 놈들이야.\"" },
    { id: "Q032", region: "R03", chapter: "제3장: 강철과 광신", name: "광신도의 광산 잠입", objective: "광신도 암살자 10마리 처치", targetType: "kill", targetName: "광신도 암살자", reqCount: 10, exp: 6500, gold: 9000, rewardItem: "S_AR01", rewardQty: 2,
      story: "배교자 카엘런을 숭배하는 광신도 암살자들이 고대 룬 광석을 채굴해 거대 전쟁 골렘을 깨우려 하고 있습니다.",
      acceptDialog: "대장장이 토르딘: \"광신도의 광산으로 잠입해 광신도 암살자 10명을 처단하고 놈들의 채굴 작전을 분쇄해 주게!\"",
      completeDialog: "대장장이 토르딘: \"암살자들을 쓸어버렸군! 큰일 났네, 교단의 대사제가 이미 골렘 제단에서 의식을 시작했어!\"" },
    { id: "Q033", region: "R03", isRegionFinale: true, chapter: "제3장: 강철과 광신 [최종장]", name: "[최종] 골렘 제단의 대사제", objective: "광신도 대사제(B) 1회 처치", targetType: "kill", targetName: "광신도 대사제(B)", reqCount: 1, exp: 13500, gold: 18000, rewardByClass: { knight: "QR_R03_SW", ranger: "QR_R03_BW", wizard: "QR_R03_ST" }, rewardItem: "QR_R03_SW", rewardQty: 1,
      story: "세 번째 에테르 조각으로 고대 병기를 가동하려는 광신도 대사제를 처단하고, 드워프 명장 토르딘이 벼려낸 룬 무기를 손에 넣으세요.",
      acceptDialog: "대장장이 토르딘: \"골렘의 제단에 있는 광신도 대사제(B)를 박살 내주게! 내 평생 최고의 걸작 무기로 보답하겠네!\"",
      completeDialog: "대장장이 토르딘: \"크하하! 대사제가 쓰러지다니 통쾌하군! 약속대로 고대 룬을 각인한 전용 무기일세. 이제 호수 도시 엘론드의 대장로 실바나 님께 에테르 조각의 행방을 알리게!\"" },

    // [제4장: 엘론드 (R04) - 물안개 결계와 가라앉은 신전]
    { id: "Q041", region: "R04", chapter: "제4장: 일렁이는 호수의 결계", name: "물안개 호수의 폭주", objective: "호수 정령 또는 세이렌 10마리 처치", targetType: "kill", targetName: "정령", reqCount: 10, exp: 8500, gold: 11000, rewardItem: "C_P04", rewardQty: 15,
      story: "마법도시 엘론드를 보호하던 물의 결계가 흔들리며, 호수의 물정령들이 이성을 잃고 범람하고 있습니다.",
      acceptDialog: "대장로 실바나: \"결계의 마력 파장이 뒤틀리고 있습니다. 물안개 호숫가의 폭주하는 정령 10마리를 진정시켜 주십시오.\"",
      completeDialog: "대장로 실바나: \"고맙습니다. 가라앉은 신전 깊은 곳에서 물의 정령왕이 심연의 마력에 잠식된 것이 원인이었군요.\"" },
    { id: "Q042", region: "R04", isRegionFinale: true, chapter: "제4장: 일렁이는 호수의 결계 [최종장]", name: "[최종] 실바나의 결계 수호", objective: "물의 정령왕(B) 1회 처치", targetType: "kill", targetName: "물의 정령왕(B)", reqCount: 1, exp: 21000, gold: 28000, rewardByClass: { knight: "QR_R04_SW", ranger: "QR_R04_BW", wizard: "QR_R04_ST" }, rewardItem: "QR_R04_SW", rewardQty: 1,
      story: "폭주하는 물의 정령왕을 제압해 엘론드의 수호 결계를 복원하고, 대장로 실바나가 내리는 엘론드 성소의 비전 무기를 계승하세요.",
      acceptDialog: "대장로 실바나: \"물의 정령왕좌에 머무는 물의 정령왕(B)을 제압해 타락한 마력을 정화해 주십시오. 엘론드의 운명이 그대에게 달렸습니다.\"",
      completeDialog: "대장로 실바나: \"물의 정령왕이 본래의 청명한 빛을 되찾았습니다! 감사의 증표로 엘론드 왕실 무기를 드립니다. 사막 도시 모라안에서도 고대 봉인이 깨지고 있다 하니 서둘러 주십시오.\"" },

    // [제5장: 모라안 (R05) - 황금 사막과 깨어난 파라오]
    { id: "Q051", region: "R05", chapter: "제5장: 태양 아래의 망자들", name: "오아시스 교역로 확보", objective: "사막 전갈 10마리 처치", targetType: "kill", targetName: "전갈", reqCount: 10, exp: 11000, gold: 12000, rewardItem: "C_P05", rewardQty: 3,
      story: "모라안 사막의 열기 속에서 맹독을 품은 거대 사막 전갈들이 오아시스 상단의 낙타 행렬을 습격하고 있습니다.",
      acceptDialog: "대상단장 하킴: \"오아시스 주변에 사막 전갈 떼가 들끓어 상단이 고립되었소! 사막 전갈 10마리를 처치해 길을 열어주시오!\"",
      completeDialog: "대상단장 하킴: \"덕분에 상단이 숨통을 틔웠소! 여기 상단 비전의 영약을 받으시오.\"" },
    { id: "Q052", region: "R05", chapter: "제5장: 태양 아래의 망자들", name: "모래언덕의 고대 망자", objective: "고대 유적 해골병사 10마리 처치", targetType: "kill", targetName: "해골병사", reqCount: 10, exp: 15000, gold: 18000, rewardItem: "S_AR01", rewardQty: 2,
      story: "모래폭풍 너머 피라미드 유적에서 수천 년 전 죽은 파라오의 해골 군단이 모래를 뚫고 되살아나고 있습니다.",
      acceptDialog: "대상단장 하킴: \"작열하는 모래언덕에서 해골병사들이 행군하고 있소! 고대 유적 해골병사 10마리를 격파해 주시오.\"",
      completeDialog: "대상단장 하킴: \"망자들을 물리쳤지만, 개미지옥 지하에서 땅이 무너져 내리고 있소!\"" },
    { id: "Q053", region: "R05", chapter: "제5장: 태양 아래의 망자들", name: "개미지옥 둥지 소탕", objective: "개미지옥 몬스터 12마리 처치", targetType: "kill", targetName: "개미지옥", reqCount: 12, exp: 19500, gold: 25000, rewardItem: "S_WE01", rewardQty: 2,
      story: "개미지옥 둥지 깊은 곳의 괴충들이 파라오 무덤의 지하 결계석을 갉아먹어 봉인을 약화시키고 있습니다.",
      acceptDialog: "대상단장 하킴: \"개미지옥 둥지의 괴충 12마리를 소탕해 지하 지반이 무너지는 것을 막아주시오!\"",
      completeDialog: "대상단장 하킴: \"지하 통로가 확보되었소! 이제 피라미드 정상에서 깨어난 태양왕과 맞설 차례요!\"" },
    { id: "Q054", region: "R05", isRegionFinale: true, chapter: "제5장: 태양 아래의 망자들 [최종장]", name: "[최종] 파라오의 안식", objective: "파라오 람세스(B) 1회 처치", targetType: "kill", targetName: "파라오 람세스(B)", reqCount: 1, exp: 34000, gold: 45000, rewardByClass: { knight: "QR_R05_SW", ranger: "QR_R05_BW", wizard: "QR_R05_ST" }, rewardItem: "QR_R05_SW", rewardQty: 1,
      story: "카엘런의 사령술로 부활한 고대 군주 파라오 람세스를 쓰러뜨리고, 태양왕의 황금 보물고에 잠든 전설 무기를 획득하세요.",
      acceptDialog: "대상단장 하킴: \"태양의 에테르 조각을 품고 부활한 파라오 람세스(B)에게 영원한 안식을 내려주시오!\"",
      completeDialog: "대상단장 하킴: \"위대한 영웅이여! 사막의 모래폭풍이 마침내 멈추었소. 파라오의 왕실 보구인 이 황금 무기는 그대의 것이오!\"" },

    // [제6장: 블러드문 (R06) - 핏빛 늪지대와 역병의 근원]
    { id: "Q060", region: "R06", chapter: "제6장: 핏빛 달이 뜨는 늪", name: "핏빛 진흙탕의 포식자들", objective: "늪지 리자드맨 또는 악어 12마리 처치", targetType: "kill", targetName: "늪지", reqCount: 12, exp: 20000, gold: 28000, rewardItem: "C_P05", rewardQty: 4,
      story: "블러드문 늪지대에 붉은 달이 떠오르며 맹독 역병이 퍼지고 있습니다. 추방자들의 야영지를 포위한 늪지 괴수들을 먼저 소탕해야 합니다.",
      acceptDialog: "추방자 대장 크로우: \"이 저주받은 늪에 발을 들이다니 겁도 없군. 야영지 주변의 늪지 괴수 12마리를 베어 실력을 증명해 봐라.\"",
      completeDialog: "추방자 대장 크로우: \"제법이군. 이 역병의 진짜 원흉은 맹독 늪지 가장 깊은 곳에 도사리고 있다.\"" },
    { id: "Q061", region: "R06", isRegionFinale: true, chapter: "제6장: 핏빛 달이 뜨는 늪 [최종장]", name: "[최종] 맹독 늪지의 지배자", objective: "역병의 히드라(B) 1회 처치", targetType: "kill", targetName: "역병의 히드라(B)", reqCount: 1, exp: 48000, gold: 60000, rewardByClass: { knight: "QR_R06_SW", ranger: "QR_R06_BW", wizard: "QR_R06_ST" }, rewardItem: "QR_R06_SW", rewardQty: 1,
      story: "에테르 조각의 독기를 삼키고 불사의 재생력을 얻은 아홉 머리의 마수, 역병의 히드라를 처단하고 블러드문의 저주를 끊어내세요.",
      acceptDialog: "추방자 대장 크로우: \"맹독 늪지 깊은 곳의 역병의 히드라(B)의 심장을 꿰뚫어라! 성공한다면 우리 추방자 기사단의 비전 무기를 넘겨주지.\"",
      completeDialog: "추방자 대장 크로우: \"히드라의 맹독 안개가 걷히다니... 믿기지 않는군. 약속한 블러드문의 결전 무기다. 이제 발레노스 항구의 테오도르 제독에게 가 봐라.\"" },

    // [제7장: 발레노스 (R07) - 난파선 해협과 유령 함대]
    { id: "Q071", region: "R07", chapter: "제7장: 심해의 유령 함대", name: "검은 모래 해변 토벌", objective: "유령 해적 10마리 처치", targetType: "kill", targetName: "유령 해적", reqCount: 10, exp: 22000, gold: 30000, rewardItem: "C_P05", rewardQty: 5,
      story: "발레노스 앞바다에 침몰했던 대해적단이 망령이 되어 검은 모래 해변으로 상륙하고 있습니다.",
      acceptDialog: "해군 제독 테오도르: \"해안 방어선이 위험하네! 검은 모래 해변에 상륙한 유령 해적 10명을 격퇴해 주게!\"",
      completeDialog: "해군 제독 테오도르: \"해변을 지켜냈군! 하지만 난파선 무덤에서 망령들이 끝없이 기어 나오고 있네.\"" },
    { id: "Q072", region: "R07", chapter: "제7장: 심해의 유령 함대", name: "난파선 무덤의 원혼", objective: "난파선 망령선원 12마리 처치", targetType: "kill", targetName: "망령선원", reqCount: 12, exp: 31000, gold: 40000, rewardItem: "S_AR01", rewardQty: 3,
      story: "난파선 무덤의 망령선원들은 심해 에테르 조각의 힘에 묶여 죽지 못하는 저주에 걸려 있습니다.",
      acceptDialog: "해군 제독 테오도르: \"난파선 무덤으로 진격해 난파선 망령선원 12명을 해방하고 기함으로 가는 수로를 확보해 주게!\"",
      completeDialog: "해군 제독 테오도르: \"기함으로 향하는 갑판 길이 열렸네! 저주받은 해적선장 바르보가 모습을 드러냈어!\"" },
    { id: "Q073", region: "R07", isRegionFinale: true, chapter: "제7장: 심해의 유령 함대 [최종장]", name: "[최종] 해적선장 바르보 처단", objective: "선장 바르보(B) 1회 처치", targetType: "kill", targetName: "선장 바르보(B)", reqCount: 1, exp: 65000, gold: 80000, rewardByClass: { knight: "QR_R07_SW", ranger: "QR_R07_BW", wizard: "QR_R07_ST" }, rewardItem: "QR_R07_SW", rewardQty: 1,
      story: "일곱 바다를 공포에 떨게 했던 망령 기함의 주인, 선장 바르보를 격파하고 해군 총사령부의 초월급 무기를 수여받으세요.",
      acceptDialog: "해군 제독 테오도르: \"해적선장의 선실을 점거한 선장 바르보(B)를 처단하고 바다의 에테르 코어를 탈환해 주게!\"",
      completeDialog: "해군 제독 테오도르: \"발레노스의 바다가 마침내 잔잔해졌네! 왕국 해군의 최고 영예인 제독의 무기를 자네에게 수여하네!\"" },

    // [제8장: 프로스트홀드 (R08) - 영구동토의 눈보라]
    { id: "Q080", region: "R08", chapter: "제8장: 얼어붙은 왕좌", name: "눈보라 평원의 빙결수", objective: "서리 늑대 또는 빙결정령 12마리 처치", targetType: "kill", targetName: "서리", reqCount: 12, exp: 42000, gold: 52000, rewardItem: "S_WE01", rewardQty: 2,
      story: "프로스트홀드 설원에 기이한 절대영도의 폭풍이 몰아치며 얼음바위 마을이 고립되었습니다.",
      acceptDialog: "설원 족장 볼프강: \"전사여, 눈보라 평원의 서리 괴수 12마리를 사냥해 마을 주변의 한기를 몰아내 다오!\"",
      completeDialog: "설원 족장 볼프강: \"호오, 매서운 추위 속에서도 흔들림이 없군! 이제 서리 거인의 성역으로 진격할 때다.\"" },
    { id: "Q081", region: "R08", isRegionFinale: true, chapter: "제8장: 얼어붙은 왕좌 [최종장]", name: "[최종] 서리거인의 안식", objective: "서리 거인(B) 1회 처치", targetType: "kill", targetName: "서리 거인(B)", reqCount: 1, exp: 90000, gold: 100000, rewardByClass: { knight: "QR_R08_SW", ranger: "QR_R08_BW", wizard: "QR_R08_ST" }, rewardItem: "QR_R08_SW", rewardQty: 1,
      story: "만년설의 심장에 잠들어 있던 고대 신화 속 거인, 서리 거인을 꺾고 북방 설원 부족의 전설 무기를 계승하세요.",
      acceptDialog: "설원 족장 볼프강: \"카엘런의 마력에 폭주한 서리 거인(B)을 쓰러뜨리고 설원의 에테르 조각을 되찾아 오너라!\"",
      completeDialog: "설원 족장 볼프강: \"전설 속 서리 거인을 쓰러뜨리다니! 북방의 지배자에게만 허락된 만년설의 신구를 받아라!\"" },

    // [제9장: 이그니스 (R09) - 끓어오르는 화산과 업화의 마족]
    { id: "Q090", region: "R09", chapter: "제9장: 홍련의 분화구", name: "끓어오르는 대지 진압", objective: "화염 임프 또는 불의 트롤전사 12마리 처치", targetType: "kill", targetName: "불의", reqCount: 12, exp: 58000, gold: 72000, rewardItem: "S_AR01", rewardQty: 3,
      story: "이그니스 화산 지대의 지각이 갈라지며 화염계의 마족들이 대거 지상으로 쏟아져 나오고 있습니다.",
      acceptDialog: "화염감시자 이그나: \"용암이 범람하기 직전입니다! 분화구 주변의 불의 트롤전사 12마리를 진압해 화산맥의 폭주를 늦춰주세요!\"",
      completeDialog: "화염감시자 이그나: \"불길이 한결 잡혔군요! 하지만 분화구 중심에서 화염군주 이프리트가 강림했습니다!\"" },
    { id: "Q091", region: "R09", isRegionFinale: true, chapter: "제9장: 홍련의 분화구 [최종장]", name: "[최종] 화염마족 이프리트 봉인", objective: "이프리트(B) 1회 처치", targetType: "kill", targetName: "이프리트(B)", reqCount: 1, exp: 125000, gold: 140000, rewardByClass: { knight: "QR_R09_SW", ranger: "QR_R09_BW", wizard: "QR_R09_ST" }, rewardItem: "QR_R09_SW", rewardQty: 1,
      story: "화산의 에테르 코어를 집어삼킨 화염계의 군주 이프리트를 봉인하고, 업화의 불꽃으로 단련된 신화급 무기를 획득하세요.",
      acceptDialog: "화염감시자 이그나: \"화염마족의 분화구 중심에 군림한 이프리트(B)를 봉인하고 대지를 잿더미에서 구원해 주십시오!\"",
      completeDialog: "화염감시자 이그나: \"업화의 군주가 봉인되었습니다! 불멸의 홍련 불꽃으로 벼려낸 이 무기가 그대의 앞길을 밝혀줄 것입니다!\"" },

    // [제10장: 다크우드 (R10) - 망자의 숲과 칠흑의 리치 킹]
    { id: "Q100", region: "R10", chapter: "제10장: 영원한 밤의 성채", name: "그림자 숲의 사령 군단", objective: "해골 기사 또는 암흑 사제 12마리 처치", targetType: "kill", targetName: "암흑 사제", reqCount: 12, exp: 82000, gold: 95000, rewardItem: "S_WE01", rewardQty: 3,
      story: "태양빛조차 닿지 않는 다크우드에서 암흑 사제들이 죽은 기사들을 끝없이 되살려 생자의 땅을 침공하려 합니다.",
      acceptDialog: "퇴마사 베인: \"사령술의 고리를 끊으려면 술사들을 먼저 베어야 하오. 보스 진영 주변의 암흑 사제 12명을 처단해 주시오.\"",
      completeDialog: "퇴마사 베인: \"사령의 결계가 깨졌소! 이제 지하묘지 끝자락의 언데드 군주와 결판을 낼 시간이다.\"" },
    { id: "Q101", region: "R10", isRegionFinale: true, chapter: "제10장: 영원한 밤의 성채 [최종장]", name: "[최종] 언데드 군주 리치 킹 토벌", objective: "리치 킹(B) 1회 처치", targetType: "kill", targetName: "리치 킹(B)", reqCount: 1, exp: 170000, gold: 180000, rewardByClass: { knight: "QR_R10_SW", ranger: "QR_R10_BW", wizard: "QR_R10_ST" }, rewardItem: "QR_R10_SW", rewardQty: 1,
      story: "과거 대마법사였으나 카엘런의 감언이설에 빠져 불사의 괴물이 된 리치 킹을 토벌하고 칠흑의 성유물 무기를 차지하세요.",
      acceptDialog: "퇴마사 베인: \"언데드 군주의 방에 자리 잡은 리치 킹(B)의 성물함을 부수고 그의 영혼에 종지부를 찍어주시오!\"",
      completeDialog: "퇴마사 베인: \"다크우드를 뒤덮던 죽음의 안개가 걷혔소! 리치 킹의 마력을 정화해 만든 이 초월 무기를 받으시오!\"" },

    // [제11장: 윈드스톰 (R11) - 폭풍의 절벽과 천공의 지배자]
    { id: "Q110", region: "R11", chapter: "제11장: 천공을 가르는 뇌전", name: "돌풍 절벽의 수호자들", objective: "하피 또는 폭풍 정령수호자 12마리 처치", targetType: "kill", targetName: "폭풍 정령수호자", reqCount: 12, exp: 110000, gold: 120000, rewardItem: "C_P05", rewardQty: 8,
      story: "하늘과 맞닿은 윈드스톰 협곡에서 폭풍 정령수호자들이 격렬한 낙뢰 장벽을 쳐 마법학회로 가는 부유 항로를 막고 있습니다.",
      acceptDialog: "천공지기 제피르: \"부유섬 아르카나로 향하는 하늘길이 뇌전 폭풍에 막혔네! 폭풍 정령수호자 12마리를 돌파해 주게!\"",
      completeDialog: "천공지기 제피르: \"뇌전 장벽이 약해졌네! 이제 폭풍의 중심부에 깃든 천공의 지배자를 잠재울 차례야!\"" },
    { id: "Q111", region: "R11", isRegionFinale: true, chapter: "제11장: 천공을 가르는 뇌전 [최종장]", name: "[최종] 폭풍의 눈 잠재우기", objective: "폭풍의 눈(B) 1회 처치", targetType: "kill", targetName: "폭풍의 눈(B)", reqCount: 1, exp: 230000, gold: 240000, rewardByClass: { knight: "QR_R11_SW", ranger: "QR_R11_BW", wizard: "QR_R11_ST" }, rewardItem: "QR_R11_SW", rewardQty: 1,
      story: "대기권의 에테르 파편이 응축되어 탄생한 초거대 뇌전 정령 '폭풍의 눈'을 제압하고 천공 뇌신의 무기를 손에 넣으세요.",
      acceptDialog: "천공지기 제피르: \"산란장 정상의 폭풍의 눈(B)을 잠재우고 천공의 항로를 다시 열어주게!\"",
      completeDialog: "천공지기 제피르: \"구름이 갈라지고 푸른 하늘이 열렸네! 천공의 번개를 품은 이 신성한 무기는 그대의 것일세!\"" },

    // [제12장: 아르카나 (R12) - 무너진 부유도와 기계신 타이탄]
    { id: "Q120", region: "R12", chapter: "제12장: 고대 마공학의 유산", name: "제어실 방어선 돌파", objective: "타이탄 파수꾼 12마리 처치", targetType: "kill", targetName: "타이탄 파수꾼", reqCount: 12, exp: 155000, gold: 165000, rewardItem: "S_WE01", rewardQty: 3,
      story: "고대 마법문명의 정점인 부유도 아르카나의 방어 시스템이 카엘런의 해킹 룬에 감염되어 침입자 말살 모드로 전환되었습니다.",
      acceptDialog: "수석 학자 루미나: \"마공학 제어실로 접근하려면 먼저 폭주하는 타이탄 파수꾼 12기를 무력화해야 합니다!\"",
      completeDialog: "수석 학자 루미나: \"제어실 문이 열렸어요! 하지만 중앙 코어에서 고대 기계신 타이탄이 재기동했습니다!\"" },
    { id: "Q121", region: "R12", isRegionFinale: true, chapter: "제12장: 고대 마공학의 유산 [최종장]", name: "[최종] 기계신 타이탄 정지", objective: "타이탄(B) 1회 처치", targetType: "kill", targetName: "타이탄(B)", reqCount: 1, exp: 320000, gold: 320000, rewardByClass: { knight: "QR_R12_SW", ranger: "QR_R12_BW", wizard: "QR_R12_ST" }, rewardItem: "QR_R12_SW", rewardQty: 1,
      story: "부유도 전체의 마나 노심을 동력원으로 삼는 거대 마공학 병기 '타이탄'을 정지시키고 아크메이지 마공학 무기를 수령하세요.",
      acceptDialog: "수석 학자 루미나: \"기계신 타이탄 제어실의 타이탄(B)을 정지시켜 부유도의 추락을 막아주세요!\"",
      completeDialog: "수석 학자 루미나: \"부유도의 중력 코어가 안정되었습니다! 고대 마공학의 정수가 담긴 이 초합금 무기를 그대에게 바칩니다!\"" },

    // [제13장: 네더게이트 (R13) - 마계의 문과 심연의 마신]
    { id: "Q130", region: "R13", chapter: "제13장: 열려버린 심연의 문", name: "마계 심연근위대 섬멸", objective: "마계 심연근위대 12마리 처치", targetType: "kill", targetName: "마계 심연근위대", reqCount: 12, exp: 210000, gold: 220000, rewardItem: "S_AR01", rewardQty: 4,
      story: "배교자 카엘런이 이터니티로 도주하며 열어젖힌 네더게이트 차원문에서 마계의 정예 근위대가 쏟아져 나오고 있습니다.",
      acceptDialog: "심연파수대장 단테: \"한 발짝도 물러설 수 없다! 차원문 앞을 지키는 마계 심연근위대 12마리를 섬멸하라!\"",
      completeDialog: "심연파수대장 단테: \"근위대가 돌파당하자 마계의 대군주 발록이 직접 모습을 드러냈다!\"" },
    { id: "Q131", region: "R13", isRegionFinale: true, chapter: "제13장: 열려버린 심연의 문 [최종장]", name: "[최종] 차원문 수문장 발록 처단", objective: "발록(B) 1회 처치", targetType: "kill", targetName: "발록(B)", reqCount: 1, exp: 450000, gold: 450000, rewardByClass: { knight: "QR_R13_SW", ranger: "QR_R13_BW", wizard: "QR_R13_ST" }, rewardItem: "QR_R13_SW", rewardQty: 1,
      story: "차원문 중심부를 지키는 지옥의 마신 발록을 처단하여 마계의 침공을 봉쇄하고 심연 파수대의 최종 결전 병기를 계승하세요.",
      acceptDialog: "심연파수대장 단테: \"차원문 중심부의 마신 발록(B)의 목을 베고 마계의 문을 봉인하라!\"",
      completeDialog: "심연파수대장 단테: \"발록이 심연으로 추락했다! 그대야말로 이 시대의 진정한 수호자다. 마신의 마핵을 제련한 이 무기를 받아라!\"" },

    // [제14장: 드래곤피크 (R14) - 용의 영봉과 에이션트 드래곤]
    { id: "Q140", region: "R14", chapter: "제14장: 고룡의 포효", name: "고룡의 수호군단 격파", objective: "고룡 수호드래곤 12마리 처치", targetType: "kill", targetName: "고룡 수호드래곤", reqCount: 12, exp: 310000, gold: 320000, rewardItem: "S_WE01", rewardQty: 5,
      story: "드래곤피크 정상에 둥지를 튼 고룡 에이션트 레드가 마지막 에테르 코어 조각의 마력에 취해 대륙 전체를 불바다로 만들려 합니다.",
      acceptDialog: "용사냥꾼 지크프리트: \"고룡의 둥지로 오르려면 먼저 둥지 입구를 지키는 고룡 수호드래곤 12마리를 베어야 한다!\"",
      completeDialog: "용사냥꾼 지크프리트: \"수호룡들을 모두 베었군! 산 정상이 붉게 달아오르고 있다. 에이션트 레드가 깨어났다!\"" },
    { id: "Q141", region: "R14", isRegionFinale: true, chapter: "제14장: 고룡의 포효 [최종장]", name: "[최종] 고룡 에이션트 레드 토벌", objective: "에이션트 레드(B) 1회 처치", targetType: "kill", targetName: "에이션트 레드(B)", reqCount: 1, exp: 680000, gold: 700000, rewardByClass: { knight: "QR_R14_SW", ranger: "QR_R14_BW", wizard: "QR_R14_ST" }, rewardItem: "QR_R14_SW", rewardQty: 1,
      story: "수천 년을 살아온 재앙의 화염룡 에이션트 레드를 토벌하고, 전설의 드래곤 슬레이어 무기를 손에 넣어 최후의 차원 이터니티로 향하세요.",
      acceptDialog: "용사냥꾼 지크프리트: \"고룡의 둥지 정상의 에이션트 레드(B)를 토벌하라! 새로운 드래곤 슬레이어의 탄생을 지켜보겠다!\"",
      completeDialog: "용사냥꾼 지크프리트: \"전설의 고룡이 그대의 발아래 쓰러졌다! 고룡의 역린과 심장으로 벼려낸 이 무기를 들고 마지막 차원 '이터니티'로 나아가라!\"" },

    // [종장: 이터니티 (R15) - 공허의 중심과 배교자 카엘런의 심판]
    { id: "Q150", region: "R15", chapter: "종장: 창세와 영겁의 끝", name: "카엘런의 친위 결계 돌파", objective: "카엘런의 근위대 15마리 처치", targetType: "kill", targetName: "카엘런의 근위대", reqCount: 15, exp: 520000, gold: 550000, rewardItem: "C_P05", rewardQty: 10,
      story: "15개로 쪼개진 차원의 끝, 이터니티의 옥좌 앞에서 배교자 카엘런이 에테르 코어를 융합해 스스로 신이 되려 하고 있습니다.",
      acceptDialog: "차원 수호자 셀레스티아: \"운명의 수호자여, 옥좌로 향하는 마지막 회랑을 지키는 카엘런의 근위대 15명을 돌파해 주세요!\"",
      completeDialog: "차원 수호자 셀레스티아: \"마침내 옥좌의 문이 열렸습니다! 세계를 분열시킨 원흉, 배교자 카엘런이 그대를 기다리고 있어요!\"" },
    { id: "Q151", region: "R15", isRegionFinale: true, chapter: "종장: 창세와 영겁의 끝 [대단원]", name: "[대단원] 배교자 카엘런 심판", objective: "배교자 카엘런(B) 1회 처치", targetType: "kill", targetName: "배교자 카엘런(B)", reqCount: 1, exp: 1800000, gold: 2000000, rewardByClass: { knight: "QR_R15_SW", ranger: "QR_R15_BW", wizard: "QR_R15_ST" }, rewardItem: "QR_R15_SW", rewardQty: 1,
      story: "에테르 코어를 파괴해 대마법 시대를 혼란에 빠뜨린 원흉 배교자 카엘런을 심판하고, 분열된 15개 차원을 하나로 수복하여 창세의 신화를 완성하세요!",
      acceptDialog: "차원 수호자 셀레스티아: \"모든 차원의 염원을 담아, 배교자 카엘런(B)을 심판하고 에테르 코어를 되찾아 주십시오!\"",
      completeDialog: "차원 수호자 셀레스티아: \"카엘런이 쓰러지고 부서졌던 에테르 코어가 찬란한 창세의 빛을 되찾았습니다! 대마법 시대를 구원한 불멸의 영웅이여, 창세의 에테르 신구를 받아주십시오!\"" }
  ]
};

// 몬스터 드롭 전용 마법서(3~6서클) 및 기술서(2~3서클) 아이템 자동 생성 등록
const registerDropSkillBooks = () => {
  const groups = [
    { list: GameDB.Skills.Mage,    classKey: 'wizard', classLabel: '마법사', prefix: '마법서' },
    { list: GameDB.Skills.Archer,  classKey: 'ranger', classLabel: '엘프궁수', prefix: '정령비급' },
    { list: GameDB.Skills.Warrior, classKey: 'knight', classLabel: '인간전사', prefix: '전투비급' }
  ];
  groups.forEach(g => {
    g.list.forEach(sk => {
      if (!sk.npcLearn) {
        const bookId = `BOOK_${sk.id}`;
        const gradeIdx = sk.circle >= 5 ? 3 : (sk.circle >= 4 ? 2 : 1);
        GameDB.Items.Consumables.push({
          id: bookId,
          name: `${g.prefix}: ${sk.name} (${sk.circle}서클)`,
          type: "마법서",
          skillId: sk.id,
          skillName: sk.name,
          reqClass: g.classKey,
          reqClassLabel: sk.reqClassLabel || g.classLabel,
          circle: sk.circle,
          dropMinLv: sk.dropMinLv || 15,
          dropMaxLv: sk.dropMaxLv || 999,
          fixedGrade: gradeIdx,
          price: sk.circle * 600,
          effect: `[${g.classLabel} ${sk.circle}서클] '${sk.name}' 영구 습득`
        });
      }
    });
  });
};
registerDropSkillBooks();

// 🔒 클라이언트 개발자모드(DevTools)에서 게임 테이블 변조 방지 (불변 동결 처리)
function freezeGameDBTables() {
  try {
    Object.freeze(GameDB.Classes);
    Object.values(GameDB.Classes).forEach(c => Object.freeze(c));
    Object.freeze(GameDB.ItemGrades);
    GameDB.ItemGrades.forEach(g => Object.freeze(g));
    Object.freeze(GameDB.Skills);
    Object.values(GameDB.Skills).forEach(arr => {
      arr.forEach(s => Object.freeze(s));
      Object.freeze(arr);
    });
    Object.freeze(GameDB.Items);
    Object.values(GameDB.Items).forEach(arr => {
      arr.forEach(it => Object.freeze(it));
      Object.freeze(arr);
    });
    GameDB.Monsters.forEach(m => Object.freeze(m));
    Object.freeze(GameDB.Monsters);
    GameDB.Quests.forEach(q => Object.freeze(q));
    Object.freeze(GameDB.Quests);
  } catch (e) {}
}
freezeGameDBTables();

// 분리된 맵 렌더러 초기화 및 Re-export
initAllMaps(GameDB.Regions);
export { OBJ, HardcodedMapDB, DetailFieldRenderer, Renderer };
export default GameDB;