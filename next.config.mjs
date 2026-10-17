/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // These packages must stay external so their native / optional binaries are
  // resolved from node_modules at runtime instead of being bundled.
  serverExternalPackages: ['pg', 'sharp', 'discord.js'],
  eslint: { ignoreDuringBuilds: true },
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [{ key: 'Cache-Control', value: 'no-store, max-age=0' }],
      },
    ];
  },
};

export default nextConfig;
