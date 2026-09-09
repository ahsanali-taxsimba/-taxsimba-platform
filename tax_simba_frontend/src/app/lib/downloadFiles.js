import { toast } from "react-hot-toast";
 
export const handleDownload = async (url, filename) => {
  // Wrap everything inside toast.promise for better UX
  await toast.promise(
    (async () => {
      const response = await fetch(url);
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
 