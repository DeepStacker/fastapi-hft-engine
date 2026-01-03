'use client';

import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { 
  Bell, 
  Send, 
  Users, 
  User, 
  AlertCircle, 
  CheckCircle, 
  Info, 
  AlertTriangle,
  Loader2,
  Search,
  Clock,
  ExternalLink,
  Smartphone,
  Check,
  History,
  Layout,
  Trash2,
  Plus,
  Edit3,
  BarChart3,
  FileText,
  ChevronLeft,
  ChevronRight,
  Eye,
  Zap,
  TrendingUp
} from 'lucide-react';
import { toast } from '@/components/ui/Toaster';

interface NotificationStats {
  total_sent: number;
  unread_count: number;
  users_with_notifications: number;
}

interface UserOption {
  id: string;
  email: string;
  username: string;
}

interface HistoryEntry {
  id: string;
  title: string;
  message: string;
  type: string;
  target: string;
  target_email?: string;
  link?: string;
  sent_count: number;
  sent_by?: string;
  created_at: string;
}

interface Template {
  id: string;
  name: string;
  title: string;
  message: string;
  type: string;
  link?: string;
  created_at?: string;
  created_by?: string;
}

interface Analytics {
  total_broadcasts: number;
  period_broadcasts: number;
  total_notifications_sent: number;
  total_notifications_in_db: number;
  read_count: number;
  unread_count: number;
  read_rate_percent: number;
  by_type: Record<string, number>;
  by_target: Record<string, number>;
  daily_stats: { date: string; broadcasts: number; sent: number }[];
}

const notificationTypes = [
  { value: 'info', label: 'Info', icon: Info, color: 'text-blue-500', bg: 'bg-blue-500/10' },
  { value: 'success', label: 'Success', icon: CheckCircle, color: 'text-green-500', bg: 'bg-green-500/10' },
  { value: 'warning', label: 'Warning', icon: AlertTriangle, color: 'text-yellow-500', bg: 'bg-yellow-500/10' },
  { value: 'error', label: 'Error', icon: AlertCircle, color: 'text-red-500', bg: 'bg-red-500/10' },
];

const tabs = [
  { id: 'compose', label: 'Compose', icon: Send },
  { id: 'history', label: 'History', icon: History },
  { id: 'templates', label: 'Templates', icon: FileText },
  { id: 'analytics', label: 'Analytics', icon: BarChart3 },
];

