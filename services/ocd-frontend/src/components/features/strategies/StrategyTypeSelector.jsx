import { memo } from 'react';
import PropTypes from 'prop-types';
import { STRATEGY_TYPES, STRATEGY_NAMES } from '../../../services/strategyOptimizer';

const StrategyTypeSelector = memo(({ value, onChange, recommended = [] }) => {
    const categories = {
        'Neutral': [STRATEGY_TYPES.IRON_CONDOR, STRATEGY_TYPES.SHORT_STRADDLE],
        'Bullish': [STRATEGY_TYPES.BULL_PUT_SPREAD, STRATEGY_TYPES.BULL_CALL_SPREAD],
        'Bearish': [STRATEGY_TYPES.BEAR_CALL_SPREAD, STRATEGY_TYPES.BEAR_PUT_SPREAD],
        'Volatility': [STRATEGY_TYPES.LONG_STRADDLE, STRATEGY_TYPES.STRANGLE]
    };

    return (
        <div className="space-y-4">
            {Object.entries(categories).map(([cat, types]) => (
                <div key={cat}>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">{cat}</p>
                    <div className="flex flex-wrap gap-2">
                        {types.map(t => (
                            <button
                                key={t}
                                onClick={() => onChange(t)}
                                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2
                                    ${value === t
                                        ? 'bg-indigo-600 text-white'
                                        : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'}`}
                            >
                                {STRATEGY_NAMES[t]}
                                {recommended.includes(t) && (
                                    <span className="px-1.5 py-0.5 text-xs bg-green-100 text-green-700 rounded">
                                        Recommended
                                    </span>
                                )}
                            </button>
                        ))}
                    </div>
                </div>
            ))}
        </div>
    );
});

StrategyTypeSelector.displayName = 'StrategyTypeSelector';

StrategyTypeSelector.propTypes = {
    value: PropTypes.string.isRequired,
    onChange: PropTypes.func.isRequired,
    recommended: PropTypes.arrayOf(PropTypes.string)
};

export default StrategyTypeSelector;
