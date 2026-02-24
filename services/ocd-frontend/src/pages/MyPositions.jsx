/**
 * My Positions Page
 * 
 * Dashboard for viewing and managing tracked strategy positions:
 * - Position list with status filters
 * - Alerts feed with unread count
 * - Position details with live P&L
 * - Analyze and close actions
 */
import { useState, useEffect, useCallback } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { Helmet } from 'react-helmet-async';
import { motion, AnimatePresence } from 'framer-motion';
import { selectSpotPrice } from '../context/selectors';
import PageLayout from '../components/layout/PageLayout';
import {
    FolderOpenIcon,
    BellAlertIcon,
    ExclamationTriangleIcon,
    CheckCircleIcon,
    XCircleIcon,
    ArrowPathIcon,
    MagnifyingGlassIcon,
    AdjustmentsHorizontalIcon,
    InformationCircleIcon,
    ChevronRightIcon,
    ArrowTrendingUpIcon,
    ArrowTrendingDownIcon
} from '@heroicons/react/24/outline';
import { Card } from '../components/common';
import {
    listPositions,
    analyzePosition,
    updatePosition,
    deletePosition,
    getAllAlerts,
    POSITION_STATUS,
    ALERT_SEVERITY
} from '../services/positionTracker';
import { STRATEGY_NAMES } from '../services/strategyOptimizer';
import { showToast } from '../context/toastSlice';

// ============ SUB-COMPONENTS ============

const StatusBadge = ({ status }) => {
    const styles = {
        [POSITION_STATUS.ACTIVE]: 'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400',
        [POSITION_STATUS.ADJUSTED]: 'bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400',
        [POSITION_STATUS.CLOSED]: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400',
        [POSITION_STATUS.EXPIRED]: 'bg-amber-100 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400',
    };

    return (
        <span className={`px-2 py-1 rounded text-xs font-semibold uppercase ${styles[status] || styles.active}`}>
            {status}
        </span>
    );
};

const AlertBadge = ({ severity }) => {
    const styles = {
        [ALERT_SEVERITY.INFO]: 'bg-blue-100 text-blue-700',
        [ALERT_SEVERITY.WARNING]: 'bg-amber-100 text-amber-700',
        [ALERT_SEVERITY.CRITICAL]: 'bg-red-100 text-red-700',
    };
    const icons = {
        [ALERT_SEVERITY.INFO]: InformationCircleIcon,
        [ALERT_SEVERITY.WARNING]: ExclamationTriangleIcon,
        [ALERT_SEVERITY.CRITICAL]: XCircleIcon,
    };
    const Icon = icons[severity] || InformationCircleIcon;

    return (
        <span className={`px-2 py-1 rounded text-xs font-semibold uppercase flex items-center gap-1 ${styles[severity] || styles.info}`}>
            <Icon className="w-3 h-3" />
            {severity}
        </span>
    );
};

const PositionCard = ({ position, onSelect, onAnalyze, onClose }) => {
    const pnl = position.current_pnl || 0;
    const isProfitable = pnl >= 0;

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 hover:shadow-lg transition-all cursor-pointer"
            onClick={() => onSelect(position)}
        >
            <div className="flex justify-between items-start mb-3">
                <div>
                    <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        {STRATEGY_NAMES[position.strategy_type] || position.strategy_type}
                        {position.alerts_count > 0 && (
                            <span className="px-1.5 py-0.5 text-xs bg-red-500 text-white rounded-full">
                                {position.alerts_count}
                            </span>
                        )}
                    </h3>
                    <p className="text-sm text-gray-500">{position.symbol} • {position.expiry}</p>
                </div>
                <StatusBadge status={position.status} />
            </div>

            <div className="grid grid-cols-3 gap-4 mb-3">
                <div>
                    <p className="text-xs text-gray-500">Entry Spot</p>
                    <p className="font-medium text-gray-900 dark:text-white">₹{position.entry_spot?.toFixed(0)}</p>
                </div>
                <div>
                    <p className="text-xs text-gray-500">Legs</p>
                    <p className="font-medium text-gray-900 dark:text-white">{position.legs?.length || 0}</p>
                </div>
                <div>
                    <p className="text-xs text-gray-500">P&L</p>
                    <p className={`font-bold flex items-center gap-1 ${isProfitable ? 'text-green-600' : 'text-red-600'}`}>
                        {isProfitable ? <ArrowTrendingUpIcon className="w-4 h-4" /> : <ArrowTrendingDownIcon className="w-4 h-4" />}
                        ₹{Math.abs(pnl).toLocaleString()}
                    </p>
                </div>
            </div>

            <div className="flex gap-2 pt-3 border-t border-gray-100 dark:border-gray-700">
                <button
                    onClick={(e) => { e.stopPropagation(); onAnalyze(position); }}
                    className="flex-1 py-2 px-3 text-sm font-medium text-indigo-600 bg-indigo-50 
                             hover:bg-indigo-100 rounded-lg flex items-center justify-center gap-1
                             dark:bg-indigo-900/20 dark:text-indigo-400 dark:hover:bg-indigo-900/30"
                >
                    <MagnifyingGlassIcon className="w-4 h-4" />
                    Analyze
                </button>
                {position.status === POSITION_STATUS.ACTIVE && (
                    <button
                        onClick={(e) => { e.stopPropagation(); onClose(position); }}
                        className="flex-1 py-2 px-3 text-sm font-medium text-gray-600 bg-gray-100 
                                 hover:bg-gray-200 rounded-lg flex items-center justify-center gap-1
                                 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
                    >
                        <CheckCircleIcon className="w-4 h-4" />
                        Close
                    </button>
                )}
            </div>
        </motion.div>
    );
};

