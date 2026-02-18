import { createServer } from 'http';
import { URL } from 'url';
import { createHash, randomBytes } from 'crypto';
import open from 'open';
import { config } from './config.js';

export interface OAuthTokens {
  access_token: string;
  refresh_token: string;
  token_type?: string;
  expires_at?: number;
  user_id?: string;
}

export interface OAuthProvider {
  id: string;
  name: string;
  enabled: boolean;
}

/**
 * Gets available OAuth2 providers for the Rownd app
 */
export async function getOAuthProviders(appKey: string): Promise<OAuthProvider[]> {
  const response = await fetch('https://api.rownd.io/hub/auth/oauth2/providers', {
    headers: {
      'Authorization': `Bearer ${appKey}`,
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    throw new Error(`Failed to get OAuth providers: ${response.statusText}`);
  }

  const data = await response.json();
  return data.providers || [];
}

/**
 * Starts the OAuth flow by opening a browser and starting a local server
 * 
 * REQUIREMENTS FOR FULL OAUTH SUPPORT:
 * 1. Rownd API server needs to support localhost redirect URIs for CLI OAuth applications
 * 2. A Rownd CLI application needs to be created with:
 *    - App key for client identification
 *    - Allowed redirect URIs for localhost with wildcard port support
 *    - OIDC/OAuth2 flow enabled
 * 3. The OIDC discovery endpoint may need app-specific configuration
 * 
 * If the existing OAuth endpoints don't support CLI use cases, the API server
 * may need modifications as mentioned by Matt.
 */
export async function startOAuthFlow(appKey?: string): Promise<OAuthTokens> {
  if (!appKey) {
    throw new Error('App key is required for OAuth flow. Please contact Rownd support to get CLI application credentials.');
  }

  // Try to discover the app's OIDC configuration
  let oidcConfig;
  try {
    oidcConfig = await discoverOIDCConfig(appKey);
  } catch (error) {
    console.warn('Could not discover OIDC config, falling back to Rownd Hub auth endpoints');
    return startRowndHubFlow(appKey);
  }
  
  // Start local server on random port
  const server = createServer();
  const port = await getRandomPort();
  
  return new Promise((resolve, reject) => {
    let resolved = false;
    
    server.listen(port, 'localhost', () => {
      console.log(`\n🔐 Starting OAuth authentication...`);
      console.log(`Local server started on http://localhost:${port}`);
      
      const redirectUri = `http://localhost:${port}/callback`;
      const state = generateRandomState();
      const codeVerifier = generateCodeVerifier();
      const codeChallenge = generateCodeChallenge(codeVerifier);
      
      // Construct OAuth2/OIDC authorization URL
      const authUrl = new URL(oidcConfig.authorization_endpoint);
      authUrl.searchParams.set('client_id', appKey); // Using app key as client ID
      authUrl.searchParams.set('redirect_uri', redirectUri);
      authUrl.searchParams.set('response_type', 'code');
      authUrl.searchParams.set('scope', 'openid profile email offline_access');
      authUrl.searchParams.set('state', state);
      authUrl.searchParams.set('code_challenge', codeChallenge);
      authUrl.searchParams.set('code_challenge_method', 'S256');
      
      console.log(`Opening browser to: ${authUrl}`);
      
      // Open browser
      open(authUrl.toString()).catch(() => {
        console.log('\nUnable to open browser automatically.');
        console.log(`Please open this URL in your browser: ${authUrl}`);
      });

      // Store code verifier for token exchange
      (server as any).codeVerifier = codeVerifier;
      (server as any).appKey = appKey;
      (server as any).oidcConfig = oidcConfig;
    });

    server.on('request', async (req, res) => {
      if (resolved) return;
      
      try {
        const url = new URL(req.url!, `http://localhost:${port}`);
        
        if (url.pathname === '/callback') {
          const code = url.searchParams.get('code');
          const returnedState = url.searchParams.get('state');
          const error = url.searchParams.get('error');
          
          if (error) {
            throw new Error(`OAuth error: ${error} - ${url.searchParams.get('error_description')}`);
          }
          
          if (!code) {
            throw new Error('No authorization code received');
          }
          
          console.log('📝 Authorization code received, exchanging for tokens...');
          
          // Exchange code for tokens using OIDC token endpoint
          const tokens = await exchangeCodeForTokens(
            code, 
            `http://localhost:${port}/callback`, 
            (server as any).appKey,
            (server as any).codeVerifier,
            (server as any).oidcConfig
          );
          
          // Send success response to browser
          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end(`
            <!DOCTYPE html>
            <html>
              <head><title>Rownd CLI - Authentication Complete</title></head>
              <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; text-align: center; padding: 50px;">
                <h1 style="color: #10b981;">✅ Authentication Successful!</h1>
                <p>You have successfully authenticated with Rownd.</p>
                <p>You can close this browser window and return to your terminal.</p>
              </body>
            </html>
          `);
          
          resolved = true;
          server.close();
          resolve(tokens);
          
        } else {
          res.writeHead(404);
          res.end('Not found');
        }
      } catch (error) {
        resolved = true;
        server.close();
        reject(error);
      }
    });

    server.on('error', (error) => {
      if (!resolved) {
        resolved = true;
        reject(error);
      }
    });

    // Timeout after 5 minutes
    setTimeout(() => {
      if (!resolved) {
        resolved = true;
        server.close();
        reject(new Error('Authentication timeout. Please try again.'));
      }
    }, 5 * 60 * 1000);
  });
}

/**
 * Fallback flow using Rownd Hub auth endpoints
 */
async function startRowndHubFlow(appKey: string): Promise<OAuthTokens> {
  // This is a fallback implementation using /hub/auth/init
  // TODO: This might need adjustment based on actual Rownd Hub auth flow
  console.log('Using Rownd Hub authentication flow...');
  
  const server = createServer();
  const port = await getRandomPort();
  
  return new Promise(async (resolve, reject) => {
    let resolved = false;
    
    // Start the auth initiation with Rownd Hub
    const redirectUri = `http://localhost:${port}/callback`;
    
    try {
      const initResponse = await fetch('https://api.rownd.io/hub/auth/init', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${appKey}`,
        },
        body: JSON.stringify({
          return_url: redirectUri,
          redirect: true,
          intent: 'authentication'
        })
      });

      if (!initResponse.ok) {
        throw new Error(`Auth init failed: ${initResponse.statusText}`);
      }

      const initData = await initResponse.json();
      
      if (initData.auth_tokens) {
        // User is already authenticated or unverified users are allowed
        resolved = true;
        resolve({
          access_token: initData.auth_tokens.access_token,
          refresh_token: initData.auth_tokens.refresh_token,
          token_type: 'Bearer'
        });
        return;
      }

      console.log('Please complete authentication in your browser...');
      
      // TODO: This flow needs more work to handle the Rownd auth completion
      // For now, fall back to the manual token approach
      throw new Error('Rownd Hub auth flow not yet fully implemented. Please use --token flag for now.');
      
    } catch (error) {
      resolved = true;
      reject(error);
    }
  });
}

/**
 * Discovers OIDC configuration for the given app
 */
async function discoverOIDCConfig(appKey: string): Promise<any> {
  // Try to get app ID from app key first - this might require a separate API call
  // For now, we'll try the well-known endpoint with a dynamic app ID approach
  
  // TODO: We need a way to get the app ID from the app key
  // This might require calling a Rownd API endpoint to get app info
  // For now, we'll try the generic well-known endpoint
  
  const response = await fetch('https://api.rownd.io/.well-known/openid-configuration');
  if (!response.ok) {
    throw new Error(`Failed to discover OIDC config: ${response.statusText}`);
  }
  
  return await response.json();
}

/**
 * Exchanges authorization code for tokens using OIDC token endpoint
 */
async function exchangeCodeForTokens(
  code: string, 
  redirectUri: string, 
  appKey: string, 
  codeVerifier: string,
  oidcConfig: any
): Promise<OAuthTokens> {
  const tokenEndpoint = oidcConfig.token_endpoint;
  
  const response = await fetch(tokenEndpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code: code,
      redirect_uri: redirectUri,
      client_id: appKey,
      code_verifier: codeVerifier
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Token exchange failed: ${response.statusText} - ${errorText}`);
  }

  const tokenData = await response.json();
  
  // Extract tokens from response
  const tokens: OAuthTokens = {
    access_token: tokenData.access_token,
    refresh_token: tokenData.refresh_token,
    token_type: tokenData.token_type || 'Bearer'
  };

  if (tokenData.expires_in) {
    tokens.expires_at = Date.now() + (tokenData.expires_in * 1000);
  }

  if (tokenData.user_id || tokenData.sub) {
    tokens.user_id = tokenData.user_id || tokenData.sub;
  }

  return tokens;
}

/**
 * Refreshes access token using refresh token
 */
export async function refreshAccessToken(refreshToken: string): Promise<OAuthTokens> {
  const response = await fetch('https://api.rownd.io/hub/auth/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      refresh_token: refreshToken,
      grant_type: 'refresh_token'
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Token refresh failed: ${response.statusText} - ${errorText}`);
  }

  const tokenData = await response.json();
  
  const tokens: OAuthTokens = {
    access_token: tokenData.access_token,
    refresh_token: tokenData.refresh_token || refreshToken, // Keep existing refresh token if new one not provided
    token_type: tokenData.token_type || 'Bearer'
  };

  if (tokenData.expires_in) {
    tokens.expires_at = Date.now() + (tokenData.expires_in * 1000);
  }

  if (tokenData.user_id) {
    tokens.user_id = tokenData.user_id;
  }

  return tokens;
}

/**
 * Gets a random available port
 */
function getRandomPort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.listen(0, () => {
      const port = (server.address() as any).port;
      server.close(() => resolve(port));
    });
    server.on('error', reject);
  });
}

/**
 * Generates a random state parameter for OAuth security
 */
function generateRandomState(): string {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

/**
 * Generates a code verifier for PKCE (Proof Key for Code Exchange)
 */
function generateCodeVerifier(): string {
  const buffer = randomBytes(32);
  return base64URLEncode(buffer);
}

/**
 * Generates a code challenge from a code verifier for PKCE
 */
function generateCodeChallenge(codeVerifier: string): string {
  const hash = createHash('sha256').update(codeVerifier).digest();
  return base64URLEncode(hash);
}

/**
 * Base64 URL-safe encode
 */
function base64URLEncode(buffer: Uint8Array | Buffer): string {
  const base64 = Buffer.from(buffer).toString('base64');
  return base64
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

/**
 * Checks if access token needs refresh and refreshes if needed
 */
export async function ensureValidToken(): Promise<string> {
  const auth = config.getAuth();
  
  if (!auth?.access_token) {
    throw new Error('No access token available. Please run `rownd auth login`');
  }

  // If no expiration time or token is still valid, return current token
  if (!auth.expires_at || auth.expires_at > Date.now() + (5 * 60 * 1000)) { // 5 minute buffer
    return auth.access_token;
  }

  // Token is expired or expiring soon, try to refresh
  if (!auth.refresh_token) {
    throw new Error('Access token expired and no refresh token available. Please run `rownd auth login`');
  }

  try {
    console.log('🔄 Refreshing access token...');
    const newTokens = await refreshAccessToken(auth.refresh_token);
    
    // Update stored auth
    config.setAuth({
      access_token: newTokens.access_token,
      refresh_token: newTokens.refresh_token,
      token_type: newTokens.token_type,
      expires_at: newTokens.expires_at,
      user_id: newTokens.user_id || auth.user_id
    });
    config.save();
    
    return newTokens.access_token;
  } catch (error) {
    throw new Error(`Failed to refresh token: ${error instanceof Error ? error.message : 'Unknown error'}. Please run \`rownd auth login\``);
  }
}