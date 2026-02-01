/**
 * Data Display Components
 * 
 * Specialized components for displaying financial data with
 * proper formatting, color coding, and responsive design.
 */
import PropTypes from 'prop-types';
import { memo, useMemo } from 'react';
import { motion } from 'framer-motion';

// ============ PRICE DISPLAY ============
/**
 * Formatted price with change indicator
 */
export const PriceDisplay = memo(({
    price,
    change,
    changePercent,
    size = 'md',
    showChange = true,
    className = '',
}) => {
    const isPositive = change > 0;
    const isNegative = change < 0;

    const sizes = {
        sm: { price: 'text-lg', change: 'text-xs' },
        md: { price: 'text-2xl', change: 'text-sm' },
        lg: { price: 'text-3xl', change: 'text-base' },
        xl: { price: 'text-4xl', change: 'text-lg' },
    };

    const formatPrice = (p) => {
        if (p >= 10000) return p.toLocaleString('en-IN');
        return p.toFixed(2);
    };

    return (
        <div className={`flex flex-col ${className}`}>
            <span className={`font-bold ${sizes[size].price} text-gray-900 dark:text-white font-mono tabular-nums`}>
                ₹{formatPrice(price)}
            </span>
            {showChange && change !== undefined && (
                <div className="flex items-center gap-2 mt-1">
                    <span className={`
                        ${sizes[size].change} font-medium font-mono tabular-nums
                        ${isPositive ? 'text-emerald-600 dark:text-emerald-400' : ''}
                        ${isNegative ? 'text-rose-600 dark:text-rose-400' : ''}
                        ${!isPositive && !isNegative ? 'text-gray-500' : ''}
                    `}>
                        {isPositive ? '+' : ''}{change.toFixed(2)}
                    </span>
                    {changePercent !== undefined && (
                        <span className={`
                            ${sizes[size].change} px-1.5 py-0.5 rounded font-medium
                            ${isPositive ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : ''}
                            ${isNegative ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400' : ''}
                            ${!isPositive && !isNegative ? 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400' : ''}
                        `}>
                            {isPositive ? '+' : ''}{changePercent.toFixed(2)}%
                        </span>
                    )}
                </div>
            )}
        </div>
    );
});

PriceDisplay.displayName = 'PriceDisplay';

PriceDisplay.propTypes = {
    price: PropTypes.number.isRequired,
    change: PropTypes.number,
    changePercent: PropTypes.number,
    size: PropTypes.oneOf(['sm', 'md', 'lg', 'xl']),
    showChange: PropTypes.bool,
    className: PropTypes.string,
};

// ============ DATA CELL ============
/**
 * Table cell with automatic number formatting and color coding
 */
export const DataCell = memo(({
    value,
    format = 'number',
    colorCoded = true,
    align = 'right',
    className = '',
    size = 'md',
}) => {
    const formattedValue = useMemo(() => {
        if (value === null || value === undefined) return '—';

        switch (format) {
            case 'number':
                return value.toLocaleString('en-IN');
            case 'decimal':
                return value.toFixed(2);
            case 'percent':
                return `${value.toFixed(2)}%`;
            case 'currency':
                return `₹${value.toLocaleString('en-IN')}`;
            case 'compact':
                if (Math.abs(value) >= 10000000) return `${(value / 10000000).toFixed(2)}Cr`;
                if (Math.abs(value) >= 100000) return `${(value / 100000).toFixed(2)}L`;
                if (Math.abs(value) >= 1000) return `${(value / 1000).toFixed(1)}K`;
                return value.toFixed(0);
            default:
                return value;
        }
    }, [value, format]);

    const isPositive = typeof value === 'number' && value > 0;
    const isNegative = typeof value === 'number' && value < 0;

    const sizes = {
        sm: 'text-xs',
        md: 'text-sm',
        lg: 'text-base',
    };

    const alignments = {
        left: 'text-left',
        center: 'text-center',
        right: 'text-right',
    };

    return (
        <span className={`
            font-mono tabular-nums ${sizes[size]} ${alignments[align]}
            ${colorCoded && isPositive ? 'text-emerald-600 dark:text-emerald-400' : ''}
            ${colorCoded && isNegative ? 'text-rose-600 dark:text-rose-400' : ''}
            ${!colorCoded || (!isPositive && !isNegative) ? 'text-gray-900 dark:text-gray-100' : ''}
            ${className}
        `}>
            {formattedValue}
        </span>
    );
});

