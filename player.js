// player.js — 플레이어 이동, 꼬리, 충돌 판정

class Player {
  constructor(id, startR, startC, keyUp, keyDown, keyLeft, keyRight, initDr, initDc) {
    this.id = id;
    this.r = startR;
    this.c = startC;
    // 게임 시작 시 자동으로 움직임 (초기 방향 설정)
    this.dr = initDr;
    this.dc = initDc;
    this.nextDr = initDr;
    this.nextDc = initDc;

    this.keys = { up: keyUp, down: keyDown, left: keyLeft, right: keyRight };

    this.alive = true;
    this.tail = [];
    this.owner = OWNER_TEAM;

    this.boostTimer = 0;
    this.steelTailTimer = 0;
    this.bombFlash = 0;
    this.moveAccum = 0;
  }

  get displayColor() {
    if (this.owner === OWNER_TEAM) return COLOR_TEAM;
    return this.id === 'A' ? COLOR_A : COLOR_B;
  }

  setPhase(phase) {
    this.owner = phase === PHASE_COOP ? OWNER_TEAM
               : this.id === 'A' ? OWNER_A : OWNER_B;
  }

  handleKeyPressed(kc) {
    if (kc === this.keys.up    && this.nextDr !== 1)  { this.nextDr = -1; this.nextDc = 0; }
    if (kc === this.keys.down  && this.nextDr !== -1) { this.nextDr = 1;  this.nextDc = 0; }
    if (kc === this.keys.left  && this.nextDc !== 1)  { this.nextDr = 0;  this.nextDc = -1; }
    if (kc === this.keys.right && this.nextDc !== -1) { this.nextDr = 0;  this.nextDc = 1; }
  }

  get speed() {
    return this.boostTimer > 0 ? PLAYER_SPEED * BOOST_MULTIPLIER : PLAYER_SPEED;
  }

  update(otherPlayer, zombiesArr, phase, p) {
    if (!this.alive) return;
    if (this.boostTimer > 0) this.boostTimer--;
    if (this.steelTailTimer > 0) this.steelTailTimer--;
    if (this.bombFlash > 0) this.bombFlash--;

    this.moveAccum += this.speed / FRAME_RATE;
    while (this.moveAccum >= 1) {
      this.moveAccum -= 1;
      this._step(otherPlayer, zombiesArr, phase, p);
      if (!this.alive) return;
    }
    checkTilePickup(this, zombiesArr, phase, p);
  }

  _step(otherPlayer, zombiesArr, phase, p) {
    this.dr = this.nextDr;
    this.dc = this.nextDc;
    if (this.dr === 0 && this.dc === 0) return;

    let nr = this.r + this.dr;
    let nc = this.c + this.dc;

    // 맵 경계: 죽지 않고 막힘 (반대편으로 이동 불가, 그냥 멈춤)
    if (nr < 0 || nr >= ROWS || nc < 0 || nc >= COLS) {
      nr = this.r;
      nc = this.c;
      // 방향 반전
      this.nextDr = -this.dr;
      this.nextDc = -this.dc;
      this.dr = this.nextDr;
      this.dc = this.nextDc;
      return;
    }

    // 꼬리 관리
    const onOwned = getOwner(this.r, this.c) === this.owner;
    if (onOwned) {
      if (this.tail.length > 0) {
        const tailSet = new Set(this.tail.map(t => `${t.r},${t.c}`));
        floodFillEnclosed(tailSet, this.owner, p);
        this.tail = [];
      }
    } else {
      this.tail.push({ r: this.r, c: this.c });
    }

    // 자기 꼬리 충돌 → 죽음 (강철꼬리면 무적)
    if (this.tail.some(t => t.r === nr && t.c === nc)) {
      if (this.steelTailTimer <= 0) { this._die(); return; }
    }

    // 머리끼리 충돌 → 죽지 않고 밀려남
    if (otherPlayer && otherPlayer.alive && otherPlayer.r === nr && otherPlayer.c === nc) {
      // 서로 반대 방향으로 밀림
      this.nextDr = -this.dr;
      this.nextDc = -this.dc;
      return; // 이동 취소
    }

    // 상대 꼬리 충돌 → 꼬리 끊기 → 상대 즉사 (모든 페이즈, 강철꼬리 예외)
    if (otherPlayer && otherPlayer.alive) {
      const hitIdx = otherPlayer.tail.findIndex(t => t.r === nr && t.c === nc);
      if (hitIdx !== -1) {
        if (otherPlayer.steelTailTimer > 0) {
          // 상대 강철꼬리: 내가 밀려남
          this.nextDr = -this.dr;
          this.nextDc = -this.dc;
          return;
        } else {
          // 꼬리 끊기 → 상대 즉사
          otherPlayer._cutTailAt(nr, nc);
        }
      }
    }

    // 좀비 본체와 머리 충돌 → 밀려남 (죽지 않음)
    for (const z of zombiesArr) {
      if (!z.alive) continue;
      if (z.r === nr && z.c === nc) {
        // 좀비 본체와 머리 충돌: 밀려남
        this.nextDr = -this.dr;
        this.nextDc = -this.dc;
        return;
      }
      // 좀비 꼬리 밟으면 → 좀비 사망 (플레이어 생존)
      if (z.tail.some(t => t.r === nr && t.c === nc)) {
        z.cutTailAt(nr, nc);
        break;
      }
    }

    this.r = nr;
    this.c = nc;
  }

