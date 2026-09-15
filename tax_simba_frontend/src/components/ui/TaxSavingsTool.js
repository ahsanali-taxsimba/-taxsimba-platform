"use client";
import React, { useState } from "react";
import { Card, Input, ResultRow } from "./Base";
import { motion } from "framer-motion";
import Form from 'react-bootstrap/Form';

export const TaxSavingsTool = ({ totalTax }) => {
    const [targetDate, setTargetDate] = useState("");
    const [showPlan, setShowPlan] = useState(false);

    // Calculate days remaining
    const getDaysRemaining = () => {
        if (!targetDate) return 0;
        const now = new Date();
        const target = new Date(targetDate);
        const diff = target - now;
        return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
    };

    const daysRem = getDaysRemaining();
    const dailySave = daysRem > 0 ? totalTax / daysRem : 0;

    return (
        <div className="tax-savings-tool p-4">
            <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                🎯 Tax Savings Plan
            </h3>
            <p className="text-sm mb-6">
                Planning ahead? Enter your tax payment deadline to see how much you should set aside.
            </p>

            <div className="mb-6 common-form">
                <label className="block text-sm font-medium mb-2">Payment Deadline</label>
                <Form.Control
                    type="date"
                    value={targetDate}
                    onChange={(e) => setTargetDate(e.target.value)}
                    className="input-field"
                />
            </div>

            {targetDate && daysRem > 0 ? (
                <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    className="space-y-3 pt-0 border-t border-white/10"
                >
                    <div className="daily-card flex justify-between items-center px-3 py-3  bg-white">
                        <div className="daily-left">
                            <p className="text-muted">Daily Goal</p>
                            <p className="text-2xl font-black text-brand-primary">£{dailySave.toFixed(2)}</p>
                        </div>
                        <div className="daily-right text-right">
                            <p className="text-muted">{daysRem} days left</p>
                            <p className="text-2xl text-brand-primary font-bold">Total: £{totalTax.toLocaleString()}</p>
                        </div>
                    </div>

                    <ResultRow label="Weekly Savings" value={daysRem >= 7 ? dailySave * 7 : totalTax} />
                    <ResultRow label="Monthly Savings" value={daysRem >= 30.44 ? dailySave * 30.44 : totalTax} />
                </motion.div>
            ) : targetDate ? (
                <p className="text-xs text-brand-accent italic text-center">Please select a future date.</p>
            ) : null}
        </div>
    );
};
