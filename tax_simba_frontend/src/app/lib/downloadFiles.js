import { toast } from "react-hot-toast";
import { getSession } from "next-auth/react";

/**
 * Download a file. Relative API paths (e.g. client/documents/:id/download)
 * are resolved against NEXT_PUBLIC_API_URL with Bearer auth.
 */
export const handleDownload = async (url, filename) => {
  await toast.promise(
    (async () => {
      if (!url) throw new Error("Download URL is missing");

      const apiBase = process.env.NEXT_PUBLIC_API_URL || "";
      const isAbsolute = /^https?:\/\//i.test(url);
      const isApiRelative =
        !isAbsolute &&
        (url.startsWith("client/") ||
          url.startsWith("admin/") ||
          url.startsWith("accountant/") ||
          url.startsWith("/client/") ||
          url.startsWith("/admin/"));

      let fetchUrl = url;
      const headers = {};
      if (isApiRelative) {
        const path = url.replace(/^\//, "");
        fetchUrl = `${apiBase}${path}`;
        const session = await getSession();
        const token = session?.accessToken || session?.user?.accessToken;
        if (token) {
          headers.Authorization = token.startsWith("Bearer ")
            ? token
            : `Bearer ${token}`;
        }
      }

      const response = await fetch(fetchUrl, { headers });
      if (!response.ok) throw new Error("Network response was not ok");

      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(blobUrl);
    })(),
    {
      loading: "Preparing your download...",
      success: "Download successfully 🎉",
      error: "Failed to start download ❌",
    },
    {
      style: {
        background: "#fff",
        border: "1px solid #ddd",
        padding: "12px 16px",
        borderRadius: "8px",
        color: "#333",
        boxShadow: "0 4px 10px rgba(0,0,0,0.1)",
      },
    }
  );
};
