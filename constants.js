// =============================================
// constants.js — 변하지 않는 숫자/설정값 모음
// =============================================

const TILE_SIZE = 18;
const COLS = 50;
const ROWS = 50;
const CANVAS_W = COLS * TILE_SIZE;  // 900
const CANVAS_H = ROWS * TILE_SIZE;  // 900

// 게임 시간 (초)
const GAME_TOTAL_TIME = 120;
const BETRAYAL_TRIGGER_TIME = 60;

// 협력 페이즈 한 명 사망 시 특수 규칙
const SOLO_TIME_LIMIT = 20;         // 한 명 사망 후 남은 플레이어 제한 시간 (20초)
const EMERGENCY_BETRAYAL_TIME = 30; // 부활 후 즉시 발동되는 배신 타이머 (30초)

// 플레이어 속도
const PLAYER_SPEED = 8;
const BOOST_MULTIPLIER = 2.0;
const BOOST_DURATION = 150;      // 에너지드링크 5초 (30fps * 5)
const STEEL_TAIL_DURATION = 150; // 강철꼬리 5초

// 좀비
const ZOMBIE_COUNT = 6;
const ZOMBIE_SPEED_NORMAL = 5.5;   // 플레이어보다 살짝 느림
const ZOMBIE_SPEED_BOOSTED = 11;   // 피 효과 시
const ZOMBIE_BLOOD_DURATION = 150; // 피 효과 5초
const ZOMBIE_RANDOM_CHANCE = 0.03;

// 랜덤 박스
const BOX_COUNT_EACH = 3; // 타입별 박스 수 (총 9개)
const BOMB_RADIUS = 3;

// 타일 소유자 상수
const OWNER_NONE = null;
const OWNER_TEAM = 'team';
const OWNER_A = 'A';
const OWNER_B = 'B';
const OWNER_ZOMBIE = 'Z';

// 랜덤 박스 타입
const BOX_TYPE_MEDICINE = 'medicine'; // 약: 보너스 땅
const BOX_TYPE_BLOOD    = 'blood';    // 피: 좀비 속도 UP
const BOX_TYPE_ENERGY   = 'energy';   // 에너지드링크: 속도 2배 + 강철꼬리

// 게임 페이즈
const PHASE_LOBBY    = 'lobby';
const PHASE_COOP     = 'coop';
const PHASE_SOLO     = 'solo';     // 한 명 사망 후 20초 제한
const PHASE_BETRAYAL = 'betrayal';
const PHASE_END      = 'end';

// 색상
const COLOR_TEAM   = '#4CAF50';
const COLOR_A      = '#E53935';
const COLOR_B      = '#1E88E5';
const COLOR_ZOMBIE = '#7B1FA2';
const COLOR_EMPTY  = '#1a1a1a';
const COLOR_GRID   = '#222222';

const FRAME_RATE = 30;
