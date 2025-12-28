// src/utils/utils.js
export function formatNumber(value) {
  if (typeof value === "number") {
    if (value >= 1e12 || value <= -1e12) return (value / 1e12).toFixed(2) + "T";
    if (value >= 1e9 || value <= -1e9) return (value / 1e9).toFixed(2) + "B";
    if (value >= 1e6 || value <= -1e6) return (value / 1e6).toFixed(2) + "M";
    if (value >= 1e3 || value <= -1e3) return (value / 1e3).toFixed(2) + "k";
    return value.toFixed(2);
  }
  return "N/A";
}

export function formatChartNumber(value) {
  if (typeof value === "number") {
    return (value / 1e5);
    // return value.toFixed(2);
  }
  return "N/A";
}

export function toFixed(value) {
  return value ? value.toFixed(2) : 0;
}
