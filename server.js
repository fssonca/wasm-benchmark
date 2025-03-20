// server.js
const express = require("express");
const path = require("path");
const fs = require("fs");

const { generateStockData } = require("./generateStockData");

const app = express();
const PORT = 3000;

// Serve the public directory
app.use(
  express.static(path.join(__dirname, "public"), {
    setHeaders: (res, filePath) => {
      if (filePath.endsWith(".wasm")) {
        res.setHeader("Content-Type", "application/wasm");
      }
    },
  })
);

// Serve the data folder
app.use("/data", express.static(path.join(__dirname, "data")));

// Serve the js and wasm folders
app.use("/js", express.static(path.join(__dirname, "src/js")));
app.use("/wasm", express.static(path.join(__dirname, "src/wasm")));

// API endpoint to serve the CSV explicitly
app.get("/stock_data.csv", (req, res) => {
  res.sendFile(path.join(__dirname, "data", "stock_data.csv"));
});

/**
 * Endpoint to generate synthetic data for Monte Carlo benchmark,
 * with a fixed 100 stocks. "size" in [1..50].
 *
 * GET /generateData?size=5 => ~500 million ops
 */
app.get("/generateData", async (req, res) => {
  try {
    // 1) Parse and clamp the 'size' param
    let size = parseInt(req.query.size, 10);
    if (isNaN(size)) size = 1;
    if (size < 1) size = 1;
    if (size > 50) size = 50;

    // 2) We'll generate (or overwrite) "stock_data.csv"
    const outputPath = path.join(__dirname, "data", "stock_data.csv");

    // 3) Always call generateStockData so that the file is created
    const { finalRows, finalOps, finalDays } = await generateStockData(
      outputPath,
      size
    );

    // 4) Double-check the file is there after generation
    if (!fs.existsSync(outputPath)) {
      // If it's missing, something went wrong in the generation step
      return res.status(500).json({
        success: false,
        error:
          "Failed to create stock_data.csv. File not found after generation.",
      });
    }

    // 5) Otherwise, return success with info
    return res.json({
      success: true,
      message: `Stock data generated for size=${size}`,
      rowsCreated: finalRows,
      daysCreated: finalDays,
      approximateOps: finalOps,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Start the server
app.listen(PORT, () => {
  console.log(`🚀 Server running at: http://localhost:${PORT}`);
});
