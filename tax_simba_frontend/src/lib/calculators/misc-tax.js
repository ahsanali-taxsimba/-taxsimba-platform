import { getTaxConstants, DEFAULT_YEAR } from "./data/tax-rates.js";
import { calculateTieredTax, getAdjustedBands } from "./specialized-tax.js";

export function calculatePensionTaxRelief(contribution, taxRate, taxYear = DEFAULT_YEAR, schemeType = "relief_at_source") {
    contribution = Number(contribution);
    taxRate = Number(taxRate);

    if (schemeType === "net_pay") {
        // Net pay: Contribution is taken before tax. 
        // Gross contribution is effectively the input contribution.
        const grossContribution = contribution;
        const totalTaxRelief = contribution * taxRate;

        return {
            netPayment: contribution - totalTaxRelief,
            grossContribution,
            basicRelief: contribution * 0.20,
            extraRelief: taxRate > 0.20 ? contribution * (taxRate - 0.20) : 0,
            totalRelief: totalTaxRelief,
            actualCost: contribution - totalTaxRelief
        };
    } else {
        // Most personal pensions: Relief at source (20% added)
        const netPayment = contribution;
        const grossContribution = netPayment / 0.8;
        const totalTaxRelief = grossContribution - netPayment;

        // Extra relief for higher rate
        let extraRelief = 0;
        if (taxRate > 0.20) {
            extraRelief = grossContribution * (taxRate - 0.20);
        }

        return {
            netPayment,
            grossContribution,
            basicRelief: totalTaxRelief,
            extraRelief,
            totalRelief: totalTaxRelief + extraRelief,
            actualCost: grossContribution - (totalTaxRelief + extraRelief)
        };
    }
}


export function calculateChildBenefit(numChildren, annualIncome, taxYear = DEFAULT_YEAR) {
    numChildren = Math.max(0, Number(numChildren));
    annualIncome = Number(annualIncome);
    const constants = getTaxConstants(taxYear).childBenefit ?? {
        // Fallback to 2025-26 rates ONLY if the selected tax year has NO child benefit data at all
        threshold: 60000,
        taperEnd: 80000,
        firstChild: 26.05,
        additionalChild: 17.25
    };

    const firstChildRate = constants.firstChild;    // weekly rate for eldest child
    const additionalChildRate = constants.additionalChild; // weekly rate per extra child

    // HMRC: benefit = first child rate + (n-1) additional rates, × 52 weeks per year
    // Guard: 0 children = £0 benefit
    let weeklyBenefit = 0;
    if (numChildren >= 1) {
        weeklyBenefit = firstChildRate + Math.max(0, numChildren - 1) * additionalChildRate;
    }
    const annualBenefit = weeklyBenefit * 52;

    let hichcCharge = 0;
    let repaymentPercent = 0;

    if (annualIncome > constants.threshold) {
        // HMRC rule: 1% of the annual child benefit for every £X of income above the threshold.
        // For years up to 2023/24: £100 (divisor=100)
        // For 2024/25 and 2025/26: £200 (divisor=200)
        const excess = annualIncome - constants.threshold;
        const taperRange = (constants.taperEnd || 60000) - constants.threshold;
        const divisor = taperRange / 100;

        repaymentPercent = Math.min(100, Math.floor(excess / divisor));
        hichcCharge = annualBenefit * (repaymentPercent / 100);
    }

    return {
        weeklyBenefit,
        annualBenefit: Math.round(annualBenefit * 100) / 100,
        hichcCharge: Math.round(Math.max(0, hichcCharge) * 100) / 100,
        netAnnualBenefit: Math.round(Math.max(0, annualBenefit - hichcCharge) * 100) / 100,
        repaymentPercent
    };
}

/**
 * Compute filing deadline (31 Jan) from a tax year string.
 * e.g. "2023-2024" → tax year ends April 2024 → deadline is 31 Jan 2025
 * e.g. "2025-2026" → tax year ends April 2026 → deadline is 31 Jan 2027
 *
 * HMRC rule: Self Assessment online returns for tax year X/Y are due
 * by 31 January of the calendar year AFTER the tax year ends.
 */
export function getFilingDeadline(taxYear) {
    const endYear = parseInt(taxYear.split("-")[1], 10);
    return new Date(endYear + 1, 0, 31); // 31 January of the year AFTER the tax year ends
}

/**
 * Full HMRC late tax return + late payment penalty calculator.
 *
 * @param {Object} params
 * @param {string}  params.taxYear        - e.g. "2023-2024"
 * @param {number}  params.taxDue         - amount of tax owed (0 if none)
 * @param {Date|null} params.submissionDate - actual return submission date, or null = not yet submitted
 * @param {Date|null} params.paymentDate  - actual payment date, or null = not yet paid
 * @param {boolean} params.owesTax        - whether any tax is owed at all
 * @returns {{ filingBreakdown, filingPenalty, paymentBreakdown, paymentPenalty, interest, taxDue, total }}
 */
