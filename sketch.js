// Escape Room — Stage 1 MVP
// 혼자만의 고독한 사투

// --- 적응형 캔버스 (가로 모드) ---
let W, H, S;                            // W/H = 논리 좌표(항상 가로), S = 아트 스케일 (가로 640x360 기준)
let VW, VH;                             // 실제 뷰포트 픽셀 = 캔버스 크기
let ROT = false;                        // 세로로 들면 true → 캔버스를 90° 돌려 가로로 렌더(회전 유도)
let ROOM_TOP, ROOM_BOTTOM;
let PLAYER_RANGE_LEFT, PLAYER_RANGE_RIGHT;
let PANEL_LEFT, PANEL_W;                // 우측 컨트롤 패널 (앞으로/쉬기 버튼)
const DESIGN_W = 640, DESIGN_H = 360;   // 가로 디자인 기준 해상도 (16:9)

// --- 폰트 (KBL Jump 패밀리) ---
// preload()에서 로드. 사용: textFont(FONTS.kblExtended) 등.
let FONTS = {};

// --- 이미지 에셋 --- (preload()에서 로드. 사용: image(IMAGES.logo, ...))
let IMAGES = {};

// --- 캐릭터 스프라이트 (한 장 시트에서 프레임만 잘라 그려 6장 개별 로드 대비 리소스 절약) ---
// sprite-sheet-cut.png = 2250x646, 375x646 프레임 6칸. 0=서있기, 1~5=걷기. (배경 흰색→투명 처리본)
const SPR_COLS = 6;          // 프레임 수: 0=서있기, 1~5=걷기
const SPR_FW = 375;          // 프레임 한 칸 폭(px)
const SPR_FH = 646;          // 프레임 한 칸 높이(px)
const SPR_FEET = 0.967;      // 칸 안 발바닥 세로 위치 비율 (아래 여백 보정 → 발을 바닥선에 맞춤)
const PLAYER_H_U = 120;      // 캐릭터 표시 높이 (디자인 단위, ×S)
const WALK_FRAME_MS = 90;    // 걷기 프레임 전환 간격(ms)
const WALK_BURST_MS = 360;   // '앞으로' 탭 1회당 걷기 애니메이션 지속(ms)
// 피자박스가 쌓이는 지점 = 스프라이트 안 지게(등에 멘 나무 받침) 윗면 (측정값 기반)
const RACK_TOP_RATIO = 0.79; // 지게 윗면 높이 = 발바닥에서 스프라이트 높이의 0.79 지점
const RACK_DX_RATIO  = 0.20; // 박스를 캐릭터 중심에서 등(왼쪽)으로 옮기는 양 = 스프라이트 폭 × 0.20

// 문 에셋의 바닥 접점 (콘텐츠 bbox 기준 비율) — '왼쪽 하단' 모서리 = 뒷벽/바닥 경계의 기준점.
// (alpha 분석으로 측정: 왼쪽 하단(1056,2845), bbox=977,754,1253,3438 → 0.063, 0.608)
const DOOR_BL_FX = 0.063;   // 문 왼쪽 하단 x (bbox 폭 비율)
const DOOR_BL_FY = 0.608;   // 문 왼쪽 하단 y (bbox 높이 비율, 위에서부터)

// --- 밸런스 수치 ---
const AUTO_DRIFT_PER_SEC = 0.025;
const FORWARD_PER_TAP = 0.015;
const BOX_PENALTY = 0.5;
const BOX_INTERVAL_MS = 2000;
const MAX_BOX_COUNT = 8;

// 둘러보기(아파트뷰) 연출
const LOOK_BTN_BOX_MIN = 4;        // 박스 N개 이상이면 둘러보기 버튼 등장
const LOOK_NEAR_BED = 2 / 5;       // 또는 캐릭터가 화면 왼쪽 1/3(침대 근처) 도달 시
const LOOK_MSG_MS = 3000;          // 아파트뷰 중앙 문구 노출 시간
const LOOK_BOX_RELIEF = 0.2;       // 되돌아온 뒤 남는 박스 비율 (80% 덜어냄)
const APARTMENT_ROOMS = 12;        // 아파트뷰 창문 개수 (3열 × 4행 = 12칸 모두 창문, 0번=플레이어 방)
const LOOK_MESSAGES = [
  '다들 비슷하구나.\n나도 힘내야지. 재도전!',
  '괜찮아. 잠시 쉴수도 있지.\n다시 해보자.',
  '내가 침대로 갔던건 추진력을\n얻기 위함 이었다.',
];

// --- 상태 ---
let phase = 'countdown';
let loseReason = null;
let countdownStart = 0;
let playerX = 0.5;
let boxCount = 0;
let lastBoxDrop = 0;
let boxFlashAt = -9999;
let heldRest = false;
let walkUntil = 0;                  // 이 시각(ms) 전까지 걷기 애니메이션 재생 ('앞으로' 탭이 갱신)
let brightnessOverride = null;      // null이면 밝기=playerX. 아파트뷰 미니 씬이 방별 밝기로 덮어씀.
let endShownAt = 0;
let canvasEl = null;                // p5 캔버스 핸들 (리포트 표시 중 숨김)
let titleSlide = 0;                 // 오프닝 슬라이드 (0=히어로,1=랜딩,2~4=How to Play)

// 둘러보기 상태
let usedLookAround = false;        // 둘러보기 사용 여부 (본편 클리어 엔딩 분기용)
let lookStart = 0;                 // 둘러보기 진입 시각
let lookMsg = '';                  // 이번 둘러보기에서 띄울 문구
let apartmentRooms = [];           // 아파트뷰 각 방 구성

// p5가 setup 전에 호출 — 폰트를 먼저 로드한다.
// ⚠ loadFont는 fetch 기반이라 file://로 열면 차단됨 → http로 서빙 필요
//   (python3 -m http.server 8000). woff2는 미지원이라 TTF로 로드.
function preload() {
  FONTS = {
    kbl:          loadFont('src/폰트/KBLJump/KBLJump_R.ttf'),            // Regular
    kblBold:      loadFont('src/폰트/KBLJump/KBLJump_B.ttf'),            // Bold
    kblExtended:  loadFont('src/폰트/KBLJump/KBLJump_EB_Extended.ttf'),  // ExtraBold 확장 (HOW TO PLAY)
    kblCondensed: loadFont('src/폰트/KBLJump/KBLJump_EB_Condensed.ttf'), // ExtraBold 압축
    kblCourt:     loadFont('src/폰트/KBLJump/KBLCourt_EB.ttf'),          // Court ExtraBold
    // 오프닝 디자인(피그마)용
    macho:        loadFont('src/폰트/EF_MACHO/EF_MACHO(ttf).ttf'),       // 한글 제목·라벨·버튼
    galmuri:      loadFont('src/폰트/Galmuri-v2/Galmuri11.ttf'),         // 본문 설명 (픽셀, ~5MB)
    nexon:        loadFont('src/폰트/NEXON_Lv1_Gothic/NEXON Lv1 Gothic_OTF_TTF/TTF/NEXONLv1GothicRegular.ttf'), // 엔딩 본문 (고딕)
  };
  IMAGES = {
    logo: loadImage('src/화면 UI/로고.png'),   // 히어로 메인 로고 (피자박스 + 워드마크)
    walk: loadImage('src/캐릭터 스프라이트/sprite-sheet-cut.png'),  // 캐릭터 걷기 스프라이트 시트(배경 투명본)
    // 게임 오브젝트 에셋 (디자인 PNG)
    box:  loadImage('src/게임 오브젝트/피자박스(게임에 쌓이는).png'),          // 쌓이는 피자박스 (524x120, 불투명)
    bed:  loadImage('src/게임 오브젝트/침대.png'),                              // 침대 (콘텐츠 bbox 87,112 1218x615)
    door: loadImage('src/게임 오브젝트/문(제일 왼쪽에 닿으면 게임클리어.png'),  // 문 (콘텐츠 bbox 977,754 1253x3438)
    // 아파트뷰 하늘 구름 (픽셀 에셋, 투명 배경)
    clouds: [
      loadImage('src/게임 오브젝트/구름/cloud_1.png'),  // 455x277 (puffy)
      loadImage('src/게임 오브젝트/구름/cloud_2.png'),  // 559x328 (puffy)
      loadImage('src/게임 오브젝트/구름/cloud_3.png'),  // 380x168 (small)
      loadImage('src/게임 오브젝트/구름/cloud_4.png'),  // 633x143 (flat wide)
    ],
  };
}

