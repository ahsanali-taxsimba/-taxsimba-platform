
import React from 'react';
import { EcommerceMetrics } from './_partial/EcommerceMetrics';

/**
 * P0 overview: operational stats only.
 * Yearly-metrics / status-distribution charts are S6 HIDE — removed from launch UI.
 */
const OverviewClientPage: React.FC = () => {
  return (
    <div className="grid grid-cols-12 gap-4 md:gap-6">
      <div className="col-span-12 space-y-6">
        <EcommerceMetrics />
      </div>
    </div>
  );
};

export default OverviewClientPage;
