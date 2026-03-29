import React from 'react';
import {
  View,
  Text,
  ScrollView,
  SafeAreaView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';

export default function ProfileScreen() {
  const { getText } = useLanguage();
  const { user, logout, isLoading } = useAuth();

  const handleLogout = async () => {
    Alert.alert(
      getText('Confirm Logout', 'Confirm Logout'),
      getText('Are you sure you want to sign out?', 'Are you sure you want to sign out?'),
      [
        { text: getText('Cancel', 'Cancel'), onPress: () => {} },
        {
          text: getText('Sign Out', 'Sign Out'),
          onPress: async () => {
            try {
              await logout();
            } catch (err) {
              Alert.alert('Error', 'Failed to sign out');
            }
          },
          style: 'destructive',
        },
      ]
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#ffffff' }}>
      <ScrollView style={{ flex: 1, padding: 16 }}>
        <Text style={{ color: '#2d3436', fontSize: 28, fontWeight: 'bold', marginBottom: 24 }}>
          {getText('โปรไฟล์', 'Profile')}
        </Text>

        {/* User Info Card */}
        {user && (
          <LinearGradient
            colors={['#91ef8b', '#fcffdf', '#58f8ef']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={{ padding: 2, borderRadius: 16, marginBottom: 16 }}
          >
            <LinearGradient
              colors={['#dbf8e1', '#bcd3ff']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{
                borderRadius: 14,
                padding: 16,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                <View
                  style={{
                    width: 60,
                    height: 60,
                    borderRadius: 30,
                    backgroundColor: '#74b9ff',
                    justifyContent: 'center',
                    alignItems: 'center',
                    marginRight: 16,
                  }}
                >
                  <Ionicons name="person" size={30} color="white" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: '#2d3436', fontSize: 18, fontWeight: 'bold' }}>
                    {user.name || user.preferredUsername || 'User'}
                  </Text>
                  <Text style={{ color: '#636e72', fontSize: 13 }}>
                    {user.email}
                  </Text>
                </View>
              </View>
            </LinearGradient>
          </LinearGradient>
        )}

        {/* App Info Card */}
        <LinearGradient
          colors={['#91ef8b', '#fcffdf', '#58f8ef']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={{ padding: 2, borderRadius: 16, marginBottom: 16 }}
        >
          <LinearGradient
            colors={['#dbf8e1', '#bcd3ff']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{
              borderRadius: 14,
              padding: 16,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
              <View
                style={{
                  width: 60,
                  height: 60,
                  borderRadius: 30,
                  backgroundColor: '#74b9ff',
                  justifyContent: 'center',
                  alignItems: 'center',
                  marginRight: 16,
                }}
              >
                <Ionicons name="restaurant" size={30} color="white" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: '#2d3436', fontSize: 18, fontWeight: 'bold' }}>
                  Ginraidee
                </Text>
                <Text style={{ color: '#636e72', fontSize: 14 }}>
                  {getText('แอปจัดการอาหาร', 'Food Inventory App')}
                </Text>
              </View>
            </View>
          </LinearGradient>
        </LinearGradient>

        {/* About Section */}
        <Text style={{ color: '#2d3436', fontSize: 18, fontWeight: 'bold', marginBottom: 12, marginTop: 16 }}>
          {getText('เกี่ยวกับแอป', 'About App')}
        </Text>
        <Text style={{ color: '#636e72', fontSize: 14, lineHeight: 22, marginBottom: 24 }}>
          {getText(
            'Ginraidee ช่วยคุณจัดการวัตถุดิบในห้องครัว ติดตามวันหมดอายุ และรับสูตรอาหารจาก AI โดยใช้วัตถุดิบที่มีอยู่',
            'Ginraidee helps you manage your kitchen ingredients, track expiration dates, and get AI-powered recipes based on what you have available.'
          )}
        </Text>

        {/* Features Section */}
        <Text style={{ color: '#2d3436', fontSize: 18, fontWeight: 'bold', marginBottom: 12 }}>
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

        {/* Logout Button */}
        {user && (
          <TouchableOpacity
            style={{
              backgroundColor: '#ff6b6b',
              padding: 14,
              borderRadius: 12,
              alignItems: 'center',
              marginBottom: 24,
            }}
            onPress={handleLogout}
            disabled={isLoading}
          >
            <Text style={{ color: 'white', fontSize: 16, fontWeight: '600' }}>
              {getText('Sign Out', 'Sign Out')}
            </Text>
          </TouchableOpacity>
        )}

        {/* Version Info */}
        <View style={{ borderTopWidth: 1, borderTopColor: '#e0e0e0', paddingTop: 16 }}>
          <Text style={{ color: '#b2bec3', fontSize: 12, textAlign: 'center' }}>
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
          backgroundColor: '#74b9ff',
          justifyContent: 'center',
          alignItems: 'center',
          marginRight: 12,
        }}
      >
        <Ionicons name={icon} size={20} color="white" />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ color: '#2d3436', fontSize: 14, fontWeight: 'bold', marginBottom: 4 }}>
          {title}
        </Text>
        <Text style={{ color: '#636e72', fontSize: 12 }}>
          {description}
        </Text>
      </View>
    </View>
  );
}