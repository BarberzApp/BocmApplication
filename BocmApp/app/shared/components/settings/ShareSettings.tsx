import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Share,
  Alert,
  Clipboard,
  Platform,
} from 'react-native';
import tw from 'twrnc';
import { theme } from '../../lib/theme';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import { logger } from '../../lib/logger';
import { Card, CardContent } from '../ui';
import { 
  Share2, 
  Copy, 
  Link, 
  QrCode,
  ExternalLink,
  CheckCircle,
  AlertCircle,
  Sparkles,
  Globe,
  Download
} from 'lucide-react-native';
import QRCode from 'react-native-qrcode-svg';

interface ShareSettingsProps {
  barberId: string;
}

interface ProfileData {
  name?: string;
  business_name?: string;
  is_public?: boolean;
  username?: string;
}

export function ShareSettings({ barberId }: ShareSettingsProps) {
  const { user } = useAuth();
  const [copied, setCopied] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [profileData, setProfileData] = useState<ProfileData>({});
  const [showQR, setShowQR] = useState(false);

  useEffect(() => {
    if (user) {
      loadProfileData();
    }
  }, [user]);

  const loadProfileData = async () => {
    try {
      setIsLoading(true);
      
      const { data: profile } = await supabase
        .from('profiles')
        .select('name, is_public, username')
        .eq('id', user?.id)
        .single();

      let barberData = {};
      if (user?.role === 'barber' && barberId) {
        const { data: barber } = await supabase
          .from('barbers')
          .select('business_name')
          .eq('id', barberId)
          .single();

        if (barber) {
          barberData = { business_name: barber.business_name };
        }
      }

      setProfileData({ ...profile, ...barberData });
    } catch (error) {
      logger.error('Error loading profile data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getBookingLink = () => {
    const baseUrl = 'https://bocmstyle.com';
    
    if (profileData.username) {
      return `${baseUrl}/book/${profileData.username}`;
    }
    
    if (barberId) {
      return `${baseUrl}/book/${barberId}`;
    }
    
    return `${baseUrl}/book/placeholder`;
  };

  const bookingLink = getBookingLink();
  const isLinkValid = barberId || user?.id;

  const copyToClipboard = async () => {
    if (!isLinkValid) {
      Alert.alert('Cannot copy link', 'Please complete your barber profile first.');
      return;
    }

    try {
      Clipboard.setString(bookingLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      Alert.alert('Success', 'Link copied to clipboard!');
    } catch (err) {
      Alert.alert('Failed to copy', 'Please try copying the link manually.');
    }
  };

  const shareLink = async () => {
    if (!isLinkValid) {
      Alert.alert('Cannot share link', 'Please complete your barber profile first.');
      return;
    }

    try {
      await Share.share({
        message: `Book an appointment with ${profileData.business_name || profileData.name || 'me'}: ${bookingLink}`,
        url: bookingLink,
      });
    } catch (err) {
      if (err instanceof Error && err.name !== 'AbortError') {
        Alert.alert('Failed to share', 'Please try sharing the link manually.');
      }
    }
  };

  const openBookingLink = () => {
    if (!isLinkValid) {
      Alert.alert('Cannot open link', 'Please complete your barber profile first.');
      return;
    }
  };



  if (isLoading) {
    return (
      <Card style={[{ backgroundColor: 'rgba(255,255,255,0.05)', borderColor: 'rgba(255,255,255,0.1)' }]}>
        <CardContent style={tw`p-6`}>
          <View style={tw`items-center`}>
            <Share2 size={24} color={theme.colors.secondary} style={tw`mb-2`} />
            <Text style={[tw`text-sm`, { color: theme.colors.mutedForeground }]}>
              Loading booking link...
            </Text>
          </View>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card style={[{ backgroundColor: 'rgba(255,255,255,0.05)', borderColor: 'rgba(255,255,255,0.1)' }]}>
      <CardContent style={tw`p-4`}>
        <View style={tw`flex-row items-center mb-4`}>
          <View style={[tw`p-2 rounded-xl mr-3`, { backgroundColor: theme.colors.secondary + '20' }]}>
            <Share2 size={20} color={theme.colors.secondary} />
          </View>
          <View style={tw`flex-1`}>
            <Text style={[tw`text-base font-semibold`, { color: theme.colors.foreground }]}>
              Share Your Booking Link
            </Text>
            <Text style={[tw`text-sm`, { color: theme.colors.mutedForeground }]}>
              Share with clients to receive bookings
            </Text>
          </View>
        </View>

        {/* Profile Status Alert */}
        {!profileData.is_public && (
          <View style={[tw`mb-4 p-3 rounded-xl flex-row items-start`, { backgroundColor: theme.colors.saffronBrown + '10', borderWidth: 1, borderColor: theme.colors.saffronBrown + '20' }]}>
            <AlertCircle size={16} color={theme.colors.saffronBrown} style={tw`mr-2 mt-0.5`} />
            <View style={tw`flex-1`}>
              <Text style={[tw`text-sm`, { color: theme.colors.saffronBrown }]}>
                Your profile is currently private. Make it public to allow clients to book appointments.
              </Text>
            </View>
          </View>
        )}

        {/* Booking Link Display */}
        <View style={tw`mb-4`}>
          <Text style={[tw`text-sm font-medium mb-2`, { color: theme.colors.foreground }]}>
            Your Booking Link
          </Text>
          <View style={[tw`p-3 rounded-xl flex-row items-center`, { backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' }]}>
            <Link size={16} color={theme.colors.secondary} style={tw`mr-2`} />
            <Text style={[tw`flex-1 text-sm`, { color: theme.colors.secondary }]} numberOfLines={1}>
              {bookingLink}
            </Text>
          </View>
        </View>

        {/* Action Buttons */}
        <View style={tw`flex-row gap-3 mb-4`}>
          <TouchableOpacity
            onPress={shareLink}
            disabled={!isLinkValid}
            style={[tw`flex-1 py-3 rounded-xl flex-row items-center justify-center`, { backgroundColor: theme.colors.secondary }]}
          >
            <Share2 size={18} color={theme.colors.primaryForeground} style={tw`mr-2`} />
            <Text style={[tw`font-semibold`, { color: theme.colors.primaryForeground }]}>
              Share Link
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            onPress={copyToClipboard}
            disabled={!isLinkValid}
            style={[tw`px-4 py-3 rounded-xl`, { borderWidth: 1, borderColor: theme.colors.secondary + '30' }]}
          >
            {copied ? (
              <CheckCircle size={20} color={theme.colors.secondary} />
            ) : (
              <Copy size={20} color={theme.colors.secondary} />
            )}
          </TouchableOpacity>
        </View>

        {/* QR Code Button */}
        <TouchableOpacity
          onPress={() => setShowQR(!showQR)}
          disabled={!isLinkValid}
          style={[tw`py-3 rounded-xl flex-row items-center justify-center mb-4`, { backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' }]}
        >
          <QrCode size={18} color={theme.colors.foreground} style={tw`mr-2`} />
          <Text style={[tw`font-medium`, { color: theme.colors.foreground }]}>
            {showQR ? 'Hide' : 'Show'} QR Code
          </Text>
        </TouchableOpacity>

        {/* QR Code Display */}
        {showQR && isLinkValid && (
          <View style={[tw`p-4 rounded-xl mb-4`, { backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' }]}>
            <View style={tw`items-center`}>
              <Text style={[tw`text-sm mb-3`, { color: theme.colors.foreground }]}>
                Clients can scan this QR code to book appointments
              </Text>
              <View style={[tw`p-4 rounded-xl`, { backgroundColor: theme.colors.foreground }]}>
                <QRCode
                  value={bookingLink}
                  size={200}
                  color={theme.colors.primary}
                  backgroundColor={theme.colors.foreground}
                />
              </View>
              <View style={tw`mt-3 items-center`}>
                <Text style={[tw`text-xs text-center mb-1`, { color: theme.colors.mutedForeground }]}>
                  Scan this QR code to access the booking page
                </Text>
                <Text style={[tw`text-xs text-center`, { color: theme.colors.secondary }]}>
                  {profileData.business_name || profileData.name || 'Your'} Booking Link
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* Tips Section */}
        <View style={[tw`p-4 rounded-xl`, { backgroundColor: theme.colors.secondary + '10' }]}>
          <View style={tw`flex-row items-start`}>
            <Sparkles size={16} color={theme.colors.secondary} style={tw`mr-2 mt-0.5`} />
            <View style={tw`flex-1`}>
              <Text style={[tw`text-sm font-semibold mb-2`, { color: theme.colors.foreground }]}>
                Pro Tips
              </Text>
              <View style={tw`gap-1`}>
                {[
                  'Add this link to your social media profiles',
                  'Include it in your business cards',
                  'Share it via text or email with clients',
                  'Use the QR code for in-person sharing'
                ].map((tip, index) => (
                  <View key={index} style={tw`flex-row items-start`}>
                    <Text style={[tw`text-xs mr-1`, { color: theme.colors.secondary }]}>•</Text>
                    <Text style={[tw`text-xs flex-1`, { color: theme.colors.foreground, opacity: 0.8 }]}>
                      {tip}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          </View>
        </View>
      </CardContent>
    </Card>
  );
} 