import { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSelector } from 'react-redux';
import {
    ChatBubbleLeftRightIcon,
    PlusIcon,
    XMarkIcon,
    PaperAirplaneIcon,
    TicketIcon,
    ChevronLeftIcon,
    ClockIcon,
    CheckCircleIcon,
    NoSymbolIcon,
    PaperClipIcon,
    DocumentIcon
} from '@heroicons/react/24/outline';
import supportService from '../../services/supportService';

const STATUS_CONFIG = {
    open: { label: 'Open', color: 'text-green-500', bg: 'bg-green-500/10', icon: ClockIcon },
    in_progress: { label: 'In Progress', color: 'text-blue-500', bg: 'bg-blue-500/10', icon: ChatBubbleLeftRightIcon },
    resolved: { label: 'Resolved', color: 'text-gray-500', bg: 'bg-gray-500/10', icon: CheckCircleIcon },
    closed: { label: 'Closed', color: 'text-gray-400', bg: 'bg-gray-500/10', icon: NoSymbolIcon },
};

const CATEGORIES = [
    { id: 'issue', label: 'Report Issue' },
    { id: 'market_data', label: 'Market Data' },
    { id: 'feature_request', label: 'Feature Request' },
    { id: 'billing', label: 'Billing / Account' },
    { id: 'other', label: 'Other' },
];

