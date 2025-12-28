import { memo, useState, useMemo } from 'react';
import { useSelector } from 'react-redux';
import { selectOptionsData, selectATMStrike } from '../../../context/selectors';
import { ChevronDownIcon, ChevronUpIcon, TableCellsIcon, GlobeAltIcon } from '@heroicons/react/24/outline';

/**
 * Format number with K/M/B suffix
 */
const formatNumber = (num) => {
  if (num === null || num === undefined) return '—';
  if (num === 0) return '0';
  
  const absNum = Math.abs(num);
  const sign = num < 0 ? '-' : '';
  
  if (absNum >= 1e12) return sign + (absNum / 1e12).toFixed(2) + 'T';
  if (absNum >= 1e9) return sign + (absNum / 1e9).toFixed(2) + 'B';
  if (absNum >= 1e6) return sign + (absNum / 1e6).toFixed(2) + 'M';
  if (absNum >= 1e3) return sign + (absNum / 1e3).toFixed(1) + 'K';
  return sign + absNum.toFixed(0);
};

/**
 * Format currency value
 */
const formatCurrency = (num) => {
  if (num === null || num === undefined) return '—';
  return '₹' + formatNumber(num);
};

/**
 * Calculate aggregate metrics for option chain data
 */
const calculateAggregates = (optionData, strikes) => {
  if (!optionData?.oc || !strikes || strikes.length === 0) {
    return null;
  }

  const agg = {
    ce: {
      oi: 0, oiChg: 0, volume: 0, ltpSum: 0, premiumSum: 0,
      delta: 0, gamma: 0, theta: 0, vega: 0, iv: 0, ivCount: 0,
    },
    pe: {
      oi: 0, oiChg: 0, volume: 0, ltpSum: 0, premiumSum: 0,
      delta: 0, gamma: 0, theta: 0, vega: 0, iv: 0, ivCount: 0,
    },
  };

  strikes.forEach(strike => {
    const strikeKey = strike.toString();
    const data = optionData.oc[strikeKey] || optionData.oc[`${strike}.000000`] || {};
    
    // CE aggregates
    if (data.ce) {
      const ce = data.ce;
      agg.ce.oi += ce.OI || ce.oi || 0;
      agg.ce.oiChg += ce.oichng || 0;
      agg.ce.volume += ce.volume || 0;
      agg.ce.ltpSum += ce.ltp || 0;
      agg.ce.premiumSum += (ce.ltp || 0) * (ce.OI || ce.oi || 0);
      
      if (ce.optgeeks) {
        agg.ce.delta += ce.optgeeks.delta || 0;
        agg.ce.gamma += ce.optgeeks.gamma || 0;
        agg.ce.theta += ce.optgeeks.theta || 0;
        agg.ce.vega += ce.optgeeks.vega || 0;
      }
      if (ce.iv > 0) {
        agg.ce.iv += ce.iv;
        agg.ce.ivCount++;
      }
    }
    
    // PE aggregates
    if (data.pe) {
      const pe = data.pe;
      agg.pe.oi += pe.OI || pe.oi || 0;
      agg.pe.oiChg += pe.oichng || 0;
      agg.pe.volume += pe.volume || 0;
      agg.pe.ltpSum += pe.ltp || 0;
      agg.pe.premiumSum += (pe.ltp || 0) * (pe.OI || pe.oi || 0);
      
      if (pe.optgeeks) {
        agg.pe.delta += pe.optgeeks.delta || 0;
        agg.pe.gamma += pe.optgeeks.gamma || 0;
        agg.pe.theta += pe.optgeeks.theta || 0;
        agg.pe.vega += pe.optgeeks.vega || 0;
      }
      if (pe.iv > 0) {
        agg.pe.iv += pe.iv;
        agg.pe.ivCount++;
      }
    }
  });

  // Calculate averages
  agg.ce.avgIv = agg.ce.ivCount > 0 ? agg.ce.iv / agg.ce.ivCount : 0;
  agg.pe.avgIv = agg.pe.ivCount > 0 ? agg.pe.iv / agg.pe.ivCount : 0;

  // PCR calculations
  agg.pcr = agg.ce.oi > 0 ? agg.pe.oi / agg.ce.oi : 0;
  agg.pcrChg = agg.ce.oiChg !== 0 ? agg.pe.oiChg / agg.ce.oiChg : 0;
  agg.volPcr = agg.ce.volume > 0 ? agg.pe.volume / agg.ce.volume : 0;

  // Net Greeks
  agg.netDelta = agg.ce.delta + agg.pe.delta;
  agg.netGamma = agg.ce.gamma + agg.pe.gamma;
  agg.netTheta = agg.ce.theta + agg.pe.theta;
  agg.netVega = agg.ce.vega + agg.pe.vega;

  return agg;
};

