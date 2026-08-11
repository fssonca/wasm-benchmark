export function compareMonteCarloVsHistory(
  monteCarloResults,
  realizedGrowthPctByTicker
) {
  if (!monteCarloResults || monteCarloResults.length === 0) {
    console.error("❌ Monte Carlo results are null or undefined.");
    return;
  }

  const comparisonTable = document.getElementById("comparison");
  comparisonTable.innerHTML =
    "<tr><th>Ticker</th><th>Monte Carlo Mean</th><th>Realized Growth (%)</th><th>Variance</th></tr>";

  const validResults = monteCarloResults.filter(
    (result) => result && result.ticker
  );

  if (validResults.length === 0) {
    console.warn("⚠️ No valid Monte Carlo results. Skipping comparison.");
    return;
  }

  // Sort results alphabetically by ticker
  validResults.sort((a, b) => a.ticker.localeCompare(b.ticker));

  validResults.forEach((entry) => {
    const realizedGrowthPct = realizedGrowthPctByTicker?.[entry.ticker];
    const realizedGrowthDisplay = Number.isFinite(realizedGrowthPct)
      ? `${realizedGrowthPct.toFixed(2)}%`
      : "N/A";

    const tr = document.createElement("tr");
    tr.innerHTML = `
                  <td>${entry.ticker}</td>
                  <td>$${entry.mean.toFixed(2)}</td>
                  <td>${realizedGrowthDisplay}</td>
                  <td>${entry.variance.toFixed(2)}</td>
              `;
    comparisonTable.appendChild(tr);
  });

  console.log(
    `✅ Comparison complete. ${validResults.length} stocks compared.`
  );
}
