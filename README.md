# Monte Carlo Stock Forecast with WASM and JS

This project demonstrates a **Monte Carlo simulation** for stock price forecasting, implemented both in **pure JavaScript** (Web Workers) and **WebAssembly (Rust)**. It’s designed to serve as a **benchmark** for CPU-intensive tasks in the browser.

## Why Monte Carlo is a Great Benchmark

- **CPU-Intensive**: Monte Carlo simulations require a large number of repetitive calculations – perfect for testing raw computational performance.  
- **Parallelizable**: Running multiple workers (or threads in WASM) can showcase concurrency and performance in the browser.  
- **Realistic**: Many financial and scientific scenarios use Monte Carlo methods to estimate outcomes under uncertainty, making this a representative test of heavy numeric workloads in JavaScript or WebAssembly.

## Overview

1. **Server (Node + Express)**  
   - Serves static files from `public/`.
   - Offers an endpoint `/generateData?size=X` to generate a large synthetic CSV file (`data/stock_data.csv`) for simulation.
   - Uses `generateStockData.js` for creating random stock market data via a geometric Brownian motion model.

2. **Client (HTML + JS + WASM)**  
   - **`selector.html`**: Lets you pick a “size” (1..50). Each size translates to a target number of operations (e.g., 1 => 250 million ops).  
   - After generating the CSV, the user is redirected to the main **`index.html`**.  
   - **`index.html`**: Presents two buttons:
     - **Run Monte Carlo (JavaScript)**  
       Uses multiple **JS Web Workers** (`monteCarloWorker.js`) to process the CSV.  
     - **Run Monte Carlo (WASM)**  
       Spawns **WebAssembly workers** for the same calculations.  
   - Both approaches parse and process the same CSV data, each performing heavy computations.  

3. **Monte Carlo Method**  
   - Monte Carlo simulations repeatedly sample from random processes to model the uncertainty in stock prices over time.  
   - Here, it’s used to forecast final stock prices after `N` days, given a drift (mean return) and volatility.  
   - In practice, it's computationally **expensive** to run thousands of simulations on thousands of rows, making it an excellent **benchmark** for testing performance in JavaScript vs. WebAssembly.

## Requirements

- **Node.js** (v14+ recommended)
- **npm** or **yarn**

## Installation

1. Clone this repository:
   ```bash
   git clone https://github.com/your-org/monte-carlo-wasm.git
   cd monte-carlo-wasm
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
   or
   ```bash
   yarn install
   ```

## Usage

1. **Start the server**:
   ```bash
   npm start
   ```
   This launches an Express server on `http://localhost:3000`.

2. **Open your browser** at [http://localhost:3000](http://localhost:3000).

3. **Redirection to Selector**:  
   - On first visit, you’ll be redirected to **`/selector.html`**.  
   - Choose a *size* from **1..50**, then click “Generate CSV.”  
   - The server will create a large CSV file (`data/stock_data.csv`) with synthetic stock data.  
   - After generation, you’ll be redirected to the **homepage** (`index.html`).

4. **Run a Monte Carlo Simulation**:  
   - On **index.html**, click the “Run Monte Carlo (JavaScript)” or “Run Monte Carlo (WASM)” buttons to start the simulation.  
   - The program spawns multiple workers, processes the CSV row by row, and calculates final prices using a random log-return model.  
   - Results (mean price, variance) will appear in the “Simulation Results” table, along with the approximate execution time and total operations count.

----

Thanks!
https://www.linkedin.com/in/fssonca/
