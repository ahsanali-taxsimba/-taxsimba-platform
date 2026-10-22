import fs from "node:fs";
import path from "node:path";

const target = path.resolve(process.cwd(), ".env.production.local");
const existing = fs.existsSync(target) ? fs.readFileSync(target, "utf8") : "";
const match = existing.match(/(?:^|\n)TAXSIMBA_EDITORIAL_PUBLISHED_AT=(.+)/);
const publishedAt = process.env.TAXSIMBA_EDITORIAL_PUBLISHED_AT || match?.[1]?.trim() || new Date().toISOString();
if (Number.isNaN(Date.parse(publishedAt)) || Date.parse(publishedAt) > Date.now()) {
  throw new Error("TAXSIMBA_EDITORIAL_PUBLISHED_AT must be a valid first-publication timestamp at or before deployment.");
}
const keep = existing.split(/\r?\n/).filter((line) => line && !/^(?:NEXT_PUBLIC_)?TAXSIMBA_(?:PUBLISH_EDITORIAL_DRAFTS|EDITORIAL_PUBLISHED_AT)=/.test(line));
keep.push(
  "TAXSIMBA_PUBLISH_EDITORIAL_DRAFTS=true",
  `TAXSIMBA_EDITORIAL_PUBLISHED_AT=${publishedAt}`,
  "NEXT_PUBLIC_TAXSIMBA_PUBLISH_EDITORIAL_DRAFTS=true",
  `NEXT_PUBLIC_TAXSIMBA_EDITORIAL_PUBLISHED_AT=${publishedAt}`,
  "",
);
fs.writeFileSync(target, keep.join("\n"));
console.log(`Premium 120 release prepared at ${publishedAt}`);
