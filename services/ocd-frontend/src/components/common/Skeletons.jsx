/**
 * Skeleton Loading Components
 * Provides smooth loading placeholders for various UI elements
 */
import React from 'react';

// Base skeleton with shimmer animation
const SkeletonBase = ({ className = '', children }) => (
    <div className={`animate-pulse bg-gray-800 rounded ${className}`}>
        {children}
    </div>
);

// Post card skeleton
export const PostSkeleton = () => (
    <div className="p-5 border-b border-gray-800">
        <div className="flex items-start gap-4">
            <SkeletonBase className="w-10 h-10 rounded-lg flex-shrink-0" />
            <div className="flex-1 min-w-0 space-y-3">
                <div className="flex items-center gap-2">
                    <SkeletonBase className="h-4 w-24" />
                    <SkeletonBase className="h-3 w-16" />
                </div>
                <SkeletonBase className="h-4 w-full" />
                <SkeletonBase className="h-4 w-3/4" />
                <div className="flex gap-4 pt-2">
                    <SkeletonBase className="h-6 w-16" />
                    <SkeletonBase className="h-6 w-16" />
                    <SkeletonBase className="h-6 w-20" />
                </div>
            </div>
        </div>
    </div>
);

// Feed skeleton (multiple post skeletons)
export const FeedSkeleton = ({ count = 5 }) => (
    <div className="divide-y divide-gray-800">
        {Array.from({ length: count }).map((_, i) => (
            <PostSkeleton key={i} />
        ))}
    </div>
);

// Card skeleton
export const CardSkeleton = ({ className = '' }) => (
    <div className={`bg-gray-900/40 border border-gray-800 rounded-xl p-5 ${className}`}>
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <SkeletonBase className="h-5 w-32" />
                <SkeletonBase className="h-6 w-16 rounded-full" />
            </div>
            <SkeletonBase className="h-4 w-full" />
            <SkeletonBase className="h-4 w-2/3" />
            <div className="flex gap-2 pt-2">
                <SkeletonBase className="h-8 w-20 rounded-lg" />
                <SkeletonBase className="h-8 w-20 rounded-lg" />
            </div>
        </div>
    </div>
);

// Room list skeleton
export const RoomListSkeleton = ({ count = 4 }) => (
    <div className="space-y-2">
        {Array.from({ length: count }).map((_, i) => (
            <SkeletonBase key={i} className="h-10 w-full rounded-lg" />
        ))}
    </div>
);

// Stats skeleton
export const StatsSkeleton = () => (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-gray-900/40 border border-gray-800 rounded-xl p-4">
                <SkeletonBase className="h-3 w-20 mb-2" />
                <SkeletonBase className="h-8 w-16 mb-1" />
                <SkeletonBase className="h-3 w-24" />
            </div>
        ))}
    </div>
);

// Table row skeleton
export const TableRowSkeleton = ({ columns = 5 }) => (
    <tr className="border-b border-gray-800">
        {Array.from({ length: columns }).map((_, i) => (
            <td key={i} className="px-4 py-3">
                <SkeletonBase className="h-4 w-full" />
            </td>
        ))}
    </tr>
);

// Avatar skeleton
export const AvatarSkeleton = ({ size = 'md' }) => {
    const sizes = {
        sm: 'w-8 h-8',
        md: 'w-10 h-10',
        lg: 'w-12 h-12',
    };
    return <SkeletonBase className={`${sizes[size]} rounded-full`} />;
};

// Text line skeleton
export const TextSkeleton = ({ width = 'full', height = '4' }) => (
    <SkeletonBase className={`h-${height} w-${width}`} />
);

// Sidebar skeleton
export const SidebarSkeleton = () => (
    <div className="p-4 space-y-6">
        <div className="space-y-2">
            <SkeletonBase className="h-3 w-16 mb-3" />
            {Array.from({ length: 3 }).map((_, i) => (
                <SkeletonBase key={i} className="h-9 w-full rounded-lg" />
            ))}
        </div>
        <div className="space-y-2">
            <SkeletonBase className="h-3 w-20 mb-3" />
            {Array.from({ length: 5 }).map((_, i) => (
                <SkeletonBase key={i} className="h-8 w-full rounded" />
            ))}
        </div>
    </div>
);

export default {
    PostSkeleton,
    FeedSkeleton,
    CardSkeleton,
    RoomListSkeleton,
    StatsSkeleton,
    TableRowSkeleton,
    AvatarSkeleton,
    TextSkeleton,
    SidebarSkeleton,
};
