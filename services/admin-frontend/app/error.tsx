'use client';

import { useEffect } from 'react';
import { AlertTriangle, RefreshCcw, Home } from 'lucide-react';
import { Button } from '@/components/ui/button'; // Assuming we have shadcn/ui components or similar, if not I will use raw HTML but project seems to use lucide/tailwind
import Link from 'next/link';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error('Admin Dashboard Error:', error);
  }, [error]);

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background text-foreground p-4">
      <div className="max-w-md w-full flex flex-col items-center text-center space-y-6">
        
        {/* Animated Icon Wrapper */}
        <div className="relative">
            <div className="absolute inset-0 bg-red-500/20 blur-xl rounded-full" />
            <div className="relative p-4 bg-card border border-border rounded-full shadow-lg">
                <AlertTriangle className="w-12 h-12 text-destructive" />
            </div>
        </div>

        <div className="space-y-2">
            <h2 className="text-3xl font-bold tracking-tight">Something went wrong!</h2>
            <p className="text-muted-foreground">
                An unexpected error has occurred in the admin dashboard. 
                <br /><span className="text-xs font-mono opacity-70">Error Digest: {error.digest || "N/A"}</span>
            </p>
        </div>

        <div className="flex w-full gap-4 pt-4">
            <button
                onClick={reset}
                className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 bg-primary text-primary-foreground hover:bg-primary/90 rounded-md font-medium transition-colors"
            >
                <RefreshCcw className="w-4 h-4" />
                Try again
            </button>
            <Link
                href="/dashboard"
                className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 border border-input bg-background hover:bg-accent hover:text-accent-foreground rounded-md font-medium transition-colors"
            >
                <Home className="w-4 h-4" />
                Dashboard
            </Link>
        </div>
      </div>
    </div>
  );
}
