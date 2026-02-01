/**
 * Common Components Index
 * Export all reusable UI components from a single entry point
 */

export { default as Button } from './Button';
export { default as Card } from './Card';
export { default as Input } from './Input';
export { default as Modal } from './Modal';
export { default as Badge } from './Badge';
export { default as Spinner, LoadingOverlay } from './Spinner';
export { default as Skeleton, CardSkeleton, StatsGridSkeleton, TableSkeleton, ChartSkeleton, DashboardSkeleton, AnalyticsSkeleton } from './Skeleton';
export { default as ErrorBoundary } from './ErrorBoundary';
export { PostSkeleton, FeedSkeleton, RoomListSkeleton, AvatarSkeleton, SidebarSkeleton } from './Skeletons';

// Animated Components
export {
    AnimatedCounter,
    PulseDot,
    ShimmerText,
    TrendIndicator,
    AnimatedProgress,
    Tooltip,
    StatCard,
    AnimatedListItem,
} from './AnimatedComponents';

// Data Display Components
export {
    PriceDisplay,
    DataCell,
    MiniChart,
    Gauge,
    ComparisonBar,
} from './DataDisplay';

// Re-export for convenience
export * from './Button';
export * from './Card';
export * from './Input';
export * from './Modal';

