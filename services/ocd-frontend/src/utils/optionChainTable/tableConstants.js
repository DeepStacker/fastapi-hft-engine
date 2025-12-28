export const getBackgroundClass = (strike, type, sltp, isItmHighlighting) => {
    if (!sltp || !strike || !isItmHighlighting) return "";

    const strikePrice = parseFloat(strike);
    const spotPrice = parseFloat(sltp);

    if (isNaN(strikePrice) || isNaN(spotPrice)) return "";

    // For Call Options (CE): ITM when strike < spot price
    if (type === "ce") {
        return strikePrice < spotPrice ? "bg-itm-highlight" : "";
    }

    // For Put Options (PE): ITM when strike > spot price
    if (type === "pe") {
        return strikePrice > spotPrice ? "bg-itm-highlight" : "";
    }

    return "";
};

export const getHighlightClass = (abs, value, isHighlighting, isCe) => {
    if (isNaN(abs) || !isHighlighting || value === undefined || value === null)
        return "";

    const baseClass = isCe
        ? "text-black bg-red-500 z-50 transition-colors duration-200"
        : "text-black bg-green-500 z-50 transition-colors duration-200";

    if (value === "1") return baseClass;
    if (abs <= 0) return "text-red-500 transition-colors duration-200";
    if (value === "2")
        return "text-black bg-yellow-300 transition-colors duration-200";
    if (["3", "4", "5"].includes(value))
        return "text-black bg-yellow-100 transition-colors duration-200";

    return "";
};

export const getHighlightTextClass = (abs) => {
    if (abs === undefined || abs === null || isNaN(abs)) return "";
    return abs <= 0 ? "text-red-500" : "text-green-400";
};

export const getPCRClass = (pcr) => {
    if (pcr === undefined || pcr === null || isNaN(pcr)) return "";
    return pcr > 1.2 ? "text-green-700" : pcr < 0.8 ? "text-red-500" : "";
};

// Helper function to check if a class has background
export const hasBackgroundClass = (className) => {
    return (
        className &&
        (className.includes("bg-red-500") ||
            className.includes("bg-green-500") ||
            className.includes("bg-yellow-300") ||
            className.includes("bg-yellow-100"))
    );
};

// Optimized clipboard copy function
export const copyToClipboard = async (text, showAlert = false) => {
    try {
        if (navigator.clipboard && window.isSecureContext) {
            await navigator.clipboard.writeText(text.toString());
        } else {
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

        if (showAlert) {
            console.log(`Copied: ${text}`);
        }
    } catch (err) {
        console.error("Failed to copy text: ", err);
    }
};
