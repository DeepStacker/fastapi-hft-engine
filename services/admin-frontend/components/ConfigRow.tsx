'use client';

import * as React from 'react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Switch } from '@/components/ui/Switch';
import { Input } from '@/components/ui/Input';
import {
  Copy,
  RotateCcw,
  Lock,
  Check,
  X,
  Loader2
} from 'lucide-react';
import { toast } from '@/components/ui/Toaster';
import { cn } from '@/lib/utils';
import { ArrayEditor, isDateArrayString, isStringArrayString, parseJsonArray } from './ArrayEditor';

export interface ConfigItem {
  key: string;
  value: any;
  category: string;
  description?: string;
  data_type?: string;
  requires_restart?: boolean;
  is_secret?: boolean;
}

interface ConfigRowProps {
  config: ConfigItem;
  onUpdate: (key: string, value: string) => Promise<void>;
  onReset?: (key: string) => Promise<void>;
}

export function ConfigRow({ config, onUpdate, onReset }: ConfigRowProps) {
  const [isEditing, setIsEditing] = React.useState(false);
  const [value, setValue] = React.useState(String(config.value));
  const [isSaving, setIsSaving] = React.useState(false);

  React.useEffect(() => {
    if (!isEditing) {
        setValue(String(config.value));
    }
  }, [config.value, isEditing]);

  const handleSave = async () => {
    if (config.data_type === 'int' && isNaN(parseInt(value))) {
        toast.error('Value must be an integer');
        return;
    }

    try {
      setIsSaving(true);
      await onUpdate(config.key, value);
      setIsEditing(false);
    } catch (error) {
      // Error handled by parent
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setValue(String(config.value));
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSave();
    if (e.key === 'Escape') handleCancel();
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(String(config.value));
    toast.success('Copied to clipboard');
  };

  // Type detection
  const isBool = config.data_type === 'bool' || config.value === 'true' || config.value === 'false';
  const stringValue = String(config.value);
  const isDateArray = isDateArrayString(stringValue);
  const isStringArray = !isDateArray && isStringArrayString(stringValue);

  // Handler for array changes
  const handleArrayChange = async (newArray: string[]) => {
    try {
      await onUpdate(config.key, JSON.stringify(newArray));
    } catch (error) {
      // Error handled by parent
    }
  };

  // Render specialized editor based on type
  const renderValueEditor = () => {
    // 1. Boolean toggle
    if (isBool) {
      return (
        <div className="flex items-center gap-2">
          <Switch 
              checked={config.value === 'true'} 
              onCheckedChange={(checked) => onUpdate(config.key, checked ? 'true' : 'false')}
          />
          <span className={cn(
              "text-xs font-medium",
              config.value === 'true' ? "text-green-600 dark:text-green-400" : "text-muted-foreground"
          )}>
              {config.value === 'true' ? 'Enabled' : 'Disabled'}
          </span>
        </div>
      );
    }

    // 2. Date Array (e.g., holidays)
    if (isDateArray) {
      return (
        <ArrayEditor 
          value={parseJsonArray(stringValue)}
          onChange={handleArrayChange}
          type="date"
          placeholder="Select date..."
        />
      );
    }

    // 3. String Array
    if (isStringArray) {
      return (
        <ArrayEditor 
          value={parseJsonArray(stringValue)}
          onChange={handleArrayChange}
          type="string"
          placeholder="Add item..."
        />
      );
    }

    // 4. Plain text editing mode
    if (isEditing) {
      return (
        <div className="relative flex items-center max-w-sm">
          <Input 
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={handleKeyDown}
              className="h-8 text-sm font-mono pr-16"
              autoFocus
              disabled={isSaving}
          />
          <div className="absolute right-1 flex items-center gap-0.5">
              <Button 
                  size="icon" 
                  variant="ghost" 
                  className="h-6 w-6 hover:bg-green-100 dark:hover:bg-green-900/40 text-green-600" 
                  onClick={handleSave}
                  disabled={isSaving}
              >
                  {isSaving ? <Loader2 className="h-3 w-3 animate-spin"/> : <Check className="h-3 w-3" />}
              </Button>
              <Button 
                  size="icon" 
                  variant="ghost" 
                  className="h-6 w-6 hover:bg-red-100 dark:hover:bg-red-900/40 text-red-600" 
                  onClick={handleCancel}
                  disabled={isSaving}
              >
                  <X className="h-3 w-3" />
              </Button>
          </div>
        </div>
      );
    }

    // 5. Static display (click to edit)
    return (
      <div 
        onClick={() => !config.is_secret && setIsEditing(true)}
        className={cn(
            "inline-flex items-center px-2 py-1.5 rounded-md text-sm font-mono cursor-pointer transition-all border border-transparent hover:border-input bg-muted/20 hover:bg-background min-w-[120px]",
            config.is_secret && "cursor-default opacity-80"
        )}
      >
        {config.is_secret ? '••••••••' : (
            <span className="truncate max-w-[300px]">{stringValue || <em className="text-muted-foreground">empty</em>}</span>
        )}
         
        {!config.is_secret && (
           <span className="ml-auto opacity-0 group-hover:opacity-100 text-[10px] text-muted-foreground px-1 bg-muted rounded border ml-2">Edit</span>
        )}
      </div>
    );
  };

  return (
    <div className="group flex items-start sm:items-center gap-4 p-3 rounded-lg hover:bg-muted/40 transition-colors border border-transparent hover:border-border/50">
      {/* Column 1: Key & Meta */}
      <div className="flex-1 min-w-[180px] max-w-md">
        <div className="flex items-center gap-2">
          <span className="font-mono text-sm font-medium text-foreground select-all break-all">
            {config.key}
          </span>
          {config.is_secret && (
            <Lock className="h-3 w-3 text-purple-500" />
          )}
          {config.requires_restart && (
             <Badge variant="warning" className="text-[9px] px-1 py-0 h-4">Restart</Badge>
          )}
        </div>
        {config.description && (
          <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5" title={config.description}>
            {config.description}
          </p>
        )}
      </div>

      {/* Column 2: Value (Editable) */}
      <div className="flex-1 min-w-[200px]">
        {renderValueEditor()}
      </div>

      {/* Column 3: Actions */}
      <div className="flex items-center justify-end gap-1 w-[80px] opacity-0 group-hover:opacity-100 transition-opacity">
         {!config.is_secret && !isBool && !isEditing && !isDateArray && !isStringArray && (
            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={copyToClipboard} title="Copy">
                <Copy className="h-3.5 w-3.5 text-muted-foreground" />
            </Button>
         )}
         {onReset && (
            <Button size="icon" variant="ghost" className="h-7 w-7 hover:text-destructive" onClick={() => onReset(config.key)} title="Reset Default">
                <RotateCcw className="h-3.5 w-3.5 text-muted-foreground" />
            </Button>
         )}
      </div>
    </div>
  );
}
