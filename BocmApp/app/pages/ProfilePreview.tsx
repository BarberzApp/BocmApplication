import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  Alert,
  ActivityIndicator,
  RefreshControl,
  Dimensions,
  SafeAreaView,
} from 'react-native';
import { useRoute, useNavigation, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../shared/types';
import { ArrowLeft, Calendar, MapPin, Star, Video as VideoIcon, Heart, Users, History, Camera, Loader2, Eye, Clock, Share2, Flag, Ban, MoreVertical } from 'lucide-react-native';
import tw from 'twrnc';
import { theme } from '../shared/lib/theme';
import { supabase } from '../shared/lib/supabase';
import { logger } from '../shared/lib/logger';
import { useAuth } from '../shared/hooks/useAuth';
import { useReporting } from '../shared/hooks/useReporting';
import { ReportContentModal } from '../shared/components/ReportContentModal';
import VideoPreview from '../shared/components/VideoPreview';
import {
  Button,
  Card,
  CardContent,
  Badge,
  Avatar,
  Dialog,
  DialogContent,
} from '../shared/components/ui';
import { LinearGradient } from 'expo-linear-gradient';

const { width, height } = Dimensions.get('window');

// Helper function to generate gradient colors based on username
const generateGradientColors = (username: string) => {
  const colors = [
    ['#FF6B6B', '#4ECDC4'],
    ['#A8E6CF', '#DCEDC8'],
    ['#FFD93D', '#FF6B6B'],
    ['#6C5CE7', '#A29BFE'],
    ['#FD79A8', '#FDCB6E'],
    ['#00B894', '#00CEC9'],
    ['#E17055', '#FDCB6E'],
    ['#74B9FF', '#0984E3'],
    ['#FAB1A0', '#E17055'],
    ['#55A3FF', '#74B9FF'],
  ];
  
  if (!username) return colors[0];
  const index = username.charCodeAt(0) % colors.length;
  return colors[index];
};

// Helper function to get initials from name
const getInitials = (name: string) => {
  if (!name) return '?';
  return name.split(' ').map(word => word.charAt(0).toUpperCase()).join('').slice(0, 2);
};

interface UserProfile {
  id: string;
  name: string;
  email: string;
  username?: string;
  avatar_url?: string;
  bio?: string;
  location?: string;
  phone?: string;
  coverphoto?: string;
  role?: 'client' | 'barber';
}

interface BarberProfile {
  id: string;
  user_id: string;
  bio?: string;
  business_name?: string;
  specialties?: string[];
  instagram?: string;
  twitter?: string;
  facebook?: string;
  portfolio?: string[];
  featured_portfolio?: string;
  services?: Array<{
    id: string;
    name: string;
    price: number;
    duration: string;
    description: string;
  }>;
}

interface Cut {
  id: string;
  title: string;
  description?: string;
  url: string;
  thumbnail?: string;
  views: number;
  likes: number;
  shares: number;
  created_at: string;
  is_public: boolean;
  is_featured: boolean;
  barber: {
    id: string;
    name: string;
    image: string;
  };
}

type ProfilePreviewNavigationProp = NativeStackNavigationProp<RootStackParamList, 'ProfilePreview'>;
type ProfilePreviewRouteProp = RouteProp<RootStackParamList, 'ProfilePreview'>;

export default function ProfilePreview() {
  const navigation = useNavigation<ProfilePreviewNavigationProp>();
  const route = useRoute<ProfilePreviewRouteProp>();
  const { barberId } = route.params;
  const { user } = useAuth();
  const { blockUser } = useReporting();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [showReportModal, setShowReportModal] = useState(false);
  const [showBlockConfirm, setShowBlockConfirm] = useState(false);
  const isOwnProfile = user?.id === profile?.id;
  const [barberProfile, setBarberProfile] = useState<BarberProfile | null>(null);
  const [allCuts, setAllCuts] = useState<Cut[]>([]);
  const [cuts, setCuts] = useState<Cut[]>([]);
  const [services, setServices] = useState<any[]>([]);
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [openDialog, setOpenDialog] = useState<null | 'video'>(null);
  const [activeTab, setActiveTab] = useState('cuts');
  const [selectedVideo, setSelectedVideo] = useState<Cut | null>(null);
  const [failedImages, setFailedImages] = useState<Set<string>>(new Set());
  const [cutsPage, setCutsPage] = useState(0);
  const CUTS_PER_PAGE = 12;

  useEffect(() => {
    fetchProfileData();
  }, [barberId]);

  const fetchProfileData = async () => {
    try {
      setLoading(true);
      
      // barberId could be:
      // 1. barbers.id (most common - passed from BrowsePage)
      // 2. barbers.user_id (which is profiles.id)
      // 3. profiles.id (direct profile ID)
      
      // First, try to fetch barber by ID (most common case - barberId is barbers.id)
      let { data: barberData, error: barberError } = await supabase
        .from('barbers')
        .select('*')
        .eq('id', barberId)
        .maybeSingle();

      // If not found by ID, try by user_id (in case barberId is a profile ID)
      if (!barberData && !barberError) {
        const { data: barberByUserId, error: errorByUserId } = await supabase
          .from('barbers')
          .select('*')
          .eq('user_id', barberId)
          .maybeSingle();
        if (barberByUserId) {
          logger.log('Found barber by user_id:', barberId);
        }
        barberData = barberByUserId;
        barberError = errorByUserId;
      } else if (barberData) {
        logger.log('Found barber by id:', barberId);
      }

      // Fetch profile data
      let profileData = null;
      let profileError = null;

      if (barberData) {
        // We have barber data, fetch profile using barber's user_id
        const { data: profile, error: error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', barberData.user_id)
          .maybeSingle();
        profileData = profile;
        profileError = error;
      } else {
        // No barber found, try to fetch profile directly (might be a client profile or barberId is a profile ID)
        const { data: profile, error: error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', barberId)
          .maybeSingle();
        profileData = profile;
        profileError = error;
      }

      // Handle profile fetch errors
      if (profileError) {
        // Check if it's a "no rows" error (PGRST116)
        if (profileError.code === 'PGRST116') {
          logger.error('Profile not found:', barberId);
          Alert.alert(
            'Profile Not Found',
            'The profile you are looking for does not exist or has been removed.',
            [{ text: 'OK', onPress: () => navigation.goBack() }]
          );
          return;
        }
        logger.error('Error fetching profile:', profileError);
        Alert.alert(
          'Error',
          'Failed to load profile. Please try again.',
          [{ text: 'OK' }]
        );
        return;
      }

      if (!profileData) {
        logger.error('Profile data is null');
        Alert.alert(
          'Profile Not Found',
          'The profile you are looking for does not exist.',
          [{ text: 'OK', onPress: () => navigation.goBack() }]
        );
        return;
      }

      setProfile(profileData);

      // Handle barber data (might not exist if it's a client profile)
      if (barberError && barberError.code !== 'PGRST116') {
        logger.error('Error fetching barber data:', barberError);
      }

      if (barberData) {
        setBarberProfile(barberData);

        // Fetch cuts with barber info
        const { data: cutsData, error: cutsError } = await supabase
          .from('cuts')
          .select(`
            *,
            barbers:barber_id(
              id,
              user_id,
              profiles:user_id(name, avatar_url)
            )
          `)
          .eq('barber_id', barberData.id)
          .eq('is_public', true)
          .order('created_at', { ascending: false });

        if (cutsError) {
          logger.error('Error fetching cuts:', cutsError);
        } else if (cutsData) {
          const formattedCuts = (cutsData || []).map((cut: any) => ({
            ...cut,
            barber: {
              id: cut.barbers?.id,
              name: cut.barbers?.profiles?.name || 'Unknown',
              image: cut.barbers?.profiles?.avatar_url
            }
          }));
          setAllCuts(formattedCuts);
          // Load first page
          setCutsPage(0);
          setCuts(formattedCuts.slice(0, CUTS_PER_PAGE));
        }

        // Fetch services
        const { data: servicesData, error: servicesError } = await supabase
          .from('services')
          .select('*')
          .eq('barber_id', barberData.id)
          .order('name');

        if (servicesError) {
          logger.error('Error fetching services:', servicesError);
        } else if (servicesData) {
          setServices(servicesData);
        }
      }

      // Convert portfolio array to posts format for display
      if (barberData?.portfolio && Array.isArray(barberData.portfolio) && barberData.portfolio.length > 0) {
        const portfolioPosts = barberData.portfolio.map((url: string, index: number) => ({
          id: `portfolio-${index}`,
          url: url,
          title: `Portfolio Image ${index + 1}`,
        }));
        setPosts(portfolioPosts);
      } else {
        setPosts([]);
      }

      // If no barber data, set empty arrays for barber-specific content
      if (!barberData) {
        setAllCuts([]);
        setCuts([]);
        setServices([]);
        setPosts([]);
      }

    } catch (error) {
      logger.error('Error fetching profile data:', error);
      Alert.alert(
        'Error',
        'An unexpected error occurred while loading the profile. Please try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    setCutsPage(0);
    await fetchProfileData();
    setRefreshing(false);
  };

  // Load more cuts when scrolling
  const loadMoreCuts = () => {
    const nextPage = cutsPage + 1;
    const startIndex = nextPage * CUTS_PER_PAGE;
    const endIndex = startIndex + CUTS_PER_PAGE;
    
    if (startIndex < allCuts.length) {
      const newCuts = allCuts.slice(startIndex, endIndex);
      setCuts(prev => [...prev, ...newCuts]);
      setCutsPage(nextPage);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const formatTime = (timeString: string) => {
    return new Date(`2000-01-01T${timeString}`).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'cuts':
        return (
          <View style={tw`flex-1 px-4`}>
            {cuts.length === 0 ? (
              <View style={tw`flex-1 justify-center items-center py-8`}>
                <VideoIcon size={48} style={[tw`mb-4`, { color: 'rgba(255,255,255,0.4)' }]} />
                <Text style={[tw`font-bold text-xl mb-2 text-center`, { color: theme.colors.foreground }]}>
                  No cuts yet
                </Text>
                <Text style={[tw`text-sm text-center`, { color: theme.colors.mutedForeground }]}>
                  Check back later for new content
                </Text>
              </View>
            ) : (
              <ScrollView
                style={tw`py-4`}
                onScroll={(event) => {
                  const { layoutMeasurement, contentOffset, contentSize } = event.nativeEvent;
                  const paddingToBottom = 20;
                  if (layoutMeasurement.height + contentOffset.y >= contentSize.height - paddingToBottom) {
                    loadMoreCuts();
                  }
                }}
                scrollEventThrottle={400}
              >
                {/* Grid Layout for Cuts */}
                <View style={tw`flex-row flex-wrap justify-between`}>
                  {cuts.map((cut) => (
                    <VideoPreview
                      key={cut.id}
                      videoUrl={cut.url}
                      title={cut.title}
                      barberName={cut.barber?.name || 'Unknown'}
                      barberAvatar={cut.barber?.image || undefined}
                      views={cut.views}
                      likes={cut.likes}
                      onPress={() => {
                        // Navigate to cuts page for this specific video from this barber
                        if (barberProfile?.id) {
                          navigation.navigate('Cuts', { cutId: cut.id, barberId: barberProfile.id });
                        }
                      }}
                    />
                  ))}
                </View>
                {cuts.length < allCuts.length && (
                  <View style={tw`py-4 items-center`}>
                    <ActivityIndicator size="small" color={theme.colors.secondary} />
                  </View>
                )}
              </ScrollView>
            )}
          </View>
        );

      case 'portfolio':
        return (
          <View style={tw`flex-1 px-4`}>
            {posts.length === 0 ? (
              <View style={tw`flex-1 justify-center items-center py-8`}>
                <Heart size={48} style={[tw`mb-4`, { color: 'rgba(255,255,255,0.4)' }]} />
                <Text style={[tw`font-bold text-xl mb-2 text-center`, { color: theme.colors.foreground }]}>
                  No portfolio pictures yet
                </Text>
                <Text style={[tw`text-sm text-center`, { color: theme.colors.mutedForeground }]}>
                  This barber will showcase their portfolio here
                </Text>
              </View>
            ) : (
              <View style={tw`py-4`}>
                {/* Grid Layout for Portfolio Pictures */}
                <View style={tw`flex-row flex-wrap justify-between`}>
                  {posts.map((post) => {
                    const itemWidth = (width - 48) / 3;
                    const hasFailed = failedImages.has(post.id);
                    return (
                      <TouchableOpacity
                        key={post.id}
                        style={[
                          tw`mb-2 rounded-lg overflow-hidden`,
                          { width: itemWidth, height: itemWidth }
                        ]}
                        onPress={() => {
                          // Handle portfolio picture press
                          setSelectedVideo(post);
                          setOpenDialog('video');
                        }}
                      >
                        {hasFailed ? (
                          <View
                            style={[
                              tw`w-full h-full items-center justify-center`,
                              {
                                backgroundColor: 'rgba(255,255,255,0.1)',
                                borderWidth: 1,
                                borderColor: 'rgba(255,255,255,0.2)',
                              }
                            ]}
                          >
                            <Heart size={24} color={theme.colors.mutedForeground} />
                            <Text style={[tw`text-xs mt-1`, { color: theme.colors.mutedForeground }]}>
                              Failed to load
                            </Text>
                          </View>
                        ) : (
                          <Image
                            source={{ 
                              uri: post.url,
                              cache: 'force-cache',
                            }}
                            style={tw`w-full h-full`}
                            resizeMode="cover"
                            onError={(error) => {
                              const nativeEvent = error?.nativeEvent as any;
                              const nativeError = nativeEvent?.error || 'Unknown error';
                              const responseCode = nativeEvent?.responseCode;
                              const httpHeaders = nativeEvent?.httpResponseHeaders;
                              logger.error('Portfolio image load error:', { 
                                url: post.url, 
                                postId: post.id, 
                                nativeError,
                                responseCode,
                                httpHeaders,
                                fullError: nativeEvent 
                              });
                              setFailedImages(prev => new Set(prev).add(post.id));
                            }}
                            onLoad={() => {
                              logger.log('Portfolio image loaded successfully:', { url: post.url, postId: post.id });
                              // Remove from failed set if it loads successfully
                              setFailedImages(prev => {
                                const newSet = new Set(prev);
                                newSet.delete(post.id);
                                return newSet;
                              });
                            }}
                            onLoadStart={() => {
                              logger.log('Portfolio image load started:', { url: post.url, postId: post.id });
                            }}
                          />
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            )}
          </View>
        );

      case 'services':
        return (
          <View style={tw`flex-1 px-4 py-4`}>
            {services.length === 0 ? (
              <View style={tw`flex-1 justify-center items-center py-8`}>
                <History size={48} style={[tw`mb-4`, { color: 'rgba(255,255,255,0.4)' }]} />
                <Text style={[tw`font-bold text-xl mb-2 text-center`, { color: theme.colors.foreground }]}>
                  No services available
                </Text>
                <Text style={[tw`text-sm text-center`, { color: theme.colors.mutedForeground }]}>
                  This barber hasn't added any services yet
                </Text>
              </View>
            ) : (
              <View style={tw`space-y-4`}>
                {services.map((service) => (
                  <View
                    key={service.id}
                    style={[
                      tw`p-4 rounded-xl`,
                      {
                        backgroundColor: 'rgba(255, 255, 255, 0.08)',
                        borderWidth: 1,
                        borderColor: 'rgba(255, 255, 255, 0.12)',
                        shadowColor: '#000',
                        shadowOffset: { width: 0, height: 2 },
                        shadowOpacity: 0.1,
                        shadowRadius: 8,
                        elevation: 3,
                      }
                    ]}
                  >
                    <View style={tw`flex-row items-start justify-between mb-3`}>
                      <View style={tw`flex-1 mr-3`}>
                        <Text style={[tw`text-lg font-bold mb-1`, { color: theme.colors.foreground }]}>
                          {service.name}
                        </Text>
                        <Text style={[tw`text-sm leading-5`, { color: theme.colors.mutedForeground }]}>
                          {service.description || 'No description available'}
                        </Text>
                      </View>
                      <View
                        style={[
                          tw`px-3 py-1 rounded-full`,
                          {
                            backgroundColor: 'rgba(180, 138, 60, 0.15)',
                            borderWidth: 1,
                            borderColor: 'rgba(180, 138, 60, 0.3)',
                          }
                        ]}
                      >
                        <Text style={[tw`font-bold text-sm`, { color: theme.colors.secondary }]}>
                          ${service.price + 1}
                        </Text>
                      </View>
                    </View>
                    
                    <View style={tw`flex-row items-center justify-between`}>
                      <View style={tw`flex-row items-center`}>
                        <Clock size={14} color={theme.colors.mutedForeground} />
                        <Text style={[tw`ml-2 text-sm`, { color: theme.colors.mutedForeground }]}>
                          {service.duration} minutes
                        </Text>
                      </View>
                      
                                             <TouchableOpacity
                         style={[
                           tw`flex-row items-center px-3 py-1 rounded-full`,
                           {
                             backgroundColor: 'rgba(180, 138, 60, 0.15)',
                             borderWidth: 1,
                             borderColor: 'rgba(180, 138, 60, 0.3)',
                           }
                         ]}
                         onPress={() => {
                           // Navigate to booking calendar for this specific service
                           if (!profile) return;
                           navigation.navigate('BookingCalendar', {
                             barberId: route.params.barberId,
                             barberName: profile.name,
                             preSelectedService: service,
                           });
                         }}
                       >
                         <View
                           style={[
                             tw`w-2 h-2 rounded-full mr-2`,
                             { backgroundColor: theme.colors.secondary }
                           ]}
                         />
                         <Text style={[tw`text-xs font-medium`, { color: theme.colors.secondary }]}>
                           Book
                         </Text>
                       </TouchableOpacity>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </View>
        );

      default:
        return null;
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={[tw`flex-1 justify-center items-center`, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator size="large" color={theme.colors.secondary} />
        <Text style={[tw`mt-4 text-lg`, { color: theme.colors.foreground }]}>
          Loading profile...
        </Text>
      </SafeAreaView>
    );
  }

  if (!profile) {
    return (
      <SafeAreaView style={[tw`flex-1 justify-center items-center`, { backgroundColor: theme.colors.background }]}>
        <Text style={[tw`text-lg`, { color: theme.colors.foreground }]}>
          Profile not found
        </Text>
        <Button onPress={() => navigation.goBack()} style={tw`mt-4`}>
          Go Back
        </Button>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[tw`flex-1`, { backgroundColor: theme.colors.background }]}>
      {/* Header Section */}
      <View style={tw`relative w-full overflow-hidden`}>
        {/* Cover Photo */}
        <View style={[tw`h-32 w-full flex items-center justify-center relative`, { backgroundColor: theme.colors.muted }]}>
          {profile.coverphoto ? (
            <Image
              source={{ uri: profile.coverphoto }}
              style={tw`absolute inset-0 w-full h-full`}
              resizeMode="cover"
            />
          ) : (
            <LinearGradient
              colors={generateGradientColors(profile?.username || profile?.name || '') as [string, string]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={tw`absolute inset-0 w-full h-full`}
            />
          )}
          {/* Back button */}
          <TouchableOpacity
            style={tw`absolute top-3 left-3 z-20 h-8 w-8 rounded-full bg-black/40 items-center justify-center`}
            onPress={() => navigation.goBack()}
          >
            <ArrowLeft size={16} color="white" />
          </TouchableOpacity>
          {/* Glass overlay */}
          <View style={tw`absolute inset-0 bg-black/30 z-10`} />
        </View>

        {/* Avatar - Positioned exactly where cover photo ends */}
        <View style={tw`absolute left-3/8 top-20 -translate-x-1/2  z-20`}>
          <View style={[tw`w-24 h-24 rounded-full overflow-hidden border-2`, { borderColor: theme.colors.secondary }]}>
            {profile.avatar_url ? (
              <Image
                source={{ uri: profile.avatar_url }}
                style={tw`w-full h-full`}
                resizeMode="cover"
              />
            ) : (
              <LinearGradient
                colors={generateGradientColors(profile?.username || profile?.name || '') as [string, string]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={tw`w-full h-full items-center justify-center`}
              >
                <Text style={[tw`text-2xl font-bold`, { color: 'white' }]}>
                  {getInitials(profile?.name || '')}
                </Text>
              </LinearGradient>
            )}
          </View>
        </View>
        
        {/* Profile Info */}
        <View style={tw`px-4 pt-16 pb-4 items-center`}>
          <Text style={[tw`text-xl font-bold mb-1 text-center`, { color: theme.colors.foreground }]}>
            {profile.name}
          </Text>
          {profile.username && (
            <Text style={[tw`text-sm mb-1 text-center`, { color: theme.colors.secondary }]}>
              @{profile.username}
            </Text>
          )}
          {profile.location && (
            <Text style={[tw`text-sm text-center mb-3`, { color: theme.colors.foreground }]}>
              {profile.location}
            </Text>
          )}
          
          {/* Action Buttons */}
          <View style={tw`flex-row items-center gap-3`}>
          <TouchableOpacity
            style={[
              tw`px-6 py-2 rounded-full`,
              { backgroundColor: theme.colors.secondary }
            ]}
            onPress={() => {
              // Navigate to booking calendar
              if (!profile) return;
              navigation.navigate('BookingCalendar', {
                barberId: route.params.barberId,
                barberName: profile.name,
              });
            }}
          >
            <Text style={[tw`font-semibold text-sm`, { color: theme.colors.background }]}>
              Book Appointment
            </Text>
          </TouchableOpacity>
            
            {/* Report/Block Menu - Only show if not own profile */}
            {!isOwnProfile && (
              <TouchableOpacity
                style={[
                  tw`p-2 rounded-full`,
                  { backgroundColor: 'rgba(255, 255, 255, 0.1)' }
                ]}
                onPress={() => {
                  Alert.alert(
                    'Profile Actions',
                    'What would you like to do?',
                    [
                      {
                        text: 'Report Profile',
                        style: 'default',
                        onPress: () => setShowReportModal(true),
                      },
                      {
                        text: 'Block User',
                        style: 'destructive',
                        onPress: () => setShowBlockConfirm(true),
                      },
                      {
                        text: 'Cancel',
                        style: 'cancel',
                      },
                    ]
                  );
                }}
              >
                <MoreVertical size={20} color={theme.colors.foreground} />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Tabs Under Avatar */}
        <View style={[tw`flex-row border-b`, { borderColor: 'rgba(255,255,255,0.1)', backgroundColor: theme.colors.background }]}>
          <TouchableOpacity
            style={tw`flex-1 py-3 items-center`}
            onPress={() => setActiveTab('cuts')}
          >
            <VideoIcon 
              size={20} 
              color={activeTab === 'cuts' ? theme.colors.secondary : theme.colors.mutedForeground} 
            />
            <Text style={[
              tw`text-xs mt-1`, 
              { color: activeTab === 'cuts' ? theme.colors.secondary : theme.colors.mutedForeground }
            ]}>
              Cuts
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={tw`flex-1 py-3 items-center`}
            onPress={() => setActiveTab('portfolio')}
          >
            <Heart 
              size={20} 
              color={activeTab === 'portfolio' ? theme.colors.secondary : theme.colors.mutedForeground} 
            />
            <Text style={[
              tw`text-xs mt-1`, 
              { color: activeTab === 'portfolio' ? theme.colors.secondary : theme.colors.mutedForeground }
            ]}>
              Portfolio
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={tw`flex-1 py-3 items-center`}
            onPress={() => setActiveTab('services')}
          >
            <History 
              size={20} 
              color={activeTab === 'services' ? theme.colors.secondary : theme.colors.mutedForeground} 
            />
            <Text style={[
              tw`text-xs mt-1`, 
              { color: activeTab === 'services' ? theme.colors.secondary : theme.colors.mutedForeground }
            ]}>
              Services
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Tab Content */}
      <ScrollView
        style={tw`flex-1`}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {renderTabContent()}
      </ScrollView>

      {/* Portfolio Image Dialog */}
      <Dialog visible={openDialog === 'video'} onClose={() => setOpenDialog(null)}>
        {selectedVideo && (
          <View style={tw`items-center justify-center`}>
            <Image
              source={{ uri: selectedVideo.url }}
              style={[tw`rounded-xl`, { 
                width: Math.min(width - 80, 400),
                height: Math.min(width - 80, 400),
              }]}
              resizeMode="contain"
            />
          </View>
        )}
      </Dialog>

      {/* Report Modal */}
      {profile && (
        <ReportContentModal
          visible={showReportModal}
          onClose={() => setShowReportModal(false)}
          contentType="profile"
          contentId={profile.id}
          reportedUserId={profile.id}
          contentDescription={`Profile: ${profile.name}${profile.username ? ` (@${profile.username})` : ''}`}
        />
      )}

      {/* Block Confirmation Dialog */}
      {profile && (
        <Dialog visible={showBlockConfirm} onClose={() => setShowBlockConfirm(false)}>
          <DialogContent>
            <Text style={[tw`text-lg font-bold mb-2`, { color: theme.colors.foreground }]}>
              Block {profile.name}?
            </Text>
            <Text style={[tw`text-sm mb-4`, { color: theme.colors.mutedForeground }]}>
              You will no longer see this user's content, and they won't be able to contact you. This action can be undone from your settings.
            </Text>
            <View style={tw`flex-row gap-3`}>
              <TouchableOpacity
                style={[tw`flex-1 py-3 rounded-xl`, { backgroundColor: 'rgba(255,255,255,0.1)' }]}
                onPress={() => setShowBlockConfirm(false)}
              >
                <Text style={[tw`text-center font-semibold`, { color: theme.colors.foreground }]}>
                  Cancel
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[tw`flex-1 py-3 rounded-xl`, { backgroundColor: theme.colors.destructive }]}
                onPress={async () => {
                  setShowBlockConfirm(false);
                  await blockUser(profile.id, profile.name);
                }}
              >
                <Text style={[tw`text-center font-semibold`, { color: theme.colors.destructiveForeground }]}>
                  Block
                </Text>
              </TouchableOpacity>
            </View>
          </DialogContent>
        </Dialog>
      )}
    </SafeAreaView>
  );
} 