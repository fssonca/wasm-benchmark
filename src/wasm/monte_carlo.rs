use wasm_bindgen::prelude::*;
use wasm_bindgen::JsValue;
use serde::{Serialize, Deserialize};
use serde_wasm_bindgen::to_value;
use web_sys::console;

#[derive(Serialize, Deserialize)]
struct MonteCarloResult {
    ticker: String,
    mean: f64,
    variance: f64,
}

#[wasm_bindgen]
pub fn monte_carlo_simulation_array(
    ticker: String,
    initial_price: f64,
    simulations: usize,
    days_in_csv: usize,
    drift: f64,
    volatility: f64
) -> JsValue {
    console::log_1(
        &format!(
            "🔍 WASM Monte Carlo for {ticker}: {simulations} sims, {days_in_csv} days"
        ).into()
    );

    let mut sum = 0.0;
    let mut sum_squared = 0.0;

    for _ in 0..simulations {
        let mut price = initial_price;

        // replicate the daily loop:
        // "For each day in the CSV, do random daily step"
        for _day in 1..days_in_csv {
            let random_shock = (js_sys::Math::random() * 2.0 - 1.0) * volatility;
            price *= (drift + random_shock).exp();
        }

        sum += price;
        sum_squared += price * price;
    }

    let mean = sum / simulations as f64;
    let variance = (sum_squared / simulations as f64) - (mean * mean);

    let result = MonteCarloResult { ticker, mean, variance };

    console::log_1(&format!("✅ Done: mean={mean:.2}, var={variance:.2}").into());
    to_value(&result).unwrap()
}
