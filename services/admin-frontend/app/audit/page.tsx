'use client';

import { useEffect, useState, useMemo } from 'react';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { DataTable, Column } from '@/components/ui/DataTable';
import { Badge } from '@/components/ui/Badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/Dialog';
import { RefreshCw, ShieldCheck, Eye, Users, Settings, Database, Layers, Zap, Filter, X, ArrowUpDown, Calendar, Search } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { EmptyState } from '@/components/ui/EmptyState';
import { TableSkeleton } from '@/components/ui/Skeleton';
import { toast } from '@/components/ui/Toaster';

interface AuditLog {
  id: string;
  timestamp: string;
  action: string;
  resource_type: string;
  resource_id: string | null;
  actor_id: string | null;
  details: Record<string, any> | null;
  ip_address: string | null;
  status: string;
}

const RESOURCE_ICONS: Record<string, any> = {
  USER: Users,
  CONFIG: Settings,
  INSTRUMENT: Zap,
  KAFKA_TOPIC: Layers,
  SERVICE: Database,
  DEPLOYMENT: Database,
  DHAN_TOKENS: Settings,
};

const ACTION_COLORS: Record<string, string> = {
  CREATE: 'success',
  DELETE: 'destructive',
  UPDATE: 'warning',
  ACTIVATE: 'success',
  DEACTIVATE: 'secondary',
  RESTART: 'warning',
  RELOAD_CONFIG: 'default',
  SCALE: 'warning',
  UPDATE_IMAGE: 'warning',
  DEPLOY_STACK: 'default',
};

const ALL_ACTIONS = ['CREATE', 'UPDATE', 'DELETE', 'ACTIVATE', 'DEACTIVATE', 'RESTART', 'RELOAD_CONFIG', 'SCALE', 'UPDATE_IMAGE', 'DEPLOY_STACK'];
const ALL_RESOURCES = ['USER', 'CONFIG', 'INSTRUMENT', 'KAFKA_TOPIC', 'SERVICE', 'DEPLOYMENT', 'DHAN_TOKENS'];

