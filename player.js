// =============================================
// player.js — 플레이어 관련 모든 것
//   - 이동, 꼬리, 충돌 판정, 특수 타일 효과 적용
// =============================================

class Player {
  constructor(id, startR, startC, keyUp, keyDown, keyLeft, keyRight) {
    this.id = id;           // 'A' or 'B'
    this.r = startR;
    this.c = startC;
    this.dr = 0;
    this.dc = (id === 'A') ? 1 : -1; // 초기 방향
    this.nextDr = this.dr;
    this.nextDc = this.dc;

    this.keys = { up: keyUp, down: keyDown, left: keyLeft, right: keyRight };

    this.alive = true;
    this.tail = []; // [{r, c}, ...] 귀환 전 지나온 타일

    // 현재 owner 레이블 (페이즈에 따라 변경)
    this.owner = OWNER_TEAM;

    // 특수 타일 효과 타이머 (프레임 단위)
    this.boostTimer = 0;      // 속도 부스터 남은 프레임
    this.steelTailTimer = 0;  // 강철꼬리 남은 프레임
    this.bombFlash = 0;       // 영역 폭탄 시각 효과 남은 프레임

    // 누적 이동 (소수점)
    this.moveAccum = 0;

    // 표시 색상
    this.color = (id === 'A') ? COLOR_A : COLOR_B;
    this.teamColor = COLOR_TEAM;
  }

  // 소유 색 (현재 페이즈 기준)
  get displayColor() {
    if (this.owner === OWNER_TEAM) return COLOR_TEAM;
    return (this.id === 'A') ? COLOR_A : COLOR_B;
  }

  setPhase(phase) {
    if (phase === PHASE_COOP) {
      this.owner = OWNER_TEAM;
    } else {
      this.owner = (this.id === 'A') ? OWNER_A : OWNER_B;
    }
  }

  // 키 입력 처리 (p5.js keyCode 사용)
  handleKeyPressed(kc) {
    if (kc === this.keys.up    && this.dr !== 1)  { this.nextDr = -1; this.nextDc = 0; }
    if (kc === this.keys.down  && this.dr !== -1) { this.nextDr = 1;  this.nextDc = 0; }
    if (kc === this.keys.left  && this.dc !== 1)  { this.nextDr = 0;  this.nextDc = -1; }
    if (kc === this.keys.right && this.dc !== -1) { this.nextDr = 0;  this.nextDc = 1; }
  }

  get speed() {
    const base = PLAYER_SPEED;
    return (this.boostTimer > 0) ? base * BOOST_MULTIPLIER : base;
  }

  update(otherPlayer, zombies, phase, p) {
    if (!this.alive) return;

    // 타이머 감소
    if (this.boostTimer > 0) this.boostTimer--;
    if (this.steelTailTimer > 0) this.steelTailTimer--;
    if (this.bombFlash > 0) this.bombFlash--;

    // 누적 이동
    this.moveAccum += this.speed / FRAME_RATE;

    while (this.moveAccum >= 1) {
      this.moveAccum -= 1;
      this._step(otherPlayer, zombies, phase, p);
      if (!this.alive) return;
    }

    // 특수 타일 충돌
    checkTilePickup(this, zombies, phase, p);
  }

  _step(otherPlayer, zombies, phase, p) {
    // 방향 적용
    this.dr = this.nextDr;
    this.dc = this.nextDc;

    // 정지 상태면 이동 안 함
    if (this.dr === 0 && this.dc === 0) return;

    const nr = this.r + this.dr;
    const nc = this.c + this.dc;

    // ── 경계 충돌 → 사망 ──
    if (nr < 0 || nr >= ROWS || nc < 0 || nc >= COLS) {
      this._die();
      return;
    }

    // ── 꼬리 관리 ──
    const currentOwner = getOwner(this.r, this.c);
    const onOwnedTile = (currentOwner === this.owner);

    if (onOwnedTile) {
      // 소유 영역 안: 꼬리가 있으면 닫기 (flood fill)
      if (this.tail.length > 0) {
        const tailSet = new Set(this.tail.map(t => `${t.r},${t.c}`));
        floodFillEnclosed(tailSet, this.owner, p);
        this.tail = [];
      }
    } else {
      // 소유 영역 밖: 꼬리 추가
      this.tail.push({ r: this.r, c: this.c });
    }

    // ── 충돌 판정 ──

    // 1. 자기 꼬리 충돌
    if (this.tail.some(t => t.r === nr && t.c === nc)) {
      if (this.steelTailTimer > 0) {
        // 강철꼬리: 자기 꼬리 무적 (통과)
      } else {
        this._die(); return;
      }
    }

    // 2. 상대 꼬리 충돌 (배신 페이즈 또는 상대 꼬리가 내 위치)
    if (otherPlayer && otherPlayer.alive) {
      const hitsOtherTail = otherPlayer.tail.some(t => t.r === nr && t.c === nc);
      if (hitsOtherTail) {
        // 상대 강철꼬리라면 상대 꼬리가 보호됨 → 나만 사망
        if (this.steelTailTimer > 0 && otherPlayer.steelTailTimer === 0) {
          // 강철꼬리로 상대 꼬리 자름
          otherPlayer._cutTailAt(nr, nc);
        } else if (otherPlayer.steelTailTimer > 0) {
          // 상대 강철꼬리: 나 사망
          this._die(); return;
        } else {
          // 일반: 상대 꼬리 자름
          otherPlayer._cutTailAt(nr, nc);
        }
      }
      // 협력 페이즈: 상대 꼬리 밟아도 무적
      if (phase === PHASE_COOP) {
        // 상대 꼬리 충돌 무시 (이미 위에서 처리했지만 사망 방지)
      }
    }

    // 3. 좀비 본체/꼬리 충돌
    for (const z of zombies) {
      if (!z.alive) continue;
      // 내 위치가 좀비 위치
      if (z.r === nr && z.c === nc) {
        this._die(); return;
      }
      // 좀비 꼬리
      if (z.tail.some(t => t.r === nr && t.c === nc)) {
        this._die(); return;
      }
    }

    // 이동
    this.r = nr;
    this.c = nc;
  }

