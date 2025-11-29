'use client';

import { useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';

interface LogViewerProps {
  containerId: string;
  containerName: string;
  onClose: () => void;
}

export default function LogViewer({ containerId, containerName, onClose }: LogViewerProps) {
  const [logs, setLogs] = useState<string[]>([]);
  const [status, setStatus] = useState<'connecting' | 'connected' | 'disconnected' | 'error'>('connecting');
  const [autoScroll, setAutoScroll] = useState(true);
  const logsEndRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    // Get auth token
    const token = localStorage.getItem('access_token');
    if (!token) {
      setStatus('error');
      setLogs(['Error: No authentication token found']);
      return;
    }

    // Connect WebSocket
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = process.env.NEXT_PUBLIC_API_URL 
      ? process.env.NEXT_PUBLIC_API_URL.replace(/^https?:\/\//, '')
      : 'localhost:8001';
      
    const wsUrl = `${protocol}//${host}/logs/ws/${containerId}?token=${token}`;
    console.log('Connecting to logs WebSocket:', wsUrl);
    
    let ws: WebSocket | null = null;
    let timeoutId: NodeJS.Timeout;

    const connect = () => {
      try {
        ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
          console.log('WebSocket connected');
          setStatus('connected');
          setLogs(prev => [...prev, `Connected to log stream for ${containerName}...`]);
        };

        ws.onmessage = (event) => {
          setLogs(prev => {
            const newLogs = [...prev, event.data];
            // Keep max 1000 lines
            if (newLogs.length > 1000) {
              return newLogs.slice(newLogs.length - 1000);
            }
            return newLogs;
          });
        };

        ws.onclose = (event) => {
          console.log('WebSocket closed:', event.code, event.reason);
          if (event.code !== 1000) {
             setStatus('disconnected');
             setLogs(prev => [...prev, `\nConnection closed (Code: ${event.code}).`]);
          }
        };

        ws.onerror = (error) => {
          console.error('WebSocket error event:', error);
          setStatus('error');
          setLogs(prev => [...prev, '\nWebSocket error occurred. Check console for details.']);
        };

      } catch (e) {
        console.error('WebSocket connection failed:', e);
        setStatus('error');
        setLogs(prev => [...prev, `Error connecting: ${e}`]);
      }
    };

    // Debounce connection to handle React Strict Mode
    timeoutId = setTimeout(connect, 100);

    return () => {
      clearTimeout(timeoutId);
      if (ws) {
        console.log('Closing WebSocket...');
        ws.close();
      }
    };
  }, [containerId, containerName]);

  // Auto-scroll
  useEffect(() => {
    if (autoScroll && logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, autoScroll]);

  const handleDownload = () => {
    const blob = new Blob([logs.join('\n')], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${containerName}-${new Date().toISOString()}.log`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 w-full max-w-6xl h-[80vh] rounded-lg shadow-2xl flex flex-col border border-gray-700">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700 bg-gray-800 rounded-t-lg">
          <div className="flex items-center space-x-3">
            <h3 className="text-lg font-mono font-bold text-white">
              {containerName} <span className="text-gray-400 text-sm">({containerId})</span>
            </h3>
            <span className={`px-2 py-0.5 text-xs rounded-full ${
              status === 'connected' ? 'bg-green-900 text-green-200' :
              status === 'connecting' ? 'bg-yellow-900 text-yellow-200' :
              'bg-red-900 text-red-200'
            }`}>
              {status}
            </span>
          </div>
          <div className="flex items-center space-x-3">
            <label className="flex items-center space-x-2 text-sm text-gray-300 cursor-pointer">
              <input
                type="checkbox"
                checked={autoScroll}
                onChange={(e) => setAutoScroll(e.target.checked)}
                className="form-checkbox h-4 w-4 text-blue-600 rounded bg-gray-700 border-gray-600"
              />
              <span>Auto-scroll</span>
            </label>
            <button
              onClick={handleDownload}
              className="px-3 py-1 bg-gray-700 hover:bg-gray-600 text-white text-sm rounded transition-colors"
            >
              Download
            </button>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white transition-colors p-1"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Log Content */}
        <div className="flex-1 overflow-auto p-4 font-mono text-sm bg-black text-gray-300">
          {logs.map((log, index) => (
            <div key={index} className="whitespace-pre-wrap break-all hover:bg-gray-900 px-1">
              {log}
            </div>
          ))}
          <div ref={logsEndRef} />
        </div>
      </div>
    </div>
  );
}
