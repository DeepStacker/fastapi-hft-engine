import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import Shell from '@/components/layout/Shell';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Stockify Admin Dashboard',
  description: 'Real-time market data platform administration',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${inter.className} antialiased`}>
        <Shell>
          {children}
        </Shell>
      </body>
    </html>
  );
}