export default function AuditPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
  
  // Filters
  const [showFilters, setShowFilters] = useState(false);
  const [actionFilter, setActionFilter] = useState<string>('');
  const [resourceFilter, setResourceFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');
  
  // Sorting
  const [sortField, setSortField] = useState<'timestamp' | 'action' | 'resource_type'>('timestamp');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  useEffect(() => {
    loadLogs();
  }, []);

  const loadLogs = async () => {
    try {
      setLoading(true);
      const res = await api.getAuditLogs({ limit: 500 });
      setLogs(res.data);
    } catch (err) {
      console.error('Failed to load audit logs:', err);
      toast.error('Failed to load audit logs');
    } finally {
      setLoading(false);
    }
  };

  // Filter and sort logs
  const filteredLogs = useMemo(() => {
    let result = [...logs];
    
    // Apply action filter
    if (actionFilter) {
      result = result.filter(log => log.action === actionFilter);
    }
    
    // Apply resource filter
    if (resourceFilter) {
      result = result.filter(log => log.resource_type === resourceFilter);
    }
    
    // Apply status filter
    if (statusFilter) {
      result = result.filter(log => log.status === statusFilter);
    }
    
    // Apply search query (searches in resource_id and details)
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(log => 
        (log.resource_id?.toLowerCase().includes(query)) ||
        (log.ip_address?.toLowerCase().includes(query)) ||
        (JSON.stringify(log.details)?.toLowerCase().includes(query))
      );
    }
    
    // Apply date range filter
    if (dateFrom) {
      const fromDate = new Date(dateFrom);
      result = result.filter(log => new Date(log.timestamp) >= fromDate);
    }
    if (dateTo) {
      const toDate = new Date(dateTo);
      toDate.setHours(23, 59, 59, 999);
      result = result.filter(log => new Date(log.timestamp) <= toDate);
    }
    
    // Apply sorting
    result.sort((a, b) => {
      let comparison = 0;
      if (sortField === 'timestamp') {
        comparison = new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
      } else if (sortField === 'action') {
        comparison = a.action.localeCompare(b.action);
      } else if (sortField === 'resource_type') {
        comparison = a.resource_type.localeCompare(b.resource_type);
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });
    
    return result;
  }, [logs, actionFilter, resourceFilter, statusFilter, searchQuery, dateFrom, dateTo, sortField, sortOrder]);

  const clearFilters = () => {
    setActionFilter('');
    setResourceFilter('');
    setStatusFilter('');
    setSearchQuery('');
    setDateFrom('');
    setDateTo('');
  };

  const hasActiveFilters = actionFilter || resourceFilter || statusFilter || searchQuery || dateFrom || dateTo;

  const toggleSort = (field: 'timestamp' | 'action' | 'resource_type') => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };

  const columns: Column<AuditLog>[] = [
    {
      header: (
        <button 
          className="flex items-center gap-1 hover:text-primary transition-colors"
          onClick={() => toggleSort('timestamp')}
        >
          Timestamp
          <ArrowUpDown className={`h-3 w-3 ${sortField === 'timestamp' ? 'text-primary' : ''}`} />
        </button>
      ),
      accessorKey: 'timestamp',
      cell: (row) => (
        <div className="text-sm">
          <div>{new Date(row.timestamp).toLocaleDateString()}</div>
          <div className="text-xs text-muted-foreground">
            {new Date(row.timestamp).toLocaleTimeString()}
          </div>
        </div>
      )
    },
    {
      header: (
        <button 
          className="flex items-center gap-1 hover:text-primary transition-colors"
          onClick={() => toggleSort('action')}
        >
          Action
          <ArrowUpDown className={`h-3 w-3 ${sortField === 'action' ? 'text-primary' : ''}`} />
        </button>
      ),
      accessorKey: 'action',
      cell: (row) => (
        <Badge variant={(ACTION_COLORS[row.action] || 'default') as any}>
          {row.action}
        </Badge>
      )
    },
    {
      header: (
        <button 
          className="flex items-center gap-1 hover:text-primary transition-colors"
          onClick={() => toggleSort('resource_type')}
        >
          Resource
          <ArrowUpDown className={`h-3 w-3 ${sortField === 'resource_type' ? 'text-primary' : ''}`} />
        </button>
      ),
      accessorKey: 'resource_type',
      cell: (row) => {
        const Icon = RESOURCE_ICONS[row.resource_type] || ShieldCheck;
        return (
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-muted rounded">
              <Icon className="h-3.5 w-3.5" />
            </div>
            <div>
              <div className="font-medium">{row.resource_type}</div>
              {row.resource_id && (
                <div className="text-xs text-muted-foreground font-mono">
                  {row.resource_id.length > 20 
                    ? `${row.resource_id.substring(0, 20)}...` 
                    : row.resource_id}
                </div>
              )}
            </div>
          </div>
        );
      }
    },
    {
      header: 'IP Address',
      accessorKey: 'ip_address',
      cell: (row) => (
        <span className="font-mono text-xs">{row.ip_address || '-'}</span>
      )
    },
    {
      header: 'Status',
      accessorKey: 'status',
      cell: (row) => (
        <Badge variant={row.status === 'success' ? 'success' : 'destructive'}>
          {row.status}
        </Badge>
      )
    },
    {
      header: 'Details',
      cell: (row) => (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setSelectedLog(row)}
        >
          <Eye className="h-4 w-4 mr-1" />
          View
        </Button>
      )
    }
  ];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Audit Logs</h2>
          <p className="text-muted-foreground">Track administrative actions across all resources.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            variant={showFilters ? "secondary" : "outline"} 
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
          >
            <Filter className="h-4 w-4 mr-2" />
            Filters
            {hasActiveFilters && (
              <Badge variant="default" className="ml-2 h-5 w-5 p-0 flex items-center justify-center text-xs">
                !
              </Badge>
            )}
          </Button>
          <Button onClick={loadLogs} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Filters Panel */}
      {showFilters && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Filters</CardTitle>
              {hasActiveFilters && (
                <Button variant="ghost" size="sm" onClick={clearFilters}>
                  <X className="h-4 w-4 mr-1" />
                  Clear All
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-4">
              {/* Search */}
              <div className="lg:col-span-2">
                <Label className="text-xs text-muted-foreground">Search</Label>
                <div className="relative mt-1">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search resource ID, IP, details..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-8"
                  />
                </div>
              </div>
              
              {/* Action Filter */}
              <div>
                <Label className="text-xs text-muted-foreground">Action</Label>
                <select
                  value={actionFilter}
                  onChange={(e) => setActionFilter(e.target.value)}
                  className="w-full mt-1 px-3 py-2 text-sm border rounded-md bg-background"
                >
                  <option value="">All Actions</option>
                  {ALL_ACTIONS.map(action => (
                    <option key={action} value={action}>{action}</option>
                  ))}
                </select>
              </div>
              
              {/* Resource Filter */}
              <div>
                <Label className="text-xs text-muted-foreground">Resource Type</Label>
                <select
                  value={resourceFilter}
                  onChange={(e) => setResourceFilter(e.target.value)}
                  className="w-full mt-1 px-3 py-2 text-sm border rounded-md bg-background"
                >
                  <option value="">All Resources</option>
                  {ALL_RESOURCES.map(resource => (
                    <option key={resource} value={resource}>{resource}</option>
                  ))}
                </select>
              </div>
              
              {/* Status Filter */}
              <div>
                <Label className="text-xs text-muted-foreground">Status</Label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full mt-1 px-3 py-2 text-sm border rounded-md bg-background"
                >
                  <option value="">All Statuses</option>
                  <option value="success">Success</option>
                  <option value="failure">Failure</option>
                </select>
              </div>

              {/* Date Range */}
              <div className="lg:col-span-2 xl:col-span-1">
                <Label className="text-xs text-muted-foreground">Date Range</Label>
                <div className="flex gap-2 mt-1">
                  <Input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                    className="text-xs"
                    placeholder="From"
                  />
                  <Input
                    type="date"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                    className="text-xs"
                    placeholder="To"
                  />
                </div>
              </div>
            </div>
            
            {/* Results count */}
            <div className="mt-4 text-sm text-muted-foreground">
              Showing <strong>{filteredLogs.length}</strong> of <strong>{logs.length}</strong> logs
              {hasActiveFilters && " (filtered)"}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="relative overflow-hidden border-0 bg-gradient-to-br from-green-500/10 via-green-500/5 to-transparent cursor-pointer hover:shadow-md transition-shadow" onClick={() => setActionFilter('CREATE')}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Creates</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {logs.filter(l => l.action === 'CREATE').length}
            </div>
          </CardContent>
        </Card>
        <Card className="relative overflow-hidden border-0 bg-gradient-to-br from-yellow-500/10 via-yellow-500/5 to-transparent cursor-pointer hover:shadow-md transition-shadow" onClick={() => setActionFilter('UPDATE')}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Updates</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">
              {logs.filter(l => l.action === 'UPDATE').length}
            </div>
          </CardContent>
        </Card>
        <Card className="relative overflow-hidden border-0 bg-gradient-to-br from-red-500/10 via-red-500/5 to-transparent cursor-pointer hover:shadow-md transition-shadow" onClick={() => setActionFilter('DELETE')}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Deletes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {logs.filter(l => l.action === 'DELETE').length}
            </div>
          </CardContent>
        </Card>
        <Card className="relative overflow-hidden border-0 bg-gradient-to-br from-blue-500/10 via-blue-500/5 to-transparent cursor-pointer hover:shadow-md transition-shadow" onClick={() => { setActionFilter(''); setShowFilters(true); }}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Other Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {logs.filter(l => !['CREATE', 'UPDATE', 'DELETE'].includes(l.action)).length}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5" />
            Activity Log
          </CardTitle>
          <CardDescription>
            Click column headers to sort. Use filters above to narrow down results.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <TableSkeleton rows={5} columns={6} />
          ) : filteredLogs.length === 0 ? (
            <EmptyState
              icon="file"
              title={hasActiveFilters ? "No matching logs" : "No audit logs yet"}
              description={hasActiveFilters 
                ? "Try adjusting your filters or clearing them to see all logs."
                : "Audit logs appear when admin actions are performed."
              }
              action={hasActiveFilters ? {
                label: "Clear Filters",
                onClick: clearFilters
              } : {
                label: "Go to Traders",
                onClick: () => window.location.href = '/traders'
              }}
            />
          ) : (
            <DataTable 
              data={filteredLogs} 
              columns={columns} 
              searchKey="resource_type"
            />
          )}
        </CardContent>
      </Card>

      {/* Detail Modal */}
      <Dialog open={!!selectedLog} onOpenChange={() => setSelectedLog(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Badge variant={(ACTION_COLORS[selectedLog?.action || ''] || 'default') as any}>
                {selectedLog?.action}
              </Badge>
              <span>{selectedLog?.resource_type}</span>
            </DialogTitle>
            <DialogDescription>
              {selectedLog?.timestamp && new Date(selectedLog.timestamp).toLocaleString()}
              {selectedLog?.ip_address && ` • IP: ${selectedLog.ip_address}`}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            {/* Resource Info */}
            <div className="p-4 bg-muted/50 rounded-lg space-y-2">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <div className="text-muted-foreground">Resource Type</div>
                  <div className="font-medium">{selectedLog?.resource_type}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Resource ID</div>
                  <div className="font-mono text-xs break-all">
                    {selectedLog?.resource_id || 'N/A'}
                  </div>
                </div>
                <div>
                  <div className="text-muted-foreground">Status</div>
                  <Badge variant={selectedLog?.status === 'success' ? 'success' : 'destructive'}>
                    {selectedLog?.status}
                  </Badge>
                </div>
                <div>
                  <div className="text-muted-foreground">Actor ID</div>
                  <div className="font-mono text-xs">
                    {selectedLog?.actor_id || 'System'}
                  </div>
                </div>
              </div>
            </div>

            {/* Details Section */}
            {selectedLog?.details && Object.keys(selectedLog.details).length > 0 && (
              <div>
                <h4 className="font-medium mb-2">Change Details</h4>
                <div className="p-4 bg-muted/30 rounded-lg border">
                  <div className="space-y-3">
                    {Object.entries(selectedLog.details).map(([key, value]) => (
                      <div key={key} className="text-sm">
                        <div className="text-muted-foreground font-medium capitalize">
                          {key.replace(/_/g, ' ')}
                        </div>
                        <div className="mt-1">
                          {typeof value === 'object' && value !== null ? (
                            <div className="flex items-center gap-2 flex-wrap">
                              {value.old !== undefined && (
                                <span className="px-2 py-1 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded text-xs font-mono">
                                  {String(value.old)}
                                </span>
                              )}
                              {value.old !== undefined && value.new !== undefined && (
                                <span className="text-muted-foreground">→</span>
                              )}
                              {value.new !== undefined && (
                                <span className="px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded text-xs font-mono">
                                  {String(value.new)}
                                </span>
                              )}
                              {value.old === undefined && value.new === undefined && (
                                <pre className="text-xs font-mono bg-muted p-2 rounded overflow-auto max-h-32 w-full">
                                  {JSON.stringify(value, null, 2)}
                                </pre>
                              )}
                            </div>
                          ) : Array.isArray(value) ? (
                            <div className="flex flex-wrap gap-1">
                              {value.map((item, i) => (
                                <Badge key={i} variant="secondary" className="text-xs">{String(item)}</Badge>
                              ))}
                            </div>
                          ) : (
                            <span className="font-mono text-xs bg-muted px-2 py-1 rounded">
                              {String(value)}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
            
            {/* Raw JSON */}
            <details className="text-sm">
              <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                View Raw JSON
              </summary>
              <pre className="mt-2 p-3 bg-muted rounded-lg overflow-auto text-xs font-mono max-h-40">
                {JSON.stringify(selectedLog, null, 2)}
              </pre>
            </details>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
