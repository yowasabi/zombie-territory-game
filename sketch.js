// sketch.js

let phase = PHASE_LOBBY;
let gameTimer = 0;
let betrayalTriggered = false;
let winner = null;
let soloTimer = 0;
let deadPlayerId = null;
let betrayalAnnounceFade = 0;
let showHowto = false;

// ── 아이디 / 계정 시스템
let accounts = {};
let currentUserId = null;

// lobby 서브 상태
let lobbySubState = 'main';
let inputBuffer = '';
let inputError  = '';

let highScore = 0;
let isNewHighScore = false;

// ── 승리 애니메이션 (위에서 아래로 채워지는 스캔라인 방식)
let fillAnimActive = false;
let fillAnimRow = 0;
const FILL_SPEED = 1.25; // 한 프레임에 채워질 행(Row)의 수 (1.5 → 1.25, 약 1.2배 느리게)
let pixelFillColor = '';

// ── 혈흔 파티클 (로비 효과)
let bloodDrops = [];

// ── 사운드 시스템 (Web Audio API)
let audioCtx = null;

function getAudioCtx() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  return audioCtx;
}

// [사운드 변경] 시작 및 다시 시작 버튼: 기괴하고 웅장한 좀비 포효 사운드
function playZombieRoar() {
  try {
    const ctx = getAudioCtx();
    const now = ctx.currentTime;

    // 레이어 1: 거칠고 무거운 디스토션 그로울
    const osc1 = ctx.createOscillator();
    const dist1 = ctx.createWaveShaper();
    const g1 = ctx.createGain();
    const curve = new Float32Array(1024);
    for (let i = 0; i < 1024; i++) {
      const x = (i * 2) / 1024 - 1;
      curve[i] = Math.max(-0.9, Math.min(0.9, x * 12)) * 0.8;
    }
    dist1.curve = curve;
    osc1.type = 'sawtooth';
    osc1.frequency.setValueAtTime(65, now);
    osc1.frequency.linearRampToValueAtTime(32, now + 0.4);
    osc1.frequency.linearRampToValueAtTime(55, now + 0.9);
    osc1.frequency.linearRampToValueAtTime(25, now + 1.5);
    
    g1.gain.setValueAtTime(0, now);
    g1.gain.linearRampToValueAtTime(0.6, now + 0.1);
    g1.gain.setValueAtTime(0.5, now + 1.1);
    g1.gain.linearRampToValueAtTime(0, now + 1.7);
    
    osc1.connect(dist1); dist1.connect(g1); g1.connect(ctx.destination);
    osc1.start(now); osc1.stop(now + 1.8);

    // 레이어 2: 긁히는 숨소리 노이즈
    const sr = ctx.sampleRate;
    const buf = ctx.createBuffer(1, sr * 1.8, sr);
    const d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < d.length; i++) {
      last = last * 0.95 + (Math.random() * 2 - 1) * 0.05;
      d[i] = last * 10 + (Math.random() * 2 - 1) * 0.2;
    }
    const noiseSrc = ctx.createBufferSource();
    noiseSrc.buffer = buf;
    
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(350, now);
    lp.frequency.linearRampToValueAtTime(150, now + 1.6);
    lp.Q.value = 6;
    
    const gN = ctx.createGain();
    gN.gain.setValueAtTime(0, now);
    gN.gain.linearRampToValueAtTime(0.3, now + 0.15);
    gN.gain.setValueAtTime(0.2, now + 1.1);
    gN.gain.linearRampToValueAtTime(0, now + 1.7);
    
    noiseSrc.connect(lp); lp.connect(gN); gN.connect(ctx.destination);
    noiseSrc.start(now); noiseSrc.stop(now + 1.8);
  } catch(e) {}
}

// 분위기 있는 주기적 좀비 소리
let ambientTimer = 0;
const AMBIENT_INTERVAL = 300; 

function playAmbientGroan() {
  try {
    const ctx = getAudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(120, ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(80, ctx.currentTime + 0.8);
    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.08, ctx.currentTime + 0.1);
    gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 1.0);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 1.0);
  } catch(e) {}
}

// [사운드 변경] 에너지드링크 캔 따는 소리 (딸깍 툭 - 치이익)
function playSoundDrink() {
  try {
    const ctx = getAudioCtx();
    const now = ctx.currentTime;

    // 1. 캔 탭 따는 소리 (날카로운 금속성 클릭 2방)
    const clickOsc = ctx.createOscillator();
    const clickGain = ctx.createGain();
    clickOsc.type = 'triangle';
    clickOsc.frequency.setValueAtTime(1400, now);
    clickOsc.frequency.setValueAtTime(800, now + 0.03);
    
    clickGain.gain.setValueAtTime(0.3, now);
    clickGain.gain.linearRampToValueAtTime(0.01, now + 0.05);
    
    clickOsc.connect(clickGain);
    clickGain.connect(ctx.destination);
    clickOsc.start(now);
    clickOsc.stop(now + 0.05);

    // 2. 탄산 가스 빠지는 소리 (High-pass Noise)
    const sr = ctx.sampleRate;
    const bufSize = sr * 0.6; // 0.6초 분량
    const buf = ctx.createBuffer(1, bufSize, sr);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) {
      d[i] = Math.random() * 2 - 1;
    }
    const fizzSrc = ctx.createBufferSource();
    fizzSrc.buffer = buf;

    const hpFilter = ctx.createBiquadFilter();
    hpFilter.type = 'highpass';
    hpFilter.frequency.setValueAtTime(6000, now);
    hpFilter.frequency.exponentialRampToValueAtTime(2500, now + 0.5);

    const fizzGain = ctx.createGain();
    fizzGain.gain.setValueAtTime(0, now + 0.01);
    fizzGain.gain.linearRampToValueAtTime(0.25, now + 0.04); // 가스 분출 피크
    fizzGain.gain.exponentialRampToValueAtTime(0.001, now + 0.55);

    fizzSrc.connect(hpFilter);
    hpFilter.connect(fizzGain);
    fizzGain.connect(ctx.destination);
    
    fizzSrc.start(now + 0.01);
    fizzSrc.stop(now + 0.6);
  } catch(e) {}
}

// [사운드 변경] 약(좀비타일) 먹었을 때: 날카롭고 신경질적인 좀비 비명 소리
function playSoundPowerup() {
  try {
    const ctx = getAudioCtx();
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(350, now);
    osc.frequency.linearRampToValueAtTime(650, now + 0.15);
    osc.frequency.exponentialRampToValueAtTime(180, now + 0.4);
    
    // 비명에 바이브레이션 효과 추가 (LFO)
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    lfo.type = 'square';
    lfo.frequency.value = 22; 
    lfoGain.gain.value = 45; 
    lfo.connect(lfoGain);
    lfoGain.connect(osc.frequency);
    lfo.start(now);
    lfo.stop(now + 0.4);

    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.35, now + 0.05);
    gain.gain.linearRampToValueAtTime(0.2, now + 0.2);
    gain.gain.linearRampToValueAtTime(0, now + 0.4);

    // 하이패스 필터로 카랑카랑하게 조절
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 1000;

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    
    osc.start(now);
    osc.stop(now + 0.4);
  } catch(e) {}
}

