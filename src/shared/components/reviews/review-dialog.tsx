import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/shared/components/ui/dialog';
import { ReviewForm } from './review-form';
import { useReviews } from '@/shared/hooks/use-reviews';
import { useToast } from '@/shared/components/ui/use-toast';
import { logger } from '@/shared/lib/logger';

interface ReviewDialogProps {
  open: boolean;
  onClose: () => void;
  bookingId: string;
  barberId: string;
  barberName?: string;
  serviceName?: string;
}

export function ReviewDialog({
  open,
  onClose,
  bookingId,
  barberId,
  barberName,
  serviceName
}: ReviewDialogProps) {
  const { submitReview, submitting } = useReviews(barberId);
  const { toast } = useToast();

  const handleSubmit = async (data: { rating: number; comment?: string }) => {
    try {
      await submitReview({
        booking_id: bookingId,
        barber_id: barberId,
        rating: data.rating,
        comment: data.comment
      });
      
      onClose();
    } catch (error) {
      logger.error('Error submitting review', error);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md w-full bg-white/5 border border-white/10 backdrop-blur-xl rounded-2xl shadow-2xl p-6">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-white">
            Leave a Review
          </DialogTitle>
          <DialogDescription className="text-white/80">
            {barberName && serviceName && (
              <span>
                Share your experience with <strong>{barberName}</strong> for your <strong>{serviceName}</strong> service.
              </span>
            )}
          </DialogDescription>
        </DialogHeader>
        
        <ReviewForm
          onSubmit={handleSubmit}
          onCancel={onClose}
          submitting={submitting}
        />
      </DialogContent>
    </Dialog>
  );
} 