// =============================================
// zombie.js — 좀비 생성 & 매 프레임 이동 AI
// =============================================

class Zombie {
  constructor(r, c) {
    this.r = r;
    this.c = c;
    this.dr = 0;
    this.dc = 1;
    this.moveAccum = 0;
    this.speed = ZOMBIE_SPEED;
    this.tail = [];
    this.alive = true;

    // 시작 영역을 3×3으로 설정
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        setOwner(r + dr, c + dc, OWNER_ZOMBIE);
      }
    }
  }

  update(players, p) {
    if (!this.alive) return;

    this.moveAccum += this.speed / FRAME_RATE;

    while (this.moveAccum >= 1) {
      this.moveAccum -= 1;
      this._step(players, p);
    }
  }

  _step(players, p) {
    // 랜덤 방향 전환
    if (p.random() < ZOMBIE_RANDOM_CHANCE) {
      this._randomDir(p);
    } else {
      let targetR = this.r, targetC = this.c;
      let minDist = Infinity;

      for (const pl of players) {
        if (!pl.alive) continue;
        const targets = pl.tail.length > 0 ? pl.tail : [{ r: pl.r, c: pl.c }];
        for (const t of targets) {
          const d = Math.abs(t.r - this.r) + Math.abs(t.c - this.c);
          if (d < minDist) {
            minDist = d;
            targetR = t.r;
            targetC = t.c;
          }
        }
      }

      const dr = Math.sign(targetR - this.r);
      const dc = Math.sign(targetC - this.c);

      if (dr !== 0 && dc !== 0) {
        if (p.random() < 0.5) { this.dr = dr; this.dc = 0; }
        else { this.dr = 0; this.dc = dc; }
      } else if (dr !== 0) {
        this.dr = dr; this.dc = 0;
      } else if (dc !== 0) {
        this.dr = 0; this.dc = dc;
      } else {
        this._randomDir(p);
      }
    }

    const nr = this.r + this.dr;
    const nc = this.c + this.dc;

    // 경계 처리
    if (nr < 0 || nr >= ROWS || nc < 0 || nc >= COLS) {
      this._randomDir(p);
      return;
    }

    // 꼬리 관리 (플레이어와 동일한 원리)
    const isOnOwned = getOwner(this.r, this.c) === OWNER_ZOMBIE;

    if (!isOnOwned) {
      // 소유 영역 밖: 꼬리 추가
      this.tail.push({ r: this.r, c: this.c });
    } else {
      // 소유 영역 귀환: 꼬리 닫기 → flood fill로 영역 확장
      if (this.tail.length > 0) {
        const tailSet = new Set(this.tail.map(t => `${t.r},${t.c}`));
        floodFillEnclosed(tailSet, OWNER_ZOMBIE, null);
        this.tail = [];
      }
      setOwner(this.r, this.c, OWNER_ZOMBIE);
    }

    // ── 플레이어 꼬리 충돌 → 좀비 사망 ──
    for (const pl of players) {
      if (!pl.alive) continue;
      if (pl.tail.some(t => t.r === nr && t.c === nc)) {
        this.alive = false;
        return;
      }
    }

    this.r = nr;
    this.c = nc;
  }

  _randomDir(p) {
    const dirs = [[-1,0],[1,0],[0,-1],[0,1]];
    const d = dirs[Math.floor(p.random(dirs.length))];
    this.dr = d[0];
    this.dc = d[1];
  }

  draw(p) {
    if (!this.alive) return;

    // 꼬리 그리기
    p.noStroke();
    p.fill(120, 50, 180, 160);
    for (const t of this.tail) {
      p.rect(t.c * TILE_SIZE + 4, t.r * TILE_SIZE + 4, TILE_SIZE - 8, TILE_SIZE - 8, 2);
    }

    // 본체 그리기
    const x = this.c * TILE_SIZE;
    const y = this.r * TILE_SIZE;
    p.fill('#AB47BC');
    p.noStroke();
    p.rect(x + 2, y + 2, TILE_SIZE - 4, TILE_SIZE - 4, 4);
    // 눈
    p.fill(255, 50, 50);
    p.ellipse(x + 7, y + 8, 4, 4);
    p.ellipse(x + 13, y + 8, 4, 4);
  }
}

// 좀비 배열 초기화
let zombies = [];

function initZombies() {
  zombies = [];
  const spawnPositions = [
    [3, 3], [3, COLS-4], [ROWS-4, 3], [ROWS-4, COLS-4],
    [ROWS/2, 3], [3, COLS/2]
  ];
  for (let i = 0; i < Math.min(ZOMBIE_COUNT, spawnPositions.length); i++) {
    zombies.push(new Zombie(spawnPositions[i][0], spawnPositions[i][1]));
  }
}

function updateZombies(players, p) {
  for (const z of zombies) {
    z.update(players, p);
  }
  // 죽은 좀비 제거
  for (let i = zombies.length - 1; i >= 0; i--) {
    if (!zombies[i].alive) zombies.splice(i, 1);
  }
}

function drawZombies(p) {
  for (const z of zombies) {
    z.draw(p);
  }
}