const SupportCenter = ({ isOpen, onClose }) => {
    const theme = useSelector((state) => state.theme?.theme || 'light');
    const isDark = theme === 'dark';
    const currentUser = useSelector((state) => state.auth?.user);
    const token = useSelector((state) => state.auth?.token); // For WS auth

    // Views: 'list', 'create', 'chat'
    const [view, setView] = useState('list');
    const [selectedTicketId, setSelectedTicketId] = useState(null);

    // Data
    const [tickets, setTickets] = useState([]);
    const [currentTicket, setCurrentTicket] = useState(null);
    const [loading, setLoading] = useState(false);

    // Create Form
    const [createForm, setCreateForm] = useState({ subject: '', category: 'issue', message: '' });
    const [createAttachments, setCreateAttachments] = useState([]);
    const [isUploading, setIsUploading] = useState(false);

    // Chat Form
    const [replyMessage, setReplyMessage] = useState('');
    const [replyAttachments, setReplyAttachments] = useState([]);
    const messagesEndRef = useRef(null);

    // WebSocket
    const wsRef = useRef(null);
    const [isConnected, setIsConnected] = useState(false);
    const [typingUsers, setTypingUsers] = useState({});

    // Fetch list on open
    useEffect(() => {
        if (isOpen && view === 'list') {
            loadTickets();
        }
    }, [isOpen, view]);

    // WebSocket Connection Logic
    useEffect(() => {
        if (selectedTicketId && view === 'chat') {
            loadTicketDetails(selectedTicketId);

            // Connect WS
            const wsUrl = supportService.getWebSocketUrl(selectedTicketId);
            const ws = new WebSocket(`${wsUrl}?token=${token}`);

            ws.onopen = () => {
                console.log('WS Connected');
                setIsConnected(true);
            };

            ws.onmessage = (event) => {
                const data = JSON.parse(event.data);

                if (data.type === 'message') {
                    // Append message if not already present (dedupe)
                    setCurrentTicket(prev => {
                        if (!prev) return prev;
                        if (prev.messages.find(m => m.id === data.id)) return prev;
                        return {
                            ...prev,
                            messages: [...prev.messages, {
                                ...data,
                                attachments: data.attachments || []
                            }]
                        };
                    });
                    // Clear typing indicator for this user
                    setTypingUsers(prev => {
                        const next = { ...prev };
                        delete next[data.sender_name];
                        return next;
                    });
                } else if (data.type === 'typing') {
                    // Set typing indicator
                    setTypingUsers(prev => ({
                        ...prev,
                        [data.user]: Date.now()
                    }));

                    // Auto-clear after 3s
                    setTimeout(() => {
                        setTypingUsers(prev => {
                            const next = { ...prev };
                            if (next[data.user] && Date.now() - next[data.user] > 2500) {
                                delete next[data.user];
                            }
                            return next;
                        });
                    }, 3000);
                }
            };

            ws.onclose = () => setIsConnected(false);
            wsRef.current = ws;

            return () => {
                if (wsRef.current) wsRef.current.close();
            };
        }
    }, [selectedTicketId, view, token]);

    // Scroll to bottom of chat
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [currentTicket?.messages, typingUsers]);

    const loadTickets = async () => {
        setLoading(true);
        try {
            const res = await supportService.getTickets({ limit: 50 });
            setTickets(res.tickets || []);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const loadTicketDetails = async (id, silent = false) => {
        if (!silent) setLoading(true);
        try {
            const res = await supportService.getTicket(id);
            setCurrentTicket(res);
        } catch (err) {
            console.error(err);
        } finally {
            if (!silent) setLoading(false);
        }
    };

    const handleFileUpload = async (files, isReply = false) => {
        setIsUploading(true);
        try {
            const uploadedUrls = [];
            for (let i = 0; i < files.length; i++) {
                const res = await supportService.uploadFile(files[i]);
                if (res.success) {
                    uploadedUrls.push(res.url);
                }
            }

            if (isReply) {
                setReplyAttachments(prev => [...prev, ...uploadedUrls]);
            } else {
                setCreateAttachments(prev => [...prev, ...uploadedUrls]);
            }
        } catch (err) {
            console.error('Upload failed', err);
            alert('Failed to upload file');
        } finally {
            setIsUploading(false);
        }
    };

    const handleCreateTicket = async (e) => {
        e.preventDefault();

        // Validation
        if (!createForm.subject || createForm.subject.length < 5) {
            alert("Subject must be at least 5 characters");
            return;
        }
        if (!createForm.category) {
            alert("Please select a category");
            return;
        }
        if (!createForm.message || createForm.message.length < 10) {
            alert("Message must be at least 10 characters");
            return;
        }

        setLoading(true);
        try {
            const payload = { ...createForm, attachments: createAttachments };
            const res = await supportService.createTicket(payload);
            setTickets([res, ...tickets]);
            setSelectedTicketId(res.id);
            setView('chat');
            setCreateForm({ subject: '', category: 'issue', message: '' });
            setCreateAttachments([]);
        } catch (err) {
            console.error(err);
            alert("Failed to create ticket. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    const handleSendMessage = async (e) => {
        e.preventDefault();
        if ((!replyMessage.trim() && replyAttachments.length === 0) || !currentTicket) return;

        try {
            // Optimistic? No, wait for WS or response
            await supportService.sendMessage(currentTicket.id, replyMessage, replyAttachments);
            setReplyMessage('');
            setReplyAttachments([]);
        } catch (err) {
            console.error(err);
        }
    };

    // Typing handler
    const handleTyping = () => {
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({ type: 'typing' }));
        }
    };

    const getInitials = (name) => {
        return name ? name.substring(0, 2).toUpperCase() : '??';
    };

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-50 flex items-start justify-end"
                onClick={onClose}
            >
                {/* Backdrop */}
                <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" />

                {/* Main Panel */}
                <motion.div
                    initial={{ x: 400, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    exit={{ x: 400, opacity: 0 }}
                    transition={{ type: "spring", damping: 30, stiffness: 300 }}
                    onClick={(e) => e.stopPropagation()}
                    className={`relative w-full max-w-md h-full shadow-2xl flex flex-col ${isDark ? "bg-gray-900 border-l border-white/10" : "bg-white"
                        }`}
                >
                    {/* Header */}
                    <div className={`flex items-center justify-between p-4 border-b ${isDark ? "border-white/10" : "border-gray-100"
                        }`}>
                        <div className="flex items-center gap-3">
                            {view !== 'list' && (
                                <button
                                    onClick={() => setView('list')}
                                    className={`p-1 rounded-lg ${isDark ? "hover:bg-white/10" : "hover:bg-gray-100"}`}
                                >
                                    <ChevronLeftIcon className={`w-5 h-5 ${isDark ? "text-gray-400" : "text-gray-500"}`} />
                                </button>
                            )}
                            <h2 className={`font-bold text-lg flex items-center gap-2 ${isDark ? "text-white" : "text-gray-900"}`}>
                                <TicketIcon className="w-5 h-5 text-blue-500" />
                                {view === 'create' ? 'New Ticket' : view === 'chat' ? 'Ticket Details' : 'Support Center'}
                            </h2>
                        </div>
                        <div className="flex items-center gap-2">
                            {view === 'list' && (
                                <button
                                    onClick={() => setView('create')}
                                    className="p-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition"
                                    title="Create Ticket"
                                >
                                    <PlusIcon className="w-4 h-4" />
                                </button>
                            )}
                            <button
                                onClick={onClose}
                                className={`p-2 rounded-lg transition-colors ${isDark ? "hover:bg-white/10 text-gray-400" : "hover:bg-gray-100 text-gray-500"
                                    }`}
                            >
                                <XMarkIcon className="w-5 h-5" />
                            </button>
                        </div>
                    </div>

                    {/* Content Area */}
                    <div className="flex-1 overflow-hidden relative">
                        {loading && view !== 'chat' && (
                            <div className="absolute inset-0 z-10 flex items-center justify-center bg-transparent">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
                            </div>
                        )}

                        {/* LIST VIEW */}
                        {view === 'list' && (
                            <div className="h-full overflow-y-auto p-4 space-y-3">
                                {tickets.length === 0 && !loading ? (
                                    <div className={`text-center py-10 ${isDark ? "text-gray-500" : "text-gray-400"}`}>
                                        <ChatBubbleLeftRightIcon className="w-12 h-12 mx-auto mb-2 opacity-20" />
                                        <p>No tickets found</p>
                                        <button
                                            onClick={() => setView('create')}
                                            className="mt-4 text-sm text-blue-500 hover:underline"
                                        >
                                            Start a new conversation
                                        </button>
                                    </div>
                                ) : (
                                    tickets.map(ticket => {
                                        const status = STATUS_CONFIG[ticket.status] || STATUS_CONFIG.open;
                                        const StatusIcon = status.icon;
                                        return (
                                            <div
                                                key={ticket.id}
                                                onClick={() => { setSelectedTicketId(ticket.id); setView('chat'); }}
                                                className={`p-4 rounded-xl cursor-pointer transition-all border ${isDark
                                                    ? "bg-white/5 border-white/5 hover:bg-white/10"
                                                    : "bg-white border-gray-100 hover:border-blue-200 hover:shadow-sm"
                                                    }`}
                                            >
                                                <div className="flex justify-between items-start mb-2">
                                                    <span className={`text-xs font-mono px-1.5 py-0.5 rounded ${isDark ? "bg-black/30 text-gray-400" : "bg-gray-100 text-gray-500"
                                                        }`}>
                                                        {ticket.ticket_id}
                                                    </span>
                                                    <span className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${status.color} ${status.bg}`}>
                                                        <StatusIcon className="w-3 h-3" />
                                                        {status.label}
                                                    </span>
                                                </div>
                                                <h4 className={`font-medium mb-1 ${isDark ? "text-gray-200" : "text-gray-800"}`}>
                                                    {ticket.subject}
                                                </h4>
                                                <p className={`text-xs ${isDark ? "text-gray-500" : "text-gray-400"}`}>
                                                    Updated {new Date(ticket.updated_at).toLocaleDateString()}
                                                </p>
                                            </div>
                                        )
                                    })
                                )}
                            </div>
                        )}

                        {/* CREATE VIEW */}
                        {view === 'create' && (
                            <form onSubmit={handleCreateTicket} className="p-4 space-y-4 h-full overflow-y-auto">
                                {/* Form fields... */}
                                <div>
                                    <label className={`block text-sm font-medium mb-1.5 ${isDark ? "text-gray-300" : "text-gray-700"}`}>Subject</label>
                                    <input
                                        type="text"
                                        value={createForm.subject}
                                        onChange={e => setCreateForm({ ...createForm, subject: e.target.value })}
                                        className={`w-full rounded-lg px-3 py-2 text-sm border focus:ring-2 focus:ring-blue-500 focus:outline-none ${isDark
                                            ? "bg-white/5 border-white/10 text-white"
                                            : "bg-white border-gray-200"
                                            }`}
                                        required
                                    />
                                </div>
                                {/* Reduced spacing for category */}
                                <div>
                                    <label className={`block text-sm font-medium mb-1.5 ${isDark ? "text-gray-300" : "text-gray-700"}`}>Category</label>
                                    <select
                                        value={createForm.category}
                                        onChange={e => setCreateForm({ ...createForm, category: e.target.value })}
                                        className={`w-full rounded-lg px-3 py-2 text-sm border focus:ring-2 focus:ring-blue-500 focus:outline-none ${isDark
                                            ? "bg-white/5 border-white/10 text-white"
                                            : "bg-white border-gray-200"
                                            }`}
                                    >
                                        {CATEGORIES.map(cat => <option key={cat.id} value={cat.id}>{cat.label}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className={`block text-sm font-medium mb-1.5 ${isDark ? "text-gray-300" : "text-gray-700"}`}>Message</label>
                                    <textarea
                                        value={createForm.message}
                                        onChange={e => setCreateForm({ ...createForm, message: e.target.value })}
                                        rows={6}
                                        className={`w-full rounded-lg px-3 py-2 text-sm border focus:ring-2 focus:ring-blue-500 focus:outline-none resize-none ${isDark
                                            ? "bg-white/5 border-white/10 text-white"
                                            : "bg-white border-gray-200"
                                            }`}
                                        required
                                    />
                                </div>

                                {/* Attachments for Create */}
                                <div>
                                    <div className="flex items-center gap-2 mb-2">
                                        <label
                                            htmlFor="create-file-upload"
                                            className={`cursor-pointer px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors ${isDark
                                                ? "bg-white/5 hover:bg-white/10 text-gray-300"
                                                : "bg-gray-100 hover:bg-gray-200 text-gray-600"
                                                }`}
                                        >
                                            <PaperClipIcon className="w-3.5 h-3.5" />
                                            Attach File
                                        </label>
                                        <input
                                            id="create-file-upload"
                                            type="file"
                                            multiple
                                            className="hidden"
                                            onChange={(e) => handleFileUpload(e.target.files, false)}
                                        />
                                        {isUploading && <span className="text-xs text-blue-500 animate-pulse">Uploading...</span>}
                                    </div>

                                    {/* Create Attachment List */}
                                    {createAttachments.length > 0 && (
                                        <div className="flex flex-wrap gap-2">
                                            {createAttachments.map((url, idx) => (
                                                <div key={idx} className="relative group">
                                                    <div className={`w-16 h-16 rounded-lg overflow-hidden border ${isDark ? "border-white/10" : "border-gray-200"}`}>
                                                        {url.match(/\.(jpg|jpeg|png|gif)$/i) ? (
                                                            <img src={url} alt="att" className="w-full h-full object-cover" />
                                                        ) : (
                                                            <div className="w-full h-full flex items-center justify-center bg-gray-50 dark:bg-white/5">
                                                                <DocumentIcon className="w-6 h-6 text-gray-400" />
                                                            </div>
                                                        )}
                                                    </div>
                                                    <button
                                                        onClick={() => setCreateAttachments(createAttachments.filter((_, i) => i !== idx))}
                                                        className="absolute -top-1.5 -right-1.5 p-0.5 rounded-full bg-red-500 text-white opacity-0 group-hover:opacity-100 transition"
                                                    >
                                                        <XMarkIcon className="w-3 h-3" />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                <button
                                    type="submit"
                                    disabled={loading || isUploading}
                                    className="w-full py-2.5 rounded-xl bg-blue-600 text-white font-medium text-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
                                >
                                    {loading ? 'Creating...' : 'Create Ticket'}
                                </button>
                            </form>
                        )}

                        {/* CHAT VIEW */}
                        {view === 'chat' && currentTicket && (
                            <div className="flex flex-col h-full">
                                {/* Ticket Info */}
                                <div className={`px-4 py-3 text-xs border-b ${isDark ? "border-white/5 bg-white/5" : "bg-gray-50 border-gray-100"}`}>
                                    <h3 className={`font-semibold mb-1 ${isDark ? "text-white" : "text-gray-900"}`}>
                                        {currentTicket.subject}
                                    </h3>
                                    <div className="flex items-center gap-3">
                                        <span className={`font-mono ${isDark ? "text-gray-500" : "text-gray-400"}`}>{currentTicket.ticket_id}</span>
                                        <span className={`${STATUS_CONFIG[currentTicket.status]?.color}`}>
                                            {STATUS_CONFIG[currentTicket.status]?.label}
                                        </span>
                                        <span className={`ml-auto flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] ${isConnected ? "bg-green-500/10 text-green-500" : "bg-red-500/10 text-red-500"
                                            }`}>
                                            <div className={`w-1.5 h-1.5 rounded-full ${isConnected ? "bg-green-500" : "bg-red-500"}`} />
                                            {isConnected ? "Live" : "Connecting..."}
                                        </span>
                                    </div>
                                </div>

                                {/* Messages */}
                                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                                    {currentTicket.messages.map((msg, idx) => {
                                        const isMe = msg.sender_id === currentUser.id; // Or !msg.is_admin
                                        const isSystem = !msg.sender_id;

                                        if (isSystem) {
                                            return (
                                                <div key={msg.id} className="flex justify-center my-2">
                                                    <span className={`text-xs px-2 py-1 rounded-full ${isDark ? "bg-white/10 text-gray-400" : "bg-gray-100 text-gray-500"}`}>
                                                        {msg.message}
                                                    </span>
                                                </div>
                                            )
                                        }

                                        return (
                                            <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                                                <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm flex flex-col gap-2 ${isMe
                                                    ? "bg-blue-600 text-white rounded-br-sm"
                                                    : isDark
                                                        ? "bg-white/10 text-gray-200 rounded-bl-sm"
                                                        : "bg-gray-100 text-gray-800 rounded-bl-sm"
                                                    }`}>

                                                    {/* Attachments */}
                                                    {msg.attachments && msg.attachments.length > 0 && (
                                                        <div className="flex flex-wrap gap-2 mb-1">
                                                            {msg.attachments.map((url, i) => (
                                                                <a
                                                                    key={i}
                                                                    href={url}
                                                                    target="_blank"
                                                                    rel="noopener noreferrer"
                                                                    className={`block w-32 h-24 rounded-lg overflow-hidden border ${isDark ? "border-white/10" : "border-white/20"}`}
                                                                >
                                                                    {url.match(/\.(jpg|jpeg|png|gif)$/i) ? (
                                                                        <img src={url} alt="attachment" className="w-full h-full object-cover transition-transform hover:scale-105" />
                                                                    ) : (
                                                                        <div className="w-full h-full flex flex-col items-center justify-center bg-black/20 text-xs">
                                                                            <DocumentIcon className="w-8 h-8 mb-1 opacity-70" />
                                                                            <span>File</span>
                                                                        </div>
                                                                    )}
                                                                </a>
                                                            ))}
                                                        </div>
                                                    )}

                                                    <p className="whitespace-pre-wrap">{msg.message}</p>
                                                    <p className={`text-[10px] mt-0.5 text-right opacity-70`}>
                                                        {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                    </p>
                                                </div>
                                            </div>
                                        );
                                    })}

                                    {/* Typing Indicator */}
                                    {Object.keys(typingUsers).length > 0 && !Object.keys(typingUsers).includes(currentUser?.username) && (
                                        <div className="flex justify-start">
                                            <div className={`px-4 py-2 rounded-2xl rounded-bl-sm text-xs ${isDark ? "bg-white/5 text-gray-400" : "bg-gray-100 text-gray-500"}`}>
                                                Support Agent is typing...
                                            </div>
                                        </div>
                                    )}

                                    <div ref={messagesEndRef} />
                                </div>

                                {/* Reply Input */}
                                <div className={`p-3 border-t ${isDark ? "border-white/10 bg-gray-900" : "border-gray-100 bg-white"}`}>
                                    {currentTicket.status === 'closed' ? (
                                        <div className={`text-center py-2 text-sm ${isDark ? "text-gray-500" : "text-gray-400"}`}>
                                            This ticket is closed.
                                        </div>
                                    ) : (
                                        <div className="space-y-3">
                                            {/* Reply Attachments Preview */}
                                            {replyAttachments.length > 0 && (
                                                <div className="flex gap-2 overflow-x-auto pb-2">
                                                    {replyAttachments.map((url, idx) => (
                                                        <div key={idx} className="relative group shrink-0">
                                                            <div className="w-16 h-16 rounded-lg overflow-hidden border border-white/10">
                                                                {url.match(/\.(jpg|jpeg|png|gif)$/i) ? <img src={url} className="w-full h-full object-cover" /> : <div className="p-4 bg-white/5"><DocumentIcon /></div>}
                                                            </div>
                                                            <button
                                                                onClick={() => setReplyAttachments(prev => prev.filter((_, i) => i !== idx))}
                                                                className="absolute -top-1.5 -right-1.5 p-0.5 rounded-full bg-red-500 text-white bg-opacity-90"
                                                            >
                                                                <XMarkIcon className="w-3 h-3" />
                                                            </button>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}

                                            <form onSubmit={handleSendMessage} className="flex gap-2 items-end">
                                                {/* Upload Button */}
                                                <div className="relative">
                                                    <input
                                                        id="reply-file-upload"
                                                        type="file"
                                                        multiple
                                                        className="hidden"
                                                        onChange={(e) => handleFileUpload(e.target.files, true)}
                                                    />
                                                    <label
                                                        htmlFor="reply-file-upload"
                                                        className={`p-2.5 rounded-xl flex items-center justify-center cursor-pointer transition-colors ${isDark ? "bg-white/5 hover:bg-white/10 text-gray-400" : "bg-gray-100 hover:bg-gray-200 text-gray-500"
                                                            }`}
                                                    >
                                                        <PaperClipIcon className="w-5 h-5" />
                                                    </label>
                                                </div>

                                                <input
                                                    type="text"
                                                    value={replyMessage}
                                                    onChange={e => {
                                                        setReplyMessage(e.target.value);
                                                        handleTyping();
                                                    }}
                                                    placeholder="Type your message..."
                                                    className={`flex-1 rounded-xl px-4 py-2.5 text-sm border focus:ring-2 focus:ring-blue-500 focus:outline-none ${isDark
                                                        ? "bg-white/5 border-white/10 text-white placeholder-gray-500"
                                                        : "bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-400"
                                                        }`}
                                                />
                                                <button
                                                    type="submit"
                                                    disabled={(!replyMessage.trim() && replyAttachments.length === 0) || isUploading}
                                                    className="p-2.5 rounded-xl bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
                                                >
                                                    <PaperAirplaneIcon className="w-5 h-5" />
                                                </button>
                                            </form>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
};

export default SupportCenter;
