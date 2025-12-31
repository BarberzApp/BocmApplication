import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  SafeAreaView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  RefreshControl,
  Dimensions,
  Alert,
  Image,
  PermissionsAndroid,
  Platform,
  Linking,
} from 'react-native';
import * as Location from 'expo-location';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import tw from 'twrnc';
import { theme } from '../shared/lib/theme';
import { supabase } from '../shared/lib/supabase';
import { useAuth } from '../shared/hooks/useAuth';
import { logger } from '../shared/lib/logger';
import ProfilePreview from './ProfilePreview';
import {
  Search,
  MapPin,
  Filter,
  X,
  Grid3X3,
  Heart,
  Scissors,
} from 'lucide-react-native';
import { Avatar } from '../shared/components/ui';
import { RootStackParamList } from '../shared/types';
import StaircaseGrid from '../shared/components/StaircaseGrid';
import BookingForm from '../shared/components/BookingForm';
import { useReviews } from '../shared/hooks/useReviews';
import { useLocationManager } from '../shared/hooks/useLocationManager';
import { ReviewCard } from '../shared/components/ReviewCard';
import { ReviewForm } from '../shared/components/ReviewForm';
import { Star } from 'lucide-react-native';
import { getDistanceToItem, sortByDistance, formatDistance } from '../shared/lib/locationUtils';
import {
  getLocationPreferences,
  setLocationEnabled,
  updateLastLocation,
  getLastLocation,
} from '../shared/lib/locationPreferences';

const { width } = Dimensions.get('window');

type BrowseNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Browse'>;

// Types matching the database structure
type BarberFromDB = {
  id: string;
  user_id: string;
  business_name?: string;
  specialties: string[];
  price_range?: string;
  stripe_account_status?: string;
  instagram?: string;
  twitter?: string;
  tiktok?: string;
  facebook?: string;
  latitude?: number;
  longitude?: number;
  city?: string;
  state?: string;
}

type ProfileFromDB = {
  id: string;
  name: string;
  username?: string;
  location?: string;
  bio?: string;
  avatar_url?: string;
  is_public?: boolean;
}

// Type for the transformed data used in the UI
type Barber = {
  id: string;
  userId: string;
  name: string;
  username?: string;
  businessName?: string;
  location?: string;
  specialties: string[];
  bio?: string;
  priceRange?: string;
  avatarUrl?: string;
  coverPhotoUrl?: string;
  isPublic?: boolean;
  isStripeReady?: boolean;
  instagram?: string;
  twitter?: string;
  tiktok?: string;
  facebook?: string;
  latitude?: number;
  longitude?: number;
  city?: string;
  state?: string;
  distance?: number;
}

type SortOption = 'name' | 'location' | 'price' | 'distance';
type SortOrder = 'asc' | 'desc';

// Star Rating Component
function BarberRating({ barberId }: { barberId: string }) {
  const { stats, loading } = useReviews(barberId);
  const [likesCount, setLikesCount] = useState(0);
  const [likesLoading, setLikesLoading] = useState(true);

  // Fetch likes count for this barber
  useEffect(() => {
    const fetchLikesCount = async () => {
      try {
        setLikesLoading(true);
        const { data, error } = await supabase
          .from('cuts')
          .select('likes')
          .eq('barber_id', barberId)
          .eq('is_public', true);

        if (error) {
          logger.error('Error fetching likes:', error);
          return;
        }

        const totalLikes = data?.reduce((sum, cut) => sum + (cut.likes || 0), 0) || 0;
        setLikesCount(totalLikes);
      } catch (error) {
        logger.error('Error fetching likes count:', error);
      } finally {
        setLikesLoading(false);
      }
    };

    fetchLikesCount();
  }, [barberId]);

  if (loading || likesLoading) {
    return (
      <View style={tw`flex-row items-center`}>
        <Text style={[tw`text-sm`, { color: theme.colors.mutedForeground }]}>Loading...</Text>
      </View>
    );
  }

  if (!stats || stats.total_reviews === 0) {
    return (
      <View style={tw`flex-row items-center justify-between`}>
        <Text style={[tw`text-sm`, { color: theme.colors.mutedForeground }]}>No reviews yet</Text>
        {likesCount > 0 && (
          <View style={tw`flex-row items-center`}>
            <Heart size={12} color={theme.colors.mutedForeground} style={tw`mr-1`} />
            <Text style={[tw`text-sm`, { color: theme.colors.mutedForeground }]}>
              {likesCount}
            </Text>
          </View>
        )}
      </View>
    );
  }

  return (
    <View style={tw`flex-row items-center justify-between`}>
      <View style={tw`flex-row items-center`}>
        {Array.from({ length: 5 }, (_, index) => (
          <Star
            key={index}
            size={12}
            fill={index < Math.round(stats.average_rating) ? '#FFD700' : 'transparent'}
            color={index < Math.round(stats.average_rating) ? '#FFD700' : '#6B7280'}
            style={tw`mr-0.5`}
          />
        ))}
        <Text style={[tw`text-sm ml-1`, { color: theme.colors.mutedForeground }]}>
          {stats.average_rating.toFixed(1)} ({stats.total_reviews})
        </Text>
      </View>
      {likesCount > 0 && (
        <View style={tw`flex-row items-center`}>
          <Heart size={12} color={theme.colors.mutedForeground} style={tw`mr-1`} />
          <Text style={[tw`text-sm`, { color: theme.colors.mutedForeground }]}>
            {likesCount}
          </Text>
        </View>
      )}
    </View>
  );
}

