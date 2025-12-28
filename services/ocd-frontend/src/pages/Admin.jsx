/**
 * Admin Page - Comprehensive Administration Dashboard
 * Tabs: System Health, Users, Cache, Config Manager, Instruments, Settings
 * 
 * Refactored: Heavy tab components moved to pages/admin/ directory
 */
import { useState, useEffect, lazy, Suspense } from 'react';
import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { motion } from 'framer-motion';
import {
    XMarkIcon,
    Cog6ToothIcon,
    UsersIcon,
    ServerStackIcon,
    HeartIcon,
    ShieldCheckIcon,
    WrenchScrewdriverIcon,
    AdjustmentsHorizontalIcon,
    ChartBarIcon,
} from '@heroicons/react/24/outline';
import { Card, Button, Spinner } from '../components/common';

// Lazy load heavy tab components for better performance
const SystemHealthTab = lazy(() => import('./admin/SystemHealthTab'));
const UserManagerTab = lazy(() => import('./admin/UserManagerTab'));
const CacheManagerTab = lazy(() => import('./admin/CacheManagerTab'));
const MonitoringTab = lazy(() => import('./admin/MonitoringTab'));
const FeatureFlagsTab = lazy(() => import('./admin/FeatureFlagsTab'));

// These are kept inline as they share state or are simpler
// TODO: Extract ConfigManagerTab, InstrumentsTab, APIKeysTab, SettingsOverviewTab
import adminService from '../services/adminService';
import { toast } from 'react-toastify';
import { AnimatePresence } from 'framer-motion';
import {
    TrashIcon,
    ArrowPathIcon,
    PlusIcon,
    PencilIcon,
    CheckIcon,
    EyeIcon,
    EyeSlashIcon,
} from '@heroicons/react/24/outline';

// ═══════════════════════════════════════════════════════════════════
// Config Manager Tab (kept inline for now - complex form state)
// ═══════════════════════════════════════════════════════════════════