const AlertItem = ({ alert, onMarkRead }) => {
    return (
        <div className={`p-3 rounded-lg border-l-4 ${alert.severity === ALERT_SEVERITY.CRITICAL
            ? 'border-l-red-500 bg-red-50 dark:bg-red-900/10'
            : alert.severity === ALERT_SEVERITY.WARNING
                ? 'border-l-amber-500 bg-amber-50 dark:bg-amber-900/10'
                : 'border-l-blue-500 bg-blue-50 dark:bg-blue-900/10'
            } ${!alert.is_read ? 'ring-1 ring-indigo-300' : ''}`}>
            <div className="flex justify-between items-start mb-1">
                <AlertBadge severity={alert.severity} />
                <span className="text-xs text-gray-500">
                    {new Date(alert.detected_at).toLocaleTimeString()}
                </span>
            </div>
            <p className="text-sm text-gray-800 dark:text-gray-200 font-medium">{alert.message}</p>
            {alert.recommended_action && (
                <p className="text-xs text-gray-600 dark:text-gray-400 mt-1 italic">
                    💡 {alert.recommended_action}
                </p>
            )}
            {!alert.is_read && (
                <button
                    onClick={() => onMarkRead(alert.id)}
                    className="text-xs text-indigo-600 hover:underline mt-2"
                >
                    Mark as read
                </button>
            )}
        </div>
    );
};

