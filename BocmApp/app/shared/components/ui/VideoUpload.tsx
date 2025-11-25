import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Platform,
  TextInput,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Play, Upload, X } from 'lucide-react-native';
import { supabase } from '../../lib/supabase';
import { theme } from '../../lib/theme';
import tw from 'twrnc';
import { logger } from '../../lib/logger';

interface VideoUploadProps {
  onUploadComplete: (videoData: { url: string; title: string; description?: string }) => void;
  onUploadError: (error: string) => void;
  title?: string;
  description?: string;
}

export const VideoUpload: React.FC<VideoUploadProps> = ({
  onUploadComplete,
  onUploadError,
  title = 'Upload Video',
  description = 'Select a video from your gallery or record a new one',
}) => {
  const [uploading, setUploading] = useState(false);
  const [videoTitle, setVideoTitle] = useState('');
  const [videoDescription, setVideoDescription] = useState('');
  const [selectedVideoUri, setSelectedVideoUri] = useState<string | null>(null);

  const requestPermissions = async () => {
    if (Platform.OS !== 'web') {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Please grant camera roll permissions to upload videos.');
        return false;
      }
    }
    return true;
  };

  const pickVideo = async () => {
    const hasPermission = await requestPermissions();
    if (!hasPermission) return;

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Videos,
        allowsEditing: true,
        quality: 0.8,
        videoMaxDuration: 60, // 60 seconds max
      });

      if (!result.canceled && result.assets[0]) {
        setSelectedVideoUri(result.assets[0].uri);
      }
    } catch (error) {
      logger.error('Error picking video:', error);
      onUploadError('Failed to select video');
    }
  };

  const recordVideo = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please grant camera permissions to record videos.');
      return;
    }

    try {
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Videos,
        allowsEditing: true,
        quality: 0.8,
        videoMaxDuration: 60, // 60 seconds max
      });

      if (!result.canceled && result.assets[0]) {
        setSelectedVideoUri(result.assets[0].uri);
      }
    } catch (error) {
      logger.error('Error recording video:', error);
      onUploadError('Failed to record video');
    }
  };

  const uploadVideo = async () => {
    if (!selectedVideoUri) {
      onUploadError('Please select a video first');
      return;
    }

    if (!videoTitle.trim()) {
      onUploadError('Please enter a title for your video');
      return;
    }

    setUploading(true);
    try {
      // Convert URI to blob
      const response = await fetch(selectedVideoUri);
      const blob = await response.blob();

      // Generate unique filename
      const fileExt = selectedVideoUri.split('.').pop() || 'mp4';
      const fileName = `${Math.random()}.${fileExt}`;
      const filePath = `videos/${fileName}`;

      // Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('videos')
        .upload(filePath, blob);

      if (uploadError) {
        throw uploadError;
      }

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('videos')
        .getPublicUrl(filePath);

      onUploadComplete({
        url: publicUrl,
        title: videoTitle.trim(),
        description: videoDescription.trim() || undefined,
      });

      // Reset form
      setSelectedVideoUri(null);
      setVideoTitle('');
      setVideoDescription('');
    } catch (error) {
      logger.error('Error uploading video:', error);
      onUploadError('Failed to upload video');
    } finally {
      setUploading(false);
    }
  };

  const showUploadOptions = () => {
    Alert.alert(
      'Upload Video',
      'Choose how you want to add a video',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Record Video', onPress: recordVideo },
        { text: 'Choose from Gallery', onPress: pickVideo },
      ]
    );
  };

  const cancelSelection = () => {
    setSelectedVideoUri(null);
    setVideoTitle('');
    setVideoDescription('');
  };

  return (
    <View style={tw`space-y-4`}>
      {!selectedVideoUri ? (
        // Upload Button
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
          <View style={tw`items-center`}>
            <View style={[
              tw`w-12 h-12 rounded-full items-center justify-center mb-3`,
              { backgroundColor: 'rgba(255,255,255,0.1)' }
            ]}>
              <Play size={24} color={theme.colors.secondary} />
            </View>
            <Text style={[tw`font-semibold text-base`, { color: theme.colors.foreground }]}>
              {title}
            </Text>
            <Text style={[tw`text-sm mt-1`, { color: theme.colors.mutedForeground }]}>
              {description}
            </Text>
          </View>
        </TouchableOpacity>
      ) : (
        // Video Details Form
        <View style={[
          tw`p-4 rounded-2xl`,
          { backgroundColor: 'rgba(255,255,255,0.05)' }
        ]}>
          <View style={tw`flex-row items-center justify-between mb-4`}>
            <Text style={[tw`font-semibold text-lg`, { color: theme.colors.foreground }]}>
              Video Details
            </Text>
            <TouchableOpacity
              style={[
                tw`w-6 h-6 rounded-full items-center justify-center`,
                { backgroundColor: theme.colors.destructive }
              ]}
              onPress={cancelSelection}
            >
              <X size={14} color="white" />
            </TouchableOpacity>
          </View>

          <View style={tw`space-y-4`}>
            <View style={tw`space-y-2`}>
              <Text style={[tw`text-sm font-medium`, { color: theme.colors.foreground }]}>
                Video Title *
              </Text>
              <TextInput
                style={[
                  tw`h-12 p-3 rounded-xl border`,
                  { 
                    backgroundColor: 'rgba(255,255,255,0.1)',
                    borderColor: 'rgba(255,255,255,0.2)',
                    color: theme.colors.foreground
                  }
                ]}
                placeholder="Enter video title"
                placeholderTextColor="rgba(255,255,255,0.5)"
                value={videoTitle}
                onChangeText={setVideoTitle}
              />
            </View>

            <View style={tw`space-y-2`}>
              <Text style={[tw`text-sm font-medium`, { color: theme.colors.foreground }]}>
                Description (Optional)
              </Text>
              <TextInput
                style={[
                  tw`p-3 rounded-xl border min-h-[80px]`,
                  { 
                    backgroundColor: 'rgba(255,255,255,0.1)',
                    borderColor: 'rgba(255,255,255,0.2)',
                    color: theme.colors.foreground
                  }
                ]}
                placeholder="Describe your video..."
                placeholderTextColor="rgba(255,255,255,0.5)"
                value={videoDescription}
                onChangeText={setVideoDescription}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />
            </View>

            <TouchableOpacity
              style={[
                tw`flex-row items-center justify-center p-4 rounded-xl`,
                { backgroundColor: theme.colors.secondary }
              ]}
              onPress={uploadVideo}
              disabled={uploading}
            >
              {uploading ? (
                <ActivityIndicator size="small" color={theme.colors.primary} />
              ) : (
                <>
                  <Upload size={20} color={theme.colors.primary} style={tw`mr-2`} />
                  <Text style={[tw`font-semibold`, { color: theme.colors.primary }]}>
                    Upload Video
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}; 