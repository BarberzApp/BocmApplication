// navigation/AppNavigator.tsx
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { View, Text, Platform, TouchableOpacity, Dimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import {Home, Search, Settings as SettingsIcon, Calendar, Video, User } from 'lucide-react-native';
import HomePage from '../pages/HomePage';
import LoginPage from '../pages/LoginPage';
import SignUpPage from '../pages/SignUpPage';
import FindBarberPage from '../pages/FindBarberPage';
import BrowsePage from '../pages/BrowsePage';
import BookingCalendarPage from '../pages/BookingCalendarPage';
import BarberOnboardingPage from '../pages/BarberOnboardingPage';
import EmailConfirmationScreen from '../pages/EmailConfirmationScreen';
import BookingSuccessPage from '../pages/BookingSuccessPage';
import SettingsPage from '../pages/SettingsPage';
import TermsPage from '../pages/TermsPage';
import PrivacyPolicyPage from '../pages/PrivacyPolicyPage';
import ProfilePortfolio from '../pages/ProfilePortfolio';
import ProfilePreview from '../pages/ProfilePreview';
import tw from 'twrnc';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import CalendarPage from '../pages/CalendarPage';
import CutsPage from '../pages/CutsPage';
import { linking } from '../shared/config/deepLinking';
import { AuthGuard, BarberGuard } from '../shared/components/auth/AuthGuard';
import { ROUTE_MAPPING, isRouteProtected, getRouteRole } from '../shared/config/routeMapping';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

function GlassyTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const { width: screenWidth } = Dimensions.get('window');
  const insets = useSafeAreaInsets();
  const isSmallScreen = screenWidth < 375;
  
  // Get the center item (Cuts) and other items
  // const centerIndex = 2; // Cuts is the center item - commented out since Cuts tab is disabled
  // const leftItems = state.routes.slice(0, centerIndex);
  // const centerItem = state.routes[centerIndex];
  // const rightItems = state.routes.slice(centerIndex + 1);
  
  // All items are now regular items (no center highlight)
  const allItems = state.routes;

  // Responsive sizing
  const navHeight = isSmallScreen ? 45 : 45;
  const itemGap = isSmallScreen ? 6 : 8;
  const itemPadding = isSmallScreen ? 8 : 12;
  const iconSize = isSmallScreen ? 16 : 18;
  const textSize = isSmallScreen ? 7 : 9;

  return (
    <BlurView
      intensity={60}
      tint="dark"
      style={[
        tw`absolute left-0 right-0 bottom-0 flex-row items-center justify-center`,
        { 
          borderTopLeftRadius: 24, 
          borderTopRightRadius: 24, 
          backgroundColor: 'rgba(0, 0, 0, 0.3)', 
          borderTopWidth: 1, 
          borderColor: 'rgba(255, 255, 255, 0.10)',
          height: navHeight + insets.bottom,
          paddingHorizontal: itemPadding,
          paddingVertical: 4,
          paddingBottom: Math.max(insets.bottom, Platform.OS === 'ios' ? 3 : 2),
          gap: itemGap,
        }
      ]}
    >
      {/* Navigation items */}
      {allItems.map((route, index) => {
        const { options } = descriptors[route.key];
        const label = typeof options.tabBarLabel === 'string' ? options.tabBarLabel : route.name;
        const isFocused = state.index === index;
        const onPress = () => {
          const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          });
          if (!isFocused && !event.defaultPrevented) {
            navigation.navigate(route.name);
          }
        };

        let IconComponent = Search;
        if (route.name === 'Browse') IconComponent = Search;
        if (route.name === 'Calendar') IconComponent = Calendar;
        if (route.name === 'Profile') IconComponent = User;
        if (route.name === 'Settings') IconComponent = SettingsIcon;

        return (
          <TouchableOpacity
            key={route.key}
            onPress={onPress}
            style={[
              tw`flex flex-col items-center justify-center rounded-2xl`,
              {
                backgroundColor: isFocused ? 'rgba(180, 138, 60, 0.15)' : 'transparent',
                borderWidth: isFocused ? 1 : 0,
                borderColor: isFocused ? 'rgba(180, 138, 60, 0.3)' : 'transparent',
                paddingVertical: isSmallScreen ? 3 : 4,
                paddingHorizontal: isSmallScreen ? 8 : 10,
                minWidth: isSmallScreen ? 50 : 56,
              }
            ]}
          >
            <IconComponent
              size={iconSize}
              color={isFocused ? '#b48a3c' : 'rgba(255, 255, 255, 0.8)'}
              style={tw`mb-2`}
            />
            <Text
              style={[
                tw`font-semibold tracking-wide`,
                { 
                  color: isFocused ? '#b48a3c' : 'rgba(255, 255, 255, 0.8)',
                  fontSize: textSize,
                }
              ]}
            >
              {label}
            </Text>
          </TouchableOpacity>
        );
      })}

      {/* Center item (Cuts) - commented out since Cuts tab is disabled */}
      {/* {centerItem && (() => {
        const { options } = descriptors[centerItem.key];
        const label = typeof options.tabBarLabel === 'string' ? options.tabBarLabel : centerItem.name;
        const isFocused = state.index === centerIndex;
        const onPress = () => {
          const event = navigation.emit({
            type: 'tabPress',
            target: centerItem.key,
            canPreventDefault: true,
          });
          if (!isFocused && !event.defaultPrevented) {
            navigation.navigate(centerItem.name);
          }
        };

        return (
          <TouchableOpacity
            key={centerItem.key}
            onPress={onPress}
            style={[
              tw`flex flex-col items-center justify-center rounded-3xl`,
              {
                backgroundColor: '#b48a3c',
                borderWidth: 2,
                borderColor: 'rgba(180, 138, 60, 0.6)',
                shadowColor: '#b48a3c',
                shadowOffset: { width: 0, height: 8 },
                shadowOpacity: 0.4,
                shadowRadius: 16,
                elevation: 8,
                paddingVertical: isSmallScreen ? 4 : 5,
                paddingHorizontal: isSmallScreen ? 10 : 12,
                minWidth: isSmallScreen ? 60 : 68,
                transform: [{ scale: isSmallScreen ? 1.0 : 1.02 }],
              }
            ]}
          >
            <View style={[
              tw`absolute inset-0 rounded-3xl`,
              { backgroundColor: 'rgba(180, 138, 60, 0.3)', opacity: 0.6 }
            ]} />
            
            <Video
              size={iconSize}
              color="#000"
              style={tw`mb-2 relative z-10`}
            />
            <Text
              style={[
                tw`font-bold tracking-wide relative z-10`,
                { 
                  color: '#000',
                  fontSize: textSize,
                }
              ]}
            >
              {label}
            </Text>
          </TouchableOpacity>
        );
      })()} */}

      {/* Right navigation items - commented out since we're using allItems now */}
      {/* {rightItems.map((route, index) => {
        const { options } = descriptors[route.key];
        const label = typeof options.tabBarLabel === 'string' ? options.tabBarLabel : route.name;
        const actualIndex = centerIndex + 1 + index;
        const isFocused = state.index === actualIndex;
        const onPress = () => {
          const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          });
          if (!isFocused && !event.defaultPrevented) {
            navigation.navigate(route.name);
          }
        };

        let IconComponent = User;
        if (route.name === 'Profile') IconComponent = User;
        if (route.name === 'Settings') IconComponent = SettingsIcon;

        return (
          <TouchableOpacity
            key={route.key}
            onPress={onPress}
            style={[
              tw`flex flex-col items-center justify-center rounded-2xl`,
              {
                backgroundColor: isFocused ? 'rgba(180, 138, 60, 0.15)' : 'transparent',
                borderWidth: isFocused ? 1 : 0,
                borderColor: isFocused ? 'rgba(180, 138, 60, 0.3)' : 'transparent',
                paddingVertical: isSmallScreen ? 3 : 4,
                paddingHorizontal: isSmallScreen ? 8 : 10,
                minWidth: isSmallScreen ? 50 : 56,
              }
            ]}
          >
            <IconComponent
              size={iconSize}
              color={isFocused ? '#b48a3c' : 'rgba(255, 255, 255, 0.8)'}
              style={tw`mb-2`}
            />
            <Text
              style={[
                tw`font-semibold tracking-wide`,
                { 
                  color: isFocused ? '#b48a3c' : 'rgba(255, 255, 255, 0.8)',
                  fontSize: textSize,
                }
              ]}
            >
              {label}
            </Text>
          </TouchableOpacity>
        );
      })} */}
    </BlurView>
  );
}

