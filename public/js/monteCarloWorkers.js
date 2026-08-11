import { buildTickerSeed } from "./seedUtils.js";

export function processWithWorkers({
  tickerInputs,
  simulations,
  drift,
  volatility,
  deterministicMode,
  seedBase,
}) {
  return new Promise((resolve) => {
    const results = [];
    let completedWorkers = 0;
    const simulateStart = performance.now();

    if (!Array.isArray(tickerInputs) || tickerInputs.length === 0) {
      console.error("❌ No valid tickers found!");
      resolve({
        results: [],
        totalOperations: 0,
        timing: { simulateMs: 0 },
      });
      return;
    }

    const totalOperations = tickerInputs.reduce(
      (total, item) => total + item.daysInCSV * simulations,
      0
    );

    const MAX_CONCURRENT_WORKERS = 10;
    let currentWorkerIndex = 0;
    let activeWorkers = 0;

    function startNextWorker() {
      if (currentWorkerIndex >= tickerInputs.length) return;
      if (activeWorkers >= MAX_CONCURRENT_WORKERS) return;

      const tickerIndex = currentWorkerIndex;
      const item = tickerInputs[tickerIndex];
      const { ticker, initialPrice, daysInCSV } = item;
      const worker = new Worker("js/monteCarlo/monteCarloWorker.js");
      activeWorkers++;

      worker.postMessage({
        ticker,
        initialPrice,
        daysInCSV,
        simulations,
        drift: drift[ticker] || 0,
        volatility: volatility[ticker] || 0.02,
        seed: deterministicMode
          ? buildTickerSeed(seedBase, ticker, tickerIndex)
          : null,
      });

      worker.onmessage = function (event) {
        const data = event.data;
        if (data && data.ticker) {
          results.push(data);
        } else {
          console.warn(`⚠️ Worker returned no data for ${ticker}`);
        }

        worker.terminate();
        activeWorkers--;
        completedWorkers++;

        if (completedWorkers === tickerInputs.length) {
          resolve({
            results,
            totalOperations,
            timing: { simulateMs: performance.now() - simulateStart },
          });
          return;
        }

        startNextWorker();
      };

      worker.onerror = function (error) {
        console.error(`❌ Worker error for ${ticker}:`, error);
        worker.terminate();
        activeWorkers--;
        completedWorkers++;

        if (completedWorkers === tickerInputs.length) {
          resolve({
            results,
            totalOperations,
            timing: { simulateMs: performance.now() - simulateStart },
          });
          return;
        }

        startNextWorker();
      };

      currentWorkerIndex++;
    }

    for (let i = 0; i < MAX_CONCURRENT_WORKERS; i++) {
      startNextWorker();
    }
  });
}
