// =============================================
// grid.js — 게임판(바닥 타일) 관리
//   - 타일 초기화
//   - 영역 채우기 (flood fill)
//   - 배신 시 Voronoi 영역 분할
// =============================================

// grid[row][col] = { owner: null|'team'|'A'|'B'|'Z', type: 'normal'|..., dirty: bool }
let grid = [];

function initGrid() {
  grid = [];
  for (let r = 0; r < ROWS; r++) {
    grid[r] = [];
    for (let c = 0; c < COLS; c++) {
      grid[r][c] = {
        owner: OWNER_NONE,
        type: TILE_TYPE_NORMAL,
        dirty: true,
      };
    }
  }
}

// 타일 소유자 설정 + dirty 플래그
function setOwner(r, c, owner) {
  if (r < 0 || r >= ROWS || c < 0 || c >= COLS) return;
  if (grid[r][c].owner !== owner) {
    grid[r][c].owner = owner;
    grid[r][c].dirty = true;
  }
}

function getOwner(r, c) {
  if (r < 0 || r >= ROWS || c < 0 || c >= COLS) return null;
  return grid[r][c].owner;
}

// 전체 타일 렌더링 (dirty 타일만 업데이트)
function drawGrid(p) {
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const tile = grid[r][c];
      const x = c * TILE_SIZE;
      const y = r * TILE_SIZE;
      const col = tileColor(tile.owner);
      p.fill(col);
      p.noStroke();
      p.rect(x, y, TILE_SIZE, TILE_SIZE);
      // 그리드 선
      p.stroke(COLOR_GRID);
      p.strokeWeight(0.3);
      p.noFill();
      p.rect(x, y, TILE_SIZE, TILE_SIZE);
      tile.dirty = false;
    }
  }
}

function tileColor(owner) {
  switch (owner) {
    case OWNER_TEAM:   return COLOR_TEAM;
    case OWNER_A:      return COLOR_A;
    case OWNER_B:      return COLOR_B;
    case OWNER_ZOMBIE: return COLOR_ZOMBIE;
    default:           return COLOR_EMPTY;
  }
}

// ── Flood Fill: 꼬리로 둘러싸인 내부 타일을 owner 소유로 채움 ──
// tail: [{r, c}, ...] — 이번에 추가된 꼬리 타일 경로
// owner: 채울 소유자
function floodFillEnclosed(tailSet, owner, p) {
  // BFS로 외부(경계 접촉)에서 도달 불가능한 NONE 타일 = 내부 → 채움
  // tailSet: Set of "r,c" strings
  const visited = new Set();
  const queue = [];
  const inside = new Set();

  // 경계에서 시작하여 외부 탐색
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if ((r === 0 || r === ROWS-1 || c === 0 || c === COLS-1)) {
        const key = `${r},${c}`;
        if (!tailSet.has(key) && grid[r][c].owner === OWNER_NONE && !visited.has(key)) {
          visited.add(key);
          queue.push([r, c]);
        }
      }
    }
  }

  const dirs = [[-1,0],[1,0],[0,-1],[0,1]];
  while (queue.length > 0) {
    const [r, c] = queue.shift();
    for (const [dr, dc] of dirs) {
      const nr = r + dr, nc = c + dc;
      if (nr < 0 || nr >= ROWS || nc < 0 || nc >= COLS) continue;
      const key = `${nr},${nc}`;
      if (visited.has(key)) continue;
      if (tailSet.has(key)) continue; // 꼬리는 막힘
      if (grid[nr][nc].owner !== OWNER_NONE) continue; // 이미 소유된 타일 통과 안 함
      visited.add(key);
      queue.push([nr, nc]);
    }
  }

  // NONE이지만 외부 탐색에서 방문 안 된 타일 = 내부
  let filled = 0;
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const key = `${r},${c}`;
      if (grid[r][c].owner === OWNER_NONE && !visited.has(key) && !tailSet.has(key)) {
        setOwner(r, c, owner);
        filled++;
      }
    }
  }
  // 꼬리 자체도 소유로
  for (const key of tailSet) {
    const [r, c] = key.split(',').map(Number);
    setOwner(r, c, owner);
  }
  return filled;
}

// ── Voronoi 분할: 배신 타이머 발동 시 팀 영역을 두 플레이어 위치 기준으로 분할 ──
function voronoiSplit(posA, posB) {
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (grid[r][c].owner === OWNER_TEAM) {
        const dA = Math.abs(r - posA.r) + Math.abs(c - posA.c);
        const dB = Math.abs(r - posB.r) + Math.abs(c - posB.c);
        grid[r][c].owner = dA <= dB ? OWNER_A : OWNER_B;
        grid[r][c].dirty = true;
      }
    }
  }
}

// 영역 통계: 각 owner별 타일 수 반환
function countTiles() {
  let counts = { team: 0, A: 0, B: 0, Z: 0, none: 0 };
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const o = grid[r][c].owner;
      if (o === OWNER_TEAM) counts.team++;
      else if (o === OWNER_A) counts.A++;
      else if (o === OWNER_B) counts.B++;
      else if (o === OWNER_ZOMBIE) counts.Z++;
      else counts.none++;
    }
  }
  return counts;
}

// 영역 폭탄: 중심 타일 반경 내 NONE 타일을 owner로 채움
function applyAreaBomb(centerR, centerC, owner) {
  for (let r = centerR - BOMB_RADIUS; r <= centerR + BOMB_RADIUS; r++) {
    for (let c = centerC - BOMB_RADIUS; c <= centerC + BOMB_RADIUS; c++) {
      if (r < 0 || r >= ROWS || c < 0 || c >= COLS) continue;
      const dist = Math.abs(r - centerR) + Math.abs(c - centerC);
      if (dist <= BOMB_RADIUS) {
        // 상대 영역은 빼앗지 않음 (빈 타일만 채움)
        if (grid[r][c].owner === OWNER_NONE) {
          setOwner(r, c, owner);
        }
      }
    }
  }
}
