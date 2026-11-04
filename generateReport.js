/**
 * generateReport.js - 產生阿提哈德機票追蹤視覺化儀表板 (index.html)
 */

const fs = require('fs');
const path = require('path');
const { analyzeTrends } = require('./analyzer');
const { createQuery, Passengers } = require('fast-flights-ts');

// 統一格式化繁體中文日期 (例如 "01 7月" 轉換為 "7月1日")
function formatDisplayDate(dateStr) {
  if (!dateStr) return '';
  const extraMatch = dateStr.match(/\(\+[0-9]+天?\)/);
  const extra = extraMatch ? ` ${extraMatch[0]}` : '';
  const cleanStr = dateStr.replace(/\(\+[0-9]+天?\)/, '').trim();

  // 若格式是 "01 7月" 或 "1 7月" (日 月)
  const dayMonthMatch = cleanStr.match(/^([0-9]{1,2})\s*([0-9]{1,2})月$/);
  if (dayMonthMatch) {
    const day = parseInt(dayMonthMatch[1], 10);
    const month = parseInt(dayMonthMatch[2], 10);
    return `${month}月${day}日${extra}`;
  }

  // 若格式是 "7月1日" 或 "07月01日"
  const monthDayMatch = cleanStr.match(/^([0-9]{1,2})月([0-9]{1,2})日?$/);
  if (monthDayMatch) {
    const month = parseInt(monthDayMatch[1], 10);
    const day = parseInt(monthDayMatch[2], 10);
    return `${month}月${day}日${extra}`;
  }

  // 若是 ISO 格式 "2027-07-01"
  const isoMatch = cleanStr.match(/^([0-9]{4})-([0-9]{1,2})-([0-9]{1,2})/);
  if (isoMatch) {
    const month = parseInt(isoMatch[2], 10);
    const day = parseInt(isoMatch[3], 10);
    return `${month}月${day}日${extra}`;
  }

  return dateStr;
}

