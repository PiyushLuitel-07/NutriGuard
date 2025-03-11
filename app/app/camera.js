import { useState, useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image, Platform, StatusBar, ActivityIndicator, Alert } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Stack, router } from 'expo-router';
import { colors } from '../constants/theme';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { endpoints } from '../config/api';
import AuthCheck from '../components/AuthCheck';

const isWeb = Platform.OS === 'web';

export default function CameraPage() {
  const [permission, requestPermission] = useCameraPermissions();
  const [capturedImage, setCapturedImage] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const cameraRef = useRef(null);
  const [facing, setFacing] = useState('back');

  useEffect(() => {
    requestPermission();
  }, []);

  if (!permission) {
    return (
      <View style={styles.container}>
        <Text>Requesting camera permission...</Text>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <Text style={styles.message}>We need your permission to show the camera</Text>
        <TouchableOpacity style={styles.button} onPress={requestPermission}>
          <Text style={styles.text}>Grant Permission</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const takePicture = async () => {
    try {
      if (!cameraRef.current) return;

      const photo = await cameraRef.current.takePictureAsync({
        quality: 1,
        base64: true,
        exif: true,
        orientation: 'portrait',
        forceUpOrientation: true
      });

      setCapturedImage(photo.uri);
    } catch (error) {
      console.error('Error taking picture:', error);
      Alert.alert('Error', 'Failed to take picture');
    }
  };

  const handleSubmit = async () => {
    if (!capturedImage) return;

    try {
      setIsProcessing(true);
      const token = await AsyncStorage.getItem('userToken');

      let base64Image;
      if (isWeb) {
        // For web, the image is already in base64 format
        base64Image = capturedImage.split('base64,')[1];
      } else {
        // For mobile, we need to convert the URI to base64
        const response = await fetch(capturedImage);
        const blob = await response.blob();
        const reader = new FileReader();
        base64Image = await new Promise((resolve) => {
          reader.onloadend = () => {
            const base64data = reader.result;
            resolve(base64data.split('base64,')[1]);
          };
          reader.readAsDataURL(blob);
        });
      }

      const response = await fetch(endpoints.analyzeNutrition, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ image: base64Image })
      });

      const data = await response.json();

      if (data.status === 'error') {
        if (data.message === 'No nutrition label detected') {
          Alert.alert('Error', 'Could not detect Nutritional Label');
        } else if (data.message.includes('Gemini')) {
          Alert.alert('Error', 'Couldn\'t extract data');
        } else {
          Alert.alert('Error', data.message || 'Failed to process image');
        }
      } else {
        router.push({
          pathname: '/edit_nutrition',
          params: { nutritionData: JSON.stringify(data.nutrition_data) }
        });
      }
    } catch (error) {
      console.error('Error submitting image:', error);
      Alert.alert('Error', 'Failed to process image');
    } finally {
      setIsProcessing(false);
    }
  };

  const toggleCameraFacing = () => {
    setFacing(current => (current === 'back' ? 'front' : 'back'));
  };

  return (
    <AuthCheck>
      <View style={styles.container}>
        <Stack.Screen
          options={{
            headerTitle: 'Scan Nutrition Label',
            headerStyle: { backgroundColor: colors.primary },
            headerTintColor: '#fff',
          }}
        />
        <StatusBar barStyle="light-content" />
        
        {capturedImage ? (
          <View style={styles.preview}>
            <Image
              source={{ uri: capturedImage }}
              style={styles.previewImage}
              resizeMode="contain"
            />
            <View style={styles.buttonContainer}>
              <TouchableOpacity
                style={[styles.button, styles.retakeButton]}
                onPress={() => setCapturedImage(null)}
              >
                <Text style={styles.buttonText}>Retake</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.button, styles.submitButton]}
                onPress={handleSubmit}
                disabled={isProcessing}
              >
                {isProcessing ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.buttonText}>Submit</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <View style={styles.cameraContainer}>
            <CameraView
              ref={cameraRef}
              style={styles.camera}
              facing={facing}
            >
              <View style={styles.buttonContainer}>
                <TouchableOpacity
                  style={styles.flipButton}
                  onPress={toggleCameraFacing}
                >
                  <Ionicons name="camera-reverse" size={30} color="white" />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.captureButton}
                  onPress={takePicture}
                >
                  <View style={styles.captureCircle} />
                </TouchableOpacity>
              </View>
            </CameraView>
          </View>
        )}
      </View>
    </AuthCheck>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'black',
  },
  cameraContainer: {
    flex: 1,
  },
  camera: {
    flex: 1,
  },
  buttonContainer: {
    flex: 1,
    backgroundColor: 'transparent',
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'flex-end',
    marginBottom: 30,
  },
  flipButton: {
    alignSelf: 'flex-end',
    marginBottom: 20,
  },
  captureButton: {
    alignSelf: 'flex-end',
    marginBottom: 10,
  },
  captureCircle: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: 'white',
    borderWidth: 5,
    borderColor: 'rgba(255,255,255,0.5)',
  },
  preview: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  previewImage: {
    flex: 1,
  },
  button: {
    flex: 1,
    padding: 15,
    margin: 5,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  retakeButton: {
    backgroundColor: '#666',
  },
  submitButton: {
    backgroundColor: colors.primary,
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  message: {
    color: 'white',
    textAlign: 'center',
    marginBottom: 20,
  },
  text: {
    color: 'white',
    fontSize: 16,
  }
});