/* ============================================================
   script.js - 작동하도록 수정된 전체 게임 로직 (주석 풍부)
   - 가로 진행(오른쪽으로 전진)
   - 플레이어 1명 + AI 19명 (총 20대)
   - AI는 플레이어 최대 속도와 거의 비슷하게 설정
   - AI는 주행 중 흔들리며 가끔 도로를 이탈(탈락)
   - 모든 AI가 사라지면 플레이어 승리, 플레이어가 도로 이탈하면 게임오버
   ============================================================ */

/* ============================
   캔버스 초기화
   ============================ */
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

// 캔버스의 실제 픽셀 크기(HTML 속성과 일치해야 합니다)
const CANVAS_W = canvas.width;
const CANVAS_H = canvas.height;

/* ============================
   게임 설정값 (조절 가능)
   ============================ */
const PLAYER_MAX_SPEED = 8;      // 플레이어 최고 속도 (픽셀/프레임 단위로 간단히 사용)
const AI_COUNT = 19;             // AI 대수
const TOTAL_CARS = 1 + AI_COUNT; // 총 자동차 수

// 도로(횡방향으로 길게) - 도로는 캔버스 중앙 수직으로 펼쳐짐
const ROAD_CENTER_Y = CANVAS_H / 2;   // 도로 중앙 Y 위치
const ROAD_HEIGHT = 360;              // 도로 높이 (차들이 머물 수 있는 영역)
const ROAD_TOP = ROAD_CENTER_Y - ROAD_HEIGHT / 2;
const ROAD_BOTTOM = ROAD_CENTER_Y + ROAD_HEIGHT / 2;

// 화면 내에서 플레이어가 보이는 x 위치 (플레이어는 화면 왼쪽 약간에 고정)
const PLAYER_SCREEN_X = 200;

/* ============================
   게임 상태 변수
   ============================ */
let keys = {};        // 눌린 키 보관 (키보드 입력)
let gameOver = false; // 게임 종료 여부
let cameraX = 0;      // 카메라 X 좌표 (player.x 에 따라 변함)

/* ============================
   차량 클래스 정의
   ============================ */
class Car {
  constructor(initX, initY, color, isPlayer = false) {
    // 물리/상태
    this.x = initX;         // '전진' 좌표 (우측이 증가)
    this.y = initY;         // 화면상의 세로 위치 (차선)
    this.width = 36;        // 화면에서 그릴 때의 차 너비
    this.height = 18;       // 차 높이
    this.color = color;
    this.isPlayer = isPlayer;

    // 속도 관련
    this.speed = isPlayer ? 0 : (PLAYER_MAX_SPEED * (0.6 + Math.random() * 0.4)); // 초기 속도
    this.maxSpeed = isPlayer ? PLAYER_MAX_SPEED : PLAYER_MAX_SPEED * (0.95 + Math.random() * 0.06);

    // AI 특성: 컨트롤(0~1, 1이면 안정적), drift(흔들림 크기), seed(난수 패턴)
    this.control = isPlayer ? 1.0 : (0.7 + Math.random() * 0.3);
    this.drift = isPlayer ? 0 : (4 + Math.random() * 8);
    this.seed = Math.random() * 1000;

    this.alive = true;    // 도로 이탈 등으로 탈락했는지 여부
  }

