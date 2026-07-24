/**
 * 以 Web Audio API 即時合成音效,毋須外部 mp3 檔 (符合最小化相依原則)。
 * 必須由使用者手勢 (點擊開始) 觸發 `unlock()` 才能於行動裝置播放。
 */
export class AudioEngine {
  constructor() {
    /** @type {AudioContext | null} */
    this.ctx = null;
    this.enabled = true;
  }

  /** 於使用者手勢中初始化 / 解鎖 AudioContext。 */
  unlock() {
    if (!this.ctx) {
      const Ctor = window.AudioContext ?? window.webkitAudioContext;
      this.ctx = new Ctor();
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
  }

  /**
   * 產生單一振盪器音符。
   * @param {number} freq       頻率 (Hz)
   * @param {number} duration   長度 (秒)
   * @param {OscillatorType} type
   * @param {number} [gain]     音量峰值
   * @param {number} [delay]    延遲起始 (秒)
   */
  tone(freq, duration, type = 'sine', gain = 0.2, delay = 0) {
    if (!this.ctx || !this.enabled) return;
    const t0 = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const env = this.ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    env.gain.setValueAtTime(0.0001, t0);
    env.gain.exponentialRampToValueAtTime(gain, t0 + 0.01);
    env.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);

    osc.connect(env).connect(this.ctx.destination);
    osc.start(t0);
    osc.stop(t0 + duration + 0.02);
  }

  /** 吃到月餅 / 柚子:清脆咀嚼上揚音。 */
  eat() {
    this.tone(520, 0.09, 'triangle', 0.25);
    this.tone(780, 0.08, 'triangle', 0.18, 0.05);
  }

  /** 吃到玉兔 bonus:三連上升的閃亮音。 */
  bonus() {
    [660, 880, 1180].forEach((f, i) => this.tone(f, 0.12, 'square', 0.16, i * 0.07));
  }

  /** 吃到炸彈:低頻爆破噪音。 */
  bomb() {
    if (!this.ctx || !this.enabled) return;
    const t0 = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const env = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(180, t0);
    osc.frequency.exponentialRampToValueAtTime(40, t0 + 0.3);
    env.gain.setValueAtTime(0.4, t0);
    env.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.35);
    osc.connect(env).connect(this.ctx.destination);
    osc.start(t0);
    osc.stop(t0 + 0.37);
  }

  /** 倒數嗶聲。@param {boolean} [high] 最後一聲拉高。 */
  beep(high = false) {
    this.tone(high ? 1046 : 660, 0.14, 'square', 0.22);
  }
}
