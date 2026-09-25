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
import { asStringId } from '@/lib/stringId';

/** Map accountant/tax-return/files payload → TaxReturnAssignment cards. */
function mapAssignmentsPayload(data: unknown): TaxReturnAssignment[] {
    if (!data || typeof data !== 'object') return [];
    const envelope = data as Record<string, unknown>;
    const rowsRaw =
        (Array.isArray(envelope.assignments) && envelope.assignments) ||
        (Array.isArray(envelope.taxReturns) && envelope.taxReturns) ||
        (Array.isArray(envelope.files) && envelope.files) ||
        (Array.isArray(data) ? data : null);
    if (!rowsRaw) return [];

    return rowsRaw.map((row: any) => {
        const id = asStringId(row.id ?? row.caseId ?? row.case_id ?? row.taxReturnId);
        const serviceType = String(row.serviceType ?? row.service_type ?? '');
        const isMtd = serviceType.includes('MTD');
        const status = String(row.status || 'assigned').toLowerCase();
        const nameParts = String(row.client?.name ?? row.clientName ?? row.client_name ?? '')
            .trim()
            .split(/\s+/)
            .filter(Boolean);
        return {
            id: id as unknown as number, // interface legacy; runtime is UUID string
            taxReturnId: String(row.taxReturnId ?? row.case_ref ?? row.caseRef ?? id),
            taxYear: row.taxYear ?? row.tax_year ?? '',
            status: status as TaxReturnAssignment['status'],
            priority: String(row.priority ?? 'medium').toLowerCase() as TaxReturnAssignment['priority'],
            assignedAt: row.assignedAt ?? row.assigned_at ?? undefined,
            mtdQuarter: row.mtdQuarter ?? row.mtd_quarter ?? undefined,
            mtdQuarterDueDate: row.mtdQuarterDueDate ?? row.mtd_quarter_due_date ?? row.deadline ?? undefined,
            createdAt: row.createdAt ?? row.created_at ?? '',
            client: {
                id: asStringId(row.client?.id ?? row.client_user_id ?? '') as unknown as number,
                name: row.client?.name ?? nameParts[0] ?? 'Client',
                surname: row.client?.surname ?? nameParts.slice(1).join(' '),
                email: row.client?.email ?? '',
                userRole: row.client?.userRole ?? (isMtd ? 'MTD' : 'SA'),
            },
            TaxReturnType: row.TaxReturnType ?? row.type ?? {
                typeName: isMtd ? 'Making Tax Digital' : 'Self Assessment',
                typeCode: isMtd ? 'MTD' : 'SA',
            },
            documents: Array.isArray(row.documents) ? row.documents : [],
        } as TaxReturnAssignment;
    }).filter((a) => asStringId(a.id) || a.taxReturnId);
}

