// =============================================
// zombie.js — 좀비 생성 & 매 프레임 이동 AI
// =============================================

class Zombie {
  constructor(r, c) {
    this.r = r;
    this.c = c;
    this.dr = 0;
    this.dc = 1;
    // 소수점 누적 이동 (속도 제어)
    this.moveAccum = 0;
    this.speed = ZOMBIE_SPEED; // 초당 타일
    // 꼬리: 귀환 전 지나온 타일
    this.tail = [];
    this.alive = true;
  }

  // 매 프레임 호출
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
      // 살아있는 플레이어 중 가장 가까운 꼬리 타일을 향해 이동
      let targetR = this.r, targetC = this.c;
      let minDist = Infinity;

      for (const pl of players) {
        if (!pl.alive) continue;
        // 꼬리가 있으면 꼬리 타일 타겟, 없으면 플레이어 본체
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

      // 목표 방향으로 이동 (맨해튼)
      const dr = Math.sign(targetR - this.r);
      const dc = Math.sign(targetC - this.c);

      if (dr !== 0 && dc !== 0) {
        // 대각이면 하나 선택
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

    // 꼬리 관리 (좀비도 꼬리를 가짐 — 플레이어가 밟으면 좀비 꼬리도 위험 판정)
    const curKey = `${this.r},${this.c}`;
    const isOnOwned = getOwner(this.r, this.c) === OWNER_ZOMBIE;

    if (!isOnOwned) {
      // 꼬리 추가
      this.tail.push({ r: this.r, c: this.c });
    } else {
      // 이미 소유 영역 귀환 → 꼬리 닫기
      if (this.tail.length > 0) {
        const tailSet = new Set(this.tail.map(t => `${t.r},${t.c}`));
        floodFillEnclosed(tailSet, OWNER_ZOMBIE, null);
        this.tail = [];
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
  for (let i = 0; i < ZOMBIE_COUNT; i++) {
    const r = Math.floor(Math.random() * (ROWS - 8)) + 4;
    const c = Math.floor(Math.random() * (COLS - 8)) + 4;
    zombies.push(new Zombie(r, c));
  }
}

// 20초마다 좀비 위치 재배치
const ZOMBIE_RELOCATE_INTERVAL = 20 * 30; // 20초 * 30fps = 600프레임
let zombieRelocateTimer = 0;

function updateZombies(players, p) {
  // 20초마다 위치 재배치
  zombieRelocateTimer++;
  if (zombieRelocateTimer >= ZOMBIE_RELOCATE_INTERVAL) {
    zombieRelocateTimer = 0;
    // 부족한 좀비 채우기 + 전체 위치 재배치
    zombies = [];
    for (let i = 0; i < ZOMBIE_COUNT; i++) {
      const r = Math.floor(Math.random() * (ROWS - 8)) + 4;
      const c = Math.floor(Math.random() * (COLS - 8)) + 4;
      zombies.push(new Zombie(r, c));
    }
  }

  for (const z of zombies) {
    z.update(players, p);
  }
  for (let i = zombies.length - 1; i >= 0; i--) {
    if (!zombies[i].alive) zombies.splice(i, 1);
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