  _cutTailAt(r, c) {
    const idx = this.tail.findIndex(t => t.r === r && t.c === c);
    if (idx !== -1) {
      for (let i = idx; i < this.tail.length; i++) {
        setOwner(this.tail[i].r, this.tail[i].c, OWNER_NONE);
      }
      this.tail.splice(idx);
      this._die();
    }
  }

  _die() {
    this.alive = false;
    for (const t of this.tail) setOwner(t.r, t.c, OWNER_NONE);
    this.tail = [];
  }

  revive(r, c, owner) {
    this.alive = true;
    this.r = r; this.c = c;
    this.dr = 0; this.dc = 1;
    this.nextDr = 0; this.nextDc = 1;
    this.tail = [];
    this.moveAccum = 0;
    this.boostTimer = 0;
    this.steelTailTimer = 0;
    this.owner = owner;
  }

  draw(p) {
    if (!this.alive) return;
    // 꼬리
    const tailCol = this.steelTailTimer > 0 ? '#B0BEC5' : this.displayColor;
    p.noStroke();
    for (const t of this.tail) {
      p.fill(tailCol);
      p.rect(t.c*TILE_SIZE+3, t.r*TILE_SIZE+3, TILE_SIZE-6, TILE_SIZE-6, 2);
    }
    const x = this.c*TILE_SIZE, y = this.r*TILE_SIZE;
    if (this.boostTimer > 0) {
      p.fill(0, 230, 230, 60); p.noStroke();
      p.rect(x-3, y-3, TILE_SIZE+6, TILE_SIZE+6, 6);
    }
    if (this.bombFlash > 0 && Math.floor(p.frameCount/3) % 2 === 0) {
      p.fill(255, 200, 0, 120); p.noStroke();
      p.rect(x-4, y-4, TILE_SIZE+8, TILE_SIZE+8, 6);
    }
    p.fill(this.displayColor); p.noStroke();
    p.rect(x+1, y+1, TILE_SIZE-2, TILE_SIZE-2, 5);
    p.fill(255); p.textAlign(p.CENTER, p.CENTER); p.textSize(10);
    p.text(this.id, x+TILE_SIZE/2, y+TILE_SIZE/2);
    if (this.steelTailTimer > 0) {
      p.fill(255,255,255,200); p.textSize(7);
      p.text('⚙', x+TILE_SIZE-4, y+4);
    }
  }
}

let playerA, playerB;

function initPlayers() {
  const midR = Math.floor(ROWS/2);
  const midC = Math.floor(COLS/2);
  // 시작 시 자동으로 움직임: A는 왼쪽, B는 오른쪽
  playerA = new Player('A', midR, midC-2, 87, 83, 65, 68, 0, -1);
  playerB = new Player('B', midR, midC+2, 38, 40, 37, 39, 0,  1);

  // 공동 시작 영역
  for (let r = midR-2; r <= midR+2; r++)
    for (let c = midC-4; c <= midC+4; c++)
      setOwner(r, c, OWNER_TEAM);
}
