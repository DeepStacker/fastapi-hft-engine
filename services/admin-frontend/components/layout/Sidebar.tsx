'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  Server,
  FileText,
  Activity,
  Box,
  Settings,
  Database,
  MessageSquare,
  BarChart3,
  ChevronLeft,
  ChevronRight,
  Menu,
  Key,
  Users,
  History,
  Bell,
  HardDrive,
  Sliders,
  HeadphonesIcon,
  Shield,
  TrendingUp,
} from 'lucide-react';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const navSections = [
  {
    title: 'Overview',
    items: [
      { name: 'Dashboard', href: '/', icon: LayoutDashboard },
      { name: 'Traders', href: '/traders', icon: Users },
    ],
  },
  {
    title: 'Community',
    items: [
      { name: 'Moderation', href: '/community', icon: Shield },
      { name: 'Analytics', href: '/community/analytics', icon: TrendingUp },
    ],
  },
  {
    title: 'System',
    items: [
      { name: 'Services', href: '/services', icon: Server },
      { name: 'Metrics', href: '/metrics', icon: Activity },
      { name: 'Audit Logs', href: '/audit', icon: History },
      { name: 'System Logs', href: '/logs', icon: FileText },
    ],
  },
  {
    title: 'Infrastructure',
    items: [
      { name: 'Orchestration', href: '/orchestration', icon: Box },
      { name: 'Kafka', href: '/kafka', icon: MessageSquare },
      { name: 'Instruments', href: '/instruments', icon: BarChart3 },
      { name: 'Database', href: '/database', icon: Database },
    ],
  },
  {
    title: 'Configuration',
    items: [
      { name: 'App Settings', href: '/settings', icon: Sliders },
      { name: 'System Config', href: '/config', icon: Settings },
      { name: 'Infra Config', href: '/infrastructure', icon: HardDrive },
      { name: 'Dhan Tokens', href: '/dhan-tokens', icon: Key },
    ],
  },
  {
    title: 'Support',
    items: [
      { name: 'Tickets', href: '/support', icon: HeadphonesIcon },
      { name: 'Notifications', href: '/notifications', icon: Bell },
    ],
  },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [isCollapsed, setIsCollapsed] = useState(false);

  return (
    <motion.div
      initial={{ width: 256 }}
      animate={{ width: isCollapsed ? 80 : 256 }}
      className="h-screen bg-card border-r border-border flex flex-col sticky top-0 z-40"
    >
      {/* Logo */}
      <div className="h-16 flex items-center px-6 border-b border-border">
        <div className="flex items-center gap-3 overflow-hidden">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center shrink-0">
            <Activity className="w-5 h-5 text-primary-foreground" />
          </div>
          <AnimatePresence>
            {!isCollapsed && (
              <motion.span
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="font-bold text-lg whitespace-nowrap"
              >
                Stockify Admin
              </motion.span>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-6 overflow-y-auto custom-scrollbar">
        {navSections.map((section, sectionIdx) => (
          <div key={section.title} className={sectionIdx > 0 ? '' : ''}>
            {/* Section Header */}
            {!isCollapsed && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="px-3 mb-2"
              >
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {section.title}
                </span>
              </motion.div>
            )}

            {/* Section Items */}
            <div className="space-y-1">
              {section.items.map((item) => {
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all-smooth group relative",
                      isActive 
                        ? "bg-primary/10 text-primary shadow-sm" 
                        : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                    )}
                  >
                    {/* Active Indicator */}
                    {isActive && (
                      <motion.div
                        layoutId="activeNav"
                        className="absolute left-0 w-1 h-6 bg-primary rounded-r-full"
                        transition={{ type: "spring", stiffness: 300, damping: 30 }}
                      />
                    )}
                    
                    <item.icon className={cn("w-5 h-5 shrink-0", isActive && "text-primary")} />
                    
                    {!isCollapsed && (
                      <motion.span
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="font-medium whitespace-nowrap text-sm"
                      >
                        {item.name}
                      </motion.span>
                    )}
                    
                    {/* Tooltip for collapsed state */}
                    {isCollapsed && (
                      <div className="absolute left-full ml-2 px-2 py-1 bg-popover text-popover-foreground text-xs rounded-lg shadow-lg opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50 border border-border">
                        {item.name}
                      </div>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Collapse Toggle */}
      <div className="p-4 border-t border-border">
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="w-full flex items-center justify-center p-2 rounded-lg hover:bg-secondary text-muted-foreground transition-colors"
        >
          {isCollapsed ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
        </button>
      </div>
    </motion.div>
  );
}
