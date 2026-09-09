import axios from "axios";

/**
 * Log a client-side action to the backend audit logs.
 * @param {string} token - The user's authorization access token.
 * @param {string} action - The action identifier (e.g. "VIEW_BILLING", "CLICK_CANCEL").
 * @param {string} module - The module identifier (e.g. "BILLING", "PROFILE").
 * @param {object} [details={}] - Additional details and metadata.
 */
export const logClientAction = async (token, action, module, details = {}) => {
  try {
    if (!token) return;
    
    await axios.post(
      `${process.env.NEXT_PUBLIC_API_URL}client/audit-logs/client`,
      {
        action,
        module,
        details
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        }
      }
    );
  } catch (error) {
    console.error("❌ Failed to log client action:", error);
  }
};
