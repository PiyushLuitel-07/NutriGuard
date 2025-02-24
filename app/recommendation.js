import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity } from 'react-native';
import { Stack, router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors } from '../constants/theme';
import { endpoints } from '../config/api';
import AuthCheck from '../components/AuthCheck';

export default function RecommendationPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [todayGlycemic, setTodayGlycemic] = useState(null);
  const [scannedGlycemic, setScannedGlycemic] = useState(null);
  const [recommendation, setRecommendation] = useState('');

  useEffect(() => {
    fetchTodayGlycemic();
  }, []);

  useEffect(() => {
    const loadData = async () => {
      try {
        setIsLoading(true);
        const todayData = await fetchTodayGlycemic();
        console.log('Today\'s glycemic data:', todayData);
        
        const scannedData = await loadScannedFoodData();
        console.log('Scanned food data:', scannedData);

        if (todayData && scannedData) {
          console.log('Both data available, getting recommendation...');
          await getRecommendation({
            glycemic_index: todayData.glycemic_index,
            glycemic_load: todayData.glycemic_load
          }, {
            glycemic_index: scannedData.glycemic_index,
            glycemic_load: scannedData.glycemic_load
          });
        } else {
          console.log('Missing required data for recommendation');
          setRecommendation('Please scan a food item to get a recommendation.');
        }
      } catch (error) {
        console.error('Error in loadData:', error);
        setError('Failed to load recommendation data');
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, []);

  const fetchTodayGlycemic = async () => {
    try {
      const token = await AsyncStorage.getItem('userToken');
      const response = await fetch(endpoints.getTodayGlycemic, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to fetch glycemic data');
      
      setTodayGlycemic(data);
      return data;
    } catch (error) {
      console.error('Error fetching glycemic data:', error);
      setError('Failed to fetch glycemic data');
      setTodayGlycemic(null);
      return null;
    }
  };

  const loadScannedFoodData = async () => {
    try {
      const savedData = await AsyncStorage.getItem('scannedFoodData');
      if (savedData) {
        const parsedData = JSON.parse(savedData);
        const scannedData = {
          glycemic_index: parsedData.glycemic_index,
          glycemic_load: parsedData.glycemic_load
        };
        setScannedGlycemic(scannedData);
        await AsyncStorage.removeItem('scannedFoodData');
        return scannedData;
      }
      return null;
    } catch (error) {
      console.error('Error loading scanned food data:', error);
      return null;
    }
  };

  const getRecommendation = async (todayGlycemic, scannedGlycemic) => {
    try {
      console.log('Sending recommendation request with:', {
        today_glycemic: todayGlycemic,
        scanned_glycemic: scannedGlycemic
      });

      const token = await AsyncStorage.getItem('userToken');
      const response = await fetch(endpoints.getRecommendation, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          today_glycemic: todayGlycemic,
          scanned_glycemic: scannedGlycemic
        }),
      });

      console.log('Recommendation response status:', response.status);
      const data = await response.json();
      console.log('Recommendation response data:', data);

      if (!response.ok) throw new Error(data.error || 'Failed to get recommendation');
      
      if (data && data.recommendation) {
        setRecommendation(data.recommendation);
        setError(null);
      } else {
        throw new Error('No recommendation received from server');
      }
    } catch (error) {
      console.error('Error getting recommendation:', error);
      setError('Failed to get recommendation');
      setRecommendation('Unable to generate recommendation at this time.');
    }
  };

  return (
    <AuthCheck>
      <Stack.Screen
        options={{
          title: "Recommendations",
          headerStyle: {
            backgroundColor: colors.background,
          },
          headerTitleStyle: {
            color: colors.primary,
          },
        }}
      />
      
      <ScrollView style={styles.container}>
        {isLoading ? (
          <ActivityIndicator size="large" color={colors.primary} />
        ) : error ? (
          <Text style={styles.errorText}>{error}</Text>
        ) : (
          <>
            {/* Today's Glycemic Values Section */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Today's Meal Analysis</Text>
              <View style={styles.glycemicContainer}>
                <View style={styles.glycemicRow}>
                  <View style={styles.glycemicCell}>
                    <Text style={styles.glycemicLabel}>Glycemic Index</Text>
                    <Text style={styles.glycemicValue}>
                      {todayGlycemic?.glycemic_index 
                        ? Math.round(todayGlycemic.glycemic_index) 
                        : '--'}
                    </Text>
                  </View>
                  <View style={styles.glycemicCell}>
                    <Text style={styles.glycemicLabel}>Glycemic Load</Text>
                    <Text style={styles.glycemicValue}>
                      {todayGlycemic?.glycemic_load 
                        ? Math.round(todayGlycemic.glycemic_load) 
                        : '--'}
                    </Text>
                  </View>
                </View>
              </View>
            </View>

            {/* Scanned Food Glycemic Values Section */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Scanned Food Analysis</Text>
              <View style={styles.glycemicContainer}>
                <View style={styles.glycemicRow}>
                  <View style={styles.glycemicCell}>
                    <Text style={styles.glycemicLabel}>Glycemic Index</Text>
                    <Text style={styles.glycemicValue}>
                      {scannedGlycemic?.glycemic_index 
                        ? Math.round(scannedGlycemic.glycemic_index) 
                        : '--'}
                    </Text>
                  </View>
                  <View style={styles.glycemicCell}>
                    <Text style={styles.glycemicLabel}>Glycemic Load</Text>
                    <Text style={styles.glycemicValue}>
                      {scannedGlycemic?.glycemic_load 
                        ? Math.round(scannedGlycemic.glycemic_load) 
                        : '--'}
                    </Text>
                  </View>
                </View>
              </View>
            </View>

            {/* Recommendation Section */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Recommendations</Text>
              <View style={styles.recommendationContainer}>
                <Text style={styles.recommendationText}>
                  {recommendation || 'No recommendations available yet.'}
                </Text>
              </View>
            </View>

            {/* Add the back button */}
            <TouchableOpacity 
              style={styles.backButton}
              onPress={() => router.push('/dashboard')}
            >
              <Text style={styles.backButtonText}>Go Back to Dashboard</Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </AuthCheck>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    padding: 20,
  },
  section: {
    marginBottom: 25,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.primary,
    marginBottom: 15,
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
    fontWeight: '600',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  glycemicValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.primary,
  },
  recommendationContainer: {
    backgroundColor: colors.white,
    padding: 20,
    borderRadius: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  recommendationText: {
    fontSize: 16,
    color: colors.text,
    lineHeight: 24,
  },
  errorText: {
    fontSize: 16,
    color: colors.error,
    textAlign: 'center',
    marginTop: 20,
  },
  backButton: {
    backgroundColor: colors.primary,
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 30,
  },
  backButtonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '600',
  },
});