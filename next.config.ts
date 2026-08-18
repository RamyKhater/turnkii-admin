import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // PGlite ships WASM + native-ish bits; keep it out of the bundle.
  serverExternalPackages: ["@electric-sql/pglite"],
};

export default nextConfig;
