/**
 * Engagement Letter — replaces the former “Client Care Letter” step.
 *
 * Legal wording below is frozen. Only merge placeholders may vary, and those are
 * populated exclusively from system data (client profile, purchased services,
 * subscription/agreed price). Staff cannot edit the body via the API.
 *
 * TODO(legal): Counsel should confirm firm signatory / terms-of-business clause
 * references and multi-service schedule numbering before production go-live.
 */
import { createHash, randomUUID } from "crypto";

import { col, Doc } from "../db/mongo";
import { nowIso } from "./workflow";

// ---------------------------------------------------------------------------
// Collections / status
// ---------------------------------------------------------------------------

export const ENGAGEMENT_COLLECTIONS = {
  letters: "engagement_letters",
  schedules: "engagement_schedules",
} as const;

export const ENGAGEMENT_STATUSES = [
  "DRAFT",
  "PENDING_SIGNATURE",
  "SIGNED",
  "ACTIVE",
  "SUPERSEDED",
  "CANCELLED",
] as const;
export type EngagementStatus = (typeof ENGAGEMENT_STATUSES)[number];

/**
 * Prisma-equivalent sketch:
 *
 *   model EngagementLetter {
 *     id                String   @id
 *     clientId          String
 *     clientUserId      String?
 *     ourRef            String
 *     yourRef           String
 *     letterDate        String
 *     engagementStart   String
 *     status            EngagementStatus
 *     bodyHtml          String   // rendered; legal skeleton is code-owned
 *     bodyHash          String   // SHA-256 of rendered body
 *     templateVersion   Int
 *     esignDocumentId   String?
 *     esignRequestId    String?
 *     signedAt          DateTime?
 *     signedName        String?
 *     earlyStart        Boolean
 *     schedules         EngagementSchedule[]
 *   }
 *
 *   model EngagementSchedule {
 *     id                 String @id
 *     engagementLetterId String
 *     sortOrder          Int
 *     serviceType        String
 *     serviceLabel       String
 *     packageCode        String?
 *     packageName        String?
 *     price              Float?
 *     billingFrequency   String?
 *     lineText           String  // rendered Schedule N line
 *   }
 */
export interface EngagementLetter {
  id: string;
  client_id: string;
  client_user_id: string | null;
  our_ref: string;
  your_ref: string;
  letter_date: string;
  engagement_start_date: string;
  status: EngagementStatus;
  body_html: string;
  body_hash: string;
  template_version: number;
  esign_document_id: string | null;
  esign_request_id: string | null;
  signed_at: string | null;
  signed_name: string | null;
  signature_type: string | null;
  early_start_instructed: boolean;
  created_at: string;
  updated_at: string;
}

export interface EngagementSchedule {
  id: string;
  engagement_letter_id: string;
  sort_order: number;
  service_type: string;
  service_label: string;
  package_code: string | null;
  package_name: string | null;
  price: number | null;
  billing_frequency: string | null;
  line_text: string;
  created_at: string;
}

/** Frozen template version — bump only when legal wording itself changes. */
export const ENGAGEMENT_TEMPLATE_VERSION = 2;

/**
 * Firm-facing details for Taxsimba Group Ltd. Overridable via env for staging;
 * not editable by staff in the product UI.
 *
 * TODO(white-label): load from esign_firm_branding / firm settings per multi-firm tenant.
 */
export function firmDefaults(): {
  primary_contact: string;
  signatory: string;
  firm_name: string;
  tel: string;
  email: string;
  our_ref_prefix: string;
} {
  return {
    primary_contact:
      process.env.ENGAGEMENT_PRIMARY_CONTACT || "Your assigned Taxsimba accountant",
    signatory: process.env.ENGAGEMENT_SIGNATORY || "Authorised Signatory",
    firm_name: process.env.ENGAGEMENT_FIRM_NAME || "Taxsimba Group Ltd",
    tel: process.env.ENGAGEMENT_FIRM_TEL || "",
    email: process.env.ENGAGEMENT_FIRM_EMAIL || "admin@taxsimba.co.uk",
    our_ref_prefix: process.env.ENGAGEMENT_REF_PREFIX || "TS/EL",
  };
}

/**
 * Canonical schedule labels for purchased services.
 * Tax return clients → Self Assessment schedule with package fee.
 * MTD clients → Making Tax Digital schedule with relevant package fee.
 * TODO(legal): expand VAT / accounts / payroll schedule wording when those services ship.
 */
