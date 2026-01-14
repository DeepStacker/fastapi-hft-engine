/**
 * OI-Weighted PCR Gauge Component
 * Shows Put-Call Ratio weighted by OI concentration for more accurate sentiment
 */
import { useMemo } from 'react';
import { useSelector } from 'react-redux';
import { selectOptionChain, selectSpotPrice, selectATMStrike, selectPCR } from '../../context/selectors';
import {
    ScaleIcon, ArrowTrendingUpIcon, ArrowTrendingDownIcon
} from '@heroicons/react/24/outline';

const OIWeightedPCRGauge = () => {
    const optionChain = useSelector(selectOptionChain);
    const spotPrice = useSelector(selectSpotPrice);
    const atmStrike = useSelector(selectATMStrike);
    const simplePCR = useSelector(selectPCR);

    // Calculate various PCR metrics
    const pcrMetrics = useMemo(() => {
        if (!optionChain) return null;

        let totalCallOI = 0;
        let totalPutOI = 0;
        let totalCallOIChg = 0;
        let totalPutOIChg = 0;
        let totalCallVol = 0;
        let totalPutVol = 0;
        let atmRangeCallOI = 0;
        let atmRangePutOI = 0;
        let weightedCallOI = 0;
        let weightedPutOI = 0;

        const strikes = Object.keys(optionChain).map(Number).sort((a, b) => a - b);
        const atmIdx = strikes.findIndex(s => s >= atmStrike);
        const nearATMStrikes = strikes.slice(Math.max(0, atmIdx - 5), atmIdx + 6);

        Object.entries(optionChain).forEach(([strikeKey, data]) => {
            const strike = parseFloat(strikeKey);
            const ceOI = data.ce?.oi || data.ce?.OI || 0;
            const peOI = data.pe?.oi || data.pe?.OI || 0;
            const ceOIChg = data.ce?.oichng || data.ce?.oi_change || 0;
            const peOIChg = data.pe?.oichng || data.pe?.oi_change || 0;
            const ceVol = data.ce?.vol || data.ce?.volume || 0;
            const peVol = data.pe?.vol || data.pe?.volume || 0;

            totalCallOI += ceOI;
            totalPutOI += peOI;
            totalCallOIChg += ceOIChg;
            totalPutOIChg += peOIChg;
            totalCallVol += ceVol;
            totalPutVol += peVol;

            // Near ATM range
            if (nearATMStrikes.includes(strike)) {
                atmRangeCallOI += ceOI;
                atmRangePutOI += peOI;
            }

            // Distance-weighted (closer to ATM = higher weight)
            const distance = Math.abs(strike - spotPrice);
            const weight = 1 / (1 + distance / spotPrice * 10);
            weightedCallOI += ceOI * weight;
            weightedPutOI += peOI * weight;
        });

        return {
            simple: totalCallOI > 0 ? totalPutOI / totalCallOI : 0,
            oiChange: totalCallOIChg !== 0 ? Math.abs(totalPutOIChg / totalCallOIChg) : 0,
            volume: totalCallVol > 0 ? totalPutVol / totalCallVol : 0,
            atmRange: atmRangeCallOI > 0 ? atmRangePutOI / atmRangeCallOI : 0,
            weighted: weightedCallOI > 0 ? weightedPutOI / weightedCallOI : 0,
            totalCallOI,
            totalPutOI,
            totalCallOIChg,
            totalPutOIChg
        };
    }, [optionChain, spotPrice, atmStrike]);

    if (!optionChain || !pcrMetrics) {
        return (
            <div className="p-8 text-center text-gray-400">
                <ScaleIcon className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>Load Option Chain data first</p>
            </div>
        );
    }

    // Interpret PCR
    const interpret = (pcr) => {
        if (pcr >= 1.5) return { label: 'Very Bullish', color: 'emerald', icon: ArrowTrendingUpIcon };
        if (pcr >= 1.2) return { label: 'Bullish', color: 'green', icon: ArrowTrendingUpIcon };
        if (pcr >= 0.8) return { label: 'Neutral', color: 'amber', icon: ScaleIcon };
        if (pcr >= 0.5) return { label: 'Bearish', color: 'orange', icon: ArrowTrendingDownIcon };
        return { label: 'Very Bearish', color: 'red', icon: ArrowTrendingDownIcon };
    };

    const mainPCR = pcrMetrics.weighted;
    const mainInterpret = interpret(mainPCR);
    const MainIcon = mainInterpret.icon;

    // Gauge angle calculation (0.3 to 2.0 PCR range → -90° to +90°)
    const gaugeAngle = Math.max(-90, Math.min(90, (mainPCR - 1.15) * 100));

    return (
        <div className="space-y-4">
            {/* Main Gauge */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="font-bold text-lg flex items-center gap-2">
                        <ScaleIcon className="w-5 h-5 text-blue-500" />
                        OI-Weighted PCR
                    </h3>
                    <div className={`px-3 py-1.5 rounded-lg text-sm font-bold flex items-center gap-1.5 ${mainInterpret.color === 'emerald' ? 'bg-emerald-100 text-emerald-700' :
                            mainInterpret.color === 'green' ? 'bg-green-100 text-green-700' :
                                mainInterpret.color === 'amber' ? 'bg-amber-100 text-amber-700' :
                                    mainInterpret.color === 'orange' ? 'bg-orange-100 text-orange-700' :
                                        'bg-red-100 text-red-700'
                        }`}>
                        <MainIcon className="w-4 h-4" />
                        {mainInterpret.label}
                    </div>
                </div>

                {/* Semicircle Gauge */}
                <div className="relative w-64 h-32 mx-auto">
                    <svg viewBox="0 0 200 100" className="w-full h-full">
                        {/* Gauge background arc */}
                        <path
                            d="M 20 100 A 80 80 0 0 1 180 100"
                            fill="none"
                            stroke="#E5E7EB"
                            strokeWidth="12"
                            strokeLinecap="round"
                        />

                        {/* Colored segments */}
                        <defs>
                            <linearGradient id="gaugeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                                <stop offset="0%" stopColor="#EF4444" />
                                <stop offset="25%" stopColor="#F97316" />
                                <stop offset="50%" stopColor="#FBBF24" />
                                <stop offset="75%" stopColor="#22C55E" />
                                <stop offset="100%" stopColor="#10B981" />
                            </linearGradient>
                        </defs>
                        <path
                            d="M 20 100 A 80 80 0 0 1 180 100"
                            fill="none"
                            stroke="url(#gaugeGradient)"
                            strokeWidth="8"
                            strokeLinecap="round"
                            opacity="0.3"
                        />

                        {/* Needle */}
                        <g transform={`translate(100, 100) rotate(${gaugeAngle})`}>
                            <line x1="0" y1="0" x2="0" y2="-65" stroke="#1F2937" strokeWidth="3" strokeLinecap="round" />
                            <circle cx="0" cy="0" r="6" fill="#1F2937" />
                        </g>

                        {/* Labels */}
                        <text x="15" y="98" className="text-[8px] fill-red-500 font-bold">Bear</text>
                        <text x="170" y="98" className="text-[8px] fill-green-500 font-bold">Bull</text>
                    </svg>

                    {/* Center value */}
                    <div className="absolute bottom-0 left-1/2 -translate-x-1/2 text-center">
                        <div className="text-4xl font-bold text-gray-900 dark:text-white">
                            {mainPCR.toFixed(2)}
                        </div>
                        <div className="text-xs text-gray-500">Weighted PCR</div>
                    </div>
                </div>

                {/* Scale markers */}
                <div className="flex justify-between px-8 mt-2 text-[10px] text-gray-400">
                    <span>0.5</span>
                    <span>0.8</span>
                    <span>1.0</span>
                    <span>1.2</span>
                    <span>1.5</span>
                </div>
            </div>

            {/* PCR Comparison */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                    { label: 'Simple OI PCR', value: pcrMetrics.simple, desc: 'Total PE OI / CE OI' },
                    { label: 'OI Change PCR', value: pcrMetrics.oiChange, desc: "Today's OI change ratio" },
                    { label: 'Volume PCR', value: pcrMetrics.volume, desc: 'Intraday volume ratio' },
                    { label: 'ATM Range PCR', value: pcrMetrics.atmRange, desc: '±5 strikes around ATM' }
                ].map((item, i) => {
                    const int = interpret(item.value);
                    return (
                        <div key={i} className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
                            <div className="text-[10px] text-gray-500 mb-1">{item.label}</div>
                            <div className={`text-xl font-bold ${int.color === 'emerald' || int.color === 'green' ? 'text-green-600' :
                                    int.color === 'amber' ? 'text-amber-600' : 'text-red-600'
                                }`}>
                                {item.value.toFixed(2)}
                            </div>
                            <div className="text-[9px] text-gray-400 mt-1">{item.desc}</div>
                        </div>
                    );
                })}
            </div>

            {/* OI Summary */}
            <div className="grid grid-cols-2 gap-4">
                <div className="bg-gradient-to-br from-red-500 to-rose-600 rounded-xl p-4 text-white">
                    <div className="text-xs opacity-80 mb-1">Total Call OI</div>
                    <div className="text-2xl font-bold">{(pcrMetrics.totalCallOI / 1e5).toFixed(2)}L</div>
                    <div className={`text-xs ${pcrMetrics.totalCallOIChg >= 0 ? 'text-green-200' : 'text-red-200'}`}>
                        {pcrMetrics.totalCallOIChg >= 0 ? '+' : ''}{(pcrMetrics.totalCallOIChg / 1e5).toFixed(2)}L today
                    </div>
                </div>
                <div className="bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl p-4 text-white">
                    <div className="text-xs opacity-80 mb-1">Total Put OI</div>
                    <div className="text-2xl font-bold">{(pcrMetrics.totalPutOI / 1e5).toFixed(2)}L</div>
                    <div className={`text-xs ${pcrMetrics.totalPutOIChg >= 0 ? 'text-green-200' : 'text-red-200'}`}>
                        {pcrMetrics.totalPutOIChg >= 0 ? '+' : ''}{(pcrMetrics.totalPutOIChg / 1e5).toFixed(2)}L today
                    </div>
                </div>
            </div>

            {/* Interpretation */}
            <div className={`rounded-xl p-4 ${mainPCR >= 1.2 ? 'bg-green-50 dark:bg-green-900/20 border border-green-200' :
                    mainPCR <= 0.8 ? 'bg-red-50 dark:bg-red-900/20 border border-red-200' :
                        'bg-amber-50 dark:bg-amber-900/20 border border-amber-200'
                }`}>
                <div className="text-sm">
                    <strong>Why Weighted PCR?</strong>
                    <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                        Simple PCR treats all strikes equally. Weighted PCR gives more importance to strikes closer to the current spot price,
                        providing a more accurate picture of near-term positioning and sentiment.
                    </p>
                    <div className="mt-2 text-xs">
                        <strong>Current Reading:</strong> {mainInterpret.label} - {
                            mainPCR >= 1.2 ? 'High put writing suggests support below. Bulls in control.' :
                                mainPCR <= 0.8 ? 'High call writing suggests resistance above. Bears in control.' :
                                    'Balanced positioning. Watch for breakout direction.'
                        }
                    </div>
                </div>
            </div>
        </div>
    );
};

export default OIWeightedPCRGauge;
