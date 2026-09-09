import { Accordion, Card, Input, ResultRow } from "@/components/ui/Base";
import { TaxSavingsTool } from "@/components/ui/TaxSavingsTool";
import { calculateCISRebate, calculateEbayTax, calculateRentalTax } from "@/lib/calculators/misc-tax";
import { calculateUberTax } from "@/lib/calculators/specialized-tax";
import { useState } from "react";
import { TbHome2, TbHome, TbUserCheck, TbBuilding, TbBasket, TbBriefcase } from "react-icons/tb";

export const RentalTaxCalc = ({ taxYear }) => {
    const [landlordType, setLandlordType] = useState("buy_to_let");
    const [rent, setRent] = useState(1500);
    const [expenses, setExpenses] = useState(0);
    const [interest, setInterest] = useState(0);
    const [salary, setSalary] = useState(38000);
    const [showDetails, setShowDetails] = useState(false);

    const isBuyToLet = landlordType === "buy_to_let";

    // Convert monthly inputs to annual for the calculator logic
    const annualRentInput = rent * 12;
    const annualExpensesInput = expenses * 12;

    const r = calculateRentalTax(annualRentInput, annualExpensesInput, interest, salary, taxYear, landlordType);

    return (
        <div className="space-y-8">
            <Card className="flex flex-col gap-8 common-form p-6 md:p-8">

                {/* ── Landlord type toggle ─────────────────── */}
                <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
                        What kind of landlord are you?
                    </p>
                    <div className="calc-main-tabs">
                        <button
                            onClick={() => setLandlordType("buy_to_let")}
                            className={`calc-tab-btn ${isBuyToLet ? "active" : ""}`}
                        >
                            <TbHome2 className="inline-block mr-1" /> Buy to Let
                        </button>
                        <button
                            onClick={() => setLandlordType("rent_a_room")}
                            className={`calc-tab-btn ${!isBuyToLet ? "active" : ""}`}
                        >
                            <TbHome className="inline-block mr-1" /> Room in My Home
                        </button>
                    </div>
                </div>

                {/* ── Scheme info banner ───────────────────── */}
                {!isBuyToLet && (
                    <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl mt-4 mb-4">
                        <p className="text-sm font-semibold text-blue-800 mb-1">Rent-a-Room Scheme</p>
                        <p className="text-xs text-blue-700 leading-relaxed">
                            You can earn up to <strong>£7,500 tax-free</strong> per year from renting a furnished room in your own home (HMRC Rent-a-Room scheme). Only the income above £7,500 is taxable. Mortgage interest and allowable expenses cannot be claimed under this scheme.
                        </p>
                    </div>
                )}

                {/* ── Inputs ──────────────────────────────── */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Input className="mb-0 form-control" label="Monthly Rent (£)" placeholder="e.g. 1500" value={rent} onChange={setRent} />
                    <Input className="mb-0 form-control" label="Annual Salary / Other Income (£)" placeholder="e.g. 38000" value={salary} onChange={setSalary} />
                </div>

                {/* Buy to let only fields */}
                {isBuyToLet && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Input className="mb-0 form-control" label="Monthly Allowable Expenses (£)" placeholder="e.g. 100" value={expenses} onChange={setExpenses} />
                        <Input className="mb-0 form-control" label="Annual Mortgage Interest (£)" placeholder="e.g. 2400" value={interest} onChange={setInterest} />
                    </div>
                )}

                {/* ── Summary badges ──────────────────────── */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                    <div className="p-4 bg-brand-primary/5 rounded-2xl border border-brand-primary/10 flex flex-col gap-1">
                        <span className="text-xs text-gray-500 font-medium">Earnings from rent</span>
                        <span className="text-xl font-bold text-gray-800">
                            £{r.annualRent.toLocaleString("en-GB")}
                        </span>
                        <span className="text-[10px] text-brand-primary font-medium mt-0.5">
                            {r.allowanceLabel}
                        </span>
                    </div>
                    <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-100 flex flex-col gap-1">
                        <span className="text-xs text-gray-500 font-medium">After-tax rental income</span>
                        <span className="text-xl font-bold text-emerald-700">
                            £{Math.round(r.afterTaxRentalIncome).toLocaleString("en-GB")}
                        </span>
                    </div>
                </div>

                {/* ── Results breakdown ────────────────────── */}
                <div className="space-y-1 bg-gray-50 p-3 rounded-2xl border border-gray-100 mt-8">
                    <ResultRow label="Gross Rental Income" value={r.annualRent} />
                    <ResultRow
                        label={isBuyToLet
                            ? (r.usedPropertyAllowance ? "Property Allowance (£1,000)" : "Allowable Expenses")
                            : "Rent-a-Room Allowance (£7,500)"}
                        value={r.effectiveDeduction}
                    />
                    <ResultRow
                        label={isBuyToLet ? "Rental Profit (Taxable)" : "Taxable Amount (above allowance)"}
                        value={r.rentalProfit}
                    />
                    <ResultRow label="Property Tax to Pay (before credit)" value={r.rentalTaxBeforeCredit} />
                    {isBuyToLet && r.mortgageCredit > 0 && (
                        <ResultRow label="Mortgage Interest Tax Credit (20%)" value={-r.mortgageCredit} />
                    )}
                    <ResultRow label="Property Tax to Pay" value={r.propertyTaxToPay} isTotal />
                </div>

                {/* ── Details accordion ───────────────────── */}
                <Accordion
                    className="mt-8 mb-4"
                    title="Landlord Tax Details"
                    isOpen={showDetails}
                    onToggle={() => setShowDetails(!showDetails)}
                >
                    <div className="cal-details-inr p-4 space-y-2 text-sm text-gray-600 leading-relaxed mb-4">
                        {isBuyToLet ? (
                            <>
                                <p>• <strong>Rental profit:</strong> £{r.annualRent.toLocaleString("en-GB")} − £{r.effectiveDeduction.toLocaleString("en-GB")} (
                                    {r.usedPropertyAllowance ? "£1,000 property allowance" : "allowable expenses"}
                                    ) = £{r.rentalProfit.toLocaleString("en-GB")}.</p>
                                <p>• Your rental profit sits on top of your salary (£{r.annualSalary.toLocaleString("en-GB")}), giving combined income of <strong>£{r.totalGrossIncome.toLocaleString("en-GB")}</strong>. Income tax is calculated across UK bands on the full combined income.</p>
                                {r.mortgageCredit > 0 && (
                                    <p>• <strong>Mortgage interest credit:</strong> Since April 2020, mortgage interest gives a 20% tax reducer — here <strong>£{r.mortgageCredit.toLocaleString("en-GB", { minimumFractionDigits: 2 })}</strong>.</p>
                                )}
                                {r.usedPropertyAllowance && (
                                    <p>• <strong>Property Allowance:</strong> No expenses entered, so the HMRC £1,000 property allowance has been applied automatically.</p>
                                )}
                            </>
                        ) : (
                            <>
                                <p>• Under the <strong>Rent-a-Room scheme</strong>, the first <strong>£7,500</strong> of your rental income is completely tax-free.</p>
                                <p>• Only the <strong>£{r.rentalProfit.toLocaleString("en-GB")}</strong> above the £7,500 allowance is added to your salary (£{r.annualSalary.toLocaleString("en-GB")}) for tax band calculation.</p>
                                <p>• You cannot claim allowable expenses or mortgage interest tax credits under this scheme.</p>
                            </>
                        )}
                    </div>
                </Accordion>

                {/* ── Disclaimer ────────────────────────────── */}
                <p className="text-[10px] text-gray-400 italic border border-gray-100 rounded-2xl p-4 leading-relaxed">
                    {isBuyToLet
                        ? `* Based on ${taxYear} UK income tax rates. Mortgage interest is a 20% tax credit (post April 2020 HMRC rules). Figures are estimates — consult a tax adviser.`
                        : `* Based on ${taxYear} HMRC Rent-a-Room scheme. The £7,500 allowance applies to furnished lettings in your own home. Figures are estimates.`}
                </p>
            </Card>

            <TaxSavingsTool totalTax={r.propertyTaxToPay} />
        </div>
    );
};



export const CISRebateCalc = ({ taxYear }) => {
    const [cis, setCis] = useState(6000);
    const [income, setIncome] = useState(20000);
    const [expenses, setExpenses] = useState(0);
    const [otherIncome, setOtherIncome] = useState(0);
    const [employmentStatus, setEmploymentStatus] = useState("self_employed");
    const [showAdvanced, setShowAdvanced] = useState(false);
    const [showDetails, setShowDetails] = useState(false);

    const isSelfEmployed = employmentStatus === "self_employed";

    const r = calculateCISRebate(cis, income, expenses, taxYear, otherIncome, employmentStatus);

    return (
        <div className="space-y-8">
            <Card className="flex flex-col gap-8 common-form p-6 md:p-8">
                {/* ── Employment status toggle ─────────────────── */}
                <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
                        In construction, your employment status is:
                    </p>
                    <div className="calc-main-tabs">
                        <button
                            onClick={() => setEmploymentStatus("self_employed")}
                            className={`calc-tab-btn ${isSelfEmployed ? "active" : ""}`}
                        >
                            <TbUserCheck className="inline-block mr-1" /> Self-employed
                        </button>
                        <button
                            onClick={() => setEmploymentStatus("paye")}
                            className={`calc-tab-btn ${!isSelfEmployed ? "active" : ""}`}
                        >
                            <TbBuilding className="inline-block mr-1" /> Full time PAYE
                        </button>
                    </div>
                </div>

                <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Input
                            label={isSelfEmployed ? "Annual Pay Before Tax (Gross £)" : "Annual Salary (Gross £)"}
                            value={income}
                            onChange={setIncome}
                        />
                        <Input
                            label={isSelfEmployed ? "CIS Tax Actually Deducted (£)" : "Income Tax Actually Paid (£)"}
                            value={cis}
                            onChange={setCis}
                        />
                    </div>

                    <div className="pt-2">
                        <button
                            onClick={() => setShowAdvanced(!showAdvanced)}
                            className="flex items-center gap-2 text-sm font-bold text-brand-primary hover:text-brand-accent transition-colors"
                        >
                            {showAdvanced ? "− Hide extra details" : "+ Add expenses or other income"}
                        </button>
                    </div>

                    {showAdvanced && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-in fade-in slide-in-from-top-4 duration-500">
                            {isSelfEmployed && (
                                <Input
                                    label="Tools, Fuel & Materials (£)"
                                    value={expenses}
                                    onChange={setExpenses}
                                    placeholder="e.g. 1500"
                                />
                            )}
                            <Input
                                label="Other Annual Income (£)"
                                value={otherIncome}
                                onChange={setOtherIncome}
                                placeholder="e.g. 5000"
                            />
                        </div>
                    )}
                </div>

                <div className="space-y-1 bg-brand-primary/5 p-6 rounded-3xl border border-brand-primary/10">
                    <ResultRow label={isSelfEmployed ? "Business Profit (after allowance)" : "Taxable Income"} value={r.businessProfit} />
                    <ResultRow label="Estimated Income Tax" value={r.incomeTax} />
                    <ResultRow label={`National Insurance (${r.niType})`} value={r.ni} />
                    <ResultRow label="Estimated Total Tax & NI Owed" value={r.totalTaxOwed} isTotal />

                    <div className="py-2 border-t border-brand-primary/10 mt-2">
                        <ResultRow label="Tax Already Paid" value={cis} />
                        {r.rebate > 0 ? (
                            <div className="mt-2 p-3 bg-emerald-50 rounded-xl border border-emerald-100">
                                <ResultRow label="Estimated Rebate" value={r.rebate} isTotal />
                            </div>
                        ) : (
                            <div className="mt-2 p-3 bg-red-50 rounded-xl border border-red-100">
                                <ResultRow label="Estimated Tax to Pay" value={r.extraTaxToPay} isTotal />
                            </div>
                        )}
                    </div>
                </div>

                <Accordion title="How CIS rebates work" isOpen={showDetails} onToggle={() => setShowDetails(!showDetails)}>
                    <div className="p-4 space-y-3 text-xs text-gray-600 leading-relaxed">
                        {isSelfEmployed ? (
                            <>
                                <p>
                                    Contractors usually deduct a flat <strong>20%</strong> (CIS) from your monthly payments. Since this doesn't account for your tax-free Personal Allowance (£12,570) or your business expenses, you are likely to have overpaid tax.
                                </p>
                                <p>
                                    • <strong>Trading Allowance:</strong> If your expenses are under £1,000, we've automatically applied the £1,000 HMRC Trading Allowance to maximize your profit deduction.
                                </p>
                                <p>
                                    • <strong>National Insurance:</strong> As a self-employed subcontractor, you are also responsible for Class 4 National Insurance on your profits (currently 6% on profits between £12,570 and £50,270).
                                </p>
                            </>
                        ) : (
                            <>
                                <p>
                                    As a <strong>PAYE employee</strong>, your employer deducts tax and National Insurance (Class 1) from your salary automatically.
                                </p>
                                <p>
                                    • <strong>Class 1 NI:</strong> Employees pay Class 1 NI (currently 8% on earnings between £12,570 and £50,270). This is usually higher than the self-employed Class 4 rate.
                                </p>
                                <p>
                                    • <strong>Rebates:</strong> If you've been overtaxed or have multiple jobs, you might be due a refund from HMRC.
                                </p>
                            </>
                        )}
                    </div>
                </Accordion>
            </Card>
            <TaxSavingsTool totalTax={r.totalTaxOwed} />
        </div>
    );
};

