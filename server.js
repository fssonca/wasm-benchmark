// server.js
const express = require("express");
const path = require("path");
const fs = require("fs");

const { generateStockData, normalizeBenchmarkSize } = require("./generateStockData");

const DEFAULT_PORT = Number(process.env.PORT) || 3000;
const DEBUG_BENCHMARK = process.env.DEBUG_BENCHMARK === "1";

function parseSizeParam(sizeParam) {
  return normalizeBenchmarkSize(Number.parseInt(sizeParam, 10));
}

function createApp(options = {}) {
  const app = express();
  const logger = options.logger || console;
  const debug = options.debug ?? DEBUG_BENCHMARK;

  if (debug) {
    app.use((req, res, next) => {
      const start = Date.now();
      res.on("finish", () => {
        logger.log(
          `[request] ${req.method} ${req.originalUrl} -> ${res.statusCode} (${Date.now() - start}ms)`
        );
      });
      next();
    });
  }

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
      const requestedSize = req.query.size;
      const size = parseSizeParam(requestedSize);

      if (debug) {
        logger.log(
          `[generateData] requested size=${String(requestedSize)} normalized size=${size}`
        );
      }

      // We'll generate (or overwrite) "stock_data.csv"
      const outputPath = path.join(__dirname, "data", "stock_data.csv");
      const generationStart = Date.now();

      // Always call generateStockData so that the file is created
      const { finalRows, finalOps, finalDays } = await generateStockData(
        outputPath,
        size,
        { debug, logger }
      );

      // Double-check the file is there after generation
      if (!fs.existsSync(outputPath)) {
        return res.status(500).json({
          success: false,
          error:
            "Failed to create stock_data.csv. File not found after generation.",
        });
      }

      if (debug) {
        logger.log(
          `[generateData] completed in ${Date.now() - generationStart}ms for size=${size}`
        );
      }

      return res.json({
        success: true,
        message: `Stock data generated for size=${size}`,
        rowsCreated: finalRows,
        daysCreated: finalDays,
        approximateOps: finalOps,
      });
    } catch (error) {
      logger.error(error);
      return res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  });

  return app;
}

function startServer(port = DEFAULT_PORT, options = {}) {
  const app = createApp(options);
  const logger = options.logger || console;
  return app.listen(port, () => {
    logger.log(`🚀 Server running at: http://localhost:${port}`);
  });
}

if (require.main === module) {
  startServer();
}

module.exports = {
  createApp,
  DEFAULT_PORT,
  parseSizeParam,
  startServer,
};
