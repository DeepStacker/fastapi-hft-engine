import { useEffect, useState } from "react";
import { useSelector, useDispatch } from "react-redux";
import { motion, AnimatePresence } from "framer-motion";
import { removeToast } from "../../context/toastSlice";
import {
  CheckCircleIcon,
  ExclamationCircleIcon,
  InformationCircleIcon,
  XMarkIcon,
  ExclamationTriangleIcon,
  BellIcon,
  ChartBarIcon,
  BoltIcon,
} from "@heroicons/react/24/outline";

const Toast = () => {
  const toasts = useSelector((state) => state.toast.toasts);
  const theme = useSelector((state) => state.theme?.theme || "light");
  const dispatch = useDispatch();
  const [pausedToasts, setPausedToasts] = useState(new Set());

  // Auto-remove toasts after duration
  useEffect(() => {
    toasts.forEach((toast) => {
      if (!pausedToasts.has(toast.id)) {
        const timer = setTimeout(() => {
          dispatch(removeToast(toast.id));
        }, toast.duration || 2000);

        return () => clearTimeout(timer);
      }
    });
  }, [toasts, dispatch, pausedToasts]);

  const handleMouseEnter = (toastId) => {
    setPausedToasts((prev) => new Set(prev).add(toastId));
  };

  const handleMouseLeave = (toastId) => {
    setPausedToasts((prev) => {
      const newSet = new Set(prev);
      newSet.delete(toastId);
      return newSet;
    });
  };

  const getIcon = (type) => {
    const iconClass = "w-6 h-6 flex-shrink-0";

    switch (type) {
      case "success":
        return <CheckCircleIcon className={`${iconClass} text-green-500`} />;
      case "error":
        return (
          <ExclamationCircleIcon className={`${iconClass} text-red-500`} />
        );
      case "warning":
        return (
          <ExclamationTriangleIcon className={`${iconClass} text-yellow-500`} />
        );
      case "trading":
        return <ChartBarIcon className={`${iconClass} text-blue-500`} />;
      case "notification":
        return <BellIcon className={`${iconClass} text-purple-500`} />;
      case "performance":
        return <BoltIcon className={`${iconClass} text-orange-500`} />;
      default:
        return (
          <InformationCircleIcon className={`${iconClass} text-blue-500`} />
        );
    }
  };

  const getToastStyles = (type) => {
    const baseStyles = "backdrop-blur-sm border shadow-xl";

    if (theme === "dark") {
      switch (type) {
        case "success":
          return `${baseStyles} bg-green-900/80 border-green-700/50 text-green-100`;
        case "error":
          return `${baseStyles} bg-red-900/80 border-red-700/50 text-red-100`;
        case "warning":
          return `${baseStyles} bg-yellow-900/80 border-yellow-700/50 text-yellow-100`;
        case "trading":
          return `${baseStyles} bg-blue-900/80 border-blue-700/50 text-blue-100`;
        case "notification":
          return `${baseStyles} bg-purple-900/80 border-purple-700/50 text-purple-100`;
        case "performance":
          return `${baseStyles} bg-orange-900/80 border-orange-700/50 text-orange-100`;
        default:
          return `${baseStyles} bg-gray-800/90 border-gray-600/50 text-gray-100`;
      }
    } else {
      switch (type) {
        case "success":
          return `${baseStyles} bg-green-50/95 border-green-200 text-green-800`;
        case "error":
          return `${baseStyles} bg-red-50/95 border-red-200 text-red-800`;
        case "warning":
          return `${baseStyles} bg-yellow-50/95 border-yellow-200 text-yellow-800`;
        case "trading":
          return `${baseStyles} bg-blue-50/95 border-blue-200 text-blue-800`;
        case "notification":
          return `${baseStyles} bg-purple-50/95 border-purple-200 text-purple-800`;
        case "performance":
          return `${baseStyles} bg-orange-50/95 border-orange-200 text-orange-800`;
        default:
          return `${baseStyles} bg-white/95 border-gray-200 text-gray-800`;
      }
    }
  };

  const getProgressBarColor = (type) => {
    switch (type) {
      case "success":
        return "bg-green-500";
      case "error":
        return "bg-red-500";
      case "warning":
        return "bg-yellow-500";
      case "trading":
        return "bg-blue-500";
      case "notification":
        return "bg-purple-500";
      case "performance":
        return "bg-orange-500";
      default:
        return "bg-gray-500";
    }
  };

  // Animation variants
  const containerVariants = {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
  };

  const toastVariants = {
    initial: {
      opacity: 0,
      x: 300,
      scale: 0.8,
      rotateY: 90,
    },
    animate: {
      opacity: 1,
      x: 0,
      scale: 1,
      rotateY: 0,
      transition: {
        type: "spring",
        stiffness: 300,
        damping: 30,
        duration: 0.6,
      },
    },
    exit: {
      opacity: 0,
      x: 300,
      scale: 0.8,
      rotateY: -90,
      transition: {
        duration: 0.4,
        ease: "easeInOut",
      },
    },
    hover: {
      scale: 1.02,
      y: -2,
      transition: {
        duration: 0.2,
      },
    },
  };

  const progressVariants = {
    initial: { scaleX: 1 },
    animate: {
      scaleX: 0,
      transition: {
        duration: 5,
        ease: "linear",
      },
    },
  };

  return (
    <AnimatePresence mode="multiple">
      <motion.div
        variants={containerVariants}
        initial="initial"
        animate="animate"
        exit="exit"
        className="fixed top-6 right-6 z-50 space-y-3 max-w-sm w-full"
      >
        {toasts.map((toast, index) => (
          <motion.div
            key={toast.id}
            variants={toastVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            whileHover="hover"
            layout
            onMouseEnter={() => handleMouseEnter(toast.id)}
            onMouseLeave={() => handleMouseLeave(toast.id)}
            className={`relative flex items-start p-4 rounded-xl ${getToastStyles(
              toast.type
            )} cursor-pointer group overflow-hidden`}
            role="alert"
            aria-live="polite"
            style={{ zIndex: 50 - index }}
          >
            {/* Background gradient overlay */}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

            {/* Progress bar */}
            {!pausedToasts.has(toast.id) && (
              <motion.div
                variants={progressVariants}
                initial="initial"
                animate="animate"
                className={`absolute bottom-0 left-0 h-1 ${getProgressBarColor(
                  toast.type
                )} origin-left`}
                style={{ width: "100%" }}
              />
            )}

            {/* Icon */}
            <motion.div
              initial={{ scale: 0, rotate: -180 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
              className="flex-shrink-0 mt-0.5"
            >
              {getIcon(toast.type)}
            </motion.div>

            {/* Content */}
            <div className="ml-4 flex-1 min-w-0">
              {toast.title && (
                <motion.p
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className="text-sm font-semibold mb-1"
                >
                  {toast.title}
                </motion.p>
              )}
              <motion.p
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="text-sm leading-relaxed"
              >
                {toast.message}
              </motion.p>

              {/* Action button for trading-specific toasts */}
              {toast.action && (
                <motion.button
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.5 }}
                  onClick={toast.action.onClick}
                  className={`mt-2 text-xs font-medium px-3 py-1 rounded-full transition-colors ${
                    theme === "dark"
                      ? "bg-white/20 hover:bg-white/30 text-white"
                      : "bg-black/10 hover:bg-black/20 text-gray-700"
                  }`}
                >
                  {toast.action.label}
                </motion.button>
              )}
            </div>

            {/* Close button */}
            <motion.button
              initial={{ opacity: 0, scale: 0 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.6 }}
              whileHover={{ scale: 1.1, rotate: 90 }}
              whileTap={{ scale: 0.9 }}
              onClick={() => dispatch(removeToast(toast.id))}
              className={`ml-2 p-1 rounded-full transition-colors ${
                theme === "dark"
                  ? "text-gray-400 hover:text-white hover:bg-white/20"
                  : "text-gray-400 hover:text-gray-600 hover:bg-black/10"
              }`}
              aria-label="Close notification"
            >
              <XMarkIcon className="w-4 h-4" />
            </motion.button>

            {/* Pulse effect for important notifications */}
            {(toast.type === "error" || toast.type === "trading") && (
              <motion.div
                animate={{
                  scale: [1, 1.05, 1],
                  opacity: [0.5, 0.8, 0.5],
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
                className="absolute inset-0 rounded-xl border-2 border-current opacity-20 pointer-events-none"
              />
            )}
          </motion.div>
        ))}
      </motion.div>
    </AnimatePresence>
  );
};

export default Toast;
