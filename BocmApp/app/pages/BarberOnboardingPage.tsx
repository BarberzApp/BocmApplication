import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    TextInput,
    ScrollView,
    SafeAreaView,
    TouchableOpacity,
    Alert,
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform,
    StatusBar,
    AppState,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as WebBrowser from 'expo-web-browser';
import tw from 'twrnc';
import { RootStackParamList } from '../shared/types';
import { supabase } from '../shared/lib/supabase';
import { useAuth } from '../shared/hooks/useAuth';
import { theme } from '../shared/lib/theme';
import { logger } from '../shared/lib/logger';
import { Card, CardContent} from '../shared/components/ui';
import { 
    CheckCircle, 
    CreditCard, 
    Building, 
    Scissors, 
    X, 
    Instagram, 
    Plus,
    Trash2,
    Phone,
    MapPin,
    Sparkles
} from 'lucide-react-native';
import { SpecialtyAutocomplete } from '../shared/components/ui/SpecialtyAutocomplete';
import { SocialMediaLinks } from '../shared/components/ui/SocialMediaLinks';
import { LocationInput } from '../shared/components/ui/LocationInput';
import { BARBER_SPECIALTIES } from '../shared/utils/settings.utils';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || "https://www.bocmstyle.com";

type BarberOnboardingNavigationProp = NativeStackNavigationProp<RootStackParamList, 'BarberOnboarding'>;

const steps = [
    {
        id: 'business',
        title: 'Business Information',
        description: 'Tell us about your business',
        icon: Building,
        required: ['businessName', 'phone', 'location', 'bio']
    },
    {
        id: 'services',
        title: 'Services & Pricing',
        description: 'Set up your services and pricing',
        icon: Scissors,
        required: ['services']
    },
    {
        id: 'stripe',
        title: 'Payment Setup',
        description: 'Connect your Stripe account to receive payments',
        icon: CreditCard,
        required: ['stripeConnected']
    },
];

interface FormData {
    businessName: string;
    phone: string;
    location: string;
    bio: string;
    specialties: string[];
    services: Array<{ name: string; price: number; duration: number }>;
    stripeConnected: boolean;
    socialMedia: {
        instagram: string;
        twitter: string;
        tiktok: string;
        facebook: string;
    };
}

interface ValidationErrors {
    [key: string]: string;
}

// Utility function to extract handle from URL or return as-is if already a handle
function extractHandle(input: string): string {
    if (!input) return '';
    input = input.trim();
    try {
        const url = new URL(input);
        const pathParts = url.pathname.split('/').filter(Boolean);
        if (pathParts.length > 0) {
            let handle = pathParts[pathParts.length - 1];
            if (handle.startsWith('@')) handle = handle.slice(1);
            return '@' + handle;
        }
    } catch {
        // Not a URL
    }
    if (input.startsWith('@')) return input;
    return '@' + input;
}



