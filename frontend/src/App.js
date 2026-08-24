import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import Login from "@/pages/Login";
import ClientDashboard from "@/pages/client/ClientDashboard";
import MyTaxReturn from "@/pages/client/MyTaxReturn";
import { ClientDocuments, ClientJourneyPage, ClientMessages, ClientTasks } from "@/pages/client/ClientPages";
import MyServices, { PaymentCancel, PaymentSuccess } from "@/pages/client/MyServices";
import { ActionRequired, RecommendationReview } from "@/pages/client/ClientActions";
import MtdQuarters from "@/pages/client/MtdQuarters";
import ClientProfile from "@/pages/client/ClientProfile";
import ClientSettings from "@/pages/client/ClientSettings";
import HelpCentre from "@/pages/client/HelpCentre";
import AdminRecommendations from "@/pages/staff/AdminRecommendations";
import AccountantDashboard from "@/pages/staff/AccountantDashboard";
import { AdminAccountants, AdminCases, AdminDashboard } from "@/pages/staff/AdminPages";
import AdminMtd from "@/pages/staff/AdminMtd";
import CaseWorkspace from "@/pages/staff/CaseWorkspace";
import SuperAdmin from "@/pages/staff/SuperAdmin";
import AcceptInvite from "@/pages/AcceptInvite";
import StaffSecurity from "@/pages/staff/StaffSecurity";
import { AdminServiceIssues, ClientServiceIssues } from "@/pages/ServiceIssues";

function Guard({ roles, children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center text-sm text-[#626A65]">Loading…</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to={user.role === "CLIENT" ? "/dashboard" : user.role === "ACCOUNTANT" ? "/work" : "/admin"} replace />;
  return children;
}

function Landing() {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center text-sm text-[#626A65]">Loading…</div>;
  if (!user) return <Navigate to="/login" replace />;
  return <Navigate to={user.role === "CLIENT" ? "/dashboard" : user.role === "ACCOUNTANT" ? "/work" : "/admin"} replace />;
}

const CLIENT = ["CLIENT"];
const STAFF = ["ACCOUNTANT"];
const ADMIN = ["ADMIN", "SUPER_ADMIN"];

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/invite/:token" element={<AcceptInvite />} />

          <Route path="/" element={<Landing />} />

          <Route path="/dashboard" element={<Guard roles={CLIENT}><ClientDashboard /></Guard>} />
          <Route path="/my-return" element={<Guard roles={CLIENT}><MyTaxReturn /></Guard>} />
          <Route path="/documents" element={<Guard roles={CLIENT}><ClientDocuments /></Guard>} />
          <Route path="/messages" element={<Guard roles={CLIENT}><ClientMessages /></Guard>} />
          <Route path="/tasks" element={<Guard roles={CLIENT}><ClientTasks /></Guard>} />
          <Route path="/journey" element={<Guard roles={CLIENT}><ClientJourneyPage /></Guard>} />
          <Route path="/profile" element={<Guard roles={CLIENT}><ClientProfile /></Guard>} />
          <Route path="/subscription" element={<Guard roles={CLIENT}><MyServices /></Guard>} />
          <Route path="/payment/success" element={<Guard roles={CLIENT}><PaymentSuccess /></Guard>} />
          <Route path="/payment/cancel" element={<Guard roles={CLIENT}><PaymentCancel /></Guard>} />
          <Route path="/actions" element={<Guard roles={CLIENT}><ActionRequired /></Guard>} />
          <Route path="/recommendation/:offerId" element={<Guard roles={CLIENT}><RecommendationReview /></Guard>} />
          <Route path="/mtd" element={<Guard roles={CLIENT}><MtdQuarters /></Guard>} />
          <Route path="/help" element={<Guard roles={CLIENT}><HelpCentre /></Guard>} />
          <Route path="/settings" element={<Guard roles={CLIENT}><ClientSettings /></Guard>} />
          <Route path="/service-issues" element={<Guard roles={CLIENT}><ClientServiceIssues /></Guard>} />
          <Route path="/admin/service-issues" element={<Guard roles={ADMIN}><AdminServiceIssues /></Guard>} />
          <Route path="/admin/mtd" element={<Guard roles={ADMIN}><AdminMtd /></Guard>} />

          <Route path="/work" element={<Guard roles={STAFF}><AccountantDashboard /></Guard>} />
          <Route path="/work/cases/:id" element={<Guard roles={["ACCOUNTANT", "ADMIN", "SUPER_ADMIN"]}><CaseWorkspace /></Guard>} />

          <Route path="/admin" element={<Guard roles={ADMIN}><AdminDashboard /></Guard>} />
          <Route path="/staff/security" element={<Guard roles={["ACCOUNTANT", "ADMIN", "SUPER_ADMIN"]}><StaffSecurity /></Guard>} />          <Route path="/admin/cases" element={<Guard roles={ADMIN}><AdminCases /></Guard>} />
          <Route path="/admin/cases/:id" element={<Guard roles={ADMIN}><CaseWorkspace /></Guard>} />
          <Route path="/admin/review/:id" element={<Guard roles={ADMIN}><CaseWorkspace /></Guard>} />
          <Route path="/admin/accountants" element={<Guard roles={ADMIN}><AdminAccountants /></Guard>} />
          <Route path="/admin/recommendations" element={<Guard roles={ADMIN}><AdminRecommendations /></Guard>} />
          <Route path="/super" element={<Guard roles={["SUPER_ADMIN"]}><SuperAdmin /></Guard>} />

          <Route path="*" element={<Landing />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
