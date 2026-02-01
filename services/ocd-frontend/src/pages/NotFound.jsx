
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { motion } from 'framer-motion';
import { Helmet } from 'react-helmet-async';
import {
  HomeIcon,
  ArrowLeftIcon,
  ExclamationTriangleIcon,
  MagnifyingGlassIcon,
} from '@heroicons/react/24/outline';
import { Button } from '../components/common';

/**
 * Premium 404 Not Found Page
 * Features: Animations, visual effects, helpful navigation
 */
const NotFound = () => {
  const navigate = useNavigate();
  const theme = useSelector((state) => state.theme.theme);
  const isDark = theme === 'dark';

  // Quick links for users
  const quickLinks = [
    { label: 'Dashboard', path: '/dashboard' },
    { label: 'Option Chain', path: '/option-chain' },
    { label: 'Analytics', path: '/analytics' },
    { label: 'Screeners', path: '/screeners' },
  ];

  return (
    <>
      <Helmet>
        <title>404 - Page Not Found | DeepStrike</title>
      </Helmet>

      <div className={`min-h-[80vh] flex items-center justify-center px-4 relative overflow-hidden ${isDark ? 'bg-gray-900' : 'bg-gray-50'}`}>
        {/* Background Effects */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className={`absolute -top-40 -right-40 w-80 h-80 rounded-full blur-3xl ${isDark ? 'bg-blue-500/10' : 'bg-blue-500/20'}`} />
          <div className={`absolute -bottom-40 -left-40 w-80 h-80 rounded-full blur-3xl ${isDark ? 'bg-purple-500/10' : 'bg-purple-500/20'}`} />
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center max-w-lg relative z-10"
        >
          {/* 404 Display with Animation */}
          <motion.div
            initial={{ scale: 0.8 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 200 }}
            className="relative inline-block mb-6"
          >
            <span className="text-[120px] md:text-[150px] font-black bg-gradient-to-r from-blue-600 via-purple-600 to-blue-600 bg-clip-text text-transparent leading-none">
              404
            </span>
            <motion.div
              animate={{ rotate: [0, 10, -10, 0] }}
              transition={{ repeat: Infinity, duration: 2, ease: 'easeInOut' }}
              className="absolute -top-2 -right-2"
            >
              <ExclamationTriangleIcon className="w-8 h-8 text-amber-500" />
            </motion.div>
          </motion.div>

          <h2 className={`text-2xl md:text-3xl font-bold mb-3 ${isDark ? 'text-white' : 'text-gray-900'}`}>
            Page Not Found
          </h2>

          <p className={`mb-8 text-lg ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
            Oops! The page you&apos;re looking for seems to have gone off the charts.
          </p>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-8">
            <Button
              variant="outline"
              onClick={() => navigate(-1)}
              className="flex items-center justify-center gap-2"
            >
              <ArrowLeftIcon className="w-4 h-4" />
              Go Back
            </Button>
            <Button
              variant="primary"
              onClick={() => navigate('/dashboard')}
              className="flex items-center justify-center gap-2"
            >
              <HomeIcon className="w-4 h-4" />
              Dashboard
            </Button>
          </div>

          {/* Quick Links */}
          <div className={`p-4 rounded-xl ${isDark ? 'bg-gray-800/50' : 'bg-white/80'} border ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
            <div className="flex items-center gap-2 mb-3 justify-center">
              <MagnifyingGlassIcon className="w-4 h-4 text-gray-400" />
              <span className={`text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                Quick Navigation
              </span>
            </div>
            <div className="flex flex-wrap gap-2 justify-center">
              {quickLinks.map((link) => (
                <button
                  key={link.path}
                  onClick={() => navigate(link.path)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${isDark
                    ? 'bg-gray-700 text-gray-300 hover:bg-gray-600 hover:text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200 hover:text-gray-900'
                    }`}
                >
                  {link.label}
                </button>
              ))}
            </div>
          </div>
        </motion.div>
      </div>
    </>
  );
};

export default NotFound;

