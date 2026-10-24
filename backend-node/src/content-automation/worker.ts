/**
 * Daily HMRC content-automation worker.
 *
 * Runs at 08:00 Europe/London (BST/GMT aware). Operates inside the Node backend
 * process — no Cursor, laptop session or ChatGPT UI is required.
 *
 * Configuration (secret NAMES only — set values in DigitalOcean / hosting):
 *   CONTENT_AUTOMATION_ENABLED=true
 *   CONTENT_AUTOMATION_PAUSED=false
 *   CONTENT_AUTOMATION_PUBLIC_BASE_URL
 *   CONTENT_AUTOMATION_GENERATION_API_KEY (optional; fixture mode without it)
 *   CONTENT_AUTOMATION_ALERT_WEBHOOK_URL
 *   MONGO_URL
 */
import { col } from "../db/mongo";
import { alertMissingScheduler, emitAlert } from "./alerts";
import {
  contentAutomationEnabled,
  contentAutomationPaused,
} from "./config";
import { msUntil, nextLondonEightAm } from "./london";
import { runDailyContentAutomation } from "./pipeline/dailyRun";
import { ensureContentAutomationIndexes } from "./store";

let timer: NodeJS.Timeout | null = null;
let watchdog: NodeJS.Timeout | null = null;

export function contentAutomationWorkerEnabled(): boolean {
  return contentAutomationEnabled();
}

export async function startContentAutomationWorker(): Promise<void> {
  await ensureContentAutomationIndexes();
  if (timer) return;

  if (!contentAutomationEnabled()) {
    // eslint-disable-next-line no-console
    console.log(
      "Content automation worker idle (set CONTENT_AUTOMATION_ENABLED=true to schedule 08:00 Europe/London)",
    );
  } else {
    scheduleNext();
    // eslint-disable-next-line no-console
    console.log(
      `Content automation worker armed for next 08:00 Europe/London (${nextLondonEightAm().toISOString()})`,
    );
  }

  // Watchdog: alert if no completed run for >36h while enabled.
  watchdog = setInterval(() => {
    void (async () => {
      if (!contentAutomationEnabled()) return;
      const last = await col("content_automation_runs")
        .find({ status: { $in: ["completed", "partial"] } })
        .sort({ finishedAt: -1 })
        .limit(1)
        .toArray();
      await alertMissingScheduler(last[0]?.finishedAt || last[0]?.startedAt || null);
    })();
  }, 60 * 60_000);
}

function scheduleNext(): void {
  if (timer) clearTimeout(timer);
  const target = nextLondonEightAm();
  const wait = msUntil(target);
  timer = setTimeout(() => {
    void tick();
  }, wait);
}

async function tick(): Promise<void> {
  try {
    if (contentAutomationPaused()) {
      await emitAlert({
        severity: "warning",
        code: "paused_tick",
        message: "08:00 tick ignored because CONTENT_AUTOMATION_PAUSED=true",
      });
    } else if (contentAutomationEnabled()) {
      await runDailyContentAutomation(new Date());
    }
  } catch (e) {
    await emitAlert({
      severity: "critical",
      code: "tick_failure",
      message: String((e as Error).message || e),
    });
  } finally {
    if (contentAutomationEnabled()) scheduleNext();
  }
}

/** Test/staging helper: run one cycle immediately without waiting for 08:00. */
export async function runContentAutomationNow(): Promise<unknown> {
  return runDailyContentAutomation(new Date(), { ignoreEnabledFlag: true });
}

export function stopContentAutomationWorker(): void {
  if (timer) clearTimeout(timer);
  timer = null;
  if (watchdog) clearInterval(watchdog);
  watchdog = null;
}
