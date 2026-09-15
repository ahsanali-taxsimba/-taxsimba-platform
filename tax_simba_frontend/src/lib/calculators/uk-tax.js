import { getTaxConstants, DEFAULT_YEAR } from "./data/tax-rates.js";

export const UK_TAX_YEAR = DEFAULT_YEAR;

export function calculateIncomeTax(annualIncome, taxYear = DEFAULT_YEAR, options = {}) {
  const { pension = 0, blindPerson = false, marriageAllowance = false, type = "employed", expenses = 0 } = options;
  const constants = getTaxConstants(taxYear);

  let incomeToTax = Number(annualIncome);

  // For self-employed, apply trading allowance if expenses aren't provided/lower
  if (type === "self-employed") {
    const exp = Number(expenses);
    const tradingAllowance = constants.tradingAllowance || 0;
    const effectiveExpenses = Math.max(exp, tradingAllowance);
    incomeToTax = Math.max(0, incomeToTax - effectiveExpenses);
  }

  // Deduct pension from taxable income
  const taxableIncomeAfterPension = Math.max(0, incomeToTax - Number(pension));
  let tax = 0;
  let bandsUsed = [];

  // Base allowance
  let allowance = constants.personalAllowance;

  // Add Blind Person's Allowance
  if (blindPerson) {
    allowance += (constants.blindPersonsAllowance || 0);
  }

  // Add Marriage Allowance transfer (Assuming receiving)
  if (marriageAllowance) {
    allowance += (constants.marriageAllowance || 0);
  }

  // Adjusted allowance for high earners (tapering kicks in after £100k)
  // HMRC rule: Personal Allowance reduces by £1 for every £2 of income above £100,000.
  // At £125,140 the allowance reaches zero.
  let allowanceReduction = 0;
  if (taxableIncomeAfterPension > 100000) {
    const excess = taxableIncomeAfterPension - 100000;
    const taperAmount = Math.floor(excess / 2);
    allowanceReduction = Math.min(allowance, taperAmount);
    allowance = Math.max(0, allowance - taperAmount);
  }

  // Build adjusted bands: PA band uses dynamic allowance, Basic Rate shifts down
  // by the same amount the PA was reduced. Higher Rate/Additional Rate limits remain fixed.
  const bands = constants.incomeTaxBands.map(band => {
    if (band.name === "Personal Allowance") {
      return { ...band, limit: allowance };
    }
    if (band.name === "Basic Rate") {
      return { ...band, limit: band.limit - allowanceReduction };
    }
    return band;
  });

  // Walk the bands in order. prevLimit tracks the upper edge of the previous band.
  // For income above the PA ceiling, basic-rate width = 50270 - allowance (not - 12570),
  // so the extra income that was freed by PA reduction correctly falls into higher bands.
  let prevLimit = 0;
  for (const band of bands) {
    if (taxableIncomeAfterPension > prevLimit) {
      const taxableInBand = Math.min(taxableIncomeAfterPension, band.limit) - prevLimit;
      const taxInBand = Math.max(0, taxableInBand) * band.rate;
      tax += taxInBand;

      bandsUsed.push({
        name: band.name,
        range: `${prevLimit === 0 ? "£0" : `£${prevLimit + 1}`} - ${band.limit === Infinity ? "Over" : `£${band.limit}`}`,
        rate: `${band.rate * 100}%`,
        taxAmount: taxInBand,
        taxableAmount: taxableInBand
      });

      prevLimit = band.limit;
    }
  }
  return { totalTax: Math.max(0, tax), bands: bandsUsed, allowance };
}

export function calculateNI(annualIncome, type = "employed", taxYear = DEFAULT_YEAR, options = {}) {
  const { pension = 0 } = options;
  // NI calculation usually doesn't deduct pension unless it's Salary Sacrifice.
  // We'll keep it simple for now and only apply to Profit if self-employed.
  const constants = getTaxConstants(taxYear);
  const bandsConfig = type === "employed" ? constants.niClass1 : constants.niClass4;

  // For self-employed, apply trading allowance if expenses aren't provided/lower
  if (type === "self-employed") {
    const expenses = Number(options.expenses || 0);
    const tradingAllowance = constants.tradingAllowance || 0;
    const effectiveExpenses = Math.max(expenses, tradingAllowance);
    annualIncome = Math.max(0, annualIncome - effectiveExpenses);
  }

  let ni = 0;
  let bandsUsed = [];
  let prevLimit = 0;

  // Class 2 NI calculation (flat rate)
  if (type === "self-employed" && constants.niClass2) {
    const { weeklyRate, threshold } = constants.niClass2;
    if (annualIncome >= threshold && weeklyRate > 0) {
      const class2Amount = weeklyRate * 52;
      ni += class2Amount;
      bandsUsed.push({
        range: "Class 2 Flat Rate",
        rate: "Flat Rate",
        niAmount: class2Amount
      });
    }
  }

  for (const band of bandsConfig) {
    if (annualIncome > prevLimit) {
      const taxableInBand = Math.min(annualIncome, band.limit) - prevLimit;
      const niInBand = Math.max(0, taxableInBand) * band.rate;
      ni += niInBand;

      bandsUsed.push({
        range: `${prevLimit === 0 ? "£0" : `£${prevLimit + 1}`} - ${band.limit === Infinity ? "Over" : `£${band.limit}`}`,
        rate: `${band.rate * 100}%`,
        niAmount: niInBand
      });

      prevLimit = band.limit;
    }
  }
  return { totalNI: Math.max(0, ni), bands: bandsUsed };
}

