const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const fsp = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");

const {
  calculateBenchmarkTargets,
  generateStockData,
  normalizeBenchmarkSize,
} = require("../generateStockData");
const { parseSizeParam } = require("../server");

test("normalizeBenchmarkSize clamps and defaults invalid inputs", () => {
  assert.equal(normalizeBenchmarkSize(undefined), 1);
  assert.equal(normalizeBenchmarkSize("abc"), 1);
  assert.equal(normalizeBenchmarkSize(0), 1);
  assert.equal(normalizeBenchmarkSize(51), 50);
  assert.equal(normalizeBenchmarkSize(3.9), 3);
});

test("parseSizeParam uses consistent clamp logic", () => {
  assert.equal(parseSizeParam("10"), 10);
  assert.equal(parseSizeParam("-100"), 1);
  assert.equal(parseSizeParam("999"), 50);
  assert.equal(parseSizeParam("abc"), 1);
});

test("calculateBenchmarkTargets computes deterministic row/day/op targets", () => {
  const sizeOne = calculateBenchmarkTargets(1);
  assert.equal(sizeOne.finalDays, 250);
  assert.equal(sizeOne.finalRows, 25_000);
  assert.equal(sizeOne.finalOps, 250_000_000);

  const sizeFive = calculateBenchmarkTargets(5);
  assert.equal(sizeFive.finalDays, 1_250);
  assert.equal(sizeFive.finalRows, 125_000);
  assert.equal(sizeFive.finalOps, 1_250_000_000);
});

test("generateStockData creates valid CSV output and metadata", async () => {
  const tempDir = await fsp.mkdtemp(
    path.join(os.tmpdir(), "wasm-benchmark-generate-test-")
  );
  const csvPath = path.join(tempDir, "stock_data.csv");

  try {
    const result = await generateStockData(csvPath, 1, {
      logger: { log: () => {}, error: () => {} },
    });

    assert.deepEqual(result, {
      finalDays: 250,
      finalRows: 25_000,
      finalOps: 250_000_000,
    });

    assert.equal(fs.existsSync(csvPath), true);
    const contents = await fsp.readFile(csvPath, "utf8");
    const lines = contents.trim().split("\n");

    assert.equal(
      lines[0],
      "date,ticker,open_price,close_price,high_price,low_price,volume,market_cap"
    );
    assert.equal(lines.length, result.finalRows + 1);

    const sampleColumns = lines[1].split(",");
    assert.equal(sampleColumns.length, 8);
    assert.match(sampleColumns[0], /^\d{4}-\d{2}-\d{2}$/);
    assert.match(sampleColumns[1], /^STK\d{3}$/);
  } finally {
    await fsp.rm(tempDir, { recursive: true, force: true });
  }
});
