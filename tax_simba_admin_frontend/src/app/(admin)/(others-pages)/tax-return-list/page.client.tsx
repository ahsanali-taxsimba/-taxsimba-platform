"use client";

import React, { useState, useEffect, Fragment } from 'react';
import {
    Calendar,
    Clock,
    User,
    Edit,
    CheckCircle,
    XCircle,
    Search,
    FileText,
    AlertCircle,
    Settings,
    Download,
    Eye
} from 'lucide-react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import clientAxios from '@/lib/axios-client';
import { ApiResponse, TaxReturnAssignment } from '@/utils/interface';
import TaxReturnAssignmentCard from './_section/TaxReturnAssignmentCard';




const AccountantAssignments: React.FC = () => {
    const [assignments, setAssignments] = useState<TaxReturnAssignment[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [activeSection, setActiveSection] = useState<string>('all');
    const [searchTerm, setSearchTerm] = useState('');
    const { data: session } = useSession();
    const router = useRouter();

    // Fetch assignments from API
    const fetchAssignments = async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await clientAxios.post('/accountant/tax-return/files', {});
            const responseData: ApiResponse = res.data;

            if (responseData.success && responseData.data?.assignments) {
                setAssignments(responseData.data.assignments);
            } else {
                setAssignments([]);
            }
        } catch (error) {
            console.error('Error fetching tax returns:', error);
            setError('Failed to load assignments. Please try again.');
            setAssignments([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchAssignments();
    }, []);
    console.log("assignments", assignments);
    // Accountant sections
    const accountantSections = [
        { key: 'all', label: 'All Assignments', count: assignments.length },
        { key: 'assigned', label: 'Assigned to Me', count: assignments.filter(a => a.status !== 'completed').length },
        { key: 'completed', label: 'Completed', count: assignments.filter(a => a.status === 'completed').length }
    ];

    // Filter assignments
    const SECTION_STATUS_MAP:any = {
        all: null,
        assigned: ['assigned', 'draft_ready', 'final_submitted', 'preparation_started'],

    };

    const normalizedSearch = (searchTerm || '').trim().toLowerCase();

    const filteredAssignments = (assignments || []).filter((assignment) => {
        const status = (assignment?.status || '').toLowerCase();

        // Section filter
        const allowedStatuses = SECTION_STATUS_MAP[activeSection];
        const matchesSection =
            activeSection === 'all' ||
            (Array.isArray(allowedStatuses) && allowedStatuses.includes(status)) ||
            (!SECTION_STATUS_MAP.hasOwnProperty(activeSection) && status === activeSection);

        // Search filter
        const taxReturnId = (assignment?.taxReturnId || '').toLowerCase();
        const typeName = (assignment?.TaxReturnType?.typeName || '').toLowerCase();
        const typeCode = (assignment?.TaxReturnType?.typeCode || '').toLowerCase();

        const matchesSearch =
            !normalizedSearch ||
            taxReturnId.includes(normalizedSearch) ||
            typeName.includes(normalizedSearch) ||
            typeCode.includes(normalizedSearch);

        return matchesSection && matchesSearch;
    });


    const handleEditAssignment = (id: string) => {
        // TODO: Implement edit functionality
        console.log('Edit assignment:', id);
    };

    const handleCancelAssignment = async (id: string) => {
        if (confirm('Are you sure you want to cancel this assignment?')) {
            try {
               
                setAssignments(prev =>
                    prev.map(assignment =>
                        assignment.id.toString() === id
                            ? { ...assignment, status: 'cancelled' as const }
                            : assignment
                    )
                );

               
            } catch (error) {
                console.error('Error cancelling assignment:', error);
         
                fetchAssignments();
            }
        }
    };

    const handleCompleteAssignment = async (id: string) => {
        try {
            // Update local state immediately for better UX
            setAssignments(prev =>
                prev.map(assignment =>
                    assignment.id.toString() === id
                        ? { ...assignment, status: 'completed' as const }
                        : assignment
                )
            );

            // TODO: Make API call to update status
            // await updateAssignmentStatus(id, 'completed');
        } catch (error) {
            console.error('Error completing assignment:', error);
            // Revert local state on error
            fetchAssignments();
        }
    };

    const handleViewDetails = (assignmentId: number) => {
        router.push(`/tax-return-list/${assignmentId}`);
    };

    // Statistics for accountant
    const stats = {
        total: assignments.length,
        // assigned: assignments.filter(a => a.status == 'assigned').length,
        inProgress: assignments.filter(a => a.status !== 'completed').length,
        completed: assignments.filter(a => a.status === 'completed').length
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                    <h2 className="text-xl font-semibold text-gray-900">Loading Assignments...</h2>
                    <p className="text-gray-600">Please wait while we fetch your assignments.</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="text-center">
                    <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
                    <h2 className="text-xl font-semibold text-gray-900 mb-2">Error Loading Assignments</h2>
                    <p className="text-gray-600 mb-4">{error}</p>
                    <button
                        onClick={fetchAssignments}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    >
                        Retry
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header */}
            <div className="bg-white shadow-sm border-b">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between items-center py-6">
                        <div>
                            <h1 className="text-3xl font-bold text-gray-900">My Tax Return Assignments</h1>
                            <p className="text-gray-600 mt-1">
                                Track your assigned tax return tasks and completed work
                            </p>
                        </div>
                        <div className="flex items-center space-x-4">
                            <button
                                onClick={fetchAssignments}
                                className="flex items-center space-x-2 bg-gray-100 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-200 transition-colors"
                            >
                                <Settings className="h-4 w-4" />
                                <span>Refresh</span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* Search Bar */}
                <div className="mb-6">
                    <div className="relative">
                        <Search className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Search by Tax Return ID, Type, or Code..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                    </div>
                </div>

                {/* Section Tabs */}
                <div className="bg-white rounded-lg shadow-sm mb-8">
                    <div className="border-b border-gray-200">
                        <nav className="-mb-px flex space-x-8 px-6">
                            {accountantSections.map((section) => (
                                <button
                                    key={section.key}
                                    onClick={() => setActiveSection(section.key)}
                                    className={`py-4 px-1 border-b-2 font-medium text-sm whitespace-nowrap ${activeSection === section.key
                                            ? 'border-blue-500 text-blue-600'
                                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                                        }`}
                                >
                                    {section.label}
                                    <span className="ml-2 bg-gray-100 text-gray-600 py-0.5 px-2 rounded-full text-xs">
                                        {section.count}
                                    </span>
                                </button>
                            ))}
                        </nav>
                    </div>
                </div>

                {/* Statistics Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                    <div className="bg-white rounded-lg p-6 border border-gray-200">
                        <div className="flex items-center">
                            <div className="p-2 bg-blue-100 rounded-lg">
                                <Calendar className="h-6 w-6 text-blue-600" />
                            </div>
                            <div className="ml-4">
                                <p className="text-sm font-medium text-gray-600">My Assignments</p>
                                <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
                            </div>
                        </div>
                    </div>


                    <div className="bg-white rounded-lg p-6 border border-gray-200">
                        <div className="flex items-center">
                            <div className="p-2 bg-orange-100 rounded-lg">
                                <Settings className="h-6 w-6 text-orange-600" />
                            </div>
                            <div className="ml-4">
                                <p className="text-sm font-medium text-gray-600">In Progress</p>
                                <p className="text-2xl font-bold text-gray-900">{stats.inProgress}</p>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white rounded-lg p-6 border border-gray-200">
                        <div className="flex items-center">
                            <div className="p-2 bg-green-100 rounded-lg">
                                <CheckCircle className="h-6 w-6 text-green-600" />
                            </div>
                            <div className="ml-4">
                                <p className="text-sm font-medium text-gray-600">Completed</p>
                                <p className="text-2xl font-bold text-gray-900">{stats.completed}</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Assignment Cards */}
                <div className="space-y-6">
                    {filteredAssignments.length > 0 ? (
                        filteredAssignments.map((assignment) => (
                            <TaxReturnAssignmentCard
                                key={assignment.id}
                                assignment={assignment}
                                onEdit={handleEditAssignment}
                                onCancel={handleCancelAssignment}
                                onComplete={handleCompleteAssignment}
                                onViewDetails={handleViewDetails}
                            />
                        ))
                    ) : (
                        <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
                            <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                            <h3 className="text-lg font-medium text-gray-900 mb-2">No assignments found</h3>
                            <p className="text-gray-500 mb-4">
                                {searchTerm || activeSection !== 'all'
                                    ? 'Try adjusting your filters or search terms.'
                                    : 'No tax return assignments have been assigned to you yet.'
                                }
                            </p>
                            {searchTerm && (
                                <button
                                    onClick={() => {
                                        setSearchTerm('');
                                        setActiveSection('all');
                                    }}
                                    className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
                                >
                                    Clear Filters
                                </button>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default AccountantAssignments;