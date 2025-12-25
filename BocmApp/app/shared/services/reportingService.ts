/**
 * Service for handling user reporting and blocking functionality
 */

import { supabase } from '../lib/supabase';
import { logger } from '../lib/logger';
import type { ReportSubmission, BlockUserParams, Report, BlockedUser, ReportType } from '../types/reporting.types';

export const reportingService = {
  /**
   * Submit a report for inappropriate content or user behavior
   */
  async submitReport(report: ReportSubmission): Promise<Report> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('User must be authenticated to submit a report');
      }

      const reportData = {
        reporter_id: user.id,
        reported_user_id: report.reportedUserId || null,
        content_type: report.contentType,
        content_id: report.contentId,
        reason: report.reason,
        description: report.description || null,
        status: 'pending',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const { data, error } = await supabase
        .from('reports')
        .insert(reportData)
        .select()
        .single();

      if (error) {
        logger.error('Error submitting report:', error);
        throw error;
      }

      logger.log('Report submitted successfully:', data.id);
      return data;
    } catch (error) {
      logger.error('Error in submitReport:', error);
      throw error;
    }
  },

  /**
   * Block a user
   */
  async blockUser(params: BlockUserParams): Promise<BlockedUser> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('User must be authenticated to block a user');
      }

      if (user.id === params.userIdToBlock) {
        throw new Error('Cannot block yourself');
      }

      // Check if already blocked
      const { data: existingBlock } = await supabase
        .from('blocked_users')
        .select('id')
        .eq('user_id', user.id)
        .eq('blocked_user_id', params.userIdToBlock)
        .maybeSingle();

      if (existingBlock) {
        logger.log('User already blocked');
        throw new Error('User is already blocked');
      }

      const blockData = {
        user_id: user.id,
        blocked_user_id: params.userIdToBlock,
        created_at: new Date().toISOString(),
      };

      const { data, error } = await supabase
        .from('blocked_users')
        .insert(blockData)
        .select()
        .single();

      if (error) {
        logger.error('Error blocking user:', error);
        throw error;
      }

      logger.log('User blocked successfully:', params.userIdToBlock);
      return data;
    } catch (error) {
      logger.error('Error in blockUser:', error);
      throw error;
    }
  },

  /**
   * Unblock a user
   */
  async unblockUser(userIdToUnblock: string): Promise<void> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('User must be authenticated to unblock a user');
      }

      const { error } = await supabase
        .from('blocked_users')
        .delete()
        .eq('user_id', user.id)
        .eq('blocked_user_id', userIdToUnblock);

      if (error) {
        logger.error('Error unblocking user:', error);
        throw error;
      }

      logger.log('User unblocked successfully:', userIdToUnblock);
    } catch (error) {
      logger.error('Error in unblockUser:', error);
      throw error;
    }
  },

  /**
   * Check if a user is blocked
   */
  async isUserBlocked(userId: string): Promise<boolean> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        return false;
      }

      const { data, error } = await supabase
        .from('blocked_users')
        .select('id')
        .eq('user_id', user.id)
        .eq('blocked_user_id', userId)
        .maybeSingle();

      if (error) {
        logger.error('Error checking if user is blocked:', error);
        return false;
      }

      return !!data;
    } catch (error) {
      logger.error('Error in isUserBlocked:', error);
      return false;
    }
  },

  /**
   * Get all users blocked by the current user
   */
  async getBlockedUsers(): Promise<BlockedUser[]> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        return [];
      }

      const { data, error } = await supabase
        .from('blocked_users')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        logger.error('Error fetching blocked users:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      logger.error('Error in getBlockedUsers:', error);
      return [];
    }
  },

  /**
   * Check if current user has already reported specific content
   */
  async hasReportedContent(contentType: ReportType, contentId: string): Promise<boolean> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        return false;
      }

      const { data, error } = await supabase
        .from('reports')
        .select('id')
        .eq('reporter_id', user.id)
        .eq('content_type', contentType)
        .eq('content_id', contentId)
        .maybeSingle();

      if (error) {
        logger.error('Error checking if content reported:', error);
        return false;
      }

      return !!data;
    } catch (error) {
      logger.error('Error in hasReportedContent:', error);
      return false;
    }
  },
};