export const SERVICE_SCHEDULE_LABELS: Record<string, string> = {
  SELF_ASSESSMENT: "Tax return — preparation and submission of your Self Assessment tax return",
  MTD_INCOME_TAX:
    "Making Tax Digital (MTD) for Income Tax — quarterly updates and Final Declaration",
};

export function formatGbp(amount: number | null | undefined): string {
  if (amount == null || Number.isNaN(Number(amount))) return "";
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(
    Number(amount),
  );
}

/** UK long date e.g. "19 October 2026". */
export function formatLetterDate(isoOrDate?: string | Date | null): string {
  const d = isoOrDate ? new Date(isoOrDate) : new Date();
  if (Number.isNaN(d.getTime())) {
    return formatLetterDate(new Date());
  }
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Europe/London",
  });
}

export function parseClientName(rawName: string, titleHint?: string | null): {
  title: string;
  first_name: string;
  middle_names: string;
  last_name: string;
  display_name: string;
  display_name_upper: string;
} {
  let name = String(rawName || "").trim().replace(/\s+/g, " ");
  const titles = ["Mr", "Mrs", "Ms", "Miss", "Dr", "Mx"];
  let title = (titleHint || "").replace(/\./g, "").trim();
  if (!title) {
    for (const t of titles) {
      const re = new RegExp(`^${t}\\.?\\s+`, "i");
      if (re.test(name)) {
        title = t;
        name = name.replace(re, "");
        break;
      }
    }
  }
  if (!title) title = "Mr"; // letter sample uses Mr.; TODO(profile): collect title at onboarding
  const parts = name.split(" ").filter(Boolean);
  const first = parts[0] || "";
  const last = parts.length > 1 ? parts[parts.length - 1] : "";
  const middle = parts.length > 2 ? parts.slice(1, -1).join(" ") : "";
  const core = [first, middle, last].filter(Boolean).join(" ");
  const display = `${title}. ${core}`.replace(/\s+/g, " ").trim();
  const displayUpper = `${title}. ${core.toUpperCase()}`.replace(/\s+/g, " ").trim();
  return {
    title,
    first_name: first,
    middle_names: middle,
    last_name: last,
    display_name: display,
    display_name_upper: displayUpper,
  };
}

export function parseAddressLines(address: string | null | undefined): {
  line1: string;
  line2: string;
  line3: string;
  postcode: string;
  block: string;
} {
  const raw = String(address || "").trim();
  if (!raw) {
    return {
      line1: "",
      line2: "",
      line3: "",
      postcode: "",
      block: "[Address not on file — please update your profile]",
    };
  }
  const lines = raw
    .split(/[\n,]+/)
    .map((l) => l.trim())
    .filter(Boolean);
  const postcodeRe = /^[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}$/i;
  let postcode = "";
  const rest = [...lines];
  if (rest.length && postcodeRe.test(rest[rest.length - 1])) {
    postcode = rest.pop()!.toUpperCase().replace(/\s+/, " ");
  }
  return {
    line1: rest[0] || "",
    line2: rest[1] || "",
    line3: rest[2] || "",
    postcode,
    block: [...rest, postcode].filter(Boolean).join("\n"),
  };
}

export function buildOurRef(clientRef: string | null | undefined): string {
  const firm = firmDefaults();
  const digits = String(clientRef || "")
    .replace(/\D/g, "")
    .padStart(4, "0")
    .slice(-4);
  return `${firm.our_ref_prefix}-${digits || "0000"}`;
}

