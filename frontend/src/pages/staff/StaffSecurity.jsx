import AppShell from "@/components/AppShell";
import { Panel } from "@/components/StatCard";
import TwoFactorPanel from "@/components/TwoFactorPanel";

export default function StaffSecurity() {
  return (
    <AppShell title="Security" subtitle="Protect your TaxSimba staff account">
      <Panel title="Sign-in security" testId="staff-security-panel">
        <TwoFactorPanel />
        <p className="text-xs text-[#626A65] mt-5">
          You handle sensitive client tax data. Two-factor authentication is required for Admin and
          Super Admin accounts and strongly recommended for accountants.
        </p>
      </Panel>
    </AppShell>
  );
}
