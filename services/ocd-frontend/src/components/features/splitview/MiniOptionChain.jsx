import { memo } from 'react';
import PropTypes from 'prop-types';

/**
 * Mini Option Chain Table Component
 */
const MiniOptionChain = memo(({ data }) => {
    if (!data || Object.keys(data).length === 0) {
        return (
            <div className="flex items-center justify-center h-full text-gray-400">
                Loading option chain...
            </div>
        );
    }

    const strikes = Object.entries(data)
        .sort((a, b) => parseFloat(a[0]) - parseFloat(b[0]))
        .slice(0, 20);

    return (
        <div className="overflow-auto h-full">
            <table className="w-full text-[10px]">
                <thead className="bg-gray-800 sticky top-0">
                    <tr>
                        <th className="py-1 px-1 text-green-500">OI</th>
                        <th className="py-1 px-1 text-green-500">LTP</th>
                        <th className="py-1 px-1 text-yellow-500">Strike</th>
                        <th className="py-1 px-1 text-red-500">LTP</th>
                        <th className="py-1 px-1 text-red-500">OI</th>
                    </tr>
                </thead>
                <tbody>
                    {strikes.map(([strike, data]) => (
                        <tr key={strike} className="border-b border-gray-800 hover:bg-gray-800/50">
                            <td className="py-0.5 px-1 text-center text-green-400">
                                {((data.ce?.OI || data.ce?.oi || 0) / 1000).toFixed(0)}K
                            </td>
                            <td className="py-0.5 px-1 text-center">
                                {data.ce?.ltp?.toFixed(1) || '-'}
                            </td>
                            <td className="py-0.5 px-1 text-center font-medium text-gray-300">
                                {parseFloat(strike).toFixed(0)}
                            </td>
                            <td className="py-0.5 px-1 text-center">
                                {data.pe?.ltp?.toFixed(1) || '-'}
                            </td>
                            <td className="py-0.5 px-1 text-center text-red-400">
                                {((data.pe?.OI || data.pe?.oi || 0) / 1000).toFixed(0)}K
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
});

MiniOptionChain.displayName = 'MiniOptionChain';

MiniOptionChain.propTypes = {
    data: PropTypes.object
};

export default MiniOptionChain;
