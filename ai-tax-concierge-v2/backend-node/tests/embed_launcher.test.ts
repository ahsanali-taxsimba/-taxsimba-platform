import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const WIDGET = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../widget",
);

function read(name: string): string {
  return readFileSync(path.join(WIDGET, name), "utf-8");
}

describe("Ask SIMBA launcher + welcome card + compact chat", () => {
  const embed = read("embed.js");
  const chat = read("chat.html");
  const panelJs = read("js/chat-panel.js");
  const preview = read("preview.html");

  it("premium_two_line_launcher_copy", () => {
    expect(embed).toContain("Ask SIMBA");
    expect(embed).toContain("AI Tax Assistant");
    expect(embed).toContain('class="sl-main"');
    expect(embed).toContain('class="sl-sub"');
  });

  it("welcome_card_exact_copy_and_session_dismiss", () => {
    expect(embed).toContain("✨ Need help with your tax?");
    expect(embed).toContain("Ask SIMBA, your AI Tax Assistant.");
    expect(embed).toContain("Get answers to UK tax questions");
    expect(embed).toContain("Find the right TaxSimba service");
    expect(embed).toContain("Understand deadlines and next steps");
    expect(embed).toContain("simba_welcome_dismissed_v1");
    expect(embed).toContain('aria-label="Close welcome message"');
    expect(embed.toLowerCase()).toContain("background:#fff");
  });

  it("no_unread_badge_or_mascot", () => {
    // Strip comments before scanning for forbidden UI patterns
    const code = embed.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "").toLowerCase();
    expect(code).not.toContain("unread");
    expect(code).not.toContain("badge");
    expect(code).not.toContain("simba-emblem");
    expect(code).not.toContain("lion");
    expect(code).not.toContain("mascot");
    expect(code).not.toContain("cartoon");
  });

  it("opens_compact_chat_not_only_full_workspace", () => {
    expect(embed).toContain("/widget/chat.html");
    expect(chat).toContain("Self Assessment");
    expect(chat).toContain("Making Tax Digital");
    expect(chat).toContain("Choose the right package");
    expect(chat).toContain("Book a £99 accountant consultation");
    expect(chat).toContain("Ask a tax question");
    expect(chat).toContain('id="sp-close"');
    expect(chat).toContain('id="sp-expand"');
    expect(chat).toContain('id="sp-input"');
  });

  it("compact_chat_posts_to_api_and_keeps_session", () => {
    expect(panelJs).toContain("/api/v1/chat");
    expect(panelJs).toContain("simba_embed_session_v1");
    expect(panelJs).toContain("simba_embed_history_v1");
    expect(panelJs).toContain("openWorkspace");
    expect(chat).toContain("Open full workspace");
  });

  it("preview_preserves_taxsimba_offer_layout_signals", () => {
    expect(preview).toContain("£119");
    expect(preview).toContain("TaxSimba");
    expect(preview).toContain("taxsimba-logo.svg");
    expect(preview).toContain("Self Assessment");
    expect(preview).not.toContain("redesign");
  });
});
