import axios from "axios";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export const api = axios.create({ baseURL: API, withCredentials: true });

// The session lives in httpOnly cookies only -- the access token is never written to
// localStorage where client-side script could read it. Access tokens are short-lived, so a
// single 401 transparently rotates the session via the refresh cookie and retries once.
let refreshing = null;

api.interceptors.response.use(
  (r) => r,
  async (error) => {
    const { response, config } = error;
    if (response?.status !== 401 || config?._retried || config?.url?.includes("/auth/")) {
      return Promise.reject(error);
    }
    config._retried = true;
    try {
      refreshing = refreshing || api.post("/auth/refresh");
      await refreshing;
      refreshing = null;
      return api(config);
    } catch (e) {
      refreshing = null;
      return Promise.reject(error);
    }
  }
);

export function apiError(detail) {
  if (detail == null) return "Something went wrong. Please try again.";
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) return detail.map((e) => e?.msg || JSON.stringify(e)).join(" ");
  if (detail?.msg) return detail.msg;
  return String(detail);
}

export const money = (n) =>
  new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(n || 0);

export const dt = (s) =>
  s ? new Date(s).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";

export const d = (s) =>
  s ? new Date(s).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—";
