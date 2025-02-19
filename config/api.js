// Get the NGROK_URL from environment variable
const API_URL = 'http://127.0.0.1:5000';

export const endpoints = {
  login: `${API_URL}/login`,
  register: `${API_URL}/register`,
  getUserDetails: `${API_URL}/user/details`,  // GET request
  updateUserDetails: `${API_URL}/user/details`,  // POST request
  user: `${API_URL}/user`,
  meals: `${API_URL}/meals`,  // Added endpoint for meal logging
  logout: `${API_URL}/logout`,  // Make sure this line exists
  getTodayMeals: `${API_URL}/meals/today`, // Verify this matches your Flask route
  getTodayMealsNutrition: `${API_URL}/meals/today/nutrition`,
  getTodayGlycemic: `${API_URL}/meals/today/glycemic`,
  analyzeNutrition: `${API_URL}/analyze_nutrition`, // Added endpoint for nutrition label analysis
  analyzeScannedFood: `${API_URL}/analyze_scanned_food`,
  updateHealth: `${API_URL}/user/health-update`,
};
