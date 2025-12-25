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
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../shared/hooks/useAuth';
import { theme } from '../shared/lib/theme';
import tw from 'twrnc';
import {
  Button,
  Card,
  CardContent,
  Badge,
  Avatar,
  Dialog,
  DialogContent,
} from '../shared/components/ui';
import {
  Heart,
  Users,
  History,
  Play,
  Camera,
  Loader2,
  Eye,
  Calendar,
  Clock,
  Share2,
} from 'lucide-react-native';
import { supabase } from '../shared/lib/supabase';
import { logger } from '../shared/lib/logger';
import VideoPreview from '../shared/components/VideoPreview';
import { ImageUpload } from '../shared/components/ui/ImageUpload';
import { VideoUpload } from '../shared/components/ui/VideoUpload';
import {
  getAvatarFallbackProps,
  getCoverFallbackProps,
} from '../shared/helpers/fallbackImageHelper';

const { width, height } = Dimensions.get('window');

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
  reviews?: Array<{
    id: string;
    user: string;
    avatar: string;
    rating: number;
    comment: string;
    date: string;
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

interface Booking {
  id: string;
  date: string;
  time: string;
  service: string;
  barber: {
    id: string;
    name: string;
    image: string;
  };
  status: 'confirmed' | 'pending' | 'cancelled' | 'completed';
}

export default function ProfilePortfolio() {
  const navigation = useNavigation();
  const { user, userProfile, logout } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [barberProfile, setBarberProfile] = useState<BarberProfile | null>(null);
  const [allCuts, setAllCuts] = useState<Cut[]>([]);
  const [cuts, setCuts] = useState<Cut[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [openDialog, setOpenDialog] = useState<null | 'video'>(null);
  const [activeTab, setActiveTab] = useState(userProfile?.role === 'barber' ? 'portfolio' : 'cuts');
  const [selectedVideo, setSelectedVideo] = useState<Cut | null>(null);
  const [selectedPortfolioImage, setSelectedPortfolioImage] = useState<string | null>(null);
  const [showAvatarUpload, setShowAvatarUpload] = useState(false);
  const [showCoverUpload, setShowCoverUpload] = useState(false);
  const [cutsPage, setCutsPage] = useState(0);
  const [avatarError, setAvatarError] = useState(false);
  const [coverError, setCoverError] = useState(false);
  const CUTS_PER_PAGE = 12;

  // Fetch profile data
  const fetchProfileData = async () => {
    if (!user) return;

    try {
      setLoading(true);
      // Reset image error states when fetching new data
      setAvatarError(false);
      setCoverError(false);
      logger.log('🔄 Fetching profile data for user:', user.id);
      logger.log('👤 User profile role:', userProfile?.role);

      // Fetch user profile
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (profileError) {
        logger.error('Error fetching profile:', profileError);
      } else {
        setProfile(profileData);
      }

              // Fetch barber profile if user is a barber
        if (userProfile?.role === 'barber') {
          const { data: barberData, error: barberError } = await supabase
            .from('barbers')
            .select('*')
            .eq('user_id', user.id)
            .single();

          if (barberError) {
            logger.error('Error fetching barber profile:', barberError);
          } else {
            setBarberProfile(barberData);
            
            // Fetch barber's cuts and services using the barber_id
            if (barberData) {
              // Fetch cuts
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
                .order('created_at', { ascending: false });

              if (cutsError) {
                logger.error('Error fetching cuts:', cutsError);
              } else {
                logger.log('📹 Fetched cuts:', cutsData?.length || 0);
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
                .order('name', { ascending: true });

              if (servicesError) {
                logger.error('Error fetching services:', servicesError);
              } else {
                logger.log('💇 Fetched services:', servicesData?.length || 0);
                // Update barberProfile with services
                setBarberProfile(prev => prev ? {
                  ...prev,
                  services: servicesData || []
                } : null);
              }
            }
          }
      } else {
        // Fetch client bookings
        const { data: bookingsData, error: bookingsError } = await supabase
          .from('bookings')
          .select(`
            *,
            barbers:barber_id(
              id,
              user_id,
              profiles:user_id(name, avatar_url)
            )
          `)
          .eq('client_id', user.id)
          .order('date', { ascending: false });

        if (bookingsError) {
          logger.error('Error fetching bookings:', bookingsError);
        } else {
          const formattedBookings = (bookingsData || []).map((booking: any) => ({
            ...booking,
            barber: {
              id: booking.barbers?.id,
              name: booking.barbers?.profiles?.name || 'Unknown',
              image: booking.barbers?.profiles?.avatar_url
            }
          }));
          setBookings(formattedBookings);
        }
      }
    } catch (error) {
      logger.error('Error fetching profile data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfileData();
  }, [user]);

  const onRefresh = async () => {
    setRefreshing(true);
    setCutsPage(0);
    await fetchProfileData();
    setRefreshing(false);
  };

  // Load more cuts when scrolling
  const loadMoreCuts = () => {
    if (isBarber) {
      const nextPage = cutsPage + 1;
      const startIndex = nextPage * CUTS_PER_PAGE;
      const endIndex = startIndex + CUTS_PER_PAGE;
      
      if (startIndex < allCuts.length) {
        const newCuts = allCuts.slice(startIndex, endIndex);
        setCuts(prev => [...prev, ...newCuts]);
        setCutsPage(nextPage);
      }
    }
  };

  const handleAvatarUpload = async (imageUrl: string) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ avatar_url: imageUrl })
        .eq('id', user?.id);

      if (error) {
        logger.error('Error updating avatar:', error);
        Alert.alert('Error', 'Failed to update avatar. Please try again.');
      } else {
        setAvatarError(false); // Reset error state
        setProfile(prev => prev ? { ...prev, avatar_url: imageUrl } : null);
        Alert.alert('Success', 'Avatar updated successfully!');
        await fetchProfileData();
      }
    } catch (error) {
      logger.error('Error updating avatar:', error);
      Alert.alert('Error', 'Failed to update avatar. Please try again.');
    }
  };

  const handleCoverUpload = async (imageUrl: string) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ coverphoto: imageUrl })
        .eq('id', user?.id);

      if (error) {
        logger.error('Error updating cover photo:', error);
        Alert.alert('Error', 'Failed to update cover photo. Please try again.');
      } else {
        setCoverError(false); // Reset error state
        setProfile(prev => prev ? { ...prev, coverphoto: imageUrl } : null);
        Alert.alert('Success', 'Cover photo updated successfully!');
        await fetchProfileData();
      }
    } catch (error) {
      logger.error('Error updating cover photo:', error);
      Alert.alert('Error', 'Failed to update cover photo. Please try again.');
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

  // Set initial tab based on user role
  useEffect(() => {
    if (userProfile) {
      if (userProfile.role === 'barber') {
        setActiveTab('portfolio');
      } else {
        setActiveTab('cuts');
      }
    }
  }, [userProfile]);

  if (loading) {
    return (
      <SafeAreaView style={[tw`flex-1 justify-center items-center`, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator size="large" color={theme.colors.secondary} />
        <Text style={[tw`mt-4 text-lg`, { color: theme.colors.foreground }]}>
          Loading your profile...
        </Text>
      </SafeAreaView>
    );
  }

  if (!user || !profile) {
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

  const isBarber = userProfile?.role === 'barber';
  const pastBarbers = [...new Set(bookings.map(b => b.barber.id))].map(barberId => {
    const booking = bookings.find(b => b.barber.id === barberId);
    return booking?.barber;
  }).filter(Boolean);

  const renderTabContent = () => {
    switch (activeTab) {
      case 'portfolio':
        return (
          <View style={tw`flex-1 px-4`}>
            {isBarber ? (
              // Barber Portfolio - Show portfolio images
              <View style={tw`space-y-4 py-4`}>
                {/* Portfolio Image Upload */}
                <ImageUpload
                  onUploadComplete={async (imageUrl) => {
                    try {
                      // Add image to barber's portfolio
                      const updatedPortfolio = [...(barberProfile?.portfolio || []), imageUrl];
                      const { error } = await supabase
                        .from('barbers')
                        .update({ portfolio: updatedPortfolio })
                        .eq('user_id', user?.id);

                      if (error) {
                        Alert.alert('Error', 'Failed to save portfolio image');
                      } else {
                        // Update local state
                        setBarberProfile(prev => prev ? {
                          ...prev,
                          portfolio: updatedPortfolio
                        } : null);
                        // Refresh profile data to ensure UI is updated
                        await fetchProfileData();
                        Alert.alert('Success', 'Portfolio image added successfully!');
                      }
                    } catch (error) {
                      Alert.alert('Error', 'Failed to save portfolio image');
                    }
                  }}
                  onUploadError={(error) => {
                    Alert.alert('Upload Error', error);
                  }}
                  maxImages={10}
                  aspectRatio={1}
                  title="Add Portfolio Image"
                  description="Showcase your best work"
                  existingImages={barberProfile?.portfolio || []}
                  onImagePress={(imageUrl) => {
                    setSelectedPortfolioImage(imageUrl);
                  }}
                  onRemoveImage={async (index) => {
                    try {
                      const updatedPortfolio = (barberProfile?.portfolio || []).filter((_, i) => i !== index);
                      const { error } = await supabase
                        .from('barbers')
                        .update({ portfolio: updatedPortfolio })
                        .eq('user_id', user?.id);

                      if (error) {
                        Alert.alert('Error', 'Failed to remove portfolio image');
                      } else {
                        setBarberProfile(prev => prev ? {
                          ...prev,
                          portfolio: updatedPortfolio
                        } : null);
                      }
                    } catch (error) {
                      Alert.alert('Error', 'Failed to remove portfolio image');
                    }
                  }}
                />


              </View>
            ) : (
              // Client Portfolio - Empty state (portfolio tab hidden for clients)
                  <View style={tw`flex-1 justify-center items-center py-8`}>
                    <Text style={[tw`text-sm text-center`, { color: theme.colors.mutedForeground }]}>
                  Portfolio view not available for clients
                    </Text>
              </View>
            )}
          </View>
        );

      case 'cuts':
        return (
          <View style={tw`flex-1 px-4`}>
            {isBarber ? (
              <View style={tw`space-y-4 py-4`}>
                {/* Video Upload */}
                <VideoUpload
                  onUploadComplete={async (videoData) => {
                    try {
                      // Get barber ID
                      const { data: barberData } = await supabase
                        .from('barbers')
                        .select('id')
                        .eq('user_id', user?.id)
                        .single();

                      if (!barberData) {
                        Alert.alert('Error', 'Barber profile not found');
                        return;
                      }

                      // Create new cut record
                      const { error } = await supabase
                        .from('cuts')
                        .insert({
                          barber_id: barberData.id,
                          title: videoData.title,
                          description: videoData.description,
                          url: videoData.url,
                          is_public: true,
                          views: 0,
                          likes: 0,
                          shares: 0,
                        });

                      if (error) {
                        Alert.alert('Error', 'Failed to save cut');
                      } else {
                        Alert.alert('Success', 'Cut uploaded successfully!');
                        // Refresh cuts data
                        fetchProfileData();
                      }
                    } catch (error) {
                      Alert.alert('Error', 'Failed to save cut');
                    }
                  }}
                  onUploadError={(error) => {
                    Alert.alert('Upload Error', error);
                  }}
                  title="Upload New Cut"
                  description="Share your latest work"
                />

                {/* Cuts List */}
                {cuts.length > 0 && (
                  <View style={tw`space-y-3`}>
                    <Text style={[tw`text-lg font-semibold`, { color: theme.colors.foreground }]}>
                      My Cuts ({cuts.length})
                    </Text>
                    <View style={tw`space-y-3`}>
                      {cuts.map((cut) => (
                        <Card key={cut.id} style={[tw`bg-white/5 border`, { borderColor: 'rgba(255,255,255,0.1)' }]}>
                          <CardContent style={tw`p-4`}>
                            <View style={tw`flex-row items-center gap-3`}>
                              <View style={tw`w-16 h-16 rounded-lg overflow-hidden bg-white/10`}>
                                {cut.thumbnail ? (
                                  <Image
                                    source={{ uri: cut.thumbnail }}
                                    style={tw`w-full h-full`}
                                    resizeMode="cover"
                                  />
                                ) : (
                                  <View style={tw`w-full h-full items-center justify-center`}>
                                    <Play size={24} color={theme.colors.mutedForeground} />
                                  </View>
                                )}
                              </View>
                              <View style={tw`flex-1`}>
                                <Text style={[tw`font-semibold`, { color: theme.colors.foreground }]}>
                                  {cut.title}
                                </Text>
                                <Text style={[tw`text-sm`, { color: theme.colors.mutedForeground }]}>
                                  {cut.description || 'No description'}
                                </Text>
                                <View style={tw`flex-row items-center gap-4 mt-1`}>
                                  <View style={tw`flex-row items-center gap-1`}>
                                    <Eye size={12} color={theme.colors.mutedForeground} />
                                    <Text style={[tw`text-xs`, { color: theme.colors.mutedForeground }]}>
                                      {cut.views} views
                                    </Text>
                                  </View>
                                  <View style={tw`flex-row items-center gap-1`}>
                                    <Heart size={12} color={theme.colors.mutedForeground} />
                                    <Text style={[tw`text-xs`, { color: theme.colors.mutedForeground }]}>
                                      {cut.likes} likes
                                    </Text>
                                  </View>
                                </View>
                              </View>
                            </View>
                          </CardContent>
                        </Card>
                      ))}
                    </View>
                  </View>
                )}
              </View>
            ) : (
              <View style={tw`flex-1 justify-center items-center py-8`}>
                <Users size={48} style={[tw`mb-4`, { color: theme.colors.mutedForeground }]} />
                <Text style={[tw`font-bold text-xl mb-2 text-center`, { color: theme.colors.foreground }]}>
                  No past stylists
                </Text>
                <Text style={[tw`text-sm text-center`, { color: theme.colors.mutedForeground }]}>
                  Book appointments to see your stylists here
                </Text>
              </View>
            )}
          </View>
        );

      case 'services':
        return (
          <View style={tw`flex-1 px-4`}>
            {isBarber ? (
              <View style={tw`space-y-4 py-4`}>
                {/* Services Overview Header */}
                <View style={[
                  tw`flex-row items-center justify-center p-6 rounded-2xl`,
                  { backgroundColor: 'rgba(255,255,255,0.05)' }
                ]}>
                  <View style={tw`items-center`}>
                    <View style={[
                      tw`w-12 h-12 rounded-full items-center justify-center mb-3`,
                      { backgroundColor: 'rgba(255,255,255,0.1)' }
                    ]}>
                      <History size={24} color={theme.colors.secondary} />
                    </View>
                    <Text style={[tw`font-semibold text-base`, { color: theme.colors.foreground }]}>
                      My Services
                    </Text>
                    <Text style={[tw`text-sm mt-1`, { color: theme.colors.mutedForeground }]}>
                      View your current offerings
                    </Text>
                  </View>
                </View>

                {/* Services Overview */}
                <View style={tw`space-y-3`}>
                  <Text style={[tw`text-lg font-semibold`, { color: theme.colors.foreground }]}>
                    My Services
                  </Text>
                  
                  {barberProfile?.services && barberProfile.services.length > 0 ? (
                    <View style={tw`space-y-3`}>
                      {barberProfile.services.map((service) => (
                        <View key={service.id} style={[
                          tw`p-4 rounded-xl`,
                          { backgroundColor: 'rgba(255,255,255,0.05)' }
                        ]}>
                          <View style={tw`flex-row items-center justify-between`}>
                            <View style={tw`flex-1`}>
                              <Text style={[tw`font-semibold text-base`, { color: theme.colors.foreground }]}>
                                {service.name}
                              </Text>
                              {service.description && (
                                <Text style={[tw`text-sm mt-1`, { color: theme.colors.mutedForeground }]}>
                                  {service.description}
                                </Text>
                              )}
                              <View style={tw`flex-row items-center mt-2`}>
                                <View style={[
                                  tw`px-2 py-1 rounded-full`,
                                  { backgroundColor: 'rgba(255,255,255,0.1)' }
                                ]}>
                                  <Text style={[tw`text-xs font-medium`, { color: theme.colors.secondary }]}>
                                    {service.duration} min
                                  </Text>
                                </View>
                              </View>
                            </View>
                            <View style={tw`items-end`}>
                              <Text style={[tw`font-bold text-xl`, { color: theme.colors.secondary }]}>
                                ${service.price}
                              </Text>
                            </View>
                          </View>
                        </View>
                      ))}
                    </View>
                  ) : (
                    <View style={tw`flex-1 justify-center items-center py-8`}>
                      <History size={48} style={[tw`mb-4`, { color: 'rgba(255,255,255,0.4)' }]} />
                      <Text style={[tw`font-bold text-xl mb-2 text-center`, { color: theme.colors.foreground }]}>
                        No services set up yet
                      </Text>
                      <Text style={[tw`text-sm text-center`, { color: theme.colors.mutedForeground }]}>
                        Set up your services and pricing to start accepting bookings
                      </Text>
                    </View>
                  )}
                </View>
              </View>
            ) : (
              <View style={tw`space-y-4`}>
                {bookings.length === 0 ? (
                  <View style={tw`flex-1 justify-center items-center py-8`}>
                    <Calendar size={48} style={[tw`mb-4`, { color: 'rgba(255,255,255,0.4)' }]} />
                    <Text style={[tw`font-bold text-xl mb-2 text-center`, { color: theme.colors.foreground }]}>
                      No bookings yet
                    </Text>
                    <Text style={[tw`text-sm text-center`, { color: theme.colors.mutedForeground }]}>
                      Start booking appointments with stylists
                    </Text>
                  </View>
                ) : (
                  bookings.map((booking) => (
                    <Card key={booking.id} style={[tw`bg-white/5 border`, { borderColor: 'rgba(255,255,255,0.1)' }]}>
                      <CardContent style={tw`p-4`}>
                        <View style={tw`flex-row items-center gap-3`}>
                          <Avatar size="md" src={booking.barber.image} fallback={booking.barber.name?.charAt(0)} />
                          <View style={tw`flex-1`}>
                            <Text style={[tw`font-semibold`, { color: theme.colors.foreground }]}>
                              {booking.barber.name}
                            </Text>
                            <Text style={[tw`text-sm`, { color: theme.colors.mutedForeground }]}>
                              {booking.service}
                            </Text>
                            <View style={tw`flex-row items-center gap-4 mt-1`}>
                              <View style={tw`flex-row items-center gap-1`}>
                                <Calendar size={12} color={theme.colors.mutedForeground} />
                                <Text style={[tw`text-xs`, { color: theme.colors.mutedForeground }]}>
                                  {formatDate(booking.date)}
                                </Text>
                              </View>
                              <View style={tw`flex-row items-center gap-1`}>
                                <Clock size={12} color={theme.colors.mutedForeground} />
                                <Text style={[tw`text-xs`, { color: theme.colors.mutedForeground }]}>
                                  {formatTime(booking.time)}
                                </Text>
                              </View>
                            </View>
                          </View>
                          <Badge 
                            style={[
                              booking.status === 'completed' 
                                ? { backgroundColor: 'rgba(34, 197, 94, 0.2)', borderColor: 'rgba(34, 197, 94, 0.3)' }
                                : { backgroundColor: 'rgba(180, 138, 60, 0.2)', borderColor: 'rgba(180, 138, 60, 0.3)' }
                            ]}
                          >
                            <Text style={[
                              booking.status === 'completed' 
                                ? { color: '#22c55e' }
                                : { color: theme.colors.secondary }
                            ]}>
                              {booking.status}
                            </Text>
                          </Badge>
                        </View>
                      </CardContent>
                    </Card>
                  ))
                )}
              </View>
            )}
          </View>
        );

      default:
        return null;
    }
  };

  return (
    <SafeAreaView style={[tw`flex-1`, { backgroundColor: theme.colors.background }]}>
      {/* Header Section */}
      <View style={tw`relative w-full overflow-hidden`}>
        {/* Cover Photo */}
        <View style={[tw`h-32 w-full flex items-center justify-center relative`, { backgroundColor: theme.colors.muted }]}>
          {profile.coverphoto && !coverError ? (
            <Image
              source={{ uri: profile.coverphoto }}
              style={tw`absolute inset-0 w-full h-full`}
              resizeMode="cover"
              onError={() => {
                setCoverError(true);
              }}
            />
          ) : (
            <LinearGradient
              colors={getCoverFallbackProps(profile.name || profile.username).gradientColors as [string, string]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={tw`absolute inset-0 w-full h-full`}
            />
          )}
          {/* Camera button for cover photo */}
          <TouchableOpacity
            style={tw`absolute top-3 right-3 z-20 h-8 w-8 rounded-full bg-black/40 items-center justify-center`}
            onPress={() => setShowCoverUpload(true)}
          >
            <Camera size={16} color="white" />
          </TouchableOpacity>
          {/* Glass overlay */}
          <View style={tw`absolute inset-0 bg-black/30 z-10`} />
        </View>

        {/* Avatar - Positioned exactly where cover photo ends */}
        <View style={tw`absolute left-3/8 top-20 -translate-x-1/2  z-20`}>
          <View style={[tw`w-24 h-24 rounded-full overflow-hidden border-2`, { borderColor: theme.colors.secondary }]}>
            {profile.avatar_url && !avatarError ? (
              <Image
                source={{ uri: profile.avatar_url }}
                style={tw`w-full h-full`}
                resizeMode="cover"
                onError={() => {
                  setAvatarError(true);
                }}
              />
            ) : (
              <LinearGradient
                colors={[
                  getAvatarFallbackProps(profile.name || profile.username).backgroundColor,
                  getCoverFallbackProps(profile.name || profile.username).gradientColors[1] || getAvatarFallbackProps(profile.name || profile.username).backgroundColor,
                ]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={tw`w-full h-full items-center justify-center`}
              >
                <Text
                  style={[
                    tw`text-3xl font-bold`,
                    { color: getAvatarFallbackProps(profile.name || profile.username).textColor },
                  ]}
                >
                  {getAvatarFallbackProps(profile.name || profile.username).initials}
                </Text>
              </LinearGradient>
            )}
          </View>
          <TouchableOpacity
            style={[tw`absolute bottom-0 right-0 h-8 w-8 rounded-full items-center justify-center`, { backgroundColor: theme.colors.secondary }]}
            onPress={() => setShowAvatarUpload(true)}
          >
            <Camera size={14} color={theme.colors.primary} />
          </TouchableOpacity>
        </View>
        
        {/* Profile Info */}
        <View style={tw`px-4 pt-16 pb-4 items-center`}>
          <Text style={[tw`text-xl font-bold mb-1 text-center`, { color: theme.colors.foreground }]}>
            {isBarber && barberProfile?.business_name ? barberProfile.business_name : profile.name}
          </Text>
          {profile.username && (
            <Text style={[tw`text-sm mb-1 text-center`, { color: theme.colors.secondary }]}>
              @{profile.username}
            </Text>
          )}
          {isBarber && barberProfile?.bio && (
            <Text style={[tw`text-sm mb-2 text-center`, { color: theme.colors.mutedForeground }]}>
              {barberProfile.bio}
            </Text>
          )}
          {profile.location && (
            <Text style={[tw`text-sm text-center`, { color: theme.colors.foreground }]}>
              {profile.location}
            </Text>
          )}
          {isBarber && barberProfile?.specialties && barberProfile.specialties.length > 0 && (
            <View style={tw`flex-row flex-wrap justify-center mt-2 gap-1`}>
              {barberProfile.specialties.slice(0, 3).map((specialty, index) => (
                <Badge key={index} style={tw`bg-white/10 border-white/20`}>
                  <Text style={[tw`text-xs`, { color: theme.colors.foreground }]}>
                    {specialty}
                  </Text>
                </Badge>
              ))}
              {barberProfile.specialties.length > 3 && (
                <Badge style={tw`bg-white/10 border-white/20`}>
                  <Text style={[tw`text-xs`, { color: theme.colors.foreground }]}>
                    +{barberProfile.specialties.length - 3} more
                  </Text>
                </Badge>
              )}
            </View>
          )}
        </View>

        {/* Tabs Under Avatar */}
        <View style={[tw`flex-row border-b`, { borderColor: 'rgba(255,255,255,0.1)', backgroundColor: theme.colors.background }]}>
          {isBarber && (
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
          )}
          
          <TouchableOpacity
            style={tw`flex-1 py-3 items-center`}
            onPress={() => setActiveTab('cuts')}
          >
            <Users 
              size={20} 
              color={activeTab === 'cuts' ? theme.colors.secondary : theme.colors.mutedForeground} 
            />
            <Text style={[
              tw`text-xs mt-1`, 
              { color: activeTab === 'cuts' ? theme.colors.secondary : theme.colors.mutedForeground }
            ]}>
              {isBarber ? 'My Cuts' : 'Stylists'}
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
              {isBarber ? 'Services' : 'Bookings'}
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

      {/* Video Dialog */}
      <Dialog visible={openDialog === 'video'} onClose={() => setOpenDialog(null)}>
        <DialogContent>
          {selectedVideo && (
            <>
              <View style={tw`aspect-video`}>
                <Image
                  source={{ uri: selectedVideo.url }}
                  style={tw`w-full h-full`}
                  resizeMode="cover"
                />
              </View>
              <View style={tw`p-4`}>
                <View style={tw`flex-row items-center gap-3 mb-3`}>
                  <Avatar size="md" src={selectedVideo.barber.image} fallback={selectedVideo.barber.name?.charAt(0)} />
                  <View style={tw`flex-1`}>
                    <Text style={[tw`font-bold text-lg`, { color: theme.colors.foreground }]}>
                      {selectedVideo.title}
                    </Text>
                    <Text style={[tw`text-sm`, { color: theme.colors.mutedForeground }]}>
                      {selectedVideo.barber.name}
                    </Text>
                  </View>
                </View>
                <View style={tw`flex-row items-center justify-around`}>
                  <View style={tw`flex-row items-center gap-1`}>
                    <Eye size={16} color={theme.colors.mutedForeground} />
                    <Text style={[tw`text-sm`, { color: theme.colors.mutedForeground }]}>
                      {selectedVideo.views} views
                    </Text>
                  </View>
                  <View style={tw`flex-row items-center gap-1`}>
                    <Heart size={16} color={theme.colors.mutedForeground} />
                    <Text style={[tw`text-sm`, { color: theme.colors.mutedForeground }]}>
                      {selectedVideo.likes} likes
                    </Text>
                  </View>
                  <View style={tw`flex-row items-center gap-1`}>
                    <Share2 size={16} color={theme.colors.mutedForeground} />
                    <Text style={[tw`text-sm`, { color: theme.colors.mutedForeground }]}>
                      {selectedVideo.shares} shares
                    </Text>
                  </View>
                </View>
              </View>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Portfolio Image Preview Dialog */}
      <Dialog visible={selectedPortfolioImage !== null} onClose={() => setSelectedPortfolioImage(null)}>
        {selectedPortfolioImage && (
          <View style={tw`items-center justify-center`}>
            <Image
              source={{ uri: selectedPortfolioImage }}
              style={[tw`rounded-xl`, { 
                width: Math.min(width - 80, 400),
                height: Math.min(width - 80, 400),
              }]}
              resizeMode="contain"
            />
          </View>
        )}
      </Dialog>

      {/* Avatar Upload Modal */}
      <Dialog visible={showAvatarUpload} onClose={() => setShowAvatarUpload(false)}>
        <View style={tw`p-4`}>
          <Text style={[tw`text-lg font-semibold mb-4`, { color: theme.colors.foreground }]}>
            Update Profile Picture
          </Text>
          <ImageUpload
            onUploadComplete={async (imageUrl) => {
              await handleAvatarUpload(imageUrl);
              setShowAvatarUpload(false);
            }}
            onUploadError={(error) => {
              Alert.alert('Upload Error', error);
            }}
            maxImages={1}
            aspectRatio={1}
            title="Upload Avatar"
            description="Select a square image for your profile picture"
            existingImages={profile?.avatar_url ? [profile.avatar_url] : []}
            customPath="avatars"
            upsert={true}
            onRemoveImage={async () => {
              try {
                const { error } = await supabase
                  .from('profiles')
                  .update({ avatar_url: null })
                  .eq('id', user?.id);

                if (error) {
                  Alert.alert('Error', 'Failed to remove avatar');
                } else {
                  setProfile(prev => prev ? { ...prev, avatar_url: undefined } : null);
                  await fetchProfileData();
                }
              } catch (error) {
                Alert.alert('Error', 'Failed to remove avatar');
              }
            }}
          />
        </View>
      </Dialog>

      {/* Cover Photo Upload Modal */}
      <Dialog visible={showCoverUpload} onClose={() => setShowCoverUpload(false)}>
        <View style={tw`p-4`}>
          <Text style={[tw`text-lg font-semibold mb-4`, { color: theme.colors.foreground }]}>
            Update Cover Photo
          </Text>
          <ImageUpload
            onUploadComplete={async (imageUrl) => {
              await handleCoverUpload(imageUrl);
              setShowCoverUpload(false);
            }}
            onUploadError={(error) => {
              Alert.alert('Upload Error', error);
            }}
            maxImages={1}
            aspectRatio={16/9}
            title="Upload Cover Photo"
            description="Select a wide image for your cover photo"
            existingImages={profile?.coverphoto ? [profile.coverphoto] : []}
            customPath="covers"
            upsert={true}
            onRemoveImage={async () => {
              try {
                const { error } = await supabase
                  .from('profiles')
                  .update({ coverphoto: null })
                  .eq('id', user?.id);

                if (error) {
                  Alert.alert('Error', 'Failed to remove cover photo');
                } else {
                  setProfile(prev => prev ? { ...prev, coverphoto: undefined } : null);
                  await fetchProfileData();
                }
              } catch (error) {
                Alert.alert('Error', 'Failed to remove cover photo');
              }
            }}
          />
        </View>
      </Dialog>
    </SafeAreaView>
  );
} 