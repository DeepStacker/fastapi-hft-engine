import { useMemo } from 'react';
import { useSelector } from 'react-redux';
import { motion } from 'framer-motion';
import {
    ChartBarIcon,
} from '@heroicons/react/24/outline';
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
    ReferenceLine
} from 'recharts';
import { selectLiveDataSnapshot, selectSpotPrice } from '../../context/selectors';

/**
 * COI Bars Pro Component
 * 
 * Visualizes Change in Open Interest (COI) across strikes.
 * Helpful for identifying intraday support/resistance formation.
 */
const COIBarsPro = () => {
    const theme = useSelector((state) => state.theme.theme);
    const liveData = useSelector(selectLiveDataSnapshot);
    const spotPrice = useSelector(selectSpotPrice) || 0;
    const isDark = theme === 'dark';

    const oc = liveData?.oc || {};

    // Process data for chart
    const data = useMemo(() => {
        const strikesData = Object.values(oc);
        if (!strikesData.length || !spotPrice) return [];

        // Group by strike
        const byStrike = {};
        strikesData.forEach(row => {
            const strike = row.strike;
            const ce = row.ce || {};
            const pe = row.pe || {};

            byStrike[strike] = {
                strike,
                ce_coi: ce.oichng || ce.oi_change || 0,
                pe_coi: pe.oichng || pe.oi_change || 0
            };
        });

        // Filter strikes around ATM
        const strikes = Object.keys(byStrike).map(Number).sort((a, b) => a - b);
        const atmStrike = strikes.reduce((prev, curr) =>
            Math.abs(curr - spotPrice) < Math.abs(prev - spotPrice) ? curr : prev
        );
        const atmIdx = strikes.indexOf(atmStrike);
        const range = 12; // Show +/- 12 strikes
        const start = Math.max(0, atmIdx - range);
        const end = Math.min(strikes.length, atmIdx + range + 1);

        return strikes.slice(start, end).map(strike => ({
            ...byStrike[strike],
            ce_color: byStrike[strike].ce_coi >= 0 ? '#10b981' : '#ef4444', // Green for +ve, Red for -ve
            pe_color: byStrike[strike].pe_coi >= 0 ? '#ef4444' : '#10b981', // Red for +ve (writing), Green for -ve (unwinding)
        }));
    }, [oc, spotPrice]);

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`rounded-2xl p-6 border h-[500px] flex flex-col ${isDark ? 'bg-slate-900/50 border-slate-700' : 'bg-white border-slate-200'}`}
        >
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-amber-500 flex items-center justify-center shadow-lg">
                        <ChartBarIcon className="w-5 h-5 text-white" />
                    </div>
                    <div>
                        <h2 className={`text-lg font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                            Change in OI (Intraday)
                        </h2>
                        <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                            Call vs Put Writing/Unwinding
                        </p>
                    </div>
                </div>
            </div>

            <div className="flex-1 w-full min-h-0">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                        data={data}
                        margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                    >
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
                                if (Math.abs(val) >= 10000000) return `${(val / 10000000).toFixed(1)}Cr`;
                                if (Math.abs(val) >= 100000) return `${(val / 100000).toFixed(1)}L`;
                                if (Math.abs(val) >= 1000) return `${(val / 1000).toFixed(0)}k`;
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
                            formatter={(value) => value.toLocaleString()}
                        />
                        <Legend wrapperStyle={{ paddingTop: '20px' }} />
                        <ReferenceLine y={0} stroke={isDark ? '#64748b' : '#94a3b8'} />

                        <Bar dataKey="ce_coi" name="Call COI" fill="#10b981" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="pe_coi" name="Put COI" fill="#ef4444" radius={[4, 4, 0, 0]} />
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </motion.div>
    );
};

export default COIBarsPro;
