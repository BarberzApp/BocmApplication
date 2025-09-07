import React, { useEffect, useMemo, useRef, useState, memo, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableWithoutFeedback, Dimensions, Animated, TouchableOpacity, Alert, Linking } from 'react-native';
import { Video, ResizeMode, AVPlaybackStatusSuccess } from 'expo-av';
import { Heart, MessageCircle, Share2, User, Play, Pause, Calendar } from 'lucide-react-native';
import type { FeedItem, VideoState } from '../types/feed.types';
import { useNavigation } from '@react-navigation/native';

const { height, width } = Dimensions.get('window');

// Rendered inside a paging FlatList; receives `isActive` to control playback.
type Props = {
  item: FeedItem;
  isActive: boolean;
  navBottomInset: number; // to avoid UI under bottom navbar
  onVideoStateChange?: (itemId: string, state: VideoState) => void;
  onHoldToPause?: (itemId: string, isHolding: boolean) => void;
};

function OptimizedVideoCardImpl({ item, isActive, navBottomInset, onVideoStateChange, onHoldToPause }: Props) {
  const navigation = useNavigation();
  const videoRef = useRef<Video>(null);
  const [muted, setMuted] = useState(true);
  const [isReady, setIsReady] = useState(false);
  const [isBuffering, setIsBuffering] = useState(true);
  const [videoState, setVideoState] = useState<VideoState>('loading');
  const [isHolding, setIsHolding] = useState(false);
  const [isLiked, setIsLiked] = useState(false);
  const [showProfileInfo, setShowProfileInfo] = useState(false);
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  // Update parent component about video state changes
  useEffect(() => {
    if (onVideoStateChange) {
      onVideoStateChange(item.id, videoState);
    }
  }, [videoState, item.id]); // Remove onVideoStateChange from dependencies to prevent infinite loop

  // Web-style simple playback control (like the web implementation)
  useEffect(() => {
    const inst = videoRef.current;
    if (!inst) return;
    
    if (isActive) {
      // Simple play like web: video.play()
      inst.playAsync().catch(console.error);
      setVideoState('playing');
    } else {
      // Simple pause like web: video.pause()
      inst.pauseAsync().catch(console.error);
      setVideoState('paused');
    }
    
    return () => {
      // Cleanup timer on unmount
      if (holdTimerRef.current) {
        clearTimeout(holdTimerRef.current);
        holdTimerRef.current = null;
      }
    };
  }, [isActive]);

  // Web-style simple hold-to-pause (like the web implementation)
  const handleTouchStart = useCallback(() => {
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
    }
    
    holdTimerRef.current = setTimeout(() => {
      if (isActive) {
        setIsHolding(true);
        onHoldToPause?.(item.id, true);
        // Simple pause like web: video.pause()
        videoRef.current?.pauseAsync().catch(console.error);
      }
    }, 1000);
  }, [isActive, onHoldToPause]);

  const handleTouchEnd = useCallback(() => {
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
    
    if (isHolding) {
      setIsHolding(false);
      onHoldToPause?.(item.id, false);
      // Resume playback when releasing hold, regardless of active state
      videoRef.current?.playAsync().catch(console.error);
    }
  }, [isHolding, onHoldToPause]);

  // Interactive functions
  const handleLike = useCallback(() => {
    setIsLiked(!isLiked);
    // TODO: Implement like functionality with backend
  }, [isLiked]);

  const handleComment = useCallback(() => {
    Alert.alert('Comments', 'Comment functionality coming soon!');
    // TODO: Implement comment functionality
  }, []);

  const handleShare = useCallback(() => {
    Alert.alert(
      'Share',
      'Share this video?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Share', onPress: () => {
          // TODO: Implement share functionality
          console.log('Sharing video:', item.id);
        }}
      ]
    );
  }, [item.id]);

  const handleProfilePress = useCallback(() => {
    setShowProfileInfo(!showProfileInfo);
  }, [showProfileInfo]);

  const handleBookAppointment = useCallback(() => {
    if (item.barber_id) {
      (navigation as any).navigate('BookingCalendar', { 
        barberId: item.barber_id,
        barberName: item.barber_name || item.username || 'Barber'
      });
    } else {
      Alert.alert('Error', 'Barber information not available');
    }
  }, [item.barber_id, item.barber_name, item.username, navigation]);

  const handleBarberProfilePress = useCallback(() => {
    if (item.barber_id) {
      (navigation as any).navigate('ProfilePreview', { 
        barberId: item.barber_id,
        username: item.username
      });
    } else {
      Alert.alert('Error', 'Barber profile not available');
    }
  }, [item.barber_id, item.username, navigation]);



  const onStatusUpdate = useCallback((status: any) => {
    if (!status) return;
    
    if ('isLoaded' in status && status.isLoaded) {
      const s = status as AVPlaybackStatusSuccess;
      setIsReady(true);
      setIsBuffering(s.isBuffering === true);
      
      if (s.isPlaying) {
        setVideoState('playing');
      } else if (!s.isPlaying) {
        setVideoState('paused');
      }
    } else if ('error' in status) {
      setVideoState('error');
      console.error('Video error:', status.error);
    }
  }, []);

  // Prepare source; if using signed URLs, keep them stable per mount
  const source = useMemo(() => {
    return { 
      uri: item.videoUrl || 'about:blank',
      headers: {
        'Cache-Control': 'max-age=3600', // Cache for 1 hour
      }
    };
  }, [item.videoUrl]);

  // Prepare poster source to avoid inline object creation
  const posterSource = useMemo(() => {
    return item.posterUrl ? { uri: item.posterUrl } : undefined;
  }, [item.posterUrl]);

  // Animate fade in when video is ready
  useEffect(() => {
    if (isReady) {
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }
  }, [isReady]); // Remove fadeAnim from dependencies since it's a ref

  return (
    <View style={[styles.container, { paddingBottom: navBottomInset }]}>
      <TouchableWithoutFeedback 
        onPress={() => setMuted((m) => !m)}
        onPressIn={handleTouchStart}
        onPressOut={handleTouchEnd}
      >
        <View style={styles.videoWrap}>
          <Animated.View style={[StyleSheet.absoluteFill, { opacity: fadeAnim }]}>
            <Video
              ref={videoRef}
              source={source}
              style={StyleSheet.absoluteFill}
              resizeMode={ResizeMode.CONTAIN}
              isLooping
              isMuted={muted}
              shouldPlay={false} // We control playback manually (like web)
              posterSource={posterSource}
              usePoster={!!item.posterUrl}
              onPlaybackStatusUpdate={onStatusUpdate}
              // Web-style simple error handling
              onLoad={() => setVideoState('ready')}
              onError={() => setVideoState('error')}
              // Simplified performance settings (like web)
              progressUpdateIntervalMillis={250}
            />
          </Animated.View>
          
          {!isReady || isBuffering ? (
            <View style={styles.loader}>
              <Text style={styles.loaderText}>Loading...</Text>
            </View>
          ) : null}
          
          {isHolding && (
            <View style={styles.pauseOverlay}>
              <Text style={styles.pauseText}>Paused</Text>
            </View>
          )}
        </View>
      </TouchableWithoutFeedback>

      {/* Enhanced Overlay UI */}
      <View style={styles.overlay}>
        {/* Left side - Profile and caption info */}
        <View style={styles.leftMeta}>
          <View style={styles.profileSection}>
            <TouchableOpacity onPress={handleProfilePress} style={styles.profileImageContainer}>
              {item.barber_avatar ? (
                <Animated.Image 
                  source={{ uri: item.barber_avatar }} 
                  style={[styles.profileImage, { opacity: fadeAnim }]}
                />
              ) : (
                <View style={styles.profileImagePlaceholder}>
                  <User size={20} color="white" />
                </View>
              )}
            </TouchableOpacity>
            <View style={styles.profileText}>
              <TouchableOpacity onPress={handleBarberProfilePress}>
                <Text style={styles.username}>@{item.username ?? 'user'}</Text>
              </TouchableOpacity>
              <Text style={styles.barberName}>{item.barber_name || 'Barber'}</Text>
            </View>
          </View>
          
          {item.caption ? (
            <Text style={styles.caption} numberOfLines={3}>
              {item.caption}
            </Text>
          ) : null}
          

        </View>
        
        {/* Right side - Action buttons */}
        <View style={styles.actions}>
          <TouchableOpacity onPress={handleLike} style={styles.actionButton}>
            <Heart 
              size={28} 
              color={isLiked ? '#ff4757' : 'white'} 
              fill={isLiked ? '#ff4757' : 'none'}
            />
            <Text style={styles.actionText}>{(item.likes ?? 0) + (isLiked ? 1 : 0)}</Text>
          </TouchableOpacity>
          
          <TouchableOpacity onPress={handleComment} style={styles.actionButton}>
            <MessageCircle size={28} color="white" />
            <Text style={styles.actionText}>{item.comments ?? 0}</Text>
          </TouchableOpacity>
          
          <TouchableOpacity onPress={handleShare} style={styles.actionButton}>
            <Share2 size={28} color="white" />
            <Text style={styles.actionText}>{item.shares ?? 0}</Text>
          </TouchableOpacity>
          
          <TouchableOpacity onPress={handleBookAppointment} style={styles.bookActionButton}>
            <Calendar size={28} color="white" />
            <Text style={styles.bookActionText}>Book Now</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Profile info overlay */}
      {showProfileInfo && (
        <View style={styles.profileOverlay}>
          <View style={styles.profileCard}>
            <View style={styles.profileCardHeader}>
              {item.barber_avatar ? (
                <Animated.Image 
                  source={{ uri: item.barber_avatar }} 
                  style={[styles.profileCardImage, { opacity: fadeAnim }]}
                />
              ) : (
                <View style={styles.profileCardImagePlaceholder}>
                  <User size={32} color="white" />
                </View>
              )}
              <View style={styles.profileCardInfo}>
                <Text style={styles.profileCardName}>{item.barber_name || 'Barber'}</Text>
                <Text style={styles.profileCardUsername}>@{item.username}</Text>
              </View>
            </View>
            <TouchableOpacity style={styles.bookButton} onPress={handleBookAppointment}>
              <Text style={styles.bookButtonText}>Book Appointment</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}



// Memo to avoid re-render unless active changes or item identity changes
const OptimizedVideoCard = memo(OptimizedVideoCardImpl);
export default OptimizedVideoCard;

const styles = StyleSheet.create({
  container: { 
    width, 
    height: height, // Ensure full screen height
    backgroundColor: 'black' 
  },
  videoWrap: { 
    flex: 1, 
    backgroundColor: 'black',
    position: 'relative',
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center'
  },
  loader: {
    position: 'absolute',
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(0,0,0,0.7)',
    alignSelf: 'center',
    justifyContent: 'center',
    alignItems: 'center',
    top: '45%',
  },
  loaderText: {
    color: 'white',
    fontSize: 12,
  },
  pauseOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pauseText: {
    color: 'white',
    fontSize: 24,
    fontWeight: 'bold',
  },
  overlay: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 80, // Raised above nav bar
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  leftMeta: { 
    flex: 1, 
    paddingRight: 12 
  },
  profileSection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  profileImageContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  profileImage: {
    width: '100%',
    height: '100%',
  },
  profileImagePlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  profileText: {
    flex: 1,
  },
  username: { 
    color: 'white', 
    fontWeight: '700', 
    fontSize: 16, 
    marginBottom: 2 
  },
  barberName: {
    color: 'white',
    fontSize: 14,
    opacity: 0.8,
  },
  distanceText: { 
    color: '#B48A3C', 
    fontSize: 12, 
    fontWeight: '500',
    marginTop: 2,
  },
  caption: { 
    color: 'white', 
    fontSize: 14, 
    fontWeight: 'bold',
    opacity: 0.9,
    marginBottom: 8,
  },

  actions: { 
    width: 64, 
    alignItems: 'center', 
    gap: 16 
  },
  actionButton: { 
    alignItems: 'center',
    marginBottom: 8,
  },
  actionText: { 
    color: 'white', 
    fontSize: 12,
    marginTop: 4,
    fontWeight: '600',
  },

  bookActionButton: {
    alignItems: 'center',
    marginBottom: 8,
    marginTop: 8,
    backgroundColor: 'rgba(180, 138, 60, 0.9)',
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    shadowColor: '#B48A3C',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
    minWidth: 80,
  },
  bookActionText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 4,
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
    textAlign: 'center',
    flexShrink: 0,
  },
  profileOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileCard: {
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 16,
    padding: 20,
    margin: 20,
    minWidth: 280,
  },
  profileCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  profileCardImage: {
    width: 60,
    height: 60,
    borderRadius: 30,
    marginRight: 16,
  },
  profileCardImagePlaceholder: {
    width: 60,
    height: 60,
    borderRadius: 30,
    marginRight: 16,
    backgroundColor: 'rgba(0,0,0,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileCardInfo: {
    flex: 1,
  },
  profileCardName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 4,
  },
  profileCardUsername: {
    fontSize: 14,
    color: '#666',
  },
  bookButton: {
    backgroundColor: '#B48A3C',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
  },
  bookButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});
