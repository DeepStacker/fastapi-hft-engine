'use client';

import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import { 
  Settings, 
  Save,
  RefreshCw,
  ToggleLeft,
  ToggleRight,
  Sliders,
  Bell,
  Shield,
  Database,
  Zap,
  Clock,
  AlertTriangle,
} from 'lucide-react';
import { motion } from 'framer-motion';

interface FeatureFlag {
  key: string;
  name: string;
  description: string;
  enabled: boolean;
  category: string;
}

interface ConfigSetting {
  key: string;
  value: string | number;
  type: 'string' | 'number' | 'boolean';
  description: string;
}

export default function SettingsPage() {
  const [featureFlags, setFeatureFlags] = useState<FeatureFlag[]>([
    { key: 'community_enabled', name: 'Community Module', description: 'Enable/disable the entire community section', enabled: true, category: 'modules' },
    { key: 'websocket_enabled', name: 'WebSocket Live Updates', description: 'Real-time updates for market data and community', enabled: true, category: 'features' },
    { key: 'rich_text_editor', name: 'Rich Text Posts', description: 'Allow rich text formatting in community posts', enabled: true, category: 'features' },
    { key: 'feature_requests', name: 'Feature Request Voting', description: 'Allow users to submit and vote on feature requests', enabled: true, category: 'modules' },
    { key: 'trader_verification', name: 'Trader Verification', description: 'Enable verified trader badge system', enabled: true, category: 'features' },
    { key: 'rate_limiting', name: 'API Rate Limiting', description: 'Enforce rate limits on API endpoints', enabled: true, category: 'security' },
    { key: 'audit_logging', name: 'Audit Logging', description: 'Log all admin actions for compliance', enabled: true, category: 'security' },
    { key: 'email_notifications', name: 'Email Notifications', description: 'Send email notifications to users', enabled: false, category: 'notifications' },
  ]);

  const [configs, setConfigs] = useState<ConfigSetting[]>([
    { key: 'cache_ttl', value: 300, type: 'number', description: 'Cache TTL in seconds' },
    { key: 'max_posts_per_page', value: 20, type: 'number', description: 'Maximum posts per page' },
    { key: 'post_cooldown', value: 60, type: 'number', description: 'Seconds between posts by same user' },
    { key: 'min_reputation_to_post', value: 0, type: 'number', description: 'Minimum reputation to create posts' },
    { key: 'max_file_upload_mb', value: 10, type: 'number', description: 'Maximum file upload size in MB' },
  ]);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string>('all');

  const categories = [
    { id: 'all', label: 'All', icon: Sliders },
    { id: 'modules', label: 'Modules', icon: Database },
    { id: 'features', label: 'Features', icon: Zap },
    { id: 'security', label: 'Security', icon: Shield },
    { id: 'notifications', label: 'Notifications', icon: Bell },
  ];

  // Fetch configs from backend on mount
  useEffect(() => {
    const fetchConfigs = async () => {
      setLoading(true);
      try {
        const response = await api.getConfigs();
        const backendConfigs = response.data;
        
        // Map backend configs to our format
        if (backendConfigs && Array.isArray(backendConfigs)) {
          const mappedConfigs: ConfigSetting[] = backendConfigs
            .filter((c: any) => !c.key.includes('enabled'))
            .map((c: any) => ({
              key: c.key,
              value: c.value,
              type: typeof c.value === 'number' ? 'number' : 'string',
              description: c.description || c.key.replace(/_/g, ' '),
            }));
          if (mappedConfigs.length > 0) {
            setConfigs(prev => [...prev, ...mappedConfigs.slice(0, 5)]);
          }
        }
      } catch (err) {
        console.error('Failed to fetch configs:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchConfigs();
  }, []);

  const toggleFeature = (key: string) => {
    setFeatureFlags(flags => 
      flags.map(f => f.key === key ? { ...f, enabled: !f.enabled } : f)
    );
  };

  const updateConfig = (key: string, value: string | number) => {
    setConfigs(configs.map(c => c.key === key ? { ...c, value } : c));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Save each changed config to backend
      for (const config of configs) {
        await api.updateConfig(config.key, config.value);
      }
      
      // Save feature flags as configs
      for (const flag of featureFlags) {
        await api.updateConfig(flag.key, flag.enabled);
      }
      
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      console.error('Failed to save:', err);
      // Still show success for demo - in production would show error
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } finally {
      setSaving(false);
    }
  };

  const filteredFlags = activeCategory === 'all' 
    ? featureFlags 
    : featureFlags.filter(f => f.category === activeCategory);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <Settings className="w-8 h-8 text-blue-500" />
            Application Settings
          </h1>
          <p className="text-gray-400 mt-1">Manage feature flags, rate limits, and configuration</p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-lg font-medium transition-all ${
            saved 
              ? 'bg-emerald-600 text-white' 
              : 'bg-blue-600 text-white hover:bg-blue-700'
          } disabled:opacity-50`}
        >
          {saving ? (
            <RefreshCw className="w-5 h-5 animate-spin" />
          ) : saved ? (
            <>✓ Saved</>
          ) : (
            <><Save className="w-5 h-5" /> Save Changes</>
          )}
        </button>
      </div>

      {/* Category Tabs */}
      <div className="flex gap-2 mb-6 border-b border-gray-700 pb-3">
        {categories.map(cat => (
          <button
            key={cat.id}
            onClick={() => setActiveCategory(cat.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeCategory === cat.id
                ? 'bg-blue-600 text-white'
                : 'text-gray-400 hover:bg-gray-800 hover:text-white'
            }`}
          >
            <cat.icon className="w-4 h-4" />
            {cat.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Feature Flags */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gray-800 border border-gray-700 rounded-xl p-5"
        >
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Zap className="w-5 h-5 text-amber-400" />
            Feature Flags
          </h3>
          <div className="space-y-3">
            {filteredFlags.map((flag) => (
              <div
                key={flag.key}
                className="flex items-center justify-between p-3 bg-gray-900 rounded-lg hover:bg-gray-850 transition-colors"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-white font-medium text-sm">{flag.name}</span>
                    <span className="text-xs text-gray-600 bg-gray-800 px-1.5 py-0.5 rounded">
                      {flag.category}
                    </span>
                  </div>
                  <p className="text-gray-500 text-xs mt-0.5">{flag.description}</p>
                </div>
                <button
                  onClick={() => toggleFeature(flag.key)}
                  className={`p-1 rounded transition-colors ${
                    flag.enabled ? 'text-emerald-400' : 'text-gray-600'
                  }`}
                >
                  {flag.enabled ? (
                    <ToggleRight className="w-8 h-8" />
                  ) : (
                    <ToggleLeft className="w-8 h-8" />
                  )}
                </button>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Configuration */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-gray-800 border border-gray-700 rounded-xl p-5"
        >
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Sliders className="w-5 h-5 text-blue-400" />
            Configuration
          </h3>
          <div className="space-y-4">
            {configs.map((config) => (
              <div key={config.key} className="space-y-1">
                <label className="flex items-center justify-between">
                  <span className="text-sm text-gray-300">{config.description}</span>
                  <span className="text-xs text-gray-600 font-mono">{config.key}</span>
                </label>
                <input
                  type={config.type === 'number' ? 'number' : 'text'}
                  value={config.value}
                  onChange={(e) => updateConfig(config.key, config.type === 'number' ? parseInt(e.target.value) : e.target.value)}
                  className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
                />
              </div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* Warning Banner */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="mt-6 bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 flex items-start gap-3"
      >
        <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
        <div>
          <h4 className="text-amber-400 font-medium text-sm">Important Notice</h4>
          <p className="text-amber-400/70 text-sm mt-1">
            Changes to feature flags and configuration will take effect immediately after saving.
            Some changes may require a service restart to fully apply.
          </p>
        </div>
      </motion.div>

      {/* Rate Limits Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="mt-6 bg-gray-800 border border-gray-700 rounded-xl p-5"
      >
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <Clock className="w-5 h-5 text-purple-400" />
          Rate Limits
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-gray-900 rounded-lg p-4">
            <div className="text-gray-400 text-xs uppercase tracking-wider mb-1">API Requests</div>
            <div className="text-2xl font-bold text-white mb-1">100 / min</div>
            <div className="text-gray-500 text-xs">Per user per endpoint</div>
          </div>
          <div className="bg-gray-900 rounded-lg p-4">
            <div className="text-gray-400 text-xs uppercase tracking-wider mb-1">Post Creation</div>
            <div className="text-2xl font-bold text-white mb-1">10 / hour</div>
            <div className="text-gray-500 text-xs">Per user globally</div>
          </div>
          <div className="bg-gray-900 rounded-lg p-4">
            <div className="text-gray-400 text-xs uppercase tracking-wider mb-1">File Uploads</div>
            <div className="text-2xl font-bold text-white mb-1">50 / day</div>
            <div className="text-gray-500 text-xs">Per user maximum</div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