export function calculateLatePenalty({
    taxYear = DEFAULT_YEAR,
    taxDue = 0,
    submissionDate = null,
    paymentDate = null,
    owesTax = false,
} = {}) {
    taxDue = owesTax ? Number(taxDue) : 0;

    const deadline = getFilingDeadline(taxYear);
    const today = new Date();

    // Days late for filing
    const filingEndDate = submissionDate ? new Date(submissionDate) : today;
    const filingDaysLate = Math.max(0, Math.floor((filingEndDate - deadline) / 86400000));

    // Days late for payment
    const paymentEndDate = paymentDate ? new Date(paymentDate) : today;
    const paymentDaysLate = Math.max(0, Math.floor((paymentEndDate - deadline) / 86400000));

    // ── Filing penalty (4-stage HMRC rules) ──────────────────────────────
    const filingBreakdown = [];
    let filingPenalty = 0;

    if (filingDaysLate > 0) {
        filingBreakdown.push({ label: "Initial Fixed Penalty (1 day late)", amount: 100 });
        filingPenalty += 100;
    }
    if (filingDaysLate > 90) {
        const dailyDays = Math.min(90, filingDaysLate - 90);
        const dailyAmount = dailyDays * 10;
        filingBreakdown.push({ label: `Daily Penalties (£10/day × ${dailyDays} days, months 3–6)`, amount: dailyAmount });
        filingPenalty += dailyAmount;
    }
    if (filingDaysLate > 180) {
        const p = Math.max(300, taxDue * 0.05);
        filingBreakdown.push({ label: "6-Month Surcharge (5% of tax or £300, whichever greater)", amount: p });
        filingPenalty += p;
    }
    if (filingDaysLate > 365) {
        const p = Math.max(300, taxDue * 0.05);
        filingBreakdown.push({ label: "12-Month Surcharge (5% of tax or £300, whichever greater)", amount: p });
        filingPenalty += p;
    }

    // ── Late payment penalty (HMRC surcharges on unpaid tax) ─────────────
    const paymentBreakdown = [];
    let paymentPenalty = 0;
    let interest = 0;

    if (owesTax && taxDue > 0) {
        // 5% surcharge at 30 days
        if (paymentDaysLate > 30) {
            const s = taxDue * 0.05;
            paymentBreakdown.push({ label: "30-Day Surcharge (5% of unpaid tax)", amount: s });
            paymentPenalty += s;
        }
        // 5% surcharge at 6 months (182 days)
        if (paymentDaysLate > 182) {
            const s = taxDue * 0.05;
            paymentBreakdown.push({ label: "6-Month Surcharge (5% of unpaid tax)", amount: s });
            paymentPenalty += s;
        }
        // 5% surcharge at 12 months (365 days)
        if (paymentDaysLate > 365) {
            const s = taxDue * 0.05;
            paymentBreakdown.push({ label: "12-Month Surcharge (5% of unpaid tax)", amount: s });
            paymentPenalty += s;
        }
        // HMRC late payment interest: 8.00% p.a. (BoE base rate + 4%, effective 6 April 2025)
        if (paymentDaysLate > 0) {
            const annualRate = 0.08;
            const dailyRate = annualRate / 365;
            interest = Math.round(taxDue * dailyRate * paymentDaysLate * 100) / 100;
            paymentBreakdown.push({ label: `HMRC Interest (8.00% p.a. × ${paymentDaysLate} days)`, amount: interest });
        }
    }

    const total = Math.round((taxDue + filingPenalty + paymentPenalty + interest) * 100) / 100;

    return {
        filingDaysLate,
        paymentDaysLate,
        filingBreakdown,
        filingPenalty: Math.round(filingPenalty * 100) / 100,
        paymentBreakdown,
        paymentPenalty: Math.round(paymentPenalty * 100) / 100,
        interest: Math.round(interest * 100) / 100,
        taxDue,
        total,
        deadline,
    };
}

/**
 * Full UK rental income tax calculator (2020/21+ rules).
 *
 * Supports two landlord types:
 *  - "buy_to_let"   : Standard rules — £1,000 property allowance, 20% mortgage interest credit.
 *  - "rent_a_room"  : Rent-a-Room scheme — £7,500 tax-free allowance, no mortgage credit.
 *
 * @param {number} annualRent         – Gross annual rental income
 * @param {number} allowableExpenses  – Allowable expenses (buy_to_let only)
 * @param {number} mortgageInterest   – Annual mortgage interest (buy_to_let only, 20% credit)
 * @param {number} annualSalary       – Employment / other income
 * @param {string} taxYear            – e.g. "2025-2026"
 * @param {string} landlordType       – "buy_to_let" | "rent_a_room"
 */
