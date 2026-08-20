import axios from "axios";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export const api = axios.create({ baseURL: API, withCredentials: true });

// Double-submit CSRF token: the server sets a readable csrf_token cookie and requires it
// echoed back in this header on cookie-authenticated state-changing calls. This is not an
// authentication credential -- the session itself stays in httpOnly cookies.
api.interceptors.request.use((config) => {
  const match = document.cookie.match(/(?:^|;\s*)csrf_token=([^;]*)/);
  if (match) config.headers["X-CSRF-Token"] = decodeURIComponent(match[1]);
  return config;
});

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


// Documents live behind an authenticated endpoint. A plain <a href> opens the API as a new
// top-level document, so the httpOnly session cookie (SameSite=None / Partitioned) is not
// sent and the browser lands on {"detail":"Not authenticated"}. Fetching it with the
// authenticated client and viewing the resulting blob keeps access control fully server-side
// and never exposes a public document URL.
export async function openDocument(id, name) {
  // The tab must be opened synchronously within the click handler, otherwise the browser
  // treats the later window.open as non user-initiated and blocks it.
  const win = window.open("", "_blank");
  let res;
  try {
    res = await api.get(`/documents/${id}/download`, { responseType: "blob" });
  } catch (e) {
    if (win) win.close();
    throw e;
  }
  const url = URL.createObjectURL(res.data);
  if (win) {
    win.location.href = url;
  } else {
    const a = document.createElement("a");
    a.href = url;
    a.download = name || "document";
    document.body.appendChild(a);
    a.click();
    a.remove();
  }
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