const AccountantAssignments: React.FC = () => {
    const [assignments, setAssignments] = useState<TaxReturnAssignment[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [activeSection, setActiveSection] = useState<string>('all');
    const [searchTerm, setSearchTerm] = useState('');
    const { data: session } = useSession();
    const router = useRouter();

    const fetchAssignments = async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await clientAxios.post('/accountant/tax-return/files', {});
            const responseData: ApiResponse = res.data;

            if (responseData.success) {
                setAssignments(mapAssignmentsPayload(responseData.data));
            } else {
                setAssignments([]);
            }
        } catch (err) {
            console.error('Error fetching tax returns:', err);
            setError('Failed to load assignments. Please try again.');
            setAssignments([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchAssignments();
    }, []);

    const accountantSections = [
        { key: 'all', label: 'All Assignments', count: assignments.length },
        { key: 'assigned', label: 'Assigned to Me', count: assignments.filter(a => a.status !== 'completed').length },
        { key: 'completed', label: 'Completed', count: assignments.filter(a => a.status === 'completed').length }
    ];

    const SECTION_STATUS_MAP: Record<string, string[] | null> = {
        all: null,
        assigned: ['assigned', 'draft_ready', 'final_submitted', 'preparation_started', 'pending_assignment'],
        completed: ['completed'],
    };

    const normalizedSearch = (searchTerm || '').trim().toLowerCase();

    const filteredAssignments = (assignments || []).filter((assignment) => {
        const status = (assignment?.status || '').toLowerCase();
        const allowedStatuses = SECTION_STATUS_MAP[activeSection];
        const matchesSection =
            activeSection === 'all' ||
            (Array.isArray(allowedStatuses) && allowedStatuses.includes(status)) ||
            status === activeSection;

        const taxReturnId = (assignment?.taxReturnId || '').toLowerCase();
        const typeName = (assignment?.TaxReturnType?.typeName || '').toLowerCase();
        const typeCode = (assignment?.TaxReturnType?.typeCode || '').toLowerCase();
        const clientName = `${assignment?.client?.name || ''} ${assignment?.client?.surname || ''}`.toLowerCase();

        const matchesSearch =
            !normalizedSearch ||
            taxReturnId.includes(normalizedSearch) ||
            typeName.includes(normalizedSearch) ||
            typeCode.includes(normalizedSearch) ||
            clientName.includes(normalizedSearch);

        return matchesSection && matchesSearch;
    });

    const handleEditAssignment = (id: string) => {
        console.log('Edit assignment:', id);
    };

    const handleCancelAssignment = async (id: string) => {
        if (confirm('Are you sure you want to cancel this assignment?')) {
            try {
                setAssignments(prev =>
                    prev.map(assignment =>
                        asStringId(assignment.id) === id
                            ? { ...assignment, status: 'cancelled' as const }
                            : assignment
                    )
                );
            } catch (err) {
                console.error('Error cancelling assignment:', err);
                fetchAssignments();
            }
        }
    };

    const handleCompleteAssignment = async (id: string) => {
        try {
            setAssignments(prev =>
                prev.map(assignment =>
                    asStringId(assignment.id) === id
                        ? { ...assignment, status: 'completed' as const }
                        : assignment
                )
            );
        } catch (err) {
            console.error('Error completing assignment:', err);
            fetchAssignments();
        }
    };

    const handleViewDetails = (assignmentId: string | number) => {
        const id = asStringId(assignmentId);
        if (!id) return;
        router.push(`/tax-return-list/${id}`);
    };

    return (
        <div className="p-4 md:p-6 space-y-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white">My Tax Return Assignments</h1>
                    <p className="text-sm text-gray-500 mt-1">Cases assigned to you (Self Assessment and Making Tax Digital).</p>
                </div>
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Search by client, case or type..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-9 pr-4 py-2 border rounded-lg text-sm w-full md:w-72"
                    />
                </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {accountantSections.map((section) => (
                    <button
                        key={section.key}
                        type="button"
                        onClick={() => setActiveSection(section.key)}
                        className={`text-left p-4 rounded-xl border transition ${
                            activeSection === section.key
                                ? 'border-[#37a267] bg-[#37a267]/10'
                                : 'border-gray-200 bg-white hover:border-gray-300'
                        }`}
                    >
                        <p className="text-sm font-medium text-gray-600">{section.label}</p>
                        <p className="text-2xl font-bold text-gray-900 mt-1">{section.count}</p>
                    </button>
                ))}
            </div>

            {loading ? (
                <div className="text-center py-12 text-gray-500">Loading assignments...</div>
            ) : error ? (
                <div className="text-center py-12 text-red-600 flex flex-col items-center gap-2">
                    <AlertCircle className="w-8 h-8" />
                    <p>{error}</p>
                    <button type="button" onClick={fetchAssignments} className="text-[#37a267] underline text-sm">
                        Retry
                    </button>
                </div>
            ) : filteredAssignments.length === 0 ? (
                <div className="text-center py-12 text-gray-500 bg-white rounded-xl border">
                    <FileText className="w-10 h-10 mx-auto mb-3 text-gray-300" />
                    <p className="font-medium">No assignments found</p>
                    <p className="text-sm mt-1">Assigned MTD and Self Assessment cases will appear here.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {filteredAssignments.map((assignment) => (
                        <TaxReturnAssignmentCard
                            key={asStringId(assignment.id) || assignment.taxReturnId}
                            assignment={assignment}
                            onEdit={handleEditAssignment}
                            onCancel={handleCancelAssignment}
                            onComplete={handleCompleteAssignment}
                            onViewDetails={handleViewDetails}
                        />
                    ))}
                </div>
            )}
        </div>
    );
};

export default AccountantAssignments;
