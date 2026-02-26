import axios from "axios";

const baseURL = import.meta.env.VITE_API_BASE_URL || "/api";

const client = axios.create({
  baseURL,
});

let accessToken = null;

export function setAccessToken(token) {
  accessToken = token || null;
}

client.interceptors.request.use((config) => {
  const nextConfig = { ...config };
  nextConfig.headers = nextConfig.headers || {};

  if (accessToken) {
    nextConfig.headers.Authorization = `Bearer ${accessToken}`;
  } else {
    delete nextConfig.headers.Authorization;
  }

  return nextConfig;
});

export default client;
