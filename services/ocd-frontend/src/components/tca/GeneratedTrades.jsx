import { useState } from 'react';
import { useSelector } from 'react-redux';
import { FaArrowUp, FaArrowDown, FaMinus, FaChevronDown, FaChevronUp } from 'react-icons/fa';

function GeneratedTrades({ results }) {
    const theme = useSelector((state) => state.theme.theme); // Access theme from Redux
    const [expandedDays, setExpandedDays] = useState({});
    const [currentPage, setCurrentPage] = useState(1);
    const daysPerPage = 5;

    if (!results || !results.generatedTrades) {
        return (
            <div className={`text-center text-gray-500 ${theme === 'dark' ? 'dark:text-gray-400' : ''} mt-8`}>
                No trades generated. Please run the calculation.
            </div>
        );
    }

    const toggleDay = (day) => {
        setExpandedDays((prev) => ({ ...prev, [day]: !prev[day] }));
    };

    const totalDays = results.generatedTrades.length;
    const totalPages = Math.ceil(totalDays / daysPerPage);

    // Calculate trades to show based on the current page
    const indexOfLastDay = currentPage * daysPerPage;
    const indexOfFirstDay = indexOfLastDay - daysPerPage;
    const currentDays = results.generatedTrades.slice(indexOfFirstDay, indexOfLastDay);

    const nextPage = () => setCurrentPage((prev) => Math.min(prev + 1, totalPages));
    const prevPage = () => setCurrentPage((prev) => Math.max(prev - 1, 1));

    return (
        <div className={`mt-8  ${theme === 'dark' ? 'bg-gray-950 text-white' : 'bg-gray-100 text-black'} p-5 rounded-3xl mb-10 `}>
            <h3 className={`text-2xl font-semibold mb-4 ${theme === 'dark' ? 'text-white' : 'text-black'}`}>Generated Trades</h3>
            {currentDays.map((trades, dayIndex) => {
                const globalDayIndex = indexOfFirstDay + dayIndex;

                return (
                    <div key={globalDayIndex} className={`mb-4 border rounded-lg ${theme === 'dark' ? 'border-gray-950' : 'border-gray-300'}`}>
                        <button
                            onClick={() => toggleDay(globalDayIndex)}
                            className={`flex justify-between w-full px-4 py-2 ${theme === 'dark' ? 'bg-gray-800 text-white' : 'bg-gray-200 text-black'} text-left font-semibold text-lg rounded-t-lg`}
                        >
                            <span>Day {globalDayIndex + 1}</span>
                            {expandedDays[globalDayIndex] ? (
                                <FaChevronUp className={`${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`} />
                            ) : (
                                <FaChevronDown className={`${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`} />
                            )}
                        </button>
                        {expandedDays[globalDayIndex] && (
                            <ul className={`pl-5 pr-4 py-3 space-y-2 ${theme === 'dark' ? 'bg-gray-900 text-gray-300' : 'bg-gray-50 text-gray-700'}`}>
                                {trades.map((trade, index) => {
                                    // Set trade color and icon based on type
                                    let tradeColor = 'text-gray-500';
                                    let icon = <FaMinus className="inline mr-2" />;
                                    let tradeText = trade;

                                    if (trade === 'profit') {
                                        tradeColor = theme === 'dark' ? 'text-green-400' : 'text-green-600';
                                        icon = <FaArrowUp className="inline mr-2" />;
                                        tradeText = 'Profit';
                                    } else if (trade === 'loss') {
                                        tradeColor = theme === 'dark' ? 'text-red-400' : 'text-red-600';
                                        icon = <FaArrowDown className="inline mr-2" />;
                                        tradeText = 'Loss';
                                    } else if (trade === 'break-even') {
                                        tradeColor = theme === 'dark' ? 'text-yellow-400' : 'text-yellow-600';
                                        icon = <FaMinus className="inline mr-2" />;
                                        tradeText = 'Break-Even';
                                    }

                                    return (
                                        <li key={index} className={`${tradeColor} flex items-center space-x-2`}>
                                            {icon}
                                            <span>{`Trade ${index + 1}: `}</span>
                                            <span className="font-semibold">{tradeText}</span>
                                        </li>
                                    );
                                })}
                            </ul>
                        )}
                    </div>
                );
            })}

            {/* Pagination Controls */}
            <div className="flex justify-center space-x-4 mt-6">
                <button
                    onClick={prevPage}
                    disabled={currentPage === 1}
                    className={`px-4 py-2 rounded-lg ${theme === 'dark' ? 'bg-gray-700 text-white' : 'bg-gray-300 text-black'} disabled:opacity-50`}
                >
                    Previous
                </button>
                <span className={`font-semibold text-lg ${theme === 'dark' ? 'text-white' : 'text-black'}`}>
                    Page {currentPage} of {totalPages}
                </span>
                <button
                    onClick={nextPage}
                    disabled={currentPage === totalPages}
                    className={`px-4 py-2 rounded-lg ${theme === 'dark' ? 'bg-gray-700 text-white' : 'bg-gray-300 text-black'} disabled:opacity-50`}
                >
                    Next
                </button>
            </div>
        </div>
    );
}

export default GeneratedTrades;
