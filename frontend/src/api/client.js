import axios from "axios";

function trimTrailingSlash(value) {
  return String(value || "").trim().replace(/\/+$/, "");
}

function normalizePrefix(value) {
  const normalized = String(value || "").trim().replace(/^\/+|\/+$/g, "");
  return normalized ? `/${normalized}` : "";
}

const projectApiBase = trimTrailingSlash(import.meta.env.VITE_DIGITALPJK_API_BASE_URL);
const projectApiPrefix = normalizePrefix(import.meta.env.VITE_DIGITALPJK_API_PREFIX);
const defaultApiBase = import.meta.env.PROD ? "https://sc-official-website.onrender.com" : "";
const defaultApiPrefix = import.meta.env.PROD ? "/api/digitalpjk" : "/api";

const apiBase = projectApiBase || defaultApiBase;
const apiPrefix = projectApiPrefix || defaultApiPrefix;
const baseURL = apiBase ? `${apiBase}${apiPrefix}` : apiPrefix;

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
