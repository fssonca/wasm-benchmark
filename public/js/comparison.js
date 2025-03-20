export function compareMonteCarloVsHistory(monteCarloResults, historicalDrift) {
  if (!monteCarloResults || monteCarloResults.length === 0) {
    console.error("❌ Monte Carlo results are null or undefined.");
    return;
  }

  const comparisonTable = document.getElementById("comparison");
  comparisonTable.innerHTML =
    "<tr><th>Ticker</th><th>Monte Carlo Mean</th><th>Actual Growth</th><th>Variance</th></tr>";

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
    const historicalPriceChange =
      entry.mean * Math.exp(historicalDrift[entry.ticker] * 252);

    const tr = document.createElement("tr");
    tr.innerHTML = `
                  <td>${entry.ticker}</td>
                  <td>$${entry.mean.toFixed(2)}</td>
                  <td>$${historicalPriceChange.toFixed(2)}</td>
                  <td>${entry.variance.toFixed(2)}</td>
              `;
    comparisonTable.appendChild(tr);
  });

  console.log(
    `✅ Comparison complete. ${validResults.length} stocks compared.`
  );
}
