export function processWithWasmWorkers(
  stockData,
  simulations,
  drift,
  volatility
) {
  return new Promise((resolve) => {
    const results = [];
    let completedWorkers = 0;
    let totalOperations = 0;
    const startTime = performance.now();

    const uniqueTickers = [...new Set(stockData.map((s) => s.ticker))];
    if (uniqueTickers.length === 0) {
      console.error("❌ No valid tickers found for simulation!");
      resolve([]);
      return;
    }

    const MAX_CONCURRENT_WORKERS = 10;
    let currentWorkerIndex = 0;
    let activeWorkers = 0;

    // We will compute total operations as (#days * #simulations) across all tickers
    // We can't do that until we know each ticker's day count:
    // But for demonstration, let's build a precomputed map:
    const tickerDaysMap = {};
    uniqueTickers.forEach((ticker) => {
      const tickerData = stockData.filter((s) => s.ticker === ticker);
      tickerDaysMap[ticker] = tickerData.length;
    });

    // Now sum them up:
    let totalOps = 0;
    uniqueTickers.forEach((ticker) => {
      const daysInCSV = tickerDaysMap[ticker];
      totalOps += daysInCSV * simulations;
    });

    function startNextWorker() {
      if (currentWorkerIndex >= uniqueTickers.length) return;
      if (activeWorkers >= MAX_CONCURRENT_WORKERS) return;

      const ticker = uniqueTickers[currentWorkerIndex];
      const tickerData = stockData.filter((s) => s.ticker === ticker);

      if (!tickerData || tickerData.length === 0) {
        console.warn(`⚠️ Skipping ${ticker}: Missing or invalid data.`);
        checkCompletion();
        return;
      }

      const worker = new Worker("wasm/wasmWorker.js", { type: "module" });
      activeWorkers++;

      worker.postMessage({
        tickerData,
        simulations,
        drift: drift[ticker] || 0,
        volatility: volatility[ticker] || 0.02,
      });

      worker.onmessage = (event) => {
        const data = event.data;
        if (!data) {
          console.warn(`⚠️ WASM Worker returned no data for ${ticker}`);
        } else {
          results.push(data);
        }

        worker.terminate();
        activeWorkers--;
        checkCompletion();
        startNextWorker();
      };

      worker.onerror = (error) => {
        console.error(`❌ WASM Worker error for ${ticker}:`, error);
        worker.terminate();
        activeWorkers--;
        checkCompletion();
        startNextWorker();
      };

      currentWorkerIndex++;
    }

    function checkCompletion() {
      completedWorkers++;
      if (completedWorkers === uniqueTickers.length) {
        const endTime = performance.now();
        document.getElementById(
          "execution-time"
        ).innerText = `Execution Time: ${(endTime - startTime).toFixed(2)} ms`;
        document.getElementById(
          "total-operations"
        ).innerText = `Total Operations: ${totalOps.toLocaleString()}`;

        console.log(
          `✅ All workers completed. Processed ${results.length} tickers. Total ops: ${totalOps}`
        );
        resolve(results);
      }
    }

    for (let i = 0; i < MAX_CONCURRENT_WORKERS; i++) {
      startNextWorker();
    }
  });
}
