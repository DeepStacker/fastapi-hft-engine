'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { DataTable } from '@/components/ui/DataTable';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs';
import { Switch } from '@/components/ui/Switch';
import { RefreshCw, Save, X, Edit2, RotateCcw, Power } from 'lucide-react';
import { TradingSchedule } from '@/components/TradingSchedule';

export default function ConfigPage() {
  const [allConfigs, setAllConfigs] = useState<any[]>([]);
  const [categories, setCategories] = useState<string[]>(['all']);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [loading, setLoading] = useState(true);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

  // Filter configs for the table view
  const tableConfigs = selectedCategory === 'all' || selectedCategory === 'trading'
    ? allConfigs 
    : allConfigs.filter(c => c.category === selectedCategory);

  useEffect(() => {
    loadCategories();
    loadConfigs();
    
    // WebSocket for real-time updates
    const token = localStorage.getItem('access_token');
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${wsProtocol}//localhost:8001/config/ws?token=${token}`;
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      console.log('✅ Connected to Config WebSocket');
    };

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        if (message.type === 'config_update') {
          // Update local state if we are not editing
          if (!editingKey) {
            setAllConfigs(message.data);
          }
        }
      } catch (err) {
        console.error('Failed to parse WS message:', err);
      }
    };

    ws.onclose = () => console.log('WS Closed');

    return () => {
      ws.close();
    };
  }, [editingKey]); // Removed selectedCategory dependency as we filter on render

  const loadCategories = async () => {
    try {
      const res = await api.getConfigCategories();
      setCategories(['all', ...(res.data.categories || [])]);
    } catch (err) {
      console.error('Failed to load categories:', err);
    }
  };

  const loadConfigs = async () => {
    setLoading(true);
    try {
      // Always fetch all configs
      const res = await api.getConfigs();
      setAllConfigs(res.data);
    } catch (err) {
      console.error('Failed to load configs:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdate = async (key: string, value: string) => {
    try {
      await api.updateConfig(key, value);
      setEditingKey(null);
      loadConfigs();
    } catch (err: any) {
      alert(`❌ Failed to update: ${err.message}`);
    }
  };

  const handleInitialize = async () => {
    if (confirm('Initialize all default configs? This will not overwrite existing custom values.')) {
      try {
        await api.initializeConfigs();
        loadConfigs();
      } catch (err: any) {
        alert(`❌ Failed: ${err.message}`);
      }
    }
  };

  const handleReset = async (key: string) => {
    if (confirm(`Reset '${key}' to default value?`)) {
      try {
        await api.deleteConfig(key);
        loadConfigs();
      } catch (err: any) {
        alert(`❌ Failed to reset: ${err.message}`);
      }
    }
  };

  const handleRestartService = async (category: string) => {
    // Map category to service name if possible, otherwise ask user
    const serviceMap: Record<string, string> = {
      'ingestion': 'ingestion',
      'storage': 'storage',
      'gateway': 'gateway',
      'realtime': 'realtime',
      'database': 'timescaledb', // Approximate
      'kafka': 'kafka'
    };
    
    const serviceName = serviceMap[category];
    if (serviceName) {
      if (confirm(`Restart ${serviceName} service to apply changes?`)) {
        // Fire and forget - don't await
        api.restartService(serviceName)
          .then(() => {
            alert(`✅ Service ${serviceName} restarting...`);
          })
          .catch((err: any) => {
            alert(`❌ Failed to restart: ${err.message}`);
          });
      }
    } else {
      alert("Please restart the relevant service manually from the Services page.");
    }
  };

  const renderEditInput = (row: any) => {
    if (row.data_type === 'bool' || row.value === 'true' || row.value === 'false') {
       return (
         <div className="flex items-center gap-2">
           <Switch 
             checked={editValue === 'true'}
             onCheckedChange={(checked) => setEditValue(checked ? 'true' : 'false')}
           />
           <span className="text-sm">{editValue}</span>
           <Button size="sm" onClick={() => handleUpdate(row.key, editValue)}>Save</Button>
           <Button size="sm" variant="ghost" onClick={() => setEditingKey(null)}>Cancel</Button>
         </div>
       );
    }
    
    return (
      <div className="flex items-center gap-2">
        <Input 
          type={row.data_type === 'int' ? 'number' : 'text'}
          value={editValue} 
          onChange={(e) => setEditValue(e.target.value)}
          className="h-8 w-48"
          autoFocus
        />
        <Button size="icon" className="h-8 w-8" onClick={() => handleUpdate(row.key, editValue)}>
          <Save className="h-4 w-4" />
        </Button>
        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setEditingKey(null)}>
          <X className="h-4 w-4" />
        </Button>
      </div>
    );
  };

  const columns = [
    {
      header: 'Key',
      accessorKey: 'key',
      cell: (row: any) => (
        <div>
          <div className="font-medium text-sm">{row.key}</div>
          <div className="text-xs text-muted-foreground">{row.description}</div>
          {row.requires_restart && (
            <Badge variant="warning" className="mt-1 text-[10px] px-1 py-0">Restart Required</Badge>
          )}
        </div>
      )
    },
    {
      header: 'Value',
      accessorKey: 'value',
      cell: (row: any) => {
        if (editingKey === row.key) {
          return renderEditInput(row);
        }
        return (
          <div className="flex items-center gap-2 group">
            <code className="bg-muted px-2 py-1 rounded text-sm font-mono">
              {String(row.value)}
            </code>
            <Button 
              size="icon" 
              variant="ghost" 
              className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={() => {
                setEditingKey(row.key);
                setEditValue(String(row.value));
              }}
            >
              <Edit2 className="h-3 w-3" />
            </Button>
          </div>
        );
      }
    },
    {
      header: 'Type',
      accessorKey: 'data_type',
      cell: (row: any) => <Badge variant="outline" className="text-xs">{row.data_type || 'string'}</Badge>
    },
    {
      header: 'Actions',
      id: 'actions',
      cell: (row: any) => (
        <div className="flex items-center gap-2">
           <Button 
             size="icon" 
             variant="ghost" 
             title="Reset to Default"
             onClick={() => handleReset(row.key)}
           >
             <RotateCcw className="h-4 w-4 text-muted-foreground hover:text-primary" />
           </Button>
        </div>
      )
    }
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Configuration</h2>
          <p className="text-muted-foreground">Manage system-wide settings and feature flags.</p>
        </div>
        <Button onClick={handleInitialize} variant="outline" className="text-green-600 hover:text-green-700 hover:bg-green-50">
          <RefreshCw className="h-4 w-4 mr-2" />
          Initialize Defaults
        </Button>
      </div>

      <Tabs defaultValue="all" value={selectedCategory} onValueChange={setSelectedCategory} className="w-full">
        <TabsList className="mb-4 flex flex-wrap h-auto">
          <TabsTrigger value="trading">Trading Schedule</TabsTrigger>
          {categories.map(cat => (
            <TabsTrigger key={cat} value={cat} className="capitalize">
              {cat}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="trading">
          <TradingSchedule configs={allConfigs} onUpdate={loadConfigs} />
        </TabsContent>

        <TabsContent value={selectedCategory}>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="capitalize">{selectedCategory} Settings</CardTitle>
                <CardDescription>
                  {tableConfigs.length} configuration items found
                </CardDescription>
              </div>
              {selectedCategory !== 'all' && selectedCategory !== 'trading' && (
                 <Button 
                   variant="secondary" 
                   size="sm" 
                   onClick={() => handleRestartService(selectedCategory)}
                 >
                   <Power className="h-4 w-4 mr-2" />
                   Restart {selectedCategory} Service
                 </Button>
              )}
            </CardHeader>
            <CardContent>
              <DataTable 
                data={tableConfigs} 
                columns={columns} 
                searchKey="key"
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
