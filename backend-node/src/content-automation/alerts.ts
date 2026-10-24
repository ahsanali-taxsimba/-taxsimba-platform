import { alertWebhookUrl } from "./config";
import { listAlerts, recordAlert } from "./store";

export async function emitAlert(input: {
  severity: "info" | "warning" | "critical";
  code: string;
  message: string;
  runId?: string;
  jobId?: string;
}): Promise<void> {
  const row = await recordAlert(input);
  const webhook = alertWebhookUrl();
  if (!webhook) return;
  try {
    await fetch(webhook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: `[TaxSimba content-automation][${row.severity}] ${row.code}: ${row.message}`,
        alert: row,
      }),
    });
  } catch {
    // Webhook failures must not crash the worker.
  }
}

export async function alertMissingScheduler(lastRunAt: string | null, now = new Date()): Promise<void> {
  if (!lastRunAt) {
    await emitAlert({
      severity: "critical",
      code: "missing_scheduler",
      message: "No successful content-automation run has been recorded",
    });
    return;
  }
  const ageMs = now.getTime() - new Date(lastRunAt).getTime();
  if (ageMs > 36 * 60 * 60_000) {
    await emitAlert({
      severity: "critical",
      code: "missing_scheduler",
      message: `Last content-automation run was at ${lastRunAt} (>36h ago)`,
    });
  }
}

export { listAlerts };
