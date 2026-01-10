import { useMemo, useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { motion } from 'framer-motion';
import {
    CurrencyDollarIcon,
} from '@heroicons/react/24/outline';
import {
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    ReferenceLine
} from 'recharts';
import { selectLiveDataSnapshot, selectSpotPrice, selectSelectedSymbol, selectSelectedExpiry } from '../../context/selectors';
import analyticsProService from '../../services/analyticsProService';

/**
 * Max Pain Chart Pro Component
 * 
 * Visualizes the theoretical loss for option writers at each strike.
 * The strike with the minimum total loss is the Max Pain strike,
 * where the market tends to expire.
 */
const MaxPainChartPro = () => {
    const theme = useSelector((state) => state.theme.theme);
    const liveData = useSelector(selectLiveDataSnapshot);
    const spotPrice = useSelector(selectSpotPrice) || 0;
    const isDark = theme === 'dark';

    const [data, setData] = useState({ chartData: [], maxPainStrike: 0 });
    const [loading, setLoading] = useState(false);

    const symbol = useSelector(selectSelectedSymbol);
    const expiry = useSelector(selectSelectedExpiry);

    useEffect(() => {
        const fetchData = async () => {
            if (!symbol || !expiry) return;

            try {
                setLoading(true);
                const response = await analyticsProService.getMaxPain(symbol, expiry);
                if (response.success) {
                    setData({
                        chartData: response.chart_data || [], // Backend should return chart_data
                        maxPainStrike: response.max_pain_strike || 0
                    });
                }
            } catch (err) {
                console.error("Failed to fetch Max Pain data", err);
                // Fallback to simpler client-side calculation if API fails? 
                // Better to show error or empty state than wrong data.
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [symbol, expiry, liveData]); // Re-fetch when liveData updates (or just rely on occasional refresh)

    const { chartData, maxPainStrike } = data;

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`rounded-2xl p-6 border h-[500px] flex flex-col ${isDark ? 'bg-slate-900/50 border-slate-700' : 'bg-white border-slate-200'}`}
        >
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-500 to-rose-500 flex items-center justify-center shadow-lg">
                        <CurrencyDollarIcon className="w-5 h-5 text-white" />
                    </div>
                    <div>
                        <h2 className={`text-lg font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                            Max Pain Analysis
                        </h2>
                        <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                            Current Max Pain: <span className="font-bold text-amber-500">{maxPainStrike}</span>
                        </p>
                    </div>
                </div>
            </div>

            <div className="flex-1 w-full min-h-0">
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                        data={chartData}
                        margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                    >
                        <defs>
                            <linearGradient id="colorPain" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                                <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#334155' : '#e2e8f0'} vertical={false} />
                        <XAxis
                            dataKey="strike"
                            stroke={isDark ? '#94a3b8' : '#64748b'}
                            fontSize={12}
                            tickMargin={10}
                        />
                        <YAxis
                            stroke={isDark ? '#94a3b8' : '#64748b'}
                            fontSize={12}
                            tickFormatter={(val) => {
                                if (Math.abs(val) >= 1e7) return `${(val / 1e7).toFixed(0)}Cr`;
                                if (Math.abs(val) >= 1e5) return `${(val / 1e5).toFixed(0)}L`;
                                return val;
                            }}
                        />
                        <Tooltip
                            contentStyle={{
                                backgroundColor: isDark ? '#1e293b' : '#fff',
                                borderColor: isDark ? '#334155' : '#e2e8f0',
                                borderRadius: '0.75rem',
                                color: isDark ? '#fff' : '#0f172a'
                            }}
                            formatter={(value) => {
                                if (value >= 1e7) return `₹${(value / 1e7).toFixed(2)}Cr`;
                                if (value >= 1e5) return `₹${(value / 1e5).toFixed(2)}L`;
                                return value.toLocaleString();
                            }}
                        />

                        <ReferenceLine x={maxPainStrike} stroke="#f59e0b" strokeDasharray="3 3" label={{ value: 'Max Pain', fill: '#f59e0b', fontSize: 12, position: 'top' }} />
                        <ReferenceLine x={spotPrice} stroke="#3b82f6" strokeDasharray="3 3" label={{ value: 'Spot', fill: '#3b82f6', fontSize: 12, position: 'top' }} />

                        <Area
                            type="monotone"
                            dataKey="totalPain"
                            name="Total Pain"
                            stroke="#ef4444"
                            fillOpacity={1}
                            fill="url(#colorPain)"
                        />
                    </AreaChart>
                </ResponsiveContainer>
            </div>
        </motion.div>
    );
};

export default MaxPainChartPro;
