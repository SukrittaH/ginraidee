import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useLanguage } from '../context/LanguageContext';
import { useInventory } from '../context/InventoryContext';
import APIService from '../services/apiService';

export default function RecipeScreen() {
  const { getText, language } = useLanguage();
  const { inventory } = useInventory();
  const [craving, setCraving] = useState('');
  const [currentCravingContext, setCurrentCravingContext] = useState(''); // Store the craving for re-suggestions
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [previousMenus, setPreviousMenus] = useState([]);

  const MESSAGE_TYPES = {
    USER: 'user',
    AI_MENU: 'ai-menu',
    AI_RECIPE: 'ai-recipe',
    AI_CONVERSATIONAL: 'ai-conversational',
  };

  const scrollViewRef = useRef();

  const handleSendCraving = async () => {
    if (!craving.trim()) {
      Alert.alert(
        getText('ข้อผิดพลาด', 'Error'),
        getText('กรุณากรอกอาหารที่คุณอยากทาน', "Please enter what you're craving")
      );
      return;
    }

    if (inventory.length === 0) {
      Alert.alert(
        getText('ไม่มีวัตถุดิบ', 'No Ingredients'),
        getText(
          'คุณไม่มีวัตถุดิบในคลังกรุณาเพิ่มวัตถุดิบก่อน',
          "You don't have any ingredients in your inventory. Please add some first."
        )
      );
      return;
    }

    const userMessage = {
      id: Date.now().toString(),
      type: MESSAGE_TYPES.USER,
      text: craving,
    };
    setMessages((prev) => [...prev, userMessage]);
    const currentCraving = craving;
    setCurrentCravingContext(craving); // Store for re-suggestions
    setCraving(''); // Clear input immediately so it can't fire twice
    setLoading(true);

    try {
      // ── Intent check via API endpoint ──────────────────────────
      const intentResponse = await APIService.checkIntent(currentCraving, language);
      console.log('🔍 Intent Response:', JSON.stringify(intentResponse));

      if (intentResponse?.intent !== 'food') {
        const aiMessage = {
          id: (Date.now() + 1).toString(),
          type: MESSAGE_TYPES.AI_CONVERSATIONAL,
          text: getText(
            'ขอโทษนะครับ ผมช่วยได้เฉพาะเรื่องอาหารครับ ลองบอกว่าอยากกินอะไรได้เลย 🍳',
            "I can only help with food suggestions! Tell me what you're craving 🍳"
          ),
        };
        setMessages((prev) => [...prev, aiMessage]);
        return;
      }

      // ── Food intent confirmed → suggest menus ─────────────────────────
      const ingredients = inventory.map((item) => ({
        name: item.name,
        quantity: item.quantity,
        unit: item.unit,
      }));

      const response = await APIService.suggestMenu(ingredients, currentCraving, language);
      const menuText = response?.menu;

      if (menuText) {
        const menuOptions = parseMenuOptions(menuText);
        setPreviousMenus((prev) => [...prev, ...menuOptions]);

        const aiMessage = {
          id: (Date.now() + 1).toString(),
          type: MESSAGE_TYPES.AI_MENU,
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

      const response = await APIService.generateRecipe(ingredients, selectedDish, language);
      const recipeText = response?.recipe;

      if (recipeText) {
        const aiMessage = {
          id: (Date.now() + 1).toString(),
          type: MESSAGE_TYPES.AI_RECIPE,
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

      const response = await APIService.resuggestMenu(ingredients, previousMenus, language, currentCravingContext);
      const menuText = response?.menu;

      if (menuText) {
        const menuOptions = parseMenuOptions(menuText);
        setPreviousMenus((prev) => [...prev, ...menuOptions]);

        const aiMessage = {
          id: (Date.now() + 1).toString(),
          type: MESSAGE_TYPES.AI_MENU,
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
    const lines = menuText.split('\n').filter((line) => line.trim());
    return lines
      .map((line) => line.replace(/^\d+\.\s*/, '').trim())
      .filter((dish) => dish.length > 0);
  };

  const handleClearChat = () => {
    setMessages([]);
    setPreviousMenus([]);
    setCurrentCravingContext('');
  };

  const renderConversationalMessage = (message) => (
    <View
      key={message.id}
      style={{
        alignSelf: 'flex-start',
        backgroundColor: '#dfe6e9',
        padding: 12,
        borderRadius: 12,
        marginVertical: 4,
        maxWidth: '80%',
      }}
    >
      <Text style={{ color: '#2d3436', fontSize: 15 }}>{message.text}</Text>
    </View>
  );

  const renderMenuMessage = (message) => (
    <View key={message.id} style={{ marginVertical: 8 }}>
      <View style={{ flexDirection: 'column', gap: 8 }}>
        {message.options.map((option) => (
          <TouchableOpacity
            key={option}
            onPress={() => handleSelectMenu(option)}
            disabled={loading}
            style={{ marginBottom: 4 }}
          >
            <LinearGradient
              colors={['#51f447', '#fcffdf', '#1ee4d9']}
              start={{ x: 0, y: 0 }}
              end={{ x: 0, y: 1 }}
              style={{
                padding: 2,
                borderRadius: 25,
              }}
            >
              <LinearGradient
                colors={loading ? ['#dfe6e9', '#dfe6e9'] : ['#cdffd8', '#94b9ff']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{
                  padding: 16,
                  borderRadius: 23,
                  flexDirection: 'row',
                  alignItems: 'center',
                }}
              >
                <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#2d3436', marginRight: 12 }} />
                <Text style={{ color: '#2d3436', fontSize: 15, fontWeight: '500', flex: 1 }}>
                  {option}
                </Text>
              </LinearGradient>
            </LinearGradient>
          </TouchableOpacity>
        ))}

        <TouchableOpacity
          onPress={handleResuggestMenus}
          disabled={loading}
          style={{
            backgroundColor: loading ? '#636e72' : '#37270f',
            padding: 14,
            borderRadius: 25,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            marginTop: 8,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.2,
            shadowRadius: 4,
            elevation: 3,
          }}
        >
          <Ionicons name="refresh-outline" size={16} color="white" style={{ marginRight: 6 }} />
          <Text style={{ color: 'white', fontSize: 14, fontWeight: '600' }}>
            {getText('แนะนำเพิ่ม', 'More options')}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const formatRecipeText = (text) => {
    // Clean markdown formatting safely
    let cleaned = text;
    // Remove markdown headers (### ) - iterate to handle multiple #
    while (cleaned.includes('### ')) {
      cleaned = cleaned.replace('### ', '');
    }
    while (cleaned.includes('## ')) {
      cleaned = cleaned.replace('## ', '');
    }
    // Remove horizontal rules (---) - safe replacement
    while (cleaned.includes('---')) {
      cleaned = cleaned.replace('---', '');
    }
    // Remove bold markers
    cleaned = cleaned.replaceAll('**', '').replaceAll('*', '');
    // Convert dashes to bullets
    return cleaned
      .split('\n')
      .map(line => line.startsWith('- ') ? '• ' + line.slice(2) : line)
      .join('\n')
      .trim();
  };

  const renderRecipeMessage = (message) => {

      // Split recipe into sections and clean leading numbers/text
      const sectionEmojis = new Set(['🍽️', '🛒', '👨‍🍳', '💡']);
      const sections = [];
      let currentSection = '';

      for (const char of message.text) {
        if (sectionEmojis.has(char)) {
          if (currentSection.trim()) {
            sections.push(currentSection.trim());
          }
          currentSection = char;
        } else {
          currentSection += char;
        }
      }
      if (currentSection.trim()) {
        sections.push(currentSection.trim());
      }

      // Remove leading "### 1. ", "2. ", etc. before emoji from each section
      const cleanedSections = sections.map(section =>
        section.replace(/^(###\s*)?\d+\.\s*/, '').trim()
      );

      return (
        <View key={message.id} style={{ marginVertical: 8, alignSelf: 'flex-start', maxWidth: '95%' }}>
          {cleanedSections.filter(section => section.trim()).map((section, index) => (
            <View key={`recipe-section-${message.id}-${index}`} style={{ marginBottom: 8 }}>
              <LinearGradient
                colors={['#51f447', '#fcffdf', '#1ee4d9']}
                start={{ x: 0, y: 0 }}
                end={{ x: 0, y: 1 }}
                style={{
                  padding: 2,
                  borderRadius: 16,
                }}
              >
                <LinearGradient
                  colors={['#cdffd8', '#94b9ff']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={{
                    padding: 16,
                    borderRadius: 14,
                  }}
                >
                  <Text style={{ color: '#2d3436', fontSize: 15, lineHeight: 22 }}>
                    {formatRecipeText(section.trim())}
                  </Text>
                </LinearGradient>
              </LinearGradient>
            </View>
          ))}
        </View>
      );
  };

  const renderMessage = (message) => {
    if (message.type === MESSAGE_TYPES.AI_CONVERSATIONAL) {
      return renderConversationalMessage(message);
    }

    if (message.type === MESSAGE_TYPES.AI_MENU) {
      return renderMenuMessage(message);
    }

    if (message.type === MESSAGE_TYPES.AI_RECIPE) {
      return renderRecipeMessage(message);
    }

    // Default: render user message
    const isUser = message.type === MESSAGE_TYPES.USER;
    return (
      <View
        key={message.id}
        style={{
          alignSelf: isUser ? 'flex-end' : 'flex-start',
          backgroundColor: isUser ? '#e6e1c7' : '#ffffff',
          padding: 14,
          borderRadius: 16,
          marginVertical: 4,
          maxWidth: '80%',
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.1,
          shadowRadius: 2,
          elevation: 2,
        }}
      >
        <Text style={{ color: '#2d3436', fontSize: 15 }}>{message.text}</Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#ffffff' }}>
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
            backgroundColor: '#ffffff',
          }}
        >
          <Text style={{ color: '#2d3436', fontSize: 20, fontWeight: 'bold' }}>
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
          style={{ flex: 1, padding: 16, backgroundColor: 'transparent' }}
          contentContainerStyle={{ paddingBottom: 20 }}
          onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
        >
          {messages.length === 0 ? (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', marginTop: 100 }}>
              <Text style={{ fontSize: 60, marginBottom: 16 }}>👨‍🍳</Text>
              <Text style={{ color: '#2d3436', fontSize: 18, fontWeight: 'bold', textAlign: 'center' }}>
                {getText('วันนี้ กินไรดี', "Tell me what you're craving")}
              </Text>
              <Text style={{ color: '#636e72', fontSize: 14, textAlign: 'center', marginTop: 8 }}>
                {getText('ฉันจะแนะนำเมนู', "I'll suggest recipes based on your ingredients")}
              </Text>
            </View>
          ) : (
            <>
              {messages.map(renderMessage)}
              {loading && (
                <View style={{ alignSelf: 'flex-start', marginVertical: 8 }}>
                  <ActivityIndicator size="small" color="#55a630" />
                </View>
              )}
            </>
          )}
        </ScrollView>

        <View
          style={{
            flexDirection: 'row',
            padding: 16,
            backgroundColor: '#ffffff',
            alignItems: 'center',
          }}
        >
          <View style={{ flex: 1, marginRight: 10 }}>
            <LinearGradient
              colors={['#51f447', '#fcffdf', '#1ee4d9']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={{
                borderRadius: 25,
                padding: 2,
              }}
            >
              <TextInput
                style={{
                  backgroundColor: 'white',
                  color: '#2d3436',
                  padding: 12,
                  borderRadius: 23,
                  fontSize: 16,
                }}
                placeholder={getText('ฉันอยากทาน.....', "I'm craving.....")}
                placeholderTextColor="#b2bec3"
                value={craving}
                onChangeText={setCraving}
                onSubmitEditing={handleSendCraving}
                editable={!loading}
              />
            </LinearGradient>
          </View>
          <TouchableOpacity
            onPress={handleSendCraving}
            disabled={loading}
            style={{
              backgroundColor: loading ? '#b2bec3' : '#74b9ff',
              width: 44,
              height: 44,
              borderRadius: 22,
              justifyContent: 'center',
              alignItems: 'center',
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.15,
              shadowRadius: 3,
              elevation: 3,
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