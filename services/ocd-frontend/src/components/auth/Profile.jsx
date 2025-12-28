import { useState, useCallback, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useSelector, useDispatch } from "react-redux";
import { toast } from "react-toastify";
import {
  UserIcon,
  CogIcon,
  BellIcon,
  ShieldCheckIcon,
  ClockIcon,
  ChartBarIcon,
  PencilIcon,
  CheckIcon,
  XMarkIcon,
  CameraIcon,
  EnvelopeIcon,
  PhoneIcon,
  CalendarDaysIcon,
  TrophyIcon,
  ArrowTrendingUpIcon,
  ExclamationTriangleIcon,
  KeyIcon,
  DevicePhoneMobileIcon,
} from "@heroicons/react/24/outline";
import { profileService } from "../../services/profileService";



const Profile = () => {
  const _dispatch = useDispatch();
  const theme = useSelector((state) => state.theme?.theme || "light");
  const [activeTab, setActiveTab] = useState("profile");
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  // Enhanced user data management
  const [userData, setUserData] = useState(() => {
    const storedUser = localStorage.getItem("user");
    return storedUser ? JSON.parse(storedUser) : null;
  });

  const [editedData, setEditedData] = useState({
    username: userData?.username || "",
    email: userData?.email || "",
    phone: userData?.phone || "",
    bio: userData?.bio || "",
    location: userData?.location || "",
  });

  const [notificationSettings, setNotificationSettings] = useState({
    trade_alerts: true,
    price_alerts: true,
    news_updates: false,
    market_analysis: true,
    email_notifications: true,
    push_notifications: false,
  });

  const [securitySettings, _setSecuritySettings] = useState({
    twoFactorEnabled: false,
    loginAlerts: true,
    sessionTimeout: 30,
  });

  const [tradingStats, setTradingStats] = useState({
    totalTrades: "0",
    winRate: "0%",
    totalPnL: "₹0",
    avgReturn: "0%",
    riskScore: "Low",
    activeDays: "0",
  });

  const [_profileLoading, setProfileLoading] = useState(true);

  // Fetch profile data from backend API
  useEffect(() => {
    const fetchProfileData = async () => {
      try {
        setProfileLoading(true);

        // Fetch profile from backend
        const profileResponse = await profileService.getMyProfile();
        if (profileResponse.success && profileResponse.data) {
          const profile = profileResponse.data;
          setUserData({
            ...profile,
            username: profile.username || profile.email?.split('@')[0],
            joinDate: profile.created_at ? new Date(profile.created_at).toLocaleDateString() : new Date().toLocaleDateString(),
          });
          setEditedData({
            username: profile.username || "",
            email: profile.email || "",
            phone: profile.phone || "",
            bio: profile.bio || "",
            location: profile.location || "",
          });
          if (profile.notification_settings) {
            setNotificationSettings(profile.notification_settings);
          }
          if (profile.trading_stats) {
            setTradingStats(profile.trading_stats);
          }
        }

        // Fetch trading stats separately for more detailed data
        const statsResponse = await profileService.getMyTradingStats();
        if (statsResponse.success && statsResponse.stats) {
          const stats = statsResponse.stats;
          setTradingStats({
            totalTrades: stats.total_trades?.toLocaleString() || "0",
            winRate: `${stats.win_rate || 0}%`,
            totalPnL: `₹${(stats.total_pnl / 100000).toFixed(1)}L`,
            avgReturn: `${stats.avg_return || 0}%`,
            riskScore: stats.total_pnl > 500000 ? "High" : stats.total_pnl > 100000 ? "Medium" : "Low",
            activeDays: stats.active_days?.toString() || "0",
          });
        }
      } catch (error) {
        console.log("Using local profile data:", error.message);
        // Fallback to localStorage data if API fails
      } finally {
        setProfileLoading(false);
      }
    };

    fetchProfileData();
  }, []);

  // Professional tab configuration
  const tabs = useMemo(
    () => [
      {
        id: "profile",
        label: "Profile",
        icon: UserIcon,
        color: "from-blue-500 to-blue-600",
      },
      {
        id: "trading",
        label: "Trading Stats",
        icon: ChartBarIcon,
        color: "from-green-500 to-green-600",
      },
      {
        id: "notifications",
        label: "Notifications",
        icon: BellIcon,
        color: "from-purple-500 to-purple-600",
      },
      {
        id: "security",
        label: "Security",
        icon: ShieldCheckIcon,
        color: "from-red-500 to-red-600",
      },
      {
        id: "settings",
        label: "Settings",
        icon: CogIcon,
        color: "from-gray-500 to-gray-600",
      },
      {
        id: "history",
        label: "Activity",
        icon: ClockIcon,
        color: "from-orange-500 to-orange-600",
      },
    ],
    []
  );

  // Enhanced profile data with trading metrics
  const profileData = useMemo(
    () => ({
      username: userData?.username || "Professional Trader",
      email: userData?.email || "trader@deepstrike.com",
      phone: userData?.phone || "",
      bio:
        userData?.bio ||
        "Professional options trader with expertise in algorithmic strategies.",
      location: userData?.location || "Bangalore, India",
      joinDate: userData?.joinDate || new Date().toLocaleDateString(),
      subscription: userData?.subscription_type || "Professional",
      isVerified: userData?.is_email_verified || false,
      stats: tradingStats,
    }),
    [userData, tradingStats]
  );


  // Validation functions
  const validateForm = useCallback(() => {
    const newErrors = {};

    if (!editedData.username.trim()) {
      newErrors.username = "Username is required";
    } else if (editedData.username.length < 3) {
      newErrors.username = "Username must be at least 3 characters";
    }

    if (!editedData.email.trim()) {
      newErrors.email = "Email is required";
    } else if (!/\S+@\S+\.\S+/.test(editedData.email)) {
      newErrors.email = "Please enter a valid email address";
    }

    if (
      editedData.phone &&
      !/^[+]?[0-9\s\-()]{10,}$/.test(editedData.phone)
    ) {
      newErrors.phone = "Please enter a valid phone number";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [editedData]);

  // Handle form submission
  const handleSave = useCallback(async () => {
    if (!validateForm()) {
      toast.error("Please fix the errors before saving");
      return;
    }

    setLoading(true);
    try {
      // Call backend API to update profile
      const response = await profileService.updateMyProfile({
        username: editedData.username,
        phone: editedData.phone,
        bio: editedData.bio,
        location: editedData.location,
      });

      if (response.success) {
        const updatedUser = { ...userData, ...editedData };
        localStorage.setItem("user", JSON.stringify(updatedUser));
        setUserData(updatedUser);
        setIsEditing(false);
        toast.success("Profile updated successfully");
      } else {
        toast.error(response.message || "Failed to update profile");
      }
    } catch (error) {
      console.error("Profile update error:", error);
      // Fallback: save to localStorage if API fails
      const updatedUser = { ...userData, ...editedData };
      localStorage.setItem("user", JSON.stringify(updatedUser));
      setUserData(updatedUser);
      setIsEditing(false);
      toast.success("Profile saved locally");
    } finally {
      setLoading(false);
    }
  }, [editedData, userData, validateForm]);


  const handleCancel = useCallback(() => {
    setEditedData({
      username: userData?.username || "",
      email: userData?.email || "",
      phone: userData?.phone || "",
      bio: userData?.bio || "",
      location: userData?.location || "",
    });
    setErrors({});
    setIsEditing(false);
  }, [userData]);

  const handleInputChange = useCallback(
    (field, value) => {
      setEditedData((prev) => ({ ...prev, [field]: value }));
      if (errors[field]) {
        setErrors((prev) => ({ ...prev, [field]: "" }));
      }
    },
    [errors]
  );

  const toggleNotification = useCallback(async (key) => {
    const newSettings = {
      ...notificationSettings,
      [key]: !notificationSettings[key],
    };
    setNotificationSettings(newSettings);

    // Save to backend
    try {
      await profileService.updateNotificationSettings(newSettings);
    } catch (error) {
      console.log("Failed to save notification settings:", error.message);
    }
  }, [notificationSettings]);


  // Animation variants
  const containerVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.6,
        staggerChildren: 0.1,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 },
  };

  const tabContentVariants = {
    hidden: { opacity: 0, x: 20 },
    visible: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: -20 },
  };

  // Render profile content
  const renderProfileContent = () => (
    <motion.div
      variants={tabContentVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
      className="space-y-8"
    >
      {/* Profile Header */}
      <div
        className={`p-8 rounded-3xl border ${theme === "dark"
          ? "bg-gray-800/50 border-gray-700/50"
          : "bg-white/50 border-gray-200/50"
          } backdrop-blur-xl`}
      >
        <div className="flex flex-col md:flex-row items-start md:items-center space-y-6 md:space-y-0 md:space-x-8">
          {/* Profile Picture */}
          <div className="relative">
            <div
              className={`w-32 h-32 rounded-3xl flex items-center justify-center text-4xl font-bold shadow-2xl ${theme === "dark"
                ? "bg-gradient-to-br from-blue-600 to-purple-600 text-white"
                : "bg-gradient-to-br from-blue-500 to-purple-500 text-white"
                }`}
            >
              {profileData.username.charAt(0).toUpperCase()}
            </div>
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
              className="absolute -bottom-2 -right-2 p-3 bg-blue-600 rounded-2xl text-white hover:bg-blue-700 transition-colors shadow-lg"
            >
              <CameraIcon className="w-5 h-5" />
            </motion.button>
          </div>

          {/* Profile Info */}
          <div className="flex-1">
            {isEditing ? (
              <div className="space-y-4">
                <div>
                  <input
                    type="text"
                    value={editedData.username}
                    onChange={(e) =>
                      handleInputChange("username", e.target.value)
                    }
                    className={`text-3xl font-bold bg-transparent border-b-2 focus:outline-none transition-colors ${errors.username
                      ? "border-red-500 text-red-500"
                      : theme === "dark"
                        ? "border-gray-600 text-white focus:border-blue-500"
                        : "border-gray-300 text-gray-900 focus:border-blue-500"
                      }`}
                    placeholder="Enter username"
                  />
                  {errors.username && (
                    <p className="text-red-500 text-sm mt-1">
                      {errors.username}
                    </p>
                  )}
                </div>
                <div>
                  <input
                    type="email"
                    value={editedData.email}
                    onChange={(e) => handleInputChange("email", e.target.value)}
                    className={`text-lg bg-transparent border-b focus:outline-none transition-colors w-full ${errors.email
                      ? "border-red-500 text-red-500"
                      : theme === "dark"
                        ? "border-gray-600 text-gray-400 focus:border-blue-500"
                        : "border-gray-300 text-gray-600 focus:border-blue-500"
                      }`}
                    placeholder="Enter email"
                  />
                  {errors.email && (
                    <p className="text-red-500 text-sm mt-1">{errors.email}</p>
                  )}
                </div>
                <textarea
                  value={editedData.bio}
                  onChange={(e) => handleInputChange("bio", e.target.value)}
                  className={`w-full bg-transparent border rounded-lg p-3 focus:outline-none transition-colors resize-none ${theme === "dark"
                    ? "border-gray-600 text-gray-300 focus:border-blue-500"
                    : "border-gray-300 text-gray-700 focus:border-blue-500"
                    }`}
                  rows="3"
                  placeholder="Tell us about yourself..."
                />
              </div>
            ) : (
              <div>
                <div className="flex items-center space-x-3 mb-2">
                  <h2
                    className={`text-3xl font-bold ${theme === "dark" ? "text-white" : "text-gray-900"
                      }`}
                  >
                    {profileData.username}
                  </h2>
                  {profileData.isVerified && (
                    <div className="flex items-center space-x-1 px-3 py-1 bg-green-100 dark:bg-green-900/30 rounded-full">
                      <ShieldCheckIcon className="w-4 h-4 text-green-600" />
                      <span className="text-green-600 text-sm font-medium">
                        Verified
                      </span>
                    </div>
                  )}
                </div>
                <p
                  className={`text-lg mb-3 ${theme === "dark" ? "text-gray-400" : "text-gray-600"
                    }`}
                >
                  {profileData.email}
                </p>
                <p
                  className={`text-base leading-relaxed ${theme === "dark" ? "text-gray-300" : "text-gray-700"
                    }`}
                >
                  {profileData.bio}
                </p>
                <div className="flex items-center space-x-4 mt-4">
                  <div className="flex items-center space-x-2">
                    <CalendarDaysIcon className="w-5 h-5 text-blue-500" />
                    <span
                      className={`text-sm ${theme === "dark" ? "text-gray-400" : "text-gray-600"
                        }`}
                    >
                      Joined {profileData.joinDate}
                    </span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <TrophyIcon className="w-5 h-5 text-yellow-500" />
                    <span
                      className={`text-sm ${theme === "dark" ? "text-gray-400" : "text-gray-600"
                        }`}
                    >
                      {profileData.subscription} Plan
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col space-y-3">
            {isEditing ? (
              <>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={handleSave}
                  disabled={loading}
                  className="flex items-center space-x-2 px-6 py-3 bg-green-600 text-white rounded-xl font-semibold hover:bg-green-700 transition-colors disabled:opacity-50"
                >
                  {loading ? (
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{
                        duration: 1,
                        repeat: Infinity,
                        ease: "linear",
                      }}
                      className="w-5 h-5 border-2 border-white border-t-transparent rounded-full"
                    />
                  ) : (
                    <CheckIcon className="w-5 h-5" />
                  )}
                  <span>{loading ? "Saving..." : "Save"}</span>
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={handleCancel}
                  className="flex items-center space-x-2 px-6 py-3 bg-gray-500 text-white rounded-xl font-semibold hover:bg-gray-600 transition-colors"
                >
                  <XMarkIcon className="w-5 h-5" />
                  <span>Cancel</span>
                </motion.button>
              </>
            ) : (
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setIsEditing(true)}
                className="flex items-center space-x-2 px-6 py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition-colors"
              >
                <PencilIcon className="w-5 h-5" />
                <span>Edit Profile</span>
              </motion.button>
            )}

            {/* Admin Panel button - only visible to admin users */}
            {(userData?.role === 'admin' || userData?.role === 'ADMIN') && (
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => (window.location.href = "/admin")}
                className="flex items-center space-x-2 px-6 py-3 bg-purple-600 text-white rounded-xl font-semibold hover:bg-purple-700 transition-colors"
              >
                <CogIcon className="w-5 h-5" />
                <span>Admin Panel</span>
              </motion.button>
            )}
          </div>
        </div>
      </div>

      {/* Contact Information */}
      <div
        className={`p-6 rounded-2xl border ${theme === "dark"
          ? "bg-gray-800/30 border-gray-700/50"
          : "bg-gray-50/50 border-gray-200/50"
          }`}
      >
        <h3
          className={`text-xl font-bold mb-4 ${theme === "dark" ? "text-white" : "text-gray-900"
            }`}
        >
          Contact Information
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex items-center space-x-3">
            <EnvelopeIcon className="w-5 h-5 text-blue-500" />
            <span
              className={theme === "dark" ? "text-gray-300" : "text-gray-700"}
            >
              {profileData.email}
            </span>
          </div>
          {profileData.phone && (
            <div className="flex items-center space-x-3">
              <PhoneIcon className="w-5 h-5 text-green-500" />
              <span
                className={theme === "dark" ? "text-gray-300" : "text-gray-700"}
              >
                {profileData.phone}
              </span>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );

  // Render trading stats
  const renderTradingStats = () => (
    <motion.div
      variants={tabContentVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
      className="space-y-6"
    >
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {Object.entries(profileData.stats).map(([key, value], _index) => {
          const statConfig = {
            totalTrades: {
              icon: ChartBarIcon,
              color: "text-blue-500",
              label: "Total Trades",
            },
            winRate: {
              icon: TrophyIcon,
              color: "text-green-500",
              label: "Win Rate",
            },
            totalPnL: {
              icon: ArrowTrendingUpIcon,
              color: "text-purple-500",
              label: "Total P&L",
            },
            avgReturn: {
              icon: ChartBarIcon,
              color: "text-orange-500",
              label: "Avg Return",
            },
            riskScore: {
              icon: ShieldCheckIcon,
              color: "text-yellow-500",
              label: "Risk Score",
            },
            activeDays: {
              icon: CalendarDaysIcon,
              color: "text-indigo-500",
              label: "Active Days",
            },
          };

          const config = statConfig[key];
          const Icon = config?.icon || ChartBarIcon;

          return (
            <motion.div
              key={key}
              variants={itemVariants}
              whileHover={{ scale: 1.02, y: -5 }}
              className={`p-6 rounded-2xl border ${theme === "dark"
                ? "bg-gray-800/50 border-gray-700/50"
                : "bg-white/50 border-gray-200/50"
                } backdrop-blur-xl shadow-lg`}
            >
              <div className="flex items-center justify-between mb-4">
                <Icon
                  className={`w-8 h-8 ${config?.color || "text-gray-500"}`}
                />
                <span
                  className={`text-2xl font-bold ${theme === "dark" ? "text-white" : "text-gray-900"
                    }`}
                >
                  {value}
                </span>
              </div>
              <div
                className={`text-sm font-medium ${theme === "dark" ? "text-gray-400" : "text-gray-600"
                  }`}
              >
                {config?.label ||
                  key
                    .replace(/([A-Z])/g, " $1")
                    .replace(/^./, (str) => str.toUpperCase())}
              </div>
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );

  // Render notifications
  const renderNotifications = () => (
    <motion.div
      variants={tabContentVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
      className="space-y-6"
    >
      <h3
        className={`text-2xl font-bold mb-6 ${theme === "dark" ? "text-white" : "text-gray-900"
          }`}
      >
        Notification Preferences
      </h3>

      <div className="space-y-4">
        {Object.entries(notificationSettings).map(([key, enabled]) => {
          const notificationConfig = {
            trade_alerts: {
              label: "Trade Execution Alerts",
              desc: "Get notified when trades are executed",
            },
            price_alerts: {
              label: "Price Movement Alerts",
              desc: "Alerts for significant price changes",
            },
            news_updates: {
              label: "Market News Updates",
              desc: "Latest market news and updates",
            },
            market_analysis: {
              label: "Market Analysis Reports",
              desc: "Daily and weekly analysis reports",
            },
            email_notifications: {
              label: "Email Notifications",
              desc: "Receive notifications via email",
            },
            push_notifications: {
              label: "Push Notifications",
              desc: "Browser push notifications",
            },
          };

          const config = notificationConfig[key] || {
            label: key
              .replace(/_/g, " ")
              .replace(/\b\w/g, (l) => l.toUpperCase()),
            desc: "Notification setting",
          };

          return (
            <motion.div
              key={key}
              whileHover={{ scale: 1.01 }}
              className={`flex items-center justify-between p-6 rounded-2xl border ${theme === "dark"
                ? "bg-gray-800/50 border-gray-700/50"
                : "bg-white/50 border-gray-200/50"
                } backdrop-blur-xl`}
            >
              <div>
                <h4
                  className={`font-semibold ${theme === "dark" ? "text-white" : "text-gray-900"
                    }`}
                >
                  {config.label}
                </h4>
                <p
                  className={`text-sm ${theme === "dark" ? "text-gray-400" : "text-gray-600"
                    }`}
                >
                  {config.desc}
                </p>
              </div>

              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={() => toggleNotification(key)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${enabled ? "bg-blue-600" : "bg-gray-300 dark:bg-gray-600"
                  }`}
              >
                <motion.span
                  animate={{ x: enabled ? 20 : 2 }}
                  transition={{ type: "spring", stiffness: 500, damping: 30 }}
                  className="inline-block h-4 w-4 transform rounded-full bg-white shadow-lg"
                />
              </motion.button>
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );

  // Render security settings
  const renderSecurity = () => (
    <motion.div
      variants={tabContentVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
      className="space-y-8"
    >
      <h3
        className={`text-2xl font-bold mb-6 ${theme === "dark" ? "text-white" : "text-gray-900"
          }`}
      >
        Security & Privacy
      </h3>

      {/* Two-Factor Authentication */}
      <div
        className={`p-6 rounded-2xl border ${theme === "dark"
          ? "bg-gray-800/50 border-gray-700/50"
          : "bg-white/50 border-gray-200/50"
          } backdrop-blur-xl`}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <DevicePhoneMobileIcon className="w-6 h-6 text-green-500" />
            <div>
              <h4
                className={`font-semibold ${theme === "dark" ? "text-white" : "text-gray-900"
                  }`}
              >
                Two-Factor Authentication
              </h4>
              <p
                className={`text-sm ${theme === "dark" ? "text-gray-400" : "text-gray-600"
                  }`}
              >
                Add an extra layer of security to your account
              </p>
            </div>
          </div>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${securitySettings.twoFactorEnabled
              ? "bg-red-600 text-white hover:bg-red-700"
              : "bg-green-600 text-white hover:bg-green-700"
              }`}
          >
            {securitySettings.twoFactorEnabled ? "Disable" : "Enable"}
          </motion.button>
        </div>
      </div>

      {/* Password Change */}
      <div
        className={`p-6 rounded-2xl border ${theme === "dark"
          ? "bg-gray-800/50 border-gray-700/50"
          : "bg-white/50 border-gray-200/50"
          } backdrop-blur-xl`}
      >
        <div className="flex items-center space-x-3 mb-6">
          <KeyIcon className="w-6 h-6 text-blue-500" />
          <h4
            className={`text-lg font-semibold ${theme === "dark" ? "text-white" : "text-gray-900"
              }`}
          >
            Change Password
          </h4>
        </div>

        <form className="space-y-4">
          <div>
            <label
              className={`block text-sm font-medium mb-2 ${theme === "dark" ? "text-gray-300" : "text-gray-700"
                }`}
            >
              Current Password
            </label>
            <input
              type="password"
              className={`w-full p-3 rounded-lg border transition-colors ${theme === "dark"
                ? "bg-gray-700 border-gray-600 text-white focus:border-blue-500"
                : "bg-white border-gray-300 text-gray-900 focus:border-blue-500"
                } focus:outline-none focus:ring-2 focus:ring-blue-500/20`}
              placeholder="Enter current password"
            />
          </div>
          <div>
            <label
              className={`block text-sm font-medium mb-2 ${theme === "dark" ? "text-gray-300" : "text-gray-700"
                }`}
            >
              New Password
            </label>
            <input
              type="password"
              className={`w-full p-3 rounded-lg border transition-colors ${theme === "dark"
                ? "bg-gray-700 border-gray-600 text-white focus:border-blue-500"
                : "bg-white border-gray-300 text-gray-900 focus:border-blue-500"
                } focus:outline-none focus:ring-2 focus:ring-blue-500/20`}
              placeholder="Enter new password"
            />
          </div>
          <div>
            <label
              className={`block text-sm font-medium mb-2 ${theme === "dark" ? "text-gray-300" : "text-gray-700"
                }`}
            >
              Confirm New Password
            </label>
            <input
              type="password"
              className={`w-full p-3 rounded-lg border transition-colors ${theme === "dark"
                ? "bg-gray-700 border-gray-600 text-white focus:border-blue-500"
                : "bg-white border-gray-300 text-gray-900 focus:border-blue-500"
                } focus:outline-none focus:ring-2 focus:ring-blue-500/20`}
              placeholder="Confirm new password"
            />
          </div>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            type="submit"
            className="px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors"
          >
            Update Password
          </motion.button>
        </form>
      </div>
    </motion.div>
  );

  // Render content based on active tab
  const renderTabContent = () => {
    switch (activeTab) {
      case "profile":
        return renderProfileContent();
      case "trading":
        return renderTradingStats();
      case "notifications":
        return renderNotifications();
      case "security":
        return renderSecurity();
      case "settings":
      case "history":
      default:
        return (
          <motion.div
            variants={tabContentVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className={`text-center py-16 ${theme === "dark" ? "text-gray-400" : "text-gray-600"
              }`}
          >
            <div className="space-y-4">
              <div
                className={`w-24 h-24 mx-auto rounded-full flex items-center justify-center ${theme === "dark" ? "bg-gray-800" : "bg-gray-100"
                  }`}
              >
                <CogIcon className="w-12 h-12" />
              </div>
              <h3 className="text-xl font-semibold">Coming Soon</h3>
              <p>
                This feature is under development and will be available soon.
              </p>
            </div>
          </motion.div>
        );
    }
  };

  return (
    <div
      className={`min-h-screen py-12 px-4 sm:px-6 lg:px-8 ${theme === "dark"
        ? "bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950"
        : "bg-gradient-to-br from-slate-50 via-blue-50/30 to-gray-50"
        }`}
    >
      {/* Background Elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-32 left-16 w-40 h-40 border border-blue-500/5 rounded-2xl backdrop-blur-3xl" />
        <div className="absolute bottom-32 right-16 w-32 h-32 border border-green-500/5 rounded-full backdrop-blur-3xl" />
      </div>

      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="max-w-7xl mx-auto relative z-10"
      >
        {/* Header */}
        <motion.div variants={itemVariants} className="text-center mb-12">
          <div className="flex items-center justify-center mb-6">
            <div
              className={`p-4 rounded-2xl ${theme === "dark"
                ? "bg-gradient-to-r from-blue-600 to-purple-600"
                : "bg-gradient-to-r from-blue-500 to-purple-500"
                } shadow-2xl mr-4`}
            >
              <UserIcon className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1
                className={`text-4xl md:text-5xl font-black ${theme === "dark" ? "text-white" : "text-gray-900"
                  }`}
              >
                Profile Dashboard
              </h1>
              <p
                className={`text-lg ${theme === "dark" ? "text-gray-300" : "text-gray-600"
                  }`}
              >
                Manage your trading account and preferences
              </p>
            </div>
          </div>
        </motion.div>

        {/* Navigation Tabs */}
        <motion.div
          variants={itemVariants}
          className="flex flex-wrap gap-3 mb-8 justify-center lg:justify-start"
        >
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <motion.button
                key={tab.id}
                whileHover={{ scale: 1.05, y: -2 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center space-x-3 px-6 py-4 rounded-2xl font-semibold transition-all duration-300 ${activeTab === tab.id
                  ? `bg-gradient-to-r ${tab.color} text-white shadow-2xl`
                  : theme === "dark"
                    ? "bg-gray-800/50 text-gray-300 hover:bg-gray-700/50 border border-gray-700/50"
                    : "bg-white/50 text-gray-700 hover:bg-gray-50 border border-gray-200/50"
                  } backdrop-blur-xl`}
              >
                <Icon className="w-5 h-5" />
                <span className="hidden sm:inline">{tab.label}</span>
              </motion.button>
            );
          })}
        </motion.div>

        {/* Content Area */}
        <motion.div
          variants={itemVariants}
          className={`rounded-3xl shadow-2xl border overflow-hidden ${theme === "dark"
            ? "bg-gray-900/50 border-gray-700/50"
            : "bg-white/50 border-gray-200/50"
            } backdrop-blur-xl p-8`}
        >
          <AnimatePresence mode="wait">{renderTabContent()}</AnimatePresence>
        </motion.div>

        {/* Security Notice */}
        <motion.div variants={itemVariants} className="mt-8">
          <div
            className={`flex items-start space-x-4 p-6 rounded-2xl border ${theme === "dark"
              ? "bg-blue-900/20 border-blue-500/30 text-blue-200"
              : "bg-blue-50 border-blue-200 text-blue-800"
              } backdrop-blur-xl`}
          >
            <ExclamationTriangleIcon className="w-6 h-6 text-blue-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm leading-relaxed">
                <span className="font-semibold">Security Notice:</span> Your
                profile data is encrypted and stored securely. We follow
                industry-standard security practices to protect your personal
                and trading information.
              </p>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
};

export default Profile;
