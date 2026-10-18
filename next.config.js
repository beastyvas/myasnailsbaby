/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: { ignoreDuringBuilds: true },
  async headers() {
    // Never in search results. Sent as a header as well as the page's meta
    // tag, so it holds even for a response that isn't the rendered page
    // (a redirect, an error). robots.txt must NOT block these, or Google
    // can't read this and may list the URL anyway.
    const noindex = [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }];
    const PRIVATE = ['/login', '/logout', '/dashboard', '/dashboard/:path*', '/Payment', '/success', '/reschedule', '/cancel-appointment'];
    return [
      ...PRIVATE.map((source) => ({ source, headers: noindex })),
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
