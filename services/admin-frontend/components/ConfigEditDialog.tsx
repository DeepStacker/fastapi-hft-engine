'use client';

import * as React from 'react';
import { Button } from '@/components/ui/Button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/Dialog';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Badge } from '@/components/ui/Badge';
import { Loader2, Save } from 'lucide-react';
import { toast } from '@/components/ui/Toaster';

interface ConfigItem {
  key: string;
  value: any;
  category: string;
  description?: string;
  data_type?: string;
  requires_restart?: boolean;
  is_secret?: boolean;
}

interface ConfigEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  config: ConfigItem | null;
  onSave: (key: string, value: string) => Promise<void>;
}

export function ConfigEditDialog({
  open,
  onOpenChange,
  config,
  onSave,
}: ConfigEditDialogProps) {
  const [value, setValue] = React.useState('');
  const [isSaving, setIsSaving] = React.useState(false);

  React.useEffect(() => {
    if (config) {
      setValue(String(config.value));
    }
  }, [config]);

  const handleSave = async () => {
    if (!config) return;
    
    // Basic validation based on type
    if (config.data_type === 'int') {
        if (isNaN(parseInt(value))) {
            toast.error('Value must be an integer');
            return;
        }
    } else if (config.data_type === 'float') {
        if (isNaN(parseFloat(value))) {
            toast.error('Value must be a number');
            return;
        }
    }

    try {
      setIsSaving(true);
      await onSave(config.key, value);
      onOpenChange(false);
      toast.success('Configuration updated successfully');
    } catch (error: any) {
      toast.error(error.message || 'Failed to update configuration');
    } finally {
      setIsSaving(false);
    }
  };

  if (!config) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <div className="flex items-center gap-2 mb-1">
            <DialogTitle>Edit Configuration</DialogTitle>
            <Badge variant="outline" className="font-mono text-xs">
                {config.data_type || 'string'}
            </Badge>
          </div>
          <DialogDescription>
            Make changes to the system configuration. Click save when you're done.
          </DialogDescription>
        </DialogHeader>
        
        <div className="grid gap-6 py-4">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Key</Label>
            <div className="font-mono text-sm font-medium bg-muted/50 p-2 rounded border break-all">
                {config.key}
            </div>
          </div>

          {config.description && (
             <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Description</Label>
                <div className="text-sm bg-muted/20 p-2 rounded border border-dashed">
                    {config.description}
                </div>
            </div>
          )}
          
          <div className="space-y-2">
            <Label htmlFor="config-value" className="text-right">
              Value
            </Label>
            {config.data_type === 'json' || value.length > 50 ? (
                <textarea
                    id="config-value"
                    className="flex min-h-[100px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 font-mono"
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                />
            ) : (
                <Input
                    id="config-value"
                    type={config.data_type === 'int' || config.data_type === 'float' ? 'number' : 'text'}
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    className="col-span-3 font-mono"
                    autoFocus
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSave();
                    }}
                />
            )}
          </div>
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {!isSaving && <Save className="mr-2 h-4 w-4" />}
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
