import * as React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';

import InventoryScreen from './src/screens/InventoryScreen';
import CategoryListScreen from './src/screens/CategoryListScreen';
import CameraScreen from './src/screens/CameraScreen';
import RecipeScreen from './src/screens/RecipeScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import { LanguageProvider } from './src/context/LanguageContext';
import { InventoryProvider } from './src/context/InventoryContext';
import { AuthProvider } from './src/context/AuthContext';

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

export default function App() {
  return (
    <AuthProvider>
      <LanguageProvider>
        <InventoryProvider>
          <NavigationContainer>
            <Tab.Navigator
            screenOptions={({ route }) => ({
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
          </NavigationContainer>
        </InventoryProvider>
      </LanguageProvider>
    </AuthProvider>
  );
}