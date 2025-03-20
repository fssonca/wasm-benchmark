import { loadCSV } from "./js/loadCSV.js";
import { calculateHistoricalStats } from "./js/historicalStats.js";
import { processWithWorkers } from "./js/monteCarloWorkers.js";
import { compareMonteCarloVsHistory } from "./js/comparison.js";
import { processWithWasmWorkers } from "./wasm/wasmWorkers.js";

const simulations = 10000;

async function startProcessingWithJS() {
  const filePath = "data/stock_data.csv";
  document.getElementById("execution-type").innerText = "JS Multithread";
  document.getElementById("execution-time").innerText = "Processing...";

  const stockData = await loadCSV(filePath);
  // Historical stats might still use the full CSV
  const { drift, volatility } = calculateHistoricalStats(stockData);

  // IMPORTANT: We no longer pass a fixed `days`.
  const monteCarloResults = await processWithWorkers(
    stockData,
    simulations,
    drift,
    volatility
  );

  compareMonteCarloVsHistory(monteCarloResults, drift);
}

async function startProcessingWithWasm() {
  const filePath = "data/stock_data.csv";
  document.getElementById("execution-type").innerText = "WebAssembly (Rust)";
  document.getElementById("execution-time").innerText = "Processing...";

  const stockData = await loadCSV(filePath);
  const { drift, volatility } = calculateHistoricalStats(stockData);

  // If you also want WASM to scale with CSV size, do the same approach
  const monteCarloResults = await processWithWasmWorkers(
    stockData,
    simulations,
    drift,
    volatility
  );

  compareMonteCarloVsHistory(monteCarloResults, drift);
}

window.startProcessingWithJS = startProcessingWithJS;
window.startProcessingWithWasm = startProcessingWithWasm;
