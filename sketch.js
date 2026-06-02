// Escape Room — Stage 1 MVP
// 혼자만의 고독한 사투

// --- 적응형 캔버스 (가로 모드) ---
let W, H, S;                            // W/H = 캔버스 픽셀, S = 아트 스케일 (가로 640x360 기준)
let ROOM_TOP, ROOM_BOTTOM;
let PLAYER_RANGE_LEFT, PLAYER_RANGE_RIGHT;
let PANEL_LEFT, PANEL_W;                // 우측 컨트롤 패널 (앞으로/쉬기 버튼)
const DESIGN_W = 640, DESIGN_H = 360;   // 가로 디자인 기준 해상도 (16:9)

// --- 폰트 (KBL Jump 패밀리) ---
// preload()에서 로드. 사용: textFont(FONTS.kblExtended) 등.
let FONTS = {};

// --- 이미지 에셋 --- (preload()에서 로드. 사용: image(IMAGES.logo, ...))
let IMAGES = {};

// --- 밸런스 수치 ---
const AUTO_DRIFT_PER_SEC = 0.025;
const FORWARD_PER_TAP = 0.020;
const BOX_PENALTY = 0.5;
const BOX_INTERVAL_MS = 3000;
const MAX_BOX_COUNT = 8;

// 둘러보기(아파트뷰) 연출
const LOOK_BTN_BOX_MIN = 4;        // 박스 N개 이상이면 둘러보기 버튼 등장
const LOOK_NEAR_BED = 2 / 5;       // 또는 캐릭터가 화면 왼쪽 1/3(침대 근처) 도달 시
const LOOK_MSG_MS = 3000;          // 아파트뷰 중앙 문구 노출 시간
const LOOK_BOX_RELIEF = 0.2;       // 되돌아온 뒤 남는 박스 비율 (80% 덜어냄)
const APARTMENT_ROOMS = 6;         // 아파트뷰에 보일 방 개수 (플레이어 방 포함)
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
let endShownAt = 0;
let outroStart = 0;                 // 엔딩 메시지 다음 '피자 이스케이프' 로고 아웃트로 진입 시각
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
  };
}

function setup() {
  recomputeLayout();
  const cnv = createCanvas(W, H);
  cnv.style('display', 'block');
  smooth();
  textAlign(CENTER, CENTER);
  resetGame();
  phase = 'title';   // 첫 진입은 오프닝 로고 (재도전은 곧장 카운트다운)
}

function windowResized() {
  recomputeLayout();
  resizeCanvas(W, H);
}

// 뷰포트 크기로부터 레이아웃 좌표·스케일을 재계산 (가로 모드 기준)
function recomputeLayout() {
  W = window.innerWidth;
  H = window.innerHeight;
  // 가로/세로 중 더 빡빡한 쪽에 맞춰 아트가 화면을 넘지 않게
  S = Math.min(W / DESIGN_W, H / DESIGN_H);

  // 우측 컨트롤 패널 (앞으로/쉬기)
  PANEL_W = Math.max(W * 0.24, 130 * S);
  PANEL_LEFT = W - PANEL_W;

  // 방(플레이) 영역 = 좌측
  ROOM_TOP = Math.max(40 * S, H * 0.10);
  ROOM_BOTTOM = H - Math.max(34 * S, H * 0.10);

  // 플레이어 가로 범위 (좌=침대 ~ 우=문, 패널 침범 금지)
  PLAYER_RANGE_LEFT = W * 0.07;
  PLAYER_RANGE_RIGHT = PANEL_LEFT - W * 0.08;
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
  outroStart = 0;
  usedLookAround = false;
  lookStart = 0;
  lookMsg = '';
  apartmentRooms = [];
  titleSlide = 0;
  textFont('sans-serif');  // 엔딩/아웃트로에서 바꾼 폰트 원복 (게임 텍스트는 기본 폰트)
}

// 오프닝 → 게임 시작 (카운트다운 진입)
function startGame() {
  phase = 'countdown';
  countdownStart = millis();
  textFont('sans-serif');  // 오프닝에서 바꾼 폰트 원복 (게임 텍스트는 기본 폰트 유지)
}

