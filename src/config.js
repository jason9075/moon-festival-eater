/**
 * 遊戲全域設定與掉落物規格。
 * 所有速度以「每秒相對於畫布高度的比例」表示 (frame-rate independent)。
 */

/** @typedef {'mooncake' | 'pomelo' | 'rabbit' | 'bomb'} EntityKind */

/**
 * @typedef {Object} EntitySpec
 * @property {EntityKind} kind
 * @property {number} weight       出現權重 (機率比例)
 * @property {number} speed        掉落速度 (畫布高度比例 / 秒)
 * @property {number} score        得分 (可為負)
 * @property {number} radiusRatio  碰撞半徑 (相對畫布較短邊)
 * @property {string} asset        SVG 素材路徑
 * @property {number} timeDelta    命中後時間增減 (秒),0 表示不影響
 * @property {boolean} [clearsScreen] 命中後是否清空全畫面 (玉兔 bonus)
 */

/** @type {Record<EntityKind, EntitySpec>} */
export const ENTITIES = {
  mooncake: {
    kind: 'mooncake',
    weight: 50,
    speed: 0.28,
    score: 10,
    radiusRatio: 0.075,
    asset: 'assets/mooncake.svg',
    timeDelta: 0,
  },
  pomelo: {
    kind: 'pomelo',
    weight: 35,
    speed: 0.42,
    score: 20,
    radiusRatio: 0.07,
    asset: 'assets/pomelo.svg',
    timeDelta: 0,
  },
  rabbit: {
    kind: 'rabbit',
    weight: 10,
    speed: 0.6,
    score: 50,
    radiusRatio: 0.065,
    asset: 'assets/rabbit.svg',
    timeDelta: 0,
    clearsScreen: true,
  },
  bomb: {
    kind: 'bomb',
    weight: 5,
    speed: 0.2,
    score: -30,
    radiusRatio: 0.07,
    asset: 'assets/bomb.svg',
    timeDelta: -3,
  },
};

export const GAME = {
  /** 單局總時間 (秒) */
  duration: 60,
  /** 進入 Rush Hour 的剩餘秒數 */
  rushHourAt: 15,
  /** 一般階段生成間隔 (秒) */
  baseSpawnInterval: 0.9,
  /** Rush Hour 生成間隔 (秒) */
  rushSpawnInterval: 0.42,
  /** 前置暖身時間 (秒):此期間速度/頻率漸增 */
  warmupDuration: 20,
  /** 嘴巴判定圈半徑 (相對畫布較短邊) */
  mouthRadiusRatio: 0.06,
  /** 張嘴判定閾值 (上下唇距離 / 嘴角距離) */
  mouthOpenThreshold: 0.35,
  /** 倒數秒數 */
  countdownFrom: 3,
};

/** 結算評等 (由高到低比對) */
export const RANKS = [
  { min: 500, title: '中秋團圓大胃王 🏆', desc: '嫦娥都自嘆不如!' },
  { min: 300, title: '月圓吃貨 🌕', desc: '這胃口實在驚人。' },
  { min: 150, title: '賞月食客 🥮', desc: '吃得津津有味。' },
  { min: 50, title: '淺嚐輒止 🐇', desc: '再多吃一點嘛!' },
  { min: 0, title: '嫦娥笑你 😅', desc: '玉兔表示可以再加油。' },
];

/**
 * 依剩餘分數取得評等。
 * @param {number} score
 * @returns {{ title: string, desc: string }}
 */
export function rankFor(score) {
  return RANKS.find((r) => score >= r.min) ?? RANKS[RANKS.length - 1];
}
