import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  ScrollView,
  Image,
  StyleSheet,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import APIService from '../services/apiService';
import { useLanguage } from '../context/LanguageContext';

const CameraScreen = ({ navigation }) => {
  const [permission, requestPermission] = useCameraPermissions();
  const [cameraRef, setCameraRef] = useState(null);
  const [isTakingPhoto, setIsTakingPhoto] = useState(false);
  const [photoUri, setPhotoUri] = useState(null);
  const [photoBase64, setPhotoBase64] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [ocrResult, setOcrResult] = useState(null);
  const [ocrQuality, setOcrQuality] = useState(null);
  const [error, setError] = useState(null);
  const { language } = useLanguage();

  // Translations
  const t = {
    en: {
      camera: 'Camera',
      point: 'Point your camera at the product label',
      tips: 'Tips: Hold steady, avoid glare, ensure good lighting',
      takePhoto: 'Take Photo',
      retake: 'Retake',
      usePhoto: 'Use Photo',
      cancel: 'Cancel',
      processing: 'Processing image...',
      extractedData: 'Extracted Data',
      productName: 'Product Name',
      quantity: 'Quantity',
      unit: 'Unit',
      expiryDate: 'Expiry Date',
      manufacturingDate: 'Manufacturing Date',
      addToInventory: 'Add to Inventory',
      permission: 'Camera permission required',
      permissionMessage: 'Please grant camera permission to use this feature',
      grantPermission: 'Grant Permission',
      errorTitle: 'Error',
      ocrFailed: 'Failed to process image. Please try again.',
      requestingPermission: 'Requesting camera permission...',
      noCameraAccess: 'No camera access',
      qualityLow: 'Low quality scan detected. Consider retaking for better accuracy.',
      qualityMedium: 'Medium quality scan. Results may not be fully accurate.',
      qualityHigh: 'High quality scan!',
    },
    th: {
      camera: 'กล้อง',
      point: 'ชี้กล้องไปที่ฉลากสินค้า',
      tips: 'คำแนะนำ: ถือให้นิ่ง หลีกเลี่ยงแสงสะท้อน แสงสว่างเพียงพอ',
      takePhoto: 'ถ่ายรูป',
      retake: 'ถ่ายใหม่',
      usePhoto: 'ใช้รูปนี้',
      cancel: 'ยกเลิก',
      processing: 'กำลังประมวลผลรูป...',
      extractedData: 'ข้อมูลที่สกัดได้',
      productName: 'ชื่อสินค้า',
      quantity: 'ปริมาณ',
      unit: 'หน่วย',
      expiryDate: 'วันหมดอายุ',
      manufacturingDate: 'วันที่ผลิต',
      addToInventory: 'เพิ่มไปยังสินค้า',
      permission: 'ต้องการสิทธิ์ใช้กล้อง',
      permissionMessage: 'กรุณากำหนดสิทธิ์ใช้กล้องเพื่อใช้คุณลักษณะนี้',
      grantPermission: 'ให้สิทธิ์',
      errorTitle: 'เกิดข้อผิดพลาด',
      ocrFailed: 'ไม่สามารถประมวลผลรูป กรุณาลองใหม่อีกครั้ง',
      requestingPermission: 'กำลังขออนุญาตใช้กล้อง...',
      noCameraAccess: 'ไม่สามารถใช้กล้อง',
      qualityLow: 'คุณภาพการสแกนต่ำ ควรถ่ายใหม่เพื่อความแม่นยำ',
      qualityMedium: 'คุณภาพการสแกนปานกลาง ผลลัพธ์อาจไม่แม่นยำทั้งหมด',
      qualityHigh: 'คุณภาพการสแกนสูง!',
    },
  };

  const currentTranslation = t[language] || t.en;

  // Request camera permission
  useEffect(() => {
    if (!permission?.granted) {
      requestPermission();
    }
  }, [permission]);

  const takePhoto = async () => {
    if (!cameraRef) {
      Alert.alert(currentTranslation.errorTitle, 'Camera not ready');
      return;
    }

    try {
      setIsTakingPhoto(true);
      const photo = await cameraRef.takePictureAsync({
        quality: 0.95, // Higher quality for better OCR
        base64: true,
        skipProcessing: false, // Enable processing for better quality
        // Optimize for text recognition
        exif: false, // Don't need EXIF data
      });
      setPhotoUri(photo.uri);
      // Store base64 data for later use in processPhoto
      setPhotoBase64(photo.base64);
      setIsTakingPhoto(false);
    } catch (err) {
      setIsTakingPhoto(false);
      Alert.alert(currentTranslation.errorTitle, 'Failed to take photo');
      console.error('Camera error:', err);
    }
  };

  const handleRetake = () => {
    setPhotoUri(null);
    setPhotoBase64(null);
    setOcrResult(null);
    setOcrQuality(null);
    setError(null);
  };

  const processPhoto = async () => {
    if (!photoBase64) return;

    try {
      setIsProcessing(true);
      setError(null);

      console.log(`📸 Processing photo with base64 data`);
      console.log(`📸 Base64 length: ${photoBase64.length} characters`);

      // Send base64 string directly as form field - backend will decode it
      const formData = new FormData();
      formData.append('base64Image', photoBase64);
      formData.append('language', language);

      console.log('📸 Sending image to OCR endpoint...');
      const result = await APIService.processOCR(formData);

      if (result.success && result.data.parsed) {
        setOcrResult(result.data.parsed);
        setOcrQuality(result.data.quality || null);

        // Log quality info
        if (result.data.quality) {
          console.log(`📊 OCR Quality: ${result.data.quality.confidence} (${result.data.quality.score}/100)`);
          if (result.data.quality.issues.length > 0) {
            console.log(`⚠️ Issues: ${result.data.quality.issues.join(', ')}`);
          }
        }
      } else {
        setError(currentTranslation.ocrFailed);
      }
    } catch (err) {
      console.error('OCR Error:', err);
      setError(err.message || currentTranslation.ocrFailed);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleAddToInventory = () => {
    if (!ocrResult) return;

    // Navigate to AddItemModal with OCR data
    // The InventoryScreen should be in the stack
    navigation.navigate('InventoryTab', {
      screen: 'InventoryHome',
      params: {
        ocrData: ocrResult,
        fromCamera: true,
      },
    });
  };

  // No permission
  if (!permission) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>{currentTranslation.requestingPermission}</Text>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>{currentTranslation.permission}</Text>
        <Text style={styles.subtitle}>{currentTranslation.permissionMessage}</Text>
        <TouchableOpacity
          style={styles.permissionButton}
          onPress={requestPermission}
        >
          <Text style={styles.permissionButtonText}>{currentTranslation.grantPermission}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Show photo preview and OCR result if captured
  if (photoUri) {
    return (
      <View style={styles.container}>
        <View style={styles.previewContainer}>
          <Image source={{ uri: photoUri }} style={styles.preview} />
        </View>

        {isProcessing && (
          <View style={styles.processingOverlay}>
            <ActivityIndicator size="large" color="#4CAF50" />
            <Text style={styles.processingText}>{currentTranslation.processing}</Text>
          </View>
        )}

        {error && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {ocrResult && !isProcessing && (
          <ScrollView style={styles.resultContainer}>
            <Text style={styles.resultTitle}>{currentTranslation.extractedData}</Text>

            {/* Quality indicator */}
            {ocrQuality && (
              <View style={[
                styles.qualityBadge,
                ocrQuality.confidence === 'high' ? styles.qualityHigh :
                ocrQuality.confidence === 'medium' ? styles.qualityMedium :
                styles.qualityLow
              ]}>
                <Text style={styles.qualityText}>
                  {ocrQuality.confidence === 'high' ? currentTranslation.qualityHigh :
                   ocrQuality.confidence === 'medium' ? currentTranslation.qualityMedium :
                   currentTranslation.qualityLow}
                </Text>
                {ocrQuality.issues.length > 0 && (
                  <Text style={styles.qualityIssues}>
                    {ocrQuality.issues.join(' • ')}
                  </Text>
                )}
              </View>
            )}

            <View style={styles.resultItem}>
              <Text style={styles.resultLabel}>{currentTranslation.productName}</Text>
              <Text style={styles.resultValue}>{ocrResult.name}</Text>
            </View>

            <View style={styles.resultItem}>
              <Text style={styles.resultLabel}>{currentTranslation.quantity}</Text>
              <Text style={styles.resultValue}>{ocrResult.quantity}</Text>
            </View>

            <View style={styles.resultItem}>
              <Text style={styles.resultLabel}>{currentTranslation.unit}</Text>
              <Text style={styles.resultValue}>{ocrResult.unit}</Text>
            </View>

            {ocrResult.manufacturingDate && (
              <View style={styles.resultItem}>
                <Text style={styles.resultLabel}>{currentTranslation.manufacturingDate}</Text>
                <Text style={styles.resultValue}>
                  {new Date(ocrResult.manufacturingDate).toLocaleDateString(
                    language === 'th' ? 'th-TH' : 'en-US'
                  )}
                </Text>
              </View>
            )}

            {ocrResult.expiryDate && (
              <View style={styles.resultItem}>
                <Text style={styles.resultLabel}>{currentTranslation.expiryDate}</Text>
                <Text style={styles.resultValue}>
                  {new Date(ocrResult.expiryDate).toLocaleDateString(
                    language === 'th' ? 'th-TH' : 'en-US'
                  )}
                </Text>
              </View>
            )}
          </ScrollView>
        )}

        <View style={styles.actionContainer}>
          {!isProcessing && !ocrResult && (
            <TouchableOpacity style={styles.button} onPress={processPhoto}>
              <Text style={styles.buttonText}>{currentTranslation.usePhoto}</Text>
            </TouchableOpacity>
          )}

          {ocrResult && !isProcessing && (
            <TouchableOpacity style={styles.button} onPress={handleAddToInventory}>
              <MaterialCommunityIcons name="plus-circle" size={24} color="white" />
              <Text style={styles.buttonText}>{currentTranslation.addToInventory}</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity style={styles.cancelButton} onPress={handleRetake}>
            <Text style={styles.cancelButtonText}>
              {ocrResult ? currentTranslation.retake : currentTranslation.cancel}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // Camera view
  return (
    <View style={styles.container}>
      <CameraView
        ref={setCameraRef}
        style={styles.camera}
        facing="back"
      />

      {/* Overlay UI - positioned absolutely, not as children of CameraView */}
      <View style={styles.overlay}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>{currentTranslation.camera}</Text>
        </View>

        {/* Instructions */}
        <View style={styles.instructionContainer}>
          <MaterialCommunityIcons name="camera-iris" size={48} color="white" />
          <Text style={styles.instructionText}>{currentTranslation.point}</Text>
          <Text style={styles.tipsText}>{currentTranslation.tips}</Text>
        </View>

        {/* Camera controls */}
        <View style={styles.controlsContainer}>
          <TouchableOpacity
            style={[styles.captureButton, isTakingPhoto && styles.captureButtonDisabled]}
            onPress={takePhoto}
            disabled={isTakingPhoto}
          >
            {isTakingPhoto ? (
              <ActivityIndicator size="large" color="white" />
            ) : (
              <View style={styles.captureButtonInner} />
            )}
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a1a',
  },
  camera: {
    flex: 1,
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'space-between',
    pointerEvents: 'box-none',
  },
  header: {
    paddingTop: 16,
    paddingHorizontal: 20,
    pointerEvents: 'box-none',
  },
  headerTitle: {
    color: 'white',
    fontSize: 24,
    fontWeight: 'bold',
  },
  instructionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  instructionText: {
    color: 'white',
    fontSize: 18,
    marginTop: 16,
    textAlign: 'center',
    paddingHorizontal: 20,
    fontWeight: '600',
  },
  tipsText: {
    color: '#FFD700',
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
    paddingHorizontal: 20,
    fontStyle: 'italic',
  },
  controlsContainer: {
    alignItems: 'center',
    paddingBottom: 40,
  },
  captureButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: 'white',
  },
  captureButtonDisabled: {
    opacity: 0.5,
  },
  captureButtonInner: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#4CAF50',
  },
  previewContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  preview: {
    width: '100%',
    height: '100%',
    resizeMode: 'contain',
  },
  processingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  processingText: {
    color: 'white',
    fontSize: 16,
    marginTop: 16,
  },
  errorContainer: {
    backgroundColor: '#c62828',
    padding: 12,
    marginHorizontal: 20,
    borderRadius: 8,
    marginTop: 12,
  },
  errorText: {
    color: 'white',
    fontSize: 14,
    textAlign: 'center',
  },
  resultContainer: {
    flex: 1,
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#1a1a1a',
  },
  resultTitle: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  resultItem: {
    backgroundColor: '#333',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  resultLabel: {
    color: '#999',
    fontSize: 12,
    marginBottom: 4,
  },
  resultValue: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  actionContainer: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#1a1a1a',
    borderTopWidth: 1,
    borderTopColor: '#333',
  },
  button: {
    backgroundColor: '#4CAF50',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    marginBottom: 8,
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  cancelButton: {
    borderWidth: 1,
    borderColor: '#666',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#999',
    fontSize: 16,
    fontWeight: '600',
  },
  permissionButton: {
    backgroundColor: '#4CAF50',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
    marginTop: 16,
    alignSelf: 'center',
  },
  permissionButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  title: {
    color: 'white',
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 40,
    textAlign: 'center',
  },
  subtitle: {
    color: '#999',
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  qualityBadge: {
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    borderWidth: 1,
  },
  qualityHigh: {
    backgroundColor: '#1b5e20',
    borderColor: '#4CAF50',
  },
  qualityMedium: {
    backgroundColor: '#f57f17',
    borderColor: '#FFC107',
  },
  qualityLow: {
    backgroundColor: '#b71c1c',
    borderColor: '#f44336',
  },
  qualityText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  qualityIssues: {
    color: '#ffeb3b',
    fontSize: 12,
    marginTop: 4,
    textAlign: 'center',
  },
});

export default CameraScreen;