function setup() {
  recomputeLayout();
  canvasEl = createCanvas(VW, VH);
  canvasEl.style('display', 'block');
  smooth();
  textAlign(CENTER, CENTER);
  setupReport();   // 현황·크레딧 리포트(DOM) 차트 렌더 + 리플레이 버튼 바인딩
  resetGame();
  phase = 'title';   // 첫 진입은 오프닝 로고 (재도전은 곧장 카운트다운)
}

function windowResized() {
  recomputeLayout();
  resizeCanvas(VW, VH);
  // 리포트가 떠 있는 동안의 방향 전환 → 가로 맞춤을 다시 적용 (draw는 noLoop 상태라 여기서)
  const r = document.getElementById('report');
  if (r && r.classList.contains('show')) layoutReport();
}

// 뷰포트 크기로부터 레이아웃 좌표·스케일을 재계산 (가로 모드 기준)
function recomputeLayout() {
  VW = window.innerWidth;
  VH = window.innerHeight;
  // 세로로 들면 캔버스를 90° 회전해 가로로 렌더 → 논리 좌표 W/H는 항상 가로(긴 변=W)
  ROT = VH > VW;
  applyLayout(ROT ? VH : VW, ROT ? VW : VH);
}

// 주어진 논리 가로폭 w·세로높이 h에 맞춰 레이아웃 전역값을 설정.
// 메인 뷰포트(recomputeLayout)와 아파트뷰의 미니 플레이화면(drawMiniPlayScene)이 공유 —
// 미니 창은 w/h만 창 크기로 바꿔 같은 씬 코드를 그대로 축소 렌더한다.
function applyLayout(w, h) {
  W = w;
  H = h;
  // 가로/세로 중 더 빡빡한 쪽에 맞춰 아트가 화면을 넘지 않게
  S = Math.min(W / DESIGN_W, H / DESIGN_H);

  // 우측 컨트롤 패널 없음 — 플레이 씬이 가로 풀로 채운다.
  // (조작 버튼은 우측 하단에 반투명 오버레이로 띄움. PANEL_LEFT=W는 우측 정렬 기준값으로만 사용)
  PANEL_W = 0;
  PANEL_LEFT = W;

  // 방(플레이) 영역 = 화면 전체
  ROOM_TOP = Math.max(40 * S, H * 0.10);
  ROOM_BOTTOM = H - Math.max(34 * S, H * 0.10);

  // 플레이어 가로 범위 (좌=침대 ~ 우=문, 우측 끝 가까이)
  PLAYER_RANGE_LEFT = W * 0.07;
  PLAYER_RANGE_RIGHT = W - W * 0.08;
}

function resetGame() {
  phase = 'countdown';
  loseReason = null;
  countdownStart = millis();
  playerX = 0.5;
  boxCount = 0;
  lastBoxDrop = 0;
  boxFlashAt = -9999;
  heldRest = false;
  walkUntil = 0;
  usedLookAround = false;
  lookStart = 0;
  lookMsg = '';
  apartmentRooms = [];
  titleSlide = 0;
  textFont(FONTS.galmuri);  // 엔딩/아웃트로에서 바꾼 폰트 원복 (게임 텍스트는 갈무리)
}

// 오프닝 → 게임 시작 (카운트다운 진입)
function startGame() {
  phase = 'countdown';
  countdownStart = millis();
  textFont(FONTS.galmuri);  // 오프닝에서 바꾼 폰트 원복 (게임 텍스트는 갈무리)
}

function draw() {
  // 방향 전환 등으로 뷰포트가 바뀌었는데 resize 이벤트를 놓친 경우 대비 (즉시 반영)
  if (window.innerWidth !== VW || window.innerHeight !== VH) {
    recomputeLayout();
    resizeCanvas(VW, VH);
  }
  // 세로로 들고 있으면 캔버스를 90° 돌려 '가로'로 그린다 → 사용자가 자연스럽게 기기를 돌리도록 유도
  push();
  applyOrientation();
  renderFrame();
  pop();
}

// 실제 렌더 — 항상 논리 가로 좌표(W×H) 기준. 세로면 applyOrientation이 회전을 깔아준다.
function renderFrame() {
  if (phase === 'title') { drawTitleScreen(); return; }
  // 엔딩 다음 현황·크레딧은 DOM 리포트가 캔버스를 덮음 → draw는 noLoop로 멈춤(showReport)

  if (phase === 'countdown') stepCountdown();
  else if (phase === 'playing') stepPlaying();
  // 'lookaround'에는 step 함수가 없다 → 자동 드리프트·박스 누적이 멈춘다(연출 중 게임 일시정지)

  if (phase === 'lookaround') {
    drawApartment();
  } else {
    drawScene();
    drawHUD();
  }

  if (phase === 'countdown') drawCountdownOverlay();
  if (phase === 'playing') {
    drawButtons();
    drawLookBtn();
  }
  if (phase === 'lookaround') drawLookaroundOverlay();
  if (phase === 'win' || phase === 'lose') drawEndCard();
}

// 세로 뷰포트일 때만 캔버스를 90° 회전 (논리 가로 좌표 → 물리 세로 캔버스)
function applyOrientation() {
  if (!ROT) return;
  translate(VW, 0);
  rotate(HALF_PI);
}

// 물리 입력 좌표(px,py) → 논리 가로 좌표 (회전 중일 때 역변환)
function toLogical(px, py) {
  if (!ROT) return { x: px, y: py };
  return { x: py, y: VW - px };
}

// ---------- step ----------
function stepCountdown() {
  const elapsed = (millis() - countdownStart) / 1000;
  if (elapsed > 4.2) {
    phase = 'playing';
    lastBoxDrop = millis();
  }
}

function stepPlaying() {
  const dt = deltaTime / 1000;

  if (!heldRest) {
    playerX -= AUTO_DRIFT_PER_SEC * dt;
  }

  if (millis() - lastBoxDrop > BOX_INTERVAL_MS) {
    boxCount += 1;
    boxFlashAt = millis();
    lastBoxDrop = millis();
  }

  if (playerX >= 1) {
    phase = 'win';
    playerX = 1;
    endShownAt = millis();
  } else if (playerX <= 0) {
    phase = 'lose';
    loseReason = 'bed';
    playerX = 0;
    endShownAt = millis();
  } else if (boxCount >= MAX_BOX_COUNT) {
    phase = 'lose';
    loseReason = 'crushed';
    endShownAt = millis();
  }
}

// ---------- scene ----------
function drawScene() {
  // 밝기 b: 기본은 진행도(playerX). 아파트뷰 미니 씬은 brightnessOverride로 방별 밝기를 지정.
  const b = (brightnessOverride != null) ? brightnessOverride : constrain(playerX, 0, 1);
  const floorY = ROOM_BOTTOM - 30 * S;   // 전경 바닥선 (캐릭터·오브젝트가 서는 높이)

  // 문 배치(아래 drawDoor와 동일 좌표) — 문 '왼쪽 하단' 모서리 높이를 뒷벽/바닥 경계로 삼는다.
  const doorCx = PLAYER_RANGE_RIGHT + W * 0.02;
  const doorTopY = ROOM_TOP + 4 * S;
  const doorH = floorY - doorTopY;
  const seamY = doorTopY + DOOR_BL_FY * doorH;   // 뒷벽/바닥 경계 = 문 왼쪽 하단 높이
                                                 // (문은 이 선에 발치 왼쪽이 닿고, 베이스는 전경으로 비스듬히 내려옴)

  drawRoomBackground(seamY, b);  // 문 왼쪽 하단 기준 뒷벽/바닥 분할 + 방 전체 균일 밝기(b)

  // 문(우측 탈출구) → 침대(좌측, 매몰 존). 침대가 캐릭터 앞쪽이라 나중에 그림.
  drawDoor(doorCx, floorY, doorTopY);
  drawBed(6 * S, floorY + 8 * S);   // 침대 다리를 전경 바닥선(캐릭터 발높이)에 맞춤

  const px = lerp(PLAYER_RANGE_LEFT, PLAYER_RANGE_RIGHT, playerX);
  const py = floorY;
  drawPlayerShadow(px, py);   // 발밑 타원 그림자 (캐릭터 아래에 깔아 접지감)
  drawPlayer(px, py);
  drawBoxStack(px, py, boxCount);

  drawVignette();            // 위/아래 가장자리 옅은 프레이밍 (방향성 없는 깊이감)
}

