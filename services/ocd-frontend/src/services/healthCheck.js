// src/services/healthCheck.js
/**
 * Health Check Service - FastAPI Compatible
 * Uses environment variable for API base URL
 */
import axios from "axios";

const getBaseUrl = () => {
  // Remove /api/v1 suffix to get root URL for health endpoint
  const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api/v1';
  return baseUrl.replace('/api/v1', '');
};

export const activateServices = async () => {
  try {
    const baseUrl = getBaseUrl();
    const restRes = await axios.get(`${baseUrl}/api/v1/health`);
    console.log("[REST API] Service Activated:", restRes.data);
  } catch (error) {
    console.error("[Service Activation] Error:", error.message);
  }
};

export const checkHealth = async () => {
  try {
    const baseUrl = getBaseUrl();
    const response = await axios.get(`${baseUrl}/api/v1/health`);
    return response.data;
  } catch (error) {
    console.error("[Health Check] Error:", error.message);
    return { status: 'error', message: error.message };
  }
};

export default { activateServices, checkHealth };
