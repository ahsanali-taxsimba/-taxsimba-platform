import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  Bell, LayoutDashboard, FileText, FolderOpen, MessageSquare, CheckSquare, Route,
  User, CreditCard, HelpCircle, Settings, Users, Briefcase, ShieldCheck, LogOut, Menu, Sparkles,
  AlertCircle, Layers, CalendarClock,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { api, dt } from "@/lib/api";

const CLIENT_NAV = [
  ["Dashboard", "/dashboard", LayoutDashboard],
  ["Action Required", "/actions", AlertCircle],
  ["My Tax Return", "/my-return", FileText],
  ["Documents", "/documents", FolderOpen],
  ["Messages", "/messages", MessageSquare],
  ["Tasks", "/tasks", CheckSquare],
  ["Your Tax Journey", "/journey", Route],
  ["Profile", "/profile", User],
  ["My Services", "/subscription", CreditCard],
  ["Report a Problem", "/service-issues", AlertCircle],
  ["Help Centre", "/help", HelpCircle],
  ["Settings", "/settings", Settings],
];

const ACCOUNTANT_NAV = [
  ["Dashboard", "/work", LayoutDashboard],
  ["My Cases", "/work?tab=in_progress", Briefcase],
];

const ADMIN_NAV = [
  ["Dashboard", "/admin", LayoutDashboard],
  ["All Cases", "/admin/cases", Briefcase],
  ["Admin Review", "/admin/cases?bucket=admin_review", ShieldCheck],
  ["Recommendations", "/admin/recommendations", Sparkles],
  ["Service Issues", "/admin/service-issues", AlertCircle],
  ["MTD Operations", "/admin/mtd", CalendarClock],
  ["Accountants", "/admin/accountants", Users],
];

const SUPER_NAV = [["Super Admin", "/super", ShieldCheck]];

export default function AppShell({ children, title, subtitle }) {
  const { user, logout } = useAuth();
  const loc = useLocation();
  const nav = useNavigate();
  const [notes, setNotes] = useState([]);
  const [openNotes, setOpenNotes] = useState(false);
  const [openNav, setOpenNav] = useState(false);
  const [mtdActive, setMtdActive] = useState(false);

  useEffect(() => {
    if (user?.role !== "CLIENT") return;
    api.get("/my-services")
      .then(({ data }) => setMtdActive(
        (data.services || []).some((s) => s.service_type === "MTD_INCOME_TAX" && s.status === "ACTIVE")))
      .catch(() => {});
  }, [user]);

  const load = () => api.get("/notifications").then(({ data }) => setNotes(data)).catch(() => {});
  useEffect(() => {
    load();
    const t = setInterval(load, 20000);
    return () => clearInterval(t);
  }, [loc.pathname]);

  let items = CLIENT_NAV;
  if (user?.role === "ACCOUNTANT") items = ACCOUNTANT_NAV;
  if (user?.role === "ADMIN") items = ADMIN_NAV;
  if (user?.role === "SUPER_ADMIN") items = [...ADMIN_NAV, ...SUPER_NAV];
  if (user?.role === "CLIENT" && mtdActive) {
    items = [...CLIENT_NAV.slice(0, 2), ["MTD for Income Tax", "/mtd", Layers], ...CLIENT_NAV.slice(2)];
  }

  const unread = notes.filter((n) => !n.is_read).length;

  return (
    <div className="min-h-screen bg-[#F7F8F7] flex">
      <aside
        className={`${openNav ? "fixed inset-y-0 left-0 z-40 flex" : "hidden"} md:flex md:static w-64 shrink-0 flex-col bg-white border-r border-[#E3E7E4]`}
      >
        <div className="px-6 py-6 border-b border-[#E3E7E4]">
          <div className="text-xl font-extrabold text-[#006B3C] tracking-tight font-heading">TaxSimba</div>
          <div className="text-[11px] uppercase tracking-widest text-[#626A65] mt-1">{user?.role?.replace("_", " ")}</div>
        </div>
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {items.map(([label, path, Icon]) => {
            const active = loc.pathname + loc.search === path || (loc.pathname === path && !loc.search);
            return (
              <Link
                key={label + path}
                to={path}
                data-testid={`nav-${label.toLowerCase().replace(/[^a-z]+/g, "-")}`}
                onClick={() => setOpenNav(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                  active ? "bg-[#EAF5EE] text-[#006B3C] font-semibold" : "text-[#161B18] hover:bg-[#F1F8F4]"
                }`}
              >
                <Icon size={17} color={active ? "#006B3C" : "#626A65"} />
                {label}
              </Link>
            );
          })}
        </nav>
        <button
          data-testid="logout-btn"
          onClick={async () => { await logout(); nav("/login"); }}
          className="m-3 flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-[#D64545] hover:bg-[#FBEBEB] transition-colors"
        >
          <LogOut size={17} /> Sign out
        </button>
      </aside>

      <div className="flex-1 min-w-0">
        <header className="bg-white border-b border-[#E3E7E4] px-5 md:px-10 py-5 flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <button className="md:hidden mt-1" onClick={() => setOpenNav(!openNav)} data-testid="mobile-nav-toggle">
              <Menu size={20} />
            </button>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#161B18] font-heading">{title}</h1>
              {subtitle && <p className="text-sm text-[#626A65] mt-1">{subtitle}</p>}
            </div>
          </div>
          <div className="relative">
            <button
              data-testid="notifications-btn"
              onClick={() => setOpenNotes(!openNotes)}
              className="relative h-10 w-10 rounded-full border border-[#E3E7E4] flex items-center justify-center hover:bg-[#F1F8F4] transition-colors"
            >
              <Bell size={18} color="#161B18" />
              {unread > 0 && (
                <span data-testid="notification-count" className="absolute -top-1 -right-1 min-w-5 h-5 px-1 rounded-full bg-[#D64545] text-white text-[11px] font-bold flex items-center justify-center">
                  {unread}
                </span>
              )}
            </button>
            {openNotes && (
              <div data-testid="notifications-panel" className="absolute right-0 mt-2 w-80 max-h-96 overflow-y-auto bg-white border border-[#E3E7E4] rounded-xl shadow-md z-50">
                <div className="flex items-center justify-between px-4 py-3 border-b border-[#E3E7E4]">
                  <span className="text-sm font-semibold">Notifications</span>
                  <button
                    data-testid="mark-all-read-btn"
                    className="text-xs text-[#078A4B] font-semibold"
                    onClick={async () => { await api.post("/notifications/read-all"); load(); }}
                  >
                    Mark all read
                  </button>
                </div>
                {notes.length === 0 && <p className="p-4 text-sm text-[#626A65]">No notifications yet.</p>}
                {notes.map((n) => (
                  <button
                    key={n.id}
                    data-testid={`notification-${n.id}`}
                    onClick={async () => {
                      await api.post(`/notifications/${n.id}/read`);
                      setOpenNotes(false);
                      if (n.link) nav(n.link);
                      load();
                    }}
                    className={`w-full text-left px-4 py-3 border-b border-[#E3E7E4] hover:bg-[#F1F8F4] ${n.is_read ? "" : "bg-[#F1F8F4]"}`}
                  >
                    <div className="text-sm font-semibold text-[#161B18]">{n.title}</div>
                    <div className="text-xs text-[#626A65] mt-0.5">{n.body}</div>
                    <div className="text-[11px] text-[#626A65] mt-1">{dt(n.created_at)}</div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </header>
        <main className="p-5 md:p-10 max-w-[1400px]">{children}</main>
      </div>
    </div>
  );
}
