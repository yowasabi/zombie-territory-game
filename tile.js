// tile.js — 랜덤 박스 3종 (게임 시작 시 맵에 고정 배치)

let boxes = [];

function initTiles(p) {
  boxes = [];
  _placeBoxes(p);
}

function _placeBoxes(p) {
  const types = [BOX_TYPE_MEDICINE, BOX_TYPE_BLOOD, BOX_TYPE_ENERGY];
  const midR = Math.floor(ROWS/2);
  const midC = Math.floor(COLS/2);
  for (const type of types) {
    let placed = 0, attempts = 0;
    while (placed < BOX_COUNT_EACH && attempts < 300) {
      attempts++;
      const r = Math.floor(p.random(4, ROWS-4));
      const c = Math.floor(p.random(4, COLS-4));
      if (Math.abs(r-midR) < 6 && Math.abs(c-midC) < 8) continue;
      if (boxes.some(b => b.r === r && b.c === c)) continue;
      boxes.push({ r, c, type });
      placed++;
    }
  }
}

function updateTiles(p) {}

function drawTiles(p) {
  for (const box of boxes) {
    const x = box.c*TILE_SIZE, y = box.r*TILE_SIZE;
    const blink = Math.sin(p.frameCount * 0.12) > 0;
    p.noStroke();
    switch (box.type) {
      case BOX_TYPE_MEDICINE: p.fill(blink ? '#43A047' : '#2E7D32'); break;
      case BOX_TYPE_BLOOD:    p.fill(blink ? '#E53935' : '#B71C1C'); break;
      case BOX_TYPE_ENERGY:   p.fill(blink ? '#FFD600' : '#F9A825'); break;
    }
    p.rect(x+1, y+1, TILE_SIZE-2, TILE_SIZE-2, 4);
    p.textAlign(p.CENTER, p.CENTER);
    p.textSize(11);
    p.fill(255);
    let icon = '';
    switch (box.type) {
      case BOX_TYPE_MEDICINE: icon = '💊'; break;
      case BOX_TYPE_BLOOD:    icon = '🩸'; break;
      case BOX_TYPE_ENERGY:   icon = '⚡'; break;
    }
    p.text(icon, x+TILE_SIZE/2, y+TILE_SIZE/2+1);
  }
}

function checkTilePickup(player, zombiesArr, phase, p) {
  for (let i = boxes.length-1; i >= 0; i--) {
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
      const owner = phase === PHASE_COOP ? OWNER_TEAM : player.owner;
      applyAreaBomb(player.r, player.c, owner);
      player.bombFlash = 20;
      showNotification(player.id, '약 획득: 보너스 땅이 주어지는 약을 먹었다!', '#43A047');
      break;
    }
    case BOX_TYPE_BLOOD: {
      zombieBloodTimer = ZOMBIE_BLOOD_DURATION;
      showNotification(player.id, '피 획득: 피를 밟았다 좀비속도가 이제 빨라진다!', '#E53935');
      break;
    }
    case BOX_TYPE_ENERGY: {
      player.boostTimer = BOOST_DURATION;
      player.steelTailTimer = STEEL_TAIL_DURATION;
      showNotification(player.id, '에너지드링크 획득: 속도와 강철꼬리를 갖는 에너지드링크를 마셨다!', '#FFD600');
      break;
    }
  }
}
