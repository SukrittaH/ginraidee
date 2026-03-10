import React, { createContext, useState, useContext, useEffect, useCallback, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as WebBrowser from 'expo-web-browser';
import { msalConfig } from '../services/msalConfig';
import APIService from '../services/apiService';

const AuthContext = createContext();

// Complete the web browser auth flow
WebBrowser.maybeCompleteAuthSession();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    console.warn('useAuth called outside AuthProvider, returning defaults');
    return {
      user: null,
      isAuthenticated: false,
      isLoading: true,
      error: null,
      login: async () => { throw new Error('AuthProvider not initialized'); },
      logout: async () => { throw new Error('AuthProvider not initialized'); },
      getAccessToken: async () => { throw new Error('AuthProvider not initialized'); },
      exchangeCodeForToken: async () => { throw new Error('AuthProvider not initialized'); },
    };
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const accessTokenRef = useRef(null);

  const setAccessToken = useCallback((token) => {
    accessTokenRef.current = token;
  }, []);

  const getAccessTokenValue = useCallback(() => accessTokenRef.current, []);

  // Initialize auth state from cache on app start
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        // Check for cached user and token
        const cachedUser = await AsyncStorage.getItem('user');
        const cachedToken = await AsyncStorage.getItem('accessToken');

        if (cachedUser && cachedToken) {
          // Verify token is a valid JWT (has 3 parts separated by dots)
          const tokenParts = cachedToken.split('.');
          if (tokenParts.length === 3) {
            // Check if token is expired
            try {
              const payload = JSON.parse(atob(tokenParts[1]));
              const currentTime = Math.floor(Date.now() / 1000);

              if (payload.exp < currentTime) {
                // Token is expired, clear cache
                console.warn('Cached token expired, clearing cache');
                await AsyncStorage.removeItem('user');
                await AsyncStorage.removeItem('accessToken');
              } else {
                // Token is valid, restore session
                const parsedUser = JSON.parse(cachedUser);
                setUser(parsedUser);
                setAccessToken(cachedToken);
                setIsAuthenticated(true);
              }
            } catch (decodeError) {
              console.warn('Failed to decode cached token:', decodeError);
              await AsyncStorage.removeItem('user');
              await AsyncStorage.removeItem('accessToken');
            }
          } else {
            // Old token format, clear it
            console.warn('Clearing incompatible cached token - please log in again');
            await AsyncStorage.removeItem('user');
            await AsyncStorage.removeItem('accessToken');
          }
        }
      } catch (err) {
        console.error('Auth initialization error:', err);
        setError('Failed to load session');
        // Clear cache on any error to prevent auth loops
        await AsyncStorage.removeItem('user');
        await AsyncStorage.removeItem('accessToken');
      } finally {
        setIsLoading(false);
      }
    };

    initializeAuth();
  }, [setAccessToken]);

  // Check if JWT token is expired
  const isTokenExpired = useCallback((token) => {
    if (!token || typeof token !== 'string') return true;

    try {
      const parts = token.split('.');
      if (parts.length !== 3) return true;

      const payload = JSON.parse(atob(parts[1]));
      const currentTime = Math.floor(Date.now() / 1000);

      // Token is expired if exp is in past
      return payload.exp < currentTime;
    } catch (error) {
      console.warn('Failed to decode token for expiration check:', error);
      return true; // Assume expired if we can't decode
    }
  }, []);

  // Get access token from cache
  const getAccessToken = useCallback(async () => {
    const token = getAccessTokenValue();

    if (!token) {
      console.warn('⚠️ No access token available');
      throw new Error('No access token available. Please login again.');
    }

    // Check if token is expired
    if (isTokenExpired(token)) {
      console.warn('⏰ Token expired, clearing cache');
      await AsyncStorage.removeItem('user');
      await AsyncStorage.removeItem('accessToken');
      setAccessToken(null);
      setUser(null);
      setIsAuthenticated(false);
      throw new Error('Token expired. Please login again.');
    }

    return token;
  }, [getAccessTokenValue, isTokenExpired, setAccessToken]);

  // Register getAccessToken with API service (only once on mount)
  useEffect(() => {
    APIService.setGetAccessTokenFn(getAccessToken);
  }, []);

  // Exchange authorization code for access token
  const exchangeCodeForToken = useCallback(async (code) => {
    setIsLoading(true);
    setError(null);
    try {
      const redirectUri = msalConfig.auth.redirectUri;
      const apiBaseUrl = require('../config/environment').default.API_BASE_URL;

      // Call backend token endpoint to exchange code for tokens
      const response = await fetch(`${apiBaseUrl}/auth/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, redirectUri }),
      });

      const data = await response.json();

      if (!response.ok || !data.accessToken) {
        throw new Error(data.error || 'Failed to exchange code for token');
      }

      const userData = {
        id: data.user.id,
        name: data.user.name,
        email: data.user.email,
        preferredUsername: data.user.preferredUsername,
      };

      // Cache user and token
      await AsyncStorage.setItem('user', JSON.stringify(userData));
      await AsyncStorage.setItem('accessToken', data.accessToken);

      setUser(userData);
      setAccessToken(data.accessToken);
      setIsAuthenticated(true);
      setError(null);

      return data;
    } catch (err) {
      console.error('Token exchange error:', err);
      setError(err.message || 'Failed to complete login');
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [setAccessToken]);

  // Login with Microsoft account
  const login = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      // Microsoft OAuth endpoints
      const authUrl = `https://login.microsoftonline.com/common/oauth2/v2.0/authorize`;

      // For development, use the scheme from app.json
      const redirectUri = msalConfig.auth.redirectUri;

      // Build authorization URL
      const authParams = new URLSearchParams({
        client_id: msalConfig.auth.clientId,
        response_type: 'code',
        scope: msalConfig.scopes.join(' '),
        redirect_uri: redirectUri,
        response_mode: 'query',
        prompt: 'select_account',
        state: 'state123', // Should be random in production
      });

      const loginUrl = `${authUrl}?${authParams.toString()}`;
      console.log('Opening Microsoft login at:', loginUrl);

      // Use openAuthSessionAsync for OAuth flows - it properly handles redirects
      const result = await WebBrowser.openAuthSessionAsync(loginUrl, redirectUri);

      console.log('Auth session result:', result);

      if (result.type === 'success') {
        // Parse the redirect URL to extract the authorization code
        const url = result.url;
        const parsed = new URL(url);
        const code = parsed.searchParams.get('code');
        const error = parsed.searchParams.get('error');

        if (error) {
          throw new Error(`Microsoft auth error: ${error}`);
        }

        if (code) {
          console.log('Received authorization code, exchanging for token...');
          await exchangeCodeForToken(code);
        }
      } else if (result.type === 'cancel') {
        console.log('User cancelled login');
        setError('Login cancelled');
      } else if (result.type === 'dismiss') {
        console.log('Auth session dismissed');
        setError('Login dismissed');
      }
    } catch (err) {
      console.error('Login error:', err);
      setError(err.message || 'Login failed');
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [exchangeCodeForToken]);

  // Logout
  const logout = useCallback(async () => {
    setIsLoading(true);
    try {
      // Clear local cache
      await AsyncStorage.removeItem('user');
      await AsyncStorage.removeItem('accessToken');

      setUser(null);
      setAccessToken(null);
      setIsAuthenticated(false);
      setError(null);
    } catch (err) {
      console.error('Logout error:', err);
      setError('Logout failed');
    } finally {
      setIsLoading(false);
    }
  }, [setAccessToken]);

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated,
        isLoading,
        error,
        login,
        logout,
        getAccessToken,
        exchangeCodeForToken,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
