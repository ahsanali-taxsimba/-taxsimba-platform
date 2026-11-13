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

const MARKERS: [string, string][] = [
  ["index.html", 'aria-label="SIMBA AI'],
  ["index.html", "aria-live"],
  ["index.html", "Delete chat"],
  ["index.html", "taxsimba-logo.svg"],
  ["index.html", "ts-topics-btn"],
  ["index.html", "ts-sidebar"],
  ["index.html", "Chat with SIMBA"],
  ["index.html", "Guided Help"],
  ["index.html", "Accountant-led service"],
  ["css/concierge.css", "focus-visible"],
  ["css/concierge.css", ".ts-sidebar"],
  ["css/concierge.css", ".ts-workspace"],
  ["css/concierge.css", "#006b3c"],
  ["css/concierge.css", "#078a4b"],
  ["css/concierge.css", "#004d2c"],
  ["css/concierge.css", "Manrope"],
  ["css/concierge.css", "Public Sans"],
  ["css/concierge.css", ".ts-topics"],
  ["js/concierge.js", "Preparing a reply"],
  ["js/concierge.js", "Self Assessment"],
  ["js/concierge.js", "Making Tax Digital"],
  ["js/concierge.js", "Landlords"],
  ["js/concierge.js", "Freelancers & CIS"],
  ["js/concierge.js", "Tax Calculators"],
  ["js/concierge.js", "enterChatView"],
  ["embed.js", "focus-visible"],
  ["embed.js", "Ask SIMBA"],
  ["embed.js", "Escape"],
  ["preview.html", "SIMBA AI"],
  ["assets/taxsimba-logo.svg", "<svg"],
];

describe("widget accessibility + Emerald Signature", () => {
  it.each(MARKERS)("%s contains %s", (file, needle) => {
    expect(read(file).toLowerCase()).toContain(needle.toLowerCase());
  });

  it("emerald_signature_tokens", () => {
    const css = read("css/concierge.css").toLowerCase();
    expect(css).toContain("--ts-primary: #006b3c");
    expect(css).toContain("--ts-primary-action: #078a4b");
    expect(css).toContain("--ts-emerald-deep: #004d2c");
    expect(css).not.toContain("#c6a75e");
    expect(css).not.toContain("--simba-emerald");
    expect(css).not.toContain("@keyframes");
  });

  it("no_mascot_in_primary_ui", () => {
    const html = read("index.html").toLowerCase();
    const embed = read("embed.js").toLowerCase();
    expect(html).not.toContain("simba-emblem.svg");
    expect(embed).not.toContain("simba-emblem.svg");
    expect(read("css/concierge.css").toLowerCase()).not.toContain("lion");
  });
});
