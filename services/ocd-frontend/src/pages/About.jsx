import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { motion } from 'framer-motion';
import {
  ChartBarIcon,
  ShieldCheckIcon,
  BoltIcon,
  UsersIcon,
  SparklesIcon,
  RocketLaunchIcon,
  CpuChipIcon,
  ArrowRightIcon,
  CheckCircleIcon,
} from '@heroicons/react/24/outline';

/**
 * Premium About Page
 * Modern landing-style design with animations and professional aesthetics
 */
const About = () => {
  const theme = useSelector((state) => state.theme.theme);
  const navigate = useNavigate();
  const isDark = theme === 'dark';

  // Animation variants
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.1, delayChildren: 0.2 }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 30 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { type: 'spring', damping: 20, stiffness: 100 }
    }
  };

  const features = [
    {
      icon: ChartBarIcon,
      title: 'Real-Time Data',
      desc: 'Live NSE option chain with millisecond latency updates',
      gradient: 'from-blue-500 to-cyan-500',
    },
    {
      icon: BoltIcon,
      title: 'Lightning Fast',
      desc: 'Greeks, IV, PCR calculated instantly on-the-fly',
      gradient: 'from-amber-500 to-orange-500',
    },
    {
      icon: ShieldCheckIcon,
      title: 'Enterprise Security',
      desc: 'Bank-grade encryption for all your trading data',
      gradient: 'from-green-500 to-emerald-500',
    },
    {
      icon: UsersIcon,
      title: 'Built for Traders',
      desc: 'Designed by professional traders who understand your needs',
      gradient: 'from-purple-500 to-pink-500',
    },
  ];

  const stats = [
    { value: '50K+', label: 'Active Traders' },
    { value: '99.9%', label: 'Uptime SLA' },
    { value: '<50ms', label: 'Data Latency' },
    { value: '24/7', label: 'Support' },
  ];

  const capabilities = [
    'Live option chain with all Greeks',
    'Advanced OI & Volume analysis',
    'Multi-strike comparison',
    'Strategy builder & payoff charts',
    'Historical data playback',
    'Real-time screeners & alerts',
    'Position sizing calculator',
    'Community trading insights',
  ];

  return (
    <>
      <Helmet>
        <title>About | DeepStrike - Professional Options Analysis</title>
        <meta name="description" content="DeepStrike is a professional-grade option chain analysis platform for Indian markets with real-time data and advanced analytics." />
      </Helmet>

      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="w-full px-4 py-8 space-y-16 max-w-6xl mx-auto"
      >
        {/* Hero Section */}
        <motion.section variants={itemVariants} className="text-center relative">
          {/* Background glow effects */}
          <div className="absolute -top-20 left-1/4 w-72 h-72 bg-blue-500/20 rounded-full blur-[100px] pointer-events-none" />
          <div className="absolute -top-10 right-1/4 w-60 h-60 bg-purple-500/20 rounded-full blur-[100px] pointer-events-none" />

          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', damping: 15 }}
            className="relative z-10"
          >
            <div className="flex items-center justify-center gap-2 mb-4">
              <SparklesIcon className={`w-6 h-6 ${isDark ? 'text-amber-400' : 'text-amber-500'}`} />
              <span className={`text-sm font-bold uppercase tracking-wider ${isDark ? 'text-amber-400' : 'text-amber-600'}`}>
                Professional Trading Platform
              </span>
            </div>

            <h1 className={`text-5xl md:text-6xl font-black mb-6 ${isDark ? 'text-white' : 'text-gray-900'}`}>
              Trade Smarter with{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500">
                DeepStrike
              </span>
            </h1>

            <p className={`text-xl max-w-3xl mx-auto mb-8 leading-relaxed ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
              Professional-grade option chain analysis platform built for Indian markets.
              Real-time data, advanced Greeks, powerful screeners, and market insights — all in one place.
            </p>

            <div className="flex flex-wrap items-center justify-center gap-4">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => navigate('/option-chain')}
                className="px-8 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-bold text-lg shadow-xl shadow-blue-500/25 hover:shadow-2xl hover:shadow-blue-500/30 transition-shadow flex items-center gap-2"
              >
                <RocketLaunchIcon className="w-5 h-5" />
                Launch Option Chain
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => navigate('/dashboard')}
                className={`px-8 py-4 rounded-xl font-bold text-lg border-2 flex items-center gap-2 transition-colors ${isDark
                    ? 'border-gray-700 text-white hover:bg-gray-800'
                    : 'border-gray-300 text-gray-700 hover:bg-gray-100'
                  }`}
              >
                View Dashboard
                <ArrowRightIcon className="w-5 h-5" />
              </motion.button>
            </div>
          </motion.div>
        </motion.section>

        {/* Stats Section */}
        <motion.section variants={itemVariants}>
          <div className={`grid grid-cols-2 md:grid-cols-4 gap-4 p-8 rounded-3xl ${isDark ? 'bg-gray-900/50 border border-gray-800' : 'bg-white/80 border border-gray-200 shadow-xl'
            }`}>
            {stats.map((stat, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.3 + i * 0.1 }}
                className="text-center py-4"
              >
                <div className={`text-4xl md:text-5xl font-black mb-2 text-transparent bg-clip-text bg-gradient-to-r ${i === 0 ? 'from-blue-500 to-cyan-500' :
                    i === 1 ? 'from-green-500 to-emerald-500' :
                      i === 2 ? 'from-amber-500 to-orange-500' :
                        'from-purple-500 to-pink-500'
                  }`}>
                  {stat.value}
                </div>
                <div className={`text-sm font-medium ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
                  {stat.label}
                </div>
              </motion.div>
            ))}
          </div>
        </motion.section>

        {/* Features Grid */}
        <motion.section variants={itemVariants}>
          <div className="text-center mb-12">
            <h2 className={`text-3xl font-bold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>
              Why Traders Choose DeepStrike
            </h2>
            <p className={`text-lg ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
              Built with cutting-edge technology for the modern options trader
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((feature, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 + i * 0.1 }}
                whileHover={{ y: -5, transition: { duration: 0.2 } }}
                className={`p-6 rounded-2xl border transition-all cursor-default ${isDark
                    ? 'bg-gray-900/50 border-gray-800 hover:border-gray-700'
                    : 'bg-white/80 border-gray-200 hover:border-gray-300 shadow-lg hover:shadow-xl'
                  }`}
              >
                <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${feature.gradient} flex items-center justify-center shadow-lg mb-4`}>
                  <feature.icon className="w-7 h-7 text-white" />
                </div>
                <h3 className={`text-lg font-bold mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  {feature.title}
                </h3>
                <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                  {feature.desc}
                </p>
              </motion.div>
            ))}
          </div>
        </motion.section>

        {/* Capabilities Section */}
        <motion.section variants={itemVariants}>
          <div className={`p-8 md:p-12 rounded-3xl ${isDark
              ? 'bg-gradient-to-br from-gray-900 via-gray-900 to-gray-800 border border-gray-800'
              : 'bg-gradient-to-br from-blue-50 via-white to-indigo-50 border border-blue-100'
            }`}>
            <div className="grid md:grid-cols-2 gap-12 items-center">
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <CpuChipIcon className={`w-6 h-6 ${isDark ? 'text-blue-400' : 'text-blue-600'}`} />
                  <span className={`text-sm font-bold uppercase tracking-wider ${isDark ? 'text-blue-400' : 'text-blue-600'}`}>
                    Platform Capabilities
                  </span>
                </div>
                <h2 className={`text-3xl font-bold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  Everything You Need to Trade Options
                </h2>
                <p className={`text-lg mb-6 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                  From real-time data to advanced analytics, DeepStrike provides all the tools professional traders need.
                </p>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => navigate('/analytics')}
                  className="px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-bold shadow-lg shadow-blue-500/25 flex items-center gap-2"
                >
                  Explore Analytics
                  <ArrowRightIcon className="w-4 h-4" />
                </motion.button>
              </div>

              <div className="grid gap-3">
                {capabilities.map((cap, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.5 + i * 0.05 }}
                    className={`flex items-center gap-3 p-3 rounded-xl ${isDark ? 'bg-gray-800/50' : 'bg-white/80'
                      }`}
                  >
                    <CheckCircleIcon className={`w-5 h-5 flex-shrink-0 ${isDark ? 'text-green-400' : 'text-green-600'}`} />
                    <span className={`text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                      {cap}
                    </span>
                  </motion.div>
                ))}
              </div>
            </div>
          </div>
        </motion.section>

        {/* CTA Section */}
        <motion.section variants={itemVariants} className="text-center">
          <div className={`p-12 rounded-3xl relative overflow-hidden ${isDark ? 'bg-gray-900 border border-gray-800' : 'bg-white shadow-2xl'
            }`}>
            {/* Decorative background */}
            <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 via-purple-500/10 to-pink-500/10" />

            <div className="relative z-10">
              <h2 className={`text-3xl font-bold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                Ready to Trade Like a Pro?
              </h2>
              <p className={`text-lg mb-8 max-w-xl mx-auto ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                Join thousands of traders who use DeepStrike for professional-grade options analysis.
              </p>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => navigate('/option-chain')}
                className="px-10 py-4 bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 text-white rounded-xl font-bold text-lg shadow-2xl shadow-purple-500/25 hover:shadow-purple-500/40 transition-shadow"
              >
                Get Started Now
              </motion.button>
            </div>
          </div>
        </motion.section>

        {/* Footer Note */}
        <motion.div variants={itemVariants} className="text-center pb-8">
          <p className={`text-sm ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>
            © 2025 DeepStrike. Built with ❤️ for Indian options traders.
          </p>
        </motion.div>
      </motion.div>
    </>
  );
};

export default About;
