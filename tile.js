// =============================================
// tile.js — 특수 타일 3종 관리
//   - 타일 스폰 (15~30초 랜덤)
//   - 타일 그리기
//   - 플레이어 밟으면 효과 발동
// =============================================

// 활성 특수 타일 목록
// { r, c, type, spawnFrame, blinkPhase }
let specialTiles = [];
let nextSpawnFrame = 0;

function initTiles(p) {
  specialTiles = [];
  scheduleNextSpawn(p);
}

function scheduleNextSpawn(p) {
  const interval = Math.floor(
    p.random(SPECIAL_TILE_INTERVAL_MIN, SPECIAL_TILE_INTERVAL_MAX)
  );
  nextSpawnFrame = p.frameCount + interval;
}

function updateTiles(p) {
  if (specialTiles.length < MAX_SPECIAL_TILES && p.frameCount >= nextSpawnFrame) {
    spawnSpecialTile(p);
    scheduleNextSpawn(p);
  }
}

// 타입 가중치: bomb 40%, zombie_spawn 35%, boost_steel 25%
const TILE_TYPES_WEIGHTED = [
  TILE_TYPE_BOMB,
  TILE_TYPE_ZOMBIE_SPAWN,
  TILE_TYPE_BOOST_STEEL,
  TILE_TYPE_BOOST_STEEL,
  TILE_TYPE_BOOST_STEEL,
];

function spawnSpecialTile(p) {
  // 빈 타일에서 랜덤 위치 선정 (플레이어 근처 제외 — 최소 5타일 거리)
  let attempts = 0;
  while (attempts < 100) {
    const r = Math.floor(p.random(2, ROWS - 2));
    const c = Math.floor(p.random(2, COLS - 2));
    // 이미 특수 타일 있으면 스킵
    if (specialTiles.some(t => t.r === r && t.c === c)) { attempts++; continue; }
    // 타입 선택
    const type = TILE_TYPES_WEIGHTED[Math.floor(p.random(TILE_TYPES_WEIGHTED.length))];
    specialTiles.push({ r, c, type, spawnFrame: p.frameCount, blinkPhase: 0 });
    return;
  }
}

function drawTiles(p) {
  for (const tile of specialTiles) {
    const x = tile.c * TILE_SIZE;
    const y = tile.r * TILE_SIZE;
    const blink = Math.sin(p.frameCount * 0.15) > 0;

    // 배경
    p.noStroke();
    switch (tile.type) {
      case TILE_TYPE_BOMB:
        p.fill(blink ? '#FF6F00' : '#E65100');
        break;
      case TILE_TYPE_ZOMBIE_SPAWN:
        p.fill(blink ? '#6A1B9A' : '#4A148C');
        break;
      case TILE_TYPE_BOOST_STEEL:
        p.fill(blink ? '#00838F' : '#006064');
        break;
    }
    p.rect(x, y, TILE_SIZE, TILE_SIZE, 3);

    // 아이콘 텍스트
    p.textAlign(p.CENTER, p.CENTER);
    p.textSize(12);
    p.noStroke();
    p.fill(255);
    let icon = '';
    switch (tile.type) {
      case TILE_TYPE_BOMB:         icon = '💣'; break;
      case TILE_TYPE_ZOMBIE_SPAWN: icon = '🧟'; break;
      case TILE_TYPE_BOOST_STEEL:  icon = '⚡'; break;
    }
    p.text(icon, x + TILE_SIZE / 2, y + TILE_SIZE / 2 + 1);
  }
}

// 플레이어가 특수 타일 밟았는지 확인 → 효과 적용 후 타일 제거
// player: Player 객체, zombies: Zombie 배열, phase: 현재 게임 페이즈
function checkTilePickup(player, zombies, phase, p) {
  for (let i = specialTiles.length - 1; i >= 0; i--) {
    const tile = specialTiles[i];
    if (tile.r === player.r && tile.c === player.c) {
      applyTileEffect(tile, player, zombies, phase, p);
      specialTiles.splice(i, 1);
    }
  }
}

function applyTileEffect(tile, player, zombies, phase, p) {
  switch (tile.type) {
    case TILE_TYPE_BOMB:
      // 영역 폭탄: 현재 위치 반경 BOMB_RADIUS 내 빈 타일 → 내 영역
      const owner = phase === PHASE_COOP ? OWNER_TEAM : player.owner;
      applyAreaBomb(player.r, player.c, owner);
      // 시각 효과 플래그 (ui.js에서 처리)
      player.bombFlash = 20; // 20프레임 플래시
      break;

    case TILE_TYPE_ZOMBIE_SPAWN:
      //좀비 타일 밟으면 좀비 한 개 생성
        const spawnR = Math.min(ROWS - 1, Math.max(0, tile.r + Math.floor(p.random(-4, 5))));
        const spawnC = Math.min(COLS - 1, Math.max(0, tile.c + Math.floor(p.random(-4, 5))));
        zombies.push(new Zombie(spawnR, spawnC));

      break;

    case TILE_TYPE_BOOST_STEEL:
      // 속도 2배 + 강철꼬리 10초
      player.boostTimer = BOOST_DURATION;       // 300프레임
      player.steelTailTimer = STEEL_TAIL_DURATION; // 300프레임
      break;
  }
}

// 특수 타일 초기화
function removeTileAt(r, c) {
  specialTiles = specialTiles.filter(t => !(t.r === r && t.c === c));
}
