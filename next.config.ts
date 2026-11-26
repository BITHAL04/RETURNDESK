import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Every screen reads live request data from PostgreSQL, so pages render
  // dynamically per request instead of using Cache Components.
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
