/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  turbopack: { root: __dirname },
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination:
          (process.env.MCP_API_BASE_URL ?? "http://localhost:3333") + "/api/:path*"
      }
    ];
  }
};

module.exports = nextConfig;
