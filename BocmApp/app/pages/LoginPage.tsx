import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  TouchableOpacity,
  Alert,
  StatusBar,
  ScrollView,
  Animated,
  TextInput,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { Scissors, ArrowLeft, Eye, EyeOff } from 'lucide-react-native';
import { User, Barber } from '../shared/types';
import { useAuth } from '../shared/hooks/useAuth';
import { supabase } from '../shared/lib/supabase';
import { theme } from '../shared/lib/theme';
import { logger } from '../shared/lib/logger';
import { AnimatedBackground } from '../shared/components/AnimatedBackground';
import { AnimatedText } from '../shared/components/AnimatedText';
import { ActionButton } from '../shared/components/ActionButton';

type RootStackParamList = {
  Home: undefined;
  Login: undefined;
  SignUp: undefined;
  MainTabs: undefined;
  ProfileComplete: undefined;
};

type LoginScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Login'>;

export default function LoginPage() {
  const navigation = useNavigation<LoginScreenNavigationProp>();
  const { user, userProfile } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showContent, setShowContent] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setShowContent(true), 500);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const checkSession = async () => {
      setCheckingSession(true);
      try {
        logger.log('🔐 Checking existing session...');
        const { data: { session } } = await supabase.auth.getSession();
        
        if (session?.user) {
          logger.log('✅ Session found for user:', session.user.id);
          await handleRedirect(session.user.id);
        } else {
          logger.log('❌ No existing session found');
          setCheckingSession(false);
        }
      } catch (e) {
        logger.error('❌ Session check error:', e);
        setCheckingSession(false);
      }
    };
    checkSession();
  }, []);

  const handleRedirect = async (userId: string) => {
    try {
      logger.log('🎯 Starting redirect process for user:', userId);
      
      // Fetch profile with retry
      let profile = null;
      let retries = 3;
      
      while (retries > 0) {
        logger.log(`📋 Fetching profile - Attempt ${4 - retries}/3...`);
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', userId)
          .maybeSingle();
        
        if (data) {
          profile = data;
          logger.log('✅ Profile fetched successfully');
          break;
        }
        
        logger.log('❌ Profile fetch attempt failed:', error);
        retries--;
        if (retries > 0) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      if (!profile) {
        logger.log('❌ Could not fetch profile after retries');
        setCheckingSession(false);
        return;
      }

      // Check if profile needs completion
      if (!profile.role || !profile.username) {
        logger.log('⚠️ Profile incomplete, redirecting to completion');
        navigation.replace('ProfileComplete' as any);
        return;
      }

      // Ensure barber row exists
      if (profile.role === 'barber') {
        logger.log('💈 Checking for barber row...');
        const { data: existingBarber } = await supabase
          .from('barbers')
          .select('id')
          .eq('user_id', userId)
          .maybeSingle();

        if (!existingBarber) {
          logger.log('💈 Creating barber row...');
          const { error: insertError } = await supabase
            .from('barbers')
            .insert({
              user_id: userId,
              business_name: profile.business_name || '',
              status: 'pending',
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            });

          if (insertError) {
            logger.error('❌ Failed to create barber row:', insertError);
          } else {
            logger.log('✅ Barber row created successfully');
          }
        }
      }

      // Determine redirect path
      let redirectPath = 'MainTabs';
      
      if (profile.email === 'primbocm@gmail.com') {
        redirectPath = 'SuperAdmin' as any;
      } else if (profile.role === 'barber') {
        // Check if barber onboarding is already complete
        logger.log('💈 Checking if barber onboarding is complete...');
        const { data: barberData, error: barberError } = await supabase
          .from('barbers')
          .select('onboarding_complete, business_name, bio, specialties')
          .eq('user_id', userId)
          .single();

        if (barberError) {
          logger.error('❌ Error checking barber data:', barberError);
          redirectPath = 'BarberOnboarding';
        } else {
          logger.log('💈 Onboarding completion check:', {
            onboarding_complete: barberData?.onboarding_complete,
            businessName: barberData?.business_name,
            bio: barberData?.bio,
            specialties: barberData?.specialties
          });

          // If onboarding is marked as complete, skip to main app
          if (barberData?.onboarding_complete) {
            logger.log('✅ Barber onboarding is already complete! Going to main app...');
            redirectPath = 'MainTabs';
          } else {
            logger.log('⚠️ Barber onboarding incomplete, going to onboarding...');
            redirectPath = 'BarberOnboarding';
          }
        }
      } else if (profile.location) {
        redirectPath = 'MainTabs';
      } 

      logger.log('🎯 Redirecting to:', redirectPath);
      navigation.replace(redirectPath as any);
      
    } catch (error) {
      logger.error('❌ Redirect error:', error);
      setCheckingSession(false);
    }
  };

  const handleSignIn = async () => {
    setError(null);
    
    if (!email || !password) {
      setError('Please fill in all fields');
      return;
    }
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError('Please enter a valid email address');
      return;
    }
    
    setIsLoading(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    logger.log('🔐 Starting login process for:', email);
    
    try {
      // Authenticate with Supabase
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) {
        logger.error('❌ Authentication error:', authError);
        
        if (authError.message?.includes('Invalid login credentials')) {
          setError('Invalid email or password');
        } else if (authError.message?.includes('Email not confirmed')) {
          setError('Please check your email to confirm your account');
        } else {
          setError(authError.message || 'An error occurred during login');
        }
        return;
      }

      if (!authData.user) {
        logger.error('❌ No user data returned');
        setError('Login failed. Please try again.');
        return;
      }

      logger.log('✅ Authentication successful for user:', authData.user.id);

      // Fetch profile with retry
      let profile = null;
      let retries = 3;
      
      while (retries > 0) {
        logger.log(`📋 Fetching profile - Attempt ${4 - retries}/3...`);
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', authData.user.id)
          .maybeSingle();
        
        if (data) {
          profile = data;
          logger.log('✅ Profile fetched successfully');
          break;
        }
        
        logger.log('❌ Profile fetch attempt failed:', error);
        retries--;
        if (retries > 0) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      if (!profile) {
        logger.error('❌ Could not fetch profile after retries');
        setError('Could not load profile. Please try again.');
        return;
      }

      // Check if profile is complete
      if (!profile.role || !profile.username) {
        logger.log('⚠️ Profile incomplete, user needs to complete registration');
        navigation.replace('ProfileComplete' as any);
        return;
      }

      // Ensure barber row exists for barber users
      if (profile.role === 'barber') {
        logger.log('💈 Checking for barber row...');
        const { data: existingBarber } = await supabase
          .from('barbers')
          .select('id')
          .eq('user_id', authData.user.id)
          .maybeSingle();

        if (!existingBarber) {
          logger.log('💈 Creating barber row...');
          const { error: insertError } = await supabase
            .from('barbers')
            .insert({
              user_id: authData.user.id,
              business_name: profile.business_name || '',
              status: 'pending',
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            });

          if (insertError) {
            logger.error('❌ Failed to create barber row:', insertError);
          } else {
            logger.log('✅ Barber row created successfully');
          }
        }
      }

      logger.log('✅ Login successful, redirecting...');
      await handleRedirect(authData.user.id);
      
    } catch (error) {
      logger.error('❌ Login error:', error);
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignUp = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    navigation.navigate('SignUp');
  };

  const handleForgotPassword = async () => {
    if (!email) {
      Alert.alert('Enter Email', 'Please enter your email address first');
      return;
    }
    
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email);
      
      if (error) {
        Alert.alert('Error', error.message);
      } else {
        Alert.alert(
          'Check Your Email',
          'We\'ve sent you a password reset link. Please check your email.',
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to send reset email. Please try again.');
    }
  };

  const handleGoogleSignIn = async () => {
    // Google Sign-In is not yet implemented
    // This function is kept for future implementation
    // For now, Google Sign-In button is hidden from the UI
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleBack = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    navigation.navigate('Home' as any);
  };

  if (checkingSession) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }}>
        <StatusBar barStyle="light-content" backgroundColor={theme.colors.background} />
        <AnimatedBackground />
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <View style={{
            padding: 24,
            borderRadius: 20,
            backgroundColor: 'rgba(255, 255, 255, 0.1)',
            backdropFilter: 'blur(10px)',
          }}>
            <Text style={{ color: theme.colors.secondary, fontSize: 18, fontWeight: '600' }}>
              Checking session...
            </Text>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <StatusBar barStyle="light-content" backgroundColor={theme.colors.background} />
      
      {/* Animated Background */}
      <AnimatedBackground />
      
      {/* Back Button */}
      <TouchableOpacity
        onPress={handleBack}
        style={{
          position: 'absolute',
          top: 60,
          left: 20,
          zIndex: 10,
          width: 44,
          height: 44,
          borderRadius: 22,
          backgroundColor: 'rgba(255, 255, 255, 0.1)',
          justifyContent: 'center',
          alignItems: 'center',
          backdropFilter: 'blur(10px)',
        }}
      >
        <ArrowLeft size={24} color={theme.colors.foreground} />
      </TouchableOpacity>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={{ paddingHorizontal: 32, paddingVertical: 24 }}>
            
            {/* Header */}
            {showContent && (
              <View style={{ alignItems: 'center', marginBottom: 48 }}>
                <View style={{
                  width: 80,
                  height: 80,
                  borderRadius: 40,
                  backgroundColor: 'rgba(199, 142, 63, 0.2)',
                  justifyContent: 'center',
                  alignItems: 'center',
                  marginBottom: 24,
                }}>
                  <Scissors size={40} color={theme.colors.secondary} />
                </View>
                
                <AnimatedText
                  text="WELCOME BACK"
                  type="welcome"
                  delay={1000}
                />
                
                <Text style={{
                  fontSize: 18,
                  color: 'rgba(255, 255, 255, 0.8)',
                  textAlign: 'center',
                  marginTop: 12,
                }}>
                  Sign in to your account
                </Text>
              </View>
            )}

            {/* Login Form */}
            {showContent && (
              <View style={{ width: '100%' }}>
                <View style={{
                  width: '100%',
                  borderRadius: 24,
                  overflow: 'hidden',
                }}>
                  <BlurView
                    intensity={20}
                    style={{
                      padding: 32,
                      borderWidth: 1,
                      borderColor: 'rgba(255, 255, 255, 0.1)',
                      backgroundColor: 'rgba(255, 255, 255, 0.05)',
                    }}
                  >
                  {/* Error Display */}
                  {error && (
                    <View style={{
                      padding: 16,
                      marginBottom: 24,
                      borderRadius: 12,
                      backgroundColor: 'rgba(239, 68, 68, 0.1)',
                      borderWidth: 1,
                      borderColor: 'rgba(239, 68, 68, 0.2)',
                    }}>
                      <Text style={{ color: '#ef4444', textAlign: 'center', fontSize: 14 }}>
                        {error}
                      </Text>
                    </View>
                  )}

                  {/* Email Input */}
                  <View style={{ marginBottom: 20 }}>
                    <Text style={{
                      fontSize: 14,
                      fontWeight: '600',
                      color: theme.colors.foreground,
                      marginBottom: 8,
                    }}>
                      Email
                    </Text>
                    <View style={{
                      height: 56,
                      borderRadius: 20,
                      borderWidth: 1,
                      borderColor: 'rgba(255, 255, 255, 0.2)',
                      backgroundColor: 'rgba(255, 255, 255, 0.05)',
                      paddingHorizontal: 16,
                      justifyContent: 'center',
                    }}>
                      <TextInput
                        placeholder="name@example.com"
                        placeholderTextColor="rgba(255, 255, 255, 0.5)"
                        value={email}
                        onChangeText={(text) => {
                          setEmail(text);
                          setError(null);
                        }}
                        style={{
                          color: theme.colors.foreground,
                          fontSize: 16,
                        }}
                        keyboardType="email-address"
                        autoCapitalize="none"
                        autoCorrect={false}
                        editable={!isLoading}
                      />
                    </View>
                  </View>

                  {/* Password Input */}
                  <View style={{ marginBottom: 24 }}>
                    <Text style={{
                      fontSize: 14,
                      fontWeight: '600',
                      color: theme.colors.foreground,
                      marginBottom: 8,
                    }}>
                      Password
                    </Text>
                    <View style={{
                      height: 56,
                      borderRadius: 20,
                      borderWidth: 1,
                      borderColor: 'rgba(255, 255, 255, 0.2)',
                      backgroundColor: 'rgba(255, 255, 255, 0.05)',
                      paddingHorizontal: 16,
                      flexDirection: 'row',
                      alignItems: 'center',
                    }}>
                      <TextInput
                        placeholder="Enter your password"
                        placeholderTextColor="rgba(255, 255, 255, 0.5)"
                        value={password}
                        onChangeText={(text) => {
                          setPassword(text);
                          setError(null);
                        }}
                        secureTextEntry={!showPassword}
                        style={{
                          color: theme.colors.foreground,
                          fontSize: 16,
                          flex: 1,
                        }}
                        autoCapitalize="none"
                        autoCorrect={false}
                        editable={!isLoading}
                      />
                      <TouchableOpacity
                        onPress={() => setShowPassword(!showPassword)}
                        style={{ padding: 8 }}
                      >
                        {showPassword ? (
                          <EyeOff size={20} color="rgba(255, 255, 255, 0.6)" />
                        ) : (
                          <Eye size={20} color="rgba(255, 255, 255, 0.6)" />
                        )}
                      </TouchableOpacity>
                    </View>
                    
                    <TouchableOpacity
                      onPress={handleForgotPassword}
                      disabled={isLoading}
                      style={{ alignSelf: 'flex-end', marginTop: 8 }}
                    >
                      <Text style={{
                        fontSize: 14,
                        color: theme.colors.secondary,
                        textDecorationLine: 'underline',
                      }}>
                        Forgot password?
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {/* Sign In Button */}
                  <ActionButton
                    variant="primary"
                    onPress={handleSignIn}
                    disabled={isLoading}
                  >
                    {isLoading ? 'Signing in...' : 'Sign in'}
                  </ActionButton>

                  {/* Google Sign-In removed - feature not yet implemented */}
                </BlurView>
                </View>

                {/* Sign Up Link */}
                <View style={{ alignItems: 'center', marginTop: 32 }}>
                  <Text style={{
                    fontSize: 14,
                    color: 'rgba(255, 255, 255, 0.8)',
                    textAlign: 'center',
                  }}>
                    Don't have an account?{' '}
                    <Text
                      onPress={handleSignUp}
                      style={{
                        color: theme.colors.secondary,
                        textDecorationLine: 'underline',
                        fontWeight: '600',
                      }}
                    >
                      Sign up
                    </Text>
                  </Text>
                </View>
              </View>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}