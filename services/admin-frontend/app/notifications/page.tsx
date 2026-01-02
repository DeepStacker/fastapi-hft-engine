'use client';

import { useState, useEffect } from 'react';
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
  X,
  History,
  Layout
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

const notificationTypes = [
  { value: 'info', label: 'Info', icon: Info, color: 'text-blue-500', bg: 'bg-blue-500/10' },
  { value: 'success', label: 'Success', icon: CheckCircle, color: 'text-green-500', bg: 'bg-green-500/10' },
  { value: 'warning', label: 'Warning', icon: AlertTriangle, color: 'text-yellow-500', bg: 'bg-yellow-500/10' },
  { value: 'error', label: 'Error', icon: AlertCircle, color: 'text-red-500', bg: 'bg-red-500/10' },
];

export default function NotificationsPage() {
  const [stats, setStats] = useState<NotificationStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  
  // Form state
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [type, setType] = useState('info');
  const [target, setTarget] = useState<'all' | 'user'>('all');
  const [userEmail, setUserEmail] = useState('');
  const [link, setLink] = useState('');
  
  // User search
  const [userSearch, setUserSearch] = useState('');
  const [userResults, setUserResults] = useState<UserOption[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);

  const theme = 'dark'; // Admin dashboard follows a dark aesthetic by default

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      setLoading(true);
      const response = await api.getNotificationStats();
      setStats(response.data);
    } catch (error) {
      console.error('Failed to load stats:', error);
    } finally {
      setLoading(false);
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
      
      // Refresh stats
      loadStats();
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Failed to send notification');
    } finally {
      setSending(false);
    }
  };

  const selectedType = notificationTypes.find(t => t.value === type) || notificationTypes[0];

  return (
    <div className="space-y-8 p-6 max-w-[1200px] mx-auto">
      {/* Header with Glassmorphism */}
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
          <p className="text-blue-100/60 font-medium font-inter">Send real-time updates and alerts to your trading community</p>
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Compose Card */}
        <div className="lg:col-span-2 space-y-8">
          <Card className="rounded-[2.5rem] border-0 shadow-2xl overflow-hidden bg-white/80 dark:bg-gray-900/50 backdrop-blur-sm">
            <CardHeader className="bg-gray-50/50 dark:bg-white/5 p-8 border-b border-gray-100 dark:border-white/5">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-blue-600/10 flex items-center justify-center">
                  <Layout className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <CardTitle className="text-xl font-bold">Compose Notification</CardTitle>
                  <CardDescription>Tailor your message for targeted impact</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-8 space-y-8">
              {/* Target Selection */}
              <div className="space-y-4">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">Campaign Target</label>
                <div className="flex p-1.5 rounded-2xl bg-gray-100 dark:bg-black/40 border border-gray-200 dark:border-white/5">
                  <button
                    onClick={() => setTarget('all')}
                    className={`flex-1 flex items-center justify-center gap-3 py-3.5 rounded-xl transition-all font-bold text-sm ${
                      target === 'all' 
                      ? 'bg-white dark:bg-blue-600 shadow-xl text-blue-600 dark:text-white' 
                      : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
                    }`}
                  >
                    <Users className="h-4 w-4" />
                    Broadcast to All
                  </button>
                  <button
                    onClick={() => setTarget('user')}
                    className={`flex-1 flex items-center justify-center gap-3 py-3.5 rounded-xl transition-all font-bold text-sm ${
                      target === 'user' 
                      ? 'bg-white dark:bg-blue-600 shadow-xl text-blue-600 dark:text-white' 
                      : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
                    }`}
                  >
                    <User className="h-4 w-4" />
                    Specific User
                  </button>
                </div>
              </div>

              {/* User Selector Dropdown */}
              <AnimatePresence>
                {target === 'user' && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="space-y-4"
                  >
                    <div className="relative group">
                      <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
                      <Input
                        placeholder="Search users by email or username..."
                        value={userSearch}
                        onChange={(e) => {
                          setUserSearch(e.target.value);
                          searchUsers(e.target.value);
                        }}
                        className="pl-12 py-7 rounded-2xl border-gray-200 dark:border-white/10 dark:bg-black/20 focus:ring-4 focus:ring-blue-500/10 transition-all font-medium"
                      />
                      
                      {/* Dropdown Results */}
                      {userResults.length > 0 && (
                        <motion.div 
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="absolute z-50 w-full mt-2 rounded-[2rem] bg-white dark:bg-gray-800 shadow-2xl border border-gray-100 dark:border-white/10 overflow-hidden"
                        >
                          {userResults.map((user) => (
                            <button
                              key={user.id}
                              onClick={() => {
                                setUserEmail(user.email);
                                setUserSearch(user.email);
                                setUserResults([]);
                              }}
                              className="w-full flex items-center gap-4 px-6 py-4 hover:bg-blue-50 dark:hover:bg-blue-600/10 transition-colors text-left border-b last:border-0 border-gray-50 dark:border-white/5"
                            >
                              <div className="w-10 h-10 rounded-full bg-blue-600/10 flex items-center justify-center text-blue-600 font-bold uppercase">
                                {user.username.charAt(0)}
                              </div>
                              <div>
                                <p className="font-bold text-sm dark:text-white">{user.email}</p>
                                <p className="text-xs text-gray-500">{user.username}</p>
                              </div>
                              {userEmail === user.email && <Check className="ml-auto w-4 h-4 text-blue-600" />}
                            </button>
                          ))}
                        </motion.div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-8">
                  {/* Type Selector */}
                  <div className="space-y-4">
                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">Message Type</label>
                    <div className="grid grid-cols-2 gap-3">
                      {notificationTypes.map((t) => (
                        <button
                          key={t.value}
                          onClick={() => setType(t.value)}
                          className={`flex items-center gap-3 p-4 rounded-2xl border-2 transition-all group ${
                            type === t.value 
                            ? 'border-blue-600 bg-blue-600/5' 
                            : 'border-gray-100 dark:border-white/5 hover:border-blue-500/50'
                          }`}
                        >
                          <div className={`p-2.5 rounded-xl ${t.bg} ${t.color}`}>
                            <t.icon className="h-4 w-4" />
                          </div>
                          <span className={`text-sm font-bold ${type === t.value ? 'text-blue-600 dark:text-blue-400' : 'text-gray-500'}`}>{t.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Title Input */}
                  <div className="space-y-4">
                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">Clear Title</label>
                    <Input
                      placeholder="e.g. Market Breakout Detected"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      className="py-7 rounded-2xl dark:bg-black/20 font-bold border-gray-200 dark:border-white/5"
                    />
                  </div>
                </div>

                <div className="space-y-8">
                   {/* Message Textarea */}
                  <div className="space-y-4 h-full">
                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">Detailed Message</label>
                    <div className="relative h-[calc(100%-2.5rem)] min-h-[160px]">
                      <textarea
                        placeholder="Explain the event in detail..."
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        className="w-full h-full p-7 pb-12 rounded-[2rem] border-2 border-gray-100 dark:border-white/5 dark:bg-black/20 focus:border-blue-500 focus:outline-none transition-all resize-none shadow-inner font-medium text-sm leading-relaxed"
                      />
                      <span className="absolute bottom-6 right-8 text-[10px] font-black text-gray-400 uppercase tracking-widest">{message.length}/500</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">Action URL (Optional)</label>
                <div className="relative">
                  <ExternalLink className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <Input
                    placeholder="/dashboard, /screeners, or external URL"
                    value={link}
                    onChange={(e) => setLink(e.target.value)}
                    className="pl-12 py-7 rounded-2xl dark:bg-black/20 font-medium border-gray-200 dark:border-white/5"
                  />
                </div>
              </div>

               {/* Send Action */}
              <div className="pt-6">
                <Button 
                  onClick={handleSend} 
                  disabled={sending || !title.trim() || !message.trim()}
                  className="w-full py-9 rounded-[2rem] bg-blue-600 hover:bg-blue-700 shadow-2xl shadow-blue-600/30 text-lg font-black uppercase tracking-[0.3em] transition-all hover:scale-[1.01] active:scale-[0.98]"
                >
                  {sending ? (
                    <>
                      <Loader2 className="h-6 w-6 mr-4 animate-spin" />
                      Dispatching Communications...
                    </>
                  ) : (
                    <>
                      <Send className="h-6 w-6 mr-4" />
                      Release Broadcast
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Recent History Table */}
          <Card className="rounded-[2.5rem] border-0 shadow-xl overflow-hidden bg-white/50 dark:bg-gray-900/40 backdrop-blur-md">
            <CardHeader className="p-8 pb-4">
              <div className="flex items-center gap-3">
                <History className="h-5 w-5 text-gray-400" />
                <CardTitle className="text-lg">Broadcast History</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="p-0">
               <div className="overflow-x-auto">
                 <table className="w-full text-left">
                   <thead className="border-y border-gray-100 dark:border-white/5 bg-gray-50/50 dark:bg-black/40">
                     <tr>
                       <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-gray-400">Timestamp</th>
                       <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-gray-400">Content</th>
                       <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-gray-400">Type</th>
                       <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-gray-400">Audience</th>
                     </tr>
                   </thead>
                   <tbody className="divide-y divide-gray-50 dark:divide-white/5">
                     {[1].map((_, i) => (
                       <tr key={i} className="group hover:bg-blue-500/5 transition-colors">
                         <td className="px-8 py-7 text-xs text-gray-500 font-bold whitespace-nowrap">Today, 18:30</td>
                         <td className="px-8 py-7">
                           <p className="font-bold text-sm dark:text-white mb-0.5">Welcome Broadcast</p>
                           <p className="text-xs text-gray-500 line-clamp-1">Testing the new broadcast system...</p>
                         </td>
                         <td className="px-8 py-7">
                           <Badge className="bg-green-500/10 text-green-500 border-0 font-bold">SUCCESS</Badge>
                         </td>
                         <td className="px-8 py-7">
                           <div className="flex items-center gap-2">
                             <Users className="w-3 h-3 text-blue-500" />
                             <span className="text-[10px] font-black uppercase tracking-widest text-blue-500">Global</span>
                           </div>
                         </td>
                       </tr>
                     ))}
                   </tbody>
                 </table>
               </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar: Live Preview */}
        <div className="space-y-8">
          <div className="sticky top-8">
            <div className="mb-6 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Smartphone className="h-5 w-5 text-gray-400" />
                <h3 className="text-[10px] font-black uppercase tracking-[0.2em] opacity-80">UX Preview</h3>
              </div>
              <Badge variant="outline" className="text-[9px] border-blue-500/30 text-blue-500 font-black tracking-widest rounded-full uppercase">Real-time Visual</Badge>
            </div>

            {/* iPhone Mockup Overlay */}
            <div className="relative mx-auto w-full max-w-[340px] aspect-[9/18.5] rounded-[3.5rem] border-[12px] border-gray-900 shadow-[0_40px_100px_rgba(0,0,0,0.5),0_10px_40px_rgba(37,99,235,0.2)] bg-gray-900 overflow-hidden ring-1 ring-white/10">
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-36 h-7 bg-gray-900 rounded-b-[1.5rem] z-20" />
              
              {/* Wallpaper */}
              <div className="absolute inset-0 bg-gradient-to-b from-blue-900 via-gray-950 to-black z-0 opacity-80" />
              
              {/* Contents */}
              <div className="relative z-10 p-6 flex flex-col justify-start pt-24">
                <motion.div 
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  key={title + type}
                  className="rounded-[2rem] bg-white/10 backdrop-blur-3xl border border-white/20 p-5 shadow-2xl"
                >
                  <div className="flex items-center gap-4 mb-4">
                    <div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${selectedType.bg} ${selectedType.color} shadow-lg shadow-black/20`}>
                      <Bell className="h-5 w-5" />
                    </div>
                    <div className="flex-1">
                      <p className="text-[10px] font-black text-white uppercase tracking-widest opacity-80 leading-none">DeepStrike</p>
                      <p className="text-[9px] text-white/40 mt-1 font-bold">Now Incoming</p>
                    </div>
                  </div>
                  
                  <h4 className="text-base font-black text-white mb-2 leading-tight">{title || 'Your Notification Title'}</h4>
                  <p className="text-xs text-blue-100/70 leading-relaxed line-clamp-4 font-medium">
                    {message || 'Type your message to see how it will appear on the deep field...'}
                  </p>
                  
                  {link && (
                    <motion.div 
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="mt-5 pt-4 border-t border-white/10 flex items-center justify-between"
                    >
                       <span className="text-[10px] font-black text-blue-400 uppercase tracking-widest">Execute: {link.startsWith('/') ? link.substring(1) : 'Action'}</span>
                       <div className="w-5 h-5 rounded-full bg-blue-500/20 flex items-center justify-center">
                        <Smartphone className="w-3 h-3 text-blue-400" />
                       </div>
                    </motion.div>
                  )}
                </motion.div>

                {/* Second mock notif (blurred background effect) */}
                <div className="mt-5 rounded-[1.5rem] bg-white/5 backdrop-blur-md border border-white/5 p-4 opacity-30 scale-95 origin-top">
                  <div className="w-16 h-3 bg-white/20 rounded-full mb-3 shadow-inner" />
                  <div className="w-full h-2 bg-white/10 rounded-full" />
                </div>
              </div>
              
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 w-36 h-1.5 bg-white/20 rounded-full z-20" />
            </div>

            {/* Desktop Preview Card (Sidebar style) */}
            <div className="mt-10 p-7 rounded-[2.5rem] bg-white dark:bg-gray-900 shadow-2xl border border-gray-100 dark:border-white/5">
               <div className="flex items-center gap-3 mb-5">
                 <div className="p-1.5 bg-blue-600/10 rounded-lg">
                   <Layout className="h-4 w-4 text-blue-600" />
                 </div>
                 <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-40">Sidebar Unit</p>
               </div>
               
               <div className={`p-5 rounded-[1.5rem] border transition-all ${
                 theme === 'dark' ? 'bg-black/40 border-white/5' : 'bg-gray-50 border-gray-100 shadow-inner'
               } flex gap-4`}>
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 ${selectedType.bg} ${selectedType.color} shadow-lg shadow-black/5`}>
                    <Bell className="w-6 h-6" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-black m-0 mb-1 leading-none">{title || 'Title Preview'}</p>
                    <p className="text-[11px] opacity-40 font-medium line-clamp-1">{message || 'Message preview...'}</p>
                  </div>
               </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
