import { getTaxConstants, DEFAULT_YEAR } from "./data/tax-rates.js";

/**
 * Calculates adjusted tax bands based on income (handling PA tapering).
 * HMRC: Allowance reduces by £1 for every £2 over £100k.
 * Subsequent band thresholds shift relative to the allowance, except for the fixed Higher Rate/Additional Rate cap (£125,140).
 */
export function getAdjustedBands(totalIncome, constants) {
    totalIncome = Math.max(0, Number(totalIncome));
    let pa = constants.personalAllowance || 12570;

    // 1. Tapering
    if (totalIncome > 100000) {
        const reduction = (totalIncome - 100000) / 2;
        pa = Math.max(0, pa - reduction);
    }

    // 2. Adjust thresholds
    // Standard Basic Rate band width is typically £37,700 (£50,270 - £12,570)
    const basePA = constants.personalAllowance || 12570;
    const basicRateBandWidth = (constants.incomeTaxBands?.[1]?.limit || 50270) - basePA;

    // Fixed Additional Rate threshold for recent years (alignment point for 0 PA)
    // For 2023-24 onwards it's £125,140. For older years it was £150,000.
    const additionalRateThreshold = constants.incomeTaxBands?.[2]?.limit || 125140;

    return [
        { name: "Personal Allowance", limit: pa, rate: 0 },
        { name: "Basic Rate", limit: pa + basicRateBandWidth, rate: constants.incomeTaxBands?.[1]?.rate || 0.20 },
        { name: "Higher Rate", limit: Math.max(pa + basicRateBandWidth, additionalRateThreshold), rate: constants.incomeTaxBands?.[2]?.rate || 0.40 },
        { name: "Additional Rate", limit: Infinity, rate: constants.incomeTaxBands?.[3]?.rate || 0.45 }
    ];
}

export function calculateStampDuty(price, options = {}) {
    const {
        taxYear = DEFAULT_YEAR,
        isFirstTime = false,
        isAdditional = false,
        isNonResident = false
    } = options;

    price = Number(price);
    const constants = getTaxConstants(taxYear) || {};

    // First-Time Buyer Relief (2025-26 rules)
    // 0% on first £300k, 5% on next £200k. No relief if price > £500k.
    // Note: Older years had different thresholds, but we'll focus on 2025-26 accuracy first.
    let bands = [...(constants.stampDutyResidential || [])];

    // Fallback if bands are missing for historic years
    if (bands.length === 0) {
        // Default standard rates (0% up to £125k)
        bands = [
            { threshold: 125000, rate: 0 },
            { threshold: 250000, rate: 0.02 },
            { threshold: 925000, rate: 0.05 },
            { threshold: 1500000, rate: 0.10 },
            { threshold: Infinity, rate: 0.12 },
        ];
    }
    // Note: The logic for First-Time Buyer Relief in 2025-26 vs older years
    // is now partially handled by the presence of these bands in constants.
    // However, if the user picks a year where FTB relief wasn't explicitly seeded,
    // we use the current logic but ensure it's not overriding the explicitly seeded holiday.
    if (isFirstTime && bands.length > 0) {
        if (taxYear === "2025-2026" && price <= 500000) {
            bands = [
                { threshold: 300000, rate: 0 },
                { threshold: 500000, rate: 0.05 },
                { threshold: 925000, rate: 0.05 },
                { threshold: 1500000, rate: 0.10 },
                { threshold: Infinity, rate: 0.12 },
            ];
        } else if (taxYear !== "2025-2026" && price <= 625000) {
            // Standard FTB rules for other years
            bands = [
                { threshold: 425000, rate: 0 },
                { threshold: 625000, rate: 0.05 },
                { threshold: 925000, rate: 0.05 },
                { threshold: 1500000, rate: 0.10 },
                { threshold: Infinity, rate: 0.12 },
            ];
        }
    }

    const additionalSurcharge = isAdditional ? (constants.stampDutyAdditionalSurcharge || 0) : 0;
    const nonResidentSurcharge = isNonResident ? 0.02 : 0;
    const totalSurcharge = additionalSurcharge + nonResidentSurcharge;

    let tax = 0;
    let prevThreshold = 0;
    const breakdown = [];

    for (const band of bands) {
        if (price > prevThreshold) {
            const limit = band.threshold === null || band.threshold === undefined ? Infinity : band.threshold;
            const amountInBand = Math.min(price, limit) - prevThreshold;
            const rate = band.rate + totalSurcharge;
            const bandTax = amountInBand * rate;

            tax += bandTax;

            breakdown.push({
                range: `£${prevThreshold.toLocaleString()} - ${band.threshold === Infinity ? 'Above' : '£' + band.threshold.toLocaleString()}`,
                amount: amountInBand,
                rate: rate,
                tax: bandTax
            });

            prevThreshold = limit;
        }
    }

    return { tax, breakdown };
}

