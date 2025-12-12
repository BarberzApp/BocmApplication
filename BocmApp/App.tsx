import React, { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { View, Text, Alert } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import * as Font from 'expo-font';
import * as Linking from 'expo-linking';
import { notificationService } from './app/shared/lib/notifications';
import { initSentry } from './app/shared/lib/sentry';
import { logger } from './app/shared/lib/logger';
import tw from 'twrnc';
import { theme } from './app/shared/lib/theme';
import { AppNavigator } from './app/navigation/AppNavigator';
import { AuthProvider } from './app/shared/hooks/useAuth';
import { StripeProvider } from '@stripe/stripe-react-native';
import * as Sentry from '@sentry/react-native';

Sentry.init({
  dsn: 'https://a0acbe33ae2db6424431f49587a00eef@o4510517801517056.ingest.us.sentry.io/4510517839069185',

  // Adds more context data to events (IP address, cookies, user, etc.)
  // For more information, visit: https://docs.sentry.io/platforms/react-native/data-management/data-collected/
  sendDefaultPii: true,

  // Enable Logs
  enableLogs: true,

  // Configure Session Replay
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1,
  integrations: [Sentry.mobileReplayIntegration(), Sentry.feedbackIntegration()],

  // uncomment the line below to enable Spotlight (https://spotlightjs.com)
  // spotlight: __DEV__,
});

// Initialize Sentry as early as possible
initSentry();

const App = () => {
  const [fontsLoaded, setFontsLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Function to create booking from Stripe session
  const createBookingFromSession = async (sessionId: string) => {
    try {
      logger.log('Creating booking from session:', sessionId);
      
      const response = await fetch(`${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/create-booking-after-checkout`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY}`
        },
        body: JSON.stringify({
          sessionId: sessionId
        })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to create booking');
      }

      logger.log('Booking created successfully:', data);
      
      Alert.alert(
        'Booking Confirmed!',
        'Your payment was successful and your booking has been created.',
        [{ text: 'OK' }]
      );
    } catch (error) {
      logger.error('Error creating booking from session:', error);
      
      // Capture error in Sentry
      const { captureException } = require('./app/shared/lib/sentry');
      captureException(error as Error, {
        context: 'createBookingFromSession',
        sessionId,
      });
      
      Alert.alert(
        'Error',
        'Failed to create booking. Please contact support.',
        [{ text: 'OK' }]
      );
    }
  };

  useEffect(() => {
    async function loadFonts() {
      try {
        await Font.loadAsync({
          'BebasNeue-Regular': require('./assets/fonts/BebasNeue-Regular.ttf'),
        });
        setFontsLoaded(true);
      } catch (error) {
        logger.error('Error loading fonts:', error);
        setFontsLoaded(true); // Continue without custom fonts
      }
    }

    loadFonts();
  }, []);

  useEffect(() => {
    // Initialize notifications
    notificationService.initialize();
    setIsLoading(false);
  }, []);

  // Handle deep links
  useEffect(() => {
    const handleDeepLink = (event: { url: string }) => {
      logger.log('Deep link received:', event.url);
      
      // Handle Stripe connect redirects
      if (event.url.includes('bocm://stripe-connect/')) {
        if (event.url.includes('/return')) {
          // User completed Stripe onboarding
          logger.log('Stripe onboarding completed via deep link');
          
          // Extract account_id if present
          const urlParams = new URL(event.url);
          const accountId = urlParams.searchParams.get('account_id');
          logger.log('Account ID from deep link:', accountId);
          
          // Show a success message immediately
          logger.log('Stripe onboarding completed successfully - account ID:', accountId);
          
          // You could add a global state or navigation here to show success
          // For now, we'll rely on the focus effect in the onboarding page
        } else if (event.url.includes('/refresh')) {
          // User needs to refresh/retry Stripe onboarding
          logger.log('Stripe onboarding refresh via deep link');
          
          // Extract account_id if present
          const urlParams = new URL(event.url);
          const accountId = urlParams.searchParams.get('account_id');
          logger.log('Account ID from refresh deep link:', accountId);
        }
      }
      
      // Handle booking payment redirects
      if (event.url.includes('bocm://booking/')) {
        if (event.url.includes('/success')) {
          // User completed payment successfully
          logger.log('Booking payment completed via deep link');
          
          // Extract session_id if present
          const urlParams = new URL(event.url);
          const sessionId = urlParams.searchParams.get('session_id');
          logger.log('Session ID from deep link:', sessionId);
          
          if (sessionId) {
            // Create booking using the session ID
            createBookingFromSession(sessionId);
          }
        } else if (event.url.includes('/cancel')) {
          // User cancelled payment
          logger.log('Booking payment cancelled via deep link');
          Alert.alert(
            'Payment Cancelled',
            'Your payment was not completed. Please try again.',
            [{ text: 'OK' }]
          );
        }
      }
    };

    // Listen for incoming links when app is already running
    const subscription = Linking.addEventListener('url', handleDeepLink);

    // Handle links that opened the app
    Linking.getInitialURL().then((url) => {
      if (url) {
        logger.log('App opened with URL:', url);
        handleDeepLink({ url });
      }
    });

    return () => {
      subscription?.remove();
    };
  }, []);

  if (!fontsLoaded || isLoading) {
    return (
      <View style={[tw`flex-1 justify-center items-center`, { backgroundColor: theme.colors.background }]}>
        <Text style={[tw`text-xl font-bold`, { color: theme.colors.foreground }]}>BOCM</Text>
        <Text style={[tw`text-sm mt-2`, { color: theme.colors.mutedForeground }]}>Loading...</Text>
      </View>
    );
  }

    return (
        <StripeProvider publishableKey={process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY!}>
            <AuthProvider>
                <AppNavigator />
            </AuthProvider>
        </StripeProvider>
    );
};

export default Sentry.wrap(App);