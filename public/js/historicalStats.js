export function groupStockDataByTicker(stockData) {
  const groupedData = new Map();

  stockData.forEach((row) => {
    if (!row || !row.ticker) return;
    const closePrice = Number(row.close_price);
    if (!Number.isFinite(closePrice) || closePrice <= 0) return;

    if (!groupedData.has(row.ticker)) {
      groupedData.set(row.ticker, []);
    }

    groupedData.get(row.ticker).push(closePrice);
  });

  return [...groupedData.entries()].map(([ticker, closePrices]) => ({
    ticker,
    closePrices,
  }));
}

export function calculateHistoricalStats(groupedTickerData) {
  const drift = {};
  const volatility = {};
  const realizedGrowthPct = {};
  const tickerInputs = [];

  groupedTickerData.forEach(({ ticker, closePrices }) => {
    if (!ticker || !Array.isArray(closePrices) || closePrices.length < 2) {
      return;
    }

    const returns = [];
    for (let i = 1; i < closePrices.length; i++) {
      const prev = closePrices[i - 1];
      const curr = closePrices[i];
      if (prev <= 0 || curr <= 0) continue;
      returns.push(Math.log(curr / prev));
    }

    if (returns.length === 0) {
      return;
    }

    const meanReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
    const variance =
      returns.reduce((sum, value) => sum + Math.pow(value - meanReturn, 2), 0) /
      returns.length;

    drift[ticker] = meanReturn;
    volatility[ticker] = Math.sqrt(variance);

    const firstClose = closePrices[0];
    const lastClose = closePrices[closePrices.length - 1];
    realizedGrowthPct[ticker] = ((lastClose / firstClose) - 1) * 100;

    tickerInputs.push({
      ticker,
      initialPrice: lastClose,
      daysInCSV: closePrices.length,
    });
  });

  return {
    drift,
    volatility,
    realizedGrowthPct,
    tickerInputs,
  };
}