// 참고 PNG 팔레트 (어두운 시작/왼쪽 ↔ 밝은 탈출선/오른쪽) — 가로 밝기 구배의 양 끝 색.
// 대비를 또렷하게: 어두운 끝은 더 깊게(특히 바닥), 밝은 끝은 더 환하게 해 명암 폭을 크게.
const PAL_DARK_WALL  = [24, 24, 44],    PAL_BRIGHT_WALL  = [216, 216, 230];
const PAL_DARK_FLOOR = [74, 74, 100],   PAL_BRIGHT_FLOOR = [230, 230, 242];

// ▷ 방 밝기 매핑 (여기 4개 값만 고치면 됨) — b(위치 0=침대~1=문, 아파트뷰는 방별 밝기)를 밝기 f(0~1)로 변환.
//   map(b, DARK_AT, BRIGHT_AT, MIN, MAX): DARK_AT 지점부터 BRIGHT_AT 지점까지 어두움→밝음, 그 바깥은 끝값으로 고정.
const ROOM_DARK_AT    = 0.2;    // 이 지점(이하)에서 가장 어두움 (예: 0.3 → 0.3 전까지는 계속 가장 어두움)
const ROOM_BRIGHT_AT  = 0.8;    // 이 지점(이상)에서 가장 밝음   (예: 0.8 → 0.8 부터는 계속 가장 밝음)
const ROOM_MIN_BRIGHT = 0.0;    // 가장 어두울 때 밝기 (0=완전 어두운 팔레트)
const ROOM_MAX_BRIGHT = 1.0;   // 가장 밝을 때 밝기   (1=완전 밝은 팔레트)

// 두 [r,g,b]를 f(0~1)로 보간해 'rgb(...)' 문자열로 (canvas 그라데이션 스톱용)
function mixRGB(a, c, f) {
  return 'rgb(' + Math.round(lerp(a[0], c[0], f)) + ',' +
                  Math.round(lerp(a[1], c[1], f)) + ',' +
                  Math.round(lerp(a[2], c[2], f)) + ')';
}

// 메인 플레이 배경 — 참고 PNG(src/게임 오브젝트/어두운배경(시작시)·밝은 배경(탈출선도달시)) 기반.
// 뒷벽/바닥을 '문 왼쪽 하단'(seamY) 기준으로 수평 분할. 입체감은 문 에셋 자체의 원근
// (베이스가 전경으로 비스듬히 내려옴) + 바닥 그라데이션이 맡는다.
//
// ▷ 방의 밝기는 가로(좌→우)로 변한다: 왼쪽(침대)=어둡게 ~ 오른쪽(문/탈출선)=밝게.
//   + 진행도 b(=playerX, 또는 아파트뷰의 방별 brightnessOverride)가 방 '전체' 밝기를 크게 좌우한다:
//   b가 작으면(침대 근처/어두운 방) 문 쪽까지 어둑하고, b가 크면(문 근처/밝은 방) 방 전체가 환해짐.
//   → 위치에 따른 명암 변화가 또렷이 느껴지고, 아파트 방마다 밝기 차이가 분명해진다.
function drawRoomBackground(seamY, b) {
  // 방 '전체'를 하나의 밝기 f로 균일하게 칠한다(가로 구배 없음).
  // f는 b로 결정 → 위치/방에 따라 방 전체가 어두워졌다 환해진다. (튜닝값은 위 ROOM_* 상수)
  const f = constrain(map(b, ROOM_DARK_AT, ROOM_BRIGHT_AT, ROOM_MIN_BRIGHT, ROOM_MAX_BRIGHT), 0, 1);

  noStroke();
  drawingContext.fillStyle = mixRGB(PAL_DARK_WALL, PAL_BRIGHT_WALL, f);   // 뒷벽
  drawingContext.fillRect(0, 0, W, seamY);
  drawingContext.fillStyle = mixRGB(PAL_DARK_FLOOR, PAL_BRIGHT_FLOOR, f); // 바닥
  drawingContext.fillRect(0, seamY, W, H - seamY);

  // 뒷벽-바닥 경계(걸레받이) — 문 왼쪽 하단을 가로지르는 옅은 음영선
  fill(0, 0, 0, 45);
  rect(0, seamY - 2 * S, W, 3 * S);

  // 바닥 원근 그라데이션(세로, 밝기 아닌 깊이감) — 경계(안쪽) 살짝 어둡게, 앞쪽 살짝 밝게
  const fg = drawingContext.createLinearGradient(0, seamY, 0, H);
  fg.addColorStop(0, 'rgba(0,0,0,0.10)');
  fg.addColorStop(1, 'rgba(255,255,255,0.04)');
  drawingContext.fillStyle = fg;
  drawingContext.fillRect(0, seamY, W, H - seamY);
}

// 위/아래 가장자리 옅은 프레이밍 (균일한 방 밝기 위에 살짝 깊이만 — 좌우 방향성 없음)
function drawVignette() {
  const eg = drawingContext.createLinearGradient(0, 0, 0, H);
  eg.addColorStop(0,    'rgba(0,0,0,0.18)');
  eg.addColorStop(0.13, 'rgba(0,0,0,0)');
  eg.addColorStop(0.86, 'rgba(0,0,0,0)');
  eg.addColorStop(1,    'rgba(0,0,0,0.20)');
  drawingContext.fillStyle = eg;
  drawingContext.fillRect(0, 0, W, H);
}

// 침대(좌측 매몰 존). 디자인 PNG의 콘텐츠 bbox만 잘라 좌하단 기준으로 배치.
// 침대 다리는 캐릭터와 같은 전경 바닥선(floorY) 위에 서고, 발치 접지 그림자로 큰 바닥에 떠 보이지 않게.
function drawBed(leftX, bottomY) {
  const img = IMAGES.bed;
  const w = 160 * S;
  const h = w * (615 / 1218);          // 에셋 종횡비 유지
  // 발치 접지 그림자 (캐릭터 그림자와 같은 결 — 바닥에 안착)
  noStroke();
  fill(0, 70);
  ellipse(leftX + w * 0.46, bottomY - 6 * S, w * 0.84, h * 0.20);
  if (img) {
    noTint();
    image(img, leftX, bottomY - h, w, h, 87, 112, 1218, 615);
  } else {
    noStroke(); fill(70, 50, 60); rect(leftX, bottomY - h, w, h);
  }
}

// 문(우측 탈출구). 세로로 긴 PNG의 콘텐츠 bbox만 잘라 바닥에 세움.
function drawDoor(centerX, floorY, topY) {
  const img = IMAGES.door;
  const h = floorY - topY;
  const w = h * (1253 / 3438);         // 에셋 종횡비 유지
  if (img) {
    noTint();
    image(img, centerX - w / 2, floorY - h, w, h, 977, 754, 1253, 3438);
  } else {
    noStroke(); fill(140, 240, 200); rect(centerX - w / 2, topY, w, h);
  }
}

// 발밑 접지 그림자 (타원). 걷는 중엔 발 구름에 맞춰 폭이 살짝 출렁인다.
function drawPlayerShadow(x, footY) {
  const baseW = PLAYER_H_U * S * (SPR_FW / SPR_FH) * 0.82;
  const walking = phase === 'playing' && !heldRest && millis() < walkUntil;
  const pulse = walking ? 1 + 0.08 * Math.sin(millis() / WALK_FRAME_MS) : 1;
  noStroke();
  fill(0, 80);
  ellipse(x, footY - 1 * S, baseW * pulse, baseW * 0.26);
}

