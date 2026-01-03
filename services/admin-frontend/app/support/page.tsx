'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { 
    Ticket, 
    MessageSquare, 
    Clock, 
    CheckCircle, 
    AlertCircle, 
    Search, 
    Filter,
    ChevronRight,
    Loader2 
} from 'lucide-react';
import { toast } from '@/components/ui/Toaster';

const STATUS_CONFIG = {
    open: { label: 'Open', color: 'text-green-500', bg: 'bg-green-500/10' },
    in_progress: { label: 'In Progress', color: 'text-blue-500', bg: 'bg-blue-500/10' },
    resolved: { label: 'Resolved', color: 'text-gray-500', bg: 'bg-gray-500/10' },
    closed: { label: 'Closed', color: 'text-gray-400', bg: 'bg-gray-500/10' },
};

const PRIORITY_CONFIG = {
    low: { label: 'Low', color: 'text-gray-500' },
    normal: { label: 'Normal', color: 'text-blue-500' },
    high: { label: 'High', color: 'text-orange-500' },
    urgent: { label: 'Urgent', color: 'text-red-500' },
};

interface SupportTicket {
    id: string;
    ticket_id: string;
    subject: string;
    status: 'open' | 'in_progress' | 'resolved' | 'closed';
    priority: 'low' | 'normal' | 'high' | 'urgent';
    user_name: string;
    user_email: string;
    updated_at: string;
}

export default function SupportPage() {
    const [tickets, setTickets] = useState<SupportTicket[]>([]);
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState({ total: 0, open: 0, urgent: 0 });
    const [filterStatus, setFilterStatus] = useState('');
    const [filterPriority, setFilterPriority] = useState('');

    useEffect(() => {
        loadTickets();
    }, [filterStatus, filterPriority]);

    const loadTickets = async () => {
        setLoading(true);
        try {
            const params: { status?: string; priority?: string } = {};
            if (filterStatus) params.status = filterStatus;
            if (filterPriority) params.priority = filterPriority;
            
            const res = await api.getSupportTickets(params);
            const fetchedTickets = (res.data.tickets || []) as SupportTicket[];
            setTickets(fetchedTickets);
            setStats({
                total: res.data.total,
                open: fetchedTickets.filter((t: SupportTicket) => t.status === 'open').length,
                urgent: fetchedTickets.filter((t: SupportTicket) => t.priority === 'urgent').length
            });
        } catch (error) {
            console.error(error);
            toast.error("Failed to load tickets");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-6 p-6 max-w-[1400px] mx-auto">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-3xl bg-gradient-to-br from-gray-900 via-gray-900 to-indigo-900 border border-white/5 shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-600/10 rounded-full blur-[100px] -mr-32 -mt-32" />
                
                <div className="relative z-10">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-indigo-600 rounded-lg shadow-lg shadow-indigo-600/20">
                            <Ticket className="h-6 w-6 text-white" />
                        </div>
                        <h1 className="text-3xl font-black text-white tracking-tight">Support Center</h1>
                    </div>
                    <p className="text-indigo-100/60 font-medium">Manage user inquiries and issues</p>
                </div>

                <div className="flex gap-4 relative z-10">
                    <div className="px-5 py-3 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md">
                        <p className="text-[10px] font-black uppercase tracking-widest text-indigo-400 mb-1">Open Tickets</p>
                        <p className="text-2xl font-bold text-white leading-none">{stats.open}</p>
                    </div>
                    <div className="px-5 py-3 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md">
                        <p className="text-[10px] font-black uppercase tracking-widest text-red-400 mb-1">Urgent</p>
                        <p className="text-2xl font-bold text-white leading-none">{stats.urgent}</p>
                    </div>
                </div>
            </div>

            {/* Filters & List */}
            <Card className="rounded-3xl border-0 shadow-xl">
                <CardHeader className="p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-100 dark:border-white/5">
                   <div className="flex items-center gap-2">
                       <Filter className="w-5 h-5 text-gray-400" />
                       <h3 className="font-bold text-sm text-gray-700 dark:text-gray-300">Filters</h3>
                       <select 
                           value={filterStatus}
                           onChange={(e) => setFilterStatus(e.target.value)}
                           className="ml-2 px-3 py-1.5 rounded-lg text-sm bg-gray-100 dark:bg-white/5 border-0 focus:ring-2 focus:ring-indigo-500"
                       >
                           <option value="">All Status</option>
                           <option value="open">Open</option>
                           <option value="in_progress">In Progress</option>
                           <option value="resolved">Resolved</option>
                           <option value="closed">Closed</option>
                       </select>
                       <select 
                           value={filterPriority}
                           onChange={(e) => setFilterPriority(e.target.value)}
                           className="ml-2 px-3 py-1.5 rounded-lg text-sm bg-gray-100 dark:bg-white/5 border-0 focus:ring-2 focus:ring-indigo-500"
                       >
                           <option value="">All Priority</option>
                           <option value="low">Low</option>
                           <option value="normal">Normal</option>
                           <option value="high">High</option>
                           <option value="urgent">Urgent</option>
                       </select>
                   </div>
                   <Button onClick={loadTickets} variant="outline" size="sm">
                       Refresh
                   </Button>
                </CardHeader>

                <CardContent className="p-0">
                    {loading ? (
                        <div className="flex justify-center items-center py-20">
                            <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
                        </div>
                    ) : tickets.length === 0 ? (
                        <div className="text-center py-20 text-gray-400">
                            <Ticket className="w-12 h-12 mx-auto mb-4 opacity-20" />
                            <p>No tickets found matching criteria</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead className="bg-gray-50/50 dark:bg-black/20 border-b border-gray-100 dark:border-white/5">
                                    <tr>
                                        <th className="px-6 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">Detail</th>
                                        <th className="px-6 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">User</th>
                                        <th className="px-6 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">Status</th>
                                        <th className="px-6 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">Priority</th>
                                        <th className="px-6 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">Updated</th>
                                        <th className="px-6 py-4"></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50 dark:divide-white/5">
                                    {tickets.map(ticket => {
                                        const status = STATUS_CONFIG[ticket.status] || STATUS_CONFIG.open;
                                        const priority = PRIORITY_CONFIG[ticket.priority] || PRIORITY_CONFIG.normal;
                                        return (
                                            <tr key={ticket.id} className="hover:bg-indigo-50/50 dark:hover:bg-white/5 transition-colors">
                                                <td className="px-6 py-4">
                                                    <div className="flex items-start gap-3">
                                                        <div className="p-2 rounded-lg bg-gray-100 dark:bg-white/5 text-gray-500">
                                                            <MessageSquare className="w-4 h-4" />
                                                        </div>
                                                        <div>
                                                            <p className="font-bold text-sm text-gray-900 dark:text-gray-100">{ticket.subject}</p>
                                                            <p className="text-xs text-gray-500 font-mono">{ticket.ticket_id}</p>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <p className="text-sm font-medium">{ticket.user_name || 'Unknown'}</p>
                                                    <p className="text-xs text-gray-500">{ticket.user_email}</p>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <Badge className={`${status.bg} ${status.color} border-0`}>
                                                        {status.label}
                                                    </Badge>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <span className={`text-xs font-bold uppercase ${priority.color}`}>
                                                        {priority.label}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-sm text-gray-500">
                                                    {new Date(ticket.updated_at).toLocaleDateString()}
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    <Link href={`/support/${ticket.id}`} passHref>
                                                        <Button size="sm" variant="ghost">
                                                            <ChevronRight className="w-4 h-4" />
                                                        </Button>
                                                    </Link>
                                                </td>
                                            </tr>
                                        )
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
