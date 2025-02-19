import { useEffect } from 'react';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function UnmatchedRoute() {
  useEffect(() => {
    checkAuthAndRedirect();
  }, []);

  const checkAuthAndRedirect = async () => {
    try {
      const token = await AsyncStorage.getItem('userToken');
      if (!token) {
        router.replace('/login');
      } else {
        router.replace('/welcome');
      }
    } catch (error) {
      console.error('Auth check error:', error);
      router.replace('/login');
    }
  };

  return null;
}