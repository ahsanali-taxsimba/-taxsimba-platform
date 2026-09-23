/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@taxotools/database", "@taxotools/shared"],
  experimental: {
    serverActions: {
      bodySizeLimit: "2mb",
    },
  },
};

module.exports = nextConfig;
