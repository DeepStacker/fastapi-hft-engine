/**
 * IV Percentile Gauge Component
 * Shows current IV relative to historical range with visual gauge
 */
import { useMemo } from 'react';
import { useSelector } from 'react-redux';
import { selectOptionChain, selectSpotPrice, selectATMStrike } from '../../context/selectors';
import {
    ChartBarSquareIcon, ArrowTrendingUpIcon, ArrowTrendingDownIcon
} from '@heroicons/react/24/outline';

const IVPercentileGauge = () => {
    const optionChain = useSelector(selectOptionChain);
    const spotPrice = useSelector(selectSpotPrice);
    const atmStrike = useSelector(selectATMStrike);

    // Calculate IV metrics
    const ivMetrics = useMemo(() => {
        if (!optionChain) return null;

        let atmCEIV = 0;
        let atmPEIV = 0;
        const allIVs = [];
        const strikes = [];

        Object.entries(optionChain).forEach(([strikeKey, data]) => {
            const strike = parseFloat(strikeKey);
            const ceIV = (data.ce?.iv || 0) * 100;
            const peIV = (data.pe?.iv || 0) * 100;

            if (ceIV > 0) allIVs.push(ceIV);
            if (peIV > 0) allIVs.push(peIV);

            if (strike === atmStrike) {
                atmCEIV = ceIV;
                atmPEIV = peIV;
            }

            if (ceIV > 0 || peIV > 0) {
                strikes.push({ strike, ceIV, peIV, avgIV: (ceIV + peIV) / 2 });
            }
        });

        strikes.sort((a, b) => a.strike - b.strike);

        const atmIV = (atmCEIV + atmPEIV) / 2;
        const minIV = Math.min(...allIVs);
        const maxIV = Math.max(...allIVs);
        const avgIV = allIVs.length > 0 ? allIVs.reduce((a, b) => a + b, 0) / allIVs.length : 0;

        // Calculate IV percentile (where current ATM IV falls in the range)
        const ivRange = maxIV - minIV;
        const ivPercentile = ivRange > 0 ? ((atmIV - minIV) / ivRange) * 100 : 50;

        // IV Rank simulation (usually needs historical data, using current range as proxy)
        const ivRank = ivPercentile;

        // Put-Call IV Spread
        const pcIVSpread = atmPEIV - atmCEIV;

        return {
            atmIV,
            atmCEIV,
            atmPEIV,
            minIV,
            maxIV,
            avgIV,
            ivPercentile,
            ivRank,
            pcIVSpread,
            strikes
        };
    }, [optionChain, atmStrike]);

    if (!optionChain || !ivMetrics) {
        return (
            <div className="p-8 text-center text-gray-400">
                <ChartBarSquareIcon className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>Load Option Chain data first</p>
            </div>
        );
    }

    // Interpret IV level
    const ivLevel = ivMetrics.ivPercentile >= 80 ? 'Very High' :
        ivMetrics.ivPercentile >= 60 ? 'High' :
            ivMetrics.ivPercentile >= 40 ? 'Normal' :
                ivMetrics.ivPercentile >= 20 ? 'Low' : 'Very Low';

    const ivColor = ivMetrics.ivPercentile >= 80 ? 'red' :
        ivMetrics.ivPercentile >= 60 ? 'orange' :
            ivMetrics.ivPercentile >= 40 ? 'amber' :
                ivMetrics.ivPercentile >= 20 ? 'green' : 'emerald';

    return (
        <div className="space-y-4">
            {/* Main IV Gauge */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6">
                <div className="flex items-center justify-between mb-6">
                    <h3 className="font-bold text-lg flex items-center gap-2">
                        <ChartBarSquareIcon className="w-5 h-5 text-purple-500" />
                        IV Percentile & Rank
                    </h3>
                    <div className={`px-3 py-1.5 rounded-lg text-sm font-bold ${ivColor === 'red' ? 'bg-red-100 text-red-700' :
                            ivColor === 'orange' ? 'bg-orange-100 text-orange-700' :
                                ivColor === 'amber' ? 'bg-amber-100 text-amber-700' :
                                    ivColor === 'green' ? 'bg-green-100 text-green-700' :
                                        'bg-emerald-100 text-emerald-700'
                        }`}>
                        {ivLevel} IV
                    </div>
                </div>

                {/* Horizontal Gauge Bar */}
                <div className="relative mb-8">
                    <div className="h-8 rounded-full bg-gradient-to-r from-emerald-500 via-amber-500 to-red-500 overflow-hidden">
                        <div className="absolute inset-0 flex">
                            {/* IV Zones */}
                            <div className="w-1/5 border-r border-white/30"></div>
                            <div className="w-1/5 border-r border-white/30"></div>
                            <div className="w-1/5 border-r border-white/30"></div>
                            <div className="w-1/5 border-r border-white/30"></div>
                            <div className="w-1/5"></div>
                        </div>
                    </div>

                    {/* Needle/Marker */}
                    <div
                        className="absolute top-0 -translate-x-1/2 flex flex-col items-center"
                        style={{ left: `${ivMetrics.ivPercentile}%` }}
                    >
                        <div className="w-1 h-8 bg-gray-900 dark:bg-white rounded-full"></div>
                        <div className="mt-2 px-2 py-1 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded text-xs font-bold">
                            {ivMetrics.ivPercentile.toFixed(0)}%
                        </div>
                    </div>

                    {/* Labels */}
                    <div className="flex justify-between mt-3 text-[10px] text-gray-500">
                        <span>0% (Low)</span>
                        <span>25%</span>
                        <span>50%</span>
                        <span>75%</span>
                        <span>100% (High)</span>
                    </div>
                </div>

                {/* ATM IV Value */}
                <div className="text-center mb-6">
                    <div className="text-4xl font-bold text-gray-900 dark:text-white">
                        {ivMetrics.atmIV.toFixed(1)}%
                    </div>
                    <div className="text-sm text-gray-500">ATM Implied Volatility</div>
                </div>

                {/* IV Stats Grid */}
                <div className="grid grid-cols-4 gap-3">
                    <div className="text-center p-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
                        <div className="text-[10px] text-gray-500 mb-1">Min IV</div>
                        <div className="text-lg font-bold text-emerald-600">{ivMetrics.minIV.toFixed(1)}%</div>
                    </div>
                    <div className="text-center p-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
                        <div className="text-[10px] text-gray-500 mb-1">Avg IV</div>
                        <div className="text-lg font-bold text-amber-600">{ivMetrics.avgIV.toFixed(1)}%</div>
                    </div>
                    <div className="text-center p-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
                        <div className="text-[10px] text-gray-500 mb-1">Max IV</div>
                        <div className="text-lg font-bold text-red-600">{ivMetrics.maxIV.toFixed(1)}%</div>
                    </div>
                    <div className="text-center p-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
                        <div className="text-[10px] text-gray-500 mb-1">IV Rank</div>
                        <div className="text-lg font-bold text-purple-600">{ivMetrics.ivRank.toFixed(0)}%</div>
                    </div>
                </div>
            </div>

            {/* Put-Call IV Spread */}
            <div className="grid grid-cols-3 gap-4">
                <div className="bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl p-4 text-white">
                    <div className="text-xs opacity-80 mb-1">Call IV (ATM)</div>
                    <div className="text-2xl font-bold">{ivMetrics.atmCEIV.toFixed(1)}%</div>
                </div>
                <div className="bg-gradient-to-br from-red-500 to-rose-600 rounded-xl p-4 text-white">
                    <div className="text-xs opacity-80 mb-1">Put IV (ATM)</div>
                    <div className="text-2xl font-bold">{ivMetrics.atmPEIV.toFixed(1)}%</div>
                </div>
                <div className={`rounded-xl p-4 border-2 ${ivMetrics.pcIVSpread > 0
                        ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
                        : 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                    }`}>
                    <div className="text-xs text-gray-500 mb-1">Put-Call IV Spread</div>
                    <div className={`text-2xl font-bold flex items-center gap-1 ${ivMetrics.pcIVSpread > 0 ? 'text-red-600' : 'text-green-600'
                        }`}>
                        {ivMetrics.pcIVSpread > 0 ? <ArrowTrendingDownIcon className="w-5 h-5" /> : <ArrowTrendingUpIcon className="w-5 h-5" />}
                        {ivMetrics.pcIVSpread > 0 ? '+' : ''}{ivMetrics.pcIVSpread.toFixed(1)}%
                    </div>
                    <div className="text-[10px] text-gray-500 mt-1">
                        {ivMetrics.pcIVSpread > 1 ? 'Bearish skew (puts expensive)' :
                            ivMetrics.pcIVSpread < -1 ? 'Bullish skew (calls expensive)' : 'Neutral'}
                    </div>
                </div>
            </div>

            {/* IV by Strike Chart */}
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                <div className="px-4 py-2.5 bg-gradient-to-r from-purple-500 to-indigo-500 text-white">
                    <h3 className="font-semibold text-sm">IV by Strike (Smile)</h3>
                </div>
                <div className="p-4">
                    <IVSmileChart strikes={ivMetrics.strikes} atmStrike={atmStrike} atmIV={ivMetrics.atmIV} />
                </div>
            </div>

            {/* Interpretation */}
            <div className={`rounded-xl p-4 ${ivMetrics.ivPercentile >= 70 ? 'bg-red-50 dark:bg-red-900/20' :
                    ivMetrics.ivPercentile <= 30 ? 'bg-green-50 dark:bg-green-900/20' :
                        'bg-amber-50 dark:bg-amber-900/20'
                }`}>
                <div className="text-sm">
                    <strong>Trading Implications:</strong>
                    <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                        {ivMetrics.ivPercentile >= 70
                            ? '⚠️ IV is elevated. Options are expensive. Consider selling premium (iron condors, credit spreads). Be cautious buying options.'
                            : ivMetrics.ivPercentile <= 30
                                ? '✅ IV is low. Options are cheap. Good time to buy options (long straddles, strangles). Avoid selling premium.'
                                : 'IV is in normal range. Evaluate individual trades based on directional view and strategy.'}
                    </p>
                </div>
            </div>
        </div>
    );
};

// IV Smile Mini Chart
const IVSmileChart = ({ strikes, atmStrike, atmIV }) => {
    const width = 700;
    const height = 150;
    const padding = { left: 50, right: 30, top: 20, bottom: 30 };

    if (!strikes || strikes.length === 0) return null;

    const minIV = Math.min(...strikes.flatMap(s => [s.ceIV, s.peIV]).filter(v => v > 0));
    const maxIV = Math.max(...strikes.flatMap(s => [s.ceIV, s.peIV]));
    const ivRange = maxIV - minIV || 1;

    const xScale = (i) => padding.left + (i / (strikes.length - 1)) * (width - padding.left - padding.right);
    const yScale = (iv) => padding.top + ((maxIV - iv) / ivRange) * (height - padding.top - padding.bottom);

    const atmIdx = strikes.findIndex(s => s.strike === atmStrike);

    return (
        <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`}>
            {/* Grid lines */}
            {[0.25, 0.5, 0.75].map((t, i) => {
                const y = padding.top + (height - padding.top - padding.bottom) * t;
                return <line key={i} x1={padding.left} y1={y} x2={width - padding.right} y2={y} stroke="#E5E7EB" strokeDasharray="3" />;
            })}

            {/* ATM marker */}
            {atmIdx >= 0 && (
                <line x1={xScale(atmIdx)} y1={padding.top} x2={xScale(atmIdx)} y2={height - padding.bottom}
                    stroke="#3B82F6" strokeWidth="2" strokeDasharray="5,3" />
            )}

            {/* CE IV line */}
            <polyline
                points={strikes.filter(s => s.ceIV > 0).map((s, i, arr) => {
                    const origIdx = strikes.indexOf(s);
                    return `${xScale(origIdx)},${yScale(s.ceIV)}`;
                }).join(' ')}
                fill="none" stroke="#10B981" strokeWidth="2.5" strokeLinecap="round"
            />

            {/* PE IV line */}
            <polyline
                points={strikes.filter(s => s.peIV > 0).map((s, i, arr) => {
                    const origIdx = strikes.indexOf(s);
                    return `${xScale(origIdx)},${yScale(s.peIV)}`;
                }).join(' ')}
                fill="none" stroke="#EF4444" strokeWidth="2.5" strokeLinecap="round"
            />

            {/* Legend */}
            <g transform={`translate(${width - 120}, 10)`}>
                <line x1="0" y1="6" x2="15" y2="6" stroke="#10B981" strokeWidth="2.5" />
                <text x="20" y="9" className="fill-gray-600 text-[9px]">CE IV</text>
                <line x1="55" y1="6" x2="70" y2="6" stroke="#EF4444" strokeWidth="2.5" />
                <text x="75" y="9" className="fill-gray-600 text-[9px]">PE IV</text>
            </g>

            {/* Y axis labels */}
            <text x={padding.left - 5} y={padding.top + 5} textAnchor="end" className="fill-gray-500 text-[9px]">{maxIV.toFixed(0)}%</text>
            <text x={padding.left - 5} y={height - padding.bottom} textAnchor="end" className="fill-gray-500 text-[9px]">{minIV.toFixed(0)}%</text>
        </svg>
    );
};

export default IVPercentileGauge;
