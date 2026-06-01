// Escape Room — Stage 1 MVP
// 혼자만의 고독한 사투

// --- 적응형 캔버스 ---
let W, H, S;                            // W/H = 캔버스 픽셀, S = 아트 스케일 (W/360 기준)
let ROOM_TOP, ROOM_BOTTOM, BTN_AREA_TOP;
let PLAYER_RANGE_LEFT, PLAYER_RANGE_RIGHT;
const DESKTOP_MAX_W = 500;              // 데스크탑에서 너비 제한 (모바일에서는 자동으로 풀폭)

// --- 밸런스 수치 ---
const AUTO_DRIFT_PER_SEC = 0.025;
const FORWARD_PER_TAP = 0.020;
const BOX_PENALTY = 0.5;
const BOX_INTERVAL_MS = 3000;
const MAX_BOX_COUNT = 8;

// 둘러보기(아파트뷰) 연출
const LOOK_BTN_BOX_MIN = 4;        // 박스 N개 이상이면 둘러보기 버튼 등장
const LOOK_NEAR_BED = 1 / 3;       // 또는 캐릭터가 화면 왼쪽 1/3(침대 근처) 도달 시
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

// 둘러보기 상태
let usedLookAround = false;        // 둘러보기 사용 여부 (본편 클리어 엔딩 분기용)
let lookStart = 0;                 // 둘러보기 진입 시각
let lookMsg = '';                  // 이번 둘러보기에서 띄울 문구
let apartmentRooms = [];           // 아파트뷰 각 방 구성

function setup() {
  recomputeLayout();
  const cnv = createCanvas(W, H);
  cnv.style('display', 'block');
  smooth();
  textAlign(CENTER, CENTER);
  resetGame();
}

function windowResized() {
  recomputeLayout();
  resizeCanvas(W, H);
}

// 뷰포트 크기로부터 레이아웃 좌표·스케일을 재계산
function recomputeLayout() {
  W = Math.min(window.innerWidth, DESKTOP_MAX_W);
  H = window.innerHeight;
  S = W / 360;

  // 하단 버튼 영역
  const btnAreaH = Math.min(170 * S, H * 0.30);
  const bottomMargin = 16 * S;
  BTN_AREA_TOP = H - btnAreaH - bottomMargin;

  // 방 영역
  const roomGap = 16 * S;
  ROOM_BOTTOM = BTN_AREA_TOP - roomGap;
  ROOM_TOP = Math.max(50 * S, H * 0.08);

  // 플레이어 가로 범위
  PLAYER_RANGE_LEFT = W * 0.22;
  PLAYER_RANGE_RIGHT = W * 0.84;
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
  usedLookAround = false;
  lookStart = 0;
  lookMsg = '';
  apartmentRooms = [];
}

function draw() {
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

  drawDoor(W - 28 * S, ROOM_TOP + 20 * S, ROOM_BOTTOM - 30 * S);

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

// ---------- HUD ----------
function drawHUD() {
  textSize(12 * S);
  fill(180, 240, 200, 220);
  textAlign(LEFT, TOP);
  text('[ROOM_01]', 10 * S, 12 * S);
  textAlign(RIGHT, TOP);
  text('지게 무게: ' + boxCount, W - 10 * S, 12 * S);
  textAlign(CENTER, CENTER);
}

// ---------- buttons ----------
function forwardBtn() {
  const btnH = Math.min(140 * S, H * 0.22);
  return {
    x: W * 0.28,
    y: BTN_AREA_TOP + 10 * S,
    w: W * 0.66,
    h: btnH,
  };
}
function restBtn() {
  const btnH = Math.min(70 * S, H * 0.11);
  return {
    x: W * 0.04,
    y: BTN_AREA_TOP + 40 * S,
    w: W * 0.22,
    h: btnH,
  };
}
function inRect(mx, my, r) {
  return mx >= r.x && mx <= r.x + r.w && my >= r.y && my <= r.y + r.h;
}

function drawButtons() {
  const fwd = forwardBtn();
  const rest = restBtn();

  // [앞으로 가기]
  noStroke();
  fill(40, 10, 15);
  rect(fwd.x + 3 * S, fwd.y + 5 * S, fwd.w, fwd.h, 10 * S);
  fill(220, 60, 70);
  rect(fwd.x, fwd.y, fwd.w, fwd.h, 10 * S);
  fill(255, 120, 130);
  rect(fwd.x + 6 * S, fwd.y + 6 * S, fwd.w - 12 * S, 6 * S, 6 * S);
  fill(255);
  textSize(22 * S);
  text('▶ 앞으로 가기', fwd.x + fwd.w / 2, fwd.y + fwd.h / 2);

  // [잠시 쉬기] — 피자박스가 쌓인 모양
  fill(30, 25, 30);
  rect(rest.x + 3 * S, rest.y + 5 * S, rest.w, rest.h, 8 * S);
  fill(heldRest ? 180 : 130, heldRest ? 150 : 125, heldRest ? 130 : 130);
  rect(rest.x, rest.y, rest.w, rest.h, 8 * S);

  push();
  translate(rest.x + 14 * S, rest.y + 14 * S);
  fill(200, 140, 80);
  rect(2 * S, 14 * S, 50 * S, 10 * S);
  rect(6 * S, 6 * S, 46 * S, 10 * S);
  rect(10 * S, -2 * S, 42 * S, 10 * S);
  fill(140, 80, 35);
  rect(2 * S, 18 * S, 50 * S, 1 * S);
  rect(6 * S, 10 * S, 46 * S, 1 * S);
  rect(10 * S, 2 * S, 42 * S, 1 * S);
  pop();
  fill(255);
  textSize(12 * S);
  text('잠시 쉬기', rest.x + rest.w / 2, rest.y + rest.h - 12 * S);
}

// ---------- end card ----------
function drawEndCard() {
  fill(0, 200);
  rect(0, 0, W, H);

  let title, body, hint;
  if (phase === 'win') {
    title = '문에 도달했습니다';
    body = '(1단계 클리어 — 2단계 추가 예정)';
    hint = '※ 본편: 줌아웃 + 멀티룸 연출';
  } else if (loseReason === 'crushed') {
    title = '박스 무게에 짓눌렸습니다';
    body = '지게가 더 이상 버티지 못했습니다';
    hint = '※ 본편: HELP → 줌아웃 → 함께 탈출';
  } else {
    title = '침대에 잠식되었습니다';
    body = '(여기서 HELP 버튼이 등장합니다)';
    hint = '※ 본편: HELP → 줌아웃 → 함께 탈출';
  }

  fill(255);
  textSize(22 * S);
  text(title, W / 2, H / 2 - 50 * S);
  textSize(13 * S);
  fill(230, 230, 230);
  text(body, W / 2, H / 2 - 10 * S);
  fill(160, 200, 220);
  text(hint, W / 2, H / 2 + 14 * S);

  if (millis() - endShownAt > 800) {
    fill(255, 200 + sin(millis() / 300) * 40);
    textSize(12 * S);
    text('탭하면 다시 시작', W / 2, H / 2 + 60 * S);
  }
}

// ---------- input ----------
function handlePress(mx, my) {
  if (phase === 'countdown') return;
  if (phase === 'win' || phase === 'lose') {
    if (millis() - endShownAt > 800) resetGame();
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
  const w = W * 0.52;
  const h = 36 * S;
  return { x: W / 2 - w / 2, y: ROOM_TOP + 6 * S, w, h };
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

  // 6개 방 그리드 (2열 x 3행)
  const cols = 2;
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
