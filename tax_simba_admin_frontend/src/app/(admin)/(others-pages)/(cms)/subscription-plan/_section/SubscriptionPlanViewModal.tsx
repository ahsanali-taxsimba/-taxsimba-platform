"use client";

import React from "react";
import { Modal } from "@/components/ui/modal";
import { type SubscriptionPlan } from "@/lib/cms/subscriptionPlan";
import { Check } from "lucide-react";

interface SubscriptionPlanViewModalProps {
    isOpen: boolean;
    onClose: () => void;
    plan: SubscriptionPlan | null;
}

const getCurrencySymbol = (currency: string) => {
    if (!currency) return "£";
    try {
        const parts = new Intl.NumberFormat("en-GB", {
            style: "currency",
            currency: currency.toUpperCase(),
        }).formatToParts(0);
        return parts.find((p) => p.type === "currency")?.value || currency;
    } catch (e) {
        return currency;
    }
};

const SubscriptionPlanViewModal: React.FC<SubscriptionPlanViewModalProps> = ({
    isOpen,
    onClose,
    plan,
}) => {
    if (!plan) return null;

    return (
        <Modal isOpen={isOpen} onClose={onClose} className="w-full max-w-lg md:max-w-2xl lg:max-w-4xl mx-4 max-h-[90vh] overflow-y-auto p-4 md:p-6 rounded-xl bg-white shadow-lg">
            <div className="mb-6 flex items-center justify-between">
                <div>
                    <h2 className="text-xl font-bold text-gray-900">Subscription Plan Details</h2>
                    <p className="text-sm text-gray-500 mt-1">View the details of the selected subscription plan.</p>
                </div>
            </div>

            <div className="space-y-6">
                {/* Header Information */}
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between rounded-xl bg-gray-50 lg:p-5 p-3 border border-gray-100">
                    <div>
                        <div className="flex items-center flex-wrap lg:flex-nowrap gap-3 mb-2">
                            <h3 className="text-2xl font-bold text-gray-900">{plan.name}</h3>
                            {plan.isPopular && (
                                <span className="rounded-full bg-orange-100 px-2.5 py-0.5 text-xs font-bold text-orange-600">
                                    POPULAR
                                </span>
                            )}
                            <span
                                className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                                    plan.isActive
                                        ? "bg-green-100 text-green-700"
                                        : "bg-gray-200 text-gray-700"
                                }`}
                            >
                                {plan.isActive ? "Active" : "Inactive"}
                            </span>
                        </div>
                        <div className="flex gap-2 text-sm text-gray-600">
                            <span className="font-medium bg-gray-200 px-2 py-0.5 rounded text-gray-700">
                                {plan.category === "mtd" ? "MTD" : "Tax Simba"}
                            </span>
                        </div>
                    </div>
                    <div className="text-left sm:text-right">
                        <div className="flex items-baseline gap-2 sm:justify-end">
                            <span className="text-3xl font-extrabold text-gray-900">
                                {getCurrencySymbol(plan.currency)}
                                {plan.price}
                            </span>
                            <span className="text-gray-500">/{plan.interval || "month"}</span>
                        </div>
                        {plan.originalPrice && plan.originalPrice > plan.price && (
                            <div className="text-sm text-gray-500 line-through mt-1">
                                {getCurrencySymbol(plan.currency)}
                                {plan.originalPrice}
                            </div>
                        )}
                        {plan.savePercentage > 0 && (
                            <div className="text-sm font-semibold text-green-600 mt-1">
                                Save {plan.savePercentage}%
                            </div>
                        )}
                    </div>
                </div>

                {/* Additional Details */}
                {plan.description && (
                    <div>
                        <h4 className="text-sm font-semibold text-gray-900 mb-2">Description</h4>
                        <p className="text-sm text-gray-700 whitespace-pre-wrap rounded-lg bg-gray-50 p-4 border border-gray-100">
                            {plan.description}
                        </p>
                    </div>
                )}

                {/* Ideal For */}
                {plan.category === "mtd" && (
                    <div>
                        <h4 className="text-sm font-semibold text-gray-900 mb-3">Ideal For</h4>
                        {plan.idealFor && plan.idealFor.length > 0 ? (
                            <ul className="grid grid-cols-1 md:grid-cols-2 gap-3 ps-0">
                                {plan.idealFor.map((item, index) => (
                                    <li key={index} className="flex items-start gap-2 text-sm text-gray-700">
                                        <div className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-green-600" />
                                        <span>{item}</span>
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <p className="text-sm text-gray-500 italic">No target audience listed for this plan.</p>
                        )}
                    </div>
                )}

                {/* Features */}
                <div>
                    <h4 className="text-sm font-semibold text-gray-900 mb-3">Features Included</h4>
                    {plan.features && plan.features.length > 0 ? (
                        <ul className="grid grid-cols-1 md:grid-cols-2 gap-3 ps-0">
                            {plan.features.map((feature, index) => (
                                <li key={index} className="flex items-start gap-2 text-sm text-gray-700">
                                    <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-green-100 text-green-600">
                                        <Check size={12} strokeWidth={3} />
                                    </div>
                                    <span>{feature}</span>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <p className="text-sm text-gray-500 italic">No features listed for this plan.</p>
                    )}
                </div>

                {/* Benefits */}
                {plan.category === "mtd" && (
                    <div>
                        <h4 className="text-sm font-semibold text-gray-900 mb-3">Benefits</h4>
                        {plan.benefits && plan.benefits.length > 0 ? (
                            <ul className="grid grid-cols-1 md:grid-cols-2 gap-3 ps-0">
                                {plan.benefits.map((benefit, index) => (
                                    <li key={index} className="flex items-start gap-2 text-sm text-gray-700">
                                        <div className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-green-600" />
                                        <span>{benefit}</span>
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <p className="text-sm text-gray-500 italic">No benefits listed for this plan.</p>
                        )}
                    </div>
                )}

                {/* Metadata Details */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-gray-100">
                    <div>
                        <span className="block text-xs font-medium text-gray-500">Display Order</span>
                        <span className="text-sm font-medium text-gray-900">{plan.displayOrder}</span>
                    </div>
                    <div>
                        <span className="block text-xs font-medium text-gray-500">ID</span>
                        <span className="text-sm font-medium text-gray-900">{plan.id}</span>
                    </div>
                    <div>
                        <span className="block text-xs font-medium text-gray-500">Created At</span>
                        <span className="text-sm font-medium text-gray-900">
                            {plan.createdAt ? new Date(plan.createdAt).toLocaleString("en-GB") : "N/A"}
                        </span>
                    </div>
                    <div>
                        <span className="block text-xs font-medium text-gray-500">Last Updated</span>
                        <span className="text-sm font-medium text-gray-900">
                            {plan.updatedAt ? new Date(plan.updatedAt).toLocaleString("en-GB") : "N/A"}
                        </span>
                    </div>
                </div>

                <div className="mt-6 flex justify-end border-t border-gray-100 pt-4">
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 transition-colors"
                    >
                        Close
                    </button>
                </div>
            </div>
        </Modal>
    );
};

export default SubscriptionPlanViewModal;
