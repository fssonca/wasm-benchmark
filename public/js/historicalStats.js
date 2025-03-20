export function calculateHistoricalStats(stockData) {
  const returns = {};
  const drift = {};
  const volatility = {};

  stockData.forEach((row, index, array) => {
    if (index === 0) return;

    let ticker = row.ticker;
    let prevRow = array[index - 1];

    if (ticker !== prevRow.ticker) return;

    let dailyReturn = Math.log(row.close_price / prevRow.close_price);

    if (!returns[ticker]) returns[ticker] = [];
    returns[ticker].push(dailyReturn);
  });

  Object.keys(returns).forEach((ticker) => {
    const meanReturn =
      returns[ticker].reduce((a, b) => a + b, 0) / returns[ticker].length;
    const stdDev = Math.sqrt(
      returns[ticker]
        .map((r) => Math.pow(r - meanReturn, 2))
        .reduce((a, b) => a + b, 0) / returns[ticker].length
    );

    drift[ticker] = meanReturn;
    volatility[ticker] = stdDev;
  });

  return { drift, volatility };
}
