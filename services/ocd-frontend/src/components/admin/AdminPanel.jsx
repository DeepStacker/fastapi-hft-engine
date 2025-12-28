import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSelector } from 'react-redux';
import {
    XMarkIcon,
    Cog6ToothIcon,
    UsersIcon,
    ServerStackIcon,
    TrashIcon,
    HeartIcon,
    ExclamationTriangleIcon,
    ArrowPathIcon,
    ChartBarIcon,
    FlagIcon,
    MagnifyingGlassIcon,
    ChevronDownIcon,
    ChevronRightIcon,
    SignalIcon,
    ClockIcon,
    CheckCircleIcon,
    XCircleIcon,
    ArrowTrendingUpIcon,
    CpuChipIcon,
} from '@heroicons/react/24/outline';

import useAdminAccess from '../../hooks/useAdminAccess';
import adminService from '../../services/adminService';

// ═══════════════════════════════════════════════════════════════════
// Reusable UI Components
// ═══════════════════════════════════════════════════════════════════

const StatCard = ({ title, value, subtitle, icon: Icon, trend, color = 'blue', pulse = false }) => {
    const colorClasses = {
        blue: 'from-blue-500/20 to-blue-600/10 border-blue-500/30',
        green: 'from-green-500/20 to-green-600/10 border-green-500/30',
        purple: 'from-purple-500/20 to-purple-600/10 border-purple-500/30',
        orange: 'from-orange-500/20 to-orange-600/10 border-orange-500/30',
        red: 'from-red-500/20 to-red-600/10 border-red-500/30',
        cyan: 'from-cyan-500/20 to-cyan-600/10 border-cyan-500/30',
    };

    const iconColors = {
        blue: 'text-blue-400',
        green: 'text-green-400',
        purple: 'text-purple-400',
        orange: 'text-orange-400',
        red: 'text-red-400',
        cyan: 'text-cyan-400',
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className={`relative overflow-hidden rounded-xl border bg-gradient-to-br ${colorClasses[color]} backdrop-blur-sm p-4`}
        >
            {pulse && (
                <div className="absolute top-3 right-3">
                    <span className="relative flex h-3 w-3">
                        <span className={`animate-ping absolute inline-flex h-full w-full rounded-full bg-${color}-400 opacity-75`}></span>
                        <span className={`relative inline-flex rounded-full h-3 w-3 bg-${color}-500`}></span>
                    </span>
                </div>
            )}
            <div className="flex items-start justify-between">
                <div>
                    <p className="text-sm text-gray-400">{title}</p>
                    <p className="text-2xl font-bold mt-1">{value}</p>
                    {subtitle && <p className="text-xs text-gray-500 mt-1">{subtitle}</p>}
                    {trend && (
                        <div className={`flex items-center mt-2 text-xs ${trend > 0 ? 'text-green-400' : 'text-red-400'}`}>
                            <ArrowTrendingUpIcon className={`w-4 h-4 mr-1 ${trend < 0 ? 'rotate-180' : ''}`} />
                            {Math.abs(trend)}% from last hour
                        </div>
                    )}
                </div>
                {Icon && <Icon className={`w-8 h-8 ${iconColors[color]} opacity-60`} />}
            </div>
        </motion.div>
    );
};

const StatusBadge = ({ status, size = 'sm' }) => {
    const configs = {
        healthy: { bg: 'bg-green-500/20', text: 'text-green-400', label: 'Healthy' },
        connected: { bg: 'bg-green-500/20', text: 'text-green-400', label: 'Connected' },
        degraded: { bg: 'bg-yellow-500/20', text: 'text-yellow-400', label: 'Degraded' },
        error: { bg: 'bg-red-500/20', text: 'text-red-400', label: 'Error' },
        disconnected: { bg: 'bg-red-500/20', text: 'text-red-400', label: 'Disconnected' },
        active: { bg: 'bg-green-500/20', text: 'text-green-400', label: 'Active' },
        inactive: { bg: 'bg-gray-500/20', text: 'text-gray-400', label: 'Inactive' },
    };

    const config = configs[status?.toLowerCase()] || configs.error;
    const sizeClasses = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-3 py-1 text-sm';

    return (
        <span className={`inline-flex items-center rounded-full ${config.bg} ${config.text} ${sizeClasses} font-medium`}>
            <span className={`w-1.5 h-1.5 rounded-full ${config.text.replace('text-', 'bg-')} mr-1.5`}></span>
            {config.label}
        </span>
    );
};

