export const DEFAULT_TEMPLATE = {
    personalAllowance: 12570,
    personalAllowanceThreshold: 100000,
    incomeTaxBands: [
        { name: "Personal Allowance", limit: 12570, rate: 0 },
        { name: "Basic Rate", limit: 50270, rate: 0.20 },
        { name: "Higher Rate", limit: 125140, rate: 0.40 },
        { name: "Additional Rate", limit: Infinity, rate: 0.45 },
    ],
    niClass1: [
        { name: "Primary Threshold", limit: 12570, rate: 0 },
        { name: "Main Rate", limit: 50270, rate: 0.08 },
        { name: "Upper Rate", limit: Infinity, rate: 0.02 },
    ],
    niClass4: [
        { name: "Lower Profits Limit", limit: 12570, rate: 0 },
        { name: "Main Rate", limit: 50270, rate: 0.06 },
        { name: "Upper Rate", limit: Infinity, rate: 0.02 },
    ],
    niClass2: { weeklyRate: 0, threshold: 0 },
    stampDutyResidential: [
        { threshold: 250000, rate: 0 },
        { threshold: 925000, rate: 0.05 },
        { threshold: 1500000, rate: 0.10 },
        { threshold: Infinity, rate: 0.12 },
    ],
    stampDutyAdditionalSurcharge: 0.05,
    dividendAllowance: 500,
    dividendRates: {
        basic: 0.0875,
        higher: 0.3375,
        additional: 0.3935
    },
    cryptoAllowance: 3000,
    cryptoRates: {
        basic: 0.18,
        higher: 0.24
    },
    childBenefit: {
        threshold: 60000,
        taperEnd: 80000,
        firstChild: 26.05,
        additionalChild: 17.25
    },
    corporationTax: {
        smallProfitLimit: 50000,
        upperLimit: 250000,
        smallRate: 0.19,
        mainRate: 0.25
    },
    studentLoanPlans: {
        plan1: { threshold: 24990, rate: 0.09 },
        plan2: { threshold: 27295, rate: 0.09 },
        plan4: { threshold: 31395, rate: 0.09 },
        plan5: { threshold: 25000, rate: 0.09 },
        postgrad: { threshold: 21000, rate: 0.06 }
    },
    blindPersonsAllowance: 3070,
    marriageAllowance: 1260,
    tradingAllowance: 1000,
    propertyAllowance: 1000,
    rentARoomAllowance: 7500,
    savingsAllowance: 1000,
    vatRegistrationThreshold: 90000,
    mileageRates: {
        car: [
            { name: "First 10,000 miles", limit: 10000, rate: 0.45 },
            { name: "After 10,000 miles", limit: Infinity, rate: 0.25 }
        ],
        motorcycle: [{ name: "All miles", limit: Infinity, rate: 0.24 }],
        bicycle: [{ name: "All miles", limit: Infinity, rate: 0.20 }]
    }
};

export const HISTORIC_DATA: Record<string, any> = {
    "2025-2026": DEFAULT_TEMPLATE,
    "2024-2025": {
        ...DEFAULT_TEMPLATE,
        childBenefit: { threshold: 60000, taperEnd: 80000, firstChild: 25.60, additionalChild: 16.95 },
    },
    "2023-2024": {
        ...DEFAULT_TEMPLATE,
        niClass1: [{ limit: 12570, rate: 0 }, { limit: 50270, rate: 0.10 }, { limit: Infinity, rate: 0.02 }],
        niClass4: [{ limit: 12570, rate: 0 }, { limit: 50270, rate: 0.09 }, { limit: Infinity, rate: 0.02 }],
        dividendAllowance: 1000,
        cryptoAllowance: 6000,
        cryptoRates: { basic: 0.10, higher: 0.20 },
        childBenefit: { threshold: 50000, taperEnd: 60000, firstChild: 24.00, additionalChild: 15.90 },
        studentLoanPlans: { plan1: { threshold: 22015, rate: 0.09 }, plan2: { threshold: 27295, rate: 0.09 }, plan4: { threshold: 27660, rate: 0.09 }, plan5: { threshold: 25000, rate: 0.09 }, postgrad: { threshold: 21000, rate: 0.06 } },
        blindPersonsAllowance: 2870,
    }
};

export function getDefaultTaxSettings(year: string) {
    // Exact match
    if (HISTORIC_DATA[year]) return HISTORIC_DATA[year];

    // Fallback to highest year we have (which is 2025-2026)
    return DEFAULT_TEMPLATE;
}
