/**
 * server.js - 阿提哈德機票追蹤輕量本機微服務 (Zero dependencies, pure Node.js http)
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const { runTracker } = require('./tracker');

const CONFIG_PATH = path.join(__dirname, 'config.json');
const HTML_PATH = path.join(__dirname, 'index.html');
const HISTORY_PATH = path.join(__dirname, 'history.json');

const config = fs.existsSync(CONFIG_PATH) ? JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8')) : {};
const PORT = (config.settings && config.settings.port) || 3000;

let isUpdating = false;

const server = http.createServer(async (req, res) => {
  // 處理 CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = req.url.split('?')[0];

  // 1. 首頁：提供 index.html
  if (url === '/' || url === '/index.html') {
    if (fs.existsSync(HTML_PATH)) {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      fs.createReadStream(HTML_PATH).pipe(res);
    } else {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('找不到 index.html，請先執行 node generateReport.js');
    }
    return;
  }

  // 2. 狀態 API
  if (url === '/api/status') {
    let history = [];
    if (fs.existsSync(HISTORY_PATH)) {
      try {
        history = JSON.parse(fs.readFileSync(HISTORY_PATH, 'utf8'));
      } catch (e) { }
    }
    const latest = history.length > 0 ? history[history.length - 1] : null;
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({
      isUpdating,
      lastUpdated: latest ? latest.timestamp : null,
      latestPrice: latest ? latest.totalPriceTwd : null
    }));
    return;
  }

  // 3. 手動觸發即時比價 API (/api/update)
  if (url === '/api/update') {
    if (isUpdating) {
      res.writeHead(429, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ success: false, error: '目前已有比價任務正在執行中，請稍候...' }));
      return;
    }

    isUpdating = true;
    console.log(`[${new Date().toLocaleTimeString()}] 收到手動即時比價請求，正在啟動抓取任務...`);

    try {
      const result = await runTracker();
      isUpdating = false;

      let history = [];
      if (fs.existsSync(HISTORY_PATH)) {
        history = JSON.parse(fs.readFileSync(HISTORY_PATH, 'utf8'));
      }
      const latest = history[history.length - 1];

      if (result && result.success) {
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({
          success: true,
          message: `官網即時比價完成！最新總價：NT$ ${result.price.toLocaleString()}`,
          latestPrice: result.price,
          timestamp: latest ? latest.timestamp : new Date().toISOString()
        }));
      } else {
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({
          success: false,
          error: (result && result.message) || '官網查詢未回傳即時票價，系統已嚴格禁止寫入假數據。',
          latestPrice: latest ? latest.totalPriceTwd : null,
          timestamp: latest ? latest.timestamp : null
        }));
      }
    } catch (err) {
      isUpdating = false;
      console.error('執行比價時發生錯誤:', err);
      res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ success: false, error: err.message }));
    }
    return;
  }

  // 未匹配的路由
  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Not Found');
});

server.listen(PORT, () => {
  console.log('====================================================');
  console.log(`✈️  阿提哈德機票追蹤微服務已成功啟動！`);
  console.log(`🌐  本機即時瀏覽器網址: http://localhost:${PORT}`);
  console.log(`💡  支援網頁一鍵比價、點擊按鈕或 Reload 即時更新`);
  console.log('====================================================');
});

