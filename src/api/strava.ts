/**
 * Strava OAuth + Messages API client built on fetch (no SDK).
 *
 * Auth flow (manual-paste; works in Expo Go without deep-link plumbing):
 *   1. User taps "Connect" → app opens Strava authorize URL in system browser
 *   2. User approves
 *   3. Strava redirects to https://localhost/exchange_token?code=XYZ (404 page)
 *   4. User copies the URL (or just the code) from the address bar
 *   5. User pastes back into the app → app exchanges code for access+refresh tokens
 * Subsequent syncs use the refresh token automatically.
 */

import { StravaTokens } from '../types';

export const STRAVA_AUTH_URL = 'https://www.strava.com/oauth/authorize';
export const STRAVA_TOKEN_URL = 'https://www.strava.com/oauth/token';
export const STRAVA_API_BASE = 'https://www.strava.com/api/v3';

/** Redirect URI we send to Strava. Strava only validates the *domain* (localhost). */
export const REDIRECT_URI = 'https://localhost/exchange_token';

/** Strava scopes we request. `activity:read_all` includes private/manual activities. */
const SCOPE = 'read,activity:read_all';

// --- Errors -----------------------------------------------------------------

export class StravaError extends Error {
  status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.name = 'StravaError';
    this.status = status;
  }
}

// --- Building the authorize URL --------------------------------------------

export function buildAuthorizeUrl(clientId: string): string {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: REDIRECT_URI,
    response_type: 'code',
    approval_prompt: 'auto',
    scope: SCOPE,
  });
  return `${STRAVA_AUTH_URL}?${params.toString()}`;
}

/**
 * Extract the `code` value from a pasted URL OR return the input unchanged if
 * it's already just a code. Convenience for the manual-paste flow.
 */
export function extractAuthCode(pasted: string): string | undefined {
  if (!pasted) return undefined;
  const trimmed = pasted.trim();
  // Pure code (no slash/equals) — return as-is
  if (!trimmed.includes('?') && !trimmed.includes('=')) return trimmed;
  // Try to parse as URL
  try {
    const url = new URL(trimmed);
    const code = url.searchParams.get('code');
    if (code) return code;
  } catch {
    // Maybe just "code=ABC&scope=..." without https prefix
    const match = trimmed.match(/[?&]?code=([^&\s]+)/);
    if (match) return match[1];
  }
  return undefined;
}

// --- Token exchange + refresh ----------------------------------------------

interface RawTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_at: number;       // unix seconds
  expires_in: number;
  athlete?: { id: number; firstname?: string; lastname?: string };
}

export async function exchangeCodeForTokens(
  clientId: string,
  clientSecret: string,
  code: string,
): Promise<StravaTokens> {
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    code,
    grant_type: 'authorization_code',
  });
  const res = await fetch(STRAVA_TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new StravaError(`Token exchange failed (${res.status}): ${text}`, res.status);
  }
  const data: RawTokenResponse = await res.json();
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: data.expires_at,
    athleteId: data.athlete?.id,
    athleteName: data.athlete
      ? [data.athlete.firstname, data.athlete.lastname].filter(Boolean).join(' ').trim() || undefined
      : undefined,
  };
}

export async function refreshAccessToken(
  clientId: string,
  clientSecret: string,
  refreshToken: string,
): Promise<StravaTokens> {
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    grant_type: 'refresh_token',
  });
  const res = await fetch(STRAVA_TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new StravaError(`Token refresh failed (${res.status}): ${text}`, res.status);
  }
  const data: RawTokenResponse = await res.json();
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: data.expires_at,
    // Strava doesn't echo athlete on refresh — preserve from caller side.
  };
}

/**
 * Returns a fresh access token, refreshing if the current one expires within 60s.
 * The (possibly-rotated) tokens are returned so the caller can persist them.
 */
export async function ensureFreshTokens(
  clientId: string,
  clientSecret: string,
  current: StravaTokens,
): Promise<StravaTokens> {
  const nowSeconds = Math.floor(Date.now() / 1000);
  if (current.expiresAt - nowSeconds > 60) return current;
  const refreshed = await refreshAccessToken(clientId, clientSecret, current.refreshToken);
  return {
    ...refreshed,
    athleteId: current.athleteId,
    athleteName: current.athleteName,
  };
}

// --- Activities -------------------------------------------------------------

/**
 * Slim subset of fields we actually use from Strava's SummaryActivity.
 * See https://developers.strava.com/docs/reference/#api-models-SummaryActivity
 */
export interface StravaActivity {
  id: number;
  name: string;
  sport_type: string;                   // newer field — granular
  type: string;                         // legacy field — coarser
  start_date: string;                   // ISO with Z
  start_date_local: string;             // ISO without TZ
  timezone?: string;
  moving_time: number;                  // seconds
  elapsed_time: number;                 // seconds
  distance: number;                     // meters
  total_elevation_gain?: number;        // meters
  average_heartrate?: number;
  max_heartrate?: number;
  calories?: number;                    // kcal (present on detail; sometimes on summary)
  kilojoules?: number;                  // work in kJ (rides) — fallback energy proxy
  suffer_score?: number | null;
  trainer?: boolean;
  manual?: boolean;
}

/** Fetch activities started after `afterUnixSeconds`, paginated. */
export async function listActivitiesAfter(
  accessToken: string,
  afterUnixSeconds: number,
  perPage = 100,
  maxPages = 5,
): Promise<StravaActivity[]> {
  const all: StravaActivity[] = [];
  for (let page = 1; page <= maxPages; page++) {
    const url =
      `${STRAVA_API_BASE}/athlete/activities` +
      `?after=${afterUnixSeconds}&per_page=${perPage}&page=${page}`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new StravaError(`Strava activities fetch failed (${res.status}): ${text}`, res.status);
    }
    const batch: StravaActivity[] = await res.json();
    all.push(...batch);
    if (batch.length < perPage) break;
  }
  return all;
}
