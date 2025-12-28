import { useSelector } from 'react-redux';
import { Link, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { motion } from 'framer-motion';
import {
  ChartBarIcon,
  BoltIcon,
  ShieldCheckIcon,
  ArrowRightIcon,
  ArrowTrendingUpIcon,
  SparklesIcon,
  CpuChipIcon,
} from '@heroicons/react/24/outline';
import { selectIsAuthenticated } from '../context/selectors';

const Home = () => {
  const isAuthenticated = useSelector(selectIsAuthenticated);
  const navigate = useNavigate();
  const theme = useSelector((state) => state.theme.theme);
  const isDark = theme === 'dark';

  const handleGetStarted = () => {
    if (isAuthenticated) {
      navigate('/dashboard');
    } else {
      navigate('/register');
    }
  };

  const features = [
    {
      icon: ChartBarIcon,
      title: "Real-Time Options Chain",
      description: "Live data for NIFTY, BANKNIFTY with full Greeks - Delta, Theta, Gamma, Vega.",
      gradient: "from-blue-500 to-cyan-500",
    },
    {
      icon: BoltIcon,
      title: "Built-in Analysis",
      description: "PCR, Max Pain, IV Skew, and OI Build-up analysis for market direction.",
      gradient: "from-amber-500 to-orange-500",
    },
    {
      icon: CpuChipIcon,
      title: "Advanced Indicators",
      description: "Straddle pricing, Greeks heatmaps, and volume spike detection.",
      gradient: "from-violet-500 to-purple-500",
    },
    {
      icon: ShieldCheckIcon,
      title: "Secure & Reliable",
      description: "Institutional-grade data with secure authentication.",
      gradient: "from-emerald-500 to-green-500",
    },
  ];

  const stats = [
    { value: "50K+", label: "Active Traders" },
    { value: "99.9%", label: "Uptime" },
    { value: "< 100ms", label: "Data Latency" },
    { value: "24/7", label: "Support" },
  ];

  return (
    <>
      <Helmet>
        <title>DeepStrike | Pro Options Analysis Platform</title>
        <meta name="description" content="Real-time NSE Option Chain analysis with advanced Greeks, PCR, and Max Pain indicators." />
      </Helmet>

      {/* Hero Section */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
        {/* Animated Background */}
        <div className="absolute inset-0 overflow-hidden">
          <div className={`absolute inset-0 ${isDark ? 'bg-slate-950' : 'bg-gradient-to-br from-slate-50 to-blue-50'}`} />
          <motion.div
            animate={{
              x: [0, 100, 0],
              y: [0, -50, 0],
            }}
            transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
            className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-gradient-to-r from-blue-500/20 to-purple-500/20 rounded-full blur-3xl"
          />
          <motion.div
            animate={{
              x: [0, -100, 0],
              y: [0, 50, 0],
            }}
            transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
            className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-gradient-to-r from-cyan-500/20 to-emerald-500/20 rounded-full blur-3xl"
          />
        </div>

        <div className="container mx-auto px-6 text-center relative z-10">
          {/* Badge */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-2 px-4 py-2 mb-8 rounded-full bg-gradient-to-r from-blue-600/10 to-purple-600/10 border border-blue-500/20 backdrop-blur-sm"
          >
            <SparklesIcon className="w-4 h-4 text-blue-500" />
            <span className={`text-sm font-medium ${isDark ? 'text-blue-400' : 'text-blue-600'}`}>
              Trusted by 50,000+ traders
            </span>
          </motion.div>

          {/* Title */}
          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className={`text-5xl md:text-7xl font-black mb-6 tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}
          >
            Master the{' '}
            <span className="bg-gradient-to-r from-blue-600 via-purple-600 to-cyan-600 bg-clip-text text-transparent">
              Markets
            </span>
          </motion.h1>

          {/* Subtitle */}
          <motion.p
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className={`text-xl md:text-2xl max-w-3xl mx-auto mb-10 leading-relaxed ${isDark ? 'text-slate-400' : 'text-slate-600'}`}
          >
            Professional-grade Option Chain analysis with real-time Greeks, 
            PCR trends, and Max Pain indicators. Make data-driven trading decisions.
          </motion.p>

          {/* CTA Buttons */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="flex flex-col sm:flex-row justify-center gap-4"
          >
            <motion.button
              whileHover={{ scale: 1.02, boxShadow: "0 20px 40px rgba(59, 130, 246, 0.3)" }}
              whileTap={{ scale: 0.98 }}
              onClick={handleGetStarted}
              className="inline-flex items-center justify-center gap-2 px-8 py-4 text-lg font-bold text-white bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl shadow-lg shadow-blue-500/30 transition-all"
            >
              {isAuthenticated ? 'Go to Dashboard' : 'Start Analyzing Free'}
              <ArrowRightIcon className="w-5 h-5" />
            </motion.button>

            {!isAuthenticated && (
              <Link to="/login">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className={`inline-flex items-center justify-center gap-2 px-8 py-4 text-lg font-bold rounded-2xl border-2 transition-all ${
                    isDark 
                      ? 'border-slate-700 text-white hover:bg-slate-800' 
                      : 'border-slate-300 text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  Sign In
                </motion.button>
              </Link>
            )}
          </motion.div>

          {/* Stats */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="grid grid-cols-2 md:grid-cols-4 gap-6 mt-20 max-w-4xl mx-auto"
          >
            {stats.map((stat, i) => (
              <div key={i} className={`px-6 py-4 rounded-2xl backdrop-blur-sm ${isDark ? 'bg-slate-800/50' : 'bg-white/70'} border ${isDark ? 'border-slate-700' : 'border-slate-200'}`}>
                <div className={`text-3xl font-black ${isDark ? 'text-white' : 'text-slate-900'}`}>{stat.value}</div>
                <div className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>{stat.label}</div>
              </div>
            ))}
          </motion.div>
        </div>

        {/* Scroll indicator */}
        <motion.div
          animate={{ y: [0, 10, 0] }}
          transition={{ duration: 2, repeat: Infinity }}
          className="absolute bottom-10 left-1/2 transform -translate-x-1/2"
        >
          <div className={`w-6 h-10 rounded-full border-2 ${isDark ? 'border-slate-600' : 'border-slate-400'} flex justify-center pt-2`}>
            <div className={`w-1.5 h-3 rounded-full ${isDark ? 'bg-slate-500' : 'bg-slate-400'}`} />
          </div>
        </motion.div>
      </section>

      {/* Features Section */}
      <section className={`py-24 ${isDark ? 'bg-slate-900' : 'bg-slate-50'}`}>
        <div className="container mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className={`text-4xl md:text-5xl font-black mb-4 ${isDark ? 'text-white' : 'text-slate-900'}`}>
              Everything you need
            </h2>
            <p className={`text-xl max-w-2xl mx-auto ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
              Professional tools that give you an edge in the market
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((feature, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                whileHover={{ y: -5 }}
                className={`relative group p-6 rounded-3xl transition-all ${
                  isDark ? 'bg-slate-800/50 hover:bg-slate-800' : 'bg-white hover:shadow-xl'
                } border ${isDark ? 'border-slate-700' : 'border-slate-200'}`}
              >
                <div className={`w-14 h-14 mb-5 rounded-2xl bg-gradient-to-r ${feature.gradient} flex items-center justify-center shadow-lg`}>
                  <feature.icon className="w-7 h-7 text-white" />
                </div>
                <h3 className={`text-xl font-bold mb-3 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  {feature.title}
                </h3>
                <p className={`${isDark ? 'text-slate-400' : 'text-slate-600'} leading-relaxed`}>
                  {feature.description}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className={`py-24 ${isDark ? 'bg-slate-950' : 'bg-white'} relative overflow-hidden`}>
        {/* Background decoration */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] bg-gradient-to-r from-blue-500/10 to-purple-500/10 rounded-full blur-3xl" />
        </div>

        <div className="container mx-auto px-6 text-center relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <div className="inline-flex items-center justify-center w-16 h-16 mb-6 bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl shadow-lg shadow-blue-500/30">
              <ArrowTrendingUpIcon className="w-8 h-8 text-white" />
            </div>
            <h2 className={`text-4xl md:text-5xl font-black mb-4 ${isDark ? 'text-white' : 'text-slate-900'}`}>
              Ready to trade smarter?
            </h2>
            <p className={`text-xl max-w-2xl mx-auto mb-10 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
              Join thousands of professional traders who trust DeepStrike for market analysis.
            </p>
            <motion.button
              whileHover={{ scale: 1.02, boxShadow: "0 20px 40px rgba(59, 130, 246, 0.3)" }}
              whileTap={{ scale: 0.98 }}
              onClick={handleGetStarted}
              className="inline-flex items-center gap-2 px-10 py-5 text-lg font-bold text-white bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl shadow-lg shadow-blue-500/30"
            >
              Get Started Free
              <ArrowRightIcon className="w-5 h-5" />
            </motion.button>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className={`py-8 border-t ${isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
        <div className="container mx-auto px-6 text-center">
          <div className="flex items-center justify-center gap-2 mb-4">
            <div className="w-8 h-8 bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg flex items-center justify-center">
              <ArrowTrendingUpIcon className="w-5 h-5 text-white" />
            </div>
            <span className={`font-bold text-xl ${isDark ? 'text-white' : 'text-slate-900'}`}>DeepStrike</span>
          </div>
          <p className={`text-sm ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>
            © {new Date().getFullYear()} DeepStrike. Professional Options Analysis Platform.
          </p>
        </div>
      </footer>
    </>
  );
};

export default Home;
