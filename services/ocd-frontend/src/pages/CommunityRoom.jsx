/**
 * CommunityRoom Page - Premium Trade Feed Interface
 */
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
    ChatBubbleLeftRightIcon,
    ArrowLeftIcon,
    ArrowPathIcon,
    PaperAirplaneIcon,
    HandThumbUpIcon,
    HandThumbDownIcon,
    ChatBubbleOvalLeftIcon,
    EllipsisVerticalIcon,
    PencilIcon,
    TrashIcon,
    CheckBadgeIcon,
    BookmarkIcon,
    Square2StackIcon,
    TagIcon,
    CurrencyRupeeIcon,
    ChartBarIcon,
    MagnifyingGlassIcon,
    FireIcon,
    ClockIcon,
    ArrowTrendingUpIcon
} from '@heroicons/react/24/outline';
import { HandThumbUpIcon as HandThumbUpSolidIcon, HandThumbDownIcon as HandThumbDownSolidIcon, BookmarkIcon as BookmarkSolidIcon } from '@heroicons/react/24/solid';
import { communityService } from '../services/communityService';
import { useSelector } from 'react-redux';
import { motion, AnimatePresence } from 'framer-motion';
import RichTextEditor from '../components/common/RichTextEditor';

// Trade Badge Component
const TradeBadge = ({ type, value }) => {
    const isProfit = type === 'PROFIT';
    const isLoss = type === 'LOSS';
    const color = isProfit || type === 'CE' ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' :
        isLoss || type === 'PE' ? 'text-red-400 bg-red-500/10 border-red-500/20' :
            'text-blue-400 bg-blue-500/10 border-blue-500/20';

    return (
        <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold border ${color} uppercase tracking-wide`}>
            {value || type}
        </span>
    );
};

// Post Card Component
const PostCard = ({ post, onReact, onDelete, currentUserId }) => {
    const [showMenu, setShowMenu] = useState(false);
    const navigate = useNavigate();
    const isAuthor = currentUserId && post.author_id === currentUserId;
    const isAdmin = false;

    const handleReact = async (type) => {
        if (post.user_reaction === type) {
            await onReact(post.id, null);
        } else {
            await onReact(post.id, type);
        }
    };

    const formatDate = (dateStr) => {
        const date = new Date(dateStr);
        return date.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`group relative rounded-xl border ${post.is_pinned ? 'border-amber-500/30 bg-amber-900/10' : 'border-gray-800 bg-gray-900/40'} 
                        backdrop-blur-md p-5 transition-all hover:border-gray-700/50 hover:bg-gray-800/40`}
        >
            {/* Pinned Indicator */}
            {post.is_pinned && (
                <div className="absolute top-0 right-0 p-2">
                    <BookmarkSolidIcon className="w-4 h-4 text-amber-500" />
                </div>
            )}

            <div className="flex gap-4">
                {/* Author Avatar Column */}
                <div className="flex-shrink-0">
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-600 to-indigo-600 shadow-lg flex items-center justify-center text-white font-bold text-sm">
                        {post.author?.username?.charAt(0).toUpperCase() || '?'}
                    </div>
                </div>

                {/* Main Content Column */}
                <div className="flex-1 min-w-0">
                    {/* Header */}
                    <div className="flex items-start justify-between mb-2">
                        <div>
                            <div className="flex items-center gap-2 mb-0.5">
                                <span className="font-bold text-gray-200 group-hover:text-white transition-colors">
                                    {post.author?.username || 'Unknown'}
                                </span>
                                {post.author?.verified_trader && (
                                    <CheckBadgeIcon className="w-4 h-4 text-blue-400" title="Verified Trader" />
                                )}
                                {post.author?.community_role === 'admin' && (
                                    <span className="px-1.5 py-0.5 bg-red-500/10 text-red-500 text-[10px] rounded border border-red-500/20 font-bold tracking-wider">MOD</span>
                                )}
                            </div>
                            <span className="text-xs text-gray-500 font-mono">{formatDate(post.created_at)}</span>
                        </div>

                        {/* Meatball Menu */}
                        {(isAuthor || isAdmin) && (
                            <div className="relative">
                                <button onClick={() => setShowMenu(!showMenu)} className="p-1 text-gray-500 hover:text-white transition-colors">
                                    <EllipsisVerticalIcon className="w-5 h-5" />
                                </button>
                                {showMenu && (
                                    <div className="absolute right-0 top-8 bg-gray-800 border border-gray-700 rounded-lg shadow-xl py-1 z-10 min-w-[120px]">
                                        <button onClick={() => onDelete(post.id)} className="w-full px-3 py-2 text-left text-sm text-red-400 hover:bg-gray-700/50 flex items-center gap-2">
                                            <TrashIcon className="w-4 h-4" /> Delete
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Title & Body */}
                    {post.title && <h3 className="text-base font-bold text-white mb-2">{post.title}</h3>}
                    <div className="prose prose-sm prose-invert max-w-none text-gray-300 leading-relaxed mb-4" dangerouslySetInnerHTML={{ __html: post.content }} />

                    {/* Trade Ticket (if detailed trade) */}
                    {post.instrument && (
                        <div className="bg-black/30 rounded-lg border border-gray-800 p-3 mb-4 grid grid-cols-2 sm:grid-cols-4 gap-4">
                            <div>
                                <span className="text-[10px] text-gray-500 uppercase tracking-wider">Symbol</span>
                                <div className="text-sm font-mono font-bold text-white mt-1">{post.instrument}</div>
                            </div>
                            <div>
                                <span className="text-[10px] text-gray-500 uppercase tracking-wider">Type</span>
                                <div className="mt-1"><TradeBadge type={post.trade_type} /></div>
                            </div>
                            <div>
                                <span className="text-[10px] text-gray-500 uppercase tracking-wider">Entry</span>
                                <div className="text-sm font-mono text-gray-300 mt-1">₹{post.entry_price}</div>
                            </div>
                            <div>
                                <span className="text-[10px] text-gray-500 uppercase tracking-wider">Exit</span>
                                <div className={`text-sm font-mono font-bold mt-1 ${post.exit_price > post.entry_price ? 'text-emerald-400' : 'text-red-400'}`}>
                                    ₹{post.exit_price}
                                </div>
                            </div>
                            {post.trade_explanation && (
                                <div className="col-span-2 sm:col-span-4 border-t border-gray-800 pt-2 mt-1">
                                    <span className="text-[10px] text-gray-500 uppercase tracking-wider">Logic</span>
                                    <p className="text-xs text-gray-400 mt-1">{post.trade_explanation}</p>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Footer Actions */}
                    <div className="flex items-center gap-4 border-t border-gray-800/50 pt-3">
                        <button onClick={() => handleReact('upvote')} className={`flex items-center gap-2 text-xs font-medium transition-colors ${post.user_reaction === 'upvote' ? 'text-emerald-400' : 'text-gray-500 hover:text-gray-300'}`}>
                            {post.user_reaction === 'upvote' ? <HandThumbUpSolidIcon className="w-4 h-4" /> : <HandThumbUpIcon className="w-4 h-4" />}
                            {post.upvotes || 0}
                        </button>
                        <button onClick={() => handleReact('downvote')} className={`flex items-center gap-2 text-xs font-medium transition-colors ${post.user_reaction === 'downvote' ? 'text-red-400' : 'text-gray-500 hover:text-gray-300'}`}>
                            {post.user_reaction === 'downvote' ? <HandThumbDownSolidIcon className="w-4 h-4" /> : <HandThumbDownIcon className="w-4 h-4" />}
                            {post.downvotes || 0}
                        </button>
                        <button
                            onClick={() => navigate(`/community/posts/${post.id}?quote=true`)}
                            className="flex items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-purple-400 transition-colors"
                            title="Quote Reply"
                        >
                            <Square2StackIcon className="w-4 h-4" />
                            Quote
                        </button>
                        <button
                            onClick={async () => {
                                try {
                                    if (post.is_bookmarked) {
                                        await communityService.removeBookmark(post.id);
                                    } else {
                                        await communityService.bookmarkPost(post.id);
                                    }
                                } catch (err) { console.error(err); }
                            }}
                            className={`flex items-center gap-1.5 text-xs font-medium transition-colors ${post.is_bookmarked ? 'text-amber-400' : 'text-gray-500 hover:text-amber-400'}`}
                            title={post.is_bookmarked ? 'Remove Bookmark' : 'Bookmark'}
                        >
                            {post.is_bookmarked ? <BookmarkSolidIcon className="w-4 h-4" /> : <BookmarkIcon className="w-4 h-4" />}
                        </button>
                        <button onClick={() => navigate(`/community/posts/${post.id}`)} className="flex items-center gap-2 text-xs font-medium text-gray-500 hover:text-blue-400 transition-colors ml-auto">
                            <ChatBubbleOvalLeftIcon className="w-4 h-4" />
                            {post.reply_count > 0 ? `${post.reply_count} Replies` : 'Reply'}
                        </button>
                    </div>
                </div>
            </div>
        </motion.div>
    );
};

// Post Creation Form
const PostForm = ({ roomSlug, roomType, onPostCreated }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Trade details
    const [instrument, setInstrument] = useState('');
    const [entryPrice, setEntryPrice] = useState('');
    const [exitPrice, setExitPrice] = useState('');
    const [tradeType, setTradeType] = useState('CE');
    const [tradeExplanation, setTradeExplanation] = useState('');

    const isTradeBreakdown = roomType === 'trade_breakdown';

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            setIsSubmitting(true);
            const postData = { title: title.trim() || null, content: content.trim() };
            if (isTradeBreakdown) {
                Object.assign(postData, { instrument, entry_price: parseFloat(entryPrice), exit_price: parseFloat(exitPrice), trade_type: tradeType, trade_explanation: tradeExplanation });
            }
            await communityService.createPost(roomSlug, postData);

            // Reset
            setTitle(''); setContent(''); setInstrument(''); setEntryPrice(''); setExitPrice(''); setTradeExplanation('');
            setIsExpanded(false);
            onPostCreated();
        } catch (err) {
            console.error(err);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className={`mb-8 border border-gray-800 bg-gray-900/60 backdrop-blur-md rounded-xl p-4 transition-all duration-300 ${isExpanded ? 'ring-1 ring-blue-500/50 shadow-lg shadow-blue-500/10' : ''}`}>
            {!isExpanded ? (
                <div className="flex items-center gap-4 cursor-text" onClick={() => setIsExpanded(true)}>
                    <div className="w-10 h-10 rounded-lg bg-gray-800 flex items-center justify-center">
                        <PencilIcon className="w-5 h-5 text-gray-500" />
                    </div>
                    <span className="text-gray-500 text-sm">Start a new discussion...</span>
                </div>
            ) : (
                <form onSubmit={handleSubmit}>
                    <div className="flex justify-between items-center mb-4 pb-2 border-b border-gray-800">
                        <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                            <Square2StackIcon className="w-4 h-4 text-blue-400" />
                            {isTradeBreakdown ? 'New Trade Analysis' : 'New Post'}
                        </h3>
                        <button type="button" onClick={() => setIsExpanded(false)} className="text-gray-500 hover:text-white text-xs">Cancel</button>
                    </div>

                    <input
                        type="text"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder="Thread Title (Optional)"
                        className="w-full bg-transparent border-none text-white text-lg font-bold placeholder-gray-600 focus:ring-0 px-0 mb-2"
                    />

                    {isTradeBreakdown && (
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4 p-3 bg-black/20 rounded-lg border border-gray-800/50">
                            <input value={instrument} onChange={e => setInstrument(e.target.value)} placeholder="SYMBOL (e.g. NIFTY)" className="bg-gray-800/50 border border-gray-700 rounded px-2 py-1.5 text-xs text-white focus:border-blue-500 outline-none" required />
                            <select value={tradeType} onChange={e => setTradeType(e.target.value)} className="bg-gray-800/50 border border-gray-700 rounded px-2 py-1.5 text-xs text-white focus:border-blue-500 outline-none">
                                <option value="CE">Call (CE)</option>
                                <option value="PE">Put (PE)</option>
                                <option value="FUT">Futures</option>
                            </select>
                            <input type="number" value={entryPrice} onChange={e => setEntryPrice(e.target.value)} placeholder="Entry Price" className="bg-gray-800/50 border border-gray-700 rounded px-2 py-1.5 text-xs text-white focus:border-blue-500 outline-none" required />
                            <input type="number" value={exitPrice} onChange={e => setExitPrice(e.target.value)} placeholder="Exit Price" className="bg-gray-800/50 border border-gray-700 rounded px-2 py-1.5 text-xs text-white focus:border-blue-500 outline-none" required />
                        </div>
                    )}

                    <RichTextEditor
                        content={content}
                        onChange={setContent}
                        placeholder="Share your analysis with formatting..."
                        minHeight="120px"
                    />

                    <div className="flex justify-end pt-3 border-t border-gray-800">
                        <button
                            type="submit"
                            disabled={isSubmitting || !content.trim()}
                            className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
                        >
                            {isSubmitting ? <ArrowPathIcon className="w-4 h-4 animate-spin" /> : <PaperAirplaneIcon className="w-4 h-4" />}
                            Publish Report
                        </button>
                    </div>
                </form>
            )}
        </div>
    );
};

// Main CommunityRoom Page
const CommunityRoom = () => {
    const { slug } = useParams();
    const navigate = useNavigate();
    const [room, setRoom] = useState(null);
    const [posts, setPosts] = useState([]);
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(false);
    const [loading, setLoading] = useState(true);
    const currentUser = useSelector((state) => state.auth?.user);

    // Search and Sort state
    const [searchQuery, setSearchQuery] = useState('');
    const [sortBy, setSortBy] = useState('new'); // 'new', 'hot', 'top'

    // Filter and sort posts
    const filteredPosts = useMemo(() => {
        let result = [...posts];

        // Search filter
        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase();
            result = result.filter(p =>
                (p.content?.toLowerCase().includes(query)) ||
                (p.title?.toLowerCase().includes(query)) ||
                (p.author?.username?.toLowerCase().includes(query)) ||
                (p.instrument?.toLowerCase().includes(query))
            );
        }

        // Sort
        switch (sortBy) {
            case 'hot':
                result.sort((a, b) => ((b.upvotes || 0) + (b.reply_count || 0)) - ((a.upvotes || 0) + (a.reply_count || 0)));
                break;
            case 'top':
                result.sort((a, b) => (b.upvotes || 0) - (a.upvotes || 0));
                break;
            case 'new':
            default:
                result.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        }

        return result;
    }, [posts, searchQuery, sortBy]);

    const fetchData = useCallback(async () => {
        try {
            const [roomData, postsData] = await Promise.all([
                communityService.getRoom(slug),
                communityService.getPosts(slug, { page: 1, pageSize: 20 })
            ]);
            setRoom(roomData);
            setPosts(postsData.posts || []);
            setHasMore(postsData.has_more);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    }, [slug]);

    const loadMore = async () => {
        const nextPage = page + 1;
        const data = await communityService.getPosts(slug, { page: nextPage, pageSize: 20 });
        setPosts(prev => [...prev, ...data.posts]);
        setHasMore(data.has_more);
        setPage(nextPage);
    };

    useEffect(() => { fetchData(); }, [fetchData]);

    const handleReact = async (postId, type) => {
        // Optimistic update - update UI immediately
        setPosts(prevPosts => prevPosts.map(post => {
            if (post.id !== postId) return post;

            const previousReaction = post.user_reaction;
            let upvotes = post.upvotes || 0;
            let downvotes = post.downvotes || 0;

            // Remove previous reaction counts
            if (previousReaction === 'upvote') upvotes--;
            if (previousReaction === 'downvote') downvotes--;

            // Add new reaction counts (if not removing)
            if (type === 'upvote') upvotes++;
            if (type === 'downvote') downvotes++;

            return {
                ...post,
                user_reaction: type,
                upvotes: Math.max(0, upvotes),
                downvotes: Math.max(0, downvotes),
            };
        }));

        // API call in background
        try {
            if (type) {
                await communityService.addReaction(postId, type);
            } else {
                await communityService.removeReaction(postId);
            }
        } catch (err) {
            console.error('Reaction failed:', err);
            // Revert on error
            fetchData();
        }
    };

    const handleDelete = async (postId) => {
        if (window.confirm('Delete this post?')) {
            await communityService.deletePost(postId);
            fetchData();
        }
    };

    if (loading) return <div className="min-h-screen bg-[#0B0C10] flex items-center justify-center"><ArrowPathIcon className="w-8 h-8 text-blue-500 animate-spin" /></div>;
    if (!room) return <div className="min-h-screen bg-[#0B0C10] flex items-center justify-center text-white">Room not found</div>;

    return (
        <div className="min-h-screen bg-[#0B0C10] text-gray-200 font-sans">
            {/* Ambient Background */}
            <div className="fixed inset-0 pointer-events-none">
                <div className="absolute top-0 left-0 w-full h-[300px] bg-gradient-to-b from-blue-900/10 to-transparent" />
            </div>

            <div className="relative max-w-7xl mx-auto px-4 py-6">
                {/* Header */}
                <div className="flex items-center gap-4 mb-8">
                    <button onClick={() => navigate('/community')} className="p-2 hover:bg-gray-800 rounded-lg transition-colors group">
                        <ArrowLeftIcon className="w-5 h-5 text-gray-400 group-hover:text-white" />
                    </button>
                    <div>
                        <h1 className="text-2xl font-bold text-white flex items-center gap-3">
                            {room.name}
                            <span className="px-2 py-0.5 text-[10px] bg-gray-800 text-gray-400 rounded border border-gray-700 uppercase tracking-widest">
                                Live Feed
                            </span>
                        </h1>
                        <p className="text-sm text-gray-500">{room.description}</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
                    {/* Main Feed */}
                    <div className="lg:col-span-3">
                        {!room.is_read_only && <PostForm roomSlug={slug} roomType={room.room_type} onPostCreated={fetchData} />}

                        {/* Search and Sort Bar */}
                        <div className="flex flex-col sm:flex-row gap-4 mb-6">
                            <div className="relative flex-1">
                                <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                                <input
                                    type="text"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    placeholder="Search posts..."
                                    className="w-full pl-10 pr-4 py-2 bg-gray-900/60 border border-gray-800 rounded-lg text-sm text-white placeholder-gray-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all"
                                />
                            </div>
                            <div className="flex gap-1 bg-gray-900/60 border border-gray-800 rounded-lg p-1">
                                <button
                                    onClick={() => setSortBy('new')}
                                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-all ${sortBy === 'new' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white hover:bg-gray-800'}`}
                                >
                                    <ClockIcon className="w-3.5 h-3.5" /> New
                                </button>
                                <button
                                    onClick={() => setSortBy('hot')}
                                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-all ${sortBy === 'hot' ? 'bg-orange-600 text-white' : 'text-gray-400 hover:text-white hover:bg-gray-800'}`}
                                >
                                    <FireIcon className="w-3.5 h-3.5" /> Hot
                                </button>
                                <button
                                    onClick={() => setSortBy('top')}
                                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-all ${sortBy === 'top' ? 'bg-emerald-600 text-white' : 'text-gray-400 hover:text-white hover:bg-gray-800'}`}
                                >
                                    <ArrowTrendingUpIcon className="w-3.5 h-3.5" /> Top
                                </button>
                            </div>
                        </div>

                        <div className="space-y-4">
                            {filteredPosts.map(post => (
                                <PostCard
                                    key={post.id}
                                    post={post}
                                    onReact={handleReact}
                                    onDelete={handleDelete}
                                    currentUserId={currentUser?.id}
                                />
                            ))}
                        </div>

                        {filteredPosts.length === 0 && posts.length > 0 && (
                            <div className="text-center py-12 border border-dashed border-gray-800 rounded-xl">
                                <MagnifyingGlassIcon className="w-10 h-10 text-gray-700 mx-auto mb-3" />
                                <p className="text-gray-500">No posts match your search.</p>
                            </div>
                        )}

                        {posts.length === 0 && (
                            <div className="text-center py-20 border border-dashed border-gray-800 rounded-xl">
                                <ChatBubbleLeftRightIcon className="w-12 h-12 text-gray-700 mx-auto mb-4" />
                                <p className="text-gray-500">No signals yet. Discussion is open.</p>
                            </div>
                        )}

                        {hasMore && (
                            <div className="text-center pt-8">
                                <button onClick={loadMore} className="px-6 py-2 bg-gray-900 border border-gray-800 text-gray-400 rounded-full hover:bg-gray-800 hover:text-white transition-all text-sm font-medium">Load Older Reports</button>
                            </div>
                        )}
                    </div>

                    {/* Room Sidebar */}
                    <div className="hidden lg:block space-y-6">
                        <div className="fixed w-[300px]">
                            <div className="rounded-xl border border-gray-800 bg-gray-900/50 backdrop-blur-md p-5">
                                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-4">Room Guidelines</h3>
                                <ul className="space-y-3 text-sm text-gray-400">
                                    <li className="flex gap-2">
                                        <div className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-1.5" />
                                        <span>Stay on topic: {room.name} discussion only.</span>
                                    </li>
                                    <li className="flex gap-2">
                                        <div className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-1.5" />
                                        <span>Respect verified traders and analysts.</span>
                                    </li>
                                    {!room.is_read_only && (
                                        <li className="flex gap-2">
                                            <div className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-1.5" />
                                            <span>Use the "Trade Analysis" form for breakdown.</span>
                                        </li>
                                    )}
                                </ul>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CommunityRoom;
