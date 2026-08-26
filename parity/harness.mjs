/**
 * Python-vs-Node parity harness.
 *
 * Replays the same scripted journeys (parity/journeys.mjs) against the frozen Python backend
 * and the Node implementation, each running on its own port against its own disposable
 * database, then compares status codes and normalised response shapes step by step.
 *
 * Usage: node parity/harness.mjs <python-base-url> <node-base-url> [report-path]
 * Never point this at production or the operational database.
 */
import { writeFileSync } from "fs";

import { runJourneys } from "./journeys.mjs";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ISO = /^\d{4}-\d{2}-\d{2}([T ]\d{2}:\d{2}|$)/;
const CASE_REF = /^(SA|MTD|CL)-\d+/;

/** Values that legitimately differ between two independent runs. */
const VOLATILE_KEYS = new Set([
  "id",
  "token",
  "access_token",
  "challenge",
  "csrf_token",
  "expires_at",
  "expires_in",
  "days_left",
  "days_to_deadline",
  "internal_deadline",
  "created_at",
  "updated_at",
  "last_updated",
  "submitted_at",
  "decided_at",
  "approved_at",
  "published_at",
  "activated_at",
  "client_approved_at",
  "draft_saved_at",
  "revealed_at",
  "requested_at",
  "resolved_at",
  "completed_at",
  "reopened_at",
  "read_at",
  "case_ref",
  "client_ref",
  "invite_url",
  "setup_link",
]);

function normalise(value, key = "") {
  if (VOLATILE_KEYS.has(key)) return value === null ? null : "<volatile>";
  if (Array.isArray(value)) return value.map((v) => normalise(v));
  if (value && typeof value === "object") {
    const out = {};
    for (const k of Object.keys(value).sort()) out[k] = normalise(value[k], k);
    return out;
  }
  if (typeof value === "string") {
    if (UUID.test(value)) return "<uuid>";
    if (ISO.test(value)) return "<date>";
    if (CASE_REF.test(value)) return "<ref>";
    // References and ids embedded in free text (activity lines, notification bodies).
    return value
      .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, "<uuid>")
      .replace(/\b(SA|MTD|CL)-\d+/g, "<ref>")
      .replace(/\b\d{4}-\d{2}-\d{2}\b/g, "<date>");
  }
  return value;
}

function diffPaths(a, b, path = "", out = []) {
  const ta = a === null ? "null" : Array.isArray(a) ? "array" : typeof a;
  const tb = b === null ? "null" : Array.isArray(b) ? "array" : typeof b;
  if (ta !== tb) {
    out.push(`${path || "<body>"}: python ${ta} ${JSON.stringify(a)} vs node ${tb} ${JSON.stringify(b)}`);
    return out;
  }
  if (ta === "array") {
    if (a.length !== b.length) {
      out.push(`${path || "<body>"}: python has ${a.length} items, node has ${b.length}`);
    }
    for (let i = 0; i < Math.min(a.length, b.length); i += 1) {
      diffPaths(a[i], b[i], `${path}[${i}]`, out);
    }
    return out;
  }
  if (ta === "object") {
    for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) {
      if (!(key in a)) out.push(`${path}.${key}: missing in python, node ${JSON.stringify(b[key])}`);
      else if (!(key in b)) out.push(`${path}.${key}: missing in node, python ${JSON.stringify(a[key])}`);
      else diffPaths(a[key], b[key], `${path}.${key}`, out);
    }
    return out;
  }
  if (a !== b) out.push(`${path || "<body>"}: python ${JSON.stringify(a)} vs node ${JSON.stringify(b)}`);
  return out;
}

async function record(base, steps) {
  /** actor -> cookie jar, so every role behaves like its own browser session. */
  const jars = new Map();
  return async function call(step, method, path, opts = {}) {
    const jar = jars.get(opts.actor ?? "anonymous") ?? new Map();
    jars.set(opts.actor ?? "anonymous", jar);
    const headers = {
      "Content-Type": "application/json",
      Origin: base,
      Referer: `${base}/`,
      "Sec-Fetch-Site": "same-origin",
      "Sec-Fetch-Mode": "cors",
    };
    if (jar.size) {
      headers.Cookie = [...jar].map(([k, v]) => `${k}=${v}`).join("; ");
      const csrf = jar.get("csrf_token");
      if (csrf) headers["X-CSRF-Token"] = csrf;
    }
    let res;
    let body = null;
    try {
      res = await fetch(`${base}${path}`, {
        method,
        headers,
        body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
      });
      for (const raw of res.headers.getSetCookie?.() ?? []) {
        const [pair] = raw.split(";");
        const idx = pair.indexOf("=");
        if (idx > 0) jar.set(pair.slice(0, idx).trim(), pair.slice(idx + 1).trim());
      }
      const text = await res.text();
      try {
        body = text ? JSON.parse(text) : null;
      } catch {
        body = text.slice(0, 200);
      }
    } catch (e) {
      steps.push({ step, method, path, status: 0, body: { transport_error: String(e) } });
      return { status: 0, body: null };
    }
    steps.push({ step, method, path, status: res.status, body });
    return { status: res.status, body };
  };
}

