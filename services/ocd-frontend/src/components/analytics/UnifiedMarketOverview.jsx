/**
 * Unified Market Overview Component
 * The "Consensus Engine" that aggregates conflicting signals into a single tradeable outlook.
 */
import { useMemo } from 'react';
import { useSelector } from 'react-redux';
import {
    selectOptionChain,
    selectSpotPrice,
    selectATMStrike,
    selectPCR,
    selectMaxPainStrike,
    selectDataSymbol,
    selectTotalOI
} from '../../context/selectors';
import { useChartOfAccuracy } from '../../hooks/useChartOfAccuracy';
import {
    ScaleIcon,
    ShieldCheckIcon,
    ShieldExclamationIcon,
    BoltIcon,
    ChartBarIcon,
    FireIcon,
    ArrowTrendingUpIcon,
    ArrowTrendingDownIcon,
    CheckCircleIcon,
    ExclamationTriangleIcon,
    BeakerIcon
} from '@heroicons/react/24/outline';
import Card from '../common/Card';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';

const UnifiedMarketOverview = () => {
    const theme = useSelector((state) => state.theme.theme);
    const isDark = theme === 'dark';

    // 1. Get Data Sources
    const optionChain = useSelector(selectOptionChain);
    const spotPrice = useSelector(selectSpotPrice);
    const atmStrike = useSelector(selectATMStrike);
    const pcr = useSelector(selectPCR);
    const maxPain = useSelector(selectMaxPainStrike);
    const totalOI = useSelector(selectTotalOI);

    // 2. Get COA Signal (The "King" Signal)
    const coa = useChartOfAccuracy(optionChain, spotPrice, atmStrike);

    // 3. Consensus Algorithm
    const consensus = useMemo(() => {
        if (!optionChain || !spotPrice || !coa) return null;

        let score = 0;
        let reasons = [];
        let factors = [];

        // --- FACTOR 1: Chart of Accuracy (Weight: 30%) ---
        // Measures Institutional Support/Resistance Strength
        let coaScore = 0;
        const bias = coa.scenario.bias;
        const scenarioId = coa.scenario.id;

        if (bias === 'Bullish' || bias === 'Bull Run') {
            coaScore = 30;
            reasons.push({ type: 'bullish', label: `COA Scenario ${scenarioId}`, desc: 'Support is Strong, Resistance is weak.' });
        } else if (bias === 'Bearish' || bias === 'Blood Bath') {
            coaScore = -30;
            reasons.push({ type: 'bearish', label: `COA Scenario ${scenarioId}`, desc: 'Resistance is Strong, Support is weak.' });
        } else {
            // Neutral/Rangebound
            reasons.push({ type: 'neutral', label: `COA Scenario ${scenarioId}`, desc: 'Both sides equally strong (Rangebound).' });
        }
        score += coaScore;
        factors.push({ name: 'Institutions (COA)', value: coaScore, max: 30, desc: 'Setup' });


        // --- FACTOR 2: Net Open Interest (Weight: 25%) ---
        // Measures "Control" (Who has more soldiers on the field?)
        let oiScore = 0;
        const netOI = totalOI.puts - totalOI.calls; // Puts = Support (Bullish), Calls = Resistance (Bearish)
        const totalOIVol = totalOI.puts + totalOI.calls || 1;
        const netOIPct = netOI / totalOIVol;

        if (netOIPct > 0.1) { // >10% more Puts
            oiScore = 25;
            reasons.push({ type: 'bullish', label: 'Net OI Control', desc: 'Puts dominate Calls (Support > Resistance).' });
        } else if (netOIPct < -0.1) { // >10% more Calls
            oiScore = -25;
            reasons.push({ type: 'bearish', label: 'Net OI Control', desc: 'Calls dominate Puts (Resistance > Support).' });
        } else {
            reasons.push({ type: 'neutral', label: 'Net OI Control', desc: 'Bulls and Bears fairly balanced.' });
        }
        score += oiScore;
        factors.push({ name: 'Net Positions (OI)', value: oiScore, max: 25, desc: 'Control' });


        // --- FACTOR 3: Max Pain Gravity (Weight: 20%) ---
        // Measures Market Maker Incentive (Reversion to Mean)
        let mpScore = 0;
        const mpDist = (maxPain - spotPrice) / spotPrice;

        if (mpDist > 0.005) { // Spot is >0.5% BELOW Max Pain -> Pull UP
            mpScore = 20;
            reasons.push({ type: 'bullish', label: 'Max Pain Gravity', desc: `Market Makers want price HIGHER (to ₹${maxPain}).` });
        } else if (mpDist < -0.005) { // Spot is >0.5% ABOVE Max Pain -> Pull DOWN
            mpScore = -20;
            reasons.push({ type: 'bearish', label: 'Max Pain Gravity', desc: `Market Makers want price LOWER (to ₹${maxPain}).` });
        } else {
            reasons.push({ type: 'neutral', label: 'Max Pain', desc: 'Price aligned with Market Maker incentives.' });
        }
        score += mpScore;
        factors.push({ name: 'Incentives (Max Pain)', value: mpScore, max: 20, desc: 'Gravity' });


        // --- FACTOR 4: PCR Sentiment (Weight: 15%) ---
        // Measures Retail/General Sentiment (Contrarian if extreme)
        let pcrScore = 0;
        if (pcr > 1.2) {
            pcrScore = 15;
            reasons.push({ type: 'bullish', label: 'PCR Sentiment', desc: 'High Put writing (Bullish Sentiment).' });
        } else if (pcr < 0.7) {
            pcrScore = -15;
            reasons.push({ type: 'bearish', label: 'PCR Sentiment', desc: 'High Call writing (Bearish Sentiment).' });
        } else {
            reasons.push({ type: 'neutral', label: 'PCR Sentiment', desc: 'Sentiment is balanced.' });
        }
        score += pcrScore;
        factors.push({ name: 'Sentiment (PCR)', value: pcrScore, max: 15, desc: 'Mood' });


        // --- FACTOR 5: IV Skew (Weight: 10%) ---
        // Measures Fear vs Greed pricing
        let ivScore = 0;
        const atmData = optionChain[atmStrike] || optionChain[String(atmStrike)] || {};
        const ceIV = atmData.ce?.iv || 0;
        const peIV = atmData.pe?.iv || 0;

        if (ceIV > peIV * 1.05) { // Call IV 5% higher
            ivScore = 10; // Call Skew = Bullish demand
            reasons.push({ type: 'bullish', label: 'IV Skew', desc: 'Higher demand for Calls (Greed).' });
        } else if (peIV > ceIV * 1.05) {
            ivScore = -10; // Put Skew = Bearish demand (Fear)
            reasons.push({ type: 'bearish', label: 'IV Skew', desc: 'Higher demand for Puts (Fear).' });
        } else {
            reasons.push({ type: 'neutral', label: 'IV Skew', desc: 'Volatility pricing is balanced.' });
        }
        score += ivScore;
        factors.push({ name: 'Fear/Greed (IV)', value: ivScore, max: 10, desc: 'Pricing' });

        return { score, reasons, factors, maxScore: 100 };
    }, [optionChain, spotPrice, coa, pcr, maxPain, atmStrike, totalOI]);

    // Gauge Needle Logic
    const needleData = consensus ? [
        { value: 50 + (consensus.score / 2), color: 'transparent' }, // Placeholder to rotate needle
        { value: 1, color: isDark ? '#fff' : '#000' }, // Needle width
        { value: 100 - (50 + (consensus.score / 2)), color: 'transparent' }
    ] : [];

    const getVerdict = (score) => {
        if (score >= 60) return { text: "STRONG BULLISH", color: "text-green-600", desc: "Multiple signals align for upside.", bg: "bg-green-100 dark:bg-green-900/30", borderColor: "border-green-500" };
        if (score >= 20) return { text: "WEAK BULLISH", color: "text-green-500", desc: "Bias is up, but expect chop/resistance.", bg: "bg-green-50 dark:bg-green-900/20", borderColor: "border-green-300" };
        if (score > -20) return { text: "NEUTRAL / CHOPPY", color: "text-amber-500", desc: "Conflicting signals. Range-bound likely.", bg: "bg-amber-50 dark:bg-amber-900/20", borderColor: "border-amber-300" };
        if (score > -60) return { text: "WEAK BEARISH", color: "text-red-500", desc: "Bias is down, but support exists.", bg: "bg-red-50 dark:bg-red-900/20", borderColor: "border-red-300" };
        return { text: "STRONG BEARISH", color: "text-red-600", desc: "Multiple signals align for downside.", bg: "bg-red-100 dark:bg-red-900/30", borderColor: "border-red-500" };
    };

    if (!consensus) return <div className="p-8 text-center text-gray-400">Loading Consensus...</div>;

    const verdict = getVerdict(consensus.score);

    return (
        <div className="space-y-6">
            {/* Top Section: The Verdict */}
            <div className={`rounded-xl p-1 border-2 ${verdict.borderColor} ${verdict.bg}`}>
                <div className="bg-white/60 dark:bg-gray-900/60 backdrop-blur rounded-lg p-6">
                    <div className="grid md:grid-cols-3 gap-8 items-center">

                        {/* 1. Confluence Meter */}
                        <div className="relative h-40 flex items-center justify-center">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={[{ value: 33 }, { value: 33 }, { value: 34 }]}
                                        cx="50%"
                                        cy="100%"
                                        startAngle={180}
                                        endAngle={0}
                                        innerRadius={60}
                                        outerRadius={80}
                                        paddingAngle={2}
                                        dataKey="value"
                                        stroke="none"
                                    >
                                        <Cell fill="#ef4444" /> {/* Red */}
                                        <Cell fill="#f59e0b" /> {/* Amber */}
                                        <Cell fill="#22c55e" /> {/* Green */}
                                    </Pie>
                                </PieChart>
                            </ResponsiveContainer>
                            {/* Needle */}
                            <div
                                className="absolute bottom-0 w-[2px] h-[70px] bg-gray-800 dark:bg-white origin-bottom transition-all duration-1000 ease-out"
                                style={{ transform: `rotate(${-90 + ((consensus.score + 100) / 200) * 180}deg)` }}
                            >
                                <div className="absolute -top-1 -left-1.5 w-4 h-4 rounded-full bg-gray-800 dark:bg-white border-2 border-white dark:border-gray-900" />
                            </div>
                            <div className="absolute -bottom-8 text-center">
                                <div className={`text-3xl font-black ${verdict.color}`}>
                                    {consensus.score > 0 ? '+' : ''}{consensus.score}
                                </div>
                                <div className="text-[10px] text-gray-500">CONFLUENCE SCORE</div>
                            </div>
                        </div>

                        {/* 2. Verdict Text */}
                        <div className="text-center md:text-left space-y-2">
                            <div className="text-sm text-gray-500 uppercase tracking-wider font-semibold">Market Outlook</div>
                            <h2 className={`text-3xl font-bold ${verdict.color}`}>{verdict.text}</h2>
                            <p className="text-gray-600 dark:text-gray-300 font-medium leading-tight">
                                {verdict.desc}
                            </p>
                            <div className="pt-2 flex flex-wrap gap-2 justify-center md:justify-start">
                                {consensus.reasons.filter(r => r.type === (consensus.score > 0 ? 'bullish' : 'bearish')).slice(0, 2).map((r, i) => (
                                    <span key={i} className="text-[10px] px-2 py-1 bg-white dark:bg-black/20 rounded-full border border-gray-200 dark:border-gray-700">
                                        ✅ {r.label}
                                    </span>
                                ))}
                            </div>
                        </div>

                        {/* 3. Key Levels Summary */}
                        <div className="bg-white/50 dark:bg-gray-800/50 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
                            <h4 className="text-xs font-bold text-gray-500 mb-3 flex items-center gap-1">
                                <ShieldCheckIcon className="w-4 h-4" /> KEY LEVELS PLAYBOOK
                            </h4>
                            <div className="space-y-3 text-sm">
                                <div className="flex justify-between items-center">
                                    <span className="text-red-600 font-medium">Resistance (Top)</span>
                                    <span className="font-bold">{coa.trading.top?.toFixed(0) || 'N/A'}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-green-600 font-medium">Support (Bottom)</span>
                                    <span className="font-bold">{coa.trading.bottom?.toFixed(0) || 'N/A'}</span>
                                </div>
                                <div className="text-xs text-center pt-2 border-t border-gray-200 dark:border-gray-700 text-gray-500 italic">
                                    "{coa.trading.recommendation}"
                                </div>
                            </div>
                        </div>

                    </div>
                </div>
            </div>

            {/* Middle Section: The Conflict Resolver (Factor Details) */}
            <div className="grid md:grid-cols-2 gap-6">

                {/* Score Breakdown */}
                <Card variant="glass" className="p-0 overflow-hidden">
                    <div className="p-4 border-b border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50">
                        <h3 className="font-bold flex items-center gap-2">
                            <CheckCircleIcon className="w-5 h-5 text-blue-500" />
                            Score Breakdown
                        </h3>
                    </div>
                    <div className="p-4 space-y-4">
                        {consensus.factors.map((f, i) => (
                            <div key={i} className="space-y-1">
                                <div className="flex justify-between text-xs">
                                    <span className="font-medium text-gray-600 dark:text-gray-400">{f.name}</span>
                                    <span className={`font-bold ${f.value > 0 ? 'text-green-600' : f.value < 0 ? 'text-red-600' : 'text-gray-400'}`}>
                                        {f.value > 0 ? '+' : ''}{f.value}/{f.max}
                                    </span>
                                </div>
                                {/* Progress Bar */}
                                <div className="h-1.5 w-full bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden flex">
                                    <div className="w-1/2 flex justify-end">
                                        {f.value < 0 && (
                                            <div className="h-full bg-red-500 rounded-l-full" style={{ width: `${Math.abs(f.value / f.max) * 100}%` }} />
                                        )}
                                    </div>
                                    <div className="w-1/2 flex justify-start">
                                        {f.value > 0 && (
                                            <div className="h-full bg-green-500 rounded-r-full" style={{ width: `${Math.abs(f.value / f.max) * 100}%` }} />
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </Card>

                {/* Conflict Resolver List */}
                <Card variant="glass" className="p-0 overflow-hidden">
                    <div className="p-4 border-b border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50">
                        <h3 className="font-bold flex items-center gap-2">
                            <ExclamationTriangleIcon className="w-5 h-5 text-amber-500" />
                            Signal Conflicts & Drivers
                        </h3>
                    </div>
                    <div className="p-4 space-y-3 h-[240px] overflow-y-auto">
                        <div className="text-xs text-gray-500 mb-2 italic">Why is the score {consensus.score}?</div>

                        {consensus.reasons.map((r, i) => (
                            <div key={i} className={`flex items-start gap-3 p-3 rounded-lg border ${r.type === 'bullish' ? 'bg-green-50 dark:bg-green-900/10 border-green-100 dark:border-green-900/30' :
                                    r.type === 'bearish' ? 'bg-red-50 dark:bg-red-900/10 border-red-100 dark:border-red-900/30' :
                                        'bg-gray-50 dark:bg-gray-800/50 border-gray-100 dark:border-gray-700'
                                }`}>
                                <div className={`p-1.5 rounded-full ${r.type === 'bullish' ? 'bg-green-100 text-green-600' :
                                        r.type === 'bearish' ? 'bg-red-100 text-red-600' :
                                            'bg-gray-200 text-gray-500'
                                    }`}>
                                    {r.type === 'bullish' ? <ArrowTrendingUpIcon className="w-4 h-4" /> :
                                        r.type === 'bearish' ? <ArrowTrendingDownIcon className="w-4 h-4" /> :
                                            <MinusIcon className="w-4 h-4" />}
                                </div>
                                <div>
                                    <div className={`text-xs font-bold ${r.type === 'bullish' ? 'text-green-700 dark:text-green-400' :
                                            r.type === 'bearish' ? 'text-red-700 dark:text-red-400' :
                                                'text-gray-600 dark:text-gray-400'
                                        }`}>
                                        {r.label}
                                    </div>
                                    <div className="text-xs text-gray-600 dark:text-gray-400">{r.desc}</div>
                                </div>
                            </div>
                        ))}
                    </div>
                </Card>
            </div>
        </div>
    );
};

// Helper Icon
const MinusIcon = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 12h-15" />
    </svg>
);

export default UnifiedMarketOverview;
