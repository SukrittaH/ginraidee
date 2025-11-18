import React from 'react';
import { View, Text } from 'react-native';
import { styles } from '../styles/inventoryStyles';

export default function ProfileScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Profile</Text>
      <Text style={styles.subtitle}>Your settings and preferences! ⚙️</Text>
    </View>
  );
}