export function calculateUberTax(earnings, expenses, otherIncome = 0, taxYear = DEFAULT_YEAR) {
    earnings = Number(earnings);
    expenses = Number(expenses);
    otherIncome = Number(otherIncome);

    const constants = getTaxConstants(taxYear);
    const tradingAllowance = constants.tradingAllowance || 1000;

    // 1. Calculate Profit (Using higher of actual expenses or £1000 Trading Allowance)
    const usedTradingAllowance = expenses < tradingAllowance;
    const effectiveExpenses = usedTradingAllowance ? tradingAllowance : expenses;
    const profit = Math.max(0, earnings - effectiveExpenses);

    // 2. Total Taxable Income (for Income Tax bands)
    const totalIncome = profit + otherIncome;

    // Helper for tiered calculations
    const calculateTiered = (amount, tiers) => {
        let total = 0;
        let prev = 0;
        for (const tier of tiers) {
            const limit = tier.limit || tier.threshold || Infinity;
            if (amount <= prev) break;
            const slice = Math.min(amount, limit) - prev;
            total += slice * tier.rate;
            prev = limit;
        }
        return total;
    };

    // 3. Income Tax: Calculate on total, then subtract what's already covered by other income
    const adjustedBands = getAdjustedBands(totalIncome, constants);
    const totalIncomeTax = calculateTieredTax(totalIncome, adjustedBands);
    const otherIncomeTax = calculateTieredTax(otherIncome, adjustedBands);
    const tax = Math.max(0, totalIncomeTax - otherIncomeTax);

    // 4. National Insurance (Class 4 for self-employed)
    // NI threshold is shared across total income for some rules, but Class 4 is on profit.
    // Standard approach: calculate NI on (Profit + otherIncome) and subtract NI on (otherIncome) 
    // to find the marginal NI due to the profit.
    const totalNI4 = calculateTiered(totalIncome, constants.niClass4);
    const otherNI4 = calculateTiered(otherIncome, constants.niClass4);
    let ni = Math.max(0, totalNI4 - otherNI4);

    // 5. Class 2 NI
    if (constants.niClass2) {
        const { weeklyRate, threshold } = constants.niClass2;
        if (profit >= threshold && weeklyRate > 0) {
            ni += (weeklyRate * 52);
        }
    }

    return {
        profit,
        tax,
        ni,
        totalTax: tax + ni,
        effectiveExpenses,
        usedTradingAllowance,
        totalIncome
    };
}

export function interpretTaxCode(code, taxYear = DEFAULT_YEAR) {
    if (!code) return { allowance: 0, description: "Invalid code", isNegative: false, type: "standard" };

    const cleanCode = code.toUpperCase().trim();
    const constants = getTaxConstants(taxYear);

    // ── 1. Static Codes (No Numbers) ───────────────────────────────────
    const staticCodes = {
        "BR": { allowance: 0, description: "Basic Rate (20% on all income)", type: "flat", rate: 0.20 },
        "D0": { allowance: 0, description: "Higher Rate (40% on all income)", type: "flat", rate: 0.40 },
        "D1": { allowance: 0, description: "Additional Rate (45% on all income)", type: "flat", rate: 0.45 },
        "0T": { allowance: 0, description: "No Personal Allowance", type: "standard" },
        "NT": { allowance: 0, description: "No Tax", type: "flat", rate: 0 },
    };

    if (staticCodes[cleanCode]) {
        return { ...staticCodes[cleanCode], isNegative: false };
    }

    // ── 2. Prefix K (Negative Allowance) ───────────────────────────────
    // e.g. K400 means £4,000 is added to your taxable income.
    if (cleanCode.startsWith('K')) {
        const numPart = cleanCode.substring(1).match(/^\d+/);
        if (numPart) {
            const amount = parseInt(numPart[0]) * 10;
            return {
                allowance: amount,
                description: "Tax due on extra income (Negative Allowance)",
                isNegative: true,
                type: "negative"
            };
        }
    }

    // ── 3. Standard Suffixes (L, M, N, T, S, C) ────────────────────────
    // e.g. 1257L, S1257L, C1257L
    const suffixMatch = cleanCode.match(/^([SC]?)(\d+)([LMNT])$/);
    if (suffixMatch) {
        const prefix = suffixMatch[1]; // S or C
        const number = parseInt(suffixMatch[2]);
        const suffix = suffixMatch[3]; // L, M, N, or T
        const allowance = number * 10;

        let description = "Standard personal allowance";
        if (suffix === 'M') description = "Marriage allowance (Received)";
        if (suffix === 'N') description = "Marriage allowance (Given)";
        if (suffix === 'T') description = "HMRC review needed / Variable";

        if (prefix === 'S') description += " (Scottish rates)";
        if (prefix === 'C') description += " (Welsh rates)";

        return { allowance, description, isNegative: false, type: "standard", regional: prefix };
    }

    // ── 4. Fallback ──────────────────────────────────────────────────
    return {
        allowance: constants.personalAllowance,
        description: "Default personal allowance",
        isNegative: false,
        type: "standard"
    };
}

