/**
 * Cache Manager Tab Component
 * Admin cache management: clear options cache, clear all cache
 */
import { useState } from 'react';
import { useSelector } from 'react-redux';
import { toast } from 'react-toastify';
import { TrashIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import adminService from '../../services/adminService';
import { Button } from '../../components/common';

const CacheManagerTab = () => {
    const [clearing, setClearing] = useState(false);
    const theme = useSelector((state) => state.theme.theme);
    const isDark = theme === 'dark';

    const handleClearCache = async (clearAll = false) => {
        setClearing(true);
        try {
            await adminService.clearCache(null, clearAll);
            toast.success(clearAll ? 'All cache cleared!' : 'Options cache cleared!');
        } catch {
            toast.error('Failed to clear cache');
        } finally {
            setClearing(false);
        }
    };

    return (
        <div className="space-y-6">
            <h3 className="text-lg font-semibold">Cache Management</h3>

            <div className={`p-4 rounded-lg ${isDark ? 'bg-yellow-900/20' : 'bg-yellow-50'} border border-yellow-500`}>
                <div className="flex items-start space-x-3">
                    <ExclamationTriangleIcon className="w-5 h-5 text-yellow-500 mt-0.5" />
                    <div>
                        <div className="font-medium text-yellow-700 dark:text-yellow-300">Warning</div>
                        <div className="text-sm text-yellow-600 dark:text-yellow-400">
                            Clearing cache will force all data to be refetched from external APIs.
                        </div>
                    </div>
                </div>
            </div>

            <div className="flex flex-wrap gap-4">
                <Button onClick={() => handleClearCache(false)} loading={clearing} variant="secondary">
                    <TrashIcon className="w-5 h-5 mr-2" />
                    Clear Options Cache
                </Button>
                <Button onClick={() => handleClearCache(true)} loading={clearing} variant="danger">
                    <TrashIcon className="w-5 h-5 mr-2" />
                    Clear All Cache
                </Button>
            </div>
        </div>
    );
};

export default CacheManagerTab;
