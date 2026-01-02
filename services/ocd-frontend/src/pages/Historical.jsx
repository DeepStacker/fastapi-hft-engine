import { useState, useEffect, useCallback, useRef } from 'react';
import { Helmet } from 'react-helmet-async';
import { useSelector, useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import {
    CalendarDaysIcon,
    ClockIcon,
    PlayIcon,
    PauseIcon,
    ForwardIcon,
    BackwardIcon,
    ChevronDoubleLeftIcon,
    ChevronDoubleRightIcon,
    ChartBarIcon,
    Cog6ToothIcon,
    QuestionMarkCircleIcon
} from '@heroicons/react/24/solid';
import { historicalService } from '../services/historicalService';
import { setSid } from '../context/dataSlice';
import { selectIsAuthenticated, selectSelectedSymbol } from '../context/selectors';
import { ColumnConfigProvider } from '../context/ColumnConfigContext';
import { TableSettingsProvider } from '../context/TableSettingsContext';
import { SettingsButton } from '../components/features/options/TableSettingsModal';
import OptionChainTable from '../components/features/options/OptionChainTable';
import SymbolSelector from '../components/charts/SymbolSelector';
import TimeClockSelector from '../components/common/TimeClockSelector';
import Button from '../components/common/Button';

// Time-based interval presets (in seconds)
const INTERVAL_PRESETS = [
    { label: '5s', value: 5, description: '5 seconds' },
    { label: '15s', value: 15, description: '15 seconds' },
    { label: '30s', value: 30, description: '30 seconds' },
    { label: '1m', value: 60, description: '1 minute' },
    { label: '5m', value: 300, description: '5 minutes' },
    { label: '15m', value: 900, description: '15 minutes' },
    { label: '30m', value: 1800, description: '30 minutes' },
    { label: '1h', value: 3600, description: '1 hour' },
];

// Playback speed presets (milliseconds between auto-steps)
const SPEED_PRESETS = [
    { label: '0.5x', value: 2000 },
    { label: '1x', value: 1000 },
    { label: '2x', value: 500 },
    { label: '3x', value: 333 },
    { label: '5x', value: 200 },
    { label: '10x', value: 100 },
];

// Market hours (IST)
const MARKET_OPEN = { hour: 9, minute: 15, second: 0 };
const MARKET_CLOSE = { hour: 15, minute: 30, second: 0 };

// Helper: Parse time string to seconds since midnight
const parseTimeToSeconds = (timeStr) => {
    if (!timeStr) return null;
    const parts = timeStr.split(':');
    const hours = parseInt(parts[0] || 0);
    const minutes = parseInt(parts[1] || 0);
    const seconds = parseInt(parts[2] || 0);
    return hours * 3600 + minutes * 60 + seconds;
};

// Helper: Format seconds since midnight to HH:MM:SS or HH:MM
const formatSecondsToTime = (totalSeconds, includeSeconds = true) => {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    if (includeSeconds) {
        return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    }
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
};

/**
 * Historical Option Chain Page
 * 
 * Features:
 * - Expiry-Centric Navigation
 * - Strict Data Isolation (No Live Data Leakage)
 * - Custom Clock Interface
 * - Enhanced Playback Controls with Interval, Speed, and Shortcuts
 */
const Historical = () => {
    const isAuthenticated = useSelector(selectIsAuthenticated);
    const navigate = useNavigate();
    const dispatch = useDispatch();

    // Global State
    const selectedSymbol = useSelector(selectSelectedSymbol);
    const symbols = useSelector((state) => state.chart.symbols);
    const theme = useSelector((state) => state.theme.theme);

    // Selection State
    const [availableExpiries, setAvailableExpiries] = useState([]);
    const [selectedExpiry, setSelectedExpiry] = useState('');

    const [availableDates, setAvailableDates] = useState([]);
    const [selectedDate, setSelectedDate] = useState('');

    const [showClock, setShowClock] = useState(false);

    // Data State
    const [snapshotData, setSnapshotData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    // Enhanced Playback State (time-based)
    const [isPlaying, setIsPlaying] = useState(false);
    const [playbackSpeed, setPlaybackSpeed] = useState(1000);
    const [stepInterval, setStepInterval] = useState(300); // Default 5 minutes in seconds
    const [playbackTime, setPlaybackTime] = useState('09:15:00'); // Current playback time HH:MM:SS
    const [showSettings, setShowSettings] = useState(false);
    const intervalRef = useRef(null);
    const controlsRef = useRef(null);
    const abortControllerRef = useRef(null); // For request cancellation

    // Initial Symbol Fetch (if missing)
    useEffect(() => {
        if (!symbols || symbols.length === 0) {
            import('../services/analyticsService').then(({ analyticsService }) => {
                analyticsService.getSymbols().then(data => {
                    if (data.success && data.data) {
                        import('../context/chartSlice').then(({ setSymbols }) => {
                            dispatch(setSymbols(data.data));
                        });
                    }
                });
            });
        }
    }, [symbols, dispatch]);

    // 1. Handle Symbol Change
    const handleSymbolChange = (symbolObj) => {
        console.log("Historical: Symbol changed to", symbolObj);
        // Clear downstream
        setAvailableExpiries([]);
        setAvailableDates([]);
        setSnapshotData(null);
        setSelectedExpiry('');
        setSelectedDate('');
        setPlaybackTime('09:15:00');

        // Update Symbol Redux - Use setSid directly to avoid triggering live data fetch
        dispatch(setSid(symbolObj.symbol));
    };

    // 2. Fetch Expiries when Symbol Changes
    useEffect(() => {
        if (!selectedSymbol) return;

        const fetchExpiries = async () => {
            try {
                const response = await historicalService.getAvailableExpiries(selectedSymbol);
                setAvailableExpiries(response.expiries || []);
            } catch (err) {
                console.error("Failed to fetch expiries:", err);
            }
        };
        fetchExpiries();
    }, [selectedSymbol]);

    // 3. Fetch Dates when Expiry Changes
    useEffect(() => {
        if (!selectedSymbol || !selectedExpiry) {
            setAvailableDates([]);
            return;
        }

        const fetchDates = async () => {
            // Reset downstream
            setAvailableDates([]);
            setSelectedDate('');
            setSnapshotData(null);

            try {
                // Pass expiry to filter dates correctly
                const response = await historicalService.getAvailableDates(selectedSymbol, selectedExpiry);
                setAvailableDates(response.dates || []);
            } catch (err) {
                console.error("Failed to fetch dates:", err);
            }
        };
        fetchDates();
    }, [selectedSymbol, selectedExpiry]);

    // 4. Fetch Times - REMOVED (Time-based navigation)

    // 5. Fetch Snapshot logic
    const fetchSnapshot = useCallback(async (timeStr) => {
        if (!selectedSymbol || !selectedExpiry || !selectedDate || !timeStr) return;

        setLoading(true);
        setError(null);
        try {
            const response = await historicalService.getHistoricalSnapshot({
                symbol: selectedSymbol,
                expiry: selectedExpiry,
                date: selectedDate,
                time: timeStr
            });
            setSnapshotData(response);
        } catch (err) {
            console.error("Failed to fetch snapshot:", err);
            setError("No data available for this timestamp");
            setSnapshotData(null);
        } finally {
            setLoading(false);
        }
    }, [selectedSymbol, selectedExpiry, selectedDate]);

    // Handle Clock Time Selection
    const handleTimeSelect = (timeStr) => {
        // Ensure HH:MM:SS format
        const normalizedTime = timeStr.includes(':') && timeStr.split(':').length === 2
            ? `${timeStr}:00`
            : timeStr;
        setPlaybackTime(normalizedTime);
        fetchSnapshot(normalizedTime);
    };

    // Step navigation with time-based intervals
    const stepForward = useCallback(() => {
        const currentSeconds = parseTimeToSeconds(playbackTime);
        const marketCloseSeconds = MARKET_CLOSE.hour * 3600 + MARKET_CLOSE.minute * 60;
        const newSeconds = Math.min(marketCloseSeconds, currentSeconds + stepInterval);
        const newTime = formatSecondsToTime(newSeconds);
        setPlaybackTime(newTime);
        // Fetch snapshot for new time
        if (selectedSymbol && selectedExpiry && selectedDate) {
            fetchSnapshot(newTime);
        }
    }, [playbackTime, stepInterval, selectedSymbol, selectedExpiry, selectedDate, fetchSnapshot]);

    const stepBackward = useCallback(() => {
        const currentSeconds = parseTimeToSeconds(playbackTime);
        const marketOpenSeconds = MARKET_OPEN.hour * 3600 + MARKET_OPEN.minute * 60;
        const newSeconds = Math.max(marketOpenSeconds, currentSeconds - stepInterval);
        const newTime = formatSecondsToTime(newSeconds);
        setPlaybackTime(newTime);
        // Fetch snapshot for new time
        if (selectedSymbol && selectedExpiry && selectedDate) {
            fetchSnapshot(newTime);
        }
    }, [playbackTime, stepInterval, selectedSymbol, selectedExpiry, selectedDate, fetchSnapshot]);

    const jumpToStart = useCallback(() => {
        const marketOpenTime = formatSecondsToTime(MARKET_OPEN.hour * 3600 + MARKET_OPEN.minute * 60);
        setPlaybackTime(marketOpenTime);
        if (selectedSymbol && selectedExpiry && selectedDate) {
            fetchSnapshot(marketOpenTime);
        }
    }, [selectedSymbol, selectedExpiry, selectedDate, fetchSnapshot]);

    const jumpToEnd = useCallback(() => {
        const marketCloseTime = formatSecondsToTime(MARKET_CLOSE.hour * 3600 + MARKET_CLOSE.minute * 60);
        setPlaybackTime(marketCloseTime);
        if (selectedSymbol && selectedExpiry && selectedDate) {
            fetchSnapshot(marketCloseTime);
        }
    }, [selectedSymbol, selectedExpiry, selectedDate, fetchSnapshot]);

    const togglePlay = useCallback(() => {
        setIsPlaying(prev => !prev);
    }, []);

    // Keyboard shortcuts
    useEffect(() => {
        const handleKeyDown = (e) => {
            // Don't trigger if typing in an input
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA') {
                return;
            }

            switch (e.key) {
                case ' ': // Space - Play/Pause
                    e.preventDefault();
                    togglePlay();
                    break;
                case 'ArrowLeft': // Left arrow - Step back
                    e.preventDefault();
                    stepBackward();
                    break;
                case 'ArrowRight': // Right arrow - Step forward
                    e.preventDefault();
                    stepForward();
                    break;
                case 'Home': // Home - Jump to start
                    e.preventDefault();
                    jumpToStart();
                    break;
                case 'End': // End - Jump to end
                    e.preventDefault();
                    jumpToEnd();
                    break;
                case '[': // [ - Decrease speed
                    e.preventDefault();
                    setPlaybackSpeed(prev => {
                        const idx = SPEED_PRESETS.findIndex(p => p.value === prev);
                        return idx > 0 ? SPEED_PRESETS[idx - 1].value : prev;
                    });
                    break;
                case ']': // ] - Increase speed
                    e.preventDefault();
                    setPlaybackSpeed(prev => {
                        const idx = SPEED_PRESETS.findIndex(p => p.value === prev);
                        return idx < SPEED_PRESETS.length - 1 ? SPEED_PRESETS[idx + 1].value : prev;
                    });
                    break;
                case ',': // , - Decrease step interval
                    e.preventDefault();
                    setStepInterval(prev => {
                        const idx = INTERVAL_PRESETS.findIndex(p => p.value === prev);
                        return idx > 0 ? INTERVAL_PRESETS[idx - 1].value : prev;
                    });
                    break;
                case '.': // . - Increase step interval
                    e.preventDefault();
                    setStepInterval(prev => {
                        const idx = INTERVAL_PRESETS.findIndex(p => p.value === prev);
                        return idx < INTERVAL_PRESETS.length - 1 ? INTERVAL_PRESETS[idx + 1].value : prev;
                    });
                    break;
                default:
                    break;
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [togglePlay, stepForward, stepBackward, jumpToStart, jumpToEnd]);

    // Auto-play loop with time-based stepping
    // Uses request counter to ignore stale responses (don't cancel - let them complete)
    useEffect(() => {
        let requestCounter = 0; // Track latest request

        if (isPlaying && selectedSymbol && selectedExpiry && selectedDate) {
            const marketCloseSeconds = MARKET_CLOSE.hour * 3600 + MARKET_CLOSE.minute * 60;

            intervalRef.current = setInterval(() => {
                setPlaybackTime(prev => {
                    const currentSeconds = parseTimeToSeconds(prev);
                    const newSeconds = currentSeconds + stepInterval;

                    if (newSeconds >= marketCloseSeconds) {
                        setIsPlaying(false);
                        return formatSecondsToTime(marketCloseSeconds);
                    }

                    const newTime = formatSecondsToTime(newSeconds);

                    // Increment counter for this request
                    const thisRequest = ++requestCounter;

                    // Fetch snapshot - don't cancel, just ignore stale responses
                    historicalService.getHistoricalSnapshot({
                        symbol: selectedSymbol,
                        expiry: selectedExpiry,
                        date: selectedDate,
                        time: newTime
                    }).then(data => {
                        // Only apply if this is still the latest request
                        if (thisRequest === requestCounter && data) {
                            setSnapshotData(data);
                        }
                    }).catch(e => {
                        console.error('Snapshot fetch error:', e);
                    });

                    return newTime;
                });
            }, playbackSpeed);
        }

        // Cleanup: just clear interval, let pending requests complete
        return () => {
            clearInterval(intervalRef.current);
            requestCounter = 0; // Reset counter so pending responses are ignored
        };
    }, [isPlaying, selectedSymbol, selectedExpiry, selectedDate, playbackSpeed, stepInterval]);

    if (!isAuthenticated) return <div className="p-8 text-center text-gray-500">Authentication Required</div>;

    // Calculate display values from playbackTime
    const displayTime = snapshotData?.time || playbackTime;

    // Calculate progress based on market hours
    const marketOpenSeconds = MARKET_OPEN.hour * 3600 + MARKET_OPEN.minute * 60;
    const marketCloseSeconds = MARKET_CLOSE.hour * 3600 + MARKET_CLOSE.minute * 60;
    const currentSeconds = parseTimeToSeconds(playbackTime) || marketOpenSeconds;
    const progress = ((currentSeconds - marketOpenSeconds) / (marketCloseSeconds - marketOpenSeconds)) * 100;

    const isReady = !!(selectedSymbol && selectedExpiry && selectedDate);

    const currentSpeedLabel = SPEED_PRESETS.find(p => p.value === playbackSpeed)?.label || '1x';
    const currentIntervalLabel = INTERVAL_PRESETS.find(p => p.value === stepInterval)?.label || '5m';

    return (
        <div className="flex flex-col h-[calc(100vh-64px)] overflow-hidden bg-gray-50 dark:bg-gray-900">
            <Helmet>
                <title>Historical Chain | Stockify</title>
            </Helmet>

            <ColumnConfigProvider>
                <TableSettingsProvider>
                    {/* 1. Compact Header */}
                    <div className="flex-none z-30 bg-white dark:bg-gray-800 border-b dark:border-gray-700 shadow-sm px-4 py-2 flex items-center justify-between gap-4">
                        <div className="flex items-center gap-2">
                            {/* Historical Badge */}
                            <div className="flex items-center gap-1 px-2 py-1 rounded bg-amber-500/10 border border-amber-500/30 text-amber-500 text-xs font-bold uppercase tracking-wider">
                                <ClockIcon className="w-3 h-3" />
                                <span>Historical</span>
                            </div>

                            {/* Symbol */}
                            <div className="z-50"> {/* Increased Z-Index wrapper for Symbol Selector */}
                                <SymbolSelector
                                    symbols={symbols}
                                    currentSymbol={{ symbol: selectedSymbol }}
                                    onSelect={handleSymbolChange}
                                    theme={theme}
                                />
                            </div>

                            {/* Expiry */}
                            <select
                                value={selectedExpiry}
                                onChange={(e) => setSelectedExpiry(e.target.value)}
                                disabled={!selectedSymbol}
                                className="bg-gray-100 dark:bg-gray-700 border-none rounded px-3 py-1 text-sm focus:ring-1 focus:ring-blue-500"
                            >
                                <option value="">Select Expiry</option>
                                {availableExpiries.map(e => <option key={e} value={e}>{e}</option>)}
                            </select>

                            {/* Date */}
                            <select
                                value={selectedDate}
                                onChange={(e) => setSelectedDate(e.target.value)}
                                disabled={!selectedExpiry}
                                className="bg-gray-100 dark:bg-gray-700 border-none rounded px-3 py-1 text-sm focus:ring-1 focus:ring-blue-500"
                            >
                                <option value="">Select Date</option>
                                {availableDates.map(d => <option key={d} value={d}>{d}</option>)}
                            </select>

                            {/* Clock Trigger */}
                            <button
                                onClick={() => isReady && setShowClock(true)}
                                disabled={!isReady}
                                className={`
                                flex items-center gap-2 px-3 py-1 rounded border transition-colors
                                ${isReady
                                        ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-800 text-blue-600 dark:text-blue-400 hover:bg-blue-100'
                                        : 'bg-gray-100 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-400 cursor-not-allowed'}
                            `}
                            >
                                <ClockIcon className="w-4 h-4" />
                                <span className="font-mono font-medium">{displayTime !== '--:--' ? displayTime : 'Select Time'}</span>
                            </button>
                        </div>

                        <div className="flex items-center gap-2">
                            <SettingsButton />
                        </div>
                    </div>

                    {/* 2. Main Content Area */}
                    <div className="flex-1 relative overflow-hidden">
                        {/* Error Overlay */}
                        {error && (
                            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-40 bg-red-500/90 text-white px-4 py-2 rounded-lg text-sm shadow-lg backdrop-blur">
                                {error}
                            </div>
                        )}

                        {/* Table Container */}
                        <div className="absolute inset-0 overflow-auto scrollbar-thin">
                            <div className="min-w-full inline-block align-middle">
                                <OptionChainTable
                                    showControls={false}
                                    externalData={snapshotData}
                                    isExternalLoading={loading}
                                    symbol={selectedSymbol}
                                    expiry={selectedExpiry}
                                    date={selectedDate}
                                />
                            </div>
                        </div>

                        {/* 3. Enhanced Sticky Bottom Playback Controls */}
                        {snapshotData && (
                            <div
                                ref={controlsRef}
                                className="absolute bottom-4 left-1/2 -translate-x-1/2 z-40 flex flex-col items-center gap-1 w-auto max-w-[95%] animate-in slide-in-from-bottom-5 fade-in duration-300"
                            >
                                {/* Settings Panel (Collapsible) */}
                                {showSettings && (
                                    <div className="w-full bg-white/95 dark:bg-gray-800/95 backdrop-blur-md rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-2 mb-1 animate-in slide-in-from-bottom-2 fade-in duration-200">
                                        <div className="flex items-center justify-between gap-4">
                                            {/* Step Interval */}
                                            <div className="flex items-center gap-2">
                                                <span className="text-[10px] text-gray-500 uppercase font-bold whitespace-nowrap">Step:</span>
                                                <div className="flex gap-1">
                                                    {INTERVAL_PRESETS.map(preset => (
                                                        <button
                                                            key={preset.value}
                                                            onClick={() => setStepInterval(preset.value)}
                                                            title={preset.description}
                                                            className={`px-2 py-1 text-xs rounded transition-all ${stepInterval === preset.value
                                                                ? 'bg-blue-500 text-white shadow-sm'
                                                                : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                                                                }`}
                                                        >
                                                            {preset.label}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>

                                            {/* Divider */}
                                            <div className="h-6 w-px bg-gray-200 dark:bg-gray-700" />

                                            {/* Playback Speed */}
                                            <div className="flex items-center gap-2">
                                                <span className="text-[10px] text-gray-500 uppercase font-bold whitespace-nowrap">Speed:</span>
                                                <div className="flex gap-1">
                                                    {SPEED_PRESETS.map(preset => (
                                                        <button
                                                            key={preset.value}
                                                            onClick={() => setPlaybackSpeed(preset.value)}
                                                            className={`px-2 py-1 text-xs rounded transition-all ${playbackSpeed === preset.value
                                                                ? 'bg-green-500 text-white shadow-sm'
                                                                : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                                                                }`}
                                                        >
                                                            {preset.label}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>

                                            {/* Keyboard Shortcuts Help */}
                                            <div className="relative group">
                                                <QuestionMarkCircleIcon className="w-4 h-4 text-gray-400 cursor-help" />
                                                <div className="absolute bottom-full right-0 mb-2 hidden group-hover:block w-56 bg-gray-900 text-white text-[10px] rounded-lg p-3 shadow-xl z-50">
                                                    <div className="font-bold mb-1 text-xs">Keyboard Shortcuts</div>
                                                    <div className="space-y-0.5">
                                                        <div><kbd className="px-1 bg-gray-700 rounded">Space</kbd> Play/Pause</div>
                                                        <div><kbd className="px-1 bg-gray-700 rounded">←</kbd> Step Back</div>
                                                        <div><kbd className="px-1 bg-gray-700 rounded">→</kbd> Step Forward</div>
                                                        <div><kbd className="px-1 bg-gray-700 rounded">Home</kbd> Jump to Start</div>
                                                        <div><kbd className="px-1 bg-gray-700 rounded">End</kbd> Jump to End</div>
                                                        <div><kbd className="px-1 bg-gray-700 rounded">[</kbd> <kbd className="px-1 bg-gray-700 rounded">]</kbd> Change Speed</div>
                                                        <div><kbd className="px-1 bg-gray-700 rounded">,</kbd> <kbd className="px-1 bg-gray-700 rounded">.</kbd> Change Step</div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Main Controller */}
                                <div className="bg-white/95 dark:bg-gray-900/95 backdrop-blur-md rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 p-2 flex items-center gap-3">

                                    {/* Time Info */}
                                    <div className="flex flex-col min-w-[70px] px-2">
                                        <span className="text-[9px] text-gray-500 uppercase tracking-widest font-bold">Time</span>
                                        <span className="text-lg font-mono font-bold text-gray-800 dark:text-white leading-none">
                                            {playbackTime}
                                        </span>
                                    </div>

                                    {/* Jump to Start */}
                                    <button
                                        onClick={jumpToStart}
                                        title="Jump to Start (Home)"
                                        className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                                    >
                                        <ChevronDoubleLeftIcon className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                                    </button>

                                    {/* Step Back */}
                                    <button
                                        onClick={stepBackward}
                                        title={`Step Back ${currentIntervalLabel} (←)`}
                                        className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                                    >
                                        <BackwardIcon className="w-4 h-4 text-gray-600 dark:text-gray-300" />
                                    </button>

                                    {/* Play/Pause */}
                                    <button
                                        onClick={togglePlay}
                                        title={isPlaying ? 'Pause (Space)' : 'Play (Space)'}
                                        className={`p-2.5 rounded-xl shadow-lg transition-all active:scale-95 ${isPlaying ? 'bg-amber-500 shadow-amber-500/30 text-white' : 'bg-blue-600 shadow-blue-500/30 text-white'}`}
                                    >
                                        {isPlaying ? <PauseIcon className="w-5 h-5" /> : <PlayIcon className="w-5 h-5" />}
                                    </button>

                                    {/* Step Forward */}
                                    <button
                                        onClick={stepForward}
                                        title={`Step Forward ${currentIntervalLabel} (→)`}
                                        className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                                    >
                                        <ForwardIcon className="w-4 h-4 text-gray-600 dark:text-gray-300" />
                                    </button>

                                    {/* Jump to End */}
                                    <button
                                        onClick={jumpToEnd}
                                        title="Jump to End (End)"
                                        className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                                    >
                                        <ChevronDoubleRightIcon className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                                    </button>

                                    {/* Seeker */}
                                    <div className="flex-1 flex flex-col gap-0.5 min-w-[120px] max-w-[200px]">
                                        <input
                                            type="range"
                                            min={MARKET_OPEN.hour * 3600 + MARKET_OPEN.minute * 60}
                                            max={MARKET_CLOSE.hour * 3600 + MARKET_CLOSE.minute * 60}
                                            value={parseTimeToSeconds(playbackTime) || MARKET_OPEN.hour * 3600 + MARKET_OPEN.minute * 60}
                                            onChange={(e) => {
                                                const newTime = formatSecondsToTime(Number(e.target.value));
                                                setPlaybackTime(newTime);
                                                if (selectedSymbol && selectedExpiry && selectedDate) {
                                                    fetchSnapshot(newTime);
                                                }
                                            }}
                                            className="w-full h-1.5 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                                        />
                                        <div className="flex justify-between text-[9px] text-gray-400">
                                            <span>09:15</span>
                                            <span className="font-medium text-gray-600 dark:text-gray-300">{Math.round(progress)}%</span>
                                            <span>15:30</span>
                                        </div>
                                    </div>

                                    {/* Quick Info Pills */}
                                    <div className="flex items-center gap-1 pl-2 border-l border-gray-200 dark:border-gray-700">
                                        <span className="px-1.5 py-0.5 text-[10px] font-bold bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 rounded">
                                            {currentIntervalLabel}
                                        </span>
                                        <span className="px-1.5 py-0.5 text-[10px] font-bold bg-green-100 dark:bg-green-900/50 text-green-600 dark:text-green-400 rounded">
                                            {currentSpeedLabel}
                                        </span>
                                    </div>

                                    {/* Settings Toggle */}
                                    <button
                                        onClick={() => setShowSettings(!showSettings)}
                                        title="Playback Settings"
                                        className={`p-1.5 rounded-lg transition-colors ${showSettings ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-600' : 'hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500'}`}
                                    >
                                        <Cog6ToothIcon className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </TableSettingsProvider>
            </ColumnConfigProvider>

            {/* Clock Modal */}
            {showClock && (
                <TimeClockSelector
                    value={playbackTime || '09:15'}
                    onChange={handleTimeSelect}
                    onClose={() => setShowClock(false)}
                    theme={theme}
                />
            )}
        </div>
    );
};

export default Historical;

