/**
 * Community Page - Traders Hub (Pro Layout)
 * Real API-driven implementation
 */
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    HashtagIcon,
    SignalIcon,
    PresentationChartLineIcon,
    ChatBubbleLeftRightIcon,
    FireIcon,
    ClockIcon,
    ArrowPathIcon,
    PlusIcon
} from '@heroicons/react/24/outline';
import { communityService } from '../services/communityService';
import SmartContextSidebar from '../components/community/SmartContextSidebar';

// Sidebar Navigation Item
const NavItem = ({ label, icon: Icon, active, badge, onClick }) => (
    <button
        onClick={onClick}
        className={`w-full flex items-center justify-between px-3 py-2 text-sm font-medium rounded-lg transition-all group ${active
            ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
            : 'text-gray-400 hover:bg-gray-800 hover:text-gray-200 border border-transparent'
            }`}
    >
        <div className="flex items-center gap-3">
            <Icon className={`w-4 h-4 ${active ? 'text-blue-400' : 'text-gray-500 group-hover:text-gray-300'}`} />
            <span>{label}</span>
        </div>
        {badge && (
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${active ? 'bg-blue-500 text-white' : 'bg-gray-800 text-gray-500'}`}>
                {badge}
            </span>
        )}
    </button>
);

// Feed Item Component (Real Data)
const FeedItem = ({ post, onClick }) => {
    const timeAgo = (dateStr) => {
        const diff = Date.now() - new Date(dateStr).getTime();
        const mins = Math.floor(diff / 60000);
        if (mins < 60) return `${mins}m ago`;
        const hours = Math.floor(mins / 60);
        if (hours < 24) return `${hours}h ago`;
        return `${Math.floor(hours / 24)}d ago`;
    };

    return (
        <div onClick={onClick} className="p-4 border-b border-gray-800/50 hover:bg-white/5 transition-colors cursor-pointer group">
            <div className="flex items-start justify-between mb-1">
                <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-[10px] font-bold text-white">
                        {post.author_name?.[0] || '?'}
                    </div>
                    <span className="text-xs font-bold text-gray-300 group-hover:text-blue-400">{post.author_name || 'Anonymous'}</span>
                    <span className="text-[10px] text-gray-500 flex items-center gap-1">
                        <ClockIcon className="w-3 h-3" /> {timeAgo(post.created_at)}
                    </span>
                </div>
                {post.room_name && (
                    <span className="px-2 py-0.5 rounded text-[10px] bg-gray-800 text-gray-400 border border-gray-700">
                        {post.room_name}
                    </span>
                )}
            </div>
            <h3 className="text-sm font-medium text-gray-200 mb-2 leading-relaxed group-hover:text-white line-clamp-2">
                {post.content?.replace(/<[^>]*>/g, '').substring(0, 150) || 'No content'}
            </h3>
            <div className="flex items-center gap-4 text-xs text-gray-500">
                <span className="flex items-center gap-1 hover:text-gray-300">
                    <ChatBubbleLeftRightIcon className="w-3 h-3" /> {post.reply_count || 0} replies
                </span>
                {post.upvotes > 5 && (
                    <span className="flex items-center gap-1 text-orange-400">
                        <FireIcon className="w-3 h-3" /> Hot
                    </span>
                )}
            </div>
        </div>
    );
};

const Community = () => {
    const navigate = useNavigate();
    const [rooms, setRooms] = useState([]);
    const [posts, setPosts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [postsLoading, setPostsLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('feed');
    const [selectedRoom, setSelectedRoom] = useState(null);

    // Fetch rooms
    const fetchRooms = useCallback(async () => {
        try {
            const response = await communityService.getRooms();
            setRooms(response.rooms || []);
        } catch (err) {
            console.error('Failed to fetch rooms:', err);
        }
    }, []);

    // Fetch posts from a specific room or aggregate from all rooms
    const fetchPosts = useCallback(async (roomSlug = null) => {
        try {
            setPostsLoading(true);
            if (roomSlug) {
                const response = await communityService.getPosts(roomSlug, { page: 1, pageSize: 20 });
                setPosts((response.posts || []).map(p => ({
                    ...p,
                    room_name: roomSlug,
                    author_name: p.author?.username || 'Anonymous',
                })));
            } else {
                // Aggregate posts from first 3 active rooms - PARALLEL fetch for better performance
                const roomsToFetch = rooms.slice(0, 3);
                const fetchPromises = roomsToFetch.map(room =>
                    communityService.getPosts(room.slug, { page: 1, pageSize: 5 })
                        .then(response => (response.posts || []).map(p => ({
                            ...p,
                            room_name: room.name,
                            author_name: p.author?.username || 'Anonymous',
                        })))
                        .catch(() => []) // Return empty array on error
                );

                const results = await Promise.all(fetchPromises);
                const allPosts = results.flat();

                // Sort by created_at descending
                allPosts.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
                setPosts(allPosts.slice(0, 20));
            }
        } catch (err) {
            console.error('Failed to fetch posts:', err);
            setPosts([]);
        } finally {
            setPostsLoading(false);
        }
    }, [rooms]);

    useEffect(() => {
        const init = async () => {
            setLoading(true);
            await fetchRooms();
            setLoading(false);
        };
        init();
    }, [fetchRooms]);

    useEffect(() => {
        if (rooms.length > 0) {
            fetchPosts(selectedRoom);
        }
    }, [rooms, selectedRoom, fetchPosts]);

    const handleRoomSelect = (slug) => {
        setSelectedRoom(slug);
        setActiveTab('feed');
    };

    return (
        <div className="h-screen bg-[#0B0C10] text-gray-200 flex overflow-hidden font-sans">
            {/* Left Sidebar - Navigation Area */}
            <div className="w-64 flex-shrink-0 border-r border-gray-800 bg-gray-900/50 flex flex-col">
                <div className="p-4 border-b border-gray-800">
                    <h2 className="text-xs font-bold text-gray-500 uppercase tracking-widest px-2 mb-4">Traders Hub</h2>
                    <div className="space-y-1">
                        <NavItem
                            label="All Posts"
                            icon={FireIcon}
                            active={activeTab === 'feed' && !selectedRoom}
                            onClick={() => { setSelectedRoom(null); setActiveTab('feed'); }}
                            badge="LIVE"
                        />
                        <NavItem
                            label="Trade Signals"
                            icon={SignalIcon}
                            active={activeTab === 'signal'}
                            onClick={() => handleRoomSelect('signal-discussion')}
                        />
                        <NavItem
                            label="Market Outlook"
                            icon={PresentationChartLineIcon}
                            active={selectedRoom === 'market-outlook'}
                            onClick={() => navigate('/community/market-outlook')}
                        />
                    </div>
                </div>

                <div className="p-4 flex-1 overflow-y-auto">
                    <h3 className="text-[10px] font-bold text-gray-600 uppercase tracking-widest px-2 mb-3">Rooms</h3>
                    <div className="space-y-0.5">
                        {rooms.map(room => (
                            <button
                                key={room.id}
                                onClick={() => navigate(`/community/${room.slug}`)}
                                className={`w-full flex items-center justify-between px-3 py-2 text-xs hover:text-gray-200 hover:bg-gray-800/50 rounded transition-colors text-left group ${selectedRoom === room.slug ? 'text-blue-400 bg-blue-500/10' : 'text-gray-400'}`}
                            >
                                <div className="flex items-center gap-2 truncate">
                                    <HashtagIcon className="w-3 h-3 text-gray-600 group-hover:text-gray-400" />
                                    <span className="truncate">{room.name}</span>
                                </div>
                                {room.post_count > 0 && (
                                    <span className="text-[9px] text-gray-600">{room.post_count}</span>
                                )}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Center - Main Content / Feed */}
            <div className="flex-1 flex flex-col min-w-0 bg-[#0B0C10]">
                {/* Header */}
                <div className="h-14 border-b border-gray-800 flex items-center justify-between px-6 bg-gray-900/20 backdrop-blur-sm sticky top-0 z-10">
                    <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                        <h1 className="text-sm font-bold text-white tracking-wide">
                            {selectedRoom ? selectedRoom.toUpperCase().replace(/-/g, ' ') : 'GLOBAL MARKET FEED'}
                        </h1>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => fetchPosts(selectedRoom)}
                            className="p-1.5 text-gray-400 hover:text-white rounded hover:bg-gray-800 transition-colors"
                            title="Refresh"
                        >
                            <ArrowPathIcon className={`w-4 h-4 ${postsLoading ? 'animate-spin' : ''}`} />
                        </button>
                        <button
                            onClick={() => navigate('/community/signal-discussion')}
                            className="px-3 py-1.5 text-xs font-medium bg-blue-600 text-white rounded hover:bg-blue-500 transition-colors shadow-lg shadow-blue-500/20 flex items-center gap-1"
                        >
                            <PlusIcon className="w-3 h-3" /> New Post
                        </button>
                    </div>
                </div>

                {/* Scrollable Feed */}
                <div className="flex-1 overflow-y-auto custom-scrollbar">
                    <div className="max-w-4xl mx-auto">
                        {loading || postsLoading ? (
                            <div className="flex items-center justify-center py-20">
                                <ArrowPathIcon className="w-6 h-6 text-blue-500 animate-spin" />
                            </div>
                        ) : posts.length === 0 ? (
                            <div className="text-center py-20">
                                <p className="text-gray-500 mb-4">No posts yet. Be the first to start a discussion!</p>
                                <button
                                    onClick={() => navigate('/community/signal-discussion')}
                                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-500 text-sm"
                                >
                                    Create Post
                                </button>
                            </div>
                        ) : (
                            posts.map(post => (
                                <FeedItem
                                    key={post.id}
                                    post={post}
                                    onClick={() => navigate(`/community/posts/${post.id}`)}
                                />
                            ))
                        )}
                    </div>

                    {posts.length > 0 && (
                        <div className="p-8 text-center border-t border-gray-800/50 mt-4">
                            <p className="text-xs text-gray-600">You're all caught up.</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Right - Smart Context */}
            <SmartContextSidebar />
        </div>
    );
};

export default Community;
