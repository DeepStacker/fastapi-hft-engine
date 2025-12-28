import type { Metadata } from 'next';
import './globals.css';
import Shell from '@/components/layout/Shell';
import { Toaster } from '@/components/ui/Toaster';

export const metadata: Metadata = {
  title: 'Stockify Admin Dashboard',
  description: 'Real-time market data platform administration',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="font-sans antialiased">
        <Shell>
          {children}
        </Shell>
        <Toaster />
      </body>
    </html>
  );
}
