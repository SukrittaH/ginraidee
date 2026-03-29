/**
 * MSAL Configuration for React Native
 * Configures Microsoft Authentication Library for mobile authentication
 *
 * MIGRATION TO ENTRA EXTERNAL ID:
 * 1. Create an Entra External ID tenant in Azure Portal
 * 2. Register your app in the External ID tenant
 * 3. Update EXTERNAL_ID_TENANT_NAME and CLIENT_ID below
 * 4. Configure identity providers (Google, Facebook) in the tenant
 */

/**
 * MSAL Configuration
 * Uses CLIENT_ID from environment or hardcoded for development
 */
export const msalConfig = {
  auth: {
    // Your Application (client) ID from Azure AD app registration
    clientId: process.env.EXPO_PUBLIC_CLIENT_ID || 'f2f1830a-e181-44ed-aa95-e5c9f7d34c6b',

    // Authority to use for authentication
    // Option 1: Use /common for work + personal Microsoft accounts (current)
    // Option 2: Use External ID tenant for enhanced external user support
    // Format: https://<tenant-name>.ciamlogin.com or https://<tenant-name>.b2clogin.com
    authority: process.env.EXPO_PUBLIC_AUTHORITY || 'https://login.microsoftonline.com/common',

    // Redirect URI: msal<CLIENT_ID>://auth
    // Must match the redirect URI configured in Azure app registration
    redirectUri: process.env.EXPO_PUBLIC_REDIRECT_URI || 'msalf2f1830a-e181-44ed-aa95-e5c9f7d34c6b://auth',
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
