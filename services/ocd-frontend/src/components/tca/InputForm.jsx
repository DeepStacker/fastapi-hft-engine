
import { useSelector, useDispatch } from "react-redux";
import {
    setTradePerDay,
    setNdtpc,
    setTradeAmount,
    setRiskReward,
    setChancePercent,
    setChargesPerTrade,
} from '../../context/tcaSlice';

const InputForm = ({ handleGenerateClick }) => {
    const dispatch = useDispatch();

    const theme = useSelector((state) => state.theme.theme);

    const {
        tradePerDay,
        ndtpc,
        tradeAmount,
        riskReward,
        chancePercent,
        chargesPerTrade,
    } = useSelector((state) => state.tca);

    return (
        <div className={`rounded-3xl ${theme === 'dark' ? 'bg-black text-white' : 'bg-gray-100 text-black'} p-5  pb-10`} >
            <div>
                <label className="block text-sm font-medium">Trades per Day</label>
                <input
                    type="number"
                    value={tradePerDay}
                    onChange={(e) => dispatch(setTradePerDay(parseInt(e.target.value)))}
                    className={`${theme === 'dark' ? 'bg-gray-800 text-white' : 'bg-gray-100 text-black'} w-full p-3 mt-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500`}
                />
            </div>

            <div>
                <label className="block text-sm font-medium">Days to Simulate</label>
                <input
                    type="number"
                    value={ndtpc}
                    onChange={(e) => dispatch(setNdtpc(parseInt(e.target.value)))}
                    className={`${theme === 'dark' ? 'bg-gray-800 text-white' : 'bg-gray-100 text-black'} w-full p-3 mt-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500`}
                />
            </div>

            <div>
                <label className="block text-sm font-medium">Trade Amount</label>
                <input
                    type="number"
                    value={tradeAmount}
                    onChange={(e) => dispatch(setTradeAmount(parseFloat(e.target.value)))}
                    className={`${theme === 'dark' ? 'bg-gray-800 text-white' : 'bg-gray-100 text-black'}  w-full p-3 mt-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500`}
                />
            </div>

            <div>
                <label className="block text-sm font-medium">Risk-Reward Ratio</label>
                <input
                    type="number"
                    value={riskReward}
                    onChange={(e) => dispatch(setRiskReward(parseFloat(e.target.value)))}
                    className={`${theme === 'dark' ? 'bg-gray-800 text-white' : 'bg-gray-100 text-black'}  w-full p-3 mt-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500`}
                />
            </div>

            <div>
                <label className="block text-sm font-medium">Chance Percent</label>
                <input
                    type="number"
                    value={chancePercent}
                    onChange={(e) => dispatch(setChancePercent(parseFloat(e.target.value)))}
                    className={`${theme === 'dark' ? 'bg-gray-800 text-white' : 'bg-gray-100 text-black'}  w-full p-3 mt-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500`}
                />
            </div>

            <div>
                <label className="block text-sm font-medium">Charges per Trade</label>
                <input
                    type="number"
                    value={chargesPerTrade}
                    onChange={(e) => dispatch(setChargesPerTrade(parseFloat(e.target.value)))}
                    className={`${theme === 'dark' ? 'bg-gray-800 text-white' : 'bg-gray-100 text-black'}  w-full p-3 mt-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500`}
                />
            </div>

            <div className="text-center">
                <button
                    onClick={handleGenerateClick}
                    className="px-2 mt-2 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                    Generate Profit/Loss
                </button>
            </div>
        </div>
    );
};

export default InputForm;
