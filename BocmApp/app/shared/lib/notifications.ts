import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { supabase } from './supabase';
import { logger } from './logger';

// Configure notification behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export interface NotificationData {
  type: 'booking_confirmation' | 'booking_reminder' | 'new_booking' | 'payment_received' | 'appointment_cancelled' | 'cut_created';
  bookingId?: string;
  barberId?: string;
  clientId?: string;
  serviceName?: string;
  appointmentTime?: string;
  amount?: string;
  cutId?: string;
  cutTitle?: string;
}

export class NotificationService {
  private static instance: NotificationService;
  private expoPushToken: string | null = null;

  private constructor() {}

  static getInstance(): NotificationService {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService();
    }
    return NotificationService.instance;
  }

  // Initialize notifications
  async initialize(): Promise<void> {
    try {
      // Request permissions
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== 'granted') {
        logger.log('Notification permissions not granted');
        return;
      }

      // Get push token
      if (Device.isDevice) {
        const token = await Notifications.getExpoPushTokenAsync({
          projectId: process.env.EXPO_PROJECT_ID,
        });
        this.expoPushToken = token.data;
        logger.log('Push token obtained:', this.expoPushToken);
        
        // Save token to user's profile
        await this.savePushToken();
      } else {
        logger.log('Must use physical device for push notifications');
      }

      // Configure notification channels for Android
      if (Platform.OS === 'android') {
        await this.setupAndroidChannels();
      }

    } catch (error) {
      logger.error('Error initializing notifications:', error);
    }
  }

  // Save push token to user's profile
  private async savePushToken(): Promise<void> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !this.expoPushToken) return;

      const { error } = await supabase
        .from('profiles')
        .update({ 
          push_token: this.expoPushToken,
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id);

      if (error) {
        logger.error('Error saving push token:', error);
      } else {
        logger.log('Push token saved to profile');
      }
    } catch (error) {
      logger.error('Error saving push token:', error);
    }
  }

  // Setup Android notification channels
  private async setupAndroidChannels(): Promise<void> {
    await Notifications.setNotificationChannelAsync('bookings', {
      name: 'Booking Notifications',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF231F7C',
      sound: 'default',
    });

    await Notifications.setNotificationChannelAsync('reminders', {
      name: 'Appointment Reminders',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF231F7C',
      sound: 'default',
    });

    await Notifications.setNotificationChannelAsync('payments', {
      name: 'Payment Notifications',
      importance: Notifications.AndroidImportance.DEFAULT,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF231F7C',
      sound: 'default',
    });
  }

  // Send local notification
  async sendLocalNotification(
    title: string,
    body: string,
    data?: NotificationData,
    channelId?: string
  ): Promise<void> {
    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          data: data ? { ...data } : undefined,
          sound: 'default',
        },
        trigger: null, // Send immediately
        ...(channelId && { channelId }),
      });
      logger.log('Local notification sent:', title);
    } catch (error) {
      logger.error('Error sending local notification:', error);
    }
  }

  // Send booking confirmation notification
  async sendBookingConfirmation(
    bookingId: string,
    serviceName: string,
    appointmentTime: string,
    barberName: string
  ): Promise<void> {
    const title = '🎉 Booking Confirmed!';
    const body = `Your ${serviceName} appointment with ${barberName} is confirmed for ${appointmentTime}`;
    
    await this.sendLocalNotification(title, body, {
      type: 'booking_confirmation',
      bookingId,
      serviceName,
      appointmentTime,
    }, 'bookings');
  }

  // Send booking reminder notification
  async sendBookingReminder(
    bookingId: string,
    serviceName: string,
    appointmentTime: string,
    barberName: string,
    minutesBefore: number = 30
  ): Promise<void> {
    const title = '⏰ Appointment Reminder';
    const body = `Your ${serviceName} appointment with ${barberName} is in ${minutesBefore} minutes`;
    
    // Schedule the reminder using seconds trigger
    const secondsFromNow = Math.max(0, (minutesBefore - 30) * 60); // 30 minutes before
    
    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          data: {
            type: 'booking_reminder',
            bookingId,
            serviceName,
            appointmentTime,
          },
          sound: 'default',
        },
        trigger: secondsFromNow > 0 ? { 
          type: 'timeInterval',
          seconds: secondsFromNow 
        } : null,
        channelId: 'reminders',
      });
      logger.log('Booking reminder scheduled for:', new Date(Date.now() + secondsFromNow * 1000));
    } catch (error) {
      logger.error('Error scheduling booking reminder:', error);
    }
  }

  // Send new booking notification to barber
  async sendNewBookingNotification(
    bookingId: string,
    clientName: string,
    serviceName: string,
    appointmentTime: string
  ): Promise<void> {
    const title = '📅 New Booking!';
    const body = `${clientName} booked ${serviceName} for ${appointmentTime}`;
    
    await this.sendLocalNotification(title, body, {
      type: 'new_booking',
      bookingId,
      serviceName,
      appointmentTime,
    }, 'bookings');
  }

  // Send payment confirmation notification
  async sendPaymentConfirmation(
    bookingId: string,
    amount: string,
    serviceName: string
  ): Promise<void> {
    const title = '💰 Payment Received!';
    const body = `Payment of ${amount} received for ${serviceName}`;
    
    await this.sendLocalNotification(title, body, {
      type: 'payment_received',
      bookingId,
      amount,
      serviceName,
    }, 'payments');
  }

  // Send appointment cancellation notification
  async sendCancellationNotification(
    bookingId: string,
    serviceName: string,
    appointmentTime: string
  ): Promise<void> {
    const title = '❌ Appointment Cancelled';
    const body = `Your ${serviceName} appointment for ${appointmentTime} has been cancelled`;
    
    await this.sendLocalNotification(title, body, {
      type: 'appointment_cancelled',
      bookingId,
      serviceName,
      appointmentTime,
    }, 'bookings');
  }

  // Send cut creation notification
  async sendCutCreatedNotification(
    cutId: string,
    cutTitle: string
  ): Promise<void> {
    const title = '🎬 Cut Uploaded Successfully!';
    const body = `Your "${cutTitle}" cut has been uploaded and is now live`;
    
    await this.sendLocalNotification(title, body, {
      type: 'cut_created',
      cutId,
      cutTitle,
    }, 'bookings');
  }

  // Get all scheduled notifications
  async getScheduledNotifications(): Promise<Notifications.NotificationRequest[]> {
    return await Notifications.getAllScheduledNotificationsAsync();
  }

  // Cancel specific notification
  async cancelNotification(notificationId: string): Promise<void> {
    await Notifications.cancelScheduledNotificationAsync(notificationId);
  }

  // Cancel all notifications
  async cancelAllNotifications(): Promise<void> {
    await Notifications.cancelAllScheduledNotificationsAsync();
  }

  // Get push token
  getPushToken(): string | null {
    return this.expoPushToken;
  }

  // Listen for notification received
  addNotificationReceivedListener(
    listener: (notification: Notifications.Notification) => void
  ): Notifications.Subscription {
    return Notifications.addNotificationReceivedListener(listener);
  }

  // Listen for notification response (when user taps notification)
  addNotificationResponseReceivedListener(
    listener: (response: Notifications.NotificationResponse) => void
  ): Notifications.Subscription {
    return Notifications.addNotificationResponseReceivedListener(listener);
  }

  // Remove notification listeners
  removeNotificationSubscription(subscription: Notifications.Subscription): void {
    subscription.remove();
  }
}

// Export singleton instance
export const notificationService = NotificationService.getInstance();

// Helper function to format appointment time
export const formatAppointmentTime = (date: Date): string => {
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
};

// Helper function to schedule booking reminders
export const scheduleBookingReminders = async (
  bookingId: string,
  appointmentDate: Date,
  serviceName: string,
  barberName: string
): Promise<void> => {
  const service = notificationService;
  
  // Schedule reminder 30 minutes before
  const thirtyMinutesBefore = new Date(appointmentDate.getTime() - 30 * 60 * 1000);
  if (thirtyMinutesBefore > new Date()) {
    await service.sendBookingReminder(
      bookingId,
      serviceName,
      formatAppointmentTime(appointmentDate),
      barberName,
      30
    );
  }

  // Schedule reminder 24 hours before
  const oneDayBefore = new Date(appointmentDate.getTime() - 24 * 60 * 60 * 1000);
  if (oneDayBefore > new Date()) {
    await service.sendBookingReminder(
      bookingId,
      serviceName,
      formatAppointmentTime(appointmentDate),
      barberName,
      1440 // 24 hours in minutes
    );
  }
};