// ReviewsList Component
function ReviewsList({ 
  barberId, 
  onAddReview 
}: { 
  barberId: string;
  onAddReview: () => void;
}) {
  const [reviews, setReviews] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  
  // ReviewsList component - removed debug logging
  
  // Only fetch reviews when component mounts (when modal opens)
  useEffect(() => {
    if (barberId && !hasLoaded) {
      fetchReviews();
    }
  }, [barberId, hasLoaded]);

  const fetchReviews = async () => {
    if (!barberId) return;
    
    logger.log('Fetching reviews for barber ID:', barberId);
    setLoading(true);
    
    try {
      const { data, error } = await supabase
        .from('reviews')
        .select(`
          *,
          client:client_id(
            id,
            name,
            avatar_url,
            username
          ),
          barber:barber_id(
            id,
            user_id,
            business_name
          ),
          booking:booking_id(
            id,
            date,
            service_id,
            service:service_id(
              name
            )
          )
        `)
        .eq('barber_id', barberId)
        .eq('is_public', true)
        .order('created_at', { ascending: false });

      if (error) {
        logger.error('Error fetching reviews:', error);
        Alert.alert('Error', 'Failed to load reviews.');
        return;
      }

      setReviews(data || []);
      setHasLoaded(true);
    } catch (error) {
      logger.error('Error fetching reviews:', error);
      Alert.alert('Error', 'Failed to load reviews.');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={tw`flex-1 justify-center items-center`}>
        <ActivityIndicator size="large" color={theme.colors.secondary} />
        <Text style={[tw`mt-4 text-lg`, { color: theme.colors.foreground }]}>
          Loading reviews...
        </Text>
      </View>
    );
  }

  if (reviews.length === 0) {
    return (
      <View style={tw`flex-1 justify-center items-center py-8`}>
        <Text style={[tw`text-lg font-bold text-center mb-2`, { color: theme.colors.foreground }]}>
          No reviews yet
        </Text>
        <Text style={[tw`text-sm text-center mb-4`, { color: theme.colors.mutedForeground }]}>
          Be the first to review this stylist!
        </Text>
        <TouchableOpacity
          style={[tw`px-6 py-3 rounded-xl`, { backgroundColor: theme.colors.secondary }]}
          onPress={onAddReview}
        >
          <Text style={[tw`font-semibold`, { color: theme.colors.primaryForeground }]}>
            Add Review
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={tw`flex-1`}>
      {/* Add Review Button */}
      <View style={tw`px-4 py-3 border-b border-white/10`}>
        <TouchableOpacity
          style={[tw`py-3 rounded-xl items-center`, { backgroundColor: theme.colors.secondary }]}
          onPress={onAddReview}
        >
          <Text style={[tw`font-semibold`, { color: theme.colors.primaryForeground }]}>
            Add Review
          </Text>
        </TouchableOpacity>
      </View>
      
      {/* Reviews List */}
      <ScrollView style={tw`flex-1`}>
        {reviews.map((review) => (
          <ReviewCard
            key={review.id}
            review={review}
            showActions={false}
          />
        ))}
      </ScrollView>
    </View>
  );
}

export default function BrowsePage() {
  const navigation = useNavigation<BrowseNavigationProp>();
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [posts, setPosts] = useState<any[]>([]);
  const [postsLoading, setPostsLoading] = useState(false);
  const [filteredPosts, setFilteredPosts] = useState<any[]>([]);
  
  // Barber list state
  const [barbers, setBarbers] = useState<Barber[]>([]);
  const [barbersLoading, setBarbersLoading] = useState(false);
  const [filteredBarbers, setFilteredBarbers] = useState<Barber[]>([]);
  const [selectedSpecialties, setSelectedSpecialties] = useState<string[]>([]);
  const [allSpecialties, setAllSpecialties] = useState<string[]>([]);
  const [showBookingForm, setShowBookingForm] = useState(false);
  const [selectedBarber, setSelectedBarber] = useState<any>(null);
  const [viewMode, setViewMode] = useState<'explore' | 'cosmetologists'>('cosmetologists');
  
  // Batch loading state
  const [barbersPage, setBarbersPage] = useState(0);
  const [hasMoreBarbers, setHasMoreBarbers] = useState(true);
  const [barbersLoadingMore, setBarbersLoadingMore] = useState(false);
  const BATCH_SIZE = 10;
  
  // Location management using custom hook
  const {
    userLocation,
    locationPermission,
    locationLoading,
    useLocation,
    toggleLocation: toggleLocationHook,
    getUserLocation,
    loadLocationPreferences,
  } = useLocationManager();
  
  // Review system state
  const [selectedBarberForReviews, setSelectedBarberForReviews] = useState<string | null>(null);
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [showReviews, setShowReviews] = useState(false);
  const [reviewFormData, setReviewFormData] = useState<{
    barberId: string;
    bookingId: string | null; // Can be null for reviews not tied to a booking
    isEditing?: boolean;
    reviewId?: string;
    initialRating?: number;
    initialComment?: string;
  } | null>(null);
  
  // Location accuracy state
  const [locationAccuracy, setLocationAccuracy] = useState<'high' | 'medium' | 'low' | 'error' | null>(null);

  useEffect(() => {
    fetchPosts();
    loadLocationPreferences();
    fetchBarbers(0); // Load first batch
  }, [loadLocationPreferences]);

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 300); // 300ms delay

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Check location accuracy when userLocation changes
  useEffect(() => {
    const checkLocationAccuracy = async () => {
      if (!useLocation || !userLocation?.coords) {
        setLocationAccuracy(null);
        return;
      }

      try {
        // Use the accuracy from the current userLocation if available
        // Otherwise, get a fresh location check
        const accuracy = userLocation.coords.accuracy;
        
        if (accuracy !== undefined && accuracy !== null) {
          // Categorize accuracy: high (< 10m), medium (10-50m), low (> 50m)
          if (accuracy < 10) {
            setLocationAccuracy('high');
          } else if (accuracy <= 50) {
            setLocationAccuracy('medium');
          } else {
            setLocationAccuracy('low');
          }
        } else {
          // If accuracy not available, try to get fresh location
          try {
            const position = await Location.getCurrentPositionAsync({
              accuracy: Location.Accuracy.High,
            });
            const freshAccuracy = position.coords.accuracy || 0;
            
            if (freshAccuracy < 10) {
              setLocationAccuracy('high');
            } else if (freshAccuracy <= 50) {
              setLocationAccuracy('medium');
            } else {
              setLocationAccuracy('low');
            }
          } catch (err) {
            logger.error('Error getting fresh location for accuracy:', err);
            setLocationAccuracy('error');
          }
        }
      } catch (error) {
        logger.error('Error checking location accuracy:', error);
        setLocationAccuracy('error');
      }
    };

    // Debounce accuracy check to avoid too frequent updates
    const timer = setTimeout(() => {
      checkLocationAccuracy();
    }, 500);

    return () => clearTimeout(timer);
  }, [useLocation, userLocation?.coords?.accuracy]);

  // Wrapper for toggleLocation that refreshes barbers
  const toggleLocation = async () => {
    const wasUsingLocation = useLocation;
    await toggleLocationHook();
    
    // Refresh barbers after toggling
    // If turning OFF location, refresh entire page (barbers and posts)
    if (wasUsingLocation) {
      // Reset pagination state
      setBarbersPage(0);
      setHasMoreBarbers(true);
      
      // Refresh everything when turning location off
      await Promise.all([
        fetchBarbers(0, false, true), // Skip nearby fetch when turning off
        fetchPosts() // Refresh posts as well
      ]);
    } else {
      fetchBarbers(0, false, false); // Use nearby fetch when turning on
    }
  };

  const fetchBarbers = async (page = 0, append = false, skipNearbyFetch = false) => {
    try {
      if (page === 0) {
        setBarbersLoading(true);
      } else {
        setBarbersLoadingMore(true);
      }
      
      // If location is enabled and we have coordinates, use the nearby endpoint
      // BUT skip if this is a fallback call to prevent infinite loop
      if (useLocation && userLocation?.coords && page === 0 && !skipNearbyFetch) {
        await fetchNearbyBarbers(userLocation.coords.latitude, userLocation.coords.longitude);
        return;
      }
      
      const from = page * BATCH_SIZE;
      const to = from + BATCH_SIZE - 1;
      
      logger.log(`Fetching barbers batch ${page + 1} (${from}-${to})`);
      
      // Fetch barbers with their profiles and ratings
      const { data: barbersData, error: barbersError } = await supabase
        .from('barbers')
        .select(`
          id,
          user_id,
          bio,
          specialties,
          price_range,
          stripe_account_status,
          business_name,
          instagram,
          twitter,
          tiktok,
          facebook,
          latitude,
          longitude,
          city,
          state,
          created_at,
          updated_at
        `)
        .range(from, to)
        .order('created_at', { ascending: false });

      if (barbersError) {
        logger.error('Error fetching barbers:', barbersError);
        return;
      }

      // Fetch profiles for barbers (only public profiles)
      const userIds = barbersData?.map(barber => barber.user_id) || [];
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select(`
          id,
          name,
          username,
          location,
          bio,
          avatar_url,
          coverphoto,
          is_public
        `)
        .in('id', userIds)
        .eq('is_public', true);

      if (profilesError) {
        logger.error('Error fetching profiles:', profilesError);
        return;
      }

      // Transform barbers data (only include barbers with public profiles)
      const transformedBarbers: Barber[] = [];
      
      (barbersData || []).forEach(barber => {
        const profile = profilesData?.find(p => p.id === barber.user_id);
        
        // Only include barbers that have a public profile
        if (profile) {
          // Calculate distance if user location is available
          const distance = useLocation && userLocation?.coords
            ? getDistanceToItem(
                { latitude: userLocation.coords.latitude, longitude: userLocation.coords.longitude },
                barber.latitude && barber.longitude
                  ? { latitude: barber.latitude, longitude: barber.longitude }
                  : undefined
              )
            : undefined;
          
          transformedBarbers.push({
            id: barber.id,
            userId: barber.user_id,
            name: profile.name || 'Unknown',
            username: profile.username || 'username',
            businessName: barber.business_name || profile.name,
            location: profile.location || barber.city || 'Location',
            specialties: barber.specialties || [],
            bio: barber.bio || profile.bio,
            priceRange: barber.price_range,
            avatarUrl: processAvatarUrl(profile.avatar_url),
            coverPhotoUrl: profile.coverphoto,
            isPublic: profile.is_public ?? true,
            isStripeReady: barber.stripe_account_status === 'active',
            instagram: barber.instagram,
            twitter: barber.twitter,
            tiktok: barber.tiktok,
            facebook: barber.facebook,
            latitude: barber.latitude,
            longitude: barber.longitude,
            city: barber.city,
            state: barber.state,
            distance,
          });
        }
      });

      // Sort by distance if location is enabled, and filter out barbers without coordinates
      if (useLocation && userLocation && userLocation.coords) {
        // Filter out barbers without valid distances
        const barbersWithLocation = transformedBarbers.filter(barber => 
          barber.distance !== undefined && 
          isFinite(barber.distance) && 
          barber.distance >= 0
        );
        
        // Sort by distance (closest first) - ensure numeric comparison
        const sorted = barbersWithLocation.sort((a, b) => {
          const distA = a.distance ?? Infinity;
          const distB = b.distance ?? Infinity;
          return distA - distB;
        });
        
        transformedBarbers.length = 0;
        transformedBarbers.push(...sorted);
        
        logger.log(`Sorted ${sorted.length} barbers by distance`, {
          firstFew: sorted.slice(0, 3).map(b => ({
            name: b.name,
            distance: b.distance?.toFixed(2) + ' mi'
          }))
        });
      }
      
      // Check if we have more barbers to load
      const hasMore = transformedBarbers.length === BATCH_SIZE;
      setHasMoreBarbers(hasMore);
      
      if (page === 0) {
        // First load - replace all barbers
        setBarbers(transformedBarbers);
        setFilteredBarbers(transformedBarbers);
        setBarbersPage(0);
        
        // Geocode barber locations in the background (don't wait for it)
        geocodeBarberLocations(transformedBarbers).catch((err) => logger.error('Geocoding error:', err));
      } else {
        // Append new barbers to existing list
        setBarbers(prevBarbers => {
          const newBarbers = [...prevBarbers, ...transformedBarbers];
          setFilteredBarbers(newBarbers);
          return newBarbers;
        });
        setBarbersPage(page);
      }
      
      logger.log(`Loaded ${transformedBarbers.length} barbers (batch ${page + 1})`);
      if (!hasMore) {
        logger.log('No more barbers to load');
      }
    } catch (error) {
      logger.error('Error fetching barbers:', error);
    } finally {
      if (page === 0) {
        setBarbersLoading(false);
      } else {
        setBarbersLoadingMore(false);
      }
    }
  };


  // Simple geocoding function using Nominatim (free)
  const geocodeLocation = async (locationText: string): Promise<{lat: number, lng: number} | null> => {
    try {
      const encodedLocation = encodeURIComponent(locationText);
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodedLocation}&limit=1`
      );
      const data = await response.json();
      
      if (data && data.length > 0) {
        return {
          lat: parseFloat(data[0].lat),
          lng: parseFloat(data[0].lon)
        };
      }
      return null;
    } catch (error) {
      logger.error('Geocoding error:', error);
      return null;
    }
  };

  // Geocode barber locations that don't have coordinates
  const geocodeBarberLocations = async (barbers: any[]) => {
    const barbersToGeocode = barbers.filter(barber => 
      !barber.latitude && !barber.longitude && barber.location
    );
    
    logger.log(`Geocoding ${barbersToGeocode.length} barber locations...`);
    
    for (const barber of barbersToGeocode) {
      try {
        const coordinates = await geocodeLocation(barber.location);
        if (coordinates) {
          // Update the barber in the database with coordinates
          const { error } = await supabase
            .from('barbers')
            .update({
              latitude: coordinates.lat,
              longitude: coordinates.lng,
              updated_at: new Date().toISOString()
            })
            .eq('user_id', barber.userId);
            
          if (!error) {
            logger.log(`Geocoded and saved coordinates for ${barber.name}`);
          }
        }
      } catch (error) {
        logger.error(`Failed to geocode ${barber.name}:`, error);
      }
    }
  };

  // Check if location is available and working
  const isLocationAvailable = useLocation && userLocation && userLocation.coords;

  // Fetch nearby barbers using the edge function
  const fetchNearbyBarbers = async (lat: number, lon: number, limit: number = 20) => {
    try {
      setBarbersLoading(true);
      
      const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
      const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
      
      if (!supabaseUrl || !supabaseAnonKey) {
        logger.error('Missing Supabase environment variables');
        // Fallback to regular fetch (skip nearby fetch to prevent infinite loop)
        await fetchBarbers(0, false, true);
        return;
      }

      const response = await fetch(
        `${supabaseUrl}/functions/v1/get-nearby-barbers?lat=${lat}&lon=${lon}&limit=${limit}`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${supabaseAnonKey}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch nearby barbers: ${response.statusText}`);
      }

      const { barbers } = await response.json();

      // Transform to match existing Barber type
      const transformedBarbers: Barber[] = (barbers || [])
        .map((barber: any) => {
          // Calculate distance if not provided by edge function (fallback)
          // Convert meters to miles: 1 meter = 0.000621371 miles
          let distance: number | undefined = barber.distance_m 
            ? barber.distance_m * 0.000621371 // Convert meters to miles
            : undefined;
          
          // If distance not provided but we have coordinates, calculate it
          if (!distance && userLocation?.coords && barber.latitude && barber.longitude) {
            distance = getDistanceToItem(
              { latitude: userLocation.coords.latitude, longitude: userLocation.coords.longitude },
              { latitude: barber.latitude, longitude: barber.longitude }
            );
          }
          
          return {
            id: barber.id,
            userId: barber.user_id,
            name: barber.name || 'Unknown',
            username: barber.username || 'username',
            businessName: barber.business_name || barber.name,
            location: barber.location || barber.city || 'Location',
            specialties: barber.specialties || [],
            bio: barber.bio,
            priceRange: barber.price_range,
            avatarUrl: processAvatarUrl(barber.avatar_url),
            coverPhotoUrl: barber.coverphoto,
            isPublic: barber.is_public ?? true,
            isStripeReady: false, // Would need to check stripe_account_status
            instagram: barber.instagram,
            twitter: barber.twitter,
            tiktok: barber.tiktok,
            facebook: barber.facebook,
            latitude: barber.latitude,
            longitude: barber.longitude,
            city: barber.city,
            state: barber.state,
            distance,
          };
        })
        .filter((barber: Barber) => barber.distance !== undefined && isFinite(barber.distance ?? Infinity)) // Only include barbers with valid distances
        .sort((a: Barber, b: Barber) => {
          // Sort by distance (closest first)
          const distA = a.distance ?? Infinity;
          const distB = b.distance ?? Infinity;
          return distA - distB;
        });

      setBarbers(transformedBarbers);
      setFilteredBarbers(transformedBarbers);
      setBarbersPage(0);
      setHasMoreBarbers(transformedBarbers.length === limit);
      
      logger.log(`Loaded ${transformedBarbers.length} nearby barbers`, {
        distances: transformedBarbers.slice(0, 5).map(b => ({ 
          name: b.name, 
          distance: b.distance?.toFixed(2) + ' mi',
          lat: b.latitude,
          lon: b.longitude
        })),
        userLocation: userLocation?.coords ? {
          lat: userLocation.coords.latitude,
          lon: userLocation.coords.longitude
        } : null
      });
    } catch (error) {
      logger.error('Error fetching nearby barbers:', error);
      // Fallback to regular fetch (skip nearby fetch to prevent infinite loop)
      await fetchBarbers(0, false, true);
    } finally {
      setBarbersLoading(false);
    }
  };

  const loadMoreBarbers = async () => {
    if (!hasMoreBarbers || barbersLoadingMore) return;
    
    // If using location, we can't load more from the endpoint easily
    // For now, just disable load more when location is enabled
    if (isLocationAvailable) {
      logger.log('Load more not supported when location sorting is enabled');
      return;
    }
    
    const nextPage = barbersPage + 1;
    logger.log(`Loading more barbers (page ${nextPage + 1})`);
    await fetchBarbers(nextPage, true);
  };

  const fetchPosts = async () => {
    try {
      setPostsLoading(true);
      
      // Fetch cuts (videos) and portfolio images
      const { data: cutsData, error: cutsError } = await supabase
        .from('cuts')
        .select(`
          id,
          barber_id,
          title,
          url,
          thumbnail,
          views,
          likes,
          duration,
          created_at
        `)
        .eq('is_public', true)
        .order('created_at', { ascending: false })
        .limit(50);

      if (cutsError) {
        logger.error('Error fetching cuts:', cutsError);
        return;
      }

      // Fetch barber info for cuts
      const barberIds = cutsData?.map(cut => cut.barber_id) || [];
      const { data: barbersData } = await supabase
        .from('barbers')
        .select('id, user_id')
        .in('id', barberIds);

      const { data: profilesData } = await supabase
        .from('profiles')
        .select('id, name, avatar_url')
        .in('id', barbersData?.map(b => b.user_id) || [])
        .eq('is_public', true);

      // Transform cuts to posts
      const videoPosts = (cutsData || []).map(cut => {
        const barber = barbersData?.find(b => b.id === cut.barber_id);
        const profile = profilesData?.find(p => p.id === barber?.user_id);
        
        return {
          id: cut.id,
          type: 'video' as const,
          url: cut.url,
          thumbnail: cut.thumbnail,
          title: cut.title,
          barberName: profile?.name || 'Unknown',
          barberAvatar: processAvatarUrl(profile?.avatar_url),
          barberId: barber?.user_id, // Add barber ID for navigation
          likes: cut.likes || 0,
          views: cut.views || 0,
          duration: cut.duration,
          aspectRatio: 9 / 16, // Default video aspect ratio
        };
      });

      // Only use real video posts from the database
      setPosts(videoPosts);
      setFilteredPosts(videoPosts);
      
      // Set real beauty/barber professions
      const specialties = [
        'Barber',
        'Braider',
        'Stylist',
        'Nails',
        'Lash',
        'Brow',
        'Tattoo',
        'Piercings',
        'Dyeing'
      ];
      setAllSpecialties(specialties);
    } catch (error) {
      logger.error('Error fetching posts:', error);
    } finally {
      setPostsLoading(false);
    }
  };

  // Filter posts based on selected criteria
  useEffect(() => {
    let filtered = posts;

    // Filter by search query (using debounced value)
    if (debouncedSearchQuery.trim()) {
      const query = debouncedSearchQuery.toLowerCase().trim();
      filtered = filtered.filter(post => {
        // Search in post title, barber name, and other relevant fields
        return (
          (post.title && post.title.toLowerCase().includes(query)) ||
          (post.barberName && post.barberName.toLowerCase().includes(query)) ||
          (post.barberId && post.barberId.toLowerCase().includes(query))
        );
      });
    }

    // Filter by specialty
    if (selectedSpecialties.length > 0) {
      // For now, we'll filter by barber specialties
      // In a real implementation, you'd need to fetch barber specialties
      filtered = filtered.filter(post => {
        // This is a placeholder - you'd need to match against actual barber specialties
        return true; // For now, show all posts
      });
    }

    setFilteredPosts(filtered);
  }, [posts, selectedSpecialties, debouncedSearchQuery]);

  // Filter barbers based on search query and selected specialties
  useEffect(() => {
    let filtered = barbers;

    // Filter by search query
    if (debouncedSearchQuery) {
      filtered = filtered.filter(barber =>
        barber.name?.toLowerCase().includes(debouncedSearchQuery.toLowerCase()) ||
        barber.username?.toLowerCase().includes(debouncedSearchQuery.toLowerCase()) ||
        barber.businessName?.toLowerCase().includes(debouncedSearchQuery.toLowerCase()) ||
        barber.location?.toLowerCase().includes(debouncedSearchQuery.toLowerCase()) ||
        barber.specialties?.some(specialty => 
          specialty.toLowerCase().includes(debouncedSearchQuery.toLowerCase())
        )
      );
    }

    // Filter by selected specialties
    if (selectedSpecialties.length > 0) {
      filtered = filtered.filter(barber =>
        barber.specialties?.some(specialty => 
          selectedSpecialties.includes(specialty)
        )
      );
    }

    setFilteredBarbers(filtered);
  }, [barbers, debouncedSearchQuery, selectedSpecialties]);

  // Update specialties when barbers are loaded
  useEffect(() => {
    const allSpecialtiesSet = new Set([
      'Barber',
      'Braider',
      'Stylist',
      'Nails',
      'Lash',
      'Brow',
      'Tattoo',
      'Piercings',
      'Dyeing'
    ]);
    
    // Add specialties from barbers
    barbers.forEach(barber => {
      barber.specialties?.forEach(specialty => allSpecialtiesSet.add(specialty));
    });
    
    setAllSpecialties(Array.from(allSpecialtiesSet).sort());
  }, [barbers]);

  const toggleSpecialty = (specialty: string) => {
    setSelectedSpecialties(prev => 
      prev.includes(specialty) 
        ? prev.filter(s => s !== specialty)
        : [...prev, specialty]
    );
  };

  const clearFilters = () => {
    setSelectedSpecialties([]);
    setSearchQuery('');
    setFilteredBarbers(barbers);
  };

  // Navigation handlers
  const handleVideoPress = (post: any) => {
    // Navigate to CutsPage with the specific video
    // Store the selected cut ID in a global way that CutsPage can access
    (global as any).selectedCutId = post.id;
    // Use the tab navigation to switch to the Cuts tab
    navigation.navigate('Cuts' as never);
  };

  const handleImagePress = (post: any) => {
    // Navigate to ProfilePreview with the barber's profile
    if (post.barberId) {
      navigation.navigate('ProfilePreview', { barberId: post.barberId });
    }
  };

  const handleBookBarber = (post: any) => {
    if (post.barberId) {
      setSelectedBarber(post);
      setShowBookingForm(true);
    }
  };

  // Function to render star ratings
  const renderStarRating = (rating: number, size: number = 14) => {
    return Array.from({ length: 5 }, (_, index) => (
      <Star
        key={index}
        size={size}
        fill={index < rating ? '#FFD700' : 'transparent'}
        color={index < rating ? '#FFD700' : '#6B7280'}
        style={tw`mr-0.5`}
      />
    ));
  };

  // Function to process avatar URL
  const processAvatarUrl = (url?: string) => {
    if (!url) return undefined;
    
    // If it's already a full URL, return as is
    if (url.startsWith('http://') || url.startsWith('https://')) {
      return url;
    }
    
    // If it's a relative path, construct the full URL
    if (url.startsWith('/')) {
      return `${process.env.EXPO_PUBLIC_SUPABASE_URL}/storage/v1/object/public/avatars${url}`;
    }
    
    // If it's just a filename, construct the full URL
    return `${process.env.EXPO_PUBLIC_SUPABASE_URL}/storage/v1/object/public/avatars/${url}`;
  };




  

  return (
    <SafeAreaView style={[tw`flex-1`, { backgroundColor: theme.colors.background }]}>
      {/* Header */}
      <View style={tw`px-4 pt-4 pb-2`}>
        <View style={tw`flex-row items-center justify-between mb-4`}>
          <Text style={[tw`text-2xl font-bold`, { color: theme.colors.foreground }]}>
            Browse
          </Text>
          
          {/* View Toggle Buttons - Explore tab hidden but code preserved */}
          <View style={tw`flex-row bg-white/10 rounded-lg p-1`}>
            {/* Explore tab - hidden but code preserved for future use */}
            {/* <TouchableOpacity
              style={[
                tw`px-4 py-2 rounded-md`,
                viewMode === 'explore' 
                  ? { backgroundColor: theme.colors.background }
                  : { backgroundColor: 'transparent' }
              ]}
              onPress={() => setViewMode('explore')}
            >
              <Text style={[
                tw`font-medium text-sm`,
                viewMode === 'explore'
                  ? { color: theme.colors.foreground }
                  : { color: theme.colors.mutedForeground }
              ]}>
                Explore
              </Text>
            </TouchableOpacity> */}
            
            <TouchableOpacity
              style={[
                tw`px-4 py-2 rounded-md`,
                viewMode === 'cosmetologists' 
                  ? { backgroundColor: theme.colors.background }
                  : { backgroundColor: 'transparent' }
              ]}
              onPress={() => setViewMode('cosmetologists')}
            >
              <Text style={[
                tw`font-medium text-sm`,
                viewMode === 'cosmetologists'
                  ? { color: theme.colors.foreground }
                  : { color: theme.colors.mutedForeground }
              ]}>
                Cosmetologists
              </Text>
            </TouchableOpacity>
          </View>
        </View>
        
        {/* Search Bar */}
        <View style={tw`flex-row items-center mb-4`}>
          <View style={[tw`flex-1 flex-row items-center rounded-xl px-3 py-2`, { backgroundColor: 'rgba(255,255,255,0.1)' }]}>
            <Search size={20} color={theme.colors.mutedForeground} style={tw`mr-2`} />
            <TextInput
              style={[tw`flex-1 text-base`, { color: theme.colors.foreground }]}
              placeholder={viewMode === 'explore' ? "Search styles..." : "Search stylists..."}
              placeholderTextColor={theme.colors.mutedForeground}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <X size={20} color={theme.colors.mutedForeground} />
              </TouchableOpacity>
            )}
          </View>
          
          {/* Location Button */}
          <TouchableOpacity
            style={[
              tw`ml-2 p-3 rounded-xl flex-row items-center`,
              { 
                backgroundColor: useLocation 
                  ? 'rgba(59,130,246,0.3)' 
                  : 'rgba(255,255,255,0.1)',
                borderWidth: useLocation ? 1 : 0,
                borderColor: useLocation ? 'rgba(59,130,246,0.5)' : 'transparent'
              }
            ]}
            onPress={toggleLocation}
            disabled={locationLoading}
          >
            {locationLoading ? (
              <ActivityIndicator size={16} color={theme.colors.secondary} />
            ) : (
              <MapPin 
                size={16} 
                color={useLocation ? theme.colors.secondary : theme.colors.foreground} 
              />
            )}
            {useLocation && !locationLoading && (
              <Text style={[tw`ml-1 text-xs font-medium`, { color: theme.colors.secondary }]}>
                ON
              </Text>
            )}
          </TouchableOpacity>
          
          <TouchableOpacity
            testID="filter-button"
            style={[tw`ml-2 p-2 rounded-xl`, { backgroundColor: 'rgba(255,255,255,0.1)' }]}
            onPress={() => setShowFilters(!showFilters)}
          >
            <Filter size={20} color={theme.colors.foreground} />
          </TouchableOpacity>
        </View>

        {/* Location Status Indicator */}
        {isLocationAvailable && (
          <View style={[
            tw`mb-3 p-3 rounded-xl flex-row items-center justify-center`,
            { backgroundColor: 'rgba(59,130,246,0.1)', borderWidth: 1, borderColor: 'rgba(59,130,246,0.3)' }
          ]}>
            <MapPin size={16} color={theme.colors.secondary} />
            <View style={tw`flex-1 ml-2`}>
              <Text style={[tw`text-sm font-medium text-center`, { color: theme.colors.secondary }]}>
                Showing barbers sorted by distance from your location
              </Text>
              <Text style={[tw`text-xs text-center mt-1`, { color: 'rgba(255,255,255,0.6)' }]}>
                Location accuracy: {locationAccuracy ? (
                  <Text style={[
                    tw`font-semibold`,
                    locationAccuracy === 'high' ? { color: '#22c55e' } :
                    locationAccuracy === 'medium' ? { color: '#f59e0b' } :
                    locationAccuracy === 'low' ? { color: '#ef4444' } :
                    { color: '#ef4444' }
                  ]}>
                    {locationAccuracy}
                  </Text>
                ) : (
                  <Text style={[tw`font-semibold`, { color: 'rgba(255,255,255,0.5)' }]}>
                    checking...
                  </Text>
                )}
                {' • '}
                <Text style={[tw`italic`, { color: 'rgba(255,255,255,0.5)' }]}>
                  Location optimization is currently being tested
                </Text>
              </Text>
            </View>
          </View>
        )}

        {/* Filters */}
        {showFilters && (
          <View style={[tw`mb-4 p-4 rounded-xl`, { backgroundColor: 'rgba(255,255,255,0.05)' }]}>
            {/* Specialty Filter */}
            <View style={tw`mb-4`}>
              <Text style={[tw`text-sm font-medium mb-2`, { color: theme.colors.foreground }]}>
                Specialties
              </Text>
              <View style={tw`flex-row flex-wrap gap-2`}>
                {allSpecialties.map(specialty => (
                  <TouchableOpacity
                    key={specialty}
                    style={[
                      tw`px-3 py-1 rounded-full`,
                      selectedSpecialties.includes(specialty)
                        ? { backgroundColor: theme.colors.secondary }
                        : { backgroundColor: 'rgba(255,255,255,0.1)' }
                    ]}
                    onPress={() => toggleSpecialty(specialty)}
                  >
                    <Text style={[
                      tw`text-xs`,
                      selectedSpecialties.includes(specialty)
                        ? { color: theme.colors.primary }
                        : { color: theme.colors.foreground }
                    ]}>
                      {specialty}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>



            {/* Clear Filters */}
            <TouchableOpacity
              style={[tw`mt-2 p-2 rounded-lg items-center`, { backgroundColor: 'rgba(255,255,255,0.1)' }]}
              onPress={clearFilters}
            >
              <Text style={[tw`text-sm font-medium`, { color: theme.colors.foreground }]}>
                Clear All Filters
              </Text>
            </TouchableOpacity>
          </View>
        )}

      </View>

      {/* Main Content Area */}
      <View style={tw`flex-1`}>
        {viewMode === 'explore' ? (
          // Explore View - Grid of videos/pictures
          <>
            {postsLoading ? (
              <View style={tw`flex-1 justify-center items-center`}>
                <ActivityIndicator size="large" color={theme.colors.secondary} />
                <Text style={[tw`mt-4 text-lg`, { color: theme.colors.foreground }]}>
                  Loading posts...
                </Text>
              </View>
            ) : filteredPosts.length === 0 ? (
              <View style={tw`flex-1 justify-center items-center py-8`}>
                <Grid3X3 size={48} style={[tw`mb-4`, { color: theme.colors.mutedForeground }]} />
                <Text style={[tw`text-lg font-bold text-center mb-2`, { color: theme.colors.foreground }]}>
                  No posts found
                </Text>
                <Text style={[tw`text-sm text-center`, { color: theme.colors.mutedForeground }]}>
                  {posts.length === 0 ? 'Check back later for new content' : 'Try adjusting your filters'}
                </Text>
              </View>
            ) : (
              <StaircaseGrid 
                posts={filteredPosts} 
                onVideoPress={handleVideoPress}
                onImagePress={handleImagePress}
                onBookPress={handleBookBarber}
              />
            )}
          </>
        ) : (
          // Cosmetologists View - List of barbers
          <>
            {barbersLoading ? (
              <View style={tw`flex-1 justify-center items-center`}>
                <ActivityIndicator size="large" color={theme.colors.secondary} />
                <Text style={[tw`mt-4 text-lg`, { color: theme.colors.foreground }]}>
                  Loading stylists...
                </Text>
              </View>
            ) : filteredBarbers.length === 0 ? (
              <View style={tw`flex-1 justify-center items-center py-8`}>
                <Text style={[tw`text-lg font-bold text-center mb-2`, { color: theme.colors.foreground }]}>
                  No stylists found
                </Text>
                <Text style={[tw`text-sm text-center`, { color: theme.colors.mutedForeground }]}>
                  Try adjusting your search or filters
                </Text>
              </View>
            ) : (
              <ScrollView 
                showsVerticalScrollIndicator={false}
                refreshControl={
                  <RefreshControl
                    refreshing={barbersLoading}
                    onRefresh={() => fetchBarbers(0)}
                    tintColor={theme.colors.secondary}
                    colors={[theme.colors.secondary]}
                  />
                }
              >
                {filteredBarbers.map((barber) => (
                  <View key={barber.id} style={tw`mb-6 mx-4`}>
                    {/* Barber Card - Web App Style */}
                    <View style={[
                      tw`bg-black border border-white/10 rounded-xl overflow-hidden shadow-2xl`,
                      { 
                        backgroundColor: 'rgba(0,0,0,0.9)',
                        shadowColor: theme.colors.secondary,
                        shadowOffset: { width: 0, height: 8 },
                        shadowOpacity: 0.3,
                        shadowRadius: 16,
                        elevation: 8
                      }
                    ]}>
                      {/* Cover Photo Section with Gradient */}
                      <View style={tw`relative h-48`}>
                        {barber.coverPhotoUrl ? (
                          <Image
                            source={{ uri: barber.coverPhotoUrl }}
                            style={tw`w-full h-full`}
                            resizeMode="cover"
                          />
                        ) : (
                          <View style={[
                            tw`w-full h-full`,
                            { 
                              backgroundColor: 'rgba(255,255,255,0.05)',
                              backgroundImage: 'linear-gradient(135deg, rgba(59,130,246,0.2) 0%, rgba(147,51,234,0.2) 50%, rgba(59,130,246,0.2) 100%)'
                            }
                          ]}>
                            {/* Decorative Pattern */}
                            <View style={tw`absolute top-4 left-4 w-20 h-20 border border-white/20 rounded-full opacity-10`} />
                            <View style={tw`absolute bottom-4 right-4 w-16 h-16 border border-white/20 rounded-full opacity-10`} />
                            <View style={tw`absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-32 h-32 border border-white/20 rounded-full opacity-10`} />
                          </View>
                        )}
                      </View>

                      {/* Avatar Section - Centered and Overlapping */}
                      <View style={tw`relative -mt-16 px-6`}>
                        <View style={tw`items-center`}>
                          <View style={[
                            tw`h-32 w-32 rounded-full border-4 shadow-xl overflow-hidden`,
                            { 
                              borderColor: 'rgba(0,0,0,0.8)',
                              shadowColor: theme.colors.secondary,
                              shadowOffset: { width: 0, height: 4 },
                              shadowOpacity: 0.3,
                              shadowRadius: 8,
                              elevation: 4
                            }
                          ]}>
                            {barber.avatarUrl ? (
                              <Image
                                source={{ uri: barber.avatarUrl }}
                                style={tw`w-full h-full`}
                                resizeMode="cover"
                                onError={(error) => {
                                  logger.error('Profile image error:', error.nativeEvent.error);
                                }}
                              />
                            ) : (
                              <View style={tw`w-full h-full bg-gray-600 items-center justify-center`}>
                                <Text style={[tw`text-3xl font-bold`, { color: 'white' }]}>
                                  {barber.name?.charAt(0)?.toUpperCase() || 'U'}
                                </Text>
                              </View>
                            )}
                          </View>
                        </View>
                      </View>

                      {/* Content Section */}
                      <View style={tw`px-6 pb-6`}>
                        {/* Header - Centered */}
                        <View style={tw`items-center mb-4`}>
                          <Text style={[tw`text-2xl font-bold text-center`, { color: theme.colors.foreground }]}>
                            {barber.name}
                          </Text>
                          {barber.businessName && (
                            <Text style={[tw`text-base font-medium text-center mb-1`, { color: 'rgba(255,255,255,0.6)' }]}>
                              {barber.businessName}
                            </Text>
                          )}
                          <Text style={[tw`text-lg font-semibold`, { color: theme.colors.secondary }]}>
                            @{barber.username}
                          </Text>
                        </View>

                        {/* Location - Centered */}
                        {barber.location && (
                          <View style={tw`flex-row items-center justify-center mb-3`}>
                            <MapPin size={16} color={theme.colors.secondary} />
                            <Text style={[tw`text-sm ml-2`, { color: 'rgba(255,255,255,0.7)' }]}>
                              {barber.location}
                              {useLocation && barber.distance !== undefined && (
                                <Text style={[tw`ml-2 font-semibold`, { color: theme.colors.secondary }]}>
                                  • {formatDistance(barber.distance)}
                                </Text>
                              )}
                            </Text>
                          </View>
                        )}

                        {/* Star Rating - Centered */}
                        <View style={tw`items-center mb-3`}>
                          <BarberRating barberId={barber.id} />
                        </View>

                        {/* Price Range */}
                        {barber.priceRange && (
                          <View style={tw`items-center mb-3`}>
                            <View style={[
                              tw`px-3 py-1 rounded-full border`,
                              { 
                                backgroundColor: 'rgba(59,130,246,0.2)',
                                borderColor: 'rgba(59,130,246,0.3)'
                              }
                            ]}>
                              <Text style={[tw`text-xs font-medium`, { color: theme.colors.secondary }]}>
                                {barber.priceRange} Pricing
                              </Text>
                            </View>
                          </View>
                        )}

                        {/* Bio */}
                        {barber.bio && (
                          <Text style={[tw`text-sm text-center mb-4 leading-relaxed`, { color: 'rgba(255,255,255,0.7)' }]}>
                            {barber.bio}
                          </Text>
                        )}

                        {/* Specialties */}
                        {barber.specialties && barber.specialties.length > 0 && (
                          <View style={tw`mb-4`}>
                            <View style={tw`flex-row items-center justify-center mb-2`}>
                              <Scissors size={16} color={theme.colors.secondary} />
                              <Text style={[tw`text-xs font-semibold ml-2 uppercase tracking-wide`, { color: 'rgba(255,255,255,0.8)' }]}>
                                Specialties
                              </Text>
                            </View>
                            <View style={tw`flex-row flex-wrap justify-center`}>
                              {barber.specialties.slice(0, 3).map((specialty, index) => (
                                <View
                                  key={index}
                                  style={[
                                    tw`px-2 py-1 rounded-full mx-1 mb-1 border`,
                                    { 
                                      backgroundColor: 'rgba(255,255,255,0.1)',
                                      borderColor: 'rgba(255,255,255,0.2)'
                                    }
                                  ]}
                                >
                                  <Text style={[tw`text-xs`, { color: 'rgba(255,255,255,0.8)' }]}>
                                    {specialty}
                                  </Text>
                                </View>
                              ))}
                              {barber.specialties.length > 3 && (
                                <View style={[
                                  tw`px-2 py-1 rounded-full mx-1 mb-1 border`,
                                  { 
                                    backgroundColor: 'transparent',
                                    borderColor: 'rgba(255,255,255,0.2)'
                                  }
                                ]}>
                                  <Text style={[tw`text-xs`, { color: 'rgba(255,255,255,0.6)' }]}>
                                    +{barber.specialties.length - 3} more
                                  </Text>
                                </View>
                              )}
                            </View>
                          </View>
                        )}

                        {/* Action Buttons */}
                        <View style={tw`flex-row gap-3`}>
                          <TouchableOpacity
                            style={[
                              tw`flex-1 py-3 rounded-xl items-center border`,
                              { 
                                backgroundColor: 'rgba(59,130,246,0.2)',
                                borderColor: 'rgba(59,130,246,0.3)'
                              }
                            ]}
                            onPress={() => {
                              // Reviews button clicked - removed debug logging
                              setSelectedBarberForReviews(barber.id);
                              setShowReviews(true);
                            }}
                          >
                            <Text style={[tw`font-semibold text-sm`, { color: theme.colors.secondary }]}>
                              Reviews
                            </Text>
                          </TouchableOpacity>
                          
                          <TouchableOpacity
                            style={[
                              tw`flex-1 py-3 rounded-xl items-center`,
                              { backgroundColor: theme.colors.secondary }
                            ]}
                            onPress={() => {
                              
                              setSelectedBarber({
                                barberId: barber.id,
                                barberName: barber.name,
                                name: barber.name
                              });
                              navigation.navigate('ProfilePreview', { barberId: barber.id});
                             // setShowBookingForm(true);
                            }}
                          >
                            <Text style={[tw`font-semibold text-sm`, { color: theme.colors.primary }]}>
                              Book Now
                            </Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    </View>
                  </View>
                ))}
                
                {/* Load More Section */}
                {hasMoreBarbers && (
                  <View style={tw`py-6 px-4`}>
                    <TouchableOpacity
                      style={[
                        tw`py-4 px-6 rounded-xl items-center border-2 border-dashed`,
                        { 
                          borderColor: 'rgba(255,255,255,0.2)',
                          backgroundColor: 'rgba(255,255,255,0.05)'
                        }
                      ]}
                      onPress={loadMoreBarbers}
                      disabled={barbersLoadingMore}
                    >
                      {barbersLoadingMore ? (
                        <View style={tw`flex-row items-center`}>
                          <ActivityIndicator size="small" color={theme.colors.secondary} />
                          <Text style={[tw`ml-2 font-medium`, { color: theme.colors.secondary }]}>
                            Loading more barbers...
                          </Text>
                        </View>
                      ) : (
                        <View style={tw`items-center`}>
                          <Text style={[tw`text-lg font-semibold mb-1`, { color: theme.colors.foreground }]}>
                            Load More Barbers
                          </Text>
                          <Text style={[tw`text-sm`, { color: theme.colors.mutedForeground }]}>
                            Tap to load the next 10 barbers
                          </Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  </View>
                )}
                
                {/* End of barbers message */}
                {!hasMoreBarbers && barbers.length > 0 && (
                  <View style={tw`py-6 px-4 items-center`}>
                    <Text style={[tw`text-sm`, { color: theme.colors.mutedForeground }]}>
                      You&apos;ve seen all available barbers!
                    </Text>
                  </View>
                )}
              </ScrollView>
            )}
          </>
        )}
      </View>



      {/* Reviews Modal */}
      {selectedBarberForReviews && showReviews && (
        <View style={tw`absolute inset-0 bg-black/90`}>
          <View style={tw`flex-1 pt-12`}>
            <View style={tw`flex-row items-center justify-between px-4 mb-4`}>
              <Text style={[tw`text-xl font-bold`, { color: theme.colors.foreground }]}>
                Reviews
              </Text>
              <TouchableOpacity
                onPress={() => {
                  setShowReviews(false);
                  setSelectedBarberForReviews(null);
                }}
                style={tw`p-2`}
              >
                <X size={24} color={theme.colors.foreground} />
              </TouchableOpacity>
            </View>
            
            <ScrollView style={tw`flex-1 px-4`}>
              <ReviewsList 
                barberId={selectedBarberForReviews} 
                onAddReview={() => {
                  // For reviews from browse page, no booking ID (null)
                  // These reviews are unverified since they're not tied to a booking
                  setReviewFormData({
                    barberId: selectedBarberForReviews,
                    bookingId: null, // Null for reviews not tied to a booking
                    isEditing: false,
                  });
                  setShowReviews(false);
                  setShowReviewForm(true);
                }}
              />
            </ScrollView>
          </View>
        </View>
      )}

      {/* Review Form Modal */}
      {reviewFormData && (
        <ReviewForm
          barberId={reviewFormData.barberId}
          bookingId={reviewFormData.bookingId}
          onClose={() => setReviewFormData(null)}
          onSuccess={() => {
            setReviewFormData(null);
            // Refresh reviews if needed
          }}
          isEditing={reviewFormData.isEditing}
          reviewId={reviewFormData.reviewId}
          initialRating={reviewFormData.initialRating}
          initialComment={reviewFormData.initialComment}
        />
      )}

      {/* Booking Form Modal */}
      {selectedBarber && (
        <BookingForm
          isVisible={showBookingForm}
          onClose={() => {
            setShowBookingForm(false);
            setSelectedBarber(null);
          }}
          barberId={selectedBarber.barberId}
          barberName={selectedBarber.barberName || selectedBarber.name}
          onBookingCreated={(booking) => {
            setShowBookingForm(false);
            setSelectedBarber(null);
            Alert.alert(
              'Booking Created!',
              'Your appointment has been scheduled successfully.',
              [{ text: 'OK' }]
            );
          }}
        />
      )}
    </SafeAreaView>
  );
} 