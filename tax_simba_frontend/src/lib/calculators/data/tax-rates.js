import { HISTORIC_TAX_DATA } from "./historic-tax-rates.js";

export const TAX_DATA = {
    UK: {
        "2025-2026": {
            personalAllowance: 12570,
            incomeTaxBands: [
                { name: "Personal Allowance", limit: 12570, rate: 0 },
                { name: "Basic Rate", limit: 50270, rate: 0.20 },
                { name: "Higher Rate", limit: 125140, rate: 0.40 },
                { name: "Additional Rate", limit: Infinity, rate: 0.45 },
            ],
            niClass1: [
                { limit: 12570, rate: 0 },
                { limit: 50270, rate: 0.08 },
                { limit: Infinity, rate: 0.02 },
            ],
            niClass4: [
                { limit: 12570, rate: 0 },
                { limit: 50270, rate: 0.06 },
                { limit: Infinity, rate: 0.02 },
            ],
            stampDutyResidential: [
                { threshold: 125000, rate: 0 },
                { threshold: 250000, rate: 0.02 },
                { threshold: 925000, rate: 0.05 },
                { threshold: 1500000, rate: 0.10 },
                { threshold: Infinity, rate: 0.12 },
            ],
            stampDutyAdditionalSurcharge: 0.05,
            mileageRates: {
                car: [
                    { limit: 10000, rate: 0.45 },
                    { limit: Infinity, rate: 0.25 },
                ],
                motorcycle: [
                    { limit: Infinity, rate: 0.24 },
                ],
                bicycle: [
                    { limit: Infinity, rate: 0.20 },
                ]
            },
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
            niClass2: { weeklyRate: 0, threshold: 0 }
        },
        "2026-2027": {
            personalAllowance: 12570,
            incomeTaxBands: [
                { name: "Personal Allowance", limit: 12570, rate: 0 },
                { name: "Basic Rate", limit: 50270, rate: 0.20 },
                { name: "Higher Rate", limit: 125140, rate: 0.40 },
                { name: "Additional Rate", limit: Infinity, rate: 0.45 },
            ],
            niClass1: [
                { limit: 12570, rate: 0 },
                { limit: 50270, rate: 0.08 },
                { limit: Infinity, rate: 0.02 },
            ],
            niClass4: [
                { limit: 12570, rate: 0 },
                { limit: 50270, rate: 0.06 },
                { limit: Infinity, rate: 0.02 },
            ],
            stampDutyResidential: [
                { threshold: 125000, rate: 0 },
                { threshold: 250000, rate: 0.02 },
                { threshold: 925000, rate: 0.05 },
                { threshold: 1500000, rate: 0.10 },
                { threshold: Infinity, rate: 0.12 },
            ],
            stampDutyAdditionalSurcharge: 0.05,
            mileageRates: {
                car: [
                    { limit: 10000, rate: 0.45 },
                    { limit: Infinity, rate: 0.25 },
                ],
                motorcycle: [
                    { limit: Infinity, rate: 0.24 },
                ],
                bicycle: [
                    { limit: Infinity, rate: 0.20 },
                ]
            },
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
            niClass2: { weeklyRate: 0, threshold: 0 }
        }
    }
};

let dynamicTaxData = {};

function getCurrentTaxYear() {
    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth() + 1;
    const day = today.getDate();
    // UK tax year ends April 5.
    if (month > 4 || (month === 4 && day >= 6)) {
        return `${year}-${year + 1}`;
    } else {
        return `${year - 1}-${year}`;
    }
}

export const DEFAULT_YEAR = getCurrentTaxYear();
export const DEFAULT_COUNTRY = "UK";

/**
 * Updates the dynamic tax rates from external sources (Admin API)
 * @param {Object} data - Format { COUNTRY: { YEAR: { settings } } }
 */
export function setDynamicTaxData(data) {
    if (data && typeof data === 'object') {
        dynamicTaxData = { ...dynamicTaxData, ...data };
    }
}

/**
 * Returns all available tax years from hardcoded, historic, and dynamic data.
 * @param {string} country - The country to get years for
 * @param {Object} [dynamicOverride] - Optional override for dynamic data (to avoid race conditions)
 */
export function getAvailableTaxYears(country = DEFAULT_COUNTRY, dynamicOverride = null) {
    const years = new Set();
    const dynamicToUse = dynamicOverride || dynamicTaxData;

    // Hardcoded
    if (TAX_DATA[country]) {
        Object.keys(TAX_DATA[country]).forEach(y => years.add(y));
    }

    // Historic
    if (HISTORIC_TAX_DATA[country]) {
        Object.keys(HISTORIC_TAX_DATA[country]).forEach(y => years.add(y));
    }

    // Dynamic
    if (dynamicToUse[country]) {
        Object.keys(dynamicToUse[country]).forEach(y => years.add(y));
    }

    return Array.from(years).sort((a, b) => b.localeCompare(a)); // Newest first
}

export function getTaxConstants(year = DEFAULT_YEAR, country = DEFAULT_COUNTRY) {
    // Check dynamic data first
    if (dynamicTaxData[country] && dynamicTaxData[country][year]) {
        return dynamicTaxData[country][year];
    }

    // Fallback to hardcoded TAX_DATA
    const countryData = TAX_DATA[country];
    if (countryData && countryData[year]) return countryData[year];

    // Fallback to HISTORIC_TAX_DATA
    const historicCountryData = HISTORIC_TAX_DATA[country];
    if (historicCountryData && historicCountryData[year]) return historicCountryData[year];

    // Final fallback to DEFAULT_YEAR
    return (countryData && countryData[DEFAULT_YEAR]) || TAX_DATA[DEFAULT_COUNTRY][DEFAULT_YEAR];
}
