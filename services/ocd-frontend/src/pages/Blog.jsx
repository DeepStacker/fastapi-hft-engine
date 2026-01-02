
import { useState } from 'react';
import { useSelector } from 'react-redux';
import { Helmet } from 'react-helmet-async';
import { motion } from 'framer-motion';
import { CalendarIcon, UserIcon, ArrowTopRightOnSquareIcon, TagIcon } from '@heroicons/react/24/outline';
import { Button } from '../components/common';

/**
 * Market News & Insights Page
 * Replaces the "Coming Soon" placeholder with a functional news feed.
 */
const Blog = () => {
  const theme = useSelector((state) => state.theme.theme);
  const [category, setCategory] = useState('All');

  // Mock Data for Market News
  const newsItems = [
    {
      id: 1,
      title: "NIFTY Hits All-Time High Amidst Global Rally",
      excerpt: "Indian markets surged today as NIFTY crossed the 22,000 mark, driven by strong foreign inflows and positive global cues. Banking and IT sectors led the charge.",
      category: "Market Update",
      author: "Market Desk",
      date: "Jan 1, 2026",
      readTime: "3 min read",
      image: "bg-gradient-to-br from-green-500 to-emerald-700",
      tags: ["NIFTY", "Bull Market", "FII"]
    },
    {
      id: 2,
      title: "Understanding IV Skew: A Trader's Guide",
      excerpt: "Volatility skew can be a powerful indicator of market sentiment. Learn how to interpret smile and smirk patterns to optimize your option strategies.",
      category: "Education",
      author: "Rahul Sharma",
      date: "Dec 30, 2025",
      readTime: "8 min read",
      image: "bg-gradient-to-br from-blue-500 to-indigo-700",
      tags: ["Options", "Education", "Greeks"]
    },
    {
      id: 3,
      title: "Quarterly Results Season Kicks Off",
      excerpt: "Major IT giants are set to announce their Q3 earnings next week. Analysts expect muted growth but improving margins. Here's what to watch out for.",
      category: "Earnings",
      author: "Equity Research",
      date: "Dec 28, 2025",
      readTime: "5 min read",
      image: "bg-gradient-to-br from-purple-500 to-fuchsia-700",
      tags: ["Earnings", "IT Sector", "Stocks"]
    },
    {
      id: 4,
      title: "RBI Monetary Policy: What to Expect?",
      excerpt: "The central bank is likely to hold rates steady in the upcoming policy meeting. However, the stance on liquidity branding will be key for banking stocks.",
      category: "Economy",
      author: "Macro Team",
      date: "Dec 25, 2025",
      readTime: "4 min read",
      image: "bg-gradient-to-br from-amber-500 to-orange-700",
      tags: ["RBI", "Economy", "Bank Nifty"]
    },
    {
      id: 5,
      title: "Top 5 Strategies for High VIX Environments",
      excerpt: "When the VIX spikes, premiums explode. Discover the best risk-defined strategies to profit from high volatility while protecting your capital.",
      category: "Strategy",
      author: "DeepStrike Algo",
      date: "Dec 20, 2025",
      readTime: "6 min read",
      image: "bg-gradient-to-br from-red-500 to-rose-700",
      tags: ["VIX", "Intraday", "Hedging"]
    }
  ];

  const categories = ['All', 'Market Update', 'Education', 'Earnings', 'Economy', 'Strategy'];

  const filteredNews = category === 'All'
    ? newsItems
    : newsItems.filter(item => item.category === category);

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.1 }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 }
  };

  return (
    <>
      <Helmet>
        <title>Market Insights | Stockify</title>
      </Helmet>

      <div className={`min-h-screen py-10 px-4 sm:px-6 lg:px-8 ${theme === 'dark'
          ? 'bg-gradient-to-br from-gray-900 via-gray-900 to-gray-950'
          : 'bg-gradient-to-br from-slate-50 to-gray-100'
        }`}>
        <div className="max-w-7xl mx-auto space-y-12">

          {/* Header */}
          <div className="text-center space-y-4">
            <motion.h1
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              className={`text-4xl md:text-5xl font-black ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}
            >
              Market Insights
            </motion.h1>
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
              className={`text-xl max-w-2xl mx-auto ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}
            >
              Stay ahead with the latest market trends, educational content, and trading strategies.
            </motion.p>
          </div>

          {/* Category Filter */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="flex flex-wrap justify-center gap-3"
          >
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setCategory(cat)}
                className={`px-4 py-2 rounded-full font-medium transition-all duration-200 border ${category === cat
                    ? 'bg-blue-600 text-white border-blue-600 shadow-lg shadow-blue-500/30'
                    : theme === 'dark'
                      ? 'bg-gray-800 text-gray-400 border-gray-700 hover:bg-gray-700'
                      : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                  }`}
              >
                {cat}
              </button>
            ))}
          </motion.div>

          {/* News Grid */}
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8"
          >
            {filteredNews.map((item) => (
              <motion.article
                key={item.id}
                variants={itemVariants}
                className={`flex flex-col h-full rounded-2xl overflow-hidden border transition-all duration-300 hover:-translate-y-2 hover:shadow-2xl ${theme === 'dark'
                    ? 'bg-gray-800/50 border-gray-700/50 backdrop-blur-sm shadow-black/20'
                    : 'bg-white border-gray-100 shadow-xl shadow-gray-200/50'
                  }`}
              >
                {/* Image Placeholder */}
                <div className={`h-48 w-full ${item.image} relative overflow-hidden group`}>
                  <div className="absolute inset-0 bg-black/10 group-hover:bg-transparent transition-colors duration-300" />
                  <div className="absolute top-4 left-4">
                    <span className="px-3 py-1 text-xs font-bold uppercase tracking-wider text-white bg-black/50 backdrop-blur-md rounded-lg">
                      {item.category}
                    </span>
                  </div>
                </div>

                {/* Content */}
                <div className="flex-1 p-6 flex flex-col">
                  {/* Meta */}
                  <div className="flex items-center text-xs space-x-4 mb-4 text-gray-500 dark:text-gray-400">
                    <div className="flex items-center">
                      <CalendarIcon className="w-4 h-4 mr-1" />
                      {item.date}
                    </div>
                    <div className="flex items-center">
                      <UserIcon className="w-4 h-4 mr-1" />
                      {item.author}
                    </div>
                  </div>

                  {/* Title & Excerpt */}
                  <h3 className={`text-xl font-bold mb-3 line-clamp-2 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                    {item.title}
                  </h3>
                  <p className={`text-sm mb-6 flex-1 line-clamp-3 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                    {item.excerpt}
                  </p>

                  {/* Footer */}
                  <div className="flex items-center justify-between mt-auto pt-4 border-t border-gray-200 dark:border-gray-700/50">
                    <div className="flex gap-2">
                      {item.tags.slice(0, 2).map((tag, i) => (
                        <span key={i} className={`text-xs px-2 py-1 rounded bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300`}>
                          #{tag}
                        </span>
                      ))}
                    </div>
                    <Button variant="ghost" size="sm" className="!p-0 hover:bg-transparent text-blue-500 hover:text-blue-400">
                      Read More <ArrowTopRightOnSquareIcon className="w-4 h-4 ml-1" />
                    </Button>
                  </div>
                </div>
              </motion.article>
            ))}
          </motion.div>

          {/* Newsletter CTA */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className={`rounded-3xl p-8 md:p-12 text-center relative overflow-hidden border ${theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-blue-600 text-white border-blue-500'
              }`}
          >
            {/* Background pattern */}
            <div className="absolute inset-0 opacity-10 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]"></div>

            <div className="relative z-10 max-w-2xl mx-auto">
              <h2 className={`text-3xl font-bold mb-4 ${theme === 'dark' ? 'text-white' : 'text-white'}`}>
                Never Miss a Market Move
              </h2>
              <p className={`text-lg mb-8 ${theme === 'dark' ? 'text-gray-400' : 'text-blue-100'}`}>
                Subscribe to our daily newsletter for curated market insights, trade setups, and algorithm performance reports.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center max-w-md mx-auto">
                <input
                  type="email"
                  placeholder="Enter your email"
                  className={`px-6 py-3 rounded-xl flex-1 outline-none text-gray-900 ${theme === 'dark' ? 'bg-gray-900 border border-gray-600 focus:border-blue-500' : 'bg-white border-transparent'
                    }`}
                />
                <Button variant="premium" size="lg" className="whitespace-nowrap">
                  Subscribe Now
                </Button>
              </div>
            </div>
          </motion.div>

        </div>
      </div>
    </>
  );
};

export default Blog;
