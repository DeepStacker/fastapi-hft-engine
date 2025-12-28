import logger from './logger';

export const formatDate = (date) => {
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
};

export const convertUTCToISTTimestamp = (utcTimestamp) => {
    return utcTimestamp + 5.5 * 60 * 60;
};

export const formatTimeForIST = (timestamp) => {
    const date = new Date(timestamp * 1000);
    return date.toLocaleString("en-IN", {
        timeZone: "Asia/Kolkata",
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
    });
};

// Support/Resistance computation function
export const computeLevels = (oc, price, isCommodity) => {
    logger.log("🔢 Computing levels with:", { oc: !!oc, price, isCommodity });

    if (!oc || typeof oc !== "object") {
        logger.log("❌ Invalid OC data");
        return {
            support_1: null,
            support_2: null,
            support_1_1: null,
            support_1_2: null,
            support_2_1: null,
            support_2_2: null,
            resistance_1: null,
            resistance_2: null,
            resistance_1_1: null,
            resistance_1_2: null,
            resistance_2_1: null,
            resistance_2_2: null,
        };
    }

    const strikes = Object.keys(oc)
        .filter((k) => /^\d+$/.test(k))
        .map(Number)
        .sort((a, b) => a - b);

    if (strikes.length === 0) {
        return {
            support_1: null,
            support_2: null,
            support_1_1: null,
            support_1_2: null,
            support_2_1: null,
            support_2_2: null,
            resistance_1: null,
            resistance_2: null,
            resistance_1_1: null,
            resistance_1_2: null,
            resistance_2_1: null,
            resistance_2_2: null,
        };
    }

    const below = strikes.filter((s) => s <= price);
    const above = strikes.filter((s) => s > price);

    const pick = (levels, selector) => {
        if (!levels.length) return null;
        const idx = selector(levels);
        if (idx < 0 || idx >= levels.length) return null;
        const strikeKey = levels[idx];
        const strikeData = oc[strikeKey];
        return strikeData || null;
    };

    const levels = {
        support_1: pick(below, (l) => l.length - 1)?.reversal,
        support_2: pick(below, (l) => l.length - 1)?.wkly_reversal,
        support_1_1: pick(below, (l) => l.length - 2)?.reversal,
        support_1_2: pick(below, (l) => l.length - 3)?.reversal,
        support_2_1: pick(below, (l) => l.length - 2)?.wkly_reversal,
        support_2_2: pick(below, (l) => l.length - 3)?.wkly_reversal,

        resistance_1: pick(above, (_l) => 0)?.reversal,
        resistance_2: pick(above, (_l) => 0)?.wkly_reversal,
        resistance_1_1: pick(above, (_l) => 1)?.reversal,
        resistance_1_2: pick(above, (_l) => 2)?.reversal,
        resistance_2_1: pick(above, (_l) => 1)?.wkly_reversal,
        resistance_2_2: pick(above, (_l) => 2)?.wkly_reversal,

        // New averaged levels
        support_avg:
            ((pick(below, (l) => l.length - 1)?.reversal ?? 0) +
                (pick(below, (l) => l.length - 1)?.wkly_reversal ?? 0)) /
            2,

        support_1_1_avg:
            ((pick(below, (l) => l.length - 2)?.reversal ?? 0) +
                (pick(below, (l) => l.length - 2)?.wkly_reversal ?? 0)) /
            2,

        support_1_2_avg:
            ((pick(below, (l) => l.length - 3)?.reversal ?? 0) +
                (pick(below, (l) => l.length - 3)?.wkly_reversal ?? 0)) /
            2,

        resistance_avg:
            ((pick(above, (_l) => 0)?.reversal ?? 0) +
                (pick(above, (_l) => 0)?.wkly_reversal ?? 0)) /
            2,

        resistance_1_1_avg:
            ((pick(above, (_l) => 1)?.reversal ?? 0) +
                (pick(above, (_l) => 1)?.wkly_reversal ?? 0)) /
            2,

        resistance_1_2_avg:
            ((pick(above, (_l) => 2)?.reversal ?? 0) +
                (pick(above, (_l) => 2)?.wkly_reversal ?? 0)) /
            2,
    };

    logger.log("✅ Computed levels:", levels);
    return levels;
};

export const debounce = (func, wait) => {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
};

export const throttle = (func, limit) => {
    let inThrottle;
    return function (...args) {
        if (!inThrottle) {
            func.apply(this, args);
            inThrottle = true;
            setTimeout(() => (inThrottle = false), limit);
        }
    };
};
