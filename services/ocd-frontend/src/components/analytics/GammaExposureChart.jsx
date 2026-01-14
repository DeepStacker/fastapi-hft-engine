/**
 * Gamma Exposure (GEX) Chart Component
 * Shows gamma exposure levels to identify market maker hedging zones
 * Positive GEX = Price stabilization, Negative GEX = Price acceleration
 */
import { useMemo, useState } from 'react';
import { useSelector } from 'react-redux';
import { selectOptionChain, selectSpotPrice, selectATMStrike, selectLotSize } from '../../context/selectors';
import {
    BoltIcon, ArrowTrendingUpIcon, ArrowTrendingDownIcon,
    InformationCircleIcon, ChartBarIcon
} from '@heroicons/react/24/outline';

const GammaExposureChart = () => {
    const optionChain = useSelector(selectOptionChain);
    const spotPrice = useSelector(selectSpotPrice);
    const atmStrike = useSelector(selectATMStrike);
    const lotSize = useSelector(selectLotSize) || 50;

    const [showInfo, setShowInfo] = useState(false);

    // Calculate GEX for each strike
    const gexData = useMemo(() => {
        if (!optionChain || !spotPrice) return { strikes: [], totalGEX: 0, flipLevel: null };

        const strikes = [];
        let totalCallGEX = 0;
        let totalPutGEX = 0;

        // GEX formula: gamma × OI × spot² × 0.01 × contract_multiplier
        // For calls: positive gamma (MM buys as price rises)
        // For puts: negative gamma (MM sells as price rises)
        Object.entries(optionChain).forEach(([strikeKey, data]) => {
            const strike = parseFloat(strikeKey);
            const ceGamma = data.ce?.optgeeks?.gamma || data.ce?.gamma || 0;
            const peGamma = data.pe?.optgeeks?.gamma || data.pe?.gamma || 0;
            const ceOI = data.ce?.oi || data.ce?.OI || 0;
            const peOI = data.pe?.oi || data.pe?.OI || 0;

            // Calculate GEX in crores for readability
            const multiplier = spotPrice * spotPrice * 0.01 * lotSize / 10000000; // Convert to Cr
            const callGEX = ceGamma * ceOI * multiplier;
            const putGEX = -peGamma * peOI * multiplier; // Negative for puts

            totalCallGEX += callGEX;
            totalPutGEX += putGEX;

            strikes.push({
                strike,
                callGEX,
                putGEX,
                netGEX: callGEX + putGEX,
                callOI: ceOI,
                putOI: peOI,
                callGamma: ceGamma,
                putGamma: peGamma
            });
        });

        strikes.sort((a, b) => a.strike - b.strike);

        // Find gamma flip level (where cumulative GEX crosses zero)
        let cumulativeGEX = 0;
        let flipLevel = null;
        for (let i = 0; i < strikes.length; i++) {
            const prevCumulative = cumulativeGEX;
            cumulativeGEX += strikes[i].netGEX;
            if (prevCumulative < 0 && cumulativeGEX >= 0) {
                flipLevel = strikes[i].strike;
                break;
            }
            if (prevCumulative > 0 && cumulativeGEX <= 0) {
                flipLevel = strikes[i].strike;
                break;
            }
        }

        const totalGEX = totalCallGEX + totalPutGEX;

        return { strikes, totalGEX, totalCallGEX, totalPutGEX, flipLevel };
    }, [optionChain, spotPrice, lotSize]);

    const maxGEX = useMemo(() => {
        return Math.max(...gexData.strikes.map(s => Math.abs(s.netGEX)), 0.01);
    }, [gexData.strikes]);

    // Filter strikes around ATM
    const visibleStrikes = useMemo(() => {
        const atmIdx = gexData.strikes.findIndex(s => s.strike >= atmStrike);
        const start = Math.max(0, atmIdx - 10);
        const end = Math.min(gexData.strikes.length, atmIdx + 11);
        return gexData.strikes.slice(start, end);
    }, [gexData.strikes, atmStrike]);

    // Determine market regime
    const regime = useMemo(() => {
        if (gexData.totalGEX > 0.5) return { type: 'positive', label: 'Stabilizing', color: 'emerald', desc: 'MMs buy dips, sell rallies' };
        if (gexData.totalGEX < -0.5) return { type: 'negative', label: 'Volatile', color: 'red', desc: 'MMs amplify moves' };
        return { type: 'neutral', label: 'Neutral', color: 'amber', desc: 'Mixed positioning' };
    }, [gexData.totalGEX]);

    if (!optionChain) {
        return (
            <div className="p-8 text-center text-gray-400">
                <BoltIcon className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>Load Option Chain data to view GEX</p>
            </div>
        );
    }

    const width = 700;
    const height = 280;
    const padding = { left: 60, right: 30, top: 30, bottom: 40 };
    const chartW = width - padding.left - padding.right;
    const chartH = height - padding.top - padding.bottom;

    const xScale = (i) => padding.left + (i / (visibleStrikes.length - 1)) * chartW;
    const yScale = (gex) => padding.top + ((maxGEX - gex) / (maxGEX * 2)) * chartH;
    const zeroY = yScale(0);

    return (
        <div className="space-y-4">
            {/* Summary Cards */}
            <div className="grid grid-cols-4 gap-3">
                {/* Total GEX */}
                <div className={`relative overflow-hidden rounded-xl p-4 bg-gradient-to-br ${regime.type === 'positive' ? 'from-emerald-500 to-teal-600' :
                        regime.type === 'negative' ? 'from-red-500 to-rose-600' :
                            'from-amber-500 to-orange-600'
                    } text-white shadow-lg`}>
                    <div className="absolute -right-4 -top-4 w-16 h-16 bg-white/10 rounded-full blur-xl" />
                    <div className="relative">
                        <div className="flex items-center gap-1 text-[10px] opacity-80 mb-1">
                            <BoltIcon className="w-3 h-3" />
                            Net GEX
                        </div>
                        <div className="text-2xl font-bold">{gexData.totalGEX.toFixed(2)} Cr</div>
                        <div className="text-xs opacity-80">{regime.label}</div>
                    </div>
                </div>

                {/* Call GEX */}
                <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
                    <div className="text-[10px] text-emerald-600 font-medium mb-1">Call GEX</div>
                    <div className="text-xl font-bold text-emerald-600">+{gexData.totalCallGEX.toFixed(2)} Cr</div>
                    <div className="text-[9px] text-gray-400">Stabilizing force</div>
                </div>

                {/* Put GEX */}
                <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
                    <div className="text-[10px] text-red-600 font-medium mb-1">Put GEX</div>
                    <div className="text-xl font-bold text-red-600">{gexData.totalPutGEX.toFixed(2)} Cr</div>
                    <div className="text-[9px] text-gray-400">Volatile force</div>
                </div>

                {/* Gamma Flip */}
                <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
                    <div className="text-[10px] text-purple-600 font-medium mb-1">Gamma Flip Level</div>
                    <div className="text-xl font-bold text-purple-600">
                        {gexData.flipLevel ? gexData.flipLevel : 'N/A'}
                    </div>
                    <div className="text-[9px] text-gray-400">
                        {gexData.flipLevel ? `${((gexData.flipLevel - spotPrice) / spotPrice * 100).toFixed(1)}% from spot` : 'No flip detected'}
                    </div>
                </div>
            </div>

            {/* Info Toggle */}
            <button
                onClick={() => setShowInfo(!showInfo)}
                className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-700"
            >
                <InformationCircleIcon className="w-4 h-4" />
                {showInfo ? 'Hide' : 'What is GEX?'}
            </button>

            {showInfo && (
                <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4 text-sm space-y-2">
                    <p><strong>Gamma Exposure (GEX)</strong> measures how market makers must hedge their positions as price moves.</p>
                    <div className="grid grid-cols-2 gap-4 text-xs">
                        <div className="flex items-start gap-2">
                            <span className="w-3 h-3 bg-emerald-500 rounded mt-0.5"></span>
                            <div>
                                <strong>Positive GEX:</strong> MMs buy dips and sell rallies, creating price stability and mean reversion.
                            </div>
                        </div>
                        <div className="flex items-start gap-2">
                            <span className="w-3 h-3 bg-red-500 rounded mt-0.5"></span>
                            <div>
                                <strong>Negative GEX:</strong> MMs sell into declines and buy into rallies, amplifying price moves.
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Main Chart */}
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                <div className={`px-4 py-2.5 bg-gradient-to-r ${regime.type === 'positive' ? 'from-emerald-500 to-teal-500' :
                        regime.type === 'negative' ? 'from-red-500 to-rose-500' :
                            'from-amber-500 to-orange-500'
                    } text-white flex items-center justify-between`}>
                    <h3 className="font-semibold text-sm flex items-center gap-2">
                        <ChartBarIcon className="w-4 h-4" />
                        GEX by Strike
                    </h3>
                    <span className="text-xs opacity-80">{regime.desc}</span>
                </div>

                <div className="p-4">
                    <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`}>
                        {/* Grid */}
                        <line x1={padding.left} y1={zeroY} x2={width - padding.right} y2={zeroY}
                            stroke="#9CA3AF" strokeWidth="1.5" />

                        {/* Positive zone label */}
                        <text x={padding.left - 5} y={padding.top + 20} textAnchor="end" className="fill-emerald-600 text-[9px]">
                            Stabilizing ↑
                        </text>

                        {/* Negative zone label */}
                        <text x={padding.left - 5} y={height - padding.bottom - 10} textAnchor="end" className="fill-red-600 text-[9px]">
                            Volatile ↓
                        </text>

                        {/* Bars */}
                        {visibleStrikes.map((s, i) => {
                            const barWidth = Math.max(8, chartW / visibleStrikes.length * 0.6);
                            const x = xScale(i) - barWidth / 2;
                            const barHeight = Math.abs(s.netGEX) / maxGEX * (chartH / 2);
                            const isPositive = s.netGEX >= 0;
                            const isATM = s.strike === atmStrike;
                            const isFlip = s.strike === gexData.flipLevel;

                            return (
                                <g key={i}>
                                    <rect
                                        x={x}
                                        y={isPositive ? zeroY - barHeight : zeroY}
                                        width={barWidth}
                                        height={barHeight}
                                        fill={isPositive ? '#10B981' : '#EF4444'}
                                        opacity={isATM ? 1 : 0.7}
                                        rx="2"
                                    />
                                    {isFlip && (
                                        <line x1={xScale(i)} y1={padding.top} x2={xScale(i)} y2={height - padding.bottom}
                                            stroke="#8B5CF6" strokeWidth="2" strokeDasharray="4" />
                                    )}
                                </g>
                            );
                        })}

                        {/* Spot price marker */}
                        {visibleStrikes.findIndex(s => s.strike >= spotPrice) >= 0 && (
                            <g>
                                <line
                                    x1={xScale(visibleStrikes.findIndex(s => s.strike >= spotPrice))}
                                    y1={padding.top}
                                    x2={xScale(visibleStrikes.findIndex(s => s.strike >= spotPrice))}
                                    y2={height - padding.bottom}
                                    stroke="#3B82F6" strokeWidth="2" strokeDasharray="6,3"
                                />
                                <text
                                    x={xScale(visibleStrikes.findIndex(s => s.strike >= spotPrice))}
                                    y={padding.top - 8}
                                    textAnchor="middle"
                                    className="fill-blue-600 text-[9px] font-bold"
                                >
                                    Spot
                                </text>
                            </g>
                        )}

                        {/* X-axis labels */}
                        {visibleStrikes.filter((_, i) => i % 2 === 0).map((s, i) => (
                            <text key={i} x={xScale(i * 2)} y={height - padding.bottom + 15} textAnchor="middle"
                                className={`text-[9px] ${s.strike === atmStrike ? 'fill-blue-600 font-bold' : 'fill-gray-500'}`}>
                                {s.strike}
                            </text>
                        ))}

                        {/* Y-axis labels */}
                        <text x={padding.left - 8} y={padding.top + 5} textAnchor="end" className="fill-emerald-600 text-[10px]">
                            +{maxGEX.toFixed(1)}
                        </text>
                        <text x={padding.left - 8} y={height - padding.bottom} textAnchor="end" className="fill-red-600 text-[10px]">
                            -{maxGEX.toFixed(1)}
                        </text>
                    </svg>

                    {/* Legend */}
                    <div className="flex items-center justify-center gap-6 mt-3 text-[10px]">
                        <span className="flex items-center gap-1.5">
                            <span className="w-3 h-3 rounded bg-emerald-500"></span>
                            Positive GEX (Calls)
                        </span>
                        <span className="flex items-center gap-1.5">
                            <span className="w-3 h-3 rounded bg-red-500"></span>
                            Negative GEX (Puts)
                        </span>
                        <span className="flex items-center gap-1.5">
                            <span className="w-4 h-0.5 bg-blue-500"></span>
                            Spot Price
                        </span>
                        <span className="flex items-center gap-1.5">
                            <span className="w-4 h-0.5 bg-purple-500" style={{ borderStyle: 'dashed' }}></span>
                            Gamma Flip
                        </span>
                    </div>
                </div>
            </div>

            {/* Interpretation */}
            <div className={`rounded-xl p-4 ${regime.type === 'positive' ? 'bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800' :
                    regime.type === 'negative' ? 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800' :
                        'bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800'
                }`}>
                <div className="flex items-start gap-3">
                    {regime.type === 'positive' ? (
                        <ArrowTrendingUpIcon className="w-5 h-5 text-emerald-600 mt-0.5" />
                    ) : regime.type === 'negative' ? (
                        <ArrowTrendingDownIcon className="w-5 h-5 text-red-600 mt-0.5" />
                    ) : (
                        <BoltIcon className="w-5 h-5 text-amber-600 mt-0.5" />
                    )}
                    <div>
                        <div className={`font-semibold text-sm ${regime.type === 'positive' ? 'text-emerald-700' :
                                regime.type === 'negative' ? 'text-red-700' : 'text-amber-700'
                            }`}>
                            {regime.type === 'positive' ? 'Mean Reversion Likely' :
                                regime.type === 'negative' ? 'Trend Continuation Likely' : 'Watch for Breakout'}
                        </div>
                        <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                            {regime.type === 'positive'
                                ? 'With positive GEX, expect price to consolidate and revert to mean. Sell volatility strategies may work well.'
                                : regime.type === 'negative'
                                    ? 'With negative GEX, expect trending moves and higher volatility. Breakout strategies may be favorable.'
                                    : 'Mixed GEX suggests uncertainty. Wait for clearer positioning before directional bets.'}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default GammaExposureChart;
