import { useEffect, useRef, useState } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import * as Notifications from 'expo-notifications';
import { notificationService, NotificationData } from '../lib/notifications';
import { logger } from '../lib/logger';

export interface UseNotificationsReturn {
  isInitialized: boolean;
  hasPermission: boolean;
  pushToken: string | null;
  sendTestNotification: () => Promise<void>;
  scheduleBookingReminders: (
    bookingId: string,
    appointmentDate: Date,
    serviceName: string,
    barberName: string
  ) => Promise<void>;
  sendBookingConfirmation: (
    bookingId: string,
    serviceName: string,
    appointmentTime: string,
    barberName: string
  ) => Promise<void>;
  sendNewBookingNotification: (
    bookingId: string,
    clientName: string,
    serviceName: string,
    appointmentTime: string
  ) => Promise<void>;
  sendPaymentConfirmation: (
    bookingId: string,
    amount: string,
    serviceName: string
  ) => Promise<void>;
  sendCancellationNotification: (
    bookingId: string,
    serviceName: string,
    appointmentTime: string
  ) => Promise<void>;
  sendCutCreatedNotification: (
    cutId: string,
    cutTitle: string
  ) => Promise<void>;
  getScheduledNotifications: () => Promise<Notifications.NotificationRequest[]>;
  cancelAllNotifications: () => Promise<void>;
}