// 캐릭터 = 스프라이트 시트의 한 프레임. 한 장(IMAGES.walk)에서 현재 프레임 칸만
// 잘라(source rect) 그린다 → 프레임마다 이미지를 따로 로드하지 않아 리소스 절약.
function drawPlayer(x, y) {
  const sheet = IMAGES.walk;
  if (!sheet) return;                  // 아직 로드 전이면 건너뜀
  const h = PLAYER_H_U * S;
  const w = h * (SPR_FW / SPR_FH);
  const top = y - h * SPR_FEET;        // 발바닥이 바닥선(y)에 닿도록 칸 아래 여백 보정
  const sx = playerFrame() * SPR_FW;   // 시트에서 잘라낼 프레임의 가로 오프셋
  noTint();
  image(sheet, x - w / 2, top, w, h, sx, 0, SPR_FW, SPR_FH);
}

// 현재 보여줄 프레임: 0=서있기(멈춤·쉬는 중), 1~5=걷기(앞으로 탭 직후 순환)
function playerFrame() {
  if (phase !== 'playing' || heldRest) return 0;       // 카운트다운·엔딩·쉬기 = 서있기
  if (millis() < walkUntil) {
    return 1 + Math.floor(millis() / WALK_FRAME_MS) % (SPR_COLS - 1);  // 1..5 순환
  }
  return 0;
}

// 지게(등에 멘 나무 받침) 윗면·머리 뒤쪽에 쌓이는 피자박스 더미. 박스 1장 = 디자인 PNG(IMAGES.box).
function drawBoxStack(x, baseY, count) {
  if (count === 0) return;
  const img = IMAGES.box;
  const flash = millis() - boxFlashAt < 400;
  const topIdx = count - 1;
  // 스프라이트 그려지는 크기(= drawPlayer와 동일) 기준으로 지게 윗면 위치 산출
  const h = PLAYER_H_U * S;
  const w = h * (SPR_FW / SPR_FH);
  const rackTopY = baseY - RACK_TOP_RATIO * h;   // 지게 윗면(박스가 얹히는 높이)
  const rackCx = x - RACK_DX_RATIO * w;          // 캐릭터 중심에서 등(왼쪽)으로
  const bw = 35 * S;
  const bh = bw * (120 / 524);          // 에셋 종횡비 유지 (가로로 납작)
  const step = bh * 0.82;               // 살짝 겹쳐 쌓기
  for (let i = 0; i < count; i++) {
    const bx = rackCx - bw / 2;
    const by = rackTopY + 2 * S - bh - i * step;  // 맨 아래 박스가 지게에 얹히게 (+2 살짝 겹침)
    noTint();
    if (img) image(img, bx, by, bw, bh);
    else { noStroke(); fill(200, 140, 80); rect(bx, by, bw, bh); }
    // 새 박스가 떨어진 직후 맨 위 박스를 반짝
    if (i === topIdx && flash && Math.floor(millis() / 80) % 2 === 0) {
      noStroke(); fill(255, 240, 150, 150);
      rect(bx, by, bw, bh);
    }
  }
}

// ---------- countdown overlay ----------
function drawCountdownOverlay() {
  fill(0, 170);
  rect(0, 0, W, H);
  const elapsed = (millis() - countdownStart) / 1000;
  let label = '';
  let big = true;
  if (elapsed < 1)      label = '3';
  else if (elapsed < 2) label = '2';
  else if (elapsed < 3) label = '1';
  else { label = '방을 탈출하세요'; big = false; }

  fill(255);
  textSize((big ? 90 : 26) * S);
  text(label, W / 2, H / 2);
}

// ---------- 오프닝 (히어로 + 피그마 opening 4슬라이드 = 총 5) ----------
// 디자인 기준 프레임 2614x1206(네이비). 색/폰트는 피그마 스펙을 따른다.
const OPEN_BG = [4, 33, 108];      // #04216c
const OPEN_DW = 2614, OPEN_DH = 1206;
const TITLE_SLIDES = 5;            // 0=히어로,1=랜딩,2=HTP,3=HTP+표,4=+시작버튼

// 캔버스 안에 디자인 프레임을 비율 유지로 맞춰 넣은 박스(스케일+오프셋)
function openingBox() {
  const sc = Math.min(W / OPEN_DW, H / OPEN_DH);
  const bw = OPEN_DW * sc, bh = OPEN_DH * sc;
  return { sc, bw, bh, ox: (W - bw) / 2, oy: (H - bh) / 2 };
}

function drawTitleScreen() {
  background(OPEN_BG[0], OPEN_BG[1], OPEN_BG[2]);
  if (titleSlide === 0) drawSlideHero();
  else if (titleSlide === 1) drawSlideLanding();
  else if (titleSlide === 2) drawSlideHowToTitle();  // 중앙 큰 HOW TO PLAY
  else drawSlideHowTo(titleSlide - 1);               // 3→표, 4→표+시작버튼
  drawSlideHint();
}

// 슬라이드 0 — 히어로샷 (네이비 배경 + 로고.png 락업)
function drawSlideHero() {
  const b = openingBox();
  const img = IMAGES.logo;
  if (!img) return;
  const ar = img.width / img.height;
  let h = b.bh * 0.80;
  let w = h * ar;
  const maxW = b.bw * 0.6;
  if (w > maxW) { w = maxW; h = w / ar; }
  imageMode(CENTER);
  image(img, W / 2, b.oy + b.bh * 0.47, w, h);
  imageMode(CORNER);
}

// 글자 단위로 자간(tracking)을 줘서 그린다 (canvas letterSpacing 미지원 대비)
function textTracked(str, x, y, spacing, align) {
  const chars = [...str];
  let total = 0;
  for (const ch of chars) total += textWidth(ch) + spacing;
  total -= spacing;
  push();
  textAlign(LEFT, CENTER);
  let cx = (align === CENTER) ? x - total / 2 : x;
  for (const ch of chars) {
    text(ch, cx, y);
    cx += textWidth(ch) + spacing;
  }
  pop();
}

// 슬라이드 1 — 중앙 "HOW TO PLAY"
function drawSlideHowToTitle() {
  const b = openingBox();
  noStroke();
  fill(255);
  textFont(FONTS.kblExtended);
  const fs = 0.085 * b.bh;
  textSize(fs);
  textTracked('HOW TO PLAY', W / 2, b.oy + b.bh * 0.5, fs * 0.16, CENTER);
}

// 슬라이드 0 — "고립은둔에서 / 벗어나고 싶은 당신. / 방에서 탈출하세요!"
function drawSlideLanding() {
  const b = openingBox();
  noStroke();
  fill(255);
  textFont(FONTS.macho);
  textAlign(CENTER, CENTER);
  textSize(0.08 * b.bh);
  const cx = W / 2;
  const cy = b.oy + b.bh * 0.5;
  const lh = 0.08 * b.bh * 1.18;
  text('고립은둔에서', cx, cy - lh);
  text('벗어나고 싶은 당신.', cx, cy);
  text('방에서 탈출하세요!', cx, cy + lh);
}

// 슬라이드 1~3 — HOW TO PLAY (+조작표 +시작버튼)
function drawSlideHowTo(stage) {
  const b = openingBox();
  const X = f => b.ox + f * b.bw;
  const Y = f => b.oy + f * b.bh;
  noStroke();

  // HOW TO PLAY (좌상단, KBL Jump EB Extended, 넓은 자간)
  fill(255);
  textFont(FONTS.kblExtended);
  const htpFs = 0.055 * b.bh;
  textSize(htpFs);
  textTracked('HOW TO PLAY', X(0.085), Y(0.16), htpFs * 0.16, LEFT);

  if (stage >= 2) {
    // 둥근 테두리 박스
    push();
    noFill();
    stroke(255);
    strokeWeight(Math.max(2, 6 * b.sc));
    rect(X(0.068), Y(0.25), 0.864 * b.bw, 0.583 * b.bh, 30 * b.sc);
    pop();

    // 조작표 (라벨 = EF_MACHO, 설명 = Galmuri11)
    const rows = [
      ['앞으로',    '오른쪽(문)으로 전진합니다.'],
      ['잠시 쉬기',  '제자리에 멈추지만, 지게 위에 박스가 추가됩니다.'],
      ['방치 시',   '자동으로 왼쪽(침대)으로 끌려갑니다.'],
      ['페널티',    '3초마다 박스가 누적되어 전진 속도가 느려집니다.'],
    ];
    for (let r = 0; r < rows.length; r++) {
      const yy = Y(0.25 + 0.583 * (r + 0.5) / rows.length);
      noStroke();
      fill(255);
      textAlign(LEFT, CENTER);
      textFont(FONTS.macho);
      textSize(0.066 * b.bh);
      text(rows[r][0], X(0.15), yy);
      textFont(FONTS.galmuri);
      textSize(0.05 * b.bh);
      text(rows[r][1], X(0.31), yy);
    }
  }

  if (stage >= 3) {
    // ▶ 게임 시작하기 (우하단)
    noStroke();
    fill(255);
    textFont(FONTS.macho);
    textAlign(RIGHT, CENTER);
    const fs = 0.055 * b.bh;
    textSize(fs);
    const by = Y(0.92);
    const bx = X(0.932);
    text('게임 시작하기', bx, by);
    const tw = textWidth('게임 시작하기');
    const tr = fs * 0.42;                 // 삼각형 크기
    const tx = bx - tw - tr * 2.2;
    triangle(tx, by - tr, tx, by + tr, tx + tr * 1.2, by);
  }
}

