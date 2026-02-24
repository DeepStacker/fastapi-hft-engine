import { memo } from 'react';
import PropTypes from 'prop-types';
import { ShieldCheckIcon, ScaleIcon, BoltIcon } from '@heroicons/react/24/outline';
import { RISK_PROFILES } from '../../../services/strategyOptimizer';

const RiskProfileSelector = memo(({ value, onChange }) => {
    const profiles = [
        { id: RISK_PROFILES.CONSERVATIVE, label: 'Conservative', icon: ShieldCheckIcon, color: 'green', desc: 'Wider spreads, far OTM' },
        { id: RISK_PROFILES.MODERATE, label: 'Moderate', icon: ScaleIcon, color: 'blue', desc: 'Balanced risk/reward' },
        { id: RISK_PROFILES.AGGRESSIVE, label: 'Aggressive', icon: BoltIcon, color: 'red', desc: 'Narrower spreads, closer ATM' }
    ];

    return (
        <div className="grid grid-cols-3 gap-3">
            {profiles.map(p => (
                <button
                    key={p.id}
                    onClick={() => onChange(p.id)}
                    className={`p-4 rounded-xl border-2 transition-all text-left
                        ${value === p.id
                            ? `border-${p.color}-500 bg-${p.color}-50 dark:bg-${p.color}-900/20`
                            : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'}`}
                >
                    <p.icon className={`w-6 h-6 mb-2 ${value === p.id ? `text-${p.color}-600` : 'text-gray-400'}`} />
                    <p className="font-semibold text-gray-900 dark:text-white">{p.label}</p>
                    <p className="text-xs text-gray-500 mt-1">{p.desc}</p>
                </button>
            ))}
        </div>
    );
});

RiskProfileSelector.displayName = 'RiskProfileSelector';

RiskProfileSelector.propTypes = {
    value: PropTypes.string.isRequired,
    onChange: PropTypes.func.isRequired
};

export default RiskProfileSelector;
