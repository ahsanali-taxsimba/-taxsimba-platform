/** UK tax year utilities (6 April → 5 April). */

export type DateLike = Date;

function asDate(value?: DateLike | null): Date {
  if (!value) return new Date();
  return value;
}

/** Return label like 2025-26 for the UK tax year containing `on`. */
export function taxYearLabel(on?: DateLike | null): string {
  const d = asDate(on);
  const month = d.getMonth() + 1; // 1-indexed like Python
  const day = d.getDate();
  let start: number;
  if (month > 4 || (month === 4 && day >= 6)) {
    start = d.getFullYear();
  } else {
    start = d.getFullYear() - 1;
  }
  const end = (start + 1) % 100;
  return `${start}-${String(end).padStart(2, "0")}`;
}

/** Inclusive start / end: start 6 Apr, end 5 Apr next year. */
export function taxYearBounds(label: string): [Date, Date] {
  const normalised = label.replace(/\//g, "-");
  const startYear = Number(normalised.split("-")[0]);
  const start = new Date(startYear, 3, 6);
  const end = new Date(startYear + 1, 3, 5);
  return [start, end];
}

export function resolveTaxYear(
  explicit?: string | null,
  on?: DateLike | null,
): string {
  if (explicit) return explicit.replace(/\//g, "-");
  return taxYearLabel(on);
}

export function appliesToYear(factYears: string[], taxYear: string): boolean {
  return factYears.includes(taxYear);
}
