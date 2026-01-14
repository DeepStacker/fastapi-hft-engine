/**
 * Simulation Sliders Component
 * Controls for time decay, spot price, IV change, and risk-free rate simulation
 */
import { useMemo } from 'react';
import { ClockIcon, CurrencyDollarIcon, ChartBarIcon, BanknotesIcon } from '@heroicons/react/24/outline';

const SimulationSliders = ({
    simulationParams,
    onParamsChange,
    spotPrice,
    maxDTE,
    disabled = false
}) => {
    // Calculate display values
    const simulatedSpot = useMemo(() => {
        return spotPrice * (1 + simulationParams.spotOffset / 100);
    }, [spotPrice, simulationParams.spotOffset]);

    const handleSliderChange = (key, value) => {
        onParamsChange({ ...simulationParams, [key]: value });
    };

    const sliders = [
        {
            id: 'daysForward',
            label: 'Time Decay',
            icon: ClockIcon,
            value: simulationParams.daysForward || 0,
            min: 0,
            max: maxDTE || 30,
            step: 0.5,
            unit: 'days',
            color: 'blue',
            description: 'Simulate forward in time',
            displayValue: (v) => `${v.toFixed(1)} days`,
            gradient: 'from-blue-500 to-blue-600'
        },
        {
            id: 'spotOffset',
            label: 'Spot Price',
            icon: CurrencyDollarIcon,
            value: simulationParams.spotOffset || 0,
            min: -30,
            max: 30,
            step: 0.5,
            unit: '%',
            color: 'green',
            description: `Simulated: ₹${simulatedSpot.toFixed(2)}`,
            displayValue: (v) => `${v >= 0 ? '+' : ''}${v.toFixed(1)}%`,
            gradient: 'from-green-500 to-green-600'
        },
        {
            id: 'ivChange',
            label: 'IV Change',
            icon: ChartBarIcon,
            value: (simulationParams.ivChange || 0) * 100,
            min: -50,
            max: 50,
            step: 1,
            unit: '%',
            color: 'purple',
            description: 'Volatility shock',
            displayValue: (v) => `${v >= 0 ? '+' : ''}${v.toFixed(0)}%`,
            gradient: 'from-purple-500 to-purple-600',
            valueTransform: (v) => v / 100 // Store as decimal
        },
        {
            id: 'riskFreeRate',
            label: 'Risk-Free Rate',
            icon: BanknotesIcon,
            value: (simulationParams.riskFreeRate || 0.07) * 100,
            min: 0,
            max: 15,
            step: 0.25,
            unit: '%',
            color: 'amber',
            description: 'Interest rate assumption',
            displayValue: (v) => `${v.toFixed(2)}%`,
            gradient: 'from-amber-500 to-amber-600',
            valueTransform: (v) => v / 100
        }
    ];

    return (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-indigo-500/10 to-purple-500/10">
                <h3 className="font-semibold flex items-center gap-2 text-sm">
                    <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse"></span>
                    Simulation Controls
                </h3>
                <p className="text-xs text-gray-500 mt-1">Adjust parameters to see how your strategy performs</p>
            </div>

            <div className="p-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                {sliders.map((slider) => {
                    const Icon = slider.icon;
                    const colorClasses = {
                        blue: 'text-blue-600 bg-blue-100 dark:bg-blue-900/30',
                        green: 'text-green-600 bg-green-100 dark:bg-green-900/30',
                        purple: 'text-purple-600 bg-purple-100 dark:bg-purple-900/30',
                        amber: 'text-amber-600 bg-amber-100 dark:bg-amber-900/30'
                    };

                    return (
                        <div key={slider.id} className="space-y-2">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <div className={`p-1.5 rounded-lg ${colorClasses[slider.color]}`}>
                                        <Icon className="w-4 h-4" />
                                    </div>
                                    <span className="text-sm font-medium">{slider.label}</span>
                                </div>
                                <span className={`text-sm font-bold bg-gradient-to-r ${slider.gradient} bg-clip-text text-transparent`}>
                                    {slider.displayValue(slider.value)}
                                </span>
                            </div>

                            <div className="relative">
                                <input
                                    type="range"
                                    min={slider.min}
                                    max={slider.max}
                                    step={slider.step}
                                    value={slider.value}
                                    disabled={disabled}
                                    onChange={(e) => {
                                        const val = parseFloat(e.target.value);
                                        const transformedVal = slider.valueTransform ? slider.valueTransform(val) : val;
                                        handleSliderChange(slider.id, transformedVal);
                                    }}
                                    className={`w-full h-2 rounded-full appearance-none cursor-pointer
                                        bg-gray-200 dark:bg-gray-700
                                        [&::-webkit-slider-thumb]:appearance-none
                                        [&::-webkit-slider-thumb]:w-4
                                        [&::-webkit-slider-thumb]:h-4
                                        [&::-webkit-slider-thumb]:rounded-full
                                        [&::-webkit-slider-thumb]:bg-gradient-to-r
                                        [&::-webkit-slider-thumb]:${slider.gradient}
                                        [&::-webkit-slider-thumb]:shadow-lg
                                        [&::-webkit-slider-thumb]:cursor-pointer
                                        [&::-webkit-slider-thumb]:transition-transform
                                        [&::-webkit-slider-thumb]:hover:scale-110
                                        disabled:opacity-50 disabled:cursor-not-allowed
                                    `}
                                />
                                {/* Center marker for offset sliders */}
                                {(slider.min < 0 && slider.max > 0) && (
                                    <div
                                        className="absolute top-1/2 -translate-y-1/2 w-0.5 h-3 bg-gray-400 dark:bg-gray-500 pointer-events-none"
                                        style={{ left: `${((0 - slider.min) / (slider.max - slider.min)) * 100}%` }}
                                    />
                                )}
                            </div>

                            <div className="flex justify-between text-[10px] text-gray-400">
                                <span>{slider.min}{slider.unit === '%' ? '%' : ''}</span>
                                <span className="text-gray-500">{slider.description}</span>
                                <span>{slider.max}{slider.unit === '%' ? '%' : ''}</span>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Quick Reset Button */}
            <div className="px-4 pb-3 flex justify-end">
                <button
                    onClick={() => onParamsChange({
                        daysForward: 0,
                        spotOffset: 0,
                        ivChange: 0,
                        riskFreeRate: 0.07
                    })}
                    disabled={disabled}
                    className="px-3 py-1 text-xs font-medium text-gray-600 dark:text-gray-400 
                        hover:text-gray-900 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700
                        rounded-lg transition-colors disabled:opacity-50"
                >
                    Reset to Current
                </button>
            </div>
        </div>
    );
};

export default SimulationSliders;
