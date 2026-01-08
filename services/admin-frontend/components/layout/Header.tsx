'use client';

import { Bell, User, LogOut, Moon, Sun, Command, Clock, RefreshCw } from 'lucide-react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export default function Header() {
  const router = useRouter();
  const pathname = usePathname();
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');
  const [showNotifications, setShowNotifications] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [notifications] = useState([
    { id: 1, title: 'Service Restarted', message: 'ocd-backend was restarted successfully', time: '2m ago', read: false },
    { id: 2, title: 'New Trader Joined', message: 'User "TraderPro" registered', time: '15m ago', read: false },
    { id: 3, title: 'Database Backup', message: 'Daily backup completed', time: '1h ago', read: true },
  ]);

  const unreadCount = notifications.filter(n => !n.read).length;

  // Update time every second
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    router.push('/login');
  };

  const toggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    document.documentElement.classList.toggle('dark', newTheme === 'dark');
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
    <header className="h-16 bg-card/50 backdrop-blur-sm border-b border-border flex items-center justify-between px-6 sticky top-0 z-30">
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

      <div className="flex items-center gap-3">
        {/* Live Clock */}
        <div className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-secondary/50 rounded-lg text-xs text-muted-foreground">
          <Clock className="w-3.5 h-3.5" />
          <span className="font-mono">
            {currentTime.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </span>
        </div>

        {/* Command Palette Hint */}
        <button className="hidden lg:flex items-center gap-2 px-3 py-1.5 bg-secondary/50 hover:bg-secondary rounded-lg text-xs text-muted-foreground hover:text-foreground transition-colors">
          <Command className="w-3.5 h-3.5" />
          <span>Cmd+K</span>
        </button>

        {/* Theme Toggle */}
        <button
          onClick={toggleTheme}
          className="p-2 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-all"
          title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
        >
          <AnimatePresence mode="wait">
            {theme === 'dark' ? (
              <motion.div key="sun" initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 90, opacity: 0 }}>
                <Sun className="w-5 h-5" />
              </motion.div>
            ) : (
              <motion.div key="moon" initial={{ rotate: 90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: -90, opacity: 0 }}>
                <Moon className="w-5 h-5" />
              </motion.div>
            )}
          </AnimatePresence>
        </button>

        {/* Notifications */}
        <div className="relative">
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className="p-2 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-all relative"
          >
            <Bell className="w-5 h-5" />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 w-4 h-4 bg-destructive text-destructive-foreground text-[10px] font-bold rounded-full flex items-center justify-center animate-pulse">
                {unreadCount}
              </span>
            )}
          </button>

          {/* Notification Dropdown */}
          <AnimatePresence>
            {showNotifications && (
              <motion.div
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.95 }}
                className="absolute right-0 top-full mt-2 w-80 bg-card border border-border rounded-xl shadow-xl overflow-hidden z-50"
              >
                <div className="p-3 border-b border-border flex items-center justify-between">
                  <span className="font-semibold text-sm">Notifications</span>
                  <button className="text-xs text-primary hover:underline">Mark all read</button>
                </div>
                <div className="max-h-64 overflow-y-auto">
                  {notifications.map(n => (
                    <div
                      key={n.id}
                      className={`p-3 border-b border-border/50 hover:bg-secondary/50 transition-colors cursor-pointer ${!n.read ? 'bg-primary/5' : ''}`}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`w-2 h-2 rounded-full mt-1.5 ${!n.read ? 'bg-primary' : 'bg-muted-foreground/30'}`} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{n.title}</p>
                          <p className="text-xs text-muted-foreground truncate">{n.message}</p>
                          <p className="text-[10px] text-muted-foreground mt-1">{n.time}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="p-2 border-t border-border">
                  <Link href="/notifications" className="block w-full text-center text-xs text-primary hover:underline py-1">
                    View all notifications
                  </Link>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        
        {/* User Profile */}
        <div className="flex items-center gap-3 pl-3 border-l border-border">
          <div className="text-right hidden sm:block">
            <p className="text-sm font-medium">Admin</p>
            <p className="text-[10px] text-muted-foreground">Super Admin</p>
          </div>
          <div className="w-9 h-9 bg-gradient-to-br from-primary to-purple-600 rounded-full flex items-center justify-center shadow-lg">
            <span className="text-white text-sm font-bold">A</span>
          </div>
        </div>

        <Button variant="ghost" size="sm" onClick={handleLogout} title="Logout">
          <LogOut className="h-4 w-4" />
        </Button>
      </div>
    </header>
  );
}
