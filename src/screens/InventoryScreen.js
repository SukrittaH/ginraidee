import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StatusBar,
  ScrollView,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { FOOD_CATEGORIES } from '../constants/foodCategories';
import { styles } from '../styles/inventoryStyles';
import AddItemModal from '../components/modals/AddItemModal';
import CalendarModal from '../components/modals/CalendarModal';
import { useLanguage } from '../context/LanguageContext';
import { useInventory } from '../context/InventoryContext';

export default function InventoryScreen({ navigation, route }) {
  const { language, toggleLanguage, getText } = useLanguage();
  const { addItem, inventory } = useInventory();
  const [showAddModal, setShowAddModal] = useState(false);
  const [showCalendarModal, setShowCalendarModal] = useState(false);
  const [ocrData, setOcrData] = useState(null);

  // Handle OCR data from camera screen
  useEffect(() => {
    if (route?.params?.ocrData && route?.params?.fromCamera) {
      console.log('📸 Received OCR data from camera:', route.params.ocrData);
      setOcrData(route.params.ocrData);
      setShowAddModal(true);

      // Clear the route params to prevent re-opening
      navigation.setParams({ ocrData: null, fromCamera: false });
    }
  }, [route?.params?.ocrData, route?.params?.fromCamera]);

  const handleLanguageSwitch = () => {
    toggleLanguage();

    const nextLang = language === 'th' ? 'en' : 'th';
    const nextLangName = nextLang === 'th' ? 'ภาษาไทย' : 'English';

    Alert.alert(
      getText('เปลี่ยนภาษา', 'Language Changed'),
      getText(
        `เปลี่ยนเป็น ${nextLangName}`,
        `Changed to ${nextLangName}`
      )
    );
  };

  const renderCategoryCard = (category) => (
    <TouchableOpacity
      key={category.nameEn}
      style={styles.categoryCard}
      onPress={() => {
        navigation.navigate('CategoryList', { categoryName: category.nameEn });
      }}
    >
      <View style={styles.categoryGradient}>
        <View style={styles.categoryGlossOverlay} />
        <Text style={styles.categoryEmoji}>{category.emoji}</Text>
        <Text style={styles.categoryCardName}>
          {getText(category.nameTh, category.nameEn)}
        </Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#1a1a1a" />

      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.headerTitle}>{getText('หมวดหมู่', 'Categories')}</Text>
        </View>

        <View style={styles.headerRight}>
          <TouchableOpacity
            style={styles.settingsButton}
            onPress={handleLanguageSwitch}
          >
            <Ionicons name="language" size={24} color="white" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => setShowAddModal(true)}
          >
            <Ionicons name="add" size={24} color="white" />
            <Text style={styles.addText}>{getText('เพิ่ม', 'Add')}</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.categoryGridContainer}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.categoryGrid}>
          {FOOD_CATEGORIES.map(renderCategoryCard)}
        </View>
      </ScrollView>

      <AddItemModal
        visible={showAddModal}
        onClose={() => {
          setShowAddModal(false);
          setOcrData(null);
        }}
        onAddItem={addItem}
        ocrData={ocrData}
        clearOcrData={() => setOcrData(null)}
      />

      <TouchableOpacity
        style={styles.calendarButton}
        onPress={() => setShowCalendarModal(true)}
      >
        <Ionicons name="calendar" size={24} color="white" />
      </TouchableOpacity>

      <CalendarModal
        visible={showCalendarModal}
        onClose={() => setShowCalendarModal(false)}
        inventory={inventory}
      />
    </SafeAreaView>
  );
}