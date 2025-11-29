#!/bin/bash

# Final Admin Pages - Instruments, Database, Services

set -e

FRONTEND_DIR="services/admin-frontend"

echo "🚀 Creating final admin pages..."

cd "$FRONTEND_DIR"

# ===========================================
# Instruments Page
# ===========================================
echo "📊 Creating Instruments page..."
cat > app/instruments/page.tsx << 'EOF'
'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import LoadingSpinner from '@/components/LoadingSpinner';

export default function InstrumentsPage() {
  const [instruments, setInstruments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeOnly, setActiveOnly] = useState(false);

  useEffect(() => {
    loadInstruments();
  }, [activeOnly]);

  const loadInstruments = async () => {
    try {
      const res = await api.getInstruments({ active_only: activeOnly, limit: 100 });
      setInstruments(res.data);
    } catch (err) {
      console.error('Failed to load instruments:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleActive = async (id: number, currentlyActive: boolean) => {
    try {
      if (currentlyActive) {
        await api.deactivateInstrument(id);
      } else {
        await api.activateInstrument(id);
      }
      alert('✅ Status updated!');
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

  if (loading) return <LoadingSpinner />;

  return (
    <div className="max-w-7xl mx-auto p-8">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Instruments Management</h1>
        <label className="flex items-center space-x-2">
          <input
            type="checkbox"
            checked={activeOnly}
            onChange={(e) => setActiveOnly(e.target.checked)}
            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          <span className="text-sm font-medium text-gray-700">Active Only</span>
        </label>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                ID
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Symbol ID
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Name
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Exchange
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Type
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {instruments.map((instrument) => (
              <tr key={instrument.id}>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {instrument.id}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                  {instrument.symbol_id}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {instrument.name}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                  {instrument.exchange}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                  {instrument.instrument_type}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`px-2 py-1 text-xs rounded-full ${
                    instrument.is_active
                      ? 'bg-green-100 text-green-800'
                      : 'bg-gray-100 text-gray-800'
                  }`}>
                    {instrument.is_active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm space-x-2">
                  <button
                    onClick={() => handleToggleActive(instrument.id, instrument.is_active)}
                    className={`px-3 py-1 rounded ${
                      instrument.is_active
                        ? 'bg-yellow-600 hover:bg-yellow-700'
                        : 'bg-green-600 hover:bg-green-700'
                    } text-white`}
                  >
                    {instrument.is_active ? 'Deactivate' : 'Activate'}
                  </button>
                  <button
                    onClick={() => handleDelete(instrument.id)}
                    className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700"
                  >
                    Delete
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
EOF

# ===========================================
# Database Page
# ===========================================
echo "🗄️ Creating Database page..."
cat > app/database/page.tsx << 'EOF'
'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import LoadingSpinner from '@/components/LoadingSpinner';

export default function DatabasePage() {
  const [stats, setStats] = useState<any>(null);
  const [tables, setTables] = useState<any[]>([]);
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [tableData, setTableData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

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
      const res = await api.getTableData(tableName, { limit: 50 });
      setTableData(res.data);
      setSelectedTable(tableName);
    } catch (err: any) {
      alert(`❌ Failed to load table: ${err.message}`);
    }
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="max-w-7xl mx-auto p-8">
      <h1 className="text-3xl font-bold text-gray-900 mb-8">Database Management</h1>

      {/* Database Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-sm text-gray-600">Total Tables</div>
          <div className="text-2xl font-bold">{stats?.total_tables}</div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-sm text-gray-600">Database Size</div>
          <div className="text-2xl font-bold">{stats?.total_size_mb?.toFixed(2)} MB</div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-sm text-gray-600">Connections</div>
          <div className="text-2xl font-bold">
            {stats?.active_connections}/{stats?.max_connections}
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-sm text-gray-600">Cache Hit Ratio</div>
          <div className="text-2xl font-bold">{stats?.cache_hit_ratio?.toFixed(1)}%</div>
        </div>
      </div>

      {/* Tables List */}
      <div className="bg-white rounded-lg shadow overflow-hidden mb-8">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">Tables</h2>
        </div>
        <table className="min-w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Table Name
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Row Count
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Size (MB)
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Indexes
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {tables.map((table) => (
              <tr key={table.name}>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                  {table.name}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                  {table.row_count?.toLocaleString()}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                  {table.size_mb?.toFixed(2)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                  {table.indexes?.length || 0}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  <button
                    onClick={() => handleViewTable(table.name)}
                    className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
                  >
                    View Data
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Table Data Viewer */}
      {selectedTable && tableData && (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-900">
              {selectedTable} ({tableData.total} rows)
            </h2>
            <button
              onClick={() => setSelectedTable(null)}
              className="px-3 py-1 bg-gray-300 text-gray-700 rounded hover:bg-gray-400"
            >
              Close
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  {tableData.columns.map((col: string) => (
                    <th key={col} className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {tableData.data.slice(0, 50).map((row: any, idx: number) => (
                  <tr key={idx}>
                    {tableData.columns.map((col: string) => (
                      <td key={col} className="px-4 py-2 whitespace-nowrap text-gray-600">
                        {JSON.stringify(row[col])}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
EOF

# ===========================================
# Services Page
# ===========================================
echo "⚙️ Creating Services page..."
cat > app/services/page.tsx << 'EOF'
'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import LoadingSpinner from '@/components/LoadingSpinner';

export default function ServicesPage() {
  const [services, setServices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadServices();
    const interval = setInterval(loadServices, 5000);
    return () => clearInterval(interval);
  }, []);

  const loadServices = async () => {
    try {
      const res = await api.getServices();
      setServices(res.data);
    } catch (err) {
      console.error('Failed to load services:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleRestart = async (serviceName: string) => {
    if (confirm(`Restart ${serviceName}?`)) {
      try {
        await api.restartService(serviceName);
        alert('✅ Restart queued');
      } catch (err: any) {
        alert(`❌ Failed: ${err.message}`);
      }
    }
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="max-w-7xl mx-auto p-8">
      <h1 className="text-3xl font-bold text-gray-900 mb-8">Services Monitoring</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {services.map((service) => (
          <div key={service.name} className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-xl font-semibold text-gray-900">{service.name}</h3>
                <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium mt-2 ${
                  service.status === 'running'
                    ? 'bg-green-100 text-green-800'
                    : service.status === 'unknown'
                    ? 'bg-yellow-100 text-yellow-800'
                    : 'bg-red-100 text-red-800'
                }`}>
                  {service.status}
                </span>
              </div>
              <button
                onClick={() => handleRestart(service.name)}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Restart
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4 mt-4">
              <div>
                <div className="text-sm text-gray-600">CPU Usage</div>
                <div className="text-2xl font-bold text-gray-900">
                  {service.cpu_percent?.toFixed(2)}%
                </div>
              </div>
              <div>
                <div className="text-sm text-gray-600">Memory</div>
                <div className="text-2xl font-bold text-gray-900">
                  {service.memory_mb?.toFixed(0)} MB
                </div>
              </div>
              <div>
                <div className="text-sm text-gray-600">Uptime</div>
                <div className="text-lg font-semibold text-gray-900">
                  {Math.floor(service.uptime / 3600)}h {Math.floor((service.uptime % 3600) / 60)}m
                </div>
              </div>
              <div>
                <div className="text-sm text-gray-600">Restarts</div>
                <div className="text-lg font-semibold text-gray-900">
                  {service.restart_count}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
EOF

echo "✅ All pages created successfully!"
echo ""
echo "Complete page list:"
echo "1. Dashboard (/) - System overview"
echo "2. Services (/services) - Service monitoring"
echo "3. Configuration (/config) - Runtime config"
echo "4. Kafka (/kafka) - Topic management"
echo "5. Instruments (/instruments) - CRUD operations"
echo "6. Database (/database) - Table browser"
