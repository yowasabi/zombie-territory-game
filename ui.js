// =============================================
// ui.js — 화면에 보이는 정보
//   - 타이머, 영역 비율 바, 결과 화면
//   - 배신 페이즈 오버레이
// =============================================

function drawUI(p, phase, timeLeft, counts) {
  p.push();
  p.textFont('monospace');

  // ── 상단 HUD 배경 ──
  const hudH = 36;
  p.noStroke();
  p.fill(0, 0, 0, 200);
  p.rect(0, 0, CANVAS_W, hudH);

  // ── 영역 비율 바 ──
  const totalTiles = ROWS * COLS;
  const aCount = counts.A + counts.team * 0.5; // 협력 페이즈엔 팀 절반씩
  const bCount = counts.B + counts.team * 0.5;
  const aRatio = (phase === PHASE_COOP) ? (counts.team / totalTiles) : (counts.A / totalTiles);
  const bRatio = (phase === PHASE_COOP) ? (counts.team / totalTiles) : (counts.B / totalTiles);

  const barX = 10, barY = 22, barW = CANVAS_W - 20, barH = 8;

  // 바 배경
  p.fill(40);
  p.rect(barX, barY, barW, barH, 4);

  if (phase === PHASE_COOP) {
    // 팀 영역을 초록으로
    const w = (counts.team / totalTiles) * barW;
    p.fill(COLOR_TEAM);
    p.rect(barX, barY, w, barH, 4);
  } else {
    // A: 왼쪽, B: 오른쪽
    const wA = (counts.A / totalTiles) * barW;
    const wB = (counts.B / totalTiles) * barW;
    p.fill(COLOR_A);
    p.rect(barX, barY, wA, barH, 4, 0, 0, 4);
    p.fill(COLOR_B);
    p.rect(barX + barW - wB, barY, wB, barH, 0, 4, 4, 0);
    // 영역 수치
    p.fill(COLOR_A);
    p.textSize(10);
    p.textAlign(p.LEFT, p.CENTER);
    p.text(`A: ${counts.A}`, barX, 10);
    p.fill(COLOR_B);
    p.textAlign(p.RIGHT, p.CENTER);
    p.text(`B: ${counts.B}`, barX + barW, 10);
  }

  // ── 타이머 ──
  const mins = Math.floor(timeLeft / 60);
  const secs = Math.floor(timeLeft % 60);
  const timeStr = `${mins}:${secs.toString().padStart(2, '0')}`;

  p.textAlign(p.CENTER, p.CENTER);
  if (phase === PHASE_BETRAYAL) {
    // 빨간 카운트다운
    p.fill(timeLeft < 10 ? (p.frameCount % 10 < 5 ? '#FF1744' : '#FF8A80') : '#FF5252');
    p.textSize(16);
    p.text(`⚠ 배신 ${timeStr} ⚠`, CANVAS_W / 2, 10);
  } else {
    p.fill(220);
    p.textSize(13);
    p.text(timeStr, CANVAS_W / 2, 10);
  }

  // ── 페이즈 라벨 ──
  p.textSize(9);
  p.textAlign(p.CENTER, p.BOTTOM);
  if (phase === PHASE_COOP) {
    p.fill('#4CAF50');
    p.text('[ 협력 페이즈 ]', CANVAS_W / 2, 33);
  } else if (phase === PHASE_BETRAYAL) {
    p.fill('#FF5252');
    p.text('[ 배신 페이즈 — 팀원도 적! ]', CANVAS_W / 2, 33);
  }

  // ── 배신 페이즈 빨간 테두리 ──
  if (phase === PHASE_BETRAYAL) {
    const alpha = 80 + Math.sin(p.frameCount * 0.1) * 40;
    p.noFill();
    p.stroke(255, 50, 50, alpha);
    p.strokeWeight(6);
    p.rect(3, 3, CANVAS_W - 6, CANVAS_H - 6, 2);
    p.noStroke();
  }

  // ── 플레이어 상태 표시 ──
  _drawPlayerStatus(p, playerA, 10, hudH + 4, 'A');
  _drawPlayerStatus(p, playerB, CANVAS_W - 10, hudH + 4, 'B');

  p.pop();
}

function _drawPlayerStatus(p, player, x, y, label) {
  if (!player) return;
  p.textSize(10);
  p.noStroke();

  const icons = [];
  if (player.boostTimer > 0) icons.push('⚡');
  if (player.steelTailTimer > 0) icons.push('🛡');

  const col = (label === 'A') ? COLOR_A : COLOR_B;
  p.fill(col);
  p.textAlign(label === 'A' ? p.LEFT : p.RIGHT, p.TOP);
  const statusStr = `P${label} ${!player.alive ? '💀' : ''} ${icons.join('')}`;
  p.text(statusStr, x, y);
}

