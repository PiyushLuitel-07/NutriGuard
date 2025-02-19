import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { colors } from '../constants/theme';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { endpoints } from '../config/api';
import { router } from 'expo-router';
import LogoutButton from '../components/LogoutButton';
import { Stack } from 'expo-router';
import AuthCheck from '../components/AuthCheck';

export default function WelcomePage() {
  const [userName, setUserName] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchUserDetails();
  }, []);

  const fetchUserDetails = async () => {
    try {
      const token = await AsyncStorage.getItem('userToken');
      if (!token) {
        router.replace('/login');
        return;
      }

      const response = await fetch(endpoints.getUserDetails, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      // Check content type before parsing JSON
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        throw new Error('Invalid response format from server');
      }

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch user details');
      }

      if (!data.user || !data.user.full_name) {
        throw new Error('User data not found');
      }

      setUserName(data.user.full_name);
      setError(null);
    } catch (error) {
      console.error('Error fetching user details:', error);
      setError(error.message || 'Failed to load user details');
      if (error.message === 'No token found') {
        router.replace('/login');
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Update the handler to go to dashboard
  const handleGoToDashboard = () => {
    router.push('/dashboard');
  };

  return (
    <AuthCheck>
      <>
        <Stack.Screen
          options={{
            headerShown: true,
            title: "",
            headerStyle: {
              backgroundColor: colors.background,
            },
            headerShadowVisible: false,
          }}
        />
        <View style={styles.container}>
          {isLoading ? (
            <Text style={styles.loadingText}>Loading...</Text>
          ) : error ? (
            <Text style={styles.errorText}>{error}</Text>
          ) : (
            <>
              <Text style={styles.welcomeText}>Welcome,</Text>
              <Text style={styles.nameText}>{userName}</Text>
              <Text style={styles.subtitle}>Ready to track your nutrition?</Text>

              <TouchableOpacity 
                style={styles.button} 
                onPress={handleGoToDashboard}
              >
                <Text style={styles.buttonText}>Go to Dashboard</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </>
    </AuthCheck>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    padding: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  welcomeText: {
    fontSize: 24,
    color: colors.text,
    marginBottom: 8,
  },
  nameText: {
    fontSize: 32,
    fontWeight: 'bold',
    color: colors.primary,
    marginBottom: 24,
  },
  loadingText: {
    fontSize: 16,
    color: colors.text,
    textAlign: 'center',
  },
  errorText: {
    fontSize: 16,
    color: colors.error,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 18,
    color: colors.text,
    marginBottom: 40,
    textAlign: 'center',
  },
  button: {
    backgroundColor: colors.primary,
    paddingVertical: 15,
    paddingHorizontal: 40,
    borderRadius: 10,
    elevation: 2,
  },
  buttonText: {
    color: colors.white,
    fontSize: 18,
    fontWeight: '600',
  },
});