export default function NotificationsPage() {
  const [activeTab, setActiveTab] = useState('compose');
  const [stats, setStats] = useState<NotificationStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  
  // Compose form state
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [type, setType] = useState('info');
  const [target, setTarget] = useState<'all' | 'user'>('all');
  const [userEmail, setUserEmail] = useState('');
  const [link, setLink] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');
  
  // User search
  const [userSearch, setUserSearch] = useState('');
  const [userResults, setUserResults] = useState<UserOption[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);

  // History state
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [historyPage, setHistoryPage] = useState(1);
  const [historyTotal, setHistoryTotal] = useState(0);
  const [historyPages, setHistoryPages] = useState(0);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [selectedHistory, setSelectedHistory] = useState<Set<string>>(new Set());

  // Templates state
  const [templates, setTemplates] = useState<Template[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
  const [newTemplate, setNewTemplate] = useState({ name: '', title: '', message: '', type: 'info', link: '' });
  const [showNewTemplate, setShowNewTemplate] = useState(false);

  // Analytics state
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);

  useEffect(() => {
    loadStats();
    loadTemplates();
  }, []);

  useEffect(() => {
    if (activeTab === 'history') loadHistory();
    if (activeTab === 'analytics') loadAnalytics();
  }, [activeTab, historyPage]);

  const loadStats = async () => {
    try {
      const response = await api.getNotificationStats();
      setStats(response.data);
    } catch (error) {
      console.error('Failed to load stats:', error);
    }
  };

  const loadHistory = async () => {
    try {
      setHistoryLoading(true);
      const response = await api.getNotificationHistory({ page: historyPage, limit: 10 });
      setHistory(response.data.history || []);
      setHistoryTotal(response.data.total || 0);
      setHistoryPages(response.data.pages || 0);
    } catch (error) {
      console.error('Failed to load history:', error);
    } finally {
      setHistoryLoading(false);
    }
  };

  const loadTemplates = async () => {
    try {
      setTemplatesLoading(true);
      const response = await api.getNotificationTemplates();
      setTemplates(response.data.templates || []);
    } catch (error) {
      console.error('Failed to load templates:', error);
    } finally {
      setTemplatesLoading(false);
    }
  };

  const loadAnalytics = async () => {
    try {
      setAnalyticsLoading(true);
      const response = await api.getNotificationAnalytics(30);
      setAnalytics(response.data);
    } catch (error) {
      console.error('Failed to load analytics:', error);
    } finally {
      setAnalyticsLoading(false);
    }
  };

  const searchUsers = async (query: string) => {
    if (!query.trim()) {
      setUserResults([]);
      return;
    }
    try {
      setSearchLoading(true);
      const response = await api.getUsersForNotification(query);
      setUserResults(response.data.users || []);
    } catch (error) {
      console.error('Failed to search users:', error);
    } finally {
      setSearchLoading(false);
    }
  };

  const handleSend = async () => {
    if (!title.trim() || !message.trim()) {
      toast.error('Title and message are required');
      return;
    }
    if (target === 'user' && !userEmail.trim()) {
      toast.error('Please select a user');
      return;
    }
    try {
      setSending(true);
      const response = await api.broadcastNotification({
        title,
        message,
        type,
        target,
        user_email: target === 'user' ? userEmail : undefined,
        link: link.trim() || undefined,
      });
      toast.success(response.data.message);
      // Reset form
      setTitle('');
      setMessage('');
      setType('info');
      setTarget('all');
      setUserEmail('');
      setLink('');
      setUserSearch('');
      setSelectedTemplate('');
      loadStats();
      loadHistory();
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Failed to send notification');
    } finally {
      setSending(false);
    }
  };

  const handleCreateTemplate = async () => {
    if (!newTemplate.name.trim() || !newTemplate.title.trim() || !newTemplate.message.trim()) {
      toast.error('Name, title and message are required');
      return;
    }
    try {
      await api.createNotificationTemplate(newTemplate);
      toast.success('Template created');
      setNewTemplate({ name: '', title: '', message: '', type: 'info', link: '' });
      setShowNewTemplate(false);
      loadTemplates();
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Failed to create template');
    }
  };

  const handleDeleteTemplate = async (id: string) => {
    try {
      await api.deleteNotificationTemplate(id);
      toast.success('Template deleted');
      loadTemplates();
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Failed to delete template');
    }
  };

  const applyTemplate = (template: Template) => {
    setTitle(template.title);
    setMessage(template.message);
    setType(template.type);
    setLink(template.link || '');
    setSelectedTemplate(template.id);
    setActiveTab('compose');
    toast.success(`Template "${template.name}" applied`);
  };

  const handleDeleteHistory = async (id: string) => {
    try {
      await api.deleteHistoryEntry(id);
      toast.success('History entry deleted');
      loadHistory();
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Failed to delete');
    }
  };

  const handleBulkDeleteHistory = async () => {
    if (selectedHistory.size === 0) return;
    try {
      await api.bulkDeleteHistory(Array.from(selectedHistory));
      toast.success(`Deleted ${selectedHistory.size} entries`);
      setSelectedHistory(new Set());
      loadHistory();
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Failed to delete');
    }
  };

  const selectedType = notificationTypes.find(t => t.value === type) || notificationTypes[0];

  const formatDate = (isoString: string) => {
    const date = new Date(isoString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  };

  return (
    <div className="space-y-6 p-6 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-3xl bg-gradient-to-br from-gray-900 via-gray-900 to-blue-900 border border-white/5 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-blue-600/10 rounded-full blur-[100px] -mr-32 -mt-32" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-purple-600/10 rounded-full blur-[100px] -ml-32 -mb-32" />
        
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-blue-600 rounded-lg shadow-lg shadow-blue-600/20">
              <Bell className="h-6 w-6 text-white" />
            </div>
            <h1 className="text-3xl font-black text-white tracking-tight">Broadcast Center</h1>
          </div>
          <p className="text-blue-100/60 font-medium">Send real-time updates and alerts to your trading community</p>
        </div>
        
        <div className="flex gap-4 relative z-10">
          <div className="px-5 py-3 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md">
            <p className="text-[10px] font-black uppercase tracking-widest text-blue-400 mb-1">Total Broadcasts</p>
            <p className="text-2xl font-bold text-white leading-none">{stats?.total_sent || 0}</p>
          </div>
          <div className="px-5 py-3 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md">
            <p className="text-[10px] font-black uppercase tracking-widest text-green-400 mb-1">Users Reached</p>
            <p className="text-2xl font-bold text-white leading-none">{stats?.users_with_notifications || 0}</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex p-1.5 rounded-2xl bg-gray-100 dark:bg-black/40 border border-gray-200 dark:border-white/5">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl transition-all font-bold text-sm ${
              activeTab === tab.id 
                ? 'bg-white dark:bg-blue-600 shadow-lg text-blue-600 dark:text-white' 
                : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <AnimatePresence mode="wait">
        {activeTab === 'compose' && (
          <motion.div
            key="compose"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="grid grid-cols-1 lg:grid-cols-3 gap-6"
          >
            {/* Compose Form */}
            <div className="lg:col-span-2">
              <Card className="rounded-3xl border-0 shadow-xl">
                <CardHeader className="bg-gray-50/50 dark:bg-white/5 p-6 border-b border-gray-100 dark:border-white/5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-blue-600/10 flex items-center justify-center">
                        <Layout className="h-5 w-5 text-blue-600" />
                      </div>
                      <div>
                        <CardTitle>Compose Notification</CardTitle>
                        <CardDescription>Craft your message for targeted impact</CardDescription>
                      </div>
                    </div>
                    {templates.length > 0 && (
                      <select
                        value={selectedTemplate}
                        onChange={(e) => {
                          const tmpl = templates.find(t => t.id === e.target.value);
                          if (tmpl) applyTemplate(tmpl);
                        }}
                        className="px-3 py-2 rounded-lg border border-gray-200 dark:border-white/10 dark:bg-black/20 text-sm"
                      >
                        <option value="">Use Template...</option>
                        {templates.map(t => (
                          <option key={t.id} value={t.id}>{t.name}</option>
                        ))}
                      </select>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="p-6 space-y-6">
                  {/* Target Selection */}
                  <div className="space-y-3">
                    <label className="text-xs font-bold uppercase tracking-wider text-gray-400">Target</label>
                    <div className="flex p-1 rounded-xl bg-gray-100 dark:bg-black/40 border border-gray-200 dark:border-white/5">
                      <button
                        onClick={() => setTarget('all')}
                        className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-lg transition-all font-bold text-sm ${
                          target === 'all' 
                            ? 'bg-white dark:bg-blue-600 shadow text-blue-600 dark:text-white' 
                            : 'text-gray-500'
                        }`}
                      >
                        <Users className="h-4 w-4" />
                        Broadcast to All
                      </button>
                      <button
                        onClick={() => setTarget('user')}
                        className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-lg transition-all font-bold text-sm ${
                          target === 'user' 
                            ? 'bg-white dark:bg-blue-600 shadow text-blue-600 dark:text-white' 
                            : 'text-gray-500'
                        }`}
                      >
                        <User className="h-4 w-4" />
                        Specific User
                      </button>
                    </div>
                  </div>

                  {/* User Search */}
                  {target === 'user' && (
                    <div className="relative">
                      <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                      <Input
                        placeholder="Search users by email..."
                        value={userSearch}
                        onChange={(e) => {
                          setUserSearch(e.target.value);
                          searchUsers(e.target.value);
                        }}
                        className="pl-12 py-6 rounded-xl"
                      />
                      {userResults.length > 0 && (
                        <div className="absolute z-50 w-full mt-2 rounded-xl bg-white dark:bg-gray-800 shadow-xl border border-gray-100 dark:border-white/10 overflow-hidden">
                          {userResults.map((user) => (
                            <button
                              key={user.id}
                              onClick={() => {
                                setUserEmail(user.email);
                                setUserSearch(user.email);
                                setUserResults([]);
                              }}
                              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-blue-50 dark:hover:bg-blue-600/10 text-left border-b last:border-0 dark:border-white/5"
                            >
                              <div className="w-8 h-8 rounded-full bg-blue-600/10 flex items-center justify-center text-blue-600 font-bold text-sm">
                                {user.username.charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <p className="font-bold text-sm">{user.email}</p>
                                <p className="text-xs text-gray-500">{user.username}</p>
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Type Selection */}
                  <div className="space-y-3">
                    <label className="text-xs font-bold uppercase tracking-wider text-gray-400">Type</label>
                    <div className="grid grid-cols-4 gap-2">
                      {notificationTypes.map((t) => (
                        <button
                          key={t.value}
                          onClick={() => setType(t.value)}
                          className={`flex items-center gap-2 p-3 rounded-xl border-2 transition-all ${
                            type === t.value 
                              ? 'border-blue-600 bg-blue-600/5' 
                              : 'border-gray-100 dark:border-white/5 hover:border-blue-500/50'
                          }`}
                        >
                          <div className={`p-1.5 rounded-lg ${t.bg} ${t.color}`}>
                            <t.icon className="h-3 w-3" />
                          </div>
                          <span className="text-xs font-bold">{t.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Title & Message */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-3">
                      <label className="text-xs font-bold uppercase tracking-wider text-gray-400">Title</label>
                      <Input
                        placeholder="Notification title..."
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        className="py-6 rounded-xl"
                      />
                    </div>
                    <div className="space-y-3">
                      <label className="text-xs font-bold uppercase tracking-wider text-gray-400">Link (Optional)</label>
                      <div className="relative">
                        <ExternalLink className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <Input
                          placeholder="/dashboard or https://..."
                          value={link}
                          onChange={(e) => setLink(e.target.value)}
                          className="pl-12 py-6 rounded-xl"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <label className="text-xs font-bold uppercase tracking-wider text-gray-400">Message</label>
                    <textarea
                      placeholder="Your notification message..."
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      className="w-full h-32 p-4 rounded-xl border border-gray-200 dark:border-white/10 dark:bg-black/20 resize-none"
                    />
                    <p className="text-xs text-gray-400 text-right">{message.length}/500</p>
                  </div>

                  <Button 
                    onClick={handleSend} 
                    disabled={sending || !title.trim() || !message.trim()}
                    className="w-full py-6 rounded-xl bg-blue-600 hover:bg-blue-700 shadow-lg text-lg font-bold"
                  >
                    {sending ? (
                      <>
                        <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                        Sending...
                      </>
                    ) : (
                      <>
                        <Send className="h-5 w-5 mr-2" />
                        Send Notification
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>
            </div>

            {/* Live Preview */}
            <div className="space-y-6">
              <div className="sticky top-6">
                <div className="flex items-center gap-2 mb-4">
                  <Smartphone className="h-4 w-4 text-gray-400" />
                  <h3 className="text-xs font-black uppercase tracking-widest text-gray-400">Live Preview</h3>
                </div>
                
                <div className="relative mx-auto w-full max-w-[280px] aspect-[9/18] rounded-[2.5rem] border-[10px] border-gray-900 shadow-2xl bg-gray-900 overflow-hidden">
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 w-28 h-6 bg-gray-900 rounded-b-xl z-20" />
                  <div className="absolute inset-0 bg-gradient-to-b from-blue-900/80 via-gray-950 to-black" />
                  
                  <div className="relative z-10 p-4 pt-20">
                    <div className="rounded-2xl bg-white/10 backdrop-blur-xl border border-white/20 p-4 shadow-xl">
                      <div className="flex items-center gap-3 mb-3">
                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${selectedType.bg} ${selectedType.color}`}>
                          <Bell className="h-4 w-4" />
                        </div>
                        <div className="flex-1">
                          <p className="text-[8px] font-bold text-white/80 uppercase tracking-widest">DeepStrike</p>
                          <p className="text-[7px] text-white/40">Now</p>
                        </div>
                      </div>
                      <h4 className="text-sm font-bold text-white mb-1">{title || 'Your Title'}</h4>
                      <p className="text-[10px] text-blue-100/70 line-clamp-3">{message || 'Your message will appear here...'}</p>
                      {link && (
                        <div className="mt-3 pt-3 border-t border-white/10">
                          <span className="text-[8px] font-bold text-blue-400 uppercase tracking-widest">Tap to view</span>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-28 h-1 bg-white/20 rounded-full" />
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {activeTab === 'history' && (
          <motion.div
            key="history"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            <Card className="rounded-3xl border-0 shadow-xl">
              <CardHeader className="p-6 flex flex-row items-center justify-between">
                <div className="flex items-center gap-3">
                  <History className="h-5 w-5 text-gray-400" />
                  <div>
                    <CardTitle>Broadcast History</CardTitle>
                    <CardDescription>{historyTotal} total broadcasts</CardDescription>
                  </div>
                </div>
                {selectedHistory.size > 0 && (
                  <Button variant="destructive" size="sm" onClick={handleBulkDeleteHistory}>
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete Selected ({selectedHistory.size})
                  </Button>
                )}
              </CardHeader>
              <CardContent className="p-0">
                {historyLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
                  </div>
                ) : history.length === 0 ? (
                  <div className="text-center py-12 text-gray-400">
                    <Bell className="h-12 w-12 mx-auto mb-4 opacity-30" />
                    <p>No broadcasts yet</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="border-y border-gray-100 dark:border-white/5 bg-gray-50/50 dark:bg-black/40">
                        <tr>
                          <th className="px-6 py-4 w-10">
                            <input
                              type="checkbox"
                              checked={selectedHistory.size === history.length}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedHistory(new Set(history.map(h => h.id)));
                                } else {
                                  setSelectedHistory(new Set());
                                }
                              }}
                              className="rounded"
                            />
                          </th>
                          <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider text-gray-400">Time</th>
                          <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider text-gray-400">Content</th>
                          <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider text-gray-400">Type</th>
                          <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider text-gray-400">Target</th>
                          <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider text-gray-400">Sent</th>
                          <th className="px-6 py-4 w-20"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50 dark:divide-white/5">
                        {history.map((entry) => {
                          const typeInfo = notificationTypes.find(t => t.value === entry.type) || notificationTypes[0];
                          return (
                            <tr key={entry.id} className="hover:bg-blue-500/5 transition-colors">
                              <td className="px-6 py-4">
                                <input
                                  type="checkbox"
                                  checked={selectedHistory.has(entry.id)}
                                  onChange={(e) => {
                                    const next = new Set(selectedHistory);
                                    if (e.target.checked) {
                                      next.add(entry.id);
                                    } else {
                                      next.delete(entry.id);
                                    }
                                    setSelectedHistory(next);
                                  }}
                                  className="rounded"
                                />
                              </td>
                              <td className="px-6 py-4 text-sm text-gray-500 whitespace-nowrap">
                                {entry.created_at ? formatDate(entry.created_at) : '-'}
                              </td>
                              <td className="px-6 py-4">
                                <p className="font-bold text-sm">{entry.title}</p>
                                <p className="text-xs text-gray-500 line-clamp-1 max-w-[250px]">{entry.message}</p>
                              </td>
                              <td className="px-6 py-4">
                                <Badge className={`${typeInfo.bg} ${typeInfo.color} border-0`}>
                                  {entry.type.toUpperCase()}
                                </Badge>
                              </td>
                              <td className="px-6 py-4">
                                <div className="flex items-center gap-2">
                                  {entry.target === 'all' ? (
                                    <Users className="w-3 h-3 text-blue-500" />
                                  ) : (
                                    <User className="w-3 h-3 text-purple-500" />
                                  )}
                                  <span className="text-xs font-bold uppercase">
                                    {entry.target === 'all' ? 'All' : entry.target_email || 'User'}
                                  </span>
                                </div>
                              </td>
                              <td className="px-6 py-4 text-sm font-bold">{entry.sent_count}</td>
                              <td className="px-6 py-4">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleDeleteHistory(entry.id)}
                                  className="text-gray-400 hover:text-red-500"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
                
                {/* Pagination */}
                {historyPages > 1 && (
                  <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100 dark:border-white/5">
                    <p className="text-sm text-gray-500">
                      Page {historyPage} of {historyPages}
                    </p>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setHistoryPage(p => Math.max(1, p - 1))}
                        disabled={historyPage === 1}
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setHistoryPage(p => Math.min(historyPages, p + 1))}
                        disabled={historyPage === historyPages}
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        )}

        {activeTab === 'templates' && (
          <motion.div
            key="templates"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            <Card className="rounded-3xl border-0 shadow-xl">
              <CardHeader className="p-6 flex flex-row items-center justify-between">
                <div className="flex items-center gap-3">
                  <FileText className="h-5 w-5 text-gray-400" />
                  <div>
                    <CardTitle>Notification Templates</CardTitle>
                    <CardDescription>Reusable message templates for faster broadcasting</CardDescription>
                  </div>
                </div>
                <Button onClick={() => setShowNewTemplate(!showNewTemplate)}>
                  <Plus className="h-4 w-4 mr-2" />
                  New Template
                </Button>
              </CardHeader>
              <CardContent className="p-6 space-y-6">
                {/* New Template Form */}
                <AnimatePresence>
                  {showNewTemplate && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="p-6 rounded-2xl bg-blue-500/5 border border-blue-500/20 space-y-4"
                    >
                      <h4 className="font-bold text-sm">Create New Template</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Input
                          placeholder="Template name..."
                          value={newTemplate.name}
                          onChange={(e) => setNewTemplate({ ...newTemplate, name: e.target.value })}
                        />
                        <Input
                          placeholder="Notification title..."
                          value={newTemplate.title}
                          onChange={(e) => setNewTemplate({ ...newTemplate, title: e.target.value })}
                        />
                      </div>
                      <textarea
                        placeholder="Message content..."
                        value={newTemplate.message}
                        onChange={(e) => setNewTemplate({ ...newTemplate, message: e.target.value })}
                        className="w-full h-24 p-3 rounded-xl border border-gray-200 dark:border-white/10 dark:bg-black/20 resize-none text-sm"
                      />
                      <div className="flex gap-2">
                        <Button onClick={handleCreateTemplate}>Create Template</Button>
                        <Button variant="ghost" onClick={() => setShowNewTemplate(false)}>Cancel</Button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Templates List */}
                {templatesLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
                  </div>
                ) : templates.length === 0 ? (
                  <div className="text-center py-12 text-gray-400">
                    <FileText className="h-12 w-12 mx-auto mb-4 opacity-30" />
                    <p>No templates yet</p>
                    <p className="text-sm">Create one to speed up your broadcasts</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {templates.map((template) => {
                      const typeInfo = notificationTypes.find(t => t.value === template.type) || notificationTypes[0];
                      return (
                        <div
                          key={template.id}
                          className="p-5 rounded-2xl border border-gray-100 dark:border-white/5 hover:border-blue-500/30 transition-all group"
                        >
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex items-center gap-3">
                              <div className={`p-2 rounded-lg ${typeInfo.bg} ${typeInfo.color}`}>
                                <typeInfo.icon className="h-4 w-4" />
                              </div>
                              <div>
                                <p className="font-bold text-sm">{template.name}</p>
                                <p className="text-xs text-gray-400">{template.type}</p>
                              </div>
                            </div>
                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => applyTemplate(template)}
                                className="text-blue-500"
                              >
                                <Zap className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDeleteTemplate(template.id)}
                                className="text-red-500"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                          <p className="font-medium text-sm mb-1">{template.title}</p>
                          <p className="text-xs text-gray-500 line-clamp-2">{template.message}</p>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        )}

        {activeTab === 'analytics' && (
          <motion.div
            key="analytics"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-6"
          >
            {analyticsLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
              </div>
            ) : analytics ? (
              <>
                {/* Stats Cards */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <Card className="rounded-2xl border-0 shadow-lg bg-gradient-to-br from-blue-500 to-blue-600">
                    <CardContent className="p-6">
                      <Bell className="h-8 w-8 text-white/80 mb-4" />
                      <p className="text-3xl font-black text-white">{analytics.total_broadcasts}</p>
                      <p className="text-sm text-white/70 font-medium">Total Broadcasts</p>
                    </CardContent>
                  </Card>
                  <Card className="rounded-2xl border-0 shadow-lg bg-gradient-to-br from-green-500 to-green-600">
                    <CardContent className="p-6">
                      <Send className="h-8 w-8 text-white/80 mb-4" />
                      <p className="text-3xl font-black text-white">{analytics.total_notifications_sent}</p>
                      <p className="text-sm text-white/70 font-medium">Notifications Sent</p>
                    </CardContent>
                  </Card>
                  <Card className="rounded-2xl border-0 shadow-lg bg-gradient-to-br from-purple-500 to-purple-600">
                    <CardContent className="p-6">
                      <Eye className="h-8 w-8 text-white/80 mb-4" />
                      <p className="text-3xl font-black text-white">{analytics.read_rate_percent}%</p>
                      <p className="text-sm text-white/70 font-medium">Read Rate</p>
                    </CardContent>
                  </Card>
                  <Card className="rounded-2xl border-0 shadow-lg bg-gradient-to-br from-orange-500 to-orange-600">
                    <CardContent className="p-6">
                      <Clock className="h-8 w-8 text-white/80 mb-4" />
                      <p className="text-3xl font-black text-white">{analytics.unread_count}</p>
                      <p className="text-sm text-white/70 font-medium">Unread</p>
                    </CardContent>
                  </Card>
                </div>

                {/* Charts Row */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* By Type */}
                  <Card className="rounded-2xl border-0 shadow-xl">
                    <CardHeader className="p-6">
                      <CardTitle className="text-lg">Broadcasts by Type</CardTitle>
                    </CardHeader>
                    <CardContent className="p-6 pt-0">
                      <div className="space-y-3">
                        {Object.entries(analytics.by_type || {}).map(([type, count]) => {
                          const typeInfo = notificationTypes.find(t => t.value === type) || notificationTypes[0];
                          const total = Object.values(analytics.by_type || {}).reduce((a, b) => a + b, 0);
                          const percent = total > 0 ? (count / total * 100) : 0;
                          return (
                            <div key={type} className="flex items-center gap-3">
                              <div className={`p-2 rounded-lg ${typeInfo.bg} ${typeInfo.color}`}>
                                <typeInfo.icon className="h-4 w-4" />
                              </div>
                              <div className="flex-1">
                                <div className="flex justify-between mb-1">
                                  <span className="text-sm font-bold capitalize">{type}</span>
                                  <span className="text-sm text-gray-500">{count}</span>
                                </div>
                                <div className="h-2 bg-gray-100 dark:bg-white/5 rounded-full overflow-hidden">
                                  <div 
                                    className={`h-full ${typeInfo.bg.replace('/10', '')} transition-all`}
                                    style={{ width: `${percent}%` }}
                                  />
                                </div>
                              </div>
                            </div>
                          );
                        })}
                        {Object.keys(analytics.by_type || {}).length === 0 && (
                          <p className="text-center text-gray-400 py-4">No data yet</p>
                        )}
                      </div>
                    </CardContent>
                  </Card>

                  {/* By Target */}
                  <Card className="rounded-2xl border-0 shadow-xl">
                    <CardHeader className="p-6">
                      <CardTitle className="text-lg">Broadcasts by Target</CardTitle>
                    </CardHeader>
                    <CardContent className="p-6 pt-0">
                      <div className="space-y-3">
                        {Object.entries(analytics.by_target || {}).map(([target, count]) => {
                          const total = Object.values(analytics.by_target || {}).reduce((a, b) => a + b, 0);
                          const percent = total > 0 ? (count / total * 100) : 0;
                          return (
                            <div key={target} className="flex items-center gap-3">
                              <div className={`p-2 rounded-lg ${target === 'all' ? 'bg-blue-500/10 text-blue-500' : 'bg-purple-500/10 text-purple-500'}`}>
                                {target === 'all' ? <Users className="h-4 w-4" /> : <User className="h-4 w-4" />}
                              </div>
                              <div className="flex-1">
                                <div className="flex justify-between mb-1">
                                  <span className="text-sm font-bold capitalize">{target === 'all' ? 'All Users' : 'Individual'}</span>
                                  <span className="text-sm text-gray-500">{count}</span>
                                </div>
                                <div className="h-2 bg-gray-100 dark:bg-white/5 rounded-full overflow-hidden">
                                  <div 
                                    className={`h-full ${target === 'all' ? 'bg-blue-500' : 'bg-purple-500'} transition-all`}
                                    style={{ width: `${percent}%` }}
                                  />
                                </div>
                              </div>
                            </div>
                          );
                        })}
                        {Object.keys(analytics.by_target || {}).length === 0 && (
                          <p className="text-center text-gray-400 py-4">No data yet</p>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Daily Activity */}
                <Card className="rounded-2xl border-0 shadow-xl">
                  <CardHeader className="p-6">
                    <CardTitle className="text-lg">Daily Activity (Last 7 Days)</CardTitle>
                  </CardHeader>
                  <CardContent className="p-6 pt-0">
                    {analytics.daily_stats && analytics.daily_stats.length > 0 ? (
                      <div className="flex items-end justify-between h-32 gap-2">
                        {analytics.daily_stats.map((day, i) => {
                          const maxSent = Math.max(...analytics.daily_stats.map(d => d.sent || 0), 1);
                          const height = ((day.sent || 0) / maxSent) * 100;
                          return (
                            <div key={i} className="flex-1 flex flex-col items-center gap-2">
                              <div 
                                className="w-full bg-blue-500 rounded-t-lg transition-all hover:bg-blue-400" 
                                style={{ height: `${Math.max(height, 5)}%` }}
                                title={`${day.sent} sent`}
                              />
                              <span className="text-[10px] text-gray-400">{day.date.slice(-5)}</span>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-center text-gray-400 py-8">No recent activity</p>
                    )}
                  </CardContent>
                </Card>
              </>
            ) : (
              <div className="text-center py-12 text-gray-400">
                <BarChart3 className="h-12 w-12 mx-auto mb-4 opacity-30" />
                <p>Failed to load analytics</p>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