export default function BarberOnboardingPage() {
    const navigation = useNavigation<BarberOnboardingNavigationProp>();
    const { user, userProfile } = useAuth();
    const [currentStep, setCurrentStep] = useState(0);
    const [loading, setLoading] = useState(false);
    const [stripeLoading, setStripeLoading] = useState(false);
    const [validationErrors, setValidationErrors] = useState<ValidationErrors>({});
    const [stripeStatus, setStripeStatus] = useState<string | null>(null);
    const [onboardingComplete, setOnboardingComplete] = useState(false);
    const [showCompleteBanner, setShowCompleteBanner] = useState(true);
    const [showStripeWebView, setShowStripeWebView] = useState(false);
    const [stripeUrl, setStripeUrl] = useState('');

    const [formData, setFormData] = useState<FormData>({
        businessName: '',
        phone: '',
        location: '',
        bio: '',
        specialties: [],
        services: [
            { name: 'Haircut', price: 30, duration: 30 },
            { name: 'Beard Trim', price: 20, duration: 20 },
        ],
        stripeConnected: false,
        socialMedia: {
            instagram: '',
            twitter: '',
            tiktok: '',
            facebook: '',
        }
    });

    // Prefill form with existing data
    useEffect(() => {
        const fetchProfileData = async () => {
            if (!user) return;
            
            try {
                logger.log('Fetching profile data for user:', user.id);
                
                // Fetch barber profile data
                const { data: barberData, error: barberError } = await supabase
                    .from('barbers')
                    .select('*')
                    .eq('user_id', user.id)
                    .single();

                // Barber data fetched

                if (barberData) {
                    // Setting barber data in form
                    setFormData(prev => ({
                        ...prev,
                        businessName: barberData.business_name || '',
                        bio: barberData.bio || '',
                        specialties: barberData.specialties || [],
                        socialMedia: {
                            instagram: barberData.instagram || '',
                            twitter: barberData.twitter || '',
                            tiktok: barberData.tiktok || '',
                            facebook: barberData.facebook || '',
                        }
                    }));
                }

                // Fetch profile data
                const { data: profile, error: profileError } = await supabase
                    .from('profiles')
                    .select('phone, location')
                    .eq('id', user.id)
                    .single();

                if (profileError && profileError.code !== 'PGRST116') {
                    logger.error('Error fetching profile data:', profileError);
                }

                // Fetch services
                let services: Array<{ name: string; price: number; duration: number }> = [];
                if (barberData?.id) {
                    const { data: existingServices, error: servicesError } = await supabase
                        .from('services')
                        .select('name, price, duration')
                        .eq('barber_id', barberData.id);

                    if (servicesError) {
                        logger.error('Error fetching services:', servicesError);
                    } else if (Array.isArray(existingServices)) {
                        services = existingServices.map(s => ({
                            name: s.name || '',
                            price: typeof s.price === 'number' ? s.price : 0,
                            duration: typeof s.duration === 'number' ? s.duration : 30,
                        }));
                    }
                }

                setFormData(prev => ({
                    ...prev,
                    phone: profile?.phone || '',
                    location: profile?.location || '',
                    services,
                    stripeConnected: barberData?.stripe_account_status === 'active'
                }));

                if (barberData?.stripe_account_id) {
                    setStripeStatus(barberData?.stripe_account_status || null);
                } else {
                    setStripeStatus(null);
                }
            } catch (error) {
                logger.error('Error fetching profile data:', error);
            }
        };

        if (user) {
            fetchProfileData();
        }
    }, [user]);

    // Check if onboarding is already complete
    useEffect(() => {
        const checkOnboardingComplete = async () => {
            if (!user) return;
            
            try {
                // Checking if onboarding is already complete
                
                // Fetch barber data to check completion
                const { data: barberData, error: barberError } = await supabase
                    .from('barbers')
                    .select('onboarding_complete, business_name, bio, specialties')
                    .eq('user_id', user.id)
                    .single();

                if (barberError) {
                    logger.error('Error checking onboarding status:', barberError);
                    return;
                }

                // Onboarding completion check

                // If onboarding is marked as complete, skip to main app
                if (barberData?.onboarding_complete) {
                    logger.log('Onboarding is already complete - redirecting to main app');
                    setOnboardingComplete(true);
                    navigation.navigate('MainTabs' as any);
                    return;
                }
            } catch (error) {
                logger.error('Error checking onboarding completion:', error);
            }
        };

        if (user) {
            checkOnboardingComplete();
        }
    }, [user, navigation]);

    // Check if user is a barber
    useEffect(() => {
        if (user && userProfile?.role !== 'barber') {
            logger.log('User is not a barber, redirecting to home');
            navigation.navigate('Home');
        }
    }, [user, userProfile, navigation]);

    // Check Stripe status when user returns to the app (e.g., from Stripe onboarding)
    useFocusEffect(
        useCallback(() => {
            const checkStripeStatus = async () => {
                if (!user) return;
                
                try {
                    const { data: barber, error } = await supabase
                        .from('barbers')
                        .select('stripe_account_id, stripe_account_status, stripe_account_ready')
                        .eq('user_id', user.id)
                        .single();
                    
                    if (error) {
                        logger.error('Error checking Stripe status:', error);
                        return;
                    }
                    
                    if (barber?.stripe_account_id && (barber.stripe_account_ready || barber.stripe_account_status === 'active')) {
                        logger.log('Stripe account is ready');
                        
                        // Update form data to reflect Stripe is connected
                        setFormData(prev => ({ ...prev, stripeConnected: true }));
                        setStripeStatus(barber.stripe_account_status);
                        
                        // Show success message
                        Alert.alert(
                            'Payment Setup Complete!',
                            'Your Stripe account has been successfully connected. You can now receive payments.',
                            [
                                {
                                    text: 'Continue',
                                    onPress: () => {
                                        // Navigate to main app or continue with onboarding
                                        if (currentStep === steps.length - 1) {
                                            // If we're on the last step, complete onboarding
                                            setOnboardingComplete(true);
                                            navigation.navigate('MainTabs' as any);
                                        }
                                    }
                                }
                            ]
                        );
                    }
                } catch (error) {
                    logger.error('Error in checkStripeStatus:', error);
                }
            };
            
            // Check immediately when focus is gained
            checkStripeStatus();
            
            // Also check after a short delay to catch any delayed updates
            const delayedCheck = setTimeout(checkStripeStatus, 2000);
            
            return () => clearTimeout(delayedCheck);
        }, [user, currentStep, navigation])
    );

    // Also check Stripe status when app comes back to foreground
    useEffect(() => {
        const handleAppStateChange = (nextAppState: string) => {
            if (nextAppState === 'active' && user) {
                // App came back to foreground, check Stripe status
                const checkStripeStatus = async () => {
                    try {
                        const { data: barber, error } = await supabase
                            .from('barbers')
                            .select('stripe_account_id, stripe_account_status, stripe_account_ready')
                            .eq('user_id', user.id)
                            .single();
                        
                        if (error) {
                            logger.error('Error checking Stripe status on app state change:', error);
                            return;
                        }
                        
                        if (barber?.stripe_account_id && (barber.stripe_account_ready || barber.stripe_account_status === 'active')) {
                            logger.log('Stripe account is ready (app state change)');
                            
                            // Update form data to reflect Stripe is connected
                            setFormData(prev => ({ ...prev, stripeConnected: true }));
                            setStripeStatus(barber.stripe_account_status);
                        }
                    } catch (error) {
                        logger.error('Error in app state change Stripe check:', error);
                    }
                };
                
                checkStripeStatus();
            }
        };

        const subscription = AppState.addEventListener('change', handleAppStateChange);
        return () => subscription?.remove();
    }, [user]);

    const validateStep = async (stepIndex: number): Promise<boolean> => {
        const errors: ValidationErrors = {};
        const step = steps[stepIndex];

        if (step.id === 'business') {
            if (!formData.businessName.trim()) {
                errors.businessName = 'Business name is required';
            }
            if (!formData.phone.trim()) {
                errors.phone = 'Phone number is required';
            }
            if (!formData.location.trim()) {
                errors.location = 'Location is required';
            }
            if (!formData.bio.trim()) {
                errors.bio = 'Bio is required';
            }
            if (formData.specialties.length === 0) {
                errors.specialties = 'At least one specialty is required';
            }

            // Phone validation (basic US format)
            if (formData.phone) {
                const phoneRegex = /^[\+]?[1-9][\d]{0,15}$/;
                const cleanedPhone = formData.phone.replace(/[\s\-\(\)]/g, '');
                if (!phoneRegex.test(cleanedPhone)) {
                    errors.phone = 'Please enter a valid phone number';
                }
            }
        } else if (step.id === 'services') {
            if (formData.services.length === 0) {
                errors.services = 'At least one service is required';
            } else {
                formData.services.forEach((service, index) => {
                    if (!service.name.trim()) {
                        errors[`services.${index}.name`] = 'Service name is required';
                    }
                    if (!service.price || service.price <= 0) {
                        errors[`services.${index}.price`] = 'Valid price is required';
                    }
                    if (!service.duration || service.duration < 1) {
                        errors[`services.${index}.duration`] = 'Duration must be at least 1 minute';
                    }
                });
            }
        } else if (step.id === 'stripe') {
            // Stripe step is optional - no validation required
            // Users can skip payment setup and complete it later
        }

        setValidationErrors(errors);
        return Object.keys(errors).length === 0;
    };

    const handleChange = (field: string, value: string | string[] | number) => {
        setFormData(prev => ({
            ...prev,
            [field]: value
        }));
        
        if (validationErrors[field]) {
            setValidationErrors(prev => {
                const newErrors = { ...prev };
                delete newErrors[field];
                return newErrors;
            });
        }
    };

    const handleSpecialtiesChange = (specialties: string[]) => {
        handleChange('specialties', specialties);
    };

    const handleServiceChange = (index: number, field: string, value: string | number) => {
        setFormData(prev => ({
            ...prev,
            services: prev.services.map((service, i) => 
                i === index ? { ...service, [field]: value } : service
            )
        }));
    };

    const addService = () => {
        setFormData(prev => ({
            ...prev,
            services: [...prev.services, { name: '', price: 0, duration: 30 }]
        }));
    };

    const removeService = (index: number) => {
        setFormData(prev => ({
            ...prev,
            services: prev.services.filter((_, i) => i !== index)
        }));
    };

    const handleSocialMediaUpdate = (socialData: {
        instagram: string;
        twitter: string;
        tiktok: string;
        facebook: string;
    }) => {
        setFormData(prev => ({
            ...prev,
            socialMedia: socialData
        }));
    };

    const handleSubmit = async () => {
        if (loading) return;

        const isValid = await validateStep(currentStep);
        if (!isValid) {
            Alert.alert('Validation Error', 'Please fix the errors before continuing.');
            return;
        }

        if (currentStep < steps.length - 1) {
            setCurrentStep(currentStep + 1);
            return;
        }

        // Final submission
        setLoading(true);
        try {
            logger.log('Submitting onboarding data');

            // Single upsert operation for barber profile
            if (user?.role === 'barber') {
                // Upserting barber profile for user
                
                // Check if barber row exists
                const { data: existingBarber, error: checkError } = await supabase
                    .from('barbers')
                    .select('id')
                    .eq('user_id', user.id)
                    .single();

                if (existingBarber) {
                    // Barber row already exists - updating
                } else {
                    // Creating new barber row
                }

                const { error: upsertError } = await supabase
                    .from('barbers')
                    .upsert({
                        user_id: user.id,
                        business_name: formData.businessName,
                        bio: formData.bio,
                        specialties: formData.specialties,
                        instagram: extractHandle(formData.socialMedia.instagram),
                        twitter: extractHandle(formData.socialMedia.twitter),
                        tiktok: extractHandle(formData.socialMedia.tiktok),
                        facebook: extractHandle(formData.socialMedia.facebook),
                        onboarding_complete: true,
                        updated_at: new Date().toISOString(),
                    }, { onConflict: 'user_id' });

                if (upsertError) {
                    logger.error('Failed to upsert barber profile during onboarding:', upsertError);
                    throw upsertError;
                }
            }

            // Update phone and location in profiles table
            const { error: profileError } = await supabase
                .from('profiles')
                .update({
                    phone: formData.phone,
                    location: formData.location,
                    updated_at: new Date().toISOString()
                })
                .eq('id', user?.id);

            if (profileError) {
                logger.error('Profile update error:', profileError);
                throw new Error('Failed to update profile');
            }

            // Handle services
            if (formData.services.length > 0) {
                // Get barber ID for services
                const { data: barberData, error: barberError } = await supabase
                    .from('barbers')
                    .select('id')
                    .eq('user_id', user?.id)
                    .single();

                if (barberError) {
                    logger.error('Error getting barber ID for services:', barberError);
                    throw new Error('Failed to get barber ID');
                }

                // Delete existing services
                await supabase
                    .from('services')
                    .delete()
                    .eq('barber_id', barberData.id);

                // Insert new services
                const servicesToInsert = formData.services.map(service => ({
                    barber_id: barberData.id,
                    name: service.name,
                    price: service.price,
                    duration: service.duration
                }));

                const { error: servicesError } = await supabase
                    .from('services')
                    .insert(servicesToInsert);

                if (servicesError) {
                    logger.error('Error updating services:', servicesError);
                    throw new Error('Failed to update services');
                }
            }

            logger.log('Onboarding completed successfully');
            setOnboardingComplete(true);
            
            // Check if Stripe is connected to determine navigation
            if (formData.stripeConnected) {
                // If Stripe is connected, show completion message and go to settings
                Alert.alert(
                    'Onboarding Complete!',
                    'Your profile is fully set up and ready to receive payments. Welcome to the platform!',
                    [
                        {
                            text: 'Go to Main App',
                            onPress: () => {
                                navigation.navigate('MainTabs' as any);
                            }
                        }
                    ]
                );
            } else {
                // If Stripe is not connected, go to main app
                navigation.navigate('MainTabs' as any);
            }
            
        } catch (error) {
            logger.error('Error during onboarding submission:', error);
            Alert.alert('Error', 'Failed to save your information. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const handleStripeConnect = async () => {
        if (stripeLoading) return;
        
        setStripeLoading(true);
        
        // Add a timeout to prevent infinite loading
        const timeoutId = setTimeout(() => {
            logger.log('Stripe Connect timeout - resetting loading state');
            setStripeLoading(false);
        }, 30000); // 30 second timeout
        
        try {
            logger.log('Starting Stripe Connect process');
            
            // First, get the barber ID for this user
            const { data: barber, error: barberError } = await supabase
                .from('barbers')
                .select('id')
                .eq('user_id', user?.id)
                .single();
            
            if (barberError || !barber) {
                throw new Error('Barber profile not found. Please complete your profile first.');
            }
            
            const requestBody = { 
                barberId: barber.id,
                email: user?.email
            };
            
            // Call the Supabase Edge Function directly with user session
            const { data: stripeResponse, error } = await supabase.functions.invoke('stripe-connect', {
                body: requestBody,
                headers: {
                    Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`
                }
            });
            
            if (error) {
                logger.error('Supabase function error:', error);
                throw new Error(error.message || 'Failed to connect Stripe account');
            }
            
            // Use the response data directly
            const data = stripeResponse;

            if (data.url) {
                // Open Stripe onboarding in browser
                const result = await WebBrowser.openBrowserAsync(data.url);
                
                // After browser closes, check if Stripe account is now active
                // Check the Stripe account status directly from database
                try {
                    
                    const { data: updatedBarber, error: statusError } = await supabase
                        .from('barbers')
                        .select('stripe_account_id, stripe_account_status, stripe_account_ready')
                        .eq('id', barber.id)
                        .single();
                    
                    if (statusError) {
                        logger.error('Error checking barber status:', statusError);
                        throw new Error('Could not check Stripe account status');
                    }
                    
                    if (updatedBarber?.stripe_account_id) {
                        // Stripe account ID exists in database
                        // Check if account is ready (you can add more sophisticated checks here)
                        if (updatedBarber.stripe_account_ready || updatedBarber.stripe_account_status === 'active') {
                            logger.log('Stripe account is ready and active');
                            
                            // Mark onboarding as complete
                            setFormData(prev => ({ ...prev, stripeConnected: true }));
                            setOnboardingComplete(true);
                            
                            // Show success message
                            Alert.alert(
                                'Payment Setup Complete!',
                                'Your Stripe account has been successfully connected. You can now receive payments.',
                                [
                                    {
                                        text: 'Go to Main App',
                                        onPress: () => {
                                            // Navigate to main app
                                            navigation.navigate('MainTabs' as any);
                                        }
                                    }
                                ]
                            );
                        } else {
                            // Stripe account exists but not fully set up
                            logger.log('Stripe account exists but not fully set up');
                            Alert.alert(
                                'Setup In Progress',
                                'Your Stripe account has been created but setup is still in progress. You can complete it later in your settings.',
                                [
                                    {
                                        text: 'Continue',
                                        onPress: () => {
                                            setFormData(prev => ({ ...prev, stripeConnected: false }));
                                        }
                                    }
                                ]
                            );
                        }
                    } else {
                        // No Stripe account ID found
                        logger.log('No Stripe account ID found in database');
                        Alert.alert(
                            'Setup In Progress',
                            'Your Stripe account setup is in progress. You can complete it later in your settings.',
                            [
                                {
                                    text: 'Continue',
                                    onPress: () => {
                                        setFormData(prev => ({ ...prev, stripeConnected: false }));
                                    }
                                }
                            ]
                        );
                    }
                } catch (statusError) {
                    logger.error('Error checking Stripe status:', statusError);
                    Alert.alert(
                        'Setup In Progress',
                        'Your Stripe account setup is in progress. You can complete it later in your settings.',
                        [
                            {
                                text: 'Continue',
                                onPress: () => {
                                    setFormData(prev => ({ ...prev, stripeConnected: false }));
                                }
                            }
                        ]
                    );
                }
            } else {
                throw new Error('No redirect URL received from Stripe');
            }
        } catch (error) {
            logger.error('Error creating Stripe account:', error);
            Alert.alert('Error', error instanceof Error ? error.message : 'Failed to connect Stripe account. Please try again.');
        } finally {
            clearTimeout(timeoutId);
            setStripeLoading(false);
        }
    };

    const handleSkip = async () => {
        Alert.alert(
            'Skip Payment Setup?',
            'You can always set up payments later in your settings. Are you sure you want to skip this step?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Skip',
                    style: 'destructive',
                    onPress: () => {
                        setFormData(prev => ({ ...prev, stripeConnected: false }));
                        handleSubmit();
                    }
                }
            ]
        );
    };

    const getProgressPercentage = () => {
        // If Stripe is connected, show 100% completion
        if (formData.stripeConnected) {
            return 100;
        }
        // Otherwise, calculate based on current step
        return ((currentStep + 1) / steps.length) * 100;
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

    const renderStep = () => {
        const step = steps[currentStep];
        const Icon = step.icon;

        switch (step.id) {
            case 'business':
                return (
                    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={tw`pb-24`}>
                        {/* Business Information */}
                        <Card style={[tw`mb-6`, { backgroundColor: 'rgba(255,255,255,0.05)', borderColor: 'rgba(255,255,255,0.1)' }]}>
                            <CardContent style={tw`p-4`}>
                                <View style={tw`flex-row items-center mb-4`}>
                                    <Building size={20} color={theme.colors.secondary} style={tw`mr-2`} />
                                    <Text style={[tw`text-lg font-semibold`, { color: theme.colors.foreground }]}>
                                        Business Information
                                    </Text>
                                </View>

                                <InputField
                                    label="Business Name *"
                                    value={formData.businessName}
                                    onChangeText={(text: string) => handleChange('businessName', text)}
                                    placeholder="Enter your business name"
                                    icon={Building}
                                    error={validationErrors.businessName}
                                />

                                <InputField
                                    label="Phone Number *"
                                    value={formData.phone}
                                    onChangeText={(text: string) => handleChange('phone', text)}
                                    placeholder="(555) 123-4567"
                                    keyboardType="phone-pad"
                                    icon={Phone}
                                    error={validationErrors.phone}
                                />

                                <View style={tw`mb-4`}>
                                    <View style={tw`flex-row items-center mb-2`}>
                                        <MapPin size={16} color={theme.colors.secondary} style={tw`mr-2`} />
                                        <Text style={[tw`text-sm font-medium`, { color: theme.colors.foreground }]}>
                                            Location *
                                        </Text>
                                    </View>
                                    <LocationInput
                                        value={formData.location}
                                        onChange={(value: string) => handleChange('location', value)}
                                        placeholder="Enter your business location..."
                                        error={validationErrors.location}
                                    />
                                </View>

                                <InputField
                                    label="Bio *"
                                    value={formData.bio}
                                    onChangeText={(text: string) => handleChange('bio', text)}
                                    placeholder="Tell us about your business, experience, and what makes you unique..."
                                    multiline
                                    error={validationErrors.bio}
                                    description={`${formData.bio.length}/500 characters`}
                                />
                            </CardContent>
                        </Card>

                        {/* Specialties */}
                        <Card style={[tw`mb-6`, { backgroundColor: 'rgba(255,255,255,0.05)', borderColor: 'rgba(255,255,255,0.1)' }]}>
                            <CardContent style={tw`p-4`}>
                                <View style={tw`flex-row items-center mb-4`}>
                                    <Sparkles size={20} color={theme.colors.secondary} style={tw`mr-2`} />
                                    <Text style={[tw`text-lg font-semibold`, { color: theme.colors.foreground }]}>
                                        Specialties
                                    </Text>
                                </View>

                                <View style={tw`mb-4`}>
                                    <Text style={[tw`text-sm font-medium mb-2`, { color: theme.colors.foreground }]}>
                                        Select your specialties *
                                    </Text>
                                    <SpecialtyAutocomplete
                                        value={formData.specialties}
                                        onChange={handleSpecialtiesChange}
                                        placeholder="Select your specialties..."
                                        maxSelections={15}
                                    />
                                    <Text style={[tw`text-xs mt-2`, { color: theme.colors.mutedForeground }]}>
                                        List your specialties to help clients find you
                                    </Text>
                                    {validationErrors.specialties && (
                                        <Text style={[tw`text-xs mt-1`, { color: theme.colors.destructive }]}>
                                            {validationErrors.specialties}
                                        </Text>
                                    )}
                                </View>
                            </CardContent>
                        </Card>

                        {/* Social Media */}
                        <Card style={[tw`mb-6`, { backgroundColor: 'rgba(255,255,255,0.05)', borderColor: 'rgba(255,255,255,0.1)' }]}>
                            <CardContent style={tw`p-4`}>
                                <View style={tw`flex-row items-center mb-4`}>
                                    <Instagram size={20} color={theme.colors.secondary} style={tw`mr-2`} />
                                    <Text style={[tw`text-lg font-semibold`, { color: theme.colors.foreground }]}>
                                        Social Media (Optional)
                                    </Text>
                                </View>
                                <Text style={[tw`text-sm mb-4`, { color: theme.colors.mutedForeground }]}>
                                    Add your social media handles to help clients connect with you
                                </Text>

                                <View style={tw`space-y-4`}>
                                    <InputField
                                        label="Instagram"
                                        value={formData.socialMedia.instagram}
                                        onChangeText={(text: string) => handleSocialMediaUpdate({
                                            ...formData.socialMedia,
                                            instagram: text
                                        })}
                                        placeholder="@yourusername"
                                        description="Only your handle (e.g., @yourusername)"
                                    />

                                    <InputField
                                        label="Twitter/X"
                                        value={formData.socialMedia.twitter}
                                        onChangeText={(text: string) => handleSocialMediaUpdate({
                                            ...formData.socialMedia,
                                            twitter: text
                                        })}
                                        placeholder="@yourusername"
                                        description="Only your handle (e.g., @yourusername)"
                                    />

                                    <InputField
                                        label="TikTok"
                                        value={formData.socialMedia.tiktok}
                                        onChangeText={(text: string) => handleSocialMediaUpdate({
                                            ...formData.socialMedia,
                                            tiktok: text
                                        })}
                                        placeholder="@yourusername"
                                        description="Only your handle (e.g., @yourusername)"
                                    />

                                    <InputField
                                        label="Facebook"
                                        value={formData.socialMedia.facebook}
                                        onChangeText={(text: string) => handleSocialMediaUpdate({
                                            ...formData.socialMedia,
                                            facebook: text
                                        })}
                                        placeholder="yourpagename"
                                        description="Only your page name (e.g., yourpagename)"
                                    />
                                </View>
                            </CardContent>
                        </Card>
                    </ScrollView>
                );

            case 'services':
                return (
                    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={tw`pb-24`}>
                        <Card style={[tw`mb-6`, { backgroundColor: 'rgba(255,255,255,0.05)', borderColor: 'rgba(255,255,255,0.1)' }]}>
                            <CardContent style={tw`p-4`}>
                                <View style={tw`flex-row items-center mb-4`}>
                                    <Scissors size={20} color={theme.colors.secondary} style={tw`mr-2`} />
                                    <Text style={[tw`text-lg font-semibold`, { color: theme.colors.foreground }]}>
                                        Services & Pricing
                                    </Text>
                                </View>
                                <Text style={[tw`text-sm mb-4`, { color: theme.colors.mutedForeground }]}>
                                    Set up your services and pricing to start accepting bookings
                                </Text>

                                <View style={tw`space-y-6`}>
                                    {formData.services.map((service, index) => (
                                        <View key={index} style={[
                                            tw`p-4 rounded-xl`,
                                            { backgroundColor: 'rgba(255,255,255,0.03)' }
                                        ]}>
                                            <View style={tw`flex-row items-center justify-between mb-4`}>
                                                <View style={tw`flex-row items-center`}>
                                                    <View style={[
                                                        tw`w-8 h-8 rounded-lg items-center justify-center mr-3`,
                                                        { backgroundColor: 'rgba(255,255,255,0.1)' }
                                                    ]}>
                                                        <Text style={[tw`text-sm font-bold`, { color: theme.colors.secondary }]}>
                                                            {index + 1}
                                                        </Text>
                                                    </View>
                                                    <Text style={[tw`text-base font-semibold`, { color: theme.colors.foreground }]}>
                                                        Service {index + 1}
                                                    </Text>
                                                </View>
                                                {formData.services.length > 1 && (
                                                    <TouchableOpacity
                                                        onPress={() => removeService(index)}
                                                        style={[
                                                            tw`p-2 rounded-lg`,
                                                            { backgroundColor: 'rgba(239, 68, 68, 0.2)' }
                                                        ]}
                                                    >
                                                        <Trash2 size={16} color={theme.colors.destructive} />
                                                    </TouchableOpacity>
                                                )}
                                            </View>

                                            <InputField
                                                label="Service Name *"
                                                value={service.name}
                                                onChangeText={(text: string) => handleServiceChange(index, 'name', text)}
                                                placeholder="e.g., Haircut, Beard Trim, Fade"
                                                error={validationErrors[`services.${index}.name`]}
                                            />

                                            <View style={tw`flex-row space-x-4`}>
                                                <View style={tw`flex-1`}>
                                                    <Text style={[tw`text-sm font-medium mb-2`, { color: theme.colors.foreground }]}>
                                                        Price ($) *
                                                    </Text>
                                                    <View style={tw`relative`}>
                                                        <Text style={[
                                                            tw`absolute left-4 top-3 text-base`,
                                                            { color: theme.colors.mutedForeground }
                                                        ]}>
                                                            $
                                                        </Text>
                                                        <TextInput
                                                            style={[
                                                                tw`px-4 py-3 rounded-xl text-base pl-8`,
                                                                { 
                                                                    backgroundColor: 'rgba(255,255,255,0.05)', 
                                                                    color: theme.colors.foreground,
                                                                    borderWidth: 1,
                                                                    borderColor: validationErrors[`services.${index}.price`] ? theme.colors.destructive : 'rgba(255,255,255,0.1)'
                                                                }
                                                            ]}
                                                            placeholder="30"
                                                            placeholderTextColor={theme.colors.mutedForeground}
                                                            value={service.price.toString()}
                                                            onChangeText={(text) => handleServiceChange(index, 'price', parseFloat(text) || 0)}
                                                            keyboardType="numeric"
                                                        />
                                                    </View>
                                                    {validationErrors[`services.${index}.price`] && (
                                                        <Text style={[tw`text-xs mt-1`, { color: theme.colors.destructive }]}>
                                                            {validationErrors[`services.${index}.price`]}
                                                        </Text>
                                                    )}
                                                </View>
                                                <View style={tw`flex-1`}>
                                                    <Text style={[tw`text-sm font-medium mb-2`, { color: theme.colors.foreground }]}>
                                                        Duration (min) *
                                                    </Text>
                                                    <TextInput
                                                        style={[
                                                            tw`px-4 py-3 rounded-xl text-base`,
                                                            { 
                                                                backgroundColor: 'rgba(255,255,255,0.05)', 
                                                                color: theme.colors.foreground,
                                                                borderWidth: 1,
                                                                borderColor: validationErrors[`services.${index}.duration`] ? theme.colors.destructive : 'rgba(255,255,255,0.1)'
                                                            }
                                                        ]}
                                                        placeholder="30"
                                                        placeholderTextColor={theme.colors.mutedForeground}
                                                        value={service.duration.toString()}
                                                        onChangeText={(text) => handleServiceChange(index, 'duration', parseInt(text) || 0)}
                                                        keyboardType="numeric"
                                                    />
                                                    {validationErrors[`services.${index}.duration`] && (
                                                        <Text style={[tw`text-xs mt-1`, { color: theme.colors.destructive }]}>
                                                            {validationErrors[`services.${index}.duration`]}
                                                        </Text>
                                                    )}
                                                </View>
                                            </View>
                                        </View>
                                    ))}
                                    
                                    <TouchableOpacity
                                        onPress={addService}
                                        style={[
                                            tw`flex-row items-center justify-center p-4 rounded-xl border-2 border-dashed`,
                                            { borderColor: 'rgba(255,255,255,0.3)' }
                                        ]}
                                    >
                                        <View style={[
                                            tw`w-8 h-8 rounded-lg items-center justify-center mr-3`,
                                            { backgroundColor: 'rgba(255,255,255,0.1)' }
                                        ]}>
                                            <Plus size={16} color={theme.colors.secondary} />
                                        </View>
                                        <Text style={[tw`font-semibold text-base`, { color: theme.colors.secondary }]}>
                                            Add Another Service
                                        </Text>
                                    </TouchableOpacity>
                                </View>
                            </CardContent>
                        </Card>
                    </ScrollView>
                );

            case 'stripe':
                return (
                    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={tw`pb-24`}>
                        <Card style={[tw`mb-6`, { backgroundColor: 'rgba(255,255,255,0.05)', borderColor: 'rgba(255,255,255,0.1)' }]}>
                            <CardContent style={tw`p-4`}>
                                <View style={tw`flex-row items-center mb-4`}>
                                    <CreditCard size={20} color={theme.colors.secondary} style={tw`mr-2`} />
                                    <Text style={[tw`text-lg font-semibold`, { color: theme.colors.foreground }]}>
                                        Payment Setup
                                    </Text>
                                </View>
                                <Text style={[tw`text-sm mb-4`, { color: theme.colors.mutedForeground }]}>
                                    Connect your Stripe account to start accepting payments
                                </Text>

                                <View style={[
                                    tw`p-4 rounded-xl`,
                                    { backgroundColor: 'rgba(255,255,255,0.03)' }
                                ]}>
                                    <View style={tw`flex-row items-center mb-4`}>
                                        <View style={[
                                            tw`w-12 h-12 rounded-xl items-center justify-center mr-4`,
                                            { backgroundColor: 'rgba(255,255,255,0.1)' }
                                        ]}>
                                            <CreditCard size={24} color={theme.colors.secondary} />
                                        </View>
                                        <View style={tw`flex-1`}>
                                            <Text style={[tw`text-lg font-bold`, { color: theme.colors.foreground }]}>
                                                Stripe Connect
                                            </Text>
                                            <Text style={[tw`text-sm`, { color: theme.colors.mutedForeground }]}>
                                                Secure payment processing
                                            </Text>
                                        </View>
                                    </View>
                                    
                                    <View style={tw`space-y-3 mb-6`}>
                                        <View style={tw`flex-row items-start`}>
                                            <View style={[
                                                tw`w-6 h-6 rounded-full items-center justify-center mr-3 mt-0.5`,
                                                { backgroundColor: 'rgba(34, 197, 94, 0.2)' }
                                            ]}>
                                                <Text style={[tw`text-xs font-bold`, { color: '#22c55e' }]}>✓</Text>
                                            </View>
                                            <Text style={[tw`text-sm flex-1`, { color: theme.colors.foreground }]}>
                                                Accept credit card and digital wallet payments
                                            </Text>
                                        </View>
                                        
                                        <View style={tw`flex-row items-start`}>
                                            <View style={[
                                                tw`w-6 h-6 rounded-full items-center justify-center mr-3 mt-0.5`,
                                                { backgroundColor: 'rgba(34, 197, 94, 0.2)' }
                                            ]}>
                                                <Text style={[tw`text-xs font-bold`, { color: '#22c55e' }]}>✓</Text>
                                            </View>
                                            <Text style={[tw`text-sm flex-1`, { color: theme.colors.foreground }]}>
                                                Automatic payouts to your bank account
                                            </Text>
                                        </View>
                                        
                                        <View style={tw`flex-row items-start`}>
                                            <View style={[
                                                tw`w-6 h-6 rounded-full items-center justify-center mr-3 mt-0.5`,
                                                { backgroundColor: 'rgba(34, 197, 94, 0.2)' }
                                            ]}>
                                                <Text style={[tw`text-xs font-bold`, { color: '#22c55e' }]}>✓</Text>
                                            </View>
                                            <Text style={[tw`text-sm flex-1`, { color: theme.colors.foreground }]}>
                                                Industry-leading security and fraud protection
                                            </Text>
                                        </View>
                                    </View>
                                    
                                    <TouchableOpacity
                                        onPress={handleStripeConnect}
                                        disabled={stripeLoading}
                                        style={[
                                            tw`flex-row items-center justify-center py-3 px-6 rounded-xl`,
                                            { backgroundColor: theme.colors.secondary }
                                        ]}
                                    >
                                        {stripeLoading ? (
                                            <ActivityIndicator color={theme.colors.primaryForeground} />
                                        ) : (
                                            <>
                                                <CreditCard size={20} color={theme.colors.primaryForeground} style={tw`mr-3`} />
                                                <Text style={[tw`font-semibold text-base`, { color: theme.colors.primaryForeground }]}>
                                                    Connect Stripe Account
                                                </Text>
                                            </>
                                        )}
                                    </TouchableOpacity>
                                </View>
                                
                                {/* Skip Option */}
                                <View style={[
                                    tw`p-4 rounded-xl mt-4`,
                                    { backgroundColor: 'rgba(255,255,255,0.03)' }
                                ]}>
                                    <Text style={[tw`text-sm text-center`, { color: theme.colors.mutedForeground }]}>
                                        You can always set up payments later in your settings
                                    </Text>
                                </View>
                            </CardContent>
                        </Card>
                    </ScrollView>
                );

            default:
                return null;
        }
    };

    return (
        <SafeAreaView style={[tw`flex-1`, { backgroundColor: theme.colors.background }]}>
            <StatusBar barStyle="light-content" />
            
            {/* Header - Reduced spacing */}
            <View style={tw`px-6 pt-4 pb-2`}>
                <View style={tw`items-center mb-3`}>
                    <View style={[tw`p-3 rounded-full mb-2`, { backgroundColor: theme.colors.secondary + '20' }]}>
                        {React.createElement(steps[currentStep].icon, { 
                            size: 24, 
                            color: theme.colors.secondary 
                        })}
                    </View>
                    <Text style={[tw`text-xl font-bold`, { color: theme.colors.foreground }]}>
                        {steps[currentStep].title}
                    </Text>
                    <Text style={[tw`text-xs mt-1`, { color: theme.colors.mutedForeground }]}>
                        {steps[currentStep].description}
                    </Text>
                </View>
            </View>

            {/* Progress Section - More compact */}
            <View style={tw`mx-6 mb-3`}>
                <Card style={[{ backgroundColor: 'rgba(255,255,255,0.05)', borderColor: 'rgba(255,255,255,0.1)' }]}>
                    <CardContent style={tw`p-3`}>
                        <View style={tw`flex-row items-center justify-between mb-2`}>
                            <View style={tw`flex-row items-center`}>
                                <Sparkles size={14} color={theme.colors.secondary} style={tw`mr-2`} />
                                <Text style={[tw`text-xs font-medium`, { color: theme.colors.foreground }]}>
                                    Progress
                                </Text>
                            </View>
                            <View style={[tw`px-2 py-1 rounded-full`, { backgroundColor: theme.colors.secondary + '20' }]}>
                                <Text style={[tw`text-xs font-bold`, { color: theme.colors.secondary }]}>
                                    {Math.round(getProgressPercentage())}%
                                </Text>
                            </View>
                        </View>
                        
                        <View style={[tw`h-2 rounded-full overflow-hidden`, { backgroundColor: 'rgba(255,255,255,0.1)' }]}>
                            <View 
                                style={[
                                    tw`h-full rounded-full`,
                                    { width: `${getProgressPercentage()}%`, backgroundColor: theme.colors.secondary }
                                ]} 
                            />
                        </View>
                        
                        <View style={tw`flex-row items-center justify-between mt-2`}>
                            {steps.map((step, idx) => {
                                const Icon = step.icon;
                                const isActive = currentStep === idx;
                                const isCompleted = currentStep > idx;
                                
                                return (
                                    <View key={step.id} style={tw`flex-1 flex-col items-center`}>
                                        <View style={[
                                            tw`rounded-full border-2 w-6 h-6 items-center justify-center mb-1`,
                                            isActive ? 
                                                { borderColor: theme.colors.secondary, backgroundColor: 'rgba(255,255,255,0.2)' } :
                                            isCompleted ?
                                                { borderColor: theme.colors.secondary, backgroundColor: theme.colors.secondary } :
                                                { borderColor: 'rgba(255,255,255,0.2)', backgroundColor: 'rgba(255,255,255,0.1)' }
                                        ]}>
                                            {isCompleted ? (
                                                <CheckCircle size={12} color={theme.colors.primaryForeground} />
                                            ) : (
                                                <Icon 
                                                    size={12} 
                                                    color={isActive ? theme.colors.secondary : 'rgba(255,255,255,0.6)'} 
                                                />
                                            )}
                                        </View>
                                        <Text style={[
                                            tw`text-xs text-center`,
                                            { color: isActive || isCompleted ? theme.colors.secondary : 'rgba(255,255,255,0.6)' }
                                        ]}>
                                            {step.title}
                                        </Text>
                                    </View>
                                );
                            })}
                        </View>
                    </CardContent>
                </Card>
            </View>

            {/* Onboarding Complete Banner - More compact */}
            {onboardingComplete && showCompleteBanner && (
                <View style={tw`mx-6 mb-3`}>
                    <Card style={[{ backgroundColor: 'rgba(255,255,255,0.05)', borderColor: 'rgba(255,255,255,0.1)' }]}>
                        <CardContent style={tw`p-3`}>
                            <View style={tw`flex-row items-center justify-between mb-2`}>
                                <View style={tw`flex-row items-center`}>
                                    <CheckCircle size={16} color={theme.colors.secondary} style={tw`mr-2`} />
                                    <Text style={[tw`text-sm font-semibold`, { color: theme.colors.foreground }]}>
                                        Onboarding Complete!
                                    </Text>
                                </View>
                                <TouchableOpacity
                                    onPress={() => setShowCompleteBanner(false)}
                                >
                                    <X size={16} color={theme.colors.mutedForeground} />
                                </TouchableOpacity>
                            </View>
                            <Text style={[tw`text-xs`, { color: theme.colors.mutedForeground }]}>
                                Your profile is ready. You can now receive bookings and payments. Welcome to the platform!
                            </Text>
                            <TouchableOpacity
                                style={[
                                    tw`mt-3 py-2 rounded-xl`,
                                    { backgroundColor: theme.colors.secondary }
                                ]}
                                onPress={() => navigation.navigate('MainTabs' as any)}
                            >
                                <Text style={[tw`text-center font-medium text-sm`, { color: theme.colors.primaryForeground }]}>
                                    Go to Profile
                                </Text>
                            </TouchableOpacity>
                        </CardContent>
                    </Card>
                </View>
            )}

            {/* Main Content - Takes up most of the space */}
            <KeyboardAvoidingView 
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={tw`flex-1`}
            >
                <View style={tw`px-6 flex-1`}>
                    {renderStep()}
                </View>
            </KeyboardAvoidingView>

            {/* Navigation Buttons - More compact */}
            <View style={tw`px-6 py-3 border-t border-white/10`}>
                <View style={tw`flex-row justify-between items-center gap-3`}>
                    <TouchableOpacity
                        style={[
                            tw`border border-secondary rounded-xl px-4 py-2.5 flex-1`,
                            { opacity: currentStep === 0 ? 0.5 : 1 }
                        ]}
                        onPress={() => setCurrentStep((prev) => Math.max(0, prev - 1))}
                        disabled={currentStep === 0}
                    >
                        <Text style={[tw`font-bold text-center text-sm`, { color: theme.colors.secondary }]}>
                            Back
                        </Text>
                    </TouchableOpacity>
                    
                    <TouchableOpacity
                        style={[
                            tw`bg-secondary rounded-xl px-6 py-2.5 flex-1`,
                            { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 4 }
                        ]}
                        onPress={async () => {
                            if (await validateStep(currentStep)) {
                                if (currentStep < steps.length - 1) {
                                    setCurrentStep((prev) => prev + 1)
                                } else {
                                    handleSubmit()
                                }
                            } else {
                                Alert.alert('Validation Error', 'Please fix the errors before continuing.');
                            }
                        }}
                        disabled={loading}
                    >
                        {loading ? (
                            <ActivityIndicator color={theme.colors.primaryForeground} />
                        ) : (
                            <Text style={[tw`text-base font-bold text-center`, { color: theme.colors.primaryForeground }]}>
                                {currentStep < steps.length - 1 ? 'Next' : 'Finish'}
                            </Text>
                        )}
                    </TouchableOpacity>
                </View>
            </View>
        </SafeAreaView>
    );
}