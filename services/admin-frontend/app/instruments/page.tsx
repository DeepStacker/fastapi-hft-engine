'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { DataTable } from '@/components/ui/DataTable';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/Dialog';
import InstrumentForm from '@/components/forms/InstrumentForm';
import { Trash2, Power, Filter, Plus, Pencil } from 'lucide-react';

export default function InstrumentsPage() {
  const [instruments, setInstruments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeOnly, setActiveOnly] = useState(false);
  
  // Modal states
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingInstrument, setEditingInstrument] = useState<any>(null);

  useEffect(() => {
    loadInstruments();
    
    // WebSocket for real-time updates
    const token = localStorage.getItem('access_token');
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${wsProtocol}//localhost:8001/instruments/ws?token=${token}`;
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      console.log('✅ Connected to Instruments WebSocket');
    };

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        if (message.type === 'instruments_update') {
          // Filter if activeOnly is set
          const data = activeOnly 
            ? message.data.filter((i: any) => i.is_active)
            : message.data;
          setInstruments(data);
        }
      } catch (err) {
        console.error('Failed to parse WS message:', err);
      }
    };

    return () => {
      ws.close();
    };
  }, [activeOnly]);

  const loadInstruments = async () => {
    setLoading(true);
    try {
      const res = await api.getInstruments({ active_only: activeOnly, limit: 100 });
      setInstruments(res.data);
    } catch (err) {
      console.error('Failed to load instruments:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (data: any) => {
    try {
      await api.createInstrument(data);
      alert('✅ Instrument created successfully!');
      setIsCreateOpen(false);
      loadInstruments();
    } catch (err: any) {
      alert(`❌ Failed to create: ${err.response?.data?.detail || err.message}`);
    }
  };

  const handleUpdate = async (data: any) => {
    if (!editingInstrument) return;
    try {
      await api.updateInstrument(editingInstrument.id, data);
      alert('✅ Instrument updated successfully!');
      setEditingInstrument(null);
      loadInstruments();
    } catch (err: any) {
      alert(`❌ Failed to update: ${err.response?.data?.detail || err.message}`);
    }
  };

  const handleToggleActive = async (id: number, currentlyActive: boolean) => {
    try {
      if (currentlyActive) {
        await api.deactivateInstrument(id);
      } else {
        await api.activateInstrument(id);
      }
      // No alert needed as WS will update UI
      loadInstruments();
    } catch (err: any) {
      alert(`❌ Failed: ${err.message}`);
    }
  };

  const handleDelete = async (id: number) => {
    if (confirm('Delete this instrument?')) {
      try {
        await api.deleteInstrument(id);
        alert('✅ Instrument deleted');
        loadInstruments();
      } catch (err: any) {
        alert(`❌ Failed: ${err.message}`);
      }
    }
  };

  const columns = [
    { header: 'ID', accessorKey: 'id' },
    { 
      header: 'Symbol', 
      accessorKey: 'symbol_id',
      cell: (row: any) => <span className="font-mono font-medium">{row.symbol_id}</span>
    },
    { header: 'Name', accessorKey: 'name' },
    { header: 'Exchange', accessorKey: 'exchange' },
    { 
      header: 'Type', 
      accessorKey: 'instrument_type',
      cell: (row: any) => <Badge variant="outline">{row.instrument_type}</Badge>
    },
    {
      header: 'Status',
      accessorKey: 'is_active',
      cell: (row: any) => (
        <Badge variant={row.is_active ? 'success' : 'secondary'}>
          {row.is_active ? 'Active' : 'Inactive'}
        </Badge>
      )
    },
    {
      header: 'Actions',
      cell: (row: any) => (
        <div className="flex space-x-2">
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => setEditingInstrument(row)}
          >
            <Pencil className="h-3 w-3 mr-1" />
            Edit
          </Button>
          <Button 
            variant={row.is_active ? "secondary" : "default"}
            size="sm"
            onClick={() => handleToggleActive(row.id, row.is_active)}
            className={!row.is_active ? "bg-green-600 hover:bg-green-700" : ""}
          >
            <Power className="h-3 w-3 mr-1" />
            {row.is_active ? 'Deactivate' : 'Activate'}
          </Button>
          <Button 
            variant="destructive" 
            size="sm"
            onClick={() => handleDelete(row.id)}
          >
            <Trash2 className="h-3 w-3 mr-1" />
            Delete
          </Button>
        </div>
      )
    }
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Instruments</h2>
          <p className="text-muted-foreground">Manage trading instruments and their active status.</p>
        </div>
        <div className="flex space-x-2">
          <Button 
            variant={activeOnly ? "default" : "outline"}
            onClick={() => setActiveOnly(!activeOnly)}
          >
            <Filter className="h-4 w-4 mr-2" />
            {activeOnly ? 'Showing Active Only' : 'Show All'}
          </Button>
          <Button onClick={() => setIsCreateOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Instrument
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Instrument List</CardTitle>
          <CardDescription>
            {instruments.length} instruments found.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DataTable 
            data={instruments} 
            columns={columns} 
            searchKey="symbol_id"
          />
        </CardContent>
      </Card>

      {/* Create Modal */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Instrument</DialogTitle>
          </DialogHeader>
          <InstrumentForm 
            onSubmit={handleCreate}
            onCancel={() => setIsCreateOpen(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Edit Modal */}
      <Dialog open={!!editingInstrument} onOpenChange={(open) => !open && setEditingInstrument(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Instrument</DialogTitle>
          </DialogHeader>
          {editingInstrument && (
            <InstrumentForm 
              initialData={editingInstrument}
              onSubmit={handleUpdate}
              onCancel={() => setEditingInstrument(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
