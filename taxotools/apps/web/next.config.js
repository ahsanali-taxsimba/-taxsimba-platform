/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@taxotools/database", "@taxotools/shared", "@taxotools/integrations"],
  experimental: {
    serverActions: {
      bodySizeLimit: "2mb",
    },
  },
};

module.exports = nextConfig;
