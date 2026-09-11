"use client";

import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import { Modal } from "@/components/ui/modal";
import ConfirmationModal from "@/components/ConfirmationModal";
import { PencilIcon, TrashBinIcon } from "@/icons";
import clientAxios from "@/lib/axios-client";
import { getDefaultTaxSettings } from "@/lib/tax-data-defaults";
import React, { useEffect, useState } from "react";
import "react-datepicker/dist/react-datepicker.css";
import {
    FaCalendarAlt,
    FaCheck,
    FaChevronDown, FaChevronUp,
    FaCopy,
    FaEdit,
    FaExternalLinkAlt,
    FaInfoCircle,
    FaPencilAlt,
    FaPlus,
    FaQuestionCircle,
    FaSave, FaTimes,
    FaTrash,
    FaTrashAlt
} from "react-icons/fa";
import { FaPencil } from "react-icons/fa6";
import ReactPaginate from "react-paginate";
import { toast } from "react-toastify";

interface TaxRateSetting {
    id: number;
    country: string;
    taxYear: string;
    settings: any;
    isActive: boolean;
    updatedAt: string;
}

const DEFAULT_SETTINGS_TEMPLATE = getDefaultTaxSettings("2025-2026");
const DEFAULT_YEAR = Math.max(2026, new Date().getFullYear()).toString();
const ITEMS_PER_PAGE = 10;

// ─── Tooltip Component ────────────────────────────────────────────────────────
const Tooltip = ({ text }: { text: string }) => {
    const [show, setShow] = useState(false);
    return (
        <span className="relative inline-flex items-center" onMouseEnter={() => setShow(true)} onMouseLeave={() => setShow(false)}>
            <FaQuestionCircle className="text-blue-400 cursor-help ml-1" size={11} />
            {show && (
                <div className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 w-56 bg-gray-900 text-white text-[11px] rounded-lg px-3 py-2 shadow-xl leading-relaxed">
                    {text}
                    <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900" />
                </div>
            )}
        </span>
    );
};

