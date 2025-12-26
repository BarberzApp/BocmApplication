import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/shared/lib/supabase';
import { useToast } from '@/shared/components/ui/use-toast';
import { Review, ReviewStats } from '@/shared/types';
import { logger } from '@/shared/lib/logger';

export function useReviews(barberId?: string) {
  const { toast } = useToast();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [stats, setStats] = useState<ReviewStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Fetch reviews for a barber
  const fetchReviews = useCallback(async (id?: string) => {
    if (!id) return;
    
    try {
      setLoading(true);
      
              const { data, error } = await supabase
          .from('reviews')
          .select(`
            *,
            client:client_id(
              id,
              name,
              avatar_url,
              username
            ),
            barber:barber_id(
              id,
              user_id,
              business_name
            ),
            booking:booking_id(
              id,
              date,
              service_id,
              service:service_id(
                name
              )
            )
          `)
        .eq('barber_id', id)
        .eq('is_public', true)
        .eq('is_moderated', true)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setReviews(data || []);
    } catch (error) {
      logger.error('Error fetching reviews', error);
      toast({
        title: 'Error',
        description: 'Failed to load reviews.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  // Fetch review stats for a barber
  const fetchReviewStats = useCallback(async (id?: string) => {
    if (!id) return;
    
    try {
      const { data, error } = await supabase
        .from('reviews')
        .select('rating, created_at')
        .eq('barber_id', id)
        .eq('is_public', true)
        .eq('is_moderated', true);

      if (error) throw error;

      const totalReviews = data?.length || 0;
      const averageRating = totalReviews > 0 
        ? data!.reduce((sum, review) => sum + review.rating, 0) / totalReviews 
        : 0;

      const ratingDistribution: { [key: number]: number } = {};
      for (let i = 1; i <= 5; i++) {
        ratingDistribution[i] = data?.filter(r => r.rating === i).length || 0;
      }

      const recentReviews = data?.slice(0, 5) || [];

      setStats({
        total_reviews: totalReviews,
        average_rating: Math.round(averageRating * 100) / 100,
        rating_distribution: ratingDistribution,
        recent_reviews: recentReviews as Review[]
      });
    } catch (error) {
      logger.error('Error fetching review stats', error);
    }
  }, []);

  // Submit a new review
  const submitReview = useCallback(async (reviewData: {
    booking_id: string;
    barber_id: string;
    rating: number;
    comment?: string;
  }) => {
    try {
      setSubmitting(true);
      
      const { data, error } = await supabase
        .from('reviews')
        .insert({
          ...reviewData,
          client_id: (await supabase.auth.getUser()).data.user?.id
        })
        .select()
        .single();

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Review submitted successfully!',
      });

      // Refresh reviews and stats
      await fetchReviews(reviewData.barber_id);
      await fetchReviewStats(reviewData.barber_id);

      return data;
    } catch (error) {
      logger.error('Error submitting review', error);
      toast({
        title: 'Error',
        description: 'Failed to submit review. Please try again.',
        variant: 'destructive',
      });
      throw error;
    } finally {
      setSubmitting(false);
    }
  }, [fetchReviews, fetchReviewStats, toast]);

  // Update a review
  const updateReview = useCallback(async (reviewId: string, updates: {
    rating?: number;
    comment?: string;
  }) => {
    try {
      setSubmitting(true);
      
      const { data, error } = await supabase
        .from('reviews')
        .update(updates)
        .eq('id', reviewId)
        .select()
        .single();

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Review updated successfully!',
      });

      // Refresh reviews
      await fetchReviews(barberId);
      await fetchReviewStats(barberId);

      return data;
    } catch (error) {
      logger.error('Error updating review', error);
      toast({
        title: 'Error',
        description: 'Failed to update review. Please try again.',
        variant: 'destructive',
      });
      throw error;
    } finally {
      setSubmitting(false);
    }
  }, [barberId, fetchReviews, fetchReviewStats, toast]);

  // Delete a review
  const deleteReview = useCallback(async (reviewId: string) => {
    try {
      const { error } = await supabase
        .from('reviews')
        .delete()
        .eq('id', reviewId);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Review deleted successfully!',
      });

      // Refresh reviews
      await fetchReviews(barberId);
      await fetchReviewStats(barberId);
    } catch (error) {
      logger.error('Error deleting review', error);
      toast({
        title: 'Error',
        description: 'Failed to delete review. Please try again.',
        variant: 'destructive',
      });
      throw error;
    }
  }, [barberId, fetchReviews, fetchReviewStats, toast]);

  // Fetch reviews that need review (for clients)
  const fetchPendingReviews = useCallback(async () => {
    try {
      setLoading(true);
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('bookings')
        .select(`
          *,
          barbers:barber_id(
            id,
            user_id,
            business_name,
            profiles:user_id(
              name,
              avatar_url
            )
          ),
          services:service_id(
            name,
            price
          )
        `)
        .eq('client_id', user.id)
        .eq('status', 'completed')
        .eq('review_requested', true)
        .not('id', 'in', `(
          SELECT booking_id FROM reviews WHERE client_id = '${user.id}'
        )`)
        .order('date', { ascending: false });

      if (error) throw error;

      return data || [];
    } catch (error) {
      logger.error('Error fetching pending reviews', error);
      toast({
        title: 'Error',
        description: 'Failed to load pending reviews.',
        variant: 'destructive',
      });
      return [];
    } finally {
      setLoading(false);
    }
  }, [toast]);

  // Load reviews when barberId changes
  useEffect(() => {
    if (barberId) {
      fetchReviews(barberId);
      fetchReviewStats(barberId);
    }
  }, [barberId, fetchReviews, fetchReviewStats]);

  return {
    reviews,
    stats,
    loading,
    submitting,
    submitReview,
    updateReview,
    deleteReview,
    fetchPendingReviews,
    refreshReviews: () => {
      if (barberId) {
        fetchReviews(barberId);
        fetchReviewStats(barberId);
      }
    }
  };
} 