import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  ScrollView,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FILTER_OPTIONS } from '../constants/foodCategories';
import { styles } from '../styles/inventoryStyles';
import AddItemModal from '../components/modals/AddItemModal';
import CalendarModal from '../components/modals/CalendarModal';
import { useLanguage } from '../context/LanguageContext';
import { useInventory } from '../context/InventoryContext';

export default function InventoryScreen() {
  const { language, toggleLanguage, getText } = useLanguage();
  const { inventory, addItem, deleteItem } = useInventory();
  const [selectedFilter, setSelectedFilter] = useState('All');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showCalendarModal, setShowCalendarModal] = useState(false);

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

  const getFilteredItems = () => {
    const filterEn = typeof selectedFilter === 'string' ? selectedFilter : selectedFilter.en;
    if (filterEn === 'All') return inventory;
    if (filterEn === 'Due soon') return inventory.filter(item =>
      item.status === 'today' || item.status === 'tomorrow'
    );
    if (filterEn === 'Past due') return inventory.filter(item =>
      item.status === 'expired'
    );
    return inventory;
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

  const renderFoodCard = (item) => (
    <TouchableOpacity
      key={item.id}
      style={[styles.foodCard, { backgroundColor: item.backgroundColor }]}
      onLongPress={() => deleteItem(item.id)}
    >
      <View style={styles.cardHeader}>
        <Text style={styles.emoji}>{item.emoji}</Text>
        <View style={styles.quantityBadge}>
          <Text style={styles.quantityText}>
            {item.quantity} {item.unit || 'pcs'}
          </Text>
        </View>
      </View>

      <View style={styles.cardContent}>
        <Text style={styles.foodName}>{item.name}</Text>
        <Text style={styles.statusText}>{getStatusText(item)}</Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#1a1a1a" />

      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity style={styles.searchButton}>
            <Ionicons name="search" size={24} color="white" />
          </TouchableOpacity>
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

      <View style={styles.filterContainer}>
        {FILTER_OPTIONS.map((filter) => {
          const isSelected = (typeof selectedFilter === 'string' ? selectedFilter : selectedFilter.en) === filter.en;
          return (
            <TouchableOpacity
              key={filter.en}
              style={[
                styles.filterTab,
                isSelected && styles.activeFilterTab
              ]}
              onPress={() => setSelectedFilter(filter.en)}
            >
              <Text style={[
                styles.filterText,
                isSelected && styles.activeFilterText
              ]}>
                {getText(filter.th, filter.en)}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.gridContainer}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.grid}>
          {getFilteredItems().map(renderFoodCard)}
        </View>
      </ScrollView>

      <TouchableOpacity
        style={styles.bottomNotification}
        onPress={() => setShowCalendarModal(true)}
      >
        <Ionicons name="calendar-outline" size={20} color="white" />
        <Text style={styles.notificationText}>{getText('วันหมดอายุ', 'Due date')}</Text>
      </TouchableOpacity>

      <AddItemModal
        visible={showAddModal}
        onClose={() => setShowAddModal(false)}
        onAddItem={addItem}
      />

      <CalendarModal
        visible={showCalendarModal}
        onClose={() => setShowCalendarModal(false)}
        inventory={inventory}
      />
    </SafeAreaView>
  );
}