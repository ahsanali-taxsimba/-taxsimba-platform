#!/usr/bin/env tsx
import { randomUUID } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import request from "supertest";
import { buildLlmAdapter } from "../src/adapters/factory.js";
import { ConversationalEngine } from "../src/ai/conversational_engine.js";
import { createApp } from "../src/app.js";
import { createSettings } from "../src/config/settings.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const OUT = path.join(
  ROOT,
  "docs/verification/simba_v2_final_corrected/evidence",
);

const FORBIDDEN = [
  "owner_decisions",
  "inclusion_item_statuses",
  "approval_matrix",
  "remaining_decisions",
  "proposed_copy",
  "internal_code_note",
  "customer_facing_inclusions",
];

async function main() {
  const settings = createSettings({
    CONCIERGE_FORCE_MOCK_LLM: "true",
    CONCIERGE_ENV: "staging",
  });
  const app = createApp(settings);
  const packages = await request(app).get("/api/v1/catalog/packages");
  const bootstrap = await request(app).get("/api/v1/bootstrap");
  const health = await request(app).get("/api/v1/health");
  const leaks: Array<{ name: string; k: string }> = [];
  for (const [name, body] of [
    ["packages", packages.body],
    ["bootstrap", bootstrap.body],
  ] as const) {
    const blob = JSON.stringify(body);
    for (const k of FORBIDDEN) {
      if (blob.includes(k)) leaks.push({ name, k });
    }
  }

  const engine = new ConversationalEngine({
    llm: buildLlmAdapter(settings),
    settings,
  });
  const sid = randomUUID();
  const turns = [
    "Hi, what Self Assessment packages do you offer?",
    "I am a first-time sole trader with simple income — which package?",
    "Does Simbian Elite include free Xero Grow forever?",
    "Can I get a free accountant callback?",
    "My qualifying income was exactly £50,000 in 2024-25. Do I need MTD from April 2026?",
  ];
  const conversation = [];
  for (const message of turns) {
    const res = await engine.handle({
      session_id: sid,
      message,
      tax_year: "2025-26",
    });
    conversation.push({
      message,
      reply: res.reply,
      packages: (res.packages || []).map((p) => p.code),
    });
  }

  const out = {
    generated_at: new Date().toISOString(),
    health: { status: health.status, body: health.body },
    catalogue_leak_check: { pass: leaks.length === 0, leaks },
    bootstrap_booking: bootstrap.body.consultation,
    bootstrap_integrations: bootstrap.body.integrations,
    packages_sample: {
      sa0: packages.body.self_assessment?.[0],
      mtd0: packages.body.mtd?.[0],
      top_keys: Object.keys(packages.body),
    },
    multiturn: conversation,
  };
  mkdirSync(OUT, { recursive: true });
  writeFileSync(
    path.join(OUT, "catalogue_bootstrap_multiturn_smoke.json"),
    JSON.stringify(out, null, 2),
  );
  console.log(
    JSON.stringify(
      {
        leak_pass: leaks.length === 0,
        health: health.body.status,
        booking: bootstrap.body.consultation,
        turns: conversation.map((t) => ({
          q: t.message.slice(0, 50),
          codes: t.packages,
          preview: t.reply.slice(0, 100),
        })),
      },
      null,
      2,
    ),
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
