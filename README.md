# Monte Carlo Stock Forecast — Rust/WASM vs JavaScript

A browser benchmark that runs the same seeded Monte Carlo stock-price simulation (geometric Brownian motion) in **pure JavaScript Web Workers** and in **Rust compiled to WebAssembly**, on identical inputs, and compares the results and the run time.

Both engines implement the same deterministic kernel — xorshift32 uniform RNG + Box-Muller gaussian sampling — so with the same seed they produce **bit-identical statistics**, which makes the timing comparison meaningful: same math, same numbers, different runtime.

## Results

Single-thread kernel, measured with the reproducible harness in [`scripts/benchmark-node.mjs`](scripts/benchmark-node.mjs):

| Implementation  | Median (ms) | Mean (ms) | Msteps/s | Relative |
| --------------- | ----------: | --------: | -------: | -------: |
| JavaScript (V8) |      1262.0 |    1278.4 |     39.9 |    1.00× |
| Rust/WASM       |       608.1 |     610.6 |     82.9 |    2.08× |

**Workload:** 200,000 simulated price paths × 252 trading days = 50.4M simulation steps per run.
**Environment:** Apple M4, Node.js 24 (V8), `wasm-pack --release` with LTO, `opt-level = 3`.
**Protocol:** 2 warm-up runs, 7 timed runs, median reported. The harness first verifies that both kernels return the same mean/variance for the same seed (relative delta 0.0 in this run) and aborts if they diverge.

Reproduce it:

```bash
npm run build:wasm   # requires Rust + wasm-pack
node scripts/benchmark-node.mjs
node scripts/benchmark-node.mjs --simulations 500000 --days 252 --runs 10
```

The harness executes the *actual* worker source (`src/js/monteCarlo/monteCarloWorker.js`) under a minimal `self` shim and the *committed* web-target WASM artifacts via `initSync` — what is measured is what the browser executes. The in-browser app additionally measures the multi-worker orchestration path (up to 10 concurrent workers of each kind).

## Why Monte Carlo as a benchmark

- **CPU-bound:** millions of RNG draws, `log`/`exp`/`sqrt`/`sin`/`cos` calls, and floating-point accumulation — no I/O to hide behind.
- **Parallelizable:** each ticker simulates independently, so both engines run in a pool of up to 10 workers.
- **Realistic:** GBM Monte Carlo is how real risk/pricing systems estimate outcome distributions.

## How it works

```text
selector.html      → choose a workload size (1–50 ⇒ up to billions of steps)
   │  GET /generateData?size=N
server.js          → generates data/stock_data.csv (synthetic GBM market data)
   │
index.html         → loads the CSV, computes per-ticker drift/volatility
   ├── "Run Monte Carlo (JavaScript)" → pool of classic Web Workers
   │        js/monteCarlo/monteCarloWorker.js   (xorshift32 + Box-Muller in JS)
   └── "Run Monte Carlo (WASM)"       → pool of module Web Workers
            wasm/wasmWorker.js → monte_carlo_bg.wasm (same kernel in Rust)
```

- **Deterministic mode** seeds every ticker with `FNV-1a(ticker) ⊕ seedBase ⊕ index`, so JS and WASM runs are directly comparable and re-runnable.
- Per-run timing separates **data load**, **simulation**, and **total**, so worker startup and WASM instantiation costs are visible rather than hidden in one number.

## Run the app

```bash
npm install
npm start          # http://localhost:3000
```

Pick a size on the selector page (size 1 ≈ 250M steps), then run each engine on the same generated dataset.

Rebuild the WASM module after editing the Rust source:

```bash
npm run build:wasm   # wasm-pack build src/wasm --release --target web
```

## Tests

```bash
npm test             # node:test — CSV generation, stats, clamp/seed logic
```

## Project layout

```text
server.js                        Express server + synthetic CSV generation
public/                          Static app (selector, comparison UI, charts)
public/wasm/                     Committed wasm-pack build artifacts
src/js/monteCarlo/               JS worker kernel
src/wasm/monte_carlo.rs          Rust kernel (same RNG + Box-Muller)
scripts/benchmark-node.mjs       Reproducible headless benchmark harness
tests/                           node:test suites
```

## Limitations

- The headless harness measures the single-thread kernel; browser numbers additionally include worker orchestration and message passing.
- `Msteps/s` counts simulation steps (one day of one path), not FLOPs.
- Results vary by machine and engine version — run the harness yourself; the protocol is in the script.
