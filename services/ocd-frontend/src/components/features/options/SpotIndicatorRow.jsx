import { memo, useMemo } from 'react';
import { ArrowTrendingUpIcon, ArrowTrendingDownIcon } from '@heroicons/react/24/solid';

/**
 * Format number with proper display
 */
const formatPrice = (num) => {
  if (num === null || num === undefined) return '—';
  return num.toLocaleString('en-IN', { maximumFractionDigits: 2 });
};

/**
 * Floating Spot/Futures Indicator
 * Overlays on the table at the position between strikes where spot price falls
 * rowHeight should match actual StrikeRow height (cells have multi-line content)
 */
const SpotIndicatorRow = memo(({ spotData, futuresData, strikes, rowHeight = 44, headerHeight = 32 }) => {
  const spot = spotData?.ltp;
  const spotChange = spotData?.change;
  const spotChangePct = spotData?.change_percent;
  const fut = futuresData?.ltp;
  const futChange = futuresData?.change;
  
  // Calculate spot-futures difference (premium/discount)
  const spotFutDiff = fut && spot ? fut - spot : null;
  const isPremium = spotFutDiff > 0;

  // Calculate row index - find gap between which two consecutive strikes the spot falls
  const rowIndex = useMemo(() => {
    if (!spot || !strikes || strikes.length < 2) return null;
    
    // Iterate through strikes as they appear in display order
    for (let i = 0; i < strikes.length - 1; i++) {
      const currentStrike = strikes[i];
      const nextStrike = strikes[i + 1];
      
      // Get the lower and higher strike
      const lowerStrike = Math.min(currentStrike, nextStrike);
      const higherStrike = Math.max(currentStrike, nextStrike);
      
      // Check if spot price is between these two strikes
      if (spot > lowerStrike && spot < higherStrike) {
        return i;
      }
    }
    
    return null;
  }, [spot, strikes]);

  if (!spot || rowIndex === null) return null;

  // Calculate top position: header + (rowIndex + 1) rows, centered on the border
  const topPosition = headerHeight + (rowIndex + 1) * rowHeight;

  return (
    <div 
      className="absolute left-0 right-0 z-20 pointer-events-none"
      style={{ 
        top: `${topPosition}px`,
        transform: 'translateY(-50%)'
      }}
    >
      <div className="flex items-center justify-center">
        <div className="flex items-center gap-2 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 px-3 py-0.5 rounded-full shadow-lg border border-white/30 pointer-events-auto">
          {/* Spot Price */}
          <div className="flex items-center gap-1">
            <span className="text-[9px] font-medium text-white/70">SPOT</span>
            <span className="text-xs font-bold text-white">
              {formatPrice(spot)}
            </span>
            {spotChange !== undefined && (
              <span className={`flex items-center text-[10px] font-semibold ${spotChange >= 0 ? 'text-green-300' : 'text-red-300'}`}>
                {spotChange >= 0 ? <ArrowTrendingUpIcon className="w-2.5 h-2.5" /> : <ArrowTrendingDownIcon className="w-2.5 h-2.5" />}
                {spotChange >= 0 ? '+' : ''}{spotChange?.toFixed(1)}
                ({spotChangePct?.toFixed(1)}%)
              </span>
            )}
          </div>

          {/* Divider */}
          <div className="w-px h-3 bg-white/40" />

          {/* Futures Price */}
          {fut && (
            <div className="flex items-center gap-1">
              <span className="text-[9px] font-medium text-white/70">FUT</span>
              <span className="text-xs font-bold text-white">
                {formatPrice(fut)}
              </span>
              {futChange !== undefined && (
                <span className={`flex items-center text-[10px] font-semibold ${futChange >= 0 ? 'text-green-300' : 'text-red-300'}`}>
                  {futChange >= 0 ? <ArrowTrendingUpIcon className="w-2.5 h-2.5" /> : <ArrowTrendingDownIcon className="w-2.5 h-2.5" />}
                  {futChange >= 0 ? '+' : ''}{futChange?.toFixed(1)}
                </span>
              )}
            </div>
          )}

          {/* Premium/Discount Badge */}
          {spotFutDiff !== null && (
            <>
              <div className="w-px h-3 bg-white/40" />
              <span className={`text-[9px] font-bold ${
                isPremium ? 'text-amber-300' : 'text-cyan-300'
              }`}>
                {isPremium ? '+' : ''}{spotFutDiff.toFixed(0)}
              </span>
            </>
          )}
        </div>
      </div>
    </div>
  );
});

SpotIndicatorRow.displayName = 'SpotIndicatorRow';

export default SpotIndicatorRow;


