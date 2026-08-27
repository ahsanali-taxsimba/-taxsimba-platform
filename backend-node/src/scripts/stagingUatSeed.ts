/**
 * Staging UAT seed — disposable, clearly-fake accounts for manual acceptance testing.
 *
 * NEVER run this against production. It refuses to run unless STAGING_UAT_SEED=yes and the
 * database name contains "staging" or "uat".
 *
 * Accounts and service activation are created through the same domain functions the
 * application uses (activateService), and every mid-year MTD fixture is produced by calling
 * the real HTTP API as the relevant role, so nothing here bypasses workflow or permissions.
 *
 * Usage (from backend-node, against a running staging API):
 *   MONGO_URL=... DB_NAME=taxsimba_staging BASE_URL=https://staging-api.example.com \
 *   UAT_PASSWORD='...' STAGING_UAT_SEED=yes node dist/scripts/stagingUatSeed.js
 */
import { randomUUID } from "crypto";

import { config } from "dotenv";

import { close, col, connect, Doc } from "../db/mongo";
import { activateService, ensurePhase1bData } from "../domain/packages";
import { MTD } from "../domain/mtd";
import { ensureCoreIndexes } from "../domain/seed";
import { nowIso } from "../domain/workflow";
import { hashPassword } from "../services/auth";

const SA = "SELF_ASSESSMENT";

interface Person {
  email: string;
  name: string;
  role: string;
  services?: string[];
}

const STAFF: Person[] = [
  { email: "uat.superadmin@uat-taxsimba.test", name: "UAT Super Admin", role: "SUPER_ADMIN" },
  { email: "uat.admin@uat-taxsimba.test", name: "UAT Admin", role: "ADMIN" },
  { email: "uat.accountant@uat-taxsimba.test", name: "UAT Accountant", role: "ACCOUNTANT" },
];

const CLIENTS: Person[] = [
  { email: "uat.sa.only@uat-taxsimba.test", name: "UAT SA Only", role: "CLIENT", services: [SA] },
  { email: "uat.mtd.only@uat-taxsimba.test", name: "UAT MTD Only", role: "CLIENT", services: [MTD] },
  { email: "uat.dual@uat-taxsimba.test", name: "UAT Dual Service", role: "CLIENT", services: [SA, MTD] },
  { email: "uat.q3joiner@uat-taxsimba.test", name: "UAT Q3 Joiner", role: "CLIENT", services: [MTD] },
];

const PACKAGE: Record<string, string> = { [SA]: "SMART", [MTD]: "MTD_ESSENTIAL" };

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function guard(): void {
  if (process.env.STAGING_UAT_SEED !== "yes") {
    throw new Error("Refusing to run: set STAGING_UAT_SEED=yes to confirm this is staging/UAT");
  }
  const dbName = (process.env.DB_NAME ?? "").toLowerCase();
  if (!/staging|uat|test/.test(dbName)) {
    throw new Error(`Refusing to run against database "${dbName}": name must contain staging/uat`);
  }
}

async function upsertUser(person: Person, password: string): Promise<Doc> {
  const email = person.email.toLowerCase();
  const existing = (await col("users").findOne({ email })) as Doc | null;
  if (existing) {
    await col("users").updateOne(
      { id: existing.id },
      { $set: { password_hash: hashPassword(password), is_active: true, status: "ACTIVE" } },
    );
    return (await col("users").findOne({ id: existing.id })) as Doc;
  }
  const doc: Doc = {
    id: randomUUID(),
    email,
    name: person.name,
    role: person.role,
    password_hash: hashPassword(password),
    is_active: true,
    // Operational, not is_test: the automated-test flag hides records from every default
    // dashboard query, which would leave manual UAT testers looking at empty screens. The
    // whole staging database is disposable, and cleanup deletes by @uat-taxsimba.test address.
    is_test: false,
    created_at: nowIso(),
  };
  if (person.role === "CLIENT") {
    doc.phone = "+44 7700 900000";
    doc.utr = "0000000000";
    doc.address = "1 UAT Street, Testville";
  }
  await col("users").insertOne({ ...doc });
  return doc;
}

