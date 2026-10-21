/**
 * seed_ai_50.js
 * =====================================================================
 * Supabase (xerimaii@gmail.com) 계정에 slot_index 100 ~ 699 (기본 600명)의
 * 자율형 인간화 AI 플레이어(용병 포함) 데이터를 중복 없는 고유 닉네임,
 * 다양한 페르소나, 인간 플레이어와 100% 동일한 전체 마법/기술(GameDB.Skills 83종)로
 * 생성/동기화하는 모듈입니다.
 *
 * [에이전트 추가/시딩 실행 방법]
 * 1) 기본 600명 시딩 (슬롯 100 ~ 699):
 *    node seed_ai_50.js
 * 2) 원하는 인원수 지정하여 추가 시딩 (예: 400명으로 확장 시 슬롯 100 ~ 499):
 *    node seed_ai_50.js 400
 *    또는 환경변수 AI_TOTAL_POOL=400 node seed_ai_50.js
 * =====================================================================
 */
const fs = require('fs');
const path = require('path');

function loadEnvFiles() {
  const candidates = [
    path.join(__dirname, '.env'),
    path.join(__dirname, 'public', '.env')
  ];
  for (const envPath of candidates) {
    if (!fs.existsSync(envPath)) continue;
    const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx === -1) continue;
      const key = trimmed.slice(0, eqIdx).trim();
      const val = trimmed.slice(eqIdx + 1).trim().replace(/^['"]|['"]$/g, '');
      if (!process.env[key]) process.env[key] = val;
    }
  }
}
loadEnvFiles();

