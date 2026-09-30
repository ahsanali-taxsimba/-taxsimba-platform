import { expect, test } from "@playwright/test";
import { execFileSync } from "child_process";
import { readFileSync, readdirSync, statSync } from "fs";
import { join } from "path";

/**
 * Local guards that do not require a running Next server.
 * Shared-staging browser journeys use E2E_BASE_URL + auth fixtures (operator script).
 */
test.describe("static release guards", () => {
  test("no Direct HMRC Submission claim in client source", () => {
    execFileSync("node", ["scripts/assert-no-direct-hmrc-claim.mjs"], {
      cwd: process.cwd(),
      stdio: "pipe",
    });
  });

  test("no accessToken console logging in client source", () => {
    const root = join(process.cwd(), "src");
    const hits: string[] = [];
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const p = join(dir, name);
        const st = statSync(p);
        if (st.isDirectory()) walk(p);
        else if (/\.(js|jsx|ts|tsx)$/.test(name)) {
          const text = readFileSync(p, "utf8");
          if (/console\.(log|info|debug|warn)\([^)]*accessToken/.test(text)) {
            hits.push(p);
          }
          if (/console\.(log|info|debug)\([^)]*\btoken\b/.test(text) && /Bearer|jwt|session/i.test(text)) {
            hits.push(p);
          }
        }
      }
    };
    walk(root);
    expect(hits, `token logs found:\n${hits.join("\n")}`).toEqual([]);
  });

  test("canonical SA upload field is file", () => {
    const upload = readFileSync(
      join(process.cwd(), "src/app/dashboard/_components/taxTracker/UploadDocuments.jsx"),
      "utf8",
    );
    expect(upload).toMatch(/formData\.append\(\s*['"]file['"]/);
    expect(upload).not.toMatch(/formData\.append\(\s*['"]documents['"]/);
  });

  test("profile nav points at edit-profile", () => {
    const nav = readFileSync(join(process.cwd(), "src/components/navbar.js"), "utf8");
    expect(nav).toContain("/dashboard/edit-profile");
    expect(nav).not.toMatch(/href=["']\/dashboard\/profile["']/);
  });
});

test.describe("optional live base URL smoke", () => {
  test.skip(!process.env.E2E_BASE_URL, "Set E2E_BASE_URL for live staging smoke");

  test("public legal pages and build-info are reachable", async ({ page, request }) => {
    const base = process.env.E2E_BASE_URL!;
    for (const path of ["/privacy-policy", "/terms-and-conditions", "/contact-us", "/build-info"]) {
      const res = await request.get(new URL(path, base).toString());
      expect(res.status(), path).toBeLessThan(400);
    }
    await page.goto("/privacy-policy");
    await expect(page.locator("body")).toBeVisible();
  });
});
