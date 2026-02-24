
import { generateMarketNarrative } from './marketNarrative.js';

// Mock Data
const mockMMData = {
    totalGEX: 2.5, // High Positive Gamma
    netDelta: -5000000,
    gammaFlip: 22000,
    supportLevels: [{ strike: 21800, strength: 80 }],
    resistanceLevels: [{ strike: 22200, strength: 75 }],
    hedgeDirection: 'long', // MMs need to buy
    hedgeSize: 5000000,
    pcr: 1.2
};

const spotPrice = 21950;

// Test Runner (Simple console check for now as we might not have a full runner set up in this environment)
const runTests = () => {
    console.log("Running Market Narrative Tests...");

    const result = generateMarketNarrative(mockMMData, spotPrice);

    console.log("Headline:", result.headline);
    console.log("Summary:", result.summary);
    console.log("Sentiment:", result.sentiment);

    if (result.sentiment !== 'bullish') console.error("FAIL: Expected bullish sentiment");
    if (!result.headline.includes("Market is heavily cushioned")) console.error("FAIL: Expected cushioned headline");

    console.log("Tests Complete.");
};

runTests();
