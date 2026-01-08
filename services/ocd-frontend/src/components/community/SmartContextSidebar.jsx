/**
 * Smart Context Sidebar
 * Displays live market data, community sentiment, and trending topics
 */
import { useState, useEffect, useMemo } from "react";
import { useSelector } from "react-redux";
import {
    ArrowTrendingUpIcon,
    FireIcon,
    ChartBarIcon,
    ArrowPathIcon
} from "@heroicons/react/24/solid";
import { motion } from "framer-motion";
import { communityService } from "../../services/communityService";

const ContextCard = ({ title, children, icon: Icon, color = "text-blue-400", loading = false }) => (
    <div className="bg-gray-800/40 backdrop-blur-md border border-gray-700/50 rounded-lg p-4 mb-4 shadow-lg">
        <div className="flex items-center justify-between gap-2 mb-3 border-b border-gray-700/50 pb-2">
            <div className="flex items-center gap-2">
                <Icon className={`w-4 h-4 ${color}`} />
                <h3 className="text-xs font-bold uppercase tracking-wider text-gray-300">{title}</h3>
            </div>
            {loading && <ArrowPathIcon className="w-3 h-3 text-gray-500 animate-spin" />}
        </div>
        {children}
    </div>
);

const TickerRow = ({ symbol, price, change, changePercent, loading }) => {
    const isPositive = change >= 0;

    if (loading) {
        return (
            <div className="flex items-center justify-between py-2 text-sm border-b border-gray-700/30 last:border-0">
                <div className="flex flex-col gap-1">
                    <div className="h-4 w-16 bg-gray-700 rounded animate-pulse" />
                    <div className="h-3 w-8 bg-gray-800 rounded animate-pulse" />
                </div>
                <div className="flex flex-col items-end gap-1">
                    <div className="h-4 w-20 bg-gray-700 rounded animate-pulse" />
                    <div className="h-3 w-12 bg-gray-800 rounded animate-pulse" />
                </div>
            </div>
        );
    }

    return (
        <div className="flex items-center justify-between py-2 text-sm border-b border-gray-700/30 last:border-0 hover:bg-white/5 px-2 rounded cursor-pointer transition-colors group">
            <div className="flex flex-col">
                <span className="font-bold text-gray-200 group-hover:text-blue-400 transition-colors">{symbol}</span>
                <span className="text-[10px] text-gray-500">NSE</span>
            </div>
            <div className="flex flex-col items-end">
                <span className="font-mono text-gray-100">{price?.toFixed(2) || '--'}</span>
                <span className={`text-[10px] font-bold ${isPositive ? "text-green-500" : "text-red-500"}`}>
                    {isPositive ? "+" : ""}{change?.toFixed(2) || '0.00'} ({changePercent?.toFixed(2) || '0.00'}%)
                </span>
            </div>
        </div>
    );
};

const SmartContextSidebar = () => {
    // Live market data from Redux
    const spotData = useSelector((state) => state.data?.data?.spot?.data);
    const optionData = useSelector((state) => state.data?.data);

    // Community data state
    const [leaderboard, setLeaderboard] = useState(null);
    const [trendingTags, setTrendingTags] = useState([]);
    const [loading, setLoading] = useState(true);

    // Fetch community data on mount
    useEffect(() => {
        const fetchCommunityData = async () => {
            try {
                setLoading(true);
                const leaderboardData = await communityService.getLeaderboard(10);
                setLeaderboard(leaderboardData);

                // Extract trending tags from top traders' activity (simplified)
                // In production, this would come from a dedicated endpoint
                const defaultTags = ["#NIFTY", "#BANKNIFTY", "#Options", "#Intraday", "#Expiry"];
                setTrendingTags(defaultTags);
            } catch (err) {
                console.error('Failed to fetch community data:', err);
            } finally {
                setLoading(false);
            }
        };

        fetchCommunityData();
    }, []);

    // Calculate sentiment from leaderboard data
    const sentiment = useMemo(() => {
        if (!leaderboard?.entries?.length) return 50;

        // Calculate average trade accuracy as proxy for market sentiment
        const avgAccuracy = leaderboard.entries.reduce((sum, e) => sum + (e.trade_accuracy || 50), 0) / leaderboard.entries.length;
        return Math.min(Math.max(Math.round(avgAccuracy), 20), 80);
    }, [leaderboard]);

    // Derive BANKNIFTY and VIX from option chain data if available
    const bankNiftyData = useMemo(() => {
        // Try to get from Redux spot data or use reasonable defaults
        if (optionData?.BANKNIFTY?.spot?.data) {
            const d = optionData.BANKNIFTY.spot.data;
            return { price: d.Ltp, change: d.change, changePercent: d.changePercent };
        }
        return null;
    }, [optionData]);

    const niftyData = useMemo(() => {
        if (spotData) {
            return {
                price: spotData.Ltp,
                change: spotData.change,
                changePercent: spotData.changePercent
            };
        }
        return null;
    }, [spotData]);

    const hasMarketData = niftyData || bankNiftyData;

    return (
        <div className="h-full overflow-y-auto p-4 border-l border-gray-800 bg-gray-900/50 w-80 hidden xl:block">
            {/* Market Context */}
            <ContextCard title="Market Pulse" icon={ChartBarIcon} color="text-green-400" loading={!hasMarketData}>
                <TickerRow
                    symbol="NIFTY 50"
                    price={niftyData?.price}
                    change={niftyData?.change}
                    changePercent={niftyData?.changePercent}
                    loading={!niftyData}
                />
                <TickerRow
                    symbol="BANKNIFTY"
                    price={bankNiftyData?.price}
                    change={bankNiftyData?.change}
                    changePercent={bankNiftyData?.changePercent}
                    loading={!bankNiftyData}
                />
            </ContextCard>

            {/* Sentiment Meter - Calculated from real data */}
            <ContextCard title="Community Sentiment" icon={FireIcon} color="text-orange-400" loading={loading}>
                <div className="relative pt-4 pb-2">
                    <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                        <motion.div
                            className="h-full bg-gradient-to-r from-red-500 via-yellow-500 to-green-500"
                            initial={{ width: "50%" }}
                            animate={{ width: `${sentiment}%` }}
                            transition={{ duration: 1 }}
                        />
                    </div>
                    <div className="flex justify-between text-[10px] text-gray-500 mt-1 font-mono uppercase">
                        <span>Bearish</span>
                        <span className="text-white font-bold">{sentiment}% Bullish</span>
                        <span>Bullish</span>
                    </div>
                </div>
                {leaderboard && (
                    <div className="mt-3 pt-3 border-t border-gray-700/50">
                        <div className="flex justify-between text-[10px] text-gray-500">
                            <span>Active Traders</span>
                            <span className="text-white font-medium">{leaderboard.total_users || 0}</span>
                        </div>
                    </div>
                )}
            </ContextCard>

            {/* Trending Tags */}
            <ContextCard title="Trending Now" icon={ArrowTrendingUpIcon} color="text-purple-400" loading={loading}>
                <div className="flex flex-wrap gap-2">
                    {trendingTags.map(tag => (
                        <span
                            key={tag}
                            className="px-2 py-1 bg-gray-800 border border-gray-600 rounded text-xs text-blue-300 hover:bg-blue-500/20 hover:border-blue-500/50 cursor-pointer transition-all"
                        >
                            {tag}
                        </span>
                    ))}
                </div>
            </ContextCard>
        </div>
    );
};

export default SmartContextSidebar;
