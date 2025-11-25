import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Switch,
  Alert,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import tw from 'twrnc';
import { theme } from '../../lib/theme';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import { Button, Card, CardContent, LoadingSpinner, LocationInput } from '../ui';
import { 
  User, 
  Mail, 
  Phone, 
  MapPin, 
  Building2, 
  Save, 
  AlertCircle,
  Instagram,
  Twitter,
  Facebook,
  Music,
  Sparkles,
  Check,
  Info,
  Camera
} from 'lucide-react-native';
import { ProfileFormData } from '../../types/settings.types';
import { 
  CARRIER_OPTIONS, 
  PRICE_RANGES, 
  BARBER_SPECIALTIES, 
  extractHandle 
} from '../../utils/settings.utils';
import { notificationService } from '../../lib/notifications';
import { logger } from '../../lib/logger';


interface ProfileSettingsProps {
  onUpdate?: () => void;
}

export function ProfileSettings({ onUpdate }: ProfileSettingsProps) {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [isBarber, setIsBarber] = useState(false);
  const [barberId, setBarberId] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<{[key: string]: string}>({});
  const [formData, setFormData] = useState<ProfileFormData>({
    name: '',
    username: '',
    email: '',
    phone: '',
    bio: '',
    location: '',
    description: '',
    specialties: [],
    businessName: '',
    isPublic: true,
    socialMedia: {
      instagram: '',
      twitter: '',
      tiktok: '',
      facebook: ''
    },
    sms_notifications: false,
  });

  useEffect(() => {
    if (user) {
      fetchProfile();
    }
  }, [user]);

  const fetchProfile = async () => {
    if (!user) return;

    try {
      setIsLoading(true);
      
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (profile?.role === 'barber') {
        setIsBarber(true);
        const { data: barber } = await supabase
          .from('barbers')
          .select('*')
          .eq('user_id', user.id)
          .single();

        if (barber) {
          setBarberId(barber.id);
          setFormData({
            name: profile.name || '',
            username: profile.username || '',
            email: profile.email || '',
            phone: profile.phone || '',
            bio: barber.bio || profile.bio || '',
            location: profile.location || '',
            description: profile.description || '',
            specialties: barber.specialties || [],
            businessName: barber.business_name || '',
            isPublic: profile.is_public ?? true,
            socialMedia: {
              instagram: barber.instagram || '',
              twitter: barber.twitter || '',
              tiktok: barber.tiktok || '',
              facebook: barber.facebook || ''
            },
            sms_notifications: profile.sms_notifications || false,
          });
        }
      } else {
        setFormData({
          name: profile.name || '',
          username: profile.username || '',
          email: profile.email || '',
          phone: profile.phone || '',
          bio: profile.bio || '',
          location: profile.location || '',
          description: profile.description || '',
          specialties: [],
          businessName: '',
          isPublic: profile.is_public || false,
          socialMedia: {
            instagram: '',
            twitter: '',
            tiktok: '',
            facebook: ''
          },
          sms_notifications: profile.sms_notifications || false,
        });
      }
    } catch (error) {
      logger.error('Error fetching profile:', error);
      Alert.alert('Error', 'Failed to load profile data');
    } finally {
      setIsLoading(false);
    }
  };

  const validateForm = (): boolean => {
    const errors: {[key: string]: string} = {};
    
    if (!formData.name?.trim()) errors.name = 'Full name is required';
    if (!formData.username?.trim()) errors.username = 'Username is required';
    if (formData.username && !/^[a-zA-Z0-9_]{3,30}$/.test(formData.username)) {
      errors.username = 'Username must be 3-30 characters, letters, numbers, and underscores only';
    }
    if (!formData.email?.trim()) errors.email = 'Email is required';
    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      errors.email = 'Please enter a valid email address';
    }

    if (isBarber && !formData.businessName?.trim()) {
      errors.businessName = 'Business name is required for barbers';
    }
    if (isBarber && !formData.bio?.trim()) {
      errors.bio = 'Bio is required for barbers';
    }
    
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSave = async () => {
    if (!validateForm()) {
      Alert.alert('Validation Error', 'Please fix the errors before saving.');
      return;
    }

    try {
      setIsLoading(true);
      
      // Update profile
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          name: formData.name,
          username: formData.username,
          email: formData.email,
          phone: formData.phone,
          bio: formData.bio,
          location: formData.location,
          description: formData.description,
          is_public: formData.isPublic,
          sms_notifications: formData.sms_notifications,
        })
        .eq('id', user?.id);

      if (profileError) throw profileError;

      // If user is a barber and location changed, try to geocode and save coordinates
      if (isBarber && formData.location) {
        try {
          const encodedLocation = encodeURIComponent(formData.location);
          const response = await fetch(
            `https://nominatim.openstreetmap.org/search?format=json&q=${encodedLocation}&limit=1`
          );
          const data = await response.json();
          
          if (data && data.length > 0) {
            const coordinates = {
              latitude: parseFloat(data[0].lat),
              longitude: parseFloat(data[0].lon)
            };
            
            // Update barber table with coordinates
            const { error: barberError } = await supabase
              .from('barbers')
              .update({
                latitude: coordinates.latitude,
                longitude: coordinates.longitude,
                city: data[0].address?.city || data[0].address?.town || data[0].address?.village,
                state: data[0].address?.state,
                updated_at: new Date().toISOString()
              })
              .eq('user_id', user?.id);
              
            if (barberError) {
              logger.error('Error updating barber coordinates:', barberError);
            } else {
              logger.log('✅ Barber coordinates updated:', coordinates);
            }
          }
        } catch (geocodeError) {
          logger.error('Geocoding error:', geocodeError);
          // Don't fail the save if geocoding fails
        }
      }

      // Update barber data if applicable
      if (isBarber && barberId) {
        const { error: barberError } = await supabase
          .from('barbers')
          .update({
            business_name: formData.businessName,
            bio: formData.bio,
            specialties: formData.specialties,
            instagram: extractHandle(formData.socialMedia.instagram),
            twitter: extractHandle(formData.socialMedia.twitter),
            tiktok: extractHandle(formData.socialMedia.tiktok),
            facebook: extractHandle(formData.socialMedia.facebook),
          })
          .eq('id', barberId);

        if (barberError) throw barberError;
      }

      Alert.alert('Success', 'Profile updated successfully!');
      onUpdate?.();
    } catch (error) {
      logger.error('Error updating profile:', error);
      Alert.alert('Error', 'Failed to update profile');
    } finally {
      setIsLoading(false);
    }
  };

  const toggleSpecialty = (specialty: string) => {
    const currentSpecialties = formData.specialties;
    const newSpecialties = currentSpecialties.includes(specialty)
      ? currentSpecialties.filter(s => s !== specialty)
      : [...currentSpecialties, specialty];
    setFormData({ ...formData, specialties: newSpecialties });
  };

  const handlePushNotificationToggle = async () => {
    try {
      if (!formData.sms_notifications) {
        // Enable push notifications
        logger.log('🔔 Requesting push notification permissions...');
        
        // Initialize notifications and request permissions
        await notificationService.initialize();
        
        // Update local state
        setFormData({ ...formData, sms_notifications: true });
        
        Alert.alert(
          'Push Notifications Enabled',
          'You will now receive notifications for bookings, payments, and other important updates.',
          [{ text: 'OK' }]
        );
      } else {
        // Disable push notifications
        logger.log('🔕 Disabling push notifications...');
        
        // Update local state
        setFormData({ ...formData, sms_notifications: false });
        
        Alert.alert(
          'Push Notifications Disabled',
          'You will no longer receive push notifications. You can re-enable them anytime.',
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      logger.error('Error toggling push notifications:', error);
      Alert.alert(
        'Error',
        'Failed to update push notification settings. Please try again.',
        [{ text: 'OK' }]
      );
    }
  };

  const InputField = ({ 
    label, 
    value, 
    onChangeText, 
    placeholder, 
    keyboardType = 'default' as any,
    icon: Icon,
    error,
    multiline = false,
    description
  }: any) => (
    <View style={tw`mb-4`}>
      <View style={tw`flex-row items-center mb-2`}>
        {Icon && <Icon size={16} color={theme.colors.secondary} style={tw`mr-2`} />}
        <Text style={[tw`text-sm font-medium`, { color: theme.colors.foreground }]}>{label}</Text>
      </View>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={theme.colors.mutedForeground}
        keyboardType={keyboardType}
        multiline={multiline}
        style={[
          tw`px-4 py-3 rounded-xl text-base`,
          multiline && tw`h-24`,
          { 
            backgroundColor: 'rgba(255,255,255,0.05)', 
            color: theme.colors.foreground,
            borderWidth: 1,
            borderColor: error ? theme.colors.destructive : 'rgba(255,255,255,0.1)',
            textAlignVertical: multiline ? 'top' : 'center'
          }
        ]}
      />
      {description && (
        <Text style={[tw`text-xs mt-1`, { color: theme.colors.mutedForeground }]}>{description}</Text>
      )}
      {error && (
        <Text style={[tw`text-xs mt-1`, { color: theme.colors.destructive }]}>{error}</Text>
      )}
    </View>
  );

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={tw`flex-1`}
    >
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={tw`pb-24`}>
        {/* Basic Information */}
        <Card style={[tw`mb-6`, { backgroundColor: 'rgba(255,255,255,0.05)', borderColor: 'rgba(255,255,255,0.1)' }]}>
          <CardContent style={tw`p-4`}>
            <View style={tw`flex-row items-center mb-4`}>
              <User size={20} color={theme.colors.secondary} style={tw`mr-2`} />
              <Text style={[tw`text-lg font-semibold`, { color: theme.colors.foreground }]}>
                Basic Information
              </Text>
            </View>

            <InputField
              label="Full Name *"
              value={formData.name}
              onChangeText={(text: string) => setFormData({ ...formData, name: text })}
              placeholder="Your full name"
              icon={User}
              error={validationErrors.name}
            />

            <InputField
              label="Username *"
              value={formData.username}
              onChangeText={(text: string) => setFormData({ ...formData, username: text })}
              placeholder="your_username"
              icon={User}
              error={validationErrors.username}
              description={`bocmstyle.com/book/${formData.username || 'your_username'}`}
            />

            {isBarber && (
              <InputField
                label="Business Name *"
                value={formData.businessName}
                onChangeText={(text: string) => setFormData({ ...formData, businessName: text })}
                placeholder="Your business name"
                icon={Building2}
                error={validationErrors.businessName}
              />
            )}

            <InputField
              label="Email *"
              value={formData.email}
              onChangeText={(text: string) => setFormData({ ...formData, email: text })}
              placeholder="your@email.com"
              keyboardType="email-address"
              icon={Mail}
              error={validationErrors.email}
            />

            <InputField
              label="Phone"
              value={formData.phone}
              onChangeText={(text: string) => setFormData({ ...formData, phone: text })}
              placeholder="(555) 123-4567"
              keyboardType="phone-pad"
              icon={Phone}
              error={validationErrors.phone}
            />

            <View style={tw`mb-4`}>
              <View style={tw`flex-row items-center mb-2`}>
                <MapPin size={16} color={theme.colors.secondary} style={tw`mr-2`} />
                <Text style={[tw`text-sm font-medium`, { color: theme.colors.foreground }]}>
                  Location
                </Text>
              </View>
              <LocationInput
                value={formData.location}
                onChange={(value: string) => setFormData({ ...formData, location: value })}
                placeholder="Enter your location..."
                error={validationErrors.location}
              />
            </View>

            <InputField
              label="Bio"
              value={formData.bio}
              onChangeText={(text: string) => setFormData({ ...formData, bio: text })}
              placeholder="Tell clients about yourself..."
              multiline
              error={validationErrors.bio}
              description={`${formData.bio.length}/500 characters`}
            />
          </CardContent>
        </Card>

        {/* Professional Information (Barbers only) */}
        {isBarber && (
          <Card style={[tw`mb-6`, { backgroundColor: 'rgba(255,255,255,0.05)', borderColor: 'rgba(255,255,255,0.1)' }]}>
            <CardContent style={tw`p-4`}>
              <View style={tw`flex-row items-center mb-4`}>
                <Sparkles size={20} color={theme.colors.secondary} style={tw`mr-2`} />
                <Text style={[tw`text-lg font-semibold`, { color: theme.colors.foreground }]}>
                  Professional Information
                </Text>
              </View>

              <View style={tw`mb-4`}>
                <Text style={[tw`text-sm font-medium mb-2`, { color: theme.colors.foreground }]}>
                  Specialties *
                </Text>
                <View style={tw`flex-row flex-wrap`}>
                  {BARBER_SPECIALTIES.map((specialty) => (
                    <TouchableOpacity
                      key={specialty}
                      onPress={() => toggleSpecialty(specialty)}
                      style={[
                        tw`mr-2 mb-2 px-3 py-1.5 rounded-full`,
                        formData.specialties.includes(specialty)
                          ? { backgroundColor: theme.colors.secondary }
                          : { backgroundColor: 'rgba(255,255,255,0.1)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' }
                      ]}
                    >
                      <Text style={[
                        tw`text-sm`,
                        { color: formData.specialties.includes(specialty) ? theme.colors.primaryForeground : theme.colors.foreground }
                      ]}>
                        {specialty}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
                {validationErrors.specialties && (
                  <Text style={[tw`text-xs mt-1`, { color: theme.colors.destructive }]}>{validationErrors.specialties}</Text>
                )}
              </View>
            </CardContent>
          </Card>
        )}

        {/* Social Media */}
        {isBarber && (
          <Card style={[tw`mb-6`, { backgroundColor: 'rgba(255,255,255,0.05)', borderColor: 'rgba(255,255,255,0.1)' }]}>
            <CardContent style={tw`p-4`}>
              <View style={tw`flex-row items-center mb-4`}>
                <Sparkles size={20} color={theme.colors.secondary} style={tw`mr-2`} />
                <Text style={[tw`text-lg font-semibold`, { color: theme.colors.foreground }]}>
                  Social Media
                </Text>
              </View>

              <InputField
                label="Instagram"
                value={formData.socialMedia.instagram}
                onChangeText={(text: string) => setFormData({ 
                  ...formData, 
                  socialMedia: { ...formData.socialMedia, instagram: text }
                })}
                placeholder="@yourusername"
                icon={Instagram}
              />

              <InputField
                label="Twitter/X"
                value={formData.socialMedia.twitter}
                onChangeText={(text: string) => setFormData({ 
                  ...formData, 
                  socialMedia: { ...formData.socialMedia, twitter: text }
                })}
                placeholder="@yourusername"
                icon={Twitter}
              />

              <InputField
                label="TikTok"
                value={formData.socialMedia.tiktok}
                onChangeText={(text: string) => setFormData({ 
                  ...formData, 
                  socialMedia: { ...formData.socialMedia, tiktok: text }
                })}
                placeholder="@yourusername"
                icon={Music}
              />

              <InputField
                label="Facebook"
                value={formData.socialMedia.facebook}
                onChangeText={(text: string) => setFormData({ 
                  ...formData, 
                  socialMedia: { ...formData.socialMedia, facebook: text }
                })}
                placeholder="yourpagename"
                icon={Facebook}
              />
            </CardContent>
          </Card>
        )}

        {/* Notifications */}
        <Card style={[tw`mb-6`, { backgroundColor: 'rgba(255,255,255,0.05)', borderColor: 'rgba(255,255,255,0.1)' }]}>
          <CardContent style={tw`p-4`}>
            <View style={tw`flex-row items-center mb-4`}>
              <AlertCircle size={20} color={theme.colors.secondary} style={tw`mr-2`} />
              <Text style={[tw`text-lg font-semibold`, { color: theme.colors.foreground }]}>
                Push Notifications
              </Text>
            </View>



            <TouchableOpacity
              onPress={handlePushNotificationToggle}
              style={[
                tw`px-4 py-2 rounded-xl flex-row items-center justify-center`,
                { backgroundColor: formData.sms_notifications ? theme.colors.secondary : theme.colors.input }
              ]}
            >
              {formData.sms_notifications ? (
                <>
                  <Check size={16} color={theme.colors.primaryForeground} style={tw`mr-2`} />
                  <Text style={[tw`font-medium`, { color: theme.colors.primaryForeground }]}>Push Notifications Enabled</Text>
                </>
              ) : (
                <Text style={[tw`font-medium`, { color: theme.colors.foreground }]}>Enable Push Notifications</Text>
              )}
            </TouchableOpacity>
          </CardContent>
        </Card>

        {/* Visibility Settings */}
        <Card style={[tw`mb-6`, { backgroundColor: 'rgba(255,255,255,0.05)', borderColor: 'rgba(255,255,255,0.1)' }]}>
          <CardContent style={tw`p-4`}>
            <View style={tw`flex-row items-center justify-between`}>
              <View style={tw`flex-1 mr-4`}>
                <Text style={[tw`font-medium mb-1`, { color: theme.colors.foreground }]}>
                  Public Profile
                </Text>
                <Text style={[tw`text-sm`, { color: theme.colors.mutedForeground }]}>
                  When enabled, your profile appears in search results
                </Text>
              </View>
              <Switch
                value={formData.isPublic}
                onValueChange={(value) => setFormData({ ...formData, isPublic: value })}
                trackColor={{ false: theme.colors.input, true: theme.colors.secondary }}
                thumbColor={theme.colors.foreground}
              />
            </View>
          </CardContent>
        </Card>

        {!formData.isPublic && (
          <View style={[tw`mb-6 p-4 rounded-xl flex-row items-start`, { backgroundColor: theme.colors.destructive + '10', borderWidth: 1, borderColor: theme.colors.destructive + '20' }]}>
            <AlertCircle size={16} color={theme.colors.destructive} style={tw`mr-2 mt-0.5`} />
            <View style={tw`flex-1`}>
              <Text style={[tw`text-sm`, { color: theme.colors.destructive }]}>
                Your profile is currently private and won't appear in search results. Enable public profile to start receiving bookings from new clients.
              </Text>
            </View>
          </View>
        )}

        {/* Save Button */}
        <TouchableOpacity
          style={[tw`py-4 rounded-xl flex-row items-center justify-center`, { backgroundColor: theme.colors.secondary }]}
          onPress={handleSave}
          disabled={isLoading}
        >
          {isLoading ? (
            <LoadingSpinner color={theme.colors.primaryForeground} />
          ) : (
            <>
              <Save size={20} color={theme.colors.primaryForeground} style={tw`mr-2`} />
              <Text style={[tw`font-semibold text-base`, { color: theme.colors.primaryForeground }]}>
                Save Changes
              </Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
} 