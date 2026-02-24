import { memo } from 'react';
import PropTypes from 'prop-types';

const LegCard = memo(({ leg, isCall }) => {
    const isBuy = leg.action === 'BUY';

    return (
        <div className={`p-4 rounded-xl border-l-4 ${isBuy ? 'border-l-green-500 bg-green-50 dark:bg-green-900/10' : 'border-l-red-500 bg-red-50 dark:bg-red-900/10'}`}>
            <div className="flex justify-between items-start mb-2">
                <div className="flex items-center gap-2">
                    <span className={`px-2 py-1 rounded text-xs font-bold ${isBuy ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        {leg.action}
                    </span>
                    <span className={`px-2 py-1 rounded text-xs font-bold ${leg.option_type === 'CE' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>
                        {leg.option_type}
                    </span>
                </div>
                <span className="text-lg font-bold text-gray-900 dark:text-white">
                    {leg.strike}
                </span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                    <span className="text-gray-500">LTP:</span>
                    <span className="font-medium text-gray-900 dark:text-white ml-1">₹{leg.ltp?.toFixed(2)}</span>
                </div>
                <div>
                    <span className="text-gray-500">IV:</span>
                    <span className="font-medium text-gray-900 dark:text-white ml-1">{leg.iv?.toFixed(1)}%</span>
                </div>
                <div>
                    <span className="text-gray-500">Qty:</span>
                    <span className="font-medium text-gray-900 dark:text-white ml-1">{leg.total_qty}</span>
                </div>
                <div>
                    <span className="text-gray-500">Δ:</span>
                    <span className="font-medium text-gray-900 dark:text-white ml-1">{leg.delta?.toFixed(3)}</span>
                </div>
            </div>
        </div>
    );
});

LegCard.displayName = 'LegCard';

LegCard.propTypes = {
    leg: PropTypes.shape({
        action: PropTypes.string.isRequired,
        option_type: PropTypes.string.isRequired,
        strike: PropTypes.number.isRequired,
        ltp: PropTypes.number,
        iv: PropTypes.number,
        total_qty: PropTypes.number,
        delta: PropTypes.number
    }).isRequired,
    isCall: PropTypes.bool
};

export default LegCard;
