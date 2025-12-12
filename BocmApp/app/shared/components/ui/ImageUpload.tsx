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
import * as FileSystem from 'expo-file-system';
import { Camera, Upload, X } from 'lucide-react-native';
import { supabase } from '../../lib/supabase';
import { theme } from '../../lib/theme';
import tw from 'twrnc';
import { logger } from '../../lib/logger';
import { validateImageContent } from '../../lib/contentModeration';

interface ImageUploadProps {
  onUploadComplete: (url: string) => void;
  onUploadError: (error: string) => void;
  maxImages?: number;
  aspectRatio?: number;
  title?: string;
  description?: string;
  existingImages?: string[];
  onRemoveImage?: (index: number) => void;
  onImagePress?: (imageUrl: string, index: number) => void;
  customPath?: string; // Custom path prefix (e.g., 'avatars', 'covers')
  upsert?: boolean; // Whether to overwrite existing files
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
  onImagePress,
  customPath = 'uploads',
  upsert = false,
}) => {
  const [uploading, setUploading] = useState(false);
  const [failedImages, setFailedImages] = useState<Set<number>>(new Set());

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
      // Get file info for validation
      const fileInfoForValidation = await FileSystem.getInfoAsync(uri);
      if (!fileInfoForValidation.exists) {
        onUploadError('Image file not found. Please try selecting the image again.');
        setUploading(false);
        return;
      }
      
      // Get MIME type from file extension
      const fileExt = uri.split('.').pop()?.toLowerCase() || 'jpg';
      const mimeTypes: Record<string, string> = {
        'jpg': 'image/jpeg',
        'jpeg': 'image/jpeg',
        'png': 'image/png',
        'webp': 'image/webp',
        'gif': 'image/gif',
      };
      const mimeType = mimeTypes[fileExt] || 'image/jpeg';
      
      // Validate image content before upload
      const fileSize = fileInfoForValidation.exists && 'size' in fileInfoForValidation 
        ? fileInfoForValidation.size 
        : 0;
      const validation = await validateImageContent(uri, fileSize, mimeType);
      if (!validation.isValid) {
        Alert.alert(
          'Image Not Allowed',
          validation.reason || 'This image cannot be uploaded. Please select a different image.',
          [{ text: 'OK' }]
        );
        setUploading(false);
        return;
      }
      
      // Generate unique filename
      let fileName: string;
      if (upsert && existingImages.length > 0) {
        // For upsert, use a fixed filename based on the custom path
        const baseName = customPath === 'avatars' ? 'avatar' : customPath === 'covers' ? 'cover' : 'image';
        fileName = `${baseName}.${fileExt}`;
      } else {
        // For new uploads, use a unique filename
        fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      }
      const filePath = `${customPath}/${fileName}`;

      // For React Native, use file URI directly - Supabase handles file:// URIs
      // For web, convert to blob first
      let uploadData: any;
      let uploadError: any;
      
      if (Platform.OS === 'web') {
        // Web: use fetch to get blob
        logger.log('Web: Reading image file:', { uri, fileExt });
        const response = await fetch(uri);
        const blob = await response.blob();
        
        if (!blob || blob.size === 0) {
          throw new Error('Failed to read image file. The file appears to be empty.');
        }
        
        logger.log('Web: Blob created:', { blobSize: blob.size, contentType: blob.type });
        
        // Upload blob
        const result = await supabase.storage
          .from('images')
          .upload(filePath, blob, {
            contentType: `image/${fileExt === 'jpg' ? 'jpeg' : fileExt}`,
            upsert: upsert,
          });
        uploadData = result.data;
        uploadError = result.error;
      } else {
        // React Native: Use file URI directly - Supabase Storage handles file:// URIs
        logger.log('React Native: Uploading file directly:', { uri, filePath, fileExt });
        
        // First, verify the file exists and get its size
        const fileInfo = await FileSystem.getInfoAsync(uri);
        if (!fileInfo.exists) {
          throw new Error('Image file not found. Please try selecting the image again.');
        }
        
        if (fileInfo.size === 0) {
          throw new Error('Image file is empty. Please select a different image.');
        }
        
        logger.log('React Native: File verified:', { 
          uri, 
          exists: fileInfo.exists, 
          size: fileInfo.size,
          isDirectory: fileInfo.isDirectory 
        });
        
        // Read file as base64 and create FormData (Supabase accepts base64 strings)
        const base64 = await FileSystem.readAsStringAsync(uri, {
          encoding: FileSystem.EncodingType.Base64,
        });
        
        if (!base64 || base64.length === 0) {
          throw new Error('Failed to read image file. The file appears to be empty or corrupted.');
        }
        
        logger.log('React Native: Base64 read:', { base64Length: base64.length });
        
        // Convert base64 to Uint8Array for upload
        // This is the most reliable method for React Native
        let bytes: Uint8Array;
        if (typeof atob !== 'undefined') {
          // Use atob if available (most environments)
          const binaryString = atob(base64);
          bytes = new Uint8Array(binaryString.length);
          for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }
        } else {
          // Fallback: use Buffer if atob is not available
          const buffer = Buffer.from(base64, 'base64');
          bytes = new Uint8Array(buffer);
        }
        
        if (!bytes || bytes.length === 0) {
          throw new Error('Failed to convert image to bytes. The file may be corrupted.');
        }
        
        logger.log('React Native: Bytes array created:', { bytesLength: bytes.length });
        
        // Upload the Uint8Array directly
        const result = await supabase.storage
          .from('images')
          .upload(filePath, bytes, {
            contentType: `image/${fileExt === 'jpg' ? 'jpeg' : fileExt}`,
            upsert: upsert,
          });
        uploadData = result.data;
        uploadError = result.error;
      }

      if (uploadError) {
        logger.error('Upload error details:', uploadError);
        throw uploadError;
      }

      logger.log('Upload successful, verifying file:', { filePath, uploadData });

      // Verify the file was uploaded successfully by checking its metadata
      const { data: uploadedFileList, error: infoError } = await supabase.storage
        .from('images')
        .list(customPath, {
          limit: 1,
          search: fileName,
        });

      if (infoError) {
        logger.warn('Could not verify file upload:', infoError);
      } else if (uploadedFileList && uploadedFileList.length > 0) {
        const uploadedFile = uploadedFileList[0];
        const uploadedFileSize = uploadedFile.metadata?.size || 0;
        if (uploadedFileSize === 0 || uploadedFileSize === '0') {
          // File is empty, delete it and throw error
          logger.error('Uploaded file is empty, deleting:', { filePath, metadata: uploadedFile.metadata });
          await supabase.storage.from('images').remove([filePath]);
          throw new Error('Uploaded file is empty. Please try again.');
        }
        logger.log('File verified:', { fileName: uploadedFile.name, size: uploadedFileSize });
      }

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('images')
        .getPublicUrl(filePath);

      logger.log('Image uploaded successfully:', { publicUrl, filePath });
      onUploadComplete(publicUrl);
    } catch (error) {
      logger.error('Error uploading image:', error);
      onUploadError('Failed to upload image. Please try again.');
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
            {existingImages.map((imageUrl, index) => {
              const hasFailed = failedImages.has(index);
              return (
                <View key={index} style={tw`relative`}>
                  {hasFailed ? (
                    <View
                      style={[
                        tw`rounded-xl items-center justify-center`,
                        { 
                          width: 100, 
                          height: 100 / aspectRatio,
                          backgroundColor: 'rgba(255,255,255,0.1)',
                          borderWidth: 1,
                          borderColor: 'rgba(255,255,255,0.2)',
                        }
                      ]}
                    >
                      <Camera size={24} color={theme.colors.mutedForeground} />
                      <Text style={[tw`text-xs mt-1`, { color: theme.colors.mutedForeground }]}>
                        Failed to load
                      </Text>
                    </View>
                  ) : (
                    <TouchableOpacity
                      onPress={() => onImagePress?.(imageUrl, index)}
                      activeOpacity={0.8}
                    >
                      <Image
                        source={{ 
                          uri: imageUrl,
                          cache: 'force-cache',
                        }}
                        style={[
                          tw`rounded-xl`,
                          { width: 100, height: 100 / aspectRatio }
                        ]}
                        resizeMode="cover"
                        onError={(error) => {
                          const nativeEvent = error?.nativeEvent as any;
                          const nativeError = nativeEvent?.error || 'Unknown error';
                          const responseCode = nativeEvent?.responseCode;
                          const httpHeaders = nativeEvent?.httpResponseHeaders;
                          logger.error('Image load error:', { 
                            imageUrl, 
                            index, 
                            nativeError,
                            responseCode,
                            httpHeaders,
                            fullError: nativeEvent 
                          });
                          setFailedImages(prev => new Set(prev).add(index));
                        }}
                        onLoad={() => {
                          logger.log('Image loaded successfully:', { imageUrl, index });
                          // Remove from failed set if it loads successfully
                          setFailedImages(prev => {
                            const newSet = new Set(prev);
                            newSet.delete(index);
                            return newSet;
                          });
                        }}
                        onLoadStart={() => {
                          logger.log('Image load started:', { imageUrl, index });
                        }}
                      />
                    </TouchableOpacity>
                  )}
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
              );
            })}
          </View>
        </View>
      )}
    </View>
  );
}; 