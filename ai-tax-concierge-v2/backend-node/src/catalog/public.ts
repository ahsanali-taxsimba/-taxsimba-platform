/**
 * Customer-facing catalogue allowlist.
 * Internal owner-decision metadata must never leave the server via public APIs.
 */

const PACKAGE_PUBLIC_KEYS = [
  "code",
  "name",
  "price_gbp",
  "billing",
  "vat_note",
  "description",
  "inclusions",
  "exclusions",
  "duration_minutes",
  "meeting",
  "registration_path",
  "xero_plan",
] as const;

const CATALOGUE_PUBLIC_TOP_KEYS = [
  "version",
  "self_assessment",
  "mtd",
  "consultation",
] as const;

const FORBIDDEN_PUBLIC_KEY_FRAGMENTS = [
  "owner_decision",
  "approval",
  "requires_clarification",
  "pending",
  "internal",
  "status",
  "doc",
  "matrix",
  "removed_customer",
  "removed_inclusion",
  "inclusion_item",
  "historical_public",
  "description_source",
  "description_note",
  "source_public",
  "legacy_customer",
  "disclaimer",
  "detailed_recommendation",
  "inclusions_catalogue",
  "inclusions_supply",
  "inclusions_resolution",
  "website_reconciliation",
  "proposed_copy",
  "remaining_decision",
  "customer_facing_inclusions",
  "staging_override",
];

const XERO_BY_CODE: Record<string, string> = {
  MTD_STARTER: "Xero Simple",
  MTD_GROWTH: "Xero Ignite",
  MTD_COMPLETE: "Xero Grow",
};

function isForbiddenKey(key: string): boolean {
  const low = key.toLowerCase();
  return FORBIDDEN_PUBLIC_KEY_FRAGMENTS.some((frag) => low.includes(frag));
}

function approvedInclusions(pkg: Record<string, unknown>): string[] | null {
  if (!pkg.customer_facing_inclusions) {
    // Only surface inclusions that are explicitly marked approved in item statuses,
    // otherwise omit (do not invent).
    const statuses = pkg.inclusion_item_statuses as
      | Record<string, string>
      | undefined;
    const inclusions = Array.isArray(pkg.inclusions)
      ? (pkg.inclusions as string[])
      : [];
    if (!statuses || !inclusions.length) return null;
    const approved = inclusions.filter((line) => {
      const st = String(statuses[line] || "").toLowerCase();
      return (
        st === "approved" ||
        st.startsWith("approved_") ||
        st === "approved_verified_from_website" ||
        st === "approved_subject_to_customer_responsibilities" ||
        st === "approved_no_fixed_monthly_transaction_caps"
      );
    });
    // Prefer not to dump mixed clarification lists to customers.
    if (approved.length < inclusions.length) {
      // Still allow clearly approved subset.
      return approved.length ? approved : null;
    }
    return approved;
  }
  return Array.isArray(pkg.inclusions) ? (pkg.inclusions as string[]) : null;
}

function publicPackage(pkg: Record<string, unknown>): Record<string, unknown> {
  const code = String(pkg.code || "");
  const out: Record<string, unknown> = {
    code,
    name: pkg.name,
    price_gbp: pkg.price_gbp,
    billing: pkg.billing,
    vat_note: pkg.vat_note || "",
  };
  if (pkg.description && pkg.description_status === "approved") {
    out.description = pkg.description;
  } else if (
    typeof pkg.description === "string" &&
    (pkg.description_status === "verified_from_website" ||
      pkg.description_status === "approved" ||
      String(pkg.description_status || "").startsWith("verified_from_website"))
  ) {
    // Safe customer description when verified; strip removed-claim notes elsewhere.
    out.description = pkg.description;
  }
  const inclusions = approvedInclusions(pkg);
  if (inclusions?.length) out.inclusions = inclusions;
  if (Array.isArray(pkg.exclusions) && pkg.exclusions_status === "approved") {
    out.exclusions = pkg.exclusions;
  }
  if (pkg.duration_minutes != null) out.duration_minutes = pkg.duration_minutes;
  if (pkg.meeting) out.meeting = pkg.meeting;
  if (XERO_BY_CODE[code]) out.xero_plan = XERO_BY_CODE[code];

  if (pkg.registration_route_id === "sa_packages") {
    out.registration_path = "/self-assessment";
  } else if (pkg.registration_route_id === "mtd_packages") {
    out.registration_path = "/making-tax-digital";
  } else if (pkg.registration_route_id === "register") {
    out.registration_path = "/register";
  }

  // Booking honesty for consultation SKUs
  if (String(pkg.family || "") === "consultation" || code.startsWith("ACCOUNTANT_CONSULT_")) {
    out.booking_available = pkg.booking_status === "live";
    out.booking_note =
      pkg.booking_status === "live"
        ? "Online booking is available: open the matching Calendly event → select availability → pay within Calendly → Google Meet after confirmation."
        : "Online booking (Calendly with integrated payment + Meet) is not connected yet. Email info@taxsimba.co.uk only for enquiries while booking is unavailable — not the default booking path.";
    out.email_enquiry = "info@taxsimba.co.uk";
    out.booking_flow = [
      "Select consultation option",
      "Open matching Calendly event",
      "Pick available appointment",
      "Pay within Calendly booking",
      "Google Meet details after Calendly confirmation",
    ];
  }

  // Final strip of any accidental forbidden keys
  for (const key of Object.keys(out)) {
    if (isForbiddenKey(key) && !PACKAGE_PUBLIC_KEYS.includes(key as any)) {
      if (key !== "booking_available" && key !== "booking_note") {
        delete out[key];
      }
    }
  }
  return out;
}