export const EbayTaxCalc = ({ taxYear }) => {
    const [status, setStatus] = useState("side_hustle");
    const [revenue, setRevenue] = useState(15000);
    const [salary, setSalary] = useState(0);
    const [cost, setCost] = useState(0);
    const [fees, setFees] = useState(0);
    const [shipping, setShipping] = useState(0);
    const [showAdvanced, setShowAdvanced] = useState(false);
    const [showDetails, setShowDetails] = useState(false);

    const isSideHustle = status === "side_hustle";
    const r = calculateEbayTax(revenue, cost, fees, shipping, 0, taxYear, isSideHustle ? salary : 0);

    return (
        <div className="space-y-8">
            <Card className="flex flex-col gap-8 common-form p-6 md:p-8">
                {/* ── Status toggle ─────────────────── */}
                <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
                        eBay selling is:
                    </p>
                    <div className="calc-main-tabs">
                        <button
                            onClick={() => setStatus("side_hustle")}
                            className={`calc-tab-btn ${isSideHustle ? "active" : ""}`}
                        >
                            <TbBasket className="inline-block mr-1" /> A side hustle
                        </button>
                        <button
                            onClick={() => setStatus("full_time")}
                            className={`calc-tab-btn ${!isSideHustle ? "active" : ""}`}
                        >
                            <TbBriefcase className="inline-block mr-1" /> Full-time business
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Input className="mb-0 form-control" label="Annual eBay earnings (£)" value={revenue} onChange={setRevenue} />
                    {isSideHustle && (
                        <Input className="mb-0 form-control" label="Your employment annual salary (£)" value={salary} onChange={setSalary} />
                    )}
                </div>

                <div className="pt-2">
                    <button
                        onClick={() => setShowAdvanced(!showAdvanced)}
                        className="flex items-center gap-2 text-sm font-bold text-brand-primary hover:text-brand-accent transition-colors"
                    >
                        {showAdvanced ? "− Hide expenses" : "+ Add eBay fees & expenses"}
                    </button>
                </div>

                {showAdvanced && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-in fade-in slide-in-from-top-4 duration-500">
                        <Input className="mb-0 form-control" label="Cost of Goods (£)" value={cost} onChange={setCost} />
                        <Input className="mb-0 form-control" label="Platform Fees (£)" value={fees} onChange={setFees} />
                        <Input className="mb-0 form-control" label="Shipping Costs (£)" value={shipping} onChange={setShipping} />
                    </div>
                )}

                <div className="space-y-1 bg-brand-primary/5 p-6 rounded-3xl border border-brand-primary/10">
                    <ResultRow label="Gross Revenue" value={r.revenue} />
                    <ResultRow
                        label={r.usedTradingAllowance ? "Trading Allowance Deducted" : "Actual Expenses Deducted"}
                        value={r.effectiveExpenses}
                    />
                    <ResultRow label="Net Taxable Profit" value={r.businessProfit} />
                    <ResultRow label="Estimated Income Tax" value={r.incomeTax} />
                    <ResultRow label="National Insurance (Class 4)" value={r.ni} />
                    <ResultRow label="Total Tax & NI Owed" value={r.totalTax} isTotal />
                    <div className="pt-2 border-t border-brand-primary/10 mt-2">
                        <ResultRow label="What you're left with" value={r.netProfit} isTotal />
                    </div>
                </div>

                <Accordion title="Trading Allowance Note" isOpen={showDetails} onToggle={() => setShowDetails(!showDetails)}>
                    <div className="cal-details-inr p-4 text-xs text-gray-600 leading-relaxed">
                        <p>• <strong>Trading Allowance:</strong> If your total business income is under £1,000, you don't need to report it. If it's over, you can either deduct your actual expenses (£{r.actualExpenses.toLocaleString()}) or the £1,000 Trading Allowance, whichever is higher.</p>
                        <p className="mt-2">• <strong>How tax is calculated:</strong> We calculate your eBay profit and add it to your other income (£{isSideHustle ? salary.toLocaleString() : "0"}). Tax is then calculated based on the <strong>{taxYear}</strong> UK tax bands. Because you are self-employed, you also pay Class 4 National Insurance on profits above the relevant threshold.</p>
                    </div>
                </Accordion>
            </Card>
            <TaxSavingsTool totalTax={r.totalTax} />
        </div>
    );
};

