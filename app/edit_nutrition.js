import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { Stack, useLocalSearchParams, router } from 'expo-router';
import { Picker } from '@react-native-picker/picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors } from '../constants/theme';
import { endpoints } from '../config/api';

export default function EditNutrition() {
  // Update how we get params
  const { nutritionData: nutritionDataParam } = useLocalSearchParams();
  const [servingUnit, setServingUnit] = useState('g');
  
  // Initialize state with parsed data from params
  const [nutritionData, setNutritionData] = useState({
    serving_size: '',
    serving_unit: 'g',
    nutrients: {
      Energy: { unit: 'kcal', per_serve: 0, per_100g: 0 },
      Protein: { unit: 'g', per_serve: 0, per_100g: 0 },
      Carbohydrates: { unit: 'g', per_serve: 0, per_100g: 0 },
      Fat: { unit: 'g', per_serve: 0, per_100g: 0 },
      Sodium: { unit: 'mg', per_serve: 0, per_100g: 0 },
      Potassium: { unit: 'mg', per_serve: 0, per_100g: 0 },
      Magnesium: { unit: 'mg', per_serve: 0, per_100g: 0 },
      Calcium: { unit: 'mg', per_serve: 0, per_100g: 0 },
      Fiber: { unit: 'g', per_serve: 0, per_100g: 0 }
    }
  });

  const [servingInput, setServingInput] = useState('');
  const [hasNullPerServe, setHasNullPerServe] = useState(false);
  const [hasNullPer100g, setHasNullPer100g] = useState(false);

  // Add function to check for null values
  const checkNullValues = (nutrients) => {
    let nullInPerServe = false;
    let nullInPer100g = false;

    Object.values(nutrients).forEach(nutrient => {
      if (nutrient.per_serve === null) nullInPerServe = true;
      if (nutrient.per_100g === null) nullInPer100g = true;
    });

    setHasNullPerServe(nullInPerServe);
    setHasNullPer100g(nullInPer100g);
  };

  useEffect(() => {
    if (nutritionDataParam) {
      try {
        const parsedData = JSON.parse(nutritionDataParam);
        console.log('Received nutrition data:', parsedData);
        setNutritionData(parsedData);
        checkNullValues(parsedData.nutrients);
      } catch (error) {
        console.error('Error parsing nutrition data:', error);
      }
    }
  }, [nutritionDataParam]);

  const handleConfirm = async () => {
    try {
      const token = await AsyncStorage.getItem('userToken');
      
      // Validate serving size input
      if (!servingInput || isNaN(servingInput) || parseFloat(servingInput) <= 0) {
        Alert.alert('Error', 'Please enter a valid serving size');
        return;
      }
  
      const response = await fetch(endpoints.analyzeScannedFood, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          serving_size: parseFloat(servingInput),
          serving_unit: servingUnit,
          nutrients: nutritionData.nutrients
        })
      });
  
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to analyze food');
      }
  
      // Store the scanned food data
      await AsyncStorage.setItem('scannedFoodData', JSON.stringify(data));
  
      // Navigate to recommendations page
      router.push('/recommendation');
  
    } catch (error) {
      console.error('Error confirming nutrition data:', error);
      Alert.alert('Error', 'Failed to process nutrition data');
    }
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: "Verify Nutrition Information",
          headerStyle: {
            backgroundColor: colors.background,
          },
          headerTitleStyle: {
            color: colors.primary,
          },
        }}
      />
      <ScrollView style={styles.container}>
        {/* Display scanned serving size */}
        <View style={styles.section}>
          <Text style={styles.label}>Scanned Serving Size</Text>
          <Text style={styles.scannedValue}>{nutritionData.serving_size}</Text>
        </View>

        {/* Display nutrition information */}
        {Object.entries(nutritionData.nutrients).map(([nutrient, values]) => (
          <View key={nutrient} style={styles.nutrientSection}>
            <Text style={styles.nutrientLabel}>{nutrient}</Text>
            <View style={styles.row}>
              <View style={styles.column}>
                <Text style={styles.sublabel}>Per Serve</Text>
                <TextInput
                  style={[styles.valueInput, values.per_serve === null && styles.nullValue]}
                  value={values.per_serve !== null ? String(values.per_serve) : ''}
                  onChangeText={(text) => {
                    const newNutrients = { ...nutritionData.nutrients };
                    newNutrients[nutrient] = {
                      ...values,
                      per_serve: text === '' ? null : parseFloat(text)
                    };
                    setNutritionData({
                      ...nutritionData,
                      nutrients: newNutrients
                    });
                  }}
                  keyboardType="numeric"
                  placeholder={values.per_serve === null ? '--' : undefined}
                />
              </View>
              <View style={styles.column}>
                <Text style={styles.sublabel}>Per 100g</Text>
                <TextInput
                  style={[styles.valueInput, values.per_100g === null && styles.nullValue]}
                  value={values.per_100g !== null ? String(values.per_100g) : ''}
                  onChangeText={(text) => {
                    const newNutrients = { ...nutritionData.nutrients };
                    newNutrients[nutrient] = {
                      ...values,
                      per_100g: text === '' ? null : parseFloat(text)
                    };
                    setNutritionData({
                      ...nutritionData,
                      nutrients: newNutrients
                    });
                  }}
                  keyboardType="numeric"
                  placeholder={values.per_100g === null ? '--' : undefined}
                />
              </View>
              <Text style={styles.unit}>{values.unit}</Text>
            </View>
          </View>
        ))}

        {/* Enter your serving size section */}
        <View style={styles.section}>
          <Text style={styles.label}>Enter your serving size</Text>
          <View style={styles.servingContainer}>
            <TextInput
              style={[styles.input, styles.servingInput]}
              value={servingInput}
              onChangeText={setServingInput}
              keyboardType="numeric"
              placeholder="Enter amount"
            />
            <View style={styles.pickerContainer}>
              <Picker
                selectedValue={servingUnit}
                style={styles.picker}
                onValueChange={(itemValue) => setServingUnit(itemValue)}
                enabled={!(hasNullPerServe && hasNullPer100g)} // Disable if both have nulls
              >
                <Picker.Item 
                  label="grams" 
                  value="g" 
                  enabled={!hasNullPer100g}
                />
                <Picker.Item 
                  label="serving" 
                  value="serving" 
                  enabled={!hasNullPerServe}
                />
              </Picker>
            </View>
          </View>
        </View>

        <TouchableOpacity style={styles.confirmButton} onPress={handleConfirm}>
          <Text style={styles.confirmButtonText}>Confirm</Text>
        </TouchableOpacity>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    padding: 20,
  },
  section: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 8,
  },
  input: {
    backgroundColor: colors.white,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    fontSize: 16,
  },
  nutrientSection: {
    marginBottom: 20,
  },
  nutrientLabel: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.primary,
    marginBottom: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  column: {
    flex: 1,
  },
  sublabel: {
    fontSize: 14,
    color: colors.text,
    marginBottom: 4,
  },
  unit: {
    fontSize: 16,
    color: colors.text,
    width: 40,
    textAlign: 'center',
  },
  confirmButton: {
    backgroundColor: colors.primary,
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginVertical: 20,
  },
  confirmButtonText: {
    color: colors.white,
    fontSize: 18,
    fontWeight: '600',
  },
  servingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  servingInput: {
    flex: 1,
  },
  pickerContainer: {
    backgroundColor: colors.white,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    width: 120,
  },
  picker: {
    height: 50,
    width: '100%',
  },
  scannedValue: {
    fontSize: 16,
    color: colors.text,
  },
  value: {
    fontSize: 16,
    color: colors.text,
  },
  nullValue: {
    color: colors.error,
  },
  valueInput: {
    backgroundColor: colors.white,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    fontSize: 16,
    textAlign: 'center',
    flex: 1,
    minWidth: 80,
  },
  nullValue: {
    borderColor: colors.error,
    backgroundColor: colors.background,
  }
});