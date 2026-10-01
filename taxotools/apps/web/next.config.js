/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@taxotools/database", "@taxotools/shared", "@taxotools/integrations"],
  poweredByHeader: false,
  compress: true,
  experimental: {
    serverActions: {
      bodySizeLimit: "2mb",
    },
    optimizePackageImports: ["framer-motion", "@taxotools/shared"],
  },
};

module.exports = nextConfig;
