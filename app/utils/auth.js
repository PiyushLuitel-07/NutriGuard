import AsyncStorage from '@react-native-async-storage/async-storage';

export const clearUserData = async () => {
  try {
    const userId = await AsyncStorage.getItem('userId');
    const keysToRemove = [
      'userToken',
      'userId',
      `todayMeals_user_${userId}`,
    ];
    await AsyncStorage.multiRemove(keysToRemove);
  } catch (error) {
    console.error('Error clearing user data:', error);
  }
};