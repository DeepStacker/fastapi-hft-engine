/**
 * Premium Skeleton Components
 * Shimmer loading placeholders for polished UX
 */
import PropTypes from 'prop-types';

/**
 * Base Skeleton with shimmer animation
 */
const Skeleton = ({ className = '', variant = 'default' }) => {
    const baseClasses = 'animate-pulse bg-gradient-to-r from-slate-200 via-slate-100 to-slate-200 dark:from-slate-800 dark:via-slate-700 dark:to-slate-800 bg-[length:200%_100%] rounded';
    
    const variantClasses = {
        default: '',
        circle: 'rounded-full',
        card: 'rounded-2xl',
    };

    return (
        <div 
            className={`${baseClasses} ${variantClasses[variant]} ${className}`}
            style={{ animation: 'shimmer 1.5s ease-in-out infinite' }}
        />
    );
};

/**
 * Premium Card Skeleton
 */
export const CardSkeleton = ({ showIcon = true }) => (
    <div className="relative overflow-hidden rounded-2xl p-5 bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
        <div className="flex items-start justify-between">
            {showIcon && <Skeleton className="w-12 h-12 rounded-xl" />}
        </div>
        <Skeleton className="h-3 w-24 mt-4" />
        <Skeleton className="h-8 w-32 mt-2" />
        <Skeleton className="h-3 w-20 mt-2" />
    </div>
);

/**
 * Stats Grid Skeleton (4 cards)
 */
export const StatsGridSkeleton = () => (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map(i => (
            <CardSkeleton key={i} />
        ))}
    </div>
);

/**
 * Table Row Skeleton
 */
export const TableRowSkeleton = ({ columns = 6 }) => (
    <div className="flex items-center gap-2 py-2 px-4 border-b border-slate-100 dark:border-slate-800">
        {Array(columns).fill(0).map((_, i) => (
            <Skeleton key={i} className={`h-5 ${i === 0 ? 'w-16' : 'flex-1'}`} />
        ))}
    </div>
);

/**
 * Table Skeleton
 */
export const TableSkeleton = ({ rows = 10, columns = 6 }) => (
    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-2 py-3 px-4 bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700">
            {Array(columns).fill(0).map((_, i) => (
                <Skeleton key={i} className={`h-4 ${i === 0 ? 'w-16' : 'flex-1'}`} />
            ))}
        </div>
        {/* Rows */}
        {Array(rows).fill(0).map((_, i) => (
            <TableRowSkeleton key={i} columns={columns} />
        ))}
    </div>
);

/**
 * Chart Skeleton
 */
export const ChartSkeleton = ({ height = 200 }) => (
    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-200 dark:border-slate-700">
            <Skeleton className="w-5 h-5 rounded" />
            <Skeleton className="h-5 w-40" />
        </div>
        <div className="p-4">
            <div className="flex items-end gap-2" style={{ height }}>
                {Array(20).fill(0).map((_, i) => (
                    <Skeleton 
                        key={i} 
                        className="flex-1 rounded-t" 
                        style={{ height: `${20 + Math.random() * 80}%` }}
                    />
                ))}
            </div>
        </div>
    </div>
);

/**
 * Dashboard Hero Skeleton
 */
export const HeroSkeleton = () => (
    <div className="rounded-3xl p-8 bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
        <Skeleton className="h-4 w-32 mb-3" />
        <Skeleton className="h-10 w-64 mb-2" />
        <Skeleton className="h-5 w-48" />
    </div>
);

/**
 * Feature Grid Skeleton
 */
export const FeatureGridSkeleton = () => (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map(i => (
            <div key={i} className="rounded-2xl p-5 bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
                <Skeleton className="w-12 h-12 rounded-xl mb-4" />
                <Skeleton className="h-5 w-28 mb-2" />
                <Skeleton className="h-4 w-full" />
            </div>
        ))}
    </div>
);

/**
 * Full Analytics Tab Skeleton
 */
export const AnalyticsSkeleton = () => (
    <div className="space-y-6">
        <StatsGridSkeleton />
        <ChartSkeleton height={300} />
        <TableSkeleton rows={8} />
    </div>
);

/**
 * Full Dashboard Skeleton
 */
export const DashboardSkeleton = () => (
    <div className="w-full px-4 py-6 space-y-6">
        <HeroSkeleton />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <CardSkeleton showIcon={false} />
            <CardSkeleton showIcon={false} />
        </div>
        <FeatureGridSkeleton />
    </div>
);

// PropTypes
Skeleton.propTypes = {
    className: PropTypes.string,
    variant: PropTypes.oneOf(['default', 'circle', 'card']),
};

CardSkeleton.propTypes = {
    showIcon: PropTypes.bool,
};

TableRowSkeleton.propTypes = {
    columns: PropTypes.number,
};

TableSkeleton.propTypes = {
    rows: PropTypes.number,
    columns: PropTypes.number,
};

ChartSkeleton.propTypes = {
    height: PropTypes.number,
};

export default Skeleton;
