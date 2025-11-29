'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import LoadingSpinner from '@/components/LoadingSpinner';

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

  useEffect(() => {
    fetchServices();
  }, []);

  const fetchServices = async () => {
    try {
      // We can get service info from docker containers
      const response = await api.getContainers();
      const containers = response.data;
      
      // Group by service name (simplified logic)
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
    } finally {
      setLoading(false);
    }
  };

  const handleScale = (serviceName: string, currentReplicas: number) => {
    const newReplicas = prompt(`Enter number of replicas for ${serviceName}:`, currentReplicas.toString());
    if (!newReplicas || isNaN(parseInt(newReplicas))) return;
    
    // Fire and forget - don't await
    api.scaleService(serviceName, parseInt(newReplicas))
      .then(() => {
        alert(`Scaling ${serviceName} to ${newReplicas} replicas...`);
        // Refresh services after delay
        setTimeout(fetchServices, 2000);
      })
      .catch((error) => {
        console.error('Error scaling service:', error);
        alert('Failed to scale service');
      });
  };

  const handleUpdate = (serviceName: string) => {
    if (!confirm(`Are you sure you want to update ${serviceName} to latest image?`)) return;
    
    // Fire and forget - don't await
    api.updateService(serviceName)
      .then(() => {
        alert(`Update initiated for ${serviceName}`);
        setTimeout(fetchServices, 2000);
      })
      .catch((error) => {
        console.error('Error updating service:', error);
        alert('Failed to update service');
      });
  };

  const handleDeployStack = () => {
    if (!confirm('Are you sure you want to redeploy the entire stack? This may cause downtime.')) return;
    
    setDeploying(true);
    // Fire and forget - don't await
    api.deployStack()
      .then(() => {
        alert('Stack deployment initiated');
        setDeploying(false);
        setTimeout(fetchServices, 3000);
      })
      .catch((error) => {
        console.error('Error deploying stack:', error);
        alert('Failed to deploy stack');
        setDeploying(false);
      });
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Service Orchestration</h1>
          <p className="text-gray-500">Manage deployments and scaling.</p>
        </div>
        <button
          onClick={handleDeployStack}
          disabled={deploying}
          className={`px-4 py-2 rounded-md text-white transition-colors ${
            deploying ? 'bg-gray-400 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700'
          }`}
        >
          {deploying ? 'Deploying...' : 'Redeploy Stack'}
        </button>
      </div>

      <div className="bg-white shadow rounded-lg overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Service
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Image
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Replicas
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {services.map((service) => (
              <tr key={service.name} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm font-medium text-gray-900">{service.name}</div>
                  <div className="text-xs text-gray-500">Status: {service.status}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-mono">
                  {service.image}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  <span className="px-2 py-1 bg-gray-100 rounded-full text-xs font-bold">
                    {service.replicas}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-3">
                  <button
                    onClick={() => handleScale(service.name, service.replicas)}
                    className="text-indigo-600 hover:text-indigo-900 bg-indigo-50 hover:bg-indigo-100 px-3 py-1 rounded transition-colors"
                  >
                    Scale
                  </button>
                  <button
                    onClick={() => handleUpdate(service.name)}
                    className="text-green-600 hover:text-green-900 bg-green-50 hover:bg-green-100 px-3 py-1 rounded transition-colors"
                  >
                    Update Image
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