function draw() {
  // 오프닝 로고 — 세로면 로고가 옆으로 눕혀져 회전을 유도
  if (phase === 'title') { drawTitleScreen(); return; }
  // 그 외 페이즈에서 세로로 들면 게임을 멈추고 회전 안내 (가로 고정)
  if (isPortrait()) { drawRotateHint(); return; }
  // 엔딩 메시지 다음의 로고 아웃트로 (씬/HUD 없이 네이비 전체화면)
  if (phase === 'outro') { drawOutro(); return; }

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

// 세로/가로 판별 (orientation 변경 즉시 반영되도록 window 값 직접 사용)
function isPortrait() {
  return window.innerHeight > window.innerWidth;
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
  const b = constrain(playerX, 0, 1);
  const bg = lerpColor(color(10, 8, 22), color(80, 65, 115), b);
  background(bg);

  noStroke();
  fill(red(bg) * 0.7, green(bg) * 0.7, blue(bg) * 0.85);
  rect(0, 0, W, ROOM_TOP);

  fill(45 + b * 30, 35 + b * 25, 70 + b * 30);
  rect(0, ROOM_BOTTOM - 30 * S, W, 30 * S);

  drawBed(18 * S, ROOM_BOTTOM - 70 * S);
  drawTrash(95 * S, ROOM_BOTTOM - 22 * S);
  drawTrash(130 * S, ROOM_BOTTOM - 18 * S);

  drawDoor(PLAYER_RANGE_RIGHT + W * 0.04, ROOM_TOP + 20 * S, ROOM_BOTTOM - 30 * S);

  const px = lerp(PLAYER_RANGE_LEFT, PLAYER_RANGE_RIGHT, playerX);
  const py = ROOM_BOTTOM - 30 * S;
  drawPlayer(px, py);
  drawBoxStack(px, py, boxCount);

  const darkAlpha = (1 - b) * 140;
  if (darkAlpha > 0) {
    fill(0, darkAlpha);
    rect(0, 0, W, H);
  }
}

function drawBed(x, y) {
  noStroke();
  fill(70, 50, 60);
  rect(x, y, 78 * S, 30 * S);
  fill(150, 80, 95);
  rect(x + 4 * S, y + 4 * S, 70 * S, 22 * S);
  fill(230, 215, 230);
  rect(x + 6 * S, y + 6 * S, 22 * S, 14 * S);
  fill(120, 60, 75);
  rect(x + 36 * S, y + 6 * S, 36 * S, 18 * S);
}

function drawTrash(x, y) {
  noStroke();
  fill(60, 60, 60);
  rect(x, y, 14 * S, 10 * S);
  fill(80, 80, 80);
  rect(x + 4 * S, y - 5 * S, 10 * S, 6 * S);
}

function drawDoor(x, yTop, yBottom) {
  noStroke();
  fill(100, 230, 180, 60);
  rect(x - 6 * S, yTop, 16 * S, yBottom - yTop);
  fill(140, 240, 200);
  rect(x, yTop, 4 * S, yBottom - yTop);
}

function drawPlayer(x, y) {
  noStroke();
  fill(110, 75, 45);
  rect(x - 10 * S, y - 38 * S, 4 * S, 34 * S);
  rect(x - 12 * S, y - 8 * S, 10 * S, 4 * S);
  fill(85, 55, 30);
  rect(x - 11 * S, y - 6 * S, 8 * S, 2 * S);

  fill(40, 35, 60);
  rect(x - 6 * S, y - 8 * S, 4 * S, 8 * S);
  rect(x + 1 * S, y - 8 * S, 4 * S, 8 * S);

  fill(80, 90, 130);
  rect(x - 7 * S, y - 22 * S, 13 * S, 16 * S);

  fill(245, 220, 200);
  rect(x - 5 * S, y - 32 * S, 11 * S, 11 * S);
  fill(40, 30, 35);
  rect(x - 5 * S, y - 32 * S, 11 * S, 5 * S);
  rect(x - 5 * S, y - 28 * S, 2 * S, 3 * S);
  rect(x + 4 * S, y - 28 * S, 2 * S, 3 * S);
  fill(20);
  rect(x + 3 * S, y - 26 * S, 2 * S, 2 * S);
}

function drawBoxStack(x, baseY, count) {
  if (count === 0) return;
  const flash = millis() - boxFlashAt < 400;
  const topIdx = count - 1;
  for (let i = 0; i < count; i++) {
    const bx = x - 16 * S;
    const by = baseY - 42 * S - i * 9 * S;
    const isTop = i === topIdx;
    let c = color(200, 140, 80);
    if (isTop && flash && Math.floor(millis() / 80) % 2 === 0) {
      c = color(255, 230, 160);
    }
    noStroke();
    fill(c);
    rect(bx, by, 18 * S, 9 * S);
    fill(140, 80, 35);
    rect(bx, by + 4 * S, 18 * S, 1 * S);
    rect(bx + 8 * S, by, 1 * S, 9 * S);
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
  if (isPortrait()) { drawRotateHint(); return; }  // 가로로 돌리도록 유도
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

// 세로로 들었을 때 게임을 멈추고 가로 회전 안내 (오프닝 회전 유도 겸용)
function drawRotateHint() {
  background(OPEN_BG[0], OPEN_BG[1], OPEN_BG[2]);
  const k = Math.min(window.innerWidth, window.innerHeight) / 360;
  push();
  translate(W / 2, H / 2);
  rotate(HALF_PI);
  textAlign(CENTER, CENTER);
  noStroke();
  fill(255);
  textSize(46 * k);
  text('↻', 0, -50 * k);
  textFont(FONTS.macho);
  textSize(20 * k);
  text('화면을 가로로 돌려주세요', 0, 10 * k);
  pop();
}

// ---------- HUD ----------
function drawHUD() {
  textSize(12 * S);
  fill(180, 240, 200, 220);
  textAlign(LEFT, TOP);
  text('[ROOM_01]', 10 * S, 12 * S);
  textAlign(RIGHT, TOP);
  text('지게 무게: ' + boxCount, PANEL_LEFT - 10 * S, 12 * S);
  textAlign(CENTER, CENTER);
}

// ---------- buttons (우측 세로 패널) ----------
function forwardBtn() {
  // 앞으로 = 오른쪽(=문 방향)으로 직관 매핑, 엄지가 닿는 패널 하단의 큰 버튼
  const m = PANEL_W * 0.12;
  return {
    x: PANEL_LEFT + m,
    y: H * 0.30,
    w: PANEL_W - m * 2,
    h: H * 0.42,
  };
}
function restBtn() {
  const m = PANEL_W * 0.12;
  return {
    x: PANEL_LEFT + m,
    y: H * 0.06,
    w: PANEL_W - m * 2,
    h: H * 0.18,
  };
}
function inRect(mx, my, r) {
  return mx >= r.x && mx <= r.x + r.w && my >= r.y && my <= r.y + r.h;
}

function drawButtons() {
  // 우측 컨트롤 패널 배경
  noStroke();
  fill(16, 13, 26);
  rect(PANEL_LEFT, 0, PANEL_W, H);
  fill(44, 38, 60);
  rect(PANEL_LEFT, 0, 3 * S, H);

  const fwd = forwardBtn();
  const rest = restBtn();
  textAlign(CENTER, CENTER);

  // [잠시 쉬기] — 피자박스가 쌓인 모양 (패널 위쪽, 작게)
  fill(28, 24, 30);
  rect(rest.x + 3 * S, rest.y + 5 * S, rest.w, rest.h, 8 * S);
  fill(heldRest ? 180 : 130, heldRest ? 150 : 125, 130);
  rect(rest.x, rest.y, rest.w, rest.h, 8 * S);
  push();
  translate(rest.x + rest.w / 2 - 26 * S, rest.y + rest.h / 2 - 14 * S);
  fill(200, 140, 80);
  rect(2 * S, 14 * S, 50 * S, 9 * S);
  rect(6 * S, 6 * S, 44 * S, 9 * S);
  rect(10 * S, -2 * S, 38 * S, 9 * S);
  fill(140, 80, 35);
  rect(2 * S, 18 * S, 50 * S, 1 * S);
  rect(6 * S, 10 * S, 44 * S, 1 * S);
  rect(10 * S, 2 * S, 38 * S, 1 * S);
  pop();
  fill(255);
  textSize(13 * S);
  text('잠시 쉬기', rest.x + rest.w / 2, rest.y + rest.h - 12 * S);

  // [앞으로 가기] — 패널 아래쪽, 크게
  fill(40, 10, 15);
  rect(fwd.x + 3 * S, fwd.y + 6 * S, fwd.w, fwd.h, 12 * S);
  fill(220, 60, 70);
  rect(fwd.x, fwd.y, fwd.w, fwd.h, 12 * S);
  fill(255, 120, 130);
  rect(fwd.x + 8 * S, fwd.y + 8 * S, fwd.w - 16 * S, 7 * S, 6 * S);
  fill(255);
  textSize(34 * S);
  text('▶', fwd.x + fwd.w / 2, fwd.y + fwd.h / 2 - 18 * S);
  textSize(20 * S);
  text('앞으로', fwd.x + fwd.w / 2, fwd.y + fwd.h / 2 + 18 * S);
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

// ---------- 로고 아웃트로 (피자 이스케이프 → 게임 리플레이) ----------
const OUTRO_LOGO_MS = 1100;   // 로고만 보이는 시간 → 이후 리플레이 버튼 페이드인

function enterOutro() {
  phase = 'outro';
  outroStart = millis();
}

function drawOutro() {
  background(OPEN_BG[0], OPEN_BG[1], OPEN_BG[2]);

  // 로고 락업 (피자박스 + '피자 이스케이프' 워드마크 = 로고.png)
  const img = IMAGES.logo;
  if (img) {
    const ar = img.width / img.height;
    let h = H * 0.55, w = h * ar;
    const maxW = W * 0.62;
    if (w > maxW) { w = maxW; h = w / ar; }
    imageMode(CENTER);
    image(img, W / 2, H * 0.40, w, h);
    imageMode(CORNER);
  }

  // 리플레이 버튼 (로고가 자리잡은 뒤 페이드 인)
  const t = millis() - outroStart;
  if (t > OUTRO_LOGO_MS) {
    const a = Math.min(255, (t - OUTRO_LOGO_MS) / 350 * 255);
    textFont(FONTS.macho);
    textAlign(LEFT, CENTER);
    const fs = H * 0.052;
    textSize(fs);
    const label = '게임 리플레이하기';
    const tw = textWidth(label);
    const tr = fs * 0.40;          // ▶ 삼각형 반높이
    const gap = fs * 0.5;
    const groupW = tr * 1.2 + gap + tw;
    const startX = W / 2 - groupW / 2;
    const cy = H * 0.84;
    noStroke();
    fill(255, a);
    triangle(startX, cy - tr, startX, cy + tr, startX + tr * 1.2, cy);
    text(label, startX + tr * 1.2 + gap, cy);
  }

  textAlign(CENTER, CENTER);
}

// ---------- input ----------
function handlePress(mx, my) {
  if (phase === 'title') {
    if (isPortrait()) return;                         // 세로면 먼저 가로로 돌리도록 무시
    if (titleSlide < TITLE_SLIDES - 1) titleSlide++;  // 다음 슬라이드로
    else startGame();                                 // 마지막 슬라이드 → 게임 시작
    return;
  }
  if (phase === 'countdown') return;
  if (phase === 'win' || phase === 'lose') {
    if (millis() - endShownAt > 900) enterOutro();   // 엔딩 메시지 → 로고 아웃트로
    return;
  }
  if (phase === 'outro') {
    // 로고가 뜨고 리플레이 버튼이 나타난 뒤에만 재시작
    if (millis() - outroStart > OUTRO_LOGO_MS) resetGame();
    return;
  }
  if (phase === 'lookaround') {
    // 문구 노출(3초)이 끝난 뒤에만 되돌아가기 가능
    if (millis() - lookStart > LOOK_MSG_MS && inRect(mx, my, backBtn())) {
      returnFromLookaround();
    }
    return;
  }
  // playing
  if (lookBtnVisible() && inRect(mx, my, lookBtn())) {
    enterLookaround();
  } else if (inRect(mx, my, forwardBtn())) {
    playerX += FORWARD_PER_TAP / (1 + boxCount * BOX_PENALTY);
  } else if (inRect(mx, my, restBtn())) {
    heldRest = true;
  }
}

function handleRelease() {
  heldRest = false;
}

function mousePressed() { handlePress(mouseX, mouseY); return false; }
function mouseReleased() { handleRelease(); return false; }
function touchStarted() {
  if (touches.length > 0) handlePress(touches[0].x, touches[0].y);
  else handlePress(mouseX, mouseY);
  return false;
}
function touchEnded() { handleRelease(); return false; }

// ---------- 둘러보기 (아파트뷰 연출) ----------
function lookBtnVisible() {
  return boxCount >= LOOK_BTN_BOX_MIN || playerX <= LOOK_NEAR_BED;
}

function lookBtn() {
  const cx = PANEL_LEFT / 2;          // 플레이 영역(좌측) 중앙
  const w = PANEL_LEFT * 0.5;
  const h = 36 * S;
  return { x: cx - w / 2, y: ROOM_TOP + 6 * S, w, h };
}

function backBtn() {
  const w = W * 0.6;
  const h = 54 * S;
  return { x: W / 2 - w / 2, y: H - 84 * S, w, h };
}

function drawLookBtn() {
  if (!lookBtnVisible()) return;
  const r = lookBtn();
  const pulse = 0.5 + 0.5 * sin(millis() / 300);
  noStroke();
  fill(15, 60, 50, 200);
  rect(r.x + 2 * S, r.y + 3 * S, r.w, r.h, r.h / 2);
  fill(70 + pulse * 45, 200, 160);
  rect(r.x, r.y, r.w, r.h, r.h / 2);
  fill(8, 40, 30);
  textSize(15 * S);
  textAlign(CENTER, CENTER);
  text('주변 둘러보기', r.x + r.w / 2, r.y + r.h / 2);
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

// 아파트뷰에 보일 방들을 구성 (0번 = 플레이어 본인 방)
function buildApartment() {
  apartmentRooms = [];
  apartmentRooms.push({
    isPlayer: true,
    prog: constrain(playerX, 0.08, 0.92),
    boxes: boxCount,
    skin: color(245, 220, 200),
    shirt: color(80, 90, 130),
    hair: color(40, 30, 35),
  });

  const skins = [
    color(245, 220, 200), color(225, 195, 170), color(208, 168, 138),
    color(190, 150, 120), color(250, 228, 208),
  ];
  const shirts = [
    color(150, 90, 90), color(90, 140, 110), color(120, 110, 165),
    color(170, 150, 80), color(95, 120, 150), color(165, 110, 140),
  ];
  const hairs = [
    color(40, 30, 35), color(62, 45, 30), color(28, 28, 40),
    color(72, 60, 55), color(20, 20, 25),
  ];

  for (let i = 1; i < APARTMENT_ROOMS; i++) {
    apartmentRooms.push({
      isPlayer: false,
      prog: random(0.12, 0.9),
      boxes: Math.floor(random(0, 7)),
      skin: random(skins),
      shirt: random(shirts),
      hair: random(hairs),
    });
  }
}

function drawApartment() {
  // 건물 외벽 배경
  background(18, 16, 30);
  noStroke();
  fill(34, 30, 52);
  rect(0, 0, W, H);

  const topPad = 52 * S;
  const botPad = 96 * S;

  // 타이틀
  fill(200, 220, 235, 230);
  textSize(15 * S);
  textAlign(CENTER, CENTER);
  text('아파트 — 다들 각자의 방에서', W / 2, topPad / 2);

  // 6개 방 그리드 (가로: 3열 x 2행)
  const cols = 3;
  const rows = Math.ceil(APARTMENT_ROOMS / cols);
  const outer = 14 * S;
  const gap = 10 * S;
  const gridW = W - outer * 2;
  const gridH = H - topPad - botPad;
  const cw = (gridW - gap * (cols - 1)) / cols;
  const ch = (gridH - gap * (rows - 1)) / rows;

  for (let i = 0; i < apartmentRooms.length; i++) {
    const c = i % cols;
    const r = Math.floor(i / cols);
    const x = outer + c * (cw + gap);
    const y = topPad + r * (ch + gap);
    drawMiniRoom(x, y, cw, ch, apartmentRooms[i]);
  }
}

function drawMiniRoom(x, y, w, h, room) {
  // 창틀 (플레이어 방은 강조)
  noStroke();
  fill(room.isPlayer ? color(120, 220, 180) : color(58, 52, 78));
  rect(x - 2 * S, y - 2 * S, w + 4 * S, h + 4 * S, 4 * S);

  // 방 배경 (진행도에 따라 약간 밝게)
  const bg = lerpColor(color(20, 16, 34), color(72, 58, 100), room.prog);
  fill(bg);
  rect(x, y, w, h, 3 * S);

  // 바닥
  const floorY = y + h * 0.82;
  fill(red(bg) * 0.7 + 18, green(bg) * 0.7 + 14, blue(bg) * 0.7 + 28);
  rect(x, floorY, w, y + h - floorY);

  // 침대 (왼쪽)
  fill(120, 70, 85);
  rect(x + 5 * S, floorY - h * 0.13, w * 0.22, h * 0.13, 2 * S);

  // 문 (오른쪽)
  fill(140, 240, 200, 210);
  rect(x + w - 7 * S, y + h * 0.22, 3 * S, floorY - (y + h * 0.22));

  // 캐릭터 + 박스
  const chX = lerp(x + w * 0.24, x + w * 0.78, room.prog);
  drawMiniBoxes(chX, floorY, h, room.boxes);
  drawMiniChar(chX, floorY, h, room);

  // "나" 라벨
  if (room.isPlayer) {
    fill(150, 245, 200);
    textSize(11 * S);
    textAlign(LEFT, TOP);
    text('나', x + 5 * S, y + 4 * S);
  }
}

function drawMiniChar(cx, baseY, h, room) {
  const u = h * 0.011;
  noStroke();
  // 다리
  fill(40, 35, 60);
  rect(cx - 3 * u, baseY - 4 * u, 3 * u, 4 * u);
  rect(cx + 1 * u, baseY - 4 * u, 3 * u, 4 * u);
  // 몸통
  fill(room.shirt);
  rect(cx - 4 * u, baseY - 14 * u, 9 * u, 11 * u, 1 * u);
  // 머리
  fill(room.skin);
  rect(cx - 3 * u, baseY - 22 * u, 7 * u, 8 * u, 1 * u);
  // 머리카락
  fill(room.hair);
  rect(cx - 3 * u, baseY - 22 * u, 7 * u, 3 * u, 1 * u);
}

function drawMiniBoxes(cx, baseY, h, count) {
  if (count <= 0) return;
  const u = h * 0.011;
  const shown = Math.min(count, 8);
  for (let i = 0; i < shown; i++) {
    const bx = cx - 8 * u;
    const by = baseY - 17 * u - i * 4 * u;
    fill(200, 140, 80);
    rect(bx, by, 8 * u, 4 * u);
    fill(140, 80, 35);
    rect(bx, by + 1.6 * u, 8 * u, 0.7 * u);
  }
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
    // 되돌아가기 버튼
    const r = backBtn();
    noStroke();
    fill(18, 55, 42);
    rect(r.x + 3 * S, r.y + 4 * S, r.w, r.h, 10 * S);
    fill(90, 200, 150);
    rect(r.x, r.y, r.w, r.h, 10 * S);
    fill(255, 130 + sin(millis() / 300) * 30);
    rect(r.x + 6 * S, r.y + 6 * S, r.w - 12 * S, 5 * S, 4 * S);
    fill(255);
    textSize(18 * S);
    textAlign(CENTER, CENTER);
    text('↩ 되돌아가기', r.x + r.w / 2, r.y + r.h / 2);
  }
}