export const useNotifications = (): UseNotificationsReturn => {
  const [isInitialized, setIsInitialized] = useState(false);
  const [hasPermission, setHasPermission] = useState(false);
  const [pushToken, setPushToken] = useState<string | null>(null);
  
  const notificationListener = useRef<Notifications.Subscription>();
  const responseListener = useRef<Notifications.Subscription>();
  const appStateListener = useRef<any>();

  useEffect(() => {
    initializeNotifications();

    // Listen for notifications received while app is foregrounded
    notificationListener.current = notificationService.addNotificationReceivedListener(
      (notification) => {
        logger.log('📱 Notification received:', notification);
        // You can handle foreground notifications here
        // For example, show a custom in-app notification
      }
    );

    // Listen for user tapping on notification
    responseListener.current = notificationService.addNotificationResponseReceivedListener(
      (response) => {
        logger.log('👆 Notification tapped:', response);
        handleNotificationResponse(response);
      }
    );

    // Listen for app state changes
    appStateListener.current = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      // Cleanup listeners
      if (notificationListener.current) {
        notificationService.removeNotificationSubscription(notificationListener.current);
      }
      if (responseListener.current) {
        notificationService.removeNotificationSubscription(responseListener.current);
      }
      if (appStateListener.current) {
        appStateListener.current.remove();
      }
    };
  }, []);

  const initializeNotifications = async () => {
    try {
      await notificationService.initialize();
      setIsInitialized(true);
      
      // Check permission status
      const { status } = await Notifications.getPermissionsAsync();
      setHasPermission(status === 'granted');
      
      // Get push token
      const token = notificationService.getPushToken();
      setPushToken(token);
      
      logger.log('✅ Notifications initialized successfully');
    } catch (error) {
      logger.error('❌ Error initializing notifications:', error);
      setIsInitialized(true); // Set to true even if failed to avoid infinite retries
    }
  };

  const handleNotificationResponse = (response: Notifications.NotificationResponse) => {
    const data = response.notification.request.content.data as NotificationData;
    
    // Handle different notification types
    switch (data?.type) {
      case 'booking_confirmation':
        // Navigate to booking details
        logger.log('Navigate to booking:', data.bookingId);
        break;
      case 'booking_reminder':
        // Navigate to booking details
        logger.log('Navigate to booking reminder:', data.bookingId);
        break;
      case 'new_booking':
        // Navigate to new booking
        logger.log('Navigate to new booking:', data.bookingId);
        break;
      case 'payment_received':
        // Navigate to payment details
        logger.log('Navigate to payment:', data.bookingId);
        break;
      case 'appointment_cancelled':
        // Navigate to booking details
        logger.log('Navigate to cancelled booking:', data.bookingId);
        break;
      case 'cut_created':
        // Navigate to cut details
        logger.log('Navigate to cut:', data.cutId);
        break;
      default:
        logger.log('Unknown notification type:', data?.type);
    }
  };

  const handleAppStateChange = (nextAppState: AppStateStatus) => {
    if (nextAppState === 'active') {
      // App came to foreground - you can refresh data here
      logger.log('📱 App became active');
    }
  };

  const sendTestNotification = async () => {
    try {
      await notificationService.sendLocalNotification(
        '🧪 Test Notification',
        'This is a test notification from your barber app!',
        { type: 'booking_confirmation' }
      );
    } catch (error) {
      logger.error('❌ Error sending test notification:', error);
    }
  };

  const scheduleBookingReminders = async (
    bookingId: string,
    appointmentDate: Date,
    serviceName: string,
    barberName: string
  ) => {
    try {
      // Schedule reminder 1 hour before
      const oneHourBefore = new Date(appointmentDate.getTime() - 60 * 60 * 1000);
      if (oneHourBefore > new Date()) {
        await notificationService.sendBookingReminder(
          bookingId,
          serviceName,
          appointmentDate.toLocaleDateString('en-US', {
            weekday: 'long',
            month: 'long',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
            hour12: true,
          }),
          barberName,
          60
        );
      }

      // Schedule reminder 24 hours before
      const oneDayBefore = new Date(appointmentDate.getTime() - 24 * 60 * 60 * 1000);
      if (oneDayBefore > new Date()) {
        await notificationService.sendBookingReminder(
          bookingId,
          serviceName,
          appointmentDate.toLocaleDateString('en-US', {
            weekday: 'long',
            month: 'long',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
            hour12: true,
          }),
          barberName,
          1440 // 24 hours in minutes
        );
      }
    } catch (error) {
      logger.error('❌ Error scheduling booking reminders:', error);
    }
  };

  const sendBookingConfirmation = async (
    bookingId: string,
    serviceName: string,
    appointmentTime: string,
    barberName: string
  ) => {
    try {
      await notificationService.sendBookingConfirmation(
        bookingId,
        serviceName,
        appointmentTime,
        barberName
      );
    } catch (error) {
      logger.error('❌ Error sending booking confirmation:', error);
    }
  };

  const sendNewBookingNotification = async (
    bookingId: string,
    clientName: string,
    serviceName: string,
    appointmentTime: string
  ) => {
    try {
      await notificationService.sendNewBookingNotification(
        bookingId,
        clientName,
        serviceName,
        appointmentTime
      );
    } catch (error) {
      logger.error('❌ Error sending new booking notification:', error);
    }
  };

  const sendPaymentConfirmation = async (
    bookingId: string,
    amount: string,
    serviceName: string
  ) => {
    try {
      await notificationService.sendPaymentConfirmation(
        bookingId,
        amount,
        serviceName
      );
    } catch (error) {
      logger.error('❌ Error sending payment confirmation:', error);
    }
  };

  const sendCancellationNotification = async (
    bookingId: string,
    serviceName: string,
    appointmentTime: string
  ) => {
    try {
      await notificationService.sendCancellationNotification(
        bookingId,
        serviceName,
        appointmentTime
      );
    } catch (error) {
      logger.error('❌ Error sending cancellation notification:', error);
    }
  };

  const sendCutCreatedNotification = async (
    cutId: string,
    cutTitle: string
  ) => {
    try {
      await notificationService.sendCutCreatedNotification(
        cutId,
        cutTitle
      );
    } catch (error) {
      logger.error('❌ Error sending cut created notification:', error);
    }
  };

  const getScheduledNotifications = async () => {
    try {
      return await notificationService.getScheduledNotifications();
    } catch (error) {
      logger.error('❌ Error getting scheduled notifications:', error);
      return [];
    }
  };

  const cancelAllNotifications = async () => {
    try {
      await notificationService.cancelAllNotifications();
    } catch (error) {
      logger.error('❌ Error cancelling notifications:', error);
    }
  };

  return {
    isInitialized,
    hasPermission,
    pushToken,
    sendTestNotification,
    scheduleBookingReminders,
    sendBookingConfirmation,
    sendNewBookingNotification,
    sendPaymentConfirmation,
    sendCancellationNotification,
    sendCutCreatedNotification,
    getScheduledNotifications,
    cancelAllNotifications,
  };
};
