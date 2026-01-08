/**
 * Community Post (Thread) View
 * Real API-driven implementation
 */
import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    ArrowLeftIcon,
    ChatBubbleLeftRightIcon,
    HandThumbUpIcon,
    HandThumbDownIcon,
    EllipsisHorizontalIcon,
    UserCircleIcon,
    ArrowPathIcon,
    ExclamationTriangleIcon
} from '@heroicons/react/24/outline';
import { communityService } from '../services/communityService';
import RichTextEditor from '../components/common/RichTextEditor';

const PostCard = ({ post, isMain = false, onReact }) => {
    if (!post) return null;

    const timeAgo = (dateStr) => {
        const diff = Date.now() - new Date(dateStr).getTime();
        const mins = Math.floor(diff / 60000);
        if (mins < 60) return `${mins}m ago`;
        const hours = Math.floor(mins / 60);
        if (hours < 24) return `${hours}h ago`;
        return `${Math.floor(hours / 24)}d ago`;
    };

    return (
        <div className={`p-6 ${isMain ? 'bg-gray-800/40 rounded-xl border border-gray-700/50 mb-6' : 'bg-transparent border-b border-gray-800/50 last:border-0'}`}>
            <div className="flex items-start gap-4">
                <div className="flex-shrink-0">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-sm font-bold text-white shadow-lg">
                        {post.author_name?.[0] || <UserCircleIcon className="w-6 h-6" />}
                    </div>
                </div>
                <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                            <span className={`font-bold text-gray-200 ${isMain ? 'text-lg' : 'text-sm'}`}>
                                {post.author_name || 'Anonymous'}
                            </span>
                            {post.author_verified && (
                                <span className="bg-blue-500/20 text-blue-400 text-[10px] px-1.5 py-0.5 rounded border border-blue-500/30">
                                    PRO
                                </span>
                            )}
                            <span className="text-gray-500 text-xs">• {timeAgo(post.created_at)}</span>
                        </div>
                        {isMain && (
                            <button className="text-gray-500 hover:text-gray-300">
                                <EllipsisHorizontalIcon className="w-6 h-6" />
                            </button>
                        )}
                    </div>
                    <div
                        className={`prose prose-invert max-w-none text-gray-300 ${isMain ? 'prose-lg' : 'prose-sm'}`}
                        dangerouslySetInnerHTML={{ __html: post.content }}
                    />
                    <div className="flex items-center gap-6 mt-4 pt-4 border-t border-gray-700/30">
                        <button
                            onClick={() => onReact?.(post.id, 'upvote')}
                            className="flex items-center gap-2 text-gray-400 hover:text-green-400 transition-colors text-sm group"
                        >
                            <HandThumbUpIcon className="w-5 h-5 group-hover:scale-110 transition-transform" />
                            <span>{post.upvotes || 0}</span>
                        </button>
                        <button
                            onClick={() => onReact?.(post.id, 'downvote')}
                            className="flex items-center gap-2 text-gray-400 hover:text-red-400 transition-colors text-sm group"
                        >
                            <HandThumbDownIcon className="w-5 h-5 group-hover:scale-110 transition-transform" />
                            <span>{post.downvotes || 0}</span>
                        </button>
                        <button className="flex items-center gap-2 text-gray-400 hover:text-blue-400 transition-colors text-sm group">
                            <ChatBubbleLeftRightIcon className="w-5 h-5 group-hover:scale-110 transition-transform" />
                            <span>Reply</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

const CommunityPost = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [thread, setThread] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [replyContent, setReplyContent] = useState('');
    const [submitting, setSubmitting] = useState(false);

    const fetchThread = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);
            const data = await communityService.getThread(id);
            setThread(data);
        } catch (err) {
            console.error('Failed to fetch thread:', err);
            if (err.response?.status === 404) {
                setError('Post not found. It may have been deleted.');
            } else {
                setError('Failed to load discussion. Please try again.');
            }
        } finally {
            setLoading(false);
        }
    }, [id]);

    useEffect(() => {
        if (id) fetchThread();
    }, [id, fetchThread]);

    const handleReact = async (postId, reactionType) => {
        // Optimistic update - update UI immediately
        setThread(prevThread => {
            if (!prevThread) return prevThread;

            const updatePost = (post) => {
                if (post.id !== postId) return post;
                const prev = post.user_reaction;
                let upvotes = post.upvotes || 0;
                let downvotes = post.downvotes || 0;
                if (prev === 'upvote') upvotes--;
                if (prev === 'downvote') downvotes--;
                if (reactionType === 'upvote') upvotes++;
                if (reactionType === 'downvote') downvotes++;
                return { ...post, user_reaction: reactionType, upvotes: Math.max(0, upvotes), downvotes: Math.max(0, downvotes) };
            };

            return {
                ...prevThread,
                post: updatePost(prevThread.post),
                replies: prevThread.replies?.map(updatePost) || [],
            };
        });

        // API call in background
        try {
            await communityService.addReaction(postId, reactionType);
        } catch (err) {
            console.error('Failed to add reaction:', err);
            fetchThread(); // Revert on error
        }
    };

    const handleSubmitReply = async () => {
        if (!replyContent.trim() || !thread?.post) return;

        try {
            setSubmitting(true);
            // Get room slug from thread context or use a default
            const roomSlug = thread.post.room_slug || 'signal-discussion';
            await communityService.createPost(roomSlug, {
                content: replyContent,
                parent_post_id: parseInt(id)
            });
            setReplyContent('');
            fetchThread(); // Refresh to show new reply
        } catch (err) {
            console.error('Failed to submit reply:', err);
            alert('Failed to post reply. Please try again.');
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-[#0B0C10] flex items-center justify-center">
                <div className="flex flex-col items-center gap-3">
                    <ArrowPathIcon className="w-8 h-8 text-blue-500 animate-spin" />
                    <span className="text-gray-400 text-sm">Loading discussion...</span>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen bg-[#0B0C10] flex items-center justify-center">
                <div className="flex flex-col items-center gap-4 text-center max-w-md">
                    <ExclamationTriangleIcon className="w-12 h-12 text-yellow-500" />
                    <h2 className="text-xl font-bold text-white">Oops!</h2>
                    <p className="text-gray-400">{error}</p>
                    <div className="flex gap-3">
                        <button
                            onClick={() => navigate(-1)}
                            className="px-4 py-2 text-sm bg-gray-800 text-white rounded hover:bg-gray-700"
                        >
                            Go Back
                        </button>
                        <button
                            onClick={fetchThread}
                            className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-500"
                        >
                            Try Again
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#0B0C10] text-gray-200 font-sans p-4 lg:p-8">
            <div className="max-w-4xl mx-auto">
                <button
                    onClick={() => navigate(-1)}
                    className="flex items-center gap-2 text-gray-500 hover:text-white mb-6 transition-colors"
                >
                    <ArrowLeftIcon className="w-4 h-4" />
                    Back to Feed
                </button>

                {thread && (
                    <>
                        <PostCard post={thread.post} isMain={true} onReact={handleReact} />

                        <div className="mb-8 pl-4 lg:pl-16">
                            <h3 className="text-sm font-bold text-gray-500 uppercase tracking-widest mb-4">
                                Replies ({thread.replies?.length || 0})
                            </h3>
                            <div className="space-y-4">
                                {thread.replies?.length > 0 ? (
                                    thread.replies.map(reply => (
                                        <PostCard key={reply.id} post={reply} onReact={handleReact} />
                                    ))
                                ) : (
                                    <p className="text-gray-500 text-sm py-4">
                                        No replies yet. Be the first to respond!
                                    </p>
                                )}
                            </div>
                        </div>

                        {/* Reply Editor */}
                        <div className="pl-4 lg:pl-16">
                            <RichTextEditor
                                content={replyContent}
                                onChange={setReplyContent}
                                placeholder="Write a reply..."
                                minHeight="100px"
                            />
                            <div className="flex justify-end mt-3">
                                <button
                                    onClick={handleSubmitReply}
                                    disabled={submitting || !replyContent.trim()}
                                    className="px-4 py-2 bg-blue-600 text-white rounded text-sm font-medium hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                >
                                    {submitting ? 'Posting...' : 'Post Reply'}
                                </button>
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default CommunityPost;
