import React, { useEffect, useRef } from 'react';
import { View, Animated, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { theme } from '../lib/theme';

const { width, height } = Dimensions.get('window');

interface ParticleProps {
  delay: number;
  duration: number;
  startX: number;
  startY: number;
  size: number;
}

const Particle: React.FC<ParticleProps> = ({ delay, duration, startX, startY, size }) => {
  const animatedValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Speed up particle animation by reducing duration
    const fastDuration = duration * 0.5; 
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(animatedValue, {
          toValue: 1,
          duration: fastDuration,
          delay,
          useNativeDriver: true,
        }),
        Animated.timing(animatedValue, {
          toValue: 0,
          duration: fastDuration,
          useNativeDriver: true,
        }),
      ])
    );

    animation.start();

    return () => animation.stop();
  }, [duration]);

  const translateY = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -100],
  });

  const translateX = animatedValue.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0, Math.random() * 50 - 25, 0],
  });

  const opacity = animatedValue.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0, 0.8, 0],
  });

  const scale = animatedValue.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0, 1, 0],
  });

  return (
    <Animated.View
      style={{
        position: 'absolute',
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: theme.colors.secondary,
        left: startX,
        top: startY,
        transform: [{ translateY }, { translateX }, { scale }],
        opacity,
      }}
    />
  );
};

const LargeFloatingElement: React.FC<{ delay: number; index: number }> = ({ delay, index }) => {
  const animatedValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Speed up floating elements by 50%
    const baseDuration = (10000 + index * 2000) * 0.5;
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(animatedValue, {
          toValue: 1,
          duration: baseDuration,
          delay,
          useNativeDriver: true,
        }),
        Animated.timing(animatedValue, {
          toValue: 0,
          duration: baseDuration,
          useNativeDriver: true,
        }),
      ])
    );

    animation.start();

    return () => animation.stop();
  }, []);

  const translateY = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -30],
  });

  const scale = animatedValue.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [1, 1.2, 1],
  });

  const opacity = animatedValue.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0.3, 0.6, 0.3],
  });

  const size = Math.random() * 20 + 10;
  const left = 20 + index * 30;
  const top = 20 + index * 25;

  return (
    <Animated.View
      style={{
        position: 'absolute',
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: 'rgba(199, 142, 63, 0.1)',
        left: `${left}%`,
        top: `${top}%`,
        transform: [{ translateY }, { scale }],
        opacity,
      }}
    />
  );
};

export const AnimatedBackground: React.FC = () => {
  const backgroundOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(backgroundOpacity, {
      toValue: 1,
      duration: theme.animations.timing.BACKGROUND_FADE,
      useNativeDriver: false,
    }).start();
  }, []);

  // Generate particles - faster durations
  const particles = Array.from({ length: 8 }, (_, i) => ({
    delay: Math.random() * 2500, // Reduced from 5000
    duration: (Math.random() * 8000 + 6000) * 0.5, // 50% faster
    startX: Math.random() * width,
    startY: Math.random() * height,
    size: Math.random() * 4 + 2,
  }));

  return (
    <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
      {/* Base gradient background */}
      <Animated.View style={{ flex: 1, opacity: backgroundOpacity }}>
        <LinearGradient
          colors={theme.gradients.background}
          style={{ flex: 1 }}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
        />
      </Animated.View>

      {/* Radial gradient overlays */}
      <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
        <LinearGradient
          colors={['rgba(199, 142, 63, 0.15)', 'transparent']}
          style={{
            position: 'absolute',
            width: 200,
            height: 200,
            borderRadius: 100,
            top: '80%',
            left: '20%',
          }}
        />
        <LinearGradient
          colors={['rgba(141, 114, 80, 0.1)', 'transparent']}
          style={{
            position: 'absolute',
            width: 200,
            height: 200,
            borderRadius: 100,
            top: '20%',
            left: '80%',
          }}
        />
      </View>

      {/* Floating particles */}
      {particles.map((particle, index) => (
        <Particle key={index} {...particle} />
      ))}

      {/* Larger floating elements */}
      {Array.from({ length: 3 }, (_, index) => (
        <LargeFloatingElement key={`large-${index}`} delay={index * 2000} index={index} />
      ))}

      {/* Subtle overlay for depth */}
      <LinearGradient
        colors={['transparent', 'rgba(39, 42, 47, 0.3)']}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
        }}
      />
    </View>
  );
};
