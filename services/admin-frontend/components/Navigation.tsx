'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const navItems = [
  { name: 'Dashboard', href: '/' },
  { name: 'Notifications', href: '/notifications' },
  { name: 'Services', href: '/services' },
  { name: 'Logs', href: '/logs' },
  { name: 'Metrics', href: '/metrics' },
  { name: 'Orchestration', href: '/orchestration' },
  { name: 'Configuration', href: '/config' },
  { name: 'Kafka', href: '/kafka' },
  { name: 'Instruments', href: '/instruments' },
  { name: 'Database', href: '/database' },
  { name: 'Dhan Tokens', href: '/dhan-tokens' },
];

export default function Navigation() {
  const pathname = usePathname();

  return (
    <nav className="bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center space-x-8">
            <h1 className="text-xl font-bold">Stockify Admin</h1>
            <div className="flex space-x-1">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                    pathname === item.href
                      ? 'bg-blue-800 text-white'
                      : 'text-blue-100 hover:bg-blue-700'
                  }`}
                >
                  {item.name}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}
