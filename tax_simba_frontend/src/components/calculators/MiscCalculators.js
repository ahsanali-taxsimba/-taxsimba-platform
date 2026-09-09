"use client";
import React, { useState, useRef, useEffect } from "react";
import { Card, Input, ResultRow } from "@/components/ui/Base";
import { calculatePensionTaxRelief, calculateChildBenefit, calculateLatePenalty } from "@/lib/calculators/misc-tax";
import { getTaxConstants } from "@/lib/calculators/data/tax-rates";
import Form from 'react-bootstrap/Form';

export const PensionTaxReliefCalc = ({ taxYear }) => {
    const [contribution, setContribution] = useState(1000);
    const [income, setIncome] = useState(45000);
    const [taxRate, setTaxRate] = useState(0.20);
    const [schemeType, setSchemeType] = useState("relief_at_source");
    const [isManualTaxRate, setIsManualTaxRate] = useState(false);

    useEffect(() => {
        if (!isManualTaxRate) {
            const constants = getTaxConstants(taxYear);
            const bands = constants.incomeTaxBands;
            const band = bands.find(b => income <= b.limit) || bands[bands.length - 1];
            const autoRate = band.rate === 0 ? 0.20 : band.rate;
            setTaxRate(autoRate);
        }
    }, [income, taxYear, isManualTaxRate]);

    const results = calculatePensionTaxRelief(contribution, taxRate, taxYear, schemeType);

    return (
        <Card className="flex flex-col gap-6 common-form p-6 md:p-8">
            <div className="calc-main-tabs mb-6">
                <button
                    onClick={() => setSchemeType("relief_at_source")}
                    className={`calc-tab-btn ${schemeType === "relief_at_source" ? "active" : ""}`}
                >
                    Relief at Source
                </button>
                <button
                    onClick={() => setSchemeType("net_pay")}
                    className={`calc-tab-btn ${schemeType === "net_pay" ? "active" : ""}`}
                >
                    Net Pay Scheme
                </button>
            </div>

            <div className="space-y-6 mb-2">
                <Input
                    className="mb-0 form-control"
                    label="Your Annual Income (£)"
                    value={income}
                    onChange={(val) => {
                        setIncome(Number(val));
                        setIsManualTaxRate(false);
                    }}
                />
                <Input
                    className="mb-0 form-control"
                    label="Your Contribution (£)"
                    value={contribution}
                    onChange={setContribution}
                />
            </div>

            <div className="space-y-3 mt-2">
                <label className="text-sm font-bold text-gray-700 block mb-1">Your Tax Band</label>
                <div className="calc-main-tabs flex gap-4 mb-0">
                    {[0.20, 0.40, 0.45].map((rate, i) => (
                        <button
                            key={rate}
                            onClick={() => {
                                setTaxRate(rate);
                                setIsManualTaxRate(true);
                            }}
                            className={`calc-tab-btn flex-1 ${taxRate === rate ? "active" : ""}`}
                        >
                            {rate * 100}%
                        </button>
                    ))}
                </div>
            </div>

            <div className="space-y-2 bg-brand-primary/5 p-6 rounded-3xl border border-brand-primary/10 mt-4">
                <ResultRow label="Gross Contribution" value={results.grossContribution} />
                {schemeType === "relief_at_source" ? (
                    <>
                        <ResultRow label="Basic Relief (20% Automatic)" value={results.basicRelief} />
                        {taxRate > 0.20 && (
                            <ResultRow label="Extra Relief (Claim via Return)" value={results.extraRelief} />
                        )}
                    </>
                ) : (
                    <ResultRow label="Income Tax Saved (Immediate)" value={results.totalRelief} />
                )}
                <ResultRow label="Total Relief" value={results.totalRelief} isTotal />
                <ResultRow label="Actual Cost to You" value={results.actualCost} />
            </div>

            <div className="p-4 border border-gray-100 rounded-2xl text-[10px] text-gray-400 leading-relaxed italic">
                {schemeType === "relief_at_source"
                    ? "* Relief at source: You pay into your pension from your after-tax income, and your provider claims back 20% for you."
                    : "* Net pay: Your contributions are taken before tax is calculated, so you get full relief immediately."
                }
            </div>
        </Card>
    );
};