  // 매 프레임 상태 업데이트
  update() {
    if (!this.alive) return;

    if (this.isPlayer) {
      // ========== 플레이어 입력에 따른 속도/위치 변화 ==========
      if (keys["ArrowUp"]) {
        this.speed = Math.min(this.speed + 0.28, this.maxSpeed);
      } else {
        // 가속키가 없으면 약간 감속(관성)
        this.speed = Math.max(this.speed - 0.12, 0);
      }
      if (keys["ArrowDown"]) {
        this.speed = Math.max(this.speed - 0.5, 0);
      }

      // 좌/우 키로 세로 방향 이동 -> 차선 변경처럼 동작
      if (keys["ArrowLeft"])  this.y -= 4; // 위 방향(차선 위)
      if (keys["ArrowRight"]) this.y += 4; // 아래 방향(차선 아래)

      // 플레이어가 너무 위/아래로 벗어나지 않게 제한
      const margin = 8;
      this.y = Math.max(ROAD_TOP + margin + this.height/2, Math.min(ROAD_BOTTOM - margin - this.height/2, this.y));

      // 전진 (x 증가)
      this.x += this.speed;
    } else {
      // ========== AI의 자동 주행 ==========
      // AI는 목표 속도(maxSpeed)로 천천히 가까워짐 (간단한 가속 모델)
      this.speed += (this.maxSpeed - this.speed) * 0.01; // 서서히 목표 속도로
      // AI는 선호 차선(설정된 초기 y)으로 약간 복귀하려 함
      // (여기서는 target lane을 따로 저장하지 않았으므로 간단히 '중앙으로 향하는 성향' 사용)
      // 흔들림: 사인 함수 + 난수로 좌우로 요동 -> 일부는 통제가 약해 도로를 벗어날 수 있음
      const sinWave = Math.sin((this.x + this.seed) * 0.02) * this.drift * (1 - this.control);
      this.y += ( (ROAD_CENTER_Y + (Math.random()-0.5)*8) - this.y ) * 0.01; // 약한 복귀력
      this.y += sinWave * 0.06 + (Math.random() - 0.5) * 0.6; // 요동 추가

      // 전진
      this.x += this.speed;

      // ========== 충돌/탈락(간단한 확률 + 도로 이탈) ==========
      // - 컨트롤이 낮을수록(=난폭) 조금씩 사고 확률이 증가
      // - 확률은 속도와 연동 (빠를수록 위험)
      const crashProb = 0.00012 * (1 - this.control) * (this.speed / this.maxSpeed + 0.2);
      if (Math.random() < crashProb) {
        // 무작위로 크게 흔들려 도로 밖으로 나가게 만듬
        this.y += (Math.random() - 0.5) * 200;
      }
    }

    // 도로 범위 밖으로 나가면 '탈락' 처리
    const topLimit = ROAD_TOP + this.height / 2;
    const bottomLimit = ROAD_BOTTOM - this.height / 2;
    if (this.y < topLimit || this.y > bottomLimit) {
      this.alive = false;
    }
  }

  // 화면에 그리기 (카메라X를 반영해야 한다)
  draw(cameraX) {
    if (!this.alive) return;

    // 카메라를 반영한 화면 x 좌표 계산
    const screenX = Math.round((this.x - cameraX) + PLAYER_SCREEN_X);

    // 차량이 화면 밖으로 완전히 나가면 그리지 않음 (성능)
    if (screenX < -100 || screenX > CANVAS_W + 100) return;

    // 단순한 자동차 도형: 직사각형 + 창문 표시
    ctx.save();
    // 그림자 느낌
    ctx.fillStyle = "rgba(0,0,0,0.25)";
    ctx.fillRect(screenX - this.width/2 + 3, this.y - this.height/2 + 3, this.width, this.height);

    // 본체
    ctx.fillStyle = this.color;
    ctx.fillRect(screenX - this.width/2, this.y - this.height/2, this.width, this.height);

    // 앞 유리(간단한 디테일)
    ctx.fillStyle = "rgba(255,255,255,0.2)";
    ctx.fillRect(screenX - this.width/6, this.y - this.height/3, this.width/3, this.height/3);
    ctx.restore();
  }
}

/* ============================
   차량 초기 배치 (충분히 도로 내부로 위치)
   - 핵심 버그 수정: 이전 코드에서는 y값(세로)이 도로 바깥(예: 500, 600 등)으로 설정돼
     첫 업데이트에서 바로 alive=false가 되어버렸습니다. (이게 "작동 안함"의 원인)
   - 여기서는 의도적으로 모든 차의 초기 y를 도로 내부(ROAD_TOP..ROAD_BOTTOM)로 설정합니다.
   ============================ */

// 차들을 담을 배열
const cars = [];

// 플레이어 초기 위치: x=0 (출발선), y는 도로 중앙 근처(중간 라인)
const playerStartY = ROAD_CENTER_Y;
const player = new Car(0, playerStartY, "crimson", true);
cars.push(player);

// AI 배치 전략:
// - laneCount 개의 차선(세로 위치)을 만들고, 각 차선에 여러 대를 뒤로 서로간격을 두고 배치
// - 이렇게 하면 게임 시작 시 차들이 즉시 도로 밖으로 나가 탈락하지 않습니다.
const laneCount = 6;
const laneGap = ROAD_HEIGHT / (laneCount + 1);

// AI를 laneCount개 차선에 순차적으로 배치
for (let i = 0; i < AI_COUNT; i++) {
  const laneIndex = i % laneCount;
  // lane Y 위치: ROAD_TOP + (laneIndex+1) * laneGap
  const laneY = ROAD_TOP + (laneIndex + 1) * laneGap;

  // 각 차선에 여러 대가 있을 경우 뒤로 빼놓음 (x가 음수: 출발선 뒤)
  // floor(i / laneCount) 만큼 뒤로 밀어 시작
  const behindOffset = Math.floor(i / laneCount) * 60 + 80; // 80~...
  const startX = -behindOffset; // 출발선(0)보다 뒤에서 출발

  // 색상 반복 사용
  const palette = ["dodgerblue","gold","fuchsia","limegreen","darkorange","cyan","magenta","peru","hotpink","turquoise"];
  const color = palette[i % palette.length];

  const aiCar = new Car(startX, laneY, color, false);

  cars.push(aiCar);
}

