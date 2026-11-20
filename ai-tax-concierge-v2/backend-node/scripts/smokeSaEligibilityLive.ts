import request from "supertest";
import { createApp } from "../src/app.js";
import { createSettings } from "../src/config/settings.js";

async function main() {
  const settings = createSettings({ CONCIERGE_FORCE_MOCK_LLM: false });
  if (settings.useMockLlm) throw new Error("OPENAI_API_KEY missing");
  const app = createApp(settings);
  const session_id = `sa-fix-${Date.now()}`;
  const history: Array<{ role: string; content: string }> = [];
  const turns = [
    "Hi — I just started freelancing this year alongside my job.",
    "My employer pays me under PAYE. Freelance turnover so far is about £8,000 before expenses for 2025-26.",
    "Do I need to register for Self Assessment?",
  ];
  for (const turn of turns) {
    const res = await request(app)
      .post("/api/v1/chat")
      .send({ session_id, message: turn, history });
    console.log("STATUS", res.status, "MODE", res.body.llm_mode);
    console.log("USER:", turn);
    console.log("SIMBA:", String(res.body.reply || "").slice(0, 600));
    console.log("---");
    history.push({ role: "user", content: turn });
    history.push({ role: "assistant", content: String(res.body.reply || "") });
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
