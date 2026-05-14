const path = require("path");
// Load .env / .env.local before reading MCP_API_BASE_URL (fixes wrong port on `npm start`).
const { loadEnvConfig } = require("@next/env");
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
