// =============================================
// constants.js — 변하지 않는 숫자/설정값 모음
// =============================================

const TILE_SIZE = 4;          // 타일 하나의 픽셀 크기
const COLS = 200;               // 가로 타일 수
const ROWS = 200;               // 세로 타일 수
const CANVAS_W = COLS * TILE_SIZE;  // 800
const CANVAS_H = ROWS * TILE_SIZE;  // 800

// 게임 시간 (초)
const GAME_TOTAL_TIME = 120;       // 전체 게임 시간 (2분)
const BETRAYAL_TRIGGER_TIME = 60;  // 배신 타이머 발동 잔여 시간 (1분 남았을 때)

// 플레이어 속도 (프레임당 타일 이동 — fractional, 30fps 기준)
const PLAYER_SPEED = 5.5;        // 초당 타일 이동 수 (8 tiles/sec)
const BOOST_MULTIPLIER = 2.0;  // 속도 부스터 배율
const BOOST_DURATION = 300;    // 부스터 지속 프레임 (10초 * 60fps... 30fps 기준 300프레임)
// 30fps * 10sec = 300 frames
const STEEL_TAIL_DURATION = 300; // 강철꼬리 지속 프레임 (10초)

// 좀비
const ZOMBIE_COUNT = 15;        // 초기 좀비 수
const ZOMBIE_SPEED = 4.3;        // 좀비 초당 타일 이동 수
const ZOMBIE_RANDOM_CHANCE = 0.03; // 랜덤 방향 전환 확률 (매 프레임)

// 특수 타일
const SPECIAL_TILE_INTERVAL_MIN = 450; // 최소 스폰 간격 (프레임, 15초)
const SPECIAL_TILE_INTERVAL_MAX = 900; // 최대 스폰 간격 (프레임, 30초)
const MAX_SPECIAL_TILES = 4;           // 동시 최대 특수 타일 수

// 영역 폭탄: 반경
const BOMB_RADIUS = 3; // 타일 반경

// 타일 소유자 상수
const OWNER_NONE = null;
const OWNER_TEAM = 'team';
const OWNER_A = 'A';
const OWNER_B = 'B';
const OWNER_ZOMBIE = 'Z';

// 특수 타일 타입
const TILE_TYPE_NORMAL = 'normal';
const TILE_TYPE_BOMB = 'bomb';       // 영역 폭탄
const TILE_TYPE_ZOMBIE_SPAWN = 'zombie_spawn'; // 좀비 소환
const TILE_TYPE_BOOST_STEEL = 'boost_steel';   // 속도 2배 + 강철꼬리

// 게임 페이즈
const PHASE_LOBBY = 'lobby';
const PHASE_COOP = 'coop';
const PHASE_BETRAYAL = 'betrayal';
const PHASE_END = 'end';

// 색상
const COLOR_TEAM   = '#4CAF50';  // 협력 페이즈 팀 색
const COLOR_A      = '#E53935';  // 플레이어 A (빨강)
const COLOR_B      = '#1E88E5';  // 플레이어 B (파랑)
const COLOR_ZOMBIE = '#7B1FA2';  // 좀비 영역 (보라)
const COLOR_EMPTY  = '#1a1a1a';  // 빈 타일
const COLOR_GRID   = '#222222';  // 그리드 선

// 게임 프레임레이트
const FRAME_RATE = 30;
