import path from 'path';
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone',
  // Trace files from the monorepo root so the standalone build includes workspace packages.
  outputFileTracingRoot: path.join(__dirname, '../../'),
  poweredByHeader: false,
  reactStrictMode: true,
  // Linting runs from the repository root (pnpm lint), not during next build.
  eslint: { ignoreDuringBuilds: true },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        ],
      },
    ];
  },
};

export default nextConfig;
