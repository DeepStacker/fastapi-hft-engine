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
    name: '',
    exchange: 'NSE',
    instrument_type: 'EQ',
    is_active: true
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (initialData) {
      setFormData({
        symbol_id: initialData.symbol_id,
        name: initialData.name,
        exchange: initialData.exchange,
        instrument_type: initialData.instrument_type,
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
          placeholder="e.g. 12345"
        />
        <p className="text-xs text-muted-foreground mt-1">Unique identifier for the instrument</p>
      </div>
      
      <div>
        <label className="text-sm font-medium">Name</label>
        <Input
          required
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          placeholder="e.g. RELIANCE"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium">Exchange</label>
          <Select
            value={formData.exchange}
            onChange={(e) => setFormData({ ...formData, exchange: e.target.value })}
          >
            <option value="NSE">NSE</option>
            <option value="BSE">BSE</option>
            <option value="MCX">MCX</option>
          </Select>
        </div>

        <div>
          <label className="text-sm font-medium">Type</label>
          <Select
            value={formData.instrument_type}
            onChange={(e) => setFormData({ ...formData, instrument_type: e.target.value })}
          >
            <option value="EQ">Equity</option>
            <option value="FUT">Future</option>
            <option value="OPT">Option</option>
            <option value="INDEX">Index</option>
          </Select>
        </div>
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
