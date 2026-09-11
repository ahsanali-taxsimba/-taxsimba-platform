"use client";
import { motion } from "framer-motion";

export const Card = ({ children, className = "" }) => (
    <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className={`glass-card ${className}`}
    >
        {children}
    </motion.div>
);

export const Input = ({ label, value, onChange, type = "number", placeholder = "", suffix = "", className = "" }) => {
    const handleChange = (val) => {
        if (type === "number") {
            // Handle empty string as 0 to avoid NaN in calculations
            if (val === "") {
                onChange(0);
                return;
            }
            // Coerce to number and prevent negative values for tax inputs
            const num = Number(val);
            onChange(isNaN(num) ? 0 : Math.max(0, num));
        } else {
            onChange(val);
        }
    };

    return (
        <div className="mb-0">
            <label className="block text-sm font-semibold mb-2 text-gray-700">{label}</label>
            <div className="relative">
                <input
                    type={type}
                    value={value || ""}
                    onChange={(e) => handleChange(e.target.value)}
                    min={type === "number" ? 0 : undefined}
                    placeholder={placeholder}
                    className={`input-field pr-10 ${className}`}
                />
                {suffix && (
                    <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-gray-400 font-medium">
                        {suffix}
                    </div>
                )}
            </div>
        </div>
    );
};

export const Button = ({ children, onClick, className = "" }) => (
    <button onClick={onClick} className={`primary-button ${className}`}>
        {children}
    </button>
);

export const ResultRow = ({ label, value, isTotal = false }) => {
    const formatValue = (val) => typeof val === "number" ? `£${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : val;

    return (
        <div className={`flex justify-between py-3 ${isTotal ? "font-bold text-xl text-brand-primary mt-0 mb-2" : "text-sm border-b border-gray-100"}`}>
            <p className="text-dark font-medium">{label}</p>
            <p className={isTotal ? "text-gray-900" : "text-dark"}>{formatValue(value)}</p>
        </div>
    );
};

export const Accordion = ({ title, children, isOpen, onToggle }) => (
    <div className="border border-gray-200 rounded-xl overflow-hidden mb-4">
        <button
            onClick={onToggle}
            className="w-100 px-3 py-3 flex justify-between items-center bg-white hover:bg-gray-50 transition-colors"
        >
            <p className="font-bold text-dark fs-5">{title}</p>
            <p className={`transform transition-transform duration-200 ease-in-out inline-block ${isOpen ? "rotate-180" : ""} text-theme`}>▼</p>
        </button>
        {isOpen && (
            <div className="p-0 cal-details border-t border-gray-200 animate-in fade-in slide-in-from-top-2">
                {children}
            </div>
        )}
    </div>
);

export const PeriodicToggle = ({ activePeriod, onPeriodChange }) => (
    <div className="period-toggles mb-2">
        {["Annual", "Monthly", "Weekly", "Daily"].map(p => (
            <button
                key={p}
                onClick={() => onPeriodChange(p.toLowerCase())}
                className={`period-inr-togle ${activePeriod?.toLowerCase() === p.toLowerCase() ? "active" : ""}`}
            >
                {p}
            </button>
        ))}
    </div>
);
