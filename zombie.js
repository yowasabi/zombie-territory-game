// zombie.js
// - 꼬리(줄)를 끊겨야만 죽음
// - 자신의 땅 영역 보유 가능
// - 계속 생성됨 (최대 수 유지)
// - 플레이어 줄을 끊어도 좀비는 죽지 않음

let zombieBloodTimer = 0;
let zombieSpawnTimer = 0;
const ZOMBIE_SPAWN_INTERVAL = 300; // 10초마다 좀비 추가 생성
const ZOMBIE_MAX = 12;             // 최대 좀비 수

class Zombie {
  constructor(r, c) {
    this.r = r;
    this.c = c;
    this.dr = 0;
    this.dc = 1;
    this.moveAccum = 0;
    this.tail = [];
    this.alive = true;
  }

  get speed() {
    return zombieBloodTimer > 0 ? ZOMBIE_SPEED_BOOSTED : ZOMBIE_SPEED_NORMAL;
  }

  update(players, p) {
    if (!this.alive) return;
    this.moveAccum += this.speed / FRAME_RATE;
    while (this.moveAccum >= 1) {
      this.moveAccum -= 1;
      this._step(players, p);
      if (!this.alive) return;
    }
  }

  _step(players, p) {
    // 방향 결정
    if (p.random() < ZOMBIE_RANDOM_CHANCE) {
      this._randomDir(p);
    } else {
      let targetR = this.r, targetC = this.c, minDist = Infinity;
      for (const pl of players) {
        if (!pl.alive) continue;
        // 꼬리(줄)가 있으면 꼬리를, 없으면 본체를 타겟
        const targets = pl.tail.length > 0 ? pl.tail : [{ r: pl.r, c: pl.c }];
        for (const t of targets) {
          const d = Math.abs(t.r-this.r) + Math.abs(t.c-this.c);
          if (d < minDist) { minDist = d; targetR = t.r; targetC = t.c; }
        }
      }
      const dr = Math.sign(targetR - this.r);
      const dc = Math.sign(targetC - this.c);
      if (dr !== 0 && dc !== 0) {
        if (p.random() < 0.5) { this.dr = dr; this.dc = 0; }
        else { this.dr = 0; this.dc = dc; }
      } else if (dr !== 0) { this.dr = dr; this.dc = 0; }
        else if (dc !== 0) { this.dr = 0; this.dc = dc; }
        else { this._randomDir(p); }
    }

    const nr = this.r + this.dr;
    const nc = this.c + this.dc;

    // 맵 경계: 반사 (죽지 않음)
    if (nr < 0 || nr >= ROWS || nc < 0 || nc >= COLS) {
      this._randomDir(p);
      return;
    }

    // 꼬리(줄) 관리 & 영역 점령
    const isOnOwned = getOwner(this.r, this.c) === OWNER_ZOMBIE;
    if (isOnOwned) {
      // 자기 영역에 돌아왔을 때 꼬리로 둘러싼 영역 채우기
      if (this.tail.length > 0) {
        const tailSet = new Set(this.tail.map(t => `${t.r},${t.c}`));
        floodFillEnclosed(tailSet, OWNER_ZOMBIE, null);
        this.tail = [];
      }
    } else {
      // 영역 밖에서는 꼬리 추가
      this.tail.push({ r: this.r, c: this.c });
    }

    // 플레이어 꼬리(줄) 끊기: 좀비가 플레이어 꼬리를 밟으면 꼬리 끊기 → 플레이어 사망
    // (좀비 자신은 죽지 않음)
    for (const pl of players) {
      if (!pl.alive) continue;
      const hitIdx = pl.tail.findIndex(t => t.r === nr && t.c === nc);
      if (hitIdx !== -1) {
        pl._cutTailAt(nr, nc); // 플레이어 사망
        // 좀비는 계속 이동
      }
    }

    this.r = nr;
    this.c = nc;
  }

  // 플레이어가 좀비 꼬리(줄)를 밟으면 → 좀비 사망
  cutTailAt(r, c) {
    const idx = this.tail.findIndex(t => t.r === r && t.c === c);
    if (idx !== -1) {
      // 잘린 꼬리 타일 반환
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

  _randomDir(p) {
    const dirs = [[-1,0],[1,0],[0,-1],[0,1]];
    const d = dirs[Math.floor(p.random(dirs.length))];
    this.dr = d[0]; this.dc = d[1];
  }

  draw(p) {
    if (!this.alive) return;
    // 꼬리(줄) 그리기
    p.noStroke();
    p.fill(zombieBloodTimer > 0 ? p.color(200,0,0,160) : p.color(120,50,180,160));
    for (const t of this.tail) {
      p.rect(t.c*TILE_SIZE+4, t.r*TILE_SIZE+4, TILE_SIZE-8, TILE_SIZE-8, 2);
    }
    // 본체
    const x = this.c*TILE_SIZE, y = this.r*TILE_SIZE;
    p.fill(zombieBloodTimer > 0 ? '#E53935' : '#AB47BC');
    p.noStroke();
    p.rect(x+2, y+2, TILE_SIZE-4, TILE_SIZE-4, 4);
    p.fill(255, 50, 50);
    p.ellipse(x+6, y+7, 4, 4);
    p.ellipse(x+12, y+7, 4, 4);
  }
}

let zombies = [];

function initZombies() {
  zombies = [];
  zombieBloodTimer = 0;
  zombieSpawnTimer = 0;
  const pos = [
    [3,3],[3,COLS-4],[ROWS-4,3],[ROWS-4,COLS-4],[ROWS/2|0,3],[3,COLS/2|0]
  ];
  for (let i = 0; i < Math.min(ZOMBIE_COUNT, pos.length); i++) {
    zombies.push(new Zombie(pos[i][0], pos[i][1]));
  }
}

function updateZombies(players, p) {
  if (zombieBloodTimer > 0) zombieBloodTimer--;

  // 좀비 계속 생성 (최대치 미만일 때)
  zombieSpawnTimer++;
  if (zombieSpawnTimer >= ZOMBIE_SPAWN_INTERVAL && zombies.length < ZOMBIE_MAX) {
    zombieSpawnTimer = 0;
    _spawnZombie(p);
  }

  for (const z of zombies) z.update(players, p);

  // 살아있지 않은 좀비만 제거 (alive=false인 것만)
  for (let i = zombies.length-1; i >= 0; i--) {
    if (!zombies[i].alive) zombies.splice(i, 1);
  }
}

function _spawnZombie(p) {
  // 모서리 근처 랜덤 스폰
  const corners = [
    [Math.floor(p.random(2,6)), Math.floor(p.random(2,6))],
    [Math.floor(p.random(2,6)), Math.floor(p.random(COLS-6, COLS-2))],
    [Math.floor(p.random(ROWS-6,ROWS-2)), Math.floor(p.random(2,6))],
    [Math.floor(p.random(ROWS-6,ROWS-2)), Math.floor(p.random(COLS-6,COLS-2))],
  ];
  const pos = corners[Math.floor(p.random(corners.length))];
  zombies.push(new Zombie(pos[0], pos[1]));
}

function drawZombies(p) {
  for (const z of zombies) z.draw(p);
}
