/**
 * Types for user reporting and blocking functionality
 */

export type ReportType = 'user' | 'review' | 'video' | 'image' | 'comment' | 'profile';

export type ReportReason = 
  | 'spam'
  | 'harassment'
  | 'hate_speech'
  | 'inappropriate_content'
  | 'fraud'
  | 'fake_profile'
  | 'violence'
  | 'sexual_content'
  | 'other';

export interface Report {
  id: string;
  reporter_id: string;
  reported_user_id?: string;
  content_type: ReportType;
  content_id: string;
  reason: ReportReason;
  description?: string;
  status: 'pending' | 'reviewed' | 'resolved' | 'dismissed';
  created_at: string;
  updated_at: string;
  reviewed_at?: string;
  reviewed_by?: string;
}

export interface BlockedUser {
  id: string;
  user_id: string; // User who is blocking
  blocked_user_id: string; // User who is blocked
  created_at: string;
}

export interface ReportSubmission {
  contentType: ReportType;
  contentId: string;
  reportedUserId?: string;
  reason: ReportReason;
  description?: string;
}

export interface BlockUserParams {
  userIdToBlock: string;
}

