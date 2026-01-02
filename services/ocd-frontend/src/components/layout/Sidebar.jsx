import { useState, useEffect, useRef } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { motion, AnimatePresence } from "framer-motion";
import { toggleTheme } from "../../context/themeSlice";
import { performLogout } from "../../context/authSlice";
import { useSidebar } from "../../context/SidebarContext";
import {
  SunIcon,
  MoonIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  BellIcon,
  UserCircleIcon,
  CogIcon,
  ArrowRightOnRectangleIcon,
  HomeIcon,
  TableCellsIcon,
  ChartPieIcon,
  ClockIcon,
  Squares2X2Icon,
  MagnifyingGlassCircleIcon,
  CalculatorIcon,
  ScaleIcon,
  BanknotesIcon,
  ArrowTrendingUpIcon,
  ChatBubbleLeftRightIcon,
  ArrowRightIcon,
} from "@heroicons/react/24/outline";
import { BellIcon as BellIconSolid } from "@heroicons/react/24/solid";
import { notificationService } from "../../services/notificationService";


const Sidebar = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const theme = useSelector((state) => state.theme.theme);
  const { isAuthenticated, user } = useSelector((state) => state.auth);
  const spotData = useSelector((state) => state.data.data?.spot?.data);

  // Use shared sidebar context
  const { isCollapsed, toggleSidebar, sidebarWidth } = useSidebar();
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [notifications, setNotifications] = useState(0);
  const [notificationList, setNotificationList] = useState([]);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);

  const profileRef = useRef(null);
  const notificationRef = useRef(null);

  // Fetch notifications from backend
  useEffect(() => {
    const fetchNotifications = async () => {
      try {
        const response = await notificationService.getNotifications({ limit: 10 });
        if (response.success) {
          setNotifications(response.unread_count || 0);
          setNotificationList(response.notifications || []);
        }
      } catch (error) {
        console.log("Failed to fetch notifications:", error.message);
      }
    };

    fetchNotifications();
    // Refresh every 30 seconds
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, []);

  // Handle mark all as read
  const handleMarkAllRead = async () => {
    try {
      await notificationService.markAllAsRead();
      setNotifications(0);
      setNotificationList(prev => prev.map(n => ({ ...n, is_read: true })));
    } catch {
      // Silent failure - notifications will be refreshed on next interval
    }
  };

  // Handle mark single as read
  const handleMarkRead = async (id) => {
    try {
      await notificationService.markAsRead(id);
      setNotifications(prev => Math.max(0, prev - 1));
      setNotificationList(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
    } catch {
      // Silent failure
    }
  };


  // Navigation sections with professional icons
  const navigationSections = [
    {
      title: "Overview",
      items: [
        { name: "Dashboard", path: "/dashboard", icon: HomeIcon, badge: null },
      ]
    },
    {
      title: "Trading",
      items: [
        { name: "Option Chain", path: "/option-chain", icon: TableCellsIcon, badge: "Live", badgeColor: "bg-green-500" },
        { name: "Analytics", path: "/analytics", icon: ChartPieIcon, badge: "Pro", badgeColor: "bg-purple-500" },
        { name: "Historical", path: "/historical", icon: ClockIcon, badge: null },
        { name: "Split View", path: "/split-view", icon: Squares2X2Icon, badge: null },
      ]
    },
    {
      title: "Tools",
      items: [
        { name: "Screeners", path: "/screeners", icon: MagnifyingGlassCircleIcon, badge: "New", badgeColor: "bg-blue-500" },
        { name: "Calculators", path: "/calculators", icon: CalculatorIcon, badge: null },
        { name: "Position Sizing", path: "/position-sizing", icon: ScaleIcon, badge: null },
        { name: "TCA", path: "/tca", icon: BanknotesIcon, badge: null },
      ]
    },
  ];

  // Flatten for active checking - reserved for future use
  const _navigationItems = navigationSections.flatMap(s => s.items);


  // Handle click outside for profile dropdown
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (profileRef.current && !profileRef.current.contains(event.target)) {
        setIsProfileOpen(false);
      }
      if (notificationRef.current && !notificationRef.current.contains(event.target)) {
        setIsNotificationsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Market status
  const isMarketOpen = new Date().getHours() >= 9 && new Date().getHours() < 16;

  return (
    <motion.aside
      initial={{ width: sidebarWidth }}
      animate={{ width: sidebarWidth }}
      transition={{ duration: 0.3, ease: "easeInOut" }}
      className={`fixed left-0 top-0 h-screen z-50 flex flex-col ${theme === "dark"
        ? "bg-gray-900 border-gray-700"
        : "bg-white border-gray-200"
        } border-r shadow-xl`}
    >
      {/* Logo Section */}
      <div className="p-3 border-b border-gray-200 dark:border-gray-700">
        <Link to="/" className="flex items-center gap-2">
          <motion.div
            whileHover={{ scale: 1.05 }}
            className="w-10 h-10 bg-gradient-to-br from-blue-600 to-purple-700 rounded-xl flex items-center justify-center shadow-lg flex-shrink-0"
          >
            <ArrowTrendingUpIcon className="w-6 h-6 text-white" />
          </motion.div>
          <AnimatePresence>
            {!isCollapsed && (
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                className="flex flex-col"
              >
                <span className="font-bold text-lg text-gray-900 dark:text-white leading-tight">
                  Deep
                </span>
                <span className="font-bold text-lg bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent leading-tight -mt-1">
                  Strike
                </span>
              </motion.div>
            )}
          </AnimatePresence>
        </Link>
      </div>

      {/* Market Status */}
      {!isCollapsed && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="px-3 py-2 border-b border-gray-200 dark:border-gray-700"
        >
          <div className="flex items-center gap-2 text-xs">
            <div className={`w-2 h-2 rounded-full ${isMarketOpen ? "bg-green-500 animate-pulse" : "bg-red-500"}`} />
            <span className="text-gray-500 dark:text-gray-400">
              {isMarketOpen ? "Market Open" : "Market Closed"}
            </span>
          </div>
          {spotData && (
            <div className={`text-xs mt-1 font-medium ${spotData.change >= 0 ? "text-green-500" : "text-red-500"}`}>
              NIFTY: {spotData.Ltp?.toFixed(2)}
            </div>
          )}
        </motion.div>
      )}

      {/* Navigation Links with Sections */}
      <nav className="flex-1 overflow-y-auto py-2 px-2">
        {navigationSections.map((section, sectionIdx) => (
          <div key={section.title} className={sectionIdx > 0 ? "mt-4" : ""}>
            {/* Section Header */}
            {!isCollapsed && (
              <div className="px-3 py-1.5 mb-1">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                  {section.title}
                </span>
              </div>
            )}

            {/* Section Items */}
            {section.items.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;

              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center gap-3 px-3 py-2.5 mb-0.5 rounded-xl transition-all duration-200 group relative ${isActive
                    ? "bg-gradient-to-r from-blue-500/10 to-purple-500/10 text-blue-600 dark:text-blue-400 shadow-sm"
                    : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800/50 hover:text-gray-900 dark:hover:text-white"
                    }`}
                  title={isCollapsed ? item.name : ""}
                >
                  {isActive && (
                    <motion.div
                      layoutId="activeNav"
                      className="absolute left-0 w-1 h-6 bg-gradient-to-b from-blue-500 to-purple-500 rounded-r-full"
                    />
                  )}
                  <Icon className={`w-5 h-5 flex-shrink-0 ${isActive ? "text-blue-600 dark:text-blue-400" : ""}`} />
                  <AnimatePresence>
                    {!isCollapsed && (
                      <motion.span
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -10 }}
                        className="font-medium text-sm whitespace-nowrap"
                      >
                        {item.name}
                      </motion.span>
                    )}
                  </AnimatePresence>
                  {!isCollapsed && item.badge && (
                    <span className={`ml-auto px-1.5 py-0.5 text-[9px] font-bold text-white rounded-full ${item.badgeColor || 'bg-green-500'}`}>
                      {item.badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>


      {/* Bottom Section */}
      <div className="border-t border-gray-200 dark:border-gray-700 p-2">
        {/* Notifications */}
        <div className="relative" ref={notificationRef}>
          <button
            onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${theme === "dark"
              ? "hover:bg-gray-800 text-gray-400"
              : "hover:bg-gray-100 text-gray-600"
              }`}
          >
            <div className="relative">
              {notifications > 0 ? (
                <BellIconSolid className="w-5 h-5 text-blue-500" />
              ) : (
                <BellIcon className="w-5 h-5" />
              )}
              {notifications > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[10px] rounded-full flex items-center justify-center">
                  {notifications}
                </span>
              )}
            </div>
            {!isCollapsed && (
              <span className="text-sm font-medium">Notifications</span>
            )}
          </button>

          {/* Notification Dropdown */}
          <AnimatePresence>
            {isNotificationsOpen && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className={`absolute mb-2 w-80 rounded-xl shadow-2xl border overflow-hidden z-[100] ${isCollapsed
                  ? "left-full ml-2 bottom-0"
                  : "bottom-full left-0"
                  } ${theme === "dark"
                    ? "bg-gray-800 border-gray-700"
                    : "bg-white border-gray-200"
                  }`}
              >
                {/* Header */}
                <div className={`p-4 border-b flex items-center justify-between ${theme === 'dark' ? 'border-gray-700 bg-gray-800/50' : 'border-gray-50 bg-gray-50/50'}`}>
                  <div className="flex items-center gap-2">
                    <BellIcon className="w-4 h-4 text-blue-500" />
                    <span className="font-bold text-xs uppercase tracking-widest opacity-80">Notifications</span>
                  </div>
                  {notifications > 0 && (
                    <button
                      onClick={handleMarkAllRead}
                      className="text-[10px] font-bold uppercase tracking-tighter text-blue-500 hover:text-blue-600 transition-colors px-2 py-1 rounded-md hover:bg-blue-500/10"
                    >
                      Mark all read
                    </button>
                  )}
                </div>

                {/* List Content */}
                <div className="max-h-80 overflow-y-auto custom-scrollbar">
                  {notificationList.length > 0 ? (
                    notificationList.map((notif) => (
                      <div
                        key={notif.id}
                        onClick={() => !notif.is_read && handleMarkRead(notif.id)}
                        className={`p-4 border-b transition-all relative group cursor-pointer ${theme === 'dark'
                            ? 'border-gray-700/50 hover:bg-gray-700/30'
                            : 'border-gray-50 hover:bg-gray-50'
                          } ${!notif.is_read ? (theme === 'dark' ? 'bg-blue-600/5' : 'bg-blue-50/20') : ''}`}
                      >
                        {!notif.is_read && (
                          <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-600 shadow-[2px_0_10px_rgba(37,99,235,0.4)]" />
                        )}

                        <div className="flex gap-3">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${notif.type === "success" ? "bg-green-500/10 text-green-500" :
                              notif.type === "warning" ? "bg-yellow-500/10 text-yellow-500" :
                                notif.type === "error" ? "bg-red-500/10 text-red-500" :
                                  "bg-blue-500/10 text-blue-500"
                            }`}>
                            <ChatBubbleLeftRightIcon className="w-5 h-5" />
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex justify-between items-start mb-0.5">
                              <p className={`text-sm font-bold truncate ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{notif.title}</p>
                              <span className="text-[9px] font-medium text-gray-500 whitespace-nowrap ml-2 opacity-60">
                                {new Date(notif.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                            <p className={`text-xs leading-relaxed line-clamp-2 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                              {notif.message}
                            </p>

                            {notif.link && (
                              <Link
                                to={notif.link}
                                className="inline-flex items-center gap-1 mt-2 text-[10px] font-black text-blue-500 hover:text-blue-600 uppercase tracking-widest"
                              >
                                View
                                <ArrowRightIcon className="w-2.5 h-2.5" />
                              </Link>
                            )}
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="p-10 text-center">
                      <div className={`w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center ${theme === 'dark' ? 'bg-gray-700/50' : 'bg-gray-100'}`}>
                        <BellIcon className="w-8 h-8 text-gray-400 opacity-30" />
                      </div>
                      <p className={`text-sm font-bold ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>All caught up!</p>
                      <p className="text-xs text-gray-500 mt-1 opacity-70">No new notifications</p>
                    </div>
                  )}
                </div>

                {/* Footer */}
                <div className={`p-3 text-center border-t ${theme === 'dark' ? 'border-gray-700 bg-gray-800/80' : 'border-gray-100 bg-gray-50/50'}`}>
                  <Link
                    to="/profile"
                    onClick={() => setIsNotificationsOpen(false)}
                    className="text-[10px] font-black uppercase tracking-widest text-gray-500 hover:text-blue-500 transition-colors"
                  >
                    View Settings
                  </Link>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Theme Toggle */}
        <button
          onClick={() => dispatch(toggleTheme())}
          className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${theme === "dark"
            ? "hover:bg-gray-800 text-yellow-400"
            : "hover:bg-gray-100 text-gray-600"
            }`}
        >
          {theme === "dark" ? (
            <SunIcon className="w-5 h-5" />
          ) : (
            <MoonIcon className="w-5 h-5" />
          )}
          {!isCollapsed && (
            <span className="text-sm font-medium">
              {theme === "dark" ? "Light Mode" : "Dark Mode"}
            </span>
          )}
        </button>

        {/* Profile (if authenticated) */}
        {isAuthenticated && (
          <div className="relative" ref={profileRef}>
            <button
              onClick={() => setIsProfileOpen(!isProfileOpen)}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${theme === "dark"
                ? "hover:bg-gray-800"
                : "hover:bg-gray-100"
                }`}
            >
              <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center flex-shrink-0">
                <span className="text-white text-sm font-semibold">
                  {user?.name?.charAt(0) || "S"}
                </span>
              </div>
              {!isCollapsed && (
                <span className="text-sm font-medium truncate">
                  {user?.name || "Shivam"}
                </span>
              )}
            </button>

            {/* Profile Dropdown */}
            <AnimatePresence>
              {isProfileOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  className={`absolute bottom-full left-0 mb-2 w-48 rounded-lg shadow-xl border ${theme === "dark"
                    ? "bg-gray-800 border-gray-700"
                    : "bg-white border-gray-200"
                    }`}
                >
                  <div className="p-2">
                    {[
                      { icon: UserCircleIcon, label: "Profile", action: () => navigate("/profile") },
                      { icon: CogIcon, label: "Settings", action: () => navigate("/settings") },
                      { icon: ArrowRightOnRectangleIcon, label: "Logout", action: () => { dispatch(performLogout()); navigate("/"); } },
                    ].map((item, index) => (
                      <button
                        key={index}
                        onClick={item.action}
                        className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left text-sm ${theme === "dark"
                          ? "hover:bg-gray-700 text-gray-300"
                          : "hover:bg-gray-100 text-gray-700"
                          }`}
                      >
                        <item.icon className="w-4 h-4" />
                        {item.label}
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* Collapse Toggle */}
        <button
          onClick={toggleSidebar}
          className={`w-full flex items-center justify-center gap-2 px-3 py-2 mt-2 rounded-lg transition-colors ${theme === "dark"
            ? "hover:bg-gray-800 text-gray-400"
            : "hover:bg-gray-100 text-gray-600"
            }`}
        >
          {isCollapsed ? (
            <ChevronRightIcon className="w-5 h-5" />
          ) : (
            <>
              <ChevronLeftIcon className="w-5 h-5" />
              <span className="text-xs">Collapse</span>
            </>
          )}
        </button>
      </div>
    </motion.aside>
  );
};

export default Sidebar;
