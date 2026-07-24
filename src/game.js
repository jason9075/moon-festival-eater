import { ENTITIES, GAME } from './config.js';

/**
 * @typedef {Object} Item
 * @property {import('./config.js').EntitySpec} spec
 * @property {number} x        中心 X (px)
 * @property {number} y        中心 Y (px)
 * @property {number} r        半徑 (px)
 * @property {number} vy       垂直速度 (px/s)
 * @property {number} rot      當前旋轉 (rad)
 * @property {number} spin     旋轉角速度 (rad/s)
 * @property {boolean} dead    是否待移除
 */

/**
 * @typedef {Object} GameCallbacks
 * @property {(score: number) => void} onScore
 * @property {(secondsLeft: number) => void} onTime
 * @property {(n: number | 'go') => void} onCountdown
 * @property {(finalScore: number) => void} onEnd
 */

const WEIGHTED = Object.values(ENTITIES);
const TOTAL_WEIGHT = WEIGHTED.reduce((s, e) => s + e.weight, 0);

/**
 * 中秋大胃王核心引擎。負責主迴圈、掉落物生成、物理、碰撞與 Canvas 渲染。
 */
export class Game {
  /**
   * @param {HTMLCanvasElement} canvas
   * @param {HTMLVideoElement} video
   * @param {import('./face.js').FaceTracker} face
   * @param {import('./audio.js').AudioEngine} audio
   * @param {Record<string, HTMLImageElement>} assets  已載入的 SVG 圖 (kind → img)
   * @param {GameCallbacks} callbacks
   */
  constructor(canvas, video, face, audio, assets, callbacks) {
    this.canvas = canvas;
    this.ctx = /** @type {CanvasRenderingContext2D} */ (canvas.getContext('2d'));
    this.video = video;
    this.face = face;
    this.audio = audio;
    this.assets = assets;
    this.cb = callbacks;

    /** @type {'idle' | 'countdown' | 'playing' | 'over'} */
    this.phase = 'idle';
    /** @type {Item[]} */
    this.items = [];
    /** @type {{x:number,y:number,vx:number,vy:number,life:number,max:number,color:string}[]} */
    this.particles = [];
    /** @type {{x:number,y:number,text:string,life:number,color:string}[]} */
    this.floats = [];

    this.score = 0;
    this.timeLeft = GAME.duration;
    this.spawnTimer = 0;
    this.lastTs = 0;
    this.rafId = 0;
    this.countdownLeft = 0;
    this.lastCountShown = -1;
    /** 供渲染的最新嘴巴狀態 */
    this.mouth = this.face.mouth;
  }

  /** 依裝置像素比調整 canvas 尺寸,對齊 video 顯示區。 */
  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rect = this.canvas.getBoundingClientRect();
    this.canvas.width = Math.round(rect.width * dpr);
    this.canvas.height = Math.round(rect.height * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.viewW = rect.width;
    this.viewH = rect.height;
    this.minEdge = Math.min(rect.width, rect.height);
  }

  /** 開始一局:重置狀態並進入倒數。 */
  start() {
    this.resize();
    this.items = [];
    this.particles = [];
    this.floats = [];
    this.score = 0;
    this.timeLeft = GAME.duration;
    this.spawnTimer = 0;
    this.countdownLeft = GAME.countdownFrom;
    this.lastCountShown = -1;
    this.phase = 'countdown';
    this.cb.onScore(0);
    this.cb.onTime(GAME.duration);

    this.lastTs = performance.now();
    this._tick(this.lastTs);
  }

  stop() {
    if (this.rafId) cancelAnimationFrame(this.rafId);
    this.rafId = 0;
    this.phase = 'idle';
  }

  /**
   * 加權隨機挑選一種掉落物。
   * @returns {import('./config.js').EntitySpec}
   */
  _pickSpec() {
    let r = Math.random() * TOTAL_WEIGHT;
    for (const e of WEIGHTED) {
      if ((r -= e.weight) <= 0) return e;
    }
    return ENTITIES.mooncake;
  }

