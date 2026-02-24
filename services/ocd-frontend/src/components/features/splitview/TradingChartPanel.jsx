import { memo } from 'react';
import TradingChart from '../../charts/TradingChart';
import { ChartBarIcon, XMarkIcon } from '@heroicons/react/24/outline';
import Card from '../../common/Card';

const TradingChartPanel = memo(({ id, onRemove, onChangeType }) => {
    return (
        <Card variant="glass" className="flex flex-col h-full overflow-hidden" padding="none">
            {/* Minimal Header for controls */}
            <div className="card-header-drag flex items-center justify-between px-3 py-1 border-b border-gray-700 bg-gray-800/50 cursor-move">
                <div className="flex items-center gap-2">
                    <ChartBarIcon className="w-4 h-4 text-orange-400" />
                    <select
                        value="trading_chart"
                        onChange={(e) => onChangeType(id, e.target.value)}
                        className="bg-transparent text-xs font-medium text-gray-300 border-0 focus:ring-0 cursor-pointer"
                    >
                        <option value="trading_chart">Trading Chart</option>
                        <option value="coi">Change in OI</option>
                        <option value="oi">Open Interest</option>
                        <option value="pcr">PCR</option>
                        <option value="distribution">OI Distribution</option>
                    </select>
                </div>
                <button
                    onClick={() => onRemove(id)}
                    className="p-1 rounded hover:bg-gray-700 transition-colors"
                >
                    <XMarkIcon className="w-3.5 h-3.5 text-gray-400" />
                </button>
            </div>

            <div className="flex-1 min-h-0 relative">
                <TradingChart embedded={true} />
            </div>
        </Card>
    );
});

TradingChartPanel.displayName = 'TradingChartPanel';

export default TradingChartPanel;
