/** In-memory session store with isolation and deletion. */

import { randomUUID } from "node:crypto";

export type SessionRecord = {
  session_id: string;
  created_at: Date;
  updated_at: Date;
  history: Array<{ role: string; content: string }>;
  journey_state: Record<string, unknown> | null;
  meta: Record<string, unknown>;
  deleted: boolean;
};

export class SessionStore {
  private readonly sessions = new Map<string, SessionRecord>();

  getOrCreate(sessionId?: string | null): SessionRecord {
    const sid = sessionId || randomUUID();
    const existing = this.sessions.get(sid);
    if (existing && !existing.deleted) return existing;
    const rec: SessionRecord = {
      session_id: sid,
      created_at: new Date(),
      updated_at: new Date(),
      history: [],
      journey_state: null,
      meta: {},
      deleted: false,
    };
    this.sessions.set(sid, rec);
    return rec;
  }

  get(sessionId: string): SessionRecord | null {
    const rec = this.sessions.get(sessionId);
    if (!rec || rec.deleted) return null;
    return rec;
  }

  appendTurn(sessionId: string, role: string, content: string): void {
    const rec = this.sessions.get(sessionId);
    if (!rec || rec.deleted) return;
    rec.history.push({ role, content });
    rec.history = rec.history.slice(-40);
    rec.updated_at = new Date();
  }

  saveJourney(
    sessionId: string,
    journey: Record<string, unknown> | null,
  ): void {
    const rec = this.sessions.get(sessionId);
    if (!rec || rec.deleted) return;
    rec.journey_state = journey;
    rec.updated_at = new Date();
  }

  delete(sessionId: string): boolean {
    const rec = this.sessions.get(sessionId);
    if (!rec) return false;
    rec.deleted = true;
    rec.history = [];
    rec.journey_state = null;
    rec.meta = {};
    rec.updated_at = new Date();
    return true;
  }

  activeCount(): number {
    let n = 0;
    for (const s of this.sessions.values()) {
      if (!s.deleted) n += 1;
    }
    return n;
  }
}

export const sessionStore = new SessionStore();