/** Approved deviations from the frozen Python reference (decision B4). */
const INTENTIONAL = {
  "unscoped document listing":
    "B4 security correction: document reads must be scoped by case, client or period, " +
    "so Node answers 400 instead of returning every document in the database.",
};

async function main() {
  const [pythonBase, nodeBase, reportPath = "parity/PARITY_REPORT.md"] = process.argv.slice(2);
  if (!pythonBase || !nodeBase) {
    console.error("usage: node parity/harness.mjs <python-base-url> <node-base-url> [report]");
    process.exit(2);
  }

  const pySteps = [];
  const nodeSteps = [];
  await runJourneys(await record(pythonBase, pySteps));
  await runJourneys(await record(nodeBase, nodeSteps));
  writeFileSync("parity/python-run.json", JSON.stringify(pySteps, null, 2));
  writeFileSync("parity/node-run.json", JSON.stringify(nodeSteps, null, 2));

  // A backend that refuses everything would otherwise "match" the other one.
  for (const [name, steps] of [
    ["python", pySteps],
    ["node", nodeSteps],
  ]) {
    const authed = steps.filter((s) => s.status === 200).length;
    if (authed < steps.length / 2) {
      console.error(`${name}: only ${authed}/${steps.length} steps succeeded — run is not usable`);
      process.exit(3);
    }
  }

  const rows = [];
  let statusMismatches = 0;
  let shapeMismatches = 0;
  const total = Math.max(pySteps.length, nodeSteps.length);
  for (let i = 0; i < total; i += 1) {
    const p = pySteps[i];
    const n = nodeSteps[i];
    if (!p || !n || p.step !== n.step) {
      rows.push({ step: (p ?? n).step, status: "step sequence diverged", diffs: [] });
      statusMismatches += 1;
      continue;
    }
    const diffs = diffPaths(normalise(p.body), normalise(n.body));
    const statusOk = p.status === n.status;
    const intentional = INTENTIONAL[p.step];
    if (!intentional) {
      if (!statusOk) statusMismatches += 1;
      else if (diffs.length) shapeMismatches += 1;
    }
    rows.push({
      step: p.step,
      method: p.method,
      path: p.path,
      py: p.status,
      node: n.status,
      statusOk,
      diffs,
      intentional,
    });
  }

  const lines = [
    "# Python vs Node parity harness",
    "",
    `Steps compared: **${rows.length}** — status mismatches: **${statusMismatches}**, ` +
      `response-shape mismatches: **${shapeMismatches}**.`,
    "",
    "| # | Step | Endpoint | Python | Node | Result |",
    "| - | ---- | -------- | ------ | ---- | ------ |",
  ];
  rows.forEach((r, i) => {
    const result = r.intentional
      ? "intentional difference"
      : !r.statusOk
        ? "STATUS MISMATCH"
        : r.diffs.length
          ? "shape diff"
          : "match";
    lines.push(
      `| ${i + 1} | ${r.step} | \`${r.method} ${r.path}\` | ${r.py} | ${r.node} | ${result} |`,
    );
  });
  const detailed = rows.filter((r) => !r.statusOk || r.diffs.length);
  if (detailed.length) {
    lines.push("", "## Differences", "");
    for (const r of detailed) {
      lines.push(`### ${r.step} (\`${r.method} ${r.path}\`)`, "");
      if (r.intentional) lines.push(`- **intentional (documented)**: ${r.intentional}`);
      lines.push(`- status: python ${r.py}, node ${r.node}`);
      for (const d of r.diffs.slice(0, 40)) lines.push(`- ${d}`);
      if (r.diffs.length > 40) lines.push(`- …and ${r.diffs.length - 40} more`);
      lines.push("");
    }
  }
  writeFileSync(reportPath, `${lines.join("\n")}\n`);
  console.log(
    `parity: ${rows.length} steps, ${statusMismatches} status mismatches, ` +
      `${shapeMismatches} shape diffs -> ${reportPath}`,
  );
  process.exit(statusMismatches ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