// 統一將時間戳格式化為台北時區 (UTC+8) YYYY-MM-DD HH:mm:ss
function formatTimestampToTaipei(item) {
  if (item && item.timestamp) {
    try {
      const d = new Date(item.timestamp);
      if (!isNaN(d.getTime())) {
        return d.toLocaleString('zh-TW', {
          timeZone: 'Asia/Taipei',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false
        }).replace(/\//g, '-');
      }
    } catch (e) { }
  }
  return `${item.dateStr || ''} ${item.timeStr || ''}`.trim();
}

function generateHtmlReport() {
  const configPath = path.join(__dirname, 'config.json');
  const historyPath = path.join(__dirname, 'history.json');
  const outputPath = path.join(__dirname, 'index.html');

  if (!fs.existsSync(configPath) || !fs.existsSync(historyPath)) {
    console.error('缺少 config.json 或 history.json！');
    return;
  }

  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  const history = JSON.parse(fs.readFileSync(historyPath, 'utf8'));

  const analysis = analyzeTrends(history, config);
  if (!analysis) {
    console.error('無有效歷史紀錄');
    return;
  }

  // 整理 Chart.js 資料（支援「近期每日追蹤」與「完整歷史走勢」雙檢視切換）
  const sortedHistory = [...history].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  // 近期追蹤點（以 2026-11-01 正式定期追蹤啟動起算，避開早期單筆波段低點拉寬比例尺）
  const recentHistory = sortedHistory.filter(item => new Date(item.timestamp) >= new Date('2026-11-01T00:00:00+08:00'));
  const effectiveRecentHistory = recentHistory.length > 0 ? recentHistory : sortedHistory.slice(-10);

  const allLabels = sortedHistory.map(item => item.dateStr + ' ' + (item.timeStr || ''));
  const allPrices = sortedHistory.map(item => item.totalPriceTwd);
  const allBaselines = sortedHistory.map(() => config.targetFlight.baselinePriceTwd);

  const recentLabels = effectiveRecentHistory.map(item => item.dateStr + ' ' + (item.timeStr || ''));
  const recentPrices = effectiveRecentHistory.map(item => item.totalPriceTwd);
  const recentBaselines = effectiveRecentHistory.map(() => config.targetFlight.baselinePriceTwd);

  const latestRecord = analysis.latest || {};
  // 優先使用最新抓取並經 Key 比對之動態航段資料，無則 fallback 至 config
  const leg1 = (latestRecord.leg1Details) ? latestRecord.leg1Details : config.targetFlight.legs[0];
  const leg2 = (latestRecord.leg2Details) ? latestRecord.leg2Details : config.targetFlight.legs[1];
  const equipmentCheck = latestRecord.equipmentCheck || { isA380Confirmed: true, statusLabel: "已即時比對確認：執飛機型為 A380 雙層巨無霸旗艦客機" };
  const scheduleChanges = latestRecord.scheduleChanges || [];

  // 訂票比價直達連結 (Google Flights 官方直連阿提哈德航線頁面，包含4人、多停點、指定日期與班號)
  let deepLink = 'https://www.etihad.com/zt-tw/book';
  try {
    const p = new Passengers({
      adults: config.targetFlight.passengers.adults,
      children: config.targetFlight.passengers.children
    });
    const q = createQuery({
      flights: [
        { from_airport: config.targetFlight.legs[0].origin, to_airport: config.targetFlight.legs[0].destination, date: config.targetFlight.legs[0].date, airlines: ['EY'] },
        { from_airport: config.targetFlight.legs[1].origin, to_airport: config.targetFlight.legs[1].destination, date: config.targetFlight.legs[1].date, airlines: ['EY'] }
      ],
      trip: 'multi-city',
      seat: 'economy',
      passengers: p,
      language: 'zh-TW',
      currency: 'TWD'
    });
    deepLink = q.url();
  } catch (e) { }

  // 格式化最後更新時間 (鎖定台北時區 Asia/Taipei)
  const lastUpdatedDisplay = analysis.latest.timestamp
    ? new Date(analysis.latest.timestamp).toLocaleString('zh-TW', {
      timeZone: 'Asia/Taipei',
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
      hour12: false
    }).replace(/\//g, '-')
    : '2026-11-02 13:31:18';

  const html = `<!DOCTYPE html>
<html lang="zh-TW" class="dark">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>2027 英國法國 F1 家族之旅 | 阿提哈德機票價格追蹤雷達</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Noto+Sans+TC:wght@400;500;700&display=swap" rel="stylesheet">
  <script>
    tailwind.config = {
      darkMode: 'class',
      theme: {
        extend: {
          fontFamily: {
            sans: ['"Plus Jakarta Sans"', '"Noto Sans TC"', 'sans-serif'],
          },
          colors: {
            brand: {
              gold: '#D4AF37',
              darkgold: '#B89628',
              etihad: '#BD9B60'
            }
          }
        }
      }
    }
  </script>
  <style>
    body {
      background: radial-gradient(circle at 50% 0%, #1e293b 0%, #0f172a 100%);
      min-height: 100vh;
    }
    .glass-card {
      background: rgba(30, 41, 59, 0.75);
      backdrop-filter: blur(12px);
      border: 1px solid rgba(255, 255, 255, 0.08);
    }
    .glow-gold {
      box-shadow: 0 0 25px rgba(212, 175, 55, 0.15);
    }
    .animate-spin-fast {
      animation: spin 0.8s linear infinite;
    }
    @keyframes spin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }
  </style>
</head>
<body class="text-slate-100 font-sans p-4 md:p-8 antialiased">
  <div class="max-w-6xl mx-auto space-y-8">
    
    <!-- 頂部 Header & 潤飾後排版 -->
    <header class="flex flex-col md:flex-row md:items-center justify-between gap-5 pb-6 border-b border-slate-700/60">
      <div class="space-y-2">
        
        <!-- 標籤徽章列 -->
        <div class="flex items-center gap-2 flex-wrap">
          <span class="px-3 py-1 rounded-md text-xs font-extrabold bg-rose-500/20 text-rose-300 border border-rose-500/30 uppercase tracking-wider flex items-center gap-1.5">
            <span>🏁</span> 2027 英國 • 法國 F1 家族之旅
          </span>
          <span class="px-3 py-1 rounded-md text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1.5">
            <span>👨‍👩‍👧‍👦</span> 家庭票 (3大1小)
          </span>
          <span class="px-3 py-1 rounded-md text-xs font-bold bg-sky-500/20 text-sky-300 border border-sky-500/30 flex items-center gap-1.5">
            <span>✈️</span> 倫敦進 (LHR) • 巴黎出 (CDG)
          </span>
        </div>

        <div class="flex items-center gap-3.5">
          <div class="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-500 via-rose-500 to-amber-300 flex items-center justify-center shadow-lg shadow-rose-500/20 text-2xl flex-shrink-0">
            🏎️
          </div>
          <div>
            <h1 class="text-2xl md:text-3xl font-extrabold tracking-tight bg-gradient-to-r from-amber-200 via-yellow-100 to-rose-200 bg-clip-text text-transparent">
              阿提哈德機票價格追蹤雷達
            </h1>
            
            <!-- 最近一次更新時間標示 -->
            <div class="flex items-center gap-2 mt-1.5 text-sm text-slate-300">
              <span class="flex items-center gap-1.5 text-emerald-400 font-semibold">
                <span class="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
                <span>最近一次更新：</span>
              </span>
              <span id="lastUpdatedText" class="font-mono text-slate-100 bg-slate-800/90 px-2.5 py-0.5 rounded border border-slate-700 font-bold text-sm">
                ${lastUpdatedDisplay}
              </span>
            </div>
          </div>
        </div>

      </div>

      <!-- 控制按鈕群 (官網比價預訂) -->
      <div class="flex items-center gap-3 flex-wrap">
        <!-- 官網訂票深層連結 -->
        <a href="${deepLink}" target="_blank" rel="noopener noreferrer" 
           class="px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-sm shadow-lg shadow-amber-500/20 transition-all flex items-center gap-2">
          <span>前往官網比價預訂</span>
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path></svg>
        </a>
      </div>
    </header>

    <!-- KPI 統計摘要卡片群 -->
    <section class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      
      <!-- 當前最新總價 -->
      <div class="glass-card rounded-2xl p-5 relative overflow-hidden">
        <div class="text-sm uppercase tracking-wider text-slate-300 font-semibold mb-1">當前最新總票價 (含稅・經濟艙 Value)</div>
        <div class="text-3xl font-black text-amber-300">
          NT$ ${analysis.latest.totalPriceTwd.toLocaleString()}
        </div>
        <div class="mt-2 flex items-center gap-1.5 text-sm font-semibold ${analysis.diffFromBaseline <= 0 ? 'text-emerald-400' : 'text-rose-400'}">
          <span>${analysis.diffFromBaseline <= 0 ? '▼ 降' : '▲ 漲'} NT$ ${Math.abs(analysis.diffFromBaseline).toLocaleString()}</span>
          <span>(${analysis.percentFromBaseline > 0 ? '+' : ''}${analysis.percentFromBaseline}% 相比基準)</span>
        </div>
        <div class="mt-1 text-xs text-slate-400">
          ${analysis.latest.basicPriceTwd ? `Basic 基礎 NT$ ${analysis.latest.basicPriceTwd.toLocaleString()} + Value 升等 NT$ ${(analysis.latest.fareUpgradeTwd || 5333).toLocaleString()} | ` : ''}人均約 NT$ ${(analysis.latest.totalPriceTwd / 4).toLocaleString()}
        </div>
      </div>

      <!-- 基準參考價 -->
      <div class="glass-card rounded-2xl p-5">
        <div class="text-sm uppercase tracking-wider text-slate-300 font-semibold mb-1">初始截圖基準價</div>
        <div class="text-3xl font-black text-slate-200">
          NT$ ${analysis.baseline.toLocaleString()}
        </div>
        <div class="mt-2 text-sm text-slate-300 flex items-center gap-1">
          <span>紀錄時間：2026/11/02</span>
        </div>
        <div class="mt-1 text-xs text-slate-400">艙等：經濟艙 Value</div>
      </div>

      <!-- 歷史最低價紀錄 -->
      <div class="glass-card rounded-2xl p-5">
        <div class="text-sm uppercase tracking-wider text-slate-300 font-semibold mb-1">歷史最低記錄</div>
        <div class="text-3xl font-black text-emerald-400">
          NT$ ${analysis.minPrice.toLocaleString()}
        </div>
        <div class="mt-2 text-sm text-emerald-300/90 flex items-center gap-1 font-semibold">
          <span>${analysis.isAllTimeLow ? '🔥 當前正處於最低點' : '歷史波段低檔'}</span>
        </div>
        <div class="mt-1 text-xs text-slate-400">歷史最高：NT$ ${analysis.maxPrice.toLocaleString()}</div>
      </div>

      <!-- 出發倒數與天數 -->
      <div class="glass-card rounded-2xl p-5">
        <div class="text-sm uppercase tracking-wider text-slate-300 font-semibold mb-1">距離出發 (2027/07/01)</div>
        <div class="text-3xl font-black text-blue-300">
          ${analysis.diffDays} <span class="text-lg font-bold text-slate-400">天</span>
        </div>
        <div class="mt-2 text-sm text-blue-400/90 font-semibold flex items-center gap-1">
          <span>暑期大旺季航檔</span>
        </div>
        <div class="mt-1 text-xs text-slate-400">建議在出發前 5～7 個月定案</div>
      </div>

    </section>

    <!-- 下手購買建議評估卡 (Buying Decision Engine) -->
    <section class="glass-card rounded-2xl p-6 glow-gold border border-amber-500/20 bg-gradient-to-br from-slate-900/90 to-amber-950/20">
      <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
        <div class="flex items-center gap-3">
          <span class="text-3xl">💡</span>
          <div>
            <h2 class="text-xl font-bold text-amber-200">智慧票價趨勢分析與購買建議</h2>
            <p class="text-sm text-slate-400">基於歷史價格走勢、旺季前置期及票價波動區間綜合評估</p>
          </div>
        </div>
        <div>
          <span class="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold uppercase tracking-wider
            ${analysis.badgeColor === 'emerald' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' :
      analysis.badgeColor === 'rose' ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30' :
        'bg-blue-500/20 text-blue-300 border border-blue-500/30'}">
            <span class="w-2.5 h-2.5 rounded-full ${analysis.badgeColor === 'emerald' ? 'bg-emerald-400' : analysis.badgeColor === 'rose' ? 'bg-rose-400' : 'bg-blue-400'} animate-pulse"></span>
            ${analysis.actionTitle}
          </span>
        </div>
      </div>

      <div class="space-y-3 text-base text-slate-200 leading-relaxed bg-slate-950/40 rounded-xl p-5 border border-slate-800">
        ${analysis.reasons.map(r => `<div class="flex items-start gap-3">
          <span class="text-amber-400 font-bold text-lg">•</span>
          <span>${r}</span>
        </div>`).join('')}
      </div>
    </section>

    <!-- 鎖定追蹤之航段詳細資訊 (包含班次編號、機型、轉機抵達與起飛時間) -->
    <section class="space-y-4">
      <h3 class="text-base uppercase tracking-wider text-slate-300 font-bold flex items-center gap-2">
        <span>鎖定追蹤之航班明細（班機號碼 • 機型 • 轉機銜接時間）</span>
      </h3>
      
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        <!-- 去程 (TPE ➔ LHR) 詳細卡片 -->
        <div class="glass-card rounded-2xl p-6 border-l-4 border-l-amber-500 space-y-4">
          <div class="flex items-center justify-between border-b border-slate-700/60 pb-3">
            <div>
              <span class="px-3 py-1 rounded bg-amber-500/10 text-amber-300 font-bold text-sm">第 1 航程 • 去程</span>
              <h4 class="text-lg font-bold text-slate-100 mt-1">${leg1.dateLabel}</h4>
            </div>
            <div class="text-right text-sm text-slate-300">
              <div>總歷時：${leg1.totalDuration}</div>
              <div class="text-amber-400 font-medium">經濟艙 Value</div>
            </div>
          </div>

          <!-- 子航段 1: TPE -> AUH -->
          <div class="bg-slate-900/60 rounded-xl p-4 border border-slate-800/80 space-y-2">
            <div class="flex items-center justify-between text-sm">
              <span class="font-extrabold text-amber-400 flex items-center gap-2 text-base">
                ✈️ ${leg1.segments[0].flightNumber}
                <span class="text-xs font-normal text-slate-300">(${leg1.segments[0].airline})</span>
              </span>
              <span class="px-2.5 py-1 rounded bg-slate-800 text-slate-300 font-mono text-xs font-semibold">
                機型：${leg1.segments[0].aircraft}
              </span>
            </div>
            <div class="flex items-center justify-between pt-1">
              <div>
                <div class="text-2xl font-black text-slate-100">${leg1.segments[0].departureTime}</div>
                <div class="text-sm font-bold text-amber-300">${leg1.segments[0].originCode} (${leg1.segments[0].originTerminal})</div>
                <div class="text-xs text-slate-300">${leg1.segments[0].originName}</div>
                <div class="text-xs text-slate-400 font-semibold">${formatDisplayDate(leg1.segments[0].departureDate)}</div>
              </div>
              <div class="text-center px-2">
                <div class="text-xs text-slate-400">飛行時間</div>
                <div class="text-sm font-semibold text-slate-200">${leg1.segments[0].duration}</div>
                <div class="text-slate-600">────────▶</div>
              </div>
              <div class="text-right">
                <div class="text-2xl font-black text-slate-100">${leg1.segments[0].arrivalTime}</div>
                <div class="text-sm font-bold text-amber-300">${leg1.segments[0].destinationCode} (${leg1.segments[0].destinationTerminal})</div>
                <div class="text-xs text-slate-300">${leg1.segments[0].destinationName}</div>
                <div class="text-xs text-slate-400 font-semibold">${formatDisplayDate(leg1.segments[0].arrivalDate)}</div>
              </div>
            </div>
          </div>

          <!-- 中轉資訊 AUH -->
          <div class="flex items-center justify-center gap-2 py-1.5 px-3 bg-amber-500/10 rounded-lg border border-amber-500/20 text-sm text-amber-300">
            <span>⏱️ 轉機停留：<strong>${leg1.layover.duration}</strong></span>
            <span class="text-slate-500">|</span>
            <span>地點：${leg1.layover.airport}</span>
          </div>

          <!-- 子航段 2: AUH -> LHR (A380!) -->
          <div class="bg-slate-900/60 rounded-xl p-4 border border-slate-800/80 space-y-2">
            <div class="flex items-center justify-between text-sm">
              <span class="font-extrabold text-amber-400 flex items-center gap-2 text-base">
                ✈️ ${leg1.segments[1].flightNumber}
                <span class="text-xs font-normal text-slate-300">(${leg1.segments[1].airline})</span>
              </span>
              <span class="px-2.5 py-1 rounded bg-amber-950/80 text-amber-300 font-bold font-mono text-xs border border-amber-700/40">
                機型：${leg1.segments[1].aircraft} (旗艦雙層巨無霸)
              </span>
            </div>
            <div class="flex items-center justify-between pt-1">
              <div>
                <div class="text-2xl font-black text-slate-100">${leg1.segments[1].departureTime}</div>
                <div class="text-sm font-bold text-amber-300">${leg1.segments[1].originCode} (${leg1.segments[1].originTerminal})</div>
                <div class="text-xs text-slate-300">${leg1.segments[1].originName}</div>
                <div class="text-xs text-slate-400 font-semibold">${formatDisplayDate(leg1.segments[1].departureDate)}</div>
              </div>
              <div class="text-center px-2">
                <div class="text-xs text-slate-400">飛行時間</div>
                <div class="text-sm font-semibold text-slate-200">${leg1.segments[1].duration}</div>
                <div class="text-slate-600">────────▶</div>
              </div>
              <div class="text-right">
                <div class="text-2xl font-black text-slate-100">${leg1.segments[1].arrivalTime}</div>
                <div class="text-sm font-bold text-amber-300">${leg1.segments[1].destinationCode} (${leg1.segments[1].destinationTerminal})</div>
                <div class="text-xs text-slate-300">${leg1.segments[1].destinationName}</div>
                <div class="text-xs text-slate-400 font-semibold">${formatDisplayDate(leg1.segments[1].arrivalDate)}</div>
              </div>
            </div>
          </div>
        </div>

        <!-- 回程 (CDG ➔ TPE) 詳細卡片 -->
        <div class="glass-card rounded-2xl p-6 border-l-4 border-l-sky-500 space-y-4">
          <div class="flex items-center justify-between border-b border-slate-700/60 pb-3">
            <div>
              <span class="px-3 py-1 rounded bg-sky-500/10 text-sky-300 font-bold text-sm">第 2 航程 • 回程</span>
              <h4 class="text-lg font-bold text-slate-100 mt-1">${leg2.dateLabel}</h4>
            </div>
            <div class="text-right text-sm text-slate-300">
              <div>總歷時：${leg2.totalDuration}</div>
              <div class="text-sky-400 font-medium">經濟艙 Value</div>
            </div>
          </div>

          <!-- 子航段 1: CDG -> AUH -->
          <div class="bg-slate-900/60 rounded-xl p-4 border border-slate-800/80 space-y-2">
            <div class="flex items-center justify-between text-sm">
              <span class="font-extrabold text-sky-400 flex items-center gap-2 text-base">
                ✈️ ${leg2.segments[0].flightNumber}
                <span class="text-xs font-normal text-slate-300">(${leg2.segments[0].airline})</span>
              </span>
              <span class="px-2.5 py-1 rounded bg-slate-800 text-slate-300 font-mono text-xs font-semibold">
                機型：${leg2.segments[0].aircraft}
              </span>
            </div>
            <div class="flex items-center justify-between pt-1">
              <div>
                <div class="text-2xl font-black text-slate-100">${leg2.segments[0].departureTime}</div>
                <div class="text-sm font-bold text-sky-300">${leg2.segments[0].originCode} (${leg2.segments[0].originTerminal})</div>
                <div class="text-xs text-slate-300">${leg2.segments[0].originName}</div>
                <div class="text-xs text-slate-400 font-semibold">${formatDisplayDate(leg2.segments[0].departureDate)}</div>
              </div>
              <div class="text-center px-2">
                <div class="text-xs text-slate-400">飛行時間</div>
                <div class="text-sm font-semibold text-slate-200">${leg2.segments[0].duration}</div>
                <div class="text-slate-600">────────▶</div>
              </div>
              <div class="text-right">
                <div class="text-2xl font-black text-slate-100">${leg2.segments[0].arrivalTime}</div>
                <div class="text-sm font-bold text-sky-300">${leg2.segments[0].destinationCode} (${leg2.segments[0].destinationTerminal})</div>
                <div class="text-xs text-slate-300">${leg2.segments[0].destinationName}</div>
                <div class="text-xs text-slate-400 font-semibold">${formatDisplayDate(leg2.segments[0].arrivalDate)}</div>
              </div>
            </div>
          </div>

          <!-- 中轉資訊 AUH (白天過境 14h 50m) -->
          <div class="flex items-center justify-center gap-2 py-1.5 px-3 bg-sky-500/10 rounded-lg border border-sky-500/20 text-sm text-sky-300">
            <span>⏱️ 轉機停留：<strong>${leg2.layover.duration}</strong> (白天過境)</span>
            <span class="text-slate-500">|</span>
            <span>地點：${leg2.layover.airport}</span>
          </div>

          <!-- 子航段 2: AUH -> TPE -->
          <div class="bg-slate-900/60 rounded-xl p-4 border border-slate-800/80 space-y-2">
            <div class="flex items-center justify-between text-sm">
              <span class="font-extrabold text-sky-400 flex items-center gap-2 text-base">
                ✈️ ${leg2.segments[1].flightNumber}
                <span class="text-xs font-normal text-slate-300">(${leg2.segments[1].airline})</span>
              </span>
              <span class="px-2.5 py-1 rounded bg-slate-800 text-slate-300 font-mono text-xs font-semibold">
                機型：${leg2.segments[1].aircraft}
              </span>
            </div>
            <div class="flex items-center justify-between pt-1">
              <div>
                <div class="text-2xl font-black text-slate-100">${leg2.segments[1].departureTime}</div>
                <div class="text-sm font-bold text-sky-300">${leg2.segments[1].originCode} (${leg2.segments[1].originTerminal})</div>
                <div class="text-xs text-slate-300">${leg2.segments[1].originName}</div>
                <div class="text-xs text-slate-400 font-semibold">${formatDisplayDate(leg2.segments[1].departureDate)}</div>
              </div>
              <div class="text-center px-2">
                <div class="text-xs text-slate-400">飛行時間</div>
                <div class="text-sm font-semibold text-slate-200">${leg2.segments[1].duration}</div>
                <div class="text-slate-600">────────▶</div>
              </div>
              <div class="text-right">
                <div class="text-2xl font-black text-slate-100">${leg2.segments[1].arrivalTime}</div>
                <div class="text-sm font-bold text-sky-300">${leg2.segments[1].destinationCode} (${leg2.segments[1].destinationTerminal})</div>
                <div class="text-xs text-slate-300">${leg2.segments[1].destinationName}</div>
                <div class="text-xs text-slate-400 font-semibold">${formatDisplayDate(leg2.segments[1].arrivalDate)}</div>
              </div>
            </div>
          </div>
        </div>

      </div>
    </section>

    <!-- 價格歷史走勢圖表 -->
    <section class="glass-card rounded-2xl p-6">
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
        <div>
          <div class="flex items-center gap-2.5">
            <h3 class="text-xl font-bold text-slate-100">價格歷史波動走勢圖 (TWD)</h3>
            <span id="chartRangeBadge" class="text-xs px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/20 font-semibold">
              近期每日追蹤
            </span>
          </div>
          <p class="text-sm text-slate-400 mt-0.5">每日定時紀錄點與基準線比對</p>
        </div>
        
        <div class="flex items-center gap-3.5 flex-wrap">
          <!-- 檢視模式切換器 -->
          <div class="inline-flex p-1 bg-slate-800/90 rounded-xl border border-slate-700/80 text-xs font-semibold shadow-inner">
            <button id="btnRecent" type="button" onclick="switchChartMode('recent')" class="px-3 py-1.5 rounded-lg transition-all bg-amber-500 text-slate-950 font-bold shadow-sm">
              近期追蹤 (11/02起)
            </button>
            <button id="btnAll" type="button" onclick="switchChartMode('all')" class="px-3 py-1.5 rounded-lg transition-all text-slate-400 hover:text-slate-200">
              全部紀錄 (含9/11低點)
            </button>
          </div>

          <!-- 圖例標示 -->
          <div class="hidden md:flex items-center gap-3.5 text-xs font-semibold">
            <div class="flex items-center gap-1.5 text-amber-400">
              <span class="w-3 h-3 rounded-full bg-amber-400 inline-block"></span>
              <span>實際總價</span>
            </div>
            <div class="flex items-center gap-1.5 text-slate-300">
              <span class="w-3.5 h-0.5 bg-slate-400 inline-block"></span>
              <span>初始基準線 (133,550)</span>
            </div>
          </div>
        </div>
      </div>
      <div class="h-72 w-full">
        <canvas id="priceChart"></canvas>
      </div>
    </section>

    <!-- 歷史抓取紀錄資料表格 -->
    <section class="glass-card rounded-2xl p-6 overflow-hidden">
      <h3 class="text-xl font-bold text-slate-100 mb-4">歷史抓取明細清單</h3>
      <div class="overflow-x-auto">
        <table class="w-full text-left text-base text-slate-200">
          <thead class="text-sm font-semibold uppercase bg-slate-800/80 text-slate-300 border-b border-slate-700">
            <tr>
              <th scope="col" class="py-3 px-4">抓取日期時間</th>
              <th scope="col" class="py-3 px-4">總票價 (TWD)</th>
              <th scope="col" class="py-3 px-4">人均票價</th>
              <th scope="col" class="py-3 px-4">基準價差</th>
              <th scope="col" class="py-3 px-4">機位狀態</th>
              <th scope="col" class="py-3 px-4">紀錄備註</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-800">
            ${[...history].reverse().map(item => {
          const diff = item.totalPriceTwd - config.targetFlight.baselinePriceTwd;
          return `
              <tr class="hover:bg-slate-800/40 transition-colors">
                <td class="py-3 px-4 font-mono text-sm text-slate-300">${formatTimestampToTaipei(item)}</td>
                <td class="py-3 px-4 font-bold text-amber-300 text-lg">NT$ ${item.totalPriceTwd.toLocaleString()}</td>
                <td class="py-3 px-4 text-slate-200 text-sm">NT$ ${(item.totalPriceTwd / 4).toLocaleString()}</td>
                <td class="py-3 px-4 font-semibold text-sm ${diff <= 0 ? 'text-emerald-400' : 'text-rose-400'}">
                  ${diff === 0 ? '-' : (diff < 0 ? `▼ -NT$ ${Math.abs(diff).toLocaleString()}` : `▲ +NT$ ${diff.toLocaleString()}`)}
                </td>
                <td class="py-3 px-4">
                  <span class="px-2.5 py-1 rounded text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    ${item.status || 'Available'}
                  </span>
                </td>
                <td class="py-3 px-4 text-sm text-slate-300">${item.note || '自動定期監控紀錄'}</td>
              </tr>
              `;
        }).join('')}
          </tbody>
        </table>
      </div>
    </section>

    <!-- 底部說明 -->
    <footer class="pt-6 border-t border-slate-800 text-center text-sm text-slate-400 space-y-1">
      <p>🏎️ 2027 英國法國 F1 家族之旅 • 阿提哈德特定航班機票價格追蹤雷達</p>
      <p>去程：EY 899 轉 EY 61 (A380) | 回程：EY 34 轉 EY 898 (阿布達比過境)</p>
    </footer>

  </div>

  <script>
    // 渲染 Chart.js (支援近期追蹤與全部走勢切換)
    const chartDataSets = {
      recent: {
        labels: ${JSON.stringify(recentLabels)},
        prices: ${JSON.stringify(recentPrices)},
        baselines: ${JSON.stringify(recentBaselines)},
        badge: '近期每日追蹤'
      },
      all: {
        labels: ${JSON.stringify(allLabels)},
        prices: ${JSON.stringify(allPrices)},
        baselines: ${JSON.stringify(allBaselines)},
        badge: '全部紀錄 (含9/11低點)'
      }
    };

    let currentMode = 'recent';
    const ctx = document.getElementById('priceChart').getContext('2d');
    const priceChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: chartDataSets.recent.labels,
        datasets: [
          {
            label: '總票價 (TWD)',
            data: chartDataSets.recent.prices,
            borderColor: '#F59E0B',
            backgroundColor: 'rgba(245, 158, 11, 0.12)',
            fill: true,
            tension: 0.3,
            borderWidth: 3,
            pointBackgroundColor: '#F59E0B',
            pointRadius: 5,
            pointHoverRadius: 8
          },
          {
            label: '初始基準線 (NT$ 133,550)',
            data: chartDataSets.recent.baselines,
            borderColor: '#64748B',
            borderDash: [5, 5],
            borderWidth: 2,
            pointRadius: 0,
            fill: false
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#0F172A',
            titleColor: '#F8FAFC',
            bodyColor: '#F8FAFC',
            borderColor: '#334155',
            borderWidth: 1,
            padding: 12,
            callbacks: {
              label: function(context) {
                return context.dataset.label + ': NT$ ' + context.parsed.y.toLocaleString();
              }
            }
          }
        },
        scales: {
          x: {
            grid: { color: 'rgba(255, 255, 255, 0.05)' },
            ticks: { color: '#94A3B8', font: { size: 11 } }
          },
          y: {
            beginAtZero: false,
            grid: { color: 'rgba(255, 255, 255, 0.05)' },
            ticks: {
              color: '#94A3B8',
              callback: function(value) {
                return 'NT$ ' + Number(value).toLocaleString();
              }
            }
          }
        }
      }
    });

    function switchChartMode(mode) {
      if (currentMode === mode) return;
      currentMode = mode;
      const target = chartDataSets[mode];
      
      priceChart.data.labels = target.labels;
      priceChart.data.datasets[0].data = target.prices;
      priceChart.data.datasets[1].data = target.baselines;
      priceChart.update();

      const btnRecent = document.getElementById('btnRecent');
      const btnAll = document.getElementById('btnAll');
      const badge = document.getElementById('chartRangeBadge');

      const activeClass = 'px-3 py-1.5 rounded-lg transition-all bg-amber-500 text-slate-950 font-bold shadow-sm';
      const inactiveClass = 'px-3 py-1.5 rounded-lg transition-all text-slate-400 hover:text-slate-200';

      if (mode === 'recent') {
        btnRecent.className = activeClass;
        btnAll.className = inactiveClass;
      } else {
        btnAll.className = activeClass;
        btnRecent.className = inactiveClass;
      }
      if (badge) badge.textContent = target.badge;
    }
  </script>
</body>
</html>`;

  fs.writeFileSync(outputPath, html, 'utf8');
  console.log(`[成功] 已產出最新儀表板網頁：${outputPath}`);
}

if (require.main === module) {
  generateHtmlReport();
}

module.exports = { generateHtmlReport };