// [사운드 변경] 피 먹었을 때: 피가 끓어오르며 낮게 크르릉거리는 좀비 소리
function playSoundZombie() {
  try {
    const ctx = getAudioCtx();
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const dist = ctx.createWaveShaper();
    const g = ctx.createGain();
    const c2 = new Float32Array(512);
    for (let i = 0; i < 512; i++) {
      const x = (i * 2) / 512 - 1;
      c2[i] = Math.max(-0.8, Math.min(0.8, x * 8));
    }
    dist.curve = c2;
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(90, now);
    osc.frequency.linearRampToValueAtTime(45, now + 0.4);
    osc.frequency.linearRampToValueAtTime(70, now + 0.7);
    osc.frequency.linearRampToValueAtTime(35, now + 1.0);
    
    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(0.45, now + 0.05);
    g.gain.setValueAtTime(0.3, now + 0.7);
    g.gain.linearRampToValueAtTime(0, now + 1.0);
    
    osc.connect(dist); dist.connect(g); g.connect(ctx.destination);
    osc.start(now); osc.stop(now + 1.0);

    // 끈적거리는 물방울 피치 노이즈 레이어 결합
    const sr = ctx.sampleRate;
    const buf = ctx.createBuffer(1, sr * 0.9, sr);
    const nd = buf.getChannelData(0);
    for (let i = 0; i < nd.length; i++) nd[i] = (Math.random() * 2 - 1);
    const ns = ctx.createBufferSource(); ns.buffer = buf;
    
    const bp = ctx.createBiquadFilter(); 
    bp.type = 'bandpass';
    bp.frequency.value = 180; 
    bp.Q.value = 3;
    
    const gn = ctx.createGain();
    gn.gain.setValueAtTime(0, now);
    gn.gain.linearRampToValueAtTime(0.18, now + 0.1);
    gn.gain.linearRampToValueAtTime(0, now + 0.9);
    
    ns.connect(bp); bp.connect(gn); gn.connect(ctx.destination);
    ns.start(now); ns.stop(now + 0.9);
  } catch(e) {}
}

// ── 플레이어 픽셀맵 (8열 × 9행)
const _PMAP = [
  [0,0,1,1,1,1,0,0],
  [0,1,1,1,1,1,1,0],
  [0,1,2,1,1,2,1,0],
  [0,1,3,1,1,3,1,0],
  [0,1,1,1,1,1,1,0],
  [0,1,1,1,1,1,1,0],
  [1,1,0,1,1,0,1,1],
  [0,1,1,0,0,1,1,0],
  [0,1,1,0,0,1,1,0],
];

// 좀비 픽셀맵 (8열 × 9행)
const _ZMAP = [
  [0,0,1,1,1,1,0,0],
  [0,1,1,1,1,1,1,0],
  [0,1,2,1,1,2,1,0],
  [0,1,3,1,1,3,1,0],
  [0,1,1,1,1,1,1,0],
  [0,1,4,1,1,4,1,0],
  [1,1,0,1,1,0,1,1],
  [0,1,1,0,0,1,1,0],
  [0,1,1,0,0,1,1,0],
];

// 얼굴만 (위 5행)
const _PFACE = [
  [0,0,1,1,1,1,0,0],
  [0,1,1,1,1,1,1,0],
  [0,1,2,1,1,2,1,0],
  [0,1,3,1,1,3,1,0],
  [0,1,1,1,1,1,1,0],
];

const _ZFACE = [
  [0,0,1,1,1,1,0,0],
  [0,1,1,1,1,1,1,0],
  [0,1,2,1,1,2,1,0],
  [0,1,3,1,1,3,1,0],
  [0,1,1,1,1,1,1,0],
];

function _drawPMap(p, map, ox, oy, ps, c1, c2, c3, c4, flipH) {
  p.noStroke();
  const COLS8 = map[0].length;
  for (let r = 0; r < map.length; r++) {
    for (let c = 0; c < COLS8; c++) {
      const col = flipH ? COLS8 - 1 - c : c;
      const v = map[r][col];
      if (v === 0) continue;
      if      (v === 1) p.fill(c1);
      else if (v === 2) p.fill(c2);
      else if (v === 3) p.fill(c3);
      else if (v === 4) p.fill(c4);
      p.rect(ox + c * ps, oy + r * ps, ps, ps);
    }
  }
}

function _drawKey(p, label, x, y, w, h, col) {
  p.fill(18, 18, 26);
  p.stroke(col);
  p.strokeWeight(1.5);
  p.rect(x, y, w, h, 4);
  p.noStroke();
  p.fill(col);
  p.textSize(11);
  p.textAlign(p.CENTER, p.CENTER);
  p.text(label, x + w / 2, y + h / 2);
}

// ── 브금 (로비 BGM)
let bgmAudio = null;

function _initBGM() {
  bgmAudio = new Audio('전반_브금.mp3');
  bgmAudio.loop = true;
  bgmAudio.volume = 0.55;
}

function _playBGM() {
  if (!bgmAudio) return;
  if (bgmAudio.paused) bgmAudio.play().catch(() => {});
}

function _stopBGM() {
  if (!bgmAudio) return;
  bgmAudio.pause();
  bgmAudio.currentTime = 0;
}

function setup() {
  createCanvas(CANVAS_W, CANVAS_H);
  frameRate(FRAME_RATE);
  textFont('Nunito');
  resetGame();
  _initBloodDrops();
  _initBGM();
}

function _initBloodDrops() {
  bloodDrops = [];
}

function _newBloodSplatterFull() { return null; }
function _newBloodSplatter(margin) { return null; }

function _newBloodSplatter(margin) { return null; } // 미사용 (레거시 호환)

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
  isNewHighScore = false;
  showHowto = false;
  fillAnimActive = false;
  fillAnimRow = 0;
  lobbySubState = 'main';
  inputBuffer = '';
  inputError = '';
  ambientTimer = 0;
  // 로비 돌아오면 BGM 재개
  if (bgmAudio) { bgmAudio.currentTime = 0; bgmAudio.play().catch(() => {}); }
}

function draw() {
  background(COLOR_EMPTY);
  if (phase === PHASE_LOBBY) { _playBGM(); drawLobby(this); return; }

  // 게임 시작되면 BGM 정지
  _stopBGM();

  if (phase !== PHASE_END) {
    ambientTimer++;
    if (ambientTimer >= AMBIENT_INTERVAL) {
      ambientTimer = 0;
      playAmbientGroan();
    }
  }

  if (phase === PHASE_END) {
    drawGrid(this); drawZombies(this);
    playerA.draw(this); playerB.draw(this);

    if (fillAnimActive) {
      _drawFillAnim(this);
      return;
    }

    // 필 애니메이션 완료 후: 승자 색 배경을 유지한 채 결과 화면 표시
    const col = this.color(pixelFillColor);
    this.fill(col); this.noStroke();
    this.rect(0, 0, CANVAS_W, CANVAS_H);

    drawResultScreen(this, countTiles(), winner, highScore, isNewHighScore);
    return;
  }

  if (betrayalAnnounceFade > 0) {
    drawGrid(this); drawTiles(this); drawZombies(this);
    playerA.draw(this); playerB.draw(this);
    drawBetrayalAnnounce(this);
    drawUI(this, phase, gameTimer / FRAME_RATE, countTiles());
    return;
  }

  gameTimer--;
  const timeLeftSec = gameTimer / FRAME_RATE;
  if (!betrayalTriggered && timeLeftSec <= BETRAYAL_TRIGGER_TIME) _triggerBetrayal();

  if (phase === PHASE_SOLO) {
    soloTimer--;
    if (soloTimer <= 0) _reviveDeadPlayer();
  }

  updateTiles(this);
  updateZombies([playerA, playerB], this);
  if (playerA.alive) playerA.update(playerB, zombies, phase, this);
  if (playerB.alive) playerB.update(playerA, zombies, phase, this);

  _checkEndConditions(timeLeftSec);

  drawGrid(this); drawTiles(this); drawZombies(this);
  playerA.draw(this); playerB.draw(this);
  drawBetrayalAnnounce(this);
  drawUI(this, phase, timeLeftSec, countTiles());
}

