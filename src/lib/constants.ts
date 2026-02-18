/**
 * Rownd platform OIDC configuration for CLI authentication.
 * The CLI authenticates users via Rownd's own OIDC provider.
 */

export const ROWND_API_BASE_URL =
  process.env.ROWND_API_URL || 'https://api.rownd.io';

/** OIDC issuer for the Rownd platform app */
export const ROWND_OIDC_ISSUER =
  `${ROWND_API_BASE_URL}/oidc/284636076242371085`;

/** OIDC client ID for the Rownd CLI */
export const ROWND_OIDC_CLIENT_ID =
  process.env.ROWND_CLIENT_ID || 'oc_ldmcd1w3hf4d1wv6yvqfn03s';

/** OIDC endpoints (from discovery doc) */
export const ROWND_OIDC_ENDPOINTS = {
  authorization: `${ROWND_OIDC_ISSUER}/auth`,
  token: `${ROWND_OIDC_ISSUER}/token`,
  userinfo: `${ROWND_OIDC_ISSUER}/me`,
  endSession: `${ROWND_OIDC_ISSUER}/session/end`,
};
