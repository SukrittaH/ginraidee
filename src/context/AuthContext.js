import React, { createContext, useState, useContext } from 'react';
import APIService from '../services/apiService';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    // Return a default context instead of throwing immediately
    // This allows screens to render even if provider hasn't mounted yet
    console.warn('useAuth called outside AuthProvider, returning defaults');
    return {
      user: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
      register: async () => { throw new Error('AuthProvider not initialized'); },
      login: async () => { throw new Error('AuthProvider not initialized'); },
      logout: () => {},
    };
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  const register = async (email, password, name, language = 'en') => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await APIService.register(email, password, name, language);
      setUser(response.user);
      setIsAuthenticated(true);
      return response;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (email, password) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await APIService.login(email, password);
      setUser(response.user);
      setIsAuthenticated(true);
      return response;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    APIService.logout();
    setUser(null);
    setIsAuthenticated(false);
    setError(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated,
        isLoading,
        error,
        register,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