function _drawFillAnim(p) {
  fillAnimRow += FILL_SPEED;
  if (fillAnimRow >= ROWS) {
    fillAnimRow = ROWS;
    fillAnimActive = false;
  }

  p.noStroke();
  const col = p.color(pixelFillColor);
  p.fill(col);
  p.rect(0, 0, CANVAS_W, fillAnimRow * TILE_SIZE);
}

function _triggerBetrayal() {
  betrayalTriggered = true;
  phase = PHASE_BETRAYAL;

  const midC = Math.floor(COLS / 2);
  const midR = Math.floor(ROWS / 2);

  if (!playerA.alive) playerA.revive(midR - 3, midC - 5, OWNER_A);
  if (!playerB.alive) playerB.revive(midR + 3, midC + 5, OWNER_B);

  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (grid[r][c].owner === OWNER_TEAM) {
        grid[r][c].owner = c < midC ? OWNER_A : OWNER_B;
        grid[r][c].dirty = true;
      }
    }
  }

  playerA.setPhase(PHASE_BETRAYAL);
  playerB.setPhase(PHASE_BETRAYAL);
  for (const t of playerA.tail) setOwner(t.r, t.c, OWNER_A);
  for (const t of playerB.tail) setOwner(t.r, t.c, OWNER_B);
  showBetrayalAnnounce(this);
}

function _checkEndConditions(timeLeftSec) {
  if (gameTimer <= 0) { _endGame('timer'); return; }
  if (!playerA.alive && !playerB.alive) { _endGame('both_dead'); return; }
  if (phase === PHASE_COOP) {
    if (!playerA.alive || !playerB.alive) {
      phase = PHASE_SOLO;
      deadPlayerId = !playerA.alive ? 'A' : 'B';
      soloTimer = SOLO_TIME_LIMIT * FRAME_RATE;
      const survivor = deadPlayerId === 'A' ? 'B' : 'A';
      showNotification(survivor, `P${deadPlayerId} 사망! ${SOLO_TIME_LIMIT}초 후 부활 & 배신 30초!`, '#FF9800');
    }
  }
  if (phase === PHASE_BETRAYAL) {
    if (!playerA.alive && playerB.alive) { winner = 'B'; _endGame('elimination'); return; }
    if (!playerB.alive && playerA.alive) { winner = 'A'; _endGame('elimination'); return; }
  }
}

function _reviveDeadPlayer() {
  const midR = Math.floor(ROWS / 2);
  const midC = Math.floor(COLS / 2);
  const survivor = deadPlayerId === 'A' ? playerB : playerA;
  const dead = deadPlayerId === 'A' ? playerA : playerB;
  const deadSpawnR = midR + (deadPlayerId === 'A' ? -3 : 3);

  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (grid[r][c].owner === OWNER_TEAM) {
        grid[r][c].owner = c < midC ? OWNER_A : OWNER_B;
        grid[r][c].dirty = true;
      }
    }
  }

  dead.revive(deadSpawnR, midC - (deadPlayerId === 'A' ? 5 : -5), deadPlayerId === 'A' ? OWNER_A : OWNER_B);
  gameTimer = EMERGENCY_BETRAYAL_TIME * FRAME_RATE;
  betrayalTriggered = true;
  phase = PHASE_BETRAYAL;
  playerA.setPhase(PHASE_BETRAYAL);
  playerB.setPhase(PHASE_BETRAYAL);
  deadPlayerId = null;
  showBetrayalAnnounce(this);
  showNotification('A', '부활! 배신 타이머 30초 발동!', '#FF5252');
}

function _endGame(reason) {
  phase = PHASE_END;
  const counts = countTiles();
  if (reason === 'timer') {
    if (playerA.alive && playerB.alive) {
      if (counts.A > counts.B) winner = 'A';
      else if (counts.B > counts.A) winner = 'B';
      else winner = 'draw';
    } else if (playerA.alive) { winner = 'A'; }
    else if (playerB.alive)   { winner = 'B'; }
    else                      { winner = 'zombie'; }
  } else if (reason === 'both_dead') {
    winner = 'zombie';
  }

  if (!betrayalTriggered) {
    winner = 'zombie';
  }

  const best = Math.max(counts.A, counts.B, counts.team);
  if (currentUserId) {
    if (!accounts[currentUserId]) accounts[currentUserId] = { highScore: 0 };
    if (best > accounts[currentUserId].highScore) {
      accounts[currentUserId].highScore = best;
      isNewHighScore = true;
    }
    highScore = accounts[currentUserId].highScore;
  } else {
    if (best > highScore) { highScore = best; isNewHighScore = true; }
  }

  fillAnimActive = true;
  fillAnimRow = 0; 
  pixelFillColor = winner === 'A' ? COLOR_A :
                   winner === 'B' ? COLOR_B :
                   winner === 'draw' ? '#FFD600' : COLOR_ZOMBIE;
}

// ── 키보드 입력
function keyPressed() {
  // 로비에서 아무 키나 누르면 BGM 시작 (브라우저 정책: 사용자 인터랙션 필요)
  if (phase === PHASE_LOBBY) _playBGM();

  if (phase === PHASE_LOBBY && (lobbySubState === 'login' || lobbySubState === 'register')) {
    if (keyCode === 27) { lobbySubState = 'main'; inputBuffer = ''; inputError = ''; return; }
    if (keyCode === 13) { _submitInput(); return; }
    if (keyCode === 8)  { inputBuffer = inputBuffer.slice(0, -1); return; }
    if (key.length === 1) { if (inputBuffer.length < 16) inputBuffer += key; }
    return;
  }

  if (phase === PHASE_LOBBY && keyCode === 32 && !showHowto) {
    playZombieRoar();
    phase = PHASE_COOP;
    return;
  }
  if (phase === PHASE_LOBBY && keyCode === 27 && showHowto)  { showHowto = false; return; }
  if (phase === PHASE_END   && keyCode === 32) {
    playZombieRoar();
    resetGame();
    return;
  }
  if (betrayalAnnounceFade > 0) return;
  if (phase === PHASE_COOP || phase === PHASE_SOLO || phase === PHASE_BETRAYAL) {
    playerA.handleKeyPressed(keyCode);
    playerB.handleKeyPressed(keyCode);
  }
}

