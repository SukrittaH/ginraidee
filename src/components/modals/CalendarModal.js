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
    const dateStr = new Date(currentDate.getFullYear(), currentDate.getMonth(), day).toDateString();
    return inventory.filter(item => {
      if (!item.expirationDate) return false;
      const itemDate = new Date(item.expirationDate).toDateString();
      return itemDate === dateStr;
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
              {itemsForDay.slice(0, 3).map((item, index) => (
                <View
                  key={item.id}
                  style={[
                    calendarStyles.itemDot,
                    { backgroundColor: item.backgroundColor }
                  ]}
                >
                  <Text style={calendarStyles.itemEmoji}>{item.emoji}</Text>
                </View>
              ))}
              {itemsForDay.length > 3 && (
                <View style={calendarStyles.moreIndicator}>
                  <Text style={calendarStyles.moreText}>+{itemsForDay.length - 3}</Text>
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