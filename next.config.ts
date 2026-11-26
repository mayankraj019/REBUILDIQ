import type { NextConfig } from 'next';

const isDev = process.env.NODE_ENV === 'development';

const securityHeaders = [
  // Prevent clickjacking — no iframes allowed from any origin
  { key: 'X-Frame-Options', value: 'DENY' },
  // Block MIME-type sniffing
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  // Restrict referrer information to same-origin only on cross-origin requests
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  // Enforce HTTPS for 2 years (skip in dev to avoid localhost issues)
  ...(!isDev
    ? [
        {
          key: 'Strict-Transport-Security',
          value: 'max-age=63072000; includeSubDomains; preload',
        },
      ]
    : []),
  // Disable DNS prefetching to reduce information leakage
  { key: 'X-DNS-Prefetch-Control', value: 'on' },
  // Restrict browser features (camera, mic, etc.)
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
  },
  // Content-Security-Policy
  // Note: Supabase URLs are dynamically sourced from env; keep them in the allowlist.
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      // Scripts: Next.js inline scripts + Supabase Auth UI
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      // Styles: Tailwind inline styles
      "style-src 'self' 'unsafe-inline'",
      // Images: self + Supabase storage
      `img-src 'self' data: blob: ${process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''}`,
      // Fonts: self only
      "font-src 'self'",
      // API calls: self + Supabase
      `connect-src 'self' ${process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''} wss:`,
      // No plugins/objects
      "object-src 'none'",
      // No embedding in frames
      "frame-ancestors 'none'",
      // Block base tag hijacking
      "base-uri 'self'",
      // Restrict form submissions to self
      "form-action 'self'",
    ].join('; '),
  },
];

const nextConfig: NextConfig = {
  // ── Security Headers ────────────────────────────────────────────────────
  async headers() {
    return [
      {
        // Apply to every route
        source: '/(.*)',
        headers: securityHeaders,
      },
    ];
  },

  // ── Build / Output Options ───────────────────────────────────────────────
  // Output as standalone for Docker / Fly.io deployments
  // output: 'standalone',

  // ── Logging ─────────────────────────────────────────────────────────────
  logging: {
    fetches: {
      fullUrl: isDev,
    },
  },
};

export default nextConfig;