  /** 於畫面頂端生成一個掉落物,速度依難度曲線縮放。 */
  _spawn() {
    const spec = this._pickSpec();
    const r = spec.radiusRatio * this.minEdge;
    const elapsed = GAME.duration - this.timeLeft;
    // 暖身期速度 0.6→1.0 線性提升;Rush Hour 再 ×1.5
    const warmup = Math.min(1, 0.6 + 0.4 * (elapsed / GAME.warmupDuration));
    const rush = this.timeLeft <= GAME.rushHourAt ? 1.5 : 1;
    const speedScale = warmup * rush;

    this.items.push({
      spec,
      x: r + Math.random() * (this.viewW - 2 * r),
      y: -r,
      r,
      vy: spec.speed * this.viewH * speedScale,
      rot: (Math.random() - 0.5) * 0.4,
      spin: (Math.random() - 0.5) * 1.2,
      dead: false,
    });
  }

  /**
   * 更新一個時間步。
   * @param {number} dt 秒
   */
  _update(dt) {
    // 倒數階段:只渲染鏡頭與提示,不生成掉落物
    if (this.phase === 'countdown') {
      this.countdownLeft -= dt;
      const n = Math.ceil(this.countdownLeft);
      if (n !== this.lastCountShown) {
        this.lastCountShown = n;
        if (n > 0) {
          this.cb.onCountdown(n);
          this.audio.beep(false);
        }
      }
      if (this.countdownLeft <= 0) {
        this.phase = 'playing';
        this.cb.onCountdown('go');
        this.audio.beep(true);
      }
      return;
    }

    if (this.phase !== 'playing') return;

    // 計時
    const prev = this.timeLeft;
    this.timeLeft = Math.max(0, this.timeLeft - dt);
    if (Math.ceil(this.timeLeft) !== Math.ceil(prev)) {
      this.cb.onTime(Math.ceil(this.timeLeft));
      if (this.timeLeft <= 5 && this.timeLeft > 0) this.audio.beep(false);
    }

    // 生成
    const interval =
      this.timeLeft <= GAME.rushHourAt ? GAME.rushSpawnInterval : GAME.baseSpawnInterval;
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      this._spawn();
      this.spawnTimer = interval;
    }

    // 物理 + 碰撞
    const m = this.mouth;
    const mouthR = GAME.mouthRadiusRatio * this.minEdge;
    const mx = m.x * this.viewW;
    const my = m.y * this.viewH;

    for (const it of this.items) {
      it.y += it.vy * dt;
      it.rot += it.spin * dt;

      if (m.detected && m.open && !it.dead) {
        const dist = Math.hypot(it.x - mx, it.y - my);
        if (dist < it.r + mouthR) {
          this._consume(it, mx, my);
        }
      }
      if (it.y - it.r > this.viewH) it.dead = true;
    }
    this.items = this.items.filter((it) => !it.dead);

    // 粒子 / 飄字
    this._updateEffects(dt);

