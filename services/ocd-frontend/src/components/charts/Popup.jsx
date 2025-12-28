import { useState, useMemo, useEffect, useCallback } from 'react';
import { Line } from 'react-chartjs-2';
import {
    Chart as ChartJS,
    LineElement,
    PointElement,
    CategoryScale,
    LinearScale,
    Tooltip,
    Legend,
    Title,
} from 'chart.js';
import zoomPlugin from 'chartjs-plugin-zoom';
import { FaTimes } from 'react-icons/fa';
import PropTypes from 'prop-types';
import { useSelector } from 'react-redux';
// import { formatChartNumber } from '../../utils/utils';

// Register Chart.js modules and plugins
ChartJS.register(LineElement, PointElement, CategoryScale, LinearScale, Tooltip, Legend, Title, zoomPlugin);

const DeltaPopup = ({ onClose }) => {
    const data = useSelector((state) => state.optionChain.popupData);
    const theme = useSelector((state) => state.theme.theme);
    const [activeSection, setActiveSection] = useState('IV');
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        // Simulate processing/loading time
        if (data) {
            setIsLoading(true);
            const timeout = setTimeout(() => setIsLoading(false), 200); // Adjust this delay as needed
            return () => clearTimeout(timeout);
        }
    }, [data, activeSection]);

    // Theme-specific colors
    const themeColors = useMemo(() => ({
        background: theme === 'dark' ? 'bg-gray-800' : 'bg-teal-400',
        text: theme === 'dark' ? '#e0e0e0' : '#333',
        gridColor: theme === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
    }), [theme]);

    // Memoized formatted timestamps
    const shortTimeLabels = useMemo(
        () => {
            if (!data?.timestamp) return [];
            return data.timestamp.map((ts) =>
                new Date(ts * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            );
        },
        [data]
    );

    // Helper to create dataset
    const createDataset = useCallback((label, dataPoints, color, hidden = false) => ({
        label,
        data: dataPoints,
        borderColor: color,
        backgroundColor: color.replace('1)', '0.2)'),
        fill: false,
        pointRadius: 0,
        borderWidth: 1,
        tension: 0.1,
        hidden,
    }), []);

    // Memoized chart data based on the active section
    const chartData = useMemo(() => {
        if (!data) return { labels: [], datasets: [] };
        return {
            labels: shortTimeLabels,
            datasets:
                activeSection === 'IV'
                    ? [
                        createDataset('CE IV', data.ce_iv, 'rgba(255, 0, 0, 1)'),
                        createDataset('PE IV', data.pe_iv, 'rgba(0, 255, 0, 1)'),
                    ]
                    : [
                        createDataset('CE DELTA', data.ce_delta, 'rgba(255, 0, 0, 1)'),
                        createDataset('PE DELTA', data.pe_delta, 'rgba(0, 255, 0, 1)'),
                        createDataset('CE GAMMA', data.ce_gamma, 'rgba(255, 0, 0, 1)', true),
                        createDataset('PE GAMMA', data.pe_gamma, 'rgba(0, 255, 0, 1)', true),
                        createDataset('CE THETA', data.ce_theta, 'rgba(255, 0, 0, 1)', true),
                        createDataset('PE THETA', data.pe_theta, 'rgba(0, 255, 0, 1)', true),
                        createDataset('CE VEGA', data.ce_vega, 'rgba(255, 0, 0, 1)', true),
                        createDataset('PE VEGA', data.pe_vega, 'rgba(0, 255, 0, 1)', true),
                    ],
        };
    }, [data, activeSection, shortTimeLabels, createDataset]);

    // Memoized chart options
    const chartOptions = useMemo(() => {
        return {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    labels: {
                        color: themeColors.text,
                        font: {
                            size: 16,
                            family: 'Courier New, monospace',
                        },
                    },
                },
                tooltip: {
                    mode: 'nearest',
                    intersect: false,
                },
                zoom: {
                    zoom: {
                        wheel: { enabled: true },
                        pinch: { enabled: true },
                        mode: 'xy',
                    },
                    pan: { enabled: true, mode: 'xy' },
                },
            },
            scales: {
                x: {
                    ticks: { color: themeColors.text },
                    grid: { color: themeColors.gridColor },
                },
                y: {
                    ticks: { color: themeColors.text },
                    grid: { color: themeColors.gridColor },
                },
            },
        };
    }, [themeColors]);

    if (!data) return null;

    return (
        <div
            className={`fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 ${themeColors.background}  rounded-lg p-4 w-[97%] h-[95%] z-50`}
            role="dialog"
            aria-modal="true"
        >
            <div className="flex flex-col items-center relative w-full h-full">
                <button
                    onClick={onClose}
                    aria-label="Close Popup"
                    className="absolute top-1 right-2 text-gray-800 hover:text-gray-600"
                >
                    <FaTimes size={24} color={themeColors.text} />
                </button>
                <p className={`text-2xl font-bold ${themeColors.text}`}>
                    {data.strike} {data.isCe ? 'CE' : 'PE'}
                </p>

                <div className="flex justify-center gap-4 my-4">
                    <p
                        onClick={() => setActiveSection('IV')}
                        className={`py-0 cursor-pointer px-4 rounded ${activeSection === 'IV' ? 'bg-white text-gray-800' : 'bg-gray-500 text-gray-200'
                            }`}
                    >
                        IV
                    </p>
                    <p
                        onClick={() => setActiveSection('GREEKS')}
                        className={`py-0 cursor-pointer px-4 rounded ${activeSection === 'GREEKS' ? 'bg-white text-gray-800' : 'bg-gray-500 text-gray-200'
                            }`}
                    >
                        GREEKS
                    </p>
                </div>

                <div className="w-full h-full p-4">
                    {isLoading ? (
                        <div className="flex items-center justify-center w-full h-full">
                            <p className={`text-lg ${themeColors.text}`}>Loading chart...</p>
                        </div>
                    ) : (
                        <Line data={chartData} options={chartOptions} />
                    )}
                </div>
            </div>
        </div>
    );
};

DeltaPopup.propTypes = {
    onClose: PropTypes.func.isRequired,
};

export default DeltaPopup;
