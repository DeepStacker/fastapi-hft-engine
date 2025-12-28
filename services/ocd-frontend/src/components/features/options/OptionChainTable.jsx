import { useState, useMemo, useCallback } from 'react';
import { useSelector } from 'react-redux';
import {
    selectStrikesAroundATM,
    selectATMStrike,
    selectOptionsData
} from '../../../context/selectors';
import { useTableSettings } from '../../../context/TableSettingsContext';
import useOptionsChain from '../../../hooks/useOptionsChain';
import { usePercentageHighlights } from '../../../hooks/usePercentageHighlights';

import TableHeader from './TableHeader';
import StrikeRow from './StrikeRow';
import SpotBar from './SpotBar';
import SpotIndicatorRow from './SpotIndicatorRow';
import OptionControls from './OptionControls';
import { SettingsButton } from './TableSettingsModal';
import StrikeDetailPanel from './StrikeDetailPanel';
import StrikeAnalysisModal from './StrikeAnalysisModal';
import CellDetailModal from './CellDetailModal';
import AggregateChartModal from './AggregateChartModal';
import AggregatePanel from './AggregatePanel';
import { Spinner, Button, Card } from '../../common';
import { selectSelectedSymbol } from '../../../context/selectors';

/**
 * Main Option Chain Table Component
 */
