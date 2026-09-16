"use client";

import React from "react";

interface ToggleSwitchProps {
  checked: boolean;
  onChange: () => void;
}

const ToggleSwitch: React.FC<ToggleSwitchProps> = ({ checked, onChange }) => {
  return (
    <button
      type="button"
      onClick={onChange}
      className={`
        relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center !rounded-full transition-colors duration-300 ease-in-out focus:outline-none focus:ring-2 focus:ring-[#37a267]/20
        ${checked ? "bg-[#37a267]" : "bg-gray-200"}
      `}
    >
      <span
        className={`
          pointer-events-none absolute left-[3px] top-[3px] block h-[18px] w-[18px] transform !rounded-full bg-white shadow-sm transition duration-300 ease-in-out
          ${checked ? "translate-x-[20px]" : "translate-x-0"}
        `}
      />
    </button>
  );
};

export default ToggleSwitch;
