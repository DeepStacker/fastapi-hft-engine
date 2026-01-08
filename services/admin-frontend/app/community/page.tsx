'use client';

import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import { 
  MessageSquare, 
  Users,
  Trash2,
  Bookmark,
  Shield,
  Ban,
  BadgeCheck,
  RefreshCw,
  Filter,
  Search,
  Plus,
  Edit,
  Settings,
  ToggleLeft,
  ToggleRight,
  CheckSquare,
  Square,
} from 'lucide-react';

interface Room {
  id: number;
  slug: string;
  name: string;
  description: string;
  room_type: string;
  is_read_only: boolean;
  post_count: number;
  is_active: boolean;
}

interface Post {
  id: number;
  title?: string;
  content: string;
  author_id: string;
  author?: {
    username: string;
    verified_trader: boolean;
  };
  upvotes: number;
  downvotes: number;
  reply_count: number;
  is_pinned: boolean;
  created_at: string;
}

interface LeaderboardEntry {
  user_id: string;
  username: string;
  reputation_score: number;
  trade_accuracy: number;
  verified_trader: boolean;
  is_muted: boolean;
}

export default function CommunityModerationPage() {
  const [activeTab, setActiveTab] = useState<'rooms' | 'posts' | 'users' | 'features'>('rooms');
  const [rooms, setRooms] = useState<Room[]>([]);
  const [selectedRoom, setSelectedRoom] = useState<string | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [featureRequests, setFeatureRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modals
  const [showMuteModal, setShowMuteModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<LeaderboardEntry | null>(null);
  const [muteReason, setMuteReason] = useState('');
  const [muteDuration, setMuteDuration] = useState(24);

  // Room Modal
  const [showRoomModal, setShowRoomModal] = useState(false);
  const [editingRoom, setEditingRoom] = useState<Room | null>(null);
  const [roomForm, setRoomForm] = useState({
    slug: '',
    name: '',
    description: '',
    room_type: 'general',
    is_read_only: false,
  });

  // Bulk Selection for Posts
  const [selectedPosts, setSelectedPosts] = useState<Set<number>>(new Set());

  const fetchRooms = useCallback(async () => {
    try {
      const response = await api.getCommunityRooms();
      setRooms(response.data.rooms || []);
    } catch (err: any) {
      console.error('Failed to fetch rooms:', err);
      setError(err.message || 'Failed to fetch rooms');
    }
  }, []);

  const fetchPosts = useCallback(async (roomSlug: string) => {
    try {
      setLoading(true);
      const response = await api.getCommunityPosts(roomSlug, { page: 1, page_size: 50 });
      setPosts(response.data.posts || []);
    } catch (err: any) {
      console.error('Failed to fetch posts:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchLeaderboard = useCallback(async () => {
    try {
      setLoading(true);
      const response = await api.getCommunityLeaderboard(100);
      setLeaderboard(response.data.entries || []);
    } catch (err: any) {
      console.error('Failed to fetch leaderboard:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchFeatureRequests = useCallback(async () => {
    try {
      setLoading(true);
      const response = await api.getFeatureRequests({ page: 1, page_size: 50 });
      setFeatureRequests(response.data.requests || []);
    } catch (err: any) {
      console.error('Failed to fetch feature requests:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    fetchRooms().finally(() => setLoading(false));
  }, [fetchRooms]);

  useEffect(() => {
    if (activeTab === 'posts' && selectedRoom) {
      fetchPosts(selectedRoom);
    } else if (activeTab === 'users') {
      fetchLeaderboard();
    } else if (activeTab === 'features') {
      fetchFeatureRequests();
    }
  }, [activeTab, selectedRoom, fetchPosts, fetchLeaderboard, fetchFeatureRequests]);

  const handleDeletePost = async (postId: number) => {
    if (!confirm('Are you sure you want to delete this post?')) return;
    try {
      await api.deleteCommunityPost(postId);
      setPosts(posts.filter(p => p.id !== postId));
    } catch (err) {
      console.error('Failed to delete post:', err);
    }
  };

  const handlePinPost = async (postId: number, currentlyPinned: boolean) => {
    try {
      await api.pinCommunityPost(postId, !currentlyPinned);
      setPosts(posts.map(p => p.id === postId ? { ...p, is_pinned: !currentlyPinned } : p));
    } catch (err) {
      console.error('Failed to pin post:', err);
    }
  };

  const handleMuteUser = async () => {
    if (!selectedUser) return;
    try {
      await api.muteUser(selectedUser.user_id, muteDuration, muteReason);
      setLeaderboard(leaderboard.map(u => 
        u.user_id === selectedUser.user_id ? { ...u, is_muted: true } : u
      ));
      setShowMuteModal(false);
      setMuteReason('');
    } catch (err) {
      console.error('Failed to mute user:', err);
    }
  };

  const handleUnmuteUser = async (userId: string) => {
    try {
      await api.unmuteUser(userId);
      setLeaderboard(leaderboard.map(u => 
        u.user_id === userId ? { ...u, is_muted: false } : u
      ));
    } catch (err) {
      console.error('Failed to unmute user:', err);
    }
  };

  const handleVerifyTrader = async (userId: string) => {
    try {
      await api.verifyTrader(userId);
      setLeaderboard(leaderboard.map(u => 
        u.user_id === userId ? { ...u, verified_trader: true } : u
      ));
    } catch (err) {
      console.error('Failed to verify trader:', err);
    }
  };

  const handleUpdateFeatureStatus = async (featureId: number, status: string) => {
    try {
      await api.updateFeatureRequest(featureId, { status });
      setFeatureRequests(featureRequests.map(f => 
        f.id === featureId ? { ...f, status } : f
      ));
    } catch (err) {
      console.error('Failed to update feature status:', err);
    }
  };

  // ═══════════════════════════════════════════════════════════════════
  // Room CRUD Handlers
  // ═══════════════════════════════════════════════════════════════════

  const openCreateRoomModal = () => {
    setEditingRoom(null);
    setRoomForm({ slug: '', name: '', description: '', room_type: 'general', is_read_only: false });
    setShowRoomModal(true);
  };

  const openEditRoomModal = (room: Room) => {
    setEditingRoom(room);
    setRoomForm({
      slug: room.slug,
      name: room.name,
      description: room.description || '',
      room_type: room.room_type,
      is_read_only: room.is_read_only,
    });
    setShowRoomModal(true);
  };

  const handleSaveRoom = async () => {
    try {
      if (editingRoom) {
        await api.updateCommunityRoom(editingRoom.id, roomForm);
      } else {
        await api.createCommunityRoom(roomForm);
      }
      setShowRoomModal(false);
      fetchRooms();
    } catch (err) {
      console.error('Failed to save room:', err);
    }
  };

  const handleToggleRoomActive = async (room: Room) => {
    try {
      await api.updateCommunityRoom(room.id, { is_active: !room.is_active });
      setRooms(rooms.map(r => r.id === room.id ? { ...r, is_active: !r.is_active } : r));
    } catch (err) {
      console.error('Failed to toggle room:', err);
    }
  };

  // ═══════════════════════════════════════════════════════════════════
  // Bulk Post Actions
  // ═══════════════════════════════════════════════════════════════════

  const togglePostSelection = (postId: number) => {
    setSelectedPosts(prev => {
      const next = new Set(prev);
      if (next.has(postId)) {
        next.delete(postId);
      } else {
        next.add(postId);
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedPosts.size === posts.length) {
      setSelectedPosts(new Set());
    } else {
      setSelectedPosts(new Set(posts.map(p => p.id)));
    }
  };

  const handleBulkDelete = async () => {
    if (!confirm(`Delete ${selectedPosts.size} posts? This cannot be undone.`)) return;
    try {
      await Promise.all(Array.from(selectedPosts).map(id => api.deleteCommunityPost(id)));
      setPosts(posts.filter(p => !selectedPosts.has(p.id)));
      setSelectedPosts(new Set());
    } catch (err) {
      console.error('Failed to bulk delete:', err);
    }
  };

  const handleBulkPin = async (shouldPin: boolean) => {
    try {
      await Promise.all(Array.from(selectedPosts).map(id => api.pinCommunityPost(id, shouldPin)));
      setPosts(posts.map(p => selectedPosts.has(p.id) ? { ...p, is_pinned: shouldPin } : p));
      setSelectedPosts(new Set());
    } catch (err) {
      console.error('Failed to bulk pin:', err);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white flex items-center gap-3">
          <Users className="w-8 h-8 text-blue-500" />
          Community Moderation
        </h1>
        <p className="text-gray-400 mt-1">Manage posts, users, and community settings</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 border-b border-gray-700 pb-2">
        {[
          { id: 'rooms', label: 'Rooms', icon: MessageSquare },
          { id: 'posts', label: 'Posts', icon: MessageSquare },
          { id: 'users', label: 'Users', icon: Users },
          { id: 'features', label: 'Feature Requests', icon: Shield },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
              activeTab === tab.id
                ? 'bg-blue-600 text-white'
                : 'text-gray-400 hover:bg-gray-800 hover:text-white'
            }`}
          >
            <tab.icon className="w-5 h-5" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Loading State */}
      {loading && (
        <div className="flex justify-center py-12">
          <RefreshCw className="w-8 h-8 text-blue-500 animate-spin" />
        </div>
      )}

      {/* Rooms Tab */}
      {activeTab === 'rooms' && !loading && (
        <div>
          {/* Header with Create Button */}
          <div className="flex items-center justify-between mb-6">
            <span className="text-gray-400">{rooms.length} rooms</span>
            <button
              onClick={openCreateRoomModal}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Create Room
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {rooms.map(room => (
              <div
                key={room.id}
                className="bg-gray-800 border border-gray-700 rounded-xl p-4 hover:border-gray-600 transition-colors"
              >
                <div className="flex items-start justify-between mb-2">
                  <h3 className="font-semibold text-white">{room.name}</h3>
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 text-xs rounded ${
                      room.is_active ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                    }`}>
                      {room.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                </div>
                <p className="text-sm text-gray-400 mb-3 line-clamp-2">{room.description}</p>
                <div className="flex items-center gap-2 mb-3 text-xs text-gray-500">
                  <span className="px-2 py-0.5 bg-gray-900 rounded">{room.room_type}</span>
                  {room.is_read_only && <span className="px-2 py-0.5 bg-orange-500/20 text-orange-400 rounded">Read Only</span>}
                </div>
                <div className="flex items-center justify-between pt-3 border-t border-gray-700">
                  <span className="text-gray-500 text-sm">{room.post_count} posts</span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleToggleRoomActive(room)}
                      className={`p-1.5 rounded transition-colors ${room.is_active ? 'text-green-400 hover:bg-green-500/20' : 'text-gray-500 hover:bg-gray-700'}`}
                      title={room.is_active ? 'Deactivate' : 'Activate'}
                    >
                      {room.is_active ? <ToggleRight className="w-5 h-5" /> : <ToggleLeft className="w-5 h-5" />}
                    </button>
                    <button
                      onClick={() => openEditRoomModal(room)}
                      className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-700 rounded transition-colors"
                      title="Edit"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => {
                        setSelectedRoom(room.slug);
                        setActiveTab('posts');
                      }}
                      className="text-blue-400 hover:text-blue-300 text-sm ml-2"
                    >
                      View →
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Posts Tab */}
      {activeTab === 'posts' && !loading && (
        <div>
          {/* Room Selector + Bulk Actions */}
          <div className="mb-4 flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="flex items-center gap-4">
              <label className="text-gray-400">Room:</label>
              <select
                value={selectedRoom || ''}
                onChange={(e) => { setSelectedRoom(e.target.value); setSelectedPosts(new Set()); }}
                className="bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white"
              >
                <option value="">Select a room</option>
                {rooms.map(room => (
                  <option key={room.slug} value={room.slug}>{room.name}</option>
                ))}
              </select>
            </div>

            {/* Bulk Actions Bar */}
            {selectedRoom && posts.length > 0 && (
              <div className="flex items-center gap-2 ml-auto bg-gray-800 border border-gray-700 rounded-lg p-1">
                <button
                  onClick={toggleSelectAll}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-400 hover:text-white hover:bg-gray-700 rounded transition-colors"
                >
                  {selectedPosts.size === posts.length ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
                  {selectedPosts.size === posts.length ? 'Deselect All' : 'Select All'}
                </button>
                {selectedPosts.size > 0 && (
                  <>
                    <div className="w-px h-5 bg-gray-600" />
                    <span className="text-xs text-blue-400 px-2">{selectedPosts.size} selected</span>
                    <button
                      onClick={() => handleBulkPin(true)}
                      className="px-3 py-1.5 text-xs text-amber-400 hover:bg-amber-500/20 rounded transition-colors"
                    >
                      Pin All
                    </button>
                    <button
                      onClick={() => handleBulkPin(false)}
                      className="px-3 py-1.5 text-xs text-gray-400 hover:bg-gray-700 rounded transition-colors"
                    >
                      Unpin All
                    </button>
                    <button
                      onClick={handleBulkDelete}
                      className="px-3 py-1.5 text-xs text-red-400 hover:bg-red-500/20 rounded transition-colors"
                    >
                      Delete All
                    </button>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Posts List */}
          <div className="space-y-3">
            {posts.map(post => (
              <div
                key={post.id}
                className={`bg-gray-800 border rounded-xl p-4 ${
                  post.is_pinned ? 'border-amber-500/50' : 'border-gray-700'
                } ${selectedPosts.has(post.id) ? 'ring-1 ring-blue-500' : ''}`}
              >
                <div className="flex items-start gap-3">
                  {/* Checkbox */}
                  <button
                    onClick={() => togglePostSelection(post.id)}
                    className="mt-1 flex-shrink-0"
                  >
                    {selectedPosts.has(post.id) ? (
                      <CheckSquare className="w-5 h-5 text-blue-500" />
                    ) : (
                      <Square className="w-5 h-5 text-gray-500 hover:text-gray-300" />
                    )}
                  </button>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="font-medium text-white">
                        {post.author?.username || 'Unknown'}
                      </span>
                      {post.author?.verified_trader && (
                        <BadgeCheck className="w-4 h-4 text-blue-500" />
                      )}
                      <span className="text-gray-500 text-sm">
                        {formatDate(post.created_at)}
                      </span>
                    </div>
                    {post.title && (
                      <h4 className="font-semibold text-white mb-1">{post.title}</h4>
                    )}
                    <p className="text-gray-300 text-sm line-clamp-2">{post.content}</p>
                    <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
                      <span>👍 {post.upvotes}</span>
                      <span>👎 {post.downvotes}</span>
                      <span>💬 {post.reply_count}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handlePinPost(post.id, post.is_pinned)}
                      className={`p-2 rounded-lg transition-colors ${
                        post.is_pinned ? 'text-amber-500 bg-amber-500/20' : 'text-gray-400 hover:bg-gray-700'
                      }`}
                      title={post.is_pinned ? 'Unpin' : 'Pin'}
                    >
                      {post.is_pinned ? (
                        <Bookmark className="w-5 h-5 fill-current" />
                      ) : (
                        <Bookmark className="w-5 h-5" />
                      )}
                    </button>
                    <button
                      onClick={() => handleDeletePost(post.id)}
                      className="p-2 text-red-400 hover:bg-red-500/20 rounded-lg transition-colors"
                      title="Delete"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
            {posts.length === 0 && selectedRoom && (
              <p className="text-center text-gray-500 py-8">No posts in this room yet.</p>
            )}
            {!selectedRoom && (
              <p className="text-center text-gray-500 py-8">Select a room to view posts.</p>
            )}
          </div>
        </div>
      )}

      {/* Users Tab */}
      {activeTab === 'users' && !loading && (
        <div className="bg-gray-800 border border-gray-700 rounded-xl overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-900">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-400">User</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-400">Reputation</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-400">Accuracy</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-400">Status</th>
                <th className="px-4 py-3 text-right text-sm font-medium text-gray-400">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700">
              {leaderboard.map(user => (
                <tr key={user.user_id} className="hover:bg-gray-750">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="text-white font-medium">{user.username}</span>
                      {user.verified_trader && (
                        <BadgeCheck className="w-4 h-4 text-blue-500" />
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-emerald-400 font-semibold">
                    {user.reputation_score}
                  </td>
                  <td className="px-4 py-3 text-gray-300">
                    {user.trade_accuracy.toFixed(1)}%
                  </td>
                  <td className="px-4 py-3">
                    {user.is_muted ? (
                      <span className="px-2 py-0.5 text-xs bg-red-500/20 text-red-400 rounded">Muted</span>
                    ) : (
                      <span className="px-2 py-0.5 text-xs bg-green-500/20 text-green-400 rounded">Active</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {!user.verified_trader && (
                        <button
                          onClick={() => handleVerifyTrader(user.user_id)}
                          className="px-3 py-1 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                        >
                          Verify
                        </button>
                      )}
                      {user.is_muted ? (
                        <button
                          onClick={() => handleUnmuteUser(user.user_id)}
                          className="px-3 py-1 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700"
                        >
                          Unmute
                        </button>
                      ) : (
                        <button
                          onClick={() => {
                            setSelectedUser(user);
                            setShowMuteModal(true);
                          }}
                          className="px-3 py-1 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700"
                        >
                          Mute
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {leaderboard.length === 0 && (
            <p className="text-center text-gray-500 py-8">No users with reputation yet.</p>
          )}
        </div>
      )}

      {/* Feature Requests Tab */}
      {activeTab === 'features' && !loading && (
        <div className="space-y-4">
          {featureRequests.map(feature => (
            <div
              key={feature.id}
              className="bg-gray-800 border border-gray-700 rounded-xl p-4"
            >
              <div className="flex items-start justify-between mb-2">
                <div>
                  <h3 className="font-semibold text-white">{feature.title}</h3>
                  <p className="text-sm text-gray-400 mt-1">{feature.description}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-emerald-400 font-semibold">
                    {feature.vote_count} votes
                  </span>
                </div>
              </div>
              <div className="flex items-center justify-between mt-4">
                <div className="flex items-center gap-2">
                  <span className="text-gray-500 text-sm">Status:</span>
                  <select
                    value={feature.status}
                    onChange={(e) => handleUpdateFeatureStatus(feature.id, e.target.value)}
                    className="bg-gray-900 border border-gray-700 rounded px-2 py-1 text-sm text-white"
                  >
                    <option value="PENDING">Pending</option>
                    <option value="UNDER_REVIEW">Under Review</option>
                    <option value="PLANNED">Planned</option>
                    <option value="IN_PROGRESS">In Progress</option>
                    <option value="COMPLETED">Completed</option>
                    <option value="REJECTED">Rejected</option>
                  </select>
                </div>
                <span className="text-gray-500 text-sm">
                  by {feature.author?.username || 'Unknown'} · {formatDate(feature.created_at)}
                </span>
              </div>
            </div>
          ))}
          {featureRequests.length === 0 && (
            <p className="text-center text-gray-500 py-8">No feature requests yet.</p>
          )}
        </div>
      )}

      {/* Mute Modal */}
      {showMuteModal && selectedUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-gray-800 border border-gray-700 rounded-xl p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold text-white mb-4">
              Mute User: {selectedUser.username}
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Duration (hours)</label>
                <input
                  type="number"
                  value={muteDuration}
                  onChange={(e) => setMuteDuration(parseInt(e.target.value))}
                  className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-white"
                  min="1"
                  max="720"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Reason</label>
                <textarea
                  value={muteReason}
                  onChange={(e) => setMuteReason(e.target.value)}
                  className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-white resize-none"
                  rows={3}
                  placeholder="Enter reason for muting..."
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowMuteModal(false)}
                className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleMuteUser}
                disabled={!muteReason.trim()}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                Mute User
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Room Create/Edit Modal */}
      {showRoomModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-gray-800 border border-gray-700 rounded-xl p-6 w-full max-w-lg">
            <h3 className="text-lg font-semibold text-white mb-4">
              {editingRoom ? 'Edit Room' : 'Create New Room'}
            </h3>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Slug *</label>
                  <input
                    type="text"
                    value={roomForm.slug}
                    onChange={(e) => setRoomForm({ ...roomForm, slug: e.target.value.toLowerCase().replace(/\s+/g, '-') })}
                    className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-white"
                    placeholder="signal-discussion"
                    disabled={!!editingRoom}
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Room Type *</label>
                  <select
                    value={roomForm.room_type}
                    onChange={(e) => setRoomForm({ ...roomForm, room_type: e.target.value })}
                    className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-white"
                  >
                    <option value="general">General</option>
                    <option value="trade_breakdown">Trade Breakdown</option>
                    <option value="strategy">Strategy</option>
                    <option value="market_outlook">Market Outlook</option>
                    <option value="platform_feedback">Platform Feedback</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Name *</label>
                <input
                  type="text"
                  value={roomForm.name}
                  onChange={(e) => setRoomForm({ ...roomForm, name: e.target.value })}
                  className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-white"
                  placeholder="Signal Discussion"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Description</label>
                <textarea
                  value={roomForm.description}
                  onChange={(e) => setRoomForm({ ...roomForm, description: e.target.value })}
                  className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-white resize-none"
                  rows={3}
                  placeholder="Describe this room..."
                />
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setRoomForm({ ...roomForm, is_read_only: !roomForm.is_read_only })}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors ${
                    roomForm.is_read_only 
                      ? 'bg-orange-500/20 border-orange-500/30 text-orange-400' 
                      : 'bg-gray-900 border-gray-700 text-gray-400'
                  }`}
                >
                  {roomForm.is_read_only ? <ToggleRight className="w-5 h-5" /> : <ToggleLeft className="w-5 h-5" />}
                  Read Only
                </button>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowRoomModal(false)}
                className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveRoom}
                disabled={!roomForm.slug || !roomForm.name}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {editingRoom ? 'Save Changes' : 'Create Room'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
