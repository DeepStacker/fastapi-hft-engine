/**
 * Premium Animated Components
 * 
 * Enhanced UI components with smooth animations, micro-interactions,
 * and premium visual effects for a polished trading experience.
 */
import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import PropTypes from 'prop-types';

// ============ ANIMATED COUNTER ============
/**
 * Smooth number counter with animation
 * Perfect for displaying changing values like prices, percentages
 */
export const AnimatedCounter = ({
    value,
    duration = 0.5,
    decimals = 2,
    prefix = '',
    suffix = '',
    className = '',
    colorChange = true,
}) => {
    const [displayValue, setDisplayValue] = useState(value);
    const [trend, setTrend] = useState('neutral'); // 'up', 'down', 'neutral'
    const prevValue = useRef(value);

    useEffect(() => {
        if (value !== prevValue.current) {
            setTrend(value > prevValue.current ? 'up' : value < prevValue.current ? 'down' : 'neutral');
            prevValue.current = value;
        }

        // Animate from current display to new value
        const startValue = displayValue;
        const endValue = value;
        const startTime = Date.now();
        const durationMs = duration * 1000;

        const animate = () => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / durationMs, 1);

            // Easing function (ease-out cubic)
            const eased = 1 - Math.pow(1 - progress, 3);

            const current = startValue + (endValue - startValue) * eased;
            setDisplayValue(current);

            if (progress < 1) {
                requestAnimationFrame(animate);
            }
        };

        requestAnimationFrame(animate);
    }, [value, duration]); // eslint-disable-line react-hooks/exhaustive-deps

    const trendColors = {
        up: 'text-emerald-500',
        down: 'text-rose-500',
        neutral: '',
    };

    return (
        <span className={`font-mono tabular-nums ${colorChange ? trendColors[trend] : ''} ${className}`}>
            {prefix}{displayValue.toFixed(decimals)}{suffix}
        </span>
    );
};

AnimatedCounter.propTypes = {
    value: PropTypes.number.isRequired,
    duration: PropTypes.number,
    decimals: PropTypes.number,
    prefix: PropTypes.string,
    suffix: PropTypes.string,
    className: PropTypes.string,
    colorChange: PropTypes.bool,
};

// ============ PULSE DOT (LIVE INDICATOR) ============
export const PulseDot = ({ color = 'emerald', size = 'md', className = '' }) => {
    const sizes = {
        sm: 'w-2 h-2',
        md: 'w-3 h-3',
        lg: 'w-4 h-4',
    };

    const colors = {
        emerald: 'bg-emerald-500',
        blue: 'bg-blue-500',
        rose: 'bg-rose-500',
        amber: 'bg-amber-500',
    };

    return (
        <span className={`relative inline-flex ${className}`}>
            <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${colors[color]} opacity-75`} />
            <span className={`relative inline-flex rounded-full ${sizes[size]} ${colors[color]}`} />
        </span>
    );
};

PulseDot.propTypes = {
    color: PropTypes.oneOf(['emerald', 'blue', 'rose', 'amber']),
    size: PropTypes.oneOf(['sm', 'md', 'lg']),
    className: PropTypes.string,
};

// ============ SHIMMER TEXT (Loading State) ============
export const ShimmerText = ({ children, className = '' }) => (
    <span
        className={`
            inline-block bg-gradient-to-r from-gray-400 via-gray-200 to-gray-400
            dark:from-gray-600 dark:via-gray-400 dark:to-gray-600
            bg-[length:200%_100%] animate-shimmer bg-clip-text text-transparent
            ${className}
        `}
        style={{ animation: 'shimmer 1.5s ease-in-out infinite' }}
    >
        {children}
    </span>
);

ShimmerText.propTypes = {
    children: PropTypes.node.isRequired,
    className: PropTypes.string,
};

// ============ TREND INDICATOR ============
export const TrendIndicator = ({ value, showValue = true, size = 'md', className = '' }) => {
    const isPositive = value > 0;
    const isNeutral = value === 0;

    const sizes = {
        sm: 'text-xs',
        md: 'text-sm',
        lg: 'text-base',
    };

    const iconSizes = {
        sm: 'w-3 h-3',
        md: 'w-4 h-4',
        lg: 'w-5 h-5',
    };

    if (isNeutral) {
        return (
            <span className={`inline-flex items-center gap-1 text-gray-500 ${sizes[size]} ${className}`}>
                <span className={`${iconSizes[size]} flex items-center justify-center`}>—</span>
                {showValue && <span>0.00%</span>}
            </span>
        );
    }

    return (
        <motion.span
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className={`
                inline-flex items-center gap-1 font-medium
                ${isPositive ? 'text-emerald-500' : 'text-rose-500'}
                ${sizes[size]} ${className}
            `}
        >
            <svg
                className={`${iconSizes[size]} ${isPositive ? '' : 'rotate-180'}`}
                fill="currentColor"
                viewBox="0 0 20 20"
            >
                <path
                    fillRule="evenodd"
                    d="M5.293 7.707a1 1 0 010-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 01-1.414 1.414L11 5.414V17a1 1 0 11-2 0V5.414L6.707 7.707a1 1 0 01-1.414 0z"
                    clipRule="evenodd"
                />
            </svg>
            {showValue && <span>{isPositive ? '+' : ''}{value.toFixed(2)}%</span>}
        </motion.span>
    );
};

TrendIndicator.propTypes = {
    value: PropTypes.number.isRequired,
    showValue: PropTypes.bool,
    size: PropTypes.oneOf(['sm', 'md', 'lg']),
    className: PropTypes.string,
};

// ============ ANIMATED PROGRESS BAR ============
export const AnimatedProgress = ({
    value,
    max = 100,
    color = 'blue',
    size = 'md',
    showLabel = false,
    animated = true,
    className = '',
}) => {
    const percentage = Math.min(Math.max((value / max) * 100, 0), 100);

    const colors = {
        blue: 'from-blue-500 to-indigo-500',
        emerald: 'from-emerald-500 to-teal-500',
        rose: 'from-rose-500 to-pink-500',
        amber: 'from-amber-500 to-orange-500',
        purple: 'from-purple-500 to-violet-500',
    };

    const sizes = {
        sm: 'h-1',
        md: 'h-2',
        lg: 'h-3',
        xl: 'h-4',
    };

    return (
        <div className={`w-full ${className}`}>
            <div className={`w-full bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden ${sizes[size]}`}>
                <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${percentage}%` }}
                    transition={{ duration: 0.5, ease: 'easeOut' }}
                    className={`
                        h-full rounded-full bg-gradient-to-r ${colors[color]}
                        ${animated ? 'animate-pulse' : ''}
                    `}
                />
            </div>
            {showLabel && (
                <span className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    {percentage.toFixed(0)}%
                </span>
            )}
        </div>
    );
};

