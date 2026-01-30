use pyo3::prelude::*;
use std::f64::consts::{PI, SQRT_2};

// Error function approximation (Abramowitz and Stegun 7.1.26)
// Max error: 1.5e-7
fn erf(x: f64) -> f64 {
    let sign = if x < 0.0 { -1.0 } else { 1.0 };
    let x = x.abs();

    let a1 =  0.254829592;
    let a2 = -0.284496736;
    let a3 =  1.421413741;
    let a4 = -1.453152027;
    let a5 =  1.061405429;
    let p  =  0.3275911;

    let t = 1.0 / (1.0 + p * x);
    let y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * (-x * x).exp();

    sign * y
}

// Helper for Standard Normal CDF
fn norm_cdf(x: f64) -> f64 {
    0.5 * (1.0 + erf(x / SQRT_2))
}

#[pyfunction]
fn calculate_bsm(
    price: f64,
    strike: f64,
    time_to_expiry: f64,
    risk_free_rate: f64,
    volatility: f64,
    option_type: &str,
) -> PyResult<(f64, f64, f64, f64, f64, f64)> {
    // Returns (price, delta, gamma, theta, vega, rho)
    
    // Validations
    if time_to_expiry <= 0.0 || volatility <= 0.0 || price <= 0.0 || strike <= 0.0 {
        return Ok((0.0, 0.0, 0.0, 0.0, 0.0, 0.0));
    }

    let d1 = ((price / strike).ln() + (risk_free_rate + 0.5 * volatility.powi(2)) * time_to_expiry)
        / (volatility * time_to_expiry.sqrt());
    let d2 = d1 - volatility * time_to_expiry.sqrt();

    let nd1 = norm_cdf(d1);
    let nd2 = norm_cdf(d2);
    let n_prime_d1 = (-0.5 * d1.powi(2)).exp() / (2.0 * PI).sqrt();

    let option_price: f64;
    let delta: f64;
    let theta: f64;
    let rho: f64;

    let common_term = - (price * volatility * n_prime_d1) / (2.0 * time_to_expiry.sqrt());

    if option_type == "CE" {
        option_price = price * nd1 - strike * (-risk_free_rate * time_to_expiry).exp() * nd2;
        delta = nd1;
        theta = common_term - risk_free_rate * strike * (-risk_free_rate * time_to_expiry).exp() * nd2;
        rho = strike * time_to_expiry * (-risk_free_rate * time_to_expiry).exp() * nd2;
    } else {
        let n_neg_d1 = norm_cdf(-d1);
        let n_neg_d2 = norm_cdf(-d2);
        
        option_price = strike * (-risk_free_rate * time_to_expiry).exp() * n_neg_d2 - price * n_neg_d1;
        delta = nd1 - 1.0;
        theta = common_term + risk_free_rate * strike * (-risk_free_rate * time_to_expiry).exp() * n_neg_d2;
        rho = -strike * time_to_expiry * (-risk_free_rate * time_to_expiry).exp() * n_neg_d2;
    }

    let gamma = n_prime_d1 / (price * volatility * time_to_expiry.sqrt());
    let vega = price * time_to_expiry.sqrt() * n_prime_d1;

    // Convert theta to daily
    let theta_daily = theta / 365.0;
    // Vega is usually reported for 1% change, so / 100
    let vega_formatted = vega / 100.0;
    // Rho for 1% change
    let rho_formatted = rho / 100.0;

    Ok((option_price, delta, gamma, theta_daily, vega_formatted, rho_formatted))
}

#[pyfunction]
fn calculate_batch_bsm(
    prices: Vec<f64>,
    strikes: Vec<f64>,
    times_to_expiry: Vec<f64>,
    risk_free_rate: f64,
    volatilities: Vec<f64>,
    option_types: Vec<String>,
) -> PyResult<Vec<(f64, f64, f64, f64, f64, f64)>> {
    let mut results = Vec::with_capacity(prices.len());

    for i in 0..prices.len() {
        let res = calculate_bsm(
            prices[i],
            strikes[i],
            times_to_expiry[i],
            risk_free_rate,
            volatilities[i],
            &option_types[i],
        )?;
        results.push(res);
    }

    Ok(results)
}

#[pymodule]
fn bsm_engine(_py: Python, m: &PyModule) -> PyResult<()> {
    m.add_function(wrap_pyfunction!(calculate_bsm, m)?)?;
    m.add_function(wrap_pyfunction!(calculate_batch_bsm, m)?)?;
    Ok(())
}
