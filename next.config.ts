import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Allow Node.js fs module in server actions / API routes
  serverExternalPackages: [],
};

export default nextConfig;
