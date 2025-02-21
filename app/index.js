import { View, StyleSheet, Pressable, Image, Text } from 'react-native';
import { router } from 'expo-router';
import { colors } from '../constants/theme';

export default function Index() {
  return (
    <View style={styles.container}>
      <View style={styles.logoContainer}>
        <Image 
          source={require('../assets/logo/default.png')}
          style={styles.logo}
          resizeMode="contain"
        />
      </View>
      
      <View style={styles.buttonContainer}>
        <Pressable
          onPress={() => router.push('/login')}
          style={({ pressed }) => [
            styles.button,
            pressed && styles.buttonPressed
          ]}
          android_ripple={{ color: 'rgba(255,255,255,0.2)' }}
        >
          <Text style={styles.buttonText}>Login</Text>
        </Pressable>

        <Pressable
          onPress={() => router.push('/register')}
          style={({ pressed }) => [
            styles.button,
            pressed && styles.buttonPressed
          ]}
          android_ripple={{ color: 'rgba(255,255,255,0.2)' }}
        >
          <Text style={styles.buttonText}>Register</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    paddingTop: 40,
    padding: 20,
  },
  logoContainer: {
    width: 320,
    height: 320,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 5,
  },
  logo: {
    width: '100%',
    height: '100%',
  },
  buttonContainer: {
    width: '100%',
    gap: 15,
  },
  button: {
    backgroundColor: colors.primary,
    paddingVertical: 15,
    paddingHorizontal: 30,
    borderRadius: 10,
    width: '100%',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  buttonPressed: {
    opacity: 0.8,
    transform: [{ scale: 0.98 }],
  },
  buttonText: {
    color: colors.white,
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
  }
});
