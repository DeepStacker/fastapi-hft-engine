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
  MapPinIcon,
} from "@heroicons/react/24/outline";
import { profileService } from "../../services/profileService";
import { setDarkTheme, setLightTheme } from "../../context/themeSlice";

const Profile = () => {
  const dispatch = useDispatch();
  const theme = useSelector((state) => state.theme?.theme || "light");
  const [activeTab, setActiveTab] = useState("profile");
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  // App settings state
  const [refreshRate, setRefreshRate] = useState(() => localStorage.getItem('app_refresh_rate') || '3s');
  const [soundEnabled, setSoundEnabled] = useState(() => localStorage.getItem('app_sound_enabled') === 'true');

  // Enhanced user data management
  const [userData, setUserData] = useState(() => {
    const storedUser = localStorage.getItem("user");
    return storedUser ? JSON.parse(storedUser) : null;
  });

  const [editedData, setEditedData] = useState({
    username: userData?.username || "",
    full_name: userData?.full_name || "",
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
  const [activityLogs, setActivityLogs] = useState([]);
  const [activityLoading, setActivityLoading] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [securityLoading, setSecurityLoading] = useState(false);

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
            full_name: profile.full_name || "",
            email: profile.email || "",
            phone: profile.phone || "",
            bio: profile.bio || "",
            location: profile.location || "",
          });
          if (profile.preferences) {
            const prefs = profile.preferences;
            if (prefs.trade_alerts !== undefined) {
              setNotificationSettings(prev => ({ ...prev, ...prefs }));
            }
            if (prefs.theme) {
              if (prefs.theme === 'dark') dispatch(setDarkTheme());
              else dispatch(setLightTheme());
            }
            if (prefs.refresh_rate) setRefreshRate(`${prefs.refresh_rate}s`);
            if (prefs.sound_enabled !== undefined) setSoundEnabled(prefs.sound_enabled);
          } else if (profile.notification_settings) {
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
      full_name: userData?.full_name || "",
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

  const profileCompleteness = useMemo(() => {
    let score = 0;
    if (profileData.full_name) score += 20;
    if (profileData.username) score += 20;
    if (profileData.bio && profileData.bio.length > 20) score += 20;
    if (profileData.phone) score += 20;
    if (profileData.location) score += 20;
    return score;
  }, [profileData]);


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
        full_name: editedData.full_name,
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

  const fetchActivityLogs = useCallback(async () => {
    try {
      setActivityLoading(true);
      const response = await profileService.getActivityLogs();
      if (response.success) {
        setActivityLogs(response.activities);
      }
    } catch (error) {
      console.error("Failed to fetch activity logs:", error);
    } finally {
      setActivityLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === "history") {
      fetchActivityLogs();
    }
  }, [activeTab, fetchActivityLogs]);

  const handlePasswordChange = useCallback(async (e) => {
    e.preventDefault();
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast.error("New passwords do not match");
      return;
    }
    if (passwordForm.newPassword.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }

    try {
      setSecurityLoading(true);
      const response = await profileService.changePassword({
        current_password: passwordForm.currentPassword,
        new_password: passwordForm.newPassword,
      });
      if (response.success) {
        toast.success("Password updated successfully");
        setPasswordForm({
          currentPassword: "",
          newPassword: "",
          confirmPassword: "",
        });
      }
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to update password");
    } finally {
      setSecurityLoading(false);
    }
  }, [passwordForm]);

  const handleInputChange = useCallback(
    (field, value) => {
      setEditedData((prev) => ({ ...prev, [field]: value }));
      if (errors[field]) {
        setErrors((prev) => ({ ...prev, [field]: "" }));
      }
    },
    [errors]
  );

  const savePreferences = useCallback(async (updates) => {
    try {
      const allSettings = {
        ...notificationSettings,
        theme,
        sound_enabled: soundEnabled,
        refresh_rate: parseInt(refreshRate),
        ...updates
      };
      await profileService.updateNotificationSettings(allSettings);
    } catch (error) {
      console.error("Failed to save preferences:", error);
    }
  }, [notificationSettings, theme, soundEnabled, refreshRate]);

  const toggleNotification = useCallback(async (key) => {
    const newSettings = {
      ...notificationSettings,
      [key]: !notificationSettings[key],
    };
    setNotificationSettings(newSettings);
    savePreferences(newSettings);
  }, [notificationSettings, savePreferences]);


  // Animation variants
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
        delayChildren: 0.2
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 30, scale: 0.95 },
    visible: {
      opacity: 1,
      y: 0,
      scale: 1,
      transition: { type: "spring", damping: 20, stiffness: 100 }
    }
  };

  const tabContentVariants = {
    hidden: { opacity: 0, x: 30, filter: "blur(10px)" },
    visible: {
      opacity: 1,
      x: 0,
      filter: "blur(0px)",
      transition: { duration: 0.4, ease: "easeOut" }
    },
    exit: {
      opacity: 0,
      x: -30,
      filter: "blur(10px)",
      transition: { duration: 0.2, ease: "easeIn" }
    }
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
      {/* Profile Header */}
      <div
        className={`relative p-10 rounded-[3rem] border overflow-hidden transition-all duration-500 group ${theme === "dark"
          ? "bg-gray-900 border-gray-800 shadow-[0_0_50px_-12px_rgba(59,130,246,0.15)]"
          : "bg-white border-gray-200 shadow-xl"
          }`}
      >
        {/* Decorative background glow */}
        <div className="absolute -top-24 -right-24 w-64 h-64 bg-blue-500/10 rounded-full blur-[100px] pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-purple-500/10 rounded-full blur-[100px] pointer-events-none" />

        <div className="relative flex flex-col lg:flex-row items-center lg:items-start gap-12">
          {/* Profile Picture with animated progress ring */}
          <div className="relative shrink-0">
            <svg className="w-40 h-40 transform -rotate-90">
              <circle
                cx="80"
                cy="80"
                r="74"
                stroke="currentColor"
                strokeWidth="4"
                fill="transparent"
                className={theme === "dark" ? "text-gray-800" : "text-gray-100"}
              />
              <motion.circle
                cx="80"
                cy="80"
                r="74"
                stroke="url(#gradient)"
                strokeWidth="6"
                fill="transparent"
                strokeDasharray={465}
                initial={{ strokeDashoffset: 465 }}
                animate={{ strokeDashoffset: 465 - (465 * profileCompleteness) / 100 }}
                transition={{ duration: 1.5, ease: "easeOut" }}
                strokeLinecap="round"
              />
              <defs>
                <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#3b82f6" />
                  <stop offset="100%" stopColor="#8b5cf6" />
                </linearGradient>
              </defs>
            </svg>
            <div className="absolute inset-0 flex items-center justify-center p-3">
              <div
                className={`w-full h-full rounded-full flex items-center justify-center text-5xl font-black shadow-inner overflow-hidden ${theme === "dark"
                  ? "bg-gray-800 text-transparent bg-clip-text bg-gradient-to-br from-blue-400 to-purple-400"
                  : "bg-gray-100 text-transparent bg-clip-text bg-gradient-to-br from-blue-600 to-purple-600"
                  }`}
              >
                {profileData.username.charAt(0).toUpperCase()}
              </div>
            </div>
            <motion.button
              whileHover={{ scale: 1.1, rotate: 10 }}
              whileTap={{ scale: 0.9 }}
              className="absolute bottom-2 right-2 p-3 bg-blue-600 text-white rounded-2xl shadow-lg ring-4 ring-white dark:ring-gray-900"
            >
              <CameraIcon className="w-5 h-5" />
            </motion.button>
            <div className="absolute -top-4 -left-4 px-4 py-1.5 bg-gradient-to-r from-blue-600 to-purple-600 rounded-full text-[10px] font-black uppercase tracking-widest text-white shadow-lg">
              {profileCompleteness}% Complete
            </div>
          </div>

          {/* Profile Info */}
          <div className="flex-1 text-center lg:text-left">
            {isEditing ? (
              <div className="space-y-6 max-w-2xl mx-auto lg:mx-0">
                <div className="relative group">
                  <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
                  <input
                    type="text"
                    value={editedData.full_name}
                    onChange={(e) => handleInputChange("full_name", e.target.value)}
                    className={`text-3xl font-bold bg-transparent border-b-2 pl-12 pb-2 focus:outline-none transition-all w-full ${theme === "dark"
                      ? "border-gray-800 text-white focus:border-blue-500"
                      : "border-gray-200 text-gray-900 focus:border-blue-500"
                      }`}
                    placeholder="Full Name"
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="relative group">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold group-focus-within:text-blue-500 transition-colors">@</span>
                    <input
                      type="text"
                      value={editedData.username}
                      onChange={(e) => handleInputChange("username", e.target.value)}
                      className={`text-xl bg-transparent border-b-2 pl-12 pb-2 focus:outline-none transition-all w-full ${errors.username
                        ? "border-red-500 text-red-500"
                        : theme === "dark"
                          ? "border-gray-800 text-gray-300 focus:border-blue-500"
                          : "border-gray-200 text-gray-600 focus:border-blue-500"
                        }`}
                      placeholder="Username"
                    />
                  </div>
                  <div className="relative group">
                    <EnvelopeIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
                    <input
                      type="email"
                      value={editedData.email}
                      onChange={(e) => handleInputChange("email", e.target.value)}
                      className={`text-xl bg-transparent border-b-2 pl-12 pb-2 focus:outline-none transition-all w-full ${errors.email
                        ? "border-red-500 text-red-500"
                        : theme === "dark"
                          ? "border-gray-800 text-gray-300 focus:border-blue-500"
                          : "border-gray-200 text-gray-600 focus:border-blue-500"
                        }`}
                      placeholder="Email Address"
                    />
                  </div>
                </div>
                <div className="relative group">
                  <textarea
                    value={editedData.bio}
                    onChange={(e) => handleInputChange("bio", e.target.value)}
                    className={`w-full bg-transparent border-2 rounded-2xl p-4 focus:outline-none transition-all resize-none min-h-[120px] ${theme === "dark"
                      ? "border-gray-800 text-gray-300 focus:border-blue-500 focus:bg-gray-800/20"
                      : "border-gray-200 text-gray-700 focus:border-blue-500 focus:bg-blue-50/20"
                      }`}
                    placeholder="Describe your trading philosophy..."
                  />
                  <div className="absolute right-4 bottom-4 text-xs font-mono text-gray-500">
                    {editedData.bio.length} chars
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="relative group">
                    <PhoneIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
                    <input
                      type="text"
                      value={editedData.phone}
                      onChange={(e) => handleInputChange("phone", e.target.value)}
                      className={`bg-transparent border-b-2 pl-12 pb-2 focus:outline-none transition-all w-full ${theme === "dark" ? "border-gray-800 text-white focus:border-blue-500" : "border-gray-200 text-gray-900 focus:border-blue-500"}`}
                      placeholder="Phone"
                    />
                  </div>
                  <div className="relative group">
                    <MapPinIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
                    <input
                      type="text"
                      value={editedData.location}
                      onChange={(e) => handleInputChange("location", e.target.value)}
                      className={`bg-transparent border-b-2 pl-12 pb-2 focus:outline-none transition-all w-full ${theme === "dark" ? "border-gray-800 text-white focus:border-blue-500" : "border-gray-200 text-gray-900 focus:border-blue-500"}`}
                      placeholder="Location"
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                <div>
                  <div className="flex flex-wrap items-center justify-center lg:justify-start gap-4 mb-2">
                    <h2
                      className={`text-5xl font-black tracking-tight ${theme === "dark" ? "text-white" : "text-gray-900"
                        }`}
                    >
                      {profileData.full_name || profileData.username}
                    </h2>
                    {profileData.isVerified && (
                      <div className="flex items-center gap-1.5 px-4 py-1.5 bg-blue-500/10 text-blue-500 rounded-full border border-blue-500/20 backdrop-blur-md">
                        <ShieldCheckIcon className="w-5 h-5" />
                        <span className="text-xs font-black uppercase tracking-wider">
                          Elite
                        </span>
                      </div>
                    )}
                  </div>
                  <div className={`text-xl font-medium ${theme === "dark" ? "text-blue-400/80" : "text-blue-600/80"}`}>
                    @{profileData.username}
                  </div>
                </div>

                <p className={`text-lg leading-relaxed max-w-2xl mx-auto lg:mx-0 font-medium ${theme === "dark" ? "text-gray-400" : "text-gray-600"}`}>
                  {profileData.bio}
                </p>

                <div className="flex flex-wrap items-center justify-center lg:justify-start gap-8">
                  <div className="group flex flex-col items-center lg:items-start">
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500 mb-1">Status</span>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                      <span className={`font-bold ${theme === "dark" ? "text-gray-300" : "text-gray-700"}`}>Active Now</span>
                    </div>
                  </div>
                  <div className="flex flex-col items-center lg:items-start">
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500 mb-1">Joined</span>
                    <div className="flex items-center gap-2">
                      <CalendarDaysIcon className="w-4 h-4 text-blue-500" />
                      <span className={`font-bold ${theme === "dark" ? "text-gray-300" : "text-gray-700"}`}>{profileData.joinDate}</span>
                    </div>
                  </div>
                  <div className="flex flex-col items-center lg:items-start">
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500 mb-1">Level</span>
                    <div className="flex items-center gap-2">
                      <TrophyIcon className="w-4 h-4 text-yellow-500" />
                      <span className={`font-bold ${theme === "dark" ? "text-gray-300" : "text-gray-700"}`}>{profileData.subscription} Tier</span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap justify-center lg:justify-start gap-4">
                  {profileData.phone && (
                    <div className="px-4 py-2 rounded-2xl bg-gray-100 dark:bg-gray-800 flex items-center gap-2 border border-transparent hover:border-blue-500/30 transition-all cursor-default">
                      <PhoneIcon className="w-4 h-4 text-blue-500" />
                      <span className="text-sm font-bold text-gray-500">{profileData.phone}</span>
                    </div>
                  )}
                  {profileData.location && (
                    <div className="px-4 py-2 rounded-2xl bg-gray-100 dark:bg-gray-800 flex items-center gap-2 border border-transparent hover:border-blue-500/30 transition-all cursor-default">
                      <MapPinIcon className="w-4 h-4 text-purple-500" />
                      <span className="text-sm font-bold text-gray-500">{profileData.location}</span>
                    </div>
                  )}
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
      className="space-y-8"
    >
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {Object.entries(profileData.stats).map(([key, value], index) => {
          const statConfig = {
            totalTrades: {
              icon: ChartBarIcon,
              color: "from-blue-500 to-blue-600",
              glow: "shadow-blue-500/20",
              label: "Volume",
            },
            winRate: {
              icon: TrophyIcon,
              color: "from-green-500 to-emerald-600",
              glow: "shadow-green-500/20",
              label: "Accuracy",
            },
            totalPnL: {
              icon: ArrowTrendingUpIcon,
              color: "from-purple-500 to-indigo-600",
              glow: "shadow-purple-500/20",
              label: "Performance",
            },
            avgReturn: {
              icon: ChartBarIcon,
              color: "from-orange-500 to-amber-600",
              glow: "shadow-orange-500/20",
              label: "Efficiency",
            },
            riskScore: {
              icon: ShieldCheckIcon,
              color: "from-yellow-400 to-orange-500",
              glow: "shadow-yellow-500/20",
              label: "Risk Index",
            },
            activeDays: {
              icon: CalendarDaysIcon,
              color: "from-indigo-500 to-blue-600",
              glow: "shadow-indigo-500/20",
              label: "Consistency",
            },
          };

          const config = statConfig[key] || { icon: ChartBarIcon, color: "from-gray-500 to-gray-600", label: key };
          const Icon = config.icon;

          return (
            <motion.div
              key={key}
              variants={itemVariants}
              whileHover={{ y: -10, scale: 1.02 }}
              className={`relative group p-8 rounded-[2.5rem] border overflow-hidden transition-all duration-300 ${theme === "dark"
                ? "bg-gray-900/50 border-gray-800 hover:border-gray-700"
                : "bg-white border-gray-100 hover:border-blue-100"
                } ${config.glow} shadow-[0_20px_40px_-15px_rgba(0,0,0,0.1)]`}
            >
              {/* Animated Background Mesh */}
              <div className={`absolute -right-8 -bottom-8 w-32 h-32 rounded-full blur-3xl opacity-0 group-hover:opacity-20 transition-opacity bg-gradient-to-br ${config.color}`} />

              <div className="relative flex items-center justify-between mb-8">
                <div className={`p-4 rounded-2xl bg-gradient-to-br ${config.color} text-white shadow-lg`}>
                  <Icon className="w-8 h-8" />
                </div>
                <div className="text-right">
                  <div className={`text-[10px] font-black uppercase tracking-[0.2em] mb-1 ${theme === "dark" ? "text-gray-500" : "text-gray-400"}`}>
                    Current Status
                  </div>
                  <div className="flex items-center justify-end gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
                    <span className="text-[10px] font-bold text-green-500">OPTIMAL</span>
                  </div>
                </div>
              </div>

              <div className="relative space-y-1">
                <div className={`text-4xl font-black tracking-tight ${theme === "dark" ? "text-white" : "text-gray-900"}`}>
                  {value}
                </div>
                <div className={`text-sm font-bold uppercase tracking-widest ${theme === "dark" ? "text-gray-500" : "text-gray-400"}`}>
                  {config.label}
                </div>
              </div>

              {/* Progress Bar (Visual Only) */}
              <div className="mt-8 h-1.5 w-full bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: "70%" }}
                  transition={{ duration: 1, delay: 0.5 + index * 0.1 }}
                  className={`h-full rounded-full bg-gradient-to-r ${config.color}`}
                />
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
      className="space-y-8"
    >
      <div className="flex items-center gap-4 mb-2">
        <div className="p-3 bg-purple-500/10 rounded-2xl">
          <BellIcon className="w-6 h-6 text-purple-500" />
        </div>
        <div>
          <h3 className={`text-2xl font-black ${theme === "dark" ? "text-white" : "text-gray-900"}`}>Communication Center</h3>
          <p className={`text-sm font-medium ${theme === "dark" ? "text-gray-500" : "text-gray-400"}`}>Manage how we reach out to you</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {Object.entries(notificationSettings).map(([key, enabled]) => {
          const notificationConfig = {
            trade_alerts: {
              label: "Trade Execution",
              desc: "Real-time updates on your market orders",
            },
            price_alerts: {
              label: "Volatility Triggers",
              desc: "Notifications for significant price movements",
            },
            news_updates: {
              label: "Global Sentinel",
              desc: "Breaking news affecting your portfolio",
            },
            market_analysis: {
              label: "Alpha Insights",
              desc: "Weekly reports and deep-dive analysis",
            },
            email_notifications: {
              label: "Protocol Logs",
              desc: "Important account activity via email",
            },
            push_notifications: {
              label: "Direct Uplink",
              desc: "Instant mobile push notifications",
            },
          };

          const config = notificationConfig[key] || {
            label: key.replace(/_/g, " "),
            desc: "Configure your alert settings",
          };

          return (
            <motion.div
              key={key}
              variants={itemVariants}
              whileHover={{ scale: 1.02 }}
              onClick={() => toggleNotification(key)}
              className={`p-6 rounded-3xl border cursor-pointer transition-all duration-300 ${enabled
                ? theme === "dark"
                  ? "bg-purple-500/10 border-purple-500/30 shadow-[0_0_20px_rgba(168,85,247,0.1)]"
                  : "bg-purple-50 border-purple-200"
                : theme === "dark"
                  ? "bg-gray-900/40 border-gray-800 hover:border-gray-700"
                  : "bg-white border-gray-100 hover:border-gray-200"
                }`}
            >
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <div className={`text-lg font-bold ${theme === "dark" ? "text-white" : "text-gray-900"}`}>
                    {config.label}
                  </div>
                  <div className={`text-xs font-medium ${theme === "dark" ? "text-gray-500" : "text-gray-400"}`}>
                    {config.desc}
                  </div>
                </div>
                <div
                  className={`relative w-12 h-6 rounded-full transition-colors duration-300 ${enabled ? "bg-purple-600" : "bg-gray-300 dark:bg-gray-700"
                    }`}
                >
                  <motion.div
                    animate={{ x: enabled ? 26 : 2 }}
                    className="absolute top-1 w-4 h-4 bg-white rounded-full shadow-sm"
                  />
                </div>
              </div>
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
      className="space-y-10"
    >
      {/* Security Hero */}
      <div className={`p-8 rounded-[3rem] border transition-all duration-500 overflow-hidden relative ${theme === "dark"
        ? "bg-gray-900 border-gray-800 shadow-2xl"
        : "bg-white border-gray-100 shadow-xl"
        }`}>
        <div className="absolute top-0 right-0 w-64 h-64 bg-red-500/5 rounded-full blur-[100px] pointer-events-none" />

        <div className="relative flex flex-col md:flex-row items-center gap-8">
          <div className="p-6 bg-red-500 text-white rounded-[2rem] shadow-[0_20px_40px_-15px_rgba(239,68,68,0.4)]">
            <ShieldCheckIcon className="w-16 h-16" />
          </div>
          <div className="text-center md:text-left">
            <h3 className={`text-4xl font-black tracking-tight ${theme === "dark" ? "text-white" : "text-gray-900"}`}>The Encryption Vault</h3>
            <p className={`text-lg font-medium mt-2 ${theme === "dark" ? "text-gray-400" : "text-gray-500"}`}>Securing your assets with industrial-grade protocols</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Passphrase Overhaul */}
        <div className={`p-8 rounded-[3rem] border ${theme === "dark" ? "bg-gray-900/50 border-gray-800" : "bg-white border-gray-100 shadow-lg"}`}>
          <div className="flex items-center gap-3 mb-8">
            <KeyIcon className="w-6 h-6 text-red-500" />
            <h4 className={`text-xl font-black ${theme === "dark" ? "text-white" : "text-gray-900"}`}>Passphrase Overhaul</h4>
          </div>

          <form onSubmit={handlePasswordChange} className="space-y-6">
            <div className="space-y-4">
              {[
                { id: "currentPassword", label: "Verification Lock", placeholder: "Current Passphrase", icon: KeyIcon },
                { id: "newPassword", label: "New Array", placeholder: "New Passphrase", icon: ShieldCheckIcon },
                { id: "confirmPassword", label: "Confirm Pattern", placeholder: "Confirm New Passphrase", icon: ShieldCheckIcon }
              ].map((field) => (
                <div key={field.id} className="group">
                  <label className={`block text-[10px] font-black uppercase tracking-widest mb-2 px-1 ${theme === "dark" ? "text-gray-500" : "text-gray-400"}`}>{field.label}</label>
                  <div className="relative">
                    <field.icon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 group-focus-within:text-red-500 transition-colors" />
                    <input
                      type="password"
                      value={passwordForm[field.id]}
                      onChange={(e) => setPasswordForm({ ...passwordForm, [field.id]: e.target.value })}
                      className={`w-full bg-transparent border-2 rounded-2xl pl-12 pr-4 py-4 focus:outline-none transition-all ${theme === "dark"
                        ? "border-gray-800 text-white focus:border-red-500 focus:bg-red-500/5"
                        : "border-gray-100 text-gray-900 focus:border-red-500 focus:bg-red-50/20"
                        }`}
                      placeholder={field.placeholder}
                    />
                  </div>
                </div>
              ))}
            </div>

            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              type="submit"
              disabled={securityLoading}
              className="w-full py-5 bg-gradient-to-r from-red-600 to-orange-600 text-white rounded-[1.5rem] font-bold shadow-xl shadow-red-500/20 hover:from-red-700 hover:to-orange-700 transition-all disabled:opacity-50"
            >
              {securityLoading ? "Synchronizing..." : "Initiate Update"}
            </motion.button>
          </form>
        </div>

        {/* Sentinel Settings */}
        <div className="space-y-8">
          <div className={`p-8 rounded-[3rem] border ${theme === "dark" ? "bg-gray-900/50 border-gray-800" : "bg-white border-gray-100 shadow-lg"}`}>
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-3">
                <DevicePhoneMobileIcon className="w-6 h-6 text-green-500" />
                <h4 className={`text-xl font-black ${theme === "dark" ? "text-white" : "text-gray-900"}`}>2FA Matrix</h4>
              </div>
              <div className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${securitySettings.twoFactorEnabled ? "bg-green-500/10 text-green-500 border border-green-500/20" : "bg-gray-500/10 text-gray-500 border border-gray-500/20"}`}>
                {securitySettings.twoFactorEnabled ? "Active" : "Disabled"}
              </div>
            </div>
            <p className={`text-sm font-medium mb-6 ${theme === "dark" ? "text-gray-400" : "text-gray-500"}`}>
              Multi-factor authentication adds a secondary layer of encryption to your terminal access.
            </p>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="w-full py-4 border-2 border-dashed border-gray-700 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] text-gray-500 hover:border-blue-500 hover:text-blue-500 transition-all"
            >
              Configure Matrix
            </motion.button>
          </div>

          <div className={`p-8 rounded-[3rem] border ${theme === "dark" ? "bg-gray-900/50 border-gray-800" : "bg-white border-gray-100 shadow-lg"}`}>
            <div className="flex items-center gap-3 mb-6">
              <ExclamationTriangleIcon className="w-6 h-6 text-orange-500" />
              <h4 className={`text-xl font-black ${theme === "dark" ? "text-white" : "text-gray-900"}`}>Login Sentinel</h4>
            </div>
            <div className="flex items-center justify-between">
              <p className={`text-sm font-medium ${theme === "dark" ? "text-gray-400" : "text-gray-500"}`}>
                Notify on anonymous access
              </p>
              <button
                onClick={() => { }} // Integration pending
                className={`relative w-12 h-6 rounded-full transition-colors duration-300 ${securitySettings.loginAlerts ? "bg-green-600" : "bg-gray-700"}`}
              >
                <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow-sm transition-transform duration-300 ${securitySettings.loginAlerts ? "translate-x-7" : "translate-x-1"}`} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );

  const renderSettings = () => (
    <motion.div
      variants={tabContentVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
      className="space-y-8"
    >
      <div className="flex items-center gap-4 mb-2">
        <div className="p-3 bg-gray-500/10 rounded-2xl">
          <CogIcon className="w-6 h-6 text-gray-500" />
        </div>
        <div>
          <h3 className={`text-2xl font-black ${theme === "dark" ? "text-white" : "text-gray-900"}`}>Terminal Configuration</h3>
          <p className={`text-sm font-medium ${theme === "dark" ? "text-gray-500" : "text-gray-400"}`}>Optimize your professional workspace</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className={`p-8 rounded-[3rem] border ${theme === "dark" ? "bg-gray-900/50 border-gray-800 shadow-2xl" : "bg-white border-gray-100 shadow-lg"}`}>
          <h4 className={`text-lg font-black mb-6 ${theme === "dark" ? "text-white" : "text-gray-900"}`}>Visual Protocol</h4>
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <div className={`font-bold ${theme === "dark" ? "text-gray-200" : "text-gray-800"}`}>Night Mode</div>
                <div className="text-xs text-gray-500">Enable high-contrast obsidian interface</div>
              </div>
              <button
                onClick={() => theme === 'dark' ? dispatch(setLightTheme()) : dispatch(setDarkTheme())}
                className={`relative w-14 h-7 rounded-full transition-all duration-500 ${theme === 'dark' ? "bg-blue-600 shadow-[0_0_15px_rgba(37,99,235,0.4)]" : "bg-gray-200"}`}
              >
                <div className={`absolute top-1 w-5 h-5 bg-white rounded-full shadow-md transition-transform duration-500 ${theme === 'dark' ? "translate-x-8" : "translate-x-1"}`} />
              </button>
            </div>

            <div className="space-y-3">
              <label className={`block text-[10px] font-black uppercase tracking-widest text-gray-500`}>Telemetry Refresh Rate</label>
              <div className="flex flex-wrap gap-2">
                {['1s', '3s', '5s', '10s'].map((rate) => (
                  <button
                    key={rate}
                    onClick={() => {
                      setRefreshRate(rate);
                      savePreferences({ refresh_rate: parseInt(rate) });
                    }}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${refreshRate === rate
                      ? "bg-blue-600 text-white shadow-lg shadow-blue-500/20"
                      : theme === "dark" ? "bg-gray-800 text-gray-400 hover:bg-gray-700" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                      }`}
                  >
                    {rate}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className={`p-8 rounded-[3rem] border ${theme === "dark" ? "bg-gray-900/50 border-gray-800 shadow-2xl" : "bg-white border-gray-100 shadow-lg"}`}>
          <h4 className={`text-lg font-black mb-6 ${theme === "dark" ? "text-white" : "text-gray-900"}`}>Feedback Arrays</h4>
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <div className={`font-bold ${theme === "dark" ? "text-gray-200" : "text-gray-800"}`}>Auditory Pulse</div>
                <div className="text-xs text-gray-500">Audio feedback for critical executions</div>
              </div>
              <button
                onClick={() => {
                  const newState = !soundEnabled;
                  setSoundEnabled(newState);
                  savePreferences({ sound_enabled: newState });
                }}
                className={`relative w-14 h-7 rounded-full transition-all duration-500 ${soundEnabled ? "bg-green-600 shadow-[0_0_15px_rgba(22,163,74,0.4)]" : "bg-gray-200 dark:bg-gray-700"}`}
              >
                <div className={`absolute top-1 w-5 h-5 bg-white rounded-full shadow-md transition-transform duration-500 ${soundEnabled ? "translate-x-8" : "translate-x-1"}`} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );

  const renderActivityTimeline = () => (
    <motion.div
      variants={tabContentVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
      className="space-y-8"
    >
      <div className="flex items-center justify-between gap-4 mb-2">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-orange-500/10 rounded-2xl">
            <ClockIcon className="w-6 h-6 text-orange-500" />
          </div>
          <div>
            <h3 className={`text-2xl font-black ${theme === "dark" ? "text-white" : "text-gray-900"}`}>Event Horizon</h3>
            <p className={`text-sm font-medium ${theme === "dark" ? "text-gray-500" : "text-gray-400"}`}>Trace your steps across the platform</p>
          </div>
        </div>
        <button onClick={fetchActivityLogs} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors">
          <ArrowTrendingUpIcon className={`w-5 h-5 ${activityLoading ? "animate-spin" : ""}`} />
        </button>
      </div>

      <div className="relative pl-8 space-y-12 before:absolute before:left-0 before:top-4 before:bottom-4 before:w-1 before:bg-gradient-to-b before:from-orange-500 before:via-purple-500 before:to-blue-500 before:rounded-full before:opacity-20">
        {activityLogs.length > 0 ? (
          activityLogs.map((log, index) => (
            <motion.div
              key={log.id || index}
              variants={itemVariants}
              className="relative group"
            >
              <div className="absolute -left-[35px] top-1.5 w-4 h-4 rounded-full border-4 border-white dark:border-gray-900 bg-orange-500 shadow-[0_0_10px_rgba(249,115,22,0.5)] group-hover:scale-125 transition-transform" />
              <div className={`p-6 rounded-[2rem] border transition-all duration-300 ${theme === "dark" ? "bg-gray-900/50 border-gray-800 group-hover:bg-gray-800/50" : "bg-white border-gray-100 shadow-md group-hover:shadow-xl"}`}>
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className={`text-lg font-black ${theme === "dark" ? "text-white" : "text-gray-900"}`}>
                      {log.action?.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase())}
                    </div>
                    <div className={`text-sm font-medium ${theme === "dark" ? "text-gray-400" : "text-gray-600"}`}>
                      {log.details || "System protocol executed successfully"}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className={`text-xs font-black opacity-50 mb-1 ${theme === "dark" ? "text-gray-500" : "text-gray-400"}`}>Timestamp</div>
                    <div className={`text-sm font-mono font-bold ${theme === "dark" ? "text-blue-400" : "text-blue-600"}`}>
                      {new Date(log.timestamp).toLocaleTimeString()}
                    </div>
                    <div className="text-[10px] text-gray-500 font-bold">
                      {new Date(log.timestamp).toLocaleDateString()}
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          ))
        ) : (
          <div className="text-center py-20">
            <ClockIcon className="w-16 h-16 text-gray-800 dark:text-gray-200 mx-auto opacity-20 mb-4" />
            <p className="text-gray-500 font-bold">No activity detected in the current cycle</p>
          </div>
        )}
      </div>
    </motion.div>
  );

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
        return renderSettings();
      case "history":
        return renderActivityTimeline();
      default:
        return renderProfileContent();
    }
  };


  return (
    <div
      className={`min-h-screen py-12 px-4 sm:px-6 lg:px-8 ${theme === "dark"
        ? "bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950"
        : "bg-gradient-to-br from-slate-50 via-blue-50/30 to-gray-50"
        }`}
    >
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
              <h1 className={`text-4xl md:text-5xl font-black ${theme === "dark" ? "text-white" : "text-gray-900"}`}>
                Profile Dashboard
              </h1>
              <p className={`text-lg ${theme === "dark" ? "text-gray-300" : "text-gray-600"}`}>
                Manage your trading account and preferences
              </p>
            </div>
          </div>
        </motion.div>

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

        <motion.div
          variants={itemVariants}
          className={`rounded-3xl shadow-2xl border overflow-hidden ${theme === "dark"
            ? "bg-gray-900/50 border-gray-700/50"
            : "bg-white/50 border-gray-200/50"
            } backdrop-blur-xl p-8`}
        >
          <AnimatePresence mode="wait">{renderTabContent()}</AnimatePresence>
        </motion.div>

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
