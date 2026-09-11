export const passwordRegex =
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d])[A-Za-z\d\S]{8,}$/;

export const getFileExtension = (filename) => {
    if (!filename) return "";
    return filename.substring(filename.lastIndexOf('.') + 1).toLowerCase();
};

export const getFileIcon = (file) => {
    if (!file) return "/images/grey_pdf.svg";
    if (file.thumbnailUrl) return file.thumbnailUrl;
    if (file.previewUrl) return file.previewUrl;

    const extension = getFileExtension(file.filename);
    const imageExtensions = ["jpg", "jpeg", "png", "gif", "svg", "webp"];
    const excelExtensions = ["xlsx", "xls", "csv"];

    if (imageExtensions.includes(extension)) {
        return "/images/profile-image.jpg"; // Using a generic image placeholder if no preview
    }
    if (excelExtensions.includes(extension)) {
        return "/images/grey_excel.svg";
    }
    return "/images/grey_pdf.svg";
};

/**
 * Dynamically resolves the currency symbol for a given ISO currency code.
 * @param {string} currencyCode - The ISO currency code (e.g., 'USD', 'GBP', 'EUR').
 * @returns {string} The currency symbol or the original code if not found.
 */
export const getCurrencySymbol = (currencyCode) => {
    if (!currencyCode) return "£"; // Default to GBP as per project context
    try {
        const parts = new Intl.NumberFormat('en-GB', {
            style: 'currency',
            currency: currencyCode.toUpperCase(),
        }).formatToParts(0);
        return parts.find(p => p.type === 'currency')?.value || currencyCode;
    } catch (e) {
        return currencyCode;
    }
};

/**
 * Dynamically resolves the backend base URL.
 * Falls back to extracting the protocol and host from NEXT_PUBLIC_API_URL if NEXT_PUBLIC_NODE_JS_URL is not defined.
 * @returns {string} The base URL of the backend (e.g. 'http://localhost:3000' or 'https://api.example.com').
 */
export const getBackendBaseUrl = () => {
    if (typeof process !== "undefined" && process.env) {
        if (process.env.NEXT_PUBLIC_NODE_JS_URL) {
            return process.env.NEXT_PUBLIC_NODE_JS_URL;
        }
        const apiUrl = process.env.NEXT_PUBLIC_API_URL;
        if (apiUrl) {
            try {
                const url = new URL(apiUrl);
                return `${url.protocol}//${url.host}`;
            } catch (e) {
                // fallback
            }
        }
    }
    return "";
};

/**
 * Formats a given quarter string (e.g., "Q1 2024") into a more descriptive format
 * that includes the exact date ranges for the UK tax year.
 * @param {string} quarterStr - The raw quarter string (e.g., "Q1 2024").
 * @returns {string} The formatted quarter string.
 */
export const formatQuarterDisplay = (quarterStr) => {
    if (!quarterStr || quarterStr === "—") return quarterStr;
    if (quarterStr.includes("Q1")) return quarterStr.replace("Q1", "Q1 (6 April – 5 July)");
    if (quarterStr.includes("Q2")) return quarterStr.replace("Q2", "Q2 (6 July – 5 October)");
    if (quarterStr.includes("Q3")) return quarterStr.replace("Q3", "Q3 (6 October – 5 January)");
    if (quarterStr.includes("Q4")) return quarterStr.replace("Q4", "Q4 (6 January – 5 April)");
    return quarterStr;
};