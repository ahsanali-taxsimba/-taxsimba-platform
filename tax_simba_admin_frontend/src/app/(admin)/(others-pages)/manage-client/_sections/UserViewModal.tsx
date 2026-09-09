"use client";
import React from "react";
import { Modal } from "@/components/ui/modal";
import { 
    User as UserIcon, 
    Mail, 
    Phone, 
    Calendar, 
    Shield, 
    MapPin, 
    Hash, 
    Building2, 
    ClipboardCheck, 
    LayoutGrid,
    Clock,
    UserCheck,
    CreditCard,
    FileText,
    CheckCircle,
    XCircle
} from "lucide-react";

interface UserViewModalProps {
    isOpen: boolean;
    onClose: () => void;
    user: {
        id: number;
        username: string;
        email: string;
        firstName: string;
        lastName: string;
        mobile: string;
        userRole: string;
        status: number;
        createdAt: string;
        dob?: string;
        nino?: string;
        utr?: string;
        hasGovGateway?: boolean;
        bankUsageForSelfEmployment?: boolean;
        businessBankCount?: number;
        isTaxInfoSubmitted?: boolean;
        address?: string;
        street?: string;
        city?: string;
        zip?: string;
        country?: string;
        location?: string;
        businessType?: string;
        businessName?: string;
        isRegisteredForMTD?: string;
        incomeSources?: any;
        annualTurnover?: string;
        recordKeepingMethod?: string;
        govGatewayStatus?: string;
        accountantNotes?: string;
        currentAccountant?: string;
        prevSubmittedMTDThisYear?: string;
        submittedQuarters?: any;
        whoSubmittedQuarters?: string;
        hasOutstandingMTDSubmissions?: string;
        reviewPreviousMTDSubmissions?: string;
        firstQuarterToManage?: string;
        hasGatewayCredentials?: string;
        previousMTDSoftware?: string;
        otherActiveIncomeSources?: string;
        subscription?: {
            plan?: {
                name: string;
            };
        };
    } | null;
}

