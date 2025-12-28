import { useState, memo } from 'react';
import { Helmet } from 'react-helmet-async';
import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import {
    CalculatorIcon,
    ChartBarIcon,
    BanknotesIcon,
    ArrowPathIcon,
    CurrencyDollarIcon,
} from '@heroicons/react/24/outline';
import { selectIsAuthenticated } from '../context/selectors';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import { calculatorService } from '../services/calculatorService';

/**
 * Calculator Tab Types
 */
const CALCULATOR_TABS = [
    { id: 'option', label: 'Option Pricing', icon: ChartBarIcon },
    { id: 'sip', label: 'SIP', icon: BanknotesIcon },
    { id: 'lumpsum', label: 'Lumpsum', icon: CurrencyDollarIcon },
    { id: 'swp', label: 'SWP', icon: CalculatorIcon },
];

/**
 * Input Field Component
 */
const InputField = memo(({ label, value, onChange, type = 'number', suffix = '', min, max, step }) => (
    <div>
        <label className="block text-xs text-gray-500 mb-1">{label}</label>
        <div className="relative">
            <input
                type={type}
                value={value}
                onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
                min={min}
                max={max}
                step={step}
                className="w-full bg-gray-100 dark:bg-gray-800 border-0 rounded-lg px-3 py-2 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
            />
            {suffix && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">
                    {suffix}
                </span>
            )}
        </div>
    </div>
));

InputField.displayName = 'InputField';

/**
 * Result Card Component
 */
const ResultCard = memo(({ label, value, subLabel, color = 'blue' }) => {
    const colorClasses = {
        blue: 'text-blue-600',
        green: 'text-green-600',
        red: 'text-red-600',
        purple: 'text-purple-600',
    };

    return (
        <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4 text-center">
            <div className="text-xs text-gray-500 mb-1">{label}</div>
            <div className={`text-2xl font-bold ${colorClasses[color]}`}>
                {value}
            </div>
            {subLabel && (
                <div className="text-xs text-gray-400 mt-1">{subLabel}</div>
            )}
        </div>
    );
});

ResultCard.displayName = 'ResultCard';

/**
 * Option Pricing Calculator
 */
const OptionCalculator = () => {
    const [inputs, setInputs] = useState({
        spot: 24500,
        strike: 24500,
        timeToExpiry: 7 / 365,
        volatility: 0.15,
        riskFreeRate: 0.07,
    });
    const [result, setResult] = useState(null);
    const [loading, setLoading] = useState(false);

    const handleCalculate = async () => {
        setLoading(true);
        try {
            const res = await calculatorService.calculateOptionPrice({
                spot: inputs.spot,
                strike: inputs.strike,
                timeToExpiry: inputs.timeToExpiry,
                volatility: inputs.volatility,
                riskFreeRate: inputs.riskFreeRate,
            });
            setResult(res);
        } catch (err) {
            console.error('Calculation error:', err);
        } finally {
            setLoading(false);
        }
    };

    const updateInput = (key, value) => {
        setInputs(prev => ({ ...prev, [key]: value }));
    };

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <InputField label="Spot Price" value={inputs.spot} onChange={(v) => updateInput('spot', v)} />
                <InputField label="Strike Price" value={inputs.strike} onChange={(v) => updateInput('strike', v)} />
                <InputField label="Days to Expiry" value={Math.round(inputs.timeToExpiry * 365)} onChange={(v) => updateInput('timeToExpiry', v / 365)} />
                <InputField label="Volatility" value={inputs.volatility * 100} onChange={(v) => updateInput('volatility', v / 100)} suffix="%" step={0.1} />
                <InputField label="Risk-Free Rate" value={inputs.riskFreeRate * 100} onChange={(v) => updateInput('riskFreeRate', v / 100)} suffix="%" step={0.1} />
            </div>

            <Button onClick={handleCalculate} disabled={loading} className="w-full">
                {loading ? <ArrowPathIcon className="w-5 h-5 animate-spin" /> : 'Calculate'}
            </Button>

            {result && (
                <div className="space-y-4">
                    {/* Prices */}
                    <div className="grid grid-cols-2 gap-4">
                        <ResultCard label="Call Price" value={`₹${result.call_price}`} color="green" />
                        <ResultCard label="Put Price" value={`₹${result.put_price}`} color="red" />
                    </div>

                    {/* Greeks */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <ResultCard label="Call Delta" value={result.greeks.call_delta} color="blue" />
                        <ResultCard label="Put Delta" value={result.greeks.put_delta} color="blue" />
                        <ResultCard label="Gamma" value={result.greeks.gamma} color="purple" />
                        <ResultCard label="Vega" value={result.greeks.vega} color="purple" />
                        <ResultCard label="Call Theta" value={result.greeks.call_theta} color="blue" />
                        <ResultCard label="Put Theta" value={result.greeks.put_theta} color="blue" />
                        <ResultCard label="Call Rho" value={result.greeks.call_rho} color="purple" />
                        <ResultCard label="Put Rho" value={result.greeks.put_rho} color="purple" />
                    </div>
                </div>
            )}
        </div>
    );
};

