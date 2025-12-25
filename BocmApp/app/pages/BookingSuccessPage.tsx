// screens/BookingSuccessPage.tsx
import React, { useEffect } from 'react';
import {
  View,
  Text,
  SafeAreaView,
  TouchableOpacity,
  Linking,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import tw from 'twrnc';
const Icon = require('react-native-vector-icons/Feather').default;
import { theme } from '../shared/lib/theme';
import { RootStackParamList } from '../shared/types';

type BookingSuccessNavigationProp = NativeStackNavigationProp<RootStackParamList, 'BookingSuccess'>;

export default function BookingSuccessPage() {
  const navigation = useNavigation<BookingSuccessNavigationProp>();

  useEffect(() => {
    // Handle deep link from Stripe success redirect
    const handleDeepLink = (url: string) => {
      if (url.includes('booking-success')) {
        // Do something later
      }
    };

    const subscription = Linking.addEventListener('url', (event) => {
      handleDeepLink(event.url);
    });

    return () => {
      subscription.remove();
    };
  }, []);

  return (
    <SafeAreaView style={[tw`flex-1`, { backgroundColor: theme.colors.background }]}>
      <View style={tw`flex-1 items-center justify-center px-8`}>
        <View style={[tw`w-20 h-20 rounded-full items-center justify-center mb-6`, { backgroundColor: theme.colors.accent }]}>
          <Icon name="check" size={40} color={theme.colors.accent} />
        </View>
        
        <Text style={tw`text-2xl font-bold text-white text-center mb-2`}>
          You&apos;re All Set!
        </Text>
        
        <Text style={[tw`text-center mb-8`, { color: theme.colors.mutedForeground }]}>
          Your appointment has been successfully booked. You&apos;ll receive a confirmation email shortly.
        </Text>

        <TouchableOpacity
          style={[tw`w-full py-4 rounded-full mb-3`, { backgroundColor: theme.colors.secondary }]}
          onPress={() => navigation.navigate('FindBarber')}
        >
          <Text style={[tw`text-center font-semibold`, { color: theme.colors.primaryForeground }]}>
            Book Another Appointment
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[tw`w-full py-4 rounded-full`, { backgroundColor: 'rgba(255,255,255,0.05)' }]}
          onPress={() => navigation.navigate('MainTabs', { screen: 'Browse' })}
        >
          <Text style={[tw`text-center font-medium`, { color: theme.colors.foreground }]}>
            Back to Browse
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}