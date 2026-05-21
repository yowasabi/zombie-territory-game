// =============================================
// player.js — 플레이어 관련 모든 것
// =============================================

class Player {
  constructor(id, startR, startC, keyUp, keyDown, keyLeft, keyRight) {
    this.id = id;
    this.r = startR;
    this.c = startC;
    this.dr = 0;
    this.dc = 0; // 초기 정지
    this.nextDr = 0;
    this.nextDc = 0;

    this.keys = { up: keyUp, down: keyDown, left: keyLeft, right: keyRight };

    this.alive = true;
    this.tail = [];
    this.owner = OWNER_TEAM;

    this.boostTimer = 0;
    this.steelTailTimer = 0;
    this.bombFlash = 0;
    this.moveAccum = 0;

    this.color = (id === 'A') ? COLOR_A : COLOR_B;
  }

  get displayColor() {
    if (this.owner === OWNER_TEAM) return COLOR_TEAM;
    return (this.id === 'A') ? COLOR_A : COLOR_B;
  }

  setPhase(phase) {
    this.owner = (phase === PHASE_COOP) ? OWNER_TEAM
               : (this.id === 'A') ? OWNER_A : OWNER_B;
  }

  handleKeyPressed(kc) {
    if (kc === this.keys.up    && this.nextDr !== 1)  { this.nextDr = -1; this.nextDc = 0; }
    if (kc === this.keys.down  && this.nextDr !== -1) { this.nextDr = 1;  this.nextDc = 0; }
    if (kc === this.keys.left  && this.nextDc !== 1)  { this.nextDr = 0;  this.nextDc = -1; }
    if (kc === this.keys.right && this.nextDc !== -1) { this.nextDr = 0;  this.nextDc = 1; }
  }

  get speed() {
    return (this.boostTimer > 0) ? PLAYER_SPEED * BOOST_MULTIPLIER : PLAYER_SPEED;
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

    const nr = this.r + this.dr;
    const nc = this.c + this.dc;

    // 경계 충돌
    if (nr < 0 || nr >= ROWS || nc < 0 || nc >= COLS) { this._die(); return; }

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

    // 자기 꼬리 충돌
    if (this.tail.some(t => t.r === nr && t.c === nc)) {
      if (this.steelTailTimer <= 0) { this._die(); return; }
    }

    // 상대 꼬리 충돌
    if (otherPlayer && otherPlayer.alive) {
      const hitsOther = otherPlayer.tail.some(t => t.r === nr && t.c === nc);
      if (hitsOther) {
        if (this.steelTailTimer > 0 && otherPlayer.steelTailTimer === 0) {
          otherPlayer._cutTailAt(nr, nc);
        } else if (otherPlayer.steelTailTimer > 0) {
          if (this.steelTailTimer === 0) { this._die(); return; }
        } else {
          if (phase !== PHASE_COOP) {
            otherPlayer._cutTailAt(nr, nc);
          }
        }
      }
    }

    // 좀비 충돌 확인 및 좀비 꼬리 끊기
    for (const z of zombiesArr) {
      if (!z.alive) continue;
      if (z.r === nr && z.c === nc) { this._die(); return; }
      // 플레이어가 좀비 꼬리를 밟으면 → 좀비 사망
      if (z.tail.some(t => t.r === nr && t.c === nc)) {
        z.cutTailAt(nr, nc); // 좀비 사망
        // 플레이어는 살아남음 (꼬리 끊기 보상)
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
    }
  }

  _die() {
    this.alive = false;
    for (const t of this.tail) setOwner(t.r, t.c, OWNER_NONE);
    this.tail = [];
  }

  // 부활: 중앙 영역 근처에 소환
  revive(r, c, areaOwner) {
    this.alive = true;
    this.r = r;
    this.c = c;
    this.dr = 0; this.dc = 0;
    this.nextDr = 0; this.nextDc = 0;
    this.tail = [];
    this.moveAccum = 0;
    this.boostTimer = 0;
    this.steelTailTimer = 0;
    this.owner = areaOwner;
  }

  draw(p) {
    if (!this.alive) return;

    // 꼬리
    const tailCol = (this.steelTailTimer > 0) ? '#B0BEC5' : this.displayColor;
    p.noStroke();
    for (const t of this.tail) {
      p.fill(tailCol);
      p.rect(t.c * TILE_SIZE + 3, t.r * TILE_SIZE + 3, TILE_SIZE - 6, TILE_SIZE - 6, 2);
    }

    const x = this.c * TILE_SIZE;
    const y = this.r * TILE_SIZE;

    if (this.boostTimer > 0) {
      p.fill(0, 230, 230, 60);
      p.noStroke();
      p.rect(x - 3, y - 3, TILE_SIZE + 6, TILE_SIZE + 6, 6);
    }
    if (this.bombFlash > 0 && Math.floor(p.frameCount / 3) % 2 === 0) {
      p.fill(255, 200, 0, 120);
      p.noStroke();
      p.rect(x - 4, y - 4, TILE_SIZE + 8, TILE_SIZE + 8, 6);
    }

    p.fill(this.displayColor);
    p.noStroke();
    p.rect(x + 1, y + 1, TILE_SIZE - 2, TILE_SIZE - 2, 5);
    p.fill(255);
    p.textAlign(p.CENTER, p.CENTER);
    p.textSize(10);
    p.text(this.id, x + TILE_SIZE / 2, y + TILE_SIZE / 2);

    if (this.steelTailTimer > 0) {
      p.fill(255, 255, 255, 200);
      p.textSize(7);
      p.text('⚙', x + TILE_SIZE - 4, y + 4);
    }
  }
}

let playerA, playerB;

function initPlayers() {
  const midR = Math.floor(ROWS / 2);
  const midC = Math.floor(COLS / 2);

  // W=87(위), S=83(아래), A=65(왼쪽), D=68(오른쪽)
  playerA = new Player('A', midR, midC - 2, 87, 83, 65, 68);
  // ↑=38, ↓=40, ←=37, →=39
  playerB = new Player('B', midR, midC + 2, 38, 40, 37, 39);

  // 공동 시작 영역 (중앙 9×5 블록)
  for (let r = midR - 2; r <= midR + 2; r++)
    for (let c = midC - 4; c <= midC + 4; c++)
      setOwner(r, c, OWNER_TEAM);
}
