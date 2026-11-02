/**
 * analyzer.js - 智慧票價趨勢分析與購買建議引擎
 */

function analyzeTrends(history, config) {
  if (!history || history.length === 0) {
    return null;
  }

  const baseline = config.targetFlight.baselinePriceTwd;
  const threshold = config.targetFlight.targetPriceThresholdTwd || 125000;

  // 按照時間正序排序
  const sorted = [...history].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  const latest = sorted[sorted.length - 1];
  const previous = sorted.length > 1 ? sorted[sorted.length - 2] : latest;

  const prices = sorted.map(item => item.totalPriceTwd).filter(p => p > 0);
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  const avgPrice = Math.round(prices.reduce((a, b) => a + b, 0) / prices.length);

  const diffFromBaseline = latest.totalPriceTwd - baseline;
  const percentFromBaseline = ((diffFromBaseline / baseline) * 100).toFixed(1);

  const diffFromMin = latest.totalPriceTwd - minPrice;
  const percentFromMin = minPrice > 0 ? ((diffFromMin / minPrice) * 100).toFixed(1) : 0;

  const diffFromPrevious = latest.totalPriceTwd - previous.totalPriceTwd;
  const percentFromPrevious = previous.totalPriceTwd > 0
    ? ((diffFromPrevious / previous.totalPriceTwd) * 100).toFixed(1)
    : 0;

  // 距出發天數計算 (以 2027-07-01 為例)
  const departureDate = new Date(config.targetFlight.legs[0].date);
  const now = new Date(latest.timestamp);
  const diffDays = Math.max(0, Math.ceil((departureDate - now) / (1000 * 60 * 60 * 24)));

  // 下手建議規則 (Recommendation Engine)
  let actionCode = "NEUTRAL";
  let actionTitle = "持續觀望";
  let badgeColor = "blue";
  let reasons = [];

  const isAllTimeLow = latest.totalPriceTwd <= minPrice;
  const isBelowThreshold = latest.totalPriceTwd <= threshold;

  if (isAllTimeLow) {
    actionCode = "STRONG_BUY";
    actionTitle = "極力推薦入手 (歷史新低)";
    badgeColor = "emerald";
    reasons.push(`目前票價 TWD ${latest.totalPriceTwd.toLocaleString()} 為歷史新低價！`);
  } else if (isBelowThreshold) {
    actionCode = "BUY";
    actionTitle = "建議考慮下單 (達標理想價)";
    badgeColor = "emerald";
    reasons.push(`已回跌至預設目標價 TWD ${threshold.toLocaleString()} 以下。`);
  } else if (diffFromMin > 0 && percentFromMin >= 8) {
    actionCode = "WAIT";
    actionTitle = "波段偏高 • 建議持續觀望等待回跌";
    badgeColor = "rose";
    reasons.push(`9/11 曾出現過 TWD ${minPrice.toLocaleString()} 的真實波段低點（每人約 NT$ ${(minPrice / 4).toLocaleString()}）。`);
    reasons.push(`目前 11/02 報價為 TWD ${latest.totalPriceTwd.toLocaleString()}，相比 9 月低點上漲了 NT$ ${diffFromMin.toLocaleString()} (+${percentFromMin}%)。`);
    reasons.push(`歷史證明該航班組合「確實有跌破 12 萬的實績」，不建議在目前 13.3 萬的相對高檔追買，建議等待回檔至 TWD 125,000 以下。`);
  } else {
    actionCode = "NEUTRAL";
    actionTitle = "平盤震盪 (持續每日追蹤)";
    badgeColor = "blue";
    reasons.push(`目前價格處於合理波動範圍，建議每日持續追蹤。`);
  }

  // 季節與時間建議
  if (diffDays > 200) {
    reasons.push(`距離 2027 年 7 月暑假出發尚有約 ${diffDays} 天。歐洲暑期長程線在出發前 5～7 個月（約 2026 年底至 2027 年初）通常會有航司的跨年或春季早鳥促銷檔期，有很大機會再次出現低於 12.5 萬的好價。`);
  } else if (diffDays <= 90) {
    reasons.push(`距離出發僅剩 ${diffDays} 天，暑假檔期空位遞減速度極快，若價格無大幅攀升建議盡速敲定。`);
  }

  return {
    latest,
    previous,
    baseline,
    threshold,
    minPrice,
    maxPrice,
    avgPrice,
    isAllTimeLow,
    diffFromBaseline,
    percentFromBaseline: Number(percentFromBaseline),
    diffFromMin,
    percentFromMin: Number(percentFromMin),
    diffFromPrevious,
    percentFromPrevious: Number(percentFromPrevious),
    diffDays,
    actionCode,
    actionTitle,
    badgeColor,
    reasons
  };
}

module.exports = { analyzeTrends };
