import { londonCalendarDate, ukTaxYearForLondonDate } from "../london";
import { loadSourceMap } from "../store";

export type CalendarEvent = {
  id: string;
  kind: "tax_year_rollover" | "future_effective_date" | "deadline" | "seasonal_expiry";
  title: string;
  londonDate: string;
  relatedSlugs: string[];
  notes: string;
};

/**
 * Calendar-driven maintenance even when HMRC does not publish a new post.
 * Dates are Europe/London calendar days.
 */
export function calendarEventsFor(now = new Date()): CalendarEvent[] {
  const today = londonCalendarDate(now);
  const [y, m, d] = today.split("-").map(Number);
  const map = loadSourceMap();
  const events: CalendarEvent[] = [];

  // Tax year starts 6 April.
  if (m === 4 && d === 6) {
    const taxYear = ukTaxYearForLondonDate(today);
    events.push({
      id: `tax-year-rollover-${taxYear}`,
      kind: "tax_year_rollover",
      title: `UK tax year ${taxYear} has started`,
      londonDate: today,
      relatedSlugs: map.articles
        .filter((a) => /self assessment|mtd|deadline/i.test(`${a.title} ${a.category}`))
        .map((a) => a.slug)
        .slice(0, 12),
      notes: "Review tax-year labels, deadlines and seasonal wording across related guides.",
    });
  }

  // Self Assessment online filing deadline 31 January.
  if (m === 1 && d === 31) {
    events.push({
      id: `sa-deadline-${y}`,
      kind: "deadline",
      title: "Self Assessment online filing and payment deadline",
      londonDate: today,
      relatedSlugs: map.articles
        .filter((a) => /self-assessment|deadline|penalty|payment/i.test(a.slug))
        .map((a) => a.slug)
        .slice(0, 10),
      notes: "Confirm deadline wording still matches GOV.UK for the just-ended filing season.",
    });
  }

  // MTD April 2026 threshold cohort start reminder window (example maintenance).
  if (m === 4 && d === 1) {
    events.push({
      id: `mtd-threshold-window-${y}`,
      kind: "future_effective_date",
      title: "MTD Income Tax threshold window check",
      londonDate: today,
      relatedSlugs: map.articles
        .filter((a) => /mtd|qualifying-income|threshold/i.test(a.slug))
        .map((a) => a.slug)
        .slice(0, 10),
      notes: "Re-check phased MTD start dates and qualifying-income thresholds on GOV.UK.",
    });
  }

  // Seasonal December coding notice window expiry check.
  if (m === 12 && d === 31) {
    events.push({
      id: `coding-seasonal-${y}`,
      kind: "seasonal_expiry",
      title: "Self Assessment through tax code seasonal wording",
      londonDate: today,
      relatedSlugs: map.articles
        .filter((a) => /tax-code|december|coding/i.test(a.slug))
        .map((a) => a.slug),
      notes: "Expire or refresh seasonal December coding wording for the new calendar year.",
    });
  }

  return events;
}
