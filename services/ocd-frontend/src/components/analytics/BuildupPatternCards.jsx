/**
 * Buildup Pattern Cards
 * Visual cards showing Long/Short Buildup, Short Covering, Long Unwinding patterns
 */
import { useMemo } from 'react';
import { useSelector } from 'react-redux';
import { selectOptionChain, selectSpotPrice, selectATMStrike } from '../../context/selectors';
import {
    ArrowTrendingUpIcon, ArrowTrendingDownIcon,
    ArrowPathIcon, MinusIcon
} from '@heroicons/react/24/outline';

const BuildupPatternCards = () => {
    const optionChain = useSelector(selectOptionChain);
    const spotPrice = useSelector(selectSpotPrice);
    const atmStrike = useSelector(selectATMStrike);

    const formatNumber = (num) => {
        if (!num) return '0';
        const abs = Math.abs(num);
        if (abs >= 1e7) return (num / 1e7).toFixed(2) + 'Cr';
        if (abs >= 1e5) return (num / 1e5).toFixed(2) + 'L';
        if (abs >= 1e3) return (num / 1e3).toFixed(1) + 'K';
        return num.toFixed(0);
    };

    // Analyze buildup patterns
    const patterns = useMemo(() => {
        if (!optionChain) return null;

        const buildups = {
            longBuildup: [],    // OI↑ + Price↑ (Bullish)
            shortBuildup: [],   // OI↑ + Price↓ (Bearish)
            shortCovering: [],  // OI↓ + Price↑ (Bullish reversal)
            longUnwinding: []   // OI↓ + Price↓ (Bearish reversal)
        };

        let totalCEOIChg = 0;
        let totalPEOIChg = 0;

        Object.entries(optionChain).forEach(([strikeKey, data]) => {
            const strike = parseFloat(strikeKey);

            ['ce', 'pe'].forEach(type => {
                const leg = data[type];
                if (!leg) return;

                const oiChg = leg.oichng || leg.oi_change || 0;
                const pChg = leg.p_chng || 0;
                const ltp = leg.ltp || 0;
                const oi = leg.oi || leg.OI || 0;
                const btyp = leg.btyp || leg.BuiltupName || '';

                if (type === 'ce') totalCEOIChg += oiChg;
                else totalPEOIChg += oiChg;

                if (Math.abs(oiChg) < 100) return; // Filter noise

                const item = {
                    strike,
                    type: type.toUpperCase(),
                    oiChg,
                    pChg,
                    pChgPct: ltp > 0 ? (pChg / ltp * 100) : 0,
                    ltp,
                    oi,
                    btyp
                };

                // Classify buildup
                if (oiChg > 0 && pChg > 0) buildups.longBuildup.push(item);
                else if (oiChg > 0 && pChg < 0) buildups.shortBuildup.push(item);
                else if (oiChg < 0 && pChg > 0) buildups.shortCovering.push(item);
                else if (oiChg < 0 && pChg < 0) buildups.longUnwinding.push(item);
            });
        });

        // Sort each by absolute OI change
        Object.keys(buildups).forEach(key => {
            buildups[key].sort((a, b) => Math.abs(b.oiChg) - Math.abs(a.oiChg));
        });

        // Overall sentiment
        const bullishCount = buildups.longBuildup.length + buildups.shortCovering.length;
        const bearishCount = buildups.shortBuildup.length + buildups.longUnwinding.length;
        const sentiment = bullishCount > bearishCount * 1.2 ? 'bullish' :
            bearishCount > bullishCount * 1.2 ? 'bearish' : 'neutral';

        return { ...buildups, sentiment, totalCEOIChg, totalPEOIChg };
    }, [optionChain]);

    if (!optionChain || !patterns) {
        return (
            <div className="p-8 text-center text-gray-400">
                <ArrowPathIcon className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>Load Option Chain data first</p>
            </div>
        );
    }

    const patternCards = [
        {
            id: 'longBuildup',
            title: 'Long Buildup',
            subtitle: 'OI↑ + Price↑',
            color: 'emerald',
            gradient: 'from-emerald-500 to-green-600',
            icon: ArrowTrendingUpIcon,
            signal: '🐂 Bullish',
            description: 'Fresh buying - Expect continuation',
            data: patterns.longBuildup
        },
        {
            id: 'shortBuildup',
            title: 'Short Buildup',
            subtitle: 'OI↑ + Price↓',
            color: 'red',
            gradient: 'from-red-500 to-rose-600',
            icon: ArrowTrendingDownIcon,
            signal: '🐻 Bearish',
            description: 'Fresh selling - Expect decline',
            data: patterns.shortBuildup
        },
        {
            id: 'shortCovering',
            title: 'Short Covering',
            subtitle: 'OI↓ + Price↑',
            color: 'blue',
            gradient: 'from-blue-500 to-indigo-600',
            icon: ArrowPathIcon,
            signal: '🐂 Bullish Reversal',
            description: 'Shorts exiting - Bounce likely',
            data: patterns.shortCovering
        },
        {
            id: 'longUnwinding',
            title: 'Long Unwinding',
            subtitle: 'OI↓ + Price↓',
            color: 'amber',
            gradient: 'from-amber-500 to-orange-600',
            icon: MinusIcon,
            signal: '🐻 Bearish Reversal',
            description: 'Longs exiting - Weakness likely',
            data: patterns.longUnwinding
        }
    ];

    return (
        <div className="space-y-4">
            {/* Overall Sentiment */}
            <div className={`rounded-xl p-4 text-center ${patterns.sentiment === 'bullish' ? 'bg-gradient-to-r from-green-500 to-emerald-600 text-white' :
                    patterns.sentiment === 'bearish' ? 'bg-gradient-to-r from-red-500 to-rose-600 text-white' :
                        'bg-gradient-to-r from-gray-400 to-gray-500 text-white'
                }`}>
                <div className="text-xs opacity-80 mb-1">Overall Market Buildup</div>
                <div className="text-2xl font-bold">
                    {patterns.sentiment === 'bullish' ? '🐂 BULLISH' :
                        patterns.sentiment === 'bearish' ? '🐻 BEARISH' : '⚖️ NEUTRAL'}
                </div>
                <div className="text-xs opacity-80 mt-1">
                    Based on {patterns.longBuildup.length + patterns.shortBuildup.length + patterns.shortCovering.length + patterns.longUnwinding.length} contracts analyzed
                </div>
            </div>

            {/* Pattern Cards Grid */}
            <div className="grid grid-cols-2 gap-4">
                {patternCards.map(card => {
                    const Icon = card.icon;
                    return (
                        <div key={card.id} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                            <div className={`px-4 py-3 bg-gradient-to-r ${card.gradient} text-white`}>
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <Icon className="w-5 h-5" />
                                        <div>
                                            <div className="font-bold text-sm">{card.title}</div>
                                            <div className="text-[10px] opacity-80">{card.subtitle}</div>
                                        </div>
                                    </div>
                                    <div className="px-2 py-1 bg-white/20 rounded text-xs font-bold">
                                        {card.data.length}
                                    </div>
                                </div>
                            </div>

                            <div className="p-3">
                                <div className="text-xs text-gray-500 mb-2">{card.signal}</div>

                                {card.data.length === 0 ? (
                                    <div className="text-center py-3 text-gray-400 text-xs">No contracts</div>
                                ) : (
                                    <div className="space-y-1.5 max-h-48 overflow-y-auto">
                                        {card.data.slice(0, 5).map((item, i) => (
                                            <div key={i} className="flex items-center justify-between text-xs p-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                                                <div className="flex items-center gap-2">
                                                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${item.type === 'CE' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                                                        }`}>{item.type}</span>
                                                    <span className="font-bold">{item.strike}</span>
                                                </div>
                                                <div className="text-right">
                                                    <div className={item.oiChg > 0 ? 'text-green-600' : 'text-red-600'}>
                                                        {item.oiChg > 0 ? '+' : ''}{formatNumber(item.oiChg)}
                                                    </div>
                                                    <div className={`text-[10px] ${item.pChgPct > 0 ? 'text-green-500' : 'text-red-500'}`}>
                                                        {item.pChgPct > 0 ? '+' : ''}{item.pChgPct.toFixed(1)}%
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                        {card.data.length > 5 && (
                                            <div className="text-center text-[10px] text-gray-400">+{card.data.length - 5} more</div>
                                        )}
                                    </div>
                                )}

                                <div className="text-[10px] text-gray-400 mt-2 pt-2 border-t border-gray-100 dark:border-gray-700">
                                    {card.description}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* OI Change Summary */}
            <div className="grid grid-cols-2 gap-4">
                <div className={`rounded-xl p-4 ${patterns.totalCEOIChg > 0 ? 'bg-green-50 dark:bg-green-900/20' : 'bg-red-50 dark:bg-red-900/20'}`}>
                    <div className="text-xs text-gray-500 mb-1">Total Call OI Change</div>
                    <div className={`text-xl font-bold ${patterns.totalCEOIChg > 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {patterns.totalCEOIChg > 0 ? '+' : ''}{formatNumber(patterns.totalCEOIChg)}
                    </div>
                    <div className="text-[10px] text-gray-400">
                        {patterns.totalCEOIChg > 0 ? 'Call writing / Long buildup' : 'Call unwinding'}
                    </div>
                </div>
                <div className={`rounded-xl p-4 ${patterns.totalPEOIChg > 0 ? 'bg-red-50 dark:bg-red-900/20' : 'bg-green-50 dark:bg-green-900/20'}`}>
                    <div className="text-xs text-gray-500 mb-1">Total Put OI Change</div>
                    <div className={`text-xl font-bold ${patterns.totalPEOIChg > 0 ? 'text-red-600' : 'text-green-600'}`}>
                        {patterns.totalPEOIChg > 0 ? '+' : ''}{formatNumber(patterns.totalPEOIChg)}
                    </div>
                    <div className="text-[10px] text-gray-400">
                        {patterns.totalPEOIChg > 0 ? 'Put writing / Long buildup' : 'Put unwinding'}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default BuildupPatternCards;
