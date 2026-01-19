import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { calendarStyles } from '../../styles/modalStyles';
import DateDetailModal from './DateDetailModal';

export default function CalendarModal({ visible, onClose, inventory }) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [showDateDetail, setShowDateDetail] = useState(false);
  const [selectedDateForDetail, setSelectedDateForDetail] = useState(null);
  const [selectedDateItems, setSelectedDateItems] = useState([]);

  const getDaysInMonth = (date) => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (date) => {
    return new Date(date.getFullYear(), date.getMonth(), 1).getDay();
  };

  const getMonthYear = (date) => {
    const options = { year: 'numeric', month: 'long' };
    return date.toLocaleDateString('en-US', options);
  };

  const getItemsForDate = (day) => {
    // Format as YYYY-MM-DD to match backend format
    const month = String(currentDate.getMonth() + 1).padStart(2, '0');
    const dayStr = String(day).padStart(2, '0');
    const dateStr = `${currentDate.getFullYear()}-${month}-${dayStr}`;

    return inventory.filter(item => {
      if (!item.expirationDate) return false;
      // Extract just the date part (YYYY-MM-DD) from expirationDate
      const itemDateStr = item.expirationDate.split('T')[0];
      return itemDateStr === dateStr;
    });
  };

  const navigateMonth = (direction) => {
    const newDate = new Date(currentDate);
    newDate.setMonth(newDate.getMonth() + direction);
    setCurrentDate(newDate);
  };

  const handleDateSelect = (day) => {
    const selectedDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
    const itemsForDate = getItemsForDate(day);

    setSelectedDateForDetail(selectedDate);
    setSelectedDateItems(itemsForDate);
    setShowDateDetail(true);
  };

  const getUniqueCategoryItems = (day) => {
    const itemsForDay = getItemsForDate(day);
    const categoryMap = {};

    itemsForDay.forEach((item) => {
      if (!categoryMap[item.category]) {
        categoryMap[item.category] = {
          emoji: item.emoji,
          backgroundColor: item.backgroundColor,
          count: 0
        };
      }
      categoryMap[item.category].count += 1;
    });

    return Object.values(categoryMap);
  };

  const renderCalendarDays = () => {
    const daysInMonth = getDaysInMonth(currentDate);
    const firstDay = getFirstDayOfMonth(currentDate);
    const days = [];

    // Add empty cells for days before the first day of the month
    for (let i = 0; i < firstDay; i++) {
      days.push(
        <View key={`empty-${i}`} style={calendarStyles.emptyDay} />
      );
    }

    // Add days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      const itemsForDay = getItemsForDate(day);
      const hasItems = itemsForDay.length > 0;
      const uniqueCategoryItems = getUniqueCategoryItems(day);
      const today = new Date();
      const isToday =
        today.getDate() === day &&
        today.getMonth() === currentDate.getMonth() &&
        today.getFullYear() === currentDate.getFullYear();

      days.push(
        <TouchableOpacity
          key={day}
          style={[
            calendarStyles.dayContainer,
            isToday && calendarStyles.todayContainer
          ]}
          onPress={() => handleDateSelect(day)}
        >
          <Text style={[
            calendarStyles.dayNumber,
            isToday && calendarStyles.todayText
          ]}>
            {day}
          </Text>
          {hasItems && (
            <View style={calendarStyles.itemsContainer}>
              {uniqueCategoryItems.slice(0, 3).map((categoryItem, index) => (
                <View
                  key={index}
                  style={[
                    calendarStyles.itemDot,
                    { backgroundColor: categoryItem.backgroundColor }
                  ]}
                >
                  <Text style={calendarStyles.itemEmoji}>{categoryItem.emoji}</Text>
                  {categoryItem.count > 1 && (
                    <View style={calendarStyles.countBadge}>
                      <Text style={calendarStyles.countBadgeText}>{categoryItem.count}</Text>
                    </View>
                  )}
                </View>
              ))}
              {uniqueCategoryItems.length > 3 && (
                <View style={calendarStyles.moreIndicator}>
                  <Text style={calendarStyles.moreText}>+{uniqueCategoryItems.length - 3}</Text>
                </View>
              )}
            </View>
          )}
        </TouchableOpacity>
      );
    }

    return days;
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={calendarStyles.modalContainer}>
        <View style={calendarStyles.header}>
          <TouchableOpacity onPress={onClose}>
            <Text style={calendarStyles.closeButton}>Close</Text>
          </TouchableOpacity>
          <Text style={calendarStyles.title}>Food Expiration Calendar</Text>
          <View style={calendarStyles.placeholder} />
        </View>

        <View style={calendarStyles.calendarHeader}>
          <TouchableOpacity
            style={calendarStyles.navButton}
            onPress={() => navigateMonth(-1)}
          >
            <Ionicons name="chevron-back" size={24} color="white" />
          </TouchableOpacity>

          <Text style={calendarStyles.monthYear}>{getMonthYear(currentDate)}</Text>

          <TouchableOpacity
            style={calendarStyles.navButton}
            onPress={() => navigateMonth(1)}
          >
            <Ionicons name="chevron-forward" size={24} color="white" />
          </TouchableOpacity>
        </View>

        <View style={calendarStyles.weekDays}>
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
            <Text key={day} style={calendarStyles.weekDay}>{day}</Text>
          ))}
        </View>

        <ScrollView style={calendarStyles.calendar}>
          <View style={calendarStyles.daysGrid}>
            {renderCalendarDays()}
          </View>
        </ScrollView>

        <DateDetailModal
          visible={showDateDetail}
          onClose={() => setShowDateDetail(false)}
          selectedDate={selectedDateForDetail}
          items={selectedDateItems}
        />
      </SafeAreaView>
    </Modal>
  );
}