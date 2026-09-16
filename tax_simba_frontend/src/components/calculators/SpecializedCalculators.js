import { Card, Input, ResultRow, Accordion } from "@/components/ui/Base";
import { TaxSavingsTool } from "@/components/ui/TaxSavingsTool";
import { useState } from "react";
import { calculateStampDuty, interpretTaxCode, calculateMileageRelief, calculateTaxFromCode } from "@/lib/calculators/specialized-tax";
import { TbHome, TbHome2, TbBeach, TbBuilding, TbCar, TbMotorbike, TbBike } from "react-icons/tb";

export const StampDutyCalc = ({ taxYear }) => {
    const [price, setPrice] = useState(500000);
    const [situation, setSituation] = useState("next_home"); // first_home, next_home, second_home, to_let
    const [isNonResident, setIsNonResident] = useState(false);
    const [showDetails, setShowDetails] = useState(false);

    const isFirstTime = situation === "first_home";
    const isAdditional = situation === "second_home" || situation === "to_let";

    const { tax, breakdown } = calculateStampDuty(price, {
        taxYear,
        isFirstTime,
        isAdditional,
        isNonResident
    });

    return (
        <div className="space-y-8">
            <Card className="flex flex-col gap-8 common-form p-6 md:p-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* ── 1. Buyer Situation ─────────────────── */}
                    <RadioGroup
                        label="1. Your Buying Situation"
                        value={situation}
                        onChange={setSituation}
                        options={[
                            { value: "first_home", label: <><TbHome className="inline-block mr-1" /> My first home</> },
                            { value: "next_home", label: <><TbHome2 className="inline-block mr-1" /> My next home</> },
                            { value: "second_home", label: <><TbBeach className="inline-block mr-1" /> A second home</> },
                            { value: "to_let", label: <><TbBuilding className="inline-block mr-1" /> To let / flip</> }
                        ]}
                        vertical
                    />

                    {/* ── 2. Residency ────────────────────────── */}
                    <RadioGroup
                        label="2. Residency Status"
                        value={isNonResident ? "non_resident" : "resident"}
                        onChange={(val) => setIsNonResident(val === "non_resident")}
                        options={[
                            { value: "resident", label: "UK Resident" },
                            { value: "non_resident", label: "Non-Resident (+2%)" }
                        ]}
                    />
                </div>

                {/* ── 3. Price Input ─────────────────────── */}
                <div className="pt-2">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-4">
                        3. Property Value
                    </p>
                    <Input
                        className="mb-0 form-control"
                        label="Property Price (£)"
                        placeholder="e.g. 500000"
                        value={price}
                        onChange={setPrice}
                    />
                </div>

                {/* ── Results Section ─────────────────────── */}
                <div className="space-y-1 bg-brand-primary/5 p-6 rounded-3xl border border-brand-primary/10 mt-4">
                    <ResultRow label="Property Value" value={price} />
                    <ResultRow label="Stamp Duty to pay" value={tax} isTotal />
                </div>

                {/* ── Breakdown Accordion ─────────────────── */}
                <Accordion
                    title="See calculation details"
                    isOpen={showDetails}
                    onToggle={() => setShowDetails(!showDetails)}
                >
                    <div className="p-6 space-y-6 bg-white/50">
                        {/* Table Header */}
                        <div className="grid grid-cols-12 gap-4 text-[11px] font-bold text-gray-500 uppercase tracking-widest border-b border-brand-primary/10 pb-3">
                            <div className="col-span-5">Price Band</div>
                            <div className="col-span-4">Rate & Range</div>
                            <div className="col-span-3 text-right">Stamp Duty</div>
                        </div>

                        {/* Band Rows */}
                        <div className="space-y-1">
                            {breakdown.map((item, idx) => {
                                const rateNum = item.rate * 100;
                                let indicatorColor = "bg-emerald-400"; // 0%
                                if (rateNum > 0 && rateNum <= 5) indicatorColor = "bg-blue-400";
                                if (rateNum > 5 && rateNum <= 10) indicatorColor = "bg-orange-400";
                                if (rateNum > 10) indicatorColor = "bg-red-400";

                                return (
                                    <div key={idx} className="grid grid-cols-12 gap-4 items-center text-sm py-4 border-b border-gray-50 last:border-0 hover:bg-white transition-colors rounded-xl px-2">
                                        <div className="col-span-5 flex items-center gap-3">
                                            <div className={`w-1.5 h-10 rounded-full ${indicatorColor} shadow-sm`} />
                                            <span className="font-extrabold text-dark text-base">Band {idx + 1}</span>
                                        </div>
                                        <div className="col-span-4 flex flex-col justify-center">
                                            <span className="font-bold text-gray-700">{(item.rate * 100).toFixed(1)}%</span>
                                            <span className="text-[10px] text-gray-400 font-bold uppercase tracking-tighter">{item.range}</span>
                                        </div>
                                        <div className="col-span-3 text-right flex flex-col justify-center">
                                            <span className="font-black text-brand-primary text-lg">
                                                £{item.tax.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                            </span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </Accordion>

                {/* ── Disclaimer ────────────────────────────── */}
                <div className="p-4 border border-gray-100 rounded-2xl text-[10px] text-gray-400 leading-relaxed italic mt-2">
                    * Based on {taxYear} UK Stamp Duty (SDLT) thresholds for residential properties. Surcharges of 5% apply to additional properties and 2% to non-UK residents. Calculations are estimates.
                </div>
            </Card>

            {tax > 0 && <TaxSavingsTool totalTax={tax} />}
        </div>
    );
};

// ── Shared UI Sub-components ──────────────────────────────────────────────
const RadioGroup = ({ label, value, onChange, options, vertical = false }) => (
    <div className="flex flex-col gap-1 items-start w-full">
        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">{label}</label>
        <div className={`flex ${vertical ? "flex-col" : "flex-row flex-wrap"} gap-3 w-full`}>
            {options.map(opt => (
                <div
                    key={opt.value}
                    onClick={() => onChange(opt.value)}
                    className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all flex-1 min-w-fit
                        ${value === opt.value
                            ? "bg-brand-primary/5 border-theme shadow-sm"
                            : "bg-white border-gray-100 hover:border-gray-200"
                        }`}
                    style={value === opt.value ? { borderColor: 'var(--theme-color)' } : {}}
                >
                    <div
                        className={`rounded-full border flex items-center justify-center transition-all ${value === opt.value ? "bg-brand-primary border-theme" : "bg-white border-gray-300"
                            }`}
                        style={{ width: '18px', height: '18px', minWidth: '18px' }}
                    >
                        {value === opt.value && <div className="w-1.5 h-1.5 rounded-full bg-white shadow-sm" />}
                    </div>
                    <span className={`text-sm font-bold whitespace-nowrap ${value === opt.value ? "text-gray-900" : "text-gray-600"}`}>
                        {opt.label}
                    </span>
                </div>
            ))}
        </div>
    </div>
);

export const TaxCodeChecker = ({ taxYear }) => {
    const [code, setCode] = useState("1257L");
    const [salary, setSalary] = useState(49000);
    const [showDetails, setShowDetails] = useState(false);

    const result = calculateTaxFromCode(salary, code, taxYear);
    const { info, annualTax, annualNI, annualNet, monthlyNet } = result;

    return (
        <Card className="flex flex-col gap-6 common-form">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                    className="mb-0 form-control"
                    label="Enter Tax Code"
                    value={code}
                    type="text"
                    onChange={(val) => setCode(val.toUpperCase())}
                />
                <Input
                    className="mb-0 form-control"
                    label="Annual Salary (£)"
                    value={salary}
                    type="number"
                    onChange={setSalary}
                />
            </div>

            <div className="space-y-4 bg-brand-primary/5 p-6 rounded-3xl border border-brand-primary/10">
                <div className="space-y-2">
                    <ResultRow label="Code Status" value={info.description} />
                    <ResultRow
                        label={info.isNegative ? "Untaxed income added" : "Tax-Free Allowance"}
                        value={info.allowance}
                    />
                </div>
                <div className="pt-4 border-t border-brand-primary/10 space-y-2">
                    <ResultRow label="Estimated Annual Tax" value={annualTax} />
                    <ResultRow label="National Insurance (Class 1)" value={annualNI} />
                    <ResultRow label="Annual Take-Home" value={annualNet} isTotal />
                    <ResultRow label="Monthly Take-Home" value={monthlyNet} />
                </div>
            </div>

            <Accordion title="What do the letters mean?" isOpen={showDetails} onToggle={() => setShowDetails(!showDetails)}>
                <div className="cal-details-inr p-4 grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-2">
                    <div className="cal-detail-list text-md"><span className="font-bold text-brand-primary">L:</span> Standard allowance</div>
                    <div className="cal-detail-list text-md"><span className="font-bold text-brand-primary">M:</span> Marriage allowance (Received)</div>
                    <div className="cal-detail-list text-md"><span className="font-bold text-brand-primary">N:</span> Marriage allowance (Given)</div>
                    <div className="cal-detail-list text-md"><span className="font-bold text-brand-primary">T:</span> HMRC review needed</div>
                    <div className="cal-detail-list text-md"><span className="font-bold text-brand-primary">K:</span> Extra untaxed income added</div>
                    <div className="cal-detail-list text-md"><span className="font-bold text-brand-primary">BR:</span> Basic Rate (20%)</div>
                    <div className="cal-detail-list text-md"><span className="font-bold text-brand-primary">D0:</span> Higher Rate (40%)</div>
                    <div className="cal-detail-list text-md"><span className="font-bold text-brand-primary">D1:</span> Additional Rate (45%)</div>
                    <div className="cal-detail-list text-md"><span className="font-bold text-brand-primary">0T:</span> No allowance</div>
                    <div className="cal-detail-list text-md"><span className="font-bold text-brand-primary">S / C:</span> Scotland / Wales rates</div>
                </div>
            </Accordion>
        </Card>
    );
};

export const MileageTaxCalc = ({ taxYear }) => {
    const [miles, setMiles] = useState(12000);
    const [ratePaid, setRatePaid] = useState(0.20);
    const [vehicleType, setVehicleType] = useState('car');
    const [ownsVehicle, setOwnsVehicle] = useState('yes');
    const [showDetails, setShowDetails] = useState(false);

    const results = calculateMileageRelief(miles, {
        ratePaid,
        taxYear,
        vehicleType,
        taxRate: 0.20 // Defaulting to 20% for now
    });

    return (
        <Card className="flex flex-col gap-8 common-form p-6 md:p-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* 1. Vehicle Type */}
                <RadioGroup
                    label="1. Type of vehicle"
                    value={vehicleType}
                    onChange={setVehicleType}
                    options={[
                        { value: "car", label: <><TbCar className="inline-block mr-1" /> Car / Van</> },
                        { value: "motorcycle", label: <><TbMotorbike className="inline-block mr-1" /> Motorcycle</> },
                        { value: "bicycle", label: <><TbBike className="inline-block mr-1" /> Bicycle</> }
                    ]}
                    vertical
                />

                {/* 2. Ownership */}
                <RadioGroup
                    label="2. Own the vehicle?"
                    value={ownsVehicle}
                    onChange={setOwnsVehicle}
                    options={[
                        { value: "yes", label: "Yes" },
                        { value: "no", label: "No" }
                    ]}
                />
            </div>

            {/* 3. Mileage Inputs */}
            <div className="pt-2 grid grid-cols-1 md:grid-cols-2 gap-6">
                <Input
                    className="mb-0 form-control"
                    label="Annual Business Miles"
                    value={miles}
                    onChange={setMiles}
                />
                <Input
                    className="mb-0 form-control"
                    label="Paid by Employer (£/mile)"
                    value={ratePaid}
                    placeholder="e.g. 0.20"
                    onChange={setRatePaid}
                />
            </div>

            {/* Results Section */}
            <div className="space-y-1 bg-brand-primary/5 p-6 rounded-3xl border border-brand-primary/10 mt-4">
                <ResultRow label="Total Unclaimed Relief" value={results.reliefAmount} />
                <ResultRow label="Estimated Tax Saving (20%)" value={results.taxSaving} isTotal />

                {ownsVehicle === 'no' && (
                    <div className="mt-4 p-3 bg-amber-50 rounded-xl border border-amber-100">
                        <p className="text-[11px] text-amber-800 leading-snug">
                            <strong>Note:</strong> If you don't own the vehicle, you can typically only claim the actual costs incurred unless you use it for business purposes under specific conditions.
                        </p>
                    </div>
                )}
            </div>

            <Accordion title="HMRC Mileage Rates" isOpen={showDetails} onToggle={() => setShowDetails(!showDetails)}>
                <div className="cal-details-inr p-4 space-y-4">
                    <p className="text-sm leading-relaxed">
                        HMRC allows flat rates per mile for business travel. If your employer pays you less than these rates, you can claim tax relief on the difference.
                    </p>
                    <div className="space-y-1">
                        <div className="flex justify-between text-sm py-1 border-b border-gray-50">
                            <span className="text-gray-600">Car/Van (First 10k miles)</span>
                            <span className="font-bold">45p</span>
                        </div>
                        <div className="flex justify-between text-sm py-1 border-b border-gray-50">
                            <span className="text-gray-600">Car/Van (Over 10k miles)</span>
                            <span className="font-bold">25p</span>
                        </div>
                        <div className="flex justify-between text-sm py-1 border-b border-gray-50">
                            <span className="text-gray-600">Motorcycle</span>
                            <span className="font-bold">24p</span>
                        </div>
                        <div className="flex justify-between text-sm py-1 border-b border-gray-50">
                            <span className="text-gray-600">Bicycle</span>
                            <span className="font-bold">20p</span>
                        </div>
                    </div>
                </div>
            </Accordion>
        </Card>
    );
};
