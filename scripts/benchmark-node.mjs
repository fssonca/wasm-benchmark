// Headless single-thread kernel benchmark: JS worker kernel vs Rust/WASM.
//
// Runs the exact worker source (src/js/monteCarlo/monteCarloWorker.js) under a
// minimal `self` shim, and the committed web-target WASM artifacts via
// `initSync`, so what is measured is what the browser executes — minus worker
// orchestration, which the in-browser app measures separately.
//
// Usage: node scripts/benchmark-node.mjs [--simulations 200000] [--days 252] [--runs 7]

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parseArgs } from "node:util";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

const { values: args } = parseArgs({
  options: {
    simulations: { type: "string", default: "200000" },
    days: { type: "string", default: "252" },
    runs: { type: "string", default: "7" },
    warmup: { type: "string", default: "2" },
  },
});

const SIMULATIONS = Number(args.simulations);
const DAYS = Number(args.days);
const RUNS = Number(args.runs);
const WARMUP = Number(args.warmup);
const OPS_PER_RUN = SIMULATIONS * DAYS;

const params = {
  ticker: "BENCH",
  initialPrice: 100,
  daysInCSV: DAYS,
  simulations: SIMULATIONS,
  drift: 0.0004,
  volatility: 0.02,
  seed: 123456789,
};

// --- JS kernel: run the real worker file under a `self` shim -----------------
let workerReply = null;
globalThis.self = {
  onmessage: null,
  postMessage: (message) => {
    workerReply = message;
  },
};
await import(
  pathToFileURL(path.join(root, "src/js/monteCarlo/monteCarloWorker.js"))
);

function runJs() {
  workerReply = null;
  globalThis.self.onmessage({ data: params });
  return workerReply;
}

// --- WASM kernel: committed web-target artifacts via initSync ----------------
const wasm = await import(
  pathToFileURL(path.join(root, "public/wasm/monte_carlo.js"))
);
wasm.initSync({
  module: readFileSync(path.join(root, "public/wasm/monte_carlo_bg.wasm")),
});

function runWasm() {
  return wasm.monte_carlo_simulation_array_seeded_gaussian(
    params.ticker,
    params.initialPrice,
    params.simulations,
    params.daysInCSV,
    params.drift,
    params.volatility,
    BigInt(params.seed)
  );
}

// --- Correctness: identical seeds must produce near-identical statistics -----
const jsResult = runJs();
const wasmResult = runWasm();
const meanDelta =
  Math.abs(jsResult.mean - wasmResult.mean) / Math.abs(jsResult.mean);
if (meanDelta > 1e-3) {
  console.error(
    `Kernel mismatch: js mean=${jsResult.mean} wasm mean=${wasmResult.mean}`
  );
  process.exit(1);
}
console.log(
  `Cross-check OK — same seed, js mean=${jsResult.mean.toFixed(4)}, ` +
    `wasm mean=${wasmResult.mean.toFixed(4)} (rel. delta ${meanDelta.toExponential(2)})`
);

// --- Timing -------------------------------------------------------------------
function bench(label, fn) {
  for (let i = 0; i < WARMUP; i++) fn();
  const samples = [];
  for (let i = 0; i < RUNS; i++) {
    const start = performance.now();
    fn();
    samples.push(performance.now() - start);
  }
  samples.sort((a, b) => a - b);
  const median = samples[Math.floor(samples.length / 2)];
  const mean = samples.reduce((a, b) => a + b, 0) / samples.length;
  return { label, median, mean, min: samples[0], max: samples[samples.length - 1] };
}

console.log(
  `\nWorkload: ${SIMULATIONS.toLocaleString()} paths x ${DAYS} days = ` +
    `${OPS_PER_RUN.toLocaleString()} steps/run, ${WARMUP} warmup + ${RUNS} timed runs\n`
);

const results = [bench("JavaScript (V8)", runJs), bench("Rust/WASM", runWasm)];
const baseline = results[0].median;

console.log(
  "| Implementation   | Median (ms) | Mean (ms) | Min (ms) | Msteps/s | Relative |"
);
console.log(
  "|------------------|------------:|----------:|---------:|---------:|---------:|"
);
for (const r of results) {
  console.log(
    `| ${r.label.padEnd(16)} | ${r.median.toFixed(1).padStart(11)} | ${r.mean
      .toFixed(1)
      .padStart(9)} | ${r.min.toFixed(1).padStart(8)} | ${(
      OPS_PER_RUN /
      r.median /
      1000
    ).toFixed(1).padStart(8)} | ${(baseline / r.median).toFixed(2).padStart(7)}x |`
  );
}
