/**
 * Deletion Guard Utility
 * 
 * This utility provides centralized deletion prevention and monitoring
 * to prevent unwanted booking deletions and track all deletion operations.
 */

import { logger } from './logger'

export interface DeletionAttempt {
  id: string;
  timestamp: string;
  reason: string;
  source: string;
  prevented: boolean;
  details?: string;
}

class DeletionGuard {
  private deletionAttempts: DeletionAttempt[] = [];
  private readonly MAX_LOG_SIZE = 1000;

  /**
   * Check if a deletion should be allowed
   */
  shouldAllowDeletion(id: string, reason: string, source: string): boolean {
    // Prevent deletions in production without proper authorization
    if (process.env.NODE_ENV === 'production') {
      // Only allow specific reasons in production
      const allowedReasons = ['user_cancellation', 'admin_action', 'system_cleanup'];
      if (!allowedReasons.includes(reason)) {
        this.logAttempt(id, reason, source, true, 'Reason not allowed in production');
        return false;
      }
    }

    // Prevent deletion of confirmed bookings without explicit confirmation
    if (reason === 'manual' && source === 'ui') {
      this.logAttempt(id, reason, source, true, 'Manual deletion requires explicit confirmation');
      return false;
    }

    this.logAttempt(id, reason, source, false);
    return true;
  }

  /**
   * Log a deletion attempt
   */
  private logAttempt(id: string, reason: string, source: string, prevented: boolean, details?: string) {
    const attempt: DeletionAttempt = {
      id,
      timestamp: new Date().toISOString(),
      reason,
      source,
      prevented,
      details
    };

    this.deletionAttempts.push(attempt);

    // Keep log size manageable
    if (this.deletionAttempts.length > this.MAX_LOG_SIZE) {
      this.deletionAttempts = this.deletionAttempts.slice(-this.MAX_LOG_SIZE);
    }

    // Log using logger
    if (prevented) {
      logger.warn('Deletion prevented', attempt);
    } else {
      logger.debug('Deletion allowed', attempt);
    }
  }

  /**
   * Get all deletion attempts
   */
  getDeletionAttempts(): DeletionAttempt[] {
    return [...this.deletionAttempts];
  }

  /**
   * Get recent deletion attempts
   */
  getRecentAttempts(limit: number = 50): DeletionAttempt[] {
    return this.deletionAttempts.slice(-limit);
  }

  /**
   * Get prevented deletion attempts
   */
  getPreventedAttempts(): DeletionAttempt[] {
    return this.deletionAttempts.filter(attempt => attempt.prevented);
  }

  /**
   * Clear deletion log
   */
  clearLog(): void {
    this.deletionAttempts = [];
  }

  /**
   * Get deletion statistics
   */
  getStats() {
    const total = this.deletionAttempts.length;
    const prevented = this.deletionAttempts.filter(a => a.prevented).length;
    const allowed = total - prevented;

    return {
      total,
      prevented,
      allowed,
      preventionRate: total > 0 ? (prevented / total) * 100 : 0
    };
  }
}

// Export singleton instance
export const deletionGuard = new DeletionGuard();
