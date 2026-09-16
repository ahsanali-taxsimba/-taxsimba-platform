"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { getAvailableTaxYears } from '@/lib/calculators/data/tax-rates';

const TaxDataContext = createContext();

export const TaxDataProvider = ({ children }) => {
    const [dynamicTaxData, setDynamicTaxDataState] = useState({});
    const [availableYears, setAvailableYears] = useState([]);

    // Update available years whenever dynamic data changes
    useEffect(() => {
        setAvailableYears(getAvailableTaxYears(undefined, dynamicTaxData));
    }, [dynamicTaxData]);

    const updateDynamicData = useCallback((data) => {
        setDynamicTaxDataState(data);
        // Also update available years immediately to avoid lag
        setAvailableYears(getAvailableTaxYears(undefined, data));
    }, []);

    return (
        <TaxDataContext.Provider
            value={{
                dynamicTaxData,
                availableYears,
                updateDynamicData
            }}
        >
            {children}
        </TaxDataContext.Provider>
    );
};

export const useTaxData = () => {
    const context = useContext(TaxDataContext);
    if (!context) {
        throw new Error('useTaxData must be used within a TaxDataProvider');
    }
    return context;
};
