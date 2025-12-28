
import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { ChartBarIcon, ShieldCheckIcon, BoltIcon, UsersIcon } from '@heroicons/react/24/outline';
import { Button, Card } from '../components/common';

/**
 * Minimal About Page
 */
const About = () => {
  const theme = useSelector((state) => state.theme.theme);
  const navigate = useNavigate();

  const features = [
    { icon: ChartBarIcon, title: 'Real-Time Data', desc: 'Live NSE option chain with instant updates' },
    { icon: BoltIcon, title: 'Fast Analysis', desc: 'Greeks, IV, PCR calculated on-the-fly' },
    { icon: ShieldCheckIcon, title: 'Secure', desc: 'Enterprise-grade security for your data' },
    { icon: UsersIcon, title: 'For Traders', desc: 'Built by traders, for traders' },
  ];

  return (
    <>
      <Helmet>
        <title>About | Stockify</title>
      </Helmet>

      <div className="container mx-auto px-4 py-12 max-w-5xl">
        {/* Hero */}
        <div className="text-center mb-12">
          <h1 className={`text-4xl font-bold mb-4 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
            About Stockify
          </h1>
          <p className={`text-lg max-w-2xl mx-auto ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
            Professional-grade option chain analysis platform for Indian markets.
            Real-time data, advanced Greeks, and market insights in one place.
          </p>
        </div>

        {/* Features Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          {features.map((f, i) => (
            <Card key={i} className="text-center">
              <f.icon className="w-10 h-10 mx-auto text-blue-600 mb-4" />
              <h3 className="font-semibold dark:text-white mb-2">{f.title}</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">{f.desc}</p>
            </Card>
          ))}
        </div>

        {/* CTA */}
        <div className="text-center">
          <Card className="inline-block px-12 py-8">
            <h2 className={`text-2xl font-bold mb-4 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
              Ready to analyze?
            </h2>
            <Button onClick={() => navigate('/option-chain')}>
              View Option Chain
            </Button>
          </Card>
        </div>
      </div>
    </>
  );
};

export default About;
