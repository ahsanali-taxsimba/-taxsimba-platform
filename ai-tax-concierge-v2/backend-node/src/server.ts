/**
 * SIMBA AI Node server.
 *
 * Dual-run with Python:
 *   - Python (uvicorn): typically PORT 8090
 *   - Node (this file): defaults to PORT||8091 so both can run side-by-side
 *
 * Override with PORT=8090 if Node should take the primary port after cutover.
 */
import "dotenv/config";
import { createApp } from "./app.js";
import { createSettings } from "./config/settings.js";
import { VERSION } from "./version.js";

const settings = createSettings();
const app = createApp(settings);

const port = Number(process.env.PORT || 8091);
const host = process.env.HOST || "127.0.0.1";

app.listen(port, host, () => {
  console.log(
    `SIMBA AI Node listening on http://${host}:${port} (v${VERSION}, llm=${settings.useMockLlm ? "mock" : "openai"})`,
  );
  console.log(
    `Dual-run tip: Python often uses :8090; Node defaults to :8091. Set PORT to override.`,
  );
});
