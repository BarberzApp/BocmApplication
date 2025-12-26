import { Alert } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { supabase } from '../lib/supabase';
import { logger } from '../lib/logger';

interface StripeDeps {
  userId: string;
  setFormData: React.Dispatch<React.SetStateAction<any>>;
  setStripeStatus: React.Dispatch<React.SetStateAction<string | null>>;
  setStripeLoading: (v: boolean) => void;
  navigation: any;
  currentStep: number;
  stepsLength: number;
}

export const checkStripeStatusOnce = async (userId: string, setFormData: StripeDeps['setFormData'], setStripeStatus: StripeDeps['setStripeStatus']) => {
  try {
    const { data: barber, error } = await supabase
      .from('barbers')
      .select('stripe_account_id, stripe_account_status, stripe_account_ready')
      .eq('user_id', userId)
      .single();

    if (error) {
      logger.error('Stripe status check error:', error);
      return;
    }

    if (barber?.stripe_account_id && (barber.stripe_account_ready || barber.stripe_account_status === 'active')) {
      setFormData((prev: any) => ({ ...prev, stripeConnected: true }));
      setStripeStatus(barber.stripe_account_status);
    }
  } catch (err) {
    logger.error('Stripe status check unexpected error:', err);
  }
};

export const handleStripeConnect = async ({
  userId,
  setFormData,
  setStripeStatus,
  setStripeLoading,
  navigation,
  currentStep,
  stepsLength,
}: StripeDeps) => {
  setStripeLoading(true);

  try {
    const timeout = setTimeout(() => {
      logger.log('Stripe Connect timeout - resetting loading state');
      setStripeLoading(false);
    }, 30000);

    const { data, error } = await supabase.functions.invoke('stripe-connect', {
      body: { userId },
    });

    if (error) throw new Error(error.message || 'Failed to connect Stripe account');

    if (!data?.url) {
      throw new Error('No redirect URL received from Stripe');
    }

    await WebBrowser.openBrowserAsync(data.url);

    // Check status after returning
    const { data: barber, error: statusError } = await supabase
      .from('barbers')
      .select('stripe_account_id, stripe_account_status, stripe_account_ready')
      .eq('user_id', userId)
      .single();

    if (statusError) throw statusError;

    if (barber?.stripe_account_id) {
      logger.log('Stripe account ID present, status:', barber.stripe_account_status);
      if (barber.stripe_account_ready || barber.stripe_account_status === 'active') {
        setFormData((prev: any) => ({ ...prev, stripeConnected: true }));
        setStripeStatus(barber.stripe_account_status || null);
        Alert.alert(
          'Payment Setup Complete!',
          'Your Stripe account has been successfully connected. You can now receive payments.',
          [
            {
              text: 'Continue',
              onPress: () => {
                if (currentStep === stepsLength - 1) {
                  navigation.navigate('MainTabs' as any);
                }
              },
            },
          ]
        );
      } else {
        Alert.alert(
          'Stripe setup in progress',
          'Your Stripe account setup is in progress. You can complete it later in your settings.'
        );
      }
    } else {
      Alert.alert(
        'Stripe setup in progress',
        'Your Stripe account setup is in progress. You can complete it later in your settings.'
      );
    }

    clearTimeout(timeout);
  } catch (error: any) {
    logger.error('Error creating Stripe account:', error);
    Alert.alert('Error', error?.message || 'Failed to connect Stripe account. Please try again.');
  } finally {
    setStripeLoading(false);
  }
};

export default { handleStripeConnect, checkStripeStatusOnce };

