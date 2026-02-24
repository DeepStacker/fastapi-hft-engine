import { memo } from 'react';
import PropTypes from 'prop-types';

const CapitalInput = memo(({ value, onChange }) => {
    const presets = [50000, 100000, 200000, 500000];

    return (
        <div className="space-y-3">
            <div className="flex gap-2 flex-wrap">
                {presets.map(p => (
                    <button
                        key={p}
                        onClick={() => onChange(p)}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all
                            ${value === p
                                ? 'bg-indigo-600 text-white'
                                : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'}`}
                    >
                        ₹{(p / 1000).toFixed(0)}K
                    </button>
                ))}
            </div>
            <input
                type="number"
                value={value}
                onChange={(e) => onChange(Number(e.target.value))}
                className="w-full px-4 py-3 rounded-lg border border-gray-200 dark:border-gray-700 
                         bg-white dark:bg-gray-800 text-gray-900 dark:text-white
                         focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                placeholder="Enter capital amount"
                min={10000}
            />
        </div>
    );
});

CapitalInput.displayName = 'CapitalInput';

CapitalInput.propTypes = {
    value: PropTypes.number.isRequired,
    onChange: PropTypes.func.isRequired
};

export default CapitalInput;