export const UberTaxCalc = ({ taxYear }) => {
    const [earnings, setEarnings] = useState(30000);
    const [expenses, setExpenses] = useState(10000);
    const [otherIncome, setOtherIncome] = useState(0);
    const [showDetails, setShowDetails] = useState(false);

    const results = calculateUberTax(earnings, expenses, otherIncome, taxYear);

    return (
        <div className="space-y-8">
            <Card className="flex flex-col gap-8 common-form p-6 md:p-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Input className="mb-0 form-control" label="Total Annual Earnings (£)" value={earnings} onChange={setEarnings} />
                    <Input className="mb-0 form-control" label="Other Annual Income (£)" value={otherIncome} onChange={setOtherIncome} />
                </div>
                <Input className="mb-0 form-control" label="Vehicle & Operating Expenses (£)" value={expenses} onChange={setExpenses} />

                <div className="space-y-1 bg-brand-primary/5 p-6 rounded-3xl border border-brand-primary/10 mt-4">
                    <ResultRow label="Taxable Profit" value={results.profit} />
                    <ResultRow label="Estimated Income Tax" value={results.tax} />
                    <ResultRow label="National Insurance (Class 4)" value={results.ni} />
                    <ResultRow label="Total Tax Payable" value={results.totalTax} isTotal />
                    <div className="pt-2 border-t border-brand-primary/10 mt-2">
                        <ResultRow label="What you're left with" value={earnings + Number(otherIncome) - expenses - results.totalTax} isTotal />
                    </div>
                </div>

                <Accordion title="Expense Tips & Tax Notes" isOpen={showDetails} onToggle={() => setShowDetails(!showDetails)}>
                    <div className="cal-details-inr p-4 space-y-3">
                        <ul className="accord-list">
                            <li>• You can claim fuel, insurance, and maintenance costs.</li>
                            <li>• Don't forget to claim for car cleaning and platform fees.</li>
                            <li>• {results.usedTradingAllowance ? "We applied the £1,000 Trading Allowance as your expenses were lower." : "Your actual expenses were deducted from your earnings."}</li>
                        </ul>
                        <p className="text-xs text-gray-600 italic">
                            * Based on {taxYear} UK tax rules for self-employed individuals. Income tax is calculated on your total income (Profit + Other Income) after your Personal Allowance.
                        </p>
                    </div>
                </Accordion>
            </Card>
            <TaxSavingsTool totalTax={results.totalTax} />
        </div>
    );
};
