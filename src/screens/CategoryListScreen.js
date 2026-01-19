import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FOOD_CATEGORIES } from '../constants/foodCategories';
import { styles } from '../styles/inventoryStyles';
import { useLanguage } from '../context/LanguageContext';
import { useInventory } from '../context/InventoryContext';
import EditItemModal from '../components/modals/EditItemModal';

export default function CategoryListScreen({ route, navigation }) {
  const { getText } = useLanguage();
  const { inventory, deleteItem, updateItem } = useInventory();
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);

  const { categoryName } = route.params;

  // Find the category object
  const category = FOOD_CATEGORIES.find(cat => cat.nameEn === categoryName);

  // Filter items by category
  const categoryItems = useMemo(() => {
    return inventory.filter(item => item.category === categoryName);
  }, [inventory, categoryName]);

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
    <TouchableOpacity
      key={item.id}
      style={styles.categoryItemRow}
      onPress={() => {
        setSelectedItem(item);
        setShowEditModal(true);
      }}
      onLongPress={() => deleteItem(item.id)}
    >
      <View style={styles.itemRowGradient}>
        <View style={styles.itemRowLeft}>
          <Text style={styles.itemRowName}>{item.name}</Text>
          <Text style={styles.itemRowDate}>{getStatusText(item)}</Text>
        </View>

        <View style={styles.itemRowRight}>
          <Text style={styles.itemRowQuantity}>
            {item.quantity} {item.unit || 'pcs'}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#1a1a1a" />

      {/* Header with back button */}
      <View style={styles.categoryHeader}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="chevron-back" size={28} color="white" />
        </TouchableOpacity>
        <Text style={styles.categoryTitle}>
          {getText(category?.nameTh, category?.nameEn)}
        </Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Items list */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.categoryListContent}
        showsVerticalScrollIndicator={false}
      >
        {categoryItems.length > 0 ? (
          categoryItems.map(renderItemRow)
        ) : (
          <View style={styles.emptyStateContainer}>
            <Text style={styles.emptyStateText}>
              {getText('ไม่มีรายการในหมวดหมู่นี้', 'No items in this category')}
            </Text>
          </View>
        )}
      </ScrollView>

      <EditItemModal
        visible={showEditModal}
        onClose={() => setShowEditModal(false)}
        onUpdateItem={updateItem}
        item={selectedItem}
      />
    </SafeAreaView>
  );
}
