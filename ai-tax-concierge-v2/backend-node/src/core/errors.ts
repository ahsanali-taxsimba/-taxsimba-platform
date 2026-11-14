/** Structured application errors. */

export class ConciergeError extends Error {
  readonly code: string;
  readonly statusCode: number;
  readonly details: Record<string, unknown>;

  constructor(
    message: string,
    options: {
      code?: string;
      statusCode?: number;
      details?: Record<string, unknown>;
    } = {},
  ) {
    super(message);
    this.name = "ConciergeError";
    this.message = message;
    this.code = options.code ?? "concierge_error";
    this.statusCode = options.statusCode ?? 500;
    this.details = options.details ?? {};
  }
}

export class ValidationConciergeError extends ConciergeError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, {
      code: "validation_error",
      statusCode: 400,
      details,
    });
    this.name = "ValidationConciergeError";
  }
}

export class LLMUnavailableError extends ConciergeError {
  constructor(message = "AI service temporarily unavailable") {
    super(message, { code: "llm_unavailable", statusCode: 503 });
    this.name = "LLMUnavailableError";
  }
}
