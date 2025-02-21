import { useEffect, useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity,
  ActivityIndicator 
} from 'react-native';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors } from '../constants/theme';

export default function AuthCheck({ children }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const token = await AsyncStorage.getItem('userToken');
      // Simple validation without parsing the token
      if (!token) {
        setIsAuthenticated(false);
        return;
      }
      setIsAuthenticated(true);
    } catch (error) {
      // Silently handle the error and set auth state to false
      setIsAuthenticated(false);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!isAuthenticated) {
    return (
      <View style={styles.container}>
        <Text style={styles.message}>Please login first</Text>
        <TouchableOpacity 
          style={styles.button}
          onPress={() => router.replace('/login')}
        >
          <Text style={styles.buttonText}>Go to Login</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return children;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  message: {
    fontSize: 18,
    color: colors.text,
    marginBottom: 20,
    textAlign: 'center',
  },
  button: {
    backgroundColor: colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  }
});