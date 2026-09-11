import { Card, Input, ResultRow, Accordion } from "@/components/ui/Base";
import { TaxSavingsTool } from "@/components/ui/TaxSavingsTool";
import { useState } from "react";
import { calculateDividendTax, calculateCryptoTax, calculateCorporationTax } from "@/lib/calculators/specialized-tax";
import { TbBuilding, TbChartBar, TbBuildingBank } from "react-icons/tb";

export const DividendTaxCalc = ({ taxYear }) => {
    const [dividends, setDividends] = useState(3000);
    const [otherIncome, setOtherIncome] = useState(29000);
    const [source, setSource] = useState("ltd");
    const [showDetails, setShowDetails] = useState(false);

    const results = calculateDividendTax(dividends, otherIncome, taxYear, source);

    return (
        <div className="space-y-8">
            <Card className="flex flex-col gap-8 common-form p-6 md:p-8">

                {/* ── Investment Type Selector ─────────────────── */}
                <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
                        How did you earn dividends?
                    </p>
                    <div className="calc-main-tabs">
                        <button
                            onClick={() => setSource("ltd")}
                            className={`calc-tab-btn ${source === "ltd" ? "active" : ""}`}
                        >
                            <TbBuilding className="inline-block mr-1" /> My limited company
                        </button>
                        <button
                            onClick={() => setSource("general")}
                            className={`calc-tab-btn ${source === "general" ? "active" : ""}`}
                        >
                            <TbChartBar className="inline-block mr-1" /> General Account
                        </button>
                        <button
                            onClick={() => setSource("isa")}
                            className={`calc-tab-btn ${source === "isa" ? "active" : ""}`}
                        >
                            <TbBuildingBank className="inline-block mr-1" /> An ISA

                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Input className="mb-0 form-control" label="Dividend Income (£)" value={dividends} onChange={setDividends} />
                    <Input className="mb-0 form-control" label="Other Annual Income (£)" value={otherIncome} onChange={setOtherIncome} />
                </div>

                <div className="space-y-1 bg-brand-primary/5 p-6 rounded-3xl border border-brand-primary/10 mt-4">
                    <ResultRow label="Taxable Amount" value={results.taxable} />
                    <ResultRow label="Estimated Dividend Tax" value={results.tax} isTotal />
                    {source === 'isa' && (
                        <div className="mt-2 p-3 bg-blue-50 rounded-xl border border-blue-100">
                            <p className="text-xs text-blue-700 leading-relaxed font-semibold">
                                ✓ Dividends from shares in an ISA are completely tax-free.
                            </p>
                        </div>
                    )}
                </div>

                <Accordion title="Calculation Details" isOpen={showDetails} onToggle={() => setShowDetails(!showDetails)}>
                    <div className="cal-details-inr p-4">
                        <ul className="accord-list text-sm space-y-2">
                            {source === 'isa' ? (
                                <li>• Any gains, income, and profits from ISA accounts are completely tax-free.</li>
                            ) : (
                                <>
                                    <li>• The first £500 of dividends is tax-free (Dividend Allowance).</li>
                                    <li>• Your Personal Allowance (£12,570) is applied to your other income first.</li>
                                    {results.paUsed > 0 && (
                                        <li>• Remaining Personal Allowance used for dividends: <strong>£{results.paUsed.toLocaleString()}</strong></li>
                                    )}
                                    <li className="pt-2 border-t border-gray-100"><strong>Current Rates (2025/26):</strong></li>
                                    <li>• Basic Rate: 8.75%</li>
                                    <li>• Higher Rate: 33.75%</li>
                                    <li>• Additional Rate: 39.35%</li>
                                </>
                            )}
                        </ul>
                    </div>
                </Accordion>
                <p className="text-[10px] text-gray-400 italic mt-2">
                    * Figures based on {taxYear} UK tax rules. The calculator automatically determines your tax band based on your total income.
                </p>
            </Card>
            <TaxSavingsTool totalTax={results.tax} />
        </div>
    );
};