const OptionChainTable = ({ showControls = true }) => {
    const {
        spotData,
        futuresData,
        data: fullData,
        isLoading,
        isInitialLoad,
        hasData,
    } = useOptionsChain();

    const { settings, selectStrike } = useTableSettings();

    const [strikeCount, setStrikeCount] = useState(settings.strikesPerPage || 21); // 10 OTM each side + ATM
    const [selectedCell, setSelectedCell] = useState(null);
    const [selectedStrikeData, setSelectedStrikeData] = useState(null);
    const [strikeModalData, setStrikeModalData] = useState(null); // For Strike Analysis Modal
    const [aggregateColumn, setAggregateColumn] = useState(null); // For Aggregate Chart Modal

    // Get symbol for Strike Analysis Modal
    const symbol = useSelector(selectSelectedSymbol);

    // Select filtered strikes from Redux using memoized selector factory
    const strikesSelector = useMemo(() => selectStrikesAroundATM(strikeCount), [strikeCount]);
    const strikes = useSelector(strikesSelector);
    const atmStrike = useSelector(selectATMStrike);
    const rawData = useSelector(selectOptionsData);

    // Sort strikes based on settings
    const sortedStrikes = useMemo(() => {
        if (!strikes || strikes.length === 0) return [];
        const sorted = [...strikes];
        if (settings.sortOrder === 'asc') {
            return sorted.sort((a, b) => a - b);
        }
        return sorted.sort((a, b) => b - a);
    }, [strikes, settings.sortOrder]);

    // Calculate percentage highlights for VOL, OI, OI CHG columns
    const highlightData = usePercentageHighlights(sortedStrikes, rawData, atmStrike);

    const handleShowMore = () => {
        setStrikeCount(prev => prev + 20);
    };

    const handleCellClick = useCallback((cellData) => {
        setSelectedCell(cellData);
    }, []);

    const handleCloseModal = useCallback(() => {
        setSelectedCell(null);
    }, []);

    const handleStrikeSelect = useCallback((strikeData) => {
        setSelectedStrikeData(strikeData);
        selectStrike(strikeData?.strike);
    }, [selectStrike]);

    const handleClosePanel = useCallback(() => {
        setSelectedStrikeData(null);
        selectStrike(null);
    }, [selectStrike]);

    // Strike Analysis Modal handlers
    const handleStrikeClick = useCallback((strikeData) => {
        setStrikeModalData(strikeData);
    }, []);

    const handleCloseStrikeModal = useCallback(() => {
        setStrikeModalData(null);
    }, []);

    // Aggregate Chart Modal handlers
    const handleColumnClick = useCallback((columnType) => {
        setAggregateColumn(columnType);
    }, []);

    const handleCloseAggregateModal = useCallback(() => {
        setAggregateColumn(null);
    }, []);

    // Derived values from fullData - computed before any early returns
    const pcr = fullData?.pcr;
    const maxPain = fullData?.max_pain_strike;
    const spotPrice = spotData?.ltp;

    // Only show spinner on INITIAL load, not refreshes
    if (isInitialLoad && !hasData) {
        return (
            <div className="flex h-96 items-center justify-center">
                <Spinner size="xl" showLabel label="Loading Option Chain..." />
            </div>
        );
    }

    return (
        <div className="w-full space-y-1">
            {/* Controls row - only show if showControls is true */}
            {showControls && (
                <div className="flex flex-wrap items-center gap-2">
                    <OptionControls />
                    <SpotBar
                        spotData={spotData}
                        futuresData={futuresData}
                        pcr={pcr}
                        maxPain={maxPain}
                    />
                    <div className="flex-1" />
                    <SettingsButton />
                </div>
            )}

            {/* Table Container - Maximum Height */}
            <Card className="overflow-hidden" padding="none">
                <div className="relative overflow-auto scrollbar-hide" style={{ maxHeight: 'calc(100vh - 100px)' }}>
                    {/* Floating Spot Indicator - rowHeight: 51px compact / 80px normal (measured from actual StrikeRow rendering) */}
                    <SpotIndicatorRow
                        spotData={spotData}
                        futuresData={futuresData}
                        strikes={sortedStrikes}
                        rowHeight={settings.compactMode ? 51 : 80}
                        headerHeight={28}
                    />

                    <table className="w-full text-sm text-left border-collapse min-w-max">
                        <TableHeader onColumnClick={handleColumnClick} />

                        <tbody className="divide-y divide-gray-100 dark:divide-gray-800 bg-white dark:bg-gray-900">
                            {sortedStrikes.map((strike) => {
                                const strikeKey = strike.toString();
                                const strikeData = rawData?.oc?.[strikeKey] || rawData?.oc?.[`${strike}.000000`] || {};

                                return (
                                    <StrikeRow
                                        key={strike}
                                        strike={strike}
                                        data={strikeData}
                                        atmStrike={atmStrike}
                                        spotPrice={spotPrice}
                                        onCellClick={handleCellClick}
                                        onStrikeSelect={handleStrikeSelect}
                                        onStrikeClick={handleStrikeClick}
                                        highlightData={highlightData[strike]}
                                    />
                                );
                            })}

                            {sortedStrikes.length === 0 && !isLoading && (
                                <tr>
                                    <td colSpan="20" className="p-8 text-center text-gray-500">
                                        No data available for selected expiration
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Compact Footer */}
                <div className="p-2 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between bg-gray-50 dark:bg-gray-800/50">
                    <span className="text-xs text-gray-400">
                        {isLoading && <span className="animate-pulse text-blue-500">● Live</span>}
                    </span>
                    <Button variant="ghost" onClick={handleShowMore} size="sm">
                        + More Strikes
                    </Button>
                </div>
            </Card>

            {/* Aggregate Summary Panel */}
            <AggregatePanel visibleStrikes={sortedStrikes} />

            {/* Strike Detail Panel */}
            {selectedStrikeData && (
                <StrikeDetailPanel
                    strikeData={selectedStrikeData}
                    onClose={handleClosePanel}
                />
            )}

            {/* Cell Detail Modal */}
            <CellDetailModal
                isOpen={!!selectedCell}
                onClose={handleCloseModal}
                cellData={selectedCell}
            />

            {/* Strike Analysis Modal */}
            <StrikeAnalysisModal
                isOpen={!!strikeModalData}
                onClose={handleCloseStrikeModal}
                strikeData={strikeModalData}
                symbol={symbol}
            />

            {/* Aggregate Chart Modal */}
            <AggregateChartModal
                isOpen={!!aggregateColumn}
                onClose={handleCloseAggregateModal}
                columnType={aggregateColumn}
            />
        </div>
    );
};

export default OptionChainTable;
