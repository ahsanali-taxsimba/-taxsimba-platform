/**
 * Shared test helpers — mirrors backend/tests/conftest.py.
 */
import type { Express } from "express";
import request from "supertest";
import { createApp } from "../src/app.js";
import { createSettings, type Settings } from "../src/config/settings.js";

export type TestSettings = Settings;

export function buildTestSettings(
  overrides: Partial<{
    OPENAI_API_KEY: string;
    CONCIERGE_FORCE_MOCK_LLM: boolean;
    CONCIERGE_CORS_ORIGINS: string;
    CONSULTATION_BOOKING_URL: string;
    WEBSITE_BASE_URL: string;
  }> = {},
): Settings {
  return createSettings({
    OPENAI_API_KEY: "",
    CONCIERGE_FORCE_MOCK_LLM: true,
    CONCIERGE_CORS_ORIGINS: "http://localhost:3000",
    CONSULTATION_BOOKING_URL:
      "https://calendly.com/example/taxsimba-99-consultation",
    WEBSITE_BASE_URL: "https://www.taxsimba.com",
    ...overrides,
  });
}

export function buildTestApp(settings?: Settings): Express {
  return createApp(settings ?? buildTestSettings());
}

export function api(app?: Express) {
  return request(app ?? buildTestApp());
}

export { createApp, createSettings, request };
