/**
 * Market Maker Positioning Analysis
 * Shows derived MM positioning based on GEX, OI, and Delta
 */
import { useMemo } from 'react';
import { useSelector } from 'react-redux';
import { selectOptionChain, selectSpotPrice, selectATMStrike, selectLotSize } from '../../context/selectors';
import {
    BuildingLibraryIcon, ArrowTrendingUpIcon, ArrowTrendingDownIcon,
    ShieldCheckIcon, ShieldExclamationIcon
} from '@heroicons/react/24/outline';

const MarketMakerPositioning = () => {
    const optionChain = useSelector(selectOptionChain);
    const spotPrice = useSelector(selectSpotPrice);
    const atmStrike = useSelector(selectATMStrike);
    const lotSize = useSelector(selectLotSize) || 50;

    const formatNumber = (num) => {
        if (!num) return '0';
        const abs = Math.abs(num);
        if (abs >= 1e7) return (num / 1e7).toFixed(2) + 'Cr';
        if (abs >= 1e5) return (num / 1e5).toFixed(2) + 'L';
        if (abs >= 1e3) return (num / 1e3).toFixed(1) + 'K';
        return num.toFixed(0);
    };

    // Calculate MM positioning
    const mmData = useMemo(() => {
        if (!optionChain || !spotPrice) return null;

        let totalGEX = 0;
        let netDelta = 0;
        let netGamma = 0;
        let netVega = 0;
        const levels = [];

        Object.entries(optionChain).forEach(([strikeKey, data]) => {
            const strike = parseFloat(strikeKey);

            const ceOI = data.ce?.oi || data.ce?.OI || 0;
            const peOI = data.pe?.oi || data.pe?.OI || 0;
            const ceDelta = data.ce?.optgeeks?.delta || data.ce?.delta || 0;
            const peDelta = data.pe?.optgeeks?.delta || data.pe?.delta || 0;
            const ceGamma = data.ce?.optgeeks?.gamma || data.ce?.gamma || 0;
            const peGamma = data.pe?.optgeeks?.gamma || data.pe?.gamma || 0;
            const ceVega = data.ce?.optgeeks?.vega || data.ce?.vega || 0;
            const peVega = data.pe?.optgeeks?.vega || data.pe?.vega || 0;

            // GEX calculation
            const multiplier = spotPrice * spotPrice * 0.01 * lotSize / 10000000;
            const callGEX = ceGamma * ceOI * multiplier;
            const putGEX = -peGamma * peOI * multiplier;
            const strikeGEX = callGEX + putGEX;
            totalGEX += strikeGEX;

            // Net Greeks (MM perspective - opposite of client)
            netDelta -= (ceDelta * ceOI + peDelta * peOI) * lotSize;
            netGamma -= (ceGamma * ceOI + peGamma * peOI) * lotSize;
            netVega -= (ceVega * ceOI + peVega * peOI) * lotSize;

            // MM hedging levels
            const totalOI = ceOI + peOI;
            if (totalOI > 0) {
                levels.push({
                    strike,
                    gex: strikeGEX,
                    callOI: ceOI,
                    putOI: peOI,
                    totalOI,
                    delta: (ceDelta * ceOI + peDelta * peOI) * lotSize,
                    isSupport: peOI > ceOI * 1.5, // More puts = support
                    isResistance: ceOI > peOI * 1.5 // More calls = resistance
                });
            }
        });

        levels.sort((a, b) => a.strike - b.strike);

        // Find key levels
        const supportLevels = levels.filter(l => l.isSupport && l.strike < spotPrice).sort((a, b) => b.strike - a.strike);
        const resistanceLevels = levels.filter(l => l.isResistance && l.strike > spotPrice).sort((a, b) => a.strike - b.strike);

        // Gamma flip level
        let cumulativeGEX = 0;
        let gammaFlip = null;
        for (const level of levels) {
            const prev = cumulativeGEX;
            cumulativeGEX += level.gex;
            if ((prev < 0 && cumulativeGEX >= 0) || (prev > 0 && cumulativeGEX <= 0)) {
                gammaFlip = level.strike;
            }
        }

        // MM hedging requirement
        const hedgeDirection = netDelta > 0 ? 'long' : netDelta < 0 ? 'short' : 'neutral';
        const hedgeSize = Math.abs(netDelta);

        return {
            totalGEX,
            netDelta,
            netGamma,
            netVega,
            gammaFlip,
            hedgeDirection,
            hedgeSize,
            supportLevels: supportLevels.slice(0, 3),
            resistanceLevels: resistanceLevels.slice(0, 3),
            levels
        };
    }, [optionChain, spotPrice, lotSize]);

    // Filter visible levels around ATM
    const visibleLevels = useMemo(() => {
        if (!mmData) return [];
        const atmIdx = mmData.levels.findIndex(l => l.strike >= atmStrike);
        const start = Math.max(0, atmIdx - 8);
        const end = Math.min(mmData.levels.length, atmIdx + 9);
        return mmData.levels.slice(start, end);
    }, [mmData, atmStrike]);

    if (!optionChain || !mmData) {
        return (
            <div className="p-8 text-center text-gray-400">
                <BuildingLibraryIcon className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>Load Option Chain data first</p>
            </div>
        );
    }

    const regime = mmData.totalGEX > 0.5 ? 'stabilizing' : mmData.totalGEX < -0.5 ? 'volatile' : 'neutral';

    return (
        <div className="space-y-4">
            {/* MM Summary */}
            <div className={`rounded-2xl p-6 bg-gradient-to-r ${regime === 'stabilizing' ? 'from-blue-500 to-indigo-600' :
                    regime === 'volatile' ? 'from-red-500 to-rose-600' :
                        'from-gray-500 to-gray-600'
                } text-white`}>
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                        <BuildingLibraryIcon className="w-8 h-8" />
                        <div>
                            <h2 className="text-xl font-bold">Market Maker Positioning</h2>
                            <div className="text-sm opacity-80">
                                {regime === 'stabilizing' ? 'MMs buying dips, selling rallies' :
                                    regime === 'volatile' ? 'MMs amplifying moves' : 'Mixed positioning'}
                            </div>
                        </div>
                    </div>
                    <div className="text-center">
                        <div className="text-3xl font-bold">{mmData.totalGEX.toFixed(2)} Cr</div>
                        <div className="text-xs opacity-80">Net GEX</div>
                    </div>
                </div>

                {/* Key Levels */}
                <div className="grid grid-cols-3 gap-3">
                    <div className="text-center p-3 bg-white/10 rounded-xl">
                        <div className="text-xs opacity-70">Gamma Flip</div>
                        <div className="text-xl font-bold">{mmData.gammaFlip || 'N/A'}</div>
                    </div>
                    <div className="text-center p-3 bg-white/10 rounded-xl">
                        <div className="text-xs opacity-70">Immediate Resistance</div>
                        <div className="text-xl font-bold">{mmData.resistanceLevels[0]?.strike || 'N/A'}</div>
                    </div>
                    <div className="text-center p-3 bg-white/10 rounded-xl">
                        <div className="text-xs opacity-70">Immediate Support</div>
                        <div className="text-xl font-bold">{mmData.supportLevels[0]?.strike || 'N/A'}</div>
                    </div>
                </div>
            </div>

            {/* MM Hedging Requirement */}
            <div className="grid grid-cols-3 gap-4">
                <div className={`rounded-xl p-4 ${mmData.hedgeDirection === 'long' ? 'bg-green-50 dark:bg-green-900/20 border border-green-200' :
                        mmData.hedgeDirection === 'short' ? 'bg-red-50 dark:bg-red-900/20 border border-red-200' :
                            'bg-gray-50 dark:bg-gray-700/50'
                    }`}>
                    <div className="text-xs text-gray-500 mb-1">MM Hedge Direction</div>
                    <div className={`text-xl font-bold flex items-center gap-2 ${mmData.hedgeDirection === 'long' ? 'text-green-600' :
                            mmData.hedgeDirection === 'short' ? 'text-red-600' : ''
                        }`}>
                        {mmData.hedgeDirection === 'long' ? <ArrowTrendingUpIcon className="w-5 h-5" /> :
                            mmData.hedgeDirection === 'short' ? <ArrowTrendingDownIcon className="w-5 h-5" /> : null}
                        {mmData.hedgeDirection.toUpperCase()}
                    </div>
                    <div className="text-[10px] text-gray-400">
                        {mmData.hedgeDirection === 'long' ? 'MMs need to buy underlying' :
                            mmData.hedgeDirection === 'short' ? 'MMs need to sell underlying' : 'Balanced'}
                    </div>
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
                    <div className="text-xs text-gray-500 mb-1">Net Delta</div>
                    <div className={`text-xl font-bold ${mmData.netDelta > 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {formatNumber(mmData.netDelta)}
                    </div>
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
                    <div className="text-xs text-gray-500 mb-1">Net Gamma</div>
                    <div className={`text-xl font-bold ${mmData.netGamma > 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {formatNumber(mmData.netGamma)}
                    </div>
                </div>
            </div>

            {/* Support & Resistance */}
            <div className="grid grid-cols-2 gap-4">
                {/* Support Levels */}
                <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                    <div className="px-4 py-2.5 bg-gradient-to-r from-green-500 to-emerald-500 text-white flex items-center gap-2">
                        <ShieldCheckIcon className="w-4 h-4" />
                        <span className="font-semibold text-sm">MM Support Levels</span>
                    </div>
                    <div className="p-3">
                        {mmData.supportLevels.length === 0 ? (
                            <div className="text-center py-4 text-gray-400 text-xs">No clear support levels</div>
                        ) : (
                            <div className="space-y-2">
                                {mmData.supportLevels.map((level, i) => (
                                    <div key={i} className="flex items-center justify-between p-2 bg-green-50 dark:bg-green-900/20 rounded-lg">
                                        <div className="flex items-center gap-2">
                                            <span className="w-6 h-6 rounded-full bg-green-500 text-white text-xs flex items-center justify-center font-bold">
                                                {i + 1}
                                            </span>
                                            <span className="font-bold">{level.strike}</span>
                                        </div>
                                        <div className="text-xs text-gray-500">
                                            PE: {formatNumber(level.putOI)}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Resistance Levels */}
                <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                    <div className="px-4 py-2.5 bg-gradient-to-r from-red-500 to-rose-500 text-white flex items-center gap-2">
                        <ShieldExclamationIcon className="w-4 h-4" />
                        <span className="font-semibold text-sm">MM Resistance Levels</span>
                    </div>
                    <div className="p-3">
                        {mmData.resistanceLevels.length === 0 ? (
                            <div className="text-center py-4 text-gray-400 text-xs">No clear resistance levels</div>
                        ) : (
                            <div className="space-y-2">
                                {mmData.resistanceLevels.map((level, i) => (
                                    <div key={i} className="flex items-center justify-between p-2 bg-red-50 dark:bg-red-900/20 rounded-lg">
                                        <div className="flex items-center gap-2">
                                            <span className="w-6 h-6 rounded-full bg-red-500 text-white text-xs flex items-center justify-center font-bold">
                                                {i + 1}
                                            </span>
                                            <span className="font-bold">{level.strike}</span>
                                        </div>
                                        <div className="text-xs text-gray-500">
                                            CE: {formatNumber(level.callOI)}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* GEX by Strike Chart */}
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                <div className="px-4 py-2.5 bg-gray-100 dark:bg-gray-700/50">
                    <h3 className="font-semibold text-sm">GEX by Strike (MM Hedging Zones)</h3>
                </div>
                <div className="p-4">
                    <div className="space-y-1">
                        {visibleLevels.map((level, i) => {
                            const isATM = level.strike === atmStrike;
                            const maxGex = Math.max(...visibleLevels.map(l => Math.abs(l.gex)), 0.01);
                            const barWidth = Math.min(100, (Math.abs(level.gex) / maxGex) * 100);
                            const isPositive = level.gex >= 0;

                            return (
                                <div key={i} className={`flex items-center gap-2 py-1 ${isATM ? 'bg-blue-50 dark:bg-blue-900/20 rounded-lg px-2' : ''}`}>
                                    <div className={`w-16 text-right font-bold text-xs ${isATM ? 'text-blue-600' : ''}`}>
                                        {level.strike}
                                        {level.isSupport && <span className="text-green-500 ml-1">S</span>}
                                        {level.isResistance && <span className="text-red-500 ml-1">R</span>}
                                    </div>
                                    <div className="flex-1 h-4 bg-gray-100 dark:bg-gray-700 rounded overflow-hidden flex items-center justify-center">
                                        {isPositive ? (
                                            <div className="w-full h-full flex justify-start">
                                                <div
                                                    className="h-full bg-blue-500 rounded"
                                                    style={{ width: `${barWidth / 2}%`, marginLeft: '50%' }}
                                                ></div>
                                            </div>
                                        ) : (
                                            <div className="w-full h-full flex justify-end">
                                                <div
                                                    className="h-full bg-red-500 rounded"
                                                    style={{ width: `${barWidth / 2}%`, marginRight: '50%' }}
                                                ></div>
                                            </div>
                                        )}
                                    </div>
                                    <div className={`w-12 text-right text-xs ${isPositive ? 'text-blue-600' : 'text-red-600'}`}>
                                        {level.gex.toFixed(2)}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* Interpretation */}
            <div className={`rounded-xl p-4 ${regime === 'stabilizing' ? 'bg-blue-50 dark:bg-blue-900/20' :
                    regime === 'volatile' ? 'bg-red-50 dark:bg-red-900/20' :
                        'bg-gray-50 dark:bg-gray-700/30'
                }`}>
                <div className="text-sm">
                    <strong>Market Maker Behavior:</strong>
                    <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                        {regime === 'stabilizing'
                            ? '🛡️ Positive GEX environment. MMs are net long gamma and will hedge by buying dips and selling rallies. Expect mean reversion and lower volatility. Range-bound strategies work best.'
                            : regime === 'volatile'
                                ? '⚠️ Negative GEX environment. MMs are net short gamma and will hedge by selling into declines and buying into rallies. Expect trending moves and higher volatility. Directional strategies may work well.'
                                : 'Mixed GEX positioning. MMs have balanced exposure. Watch for breakout direction based on other indicators.'}
                    </p>
                </div>
            </div>
        </div>
    );
};

export default MarketMakerPositioning;
