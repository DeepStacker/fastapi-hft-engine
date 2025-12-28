import { useState, useEffect, useCallback } from "react";
import { useDispatch, useSelector } from "react-redux";
import { motion, AnimatePresence } from "framer-motion";
import { setURLs } from "../../context/configSlice";
import {
  GlobeAltIcon,
  ComputerDesktopIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  ArrowPathIcon,
  SignalIcon,
  WifiIcon,
  ServerIcon,
} from "@heroicons/react/24/outline";

const productionURLs = {
  baseURL: "https://option-chain-d.onrender.com/api",
  socketURL: "https://option-chain-d-new-app.onrender.com",
};

const localURLs = {
  baseURL: import.meta.env.VITE_API_BASE_URL || "http://localhost:8000/api/v1",
  socketURL: import.meta.env.VITE_SOCKET_URL || "ws://localhost:8000",
};

const URLToggle = () => {
  const dispatch = useDispatch();
  const theme = useSelector((state) => state.theme?.theme || "light");
  const { baseURL, socketURL } = useSelector((state) => state.config);
  const [showConfirm, setShowConfirm] = useState(false);
  const [nextEnv, setNextEnv] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState({
    api: "checking",
    socket: "checking",
  });
  const [isToggling, setIsToggling] = useState(false);

  // Determine current environment
  const isDev = baseURL === localURLs.baseURL;
  const currentEnvLabel = isDev ? "Development" : "Production";
  const nextURLs = isDev ? productionURLs : localURLs;
  const nextEnvLabel = isDev ? "Production" : "Development";

  // Check connection status
  const checkConnectionStatus = useCallback(async () => {
    setConnectionStatus({ api: "checking", socket: "checking" });

    // Check API connection
    try {
      const response = await fetch(`${baseURL}/health`, {
        method: "GET",
        timeout: 5000,
      });
      setConnectionStatus((prev) => ({
        ...prev,
        api: response.ok ? "connected" : "error",
      }));
    } catch {
      setConnectionStatus((prev) => ({ ...prev, api: "error" }));
    }

    // Check socket connection (using HTTP health check on same port)
    try {
      // Replace ws/wss with http/https for health check
      const httpUrl = socketURL.replace(/^ws/, "http");
      const response = await fetch(`${httpUrl}/`, {
        method: "GET",
        timeout: 5000,
      });
      setConnectionStatus((prev) => ({
        ...prev,
        socket: response.ok ? "connected" : "error",
      }));
    } catch {
      setConnectionStatus((prev) => ({ ...prev, socket: "error" }));
    }
  }, [baseURL, socketURL]);

  useEffect(() => {
    checkConnectionStatus();
  }, [checkConnectionStatus]);

  const handleToggleClick = () => {
    setNextEnv(nextEnvLabel);
    setShowConfirm(true);
  };

  const confirmToggle = async () => {
    setIsToggling(true);

    // Add a small delay for better UX
    await new Promise((resolve) => setTimeout(resolve, 500));

    dispatch(setURLs(nextURLs));
    setShowConfirm(false);
    setNextEnv(null);
    setIsToggling(false);
  };

  const cancelToggle = () => {
    setShowConfirm(false);
    setNextEnv(null);
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case "connected":
        return <CheckCircleIcon className="w-4 h-4 text-green-500" />;
      case "error":
        return <ExclamationTriangleIcon className="w-4 h-4 text-red-500" />;
      case "checking":
        return (
          <ArrowPathIcon className="w-4 h-4 text-yellow-500 animate-spin" />
        );
      default:
        return <SignalIcon className="w-4 h-4 text-gray-400" />;
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case "connected":
        return "Connected";
      case "error":
        return "Disconnected";
      case "checking":
        return "Checking...";
      default:
        return "Unknown";
    }
  };

  // Animation variants
  const containerVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.5,
        staggerChildren: 0.1,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, x: -20 },
    visible: { opacity: 1, x: 0 },
  };

  const overlayVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1 },
  };

  const modalVariants = {
    hidden: { opacity: 0, scale: 0.8, y: 50 },
    visible: {
      opacity: 1,
      scale: 1,
      y: 0,
      transition: {
        type: "spring",
        stiffness: 300,
        damping: 30,
      },
    },
    exit: {
      opacity: 0,
      scale: 0.8,
      y: 50,
      transition: { duration: 0.2 },
    },
  };

  return (
    <>
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className={`max-w-2xl mx-auto p-6 rounded-2xl shadow-xl border ${theme === "dark"
          ? "bg-gray-800 border-gray-700"
          : "bg-white border-gray-200"
          }`}
      >
        {/* Header */}
        <motion.div variants={itemVariants} className="flex items-center mb-6">
          <div
            className={`p-3 rounded-xl mr-4 ${isDev
              ? "bg-orange-500/20 text-orange-500"
              : "bg-green-500/20 text-green-500"
              }`}
          >
            {isDev ? (
              <ComputerDesktopIcon className="w-6 h-6" />
            ) : (
              <GlobeAltIcon className="w-6 h-6" />
            )}
          </div>
          <div>
            <h2
              className={`text-2xl font-bold ${theme === "dark" ? "text-white" : "text-gray-900"
                }`}
            >
              Environment Configuration
            </h2>
            <p
              className={`text-sm ${theme === "dark" ? "text-gray-400" : "text-gray-600"
                }`}
            >
              Manage your trading platform environment settings[1][3]
            </p>
          </div>
        </motion.div>

        {/* Current Environment Status */}
        <motion.div variants={itemVariants} className="space-y-4 mb-6">
          <div
            className={`p-4 rounded-xl border ${isDev
              ? theme === "dark"
                ? "bg-orange-900/20 border-orange-500/30"
                : "bg-orange-50 border-orange-200"
              : theme === "dark"
                ? "bg-green-900/20 border-green-500/30"
                : "bg-green-50 border-green-200"
              }`}
          >
            <div className="flex items-center justify-between mb-3">
              <span
                className={`text-sm font-medium ${theme === "dark" ? "text-gray-300" : "text-gray-700"
                  }`}
              >
                Current Environment
              </span>
              <span
                className={`px-3 py-1 rounded-full text-xs font-semibold ${isDev ? "bg-orange-500 text-white" : "bg-green-500 text-white"
                  }`}
              >
                {currentEnvLabel}
              </span>
            </div>

            {/* API Status */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <ServerIcon className="w-4 h-4 text-gray-500" />
                  <span
                    className={`text-sm ${theme === "dark" ? "text-gray-400" : "text-gray-600"
                      }`}
                  >
                    API Server
                  </span>
                </div>
                <div className="flex items-center space-x-2">
                  {getStatusIcon(connectionStatus.api)}
                  <span
                    className={`text-xs font-medium ${connectionStatus.api === "connected"
                      ? "text-green-600"
                      : connectionStatus.api === "error"
                        ? "text-red-600"
                        : "text-yellow-600"
                      }`}
                  >
                    {getStatusText(connectionStatus.api)}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <WifiIcon className="w-4 h-4 text-gray-500" />
                  <span
                    className={`text-sm ${theme === "dark" ? "text-gray-400" : "text-gray-600"
                      }`}
                  >
                    WebSocket
                  </span>
                </div>
                <div className="flex items-center space-x-2">
                  {getStatusIcon(connectionStatus.socket)}
                  <span
                    className={`text-xs font-medium ${connectionStatus.socket === "connected"
                      ? "text-green-600"
                      : connectionStatus.socket === "error"
                        ? "text-red-600"
                        : "text-yellow-600"
                      }`}
                  >
                    {getStatusText(connectionStatus.socket)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* URL Details */}
          <div
            className={`p-4 rounded-xl ${theme === "dark" ? "bg-gray-700/50" : "bg-gray-50"
              }`}
          >
            <div className="space-y-3">
              <div>
                <label
                  className={`text-xs font-medium ${theme === "dark" ? "text-gray-400" : "text-gray-600"
                    }`}
                >
                  API Base URL
                </label>
                <div
                  className={`mt-1 p-2 rounded-lg font-mono text-sm ${theme === "dark"
                    ? "bg-gray-800 text-gray-300"
                    : "bg-white text-gray-700"
                    } border ${theme === "dark" ? "border-gray-600" : "border-gray-200"
                    }`}
                >
                  {baseURL}
                </div>
              </div>

              <div>
                <label
                  className={`text-xs font-medium ${theme === "dark" ? "text-gray-400" : "text-gray-600"
                    }`}
                >
                  WebSocket URL
                </label>
                <div
                  className={`mt-1 p-2 rounded-lg font-mono text-sm ${theme === "dark"
                    ? "bg-gray-800 text-gray-300"
                    : "bg-white text-gray-700"
                    } border ${theme === "dark" ? "border-gray-600" : "border-gray-200"
                    }`}
                >
                  {socketURL}
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Toggle Button */}
        <motion.div
          variants={itemVariants}
          className="flex justify-between items-center"
        >
          <button
            onClick={checkConnectionStatus}
            className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors ${theme === "dark"
              ? "bg-gray-700 hover:bg-gray-600 text-gray-300"
              : "bg-gray-100 hover:bg-gray-200 text-gray-700"
              }`}
          >
            <ArrowPathIcon className="w-4 h-4" />
            <span className="text-sm">Refresh Status</span>
          </button>

          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleToggleClick}
            disabled={isToggling}
            className={`px-6 py-3 rounded-xl font-semibold text-white transition-all duration-200 ${isDev
              ? "bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700"
              : "bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700"
              } ${isToggling
                ? "opacity-50 cursor-not-allowed"
                : "shadow-lg hover:shadow-xl"
              }`}
          >
            {isToggling ? (
              <div className="flex items-center space-x-2">
                <ArrowPathIcon className="w-4 h-4 animate-spin" />
                <span>Switching...</span>
              </div>
            ) : (
              `Switch to ${nextEnvLabel}`
            )}
          </motion.button>
        </motion.div>

        {/* Environment Info */}
        <motion.div
          variants={itemVariants}
          className={`mt-6 p-4 rounded-xl ${theme === "dark"
            ? "bg-blue-900/20 border border-blue-500/30"
            : "bg-blue-50 border border-blue-200"
            }`}
        >
          <div className="flex items-start space-x-3">
            <ExclamationTriangleIcon className="w-5 h-5 text-blue-500 mt-0.5 flex-shrink-0" />
            <div>
              <p
                className={`text-sm font-medium ${theme === "dark" ? "text-blue-300" : "text-blue-800"
                  }`}
              >
                Environment Switch Notice
              </p>
              <p
                className={`text-xs mt-1 ${theme === "dark" ? "text-blue-400" : "text-blue-700"
                  }`}
              >
                Switching environments will change your API endpoints and may
                affect real-time data connections. Make sure the target
                environment is accessible before switching[2].
              </p>
            </div>
          </div>
        </motion.div>
      </motion.div>

      {/* Confirmation Modal */}
      <AnimatePresence>
        {showConfirm && (
          <motion.div
            variants={overlayVariants}
            initial="hidden"
            animate="visible"
            exit="hidden"
            className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={cancelToggle}
          >
            <motion.div
              variants={modalVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              onClick={(e) => e.stopPropagation()}
              className={`w-full max-w-md p-6 rounded-2xl shadow-2xl ${theme === "dark"
                ? "bg-gray-800 border border-gray-700"
                : "bg-white border border-gray-200"
                }`}
            >
              <div className="text-center">
                <div
                  className={`mx-auto w-16 h-16 rounded-full flex items-center justify-center mb-4 ${theme === "dark" ? "bg-yellow-900/20" : "bg-yellow-100"
                    }`}
                >
                  <ExclamationTriangleIcon className="w-8 h-8 text-yellow-500" />
                </div>

                <h3
                  className={`text-xl font-bold mb-2 ${theme === "dark" ? "text-white" : "text-gray-900"
                    }`}
                >
                  Confirm Environment Switch
                </h3>

                <p
                  className={`mb-6 ${theme === "dark" ? "text-gray-400" : "text-gray-600"
                    }`}
                >
                  Are you sure you want to switch to <strong>{nextEnv}</strong>{" "}
                  environment? This will change your API endpoints and may
                  interrupt active connections.
                </p>

                <div className="flex space-x-3">
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={cancelToggle}
                    className={`flex-1 px-4 py-3 rounded-xl font-medium transition-colors ${theme === "dark"
                      ? "bg-gray-700 hover:bg-gray-600 text-gray-300"
                      : "bg-gray-100 hover:bg-gray-200 text-gray-700"
                      }`}
                  >
                    Cancel
                  </motion.button>

                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={confirmToggle}
                    className="flex-1 px-4 py-3 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white rounded-xl font-medium transition-all shadow-lg hover:shadow-xl"
                  >
                    Confirm Switch
                  </motion.button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default URLToggle;