function _submitInput() {
  const id = inputBuffer.trim();
  if (!id) { inputError = '아이디를 입력하세요.'; return; }

  if (lobbySubState === 'login') {
    if (!accounts[id]) { inputError = '존재하지 않는 아이디입니다.'; return; }
    currentUserId = id;
    highScore = accounts[id].highScore;
    inputBuffer = ''; inputError = '';
    lobbySubState = 'main';
  } else if (lobbySubState === 'register') {
    if (accounts[id]) { inputError = '이미 사용 중인 아이디입니다.'; return; }
    accounts[id] = { highScore: 0 };
    currentUserId = id;
    highScore = 0;
    inputBuffer = ''; inputError = '';
    lobbySubState = 'main';
  }
}

function mousePressed() {
  const cx = CANVAS_W / 2;
  // 로비에서 클릭하면 BGM 시작
  if (phase === PHASE_LOBBY) _playBGM();

  if (phase === PHASE_LOBBY && (lobbySubState === 'login' || lobbySubState === 'register')) {
    const pw = 340, ph = 200;
    const px = cx - pw / 2;
    const py = CANVAS_H / 2 - ph / 2;
    if (mouseX > px + pw - 36 && mouseX < px + pw - 6 && mouseY > py + 6 && mouseY < py + 36) {
      lobbySubState = 'main'; inputBuffer = ''; inputError = ''; return;
    }
    const btnY2 = py + ph - 52;
    if (mouseX > cx - 70 && mouseX < cx + 70 && mouseY > btnY2 && mouseY < btnY2 + 34) {
      _submitInput(); return;
    }
    if (mouseX < px || mouseX > px + pw || mouseY < py || mouseY > py + ph) {
      lobbySubState = 'main'; inputBuffer = ''; inputError = ''; return;
    }
    return;
  }

  if (phase === PHASE_LOBBY && showHowto) {
    const pw = 390, ph = 280;
    const px = cx - pw / 2;
    const py = CANVAS_H / 2 - ph / 2;
    if (mouseX > px + pw - 36 && mouseX < px + pw - 6 && mouseY > py + 6 && mouseY < py + 36) {
      showHowto = false; return;
    }
    if (mouseX < px || mouseX > px + pw || mouseY < py || mouseY > py + ph) {
      showHowto = false; return;
    }
    return;
  }

  if (phase === PHASE_LOBBY) {
    const cardY = 162, cardH = 230;
    const startBtnY = cardY + cardH + 22;
    const btnH = 54;
    const howtoBtnY = startBtnY + btnH + 14;
    const htH = 38;
    const accountAreaY = howtoBtnY + htH + 12;

    if (mouseX > cx - 190 && mouseX < cx + 190 && mouseY > startBtnY && mouseY < startBtnY + btnH) {
      playZombieRoar();
      phase = PHASE_COOP; 
      return;
    }
    if (mouseX > cx - 95 && mouseX < cx + 95 && mouseY > howtoBtnY && mouseY < howtoBtnY + htH) {
      showHowto = true; 
      return;
    }
    if (currentUserId) {
      if (mouseX > cx - 40 && mouseX < cx + 40 && mouseY > accountAreaY + 52 && mouseY < accountAreaY + 76) {
        currentUserId = null; highScore = 0; return;
      }
    } else {
      if (mouseX > cx - 100 && mouseX < cx - 10 && mouseY > accountAreaY + 18 && mouseY < accountAreaY + 48) {
        lobbySubState = 'login'; inputBuffer = ''; inputError = ''; return;
      }
      if (mouseX > cx + 10 && mouseX < cx + 100 && mouseY > accountAreaY + 18 && mouseY < accountAreaY + 48) {
        lobbySubState = 'register'; inputBuffer = ''; inputError = ''; return;
      }
    }
  }

  if (phase === PHASE_END) {
    const cy = CANVAS_H / 2;
    const panY = cy + 50, panH = 220;
    const btnY2 = panY + panH - 58;
    if (mouseX > cx - 120 && mouseX < cx + 120 && mouseY > btnY2 && mouseY < btnY2 + 44) {
      playZombieRoar();
      resetGame(); return;
    }
  }
}

// ── 배신 공지
function showBetrayalAnnounce(p) { betrayalAnnounceFade = FRAME_RATE * 2; }
function drawBetrayalAnnounce(p) {
  if (betrayalAnnounceFade <= 0) return;
  betrayalAnnounceFade--;
  const alpha = Math.min(255, betrayalAnnounceFade * 5);
  p.fill(200, 0, 0, alpha); p.noStroke();
  p.rect(0, CANVAS_H / 2 - 45, CANVAS_W, 90);
  p.fill(255, 255, 255, alpha); p.textAlign(p.CENTER, p.CENTER);
  p.textFont('Nunito');
  p.textStyle(p.BOLD);
  p.textSize(26); p.text('⚠ 배신 타이머 발동! ⚠', CANVAS_W / 2, CANVAS_H / 2 - 12);
  p.textSize(14); p.text('이제 팀원도 적입니다', CANVAS_W / 2, CANVAS_H / 2 + 18);
  p.textStyle(p.NORMAL);
}

