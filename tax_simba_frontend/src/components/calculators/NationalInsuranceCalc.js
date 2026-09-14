"use client";
import React, { useState, useEffect } from "react";
import { Card, Input, ResultRow, PeriodicToggle, Accordion } from "@/components/ui/Base";
import { calculateNI, calculateIncomeTax, calculateSalaryAfterTax, calculateCombinedTax } from "@/lib/calculators/uk-tax";
import { TaxSavingsTool } from "@/components/ui/TaxSavingsTool";
import Form from 'react-bootstrap/Form';
import { TbInfoCircle, TbLamp } from "react-icons/tb";

// 1. National Insurance Calculator
export const NationalInsuranceCalc = ({ taxYear }) => {
    const [income, setIncome] = useState(40000);
    const [selfIncome, setSelfIncome] = useState(50000);
    const [selfExpenses, setSelfExpenses] = useState(5000);
    const [type, setType] = useState("employed");
    const [period, setPeriod] = useState("annual");
    const [showDetails, setShowDetails] = useState(false);

    const niResults = calculateNI(type === "employed" ? income : selfIncome, type, taxYear, { expenses: type === "employed" ? 0 : selfExpenses });
    const incomeTaxResults = type === "self-employed" ? calculateIncomeTax(selfIncome, taxYear, { type: "self-employed", expenses: selfExpenses }) : null;
    const multiplier = period === "annual" ? 1 : period === "monthly" ? 1 / 12 : period === "weekly" ? 1 / 52 : 1 / 365;

    return (
        <div className="space-y-8">
            <Card className="flex flex-col gap-6 common-form">
                <div className="calc-main-tabs flex gap-4 mb-4">
                    <button className={`calc-tab-btn ${type === "employed" ? "active" : ""}`}
                        onClick={() => setType("employed")}
                    >
                        Employed
                    </button>
                    <button className={`calc-tab-btn ${type === "self-employed" ? "active" : ""}`}
                        onClick={() => setType("self-employed")}
                    >
                        Self-Employed
                    </button>
                </div>

                {type === "employed" ? (
                    <Input className="mb-0 form-control" label="Annual Salary (£)" value={income} onChange={setIncome} />
                ) : (
                    <>
                        <Input className="mb-0 form-control" label="Annual Income (£)" value={selfIncome} onChange={setSelfIncome} />
                        <Input className="mb-0 form-control" label="Annual Expenses (£)" value={selfExpenses} onChange={setSelfExpenses} />
                        {selfExpenses < 1000 && (
                            <div className="text-[10px] text-brand-primary font-bold flex items-center gap-1 mt-1">
                                <span><TbInfoCircle className="inline-block mr-1" /> Automatically applying £1,000 Trading Allowance (more beneficial)</span>
                            </div>
                        )}
                    </>
                )}
                <PeriodicToggle activePeriod={period} onPeriodChange={setPeriod} />
                <div className="space-y-2">
                    {type === "employed" ? (
                        <ResultRow label={`${period.charAt(0).toUpperCase() + period.slice(1)} Gross`} value={income * multiplier} />
                    ) : (
                        <ResultRow label={`${period.charAt(0).toUpperCase() + period.slice(1)} Turnover`} value={selfIncome * multiplier} />
                    )}
                    <ResultRow label="NI Contribution" value={niResults.totalNI * multiplier} />
                    {type === "self-employed" && (
                        <ResultRow label="Income Tax" value={incomeTaxResults.totalTax * multiplier} />
                    )}
                    <ResultRow label="Net Take Home" value={
                        type === "employed"
                            ? (income - niResults.totalNI) * multiplier
                            : (selfIncome - selfExpenses - niResults.totalNI - (incomeTaxResults ? incomeTaxResults.totalTax : 0)) * multiplier
                    } isTotal />
                </div>

                <Accordion title="NI Band Breakdown" isOpen={showDetails} onToggle={() => setShowDetails(!showDetails)}>
                    <div className="p-6 space-y-6 bg-white/50">
                        {/* Table Header */}
                        <div className="grid grid-cols-12 gap-4 text-[11px] font-bold text-gray-500 uppercase tracking-widest border-b border-brand-primary/10 pb-3">
                            <div className="col-span-5">NI Band</div>
                            <div className="col-span-4">Rate & Range</div>
                            <div className="col-span-3 text-right">NI Amount</div>
                        </div>

                        {/* Band Rows */}
                        <div className="space-y-1">
                            {niResults.bands.map((band, i) => {
                                const rateNum = parseInt(band.rate);
                                let indicatorColor = "bg-emerald-400"; // 0%
                                if (rateNum > 0 && rateNum <= 9) indicatorColor = "bg-purple-400";
                                if (rateNum > 9 && rateNum <= 12) indicatorColor = "bg-blue-400";
                                if (rateNum > 12) indicatorColor = "bg-orange-400";

                                return (
                                    <div key={i} className="grid grid-cols-12 gap-4 items-center text-sm py-4 border-b border-gray-50 last:border-0 hover:bg-white transition-colors rounded-xl px-2">
                                        <div className="col-span-5 flex items-center gap-3">
                                            <div className={`w-1.5 h-10 rounded-full ${indicatorColor} shadow-sm`} />
                                            <span className="font-extrabold text-dark text-base">Band {i + 1}</span>
                                        </div>
                                        <div className="col-span-4 flex flex-col justify-center">
                                            <span className="font-bold text-gray-700">{band.rate}</span>
                                            <span className="text-[10px] text-gray-400 font-bold uppercase tracking-tighter">{band.range}</span>
                                        </div>
                                        <div className="col-span-3 text-right flex flex-col justify-center">
                                            <span className="font-black text-brand-primary text-lg">
                                                £{(band.niAmount * multiplier).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                            </span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </Accordion>
            </Card>

            <TaxSavingsTool totalTax={niResults.totalNI} />
        </div>
    );
};

// 2. Combined Tax Calculator
export const CombinedTaxCalc = ({ taxYear }) => {
    const [salary, setSalary] = useState(40000);
    const [profit, setProfit] = useState(10000);
    const [expenses, setExpenses] = useState(2000);

    const results = calculateCombinedTax(salary, profit, expenses, taxYear);

    return (
        <Card className="flex flex-col gap-8 common-form p-6 md:p-8">
            <div className="space-y-6">
                <div>
                    <label className="text-sm font-bold text-dark mt-2 block">Annual Salary (£)</label>
                    <Input className="mb-0 form-control" value={salary} onChange={setSalary} />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="text-sm font-bold text-dark mt-2 block">Self-Employed Income (£)</label>
                        <Input className="mb-0 form-control" value={profit} onChange={setProfit} />
                    </div>
                    <div>
                        <label className="text-sm font-bold text-dark mt-2 block">Self-employed expenses (£)</label>
                        <Input className="mb-0 form-control" value={expenses} onChange={setExpenses} />
                    </div>
                </div>
            </div>

            <div className="space-y-2 bg-brand-primary/5 p-6 rounded-3xl border border-brand-primary/10">
                <ResultRow label="Total Earnings" value={Number(salary) + Number(profit)} />
                <ResultRow label="Total Income Tax" value={results.totalIncomeTax} />
                <ResultRow label="Employee NI (Class 1)" value={results.employeeNI} />
                <ResultRow label="Self-Employed NI (Class 4)" value={results.selfEmployedNI} />
                <ResultRow label="Total Tax Payable" value={results.totalTax} />
                <ResultRow label="Net Take Home" value={results.takeHome} isTotal />
            </div>

            <div className="p-4 border border-gray-100 rounded-2xl text-[10px] text-gray-400 leading-relaxed italic mt-2">
                * This calculator estimates your combined tax liability when you have both employment and self-employment income, accounting for both Class 1 and Class 4 NI.
            </div>
        </Card>
    );
};

// 3. Salary After Tax Calculator
export const SalaryAfterTaxCalc = ({ taxYear }) => {
    const [salary, setSalary] = useState(45000);
    const [period, setPeriod] = useState("annual");
    const [showDetails, setShowDetails] = useState(false);

    const results = calculateSalaryAfterTax(salary, taxYear);
    const p = period; // shorthand

    return (
        <div className="space-y-8">
            <Card className="flex flex-col gap-6 common-form">
                <Input className="mb-0 form-control" label="Annual Salary (£)" value={salary} onChange={setSalary} />
                <PeriodicToggle activePeriod={period} onPeriodChange={setPeriod} />
                <div className="space-y-2">
                    <ResultRow label={`${p.charAt(0).toUpperCase() + p.slice(1)} Gross`} value={results.gross[p]} />
                    <ResultRow label="Income Tax" value={results.incomeTax[p]} />
                    <ResultRow label="National Insurance" value={results.ni[p]} />
                    <ResultRow label="Take Home Pay" value={results.takeHome[p]} isTotal />
                </div>

                <Accordion title="Band-by-Band Breakdown" isOpen={showDetails} onToggle={() => setShowDetails(!showDetails)}>
                    <div className="p-6 space-y-6 bg-white/50">
                        {/* Table Header */}
                        <div className="grid grid-cols-12 gap-4 text-[11px] font-bold text-gray-500 uppercase tracking-widest border-b border-brand-primary/10 pb-3">
                            <div className="col-span-5">Tax Band</div>
                            <div className="col-span-4">Rate & Range</div>
                            <div className="col-span-3 text-right">Tax Amount</div>
                        </div>

                        {/* Band Rows */}
                        <div className="space-y-1">
                            {results.taxBands.map((band, i) => {
                                const rateNum = parseInt(band.rate);
                                let indicatorColor = "bg-emerald-400"; // 0%
                                if (rateNum === 20) indicatorColor = "bg-blue-400";
                                if (rateNum === 40) indicatorColor = "bg-orange-400";
                                if (rateNum === 45) indicatorColor = "bg-red-400";

                                return (
                                    <div key={i} className="grid grid-cols-12 gap-4 items-center text-sm py-4 border-b border-gray-50 last:border-0 hover:bg-white transition-colors rounded-xl px-2">
                                        <div className="col-span-5 flex items-center gap-3">
                                            <div className={`w-1.5 h-10 rounded-full ${indicatorColor} shadow-sm`} />
                                            <span className="font-extrabold text-dark text-base">{band.name}</span>
                                        </div>
                                        <div className="col-span-4 flex flex-col justify-center">
                                            <span className="font-bold text-gray-700">{band.rate}</span>
                                            <span className="text-[10px] text-gray-400 font-bold uppercase tracking-tighter">{band.range}</span>
                                        </div>
                                        <div className="col-span-3 text-right flex flex-col justify-center">
                                            <span className="font-black text-brand-primary text-lg">
                                                £{(band.taxAmount * (p === "annual" ? 1 : p === "monthly" ? 1 / 12 : p === "weekly" ? 1 / 52 : 1 / 365)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                            </span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </Accordion>
            </Card>

            <TaxSavingsTool totalTax={results.incomeTax.annual + results.ni.annual} />
        </div>
    );
};

// 4. Income Tax Calculator (Enhanced Taxfix-style)
export const IncomeTaxCalc = ({ taxYear }) => {
    const [income, setIncome] = useState(55000);
    const [employmentMode, setEmploymentMode] = useState("employed");
    const [expenses, setExpenses] = useState(0);
    const [pension, setPension] = useState(0);
    const [studentLoanPlan, setStudentLoanPlan] = useState("none");
    const [blindPerson, setBlindPerson] = useState(false);
    const [marriageAllowance, setMarriageAllowance] = useState(false);
    const [period, setPeriod] = useState("annual");
    const [showAdvanced, setShowAdvanced] = useState(false);
    const [showDetails, setShowDetails] = useState(false);

    const res = calculateSalaryAfterTax(income, taxYear, {
        pension,
        studentLoanPlan,
        blindPerson,
        marriageAllowance,
        type: employmentMode,
        expenses
    });

    const isSelfEmployed = employmentMode === "self-employed";
    const multiplier = period === "annual" ? 1 : period === "monthly" ? 1 / 12 : period === "weekly" ? 1 / 52 : 1 / 365;

    return (
        <div className="space-y-8">
            <Card className="flex flex-col gap-8 common-form p-6 md:p-8">
                {/* Employment Type Toggle */}
                <div className="calc-main-tabs">
                    <button
                        onClick={() => setEmploymentMode("employed")}
                        className={`calc-tab-btn ${employmentMode === "employed" ? "active" : ""}`}
                    >
                        Employed
                    </button>
                    <button
                        onClick={() => setEmploymentMode("self-employed")}
                        className={`calc-tab-btn ${employmentMode === "self-employed" ? "active" : ""}`}
                    >
                        Self-Employed
                    </button>
                </div>

                <div className="space-y-6">
                    <Input
                        label={isSelfEmployed ? "Annual turnover (£)" : "Annual salary (£)"}
                        value={income}
                        onChange={setIncome}
                    />

                    {isSelfEmployed && (
                        <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                            <Input
                                label="Self-employed expenses (£)"
                                value={expenses}
                                onChange={setExpenses}
                                placeholder="e.g. 2000"
                            />
                        </div>
                    )}

                    <div className="pt-2 border-t border-gray-50">
                        <button
                            onClick={() => setShowAdvanced(!showAdvanced)}
                            className="flex items-center gap-2 text-sm font-bold text-brand-primary hover:text-brand-accent transition-colors"
                        >
                            {showAdvanced ? "− Hide extra details" : "+ Add more details (Pension, Student Loan, Allowances)"}
                        </button>
                    </div>

                    {showAdvanced && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-top-4 duration-500">
                            <Input
                                label="Pension Contributions (£)"
                                value={pension}
                                onChange={setPension}
                                placeholder="Total annual contribution"
                            />

                            <div>
                                <label className="block text-sm font-semibold mb-2 text-gray-700">Student Loan Plan</label>
                                <Form.Select
                                    value={studentLoanPlan}
                                    onChange={(e) => setStudentLoanPlan(e.target.value)}
                                    className="form-control rounded-2xl py-3 px-4 border-gray-200"
                                >
                                    <option value="none">None</option>
                                    <option value="plan1">Plan 1 (Pre-2012)</option>
                                    <option value="plan2">Plan 2 (2012 - 2023)</option>
                                    <option value="plan4">Plan 4 (Scotland)</option>
                                    <option value="plan5">Plan 5 (Post-2023)</option>
                                    <option value="postgrad">Postgraduate</option>
                                </Form.Select>
                            </div>

                            <div className="space-y-4 pt-2">
                                <Form.Check
                                    type="checkbox"
                                    id="blind-person"
                                    label="Blind Person's Allowance"
                                    checked={blindPerson}
                                    onChange={(e) => setBlindPerson(e.target.checked)}
                                    className="custom-checkbox"
                                />
                                <Form.Check
                                    type="checkbox"
                                    id="marriage-allowance"
                                    label="Marriage Allowance (Are you receiving?)"
                                    checked={marriageAllowance}
                                    onChange={(e) => setMarriageAllowance(e.target.checked)}
                                    className="custom-checkbox"
                                />
                            </div>
                        </div>
                    )}
                </div>

                <div className="mt-4 pt-8 border-t border-gray-100">
                    <PeriodicToggle activePeriod={period} onPeriodChange={setPeriod} />
                    <div className="space-y-1 bg-brand-primary/5 p-6 rounded-3xl border border-brand-primary/10 mb-8">
                        <ResultRow label="Gross Pay" value={res.gross[period]} />
                        <ResultRow label="Income Tax" value={res.incomeTax[period]} />
                        <ResultRow label="National Insurance" value={res.ni[period]} />

                        {res.pension.annual > 0 && (
                            <ResultRow label="Pension Contribution" value={res.pension[period]} />
                        )}

                        {res.studentLoan.annual > 0 && (
                            <ResultRow label="Student Loan Repayment" value={res.studentLoan[period]} />
                        )}

                        <ResultRow label="Take-home Pay" value={res.takeHome[period]} isTotal />
                    </div>

                    <Accordion title="Breakdown Details" isOpen={showDetails} onToggle={() => setShowDetails(!showDetails)}>
                        <div className="p-6 space-y-6 bg-white/50">
                            {/* Table Header */}
                            <div className="grid grid-cols-12 gap-4 text-[11px] font-bold text-gray-500 uppercase tracking-widest border-b border-brand-primary/10 pb-3">
                                <div className="col-span-5">Tax Band</div>
                                <div className="col-span-4">Rate & Range</div>
                                <div className="col-span-3 text-right">Tax Amount</div>
                            </div>

                            {/* Band Rows */}
                            <div className="space-y-1">
                                {res.taxBands.map((band, idx) => {
                                    const rateNum = parseInt(band.rate);
                                    let indicatorColor = "bg-emerald-400"; // 0%
                                    if (rateNum === 20) indicatorColor = "bg-blue-400";
                                    if (rateNum === 40) indicatorColor = "bg-orange-400";
                                    if (rateNum === 45) indicatorColor = "bg-red-400";

                                    return (
                                        <div key={idx} className="grid grid-cols-12 gap-4 items-center text-sm py-4 border-b border-gray-50 last:border-0 hover:bg-white transition-colors rounded-xl px-2">
                                            <div className="col-span-5 flex items-center gap-3">
                                                <div className={`w-1.5 h-10 rounded-full ${indicatorColor} shadow-sm`} />
                                                <span className="font-extrabold text-dark text-base">{band.name}</span>
                                            </div>
                                            <div className="col-span-4 flex flex-col justify-center">
                                                <span className="font-bold text-gray-700">{band.rate}</span>
                                                <span className="text-[10px] text-gray-400 font-bold uppercase tracking-tighter">{band.range}</span>
                                            </div>
                                            <div className="col-span-3 text-right flex flex-col justify-center">
                                                <span className="font-black text-brand-primary text-lg">
                                                    £{(band.taxAmount * multiplier).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                </span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Contextual Note */}
                            <div className="mt-6 p-5 bg-brand-primary/5 border border-brand-primary/10 rounded-2xl flex items-start gap-3">
                                <span className="text-xl text-brand-primary"><TbLamp /></span>
                                <div className="text-xs text-gray-600 font-medium leading-relaxed">
                                    <p className="font-bold text-brand-primary mb-1 uppercase tracking-wider">Note on Allowance</p>
                                    Your Personal Allowance for this calculation is <strong className="text-dark">£{res.allowance.toLocaleString()}</strong>.
                                    {res.pension.annual > 0 && " Pension contributions have been deducted from your gross income before tax was calculated."}
                                    {res.blindPerson && " Your Blind Person's Allowance has been applied to reduce your taxable income."}
                                </div>
                            </div>
                        </div>
                    </Accordion>
                </div>
            </Card>

            <TaxSavingsTool totalTax={res.incomeTax.annual + res.ni.annual} />
        </div>
    );
};
