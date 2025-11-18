import React from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
} from 'react-native';
import { dateDetailStyles } from '../../styles/modalStyles';
import { useLanguage } from '../../context/LanguageContext';

export default function DateDetailModal({ visible, onClose, selectedDate, items }) {
  const { getText } = useLanguage();
  const formatSelectedDate = () => {
    if (!selectedDate) return '';
    const options = {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    };
    return selectedDate.toLocaleDateString('en-US', options);
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'expired': return '#FF6B6B';
      case 'today': return '#FFB366';
      case 'tomorrow': return '#4ECDC4';
      default: return '#4CAF50';
    }
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

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={dateDetailStyles.modalContainer}>
        <View style={dateDetailStyles.header}>
          <TouchableOpacity onPress={onClose}>
            <Text style={dateDetailStyles.closeButton}>{getText('กลับ', 'Back')}</Text>
          </TouchableOpacity>
          <Text style={dateDetailStyles.title}>{getText('รายการในวันนี้', 'Items for Date')}</Text>
          <View style={dateDetailStyles.placeholder} />
        </View>

        <View style={dateDetailStyles.dateHeader}>
          <Text style={dateDetailStyles.dateText}>{formatSelectedDate()}</Text>
          <Text style={dateDetailStyles.itemCount}>
            {items.length} {getText('รายการ', 'items')}
          </Text>
        </View>

        <ScrollView style={dateDetailStyles.itemsList}>
          {items.length === 0 ? (
            <View style={dateDetailStyles.emptyState}>
              <Text style={dateDetailStyles.emptyEmoji}>📅</Text>
              <Text style={dateDetailStyles.emptyTitle}>{getText('ไม่มีรายการในวันนี้', 'No items for this date')}</Text>
              <Text style={dateDetailStyles.emptySubtitle}>
                {getText('ไม่มีอาหารหมดอายุในวันนี้', 'No food items expire on this date')}
              </Text>
            </View>
          ) : (
            items.map((item) => (
              <View key={item.id} style={dateDetailStyles.itemCard}>
                <View
                  style={[
                    dateDetailStyles.itemIcon,
                    { backgroundColor: item.backgroundColor }
                  ]}
                >
                  <Text style={dateDetailStyles.itemEmoji}>{item.emoji}</Text>
                </View>

                <View style={dateDetailStyles.itemInfo}>
                  <Text style={dateDetailStyles.itemName}>{item.name}</Text>
                  <Text style={dateDetailStyles.itemQuantity}>
                    {getText('จำนวน', 'Quantity')}: {item.quantity} {item.unit || 'pcs'}
                  </Text>
                  <Text style={dateDetailStyles.itemStatus}>{getStatusText(item)}</Text>
                </View>

                <View
                  style={[
                    dateDetailStyles.statusIndicator,
                    { backgroundColor: getStatusColor(item.status) }
                  ]}
                />
              </View>
            ))
          )}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}