// ── 결과 화면 ──
function drawResultScreen(p, counts, winner) {
  // 반투명 배경
  p.fill(0, 0, 0, 200);
  p.noStroke();
  p.rect(0, 0, CANVAS_W, CANVAS_H);

  const cx = CANVAS_W / 2;
  const cy = CANVAS_H / 2;

  // 결과 패널
  p.fill(20, 20, 30, 240);
  p.stroke(80);
  p.strokeWeight(1);
  p.rect(cx - 180, cy - 120, 360, 240, 12);

  p.noStroke();

  // 제목
  p.textAlign(p.CENTER, p.CENTER);
  p.textSize(22);
  p.fill(255);
  p.text('게임 종료', cx, cy - 90);

  // 승자
  p.textSize(32);
  if (winner === 'A') {
    p.fill(COLOR_A);
    p.text('플레이어 A 승리! 🏆', cx, cy - 40);
  } else if (winner === 'B') {
    p.fill(COLOR_B);
    p.text('플레이어 B 승리! 🏆', cx, cy - 40);
  } else if (winner === 'draw') {
    p.fill('#FFD600');
    p.text('무승부!', cx, cy - 40);
  } else if (winner === 'zombie') {
    p.fill('#AB47BC');
    p.text('좀비의 승리... 😱', cx, cy - 40);
  }

  // 영역 통계
  p.textSize(14);
  p.fill(COLOR_A);
  p.text(`A 영역: ${counts.A} 타일`, cx, cy + 10);
  p.fill(COLOR_B);
  p.text(`B 영역: ${counts.B} 타일`, cx, cy + 32);

  // 재시작 버튼 영역 (sketch.js에서 클릭 감지)
  p.fill(50, 50, 70);
  p.stroke(120);
  p.strokeWeight(1);
  p.rect(cx - 70, cy + 65, 140, 36, 8);
  p.noStroke();
  p.fill(200);
  p.textSize(14);
  p.text('다시 시작 (R)', cx, cy + 84);
}

// ── 배신 타이머 발동 연출 ──
let betrayalAnnounceFade = 0;

function showBetrayalAnnounce(p) {
  betrayalAnnounceFade = 90; // 3초
}

function drawBetrayalAnnounce(p) {
  if (betrayalAnnounceFade <= 0) return;
  betrayalAnnounceFade--;
  const alpha = Math.min(255, betrayalAnnounceFade * 4);
  p.fill(200, 0, 0, alpha);
  p.noStroke();
  p.rect(0, CANVAS_H / 2 - 40, CANVAS_W, 80);
  p.fill(255, 255, 255, alpha);
  p.textAlign(p.CENTER, p.CENTER);
  p.textSize(28);
  p.text('⚠ 배신 타이머 발동! ⚠', CANVAS_W / 2, CANVAS_H / 2);
  p.textSize(14);
  p.text('이제 팀원도 적입니다', CANVAS_W / 2, CANVAS_H / 2 + 24);
}

// ── 로비 화면 ──
function drawLobby(p) {
  p.background(10, 10, 15);

  const cx = CANVAS_W / 2;
  const cy = CANVAS_H / 2;

  // 제목
  p.textAlign(p.CENTER, p.CENTER);
  p.textSize(50);
  p.fill('#4CAF50');
  p.text('ZOMBIE SLIDE', cx, cy - 150);
  p.textSize(30);
  p.text('DUO',cx,cy - 100);

  p.textSize(14);
  p.fill(180);
  p.text('2인 협력 → 배신 영역 점령 게임', cx, cy - 75);

  // 조작법
  p.textSize(13);
  p.fill(COLOR_A);
  p.text('플레이어 A: W A S D', cx - 100, cy - 20);
  p.fill(COLOR_B);
  p.text('플레이어 B: ↑ ↓ ← →', cx + 100, cy - 20);

  p.textSize(12);
  p.fill(160);
  p.text('협력 페이즈: 팀으로 좀비에 맞서 영역 확장', cx, cy + 20);
  p.text('배신 페이즈: 마지막 1분, 더 많은 영역 보유자 승리!', cx, cy + 42);

  // 특수 타일 설명
  p.textSize(11);
  p.fill(255, 165, 0);
  p.text('💣 영역 폭탄  |  🧟 좀비 소환  |  ⚡ 속도 2배 + 강철꼬리', cx, cy + 75);

  // 시작 버튼
  const blink = Math.floor(p.frameCount / 20) % 2 === 0;
  p.fill(blink ? '#4CAF50' : '#2E7D32');
  p.noStroke();
  p.rect(cx - 90, cy + 100, 180, 44, 10);
  p.fill(255);
  p.textSize(16);
  p.text('시작하기 (SPACE)', cx, cy + 123);
}
