import { useState, useMemo, lazy, Suspense } from 'react';
import { FaTimes } from 'react-icons/fa';
import PropTypes from 'prop-types';
import { useSelector } from 'react-redux';
import { Chart as ChartJS, LineElement, PointElement, CategoryScale, LinearScale, Tooltip, Legend, Title } from 'chart.js';
import zoomPlugin from 'chartjs-plugin-zoom';

// Register Chart.js modules and plugins
ChartJS.register(LineElement, PointElement, CategoryScale, LinearScale, Tooltip, Legend, Title, zoomPlugin);

// Lazy load the Line component
const Line = lazy(() => import('react-chartjs-2').then((mod) => ({ default: mod.Line })));

const FuturePopup = ({ onClose }) => {
    const data = useSelector((state) => state.optionChain.popupData);
    const theme = useSelector((state) => state.theme.theme);
    const [activeSection, setActiveSection] = useState('Future');

    const themeColors = useMemo(() => ({
        background: theme === 'dark' ? 'bg-gray-800' : 'bg-teal-400',
        text: theme === 'dark' ? '#e0e0e0' : '#333',
        gridColor: theme === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
    }), [theme]);

    const shortTimeLabels = useMemo(() => {
        if (!data?.timestamp) return [];
        return data.timestamp.map((ts) => new Date(ts * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    }, [data]);

    const createDataset = useMemo(() => (label, dataPoints, color, axis, hidden = false) => ({
        label,
        data: dataPoints,
        borderColor: color,
        backgroundColor: color.replace('1)', '0.2)'),
        fill: false,
        pointRadius: 0,
        borderWidth: 1,
        tension: 0.1,
        hidden, // Default hidden state
        yAxisID: axis, // Specify which y-axis to use
    }), []);

    const chartData = useMemo(() => {
        if (!data) return { labels: [], datasets: [] };
        return {
            labels: shortTimeLabels,
            datasets: activeSection === 'Future'
                ? [
                    createDataset('Future Ltp', data.ltp, 'rgba(18, 180, 255, 1)', 'y1'),
                    createDataset('Future OIChng', data.oichng, 'rgba(0, 255, 0, 1)', 'y', true),
                    createDataset('Future OI', data.oi, 'rgba(255, 0, 0, 1)', 'y'),
                ]
                : [],
        };
    }, [shortTimeLabels, activeSection, createDataset, data]);

    const chartOptions = useMemo(() => ({
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
                    padding: 2,
                    boxWidth: 10,
                    boxHeight: 10,
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
                type: 'linear',
                display: true,
                position: 'left',
                ticks: { color: themeColors.text },
                grid: { color: themeColors.gridColor },
                title: {
                    display: true,
                    text: 'OI / OI Change',
                    color: themeColors.text,
                },
            },
            y1: {
                type: 'linear',
                display: true,
                position: 'right',
                ticks: { color: themeColors.text },
                grid: { drawOnChartArea: false },
                title: {
                    display: true,
                    text: 'LTP',
                    color: themeColors.text,
                },
            },
        },
    }), [themeColors]);

    if (!data) return null;

    return (
        <div className={`fixed inset-0 z-50 flex items-center justify-center p-4 ${
            theme === 'dark' ? 'bg-black/50' : 'bg-gray-500/50'
        }`}>
            <div className={`relative w-full max-w-4xl rounded-xl shadow-2xl ${
                theme === 'dark' ? 'bg-gray-800' : 'bg-white'
            } p-6`}>
                {/* Content */}
                <div className="space-y-4">
                    {/* Chart */}
                    <div className="h-[400px] w-full">
                        <Suspense fallback={<div className="h-full w-full flex items-center justify-center">Loading chart...</div>}>
                            <Line data={chartData} options={chartOptions} />
                        </Suspense>
                    </div>
                    <button onClick={onClose} aria-label="Close Popup" className="absolute top-1 right-2 text-gray-800 hover:text-gray-600">
                        <FaTimes size={24} color={themeColors.text} />
                    </button>
                    <p className={`text-2xl font-bold ${themeColors.text}`}>
                        Future Buildup
                    </p>

                    <div className="flex justify-center gap-4 my-4">
                        <p
                            onClick={() => setActiveSection('Future')}
                            className={`py-0 cursor-pointer px-4 rounded ${activeSection === 'Future' ? 'bg-white text-gray-800' : 'bg-gray-500 text-gray-200'}`}
                        >
                            Future
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

FuturePopup.propTypes = {
    onClose: PropTypes.func.isRequired,
};

export default FuturePopup;
