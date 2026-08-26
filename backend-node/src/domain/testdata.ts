/**
 * Separation of automated-test records from genuine operational records.
 *
 * Test suites create throwaway clients with recognisable addresses. Their cases stay in the
 * database (nothing is deleted, audit history is preserved) but are flagged so they never
 * appear in operational accountant/admin queues, counts, deadlines or searches.
 */
const TEST_EMAIL_PREFIXES = ["test_", "ux_test_", "qa."];
const TEST_EMAIL_DOMAINS = ["qa-taxsimba.example.com"];
// Manual demo accounts are genuine operational records and must never be flagged.
const GENUINE_EMAILS = ["clienta@example.com", "clientb@example.com"];

/** Reused by every operational query so one rule governs all of them. */
export const OPERATIONAL_ONLY = { is_test: { $ne: true } };

/** Mongo regex matching the automated-test address patterns above. */
export const TEST_EMAIL_REGEX = "^(test_|ux_test_|qa\\.)|@qa-taxsimba\\.example\\.com$";

export function isTestEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const lowered = email.toLowerCase();
  if (GENUINE_EMAILS.includes(lowered)) return false;
  return (
    TEST_EMAIL_PREFIXES.some((p) => lowered.startsWith(p)) ||
    TEST_EMAIL_DOMAINS.some((d) => lowered.endsWith(d))
  );
}
