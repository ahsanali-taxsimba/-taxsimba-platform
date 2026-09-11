import Link from "next/link";
import React from "react";

interface BreadcrumbProps {
  pageTitle: string;
  parentPage?: string;
  parentPageUrl?: string;
}

const PageBreadcrumb: React.FC<BreadcrumbProps> = ({ pageTitle, parentPage="Home", parentPageUrl="/" }) => {
  return (
    <div className="flex flex-wrap items-center justify-between flex-wrap gap-3 mb-6">
      <h2
        className="text-xl font-semibold text-gray-800 dark:text-white/90"
        x-text="pageName"
      >
        {pageTitle}
      </h2>
      <nav>
        <ol className="flex items-center gap-1.5 mb-0 ps-0">
          <li>
            <Link
              className="text-capitalize text-green inline-flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400"
              href={parentPageUrl}
            >
              {parentPage}
              <svg
                className="stroke-current"
                width="17"
                height="16"
                viewBox="0 0 17 16"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M6.0765 12.667L10.2432 8.50033L6.0765 4.33366"
                  stroke=""
                  strokeWidth="1.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </Link>
          </li>
          <li className="text-sm text-gray-800 dark:text-white/90">
            {pageTitle}
          </li>
        </ol>
      </nav>
    </div>
  );
};

export default PageBreadcrumb;
