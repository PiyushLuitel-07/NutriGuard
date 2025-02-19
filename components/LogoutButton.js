import { TouchableOpacity, Text, StyleSheet, Modal, View } from 'react-native';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { endpoints } from '../config/api';
import { colors } from '../constants/theme';
import { useState } from 'react';

export default function LogoutButton() {
  const [showModal, setShowModal] = useState(false);

  const handleLogout = async () => {
    console.log('Logout button pressed');
    setShowModal(true);
  };

  const handleConfirmLogout = async () => {
    console.log('Logout confirmed');
    try {
      const token = await AsyncStorage.getItem('userToken');
      console.log('Retrieved token:', token);

      if (!token) {
        console.log('No token found, proceeding with local logout');
        await AsyncStorage.removeItem('userToken');
        router.replace('/');
        return;
      }

      console.log('Making logout request to:', endpoints.logout);
      const response = await fetch(endpoints.logout, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      console.log('Logout response status:', response.status);
      await AsyncStorage.removeItem('userToken');
      router.replace('/');

      if (!response.ok) {
        console.error('Server logout failed:', await response.text());
      }
    } catch (error) {
      console.error('Logout error:', error);
      await AsyncStorage.removeItem('userToken');
      router.replace('/');
    }
    setShowModal(false);
  };

  return (
    <>
      <TouchableOpacity 
        style={styles.logoutButton} 
        onPress={handleLogout}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <Text style={styles.logoutText}>Logout</Text>
      </TouchableOpacity>

      <Modal
        animationType="fade"
        transparent={true}
        visible={showModal}
        onRequestClose={() => setShowModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Confirm Logout</Text>
            <Text style={styles.modalMessage}>Are you sure you want to logout?</Text>
            <View style={styles.modalButtons}>
              <TouchableOpacity 
                style={[styles.modalButton, styles.cancelButton]} 
                onPress={() => setShowModal(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.modalButton, styles.confirmButton]}
                onPress={handleConfirmLogout}
              >
                <Text style={styles.confirmButtonText}>Logout</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  logoutButton: {
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 5,
    backgroundColor: colors.primary,
  },
  logoutText: {
    color: colors.white,
    fontSize: 12,
    fontWeight: '600',
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
    maxWidth: 300,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#000',
  },
  modalMessage: {
    fontSize: 16,
    marginBottom: 20,
    color: '#333',
    textAlign: 'center',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
  },
  modalButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    minWidth: 100,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#f0f0f0',
    marginRight: 10,
  },
  confirmButton: {
    backgroundColor: colors.primary || '#007AFF',
  },
  cancelButtonText: {
    color: '#333',
    fontSize: 16,
    fontWeight: '600',
  },
  confirmButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});