/**
 * Calculates estimated income tax based on salary and a parsed tax code.
 */
export function calculateTaxFromCode(salary, code, taxYear = DEFAULT_YEAR) {
    salary = Math.max(0, Number(salary));
    const info = interpretTaxCode(code, taxYear);
    const constants = getTaxConstants(taxYear);

    // 1. Income Tax Calculation
    let incomeTax = 0;
    if (info.type === "flat") {
        incomeTax = salary * info.rate;
    } else {
        // For tax code checks, we use the allowance derived from the code
        // and adjust the thresholds relative to it.
        const basePA = constants.personalAllowance || 12570;
        const basicRateBandWidth = (constants.incomeTaxBands?.[1]?.limit || 50270) - basePA;
        const additionalRateThreshold = constants.incomeTaxBands?.[2]?.limit || 125140;

        const pa = info.allowance * (info.isNegative ? -1 : 1);

        const adjustedBands = [
            { name: "Personal Allowance", limit: Math.max(0, pa), rate: 0 },
            { name: "Basic Rate", limit: Math.max(0, pa) + basicRateBandWidth, rate: constants.incomeTaxBands?.[1]?.rate || 0.20 },
            { name: "Higher Rate", limit: Math.max(Math.max(0, pa) + basicRateBandWidth, additionalRateThreshold), rate: constants.incomeTaxBands?.[2]?.rate || 0.40 },
            { name: "Additional Rate", limit: Infinity, rate: constants.incomeTaxBands?.[3]?.rate || 0.45 }
        ];

        // Handle K codes (negative allowance)
        const taxableIncome = info.isNegative ? salary + info.allowance : salary;
        incomeTax = calculateTieredTax(taxableIncome, adjustedBands);
    }

    // 2. National Insurance Calculation (Class 1 Employee)
    const ni = calculateTieredTax(salary, constants.niClass1);

    const totalDeductions = incomeTax + ni;
    const netPay = Math.max(0, salary - totalDeductions);

    return {
        annualTax: incomeTax,
        annualNI: ni,
        annualNet: netPay,
        monthlyTax: incomeTax / 12,
        monthlyNI: ni / 12,
        monthlyNet: netPay / 12,
        info
    };
}

/**
 * Helper to calculate tax across standard UK bands.
 */
export function calculateTieredTax(income, bands) {
    let tax = 0;
    let prevLimit = 0;
    for (const band of bands) {
        if (income <= prevLimit) break;
        const slice = Math.min(income, band.limit || Infinity) - prevLimit;
        tax += slice * band.rate;
        prevLimit = band.limit || Infinity;
    }
    return Math.max(0, tax);
}

export function calculateMileageRelief(miles, options = {}) {
    const {
        ratePaid = 0,
        taxYear = DEFAULT_YEAR,
        vehicleType = 'car',
        taxRate = 0.20
    } = options;

    const milesNum = Number(miles);
    const ratePaidNum = Number(ratePaid);
    const constants = getTaxConstants(taxYear);
    const defaultRates = [
        { limit: 10000, rate: 0.45 },
        { limit: Infinity, rate: 0.25 },
    ];

    // Support both old array format and new object format for mileageRates
    let standardRates = [];
    const ratesSource = constants.mileageRates;

    if (Array.isArray(ratesSource)) {
        standardRates = ratesSource;
    } else if (ratesSource && typeof ratesSource === 'object') {
        standardRates = ratesSource[vehicleType] || ratesSource.car || defaultRates;
    } else {
        // Fallback for older years where mileageRates might be missing in historic data
        standardRates = defaultRates;
    }

    let allowance = 0;
    let prevLimit = 0;
    for (const band of standardRates) {
        if (milesNum > prevLimit) {
            const limit = band.limit === null || band.limit === undefined ? Infinity : band.limit;
            const milesInBand = Math.min(milesNum, limit) - prevLimit;
            allowance += milesInBand * band.rate;
            prevLimit = limit;
        }
    }

    const actuallyPaid = milesNum * ratePaidNum;
    const reliefAmount = Math.max(0, allowance - actuallyPaid);

    return {
        allowance,
        actuallyPaid,
        reliefAmount,
        taxSaving: reliefAmount * taxRate
    };
}

