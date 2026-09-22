/**
 * Node self-test for protected media URL construction + authenticated retrieval.
 * Run: node scripts/assert-protected-media.mjs
 */
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function assert(cond, msg) {
  if (!cond) {
    console.error("FAIL:", msg);
    process.exitCode = 1;
  } else {
    console.log("OK:", msg);
  }
}

const src = readFileSync(join(root, "src/lib/protectedMedia.js"), "utf8")
  .replace(/^export /gm, "");
const createdUrls = [];
const sandbox = {
  module: { exports: {} },
  exports: {},
  process: { env: { NEXT_PUBLIC_API_URL: "https://api.staging.example/api/compat/" } },
  URL: {
    createObjectURL(blob) {
      const u = `blob:mock-${createdUrls.length}`;
      createdUrls.push({ u, blob });
      return u;
    },
    revokeObjectURL() {},
  },
  fetch: async (url, opts) => {
    sandbox.__lastFetch = { url, opts };
    if (!opts?.headers?.Authorization) {
      return { ok: false, status: 401, blob: async () => ({}) };
    }
    if (String(url).includes("missing")) {
      return { ok: false, status: 404, blob: async () => ({}) };
    }
    return {
      ok: true,
      status: 200,
      blob: async () => ({ type: "image/png", size: 12 }),
    };
  },
  console,
};
vm.runInNewContext(
  `${src}\nmodule.exports = { resolveCompatMediaUrl, isRelativeProtectedMediaPath, fetchProtectedMediaObjectUrl };`,
  sandbox,
);
const {
  resolveCompatMediaUrl,
  isRelativeProtectedMediaPath,
  fetchProtectedMediaObjectUrl,
} = sandbox.module.exports;

const base = "https://api.staging.example/api/compat/";
assert(
  resolveCompatMediaUrl("auth/profile-photo/abc-uuid", base) ===
    "https://api.staging.example/api/compat/auth/profile-photo/abc-uuid",
  "joins relative profile path under /api/compat",
);
assert(
  !resolveCompatMediaUrl("auth/profile-photo/abc", base).includes("/api/compat/api/"),
  "no duplicated /api/compat/api/",
);
assert(
  resolveCompatMediaUrl("api/packages", base) === "https://api.staging.example/api/packages",
  "native /api/* path does not nest under compat",
);
assert(
  resolveCompatMediaUrl("https://cdn.example/x.png", base) === "https://cdn.example/x.png",
  "absolute https left unchanged",
);
assert(isRelativeProtectedMediaPath("auth/profile-photo/1") === true, "relative path detected");
assert(isRelativeProtectedMediaPath("https://x") === false, "absolute not relative");
assert(resolveCompatMediaUrl("", base) === "", "empty path → empty");

const objectUrl = await fetchProtectedMediaObjectUrl(
  "auth/profile-photo/abc-uuid",
  "test-token",
  base,
);
assert(objectUrl === "blob:mock-0", "authenticated fetch returns object URL");
assert(
  sandbox.__lastFetch.url ===
    "https://api.staging.example/api/compat/auth/profile-photo/abc-uuid",
  "fetch hits compat media URL",
);
assert(
  sandbox.__lastFetch.opts.headers.Authorization === "Bearer test-token",
  "Bearer token attached",
);

let missingFailed = false;
try {
  await fetchProtectedMediaObjectUrl("auth/profile-photo/missing", "tok", base);
} catch {
  missingFailed = true;
}
assert(missingFailed, "missing image fetch fails safely");

let noTokenFailed = false;
try {
  await fetchProtectedMediaObjectUrl("auth/profile-photo/abc", "", base);
} catch {
  noTokenFailed = true;
}
assert(noTokenFailed, "missing token rejected");

const dash = readFileSync(join(root, "src/app/dashboard/page.client.js"), "utf8");
assert(dash.includes("ProtectedMediaImage"), "dashboard uses ProtectedMediaImage");
assert(
  !dash.includes("getBackendBaseUrl()}${userData.profilePhoto}"),
  "dashboard does not concat getBackendBaseUrl for profilePhoto",
);

const nav = readFileSync(join(root, "src/components/navbar.js"), "utf8");
assert(nav.includes("ProtectedMediaImage"), "navbar uses ProtectedMediaImage");

const component = readFileSync(
  join(root, "src/components/ProtectedMediaImage.jsx"),
  "utf8",
);
assert(component.includes("revokeObjectURL"), "component revokes object URLs");
assert(component.includes("fallbackSrc"), "component has missing-image fallback");
assert(
  component.includes("fetchProtectedMediaObjectUrl"),
  "component uses authenticated retrieval",
);

assert(
  dash.includes("profilePhoto") && dash.includes("apiImageHandler"),
  "dashboard upload path refreshes profilePhoto state",
);

if (process.exitCode) {
  console.error("Protected media assertions failed");
  process.exit(1);
}
console.log("All protected media URL assertions passed");
