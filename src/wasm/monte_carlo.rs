use serde::{Deserialize, Serialize};
use serde_wasm_bindgen::to_value;
use wasm_bindgen::prelude::*;
use wasm_bindgen::JsValue;

#[derive(Serialize, Deserialize)]
struct MonteCarloResult {
    ticker: String,
    mean: f64,
    variance: f64,
}

fn hash_string_fnv1a32(input: &str) -> u32 {
    let mut hash: u32 = 0x811c9dc5;
    for byte in input.bytes() {
        hash ^= byte as u32;
        hash = hash.wrapping_mul(0x01000193);
    }
    hash
}

fn xorshift32_next(state: &mut u32) -> f64 {
    *state ^= *state << 13;
    *state ^= *state >> 17;
    *state ^= *state << 5;
    (*state as f64) / (u32::MAX as f64 + 1.0)
}

fn normal_box_muller(state: &mut u32, spare: &mut Option<f64>) -> f64 {
    if let Some(value) = spare.take() {
        return value;
    }

    let mut u1 = xorshift32_next(state);
    let mut u2 = xorshift32_next(state);
    if u1 <= f64::EPSILON {
        u1 = f64::EPSILON;
    }
    if u2 <= f64::EPSILON {
        u2 = f64::EPSILON;
    }

    let radius = (-2.0 * u1.ln()).sqrt();
    let theta = 2.0 * std::f64::consts::PI * u2;

    *spare = Some(radius * theta.sin());
    radius * theta.cos()
}

#[wasm_bindgen]
pub fn monte_carlo_simulation_array_seeded_gaussian(
    ticker: String,
    initial_price: f64,
    simulations: usize,
    days_in_csv: usize,
    drift: f64,
    volatility: f64,
    seed: i64,
) -> JsValue {
    if simulations == 0 || days_in_csv < 2 || !initial_price.is_finite() {
        let result = MonteCarloResult {
            ticker,
            mean: initial_price,
            variance: 0.0,
        };
        return to_value(&result).unwrap();
    }

    let default_seed = hash_string_fnv1a32(&ticker) ^ 0x6d2b79f5;
    let mut state = if seed >= 0 {
        (seed as u32).max(1)
    } else {
        default_seed.max(1)
    };

    let adjusted_drift = drift - 0.5 * volatility * volatility;
    let mut sum = 0.0;
    let mut sum_squared = 0.0;
    let mut spare: Option<f64> = None;

    for _ in 0..simulations {
        let mut price = initial_price;
        for _ in 1..days_in_csv {
            let z = normal_box_muller(&mut state, &mut spare);
            let shock = volatility * z;
            price *= (adjusted_drift + shock).exp();
        }
        sum += price;
        sum_squared += price * price;
    }

    let mean = sum / simulations as f64;
    let variance = (sum_squared / simulations as f64) - (mean * mean);
    to_value(&MonteCarloResult {
        ticker,
        mean,
        variance,
    })
    .unwrap()
}

#[wasm_bindgen]
pub fn monte_carlo_simulation_array(
    ticker: String,
    initial_price: f64,
    simulations: usize,
    days_in_csv: usize,
    drift: f64,
    volatility: f64,
) -> JsValue {
    monte_carlo_simulation_array_seeded_gaussian(
        ticker,
        initial_price,
        simulations,
        days_in_csv,
        drift,
        volatility,
        -1,
    )
}
