import { useState, useEffect, useCallback } from 'react';
import { Helmet } from 'react-helmet-async';
import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import {
    CalendarDaysIcon,
    ClockIcon,
    PlayIcon,
    PauseIcon,
    ForwardIcon,
    BackwardIcon,
    ArrowPathIcon,
    ChartBarIcon
} from '@heroicons/react/24/outline';
import { historicalService } from '../services/historicalService';
import { selectIsAuthenticated, selectSelectedSymbol, selectSelectedExpiry } from '../context/selectors';
import Card from '../components/common/Card';
import Button from '../components/common/Button';

/**
 * Historical Option Chain Page
 * Query and replay historical option chain data
 */
const Historical = () => {
    const isAuthenticated = useSelector(selectIsAuthenticated);
    const navigate = useNavigate();
    const selectedSymbol = useSelector(selectSelectedSymbol);
    const selectedExpiry = useSelector(selectSelectedExpiry);

    // State
    const [availableDates, setAvailableDates] = useState([]);
    const [availableTimes, setAvailableTimes] = useState([]);
    const [selectedDate, setSelectedDate] = useState('');
    const [selectedTime, setSelectedTime] = useState('');
    const [snapshotData, setSnapshotData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    // Playback state
    const [isPlaying, setIsPlaying] = useState(false);
    const [playbackSpeed, setPlaybackSpeed] = useState(1);
    const [currentTimeIndex, setCurrentTimeIndex] = useState(0);

    // Fetch available dates on mount
    useEffect(() => {
        const fetchDates = async () => {
            try {
                const response = await historicalService.getAvailableDates(selectedSymbol);
                setAvailableDates(response.dates || []);
                if (response.dates?.length > 0) {
                    setSelectedDate(response.dates[0]);
                }
            } catch (err) {
                console.error('Failed to fetch dates:', err);
                setError('Failed to load available dates');
            }
        };
        fetchDates();
    }, [selectedSymbol]);

    // Fetch available times when date changes
    useEffect(() => {
        if (!selectedDate) return;

        const fetchTimes = async () => {
            try {
                const response = await historicalService.getAvailableTimes({ symbol: selectedSymbol, date: selectedDate });
                setAvailableTimes(response.times || []);
                if (response.times?.length > 0) {
                    setSelectedTime(response.times[0]);
                    setCurrentTimeIndex(0);
                }
            } catch (err) {
                console.error('Failed to fetch times:', err);
            }
        };
        fetchTimes();
    }, [selectedSymbol, selectedDate]);

    // Fetch snapshot data
    const fetchSnapshot = useCallback(async () => {
        if (!selectedDate || !selectedTime || !selectedExpiry) return;

        setLoading(true);
        setError(null);

        try {
            const response = await historicalService.getHistoricalSnapshot({
                symbol: selectedSymbol,
                expiry: selectedExpiry,
                date: selectedDate,
                time: selectedTime,
            });
            setSnapshotData(response);
        } catch (err) {
            console.error('Failed to fetch snapshot:', err);
            setError(err.message || 'Failed to load historical data');
        } finally {
            setLoading(false);
        }
    }, [selectedSymbol, selectedExpiry, selectedDate, selectedTime]);

    // Auto-fetch on selection change
    useEffect(() => {
        if (selectedDate && selectedTime && selectedExpiry) {
            fetchSnapshot();
        }
    }, [selectedDate, selectedTime, selectedExpiry, fetchSnapshot]);

    // Playback controls
    useEffect(() => {
        if (!isPlaying || availableTimes.length === 0) return;

        const interval = setInterval(() => {
            setCurrentTimeIndex((prev) => {
                const next = prev + 1;
                if (next >= availableTimes.length) {
                    setIsPlaying(false);
                    return prev;
                }
                setSelectedTime(availableTimes[next]);
                return next;
            });
        }, 1000 / playbackSpeed);

        return () => clearInterval(interval);
    }, [isPlaying, playbackSpeed, availableTimes]);

    const handlePrevTime = () => {
        if (currentTimeIndex > 0) {
            const newIndex = currentTimeIndex - 1;
            setCurrentTimeIndex(newIndex);
            setSelectedTime(availableTimes[newIndex]);
        }
    };

    const handleNextTime = () => {
        if (currentTimeIndex < availableTimes.length - 1) {
            const newIndex = currentTimeIndex + 1;
            setCurrentTimeIndex(newIndex);
            setSelectedTime(availableTimes[newIndex]);
        }
    };

    if (!isAuthenticated) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
                <h2 className="text-2xl font-bold dark:text-white">Authentication Required</h2>
                <p className="text-gray-600 dark:text-gray-400">Please log in to view historical data.</p>
                <Button onClick={() => navigate('/login')}>Login Now</Button>
            </div>
        );
    }

    // Calculate summary stats from snapshot
    const callOITotal = Object.values(snapshotData?.option_chain || {}).reduce((sum, s) => {
        return sum + (s.ce?.OI || s.ce?.oi || 0);
    }, 0);

    const putOITotal = Object.values(snapshotData?.option_chain || {}).reduce((sum, s) => {
        return sum + (s.pe?.OI || s.pe?.oi || 0);
    }, 0);

    return (
        <>
            <Helmet>
                <title>Historical Data | Stockify</title>
                <meta name="description" content="View and replay historical option chain data" />
            </Helmet>

            <div className="w-full px-4 py-4 space-y-4">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                            Historical Option Chain
                        </h1>
                        <p className="text-sm text-gray-500 mt-1">
                            Replay historical option chain data for any date
                        </p>
                    </div>
                    <button
                        onClick={fetchSnapshot}
                        disabled={loading}
                        className="p-2 rounded-lg bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                    >
                        <ArrowPathIcon className={`w-5 h-5 text-gray-600 dark:text-gray-400 ${loading ? 'animate-spin' : ''}`} />
                    </button>
                </div>

                {/* Controls Card */}
                <Card variant="glass" className="p-4">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        {/* Symbol Display */}
                        <div>
                            <label className="block text-xs font-medium text-gray-500 mb-2">Symbol</label>
                            <div className="bg-gray-100 dark:bg-gray-800 rounded-lg px-4 py-2.5 text-gray-900 dark:text-white font-medium">
                                {selectedSymbol}
                            </div>
                        </div>

                        {/* Date Selector */}
                        <div>
                            <label className="block text-xs font-medium text-gray-500 mb-2">
                                <CalendarDaysIcon className="w-4 h-4 inline mr-1" />
                                Date
                            </label>
                            <select
                                value={selectedDate}
                                onChange={(e) => setSelectedDate(e.target.value)}
                                className="w-full bg-gray-100 dark:bg-gray-800 border-0 rounded-lg px-4 py-2.5 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                            >
                                {availableDates.map((date) => (
                                    <option key={date} value={date}>{date}</option>
                                ))}
                            </select>
                        </div>

                        {/* Time Selector */}
                        <div>
                            <label className="block text-xs font-medium text-gray-500 mb-2">
                                <ClockIcon className="w-4 h-4 inline mr-1" />
                                Time
                            </label>
                            <select
                                value={selectedTime}
                                onChange={(e) => {
                                    setSelectedTime(e.target.value);
                                    setCurrentTimeIndex(availableTimes.indexOf(e.target.value));
                                }}
                                className="w-full bg-gray-100 dark:bg-gray-800 border-0 rounded-lg px-4 py-2.5 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                            >
                                {availableTimes.map((time) => (
                                    <option key={time} value={time}>{time}</option>
                                ))}
                            </select>
                        </div>

                        {/* Playback Speed */}
                        <div>
                            <label className="block text-xs font-medium text-gray-500 mb-2">Speed</label>
                            <select
                                value={playbackSpeed}
                                onChange={(e) => setPlaybackSpeed(Number(e.target.value))}
                                className="w-full bg-gray-100 dark:bg-gray-800 border-0 rounded-lg px-4 py-2.5 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                            >
                                <option value={0.5}>0.5x</option>
                                <option value={1}>1x</option>
                                <option value={2}>2x</option>
                                <option value={5}>5x</option>
                                <option value={10}>10x</option>
                            </select>
                        </div>
                    </div>

                    {/* Playback Controls */}
                    <div className="flex items-center justify-center gap-2 mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                        <button
                            onClick={handlePrevTime}
                            disabled={currentTimeIndex === 0}
                            className="p-2 rounded-lg bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-50 transition-colors"
                        >
                            <BackwardIcon className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                        </button>

                        <button
                            onClick={() => setIsPlaying(!isPlaying)}
                            className={`p-3 rounded-xl transition-all ${isPlaying
                                ? 'bg-red-100 dark:bg-red-900/30 text-red-600'
                                : 'bg-blue-100 dark:bg-blue-900/30 text-blue-600'
                                }`}
                        >
                            {isPlaying ? (
                                <PauseIcon className="w-6 h-6" />
                            ) : (
                                <PlayIcon className="w-6 h-6" />
                            )}
                        </button>

                        <button
                            onClick={handleNextTime}
                            disabled={currentTimeIndex >= availableTimes.length - 1}
                            className="p-2 rounded-lg bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-50 transition-colors"
                        >
                            <ForwardIcon className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                        </button>

                        <div className="ml-4 text-sm text-gray-500">
                            {currentTimeIndex + 1} / {availableTimes.length} snapshots
                        </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="mt-4">
                        <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-blue-500 transition-all duration-300"
                                style={{
                                    width: `${availableTimes.length > 0 ? ((currentTimeIndex + 1) / availableTimes.length) * 100 : 0}%`
                                }}
                            />
                        </div>
                        <div className="flex justify-between text-xs text-gray-400 mt-1">
                            <span>{availableTimes[0] || '09:15'}</span>
                            <span>{availableTimes[availableTimes.length - 1] || '15:30'}</span>
                        </div>
                    </div>
                </Card>

                {/* Error Display */}
                {error && (
                    <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 text-red-700 dark:text-red-400">
                        {error}
                    </div>
                )}

                {/* Loading State */}
                {loading && (
                    <div className="flex items-center justify-center py-12">
                        <ArrowPathIcon className="w-8 h-8 animate-spin text-blue-500" />
                        <span className="ml-2 text-gray-500">Loading historical data...</span>
                    </div>
                )}

                {/* Snapshot Data Display */}
                {snapshotData && !loading && (
                    <div className="space-y-4">
                        {/* Summary Stats */}
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                            <Card variant="glass" className="p-4 text-center">
                                <div className="text-xs text-gray-500 uppercase mb-1">Spot Price</div>
                                <div className="text-xl font-bold text-gray-900 dark:text-white">
                                    {snapshotData.spot?.toLocaleString()}
                                </div>
                            </Card>
                            <Card variant="glass" className="p-4 text-center">
                                <div className="text-xs text-gray-500 uppercase mb-1">ATM Strike</div>
                                <div className="text-xl font-bold text-yellow-600">
                                    {snapshotData.atm_strike?.toLocaleString()}
                                </div>
                            </Card>
                            <Card variant="glass" className="p-4 text-center">
                                <div className="text-xs text-gray-500 uppercase mb-1">PCR</div>
                                <div className={`text-xl font-bold ${snapshotData.pcr > 1 ? 'text-green-600' : 'text-red-600'}`}>
                                    {snapshotData.pcr?.toFixed(3)}
                                </div>
                            </Card>
                            <Card variant="glass" className="p-4 text-center">
                                <div className="text-xs text-gray-500 uppercase mb-1">Max Pain</div>
                                <div className="text-xl font-bold text-purple-600">
                                    {snapshotData.max_pain?.toLocaleString()}
                                </div>
                            </Card>
                            <Card variant="glass" className="p-4 text-center">
                                <div className="text-xs text-gray-500 uppercase mb-1">Total OI</div>
                                <div className="text-sm font-bold text-gray-900 dark:text-white">
                                    <span className="text-green-600">{(callOITotal / 100000).toFixed(1)}L CE</span>
                                    {' / '}
                                    <span className="text-red-600">{(putOITotal / 100000).toFixed(1)}L PE</span>
                                </div>
                            </Card>
                        </div>

                        {/* Option Chain Table */}
                        <Card variant="glass" className="overflow-hidden">
                            <div className="overflow-x-auto max-h-[500px]">
                                <table className="w-full text-sm">
                                    <thead className="bg-gray-100 dark:bg-gray-800 sticky top-0">
                                        <tr>
                                            <th colSpan="4" className="py-2 px-4 text-green-600 font-semibold border-r border-gray-200 dark:border-gray-700">
                                                CALLS
                                            </th>
                                            <th className="py-2 px-4 text-yellow-600 font-semibold border-r border-gray-200 dark:border-gray-700">
                                                STRIKE
                                            </th>
                                            <th colSpan="4" className="py-2 px-4 text-red-600 font-semibold">
                                                PUTS
                                            </th>
                                        </tr>
                                        <tr className="text-xs text-gray-500">
                                            <th className="py-2 px-2">OI</th>
                                            <th className="py-2 px-2">Volume</th>
                                            <th className="py-2 px-2">IV</th>
                                            <th className="py-2 px-2 border-r border-gray-200 dark:border-gray-700">LTP</th>
                                            <th className="py-2 px-2 border-r border-gray-200 dark:border-gray-700"></th>
                                            <th className="py-2 px-2">LTP</th>
                                            <th className="py-2 px-2">IV</th>
                                            <th className="py-2 px-2">Volume</th>
                                            <th className="py-2 px-2">OI</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {Object.entries(snapshotData.option_chain || {})
                                            .sort((a, b) => parseFloat(a[0]) - parseFloat(b[0]))
                                            .slice(0, 30)
                                            .map(([strike, data]) => {
                                                const isATM = parseFloat(strike) === snapshotData.atm_strike;
                                                return (
                                                    <tr
                                                        key={strike}
                                                        className={`border-b border-gray-100 dark:border-gray-800 ${isATM ? 'bg-yellow-50 dark:bg-yellow-900/20' : ''
                                                            }`}
                                                    >
                                                        {/* Call side */}
                                                        <td className="py-2 px-2 text-center text-green-600">
                                                            {((data.ce?.OI || data.ce?.oi || 0) / 1000).toFixed(0)}K
                                                        </td>
                                                        <td className="py-2 px-2 text-center text-gray-600 dark:text-gray-400">
                                                            {((data.ce?.volume || data.ce?.vol || 0) / 1000).toFixed(0)}K
                                                        </td>
                                                        <td className="py-2 px-2 text-center text-blue-600">
                                                            {data.ce?.iv?.toFixed(1) || '-'}
                                                        </td>
                                                        <td className="py-2 px-2 text-center font-medium border-r border-gray-200 dark:border-gray-700">
                                                            {data.ce?.ltp?.toFixed(2) || '-'}
                                                        </td>

                                                        {/* Strike */}
                                                        <td className={`py-2 px-4 text-center font-bold border-r border-gray-200 dark:border-gray-700 ${isATM ? 'text-yellow-600' : 'text-gray-900 dark:text-white'
                                                            }`}>
                                                            {parseFloat(strike).toFixed(0)}
                                                        </td>

                                                        {/* Put side */}
                                                        <td className="py-2 px-2 text-center font-medium">
                                                            {data.pe?.ltp?.toFixed(2) || '-'}
                                                        </td>
                                                        <td className="py-2 px-2 text-center text-blue-600">
                                                            {data.pe?.iv?.toFixed(1) || '-'}
                                                        </td>
                                                        <td className="py-2 px-2 text-center text-gray-600 dark:text-gray-400">
                                                            {((data.pe?.volume || data.pe?.vol || 0) / 1000).toFixed(0)}K
                                                        </td>
                                                        <td className="py-2 px-2 text-center text-red-600">
                                                            {((data.pe?.OI || data.pe?.oi || 0) / 1000).toFixed(0)}K
                                                        </td>
                                                    </tr>
                                                );
                                            })
                                        }
                                    </tbody>
                                </table>
                            </div>
                        </Card>
                    </div>
                )}

                {/* Empty State */}
                {!snapshotData && !loading && !error && (
                    <Card variant="glass" className="p-12 text-center">
                        <ChartBarIcon className="w-16 h-16 mx-auto text-gray-300 dark:text-gray-600 mb-4" />
                        <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-2">
                            No Historical Data
                        </h3>
                        <p className="text-gray-500">
                            Select a date and time to view historical option chain data
                        </p>
                    </Card>
                )}
            </div>
        </>
    );
};

export default Historical;
