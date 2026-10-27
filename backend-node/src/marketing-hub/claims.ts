/**
 * Publication content guards — block unsupported claims before schedule/publish.
 * Does not invent compliance; fails closed on suspicious phrasing.
 */

import type { CampaignFocus, MarketingDraft } from "./types";

export type ClaimIssue = {
  code: string;
  message: string;
  severity: "block";
};

const BLOCK_PATTERNS: Array<{ code: string; re: RegExp; message: string }> = [
  {
    code: "hmrc_endorsement",
    // Positive endorsement only — allow “not HMRC-approved” disclaimers.
    re: /(?<!\bnot\s)\b(hmrc[- ]approved|approved by hmrc|hmrc endorsed|official hmrc partner|government approved|hmrc certified)\b/i,
    message: "Blocked: unsupported HMRC endorsement / approval claim.",
  },
  {
    code: "hmrc_compliance_guarantee",
    re: /\b(guaranteed compliance|100%\s*compliant with hmrc|hmrc guarantee|never be penalised|penalty[- ]free guarantee)\b/i,
    message: "Blocked: unsupported HMRC compliance guarantee.",
  },
  {
    code: "fake_review",
    re: /\b(rated 5 stars? on trustpilot|google rating of|as featured in the times|winner of .* award|thousands of five-star reviews)\b/i,
    message: "Blocked: unverifiable review / award claim.",
  },
  {
    code: "fake_social_proof",
    re: /\b(\d{2,},\d{3}\+?\s+(happy )?customers|join \d+\s*million)\b/i,
    message: "Blocked: unsupported customer-count / social-proof claim.",
  },
  {
    code: "guaranteed_outcome",
    re: /\b(guaranteed (refund|saving|tax cut)|save £\d+|get your tax back guaranteed)\b/i,
    message: "Blocked: unsupported financial outcome promise.",
  },
  {
    code: "unverified_price",
    re: /\b(only £\d+|from just £\d+|£\d+(\.\d{2})?\s*(flat|all[- ]in)|discount \d+%)\b/i,
    message: "Blocked: price or discount claim — verify live checkout, VAT and terms before publishing prices.",
  },
];

export function scanDraftClaims(draft: Pick<MarketingDraft, "title" | "caption" | "copyLong" | "googleAdsDraft" | "landingCta" | "videoScript" | "focus">): ClaimIssue[] {
  const blob = [draft.title, draft.caption, draft.copyLong, draft.googleAdsDraft, draft.landingCta, draft.videoScript]
    .filter(Boolean)
    .join("\n");
  const issues: ClaimIssue[] = [];
  for (const p of BLOCK_PATTERNS) {
    if (p.re.test(blob)) {
      issues.push({ code: p.code, message: p.message, severity: "block" });
    }
  }
  // Keep SA and MTD messaging separate in a single creative.
  if (draft.focus === "SELF_ASSESSMENT") {
    if (/\bmaking tax digital\b/i.test(blob) && /\bself assessment\b/i.test(blob) && /\bsame (package|service|price)\b/i.test(blob)) {
      issues.push({
        code: "sa_mtd_mixed_offer",
        message: "Blocked: do not merge Self Assessment filing and ongoing MTD reporting into one undifferentiated offer.",
        severity: "block",
      });
    }
  }
  return issues;
}

export function assertPublishableCopy(draft: MarketingDraft): void {
  const issues = scanDraftClaims(draft);
  if (issues.length) {
    throw new Error(issues.map((i) => i.message).join(" "));
  }
}

export function focusLabel(focus: CampaignFocus): string {
  if (focus === "SELF_ASSESSMENT") return "Self Assessment (annual filing)";
  if (focus === "MTD") return "Making Tax Digital (ongoing reporting)";
  return "General UK tax guidance";
}