const QuickAction = ({ label, icon: Icon, onClick, variant = 'default', loading = false }) => {
    const variants = {
        default: 'bg-gray-700/50 hover:bg-gray-600/50 border-gray-600',
        danger: 'bg-red-500/10 hover:bg-red-500/20 border-red-500/30 text-red-400',
        success: 'bg-green-500/10 hover:bg-green-500/20 border-green-500/30 text-green-400',
        primary: 'bg-blue-500/10 hover:bg-blue-500/20 border-blue-500/30 text-blue-400',
    };

    return (
        <button
            onClick={onClick}
            disabled={loading}
            className={`flex items-center space-x-2 px-4 py-2 rounded-lg border transition-all ${variants[variant]} disabled:opacity-50`}
        >
            {loading ? (
                <ArrowPathIcon className="w-4 h-4 animate-spin" />
            ) : (
                Icon && <Icon className="w-4 h-4" />
            )}
            <span className="text-sm">{label}</span>
        </button>
    );
};

// ═══════════════════════════════════════════════════════════════════
// Dashboard Tab
// ═══════════════════════════════════════════════════════════════════

const DashboardTab = () => {
    const [health, setHealth] = useState(null);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(null);

    const fetchHealth = async () => {
        try {
            const data = await adminService.getHealth();
            setHealth(data);
        } catch (err) {
            console.error('Health check failed:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchHealth();
        const interval = setInterval(fetchHealth, 15000);
        return () => clearInterval(interval);
    }, []);

    const handleAction = async (action) => {
        setActionLoading(action);
        try {
            if (action === 'clearCache') {
                await adminService.clearCache(null, true);
            } else if (action === 'seed') {
                await adminService.seedDatabase();
            }
            fetchHealth();
        } catch (err) {
            console.error(`Action ${action} failed:`, err);
        } finally {
            setActionLoading(null);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="flex flex-col items-center space-y-3">
                    <ArrowPathIcon className="w-10 h-10 animate-spin text-blue-500" />
                    <span className="text-gray-400">Loading dashboard...</span>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                        System Dashboard
                    </h2>
                    <p className="text-sm text-gray-500 mt-1">Real-time system overview</p>
                </div>
                <button
                    onClick={fetchHealth}
                    className="p-2 rounded-lg bg-gray-700/50 hover:bg-gray-600/50 transition-colors"
                >
                    <ArrowPathIcon className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
                </button>
            </div>

            {/* Status Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <StatCard
                    title="System Status"
                    value={health?.status?.toUpperCase() || 'UNKNOWN'}
                    icon={HeartIcon}
                    color={health?.status === 'healthy' ? 'green' : 'red'}
                    pulse={health?.status === 'healthy'}
                />
                <StatCard
                    title="Uptime"
                    value={health?.uptime_seconds ? `${Math.floor(health.uptime_seconds / 3600)}h ${Math.floor((health.uptime_seconds % 3600) / 60)}m` : 'N/A'}
                    icon={ClockIcon}
                    color="blue"
                />
                <StatCard
                    title="Database"
                    value={health?.database?.toUpperCase() || 'UNKNOWN'}
                    icon={ServerStackIcon}
                    color={health?.database === 'connected' ? 'green' : 'red'}
                />
                <StatCard
                    title="Redis Cache"
                    value={health?.redis?.toUpperCase() || 'UNKNOWN'}
                    icon={CpuChipIcon}
                    color={health?.redis === 'connected' ? 'green' : 'red'}
                />
            </div>

            {/* Quick Actions */}
            <div className="rounded-xl border border-gray-700/50 bg-gray-800/30 backdrop-blur-sm p-4">
                <h3 className="text-lg font-semibold mb-4 flex items-center">
                    <SignalIcon className="w-5 h-5 mr-2 text-purple-400" />
                    Quick Actions
                </h3>
                <div className="flex flex-wrap gap-3">
                    <QuickAction
                        label="Clear All Cache"
                        icon={TrashIcon}
                        variant="danger"
                        loading={actionLoading === 'clearCache'}
                        onClick={() => handleAction('clearCache')}
                    />
                    <QuickAction
                        label="Re-seed Database"
                        icon={ArrowPathIcon}
                        variant="primary"
                        loading={actionLoading === 'seed'}
                        onClick={() => handleAction('seed')}
                    />
                    <QuickAction
                        label="Refresh Health"
                        icon={HeartIcon}
                        variant="success"
                        onClick={fetchHealth}
                    />
                </div>
            </div>

            {/* Version Info */}
            <div className="rounded-xl border border-gray-700/50 bg-gray-800/30 backdrop-blur-sm p-4">
                <div className="flex items-center justify-between">
                    <div>
                        <p className="text-sm text-gray-400">Version</p>
                        <p className="font-mono text-lg">{health?.version || 'N/A'}</p>
                    </div>
                    <div className="text-right">
                        <p className="text-sm text-gray-400">Environment</p>
                        <p className="font-mono text-lg">{health?.environment || 'production'}</p>
                    </div>
                </div>
            </div>
        </div>
    );
};

// ═══════════════════════════════════════════════════════════════════
// Enhanced Config Tab
// ═══════════════════════════════════════════════════════════════════

const ConfigsTab = () => {
    const [configs, setConfigs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [expandedCategories, setExpandedCategories] = useState(new Set(['cache', 'system']));
    const [editingConfig, setEditingConfig] = useState(null);
    const [editValue, setEditValue] = useState('');
    const [saving, setSaving] = useState(false);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [newConfig, setNewConfig] = useState({
        key: '', value: '', category: 'system', description: '', display_name: '', value_type: 'string', is_sensitive: false,
    });

    const CATEGORIES = [
        { id: 'api', name: 'API Settings', icon: '🌐', color: 'blue' },
        { id: 'cache', name: 'Cache & Performance', icon: '⚡', color: 'green' },
        { id: 'system', name: 'System', icon: '🖥️', color: 'purple' },
        { id: 'ui', name: 'User Interface', icon: '🎨', color: 'pink' },
        { id: 'features', name: 'Feature Flags', icon: '🚩', color: 'yellow' },
        { id: 'trading', name: 'Trading', icon: '📈', color: 'orange' },
        { id: 'security', name: 'Security', icon: '🔒', color: 'red' },
    ];

    const fetchConfigs = async () => {
        setLoading(true);
        try {
            const data = await adminService.listConfigs();
            setConfigs(data.data || []);
        } catch (err) {
            console.error('Failed to fetch configs:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchConfigs(); }, []);

    const groupedConfigs = useMemo(() => {
        const filtered = configs.filter(c =>
            c.key.toLowerCase().includes(search.toLowerCase()) ||
            c.display_name?.toLowerCase().includes(search.toLowerCase()) ||
            c.description?.toLowerCase().includes(search.toLowerCase())
        );

        const groups = {};
        CATEGORIES.forEach(cat => { groups[cat.id] = []; });
        filtered.forEach(config => {
            const cat = config.category || 'system';
            if (groups[cat]) groups[cat].push(config);
        });
        return groups;
    }, [configs, search]);

    const toggleCategory = (catId) => {
        const newExpanded = new Set(expandedCategories);
        if (newExpanded.has(catId)) {
            newExpanded.delete(catId);
        } else {
            newExpanded.add(catId);
        }
        setExpandedCategories(newExpanded);
    };

    const handleSave = async () => {
        if (!editingConfig) return;
        setSaving(true);
        try {
            await adminService.updateConfig(editingConfig.key, { value: editValue });
            setEditingConfig(null);
            fetchConfigs();
        } catch (err) {
            console.error('Failed to update config:', err);
        } finally {
            setSaving(false);
        }
    };

    const handleCreate = async () => {
        if (!newConfig.key || !newConfig.value) return;
        setSaving(true);
        try {
            await adminService.createConfig(newConfig);
            setShowCreateModal(false);
            setNewConfig({ key: '', value: '', category: 'system', description: '', display_name: '', value_type: 'string', is_sensitive: false });
            fetchConfigs();
        } catch (err) {
            console.error('Failed to create config:', err);
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (key) => {
        if (!confirm(`Delete config "${key}"?`)) return;
        try {
            await adminService.deleteConfig(key);
            fetchConfigs();
        } catch (err) {
            console.error('Failed to delete:', err);
        }
    };

    const getCategoryColor = (catId) => {
        const cat = CATEGORIES.find(c => c.id === catId);
        const colors = {
            blue: 'text-blue-400 border-blue-500/30',
            green: 'text-green-400 border-green-500/30',
            purple: 'text-purple-400 border-purple-500/30',
            pink: 'text-pink-400 border-pink-500/30',
            yellow: 'text-yellow-400 border-yellow-500/30',
            orange: 'text-orange-400 border-orange-500/30',
            red: 'text-red-400 border-red-500/30',
        };
        return colors[cat?.color] || 'text-gray-400 border-gray-500/30';
    };

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                    Configurations
                </h2>
                <button
                    onClick={() => setShowCreateModal(true)}
                    className="px-4 py-2 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-lg hover:opacity-90 transition-opacity flex items-center space-x-2"
                >
                    <span>+ Add Config</span>
                </button>
            </div>

            {/* Search */}
            <div className="relative">
                <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                    type="text"
                    placeholder="Search configurations..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 rounded-xl bg-gray-800/50 border border-gray-700/50 focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 transition-all"
                />
            </div>

            {/* Category Accordions */}
            {loading ? (
                <div className="flex items-center justify-center h-32">
                    <ArrowPathIcon className="w-8 h-8 animate-spin text-blue-500" />
                </div>
            ) : (
                <div className="space-y-2">
                    {CATEGORIES.map((cat) => {
                        const catConfigs = groupedConfigs[cat.id] || [];
                        const isExpanded = expandedCategories.has(cat.id);

                        return (
                            <div key={cat.id} className="rounded-xl border border-gray-700/50 overflow-hidden">
                                <button
                                    onClick={() => toggleCategory(cat.id)}
                                    className="w-full flex items-center justify-between p-4 bg-gray-800/30 hover:bg-gray-700/30 transition-colors"
                                >
                                    <div className="flex items-center space-x-3">
                                        <span className="text-xl">{cat.icon}</span>
                                        <span className="font-medium">{cat.name}</span>
                                        <span className="px-2 py-0.5 text-xs bg-gray-700 rounded-full">{catConfigs.length}</span>
                                    </div>
                                    {isExpanded ? (
                                        <ChevronDownIcon className="w-5 h-5 text-gray-400" />
                                    ) : (
                                        <ChevronRightIcon className="w-5 h-5 text-gray-400" />
                                    )}
                                </button>

                                <AnimatePresence>
                                    {isExpanded && catConfigs.length > 0 && (
                                        <motion.div
                                            initial={{ height: 0, opacity: 0 }}
                                            animate={{ height: 'auto', opacity: 1 }}
                                            exit={{ height: 0, opacity: 0 }}
                                            transition={{ duration: 0.2 }}
                                            className="overflow-hidden"
                                        >
                                            <div className="divide-y divide-gray-700/30">
                                                {catConfigs.map((config) => (
                                                    <div key={config.key} className="p-4 bg-gray-900/20">
                                                        <div className="flex items-start justify-between gap-4">
                                                            <div className="flex-1 min-w-0">
                                                                <div className="font-mono text-sm text-blue-300">{config.key}</div>
                                                                <div className="text-xs text-gray-500 mt-1">
                                                                    {config.display_name || config.key} • {config.description || 'No description'}
                                                                </div>
                                                            </div>
                                                            <div className="flex items-center space-x-2 flex-shrink-0">
                                                                {editingConfig?.key === config.key ? (
                                                                    <>
                                                                        <input
                                                                            type={config.value_type === 'number' ? 'number' : config.is_sensitive ? 'password' : 'text'}
                                                                            value={editValue}
                                                                            onChange={(e) => setEditValue(e.target.value)}
                                                                            className="w-32 px-2 py-1 rounded bg-gray-700 border border-gray-600 text-sm"
                                                                        />
                                                                        <button onClick={handleSave} disabled={saving} className="px-3 py-1 bg-blue-500 text-white rounded text-sm hover:bg-blue-600 disabled:opacity-50">
                                                                            {saving ? '...' : 'Save'}
                                                                        </button>
                                                                        <button onClick={() => setEditingConfig(null)} className="px-3 py-1 bg-gray-600 text-white rounded text-sm">
                                                                            Cancel
                                                                        </button>
                                                                    </>
                                                                ) : (
                                                                    <>
                                                                        <code className="px-2 py-1 rounded bg-gray-700 text-sm">
                                                                            {config.is_sensitive ? '••••••' : config.value}
                                                                        </code>
                                                                        <button
                                                                            onClick={() => { setEditingConfig(config); setEditValue(config.value); }}
                                                                            className="px-3 py-1 bg-gray-600 hover:bg-gray-500 text-white rounded text-sm transition-colors"
                                                                        >
                                                                            Edit
                                                                        </button>
                                                                        <button
                                                                            onClick={() => handleDelete(config.key)}
                                                                            className="p-1 text-red-400 hover:bg-red-500/20 rounded transition-colors"
                                                                        >
                                                                            <TrashIcon className="w-4 h-4" />
                                                                        </button>
                                                                    </>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Create Modal */}
            <AnimatePresence>
                {showCreateModal && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
                        onClick={() => setShowCreateModal(false)}
                    >
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            onClick={(e) => e.stopPropagation()}
                            className="w-full max-w-md p-6 rounded-2xl bg-gray-800 border border-gray-700"
                        >
                            <h3 className="text-xl font-bold mb-4">Create Configuration</h3>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm text-gray-400 mb-1">Key *</label>
                                    <input
                                        type="text"
                                        value={newConfig.key}
                                        onChange={(e) => setNewConfig({ ...newConfig, key: e.target.value.toUpperCase().replace(/\s/g, '_') })}
                                        placeholder="MY_CONFIG_KEY"
                                        className="w-full px-3 py-2 rounded-lg bg-gray-700 border border-gray-600"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm text-gray-400 mb-1">Value *</label>
                                    <input
                                        type="text"
                                        value={newConfig.value}
                                        onChange={(e) => setNewConfig({ ...newConfig, value: e.target.value })}
                                        className="w-full px-3 py-2 rounded-lg bg-gray-700 border border-gray-600"
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm text-gray-400 mb-1">Category</label>
                                        <select
                                            value={newConfig.category}
                                            onChange={(e) => setNewConfig({ ...newConfig, category: e.target.value })}
                                            className="w-full px-3 py-2 rounded-lg bg-gray-700 border border-gray-600"
                                        >
                                            {CATEGORIES.map((cat) => (
                                                <option key={cat.id} value={cat.id}>{cat.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm text-gray-400 mb-1">Type</label>
                                        <select
                                            value={newConfig.value_type}
                                            onChange={(e) => setNewConfig({ ...newConfig, value_type: e.target.value })}
                                            className="w-full px-3 py-2 rounded-lg bg-gray-700 border border-gray-600"
                                        >
                                            <option value="string">String</option>
                                            <option value="number">Number</option>
                                            <option value="boolean">Boolean</option>
                                        </select>
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm text-gray-400 mb-1">Description</label>
                                    <textarea
                                        value={newConfig.description}
                                        onChange={(e) => setNewConfig({ ...newConfig, description: e.target.value })}
                                        rows={2}
                                        className="w-full px-3 py-2 rounded-lg bg-gray-700 border border-gray-600"
                                    />
                                </div>
                            </div>
                            <div className="flex justify-end space-x-3 mt-6">
                                <button onClick={() => setShowCreateModal(false)} className="px-4 py-2 bg-gray-600 text-white rounded-lg">
                                    Cancel
                                </button>
                                <button
                                    onClick={handleCreate}
                                    disabled={saving || !newConfig.key || !newConfig.value}
                                    className="px-4 py-2 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-lg disabled:opacity-50"
                                >
                                    {saving ? 'Creating...' : 'Create'}
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

// ═══════════════════════════════════════════════════════════════════
// Users Tab
// ═══════════════════════════════════════════════════════════════════

const UsersTab = () => {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [search, setSearch] = useState('');

    const fetchUsers = useCallback(async () => {
        setLoading(true);
        try {
            const data = await adminService.listUsers(page, 15, search || null);
            setUsers(data.items || []);
            setTotalPages(data.pages || 1);
        } catch (err) {
            console.error('Failed to fetch users:', err);
        } finally {
            setLoading(false);
        }
    }, [page, search]);

    useEffect(() => { fetchUsers(); }, [fetchUsers]);

    const toggleUserStatus = async (userId, isActive) => {
        try {
            if (isActive) {
                await adminService.deactivateUser(userId);
            } else {
                await adminService.activateUser(userId);
            }
            fetchUsers();
        } catch (err) {
            console.error('Failed to toggle user status:', err);
        }
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                    User Management
                </h2>
            </div>

            {/* Search */}
            <div className="relative">
                <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                    type="text"
                    placeholder="Search users..."
                    value={search}
                    onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                    className="w-full pl-10 pr-4 py-3 rounded-xl bg-gray-800/50 border border-gray-700/50 focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 transition-all"
                />
            </div>

            {/* Users Table */}
            {loading ? (
                <div className="flex items-center justify-center h-32">
                    <ArrowPathIcon className="w-8 h-8 animate-spin text-blue-500" />
                </div>
            ) : (
                <div className="rounded-xl border border-gray-700/50 overflow-hidden">
                    <table className="w-full">
                        <thead className="bg-gray-800/50">
                            <tr>
                                <th className="text-left px-4 py-3 text-sm font-medium text-gray-400">User</th>
                                <th className="text-left px-4 py-3 text-sm font-medium text-gray-400">Role</th>
                                <th className="text-left px-4 py-3 text-sm font-medium text-gray-400">Status</th>
                                <th className="text-left px-4 py-3 text-sm font-medium text-gray-400">Created</th>
                                <th className="text-right px-4 py-3 text-sm font-medium text-gray-400">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-700/30">
                            {users.map((user) => (
                                <tr key={user.id} className="hover:bg-gray-800/30 transition-colors">
                                    <td className="px-4 py-3">
                                        <div>
                                            <div className="font-medium">{user.display_name || user.email}</div>
                                            <div className="text-sm text-gray-500">{user.email}</div>
                                        </div>
                                    </td>
                                    <td className="px-4 py-3">
                                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${user.role === 'admin' ? 'bg-purple-500/20 text-purple-400' : 'bg-gray-500/20 text-gray-400'
                                            }`}>
                                            {user.role}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3">
                                        <StatusBadge status={user.is_active ? 'active' : 'inactive'} />
                                    </td>
                                    <td className="px-4 py-3 text-sm text-gray-500">
                                        {user.created_at ? new Date(user.created_at).toLocaleDateString() : 'N/A'}
                                    </td>
                                    <td className="px-4 py-3 text-right">
                                        <button
                                            onClick={() => toggleUserStatus(user.id, user.is_active)}
                                            className={`px-3 py-1 rounded text-sm transition-colors ${user.is_active
                                                    ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
                                                    : 'bg-green-500/20 text-green-400 hover:bg-green-500/30'
                                                }`}
                                        >
                                            {user.is_active ? 'Deactivate' : 'Activate'}
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Pagination */}
            <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">Page {page} of {totalPages}</span>
                <div className="flex space-x-2">
                    <button
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        disabled={page === 1}
                        className="px-4 py-2 bg-gray-700 text-white rounded-lg disabled:opacity-50 hover:bg-gray-600 transition-colors"
                    >
                        Previous
                    </button>
                    <button
                        onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                        disabled={page === totalPages}
                        className="px-4 py-2 bg-gray-700 text-white rounded-lg disabled:opacity-50 hover:bg-gray-600 transition-colors"
                    >
                        Next
                    </button>
                </div>
            </div>
        </div>
    );
};

// ═══════════════════════════════════════════════════════════════════
// Feature Flags Tab
// ═══════════════════════════════════════════════════════════════════

const FeaturesTab = () => {
    const [features, setFeatures] = useState([]);
    const [loading, setLoading] = useState(true);
    const [toggling, setToggling] = useState(null);

    const fetchFeatures = async () => {
        setLoading(true);
        try {
            const data = await adminService.listConfigs('features');
            setFeatures(data.data || []);
        } catch (err) {
            console.error('Failed to fetch features:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchFeatures(); }, []);

    const toggleFeature = async (key, currentValue) => {
        setToggling(key);
        try {
            const newValue = currentValue === 'true' ? 'false' : 'true';
            await adminService.updateConfig(key, { value: newValue });
            fetchFeatures();
        } catch (err) {
            console.error('Failed to toggle feature:', err);
        } finally {
            setToggling(null);
        }
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                    Feature Flags
                </h2>
                <button onClick={fetchFeatures} className="p-2 rounded-lg bg-gray-700/50 hover:bg-gray-600/50 transition-colors">
                    <ArrowPathIcon className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
                </button>
            </div>

            {loading ? (
                <div className="flex items-center justify-center h-32">
                    <ArrowPathIcon className="w-8 h-8 animate-spin text-blue-500" />
                </div>
            ) : (
                <div className="grid gap-4">
                    {features.map((feature) => {
                        const isEnabled = feature.value === 'true';
                        return (
                            <motion.div
                                key={feature.key}
                                layout
                                className={`p-4 rounded-xl border transition-all ${isEnabled
                                        ? 'bg-green-500/10 border-green-500/30'
                                        : 'bg-gray-800/30 border-gray-700/50'
                                    }`}
                            >
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center space-x-4">
                                        <div className={`p-2 rounded-lg ${isEnabled ? 'bg-green-500/20' : 'bg-gray-700/50'}`}>
                                            <FlagIcon className={`w-5 h-5 ${isEnabled ? 'text-green-400' : 'text-gray-400'}`} />
                                        </div>
                                        <div>
                                            <div className="font-medium">{feature.display_name || feature.key}</div>
                                            <div className="text-sm text-gray-500">{feature.description || 'No description'}</div>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => toggleFeature(feature.key, feature.value)}
                                        disabled={toggling === feature.key}
                                        className={`relative w-14 h-7 rounded-full transition-colors ${isEnabled ? 'bg-green-500' : 'bg-gray-600'
                                            }`}
                                    >
                                        <motion.div
                                            animate={{ x: isEnabled ? 28 : 4 }}
                                            className="absolute top-1 w-5 h-5 bg-white rounded-full shadow-lg"
                                        />
                                    </button>
                                </div>
                            </motion.div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

// ═══════════════════════════════════════════════════════════════════
// Cache Tab
// ═══════════════════════════════════════════════════════════════════

const CacheTab = () => {
    const [clearing, setClearing] = useState(null);
    const [result, setResult] = useState(null);

    const handleClear = async (type) => {
        setClearing(type);
        try {
            const clearAll = type === 'all';
            const data = await adminService.clearCache(null, clearAll);
            setResult({ success: true, message: `${type === 'all' ? 'All cache' : 'Options cache'} cleared successfully` });
        } catch (err) {
            setResult({ success: false, message: err.message });
        } finally {
            setClearing(null);
        }
    };

    return (
        <div className="space-y-6">
            <h2 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                Cache Management
            </h2>

            {/* Warning */}
            <div className="p-4 rounded-xl bg-yellow-500/10 border border-yellow-500/30">
                <div className="flex items-start space-x-3">
                    <ExclamationTriangleIcon className="w-6 h-6 text-yellow-500 flex-shrink-0" />
                    <div>
                        <div className="font-medium text-yellow-300">Warning</div>
                        <div className="text-sm text-yellow-200/70 mt-1">
                            Clearing cache will force data to be refetched from external APIs. This may temporarily slow down the application.
                        </div>
                    </div>
                </div>
            </div>

            {/* Cache Actions */}
            <div className="grid grid-cols-2 gap-4">
                <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => handleClear('options')}
                    disabled={clearing}
                    className="p-6 rounded-xl border border-blue-500/30 bg-blue-500/10 hover:bg-blue-500/20 transition-colors disabled:opacity-50"
                >
                    <ServerStackIcon className="w-10 h-10 text-blue-400 mx-auto mb-3" />
                    <div className="font-medium">Clear Options Cache</div>
                    <div className="text-sm text-gray-500 mt-1">Options chain data only</div>
                    {clearing === 'options' && <ArrowPathIcon className="w-5 h-5 animate-spin mx-auto mt-2" />}
                </motion.button>

                <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => handleClear('all')}
                    disabled={clearing}
                    className="p-6 rounded-xl border border-red-500/30 bg-red-500/10 hover:bg-red-500/20 transition-colors disabled:opacity-50"
                >
                    <TrashIcon className="w-10 h-10 text-red-400 mx-auto mb-3" />
                    <div className="font-medium">Clear All Cache</div>
                    <div className="text-sm text-gray-500 mt-1">All cached data</div>
                    {clearing === 'all' && <ArrowPathIcon className="w-5 h-5 animate-spin mx-auto mt-2" />}
                </motion.button>
            </div>

            {/* Result */}
            <AnimatePresence>
                {result && (
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className={`p-4 rounded-xl ${result.success
                                ? 'bg-green-500/10 border border-green-500/30 text-green-400'
                                : 'bg-red-500/10 border border-red-500/30 text-red-400'
                            }`}
                    >
                        <div className="flex items-center space-x-2">
                            {result.success ? (
                                <CheckCircleIcon className="w-5 h-5" />
                            ) : (
                                <XCircleIcon className="w-5 h-5" />
                            )}
                            <span>{result.message}</span>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

// ═══════════════════════════════════════════════════════════════════
// Main Admin Panel
// ═══════════════════════════════════════════════════════════════════

const TABS = [
    { id: 'dashboard', name: 'Dashboard', icon: ChartBarIcon },
    { id: 'config', name: 'Configurations', icon: Cog6ToothIcon },
    { id: 'users', name: 'Users', icon: UsersIcon },
    { id: 'features', name: 'Feature Flags', icon: FlagIcon },
    { id: 'cache', name: 'Cache', icon: ServerStackIcon },
];

const AdminPanel = () => {
    const { isAdminUnlocked, isWaitingForPhrase, lockAdmin } = useAdminAccess();
    const [activeTab, setActiveTab] = useState('dashboard');

    if (isWaitingForPhrase) {
        return (
            <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="fixed bottom-4 right-4 z-50 px-4 py-3 bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-xl shadow-lg"
            >
                <div className="flex items-center space-x-2">
                    <div className="animate-pulse">🔐</div>
                    <span>Enter admin phrase...</span>
                </div>
            </motion.div>
        );
    }

    if (!isAdminUnlocked) {
        return null;
    }

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md"
                onClick={lockAdmin}
            >
                <motion.div
                    initial={{ scale: 0.9, opacity: 0, y: 20 }}
                    animate={{ scale: 1, opacity: 1, y: 0 }}
                    exit={{ scale: 0.9, opacity: 0, y: 20 }}
                    transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                    onClick={(e) => e.stopPropagation()}
                    className="w-full max-w-5xl max-h-[90vh] overflow-hidden rounded-2xl shadow-2xl bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 border border-gray-700/50"
                >
                    {/* Header */}
                    <div className="flex items-center justify-between p-4 border-b border-gray-700/50 bg-gray-900/50">
                        <div className="flex items-center space-x-3">
                            <div className="p-2 bg-gradient-to-br from-purple-500 to-blue-500 rounded-xl">
                                <Cog6ToothIcon className="w-6 h-6 text-white" />
                            </div>
                            <div>
                                <h2 className="text-xl font-bold">Admin Control Center</h2>
                                <p className="text-sm text-gray-500">System Administration • v2.0</p>
                            </div>
                        </div>
                        <button
                            onClick={lockAdmin}
                            className="p-2 rounded-lg hover:bg-gray-700/50 transition-colors"
                        >
                            <XMarkIcon className="w-6 h-6" />
                        </button>
                    </div>

                    {/* Navigation */}
                    <div className="flex border-b border-gray-700/50 bg-gray-900/30 overflow-x-auto">
                        {TABS.map((tab) => {
                            const Icon = tab.icon;
                            const isActive = activeTab === tab.id;
                            return (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id)}
                                    className={`flex items-center space-x-2 px-5 py-3 border-b-2 transition-all whitespace-nowrap ${isActive
                                            ? 'border-blue-500 text-blue-400 bg-blue-500/10'
                                            : 'border-transparent text-gray-400 hover:text-gray-200 hover:bg-gray-700/30'
                                        }`}
                                >
                                    <Icon className="w-5 h-5" />
                                    <span className="font-medium">{tab.name}</span>
                                </button>
                            );
                        })}
                    </div>

                    {/* Content */}
                    <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
                        <AnimatePresence mode="wait">
                            <motion.div
                                key={activeTab}
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                transition={{ duration: 0.2 }}
                            >
                                {activeTab === 'dashboard' && <DashboardTab />}
                                {activeTab === 'config' && <ConfigsTab />}
                                {activeTab === 'users' && <UsersTab />}
                                {activeTab === 'features' && <FeaturesTab />}
                                {activeTab === 'cache' && <CacheTab />}
                            </motion.div>
                        </AnimatePresence>
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
};

export default AdminPanel;
