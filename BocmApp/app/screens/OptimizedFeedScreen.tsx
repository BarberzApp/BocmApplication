import React, { useCallback, useMemo, useRef, useState, useEffect } from 'react';
import { View, FlatList, StyleSheet, Dimensions, RefreshControl, Text, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Filter, TrendingUp, Clock, Star, MapPin } from 'lucide-react-native';
import OptimizedVideoCard from '../components/OptimizedVideoCard';
import { useOptimizedFeed } from '../hooks/useOptimizedFeed';
import type { FeedItem, VideoState } from '../types/feed.types';
import { logger } from '../shared/lib/logger';

const { height, width } = Dimensions.get('window');
const PAGE_HEIGHT = height; // full-screen paging since filter bar is overlay
const VIEWABILITY_CONFIG = { itemVisiblePercentThreshold: 85 }; // tighter for true "active" frame

export default function OptimizedFeedScreen() {
  const { 
    items, 
    loading, 
    fetchMore, 
    endReached, 
    error, 
    refresh, 
    availableSpecialties,
    fetchAvailableSpecialties,
    // Location functions
    userLocation,
    locationLoading,
    useLocation,
    getUserLocation
  } = useOptimizedFeed({ 
    pageSize: 8,
    enableVirtualization: true,
    enablePreloading: true
  });
  
  const [activeId, setActiveId] = useState<string | null>(null);
  const [videoStates, setVideoStates] = useState<Map<string, VideoState>>(new Map());
  const [selectedFilter, setSelectedFilter] = useState('all');
  const flatListRef = useRef<FlatList>(null);

  // Fetch available specialties on mount
  useEffect(() => {
    fetchAvailableSpecialties();
  }, [fetchAvailableSpecialties]);

  // Handle filter changes
  useEffect(() => {
    // Reset and fetch with new filter
    refresh();
    fetchMore(selectedFilter);
  }, [selectedFilter, fetchMore, refresh]);

  // Auto-set first video as active when items are loaded
  useEffect(() => {
    if (items.length > 0 && !activeId) {
      setActiveId(items[0].id);
      logger.log(`🎬 Auto-setting first video as active: ${items[0].id}`);
    }
  }, [items, activeId]);

  // Web-style simple scroll detection (like the web implementation)
  const onViewableItemsChanged = useCallback(
    ({ viewableItems }: { viewableItems: any[] }) => {
      if (!viewableItems?.length) return;
      
      // Simple detection like web: pick the first visible item
      const top = viewableItems[0];
      const newActiveId = top?.item?.id ?? null;
      
      // Simple state update like web
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
        navBottomInset={0} // No bottom nav in full-screen mode
        onVideoStateChange={handleVideoStateChange}
        onHoldToPause={handleHoldToPause}
      />
    ),
    [activeId, handleVideoStateChange, handleHoldToPause]
  );

  const onEndReached = useCallback(() => {
    if (!endReached && !loading) {
      logger.log('📄 Reached end, loading more...');
      fetchMore();
    }
  }, [endReached, loading, fetchMore]);

  const onRefresh = useCallback(() => {
    logger.log('🔄 Pull to refresh...');
    refresh();
  }, [refresh]);

  // Web-style simplified performance (like the web implementation)
  const performanceProps = useMemo(() => ({
    removeClippedSubviews: true,
    maxToRenderPerBatch: 2, // Simplified like web
    windowSize: 3, // Simplified like web
    initialNumToRender: 1,
    updateCellsBatchingPeriod: 50,
    disableVirtualization: false,
  }), []);

  // Web-style simple scroll behavior (like the web implementation)
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
      <FlatList
        ref={flatListRef}
        data={items}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        onEndReached={onEndReached}
        refreshControl={
          <RefreshControl
            refreshing={loading && items.length === 0}
            onRefresh={onRefresh}
            tintColor="white"
            colors={['white']}
          />
        }
        contentContainerStyle={styles.contentContainer}
        {...performanceProps}
        {...scrollProps}
      />
      
      {/* Overlay Filter Bar with proper safe area */}
      <SafeAreaView style={styles.filterBarOverlay} edges={['top']}>
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterScrollContent}
        >
          {/* All filter */}
          <TouchableOpacity 
            style={[styles.filterButton, selectedFilter === 'all' && styles.filterButtonActive]}
            onPress={() => setSelectedFilter('all')}
          >
            <TrendingUp size={16} color={selectedFilter === 'all' ? '#B48A3C' : 'white'} />
            <Text style={[styles.filterText, selectedFilter === 'all' && styles.filterTextActive]}>
              All
            </Text>
          </TouchableOpacity>
          
          {/* Location filter */}
          <TouchableOpacity 
            style={[
              styles.filterButton, 
              useLocation && styles.filterButtonActive
            ]}
            onPress={getUserLocation}
            disabled={locationLoading}
          >
            {locationLoading ? (
              <ActivityIndicator size={16} color="#B48A3C" />
            ) : (
              <MapPin size={16} color={useLocation ? '#B48A3C' : 'white'} />
            )}
            <Text style={[
              styles.filterText, 
              useLocation && styles.filterTextActive
            ]}>
              {useLocation ? 'Nearby' : 'Location'}
            </Text>
          </TouchableOpacity>
          
          {/* Dynamic specialty filters */}
          {availableSpecialties.map((specialty, index) => (
            <TouchableOpacity 
              key={specialty}
              style={[styles.filterButton, selectedFilter === specialty && styles.filterButtonActive]}
              onPress={() => setSelectedFilter(specialty)}
            >
              <Star size={16} color={selectedFilter === specialty ? '#B48A3C' : 'white'} />
              <Text style={[styles.filterText, selectedFilter === specialty && styles.filterTextActive]}>
                {specialty}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </SafeAreaView>
      
      {/* Loading indicator for pagination */}
      {loading && items.length > 0 && (
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
  filterBarOverlay: {
    position: 'absolute',
    top: 50, // Lowered the filters
    left: 0,
    right: 0,
    zIndex: 1000,
    backgroundColor: 'transparent',
    paddingVertical: 8,
    paddingHorizontal: 16,
    // Remove border for cleaner look
    // Add subtle gradient effect
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 5,
  },
  filterScrollContent: {
    paddingHorizontal: 8,
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginHorizontal: 3,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  filterButtonActive: {
    backgroundColor: 'rgba(180,138,60,0.3)',
    borderWidth: 1,
    borderColor: '#B48A3C',
  },
  filterText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  filterTextActive: {
    color: '#B48A3C',
  },
  contentContainer: {
    minHeight: height,
    // Ensure videos take full screen
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