// ── 결과 화면
function drawResultScreen(p, counts, winner, highScore, isNewHighScore) {
  const cx = CANVAS_W / 2, cy = CANVAS_H / 2;

  // 승자 색상 정의
  const winColor   = winner === 'A' ? '#E53935' :
                     winner === 'B' ? '#1E88E5' :
                     winner === 'draw' ? '#FFD600' : '#AB47BC';
  const winColorDk = winner === 'A' ? '#7f0000' :
                     winner === 'B' ? '#003c8f' :
                     winner === 'draw' ? '#8a6d00' : '#4a0072';

  // 배경은 이미 승자 색으로 채워진 상태 — 어두운 반투명 레이어만 추가
  p.fill(0, 0, 0, 100); p.noStroke(); p.rect(0, 0, CANVAS_W, CANVAS_H);

  // 승자 색 방사형 글로우 (화면 중앙에서 퍼짐)
  const pulse = 0.85 + Math.sin(p.frameCount * 0.07) * 0.15;
  const wc = p.color(winColor);
  for (let i = 8; i >= 1; i--) {
    p.fill(p.red(wc), p.green(wc), p.blue(wc), 8 * pulse * i);
    p.noStroke();
    p.ellipse(cx, cy - 60, 520 - i * 30, 300 - i * 18);
  }

  // ── 승자 표시 (초대형, 화면 상단 1/3 장악)
  p.textFont('Nunito');
  p.textAlign(p.CENTER, p.CENTER);

  // GAME OVER 작은 라벨
  p.textStyle(p.BOLD);
  p.fill(180, 180, 180, 200);
  p.textSize(12);
  p.text('G A M E   O V E R', cx, cy - 175);

  // 승리 문구 — 크고 굵게, 글로우 레이어 4겹
  let winText = winner === 'A' ? 'PLAYER  A  WIN!' :
                winner === 'B' ? 'PLAYER  B  WIN!' :
                winner === 'draw' ? 'D R A W !' : 'ZOMBIE  WIN...';
  p.textSize(52);
  for (let g = 5; g >= 1; g--) {
    p.fill(p.red(wc), p.green(wc), p.blue(wc), 20 * pulse);
    p.text(winText, cx, cy - 138 + g);
  }
  // 그림자
  p.fill(0, 0, 0, 160);
  p.text(winText, cx + 3, cy - 135);
  // 본문
  p.fill(winColor);
  p.text(winText, cx, cy - 138);
  p.textStyle(p.NORMAL);

  // ── 캐릭터 픽셀맵 (승자만 크게, 패자는 작고 흐릿하게 양옆에)
  const fPS = 13, fW = 8 * fPS, fH = 5 * fPS;
  const faceY = cy - 95;

  if (winner === 'A') {
    _drawPMap(p, _PFACE, cx - fW/2, faceY, fPS, '#C62828', '#eeeeee', '#111111', '#ffffff', false);
  } else if (winner === 'B') {
    _drawPMap(p, _PFACE, cx - fW/2, faceY, fPS, '#1565C0', '#eeeeee', '#111111', '#ffffff', true);
  } else if (winner === 'zombie') {
    // 좀비: 더 크게(fPS+4), 더 아래로
    const zPS = 17, zFW = 8 * zPS;
    _drawPMap(p, _ZFACE, cx - zFW/2, faceY - 5, zPS, '#2E7D32', '#ccffcc', '#1B5E20', '#e8ffe8', false);
  } else {
    const smPS = 10, smW = 8 * smPS;
    _drawPMap(p, _PFACE, cx - smW - 10, faceY + 10, smPS, '#C62828', '#eeeeee', '#111111', '#ffffff', false);
    _drawPMap(p, _PFACE, cx + 10, faceY + 10, smPS, '#1565C0', '#eeeeee', '#111111', '#ffffff', true);
  }

  // ── 하단 패널 (스탯 + 버튼)
  const panW = 460, panH = 220;
  const panX = cx - panW / 2, panY = cy + 50;

  // 패널 그림자
  p.fill(0, 0, 0, 120); p.noStroke();
  p.rect(panX + 5, panY + 5, panW, panH, 14);
  // 패널 본체
  p.fill(14, 14, 20);
  p.stroke(winColor); p.strokeWeight(2);
  p.rect(panX, panY, panW, panH, 14);
  p.noStroke();

  // 패널 상단 컬러 띠
  p.fill(winColor);
  p.rect(panX, panY, panW, 6, 14, 14, 0, 0);

  // ── 타일 점수 바
  const statsY = panY + 22;
  const barW = panW - 80, barX = panX + 40;
  const totalTiles = ROWS * COLS;

  if (!betrayalTriggered && winner === 'zombie') {
    p.textStyle(p.BOLD); p.textSize(11); p.textAlign(p.CENTER, p.CENTER);
    p.fill(COLOR_TEAM); p.text('🟢  TEAM 영역', cx - 60, statsY + 8);
    p.fill(255); p.text(counts.team + ' 타일', cx + 60, statsY + 8);
    p.textStyle(p.NORMAL);
  } else {
    // A 바
    p.fill(30); p.rect(barX, statsY, barW, 18, 9);
    const wA = Math.max(6, (counts.A / totalTiles) * barW);
    p.fill(COLOR_A); p.rect(barX, statsY, wA, 18, 9, 0, 0, 9);
    // B 바
    p.fill(30); p.rect(barX, statsY + 26, barW, 18, 9);
    const wB = Math.max(6, (counts.B / totalTiles) * barW);
    p.fill(COLOR_B); p.rect(barX + barW - wB, statsY + 26, wB, 18, 0, 9, 9, 0);

    p.textStyle(p.BOLD); p.textSize(11); p.noStroke();
    p.fill(COLOR_A); p.textAlign(p.LEFT, p.CENTER);
    p.text('A  ' + counts.A + ' 타일', barX + 6, statsY + 9);
    p.fill(COLOR_B); p.textAlign(p.RIGHT, p.CENTER);
    p.text(counts.B + ' 타일  B', barX + barW - 6, statsY + 35);

    p.fill(100); p.textAlign(p.CENTER, p.CENTER); p.textSize(10);
    const zPct = Math.round((counts.Z / totalTiles) * 100);
    p.text('좀비 점령: ' + counts.Z + '타일 (' + zPct + '%)', cx, statsY + 58);
    p.textStyle(p.NORMAL);
  }

  // ── 최고 기록
  const scoreY = panY + 108;
  p.stroke(40); p.strokeWeight(1);
  p.line(panX + 24, scoreY - 6, panX + panW - 24, scoreY - 6);
  p.noStroke();

  p.textAlign(p.CENTER, p.CENTER);
  if (isNewHighScore) {
    const blink = Math.floor(p.frameCount / 10) % 2 === 0;
    p.textStyle(p.BOLD); p.textSize(14);
    p.fill(blink ? '#FFD600' : '#FF8A00');
    p.text('🔥  최고 기록 경신!  🔥', cx, scoreY + 10);
    p.textStyle(p.NORMAL); p.fill(200); p.textSize(11);
    if (currentUserId) {
      const userBest = accounts[currentUserId] ? accounts[currentUserId].highScore : 0;
      p.text(currentUserId + '님의 최고 기록: ' + userBest + ' 타일', cx, scoreY + 28);
    } else {
      p.text('최고 기록: ' + highScore + ' 타일', cx, scoreY + 28);
    }
  } else {
    const best = Math.max(counts.A, counts.B, counts.team);
    p.fill(130); p.textSize(11);
    p.text('이번 점수: ' + best + ' 타일', cx, scoreY + 8);
    if (currentUserId) {
      const userBest = accounts[currentUserId] ? accounts[currentUserId].highScore : 0;
      p.fill(90); p.text(currentUserId + '님의 최고 기록: ' + userBest + ' 타일', cx, scoreY + 24);
    } else {
      p.fill(90); p.text('최고 기록: ' + highScore + ' 타일', cx, scoreY + 24);
    }
  }

  // ── 다시 시작 버튼
  const btnW = 240, btnH = 44;
  const btnX = cx - btnW / 2;
  const btnY2 = panY + panH - 58;
  const blink2 = Math.floor(p.frameCount / 15) % 2 === 0;
  if (blink2) {
    p.fill(67, 160, 71, 50); p.noStroke();
    p.rect(btnX - 4, btnY2 - 4, btnW + 8, btnH + 8, 16);
  }
  p.fill(blink2 ? '#43A047' : '#2E7D32');
  p.stroke('#76FF03'); p.strokeWeight(2);
  p.rect(btnX, btnY2, btnW, btnH, 12);
  p.noStroke();
  p.fill(255, 255, 255, 30);
  p.rect(btnX + 2, btnY2 + 2, btnW - 4, btnH/2 - 2, 10, 10, 0, 0);
  p.textStyle(p.BOLD); p.textSize(15);
  p.fill(0, 50, 0);
  p.text('▶  다시 시작  (SPACE)', cx + 1, btnY2 + btnH/2 + 1);
  p.fill(255);
  p.text('▶  다시 시작  (SPACE)', cx, btnY2 + btnH/2);
  p.textStyle(p.NORMAL);
}

