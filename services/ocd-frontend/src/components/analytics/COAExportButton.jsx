/**
 * COA Export Button Component
 * Allows exporting COA history data in CSV or JSON format
 */
import { useState } from 'react';
import { useSelector } from 'react-redux';
import apiClient from '../../services/apiClient';
import {
    ArrowDownTrayIcon,
    DocumentTextIcon,
    TableCellsIcon
} from '@heroicons/react/24/outline';

const COAExportButton = ({ startTime, endTime, interval = '5 minutes' }) => {
    const symbol = useSelector(state => state.symbol?.selected || 'NIFTY');
    const [exporting, setExporting] = useState(false);
    const [format, setFormat] = useState('csv');
    const [showMenu, setShowMenu] = useState(false);

    const handleExport = async (selectedFormat) => {
        setExporting(true);
        setShowMenu(false);

        try {
            const params = new URLSearchParams({
                format: selectedFormat,
                interval,
            });

            if (startTime) params.append('start_time', startTime);
            if (endTime) params.append('end_time', endTime);

            const response = await apiClient.get(
                `/analytics/${symbol}/coa/history/export?${params.toString()}`,
                { responseType: 'blob' }
            );

            // Create download link
            const blob = new Blob([response.data], {
                type: selectedFormat === 'csv' ? 'text/csv' : 'application/json'
            });
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;

            // Get filename from header or generate one
            const contentDisposition = response.headers?.['content-disposition'];
            let filename = `coa_history_${symbol}.${selectedFormat}`;
            if (contentDisposition) {
                const match = contentDisposition.match(/filename=(.+)/);
                if (match) filename = match[1];
            }

            link.setAttribute('download', filename);
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);

        } catch (err) {
            console.error('Export failed:', err);
            alert('Export failed. Please try again.');
        } finally {
            setExporting(false);
        }
    };

    return (
        <div className="relative">
            <button
                onClick={() => setShowMenu(!showMenu)}
                disabled={exporting}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
            >
                {exporting ? (
                    <>
                        <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        Exporting...
                    </>
                ) : (
                    <>
                        <ArrowDownTrayIcon className="w-4 h-4" />
                        Export
                    </>
                )}
            </button>

            {/* Dropdown Menu */}
            {showMenu && (
                <div className="absolute right-0 top-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-10 min-w-[140px]">
                    <button
                        onClick={() => handleExport('csv')}
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors rounded-t-lg"
                    >
                        <TableCellsIcon className="w-4 h-4 text-green-600" />
                        Export CSV
                    </button>
                    <button
                        onClick={() => handleExport('json')}
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors rounded-b-lg"
                    >
                        <DocumentTextIcon className="w-4 h-4 text-blue-600" />
                        Export JSON
                    </button>
                </div>
            )}
        </div>
    );
};

export default COAExportButton;
