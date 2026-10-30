import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Lets verification builds use their own folder without touching a running `next dev` (which owns .next/dev).
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
