# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A mobile-first p5.js browser game — Stage 1 MVP of an escape-room game themed around a hikikomori escaping their room. The player taps **앞으로 가기 (go forward)** to advance toward the door while an auto-drift pulls them back toward the bed and accumulating delivery boxes (피자박스) slow forward progress. UI and code comments are in Korean. The game runs **landscape** (a portrait hold shows a rotate-nudge) and opens with a 5-slide title/onboarding before the core loop. Progress to date is summarized in "현재 진행 상황" below.

이 레포는 더 큰 **행위예술 + 게임** 프로젝트(팀 포스트히키코모리)의 일부다. 전체 유저 경험 기획은 아래 "전체 유저 경험" 참고.

## 전체 유저 경험 (기획)

[Figma 기획 도식](https://www.figma.com/design/HlE01fkpGj99tgLTxBr3er/ATS-%EC%9C%A0%EC%A0%80-%EA%B2%BD%ED%97%98-%EC%88%9C%EC%84%9C?node-id=1-81)에 정의된 80초짜리 경험 흐름. **이 레포(`sketch.js`)는 아래 2번 "게임 파트"의 코어 루프만 구현한 MVP다.** 나머지 단계와 엔드 카드가 말하는 "본편"이 무엇을 가리키는지 알아야 게임을 올바른 방향으로 확장할 수 있다.

전체 소요 시간 **80초 = 게임 플레이 60초 + 메세지 전달 20초**.

**1. 퍼포먼스 파트 (오프라인 행위예술).** 퍼포머가 피자박스 100개를 등에 지고 거리를 걷는다. 짐/피자박스에 QR 코드가 부착되어 있고, 관객이 스캔하면 게임으로 진입한다.

**2. 게임 파트 (← 이 레포가 구현하는 영역. 기획상 "개발 파트").** 좌→우로 진행하며, 괄호는 기획상 목표 시간:
- **QR 랜딩 + 게임 시작 버튼 (5초)** — "고립은둔에서 벗어나고 싶은 당신. 방에서 탈출하세요!"
- **How to Play (10초)** — 앞으로 = 오른쪽으로 조금씩 이동 / 잠시 쉬기 = 멈추지만 피자박스 추가 / 아무것도 안 누르면 자동으로 침대로 끌려감 / 3초마다 피자박스가 쌓여 느려짐.
- **게임 플레이 (25초)** — 코어 루프. **현재 `sketch.js`가 구현한 부분.**
- **중간 연출 + [둘러보기] 버튼 (7초)** — 게임 도중 [둘러보기] 버튼이 등장한다(피자박스가 일정 수 이상 쌓이거나, 캐릭터가 화면 왼쪽 1/3=침대 근처에 도달할 때). **[둘러보기]는 엔딩이 아니라 인게임 구제(relief) 버튼이다**: 누르면 화면이 줌아웃되어 "나처럼 힘들게 버티는 사람이 많다"는 걸 보여준 뒤, **다시 플레이 화면으로 돌아오고 피자박스가 일부 줄어든 상태로 게임을 계속**한다. (구버전 HELP 버튼을 이 [둘러보기]로 대체·재설계 — HELP는 누르면 즉시 엔딩이었지만 [둘러보기]는 플레이로 복귀한다.) **둘러보기 사용 여부가 클리어 엔딩 분기를 가른다.**
- **엔딩 (3개) (13초)** — 세 갈래:
  - **혼자 클리어 (둘러보기 미사용)** — [둘러보기]를 한 번도 쓰지 않고 문에 도달. 외로운 톤: "혼자서 빠져나와도 짐은 사라지지 않아. 네 경험을 모두와 공유해줘." / "축하합니다… 인생은 혼자만의 레이스가 아닙니다."
  - **둘러보기 사용 후 클리어** — [둘러보기]로 연대를 경험한 뒤 문에 도달. 연대 톤: "너 혼자가 아니야. 누구나 각자의 방에서 버티는 중이야." / "넘어지는 것은 당연해. 다시 일어나도록 도와줄게."
  - **실패 (침대 매몰 / 박스에 짓눌림)** — 시간을 다 쓰거나 침대까지 밀려 매몰될 때, 또는 피자박스가 너무 쌓여 짓눌릴 때. **둘 다 같은 실패 엔딩 계열**이고 **멘트만 다르게** 띄운다: 침대 버전 "지게가 너무 무거워 결국 주저앉아 버렸군요… 잠시 쉬어간 후에 다시 문을 바라보아도 늦지 않습니다." / 박스 과적 버전은 박스 무게에 짓눌린 멘트.
  - 각 엔딩 후 **[되돌아가기]** 로 재도전("다들 비슷하구나, 나도 힘내야지").

**3. 메세지 전달 파트 (20초).** 한국의 은둔고립 현황 정보(통계 소개 → 그래프) + 프로젝트 설명: "이 프로젝트는 은둔고립이 얼마나 우리 일상과 가까운지 전달하기 위해 기획되었습니다. 우리가 지고 있는 피자박스는 개인의 실패가 아니라 팍팍한 사회적 구조 속에서 만들어진 짐입니다." 이어서 크레딧(팀 포스트히키코모리 / 서강대학교 아트앤테크놀로지 w/ Kakao Impact + 안무서운회사)과 리플레이 탭.

**현재 코드와의 대응.** 현재 `sketch.js`는 게임 플레이 코어 루프만 구현했고, `phase` 종료 상태는 위 엔딩에 다음과 같이 대응한다:
- `lose`(침대 잠식·박스 과적)는 **하나의 '실패/매몰' 계열 엔딩**이고, `loseReason`(`'bed'` | `'crushed'`)은 엔드카드 **멘트만** 달리 띄우는 분기다(침대 매몰 텍스트 vs 박스에 짓눌림 텍스트). 현재 코드 구조(같은 `lose` phase + `loseReason`별 텍스트)가 이 설계와 그대로 맞다. [둘러보기]가 박스를 줄여주므로 박스 과적(crush) 패배를 회피하는 수단이 된다.
- `win`(문 도달)은 본편에서 **[둘러보기] 사용 여부에 따라 "혼자 클리어"와 "둘러보기 후 클리어" 두 엔딩으로 분기**된다 → 둘러보기 사용 플래그를 추적해야 한다.
- "본편" 기능 = **[둘러보기] → 줌아웃(아파트, 연대) → 플레이 복귀(박스 감소)** 흐름. (sketch.js 엔드카드 힌트가 아직 "HELP → 줌아웃"으로 적혀 있는데, 본편 반영 시 [둘러보기] 흐름으로 갱신 필요.)

## 현재 진행 상황 (Progress)

> 세션 누적 작업 요약 — 위 기획 대비 무엇이 코드에 들어왔는지. 구조 세부는 아래 Architecture 참고.

**구현 완료**
- **가로 화면 전환.** 세로 폰 컬럼 → 가로 뷰포트 풀스크린. `recomputeLayout()`이 16:9 기준(`S = min(W/640, H/360)`)으로 스케일하고, 조작 버튼은 우측 세로 패널(`PANEL_LEFT`/`PANEL_W`)에 배치. 세로로 들면 `drawRotateHint()`로 가로 회전을 유도(별도 세로 레이아웃 없음).
- **오프닝 5슬라이드** (`'title'`). 히어로(로고 이미지) → 랜딩 카피 → HOW TO PLAY(중앙) → +조작표 → +게임 시작 버튼. 피그마 `opening` 프레임 기반(네이비 `#04216c`, 흰 텍스트), 탭으로 진행. 마지막 슬라이드에서 `startGame()`.
- **폰트·이미지 로딩 시스템.** `preload()`에서 `FONTS`(KBL Jump 5종 + EF_MACHO + Galmuri11)와 `IMAGES`(로고) 로드. `loadFont`/`loadImage`가 fetch 기반이라 **http 서빙 필수**.
- **코어 게임 루프** (기존). `countdown → playing → win|lose`: 자동 드리프트, 3초마다 박스 누적, 잠시 쉬기, 침대 매몰(`'bed'`)·박스 과적(`'crushed'`) 패배.
- **둘러보기 / 아파트뷰** (`'lookaround'`). 박스 4개↑ 또는 침대 근처(왼쪽 2/5) 도달 시 버튼 등장 → 줌아웃 아파트(3×2 그리드) 연출 → 박스 일부 감소 후 플레이 복귀. `usedLookAround` 플래그 추적.

**미구현 / 다음 (기획 대비)**
- **게임 플레이 메인 UI** — 플레이 화면 아트가 전부 코드 도형(스프라이트 미사용). 피그마 `플레이화면 메인UI.png` 등 디자인 미적용. 캐릭터 스프라이트·배경·박스·문 에셋은 `src/`(아래 "에셋")에 있음.
- **엔딩 화면** — `drawEndCard()`는 임시 플레이스홀더(힌트가 구버전 "HELP" 문구). 피그마 엔딩 디자인 + 3갈래 분기 미적용. 특히 **`win`이 아직 `usedLookAround`로 "혼자 클리어 / 둘러보기 후 클리어"를 분기하지 않음**(플래그만 추적 중).
- **메세지 전달 파트(part 3)** — 통계·그래프·크레딧·리플레이 전무.
- **오프닝 자동 진행** — 현재 탭 수동. 전시 타이밍(80초)에 맞춘 자동 넘김은 옵션으로 검토 가능.
- **모바일 폰트 경량화** — Galmuri11 TTF가 ~5MB. 배포 시 woff2 `@font-face`(패밀리명 `textFont`) 전환 권장(단 비동기 로드라 준비 게이팅 필요).

**에셋 (`src/`).** 디자인 출처는 피그마 한 파일(fileKey `HlE01fkpGj99tgLTxBr3er`, `opening` 프레임 노드 `5:237`). 실제 에셋: `src/폰트/`(KBLJump, EF_MACHO, Galmuri-v2, NEXON), `src/화면 UI/`(로고, 히어로샷, 플레이화면 메인UI, 엔딩페이지, 둘러보기 UI 등), `src/캐릭터 스프라이트/`, `src/게임 오브젝트/`(침대·문·피자박스·배경), `src/버튼/`. 새 화면 작업 시 여기서 에셋을 찾고, 피그마에서 해당 노드를 대조할 것.

## Running

No build step, no package manager — but you **must serve over http** (not `file://`): `preload()` fetches fonts/images from `src/`, and browsers block those over `file://`.

```bash
python3 -m http.server 8000   # then visit http://localhost:8000
```

The team also uses the VSCode **Live Server** extension (default `http://127.0.0.1:5500`).

p5.js v1.10.0 and p5.sound are vendored in `libraries/` and loaded via `<script>` tags in `index.html` — there are no remote/CDN dependencies (fonts/images load from `src/` at runtime). `jsconfig.json` only wires up p5 type hints for the editor; it is not a build config.

## Architecture

Everything lives in `sketch.js` (p5 global mode). Three concerns to know before editing:

**Phase state machine.** A single `phase` string (`'title'` → `'countdown'` → `'playing'` → `'win'` | `'lose'`, with `'lookaround'` branching off `'playing'`) drives the whole game. `draw()` is the dispatcher: it short-circuits to the opening (`'title'`) or, in any other phase, to a rotate-hint when the device is held portrait; otherwise it calls the matching `step*()` updater, renders the scene/HUD, then layers phase-specific overlays. State transitions happen *inside* the `step*()` functions (e.g. `stepPlaying()` flips `phase` to `'win'`/`'lose'`). `setup()` enters `'title'`; `resetGame()` restores all mutable state and is called on tap from an end card (replay skips the title, going straight to countdown).

**Opening (`'title'`).** A 5-slide onboarding (navy `#04216c`, white text): `titleSlide` 0 = hero (`IMAGES.logo` = `로고.png` lockup), 1 = landing copy, 2 = centered "HOW TO PLAY", 3 = "HOW TO PLAY" + controls table, 4 = table + "▶ 게임 시작하기". Slides 1-4 are ported from the Figma `opening` frame. A tap advances `titleSlide` (count = `TITLE_SLIDES`); on the last slide it calls `startGame()` → `'countdown'`. Slide art uses `openingBox()` (fits the 2614×1206 design frame into the viewport) plus the loaded fonts/images; `textTracked()` does letter-spacing manually. Edit slides in `drawSlideHero()` / `drawSlideLanding()` / `drawSlideHowToTitle()` / `drawSlideHowTo()`.

**Fonts & images.** `preload()` loads `FONTS` (KBL Jump family + `macho` = EF_MACHO + `galmuri` = Galmuri11) from `src/폰트/…` and `IMAGES` (e.g. `IMAGES.logo`) from `src/화면 UI/…`. Opening uses `FONTS.macho` (Korean headings/labels/button), `FONTS.kblExtended` ("HOW TO PLAY"), `FONTS.galmuri` (body). `loadFont`/`loadImage` are fetch-based (fonts: TTF only, no woff2) so the page **must be served over http** (Live Server / `python3 -m http.server`), not opened as `file://`. `startGame()` resets `textFont('sans-serif')` so gameplay text keeps the default font — gameplay art is still code-drawn and unfonted.

**Landscape-only.** The game is designed for a landscape viewport. `isPortrait()` (reads `window.innerWidth/innerHeight` live) gates everything: any portrait hold (title or in-game) shows `drawRotateHint()` (navy, rotated 90°) to nudge the user to turn the device. There is no portrait layout — keep new screens landscape and route any portrait handling through this path.

**Adaptive layout + art scale.** `recomputeLayout()` (called from `setup()` and `windowResized()`) fills the viewport (`W`/`H`) and derives a scale factor `S = min(W / 640, H / 360)` — a 16:9 landscape design reference (`DESIGN_W`/`DESIGN_H`). **Every drawn coordinate and size is multiplied by `S`** — keep this convention when adding art, and use the precomputed layout globals (`ROOM_TOP`, `ROOM_BOTTOM`, `PLAYER_RANGE_LEFT/RIGHT`, and `PANEL_LEFT`/`PANEL_W` for the right-hand control panel) rather than hardcoding positions. The play area is the region left of `PANEL_LEFT`; the controls live in the right panel.

**`playerX` is normalized progress (0..1), not pixels.** `0` = bed (lose: `'bed'`), `1` = door (win). It's mapped to a screen X via `lerp(PLAYER_RANGE_LEFT, PLAYER_RANGE_RIGHT, playerX)` only at draw time. `AUTO_DRIFT_PER_SEC` decreases it each frame (unless **잠시 쉬기 / rest** is held); each forward tap adds `FORWARD_PER_TAP` divided by box weight. A third lose path triggers when `boxCount >= MAX_BOX_COUNT` (`'crushed'`).

**Tuning lives in the `--- 밸런스 수치 ---` constants block** at the top of `sketch.js` (drift rate, tap distance, box penalty/interval/cap). Adjust gameplay difficulty there.

**Input is unified.** `handlePress(x, y)` / `handleRelease()` hold all the logic; the p5 `mousePressed`/`touchStarted` (and the release pair) handlers just forward into them and `return false` to suppress browser gestures. Add new input handling in `handlePress`, not in the individual event callbacks. `handlePress` also handles the title tap (start only when landscape). Button hit areas come from `forwardBtn()` / `restBtn()` — now positioned inside the right control panel (앞으로 = large, lower; 잠시 쉬기 = small, upper) — which also define where they're drawn, tested via `inRect()`.

## Conventions

- Keep UI strings and gameplay comments in Korean to match the existing codebase.
- The end cards reference planned "본편" (full version) features — zoom-out, multi-room, and a mid-game **[둘러보기]** button (which replaces the older HELP idea). These are the product direction, not existing code; see "전체 유저 경험" above for the current design. Note: the live design diverges from the 5/25 Figma here — [둘러보기] is a mid-game relief button that loops back into play (boxes reduced), not an ending trigger.
