import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Camera, Upload, X } from 'lucide-react-native';
import { supabase } from '../../lib/supabase';
import { theme } from '../../lib/theme';
import tw from 'twrnc';
import { logger } from '../../lib/logger';

interface ImageUploadProps {
  onUploadComplete: (url: string) => void;
  onUploadError: (error: string) => void;
  maxImages?: number;
  aspectRatio?: number;
  title?: string;
  description?: string;
  existingImages?: string[];
  onRemoveImage?: (index: number) => void;
}

export const ImageUpload: React.FC<ImageUploadProps> = ({
  onUploadComplete,
  onUploadError,
  maxImages = 1,
  aspectRatio = 1,
  title = 'Upload Image',
  description = 'Select an image from your gallery or take a photo',
  existingImages = [],
  onRemoveImage,
}) => {
  const [uploading, setUploading] = useState(false);

  const requestPermissions = async () => {
    if (Platform.OS !== 'web') {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Please grant camera roll permissions to upload images.');
        return false;
      }
    }
    return true;
  };

  const pickImage = async () => {
    const hasPermission = await requestPermissions();
    if (!hasPermission) return;

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [aspectRatio, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        await uploadImage(result.assets[0].uri);
      }
    } catch (error) {
      logger.error('Error picking image:', error);
      onUploadError('Failed to select image');
    }
  };

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please grant camera permissions to take photos.');
      return;
    }

    try {
      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [aspectRatio, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        await uploadImage(result.assets[0].uri);
      }
    } catch (error) {
      logger.error('Error taking photo:', error);
      onUploadError('Failed to take photo');
    }
  };

  const uploadImage = async (uri: string) => {
    if (existingImages.length >= maxImages) {
      onUploadError(`Maximum ${maxImages} image${maxImages > 1 ? 's' : ''} allowed`);
      return;
    }

    setUploading(true);
    try {
      // Convert URI to blob
      const response = await fetch(uri);
      const blob = await response.blob();

      // Generate unique filename
      const fileExt = uri.split('.').pop();
      const fileName = `${Math.random()}.${fileExt}`;
      const filePath = `uploads/${fileName}`;

      // Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('images')
        .upload(filePath, blob);

      if (uploadError) {
        throw uploadError;
      }

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('images')
        .getPublicUrl(filePath);

      onUploadComplete(publicUrl);
    } catch (error) {
      logger.error('Error uploading image:', error);
      onUploadError('Failed to upload image');
    } finally {
      setUploading(false);
    }
  };

  const showUploadOptions = () => {
    Alert.alert(
      'Upload Image',
      'Choose how you want to add an image',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Take Photo', onPress: takePhoto },
        { text: 'Choose from Gallery', onPress: pickImage },
      ]
    );
  };

  return (
    <View style={tw`space-y-4`}>
      {/* Upload Button */}
      {existingImages.length < maxImages && (
        <TouchableOpacity
          style={[
            tw`flex-row items-center justify-center p-6 rounded-2xl border-2 border-dashed`,
            { 
              backgroundColor: 'rgba(255,255,255,0.05)',
              borderColor: 'rgba(255,255,255,0.2)'
            }
          ]}
          onPress={showUploadOptions}
          disabled={uploading}
        >
          {uploading ? (
            <ActivityIndicator size="large" color={theme.colors.secondary} />
          ) : (
            <View style={tw`items-center`}>
              <View style={[
                tw`w-12 h-12 rounded-full items-center justify-center mb-3`,
                { backgroundColor: 'rgba(255,255,255,0.1)' }
              ]}>
                <Upload size={24} color={theme.colors.secondary} />
              </View>
              <Text style={[tw`font-semibold text-base`, { color: theme.colors.foreground }]}>
                {title}
              </Text>
              <Text style={[tw`text-sm mt-1`, { color: theme.colors.mutedForeground }]}>
                {description}
              </Text>
            </View>
          )}
        </TouchableOpacity>
      )}

      {/* Existing Images Grid */}
      {existingImages.length > 0 && (
        <View style={tw`space-y-3`}>
          <Text style={[tw`text-lg font-semibold`, { color: theme.colors.foreground }]}>
            Uploaded Images ({existingImages.length}/{maxImages})
          </Text>
          <View style={tw`flex-row flex-wrap gap-3`}>
            {existingImages.map((imageUrl, index) => (
              <View key={index} style={tw`relative`}>
                <Image
                  source={{ uri: imageUrl }}
                  style={[
                    tw`rounded-xl`,
                    { width: 100, height: 100 / aspectRatio }
                  ]}
                  resizeMode="cover"
                />
                {onRemoveImage && (
                  <TouchableOpacity
                    style={[
                      tw`absolute -top-2 -right-2 w-6 h-6 rounded-full items-center justify-center`,
                      { backgroundColor: theme.colors.destructive }
                    ]}
                    onPress={() => onRemoveImage(index)}
                  >
                    <X size={14} color="white" />
                  </TouchableOpacity>
                )}
              </View>
            ))}
          </View>
        </View>
      )}
    </View>
  );
}; 