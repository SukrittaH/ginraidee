import * as React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { View, ActivityIndicator } from 'react-native';
import * as Linking from 'expo-linking';

import InventoryScreen from './src/screens/InventoryScreen';
import CategoryListScreen from './src/screens/CategoryListScreen';
import CameraScreen from './src/screens/CameraScreen';
import RecipeScreen from './src/screens/RecipeScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import LoginScreen from './src/screens/LoginScreen';
import { LanguageProvider } from './src/context/LanguageContext';
import { InventoryProvider } from './src/context/InventoryContext';
import { AuthProvider, useAuth } from './src/context/AuthContext';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

function InventoryStackNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
      }}
    >
      <Stack.Screen name="InventoryHome" component={InventoryScreen} />
      <Stack.Screen name="CategoryList" component={CategoryListScreen} />
    </Stack.Navigator>
  );
}

function MainTabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarIcon: ({ focused, color, size }) => {
          let iconName;
          if (route.name === 'InventoryTab') iconName = focused ? 'restaurant' : 'restaurant-outline';
          else if (route.name === 'Camera') iconName = focused ? 'camera' : 'camera-outline';
          else if (route.name === 'Recipes') iconName = focused ? 'book' : 'book-outline';
          else if (route.name === 'Profile') iconName = focused ? 'person' : 'person-outline';

          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: '#2563eb',
        tabBarInactiveTintColor: 'gray',
      })}
    >
      <Tab.Screen name="InventoryTab" component={InventoryStackNavigator} options={{ title: 'Inventory' }} />
      <Tab.Screen name="Camera" component={CameraScreen} />
      <Tab.Screen name="Recipes" component={RecipeScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

function SplashScreen() {
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' }}>
      <ActivityIndicator size="large" color="#0078D4" />
    </View>
  );
}

function RootNavigator() {
  const { isAuthenticated, isLoading, exchangeCodeForToken } = useAuth();

  React.useEffect(() => {
    // Listen for deep links from Microsoft OAuth redirect
    const handleDeepLink = async ({ url }) => {
      console.log('Deep link received:', url);

      // Parse the URL to extract authorization code
      const parsed = Linking.parse(url);
      const code = parsed.queryParams?.code;
      const error = parsed.queryParams?.error;

      if (error) {
        console.error('OAuth error from Microsoft:', error, parsed.queryParams?.error_description);
        alert(`Login failed: ${parsed.queryParams?.error_description || error}`);
        return;
      }

      if (code) {
        try {
          console.log('Exchanging authorization code for token...');
          await exchangeCodeForToken(code);
          console.log('Login successful!');
        } catch (err) {
          console.error('Failed to exchange code for token:', err);
          alert('Login failed: ' + err.message);
        }
      }
    };

    // Subscribe to deep links
    const subscription = Linking.addEventListener('url', handleDeepLink);

    // Check if app was opened from a deep link
    const checkInitialUrl = async () => {
      const initialUrl = await Linking.getInitialURL();
      if (initialUrl != null) {
        handleDeepLink({ url: initialUrl });
      }
    };

    checkInitialUrl();

    // Cleanup subscription on unmount
    return () => {
      subscription.remove();
    };
  }, [exchangeCodeForToken]);

  if (isLoading) {
    return <SplashScreen />;
  }

  return (
    <NavigationContainer>
      {isAuthenticated ? (
        <MainTabNavigator />
      ) : (
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name="Login" component={LoginScreen} />
        </Stack.Navigator>
      )}
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <LanguageProvider>
        <InventoryProvider>
          <RootNavigator />
        </InventoryProvider>
      </LanguageProvider>
    </AuthProvider>
  );
}