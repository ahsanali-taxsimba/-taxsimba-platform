/** Europe/London calendar helpers for the 08:00 daily schedule and tax-year logic. */

export function londonCalendarDate(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function londonParts(now = new Date()): {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
} {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(now);
  const get = (type: string) =>
    Number(parts.find((p) => p.type === type)?.value || "0");
  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour: get("hour") === 24 ? 0 : get("hour"),
    minute: get("minute"),
  };
}

/**
 * Next 08:00 Europe/London as a UTC Date.
 * Respects BST/GMT via the London calendar parts + iterative correction.
 */
export function nextLondonEightAm(now = new Date()): Date {
  const p = londonParts(now);
  const targetLocal = { hour: 8, minute: 0 };

  // Start from "today 08:00" guessed in UTC, then nudge until London parts match.
  let guess = new Date(
    Date.UTC(p.year, p.month - 1, p.day, targetLocal.hour, targetLocal.minute, 0),
  );
  for (let i = 0; i < 8; i += 1) {
    const lp = londonParts(guess);
    const desiredMinutes = targetLocal.hour * 60 + targetLocal.minute;
    const actualMinutes = lp.hour * 60 + lp.minute;
    const delta = desiredMinutes - actualMinutes;
    if (
      delta === 0 &&
      lp.year === p.year &&
      lp.month === p.month &&
      lp.day === p.day
    ) {
      break;
    }
    guess = new Date(guess.getTime() + delta * 60_000);
  }

  if (guess.getTime() <= now.getTime()) {
    // Advance one London calendar day.
    const tomorrow = new Date(guess.getTime() + 24 * 60 * 60_000);
    const tp = londonParts(tomorrow);
    guess = new Date(
      Date.UTC(tp.year, tp.month - 1, tp.day, targetLocal.hour, targetLocal.minute, 0),
    );
    for (let i = 0; i < 8; i += 1) {
      const lp = londonParts(guess);
      const desiredMinutes = targetLocal.hour * 60 + targetLocal.minute;
      const actualMinutes = lp.hour * 60 + lp.minute;
      const delta = desiredMinutes - actualMinutes;
      if (delta === 0) break;
      guess = new Date(guess.getTime() + delta * 60_000);
    }
  }
  return guess;
}

/** UK tax year label containing the London date, e.g. 2025-26. */
export function ukTaxYearForLondonDate(isoDate: string): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  const afterStart = m > 4 || (m === 4 && d >= 6);
  const start = afterStart ? y : y - 1;
  const end = (start + 1) % 100;
  return `${start}-${String(end).padStart(2, "0")}`;
}

export function msUntil(target: Date, now = new Date()): number {
  return Math.max(0, target.getTime() - now.getTime());
}
