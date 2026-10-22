import fs from "node:fs";
import path from "node:path";
const root = process.cwd();
const standalone = path.join(root, ".next/standalone");
if (!fs.existsSync(standalone)) process.exit(0);
fs.cpSync(path.join(root, ".next/static"), path.join(standalone, ".next/static"), { recursive: true });
fs.cpSync(path.join(root, "public"), path.join(standalone, "public"), { recursive: true });
console.log("Standalone static and public assets prepared");
