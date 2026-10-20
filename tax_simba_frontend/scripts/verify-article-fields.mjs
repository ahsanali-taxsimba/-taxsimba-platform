/** Confirms all 82 import records have complete public-ready fields (while remaining drafts). */
import { next82Articles } from "../src/data/articles.next82.js";
import { original38Articles } from "../src/data/articles.js";

const ICON_KEYS = new Set([
  "digital-tax",
  "calendar",
  "pound",
  "home",
  "briefcase",
  "accountant",
  "document-check",
  "hard-hat",
  "tax-guide",
]);

const failures = [];
for (const a of next82Articles) {
  const req = [
    "slug",
    "title",
    "content",
    "metaTitle",
    "metaDescription",
    "category",
    "readingMinutes",
    "iconKey",
    "heroStyle",
    "status",
    "excerpt",
  ];
  for (const k of req) {
    if (a[k] === undefined || a[k] === null || a[k] === "") {
      failures.push(`${a.slug || a.id}: missing ${k}`);
    }
  }
  if (a.status !== "draft") failures.push(`${a.slug}: status=${a.status}`);
  if (a.publishedAt !== null) failures.push(`${a.slug}: publishedAt not null`);
  if (!a.content || a.content.length < 200) failures.push(`${a.slug}: short content`);
  if (!String(a.content).includes("<h2>")) failures.push(`${a.slug}: missing h2`);
  if ((a.metaTitle || "").length > 70) failures.push(`${a.slug}: metaTitle length`);
  if ((a.metaDescription || "").length > 160) {
    failures.push(`${a.slug}: metaDescription length`);
  }
  if (!["Making Tax Digital", "Self Assessment"].includes(a.category)) {
    failures.push(`${a.slug}: category`);
  }
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(a.slug || "")) {
    failures.push(`${a.slug}: slug`);
  }
  if (!(a.readingMinutes >= 2)) failures.push(`${a.slug}: readingMinutes`);
  if (!ICON_KEYS.has(a.iconKey)) failures.push(`${a.slug}: iconKey`);
  if (a.heroStyle !== "compact-icon") failures.push(`${a.slug}: heroStyle`);
}

const overlap = next82Articles.filter((a) =>
  original38Articles.some((b) => b.slug === a.slug),
);
if (next82Articles.length !== 82) failures.push(`count ${next82Articles.length}`);
if (overlap.length) failures.push(`overlap ${overlap.length}`);

if (failures.length) {
  console.error("FAIL:\n- " + failures.slice(0, 40).join("\n- "));
  process.exit(1);
}
console.log(
  "PASS: 82 drafts have complete bodies, SEO title/description, categories, stable slugs, reading times and iconKey illustrations",
);