export function calculateDividendTax(dividends, otherIncome = 0, taxYear = DEFAULT_YEAR, source = 'general') {
    if (source === 'isa') {
        return { taxable: 0, tax: 0, allowanceUsed: 0, paUsed: 0, isFree: true };
    }
    dividends = Number(dividends);
    otherIncome = Number(otherIncome);
    const constants = getTaxConstants(taxYear);

    // 1. Determine Personal Allowance (accounting for tapering)
    let pa = constants.personalAllowance || 12570;
    const totalIncome = dividends + otherIncome;
    if (totalIncome > 100000) {
        const reduction = (totalIncome - 100000) / 2;
        pa = Math.max(0, pa - reduction);
    }

    // 2. See how much Personal Allowance is used by other income first
    const paUsedByOther = Math.min(otherIncome, pa);
    const remainingPA = pa - paUsedByOther;

    // 3. Apply remaining PA to dividends
    const dividendsAfterPA = Math.max(0, dividends - remainingPA);

    // 4. Apply Dividend Allowance
    const allowance = constants.dividendAllowance || 0;
    const taxableDividends = Math.max(0, dividendsAfterPA - allowance);

    // 5. Calculate tax based on bands
    // We need to know where the dividends sit relative to income tax bands
    // The "income" for band purposes is (otherIncome + dividendsAfterPA)
    let tax = 0;
    let currentTotal = otherIncome + (dividendsAfterPA - taxableDividends); // point where taxable dividends start

    const bands = constants.incomeTaxBands || [];
    const rates = constants.dividendRates || { basic: 0.0875, higher: 0.3375, additional: 0.3935 };

    let remainingTaxable = taxableDividends;

    // We skip the first band (Personal Allowance) as we handled it manually/adjusted it
    // Thresholds: Basic up to 50270, Higher up to 125140, Additional above
    const thresholds = [
        { limit: bands[1]?.limit || 50270, rate: rates.basic },
        { limit: bands[2]?.limit || 125140, rate: rates.higher },
        { limit: Infinity, rate: rates.additional }
    ];

    for (const threshold of thresholds) {
        if (remainingTaxable <= 0) break;

        if (currentTotal < threshold.limit) {
            const spaceInBand = threshold.limit - currentTotal;
            const chunk = Math.min(remainingTaxable, spaceInBand);
            tax += chunk * threshold.rate;
            remainingTaxable -= chunk;
            currentTotal += chunk;
        }
    }

    return {
        taxable: taxableDividends,
        tax: tax,
        allowanceUsed: allowance,
        paUsed: remainingPA
    };
}

export function calculateCryptoTax(gain, taxBand = "basic", taxYear = DEFAULT_YEAR) {
    gain = Number(gain);
    const constants = getTaxConstants(taxYear);
    const allowance = constants.cryptoAllowance || 0;
    const taxable = Math.max(0, gain - allowance);

    const rates = constants.cryptoRates || { basic: 0.10, higher: 0.20 };
    const rate = taxBand === "basic" ? rates.basic : rates.higher;

    return {
        gain,
        allowance,
        taxable,
        rate,
        tax: taxable * rate
    };
}

export function calculateCorporationTax(profit, taxYear = DEFAULT_YEAR) {
    profit = Number(profit);
    const allConstants = getTaxConstants(taxYear);
    const constants = allConstants.corporationTax || {
        smallProfitLimit: 50000,
        upperLimit: 250000,
        smallRate: 0.19,
        mainRate: 0.25
    };

    // Thresholds
    const smallLimit = constants.smallProfitLimit;
    const upperLimit = constants.upperLimit || 250000;

    let tax;
    if (profit <= smallLimit) {
        // Small profits rate applies
        tax = profit * constants.smallRate;
    } else if (profit > upperLimit) {
        // Main rate applies
        tax = profit * constants.mainRate;
    } else {
        // Marginal relief zone
        // Marginal Relief = (Upper Limit - Profit) * (Main Rate - Small Rate) * (Small Profit Limit / (Upper Limit - Small Profit Limit))
        const range = upperLimit - smallLimit;
        const mrFraction = (constants.mainRate - constants.smallRate) * (smallLimit / range);
        tax = (profit * constants.mainRate) - ((upperLimit - profit) * mrFraction);
    }

    return {
        profit,
        tax,
        netProfit: profit - tax
    };
}