const UserViewModal: React.FC<UserViewModalProps> = ({ isOpen, onClose, user }) => {
    if (!user) return null;

    const isMTDUser = user.userRole === "MTD";

    const formatIncomeSources = (sources: any) => {
        if (!sources) return "N/A";
        if (Array.isArray(sources)) return sources.join(", ");
        if (typeof sources === "string") {
            try {
                const parsed = JSON.parse(sources);
                if (Array.isArray(parsed)) return parsed.join(", ");
            } catch (e) {}
            return sources;
        }
        return "N/A";
    };

    const fullAddress = user.address || user.location || [user.street, user.city, user.zip, user.country].filter(Boolean).join(", ");

    const InfoItem = ({ label, value }: { label: string; value: any }) => (
        <div className="flex flex-col gap-0.5">
            <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">{label}</span>
            <span className="text-sm font-bold text-gray-900 dark:text-white/90">{value || "N/A"}</span>
        </div>
    );

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            className="max-w-2xl p-0 overflow-hidden border-0 rounded-3xl shadow-2xl"
        >
            <div className="relative overflow-hidden bg-white dark:bg-gray-950">
                {/* Premium Dark Gradient Header */}
                <div
                    className="relative px-8 py-7 pr-16 flex justify-between items-center overflow-hidden"
                    style={{
                        background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 60%, #1a3a2a 100%)',
                    }}
                >
                    {/* Background glow orb */}
                    <div
                        className="absolute -top-8 -right-8 w-48 h-48 rounded-full opacity-20 pointer-events-none"
                        style={{ background: 'radial-gradient(circle, #37a267 0%, transparent 70%)' }}
                    />
                    <div>
                        <p className="text-xs font-semibold tracking-widest uppercase mb-1" style={{ color: '#37a267' }}>
                            Identity Record
                        </p>
                        <h2 className="text-2xl font-extrabold text-white tracking-tight">Client Details</h2>
                    </div>

                    {/* Glowing Status Badge */}
                    <div
                        className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold border backdrop-blur-sm ${
                            user.status === 1 
                            ? "bg-green-100/10 text-green-400 border-green-500/20" 
                            : "bg-red-100/10 text-red-400 border-red-500/20"
                        }`}
                        style={{ boxShadow: user.status === 1 ? '0 0 12px rgba(55,162,103,0.35)' : '0 0 12px rgba(239,68,68,0.35)' }}
                    >
                        {user.status === 1 ? <CheckCircle className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                        <span className="capitalize">{user.status === 1 ? "Active" : "Inactive"}</span>
                    </div>
                </div>

                {/* Identity Hero Strip */}
                <div
                    className="px-8 py-5 flex items-center justify-between border-b dark:border-white/[0.05]"
                    style={{ background: 'linear-gradient(90deg, #f0fdf4 0%, #eff6ff 100%)' }}
                >
                    <div className="flex items-center gap-4">
                        <div
                            className="w-16 h-16 rounded-2xl flex items-center justify-center text-white font-black text-2xl flex-shrink-0 shadow-lg"
                            style={{ background: 'linear-gradient(135deg, #37a267, #1e3a5f)' }}
                        >
                            {user.firstName?.charAt(0)}{user.lastName?.charAt(0)}
                        </div>
                        <div>
                            <h3 className="text-2xl font-black tracking-tight" style={{ color: '#1e3a5f' }}>
                                {user.firstName} {user.lastName}
                            </h3>
                            <p className="text-sm font-medium text-gray-500 flex items-center gap-1.5 mt-0.5">
                                <Mail className="w-3.5 h-3.5" />
                                {user.email}
                            </p>
                        </div>
                    </div>
                    <div className="flex flex-col items-end gap-2 text-right">
                        <span
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold"
                            style={{ background: '#dbeafe', color: '#1d4ed8' }}
                        >
                            <Shield className="w-3.5 h-3.5" />
                            <span className="capitalize">{user.userRole || "TAXSIMBA"}</span>
                        </span>
                        <span
                            className="text-xs font-mono font-semibold px-3 py-1 rounded-lg"
                            style={{ background: '#f1f5f9', color: '#64748b' }}
                        >
                            USR-{String(user.id).padStart(6, '0')}
                        </span>
                    </div>
                </div>

                {/* Main Body */}
                <div className="p-8 space-y-6 max-h-[60vh] overflow-y-auto custom-scrollbar">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Basic Info Card */}
                        <div 
                            className="rounded-2xl p-5 border flex flex-col gap-4" 
                            style={{ background: '#f8fafc', borderColor: '#e2e8f0' }}
                        >
                            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-0.5">Client Information</p>
                            <div className="grid grid-cols-2 gap-y-5 gap-x-4">
                                <InfoItem label="Username" value={user.username} />
                                <InfoItem label="Mobile" value={user.mobile} />
                                <InfoItem label="Location" value={user.location} />
                                <InfoItem label="Status" value={user.status === 1 ? "Active" : "Inactive"} />
                                <div className="col-span-2">
                                    <InfoItem label="Created At" value={user.createdAt ? new Date(user.createdAt).toLocaleDateString("en-GB") : "N/A"} />
                                </div>
                            </div>
                        </div>

                        {/* Subscription Card */}
                        <div 
                            className="rounded-2xl p-5 border flex flex-col gap-4" 
                            style={{ background: '#f8fafc', borderColor: '#e2e8f0' }}
                        >
                            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-0.5">Account Details</p>
                            <div className="space-y-4">
                                <div className="flex justify-between items-center">
                                    <span className="text-sm text-gray-500 font-medium">Current Plan</span>
                                    <span
                                        className="text-xs font-bold px-3 py-1.5 rounded-lg uppercase tracking-wider"
                                        style={{ background: '#ede9fe', color: '#6d28d9' }}
                                    >
                                        {user.subscription?.plan?.name || "No Plan"}
                                    </span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-sm text-gray-500 font-medium">Role Level</span>
                                    <span className="text-sm font-bold text-gray-900">{user.userRole || "Standard"}</span>
                                </div>
                            </div>
                        </div>

                        {/* Tax Info (MTD Only) */}
                        {isMTDUser && (
                            <div 
                                className="col-span-full rounded-2xl p-6 border grid grid-cols-2 md:grid-cols-4 gap-6" 
                                style={{ background: '#f8fafc', borderColor: '#e2e8f0' }}
                            >
                                <div className="col-span-full border-b pb-2 mb-1">
                                    <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Tax & MTD Records</p>
                                </div>
                                <InfoItem label="UTR Number" value={user.utr} />
                                <InfoItem label="NINO" value={user.nino} />
                                <InfoItem label="Date of Birth" value={user.dob} />
                                <InfoItem label="Gov Gateway" value={user.govGatewayStatus || (user.hasGovGateway ? "Enabled" : "Disabled")} />
                                <InfoItem label="Bank Access" value={user.bankUsageForSelfEmployment ? "Connected" : "Disconnected"} />
                                <InfoItem label="Bus. Bank Count" value={user.businessBankCount} />
                                <InfoItem label="Info Submitted" value={user.isTaxInfoSubmitted ? "Yes" : "No"} />
                                <InfoItem label="Registered MTD" value={user.isRegisteredForMTD} />
                                <InfoItem label="Business Name" value={user.businessName} />
                                <InfoItem label="Business Type" value={user.businessType} />
                                <InfoItem label="Annual Turnover" value={user.annualTurnover} />
                                <InfoItem label="Record Keeping" value={user.recordKeepingMethod} />
                                <InfoItem label="Current Accountant" value={user.currentAccountant} />
                                <InfoItem label="MTD Submitted" value={user.prevSubmittedMTDThisYear} />
                                <InfoItem label="Submitted Quarters" value={formatIncomeSources(user.submittedQuarters)} />
                                <InfoItem label="Who Submitted" value={user.whoSubmittedQuarters} />
                                <InfoItem label="Outstanding Subs" value={user.hasOutstandingMTDSubmissions} />
                                <InfoItem label="Review Previous" value={user.reviewPreviousMTDSubmissions} />
                                <InfoItem label="1st Qtr Manage" value={user.firstQuarterToManage} />
                                <InfoItem label="Has Gateway Creds" value={user.hasGatewayCredentials} />
                                <InfoItem label="Previous Software" value={user.previousMTDSoftware} />
                                <InfoItem label="Other Income Sources" value={user.otherActiveIncomeSources} />
                                <div className="col-span-1 md:col-span-3">
                                    <InfoItem label="Income Sources" value={formatIncomeSources(user.incomeSources)} />
                                </div>
                                {user.accountantNotes && (
                                    <div className="col-span-full border-t pt-4 mt-2">
                                        <InfoItem label="Accountant Notes" value={user.accountantNotes} />
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Address Card */}
                        <div 
                            className="col-span-full rounded-2xl p-5 border flex flex-col gap-3" 
                            style={{ background: '#f8fafc', borderColor: '#e2e8f0' }}
                        >
                            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Registered Address</p>
                            <div className="flex items-start gap-3">
                                <div className="p-2.5 rounded-xl bg-white border border-gray-100 text-amber-600 shadow-sm flex-shrink-0">
                                    <MapPin size={18} />
                                </div>
                                <div>
                                    <p className="text-sm font-bold text-gray-900 leading-relaxed">
                                        {fullAddress || "No residential address provided."}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer Section */}
                <div className="p-6 border-t dark:border-white/[0.05] bg-gray-50/50 dark:bg-black/20 flex justify-center">
                    <button
                        onClick={onClose}
                        className="w-48 py-3 bg-[#0f172a] hover:bg-[#1e293b] text-white font-bold rounded-xl shadow-lg transition-all active:scale-95 text-sm tracking-wide"
                    >
                        Close Details
                    </button>
                </div>
            </div>
        </Modal>
    );
};

export default UserViewModal;


