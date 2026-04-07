import type { NextConfig } from "next";
import path from "node:path";

const projectRoot = path.resolve(process.cwd());

const nextConfig: NextConfig = {
  output: "standalone",
  outputFileTracingRoot: projectRoot,
  // Não definir `turbopack.root` igual ao cwd: no Windows isso pode quebrar a resolução
  // de `src/middleware.ts` no dev com Turbopack ("Could not parse module ... file not found").
};

export default nextConfig;
