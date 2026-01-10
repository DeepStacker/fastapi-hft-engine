import { useMemo } from 'react';
import { useSelector } from 'react-redux';
import { motion } from 'framer-motion';
import {
    ArrowTrendingUpIcon,
    ArrowTrendingDownIcon,
    MinusIcon,
    FunnelIcon
} from '@heroicons/react/24/outline';
import { selectLiveDataSnapshot } from '../../context/selectors';

/**
 * Buildup Analysis Pro Component
 * 
 * Visualizes market participant behavior:
 * - Long Buildup (LB): Price Up + OI Up (Bullish)
 * - Short Buildup (SB): Price Down + OI Up (Bearish)
 * - Short Covering (SU): Price Up + OI Down (Bullish)
 * - Long Unwinding (LU): Price Down + OI Down (Bearish)
 */
const BuildupAnalysisPro = () => {
    const theme = useSelector((state) => state.theme.theme);
    const liveData = useSelector(selectLiveDataSnapshot);
    const isDark = theme === 'dark';

    const options = liveData?.options || [];

    // Calculate buildup statistics
    const stats = useMemo(() => {
        const counts = { LB: 0, SB: 0, SU: 0, LU: 0, NT: 0 };
        const volume = { LB: 0, SB: 0, SU: 0, LU: 0, NT: 0 };

        options.forEach(opt => {
            const type = opt.buildup_type || 'NT';
            if (counts[type] !== undefined) {
                counts[type]++;
                volume[type] += opt.volume || 0;
            }
        });

        const total = options.length || 1;
        const totalVol = Object.values(volume).reduce((a, b) => a + b, 0) || 1;

        return { counts, volume, total, totalVol };
    }, [options]);

    // Styling map
    const styles = {
        LB: { color: 'text-emerald-500', bg: 'bg-emerald-500', border: 'border-emerald-500', label: 'Long Buildup', icon: ArrowTrendingUpIcon },
        SB: { color: 'text-red-500', bg: 'bg-red-500', border: 'border-red-500', label: 'Short Buildup', icon: ArrowTrendingDownIcon },
        SU: { color: 'text-blue-500', bg: 'bg-blue-500', border: 'border-blue-500', label: 'Short Covering', icon: ArrowTrendingUpIcon },
        LU: { color: 'text-amber-500', bg: 'bg-amber-500', border: 'border-amber-500', label: 'Long Unwinding', icon: ArrowTrendingDownIcon },
        NT: { color: 'text-slate-500', bg: 'bg-slate-500', border: 'border-slate-500', label: 'Neutral', icon: MinusIcon },
    };

    // Bar component
    const BuildupBar = ({ type, count, vol }) => {
        const style = styles[type];
        const pct = (count / stats.total) * 100;
        const volPct = (vol / stats.totalVol) * 100;
        const Icon = style.icon;

        if (count === 0) return null;

        return (
            <div className="mb-4">
                <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                        <span className={`p-1 rounded ${style.bg} bg-opacity-10`}>
                            <Icon className={`w-4 h-4 ${style.color}`} />
                        </span>
                        <span className={`text-sm font-medium ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                            {style.label}
                        </span>
                    </div>
                    <div className="text-right">
                        <span className={`text-sm font-bold ${style.color}`}>{count}</span>
                        <span className={`text-xs ml-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                            ({pct.toFixed(1)}%)
                        </span>
                    </div>
                </div>

                {/* Count Bar */}
                <div className={`h-2 rounded-full mb-1 ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`}>
                    <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${pct}%` }}
                        className={`h-full rounded-full ${style.bg} opacity-80`}
                    />
                </div>

                {/* Volume contribution */}
                <div className="flex items-center justify-between text-xs">
                    <span className={isDark ? 'text-slate-500' : 'text-slate-400'}>
                        Volume Share
                    </span>
                    <span className={isDark ? 'text-slate-400' : 'text-slate-500'}>
                        {volPct.toFixed(1)}%
                    </span>
                </div>
            </div>
        );
    };

    // Determine overall sentiment based on weighted buildup
    const sentiment = useMemo(() => {
        const bullish = stats.counts.LB + stats.counts.SU;
        const bearish = stats.counts.SB + stats.counts.LU;
        const total = bullish + bearish || 1;

        if (bullish > bearish * 1.5) return { label: 'Strongly Bullish', color: 'text-emerald-500' };
        if (bullish > bearish) return { label: 'Mildly Bullish', color: 'text-teal-500' };
        if (bearish > bullish * 1.5) return { label: 'Strongly Bearish', color: 'text-red-500' };
        if (bearish > bullish) return { label: 'Mildly Bearish', color: 'text-orange-500' };
        return { label: 'Neutral', color: 'text-slate-500' };
    }, [stats]);

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`rounded-2xl p-6 border ${isDark ? 'bg-slate-900/50 border-slate-700' : 'bg-white border-slate-200'}`}
        >
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center shadow-lg">
                        <FunnelIcon className="w-6 h-6 text-white" />
                    </div>
                    <div>
                        <h2 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                            Buildup Analysis
                        </h2>
                        <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                            Market participant behavior
                        </p>
                    </div>
                </div>

                <div className={`px-3 py-1.5 rounded-full border bg-opacity-10 ${sentiment.color.replace('text', 'bg')} ${sentiment.color.replace('text', 'border')}`}>
                    <span className={`text-sm font-bold ${sentiment.color}`}>
                        {sentiment.label}
                    </span>
                </div>
            </div>

            {/* Bars */}
            <div className="space-y-2">
                <BuildupBar type="LB" count={stats.counts.LB} vol={stats.volume.LB} />
                <BuildupBar type="SU" count={stats.counts.SU} vol={stats.volume.SU} />
                <BuildupBar type="SB" count={stats.counts.SB} vol={stats.volume.SB} />
                <BuildupBar type="LU" count={stats.counts.LU} vol={stats.volume.LU} />
            </div>

            {/* Logic Legend */}
            <div className={`mt-6 p-4 rounded-xl ${isDark ? 'bg-slate-800/50' : 'bg-slate-50'} text-xs`}>
                <h4 className={`font-bold mb-2 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>How to read:</h4>
                <div className="grid grid-cols-2 gap-2">
                    <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                        <span className={isDark ? 'text-slate-400' : 'text-slate-500'}>Long Buildup (Price ↑ OI ↑)</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-red-500"></span>
                        <span className={isDark ? 'text-slate-400' : 'text-slate-500'}>Short Buildup (Price ↓ OI ↑)</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                        <span className={isDark ? 'text-slate-400' : 'text-slate-500'}>Short Covering (Price ↑ OI ↓)</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                        <span className={isDark ? 'text-slate-400' : 'text-slate-500'}>Long Unwinding (Price ↓ OI ↓)</span>
                    </div>
                </div>
            </div>
        </motion.div>
    );
};

export default BuildupAnalysisPro;
