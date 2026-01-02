'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { DataTable, Column } from '@/components/ui/DataTable';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/Dialog';
import { Select } from '@/components/ui/Select';
import { Label } from '@/components/ui/Label';
import { 
  Users, 
  Search, 
  RefreshCw,
  MoreHorizontal,
  Plus,
  Trash2,
  Edit
} from 'lucide-react';
import { toast } from '@/components/ui/Toaster';
import { TableSkeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { motion } from 'framer-motion';

interface Trader {
  id: string;
  username: string;
  email: string;
  role: string;
  is_active: boolean;
  created_at: string;
  full_name?: string;
  firebase_uid?: string;
}

export default function TradersPage() {
  const [traders, setTraders] = useState<Trader[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Dialog States
  const [iscreateOpen, setIsCreateOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [selectedTrader, setSelectedTrader] = useState<Trader | null>(null);

  // Form States
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    role: 'user',
    full_name: '',
    firebase_uid: '',
  });

  const fetchTraders = async () => {
    setLoading(true);
    try {
      const response = await api.getTraders({ search });
      setTraders(response.data);
    } catch (error) {
      console.error('Failed to fetch traders:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTraders();
    const interval = setInterval(fetchTraders, 30000);
    return () => clearInterval(interval);
  }, [search]); 

  const toggleStatus = async (id: string, currentStatus: boolean) => {
    try {
      await api.updateTrader(id, { is_active: !currentStatus });
      fetchTraders();
    } catch (error) {
        console.error("Failed to update status", error);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
        await api.createTrader({
            ...formData,
            firebase_uid: formData.firebase_uid || crypto.randomUUID(), // Auto-generate if empty
            is_active: true
        });
        setIsCreateOpen(false);
        setFormData({ username: '', email: '', role: 'user', full_name: '', firebase_uid: '' });
        toast.success('Trader created successfully');
        fetchTraders();
    } catch (error) {
        console.error("Failed to create trader", error);
        toast.error('Failed to create user. Ensure email/username are unique.');
    }
  };

  const handleDelete = async () => {
    if (!selectedTrader) return;
    try {
        await api.deleteTrader(selectedTrader.id);
        setIsDeleteOpen(false);
        setSelectedTrader(null);
        toast.success(`Trader ${selectedTrader.username} deleted`);
        fetchTraders();
    } catch (error) {
        console.error("Failed to delete trader", error);
        toast.error('Failed to delete trader');
    }
  };

  const columns: Column<Trader>[] = [
    {
      header: 'User',
      accessorKey: 'username',
      cell: (row) => (
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xs">
            {row.username?.[0]?.toUpperCase() || 'U'}
          </div>
          <div>
            <div className="font-semibold">{row.username}</div>
            <div className="text-xs text-muted-foreground">{row.email}</div>
          </div>
        </div>
      )
    },
    {
      header: 'Role',
      accessorKey: 'role',
      cell: (row) => {
        const variant = row.role === 'admin' ? 'default' : 
                        row.role === 'premium' ? 'warning' : 'secondary';
        return <Badge variant={variant as any}>{row.role?.toUpperCase()}</Badge>;
      }
    },
    {
      header: 'Status',
      accessorKey: 'is_active',
      cell: (row) => (
        <Badge variant={row.is_active ? 'success' : 'destructive'}>
          {row.is_active ? 'ACTIVE' : 'INACTIVE'}
        </Badge>
      )
    },
    {
      header: 'Created',
      accessorKey: 'created_at',
      cell: (row) => (
        <span className="text-muted-foreground">
          {row.created_at ? new Date(row.created_at).toLocaleDateString() : 'N/A'}
        </span>
      )
    },
    {
      header: 'Actions',
      cell: (row) => (
        <div className="flex items-center gap-2">
            <Button 
            variant="outline" 
            size="sm"
            onClick={() => toggleStatus(row.id, row.is_active)}
            className={row.is_active ? 'text-destructive border-destructive/20 hover:bg-destructive/10' : 'text-green-600 border-green-600/20 hover:bg-green-50'}
            >
            {row.is_active ? 'Disable' : 'Enable'}
            </Button>
            <Button
                variant="ghost"
                size="icon"
                className="text-destructive hover:bg-destructive/10"
                onClick={() => {
                    setSelectedTrader(row);
                    setIsDeleteOpen(true);
                }}
            >
                <Trash2 className="w-4 h-4" />
            </Button>
        </div>
      )
    }
  ];

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Traders</h2>
          <p className="text-muted-foreground">Manage user access, roles, and CRUD operations.</p>
        </div>
        <div className="flex items-center gap-2">
            <Button onClick={() => setIsCreateOpen(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Add Trader
            </Button>
            <Button variant="outline" size="icon" onClick={fetchTraders}>
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`}/>
            </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle>All Traders</CardTitle>
            <div className="relative w-64">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input 
                    placeholder="Search users..." 
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-8"
                />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <DataTable 
            data={traders} 
            columns={columns} 
            pageSize={10}
          />
        </CardContent>
      </Card>

      {/* Create Dialog */}
      <Dialog open={iscreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
                <DialogTitle>Create New Trader</DialogTitle>
                <DialogDescription>
                    Add a new user to the platform. They will need these credentials to login.
                </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreate} className="grid gap-4 py-4">
                <div className="grid gap-2">
                    <Label htmlFor="username">Username</Label>
                    <Input 
                        id="username" 
                        value={formData.username} 
                        onChange={e => setFormData({...formData, username: e.target.value})}
                        required
                    />
                </div>
                <div className="grid gap-2">
                    <Label htmlFor="email">Email</Label>
                    <Input 
                        id="email" 
                        type="email"
                        value={formData.email} 
                        onChange={e => setFormData({...formData, email: e.target.value})}
                        required
                    />
                </div>
                <div className="grid gap-2">
                    <Label htmlFor="fullname">Full Name</Label>
                    <Input 
                        id="fullname" 
                        value={formData.full_name} 
                        onChange={e => setFormData({...formData, full_name: e.target.value})}
                    />
                </div>
                <div className="grid gap-2">
                    <Label htmlFor="role">Role</Label>
                    <Select 
                        id="role"
                        value={formData.role} 
                        onChange={(e: any) => setFormData({...formData, role: e.target.value})}
                    >
                        <option value="user">Trader</option>
                        <option value="premium">Premium</option>
                        <option value="admin">Admin</option>
                    </Select>
                </div>
                <div className="grid gap-2">
                    <Label htmlFor="uid">Firebase UID (Optional)</Label>
                    <Input 
                        id="uid" 
                        placeholder="Auto-generated if empty"
                        value={formData.firebase_uid} 
                        onChange={e => setFormData({...formData, firebase_uid: e.target.value})}
                    />
                </div>
                <DialogFooter>
                    <Button type="submit">Create User</Button>
                </DialogFooter>
            </form>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
                <DialogTitle>Delete Trader</DialogTitle>
                <DialogDescription>
                    Are you sure you want to delete <strong>{selectedTrader?.username}</strong>? This action cannot be undone.
                </DialogDescription>
            </DialogHeader>
            <DialogFooter>
                <Button variant="outline" onClick={() => setIsDeleteOpen(false)}>Cancel</Button>
                <Button variant="destructive" onClick={handleDelete}>Delete User</Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
