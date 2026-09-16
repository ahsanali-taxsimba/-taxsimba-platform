"use client";
import React, { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { useSession } from 'next-auth/react';
import clientAxios from '@/lib/axios-client';
import { DashboardData } from '@/utils/interface';
import { isAdminRole, isStaffRole } from '@/lib/roles';


const ReactApexChart = dynamic(() => import("react-apexcharts"), {
  ssr: false,
});

export default function RoleBasedDashboard() {
  const { data: session } = useSession();
  const userRole = session?.user?.role;
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  // Determine API endpoints based on role
  const getApiEndpoints = () => {
    const baseEndpoint = isAdminRole(userRole) ? '/admin' : '/accountant';
    return {
      yearlyMetrics: `${baseEndpoint}/yearly-metrics`,
      summary: `${baseEndpoint}/summary`,
      statusDistribution: `${baseEndpoint}/status-distribution`,
      comprehensive: `${baseEndpoint}/comprehensive`
    };
  };

  // Fetch dashboard data based on user role
  const fetchDashboardData = async (year: number = selectedYear) => {
    try {
      setLoading(true);
      setError(null);

      const endpoints = getApiEndpoints();

      if (isAdminRole(userRole)) {
        const [yearlyResponse, summaryResponse, statusResponse] = await Promise.all([
          clientAxios.post(endpoints.yearlyMetrics, { year }),
          clientAxios.post(`${endpoints.summary}?year=${year}`),
          clientAxios.post(endpoints.statusDistribution)
        ]);

        if (yearlyResponse.data.success && summaryResponse.data.success && statusResponse.data.success) {
          setDashboardData({
            yearlyMetrics: yearlyResponse.data.data.yearlyMetrics,
            summary: summaryResponse.data.data,
            statusDistribution: statusResponse.data.data
          });
        }
      } else if (userRole === 'ACCOUNTANT') {
        const [yearlyResponse, summaryResponse, statusResponse] = await Promise.all([
          clientAxios.post(endpoints.yearlyMetrics, { year }),
          clientAxios.post(`${endpoints.summary}?year=${year}`),
          clientAxios.post(endpoints.statusDistribution)
        ]);

        if (yearlyResponse.data.success && summaryResponse.data.success && statusResponse.data.success) {
          setDashboardData({
            yearlyMetrics: yearlyResponse.data.data.yearlyMetrics,
            summary: summaryResponse.data.data,
            statusDistribution: statusResponse.data.data,
            accountantStats: summaryResponse.data.data.accountantStats
          });
        }
      } else {
        setError('Unauthorized access');
        return;
      }
    } catch (err) {
      console.error('Error fetching dashboard data:', err);
      setError('Error loading dashboard data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (userRole && (isAdminRole(userRole) || userRole === 'ACCOUNTANT')) {
      fetchDashboardData();
    }
  }, [selectedYear, userRole]);

  // Show unauthorized message for non-admin/non-accountant users
  if (userRole && !isStaffRole(userRole)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
        <div className="max-w-md w-full mx-4">
          <div className="bg-white/10 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/20 p-8 text-center">
            <div className="w-20 h-20 bg-gradient-to-br from-red-400 to-red-600 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-white mb-3">Access Denied</h2>
            <p className="text-gray-300 mb-6 leading-relaxed">
              Dashboard access is restricted to administrators and accountants only.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white from-blue-50 via-indigo-50 to-purple-50 dark:from-gray-900 dark:via-blue-900 dark:to-indigo-900">
        <div className="text-center">
          <div className="relative">
            <div className="animate-spin rounded-full h-16 w-16 border-4 border-success-500 border-t-success-600 mx-auto"></div>
            <div className="absolute inset-0 rounded-full bg-white from-success-500 to-success-600 opacity-20 animate-pulse"></div>
          </div>
          <p className="mt-3 mb-0 text-lg text-dark font-medium">Loading...</p>
          <p className="mt-1 text-sm text-dark font-medium">Fetching your latest data</p>
        </div>
      </div>
    );
  }

  if (error || !dashboardData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-red-50 via-orange-50 to-yellow-50 dark:from-gray-900 dark:via-red-900 dark:to-orange-900">
        <div className="max-w-md w-full mx-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-700 p-8 text-center">
            <div className="w-20 h-20 bg-gradient-to-br from-red-100 to-red-200 dark:from-red-900/30 dark:to-red-800/30 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg className="w-10 h-10 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-800  mb-3">Something went wrong</h2>
            <p className="text-gray-600  mb-6 leading-relaxed">
              {error || 'Failed to load dashboard data'}
            </p>
            <button
              onClick={() => fetchDashboardData()}
              className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-medium rounded-xl hover:from-blue-700 hover:to-purple-700 transform hover:scale-105 transition-all duration-200 shadow-lg hover:shadow-xl"
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  const { yearlyMetrics, summary, statusDistribution, accountantStats } = dashboardData;

  // Calculate completion percentage
  const completionPercentage = summary.totalReturns > 0
    ? Math.round((summary.completed / summary.totalReturns) * 100)
    : 0;

  // Calculate progress percentage
  const progressPercentage = summary.totalReturns > 0
    ? Math.round(((summary.completed + summary.assigned) / summary.totalReturns) * 100)
    : 0;

  // Chart options for Yearly Data
  const yearlyReturnsOptions: ApexCharts.ApexOptions = {
    colors: ["#4F46E5"],
    chart: {
      fontFamily: "Inter, sans-serif",
      type: "bar",
      height: 220,
      toolbar: { show: false },
      animations: {
        enabled: true,
        speed: 800,
      },
    },
    plotOptions: {
      bar: {
        horizontal: false,
        columnWidth: "55%",
        borderRadius: 8,
        borderRadiusApplication: 'end',
      },
    },
    dataLabels: { enabled: false },
    stroke: {
      show: true,
      width: 2,
      colors: ["transparent"],
    },
    xaxis: {
      categories: [`Tax Year ${selectedYear}`],
      axisBorder: { show: false },
      axisTicks: { show: false },
      labels: {
        style: {
          fontSize: '14px',
          fontWeight: 500,
        }
      }
    },
    yaxis: {
      title: { text: undefined },
      labels: {
        formatter: (val) => Math.round(val).toString(),
      }
    },
    grid: {
      borderColor: '#F3F4F6',
      strokeDashArray: 4,
      yaxis: { lines: { show: true } }
    },
    fill: {
      opacity: 1,
      type: "gradient",
      gradient: {
        shade: 'light',
        type: "vertical",
        shadeIntensity: 0.3,
        gradientToColors: undefined,
        inverseColors: false,
        opacityFrom: 0.8,
        opacityTo: 0.9,
        stops: [0, 100]
      }
    },
    tooltip: {
      x: { show: false },
      y: {
        formatter: (val: number) => `${val.toLocaleString()} Returns`,
        title: {
          formatter: () => ''
        }
      },
      marker: { show: false }
    },
  };

  // Chart options for Yearly Comparison
  const yearlyComparisonOptions: ApexCharts.ApexOptions = {
    colors: ["#10B981", "#6366F1"],
    chart: {
      fontFamily: "Inter, sans-serif",
      type: "bar",
      height: 220,
      toolbar: { show: false },
      animations: {
        enabled: true,
        speed: 800,
      },
    },
    plotOptions: {
      bar: {
        horizontal: false,
        columnWidth: "55%",
        borderRadius: 8,
        borderRadiusApplication: 'end',
      },
    },
    dataLabels: { enabled: false },
    xaxis: {
      categories: [`Tax Year ${selectedYear}`],
      axisBorder: { show: false },
      axisTicks: { show: false },
      labels: {
        style: {
          fontSize: '14px',
          fontWeight: 500,
        }
      }
    },
    yaxis: {
      title: { text: undefined },
      labels: {
        formatter: (val) => Math.round(val).toString(),
      }
    },
    grid: {
      borderColor: '#F3F4F6',
      strokeDashArray: 4,
      yaxis: { lines: { show: true } }
    },
    fill: {
      opacity: 1,
      type: "gradient",
      gradient: {
        shade: 'light',
        type: "vertical",
        shadeIntensity: 0.3,
        gradientToColors: undefined,
        inverseColors: false,
        opacityFrom: 0.8,
        opacityTo: 0.9,
        stops: [0, 100]
      }
    },
    tooltip: {
      x: { show: false },
      y: {
        formatter: (val: number) => `${val.toLocaleString()} Returns`,
        title: {
          formatter: () => ''
        }
      },
      marker: { show: false }
    },
    legend: {
      position: 'top',
      horizontalAlign: 'right',
      fontSize: '14px',
      markers: {
        size: 12,
      },
      itemMargin: {
        horizontal: 16,
        vertical: 8
      }
    },
  };

  // Data for charts - using yearly totals
  const newReturnsSeries = [{
    name: isAdminRole(userRole) ? "Total Returns" : "Total Assigned",
    data: [yearlyMetrics[0]?.newReturns || 0]
  }];

  const completedAssignedSeries = [
    {
      name: "Completed",
      data: [yearlyMetrics[0]?.completed || 0]
    },
    {
      name: isAdminRole(userRole) ? "In Progress" : "My Progress",
      data: [yearlyMetrics[0]?.assigned || 0]
    }
  ];

  const paymentsSeries = [{
    name: isAdminRole(userRole) ? "Total Payments" : "Client Payments",
    data: [yearlyMetrics[0]?.payments || 0]
  }];

  return (
    <div className="min-h-screen from-slate-50 via-blue-50 to-indigo-50 dark:from-gray-900 dark:via-blue-900 dark:to-indigo-900">
      {/* Background Pattern */}
      <div className="absolute inset-0 bg-grid-pattern opacity-5"></div>

      <div className="relative z-10 p-0">
        <div className=" mx-auto max-w-(--breakpoint-2xl) p-0">
          {/* Enhanced Header */}
          <div className="mb-8">
            <div className="backdrop-blur-xl">
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
                <div className="flex items-center space-x-4">
                  <div className="w-16 h-16 bg-green rounded-2xl flex items-center justify-center shadow-lg">
                    <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 00-2-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                  </div>
                  <div>
                    <h1 className="text-2xl lg:text-3xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 dark:from-white dark:to-gray-300 bg-clip-text text-transparent">
                      {isAdminRole(userRole) ? 'Tax Returns Dashboard' : 'My Dashboard'}
                    </h1>
                    <p className="text-gray-600  mt-1 text-sm lg:text-base mb-0">
                      {isAdminRole(userRole) ? 'System-wide analytics and metrics' : 'Your assigned tax returns and performance'}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap lg:flex-nowrap items-start sm:items-center gap-3">
                  <div className="relative">
                    <select
                      value={selectedYear}
                      onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                      className="pl-12 pr-8 py-3 bg-white/50  backdrop-blur border border-gray-200  rounded-xl text-sm font-medium focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200"
                    >
                      {Array.from({ length: 5 }, (_, i) => {
                        const year = new Date().getFullYear() - i;
                        return (
                          <option key={year} value={year}>
                            Tax Year {year}
                          </option>
                        );
                      })}
                    </select>
                    <div className="absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none">
                      <svg className="w-5 h-5 text-dark-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                  </div>

                  <button
                    onClick={() => fetchDashboardData()}
                    className="refresh-btn flex items-center gap-2 px-6 py-3 bg-green text-white font-medium rounded-xl"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Refresh
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Enhanced Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6 mb-8">
            <div className="group bg-white/70  backdrop-blur-xl rounded-2xl shadow-lg border border-white/20  p-6 hover:shadow-xl transform hover:-translate-y-1 transition-all duration-300">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600  mb-1">
                    {isAdminRole(userRole) ? 'Total Returns' : 'Assigned to Me'}
                  </p>
                  <p className="text-3xl font-bold text-gray-900">{summary.totalReturns?.toLocaleString()}</p>
                </div>
                <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-300">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
              </div>
            </div>

            {isAdminRole(userRole) && (
              <div className="group bg-white/70 backdrop-blur-xl rounded-2xl shadow-lg border border-white/20  p-6 hover:shadow-xl transform hover:-translate-y-1 transition-all duration-300">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600  mb-1">Pending</p>
                    <p className="text-3xl font-bold text-gray-900">{summary.pendingCount?.toLocaleString()}</p>
                  </div>
                  <div className="w-12 h-12 bg-gradient-to-br from-amber-500 to-orange-500 rounded-xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-300">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                </div>
              </div>
            )}

            <div className="group bg-white/70  backdrop-blur-xl rounded-2xl shadow-lg border border-white/20  p-6 hover:shadow-xl transform hover:-translate-y-1 transition-all duration-300">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600  mb-1">Completed</p>
                  <p className="text-3xl font-bold text-gray-900">{summary.completed?.toLocaleString()}</p>
                </div>
                <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-emerald-500 rounded-xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-300">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>
            </div>

            <div className="group bg-white/70  backdrop-blur-xl rounded-2xl shadow-lg border border-white/20  p-6 hover:shadow-xl transform hover:-translate-y-1 transition-all duration-300">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600  mb-1">
                    {isAdminRole(userRole) ? 'In Progress' : 'My Progress'}
                  </p>
                  <p className="text-3xl font-bold text-gray-900">{summary.assigned?.toLocaleString()}</p>
                </div>
                <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-indigo-500 rounded-xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-300">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                </div>
              </div>
            </div>
          </div>

          {/* Enhanced Progress Overview */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
            <div className="lg:col-span-2 bg-white/70  backdrop-blur-xl rounded-2xl shadow-lg border border-white/20 p-6 lg:p-8">
              <h3 className="text-xl font-bold text-gray-900  mb-6 flex items-center">
                <div className="w-2 h-6 bg-green rounded-full mr-3"></div>
                Progress Overview
              </h3>
              <div className="space-y-6">
                <div>
                  <div className="flex justify-between items-center mb-3">
                    <span className="text-sm font-semibold text-gray-700 ">Completion Progress</span>
                    <span className="text-sm font-bold text-blue-600 bg-blue-50 dark:bg-blue-900/30 px-3 py-1 rounded-full">{completionPercentage}%</span>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3 shadow-inner">
                    <div
                      className="bg-gradient-to-r from-blue-500 to-blue-600 h-3 rounded-full shadow-sm transition-all duration-1000 ease-out"
                      style={{ width: `${completionPercentage}%` }}
                    ></div>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-3">
                    <span className="text-sm font-semibold text-gray-700 ">Overall Progress</span>
                    <span className="text-sm font-bold text-green-600 bg-green-50 dark:bg-green-900/30 px-3 py-1 rounded-full">{progressPercentage}%</span>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3 shadow-inner">
                    <div
                      className="bg-gradient-to-r from-green-500 to-emerald-500 h-3 rounded-full shadow-sm transition-all duration-1000 ease-out"
                      style={{ width: `${progressPercentage}%` }}
                    ></div>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white/70  backdrop-blur-xl rounded-2xl shadow-lg border border-white/20  p-6">
              <h3 className="text-lg font-bold text-gray-900  mb-4 flex items-center">
                <div className="w-2 h-6 bg-green rounded-full mr-3"></div>
                Quick Stats
              </h3>
              <div className="space-y-4">
                <div className="flex justify-between items-center p-3 bg-gray-50 rounded-xl">
                  <span className="text-sm font-medium text-gray-600 ">Total Active</span>
                  <span className="text-sm font-bold text-gray-900 ">{statusDistribution.total?.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-gray-50 rounded-xl">
                  <span className="text-sm font-medium text-gray-600 ">Utilization</span>
                  <span className="text-sm font-bold text-blue-600">
                    {statusDistribution.total > 0 ? Math.round((summary.assigned / statusDistribution.total) * 100) : 0}%
                  </span>
                </div>
                <div className="flex justify-between items-center p-3 bg-gray-50  rounded-xl">
                  <span className="text-sm font-medium text-gray-600 ">Last Updated</span>
                  <span className="text-sm font-bold text-gray-900 ">{summary.period}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Enhanced Accountant-specific stats */}
          {userRole === 'ACCOUNTANT' && accountantStats && (
            <div className="mb-8">
              <div className="bg-gradient-to-r from-blue-500/10 via-purple-500/10 to-pink-500/10 dark:from-blue-500/20 dark:via-purple-500/20 dark:to-pink-500/20 backdrop-blur-xl rounded-2xl border border-blue-200/50 dark:border-blue-700/50 p-6 lg:p-8">
                <h3 className="text-xl font-bold text-gray-800  mb-6 flex items-center">
                  <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-500 rounded-xl flex items-center justify-center mr-3">
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </div>
                  Your Performance Metrics
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="bg-white/60 dark:bg-gray-800/60 backdrop-blur rounded-xl p-6 text-center transform hover:scale-105 transition-all duration-300 shadow-lg">
                    <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
                      <span className="text-2xl font-bold text-white">{accountantStats.completionRate}%</span>
                    </div>
                    <p className="text-sm font-semibold text-gray-600 ">Completion Rate</p>
                  </div>
                  <div className="bg-white/60 dark:bg-gray-800/60 backdrop-blur rounded-xl p-6 text-center transform hover:scale-105 transition-all duration-300 shadow-lg">
                    <div className="w-16 h-16 bg-gradient-to-br from-green-500 to-emerald-500 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
                      <span className="text-2xl font-bold text-white">{accountantStats.averageCompletionDays}</span>
                    </div>
                    <p className="text-sm font-semibold text-gray-600 ">Avg Days to Complete</p>
                  </div>
                  <div className="bg-white/60 dark:bg-gray-800/60 backdrop-blur rounded-xl p-6 text-center transform hover:scale-105 transition-all duration-300 shadow-lg">
                    <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-indigo-500 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
                      <span className="text-2xl font-bold text-white">{accountantStats.inProgressReturns}</span>
                    </div>
                    <p className="text-sm font-semibold text-gray-600 ">Currently Working On</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Enhanced Charts Section */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            {/* Yearly Returns Chart */}
            <div className="bg-white/70  backdrop-blur-xl rounded-2xl shadow-lg border border-white/20  p-6">
              <div className="flex md:items-center items-start md:justify-between flex-col md:flex-row justify-start mb-6">
                <h3 className="text-lg font-bold text-gray-900  flex items-center">
                  <div className="w-2 h-6 bg-green rounded-full mr-3"></div>
                  {isAdminRole(userRole) ? 'Total Tax Returns' : 'Total Assigned to Me'}
                </h3>
                <span className="text-xs font-semibold px-3 py-1 bg-gradient-to-r from-blue-100 to-indigo-100 dark:from-blue-900/30  text-blue-800  rounded-full">
                  Tax Year {selectedYear}
                </span>
              </div>
              <div>
                <ReactApexChart
                  options={yearlyReturnsOptions}
                  series={newReturnsSeries}
                  type="bar"
                  height={220}
                />
              </div>
            </div>

            {/* Yearly Comparison Chart */}
            <div className="bg-white/70  backdrop-blur-xl rounded-2xl shadow-lg border border-white/20  p-6">
              <div className="flex md:items-center items-start md:justify-between flex-col md:flex-row justify-start mb-6">
                <h3 className="text-lg font-bold text-gray-900  flex items-center">
                  <div className="w-2 h-6 bg-green rounded-full mr-3"></div>
                  {isAdminRole(userRole) ? 'Completed vs In Progress' : 'My Completion Progress'}
                </h3>
                <span className="text-xs font-semibold px-3 py-1 bg-gradient-to-r from-green-100 to-blue-100  text-green-800  rounded-full">
                  Tax Year {selectedYear}
                </span>
              </div>
              <div>
                <ReactApexChart
                  options={yearlyComparisonOptions}
                  series={completedAssignedSeries}
                  type="bar"
                  height={220}
                />
              </div>
            </div>

            {/* Payments Chart - Admin only */}
            {isAdminRole(userRole) && (
              <div className="bg-white/70  backdrop-blur-xl rounded-2xl shadow-lg border border-white/20  p-6">
                <div className="flex md:items-center items-start md:justify-between flex-col md:flex-row justify-start mb-6">
                  <h3 className="text-lg font-bold text-gray-900  flex items-center">
                    <div className="w-2 h-6 bg-green rounded-full mr-3"></div>
                    Total Payments Processed
                  </h3>
                  <span className="text-xs font-semibold px-3 py-1 bg-gradient-to-r from-purple-100 to-pink-100  text-purple-800  rounded-full">
                    Tax Year {selectedYear}
                  </span>
                </div>
                <div>
                  <ReactApexChart
                    options={yearlyReturnsOptions}
                    series={paymentsSeries}
                    type="bar"
                    height={220}
                  />
                </div>
              </div>
            )}

            {/* Status Distribution Chart */}
            <div className="bg-white/70  backdrop-blur-xl rounded-2xl shadow-lg border border-white/20  p-6">
              <h3 className="text-lg font-bold text-gray-900  mb-6 flex items-center">
                <div className="w-2 h-6 bg-green rounded-full mr-3"></div>
                {isAdminRole(userRole) ? 'Status Distribution' : 'Work Distribution'}
              </h3>
              <div>
                <ReactApexChart
                  options={{
                    chart: {
                      type: 'donut',
                      height: 320,
                      fontFamily: "Inter, sans-serif",
                      animations: {
                        enabled: true,
                        speed: 800,
                      },
                    },
                    labels: statusDistribution.labels,
                    colors: ['#10B981', '#6366F1', '#8B5CF6', '#F59E0B', '#EF4444'],
                    legend: {
                      position: 'bottom',
                      fontSize: '14px',
                      markers: {
                        size: 8,
                      },
                      itemMargin: {
                        horizontal: 12,
                        vertical: 8
                      }
                    },
                    plotOptions: {
                      pie: {
                        donut: {
                          size: '65%',
                          labels: {
                            show: true,
                            total: {
                              show: true,
                              label: 'Total Returns',
                              fontSize: '14px',
                              fontWeight: 600,
                              color: '#374151',
                            }
                          }
                        }
                      }
                    },
                    dataLabels: { enabled: false },
                    tooltip: {
                      y: {
                        formatter: (val: number) => `${val} returns`,
                      }
                    },
                    responsive: [{
                      breakpoint: 480,
                      options: {
                        chart: {
                          height: 280
                        },
                        legend: {
                          position: 'bottom'
                        }
                      }
                    }]
                  }}
                  series={statusDistribution.series}
                  type="donut"
                  height={320}
                />
              </div>
            </div>
          </div>

          {/* Enhanced Additional Stats */}
          <div className="bg-white/70  backdrop-blur-xl rounded-2xl shadow-lg border border-white/20  p-6 lg:p-8">
            <h3 className="text-xl font-bold text-gray-900  mb-6 flex items-center">
              <div className="w-2 h-6 bg-green rounded-full mr-3"></div>
              Detailed Overview
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              <div className="space-y-4">
                <h4 className="text-sm font-bold text-gray-500  mb-4 uppercase tracking-wider">
                  {isAdminRole(userRole) ? "Returns Summary" : "My Returns Summary"}
                </h4>
                <div className="space-y-3">
                  <div className="flex justify-between items-center p-3 bg-gray-50  rounded-xl">
                    <span className="text-sm font-medium text-gray-600 ">Total</span>
                    <span className="text-sm font-bold text-gray-900 ">{summary.totalReturns?.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-green-50 dark:bg-green-900/20 rounded-xl">
                    <span className="text-sm font-medium text-gray-600 ">Completed</span>
                    <span className="text-sm font-bold text-green-600">{summary.completed?.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl">
                    <span className="text-sm font-medium text-gray-600 ">In Progress</span>
                    <span className="text-sm font-bold text-blue-600">{summary.assigned?.toLocaleString()}</span>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h4 className="text-sm font-bold text-gray-500  mb-4 uppercase tracking-wider">
                  Performance Metrics
                </h4>
                <div className="space-y-3">
                  <div className="flex justify-between items-center p-3 bg-green-50 dark:bg-green-900/20 rounded-xl">
                    <span className="text-sm font-medium text-gray-600 ">Completion Rate</span>
                    <span className="text-sm font-bold text-green-600">
                      {summary.totalReturns > 0 ? Math.round((summary.completed / summary.totalReturns) * 100) : 0}%
                    </span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl">
                    <span className="text-sm font-medium text-gray-600 ">Progress Rate</span>
                    <span className="text-sm font-bold text-blue-600">
                      {summary.totalReturns > 0 ? Math.round(((summary.completed + summary.assigned) / summary.totalReturns) * 100) : 0}%
                    </span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-gray-50 rounded-xl">
                    <span className="text-sm font-medium text-gray-600 ">Period</span>
                    <span className="text-sm font-bold text-gray-900 ">{summary.period}</span>
                  </div>
                </div>
              </div>

              {isAdminRole(userRole) && (
                <div className="space-y-4">
                  <h4 className="text-sm font-bold text-gray-500  mb-4 uppercase tracking-wider">
                    Payment Overview
                  </h4>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center p-3 bg-purple-50 dark:bg-purple-900/20 rounded-xl">
                      <span className="text-sm font-medium text-gray-600 ">Processed</span>
                      <span className="text-sm font-bold text-purple-600">{summary.payments?.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between items-center p-3 bg-green-50 dark:bg-green-900/20 rounded-xl">
                      <span className="text-sm font-medium text-gray-600 ">Payment Rate</span>
                      <span className="text-sm font-bold text-green-600">
                        {summary.totalReturns > 0 ? Math.round((summary.payments / summary.totalReturns) * 100) : 0}%
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}