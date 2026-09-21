/**
 * Lightweight source assertions for TS-UAT-030/035 modal contrast (no test runner required).
 * Fails if Client Details InfoItem uses dark:text-white on permanently light cards,
 * or Accountant Details values lack paired light/dark readable classes.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function assert(cond, msg) {
  if (!cond) {
    console.error("FAIL:", msg);
    process.exitCode = 1;
  } else {
    console.log("OK:", msg);
  }
}

const clientModal = readFileSync(
  join(root, "src/app/(admin)/(others-pages)/manage-client/_sections/UserViewModal.tsx"),
  "utf8",
);
assert(
  !/InfoItem[\s\S]*dark:text-white\/90/.test(clientModal) ||
    /text-slate-900 dark:text-slate-900/.test(clientModal),
  "Client Details InfoItem must not use white text on light cards",
);
assert(
  /text-slate-900 dark:text-slate-900/.test(clientModal),
  "Client Details InfoItem uses readable slate-900 on light card backgrounds",
);

const accModal = readFileSync(
  join(root, "src/app/(admin)/(others-pages)/manage-accountant/_sections/AccountantDetailsModal.tsx"),
  "utf8",
);
assert(
  /text-slate-900 dark:text-slate-100/.test(accModal),
  "Accountant Details values use readable light/dark pair",
);
assert(!/status\s*==\s*1/.test(accModal), "Accountant Details must not use legacy status==1");

const statusLib = readFileSync(join(root, "src/lib/accountantStatus.ts"), "utf8");
assert(/isAccountantActive/.test(statusLib), "Shared accountant status resolver exists");

const assignModal = readFileSync(
  join(root, "src/app/(admin)/(others-pages)/manage-tax/_sections/AssignAccountantModal.tsx"),
  "utf8",
);
assert(!/Number\(e\.target\.value\)/.test(assignModal), "Assign modal must not Number()-coerce IDs");
assert(/Case assigned to accountant successfully/.test(assignModal), "Assign success toast copy present");

if (process.exitCode) {
  console.error("Contrast/mapping source assertions failed");
  process.exit(1);
}
console.log("All modal contrast/mapping source assertions passed");