export function calculateStudentLoan(annualSalary, plan = "none", taxYear = DEFAULT_YEAR) {
  if (plan === "none") return 0;
  const constants = getTaxConstants(taxYear);
  if (!constants.studentLoanPlans || !constants.studentLoanPlans[plan]) return 0;

  const planConfig = constants.studentLoanPlans[plan];
  if (annualSalary > planConfig.threshold) {
    return (annualSalary - planConfig.threshold) * planConfig.rate;
  }
  return 0;
}

export function getPeriodicBreakdown(annualValue) {
  return {
    annual: annualValue,
    monthly: annualValue / 12,
    weekly: annualValue / 52,
    daily: annualValue / 365
  };
}

export function calculateSalaryAfterTax(annualSalary, taxYear = DEFAULT_YEAR, options = {}) {
  const { pension = 0, studentLoanPlan = "none", blindPerson = false, marriageAllowance = false, type = "employed", expenses = 0 } = options;
  const salaryNum = Number(annualSalary);
  const expensesNum = Number(expenses);

  const taxResults = calculateIncomeTax(salaryNum, taxYear, { pension, blindPerson, marriageAllowance, type, expenses: expensesNum });
  const niResults = calculateNI(salaryNum, type, taxYear, { expenses: expensesNum });
  const studentLoanRepayment = calculateStudentLoan(salaryNum, studentLoanPlan, taxYear);

  const totalDeductions = taxResults.totalTax + niResults.totalNI + Number(pension) + studentLoanRepayment;

  // Real Take Home = Gross Turnover - Actual Expenses - Tax - NI - Pension - Student Loan
  const takeHomeInput = type === "self-employed" ? (salaryNum - expensesNum) : salaryNum;
  const takeHome = takeHomeInput - totalDeductions;

  return {
    gross: getPeriodicBreakdown(salaryNum),
    incomeTax: getPeriodicBreakdown(taxResults.totalTax),
    ni: getPeriodicBreakdown(niResults.totalNI),
    pension: getPeriodicBreakdown(Number(pension)),
    studentLoan: getPeriodicBreakdown(studentLoanRepayment),
    totalDeductions: getPeriodicBreakdown(totalDeductions),
    takeHome: getPeriodicBreakdown(takeHome),
    taxBands: taxResults.bands,
    niBands: niResults.bands,
    allowance: taxResults.allowance
  };
}

export function calculateNationalInsuranceCap(salary, profit, taxYear = DEFAULT_YEAR) {
  const constants = getTaxConstants(taxYear);
  const pt = constants.niClass1[0].limit; // Primary Threshold
  const uel = constants.niClass1[1].limit; // Upper Earnings Limit
  const class4Rate = constants.niClass4[1].rate;
  const higherRate = constants.niClass4[2]?.rate || 0.02;

  // 1. Employee NI is calculated normally on salary
  const employeeNIResult = calculateNI(salary, "employed", taxYear);
  const employeeNI = employeeNIResult.totalNI;

  // 2. Class 2 NI
  let class2NI = 0;
  if (constants.niClass2) {
    const { weeklyRate, threshold } = constants.niClass2;
    if (profit >= threshold && weeklyRate > 0) {
      class2NI = weeklyRate * 52;
    }
  }

  // 3. Class 4 NI with Cap (Regulation 100 interaction)
  // The cap ensures total NI (mostly) sticks to the higher rate (2%) after total earnings hit UEL
  const totalIncome = salary + profit;
  const amountAboveUEL = Math.max(0, totalIncome - uel);
  const profitInHigherBand = Math.min(profit, amountAboveUEL);
  const profitInMainBand = profit - profitInHigherBand;

  const amountBelowPT = Math.max(0, pt - salary);
  const taxableProfitInMainBand = Math.max(0, profitInMainBand - amountBelowPT);

  const class4NI = (taxableProfitInMainBand * class4Rate) + (profitInHigherBand * higherRate);

  return {
    employeeNI,
    class2NI,
    class4NI,
    totalNI: employeeNI + class2NI + class4NI,
    bands: [
      ...employeeNIResult.bands.map(b => ({ ...b, type: "Class 1" })),
      ...(class2NI > 0 ? [{ range: "Class 2 Flat Rate", rate: "Flat Rate", niAmount: class2NI, type: "Class 2" }] : []),
      { range: `Profit up to UEL`, rate: `${class4Rate * 100}%`, niAmount: taxableProfitInMainBand * class4Rate, type: "Class 4" },
      { range: `Profit above UEL`, rate: `${higherRate * 100}%`, niAmount: profitInHigherBand * higherRate, type: "Class 4" }
    ]
  };
}

export function calculateCombinedTax(salary, selfEmployedProfit, expenses, taxYear = DEFAULT_YEAR) {
  salary = Number(salary);
  selfEmployedProfit = Number(selfEmployedProfit);
  expenses = Number(expenses);
  const constants = getTaxConstants(taxYear);
  const tradingAllowance = constants.tradingAllowance || 0;
  const effectiveExpenses = Math.max(expenses, tradingAllowance);
  const netProfit = Math.max(0, selfEmployedProfit - effectiveExpenses);
  const totalIncome = salary + netProfit;

  const totalIncomeTax = calculateIncomeTax(totalIncome, taxYear);
  const niResults = calculateNationalInsuranceCap(salary, netProfit, taxYear);

  return {
    totalIncome,
    totalIncomeTax: totalIncomeTax.totalTax,
    employeeNI: niResults.employeeNI,
    selfEmployedNI: niResults.class2NI + niResults.class4NI,
    class2NI: niResults.class2NI,
    class4NI: niResults.class4NI,
    totalTax: totalIncomeTax.totalTax + niResults.totalNI,
    takeHome: totalIncome - (totalIncomeTax.totalTax + niResults.totalNI),
    niBands: niResults.bands,
    taxBands: totalIncomeTax.bands
  };
}
