import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // This repo maintains its own CLAUDE.md by hand; don't let next dev
  // overwrite it with an auto-generated AGENTS.md/CLAUDE.md stub on every run.
  agentRules: false,
};

export default nextConfig;
