/**
 * Authoritative client display helpers.
 * Prefer account-details / session firstName — never invent "Client", "MTD User",
 * email prefixes, or fixture placeholders when a real name exists.
 */

function clean(value) {
  if (value == null) return "";
  return String(value).trim();
}

/**
 * Resolve a first name for greetings from account-details and/or session user.
 */
export function resolveClientFirstName(account = {}, sessionUser = {}) {
  const candidates = [
    account.firstName,
    account.first_name,
    sessionUser.firstName,
    sessionUser.first_name,
  ];
  for (const c of candidates) {
    const v = clean(c);
    if (v && !isGenericPlaceholder(v)) return v;
  }

  const full =
    clean(account.name) ||
    clean(sessionUser.name) ||
    [clean(account.firstName), clean(account.lastName || account.surname)]
      .filter(Boolean)
      .join(" ") ||
    [clean(sessionUser.firstName), clean(sessionUser.lastName)]
      .filter(Boolean)
      .join(" ");

  if (!full || isGenericPlaceholder(full)) return "";
  // Prefer the first token of a stored full name.
  return full.split(/\s+/)[0];
}

export function resolveClientDisplayName(account = {}, sessionUser = {}) {
  const fromParts = [
    clean(account.firstName || account.first_name || sessionUser.firstName),
    clean(
      account.lastName ||
        account.last_name ||
        account.surname ||
        sessionUser.lastName,
    ),
  ]
    .filter(Boolean)
    .join(" ");
  if (fromParts && !isGenericPlaceholder(fromParts)) return fromParts;

  const full = clean(account.name) || clean(sessionUser.name);
  if (full && !isGenericPlaceholder(full)) return full;
  return "";
}

export function isGenericPlaceholder(value) {
  const v = clean(value).toLowerCase();
  if (!v) return true;
  return [
    "client",
    "user",
    "mtd user",
    "mtd client",
    "test",
    "fixture",
    "unknown",
    "n/a",
    "na",
  ].includes(v);
}

/** Safe greeting fallback only when the stored name is genuinely absent. */
export function welcomeGreeting(account = {}, sessionUser = {}) {
  const first = resolveClientFirstName(account, sessionUser);
  if (first) return `Welcome, ${first}`;
  return "Welcome";
}

/**
 * Service workspace flags from session (ownership / entitlements / intent).
 * Never use RBAC role === "MTD" — that is not a real role.
 */
export function serviceWorkspaceFlags(session) {
  const user = session?.user || {};
  const ownership = session?.ownership || user.ownership || "neither";
  const hasActiveSa = Boolean(session?.hasActiveSa ?? user.hasActiveSa);
  const hasActiveMtd = Boolean(session?.hasActiveMtd ?? user.hasActiveMtd);
  const onboardingIntent =
    session?.onboardingIntent || user.onboardingIntent || null;
  const pendingMtd =
    !hasActiveSa &&
    !hasActiveMtd &&
    onboardingIntent === "MTD_INCOME_TAX";
  const pendingSa =
    !hasActiveSa &&
    !hasActiveMtd &&
    onboardingIntent === "SELF_ASSESSMENT";
  const isMtdOnly = ownership === "mtd" || (hasActiveMtd && !hasActiveSa);
  const isSaOnly = ownership === "sa" || (hasActiveSa && !hasActiveMtd);
  const isBoth = ownership === "both" || (hasActiveSa && hasActiveMtd);
  return {
    ownership,
    hasActiveSa,
    hasActiveMtd,
    onboardingIntent,
    pendingMtd,
    pendingSa,
    isMtdOnly,
    isSaOnly,
    isBoth,
    /** Show MTD nav home (active MTD or pending MTD). */
    showMtdNav: isMtdOnly || pendingMtd || isBoth,
    /** Show SA nav home (active SA or pending SA). */
    showSaNav: isSaOnly || pendingSa || isBoth,
    /** Primary MTD-only chrome (hide SA-only links). */
    mtdChromeOnly: isMtdOnly || pendingMtd,
  };
}
