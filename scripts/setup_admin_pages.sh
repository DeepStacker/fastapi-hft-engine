#!/bin/bash

# Stockify Admin Frontend - Additional Pages Setup
# Adds Configuration, Kafka, Instruments, Database, and Services pages

set -e

FRONTEND_DIR="services/admin-frontend"

echo "🚀 Adding additional admin pages..."

cd "$FRONTEND_DIR"

# ===========================================
# Configuration Management Page
# ===========================================
echo "⚙️ Creating configuration page..."
cat > app/config/page.tsx << 'EOF'
'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import LoadingSpinner from '@/components/LoadingSpinner';

export default function ConfigPage() {
  const [configs, setConfigs] = useState<any[]>([]);
  const [categories, setCategories] = useState<string[]>(['all']);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [loading, setLoading] = useState(true);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

  useEffect(() => {
    loadCategories();
    loadConfigs();
  }, [selectedCategory]);

  const loadCategories = async () => {
    try {
      const res = await api.getConfigCategories();
      setCategories(['all', ...(res.data.categories || [])]);
    } catch (err) {
      console.error('Failed to load categories:', err);
    }
  };

  const loadConfigs = async () => {
    try {
      const res = await api.getConfigs(selectedCategory === 'all' ? undefined : selectedCategory);
      setConfigs(res.data);
    } catch (err) {
      console.error('Failed to load configs:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdate = async (key: string, value: string) => {
    try {
      await api.updateConfig(key, value);
      alert('✅ Configuration updated successfully!');
      setEditingKey(null);
      loadConfigs();
    } catch (err: any) {
      alert(`❌ Failed to update: ${err.message}`);
    }
  };

  const handleInitialize = async () => {
    if (confirm('Initialize all default configs?')) {
      try {
        await api.initializeConfigs();
        alert('✅ Configs initialized!');
        loadConfigs();
      } catch (err: any) {
        alert(`❌ Failed: ${err.message}`);
      }
    }
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="max-w-7xl mx-auto p-8">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold text-gray-900">System Configuration</h1>
        <button
          onClick={handleInitialize}
          className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
        >
          Initialize Defaults
        </button>
      </div>

      {/* Category Filter */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">Filter by Category</label>
        <select
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        >
          {categories.map(cat => (
            <option key={cat} value={cat}>{cat.toUpperCase()}</option>
          ))}
        </select>
      </div>

      {/* Configs Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Key
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Value
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Description
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Category
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {configs.map((config) => (
              <tr key={config.key} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                  {config.key}
                  {config.requires_restart && (
                    <span className="ml-2 px-2 py-1 text-xs bg-yellow-100 text-yellow-800 rounded">
                      Restart Required
                    </span>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {editingKey === config.key ? (
                    <input
                      type="text"
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      className="px-3 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      autoFocus
                    />
                  ) : (
                    <span className="text-sm text-gray-900">{config.value}</span>
                  )}
                </td>
                <td className="px-6 py-4 text-sm text-gray-600">{config.description}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs">
                    {config.category}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  {editingKey === config.key ? (
                    <div className="flex space-x-2">
                      <button
                        onClick={() => handleUpdate(config.key, editValue)}
                        className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => setEditingKey(null)}
                        className="px-3 py-1 bg-gray-300 text-gray-700 rounded hover:bg-gray-400"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => {
                        setEditingKey(config.key);
                        setEditValue(config.value);
                      }}
                      className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
                    >
                      Edit
                    </button>
                  )}
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
# Kafka Management Page
# ===========================================
echo "📨 Creating Kafka page..."
cat > app/kafka/page.tsx << 'EOF'
'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import LoadingSpinner from '@/components/LoadingSpinner';

export default function KafkaPage() {
  const [topics, setTopics] = useState<any[]>([]);
  const [consumerGroups, setConsumerGroups] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newTopic, setNewTopic] = useState({ name: '', partitions: 3, replication_factor: 1 });

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 10000);
    return () => clearInterval(interval);
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

  if (loading) return <LoadingSpinner />;

  return (
    <div className="max-w-7xl mx-auto p-8">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Kafka Management</h1>
        <button
          onClick={() => setShowCreateModal(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          + Create Topic
        </button>
      </div>

      {/* Topics */}
      <div className="bg-white rounded-lg shadow overflow-hidden mb-8">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">Topics ({topics.length})</h2>
        </div>
        <table className="min-w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Topic Name
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Partitions
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Replication Factor
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {topics.map((topic) => (
              <tr key={topic.name}>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                  {topic.name}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                  {topic.partitions}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                  {topic.replication_factor}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  <button
                    onClick={() => handleDeleteTopic(topic.name)}
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

      {/* Consumer Groups */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">Consumer Groups</h2>
        </div>
        <div className="divide-y divide-gray-200">
          {consumerGroups.map((group) => (
            <div key={group.group_id} className="px-6 py-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-medium text-gray-900">{group.group_id}</h3>
                  <p className="text-sm text-gray-600 mt-1">
                    Topics: {group.topics.join(', ')} | Members: {group.members}
                  </p>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-gray-900">{group.total_lag}</div>
                  <div className="text-sm text-gray-600">Total Lag</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Create Topic Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h2 className="text-2xl font-bold mb-4">Create New Topic</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Topic Name</label>
                <input
                  type="text"
                  value={newTopic.name}
                  onChange={(e) => setNewTopic({ ...newTopic, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="market.data"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Partitions</label>
                <input
                  type="number"
                  value={newTopic.partitions}
                  onChange={(e) => setNewTopic({ ...newTopic, partitions: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Replication Factor</label>
                <input
                  type="number"
                  value={newTopic.replication_factor}
                  onChange={(e) => setNewTopic({ ...newTopic, replication_factor: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div className="flex space-x-3 pt-4">
                <button
                  onClick={handleCreateTopic}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Create
                </button>
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
EOF

echo "✅ Additional pages created!"
echo ""
echo "Pages added:"
echo "- Configuration Management (runtime config updates)"
echo "- Kafka Management (topic creation, consumer lag)"
