import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Don't advertise the framework.
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          // Browsers that visited once always come back over HTTPS.
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          // No other site may put these pages in a frame (clickjacking).
          { key: 'X-Frame-Options', value: 'DENY' },
          // Other sites learn only our origin, never the page a visitor came from.
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        ],
      },
    ];
  },
};

export default nextConfig;