async function upsertClientRecord(user: Doc): Promise<Doc> {
  const existing = (await col("clients").findOne({ user_id: user.id })) as Doc | null;
  if (existing) return existing;
  const doc: Doc = {
    id: randomUUID(),
    user_id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone ?? null,
    utr: user.utr ?? null,
    is_test: false,
    created_at: nowIso(),
  };
  await col("clients").insertOne({ ...doc });
  return doc;
}

async function upsertAccountantProfile(user: Doc): Promise<void> {
  const existing = await col("accountant_profiles").findOne({ user_id: user.id });
  if (existing) return;
  await col("accountant_profiles").insertOne({
    id: randomUUID(),
    user_id: user.id,
    name: user.name,
    email: user.email,
    specialisms: [SA, MTD],
    capacity: 15,
    is_active: true,
    created_at: nowIso(),
  });
}

/** Minimal cookie-jar HTTP client that speaks the app's cookie + double-submit CSRF scheme. */
class ApiSession {
  private cookies = new Map<string, string>();

  constructor(private readonly baseUrl: string) {}

  private store(response: Response): void {
    for (const raw of response.headers.getSetCookie?.() ?? []) {
      const [pair] = raw.split(";");
      const index = pair.indexOf("=");
      if (index > 0) this.cookies.set(pair.slice(0, index).trim(), pair.slice(index + 1).trim());
    }
  }