/**
 * SIP Calculator
 */
const SIPCalculator = () => {
    const [inputs, setInputs] = useState({
        monthlyInvestment: 10000,
        annualReturn: 12,
        years: 10,
    });
    const [result, setResult] = useState(null);
    const [loading, setLoading] = useState(false);

    const handleCalculate = async () => {
        setLoading(true);
        try {
            const res = await calculatorService.calculateSIP(inputs);
            setResult(res);
        } catch (err) {
            console.error('Calculation error:', err);
        } finally {
            setLoading(false);
        }
    };

    const updateInput = (key, value) => {
        setInputs(prev => ({ ...prev, [key]: value }));
    };

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-3 gap-4">
                <InputField label="Monthly Investment" value={inputs.monthlyInvestment} onChange={(v) => updateInput('monthlyInvestment', v)} />
                <InputField label="Expected Return" value={inputs.annualReturn} onChange={(v) => updateInput('annualReturn', v)} suffix="%" />
                <InputField label="Duration" value={inputs.years} onChange={(v) => updateInput('years', v)} suffix="years" />
            </div>

            <Button onClick={handleCalculate} disabled={loading} className="w-full">
                {loading ? <ArrowPathIcon className="w-5 h-5 animate-spin" /> : 'Calculate'}
            </Button>

            {result && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <ResultCard label="Total Investment" value={`₹${result.total_investment.toLocaleString()}`} color="blue" />
                    <ResultCard label="Future Value" value={`₹${result.future_value.toLocaleString()}`} color="green" />
                    <ResultCard label="Wealth Gained" value={`₹${result.wealth_gained.toLocaleString()}`} color="purple" />
                    <ResultCard label="Returns" value={`${result.returns_percentage}%`} color="green" />
                </div>
            )}
        </div>
    );
};

/**
 * Lumpsum Calculator
 */
const LumpsumCalculator = () => {
    const [inputs, setInputs] = useState({
        principal: 100000,
        annualReturn: 12,
        years: 10,
    });
    const [result, setResult] = useState(null);
    const [loading, setLoading] = useState(false);

    const handleCalculate = async () => {
        setLoading(true);
        try {
            const res = await calculatorService.calculateLumpsum(inputs);
            setResult(res);
        } catch (err) {
            console.error('Calculation error:', err);
        } finally {
            setLoading(false);
        }
    };

    const updateInput = (key, value) => {
        setInputs(prev => ({ ...prev, [key]: value }));
    };

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-3 gap-4">
                <InputField label="Principal Amount" value={inputs.principal} onChange={(v) => updateInput('principal', v)} />
                <InputField label="Expected Return" value={inputs.annualReturn} onChange={(v) => updateInput('annualReturn', v)} suffix="%" />
                <InputField label="Duration" value={inputs.years} onChange={(v) => updateInput('years', v)} suffix="years" />
            </div>

            <Button onClick={handleCalculate} disabled={loading} className="w-full">
                {loading ? <ArrowPathIcon className="w-5 h-5 animate-spin" /> : 'Calculate'}
            </Button>

            {result && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <ResultCard label="Principal" value={`₹${result.principal.toLocaleString()}`} color="blue" />
                    <ResultCard label="Future Value" value={`₹${result.future_value.toLocaleString()}`} color="green" />
                    <ResultCard label="Wealth Gained" value={`₹${result.wealth_gained.toLocaleString()}`} color="purple" />
                    <ResultCard label="Returns" value={`${result.returns_percentage}%`} color="green" />
                </div>
            )}
        </div>
    );
};

