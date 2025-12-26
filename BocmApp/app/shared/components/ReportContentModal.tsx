/**
 * Modal component for reporting inappropriate content or users
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  ScrollView,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { X, AlertCircle, Shield } from 'lucide-react-native';
import tw from 'twrnc';
import { theme } from '../lib/theme';
import { reportingService } from '../services/reportingService';
import { logger } from '../lib/logger';
import type { ReportType, ReportReason } from '../types/reporting.types';

interface ReportContentModalProps {
  visible: boolean;
  onClose: () => void;
  contentType: ReportType;
  contentId: string;
  reportedUserId?: string;
  contentDescription?: string; // For display purposes (e.g., user name, review preview)
}

const REPORT_REASONS: { value: ReportReason; label: string; description: string }[] = [
  {
    value: 'spam',
    label: 'Spam',
    description: 'Repetitive, unwanted, or promotional content',
  },
  {
    value: 'harassment',
    label: 'Harassment or Bullying',
    description: 'Content that targets, intimidates, or threatens someone',
  },
  {
    value: 'hate_speech',
    label: 'Hate Speech',
    description: 'Content that attacks people based on protected characteristics',
  },
  {
    value: 'inappropriate_content',
    label: 'Inappropriate Content',
    description: 'Content that violates community guidelines',
  },
  {
    value: 'fraud',
    label: 'Fraud or Scam',
    description: 'Suspicious or fraudulent activity',
  },
  {
    value: 'fake_profile',
    label: 'Fake Profile',
    description: 'Profile appears to be fake or impersonating someone',
  },
  {
    value: 'violence',
    label: 'Violence or Threats',
    description: 'Content promoting or threatening violence',
  },
  {
    value: 'sexual_content',
    label: 'Sexual Content',
    description: 'Explicit or inappropriate sexual content',
  },
  {
    value: 'other',
    label: 'Other',
    description: 'Something else that violates our guidelines',
  },
];

export function ReportContentModal({
  visible,
  onClose,
  contentType,
  contentId,
  reportedUserId,
  contentDescription,
}: ReportContentModalProps) {
  const [selectedReason, setSelectedReason] = useState<ReportReason | null>(null);
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleReasonSelect = (reason: ReportReason) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedReason(reason);
  };

  const handleSubmit = async () => {
    if (!selectedReason) {
      Alert.alert('Required', 'Please select a reason for reporting');
      return;
    }

    setIsSubmitting(true);

    try {
      await reportingService.submitReport({
        contentType,
        contentId,
        reportedUserId,
        reason: selectedReason,
        description: description.trim() || undefined,
      });

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert(
        'Report Submitted',
        'Thank you for your report. We will review it and take appropriate action.',
        [
          {
            text: 'OK',
            onPress: () => {
              handleClose();
            },
          },
        ]
      );
    } catch (error: any) {
      logger.error('Error submitting report:', error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert(
        'Error',
        error.message || 'Failed to submit report. Please try again later.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setSelectedReason(null);
    setDescription('');
    onClose();
  };

  const getContentTypeLabel = (type: ReportType): string => {
    switch (type) {
      case 'user':
      case 'profile':
        return 'this profile';
      case 'review':
        return 'this review';
      case 'video':
        return 'this video';
      case 'image':
        return 'this image';
      case 'comment':
        return 'this comment';
      default:
        return 'this content';
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleClose}
    >
      <BlurView intensity={50} style={tw`flex-1 justify-center items-center p-6`}>
        <View
          style={[
            tw`w-full max-w-md rounded-3xl overflow-hidden`,
            {
              backgroundColor: 'rgba(0, 0, 0, 0.85)',
              borderWidth: 1,
              borderColor: 'rgba(255, 255, 255, 0.1)',
            },
          ]}
        >
          {/* Header */}
          <View style={tw`p-6 pb-4 border-b border-white/10`}>
            <View style={tw`flex-row items-center justify-between mb-4`}>
              <View style={tw`flex-row items-center`}>
                <View
                  style={[
                    tw`w-12 h-12 rounded-full items-center justify-center mr-3`,
                    { backgroundColor: theme.colors.destructive + '20' },
                  ]}
                >
                  <Shield size={24} color={theme.colors.destructive} />
                </View>
                <View>
                  <Text style={[tw`text-xl font-bold`, { color: theme.colors.foreground }]}>
                    Report Content
                  </Text>
                  <Text style={[tw`text-sm mt-1`, { color: theme.colors.mutedForeground }]}>
                    Why are you reporting {getContentTypeLabel(contentType)}?
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                onPress={handleClose}
                disabled={isSubmitting}
                style={tw`p-2`}
              >
                <X size={24} color={theme.colors.mutedForeground} />
              </TouchableOpacity>
            </View>

            {contentDescription && (
              <View
                style={[
                  tw`p-3 rounded-xl mt-2`,
                  { backgroundColor: 'rgba(255, 255, 255, 0.05)' },
                ]}
              >
                <Text style={[tw`text-sm`, { color: theme.colors.mutedForeground }]}>
                  {contentDescription}
                </Text>
              </View>
            )}
          </View>

          {/* Content */}
          <ScrollView
            style={tw`flex-1`}
            contentContainerStyle={tw`p-6`}
            showsVerticalScrollIndicator={false}
          >
            {/* Report Reasons */}
            <View style={tw`mb-6`}>
              {REPORT_REASONS.map((reason) => (
                <TouchableOpacity
                  key={reason.value}
                  onPress={() => handleReasonSelect(reason.value)}
                  disabled={isSubmitting}
                  style={[
                    tw`p-4 rounded-xl mb-3 border`,
                    selectedReason === reason.value
                      ? {
                          backgroundColor: theme.colors.destructive + '20',
                          borderColor: theme.colors.destructive,
                        }
                      : {
                          backgroundColor: 'rgba(255, 255, 255, 0.05)',
                          borderColor: 'rgba(255, 255, 255, 0.1)',
                        },
                  ]}
                >
                  <View style={tw`flex-row items-start`}>
                    <View
                      style={[
                        tw`w-5 h-5 rounded-full border-2 items-center justify-center mr-3 mt-0.5`,
                        selectedReason === reason.value
                          ? {
                              borderColor: theme.colors.destructive,
                              backgroundColor: theme.colors.destructive,
                            }
                          : { borderColor: theme.colors.mutedForeground },
                      ]}
                    >
                      {selectedReason === reason.value && (
                        <View
                          style={[
                            tw`w-2.5 h-2.5 rounded-full`,
                            { backgroundColor: theme.colors.background },
                          ]}
                        />
                      )}
                    </View>
                    <View style={tw`flex-1`}>
                      <Text
                        style={[
                          tw`font-semibold mb-1`,
                          {
                            color:
                              selectedReason === reason.value
                                ? theme.colors.destructive
                                : theme.colors.foreground,
                          },
                        ]}
                      >
                        {reason.label}
                      </Text>
                      <Text
                        style={[tw`text-sm`, { color: theme.colors.mutedForeground }]}
                      >
                        {reason.description}
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>
              ))}
            </View>

            {/* Additional Details */}
            <View style={tw`mb-6`}>
              <Text style={[tw`font-semibold mb-2`, { color: theme.colors.foreground }]}>
                Additional Details (Optional)
              </Text>
              <TextInput
                style={[
                  tw`p-4 rounded-xl text-base min-h-[100px]`,
                  {
                    backgroundColor: 'rgba(255, 255, 255, 0.05)',
                    borderWidth: 1,
                    borderColor: 'rgba(255, 255, 255, 0.1)',
                    color: theme.colors.foreground,
                    textAlignVertical: 'top',
                  },
                ]}
                placeholder="Provide any additional information that might help us review this report..."
                placeholderTextColor={theme.colors.mutedForeground}
                value={description}
                onChangeText={setDescription}
                multiline
                numberOfLines={4}
                editable={!isSubmitting}
                maxLength={500}
              />
              <Text style={[tw`text-xs mt-1 text-right`, { color: theme.colors.mutedForeground }]}>
                {description.length}/500
              </Text>
            </View>

            {/* Info Message */}
            <View
              style={[
                tw`p-4 rounded-xl flex-row items-start`,
                { backgroundColor: 'rgba(59, 130, 246, 0.1)' },
              ]}
            >
              <AlertCircle size={20} color="#3b82f6" style={tw`mr-3 mt-0.5`} />
              <Text style={[tw`text-sm flex-1`, { color: 'rgba(255, 255, 255, 0.8)' }]}>
                Reports are reviewed by our moderation team. We take all reports seriously
                and will take appropriate action.
              </Text>
            </View>
          </ScrollView>

          {/* Footer */}
          <View
            style={[
              tw`p-6 pt-4 border-t border-white/10 flex-row gap-3`,
              { backgroundColor: 'rgba(0, 0, 0, 0.3)' },
            ]}
          >
            <TouchableOpacity
              onPress={handleClose}
              disabled={isSubmitting}
              style={[
                tw`flex-1 py-4 rounded-xl items-center`,
                {
                  backgroundColor: 'rgba(255, 255, 255, 0.1)',
                  opacity: isSubmitting ? 0.5 : 1,
                },
              ]}
            >
              <Text style={[tw`font-semibold`, { color: theme.colors.foreground }]}>
                Cancel
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleSubmit}
              disabled={!selectedReason || isSubmitting}
              style={[
                tw`flex-1 py-4 rounded-xl items-center`,
                {
                  backgroundColor:
                    selectedReason && !isSubmitting
                      ? theme.colors.destructive
                      : 'rgba(255, 255, 255, 0.1)',
                  opacity: !selectedReason || isSubmitting ? 0.5 : 1,
                },
              ]}
            >
              {isSubmitting ? (
                <ActivityIndicator size="small" color={theme.colors.foreground} />
              ) : (
                <Text
                  style={[
                    tw`font-semibold`,
                    {
                      color:
                        selectedReason && !isSubmitting
                          ? theme.colors.destructiveForeground
                          : theme.colors.mutedForeground,
                    },
                  ]}
                >
                  Submit Report
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </BlurView>
    </Modal>
  );
}