export const ChildBenefitCalc = ({ taxYear }) => {
    const [numChildren, setNumChildren] = useState(2);
    const [userIncome, setUserIncome] = useState(45000);
    const [partnerIncome, setPartnerIncome] = useState(0);
    const [hasPartner, setHasPartner] = useState(false);
    const [isRegistered, setIsRegistered] = useState(true);

    const partnerRef = useRef(null);
    const resultsRef = useRef(null);

    const highestIncome = hasPartner ? Math.max(userIncome, partnerIncome) : userIncome;
    const results = calculateChildBenefit(numChildren, highestIncome, taxYear);
    const hasHICBC = highestIncome > 60000;

    const handlePartnerToggle = (checked) => {
        setHasPartner(checked);
        if (checked) {
            setTimeout(() => {
                partnerRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
            }, 100);
        }
    };

    const handleRegisteredToggle = (checked) => {
        setIsRegistered(checked);
        setTimeout(() => {
            resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
        }, 100);
    };

    return (
        <Card className="flex flex-col gap-8 common-form p-6 md:p-8">
            {/* Inputs */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Input
                    label="Number of Children"
                    className="mb-0 form-control"
                    placeholder="e.g. 2"
                    value={numChildren}
                    onChange={(val) => setNumChildren(Math.max(0, parseInt(val) || 0))}
                    type="number"
                />
                <Input
                    label="Your Annual Income (£)"
                    className="mb-0 form-control"
                    placeholder="e.g. 45000"
                    value={userIncome}
                    onChange={(val) => setUserIncome(parseInt(val) || 0)}
                />
            </div>

            {/* Partner checkbox */}
            <div className="space-y-4 mt-2">
                <Form.Check
                    type="checkbox"
                    id="hasPartner"
                    label="I live with a partner (calculation uses the highest earner)"
                    checked={hasPartner}
                    onChange={(e) => handlePartnerToggle(e.target.checked)}
                    className="custom-checkbox"
                />

                {hasPartner && (
                    <div ref={partnerRef} className="pl-6 pt-3 mt-2 border-t border-gray-100">
                        <Input
                            label="Partner's Annual Income (£)"
                            className="mb-0 form-control"
                            placeholder="e.g. 35000"
                            value={partnerIncome}
                            onChange={(val) => setPartnerIncome(parseInt(val) || 0)}
                        />
                    </div>
                )}
            </div>

            {/* Registration checkbox */}
            <div className="space-y-1 mt-2">
                <Form.Check
                    type="checkbox"
                    id="isRegistered"
                    label="Already registered for Child Benefit"
                    checked={isRegistered}
                    onChange={(e) => handleRegisteredToggle(e.target.checked)}
                    className="custom-checkbox"
                />
                <p className="text-xs text-gray-400 ml-6">
                    NI credits still apply even if you opt out of payments
                </p>
            </div>

            {/* Results */}
            <div ref={resultsRef} className="space-y-3 bg-brand-primary/5 p-6 rounded-3xl border border-brand-primary/10">
                <ResultRow label="Monthly Benefit" value={results.annualBenefit / 12} />
                <ResultRow label="Annual Benefit" value={results.annualBenefit} />
                {hasHICBC && (
                    <ResultRow
                        label="High Income Child Benefit Charge"
                        value={results.hichcCharge}
                    />
                )}
                <ResultRow
                    label="Net Annual Entitlement"
                    value={hasHICBC ? results.netAnnualBenefit : results.annualBenefit}
                    isTotal
                />
            </div>

            {/* Alert: HICBC */}
            {hasHICBC && (
                <div className="p-4 bg-orange-50 border border-orange-200 rounded-2xl mt-2">
                    <p className="text-sm font-semibold text-orange-800 mb-1">High Income Charge Applies</p>
                    <p className="text-xs text-orange-700 leading-relaxed">
                        As the highest earner exceeds <strong>£60,000</strong>, the High Income Child Benefit Charge applies. You may need to file a Self Assessment tax return to repay the charge.
                    </p>
                </div>
            )}

            {/* Alert: Not registered */}
            {!isRegistered && (
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-2xl mt-2">
                    <p className="text-sm font-semibold text-blue-800 mb-1">Important: Register Even If Opting Out</p>
                    <p className="text-xs text-blue-700 leading-relaxed">
                        Even if you choose not to receive payments, <strong>you should still register</strong> to protect your National Insurance credits toward your State Pension.
                    </p>
                </div>
            )}

            {/* Disclaimer */}
            <div className="p-4 border border-gray-100 rounded-2xl text-[10px] text-dark leading-relaxed italic mt-2">
                * Figures based on {taxYear} thresholds. The High Income charge applies when the highest earner's income exceeds the threshold (£60,000 for 25/26).
            </div>
        </Card>
    );
};

// ── Helper sub-components ─────────────────────────────────────────────────
const RadioGroup = ({ label, value, onChange, options }) => (
    <div className="flex flex-col gap-1 items-start">
        <label className="text-sm font-semibold text-gray-700">{label}</label>
        <div className="flex w-fit bg-gray-100 border border-gray-200 rounded-xl p-1 gap-1 mt-2">
            {options.map(opt => (
                <label
                    key={opt.value}
                    className={`flex items-center justify-center h-10 px-6 rounded-lg text-sm font-semibold cursor-pointer select-none whitespace-nowrap transition-all duration-150
                        ${value === opt.value
                            ? "bg-brand-primary text-white shadow-sm"
                            : "bg-transparent text-gray-500 hover:text-gray-700"
                        }`}
                >
                    <input
                        type="radio"
                        name={label}
                        value={opt.value}
                        checked={value === opt.value}
                        onChange={() => onChange(opt.value)}
                        className="sr-only"
                    />
                    {opt.label}
                </label>
            ))}
        </div>
    </div>
);

const DatePicker = ({ label, value, onChange, max }) => (
    <div className="space-y-1">
        <label className="text-sm font-medium text-gray-600 block">{label}</label>
        <input
            type="date"
            value={value}
            max={max}
            onChange={e => onChange(e.target.value)}
            className="form-control w-full px-4 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-brand-primary"
        />
    </div>
);

const fmt = (n) => `£${Number(n).toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const PenaltyResultRow = ({ label, amount, isTotal, isSubItem }) => (
    <div className={`flex justify-between items-center py-2 ${isTotal ? "border-t-2 border-brand-primary/30 pt-3 mt-1" : "border-t border-gray-100"} ${isSubItem ? "pl-4" : ""}`}>
        <span className={`text-sm ${isTotal ? "font-bold text-dark" : isSubItem ? "text-gray-500" : "text-gray-700"}`}>
            {isSubItem && <span className="text-gray-400 mr-1">↳</span>}{label}
        </span>
        <span className={`font-semibold tabular-nums ${isTotal ? "text-brand-primary text-base" : amount > 0 ? "text-orange-600" : "text-gray-500"}`}>
            {fmt(amount)}
        </span>
    </div>
);

// ── Main component ─────────────────────────────────────────────────────────
export const LatePenaltyCalc = ({ taxYear }) => {
    const [owesTax, setOwesTax] = useState("yes");
    const [taxDue, setTaxDue] = useState(2000);
    const [hasSubmitted, setHasSubmitted] = useState("yes");
    const [submissionDate, setSubmissionDate] = useState(() => {
        const d = new Date(); return d.toISOString().split("T")[0];
    });
    const [hasPaid, setHasPaid] = useState("no");
    const [paymentDate, setPaymentDate] = useState(() => {
        const d = new Date(); return d.toISOString().split("T")[0];
    });

    // Today's date string for max= attribute on date pickers
    const today = new Date().toISOString().split("T")[0];

    // Check if the selected tax year is still ongoing (ends 5 April of endYear)
    const endYear = parseInt(taxYear.split("-")[1], 10);
    const taxYearEndDate = new Date(endYear, 3, 5); // 5 April of end year
    const isTaxYearOngoing = new Date() < taxYearEndDate;

    const result = calculateLatePenalty({
        taxYear,
        taxDue: owesTax === "yes" ? taxDue : 0,
        submissionDate: hasSubmitted === "yes" ? new Date(submissionDate) : null,
        paymentDate: hasPaid === "yes" ? new Date(paymentDate) : null,
        owesTax: owesTax === "yes",
    });

    // Stage badge
    const stageBadge = (() => {
        const d = result.filingDaysLate;
        if (d <= 0) return null;
        if (d <= 90) return { text: "Stage 1 — Fixed penalty only", color: "blue" };
        if (d <= 180) return { text: "Stage 2 — Daily penalties accruing", color: "orange" };
        if (d <= 365) return { text: "Stage 3 — 6-month surcharge added", color: "red" };
        return { text: "Stage 4 — Maximum penalties reached", color: "red" };
    })();

    const deadlineStr = result.deadline
        ? result.deadline.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })
        : "";

    return (
        <div className="flex flex-col lg:flex-row gap-6">

            {/* ── Left: Situation ───────────────────────────────── */}
            <Card className="flex-1 flex flex-col gap-6 common-form p-6 md:p-8">
                <div>
                    <h3 className="text-base font-bold text-dark mb-1">1. Your Situation</h3>
                    {deadlineStr && (
                        <p className="text-xs text-gray-400">Filing deadline for {taxYear}: <strong>{deadlineStr}</strong></p>
                    )}
                </div>

                {/* If tax year is still ongoing, show info banner and hide questions */}
                {isTaxYearOngoing && (
                    <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl">
                        <p className="text-sm font-semibold text-blue-800 mb-1">⏳ Tax year not yet over</p>
                        <p className="text-xs text-blue-700 leading-relaxed">
                            The {taxYear} tax year runs until <strong>5 April {endYear}</strong>. You cannot file a return for this year yet — the filing deadline is <strong>{deadlineStr}</strong>. There are no penalties to calculate right now.
                        </p>
                    </div>
                )}

                {!isTaxYearOngoing && (
                    <>
                        <RadioGroup
                            label="Did you owe any tax?"
                            value={owesTax}
                            onChange={setOwesTax}
                            options={[{ value: "yes", label: "Yes" }, { value: "no", label: "No" }]}
                        />

                        {owesTax === "yes" && (
                            <Input
                                className="mb-0 form-control "
                                label="How much was your tax bill? (£)"
                                value={taxDue}
                                onChange={val => setTaxDue(Number(val))}
                            />
                        )}

                        <RadioGroup
                            label="Have you submitted your Self Assessment return?"
                            value={hasSubmitted}
                            onChange={setHasSubmitted}
                            options={[{ value: "yes", label: "Yes" }, { value: "no", label: "Not yet" }]}
                        />

                        {hasSubmitted === "yes" && (
                            <DatePicker
                                label="When did you submit it?"
                                value={submissionDate}
                                onChange={setSubmissionDate}
                                max={today}
                            />
                        )}

                        <RadioGroup
                            label="Have you paid the bill?"
                            value={hasPaid}
                            onChange={setHasPaid}
                            options={[{ value: "yes", label: "Yes" }, { value: "no", label: "Not yet" }]}
                        />

                        {hasPaid === "yes" && (
                            <DatePicker
                                label="When did you pay it?"
                                value={paymentDate}
                                onChange={setPaymentDate}
                                max={today}
                            />
                        )}
                    </>
                )}
            </Card>

            {/* ── Right: Results ────────────────────────────────── */}
            <Card className="flex-1 flex flex-col gap-4 p-6 md:p-8 bg-gray-50/60">
                <h3 className="text-base font-bold text-dark mb-1">2. Results</h3>

                {isTaxYearOngoing ? (
                    /* Tax year not over yet — no results to show */
                    <div className="p-4 bg-green-50 border border-green-200 rounded-2xl">
                        <p className="text-sm font-semibold text-green-800 mb-1">✓ You're fine.</p>
                        <p className="text-xs text-green-700 leading-relaxed">
                            The current tax year isn't over yet. The deadline is <strong>{deadlineStr}</strong>.
                            There are no penalties or interest to pay right now.
                        </p>
                    </div>
                ) : (
                    <>
                        {/* Stage badge */}
                        {stageBadge && (
                            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold
                                ${stageBadge.color === "blue" ? "bg-blue-50 text-blue-700" : ""}
                                ${stageBadge.color === "orange" ? "bg-orange-50 text-orange-700" : ""}
                                ${stageBadge.color === "red" ? "bg-red-50 text-red-700" : ""}
                            `}>
                                <span className={`w-1.5 h-1.5 rounded-full
                                    ${stageBadge.color === "blue" ? "bg-blue-400" : ""}
                                    ${stageBadge.color === "orange" ? "bg-orange-400" : ""}
                                    ${stageBadge.color === "red" ? "bg-red-400" : ""}
                                `} />
                                {stageBadge.text}
                            </span>
                        )}

                        {/* Penalty breakdown rows */}
                        <div className="space-y-0">
                            <PenaltyResultRow label="Your estimated tax bill" amount={result.taxDue} />

                            <PenaltyResultRow label="Penalty for filing late" amount={result.filingPenalty} />
                            {result.filingBreakdown.map((item, i) => (
                                <PenaltyResultRow key={i} label={item.label} amount={item.amount} isSubItem />
                            ))}

                            <PenaltyResultRow label="Penalty for paying late" amount={result.paymentPenalty + result.interest} />
                            {result.paymentBreakdown.map((item, i) => (
                                <PenaltyResultRow key={i} label={item.label} amount={item.amount} isSubItem />
                            ))}

                            <PenaltyResultRow label="How much you need to pay now" amount={result.total} isTotal />
                        </div>

                        {/* On-time banner */}
                        {result.filingDaysLate === 0 && result.paymentDaysLate === 0 && (
                            <div className="p-4 bg-green-50 border border-green-200 rounded-2xl mt-2">
                                <p className="text-sm font-semibold text-green-800">✓ No penalties apply</p>
                                <p className="text-xs text-green-700 mt-1">Your return and payment are on time — great job!</p>
                            </div>
                        )}
                    </>
                )}

                {/* Disclaimer */}
                <div className="p-4 border border-gray-100 rounded-2xl text-[10px] text-gray-400 leading-relaxed italic mt-auto">
                    * Based on HMRC Self Assessment penalty rules. HMRC interest rate used: 8.00% p.a. (BoE base rate + 4%, effective 6 April 2025). Actual amounts may differ — consult HMRC or a tax adviser for your specific situation.
                </div>
            </Card>
        </div >
    );
};

