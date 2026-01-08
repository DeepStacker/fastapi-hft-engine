import { useState, useEffect, useCallback } from 'react';
import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { motion } from 'framer-motion';
import {
  CalendarIcon,
  UserIcon,
  ArrowTopRightOnSquareIcon,
  ChatBubbleLeftRightIcon,
  HandThumbUpIcon,
  ArrowPathIcon,
  SparklesIcon,
} from '@heroicons/react/24/outline';
import { Button, Card } from '../components/common';
import { communityService } from '../services/communityService';

/**
 * Market Insights Page
 * Displays featured community posts as market insights
 * Connected to real backend API
 */
const Blog = () => {
  const theme = useSelector((state) => state.theme.theme);
  const navigate = useNavigate();
  const isDark = theme === 'dark';

  const [category, setCategory] = useState('All');
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Room categories that map to insight types
  const INSIGHT_ROOMS = [
    { slug: 'market-analysis', label: 'Market Analysis', gradient: 'from-blue-500 to-indigo-700' },
    { slug: 'trading-strategies', label: 'Strategies', gradient: 'from-purple-500 to-fuchsia-700' },
    { slug: 'technical-analysis', label: 'Technical', gradient: 'from-amber-500 to-orange-700' },
    { slug: 'fundamental-analysis', label: 'Fundamental', gradient: 'from-green-500 to-emerald-700' },
    { slug: 'general', label: 'Discussion', gradient: 'from-gray-500 to-slate-700' },
  ];

  const categories = ['All', ...INSIGHT_ROOMS.map(r => r.label)];

  // Fetch posts from community API
  const fetchInsights = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // First get all rooms
      const roomsResponse = await communityService.getRooms();
      const rooms = roomsResponse.rooms || [];

      // Fetch posts from each room (or filtered room)
      let allPosts = [];
      const roomsToFetch = category === 'All'
        ? rooms.slice(0, 5) // Limit to 5 rooms for performance
        : rooms.filter(r => {
          const roomConfig = INSIGHT_ROOMS.find(ir => ir.label === category);
          return roomConfig && r.slug === roomConfig.slug;
        });

      await Promise.all(
        roomsToFetch.map(async (room) => {
          try {
            const postsResponse = await communityService.getPosts(room.slug, { page: 1, pageSize: 10 });
            const postsWithRoom = (postsResponse.posts || []).map(post => ({
              ...post,
              roomName: room.name,
              roomSlug: room.slug,
              gradient: INSIGHT_ROOMS.find(ir => ir.slug === room.slug)?.gradient || 'from-gray-500 to-slate-700',
            }));
            allPosts = [...allPosts, ...postsWithRoom];
          } catch (err) {
            console.error(`Failed to fetch posts from ${room.slug}:`, err);
          }
        })
      );

      // Sort by created_at descending (newest first)
      allPosts.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

      // Take top 12
      setPosts(allPosts.slice(0, 12));
    } catch (err) {
      console.error('Failed to fetch insights:', err);
      setError('Unable to load market insights. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [category]);

  useEffect(() => {
    fetchInsights();
  }, [fetchInsights]);

  // Format date
  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  // Get reading time estimate
  const getReadTime = (content) => {
    if (!content) return '1 min read';
    const words = content.split(/\s+/).length;
    const minutes = Math.max(1, Math.ceil(words / 200));
    return `${minutes} min read`;
  };

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
        <title>Market Insights | DeepStrike</title>
        <meta name="description" content="Latest market insights, trading strategies, and analysis from the DeepStrike community." />
      </Helmet>

      <div className={`min-h-screen py-10 px-4 sm:px-6 lg:px-8 ${isDark
        ? 'bg-gradient-to-br from-gray-900 via-gray-900 to-gray-950'
        : 'bg-gradient-to-br from-slate-50 to-gray-100'
        }`}>
        <div className="max-w-7xl mx-auto space-y-12">

          {/* Header */}
          <div className="text-center space-y-4">
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-blue-600/10 to-purple-600/10 border border-blue-500/20"
            >
              <SparklesIcon className={`w-4 h-4 ${isDark ? 'text-blue-400' : 'text-blue-600'}`} />
              <span className={`text-sm font-medium ${isDark ? 'text-blue-400' : 'text-blue-600'}`}>
                Community Insights
              </span>
            </motion.div>
            <motion.h1
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              className={`text-4xl md:text-5xl font-black ${isDark ? 'text-white' : 'text-gray-900'}`}
            >
              Market Insights
            </motion.h1>
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
              className={`text-xl max-w-2xl mx-auto ${isDark ? 'text-gray-400' : 'text-gray-600'}`}
            >
              Latest analysis, strategies, and discussions from the trading community.
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
                  : isDark
                    ? 'bg-gray-800 text-gray-400 border-gray-700 hover:bg-gray-700'
                    : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                  }`}
              >
                {cat}
              </button>
            ))}
            <button
              onClick={fetchInsights}
              disabled={loading}
              className={`p-2 rounded-full transition-all ${isDark ? 'hover:bg-gray-800' : 'hover:bg-gray-100'}`}
              title="Refresh"
            >
              <ArrowPathIcon className={`w-5 h-5 ${loading ? 'animate-spin' : ''} ${isDark ? 'text-gray-400' : 'text-gray-600'}`} />
            </button>
          </motion.div>

          {/* Loading State */}
          {loading && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className={`h-80 rounded-2xl animate-pulse ${isDark ? 'bg-gray-800' : 'bg-gray-200'}`} />
              ))}
            </div>
          )}

          {/* Error State */}
          {error && !loading && (
            <div className="text-center py-12">
              <p className={`text-lg ${isDark ? 'text-red-400' : 'text-red-600'}`}>{error}</p>
              <Button onClick={fetchInsights} className="mt-4">Try Again</Button>
            </div>
          )}

          {/* Empty State */}
          {!loading && !error && posts.length === 0 && (
            <div className="text-center py-16">
              <ChatBubbleLeftRightIcon className={`w-16 h-16 mx-auto mb-4 ${isDark ? 'text-gray-600' : 'text-gray-400'}`} />
              <h3 className={`text-xl font-bold mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                No Insights Yet
              </h3>
              <p className={`mb-6 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                Be the first to share your market analysis!
              </p>
              <Button onClick={() => navigate('/community')}>
                Join the Community
              </Button>
            </div>
          )}

          {/* Posts Grid */}
          {!loading && !error && posts.length > 0 && (
            <motion.div
              variants={containerVariants}
              initial="hidden"
              animate="visible"
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8"
            >
              {posts.map((post) => (
                <motion.article
                  key={post.id}
                  variants={itemVariants}
                  className={`flex flex-col h-full rounded-2xl overflow-hidden border transition-all duration-300 hover:-translate-y-2 hover:shadow-2xl cursor-pointer ${isDark
                    ? 'bg-gray-800/50 border-gray-700/50 backdrop-blur-sm shadow-black/20'
                    : 'bg-white border-gray-100 shadow-xl shadow-gray-200/50'
                    }`}
                  onClick={() => navigate(`/community/posts/${post.id}`)}
                >
                  {/* Header Gradient */}
                  <div className={`h-32 w-full bg-gradient-to-br ${post.gradient} relative overflow-hidden group`}>
                    <div className="absolute inset-0 bg-black/10 group-hover:bg-transparent transition-colors duration-300" />
                    <div className="absolute top-4 left-4">
                      <span className="px-3 py-1 text-xs font-bold uppercase tracking-wider text-white bg-black/50 backdrop-blur-md rounded-lg">
                        {post.roomName || 'Discussion'}
                      </span>
                    </div>
                  </div>

                  {/* Content */}
                  <div className="flex-1 p-6 flex flex-col">
                    {/* Meta */}
                    <div className="flex items-center text-xs space-x-4 mb-4 text-gray-500 dark:text-gray-400">
                      <div className="flex items-center">
                        <CalendarIcon className="w-4 h-4 mr-1" />
                        {formatDate(post.created_at)}
                      </div>
                      <div className="flex items-center">
                        <UserIcon className="w-4 h-4 mr-1" />
                        {post.author?.username || 'Anonymous'}
                      </div>
                    </div>

                    {/* Title & Content */}
                    <h3 className={`text-lg font-bold mb-3 line-clamp-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                      {post.content?.substring(0, 80) || 'Untitled Post'}
                      {post.content?.length > 80 ? '...' : ''}
                    </h3>
                    <p className={`text-sm mb-6 flex-1 line-clamp-3 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                      {post.content?.substring(80, 200) || ''}
                    </p>

                    {/* Footer */}
                    <div className="flex items-center justify-between mt-auto pt-4 border-t border-gray-200 dark:border-gray-700/50">
                      <div className="flex items-center gap-3 text-xs">
                        <span className="flex items-center gap-1 text-green-500">
                          <HandThumbUpIcon className="w-4 h-4" />
                          {post.reactions?.upvote || 0}
                        </span>
                        <span className={`${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                          {getReadTime(post.content)}
                        </span>
                      </div>
                      <span className="text-blue-500 hover:text-blue-400 text-sm font-medium flex items-center">
                        Read More <ArrowTopRightOnSquareIcon className="w-4 h-4 ml-1" />
                      </span>
                    </div>
                  </div>
                </motion.article>
              ))}
            </motion.div>
          )}

          {/* CTA Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className={`rounded-3xl p-8 md:p-12 text-center relative overflow-hidden border ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-blue-600 text-white border-blue-500'
              }`}
          >
            <div className="absolute inset-0 opacity-10 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]"></div>

            <div className="relative z-10 max-w-2xl mx-auto">
              <h2 className={`text-3xl font-bold mb-4 ${isDark ? 'text-white' : 'text-white'}`}>
                Share Your Analysis
              </h2>
              <p className={`text-lg mb-8 ${isDark ? 'text-gray-400' : 'text-blue-100'}`}>
                Join the community and share your market insights, trading strategies, and analysis with fellow traders.
              </p>
              <Button
                onClick={() => navigate('/community')}
                variant={isDark ? 'premium' : 'outline'}
                size="lg"
                className={isDark ? '' : 'border-white text-white hover:bg-white hover:text-blue-600'}
              >
                Join Community
              </Button>
            </div>
          </motion.div>
        </div>
      </div>
    </>
  );
};

export default Blog;
