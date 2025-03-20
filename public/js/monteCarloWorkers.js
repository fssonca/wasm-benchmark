export function processWithWorkers(stockData, simulations, drift, volatility) {
  return new Promise((resolve) => {
    const results = [];
    let completedWorkers = 0;
    let totalOperations = 0;
    const startTime = performance.now();

    // All unique tickers
    const uniqueTickers = [...new Set(stockData.map((stock) => stock.ticker))];
    if (uniqueTickers.length === 0) {
      console.error("❌ No valid tickers found!");
      resolve([]);
      return;
    }

    const MAX_CONCURRENT_WORKERS = 10;
    let currentWorkerIndex = 0;
    let activeWorkers = 0;

    function startNextWorker() {
      if (currentWorkerIndex >= uniqueTickers.length) return;

      const ticker = uniqueTickers[currentWorkerIndex];
      // IMPORTANT: gather all rows for this ticker
      const tickerData = stockData.filter((s) => s.ticker === ticker);

      if (!tickerData || tickerData.length === 0) {
        console.warn(`⚠️ No valid rows for ${ticker}`);
        checkCompletion();
        return;
      }

      // We create a worker
      const worker = new Worker("js/monteCarlo/monteCarloWorker.js");
      activeWorkers++;

      // Post the entire tickerData array, plus drift & volatility
      worker.postMessage({
        tickerData,
        simulations,
        drift: drift[ticker] || 0,
        volatility: volatility[ticker] || 0.02,
      });

      worker.onmessage = function (event) {
        const data = event.data;
        if (!data) {
          console.warn(`⚠️ Worker returned no data for ${ticker}`);
        } else {
          results.push(data);

          // IMPORTANT: #ops = #days * #simulations
          totalOperations += tickerData.length * simulations;
        }
        worker.terminate();
        activeWorkers--;
        checkCompletion();
        startNextWorker();
      };

      worker.onerror = function (error) {
        console.error(`❌ Worker error for ${ticker}:`, error);
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
        ).innerText = `Total Operations: ${totalOperations.toLocaleString()}`;

        console.log(
          `✅ All workers completed. Processed ${results.length} tickers. Total operations: ${totalOperations}`
        );
        resolve(results);
      }
    }

    // Kick off up to 10 workers
    for (let i = 0; i < MAX_CONCURRENT_WORKERS; i++) {
      startNextWorker();
    }
  });
}
