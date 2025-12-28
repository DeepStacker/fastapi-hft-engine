'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { DataTable, Column } from '@/components/ui/DataTable';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/Dialog';
import { Rocket, RefreshCw, Scale, Box, Layers } from 'lucide-react';
import { toast } from '@/components/ui/Toaster';
import { TableSkeleton } from '@/components/ui/Skeleton';

interface ServiceStatus {
  name: string;
  replicas: number;
  image: string;
  status: string;
}

export default function OrchestrationPage() {
  const [services, setServices] = useState<ServiceStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [deploying, setDeploying] = useState(false);
  
  // Scale dialog state
  const [isScaleDialogOpen, setIsScaleDialogOpen] = useState(false);
  const [scaleTarget, setScaleTarget] = useState<ServiceStatus | null>(null);
  const [newReplicaCount, setNewReplicaCount] = useState('1');

  useEffect(() => {
    fetchServices();
  }, []);

  const fetchServices = async () => {
    try {
      const response = await api.getContainers();
      const containers = response.data;
      
      const serviceMap = new Map<string, ServiceStatus>();
      
      containers.forEach((c: any) => {
        const name = c.name.replace('stockify-', '').replace(/-\d+$/, '');
        if (!serviceMap.has(name)) {
          serviceMap.set(name, {
            name,
            replicas: 0,
            image: c.image,
            status: 'running'
          });
        }
        const service = serviceMap.get(name)!;
        service.replicas++;
      });
      
      setServices(Array.from(serviceMap.values()));
    } catch (error) {
      console.error('Error fetching services:', error);
      toast.error('Failed to fetch services');
    } finally {
      setLoading(false);
    }
  };

  const openScaleDialog = (service: ServiceStatus) => {
    setScaleTarget(service);
    setNewReplicaCount(service.replicas.toString());
    setIsScaleDialogOpen(true);
  };

  const handleScale = async () => {
    if (!scaleTarget) return;
    
    const replicas = parseInt(newReplicaCount);
    if (isNaN(replicas) || replicas < 0) {
      toast.error('Please enter a valid replica count');
      return;
    }
    
    try {
      await api.scaleService(scaleTarget.name, replicas);
      toast.success(`Scaling ${scaleTarget.name} to ${replicas} replicas...`);
      setIsScaleDialogOpen(false);
      setTimeout(fetchServices, 2000);
    } catch (error) {
      console.error('Error scaling service:', error);
      toast.error('Failed to scale service');
    }
  };

  const handleUpdate = async (serviceName: string) => {
    try {
      await api.updateService(serviceName);
      toast.success(`Update initiated for ${serviceName}`);
      setTimeout(fetchServices, 2000);
    } catch (error) {
      console.error('Error updating service:', error);
      toast.error('Failed to update service');
    }
  };

  const handleDeployStack = async () => {
    setDeploying(true);
    try {
      await api.deployStack();
      toast.success('Stack deployment initiated');
      setTimeout(fetchServices, 3000);
    } catch (error) {
      console.error('Error deploying stack:', error);
      toast.error('Failed to deploy stack');
    } finally {
      setDeploying(false);
    }
  };

  const columns: Column<ServiceStatus>[] = [
    {
      header: 'Service',
      accessorKey: 'name',
      cell: (row) => (
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-lg">
            <Box className="h-4 w-4 text-primary" />
          </div>
          <div>
            <div className="font-medium">{row.name}</div>
            <div className="text-xs text-muted-foreground font-mono">{row.image}</div>
          </div>
        </div>
      )
    },
    {
      header: 'Replicas',
      accessorKey: 'replicas',
      cell: (row) => (
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="text-lg font-bold px-3">
            {row.replicas}
          </Badge>
          <span className="text-muted-foreground text-sm">instance{row.replicas !== 1 ? 's' : ''}</span>
        </div>
      )
    },
    {
      header: 'Status',
      accessorKey: 'status',
      cell: (row) => (
        <Badge variant="success">{row.status}</Badge>
      )
    },
    {
      header: 'Actions',
      cell: (row) => (
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => openScaleDialog(row)}
          >
            <Scale className="h-3 w-3 mr-1" />
            Scale
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => handleUpdate(row.name)}
          >
            <RefreshCw className="h-3 w-3 mr-1" />
            Update
          </Button>
        </div>
      )
    }
  ];

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Service Orchestration</h2>
          <p className="text-muted-foreground">Manage deployments, scaling, and updates.</p>
        </div>
        <TableSkeleton rows={6} columns={4} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Service Orchestration</h2>
          <p className="text-muted-foreground">Manage deployments, scaling, and updates.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={fetchServices}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button onClick={handleDeployStack} disabled={deploying}>
            <Rocket className="h-4 w-4 mr-2" />
            {deploying ? 'Deploying...' : 'Redeploy Stack'}
          </Button>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="relative overflow-hidden border-0 bg-gradient-to-br from-blue-500/10 via-blue-500/5 to-transparent">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Services</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{services.length}</div>
          </CardContent>
        </Card>
        <Card className="relative overflow-hidden border-0 bg-gradient-to-br from-green-500/10 via-green-500/5 to-transparent">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Instances</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {services.reduce((acc, s) => acc + s.replicas, 0)}
            </div>
          </CardContent>
        </Card>
        <Card className="relative overflow-hidden border-0 bg-gradient-to-br from-purple-500/10 via-purple-500/5 to-transparent">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Running</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">
              {services.filter(s => s.status === 'running').length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Services Table */}
      <Card>
        <CardHeader>
          <CardTitle>Services</CardTitle>
          <CardDescription>Manage individual service scaling and updates</CardDescription>
        </CardHeader>
        <CardContent>
          <DataTable data={services} columns={columns} searchKey="name" />
        </CardContent>
      </Card>

      {/* Scale Dialog */}
      <Dialog open={isScaleDialogOpen} onOpenChange={setIsScaleDialogOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Scale Service</DialogTitle>
            <DialogDescription>
              Set the number of replicas for <strong>{scaleTarget?.name}</strong>
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="replicas">Number of Replicas</Label>
            <Input
              id="replicas"
              type="number"
              min="0"
              max="10"
              value={newReplicaCount}
              onChange={(e) => setNewReplicaCount(e.target.value)}
              className="mt-2"
            />
            <p className="text-xs text-muted-foreground mt-2">
              Current: {scaleTarget?.replicas} replica{scaleTarget?.replicas !== 1 ? 's' : ''}
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsScaleDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleScale}>
              <Scale className="h-4 w-4 mr-2" />
              Scale Service
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