/* ============================
   입력(키보드) 이벤트
   ============================ */
document.addEventListener("keydown", (e) => {
  keys[e.key] = true;

  // 스페이스나 엔터를 눌러도 브라우저이동 방지할 수 있음(옵션)
  if (["ArrowUp","ArrowDown","ArrowLeft","ArrowRight"].includes(e.key)) {
    e.preventDefault();
  }
});
document.addEventListener("keyup", (e) => {
  keys[e.key] = false;
});

/* ============================
   HUD 엘리먼트 (속도, 남은 AI 수, 결과 텍스트, 재시작 버튼)
   ============================ */
const speedDisplay = document.getElementById("speedDisplay");
const aliveAIDisplay = document.getElementById("aliveAIDisplay");
const resultEl = document.getElementById("result");
const restartBtn = document.getElementById("restartBtn");

restartBtn.addEventListener("click", () => {
  // 간단한 재시작: 페이지를 새로고침
  window.location.reload();
});

/* ============================
   메인 루프: requestAnimationFrame 사용
   - 카메라X는 플레이어의 x에 따라 이동하여 '플레이어가 화면 왼쪽 고정' 효과를 줌
   ============================ */
function gameLoop() {
  if (gameOver) return;

  // 1) 업데이트
  cars.forEach(car => car.update());

  // 2) 카메라 위치 결정: 플레이어.x 기준
  cameraX = player.x - PLAYER_SCREEN_X;

  // 3) 그리기: 배경, 도로, 차들, HUD
  // 배경 초기화
  ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);

  // 약간의 배경 그래디언트(심도감)
  const g = ctx.createLinearGradient(0, 0, 0, CANVAS_H);
  g.addColorStop(0, "#313843");
  g.addColorStop(1, "#22272d");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

  // 도로 바탕(회색 직사각형)
  ctx.fillStyle = "#4a545e";
  ctx.fillRect(0, ROAD_TOP, CANVAS_W, ROAD_HEIGHT);

  // 도로 중앙선 (점선) — 가로방향 진행이므로 중앙선을 세로로 점선 표시
  ctx.strokeStyle = "rgba(255,255,255,0.45)";
  ctx.lineWidth = 3;
  ctx.setLineDash([12, 18]);
  // 수직 점선을 중앙에 여러 개 그려서 원근감
  for (let i = -500; i < 5000; i += 120) {
    const xOnScreen = Math.round(i - cameraX + PLAYER_SCREEN_X);
    ctx.beginPath();
    ctx.moveTo(xOnScreen, ROAD_TOP + 8);
    ctx.lineTo(xOnScreen, ROAD_BOTTOM - 8);
    ctx.stroke();
  }
  ctx.setLineDash([]); // 점선 해제

  // 차선(시각적 보조선): 가로(차선은 세로로 나뉘는 형태)
  ctx.strokeStyle = "rgba(255,255,255,0.06)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let i = 1; i < laneCount + 1; i++) {
    const y = Math.round(ROAD_TOP + i * (ROAD_HEIGHT / (laneCount + 1)));
    ctx.moveTo(0, y);
    ctx.lineTo(CANVAS_W, y);
  }
  ctx.stroke();

  // 차량 그리기 (플레이어 포함)
  cars.forEach(car => car.draw(cameraX));

  // 4) HUD 업데이트: 속도, 남은 AI 수
  const aliveAIcount = cars.reduce((acc, c) => acc + (c.alive && !c.isPlayer ? 1 : 0), 0);
  speedDisplay.textContent = `속도: ${Math.round(player.speed * 10) / 10}`;
  aliveAIDisplay.textContent = `남은 AI: ${aliveAIcount}`;

  // 5) 게임 종료 조건
  const playerAlive = player.alive;
  if (!playerAlive) {
    resultEl.textContent = "🚨 게임 오버! (플레이어가 도로를 이탈했습니다)";
    gameOver = true;
    return;
  }
  if (aliveAIcount === 0) {
    resultEl.textContent = "🏆 플레이어 승리! 모든 AI가 탈락했습니다.";
    gameOver = true;
    return;
  }

  // 다음 프레임 요청
  requestAnimationFrame(gameLoop);
}

// 게임 시작
requestAnimationFrame(gameLoop);