// 슬라이드 진행 힌트 (마지막 슬라이드는 버튼이 CTA라 생략)
function drawSlideHint() {
  const b = openingBox();
  noStroke();
  // 페이지 점
  const n = TITLE_SLIDES, gap = 26 * b.sc, r = 5 * b.sc;
  const startX = W / 2 - (n - 1) * gap / 2;
  const yy = b.oy + b.bh - 34 * b.sc;
  for (let d = 0; d < n; d++) {
    fill(255, d === titleSlide ? 235 : 70);
    circle(startX + d * gap, yy, r * 2);
  }
  if (titleSlide < TITLE_SLIDES - 1) {
    const a = 120 + sin(millis() / 400) * 90;
    fill(255, a);
    textFont(FONTS.galmuri);
    textAlign(CENTER, CENTER);
    textSize(0.026 * b.bh);
    text('탭하여 계속  ▶', W / 2, yy - 30 * b.sc);
  }
}

// ---------- HUD ----------
function drawHUD() {
  // 지게 무게 — 우측 상단. 방 밝기가 어둡든 밝든 읽히도록 '밝은 글자 + 어두운 외곽선(halo)'.
  push();
  textAlign(RIGHT, TOP);
  textSize(14 * S);
  strokeJoin(ROUND);
  strokeWeight(3.5 * S);
  stroke(8, 10, 20, 210);     // 어두운 halo (밝은 배경에서 대비)
  fill(247, 249, 255);        // 밝은 글자 (어두운 배경에서 대비)
  text('지게 무게 : ' + boxCount, W - 16 * S, 14 * S);
  pop();
}

// ---------- buttons (우측 하단 반투명 오버레이) ----------
// 참고: src/화면 UI/플레이화면 메인 UI+ 둘러보기 버튼.png
//  앞으로 가기 = 큰 피치 타원(우측 끝) / 잠시 쉬기 = 작은 녹색 타원(그 왼쪽) / ▶둘러보기 = 잠시쉬기 위 텍스트
function forwardBtn() {
  return { cx: W * 0.85, cy: H * 0.79, rx: W * 0.130, ry: H * 0.115 };
}
function restBtn() {
  return { cx: W * 0.635, cy: H * 0.83, rx: W * 0.085, ry: H * 0.088 };
}
function inRect(mx, my, r) {
  return mx >= r.x && mx <= r.x + r.w && my >= r.y && my <= r.y + r.h;
}
// 타원 히트 테스트 (반투명 타원 버튼용)
function inEllipse(mx, my, e) {
  const dx = (mx - e.cx) / e.rx, dy = (my - e.cy) / e.ry;
  return dx * dx + dy * dy <= 1;
}

function drawButtons() {
  const fwd = forwardBtn();
  const rest = restBtn();
  textAlign(CENTER, CENTER);
  noStroke();

  // [잠시 쉬기] — 녹색 반투명 타원 (누르면 진해짐)
  fill(150, 196, 150, heldRest ? 215 : 150);
  ellipse(rest.cx, rest.cy, rest.rx * 2, rest.ry * 2);
  fill(36, 60, 42, 235);
  textSize(15 * S);
  text('잠시 쉬기', rest.cx, rest.cy);

  // [앞으로 가기] — 피치 반투명 타원, 가장 크게 (탭 직후 살짝 진해짐)
  const fwdHot = millis() < walkUntil;
  fill(216, 172, 142, fwdHot ? 220 : 168);
  ellipse(fwd.cx, fwd.cy, fwd.rx * 2, fwd.ry * 2);
  fill(72, 46, 32, 240);
  textSize(20 * S);
  text('앞으로 가기', fwd.cx, fwd.cy);
}

// ---------- end card (엔딩 3갈래) ----------
// 피그마 ending 프레임(6:646) 기준. 멈춘 플레이 씬 위에 톤별 워시 + 좌측정렬 메시지.
//  - 혼자탈출 (win, 둘러보기 미사용) → 밝은 톤
//  - 진엔딩   (win, 둘러보기 사용)   → 파란 톤 (연대)
//  - 게임오버 (lose)                → 어두운 톤 (loseReason으로 멘트만 분기)
function endingContent() {
  if (phase === 'win' && !usedLookAround) {
    return {
      tone: 'light',
      title: ['축하합니다. 당신은 혼자만의 힘으로', '이 좁은 방을 탈출했습니다.'],
      body: [
        '그런데 왜 아직도 어깨는 무겁고 숨이 차오를까요?',
        '세상이 던지는 상자들을 오롯이 혼자 받아내며 걷는 길은 너무나 외롭고 고단합니다.',
        '인생은 혼자만의 레이스가 아닙니다.',
        '가끔은 주변을 둘러보세요. 당신과 똑같은 무게를 지고',
        '당신 곁을 나란히 걷고 있는 수많은 청년들이 보일 것입니다.',
      ],
    };
  }
  if (phase === 'win') {  // usedLookAround === true → 진엔딩 (둘러보기 후 클리어)
    return {
      tone: 'blue',
      title: ['힘들 때는 힘들다고 말하십시오.'],
      body: [
        '당신은 혼자가 아닙니다. 다들 나만 빼고 완벽하게 잘 사는 것 같아 보여도,',
        '알고 보면 모두 당신처럼 넘어지고 끙끙대며 살아갑니다.',
        '그 무게가 두렵다고 좁은 방의 문을 걸어 잠그지 마십시오.',
        '힘들 때는 힘들다고 말하십시오.',
        '고개를 돌려보면, 저마다의 지게를 진 채 묵묵히 걸어가는 우리가 함께 있을 테니까요.',
      ],
    };
  }
  if (loseReason === 'crushed') {  // 박스 과적 매몰
    return {
      tone: 'dark',
      title: ['쌓이고 쌓인 상자에', '결국 짓눌려 버렸군요.'],
      body: [
        '괜찮습니다. 모든 짐을 혼자 짊어지려 하지 않아도 됩니다.',
        '너무 많은 것을 한꺼번에 견디려 하면 누구든 무너지기 마련입니다.',
        '잠시 숨을 고르고, 짐을 나누어 가질 사람들을 떠올려 보세요.',
        '방 밖의 세상은 여전히 당신이 문을 열어주기를 기다리고 있습니다.',
      ],
    };
  }
  return {  // loseReason === 'bed' — 침대 매몰
    tone: 'dark',
    title: ['지게가 너무 무거워 결국', '익숙한 침대에 주저앉아 버렸군요.'],
    body: [
      '괜찮습니다. 지치면 잠시 누워 숨을 고를 수도 있지요.',
      '하지만 기억하세요. 그 좁은 침대 위에서는',
      '등에 진 무거운 상자들을 절대 내려놓을 수 없습니다.',
      '조금만 쉬어간 후에, 다시 허리를 펴고 문을 바라보아도 늦지 않습니다.',
      '방 밖의 세상은 여전히 당신이 문을 열어주기를 기다리고 있습니다.',
    ],
  };
}

