const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

function loadBrowserModuleAsEsm(absolutePath) {
  const source = fs.readFileSync(absolutePath, "utf8");
  const encoded = Buffer.from(source, "utf8").toString("base64");
  return import(`data:text/javascript;base64,${encoded}`);
}

test("groupStockDataByTicker and calculateHistoricalStats produce stable inputs", async () => {
  const { groupStockDataByTicker, calculateHistoricalStats } =
    await loadBrowserModuleAsEsm(
      path.join(__dirname, "..", "public", "js", "historicalStats.js")
    );

  const stockData = [
    { ticker: "AAA", close_price: 100 },
    { ticker: "AAA", close_price: 110 },
    { ticker: "AAA", close_price: 121 },
    { ticker: "BBB", close_price: 50 },
    { ticker: "BBB", close_price: 45 },
    { ticker: "BBB", close_price: 47.25 },
    { ticker: "CCC", close_price: 0 }, // filtered invalid
  ];

  const grouped = groupStockDataByTicker(stockData);
  const aaa = grouped.find((entry) => entry.ticker === "AAA");
  const bbb = grouped.find((entry) => entry.ticker === "BBB");

  assert.deepEqual(aaa.closePrices, [100, 110, 121]);
  assert.deepEqual(bbb.closePrices, [50, 45, 47.25]);

  const { drift, volatility, realizedGrowthPct, tickerInputs } =
    calculateHistoricalStats(grouped);

  assert.ok(Number.isFinite(drift.AAA));
  assert.ok(Number.isFinite(volatility.AAA));
  assert.equal(realizedGrowthPct.AAA.toFixed(2), "21.00");
  assert.equal(realizedGrowthPct.BBB.toFixed(2), "-5.50");

  const aaaInput = tickerInputs.find((entry) => entry.ticker === "AAA");
  assert.equal(aaaInput.initialPrice, 121);
  assert.equal(aaaInput.daysInCSV, 3);
});

test("seed helpers are deterministic and stable", async () => {
  const { buildTickerSeed, hashStringFNV1a32, normalizeSeed } =
    await loadBrowserModuleAsEsm(
      path.join(__dirname, "..", "public", "js", "seedUtils.js")
    );

  assert.equal(normalizeSeed("123"), 123);
  assert.equal(normalizeSeed("abc", 777), 777);
  assert.equal(hashStringFNV1a32("AAA"), hashStringFNV1a32("AAA"));

  const s1 = buildTickerSeed(12345, "AAA", 0);
  const s2 = buildTickerSeed(12345, "AAA", 0);
  const s3 = buildTickerSeed(12345, "AAA", 1);
  assert.equal(s1, s2);
  assert.notEqual(s1, s3);
});