export function buildScheduleLine(params: {
  sort_order: number;
  service_type: string;
  package_name?: string | null;
  price?: number | null;
  billing_frequency?: string | null;
}): string {
  const label =
    SERVICE_SCHEDULE_LABELS[params.service_type] ||
    params.service_type.replace(/_/g, " ");
  const price = formatGbp(params.price);
  const pkg = (params.package_name || "").trim();
  const freq = (params.billing_frequency || "").trim();

  let feeNote = "";
  if (params.service_type === "SELF_ASSESSMENT") {
    // Tax return clients — package fee for the selected tax return package.
    const bits = [
      price ? `Package fee: ${price}` : "Package fee: as per your selected tax return package",
      pkg ? `Package: ${pkg}` : null,
      freq || null,
    ].filter(Boolean);
    feeNote = bits.join(" · ");
  } else if (params.service_type === "MTD_INCOME_TAX") {
    // MTD clients — relevant MTD package fee.
    const bits = [
      price ? `Package fee: ${price}` : "Package fee: as per your selected MTD package",
      pkg ? `Package: ${pkg}` : null,
      freq || null,
    ].filter(Boolean);
    feeNote = bits.join(" · ");
  } else {
    feeNote = [pkg, price ? `Package fee: ${price}` : null, freq].filter(Boolean).join(" · ");
  }
  return `Schedule ${params.sort_order}\t${label}${feeNote ? `   - ${feeNote}` : ""}`;
}

/**
 * Frozen legal skeleton. Placeholders are the ONLY variable regions.
 * Do not alter surrounding prose without a legal review + template_version bump.
 */
export const ENGAGEMENT_LETTER_LEGAL_TEMPLATE = `{{client_display_name}}
{{address_block}}
         
    Your Ref:   {{your_ref}}
    Our Ref:    {{our_ref}}
    Date:   {{letter_date}}

Dear {{dear_name}}
Terms of Engagement
Thank you for appointing Taxsimba Group Ltd as your tax advisers. This letter, along with the attached service schedules and our standard terms of business, outlines the scope of our services and clearly sets out both your responsibilities and ours.
{{primary_contact}} will act as the primary point of contact and will be responsible for overseeing all aspects of this engagement.
We adhere to recognised professional ethical standards for UK tax advisers and accept your instructions on the understanding that all our services will be delivered in accordance with those standards and applicable UK tax law.
1.  SCOPE OF SERVICES
1.1.    We have listed below the work which you have instructed us to carry out, the detail of which is contained in the attached schedules. These state your and our responsibilities in relation to the work to be carried out. Only the services which are listed in the attached schedules are included within the scope of our instructions. If there are other services that you wish us to carry out which are not listed in the schedules, please let us know and we will discuss with you whether they can be included in the scope of our work. If we agree to carry out additional services for you, we will provide you with a new or amended engagement letter and schedules.
1.2     For Self Assessment (tax return) clients, the scope is preparation and submission of your tax return at the package fee for your selected tax return package. For Making Tax Digital (MTD) clients, the scope is MTD for Income Tax quarterly updates and the Final Declaration at the package fee for your selected MTD package. Fees are as shown in the schedule(s) below and match the package you purchased on the Taxsimba platform.
1.3 The following schedule[s] of services and our terms of business are attached to this engagement letter and should be read in conjunction with it. 
        
{{schedules_block}}
    

2.  LIMITATION OF LIABILITY
2.1.    We will provide services as outlined in this letter with reasonable care and skill. Our liability to you is limited to losses, damages, costs and expenses caused by our         negligence or wilful default. However, to the fullest extent permitted by law, we will not be responsible for any losses, penalties, surcharges, interest or additional tax       liabilities if you or others supply incorrect or incomplete information or fail to supply any appropriate information or if you fail to act on our advice or respond promptly to communications from us or the tax authorities.
2.2.    You will not hold us responsible, to the fullest extent permitted by law, for any loss suffered by you arising from any misrepresentation (intentional or unintentional)       supplied to us orally or in writing in connection with this agreement. You have agreed that you will not bring any claim in connection with services we provide to you against any of our partners or employees personally.
2.3.    Unless there is a legal or regulatory requirement to do so, our work is not to be made available to third parties without our written permission and we will accept no         responsibility to third parties for any aspect of our professional services or work that is made available to them.
3.  COMMUNICATION

3.1.    We will contact you in relation to your tax affairs. You may also reach Taxsimba Group Ltd at {{firm_email}}.
4.  AGREEMENT OF TERMS

4.1.    Data Protection

4.1.1.  We are committed to ensuring the protection of the privacy and security of any       personal data which we process. Your attention is drawn to clause [7] of the attached terms of business which details how we treat personal data received by us in the       provision of our services during our engagement with you. By signing this letter, you confirm that you have read and understood clause [7] and any privacy notice referred to therein.

4.2.    Engagement Period
4.2.1.  This engagement will start {{engagement_start_date}}.
4.2.2.  This letter supersedes any previous engagement letter for the period covered. Once agreed, this letter will remain effective from the date of signature until it is replaced. You or we may agree to vary or terminate our authority to act on your behalf at any time without penalty. Notice of variation or termination must be given in writing.
Confirmation of Agreement
4.2.3.  This letter, together with the attached schedules, constitutes the entire contract        between us and any proposed variations or termination must be given in writing.
4.2.4.  The terms set out in this letter shall take effect immediately upon your countersigning this letter and returning it to us. If we are instructed to start work before receiving a signed copy of this letter we will treat that as acceptance of all the terms of this       engagement letter, unless we hear from you to the contrary within 14 days of you      giving that instruction. You or we may agree to vary or terminate our authority to act on your behalf at any time without penalty.

4.2.5.  Please confirm your agreement to the terms of this letter and the attached terms of business by signing and returning the appointment acceptance below, together with a copy of this letter. If this letter and the attached terms of business are not in  accordance with your understanding of our terms of appointment, please let us know. 
5.  YOUR RIGHT TO CANCEL

5.1.    Right to Cancel

5.1.1.  You have the right to cancel within 14 days without giving any reason. The            cancellation period will expire after 14 days from the date you enter into the contract.

5.1.2.  To exercise your right to cancel, you must inform us of your decision to cancel this contract by a clear statement (eg, a letter sent by post, fax or email to {{firm_email}}).

5.1.3.  To meet the cancellation deadline, it is sufficient for you to send your communication before the cancellation period expires.
Effect of Cancellation
If you cancel this contract, we will reimburse you for all payments received from you. We will make the reimbursement without undue delay, and not later than 14 days from the day on which we are informed about your decision to cancel the engagement. We will make the reimbursement using the same means of payment as you used for the initial transaction, unless you have expressly agreed otherwise; in any event, you will not incur any fees as a result of the reimbursement. 
Start of Services
5.1.4.  We will not begin work on the attached schedules[s] of services before the expiry of the cancellation period unless you specifically instruct us to do so. You may do this by ticking the box below your signature.
5.1.5.  If, during the cancellation period, you asked us in writing to begin the performance of our services and then cancelled, you will pay us a proportional amount for our        services performed up to the date of your cancellation, compared with the total amount for the whole assignment.

Yours sincerely
{{firm_signatory}}
For and on behalf of {{firm_name}}
Email: {{firm_email}}{{firm_tel_line}}
APPOINTMENT ACCEPTANCE 
I acknowledge receipt of your engagement letter from Taxsimba Group Ltd, a copy of which is attached, and we agree to the letter and the attached schedules of services which, together with the terms of business, fully record the agreement between us concerning your appointment to carry out the work described in the schedules.

Name    {{acceptance_name}}
Signed ...................................................      Date ......................


{{early_start_marker}}   I hereby instruct you to begin providing the attached schedules of services before the expiry of the cancellation period
`;

export function renderEngagementBody(fields: Record<string, string>): string {
  return ENGAGEMENT_LETTER_LEGAL_TEMPLATE.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_m, key) =>
    fields[key] != null ? String(fields[key]) : "",
  );
}

export function hashBody(body: string): string {
  return createHash("sha256").update(body).digest("hex");
}

/** Escape for safe HTML pre-wrap display (legal text stays plain). */
export function bodyToHtml(plain: string): string {
  const esc = plain
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return `<div class="engagement-letter" style="font-family:Georgia,'Times New Roman',serif;white-space:pre-wrap;line-height:1.45;color:#1B2A22">${esc}</div>`;
}

export async function ensureEngagementIndexes(): Promise<void> {
  const specs: [string, Doc, Doc?][] = [
    [ENGAGEMENT_COLLECTIONS.letters, { client_id: 1, status: 1 }],
    [ENGAGEMENT_COLLECTIONS.letters, { client_user_id: 1 }],
    [ENGAGEMENT_COLLECTIONS.letters, { our_ref: 1 }],
    [ENGAGEMENT_COLLECTIONS.schedules, { engagement_letter_id: 1, sort_order: 1 }],
  ];
  for (const [name, keys, opts] of specs) {
    try {
      await col(name).createIndex(keys, opts);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn(`engagement index ${name} skipped: ${String(e)}`);
    }
  }
}

/** New letter id helper kept next to the model for tests. */
export function newEngagementId(): string {
  return randomUUID();
}

export { nowIso };