const ConfigManagerTab = () => {
    const [configs, setConfigs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [category, setCategory] = useState('');
    const [editConfig, setEditConfig] = useState(null);
    const [showSensitive, setShowSensitive] = useState({});
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [newConfig, setNewConfig] = useState({ key: '', value: '', category: 'system', description: '', is_sensitive: false });
    const theme = useSelector((state) => state.theme.theme);
    const isDark = theme === 'dark';
    const categories = ['api', 'trading', 'cache', 'features', 'system'];

    const fetchConfigs = async () => {
        setLoading(true);
        try {
            const data = await adminService.listConfigs(category || null);
            setConfigs(Array.isArray(data) ? data : (data?.data || []));
        } catch {
            toast.error('Failed to load configurations');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchConfigs(); }, [category]);

    const handleSave = async (key, value) => {
        try {
            await adminService.updateConfig(key, { value });
            toast.success(`Config "${key}" updated`);
            fetchConfigs();
            setEditConfig(null);
        } catch {
            toast.error('Failed to update config');
        }
    };

    const handleDelete = async (key) => {
        if (!confirm(`Delete config "${key}"?`)) return;
        try {
            await adminService.deleteConfig(key);
            toast.success(`Config "${key}" deleted`);
            fetchConfigs();
        } catch {
            toast.error('Failed to delete config');
        }
    };

    const handleCreate = async () => {
        if (!newConfig.key || !newConfig.value) {
            toast.error('Key and Value are required');
            return;
        }
        try {
            await adminService.createConfig({ ...newConfig, value_type: 'string' });
            toast.success(`Config "${newConfig.key}" created`);
            setShowCreateModal(false);
            setNewConfig({ key: '', value: '', category: 'system', description: '', is_sensitive: false });
            fetchConfigs();
        } catch (err) {
            toast.error('Failed: ' + (err.response?.data?.message || err.message));
        }
    };

    if (loading) return <div className="flex justify-center py-12"><Spinner size="lg" /></div>;

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between flex-wrap gap-4">
                <h3 className="text-lg font-semibold">Configuration Manager</h3>
                <div className="flex items-center gap-2">
                    <select value={category} onChange={(e) => setCategory(e.target.value)}
                        className={`px-3 py-2 rounded-lg border ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-300'}`}>
                        <option value="">All Categories</option>
                        {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                    </select>
                    <button onClick={() => setShowCreateModal(true)} className="flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600">
                        <PlusIcon className="w-5 h-5" /> Add
                    </button>
                </div>
            </div>

            <AnimatePresence>
                {showCreateModal && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowCreateModal(false)}>
                        <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }}
                            className={`w-full max-w-md p-6 rounded-2xl ${isDark ? 'bg-gray-800' : 'bg-white'} shadow-2xl`} onClick={e => e.stopPropagation()}>
                            <h3 className="text-lg font-bold mb-4">Create Configuration</h3>
                            <div className="space-y-4">
                                <input value={newConfig.key} onChange={(e) => setNewConfig(p => ({ ...p, key: e.target.value }))}
                                    placeholder="Key *" className={`w-full px-3 py-2 rounded-lg border ${isDark ? 'bg-gray-700 border-gray-600' : 'border-gray-300'}`} />
                                <input value={newConfig.value} onChange={(e) => setNewConfig(p => ({ ...p, value: e.target.value }))}
                                    placeholder="Value *" className={`w-full px-3 py-2 rounded-lg border ${isDark ? 'bg-gray-700 border-gray-600' : 'border-gray-300'}`} />
                            </div>
                            <div className="flex gap-3 mt-6">
                                <button onClick={() => setShowCreateModal(false)} className={`flex-1 px-4 py-2 rounded-lg ${isDark ? 'bg-gray-700' : 'bg-gray-100'}`}>Cancel</button>
                                <button onClick={handleCreate} className="flex-1 px-4 py-2 bg-green-500 text-white rounded-lg">Create</button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            <div className="space-y-3">
                {configs.map((config) => (
                    <Card key={config.key} className="p-4">
                        <div className="flex items-start justify-between gap-4">
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                    <span className="font-mono font-bold text-blue-500">{config.key}</span>
                                    <span className={`px-2 py-0.5 rounded text-xs ${isDark ? 'bg-gray-700' : 'bg-gray-100'}`}>{config.category}</span>
                                </div>
                                {editConfig === config.key ? (
                                    <div className="flex items-center gap-2">
                                        <input id={`edit-${config.key}`} defaultValue={config.value}
                                            className={`flex-1 px-3 py-2 rounded-lg border ${isDark ? 'bg-gray-800 border-gray-600' : 'border-gray-300'}`} />
                                        <button onClick={() => handleSave(config.key, document.getElementById(`edit-${config.key}`).value)}
                                            className="p-2 bg-green-500 text-white rounded-lg"><CheckIcon className="w-5 h-5" /></button>
                                        <button onClick={() => setEditConfig(null)} className="p-2 bg-gray-500 text-white rounded-lg"><XMarkIcon className="w-5 h-5" /></button>
                                    </div>
                                ) : (
                                    <code className={`px-3 py-1 rounded text-sm ${isDark ? 'bg-gray-800' : 'bg-gray-100'}`}>
                                        {config.is_sensitive && !showSensitive[config.key] ? '••••••••' : config.value}
                                    </code>
                                )}
                            </div>
                            <div className="flex items-center gap-2">
                                <button onClick={() => setEditConfig(config.key)} className={`p-2 rounded-lg ${isDark ? 'hover:bg-gray-700' : 'hover:bg-gray-100'}`}>
                                    <PencilIcon className="w-4 h-4" />
                                </button>
                                <button onClick={() => handleDelete(config.key)} className="p-2 rounded-lg text-red-500 hover:bg-red-500/10">
                                    <TrashIcon className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    </Card>
                ))}
            </div>
        </div>
    );
};

// ═══════════════════════════════════════════════════════════════════
// Settings Overview Tab (simplified)
// ═══════════════════════════════════════════════════════════════════

const SettingsOverviewTab = () => {
    const theme = useSelector((state) => state.theme.theme);
    const isDark = theme === 'dark';

    return (
        <div className="space-y-6">
            <h3 className="text-lg font-semibold">Settings Overview</h3>
            <Card className="p-6">
                <p className="text-gray-500">System settings and configuration overview.</p>
            </Card>
        </div>
    );
};

