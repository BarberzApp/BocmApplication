import React from 'react';
import { ScrollView, View, Text, TouchableOpacity, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { ArrowLeft, FileText } from 'lucide-react-native';
import { theme } from '../shared/lib/theme';
import { AnimatedBackground } from '../shared/components/AnimatedBackground';
import { RootStackParamList } from '../shared/types';

const terms = `BOCM TERMS OF SERVICE

Effective Date: January 2025

Welcome to BOCM. These Terms of Service ("Terms") govern your access to and use of the BOCM website, mobile application, and all associated services (collectively, the "Services"). The Services are provided by BOCM ("BOCM," "we," "us," or "our").

By using our Services, you agree to be bound by these Terms, our Privacy Policy, and all applicable laws and regulations. If you do not agree, do not use the Services.

You can view our Privacy Policy at any time within the app or by navigating to the Privacy Policy section from Settings.

OVERVIEW OF SERVICES
BOCM is a digital marketplace that connects clients seeking beauty and barbering services ("Clients") with independent cosmetologists and barbers ("Professionals"). BOCM provides the digital infrastructure for booking, service management, payment processing, and content discovery but does not directly offer any hair or beauty services.

CLIENT AND PROFESSIONAL REGISTRATION
• Secure login system with session persistence
• Profile creation and avatar uploads
• Social media integration (Instagram, Twitter, TikTok, Facebook)
• Super admin panel for managing developer and staff accounts

DISCOVERY & BOOKING
• Location-based barber search with specialty filtering (fade cuts, beard trims, styling, etc.)
• Real-time availability checking and instant booking confirmations
• Booking history, management, cancellation, and rescheduling
• QR code-enabled booking links for marketing and sharing

PAYMENT PROCESSING
• Seamless Stripe integration for secure payments
• Instant payment processing with receipt generation
• Full payment history tracking for clients and barbers

SERVICE MANAGEMENT
• Custom service creation with pricing, duration, and descriptions
• Tagging of over 100 barber specialties
• Image/video portfolio uploads
• Bulk service management and reusable service templates

SCHEDULING & CALENDAR
• Advanced calendar interface with multiple views
• Conflict detection, 5-minute time increments, and buffer time management
• Daily booking limits and advance scheduling controls
• Real-time updates to reflect schedule changes

VIDEO REELS PLATFORM
• TikTok-style content platform for barber videos
• Upload, categorize, and manage video content
• Location-based video discovery and social engagement (likes, shares)
• Analytics for video views, engagement, and performance tracking

SEARCH & DISCOVERY
• Comprehensive search with smart filters and suggestions
• Location, specialty, availability, and price filtering
• Distance-based ranking and trending services
• Quick filters for top categories and specialties

SETTINGS & PROFILE MANAGEMENT
• Customizable profiles with business info, social links, and public/private toggles
• Full control over services: add, edit, delete
• Portfolio and content upload tools
• Booking restriction settings

MOBILE & PWA FEATURES
• Progressive Web App (PWA) with offline support
• Responsive design for seamless mobile experience
• Push notifications for updates and bookings
• Touch-friendly UI with swipe support and app shortcuts

ANALYTICS & INSIGHTS
• Booking volume and earnings reports
• Client history and service performance metrics
• Real-time revenue tracking
• Video analytics (views, likes, shares, engagements)

FUTURE FEATURES (PLANNED) PHASE 1: ADVANCED BOOKING & SCHEDULING
• On-demand mobile barbers (Uber-style)
• Real-time GPS matching and route tracking
• Surge pricing and request management
• Mobile dashboard for traveling barbers
• Advanced scheduling features:
  - Weekly templates, break time blocks, holiday scheduling
  - AI-powered scheduling suggestions
  - Capacity management for multi-client time slots

BUSINESS MANAGEMENT TOOLS
• Integrated financial tools and accounting support
• Inventory tracking and reorder automation
• Staff scheduling and CRM tools
• Detailed reporting for services, clients, and revenues

LIMITATION OF LIABILITY
BOCM is not liable for any damages, losses, injuries, or claims arising out of:
• the actions or omissions of any Professional or Client;
• the quality, legality, or safety of services rendered;
• services performed in private or remote locations;
• misconduct, including but not limited to assault, theft, or negligence.

BOCM does not verify the licensing status of Professionals. Clients are solely responsible for ensuring that their selected Professional holds any licenses required by law in their jurisdiction, including in the State of New Jersey.

By using BOCM, you acknowledge and accept that:
• You are solely responsible for your safety and actions.
• Private appointments carry inherent risks.
• BOCM is not liable in any way for interactions between Clients and Professionals.

INDEMNIFICATION
You agree to indemnify, defend, and hold harmless BOCM, its officers, employees, and affiliates from any claims, damages, or legal actions arising from:
• Your use or misuse of the Services;
• Any violation of these Terms;
• Any harm caused to or by a third party while using BOCM.

ACCOUNT REGISTRATION AND CONDUCT
You are responsible for:
• Maintaining accurate registration information;
• Securing your account credentials;
• Not misrepresenting your identity or licensing status.

BOCM reserves the right to suspend or terminate accounts for any violations.

SAFETY WARNINGS AND ASSUMPTION OF RISK
Clients acknowledge that beauty services provided in homes, hotels, or non-commercial settings involve risks. By using BOCM, you agree to assume all such risks and release BOCM from any liability.

THIRD-PARTY SERVICES
BOCM may link to third-party services (e.g., Stripe). You agree to be bound by the terms and conditions of those services when applicable.

STATE-SPECIFIC RIGHTS
Some states do not allow certain disclaimers of warranties, limitations of liability, or the exclusion of certain damages. Accordingly, some of the disclaimers and limitations in these Terms may not apply to you. You may have additional rights and remedies under your local laws.

New Jersey Residents: Notwithstanding any other provision of these Terms, if you are a resident of New Jersey, the following shall not apply to you: (a) any provision that limits BOCM's liability for personal injury or property damage caused by our negligence; (b) any provision that limits your right to seek punitive damages, statutory damages, or attorneys' fees where applicable under New Jersey law; (c) any provision that limits the time within which you may bring a legal claim.

California Residents: Under California Civil Code Section 1789.3, users are entitled to the following consumer rights notice: If you have a complaint, you may contact the Complaint Assistance Unit of the Division of Consumer Services of the California Department of Consumer Affairs.

MODIFICATIONS TO TERMS
BOCM may update these Terms at any time. Continued use of the Services after changes are posted constitutes acceptance.

TERMINATION
We may suspend or terminate your access to the Services at any time, with or without cause. Your obligations under these Terms will survive termination.

GOVERNING LAW AND DISPUTES
These Terms are governed by the laws of the State of New Jersey, without regard to its conflict of law rules. Any disputes must be resolved in the courts of New Jersey or through binding arbitration if mutually agreed.

CONTACT US
For questions or concerns regarding these Terms, contact primbocm@gmail.com.`;

type TermsNavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function TermsPage() {
  const navigation = useNavigation<TermsNavigationProp>();

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

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 32, paddingVertical: 100, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={{ alignItems: 'center', marginBottom: 32 }}>
          <View style={{
            width: 80,
            height: 80,
            borderRadius: 40,
            backgroundColor: 'rgba(199, 142, 63, 0.2)',
            justifyContent: 'center',
            alignItems: 'center',
            marginBottom: 24,
          }}>
            <FileText size={40} color={theme.colors.secondary} />
          </View>
          
          <Text style={{
            fontSize: 32,
            fontFamily: theme.typography.fontFamily.bebas[0],
            color: theme.colors.secondary,
            textAlign: 'center',
            marginBottom: 12,
          }}>
            TERMS & CONDITIONS
          </Text>
          
          <Text style={{
            fontSize: 16,
            color: 'rgba(255, 255, 255, 0.8)',
            textAlign: 'center',
          }}>
            Please read these terms carefully
          </Text>
        </View>

        {/* Terms Content */}
        <View style={{
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
            <ScrollView
              showsVerticalScrollIndicator={false}
              style={{ maxHeight: 600 }}
            >
              <Text style={{
                fontSize: 14,
                lineHeight: 22,
                color: 'rgba(255, 255, 255, 0.9)',
                textAlign: 'left',
              }}>
                {terms}
              </Text>
            </ScrollView>
          </BlurView>
        </View>

        {/* Footer */}
        <View style={{ alignItems: 'center', marginTop: 32 }}>
          <Text style={{
            fontSize: 12,
            color: 'rgba(255, 255, 255, 0.6)',
            textAlign: 'center',
            marginBottom: 16,
          }}>
            By using BOCM, you agree to these terms and conditions
          </Text>
          <TouchableOpacity
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              navigation.navigate('PrivacyPolicy');
            }}
          >
            <Text style={{
              fontSize: 14,
              color: theme.colors.secondary,
              textDecorationLine: 'underline',
              fontWeight: '600',
            }}>
              View Privacy Policy
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
} 