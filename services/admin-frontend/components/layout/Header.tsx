'use client';

import { Bell, User, LogOut } from 'lucide-react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';

export default function Header() {
  const router = useRouter();
  const pathname = usePathname();

  const handleLogout = () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    router.push('/login');
  };

  // Generate breadcrumbs from pathname
  const generateBreadcrumbs = () => {
    if (pathname === '/') return [{ label: 'Dashboard', href: '/' }];
    
    const segments = pathname.split('/').filter(Boolean);
    const breadcrumbs = [{ label: 'Dashboard', href: '/' }];
    
    segments.forEach((segment, index) => {
      const label = segment
        .split('-')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
      const href = '/' + segments.slice(0, index + 1).join('/');
      breadcrumbs.push({ label, href });
    });
    
    return breadcrumbs;
  };

  const breadcrumbs = generateBreadcrumbs();

  return (
    <header className="h-16 bg-card/50 backdrop-blur-sm border-b border-border flex items-center justify-between px-8 sticky top-0 z-30">
      <div className="flex items-center gap-4">
        {/* Breadcrumbs */}
        <nav className="flex items-center gap-2 text-sm">
          {breadcrumbs.map((crumb, index) => (
            <div key={crumb.href} className="flex items-center gap-2">
              {index > 0 && (
                <span className="text-muted-foreground">/</span>
              )}
              {index === breadcrumbs.length - 1 ? (
                <span className="font-medium">{crumb.label}</span>
              ) : (
                <Link 
                  href={crumb.href}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  {crumb.label}
                </Link>
              )}
            </div>
          ))}
        </nav>
      </div>

      <div className="flex items-center gap-4">
        <button className="p-2 rounded-full hover:bg-secondary text-muted-foreground transition-colors relative">
          <Bell className="w-5 h-5" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-destructive rounded-full"></span>
        </button>
        
        <div className="flex items-center gap-3 pl-4 border-l border-border">
          <div className="text-right hidden sm:block">
            <p className="text-sm font-medium">Admin User</p>
            <p className="text-xs text-muted-foreground">Super Admin</p>
          </div>
          <div className="w-9 h-9 bg-secondary rounded-full flex items-center justify-center">
            <User className="w-5 h-5 text-muted-foreground" />
          </div>
        </div>

        <Button variant="ghost" size="sm" onClick={handleLogout}>
          <LogOut className="h-4 w-4" />
        </Button>
      </div>
    </header>
  );
}
