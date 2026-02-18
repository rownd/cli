import { createServer, ServerResponse } from 'http';
import { createHash, randomBytes } from 'crypto';
import open from 'open';
import { config } from './config.js';
import {
  ROWND_OIDC_CLIENT_ID,
  ROWND_OIDC_ENDPOINTS,
} from './constants.js';

export interface OAuthTokens {
  access_token: string;
  refresh_token: string;
  id_token?: string;
  token_type?: string;
  expires_at?: number;
}

/**
 * Standard OAuth2 Authorization Code + PKCE flow via Rownd's OIDC provider.
 *
 * 1. Start local HTTP server on a random port
 * 2. Open browser to Rownd OIDC authorize endpoint
 * 3. User signs in via the Rownd Hub
 * 4. Rownd redirects to localhost with an auth code
 * 5. CLI exchanges code for tokens via the token endpoint
 */
export async function startInteractiveLogin(): Promise<OAuthTokens> {
  const port = await getRandomPort();
  const redirectUri = `http://localhost:${port}/callback`;

  // PKCE
  const codeVerifier = base64url(randomBytes(32));
  const codeChallenge = base64url(createHash('sha256').update(codeVerifier).digest());
  const state = base64url(randomBytes(16));

  // Build authorize URL
  const authUrl = new URL(ROWND_OIDC_ENDPOINTS.authorization);
  authUrl.searchParams.set('client_id', ROWND_OIDC_CLIENT_ID);
  authUrl.searchParams.set('redirect_uri', redirectUri);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('scope', 'openid profile email offline_access');
  authUrl.searchParams.set('state', state);
  authUrl.searchParams.set('code_challenge', codeChallenge);
  authUrl.searchParams.set('code_challenge_method', 'S256');

  return new Promise((resolve, reject) => {
    let done = false;
    const finish = (err: Error | null, tokens?: OAuthTokens) => {
      if (done) return;
      done = true;
      server.close();
      err ? reject(err) : resolve(tokens!);
    };

    const server = createServer(async (req, res) => {
      if (done) { res.end(); return; }
      const url = new URL(req.url!, `http://localhost:${port}`);

      if (url.pathname !== '/callback') {
        res.writeHead(404); res.end(); return;
      }

      const error = url.searchParams.get('error');
      if (error) {
        sendHtml(res, `❌ ${error}: ${url.searchParams.get('error_description') || ''}`);
        finish(new Error(`Auth error: ${error}`));
        return;
      }

      const code = url.searchParams.get('code');
      const returnedState = url.searchParams.get('state');

      if (returnedState !== state) {
        sendHtml(res, '❌ State mismatch — possible CSRF. Try again.');
        finish(new Error('OAuth state mismatch'));
        return;
      }

      if (!code) {
        sendHtml(res, '❌ No authorization code received.');
        finish(new Error('No authorization code'));
        return;
      }

      // Exchange code for tokens
      try {
        const tokens = await exchangeCode(code, redirectUri, codeVerifier);
        sendHtml(res, '✅ Authenticated! You can close this window.');
        finish(null, tokens);
      } catch (err) {
        sendHtml(res, '❌ Token exchange failed. Check your terminal.');
        finish(err instanceof Error ? err : new Error(String(err)));
      }
    });

    server.listen(port, 'localhost', () => {
      console.log('\n🔐 Opening browser for Rownd sign-in...');
      open(authUrl.toString()).catch(() => {
        console.log(`\nCouldn't open browser automatically. Visit:\n  ${authUrl}\n`);
      });
    });

    server.on('error', (err) => finish(err));
    setTimeout(() => finish(new Error('Authentication timed out (5 min).')), 5 * 60 * 1000);
  });
}

/**
 * Exchange authorization code for tokens at the OIDC token endpoint.
 */
async function exchangeCode(
  code: string,
  redirectUri: string,
  codeVerifier: string,
): Promise<OAuthTokens> {
  const resp = await fetch(ROWND_OIDC_ENDPOINTS.token, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      client_id: ROWND_OIDC_CLIENT_ID,
      code_verifier: codeVerifier,
    }),
  });

  if (!resp.ok) {
    const body = await resp.text();
    throw new Error(`Token exchange failed (${resp.status}): ${body}`);
  }

  const data = await resp.json() as Record<string, any>;
  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    id_token: data.id_token,
    token_type: data.token_type || 'Bearer',
    expires_at: data.expires_in ? Date.now() + data.expires_in * 1000 : undefined,
  };
}

/**
 * Refresh an access token using a stored refresh token.
 */
export async function refreshAccessToken(refreshToken: string): Promise<OAuthTokens> {
  const resp = await fetch(ROWND_OIDC_ENDPOINTS.token, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: ROWND_OIDC_CLIENT_ID,
    }),
  });

  if (!resp.ok) {
    const body = await resp.text();
    throw new Error(`Token refresh failed (${resp.status}): ${body}`);
  }

  const data = await resp.json() as Record<string, any>;
  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token || refreshToken,
    id_token: data.id_token,
    token_type: data.token_type || 'Bearer',
    expires_at: data.expires_in ? Date.now() + data.expires_in * 1000 : undefined,
  };
}

/**
 * Ensures we have a valid access token, refreshing if needed.
 */
export async function ensureValidToken(): Promise<string> {
  const auth = config.getAuth();
  if (!auth?.access_token) {
    throw new Error('Not authenticated. Run `rownd auth login`.');
  }

  if (!auth.expires_at || auth.expires_at > Date.now() + 5 * 60 * 1000) {
    return auth.access_token;
  }

  if (!auth.refresh_token) {
    throw new Error('Token expired. Run `rownd auth login`.');
  }

  const tokens = await refreshAccessToken(auth.refresh_token);
  config.setAuth({
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    token_type: tokens.token_type,
    expires_at: tokens.expires_at,
  });
  config.save();
  return tokens.access_token;
}

// ── Helpers ──────────────────────────────────────────────────

function getRandomPort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const s = createServer();
    s.listen(0, () => {
      const port = (s.address() as any).port;
      s.close(() => resolve(port));
    });
    s.on('error', reject);
  });
}

function base64url(buf: Buffer | Uint8Array): string {
  return Buffer.from(buf)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

function sendHtml(res: ServerResponse, msg: string) {
  res.writeHead(200, { 'Content-Type': 'text/html' });
  res.end(`<!DOCTYPE html><html><body style="font-family:system-ui;text-align:center;padding:60px"><h2>${msg}</h2><p>Return to your terminal.</p></body></html>`);
}
