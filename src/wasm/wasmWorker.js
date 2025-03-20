let wasm = null;

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
    const { tickerData, simulations, drift, volatility } = event.data;
    if (!tickerData || tickerData.length === 0) {
      throw new Error(`No ticker data provided to WASM worker`);
    }

    const ticker = tickerData[0].ticker || "UNKNOWN";
    const initialPrice = tickerData[0].close_price;
    const daysInCSV = tickerData.length;

    // Load WASM
    const wasmModule = await loadWasm();

    // We'll pass the needed data to the WASM function:
    // e.g., a new function 'monte_carlo_simulation_array' that replicates the JS loop
    const result = wasmModule.monte_carlo_simulation_array(
      ticker,
      initialPrice,
      simulations,
      daysInCSV,
      drift,
      volatility
    );

    self.postMessage(result);
  } catch (err) {
    console.error(`❌ WASM Worker failed: ${err.message}`);
    self.postMessage(null);
  }
};
