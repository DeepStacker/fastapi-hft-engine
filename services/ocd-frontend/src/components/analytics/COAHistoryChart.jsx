/**
 * COA History Chart Component
 * Displays support/resistance strength changes over time
 */
import { useState, useEffect, useMemo } from 'react';
import { useSelector } from 'react-redux';
import apiClient from '../../services/apiClient';
import {
    ChartBarIcon,
    ArrowPathIcon,
    ClockIcon,
    ArrowTrendingUpIcon,
    ArrowTrendingDownIcon,
    ShieldCheckIcon
} from '@heroicons/react/24/outline';
import COAExportButton from './COAExportButton';

const COAHistoryChart = () => {
    // Use same selector as Analytics.jsx for symbol consistency
    const symbol = useSelector(state => state.data.sid || 'NIFTY');
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [selectedInterval, setSelectedInterval] = useState('5 minutes');

    // Fetch history data
    useEffect(() => {
        // Clear history when symbol changes to avoid showing stale data
        setHistory([]);
        setError(null);

        const fetchHistory = async () => {
            if (!symbol) return;

            setLoading(true);
            setError(null);

            try {
                const response = await apiClient.get(`/analytics/${symbol}/coa/history`, {
                    params: { interval: selectedInterval }
                });

                if (response.data?.success) {
                    setHistory(response.data.history || []);
                }
            } catch (err) {
                console.error('COA history fetch failed:', err);
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };

        fetchHistory();

        // Refresh every 60 seconds
        const timer = setInterval(fetchHistory, 60000);
        return () => clearInterval(timer);
    }, [symbol, selectedInterval]);

    // Get strength color
    const getStrengthColor = (strength) => {
        switch (strength) {
            case 'Strong': return 'text-emerald-600';
            case 'WTT': return 'text-green-500';
            case 'WTB': return 'text-red-500';
            default: return 'text-gray-500';
        }
    };

    const getStrengthBg = (strength) => {
        switch (strength) {
            case 'Strong': return 'bg-emerald-500';
            case 'WTT': return 'bg-green-400';
            case 'WTB': return 'bg-red-400';
            default: return 'bg-gray-400';
        }
    };

    const getScenarioBadge = (id, bias) => {
        const colors = {
            'neutral': 'bg-blue-100 text-blue-700',
            'bullish': 'bg-green-100 text-green-700',
            'bearish': 'bg-red-100 text-red-700',
            'unclear': 'bg-amber-100 text-amber-700',
        };
        return colors[bias] || 'bg-gray-100 text-gray-700';
    };

    if (loading && history.length === 0) {
        return (
            <div className="p-8 text-center text-gray-400">
                <ArrowPathIcon className="w-8 h-8 mx-auto mb-3 animate-spin" />
                <p>Loading COA History...</p>
            </div>
        );
    }

    if (error && history.length === 0) {
        return (
            <div className="p-8 text-center text-red-400">
                <p>Failed to load history: {error}</p>
            </div>
        );
    }

    if (history.length === 0) {
        return (
            <div className="p-8 text-center text-gray-400">
                <ClockIcon className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>No history data yet</p>
                <p className="text-sm mt-1">Data will appear as COA updates occur</p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
                <h3 className="font-semibold flex items-center gap-2">
                    <ClockIcon className="w-5 h-5" />
                    COA History
                </h3>
                <div className="flex items-center gap-2">
                    <select
                        value={selectedInterval}
                        onChange={(e) => setSelectedInterval(e.target.value)}
                        className="text-xs px-2 py-1 border rounded bg-white dark:bg-gray-800 dark:border-gray-700"
                    >
                        <option value="1 minute">1 min</option>
                        <option value="5 minutes">5 min</option>
                        <option value="15 minutes">15 min</option>
                        <option value="1 hour">1 hour</option>
                    </select>
                    <COAExportButton interval={selectedInterval} />
                </div>
            </div>

            {/* Timeline */}
            <div className="relative">
                {/* Timeline line */}
                <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-200 dark:bg-gray-700" />

                {/* History items */}
                <div className="space-y-3">
                    {history.slice().reverse().map((item, idx) => (
                        <div key={idx} className="relative pl-10">
                            {/* Timeline dot */}
                            <div className={`absolute left-2.5 w-3.5 h-3.5 rounded-full border-2 border-white dark:border-gray-800 ${getStrengthBg(item.scenario?.bias === 'bullish' ? 'WTT' : item.scenario?.bias === 'bearish' ? 'WTB' : 'Strong')}`} />

                            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3">
                                {/* Time & Scenario */}
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-xs text-gray-500">
                                        {new Date(item.timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${getScenarioBadge(item.scenario?.id, item.scenario?.bias)}`}>
                                        {item.scenario?.id} - {item.scenario?.name}
                                    </span>
                                </div>

                                {/* Support & Resistance */}
                                <div className="grid grid-cols-2 gap-3 text-xs">
                                    {/* Support */}
                                    <div className="flex items-center gap-2">
                                        <div className={`w-1.5 h-6 rounded ${getStrengthBg(item.support?.strength)}`} />
                                        <div>
                                            <div className="text-gray-500">Support</div>
                                            <div className={`font-bold ${getStrengthColor(item.support?.strength)}`}>
                                                {item.support?.strength} @ {item.support?.strike?.toFixed(0)}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Resistance */}
                                    <div className="flex items-center gap-2">
                                        <div className={`w-1.5 h-6 rounded ${getStrengthBg(item.resistance?.strength)}`} />
                                        <div>
                                            <div className="text-gray-500">Resistance</div>
                                            <div className={`font-bold ${getStrengthColor(item.resistance?.strength)}`}>
                                                {item.resistance?.strength} @ {item.resistance?.strike?.toFixed(0)}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Levels */}
                                <div className="mt-2 pt-2 border-t border-gray-100 dark:border-gray-700 flex justify-between text-[10px] text-gray-500">
                                    <span>EOS: <span className="font-medium text-green-600">{item.levels?.eos?.toFixed(0)}</span></span>
                                    <span>Spot: <span className="font-medium">{item.spot_price?.toFixed(0)}</span></span>
                                    <span>EOR: <span className="font-medium text-red-600">{item.levels?.eor?.toFixed(0)}</span></span>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Stats Summary */}
            {history.length > 1 && (
                <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-3">
                    <div className="text-xs text-gray-500 mb-2">Session Summary</div>
                    <div className="grid grid-cols-3 gap-2 text-center text-xs">
                        <div>
                            <div className="font-bold text-lg">{history.length}</div>
                            <div className="text-gray-500">Snapshots</div>
                        </div>
                        <div>
                            <div className="font-bold text-lg text-emerald-600">
                                {history.filter(h => h.support?.strength === 'Strong').length}
                            </div>
                            <div className="text-gray-500">Strong Support</div>
                        </div>
                        <div>
                            <div className="font-bold text-lg text-emerald-600">
                                {history.filter(h => h.resistance?.strength === 'Strong').length}
                            </div>
                            <div className="text-gray-500">Strong Resistance</div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default COAHistoryChart;
