'use client';

import { Toaster as SonnerToaster } from 'sonner';

export function Toaster() {
  return (
    <SonnerToaster
      position="top-right"
      toastOptions={{
        style: {
          background: 'var(--card)',
          color: 'var(--card-foreground)',
          border: '1px solid var(--border)',
        },
        classNames: {
          success: 'border-green-500/20 bg-green-50 dark:bg-green-900/20',
          error: 'border-red-500/20 bg-red-50 dark:bg-red-900/20',
          warning: 'border-yellow-500/20 bg-yellow-50 dark:bg-yellow-900/20',
          info: 'border-blue-500/20 bg-blue-50 dark:bg-blue-900/20',
        },
      }}
      richColors
      closeButton
    />
  );
}

// Re-export toast function for easy imports
export { toast } from 'sonner';
