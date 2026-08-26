import { config } from "dotenv";

import { createApp, startup } from "./app";
import { port } from "./config/env";
import { connect } from "./db/mongo";
import { remindersEnabled, startReminderWorker } from "./jobs/reminders";

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
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error(e);
  process.exit(1);
});
