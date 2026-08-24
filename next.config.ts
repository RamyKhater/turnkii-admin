import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // PGlite ships WASM + native-ish bits; sharp ships native binaries — keep
  // both out of the bundle so their platform binaries resolve at runtime.
  serverExternalPackages: ["@electric-sql/pglite", "sharp"],
};

export default nextConfig;
