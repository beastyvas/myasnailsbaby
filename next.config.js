/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: { ignoreDuringBuilds: true },
  async headers() {
    return [
      {
        source: '/dashboard',
        headers: [{ key: 'Cache-Control', value: 'no-store' }],
      },
      {
        source: '/dashboard/:path*',
        headers: [{ key: 'Cache-Control', value: 'no-store' }],
      },
    ];
  },
};
module.exports = nextConfig;
