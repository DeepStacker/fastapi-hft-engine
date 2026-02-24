import { useState, memo } from 'react';
import PropTypes from 'prop-types';
import { motion, AnimatePresence } from 'framer-motion';
import { SparklesIcon, AdjustmentsHorizontalIcon, CheckCircleIcon } from '@heroicons/react/24/outline';
import LegCard from './LegCard';
import MetricsPanel from './MetricsPanel';
import { STRATEGY_NAMES } from '../../../services/strategyOptimizer';

const StructureResult = memo(({ structure, onTrack }) => {
    const [expanded, setExpanded] = useState(true);
    const [tracking, setTracking] = useState(false);

    const handleTrack = async (e) => {
        e.stopPropagation();
        setTracking(true);
        try {
            await onTrack(structure);
        } finally {
            setTracking(false);
        }
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="border border-gray-200 dark:border-gray-700 rounded-2xl overflow-hidden bg-white dark:bg-gray-800 shadow-lg"
        >
            {/* Header */}
            <div
                className="p-5 bg-gradient-to-r from-indigo-500 to-purple-600 text-white cursor-pointer"
                onClick={() => setExpanded(!expanded)}
            >
                <div className="flex justify-between items-start">
                    <div>
                        <h3 className="text-xl font-bold flex items-center gap-2">
                            {STRATEGY_NAMES[structure.strategy_type] || structure.strategy_type}
                            <span className="px-2 py-1 rounded text-xs font-medium bg-white/20">
                                {(structure.confidence * 100).toFixed(0)}% confidence
                            </span>
                        </h3>
                        <p className="text-sm text-white/80 mt-1">{structure.rationale}</p>
                    </div>
                    <SparklesIcon className="w-8 h-8 opacity-50" />
                </div>
            </div>

            <AnimatePresence>
                {expanded && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                    >
                        <div className="p-5 space-y-5">
                            {/* Legs Grid */}
                            <div>
                                <h4 className="font-bold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                                    <AdjustmentsHorizontalIcon className="w-5 h-5 text-indigo-500" />
                                    Structure Legs
                                </h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    {structure.legs.map((leg, i) => (
                                        <LegCard key={i} leg={leg} isCall={leg.option_type === 'CE'} />
                                    ))}
                                </div>
                            </div>

                            {/* Metrics */}
                            <MetricsPanel metrics={structure.metrics} />

                            {/* Market Context */}
                            <div className="text-xs text-gray-500 flex items-center gap-4 pt-3 border-t border-gray-200 dark:border-gray-700">
                                <span>Support: {structure.market_context?.support_strike}</span>
                                <span>Resistance: {structure.market_context?.resistance_strike}</span>
                                <span>ATM IV: {structure.market_context?.atm_iv?.toFixed(1)}%</span>
                            </div>

                            {/* Track Button */}
                            <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                                <button
                                    onClick={handleTrack}
                                    disabled={tracking}
                                    className="w-full py-3 px-4 bg-green-600 hover:bg-green-700 text-white 
                                             rounded-xl font-semibold flex items-center justify-center gap-2
                                             disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                >
                                    {tracking ? (
                                        <>
                                            <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                                            Tracking...
                                        </>
                                    ) : (
                                        <>
                                            <CheckCircleIcon className="w-5 h-5" />
                                            Track This Position
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
});

StructureResult.displayName = 'StructureResult';

StructureResult.propTypes = {
    structure: PropTypes.object.isRequired,
    onTrack: PropTypes.func.isRequired
};

export default StructureResult;
