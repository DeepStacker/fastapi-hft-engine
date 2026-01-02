import { useState, useEffect, useCallback, useRef } from 'react';
import {
    PlayIcon,
    PauseIcon,
    BackwardIcon,
    ForwardIcon,
    ChevronDoubleLeftIcon,
    ChevronDoubleRightIcon
} from '@heroicons/react/24/solid';

/**
 * PlaybackControls - Historical data navigation with play/pause/step
 * 
 * @param {Object} props
 * @param {Array} props.availableTimes - List of available time strings (HH:MM)
 * @param {number} props.currentIndex - Current position in availableTimes
 * @param {function} props.onIndexChange - Callback when index changes
 * @param {boolean} props.isLoading - Whether data is currently loading
 */
const PlaybackControls = ({
    availableTimes = [],
    currentIndex = 0,
    onIndexChange,
    isLoading = false
}) => {
    const [isPlaying, setIsPlaying] = useState(false);
    const [playbackSpeed, setPlaybackSpeed] = useState(1000); // ms between steps
    const intervalRef = useRef(null);

    // Auto-play effect
    useEffect(() => {
        if (isPlaying && !isLoading && availableTimes.length > 0) {
            intervalRef.current = setInterval(() => {
                onIndexChange(prev => {
                    if (prev >= availableTimes.length - 1) {
                        setIsPlaying(false);
                        return prev;
                    }
                    return prev + 1;
                });
            }, playbackSpeed);
        }

        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
            }
        };
    }, [isPlaying, isLoading, playbackSpeed, availableTimes.length, onIndexChange]);

    // Stop when loading
    useEffect(() => {
        if (isLoading) {
            setIsPlaying(false);
        }
    }, [isLoading]);

    const handleStepBack = useCallback(() => {
        if (currentIndex > 0) {
            onIndexChange(currentIndex - 1);
        }
    }, [currentIndex, onIndexChange]);

    const handleStepForward = useCallback(() => {
        if (currentIndex < availableTimes.length - 1) {
            onIndexChange(currentIndex + 1);
        }
    }, [currentIndex, availableTimes.length, onIndexChange]);

    const handleJumpStart = useCallback(() => {
        onIndexChange(0);
    }, [onIndexChange]);

    const handleJumpEnd = useCallback(() => {
        onIndexChange(availableTimes.length - 1);
    }, [availableTimes.length, onIndexChange]);

    const togglePlay = useCallback(() => {
        setIsPlaying(prev => !prev);
    }, []);

    const speedOptions = [
        { label: '0.5x', value: 2000 },
        { label: '1x', value: 1000 },
        { label: '2x', value: 500 },
        { label: '5x', value: 200 },
    ];

    const currentTime = availableTimes[currentIndex] || '--:--';
    const progress = availableTimes.length > 1
        ? (currentIndex / (availableTimes.length - 1)) * 100
        : 0;

    return (
        <div className="flex items-center gap-2 px-3 py-2 glass rounded-lg">
            {/* Time display */}
            <div className="flex items-center gap-1 min-w-[80px]">
                <span className="text-xs text-gray-400">Time:</span>
                <span className="text-sm font-mono font-semibold text-white">
                    {currentTime}
                </span>
            </div>

            {/* Progress indicator */}
            <div className="flex-1 mx-2 relative">
                <div className="h-1 bg-white/10 rounded-full overflow-hidden">
                    <div
                        className="h-full bg-gradient-to-r from-cyan-400 to-blue-500 transition-all duration-200"
                        style={{ width: `${progress}%` }}
                    />
                </div>
                <span className="absolute -top-4 left-1/2 -translate-x-1/2 text-[10px] text-gray-500">
                    {currentIndex + 1} / {availableTimes.length || 1}
                </span>
            </div>

            {/* Controls */}
            <div className="flex items-center gap-1">
                {/* Jump to start */}
                <button
                    onClick={handleJumpStart}
                    disabled={currentIndex === 0 || isLoading}
                    className="p-1.5 rounded-md hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    title="Jump to start"
                >
                    <ChevronDoubleLeftIcon className="w-4 h-4 text-gray-300" />
                </button>

                {/* Step back */}
                <button
                    onClick={handleStepBack}
                    disabled={currentIndex === 0 || isLoading}
                    className="p-1.5 rounded-md hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    title="Previous snapshot"
                >
                    <BackwardIcon className="w-4 h-4 text-gray-300" />
                </button>

                {/* Play/Pause */}
                <button
                    onClick={togglePlay}
                    disabled={availableTimes.length === 0 || isLoading}
                    className={`p-2 rounded-lg transition-all ${isPlaying
                            ? 'bg-gradient-to-r from-orange-500 to-red-500 shadow-lg shadow-orange-500/30'
                            : 'bg-gradient-to-r from-cyan-500 to-blue-500 shadow-lg shadow-cyan-500/30'
                        } disabled:opacity-30 disabled:cursor-not-allowed`}
                    title={isPlaying ? 'Pause' : 'Play'}
                >
                    {isPlaying ? (
                        <PauseIcon className="w-4 h-4 text-white" />
                    ) : (
                        <PlayIcon className="w-4 h-4 text-white" />
                    )}
                </button>

                {/* Step forward */}
                <button
                    onClick={handleStepForward}
                    disabled={currentIndex >= availableTimes.length - 1 || isLoading}
                    className="p-1.5 rounded-md hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    title="Next snapshot"
                >
                    <ForwardIcon className="w-4 h-4 text-gray-300" />
                </button>

                {/* Jump to end */}
                <button
                    onClick={handleJumpEnd}
                    disabled={currentIndex >= availableTimes.length - 1 || isLoading}
                    className="p-1.5 rounded-md hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    title="Jump to end"
                >
                    <ChevronDoubleRightIcon className="w-4 h-4 text-gray-300" />
                </button>
            </div>

            {/* Speed selector */}
            <div className="flex items-center gap-1 ml-2">
                <span className="text-xs text-gray-400">Speed:</span>
                <select
                    value={playbackSpeed}
                    onChange={(e) => setPlaybackSpeed(Number(e.target.value))}
                    className="bg-white/5 border border-white/10 rounded px-1 py-0.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-cyan-500"
                >
                    {speedOptions.map(opt => (
                        <option key={opt.value} value={opt.value} className="bg-gray-800">
                            {opt.label}
                        </option>
                    ))}
                </select>
            </div>
        </div>
    );
};

export default PlaybackControls;
