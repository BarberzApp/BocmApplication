import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    KeyboardAvoidingView,
    Platform,
    SafeAreaView,
    ScrollView,
    TouchableOpacity,
    Alert,
    StatusBar,
    Animated,
    TextInput,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { Scissors, User, ArrowLeft, Eye, EyeOff, Check } from 'lucide-react-native';
import { RootStackParamList } from '../shared/types';
import { supabase } from '../shared/lib/supabase';
import { theme } from '../shared/lib/theme';
import { logger } from '../shared/lib/logger';
import { AnimatedBackground } from '../shared/components/AnimatedBackground';
import { AnimatedText } from '../shared/components/AnimatedText';
import { ActionButton } from '../shared/components/ActionButton';

type SignUpScreenNavigationProp = NativeStackNavigationProp<RootStackParamList>;

type UserType = 'client' | 'barber';

export default function SignUpPage() {
    const navigation = useNavigation<SignUpScreenNavigationProp>();
    const [userType, setUserType] = useState<UserType>('client');
    const [fullName, setFullName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [agreeToTerms, setAgreeToTerms] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [errors, setErrors] = useState<{ [key: string]: string }>({});
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [showContent, setShowContent] = useState(false);

    useEffect(() => {
        const timer = setTimeout(() => setShowContent(true), 500);
        return () => clearTimeout(timer);
    }, []);

    const validateForm = (): boolean => {
        const newErrors: { [key: string]: string } = {};

        if (!fullName.trim()) {
            newErrors.fullName = 'Full name is required';
        }

        if (!email.trim()) {
            newErrors.email = 'Email is required';
        } else {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(email)) {
                newErrors.email = 'Please enter a valid email address';
            }
        }

        if (!password) {
            newErrors.password = 'Password is required';
        } else if (password.length < 6) {
            newErrors.password = 'Password must be at least 6 characters long';
        }

        if (password !== confirmPassword) {
            newErrors.confirmPassword = 'Passwords do not match';
        }


        if (!agreeToTerms) {
            newErrors.terms = 'You must agree to the terms and conditions';
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSignUp = async () => {
        if (!validateForm()) {
            return;
        }

        setIsLoading(true);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        logger.log('=== Registration Process Started ===');
        logger.log('Registration Data:', { name: fullName, email, role: userType });

        try {
            // Create auth user with metadata
            logger.log('Creating auth user...');
            const { data: authData, error: authError } = await supabase.auth.signUp({
                email,
                password,
                options: {
                    data: {
                        name: fullName,
                        role: userType,
                    },
                },
            });

            if (authError) {
                logger.error('Auth Error:', authError);
                
                // Check for user already registered error
                if (authError.message?.includes('User already registered')) {
                    Alert.alert(
                        'Account Exists',
                        'An account with this email already exists. Please sign in instead.',
                        [
                            { text: 'Go to Login', onPress: () => navigation.navigate('Login' as any) }
                        ]
                    );
                    return;
                }
                
                setErrors({ general: authError.message || 'Registration failed' });
                return;
            }

            logger.log('Auth Data:', authData);

            // Check if email confirmation is required
            if (authData.user && !authData.session) {
                logger.log('Email confirmation required');
                Alert.alert(
                    'Check Your Email',
                    'We\'ve sent you a confirmation email. Please verify your email address to complete registration.',
                    [
                        {
                            text: 'OK',
                            onPress: () => navigation.navigate('EmailConfirmation' as any)
                        }
                    ]
                );
                return;
            }

            if (!authData.user) {
                logger.error('No user returned from signup');
                setErrors({ general: 'Registration failed. Please try again.' });
                return;
            }

            // Try to create/update profile
            const { error: profileError } = await supabase
                .from('profiles')
                .upsert({
                    id: authData.user.id,
                    email: authData.user.email,
                    name: fullName,
                    username: email.split('@')[0], // Generate username from email
                    role: userType,
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                });

            if (profileError) {
                logger.error('Profile creation error:', profileError);
                // Don't fail registration, profile will be created on first login
            }

            // For barbers, try to create business profile
            if (userType === 'barber') {
                logger.log('Creating business profile...');
                const { error: businessError } = await supabase
                    .from('barbers')
                    .insert({
                        user_id: authData.user.id,
                        status: 'pending',
                        created_at: new Date().toISOString(),
                        updated_at: new Date().toISOString(),
                    });

                if (businessError) {
                    logger.error('Business Profile Creation Failed:', businessError);
                    // Don't fail registration, barber row will be created on first login
                }
            }

            logger.log('Registration completed successfully');
            
            // Navigate based on user type
            if (authData.session) {
                Alert.alert(
                    'Registration Successful',
                    userType === 'barber' 
                        ? 'Welcome to BOCM! Please complete your business profile setup.'
                        : 'Welcome to BOCM!',
                    [
                        {
                            text: 'OK',
                            onPress: () => {
                                if (userType === 'barber') {
                                    navigation.navigate('BarberOnboarding' as any);
                                } else {
                                    navigation.navigate('Home' as any);
                                }
                            }
                        }
                    ]
                );
            }

        } catch (error) {
            logger.error('Registration Process Failed:', error);
            setErrors({ general: 'An unexpected error occurred. Please try again.' });
        } finally {
            setIsLoading(false);
        }
    };

    const handleSignIn = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        navigation.navigate('Login' as any);
    };

    const handleTermsPress = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        navigation.navigate('Terms' as any);
    };

    const handleGoogleSignUp = async () => {
        // Google Sign-Up is not yet implemented
        // This function is kept for future implementation
        // For now, Google Sign-Up button is hidden from the UI
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    };

    const handleBack = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        navigation.goBack();
    };

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
                            <View style={{ alignItems: 'center', marginBottom: 32 }}>
                                <AnimatedText
                                    text="CREATE ACCOUNT"
                                    type="welcome"
                                    delay={1000}
                                />
                                
                                <Text style={{
                                    fontSize: 18,
                                    color: 'rgba(255, 255, 255, 0.8)',
                                    textAlign: 'center',
                                    marginTop: 12,
                                }}>
                                    Join BOCM and start your journey
                                </Text>
                            </View>
                        )}

                        {/* Sign Up Form */}
                        {showContent && (
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
                                    {errors.general && (
                                        <View style={{
                                            padding: 16,
                                            marginBottom: 24,
                                            borderRadius: 12,
                                            backgroundColor: 'rgba(239, 68, 68, 0.1)',
                                            borderWidth: 1,
                                            borderColor: 'rgba(239, 68, 68, 0.2)',
                                        }}>
                                            <Text style={{ color: '#ef4444', textAlign: 'center', fontSize: 14 }}>
                                                {errors.general}
                                            </Text>
                                        </View>
                                    )}

                                    {/* User Type Selection */}
                                    <View style={{
                                        flexDirection: 'row',
                                        marginBottom: 24,
                                        borderRadius: 20,
                                        backgroundColor: 'rgba(255, 255, 255, 0.1)',
                                        padding: 4,
                                    }}>
                                        <TouchableOpacity
                                            style={{
                                                flex: 1,
                                                paddingVertical: 12,
                                                paddingHorizontal: 16,
                                                borderRadius: 12,
                                                flexDirection: 'row',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                backgroundColor: userType === 'client' ? theme.colors.secondary : 'transparent',
                                            }}
                                            onPress={() => {
                                                setUserType('client');
                                                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                            }}
                                            disabled={isLoading}
                                        >
                                            <User size={18} color={userType === 'client' ? theme.colors.background : theme.colors.foreground} style={{ marginRight: 8 }} />
                                            <Text style={{
                                                fontWeight: '600',
                                                color: userType === 'client' ? theme.colors.background : theme.colors.foreground,
                                            }}>
                                                Client
                                            </Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity
                                            style={{
                                                flex: 1,
                                                paddingVertical: 12,
                                                paddingHorizontal: 16,
                                                borderRadius: 12,
                                                flexDirection: 'row',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                backgroundColor: userType === 'barber' ? theme.colors.secondary : 'transparent',
                                            }}
                                            onPress={() => {
                                                setUserType('barber');
                                                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                            }}
                                            disabled={isLoading}
                                        >
                                            <Scissors size={18} color={userType === 'barber' ? theme.colors.background : theme.colors.foreground} style={{ marginRight: 8 }} />
                                            <Text style={{
                                                fontWeight: '600',
                                                color: userType === 'barber' ? theme.colors.background : theme.colors.foreground,
                                            }}>
                                                Barber
                                            </Text>
                                        </TouchableOpacity>
                                    </View>

                                    {/* Full Name Input */}
                                    <View style={{ marginBottom: 20 }}>
                                        <Text style={{
                                            fontSize: 14,
                                            fontWeight: '600',
                                            color: theme.colors.foreground,
                                            marginBottom: 8,
                                        }}>
                                            Full Name
                                        </Text>
                                        <View style={{
                                            height: 56,
                                            borderRadius: 20,
                                            borderWidth: 1,
                                            borderColor: errors.fullName ? '#ef4444' : 'rgba(255, 255, 255, 0.2)',
                                            backgroundColor: 'rgba(255, 255, 255, 0.05)',
                                            paddingHorizontal: 16,
                                            justifyContent: 'center',
                                        }}>
                                            <TextInput
                                                placeholder="John Doe"
                                                placeholderTextColor="rgba(255, 255, 255, 0.5)"
                                                value={fullName}
                                                onChangeText={(text) => {
                                                    setFullName(text);
                                                    setErrors({ ...errors, fullName: '' });
                                                }}
                                                style={{
                                                    color: theme.colors.foreground,
                                                    fontSize: 16,
                                                }}
                                                autoCapitalize="words"
                                                autoCorrect={false}
                                                editable={!isLoading}
                                            />
                                        </View>
                                        {errors.fullName && (
                                            <Text style={{ color: '#ef4444', fontSize: 12, marginTop: 4 }}>
                                                {errors.fullName}
                                            </Text>
                                        )}
                                    </View>
                                    
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
                                            borderColor: errors.email ? '#ef4444' : 'rgba(255, 255, 255, 0.2)',
                                            backgroundColor: 'rgba(255, 255, 255, 0.05)',
                                            paddingHorizontal: 16,
                                            justifyContent: 'center',
                                        }}>
                                            <TextInput
                                                placeholder="you@example.com"
                                                placeholderTextColor="rgba(255, 255, 255, 0.5)"
                                                value={email}
                                                onChangeText={(text) => {
                                                    setEmail(text);
                                                    setErrors({ ...errors, email: '' });
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
                                        {errors.email && (
                                            <Text style={{ color: '#ef4444', fontSize: 12, marginTop: 4 }}>
                                                {errors.email}
                                            </Text>
                                        )}
                                    </View>

                                    {/* Password Input */}
                                    <View style={{ marginBottom: 20 }}>
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
                                            borderColor: errors.password ? '#ef4444' : 'rgba(255, 255, 255, 0.2)',
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
                                                    setErrors({ ...errors, password: '' });
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
                                        {errors.password && (
                                            <Text style={{ color: '#ef4444', fontSize: 12, marginTop: 4 }}>
                                                {errors.password}
                                            </Text>
                                        )}
                                    </View>

                                    {/* Confirm Password Input */}
                                    <View style={{ marginBottom: 24 }}>
                                        <Text style={{
                                            fontSize: 14,
                                            fontWeight: '600',
                                            color: theme.colors.foreground,
                                            marginBottom: 8,
                                        }}>
                                            Confirm Password
                                        </Text>
                                        <View style={{
                                            height: 56,
                                            borderRadius: 20,
                                            borderWidth: 1,
                                            borderColor: errors.confirmPassword ? '#ef4444' : 'rgba(255, 255, 255, 0.2)',
                                            backgroundColor: 'rgba(255, 255, 255, 0.05)',
                                            paddingHorizontal: 16,
                                            flexDirection: 'row',
                                            alignItems: 'center',
                                        }}>
                                            <TextInput
                                                placeholder="Re-enter your password"
                                                placeholderTextColor="rgba(255, 255, 255, 0.5)"
                                                value={confirmPassword}
                                                onChangeText={(text) => {
                                                    setConfirmPassword(text);
                                                    setErrors({ ...errors, confirmPassword: '' });
                                                }}
                                                secureTextEntry={!showConfirmPassword}
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
                                                onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                                                style={{ padding: 8 }}
                                            >
                                                {showConfirmPassword ? (
                                                    <EyeOff size={20} color="rgba(255, 255, 255, 0.6)" />
                                                ) : (
                                                    <Eye size={20} color="rgba(255, 255, 255, 0.6)" />
                                                )}
                                            </TouchableOpacity>
                                        </View>
                                        {errors.confirmPassword && (
                                            <Text style={{ color: '#ef4444', fontSize: 12, marginTop: 4 }}>
                                                {errors.confirmPassword}
                                            </Text>
                                        )}
                                    </View>

                                    {/* Terms Agreement */}
                                    <TouchableOpacity
                                        style={{
                                            flexDirection: 'row',
                                            alignItems: 'center',
                                            marginBottom: 16,
                                        }}
                                        onPress={() => {
                                            setAgreeToTerms(!agreeToTerms);
                                            setErrors({ ...errors, terms: '' });
                                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                        }}
                                        disabled={isLoading}
                                    >
                                        <View style={{
                                            width: 20,
                                            height: 20,
                                            borderRadius: 4,
                                            borderWidth: 2,
                                            borderColor: errors.terms ? '#ef4444' : 'rgba(255, 255, 255, 0.4)',
                                            backgroundColor: agreeToTerms ? theme.colors.secondary : 'transparent',
                                            justifyContent: 'center',
                                            alignItems: 'center',
                                            marginRight: 12,
                                        }}>
                                            {agreeToTerms && (
                                                <Check size={12} color={theme.colors.background} />
                                            )}
                                        </View>
                                        <Text style={{
                                            fontSize: 14,
                                            color: theme.colors.foreground,
                                            flex: 1,
                                        }}>
                                            I agree to the{' '}
                                            <Text
                                                onPress={handleTermsPress}
                                                style={{
                                                    color: theme.colors.secondary,
                                                    textDecorationLine: 'underline',
                                                    fontWeight: '600',
                                                }}
                                            >
                                                terms and conditions
                                            </Text>
                                            {' '}and{' '}
                                            <Text
                                                onPress={() => {
                                                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                                    navigation.navigate('PrivacyPolicy' as any);
                                                }}
                                                style={{
                                                    color: theme.colors.secondary,
                                                    textDecorationLine: 'underline',
                                                    fontWeight: '600',
                                                }}
                                            >
                                                privacy policy
                                            </Text>
                                        </Text>
                                    </TouchableOpacity>
                                    {errors.terms && (
                                        <Text style={{ color: '#ef4444', fontSize: 12, marginBottom: 16 }}>
                                            {errors.terms}
                                        </Text>
                                    )}

                                    {/* Create Account Button */}
                                    <ActionButton
                                        variant="primary"
                                        onPress={handleSignUp}
                                        disabled={isLoading}
                                    >
                                        {isLoading ? 'Creating account...' : 'Create account'}
                                    </ActionButton>

                                    {/* Google Sign-Up removed - feature not yet implemented */}
                                </BlurView>
                            </View>
                        )}
                            {/* Sign In Link */}
                            <View style={{ alignItems: 'center', marginTop: 32 }}>
                                <Text style={{
                                    fontSize: 14,
                                    color: 'rgba(255, 255, 255, 0.8)',
                                    textAlign: 'center',
                                }}>
                                    Already have an account?{' '}
                                    <Text
                                        onPress={handleSignIn}
                                        style={{
                                            color: theme.colors.secondary,
                                            textDecorationLine: 'underline',
                                            fontWeight: '600',
                                        }}
                                    >
                                        Sign in
                                    </Text>
                                </Text>
                            </View>
                        )
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}