self.onmessage = function (event) {
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
      throw new Error("Missing simulation inputs in worker");
    }

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
          const next = spare;
          spare = null;
          return next;
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

    function monteCarloSimulations(
      initialPrice,
      daysInCSV,
      simulations,
      drift,
      volatility,
      seed
    ) {
      let sum = 0;
      let sumSquared = 0;
      const adjustedDrift = drift - 0.5 * volatility * volatility;
      const uniformSource =
        seed === null || seed === undefined
          ? Math.random
          : createXorshift32(seed);
      const nextNormal = createNormalSampler(uniformSource);

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

      return { ticker, mean, variance, engine: "js-worker" };
    }

    const result = monteCarloSimulations(
      initialPrice,
      daysInCSV,
      simulations,
      drift,
      volatility,
      seed
    );
    self.postMessage(result);
  } catch (error) {
    console.error(`❌ Worker failed: ${error.message}`);
    self.postMessage(null);
  }
};
