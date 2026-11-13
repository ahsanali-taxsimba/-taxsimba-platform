/** Privacy-aware analytics recorder with reporting aggregates. */

export type AnalyticsEvent = {
  event: string;
  session_id: string;
  payload: Record<string, unknown>;
  created_at: Date;
};

export class AnalyticsRecorder {
  private events: AnalyticsEvent[] = [];

  record(
    event: string,
    sessionId: string,
    payload: Record<string, unknown>,
  ): void {
    this.events.push({
      event,
      session_id: sessionId,
      payload,
      created_at: new Date(),
    });
  }

  all(): AnalyticsEvent[] {
    return [...this.events];
  }

  clear(): void {
    this.events = [];
  }

  summary(): Record<string, unknown> {
    const events = [...this.events];
    const byType: Record<string, number> = {};
    for (const e of events) {
      byType[e.event] = (byType[e.event] || 0) + 1;
    }
    const questions = events
      .filter((e) => e.event === "chat_turn" || e.event === "journey_step")
      .map((e) => String(e.payload.message_redacted || ""));
    const unanswered = events.filter(
      (e) => e.payload.confidence === "low",
    ).length;
    const clicks = events.filter((e) => e.event.endsWith("_click")).length;
    const conversions = events.filter((e) =>
      e.event.endsWith("_conversion_verified"),
    ).length;
    return {
      conversation_volume:
        (byType.chat_turn || 0) + (byType.journey_step || 0),
      event_counts: byType,
      unanswered_or_low_confidence: unanswered,
      action_clicks: clicks,
      verified_conversions: conversions,
      note: "Clicks are not conversions. Only *_conversion_verified events count as completed.",
      sample_redacted_questions: questions.filter(Boolean).slice(0, 10),
      privacy: "Analytics store redacted text only; no raw NI/UTR/email/phone.",
    };
  }
}
