# 中秋大胃王 — task automation (zero-build)
# 進入環境:`nix develop` 或 direnv

set shell := ["bash", "-euo", "pipefail", "-c"]

# 預設列出所有任務
default:
    @just --list

# 桌機開發伺服器 (http://localhost:5173)
dev:
    node serve.js

# 產生手機測試用本機 HTTPS 憑證 (需 mkcert)
cert:
    mkdir -p .cert
    mkcert -install
    mkcert -key-file .cert/key.pem -cert-file .cert/cert.pem \
        localhost 127.0.0.1 $(hostname -I | awk '{print $1}')
    @echo "✓ 憑證已產生於 .cert/。手機請先安裝 mkcert 根憑證後再連線。"

# 手機測試伺服器 (https,同網段裝置可連,相機可用)
dev-tls:
    node serve.js --tls

# 以自訂埠啟動
serve port="5173":
    PORT={{port}} node serve.js
