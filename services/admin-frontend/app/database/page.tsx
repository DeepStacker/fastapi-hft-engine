'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Database, Table, Play, Search, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function DatabasePage() {
  const [stats, setStats] = useState<any>(null);
  const [tables, setTables] = useState<any[]>([]);
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [tableData, setTableData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  
  // SQL Runner State
  const [query, setQuery] = useState('');
  const [queryResult, setQueryResult] = useState<any>(null);
  const [queryError, setQueryError] = useState<string | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

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
    } finally {
      setLoading(false);
    }
  };

  const handleViewTable = async (tableName: string) => {
    try {
      const res = await api.getTableData(tableName, 50);
      setTableData(res.data);
      setSelectedTable(tableName);
      setQueryResult(null); // Clear manual query results
    } catch (err: any) {
      alert(`❌ Failed to load table: ${err.message}`);
    }
  };

  const handleExecuteQuery = async () => {
    if (!query.trim()) return;
    setIsExecuting(true);
    setQueryError(null);
    setQueryResult(null);
    
    try {
      const res = await api.executeQuery(query, true); // Default to read-only for safety
      setQueryResult(res.data);
      
      if (res.data.message) {
        alert(`✅ ${res.data.message}`);
      }
    } catch (err: any) {
      setQueryError(err.response?.data?.detail || err.message);
    } finally {
      setIsExecuting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Database Management</h2>
        <p className="text-muted-foreground">Inspect tables, view stats, and analyze performance.</p>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Tables</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.total_tables}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Size</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.total_size_mb?.toFixed(2)} MB</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Connections</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.active_connections}/{stats?.max_connections}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Cache Hit Ratio</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.cache_hit_ratio?.toFixed(1)}%</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Tables List (Sidebar style) */}
        <Card className="lg:col-span-1 h-[600px] flex flex-col">
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

        {/* Main Content Area (Data Viewer or SQL Runner) */}
        <Card className="lg:col-span-2 h-[600px] flex flex-col">
          <CardHeader className="border-b">
            <div className="flex items-center justify-between">
              <CardTitle>
                {selectedTable ? `Data: ${selectedTable}` : 'Query Runner'}
              </CardTitle>
              <div className="flex gap-2">
                <Button 
                  variant={!selectedTable ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedTable(null)}
                >
                  SQL Editor
                </Button>
              </div>
            </div>
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
                            {typeof row[col] === 'object' ? JSON.stringify(row[col]) : String(row[col])}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : queryResult ? (
              <div className="h-full overflow-auto flex flex-col">
                <div className="p-2 bg-muted/20 border-b flex justify-between items-center">
                  <span className="text-xs font-mono text-muted-foreground">
                    {queryResult.count ? `${queryResult.count} rows` : 'Result'}
                  </span>
                  <Button variant="ghost" size="sm" onClick={() => setQueryResult(null)}>
                    Clear
                  </Button>
                </div>
                {queryResult.data ? (
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
                              {typeof row[col] === 'object' ? JSON.stringify(row[col]) : String(row[col])}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div className="p-8 text-center text-muted-foreground">
                    {JSON.stringify(queryResult, null, 2)}
                  </div>
                )}
              </div>
            ) : (
              <div className="p-6 h-full flex flex-col">
                <textarea
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="SELECT * FROM users LIMIT 10;"
                  className="flex-1 w-full p-4 font-mono text-sm bg-muted/30 border rounded-md resize-none focus:outline-none focus:ring-2 focus:ring-primary"
                />
                <div className="mt-4 flex justify-between items-center">
                  <div className="text-sm text-muted-foreground">
                    <AlertCircle className="inline h-4 w-4 mr-1" />
                    Read-only queries recommended
                  </div>
                  <Button onClick={handleExecuteQuery} disabled={isExecuting}>
                    <Play className="h-4 w-4 mr-2" />
                    Execute Query
                  </Button>
                </div>
                {queryError && (
                  <div className="mt-4 p-4 bg-red-50 text-red-600 rounded-md text-sm">
                    {queryError}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
