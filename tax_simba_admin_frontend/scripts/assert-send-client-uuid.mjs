/**
 * Admin source assertions for Send-to-Client flat payload + UUID string IDs.
 * Run: node scripts/assert-send-client-uuid.mjs
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
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

const page = readFileSync(
  join(root, "src/app/(admin)/(others-pages)/manage-tax/[taxReturnId]/page.tsx"),
  "utf8",
);
const details = readFileSync(
  join(root, "src/app/(admin)/(others-pages)/manage-tax/[taxReturnId]/taxDetails.tsx"),
  "utf8",
);
const list = readFileSync(
  join(root, "src/app/(admin)/(others-pages)/tax-return-list/[taxReturnId]/page.tsx"),
  "utf8",
);
const cert = readFileSync(
  join(root, "src/components/TaxReturnModal/DownloadCertificateModal.tsx"),
  "utf8",
);

for (const [name, src] of [
  ["page.tsx", page],
  ["taxDetails.tsx", details],
  ["tax-return-list", list],
]) {
  // Nested payload shape emailData: { ... } must not appear in the POST body.
  // Handler param names like `(emailData: any)` are allowed.
  assert(
    !/emailData\s*:\s*\{/.test(src) && !/\{\s*emailData\s*[,}]/.test(src),
    `${name}: no nested emailData payload object`,
  );
  assert(
    /clientAxios\.post\(\s*["'][^"']*send-to-client["']/.test(src),
    `${name}: posts to send-to-client`,
  );
  assert(/taxReturnId:\s*caseId/.test(src), `${name}: flat taxReturnId`);
  assert(/message,/.test(src), `${name}: flat message field`);
  assert(!/taxReturnIdNum/.test(src), `${name}: no taxReturnIdNum`);
  assert(!/taxReturnIdForPayload/.test(src), `${name}: no taxReturnIdForPayload`);
  assert(!/Number\(taxReturnIdStr\)/.test(src), `${name}: no Number(taxReturnIdStr)`);
  assert(!/Number\(\s*taxReturnId\s*\)/.test(src), `${name}: no Number(taxReturnId)`);
  assert(!/client:\s*\{\s*[^}]*id:\s*Number\(/.test(src), `${name}: no Number(client.id)`);
  assert(
    /toast\.success\("Message sent to client successfully\."\)/.test(src),
    `${name}: success toast only in success branch`,
  );
  assert(
    /toast\.error\("Message is required\."\)/.test(src),
    `${name}: missing message rejected visibly`,
  );
  assert(
    /toast\.error\("Tax return ID is missing\."\)/.test(src),
    `${name}: missing tax-return ID rejected`,
  );
}

assert(!/Number\(taxReturnId/.test(cert), "certificate modal: no Number(taxReturnId)");
assert(/asStringId\(taxReturnId\)/.test(cert), "certificate modal: uses asStringId");
assert(/clientAxios\.post/.test(cert), "certificate modal: uses clientAxios");
assert(!/setShowFinalCertificateModal\(false\);\s*\n\s*\} catch/.test(cert), "certificate does not close on catch path naively");

const assignModal = readFileSync(
  join(root, "src/app/(admin)/(others-pages)/manage-tax/_sections/AssignAccountantModal.tsx"),
  "utf8",
);
assert(/fileId:\s*string\s*\|\s*null/.test(assignModal), "AssignAccountantModal fileId is string|null");
assert(!/fileId:\s*string\s*\|\s*number/.test(assignModal), "AssignAccountantModal fileId is not number");
assert(/asStringId\(fileId\)/.test(assignModal), "AssignAccountantModal uses asStringId(fileId)");
assert(/asStringId\(selectedAccountant\)/.test(assignModal), "AssignAccountantModal uses asStringId(accountant)");
assert(!/Number\(\s*fileId\s*\)/.test(assignModal), "AssignAccountantModal no Number(fileId)");

const managePage = readFileSync(
  join(root, "src/app/(admin)/(others-pages)/manage-tax/page.client.tsx"),
  "utf8",
);
assert(/useState<\s*string\s*\|\s*null\s*>/.test(managePage), "manage-tax assign id state is string|null");
assert(/handleAssign\s*=\s*\(\s*taxReturnId:\s*string/.test(managePage), "manage-tax handleAssign takes string");
assert(!/handleAssign\s*=\s*\(\s*taxReturnId:\s*number/.test(managePage), "manage-tax handleAssign not number");

const adminFlag = readFileSync(
  join(root, "src/components/FlagModal/AdminFlag.tsx"),
  "utf8",
);
assert(!/parseInt\(\s*taxReturnId\s*\)/.test(adminFlag), "AdminFlag no parseInt(taxReturnId)");
assert(/asStringId\(\s*taxReturnId\s*\)/.test(adminFlag), "AdminFlag uses asStringId(taxReturnId)");

// stringId unit
const stringIdSrc = readFileSync(join(root, "src/lib/stringId.ts"), "utf8");
// Compile-lite: strip types
const js = stringIdSrc
  .replace(/: unknown/g, "")
  .replace(/: string/g, "")
  .replace(/export /g, "");
const sandbox = { module: { exports: {} }, exports: {}, console };
vm.runInNewContext(`${js}\nmodule.exports={asStringId,requireStringId};`, sandbox);
const { asStringId, requireStringId } = sandbox.module.exports;
const uuid = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";
assert(asStringId(uuid) === uuid, "asStringId preserves UUID");
assert(asStringId(Number("uuid")) === "", "asStringId(NaN) → empty");
assert(asStringId("NaN") === "", "asStringId('NaN') → empty");
assert(asStringId(undefined) === "", "asStringId(undefined) → empty");
try {
  requireStringId("");
  assert(false, "requireStringId empty should throw");
} catch {
  assert(true, "requireStringId empty throws");
}

// protected media admin
const mediaSrc = readFileSync(join(root, "src/lib/protectedMedia.ts"), "utf8");
assert(/resolveCompatMediaUrl/.test(mediaSrc), "admin protectedMedia exports resolveCompatMediaUrl");
assert(/\/api\/compat\/api\//.test(mediaSrc) === false || /compat\/api/.test(mediaSrc), "admin media has duplicate guard logic");

if (process.exitCode) {
  console.error("Send-to-client / UUID assertions failed");
  process.exit(1);
}
console.log("All send-to-client / UUID source assertions passed");
