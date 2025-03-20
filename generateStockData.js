const fs = require("fs");
const path = require("path");

// For large benchmarks: 1..50 => up to ~12 billion ops
const FIXED_STOCKS = 100;

// Each increment of "size" => 250 million ops
const OPS_PER_SIZE_UNIT = 250_000_000;

const OPS_PER_ROW = 10000;

// Geometric Brownian motion parameters
const ANNUAL_DRIFT = 0.08; // 8% per year
const ANNUAL_VOL = 0.2; // 20% annual volatility
const TRADING_DAYS_PER_YEAR = 252;
const DAILY_DRIFT = ANNUAL_DRIFT / TRADING_DAYS_PER_YEAR;
const DAILY_VOL = ANNUAL_VOL / Math.sqrt(TRADING_DAYS_PER_YEAR);

/**
 * Generates synthetic stock market data (GBM) and writes to a CSV.
 *
 * @param {string} filePath - Output path for CSV, e.g. "./data/stock_data.csv"
 * @param {number} size - integer in [1..50], each increment => ~239.6e6 ops
 * @returns {Promise<{ finalRows: number, finalOps: number, finalDays: number }>}
 */
async function generateStockData(filePath, size) {
  // Ensure size is 1..50
  if (size < 1) size = 1;
  if (size > 50) size = 50;

  // 1) Total desired ops
  const desiredOps = size * OPS_PER_SIZE_UNIT;

  // 2) Convert desired ops -> desired rows
  let desiredRows = Math.floor(desiredOps / OPS_PER_ROW);

  if (desiredRows < 1) desiredRows = 1;

  // 3) finalDays = desiredRows / 100 (we have FIXED_STOCKS=100)
  let finalDays = Math.floor(desiredRows / FIXED_STOCKS);
  if (finalDays < 1) finalDays = 1;

  // 4) final row count & approximate ops
  const finalRows = finalDays * FIXED_STOCKS;
  const finalOps = finalRows * OPS_PER_ROW;

  // OPTIONAL: clamp finalDays if you don't want extremely large day counts
  // const MAX_DAYS = 1260; // e.g., 5 years
  // if (finalDays > MAX_DAYS) finalDays = MAX_DAYS;

  // Prepare CSV header
  const header =
    [
      "date",
      "ticker",
      "open_price",
      "close_price",
      "high_price",
      "low_price",
      "volume",
      "market_cap",
    ].join(",") + "\n";

  const dir = path.dirname(filePath);

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(filePath, header); // the filePath might not exist. For example: "data/file.csv". Create it regardless.

  // Start date
  const startDate = new Date(2019, 0, 1);

  // Build tickers, e.g. STK000..STK099
  const tickers = [];
  for (let i = 0; i < FIXED_STOCKS; i++) {
    tickers.push(`STK${String(i).padStart(3, "0")}`);
  }

  // We'll buffer lines before writing
  const lines = [];
  const CHUNK_SIZE = 10_000;

  // Box–Muller transform for random Normal(0,1)
  function randStdNormal() {
    const u1 = Math.random();
    const u2 = Math.random();
    const z = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
    return z;
  }

  // Random integer helper
  function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  // Generate data via geometric Brownian motion
  for (const ticker of tickers) {
    let price = 100; // initial price
    const prices = [];

    for (let d = 0; d < finalDays; d++) {
      const z = randStdNormal();
      // daily step
      price *= Math.exp(DAILY_DRIFT + DAILY_VOL * z);
      prices.push(price);
    }

    // Build CSV rows for each day
    for (let d = 0; d < finalDays; d++) {
      const currentDate = new Date(startDate);
      currentDate.setDate(startDate.getDate() + d);

      const closePrice = prices[d];
      const openPrice = closePrice + (Math.random() * 2 - 1);
      const highPrice = closePrice + Math.random() * 2;
      const lowPrice = closePrice - Math.random() * 2;
      const volume = randomInt(10_000, 500_000);
      const marketCap = closePrice * volume * 1000;

      const yyyy = currentDate.getFullYear();
      const mm = String(currentDate.getMonth() + 1).padStart(2, "0");
      const dd = String(currentDate.getDate()).padStart(2, "0");
      const dateString = `${yyyy}-${mm}-${dd}`;

      const line = [
        dateString,
        ticker,
        openPrice.toFixed(2),
        closePrice.toFixed(2),
        highPrice.toFixed(2),
        lowPrice.toFixed(2),
        volume,
        Math.round(marketCap),
      ].join(",");

      lines.push(line + "\n");

      if (lines.length >= CHUNK_SIZE) {
        fs.appendFileSync(filePath, lines.join(""));
        lines.length = 0;
      }
    }
  }

  // Flush leftover lines
  if (lines.length > 0) {
    fs.appendFileSync(filePath, lines.join(""));
  }

  // Log file size
  const stats = fs.statSync(filePath);
  const fileSizeMB = (stats.size / (1024 * 1024)).toFixed(2);

  console.log(`Generated CSV => ${filePath}`);
  console.log(` - finalDays = ${finalDays}`);
  console.log(` - finalRows = ${finalRows}`);
  console.log(` - approximate ops = ${finalOps.toLocaleString()}`);
  console.log(` - file size ~ ${fileSizeMB} MB`);

  return { finalRows, finalOps, finalDays };
}

module.exports = {
  generateStockData,
};