// ─── Accordion Section Component ─────────────────────────────────────────────
const Section = ({
    title, subtitle, color, icon, children, defaultOpen = false, isComplete = false
}: {
    title: string; subtitle: string; color: string; icon: React.ReactNode;
    children: React.ReactNode; defaultOpen?: boolean; isComplete?: boolean;
}) => {
    const [open, setOpen] = useState(defaultOpen);
    return (
        <div className={`rounded-2xl border-2 transition-all duration-300 overflow-hidden ${open ? `border-${color}-200 shadow-md` : "border-gray-100"}`}>
            <button
                type="button"
                onClick={() => setOpen(!open)}
                className={`w-full flex items-center justify-between p-2 lg:px-5 lg:py-4 text-left transition-colors ${open ? `bg-${color}-50` : "bg-white hover:bg-gray-50"}`}
            >
                <div className="flex items-center gap-3">
                    <div className={`h-8 w-8 rounded-lg flex items-center justify-center text-white bg-${color}-500 shadow-sm`}>
                        {icon}
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <div className="text-sm lg:text-2xl font-bold mb-0 text-gray-900">{title}</div>
                            {isComplete && <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-bold"><FaCheck size={8} /> Done</span>}
                        </div>
                        <p className="text-[11px] text-gray-400 mb-0">{subtitle}</p>
                    </div>
                </div>
                {open ? <FaChevronUp className="text-gray-400" size={12} /> : <FaChevronDown className="text-gray-400" size={12} />}
            </button>
            {open && <div className="px-5 pb-5 pt-3 bg-white border-t border-gray-100">{children}</div>}
        </div>
    );
};

// ─── Field Helper ─────────────────────────────────────────────────────────────
const FieldGroup = ({ label, help, tooltip, prefix, suffix, children }: {
    label: string; help?: string; tooltip?: string;
    prefix?: string; suffix?: string; children: React.ReactNode;
}) => (
    <div className="space-y-1.5">
        <div className="flex items-center gap-1">
            <label className="text-[11px] font-bold text-gray-700 uppercase tracking-wide">{label}</label>
            {tooltip && <Tooltip text={tooltip} />}
        </div>
        <div className="relative flex items-center">
            {prefix && <span className="absolute left-3 text-sm font-bold text-gray-400">{prefix}</span>}
            <div className={`w-full ${prefix ? "pl-7" : ""} ${suffix ? "pr-9" : ""}`}>{children}</div>
            {suffix && <span className="absolute right-3 text-sm font-bold text-gray-400">{suffix}</span>}
        </div>
        {help && <p className="text-[10px] text-gray-400">{help}</p>}
    </div>
);

const TaxRatesManagement: React.FC = () => {
    const [taxRates, setTaxRates] = useState<TaxRateSetting[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [showModal, setShowModal] = useState(false);
    const [editingRate, setEditingRate] = useState<TaxRateSetting | null>(null);
    const [saving, setSaving] = useState(false);
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [currentPage, setCurrentPage] = useState(0);

    // Delete modal state
    const [deleteModalOpen, setDeleteModalOpen] = useState(false);
    const [rateToDelete, setRateToDelete] = useState<number | null>(null);

    const pageCount = Math.ceil(taxRates.length / ITEMS_PER_PAGE);
    const paginatedRates = taxRates.slice(
        currentPage * ITEMS_PER_PAGE,
        (currentPage + 1) * ITEMS_PER_PAGE
    );

    // The current settings object we are editing
    const [currentSettings, setCurrentSettings] = useState<any>(JSON.parse(JSON.stringify(DEFAULT_SETTINGS_TEMPLATE)));
    const [taxYear, setTaxYear] = useState(DEFAULT_YEAR);
    const [isActive, setIsActive] = useState(true);

    // ─── Form Helpers ─────────────────────────────────────────────────────────
    const getNestedSetting = (path: string, defaultValue: any = undefined) => {
        const val = path.split('.').reduce((obj, key) => obj?.[key], currentSettings);
        return val ?? defaultValue;
    };

    const updateNestedSetting = (path: string, value: any) => {
        setCurrentSettings((prev: any) => {
            const next = { ...prev };
            const keys = path.split('.');
            let current = next;

            for (let i = 0; i < keys.length - 1; i++) {
                const key = keys[i];
                if (!current[key] || typeof current[key] !== 'object') {
                    current[key] = {};
                } else {
                    // Clone intermediate object to maintain immutability
                    current[key] = { ...current[key] };
                }
                current = current[key];
            }

            current[keys[keys.length - 1]] = value;
            return next;
        });

        // Clear error when field changes
        if (errors[path]) {
            setErrors((prev: any) => {
                const next = { ...prev };
                delete next[path];
                return next;
            });
        }
    };

    const getRateAsPercent = (path: string) => {
        const val = getNestedSetting(path);
        return val !== undefined ? Number((val * 100).toFixed(2)) : 0;
    };

    const setRateFromPercent = (path: string, percent: number) => {
        updateNestedSetting(path, percent / 100);
    };

    const MoneyInput = ({ path, label, tooltip, help }: { path: string; label: string; tooltip?: string; help?: string }) => (
        <FieldGroup label={label} tooltip={tooltip} help={help} prefix="£">
            <input
                type="number"
                value={getNestedSetting(path) ?? 0}
                onChange={(e) => updateNestedSetting(path, Number(e.target.value))}
                className="w-full bg-white border border-gray-200 rounded-xl px-4 py-2.5 text-sm font-bold text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all placeholder:text-gray-400"
            />
        </FieldGroup>
    );

    const PercentInput = ({ path, label, tooltip, help, step = "0.01" }: {
        path: string; label: string; tooltip?: string; help?: string; step?: string;
    }) => (
        <FieldGroup label={label} tooltip={tooltip} help={help} suffix="%">
            <input
                type="number"
                step={step}
                value={getRateAsPercent(path)}
                onChange={(e) => setRateFromPercent(path, Number(e.target.value))}
                className="w-full bg-white border border-gray-200 rounded-xl px-4 py-2.5 text-sm font-bold text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all placeholder:text-gray-400"
            />
        </FieldGroup>
    );

    const fetchTaxRates = async () => {
        try {
            setLoading(true);
            const res = await clientAxios.get("/admin/tax-rates");
            if (res.data?.success) {
                setTaxRates(res.data.data || []);
            }
        } catch (err: any) {
            setError(err.response?.data?.message || "Failed to fetch tax rates");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchTaxRates();
    }, []);

    // Prefill/Merge settings when tax year changes
    useEffect(() => {
        if (showModal && taxYear.length === 4) {
            const formattedYear = `${taxYear}-${Number(taxYear) + 1}`;
            const defaults = getDefaultTaxSettings(formattedYear);

            // If we are creating NEW (not editing), reset if template differs
            if (!editingRate) {
                setCurrentSettings(defaults);
            }
        }
    }, [taxYear, showModal, editingRate]);

    const handleOpenAddModal = () => {
        setEditingRate(null);
        setTaxYear(DEFAULT_YEAR);
        setCurrentSettings(JSON.parse(JSON.stringify(DEFAULT_SETTINGS_TEMPLATE)));
        setIsActive(true);
        setErrors({});
        setShowModal(true);
    };

    const handleEditRate = (rate: TaxRateSetting) => {
        setEditingRate(rate);
        setTaxYear(rate.taxYear.split("-")[0]);
        // Handle case where settings might already be an object or a JSON string
        const settingsObj = typeof rate.settings === 'string'
            ? JSON.parse(rate.settings)
            : rate.settings;
        setCurrentSettings(settingsObj);
        setIsActive(rate.isActive);
        setErrors({});
        setShowModal(true);
    };

    const handleCloseModal = () => {
        setShowModal(false);
        setEditingRate(null);
        setErrors({});
    };

    const handleCopyPreviousYear = () => {
        if (taxRates.length === 0) return;

        // Sort by year descending and get the latest
        const sorted = [...taxRates].sort((a, b) => b.taxYear.localeCompare(a.taxYear));
        const latest = sorted[0];

        if (latest) {
            try {
                const settings = typeof latest.settings === 'string'
                    ? JSON.parse(latest.settings)
                    : latest.settings;
                setCurrentSettings(settings);
            } catch (e) {
                console.error("Failed to parse latest settings", e);
            }
        }
    };

    const validateForm = () => {
        const newErrors: Record<string, string> = {};
        if (!taxYear || taxYear.length !== 4) newErrors.taxYear = "Please enter a valid 4-digit year (e.g. 2025)";

        // Basic requirement: Personal Allowance should be positive
        if (getNestedSetting("personalAllowance", 0) <= 0) {
            newErrors["personalAllowance"] = "Personal Allowance must be a positive number";
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSaveTaxRate = async () => {
        if (!validateForm()) return;

        setSaving(true);
        try {
            const formattedYear = `${taxYear}-${Number(taxYear) + 1}`;
            const dataToSave = {
                country: "UK",
                taxYear: formattedYear,
                settings: currentSettings, // Send as object, backend handles JSON conversion via Sequelize
                isActive
            };

            if (editingRate) {
                const res = await clientAxios.put(`/admin/tax-rates/${editingRate.id}`, dataToSave);
                if (res.data?.success) {
                    toast.success(res.data?.message || "Tax rules updated successfully");
                    await fetchTaxRates();
                    handleCloseModal();
                }
            } else {
                const res = await clientAxios.post("/admin/tax-rates", dataToSave);
                if (res.data?.success) {
                    toast.success(res.data?.message || "Tax rules saved successfully");
                    await fetchTaxRates();
                    handleCloseModal();
                }
            }
        } catch (err: any) {
            const errorMsg = err.response?.data?.message || "Failed to save tax rate";
            setError(errorMsg);
            toast.error(errorMsg);
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteRate = (id: number) => {
        setRateToDelete(id);
        setDeleteModalOpen(true);
    };

    const confirmDeleteRate = async () => {
        if (!rateToDelete) return;
        try {
            const res = await clientAxios.delete(`/admin/tax-rates/${rateToDelete}`);
            if (res.data?.success) {
                toast.success(res.data?.message || "Tax year configuration deleted successfully");
                fetchTaxRates();
            }
        } catch (err: any) {
            const errorMsg = err.response?.data?.message || "Failed to delete tax rate";
            setError(errorMsg);
            toast.error(errorMsg);
        } finally {
            setDeleteModalOpen(false);
            setRateToDelete(null);
        }
    };

    const EditableBandList = ({ title, path, color, unit = "£", isLimit = true }: { title: string, path: string, color: string, unit?: string, isLimit?: boolean }) => {
        const bands = getNestedSetting(path, []);

        const updateBand = (index: number, field: string, value: any) => {
            const newBands = [...bands];
            newBands[index] = { ...newBands[index], [field]: value };
            updateNestedSetting(path, newBands);
        };

        const addBand = () => {
            const newBands = [...bands, { name: "New Band", limit: Infinity, threshold: Infinity, rate: 0 }];
            updateNestedSetting(path, newBands);
        };

        const removeBand = (index: number) => {
            const newBands = bands.filter((_: any, i: number) => i !== index);
            updateNestedSetting(path, newBands);
        };

        return (
            <div className="p-6 bg-white border border-gray-100 rounded-2xl shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-gray-900 uppercase tracking-wider flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full bg-${color}-600`}></div>
                        {title}
                    </h4>
                    <button type="button" onClick={addBand} className="p-1 px-2 bg-blue-50 text-blue-600 rounded-lg text-[10px] font-bold uppercase hover:bg-blue-100 transition-colors flex items-center gap-1">
                        <FaPlus size={8} /> Add
                    </button>
                </div>
                <div className="space-y-3">
                    {bands.map((band: any, i: number) => (
                        <div key={i} className="grid grid-cols-12 gap-3 items-center p-3 bg-gray-50 rounded-xl border border-gray-100">
                            <div className="col-span-4">
                                <input
                                    type="text"
                                    value={band.name || `Band ${i + 1}`}
                                    placeholder="Name"
                                    onChange={(e) => updateBand(i, "name", e.target.value)}
                                    className="w-full bg-transparent border-none p-0 text-[11px] font-bold text-gray-900 uppercase focus:ring-0"
                                />
                            </div>
                            <div className="col-span-4 flex items-center gap-1">
                                <span className="text-[10px] text-gray-400 font-bold">{unit}</span>
                                <input
                                    type="text"
                                    value={(() => {
                                        const val = band[isLimit ? 'limit' : 'threshold'];
                                        return (val === Infinity || val === "Infinity" || val === null) ? "Unlimited" : val;
                                    })()}
                                    placeholder="Amount or Unlimited"
                                    onChange={(e) => {
                                        const raw = e.target.value.toLowerCase().trim();
                                        const val = (raw === "unlimited" || raw === "infinity" || raw === "max") ? Infinity : Number(e.target.value);
                                        updateBand(i, isLimit ? "limit" : "threshold", val);
                                    }}
                                    className="w-full bg-white border border-gray-200 rounded-lg px-2 py-1 text-[10px] font-bold text-gray-900 focus:ring-1 focus:ring-blue-500"
                                />
                            </div>
                            <div className="col-span-3 flex items-center gap-1">
                                <input
                                    type="number"
                                    step="0.01"
                                    value={band.rate}
                                    onChange={(e) => updateBand(i, "rate", Number(e.target.value))}
                                    className="w-full bg-white border border-gray-200 rounded-lg px-2 py-1 text-[10px] font-bold text-gray-900 focus:ring-1 focus:ring-blue-500"
                                />
                                <span className="text-[10px] text-gray-400 font-bold">%</span>
                            </div>
                            <div className="col-span-1 flex justify-end">
                                <button type="button" onClick={() => removeBand(i)} className="text-red-400 hover:text-red-600 transition-colors">
                                    <FaTrash size={10} />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        );
    };


    return (
        <div className="p-4 px-3 mx-auto max-w-(--breakpoint-2xl) md:p-6">
            <PageBreadcrumb
                pageTitle="Tax Rates Management"
                parentPage="Dashboard"
                parentPageUrl="/overview"
            />

            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
                <div>
                    <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">Tax Rates</h1>
                    <p className="mt-1 text-sm text-gray-500">Manage and configure tax rates for different countries and years.</p>
                </div>
                <button onClick={handleOpenAddModal} className="bg-green text-white flex items-center space-x-2 px-4 py-3 refresh-btn rounded-lg transition-colors">
                    <FaPlus className="mr-2" /> Add Tax Year rules
                </button>
            </div>

            {error && (
                <div className="mb-6 bg-red-50 border-l-4 border-red-500 rounded-r-lg p-4 flex justify-between items-center shadow-sm animate-in fade-in slide-in-from-top-4 duration-300">
                    <div className="flex items-center">
                        <div className="flex-shrink-0">
                            <FaTimes className="h-4 w-4 text-red-500" />
                        </div>
                        <p className="ml-3 text-sm font-medium text-red-800">{error}</p>
                    </div>
                    <button onClick={() => setError(null)} className="text-red-400 hover:text-red-500 transition-colors">
                        <FaTimes className="h-4 w-4" />
                    </button>
                </div>
            )}

            {/* ─── Info Banner ────────────────────────────────────────────────────────── */}
            <div className="mb-8 bg-green-50 border border-green-100 rounded-2xl p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 shadow-sm">
                <div className="flex items-start gap-4">
                    <div className="h-12 w-12 min-w-12 rounded-xl bg-green-700 flex items-center justify-center text-white shadow-lg shadow-blue-200">
                        <FaInfoCircle size={24} />
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-green-900">Setting up Tax Year Rules</h3>
                        <p className="text-sm text-green-700 mt-1 mb-0 max-w-2xl leading-relaxed">
                            Use this section to configure tax bands, allowances, and rates for upcoming tax years.
                            Always refer to official <a href="https://www.gov.uk/government/collections/tax-rates-and-allowances" target="_blank" rel="noopener noreferrer" className="font-bold text-green underline decoration-2 underline-offset-2 flex-inline items-center gap-1">HMRC guidance <FaExternalLinkAlt size={10} className="inline ml-0.5" /></a> when updating these values.
                        </p>
                    </div>
                </div>
            </div>
            <div className="space-y-6">
                <div className="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03]">
                    <div className="p-4 border-t border-gray-100 dark:border-gray-800 sm:p-6">
                        <div className="space-y-6">
                            <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-white/[0.05] dark:bg-white/[0.03]">
                                <div className="max-w-full overflow-x-auto scrollbar-custom">
                                    <div className="min-w-[1102px]">
                                        <div className="overflow-x-auto">
                                            <table className="min-w-full divide-y divide-gray-100">
                                                <thead className="border-b border-gray-100 dark:border-white/[0.05]">
                                                    <tr>
                                                        <th className="px-6 py-4 text-left text-[10px] font-bold text-gray-400 uppercase tracking-widest">Country</th>
                                                        <th className="px-6 py-4 text-left text-[10px] font-bold text-gray-400 uppercase tracking-widest">Tax Year</th>
                                                        <th className="px-6 py-4 text-left text-[10px] font-bold text-gray-400 uppercase tracking-widest">Status</th>
                                                        <th className="px-6 py-4 text-left text-[10px] font-bold text-gray-400 uppercase tracking-widest text-nowrap">Last Modified</th>
                                                        <th className="px-6 py-4 text-right text-[10px] font-bold text-gray-400 uppercase tracking-widest">Actions</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="bg-white divide-y divide-gray-100">
                                                    {paginatedRates.map((rate) => (
                                                        <tr key={rate.id} className="hover:bg-gray-50/50 dark:hover:bg-white/[0.02] transition-colors group">
                                                            <td className="px-6 py-4 whitespace-nowrap">
                                                                <div className="flex items-center gap-3">
                                                                    <div className="w-8 h-8 rounded-full bg-green-50 flex items-center justify-center text-green-600 font-bold text-xs border border-green-100">
                                                                        {rate.country}
                                                                    </div>
                                                                    <span className="text-sm font-bold text-gray-900 uppercase">{rate.country}</span>
                                                                </div>
                                                            </td>
                                                            <td className="px-6 py-4 whitespace-nowrap">
                                                                <div className="flex items-center gap-2 text-sm font-bold text-gray-700">
                                                                    <FaCalendarAlt className="text-green-700" size={14} />
                                                                    {rate.taxYear}
                                                                </div>
                                                            </td>
                                                            <td className="px-6 py-4 whitespace-nowrap">
                                                                <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${rate.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
                                                                    {rate.isActive ? 'Live' : 'Draft'}
                                                                </span>
                                                            </td>
                                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400 font-medium">
                                                                {new Date(rate.updatedAt).toLocaleDateString()}
                                                            </td>
                                                            <td className="px-6 py-4 whitespace-nowrap text-right">
                                                                <div className="flex  gap-2">
                                                                    <button
                                                                        onClick={() => handleEditRate(rate)}
                                                                        className="w-auto inline-flex items-center px-3 py-2 justify-center gap-0 !rounded-full font-medium w-full text-sm bg-brand-50 text-brand-500 dark:bg-brand-500/15 dark:text-brand-400 cursor-pointer"
                                                                        title="Edit rules"
                                                                    >
                                                                        <PencilIcon className="me-1" /> Edit
                                                                    </button>
                                                                    <button
                                                                        onClick={() => handleDeleteRate(rate.id)}
                                                                        className="w-auto inline-flex items-center px-3 py-2 justify-center gap-0 !rounded-full font-medium w-full text-sm bg-error-50 text-error-600 dark:bg-error-500/15 dark:text-error-500 cursor-pointer"
                                                                        title="Delete year"
                                                                    >
                                                                        <TrashBinIcon className="me-1" /> Delete
                                                                    </button>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                    {taxRates.length === 0 && !loading && (
                                                        <tr>
                                                            <td colSpan={5} className="px-6 py-12 text-center">
                                                                <div className="flex flex-col items-center">
                                                                    <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-4 border-2 border-dashed border-gray-200">
                                                                        <FaInfoCircle className="text-gray-300" size={24} />
                                                                    </div>
                                                                    <p className="text-sm font-bold text-gray-900">No Tax Rules Added Yet</p>
                                                                    <p className="text-xs text-gray-400 mt-1 max-w-xs mx-auto">Click "Add Tax Year rules" to create your first configuration for 2026 onwards.</p>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    )}
                                                </tbody>
                                            </table>
                                        </div>

                                        {/* ─── Pagination ──────────────────────────────────────────── */}
                                        {pageCount > 1 && (
                                            <div className="px-6 py-4 border-t border-gray-100 flex items-center flex-wrap md:flex-nowrap justify-between">
                                                <p className="text-xs text-gray-400 font-medium">
                                                    Showing{" "}
                                                    <span className="font-bold text-gray-700">{currentPage * ITEMS_PER_PAGE + 1}</span>
                                                    –
                                                    <span className="font-bold text-gray-700">{Math.min((currentPage + 1) * ITEMS_PER_PAGE, taxRates.length)}</span>
                                                    {" "}of{" "}
                                                    <span className="font-bold text-gray-700">{taxRates.length}</span> records
                                                </p>
                                                <ReactPaginate
                                                    pageCount={pageCount}
                                                    pageRangeDisplayed={3}
                                                    marginPagesDisplayed={1}
                                                    onPageChange={({ selected }) => setCurrentPage(selected)}
                                                    forcePage={currentPage}
                                                    containerClassName="flex items-center gap-1"
                                                    pageClassName="flex"
                                                    pageLinkClassName="w-8 h-8 flex items-center justify-center rounded-xl text-xs font-bold text-dark hover:bg-green-50 hover:text-green-600 transition-all"
                                                    activeClassName="[&>a]:!bg-green-600 [&>a]:!text-white [&>a]:shadow-md [&>a]:shadow-green-200"
                                                    previousLabel={<span className="text-decoration-none text-xs text-green-600 font-bold px-3 h-8 flex items-center rounded-xl border border-gray-200 hover:border-green-300 hover:text-green-600 transition-all">← Prev</span>}
                                                    nextLabel={<span className="text-decoration-none text-xs text-green-600 font-bold px-3 h-8 flex items-center rounded-xl border border-gray-200 hover:border-green-300 hover:text-green-600 transition-all">Next →</span>}
                                                    previousClassName="flex"
                                                    nextClassName="flex"
                                                    disabledClassName="opacity-40 cursor-not-allowed pointer-events-none"
                                                    breakLabel={<span className="w-8 h-8 flex items-center justify-center text-xs text-gray-400">…</span>}
                                                />
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* ─── Modal Implementation ─────────────────────────────────────────────────── */}
            <Modal
                isOpen={showModal}
                onClose={handleCloseModal}
                className="max-w-4xl rounded-3xl overflow-visible p-0"
            >
                <div className="flex flex-col h-full max-h-[90vh]">
                    {/* Header */}
                    <div className="px-8 py-6 border-b border-gray-100 flex items-center justify-between sticky top-0 bg-white/80 backdrop-blur-md rounded-t-3xl z-10">
                        <div>
                            <h2 className="text-xl font-extrabold text-gray-900 tracking-tight flex items-center gap-2">
                                {editingRate ? <FaEdit className="text-[#37a267] hidden lg:inline" /> : <FaPlus className="hidden lg:inline text-[#37a267]" />}
                                {editingRate ? `Update rules for ${editingRate.taxYear}` : 'Add New Rules for Future Years'}
                            </h2>
                            <p className="text-xs font-medium text-gray-400 mt-1">Configure all bands, percentages and limits for the income tax calculator</p>
                        </div>
                        {/* <button onClick={handleCloseModal} className="p-2.5 bg-gray-50 text-gray-400 rounded-2xl hover:bg-gray-100 transition-colors">
                            <FaTimes size={14} />
                        </button> */}
                    </div>

                    {/* Content Area */}
                    <div className="overflow-y-auto px-8 py-6 space-y-6 flex-1 custom-scrollbar">
                        {/* Summary & Import */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <Section
                                title="Primary Info"
                                subtitle="Specify the starting year and country"
                                color="green"
                                icon={<FaCalendarAlt size={14} />}
                                defaultOpen={true}
                                isComplete={!!taxYear && taxYear.length === 4}
                            >
                                <div className="space-y-4 pt-1">
                                    <FieldGroup label="Tax Year Starting" tooltip="The year the rules begin (e.g., 2026 for the 2026-27 tax year).">
                                        <div className="flex items-center gap-3">
                                            <input
                                                type="number"
                                                placeholder="e.g. 2026"
                                                value={taxYear}
                                                onChange={(e) => setTaxYear(e.target.value)}
                                                className={`w-full bg-gray-50 border ${errors.taxYear ? 'border-red-400' : 'border-gray-200'} rounded-xl px-4 py-2.5 text-sm font-bold text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all placeholder:text-gray-400`}
                                            />
                                            <span className="text-sm font-bold text-gray-400 whitespace-nowrap">to {taxYear ? Number(taxYear) + 1 : "..."}</span>
                                        </div>
                                        {errors.taxYear && <p className="text-[10px] font-bold text-red-500 mt-1">{errors.taxYear}</p>}
                                    </FieldGroup>
                                    <div className="flex items-center gap-2 p-3 bg-blue-50 rounded-xl border border-blue-100">
                                        <input
                                            type="checkbox"
                                            id="isActive"
                                            checked={isActive}
                                            onChange={(e) => setIsActive(e.target.checked)}
                                            className="w-4 h-4 rounded border-blue-200 text-blue-600 focus:ring-blue-500"
                                        />
                                        <label htmlFor="isActive" className="text-xs font-bold text-blue-900 cursor-pointer select-none">Make these rules LIVE immediately</label>
                                    </div>
                                </div>
                            </Section>

                            <div className="flex flex-col gap-4">
                                <div className="flex-1 bg-green-50 rounded-2xl p-5 border border-[#37a267] flex flex-col justify-center items-center text-center shadow-sm">
                                    <div className="h-10 w-10 rounded-full bg-[#37a267] text-white flex items-center justify-center mb-3 shadow-lg shadow-[#37a267]/50">
                                        <FaCopy size={16} />
                                    </div>
                                    <h4 className="text-sm font-bold text-dark">Need a head start?</h4>
                                    <p className="text-[10px] text-[#37a267] mt-1 mb-4 leading-relaxed font-medium">Pre-fill all values from the existing latest rules and just edit the changes.</p>
                                    <button
                                        type="button"
                                        onClick={handleCopyPreviousYear}
                                        className="w-full py-2.5 bg-white text-[#37a267] border border-[#37a267] rounded-xl text-xs font-bold hover:bg-[#37a267]/10 transition-all active:scale-95 flex items-center justify-center gap-2 shadow-sm"
                                    >
                                        Copy values from last year
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Step 2: Personal Allowance */}
                        <Section
                            title="Personal Allowances"
                            subtitle="Standard allowance and income limits"
                            color="green"
                            icon={<FaQuestionCircle size={14} />}
                            isComplete={getNestedSetting("personalAllowance", 0) > 0}
                        >
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                                <MoneyInput path="personalAllowance" label="Standard Allowance" tooltip="The amount of income a person can receive before paying income tax (Default: £12,570)" />
                                <MoneyInput path="personalAllowanceThreshold" label="Personal allowance threshold" tooltip="Total annual income at which the personal allowance begins to be reduced (tapered). Default: £100,000" />
                                <MoneyInput path="blindPersonsAllowance" label="Blind Person's Allowance" tooltip="Extra allowance for registered blind people." />
                                <MoneyInput path="marriageAllowance" label="Marriage Allowance" tooltip="Amount of personal allowance that can be transferred." />
                            </div>
                        </Section>

                        {/* Step 3: Income Tax Bands */}
                        <Section
                            title="Income Tax Bands"
                            subtitle="Configure tax rates for each income level"
                            color="green"
                            icon={<FaPlus size={14} />}
                            isComplete={getNestedSetting("incomeTaxBands", [])?.length > 0}
                        >
                            <div className="space-y-4 pt-2">
                                <EditableBandList title="Standard Income bands" path="incomeTaxBands" color="indigo" />
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <MoneyInput path="savingsAllowance" label="Savings Allowance" tooltip="Amount of interest income that is tax-free." />
                                    <MoneyInput path="dividendAllowance" label="Dividend Allowance" tooltip="Amount of dividend income that is tax-free." />
                                </div>
                            </div>
                        </Section>

                        {/* Step 4: National Insurance */}
                        <Section
                            title="National Insurance"
                            subtitle="Class 1, 2 and 4 rates & thresholds"
                            color="sky"
                            icon={<FaInfoCircle size={14} />}
                            isComplete={true}
                        >
                            <div className="space-y-6 pt-2">
                                <EditableBandList title="Class 1: Employee Bands" path="niClass1" color="sky" />
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <MoneyInput path="niClass2.weeklyRate" label="Class 2: Weekly Rate" />
                                    <MoneyInput path="niClass2.threshold" label="Class 2: Threshold" />
                                </div>
                                <EditableBandList title="Class 4: Self-Employed Bands" path="niClass4" color="indigo" />
                            </div>
                        </Section>

                        {/* Step 5: Investment & Business Taxes */}
                        <Section
                            title="Investment & Business Taxes"
                            subtitle="Capital Gains, Corporation Tax and VAT"
                            color="violet"
                            icon={<FaSave size={14} />}
                            isComplete={true}
                        >
                            <div className="space-y-6 pt-2">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <MoneyInput path="cryptoAllowance" label="CGT: Annual Exemption" />
                                    <PercentInput path="stampDutyAdditionalSurcharge" label="Stamp Duty Surcharge" help="Extra rate for 2nd homes" />
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <PercentInput path="corporationTax.mainRate" label="Corp Tax: Main Rate" />
                                    <PercentInput path="corporationTax.smallRate" label="Corp Tax: Small Rate" />
                                    <MoneyInput path="corporationTax.smallProfitLimit" label="Corp Tax: Small Limit" />
                                    <MoneyInput path="corporationTax.upperLimit" label="Corp Tax: Upper Limit" />
                                </div>
                                <MoneyInput path="vatRegistrationThreshold" label="VAT: Registration Threshold" />
                            </div>
                        </Section>

                        {/* Step 6: Benefits, Reliefs & Mileage */}
                        <Section
                            title="Benefits, Reliefs & Mileage"
                            subtitle="Mileage rates, trading allowance etc."
                            color="amber"
                            icon={<FaPlus size={14} />}
                            isComplete={true}
                        >
                            <div className="space-y-6 pt-2">
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <MoneyInput path="tradingAllowance" label="Trading Allowance" />
                                    <MoneyInput path="propertyAllowance" label="Property Allowance" />
                                    <MoneyInput path="rentARoomAllowance" label="Rent-a-Room Allowance" />
                                </div>
                                <div className="space-y-4">
                                    <h5 className="text-[10px] font-extrabold text-amber-700 uppercase tracking-widest border-b border-amber-100 pb-2 text-center">Approved Mileage Rates</h5>
                                    <EditableBandList title="Cars & Vans" path="mileageRates.car" color="amber" unit="miles" isLimit={true} />
                                    <EditableBandList title="Motorcycles" path="mileageRates.motorcycle" color="orange" unit="miles" isLimit={true} />
                                    <EditableBandList title="Bicycles" path="mileageRates.bicycle" color="emerald" unit="miles" isLimit={true} />
                                </div>
                            </div>
                        </Section>

                        {/* Step 7: Loans & Family Benefits */}
                        <Section
                            title="Loans & Family Benefits"
                            subtitle="Student loan plans and child benefit thresholds"
                            color="rose"
                            icon={<FaPlus size={14} />}
                            isComplete={true}
                        >
                            <div className="space-y-6 pt-2">
                                <div className="space-y-4">
                                    <h5 className="text-[10px] font-extrabold text-rose-700 uppercase tracking-widest border-b border-rose-100 pb-2">Student Loans</h5>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                                        <div className="space-y-4">
                                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest border-b border-gray-50 pb-1">Bachelors (Plan 1, 2, 4, 5)</p>
                                            <MoneyInput path="studentLoanPlans.plan1.threshold" label="Plan 1 Threshold" />
                                            <MoneyInput path="studentLoanPlans.plan2.threshold" label="Plan 2 Threshold" />
                                            <MoneyInput path="studentLoanPlans.plan4.threshold" label="Plan 4 Threshold" />
                                            <MoneyInput path="studentLoanPlans.plan5.threshold" label="Plan 5 Threshold" />
                                        </div>
                                        <div className="space-y-4">
                                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest border-b border-gray-50 pb-1">Postgrad</p>
                                            <MoneyInput path="studentLoanPlans.postgrad.threshold" label="Postgrad Threshold" />
                                        </div>
                                    </div>
                                </div>
                                <div className="space-y-4">
                                    <h5 className="text-[10px] font-extrabold text-rose-700 uppercase tracking-widest border-b border-rose-100 pb-2">Child Benefit</h5>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <MoneyInput path="childBenefit.threshold" label="Benefit Threshold" tooltip="Income at which the charge starts" />
                                        <MoneyInput path="childBenefit.taperEnd" label="Taper End" tooltip="Income at which all benefit is repaid" />
                                        <MoneyInput path="childBenefit.firstChild" label="First Child (Weekly)" />
                                        <MoneyInput path="childBenefit.additionalChild" label="Additional Child (Weekly)" />
                                    </div>
                                </div>
                            </div>
                        </Section>
                    </div>

                    {/* Footer Actions */}
                    <div className="px-8 py-6 border-t border-gray-100 bg-gray-50/80 backdrop-blur-md sticky bottom-0 rounded-b-3xl flex items-center justify-between gap-4">
                        <button
                            type="button"
                            onClick={handleCloseModal}
                            disabled={saving}
                            className="px-6 py-3 border border-gray-200 text-sm font-bold text-gray-400 rounded-2xl hover:bg-white hover:text-gray-900 transition-all active:scale-95 disabled:opacity-50"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleSaveTaxRate}
                            disabled={saving}
                            className={`px-10 py-3 bg-[#37a267] text-white rounded-2xl text-sm font-bold shadow-xl flex items-center gap-2 hover:bg-[#37a267]/90 transition-all hover:shadow-2xl active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed`}
                        >
                            {saving ? (
                                <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            ) : (
                                <FaSave />
                            )}
                            {editingRate ? 'Update & Publish' : 'Save & Publish rules'}
                        </button>
                    </div>
                </div>
            </Modal>

            <ConfirmationModal
                isOpen={deleteModalOpen}
                onConfirm={confirmDeleteRate}
                onCancel={() => {
                    setDeleteModalOpen(false);
                    setRateToDelete(null);
                }}
                title="Delete Tax Rules"
                confirmationText="Are you sure you want to delete this tax year configuration?"
                confirmBtnText="Delete"
                isDanger={true}
            />
        </div>
    );
};

export default TaxRatesManagement;
