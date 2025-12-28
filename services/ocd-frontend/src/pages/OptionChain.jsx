
import { useState } from 'react';
import { useSelector } from 'react-redux';
import { Helmet } from 'react-helmet-async';
import OptionChainTable from '../components/features/options/OptionChainTable';
import TradingChart from '../components/charts/TradingChart';
import OptionControls from '../components/features/options/OptionControls';
import SpotBar from '../components/features/options/SpotBar';
import { SettingsButton } from '../components/features/options/TableSettingsModal';
import { selectIsAuthenticated } from '../context/selectors';
import { ColumnConfigProvider } from '../context/ColumnConfigContext';
import { TableSettingsProvider } from '../context/TableSettingsContext';
import { Button, Card } from '../components/common';
import { useNavigate } from 'react-router-dom';
import useOptionsChain from '../hooks/useOptionsChain';

/**
 * Option Chain Page - Table view with integrated chart toggle
 */
const OptionChain = () => {
  const isAuthenticated = useSelector(selectIsAuthenticated);
  const navigate = useNavigate();
  const [showChart, setShowChart] = useState(false);
  const _theme = useSelector((state) => state.theme.theme);

  // Get spot/futures data for SpotBar when in chart mode
  const { spotData, futuresData, data: fullData } = useOptionsChain();
  const pcr = fullData?.pcr;
  const maxPain = fullData?.max_pain_strike;
  const atmiv = fullData?.atmiv;
  const atmivChange = fullData?.atmiv_change;

  if (!isAuthenticated) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <h2 className="text-2xl font-bold dark:text-white">Authentication Required</h2>
        <p className="text-gray-600 dark:text-gray-400">Please log in to view real-time option chain data.</p>
        <Button onClick={() => navigate('/login')}>Login Now</Button>
      </div>
    );
  }

  return (
    <>
      <Helmet>
        <title>{showChart ? 'Chart' : 'Option Chain'} | Stockify</title>
        <meta name="description" content="Real-time NSE Option Chain with advanced Greeks and analysis" />
      </Helmet>

      <ColumnConfigProvider>
        <TableSettingsProvider>
          <div className="w-full px-2 py-2 space-y-2">

            {/* Premium Control Bar */}
            <div className="flex flex-wrap items-center gap-2 p-2 glass rounded-xl">
              <OptionControls
                showChart={showChart}
                onToggleChart={() => setShowChart(!showChart)}
              />
              {/* SpotBar always visible for price context */}
              <SpotBar
                spotData={spotData}
                futuresData={futuresData}
                pcr={pcr}
                maxPain={maxPain}
                meta={fullData?.meta}
                atmiv={atmiv}
                atmivChange={atmivChange}
              />
              <div className="flex-1" />
              {!showChart && <SettingsButton />}
            </div>

            {/* Conditional view: Chart or Table */}
            {showChart ? (
              <Card variant="glass" className="overflow-hidden" padding="none">
                <TradingChart embedded={true} />
              </Card>
            ) : (
              <div className="glass-strong rounded-2xl overflow-hidden animate-fade-in">
                <OptionChainTable showControls={false} />
              </div>
            )}
          </div>
        </TableSettingsProvider>
      </ColumnConfigProvider>
    </>
  );
};

export default OptionChain;
