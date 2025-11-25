import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
  Linking,
} from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import tw from 'twrnc';
import { theme } from '../../lib/theme';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import { logger } from '../../lib/logger';
import { Card, CardContent, LoadingSpinner } from '../ui';
import { 
  DollarSign,
  TrendingUp,
  Calendar,
  CreditCard,
  AlertCircle,
  CheckCircle,
  ArrowUpRight,
  ArrowDownRight,
  ExternalLink,
  Loader2,
  RefreshCw
} from 'lucide-react-native';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || "https://www.bocmstyle.com";

interface EarningsData {
  totalEarnings: number;
  monthlyEarnings: number;
  weeklyEarnings: number;
  pendingPayouts: number;
  completedBookings: number;
  averageServicePrice: number;
  stripeConnected: boolean;
  stripeAccountId?: string;
}

interface EarningsDashboardProps {
  barberId: string;
}

export function EarningsDashboard({ barberId }: EarningsDashboardProps) {
  const { user } = useAuth();
  const [earnings, setEarnings] = useState<EarningsData>({
    totalEarnings: 0,
    monthlyEarnings: 0,
    weeklyEarnings: 0,
    pendingPayouts: 0,
    completedBookings: 0,
    averageServicePrice: 0,
    stripeConnected: false
  });
  const [isLoading, setIsLoading] = useState(true);
  const [period, setPeriod] = useState<'week' | 'month' | 'year'>('month');

  useEffect(() => {
    if (barberId) {
      loadEarningsData();
    }
  }, [barberId, period]);

  const loadEarningsData = async () => {
    try {
      setIsLoading(true);

      // Get barber's Stripe status
      const { data: barber } = await supabase
        .from('barbers')
        .select('stripe_account_id, stripe_account_status')
        .eq('id', barberId)
        .single();

      // Get bookings data
      const now = new Date();
      const startOfWeek = new Date(now.setDate(now.getDate() - now.getDay()));
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const startOfYear = new Date(now.getFullYear(), 0, 1);

      const { data: bookings, error } = await supabase
        .from('bookings')
        .select('id, created_at, barber_payout')
        .eq('barber_id', barberId)
        .eq('status', 'completed');

      if (error) throw error;

      // Calculate earnings
      let totalEarnings = 0;
      let monthlyEarnings = 0;
      let weeklyEarnings = 0;
      let yearlyEarnings = 0;

      bookings?.forEach(booking => {
        // Net amount barber earns (already stored in dollars)
        const amount = Number(booking.barber_payout || 0);
        const bookingDate = new Date(booking.created_at);
        
        totalEarnings += amount;
        
        if (bookingDate >= startOfWeek) {
          weeklyEarnings += amount;
        }
        if (bookingDate >= startOfMonth) {
          monthlyEarnings += amount;
        }
        if (bookingDate >= startOfYear) {
          yearlyEarnings += amount;
        }
      });

      const averageServicePrice = bookings?.length ? totalEarnings / bookings.length : 0;

      setEarnings({
        totalEarnings,
        monthlyEarnings: period === 'month' ? monthlyEarnings : period === 'week' ? weeklyEarnings : yearlyEarnings,
        weeklyEarnings,
        pendingPayouts: 0, // Could be derived from Stripe balance transactions
        completedBookings: bookings?.length || 0,
        averageServicePrice,
        stripeConnected: barber?.stripe_account_status === 'active',
        stripeAccountId: barber?.stripe_account_id
      });
    } catch (error) {
      logger.error('Error loading earnings:', error);
      Alert.alert('Error', 'Failed to load earnings data');
    } finally {
      setIsLoading(false);
    }
  };

  const handleStripeConnect = async () => {
    try {
      logger.log('Starting Stripe Connect process for barber:', barberId);
      
      const response = await fetch(`${API_BASE_URL}/api/connect/create-account`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          barberId: barberId,
          email: user?.email
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      logger.log('Stripe Connect response:', data);

      if (data.url) {
        // Open Stripe onboarding in browser
        const result = await WebBrowser.openBrowserAsync(data.url);
        
        // After browser closes, check status
        await checkStripeStatus();
      } else {
        throw new Error('No redirect URL received from Stripe');
      }
    } catch (error) {
      logger.error('Error connecting Stripe:', error);
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to connect Stripe account. Please try again.');
    }
  };

  const handleViewStripeDetails = async () => {
    try {
      logger.log('Opening Stripe Dashboard for barber:', barberId);
      
      // Create Stripe dashboard link
      const { data, error } = await supabase.functions.invoke('stripe-dashboard', {
        body: { barberId }
      });

      if (error) {
        logger.error('Supabase function error:', error);
        throw new Error(error.message || 'Failed to create dashboard link');
      }

      if (!data.url) {
        throw new Error('No dashboard URL received');
      }

      logger.log('Opening Stripe URL:', data.url);
      logger.log('URL type:', data.type);
      
      // Show appropriate message based on type
      if (data.type === 'onboarding') {
        Alert.alert(
          'Complete Stripe Setup',
          data.message || 'Please complete your Stripe account setup to access the dashboard.',
          [
            {
              text: 'Cancel',
              style: 'cancel'
            },
            {
              text: 'Continue Setup',
              onPress: async () => {
                try {
                  const result = await WebBrowser.openBrowserAsync(data.url, {
                    presentationStyle: WebBrowser.WebBrowserPresentationStyle.FULL_SCREEN,
                    controlsColor: theme.colors.primary,
                    toolbarColor: theme.colors.background,
                  });
                  
                  logger.log('WebBrowser result:', result);
                  
                  // After browser closes, refresh the earnings data
                  await loadEarningsData();
                } catch (browserError) {
                  logger.error('Error opening browser:', browserError);
                }
              }
            }
          ]
        );
      } else {
        // Open Stripe dashboard in browser
        const result = await WebBrowser.openBrowserAsync(data.url, {
          presentationStyle: WebBrowser.WebBrowserPresentationStyle.FULL_SCREEN,
          controlsColor: theme.colors.primary,
          toolbarColor: theme.colors.background,
        });
        
        logger.log('WebBrowser result:', result);
      }
      
    } catch (error) {
      logger.error('Error opening Stripe dashboard:', error);
      Alert.alert(
        'Error', 
        error instanceof Error ? error.message : 'Failed to open Stripe dashboard. Please try again.'
      );
    }
  };

  const debugStripeAccount = async () => {
    try {
      logger.log('=== DEBUGGING STRIPE ACCOUNT ===');
      logger.log('Barber ID:', barberId);
      
      // Get current barber data
      const { data: barber, error } = await supabase
        .from('barbers')
        .select('*')
        .eq('id', barberId)
        .single();

      if (error) {
        logger.error('Error fetching barber:', error);
        Alert.alert('Error', 'Could not fetch barber data.');
        return;
      }

      logger.log('Full barber data:', barber);
      
      // Check if user has a profile
      if (barber.user_id) {
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('email')
          .eq('id', barber.user_id)
          .single();
        
        if (profileError) {
          logger.error('Error fetching profile:', profileError);
        } else {
          logger.log('User email:', profile?.email);
        }
      }

      // Try to create a new Stripe account
      logger.log('Attempting to create Stripe account...');
      
      const response = await fetch(`${API_BASE_URL}/api/connect/create-account`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          barberId: barberId,
          email: user?.email || 'test@example.com'
        }),
      });

      logger.log('API Response status:', response.status);
      
      if (response.ok) {
        const data = await response.json();
        logger.log('API Response data:', data);
        
        if (data.accountId) {
          Alert.alert(
            'Debug Info',
            `Stripe account created successfully!\n\nAccount ID: ${data.accountId}\nURL: ${data.url}\n\nCheck the database now.`,
            [{ text: 'OK' }]
          );
          
          // Test the update status API
          logger.log('Testing update status API...');
          const updateResponse = await fetch(`${API_BASE_URL}/api/connect/update-stripe-status`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ 
              barberId: barberId,
              accountId: data.accountId
            }),
          });
          
          if (updateResponse.ok) {
            const updateData = await updateResponse.json();
            logger.log('Update status response:', updateData);
            Alert.alert(
              'Success!',
              `Stripe account ID has been saved to database!\n\nAccount ID: ${data.accountId}`,
              [{ text: 'OK', onPress: () => loadEarningsData() }]
            );
          } else {
            const updateError = await updateResponse.text();
            logger.error('Update status error:', updateError);
            Alert.alert(
              'Partial Success',
              `Stripe account created but database update failed.\n\nAccount ID: ${data.accountId}\nError: ${updateError}`,
              [{ text: 'OK' }]
            );
          }
        } else {
          Alert.alert(
            'Debug Info',
            `API call successful but no account ID returned.\n\nResponse: ${JSON.stringify(data)}`,
            [{ text: 'OK' }]
          );
        }
      } else {
        const errorText = await response.text();
        logger.error('API Error:', errorText);
        Alert.alert(
          'Debug Info',
          `API call failed.\n\nStatus: ${response.status}\nError: ${errorText}`,
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      logger.error('Debug error:', error);
      Alert.alert('Error', `Debug failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const checkStripeStatus = async () => {
    try {
      logger.log('Checking Stripe status for barber:', barberId);
      
      // Get barber's Stripe account status directly from database
      const { data: barber, error } = await supabase
        .from('barbers')
        .select('stripe_account_id, stripe_account_status, stripe_account_ready, user_id')
        .eq('id', barberId)
        .single();

      if (error) {
        logger.error('Error fetching barber:', error);
        Alert.alert('Error', 'Could not check Stripe status. Please try again.');
        return;
      }

      logger.log('Barber data:', barber);

      if (!barber) {
        Alert.alert('Error', 'Barber not found.');
        return;
      }

      if (!barber.stripe_account_id) {
        Alert.alert(
          'Not Connected',
          'You have not connected your Stripe account yet. Please use the "Connect Stripe" button to set up your account.',
          [{ text: 'OK' }]
        );
        return;
      }

      // Check if Stripe account is ready
      if (barber.stripe_account_ready) {
        Alert.alert(
          'Success!',
          `Your Stripe account is connected and ready to receive payments.\n\nAccount ID: ${barber.stripe_account_id}`,
          [{ text: 'OK', onPress: () => loadEarningsData() }]
        );
      } else if (barber.stripe_account_status === 'active') {
        Alert.alert(
          'Success!',
          `Your Stripe account is connected and active.\n\nAccount ID: ${barber.stripe_account_id}`,
          [{ text: 'OK', onPress: () => loadEarningsData() }]
        );
      } else {
        Alert.alert(
          'Setup In Progress',
          `Your Stripe account is connected but setup is still in progress.\n\nAccount ID: ${barber.stripe_account_id}\nStatus: ${barber.stripe_account_status || 'pending'}\n\nPlease complete the required information in your Stripe dashboard.`,
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      logger.error('Error checking Stripe status:', error);
      Alert.alert('Error', `Failed to check Stripe status: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const getPercentageChange = () => {
    // Calculate percentage change (random number, change later)
    return 12.5;
  };

  if (isLoading) {
    return (
      <Card style={[{ backgroundColor: 'rgba(255,255,255,0.05)', borderColor: 'rgba(255,255,255,0.1)' }]}>
        <CardContent style={tw`p-6 items-center`}>
          <Loader2 size={32} color={theme.colors.secondary} style={tw`mb-3`} />
          <Text style={[tw`text-base`, { color: theme.colors.mutedForeground }]}>
            Loading earnings data...
          </Text>
        </CardContent>
      </Card>
    );
  }

  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={tw`pb-24`}>
      {/* Stripe Connect Status */}
      {!earnings.stripeConnected && (
        <Card style={[tw`mb-6`, { backgroundColor: theme.colors.warning + '10', borderColor: theme.colors.warning + '20' }]}>
          <CardContent style={tw`p-4`}>
            <View style={tw`flex-row items-start`}>
              <AlertCircle size={20} color={theme.colors.warning} style={tw`mr-3 mt-0.5`} />
              <View style={tw`flex-1`}>
                <Text style={[tw`font-semibold mb-1`, { color: theme.colors.warning }]}>
                  Connect Stripe to receive payments
                </Text>
                <Text style={[tw`text-sm mb-3`, { color: theme.colors.warning }]}>
                  You need to connect your Stripe account to receive payouts from bookings.
                </Text>
                <TouchableOpacity
                  onPress={handleStripeConnect}
                  style={[tw`py-2 px-4 rounded-xl flex-row items-center self-start`, { backgroundColor: theme.colors.warning }]}
                >
                  <CreditCard size={16} color={theme.colors.primary} style={tw`mr-2`} />
                  <Text style={[tw`font-semibold`, { color: theme.colors.primary }]}>Connect Stripe</Text>
                  <ExternalLink size={14} color={theme.colors.primary} style={tw`ml-2`} />
                </TouchableOpacity>
                
                <TouchableOpacity
                  onPress={checkStripeStatus}
                  style={[tw`py-2 px-4 rounded-xl flex-row items-center self-start mt-2`, { backgroundColor: 'rgba(255,255,255,0.1)' }]}
                >
                  <RefreshCw size={16} color={theme.colors.foreground} style={tw`mr-2`} />
                  <Text>Check Status</Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  onPress={debugStripeAccount}
                  style={[tw`py-2 px-4 rounded-xl flex-row items-center self-start mt-2`, { backgroundColor: 'rgba(255,0,0,0.1)' }]}
                >
                  <RefreshCw size={16} color="red" style={tw`mr-2`} />
                  <Text style={{ color: 'red' }}>Debug Stripe</Text>
                </TouchableOpacity>
              </View>
            </View>
          </CardContent>
        </Card>
      )}

      {/* Period Selector */}
      <View style={tw`flex-row gap-2 mb-6`}>
        {(['week', 'month', 'year'] as const).map((p) => (
          <TouchableOpacity
            key={p}
            onPress={() => setPeriod(p)}
            style={[
              tw`flex-1 py-2 rounded-xl`,
              period === p
                ? { backgroundColor: theme.colors.secondary }
                : { backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' }
            ]}
          >
            <Text style={[
              tw`text-center font-medium capitalize`,
              { color: period === p ? theme.colors.primaryForeground : theme.colors.foreground }
            ]}>
              {p}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Main Earnings Card */}
      <Card style={[tw`mb-6`, { backgroundColor: 'rgba(255,255,255,0.05)', borderColor: 'rgba(255,255,255,0.1)' }]}>
        <CardContent style={tw`p-6`}>
          <View style={tw`flex-row items-center justify-between mb-2`}>
            <Text style={[tw`text-sm`, { color: theme.colors.mutedForeground }]}>
              {period === 'week' ? 'Weekly' : period === 'month' ? 'Monthly' : 'Yearly'} Earnings
            </Text>
            <View style={[
              tw`flex-row items-center px-2 py-1 rounded-full`,
              { backgroundColor: getPercentageChange() >= 0 ? theme.colors.secondary + '20' : theme.colors.destructive + '20' }
            ]}>
              {getPercentageChange() >= 0 ? (
                <ArrowUpRight size={14} color={theme.colors.secondary} />
              ) : (
                <ArrowDownRight size={14} color={theme.colors.destructive} />
              )}
              <Text style={[
                tw`text-xs font-bold ml-1`,
                { color: getPercentageChange() >= 0 ? theme.colors.secondary : theme.colors.destructive }
              ]}>
                {Math.abs(getPercentageChange())}%
              </Text>
            </View>
          </View>
          
          <Text style={[tw`text-3xl font-bold mb-4`, { color: theme.colors.foreground }]}>
            ${earnings.monthlyEarnings.toFixed(2)}
          </Text>

          <View style={tw`flex-row justify-between`}>
            <View>
              <Text style={[tw`text-xs`, { color: theme.colors.mutedForeground }]}>
                Completed Bookings
              </Text>
              <Text style={[tw`text-base font-semibold`, { color: theme.colors.foreground }]}>
                {earnings.completedBookings}
              </Text>
            </View>
            <View>
              <Text style={[tw`text-xs`, { color: theme.colors.mutedForeground }]}>
                Avg. Service Price
              </Text>
              <Text style={[tw`text-base font-semibold`, { color: theme.colors.foreground }]}>
                ${earnings.averageServicePrice.toFixed(2)}
              </Text>
            </View>
          </View>
        </CardContent>
      </Card>

      {/* Stats Grid */}
      <View style={tw`gap-3`}>
        <View style={tw`flex-row gap-3`}>
          <Card style={[tw`flex-1`, { backgroundColor: 'rgba(255,255,255,0.05)', borderColor: 'rgba(255,255,255,0.1)' }]}>
            <CardContent style={tw`p-4`}>
              <View style={tw`flex-row items-center justify-between mb-2`}>
                <View style={[tw`p-2 rounded-xl`, { backgroundColor: theme.colors.secondary + '20' }]}>
                  <DollarSign size={20} color={theme.colors.secondary} />
                </View>
                <TrendingUp size={16} color={theme.colors.secondary} />
              </View>
              <Text style={[tw`text-xs`, { color: theme.colors.mutedForeground }]}>
                Total Earnings
              </Text>
              <Text style={[tw`text-xl font-bold`, { color: theme.colors.foreground }]}>
                ${earnings.totalEarnings.toFixed(2)}
              </Text>
            </CardContent>
          </Card>

          <Card style={[tw`flex-1`, { backgroundColor: 'rgba(255,255,255,0.05)', borderColor: 'rgba(255,255,255,0.1)' }]}>
            <CardContent style={tw`p-4`}>
              <View style={tw`flex-row items-center justify-between mb-2`}>
                <View style={[tw`p-2 rounded-xl`, { backgroundColor: theme.colors.warning + '20' }]}>
                  <Calendar size={20} color={theme.colors.warning} />
                </View>
              </View>
              <Text style={[tw`text-xs`, { color: theme.colors.mutedForeground }]}>
                This Week
              </Text>
              <Text style={[tw`text-xl font-bold`, { color: theme.colors.foreground }]}>
                ${earnings.weeklyEarnings.toFixed(2)}
              </Text>
            </CardContent>
          </Card>
        </View>

        {/* Pending Payouts */}
        {earnings.stripeConnected && (
          <Card style={[{ backgroundColor: 'rgba(255,255,255,0.05)', borderColor: 'rgba(255,255,255,0.1)' }]}>
            <CardContent style={tw`p-4`}>
              <View style={tw`flex-row items-center justify-between`}>
                <View>
                  <View style={tw`flex-row items-center mb-1`}>
                    <CreditCard size={16} color={theme.colors.secondary} style={tw`mr-2`} />
                    <Text style={[tw`font-medium`, { color: theme.colors.foreground }]}>
                      Pending Payouts
                    </Text>
                  </View>
                  <Text style={[tw`text-2xl font-bold`, { color: theme.colors.secondary }]}>
                    ${earnings.pendingPayouts.toFixed(2)}
                  </Text>
                </View>
                <TouchableOpacity
                  style={[tw`px-4 py-2 rounded-xl`, { backgroundColor: theme.colors.secondary + '20' }]}
                  onPress={handleViewStripeDetails}
                >
                  <Text style={[tw`text-sm font-medium`, { color: theme.colors.secondary }]}>
                    View Details
                  </Text>
                </TouchableOpacity>
              </View>
            </CardContent>
          </Card>
        )}
      </View>

      {/* Success Message */}
      {earnings.stripeConnected && (
        <View style={[tw`mt-6 p-4 rounded-xl flex-row items-start`, { backgroundColor: theme.colors.secondary + '10', borderWidth: 1, borderColor: theme.colors.secondary + '20' }]}>
          <CheckCircle size={16} color={theme.colors.secondary} style={tw`mr-2 mt-0.5`} />
          <View style={tw`flex-1`}>
            <Text style={[tw`font-semibold mb-1`, { color: theme.colors.secondary }]}>
              Stripe Connected
            </Text>
            <Text style={[tw`text-sm`, { color: theme.colors.secondary }]}>
              Your payments are being processed automatically. Payouts occur daily.
            </Text>
          </View>
        </View>
      )}
    </ScrollView>
  );
} 