  // 꼬리 특정 위치에서 자르기 (그 이후 꼬리 삭제)
  _cutTailAt(r, c) {
    const idx = this.tail.findIndex(t => t.r === r && t.c === c);
    if (idx !== -1) {
      // 잘린 이후 꼬리를 NONE으로 복원
      for (let i = idx; i < this.tail.length; i++) {
        setOwner(this.tail[i].r, this.tail[i].c, OWNER_NONE);
      }
      this.tail.splice(idx);
    }
  }

  _die() {
    this.alive = false;
    // 꼬리 영역 반환
    for (const t of this.tail) {
      setOwner(t.r, t.c, OWNER_NONE);
    }
    this.tail = [];
  }

  draw(p) {
    if (!this.alive) return;

    // 꼬리 그리기
    const tailCol = (this.steelTailTimer > 0) ? '#B0BEC5' : this.displayColor;
    p.noStroke();
    for (const t of this.tail) {
      p.fill(tailCol);
      p.rect(t.c * TILE_SIZE + 3, t.r * TILE_SIZE + 3, TILE_SIZE - 6, TILE_SIZE - 6, 2);
    }

    // 본체
    const x = this.c * TILE_SIZE;
    const y = this.r * TILE_SIZE;

    // 부스터 글로우
    if (this.boostTimer > 0) {
      p.fill(0, 230, 230, 60);
      p.noStroke();
      p.rect(x - 3, y - 3, TILE_SIZE + 6, TILE_SIZE + 6, 6);
    }

    // 폭탄 플래시
    if (this.bombFlash > 0 && Math.floor(p.frameCount / 3) % 2 === 0) {
      p.fill(255, 200, 0, 120);
      p.noStroke();
      p.rect(x - 4, y - 4, TILE_SIZE + 8, TILE_SIZE + 8, 6);
    }

    // 플레이어 바디
    p.fill(this.displayColor);
    p.noStroke();
    p.rect(x + 1, y + 1, TILE_SIZE - 2, TILE_SIZE - 2, 5);

    // ID 레이블
    p.fill(255);
    p.textAlign(p.CENTER, p.CENTER);
    p.textSize(10);
    p.text(this.id, x + TILE_SIZE / 2, y + TILE_SIZE / 2);

    // 강철꼬리 표시
    if (this.steelTailTimer > 0) {
      p.fill(255, 255, 255, 200);
      p.textSize(7);
      p.text('⚙', x + TILE_SIZE - 4, y + 4);
    }
  }
}

// ── 플레이어 인스턴스 ──
// Player A: WASD
// Player B: 방향키 (LEFT=37, UP=38, RIGHT=39, DOWN=40)
let playerA, playerB;

function initPlayers() {
  // W=87, A=65, S=83, D=68
  playerA = new Player('A', 5, 5, 87, 83, 65, 68);
  // 방향키
  playerB = new Player('B', ROWS - 6, COLS - 6, 38, 40, 37, 39);

  // 시작 영역 부여
  for (let r = 3; r <= 7; r++)
    for (let c = 3; c <= 7; c++)
      setOwner(r, c, OWNER_TEAM);
  for (let r = ROWS-8; r <= ROWS-4; r++)
    for (let c = COLS-8; c <= COLS-4; c++)
      setOwner(r, c, OWNER_TEAM);
}
