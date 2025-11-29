'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Switch } from '@/components/ui/Switch';
import { Badge } from '@/components/ui/Badge';
import { Calendar, Trash2, Plus, Clock, AlertTriangle } from 'lucide-react';

interface TradingScheduleProps {
  configs: any[];
  onUpdate: () => void;
}

export function TradingSchedule({ configs, onUpdate }: TradingScheduleProps) {
  const [holidays, setHolidays] = useState<string[]>([]);
  const [newHoliday, setNewHoliday] = useState('');

  // Helper to get config value
  const getConfig = (key: string, defaultVal: any) => {
    const config = configs.find(c => c.key === key);
    return config ? config.value : defaultVal;
  };

  // Initialize holidays from config
  useEffect(() => {
    try {
      const holidayConfig = getConfig('holidays', '[]');
      setHolidays(JSON.parse(holidayConfig));
    } catch (e) {
      setHolidays([]);
    }
  }, [configs]);

  const handleUpdate = async (key: string, value: string) => {
    try {
      await api.updateConfig(key, value);
      onUpdate();
    } catch (err: any) {
      alert(`Failed to update ${key}: ${err.message}`);
    }
  };

  const addHoliday = async () => {
    if (!newHoliday) return;
    if (holidays.includes(newHoliday)) {
      alert('Date already exists');
      return;
    }
    
    const updated = [...holidays, newHoliday].sort();
    await handleUpdate('holidays', JSON.stringify(updated));
    setNewHoliday('');
  };

  const removeHoliday = async (date: string) => {
    if (confirm(`Remove holiday ${date}?`)) {
      const updated = holidays.filter(h => h !== date);
      await handleUpdate('holidays', JSON.stringify(updated));
    }
  };

  return (
    <div className="space-y-6">
      {/* Global Controls */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg font-medium flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-500" />
              Testing Controls
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <div className="font-medium">Bypass Trading Hours</div>
                <div className="text-sm text-muted-foreground">Force fetch data anytime (Testing)</div>
              </div>
              <Switch
                checked={getConfig('bypass_trading_hours', 'false') === 'true'}
                onCheckedChange={(checked) => handleUpdate('bypass_trading_hours', String(checked))}
              />
            </div>
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <div className="font-medium">Weekend Trading</div>
                <div className="text-sm text-muted-foreground">Allow fetching on Sat/Sun</div>
              </div>
              <Switch
                checked={getConfig('enable_weekend_trading', 'false') === 'true'}
                onCheckedChange={(checked) => handleUpdate('enable_weekend_trading', String(checked))}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg font-medium flex items-center gap-2">
              <Clock className="h-5 w-5 text-blue-500" />
              Market Hours (IST)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Equity Start</label>
                <Input 
                  type="time" 
                  value={getConfig('trading_start_time', '09:15')}
                  onChange={(e) => handleUpdate('trading_start_time', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Equity End</label>
                <Input 
                  type="time" 
                  value={getConfig('trading_end_time', '15:30')}
                  onChange={(e) => handleUpdate('trading_end_time', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Commodity Start</label>
                <Input 
                  type="time" 
                  value={getConfig('commodity_trading_start_time', '09:00')}
                  onChange={(e) => handleUpdate('commodity_trading_start_time', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Commodity End</label>
                <Input 
                  type="time" 
                  value={getConfig('commodity_trading_end_time', '23:55')}
                  onChange={(e) => handleUpdate('commodity_trading_end_time', e.target.value)}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Holiday Calendar */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-medium flex items-center gap-2">
            <Calendar className="h-5 w-5 text-green-500" />
            Holiday Calendar
          </CardTitle>
          <CardDescription>Manage trading holidays where markets are closed</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2 mb-4">
            <Input 
              type="date" 
              value={newHoliday}
              onChange={(e) => setNewHoliday(e.target.value)}
              className="w-48"
            />
            <Button onClick={addHoliday}>
              <Plus className="h-4 w-4 mr-2" />
              Add Holiday
            </Button>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
            {holidays.map((date) => (
              <div key={date} className="flex items-center justify-between p-2 border rounded-md bg-muted/50">
                <span className="font-mono text-sm">{date}</span>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-6 w-6 text-red-500 hover:text-red-700 hover:bg-red-50"
                  onClick={() => removeHoliday(date)}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            ))}
            {holidays.length === 0 && (
              <div className="col-span-full text-center py-8 text-muted-foreground">
                No holidays configured
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
