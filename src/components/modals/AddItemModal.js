import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  TextInput,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FOOD_CATEGORIES } from '../../constants/foodCategories';
import { UNITS, getDefaultUnit } from '../../constants/units';
import { addStyles } from '../../styles/modalStyles';
import { useLanguage } from '../../context/LanguageContext';

export default function AddItemModal({ visible, onClose, onAddItem }) {
  const { getText } = useLanguage();
  const [itemName, setItemName] = useState('');
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [quantity, setQuantity] = useState('1');
  const [unit, setUnit] = useState(getDefaultUnit());
  const [expirationDate, setExpirationDate] = useState(new Date(Date.now() + 3 * 24 * 60 * 60 * 1000));
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const unitScrollRef = useRef(null);
  const ITEM_HEIGHT = 40;

  const handleUnitScroll = (event) => {
    const scrollPosition = event.nativeEvent.contentOffset.y;
    const index = Math.round(scrollPosition / ITEM_HEIGHT);
    if (index >= 0 && index < UNITS.length) {
      setUnit(UNITS[index].value);
    }
  };

  const resetForm = () => {
    setItemName('');
    setSelectedCategory(null);
    setQuantity('1');
    setUnit(getDefaultUnit());
    setExpirationDate(new Date(Date.now() + 3 * 24 * 60 * 60 * 1000));
    setShowDatePicker(false);
  };

  const handleAddItem = () => {
    if (!itemName.trim()) {
      Alert.alert('ข้อผิดพลาด', 'กรุณากรอกชื่ออาหาร');
      return;
    }

    if (!selectedCategory) {
      Alert.alert('ข้อผิดพลาด', 'กรุณาเลือกหมวดหมู่');
      return;
    }

    const today = new Date();
    const diffTime = expirationDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    let status, statusText;
    if (diffDays <= 0) {
      status = 'expired';
      statusText = 'เลยวันหมดอายุ';
    } else if (diffDays <= 1) {
      status = 'today';
      statusText = 'หมดอายุวันนี้';
    } else if (diffDays <= 3) {
      status = 'tomorrow';
      statusText = `หมดอายุใน ${diffDays} วัน`;
    } else {
      status = 'fresh';
      statusText = `หมดอายุใน ${diffDays} วัน`;
    }

    const newItem = {
      id: Date.now().toString(),
      name: itemName.trim(),
      emoji: selectedCategory.emoji,
      quantity: parseInt(quantity),
      unit: unit,
      status: status,
      statusText: statusText,
      backgroundColor: selectedCategory.color,
      expirationDate: expirationDate.toISOString(),
    };

    onAddItem(newItem);
    resetForm();
    onClose();
  };

  const getDaysInMonth = (date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    return { daysInMonth, startingDayOfWeek };
  };

  const changeMonth = (direction) => {
    const newDate = new Date(currentMonth);
    newDate.setMonth(currentMonth.getMonth() + direction);
    setCurrentMonth(newDate);
  };

  const selectDate = (day) => {
    const newDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
    setExpirationDate(newDate);
    setShowDatePicker(false);
  };

  const isToday = (day) => {
    const today = new Date();
    return day === today.getDate() &&
           currentMonth.getMonth() === today.getMonth() &&
           currentMonth.getFullYear() === today.getFullYear();
  };

  const isSelected = (day) => {
    return day === expirationDate.getDate() &&
           currentMonth.getMonth() === expirationDate.getMonth() &&
           currentMonth.getFullYear() === expirationDate.getFullYear();
  };

  const formatDate = (date) => {
    const options = {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    };
    return date.toLocaleDateString('en-US', options);
  };

  const getDaysUntilExpiration = () => {
    const today = new Date();
    const diffTime = expirationDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return `${Math.abs(diffDays)} days overdue`;
    if (diffDays === 0) return 'Expires today';
    if (diffDays === 1) return 'Expires tomorrow';
    return `Expires in ${diffDays} days`;
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={addStyles.modalContainer}>
        <View style={addStyles.modalHeader}>
          <TouchableOpacity onPress={onClose}>
            <Text style={addStyles.cancelButton}>{getText('ยกเลิก', 'Cancel')}</Text>
          </TouchableOpacity>
          <Text style={addStyles.modalTitle}>{getText('เพิ่มรายการใหม่', 'Add New Item')}</Text>
          <TouchableOpacity onPress={handleAddItem}>
            <Text style={addStyles.saveButton}>{getText('บันทึก', 'Save')}</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={addStyles.modalContent}>
          <View style={addStyles.inputSection}>
            <Text style={addStyles.label}>{getText('ชื่ออาหาร', 'Item Name')}</Text>
            <TextInput
              style={addStyles.textInput}
              value={itemName}
              onChangeText={setItemName}
              placeholder={getText('กรอกชื่ออาหาร', 'Enter food item name')}
              placeholderTextColor="#999"
              autoFocus
            />
          </View>

          <View style={addStyles.inputSection}>
            <Text style={addStyles.label}>{getText('หมวดหมู่', 'Category')}</Text>
            <View style={addStyles.categoryGrid}>
              {FOOD_CATEGORIES.map((category, index) => (
                <TouchableOpacity
                  key={index}
                  style={[
                    addStyles.categoryCard,
                    { backgroundColor: category.color },
                    selectedCategory?.nameTh === category.nameTh && addStyles.selectedCategory
                  ]}
                  onPress={() => setSelectedCategory(category)}
                >
                  <Text style={addStyles.categoryEmoji}>{category.emoji}</Text>
                  <Text style={addStyles.categoryName}>{getText(category.nameTh, category.nameEn)}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={addStyles.inputSection}>
            <Text style={addStyles.label}>{getText('จำนวน', 'Quantity')}</Text>
            <View style={addStyles.quantityContainer}>
              <TouchableOpacity
                style={addStyles.quantityButton}
                onPress={() => setQuantity(Math.max(1, parseInt(quantity) - 1).toString())}
              >
                <Text style={addStyles.quantityButtonText}>−</Text>
              </TouchableOpacity>
              <TextInput
                style={addStyles.quantityInput}
                value={quantity}
                onChangeText={setQuantity}
                keyboardType="numeric"
                textAlign="center"
              />
              <TouchableOpacity
                style={addStyles.quantityButton}
                onPress={() => setQuantity((parseInt(quantity) + 1).toString())}
              >
                <Text style={addStyles.quantityButtonText}>+</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={addStyles.inputSection}>
            <Text style={addStyles.label}>{getText('หน่วย', 'Unit')}</Text>
            <View style={addStyles.unitPickerContainer}>
              <View style={addStyles.pickerContainer}>
                <ScrollView
                  ref={unitScrollRef}
                  showsVerticalScrollIndicator={false}
                  snapToInterval={40}
                  decelerationRate="fast"
                  onMomentumScrollEnd={handleUnitScroll}
                  contentContainerStyle={addStyles.pickerScrollContent}
                  style={addStyles.pickerScroll}
                >
                  {UNITS.map((u, index) => {
                    const isSelected = u.value === unit;
                    return (
                      <TouchableOpacity
                        key={u.value}
                        onPress={() => {
                          setUnit(u.value);
                          unitScrollRef.current?.scrollTo({ y: index * 40, animated: true });
                        }}
                        style={addStyles.pickerItem}
                      >
                        <Text style={[
                          addStyles.pickerItemText,
                          isSelected && addStyles.pickerItemTextSelected
                        ]}>
                          {getText(u.labelTh, u.labelEn)}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
                <View style={addStyles.pickerHighlight} pointerEvents="none" />
              </View>
            </View>
          </View>

          <View style={addStyles.inputSection}>
            <Text style={addStyles.label}>{getText('วันหมดอายุ', 'Due Date')}</Text>

            <TouchableOpacity
              style={addStyles.datePickerButton}
              onPress={() => setShowDatePicker(true)}
            >
              <View style={addStyles.datePickerContent}>
                <Ionicons name="calendar-outline" size={24} color="#4CAF50" />
                <View style={addStyles.dateInfo}>
                  <Text style={addStyles.dateText}>{formatDate(expirationDate)}</Text>
                  <Text style={addStyles.dateSubtext}>{getDaysUntilExpiration()}</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#999" />
              </View>
            </TouchableOpacity>

            <View style={addStyles.quickDatesContainer}>
              <Text style={addStyles.quickDatesLabel}>{getText('เลือกเร็ว:', 'Quick select:')}</Text>
              <View style={addStyles.quickDatesRow}>
                {[
                  { labelTh: 'วันนี้', labelEn: 'Today', days: 0 },
                  { labelTh: 'พรุ่งนี้', labelEn: 'Tomorrow', days: 1 },
                  { labelTh: '3 วัน', labelEn: '3 days', days: 3 },
                  { labelTh: '1 สัปดาห์', labelEn: '1 week', days: 7 },
                ].map((option) => (
                  <TouchableOpacity
                    key={option.labelEn}
                    style={addStyles.quickDateButton}
                    onPress={() => {
                      const newDate = new Date();
                      newDate.setDate(newDate.getDate() + option.days);
                      setExpirationDate(newDate);
                    }}
                  >
                    <Text style={addStyles.quickDateText}>{getText(option.labelTh, option.labelEn)}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>
        </ScrollView>

        {showDatePicker && (
          <View style={addStyles.datePickerOverlay}>
            <View style={addStyles.datePickerModal}>
              <View style={addStyles.datePickerHeader}>
                <Text style={addStyles.datePickerTitle}>{getText('เลือกวันที่', 'Select Date')}</Text>
                <TouchableOpacity onPress={() => setShowDatePicker(false)}>
                  <Text style={addStyles.datePickerDone}>{getText('เสร็จสิ้น', 'Done')}</Text>
                </TouchableOpacity>
              </View>

              <View style={addStyles.calendarContainer}>
                <View style={addStyles.calendarNav}>
                  <TouchableOpacity onPress={() => changeMonth(-1)} style={addStyles.navButton}>
                    <Ionicons name="chevron-back" size={24} color="#333" />
                  </TouchableOpacity>
                  <Text style={addStyles.monthYearText}>
                    {currentMonth.toLocaleDateString('th-TH', { month: 'long', year: 'numeric' })}
                  </Text>
                  <TouchableOpacity onPress={() => changeMonth(1)} style={addStyles.navButton}>
                    <Ionicons name="chevron-forward" size={24} color="#333" />
                  </TouchableOpacity>
                </View>

                <View style={addStyles.weekDaysRow}>
                  {['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.'].map((day) => (
                    <Text key={day} style={addStyles.weekDayText}>{day}</Text>
                  ))}
                </View>

                <View style={addStyles.daysGrid}>
                  {Array.from({ length: getDaysInMonth(currentMonth).startingDayOfWeek }).map((_, index) => (
                    <View key={`empty-${index}`} style={addStyles.emptyDay} />
                  ))}
                  {Array.from({ length: getDaysInMonth(currentMonth).daysInMonth }).map((_, index) => {
                    const day = index + 1;
                    return (
                      <TouchableOpacity
                        key={day}
                        style={[
                          addStyles.dayCell,
                          isToday(day) && addStyles.todayCell,
                          isSelected(day) && addStyles.selectedCell
                        ]}
                        onPress={() => selectDate(day)}
                      >
                        <Text style={[
                          addStyles.dayText,
                          isToday(day) && addStyles.todayText,
                          isSelected(day) && addStyles.selectedText
                        ]}>
                          {day}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            </View>
          </View>
        )}
      </SafeAreaView>
    </Modal>
  );
}