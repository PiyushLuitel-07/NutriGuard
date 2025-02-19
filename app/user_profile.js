import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { Stack, router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors } from '../constants/theme';
import { endpoints } from '../config/api';
import { Ionicons } from '@expo/vector-icons';
import AuthCheck from '../components/AuthCheck';
import EditHealthModal from '../components/EditHealthModal';

export default function UserProfilePage() {
  const [userDetails, setUserDetails] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditModalVisible, setIsEditModalVisible] = useState(false);

  useEffect(() => {
    fetchUserDetails();
  }, []);

  const fetchUserDetails = async () => {
    try {
      const token = await AsyncStorage.getItem('userToken');
      const response = await fetch(endpoints.getUserDetails, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to fetch user details');
      
      setUserDetails(data.user);
    } catch (error) {
      console.error('Error fetching user details:', error);
      Alert.alert('Error', 'Failed to load user details');
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateHealth = async (updateData) => {
    try {
      const token = await AsyncStorage.getItem('userToken');
      const response = await fetch(endpoints.updateHealth, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updateData),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to update health details');

      // Update local state with new data
      setUserDetails(prevDetails => ({
        ...prevDetails,
        ...updateData
      }));

      // Close modal and show success message
      setIsEditModalVisible(false);
      Alert.alert('Success', 'Health details updated successfully');
    } catch (error) {
      console.error('Error updating health details:', error);
      Alert.alert('Error', 'Failed to update health details');
    }
  };

  const handleLogout = async () => {
    try {
      const token = await AsyncStorage.getItem('userToken');
      const response = await fetch(endpoints.logout, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      // Clear token regardless of response
      await AsyncStorage.removeItem('userToken');
      router.replace('/');
    } catch (error) {
      console.error('Logout error:', error);
      // Clear token and redirect even if there's an error
      await AsyncStorage.removeItem('userToken');
      router.replace('/');
    }
  };

  return (
    <AuthCheck>
      <Stack.Screen
        options={{
          title: "Profile",
          headerStyle: {
            backgroundColor: colors.background,
          },
          headerTitleStyle: {
            color: colors.primary,
          },
        }}
      />

      <View style={styles.container}>
        {isLoading ? (
          <Text style={styles.loadingText}>Loading...</Text>
        ) : userDetails ? (
          <>
            <View style={styles.infoSection}>
              <Text style={styles.label}>Name</Text>
              <Text style={styles.value}>{userDetails.full_name}</Text>
            </View>

            <View style={styles.infoSection}>
              <Text style={styles.label}>Blood Sugar Level</Text>
              <Text style={styles.value}>{userDetails.blood_sugar_level} mg/dL</Text>
            </View>

            <View style={styles.infoSection}>
              <Text style={styles.label}>Medications</Text>
              <Text style={styles.value}>{userDetails.medication_details}</Text>
            </View>

            <TouchableOpacity 
              style={styles.editButton}
              onPress={() => setIsEditModalVisible(true)}
            >
              <Text style={styles.editButtonText}>Edit Details</Text>
            </TouchableOpacity>

            <View style={styles.navButtonsContainer}>
              <TouchableOpacity 
                style={[styles.navButton, styles.dashboardButton]}
                onPress={() => router.push('/dashboard')}
              >
                <Text style={[styles.navButtonText, styles.dashboardButtonText]}>Go Back to Dashboard</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={[styles.navButton, styles.logoutButton]}
                onPress={handleLogout}
              >
                <Text style={styles.navButtonText}>Logout</Text>
              </TouchableOpacity>
            </View>
          </>
        ) : (
          <Text style={styles.errorText}>Failed to load user details</Text>
        )}
      </View>

      <EditHealthModal
        visible={isEditModalVisible}
        onClose={() => setIsEditModalVisible(false)}
        onSave={handleUpdateHealth}
        initialData={userDetails}
      />
    </AuthCheck>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    padding: 20,
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
  infoSection: {
    backgroundColor: colors.white,
    padding: 20,
    borderRadius: 10,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  label: {
    fontSize: 14,
    color: colors.text,
    marginBottom: 5,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  value: {
    fontSize: 18,
    color: colors.primary,
    fontWeight: '600',
  },
  editButton: {
    backgroundColor: colors.primary,
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 20,
  },
  editButtonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '600',
  },
  navButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 15,
    gap: 10,
  },
  navButton: {
    flex: 1,
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
  },
  dashboardButton: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  logoutButton: {
    backgroundColor: colors.error,
  },
  navButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.white,
  },
  dashboardButtonText: {
    color: colors.text, // This will use the dark text color instead of white
  },
});