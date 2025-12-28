'use client';

import { useEffect, useState, useMemo } from 'react';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/Dialog';
import InstrumentForm from '@/components/forms/InstrumentForm';
import { 
  Trash2, Power, Filter, Plus, Pencil, RefreshCw, Search, 
  CheckSquare, Square, PowerOff, Check, X, Upload, Download,
  ChevronDown, ChevronUp, Layers
} from 'lucide-react';
import { toast } from '@/components/ui/Toaster';

interface Instrument {
  id: number;
  symbol_id: number;
  symbol: string;
  segment_id: number;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export default function InstrumentsPage() {
  const [instruments, setInstruments] = useState<Instrument[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeOnly, setActiveOnly] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [segmentFilter, setSegmentFilter] = useState<number | ''>('');
  
  // Selection state
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  
  // Modal states
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingInstrument, setEditingInstrument] = useState<Instrument | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);
  const [bulkActionInProgress, setBulkActionInProgress] = useState(false);
  
  // Bulk import state
  const [showBulkImport, setShowBulkImport] = useState(false);
  const [bulkImportData, setBulkImportData] = useState('');

  // Sorting
  const [sortField, setSortField] = useState<'symbol' | 'symbol_id' | 'segment_id'>('symbol');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  useEffect(() => {
    loadInstruments();
  }, [activeOnly]);

  const loadInstruments = async () => {
    setLoading(true);
    try {
      const res = await api.getInstruments({ active_only: activeOnly, limit: 1000 });
      setInstruments(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error('Failed to load instruments:', err);
      toast.error('Failed to load instruments');
    } finally {
      setLoading(false);
    }
  };

  // Filter and sort instruments
  const filteredInstruments = useMemo(() => {
    let result = [...instruments];
    
    // Search filter
    if (searchTerm) {
      const query = searchTerm.toLowerCase();
      result = result.filter(i => 
        i.symbol.toLowerCase().includes(query) ||
        i.symbol_id.toString().includes(query)
      );
    }
    
    // Segment filter
    if (segmentFilter !== '') {
      result = result.filter(i => i.segment_id === segmentFilter);
    }
    
    // Sort
    result.sort((a, b) => {
      let comparison = 0;
      if (sortField === 'symbol') {
        comparison = a.symbol.localeCompare(b.symbol);
      } else if (sortField === 'symbol_id') {
        comparison = a.symbol_id - b.symbol_id;
      } else if (sortField === 'segment_id') {
        comparison = a.segment_id - b.segment_id;
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });
    
    return result;
  }, [instruments, searchTerm, segmentFilter, sortField, sortOrder]);

  // Selection helpers
  const isAllSelected = filteredInstruments.length > 0 && filteredInstruments.every(i => selectedIds.has(i.id));
  const isPartiallySelected = !isAllSelected && filteredInstruments.some(i => selectedIds.has(i.id));
  const selectedCount = selectedIds.size;

  const toggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredInstruments.map(i => i.id)));
    }
  };

  const toggleSelect = (id: number) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedIds(newSet);
  };

  const clearSelection = () => {
    setSelectedIds(new Set());
  };

  // CRUD Operations
  const handleCreate = async (data: any) => {
    try {
      await api.createInstrument(data);
      toast.success('Instrument created successfully!');
      setIsCreateOpen(false);
      loadInstruments();
    } catch (err: any) {
      toast.error(`Failed to create: ${err.response?.data?.detail || err.message}`);
    }
  };

  const handleUpdate = async (data: any) => {
    if (!editingInstrument) return;
    try {
      await api.updateInstrument(editingInstrument.id, data);
      toast.success('Instrument updated successfully!');
      setEditingInstrument(null);
      loadInstruments();
    } catch (err: any) {
      toast.error(`Failed to update: ${err.response?.data?.detail || err.message}`);
    }
  };

  const handleToggleActive = async (id: number, currentlyActive: boolean) => {
    try {
      if (currentlyActive) {
        await api.deactivateInstrument(id);
        toast.success('Instrument deactivated');
      } else {
        await api.activateInstrument(id);
        toast.success('Instrument activated');
      }
      loadInstruments();
    } catch (err: any) {
      toast.error(`Failed: ${err.message}`);
    }
  };

  const confirmDelete = async (id: number) => {
    try {
      await api.deleteInstrument(id);
      toast.success('Instrument deleted');
      setDeletingId(null);
      loadInstruments();
    } catch (err: any) {
      toast.error(`Failed: ${err.message}`);
    }
  };

  // Bulk Operations
  const handleBulkActivate = async () => {
    if (selectedIds.size === 0) return;
    setBulkActionInProgress(true);
    let successCount = 0;
    let failCount = 0;
    
    for (const id of selectedIds) {
      try {
        await api.activateInstrument(id);
        successCount++;
      } catch {
        failCount++;
      }
    }
    
    setBulkActionInProgress(false);
    toast.success(`Activated ${successCount} instruments${failCount > 0 ? `, ${failCount} failed` : ''}`);
    clearSelection();
    loadInstruments();
  };

  const handleBulkDeactivate = async () => {
    if (selectedIds.size === 0) return;
    setBulkActionInProgress(true);
    let successCount = 0;
    let failCount = 0;
    
    for (const id of selectedIds) {
      try {
        await api.deactivateInstrument(id);
        successCount++;
      } catch {
        failCount++;
      }
    }
    
    setBulkActionInProgress(false);
    toast.success(`Deactivated ${successCount} instruments${failCount > 0 ? `, ${failCount} failed` : ''}`);
    clearSelection();
    loadInstruments();
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    setBulkActionInProgress(true);
    let successCount = 0;
    let failCount = 0;
    
    for (const id of selectedIds) {
      try {
        await api.deleteInstrument(id);
        successCount++;
      } catch {
        failCount++;
      }
    }
    
    setBulkActionInProgress(false);
    setShowBulkDeleteConfirm(false);
    toast.success(`Deleted ${successCount} instruments${failCount > 0 ? `, ${failCount} failed` : ''}`);
    clearSelection();
    loadInstruments();
  };

  const handleBulkImport = async () => {
    if (!bulkImportData.trim()) return;
    
    setBulkActionInProgress(true);
    const lines = bulkImportData.trim().split('\n');
    let successCount = 0;
    let failCount = 0;
    
    for (const line of lines) {
      try {
        // Expected format: symbol_id,symbol,segment_id
        const parts = line.split(',').map(p => p.trim());
        if (parts.length >= 3) {
          await api.createInstrument({
            symbol_id: parseInt(parts[0]),
            symbol: parts[1],
            segment_id: parseInt(parts[2]),
            is_active: parts[3]?.toLowerCase() === 'true' || parts[3] === '1' || true
          });
          successCount++;
        }
      } catch {
        failCount++;
      }
    }
    
    setBulkActionInProgress(false);
    setShowBulkImport(false);
    setBulkImportData('');
    toast.success(`Imported ${successCount} instruments${failCount > 0 ? `, ${failCount} failed` : ''}`);
    loadInstruments();
  };

  const exportInstruments = () => {
    const data = filteredInstruments.map(i => 
      `${i.symbol_id},${i.symbol},${i.segment_id},${i.is_active}`
    ).join('\n');
    const header = 'symbol_id,symbol,segment_id,is_active\n';
    const blob = new Blob([header + data], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'instruments.csv';
    a.click();
  };

  const getSegmentName = (segmentId: number) => {
    switch(segmentId) {
      case 0: return 'Indices';
      case 1: return 'Stocks';
      case 5: return 'Commodities';
      default: return `Unknown`;
    }
  };

  const toggleSort = (field: 'symbol' | 'symbol_id' | 'segment_id') => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  // Stats
  const activeCount = instruments.filter(i => i.is_active).length;
  const inactiveCount = instruments.length - activeCount;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Instruments</h2>
          <p className="text-muted-foreground">Manage trading instruments with bulk operations support.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={loadInstruments} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={() => setShowBulkImport(true)}>
            <Upload className="h-4 w-4 mr-2" />
            Import
          </Button>
          <Button variant="outline" size="sm" onClick={exportInstruments}>
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          <Button onClick={() => setIsCreateOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Instrument
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="border-0 bg-gradient-to-br from-blue-500/10 via-blue-500/5 to-transparent">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{instruments.length}</div>
          </CardContent>
        </Card>
        <Card className="border-0 bg-gradient-to-br from-green-500/10 via-green-500/5 to-transparent cursor-pointer hover:shadow-md transition-shadow" onClick={() => setActiveOnly(true)}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Active</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{activeCount}</div>
          </CardContent>
        </Card>
        <Card className="border-0 bg-gradient-to-br from-gray-500/10 via-gray-500/5 to-transparent cursor-pointer hover:shadow-md transition-shadow" onClick={() => setActiveOnly(false)}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Inactive</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-600">{inactiveCount}</div>
          </CardContent>
        </Card>
        <Card className="border-0 bg-gradient-to-br from-purple-500/10 via-purple-500/5 to-transparent">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Selected</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">{selectedCount}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters & Search */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-4 items-end">
            <div className="flex-1 min-w-[200px]">
              <Label className="text-xs text-muted-foreground">Search</Label>
              <div className="relative mt-1">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search symbol or ID..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>
            <div className="w-[150px]">
              <Label className="text-xs text-muted-foreground">Segment</Label>
              <select
                value={segmentFilter}
                onChange={(e) => setSegmentFilter(e.target.value === '' ? '' : parseInt(e.target.value))}
                className="w-full mt-1 px-3 py-2 text-sm border rounded-md bg-background"
              >
                <option value="">All Segments</option>
                <option value="0">Indices (0)</option>
                <option value="1">Stocks (1)</option>
                <option value="5">Commodities (5)</option>
              </select>
            </div>
            <div className="w-[150px]">
              <Label className="text-xs text-muted-foreground">Status</Label>
              <select
                value={activeOnly ? 'active' : 'all'}
                onChange={(e) => setActiveOnly(e.target.value === 'active')}
                className="w-full mt-1 px-3 py-2 text-sm border rounded-md bg-background"
              >
                <option value="all">All Status</option>
                <option value="active">Active Only</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Bulk Actions Toolbar */}
      {selectedCount > 0 && (
        <Card className="border-primary/50 bg-primary/5">
          <CardContent className="py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <span className="font-medium">{selectedCount} selected</span>
                <Button variant="ghost" size="sm" onClick={clearSelection}>
                  <X className="h-4 w-4 mr-1" />
                  Clear
                </Button>
              </div>
              <div className="flex items-center gap-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={handleBulkActivate}
                  disabled={bulkActionInProgress}
                  className="text-green-600 border-green-600 hover:bg-green-50"
                >
                  <Power className="h-4 w-4 mr-1" />
                  Activate All
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={handleBulkDeactivate}
                  disabled={bulkActionInProgress}
                  className="text-yellow-600 border-yellow-600 hover:bg-yellow-50"
                >
                  <PowerOff className="h-4 w-4 mr-1" />
                  Deactivate All
                </Button>
                <Button 
                  variant="destructive" 
                  size="sm" 
                  onClick={() => setShowBulkDeleteConfirm(true)}
                  disabled={bulkActionInProgress}
                >
                  <Trash2 className="h-4 w-4 mr-1" />
                  Delete All
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Instruments Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Layers className="h-5 w-5" />
                Instrument List
              </CardTitle>
              <CardDescription>
                Showing {filteredInstruments.length} of {instruments.length} instruments
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="h-12 px-4 w-12">
                    <button 
                      onClick={toggleSelectAll}
                      className="flex items-center justify-center"
                    >
                      {isAllSelected ? (
                        <CheckSquare className="h-4 w-4 text-primary" />
                      ) : isPartiallySelected ? (
                        <Square className="h-4 w-4 text-primary" />
                      ) : (
                        <Square className="h-4 w-4 text-muted-foreground" />
                      )}
                    </button>
                  </th>
                  <th className="h-12 px-4 text-left font-medium">
                    <button 
                      className="flex items-center gap-1 hover:text-primary"
                      onClick={() => toggleSort('symbol_id')}
                    >
                      Symbol ID
                      {sortField === 'symbol_id' && (
                        sortOrder === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />
                      )}
                    </button>
                  </th>
                  <th className="h-12 px-4 text-left font-medium">
                    <button 
                      className="flex items-center gap-1 hover:text-primary"
                      onClick={() => toggleSort('symbol')}
                    >
                      Symbol
                      {sortField === 'symbol' && (
                        sortOrder === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />
                      )}
                    </button>
                  </th>
                  <th className="h-12 px-4 text-left font-medium">
                    <button 
                      className="flex items-center gap-1 hover:text-primary"
                      onClick={() => toggleSort('segment_id')}
                    >
                      Segment
                      {sortField === 'segment_id' && (
                        sortOrder === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />
                      )}
                    </button>
                  </th>
                  <th className="h-12 px-4 text-left font-medium">Status</th>
                  <th className="h-12 px-4 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="h-24 text-center text-muted-foreground">
                      Loading...
                    </td>
                  </tr>
                ) : filteredInstruments.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="h-24 text-center text-muted-foreground">
                      No instruments found
                    </td>
                  </tr>
                ) : (
                  filteredInstruments.map((inst) => (
                    <tr 
                      key={inst.id} 
                      className={`hover:bg-muted/50 transition-colors ${selectedIds.has(inst.id) ? 'bg-primary/5' : ''}`}
                    >
                      <td className="px-4 py-3">
                        <button onClick={() => toggleSelect(inst.id)}>
                          {selectedIds.has(inst.id) ? (
                            <CheckSquare className="h-4 w-4 text-primary" />
                          ) : (
                            <Square className="h-4 w-4 text-muted-foreground" />
                          )}
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-mono font-medium text-blue-600">{inst.symbol_id}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-semibold">{inst.symbol}</span>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant="outline">
                          {getSegmentName(inst.segment_id)} ({inst.segment_id})
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={inst.is_active ? 'success' : 'secondary'}>
                          {inst.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-1">
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => setEditingInstrument(inst)}
                          >
                            <Pencil className="h-3 w-3" />
                          </Button>
                          <Button 
                            variant="ghost"
                            size="sm"
                            onClick={() => handleToggleActive(inst.id, inst.is_active)}
                            className={inst.is_active ? "text-yellow-600" : "text-green-600"}
                          >
                            <Power className="h-3 w-3" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => setDeletingId(inst.id)}
                            className="text-red-600"
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
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

      {/* Delete Confirmation Modal */}
      <Dialog open={!!deletingId} onOpenChange={(open) => !open && setDeletingId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Deletion</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this instrument? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end space-x-2 pt-4">
            <Button variant="outline" onClick={() => setDeletingId(null)}>
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={() => deletingId && confirmDelete(deletingId)}
            >
              Delete Instrument
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Bulk Delete Confirmation */}
      <Dialog open={showBulkDeleteConfirm} onOpenChange={setShowBulkDeleteConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-red-600">⚠️ Confirm Bulk Delete</DialogTitle>
            <DialogDescription>
              You are about to delete <strong>{selectedCount} instruments</strong>. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end space-x-2 pt-4">
            <Button variant="outline" onClick={() => setShowBulkDeleteConfirm(false)}>
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleBulkDelete}
              disabled={bulkActionInProgress}
            >
              {bulkActionInProgress ? 'Deleting...' : `Delete ${selectedCount} Instruments`}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Bulk Import Modal */}
      <Dialog open={showBulkImport} onOpenChange={setShowBulkImport}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Bulk Import Instruments</DialogTitle>
            <DialogDescription>
              Paste CSV data below. Format: <code className="bg-muted px-1 rounded">symbol_id,symbol,segment_id,is_active</code>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <textarea
              value={bulkImportData}
              onChange={(e) => setBulkImportData(e.target.value)}
              placeholder="13,NIFTY,0,true&#10;42,BANKNIFTY,0,true&#10;..."
              className="w-full h-48 p-3 border rounded-md font-mono text-sm bg-background"
            />
            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={() => setShowBulkImport(false)}>
                Cancel
              </Button>
              <Button 
                onClick={handleBulkImport}
                disabled={bulkActionInProgress || !bulkImportData.trim()}
              >
                {bulkActionInProgress ? 'Importing...' : 'Import'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
