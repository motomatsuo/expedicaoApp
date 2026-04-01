import type { NextConfig } from "next";
import path from "node:path";

const projectRoot = path.resolve(process.cwd());

const nextConfig: NextConfig = {
  output: "standalone",
  outputFileTracingRoot: projectRoot,
  turbopack: {
    root: projectRoot,
  },
};

export default nextConfig;