function drawEndCard() {
  const e = endingContent();
  let wash, titleCol, bodyCol;
  if (e.tone === 'light') {
    wash = color(240, 243, 248, 226); titleCol = color(4, 33, 108); bodyCol = color(78, 82, 96);
  } else if (e.tone === 'blue') {
    wash = color(29, 63, 143, 232); titleCol = color(10, 26, 74); bodyCol = color(232, 238, 250);
  } else {
    wash = color(14, 16, 30, 226); titleCol = color(255); bodyCol = color(202, 208, 224);
  }

  // 멈춘 씬 위에 톤 워시 (씬이 살짝 비쳐 보이도록)
  noStroke();
  fill(wash);
  rect(0, 0, W, H);

  const x0 = W * 0.10;          // 좌측 여백
  const maxW = W * 0.80;        // 텍스트 폭 한계 (좁은 가로비에서 자동 축소)

  // 제목 (EF_MACHO) — 가장 긴 줄이 maxW를 넘으면 줄여서 맞춤
  textFont(FONTS.macho);
  textAlign(LEFT, TOP);
  let tSize = H * 0.072;
  textSize(tSize);
  let tWide = 0;
  for (const ln of e.title) tWide = Math.max(tWide, textWidth(ln));
  if (tWide > maxW) { tSize *= maxW / tWide; textSize(tSize); }
  const tLead = tSize * 1.3;

  const titleTop = H * 0.23;
  fill(titleCol);
  for (let i = 0; i < e.title.length; i++) text(e.title[i], x0, titleTop + i * tLead);

  // 본문 (NEXON Lv1 Gothic)
  const bodyTop = titleTop + e.title.length * tLead + H * 0.05;
  textFont(FONTS.nexon);
  let bSize = H * 0.040;
  textSize(bSize);
  let bWide = 0;
  for (const ln of e.body) bWide = Math.max(bWide, textWidth(ln));
  if (bWide > maxW) { bSize *= maxW / bWide; textSize(bSize); }
  const bLead = bSize * 1.55;
  fill(bodyCol);
  for (let i = 0; i < e.body.length; i++) text(e.body[i], x0, bodyTop + i * bLead);

  // 탭 안내 (우하단, 제목색으로 깜빡)
  if (millis() - endShownAt > 900) {
    textFont(FONTS.macho);
    textAlign(RIGHT, BOTTOM);
    textSize(H * 0.034);
    const a = 150 + sin(millis() / 350) * 80;
    fill(red(titleCol), green(titleCol), blue(titleCol), a);
    text('탭하여 계속  ▶', W - W * 0.08, H - H * 0.08);
  }

  textAlign(CENTER, CENTER);  // 다른 페이즈 기본값 복원
}

// ---------- 현황·크레딧 리포트 (DOM 오버레이, part 3) ----------
// 피자 은유 → 한국 은둔고립 현황 통계/그래프 → 프로젝트 설명 → 인용 → 크레딧 → 리플레이.
// 캔버스가 아닌 index.html의 #report 오버레이로 렌더(긴 본문·링크·로고·스크롤은 DOM이 적합).

// 리포트 슬라이드 덱 상태
let reportIndex = 0;     // 현재 보고 있는 슬라이드
let reportSlides = 0;    // 전체 슬라이드 수 (setupReport에서 DOM 기준 계산)

// 그래프 데이터 — '다른 사람들로부터 고립되어 있다고 느낀 기간' (한국청소년정책연구원/KOSIS)
// ⚠ 아래는 예시(placeholder) 수치. 실제 KOSIS 값으로 교체할 것.
const LONELINESS_DATA = [
  { label: '거의 없음', value: 41 },
  { label: '한 달 미만', value: 23 },
  { label: '1~6개월',  value: 17 },
  { label: '6개월~1년', value: 11 },
  { label: '1년 이상',  value: 8 },
];

// setup()에서 1회: 그래프 막대 렌더 + 슬라이드 네비게이션/리플레이 버튼 바인딩
function setupReport() {
  // 그래프 막대 (높이는 CSS가 --ru·--barfrac으로 계산 → 회전/리사이즈에 자동 대응)
  const host = document.getElementById('report-chart');
  if (host) {
    const maxV = Math.max(...LONELINESS_DATA.map(d => d.value));
    host.innerHTML = '';
    for (const d of LONELINESS_DATA) {
      const col = document.createElement('div'); col.className = 'bar-col';
      const val = document.createElement('div'); val.className = 'bar-val'; val.textContent = d.value + '%';
      const bar = document.createElement('div'); bar.className = 'bar';
      bar.style.setProperty('--barfrac', d.value / maxV);
      const lab = document.createElement('div'); lab.className = 'bar-label'; lab.textContent = d.label;
      col.appendChild(val); col.appendChild(bar); col.appendChild(lab);
      host.appendChild(col);
    }
  }

  // 슬라이드 수 + 진행 점 생성
  reportSlides = document.querySelectorAll('#report .report-slide').length;
  const dots = document.getElementById('report-dots');
  if (dots) {
    dots.innerHTML = '';
    for (let i = 0; i < reportSlides; i++) {
      const dot = document.createElement('button');
      dot.className = 'dot'; dot.type = 'button';
      dot.setAttribute('aria-label', (i + 1) + '번째 슬라이드로');
      dot.addEventListener('click', () => goReportSlide(i));
      dots.appendChild(dot);
    }
  }

  // 화살표
  const prev = document.getElementById('report-prev');
  const next = document.getElementById('report-next');
  if (prev) prev.addEventListener('click', () => goReportSlide(reportIndex - 1));
  if (next) next.addEventListener('click', () => goReportSlide(reportIndex + 1));

  // 슬라이드 빈 영역 탭 → 다음으로 (오프닝과 동일한 감각, 링크·버튼은 각자 동작)
  const track = document.getElementById('report-track');
  if (track) {
    track.addEventListener('click', (e) => {
      if (e.target.closest('a, button')) return;
      if (reportIndex < reportSlides - 1) goReportSlide(reportIndex + 1);
    });
  }

  // 리플레이 버튼 (탭 전파 막아 슬라이드 넘김과 충돌 방지)
  const btn = document.getElementById('report-replay');
  if (btn) btn.addEventListener('click', (e) => { e.stopPropagation(); replayFromReport(); });
}

// 슬라이드 이동 (translateX) + 점/화살표 상태 갱신
function goReportSlide(i) {
  reportIndex = Math.max(0, Math.min(i, reportSlides - 1));
  const track = document.getElementById('report-track');
  if (track) track.style.transform = 'translateX(' + (-reportIndex * 100) + '%)';
  document.querySelectorAll('#report-dots .dot')
    .forEach((d, k) => d.classList.toggle('active', k === reportIndex));
  const prev = document.getElementById('report-prev');
  const next = document.getElementById('report-next');
  if (prev) prev.disabled = (reportIndex === 0);
  if (next) next.disabled = (reportIndex === reportSlides - 1);
}

// 리포트를 가로(슬라이드)로 맞춘다. 세로 기기는 게임 캔버스처럼 90° 회전해 가로로 표시.
// vh/vw는 회전 시 실제 뷰포트 기준이라 어긋나므로 슬라이드 자체 크기를 --rw/--rh/--ru로 내려준다.
function layoutReport() {
  const r = document.getElementById('report');
  if (!r) return;
  const rw = ROT ? VH : VW;   // 슬라이드가 차지하는 '논리 가로'
  const rh = ROT ? VW : VH;   // '논리 세로'
  r.style.setProperty('--rw', rw + 'px');
  r.style.setProperty('--rh', rh + 'px');
  r.style.setProperty('--ru', Math.min(rw, rh) + 'px');
  if (ROT) {
    // 캔버스 회전과 동일 방향(시계 90°): 논리 가로 → 세로 뷰포트
    r.style.width = rw + 'px';
    r.style.height = rh + 'px';
    r.style.top = '0px'; r.style.left = '0px';
    r.style.right = 'auto'; r.style.bottom = 'auto';
    r.style.transformOrigin = 'left top';
    r.style.transform = 'translate(' + VW + 'px, 0) rotate(90deg)';
  } else {
    // 가로 기기: inset:0 으로 화면 가득 (인라인 스타일 해제)
    r.style.width = ''; r.style.height = '';
    r.style.top = ''; r.style.left = '';
    r.style.right = ''; r.style.bottom = '';
    r.style.transformOrigin = ''; r.style.transform = '';
  }
}