export function calculateRentalTax(
    annualRent,
    allowableExpenses,
    mortgageInterest = 0,
    annualSalary = 0,
    taxYear = DEFAULT_YEAR,
    landlordType = "buy_to_let"
) {
    annualRent = Number(annualRent);
    allowableExpenses = Number(allowableExpenses);
    mortgageInterest = Number(mortgageInterest);
    annualSalary = Number(annualSalary);

    const constants = getTaxConstants(taxYear);
    const bands = constants.incomeTaxBands; // [{limit, rate}, …]

    // ── Helper – income tax across UK bands ────────────────────────────────
    function calcTaxOnIncome(income) {
        const adjustedBands = getAdjustedBands(income, constants);
        return calculateTieredTax(income, adjustedBands);
    }

    // ══════════════════════════════════════════════════════════════════════
    // SCHEME A: Rent-a-Room (room in landlord's own home)
    // HMRC rule: first £7,500 of gross rent is tax-free.
    // If rent ≤ £7,500 → no tax at all.
    // If rent > £7,500 → tax only on the excess above £7,500, at marginal rate.
    // Mortgage interest / allowable expenses cannot be claimed under this scheme.
    // ══════════════════════════════════════════════════════════════════════
    if (landlordType === "rent_a_room") {
        const RENT_A_ROOM_ALLOWANCE = constants.rentARoomAllowance || 7500;
        const taxableExcess = Math.max(0, annualRent - RENT_A_ROOM_ALLOWANCE);

        // Taxable excess sits on top of salary
        const totalGrossIncome = annualSalary + taxableExcess;
        const totalTax = calcTaxOnIncome(totalGrossIncome);
        const salaryOnlyTax = calcTaxOnIncome(annualSalary);
        const propertyTaxToPay = Math.max(0, totalTax - salaryOnlyTax);
        const afterTaxRentalIncome = annualRent - propertyTaxToPay;

        return {
            landlordType,
            annualRent,
            effectiveDeduction: Math.min(RENT_A_ROOM_ALLOWANCE, annualRent),
            allowanceLabel: "£7,500 tax-free Rent-A-Room allowance",
            usedPropertyAllowance: false,
            rentARoomAllowance: RENT_A_ROOM_ALLOWANCE,
            rentalProfit: taxableExcess,          // taxable portion above allowance
            annualSalary,
            totalGrossIncome,
            rentalTaxBeforeCredit: propertyTaxToPay,
            mortgageCredit: 0,                    // not available under Rent-a-Room
            propertyTaxToPay,
            afterTaxRentalIncome,
        };
    }

    // ══════════════════════════════════════════════════════════════════════
    // SCHEME B: Buy to Let (separate property)
    // HMRC property allowance: £1,000 if no expenses declared.
    // Mortgage interest → 20% tax credit (not a profit deduction, post Apr 2020).
    // ══════════════════════════════════════════════════════════════════════
    const PROPERTY_ALLOWANCE = constants.tradingAllowance || 1000;
    const usePropertyAllowance = allowableExpenses === 0;
    const effectiveDeduction = usePropertyAllowance
        ? Math.min(PROPERTY_ALLOWANCE, annualRent)
        : allowableExpenses;

    const rentalProfit = Math.max(0, annualRent - effectiveDeduction);
    const totalGrossIncome = annualSalary + rentalProfit;
    const totalTax = calcTaxOnIncome(totalGrossIncome);
    const salaryOnlyTax = calcTaxOnIncome(annualSalary);
    const rentalTaxBeforeCredit = Math.max(0, totalTax - salaryOnlyTax);
    const mortgageCredit = mortgageInterest * 0.20;
    const propertyTaxToPay = Math.max(0, rentalTaxBeforeCredit - mortgageCredit);
    const afterTaxRentalIncome = annualRent - propertyTaxToPay;

    return {
        landlordType,
        annualRent,
        effectiveDeduction,
        allowanceLabel: usePropertyAllowance ? "£1,000 tax-free property allowance" : "Allowable expenses deducted",
        usedPropertyAllowance: usePropertyAllowance,
        rentARoomAllowance: 0,
        rentalProfit,
        annualSalary,
        totalGrossIncome,
        rentalTaxBeforeCredit,
        mortgageCredit,
        propertyTaxToPay,
        afterTaxRentalIncome,
    };
}