// ═══════════════════════════════════════════════════════════════════
// API Keys Tab (simplified inline)
// ═══════════════════════════════════════════════════════════════════

const APIKeysTab = () => {
    const [keys, setKeys] = useState([]);
    const [loading, setLoading] = useState(true);
    const theme = useSelector((state) => state.theme.theme);
    const isDark = theme === 'dark';

    useEffect(() => {
        const fetchKeys = async () => {
            try {
                const data = await adminService.listConfigs('api');
                setKeys(Array.isArray(data) ? data : (data?.data || []));
            } catch {
                toast.error('Failed to load API keys');
            } finally {
                setLoading(false);
            }
        };
        fetchKeys();
    }, []);

    if (loading) return <div className="flex justify-center py-12"><Spinner size="lg" /></div>;

    return (
        <div className="space-y-6">
            <h3 className="text-lg font-semibold">API Keys</h3>
            <div className="space-y-3">
                {keys.map(k => (
                    <Card key={k.key} className="p-4">
                        <div className="font-mono text-blue-500">{k.key}</div>
                        <div className="text-sm text-gray-500 mt-1">••••••••</div>
                    </Card>
                ))}
            </div>
        </div>
    );
};

// ═══════════════════════════════════════════════════════════════════
// Instruments Tab (simplified)
// ═══════════════════════════════════════════════════════════════════

const InstrumentsTab = () => {
    const [instruments, setInstruments] = useState([]);
    const [loading, setLoading] = useState(true);
    const theme = useSelector((state) => state.theme.theme);
    const isDark = theme === 'dark';

    useEffect(() => {
        const fetch = async () => {
            try {
                const data = await adminService.listInstruments(true);
                setInstruments(Array.isArray(data) ? data : (data?.data || []));
            } catch {
                toast.error('Failed to load instruments');
            } finally {
                setLoading(false);
            }
        };
        fetch();
    }, []);

    if (loading) return <div className="flex justify-center py-12"><Spinner size="lg" /></div>;

    return (
        <div className="space-y-6">
            <h3 className="text-lg font-semibold">Instruments ({instruments.length})</h3>
            <div className="grid gap-4 md:grid-cols-3">
                {instruments.map(i => (
                    <Card key={i.id} className="p-4">
                        <div className="font-bold">{i.symbol}</div>
                        <div className="text-sm text-gray-500">{i.display_name || i.segment}</div>
                        <div className="text-xs text-gray-400 mt-1">Lot: {i.lot_size}</div>
                    </Card>
                ))}
            </div>
        </div>
    );
};

// ═══════════════════════════════════════════════════════════════════
// Tab Loading Fallback
// ═══════════════════════════════════════════════════════════════════

const TabLoading = () => (
    <div className="flex items-center justify-center h-64">
        <Spinner size="lg" />
    </div>
);

// ═══════════════════════════════════════════════════════════════════
// Main Admin Page
// ═══════════════════════════════════════════════════════════════════

const TABS = [
    { id: 'health', name: 'Health', icon: HeartIcon },
    { id: 'users', name: 'Users', icon: UsersIcon },
    { id: 'cache', name: 'Cache', icon: ServerStackIcon },
    { id: 'config', name: 'Config', icon: WrenchScrewdriverIcon },
    { id: 'instruments', name: 'Instruments', icon: ChartBarIcon },
    { id: 'apikeys', name: 'API Keys', icon: ShieldCheckIcon },
    { id: 'monitoring', name: 'Monitoring', icon: ChartBarIcon },
    { id: 'features', name: 'Features', icon: AdjustmentsHorizontalIcon },
    { id: 'settings', name: 'Settings', icon: Cog6ToothIcon },
];

