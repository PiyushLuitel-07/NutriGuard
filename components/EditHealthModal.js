import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from 'react-native';
import { colors } from '../constants/theme';

export default function EditHealthModal({ visible, onClose, onSave, initialData }) {
  const [bloodSugar, setBloodSugar] = useState('');
  const [medication, setMedication] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [bloodSugarError, setBloodSugarError] = useState('');

  useEffect(() => {
    if (initialData) {
      setBloodSugar(String(initialData.blood_sugar_level));
      setMedication(initialData.medication_details);
    }
  }, [initialData]);

  const handleSave = async () => {
    // Reset error state
    setBloodSugarError('');

    // Validate blood sugar input
    if (!bloodSugar || bloodSugar.trim() === '') {
      setBloodSugarError('Blood sugar level is required');
      return;
    }

    if (isNaN(parseFloat(bloodSugar))) {
      setBloodSugarError('Blood sugar level must be a valid number');
      return;
    }

    const updateData = {};
    
    // Only include fields that have been modified
    if (bloodSugar !== String(initialData.blood_sugar_level)) {
      updateData.blood_sugar_level = parseFloat(bloodSugar);
    }

    // Set medication as 'None' if empty
    if (medication !== initialData.medication_details) {
      updateData.medication_details = medication.trim() ? medication.trim() : 'None';
    }

    // Check if any changes were made
    if (Object.keys(updateData).length === 0) {
      onClose();
      return;
    }

    setIsLoading(true);
    await onSave(updateData);
    setIsLoading(false);
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>Edit Health Details</Text>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Blood Sugar Level (mg/dL)</Text>
            <TextInput
              style={[styles.input, bloodSugarError ? styles.inputError : null]}
              value={bloodSugar}
              onChangeText={(text) => {
                setBloodSugar(text);
                setBloodSugarError(''); // Clear error when user types
              }}
              keyboardType="numeric"
              placeholder="Enter blood sugar level"
            />
            {bloodSugarError ? (
              <Text style={styles.errorText}>{bloodSugarError}</Text>
            ) : null}
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Medications</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={medication}
              onChangeText={setMedication}
              placeholder="Enter medication details"
              multiline
              numberOfLines={4}
            />
          </View>

          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={[styles.button, styles.saveButton]}
              onPress={handleSave}
              disabled={isLoading}
            >
              <Text style={styles.saveButtonText}>
                {isLoading ? 'Saving...' : 'Save'}
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.button, styles.cancelButton]}
              onPress={onClose}
              disabled={isLoading}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: colors.white,
    borderRadius: 15,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.primary,
    marginBottom: 20,
    textAlign: 'center',
  },
  inputContainer: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    color: colors.text,
    marginBottom: 5,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: colors.text,
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
  },
  button: {
    flex: 1,
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginHorizontal: 5,
  },
  cancelButton: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  saveButton: {
    backgroundColor: colors.primary,
  },
  cancelButtonText: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '600',
  },
  saveButtonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '600',
  },
  inputError: {
    borderColor: colors.error,
  },
  errorText: {
    color: colors.error,
    fontSize: 12,
    marginTop: 5,
  },
});