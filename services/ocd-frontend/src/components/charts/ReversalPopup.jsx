import { useState, useCallback, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  XMarkIcon,
  DocumentDuplicateIcon,
  ChartBarIcon,
  CalendarIcon,
  BanknotesIcon,
  CheckIcon,
  ArrowUpIcon,
  ArrowDownIcon,
  InformationCircleIcon,
} from "@heroicons/react/24/outline";
import PropTypes from "prop-types";
import { useSelector } from "react-redux";
// import { useSelector } from "react-redux";

const ReversalPopup = ({ onClose }) => {
  const strike = useSelector((state) => state.optionChain.strike);
  const theme = useSelector((state) => state.theme.theme);
  const data = useSelector((state) => state.data.data);
  const spotPrice = useSelector((state) => state.data.data?.spot?.data?.Ltp);

  const [activeSection, setActiveSection] = useState("current");
  const [copiedValue, setCopiedValue] = useState(null);
  const [showTooltip, setShowTooltip] = useState(false);

  const reversal = useMemo(() => data?.options?.data?.oc || {}, [data?.options?.data?.oc]);

  // Calculate strike differences and related strikes[1][2]
  const { strikeDiff: _strikeDiff, upperStrike, lowerStrike } = useMemo(() => {
    const strikeDiffArray = Object.keys(reversal)
      .map(Number)
      .sort((a, b) => a - b);
    if (strikeDiffArray.length < 2) {
      return { strikeDiff: 0, upperStrike: 0, lowerStrike: 0 };
    }

    const diff = strikeDiffArray[1] - strikeDiffArray[0];
    return {
      strikeDiff: diff,
      upperStrike: Number(strike) + diff,
      lowerStrike: Number(strike) - diff,
    };
  }, [reversal, strike]);

  // Enhanced sections with more trading data
  const sections = useMemo(
    () => ({
      current: {
        title: "Spot Levels",
        icon: ChartBarIcon,
        description: "Current market reversal levels",
        data: [
          {
            label: "Resistance",
            value: reversal?.[upperStrike]?.reversal || 0,
            type: "resistance",
            strike: upperStrike,
            distance: spotPrice
              ? Math.abs(spotPrice - (reversal?.[upperStrike]?.reversal || 0))
              : 0,
          },
          {
            label: "Support",
            value: reversal?.[strike]?.reversal || 0,
            type: "support",
            strike: strike,
            distance: spotPrice
              ? Math.abs(spotPrice - (reversal?.[strike]?.reversal || 0))
              : 0,
          },
        ],
      },
      weekly: {
        title: "Weekly Levels",
        icon: CalendarIcon,
        description: "Weekly expiry reversal levels",
        data: [
          {
            label: "Weekly Resistance",
            value: reversal?.[upperStrike]?.wkly_reversal || 0,
            type: "resistance",
            strike: strike,
            distance: spotPrice
              ? Math.abs(
                spotPrice - (reversal?.[upperStrike]?.wkly_reversal || 0)
              )
              : 0,
          },
          {
            label: "Weekly Support",
            value: reversal?.[strike]?.wkly_reversal || 0,
            type: "support",
            strike: lowerStrike,
            distance: spotPrice
              ? Math.abs(spotPrice - (reversal?.[strike]?.wkly_reversal || 0))
              : 0,
          },
        ],
      },
      future: {
        title: "Future Levels",
        icon: BanknotesIcon,
        description: "Futures-based reversal levels",
        data: [
          {
            label: "Future Resistance",
            value: reversal?.[upperStrike]?.fut_reversal || 0,
            type: "resistance",
            strike: upperStrike,
            distance: spotPrice
              ? Math.abs(
                spotPrice - (reversal?.[upperStrike]?.fut_reversal || 0)
              )
              : 0,
          },
          {
            label: "Future Support",
            value: reversal?.[strike]?.fut_reversal || 0,
            type: "support",
            strike: strike,
            distance: spotPrice
              ? Math.abs(spotPrice - (reversal?.[strike]?.fut_reversal || 0))
              : 0,
          },
        ],
      },
    }),
    [reversal, strike, upperStrike, lowerStrike, spotPrice]
  );

  // Enhanced copy functionality with feedback
  const handleCopy = useCallback(async (text, label) => {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text.toString());
      } else {
        // Fallback for older browsers
        const textArea = document.createElement("textarea");
        textArea.value = text;
        textArea.style.position = "fixed";
        textArea.style.left = "-999999px";
        textArea.style.top = "-999999px";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        document.execCommand("copy");
        textArea.remove();
      }

      setCopiedValue(`${label}: ${text}`);
      setTimeout(() => setCopiedValue(null), 2000);
    } catch (err) {
      console.error("Failed to copy text: ", err);
      alert("Failed to copy to clipboard");
    }
  }, []);

  // Copy all levels for current section
  const handleCopyAll = useCallback(() => {
    const currentData = sections[activeSection];
    const allLevels = currentData.data
      .map((item) => `${item.label}: ${item.value}`)
      .join("\n");

    const copyText = `${currentData.title} - Strike ${strike}\n${allLevels}`;
    handleCopy(copyText, "All Levels");
  }, [sections, activeSection, strike, handleCopy]);

  // Animation variants
  const overlayVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1 },
  };

  const modalVariants = {
    hidden: {
      opacity: 0,
      scale: 0.8,
      y: 50,
    },
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

  const itemVariants = {
    hidden: { opacity: 0, x: -20 },
    visible: { opacity: 1, x: 0 },
    hover: { scale: 1.02, x: 4 },
  };

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === "Escape") onClose();
    };

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [onClose]);

  if (Object.keys(reversal).length === 0) {
    return (
      <motion.div
        variants={overlayVariants}
        initial="hidden"
        animate="visible"
        exit="hidden"
        className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
        onClick={onClose}
      >
        <motion.div
          variants={modalVariants}
          className={`relative p-8 rounded-xl shadow-2xl ${theme === "dark"
              ? "bg-gray-900 text-white"
              : "bg-white text-gray-900"
            }`}
        >
          <div className="text-center">
            <InformationCircleIcon className="w-16 h-16 mx-auto mb-4 text-gray-400" />
            <h3 className="text-xl font-semibold mb-2">No Data Available</h3>
            <p className="text-gray-500">
              Reversal data is not available for this symbol.
            </p>
            <button
              onClick={onClose}
              className="mt-4 px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
            >
              Close
            </button>
          </div>
        </motion.div>
      </motion.div>
    );
  }

  return (
    <motion.div
      variants={overlayVariants}
      initial="hidden"
      animate="visible"
      exit="hidden"
      id="popup-overlay"
      onClick={(e) => e.target.id === "popup-overlay" && onClose()}
      className="fixed inset-0 bg-black bg-opacity-60 backdrop-blur-sm flex items-center justify-center z-50"
      role="dialog"
      aria-modal="true"
    >
      <motion.div
        variants={modalVariants}
        className={`relative w-full max-w-md mx-4 p-6 rounded-2xl shadow-2xl border ${theme === "dark"
            ? "bg-gray-900 text-white border-gray-700"
            : "bg-white text-gray-900 border-gray-200"
          }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            <div
              className={`p-2 rounded-lg ${theme === "dark" ? "bg-blue-600" : "bg-blue-500"
                }`}
            >
              <ChartBarIcon className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-blue-500">
                Strike {strike}
              </h2>
              <p
                className={`text-sm ${theme === "dark" ? "text-gray-400" : "text-gray-600"
                  }`}
              >
                Reversal Analysis
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={handleCopyAll}
              onMouseEnter={() => setShowTooltip(true)}
              onMouseLeave={() => setShowTooltip(false)}
              className={`p-2 rounded-lg transition-colors relative ${theme === "dark"
                  ? "hover:bg-gray-700 text-gray-400"
                  : "hover:bg-gray-100 text-gray-600"
                }`}
              title="Copy all levels"
            >
              <DocumentDuplicateIcon className="w-5 h-5" />
              {showTooltip && (
                <div className="absolute -top-10 left-1/2 transform -translate-x-1/2 px-2 py-1 bg-gray-800 text-white text-xs rounded whitespace-nowrap">
                  Copy All
                </div>
              )}
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={onClose}
              className={`p-2 rounded-lg transition-colors ${theme === "dark"
                  ? "hover:bg-red-600 text-gray-400 hover:text-white"
                  : "hover:bg-red-500 text-gray-600 hover:text-white"
                }`}
              aria-label="Close Popup"
            >
              <XMarkIcon className="w-5 h-5" />
            </motion.button>
          </div>
        </div>

        {/* Current Spot Price */}
        {spotPrice && (
          <div
            className={`mb-4 p-3 rounded-lg ${theme === "dark" ? "bg-gray-800" : "bg-gray-100"
              }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Current Spot:</span>
              <span className="text-lg font-bold text-blue-500">
                ₹{spotPrice.toFixed(2)}
              </span>
            </div>
          </div>
        )}

        {/* Section Tabs */}
        <div
          className={`flex rounded-lg p-1 mb-6 ${theme === "dark" ? "bg-gray-800" : "bg-gray-100"
            }`}
        >
          {Object.entries(sections).map(([key, section]) => {
            const Icon = section.icon;
            return (
              <motion.button
                key={key}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setActiveSection(key)}
                className={`flex-1 flex items-center justify-center space-x-2 py-3 px-4 rounded-md transition-all duration-200 ${activeSection === key
                    ? theme === "dark"
                      ? "bg-blue-600 text-white shadow-lg"
                      : "bg-blue-500 text-white shadow-lg"
                    : theme === "dark"
                      ? "text-gray-400 hover:text-white hover:bg-gray-700"
                      : "text-gray-600 hover:text-gray-900 hover:bg-gray-200"
                  }`}
              >
                <Icon className="w-4 h-4" />
                <span className="text-sm font-medium">{section.title}</span>
              </motion.button>
            );
          })}
        </div>

        {/* Section Description */}
        <div
          className={`mb-4 text-center text-sm ${theme === "dark" ? "text-gray-400" : "text-gray-600"
            }`}
        >
          {sections[activeSection].description}
        </div>

        {/* Levels Display */}
        <motion.div
          key={activeSection}
          initial="hidden"
          animate="visible"
          variants={{
            visible: {
              transition: {
                staggerChildren: 0.1,
              },
            },
          }}
          className="space-y-3"
        >
          {sections[activeSection].data.map((item, index) => {
            const isResistance = item.type === "resistance";
            const distanceFromSpot = item.distance;

            return (
              <motion.div
                key={index}
                variants={itemVariants}
                whileHover="hover"
                className={`flex items-center justify-between p-4 rounded-xl border-2 transition-all duration-200 ${isResistance
                    ? theme === "dark"
                      ? "border-red-500/30 bg-red-500/10 hover:bg-red-500/20"
                      : "border-red-200 bg-red-50 hover:bg-red-100"
                    : theme === "dark"
                      ? "border-green-500/30 bg-green-500/10 hover:bg-green-500/20"
                      : "border-green-200 bg-green-50 hover:bg-green-100"
                  }`}
              >
                <div className="flex items-center space-x-3">
                  <div
                    className={`p-2 rounded-lg ${isResistance ? "bg-red-500" : "bg-green-500"
                      }`}
                  >
                    {isResistance ? (
                      <ArrowUpIcon className="w-4 h-4 text-white" />
                    ) : (
                      <ArrowDownIcon className="w-4 h-4 text-white" />
                    )}
                  </div>

                  <div>
                    <div className="flex items-center space-x-2">
                      <span
                        className={`text-sm font-medium ${isResistance ? "text-red-600" : "text-green-600"
                          }`}
                      >
                        {item.label}
                      </span>
                      {/* <span
                        className={`text-xs px-2 py-1 rounded-full ${
                          theme === "dark"
                            ? "bg-gray-700 text-gray-300"
                            : "bg-gray-200 text-gray-600"
                        }`}
                      >
                        @{item.strike}
                      </span> */}
                    </div>
                    <div className="text-xl font-bold">
                      ₹{item.value.toFixed(2)}
                    </div>
                    {spotPrice && (
                      <div
                        className={`text-xs ${theme === "dark" ? "text-gray-400" : "text-gray-600"
                          }`}
                      >
                        {distanceFromSpot.toFixed(2)} points away
                      </div>
                    )}
                  </div>
                </div>

                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => handleCopy(item.value.toFixed(2), item.label)}
                  className={`p-2 rounded-lg transition-colors ${copiedValue?.includes(item.label)
                      ? "bg-green-500 text-white"
                      : theme === "dark"
                        ? "hover:bg-gray-700 text-gray-400"
                        : "hover:bg-gray-200 text-gray-600"
                    }`}
                  aria-label={`Copy ${item.label}`}
                >
                  {copiedValue?.includes(item.label) ? (
                    <CheckIcon className="w-4 h-4" />
                  ) : (
                    <DocumentDuplicateIcon className="w-4 h-4" />
                  )}
                </motion.button>
              </motion.div>
            );
          })}
        </motion.div>

        {/* Copy Feedback */}
        <AnimatePresence>
          {copiedValue && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className={`mt-4 p-3 rounded-lg text-center ${theme === "dark" ? "bg-green-600" : "bg-green-500"
                } text-white`}
            >
              <div className="flex items-center justify-center space-x-2">
                <CheckIcon className="w-4 h-4" />
                <span className="text-sm font-medium">
                  Copied: {copiedValue}
                </span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Footer */}
        <div
          className={`mt-6 pt-4 border-t text-center text-xs ${theme === "dark"
              ? "border-gray-700 text-gray-400"
              : "border-gray-200 text-gray-500"
            }`}
        >
          <p>Press ESC to close • Click outside to dismiss</p>
        </div>
      </motion.div>
    </motion.div>
  );
};

ReversalPopup.propTypes = {
  onClose: PropTypes.func.isRequired,
};

export default ReversalPopup;
