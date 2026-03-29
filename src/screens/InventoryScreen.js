import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StatusBar,
  ScrollView,
  Alert,
  LayoutAnimation,
  Platform,
  UIManager,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { FOOD_CATEGORIES } from '../constants/foodCategories';
import { styles } from '../styles/inventoryStyles';
import AddItemModal from '../components/modals/AddItemModal';
import CalendarModal from '../components/modals/CalendarModal';
import EditItemModal from '../components/modals/EditItemModal';
import { useLanguage } from '../context/LanguageContext';
import { useInventory } from '../context/InventoryContext';

// Enable LayoutAnimation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export default function InventoryScreen({ navigation, route }) {
  const { language, toggleLanguage, getText } = useLanguage();
  const { addItem, inventory, deleteItem, updateItem } = useInventory();
  const [showAddModal, setShowAddModal] = useState(false);
  const [showCalendarModal, setShowCalendarModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [expandedCategories, setExpandedCategories] = useState({});
  const [ocrData, setOcrData] = useState(null);
  const [showNotification, setShowNotification] = useState(false);
  const [notificationData, setNotificationData] = useState(null);

  // Handle OCR data from camera screen
  useEffect(() => {
    if (route?.params?.ocrData && route?.params?.fromCamera) {
      console.log('📸 Received OCR data from camera:', route.params.ocrData);
      setOcrData(route.params.ocrData);
      setShowAddModal(true);

      // Clear route params to prevent re-opening
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

  const toggleCategory = (categoryName) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedCategories(prev => ({
      ...prev,
      [categoryName]: !prev[categoryName]
    }));
  };

  const getCategoryItemCount = (categoryName) => {
    return inventory.filter(item => item.category === categoryName).length;
  };

  const handleAddItem = (newItem) => {
    addItem(newItem);
    setNotificationData(newItem);
    setShowNotification(true);
    setTimeout(() => setShowNotification(false), 3000);
  };

  const handleUpdateItem = async (id, updates) => {
    await updateItem(id, updates);
    setNotificationData({ ...updates, id });
    setShowNotification(true);
    setTimeout(() => setShowNotification(false), 3000);
  };

  const getStatusText = (item) => {
    const expirationDate = new Date(item.expirationDate);
    const today = new Date();
    const diffTime = expirationDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays <= 0) {
      return getText('เลยวันหมดอายุ', 'Past due date');
    } else if (diffDays <= 1) {
      return getText('หมดอายุวันนี้', 'Expires today');
    } else if (diffDays <= 3) {
      return getText(`หมดอายุใน ${diffDays} วัน`, `Expires in ${diffDays} days`);
    } else {
      return getText(`หมดอายุใน ${diffDays} วัน`, `Expires in ${diffDays} days`);
    }
  };

  const renderItemRow = (item) => (
    <View key={item.id} style={styles.categoryItemRow}>
      <TouchableOpacity
        onPress={() => {
          setSelectedItem(item);
          setShowEditModal(true);
        }}
        onLongPress={() => {
          Alert.alert(
            getText('ลบรายการ', 'Delete Item'),
            getText(`คุณต้องการลบ "${item.name}" ใช่ไหม?`, `Are you sure you want to delete "${item.name}"?`),
            [
              { text: getText('ยกเลิก', 'Cancel'), style: 'cancel' },
              {
                text: getText('ลบ', 'Delete'),
                style: 'destructive',
                onPress: () => deleteItem(item.id),
              },
            ]
          );
        }}
      >
        <LinearGradient
          colors={['#91ef8b', '#fcffdf', '#58f8ef']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={{ padding: 2, borderRadius: 18, marginBottom: 8 }}
        >
          <LinearGradient
            colors={['#dbf8e1', '#bcd3ff']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.itemRowGradient}
          >
            <View style={styles.itemRowLeft}>
              <Text style={styles.itemRowName}>{item.name}</Text>
              <Text style={styles.itemRowDate}>{getStatusText(item)}</Text>
            </View>

            <View style={styles.itemRowRight}>
              <Text style={styles.itemRowQuantity}>
                {item.quantity} {item.unit || 'pcs'}
              </Text>
            </View>
          </LinearGradient>
        </LinearGradient>
      </TouchableOpacity>
    </View>
  );

  const renderExpandableCategory = (category) => {
    const categoryItems = inventory.filter(item => item.category === category.nameEn);
    const itemCount = categoryItems.length;
    const isExpanded = expandedCategories[category.nameEn] || false;

    return (
      <View key={category.nameEn} style={styles.expandableCategory}>
        <TouchableOpacity
          style={styles.categoryHeaderRow}
          onPress={() => toggleCategory(category.nameEn)}
        >
          <View style={styles.categoryHeaderLeft}>
            <Text style={styles.categoryHeaderEmoji}>{category.emoji}</Text>
            <Text style={styles.categoryHeaderName}>
              {getText(category.nameTh, category.nameEn)}
            </Text>
            {itemCount > 0 && (
              <Text style={styles.categoryItemCount}>
                ({itemCount})
              </Text>
            )}
          </View>
          <Ionicons
            name={isExpanded ? 'chevron-up' : 'chevron-down'}
            size={20}
            color="#636e72"
            style={styles.expandArrow}
          />
        </TouchableOpacity>

        {isExpanded && (
          <View style={styles.expandedItemsContainer}>
            {categoryItems.length > 0 ? (
              categoryItems.map(renderItemRow)
            ) : (
              <View style={styles.emptyStateContainer}>
                <Text style={styles.emptyStateText}>
                  {getText('ไม่มีรายการในหมวดหมู่นี้', 'No items in this category')}
                </Text>
              </View>
            )}
          </View>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />

      {showNotification && notificationData && (
        <View style={styles.successNotification}>
          <Ionicons name="checkmark-circle" size={20} color="#4CAF50" />
          <View style={styles.notificationContent}>
            <Text style={styles.notificationTitle}>
              {getText('บันทึกรายการสำเร็จ', 'Saved Successfully')}
            </Text>
            <Text style={styles.notificationDetails}>
              {notificationData.name} • {notificationData.quantity} {notificationData.unit || 'pcs'}
            </Text>
            <Text style={styles.notificationCategory}>
              {notificationData.emoji} {getText(
                FOOD_CATEGORIES.find(c => c.nameEn === notificationData.category)?.nameTh || notificationData.category,
                notificationData.category
              )}
            </Text>
          </View>
        </View>
      )}

      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.headerTitle}>{getText('คลัง', 'Inventory')}</Text>
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
        {FOOD_CATEGORIES.map(renderExpandableCategory)}
      </ScrollView>

      <AddItemModal
        visible={showAddModal}
        onClose={() => {
          setShowAddModal(false);
          setOcrData(null);
        }}
        onAddItem={handleAddItem}
        ocrData={ocrData}
        clearOcrData={() => setOcrData(null)}
      />

      <EditItemModal
        visible={showEditModal}
        onClose={() => setShowEditModal(false)}
        onUpdateItem={handleUpdateItem}
        item={selectedItem}
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