// 엔딩 메시지 탭 → 리포트 오버레이 표시 (캔버스 숨기고 draw 정지, 첫 슬라이드부터)
function showReport() {
  const r = document.getElementById('report');
  if (!r) { resetGame(); return; }   // 안전장치: 오버레이가 없으면 바로 재시작
  layoutReport();
  goReportSlide(0);
  r.classList.add('show');
  r.setAttribute('aria-hidden', 'false');
  if (canvasEl) canvasEl.hide();
  noLoop();
}

// 리포트의 [게임 리플레이하기] → 오버레이 숨기고 게임 재시작(카운트다운부터)
function replayFromReport() {
  const r = document.getElementById('report');
  if (r) { r.classList.remove('show'); r.setAttribute('aria-hidden', 'true'); }
  if (canvasEl) canvasEl.show();
  resetGame();
  loop();
}

// ---------- input ----------
function handlePress(mx, my) {
  if (phase === 'title') {
    if (titleSlide < TITLE_SLIDES - 1) titleSlide++;  // 다음 슬라이드로
    else startGame();                                 // 마지막 슬라이드 → 게임 시작
    return;
  }
  if (phase === 'countdown') return;
  if (phase === 'win' || phase === 'lose') {
    if (millis() - endShownAt > 900) showReport();   // 엔딩 메시지 → 현황·크레딧 리포트
    return;
  }
  if (phase === 'lookaround') {
    // 문구 노출(3초)이 끝난 뒤에만 되돌아가기 가능
    if (millis() - lookStart > LOOK_MSG_MS && inRect(mx, my, backBtn())) {
      returnFromLookaround();
    }
    return;
  }
  // playing (우측 하단 반투명 타원 버튼들)
  if (lookBtnVisible() && inEllipse(mx, my, lookBtn())) {
    enterLookaround();
  } else if (inEllipse(mx, my, forwardBtn())) {
    playerX += FORWARD_PER_TAP / (1 + boxCount * BOX_PENALTY);
    walkUntil = millis() + WALK_BURST_MS;   // 앞으로 한 발 → 걷기 애니메이션 트리거
  } else if (inEllipse(mx, my, restBtn())) {
    heldRest = true;
  }
}

function handleRelease() {
  heldRest = false;
}

// 리포트(DOM 오버레이)가 떠 있으면 p5 입력 핸들러는 손대지 않는다.
// p5 터치 리스너는 window에 붙어 캔버스를 숨겨도 발동하는데, return false 시
// preventDefault가 걸려 '탭→click 합성'이 취소돼 슬라이드 탭이 먹통이 된다 → 기본 동작 허용.
function reportIsOpen() {
  const r = document.getElementById('report');
  return !!(r && r.classList.contains('show'));
}

function mousePressed() {
  if (reportIsOpen()) return;            // 리포트 슬라이드/버튼 클릭은 DOM이 처리
  const p = toLogical(mouseX, mouseY);   // 회전 중이면 물리→논리 좌표 변환
  handlePress(p.x, p.y);
  return false;
}
function mouseReleased() { if (reportIsOpen()) return; handleRelease(); return false; }
function touchStarted() {
  if (reportIsOpen()) return;            // 탭→click 합성을 막지 않도록 preventDefault 회피
  let px = mouseX, py = mouseY;
  if (touches.length > 0) { px = touches[0].x; py = touches[0].y; }
  const p = toLogical(px, py);
  handlePress(p.x, p.y);
  return false;
}
function touchEnded() { if (reportIsOpen()) return; handleRelease(); return false; }

// ---------- 둘러보기 (아파트뷰 연출) ----------
function lookBtnVisible() {
  return boxCount >= LOOK_BTN_BOX_MIN || playerX <= LOOK_NEAR_BED;
}

function lookBtn() {
  // ▶ 둘러보기 — 잠시 쉬기 버튼 위 텍스트 버튼 (타원 히트영역)
  return { cx: W * 0.635, cy: H * 0.665, rx: W * 0.085, ry: H * 0.055 };
}

function backBtn() {
  // 아파트 위에 떠 있는 우하단 플로팅 버튼
  const w = W * 0.24, h = H * 0.10;
  return { x: W - W * 0.03 - w, y: H - H * 0.035 - h, w, h };
}

function drawLookBtn() {
  if (!lookBtnVisible()) return;
  const r = lookBtn();
  const a = 165 + sin(millis() / 350) * 60;   // 은은히 깜빡
  noStroke();
  textAlign(CENTER, CENTER);
  textSize(14 * S);
  fill(238, 240, 244, a);
  text('▶ 둘러보기', r.cx, r.cy);
}

function enterLookaround() {
  phase = 'lookaround';
  lookStart = millis();
  usedLookAround = true;   // 본편: 클리어 시 '둘러보기 후 클리어' 엔딩 분기에 사용
  heldRest = false;
  lookMsg = random(LOOK_MESSAGES);
  buildApartment();
}

function returnFromLookaround() {
  boxCount = Math.round(boxCount * LOOK_BOX_RELIEF);  // 박스 80% 덜어냄
  lastBoxDrop = millis();                             // 박스 타이머 리셋 (즉시 드랍 방지)
  phase = 'playing';
}

// 아파트뷰 방 구성 (0번 = 플레이어 본인 방, 나머지는 이웃).
// 방마다 위치(prog)·밝기(bright)·피자박스 수(boxes)를 랜덤화 → "다들 각자의 방에서 버틴다".
function buildApartment() {
  apartmentRooms = [];
  // 0번 = 나 (현재 실제 상태 반영)
  apartmentRooms.push({
    isPlayer: true,
    prog: constrain(playerX, 0.06, 0.94),
    boxes: boxCount,
    bright: constrain(playerX, 0, 1),
  });
  // 나머지 = 이웃 (위치/밝기/박스 랜덤)
  for (let i = 1; i < APARTMENT_ROOMS; i++) {
    apartmentRooms.push({
      isPlayer: false,
      prog: random(0.06, 0.95),
      boxes: Math.floor(random(0, MAX_BOX_COUNT + 1)),
      bright: random(0, 1),
    });
  }
}

// 참고: src/화면 UI/둘러보기 UI.png — 하늘+구름 위 회색 아파트 외벽, 각 창문이 '실제 플레이 화면'의 축소판.
function drawApartment() {
  background(126, 192, 228);   // 하늘

  // 아파트 외벽 (가운데 회색 블록, 좌우·상단에 하늘 여백)
  const bx = W * 0.10, bw = W * 0.80, byTop = H * 0.05;
  drawClouds();
  noStroke();
  fill(197, 198, 202);
  rect(bx, byTop, bw, H - byTop, 7 * S);
  fill(255, 255, 255, 26);                       // 상단 빛
  rect(bx, byTop, bw, 12 * S, 7 * S);
  fill(0, 0, 0, 18);                             // 좌우 모서리 음영
  rect(bx, byTop, 6 * S, H - byTop);
  rect(bx + bw - 6 * S, byTop, 6 * S, H - byTop);

  // 창문 그리드 (3열 × 4행, 16:9 창) — 모든 칸을 창문으로 채워 건물 아래까지 가득(아파트 느낌).
  const cols = 3;
  const rows = Math.ceil(APARTMENT_ROOMS / cols);
  const gridTop = byTop, gridBottom = H - 10 * S;        // 화면 아래까지
  const gridH = gridBottom - gridTop;
  const gapY = gridH * 0.038;
  const ch = (gridH - gapY * (rows + 1)) / rows;
  const cw = ch * (DESIGN_W / DESIGN_H);                 // 실제 플레이 화면과 같은 16:9
  const gapX = Math.max((bw - cw * cols) / (cols + 1), 6 * S);
  const gx0 = bx + (bw - (cw * cols + gapX * (cols - 1))) / 2;
  const gy0 = gridTop + gapY;

  // 외벽 벽돌 디테일 (참고 아파트 배경.png) — 창 사이 빈 세로 띠·좌우 여백에 흩뿌림(창보다 먼저 → 창이 덮음)
  drawFacadeBricks(bx, bw, byTop, gx0, cw, gapX, cols);

  for (let i = 0; i < apartmentRooms.length; i++) {
    const x = gx0 + (i % cols) * (cw + gapX);
    const y = gy0 + Math.floor(i / cols) * (ch + gapY);
    drawApartmentWindow(x, y, cw, ch, apartmentRooms[i]);
  }
}

