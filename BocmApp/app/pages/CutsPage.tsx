import React, { useCallback, useMemo, useRef, useState, useEffect } from 'react';
import { View, FlatList, StyleSheet, Dimensions, RefreshControl, Text, ActivityIndicator, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRoute, RouteProp, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../shared/types';
import OptimizedVideoCard from '../components/OptimizedVideoCard';
import { useOptimizedFeed } from '../hooks/useOptimizedFeed';
import type { FeedItem, VideoState } from '../types/feed.types';
import { logger } from '../shared/lib/logger';
import { supabase } from '../shared/lib/supabase';
import { ArrowLeft } from 'lucide-react-native';

const { height, width } = Dimensions.get('window');
const PAGE_HEIGHT = height;
const VIEWABILITY_CONFIG = { itemVisiblePercentThreshold: 85 };

type CutsPageRouteProp = RouteProp<RootStackParamList, 'Cuts'>;
type CutsPageNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Cuts'>;

export default function CutsPage() {
  const route = useRoute<CutsPageRouteProp>();
  const navigation = useNavigation<CutsPageNavigationProp>();
  const { cutId, barberId } = route.params || {};
  
  const { 
    items: allItems, 
    loading, 
    fetchMore, 
    endReached, 
    error, 
    refresh
  } = useOptimizedFeed({ 
    pageSize: 8,
    enableVirtualization: true,
    enablePreloading: true
  });
  
  const [filteredItems, setFilteredItems] = useState<FeedItem[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [videoStates, setVideoStates] = useState<Map<string, VideoState>>(new Map());
  const flatListRef = useRef<FlatList>(null);

  // Filter items to show only the selected cut, or all cuts if no cutId
  // If barberId is provided, only show cuts from that barber
  useEffect(() => {
    let itemsToFilter = allItems;
    
    // Filter by barber if barberId is provided
    if (barberId) {
      itemsToFilter = allItems.filter(item => item.barber_id === barberId);
    }
    
    if (cutId) {
      // Find the cut and show it plus surrounding cuts
      const cutIndex = itemsToFilter.findIndex(item => item.id === cutId);
      if (cutIndex !== -1) {
        // Show the selected cut and a few before/after
        const start = Math.max(0, cutIndex - 2);
        const end = Math.min(itemsToFilter.length, cutIndex + 3);
        setFilteredItems(itemsToFilter.slice(start, end));
        setActiveId(cutId);
        
        // Scroll to the selected cut
        setTimeout(() => {
          const scrollIndex = cutIndex - start;
          flatListRef.current?.scrollToIndex({ index: scrollIndex, animated: false });
        }, 100);
      } else {
        // Cut not found in current items, try to fetch it
        fetchCutById(cutId, barberId);
      }
    } else {
      // No cutId specified, show all items (filtered by barber if barberId provided)
      setFilteredItems(itemsToFilter);
      if (itemsToFilter.length > 0 && !activeId) {
        setActiveId(itemsToFilter[0].id);
      }
    }
  }, [cutId, barberId, allItems]);

  const fetchCutById = async (cutId: string, filterBarberId?: string) => {
    try {
      let query = supabase
        .from('cuts')
        .select(`
          id,
          url,
          description,
          title,
          created_at,
          duration,
          views,
          likes,
          shares,
          comments_count,
          barber_id,
          barbers!inner(
            id,
            user_id,
            specialties,
            latitude,
            longitude,
            city,
            state,
            profiles!barbers_user_id_fkey(
              username,
              name,
              avatar_url
            )
          )
        `)
        .eq('id', cutId)
        .eq('is_public', true);
      
      // If barberId filter is provided, also fetch other cuts from same barber
      if (filterBarberId) {
        query = query.eq('barber_id', filterBarberId);
      }
      
      const { data, error } = await query.single();

      if (error) throw error;

      if (data) {
        const barber = Array.isArray(data.barbers) ? data.barbers[0] : data.barbers;
        const profile = Array.isArray(barber?.profiles) ? barber?.profiles[0] : barber?.profiles;
        
        const feedItem: FeedItem = {
          id: data.id,
          videoUrl: data.url,
          caption: data.description || data.title,
          username: profile?.username || 'unknown',
          barber_id: data.barber_id,
          barber_name: profile?.name,
          barber_avatar: profile?.avatar_url,
          created_at: data.created_at,
          aspect_ratio: 9/16,
          duration: data.duration,
          view_count: data.views || 0,
          reach_count: data.views || 0,
          likes: data.likes || 0,
          comments: data.comments_count || 0,
          shares: data.shares || 0,
          music: 'Original Sound',
          barber_location: barber?.city || barber?.state || 'Unknown location',
        };
        
        // If barberId is provided, fetch all cuts from that barber
        if (filterBarberId) {
          const { data: allBarberCuts, error: cutsError } = await supabase
            .from('cuts')
            .select(`
              id,
              url,
              description,
              title,
              created_at,
              duration,
              views,
              likes,
              shares,
              comments_count,
              barber_id,
              barbers!inner(
                id,
                user_id,
                specialties,
                latitude,
                longitude,
                city,
                state,
                profiles!barbers_user_id_fkey(
                  username,
                  name,
                  avatar_url
                )
              )
            `)
            .eq('barber_id', filterBarberId)
            .eq('is_public', true)
            .order('created_at', { ascending: false });
          
          if (!cutsError && allBarberCuts) {
            const feedItems: FeedItem[] = allBarberCuts.map((cut: any) => {
              const barber = Array.isArray(cut.barbers) ? cut.barbers[0] : cut.barbers;
              const profile = Array.isArray(barber?.profiles) ? barber?.profiles[0] : barber?.profiles;
              
              return {
                id: cut.id,
                videoUrl: cut.url,
                caption: cut.description || cut.title,
                username: profile?.username || 'unknown',
                barber_id: cut.barber_id,
                barber_name: profile?.name,
                barber_avatar: profile?.avatar_url,
                created_at: cut.created_at,
                aspect_ratio: 9/16,
                duration: cut.duration,
                view_count: cut.views || 0,
                reach_count: cut.views || 0,
                likes: cut.likes || 0,
                comments: cut.comments_count || 0,
                shares: cut.shares || 0,
                music: 'Original Sound',
                barber_location: barber?.city || barber?.state || 'Unknown location',
              };
            });
            
            const cutIndex = feedItems.findIndex(item => item.id === cutId);
            if (cutIndex !== -1) {
              setFilteredItems(feedItems);
              setActiveId(cutId);
              setTimeout(() => {
                flatListRef.current?.scrollToIndex({ index: cutIndex, animated: false });
              }, 100);
            } else {
              setFilteredItems([feedItem]);
              setActiveId(cutId);
            }
          } else {
            setFilteredItems([feedItem]);
            setActiveId(cutId);
          }
        } else {
          setFilteredItems([feedItem]);
          setActiveId(cutId);
        }
      }
    } catch (error) {
      logger.error('Error fetching cut by ID:', error);
    }
  };

  // Auto-set first video as active when items are loaded
  useEffect(() => {
    if (filteredItems.length > 0 && !activeId) {
      setActiveId(filteredItems[0].id);
      logger.log(`🎬 Auto-setting first video as active: ${filteredItems[0].id}`);
    }
  }, [filteredItems, activeId]);

  const onViewableItemsChanged = useCallback(
    ({ viewableItems }: { viewableItems: any[] }) => {
      if (!viewableItems?.length) return;
      
      const top = viewableItems[0];
      const newActiveId = top?.item?.id ?? null;
      
      if (newActiveId !== activeId) {
        logger.log(`🎬 Active video changed: ${activeId} -> ${newActiveId}`);
        setActiveId(newActiveId);
      }
    },
    [activeId]
  );

  const keyExtractor = useCallback((it: FeedItem) => it.id, []);
  
  const getItemLayout = useCallback(
    (_: ArrayLike<FeedItem> | null | undefined, index: number) => ({
      length: PAGE_HEIGHT,
      offset: PAGE_HEIGHT * index,
      index,
    }),
    []
  );

  const handleVideoStateChange = useCallback((itemId: string, state: VideoState) => {
    setVideoStates(prev => new Map(prev).set(itemId, state));
  }, []);

  const handleHoldToPause = useCallback((itemId: string, isHolding: boolean) => {
    logger.log(`⏸️ Hold to pause: ${itemId} - ${isHolding ? 'holding' : 'released'}`);
  }, []);

  const renderItem = useCallback(
    ({ item }: { item: FeedItem }) => (
      <OptimizedVideoCard 
        item={item} 
        isActive={item.id === activeId} 
        navBottomInset={0}
        onVideoStateChange={handleVideoStateChange}
        onHoldToPause={handleHoldToPause}
      />
    ),
    [activeId, handleVideoStateChange, handleHoldToPause]
  );

  const onEndReached = useCallback(() => {
    if (!endReached && !loading && !cutId) {
      logger.log('📄 Reached end, loading more...');
      fetchMore();
    }
  }, [endReached, loading, fetchMore, cutId]);

  const onRefresh = useCallback(() => {
    logger.log('🔄 Pull to refresh...');
    refresh();
  }, [refresh]);

  const performanceProps = useMemo(() => ({
    removeClippedSubviews: true,
    maxToRenderPerBatch: 2,
    windowSize: 3,
    initialNumToRender: 1,
    updateCellsBatchingPeriod: 50,
    disableVirtualization: false,
  }), []);

  const scrollProps = useMemo(() => ({
    pagingEnabled: true,
    decelerationRate: 'fast' as const,
    snapToAlignment: 'start' as const,
    snapToInterval: PAGE_HEIGHT,
    showsVerticalScrollIndicator: false,
    onEndReachedThreshold: 0.75,
    getItemLayout,
    viewabilityConfig: VIEWABILITY_CONFIG,
    onViewableItemsChanged: onViewableItemsChanged,
  }), [getItemLayout, onViewableItemsChanged]);

  if (error) {
    return (
      <SafeAreaView style={styles.errorContainer}>
        <View style={styles.errorContent}>
          <Text style={styles.errorText}>Failed to load videos</Text>
          <Text style={styles.errorSubtext}>{error}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.root}>
      {/* Back Button */}
      <SafeAreaView style={styles.backButtonContainer} edges={['top']}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => {
            if (barberId) {
              // Navigate back to profile
              navigation.navigate('ProfilePreview', { barberId });
            } else {
              navigation.goBack();
            }
          }}
        >
          <ArrowLeft size={24} color="white" />
        </TouchableOpacity>
      </SafeAreaView>
      
      <FlatList
        ref={flatListRef}
        data={filteredItems}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        onEndReached={onEndReached}
        refreshControl={
          <RefreshControl
            refreshing={loading && filteredItems.length === 0}
            onRefresh={onRefresh}
            tintColor="white"
            colors={['white']}
          />
        }
        contentContainerStyle={styles.contentContainer}
        {...performanceProps}
        {...scrollProps}
      />
      
      {/* Loading indicator for pagination */}
      {loading && filteredItems.length > 0 && (
        <View style={styles.loadingIndicator}>
          <Text style={styles.loadingText}>Loading more...</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { 
    flex: 1, 
    backgroundColor: 'black' 
  },
  backButtonContainer: {
    position: 'absolute',
    top: 15,
    left: 0,
    right: 0,
    zIndex: 1000,
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  contentContainer: {
    minHeight: height,
    flexGrow: 1,
  },
  errorContainer: {
    flex: 1,
    backgroundColor: 'black',
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContent: {
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  errorSubtext: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 14,
    textAlign: 'center',
  },
  loadingIndicator: {
    position: 'absolute',
    bottom: 20,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  loadingText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 14,
  },
});
