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
import { selectSelectedSymbol, selectSelectedExpiry } from '../../../context/selectors';
import { normalizeBackendData } from '../../../context/dataSlice';

/**
 * Main Option Chain Table Component
 * 
 * @param {boolean} showControls - Show/hide controls (default: true)
 * @param {Object} externalData - External data override (for historical mode)
 * @param {boolean} isExternalLoading - Loading state for external data
 */
const OptionChainTable = ({
    showControls = true,
    externalData = null,
    isExternalLoading = false,
    isLiveMode = undefined,
    symbol: propSymbol = null,
    expiry: propExpiry = null,
    date: propDate = null
}) => {
    // Live data from hook
    const liveHookData = useOptionsChain();

    // Use external data if provided, otherwise use live hook data
    const {
        spotData,
        futuresData,
        data: fullData,
        isLoading: hookIsLoading,
        isInitialLoad,
        hasData,
    } = externalData ? {
        spotData: externalData.spot || null,
        futuresData: externalData.futures || null,
        data: externalData,
        isLoading: isExternalLoading,
        isInitialLoad: isExternalLoading && !externalData,
        hasData: !!externalData?.oc,
    } : liveHookData;

    // Normalize external data if it's processed here directly
    const processedData = useMemo(() => {
        if (externalData && externalData.oc) {
            const normalized = normalizeBackendData(externalData);
            return normalized.options.data;
        }
        return fullData;
    }, [externalData, fullData]);

    const reduxSymbol = useSelector(selectSelectedSymbol);
    const reduxExpiry = useSelector(selectSelectedExpiry);
    const symbol = propSymbol || reduxSymbol;
    const expiry = propExpiry || reduxExpiry;
    const date = propDate; // Date is usually only for historical mode

    const isLoading = externalData ? isExternalLoading : hookIsLoading;

    const { settings, selectStrike } = useTableSettings();

    const [strikeCount, setStrikeCount] = useState(settings.strikesPerPage || 21); // 10 OTM each side + ATM
    const [selectedCell, setSelectedCell] = useState(null);
    const [selectedStrikeData, setSelectedStrikeData] = useState(null);
    const [strikeModalData, setStrikeModalData] = useState(null); // For Strike Analysis Modal
    const [aggregateColumn, setAggregateColumn] = useState(null); // For Aggregate Chart Modal



    // Select filtered strikes from Redux using memoized selector factory
    // Select filtered strikes from Redux using memoized selector factory
    const strikesSelector = useMemo(() => selectStrikesAroundATM(strikeCount), [strikeCount]);
    const reduxStrikes = useSelector(strikesSelector);
    const reduxAtmStrike = useSelector(selectATMStrike);
    const reduxRawData = useSelector(selectOptionsData);

    // Determine Source of Data
    // If showControls is false (Historical), we strictly use externalData (which might be null)
    // If showControls is true (Live), we use Redux data

    // IMPORTANT: In Historical mode (`!showControls`), if externalData is null, we show NOTHING.
    // We do NOT fall back to Redux data.

    let rawData = null;
    let atmStrike = 0;
    let strikes = [];

    const shouldUseRedux = isLiveMode !== undefined ? isLiveMode : showControls;

    if (shouldUseRedux) {
        // LIVE MODE
        rawData = reduxRawData;
        atmStrike = reduxAtmStrike;
        strikes = reduxStrikes;
    } else if (externalData) {
        // HISTORICAL MODE (Data loaded)
        rawData = processedData;
        atmStrike = processedData.atm_strike;

        // Calculate strikes dynamically from external data
        // Calculate strikes dynamically from external data
        const ocSource = externalData.option_chain || externalData.oc;
        if (ocSource) {
            const allStrikes = Object.keys(ocSource).map(Number).filter(n => !isNaN(n)).sort((a, b) => a - b);
            // Find ATM index
            if (atmStrike && allStrikes.length > 0) {
                // Simple logic: find closest
                const closest = allStrikes.reduce((prev, curr) =>
                    Math.abs(curr - atmStrike) < Math.abs(prev - atmStrike) ? curr : prev
                );
                const atmIndex = allStrikes.indexOf(closest);
                const half = Math.floor(strikeCount / 2);
                const start = Math.max(0, atmIndex - half);
                const end = Math.min(allStrikes.length, start + strikeCount);
                strikes = allStrikes.slice(start, end);
            } else {
                strikes = allStrikes.slice(0, strikeCount);
            }
        }
    } else {
        // HISTORICAL MODE (No data yet)
        rawData = null;
        atmStrike = 0;
        strikes = [];
    }

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
    const pcr = processedData?.pcr;
    const maxPain = processedData?.max_pain_strike;
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
                                        <div className="flex flex-col items-center justify-center space-y-2">
                                            <span>No data available for selected expiration</span>
                                            <span className="text-xs text-gray-400 font-mono">
                                                (Strikes: {strikes.length}, Keys: {rawData?.oc ? Object.keys(rawData.oc).length : 0})
                                            </span>
                                            {rawData?.oc && Object.keys(rawData.oc).length > 0 && strikes.length === 0 && (
                                                <span className="text-xs text-red-400">
                                                    Possible Redux Selector Issue or Expiry Mismatch.
                                                </span>
                                            )}
                                        </div>
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
            <AggregatePanel
                visibleStrikes={strikes}
                data={rawData}
                atmStrike={atmStrike}
            />  {/* Strike Detail Panel */}
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
                symbol={symbol}
                expiry={expiry}
                date={date}
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
                strikes={strikes}
                data={rawData}
                atmStrike={atmStrike}
                symbol={symbol}
                expiry={expiry}
            />
        </div>
    );
};

export default OptionChainTable;