/**
 * Metric Card component
 */
const MetricCard = memo(({ label, ceValue, peValue, netValue, format = 'number', highlight = false }) => {
  const formatValue = (val) => {
    if (format === 'currency') return formatCurrency(val);
    if (format === 'decimal') return val?.toFixed(2) || '—';
    if (format === 'greek') return val?.toFixed(4) || '—';
    return formatNumber(val);
  };

  return (
    <div className={`p-2 rounded-lg ${highlight ? 'bg-blue-50 dark:bg-blue-900/20' : 'bg-gray-50 dark:bg-gray-800/50'}`}>
      <div className="text-[10px] text-gray-500 uppercase font-medium mb-1">{label}</div>
      <div className="flex items-center justify-between gap-2 text-sm">
        <span className="text-red-600 dark:text-red-400 font-medium" title="CALLS">
          {formatValue(ceValue)}
        </span>
        <span className="text-gray-400">|</span>
        <span className="text-green-600 dark:text-green-400 font-medium" title="PUTS">
          {formatValue(peValue)}
        </span>
      </div>
      {netValue !== undefined && (
        <div className="text-xs text-center text-gray-600 dark:text-gray-400 mt-0.5">
          Net: {formatValue(netValue)}
        </div>
      )}
    </div>
  );
});

MetricCard.displayName = 'MetricCard';

/**
 * PCR Badge component
 */
const PCRBadge = memo(({ value, label }) => {
  const getColor = (v) => {
    if (!v || v === 0) return 'bg-gray-200 text-gray-600';
    if (v > 1.2) return 'bg-green-200 text-green-800 dark:bg-green-900/50 dark:text-green-300';
    if (v > 0.8) return 'bg-yellow-200 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300';
    return 'bg-red-200 text-red-800 dark:bg-red-900/50 dark:text-red-300';
  };

  return (
    <div className="flex flex-col items-center p-2 rounded-lg bg-gray-50 dark:bg-gray-800/50">
      <div className="text-[10px] text-gray-500 uppercase font-medium">{label}</div>
      <div className={`mt-1 px-2 py-0.5 rounded font-bold text-sm ${getColor(value)}`}>
        {value > 0 ? value.toFixed(2) : '—'}
      </div>
    </div>
  );
});

PCRBadge.displayName = 'PCRBadge';

/**
 * Aggregate Panel Component
 * Shows totals for OI, Greeks, Volume, LTP for visible range and all data
 */
