/**
 * The scripted journeys the parity harness replays identically against the Python reference
 * backend and the Node implementation. Every step records the HTTP status and the response
 * body, which the harness normalises and compares side by side.
 *
 * Journeys run as browser-like sessions: each actor has its own cookie jar and sends the
 * double-submit CSRF token, so cookie authentication and CSRF handling are compared too.
 */

const CHECKLIST = {
  client_information_reviewed: true,
  required_documents_reviewed: true,
  income_checked: true,
  allowable_expenses_checked: true,
  tax_calculation_checked: true,
  supporting_documents_attached: true,
  return_ready: true,
};

/**
 * @param {(step: string, method: string, path: string, opts?: object) => Promise<{status:number, body:any}>} call
 */
export async function runJourneys(call) {
  const state = {};

  // ------------------------------------------------------------ auth and role boundaries
  await call("unauthenticated case list", "GET", "/api/cases");
  await call("login with a wrong password", "POST", "/api/auth/login", {
    body: { email: "superadmin@taxsimba.co.uk", password: "definitely-wrong" },
  });
  await call("login with a malformed JSON body", "POST", "/api/auth/login", {
    raw: '{"email": ',
  });
  await call("login with operator-shaped values", "POST", "/api/auth/login", {
    body: { email: { $ne: null }, password: { $ne: null } },
  });

  const logins = {
    superadmin: ["superadmin@taxsimba.co.uk", "Super@123"],
    admin: ["admin@taxsimba.co.uk", "Admin@123"],
    accountant: ["accountant.a@taxsimba.co.uk", "Account@123"],
    demoClient: ["clienta@example.com", "Client@123"],
  };
  for (const [who, [email, password]] of Object.entries(logins)) {
    await call(`login as ${who}`, "POST", "/api/auth/login", {
      actor: who,
      body: { email, password },
    });
  }

  /** Each actor keeps its own cookie jar, exactly like a separate browser session. */
  const as = (who) => ({ actor: who });

  await call("client reads the FAQ list", "GET", "/api/faqs", as("demoClient"));
  await call("client reads FAQ categories", "GET", "/api/faq-categories", as("demoClient"));
  await call("client is refused the user directory", "GET", "/api/users", as("demoClient"));
  await call("client is refused the audit log", "GET", "/api/audit-log", as("demoClient"));
  await call("accountant is refused admin stats", "GET", "/api/stats/admin", as("accountant"));
  await call("admin is refused the super-admin overview", "GET", "/api/overview", as("admin"));
  await call("accountant is refused FAQ authoring", "POST", "/api/faqs", {
    ...as("accountant"),
    body: { category: "Getting Started", question: "Q", answer: "A" },
  });
  await call("admin is refused contact reveal", "POST", "/api/clients/none/reveal-contact", {
    ...as("admin"),
    body: { reason: "parity check" },
  });
  await call("accountant is refused user creation", "POST", "/api/users", {
    ...as("accountant"),
    body: {
      email: "blocked@example.com",
      name: "Blocked",
      role: "CLIENT",
      password: "Str0ng!Passphrase",
    },
  });
  await call("super admin reads the workflow settings", "GET", "/api/workflow/settings", as("superadmin"));
  await call("admin reads accountant workload", "GET", "/api/accountants/workload", as("admin"));
  await call("accountant reads their own stats", "GET", "/api/stats/accountant", as("accountant"));

  // ------------------------------------------------------------ user administration
  const created = await call("super admin creates a client", "POST", "/api/users", {
    ...as("superadmin"),
    body: {
      email: "parity.client@example.com",
      name: "Parity Client",
      role: "CLIENT",
      password: "Str0ng!Passphrase",
      phone: "+44 7700 900555",
    },
  });
  state.clientUserId = created.body?.id;
  await call("duplicate email is refused", "POST", "/api/users", {
    ...as("superadmin"),
    body: {
      email: "parity.client@example.com",
      name: "Parity Client",
      role: "CLIENT",
      password: "Str0ng!Passphrase",
    },
  });
  await call("invalid role is refused", "POST", "/api/users", {
    ...as("superadmin"),
    body: {
      email: "parity.other@example.com",
      name: "Bad Role",
      role: "WIZARD",
      password: "Str0ng!Passphrase",
    },
  });
  await call("new client logs in", "POST", "/api/auth/login", {
    actor: "client",
    body: { email: "parity.client@example.com", password: "Str0ng!Passphrase" },
  });

  await call("admin lists users", "GET", "/api/users?role=CLIENT", as("admin"));
  await call("client reads their own profile", "GET", "/api/my-profile", as("client"));
  await call("client reads their masked UTR", "GET", "/api/my-profile/utr", as("client"));
  await call("client lists their services", "GET", "/api/my-services", as("client"));

  // ------------------------------------------------------------ Self Assessment journey
  const accountantId = (
    await call("admin reads accountant directory", "GET", "/api/users?role=ACCOUNTANT", as("admin"))
  ).body?.find?.((u) => u.email === "accountant.a@taxsimba.co.uk")?.id;
  state.accountantId = accountantId;

  const saCase = await call("admin opens a Self Assessment case", "POST", "/api/cases", {
    ...as("admin"),
    body: { client_user_id: state.clientUserId, tax_year: "2024/25", service_type: "SELF_ASSESSMENT" },
  });
  state.saCase = saCase.body?.id;
  await call("case without a client is refused", "POST", "/api/cases", {
    ...as("admin"),
    body: { tax_year: "2024/25", service_type: "SELF_ASSESSMENT" },
  });
  await call("case for an unknown client is 404", "POST", "/api/cases", {
    ...as("admin"),
    body: { client_user_id: "does-not-exist", tax_year: "2024/25" },
  });
  await call("client reads their case", "GET", `/api/cases/${state.saCase}`, as("client"));
  await call("client approval before review is refused", "POST", `/api/cases/${state.saCase}/client-approve`, as("client"));
  await call("assignment to an unknown accountant is 404", "POST", `/api/cases/${state.saCase}/assign`, {
    ...as("admin"),
    body: { accountant_id: "does-not-exist" },
  });
  await call("admin assigns the case", "POST", `/api/cases/${state.saCase}/assign`, {
    ...as("admin"),
    body: { accountant_id: state.accountantId, priority: "HIGH", internal_instructions: "Parity run" },
  });
  await call("accountant starts the review", "POST", `/api/cases/${state.saCase}/start-review`, as("accountant"));
  await call("accountant requests items from the client", "POST", `/api/cases/${state.saCase}/request-from-client`, {
    ...as("accountant"),
    body: { title: "Bank statements", description: "April to March", document_required: true, mandatory: true },
  });
  const tasks = await call("client sees the open task", "GET", "/api/tasks", as("client"));
  state.taskId = tasks.body?.[0]?.id;
  await call("client completes the task", "POST", `/api/tasks/${state.taskId}/complete`, as("client"));
  const calc = await call("accountant records a calculation", "POST", `/api/cases/${state.saCase}/calculations`, {
    ...as("accountant"),
    body: { total_income: 52000, taxable_income: 39430, tax_due: 7886, is_refund: false, notes: "Parity" },
  });
  state.calcId = calc.body?.id;
  await call("client cannot see an unapproved calculation", "GET", `/api/cases/${state.saCase}/calculations`, as("client"));
  await call("incomplete checklist is refused", "POST", `/api/cases/${state.saCase}/submit-for-admin-review`, {
    ...as("accountant"),
    body: { calculation_version_id: state.calcId, checklist: { income_checked: true } },
  });
  await call("accountant submits for admin review", "POST", `/api/cases/${state.saCase}/submit-for-admin-review`, {
    ...as("accountant"),
    body: { calculation_version_id: state.calcId, checklist: CHECKLIST, admin_note: "Ready" },
  });
  await call("submission before approvals is refused", "POST", `/api/cases/${state.saCase}/record-submission`, {
    ...as("admin"),
    body: { submission_date: "2025-06-01", submission_reference: "HMRC-1" },
  });
  await call("admin returns the work for changes", "POST", `/api/cases/${state.saCase}/admin-return`, {
    ...as("admin"),
    body: { reason: "Recheck the expenses figure", instructions: "Rework the expenses schedule" },
  });
  const calc2 = await call("accountant records a corrected calculation", "POST", `/api/cases/${state.saCase}/calculations`, {
    ...as("accountant"),
    body: { total_income: 52000, taxable_income: 38000, tax_due: 7500, is_refund: false, notes: "Corrected" },
  });
  state.calc2Id = calc2.body?.id;
  await call("accountant resubmits for admin review", "POST", `/api/cases/${state.saCase}/submit-for-admin-review`, {
    ...as("accountant"),
    body: { calculation_version_id: state.calc2Id, checklist: CHECKLIST },
  });
  await call("admin approves the return", "POST", `/api/cases/${state.saCase}/admin-approve`, {
    ...as("admin"),
    body: { note: "Approved for release" },
  });
  await call("client sees the approved calculation", "GET", `/api/cases/${state.saCase}/calculations`, as("client"));
  await call("accountant cannot approve on behalf of the client", "POST", `/api/cases/${state.saCase}/client-approve`, as("accountant"));
  await call("client approves the return", "POST", `/api/cases/${state.saCase}/client-approve`, as("client"));
  await call("admin records the external submission", "POST", `/api/cases/${state.saCase}/record-submission`, {
    ...as("admin"),
    body: { submission_date: "2025-06-01", submission_reference: "HMRC-PARITY-1", provider: "HMRC online" },
  });
  await call("recording the submission again is idempotent", "POST", `/api/cases/${state.saCase}/record-submission`, {
    ...as("admin"),
    body: { submission_date: "2025-06-01", submission_reference: "HMRC-PARITY-1" },
  });
  await call("admin completes the case", "POST", `/api/cases/${state.saCase}/complete`, as("admin"));
  await call("case state after completion", "GET", `/api/cases/${state.saCase}`, as("client"));
  await call("submission record", "GET", `/api/cases/${state.saCase}/submission`, as("client"));
  await call("case activity trail", "GET", `/api/cases/${state.saCase}/activity`, as("admin"));
  await call("case reviews", "GET", `/api/cases/${state.saCase}/reviews`, as("admin"));
  await call("admin reopens the completed case", "POST", `/api/cases/${state.saCase}/reopen`, {
    ...as("admin"),
    body: { reason: "Client sent a late expense" },
  });
  await call("reopen history", "GET", `/api/cases/${state.saCase}/reopen-history`, as("admin"));
  await call("accountant case queue", "GET", "/api/cases", as("accountant"));
  await call("client case list", "GET", "/api/cases", as("client"));

  // ------------------------------------------------------------ MTD journey
  const mtdCase = await call("admin opens an MTD case", "POST", "/api/cases", {
    ...as("admin"),
    body: { client_user_id: state.clientUserId, tax_year: "2024/25", service_type: "MTD_INCOME_TAX" },
  });
  state.mtdCase = mtdCase.body?.id;
  await call("admin assigns the MTD case", "POST", `/api/cases/${state.mtdCase}/assign`, {
    ...as("admin"),
    body: { accountant_id: state.accountantId },
  });
  await call("admin generates the MTD schedule", "POST", `/api/mtd/cases/${state.mtdCase}/generate-periods`, as("admin"));
  const periods = await call("periods for the MTD case", "GET", `/api/mtd/cases/${state.mtdCase}/periods`, as("accountant"));
  const rows = Array.isArray(periods.body) ? periods.body : [];
  state.q1 = rows[0]?.id;
  state.final = rows[rows.length - 1]?.id;
  await call("negative figures are refused", "POST", `/api/mtd/periods/${state.q1}/figures`, {
    ...as("accountant"),
    body: { income: -1, expenses: 0 },
  });
  await call("client cannot enter figures", "POST", `/api/mtd/periods/${state.q1}/figures`, {
    ...as("client"),
    body: { income: 1000, expenses: 100 },
  });
  await call("accountant saves draft figures", "POST", `/api/mtd/periods/${state.q1}/figures`, {
    ...as("accountant"),
    body: { income: 12000, expenses: 3000, client_note: "Q1 estimate" },
  });
  await call("staff preview the client view", "GET", `/api/mtd/periods/${state.q1}/preview`, as("accountant"));
  await call("client cannot preview the draft", "GET", `/api/mtd/periods/${state.q1}/preview`, as("client"));
  await call("accountant submits the quarter for review", "POST", `/api/mtd/periods/${state.q1}/submit-for-review`, as("accountant"));
  await call("client approval before publication is refused", "POST", `/api/mtd/periods/${state.q1}/client-approve`, {
    ...as("client"),
    body: { version: 1 },
  });
  await call("admin returns the quarter for changes", "POST", `/api/mtd/periods/${state.q1}/request-changes`, {
    ...as("admin"),
    body: { reason: "Include the March invoice" },
  });
  await call("accountant saves corrected figures", "POST", `/api/mtd/periods/${state.q1}/figures`, {
    ...as("accountant"),
    body: { income: 12500, expenses: 3000, client_note: "Q1 corrected" },
  });
  await call("accountant resubmits the quarter", "POST", `/api/mtd/periods/${state.q1}/submit-for-review`, as("accountant"));
  await call("admin publishes the quarter", "POST", `/api/mtd/periods/${state.q1}/admin-approve`, as("admin"));
  await call("stale version approval is refused", "POST", `/api/mtd/periods/${state.q1}/client-approve`, {
    ...as("client"),
    body: { version: 99 },
  });
  await call("client approves the quarter", "POST", `/api/mtd/periods/${state.q1}/client-approve`, {
    ...as("client"),
    body: { version: 1 },
  });
  await call("admin reopens the approved quarter", "POST", `/api/mtd/periods/${state.q1}/reopen`, {
    ...as("admin"),
    body: { reason: "Late bank interest" },
  });
  await call("client view of the periods", "GET", `/api/mtd/cases/${state.mtdCase}/periods`, as("client"));
  await call("year summary", "GET", `/api/mtd/cases/${state.mtdCase}/year-summary`, as("admin"));
  await call("MTD oversight buckets", "GET", "/api/mtd/periods", as("admin"));
  await call("MTD stats", "GET", "/api/mtd/stats", as("admin"));
  await call("accountant MTD workload", "GET", "/api/mtd/my-workload", as("accountant"));
  await call("client cannot read MTD oversight", "GET", "/api/mtd/periods", as("client"));
  await call("prior submission recorded for the final declaration", "POST", `/api/mtd/periods/${state.final}/record-prior-submission`, {
    ...as("admin"),
    body: {
      previous_provider: "Former agent",
      submission_date: "2025-01-20",
      submission_reference: "PRIOR-1",
      note: "Recorded from client records",
    },
  });

  // ------------------------------------------------------------ admin, audit and help centre
  await call("admin audit log", "GET", "/api/audit-log?limit=25", as("admin"));
  await call("audit log filtered by case", "GET", `/api/audit-log?case_ref=${saCase.body?.case_ref ?? ""}`, as("admin"));
  await call("client action feed", "GET", "/api/my-actions", as("client"));
  await call("client notifications", "GET", "/api/notifications", as("client"));
  await call("unread notification count", "GET", "/api/notifications/unread-count", as("client"));
  await call("admin stats", "GET", "/api/stats/admin", as("admin"));
  await call("super admin overview", "GET", "/api/overview", as("superadmin"));
  await call("services catalogue", "GET", "/api/services", as("admin"));
  await call("package catalogue", "GET", "/api/packages", as("admin"));
  await call("contact reveal without a reason is refused", "POST", `/api/clients/${state.clientUserId}/reveal-contact`, {
    ...as("superadmin"),
    body: { reason: "" },
  });
  await call("super admin reveals contact details", "POST", `/api/clients/${state.clientUserId}/reveal-contact`, {
    ...as("superadmin"),
    body: { reason: "Parity verification" },
  });
  await call("contact access log", "GET", "/api/contact-access-log", as("superadmin"));

  const faq = await call("admin creates a FAQ", "POST", "/api/faqs", {
    ...as("admin"),
    body: { category: "Getting Started", question: "Parity question?", answer: "Parity answer.", order: 99 },
  });
  await call("FAQ search", "GET", "/api/faqs?q=parity", as("client"));
  await call("admin edits the FAQ", "PATCH", `/api/faqs/${faq.body?.id}`, {
    ...as("admin"),
    body: {
      category: "Getting Started",
      question: "Parity question?",
      answer: "Updated parity answer.",
      order: 99,
    },
  });
  await call("admin deletes the FAQ", "DELETE", `/api/faqs/${faq.body?.id}`, as("admin"));

  // ------------------------------------------------------------ staff invitations
  const invite = await call("super admin invites a staff member", "POST", "/api/staff-invites", {
    ...as("superadmin"),
    body: { email: "parity.staff@taxsimba.co.uk", name: "Parity Staff", role: "ACCOUNTANT" },
  });
  state.inviteToken = String(invite.body?.setup_link ?? "").split("/invite/")[1];
  state.invitedUserId = invite.body?.user?.id;
  await call("admin cannot invite staff", "POST", "/api/staff-invites", {
    ...as("admin"),
    body: { email: "parity.blocked@taxsimba.co.uk", name: "Blocked", role: "ACCOUNTANT" },
  });
  await call("unknown invite token is 404", "GET", "/api/auth/invite/not-a-token");
  await call("invite token is inspectable", "GET", `/api/auth/invite/${state.inviteToken}`);
  await call("weak invite password is refused", "POST", `/api/auth/invite/${state.inviteToken}/accept`, {
    body: { password: "password" },
  });
  await call("invite accepted", "POST", `/api/auth/invite/${state.inviteToken}/accept`, {
    body: { password: "Str0ng!Passphrase" },
  });
  await call("invite cannot be reused", "POST", `/api/auth/invite/${state.inviteToken}/accept`, {
    body: { password: "Str0ng!Passphrase" },
  });
  await call("invited staff can log in", "POST", "/api/auth/login", {
    actor: "invited",
    body: { email: "parity.staff@taxsimba.co.uk", password: "Str0ng!Passphrase" },
  });
  await call("super admin deactivates the invited staff member", "PATCH", `/api/users/${state.invitedUserId}/active?is_active=false`, as("superadmin"));
  await call("deactivated staff cannot log in", "POST", "/api/auth/login", {
    actor: "invited",
    body: { email: "parity.staff@taxsimba.co.uk", password: "Str0ng!Passphrase" },
  });

  // ------------------------------------------------------------ profile and security
  await call("client updates their profile", "PATCH", "/api/my-profile", {
    ...as("client"),
    body: { phone: "+44 7700 900777", address: "1 Parity Way" },
  });
  await call("client requests an email change", "POST", "/api/my-profile/email-change", {
    ...as("client"),
    body: { new_email: "parity.client.new@example.com" },
  });
  await call("client updates notification preferences", "PATCH", "/api/my-preferences", {
    ...as("client"),
    body: { preferences: { accountant_message: false, payment_update: true } },
  });
  await call("client raises a data request", "POST", "/api/my-data-requests", {
    ...as("client"),
    body: { kind: "DATA_EXPORT", reason: "Parity run" },
  });
  await call("client lists data requests", "GET", "/api/my-data-requests", as("client"));
  await call("wrong current password is refused", "POST", "/api/my-profile/change-password", {
    ...as("client"),
    body: { current_password: "not-it", new_password: "An0ther!Passphrase" },
  });
  await call("client raises a service issue", "POST", "/api/service-issues", {
    ...as("client"),
    body: {
      case_id: state.saCase,
      category: "DELAY",
      subject: "Parity issue",
      description: "Raised by the parity harness",
    },
  });
  await call("client lists service issues", "GET", "/api/service-issues", as("client"));
  await call("unscoped document listing", "GET", "/api/documents", as("admin"));
  await call("scoped document listing", "GET", `/api/documents?case_id=${state.saCase}`, as("admin"));
  await call("client document listing", "GET", "/api/documents", as("client"));
  await call("API root", "GET", "/api/");
}
