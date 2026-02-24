/**
 * PageLayout Component
 * 
 * Provides consistent page structure with header, breadcrumbs, 
 * and content area. Enhances user experience with smooth transitions.
 */
import { memo } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Helmet } from 'react-helmet-async';
import PropTypes from 'prop-types';
import {
    HomeIcon,
    ChevronRightIcon,
} from '@heroicons/react/24/outline';

// Page route configurations for breadcrumbs
const routeConfig = {
    '/dashboard': { title: 'Dashboard', parent: null },
    '/option-chain': { title: 'Option Chain', parent: '/dashboard' },
    '/analytics': { title: 'Analytics', parent: '/dashboard' },
    '/historical': { title: 'Historical', parent: '/dashboard' },
    '/futures': { title: 'Futures', parent: '/dashboard' },
    '/split-view': { title: 'Split View', parent: '/dashboard' },
    '/screeners': { title: 'Screeners', parent: '/dashboard' },
    '/calculators': { title: 'Calculators', parent: '/dashboard' },
    '/position-sizing': { title: 'Position Sizing', parent: '/dashboard' },
    '/tca': { title: 'TCA', parent: '/dashboard' },
    '/strategies': { title: 'Strategy Finder', parent: '/dashboard' },
    '/community': { title: 'Traders Hub', parent: '/dashboard' },
    '/admin/monitoring': { title: 'Monitoring', parent: '/dashboard' },
};

/**
 * Breadcrumb Component
 */
const Breadcrumbs = memo(({ items }) => {
    if (!items || items.length <= 1) return null;

    return (
        <nav className="flex items-center gap-1 text-sm mb-4" aria-label="Breadcrumb">
            {items.map((item, index) => {
                const isLast = index === items.length - 1;

                return (
                    <div key={item.path} className="flex items-center gap-1">
                        {index === 0 ? (
                            <Link
                                to={item.path}
                                className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                            >
                                <HomeIcon className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                            </Link>
                        ) : (
                            <>
                                <ChevronRightIcon className="w-4 h-4 text-gray-400" />
                                {isLast ? (
                                    <span className="font-medium text-gray-900 dark:text-white">
                                        {item.title}
                                    </span>
                                ) : (
                                    <Link
                                        to={item.path}
                                        className="text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
                                    >
                                        {item.title}
                                    </Link>
                                )}
                            </>
                        )}
                    </div>
                );
            })}
        </nav>
    );
});

Breadcrumbs.displayName = 'Breadcrumbs';

Breadcrumbs.propTypes = {
    items: PropTypes.arrayOf(PropTypes.shape({
        path: PropTypes.string.isRequired,
        title: PropTypes.string.isRequired,
    })),
};

/**
 * PageLayout Component
 */
const PageLayout = memo(({
    children,
    title,
    subtitle,
    actions,
    fullWidth = false,
    showBreadcrumbs = true,
    className = '',
    loading = false,
}) => {
    const location = useLocation();

    // Build breadcrumb trail
    const buildBreadcrumbs = () => {
        const crumbs = [];
        let currentPath = location.pathname;

        while (currentPath && routeConfig[currentPath]) {
            const config = routeConfig[currentPath];
            crumbs.unshift({ path: currentPath, title: config.title });
            currentPath = config.parent;
        }

        // Always start with home
        if (crumbs.length === 0 || crumbs[0].path !== '/dashboard') {
            crumbs.unshift({ path: '/dashboard', title: 'Home' });
        }

        return crumbs;
    };

    const breadcrumbs = buildBreadcrumbs();
    const pageTitle = title || routeConfig[location.pathname]?.title || 'Page';

    return (
        <>
            <Helmet>
                <title>{pageTitle} | DeepStrike</title>
            </Helmet>

            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.2 }}
                className={`w-full ${fullWidth ? '' : 'px-4 py-4'} ${className}`}
            >
                {/* Breadcrumbs */}
                {showBreadcrumbs && <Breadcrumbs items={breadcrumbs} />}

                {/* Page Header */}
                {(title || actions) && (
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
                        <div>
                            {title && (
                                <motion.h1
                                    initial={{ opacity: 0, y: -10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white"
                                >
                                    {title}
                                </motion.h1>
                            )}
                            {subtitle && (
                                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                                    {subtitle}
                                </p>
                            )}
                        </div>

                        {actions && (
                            <motion.div
                                initial={{ opacity: 0, x: 10 }}
                                animate={{ opacity: 1, x: 0 }}
                                className="flex items-center gap-2 flex-shrink-0"
                            >
                                {actions}
                            </motion.div>
                        )}
                    </div>
                )}

                {/* Loading Overlay */}
                {loading && (
                    <div className="fixed inset-0 bg-black/20 dark:bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center">
                        <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
                    </div>
                )}

                {/* Page Content */}
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                >
                    {children}
                </motion.div>
            </motion.div>
        </>
    );
});

PageLayout.displayName = 'PageLayout';

PageLayout.propTypes = {
    children: PropTypes.node.isRequired,
    title: PropTypes.string,
    subtitle: PropTypes.string,
    actions: PropTypes.node,
    fullWidth: PropTypes.bool,
    showBreadcrumbs: PropTypes.bool,
    className: PropTypes.string,
    loading: PropTypes.bool,
};

export default PageLayout;
export { Breadcrumbs, routeConfig };