/** Sanitised catalogue for bootstrap /catalog/packages. */
export function publicPackagesCatalogue(
  raw: Record<string, any>,
): Record<string, unknown> {
  return {
    version: String(raw.version || "unknown"),
    self_assessment: (raw.self_assessment || []).map((p: Record<string, unknown>) =>
      publicPackage(p),
    ),
    mtd: (raw.mtd || []).map((p: Record<string, unknown>) => publicPackage(p)),
    consultations: (Array.isArray(raw.consultation)
      ? raw.consultation
      : raw.consultation
        ? [raw.consultation]
        : []
    ).map((p: Record<string, unknown>) =>
      publicPackage({ ...p, family: "consultation" }),
    ),
    // Backward-compatible single pointer = Quick Tax Advice (£99 / 20 min)
    consultation: publicPackage({
      ...((Array.isArray(raw.consultation)
        ? raw.consultation[0]
        : raw.consultation) || {}),
      family: "consultation",
      code:
        (Array.isArray(raw.consultation)
          ? raw.consultation[0]?.code
          : raw.consultation?.code) || "ACCOUNTANT_CONSULT_99",
    }),
  };
}

export function assertNoInternalCatalogueLeak(payload: unknown): string[] {
  const leaks: string[] = [];
  const walk = (node: unknown, path: string) => {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) {
      node.forEach((n, i) => walk(n, `${path}[${i}]`));
      return;
    }
    for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
      if (isForbiddenKey(k)) leaks.push(`${path}.${k}`);
      walk(v, `${path}.${k}`);
    }
  };
  walk(payload, "$");
  // Top-level allowlist check for catalogue root
  if (payload && typeof payload === "object" && !Array.isArray(payload)) {
    for (const k of Object.keys(payload as object)) {
      if (
        !CATALOGUE_PUBLIC_TOP_KEYS.includes(k as (typeof CATALOGUE_PUBLIC_TOP_KEYS)[number]) &&
        k !== "calculators" &&
        k !== "starters"
      ) {
        // only flag classic internal keys
        if (isForbiddenKey(k)) leaks.push(`$.${k}`);
      }
    }
  }
  return [...new Set(leaks)];
}

/** Strip accidental internal phrases from model replies. */
export function scrubCustomerReply(reply: string): string {
  let out = reply;
  const patterns: Array<[RegExp, string]> = [
    [/internal mapping:\s*[^\n.]+/gi, ""],
    [/owner_decisions?[^\n.]*/gi, ""],
    [/requires_?approval[^\n.]*/gi, ""],
    [/pending_taxsimba[^\n.]*/gi, ""],
    [/inclusion_item_statuses?[^\n.]*/gi, ""],
    [/customer_facing_inclusions[^\n.]*/gi, ""],
    [/MTD_STARTER/g, "Simbian Comply"],
    [/MTD_COMPLETE/g, "Simbian Elite"],
    [/approval_matrix_doc[^\n.]*/gi, ""],
    [/CONCIERGE_[A-Z0-9_]+/g, ""],
  ];
  for (const [re, rep] of patterns) out = out.replace(re, rep);
  return out.replace(/\n{3,}/g, "\n\n").trim();
}
