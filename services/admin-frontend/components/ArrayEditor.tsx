'use client';

import * as React from 'react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';
import { X, Plus, Calendar } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ArrayEditorProps {
  value: string[]; // Parsed array
  onChange: (newValue: string[]) => void;
  type?: 'date' | 'string';
  placeholder?: string;
  className?: string;
}

export function ArrayEditor({ 
  value, 
  onChange, 
  type = 'string',
  placeholder = 'Add item...',
  className 
}: ArrayEditorProps) {
  const [newItem, setNewItem] = React.useState('');
  const inputRef = React.useRef<HTMLInputElement>(null);

  const handleAdd = () => {
    const trimmed = newItem.trim();
    if (!trimmed) return;
    if (value.includes(trimmed)) {
      // Duplicate - maybe flash the existing chip?
      return;
    }
    
    const updated = [...value, trimmed].sort();
    onChange(updated);
    setNewItem('');
    inputRef.current?.focus();
  };

  const handleRemove = (item: string) => {
    onChange(value.filter(v => v !== item));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAdd();
    }
  };

  return (
    <div className={cn("space-y-2", className)}>
      {/* Chips Display */}
      <div className="flex flex-wrap gap-1.5 min-h-[32px] p-1.5 rounded-md border border-input bg-muted/20">
        {value.length === 0 ? (
          <span className="text-xs text-muted-foreground px-1 py-0.5 italic">No items</span>
        ) : (
          value.map((item) => (
            <Badge 
              key={item} 
              variant="secondary" 
              className="h-6 px-2 gap-1 font-mono text-xs bg-background border shadow-sm"
            >
              {type === 'date' && <Calendar className="h-3 w-3 text-muted-foreground" />}
              {item}
              <button 
                type="button"
                onClick={() => handleRemove(item)}
                className="ml-0.5 rounded-full hover:bg-destructive/20 p-0.5 -mr-1 transition-colors"
              >
                <X className="h-3 w-3 text-muted-foreground hover:text-destructive" />
              </button>
            </Badge>
          ))
        )}
      </div>

      {/* Add Input */}
      <div className="flex items-center gap-2">
        <Input 
          ref={inputRef}
          type={type === 'date' ? 'date' : 'text'}
          value={newItem}
          onChange={(e) => setNewItem(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="h-8 text-sm flex-1"
        />
        <Button 
          type="button"
          size="sm" 
          variant="outline" 
          onClick={handleAdd}
          disabled={!newItem.trim()}
          className="h-8 px-3"
        >
          <Plus className="h-3.5 w-3.5 mr-1" />
          Add
        </Button>
      </div>
    </div>
  );
}

// Helper to detect if a string value is a JSON array of dates
export function isDateArrayString(value: string): boolean {
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed) || parsed.length === 0) return false;
    // Check if all items look like YYYY-MM-DD
    return parsed.every(item => typeof item === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(item));
  } catch {
    return false;
  }
}

// Helper to detect if a string value is a JSON array of strings
export function isStringArrayString(value: string): boolean {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) && parsed.every(item => typeof item === 'string');
  } catch {
    return false;
  }
}

// Helper to parse JSON array safely
export function parseJsonArray(value: string): string[] {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
