import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  Dimensions,
} from 'react-native';
import { Video, ResizeMode } from 'expo-av';
import { Avatar } from './ui';
import tw from 'twrnc';
import { theme } from '../lib/theme';
import { logger } from '../lib/logger';

const { width } = Dimensions.get('window');

interface VideoPreviewProps {
  videoUrl: string;
  title: string;
  barberName: string;
  barberAvatar?: string;
  views?: number;
  likes?: number;
  onPress?: () => void;
  width?: number;
  height?: number;
}

export default function VideoPreview({
  videoUrl,
  title,
  barberName,
  barberAvatar,
  views = 0,
  likes = 0,
  onPress,
  width: customWidth,
  height: customHeight,
}: VideoPreviewProps) {
  const [frameUrl, setFrameUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Calculate dimensions for 3-column portrait layout
  const videoWidth = customWidth || (width - 32) / 3; // 3 columns with padding
  const videoHeight = customHeight || videoWidth * 1.5; // Portrait aspect ratio (3:2)

  useEffect(() => {
    const extractFrameFromVideo = async () => {
      try {
        setIsLoading(true);
        
        // For now, we'll use the video directly as a preview
        // The Video component will show the first frame when paused
        setFrameUrl(videoUrl);
      } catch (error) {
        logger.log('Error loading video for frame extraction:', error);
        setFrameUrl(null);
      } finally {
        setIsLoading(false);
      }
    };

    if (videoUrl) {
      extractFrameFromVideo();
    }
  }, [videoUrl]);

  const handlePress = () => {
    if (onPress) {
      onPress();
    }
  };

  return (
    <TouchableOpacity
      style={[
        tw`mb-2 rounded-lg overflow-hidden`,
        {
          width: videoWidth,
          height: videoHeight,
          borderColor: 'rgba(255,255,255,0.1)',
          borderWidth: 1,
          backgroundColor: 'rgba(255,255,255,0.05)',
        },
      ]}
      onPress={handlePress}
      activeOpacity={0.8}
    >
      {/* Video Preview - Portrait */}
      <View style={[tw`w-full h-full relative`, { backgroundColor: theme.colors.muted }]}>
        {frameUrl && !isLoading ? (
          <Video
            source={{ uri: frameUrl }}
            style={tw`w-full h-full`}
            resizeMode={ResizeMode.COVER}
            shouldPlay={false}
            isMuted={true}
            isLooping={false}
            onError={(error) => {
              logger.log('Video load error:', error);
              setFrameUrl(null);
            }}
            onLoad={() => logger.log('Video frame loaded successfully for:', title)}
          />
        ) : (
          <View style={[
            tw`w-full h-full items-center justify-center`, 
            { backgroundColor: theme.colors.muted }
          ]}>
            <Text style={[tw`text-xs`, { color: theme.colors.mutedForeground }]}>
              Loading...
            </Text>
          </View>
        )}
        
        {/* Likes Count - Bottom Left */}
        <View style={tw`absolute bottom-2 left-2`}>
          <Text style={[tw`text-xs`, { color: 'white' }]}>
            {likes > 1000 ? `${(likes / 1000).toFixed(1)}K` : likes}
          </Text>
        </View>

        {/* Barber Info Overlay - Bottom Right */}
        <View style={tw`absolute bottom-2 right-2`}>
          <Avatar
            size="sm"
            src={barberAvatar}
            fallback={barberName?.charAt(0)}
          />
        </View>

        {/* Title Overlay - Top */}
        <View style={tw`absolute top-2 left-2 right-2`}>
          <Text
            style={[
              tw`text-xs font-medium`,
              { color: 'white' },
              { textShadowColor: 'rgba(0,0,0,0.8)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2 }
            ]}
            numberOfLines={2}
          >
            {title}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
} 