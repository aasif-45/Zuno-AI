import axios from "axios";

const isDeployed =
  typeof window !== "undefined" &&
  window.location.hostname !== "localhost" &&
  window.location.hostname !== "127.0.0.1";

const isCloudFrontOrHttps =
  typeof window !== "undefined" &&
  (window.location.hostname.includes("cloudfront.net") || window.location.protocol === "https:");

const defaultUrl = isCloudFrontOrHttps
  ? ""
  : isDeployed
  ? "http://my-ai-alb-1538174081.ap-south-1.elb.amazonaws.com"
  : "http://localhost:3000";

let rawUrl = isCloudFrontOrHttps ? "" : (import.meta.env.VITE_SERVER_URL || defaultUrl);
if (!isCloudFrontOrHttps && isDeployed && (rawUrl.includes("localhost") || rawUrl.includes("127.0.0.1"))) {
  rawUrl = "http://my-ai-alb-1538174081.ap-south-1.elb.amazonaws.com";
}

const baseURL = rawUrl.endsWith("/") ? rawUrl.slice(0, -1) : rawUrl;

const api = axios.create({
  baseURL,
  withCredentials: true,
});

api.interceptors.request.use((config) => {
  try {
    const sessionId = localStorage.getItem("session_id");
    if (sessionId) {
      config.headers.Authorization = `Bearer ${sessionId}`;
      config.headers["x-session-id"] = sessionId;
    }
  } catch {}
  return config;
});

export default api;