  async request(method: string, path: string, body?: Doc): Promise<Doc> {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (this.cookies.size) {
      headers.Cookie = [...this.cookies].map(([k, v]) => `${k}=${v}`).join("; ");
    }
    const csrf = this.cookies.get("csrf_token");
    if (csrf) headers["X-CSRF-Token"] = csrf;
    const response = await fetch(`${this.baseUrl}/api${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    this.store(response);
    const text = await response.text();
    const parsed = text ? (JSON.parse(text) as Doc) : {};
    if (!response.ok) {
      throw new Error(`${method} ${path} -> ${response.status} ${JSON.stringify(parsed)}`);
    }
    return parsed;
  }

  async login(email: string, password: string): Promise<Doc> {
    const out = await this.request("POST", "/auth/login", { email, password });
    if (out.two_factor_required) {
      throw new Error(`${email} has MFA enabled — disable it before seeding, or use a fresh account`);
    }
    return out;
  }
}

async function seedMidYearFixture(baseUrl: string, password: string, caseId: string): Promise<void> {
  const periods = (await col("mtd_periods")
    .find({ case_id: caseId, kind: "QUARTER" })
    .toArray()) as Doc[];
  const q1 = periods.find((p) => Number(p.quarter) === 1);
  const q2 = periods.find((p) => Number(p.quarter) === 2);
  if (!q1 || !q2) throw new Error("Q3 joiner case is missing its quarters");

  // Joined the day after Q2 ended, so Q1 and Q2 are the quarters the questionnaire asks about.
  const dayAfterQ2 = new Date(`${String(q2.period_end).slice(0, 10)}T00:00:00Z`);
  dayAfterQ2.setUTCDate(dayAfterQ2.getUTCDate() + 1);
  await col("cases").updateOne(
    { id: caseId },
    { $set: { mtd_joined_on: dayAfterQ2.toISOString() } },
  );

  const admin = new ApiSession(baseUrl);
  await admin.login("uat.admin@uat-taxsimba.test", password);
  const accountantUser = (await col("users").findOne({
    email: "uat.accountant@uat-taxsimba.test",
  })) as Doc;

  // Every UAT case goes to the UAT accountant so assigned-work views have content.
  for (const kase of (await col("cases").find({ client_name: /^UAT / }).toArray()) as Doc[]) {
    if (kase.assigned_accountant_id) continue;
    await admin.request("POST", `/cases/${kase.id}/assign`, {
      accountant_id: accountantUser.id,
      priority: "MEDIUM",
      internal_instructions: "Disposable UAT case",
    });
  }

  // 1. Client answers the mid-year questionnaire: Q1 filed elsewhere, Q2 still to do.
  const client = new ApiSession(baseUrl);
  await client.login("uat.q3joiner@uat-taxsimba.test", password);
  await client.request("POST", `/mtd/cases/${caseId}/onboarding`, {
    answers: [
      {
        quarter: 1,
        status: "SUBMITTED_ELSEWHERE",
        previous_provider: "Ledger & Co (UAT)",
        submission_date: "2026-08-01",
        submission_reference: "UAT-Q1-PRIOR-001",
      },
      { quarter: 2, status: "NOT_SUBMITTED", note: "Never filed — please prepare it." },
    ],
  });

  // 2. Accountant enters the Q1 evidence and recommends the Q2 catch-up work.
  const accountant = new ApiSession(baseUrl);
  await accountant.login("uat.accountant@uat-taxsimba.test", password);
  await accountant.request("POST", `/mtd/cases/${caseId}/onboarding/quarters/1/evidence`, {
    previous_provider: "Ledger & Co (UAT)",
    submission_date: "2026-08-01",
    submission_reference: "UAT-Q1-PRIOR-001",
    note: "Confirmation email from the previous accountant seen.",
  });
  await accountant.request("POST", `/mtd/cases/${caseId}/onboarding/quarters/2/review`, {
    outcome: "TAXSIMBA_CATCH_UP",
    note: "No prior filing found — TaxSimba to prepare Quarter 2.",
  });
  const recommendation = await accountant.request(
    "POST",
    `/cases/${caseId}/recommend-additional-work`,
    { reason: "Catch-up preparation for Quarter 2", suggested_amount: 150 },
  );

  // 3. Admin performs the final prior-submission record and sends the period-linked charge.
  await admin.request("POST", `/mtd/periods/${q1.id}/record-prior-submission`, {
    previous_provider: "Ledger & Co (UAT)",
    submission_date: "2026-08-01",
    submission_reference: "UAT-Q1-PRIOR-001",
    note: "Evidence checked by admin (UAT fixture).",
  });
  await admin.request("POST", "/payment-requests", {
    case_id: caseId,
    description: "Catch-up preparation — Quarter 2",
    amount: 150,
    mtd_period_id: q2.id,
    recommendation_id: recommendation.id ?? null,
    internal_note: "Disposable UAT charge",
  });
}

async function main(): Promise<void> {
  config();
  guard();
  const password = requireEnv("UAT_PASSWORD");
  const baseUrl = (process.env.BASE_URL ?? "http://localhost:8002").replace(/\/+$/, "");

  await connect();
  await ensureCoreIndexes();
  await ensurePhase1bData();

  for (const person of STAFF) {
    const user = await upsertUser(person, password);
    if (person.role === "ACCOUNTANT") await upsertAccountantProfile(user);
  }

  let q3CaseId: string | null = null;
  for (const person of CLIENTS) {
    const user = await upsertUser(person, password);
    const client = await upsertClientRecord(user);
    for (const serviceType of person.services ?? []) {
      const result = await activateService(client, null, serviceType, PACKAGE[serviceType], {
        reason: "Staging UAT seed",
      });
      if (person.email.startsWith("uat.q3joiner") && serviceType === MTD) {
        q3CaseId = String(result.case?.id ?? "");
      }
    }
  }

  if (!q3CaseId) throw new Error("Q3 joiner MTD case was not created");
  await seedMidYearFixture(baseUrl, password, q3CaseId);

  // eslint-disable-next-line no-console
  console.log("Staging UAT seed complete:");
  for (const person of [...CLIENTS, ...STAFF]) {
    // eslint-disable-next-line no-console
    console.log(`  ${person.role.padEnd(12)} ${person.email}`);
  }
  await close();
}

main().catch(async (e) => {
  // eslint-disable-next-line no-console
  console.error(e);
  await close().catch(() => undefined);
  process.exit(1);
});
