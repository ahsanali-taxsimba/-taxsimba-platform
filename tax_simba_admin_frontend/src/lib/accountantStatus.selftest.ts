/**
 * Unit checks for shared accountant status resolver (TS-UAT-029).
 * Run with: npx --yes tsx src/lib/accountantStatus.selftest.ts
 */
import {
  accountantStatusLabel,
  isAccountantActive,
} from "./accountantStatus";

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

assert(isAccountantActive({ isActive: true }) === true, "isActive true");
assert(isAccountantActive({ isActive: false }) === false, "isActive false");
assert(isAccountantActive({ is_active: true }) === true, "is_active true");
assert(isAccountantActive({ status: "active" }) === true, "status active");
assert(isAccountantActive({ status: "inactive" }) === false, "status inactive");
assert(isAccountantActive({ status: 1 }) === true, "legacy numeric 1 still readable");
assert(isAccountantActive({ status: "PENDING" }) === false, "pending inactive");
assert(accountantStatusLabel({ isActive: true }) === "Active", "label active");
assert(accountantStatusLabel({ isActive: false }) === "Inactive", "label inactive");
// Prefer boolean over conflicting status string
assert(isAccountantActive({ isActive: true, status: "inactive" }) === true, "boolean wins");

console.log("accountantStatus.selftest OK");
