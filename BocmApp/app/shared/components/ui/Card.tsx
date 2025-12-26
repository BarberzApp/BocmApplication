import React from 'react';
import { View, Text, ViewStyle, TextStyle, StyleProp } from 'react-native';
import tw from 'twrnc';
import { theme } from '../../lib/theme';

interface CardProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  className?: string;
}

interface CardHeaderProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  className?: string;
}

interface CardContentProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  className?: string;
}

interface CardTitleProps {
  children: React.ReactNode;
  style?: StyleProp<TextStyle>;
  className?: string;
}

interface CardDescriptionProps {
  children: React.ReactNode;
  style?: StyleProp<TextStyle>;
  className?: string;
}

interface CardFooterProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  className?: string;
}

const Card: React.FC<CardProps> = ({ children, style, className }) => {
  return (
    <View 
      style={[
        tw`rounded-lg border shadow-sm`,
        { 
          backgroundColor: theme.colors.card,
          borderColor: theme.colors.border,
        },
        style
      ]}
    >
      {children}
    </View>
  );
};

const CardHeader: React.FC<CardHeaderProps> = ({ children, style, className }) => {
  return (
    <View style={[tw`flex flex-col space-y-1.5 p-6`, style]}>
      {children}
    </View>
  );
};

const CardTitle: React.FC<CardTitleProps> = ({ children, style, className }) => {
  return (
    <Text
      style={[
        tw`text-2xl font-semibold leading-none tracking-tight`,
        { color: theme.colors.cardForeground },
        style
      ]}
    >
      {children}
    </Text>
  );
};

const CardDescription: React.FC<CardDescriptionProps> = ({ children, style, className }) => {
  return (
    <Text
      style={[
        tw`text-sm`,
        { color: theme.colors.mutedForeground },
        style
      ]}
    >
      {children}
    </Text>
  );
};

const CardContent: React.FC<CardContentProps> = ({ children, style, className }) => {
  return (
    <View style={[tw`p-6 pt-0`, style]}>
      {children}
    </View>
  );
};

const CardFooter: React.FC<CardFooterProps> = ({ children, style, className }) => {
  return (
    <View style={[tw`flex items-center p-6 pt-0`, style]}>
      {children}
    </View>
  );
};

export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent };