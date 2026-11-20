/**
 * TaxSimba Group operating model — accountant-led services.
 * TaxCalc / Xero are tools TaxSimba’s accountants use; the portal is not a
 * direct HMRC filing integration. Never routinely send prospects to buy
 * third-party software unless they explicitly ask for independent options.
 */

export type ServiceModelAnswer = {
  handled: boolean;
  customer_reply: string;
  confidence: "high" | "medium" | "low";
  topic:
    | "buy_xero"
    | "taxcalc"
    | "portal_filing"
    | "hmrc_software"
    | "independent_software"
    | "taxsimba_filing"
    | "none";
};

function wantsIndependentSoftware(lower: string): boolean {
  return (
    /\b(independent|on my own|without taxsimba|diy|self.?serve)\b/.test(
      lower,
    ) ||
    /\bwhich (other )?software (can|should) i (buy|use)\b/.test(lower) ||
    /\bbuy (my own|xero|taxcalc).{0,40}(myself|separately from taxsimba)\b/.test(
      lower,
    ) ||
    /\brecommend (a |an )?(xero|taxcalc) (subscription|licence|license)\b/.test(
      lower,
    )
  );
}

export function answerTaxsimbaServiceModel(
  message: string,
): ServiceModelAnswer | null {
  const lower = (message || "").toLowerCase();
  if (!lower.trim()) return null;

  const independent = wantsIndependentSoftware(lower);

  // Explicit independent-software request — fair answer, no hard sell.
  if (
    independent &&
    /\b(xero|taxcalc|software|hmrc.?compatible|compatible software)\b/.test(
      lower,
    )
  ) {
    return {
      handled: true,
      topic: "independent_software",
      confidence: "high",
      customer_reply:
        "For independent DIY use, HMRC publishes a list of Making Tax Digital compatible software on GOV.UK, and you can choose a product that fits your situation. " +
        "TaxSimba is an accountant-led service: for customers on Simbian plans, Xero is included in the monthly price for the accountant-led MTD workflow (you do not buy Xero separately through TaxSimba). " +
        "For Self Assessment filing workflows TaxSimba’s accountants use TaxCalc — that is internal to the service, not a product TaxSimba sells you to run alone. " +
        "SIMBA will not invent that TaxSimba is mandatory or HMRC-endorsed. " +
        "If you prefer full accountant-led support instead of DIY software, say whether you need Self Assessment, Making Tax Digital, or both.",
    };
  }

  // Do I need to buy Xero / get Xero separately?
  if (
    /\b(xero)\b/.test(lower) &&
    /\b(buy|purchase|need|get|pay (for|extra)|separately|licence|license|subscription)\b/.test(
      lower,
    )
  ) {
    return {
      handled: true,
      topic: "buy_xero",
      confidence: "high",
      customer_reply:
        "You do not need to buy Xero separately to use TaxSimba’s Making Tax Digital (Simbian) plans. " +
        "Xero is included in the Simbian monthly price for the accountant-led workflow " +
        "(Comply→Xero Simple, Growth→Xero Ignite, Elite→Xero Grow) — there is no separate customer Xero charge on those plans. " +
        "HMRC still requires compatible software and digital records for MTD; TaxSimba’s accountants use the included Xero mapping to deliver that service. " +
        "SIMBA chat does not file to HMRC. " +
        "If you only wanted a DIY Xero subscription outside TaxSimba, say so and I can explain that path fairly — otherwise I can help you check whether Simbian fits.",
    };
  }

  // TaxCalc questions
  if (/\btaxcalc\b/.test(lower)) {
    return {
      handled: true,
      topic: "taxcalc",
      confidence: "high",
      customer_reply:
        "TaxCalc is the software TaxSimba’s accountants use for Self Assessment filing workflows. " +
        "It is part of how TaxSimba delivers accountant-led SA services — not a separate product you are routinely expected to buy and run yourself through SIMBA. " +
        "The TaxSimba portal handles registration, payment, documents and messaging with your assigned accountant; the portal itself is not a direct HMRC filing integration. " +
        "SIMBA will not invent that customers must purchase TaxCalc independently to use TaxSimba. " +
        "If you want Self Assessment support, ask which SA package fits, or email info@taxsimba.co.uk for general service questions.",
    };
  }

  // Portal / direct HMRC filing
  if (
    /\b(portal|taxsimba (app|platform|system))\b/.test(lower) &&
    /\b(file|filing|submit|hmrc|direct(ly)?)\b/.test(lower)
  ) {
    return {
      handled: true,
      topic: "portal_filing",
      confidence: "high",
      customer_reply:
        "The TaxSimba portal supports registration, payment, document collection, customer workflows and messaging with your assigned accountant. " +
        "It is not itself a direct HMRC filing integration. " +
        "Filing and MTD submissions are accountant-led using TaxSimba’s internal tools (TaxCalc for Self Assessment filing workflows; Xero for Making Tax Digital). " +
        "SIMBA chat cannot file or submit to HMRC. " +
        "After signup: create an account, verify email, choose your package, pay, then use the dashboard for onboarding and accountant messaging.",
    };
  }

  if (
    /\b(does|do|can) (taxsimba|the portal|simba|you) (file|submit|send).*(hmrc|return|mtd)|file(s)? directly (to|with) hmrc|direct(ly)? (integrated|integration).*(hmrc|filing)\b/.test(
      lower,
    )
  ) {
    return {
      handled: true,
      topic: "portal_filing",
      confidence: "high",
      customer_reply:
        "No — neither SIMBA chat nor the TaxSimba customer portal is a direct HMRC filing integration. " +
        "TaxSimba provides accountant-led services: accountants use TaxCalc for Self Assessment filing workflows and Xero for Making Tax Digital. " +
        "Your portal is for registration, payment, documents and messaging. " +
        "TaxSimba is not HMRC-endorsed AI and is not mandatory. " +
        "I can explain the obligations and help you choose an approved package when you want accountant-led support.",
    };
  }

  // HMRC-compatible software (TaxSimba-first unless DIY asked)
  if (
    /\b(hmrc.?compatible|compatible software|mtd software|making tax digital software|which software)\b/.test(
      lower,
    )
  ) {
    return {
      handled: true,
      topic: "hmrc_software",
      confidence: "high",
      customer_reply:
        "HMRC requires Making Tax Digital compatible software for in-scope Income Tax digital reporting. " +
        "If you use TaxSimba’s Simbian plans, compatible Xero software is included in the monthly price for the accountant-led MTD service — you are not routinely sent to buy Xero yourself. " +
        "Self Assessment filing workflows at TaxSimba use TaxCalc internally via accountants. " +
        "If you prefer to choose and run software independently, say so and I will point you to HMRC’s public software list without inventing TaxSimba benefits. " +
        "Otherwise tell me your qualifying income and tax year, or whether you want an accountant-led package recommendation.",
    };
  }

  // Does TaxSimba handle filing?
  if (
    /\b(does|do|can) taxsimba (handle|do|manage|prepare|complete).*(filing|file|return|mtd|submission)|taxsimba (handle|handles|file|files|submit|submits)\b/.test(
      lower,
    )
  ) {
    return {
      handled: true,
      topic: "taxsimba_filing",
      confidence: "high",
      customer_reply:
        "TaxSimba provides accountant-led Self Assessment and Making Tax Digital services through its packages — not filing inside this SIMBA chat. " +
        "Accountants use TaxCalc for SA filing workflows and Xero for MTD (Xero included in Simbian monthly prices). " +
        "After you register and pay on the TaxSimba portal, onboarding and document collection happen in the dashboard with your assigned accountant. " +
        "Exact inclusions depend on the approved package; I will not invent extras. " +
        "General support: info@taxsimba.co.uk. Paid Google Meet consultations (£99/20 minutes or £149/40 minutes) are available when you need personalised advice.",
    };
  }

  return null;
}
