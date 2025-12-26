import React from 'react';
import { View, Text, ViewStyle } from 'react-native';
import tw from 'twrnc';
import { theme } from '../../lib/theme';
import { LucideIcon, CheckCircle } from 'lucide-react-native';
import { Card, CardContent } from './Card';

interface Step {
  id: string;
  title: string;
  icon: LucideIcon;
}

interface ProgressIndicatorProps {
  steps: Step[];
  currentStep: number;
  progressPercentage: number;
  style?: ViewStyle | ViewStyle[];
}

export const ProgressIndicator: React.FC<ProgressIndicatorProps> = ({
  steps,
  currentStep,
  progressPercentage,
  style,
}) => {
  return (
    <Card style={[{ backgroundColor: 'rgba(255,255,255,0.05)', borderColor: 'rgba(255,255,255,0.1)' }, style]}>
      <CardContent style={tw`p-3`}>
        <View style={tw`flex-row items-center justify-between mb-2`}>
          <View style={tw`flex-row items-center`}>
            <Text style={[tw`text-xs font-medium`, { color: theme.colors.foreground }]}>
              Progress
            </Text>
          </View>
          <View style={[tw`px-2 py-1 rounded-full`, { backgroundColor: theme.colors.secondary + '20' }]}>
            <Text style={[tw`text-xs font-bold`, { color: theme.colors.secondary }]}>
              {Math.round(progressPercentage)}%
            </Text>
          </View>
        </View>
        
        <View style={[tw`h-2 rounded-full overflow-hidden mb-3`, { backgroundColor: 'rgba(255,255,255,0.1)' }]}>
          <View 
            style={[
              tw`h-full rounded-full`,
              { width: `${progressPercentage}%`, backgroundColor: theme.colors.secondary }
            ]} 
          />
        </View>
        
        <View style={tw`flex-row items-center justify-between`}>
          {steps.map((step, idx) => {
            const Icon = step.icon;
            const isActive = currentStep === idx;
            const isCompleted = currentStep > idx;
            
            return (
              <View key={step.id} style={tw`flex-1 flex-col items-center`}>
                <View style={[
                  tw`rounded-full border-2 w-6 h-6 items-center justify-center mb-1`,
                  isActive ? 
                    { borderColor: theme.colors.secondary, backgroundColor: 'rgba(255,255,255,0.2)' } :
                  isCompleted ?
                    { borderColor: theme.colors.secondary, backgroundColor: theme.colors.secondary } :
                    { borderColor: 'rgba(255,255,255,0.2)', backgroundColor: 'rgba(255,255,255,0.1)' }
                ]}>
                  {isCompleted ? (
                    <CheckCircle size={12} color={theme.colors.primaryForeground} />
                  ) : (
                    <Icon 
                      size={12} 
                      color={isActive ? theme.colors.secondary : 'rgba(255,255,255,0.6)'} 
                    />
                  )}
                </View>
                <Text style={[
                  tw`text-xs text-center`,
                  { color: isActive || isCompleted ? theme.colors.secondary : 'rgba(255,255,255,0.6)' }
                ]}>
                  {step.title}
                </Text>
              </View>
            );
          })}
        </View>
      </CardContent>
    </Card>
  );
};

export default ProgressIndicator;