function MainTabs() {
  const { width: screenWidth } = Dimensions.get('window');
  const isSmallScreen = screenWidth < 375;
  const navHeight = isSmallScreen ? 45 : 45;

  return (
    <AuthGuard>
      <Tab.Navigator
        screenOptions={{
          headerShown: false,
          tabBarShowLabel: false,
          tabBarStyle: {
            position: 'absolute',
            backgroundColor: 'transparent',
            borderTopWidth: 0,
            elevation: 0,
            height: navHeight,
          },
        }}
        tabBar={props => <GlassyTabBar {...props} />}
      >
        <Tab.Screen
          name="Browse"
          component={BrowsePage}
          options={{
            tabBarLabel: 'Browse',
            tabBarIcon: ({ color, size }) => <Search color={color} size={size} />, 
          }}
        />
        <Tab.Screen
          name="Calendar"
          component={CalendarPage}
          options={{
            tabBarLabel: 'Calendar',
            tabBarIcon: ({ color, size }) => <Calendar color={color} size={size} />, 
          }}
        />
        {/* TikTok-style feed page commented out */}
        {/* <Tab.Screen
          name="Cuts"
          component={CutsPage}
          options={{
            tabBarLabel: 'Cuts',
            tabBarIcon: ({ color, size }) => <Video color={color} size={size + 2} />, 
          }}
        /> */}
        <Tab.Screen
          name="Profile"
          component={ProfilePortfolio}
          options={{
            tabBarLabel: 'Profile',
            tabBarIcon: ({ color, size }) => <User color={color} size={size} />, 
          }}
        />
        <Tab.Screen
          name="Settings"
          component={SettingsPage}
          options={{
            tabBarLabel: 'Settings',
            tabBarIcon: ({ color, size }) => <SettingsIcon color={color} size={size} />, 
          }}
        />
      </Tab.Navigator>
    </AuthGuard>
  );
}

