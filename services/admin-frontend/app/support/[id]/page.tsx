'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { 
    ArrowLeft, 
    Send, 
    Loader2, 
    User, 
    Shield, 
    CheckCircle, 
    Clock,
    Paperclip,
    File,
    X,
    MessageSquare
} from 'lucide-react';
import { toast } from '@/components/ui/Toaster';

const STATUS_OPTIONS = [
    { value: 'open', label: 'Open' },
    { value: 'in_progress', label: 'In Progress' },
    { value: 'resolved', label: 'Resolved' },
    { value: 'closed', label: 'Closed' },
];

const PRIORITY_OPTIONS = [
    { value: 'low', label: 'Low' },
    { value: 'normal', label: 'Normal' },
    { value: 'high', label: 'High' },
    { value: 'urgent', label: 'Urgent' },
];

const CANNED_RESPONSES = [
    "Hello, thank you for reaching out. We are looking into this.",
    "Could you please provide more details or a screenshot?",
    "We have resolved the issue. Please check and confirm.",
    "This ticket is now closed. Feel free to open a new one if needed."
];

interface TicketMessage {
    id: string;
    message: string;
    is_admin: boolean;
    sender_name?: string;
    created_at: string;
    attachments?: string[];
}

interface SupportTicket {
    ticket_id: string;
    subject: string;
    category: string;
    status: string;
    priority: string;
    user_name: string;
    created_at: string;
    updated_at: string;
    messages: TicketMessage[];
}