const PositionDetailModal = ({ position, onClose, onRefresh: _onRefresh }) => {
    const [analysis, setAnalysis] = useState(null);
    const [loading, setLoading] = useState(false);
    const [marketClosed, setMarketClosed] = useState(false);

    const handleAnalyze = async () => {
        setLoading(true);
        setMarketClosed(false);
        try {
            const result = await analyzePosition(position.id);
            setAnalysis(result);
            if (result.current_metrics?.market_status === 'closed') {
                setMarketClosed(true);
            }
            // Refresh parent data to show new alerts/stats
            if (_onRefresh) _onRefresh();
        } catch (err) {
            console.error('Analysis failed:', err);
        } finally {
            setLoading(false);
        }
    };

    // Only load analysis on initial mount - not on every render
    useEffect(() => {
        // Don't auto-analyze, let user click the button
        // This prevents duplicate API calls and stale alerts
    }, [position.id]);

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-white dark:bg-gray-800 rounded-2xl max-w-2xl w-full max-h-[80vh] overflow-y-auto"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="p-5 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-t-2xl">
                    <div className="flex justify-between items-start">
                        <div>
                            <h2 className="text-xl font-bold">
                                {STRATEGY_NAMES[position.strategy_type] || position.strategy_type}
                            </h2>
                            <p className="text-white/80">{position.symbol} • {position.expiry}</p>
                        </div>
                        <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-lg">
                            <XCircleIcon className="w-6 h-6" />
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="p-5 space-y-5">
                    {/* Legs */}
                    <div>
                        <h3 className="font-bold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                            <AdjustmentsHorizontalIcon className="w-5 h-5 text-indigo-500" />
                            Position Legs
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                            {position.legs?.map((leg, i) => (
                                <div
                                    key={i}
                                    className={`p-3 rounded-lg border-l-4 ${leg.action === 'SELL'
                                        ? 'border-l-red-500 bg-red-50 dark:bg-red-900/10'
                                        : 'border-l-green-500 bg-green-50 dark:bg-green-900/10'
                                        }`}
                                >
                                    <div className="flex justify-between">
                                        <span className="font-medium">{leg.strike} {leg.option_type}</span>
                                        <span className={`text-xs font-bold ${leg.action === 'SELL' ? 'text-red-600' : 'text-green-600'}`}>
                                            {leg.action}
                                        </span>
                                    </div>
                                    <div className="text-xs text-gray-500 mt-1">
                                        Qty: {leg.qty * leg.lot_size} • Entry: ₹{leg.entry_price?.toFixed(2)}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Analyze Button */}
                    <div className="flex justify-center">
                        <button
                            onClick={handleAnalyze}
                            disabled={loading}
                            className="px-6 py-3 bg-indigo-600 text-white rounded-xl font-medium 
                                     hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed
                                     flex items-center gap-2 transition-colors"
                        >
                            {loading ? (
                                <>
                                    <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                                    Analyzing...
                                </>
                            ) : (
                                <>
                                    <MagnifyingGlassIcon className="w-5 h-5" />
                                    {analysis ? 'Refresh Analysis' : 'Analyze Position'}
                                </>
                            )}
                        </button>
                    </div>

                    {/* Market Closed Warning */}
                    {marketClosed && (
                        <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl">
                            <div className="flex items-center gap-3">
                                <InformationCircleIcon className="w-6 h-6 text-amber-500" />
                                <div>
                                    <p className="font-medium text-amber-800 dark:text-amber-200">Market is Closed</p>
                                    <p className="text-sm text-amber-600 dark:text-amber-300">
                                        Full analysis with live Greeks and adjustments will be available when market opens.
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Analysis Results */}
                    {loading ? (
                        <div className="flex items-center justify-center py-8">
                            <div className="animate-spin w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full" />
                        </div>
                    ) : analysis && !marketClosed && (
                        <>
                            {/* Risk Score */}
                            <div className="bg-gray-50 dark:bg-gray-900 rounded-xl p-4">
                                <div className="flex justify-between items-center mb-2">
                                    <span className="text-sm text-gray-500">Risk Score</span>
                                    <span className={`text-2xl font-bold ${analysis.risk_score > 70 ? 'text-red-600' :
                                        analysis.risk_score > 40 ? 'text-amber-600' : 'text-green-600'
                                        }`}>
                                        {analysis.risk_score?.toFixed(0)}
                                    </span>
                                </div>
                                <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                                    <div
                                        className={`h-full rounded-full ${analysis.risk_score > 70 ? 'bg-red-500' :
                                            analysis.risk_score > 40 ? 'bg-amber-500' : 'bg-green-500'
                                            }`}
                                        style={{ width: `${analysis.risk_score}%` }}
                                    />
                                </div>
                            </div>

                            {/* Current Metrics */}
                            {analysis.current_metrics && (
                                <div className="grid grid-cols-4 gap-3">
                                    <div className="text-center p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
                                        <p className="text-xs text-gray-500">Net Δ</p>
                                        <p className="font-bold">{analysis.current_metrics.net_delta?.toFixed(2)}</p>
                                    </div>
                                    <div className="text-center p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
                                        <p className="text-xs text-gray-500">Net Γ</p>
                                        <p className="font-bold">{analysis.current_metrics.net_gamma?.toFixed(3)}</p>
                                    </div>
                                    <div className="text-center p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
                                        <p className="text-xs text-gray-500">Net Θ</p>
                                        <p className={`font-bold ${(analysis.current_metrics.net_theta || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                            {analysis.current_metrics.net_theta?.toFixed(0)}
                                        </p>
                                    </div>
                                    <div className="text-center p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
                                        <p className="text-xs text-gray-500">P&L</p>
                                        <p className={`font-bold ${(analysis.current_metrics.pnl || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                            ₹{analysis.current_metrics.pnl?.toFixed(0)}
                                        </p>
                                    </div>
                                </div>
                            )}

                            {/* Alerts */}
                            {analysis.alerts?.length > 0 && (
                                <div>
                                    <h3 className="font-bold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                                        <BellAlertIcon className="w-5 h-5 text-amber-500" />
                                        Active Alerts ({analysis.alerts.length})
                                    </h3>
                                    <div className="space-y-2 max-h-48 overflow-y-auto">
                                        {analysis.alerts.map((alert, i) => (
                                            <AlertItem key={i} alert={alert} onMarkRead={() => { }} />
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Suggested Adjustments */}
                            {analysis.adjustments?.length > 0 && (
                                <div>
                                    <h3 className="font-bold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                                        <ArrowPathIcon className="w-5 h-5 text-indigo-500" />
                                        Suggested Adjustments
                                    </h3>
                                    {analysis.adjustments.map((adj, i) => (
                                        <div key={i} className="p-3 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg">
                                            <p className="font-medium text-indigo-700 dark:text-indigo-300">
                                                {adj.adjustment_type?.replace('_', ' ').toUpperCase()}
                                            </p>
                                            <p className="text-sm text-gray-600 dark:text-gray-400">{adj.trigger_reason}</p>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </>
                    )}

                    {/* Notes */}
                    {position.notes && (
                        <div className="p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
                            <p className="text-xs text-gray-500 mb-1">Notes</p>
                            <p className="text-sm text-gray-700 dark:text-gray-300">{position.notes}</p>
                        </div>
                    )}
                </div>
            </motion.div>
        </div>
    );
};

// ============ MAIN COMPONENT ============

const MyPositions = () => {
    const dispatch = useDispatch();
    const _spotPrice = useSelector(selectSpotPrice);

    // State
    const [positions, setPositions] = useState([]);
    const [alerts, setAlerts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [statusFilter, setStatusFilter] = useState('active');
    const [selectedPosition, setSelectedPosition] = useState(null);
    const [showAlerts, setShowAlerts] = useState(false);

    // Load data
    const loadData = useCallback(async (silent = false) => {
        if (!silent) setLoading(true);
        try {
            const [positionsData, alertsData] = await Promise.all([
                listPositions({ status: statusFilter !== 'all' ? statusFilter : undefined }),
                getAllAlerts(true, 20)
            ]);
            setPositions(positionsData || []);
            setAlerts(alertsData || []);
        } catch (err) {
            console.error('Failed to load positions:', err);
            dispatch(showToast({ message: 'Failed to load positions', type: 'error' }));
        } finally {
            if (!silent) setLoading(false);
        }
    }, [statusFilter]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const handleAnalyze = (position) => {
        // Open modal for analysis instead of background call
        setSelectedPosition(position);
    };

    const handleClose = async (position) => {
        if (!confirm('Close this position?')) return;

        try {
            await updatePosition(position.id, {
                status: POSITION_STATUS.CLOSED,
                exit_reason: 'manual'
            });
            dispatch(showToast({ message: 'Position closed', type: 'success' }));
            loadData();
        } catch {
            dispatch(showToast({ message: 'Failed to close position', type: 'error' }));
        }
    };

    // eslint-disable-next-line no-unused-vars
    const _handleDelete = async (position) => {
        if (!confirm('Delete this position permanently?')) return;

        try {
            await deletePosition(position.id);
            dispatch(showToast({ message: 'Position deleted', type: 'success' }));
            setSelectedPosition(null);
            loadData();
        } catch {
            dispatch(showToast({ message: 'Failed to delete position', type: 'error' }));
        }
    };

    const handleMarkAlertRead = async (alertId) => {
        // Note: Would need position ID, simplifying for now
        dispatch(showToast({ message: 'Alert marked as read', type: 'info' }));
        setAlerts(alerts.map(a => a.id === alertId ? { ...a, is_read: true } : a));
    };

    const unreadAlertsCount = alerts.filter(a => !a.is_read).length;

    return (
        <PageLayout title="My Positions" subtitle="Track and Manage Your Strategy Positions">
            <Helmet><title>My Positions | Stockify</title></Helmet>

            <div className="space-y-6">
                {/* Top Bar */}
                <div className="flex flex-wrap items-center justify-between gap-4">
                    {/* Status Filters */}
                    <div className="flex gap-2">
                        {['all', 'active', 'adjusted', 'closed'].map(status => (
                            <button
                                key={status}
                                onClick={() => setStatusFilter(status)}
                                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all
                                    ${statusFilter === status
                                        ? 'bg-indigo-600 text-white'
                                        : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200'}`}
                            >
                                {status.charAt(0).toUpperCase() + status.slice(1)}
                            </button>
                        ))}
                    </div>

                    {/* Alerts Toggle */}
                    <button
                        onClick={() => setShowAlerts(!showAlerts)}
                        className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-all
                            ${showAlerts ? 'bg-amber-500 text-white' : 'bg-amber-100 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400'}`}
                    >
                        <BellAlertIcon className="w-5 h-5" />
                        Alerts
                        {unreadAlertsCount > 0 && (
                            <span className="px-1.5 py-0.5 text-xs bg-red-500 text-white rounded-full">
                                {unreadAlertsCount}
                            </span>
                        )}
                    </button>
                </div>

                {/* Alerts Panel */}
                <AnimatePresence>
                    {showAlerts && (
                        <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="overflow-hidden"
                        >
                            <Card className="p-4">
                                <h3 className="font-bold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                                    <BellAlertIcon className="w-5 h-5 text-amber-500" />
                                    Recent Alerts
                                </h3>
                                {alerts.length === 0 ? (
                                    <p className="text-gray-500 text-sm">No alerts</p>
                                ) : (
                                    <div className="space-y-2 max-h-64 overflow-y-auto">
                                        {alerts.map((alert) => (
                                            <AlertItem
                                                key={alert.id}
                                                alert={alert}
                                                onMarkRead={handleMarkAlertRead}
                                            />
                                        ))}
                                    </div>
                                )}
                            </Card>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Positions Grid */}
                {loading ? (
                    <div className="flex items-center justify-center py-16">
                        <div className="flex flex-col items-center gap-3">
                            <div className="animate-spin w-10 h-10 border-2 border-indigo-500 border-t-transparent rounded-full" />
                            <span className="text-sm text-gray-500">Loading positions...</span>
                        </div>
                    </div>
                ) : positions.length === 0 ? (
                    <Card className="p-8 text-center">
                        <FolderOpenIcon className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">No Positions Found</h3>
                        <p className="text-gray-500 mb-4">
                            {statusFilter === 'all'
                                ? "You haven't tracked any positions yet."
                                : `No ${statusFilter} positions.`}
                        </p>
                        <a
                            href="/strategies"
                            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700"
                        >
                            Find Strategies
                            <ChevronRightIcon className="w-4 h-4" />
                        </a>
                    </Card>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {positions.map((position) => (
                            <PositionCard
                                key={position.id}
                                position={position}
                                onSelect={setSelectedPosition}
                                onAnalyze={handleAnalyze}
                                onClose={handleClose}
                            />
                        ))}
                    </div>
                )}

                {/* Stats Summary */}
                {!loading && positions.length > 0 && (
                    <Card className="p-4">
                        <div className="grid grid-cols-4 gap-4 text-center">
                            <div>
                                <p className="text-xs text-gray-500">Total Positions</p>
                                <p className="text-2xl font-bold text-gray-900 dark:text-white">{positions.length}</p>
                            </div>
                            <div>
                                <p className="text-xs text-gray-500">Active</p>
                                <p className="text-2xl font-bold text-green-600">
                                    {positions.filter(p => p.status === POSITION_STATUS.ACTIVE).length}
                                </p>
                            </div>
                            <div>
                                <p className="text-xs text-gray-500">Total P&L</p>
                                <p className={`text-2xl font-bold ${positions.reduce((sum, p) => sum + (p.current_pnl || 0), 0) >= 0
                                    ? 'text-green-600' : 'text-red-600'
                                    }`}>
                                    ₹{Math.abs(positions.reduce((sum, p) => sum + (p.current_pnl || 0), 0)).toLocaleString()}
                                </p>
                            </div>
                            <div>
                                <p className="text-xs text-gray-500">Alerts</p>
                                <p className="text-2xl font-bold text-amber-600">{unreadAlertsCount}</p>
                            </div>
                        </div>
                    </Card>
                )}
            </div>

            {/* Position Detail Modal */}
            <AnimatePresence>
                {selectedPosition && (
                    <PositionDetailModal
                        position={selectedPosition}
                        onClose={() => setSelectedPosition(null)}
                        onRefresh={() => loadData(true)}
                    />
                )}
            </AnimatePresence>
        </PageLayout>
    );
};

export default MyPositions;
