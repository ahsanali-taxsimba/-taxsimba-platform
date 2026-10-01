import { config } from "dotenv";

import { createApp, startup } from "./app";
import { port } from "./config/env";
import { connect } from "./db/mongo";
import { remindersEnabled, startReminderWorker } from "./jobs/reminders";

async function main(): Promise<void> {
  // Environment is read lazily everywhere, so loading .env here is early enough.
  // Cloud Agent / platform shells sometimes inject empty STRIPE_* placeholders;
  // treat blank values as unset so gitignored .env can supply real TEST keys.
  for (const k of ["STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET", "PAYMENT_PROVIDER"]) {
    if (process.env[k] === "") delete process.env[k];
  }
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
