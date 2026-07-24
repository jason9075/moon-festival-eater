import { rankFor } from './config.js';

/** DOM 元素快取。 */
const $ = (id) => /** @type {HTMLElement} */ (document.getElementById(id));

/**
 * 集中管理各畫面切換與 HUD 更新,讓 main.js 專注於流程控制。
 */
export class UI {
  constructor() {
    this.el = {
      menu: $('menu'),
      loading: $('loading'),
      loadingText: $('loading-text'),
      over: $('over'),
      error: $('error'),
      errorText: $('error-text'),
      hud: $('hud'),
      score: $('score'),
      timer: $('timer'),
      timerBox: $('timer-box'),
      countdown: $('countdown'),
      finalScore: $('final-score'),
      rankTitle: $('rank-title'),
      rankDesc: $('rank-desc'),
    };
  }

  /** @param {'menu'|'loading'|'game'|'over'|'error'} screen */
  show(screen) {
    for (const key of ['menu', 'loading', 'over', 'error']) {
      this.el[key].classList.toggle('hidden', key !== screen);
    }
    this.el.hud.classList.toggle('hidden', screen !== 'game');
    if (screen !== 'game') this.el.countdown.classList.add('hidden');
  }

  /** @param {string} text */
  loading(text) {
    this.el.loadingText.textContent = text;
    this.show('loading');
  }

  /** @param {string} text */
  error(text) {
    this.el.errorText.textContent = text;
    this.show('error');
  }

  /** @param {number} score */
  setScore(score) {
    this.el.score.textContent = String(score);
  }

  /** @param {number} sec */
  setTime(sec) {
    this.el.timer.textContent = String(sec);
    this.el.timerBox.classList.toggle('warning', sec <= 5);
  }

  /** @param {number | 'go'} n */
  countdown(n) {
    const box = this.el.countdown;
    box.classList.remove('hidden');
    box.textContent = n === 'go' ? 'GO!' : String(n);
    box.classList.remove('count-anim');
    void box.offsetWidth; // 重觸動畫
    box.classList.add('count-anim');
    if (n === 'go') setTimeout(() => box.classList.add('hidden'), 550);
  }

  /** @param {number} score */
  showResult(score) {
    const { title, desc } = rankFor(score);
    this.el.finalScore.textContent = String(score);
    this.el.rankTitle.textContent = title;
    this.el.rankDesc.textContent = desc;
    this.show('over');
  }
}
