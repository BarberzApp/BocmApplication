import React from 'react';
import { View, Text, ViewStyle } from 'react-native';
import tw from 'twrnc';
import { theme } from '../../lib/theme';
import { LucideIcon } from 'lucide-react-native';

interface SectionHeaderProps {
  title: string;
  icon?: LucideIcon;
  description?: string;
  style?: ViewStyle | ViewStyle[];
}

export const SectionHeader: React.FC<SectionHeaderProps> = ({
  title,
  icon: Icon,
  description,
  style,
}) => {
  return (
    <View style={[tw`mb-4`, style]}>
      <View style={tw`flex-row items-center mb-2`}>
        {Icon && <Icon size={20} color={theme.colors.secondary} style={tw`mr-2`} />}
        <Text style={[tw`text-lg font-semibold`, { color: theme.colors.foreground }]}>
          {title}
        </Text>
      </View>
      {description && (
        <Text style={[tw`text-sm`, { color: theme.colors.mutedForeground }]}>
          {description}
        </Text>
      )}
    </View>
  );
};

export default SectionHeader;

