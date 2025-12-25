import React from 'react';
import { View, Text, TextInput, TextInputProps, ViewStyle } from 'react-native';
import tw from 'twrnc';
import { theme } from '../../lib/theme';

interface NumericInputProps extends Omit<TextInputProps, 'keyboardType' | 'value' | 'onChangeText'> {
  label: string;
  value: number;
  onChangeText: (value: number) => void;
  prefix?: string;
  suffix?: string;
  error?: string;
  containerStyle?: ViewStyle | ViewStyle[];
}

export const NumericInput: React.FC<NumericInputProps> = ({
  label,
  value,
  onChangeText,
  prefix,
  suffix,
  error,
  containerStyle,
  placeholder,
  ...props
}) => {
  return (
    <View style={[tw`flex-1`, containerStyle]}>
      <Text style={[tw`text-sm font-medium mb-2`, { color: theme.colors.foreground }]}>
        {label}
      </Text>
      <View style={tw`relative`}>
        {prefix && (
          <Text style={[
            tw`absolute left-4 top-3 text-base z-10`,
            { color: theme.colors.mutedForeground }
          ]}>
            {prefix}
          </Text>
        )}
        <TextInput
          style={[
            tw`px-4 py-3 rounded-xl text-base`,
            prefix && tw`pl-8`,
            suffix && tw`pr-8`,
            {
              backgroundColor: 'rgba(255,255,255,0.05)',
              color: theme.colors.foreground,
              borderWidth: 1,
              borderColor: error ? theme.colors.destructive : 'rgba(255,255,255,0.1)',
            }
          ]}
          placeholder={placeholder}
          placeholderTextColor={theme.colors.mutedForeground}
          value={value.toString()}
          onChangeText={(text) => {
            const numValue = text === '' ? 0 : parseFloat(text) || 0;
            onChangeText(numValue);
          }}
          keyboardType="numeric"
          {...props}
        />
        {suffix && (
          <Text style={[
            tw`absolute right-4 top-3 text-base`,
            { color: theme.colors.mutedForeground }
          ]}>
            {suffix}
          </Text>
        )}
      </View>
      {error && (
        <Text style={[tw`text-xs mt-1`, { color: theme.colors.destructive }]}>
          {error}
        </Text>
      )}
    </View>
  );
};

export default NumericInput;

