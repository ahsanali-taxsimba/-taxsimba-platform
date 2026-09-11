'use client';

import React, { useEffect, useState } from 'react';
import { ArrowDownIcon, ArrowUpIcon, BoxIconLine, GroupIcon } from '@/icons';
import Badge from '@/components/ui/badge/Badge';
import { useSession } from 'next-auth/react';
import clientAxios from '@/lib/axios-client';
import { isAdminRole } from '@/lib/roles';

export const EcommerceMetrics = () => {
  const { data: session } = useSession();
  const [stats, setStats] = useState({
    totalClients: 0,
    totalAccountants: 0,
    totalCompletedTaxReturns: 0,
    totalOngoingTaxReturns: 0,
  });
  const [isLoading, setIsLoading] = useState(false);

  // Fetch Dashboard Statistics based on the role
  const fetchDashboardStats = async () => {
    setIsLoading(true);
    try {
      if (!session?.user?.role) {
        return;
      }
      const apiUrl = session?.user?.role === 'ACCOUNTANT'
        ? '/accountant/dashboard/stats' // API for accountants
        : '/admin/dashboard/stats'; // API for admins + SUPER_ADMIN

      const res = await clientAxios.post(apiUrl);
      const { data } = res.data;

      setStats({
        totalClients: data.totalClients || 0,
        totalAccountants: data.totalAccountants || 0,
        totalCompletedTaxReturns: data.totalCompletedTaxReturns || 0,
        totalOngoingTaxReturns: data.totalOngoingTaxReturns || 0,
      });
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardStats();
  }, [session?.user?.role]);

  return (
    <>
      {session?.user?.role === 'ACCOUNTANT' ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:gap-6">
          {/* Completed Tax Returns */}
          <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] md:p-6">
            <div className="flex items-center justify-center w-12 h-12 bg-gray-100 rounded-xl dark:bg-gray-800">
              <GroupIcon className="text-gray-800 size-6 dark:text-white/90" />
            </div>
            <div className="flex items-end justify-between mt-5">
              <div className="flex flex-col justify-between items-center">
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  Completed Tax Returns
                </span>
                <h4 className="mt-2 font-bold text-gray-800 text-title-sm dark:text-white/90">
                  {isLoading ? 'Loading...' : stats.totalCompletedTaxReturns}
                </h4>
              </div>
            </div>
          </div>

          {/* Ongoing Tax Return */}
          <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] md:p-6">
            <div className="flex items-center justify-center w-12 h-12 bg-gray-100 rounded-xl dark:bg-gray-800">
              <BoxIconLine className="text-gray-800 dark:text-white/90" />
            </div>
            <div className="flex items-end justify-between mt-5">
              <div>
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  Ongoing Tax Return
                </span>
                <h4 className="mt-2 font-bold text-gray-800 text-title-sm dark:text-white/90">
                  {isLoading ? 'Loading...' : stats.totalOngoingTaxReturns}
                </h4>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:gap-6">
          {/* Clients */}
          <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] md:p-6">
            <div className="flex items-center justify-center w-12 h-12 bg-gray-100 rounded-xl dark:bg-gray-800">
              <GroupIcon className="text-gray-800 size-6 dark:text-white/90" />
            </div>
            <div className="flex items-end justify-between mt-5">
              <div className="flex flex-col justify-between items-center">
                <span className="text-sm text-gray-500 dark:text-gray-400">Clients</span>
                <h4 className="mt-2 font-bold text-gray-800 text-title-sm dark:text-white/90">
                  {isLoading ? 'Loading...' : stats.totalClients}
                </h4>
              </div>
            </div>
          </div>

          {/* Accountants */}
          {isAdminRole(session?.user?.role) && (
            <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] md:p-6">
              <div className="flex items-center justify-center w-12 h-12 bg-gray-100 rounded-xl dark:bg-gray-800">
                <BoxIconLine className="text-gray-800 dark:text-white/90" />
              </div>
              <div className="flex items-end justify-between mt-5">
                <div>
                  <span className="text-sm text-gray-500 dark:text-gray-400">Accountants</span>
                  <h4 className="mt-2 font-bold text-gray-800 text-title-sm dark:text-white/90">
                    {isLoading ? 'Loading...' : stats.totalAccountants}
                  </h4>
                </div>
              </div>
            </div>
          )}

          {/* Completed Tax Returns */}
          <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] md:p-6">
            <div className="flex items-center justify-center w-12 h-12 bg-gray-100 rounded-xl dark:bg-gray-800">
              <GroupIcon className="text-gray-800 size-6 dark:text-white/90" />
            </div>
            <div className="flex items-end justify-between mt-5">
              <div className="flex flex-col justify-between items-center">
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  Completed Tax Returns
                </span>
                <h4 className="mt-2 font-bold text-gray-800 text-title-sm dark:text-white/90">
                  {isLoading ? 'Loading...' : stats.totalCompletedTaxReturns}
                </h4>
              </div>
            </div>
          </div>

          {/* Ongoing Tax Return */}
          <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] md:p-6">
            <div className="flex items-center justify-center w-12 h-12 bg-gray-100 rounded-xl dark:bg-gray-800">
              <BoxIconLine className="text-gray-800 dark:text-white/90" />
            </div>
            <div className="flex items-end justify-between mt-5">
              <div>
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  Ongoing Tax Return
                </span>
                <h4 className="mt-2 font-bold text-gray-800 text-title-sm dark:text-white/90">
                  {isLoading ? 'Loading...' : stats.totalOngoingTaxReturns}
                </h4>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
