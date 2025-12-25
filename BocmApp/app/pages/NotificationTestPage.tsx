import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
  StatusBar,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { ArrowLeft, Bell, Clock, Calendar, DollarSign, X, Check, Scissors } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import { theme } from '../shared/lib/theme';
import { logger } from '../shared/lib/logger';
import { AnimatedBackground } from '../shared/components/AnimatedBackground';
import { useNotifications } from '../shared/hooks/useNotifications';

export default function NotificationTestPage() {
  const navigation = useNavigation();
  const {
    isInitialized,
    hasPermission,
    pushToken,
    sendTestNotification,
    sendBookingConfirmation,
    sendNewBookingNotification,
    sendPaymentConfirmation,
    sendCancellationNotification,
    sendCutCreatedNotification,
    scheduleBookingReminders,
    getScheduledNotifications,
    cancelAllNotifications,
  } = useNotifications();

  const [loading, setLoading] = useState(false);
  const [scheduledCount, setScheduledCount] = useState(0);

  const handleBack = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    navigation.goBack();
  };

  const handleTestNotification = async () => {
    setLoading(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    
    try {
      await sendTestNotification();
      Alert.alert('Success', 'Test notification sent!');
    } catch (error) {
      Alert.alert('Error', 'Failed to send test notification');
    } finally {
      setLoading(false);
    }
  };

  const handleBookingConfirmation = async () => {
    setLoading(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    
    try {
      await sendBookingConfirmation(
        'test-booking-123',
        'Fade Cut',
        'Monday, January 15, 2024 at 2:00 PM',
        'John the Barber'
      );
      Alert.alert('Success', 'Booking confirmation sent!');
    } catch (error) {
      Alert.alert('Error', 'Failed to send booking confirmation');
    } finally {
      setLoading(false);
    }
  };

  const handleNewBooking = async () => {
    setLoading(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    
    try {
      await sendNewBookingNotification(
        'test-booking-456',
        'Sarah Johnson',
        'Beard Trim',
        'Tuesday, January 16, 2024 at 3:30 PM'
      );
      Alert.alert('Success', 'New booking notification sent!');
    } catch (error) {
      Alert.alert('Error', 'Failed to send new booking notification');
    } finally {
      setLoading(false);
    }
  };

  const handlePaymentConfirmation = async () => {
    setLoading(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    
    try {
      await sendPaymentConfirmation(
        'test-booking-789',
        '$35.00',
        'Haircut & Style'
      );
      Alert.alert('Success', 'Payment confirmation sent!');
    } catch (error) {
      Alert.alert('Error', 'Failed to send payment confirmation');
    } finally {
      setLoading(false);
    }
  };

  const handleCancellation = async () => {
    setLoading(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    
    try {
      await sendCancellationNotification(
        'test-booking-101',
        'Fade Cut',
        'Wednesday, January 17, 2024 at 1:00 PM'
      );
      Alert.alert('Success', 'Cancellation notification sent!');
    } catch (error) {
      Alert.alert('Error', 'Failed to send cancellation notification');
    } finally {
      setLoading(false);
    }
  };

  const handleCutCreated = async () => {
    setLoading(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    
    try {
      await sendCutCreatedNotification(
        'test-cut-123',
        'Amazing Fade Cut'
      );
      Alert.alert('Success', 'Cut creation notification sent!');
    } catch (error) {
      Alert.alert('Error', 'Failed to send cut creation notification');
    } finally {
      setLoading(false);
    }
  };

  const handleScheduleReminders = async () => {
    setLoading(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    
    try {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(14, 0, 0, 0); // 2:00 PM tomorrow
      
      await scheduleBookingReminders(
        'test-booking-reminder',
        tomorrow,
        'Premium Haircut',
        'Mike the Barber'
      );
      Alert.alert('Success', 'Booking reminders scheduled!');
    } catch (error) {
      Alert.alert('Error', 'Failed to schedule reminders');
    } finally {
      setLoading(false);
    }
  };

  const handleCheckScheduled = async () => {
    setLoading(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    try {
      const notifications = await getScheduledNotifications();
      setScheduledCount(notifications.length);
      Alert.alert('Scheduled Notifications', `You have ${notifications.length} scheduled notifications`);
    } catch (error) {
      Alert.alert('Error', 'Failed to get scheduled notifications');
    } finally {
      setLoading(false);
    }
  };

  const handleCancelAll = async () => {
    setLoading(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    
    try {
      await cancelAllNotifications();
      setScheduledCount(0);
      Alert.alert('Success', 'All notifications cancelled!');
    } catch (error) {
      Alert.alert('Error', 'Failed to cancel notifications');
    } finally {
      setLoading(false);
    }
  };

  const handleTestAPI = async () => {
    setLoading(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    
    try {
      const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || "https://www.bocmstyle.com";
      logger.log('Testing API connection to:', API_BASE_URL);
      
      const response = await fetch(`${API_BASE_URL}/api/connect/create-account`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          barberId: 'test-connection',
          email: 'test@example.com'
        }),
      });
      
      logger.log('API Response status:', response.status);
      const data = await response.json();
      logger.log('API Response data:', data);
      
      if (response.ok) {
        Alert.alert('Success', 'API connection working!');
      } else {
        Alert.alert('API Error', data.error || 'Unknown error');
      }
    } catch (error) {
      logger.error('API Test Error:', error);
      Alert.alert('Network Error', error instanceof Error ? error.message : 'Failed to connect to API');
    } finally {
      setLoading(false);
    }
  };

  const handleTestDeepLink = async () => {
    setLoading(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    
    try {
      // Test deep link opening
      const deepLink = 'bocm://stripe-connect/return?account_id=test_deep_link_123';
      logger.log('Testing deep link:', deepLink);
      
      const canOpen = await Linking.canOpenURL(deepLink);
      logger.log('Can open deep link:', canOpen);
      
      if (canOpen) {
        await Linking.openURL(deepLink);
        Alert.alert('Success', 'Deep link opened successfully!');
      } else {
        Alert.alert('Error', 'Cannot open deep link. App may not be installed or deep link not configured.');
      }
    } catch (error) {
      logger.error('Deep link test error:', error);
      Alert.alert('Error', 'Failed to test deep link');
    } finally {
      setLoading(false);
    }
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
            <Bell size={40} color={theme.colors.secondary} />
          </View>
          
          <Text style={{
            fontSize: 32,
            fontFamily: theme.typography.fontFamily.bebas[0],
            color: theme.colors.secondary,
            textAlign: 'center',
            marginBottom: 12,
          }}>
            NOTIFICATION TEST
          </Text>
          
          <Text style={{
            fontSize: 16,
            color: 'rgba(255, 255, 255, 0.8)',
            textAlign: 'center',
          }}>
            Test the push notification system
          </Text>
        </View>

        {/* Status Info */}
        <View style={{
          borderRadius: 20,
          overflow: 'hidden',
          marginBottom: 24,
        }}>
          <BlurView
            intensity={20}
            style={{
              padding: 24,
              borderWidth: 1,
              borderColor: 'rgba(255, 255, 255, 0.1)',
              backgroundColor: 'rgba(255, 255, 255, 0.05)',
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
              <View style={{
                width: 12,
                height: 12,
                borderRadius: 6,
                backgroundColor: isInitialized ? '#10b981' : '#ef4444',
                marginRight: 8,
              }} />
              <Text style={{ color: theme.colors.foreground, fontSize: 14 }}>
                System: {isInitialized ? 'Initialized' : 'Initializing...'}
              </Text>
            </View>
            
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
              <View style={{
                width: 12,
                height: 12,
                borderRadius: 6,
                backgroundColor: hasPermission ? '#10b981' : '#ef4444',
                marginRight: 8,
              }} />
              <Text style={{ color: theme.colors.foreground, fontSize: 14 }}>
                Permissions: {hasPermission ? 'Granted' : 'Not Granted'}
              </Text>
            </View>
            
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
              <View style={{
                width: 12,
                height: 12,
                borderRadius: 6,
                backgroundColor: pushToken ? '#10b981' : '#ef4444',
                marginRight: 8,
              }} />
              <Text style={{ color: theme.colors.foreground, fontSize: 14 }}>
                Push Token: {pushToken ? 'Available' : 'Not Available'}
              </Text>
            </View>
            
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Clock size={16} color={theme.colors.secondary} style={{ marginRight: 8 }} />
              <Text style={{ color: theme.colors.foreground, fontSize: 14 }}>
                Scheduled: {scheduledCount} notifications
              </Text>
            </View>
          </BlurView>
        </View>

        {/* Test Buttons */}
        <View style={{
          borderRadius: 20,
          overflow: 'hidden',
        }}>
          <BlurView
            intensity={20}
            style={{
              padding: 24,
              borderWidth: 1,
              borderColor: 'rgba(255, 255, 255, 0.1)',
              backgroundColor: 'rgba(255, 255, 255, 0.05)',
            }}
          >
            {/* Test Notification */}
            <TouchableOpacity
              onPress={handleTestNotification}
              disabled={loading || !isInitialized}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                padding: 16,
                borderRadius: 16,
                backgroundColor: 'rgba(255, 255, 255, 0.1)',
                marginBottom: 12,
                opacity: loading || !isInitialized ? 0.6 : 1,
              }}
            >
              <Bell size={20} color={theme.colors.secondary} style={{ marginRight: 12 }} />
              <Text style={{ color: theme.colors.foreground, fontSize: 16, flex: 1 }}>
                Send Test Notification
              </Text>
            </TouchableOpacity>

            {/* Booking Confirmation */}
            <TouchableOpacity
              onPress={handleBookingConfirmation}
              disabled={loading || !isInitialized}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                padding: 16,
                borderRadius: 16,
                backgroundColor: 'rgba(255, 255, 255, 0.1)',
                marginBottom: 12,
                opacity: loading || !isInitialized ? 0.6 : 1,
              }}
            >
              <Check size={20} color={theme.colors.secondary} style={{ marginRight: 12 }} />
              <Text style={{ color: theme.colors.foreground, fontSize: 16, flex: 1 }}>
                Booking Confirmation
              </Text>
            </TouchableOpacity>

            {/* New Booking */}
            <TouchableOpacity
              onPress={handleNewBooking}
              disabled={loading || !isInitialized}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                padding: 16,
                borderRadius: 16,
                backgroundColor: 'rgba(255, 255, 255, 0.1)',
                marginBottom: 12,
                opacity: loading || !isInitialized ? 0.6 : 1,
              }}
            >
              <Calendar size={20} color={theme.colors.secondary} style={{ marginRight: 12 }} />
              <Text style={{ color: theme.colors.foreground, fontSize: 16, flex: 1 }}>
                New Booking Alert
              </Text>
            </TouchableOpacity>

            {/* Payment Confirmation */}
            <TouchableOpacity
              onPress={handlePaymentConfirmation}
              disabled={loading || !isInitialized}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                padding: 16,
                borderRadius: 16,
                backgroundColor: 'rgba(255, 255, 255, 0.1)',
                marginBottom: 12,
                opacity: loading || !isInitialized ? 0.6 : 1,
              }}
            >
              <DollarSign size={20} color={theme.colors.secondary} style={{ marginRight: 12 }} />
              <Text style={{ color: theme.colors.foreground, fontSize: 16, flex: 1 }}>
                Payment Confirmation
              </Text>
            </TouchableOpacity>

            {/* Cancellation */}
            <TouchableOpacity
              onPress={handleCancellation}
              disabled={loading || !isInitialized}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                padding: 16,
                borderRadius: 16,
                backgroundColor: 'rgba(255, 255, 255, 0.1)',
                marginBottom: 12,
                opacity: loading || !isInitialized ? 0.6 : 1,
              }}
            >
              <X size={20} color={theme.colors.secondary} style={{ marginRight: 12 }} />
              <Text style={{ color: theme.colors.foreground, fontSize: 16, flex: 1 }}>
                Appointment Cancelled
              </Text>
            </TouchableOpacity>

            {/* Cut Created */}
            <TouchableOpacity
              onPress={handleCutCreated}
              disabled={loading || !isInitialized}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                padding: 16,
                borderRadius: 16,
                backgroundColor: 'rgba(255, 255, 255, 0.1)',
                marginBottom: 12,
                opacity: loading || !isInitialized ? 0.6 : 1,
              }}
            >
              <Scissors size={20} color={theme.colors.secondary} style={{ marginRight: 12 }} />
              <Text style={{ color: theme.colors.foreground, fontSize: 16, flex: 1 }}>
                Cut Created
              </Text>
            </TouchableOpacity>

            {/* Schedule Reminders */}
            <TouchableOpacity
              onPress={handleScheduleReminders}
              disabled={loading || !isInitialized}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                padding: 16,
                borderRadius: 16,
                backgroundColor: 'rgba(255, 255, 255, 0.1)',
                marginBottom: 12,
                opacity: loading || !isInitialized ? 0.6 : 1,
              }}
            >
              <Clock size={20} color={theme.colors.secondary} style={{ marginRight: 12 }} />
              <Text style={{ color: theme.colors.foreground, fontSize: 16, flex: 1 }}>
                Schedule Reminders
              </Text>
            </TouchableOpacity>

            {/* Check Scheduled */}
            <TouchableOpacity
              onPress={handleCheckScheduled}
              disabled={loading || !isInitialized}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                padding: 16,
                borderRadius: 16,
                backgroundColor: 'rgba(255, 255, 255, 0.1)',
                marginBottom: 12,
                opacity: loading || !isInitialized ? 0.6 : 1,
              }}
            >
              <Calendar size={20} color={theme.colors.secondary} style={{ marginRight: 12 }} />
              <Text style={{ color: theme.colors.foreground, fontSize: 16, flex: 1 }}>
                Check Scheduled ({scheduledCount})
              </Text>
            </TouchableOpacity>

            {/* Cancel All */}
            <TouchableOpacity
              onPress={handleCancelAll}
              disabled={loading || !isInitialized}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                padding: 16,
                borderRadius: 16,
                backgroundColor: 'rgba(239, 68, 68, 0.2)',
                opacity: loading || !isInitialized ? 0.6 : 1,
              }}
            >
              <X size={20} color="#ef4444" style={{ marginRight: 12 }} />
              <Text style={{ color: "#ef4444", fontSize: 16, flex: 1 }}>
                Cancel All Notifications
              </Text>
            </TouchableOpacity>

            {/* Test API Connection */}
            <TouchableOpacity
              onPress={handleTestAPI}
              disabled={loading || !isInitialized}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                padding: 16,
                borderRadius: 16,
                backgroundColor: 'rgba(255, 255, 255, 0.1)',
                marginBottom: 12,
                opacity: loading || !isInitialized ? 0.6 : 1,
              }}
            >
              <Bell size={20} color={theme.colors.secondary} style={{ marginRight: 12 }} />
              <Text style={{ color: theme.colors.foreground, fontSize: 16, flex: 1 }}>
                Test API Connection
              </Text>
            </TouchableOpacity>

            {/* Test Deep Link */}
            <TouchableOpacity
              onPress={handleTestDeepLink}
              disabled={loading || !isInitialized}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                padding: 16,
                borderRadius: 16,
                backgroundColor: 'rgba(255, 255, 255, 0.1)',
                marginBottom: 12,
                opacity: loading || !isInitialized ? 0.6 : 1,
              }}
            >
              <Calendar size={20} color={theme.colors.secondary} style={{ marginRight: 12 }} />
              <Text style={{ color: theme.colors.foreground, fontSize: 16, flex: 1 }}>
                Test Deep Link
              </Text>
            </TouchableOpacity>
          </BlurView>
        </View>

        {/* Instructions */}
        <View style={{ marginTop: 24 }}>
          <Text style={{
            fontSize: 12,
            color: 'rgba(255, 255, 255, 0.6)',
            textAlign: 'center',
            lineHeight: 18,
          }}>
            💡 Tap any button above to test different notification types.{'\n'}
            📱 Notifications will appear on your device&apos;s lock screen.{'\n'}
            ⏰ Scheduled reminders will be sent at the specified time.{'\n'}
            🔔 Make sure notifications are enabled in your device settings.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