    if (this.timeLeft <= 0) this._end();
  }

  /**
   * 命中掉落物的結算。
   * @param {Item} it
   * @param {number} mx 嘴巴 X (px)
   * @param {number} my 嘴巴 Y (px)
   */
  _consume(it, mx, my) {
    it.dead = true;
    const s = it.spec;
    this.score = Math.max(0, this.score + s.score);
    this.cb.onScore(this.score);

    if (s.timeDelta) {
      this.timeLeft = Math.max(0, this.timeLeft + s.timeDelta);
      this.cb.onTime(Math.ceil(this.timeLeft));
    }

    const positive = s.score >= 0;
    this.floats.push({
      x: it.x,
      y: it.y,
      text: `${positive ? '+' : ''}${s.score}`,
      life: 1,
      color: positive ? '#ffe08a' : '#ff7a7a',
    });
    this._burst(it.x, it.y, positive ? '#ffd24a' : '#ff5a5a', positive ? 14 : 20);

    if (s.kind === 'bomb') this.audio.bomb();
    else if (s.kind === 'rabbit') this.audio.bonus();
    else this.audio.eat();

    // 玉兔:清屏並給每個被清除的一般物件小額加分
    if (s.clearsScreen) {
      for (const other of this.items) {
        if (!other.dead && other.spec.kind !== 'bomb') {
          other.dead = true;
          this._burst(other.x, other.y, '#fff2b0', 8);
        }
      }
    }
  }

  /** 產生粒子爆散。 */
  _burst(x, y, color, count) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 60 + Math.random() * 180;
      this.particles.push({
        x,
        y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        life: 0.6,
        max: 0.6,
        color,
      });
    }
  }

  /** @param {number} dt */
  _updateEffects(dt) {
    for (const p of this.particles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 320 * dt; // 重力
      p.life -= dt;
    }
    this.particles = this.particles.filter((p) => p.life > 0);

    for (const f of this.floats) {
      f.y -= 46 * dt;
      f.life -= dt * 1.1;
    }
    this.floats = this.floats.filter((f) => f.life > 0);
  }

  _end() {
    this.phase = 'over';
    this.stop();
    this.cb.onEnd(this.score);
  }

  // ---- 渲染 ----

  render() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.viewW, this.viewH);

    // 掉落物
    for (const it of this.items) {
      const img = this.assets[it.spec.kind];
      ctx.save();
      ctx.translate(it.x, it.y);
      ctx.rotate(it.rot);
      const d = it.r * 2.1;
      if (img && img.complete) ctx.drawImage(img, -d / 2, -d / 2, d, d);
      ctx.restore();
    }

    // 嘴巴判定圈 (頂層 overlay)
    const m = this.mouth;
    if (m.detected && this.phase !== 'over') {
      const mx = m.x * this.viewW;
      const my = m.y * this.viewH;
      const mouthR = GAME.mouthRadiusRatio * this.minEdge;
      this._drawMouth(mx, my, mouthR, m.open);
    }

    // 粒子
    for (const p of this.particles) {
      ctx.globalAlpha = Math.max(0, p.life / p.max);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // 飄字
    ctx.textAlign = 'center';
    ctx.font = '700 26px system-ui, sans-serif';
    for (const f of this.floats) {
      ctx.globalAlpha = Math.max(0, f.life);
      ctx.fillStyle = f.color;
      ctx.strokeStyle = 'rgba(0,0,0,.4)';
      ctx.lineWidth = 4;
      ctx.strokeText(f.text, f.x, f.y);
      ctx.fillText(f.text, f.x, f.y);
    }
    ctx.globalAlpha = 1;
  }

  /** 繪製嘴巴判定圈與張嘴反饋。 */
  _drawMouth(x, y, r, open) {
    const ctx = this.ctx;
    ctx.save();
    ctx.lineWidth = 3;
    if (open) {
      // 張嘴:發光實心圈 + 外環
      const grad = ctx.createRadialGradient(x, y, r * 0.2, x, y, r * 1.4);
      grad.addColorStop(0, 'rgba(255,220,120,.55)');
      grad.addColorStop(1, 'rgba(255,150,40,0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(x, y, r * 1.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,225,120,.95)';
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.stroke();
    } else {
      // 閉嘴:虛線提示圈
      ctx.strokeStyle = 'rgba(255,255,255,.6)';
      ctx.setLineDash([6, 6]);
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  /** @param {number} ts */
  _tick(ts) {
    const dt = Math.min(0.05, (ts - this.lastTs) / 1000);
    this.lastTs = ts;

    // 臉部偵測 (放在迴圈內以取得最新嘴巴狀態)
    this.mouth = this.face.detect(this.video, ts);

    this._update(dt);
    this.render();

    if (this.phase === 'countdown' || this.phase === 'playing') {
      this.rafId = requestAnimationFrame((t) => this._tick(t));
    }
  }
}