// 아파트뷰 하늘 구름 — 떠다니는 연출.
//  off = 초기 위상(0~1), sp = 초당 진행 비율(서로 달라 시차감), y/w = 높이·폭(W·H 비율)
const APT_CLOUDS = [
  { idx: 0, y: 0.10, w: 0.150, off: 0.00, sp: 0.020 },
  { idx: 1, y: 0.14, w: 0.150, off: 0.55, sp: 0.015 },
  { idx: 3, y: 0.60, w: 0.160, off: 0.30, sp: 0.012 },
  { idx: 2, y: 0.52, w: 0.120, off: 0.78, sp: 0.024 },
];

// 구름이 하늘을 천천히 가로로 떠다님 — 건물 뒤로 지나가며 가려졌다가 반대편 하늘에서 다시 등장.
// (외벽보다 먼저 그려서 가운데 구간은 외벽이 덮어 = 건물 뒤로 지나가는 느낌)
function drawClouds() {
  const t = millis() / 1000;
  for (const c of APT_CLOUDS) {
    const cw = c.w * W;
    const total = W + cw;                                  // -cw(왼쪽 밖) ~ W(오른쪽 밖)
    const x = -cw + ((c.off + c.sp * t) % 1) * total;      // 우로 천천히 흐르며 순환
    const y = c.y * H + Math.sin(t * 0.5 + c.off * TWO_PI) * H * 0.008;  // 미세 상하 부유
    drawCloudImg(c.idx, x, y, cw);
  }
}

// 구름 PNG 한 장 (x,y=좌상단, w=폭, 높이는 종횡비 유지)
function drawCloudImg(idx, x, y, w) {
  const img = IMAGES.clouds && IMAGES.clouds[idx];
  if (!img) return;
  noTint();
  image(img, x, y, w, w * (img.height / img.width));
}

// 외벽 벽돌 디테일 — 두 칸 어긋난 가로 바(참고 아파트 배경.png의 회색 디테일).
// 창 사이 빈 세로 띠(열 간격)와 좌우 여백에 높이를 엇갈려 흩뿌린다.
function drawFacadeBricks(bx, bw, byTop, gx0, cw, gapX, cols) {
  // 비어 있는(창이 없는) 세로 띠들의 중심 x
  const strips = [];
  strips.push((bx + gx0) / 2);                                  // 좌측 여백
  for (let c = 0; c < cols - 1; c++) strips.push(gx0 + c * (cw + gapX) + cw + gapX / 2);  // 열 사이
  const gridRight = gx0 + cols * cw + (cols - 1) * gapX;
  strips.push((gridRight + bx + bw) / 2);                       // 우측 여백

  // 띠마다 엇갈린 높이(세로 비율) — 규칙적이지 않게 흩뿌림
  const yFracs = [[0.30, 0.70], [0.50], [0.24, 0.62], [0.40, 0.80]];
  for (let i = 0; i < strips.length; i++) {
    const fr = yFracs[i % yFracs.length];
    for (const f of fr) drawBrick(strips[i], byTop + f * (H - byTop), S);
  }
}

// 벽돌 한 개 = 두 칸 어긋난 가로 바 (외벽보다 살짝 어두운 청회색)
function drawBrick(cx, cy, s) {
  noStroke();
  const u = 8 * s;
  fill(170, 175, 188, 235);
  rect(cx - u, cy - u, 2 * u, u);   // 위 바 (왼쪽)
  rect(cx,     cy,     2 * u, u);   // 아래 바 (오른쪽으로 한 칸)
}

function drawApartmentWindow(x, y, w, h, room) {
  noStroke();
  const f = room.isPlayer ? 5 * S : 3 * S;
  fill(room.isPlayer ? color(120, 220, 180) : color(150, 151, 156));
  rect(x - f, y - f, w + f * 2, h + f * 2, 5 * S);    // 창틀 (나=강조)

  drawMiniPlayScene(x, y, w, h, room);                // 실제 플레이 화면 축소판

  if (room.isPlayer) {                                // "나" 라벨
    const lw = 28 * S, lh = 17 * S;
    noStroke();
    fill(40, 160, 120, 235);
    rect(x + 4 * S, y + 4 * S, lw, lh, 4 * S);
    fill(255);
    textSize(11 * S);
    textAlign(CENTER, CENTER);
    text('나', x + 4 * S + lw / 2, y + 4 * S + lh / 2);
  }
}

// 한 창문 = 실제 플레이 씬의 축소판. 전역 레이아웃/상태를 잠시 '창 크기 + 방별 상태'로 바꿔
// 같은 drawScene/drawButtons 코드를 그대로 렌더한 뒤 복원한다(방별 밝기·위치·박스 반영).
function drawMiniPlayScene(px, py, pw, ph, room) {
  const sv = {
    W, H, S, ROOM_TOP, ROOM_BOTTOM,
    PLAYER_RANGE_LEFT, PLAYER_RANGE_RIGHT, PANEL_LEFT, PANEL_W,
    playerX, boxCount, boxFlashAt, heldRest, walkUntil, brightnessOverride,
  };
  push();
  drawingContext.beginPath();
  drawingContext.rect(px, py, pw, ph);
  drawingContext.clip();                 // 씬이 창 밖으로 새지 않게
  translate(px, py);

  applyLayout(pw, ph);                    // 창 크기를 하나의 플레이 화면 뷰포트로
  playerX = room.prog;
  boxCount = room.boxes;
  boxFlashAt = -9999;                     // 박스 반짝임 없음
  heldRest = false;
  walkUntil = 0;                          // 정지(서있기) 프레임
  brightnessOverride = room.bright;       // 방별 밝기

  drawScene();                            // 방 배경(밝기)+문+침대+캐릭터+박스
  drawButtons();                          // 우측 패널 + 앞으로/잠시 쉬기
  drawLookBtn();                          // 조건 맞으면 초록 '주변 둘러보기' 알약

  pop();
  ({
    W, H, S, ROOM_TOP, ROOM_BOTTOM,
    PLAYER_RANGE_LEFT, PLAYER_RANGE_RIGHT, PANEL_LEFT, PANEL_W,
    playerX, boxCount, boxFlashAt, heldRest, walkUntil, brightnessOverride,
  } = sv);
}

function drawLookaroundOverlay() {
  const elapsed = millis() - lookStart;

  if (elapsed < LOOK_MSG_MS) {
    // 중앙 문구 (페이드 인/아웃)
    const t = elapsed / LOOK_MSG_MS;
    let a = 255;
    if (t < 0.12) a = map(t, 0, 0.12, 0, 255);
    else if (t > 0.85) a = map(t, 0.85, 1, 255, 130);
    noStroke();
    fill(0, 150 * (a / 255));
    rect(0, H / 2 - 60 * S, W, 120 * S);
    fill(255, 255, 255, a);
    textSize(18 * S);
    textLeading(26 * S);
    textAlign(CENTER, CENTER);
    text(lookMsg, W / 2, H / 2);
  } else {
    // 되돌아가기 버튼 — 아파트 위에 떠 있는 우하단 플로팅 버튼 (그림자로 띄움)
    const r = backBtn();
    const rad = r.h * 0.5;                                    // 알약형
    noStroke();
    fill(0, 0, 0, 70);
    rect(r.x + 4 * S, r.y + 6 * S, r.w, r.h, rad);            // 드롭 섀도(부유감)
    fill(96, 200, 150);
    rect(r.x, r.y, r.w, r.h, rad);                            // 몸체
    fill(255, 130 + sin(millis() / 300) * 30);
    rect(r.x + 10 * S, r.y + 7 * S, r.w - 20 * S, 6 * S, 4 * S);  // 상단 하이라이트
    fill(18, 58, 44);
    textSize(16 * S);
    textAlign(CENTER, CENTER);
    text('↩ 되돌아가기', r.x + r.w / 2, r.y + r.h / 2);
  }
}
