/**
 * Market Narrative Generator
 * Translates complex Greek data into human-readable signals.
 */

export const generateMarketNarrative = (mmData, spotPrice) => {
    if (!mmData) return { headline: "Waiting for data...", summary: "Data loading.", sentiment: "neutral" };

    const {
        totalGEX,
        netDelta,
        gammaFlip,
        supportLevels,
        resistanceLevels,
        hedgeDirection,
        hedgeSize,
        pcr,
        painThresholdRatio,
        netVannaFlow,
        netCharmFlow
    } = mmData;

    let headline = "";
    let summary = "";
    let sentiment = "neutral";
    let score = 0; // -10 to +10

    // 1. GEX Regime Analysis (Market Stability)
    const gexInCr = totalGEX;
    const isPositiveGamma = gexInCr > 0;

    // SIMPLIFIED LOGIC FOR BEGINNERS
    if (gexInCr > 0.8) {
        headline = "Market is heavily cushioned (Stable).";
        summary += "Big players are positioned to buy dips and sell rallies. Expect the market to stay in a range. ";
        score += 2;
    } else if (gexInCr < -0.8) {
        headline = "Market is turbulent (Risk of big moves).";
        summary += "Big players may trade with the trend, making moves faster and sharper. Be careful of sudden drops or spikes. ";
        sentiment = "bearish";
        score -= 2;
    } else {
        headline = "Market is essentially neutral.";
        summary += "No strong manipulation by big players detected. Market will move based on news or normal buying/selling. ";
    }

    // 2. Net Delta Analysis (Directional Pressure)
    if (hedgeDirection === 'long') {
        summary += `Dealers need to BUY to protect themselves (~${formatSimple(hedgeSize)} delta). This acts as a natural support for price. `;
        score += 3;
    } else if (hedgeDirection === 'short') {
        summary += `Dealers need to SELL to protect themselves (~${formatSimple(hedgeSize)} delta). This acts as a natural resistance (ceiling). `;
        score -= 3;
    }

    // 3. Support/Resistance Context
    const immediateSupport = supportLevels[0];
    const immediateResistance = resistanceLevels[0];

    if (immediateSupport && (spotPrice - immediateSupport.strike) < (spotPrice * 0.005)) {
        summary += `Price is very close to strong support at ${immediateSupport.strike}. Watch for a bounce. `;
        if (isPositiveGamma) score += 2;
    }

    if (immediateResistance && (immediateResistance.strike - spotPrice) < (spotPrice * 0.005)) {
        summary += `Price is hitting a wall at ${immediateResistance.strike}. Hard to break through. `;
        if (isPositiveGamma) score -= 2;
    }

    // 4. Gamma Flip Context
    if (gammaFlip) {
        const distToFlip = ((gammaFlip - spotPrice) / spotPrice) * 100;
        if (Math.abs(distToFlip) < 0.5) {
            summary += `CRITICAL: Price is at the 'Flip Level' (${gammaFlip}). If it crosses this, the market mood could change instantly. `;
        }
    }

    // 5. Pain Threshold (Stability Analysis)
    if (painThresholdRatio !== undefined) {
        if (painThresholdRatio < 1.0) {
            summary += `⚠️ Smart Money is losing money right now. They might fight hard to pin the price to minimize losses. `;
        } else if (painThresholdRatio > 2.0) {
            summary += `Smart Money is profitable and relaxed. They likely won't manipulate the price today. `;
            score += 1;
        }
    }

    // 6. Vanna & Charm Flows (Predictive Flow)
    if (netVannaFlow && Math.abs(netVannaFlow) > 100000) {
        const flowDir = netVannaFlow > 0 ? "BUY" : "SELL";
        summary += `PREDICTION: Later today, expect slight ${flowDir} pressure due to options decay. `;
        if (flowDir === "BUY") score += 1;
        else score -= 1;
    }

    // Determine Sentiment
    if (score >= 3) sentiment = "bullish";
    else if (score <= -3) sentiment = "bearish";
    else sentiment = "neutral";

    // Refine Headline based on score
    if (score >= 5) headline = "Strong Bullish Setup Detected.";
    if (score <= -5) headline = "High Risk / Bearish Setup Detected.";

    return {
        headline,
        summary: summary.trim(),
        sentiment,
        score
    };
};

const formatSimple = (num) => {
    if (num > 10000000) return (num / 10000000).toFixed(1) + 'Cr';
    if (num > 100000) return (num / 100000).toFixed(1) + 'L';
    return (num / 1000).toFixed(0) + 'k';
}
