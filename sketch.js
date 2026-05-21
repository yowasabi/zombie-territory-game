// =============================================
// sketch.js — 게임의 심장
//   setup(), draw() — 모든 함수를 여기서 호출
// =============================================

// ── 게임 상태 ──
let phase = PHASE_LOBBY;
let gameTimer = 0;       // 남은 프레임
let betrayalTriggered = false;
let winner = null;

// ── p5.js setup ──
function setup() {
  createCanvas(CANVAS_W, CANVAS_H);
  frameRate(FRAME_RATE);
  textFont('monospace');
  resetGame();
}

// ── 게임 초기화 ──
function resetGame() {
  initGrid();
  initZombies();
  initPlayers();
  initTiles(this);
  gameTimer = GAME_TOTAL_TIME * FRAME_RATE;
  betrayalTriggered = false;
  winner = null;
  betrayalAnnounceFade = 0;
  phase = PHASE_LOBBY;
}

// ── p5.js draw (메인 루프) ──
function draw() {
  background(COLOR_EMPTY);

  // ── 로비 ──
  if (phase === PHASE_LOBBY) {
    drawLobby(this);
    return;
  }

  // ── 게임 종료 ──
  if (phase === PHASE_END) {
    drawGrid(this);
    drawZombies(this);
    playerA.draw(this);
    playerB.draw(this);
    const counts = countTiles();
    drawResultScreen(this, counts, winner);
    return;
  }

  // ── 게임 진행 중 (COOP / BETRAYAL) ──

  // 1. 타이머 감소
  gameTimer--;
  const timeLeftSec = gameTimer / FRAME_RATE;

  // 2. 배신 타이머 발동 체크
  if (!betrayalTriggered && timeLeftSec <= BETRAYAL_TRIGGER_TIME) {
    betrayalTriggered = true;
    phase = PHASE_BETRAYAL;
    voronoiSplit({ r: playerA.r, c: playerA.c }, { r: playerB.r, c: playerB.c });
    playerA.setPhase(PHASE_BETRAYAL);
    playerB.setPhase(PHASE_BETRAYAL);
    for (const t of playerA.tail) setOwner(t.r, t.c, OWNER_A);
    for (const t of playerB.tail) setOwner(t.r, t.c, OWNER_B);
    showBetrayalAnnounce(this);
  }

  // 3. 특수 타일 업데이트
  updateTiles(this);

  // 4. 좀비 업데이트
  updateZombies([playerA, playerB], this);

  // 5. 플레이어 업데이트
  playerA.update(playerB, zombies, phase, this);
  playerB.update(playerA, zombies, phase, this);

  // 6. 승패 판정
  _checkEndConditions(timeLeftSec);

  // ── 렌더링 ──
  drawGrid(this);
  drawTiles(this);
  drawZombies(this);
  playerA.draw(this);
  playerB.draw(this);
  drawBetrayalAnnounce(this);
  const counts = countTiles();
  drawUI(this, phase, timeLeftSec, counts);
}

function _checkEndConditions(timeLeftSec) {
  // 타이머 종료
  if (gameTimer <= 0) {
    _endGame('timer');
    return;
  }

  // 두 플레이어 모두 사망
  if (!playerA.alive && !playerB.alive) {
    _endGame('both_dead');
    return;
  }

  // 한 명 사망 (배신 페이즈)
  if (phase === PHASE_BETRAYAL) {
    if (!playerA.alive && playerB.alive) {
      winner = 'B'; phase = PHASE_END; return;
    }
    if (!playerB.alive && playerA.alive) {
      winner = 'A'; phase = PHASE_END; return;
    }
  }

  // 협력 페이즈에서 둘 다 사망해야 팀 패배 (한 명은 계속 진행)
  // (두 플레이어 모두 사망은 위 _endGame('both_dead')에서 처리)
}

function _endGame(reason) {
  phase = PHASE_END;
  const counts = countTiles();

  if (reason === 'timer') {
    if (counts.A > counts.B) winner = 'A';
    else if (counts.B > counts.A) winner = 'B';
    else winner = 'draw';
  } else if (reason === 'both_dead') {
    winner = 'zombie';
  }
}

// ── 키 입력 ──
function keyPressed() {
  if (phase === PHASE_LOBBY && keyCode === 32) {
    phase = PHASE_COOP;
    return;
  }
  if ((phase === PHASE_END) && (key === 'r' || key === 'R' || keyCode === 82)) {
    resetGame();
    return;
  }
  if (phase === PHASE_COOP || phase === PHASE_BETRAYAL) {
    playerA.handleKeyPressed(keyCode);
    playerB.handleKeyPressed(keyCode);
  }
}

// ── 마우스 클릭 (결과 화면 재시작 버튼) ──
function mousePressed() {
  if (phase === PHASE_END) {
    const cx = CANVAS_W / 2;
    const cy = CANVAS_H / 2;
    if (mouseX > cx - 70 && mouseX < cx + 70 && mouseY > cy + 65 && mouseY < cy + 101) {
      resetGame();
    }
  }
  if (phase === PHASE_LOBBY) {
    const cx = CANVAS_W / 2;
    const cy = CANVAS_H / 2;
    if (mouseX > cx - 90 && mouseX < cx + 90 && mouseY > cy + 100 && mouseY < cy + 144) {
      phase = PHASE_COOP;
    }
  }
}
