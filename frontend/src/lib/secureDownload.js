/**
 * Authenticated file open with antivirus gate:
 * - 403 infected → blocked modal
 * - 409 risky → confirmation modal, then retry with confirm_risk=1
 */
import { api } from "@/lib/api";

async function detailFromError(error) {
  const data = error?.response?.data;
  if (!data) return error?.message || "Download failed";
  if (typeof data === "string") return data;
  if (data instanceof Blob) {
    try {
      const text = await data.text();
      const json = JSON.parse(text);
      return json.detail ?? text;
    } catch {
      return "Download failed";
    }
  }
  return data.detail ?? data;
}

function openBlob(blob, name, win) {
  const url = URL.createObjectURL(blob);
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

/**
 * @param {object} opts
 * @param {string} opts.url - API path e.g. /documents/x/download
 * @param {string} [opts.name]
 * @param {boolean} [opts.confirmRisk]
 * @param {(info: {mode:string, scanStatus:string, detail:any}) => Promise<"confirm"|"cancel"|"request">} [opts.onRisk]
 */
export async function openSecureFile({ url, name, confirmRisk = false, onRisk }) {
  const win = window.open("", "_blank");
  try {
    const res = await api.get(url, {
      responseType: "blob",
      params: confirmRisk ? { confirm_risk: "1" } : undefined,
    });
    openBlob(res.data, name, win);
    return { ok: true };
  } catch (e) {
    if (win) win.close();
    const status = e?.response?.status;
    const detail = await detailFromError(e);

    if (status === 403) {
      if (onRisk) {
        await onRisk({
          mode: "blocked",
          scanStatus: "infected",
          detail,
        });
      }
      const err = new Error(
        typeof detail === "string"
          ? detail
          : "This file contains malware and cannot be downloaded.",
      );
      err.code = "INFECTED";
      err.detail = detail;
      throw err;
    }

    if (status === 409) {
      const payload = typeof detail === "object" && detail ? detail : { message: detail };
      const scanStatus = payload.scan_status || "suspicious";
      if (!onRisk) {
        const err = new Error(payload.message || "Confirmation required");
        err.code = "RISKY_FILE_CONFIRMATION_REQUIRED";
        err.detail = payload;
        throw err;
      }
      const choice = await onRisk({
        mode: "warn",
        scanStatus,
        detail: payload,
      });
      if (choice === "confirm") {
        return openSecureFile({ url, name, confirmRisk: true, onRisk });
      }
      return { ok: false, choice };
    }

    throw e;
  }
}

/** Convenience for case documents. */
export function openDocumentSecure(id, name, onRisk) {
  return openSecureFile({
    url: `/documents/${id}/download`,
    name,
    onRisk,
  });
}
