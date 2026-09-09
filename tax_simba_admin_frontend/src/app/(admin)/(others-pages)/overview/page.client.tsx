
import React from 'react';
import { EcommerceMetrics } from './_partial/EcommerceMetrics';
import MonthlySalesChart from './_partial/MonthlySalesChart';
import MonthlyTarget from './_partial/MonthlyTarget';
import StatisticsChart from './_partial/StatisticsChart';
import DemographicCard from './_partial/DemographicCard';
import RecentOrders from './_partial/RecentOrders';

const OverviewClientPage: React.FC = () => {
  return (
    <div className="grid grid-cols-12 gap-4 md:gap-6">
      <div className="col-span-12 space-y-6">
        <MonthlySalesChart />
      </div>
    </div>
  );
};

export default OverviewClientPage;