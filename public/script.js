import { loadCSV } from "./js/loadCSV.js";
import {
  calculateHistoricalStats,
  groupStockDataByTicker,
} from "./js/historicalStats.js";
import { processWithWorkers } from "./js/monteCarloWorkers.js";
import { compareMonteCarloVsHistory } from "./js/comparison.js";
import { processWithWasmWorkers } from "./wasm/wasmWorkers.js";
import { normalizeSeed } from "./js/seedUtils.js";

const simulations = 10000;

function readRngOptions() {
  const deterministicToggle = document.getElementById("deterministic-rng");
  const seedInput = document.getElementById("rng-seed");
  const deterministicMode = deterministicToggle ? deterministicToggle.checked : true;
  const seedBase = normalizeSeed(seedInput?.value, 12345);

  return {
    deterministicMode,
    seedBase,
  };
}

function updateExecutionStats(
  executionType,
  timings,
  totalOperations,
  deterministicMode,
  seedBase
) {
  const totalMs = timings.parse + timings.group + timings.simulate + timings.render;

  document.getElementById("execution-type").innerText = executionType;
  document.getElementById(
    "execution-time"
  ).innerText = `Execution Time: ${totalMs.toFixed(2)} ms`;
  document.getElementById(
    "total-operations"
  ).innerText = `Total Operations: ${totalOperations.toLocaleString()}`;

  document.getElementById("execution-breakdown").innerText =
    `Phases (ms) - parse: ${timings.parse.toFixed(2)}, group: ${timings.group.toFixed(
      2
    )}, simulate: ${timings.simulate.toFixed(2)}, render: ${timings.render.toFixed(
      2
    )}. RNG: ${
      deterministicMode ? `seeded (base=${seedBase})` : "non-deterministic"
    }`;
}

async function runBenchmark(executionType, runner) {
  const filePath = "data/stock_data.csv";
  document.getElementById("execution-type").innerText = executionType;
  document.getElementById("execution-time").innerText = "Processing...";
  document.getElementById("execution-breakdown").innerText = "";

  const { deterministicMode, seedBase } = readRngOptions();
  const timings = {
    parse: 0,
    group: 0,
    simulate: 0,
    render: 0,
  };

  const parseStart = performance.now();
  const stockData = await loadCSV(filePath);
  timings.parse = performance.now() - parseStart;

  const groupStart = performance.now();
  const groupedTickerData = groupStockDataByTicker(stockData);
  const { drift, volatility, realizedGrowthPct, tickerInputs } =
    calculateHistoricalStats(groupedTickerData);
  timings.group = performance.now() - groupStart;

  const simulationResult = await runner({
    tickerInputs,
    simulations,
    drift,
    volatility,
    deterministicMode,
    seedBase,
  });
  timings.simulate = simulationResult.timing.simulateMs;

  const renderStart = performance.now();
  compareMonteCarloVsHistory(
    simulationResult.results,
    realizedGrowthPct
  );
  timings.render = performance.now() - renderStart;

  updateExecutionStats(
    executionType,
    timings,
    simulationResult.totalOperations,
    deterministicMode,
    seedBase
  );
}

async function startProcessingWithJS() {
  await runBenchmark("JS Multithread", processWithWorkers);
}

async function startProcessingWithWasm() {
  await runBenchmark("WebAssembly (Rust)", processWithWasmWorkers);
}

window.startProcessingWithJS = startProcessingWithJS;
window.startProcessingWithWasm = startProcessingWithWasm;
