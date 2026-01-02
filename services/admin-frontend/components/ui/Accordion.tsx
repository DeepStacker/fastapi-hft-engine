'use client';

import * as React from 'react';
import { ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

interface AccordionItemProps {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  badge?: React.ReactNode;
  defaultOpen?: boolean;
  children: React.ReactNode;
  className?: string;
}

export function AccordionItem({
  title,
  subtitle,
  icon,
  badge,
  defaultOpen = false,
  children,
  className,
}: AccordionItemProps) {
  const [isOpen, setIsOpen] = React.useState(defaultOpen);

  return (
    <div className={cn(
      "rounded-xl border border-border overflow-hidden bg-card",
      isOpen && "ring-1 ring-primary/20",
      className
    )}>
      {/* Header */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "flex items-center justify-between w-full px-4 py-3 text-left",
          "hover:bg-muted/50 transition-colors duration-150",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
        )}
      >
        <div className="flex items-center gap-3">
          {icon && (
            <div className="p-2 rounded-lg bg-muted shrink-0">
              {icon}
            </div>
          )}
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-sm">{title}</h3>
              {badge}
            </div>
            {subtitle && (
              <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>
            )}
          </div>
        </div>

        <motion.div
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.2 }}
        >
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        </motion.div>
      </button>

      {/* Content */}
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 pt-2 border-t border-border/50">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

interface AccordionProps {
  children: React.ReactNode;
  className?: string;
}

export function Accordion({ children, className }: AccordionProps) {
  return (
    <div className={cn("space-y-3", className)}>
      {children}
    </div>
  );
}