DataCell.displayName = 'DataCell';

DataCell.propTypes = {
    value: PropTypes.number,
    format: PropTypes.oneOf(['number', 'decimal', 'percent', 'currency', 'compact']),
    colorCoded: PropTypes.bool,
    align: PropTypes.oneOf(['left', 'center', 'right']),
    className: PropTypes.string,
    size: PropTypes.oneOf(['sm', 'md', 'lg']),
};

// ============ MINI CHART (Sparkline) ============
export const MiniChart = memo(({
    data,
    width = 120,
    height = 40,
    color = 'auto',
    strokeWidth = 1.5,
    showArea = true,
    className = '',
}) => {
    const { path, areaPath, isPositive } = useMemo(() => {
        if (!data || data.length < 2) return { path: '', areaPath: '', isPositive: true };

        const min = Math.min(...data);
        const max = Math.max(...data);
        const range = max - min || 1;
        const padding = 2;

        const points = data.map((value, index) => ({
            x: padding + (index / (data.length - 1)) * (width - padding * 2),
            y: padding + ((max - value) / range) * (height - padding * 2),
        }));

        const linePath = points.map((p, i) =>
            `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`
        ).join(' ');

        const areaPath = `${linePath} L ${points[points.length - 1].x} ${height} L ${points[0].x} ${height} Z`;

        return {
            path: linePath,
            areaPath,
            isPositive: data[data.length - 1] >= data[0],
        };
    }, [data, width, height]);

    const strokeColor = color === 'auto'
        ? (isPositive ? '#10b981' : '#f43f5e')
        : color;

    const fillColor = color === 'auto'
        ? (isPositive ? 'rgba(16, 185, 129, 0.1)' : 'rgba(244, 63, 94, 0.1)')
        : `${color}20`;

    if (!data || data.length < 2) {
        return <div className={`w-[${width}px] h-[${height}px] ${className}`} />;
    }

    return (
        <svg
            width={width}
            height={height}
            viewBox={`0 0 ${width} ${height}`}
            className={className}
        >
            {showArea && (
                <path
                    d={areaPath}
                    fill={fillColor}
                />
            )}
            <path
                d={path}
                fill="none"
                stroke={strokeColor}
                strokeWidth={strokeWidth}
                strokeLinecap="round"
                strokeLinejoin="round"
            />
        </svg>
    );
});

MiniChart.displayName = 'MiniChart';

MiniChart.propTypes = {
    data: PropTypes.arrayOf(PropTypes.number).isRequired,
    width: PropTypes.number,
    height: PropTypes.number,
    color: PropTypes.string,
    strokeWidth: PropTypes.number,
    showArea: PropTypes.bool,
    className: PropTypes.string,
};

