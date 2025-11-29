import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';

interface InstrumentFormProps {
  initialData?: any;
  onSubmit: (data: any) => Promise<void>;
  onCancel: () => void;
}

export default function InstrumentForm({ initialData, onSubmit, onCancel }: InstrumentFormProps) {
  const [formData, setFormData] = useState({
    symbol_id: '',
    symbol: '',
    segment_id: 0,
    is_active: true
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (initialData) {
      setFormData({
        symbol_id: initialData.symbol_id,
        symbol: initialData.symbol,
        segment_id: initialData.segment_id,
        is_active: initialData.is_active
      });
    }
  }, [initialData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await onSubmit(formData);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="text-sm font-medium">Symbol ID</label>
        <Input
          type="number"
          required
          value={formData.symbol_id}
          onChange={(e) => setFormData({ ...formData, symbol_id: e.target.value })}
          disabled={!!initialData} // Cannot change ID on edit
          placeholder="e.g. 13"
        />
        <p className="text-xs text-muted-foreground mt-1">Dhan API symbol ID (unique identifier)</p>
      </div>
      
      <div>
        <label className="text-sm font-medium">Symbol</label>
        <Input
          required
          value={formData.symbol}
          onChange={(e) => setFormData({ ...formData, symbol: e.target.value })}
          placeholder="e.g. NIFTY, RELIANCE, BANKNIFTY"
        />
        <p className="text-xs text-muted-foreground mt-1">Trading symbol name</p>
      </div>

      <div>
        <label className="text-sm font-medium">Segment</label>
        <Select
          value={formData.segment_id.toString()}
          onChange={(e) => setFormData({ ...formData, segment_id: parseInt(e.target.value) })}
        >
          <option value="0">Indices (0)</option>
          <option value="1">Stocks (1)</option>
          <option value="5">Commodities (5)</option>
        </Select>
        <p className="text-xs text-muted-foreground mt-1">0 = Indices, 1 = Stocks, 5 = Commodities</p>
      </div>

      <div className="flex items-center space-x-2">
        <input
          type="checkbox"
          id="is_active"
          checked={formData.is_active}
          onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
          className="rounded border-gray-300"
        />
        <label htmlFor="is_active" className="text-sm font-medium">
          Active (enable for data ingestion)
        </label>
      </div>

      <div className="flex justify-end space-x-2 pt-4">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={loading}>
          {loading ? 'Saving...' : (initialData ? 'Update Instrument' : 'Create Instrument')}
        </Button>
      </div>
    </form>
  );
}
