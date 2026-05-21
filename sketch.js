// =============================================
// sketch.js — 게임의 심장
// =============================================

let phase = PHASE_LOBBY;
let gameTimer = 0;
let betrayalTriggered = false;
let winner = null;

// 솔로 페이즈 (한 명 사망 시)
let soloTimer = 0;          // 솔로 제한 20초 카운트다운
let deadPlayerId = null;    // 죽은 플레이어 ID

function setup() {
  createCanvas(CANVAS_W, CANVAS_H);
  frameRate(FRAME_RATE);
  textFont('monospace');
  resetGame();
}

function resetGame() {
  initGrid();
  initZombies();
  initPlayers();
  initTiles(this);
  gameTimer = GAME_TOTAL_TIME * FRAME_RATE;
  betrayalTriggered = false;
  winner = null;
  betrayalAnnounceFade = 0;
  soloTimer = 0;
  deadPlayerId = null;
  notifications = [];
  phase = PHASE_LOBBY;
}

function draw() {
  background(COLOR_EMPTY);

  if (phase === PHASE_LOBBY) { drawLobby(this); return; }

  if (phase === PHASE_END) {
    drawGrid(this); drawZombies(this);
    playerA.draw(this); playerB.draw(this);
    drawResultScreen(this, countTiles(), winner);
    return;
  }

  // ── 게임 진행 ──
  gameTimer--;
  const timeLeftSec = gameTimer / FRAME_RATE;

  // 배신 타이머 발동 체크
  if (!betrayalTriggered && timeLeftSec <= BETRAYAL_TRIGGER_TIME) {
    _triggerBetrayal();
  }

  updateTiles(this);
  updateZombies([playerA, playerB], this);
  playerA.update(playerB, zombies, phase, this);
  playerB.update(playerA, zombies, phase, this);

  _checkEndConditions(timeLeftSec);

  // 렌더링
  drawGrid(this);
  drawTiles(this);
  drawZombies(this);
  playerA.draw(this); playerB.draw(this);
  drawBetrayalAnnounce(this);
  drawUI(this, phase, timeLeftSec, countTiles());
}

function _triggerBetrayal() {
  betrayalTriggered = true;
  phase = PHASE_BETRAYAL;
  const pA = playerA.alive ? { r: playerA.r, c: playerA.c } : { r: Math.floor(ROWS/2)-2, c: Math.floor(COLS/2) };
  const pB = playerB.alive ? { r: playerB.r, c: playerB.c } : { r: Math.floor(ROWS/2)+2, c: Math.floor(COLS/2) };
  voronoiSplit(pA, pB);
  playerA.setPhase(PHASE_BETRAYAL);
  playerB.setPhase(PHASE_BETRAYAL);
  for (const t of playerA.tail) setOwner(t.r, t.c, OWNER_A);
  for (const t of playerB.tail) setOwner(t.r, t.c, OWNER_B);
  showBetrayalAnnounce(this);
}

function _checkEndConditions(timeLeftSec) {
  if (gameTimer <= 0) { _endGame('timer'); return; }
  if (!playerA.alive && !playerB.alive) { _endGame('both_dead'); return; }

  // ── 솔로 페이즈 처리 (배신 전, 한 명 사망) ──
  if (phase === PHASE_COOP) {
    const aDead = !playerA.alive;
    const bDead = !playerB.alive;

    if (aDead || bDead) {
      // 솔로 페이즈 진입
      if (phase !== PHASE_SOLO) {
        phase = PHASE_SOLO;
        deadPlayerId = aDead ? 'A' : 'B';
        soloTimer = SOLO_TIME_LIMIT * FRAME_RATE; // 20초
        showNotification(
          aDead ? 'B' : 'A',
          `P${deadPlayerId} 사망! ${SOLO_TIME_LIMIT}초 후 부활 & 배신 타이머 30초 발동!`,
          '#FF9800'
        );
      }
    }
  }

  if (phase === PHASE_SOLO) {
    soloTimer--;
    if (soloTimer <= 0) {
      // 죽은 플레이어 부활
      _reviveDeadPlayer();
    }
  }

  // 배신 페이즈 한 명 사망
  if (phase === PHASE_BETRAYAL) {
    if (!playerA.alive && playerB.alive) { winner = 'B'; phase = PHASE_END; return; }
    if (!playerB.alive && playerA.alive) { winner = 'A'; phase = PHASE_END; return; }
  }
}

function _reviveDeadPlayer() {
  const counts = countTiles();
  const midR = Math.floor(ROWS / 2);
  const midC = Math.floor(COLS / 2);

  // 살아있는 플레이어 영역의 절반을 죽은 플레이어에게 할당
  const survivor = deadPlayerId === 'A' ? playerB : playerA;
  const dead     = deadPlayerId === 'A' ? playerA : playerB;

  // Voronoi로 현재 팀 영역 분할 (살아있는 플레이어 위치 기준)
  const survivorPos = { r: survivor.r, c: survivor.c };
  const deadSpawnR = midR + (deadPlayerId === 'A' ? -3 : 3);
  const deadSpawnC = midC;
  const deadPos = { r: deadSpawnR, c: deadSpawnC };

  // 팀 영역 Voronoi 분할로 절반씩
  voronoiSplit(deadPos, survivorPos);

  // 죽은 플레이어 부활
  const deadOwner = deadPlayerId === 'A' ? OWNER_A : OWNER_B;
  dead.revive(deadSpawnR, deadSpawnC, deadOwner);
  dead.setPhase(PHASE_BETRAYAL);

  // 살아있는 플레이어도 배신 페이즈로
  survivor.setPhase(PHASE_BETRAYAL);
  const survivorOwner = deadPlayerId === 'A' ? OWNER_B : OWNER_A;

  // 배신 타이머 30초로 세팅
  gameTimer = EMERGENCY_BETRAYAL_TIME * FRAME_RATE;
  betrayalTriggered = true;
  phase = PHASE_BETRAYAL;
  deadPlayerId = null;

  showBetrayalAnnounce(this);
  showNotification('A', '부활! 배신 타이머 30초 발동!', '#FF5252');
}

function _endGame(reason) {
  phase = PHASE_END;
  const counts = countTiles();
  if (reason === 'timer') {
    if (counts.A > counts.B) winner = 'A';
    else if (counts.B > counts.A) winner = 'B';
    else winner = 'draw';
  } else {
    winner = 'zombie';
  }
}

function keyPressed() {
  if (phase === PHASE_LOBBY && keyCode === 32) { phase = PHASE_COOP; return; }
  if (phase === PHASE_END && (key === 'r' || key === 'R')) { resetGame(); return; }
  if (phase === PHASE_COOP || phase === PHASE_SOLO || phase === PHASE_BETRAYAL) {
    playerA.handleKeyPressed(keyCode);
    playerB.handleKeyPressed(keyCode);
  }
}

function mousePressed() {
  const cx = CANVAS_W / 2, cy = CANVAS_H / 2;
  if (phase === PHASE_END &&
      mouseX > cx-80 && mouseX < cx+80 && mouseY > cy+60 && mouseY < cy+98) {
    resetGame();
  }
  if (phase === PHASE_LOBBY &&
      mouseX > cx-100 && mouseX < cx+100 && mouseY > cy+90 && mouseY < cy+136) {
    phase = PHASE_COOP;
  }
}
