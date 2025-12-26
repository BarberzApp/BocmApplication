import React, { useState, useEffect } from 'react';
import {
  View,
  SafeAreaView,
  StatusBar,
  Animated,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { theme } from '../shared/lib/theme';
import { AnimatedBackground } from '../shared/components/AnimatedBackground';
import { AnimatedLogo } from '../shared/components/AnimatedLogo';
import { AnimatedText } from '../shared/components/AnimatedText';
import { ActionButton } from '../shared/components/ActionButton';

type HomeScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Home'>;

export default function HomePage() {
  const navigation = useNavigation<HomeScreenNavigationProp>();
  const [showContent, setShowContent] = useState(false);
  const [showButtons, setShowButtons] = useState(false);
  const [showSocialProof, setShowSocialProof] = useState(false);

  useEffect(() => {
    // Staggered content appearance - sped up
    const contentTimer = setTimeout(() => setShowContent(true), 200); // Reduced from 500
    const buttonsTimer = setTimeout(() => setShowButtons(true), 1200); // Reduced from 2500
    const socialProofTimer = setTimeout(() => setShowSocialProof(true), 1500); // Reduced from 3000

    return () => {
      clearTimeout(contentTimer);
      clearTimeout(buttonsTimer);
      clearTimeout(socialProofTimer);
    };
  }, []);

  const handleGetStarted = () => {
    navigation.navigate('SignUp' as never);
  };

  const handleLogin = () => {
    navigation.navigate('Login' as never);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <StatusBar barStyle="light-content" backgroundColor={theme.colors.background} />
      
      {/* Animated Background */}
      <AnimatedBackground />
      
      {/* Main Content Container */}
      <View style={{ 
        flex: 1, 
        justifyContent: 'center', 
        alignItems: 'center', 
        paddingHorizontal: 32,
        paddingVertical: 24,
      }}>
        
        {/* Logo Section */}
        <View style={{ marginBottom: 48, alignItems: 'center' }}>
          <AnimatedLogo />
        </View>

        {/* Text Content */}
        {showContent && (
          <View style={{ alignItems: 'center', marginBottom: 48 }}>
            <View style={{ marginBottom: 24 }}>
              <AnimatedText
                text="Welcome to"
                type="welcome"
                delay={400}
              />
            </View>

            <View style={{ marginBottom: 32 }}>
              <AnimatedText
                text="BOCM"
                type="title"
                delay={600}
              />
            </View>

            <View style={{ marginBottom: 48 }}>
              <AnimatedText
                text="The future of booking"
                type="tagline"
                delay={800}
              />
            </View>
          </View>
        )}

        {/* Action Buttons */}
        {showButtons && (
          <View style={{ width: '100%', marginBottom: 48 }}>
            <ActionButton 
              variant="primary" 
              icon
              onPress={handleGetStarted}
            >
              Get Started Free
            </ActionButton>
            
            <ActionButton 
              variant="secondary"
              onPress={handleLogin}
            >
              Log In
            </ActionButton>
          </View>
        )}

        {/* Footer */}
        <View style={{ 
          position: 'absolute', 
          bottom: 24, 
          left: 0, 
          right: 0, 
          alignItems: 'center',
          paddingHorizontal: 32,
        }}>
          <View style={{
            paddingVertical: 16,
            paddingHorizontal: 24,
            borderRadius: 16,
            backgroundColor: 'rgba(255, 255, 255, 0.05)',
            backdropFilter: 'blur(10px)',
          }}>
            <Animated.Text
              style={{
                fontSize: 12,
                color: 'rgba(255, 255, 255, 0.6)',
                textAlign: 'center',
                marginBottom: 4,
              }}
            >
              BOCM
            </Animated.Text>
            <Animated.Text
              style={{
                fontSize: 10,
                color: 'rgba(255, 255, 255, 0.4)',
                textAlign: 'center',
              }}
            >
              © 2025 BOCM. All rights reserved.
            </Animated.Text>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

// Type definitions
type RootStackParamList = {
  Home: undefined;
  Login: undefined;
  SignUp: undefined;
  MainTabs: undefined;
};