/**
 * SWP Calculator
 */
const SWPCalculator = () => {
    const [inputs, setInputs] = useState({
        initialInvestment: 1000000,
        monthlyWithdrawal: 10000,
        annualReturn: 8,
        years: 20,
    });
    const [result, setResult] = useState(null);
    const [loading, setLoading] = useState(false);

    const handleCalculate = async () => {
        setLoading(true);
        try {
            const res = await calculatorService.calculateSWP(inputs);
            setResult(res);
        } catch (err) {
            console.error('Calculation error:', err);
        } finally {
            setLoading(false);
        }
    };

    const updateInput = (key, value) => {
        setInputs(prev => ({ ...prev, [key]: value }));
    };

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <InputField label="Initial Investment" value={inputs.initialInvestment} onChange={(v) => updateInput('initialInvestment', v)} />
                <InputField label="Monthly Withdrawal" value={inputs.monthlyWithdrawal} onChange={(v) => updateInput('monthlyWithdrawal', v)} />
                <InputField label="Expected Return" value={inputs.annualReturn} onChange={(v) => updateInput('annualReturn', v)} suffix="%" />
                <InputField label="Duration" value={inputs.years} onChange={(v) => updateInput('years', v)} suffix="years" />
            </div>

            <Button onClick={handleCalculate} disabled={loading} className="w-full">
                {loading ? <ArrowPathIcon className="w-5 h-5 animate-spin" /> : 'Calculate'}
            </Button>

            {result && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <ResultCard label="Initial Investment" value={`₹${result.initial_investment.toLocaleString()}`} color="blue" />
                    <ResultCard label="Total Withdrawn" value={`₹${result.total_withdrawn.toLocaleString()}`} color="green" />
                    <ResultCard label="Final Balance" value={`₹${result.final_balance.toLocaleString()}`} color="purple" />
                    <ResultCard label="Withdrawals" value={`${result.monthly_withdrawals} months`} color="blue" />
                </div>
            )}
        </div>
    );
};

/**
 * Calculators Page
 */
const Calculators = () => {
    const isAuthenticated = useSelector(selectIsAuthenticated);
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState('option');

    if (!isAuthenticated) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
                <h2 className="text-2xl font-bold dark:text-white">Authentication Required</h2>
                <p className="text-gray-600 dark:text-gray-400">Please log in to use calculators.</p>
                <Button onClick={() => navigate('/login')}>Login Now</Button>
            </div>
        );
    }

    const renderCalculator = () => {
        switch (activeTab) {
            case 'option':
                return <OptionCalculator />;
            case 'sip':
                return <SIPCalculator />;
            case 'lumpsum':
                return <LumpsumCalculator />;
            case 'swp':
                return <SWPCalculator />;
            default:
                return <OptionCalculator />;
        }
    };

    return (
        <>
            <Helmet>
                <title>Calculators | Stockify</title>
                <meta name="description" content="Financial calculators for options, SIP, Lumpsum, and SWP" />
            </Helmet>

            <div className="w-full px-4 py-4 space-y-6">
                {/* Header */}
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <CalculatorIcon className="w-7 h-7" />
                        Calculators
                    </h1>
                    <p className="text-sm text-gray-500 mt-1">
                        Financial calculators for options and investments
                    </p>
                </div>

                {/* Tabs */}
                <div className="flex gap-2 overflow-x-auto pb-2">
                    {CALCULATOR_TABS.map((tab) => {
                        const Icon = tab.icon;
                        const isActive = activeTab === tab.id;

                        return (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`flex items-center gap-2 px-4 py-2 rounded-xl whitespace-nowrap transition-all ${isActive
                                    ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/30'
                                    : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                                    }`}
                            >
                                <Icon className="w-5 h-5" />
                                {tab.label}
                            </button>
                        );
                    })}
                </div>

                {/* Calculator Content */}
                <Card variant="glass" className="p-6">
                    {renderCalculator()}
                </Card>

                {/* Info */}
                <div className="text-xs text-gray-400 text-center">
                    All calculations are for educational purposes.
                    Consult a financial advisor for investment decisions.
                </div>
            </div>
        </>
    );
};

export default Calculators;
