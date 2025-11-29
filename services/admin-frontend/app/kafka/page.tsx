'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { DataTable } from '@/components/ui/DataTable';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/Dialog';
import { Input } from '@/components/ui/Input';
import { Trash2, Plus, RefreshCw } from 'lucide-react';

export default function KafkaPage() {
  const [topics, setTopics] = useState<any[]>([]);
  const [consumerGroups, setConsumerGroups] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newTopic, setNewTopic] = useState({ name: '', partitions: 3, replication_factor: 1 });

  useEffect(() => {
    loadData();
    
    // WebSocket for real-time updates
    const token = localStorage.getItem('access_token');
    if (!token) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = process.env.NEXT_PUBLIC_API_URL 
      ? process.env.NEXT_PUBLIC_API_URL.replace(/^https?:\/\//, '')
      : 'localhost:8001';
      
    const wsUrl = `${protocol}//${host}/kafka/ws?token=${token}`;
    console.log('Connecting to Kafka WebSocket:', wsUrl);

    let ws: WebSocket | null = null;
    let timeoutId: NodeJS.Timeout;

    const connect = () => {
      try {
        ws = new WebSocket(wsUrl);

        ws.onopen = () => {
          console.log('✅ Connected to Kafka WebSocket');
        };

        ws.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data);
            if (message.type === 'kafka_update') {
              setTopics(message.data.topics);
              setConsumerGroups(message.data.groups);
            }
          } catch (err) {
            console.error('Failed to parse WS message:', err);
          }
        };

        ws.onerror = (error) => {
          console.error('WebSocket error:', error);
        };

        ws.onclose = (event) => {
          console.log('Kafka WebSocket closed:', event.code, event.reason);
        };

      } catch (e) {
        console.error('Kafka WebSocket connection failed:', e);
      }
    };

    // Debounce connection
    timeoutId = setTimeout(connect, 100);

    return () => {
      clearTimeout(timeoutId);
      if (ws) {
        ws.close();
      }
    };
  }, []);

  const loadData = async () => {
    try {
      const [topicsRes, groupsRes] = await Promise.all([
        api.getKafkaTopics(),
        api.getKafkaConsumerGroups()
      ]);
      setTopics(topicsRes.data);
      setConsumerGroups(groupsRes.data);
    } catch (err) {
      console.error('Failed to load Kafka data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTopic = async () => {
    try {
      await api.createKafkaTopic(newTopic);
      alert('✅ Topic created successfully!');
      setShowCreateModal(false);
      setNewTopic({ name: '', partitions: 3, replication_factor: 1 });
      loadData();
    } catch (err: any) {
      alert(`❌ Failed to create topic: ${err.message}`);
    }
  };

  const handleDeleteTopic = async (name: string) => {
    if (confirm(`Delete topic "${name}"? This cannot be undone!`)) {
      try {
        await api.deleteKafkaTopic(name);
        alert('✅ Topic deleted');
        loadData();
      } catch (err: any) {
        alert(`❌ Failed: ${err.message}`);
      }
    }
  };

  const topicColumns = [
    { header: 'Topic Name', accessorKey: 'name' },
    { header: 'Partitions', accessorKey: 'partitions' },
    { header: 'Replication', accessorKey: 'replication_factor' },
    {
      header: 'Actions',
      cell: (row: any) => (
        <Button 
          variant="destructive" 
          size="sm"
          onClick={() => handleDeleteTopic(row.name)}
        >
          <Trash2 className="h-3 w-3 mr-1" />
          Delete
        </Button>
      )
    }
  ];

  const groupColumns = [
    { header: 'Group ID', accessorKey: 'group_id' },
    { 
      header: 'Topics', 
      cell: (row: any) => row.topics.join(', ') 
    },
    { header: 'Members', accessorKey: 'members' },
    { 
      header: 'Total Lag', 
      accessorKey: 'total_lag',
      cell: (row: any) => (
        <Badge variant={row.total_lag > 0 ? 'warning' : 'success'}>
          {row.total_lag}
        </Badge>
      )
    }
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Kafka Management</h2>
          <p className="text-muted-foreground">Manage topics and monitor consumer groups.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={loadData}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button onClick={() => setShowCreateModal(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Create Topic
          </Button>
        </div>
      </div>

      <Tabs defaultValue="topics">
        <TabsList>
          <TabsTrigger value="topics">Topics ({topics.length})</TabsTrigger>
          <TabsTrigger value="consumers">Consumer Groups ({consumerGroups.length})</TabsTrigger>
        </TabsList>
        
        <TabsContent value="topics">
          <Card>
            <CardHeader>
              <CardTitle>Topics</CardTitle>
            </CardHeader>
            <CardContent>
              <DataTable data={topics} columns={topicColumns} searchKey="name" />
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="consumers">
          <Card>
            <CardHeader>
              <CardTitle>Consumer Groups</CardTitle>
            </CardHeader>
            <CardContent>
              <DataTable data={consumerGroups} columns={groupColumns} searchKey="group_id" />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Create New Topic</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <label>Topic Name</label>
              <Input
                value={newTopic.name}
                onChange={(e) => setNewTopic({ ...newTopic, name: e.target.value })}
                placeholder="market.data"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <label>Partitions</label>
                <Input
                  type="number"
                  value={newTopic.partitions}
                  onChange={(e) => setNewTopic({ ...newTopic, partitions: parseInt(e.target.value) })}
                />
              </div>
              <div className="grid gap-2">
                <label>Replication</label>
                <Input
                  type="number"
                  value={newTopic.replication_factor}
                  onChange={(e) => setNewTopic({ ...newTopic, replication_factor: parseInt(e.target.value) })}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateModal(false)}>Cancel</Button>
            <Button onClick={handleCreateTopic}>Create Topic</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
