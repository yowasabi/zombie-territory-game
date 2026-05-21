// =============================================
// tile.js — 랜덤 박스 3종 관리
//   처음부터 맵에 배치된 상태로 시작
//   종류: 약(medicine), 피(blood), 에너지드링크(energy)
// =============================================

let boxes = []; // { r, c, type }

function initTiles(p) {
  boxes = [];
  _placeBoxes(p);
}

function _placeBoxes(p) {
  const types = [BOX_TYPE_MEDICINE, BOX_TYPE_BLOOD, BOX_TYPE_ENERGY];
  const midR = Math.floor(ROWS / 2);
  const midC = Math.floor(COLS / 2);

  for (const type of types) {
    let placed = 0;
    let attempts = 0;
    while (placed < BOX_COUNT_EACH && attempts < 300) {
      attempts++;
      const r = Math.floor(p.random(4, ROWS - 4));
      const c = Math.floor(p.random(4, COLS - 4));
      // 시작 영역(중앙) 근처 제외
      if (Math.abs(r - midR) < 6 && Math.abs(c - midC) < 8) continue;
      // 이미 박스 있으면 스킵
      if (boxes.some(b => b.r === r && b.c === c)) continue;
      boxes.push({ r, c, type });
      placed++;
    }
  }
}

// updateTiles은 이제 아무것도 하지 않음 (박스는 처음부터 고정 배치)
function updateTiles(p) {}

function drawTiles(p) {
  for (const box of boxes) {
    const x = box.c * TILE_SIZE;
    const y = box.r * TILE_SIZE;
    const blink = Math.sin(p.frameCount * 0.12) > 0;

    p.noStroke();
    // 박스 배경
    switch (box.type) {
      case BOX_TYPE_MEDICINE:
        p.fill(blink ? '#43A047' : '#2E7D32'); break;
      case BOX_TYPE_BLOOD:
        p.fill(blink ? '#E53935' : '#B71C1C'); break;
      case BOX_TYPE_ENERGY:
        p.fill(blink ? '#FFD600' : '#F9A825'); break;
    }
    p.rect(x + 1, y + 1, TILE_SIZE - 2, TILE_SIZE - 2, 4);

    // 아이콘
    p.textAlign(p.CENTER, p.CENTER);
    p.textSize(11);
    p.fill(255);
    let icon = '';
    switch (box.type) {
      case BOX_TYPE_MEDICINE: icon = '💊'; break;
      case BOX_TYPE_BLOOD:    icon = '🩸'; break;
      case BOX_TYPE_ENERGY:   icon = '⚡'; break;
    }
    p.text(icon, x + TILE_SIZE / 2, y + TILE_SIZE / 2 + 1);
  }
}

// 플레이어가 박스 밟았는지 확인
function checkTilePickup(player, zombiesArr, phase, p) {
  for (let i = boxes.length - 1; i >= 0; i--) {
    const box = boxes[i];
    if (box.r === player.r && box.c === player.c) {
      _applyBoxEffect(box, player, phase, p);
      boxes.splice(i, 1);
    }
  }
}

function _applyBoxEffect(box, player, phase, p) {
  switch (box.type) {
    case BOX_TYPE_MEDICINE: {
      // 약: 주변 반경 BOMB_RADIUS 빈 타일 → 내 영역 보너스
      const owner = phase === PHASE_COOP ? OWNER_TEAM : player.owner;
      applyAreaBomb(player.r, player.c, owner);
      player.bombFlash = 20;
      showNotification(player.id, '약 획득: 보너스 땅이 주어지는 약을 먹었다!', '#43A047');
      break;
    }
    case BOX_TYPE_BLOOD: {
      // 피: 좀비 속도 5초 증가
      zombieBloodTimer = ZOMBIE_BLOOD_DURATION;
      showNotification(player.id, '피 획득: 피를 밟았다 좀비속도가 이제 빨라진다!', '#E53935');
      break;
    }
    case BOX_TYPE_ENERGY: {
      // 에너지드링크: 속도 2배 + 강철꼬리 5초
      player.boostTimer = BOOST_DURATION;
      player.steelTailTimer = STEEL_TAIL_DURATION;
      showNotification(player.id, '에너지드링크 획득: 속도와 강철꼬리를 갖는 에너지드링크를 마셨다!', '#FFD600');
      break;
    }
  }
}
