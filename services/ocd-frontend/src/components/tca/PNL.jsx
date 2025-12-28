import { useMemo } from 'react';
import { FaChartLine } from 'react-icons/fa';
import { useSelector } from 'react-redux';

const PNL = ({ pnl }) => {
    const _theme = useSelector((state) => state.theme.theme);

    const iconSize = '1.5em';

    const content = useMemo(() => {
        if (!pnl) {
            return (
                <div className="flex justify-center items-center h-full text-xl text-gray-600">
                    Generate results to view profit/loss chart and trades
                </div>
            );
        }

        const {
            totalNetProfitLoss = 0,
        } = pnl;

        return (
            <div >
                <h3 className=" justify-end flex gap-2">
                    <FaChartLine className="text-blue-500" size={iconSize} />
                    Total P&L:
                    <span className={`${totalNetProfitLoss >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                        {totalNetProfitLoss.toFixed(2)}
                    </span>
                </h3>

                {/* <div className="text-lg space-y-2">
                    <p className="flex items-center gap-2">
                        <FaRegHandPointRight className="text-green-500" size={iconSize} />
                        <span className="font-semibold text-green-500">Days in Profit:</span>
                        <span>{daysInProfit}</span>
                    </p>
                    <p className="flex items-center gap-2">
                        <FaRegSadTear className="text-red-500" size={iconSize} />
                        <span className="font-semibold text-red-500">Days in Loss:</span>
                        <span>{daysInLoss}</span>
                    </p>
                    <p className="flex items-center gap-2">
                        <FaSmile className="text-gray-500" size={iconSize} />
                        <span className="font-semibold text-gray-500">Days in Break-Even:</span>
                        <span>{daysInBreakEven}</span>
                    </p>
                </div> */}
            </div>
        );
    }, [pnl]);

    return content;
};

export default PNL;
