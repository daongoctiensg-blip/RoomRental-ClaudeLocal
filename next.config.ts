import type { NextConfig } from "next";

// Deployed at https://www.tiedohouse.com/phongchothue/ instead of the domain
// root. Set NEXT_PUBLIC_BASE_PATH=/phongchothue in the VPS .env to enable —
// leave it unset for local dev (npm run dev/start still work at "/", no
// code changes needed).
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || undefined;

const nextConfig: NextConfig = {
  basePath,
};

export default nextConfig;
