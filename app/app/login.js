import { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Alert } from 'react-native';
import { Link, router } from 'expo-router';
import { colors } from '../constants/theme';
import { endpoints } from '../config/api';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Add this helper function
const clearPreviousUserCache = async () => {
  try {
    // Get all keys from AsyncStorage
    const keys = await AsyncStorage.getAllKeys();
    
    // Filter dashboard data keys
    const dashboardCacheKeys = keys.filter(key => key.startsWith('dashboardData_'));
    
    // Remove all dashboard cache entries
    if (dashboardCacheKeys.length > 0) {
      await AsyncStorage.multiRemove(dashboardCacheKeys);
    }
  } catch (error) {
    console.error('Error clearing previous user cache:', error);
  }
};

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleLogin = async () => {
    if (isLoading) return;
    setIsLoading(true);
    setErrorMessage(''); // Clear any previous error messages

    try {
      // Form validation
      if (!email && !password) {
        setErrorMessage('Email and password are required');
        return;
      }
      
      if (!email) {
        setErrorMessage('Email is required');
        return;
      }

      if (!password) {
        setErrorMessage('Password is required');
        return;
      }

      // Email validation
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        setErrorMessage('Please enter a valid email address');
        return;
      }

      const response = await fetch(endpoints.login, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Login failed');
      }

      if (data.token) {
        // Clear any existing cache before setting new user data
        await clearPreviousUserCache();
        
        // Set new user data
        await AsyncStorage.setItem('userToken', data.token);
        await AsyncStorage.setItem('userId', data.user.id);
        
        if (data.is_first_login) {
          router.replace('/user-details');
        } else {
          router.replace('/welcome');
        }
      } else {
        setErrorMessage('Invalid credentials');
      }
    } catch (error) {
      setErrorMessage(error.message || 'Invalid email or password');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Login</Text>
      
      {errorMessage ? (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{errorMessage}</Text>
        </View>
      ) : null}
      
      <View style={styles.form}>
        <TextInput
          style={styles.input}
          placeholder="Email"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
        />
        
        <TextInput
          style={styles.input}
          placeholder="Password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />

        <TouchableOpacity 
          style={[styles.button, isLoading && styles.buttonDisabled]} 
          onPress={handleLogin}
          disabled={isLoading}
        >
          <Text style={styles.buttonText}>
            {isLoading ? 'Logging in...' : 'Login'}
          </Text>
        </TouchableOpacity>

        <View style={styles.registerContainer}>
          <Text style={styles.registerText}>Don't have an account? </Text>
          <Link href="/register" style={styles.registerLink}>
            <Text style={styles.linkText}>Create One</Text>
          </Link>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    padding: 20,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: colors.primary,
    marginTop: 60,
    marginBottom: 40,
    textAlign: 'center',
  },
  form: {
    gap: 15,
  },
  input: {
    backgroundColor: colors.white,
    padding: 15,
    borderRadius: 10,
    fontSize: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  button: {
    backgroundColor: colors.primary,
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 10,
  },
  buttonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '600',
  },
  registerContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 20,
  },
  registerText: {
    color: colors.text,
    fontSize: 14,
  },
  registerLink: {
    color: colors.primary,
  },
  linkText: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '600',
  },
  buttonDisabled: {
    backgroundColor: colors.disabled,
  },
  errorContainer: {
    backgroundColor: '#FFE6E6', // Lighter red background
    padding: 12,
    borderRadius: 8,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#FF4D4D', // Brighter red border
    shadowColor: '#FF0000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  errorText: {
    color: '#FF0000', // Bright red text
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
  },
});