export default function TicketDetailPage() {
    const params = useParams();
    const router = useRouter();
    const [ticket, setTicket] = useState<SupportTicket | null>(null);
    const [loading, setLoading] = useState(true);
    const [reply, setReply] = useState('');
    const [attachments, setAttachments] = useState<string[]>([]);
    const [isUploading, setIsUploading] = useState(false);
    const [sending, setSending] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // WebSocket
    const wsRef = useRef<WebSocket | null>(null);
    const [isConnected, setIsConnected] = useState(false);
    const [typingUser, setTypingUser] = useState<string | null>(null);

    useEffect(() => {
        if (params.id) {
            loadTicket();
            connectWebSocket();
        }
        return () => {
            if (wsRef.current) wsRef.current.close();
        };
    }, [params.id]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [ticket?.messages, typingUser]);

    const connectWebSocket = () => {
        const token = localStorage.getItem('access_token');
        if (!token) return;

        // Construct WS URL
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const host = process.env.NEXT_PUBLIC_API_URL 
            ? new URL(process.env.NEXT_PUBLIC_API_URL).host 
            : 'localhost:8001';
        const wsUrl = `${protocol}//${host}/ws/support/${params.id}?token=${token}`;

        const ws = new WebSocket(wsUrl);

        ws.onopen = () => setIsConnected(true);
        ws.onclose = () => setIsConnected(false);
        ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            if (data.type === 'message') {
                setTicket(prev => {
                    if (!prev) return prev;
                    if (prev.messages.find(m => m.id === data.id)) return prev;
                    return {
                        ...prev,
                        messages: [...prev.messages, data] // attachments are already in data
                    };
                });
                setTypingUser(null);
            } else if (data.type === 'typing') {
                setTypingUser(data.sender_name || 'User');
                setTimeout(() => setTypingUser(null), 3000);
            }
        };

        wsRef.current = ws;
    };

    const loadTicket = async () => {
        try {
            const res = await api.getSupportTicket(params.id as string);
            setTicket(res.data);
        } catch (error) {
            console.error(error);
            toast.error("Failed to load ticket");
        } finally {
            setLoading(false);
        }
    };

    const handleUpdateStatus = async (status: string) => {
        try {
            await api.updateSupportTicket(params.id as string, { status });
            toast.success(`Status updated to ${status}`);
            loadTicket();
        } catch (error) {
            toast.error("Failed to update status");
        }
    };

    const handleUpdatePriority = async (priority: string) => {
        try {
            await api.updateSupportTicket(params.id as string, { priority });
            toast.success(`Priority updated to ${priority}`);
            loadTicket();
        } catch (error) {
            toast.error("Failed to update priority");
        }
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files?.length) return;
        setIsUploading(true);
        try {
            const uploaded: string[] = [];
            for (let i = 0; i < e.target.files.length; i++) {
                const file = e.target.files[i];
                const res = await api.uploadSupportFile(file);
                if (res.data.url) uploaded.push(res.data.url);
            }
            setAttachments(prev => [...prev, ...uploaded]);
        } catch (error) {
            console.error(error);
            toast.error("Failed to upload file");
        } finally {
            setIsUploading(false);
        }
    };

    const handleSendReply = async () => {
        if ((!reply.trim() && attachments.length === 0)) return;
        setSending(true);
        try {
            // Optimistic Update isn't easy with attachments waiting for backend, 
            // but WS will catch it shortly. 
            await api.sendSupportReply(params.id as string, reply, attachments);
            setReply('');
            setAttachments([]);
            // loadTicket(); // WS should handle this
            toast.success("Reply sent");
        } catch (error) {
            toast.error("Failed to send reply");
        } finally {
            setSending(false);
        }
    };

    const handleTyping = () => {
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({ type: 'typing' }));
        }
    };

    if (loading) return <div className="p-10 flex justify-center"><Loader2 className="w-10 h-10 animate-spin text-indigo-500" /></div>;
    if (!ticket) return <div className="p-10 text-center">Ticket not found</div>;

    return (
        <div className="space-y-6 p-6 max-w-[1400px] mx-auto h-[calc(100vh-80px)] flex flex-col">
            {/* Header */}
            <div className="flex items-center gap-4 mb-2">
                <Button variant="ghost" size="sm" onClick={() => router.back()}>
                    <ArrowLeft className="w-5 h-5" />
                </Button>
                <div className="flex-1">
                    <div className="flex items-center gap-3">
                        <h1 className="text-2xl font-bold">{ticket.subject}</h1>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                            ticket.priority === 'urgent' ? 'bg-red-100 text-red-600' :
                            ticket.priority === 'high' ? 'bg-orange-100 text-orange-600' :
                            'bg-blue-50 text-blue-600'
                        }`}>
                            {ticket.priority.toUpperCase()}
                        </span>
                    </div>
                    <div className="flex items-center gap-3 text-sm text-gray-500 mt-1">
                        <span className="font-mono bg-gray-100 dark:bg-white/10 px-2 py-0.5 rounded text-xs">{ticket.ticket_id}</span>
                        <span>•</span>
                        <span className="flex items-center gap-1"><User className="w-3 h-3"/> {ticket.user_name}</span>
                        <span>•</span>
                        <span>{new Date(ticket.created_at).toLocaleString()}</span>
                        {isConnected && (
                             <span className="ml-auto flex items-center gap-1.5 text-green-600 text-xs font-medium px-2 py-0.5 bg-green-50 rounded-full">
                                <span className="relative flex h-2 w-2">
                                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                                  <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                                </span>
                                Live
                             </span>
                        )}
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1 min-h-0">
                {/* Chat Area */}
                <Card className="lg:col-span-2 rounded-3xl border-0 shadow-xl flex flex-col overflow-hidden">
                    <CardContent className="flex-1 flex flex-col p-0 h-full">
                        <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-gray-50/30 dark:bg-black/20">
                            {ticket.messages.map((msg, idx) => {
                                const isAdmin = msg.is_admin;
                                return (
                                    <div key={msg.id} className={`flex gap-3 ${isAdmin ? 'flex-row-reverse' : 'flex-row'}`}>
                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                                            isAdmin ? 'bg-indigo-600 text-white' : 'bg-gray-200 text-gray-600'
                                        }`}>
                                            {isAdmin ? <Shield className="w-4 h-4" /> : <User className="w-4 h-4" />}
                                        </div>
                                        <div className={`max-w-[80%] rounded-2xl px-5 py-3 shadow-sm ${
                                            isAdmin 
                                                ? 'bg-indigo-600 text-white rounded-tr-sm' 
                                                : 'bg-white dark:bg-gray-800 border border-gray-100 dark:border-white/5 rounded-tl-sm'
                                        }`}>
                                            {/* Display Attachments */}
                                            {msg.attachments && msg.attachments.length > 0 && (
                                                <div className="flex flex-wrap gap-2 mb-2">
                                                    {msg.attachments.map((url, i) => (
                                                        <a 
                                                            key={i} 
                                                            href={url} 
                                                            target="_blank" 
                                                            rel="noopener noreferrer" 
                                                            className={`block w-20 h-20 rounded-lg overflow-hidden border ${isAdmin ? 'border-white/20' : 'border-gray-200'} relative group`}
                                                        >
                                                            {url.match(/\.(jpg|jpeg|png|gif)$/i) ? (
                                                                <img src={url} className="w-full h-full object-cover" />
                                                            ) : (
                                                                <div className="w-full h-full flex items-center justify-center bg-black/10">
                                                                    <File className="w-6 h-6 opacity-50" />
                                                                </div>
                                                            )}
                                                        </a>
                                                    ))}
                                                </div>
                                            )}

                                            <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.message}</p>
                                            <p className={`text-[10px] mt-1 text-right ${isAdmin ? 'text-indigo-200' : 'text-gray-400'}`}>
                                                {new Date(msg.created_at).toLocaleString()}
                                            </p>
                                        </div>
                                    </div>
                                )
                            })}
                            
                            {typingUser && (
                                <div className="flex gap-3">
                                     <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center">
                                         <User className="w-4 h-4 text-gray-600"/>
                                     </div>
                                     <div className="bg-gray-100 rounded-2xl rounded-tl-sm px-4 py-2 flex items-center gap-1">
                                         <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '0ms'}}></span>
                                         <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '150ms'}}></span>
                                         <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '300ms'}}></span>
                                     </div>
                                </div>
                            )}
                            <div ref={messagesEndRef} />
                        </div>
                        
                        {/* Reply Input */}
                        <div className="p-4 border-t border-gray-100 dark:border-white/5 bg-white dark:bg-gray-900">
                             {/* Attachments Preview */}
                             {attachments.length > 0 && (
                                <div className="flex gap-2 mb-3 overflow-x-auto pb-2">
                                    {attachments.map((url, idx) => (
                                        <div key={idx} className="relative group shrink-0 w-16 h-16 rounded-lg border border-gray-200 overflow-hidden">
                                            {url.match(/\.(jpg|jpeg|png|gif)$/i) 
                                                ? <img src={url} className="w-full h-full object-cover" /> 
                                                : <div className="w-full h-full flex items-center justify-center bg-gray-50"><File className="w-6 h-6 text-gray-400"/></div>
                                            }
                                            <button 
                                                onClick={() => setAttachments(attachments.filter((_, i) => i !== idx))}
                                                className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 rounded-full text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
                                            >
                                                <X className="w-3 h-3" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                             )}

                            {/* Canned Responses */}
                            <div className="flex gap-2 mb-3 overflow-x-auto no-scrollbar pb-1">
                                {CANNED_RESPONSES.map((resp, i) => (
                                    <button
                                        key={i}
                                        onClick={() => setReply(resp)}
                                        className="shrink-0 px-3 py-1.5 rounded-full bg-gray-100 dark:bg-white/5 text-xs text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-white/10 transition-colors whitespace-nowrap flex items-center gap-1"
                                    >
                                        <MessageSquare className="w-3 h-3" />
                                        {resp.length > 30 ? resp.substring(0, 30) + '...' : resp}
                                    </button>
                                ))}
                            </div>

                            <div className="flex gap-3 items-end">
                                <div className="relative">
                                    <input 
                                        type="file" 
                                        multiple 
                                        className="hidden" 
                                        id="admin-file-upload"
                                        onChange={handleFileUpload}
                                    />
                                    <label 
                                        htmlFor="admin-file-upload"
                                        className={`p-3 rounded-xl border border-dashed border-gray-300 hover:border-indigo-500 text-gray-400 hover:text-indigo-500 cursor-pointer flex items-center justify-center transition-colors ${isUploading ? 'opacity-50 pointer-events-none' : ''}`}
                                    >
                                        {isUploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Paperclip className="w-5 h-5" />}
                                    </label>
                                </div>
                                <textarea
                                    value={reply}
                                    onChange={(e) => {
                                        setReply(e.target.value);
                                        handleTyping();
                                    }}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' && !e.shiftKey) {
                                            e.preventDefault();
                                            handleSendReply();
                                        }
                                    }}
                                    placeholder="Type your reply..."
                                    className="flex-1 rounded-xl border-gray-200 dark:border-white/10 dark:bg-black/20 p-3 text-sm focus:ring-2 focus:ring-indigo-500 resize-none h-[50px] min-h-[50px] max-h-[120px]"
                                />
                                <Button 
                                    onClick={handleSendReply} 
                                    disabled={sending || (!reply.trim() && attachments.length === 0)}
                                    className="h-[50px] px-6 rounded-xl bg-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-200 dark:shadow-none"
                                >
                                    {sending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                                </Button>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Sidebar Controls */}
                <div className="space-y-6">
                    <Card className="rounded-3xl border-0 shadow-lg">
                        <CardHeader>
                            <CardTitle className="text-sm uppercase tracking-wider text-gray-400">Status</CardTitle>
                        </CardHeader>
                        <CardContent className="grid grid-cols-2 gap-2">
                             {STATUS_OPTIONS.map(status => (
                                 <button
                                     key={status.value}
                                     onClick={() => handleUpdateStatus(status.value)}
                                     className={`px-3 py-2 rounded-lg text-sm font-bold border-2 transition-all ${
                                         ticket.status === status.value
                                             ? 'border-indigo-600 bg-indigo-50 text-indigo-700'
                                             : 'border-transparent hover:bg-gray-50 text-gray-500'
                                     }`}
                                 >
                                     {status.label}
                                 </button>
                             ))}
                        </CardContent>
                    </Card>

                    <Card className="rounded-3xl border-0 shadow-lg">
                        <CardHeader>
                            <CardTitle className="text-sm uppercase tracking-wider text-gray-400">Priority</CardTitle>
                        </CardHeader>
                        <CardContent className="grid grid-cols-2 gap-2">
                             {PRIORITY_OPTIONS.map(p => (
                                 <button
                                     key={p.value}
                                     onClick={() => handleUpdatePriority(p.value)}
                                     className={`px-3 py-2 rounded-lg text-sm font-bold border-2 transition-all ${
                                         ticket.priority === p.value
                                             ? 'border-indigo-600 bg-indigo-50 text-indigo-700'
                                             : 'border-transparent hover:bg-gray-50 text-gray-500'
                                     }`}
                                 >
                                     {p.label}
                                 </button>
                             ))}
                        </CardContent>
                    </Card>
                    
                    <Card className="rounded-3xl border-0 shadow-lg">
                        <CardHeader>
                            <CardTitle className="text-sm uppercase tracking-wider text-gray-400">Ticket Info</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3 text-sm">
                            <div className="flex justify-between border-b border-gray-50 pb-2">
                                <span className="text-gray-500">Subject</span>
                                <span className="font-bold text-right max-w-[60%] truncate">{ticket.subject}</span>
                            </div>
                            <div className="flex justify-between border-b border-gray-50 pb-2">
                                <span className="text-gray-500">Category</span>
                                <span className="font-bold capitalize">{ticket.category}</span>
                            </div>
                            <div className="flex justify-between border-b border-gray-50 pb-2">
                                <span className="text-gray-500">Created</span>
                                <span>{new Date(ticket.created_at).toLocaleDateString()}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-500">Last Update</span>
                                <span>{new Date(ticket.updated_at).toLocaleDateString()}</span>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
