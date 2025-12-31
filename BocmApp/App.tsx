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
import { ErrorBoundary } from './app/shared/components/ui/ErrorBoundary';
// Initialize Sentry as early as possible (using secure configuration from sentry.ts)
// The initSentry() function handles proper configuration with data privacy protections
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
    // Initialize notifications with error handling
    (async () => {
      try {
        await notificationService.initialize();
      } catch (error) {
        logger.error('Error initializing notifications:', error);
        // Don't crash the app - notifications are not critical for startup
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  // Handle deep links
  useEffect(() => {
    const handleDeepLink = (event: { url: string }) => {
      try {
        logger.log('Deep link received:', event.url);
        
        if (!event.url || typeof event.url !== 'string') {
          logger.error('Invalid deep link URL:', event.url);
          return;
        }
        
        // Handle Stripe connect redirects
        if (event.url.includes('bocm://stripe-connect/')) {
          if (event.url.includes('/return')) {
            // User completed Stripe onboarding
            logger.log('Stripe onboarding completed via deep link');
            
            // Extract account_id if present
            try {
              const urlParams = new URL(event.url);
              const accountId = urlParams.searchParams.get('account_id');
              logger.log('Account ID from deep link:', accountId);
              
              // Show a success message immediately
              logger.log('Stripe onboarding completed successfully - account ID:', accountId);
            } catch (urlError) {
              logger.error('Error parsing Stripe connect return URL:', urlError);
              // Continue without account_id
            }
            
            // You could add a global state or navigation here to show success
            // For now, we'll rely on the focus effect in the onboarding page
          } else if (event.url.includes('/refresh')) {
            // User needs to refresh/retry Stripe onboarding
            logger.log('Stripe onboarding refresh via deep link');
            
            // Extract account_id if present
            try {
              const urlParams = new URL(event.url);
              const accountId = urlParams.searchParams.get('account_id');
              logger.log('Account ID from refresh deep link:', accountId);
            } catch (urlError) {
              logger.error('Error parsing Stripe connect refresh URL:', urlError);
              // Continue without account_id
            }
          }
        }
        
        // Handle booking payment redirects
        if (event.url.includes('bocm://booking/')) {
          if (event.url.includes('/success')) {
            // User completed payment successfully
            logger.log('Booking payment completed via deep link');
            
            // Extract session_id if present
            try {
              const urlParams = new URL(event.url);
              const sessionId = urlParams.searchParams.get('session_id');
              logger.log('Session ID from deep link:', sessionId);
              
              if (sessionId) {
                // Create booking using the session ID
                createBookingFromSession(sessionId);
              }
            } catch (urlError) {
              logger.error('Error parsing booking success URL:', urlError);
              Alert.alert(
                'Error',
                'Unable to process booking confirmation. Please check your bookings.',
                [{ text: 'OK' }]
              );
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
      } catch (error) {
        logger.error('Error handling deep link:', error);
        // Don't crash the app - just log the error
        const { captureException } = require('./app/shared/lib/sentry');
        captureException(error as Error, {
          context: 'handleDeepLink',
          url: event.url,
        });
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
    }).catch((error) => {
      logger.error('Error getting initial URL:', error);
      // Don't crash - just log the error
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

  // Validate Stripe publishable key
  const stripePublishableKey = process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY;
  if (!stripePublishableKey) {
    logger.error('Stripe publishable key is missing');
    return (
      <View style={[tw`flex-1 justify-center items-center`, { backgroundColor: theme.colors.background }]}>
        <Text style={[tw`text-xl font-bold`, { color: theme.colors.foreground }]}>Configuration Error</Text>
        <Text style={[tw`text-sm mt-2 text-center px-4`, { color: theme.colors.mutedForeground }]}>
          The app is not properly configured. Please contact support.
        </Text>
      </View>
    );
  }

  return (
    <ErrorBoundary>
      <StripeProvider publishableKey={stripePublishableKey}>
        <AuthProvider>
          <AppNavigator />
        </AuthProvider>
      </StripeProvider>
    </ErrorBoundary>
  );
};

export default App;