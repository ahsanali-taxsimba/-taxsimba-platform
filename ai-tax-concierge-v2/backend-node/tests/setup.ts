/**
 * Vitest global setup — always force mock LLM (no network).
 * Mirrors backend/tests/conftest.py env behaviour.
 */
process.env.CONCIERGE_FORCE_MOCK_LLM = "true";
process.env.OPENAI_API_KEY = "";
process.env.CONCIERGE_CORS_ORIGINS =
  process.env.CONCIERGE_CORS_ORIGINS || "http://localhost:3000";
process.env.CONSULTATION_BOOKING_URL =
  process.env.CONSULTATION_BOOKING_URL ||
  "https://calendly.com/example/taxsimba-99-consultation";
process.env.WEBSITE_BASE_URL =
  process.env.WEBSITE_BASE_URL || "https://www.taxsimba.com";