// ── 로비 화면
function drawLobby(p) {
  p.background(6, 6, 10);
  const cx = CANVAS_W / 2;
  const blink = Math.floor(p.frameCount / 18) % 2 === 0;
  const pulse = 0.85 + Math.sin(p.frameCount * 0.05) * 0.15;

  // ── 배경 육각형 그리드 (SF 느낌)
  p.stroke(0, 60, 0, 35); p.strokeWeight(0.6);
  const hx = 32, hy = 28;
  for (let row = -1; row < ROWS + 2; row++) {
    for (let col = -1; col < COLS + 2; col++) {
      const ox = (row % 2 === 0) ? 0 : hx / 2;
      const px2 = col * hx + ox, py2 = row * hy;
      p.noFill(); p.beginShape();
      for (let a = 0; a < 6; a++) {
        p.vertex(px2 + 14 * Math.cos((a * 60 - 30) * Math.PI / 180),
                 py2 + 14 * Math.sin((a * 60 - 30) * Math.PI / 180));
      }
      p.endShape(p.CLOSE);
    }
  }
  p.noStroke();

  // ── 제목 배경 패널 (HUD 프레임)
  const titlePanH = 90;
  // 어두운 반투명 패널
  p.fill(0, 20, 0, 180);
  p.rect(30, 18, CANVAS_W - 60, titlePanH, 6);
  // 패널 테두리 (녹색 네온)
  p.noFill();
  p.stroke(0, 255, 80, 60 + 30 * pulse); p.strokeWeight(1.5);
  p.rect(30, 18, CANVAS_W - 60, titlePanH, 6);
  // 모서리 장식
  const _corner = (x, y, dx, dy) => {
    p.stroke(0, 255, 80, 200); p.strokeWeight(2.5);
    p.line(x, y, x + dx * 18, y); p.line(x, y, x, y + dy * 18);
  };
  _corner(30, 18, 1, 1); _corner(CANVAS_W-30, 18, -1, 1);
  _corner(30, 18+titlePanH, 1, -1); _corner(CANVAS_W-30, 18+titlePanH, -1, -1);
  p.noStroke();

  // 제목 글로우
  p.textFont('Nunito'); p.textAlign(p.CENTER, p.CENTER);
  p.textStyle(p.BOLD); p.textSize(58);
  for (let g = 6; g >= 1; g--) {
    p.fill(0, 255, 80, 10 * pulse * (7 - g));
    p.text('좀비 슬라이드 듀오', cx, 65 + g * 0.5);
  }
  // 그림자
  p.fill(0, 60, 10); p.text('좀비 슬라이드 듀오', cx + 3, 68);
  // 본문 (녹색 네온)
  p.fill(80, 255, 100); p.text('좀비 슬라이드 듀오', cx, 65);
  p.textStyle(p.NORMAL);

  // 부제 / 크레딧
  p.textSize(13); p.fill(140, 200, 140);
  p.text('2인 협력  —  배신 영역 점령 게임', cx, 126);
  p.textSize(13); p.fill(70, 110, 70);
  p.text('제작자 : 이현서  이유진  전재민', cx, 145);

  // ── 캐릭터 카드 3개
  // 레이아웃
  const cardW = 148, cardH = 230;
  const cardY = 162;
  const aCardX = cx - 248 - cardW / 2;  // Player A 카드 left
  const zCardX = cx - cardW / 2;         // Zombie 카드 left
  const bCardX = cx + 248 - cardW / 2;  // Player B 카드 left

  function _drawCard(lx, ly, cw, ch, borderCol, glowCol, label, labelCol) {
    // 카드 배경
    p.fill(8, 12, 8, 210); p.noStroke();
    p.rect(lx, ly, cw, ch, 8);
    // 내부 미묘한 그라데이션 느낌
    p.fill(glowCol[0], glowCol[1], glowCol[2], 18);
    p.rect(lx, ly, cw, ch, 8);
    // 테두리 네온
    p.noFill();
    p.stroke(borderCol[0], borderCol[1], borderCol[2], 160 + 60 * pulse);
    p.strokeWeight(1.8); p.rect(lx, ly, cw, ch, 8);
    // 모서리 꺾쇠
    const cc = (x, y, dx, dy) => {
      p.stroke(borderCol[0], borderCol[1], borderCol[2], 255);
      p.strokeWeight(2.5);
      p.line(x, y, x + dx * 14, y); p.line(x, y, x, y + dy * 14);
    };
    cc(lx, ly, 1, 1); cc(lx+cw, ly, -1, 1);
    cc(lx, ly+ch, 1, -1); cc(lx+cw, ly+ch, -1, -1);
    // 상단 스캔라인 장식
    p.stroke(borderCol[0], borderCol[1], borderCol[2], 60);
    p.strokeWeight(1);
    p.line(lx+2, ly+22, lx+cw-2, ly+22);
    // 라벨 배지
    p.noStroke(); p.fill(borderCol[0], borderCol[1], borderCol[2]);
    const lblW = label.length * 7.5 + 20;
    p.rect(lx + cw/2 - lblW/2, ly - 12, lblW, 22, 4);
    p.fill(255); p.textStyle(p.BOLD); p.textSize(11);
    p.textAlign(p.CENTER, p.CENTER);
    p.text(label, lx + cw/2, ly - 1);
    p.textStyle(p.NORMAL);
    p.noStroke();
  }

  // Player A 카드 (빨간)
  _drawCard(aCardX, cardY, cardW, cardH, [220,50,50], [220,50,50], 'PLAYER  A', '#E53935');
  // 캐릭터
  const psA = 16;
  const aCharX = aCardX + cardW/2 - 8*psA/2;
  const aCharY = cardY + 30;
  // 빨간 글로우
  p.fill(220, 50, 50, 30); p.noStroke();
  p.ellipse(aCardX + cardW/2, aCharY + 80, 100, 60);
  _drawPMap(p, _PMAP, aCharX, aCharY, psA, '#E53935', '#ffffff', '#111111', '#ffffff', false);
  // 키 안내
  const kw = 28, kh = 24, kg = 4;
  const kcy = cardY + cardH - 56;
  const kcx = aCardX + cardW/2;
  _drawKey(p, 'W', kcx - kw/2,          kcy,         kw, kh, COLOR_A);
  _drawKey(p, 'A', kcx - kw*1.5 - kg,   kcy+kh+kg,   kw, kh, COLOR_A);
  _drawKey(p, 'S', kcx - kw/2,          kcy+kh+kg,   kw, kh, COLOR_A);
  _drawKey(p, 'D', kcx + kw/2 + kg,     kcy+kh+kg,   kw, kh, COLOR_A);

  // Zombie 카드 (초록)
  _drawCard(zCardX, cardY, cardW, cardH, [0,180,60], [0,180,60], 'ZOMBIE', '#4CAF50');
  const psZ = 14;
  const zCharX = zCardX + cardW/2 - 8*psZ/2;
  const zCharY = cardY + 38;
  p.fill(0, 180, 60, 28); p.noStroke();
  p.ellipse(zCardX + cardW/2, zCharY + 72, 95, 55);
  _drawPMap(p, _ZMAP, zCharX, zCharY, psZ, '#2E7D32', '#ccffcc', '#1B5E20', '#e8ffe8', false);

  // Player B 카드 (파란)
  _drawCard(bCardX, cardY, cardW, cardH, [30,120,255], [30,120,255], 'PLAYER  B', '#1E88E5');
  const psB = 16;
  const bCharX = bCardX + cardW/2 - 8*psB/2;
  const bCharY = cardY + 30;
  p.fill(30, 120, 255, 30); p.noStroke();
  p.ellipse(bCardX + cardW/2, bCharY + 80, 100, 60);
  _drawPMap(p, _PMAP, bCharX, bCharY, psB, '#1E88E5', '#ffffff', '#111111', '#ffffff', true);
  // 키 안내
  const bkcx = bCardX + cardW/2;
  const bkcy = cardY + cardH - 56;
  _drawKey(p, '↑', bkcx - kw/2,          bkcy,         kw, kh, COLOR_B);
  _drawKey(p, '←', bkcx - kw*1.5 - kg,   bkcy+kh+kg,   kw, kh, COLOR_B);
  _drawKey(p, '↓', bkcx - kw/2,          bkcy+kh+kg,   kw, kh, COLOR_B);
  _drawKey(p, '→', bkcx + kw/2 + kg,     bkcy+kh+kg,   kw, kh, COLOR_B);

  // VS 배지
  const vsY = cardY + cardH / 2;
  p.fill(20, 20, 20, 200); p.noStroke();
  p.ellipse(cx - 248 + cardW/2 + (cx - cx + 248 - cardW/2 - (cx - 248 + cardW/2)) / 2, vsY, 38, 38);
  // 좌측 VS
  const vsLX = aCardX + cardW + (zCardX - aCardX - cardW) / 2;
  const vsRX = zCardX + cardW + (bCardX - zCardX - cardW) / 2;
  p.fill(15, 15, 15, 220); p.noStroke(); p.ellipse(vsLX, vsY, 38, 38);
  p.noFill(); p.stroke(80, 80, 80, 150); p.strokeWeight(1.5); p.ellipse(vsLX, vsY, 38, 38);
  p.noStroke(); p.fill(140); p.textStyle(p.BOLD); p.textSize(13);
  p.text('VS', vsLX, vsY);
  p.fill(15, 15, 15, 220); p.noStroke(); p.ellipse(vsRX, vsY, 38, 38);
  p.noFill(); p.stroke(80, 80, 80, 150); p.strokeWeight(1.5); p.ellipse(vsRX, vsY, 38, 38);
  p.noStroke(); p.fill(140); p.text('VS', vsRX, vsY);
  p.textStyle(p.NORMAL);

  // ── 시작 버튼
  const startBtnY = cardY + cardH + 22;
  const btnW = 380, btnH = 54;
  const btnX = cx - btnW / 2;
  // 글로우
  p.fill(0, 200, 60, blink ? 35 : 15); p.noStroke();
  p.rect(btnX - 6, startBtnY - 6, btnW + 12, btnH + 12, 16);
  // 본체
  p.fill(blink ? '#1B7A30' : '#145C24');
  p.stroke(0, 255, 80, blink ? 220 : 140); p.strokeWeight(2);
  p.rect(btnX, startBtnY, btnW, btnH, 10);
  // 하이라이트
  p.noStroke(); p.fill(255, 255, 255, 22);
  p.rect(btnX+2, startBtnY+2, btnW-4, btnH/2-2, 8, 8, 0, 0);
  p.textStyle(p.BOLD); p.textSize(21);
  p.fill(0, 40, 10); p.text('▶  시작하기  (SPACE)', cx+2, startBtnY + btnH/2+1);
  p.fill(blink ? '#AAFFBB' : '#88EE99');
  p.text('▶  시작하기  (SPACE)', cx, startBtnY + btnH/2);
  p.textStyle(p.NORMAL);

  // ── 게임 방법 버튼
  const howtoBtnY = startBtnY + btnH + 14;
  const htW = 200, htH = 38;
  const htX = cx - htW / 2;
  const htBlink = Math.floor(p.frameCount / 25) % 2 === 0;
  p.fill(8, 20, 50, 210);
  p.stroke(30, 120, 255, htBlink ? 200 : 130); p.strokeWeight(1.5);
  p.rect(htX, howtoBtnY, htW, htH, 8);
  p.noStroke(); p.fill(255, 255, 255, 18);
  p.rect(htX+2, howtoBtnY+2, htW-4, htH/2-2, 6, 6, 0, 0);
  p.fill(htBlink ? '#90CAF9' : '#64B5F6');
  p.textStyle(p.BOLD); p.textSize(13);
  p.text('❓  게임 방법', cx, howtoBtnY + htH/2);
  p.textStyle(p.NORMAL);

  // ── 계정 영역
  const accountAreaY = howtoBtnY + htH + 12;
  if (currentUserId) {
    p.fill(12, 22, 12, 200); p.stroke(40, 80, 40); p.strokeWeight(1);
    p.rect(cx - 114, accountAreaY - 4, 228, 76, 8);
    p.noStroke();
    p.textSize(10); p.fill(80, 150, 80);
    p.text('로그인 중', cx, accountAreaY + 10);
    p.textSize(14); p.fill(200, 255, 200); p.textStyle(p.BOLD);
    p.text('👤 ' + currentUserId, cx, accountAreaY + 28);
    p.textStyle(p.NORMAL);
    p.textSize(10); p.fill(80, 120, 80);
    p.text('최고 기록: ' + highScore + ' 타일', cx, accountAreaY + 44);
    p.fill(28, 28, 44); p.stroke(60); p.strokeWeight(1);
    p.rect(cx - 40, accountAreaY + 54, 80, 24, 5);
    p.noStroke(); p.fill(140); p.textSize(11);
    p.text('로그아웃', cx, accountAreaY + 66);
  } else {
    p.fill(80); p.textSize(10); p.noStroke();
    p.text('아이디로 로그인하여 최고기록을 관리하세요', cx, accountAreaY + 6);
    // 로그인
    p.fill(10, 18, 40); p.stroke(30, 100, 220); p.strokeWeight(1.2);
    p.rect(cx - 100, accountAreaY + 18, 90, 30, 6);
    // 회원가입
    p.fill(10, 24, 10); p.stroke(30, 160, 80); p.strokeWeight(1.2);
    p.rect(cx + 10, accountAreaY + 18, 90, 30, 6);
    p.noStroke(); p.fill(190); p.textSize(12); p.textStyle(p.BOLD);
    p.text('로그인', cx - 55, accountAreaY + 33);
    p.text('회원가입', cx + 55, accountAreaY + 33);
    p.textStyle(p.NORMAL);
  }

  // ── 게임 방법 팝업
  if (showHowto) {
    p.fill(0, 0, 0, 210); p.noStroke(); p.rect(0, 0, CANVAS_W, CANVAS_H);
    const pw = 400, ph = 310;
    const px = cx - pw / 2, py = CANVAS_H / 2 - ph / 2;
    p.fill(0,0,0,120); p.rect(px+6, py+6, pw, ph, 14);
    p.fill(8, 16, 8);
    p.stroke(0, 200, 60); p.strokeWeight(2); p.rect(px, py, pw, ph, 14);
    p.fill(0, 80, 20); p.noStroke(); p.rect(px, py, pw, 46, 14, 14, 0, 0);
    p.textStyle(p.BOLD); p.fill('#A5D6A7'); p.textSize(14);
    p.textAlign(p.LEFT, p.CENTER); p.text('📖  게임 방법', px+20, py+23);
    p.textStyle(p.NORMAL);
    p.fill(80,20,20); p.stroke('#E53935'); p.strokeWeight(1);
    p.rect(px+pw-36, py+8, 28, 28, 6);
    p.noStroke(); p.fill(255); p.textSize(13); p.textAlign(p.CENTER, p.CENTER);
    p.text('✕', px+pw-22, py+22);
    const lines = [
      ['⏱','협력 30초  →  배신 30초'],
      ['🐾','꼬리를 뻗다 자기 땅으로 돌아오면 영역 확보'],
      ['💀','상대 꼬리를 끊으면 사망'],
      ['🧟','좀비 꼬리를 밟으면 좀비 사망'],
      ['💊','약 :  보너스 땅 획득'],
      ['🩸','피 :  좀비 가속'],
      ['⚡','에너지드링크 :  속도 2배 + 강철꼬리'],
    ];
    const emojiX = px+26, textX = px+56;
    for (let i = 0; i < lines.length; i++) {
      const ly = py + 80 + i * 32;
      if (i === 4) {
        p.stroke(30,80,30); p.strokeWeight(1);
        p.line(px+16, ly-10, px+pw-16, ly-10);
        p.noStroke(); p.fill(50,100,50); p.textSize(9); p.textAlign(p.LEFT, p.TOP);
        p.text('ITEMS', emojiX, ly-8);
      }
      p.noStroke(); p.textSize(15); p.textAlign(p.LEFT, p.CENTER); p.fill(255);
      p.text(lines[i][0], emojiX, ly);
      p.fill(150, 200, 150); p.textSize(11);
      p.text(lines[i][1], textX, ly);
    }
  }

  // ── 로그인/회원가입 팝업
  if (lobbySubState === 'login' || lobbySubState === 'register') {
    p.fill(0,0,0,215); p.noStroke(); p.rect(0,0,CANVAS_W,CANVAS_H);
    const pw=340, ph=210, px=cx-pw/2, py=CANVAS_H/2-ph/2;
    p.fill(0,0,0,100); p.rect(px+6,py+6,pw,ph,14);
    p.fill(12,12,20);
    const popCol = lobbySubState==='login' ? '#1565C0' : '#2E7D32';
    p.stroke(popCol); p.strokeWeight(2); p.rect(px,py,pw,ph,14);
    p.fill(lobbySubState==='login' ? '#0D47A1' : '#1B5E20'); p.noStroke();
    p.rect(px,py,pw,44,14,14,0,0);
    p.textStyle(p.BOLD); p.fill(240); p.textSize(14);
    p.textAlign(p.CENTER, p.CENTER);
    p.text(lobbySubState==='login' ? '🔑  로그인' : '📝  회원가입', cx, py+22);
    p.textStyle(p.NORMAL);
    p.fill(60,20,20); p.stroke('#E53935'); p.strokeWeight(1);
    p.rect(px+pw-36,py+8,28,28,6);
    p.noStroke(); p.fill(255); p.textSize(13); p.textAlign(p.CENTER,p.CENTER);
    p.text('✕', px+pw-22, py+22);
    p.fill(110); p.textSize(11); p.textAlign(p.CENTER,p.TOP);
    p.text(lobbySubState==='login'?'아이디를 입력하세요 (최대 16자)':'새 아이디를 입력하세요 (최대 16자)', cx, py+54);
    const ibX=px+20, ibY=py+78, ibW=pw-40, ibH=36;
    p.fill(16,16,28); p.stroke(90); p.strokeWeight(1.5); p.rect(ibX,ibY,ibW,ibH,6);
    p.noStroke(); p.fill(220); p.textSize(14); p.textAlign(p.LEFT,p.CENTER);
    p.text(inputBuffer+(Math.floor(p.frameCount/15)%2===0?'|':''), ibX+10, ibY+ibH/2);
    if (inputError) { p.fill('#FF5252'); p.textSize(11); p.textAlign(p.CENTER,p.TOP); p.text(inputError,cx,py+122); }
    const popBtnY=py+ph-54;
    p.fill(lobbySubState==='login'?'#1565C0':'#2E7D32');
    p.stroke(lobbySubState==='login'?'#42A5F5':'#4CAF50'); p.strokeWeight(1);
    p.rect(cx-70,popBtnY,140,36,8);
    p.noStroke(); p.textStyle(p.BOLD); p.fill(255); p.textSize(13);
    p.textAlign(p.CENTER,p.CENTER);
    p.text('확인 (Enter)', cx, popBtnY+18);
    p.textStyle(p.NORMAL);
  }
}

