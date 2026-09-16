import React from 'react';
import './GetStartedButton.css';

/**
 * GetStartedButton Component
 * 
 * A reusable button component with an animated arrow icon.
 * Features:
 * - Light purple background with rounded corners
 * - Dark green circular arrow icon that rotates on hover
 * - Responsive design matching the existing basic_btn dimensions
 * - Customizable text and click handler
 * - Variant support for different color schemes
 * 
 * @param {Object} props
 * @param {string} props.text - Button text to display (default: "Get started")
 * @param {Function} props.onClick - Click handler function
 * @param {string} props.className - Additional CSS classes
 * @param {string} props.href - Optional link URL (renders as anchor if provided)
 * @param {string} props.type - Button type (default: "button")
 * @param {string} props.variant - Color variant: "default" or "pro-blue" (default: "default")
 */
const GetStartedButton = ({ 
  text = "Get started", 
  onClick, 
  className = "", 
  href,
  type = "button",
  variant = "default",
  ...props 
}) => {
  const variantClass = variant === "pro-blue" ? "get-started-btn--pro-blue" : "";
  const buttonContent = (
    <>
      <span className="get-started-btn__text">{text}</span>
      <span className="get-started-btn__icon-wrapper">
        <svg 
          className="get-started-btn__arrow" 
          width="24" 
          height="24" 
          viewBox="0 0 24 24" 
          fill="none" 
          xmlns="http://www.w3.org/2000/svg"
        >
          <path 
            d="M5 12H19M19 12L12 5M19 12L12 19" 
            stroke="white" 
            strokeWidth="2" 
            strokeLinecap="round" 
            strokeLinejoin="round"
          />
        </svg>
      </span>
    </>
  );

  if (href) {
    return (
      <a 
        href={href}
        className={`get-started-btn ${variantClass} ${className}`}
        {...props}
      >
        {buttonContent}
      </a>
    );
  }

  return (
    <button 
      type={type}
      onClick={onClick}
      className={`get-started-btn ${variantClass} ${className}`}
      {...props}
    >
      {buttonContent}
    </button>
  );
};

export default GetStartedButton;
