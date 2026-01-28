/**
 * MSAL Configuration for React Native
 * Configures Microsoft Authentication Library for mobile authentication
 */

/**
 * MSAL Configuration
 * Uses CLIENT_ID from environment or hardcoded for development
 */
export const msalConfig = {
  auth: {
    // Your Application (client) ID from Azure AD app registration
    clientId: 'f2f1830a-e181-44ed-aa95-e5c9f7d34c6b',

    // Authority to use for authentication (common tenant for personal accounts)
    authority: 'https://login.microsoftonline.com/common',

    // Redirect URI: msal<CLIENT_ID>://auth
    // Must match the redirect URI configured in Azure app registration
    redirectUri: 'msalf2f1830a-e181-44ed-aa95-e5c9f7d34c6b://auth',
  },

  // Scopes to request from Microsoft Graph
  scopes: ['User.Read', 'openid', 'profile', 'email'],

  // Token cache configuration
  cache: {
    cacheLocation: 'sessionStorage',
    storeAuthStateInCookie: false,
  },
};

/**
 * MSAL Silent Token Request
 * Used for silent token acquisition (without user interaction)
 */
export const silentTokenRequest = {
  scopes: msalConfig.scopes,
  forceRefresh: false,
};

/**
 * MSAL Interactive Token Request
 * Used for interactive login (requires user interaction)
 */
export const interactiveTokenRequest = {
  scopes: msalConfig.scopes,
  prompt: 'select_account', // Allow user to select which Microsoft account to use
};

export default msalConfig;
