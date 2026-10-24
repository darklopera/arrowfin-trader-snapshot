const api = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
const wsApi = api.replace(/^http/, 'ws');
const isDev = process.env.NODE_ENV !== 'production';

// Security headers. CSP caveat (also in SECURITY.md): Next.js App Router injects
// inline bootstrap scripts, so without per-request nonces script-src needs
// 'unsafe-inline'. The mitigation that matters here is that the app never
// renders untrusted HTML (no dangerouslySetInnerHTML anywhere).
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  `connect-src 'self' ${api} ${wsApi}`,
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ');

export default {
  poweredByHeader: false,
  async headers() {
    return [{
      source: '/(.*)',
      headers: [
        { key: 'Content-Security-Policy', value: csp },
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'Referrer-Policy', value: 'no-referrer' },
        { key: 'X-Frame-Options', value: 'DENY' },
      ],
    }];
  },
};
