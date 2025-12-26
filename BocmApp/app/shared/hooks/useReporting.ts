/**
 * Hook for reporting and blocking functionality
 */

import { useState, useCallback } from 'react';
import { Alert } from 'react-native';
import { reportingService } from '../services/reportingService';
import { logger } from '../lib/logger';
import * as Haptics from 'expo-haptics';
import type { BlockUserParams } from '../types/reporting.types';

export function useReporting() {
  const [isBlocking, setIsBlocking] = useState(false);
  const [blockedUsers, setBlockedUsers] = useState<string[]>([]);

  const blockUser = useCallback(async (userId: string, userName?: string) => {
    try {
      setIsBlocking(true);
      await reportingService.blockUser({ userIdToBlock: userId });
      setBlockedUsers((prev) => [...prev, userId]);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      
      Alert.alert(
        'User Blocked',
        userName
          ? `${userName} has been blocked. You will no longer see their content.`
          : 'This user has been blocked. You will no longer see their content.',
        [{ text: 'OK' }]
      );
    } catch (error: any) {
      logger.error('Error blocking user:', error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      
      if (error.message?.includes('already blocked')) {
        Alert.alert('Already Blocked', 'This user is already blocked.');
      } else {
        Alert.alert('Error', error.message || 'Failed to block user. Please try again.');
      }
    } finally {
      setIsBlocking(false);
    }
  }, []);

  const unblockUser = useCallback(async (userId: string, userName?: string) => {
    try {
      setIsBlocking(true);
      await reportingService.unblockUser(userId);
      setBlockedUsers((prev) => prev.filter((id) => id !== userId));
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      
      Alert.alert(
        'User Unblocked',
        userName
          ? `${userName} has been unblocked.`
          : 'This user has been unblocked.',
        [{ text: 'OK' }]
      );
    } catch (error: any) {
      logger.error('Error unblocking user:', error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Error', error.message || 'Failed to unblock user. Please try again.');
    } finally {
      setIsBlocking(false);
    }
  }, []);

  const checkIfBlocked = useCallback(async (userId: string): Promise<boolean> => {
    try {
      return await reportingService.isUserBlocked(userId);
    } catch (error) {
      logger.error('Error checking if user is blocked:', error);
      return false;
    }
  }, []);

  const loadBlockedUsers = useCallback(async () => {
    try {
      const blocked = await reportingService.getBlockedUsers();
      setBlockedUsers(blocked.map((b) => b.blocked_user_id));
    } catch (error) {
      logger.error('Error loading blocked users:', error);
    }
  }, []);

  return {
    blockUser,
    unblockUser,
    checkIfBlocked,
    loadBlockedUsers,
    isBlocking,
    blockedUsers,
  };
}

