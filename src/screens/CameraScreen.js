import React from 'react';
import { View, Text } from 'react-native';
import { styles } from '../styles/inventoryStyles';

export default function CameraScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Camera</Text>
      <Text style={styles.subtitle}>Take photos of your food here! 📸</Text>
    </View>
  );
}