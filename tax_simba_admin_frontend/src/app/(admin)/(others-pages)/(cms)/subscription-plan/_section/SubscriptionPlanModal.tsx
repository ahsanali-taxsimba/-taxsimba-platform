"use client";

import React, { useEffect, useState } from "react";
import { Modal } from "@/components/ui/modal";
import {
    createSubscriptionPlan,
    updateSubscriptionPlan,
    type SubscriptionPlan,
} from "@/lib/cms/subscriptionPlan";

interface SubscriptionPlanModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    editingPlan: SubscriptionPlan | null;
}

const SubscriptionPlanModal: React.FC<SubscriptionPlanModalProps> = ({
    isOpen,
    onClose,
    onSuccess,
    editingPlan,
}) => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [formData, setFormData] = useState<Partial<SubscriptionPlan>>({
        name: "",
        price: 0,
        originalPrice: 0,
        currency: "GBP",
        category: "taxSimba",
        interval: "year",
        features: [],
        idealFor: [],
        benefits: [],
        description: "",
        savePercentage: 0,
        vatPercentage: 20,
        isPopular: false,
        isActive: true,
        displayOrder: 0,
    });

    const [featureInput, setFeatureInput] = useState("");
    const [idealForInput, setIdealForInput] = useState("");
    const [benefitsInput, setBenefitsInput] = useState("");

    useEffect(() => {
        if (editingPlan) {
            setFormData({
                ...editingPlan,
                features: Array.isArray(editingPlan.features) ? editingPlan.features : [],
                idealFor: Array.isArray(editingPlan.idealFor) ? editingPlan.idealFor : [],
                benefits: Array.isArray(editingPlan.benefits) ? editingPlan.benefits : [],
                vatPercentage: editingPlan.vatPercentage !== undefined ? editingPlan.vatPercentage : 20,
            });
        } else {
            setFormData({
                name: "",
                price: 0,
                originalPrice: 0,
                currency: "GBP",
                category: "taxSimba",
                interval: "year",
                features: [],
                idealFor: [],
                benefits: [],
                description: "",
                savePercentage: 0,
                vatPercentage: 20,
                isPopular: false,
                isActive: true,
                displayOrder: 0,
            });
        }
        setError(null);
    }, [editingPlan, isOpen]);

    useEffect(() => {
        const price = Number(formData.price) || 0;
        const originalPrice = Number(formData.originalPrice) || 0;

        if (originalPrice > 0 && originalPrice > price) {
            const percentage = Math.round(((originalPrice - price) / originalPrice) * 100);
            if (formData.savePercentage !== percentage) {
                setFormData((prev) => ({
                    ...prev,
                    savePercentage: percentage,
                }));
            }
        } else if (originalPrice <= price && formData.savePercentage !== 0) {
            setFormData((prev) => ({
                ...prev,
                savePercentage: 0,
            }));
        }
    }, [formData.price, formData.originalPrice]);

    const handleChange = (
        e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
    ) => {
        const { name, value, type } = e.target as any;
        setFormData((prev) => {
            const nextData = {
                ...prev,
                [name]:
                    type === "checkbox"
                        ? (e.target as HTMLInputElement).checked
                        : type === "number"
                            ? value === "" ? 0 : Number(value)
                            : value,
            };

            if (name === "category") {
                if (value === "mtd") {
                    nextData.interval = "month";
                } else if (value === "taxSimba") {
                    nextData.interval = "year";
                }
            }

            return nextData;
        });
    };

    const handleAddFeature = () => {
        if (featureInput.trim()) {
            setFormData((prev) => ({
                ...prev,
                features: [...(prev.features || []), featureInput.trim()],
            }));
            setFeatureInput("");
        }
    };

    const handleRemoveFeature = (index: number) => {
        setFormData((prev) => ({
            ...prev,
            features: (prev.features || []).filter((_, i) => i !== index),
        }));
    };

    const handleAddIdealFor = () => {
        if (idealForInput.trim()) {
            setFormData((prev) => ({
                ...prev,
                idealFor: [...(prev.idealFor || []), idealForInput.trim()],
            }));
            setIdealForInput("");
        }
    };

    const handleRemoveIdealFor = (index: number) => {
        setFormData((prev) => ({
            ...prev,
            idealFor: (prev.idealFor || []).filter((_, i) => i !== index),
        }));
    };

    const handleAddBenefit = () => {
        if (benefitsInput.trim()) {
            setFormData((prev) => ({
                ...prev,
                benefits: [...(prev.benefits || []), benefitsInput.trim()],
            }));
            setBenefitsInput("");
        }
    };

    const handleRemoveBenefit = (index: number) => {
        setFormData((prev) => ({
            ...prev,
            benefits: (prev.benefits || []).filter((_, i) => i !== index),
        }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            setLoading(true);
            setError(null);

            if (editingPlan) {
                await updateSubscriptionPlan(editingPlan.id, formData);
            } else {
                await createSubscriptionPlan(formData);
            }

            onSuccess();
            onClose();
        } catch (err: any) {
            setError(
                err?.response?.data?.message || err?.message || "Failed to save subscription plan"
            );
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            className="w-full max-w-lg md:max-w-2xl lg:max-w-4xl mx-4 max-h-[90vh] overflow-y-auto p-4 md:p-6 rounded-xl bg-white shadow-lg"
        >
            <div className="mb-4">
                <h2 className="text-xl font-bold">{editingPlan ? "Edit Subscription Plan" : "Add Subscription Plan"}</h2>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
                {error && (
                    <div className="rounded bg-red-50 p-2 text-sm text-red-600">
                        {error}
                    </div>
                )}

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div>
                        <label className="mb-1 block text-sm font-medium">Plan Name *</label>
                        <input
                            type="text"
                            name="name"
                            value={formData.name}
                            onChange={handleChange}
                            required
                            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-hidden focus:border-brand-500 shadow-theme-xs"
                            placeholder="e.g. Starter Plan"
                        />
                    </div>

                    <div>
                        <label className="mb-1 block text-sm font-medium">Currency</label>
                        <input
                            type="text"
                            name="currency"
                            value={formData.currency}
                            onChange={handleChange}
                            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-hidden focus:border-brand-500 shadow-theme-xs"
                            placeholder="GBP"
                        />
                    </div>

                    <div>
                        <label className="mb-1 block text-sm font-medium">Category</label>
                        <select
                            name="category"
                            value={formData.category}
                            onChange={handleChange}
                            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-hidden focus:border-brand-500 shadow-theme-xs"
                        >
                            <option value="taxSimba">Tax Simba</option>
                            <option value="mtd">MTD</option>
                        </select>
                    </div>

                    <div>
                        <label className="mb-1 block text-sm font-medium">Interval</label>
                        <select
                            name="interval"
                            value={formData.interval || "year"}
                            onChange={handleChange}
                            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-hidden focus:border-brand-500 shadow-theme-xs"
                        >
                            <option value="month">Monthly</option>
                            <option value="year">Yearly</option>
                        </select>
                    </div>

                    <div>
                        <label className="mb-1 block text-sm font-medium">Price *</label>
                        <input
                            type="number"
                            name="price"
                            value={formData.price}
                            onChange={handleChange}
                            required
                            step="0.01"
                            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-hidden focus:border-brand-500 shadow-theme-xs"
                        />
                    </div>

                    <div>
                        <label className="mb-1 block text-sm font-medium">Original Price (for discount display)</label>
                        <input
                            type="number"
                            name="originalPrice"
                            value={formData.originalPrice || ""}
                            onChange={handleChange}
                            step="0.01"
                            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-hidden focus:border-brand-500 shadow-theme-xs"
                        />
                    </div>

                    <div>
                        <label className="mb-1 block text-sm font-medium">VAT Percentage (%)</label>
                        <input
                            type="number"
                            name="vatPercentage"
                            value={formData.vatPercentage !== undefined ? formData.vatPercentage : 20}
                            onChange={handleChange}
                            step="0.1"
                            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-hidden focus:border-brand-500 shadow-theme-xs"
                        />
                    </div>

                    <div>
                        <label className="mb-1 block text-sm font-medium text-gray-500">Save Percentage (%) (Auto-calculated)</label>
                        <input
                            type="number"
                            name="savePercentage"
                            value={formData.savePercentage}
                            readOnly
                            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-hidden bg-gray-50 text-gray-500 cursor-not-allowed shadow-theme-xs"
                        />
                    </div>

                    <div>
                        <label className="mb-1 block text-sm font-medium">Display Order</label>
                        <input
                            type="number"
                            name="displayOrder"
                            value={formData.displayOrder}
                            onChange={handleChange}
                            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-hidden focus:border-brand-500 shadow-theme-xs"
                        />
                    </div>
                </div>

                <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">Description</label>
                    <textarea
                        name="description"
                        value={formData.description || ""}
                        onChange={handleChange}
                        rows={3}
                        className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-hidden focus:border-brand-500 shadow-theme-xs"
                        placeholder="Brief description of the plan..."
                    />
                </div>

                {formData.category === "mtd" && (
                    <div>
                        <label className="mb-1 block text-sm font-medium text-gray-700">Ideal For</label>
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={idealForInput}
                                onChange={(e) => setIdealForInput(e.target.value)}
                                className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm outline-hidden focus:border-brand-500 shadow-theme-xs"
                                placeholder="Add target audience..."
                                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleAddIdealFor())}
                            />
                            <button
                                type="button"
                                onClick={handleAddIdealFor}
                                className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600 transition-colors bg-[#37a267]"
                            >
                                Add
                            </button>
                        </div>
                        <ul className="mt-2 space-y-1 ps-0">
                            {(formData.idealFor || []).map((item, index) => (
                                <li
                                    key={index}
                                    className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2 text-sm border border-gray-100"
                                >
                                    <span>{item}</span>
                                    <button
                                        type="button"
                                        onClick={() => handleRemoveIdealFor(index)}
                                        className="text-red-500 hover:text-red-700 font-bold"
                                    >
                                        ×
                                    </button>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}

                <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">Features</label>
                    <div className="flex gap-2">
                        <input
                            type="text"
                            value={featureInput}
                            onChange={(e) => setFeatureInput(e.target.value)}
                            className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm outline-hidden focus:border-brand-500 shadow-theme-xs"
                            placeholder="Add a feature..."
                            onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleAddFeature())}
                        />
                        <button
                            type="button"
                            onClick={handleAddFeature}
                            className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600 transition-colors bg-[#37a267]"
                        >
                            Add
                        </button>
                    </div>
                    <ul className="mt-2 space-y-1 ps-0">
                        {(formData.features || []).map((feature, index) => (
                            <li
                                key={index}
                                className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2 text-sm border border-gray-100"
                            >
                                <span>{feature}</span>
                                <button
                                    type="button"
                                    onClick={() => handleRemoveFeature(index)}
                                    className="text-red-500 hover:text-red-700 font-bold"
                                >
                                    ×
                                </button>
                            </li>
                        ))}
                    </ul>
                </div>

                {formData.category === "mtd" && (
                    <div>
                        <label className="mb-1 block text-sm font-medium text-gray-700">Benefits</label>
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={benefitsInput}
                                onChange={(e) => setBenefitsInput(e.target.value)}
                                className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm outline-hidden focus:border-brand-500 shadow-theme-xs"
                                placeholder="Add benefit..."
                                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleAddBenefit())}
                            />
                            <button
                                type="button"
                                onClick={handleAddBenefit}
                                className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600 transition-colors bg-[#37a267]"
                            >
                                Add
                            </button>
                        </div>
                        <ul className="mt-2 space-y-1 ps-0">
                            {(formData.benefits || []).map((benefit, index) => (
                                <li
                                    key={index}
                                    className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2 text-sm border border-gray-100"
                                >
                                    <span>{benefit}</span>
                                    <button
                                        type="button"
                                        onClick={() => handleRemoveBenefit(index)}
                                        className="text-red-500 hover:text-red-700 font-bold"
                                    >
                                        ×
                                    </button>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}

                <div className="flex flex-wrap items-center gap-6 pt-2">
                    <label className="relative inline-flex cursor-pointer items-center gap-3 group">
                        <div className="relative">
                            <input
                                type="checkbox"
                                name="isPopular"
                                checked={formData.isPopular}
                                onChange={handleChange}
                                className="sr-only peer"
                            />
                            <div className="h-6 w-11 rounded-full bg-gray-200 peer-checked:bg-[#37a267] transition-all duration-300 peer-focus:ring-2 peer-focus:ring-[#37a267]/20"></div>
                            <div className="absolute left-[2px] top-[2px] h-5 w-5 rounded-full bg-white transition-all duration-300 peer-checked:translate-x-full shadow-sm"></div>
                        </div>
                        <span className="text-sm font-semibold text-gray-700 group-hover:text-gray-900 transition-colors">Popular Plan</span>
                    </label>

                    <label className="relative inline-flex cursor-pointer items-center gap-3 group">
                        <div className="relative">
                            <input
                                type="checkbox"
                                name="isActive"
                                checked={formData.isActive}
                                onChange={handleChange}
                                className="sr-only peer"
                            />
                            <div className="h-6 w-11 rounded-full bg-gray-200 peer-checked:bg-[#37a267] transition-all duration-300 peer-focus:ring-2 peer-focus:ring-[#37a267]/20"></div>
                            <div className="absolute left-[2px] top-[2px] h-5 w-5 rounded-full bg-white transition-all duration-300 peer-checked:translate-x-full shadow-sm"></div>
                        </div>
                        <span className="text-sm font-semibold text-gray-700 group-hover:text-gray-900 transition-colors">Active Status</span>
                    </label>
                </div>

                <div className="mt-6 flex justify-end gap-3 border-t pt-4">
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        disabled={loading}
                        className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-50 transition-colors bg-[#37a267]"
                    >
                        {loading ? "Saving..." : editingPlan ? "Update Plan" : "Create Plan"}
                    </button>
                </div>
            </form>
        </Modal>
    );
};

export default SubscriptionPlanModal;
