import { useState } from 'react';
import { 
  View, Text, StyleSheet, TouchableOpacity, TextInput, ScrollView, Modal 
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { Stack, router } from 'expo-router';  // Add Stack here
import { colors } from '../constants/theme';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { endpoints } from '../config/api';
import LogoutButton from '../components/LogoutButton';
import AuthCheck from '../components/AuthCheck';

const MEAL_TYPES = ['Breakfast', 'Lunch', 'Dinner', 'Snack'];
const UNITS = ['servings', 'ml', 'grams', 'pieces', 'bowl', 'cup'];

export default function MealLoggingPage() {
  const [mealSections, setMealSections] = useState([{
    type: '',
    items: [{ name: '', quantity: '', unit: 'servings' }]
  }]);
  const [isLoading, setIsLoading] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);

  const usedMealTypes = mealSections.map(section => section.type);
  const availableMealTypes = MEAL_TYPES.filter(type => !usedMealTypes.includes(type));

  const addFoodItem = (sectionIndex) => {
    setMealSections(prev => {
      const updated = [...prev];
      updated[sectionIndex].items.push({ name: '', quantity: '', unit: 'servings' });
      return updated;
    });
  };

  const updateFoodItem = (sectionIndex, itemIndex, field, value) => {
    setMealSections(prev => {
      const updated = [...prev];
      updated[sectionIndex].items[itemIndex] = {
        ...updated[sectionIndex].items[itemIndex],
        [field]: value
      };
      return updated;
    });
  };

  const removeFoodItem = (sectionIndex, itemIndex) => {
    setMealSections(prev => {
      const updated = [...prev];
      updated[sectionIndex].items = updated[sectionIndex].items.filter((_, i) => i !== itemIndex);
      return updated;
    });
  };

  const addMealType = () => {
    if (mealSections.length < 4) {
      setMealSections(prev => [...prev, {
        type: '',
        items: [{ name: '', quantity: '', unit: 'servings' }]
      }]);
    }
  };

  const validateMeals = () => {
    for (const section of mealSections) {
      if (!section.type) {
        alert('Please select all meal types');
        return false;
      }
      if (!section.items.some(item => item.name && item.quantity)) {
        alert(`Please add at least one food item for ${section.type}`);
        return false;
      }
    }
    return true;
  };

  const handleSubmit = async () => {
    if (!validateMeals()) return;

    setIsLoading(true);
    try {
      const token = await AsyncStorage.getItem('userToken');
      const response = await fetch(endpoints.meals, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          meals: mealSections.map(section => ({
            meal_type: section.type,
            food_items: section.items.filter(item => item.name && item.quantity),
            date: new Date().toISOString().split('T')[0],
            time: new Date().toTimeString().split(' ')[0],
          }))
        }),
      });

      const data = await response.json();
      if (response.ok) {
        setShowConfirmation(true);
      } else {
        throw new Error(data.error || 'Failed to log meals');
      }
    } catch (error) {
      alert(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleModalClose = () => {
    setShowConfirmation(false);
    // Call the parent's refresh function before navigating back
    router.replace('/dashboard');  // Use replace instead of back to force a refresh
  };

  return (
    <AuthCheck>
      <>
        <Stack.Screen
          options={{
            title: "Log Meals",
            headerStyle: {
              backgroundColor: colors.background,
            },
            headerShadowVisible: false,
          }}
        />
        <ScrollView style={styles.container}>
          <Text style={styles.title}>Log Your Meals</Text>

          {mealSections.map((section, sectionIndex) => (
            <View key={sectionIndex} style={styles.mealSection}>
              <Text style={styles.sectionTitle}>
                {section.type || `Meal ${sectionIndex + 1}`}
              </Text>
              
              <View style={styles.pickerContainer}>
                <Picker
                  selectedValue={section.type}
                  onValueChange={(value) => {
                    const updated = [...mealSections];
                    updated[sectionIndex].type = value;
                    setMealSections(updated);
                  }}
                  style={styles.picker}
                >
                  <Picker.Item 
                    label="Select meal type" 
                    value="" 
                    style={styles.pickerItem}
                  />
                  {[...availableMealTypes, section.type].map(type => (
                    <Picker.Item 
                      key={type} 
                      label={type} 
                      value={type} 
                      style={styles.pickerItem}
                    />
                  ))}
                </Picker>
              </View>

              {section.items.map((item, itemIndex) => (
                <View key={itemIndex} style={styles.foodItemContainer}>
                  <TextInput
                    style={styles.input}
                    placeholder="Food item name"
                    value={item.name}
                    onChangeText={(value) => updateFoodItem(sectionIndex, itemIndex, 'name', value)}
                  />
                  <View style={styles.quantityContainer}>
                    <TextInput
                      style={[styles.input, styles.quantityInput]}
                      placeholder="Qty"
                      value={item.quantity}
                      keyboardType="decimal-pad"  // Changed from "numeric" to "decimal-pad"
                      onChangeText={(value) => {
                        // Only allow numbers and one decimal point
                        if (/^\d*\.?\d*$/.test(value)) {
                          updateFoodItem(sectionIndex, itemIndex, 'quantity', value);
                        }
                      }}
                    />
                    <Picker
                      selectedValue={item.unit}
                      onValueChange={(value) => updateFoodItem(sectionIndex, itemIndex, 'unit', value)}
                      style={styles.picker}
                    >
                      {UNITS.map(unit => (
                        <Picker.Item 
                          key={unit} 
                          label={unit} 
                          value={unit} 
                          style={styles.pickerItem}
                        />
                      ))}
                    </Picker>
                  </View>
                  {itemIndex > 0 && (
                    <TouchableOpacity
                      style={styles.removeButton}
                      onPress={() => removeFoodItem(sectionIndex, itemIndex)}
                    >
                      <Text style={styles.removeButtonText}>Remove Item</Text>
                    </TouchableOpacity>
                  )}
                </View>
              ))}

              <TouchableOpacity 
                style={styles.addItemButton} 
                onPress={() => addFoodItem(sectionIndex)}
              >
                <Text style={styles.addItemButtonText}>+ Add Food Item</Text>
              </TouchableOpacity>
            </View>
          ))}

          <View style={styles.buttonContainer}>
            {mealSections.length < 4 && (
              <TouchableOpacity 
                style={styles.addMealButton} 
                onPress={addMealType}
              >
                <Text style={styles.addMealButtonText}>+ Add Another Meal Type</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity 
              style={[styles.submitButton, isLoading && styles.buttonDisabled]} 
              onPress={handleSubmit}
              disabled={isLoading}
            >
              <Text style={styles.submitButtonText}>
                {isLoading ? 'Saving...' : 'Save'}
              </Text>
            </TouchableOpacity>
          </View>

          <Modal
            visible={showConfirmation}
            transparent
            animationType="fade"
          >
            <View style={styles.modalOverlay}>
              <View style={styles.modalContent}>
                <Text style={styles.modalTitle}>Meals Logged Successfully</Text>
                <ScrollView style={styles.modalScroll}>
                  {mealSections.map((meal, index) => (
                    <View key={index} style={styles.mealSummary}>
                      <Text style={styles.mealType}>{meal.type}</Text>
                      {meal.items.map((item, itemIndex) => (
                        <Text key={itemIndex} style={styles.foodItem}>
                          • {item.quantity} {item.unit} of {item.name}
                        </Text>
                      ))}
                    </View>
                  ))}
                </ScrollView>
                <TouchableOpacity
                  style={styles.modalButton}
                  onPress={handleModalClose}
                >
                  <Text style={styles.modalButtonText}>OK</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Modal>
        </ScrollView>
      </>
    </AuthCheck>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.primary,
    marginTop: 60,
    marginBottom: 20,
    paddingHorizontal: 20,
  },
  form: {
    padding: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.text,
    marginBottom: 8,
  },
  pickerContainer: {
    backgroundColor: colors.white,
    borderRadius: 10,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: colors.border,
  },
  picker: {
    flex: 0.7, // Add this to give more space to the picker
    height: 50,
    fontFamily: 'System',  // or your app's default font
    fontSize: 16,
    color: colors.text,
  },
  pickerItem: {
    fontFamily: 'System',  // or your app's default font
    fontSize: 16,
  },
  foodItemContainer: {
    marginBottom: 15,
  },
  input: {
    backgroundColor: colors.white,
    padding: 15,
    borderRadius: 10,
    fontSize: 16,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 10,
  },
  quantityContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between', // Add this to better distribute space
  },
  quantityInput: {
    flex: 0.3, // Reduce this from 1 to make it smaller
    marginRight: 10,
  },
  unitPicker: {
    flex: 2,
    height: 50,
  },
  removeButton: {
    padding: 8,
    alignItems: 'center',
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.error,
    borderRadius: 6,
    marginTop: 5,
    width: '100%',
  },
  removeButtonText: {
    color: colors.error,
    fontSize: 14,
    fontWeight: '500',
  },
  addButton: {
    padding: 15,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.primary,
    alignItems: 'center',
    marginVertical: 10,
  },
  addButtonText: {
    color: colors.primary,
    fontSize: 16,
  },
  submitButton: {
    backgroundColor: colors.primary,
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 20,
  },
  submitButtonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '600',
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: colors.white,
    borderRadius: 15,
    padding: 20,
    width: '80%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 15,
    textAlign: 'center',
  },
  mealSummary: {
    marginVertical: 15,
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
  modalButton: {
    backgroundColor: colors.primary,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 15,
  },
  modalButtonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '600',
  },
  loggedMealsContainer: {
    padding: 20,
    backgroundColor: colors.background,
    borderRadius: 10,
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.primary,
    marginBottom: 15,
  },
  loggedMeal: {
    marginBottom: 15,
    padding: 10,
    backgroundColor: colors.white,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  loggedMealType: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.primary,
    marginBottom: 5,
  },
  loggedFoodItem: {
    fontSize: 14,
    color: colors.text,
    marginLeft: 10,
  },
  buttonContainer: {
    padding: 20,
    paddingTop: 0,
  },
  button: {
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
  },
  modalScroll: {
    maxHeight: 400,
  },
  mealSection: {
    backgroundColor: colors.white,
    borderRadius: 15,
    padding: 15,
    marginHorizontal: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  addItemButton: {
    padding: 10,
    alignItems: 'center',
    borderStyle: 'dashed',
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: 8,
    marginTop: 10,
  },
  addItemButtonText: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '500',
  },
  addMealButton: {
    backgroundColor: colors.white,
    padding: 15,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: colors.primary,
    alignItems: 'center',
    marginBottom: 10,
  },
  addMealButtonText: {
    color: colors.primary,
    fontSize: 16,
    fontWeight: '600',
  },
});