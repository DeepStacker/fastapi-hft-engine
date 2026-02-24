import React from 'react';
import { motion } from 'framer-motion';
import {
    CpuChipIcon,
    ArrowTrendingUpIcon,
    ArrowTrendingDownIcon
} from '@heroicons/react/24/outline';

const formatNumber = (num) => {
    if (!num) return '0';
    const abs = Math.abs(num);
    if (abs >= 1e7) return (num / 1e7).toFixed(2) + 'Cr';
    if (abs >= 1e5) return (num / 1e5).toFixed(2) + 'L';
    if (abs >= 1e3) return (num / 1e3).toFixed(1) + 'K';
    return num.toFixed(0);
};

const BuildupSummaryCard = ({ summary, marketState, insights, isDark }) => {
    if (!summary || !marketState || !insights) return null;

    const getSentimentColor = (score) => {
        if (score >= 65) return 'from-emerald-500 to-green-500';
        if (score >= 52) return 'from-teal-500 to-emerald-500';
        if (score <= 35) return 'from-red-500 to-rose-500';
        if (score <= 48) return 'from-orange-500 to-red-500';
        return 'from-gray-500 to-slate-500';
    };

    return (
        <div className="flex flex-col h-full">
            {/* Header */}
            <div className={`px-6 py-4 bg-gradient-to-r ${getSentimentColor(summary.sentimentScore)} text-white`}>
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-xl font-bold flex items-center gap-2">
                            <CpuChipIcon className="w-6 h-6" />
                            Buildup Analysis v4
                            {summary.clusterCount > 0 && (
                                <span className="text-[10px] bg-indigo-500 text-white px-2 py-0.5 rounded-full uppercase tracking-wider shadow-lg animate-pulse">
                                    High Precision
                                </span>
                            )}
                        </h2>
                        <p className="text-sm opacity-80">Greeks + Data Mining + Statistical Analysis</p>
                    </div>
                    <div className="text-right">
                        <div className="text-3xl font-bold flex items-center gap-2 justify-end">
                            <span>{summary.sentimentEmoji}</span>
                            <span>{summary.sentiment}</span>
                        </div>
                        <div className="text-sm opacity-80">
                            Score: {summary.sentimentScore.toFixed(0)}%
                        </div>
                    </div>
                </div>

                {/* Sentiment Bar */}
                <div className="mt-4">
                    <div className="h-4 bg-white/20 rounded-full overflow-hidden relative">
                        <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${summary.sentimentScore}%` }}
                            transition={{ duration: 0.7 }}
                            className="h-full bg-white/80 rounded-full"
                        />
                        <div className="absolute top-0 left-1/2 -translate-x-1/2 h-full w-0.5 bg-white/50" />
                    </div>
                    <div className="flex justify-between text-xs mt-1 opacity-70">
                        <span>🔴 Bearish</span>
                        <span>50</span>
                        <span>Bullish 🟢</span>
                    </div>
                </div>

                {/* Quick Stats Grid */}
                <div className="grid grid-cols-5 gap-2 mt-3 text-xs">
                    <div className="text-center p-2 bg-white/10 rounded-lg">
                        <div className="font-bold">{summary.bullishContracts}/{summary.bearishContracts}</div>
                        <div className="opacity-70">Bull/Bear</div>
                    </div>
                    <div className="text-center p-2 bg-white/10 rounded-lg">
                        <div className="font-bold">{summary.institutionalCount}</div>
                        <div className="opacity-70">Institutional</div>
                    </div>
                    <div className={`text-center p-2 rounded-lg ${summary.clusterCount > 0 ? 'bg-indigo-500/20 ring-1 ring-indigo-500/50' : 'bg-white/10'}`}>
                        <div className={`font-bold ${summary.clusterCount > 0 ? 'text-indigo-400' : ''}`}>{summary.clusterCount}</div>
                        <div className="opacity-70">Clusters</div>
                    </div>
                    <div className="text-center p-2 bg-white/10 rounded-lg">
                        <div className="font-bold">{marketState.pcr?.toFixed(2) || 'N/A'}</div>
                        <div className="opacity-70">PCR</div>
                    </div>
                    <div className="text-center p-2 bg-white/10 rounded-lg">
                        <div className="font-bold">{marketState.atmIV?.toFixed(1) || 'N/A'}%</div>
                        <div className="opacity-70">ATM IV</div>
                    </div>
                </div>
            </div>

            {/* Market State Panel */}
            <div className={`grid grid-cols-3 gap-2 p-3 ${isDark ? 'bg-slate-800/50' : 'bg-gray-50'} text-xs border-b ${isDark ? 'border-slate-700' : 'border-gray-200'}`}>
                <div className="text-center">
                    <span className="text-gray-500">Resistance:</span>{' '}
                    <span className="font-bold text-red-600">{insights.keyLevels.resistance?.strike}</span>
                    <span className="text-gray-400 ml-1">({formatNumber(insights.keyLevels.resistance?.oi)})</span>
                </div>
                <div className="text-center">
                    <span className="text-gray-500">Gamma:</span>{' '}
                    <span className={`font-bold ${marketState.netGEX > 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {marketState.gammaRegime}
                    </span>
                </div>
                <div className="text-center">
                    <span className="text-gray-500">Support:</span>{' '}
                    <span className="font-bold text-green-600">{insights.keyLevels.support?.strike}</span>
                    <span className="text-gray-400 ml-1">({formatNumber(insights.keyLevels.support?.oi)})</span>
                </div>
            </div>

            {/* Insights Panel */}
            <div className={`grid grid-cols-2 gap-4 p-4 ${isDark ? 'bg-slate-800/30' : 'bg-white'} flex-grow`}>
                <div>
                    <h4 className="text-xs font-bold text-green-600 mb-2 flex items-center gap-1">
                        <ArrowTrendingUpIcon className="w-4 h-4" /> Bullish Factors
                    </h4>
                    {insights.bullishFactors.length === 0 ? (
                        <div className="text-xs text-gray-400 italic">No bullish signals detected</div>
                    ) : (
                        <div className="space-y-1">
                            {insights.bullishFactors.slice(0, 3).map((f, i) => (
                                <div key={i} className="text-xs p-2 bg-green-50 dark:bg-green-900/20 rounded">
                                    <div className="flex justify-between">
                                        <span className="font-medium text-green-700 dark:text-green-400">{f.factor}</span>
                                        <span className="text-green-600">{f.confidence.toFixed(0)}%</span>
                                    </div>
                                    <div className="text-gray-500 text-[10px] truncate">{f.description}</div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
                <div>
                    <h4 className="text-xs font-bold text-red-600 mb-2 flex items-center gap-1">
                        <ArrowTrendingDownIcon className="w-4 h-4" /> Bearish Factors
                    </h4>
                    {insights.bearishFactors.length === 0 ? (
                        <div className="text-xs text-gray-400 italic">No bearish signals detected</div>
                    ) : (
                        <div className="space-y-1">
                            {insights.bearishFactors.slice(0, 3).map((f, i) => (
                                <div key={i} className="text-xs p-2 bg-red-50 dark:bg-red-900/20 rounded">
                                    <div className="flex justify-between">
                                        <span className="font-medium text-red-700 dark:text-red-400">{f.factor}</span>
                                        <span className="text-red-600">{f.confidence.toFixed(0)}%</span>
                                    </div>
                                    <div className="text-gray-500 text-[10px] truncate">{f.description}</div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default BuildupSummaryCard;
