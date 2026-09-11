"use client";

import { setDynamicTaxData } from "@/lib/calculators/data/tax-rates";
import { useEffect } from "react";
import { useTaxData } from "@/context/TaxDataContext";

export default function TaxDataLoader() {
    const { updateDynamicData } = useTaxData();

    useEffect(() => {
        const fetchTaxRates = async () => {
            try {
                const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3003/api";
                const response = await fetch(`${apiBase.replace(/\/$/, "")}/tax-rates/active`, { cache: 'no-store' });
                const data = await response.json();

                if (data && data.success && data.data) {
                    console.log(`Fetched ${data.data.length} active tax rates from API`);
                    // Map the array response to: { COUNTRY: { YEAR: settings } }
                    const formattedData = data.data.reduce((acc, rate) => {
                        if (!acc[rate.country]) acc[rate.country] = {};

                        // Parse settings if it's a string (Sequelize/SQLite might return it as a string)
                        let settings = rate.settings;
                        if (typeof settings === 'string') {
                            try {
                                settings = JSON.parse(settings);
                            } catch (e) {
                                console.error("Error parsing settings for", rate.taxYear, e);
                            }
                        }

                        acc[rate.country][rate.taxYear] = settings;
                        return acc;
                    }, {});

                    // Update the static library (still useful for non-component calls)
                    setDynamicTaxData(formattedData);
                    // Update the reactive context
                    updateDynamicData(formattedData);
                    console.log("Tax rates loaded successfully");
                }
            } catch (error) {
                console.error("Error fetching tax rates:", error);
            }
        };

        fetchTaxRates();
    }, [updateDynamicData]);

    return null;
}
