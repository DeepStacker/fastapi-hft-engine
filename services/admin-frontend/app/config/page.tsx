'use client';

import { useEffect, useState, useMemo } from 'react';
import { api } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { 
  RefreshCw, 
  Search,
  Power
} from 'lucide-react';
import { TradingSchedule } from '@/components/TradingSchedule';
import { toast } from '@/components/ui/Toaster';
import { motion, AnimatePresence } from 'framer-motion';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/Dialog';
import { ConfigSidebar } from '@/components/ConfigSidebar';
import { ConfigRow, ConfigItem } from '@/components/ConfigRow';

export default function ConfigPage() {
  const [allConfigs, setAllConfigs] = useState<ConfigItem[]>([]);
  const [categories, setCategories] = useState<string[]>(['all']);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    title: string;
    description: string;
    action: () => void;
  } | null>(null);

  useEffect(() => {
    loadCategories();
    loadConfigs();
    
    // WebSocket
    const token = localStorage.getItem('access_token');
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${wsProtocol}//localhost:8001/config/ws?token=${token}`;
    const ws = new WebSocket(wsUrl);

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        if (message.type === 'config_update') {
          // Optimistic updates happen locally, but this ensures sync
          setAllConfigs(message.data);
        }
      } catch (err) {
        console.error('Failed to parse WS message:', err);
      }
    };

    return () => ws.close();
  }, []);

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
      const res = await api.getConfigs();
      setAllConfigs(res.data);
    } catch (err) {
      console.error('Failed to load configs:', err);
    } finally {
      setLoading(false);
    }
  };

  const currentConfigs = useMemo(() => {
    return allConfigs.filter(c => {
      // 1. Filter by Category
      const matchesCategory = selectedCategory === 'all' || selectedCategory === 'trading' || c.category === selectedCategory;
      
      // 2. Filter by Search (Global scope if searching)
      const matchesSearch = searchQuery === '' || 
        c.key.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.description?.toLowerCase().includes(searchQuery.toLowerCase());
        
      // If searching, ignore category unless specific category selected (VS Code behavior)
      // Actually VS Code searches within category if selected. Let's keep strict intersection.
      return matchesCategory && matchesSearch;
    });
  }, [allConfigs, selectedCategory, searchQuery]);

  // Determine category counts for sidebar
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    categories.forEach(cat => {
        if (cat === 'all') {
            counts[cat] = allConfigs.length;
        } else {
            counts[cat] = allConfigs.filter(c => c.category === cat).length;
        }
    });
    return counts;
  }, [allConfigs, categories]);


  const handleUpdate = async (key: string, value: string) => {
    try {
      // Optimistic Update
      setAllConfigs(prev => prev.map(c => c.key === key ? { ...c, value } : c));
      
      await api.updateConfig(key, value);
      toast.success(`Updated ${key}`);
      // loadConfigs(); // API refresh not strictly needed with optimistic + WS
    } catch (err: any) {
      toast.error(`Failed to update: ${err.message}`);
      loadConfigs(); // Revert on failure
    }
  };

  const handleReset = async (key: string) => {
     setConfirmDialog({
      open: true,
      title: 'Reset Configuration',
      description: `Reset "${key}" to default?`,
      action: async () => {
        try {
          await api.deleteConfig(key);
          toast.success(`Configuration reset`);
          loadConfigs();
        } catch (err: any) {
           toast.error(`Failed to reset: ${err.message}`);
        }
      }
    });
  };
  
  const handleRestartService = () => {
     // deduce service from category
     const serviceMap: Record<string, string> = {
      'ingestion': 'ingestion',
      'storage': 'storage',
      'gateway': 'gateway',
      'realtime': 'realtime',
      'database': 'timescaledb',
      'kafka': 'kafka'
    };
    const serviceName = serviceMap[selectedCategory];
    
    if (serviceName) {
        setConfirmDialog({
            open: true,
            title: `Restart ${serviceName}?`,
            description: `Service will be briefly unavailable.`,
            action: async () => {
                await api.restartService(serviceName);
                toast.success(`Restarting ${serviceName}...`);
            }
        });
    }
  };

  const handleInitialize = () => {
    setConfirmDialog({
      open: true,
      title: 'Initialize Defaults',
      description: 'Create missing default configurations?',
      action: async () => {
        await api.initializeConfigs();
        toast.success('Initialized defaults');
        loadConfigs();
      }
    });
  };

  if (loading && allConfigs.length === 0) {
    return <div className="flex h-[50vh] items-center justify-center"><div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full"/></div>;
  }

  return (
    <div className="flex flex-col h-[calc(100vh-100px)] -m-6 p-6 gap-6">
       {/* Top Header Area */}
       <div className="flex items-center justify-between shrink-0">
         <div>
            <h1 className="text-2xl font-bold tracking-tight">System Settings</h1>
            <p className="text-muted-foreground text-sm">Manage global configuration params</p>
         </div>
         <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleInitialize}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Defaults
            </Button>
         </div>
       </div>

       <Card className="flex-1 overflow-hidden border-border/60 shadow-sm flex flex-col md:flex-row bg-card/50 backdrop-blur-sm">
          {/* Sidebar */}
          <ConfigSidebar 
            categories={categories.filter(c => c !== 'trading')} 
            selectedCategory={selectedCategory} 
            onSelectCategory={setSelectedCategory}
            counts={categoryCounts}
            className="hidden md:flex shrink-0 bg-muted/10"
          />

          {/* Main Content Area */}
          <div className="flex-1 flex flex-col min-w-0 bg-background">
             {/* Search Header */}
             <div className="p-4 border-b border-border/40 flex items-center justify-between gap-4">
                <div className="relative flex-1 max-w-lg">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input 
                        placeholder={`Search ${selectedCategory === 'all' ? 'all' : selectedCategory} settings...`}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-9 bg-muted/20 border-transparent focus:bg-background focus:border-input transition-all"
                    />
                </div>
                {selectedCategory !== 'all' && selectedCategory !== 'trading' && (
                    <Button variant="ghost" size="sm" onClick={handleRestartService} className="text-orange-500 hover:text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-900/20">
                        <Power className="h-4 w-4 mr-2" />
                        Restart Service
                    </Button>
                )}
             </div>

             {/* Scrollable List */}
             <div className="flex-1 overflow-y-auto p-2">
                {selectedCategory === 'trading' ? (
                     <TradingSchedule configs={allConfigs} onUpdate={loadConfigs} />
                ) : (
                    <div className="space-y-0.5 max-w-5xl mx-auto">
                        {currentConfigs.length === 0 ? (
                            <div className="text-center py-20 text-muted-foreground">
                                <Search className="h-10 w-10 mx-auto mb-3 opacity-20" />
                                <p>No settings found "{searchQuery}"</p>
                            </div>
                        ) : (
                            // Group by prefix for better visual scanning
                            Object.entries(currentConfigs.reduce((acc, conf) => {
                                const group = conf.key.split('_')[0].toUpperCase();
                                if (!acc[group]) acc[group] = [];
                                acc[group].push(conf);
                                return acc;
                            }, {} as Record<string, ConfigItem[]>)).map(([group, configs]) => (
                                <motion.div 
                                    key={group}
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    className="mb-6"
                                >
                                    {selectedCategory === 'all' && (
                                        <h4 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2 mt-4 px-2 border-b border-border/40 pb-1">
                                            {group}
                                        </h4>
                                    )}
                                    <div className="space-y-1">
                                        {configs.map(config => (
                                            <ConfigRow 
                                                key={config.key} 
                                                config={config} 
                                                onUpdate={handleUpdate}
                                                onReset={handleReset}
                                            />
                                        ))}
                                    </div>
                                </motion.div>
                            ))
                        )}
                    </div>
                )}
             </div>
          </div>
       </Card>

       {/* Confirmation Dialog */}
       <Dialog open={confirmDialog?.open || false} onOpenChange={(open) => !open && setConfirmDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{confirmDialog?.title}</DialogTitle>
            <DialogDescription>{confirmDialog?.description}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDialog(null)}>Cancel</Button>
            <Button onClick={() => { confirmDialog?.action(); setConfirmDialog(null); }}>Confirm</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
