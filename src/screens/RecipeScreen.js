import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLanguage } from '../context/LanguageContext';
import { useInventory } from '../context/InventoryContext';
import APIService from '../services/apiService';

export default function RecipeScreen() {
  const { getText, language } = useLanguage();
  const { inventory } = useInventory();
  const [craving, setCraving] = useState('');
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [previousMenus, setPreviousMenus] = useState([]); // Store all suggested menus

  const scrollViewRef = useRef();

  const handleSendCraving = async () => {
    if (!craving.trim()) {
      Alert.alert(
        getText('ข้อผิดพลาด', 'Error'),
        getText('กรุณากรอกอาหารที่คุณอยากทาน', 'Please enter what you\'re craving')
      )
      return;
    }

    if (inventory.length === 0) {
      Alert.alert(
        getText('ไม่มีวัตถุดิบ', 'No Ingredients'),
        getText(
          'คุณไม่มีวัตถุดิบในคลังกรุณาเพิ่มวัตถุดิบก่อน',
          'You don\'t have any ingredients in your inventory. Please add some first.'
        )
      );
      return;
    }

    setLoading(true);

    const userMessage = {
      id: Date.now().toString(),
      type: 'user',
      text: craving,
    };
    setMessages((prev) => [...prev, userMessage]);

    try {
      const ingredients = inventory.map((item) => ({
        name: item.name,
        quantity: item.quantity,
        unit: item.unit,
      }));

      // Step 1: Suggest menu options (names only)
      const response = await APIService.suggestMenu(ingredients, language);
      const menuText = response?.menu;

      if (menuText) {
        // Parse menu options from the response (assuming numbered list format: "1. Dish Name")
        const menuOptions = parseMenuOptions(menuText);
        setPreviousMenus((prev) => [...prev, ...menuOptions]);

        const aiMessage = {
          id: (Date.now() + 1).toString(),
          type: 'ai-menu',
          text: menuText,
          options: menuOptions,
        };
        setMessages((prev) => [...prev, aiMessage]);
      } else {
        Alert.alert(
          getText('ข้อผิดพลาด', 'Error'),
          getText('ไม่สามารถแนะนำเมนูได้', 'Failed to suggest menus')
        );
      }
    } catch (error) {
      Alert.alert(
        getText('ข้อผิดพลาด', 'Error'),
        error.message || getText('เกิดข้อผิดพลาด', 'An error occurred')
      );
    } finally {
      setLoading(false);
      setCraving('');
    }
  };

  const handleSelectMenu = async (selectedDish) => {
    setLoading(true);

    try {
      const ingredients = inventory.map((item) => ({
        name: item.name,
        quantity: item.quantity,
        unit: item.unit,
      }));

      // Step 2: Generate full recipe for selected dish
      const response = await APIService.generateRecipe(ingredients, selectedDish, language);
      const recipeText = response?.recipe;

      if (recipeText) {
        const aiMessage = {
          id: (Date.now() + 1).toString(),
          type: 'ai-recipe',
          text: recipeText,
          dish: selectedDish,
        };
        setMessages((prev) => [...prev, aiMessage]);
      } else {
        Alert.alert(
          getText('ข้อผิดพลาด', 'Error'),
          getText('ไม่สามารถสร้างสูตรอาหารได้', 'Failed to generate recipe')
        );
      }
    } catch (error) {
      Alert.alert(
        getText('ข้อผิดพลาด', 'Error'),
        error.message || getText('เกิดข้อผิดพลาด', 'An error occurred')
      );
    } finally {
      setLoading(false);
    }
  };

  const handleResuggestMenus = async () => {
    setLoading(true);

    try {
      const ingredients = inventory.map((item) => ({
        name: item.name,
        quantity: item.quantity,
        unit: item.unit,
      }));

      // Step 1b: Re-suggest different menus
      const response = await APIService.resuggestMenu(ingredients, previousMenus, language);
      const menuText = response?.menu;

      if (menuText) {
        const menuOptions = parseMenuOptions(menuText);
        setPreviousMenus((prev) => [...prev, ...menuOptions]);

        const aiMessage = {
          id: (Date.now() + 1).toString(),
          type: 'ai-menu',
          text: menuText,
          options: menuOptions,
        };
        setMessages((prev) => [...prev, aiMessage]);
      } else {
        Alert.alert(
          getText('ข้อผิดพลาด', 'Error'),
          getText('ไม่สามารถแนะนำเมนูใหม่ได้', 'Failed to suggest new menus')
        );
      }
    } catch (error) {
      Alert.alert(
        getText('ข้อผิดพลาด', 'Error'),
        error.message || getText('เกิดข้อผิดพลาด', 'An error occurred')
      );
    } finally {
      setLoading(false);
    }
  };

  const parseMenuOptions = (menuText) => {
    // Parse numbered list format: "1. Dish Name" or "1. Dish Name\n2. Another Dish"
    const lines = menuText.split('\n').filter(line => line.trim());
    return lines.map(line => {
      // Remove number prefix (e.g., "1. ", "2. ")
      const dishName = line.replace(/^\d+\.\s*/, '').trim();
      return dishName;
    }).filter(dish => dish.length > 0);
  };

  const handleClearChat = () => {
    setMessages([]);
    setPreviousMenus([]);
  };

  const renderMessage = (message) => {
    const isUser = message.type === 'user';

    if (message.type === 'ai-menu') {
      // Render clickable menu options
      return (
        <View key={message.id} style={{ marginVertical: 8 }}>
          <View
            style={{
              alignSelf: 'flex-start',
              backgroundColor: '#333',
              padding: 12,
              borderRadius: 12,
              maxWidth: '90%',
            }}
          >
            <Text style={{ color: 'white', fontSize: 15, marginBottom: 8 }}>
              {message.text}
            </Text>
          </View>

          {/* Render clickable menu options */}
          <View style={{ flexDirection: 'column', marginLeft: 8, marginTop: 8 }}>
            {message.options.map((option) => (
              <TouchableOpacity
                key={option}
                onPress={() => handleSelectMenu(option)}
                disabled={loading}
                style={{
                  backgroundColor: loading ? '#555' : '#4CAF50',
                  padding: 12,
                  borderRadius: 8,
                  marginBottom: 6,
                  flexDirection: 'row',
                  alignItems: 'center',
                }}
              >
                <Ionicons name="restaurant-outline" size={18} color="white" style={{ marginRight: 8 }} />
                <Text style={{ color: 'white', fontSize: 15, fontWeight: '600' }}>
                  {option}
                </Text>
              </TouchableOpacity>
            ))}

            {/* "More options" button */}
            <TouchableOpacity
              onPress={handleResuggestMenus}
              disabled={loading}
              style={{
                backgroundColor: loading ? '#555' : '#FF9800',
                padding: 10,
                borderRadius: 8,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                marginTop: 4,
              }}
            >
              <Ionicons name="refresh-outline" size={16} color="white" style={{ marginRight: 6 }} />
              <Text style={{ color: 'white', fontSize: 13, fontWeight: '600' }}>
                {getText('แนะนำอีก', 'More options')}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }

    return (
      <View
        key={message.id}
        style={{
          alignSelf: isUser ? 'flex-end' : 'flex-start',
          backgroundColor: isUser ? '#4CAF50' : '#333',
          padding: 12,
          borderRadius: 12,
          marginVertical: 4,
          maxWidth: '80%',
        }}
      >
        {message.type === 'ai-recipe' && message.dish && (
          <Text style={{ color: '#4CAF50', fontSize: 13, fontWeight: 'bold', marginBottom: 6 }}>
            🍽️ {message.dish}
          </Text>
        )}
        <Text style={{ color: 'white', fontSize: 15 }}>{message.text}</Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#1a1a1a' }}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
        keyboardVerticalOffset={90}
      >
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: 16,
            borderBottomWidth: 1,
            borderBottomColor: '#333',
          }}
        >
          <Text style={{ color: 'white', fontSize: 20, fontWeight: 'bold' }}>
            {getText('แนะนำเมนู', 'Recipe Suggestions')} 🍳
          </Text>
          {messages.length > 0 && (
            <TouchableOpacity onPress={handleClearChat}>
              <Ionicons name="trash-outline" size={24} color="#FF6B6B" />
            </TouchableOpacity>
          )}
        </View>

        <ScrollView
          ref={scrollViewRef}
          style={{ flex: 1, padding: 16 }}
          contentContainerStyle={{ paddingBottom: 20 }}
          onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
        >
          {messages.length === 0 ? (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', marginTop: 100 }}>
              <Text style={{ fontSize: 60, marginBottom: 16 }}>👨‍🍳</Text>
              <Text style={{ color: 'white', fontSize: 18, fontWeight: 'bold', textAlign: 'center' }}>
                {getText('วันนี้ กินไรดี', 'Tell me what you\'re craving')}
              </Text>
              <Text style={{ color: '#999', fontSize: 14, textAlign: 'center', marginTop: 8 }}>
                {getText('ฉันจะแนะนำเมนู', 'I\'ll suggest recipes based on your ingredients')}
              </Text>
            </View>
          ) : (
            <>
              {messages.map(renderMessage)}
              {loading && (
                <View style={{ alignSelf: 'flex-start', marginVertical: 8 }}>
                  <ActivityIndicator size="small" color="#4CAF50" />
                </View>
              )}
            </>
          )}
        </ScrollView>

        <View
          style={{
            flexDirection: 'row',
            padding: 16,
            borderTopWidth: 1,
            borderTopColor: '#333',
            alignItems: 'center',
          }}
        >
          <TextInput
            style={{
              flex: 1,
              backgroundColor: '#333',
              color: 'white',
              padding: 12,
              borderRadius: 20,
              fontSize: 16,
              marginRight: 8,
            }}
            placeholder={getText('ฉันอยากทาน...', 'I\'m craving...')}
            placeholderTextColor="#999"
            value={craving}
            onChangeText={setCraving}
            onSubmitEditing={handleSendCraving}
            editable={!loading}
          />
          <TouchableOpacity
            onPress={handleSendCraving}
            disabled={loading}
            style={{
              backgroundColor: loading ? '#666' : '#4CAF50',
              width: 44,
              height: 44,
              borderRadius: 22,
              justifyContent: 'center',
              alignItems: 'center',
            }}
          >
            {loading ? (
              <ActivityIndicator size="small" color="white" />
            ) : (
              <Ionicons name="send" size={20} color="white" />
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
