import { config } from "dotenv";

import { createApp, startup } from "./app";
import { port } from "./config/env";
import { connect } from "./db/mongo";
import { remindersEnabled, startReminderWorker } from "./jobs/reminders";
import {
  contentAutomationWorkerEnabled,
  startContentAutomationWorker,
} from "./content-automation/worker";

async function main(): Promise<void> {
  // Environment is read lazily everywhere, so loading .env here is early enough.
  config();
  await connect();
  await startup();
  const app = createApp();
  app.listen(port(), () => {
    // eslint-disable-next-line no-console
    console.log(`TaxSimba Node backend listening on :${port()}`);
  });
  startReminderWorker();
  if (!remindersEnabled()) {
    // eslint-disable-next-line no-console
    console.log("Reminder worker disabled (set REMINDERS_ENABLED=true on one instance)");
  }
  await startContentAutomationWorker();
  if (!contentAutomationWorkerEnabled()) {
    // eslint-disable-next-line no-console
    console.log(
      "HMRC content automation disabled (set CONTENT_AUTOMATION_ENABLED=true for 08:00 Europe/London runs)",
    );
  }
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error(e);
  process.exit(1);
});
