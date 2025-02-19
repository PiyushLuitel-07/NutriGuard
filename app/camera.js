import { useState, useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image, StatusBar, ActivityIndicator, Alert } from 'react-native';
import { Stack, router } from 'expo-router';
import { colors } from '../constants/theme';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { endpoints } from '../config/api';

// Check if we're running in a web browser
const isWeb = typeof document !== 'undefined';

export default function CameraPage() {
  const [hasPermission, setHasPermission] = useState(null);
  const [stream, setStream] = useState(null);
  const [capturedImage, setCapturedImage] = useState(null);
  const [facingMode, setFacingMode] = useState('environment');
  const [isProcessing, setIsProcessing] = useState(false);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  useEffect(() => {
    if (isWeb) {
      requestCameraPermission();
    } else {
      setHasPermission(false);
    }
  }, []);

  const requestCameraPermission = async () => {
    try {
      const result = await navigator.mediaDevices.getUserMedia({
        video: { 
          facingMode,
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        },
        audio: false,
      });
      setStream(result);
      setHasPermission(true);
      if (videoRef.current) {
        videoRef.current.srcObject = result;
      }
    } catch (err) {
      console.error("Error accessing camera:", err);
      setHasPermission(false);
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
  };

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stream]);

  const takePicture = async () => {
    try {
      if (!videoRef.current || !canvasRef.current) return;

      const video = videoRef.current;
      const canvas = canvasRef.current;
      
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      
      const context = canvas.getContext('2d');
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      
      // Get complete data URL for preview
      const dataUrl = canvas.toDataURL('image/jpeg');
      setCapturedImage(dataUrl); // Store complete data URL
      stopCamera();
    } catch (error) {
      console.error('Error taking picture:', error);
    }
  };

  const retakePicture = () => {
    setCapturedImage(null);
    requestCameraPermission();
  };

  const handleSubmit = async () => {
    if (!capturedImage) return;

    try {
      setIsProcessing(true);
      const token = await AsyncStorage.getItem('userToken');

      // Convert image to base64
      // In handleSubmit function when sending to backend
      const base64Image = capturedImage.split('base64,')[1] || capturedImage;

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
      console.log('Response:', data); // For debugging

      if (data.status === 'error') {
        setIsProcessing(false);
        
        // Handle specific error cases
        if (data.message === 'No nutrition label detected') {
          Alert.alert('Error', 'Could not detect Nutritional Label');
        } else if (data.message.includes('Gemini')) {
          Alert.alert('Error', 'Couldn\'t extract data');
        } else {
          Alert.alert('Error', data.message || 'Failed to process image');
        }
        return;
      }

      if (data.status === 'success') {
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

  if (hasPermission === null) {
    return (
      <View style={styles.container}>
        <Text style={styles.text}>Requesting camera permission...</Text>
      </View>
    );
  }

  if (hasPermission === false) {
    return (
      <View style={styles.container}>
        <Text style={styles.text}>Camera permission is required</Text>
        <TouchableOpacity 
          style={styles.button}
          onPress={requestCameraPermission}
        >
          <Text style={styles.buttonText}>Grant Permission</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (capturedImage) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="light-content" />
        <Image
          source={{ uri: capturedImage }} // Now using complete data URL
          style={styles.previewImage}
          resizeMode="contain"
        />
        {isProcessing ? (
          <View style={styles.processingContainer}>
            <ActivityIndicator size="large" color={colors.white} />
            <Text style={styles.processingText}>Processing image...</Text>
          </View>
        ) : (
          <View style={styles.previewButtons}>
            <TouchableOpacity 
              style={[styles.previewButton, styles.retakeButton]}
              onPress={retakePicture}
            >
              <Ionicons name="camera-reverse" size={24} color={colors.white} />
              <Text style={styles.previewButtonText}>Retake</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.previewButton, styles.submitButton]}
              onPress={handleSubmit}
              disabled={isProcessing}
            >
              <Ionicons name="checkmark-circle" size={24} color={colors.white} />
              <Text style={styles.previewButtonText}>Submit</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <video
        ref={videoRef}
        style={styles.camera}
        autoPlay
        playsInline
        muted
      />
      <canvas ref={canvasRef} style={{ display: 'none' }} />
      
      <View style={styles.controls}>
        <TouchableOpacity
          style={styles.controlButton}
          onPress={() => router.replace('/dashboard')}
        >
          <Ionicons name="close" size={24} color="white" />
        </TouchableOpacity>
        
        <TouchableOpacity
          style={styles.controlButton}
          onPress={() => {
            setFacingMode(current => 
              current === 'environment' ? 'user' : 'environment'
            );
            stopCamera();
            requestCameraPermission();
          }}
        >
          <Ionicons name="camera-reverse" size={24} color="white" />
        </TouchableOpacity>
      </View>

      <TouchableOpacity 
        style={styles.captureButton}
        onPress={takePicture}
      >
        <View style={styles.captureButtonInner} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'black',
  },
  text: {
    color: 'white',
    fontSize: 16,
    textAlign: 'center',
    marginTop: 20,
  },
  camera: {
    flex: 1,
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
  button: {
    backgroundColor: colors.primary,
    padding: 15,
    borderRadius: 10,
    marginTop: 20,
    alignSelf: 'center',
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
  },
  controls: {
    position: 'absolute',
    top: 20,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 20,
  },
  controlButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  captureButton: {
    position: 'absolute',
    bottom: 40,
    alignSelf: 'center',
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  captureButtonInner: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: 'white',
  },
  previewImage: {
    flex: 1,
    width: '100%',
    height: '100%',
    objectFit: 'contain',
  },
  previewButtons: {
    position: 'absolute',
    bottom: 40,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-evenly',
  },
  previewButton: {
    padding: 15,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  previewButtonText: {
    color: 'white',
    fontSize: 16,
  },
  retakeButton: {
    backgroundColor: 'rgba(255, 59, 48, 0.8)',
  },
  submitButton: {
    backgroundColor: 'rgba(52, 199, 89, 0.8)',
  },
  processingContainer: {
    position: 'absolute',
    bottom: 40,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  processingText: {
    color: colors.white,
    fontSize: 16,
    marginTop: 10,
  },
});