function _updateDrawBloodDrops(p) {
  p.noStroke();
  for (const d of bloodDrops) {
    if (!d || !d.drip) continue;
    const r = 130, g = 0, b = 0;
    const a = d.alpha;

    // 1. 중심 큰 스플래터 덩어리
    p.fill(r, g, b, a);
    p.ellipse(d.x, d.y, d.size, d.size * 0.88);

    // 2. 방향성 드립 (긴 줄기)
    p.fill(r, g, b, a * 0.85);
    if (d.drip === 'down') {
      p.rect(d.x - d.dripW / 2, d.y + d.size * 0.4, d.dripW, d.dripLen, 0, 0, d.dripW, d.dripW);
      p.ellipse(d.x, d.y + d.size * 0.4 + d.dripLen, d.dripW * 1.4, d.dripW * 1.4);
    } else if (d.drip === 'up') {
      p.rect(d.x - d.dripW / 2, d.y - d.size * 0.4 - d.dripLen, d.dripW, d.dripLen, d.dripW, d.dripW, 0, 0);
      p.ellipse(d.x, d.y - d.size * 0.4 - d.dripLen, d.dripW * 1.4, d.dripW * 1.4);
    } else if (d.drip === 'right') {
      p.rect(d.x + d.size * 0.4, d.y - d.dripW / 2, d.dripLen, d.dripW, 0, d.dripW, d.dripW, 0);
      p.ellipse(d.x + d.size * 0.4 + d.dripLen, d.y, d.dripW * 1.4, d.dripW * 1.4);
    } else if (d.drip === 'left') {
      p.rect(d.x - d.size * 0.4 - d.dripLen, d.y - d.dripW / 2, d.dripLen, d.dripW, d.dripW, 0, 0, d.dripW);
      p.ellipse(d.x - d.size * 0.4 - d.dripLen, d.y, d.dripW * 1.4, d.dripW * 1.4);
    }

    // 3. 위성 튀김 소방울
    for (let i = 0; i < d.satellites; i++) {
      const s = d.satOffsets[i];
      p.fill(r, g, b, a * 0.7);
      p.ellipse(d.x + s.ox, d.y + s.oy, s.r, s.r * 0.85);
    }
  }
}
