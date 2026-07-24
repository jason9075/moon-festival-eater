import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';

import { GAME } from './config.js';

/** MediaPipe 嘴唇關鍵點索引 */
const LIP = { top: 13, bottom: 14, left: 61, right: 291 };

/**
 * @typedef {Object} MouthState
 * @property {boolean} detected  是否偵測到臉
 * @property {number} x          嘴巴中心 X (0~1,已鏡像)
 * @property {number} y          嘴巴中心 Y (0~1)
 * @property {boolean} open      是否張嘴
 * @property {number} ratio      張嘴比例 (供視覺反饋)
 */

/**
 * 封裝 MediaPipe Face Landmarker,對外提供「嘴巴狀態」。
 * 座標一律回傳正規化 (0~1) 且已完成水平鏡像處理。
 */
export class FaceTracker {
  constructor() {
    /** @type {FaceLandmarker | null} */
    this.landmarker = null;
    this.lastVideoTime = -1;
    /** MediaPipe VIDEO 模式要求嚴格遞增的整數毫秒時間戳 */
    this.prevTs = -1;
    /** @type {MouthState} */
    this.mouth = { detected: false, x: 0.5, y: 0.5, open: false, ratio: 0 };
  }

  /**
   * 載入 WASM 與模型。透過 CDN 取得,避免將大型模型打包進專案。
   * 優先使用 GPU delegate;若裝置 / 瀏覽器無法建立 WebGL 內容 (部分舊機、
   * 無 GPU 環境) 則自動退回 CPU (XNNPACK),確保跨裝置皆可執行。
   * @returns {Promise<void>}
   */
  async init() {
    const fileset = await FilesetResolver.forVisionTasks(
      'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22-rc.20250304/wasm',
    );
    const build = (delegate) =>
      FaceLandmarker.createFromOptions(fileset, {
        baseOptions: {
          modelAssetPath:
            'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
          delegate,
        },
        runningMode: 'VIDEO',
        numFaces: 1,
      });

    try {
      this.landmarker = await build('GPU');
    } catch (err) {
      console.warn('GPU delegate 初始化失敗,退回 CPU:', err);
      this.landmarker = await build('CPU');
    }
  }

  /**
   * 針對當前影格偵測嘴巴狀態。若 video 尚未更新影格則沿用上次結果。
   * @param {HTMLVideoElement} video
   * @param {number} timestampMs
   * @returns {MouthState}
   */
  detect(video, timestampMs) {
    if (!this.landmarker || video.currentTime === this.lastVideoTime) {
      return this.mouth;
    }
    this.lastVideoTime = video.currentTime;

    // 保證時間戳嚴格遞增,避免 "Packet timestamp mismatch" 錯誤
    const ts = Math.max(Math.round(timestampMs), this.prevTs + 1);
    this.prevTs = ts;

    const result = this.landmarker.detectForVideo(video, ts);
    const faces = result.faceLandmarks;
    if (!faces || faces.length === 0) {
      this.mouth = { ...this.mouth, detected: false, open: false };
      return this.mouth;
    }

    const lm = faces[0];
    const top = lm[LIP.top];
    const bottom = lm[LIP.bottom];
    const left = lm[LIP.left];
    const right = lm[LIP.right];

    const vertical = Math.hypot(top.x - bottom.x, top.y - bottom.y);
    const horizontal = Math.hypot(left.x - right.x, left.y - right.y);
    const ratio = horizontal > 0 ? vertical / horizontal : 0;

    // 鏡像:畫面已 scaleX(-1),故 X 取 (1 - x)
    const cx = 1 - (top.x + bottom.x) / 2;
    const cy = (top.y + bottom.y) / 2;

    this.mouth = {
      detected: true,
      x: cx,
      y: cy,
      open: ratio > GAME.mouthOpenThreshold,
      ratio,
    };
    return this.mouth;
  }
}