export const CryptoTaxCalc = ({ taxYear }) => {
    const [gain, setGain] = useState(10000);
    const [band, setBand] = useState("basic");
    const [showDetails, setShowDetails] = useState(false);
    const results = calculateCryptoTax(gain, band, taxYear);
    const ratePercent = Math.round(results.rate * 100);

    return (
        <div className="space-y-8">
            <Card className="flex flex-col gap-8 common-form p-6 md:p-8">
                {/* ── Input Section ─────────────────── */}
                <div className="space-y-6">
                    <Input
                        className="mb-0 form-control"
                        label="Total Capital Gain (£)"
                        value={gain}
                        onChange={setGain}
                        placeholder="e.g. 10000"
                    />
                    <div>
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
                            <TbChartBar className="inline-block mr-1 text-brand-primary" /> Your Income Tax Band
                        </p>
                        <div className="calc-main-tabs flex gap-3 mb-0">
                            {["basic", "higher"].map(b => (
                                <button
                                    key={b}
                                    onClick={() => setBand(b)}
                                    className={`calc-tab-btn flex-1 py-3 ${band === b ? "active" : ""}`}
                                >
                                    <TbChartBar className="inline-block mr-1" /> {b.charAt(0).toUpperCase() + b.slice(1)} Rate
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* ── Results Display ─────────────────── */}
                <div className="space-y-1 bg-brand-primary/5 p-6 rounded-3xl border border-brand-primary/10 mt-4">
                    <ResultRow label="Total Profit from Crypto" value={results.gain} />
                    <div className="border-t border-brand-primary/10 my-2 pt-2">
                        <ResultRow
                            label={`CGT Annual Exempt Amount (${taxYear})`}
                            value={-results.allowance}
                            subText="Tax-free allowance applied"
                        />
                    </div>
                    <ResultRow label="Taxable Gain" value={results.taxable} />
                    <div className="mt-4 pt-4 border-t border-brand-primary/20">
                        <ResultRow
                            label={`Capital Gains Tax Payable (${ratePercent}%)`}
                            value={results.tax}
                            isTotal
                        />
                    </div>
                </div>

                {/* ── Guidance/Accordion ─────────────────── */}
                <Accordion
                    title="CGT Allowances & Rates Explained"
                    isOpen={showDetails}
                    onToggle={() => setShowDetails(!showDetails)}
                >
                    <div className="cal-details-inr p-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100">
                                <h4 className="text-sm font-bold text-gray-900 mb-2">Tax Rates</h4>
                                <ul className="text-xs space-y-2 text-gray-600">
                                    <li className="flex justify-between">
                                        <span>Basic Rate:</span>
                                        <span className="font-semibold">{taxYear.includes("2024") ? "10%" : "18%"}*</span>
                                    </li>
                                    <li className="flex justify-between">
                                        <span>Higher Rate:</span>
                                        <span className="font-semibold">{taxYear.includes("2024") ? "20%" : "24%"}*</span>
                                    </li>
                                </ul>
                                <p className="text-[10px] text-gray-400 mt-2 italic">* Rates may vary based on asset type.</p>
                            </div>
                            <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100">
                                <h4 className="text-sm font-bold text-gray-900 mb-2">Allowances</h4>
                                <ul className="text-xs space-y-2 text-gray-600">
                                    <li className="flex justify-between">
                                        <span>Annual Exempt Amount:</span>
                                        <span className="font-semibold">£{results.allowance?.toLocaleString()}</span>
                                    </li>
                                </ul>
                                <p className="text-[10px] text-gray-400 mt-2 italic">Gains above this amount are taxable.</p>
                            </div>
                        </div>
                    </div>
                </Accordion>

                <p className="text-[10px] text-gray-400 italic mt-2">
                    * This calculator provides an estimate based on {taxYear} UK Capital Gains Tax rules for cryptoassets.
                </p>
            </Card>
            <TaxSavingsTool totalTax={results.tax} />
        </div>
    );
};

export const CorporationTaxCalc = ({ taxYear }) => {
    const [revenue, setRevenue] = useState(100000);
    const [expenses, setExpenses] = useState(0);
    const [showDetails, setShowDetails] = useState(false);

    const profit = Math.max(0, revenue - expenses);
    const results = calculateCorporationTax(profit, taxYear);

    return (
        <div className="space-y-8">
            <Card className="flex flex-col gap-8 common-form p-6 md:p-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Input className="mb-0 form-control" label="Annual Revenue (£)" value={revenue} onChange={setRevenue} />
                    <Input className="mb-0 form-control" label="Annual Expenses (£)" value={expenses} onChange={setExpenses} />
                </div>

                <div className="space-y-1 bg-brand-primary/5 p-6 rounded-3xl border border-brand-primary/10 mt-4">
                    <ResultRow label="Taxable Profit" value={profit} />
                    <ResultRow label="Corporation Tax" value={results.tax} isTotal />
                    <ResultRow label="Net Profit (After Tax)" value={results.netProfit} />
                </div>

                <Accordion title="How calculation works" isOpen={showDetails} onToggle={() => setShowDetails(!showDetails)}>
                    <div className="cal-details-inr p-4">
                        <ul className="accord-list text-sm space-y-2">
                            {profit <= 50000 ? (
                                <li>• Small Profits Rate (19%) applies as profit is £50,000 or less.</li>
                            ) : profit >= 250000 ? (
                                <li>• Main Rate (25%) applies as profit is £250,000 or more.</li>
                            ) : (
                                <>
                                    <li>• Marginal Relief applies as profit is between £50,000 and £250,000.</li>
                                    <li>• Effective rate is graduated between 19% and 25%.</li>
                                </>
                            )}
                            <li className="pt-2 border-t border-gray-100 text-[10px] italic">
                                * Corporate tax is calculated based on taxable profit (Revenue - Expenses).
                            </li>
                        </ul>
                    </div>
                </Accordion>
            </Card>
            <TaxSavingsTool totalTax={results.tax} />
        </div>
    );
};
