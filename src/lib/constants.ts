/**
 * Rownd platform app key — used to authenticate CLI users against
 * Rownd's own Rownd app (the one that powers platform auth).
 *
 * TODO: Replace with the actual Rownd platform app key before release.
 * Can be overridden via ROWND_APP_KEY env var for dev/testing.
 */
export const ROWND_PLATFORM_APP_KEY =
  process.env.ROWND_APP_KEY || 'key_xxxxxxxxxxxx';

export const ROWND_API_BASE_URL =
  process.env.ROWND_API_URL || 'https://api.rownd.io';