AnimatedProgress.propTypes = {
    value: PropTypes.number.isRequired,
    max: PropTypes.number,
    color: PropTypes.oneOf(['blue', 'emerald', 'rose', 'amber', 'purple']),
    size: PropTypes.oneOf(['sm', 'md', 'lg', 'xl']),
    showLabel: PropTypes.bool,
    animated: PropTypes.bool,
    className: PropTypes.string,
};

// ============ TOOLTIP ============
export const Tooltip = ({ content, children, position = 'top', delay = 200 }) => {
    const [isVisible, setIsVisible] = useState(false);
    const [shouldRender, setShouldRender] = useState(false);
    const timeoutRef = useRef(null);

    const handleMouseEnter = () => {
        timeoutRef.current = setTimeout(() => {
            setShouldRender(true);
            setIsVisible(true);
        }, delay);
    };

    const handleMouseLeave = () => {
        clearTimeout(timeoutRef.current);
        setIsVisible(false);
        setTimeout(() => setShouldRender(false), 150);
    };

    const positions = {
        top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
        bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
        left: 'right-full top-1/2 -translate-y-1/2 mr-2',
        right: 'left-full top-1/2 -translate-y-1/2 ml-2',
    };

    return (
        <div
            className="relative inline-flex"
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
        >
            {children}
            <AnimatePresence>
                {shouldRender && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: isVisible ? 1 : 0, scale: isVisible ? 1 : 0.95 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        transition={{ duration: 0.15 }}
                        className={`
                            absolute z-50 px-3 py-2 text-sm font-medium text-white
                            bg-gray-900 dark:bg-gray-700 rounded-lg shadow-lg
                            whitespace-nowrap ${positions[position]}
                        `}
                    >
                        {content}
                        <div
                            className={`
                                absolute w-2 h-2 bg-gray-900 dark:bg-gray-700 rotate-45
                                ${position === 'top' ? 'top-full left-1/2 -translate-x-1/2 -mt-1' : ''}
                                ${position === 'bottom' ? 'bottom-full left-1/2 -translate-x-1/2 -mb-1' : ''}
                                ${position === 'left' ? 'left-full top-1/2 -translate-y-1/2 -ml-1' : ''}
                                ${position === 'right' ? 'right-full top-1/2 -translate-y-1/2 -mr-1' : ''}
                            `}
                        />
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

Tooltip.propTypes = {
    content: PropTypes.node.isRequired,
    children: PropTypes.node.isRequired,
    position: PropTypes.oneOf(['top', 'bottom', 'left', 'right']),
    delay: PropTypes.number,
};

// ============ BADGE ============
export const Badge = ({ children, variant = 'default', size = 'md', dot = false, pulse = false, className = '' }) => {
    const variants = {
        default: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
        primary: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
        success: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400',
        warning: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
        danger: 'bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-400',
        info: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-400',
    };

    const sizes = {
        sm: 'px-2 py-0.5 text-xs',
        md: 'px-2.5 py-1 text-xs',
        lg: 'px-3 py-1 text-sm',
    };

    const dotColors = {
        default: 'bg-gray-500',
        primary: 'bg-blue-500',
        success: 'bg-emerald-500',
        warning: 'bg-amber-500',
        danger: 'bg-rose-500',
        info: 'bg-cyan-500',
    };

    return (
        <span
            className={`
                inline-flex items-center gap-1.5 font-medium rounded-full
                ${variants[variant]} ${sizes[size]} ${className}
            `}
        >
            {dot && (
                <span className={`w-1.5 h-1.5 rounded-full ${dotColors[variant]} ${pulse ? 'animate-pulse' : ''}`} />
            )}
            {children}
        </span>
    );
};

Badge.propTypes = {
    children: PropTypes.node.isRequired,
    variant: PropTypes.oneOf(['default', 'primary', 'success', 'warning', 'danger', 'info']),
    size: PropTypes.oneOf(['sm', 'md', 'lg']),
    dot: PropTypes.bool,
    pulse: PropTypes.bool,
    className: PropTypes.string,
};

// ============ STAT CARD ============
export const StatCard = ({
    title,
    value,
    change,
    changeLabel,
    icon: Icon,
    color = 'blue',
    loading = false,
    className = '',
}) => {
    const colors = {
        blue: 'from-blue-500/20 to-blue-600/10 border-blue-500/30',
        emerald: 'from-emerald-500/20 to-emerald-600/10 border-emerald-500/30',
        rose: 'from-rose-500/20 to-rose-600/10 border-rose-500/30',
        amber: 'from-amber-500/20 to-amber-600/10 border-amber-500/30',
        purple: 'from-purple-500/20 to-purple-600/10 border-purple-500/30',
    };

    const iconColors = {
        blue: 'text-blue-500',
        emerald: 'text-emerald-500',
        rose: 'text-rose-500',
        amber: 'text-amber-500',
        purple: 'text-purple-500',
    };

    if (loading) {
        return (
            <div className={`rounded-2xl p-5 bg-gradient-to-br ${colors[color]} border animate-pulse ${className}`}>
                <div className="flex items-start justify-between">
                    <div className="w-12 h-12 rounded-xl bg-gray-300 dark:bg-gray-600" />
                </div>
                <div className="h-3 w-24 bg-gray-300 dark:bg-gray-600 rounded mt-4" />
                <div className="h-8 w-32 bg-gray-300 dark:bg-gray-600 rounded mt-2" />
                <div className="h-3 w-20 bg-gray-300 dark:bg-gray-600 rounded mt-2" />
            </div>
        );
    }

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            whileHover={{ scale: 1.02, transition: { duration: 0.2 } }}
            className={`
                rounded-2xl p-5 bg-gradient-to-br ${colors[color]} border
                transition-shadow duration-300 hover:shadow-lg
                ${className}
            `}
        >
            <div className="flex items-start justify-between">
                {Icon && (
                    <div className={`p-3 rounded-xl bg-white/50 dark:bg-black/20 ${iconColors[color]}`}>
                        <Icon className="w-6 h-6" />
                    </div>
                )}
            </div>
            <p className="mt-4 text-sm font-medium text-gray-600 dark:text-gray-400">
                {title}
            </p>
            <p className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">
                {typeof value === 'number' ? (
                    <AnimatedCounter value={value} colorChange={false} />
                ) : (
                    value
                )}
            </p>
            {change !== undefined && (
                <div className="mt-2 flex items-center gap-2">
                    <TrendIndicator value={change} size="sm" />
                    {changeLabel && (
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                            {changeLabel}
                        </span>
                    )}
                </div>
            )}
        </motion.div>
    );
};

StatCard.propTypes = {
    title: PropTypes.string.isRequired,
    value: PropTypes.oneOfType([PropTypes.number, PropTypes.string]).isRequired,
    change: PropTypes.number,
    changeLabel: PropTypes.string,
    icon: PropTypes.elementType,
    color: PropTypes.oneOf(['blue', 'emerald', 'rose', 'amber', 'purple']),
    loading: PropTypes.bool,
    className: PropTypes.string,
};

// ============ ANIMATED LIST ITEM ============
export const AnimatedListItem = ({ children, index = 0, className = '' }) => {
    return (
        <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            transition={{ duration: 0.2, delay: index * 0.05 }}
            className={className}
        >
            {children}
        </motion.div>
    );
};

AnimatedListItem.propTypes = {
    children: PropTypes.node.isRequired,
    index: PropTypes.number,
    className: PropTypes.string,
};

// ============ EXPORTS ============
export default {
    AnimatedCounter,
    PulseDot,
    ShimmerText,
    TrendIndicator,
    AnimatedProgress,
    Tooltip,
    Badge,
    StatCard,
    AnimatedListItem,
};
