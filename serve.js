#!/usr/bin/env node
/**
 * 零相依靜態檔案伺服器 (純 Node 內建模組)。
 *
 * 為何自製:NixOS 環境下 npm 預編譯 binary (esbuild/rollup) 無法執行,
 * 而本專案採原生 ESM + importmap 不需打包器,只需一個能正確回傳
 * MIME type 的靜態伺服器。純 JS 實作可直接以 nix 提供的 node 執行。
 *
 * 用法:
 *   node serve.js            # http://0.0.0.0:5173
 *   node serve.js --tls      # https (需先 `just cert` 產生 .cert/ 憑證)
 *   PORT=8080 node serve.js
 */

import http from 'node:http';
import https from 'node:https';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, resolve } from 'node:path';
import { networkInterfaces } from 'node:os';

const ROOT = resolve(import.meta.dirname);
const PORT = Number(process.env.PORT ?? 5173);
const USE_TLS = process.argv.includes('--tls');

/** @type {Record<string, string>} */
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.wasm': 'application/wasm',
  '.task': 'application/octet-stream',
};

/**
 * 處理單一請求:防目錄穿越、預設 index.html、正確 MIME。
 * @param {http.IncomingMessage} req
 * @param {http.ServerResponse} res
 */
async function handle(req, res) {
  try {
    const urlPath = decodeURIComponent((req.url ?? '/').split('?')[0]);
    let filePath = normalize(join(ROOT, urlPath));
    if (!filePath.startsWith(ROOT)) {
      res.writeHead(403).end('Forbidden');
      return;
    }

    let info = await stat(filePath).catch(() => null);
    if (info?.isDirectory()) {
      filePath = join(filePath, 'index.html');
      info = await stat(filePath).catch(() => null);
    }
    if (!info) {
      res.writeHead(404).end('Not Found');
      return;
    }

    const body = await readFile(filePath);
    const type = MIME[extname(filePath)] ?? 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-cache' });
    res.end(body);
  } catch (err) {
    res.writeHead(500).end('Internal Server Error');
    console.error(err);
  }
}

/** 列出可供手機連線的區網 IPv4 位址。 */
function lanAddresses() {
  return Object.values(networkInterfaces())
    .flat()
    .filter((n) => n && n.family === 'IPv4' && !n.internal)
    .map((n) => n.address);
}

async function main() {
  const scheme = USE_TLS ? 'https' : 'http';
  let server;

  if (USE_TLS) {
    const [key, cert] = await Promise.all([
      readFile(join(ROOT, '.cert', 'key.pem')),
      readFile(join(ROOT, '.cert', 'cert.pem')),
    ]).catch(() => {
      console.error('✗ 找不到憑證。請先執行 `just cert` 產生 .cert/ 憑證。');
      process.exit(1);
    });
    server = https.createServer({ key, cert }, handle);
  } else {
    server = http.createServer(handle);
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`\n🥮 中秋大胃王 伺服器啟動 (${scheme})`);
    console.log(`   本機:  ${scheme}://localhost:${PORT}`);
    for (const ip of lanAddresses()) {
      console.log(`   手機:  ${scheme}://${ip}:${PORT}`);
    }
    if (!USE_TLS) {
      console.log('\n   ⚠ 手機需 HTTPS 才能開啟相機,請改用 `just dev-tls`。');
    }
    console.log('');
  });
}

main();
