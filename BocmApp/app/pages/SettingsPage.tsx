import React, { useState, useEffect } from 'react';
import {
  View,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Text,
  StatusBar,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import tw from 'twrnc';
import { RootStackParamList } from '../shared/types';
import { supabase } from '../shared/lib/supabase';
import { useAuth } from '../shared/hooks/useAuth';
import { logger } from '../shared/lib/logger';
import { theme } from '../shared/lib/theme';
import { ProfileSettings } from '../shared/components/settings/ProfileSettings';
import { ServicesSettings } from '../shared/components/settings/ServicesSettings';
import { AddonsSettings } from '../shared/components/settings/AddonsSettings';
import { ShareSettings } from '../shared/components/settings/ShareSettings';
import { AvailabilityManager } from '../shared/components/settings/AvailabilityManager';
import { EarningsDashboard } from '../shared/components/settings/EarningsDashboard';
import { Button, Card, CardContent } from '../shared/components/ui';
import { 
  User, 
  Scissors, 
  Package, 
  Share2, 
  Calendar, 
  DollarSign, 
  Settings as SettingsIcon,
  Sparkles,
  AlertCircle,
  LogOut,
  CheckCircle,
  RefreshCw
} from 'lucide-react-native';
import type { Tab, SettingsData } from '../shared/types/settings.types';

type SettingsNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Settings'>;

export default function SettingsPage() {
  const navigation = useNavigation<SettingsNavigationProp>();
  const { user, userProfile, logout } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>('profile');
  const [isLoading, setIsLoading] = useState(true);
  const [settingsData, setSettingsData] = useState<SettingsData>({
    profileComplete: false,
    servicesComplete: false,
    availabilityComplete: false,
    stripeConnected: false,
    notificationsConfigured: false
  });
  const [barberId, setBarberId] = useState<string>('');
  const [showVerifyBanner, setShowVerifyBanner] = useState(true);

  const isBarber = userProfile?.role === 'barber';

  useEffect(() => {
    if (user) {
      loadSettingsData();
    }
  }, [user]);

  const loadSettingsData = async () => {
    if (!user) return;

    try {
      setIsLoading(true);
      
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (profileError && profileError.code !== 'PGRST116') {
        logger.error('Error fetching profile:', profileError);
      }

      if (isBarber) {
        const { data: barber, error: barberError } = await supabase
          .from('barbers')
          .select('*')
          .eq('user_id', user.id)
          .single();

        if (barberError && barberError.code !== 'PGRST116') {
          logger.error('Error fetching barber data:', barberError);
        }

        if (barber) {
          setBarberId(barber.id);
          
          const { data: services } = await supabase
            .from('services')
            .select('id')
            .eq('barber_id', barber.id);

          const { data: availability } = await supabase
            .from('availability')
            .select('id')
            .eq('barber_id', barber.id);

          const profileComplete = !!(profile?.name && profile?.email);
          const servicesComplete = !!(services && services.length > 0);
          const availabilityComplete = !!(availability && availability.length > 0);
          const stripeConnected = barber?.stripe_account_status === 'active';
          const notificationsConfigured = true;

          setSettingsData({
            profileComplete,
            servicesComplete,
            availabilityComplete,
            stripeConnected,
            notificationsConfigured
          });
        }
      } else {
        const profileComplete = !!(profile?.name && profile?.email);
        setSettingsData({
          profileComplete,
          servicesComplete: false,
          availabilityComplete: false,
          stripeConnected: false,
          notificationsConfigured: true
        });
      }
    } catch (error) {
      logger.error('Error loading settings data:', error);
      Alert.alert('Error', 'Failed to load settings data');
    } finally {
      setIsLoading(false);
    }
  };

  const getCompletionPercentage = () => {
    const totalSections = isBarber ? 5 : 2;
    const completedSections = Object.values(settingsData).filter(Boolean).length;
    return Math.round((completedSections / totalSections) * 100);
  };

  const getTabStatus = (tab: Tab) => {
    switch (tab) {
      case 'profile':
        return settingsData.profileComplete ? 'complete' : 'incomplete';
      case 'services':
        return settingsData.servicesComplete ? 'complete' : 'incomplete';
      case 'availability':
        return settingsData.availabilityComplete ? 'complete' : 'incomplete';
      case 'earnings':
        return settingsData.stripeConnected ? 'complete' : 'incomplete';
      default:
        return 'neutral';
    }
  };

  const handleLogout = async () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: async () => {
            await logout();
            navigation.navigate('Login');
          },
        },
      ]
    );
  };

  const tabs = [
    { id: 'profile' as Tab, label: 'Profile', icon: User },
    { id: 'services' as Tab, label: 'Services', icon: Scissors },
    { id: 'earnings' as Tab, label: 'Earnings', icon: DollarSign },
    { id: 'addons' as Tab, label: 'Add-ons', icon: Package },
    { id: 'availability' as Tab, label: 'Schedule', icon: Calendar },
  ];

  const visibleTabs = isBarber ? tabs : tabs.filter(tab => tab.id === 'profile');

  if (isLoading) {
    return (
      <SafeAreaView style={[tw`flex-1 justify-center items-center`, { backgroundColor: theme.colors.background }]}>
        <SettingsIcon size={40} color={theme.colors.secondary} style={tw`mb-4`} />
        <ActivityIndicator size="large" color={theme.colors.secondary} />
        <Text style={[tw`mt-4 text-base`, { color: theme.colors.mutedForeground }]}>Loading your settings...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[tw`flex-1`, { backgroundColor: theme.colors.background }]}>
      <StatusBar barStyle="light-content" />
      
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={tw`pb-32`}>
        {/* Header */}
        <View style={tw`px-6 pt-6 pb-4`}>
          <View style={tw`items-center mb-6`}>
            <View style={[tw`p-4 rounded-full mb-3`, { backgroundColor: theme.colors.secondary + '20' }]}>
              <SettingsIcon size={32} color={theme.colors.secondary} />
            </View>
            <Text style={[tw`text-2xl font-bold`, { color: theme.colors.foreground }]}>Settings</Text>
            <Text style={[tw`text-sm mt-1`, { color: theme.colors.mutedForeground }]}>
              Manage your profile, services, and preferences
            </Text>
          </View>
        </View>

        {/* Share Settings Banner for Barbers */}
        {isBarber && (
          <View style={tw`px-6 mb-6`}>
            <ShareSettings barberId={barberId} />
          </View>
        )}

        {/* Progress Section */}
        {getCompletionPercentage() < 100 && (
          <View style={tw`mx-6 mb-6`}>
            <Card style={[{ backgroundColor: 'rgba(255,255,255,0.05)', borderColor: 'rgba(255,255,255,0.1)' }]}>
              <CardContent style={tw`p-4`}>
                <View style={tw`flex-row items-center justify-between mb-3`}>
                  <View style={tw`flex-row items-center`}>
                    <Sparkles size={16} color={theme.colors.secondary} style={tw`mr-2`} />
                    <Text style={[tw`text-sm font-medium`, { color: theme.colors.foreground }]}>
                      Profile Completion
                    </Text>
                  </View>
                  <View style={[tw`px-2 py-1 rounded-full`, { backgroundColor: theme.colors.secondary + '20' }]}>
                    <Text style={[tw`text-xs font-bold`, { color: theme.colors.secondary }]}>
                      {getCompletionPercentage()}%
                    </Text>
                  </View>
                </View>
                
                <View style={[tw`h-3 rounded-full overflow-hidden`, { backgroundColor: 'rgba(255,255,255,0.1)' }]}>
                  <View 
                    style={[
                      tw`h-full rounded-full`,
                      { width: `${getCompletionPercentage()}%`, backgroundColor: theme.colors.secondary }
                    ]} 
                  />
                </View>
                
                <Text style={[tw`text-xs text-center mt-3`, { color: theme.colors.mutedForeground }]}>
                  Complete all sections to optimize your profile
                </Text>
                
                {isBarber && (
                  <TouchableOpacity
                    style={[tw`mt-4 py-2 rounded-xl`, { backgroundColor: theme.colors.secondary }]}
                    onPress={() => navigation.navigate('BarberOnboarding')}
                  >
                    <Text style={[tw`text-center font-medium`, { color: theme.colors.primaryForeground }]}>
                      Complete Onboarding
                    </Text>
                  </TouchableOpacity>
                )}
              </CardContent>
            </Card>
          </View>
        )}

        {/* Tabs */}
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          style={[tw`mb-6`, { backgroundColor: 'rgba(255,255,255,0.05)' }]}
          contentContainerStyle={tw`px-6`}
        >
          {visibleTabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            const status = getTabStatus(tab.id);
            
            return (
              <TouchableOpacity
                key={tab.id}
                style={[
                  tw`py-4 px-4 mr-3`,
                  isActive && { borderBottomWidth: 2, borderBottomColor: theme.colors.secondary }
                ]}
                onPress={() => setActiveTab(tab.id)}
              >
                <View style={tw`flex-row items-center`}>
                  <Icon 
                    size={18} 
                    color={isActive ? theme.colors.secondary : theme.colors.mutedForeground}
                  />
                  <Text style={[
                    tw`ml-2 text-sm font-medium`,
                    { color: isActive ? theme.colors.secondary : theme.colors.mutedForeground }
                  ]}>
                    {tab.label}
                  </Text>
                  {status === 'complete' && (
                    <CheckCircle size={14} color={theme.colors.secondary} style={tw`ml-2`} />
                  )}
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Tab Content */}
        <View style={tw`px-6`}>
          {activeTab === 'profile' && (
            <ProfileSettings onUpdate={loadSettingsData} />
          )}
          
          {activeTab === 'services' && isBarber && (
            <ServicesSettings onUpdate={loadSettingsData} />
          )}
          
          {activeTab === 'addons' && isBarber && (
            <AddonsSettings onUpdate={loadSettingsData} />
          )}
          
          {activeTab === 'availability' && isBarber && (
            <AvailabilityManager barberId={barberId} onUpdate={loadSettingsData} />
          )}
          
          {activeTab === 'earnings' && isBarber && (
            <EarningsDashboard barberId={barberId} />
          )}
        </View>

        {/* Logout Button */}
        <View style={tw`px-6 mt-8`}>
          <TouchableOpacity
            style={[tw`py-3 rounded-xl`, { backgroundColor: theme.colors.destructive }]}
            onPress={handleLogout}
          >
            <View style={tw`flex-row items-center justify-center`}>
              <LogOut size={20} color={theme.colors.destructiveForeground} style={tw`mr-2`} />
              <Text style={[tw`font-semibold`, { color: theme.colors.destructiveForeground }]}>Log Out</Text>
            </View>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}