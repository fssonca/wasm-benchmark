let wasm = null;
let warnedAboutFallback = false;

async function loadWasm() {
  if (!wasm) {
    wasm = await import("/wasm/monte_carlo.js");
    if (!wasm || !wasm.monte_carlo_simulation_array) {
      throw new Error("WASM function monte_carlo_simulation_array not found!");
    }
    // Initialize wasm_bindgen if needed
    if (wasm.default) {
      await wasm.default();
    }
  }
  return wasm;
}

self.onmessage = async function (event) {
  try {
    const {
      ticker,
      initialPrice,
      daysInCSV,
      simulations,
      drift,
      volatility,
      seed,
    } = event.data;

    if (!ticker || !Number.isFinite(initialPrice) || !Number.isFinite(daysInCSV)) {
      throw new Error("Missing simulation inputs in WASM worker");
    }

    // Load WASM
    const wasmModule = await loadWasm();

    let result;
    if (typeof wasmModule.monte_carlo_simulation_array_seeded_gaussian === "function") {
      // Forward-compatible path for rebuilt WASM modules.
      result = wasmModule.monte_carlo_simulation_array_seeded_gaussian(
        ticker,
        initialPrice,
        simulations,
        daysInCSV,
        drift,
        volatility,
        seed === null || seed === undefined ? -1 : seed
      );
      result.engine = "wasm-seeded-gaussian";
    } else {
      // Current checked-in wasm bundle does not expose the upgraded API.
      // Keep simulation mathematically correct using a deterministic JS fallback.
      if (!warnedAboutFallback) {
        warnedAboutFallback = true;
        console.warn(
          "⚠️ Using JS fallback in WASM worker. Rebuild /wasm bundle to enable native seeded Gaussian Monte Carlo."
        );
      }
      result = monteCarloSimulationsJs(
        ticker,
        initialPrice,
        simulations,
        daysInCSV,
        drift,
        volatility,
        seed
      );
      result.engine = "wasm-worker-js-fallback";
    }

    self.postMessage(result);
  } catch (err) {
    console.error(`❌ WASM Worker failed: ${err.message}`);
    self.postMessage(null);
  }
};

function createXorshift32(seedValue) {
  let state = (seedValue >>> 0) || 0x6d2b79f5;
  return function nextUniform() {
    state ^= state << 13;
    state >>>= 0;
    state ^= state >>> 17;
    state >>>= 0;
    state ^= state << 5;
    state >>>= 0;
    return state / 4294967296;
  };
}

function createNormalSampler(uniformSource) {
  let spare = null;
  return function nextNormal() {
    if (spare !== null) {
      const value = spare;
      spare = null;
      return value;
    }

    let u1 = uniformSource();
    let u2 = uniformSource();
    if (u1 <= Number.EPSILON) u1 = Number.EPSILON;
    if (u2 <= Number.EPSILON) u2 = Number.EPSILON;

    const radius = Math.sqrt(-2 * Math.log(u1));
    const theta = 2 * Math.PI * u2;
    spare = radius * Math.sin(theta);
    return radius * Math.cos(theta);
  };
}

function monteCarloSimulationsJs(
  ticker,
  initialPrice,
  simulations,
  daysInCSV,
  drift,
  volatility,
  seed
) {
  const adjustedDrift = drift - 0.5 * volatility * volatility;
  const uniformSource =
    seed === null || seed === undefined ? Math.random : createXorshift32(seed);
  const nextNormal = createNormalSampler(uniformSource);
  let sum = 0;
  let sumSquared = 0;

  for (let i = 0; i < simulations; i++) {
    let price = initialPrice;
    for (let d = 1; d < daysInCSV; d++) {
      const shock = volatility * nextNormal();
      price *= Math.exp(adjustedDrift + shock);
    }
    sum += price;
    sumSquared += price * price;
  }

  const mean = sum / simulations;
  const variance = sumSquared / simulations - mean * mean;
  return { ticker, mean, variance };
}
