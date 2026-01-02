import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

/**
 * Analog Clock Time Selector
 * Allows user to select time by "rotating hand" on a clock face.
 */
const TimeClockSelector = ({ value, onChange, onClose, theme }) => {
    // Value format: "HH:MM" (24h)
    // Internal state: hour (1-12), minute (0-59), period (AM/PM)
    const [mode, setMode] = useState('HOURS'); // 'HOURS' | 'MINUTES'
    const [hour, setHour] = useState(12);
    const [minute, setMinute] = useState(0);
    const [period, setPeriod] = useState('AM');

    // Parse initial value
    useEffect(() => {
        if (value) {
            const [h, m] = value.split(':').map(Number);
            const isPM = h >= 12;
            const h12 = h % 12 || 12;
            setHour(h12);
            setMinute(m);
            setPeriod(isPM ? 'PM' : 'AM');
        } else {
            // Default to 9:15 AM
            setHour(9);
            setMinute(15);
            setPeriod('AM');
        }
    }, [value]);

    const handleConfirm = () => {
        let h24 = hour;
        if (period === 'PM' && hour !== 12) h24 += 12;
        if (period === 'AM' && hour === 12) h24 = 0;

        const timeStr = `${h24.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
        onChange(timeStr);
        onClose();
    };

    const isDark = theme === 'dark';

    // Clock geometry
    const RADIUS = 96; // 192px / 2
    const CENTER = 120; // Padding

    const getPosition = (index, total, radius) => {
        const angle = (index * (360 / total) - 90) * (Math.PI / 180);
        return {
            x: CENTER + radius * Math.cos(angle),
            y: CENTER + radius * Math.sin(angle)
        };
    };

    const ClockFace = ({ type, selected }) => {
        const items = type === 'HOURS'
            ? Array.from({ length: 12 }, (_, i) => i + 1)
            : Array.from({ length: 12 }, (_, i) => i * 5); // 0, 5, 10...

        // 12 is at index 0 geometrically for 12 items? No.
        // 12 is at -90deg. Index 0 is 3 o'clock usually.
        // Let's map numbers to circle positions accurately.
        // 12 -> -90deg, 3 -> 0deg, 6 -> 90deg, 9 -> 180deg

        // Items order: 12, 1, 2, ... 11? 
        // Standard geometric: 1 is at -60deg (30deg each step).

        return (
            <div className="relative w-60 h-60 mx-auto rounded-full bg-gray-100 dark:bg-gray-800 border dark:border-gray-700 shadow-inner">
                {/* Center dot */}
                <div className="absolute top-1/2 left-1/2 w-2 h-2 -ml-1 -mt-1 rounded-full bg-blue-500 z-10" />

                {/* Hand */}
                <div
                    className="absolute top-1/2 left-1/2 h-0.5 bg-blue-500 origin-left z-0 transition-transform duration-300"
                    style={{
                        width: `${RADIUS}px`,
                        transform: `rotate(${((type === 'HOURS' ? selected : selected / 5) * 30 - 90)}deg)`
                    }}
                >
                    <div className="absolute right-0 top-1/2 -mt-3 -mr-3 w-6 h-6 rounded-full bg-blue-500 border-2 border-white dark:border-gray-900" />
                </div>

                {items.map((num, i) => {
                    // Logic to position numbers correctly
                    // 12 is at top. 
                    // i=0 is 12?
                    // Let's use specific mapping
                    const val = type === 'HOURS' ? (i === 0 ? 12 : i) : (i * 5);
                    // For hours: 12, 1, 2, 3... 
                    // 1 is 30deg from top (-60deg from right).

                    // Simple angle calculation:
                    // Each number is 30deg apart.
                    // 12 is -90deg (or 270).
                    // 1 is -60.
                    // 2 is -30.
                    // 3 is 0.

                    // Let's normalize `val` to clock position (1-12)
                    const clockPos = type === 'HOURS' ? val : (val === 0 ? 60 : val) / 5; // 0 min is at 12 pos (60)
                    const angle = (clockPos * 30 - 90) * (Math.PI / 180);

                    const x = CENTER + RADIUS * Math.cos(angle);
                    const y = CENTER + RADIUS * Math.sin(angle);

                    const isSelected = selected === val;

                    return (
                        <button
                            key={val}
                            onClick={() => type === 'HOURS' ? setHour(val) : setMinute(val)}
                            className={`
                                absolute w-8 h-8 -ml-4 -mt-4 rounded-full flex items-center justify-center text-sm font-semibold transition-colors
                                ${isSelected
                                    ? 'bg-blue-500 text-white'
                                    : 'text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-700'}
                            `}
                            style={{ left: x, top: y }}
                        >
                            {val}
                        </button>
                    );
                })}
            </div>
        );
    };

    return createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className={`w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden ${isDark ? 'bg-gray-900 text-white border border-gray-700' : 'bg-white text-gray-900'}`}>
                {/* Header */}
                <div className={`p-6 ${isDark ? 'bg-gray-800' : 'bg-blue-600'} text-white flex flex-col items-center justify-center gap-2`}>
                    <div className="text-sm opacity-70">SELECT TIME</div>
                    <div className="flex items-end gap-2">
                        <button
                            onClick={() => setMode('HOURS')}
                            className={`text-5xl font-bold transition-opacity ${mode === 'HOURS' ? 'opacity-100' : 'opacity-60'}`}
                        >
                            {hour}
                        </button>
                        <span className="text-5xl font-bold opacity-60">:</span>
                        <button
                            onClick={() => setMode('MINUTES')}
                            className={`text-5xl font-bold transition-opacity ${mode === 'MINUTES' ? 'opacity-100' : 'opacity-60'}`}
                        >
                            {minute.toString().padStart(2, '0')}
                        </button>
                        <div className="flex flex-col ml-3 text-sm font-bold gap-1 mb-1">
                            <button
                                onClick={() => setPeriod('AM')}
                                className={`px-2 py-0.5 rounded ${period === 'AM' ? 'bg-white text-blue-600' : 'border border-white/30 text-white'}`}
                            >
                                AM
                            </button>
                            <button
                                onClick={() => setPeriod('PM')}
                                className={`px-2 py-0.5 rounded ${period === 'PM' ? 'bg-white text-blue-600' : 'border border-white/30 text-white'}`}
                            >
                                PM
                            </button>
                        </div>
                    </div>
                </div>

                {/* Clock Face */}
                <div className="p-6">
                    <ClockFace type={mode} selected={mode === 'HOURS' ? hour : minute} />
                </div>

                {/* Footer */}
                <div className="flex justify-between items-center p-4 border-t dark:border-gray-800">
                    <div className="text-xs text-gray-500">
                        {mode === 'HOURS' ? 'Select Hour' : 'Select Minute'}
                    </div>
                    <div className="flex gap-4 font-semibold text-sm">
                        <button onClick={onClose} className="text-red-500 hover:text-red-600">CANCEL</button>
                        <button onClick={handleConfirm} className="text-blue-500 hover:text-blue-600">OK</button>
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
};

export default TimeClockSelector;
