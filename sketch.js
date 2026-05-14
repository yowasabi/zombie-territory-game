// 메인 파일 — 팀장 관리
let grid, playerA, playerB, zombies;
let gamePhase = 'cooperation';
let timeLeft;

function setup() {
  createCanvas(COLS * TILE_SIZE, ROWS * TILE_SIZE);
  frameRate(30);
  resetGame();
}

function draw() {
  background(30);
  timeLeft -= 1 / frameRate();

  // 배신 페이즈 전환
  if (timeLeft <= BETRAYAL_TIME && gamePhase === 'cooperation') {
    gamePhase = 'betrayal';
    splitTerritory(playerA, playerB);
  }

  // 게임 종료
  if (timeLeft <= 0) {
    drawResult(playerA, playerB);
    noLoop();
    return;
  }

  movePlayer(playerA);
  movePlayer(playerB);
  checkCollision(playerA, playerB, zombies, gamePhase);
  checkCollision(playerB, playerA, zombies, gamePhase);

  for (let z of zombies) {
    updateZombie(z, [playerA, playerB]);
  }

  checkSpecialTiles(playerA);
  checkSpecialTiles(playerB);

  drawGrid(grid);
  drawPlayers(playerA, playerB);
  drawZombies(zombies);
  drawSpecialTiles();
  drawHUD(playerA, playerB, timeLeft, gamePhase);
}

function resetGame() {
  timeLeft = GAME_DURATION;
  gamePhase = 'cooperation';
  grid = initGrid(COLS, ROWS);
  playerA = createPlayer('A');
  playerB = createPlayer('B');
  zombies = [];
  for (let i = 0; i < ZOMBIE_COUNT; i++) {
    spawnZombie(floor(random(COLS)), floor(random(ROWS)));
  }
}
