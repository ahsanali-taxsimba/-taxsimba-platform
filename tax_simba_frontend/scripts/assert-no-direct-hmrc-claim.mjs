import { readdirSync, readFileSync, statSync } from "fs";
import { join } from "path";

const root = new URL("../src", import.meta.url).pathname;
const banned = [/Direct HMRC Submission/i, /direct HMRC API/i];
const hits = [];

function walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p);
    else if (/\.(js|jsx|ts|tsx|mdx)$/.test(name)) {
      const text = readFileSync(p, "utf8");
      for (const re of banned) {
        if (re.test(text)) hits.push(`${p}: ${re}`);
      }
    }
  }
}
walk(root);
if (hits.length) {
  console.error("Banned HMRC-API claims found:\n" + hits.join("\n"));
  process.exit(1);
}
console.log("assert-no-direct-hmrc-claim: OK");