export function calculateCISRebate(cisDeducted, grossIncome, expenses, taxYear = DEFAULT_YEAR, otherIncome = 0, employmentStatus = "self_employed") {
    cisDeducted = Number(cisDeducted); // The amount already taken by contractor or employer
    grossIncome = Number(grossIncome); // Total pay before tax
    expenses = Number(expenses);
    otherIncome = Number(otherIncome);

    const constants = getTaxConstants(taxYear);
    const isSelfEmployed = employmentStatus === "self_employed";

    // 1. Calculate Taxable Profit/Income
    let businessProfit = 0;
    let effectiveExpenses = 0;
    let usedTradingAllowance = false;

    if (isSelfEmployed) {
        // Trading allowance (£1,000) vs actual expenses
        const tradingAllowance = constants.tradingAllowance || 1000;
        usedTradingAllowance = expenses < tradingAllowance;
        effectiveExpenses = usedTradingAllowance ? tradingAllowance : expenses;
        businessProfit = Math.max(0, grossIncome - effectiveExpenses);
    } else {
        // PAYE: Usually no expenses/trading allowance (simplified for this calculator)
        businessProfit = grossIncome;
    }

    // 2. Total Taxable Income (for Income Tax)
    const totalTaxableIncome = businessProfit + otherIncome;

    // 3. Income Tax calculation
    const adjustedBands = getAdjustedBands(totalTaxableIncome, constants);
    const incomeTax = calculateTieredTax(totalTaxableIncome, adjustedBands);

    // 4. National Insurance calculation
    let ni = 0;
    let niBreakdown = [];
    if (isSelfEmployed) {
        // Class 4 NI for Self-Employed
        ni = calculateTieredTax(businessProfit, constants.niClass4);
        niBreakdown.push({ type: "Class 4", amount: ni });

        // Class 2 NI
        if (constants.niClass2) {
            const { weeklyRate, threshold } = constants.niClass2;
            if (businessProfit >= threshold && weeklyRate > 0) {
                const class2Amount = weeklyRate * 52;
                ni += class2Amount;
                niBreakdown.push({ type: "Class 2", amount: class2Amount });
            }
        }
    } else {
        // Class 1 NI for PAYE
        ni = calculateTieredTax(businessProfit, constants.niClass1);
        niBreakdown.push({ type: "Class 1", amount: ni });
    }

    const totalTaxOwed = incomeTax + ni;
    const rebate = Math.max(0, cisDeducted - totalTaxOwed);
    const extraTaxToPay = Math.max(0, totalTaxOwed - cisDeducted);

    return {
        grossIncome,
        businessProfit,
        totalTaxableIncome,
        incomeTax,
        ni,
        niType: isSelfEmployed ? "Class 4" : "Class 1",
        totalTaxOwed,
        cisDeducted,
        rebate,
        extraTaxToPay,
        usedTradingAllowance,
        effectiveExpenses,
        employmentStatus
    };
}

export function calculateEbayTax(revenue, itemCost, fees, shipping, otherExpenses, taxYear = DEFAULT_YEAR, otherIncome = 0) {
    revenue = Number(revenue);
    itemCost = Number(itemCost);
    fees = Number(fees);
    shipping = Number(shipping);
    otherExpenses = Number(otherExpenses);
    otherIncome = Number(otherIncome);

    const actualExpenses = itemCost + fees + shipping + otherExpenses;
    const constants = getTaxConstants(taxYear);
    const tradingAllowance = constants.tradingAllowance || 1000;

    // Trading Allowance: Deduct higher of actual expenses or £1,000
    const usedTradingAllowance = actualExpenses < tradingAllowance;
    const effectiveExpenses = usedTradingAllowance ? tradingAllowance : actualExpenses;
    const businessProfit = Math.max(0, revenue - effectiveExpenses);

    // Total Taxable Income (for Income Tax)
    const totalTaxableIncome = businessProfit + otherIncome;

    const adjustedBands = getAdjustedBands(totalTaxableIncome, constants);
    const totalIncomeTax = calculateTieredTax(totalTaxableIncome, adjustedBands);
    const salaryOnlyTax = calculateTieredTax(otherIncome, adjustedBands);
    const incomeTax = Math.max(0, totalIncomeTax - salaryOnlyTax);

    // National Insurance (Class 4 for eBay sellers / self-employed)
    // NI is calculated on business profit.
    let ni = calculateTieredTax(businessProfit, constants.niClass4);

    // Class 2 NI
    let class2Bonus = 0;
    if (constants.niClass2) {
        const { weeklyRate, threshold } = constants.niClass2;
        if (businessProfit >= threshold && weeklyRate > 0) {
            class2Bonus = weeklyRate * 52;
            ni += class2Bonus;
        }
    }

    return {
        revenue,
        actualExpenses,
        effectiveExpenses,
        usedTradingAllowance,
        businessProfit,
        incomeTax,
        ni,
        totalTax: incomeTax + ni,
        netProfit: revenue + otherIncome - actualExpenses - (incomeTax + ni)
    };
}
