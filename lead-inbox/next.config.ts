import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@electric-sql/pglite", "pg"],
  // identity.ts imports ./identity.dev.js (Cursor-generated ESM). Map to the .ts sibling.
  turbopack: {
    resolveAlias: {
      "./identity.dev.js": path.resolve(__dirname, "cursor/identity.dev.ts"),
    },
  },
  webpack: (config) => {
    config.resolve.extensionAlias = {
      ".js": [".ts", ".tsx", ".js", ".jsx"],
    };
    return config;
  },
};

export default nextConfig;
