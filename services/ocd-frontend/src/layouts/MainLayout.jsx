import { useState, useEffect } from "react";
import { Outlet } from "react-router-dom";
import { useSelector } from "react-redux";
import Sidebar from "../components/layout/Sidebar";
import Toast from "../components/common/Toast";
import QuickSymbolSwitcher from "../components/common/QuickSymbolSwitcher";
import CommandPalette from "../components/common/CommandPalette";
import { motion } from "framer-motion";
import { SidebarProvider, useSidebar } from "../context/SidebarContext";
import useKeyboardShortcuts from "../hooks/useKeyboardShortcuts";

// Inner component that uses the sidebar context
const MainContent = () => {
  const theme = useSelector((state) => state.theme.theme);
  const { sidebarWidth } = useSidebar();
  const [scrollY, setScrollY] = useState(0);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [isShortcutsHelpOpen, setIsShortcutsHelpOpen] = useState(false);

  // Initialize keyboard shortcuts
  useKeyboardShortcuts({
    onCommandPalette: () => setIsCommandPaletteOpen(true),
    onHelp: () => setIsShortcutsHelpOpen(prev => !prev),
  });

  // Scroll tracking
  useEffect(() => {
    const handleScroll = () => {
      setScrollY(window.scrollY);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Subtle background pattern
  const BackgroundPattern = () => (
    <div className="fixed inset-0 overflow-hidden pointer-events-none">
      <motion.div
        animate={{
          x: [0, 100, 0],
          y: [0, -100, 0],
        }}
        transition={{
          duration: 20,
          repeat: Infinity,
          ease: "linear",
        }}
        className="absolute -top-40 -left-40 w-80 h-80 bg-gradient-to-r from-blue-400/10 to-purple-600/10 rounded-full blur-3xl"
      />
      <motion.div
        animate={{
          x: [0, -100, 0],
          y: [0, 100, 0],
        }}
        transition={{
          duration: 25,
          repeat: Infinity,
          ease: "linear",
        }}
        className="absolute -bottom-40 -right-40 w-96 h-96 bg-gradient-to-r from-purple-400/10 to-pink-600/10 rounded-full blur-3xl"
      />
    </div>
  );

  // Page transition variants
  const pageVariants = {
    initial: { opacity: 0, y: 10 },
    in: { opacity: 1, y: 0, transition: { duration: 0.3 } },
    out: { opacity: 0, y: -10, transition: { duration: 0.2 } },
  };

  return (
    <div
      className={`min-h-screen relative bg-mesh-gradient transition-colors duration-500 ${theme === "dark"
          ? "text-white"
          : "text-gray-900"
        }`}
    >
      {/* Background Pattern */}
      <BackgroundPattern />

      {/* Sidebar - Fixed Left */}
      <Sidebar />

      {/* Main Content - Offset by dynamic sidebar width */}
      <motion.div
        initial="initial"
        animate="in"
        exit="out"
        variants={pageVariants}
        className="relative z-10 min-h-screen transition-all duration-300"
        style={{ marginLeft: sidebarWidth }}
      >
        {/* Content Area */}
        <main className="relative p-2">
          {/* Toast notifications */}
          <Toast />

          {/* Page Content */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.1, duration: 0.4 }}
          >
            <Outlet />
          </motion.div>
        </main>
      </motion.div>

      {/* Quick Symbol Switcher */}
      <QuickSymbolSwitcher />

      {/* Command Palette - Global */}
      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
      />

      {/* Keyboard Shortcuts Help Tooltip */}
      {isShortcutsHelpOpen && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          className={`fixed bottom-4 right-4 p-4 rounded-xl shadow-2xl z-50 max-w-xs ${theme === 'dark' ? 'bg-gray-900 border border-gray-700' : 'bg-white border border-gray-200'
            }`}
        >
          <h4 className="font-bold mb-3 text-sm">Keyboard Shortcuts</h4>
          <div className="space-y-2 text-xs">
            <div className="flex justify-between"><span className="text-gray-500">Command Palette</span><kbd className="px-2 py-0.5 rounded bg-gray-800 text-gray-300 font-mono">⌘K</kbd></div>
            <div className="flex justify-between"><span className="text-gray-500">Toggle Theme</span><kbd className="px-2 py-0.5 rounded bg-gray-800 text-gray-300 font-mono">⌘D</kbd></div>
            <div className="flex justify-between"><span className="text-gray-500">Dashboard</span><kbd className="px-2 py-0.5 rounded bg-gray-800 text-gray-300 font-mono">1</kbd></div>
            <div className="flex justify-between"><span className="text-gray-500">Option Chain</span><kbd className="px-2 py-0.5 rounded bg-gray-800 text-gray-300 font-mono">2</kbd></div>
            <div className="flex justify-between"><span className="text-gray-500">Analytics</span><kbd className="px-2 py-0.5 rounded bg-gray-800 text-gray-300 font-mono">3</kbd></div>
          </div>
          <button onClick={() => setIsShortcutsHelpOpen(false)} className="mt-3 text-xs text-blue-500 hover:underline">Close (Esc)</button>
        </motion.div>
      )}

      {/* Scroll Progress Indicator */}
      <motion.div
        className="fixed top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 transform-gpu z-[60]"
        style={{
          scaleX: scrollY / (document.documentElement.scrollHeight - window.innerHeight || 1),
          transformOrigin: "0%",
        }}
        initial={{ scaleX: 0 }}
      />
    </div>
  );
};

// Wrapper that provides the context
const MainLayout = () => {
  return (
    <SidebarProvider>
      <MainContent />
    </SidebarProvider>
  );
};

export default MainLayout;
