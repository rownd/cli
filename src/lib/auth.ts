import { createServer, IncomingMessage, ServerResponse } from 'http';
import { randomBytes } from 'crypto';
import open from 'open';
import { config } from './config.js';
import { ROWND_PLATFORM_APP_KEY, ROWND_API_BASE_URL } from './constants.js';

export interface OAuthTokens {
  access_token: string;
  refresh_token: string;
  token_type?: string;
  expires_at?: number;
  user_id?: string;
}

/**
 * Starts the interactive browser-based auth flow.
 *
 * 1. Spins up a local HTTP server on a random port.
 * 2. Calls /hub/auth/init with a return_url pointing at localhost.
 * 3. Opens the browser so the user can complete sign-in via the Rownd Hub.
 * 4. The Hub redirects back to localhost after auth, or we poll challenge_status.
 * 5. Captures tokens and stores them.
 */
export async function startInteractiveLogin(): Promise<OAuthTokens> {
  const port = await getRandomPort();
  const redirectUri = `http://localhost:${port}/callback`;

  // Initiate sign-in via the Rownd Hub
  const initResp = await fetch(`${ROWND_API_BASE_URL}/hub/auth/init`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-rownd-hub-key': ROWND_PLATFORM_APP_KEY,
    },
    body: JSON.stringify({
      return_url: redirectUri,
      redirect: true,
    }),
  });

  if (!initResp.ok) {
    const body = await initResp.text();
    throw new Error(`Auth init failed (${initResp.status}): ${body}`);
  }

  const initData = await initResp.json() as Record<string, any>;

  // If tokens came back immediately (e.g. unverified users allowed), done
  if (initData.auth_tokens?.access_token) {
    return {
      access_token: initData.auth_tokens.access_token,
      refresh_token: initData.auth_tokens.refresh_token,
      token_type: 'Bearer',
    };
  }

  const challengeId: string | undefined = initData.challenge_id;

  // Start local server to catch the redirect callback
  const tokens = await waitForCallback(port, challengeId);
  return tokens;
}

/**
 * Waits for the auth callback on the local server.
 * Also polls challenge_status as a fallback if the redirect doesn't fire.
 */
function waitForCallback(port: number, challengeId?: string): Promise<OAuthTokens> {
  return new Promise((resolve, reject) => {
    let resolved = false;
    const done = (err: Error | null, tokens?: OAuthTokens) => {
      if (resolved) return;
      resolved = true;
      clearInterval(pollTimer);
      server.close();
      if (err) return reject(err);
      resolve(tokens!);
    };

    const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
      if (resolved) { res.end(); return; }
      const url = new URL(req.url!, `http://localhost:${port}`);

      if (url.pathname === '/callback') {
        const accessToken = url.searchParams.get('access_token');
        const refreshToken = url.searchParams.get('refresh_token');
        const error = url.searchParams.get('error');

        if (error) {
          sendHtml(res, 'Authentication failed. You may close this window.');
          done(new Error(`Auth error: ${error}`));
          return;
        }

        if (accessToken) {
          sendHtml(res, '✅ Authentication successful! You may close this window.');
          done(null, {
            access_token: accessToken,
            refresh_token: refreshToken || '',
            token_type: 'Bearer',
          });
          return;
        }

        // If no tokens in the URL params, try to get them from challenge status
        if (challengeId) {
          try {
            const tokens = await pollChallengeOnce(challengeId);
            if (tokens) {
              sendHtml(res, '✅ Authentication successful! You may close this window.');
              done(null, tokens);
              return;
            }
          } catch { /* fall through */ }
        }

        sendHtml(res, 'Waiting for authentication to complete...');
        res.end();
      } else {
        res.writeHead(404);
        res.end();
      }
    });

    server.listen(port, 'localhost', () => {
      console.log(`\n🔐 Opening browser for authentication...`);
      console.log(`  (If the browser doesn't open, visit: http://localhost:${port}/callback)\n`);

      // The return_url from /hub/auth/init should cause the Hub to redirect here.
      // We also need the user to actually see the Hub sign-in UI. If Rownd's Hub
      // serves a sign-in page that then redirects, we open that. For now, we
      // rely on the redirect flow. In future, this could open hub.rownd.io directly.
      //
      // If challenge-based: open a Rownd sign-in page URL.
      // For now, print instructions since the exact Hub URL depends on the app's subdomain.
      if (challengeId) {
        console.log('📧 Check your email or phone for a verification link/code.');
        console.log('   Waiting for verification...\n');
      }
    });

    // Poll challenge_status if we have a challenge ID
    let pollTimer: ReturnType<typeof setInterval>;
    if (challengeId) {
      pollTimer = setInterval(async () => {
        if (resolved) return;
        try {
          const tokens = await pollChallengeOnce(challengeId);
          if (tokens) done(null, tokens);
        } catch { /* keep polling */ }
      }, 3000);
    } else {
      pollTimer = setInterval(() => {}, 999999); // no-op
    }

    // Timeout after 5 minutes
    setTimeout(() => done(new Error('Authentication timed out after 5 minutes.')), 5 * 60 * 1000);
    server.on('error', (err) => done(err));
  });
}

async function pollChallengeOnce(challengeId: string): Promise<OAuthTokens | null> {
  const resp = await fetch(`${ROWND_API_BASE_URL}/hub/auth/challenge_status`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-rownd-hub-key': ROWND_PLATFORM_APP_KEY,
    },
    body: JSON.stringify({ challenge_id: challengeId }),
  });

  if (!resp.ok) return null;

  const data = await resp.json() as Record<string, any>;
  if (data.access_token) {
    return {
      access_token: data.access_token,
      refresh_token: data.refresh_token || '',
      token_type: 'Bearer',
      user_id: data.app_user_id,
    };
  }
  return null;
}

/**
 * Refreshes an access token using a stored refresh token.
 */
export async function refreshAccessToken(refreshToken: string): Promise<OAuthTokens> {
  const resp = await fetch(`${ROWND_API_BASE_URL}/hub/auth/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-rownd-hub-key': ROWND_PLATFORM_APP_KEY,
    },
    body: JSON.stringify({ refresh_token: refreshToken }),
  });

  if (!resp.ok) {
    const body = await resp.text();
    throw new Error(`Token refresh failed (${resp.status}): ${body}`);
  }

  const data = await resp.json() as Record<string, any>;
  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token || refreshToken,
    token_type: 'Bearer',
    user_id: data.user_id,
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

  // If no expiry or still valid (with 5 min buffer), use it
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
    user_id: tokens.user_id || auth.user_id,
  });
  config.save();
  return tokens.access_token;
}

// ── Helpers ──────────────────────────────────────────────────

function getRandomPort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = createServer();
    srv.listen(0, () => {
      const port = (srv.address() as any).port;
      srv.close(() => resolve(port));
    });
    srv.on('error', reject);
  });
}

function sendHtml(res: ServerResponse, message: string) {
  res.writeHead(200, { 'Content-Type': 'text/html' });
  res.end(`<!DOCTYPE html><html><body style="font-family:system-ui;text-align:center;padding:60px"><h2>${message}</h2><p>Return to your terminal.</p></body></html>`);
}