// Role-based route wrapper component
function RoleBasedRoute({ 
  component: Component, 
  requiredRole
}: { 
  component: React.ComponentType<any>; 
  requiredRole?: 'client' | 'barber' | 'admin';
}) {
  if (requiredRole === 'barber') {
    return (
      <BarberGuard>
        <Component />
      </BarberGuard>
    );
  }
  
  if (requiredRole === 'admin') {
    // TODO: Implement AdminGuard component
    return <Component />;
  }
  
  return <Component />;
}

export const AppNavigator = () => {
  return (
    <NavigationContainer linking={linking}>
      <Stack.Navigator initialRouteName="Home" screenOptions={{ headerShown: false }}>
        {/* Public screens - no auth required */}
        <Stack.Screen name="Home" component={HomePage} />
        <Stack.Screen name="Login" component={LoginPage} />
        <Stack.Screen name="SignUp" component={SignUpPage} />
        <Stack.Screen name="EmailConfirmation" component={EmailConfirmationScreen} />
        <Stack.Screen name="Terms" component={TermsPage} />
        <Stack.Screen name="PrivacyPolicy" component={PrivacyPolicyPage} />
        
        {/* Protected screens - auth required */}
        <Stack.Screen name="MainTabs" component={MainTabs} />
        <Stack.Screen name="ProfilePortfolio" component={ProfilePortfolio} />
        <Stack.Screen name="ProfilePreview" component={ProfilePreview} />
        <Stack.Screen name="Cuts" component={CutsPage} />
        <Stack.Screen name="Settings" component={SettingsPage} />
        <Stack.Screen name="BookingCalendar" component={BookingCalendarPage} />
        <Stack.Screen name="BookingSuccess" component={BookingSuccessPage} />
        
        {/* Role-based screens */}
        <Stack.Screen name="BarberOnboarding">
          {() => (
            <RoleBasedRoute 
              component={BarberOnboardingPage} 
              requiredRole="barber"
            />
          )}
        </Stack.Screen>
        
        {/* Admin screens */}
        <Stack.Screen name="SuperAdmin">
          {() => (
            <RoleBasedRoute 
              component={() => (
                <View style={tw`flex-1 justify-center items-center`}>
                  <Text style={tw`text-white text-xl`}>Admin Dashboard</Text>
                  <Text style={tw`text-gray-400 mt-2`}>Admin features coming soon</Text>
                </View>
              )} 
              requiredRole="admin"
            />
          )}
        </Stack.Screen>
      </Stack.Navigator>
    </NavigationContainer>
  );
};

export default AppNavigator;