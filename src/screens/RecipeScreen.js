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

  const scrollViewRef = useRef();

  const handleGenerateRecipe = async () => {
    if (!craving.trim()) {
      Alert.alert(
        getText('ข้อผิดพลาด', 'Error'),
        getText('กรุณากรอกอาหารที่คุณอยากทาน', 'Please enter what you\'re craving')
      );
      return;
    }

    if (inventory.length === 0) {
      Alert.alert(
        getText('ไม่มีวัตถุดิบ', 'No Ingredients'),
        getText(
          'คุณไม่มีวัตถุดิบในคลัง กรุณาเพิ่มวัตถุดิบก่อน',
          'You don\'t have any ingredients in your inventory. Please add some first.'
        )
      );
      return;
    }

    setLoading(true);

    // Add user message
    const userMessage = {
      id: Date.now().toString(),
      type: 'user',
      text: craving,
    };
    setMessages((prev) => [...prev, userMessage]);

    try {
      // Call backend API for recipe generation
      const ingredients = inventory.map((item) => ({
        name: item.name,
        quantity: item.quantity,
        unit: item.unit,
      }));

      const response = await APIService.generateRecipe(ingredients, craving, language);

      // APIService returns data.data which is { recipe: "..." }
      const recipeText = response?.recipe;

      if (recipeText) {
        const aiMessage = {
          id: (Date.now() + 1).toString(),
          type: 'ai',
          text: recipeText,
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
      setCraving('');
    }
  };

  const handleClearChat = () => {
    setMessages([]);
  };

  const renderMessage = (message) => {
    const isUser = message.type === 'user';
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
        {/* Header */}
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

        {/* Messages */}
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
                {getText(
                  'ฉันจะแนะนำเมนูที่เหมาะสมจากวัตถุดิบที่คุณมี',
                  'I\'ll suggest recipes based on your ingredients'
                )}
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

        {/* Input */}
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
            onSubmitEditing={handleGenerateRecipe}
            editable={!loading}
          />
          <TouchableOpacity
            onPress={handleGenerateRecipe}
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
