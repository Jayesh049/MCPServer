const path = require("path");
// Load repo root .env then frontend/.env.local (NEXT_PUBLIC_* must be visible to Next).
const { loadEnvConfig } = require("@next/env");
loadEnvConfig(path.join(__dirname, ".."));
loadEnvConfig(path.join(__dirname));

const apiBase = (
  process.env.MCP_API_BASE_URL ?? "http://127.0.0.1:3333"
).replace(/\/$/, "");

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  turbopack: { root: __dirname },
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${apiBase}/api/:path*`
      }
    ];
  }
};

module.exports = nextConfig;
