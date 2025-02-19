import { useState, useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image, StatusBar } from 'react-native';
import { CameraView, CameraType, useCameraPermissions } from 'expo-camera';
import { Stack, router } from 'expo-router';
import { colors } from '../constants/theme';
import { Ionicons } from '@expo/vector-icons';

export default function CameraPage() {
  const [permission, requestPermission] = useCameraPermissions();
  const [facing, setFacing] = useState(CameraType.back);
  const [capturedImage, setCapturedImage] = useState(null);
  const [camera, setCamera] = useState(null);

  if (!permission) {
    return <View />;
  }

  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <Text style={styles.text}>Camera permission is required</Text>
        <TouchableOpacity 
          style={styles.button}
          onPress={requestPermission}
        >
          <Text style={styles.buttonText}>Grant Permission</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const takePicture = async () => {
    if (camera) {
      try {
        const photo = await camera.takePictureAsync();
        setCapturedImage(photo);
        console.log('Captured photo URI:', photo.uri);
      } catch (error) {
        console.error('Error taking picture:', error);
      }
    }
  };

  const retakePicture = () => {
    setCapturedImage(null);
  };

  if (capturedImage) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="light-content" />
        <Image
          source={{ uri: capturedImage.uri }}
          style={styles.previewImage}
        />
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
            onPress={() => {
              console.log('Submit button pressed');
              // Submit logic will be implemented later
            }}
          >
            <Ionicons name="checkmark-circle" size={24} color={colors.white} />
            <Text style={styles.previewButtonText}>Submit</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <CameraView
        ref={(ref) => setCamera(ref)}
        style={styles.camera}
        facing={facing}
      >
        <View style={styles.controls}>
          <TouchableOpacity
            style={styles.controlButton}
            onPress={() => router.back()}
          >
            <Ionicons name="close" size={24} color="white" />
          </TouchableOpacity>
          
          <TouchableOpacity
            style={styles.controlButton}
            onPress={() => setFacing(current => 
              current === CameraType.back ? CameraType.front : CameraType.back
            )}
          >
            <Ionicons name="camera-reverse" size={24} color="white" />
          </TouchableOpacity>
        </View>

        <View style={styles.shutterContainer}>
          <TouchableOpacity 
            style={styles.shutterButton}
            onPress={takePicture}
          >
            <View style={styles.shutterInner} />
          </TouchableOpacity>
        </View>
      </CameraView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'black',
  },
  camera: {
    flex: 1,
    width: '100%',
  },
  controls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 20,
    paddingTop: 40,
  },
  controlButton: {
    backgroundColor: 'rgba(0,0,0,0.5)',
    padding: 10,
    borderRadius: 25,
  },
  shutterContainer: {
    position: 'absolute',
    bottom: 40,
    alignSelf: 'center',
  },
  shutterButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  shutterInner: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: colors.white,
    borderWidth: 2,
    borderColor: colors.primary,
  },
  previewImage: {
    flex: 1,
    width: '100%',
  },
  previewButtons: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-around',
    padding: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  previewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 25,
    gap: 8,
  },
  retakeButton: {
    backgroundColor: colors.error,
  },
  submitButton: {
    backgroundColor: colors.primary,
  },
  previewButtonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '600',
  },
  text: {
    color: colors.text,
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 20,
  },
  button: {
    backgroundColor: colors.primary,
    padding: 15,
    borderRadius: 8,
  },
  buttonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
});