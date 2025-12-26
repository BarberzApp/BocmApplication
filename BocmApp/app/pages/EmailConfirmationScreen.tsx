import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Alert, ActivityIndicator, SafeAreaView, StatusBar} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { MailCheck, RefreshCw, LogIn, ArrowLeft } from 'lucide-react-native';
import tw from 'twrnc';
import Button from '../shared/components/ui/Button';
import { useAuth } from '../shared/hooks/useAuth';
import { supabase } from '../shared/lib/supabase';
import { theme } from '../shared/lib/theme';
import { AnimatedBackground } from '../shared/components/AnimatedBackground';
import { Card, CardContent } from '../shared/components/ui';
import { logger } from '../shared/lib/logger';

type RootStackParamList = {
  EmailConfirmation: { email: string };
};

type EmailConfirmationScreenNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  'EmailConfirmation'
>;

type EmailConfirmationScreenRouteProp = RouteProp<
  RootStackParamList,
  'EmailConfirmation'
>;

export default function EmailConfirmationScreen() {
  const navigation = useNavigation<EmailConfirmationScreenNavigationProp>();
  const route = useRoute<EmailConfirmationScreenRouteProp>();
  const { user } = useAuth();
  const [checking, setChecking] = useState(false);
  
  const email = (user?.email || route?.params?.email || '').trim().toLowerCase();

  useEffect(() => {
    logger.info('Email confirmation screen context', {
      email,
      userEmail: user?.email,
      routeEmail: route?.params?.email,
    });
  }, [email, user, route?.params?.email]);
  useEffect(() => {
    const checkInterval = setInterval(async () => {
      if (user) {
        clearInterval(checkInterval);
        handleConfirmed();
      }
    }, 2000);

    return () => clearInterval(checkInterval);
  }, [user]);

  const handleConfirmed = () => {
    // Default to client flow if no user profile
    navigation.replace('FindBarber' as any, {});
  };

  const checkEmailConfirmation = async () => {
    setChecking(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session?.user) {
        Alert.alert(
          'Email Confirmed!',
          'Your email has been verified. Redirecting...',
          [
            {
              text: 'OK',
              onPress: handleConfirmed,
            },
          ]
        );
      } else {
        Alert.alert(
          'Not Confirmed Yet',
          'Please check your email and click the confirmation link first.',
        );
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to check confirmation status. Please try again.');
    } finally {
      setChecking(false);
    }
  };

  const resendConfirmationEmail = async () => {
    if (!email) {
      Alert.alert(
        'Missing email',
        'We need your email to resend the confirmation. Please log in again or restart signup.'
      );
      logger.warn('Resend blocked: missing email context', {
        email,
        userEmail: user?.email,
        routeEmail: route?.params?.email,
      });
      return;
    }
    
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: email,
      });
      if (error) throw error;
      Alert.alert(
        'Email Sent',
        'We&apos;ve sent another confirmation email. Please check your inbox.',
      );
      logger.info('Email sent successfully');
      
    } catch (error) {
      Alert.alert('Error', 'Failed to resend confirmation email. Please try again.');
      logger.error('Failed to resend confirmation email', error);
    }
    
  };

  const goToLogin = () => {
    navigation.replace('Login' as any, {});
  };

  return (
    <SafeAreaView style={[tw`flex-1`, { backgroundColor: theme.colors.background }]}>
      <StatusBar barStyle="light-content" backgroundColor={theme.colors.background} />
      <AnimatedBackground />

      <View style={tw`flex-1 justify-center px-6`}>
        {/* Back button */}
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={[
            tw`absolute left-4 top-12 w-11 h-11 rounded-full items-center justify-center`,
            { backgroundColor: 'rgba(255,255,255,0.08)', zIndex: 10 },
          ]}
        >
          <ArrowLeft size={22} color={theme.colors.foreground} />
        </TouchableOpacity>

        <Card style={[tw`w-full max-w-md self-center rounded-2xl`, { backgroundColor: 'rgba(255,255,255,0.05)' }]}>
          <CardContent style={tw`p-6`}>
            <View style={tw`items-center mb-4`}>
              <View
                style={[
                  tw`w-16 h-16 rounded-full items-center justify-center mb-3`,
                  { backgroundColor: theme.colors.secondary + '30' },
                ]}
              >
                <MailCheck size={28} color={theme.colors.secondary} />
            </View>
              <Text style={[tw`text-xl font-bold text-center`, { color: theme.colors.foreground }]}>
                Check your email
            </Text>
              <Text style={[tw`text-sm text-center mt-2`, { color: theme.colors.mutedForeground }]}>
                We sent a verification link to:
            </Text>
              <Text style={[tw`text-base font-semibold mt-1 text-center`, { color: theme.colors.secondary }]}>
              {email}
            </Text>
          </View>

            <Text style={[tw`text-center mb-6 text-sm leading-5`, { color: theme.colors.mutedForeground }]}>
              Click the link in your inbox to verify. We&apos;ll redirect once it&apos;s confirmed.
          </Text>

            <View style={tw`gap-3`}>
            {checking ? (
                <View style={[tw`py-3 rounded-xl flex-row items-center justify-center`, { backgroundColor: theme.colors.secondary }]}>
                <ActivityIndicator color={theme.colors.foreground} />
                  <Text style={[tw`ml-2 font-semibold`, { color: theme.colors.foreground }]}>Checking...</Text>
              </View>
            ) : (
              <Button
                onPress={checkEmailConfirmation}
                size="lg"
                  style={[tw`w-full flex-row items-center justify-center gap-2`, { backgroundColor: theme.colors.secondary }]}
              >
                  <MailCheck size={18} color={theme.colors.primaryForeground} />
                  <Text style={[tw`font-semibold`, { color: theme.colors.primaryForeground }]}>
                    I&apos;ve confirmed my email
                  </Text>
              </Button>
            )}

              <Button
                variant="outline"
              onPress={resendConfirmationEmail}
                style={tw`w-full flex-row items-center justify-center gap-2 border border-white/10`}
            >
                <RefreshCw size={18} color={theme.colors.secondary} />
                <Text style={[tw`font-semibold`, { color: theme.colors.secondary }]}>Resend email</Text>
              </Button>

              <Button
                variant="ghost"
              onPress={goToLogin}
                style={tw`w-full flex-row items-center justify-center gap-2`}
            >
                <LogIn size={18} color={theme.colors.mutedForeground} />
                <Text style={[tw`font-semibold`, { color: theme.colors.mutedForeground }]}>
                Already confirmed? Go to login
              </Text>
              </Button>
          </View>
          </CardContent>
        </Card>
      </View>
    </SafeAreaView>
  );
}