self.onmessage = function (event) {
  try {
    const { tickerData, simulations, drift, volatility } = event.data;

    if (!tickerData || tickerData.length === 0) {
      throw new Error(`No ticker data provided in worker`);
    }
    const ticker = tickerData[0].ticker || "UNKNOWN";

    function monteCarloSimulations(tickerData, simulations, drift, volatility) {
      let finalPrices = [];
      let sum = 0;
      let sumSquared = 0;

      // We'll start each simulation at the first row's close_price
      const initialPrice = tickerData[0].close_price;
      const daysInCSV = tickerData.length; // number of historical days

      for (let i = 0; i < simulations; i++) {
        let price = initialPrice;

        // For each "day" in the CSV, we do a random daily step
        for (let d = 1; d < daysInCSV; d++) {
          const randomShock = (Math.random() * 2 - 1) * volatility;
          price *= Math.exp(drift + randomShock);
        }

        finalPrices.push(price);
        sum += price;
        sumSquared += price * price;
      }

      const mean = sum / simulations;
      const variance = sumSquared / simulations - mean * mean;

      return { ticker, mean, variance };
    }

    const result = monteCarloSimulations(
      tickerData,
      simulations,
      drift,
      volatility
    );
    self.postMessage(result);
  } catch (error) {
    console.error(`❌ Worker failed: ${error.message}`);
    self.postMessage(null);
  }
};
