import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useAuth } from '../context/AuthContext';

export const LoginScreen = () => {
  const { login, isLoading, error } = useAuth();

  const handleLogin = async () => {
    try {
      await login();
    } catch (err) {
      Alert.alert('Login Failed', err.message || 'Failed to sign in with Microsoft');
    }
  };

  return (
    <View style={styles.container}>
      {/* Logo/Title */}
      <View style={styles.header}>
        <Text style={styles.title}>Ginraidee</Text>
        <Text style={styles.subtitle}>Smart Inventory Management</Text>
      </View>

      {/* Microsoft Sign-In Button */}
      <TouchableOpacity
        style={[styles.button, isLoading && styles.buttonDisabled]}
        onPress={handleLogin}
        disabled={isLoading}
      >
        {isLoading ? (
          <ActivityIndicator color="#fff" size="small" />
        ) : (
          <>
            <Text style={styles.buttonText}>Sign in with Microsoft</Text>
          </>
        )}
      </TouchableOpacity>

      {/* Error Message */}
      {error && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {/* Help Text */}
      <View style={styles.helpContainer}>
        <Text style={styles.helpText}>
          Sign in with your Microsoft account to get started
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    backgroundColor: '#fff',
  },
  header: {
    marginBottom: 60,
    alignItems: 'center',
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    marginBottom: 8,
    color: '#000',
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
  },
  button: {
    backgroundColor: '#0078D4', // Microsoft brand blue
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 8,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  errorContainer: {
    backgroundColor: '#FEE',
    borderLeftWidth: 4,
    borderLeftColor: '#C33',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 4,
    marginBottom: 24,
    width: '100%',
  },
  errorText: {
    color: '#C33',
    fontSize: 14,
  },
  helpContainer: {
    marginTop: 24,
  },
  helpText: {
    fontSize: 13,
    color: '#999',
    textAlign: 'center',
  },
});

export default LoginScreen;
