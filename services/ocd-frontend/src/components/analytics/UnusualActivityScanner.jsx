/**
 * Unusual OI Activity Scanner
 * Detects strikes with abnormal OI changes indicating smart money moves
 */
import { useMemo, useState } from 'react';
import { useSelector } from 'react-redux';
import { selectOptionChain, selectSpotPrice, selectATMStrike } from '../../context/selectors';
import {
    ExclamationTriangleIcon, EyeIcon, ArrowTrendingUpIcon,
    ArrowTrendingDownIcon, BoltIcon, FunnelIcon
} from '@heroicons/react/24/outline';

const UnusualActivityScanner = () => {
    const optionChain = useSelector(selectOptionChain);
    const spotPrice = useSelector(selectSpotPrice);
    const atmStrike = useSelector(selectATMStrike);

    const [filter, setFilter] = useState('all'); // 'all', 'calls', 'puts', 'bullish', 'bearish'
    const [minScore, setMinScore] = useState(50);

    // Format large numbers
    const formatNumber = (num) => {
        if (!num) return '0';
        const abs = Math.abs(num);
        if (abs >= 1e7) return (num / 1e7).toFixed(2) + 'Cr';
        if (abs >= 1e5) return (num / 1e5).toFixed(2) + 'L';
        if (abs >= 1e3) return (num / 1e3).toFixed(1) + 'K';
        return num.toFixed(0);
    };

    // Calculate unusual activity scores
    const unusualActivity = useMemo(() => {
        if (!optionChain) return [];

        const allContracts = [];

        // Collect all CE and PE data
        Object.entries(optionChain).forEach(([strikeKey, data]) => {
            const strike = parseFloat(strikeKey);

            ['ce', 'pe'].forEach(type => {
                const leg = data[type];
                if (!leg) return;

                const oi = leg.oi || leg.OI || 0;
                const oiChg = leg.oichng || leg.oi_change || 0;
                const vol = leg.vol || leg.volume || 0;
                const ltp = leg.ltp || 0;
                const pChg = leg.p_chng || 0;
                const iv = leg.iv || 0;

                if (oi === 0 && vol === 0) return;

                allContracts.push({
                    strike,
                    type: type.toUpperCase(),
                    oi,
                    oiChg,
                    oiChgPct: oi > 0 ? (oiChg / oi * 100) : 0,
                    vol,
                    volOIRatio: oi > 0 ? (vol / oi * 100) : 0,
                    ltp,
                    pChg,
                    pChgPct: ltp > 0 ? (pChg / ltp * 100) : 0,
                    iv,
                    premium: vol * ltp, // Total premium traded
                });
            });
        });

        // Calculate statistics for z-scores
        const oiChanges = allContracts.map(c => Math.abs(c.oiChg)).filter(v => v > 0);
        const volumes = allContracts.map(c => c.vol).filter(v => v > 0);
        const volOIRatios = allContracts.map(c => c.volOIRatio).filter(v => v > 0);

        const mean = arr => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
        const stdDev = arr => {
            const m = mean(arr);
            return Math.sqrt(arr.reduce((acc, v) => acc + (v - m) ** 2, 0) / arr.length) || 1;
        };

        const oiMean = mean(oiChanges);
        const oiStd = stdDev(oiChanges);
        const volMean = mean(volumes);
        const volStd = stdDev(volumes);
        const ratioMean = mean(volOIRatios);
        const ratioStd = stdDev(volOIRatios);

        // Calculate unusual activity score (0-100)
        const scored = allContracts.map(c => {
            const oiZScore = oiStd > 0 ? Math.abs(c.oiChg - oiMean) / oiStd : 0;
            const volZScore = volStd > 0 ? (c.vol - volMean) / volStd : 0;
            const ratioZScore = ratioStd > 0 ? (c.volOIRatio - ratioMean) / ratioStd : 0;

            // Combined score (weighted)
            const rawScore = (oiZScore * 0.4 + volZScore * 0.35 + ratioZScore * 0.25);
            const score = Math.min(100, Math.max(0, rawScore * 25)); // Scale to 0-100

            // Determine signal
            let signal = 'neutral';
            if (c.type === 'CE') {
                if (c.oiChg > 0 && c.pChg > 0) signal = 'bullish'; // Long buildup
                else if (c.oiChg > 0 && c.pChg < 0) signal = 'bearish'; // Short buildup
                else if (c.oiChg < 0 && c.pChg > 0) signal = 'bullish'; // Short covering
                else if (c.oiChg < 0 && c.pChg < 0) signal = 'bearish'; // Long unwinding
            } else {
                if (c.oiChg > 0 && c.pChg > 0) signal = 'bearish';
                else if (c.oiChg > 0 && c.pChg < 0) signal = 'bullish';
                else if (c.oiChg < 0 && c.pChg > 0) signal = 'bearish';
                else if (c.oiChg < 0 && c.pChg < 0) signal = 'bullish';
            }

            return { ...c, score, signal, oiZScore, volZScore };
        });

        // Sort by score descending
        return scored.sort((a, b) => b.score - a.score);
    }, [optionChain]);

    // Filter data
    const filteredData = useMemo(() => {
        return unusualActivity.filter(item => {
            if (item.score < minScore) return false;
            if (filter === 'calls' && item.type !== 'CE') return false;
            if (filter === 'puts' && item.type !== 'PE') return false;
            if (filter === 'bullish' && item.signal !== 'bullish') return false;
            if (filter === 'bearish' && item.signal !== 'bearish') return false;
            return true;
        }).slice(0, 20); // Top 20
    }, [unusualActivity, filter, minScore]);

    // Summary stats
    const summary = useMemo(() => {
        const highActivity = unusualActivity.filter(a => a.score >= 70);
        return {
            total: unusualActivity.length,
            high: highActivity.length,
            bullish: highActivity.filter(a => a.signal === 'bullish').length,
            bearish: highActivity.filter(a => a.signal === 'bearish').length
        };
    }, [unusualActivity]);

    if (!optionChain) {
        return (
            <div className="p-8 text-center text-gray-400">
                <EyeIcon className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>Load Option Chain data first</p>
            </div>
        );
    }

    const getScoreColor = (score) => {
        if (score >= 80) return 'bg-red-500';
        if (score >= 60) return 'bg-orange-500';
        if (score >= 40) return 'bg-amber-500';
        return 'bg-gray-400';
    };

    const getSignalBadge = (signal) => {
        switch (signal) {
            case 'bullish':
                return <span className="px-1.5 py-0.5 bg-green-100 dark:bg-green-900/50 text-green-700 text-[9px] rounded font-bold flex items-center gap-0.5">
                    <ArrowTrendingUpIcon className="w-3 h-3" /> BULL
                </span>;
            case 'bearish':
                return <span className="px-1.5 py-0.5 bg-red-100 dark:bg-red-900/50 text-red-700 text-[9px] rounded font-bold flex items-center gap-0.5">
                    <ArrowTrendingDownIcon className="w-3 h-3" /> BEAR
                </span>;
            default:
                return <span className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-600 text-[9px] rounded font-bold">NEUT</span>;
        }
    };

    return (
        <div className="space-y-4">
            {/* Summary Cards */}
            <div className="grid grid-cols-4 gap-3">
                <div className="bg-gradient-to-br from-purple-500 to-indigo-600 rounded-xl p-4 text-white">
                    <div className="text-xs opacity-80 mb-1">High Activity Alerts</div>
                    <div className="text-2xl font-bold">{summary.high}</div>
                    <div className="text-[10px] opacity-70">Score ≥ 70</div>
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
                    <div className="text-[10px] text-gray-500 mb-1">Bullish Signals</div>
                    <div className="text-xl font-bold text-green-600">{summary.bullish}</div>
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
                    <div className="text-[10px] text-gray-500 mb-1">Bearish Signals</div>
                    <div className="text-xl font-bold text-red-600">{summary.bearish}</div>
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
                    <div className="text-[10px] text-gray-500 mb-1">Total Scanned</div>
                    <div className="text-xl font-bold text-gray-900 dark:text-white">{summary.total}</div>
                </div>
            </div>

            {/* Filters */}
            <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-1 p-1 bg-gray-100 dark:bg-gray-800 rounded-lg">
                    {[
                        { id: 'all', label: 'All' },
                        { id: 'calls', label: 'Calls' },
                        { id: 'puts', label: 'Puts' },
                        { id: 'bullish', label: '🐂 Bullish' },
                        { id: 'bearish', label: '🐻 Bearish' }
                    ].map(f => (
                        <button
                            key={f.id}
                            onClick={() => setFilter(f.id)}
                            className={`px-3 py-1.5 text-xs font-medium rounded-md transition ${filter === f.id
                                    ? 'bg-blue-500 text-white'
                                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                                }`}
                        >
                            {f.label}
                        </button>
                    ))}
                </div>

                <div className="flex items-center gap-2">
                    <FunnelIcon className="w-4 h-4 text-gray-400" />
                    <span className="text-xs text-gray-500">Min Score:</span>
                    <input
                        type="range"
                        min={0}
                        max={80}
                        step={10}
                        value={minScore}
                        onChange={(e) => setMinScore(parseInt(e.target.value))}
                        className="w-20 h-1.5 accent-blue-500"
                    />
                    <span className="text-xs font-bold text-blue-600 w-8">{minScore}+</span>
                </div>
            </div>

            {/* Activity Table */}
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                <div className="px-4 py-2.5 bg-gradient-to-r from-purple-500 to-indigo-500 text-white flex items-center gap-2">
                    <ExclamationTriangleIcon className="w-4 h-4" />
                    <span className="font-semibold text-sm">Unusual Options Activity</span>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                        <thead className="bg-gray-50 dark:bg-gray-700/50">
                            <tr>
                                <th className="py-2 px-3 text-left font-medium text-gray-500">Score</th>
                                <th className="py-2 px-3 text-left font-medium text-gray-500">Strike</th>
                                <th className="py-2 px-3 text-center font-medium text-gray-500">Type</th>
                                <th className="py-2 px-3 text-right font-medium text-gray-500">OI Change</th>
                                <th className="py-2 px-3 text-right font-medium text-gray-500">Volume</th>
                                <th className="py-2 px-3 text-right font-medium text-gray-500">Vol/OI%</th>
                                <th className="py-2 px-3 text-right font-medium text-gray-500">LTP</th>
                                <th className="py-2 px-3 text-right font-medium text-gray-500">Chg%</th>
                                <th className="py-2 px-3 text-center font-medium text-gray-500">Signal</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                            {filteredData.length === 0 ? (
                                <tr><td colSpan={9} className="py-8 text-center text-gray-400">No unusual activity detected</td></tr>
                            ) : (
                                filteredData.map((item, i) => (
                                    <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                                        <td className="py-2 px-3">
                                            <div className="flex items-center gap-2">
                                                <div className={`w-8 h-2 rounded-full ${getScoreColor(item.score)}`}
                                                    style={{ width: `${item.score}%`, maxWidth: '32px' }}></div>
                                                <span className="font-bold">{item.score.toFixed(0)}</span>
                                            </div>
                                        </td>
                                        <td className="py-2 px-3 font-bold">{item.strike}</td>
                                        <td className="py-2 px-3 text-center">
                                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${item.type === 'CE' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                                                }`}>{item.type}</span>
                                        </td>
                                        <td className={`py-2 px-3 text-right font-medium ${item.oiChg > 0 ? 'text-green-600' : 'text-red-600'
                                            }`}>
                                            {item.oiChg > 0 ? '+' : ''}{formatNumber(item.oiChg)}
                                            <span className="text-gray-400 ml-1">({item.oiChgPct.toFixed(1)}%)</span>
                                        </td>
                                        <td className="py-2 px-3 text-right font-medium">{formatNumber(item.vol)}</td>
                                        <td className="py-2 px-3 text-right">
                                            <span className={`${item.volOIRatio > 50 ? 'text-orange-600 font-bold' : 'text-gray-600'}`}>
                                                {item.volOIRatio.toFixed(1)}%
                                            </span>
                                        </td>
                                        <td className="py-2 px-3 text-right font-medium">₹{item.ltp.toFixed(2)}</td>
                                        <td className={`py-2 px-3 text-right font-medium ${item.pChgPct > 0 ? 'text-green-600' : 'text-red-600'
                                            }`}>
                                            {item.pChgPct > 0 ? '+' : ''}{item.pChgPct.toFixed(1)}%
                                        </td>
                                        <td className="py-2 px-3 text-center">{getSignalBadge(item.signal)}</td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Legend */}
                <div className="px-4 py-2 bg-gray-50 dark:bg-gray-700/30 border-t border-gray-100 dark:border-gray-700">
                    <div className="flex items-center justify-center gap-4 text-[10px] text-gray-500">
                        <span>Score = OI Change + Volume + Vol/OI weighted</span>
                        <span>|</span>
                        <span className="flex items-center gap-1"><span className="w-2 h-2 bg-red-500 rounded"></span> ≥80 Extreme</span>
                        <span className="flex items-center gap-1"><span className="w-2 h-2 bg-orange-500 rounded"></span> ≥60 High</span>
                        <span className="flex items-center gap-1"><span className="w-2 h-2 bg-amber-500 rounded"></span> ≥40 Moderate</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default UnusualActivityScanner;
