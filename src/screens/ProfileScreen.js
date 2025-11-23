import React from 'react';
import {
  View,
  Text,
  ScrollView,
  SafeAreaView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLanguage } from '../context/LanguageContext';

export default function ProfileScreen() {
  const { getText } = useLanguage();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#1a1a1a' }}>
      <ScrollView style={{ flex: 1, padding: 16 }}>
        <Text style={{ color: 'white', fontSize: 28, fontWeight: 'bold', marginBottom: 24 }}>
          {getText('โปรไฟล์', 'Profile')}
        </Text>

        {/* App Info Card */}
        <View
          style={{
            backgroundColor: '#2a2a2a',
            borderRadius: 12,
            padding: 16,
            marginBottom: 24,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
            <View
              style={{
                width: 60,
                height: 60,
                borderRadius: 30,
                backgroundColor: '#4CAF50',
                justifyContent: 'center',
                alignItems: 'center',
                marginRight: 16,
              }}
            >
              <Ionicons name="restaurant" size={30} color="white" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: 'white', fontSize: 18, fontWeight: 'bold' }}>
                Ginraidee
              </Text>
              <Text style={{ color: '#999', fontSize: 14 }}>
                {getText('แอปจัดการอาหาร', 'Food Inventory App')}
              </Text>
            </View>
          </View>
        </View>

        {/* About Section */}
        <Text style={{ color: 'white', fontSize: 18, fontWeight: 'bold', marginBottom: 12, marginTop: 16 }}>
          {getText('เกี่ยวกับแอป', 'About App')}
        </Text>
        <Text style={{ color: '#ccc', fontSize: 14, lineHeight: 22, marginBottom: 24 }}>
          {getText(
            'Ginraidee ช่วยคุณจัดการวัตถุดิบในห้องครัว ติดตามวันหมดอายุ และรับสูตรอาหารจาก AI โดยใช้วัตถุดิบที่มีอยู่',
            'Ginraidee helps you manage your kitchen ingredients, track expiration dates, and get AI-powered recipes based on what you have available.'
          )}
        </Text>

        {/* Features Section */}
        <Text style={{ color: 'white', fontSize: 18, fontWeight: 'bold', marginBottom: 12 }}>
          {getText('คุณสมบัติ', 'Features')}
        </Text>
        <View style={{ marginBottom: 24 }}>
          <FeatureItem
            icon="restaurant"
            title={getText('จัดการวัตถุดิบ', 'Manage Ingredients')}
            description={getText('เพิ่ม แก้ไข และลบวัตถุดิบ', 'Add, edit, and delete ingredients')}
          />
          <FeatureItem
            icon="calendar"
            title={getText('ติดตามวันหมดอายุ', 'Track Expiration')}
            description={getText('รับการแจ้งเตือนสำหรับรายการที่หมดอายุเร็วๆ', 'Get alerts for items expiring soon')}
          />
          <FeatureItem
            icon="camera"
            title={getText('สแกนกล่อง', 'Scan Boxes')}
            description={getText('ถ่ายรูปเพื่อเพิ่มวัตถุดิบอย่างรวดเร็ว', 'Take photos to quickly add ingredients')}
          />
          <FeatureItem
            icon="sparkles"
            title={getText('สูตรอาหาร AI', 'AI Recipes')}
            description={getText('รับสูตรอาหารจากวัตถุดิบของคุณ', 'Get recipes based on your ingredients')}
          />
        </View>

        {/* Version Info */}
        <View style={{ borderTopWidth: 1, borderTopColor: '#444', paddingTop: 16 }}>
          <Text style={{ color: '#666', fontSize: 12, textAlign: 'center' }}>
            v1.0.0
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function FeatureItem({ icon, title, description }) {
  return (
    <View style={{ flexDirection: 'row', marginBottom: 16, alignItems: 'flex-start' }}>
      <View
        style={{
          width: 40,
          height: 40,
          borderRadius: 8,
          backgroundColor: '#4CAF50',
          justifyContent: 'center',
          alignItems: 'center',
          marginRight: 12,
        }}
      >
        <Ionicons name={icon} size={20} color="white" />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ color: 'white', fontSize: 14, fontWeight: 'bold', marginBottom: 4 }}>
          {title}
        </Text>
        <Text style={{ color: '#999', fontSize: 12 }}>
          {description}
        </Text>
      </View>
    </View>
  );
}