const SUPABASE_URL = (process.env.SUPABASE_URL || 'https://fkztpigrlobgkgammvji.supabase.co').replace(/^["']+|["']+$/g, '');
const SUPABASE_KEY = (process.env.SUPABASE_KEY || 'sb_publishable_7scBWfFfF8FJW4qrdcthvw_Rf7q_XcR').replace(/^["']+|["']+$/g, '');
const AI_ACCOUNT_EMAIL = (process.env.AI_ACCOUNT_EMAIL || 'xerimaii@gmail.com').toLowerCase().trim();
const AI_SLOT_START = Number(process.env.AI_SLOT_START || 100);
const cliPoolArg = process.argv[2] ? parseInt(process.argv[2], 10) : NaN;
const AI_TOTAL_POOL = (!isNaN(cliPoolArg) && cliPoolArg >= 50)
  ? cliPoolArg
  : Number(process.env.AI_TOTAL_POOL || 600);
const FALLBACK_AI_USER_ID = 'e0000000-0000-4000-8000-000000000100';

// =====================================================================
// 1. 600명의 중복 없는 한국 MMORPG 감성 고유 닉네임 풀
// =====================================================================
const RAW_AI_NAMES = [
  // 1 ~ 50
  '검성칸', '빛의요정', '지존법사', '바람의화살', '단검술사',
  '은빛달빛', '불꽃마도', '별빛궁수', '아레스', '세라핌',
  '흑기사단', '엘븐가드', '아크메이지', '그림자사냥꾼', '태양의검',
  '달빛산책', '폭풍의눈', '침묵의암살자', '얼음여왕', '붉은매',
  '푸른늑대', '황금화살', '번개법사', '강철의지', '숲의파수꾼',
  '던전개척자', '보스헌터', '명궁로빈', '대현자솔론', '발키리',
  '드래곤슬레이어', '새벽의별', '무적전사', '신궁하데스', '마력폭주',
  '청풍명월', '일격필살', '바람돌이', '힐러요정', '썬더볼트',
  '아이기스', '실버애로우', '블러드소드', '스타라이트', '룬나이트',
  '가디언엔젤', '팬텀레인저', '프로스트', '화염군주', '불사조',
  // 51 ~ 100
  '천공의기사', '달빛요정', '빙결마도사', '질풍의시위', '크림슨소드',
  '에메랄드스타', '다크위자드', '윈드러너', '성기사아서', '아르테미스',
  '데스나이트', '포레스트엘프', '엘리멘탈러', '섀도우헌터', '솔라블레이드',
  '밤하늘별', '태풍의칼날', '안개속자객', '설원의마녀', '적색혜성',
  '회색늑대', '다이아애로우', '뇌전술사', '불굴의방패', '세계수지기',
  '심연탐험가', '레이드대장', '신궁태사자', '대마법사 멀린', '오딘의창',
  '바하무트', '새벽이슬', '광전사카일', '명사수케이', '마나하트',
  '천하무적', '섬광베기', '산들바람', '생명의나무', '라이트닝킹',
  '팔라딘크로스', '문라이트보우', '소울브링어', '스텔라', '매직소드맨',
  '홀리세인트', '고스트아처', '블리자드퀸', '이프리트', '피닉스윙',
  // 101 ~ 150
  '검호무사', '초원의별', '대지의현자', '매의눈', '레이피어',
  '은하수길', '홍련의마도', '유성화살', '타이탄', '가브리엘',
  '암흑성기사', '실버바인수호', '아케인로드', '나이트스토커', '여명의검',
  '달그림자', '칼바람', '무영검', '만년설', '진홍의날개',
  '하얀늑대', '플래티넘보우', '토르의망치', '철벽수비', '요정의숲',
  '미궁도전자', '몬스터슬레이어', '백발백중', '현자카산드라', '프레이야',
  '리바이어던', '샛별지기', '투신바르카', '천리안', '아스트랄',
  '풍운아', '진공참', '솔바람', '요정왕오베론', '기가썬더',
  '이지스함', '샤이닝보우', '다크블레이드', '노바스타', '스펠블레이드',
  '천사장미카엘', '미라주레인저', '빙하의숨결', '볼케이노', '불멸의영혼',
  // 151 ~ 200
  '소드마스터진', '숲속의하프', '심연의마도', '관통의명수', '듀얼블레이드',
  '푸른달빛', '지옥불마법사', '천공의활', '헤라클레스', '라파엘',
  '블랙가드', '그린우드', '위자드킹', '블라인드헌터', '엑스칼리버',
  '별똥별', '회오리바람', '잔영의검사', '아이스프린스', '붉은태양',
  '검은표범', '골든이글', '플라즈마', '강철방패병', '이슬요정',
  '유적발굴단', '네임드헌터', '신기전', '대마도사레이', '발할라전사',
  '드래곤하트', '밤안개', '야만전사렉스', '스나이퍼진', '오버로드',
  '무림고수', '발도술', '가을바람', '치유의손길', '일렉트릭',
  '가디언즈', '아스트로보우', '커스드소드', '오로라빛', '룬블레이더',
  '세인트윙', '스텔스아처', '제로디그리', '파이어스톰', '이터널소울',
  // 201 ~ 250
  '창천의검', '엘프공주', '시간의마도사', '바람의상처', '하얀검객',
  '달빛연가', '메테오마스터', '폭풍화살', '아킬레스', '우리엘',
  '나이트로드', '나무정령', '그랜드매지션', '다크레인저', '성검듀란달',
  '은빛여우', '삭풍의전사', '심야의추적자', '설산의주인', '불타는검',
  '설원늑대', '크리스탈보우', '뇌제인드라', '성벽수호자', '자작나무요정',
  '보물사냥꾼', '보스레이드', '명궁주몽', '마도왕국', '전쟁여신',
  '와이번헌터', '새벽공기', '글래디에이터', '호크아이', '소서러Supreme',
  '강호동풍', '쾌검무쌍', '봄바람', '정령사리아', '스파크법사',
  '성스러운방패', '윈드포스', '데몬슬레이어', '폴라리스', '마검아포칼립스',
  '축복의천사', '소울아처', '프로즌하트', '라바골렘', '불사신',
  // 251 ~ 300
  '전설의기사', '나무잎요정', '별자리법사', '신속의화살', '청룡검객',
  '백호의발톱', '주작의날개', '현무의방패', '기린의뿔', '해태의눈',
  '황혼의검사', '초록빛화살', '코즈믹메이지', '헌터즈문', '왕가의검',
  '고독한방랑자', '질풍노도', '야간비행', '만년빙하', '홍염의기사',
  '은빛늑대단', '발키리보우', '썬더스톰', '불패신화', '요정여왕',
  '던전마스터', '크라운가드', '로빈후드', '아카식레코드', '아스가르드',
  '용기사카이', '아침햇살', '베테랑전사', '일발필중', '마나스프링',
  '일취월장', '폭열검', '높새바람', '생명의샘', '볼트마스터',
  '로얄가드', '엘븐보우마스터', '피의서약', '안드로메다', '소드인챈터',
  '세라프나이트', '섀도우애로우', '아이스에이지', '헬파이어법사', '네버다이'
];

// 중복 원천 제거 및 N명 확장 보장 함수
function buildUniqueAIPoolNames(totalCount) {
  const uniqueSet = new Set();
  const list = [];
  for (const raw of RAW_AI_NAMES) {
    const clean = String(raw || '').replace(/\s+/g, '').trim();
    if (clean && !uniqueSet.has(clean)) {
      uniqueSet.add(clean);
      list.push(clean);
    }
  }
  const prefixes = ['별빛', '달빛', '바람', '불꽃', '서리', '폭풍', '은빛', '황금', '창공', '새벽', '심연', '태양', '강철', '숲속', '번개'];
  const suffixes = ['전사', '궁수', '법사', '검사', '기사', '요정', '헌터', '마도', '현자', '수호자', '개척자', '방랑자', '단장', '명궁', '술사'];
  let seq = 1;
  while (list.length < totalCount) {
    const p = prefixes[seq % prefixes.length];
    const s = suffixes[Math.floor(seq / prefixes.length) % suffixes.length];
    const candidate = `${p}${s}${seq > 225 ? seq : ''}`;
    if (!uniqueSet.has(candidate)) {
      uniqueSet.add(candidate);
      list.push(candidate);
    }
    seq++;
  }
  return list;
}

const AI_PLAYER_NAMES = buildUniqueAIPoolNames(Math.max(1200, AI_TOTAL_POOL));

// =====================================================================
// 2. 다양한 인간형 게이머 페르소나 (24종 성향 및 파티 선호도)
// =====================================================================
const PERSONALITIES = [
  "말수가 적고 'ㅇㅇ', 'ㄱㅅ', 'ㅈㅅ', 'ㄱㄱ' 등 단답형 초성체를 주로 쓰는 과묵한 솔플/파티 게이머",
  "친절하고 뉴비나 파티원을 잘 챙겨주며 정중한 존댓말(~요, ~습니다)을 쓰는 매너 게이머",
  "오직 사냥 효율과 보스 리젠 시간, 득템과 골드 파밍에만 집중하는 실용주의 게이머",
  "경상도 사투리('마 함 해보자', '고마쎄리', '억수로 좋네')를 구수하게 섞어 쓰는 정 많은 아재 게이머",
  "농담과 장난을 좋아하고 'ㅋㅋㅋ', 'ㅎㅎ'를 자주 붙이는 활발한 수다쟁이 게이머",
  "승부욕이 강하고 스펙업과 장비 강화(+6/+8)에 진심인 열혈 게이머",
  "파티원 체력과 버프를 꼼꼼히 챙기며 협동 사냥을 좋아하는 서포터 성향 게이머",
  "전라도 사투리('워메 좋은그', '거시기 허구만', '같이 사냥하제')를 정겹게 쓰는 유쾌한 게이머",
  "충청도 사투리('그려~', '천천히 혀~', '나쁘지 않구먼유')를 쓰며 여유롭게 사냥하는 힐링 게이머",
  "퇴근 후 맥주 한 캔 마시며 편하게 자동/반자동 사냥을 즐기는 직장인 게이머",
  "아이템 시세와 강화 주문서 파밍에 해박한 상인 스타일 게이머",
  "보스 몬스터 토벌과 고레벨 던전 탐험을 주도하는 리더형 게이머",
  "예의 바르고 파티장이 오더를 내리면 칼같이 따라가는 모범생 파티원 게이머",
  "스킬 이펙트와 마법 콤보 연구를 좋아하는 학구파 게이머",
  "용병 육성과 장비 세팅에 애정을 쏟는 용병 애호가 게이머",
  "조용히 묵묵하게 자기 자리에서 사냥하지만 도움을 받으면 꼭 인사를 건네는 게이머",
  "이모티콘('^^', '~', '!')을 자주 쓰며 분위기를 밝게 만드는 친화력 갑 게이머",
  "옛날 클래식 MMORPG 감성을 그리워하며 향수에 젖어 플레이하는 올드비 게이머",
  "물약 값 아끼기와 마나 관리에 철저한 알뜰살뜰 자린고비 게이머",
  "새로운 지역과 사냥터를 돌아다니며 맵 탐험을 즐기는 모험가 성향 게이머",
  "쿨하고 깔끔한 말투로 필요한 말만 핵심적으로 전하는 베테랑 게이머",
  "사냥터에서 마주치는 유저들에게 먼저 인사하고 버프를 걸어주는 훈훈한 게이머",
  "파티 사냥 시 점사(FOCUS)와 빠른 몰이사냥을 선호하는 속도전 게이머",
  "밤낮없이 레벨업 랭킹을 올리는 데 집중하는 성실한 열렙러 게이머"
];

const INVITE_WEIGHT_MAP = [
  0.10, 0.75, 0.30, 0.65, 0.85, 0.25,
  0.90, 0.70, 0.50, 0.45, 0.35, 0.85,
  0.80, 0.40, 0.30, 0.15, 0.85, 0.60,
  0.20, 0.55, 0.35, 0.80, 0.75, 0.40
];

// 지역별 레벨 및 안전지대 좌표 정보
const REGION_CONFIGS = [
  { id: 'R01', minLv: 1,   maxLv: 15,  townX: 2000, townY: 14250 },
  { id: 'R02', minLv: 16,  maxLv: 30,  townX: 2020, townY: 13400 },
  { id: 'R03', minLv: 31,  maxLv: 45,  townX: 2000, townY: 13800 },
  { id: 'R04', minLv: 46,  maxLv: 60,  townX: 2000, townY: 13800 },
  { id: 'R05', minLv: 61,  maxLv: 75,  townX: 2350, townY: 13650 },
  { id: 'R06', minLv: 76,  maxLv: 90,  townX: 2000, townY: 13800 },
  { id: 'R07', minLv: 91,  maxLv: 105, townX: 2050, townY: 14100 },
  { id: 'R08', minLv: 106, maxLv: 120, townX: 2000, townY: 13800 },
  { id: 'R09', minLv: 121, maxLv: 135, townX: 2000, townY: 13800 },
  { id: 'R10', minLv: 136, maxLv: 150, townX: 2000, townY: 13800 },
  { id: 'R11', minLv: 151, maxLv: 165, townX: 2000, townY: 13800 },
  { id: 'R12', minLv: 166, maxLv: 185, townX: 2000, townY: 13800 },
  { id: 'R13', minLv: 186, maxLv: 205, townX: 2000, townY: 13800 },
  { id: 'R14', minLv: 206, maxLv: 225, townX: 2000, townY: 13800 },
  { id: 'R15', minLv: 226, maxLv: 250, townX: 2000, townY: 13800 }
];

// =====================================================================
// 3. 인간 플레이어와 100% 동일한 전체 스킬/마법 DB (GameDB.Skills 83종 완벽 호환)
// =====================================================================
const FULL_SKILL_DB = {
  // ---------------- 전사 (Warrior: W01 ~ W10) ----------------
  W01: { id: 'W01', class: 'knight', circle: 0, reqLv: 1,  name: '소드 마스터리',   mp: 0,  cd: 0,     type: 'passive', bonusPAtk: 10, bonusHit: 3 },
  W03: { id: 'W03', class: 'knight', circle: 0, reqLv: 12, name: '디펜스 오라',     mp: 0,  cd: 0,     type: 'passive', bonusPDef: 12 },
  W08: { id: 'W08', class: 'knight', circle: 0, reqLv: 28, name: '터프니스',       mp: 0,  cd: 0,     type: 'passive', bonusMaxHpPct: 15 },
  W02: { id: 'W02', class: 'knight', circle: 1, reqLv: 1,  name: '배쉬',           mp: 8,  cd: 2200,  mult: 1.75, aoe: false, type: 'attack', stunSec: 1.2 },
  W04: { id: 'W04', class: 'knight', circle: 1, reqLv: 1,  name: '실드 스트라이크', mp: 12, cd: 3200,  mult: 1.55, aoe: false, type: 'stun',   stunSec: 2.0 },
  W05: { id: 'W05', class: 'knight', circle: 2, reqLv: 18, name: '휠윈드',         mp: 22, cd: 4000,  mult: 1.25, hits: 3, aoe: true, maxTargets: 5, type: 'attack' },
  W06: { id: 'W06', class: 'knight', circle: 2, reqLv: 20, name: '레이지',         mp: 0,  cd: 14000, mult: 0,    aoe: false, type: 'buff', buffKey: 'RAGE', dur: 35 },
  W07: { id: 'W07', class: 'knight', circle: 2, reqLv: 22, name: '차지',           mp: 16, cd: 4500,  mult: 2.10, aoe: false, type: 'charge', stunSec: 1.5 },
  W11: { id: 'W11', class: 'knight', circle: 1, reqLv: 5,  name: '아이언 스킨',     mp: 12, cd: 4000,  mult: 0,    aoe: false, type: 'buff', buffKey: 'IRON_SKIN', dur: 300, allyCast: true },
  W12: { id: 'W12', class: 'knight', circle: 2, reqLv: 24, name: '가디언 아머',     mp: 26, cd: 8000,  mult: 0,    aoe: false, type: 'buff', buffKey: 'GUARDIAN_ARMOR', dur: 240, allyCast: true },
  W09: { id: 'W09', class: 'knight', circle: 3, reqLv: 38, name: '카운터 어택',     mp: 22, cd: 7000,  mult: 0,    aoe: false, type: 'buff', buffKey: 'COUNTER', dur: 5 },
  W10: { id: 'W10', class: 'knight', circle: 3, reqLv: 42, name: '워크라이',       mp: 28, cd: 8000,  mult: 1.95, aoe: true, maxTargets: 6, type: 'debuff', defDown: true },

  // ---------------- 궁수 (Archer: AS1~5, A01~A15) ----------------
  AS1: { id: 'AS1', class: 'ranger', circle: 0, reqLv: 1,  name: '보우 마스터리',   mp: 0,  cd: 0,     type: 'passive', bonusPAtk: 12, bonusHit: 4 },
  AS4: { id: 'AS4', class: 'ranger', circle: 0, reqLv: 12, name: '크리티컬 에임',   mp: 0,  cd: 0,     type: 'passive', bonusCrit: 8 },
  AS5: { id: 'AS5', class: 'ranger', circle: 0, reqLv: 28, name: '데들리 포커스',   mp: 0,  cd: 0,     type: 'passive', bonusCritDmg: 20 },
  A04: { id: 'A04', class: 'ranger', circle: 1, reqLv: 1,  name: '파이어 샷',       mp: 6,  cd: 1200,  mult: 1.70, aoe: false, type: 'attack' },
  AS2: { id: 'AS2', class: 'ranger', circle: 1, reqLv: 1,  name: '더블 샷',         mp: 9,  cd: 1500,  mult: 1.18, hits: 2, aoe: false, type: 'attack' },
  A01: { id: 'A01', class: 'ranger', circle: 1, reqLv: 3,  name: '네이처스 터치',   mp: 10, cd: 1800,  heal: 310,  aoe: false, type: 'heal', allyCast: true },
  A02: { id: 'A02', class: 'ranger', circle: 1, reqLv: 4,  name: '인탱글',         mp: 10, cd: 3500,  mult: 1.75, aoe: false, type: 'debuff', stunSec: 2.2, defDown: true },
  A03: { id: 'A03', class: 'ranger', circle: 1, reqLv: 5,  name: '이글 아이',       mp: 14, cd: 3500,  mult: 0,    aoe: false, type: 'buff', buffKey: 'EAGLE_EYE', dur: 300, allyCast: true },
  A05: { id: 'A05', class: 'ranger', circle: 1, reqLv: 6,  name: '윈드 워크',       mp: 12, cd: 3500,  mult: 0,    aoe: false, type: 'buff', buffKey: 'WIND_WALK', dur: 300, allyCast: true },
  AS3: { id: 'AS3', class: 'ranger', circle: 1, reqLv: 7,  name: '닷지 스텝',       mp: 10, cd: 3000,  mult: 0,    aoe: false, type: 'utility' },
  A06: { id: 'A06', class: 'ranger', circle: 2, reqLv: 16, name: '멀티 샷',         mp: 15, cd: 2200,  mult: 1.75, aoe: true, maxTargets: 5, type: 'attack' },
  A07: { id: 'A07', class: 'ranger', circle: 2, reqLv: 18, name: '아이스 샷',       mp: 14, cd: 2500,  mult: 2.05, aoe: false, type: 'attack', stunSec: 2.2 },
  A08: { id: 'A08', class: 'ranger', circle: 2, reqLv: 22, name: '피어스 애로우',   mp: 18, cd: 2800,  mult: 2.45, aoe: false, type: 'attack' },
  A09: { id: 'A09', class: 'ranger', circle: 2, reqLv: 24, name: '엘븐 그레이스',   mp: 22, cd: 5000,  mult: 0,    aoe: false, type: 'buff', buffKey: 'ELVEN_GRACE', dur: 240, allyCast: true },
  A10: { id: 'A10', class: 'ranger', circle: 2, reqLv: 26, name: '사일런스 애로우', mp: 18, cd: 4500,  mult: 2.00, aoe: false, type: 'debuff', defDown: true },
  A11: { id: 'A11', class: 'ranger', circle: 3, reqLv: 38, name: '애로우 레인',     mp: 34, cd: 4500,  mult: 3.10, aoe: true, maxTargets: 7, skyDrop: true, type: 'attack' },
  A12: { id: 'A12', class: 'ranger', circle: 3, reqLv: 42, name: '네이처스 퓨리',   mp: 35, cd: 8000,  mult: 0,    aoe: false, type: 'buff', buffKey: 'NATURES_FURY', dur: 180, allyCast: true },
  A13: { id: 'A13', class: 'ranger', circle: 3, reqLv: 48, name: '스나이퍼 샷',     mp: 42, cd: 5500,  mult: 4.50, aoe: false, type: 'attack' },
  A14: { id: 'A14', class: 'ranger', circle: 3, reqLv: 52, name: '소울 배리어',     mp: 45, cd: 16000, mult: 0,    aoe: false, type: 'buff', buffKey: 'SOUL_BARRIER', dur: 25, allyCast: true },
  A15: { id: 'A15', class: 'ranger', circle: 3, reqLv: 58, name: '게일 샷',         mp: 38, cd: 4200,  mult: 3.60, aoe: false, type: 'attack' },

  // ---------------- 마법사 (Mage: MP1~3, M01~M50) ----------------
  MP1: { id: 'MP1', class: 'wizard', circle: 0, reqLv: 1,  name: '스태프 마스터리', mp: 0,   cd: 0,     type: 'passive', bonusMAtk: 12, bonusHit: 3 },
  MP2: { id: 'MP2', class: 'wizard', circle: 0, reqLv: 12, name: '마나 스트림',     mp: 0,   cd: 0,     type: 'passive', bonusMaxMpPct: 15, bonusMpRegen: 6 },
  MP3: { id: 'MP3', class: 'wizard', circle: 0, reqLv: 28, name: '아케인 위즈덤',   mp: 0,   cd: 0,     type: 'passive', bonusCrit: 7, bonusCoolReduce: 6 },
  // 1서클
  M01: { id: 'M01', class: 'wizard', circle: 1, reqLv: 1,  name: '매직 미사일',     mp: 3,   cd: 700,   mult: 1.28, aoe: false, type: 'attack' },
  M02: { id: 'M02', class: 'wizard', circle: 1, reqLv: 1,  name: '파이어 애로우',   mp: 5,   cd: 900,   mult: 1.55, aoe: false, type: 'attack' },
  M03: { id: 'M03', class: 'wizard', circle: 1, reqLv: 2,  name: '아이스 다트',     mp: 4,   cd: 900,   mult: 1.40, aoe: false, type: 'attack' },
  M04: { id: 'M04', class: 'wizard', circle: 1, reqLv: 4,  name: '윈드 컷',         mp: 8,   cd: 1600,  mult: 1.25, aoe: true, maxTargets: 3, type: 'attack' },
  M05: { id: 'M05', class: 'wizard', circle: 1, reqLv: 3,  name: '라이트',         mp: 4,   cd: 2000,  mult: 0,    aoe: false, type: 'buff', buffKey: 'LIGHT', dur: 600, allyCast: true },
  M06: { id: 'M06', class: 'wizard', circle: 1, reqLv: 5,  name: '쉴드',           mp: 10,  cd: 3500,  mult: 0,    aoe: false, type: 'buff', buffKey: 'SHIELD', dur: 300, allyCast: true },
  M07: { id: 'M07', class: 'wizard', circle: 1, reqLv: 4,  name: '힐링',           mp: 10,  cd: 1800,  heal: 220,   aoe: false, type: 'heal', allyCast: true },
  M08: { id: 'M08', class: 'wizard', circle: 1, reqLv: 6,  name: '텔레포트',       mp: 10,  cd: 1500,  mult: 0,    aoe: false, type: 'utility' },
  // 2서클
  M09: { id: 'M09', class: 'wizard', circle: 2, reqLv: 10, name: '파이어 볼',       mp: 14,  cd: 2200,  mult: 1.90, aoe: true, maxTargets: 5, type: 'attack' },
  M10: { id: 'M10', class: 'wizard', circle: 2, reqLv: 9,  name: '콜드 빔',         mp: 12,  cd: 1500,  mult: 2.05, aoe: false, type: 'attack' },
  M11: { id: 'M11', class: 'wizard', circle: 2, reqLv: 10, name: '라이트닝',       mp: 14,  cd: 1800,  mult: 2.25, aoe: false, skyDrop: true, type: 'attack' },
  M12: { id: 'M12', class: 'wizard', circle: 2, reqLv: 11, name: '커스 포이즌',     mp: 10,  cd: 3200,  mult: 1.65, aoe: false, type: 'debuff', defDown: true },
  M13: { id: 'M13', class: 'wizard', circle: 2, reqLv: 12, name: '그레이트 힐',     mp: 20,  cd: 2200,  heal: 480,  aoe: false, type: 'heal', allyCast: true },
  M14: { id: 'M14', class: 'wizard', circle: 2, reqLv: 12, name: '인챈트 스탯',     mp: 25,  cd: 4000,  mult: 0,    aoe: false, type: 'buff', buffKey: 'ENCHANT_STAT', dur: 300, allyCast: true },
  M15: { id: 'M15', class: 'wizard', circle: 2, reqLv: 13, name: '멘탈 포커스',     mp: 20,  cd: 5000,  mult: 0,    aoe: false, type: 'buff', buffKey: 'MENTAL_FOCUS', dur: 300, allyCast: true },
  M16: { id: 'M16', class: 'wizard', circle: 2, reqLv: 11, name: '블라인드',       mp: 14,  cd: 3500,  mult: 1.45, aoe: false, type: 'debuff' },
  // 3서클
  M17: { id: 'M17', class: 'wizard', circle: 3, reqLv: 22, name: '파이어 월',       mp: 28,  cd: 4500,  mult: 2.30, aoe: true, maxTargets: 5, type: 'attack' },
  M18: { id: 'M18', class: 'wizard', circle: 3, reqLv: 24, name: '아이스 스톰',     mp: 32,  cd: 5000,  mult: 2.55, aoe: true, maxTargets: 6, skyDrop: true, type: 'attack' },
  M19: { id: 'M19', class: 'wizard', circle: 3, reqLv: 26, name: '체인 라이트닝',   mp: 30,  cd: 3800,  mult: 2.25, aoe: true, maxTargets: 4, skyDrop: true, type: 'attack' },
  M20: { id: 'M20', class: 'wizard', circle: 3, reqLv: 24, name: '뱀파이어 터치',   mp: 22,  cd: 3200,  mult: 1.85, aoe: false, drainPct: 20, type: 'attack' },
  M21: { id: 'M21', class: 'wizard', circle: 3, reqLv: 25, name: '슬립',           mp: 18,  cd: 6000,  mult: 1.35, aoe: false, stunSec: 3.5, type: 'debuff' },
  M22: { id: 'M22', class: 'wizard', circle: 3, reqLv: 27, name: '사일런스',       mp: 20,  cd: 6500,  mult: 1.50, aoe: false, type: 'debuff', defDown: true },
  M23: { id: 'M23', class: 'wizard', circle: 3, reqLv: 24, name: '헤이스트',       mp: 35,  cd: 4000,  mult: 0,    aoe: false, type: 'buff', buffKey: 'HASTE', dur: 300, allyCast: true },
  M24: { id: 'M24', class: 'wizard', circle: 3, reqLv: 28, name: '마나 실드',       mp: 40,  cd: 10000, mult: 0,    aoe: false, type: 'buff', buffKey: 'MANA_SHIELD', dur: 300 },
  // 4서클
  M25: { id: 'M25', class: 'wizard', circle: 4, reqLv: 40, name: '메테오(소)',     mp: 48,  cd: 6500,  mult: 3.50, aoe: true, maxTargets: 6, skyDrop: true, type: 'attack' },
  M26: { id: 'M26', class: 'wizard', circle: 4, reqLv: 42, name: '이럽션',         mp: 38,  cd: 2800,  mult: 3.80, aoe: false, type: 'attack' },
  M27: { id: 'M27', class: 'wizard', circle: 4, reqLv: 44, name: '콘 오브 콜드',   mp: 42,  cd: 4800,  mult: 2.90, aoe: true, maxTargets: 5, type: 'attack' },
  M28: { id: 'M28', class: 'wizard', circle: 4, reqLv: 45, name: '디스펠 매직',     mp: 28,  cd: 5500,  mult: 2.10, aoe: false, defDown: true, type: 'debuff' },
  M29: { id: 'M29', class: 'wizard', circle: 4, reqLv: 46, name: '커스 파럴라이즈', mp: 35,  cd: 7500,  mult: 1.80, aoe: false, stunSec: 3.5, type: 'debuff' },
  M30: { id: 'M30', class: 'wizard', circle: 4, reqLv: 42, name: '홀리 워크',       mp: 30,  cd: 5000,  mult: 0,    aoe: false, type: 'buff', buffKey: 'HOLY_WALK', dur: 120, allyCast: true },
  M31: { id: 'M31', class: 'wizard', circle: 4, reqLv: 43, name: '마나 드레인',     mp: 18,  cd: 4500,  mult: 1.95, aoe: false, mpDrain: 25, type: 'attack' },
  M32: { id: 'M32', class: 'wizard', circle: 4, reqLv: 48, name: '쉐도우 팽',       mp: 40,  cd: 5000,  mult: 0,    aoe: false, type: 'buff', buffKey: 'SHADOW_FANG', dur: 300, allyCast: true },
  M33: { id: 'M33', class: 'wizard', circle: 4, reqLv: 50, name: '아이스 스파이크', mp: 40,  cd: 3200,  mult: 3.50, aoe: false, defDown: true, type: 'attack' },
  // 5서클
  M34: { id: 'M34', class: 'wizard', circle: 5, reqLv: 68, name: '뮨 (Immune)',    mp: 75,  cd: 18000, mult: 0,    aoe: false, type: 'buff', buffKey: 'IMMUNE', dur: 20, allyCast: true },
  M35: { id: 'M35', class: 'wizard', circle: 5, reqLv: 70, name: '데스 레이',       mp: 65,  cd: 5500,  mult: 5.40, aoe: false, type: 'attack' },
  M36: { id: 'M36', class: 'wizard', circle: 5, reqLv: 74, name: '블리자드',       mp: 85,  cd: 8500,  mult: 4.10, aoe: true, maxTargets: 8, skyDrop: true, stunSec: 2.0, type: 'attack' },
  M37: { id: 'M37', class: 'wizard', circle: 5, reqLv: 76, name: '라이트닝 스톰',   mp: 80,  cd: 7500,  mult: 4.40, aoe: true, maxTargets: 6, skyDrop: true, stunSec: 1.5, type: 'attack' },
  M38: { id: 'M38', class: 'wizard', circle: 5, reqLv: 80, name: '앱솔루트 배리어', mp: 110, cd: 28000, mult: 0,    aoe: false, type: 'buff', buffKey: 'ABSOLUTE_BARRIER', dur: 8 },
  M39: { id: 'M39', class: 'wizard', circle: 5, reqLv: 72, name: '매스 텔레포트',   mp: 55,  cd: 8000,  mult: 0,    aoe: false, type: 'utility' },
  M40: { id: 'M40', class: 'wizard', circle: 5, reqLv: 75, name: '어스 바인드',     mp: 60,  cd: 10000, mult: 2.40, aoe: true, maxTargets: 5, stunSec: 3.5, type: 'debuff' },
  M41: { id: 'M41', class: 'wizard', circle: 5, reqLv: 72, name: '어드밴스드 스피릿', mp: 70, cd: 8000, mult: 0,    aoe: false, type: 'buff', buffKey: 'ADV_SPIRIT', dur: 300, allyCast: true },
  M42: { id: 'M42', class: 'wizard', circle: 5, reqLv: 78, name: '서먼 몬스터',     mp: 85,  cd: 18000, mult: 0,    aoe: false, type: 'buff', buffKey: 'SUMMON_GOLEM', dur: 120 },
  // 6서클
  M43: { id: 'M43', class: 'wizard', circle: 6, reqLv: 100, name: '미티어 스웜',   mp: 130, cd: 12000, mult: 6.80, aoe: true, maxTargets: 10, skyDrop: true, type: 'attack' },
  M44: { id: 'M44', class: 'wizard', circle: 6, reqLv: 105, name: '앱솔루트 제로', mp: 120, cd: 11000, mult: 5.80, aoe: true, maxTargets: 8,  skyDrop: true, stunSec: 2.5, type: 'attack' },
  M45: { id: 'M45', class: 'wizard', circle: 6, reqLv: 110, name: '헬 파이어',     mp: 110, cd: 7000,  mult: 8.20, aoe: false, type: 'attack' },
  M46: { id: 'M46', class: 'wizard', circle: 6, reqLv: 112, name: '둠',           mp: 95,  cd: 12000, mult: 5.20, aoe: false, defDown: true, skyDrop: true, type: 'debuff' },
  M47: { id: 'M47', class: 'wizard', circle: 6, reqLv: 115, name: '타임 스탑',     mp: 150, cd: 25000, mult: 3.20, aoe: true, maxTargets: 8,  stunSec: 4.5, type: 'debuff' },
  M48: { id: 'M48', class: 'wizard', circle: 6, reqLv: 120, name: '카오스 필드',   mp: 140, cd: 13000, mult: 5.20, aoe: true, maxTargets: 10, skyDrop: true, type: 'attack' },
  M49: { id: 'M49', class: 'wizard', circle: 6, reqLv: 125, name: '워드 오브 데스', mp: 160, cd: 16000, mult: 7.20, aoe: false, skyDrop: true, type: 'attack' },
  M50: { id: 'M50', class: 'wizard', circle: 6, reqLv: 130, name: '아크메이지 폼', mp: 140, cd: 35000, mult: 0,    aoe: false, type: 'buff', buffKey: 'ARCHMAGE', dur: 30 },

  // 하위 호환용 레거시 별칭 (기존 저장 데이터 호환)
  KS1: { id: 'W02', class: 'knight', circle: 1, reqLv: 1,  name: '배쉬',           mp: 8,  cd: 2200, mult: 1.75, aoe: false, type: 'attack', stunSec: 1.2 },
  KS2: { id: 'W07', class: 'knight', circle: 2, reqLv: 22, name: '차지',           mp: 16, cd: 4500, mult: 2.10, aoe: false, type: 'charge', stunSec: 1.5 },
  KS3: { id: 'W05', class: 'knight', circle: 2, reqLv: 18, name: '휠윈드',         mp: 22, cd: 4000, mult: 1.25, hits: 3, aoe: true, maxTargets: 5, type: 'attack' },
  KS4: { id: 'W06', class: 'knight', circle: 2, reqLv: 20, name: '레이지',         mp: 0,  cd: 14000, mult: 0,   aoe: false, type: 'buff', buffKey: 'RAGE', dur: 35 },
  KS5: { id: 'W04', class: 'knight', circle: 1, reqLv: 1,  name: '실드 스트라이크', mp: 12, cd: 3200, mult: 1.55, aoe: false, type: 'stun', stunSec: 2.0 },
  KS6: { id: 'W10', class: 'knight', circle: 3, reqLv: 42, name: '워크라이',       mp: 28, cd: 8500, mult: 1.85, aoe: true, maxTargets: 6, type: 'debuff', defDown: true },
  KS7: { id: 'W04', class: 'knight', circle: 1, reqLv: 1,  name: '실드 스트라이크', mp: 12, cd: 3200, mult: 1.55, aoe: false, type: 'stun', stunSec: 2.0 },
  KS8: { id: 'W09', class: 'knight', circle: 3, reqLv: 38, name: '카운터 어택',     mp: 22, cd: 7500, mult: 0,    aoe: false, type: 'buff', buffKey: 'COUNTER', dur: 5 },
  KS9: { id: 'W05', class: 'knight', circle: 2, reqLv: 18, name: '휠윈드',         mp: 22, cd: 4000, mult: 1.25, hits: 3, aoe: true, maxTargets: 5, type: 'attack' },
  MS1: { id: 'M09', class: 'wizard', circle: 2, reqLv: 10, name: '파이어 볼',       mp: 14, cd: 2200, mult: 1.90, aoe: true, maxTargets: 5, type: 'attack' },
  MS2: { id: 'M10', class: 'wizard', circle: 2, reqLv: 9,  name: '콜드 빔',         mp: 12, cd: 1500, mult: 2.05, aoe: false, type: 'attack' },
  MS3: { id: 'M07', class: 'wizard', circle: 1, reqLv: 4,  name: '힐링',           mp: 10, cd: 1800, heal: 220,   aoe: false, type: 'heal', allyCast: true },
  MS4: { id: 'M14', class: 'wizard', circle: 2, reqLv: 12, name: '인챈트 스탯',     mp: 25, cd: 4000, mult: 0,    aoe: false, type: 'buff', buffKey: 'ENCHANT_STAT', dur: 300, allyCast: true },
  MS5: { id: 'M11', class: 'wizard', circle: 2, reqLv: 10, name: '라이트닝',       mp: 14, cd: 1800, mult: 2.25, aoe: false, skyDrop: true, type: 'attack' },
  MS6: { id: 'M36', class: 'wizard', circle: 5, reqLv: 74, name: '블리자드',       mp: 85, cd: 8500, mult: 4.10, aoe: true, maxTargets: 8, skyDrop: true, type: 'attack' },
  MS7: { id: 'M26', class: 'wizard', circle: 4, reqLv: 42, name: '이럽션',         mp: 38, cd: 2800, mult: 3.80, aoe: false, type: 'attack' },
  MS8: { id: 'M13', class: 'wizard', circle: 2, reqLv: 12, name: '그레이트 힐',     mp: 20, cd: 2200, heal: 480,  aoe: false, type: 'heal', allyCast: true },
  MS9: { id: 'M43', class: 'wizard', circle: 6, reqLv: 100, name: '미티어 스웜',   mp: 130, cd: 12000, mult: 6.80, aoe: true, maxTargets: 10, skyDrop: true, type: 'attack' }
};

function getLearnedSkillsForClass(charClass, level) {
  const lv = Number(level) || 1;
  const canonicalIds = Object.keys(FULL_SKILL_DB).filter(k => !k.startsWith('KS') && !k.startsWith('MS'));
  const learned = [];
  for (const id of canonicalIds) {
    const sk = FULL_SKILL_DB[id];
    if (sk && sk.class === charClass && lv >= (sk.reqLv || 1)) {
      learned.push(id);
    }
  }
  return learned;
}

async function supabaseRest(endpoint, method = 'GET', body = null, prefer = 'return=representation') {
  const url = `${SUPABASE_URL}/rest/v1/${endpoint}`;
  const headers = {
    apikey: SUPABASE_KEY,
    'Content-Type': 'application/json',
    Prefer: prefer
  };
  if (SUPABASE_KEY.startsWith('eyJ')) {
    headers.Authorization = `Bearer ${SUPABASE_KEY}`;
  }
  const opts = { method, headers };
  if (body !== null) opts.body = JSON.stringify(body);
  const res = await fetch(url, opts);
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch (e) {
    json = text;
  }
  if (!res.ok) {
    const err = new Error(`Supabase HTTP ${res.status}: ${typeof json === 'string' ? json : JSON.stringify(json)}`);
    err.status = res.status;
    throw err;
  }
  return json;
}

function getTierForLevel(level) {
  if (level >= 150) return '05';
  if (level >= 90) return '04';
  if (level >= 45) return '03';
  if (level >= 20) return '02';
  return '01';
}

function makeEquipItem(typeCode, name, slot, stats, enchantLevel = 4, gradeIdx = 1) {
  const gradeNames = ['일반', '고급', '희귀', '전설', '초월'];
  const gradeColors = ['#ffffff', '#2ecc71', '#3498db', '#f39c12', '#e74c3c'];
  const gIdx = Math.max(0, Math.min(4, gradeIdx));
  const mult = [1.0, 1.05, 1.1, 1.15, 1.25][gIdx] || 1.0;
  const enchBonus = enchantLevel * 0.03;

  const finalStats = {};
  for (const [k, v] of Object.entries(stats)) {
    if (k === 'pAtk' || k === 'mAtk' || k === 'pDef' || k === 'mDef') {
      finalStats[k] = Math.max(1, Math.round(v * (mult + enchBonus)));
    } else {
      finalStats[k] = v;
    }
  }

  return {
    id: `ai_eq_${typeCode}_${Date.now()}_${Math.floor(Math.random() * 100000)}`,
    type: typeCode,
    name: enchantLevel > 0 ? `+${enchantLevel} [${gradeNames[gIdx]}] ${name}` : `[${gradeNames[gIdx]}] ${name}`,
    baseName: name,
    slot,
    gradeIdx: gIdx,
    gradeName: gradeNames[gIdx],
    gradeColor: gradeColors[gIdx],
    color: gradeColors[gIdx],
    enchantLevel,
    plus: enchantLevel,
    stats: finalStats,
    options: [],
    elemType: null,
    elemTier: 0
  };
}

function buildEquipmentSetForClass(charClass, level) {
  const tier = getTierForLevel(level);
  const tierNum = Number(tier);
  const gradeIdx = Math.min(3, Math.floor((tierNum - 1) * 0.8));

  const weaponMap = {
    knight: {
      '01': ['W_SW01', '수련용 단검', { pAtk: 11, crit: 3 }],
      '02': ['W_SW02', '강철 장검', { pAtk: 26, crit: 4 }],
      '03': ['W_SW03', '미스릴 소드', { pAtk: 48, crit: 6 }],
      '04': ['W_SW04', '드래곤 슬레이어', { pAtk: 76, crit: 9, drain: 3 }],
      '05': ['W_SW05', '심연의 마검', { pAtk: 125, crit: 12, drain: 4 }]
    },
    ranger: {
      '01': ['W_BW01', '사냥꾼의 단궁', { pAtk: 14, crit: 4, dex: 2 }],
      '02': ['W_BW02', '엘븐 보우', { pAtk: 28, crit: 7, dex: 4, drain: 1 }],
      '03': ['W_BW03', '실버 윈드보우', { pAtk: 52, crit: 10, dex: 7, drain: 2 }],
      '04': ['W_BW04', '천공의 장궁', { pAtk: 82, crit: 14, dex: 11, drain: 3 }],
      '05': ['W_BW05', '세계수의 신궁', { pAtk: 132, crit: 18, dex: 16, drain: 5 }]
    },
    wizard: {
      '01': ['W_ST01', '초심자의 지팡이', { mAtk: 14, int: 2, mpRegen: 2 }],
      '02': ['W_ST02', '마력 깃든 스태프', { mAtk: 30, int: 4, mpRegen: 4 }],
      '03': ['W_ST03', '현자의 지팡이', { mAtk: 55, int: 7, mpRegen: 6 }],
      '04': ['W_ST04', '아크메이지 완드', { mAtk: 88, int: 12, mpRegen: 9 }],
      '05': ['W_ST05', '창세의 마도장', { mAtk: 140, int: 18, mpRegen: 14 }]
    }
  };

  const armorNames = { '01': '가죽 갑옷', '02': '사슬 갑옷', '03': '미스릴 아머', '04': '드래곤 아머', '05': '이모탈 아머' };
  const helmNames  = { '01': '가죽 투구', '02': '철제 투구', '03': '미스릴 헬름', '04': '드래곤 헬름', '05': '이모탈 크라운' };
  const bootNames  = { '01': '가죽 장화', '02': '강철 그리브', '03': '미스릴 부츠', '04': '드래곤 부츠', '05': '이모탈 부츠' };
  const gloveNames = { '01': '가죽 장갑', '02': '강철 건틀릿', '03': '미스릴 건틀릿', '04': '드래곤 건틀릿', '05': '이모탈 건틀릿' };
  const cloakNames = { '01': '여행자의 망토', '02': '수호의 망토', '03': '미스릴 클록', '04': '드래곤 윙', '05': '심연의 날개' };

  const wDef = (weaponMap[charClass] || weaponMap.knight)[tier];
  const pDefBase = [8, 18, 34, 54, 85][tierNum - 1] || 8;
  const mDefBase = [4, 9, 18, 30, 48][tierNum - 1] || 4;

  return {
    weapon: makeEquipItem(wDef[0], wDef[1], 'weapon', wDef[2], 6, gradeIdx),
    armor:  makeEquipItem(`A_BD${tier}`, armorNames[tier], 'armor', { pDef: pDefBase, mDef: mDefBase }, 4, gradeIdx),
    helmet: makeEquipItem(`A_HM${tier}`, helmNames[tier], 'helmet', { pDef: Math.round(pDefBase * 0.45), mDef: Math.round(mDefBase * 0.5) }, 4, gradeIdx),
    boots:  makeEquipItem(`A_BT${tier}`, bootNames[tier], 'boots', { pDef: Math.round(pDefBase * 0.35), speed: 6 + tierNum * 2 }, 4, gradeIdx),
    gloves: makeEquipItem(`A_GL${tier}`, gloveNames[tier], 'gloves', { pDef: Math.round(pDefBase * 0.35), crit: tierNum * 2 }, 4, gradeIdx),
    cloak:  makeEquipItem(`A_CK${tier}`, cloakNames[tier], 'cloak', { pDef: Math.round(pDefBase * 0.3), mDef: Math.round(mDefBase * 0.7) }, 4, gradeIdx),
    necklace: makeEquipItem(`AC_NK0${Math.min(3, tierNum)}`, '수호의 목걸이', 'necklace', { mDef: 6 * tierNum, maxHp: 50 * tierNum }, 3, gradeIdx),
    ring:   makeEquipItem(`AC_RG0${Math.min(3, tierNum)}`, '수호의 반지', 'ring', { pAtk: 3 * tierNum, mAtk: 3 * tierNum, pDef: 3 * tierNum }, 3, gradeIdx),
    belt:   makeEquipItem(`AC_BT0${Math.min(3, tierNum)}`, '수호의 벨트', 'belt', { maxHp: 60 * tierNum, pDef: 4 * tierNum }, 3, gradeIdx)
  };
}

function getStarterInventoryForLevel(charClass, level) {
  const hpPot = level >= 120 ? 'C_HP04' : (level >= 60 ? 'C_HP03' : (level >= 25 ? 'C_HP02' : 'C_HP01'));
  const mpPot = level >= 100 ? 'C_MP03' : (level >= 40 ? 'C_MP02' : 'C_MP01');
  return [
    { id: `inv_hp_${Date.now()}_1`, type: hpPot, count: 350 },
    { id: `inv_mp_${Date.now()}_2`, type: mpPot, count: 250 },
    { id: `inv_spd_${Date.now()}_3`, type: 'C_SPD01', count: 120 },
    { id: `inv_atk_${Date.now()}_4`, type: 'C_ATK01', count: 120 },
    { id: `inv_town_${Date.now()}_5`, type: 'S_TOWN', count: 30 },
    { id: `inv_wpn_${Date.now()}_6`, type: 'S_WPN01', count: 5 },
    { id: `inv_arm_${Date.now()}_7`, type: 'S_ARM01', count: 5 }
  ];
}

function buildHiredMercenaryForAI(ownerClass, level, posX, posY) {
  const mercPool = ownerClass === 'knight'
    ? ['ranger', 'wizard']
    : (ownerClass === 'ranger' ? ['knight', 'wizard'] : ['knight', 'ranger']);
  const mercClass = mercPool[level % mercPool.length];
  const mercNameMap = {
    knight: '강철방패 록산 (전사 용병)',
    ranger: '바람화살 실비아 (궁수 용병)',
    wizard: '별빛마도 에르윈 (마법사 용병)'
  };
  const maxHp = Math.floor((mercClass === 'knight' ? 240 : 180) + level * (mercClass === 'knight' ? 42 : 30));
  const maxMp = Math.floor((mercClass === 'wizard' ? 180 : 100) + level * (mercClass === 'wizard' ? 25 : 14));
  const hpPot = level >= 120 ? 'C_HP04' : (level >= 60 ? 'C_HP03' : (level >= 25 ? 'C_HP02' : 'C_HP01'));
  const mpPot = level >= 100 ? 'C_MP03' : (level >= 40 ? 'C_MP02' : 'C_MP01');

  return {
    hired: true,
    isDead: false,
    class: mercClass,
    name: mercNameMap[mercClass],
    level,
    exp: 0,
    maxExp: Math.floor(120 * Math.pow(level, 1.35)),
    x: posX + 42,
    y: posY + 32,
    dir: 'down',
    isWalking: false,
    hp: maxHp,
    maxHp,
    mp: maxMp,
    maxMp,
    stance: 'ATTACK',
    learnedSkills: getLearnedSkillsForClass(mercClass, level),
    stats: {
      str: (mercClass === 'knight' ? 18 : 11) + Math.floor(level * 1.5),
      dex: (mercClass === 'ranger' ? 18 : 12) + Math.floor(level * 1.5),
      con: (mercClass === 'knight' ? 16 : 12) + Math.floor(level * 1.2),
      int: (mercClass === 'wizard' ? 18 : 10) + Math.floor(level * 1.5),
      wis: (mercClass === 'wizard' ? 16 : 10) + Math.floor(level * 1.2),
      statPoints: 0
    },
    inventory: [
      { id: `merc_hp_${Date.now()}_1`, type: hpPot, count: 150 },
      { id: `merc_mp_${Date.now()}_2`, type: mpPot, count: 100 },
      { id: `merc_spd_${Date.now()}_3`, type: 'C_SPD01', count: 50 },
      { id: `merc_atk_${Date.now()}_4`, type: 'C_ATK01', count: 50 }
    ],
    equip: buildEquipmentSetForClass(mercClass, level),
    requirePotion: false,
    requireBuffPotion: false,
    waitingForGold: false
  };
}

function generateAICharacterRecord(slotIndex, userId) {
  const idx = Math.max(0, slotIndex - AI_SLOT_START); // 0 ~ 599 (600명 풀)
  const rawName = AI_PLAYER_NAMES[idx] || `모험가${slotIndex}`;
  const classes = ['knight', 'ranger', 'wizard'];
  const charClass = classes[idx % classes.length];

  // 600명의 에이전트를 R01 ~ R15 전 지역(필드 _sub1 & 던전 _dungeon 총 30개 맵) 및 레벨대(Lv.5 ~ Lv.245)에 고르게 분포
  const regionIdx = idx % REGION_CONFIGS.length;
  const regCfg = REGION_CONFIGS[regionIdx];
  const levelSpan = Math.max(1, regCfg.maxLv - regCfg.minLv);
  const level = regCfg.minLv + ((idx * 7) % (levelSpan + 1));

  const isDungeonSpawn = (Math.floor(idx / REGION_CONFIGS.length) % 3 === 1);
  const mapKey = isDungeonSpawn ? `${regCfg.id}_dungeon` : `${regCfg.id}_sub1`;
  const posX = isDungeonSpawn
    ? Math.round(950 + ((idx * 193) % 1150))
    : Math.round(1350 + ((idx * 173) % 1300));
  const posY = isDungeonSpawn
    ? Math.round(950 + ((idx * 257) % 1150))
    : Math.round(8300 + ((idx * 389) % 4400));

  let nameHash = idx * 31;
  for (let i = 0; i < rawName.length; i++) nameHash += rawName.charCodeAt(i);
  const personaIdx = (idx + nameHash) % PERSONALITIES.length;
  const personality = PERSONALITIES[personaIdx];
  const autoInviteChance = INVITE_WEIGHT_MAP[personaIdx % INVITE_WEIGHT_MAP.length];

  const maxHp = Math.floor((charClass === 'knight' ? 240 : (charClass === 'ranger' ? 185 : 155)) + level * (charClass === 'knight' ? 45 : (charClass === 'ranger' ? 34 : 26)));
  const maxMp = Math.floor((charClass === 'wizard' ? 220 : 120) + level * (charClass === 'wizard' ? 36 : 18));
  const maxExp = Math.floor(100 * Math.pow(level, 1.38));
  const gold = 500000 + level * 35000;

  const equip = buildEquipmentSetForClass(charClass, level);
  const learnedSkills = getLearnedSkillsForClass(charClass, level);
  const inventory = getStarterInventoryForLevel(charClass, level);
  const mercenary = buildHiredMercenaryForAI(charClass, level, posX, posY);

  const deterministicUuid = `a1000000-0000-4000-8000-${String(slotIndex).padStart(12, '0')}`;

  return {
    id: deterministicUuid,
    user_id: userId,
    slot_index: slotIndex,
    name: rawName,
    class: charClass,
    level,
    exp: Math.floor(maxExp * 0.25),
    gold,
    region_key: regCfg.id,
    map_key: mapKey,
    pos_x: posX,
    pos_y: posY,
    session_token: null,
    char_data: {
      isAI: true,
      hp: maxHp,
      maxHp,
      mp: maxMp,
      maxMp,
      maxExp,
      stats: {
        STR: (charClass === 'knight' ? 18 : 11) + Math.floor(level * 1.6),
        DEX: (charClass === 'ranger' ? 18 : 12) + Math.floor(level * 1.6),
        CON: (charClass === 'knight' ? 16 : 12) + Math.floor(level * 1.3),
        INT: (charClass === 'wizard' ? 18 : 10) + Math.floor(level * 1.6),
        str: (charClass === 'knight' ? 18 : 11) + Math.floor(level * 1.6),
        dex: (charClass === 'ranger' ? 18 : 12) + Math.floor(level * 1.6),
        con: (charClass === 'knight' ? 16 : 12) + Math.floor(level * 1.3),
        int: (charClass === 'wizard' ? 18 : 10) + Math.floor(level * 1.6),
        wis: (charClass === 'wizard' ? 16 : 11) + Math.floor(level * 1.3),
        statPoints: 0
      },
      equip,
      inventory,
      learnedSkills,
      quickSlots: learnedSkills.slice(-6),
      mercenary,
      personality,
      autoInviteChance,
      options: { lootGrade: 0, cameraStage: 2, cameraAutoZoom: true }
    },
    updated_at: new Date().toISOString()
  };
}

function generateLocal50AIPool(userId = FALLBACK_AI_USER_ID, poolSize = AI_TOTAL_POOL) {
  const pool = [];
  for (let slot = AI_SLOT_START; slot < AI_SLOT_START + poolSize; slot++) {
    pool.push(generateAICharacterRecord(slot, userId));
  }
  return pool;
}

async function ensure50AICharactersSeeded(customPoolSize = AI_TOTAL_POOL) {
  const targetPoolSize = Math.max(1, Math.min(1000, Number(customPoolSize) || AI_TOTAL_POOL));
  let targetUserId = FALLBACK_AI_USER_ID;
  try {
    // 1. xerimaii@gmail.com 계정 조회 또는 생성
    const accRows = await supabaseRest(`magic_accounts?email=eq.${encodeURIComponent(AI_ACCOUNT_EMAIL)}&select=*`);
    if (Array.isArray(accRows) && accRows.length > 0 && accRows[0].user_id) {
      targetUserId = accRows[0].user_id;
    } else {
      const createdAcc = await supabaseRest(
        'magic_accounts?on_conflict=user_id',
        'POST',
        {
          user_id: FALLBACK_AI_USER_ID,
          email: AI_ACCOUNT_EMAIL,
          active_session_token: null,
          updated_at: new Date().toISOString()
        },
        'resolution=merge-duplicates,return=representation'
      );
      if (Array.isArray(createdAcc) && createdAcc[0]?.user_id) {
        targetUserId = createdAcc[0].user_id;
      }
    }

    // 2. 해당 계정의 slot_index >= 100 캐릭터 전체 조회 (최대 1000개)
    const existingAiChars = await supabaseRest(
      `magic_characters?user_id=eq.${encodeURIComponent(targetUserId)}&slot_index=gte.${AI_SLOT_START}&slot_index=lt.${AI_SLOT_START + targetPoolSize}&select=*&order=slot_index.asc&limit=1000`
    );

    const existingSlotMap = new Map();
    const usedNames = new Set();
    if (Array.isArray(existingAiChars)) {
      for (const row of existingAiChars) {
        existingSlotMap.set(Number(row.slot_index), row);
        if (row.name) usedNames.add(String(row.name).trim());
      }
    }

    const toUpsert = [];
    for (let slot = AI_SLOT_START; slot < AI_SLOT_START + targetPoolSize; slot++) {
      const existing = existingSlotMap.get(slot);
      const fresh = generateAICharacterRecord(slot, targetUserId);

      if (!existing) {
        // 이름 중복 방지 확인
        if (usedNames.has(fresh.name)) {
          fresh.name = `${fresh.name}${slot}`;
        }
        usedNames.add(fresh.name);
        toUpsert.push(fresh);
      } else {
        // 기존 슬롯이 있을 경우 인간 플레이어와 동등한 전체 스킬셋(M01~M50 등) 및 페르소나/용병 자동 보강
        const curCd = existing.char_data || {};
        const fullSkills = getLearnedSkillsForClass(existing.class || fresh.class, existing.level || fresh.level);
        const curSkills = Array.isArray(curCd.learnedSkills) ? curCd.learnedSkills : [];
        const mergedSkills = Array.from(new Set([...curSkills, ...fullSkills]));

        const needsUpgrade =
          !curCd.mercenary ||
          !curCd.mercenary.hired ||
          !curCd.personality ||
          mergedSkills.length > curSkills.length;

        if (needsUpgrade) {
          existing.char_data = {
            ...fresh.char_data,
            ...curCd,
            isAI: true,
            learnedSkills: mergedSkills,
            personality: curCd.personality || fresh.char_data.personality,
            autoInviteChance: typeof curCd.autoInviteChance === 'number' ? curCd.autoInviteChance : fresh.char_data.autoInviteChance,
            mercenary: curCd.mercenary?.hired
              ? { ...curCd.mercenary, learnedSkills: getLearnedSkillsForClass(curCd.mercenary.class || 'knight', curCd.mercenary.level || existing.level || 15) }
              : fresh.char_data.mercenary
          };
          existing.updated_at = new Date().toISOString();
          toUpsert.push(existing);
        }
      }
    }

    if (toUpsert.length > 0) {
      // 50명 단위 고속 배치 업서트 + 개별 이름 충돌 폴백
      const BATCH_SIZE = 50;
      for (let i = 0; i < toUpsert.length; i += BATCH_SIZE) {
        const batch = toUpsert.slice(i, i + BATCH_SIZE);
        try {
          await supabaseRest('magic_characters?on_conflict=id', 'POST', batch, 'resolution=merge-duplicates,return=minimal');
        } catch (batchErr) {
          for (const rec of batch) {
            try {
              await supabaseRest('magic_characters?on_conflict=id', 'POST', rec, 'resolution=merge-duplicates,return=minimal');
            } catch (singleErr) {
              if (String(singleErr.message).includes('23505') || String(singleErr.message).includes('duplicate')) {
                rec.name = `${rec.name}${rec.slot_index}`;
                await supabaseRest('magic_characters?on_conflict=id', 'POST', rec, 'resolution=merge-duplicates,return=minimal');
              }
            }
          }
        }
      }
      console.log(`✔ [Supabase AI 시딩 완료] ${AI_ACCOUNT_EMAIL} 계정에 ${toUpsert.length}명의 AI 플레이어(슬롯 ${AI_SLOT_START}~${AI_SLOT_START + targetPoolSize - 1}, 총 ${targetPoolSize}명 풀)를 등록/동기화했습니다.`);
    } else {
      console.log(`✔ [Supabase AI 확인 완료] ${AI_ACCOUNT_EMAIL} 계정의 AI 플레이어 ${targetPoolSize}명(슬롯 ${AI_SLOT_START}~${AI_SLOT_START + targetPoolSize - 1})이 모두 준비되어 있습니다.`);
    }

    const finalRows = await supabaseRest(
      `magic_characters?user_id=eq.${encodeURIComponent(targetUserId)}&slot_index=gte.${AI_SLOT_START}&slot_index=lt.${AI_SLOT_START + targetPoolSize}&select=*&order=slot_index.asc&limit=1000`
    );
    if (Array.isArray(finalRows) && finalRows.length > 0) {
      return finalRows;
    }
  } catch (err) {
    console.warn(`⚠️ [Supabase AI 시딩 오프라인 폴백] 원격 DB 연결 대기 중이므로 내장된 ${targetPoolSize}명 AI 프로필 풀을 사용합니다: ${err.message}`);
  }
  return generateLocal50AIPool(targetUserId, targetPoolSize);
}


/**
 * 운영자 명령어 (/모험가생성 <숫자>) 전용:
 * 기존 AI 에이전트(slot_index >= 100)를 DB에서 모두 삭제한 뒤, 지정한 인원수만큼 새로 생성합니다.
 */
async function resetAndReseedAICharacters(customPoolSize = AI_TOTAL_POOL) {
  const targetPoolSize = Math.max(1, Math.min(1000, Number(customPoolSize) || AI_TOTAL_POOL));
  let targetUserId = FALLBACK_AI_USER_ID;
  try {
    const accRows = await supabaseRest(`magic_accounts?email=eq.${encodeURIComponent(AI_ACCOUNT_EMAIL)}&select=*`);
    if (Array.isArray(accRows) && accRows.length > 0 && accRows[0].user_id) {
      targetUserId = accRows[0].user_id;
    }
    // 기존 AI 캐릭터(slot_index >= 100) 일괄 삭제
    await supabaseRest(
      `magic_characters?user_id=eq.${encodeURIComponent(targetUserId)}&slot_index=gte.${AI_SLOT_START}`,
      'DELETE',
      null,
      'return=minimal'
    );
    if (targetUserId !== FALLBACK_AI_USER_ID) {
      await supabaseRest(
        `magic_characters?user_id=eq.${encodeURIComponent(FALLBACK_AI_USER_ID)}&slot_index=gte.${AI_SLOT_START}`,
        'DELETE',
        null,
        'return=minimal'
      ).catch(() => {});
    }
    console.log(`🗑️ [AI 초기화 완료] ${AI_ACCOUNT_EMAIL} 계정의 기존 AI 에이전트(슬롯 ${AI_SLOT_START} 이상) 데이터를 모두 삭제했습니다.`);
  } catch (err) {
    console.warn(`⚠️ [AI 초기화 경고] 기존 AI 삭제 중 오류 발생 (계속 진행): ${err.message}`);
  }
  return await ensure50AICharactersSeeded(targetPoolSize);
}

if (require.main === module) {
  ensure50AICharactersSeeded(AI_TOTAL_POOL).then(rows => {
    console.log(`[완료] ${AI_ACCOUNT_EMAIL} 계정 총 ${rows.length}명의 AI 캐릭터(슬롯 ${AI_SLOT_START}~${AI_SLOT_START + rows.length - 1}) 준비됨.`);
    process.exit(0);
  });
}

module.exports = {
  AI_ACCOUNT_EMAIL,
  AI_SLOT_START,
  AI_TOTAL_POOL,
  AI_PLAYER_NAMES,
  REGION_CONFIGS,
  PERSONALITIES,
  INVITE_WEIGHT_MAP,
  FULL_SKILL_DB,
  supabaseRest,
  buildEquipmentSetForClass,
  buildHiredMercenaryForAI,
  getLearnedSkillsForClass,
  getStarterInventoryForLevel,
  generateAICharacterRecord,
  generateLocal50AIPool,
  ensure50AICharactersSeeded,
  ensure300AICharactersSeeded: ensure50AICharactersSeeded,
  ensure600AICharactersSeeded: ensure50AICharactersSeeded,
  resetAndReseedAICharacters
};
