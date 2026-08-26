import { config } from "dotenv";

import { createApp, startup } from "./app";
import { port } from "./config/env";
import { connect } from "./db/mongo";

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
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error(e);
  process.exit(1);
});
