import Constants from 'expo-constants';

const NGROK_URL = process.env.NGROK_URL || 'https://b6de-2407-1400-aa36-70a8-182c-850-8c07-464d.ngrok-free.app';

export const endpoints = {
  login: `${NGROK_URL}/login`,
  register: `${NGROK_URL}/register`,
  getUserDetails: `${NGROK_URL}/user/details`,  // GET request
  updateUserDetails: `${NGROK_URL}/user/details`,  // POST request
  user: `${NGROK_URL}/user`,
  meals: `${NGROK_URL}/meals`,  // Added endpoint for meal logging
  logout: `${NGROK_URL}/logout`,  // Make sure this line exists
  getTodayMeals: `${NGROK_URL}/meals/today`, // Verify this matches your Flask route
  getTodayMealsNutrition: `${NGROK_URL}/meals/today/nutrition`,
  getTodayGlycemic: `${NGROK_URL}/meals/today/glycemic`,
  analyzeNutrition: `${NGROK_URL}/analyze_nutrition`, // Added endpoint for nutrition label analysis
  analyzeScannedFood: `${NGROK_URL}/analyze_scanned_food`,
  updateHealth: `${NGROK_URL}/user/health-update`,
};