const AggregatePanel = memo(({ visibleStrikes }) => {
  const [isExpanded, setIsExpanded] = useState(false); // Collapsed by default for space
  const [viewMode, setViewMode] = useState('visible'); // 'visible' or 'all'
  
  const optionData = useSelector(selectOptionsData);
  const atmStrike = useSelector(selectATMStrike);

  // Get all strikes from data
  const allStrikes = useMemo(() => {
    if (!optionData?.oc) return [];
    return Object.keys(optionData.oc)
      .map(k => parseFloat(k))
      .filter(k => !isNaN(k))
      .sort((a, b) => a - b);
  }, [optionData]);

  // Calculate aggregates for visible range
  const visibleAgg = useMemo(() => 
    calculateAggregates(optionData, visibleStrikes),
    [optionData, visibleStrikes]
  );

  // Calculate aggregates for all data
  const allAgg = useMemo(() => 
    calculateAggregates(optionData, allStrikes),
    [optionData, allStrikes]
  );

  const agg = viewMode === 'visible' ? visibleAgg : allAgg;
  const strikeCount = viewMode === 'visible' ? visibleStrikes?.length || 0 : allStrikes.length;

  if (!agg) {
    return null;
  }

  return (
    <div className="mt-2 bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm">
      {/* Header */}
      <div 
        className="flex items-center justify-between px-4 py-2 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
            📊 Aggregate Summary
          </span>
          <span className="text-xs text-gray-500">
            ({strikeCount} strikes)
          </span>
        </div>
        
        <div className="flex items-center gap-2">
          {/* View Toggle */}
          <div className="flex items-center bg-gray-100 dark:bg-gray-800 rounded-lg p-0.5">
            <button
              onClick={(e) => { e.stopPropagation(); setViewMode('visible'); }}
              className={`px-2 py-1 text-xs rounded-md flex items-center gap-1 transition-colors ${
                viewMode === 'visible' 
                  ? 'bg-white dark:bg-gray-700 text-blue-600 shadow-sm' 
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <TableCellsIcon className="w-3 h-3" />
              Visible
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); setViewMode('all'); }}
              className={`px-2 py-1 text-xs rounded-md flex items-center gap-1 transition-colors ${
                viewMode === 'all' 
                  ? 'bg-white dark:bg-gray-700 text-blue-600 shadow-sm' 
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <GlobeAltIcon className="w-3 h-3" />
              All
            </button>
          </div>
          
          {isExpanded ? (
            <ChevronUpIcon className="w-4 h-4 text-gray-400" />
          ) : (
            <ChevronDownIcon className="w-4 h-4 text-gray-400" />
          )}
        </div>
      </div>

      {/* Content */}
      {isExpanded && (
        <div className="px-4 pb-3 border-t border-gray-100 dark:border-gray-800">
          {/* PCR Row */}
          <div className="grid grid-cols-3 gap-2 py-2">
            <PCRBadge value={agg.pcr} label="OI PCR" />
            <PCRBadge value={agg.pcrChg} label="OI Chg PCR" />
            <PCRBadge value={agg.volPcr} label="Vol PCR" />
          </div>
          
          {/* Main Metrics Grid */}
          <div className="grid grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2 mt-2">
            <MetricCard label="Total OI" ceValue={agg.ce.oi} peValue={agg.pe.oi} highlight />
            <MetricCard label="OI Change" ceValue={agg.ce.oiChg} peValue={agg.pe.oiChg} />
            <MetricCard label="Volume" ceValue={agg.ce.volume} peValue={agg.pe.volume} />
            <MetricCard label="LTP Sum" ceValue={agg.ce.ltpSum} peValue={agg.pe.ltpSum} format="currency" />
            <MetricCard label="Avg IV" ceValue={agg.ce.avgIv} peValue={agg.pe.avgIv} format="decimal" />
            <MetricCard label="Net Delta" ceValue={agg.ce.delta} peValue={agg.pe.delta} netValue={agg.netDelta} format="greek" />
            <MetricCard label="Net Theta" ceValue={agg.ce.theta} peValue={agg.pe.theta} netValue={agg.netTheta} format="greek" />
            <MetricCard label="Net Gamma" ceValue={agg.ce.gamma} peValue={agg.pe.gamma} netValue={agg.netGamma} format="greek" />
          </div>
          
          {/* Extended Row */}
          <div className="grid grid-cols-4 gap-2 mt-2">
            <MetricCard label="Premium (CE)" ceValue={agg.ce.premiumSum} peValue={null} format="currency" />
            <MetricCard label="Premium (PE)" ceValue={null} peValue={agg.pe.premiumSum} format="currency" />
            <MetricCard label="Net Vega" ceValue={agg.ce.vega} peValue={agg.pe.vega} netValue={agg.netVega} format="greek" />
            <div className="p-2 rounded-lg bg-gray-50 dark:bg-gray-800/50">
              <div className="text-[10px] text-gray-500 uppercase font-medium">ATM Strike</div>
              <div className="text-sm font-bold text-blue-600 dark:text-blue-400">{atmStrike || '—'}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

AggregatePanel.displayName = 'AggregatePanel';

export default AggregatePanel;
