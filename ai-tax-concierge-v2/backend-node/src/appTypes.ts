import type { ConversationalEngine } from "./ai/conversational_engine.js";
import type { AnalyticsRecorder } from "./analytics/events.js";
import type { Settings } from "./config/settings.js";
import type { LLMAdapter } from "./adapters/base.js";
import type { SessionStore } from "./sessions/store.js";

export type AppLocals = {
  settings: Settings;
  llm: LLMAdapter;
  stubs: Record<string, unknown>;
  analytics: AnalyticsRecorder;
  sessions: SessionStore;
  engine: ConversationalEngine;
};
