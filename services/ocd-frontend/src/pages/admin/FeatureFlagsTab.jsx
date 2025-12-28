/**
 * Feature Flags Tab Component
 * Toggle application features on/off
 */
import { useState, useEffect, useCallback } from 'react';
import { useSelector } from 'react-redux';
import { toast } from 'react-toastify';
import { ArrowPathIcon } from '@heroicons/react/24/outline';
import adminService from '../../services/adminService';
import { Card, Spinner } from '../../components/common';

const FeatureFlagsTab = () => {
    const [features, setFeatures] = useState([]);
    const [loading, setLoading] = useState(true);
    const [toggling, setToggling] = useState({});
    const theme = useSelector((state) => state.theme.theme);
    const isDark = theme === 'dark';

    const fetchFeatures = useCallback(async () => {
        setLoading(true);
        try {
            const data = await adminService.getFeatureFlags();
            setFeatures(Array.isArray(data) ? data : (data?.data || []));
        } catch (err) {
            console.error('Failed to fetch features:', err);
            toast.error('Failed to load feature flags');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchFeatures();
    }, [fetchFeatures]);

    const handleToggle = async (key, currentValue) => {
        setToggling(prev => ({ ...prev, [key]: true }));
        try {
            await adminService.toggleFeature(key, !currentValue);
            toast.success(`Feature ${!currentValue ? 'enabled' : 'disabled'}`);
            fetchFeatures();
        } catch {
            toast.error('Failed to toggle feature');
        } finally {
            setToggling(prev => ({ ...prev, [key]: false }));
        }
    };

    if (loading) {
        return <div className="flex justify-center py-12"><Spinner size="lg" /></div>;
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-lg font-semibold">Feature Flags</h3>
                    <p className="text-sm text-gray-500">Enable or disable application features</p>
                </div>
                <button onClick={fetchFeatures} className={`p-2 rounded-lg ${isDark ? 'hover:bg-gray-700' : 'hover:bg-gray-100'}`}>
                    <ArrowPathIcon className="w-5 h-5" />
                </button>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
                {features.map((flag) => (
                    <Card key={flag.key} className="p-4">
                        <div className="flex items-center justify-between">
                            <div className="flex-1">
                                <div className="font-medium">{flag.display_name}</div>
                                <div className="text-sm text-gray-500">{flag.description}</div>
                            </div>
                            <button
                                onClick={() => handleToggle(flag.key, flag.enabled)}
                                disabled={toggling[flag.key]}
                                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${flag.enabled
                                        ? 'bg-green-500'
                                        : isDark ? 'bg-gray-600' : 'bg-gray-300'
                                    }`}
                            >
                                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${flag.enabled ? 'translate-x-6' : 'translate-x-1'
                                    }`} />
                            </button>
                        </div>
                    </Card>
                ))}
                {features.length === 0 && (
                    <Card className="col-span-full text-center py-12 text-gray-500">
                        No feature flags found. Run the database seeder to create default flags.
                    </Card>
                )}
            </div>
        </div>
    );
};

export default FeatureFlagsTab;
