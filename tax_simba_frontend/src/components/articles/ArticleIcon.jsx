/** Decorative category icons for compact article headers and hub cards. */
const PATHS = {
  "digital-tax": (
    <>
      <rect x="3" y="4" width="18" height="16" rx="3" />
      <path d="M7 8h10M7 12h4M7 16h2M14 12h3M14 16h3" />
    </>
  ),
  calendar: (
    <>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M8 3v4M16 3v4M3 11h18" />
    </>
  ),
  pound: (
    <>
      <path d="M15 7.5A3.5 3.5 0 0 0 11.5 4H9v7H7v2h2v2.5A3.5 3.5 0 0 1 5.5 19H5" />
      <path d="M7 13h7" />
    </>
  ),
  home: (
    <>
      <path d="M4 11.5 12 4l8 7.5" />
      <path d="M7 10.5V20h10v-9.5" />
    </>
  ),
  briefcase: (
    <>
      <rect x="3" y="7" width="18" height="13" rx="2" />
      <path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2M3 13h18" />
    </>
  ),
  accountant: (
    <>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 20c1.5-3.5 4-5 7-5s5.5 1.5 7 5" />
    </>
  ),
  "document-check": (
    <>
      <path d="M7 3h7l4 4v14H7z" />
      <path d="M14 3v4h4M9 13l2 2 4-4" />
    </>
  ),
  "hard-hat": (
    <>
      <path d="M4 14h16v3H4z" />
      <path d="M6 14a6 6 0 0 1 12 0" />
      <path d="M12 5v3" />
    </>
  ),
  "tax-guide": (
    <>
      <path d="M6 4h9l3 3v13H6z" />
      <path d="M15 4v3h3M9 12h6M9 16h4" />
    </>
  ),
};

export default function ArticleIcon({ iconKey = "tax-guide", size = 28, className = "" }) {
  const paths = PATHS[iconKey] || PATHS["tax-guide"];
  return (
    <span className={`article-icon-tile ${className}`.trim()} aria-hidden="true">
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {paths}
      </svg>
    </span>
  );
}
