'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs';
import { Badge } from '@/components/ui/Badge';
import { Database, Table, Play, Search, AlertCircle, Clock, Zap, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from '@/components/ui/Toaster';
import { Skeleton, TableSkeleton } from '@/components/ui/Skeleton';

interface SlowQuery {
  query: string;
  calls: number;
  total_time: number;
  mean_time: number;
  rows: number;
}

export default function DatabasePage() {
  const [stats, setStats] = useState<any>(null);
  const [tables, setTables] = useState<any[]>([]);
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [tableData, setTableData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('tables');
  
  // Slow Queries State
  const [slowQueries, setSlowQueries] = useState<SlowQuery[]>([]);
  const [loadingSlowQueries, setLoadingSlowQueries] = useState(false);
  
  // SQL Runner State
  const [query, setQuery] = useState('');
  const [queryResult, setQueryResult] = useState<any>(null);
  const [queryError, setQueryError] = useState<string | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  // Load slow queries when switching to that tab
  useEffect(() => {
    if (activeTab === 'slow' && slowQueries.length === 0) {
      loadSlowQueries();
    }
  }, [activeTab]);

  const loadData = async () => {
    try {
      const [statsRes, tablesRes] = await Promise.all([
        api.getDatabaseStats(),
        api.getDatabaseTables()
      ]);
      setStats(statsRes.data);
      setTables(tablesRes.data);
    } catch (err) {
      console.error('Failed to load database data:', err);
      toast.error('Failed to load database data');
    } finally {
      setLoading(false);
    }
  };

  const loadSlowQueries = async () => {
    setLoadingSlowQueries(true);
    try {
      const res = await api.getSlowQueries(20);
      setSlowQueries(res.data || []);
    } catch (err: any) {
      console.error('Failed to load slow queries:', err);
      toast.error('Failed to load slow queries. pg_stat_statements may not be enabled.');
    } finally {
      setLoadingSlowQueries(false);
    }
  };

  const handleViewTable = async (tableName: string) => {
    try {
      const res = await api.getTableData(tableName, 50);
      setTableData(res.data);
      setSelectedTable(tableName);
      setQueryResult(null);
    } catch (err: any) {
      toast.error(`Failed to load table: ${err.message}`);
    }
  };

  const handleExecuteQuery = async () => {
    if (!query.trim()) return;
    setIsExecuting(true);
    setQueryError(null);
    setQueryResult(null);
    
    try {
      const res = await api.executeQuery(query, true);
      setQueryResult(res.data);
      
      if (res.data.message) {
        toast.success(res.data.message);
      } else if (res.data.count !== undefined) {
        toast.success(`Query returned ${res.data.count} rows`);
      }
    } catch (err: any) {
      const error = err.response?.data?.detail || err.message;
      setQueryError(error);
      toast.error(`Query failed: ${error}`);
    } finally {
      setIsExecuting(false);
    }
  };

  const formatTime = (ms: number) => {
    if (ms >= 1000) return `${(ms / 1000).toFixed(2)}s`;
    return `${ms.toFixed(2)}ms`;
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Database Management</h2>
          <p className="text-muted-foreground">Inspect tables, view stats, and analyze performance.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <Card key={i}>
              <CardHeader className="pb-2"><Skeleton className="h-4 w-20" /></CardHeader>
              <CardContent><Skeleton className="h-8 w-16" /></CardContent>
            </Card>
          ))}
        </div>
        <TableSkeleton rows={8} columns={4} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Database Management</h2>
        <p className="text-muted-foreground">Inspect tables, view stats, and analyze performance.</p>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="relative overflow-hidden border-0 bg-gradient-to-br from-blue-500/10 via-blue-500/5 to-transparent">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Tables</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.total_tables}</div>
          </CardContent>
        </Card>
        <Card className="relative overflow-hidden border-0 bg-gradient-to-br from-purple-500/10 via-purple-500/5 to-transparent">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Size</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.total_size_mb?.toFixed(2)} MB</div>
          </CardContent>
        </Card>
        <Card className="relative overflow-hidden border-0 bg-gradient-to-br from-green-500/10 via-green-500/5 to-transparent">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Connections</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.active_connections}/{stats?.max_connections}</div>
          </CardContent>
        </Card>
        <Card className="relative overflow-hidden border-0 bg-gradient-to-br from-orange-500/10 via-orange-500/5 to-transparent">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Cache Hit Ratio</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.cache_hit_ratio?.toFixed(1)}%</div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList>
          <TabsTrigger value="tables">
            <Table className="h-4 w-4 mr-2" />
            Tables
          </TabsTrigger>
          <TabsTrigger value="query">
            <Play className="h-4 w-4 mr-2" />
            Query Runner
          </TabsTrigger>
          <TabsTrigger value="slow">
            <Clock className="h-4 w-4 mr-2" />
            Slow Queries
          </TabsTrigger>
        </TabsList>

        {/* Tables Tab */}
        <TabsContent value="tables">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="lg:col-span-1 h-[500px] flex flex-col">
              <CardHeader>
                <CardTitle>Tables</CardTitle>
                <div className="relative">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <input 
                    placeholder="Search tables..." 
                    className="w-full pl-8 pr-4 py-2 border rounded-md text-sm bg-background"
                  />
                </div>
              </CardHeader>
              <CardContent className="flex-1 overflow-y-auto p-0">
                <div className="divide-y">
                  {tables.map((table) => (
                    <button
                      key={table.name}
                      onClick={() => handleViewTable(table.name)}
                      className={cn(
                        "w-full flex items-center justify-between p-4 hover:bg-muted/50 transition-colors text-left",
                        selectedTable === table.name && "bg-muted"
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <Table className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="font-medium text-sm">{table.name}</p>
                          <p className="text-xs text-muted-foreground">{table.row_count?.toLocaleString()} rows</p>
                        </div>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {table.size_mb?.toFixed(1)} MB
                      </div>
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card className="lg:col-span-2 h-[500px] flex flex-col">
              <CardHeader className="border-b">
                <CardTitle>
                  {selectedTable ? `Data: ${selectedTable}` : 'Select a Table'}
                </CardTitle>
              </CardHeader>
              <CardContent className="flex-1 overflow-hidden p-0">
                {selectedTable && tableData ? (
                  <div className="h-full overflow-auto">
                    <table className="w-full text-sm text-left">
                      <thead className="bg-muted/50 sticky top-0">
                        <tr>
                          {tableData.columns.map((col: string) => (
                            <th key={col} className="px-4 py-3 font-medium text-muted-foreground border-b">
                              {col}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {tableData.data.map((row: any, idx: number) => (
                          <tr key={idx} className="hover:bg-muted/50">
                            {tableData.columns.map((col: string) => (
                              <td key={col} className="px-4 py-2 border-b whitespace-nowrap max-w-[200px] truncate">
                                {typeof row[col] === 'object' ? JSON.stringify(row[col]) : String(row[col] ?? '')}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-full text-muted-foreground">
                    Select a table to view its data
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Query Runner Tab */}
        <TabsContent value="query">
          <Card className="h-[500px] flex flex-col">
            <CardHeader className="border-b">
              <div className="flex items-center justify-between">
                <CardTitle>SQL Query Runner</CardTitle>
                <Badge variant="warning">Read-Only Mode</Badge>
              </div>
            </CardHeader>
            <CardContent className="flex-1 overflow-hidden p-0 flex flex-col">
              {queryResult ? (
                <div className="flex-1 overflow-auto flex flex-col">
                  <div className="p-2 bg-muted/20 border-b flex justify-between items-center">
                    <span className="text-xs font-mono text-muted-foreground">
                      {queryResult.count ? `${queryResult.count} rows` : 'Result'}
                    </span>
                    <Button variant="ghost" size="sm" onClick={() => setQueryResult(null)}>
                      Clear
                    </Button>
                  </div>
                  {queryResult.data ? (
                    <div className="flex-1 overflow-auto">
                      <table className="w-full text-sm text-left">
                        <thead className="bg-muted/50 sticky top-0">
                          <tr>
                            {queryResult.columns.map((col: string) => (
                              <th key={col} className="px-4 py-3 font-medium text-muted-foreground border-b">
                                {col}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {queryResult.data.map((row: any, idx: number) => (
                            <tr key={idx} className="hover:bg-muted/50">
                              {queryResult.columns.map((col: string) => (
                                <td key={col} className="px-4 py-2 border-b whitespace-nowrap max-w-[200px] truncate">
                                  {typeof row[col] === 'object' ? JSON.stringify(row[col]) : String(row[col] ?? '')}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="p-8 text-center text-muted-foreground font-mono text-sm">
                      {JSON.stringify(queryResult, null, 2)}
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex-1 p-6 flex flex-col">
                  <textarea
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="SELECT * FROM users LIMIT 10;"
                    className="flex-1 w-full p-4 font-mono text-sm bg-muted/30 border rounded-md resize-none focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                  <div className="mt-4 flex justify-between items-center">
                    <div className="text-sm text-muted-foreground">
                      <AlertCircle className="inline h-4 w-4 mr-1" />
                      Read-only queries only
                    </div>
                    <Button onClick={handleExecuteQuery} disabled={isExecuting}>
                      <Play className="h-4 w-4 mr-2" />
                      {isExecuting ? 'Executing...' : 'Execute Query'}
                    </Button>
                  </div>
                  {queryError && (
                    <div className="mt-4 p-4 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-md text-sm">
                      {queryError}
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Slow Queries Tab */}
        <TabsContent value="slow">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Slow Queries Analysis</CardTitle>
                  <CardDescription>Top queries by total execution time</CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={loadSlowQueries} disabled={loadingSlowQueries}>
                  <RefreshCw className={cn("h-4 w-4 mr-2", loadingSlowQueries && "animate-spin")} />
                  Refresh
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {loadingSlowQueries ? (
                <TableSkeleton rows={5} columns={4} />
              ) : slowQueries.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p className="font-medium">No slow queries found</p>
                  <p className="text-sm">pg_stat_statements extension may need to be enabled</p>
                </div>
              ) : (
                <div className="overflow-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="px-4 py-3 text-left font-medium">Query</th>
                        <th className="px-4 py-3 text-right font-medium">Calls</th>
                        <th className="px-4 py-3 text-right font-medium">Total Time</th>
                        <th className="px-4 py-3 text-right font-medium">Mean Time</th>
                        <th className="px-4 py-3 text-right font-medium">Rows</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {slowQueries.map((sq, idx) => (
                        <tr key={idx} className="hover:bg-muted/50">
                          <td className="px-4 py-3 font-mono text-xs max-w-md truncate" title={sq.query}>
                            {sq.query}
                          </td>
                          <td className="px-4 py-3 text-right">{sq.calls?.toLocaleString()}</td>
                          <td className="px-4 py-3 text-right">
                            <Badge variant={sq.total_time > 1000 ? 'destructive' : 'secondary'}>
                              {formatTime(sq.total_time)}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 text-right">{formatTime(sq.mean_time)}</td>
                          <td className="px-4 py-3 text-right">{sq.rows?.toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
