# 🥮 中秋大胃王 (Moon Festival Catch & Eat)

WebCam 臉部偵測體感遊戲:張開嘴巴「吃掉」掉落的月餅、柚子與玉兔,60 秒內挑戰高分。支援手機直式操作。

## 技術特色

- **零建構 (Zero-build)**:原生 ES Modules + `importmap`,毋須打包器。避開 NixOS 下 esbuild/rollup 預編譯 binary 無法執行的問題。
- **臉部偵測**:[MediaPipe Face Landmarker](https://ai.google.dev/edge/mediapipe)(`@mediapipe/tasks-vision`),經 CDN 以 ESM 載入;GPU delegate 失敗時自動退回 CPU。
- **純前端運算**:影像僅於本機處理,不上傳。
- **無外部音效檔**:以 Web Audio API 即時合成音效。
- **向量素材**:掉落物為自包含 SVG(以 `codex` 生成)。

## 開發

需要 `nix`(專案以 `flake.nix` 管理環境)。

```sh
nix develop            # 或啟用 direnv 自動進入
just dev               # 桌機開發 → http://localhost:5173
```

### 手機測試(相機需 HTTPS)

行動裝置瀏覽器僅允許在安全來源存取相機,需自簽憑證:

```sh
just cert              # 以 mkcert 產生 .cert/ 憑證(並安裝根憑證)
just dev-tls           # https 伺服器,終端機會印出手機可連的區網網址
```

> 手機需先安裝 mkcert 根憑證,或於瀏覽器接受自簽憑證警告。

## 專案結構

```
├── index.html         # 進入點 + importmap
├── serve.js           # 零相依靜態伺服器(HTTP / HTTPS)
├── assets/            # SVG 掉落物素材
└── src/
    ├── main.js        # 流程控制:相機 → 素材 → 模型 → 開始
    ├── config.js      # 遊戲常數、掉落物規格、評等
    ├── face.js        # MediaPipe 封裝,輸出嘴巴狀態
    ├── game.js        # 主迴圈:生成 / 物理 / 碰撞 / 渲染
    ├── audio.js       # Web Audio 音效合成
    ├── ui.js          # DOM 畫面切換與 HUD
    └── style.css
```

## 玩法

| 物件 | 得分 | 說明 |
| --- | --- | --- |
| 🥮 月餅 | +10 | 中速掉落 |
| 🍈 柚子 | +20 | 快速掉落 |
| 🐇 玉兔 | +50 | 極快,吃到清空全畫面 |
| 💣 炸彈 | -30 | 慢速,額外扣 3 秒 |

最後 15 秒進入 **Rush Hour**,掉落速度與頻率加倍。

## 授權

[MIT](./LICENSE) © 2026 Jason Kuan ([jason9075](https://github.com/jason9075))
