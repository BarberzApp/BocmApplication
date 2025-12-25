import React, { useState, useEffect, useCallback, useRef } from 'react';
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
import { 
    Card, 
    CardContent,
    Button,
    SectionHeader,
    NumericInput,
    ProgressIndicator,
    OnboardingInputField
} from '../shared/components/ui';
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
    Sparkles,
    Info
} from 'lucide-react-native';
import { SpecialtyAutocomplete } from '../shared/components/ui/SpecialtyAutocomplete';
import { SocialMediaLinks } from '../shared/components/ui/SocialMediaLinks';
import { LocationInput } from '../shared/components/ui/LocationInput';
import { BARBER_SPECIALTIES } from '../shared/utils/settings.utils';
import { runBarberPrefillOnce } from '../shared/helpers/barberPrefillHelper';
import { handleStripeConnect, checkStripeStatusOnce } from '../shared/helpers/barberStripeHelper';
import { addService as addServiceHelper, removeService as removeServiceHelper, updateService as updateServiceHelper, validateServices } from '../shared/helpers/barberServicesHelper';
import { validateStep as validateStepHelper } from '../shared/helpers/barberValidationHelper';
import { extractHandle } from '../shared/helpers/socialHandleHelper';
import { formatPhoneNumber } from '../shared/helpers/phoneFormatHelper';

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
    const prefillDoneRef = useRef(false);
    const phoneDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

    // Prefill form with existing data (single run via helper)
    useEffect(() => {
        // Reset prefill ref on mount to ensure it runs when navigating from settings
        prefillDoneRef.current = false;
        
        const prefill = async () => {
            if (!user || prefillDoneRef.current) return;
            await runBarberPrefillOnce({
                userId: user.id,
                userProfile,
                setFormData,
                setStripeStatus,
                prefillDoneRef,
            });
        };

        if (user) {
            prefill();
        }
    }, [user, userProfile]);

    useEffect(() => {
        return () => {
            if (phoneDebounceRef.current) {
                clearTimeout(phoneDebounceRef.current);
            }
        };
    }, []);

    // // Check if onboarding is already complete
    // useEffect(() => {
    //     const checkOnboardingComplete = async () => {
    //         if (!user) return;
            
    //         try {
    //             // Checking if onboarding is already complete
                
    //             // Fetch barber data to check completion
    //             const { data: barberData, error: barberError } = await supabase
    //                 .from('barbers')
    //                 .select('onboarding_complete, business_name, bio, specialties')
    //                 .eq('user_id', user.id)
    //                 .single();

    //             if (barberError) {
    //                 logger.error('Error checking onboarding status:', barberError);
    //                 return;
    //             }

    //             // Onboarding completion check

    //             // If onboarding is marked as complete, skip to main app
    //             if (barberData?.onboarding_complete) {
    //                 logger.log('Onboarding is already complete - redirecting to main app');
    //                 setOnboardingComplete(true);
    //                 navigation.navigate('MainTabs' as any);
    //                 return;
    //             }
    //         } catch (error) {
    //             logger.error('Error checking onboarding completion:', error);
    //         }
    //     };

    //     if (user) {
    //         checkOnboardingComplete();
    //     }
    // }, [user, navigation]);

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
            const checkStatus = async () => {
                if (!user) return;
                await checkStripeStatusOnce(user.id, setFormData, setStripeStatus);
            };
            checkStatus();
            const delayedCheck = setTimeout(checkStatus, 2000);
            return () => clearTimeout(delayedCheck);
        }, [user])
    );

    // Also check Stripe status when app comes back to foreground
    useEffect(() => {
        const handleAppStateChange = (nextAppState: string) => {
            if (nextAppState === 'active' && user) {
                checkStripeStatusOnce(user.id, setFormData, setStripeStatus);
            }
        };

        const subscription = AppState.addEventListener('change', handleAppStateChange);
        return () => subscription?.remove();
    }, [user]);

    const validateStep = async (stepIndex: number): Promise<boolean> => {
        const step = steps[stepIndex];
        const { errors, isValid } = validateStepHelper(step.id, formData);
        // Ensure specialty requirement message is preserved
        if (step.id === 'business' && !formData.specialties.length) {
            errors.specialties = errors.specialties || 'At least one specialty is required';
        }
        setValidationErrors(errors);
        return isValid;
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

    const handleServiceChange = (index: number, field: string, value: string | number) =>
        updateServiceHelper(index, field, value, setFormData);

    const addService = () => addServiceHelper(setFormData);

    const removeService = (index: number) => removeServiceHelper(index, setFormData);

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
            // Verify user is authenticated
            if (!user?.id) {
                throw new Error('User not authenticated. Please log in again.');
            }

            // Verify user session is active
            const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
            if (sessionError || !sessionData?.session) {
                logger.error('Session check failed:', sessionError);
                throw new Error('Session expired. Please log in again.');
            }

            logger.log('Submitting onboarding data', {
                userId: user.id,
                userRole: userProfile?.role,
                businessName: formData.businessName,
                servicesCount: formData.services.length
            });

            // Verify user is a barber
            if (userProfile?.role !== 'barber') {
                logger.error('User is not a barber:', { role: userProfile?.role });
                throw new Error('Only barbers can complete this onboarding process.');
            }

            // Upsert barber profile
            logger.log('Upserting barber profile...');
            const { data: upsertData, error: upsertError } = await supabase
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
                }, { 
                    onConflict: 'user_id',
                    ignoreDuplicates: false 
                })
                .select();

            if (upsertError) {
                logger.error('Failed to upsert barber profile during onboarding:', {
                    error: upsertError,
                    code: upsertError.code,
                    message: upsertError.message,
                    details: upsertError.details,
                    hint: upsertError.hint
                });
                throw new Error(`Failed to save barber profile: ${upsertError.message || 'Unknown error'}`);
            }

            if (!upsertData || upsertData.length === 0) {
                logger.error('Upsert returned no data');
                throw new Error('Failed to save barber profile: No data returned');
            }

            logger.log('Barber profile upserted successfully:', upsertData[0]?.id);

            // Update phone and location in profiles table
            logger.log('Updating profile information...');
            const { error: profileError } = await supabase
                .from('profiles')
                .update({
                    phone: formData.phone,
                    location: formData.location,
                    updated_at: new Date().toISOString()
                })
                .eq('id', user.id);

            if (profileError) {
                logger.error('Profile update error:', {
                    error: profileError,
                    code: profileError.code,
                    message: profileError.message
                });
                throw new Error(`Failed to update profile: ${profileError.message || 'Unknown error'}`);
            }

            logger.log('Profile updated successfully');

            // Handle services
            if (formData.services.length > 0) {
                logger.log('Updating services...', { count: formData.services.length });
                
                // Get barber ID for services
                const { data: barberData, error: barberError } = await supabase
                    .from('barbers')
                    .select('id')
                    .eq('user_id', user.id)
                    .single();

                if (barberError || !barberData) {
                    logger.error('Error getting barber ID for services:', barberError);
                    throw new Error(`Failed to get barber ID: ${barberError?.message || 'Unknown error'}`);
                }

                logger.log('Barber ID retrieved:', barberData.id);

                // Delete existing services
                const { error: deleteError } = await supabase
                    .from('services')
                    .delete()
                    .eq('barber_id', barberData.id);

                if (deleteError) {
                    logger.error('Error deleting existing services:', deleteError);
                    // Don't throw here - we can still insert new services
                    logger.warn('Continuing despite delete error');
                } else {
                    logger.log('Existing services deleted successfully');
                }

                // Insert new services
                const servicesToInsert = formData.services.map(service => ({
                    barber_id: barberData.id,
                    name: service.name,
                    price: service.price,
                    duration: service.duration
                }));

                const { data: insertedServices, error: servicesError } = await supabase
                    .from('services')
                    .insert(servicesToInsert)
                    .select();

                if (servicesError) {
                    logger.error('Error inserting services:', {
                        error: servicesError,
                        code: servicesError.code,
                        message: servicesError.message,
                        services: servicesToInsert
                    });
                    throw new Error(`Failed to save services: ${servicesError.message || 'Unknown error'}`);
                }

                logger.log('Services inserted successfully:', insertedServices?.length || 0);
            } else {
                logger.warn('No services to save');
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
            
        } catch (error: any) {
            logger.error('Error during onboarding submission:', {
                error,
                message: error?.message,
                code: error?.code,
                details: error?.details,
                hint: error?.hint,
                stack: error?.stack
            });
            
            // Show detailed error message to user
            const errorMessage = error?.message || 'Failed to save your information. Please try again.';
            Alert.alert(
                'Error', 
                errorMessage,
                [
                    {
                        text: 'OK',
                        style: 'default'
                    }
                ]
            );
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

    const renderStep = () => {
        const step = steps[currentStep];
        const Icon = step.icon;

        switch (step.id) {
            case 'business':
                return (
                    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={tw`pb-32`}>
                        {/* Business Information */}
                        <Card style={[tw`mb-6`, { backgroundColor: 'rgba(255,255,255,0.05)', borderColor: 'rgba(255,255,255,0.1)' }]}>
                            <CardContent style={tw`p-4`}>
                                <SectionHeader
                                    title="Business Information"
                                    icon={Info}
                                />

                                <OnboardingInputField
                                    label="Business Name *"
                                    value={formData.businessName}
                                    onChangeText={(text: string) => handleChange('businessName', text)}
                                    placeholder="Enter your business name"
                                    icon={Building}
                                    error={validationErrors.businessName}
                                />

                                <OnboardingInputField
                                    label="Phone Number *"
                                    value={formData.phone}
                                    onChangeText={(text: string) => {
                                        if (phoneDebounceRef.current) clearTimeout(phoneDebounceRef.current);
                                        handleChange('phone', text);
                                        phoneDebounceRef.current = setTimeout(() => {
                                            const formatted = formatPhoneNumber(text);
                                            handleChange('phone', formatted);
                                        }, 300);
                                    }}
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

                                <OnboardingInputField
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
                                <SectionHeader
                                    title="Specialties"
                                    icon={Sparkles}
                                />

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
                                <SectionHeader
                                    title="Social Media (Optional)"
                                    icon={Instagram}
                                    description="Add your social media handles to help clients connect with you"
                                />

                                <View style={tw`space-y-4`}>
                                    <OnboardingInputField
                                        label="Instagram"
                                        value={formData.socialMedia.instagram}
                                        onChangeText={(text: string) => handleSocialMediaUpdate({
                                            ...formData.socialMedia,
                                            instagram: text
                                        })}
                                        placeholder="@yourusername"
                                        description="Only your handle (e.g., @yourusername)"
                                    />

                                    <OnboardingInputField
                                        label="Twitter/X"
                                        value={formData.socialMedia.twitter}
                                        onChangeText={(text: string) => handleSocialMediaUpdate({
                                            ...formData.socialMedia,
                                            twitter: text
                                        })}
                                        placeholder="@yourusername"
                                        description="Only your handle (e.g., @yourusername)"
                                    />

                                    <OnboardingInputField
                                        label="TikTok"
                                        value={formData.socialMedia.tiktok}
                                        onChangeText={(text: string) => handleSocialMediaUpdate({
                                            ...formData.socialMedia,
                                            tiktok: text
                                        })}
                                        placeholder="@yourusername"
                                        description="Only your handle (e.g., @yourusername)"
                                    />

                                    <OnboardingInputField
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
                    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={tw`pb-32`}>
                        <Card style={[tw`mb-6`, { backgroundColor: 'rgba(255,255,255,0.05)', borderColor: 'rgba(255,255,255,0.1)' }]}>
                            <CardContent style={tw`p-4`}>
                                <SectionHeader
                                    title="Services & Pricing"
                                    icon={Scissors}
                                    description="Set up your services and pricing to start accepting bookings"
                                />

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

                                            <OnboardingInputField
                                                label="Service Name *"
                                                value={service.name}
                                                onChangeText={(text: string) => handleServiceChange(index, 'name', text)}
                                                placeholder="e.g., Haircut, Beard Trim, Fade"
                                                error={validationErrors[`services.${index}.name`]}
                                            />

                                            <View style={tw`flex-row gap-4`}>
                                                <NumericInput
                                                    label="Price ($) *"
                                                    value={service.price}
                                                    onChangeText={(value) => handleServiceChange(index, 'price', value)}
                                                    prefix="$"
                                                    placeholder="30"
                                                    error={validationErrors[`services.${index}.price`]}
                                                />
                                                <NumericInput
                                                    label="Duration (min) *"
                                                    value={service.duration}
                                                    onChangeText={(value) => handleServiceChange(index, 'duration', value)}
                                                    suffix="min"
                                                    placeholder="30"
                                                    error={validationErrors[`services.${index}.duration`]}
                                                />
                                            </View>
                                        </View>
                                    ))}
                                    
                                    <TouchableOpacity
                                        onPress={addService}
                                        style={[
                                            tw`flex-row items-center justify-center p-4 rounded-xl border-2 border-dashed`,
                                            { borderColor: 'rgba(255,255,255,0.3)', backgroundColor: 'transparent' }
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
                    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={tw`pb-32`}>
                        <Card style={[tw`mb-6`, { backgroundColor: 'rgba(255,255,255,0.05)', borderColor: 'rgba(255,255,255,0.1)' }]}>
                            <CardContent style={tw`p-4`}>
                                <SectionHeader
                                    title="Payment Setup"
                                    icon={CreditCard}
                                    description="Connect your Stripe account to start accepting payments"
                                />

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
                                            { backgroundColor: theme.colors.secondary },
                                            stripeLoading && { opacity: 0.6 }
                                        ]}
                                    >
                                        {stripeLoading ? (
                                            <ActivityIndicator color={theme.colors.secondaryForeground} />
                                        ) : (
                                            <>
                                                <CreditCard size={20} color={theme.colors.secondaryForeground} style={tw`mr-3`} />
                                                <Text style={[tw`font-semibold text-base`, { color: theme.colors.secondaryForeground }]}>
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
            
            {/* Header */}
            <View style={tw`px-6 pt-6 pb-4`}>
                <View style={tw`items-center mb-6`}>
                    <View style={[tw`p-4 rounded-full mb-3`, { backgroundColor: theme.colors.secondary + '20' }]}>
                        {React.createElement(steps[currentStep].icon, { 
                            size: 32, 
                            color: theme.colors.secondary 
                        })}
                    </View>
                    <Text style={[tw`text-2xl font-bold`, { color: theme.colors.foreground }]}>
                        {steps[currentStep].title}
                    </Text>
                    <Text style={[tw`text-sm mt-1`, { color: theme.colors.mutedForeground }]}>
                        {steps[currentStep].description}
                    </Text>
                </View>
            </View>

            {/* Progress Section */}
            <View style={tw`px-6 mb-6`}>
                <ProgressIndicator
                    steps={steps}
                    currentStep={currentStep}
                    progressPercentage={getProgressPercentage()}
                />
            </View>

            {/* Onboarding Complete Banner */}
            {onboardingComplete && showCompleteBanner && (
                <View style={tw`px-6 mb-6`}>
                    <Card style={[{ backgroundColor: 'rgba(255,255,255,0.05)', borderColor: 'rgba(255,255,255,0.1)' }]}>
                        <CardContent style={tw`p-4`}>
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
                            <Button
                                variant="secondary"
                                onPress={() => navigation.navigate('MainTabs' as any)}
                                style={tw`mt-3 rounded-xl`}
                                size="sm"
                            >
                                Go to Profile
                            </Button>
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

            {/* Navigation Buttons */}
            <View style={tw`px-6 py-3 border-t border-white/10`}>
                <View style={tw`flex-row justify-between items-center gap-3`}>
                    <Button
                        variant="outline"
                        onPress={() => setCurrentStep((prev) => Math.max(0, prev - 1))}
                        disabled={currentStep === 0}
                        style={[
                            tw`flex-1 rounded-xl`,
                            { borderColor: theme.colors.secondary, opacity: currentStep === 0 ? 0.5 : 1 }
                        ]}
                        textStyle={{ color: theme.colors.secondary }}
                    >
                        Back
                    </Button>
                    
                    <TouchableOpacity
                        style={[
                            tw`bg-secondary rounded-xl px-6 py-2.5 flex-1 flex-row items-center justify-center`,
                            { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 4 },
                            loading && { opacity: 0.6 }
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
                            <ActivityIndicator color={theme.colors.secondaryForeground} />
                        ) : (
                            <Text style={[tw`text-base font-bold text-center`, { color: theme.colors.secondaryForeground }]}>
                                {currentStep < steps.length - 1 ? 'Next' : 'Finish'}
                            </Text>
                        )}
                    </TouchableOpacity>
                </View>
            </View>
        </SafeAreaView>
    );
}