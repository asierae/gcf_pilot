/**
 * Base URL for the Cloudflare Worker API.
 * Empty string = same origin (production Worker, and the Angular dev-server
 * proxy when running `npm run start:all`).
 *
 * Vercel only serves the static SPA, so it needs an absolute Worker URL.
 * Deploy the Worker first, then paste its URL below to keep the Vercel
 * deployment working against the same D1 + R2 data.
 */
export const REMOTE_API_BASE_URL = '';

/** Vercel previews and production all use *.vercel.app */
const IS_VERCEL = /\.vercel\.app$/i.test(
  typeof location === 'undefined' ? '' : location.hostname,
);

export const API_BASE_URL =
  IS_VERCEL && REMOTE_API_BASE_URL ? REMOTE_API_BASE_URL : '';

/** sessionStorage key holding the admin API token returned by POST /api/login */
export const API_TOKEN_STORAGE_KEY = 'api_token';

/**
 * Stored attachment URLs are origin-relative (`/api/files/...`). When the SPA
 * runs on a different origin than the Worker, point them at the Worker.
 */
export function resolveApiUrl(url: string): string {
  if (API_BASE_URL && url.startsWith('/api/')) {
    return `${API_BASE_URL}${url}`;
  }
  return url;
}
