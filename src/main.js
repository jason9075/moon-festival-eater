import { ENTITIES } from './config.js';
import { FaceTracker } from './face.js';
import { AudioEngine } from './audio.js';
import { Game } from './game.js';
import { UI } from './ui.js';

const video = /** @type {HTMLVideoElement} */ (document.getElementById('webcam'));
const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('game'));

const ui = new UI();
const audio = new AudioEngine();
const face = new FaceTracker();

/** @type {Game | null} */
let game = null;
/** @type {Record<string, HTMLImageElement>} */
let assets = {};
let ready = false; // 相機 + MediaPipe + 素材皆就緒

/**
 * 預載所有 SVG 掉落物,回傳 kind → HTMLImageElement 對照表。
 * @returns {Promise<Record<string, HTMLImageElement>>}
 */
function loadAssets() {
  const entries = Object.values(ENTITIES).map(
    (spec) =>
      new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(/** @type {const} */ ([spec.kind, img]));
        img.onerror = () => reject(new Error(`素材載入失敗: ${spec.asset}`));
        img.src = spec.asset;
      }),
  );
  return Promise.all(entries).then((pairs) => Object.fromEntries(pairs));
}

/**
 * 啟動相機串流並等待影格就緒。
 * @returns {Promise<void>}
 */
async function startCamera() {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
    audio: false,
  });
  video.srcObject = stream;
  await video.play();
  // 等待影格尺寸就緒
  if (video.readyState < 2) {
    await new Promise((res) => video.addEventListener('loadeddata', res, { once: true }));
  }
}

/** 一次性初始化:相機 → 素材 → MediaPipe。 */
async function prepare() {
  ui.loading('正在啟動相機…');
  await startCamera();

  ui.loading('正在載入美食素材…');
  assets = await loadAssets();

  ui.loading('正在載入臉部辨識模型…');
  await face.init();

  game = new Game(canvas, video, face, audio, assets, {
    onScore: (s) => ui.setScore(s),
    onTime: (t) => ui.setTime(t),
    onCountdown: (n) => ui.countdown(n),
    onEnd: (s) => ui.showResult(s),
  });
  window.addEventListener('resize', () => game?.resize());
  ready = true;
}

/** 開始一局 (若尚未初始化則先初始化)。 */
async function play() {
  audio.unlock();
  try {
    if (!ready) await prepare();
    ui.show('game');
    game?.start();
  } catch (err) {
    console.error(err);
    const msg =
      err instanceof DOMException && err.name === 'NotAllowedError'
        ? '相機權限被拒。請於瀏覽器設定允許相機後重試。'
        : err instanceof Error
          ? err.message
          : '發生未知錯誤。';
    ui.error(msg);
  }
}

/**
 * 合成截圖:鏡像視訊 + 遊戲畫布,觸發下載。
 */
function screenshot() {
  const w = canvas.width;
  const h = canvas.height;
  const out = document.createElement('canvas');
  out.width = w;
  out.height = h;
  const c = /** @type {CanvasRenderingContext2D} */ (out.getContext('2d'));

  // 鏡像繪製視訊 (object-fit: cover 對齊)
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  const scale = Math.max(w / vw, h / vh);
  const dw = vw * scale;
  const dh = vh * scale;
  c.save();
  c.translate(w, 0);
  c.scale(-1, 1);
  c.drawImage(video, (w - dw) / 2, (h - dh) / 2, dw, dh);
  c.restore();
  c.drawImage(canvas, 0, 0);

  // 浮水印分數
  c.fillStyle = 'rgba(255,210,74,.95)';
  c.font = `900 ${Math.round(w * 0.06)}px system-ui, sans-serif`;
  c.textAlign = 'center';
  c.fillText('🥮 中秋大胃王', w / 2, h - w * 0.06);

  out.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'moon-festival-eater.png';
    a.click();
    URL.revokeObjectURL(url);
  }, 'image/png');
}

// ---- 事件綁定 ----
document.getElementById('start-btn')?.addEventListener('click', play);
document.getElementById('again-btn')?.addEventListener('click', play);
document.getElementById('retry-btn')?.addEventListener('click', play);
document.getElementById('share-btn')?.addEventListener('click', screenshot);
