# 🎬 Autoplay System Explanation

## Overview
The autoplay system in the TikTok-style video feed is designed to provide a smooth, responsive experience where videos automatically play when they become visible and pause when they're scrolled away. Here's how it works:

## 🔧 Core Components

### 1. **Viewability Detection** (`OptimizedFeedScreen.tsx`)
```typescript
const VIEWABILITY_CONFIG = { itemVisiblePercentThreshold: 85 };
```
- **Threshold**: A video must be 85% visible to be considered "active"
- **Purpose**: Ensures only the most visible video plays at a time
- **Implementation**: Uses React Native's `onViewableItemsChanged` callback

### 2. **Active Video Tracking**
```typescript
const onViewableItemsChanged = useCallback(
  ({ viewableItems }: { viewableItems: any[] }) => {
    if (!viewableItems?.length) return;
    
    // Pick the first mostly-visible item
    const top = viewableItems[0];
    const newActiveId = top?.item?.id ?? null;
    
    setActiveId((currentActiveId) => {
      if (newActiveId !== currentActiveId) {
        console.log(`🎬 Active video changed: ${currentActiveId} -> ${newActiveId}`);
        return newActiveId;
      }
      return currentActiveId;
    });
  },
  []
);
```

## 🎥 Video Playback Control (`OptimizedVideoCard.tsx`)

### 3. **Manual Playback Control**
```typescript
<Video
  ref={videoRef}
  source={source}
  shouldPlay={false} // We control playback manually
  isLooping
  isMuted={muted}
  // ... other props
/>
```

**Key Point**: `shouldPlay={false}` means the video component doesn't auto-play. We control it manually.

### 4. **Active State Management**
```typescript
useEffect(() => {
  let mounted = true;
  
  const handlePlaybackChange = async () => {
    const inst = videoRef.current;
    if (!inst || !mounted) return;
    
    try {
      if (isActive && videoState === 'ready') {
        setVideoState('playing');
        await inst.playAsync();
      } else if (!isActive && videoState === 'playing') {
        setVideoState('paused');
        await inst.pauseAsync();
        await inst.setPositionAsync(0); // rewind for consistent UX like TikTok
      }
    } catch (error) {
      console.warn('Playback control error:', error);
      setVideoState('error');
    }
  };

  handlePlaybackChange();
  
  return () => {
    mounted = false;
  };
}, [isActive]); // Only depends on isActive, not videoState
```

## 🔄 Autoplay Flow

### Step 1: **Initial Load**
```typescript
// Auto-set first video as active when items are loaded
useEffect(() => {
  if (items.length > 0 && !activeId) {
    setActiveId(items[0].id);
    console.log(`🎬 Auto-setting first video as active: ${items[0].id}`);
  }
}, [items, activeId]);
```

### Step 2: **Scroll Detection**
When user scrolls, `onViewableItemsChanged` is triggered:
1. **85% visibility threshold** determines which video is "active"
2. **First visible item** becomes the new active video
3. **Active ID is updated** in state

### Step 3: **Playback Control**
For each video component:
1. **Receives `isActive` prop** (boolean)
2. **Checks if video is ready** (`videoState === 'ready'`)
3. **Plays if active and ready**: `await inst.playAsync()`
4. **Pauses if not active**: `await inst.pauseAsync()` + rewind to start

## 🎯 Key Features

### **Smart State Management**
```typescript
const [videoState, setVideoState] = useState<VideoState>('loading');
// States: 'loading' → 'ready' → 'playing' → 'paused'
```

### **Performance Optimizations**
```typescript
// Video component optimizations
progressUpdateIntervalMillis={250}
preferredForwardBufferDuration={5.0}
allowsExternalPlayback={false}
ignoreSilentSwitch="ignore"
```

### **Hold-to-Pause Feature**
```typescript
const handleTouchStart = useCallback(() => {
  holdTimerRef.current = setTimeout(() => {
    if (isActive) {
      setIsHolding(true);
      onHoldToPause?.(item.id, true);
      videoRef.current?.pauseAsync();
    }
  }, 1000); // 1 second hold
}, [isActive, onHoldToPause]);
```

## 📱 User Experience Flow

### **Normal Scrolling**
1. User scrolls up/down
2. `onViewableItemsChanged` detects new visible video
3. Previous video pauses and rewinds to start
4. New video starts playing automatically
5. Smooth transition between videos

### **Hold-to-Pause**
1. User holds finger on video for 1 second
2. Video pauses and shows "Paused" overlay
3. User releases finger
4. Video resumes playing (if still active)

### **Mute Control**
1. User taps video to toggle mute
2. Mute state is maintained per video
3. Visual indicator shows mute status

## 🔧 Technical Details

### **Viewability Configuration**
```typescript
const VIEWABILITY_CONFIG = { itemVisiblePercentThreshold: 85 };
```
- **85% threshold**: Ensures video is mostly visible before playing
- **Prevents partial playback**: Videos don't play when barely visible
- **Smooth transitions**: Clear active/inactive states

### **FlatList Configuration**
```typescript
const scrollProps = useMemo(() => ({
  pagingEnabled: true,
  decelerationRate: 'fast',
  snapToAlignment: 'start',
  snapToInterval: PAGE_HEIGHT,
  // ... other props
}), []);
```

### **Performance Optimizations**
```typescript
const performanceProps = useMemo(() => ({
  removeClippedSubviews: true,
  maxToRenderPerBatch: 3,
  windowSize: 5,
  initialNumToRender: 1,
  updateCellsBatchingPeriod: 50,
}), []);
```

## 🚀 Benefits

### **Smooth Performance**
- **Manual control**: No automatic playback conflicts
- **Optimized rendering**: Only visible videos are active
- **Memory efficient**: Clipped views are removed

### **User Experience**
- **TikTok-like feel**: Smooth, responsive scrolling
- **Intuitive controls**: Hold to pause, tap to mute
- **Consistent behavior**: Videos always start from beginning

### **Reliability**
- **Error handling**: Graceful fallbacks for playback errors
- **State management**: Clear video states prevent conflicts
- **Cleanup**: Proper timer and effect cleanup

## 🎬 Summary

The autoplay system creates a **TikTok-style experience** by:
1. **Detecting visible videos** with 85% visibility threshold
2. **Manually controlling playback** for precise timing
3. **Managing video states** to prevent conflicts
4. **Optimizing performance** with smart rendering
5. **Providing intuitive controls** for user interaction

This results in a **smooth, responsive video feed** that feels native and professional! 🚀