// ============ GAUGE COMPONENT ============
export const Gauge = memo(({
    value,
    min = 0,
    max = 100,
    size = 120,
    thickness = 10,
    color = 'auto',
    showValue = true,
    label = '',
    className = '',
}) => {
    const percentage = Math.min(Math.max((value - min) / (max - min), 0), 1);
    const circumference = 2 * Math.PI * ((size - thickness) / 2);
    const strokeDashoffset = circumference * (1 - percentage * 0.75); // 270 degrees = 0.75

    const getColor = () => {
        if (color !== 'auto') return color;
        if (percentage < 0.33) return '#f43f5e';
        if (percentage < 0.66) return '#f59e0b';
        return '#10b981';
    };

    return (
        <div className={`relative inline-flex items-center justify-center ${className}`}>
            <svg
                width={size}
                height={size}
                viewBox={`0 0 ${size} ${size}`}
                className="transform -rotate-135"
            >
                {/* Background arc */}
                <circle
                    cx={size / 2}
                    cy={size / 2}
                    r={(size - thickness) / 2}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={thickness}
                    strokeLinecap="round"
                    strokeDasharray={`${circumference * 0.75} ${circumference}`}
                    className="text-gray-200 dark:text-gray-700"
                />
                {/* Value arc */}
                <motion.circle
                    cx={size / 2}
                    cy={size / 2}
                    r={(size - thickness) / 2}
                    fill="none"
                    stroke={getColor()}
                    strokeWidth={thickness}
                    strokeLinecap="round"
                    strokeDasharray={`${circumference * 0.75} ${circumference}`}
                    initial={{ strokeDashoffset: circumference }}
                    animate={{ strokeDashoffset }}
                    transition={{ duration: 1, ease: 'easeOut' }}
                />
            </svg>
            {showValue && (
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-2xl font-bold text-gray-900 dark:text-white">
                        {value.toFixed(0)}
                    </span>
                    {label && (
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                            {label}
                        </span>
                    )}
                </div>
            )}
        </div>
    );
});

Gauge.displayName = 'Gauge';

Gauge.propTypes = {
    value: PropTypes.number.isRequired,
    min: PropTypes.number,
    max: PropTypes.number,
    size: PropTypes.number,
    thickness: PropTypes.number,
    color: PropTypes.string,
    showValue: PropTypes.bool,
    label: PropTypes.string,
    className: PropTypes.string,
};

// ============ COMPARISON BAR ============
export const ComparisonBar = memo(({
    leftValue,
    rightValue,
    leftLabel = '',
    rightLabel = '',
    leftColor = 'emerald',
    rightColor = 'rose',
    height = 'md',
    className = '',
}) => {
    const total = leftValue + rightValue;
    const leftPercent = total > 0 ? (leftValue / total) * 100 : 50;
    const rightPercent = 100 - leftPercent;

    const heights = {
        sm: 'h-2',
        md: 'h-4',
        lg: 'h-6',
    };

    const colors = {
        emerald: 'bg-emerald-500',
        rose: 'bg-rose-500',
        blue: 'bg-blue-500',
        amber: 'bg-amber-500',
    };

    return (
        <div className={className}>
            {(leftLabel || rightLabel) && (
                <div className="flex justify-between text-xs mb-1">
                    <span className="text-gray-600 dark:text-gray-400">
                        {leftLabel} <span className="font-semibold">{leftPercent.toFixed(1)}%</span>
                    </span>
                    <span className="text-gray-600 dark:text-gray-400">
                        <span className="font-semibold">{rightPercent.toFixed(1)}%</span> {rightLabel}
                    </span>
                </div>
            )}
            <div className={`flex rounded-full overflow-hidden ${heights[height]}`}>
                <motion.div
                    className={`${colors[leftColor]}`}
                    initial={{ width: 0 }}
                    animate={{ width: `${leftPercent}%` }}
                    transition={{ duration: 0.5, ease: 'easeOut' }}
                />
                <motion.div
                    className={`${colors[rightColor]}`}
                    initial={{ width: 0 }}
                    animate={{ width: `${rightPercent}%` }}
                    transition={{ duration: 0.5, ease: 'easeOut' }}
                />
            </div>
        </div>
    );
});

ComparisonBar.displayName = 'ComparisonBar';

ComparisonBar.propTypes = {
    leftValue: PropTypes.number.isRequired,
    rightValue: PropTypes.number.isRequired,
    leftLabel: PropTypes.string,
    rightLabel: PropTypes.string,
    leftColor: PropTypes.oneOf(['emerald', 'rose', 'blue', 'amber']),
    rightColor: PropTypes.oneOf(['emerald', 'rose', 'blue', 'amber']),
    height: PropTypes.oneOf(['sm', 'md', 'lg']),
    className: PropTypes.string,
};

// ============ EXPORTS ============
export default {
    PriceDisplay,
    DataCell,
    MiniChart,
    Gauge,
    ComparisonBar,
};
