
import { useState, useMemo } from "react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from "chart.js";
import { Line } from "react-chartjs-2";
import { motion } from "framer-motion";
import * as mlPredictions from '../../utils/mlPredictions';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

const TradeAnalysis = ({ results, theme }) => {
    const [selectedMetric, setSelectedMetric] = useState('basic');
    const [selectedTimeframe, setSelectedTimeframe] = useState('all');
    const [showAdvancedStats, setShowAdvancedStats] = useState(false);
    const [selectedPattern, setSelectedPattern] = useState('all');
    const [predictiveRange, setPredictiveRange] = useState(5);
    const [chartStyle, setChartStyle] = useState('modern');

    // Basic Trading Statistics
    const basicStats = useMemo(() => {
        if (!results) return null;

        const profitDays = results.netProfitLossValues.filter(val => val > 0);
        const lossDays = results.netProfitLossValues.filter(val => val < 0);
        
        let currentStreak = 0;
        let maxWinStreak = 0;
        let maxLossStreak = 0;
        let currentStreakType = null;
        
        results.netProfitLossValues.forEach(val => {
            const isProfit = val > 0;
            
            if (currentStreakType === null) {
                currentStreakType = isProfit;
                currentStreak = 1;
            } else if (currentStreakType === isProfit) {
                currentStreak++;
            } else {
                if (currentStreakType) {
                    maxWinStreak = Math.max(maxWinStreak, currentStreak);
                } else {
                    maxLossStreak = Math.max(maxLossStreak, currentStreak);
                }
                currentStreakType = isProfit;
                currentStreak = 1;
            }
        });

        // Update streaks one last time
        if (currentStreakType) {
            maxWinStreak = Math.max(maxWinStreak, currentStreak);
        } else {
            maxLossStreak = Math.max(maxLossStreak, currentStreak);
        }

        return {
            avgDailyProfit: profitDays.reduce((a, b) => a + b, 0) / profitDays.length,
            avgDailyLoss: Math.abs(lossDays.reduce((a, b) => a + b, 0) / lossDays.length),
            maxWinStreak,
            maxLossStreak,
            currentStreak,
            currentStreakType,
            profitDaysCount: profitDays.length,
            lossDaysCount: lossDays.length,
            maxDailyProfit: Math.max(...results.netProfitLossValues),
            maxDailyLoss: Math.min(...results.netProfitLossValues),
            avgTradeSize: results.netProfitLossValues.reduce((a, b) => a + Math.abs(b), 0) / results.netProfitLossValues.length,
            profitFactor: Math.abs(profitDays.reduce((a, b) => a + b, 0) / lossDays.reduce((a, b) => a + b, 0))
        };
    }, [results]);

    // ML-based Predictions
    const mlPredictionsData = useMemo(() => {
        if (!results) return null;

        const prices = results.netProfitLossValues;
        const bollingerBands = mlPredictions.calculateBollingerBands(prices);
        const macd = mlPredictions.calculateMACD(prices);
        const { forecast, confidence } = mlPredictions.linearRegressionForecast(prices, predictiveRange);
        const supportResistance = mlPredictions.findSupportResistance(prices);
        const patterns = mlPredictions.recognizePatterns(prices);

        return {
            bollingerBands,
            macd,
            forecast,
            confidence,
            supportResistance,
            patterns
        };
    }, [results, predictiveRange]);

    // Chart Customization Options
    const chartThemes = {
        modern: {
            backgroundColor: theme === 'dark' ? 'rgba(17, 24, 39, 0.8)' : 'rgba(255, 255, 255, 0.8)',
            borderColor: theme === 'dark' ? '#60A5FA' : '#3B82F6',
            gridColor: theme === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
            textColor: theme === 'dark' ? '#E5E7EB' : '#4B5563'
        },
        classic: {
            backgroundColor: theme === 'dark' ? 'rgba(45, 55, 72, 0.8)' : 'rgba(247, 250, 252, 0.8)',
            borderColor: theme === 'dark' ? '#48BB78' : '#38A169',
            gridColor: theme === 'dark' ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)',
            textColor: theme === 'dark' ? '#CBD5E0' : '#2D3748'
        },
        minimal: {
            backgroundColor: 'transparent',
            borderColor: theme === 'dark' ? '#A0AEC0' : '#718096',
            gridColor: theme === 'dark' ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.03)',
            textColor: theme === 'dark' ? '#A0AEC0' : '#718096'
        }
    };

    // Enhanced Chart Options
    const chartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                labels: {
                    color: chartThemes[chartStyle].textColor,
                    font: {
                        family: 'Inter, system-ui, sans-serif',
                        weight: 500
                    }
                }
            },
            tooltip: {
                callbacks: {
                    label: function(context) {
                        return `${context.dataset.label}: ${context.raw.toFixed(2)}`;
                    }
                }
            }
        },
        scales: {
            r: {
                ticks: {
                    color: chartThemes[chartStyle].textColor
                },
                grid: {
                    color: chartThemes[chartStyle].gridColor
                }
            },
            y: {
                grid: {
                    color: chartThemes[chartStyle].gridColor
                },
                ticks: {
                    color: chartThemes[chartStyle].textColor
                }
            },
            x: {
                grid: {
                    color: chartThemes[chartStyle].gridColor
                },
                ticks: {
                    color: chartThemes[chartStyle].textColor
                }
            }
        }
    };

    return (
        <div className="space-y-6">
            {/* Enhanced Controls */}
            <div className="flex flex-wrap gap-4">
                <select
                    value={selectedMetric}
                    onChange={(e) => setSelectedMetric(e.target.value)}
                    className={`px-4 py-2 rounded-lg border ${
                        theme === 'dark'
                            ? 'bg-gray-700 border-gray-600 text-gray-200'
                            : 'bg-white border-gray-300 text-gray-700'
                    }`}
                >
                    <option value="basic">Basic Metrics</option>
                    <option value="risk">Risk Metrics</option>
                    <option value="pattern">Pattern Analysis</option>
                    <option value="statistical">Statistical Analysis</option>
                </select>

                <select
                    value={selectedTimeframe}
                    onChange={(e) => setSelectedTimeframe(e.target.value)}
                    className={`px-4 py-2 rounded-lg border ${
                        theme === 'dark'
                            ? 'bg-gray-700 border-gray-600 text-gray-200'
                            : 'bg-white border-gray-300 text-gray-700'
                    }`}
                >
                    <option value="all">All Time</option>
                    <option value="recent">Recent</option>
                    <option value="custom">Custom Range</option>
                </select>

                <select
                    value={selectedPattern}
                    onChange={(e) => setSelectedPattern(e.target.value)}
                    className={`px-4 py-2 rounded-lg border ${
                        theme === 'dark'
                            ? 'bg-gray-700 border-gray-600 text-gray-200'
                            : 'bg-white border-gray-300 text-gray-700'
                    }`}
                >
                    <option value="all">All Patterns</option>
                    <option value="reversals">Reversals</option>
                    <option value="breakouts">Breakouts</option>
                    <option value="consolidations">Consolidations</option>
                </select>

                <input
                    type="range"
                    min="1"
                    max="20"
                    value={predictiveRange}
                    onChange={(e) => setPredictiveRange(parseInt(e.target.value))}
                    className="w-32"
                />
                <span className="text-sm text-gray-500">
                    Prediction Range: {predictiveRange} days
                </span>

                <button
                    onClick={() => setShowAdvancedStats(!showAdvancedStats)}
                    className={`px-4 py-2 rounded-lg ${
                        theme === 'dark'
                            ? 'bg-blue-600 hover:bg-blue-700'
                            : 'bg-blue-500 hover:bg-blue-600'
                    } text-white transition-colors`}
                >
                    {showAdvancedStats ? 'Hide' : 'Show'} Advanced Stats
                </button>

                <select
                    value={chartStyle}
                    onChange={(e) => setChartStyle(e.target.value)}
                    className={`px-4 py-2 rounded-lg border ${
                        theme === 'dark'
                            ? 'bg-gray-700 border-gray-600 text-gray-200'
                            : 'bg-white border-gray-300 text-gray-700'
                    }`}
                >
                    <option value="modern">Modern</option>
                    <option value="classic">Classic</option>
                    <option value="minimal">Minimal</option>
                </select>
            </div>

            {/* Basic Trading Statistics */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                    { 
                        label: 'Avg Daily Profit',
                        value: `₹${basicStats?.avgDailyProfit.toFixed(2)}`,
                        color: 'text-green-500',
                        icon: '↑'
                    },
                    {
                        label: 'Avg Daily Loss',
                        value: `₹${basicStats?.avgDailyLoss.toFixed(2)}`,
                        color: 'text-red-500',
                        icon: '↓'
                    },
                    {
                        label: 'Win Streak',
                        value: `${basicStats?.maxWinStreak} days`,
                        color: 'text-blue-500',
                        icon: '🔥'
                    },
                    {
                        label: 'Loss Streak',
                        value: `${basicStats?.maxLossStreak} days`,
                        color: 'text-yellow-500',
                        icon: '❄️'
                    }
                ].map((stat, index) => (
                    <motion.div
                        key={index}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.1 }}
                        className={`p-4 rounded-lg ${theme === 'dark' ? 'bg-gray-800' : 'bg-white'} shadow-lg`}
                    >
                        <div className="flex items-center justify-between">
                            <div className="text-sm text-gray-500 dark:text-gray-400">{stat.label}</div>
                            <div className="text-xl">{stat.icon}</div>
                        </div>
                        <div className={`text-xl font-bold ${stat.color}`}>{stat.value}</div>
                    </motion.div>
                ))}
            </div>

            {/* Current Streak Status */}
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className={`p-4 rounded-lg ${theme === 'dark' ? 'bg-gray-800' : 'bg-white'} shadow-lg`}
            >
                <div className="flex items-center justify-between">
                    <h3 className={`text-lg font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                        Current Streak
                    </h3>
                    <div className={`text-2xl ${basicStats?.currentStreakType ? 'text-green-500' : 'text-red-500'}`}>
                        {basicStats?.currentStreakType ? '📈' : '📉'}
                    </div>
                </div>
                <div className="mt-2">
                    <span className="text-2xl font-bold mr-2">{basicStats?.currentStreak}</span>
                    <span className="text-gray-500">
                        consecutive {basicStats?.currentStreakType ? 'profitable' : 'loss'} days
                    </span>
                </div>
            </motion.div>

            {/* ML Predictions */}
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className={`p-4 rounded-lg ${theme === 'dark' ? 'bg-gray-800' : 'bg-white'} shadow-lg`}
            >
                <h3 className={`text-lg font-semibold mb-4 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                    ML-Based Predictions
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <div className="text-sm text-gray-500">Forecast Confidence</div>
                        <div className="text-2xl font-bold text-blue-500">
                            {(mlPredictionsData?.confidence * 100).toFixed(1)}%
                        </div>
                    </div>
                    <div>
                        <div className="text-sm text-gray-500">Detected Patterns</div>
                        <div className="text-lg">
                            {mlPredictionsData?.patterns.slice(-3).map(pattern => (
                                <span key={pattern.index} className="inline-block px-2 py-1 m-1 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200">
                                    {pattern.type}
                                </span>
                            ))}
                        </div>
                    </div>
                </div>
                <div className="mt-4 h-[300px]">
                    <Line
                        data={{
                            labels: Array.from({ length: results.netProfitLossValues.length + predictiveRange }, (_, i) => `Day ${i + 1}`),
                            datasets: [
                                {
                                    label: 'Actual',
                                    data: [...results.netProfitLossValues, ...Array(predictiveRange).fill(null)],
                                    borderColor: chartThemes[chartStyle].borderColor,
                                    backgroundColor: 'transparent'
                                },
                                {
                                    label: 'Forecast',
                                    data: [...Array(results.netProfitLossValues.length).fill(null), ...(mlPredictionsData?.forecast || [])],
                                    borderColor: theme === 'dark' ? '#9333EA' : '#7C3AED',
                                    backgroundColor: 'transparent',
                                    borderDash: [5, 5]
                                },
                                {
                                    label: 'Upper Band',
                                    data: mlPredictionsData?.bollingerBands.map(b => b.upper),
                                    borderColor: theme === 'dark' ? '#34D399' : '#10B981',
                                    backgroundColor: 'transparent',
                                    borderDash: [2, 2]
                                },
                                {
                                    label: 'Lower Band',
                                    data: mlPredictionsData?.bollingerBands.map(b => b.lower),
                                    borderColor: theme === 'dark' ? '#F87171' : '#EF4444',
                                    backgroundColor: 'transparent',
                                    borderDash: [2, 2]
                                }
                            ]
                        }}
                        options={chartOptions}
                    />
                </div>
            </motion.div>

            {/* Trading Performance Summary */}
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className={`p-4 rounded-lg ${theme === 'dark' ? 'bg-gray-800' : 'bg-white'} shadow-lg`}
            >
                <h3 className={`text-lg font-semibold mb-4 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                    Trading Performance Summary
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div>
                        <div className="text-sm text-gray-500">Profit Days vs Loss Days</div>
                        <div className="text-lg">
                            <span className="text-green-500 font-bold">{basicStats?.profitDaysCount}</span>
                            <span className="text-gray-500 mx-2">vs</span>
                            <span className="text-red-500 font-bold">{basicStats?.lossDaysCount}</span>
                        </div>
                    </div>
                    <div>
                        <div className="text-sm text-gray-500">Max Daily P&L</div>
                        <div className="text-lg">
                            <span className="text-green-500 font-bold">+₹{basicStats?.maxDailyProfit.toFixed(2)}</span>
                            <span className="text-gray-500 mx-2">/</span>
                            <span className="text-red-500 font-bold">-₹{Math.abs(basicStats?.maxDailyLoss).toFixed(2)}</span>
                        </div>
                    </div>
                    <div>
                        <div className="text-sm text-gray-500">Avg Trade Size</div>
                        <div className="text-lg font-bold text-blue-500">
                            ₹{basicStats?.avgTradeSize.toFixed(2)}
                        </div>
                    </div>
                </div>
            </motion.div>
        </div>
    );
};

export default TradeAnalysis;
