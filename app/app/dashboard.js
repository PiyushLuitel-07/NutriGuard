import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, RefreshControl } from 'react-native';
import { Stack, router } from 'expo-router';
import { colors } from '../constants/theme';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { endpoints } from '../config/api';
import AuthCheck from '../components/AuthCheck';
import { Ionicons, MaterialIcons } from '@expo/vector-icons'; // Added MaterialIcons import
import UploadModal from '../components/UploadModal';

// Add these constants at the top of the file
const CACHE_KEYS = {
  DASHBOARD_DATA: 'dashboardData_'
};

export default function DashboardPage() {
  const [todayMeals, setTodayMeals] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [nutritionData, setNutritionData] = useState(null);
  const [glycemicData, setGlycemicData] = useState(null);
  const [isUploadModalVisible, setIsUploadModalVisible] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastFetchTime, setLastFetchTime] = useState(null);
  const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes in milliseconds

  const shouldFetchFreshData = () => {
    if (!lastFetchTime) return true;
    return Date.now() - lastFetchTime > CACHE_DURATION;
  };

  // Add this function to handle caching
  const cacheDashboardData = async (meals, nutrition, glycemic) => {
    try {
      const userId = await AsyncStorage.getItem('userId');
      const cacheKey = `${CACHE_KEYS.DASHBOARD_DATA}${userId}`;
      const today = new Date().toDateString();
      
      const dataToCache = {
        meals,
        nutrition,
        glycemic,
        timestamp: Date.now(),
        date: today
      };

      await AsyncStorage.setItem(cacheKey, JSON.stringify(dataToCache));
    } catch (error) {
      console.error('Error caching dashboard data:', error);
    }
  };

  // Add this function to load cached data
  const loadCachedData = async () => {
    try {
      const userId = await AsyncStorage.getItem('userId');
      const cacheKey = `${CACHE_KEYS.DASHBOARD_DATA}${userId}`;
      const cachedData = await AsyncStorage.getItem(cacheKey);

      if (cachedData) {
        const parsed = JSON.parse(cachedData);
        const today = new Date().toDateString();

        // Only use cache if it's from today
        if (parsed.date === today) {
          setTodayMeals(parsed.meals);
          setNutritionData(parsed.nutrition);
          setGlycemicData(parsed.glycemic);
          setIsLoading(false);
          return true;
        }
      }
      return false;
    } catch (error) {
      console.error('Error loading cached data:', error);
      return false;
    }
  };

  // Modify the fetchData function
  const fetchData = async (forceFetch = false) => {
    try {
      const token = await AsyncStorage.getItem('userToken');
      if (!token) {
        console.log('No token found');
        return;
      }

      if (!forceFetch) {
        const hasCachedData = await loadCachedData();
        if (hasCachedData) {
          return;
        }
      }

      setIsLoading(true);
      setError(null);

      // First fetch meals and wait for the result
      const meals = await fetchTodayMeals(token);
      
      // Only fetch nutrition and glycemic data if there are meals
      if (meals && meals.length > 0) {
        // Fetch both nutrition and glycemic data in parallel
        const [nutritionResponse, glycemicResponse] = await Promise.all([
          fetch(endpoints.getTodayMealsNutrition, {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
          }),
          fetch(endpoints.getTodayGlycemic, {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
          })
        ]);

        const nutritionData = await nutritionResponse.json();
        const glycemicData = await glycemicResponse.json();

        if (nutritionData && nutritionData.nutrition) {
          setNutritionData(nutritionData.nutrition);
        }

        if (glycemicData && glycemicData.glycemic_index !== undefined) {
          setGlycemicData({
            glycemic_index: glycemicData.glycemic_index,
            glycemic_load: glycemicData.glycemic_load
          });
        }

        // Cache the fetched data
        await cacheDashboardData(meals, nutritionData.nutrition, {
          glycemic_index: glycemicData.glycemic_index,
          glycemic_load: glycemicData.glycemic_load
        });
      } else {
        setNutritionData(null);
        setGlycemicData(null);
      }

      setLastFetchTime(Date.now());

    } catch (error) {
      console.error('Error in data fetching:', error);
      if (error.message !== 'Failed to fetch nutritional information') {
        setError('Failed to fetch data');
      }
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  // Modify the useEffect
  useEffect(() => {
    const initializeData = async () => {
      try {
        const hasCachedData = await loadCachedData();
        if (!hasCachedData) {
          await fetchData(true);
        }
      } catch (error) {
        console.error('Error in initial data load:', error);
        setError('Failed to load data');
      }
    };

    initializeData();
  }, []);

  const fetchTodayMeals = async (token) => {
    try {
      const response = await fetch(endpoints.getTodayMeals, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();
      console.log('Today\'s meals response:', data);

      if (!response.ok) {
        if (response.status === 404) {
          setTodayMeals([]);
          return [];
        } else {
          throw new Error(data.error || 'Failed to fetch meals');
        }
      } else if (data && data.meals && Array.isArray(data.meals)) {
        setTodayMeals(data.meals);
        return data.meals;
      } else {
        setTodayMeals([]);
        return [];
      }
    } catch (error) {
      console.error('Error fetching meals:', error);
      setTodayMeals([]);
      throw error;
    }
  };

  const fetchNutritionData = async (token) => {
    try {
      // If there are no meals, return early without making the API call
      if (todayMeals.length === 0) {
        setNutritionData(null);
        return;
      }

      const response = await fetch(endpoints.getTodayMealsNutrition, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 404) {
          // No nutrition data found, but this is not an error state
          setNutritionData(null);
          return;
        }
        throw new Error(data.error || 'Failed to fetch nutrition data');
      }

      if (data && data.nutrition) {
        setNutritionData(data.nutrition);
      } else {
        setNutritionData(null);
      }
    } catch (error) {
      console.error('Error fetching nutrition data:', error);
      // Don't throw the error, just set nutrition data to null
      setNutritionData(null);
    }
  };

  const fetchGlycemicData = async (token) => {
    try {
      const response = await fetch(endpoints.getTodayGlycemic, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();
      console.log('Glycemic data response:', data); // Debug log

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch glycemic data');
      }

      if (data && data.glycemic_index !== undefined && data.glycemic_load !== undefined) {
        setGlycemicData({
          glycemic_index: data.glycemic_index,
          glycemic_load: data.glycemic_load
        });
      } else {
        setGlycemicData(null);
      }
    } catch (error) {
      console.error('Error fetching glycemic data:', error);
      setGlycemicData(null);
    }
  };

  const handleLogMeals = () => {
    router.push('/meal_logging');
  };

  // Update the handleImageUpload function
  const handleImageUpload = async (base64Image) => {
    try {
      const token = await AsyncStorage.getItem('userToken');
      console.log('Sending image for analysis...');
      
      const response = await fetch(endpoints.analyzeNutrition, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          image: base64Image
        })
      });

      const data = await response.json();
      console.log('Received response:', data);

      if (data.status === 'error') {
        // Handle specific error cases
        if (data.message === 'No nutrition label detected') {
          Alert.alert('Error', 'Could not detect Nutritional Label');
        } else if (data.message.includes('Gemini')) { // Check for Gemini API errors
          Alert.alert('Error', 'Couldn\'t extract data');
        } else {
          Alert.alert('Error', data.message || 'Failed to process image');
        }
        setIsUploadModalVisible(false); // Close modal on error
        return;
      }

      if (data.status === 'success') {
        setIsUploadModalVisible(false);
        router.push({
          pathname: '/edit_nutrition',
          params: { nutritionData: JSON.stringify(data.nutrition_data) }
        });
      }
    } catch (error) {
      console.error('Error uploading image:', error);
      Alert.alert('Error', 'Failed to process image');
      setIsUploadModalVisible(false);
    }
  };

  const handleUploadPress = async () => {
    const token = await AsyncStorage.getItem('userToken');
    if (!token) {
      router.replace('/login');
      return;
    }
    setIsUploadModalVisible(true);
  };

  const onRefresh = async () => {
    setIsRefreshing(true);
    await fetchData(true); // Force fetch fresh data
  };

  return (
    <AuthCheck>
      <>
        <Stack.Screen
          options={{
            title: "Dashboard",
            headerStyle: {
              backgroundColor: colors.background,
              height: 100, // Add fixed height
            },
            headerTitleStyle: {
              color: colors.primary,
              fontSize: 20,
            },  
            headerShadowVisible: false,
          }}
        />
        
        <View style={styles.container}>
          <ScrollView 
            style={styles.scrollView}
            refreshControl={
              <RefreshControl
                refreshing={isRefreshing}
                onRefresh={onRefresh}
                colors={[colors.primary]}
              />
            }
          >
            {/* Today's Meals Section */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Today's Meals</Text>
              {isLoading ? (
                <Text style={styles.loadingText}>Loading...</Text>
              ) : todayMeals.length === 0 ? (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyStateText}>No meals logged today</Text>
                  <TouchableOpacity 
                    style={styles.logMealButton} 
                    onPress={handleLogMeals}
                  >
                    <Text style={styles.logMealButtonText}>Log Your Meals</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.mealsContainer}>
                  {todayMeals.map((meal, index) => (
                    <View key={index} style={styles.mealCard}>
                      <Text style={styles.mealType}>{meal.meal_type}</Text>
                      {meal.food_items.map((item, itemIndex) => (
                        <Text key={itemIndex} style={styles.foodItem}>
                          • {item.quantity} {item.unit} {item.food_item}
                        </Text>
                      ))}
                    </View>
                  ))}
                </View>
              )}
            </View>

            {/* Nutritional Information Section */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Nutritional Information</Text>
              {isLoading ? (
                <Text style={styles.loadingText}>Loading...</Text>
              ) : todayMeals.length === 0 ? (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyStateText}>No nutritional data available</Text>
                  <Text style={styles.emptyStateSubText}>Log your meals to see nutrition information</Text>
                </View>
              ) : (
                <View style={styles.nutritionContainer}>
                  <View style={styles.nutritionRow}>
                    <View style={styles.nutritionCell}>
                      <Text style={styles.nutritionLabel}>Calories</Text>
                      <Text style={styles.nutritionValue}>
                        {nutritionData ? `${Math.round(nutritionData["Calories"])} kcal` : '--'}
                      </Text>
                    </View>
                    <View style={styles.nutritionCell}>
                      <Text style={styles.nutritionLabel}>Carbs</Text>
                      <Text style={styles.nutritionValue}>
                        {nutritionData ? `${Math.round(nutritionData["Carbohydrates"])}g` : '--'}
                      </Text>
                    </View>
                    <View style={styles.nutritionCell}>
                      <Text style={styles.nutritionLabel}>Protein</Text>
                      <Text style={styles.nutritionValue}>
                        {nutritionData ? `${Math.round(nutritionData["Protein"])}g` : '--'}
                      </Text>
                    </View>
                  </View>
                  {/* Row 2 */}
                  <View style={styles.nutritionRow}>
                    <View style={styles.nutritionCell}>
                      <Text style={styles.nutritionLabel}>Fat</Text>
                      <Text style={styles.nutritionValue}>
                        {nutritionData ? `${Math.round(nutritionData["Fat"])}g` : '--'}
                      </Text>
                    </View>
                    <View style={styles.nutritionCell}>
                      <Text style={styles.nutritionLabel}>Sodium</Text>
                      <Text style={styles.nutritionValue}>
                        {nutritionData ? `${Math.round(nutritionData["Sodium Content"])}mg` : '--'}
                      </Text>
                    </View>
                    <View style={styles.nutritionCell}>
                      <Text style={styles.nutritionLabel}>Potassium</Text>
                      <Text style={styles.nutritionValue}>
                        {nutritionData ? `${Math.round(nutritionData["Potassium Content"])}mg` : '--'}
                      </Text>
                    </View>
                  </View>
                  {/* Row 3 */}
                  <View style={styles.nutritionRow}>
                    <View style={styles.nutritionCell}>
                      <Text style={styles.nutritionLabel}>Magnesium</Text>
                      <Text style={styles.nutritionValue}>
                        {nutritionData ? `${Math.round(nutritionData["Magnesium Content"])}mg` : '--'}
                      </Text>
                    </View>
                    <View style={styles.nutritionCell}>
                      <Text style={styles.nutritionLabel}>Calcium</Text>
                      <Text style={styles.nutritionValue}>
                        {nutritionData ? `${Math.round(nutritionData["Calcium Content"])}mg` : '--'}
                      </Text>
                    </View>
                    <View style={styles.nutritionCell}>
                      <Text style={styles.nutritionLabel}>Fiber</Text>
                      <Text style={styles.nutritionValue}>
                        {nutritionData ? `${Math.round(nutritionData["Fiber Content"])}g` : '--'}
                      </Text>
                    </View>
                  </View>
                </View>
              )}
            </View>

            <View style={styles.section}>
              <View style={styles.glycemicContainer}>
                <View style={styles.glycemicRow}>
                  <View style={styles.glycemicCell}>
                    <Text style={styles.glycemicLabel}>Glycemic Index</Text>
                    <Text style={styles.glycemicValue}>
                      {glycemicData && glycemicData.glycemic_index !== undefined 
                        ? Math.round(glycemicData.glycemic_index) 
                        : '--'}
                    </Text>
                  </View>
                  <View style={styles.glycemicCell}>
                    <Text style={styles.glycemicLabel}>Glycemic Load</Text>
                    <Text style={styles.glycemicValue}>
                      {glycemicData && glycemicData.glycemic_load !== undefined 
                        ? Math.round(glycemicData.glycemic_load) 
                        : '--'}
                    </Text>
                  </View>
                </View>
              </View>
            </View>
          </ScrollView>

          {/* Footer Buttons */}
          <View style={styles.footer}>
            <TouchableOpacity 
              style={styles.footerButton}
              onPress={() => router.push('/camera')}
            >
              <Ionicons name="camera" size={24} color={colors.primary} />
              <Text style={styles.footerButtonText}>Scan Label</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.footerButton}
              onPress={handleUploadPress}  // Changed from directly setting state
            >
              <MaterialIcons name="file-upload" size={24} color={colors.primary} />
              <Text style={styles.footerButtonText}>Upload</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.footerButton}
              onPress={() => router.push('/user_profile')}
            >
              <Ionicons name="person-circle-outline" size={24} color={colors.primary} />
              <Text style={styles.footerButtonText}>Profile</Text>
            </TouchableOpacity>
          </View>
        </View>

        {isUploadModalVisible && (  // Add condition here
          <UploadModal
            visible={isUploadModalVisible}
            onClose={() => setIsUploadModalVisible(false)}
            onImageUpload={handleImageUpload}
          />
        )}
      </>
    </AuthCheck>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    paddingTop: 10, // Reduced padding
    paddingBottom: 70, // Increased for footer
    // Add hardware acceleration
    backfaceVisibility: 'hidden',
  },
  scrollView: {
    flex: 1,
    // Add hardware acceleration
    backfaceVisibility: 'hidden',
  },
  section: {
    padding: 20,
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: colors.primary,
    marginBottom: 15,
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
  emptyState: {
    alignItems: 'center',
    padding: 20,
  },
  emptyStateText: {
    fontSize: 16,
    color: colors.text,
    marginBottom: 15,
  },
  logMealButton: {
    backgroundColor: colors.primary,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  logMealButtonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '600',
  },
  mealsContainer: {
    gap: 15,
  },
  mealCard: {
    backgroundColor: colors.white,
    padding: 15,
    borderRadius: 10,
    // Use elevation for Android
    elevation: 3,
    // Use shadow props for iOS
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  mealType: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.primary,
    marginBottom: 10,
  },
  foodItem: {
    fontSize: 16,
    color: colors.text,
    marginBottom: 5,
  },
  giContainer: {
    backgroundColor: colors.white,
    padding: 20,
    borderRadius: 10,
    alignItems: 'center',
  },
  placeholder: {
    color: colors.text,
    fontSize: 16,
    fontStyle: 'italic',
  },
  nutritionContainer: {
    backgroundColor: colors.white,
    padding: 20,
    borderRadius: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  nutritionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20, // Space between rows
  },
  nutritionCell: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 5,
  },
  nutritionLabel: {
    fontSize: 13,
    color: '#000',
    fontWeight: '800',
    marginBottom: 5,
    textAlign: 'center',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  nutritionValue: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.primary,
    textAlign: 'center',
  },
  glycemicIndex: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 15,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  giLabel: {
    fontSize: 16,
    color: colors.text,
    fontWeight: '500',
  },
  giValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.primary,
  },
  glycemicContainer: {
    backgroundColor: colors.white,
    padding: 20,
    borderRadius: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    marginTop: 20,
  },
  glycemicRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  glycemicCell: {
    alignItems: 'center',
  },
  glycemicLabel: {
    fontSize: 16,
    color: '#000',
    fontWeight: '800',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  glycemicValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.primary,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between', // Changed from space-evenly
    paddingVertical: 12,
    paddingHorizontal: 20, // Added horizontal padding
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    elevation: 8,
  },
  footerButton: {
    alignItems: 'center',
    width: '30%', // Changed from 45% to accommodate three buttons
  },
  cameraButton: {
    position: 'absolute',
    bottom: 20,
    alignSelf: 'center',
    backgroundColor: colors.primary,
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  emptyStateSubText: {
    fontSize: 14,
    color: colors.text,
    opacity: 0.7,
    textAlign: 'center',
    marginTop: 5,
  },
  profileButton: {
    marginRight: 15,
    padding: 5,
  },
});