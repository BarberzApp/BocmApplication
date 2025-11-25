import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { Review, ReviewStats } from '../types';
import { Alert } from 'react-native';
import { logger } from '../lib/logger';

export function useReviews(barberId?: string) {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [stats, setStats] = useState<ReviewStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Fetch reviews for a barber
  const fetchReviews = useCallback(async (id?: string) => {
    if (!id) return;
    
    logger.log('🔍 Fetching reviews for barber ID:', id);
    
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

      logger.log('📊 Reviews query result:', { data, error });

      if (error) throw error;

      setReviews(data || []);
    } catch (error) {
      logger.error('Error fetching reviews:', error);
      Alert.alert('Error', 'Failed to load reviews.');
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch review stats for a barber
  const fetchReviewStats = useCallback(async (id?: string) => {
    if (!id) return;
    
    logger.log('📈 Fetching review stats for barber ID:', id);
    
    try {
      const { data, error } = await supabase
        .from('reviews')
        .select('rating, created_at')
        .eq('barber_id', id)
        .eq('is_public', true)
        .eq('is_moderated', true);

      logger.log('📊 Review stats query result:', { data, error });

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

      const statsData = {
        total_reviews: totalReviews,
        average_rating: Math.round(averageRating * 100) / 100,
        rating_distribution: ratingDistribution,
        recent_reviews: recentReviews as Review[]
      };

      logger.log('📈 Calculated stats:', statsData);
      setStats(statsData);
    } catch (error) {
      logger.error('Error fetching review stats:', error);
    }
  }, []);

  // Submit a new review
  const submitReview = useCallback(async (reviewData: {
    barberId: string;
    bookingId: string;
    rating: number;
    comment?: string;
  }) => {
    try {
      setSubmitting(true);
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const { data, error } = await supabase
        .from('reviews')
        .insert({
          barber_id: reviewData.barberId,
          booking_id: reviewData.bookingId,
          client_id: user.id,
          rating: reviewData.rating,
          comment: reviewData.comment,
          is_verified: false,
          is_public: true,
          is_moderated: false
        })
        .select()
        .single();

      if (error) throw error;

      // Refresh reviews
      await fetchReviews(reviewData.barberId);
      await fetchReviewStats(reviewData.barberId);

      Alert.alert('Success', 'Review submitted successfully!');
      return data;
    } catch (error) {
      logger.error('Error submitting review:', error);
      Alert.alert('Error', 'Failed to submit review. Please try again.');
      throw error;
    } finally {
      setSubmitting(false);
    }
  }, [fetchReviews, fetchReviewStats]);

  // Update an existing review
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

      // Refresh reviews
      if (barberId) {
        await fetchReviews(barberId);
        await fetchReviewStats(barberId);
      }

      Alert.alert('Success', 'Review updated successfully!');
      return data;
    } catch (error) {
      logger.error('Error updating review:', error);
      Alert.alert('Error', 'Failed to update review. Please try again.');
      throw error;
    } finally {
      setSubmitting(false);
    }
  }, [barberId, fetchReviews, fetchReviewStats]);

  // Delete a review
  const deleteReview = useCallback(async (reviewId: string) => {
    try {
      setSubmitting(true);
      
      const { error } = await supabase
        .from('reviews')
        .delete()
        .eq('id', reviewId);

      if (error) throw error;

      // Refresh reviews
      if (barberId) {
        await fetchReviews(barberId);
        await fetchReviewStats(barberId);
      }

      Alert.alert('Success', 'Review deleted successfully!');
    } catch (error) {
      logger.error('Error deleting review:', error);
      Alert.alert('Error', 'Failed to delete review. Please try again.');
      throw error;
    } finally {
      setSubmitting(false);
    }
  }, [barberId, fetchReviews, fetchReviewStats]);

  // Load reviews and stats when barberId changes
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
    fetchReviews,
    fetchReviewStats,
    submitReview,
    updateReview,
    deleteReview
  };
}
