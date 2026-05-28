import axios from "axios";

const API_ROOT = (import.meta.env.VITE_API_URL || "http://localhost:8000").replace(/\/$/, "");

const resolveApiPath = (url = "") => {
  if (!url || /^https?:\/\//i.test(url) || url.startsWith("/api/")) {
    return url;
  }

  if (url.startsWith("/public/")) {
    return `/api${url}`;
  }

  return `/api/v1${url}`;
};

const api = axios.create({
  baseURL: API_ROOT,
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
    Accept: "application/json",
  },
});

// Interceptor para agregar token
api.interceptors.request.use((config) => {
  config.url = resolveApiPath(config.url);

  if (config.data instanceof FormData && config.headers) {
    delete config.headers["Content-Type"];
  }

  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  if (config.url?.startsWith("/api/public/")) {
    const publicSessionToken = sessionStorage.getItem("public_table_session_token");
    const publicTableFingerprint = sessionStorage.getItem("public_table_fingerprint");
    const publicTableUuid = sessionStorage.getItem("public_table_uuid");

    if (publicSessionToken) {
      config.headers["X-Table-Session-Token"] = publicSessionToken;
    }

    if (publicTableFingerprint) {
      config.headers["X-Table-Fingerprint"] = publicTableFingerprint;
    }

    if (publicTableUuid) {
      config.headers["X-Table-UUID"] = publicTableUuid;
    }
  }

  return config;
});

export default api;