const Admin = () => {
    const navigate = useNavigate();
    const user = useSelector((state) => state.auth.user);
    const theme = useSelector((state) => state.theme.theme);
    const isDark = theme === 'dark';
    const [activeTab, setActiveTab] = useState('health');
    const [isChecking, setIsChecking] = useState(true);

    const isAdmin = user?.role === 'admin' || user?.role === 'ADMIN';
    const hasAdminAccess = !!user && isAdmin;

    useEffect(() => {
        const timer = setTimeout(() => setIsChecking(false), 300);
        return () => clearTimeout(timer);
    }, []);

    if (isChecking) {
        return (
            <div className={`min-h-screen flex items-center justify-center ${isDark ? 'bg-gray-900' : 'bg-gray-50'}`}>
                <Spinner size="lg" />
            </div>
        );
    }

    if (!user) {
        return (
            <div className={`min-h-screen flex items-center justify-center ${isDark ? 'bg-gray-900' : 'bg-gray-50'}`}>
                <Card className="text-center p-8 max-w-md">
                    <ShieldCheckIcon className="w-16 h-16 mx-auto text-yellow-500 mb-4" />
                    <h2 className="text-xl font-bold mb-2">Login Required</h2>
                    <Button onClick={() => navigate('/login')}>Go to Login</Button>
                </Card>
            </div>
        );
    }

    if (!hasAdminAccess) {
        return (
            <div className={`min-h-screen flex items-center justify-center ${isDark ? 'bg-gray-900' : 'bg-gray-50'}`}>
                <Card className="text-center p-8 max-w-md">
                    <ShieldCheckIcon className="w-16 h-16 mx-auto text-red-500 mb-4" />
                    <h2 className="text-xl font-bold mb-2">Access Denied</h2>
                    <Button onClick={() => navigate('/dashboard')}>Back to Dashboard</Button>
                </Card>
            </div>
        );
    }

    return (
        <>
            <Helmet>
                <title>Admin Panel | DeepStrike</title>
            </Helmet>

            <div className={`min-h-screen ${isDark ? 'bg-gray-900' : 'bg-gray-50'}`}>
                {/* Header */}
                <div className={`sticky top-0 z-40 ${isDark ? 'bg-gray-800' : 'bg-white'} border-b ${isDark ? 'border-gray-700' : 'border-gray-200'} shadow-sm`}>
                    <div className="px-4 py-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-3">
                                <div className="p-2 bg-gradient-to-r from-purple-600 to-indigo-600 rounded-xl">
                                    <Cog6ToothIcon className="w-6 h-6 text-white" />
                                </div>
                                <div>
                                    <h1 className="text-xl font-bold">Admin Panel</h1>
                                    <p className="text-sm text-gray-500">System Administration</p>
                                </div>
                            </div>
                            <button onClick={() => navigate('/dashboard')} className={`p-2 rounded-lg ${isDark ? 'hover:bg-gray-700' : 'hover:bg-gray-100'}`}>
                                <XMarkIcon className="w-6 h-6" />
                            </button>
                        </div>

                        {/* Tabs */}
                        <div className="flex gap-2 mt-4 overflow-x-auto pb-1 scrollbar-hide">
                            {TABS.map((tab) => {
                                const Icon = tab.icon;
                                return (
                                    <button
                                        key={tab.id}
                                        onClick={() => setActiveTab(tab.id)}
                                        className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${activeTab === tab.id
                                                ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-lg'
                                                : `${isDark ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`
                                            }`}
                                    >
                                        <Icon className="w-5 h-5" />
                                        <span>{tab.name}</span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </div>

                {/* Content */}
                <motion.div
                    key={activeTab}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-6"
                >
                    <Suspense fallback={<TabLoading />}>
                        {activeTab === 'health' && <SystemHealthTab />}
                        {activeTab === 'users' && <UserManagerTab />}
                        {activeTab === 'cache' && <CacheManagerTab />}
                        {activeTab === 'config' && <ConfigManagerTab />}
                        {activeTab === 'instruments' && <InstrumentsTab />}
                        {activeTab === 'apikeys' && <APIKeysTab />}
                        {activeTab === 'monitoring' && <MonitoringTab />}
                        {activeTab === 'features' && <FeatureFlagsTab />}
                        {activeTab === 'settings' && <SettingsOverviewTab />}
                    </Suspense>
                </motion.div>
            </div>
        </>
    );
};

export default Admin;
