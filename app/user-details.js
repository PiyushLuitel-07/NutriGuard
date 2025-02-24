import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Alert, ScrollView } from 'react-native';
import { router } from 'expo-router';
import { colors } from '../constants/theme';
import { endpoints } from '../config/api';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function UserDetailsPage() {
  const [fullName, setFullName] = useState('');
  const [bloodSugar, setBloodSugar] = useState('');
  const [medication, setMedication] = useState('');
  const [isLoading, setIsLoading] = useState(false);

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

      // If response is 404, it means user details don't exist yet (first-time user)
      if (response.status === 404) {
        // Silently return for first-time users
        return;
      }

      if (!response.ok) {
        throw new Error('Failed to fetch user details');
      }

      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        throw new Error('Invalid response format');
      }

      const data = await response.json();
      if (data.user) {
        setFullName(data.user.full_name || '');
        setBloodSugar(data.user.blood_sugar_level?.toString() || '');
        setMedication(data.user.medication_details || '');
      }
    } catch (error) {
      console.error('Error fetching user details:', error);
      // Only show alert for non-404 errors
      if (error.message !== 'Failed to fetch user details') {
        Alert.alert('Error', 'Failed to load user details');
      }
    }
  };

  const handleSubmit = async () => {
    // Basic validation
    if (!fullName.trim()) {
      Alert.alert('Error', 'Please enter your full name');
      return;
    }

    if (!bloodSugar.trim()) {
      Alert.alert('Error', 'Please enter your blood sugar level');
      return;
    }

    const bloodSugarValue = parseFloat(bloodSugar);
    if (isNaN(bloodSugarValue) || bloodSugarValue <= 0) {
      Alert.alert('Error', 'Please enter a valid blood sugar level');
      return;
    }

    setIsLoading(true);
    try {
      const token = await AsyncStorage.getItem('userToken');
      if (!token) {
        router.replace('/login');
        return;
      }

      const response = await fetch(endpoints.updateUserDetails, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          full_name: fullName.trim(),
          blood_sugar_level: bloodSugarValue,
          medication_details: medication.trim() || 'No medications',
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save details');
      }

      // If successful, navigate to welcome page
      router.replace('/welcome');
      
    } catch (error) {
      console.error('Error saving user details:', error);
      Alert.alert('Error', 'Failed to save details. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Additional Details</Text>
      <Text style={styles.subtitle}>Please provide some information to help us personalize your experience</Text>
      
      <View style={styles.form}>
        <View style={styles.inputContainer}>
          <Text style={styles.label}>Full Name</Text>
          <TextInput
            style={styles.input}
            value={fullName}
            onChangeText={setFullName}
            placeholder="Enter your full name"
            editable={!isLoading}
          />
        </View>

        <View style={styles.inputContainer}>
          <Text style={styles.label}>Blood Sugar Level (mg/dL)</Text>
          <TextInput
            style={styles.input}
            value={bloodSugar}
            onChangeText={setBloodSugar}
            placeholder="Enter your blood sugar level in mg/dL"
            keyboardType="numeric"
            editable={!isLoading}
          />
        </View>

        <View style={styles.inputContainer}>
          <Text style={styles.label}>Medication Details</Text>
          <Text style={styles.sublabel}>If you are taking any medications, please list them here</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={medication}
            onChangeText={setMedication}
            placeholder="Enter your current medications (if any)"
            multiline
            numberOfLines={4}
            editable={!isLoading}
          />
        </View>

        <TouchableOpacity 
          style={[styles.button, isLoading && styles.buttonDisabled]} 
          onPress={handleSubmit}
          disabled={isLoading}
        >
          <Text style={styles.buttonText}>
            {isLoading ? 'Saving...' : 'Continue'}
          </Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: colors.primary,
    marginTop: 60,
    marginHorizontal: 20,
  },
  subtitle: {
    fontSize: 16,
    color: colors.text,
    marginTop: 10,
    marginHorizontal: 20,
    marginBottom: 30,
  },
  form: {
    padding: 20,
    gap: 20,
  },
  inputContainer: {
    gap: 8,
  },
  label: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.text,
  },
  input: {
    backgroundColor: colors.white,
    padding: 15,
    borderRadius: 10,
    fontSize: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  button: {
    backgroundColor: colors.primary,
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 10,
  },
  buttonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '600',
  },
  buttonDisabled: {
    backgroundColor: colors.disabled,
    opacity: 0.7,
  },
  sublabel: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 5,
  }
});
