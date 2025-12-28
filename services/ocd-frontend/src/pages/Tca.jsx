import { useState, useEffect, useMemo, useCallback } from "react";
import { useSelector, useDispatch } from "react-redux";
import { setResults } from "../context/tcaSlice";
import { Helmet } from 'react-helmet-async';
import CryptoJS from "crypto-js";
import { toast } from "react-toastify";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChartBarIcon,
  CalculatorIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  ArrowTrendingUpIcon,
  CurrencyRupeeIcon,
  ClockIcon,
  ShieldCheckIcon,
} from "@heroicons/react/24/outline";

import InputForm from "../components/tca/InputForm";
import ResultSection from "../components/tca/ResultSection";
import PNL from "../components/tca/PNL";
import ChartSection from "../components/tca/ChartSection";
import GeneratedTrades from "../components/tca/GeneratedTrades";
import TradeAnalysis from "../components/tca/TradeAnalysis";



// Enhanced API service with better error handling
class TCAAPIService {
  constructor() {
    this.baseURL =
      import.meta.env.VITE_TCA_API_URL ||
      "https://tca-server-3kvr.onrender.com";
    this.timeout = 30000; // 30 seconds for complex calculations
    this.retryAttempts = 3;
    this.retryDelay = 2000;
  }

  async makeRequest(endpoint, data, attempt = 1) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(`${this.baseURL}${endpoint}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          "X-Request-ID": `tca_${Date.now()}_${Math.random()
            .toString(36)
            .substr(2, 9)}`,
        },
        body: JSON.stringify(data),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();

      if (!result || typeof result !== "object") {
        throw new Error("Invalid response format from server");
      }

      return result;
    } catch (error) {
      clearTimeout(timeoutId);

      if (error.name === "AbortError") {
        throw new Error(
          "Request timeout. The calculation is taking longer than expected."
        );
      }

      if (attempt < this.retryAttempts && error.message.includes("fetch")) {
        console.warn(`Request attempt ${attempt} failed, retrying...`);
        await new Promise((resolve) =>
          setTimeout(resolve, this.retryDelay * attempt)
        );
        return this.makeRequest(endpoint, data, attempt + 1);
      }

      throw error;
    }
  }
}

const ProfitLossCalculator = () => {
  const dispatch = useDispatch();
  const {
    tradePerDay,
    ndtpc,
    tradeAmount,
    riskReward,
    chancePercent,
    chargesPerTrade,
    results,
    profitLossChart,
  } = useSelector((state) => state.tca);
  const theme = useSelector((state) => state.theme.theme);

  // Enhanced state management
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [lastCalculationTime, setLastCalculationTime] = useState(null);
  const [apiService] = useState(() => new TCAAPIService());
  const encryptionKey = import.meta.env.VITE_ENCRYPTION_KEY || "Shivam";

  useEffect(() => {
    document.title = "DeepStrike | Advanced Risk Analysis & TCA";

    // Add meta description for SEO
    const metaDescription = document.querySelector('meta[name="description"]');
    if (metaDescription) {
      metaDescription.setAttribute(
        "content",
        "Professional trading cost analysis and risk management tools for algorithmic trading strategies"
      );
    }
  }, []);

  // Memoized input data with validation
  const inputData = useMemo(() => {
    const data = {
      tradePerDay: Number(tradePerDay) || 0,
      ndtpc: Number(ndtpc) || 0,
      tradeAmount: Number(tradeAmount) || 0,
      riskReward: Number(riskReward) || 0,
      chancePercent: Number(chancePercent) || 0,
      chargesPerTrade: Number(chargesPerTrade) || 0,
    };

    // Validate input data
    const isValid = Object.values(data).every(
      (value) => typeof value === "number" && !isNaN(value) && value >= 0
    );

    return { data, isValid };
  }, [
    tradePerDay,
    ndtpc,
    tradeAmount,
    riskReward,
    chancePercent,
    chargesPerTrade,
  ]);

  // Enhanced encryption with error handling
  const encryptedData = useMemo(() => {
    try {
      if (!inputData.isValid) return null;
      return CryptoJS.AES.encrypt(
        JSON.stringify(inputData.data),
        encryptionKey
      ).toString();
    } catch (error) {
      console.error("Encryption error:", error);
      return null;
    }
  }, [inputData, encryptionKey]);

  // Enhanced calculation handler with comprehensive error handling
  const handleGenerateClick = useCallback(async () => {
    if (!inputData.isValid) {
      toast.error("Please fill in all fields with valid numbers");
      return;
    }

    if (!encryptedData) {
      toast.error("Failed to encrypt data. Please try again.");
      return;
    }

    setIsLoading(true);
    setError(null);

    const startTime = Date.now();

    try {
      toast.info("Calculating trading strategy analysis...", {
        autoClose: 500,
        hideProgressBar: false,
      });

      const encryptedResult = await apiService.makeRequest("/api/generate", {
        encryptedData,
        timestamp: Date.now(),
        version: "2.0",
      });

      if (!encryptedResult.encryptedData) {
        throw new Error("Invalid response: Missing encrypted data");
      }

      const decryptedData = CryptoJS.AES.decrypt(
        encryptedResult.encryptedData,
        encryptionKey
      );

      const decryptedString = decryptedData.toString(CryptoJS.enc.Utf8);
      if (!decryptedString) {
        throw new Error("Failed to decrypt response data");
      }

      const result = JSON.parse(decryptedString);

      // Validate result structure
      if (!result || typeof result !== "object") {
        throw new Error("Invalid result format received");
      }

      const calculationTime = Date.now() - startTime;
      setLastCalculationTime(calculationTime);

      dispatch(setResults(result));

      toast.success(
        `Analysis completed successfully in ${(calculationTime / 1000).toFixed(
          1
        )}s`,
        {
          autoClose: 500,
          icon: <CheckCircleIcon className="w-5 h-5" />,
        }
      );
    } catch (err) {
      console.error("TCA Calculation Error:", err);
      const errorMessage = err.message || "Failed to generate trading analysis";
      setError(errorMessage);

      toast.error(errorMessage, {
        autoClose: 500,
        icon: <ExclamationTriangleIcon className="w-5 h-5" />,
      });
    } finally {
      setIsLoading(false);
    }
  }, [inputData, encryptedData, encryptionKey, dispatch, apiService]);

  // Calculate key metrics for display
  const keyMetrics = useMemo(() => {
    if (!results) return null;

    return {
      totalTrades: results.totalTrades || 0,
      winRate: results.winRate || 0,
      maxDrawdown: results.maxDrawdown || 0,
      sharpeRatio: results.sharpeRatio || 0,
      expectedReturn: results.expectedReturn || 0,
    };
  }, [results]);

  const isDark = theme === 'dark';

  return (
    <>
      <Helmet>
        <title>TCA | DeepStrike</title>
        <meta name="description" content="Trading Cost Analysis and Risk Management" />
      </Helmet>
      
      <div className={`min-h-screen transition-colors duration-300 ${isDark ? 'text-white' : 'text-gray-900'}`}>
        {/* Compact Header */}
        <div className={`sticky top-0 z-10 backdrop-blur-md border-b ${
          isDark ? 'bg-gray-900/90 border-gray-800' : 'bg-white/90 border-gray-200'
        }`}>
          <div className="max-w-7xl mx-auto px-4 py-3">
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center space-y-4 lg:space-y-0">
            <div className="flex items-center space-x-4">
              <div
                className={`p-3 rounded-xl ${
                  theme === "dark" ? "bg-blue-900/30" : "bg-blue-100"
                }`}
              >
                <CalculatorIcon
                  className={`w-8 h-8 ${
                    theme === "dark" ? "text-blue-400" : "text-blue-600"
                  }`}
                />
              </div>
              <div>
                <h1 className="text-3xl font-bold">Trading Cost Analysis</h1>
                <p
                  className={`text-sm mt-1 ${
                    theme === "dark" ? "text-gray-400" : "text-gray-600"
                  }`}
                >
                  Advanced risk management and strategy optimization
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-4">
              {lastCalculationTime && (
                <div
                  className={`flex items-center space-x-2 px-3 py-1 rounded-full text-sm ${
                    theme === "dark"
                      ? "bg-green-900/30 text-green-400"
                      : "bg-green-100 text-green-700"
                  }`}
                >
                  <ClockIcon className="w-4 h-4" />
                  <span>Last: {(lastCalculationTime / 1000).toFixed(1)}s</span>
                </div>
              )}
              <PNL results={results} />
            </div>
          </div>

          {/* Key Metrics Bar */}
          {keyMetrics && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="grid grid-cols-2 md:grid-cols-5 gap-4 mt-6"
            >
              {[
                {
                  label: "Total Trades",
                  value: keyMetrics.totalTrades,
                  icon: ChartBarIcon,
                },
                {
                  label: "Win Rate",
                  value: `${keyMetrics.winRate.toFixed(1)}%`,
                  icon: ArrowTrendingUpIcon,
                },
                {
                  label: "Max Drawdown",
                  value: `${keyMetrics.maxDrawdown.toFixed(2)}%`,
                  icon: ExclamationTriangleIcon,
                },
                {
                  label: "Sharpe Ratio",
                  value: keyMetrics.sharpeRatio.toFixed(2),
                  icon: ShieldCheckIcon,
                },
                {
                  label: "Expected Return",
                  value: `₹${keyMetrics.expectedReturn.toLocaleString()}`,
                  icon: CurrencyRupeeIcon,
                },
              ].map((metric) => {
                const Icon = metric.icon;
                return (
                  <div
                    key={metric.label}
                    className={`p-4 rounded-lg ${
                      theme === "dark" ? "bg-gray-800/50" : "bg-white/50"
                    } backdrop-blur-sm border ${
                      theme === "dark" ? "border-gray-700" : "border-gray-200"
                    }`}
                  >
                    <div className="flex items-center space-x-2 mb-2">
                      <Icon
                        className={`w-4 h-4 ${
                          theme === "dark" ? "text-gray-400" : "text-gray-600"
                        }`}
                      />
                      <span
                        className={`text-xs font-medium ${
                          theme === "dark" ? "text-gray-400" : "text-gray-600"
                        }`}
                      >
                        {metric.label}
                      </span>
                    </div>
                    <div className="text-lg font-bold">{metric.value}</div>
                  </div>
                );
              })}
            </motion.div>
          )}
        </div>
      </div>

      {/* Error Alert */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -50 }}
            className="max-w-7xl mx-auto p-4"
          >
            <div
              className={`p-4 rounded-lg border-l-4 ${
                theme === "dark"
                  ? "bg-red-900/20 border-red-500 text-red-200"
                  : "bg-red-50 border-red-500 text-red-800"
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <ExclamationTriangleIcon className="w-5 h-5" />
                  <div>
                    <h4 className="font-semibold">Calculation Error</h4>
                    <p className="text-sm mt-1">{error}</p>
                  </div>
                </div>
                <button
                  onClick={() => setError(null)}
                  className="text-lg font-bold hover:opacity-70"
                >
                  ×
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto p-6">
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
          {/* Input Section */}
          <div className="xl:col-span-1">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className={`p-6 rounded-xl shadow-xl border ${
                theme === "dark"
                  ? "bg-gray-800/50 border-gray-700 backdrop-blur-sm"
                  : "bg-white/80 border-gray-200 backdrop-blur-sm"
              }`}
            >
              <div className="space-y-6">
                <InputForm
                  handleGenerateClick={handleGenerateClick}
                  isLoading={isLoading}
                  isValid={inputData.isValid}
                />
                <div className="border-t pt-6 border-gray-300 dark:border-gray-600">
                  <ResultSection results={results} />
                </div>
              </div>
            </motion.div>
          </div>

          {/* Results Section */}
          <div className="xl:col-span-2">
            <AnimatePresence mode="wait">
              {isLoading ? (
                <motion.div
                  key="loading"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className={`flex flex-col justify-center items-center h-96 rounded-xl ${
                    theme === "dark" ? "bg-gray-800/50" : "bg-white/80"
                  } shadow-xl backdrop-blur-sm border ${
                    theme === "dark" ? "border-gray-700" : "border-gray-200"
                  }`}
                >
                  <div className="flex flex-col items-center space-y-4">
                    <div className="relative">
                      <div className="animate-spin rounded-full h-16 w-16 border-4 border-blue-200 border-t-blue-600"></div>
                      <CalculatorIcon className="absolute inset-0 m-auto w-6 h-6 text-blue-600" />
                    </div>
                    <div className="text-center">
                      <h3 className="text-xl font-semibold mb-2">
                        Analyzing Trading Strategy
                      </h3>
                      <p
                        className={`text-sm ${
                          theme === "dark" ? "text-gray-400" : "text-gray-600"
                        }`}
                      >
                        Processing complex calculations and risk metrics...
                      </p>
                    </div>
                  </div>
                </motion.div>
              ) : results ? (
                <motion.div
                  key="results"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-8"
                >
                  <ChartSection
                    profitLossChart={profitLossChart}
                    profitLossData={results.netProfitLossValues}
                    theme={theme}
                  />
                  <TradeAnalysis results={results} theme={theme} />
                  <GeneratedTrades results={results} />
                </motion.div>
              ) : (
                <motion.div
                  key="empty"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className={`flex flex-col justify-center items-center h-96 rounded-xl ${
                    theme === "dark" ? "bg-gray-800/50" : "bg-white/80"
                  } shadow-xl backdrop-blur-sm border ${
                    theme === "dark" ? "border-gray-700" : "border-gray-200"
                  }`}
                >
                  <div className="text-center space-y-4">
                    <div
                      className={`mx-auto w-16 h-16 rounded-full flex items-center justify-center ${
                        theme === "dark" ? "bg-gray-700" : "bg-gray-100"
                      }`}
                    >
                      <ChartBarIcon
                        className={`w-8 h-8 ${
                          theme === "dark" ? "text-gray-400" : "text-gray-500"
                        }`}
                      />
                    </div>
                    <div>
                      <h3 className="text-xl font-semibold mb-2">
                        Ready for Analysis
                      </h3>
                      <p
                        className={`text-sm ${
                          theme === "dark" ? "text-gray-400" : "text-gray-600"
                        }`}
                      >
                       Run analysis to see AI-generated trade setups based on &quot;The
                  Complete Audio&quot; strategy rules.
                      </p>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
      </div>
    </>
  );
};

export default ProfitLossCalculator;
