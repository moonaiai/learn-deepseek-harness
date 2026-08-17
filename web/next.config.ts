import type { NextConfig } from "next";

// GitHub Pages serves this project site under /learn-deepseek-harness; the
// deploy workflow sets NEXT_BASE_PATH accordingly. Local dev leaves it unset
// so the app runs at the domain root. `env.NEXT_PUBLIC_BASE_PATH` mirrors the
// same value into the client bundle (only NEXT_PUBLIC_* vars are inlined
// client-side) so `useSearchIndex` can fetch the generated search index from
// the correct path under a non-root basePath.
const basePath = process.env.NEXT_BASE_PATH ?? "";

const nextConfig: NextConfig = {
  output: "export",
  images: { unoptimized: true },
  trailingSlash: true,
  basePath,
  assetPrefix: basePath || undefined,
  env: {
    NEXT_PUBLIC_BASE_PATH: basePath,
  },
};

export default nextConfig;
