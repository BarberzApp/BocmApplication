import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Star, Send, X } from 'lucide-react-native';
import tw from 'twrnc';
import { useReviews } from '../hooks/useReviews';
import { logger } from '../lib/logger';
import { validateReviewContent, sanitizeText } from '../lib/contentModeration';

interface ReviewFormProps {
  barberId: string;
  bookingId: string;
  onClose: () => void;
  onSuccess?: () => void;
  initialRating?: number;
  initialComment?: string;
  isEditing?: boolean;
  reviewId?: string;
}

export function ReviewForm({
  barberId,
  bookingId,
  onClose,
  onSuccess,
  initialRating = 0,
  initialComment = '',
  isEditing = false,
  reviewId,
}: ReviewFormProps) {
  const [rating, setRating] = useState(initialRating);
  const [comment, setComment] = useState(initialComment);
  const { submitReview, updateReview, submitting } = useReviews(barberId);

  const handleSubmit = async () => {
    if (rating === 0) {
      Alert.alert('Rating Required', 'Please select a rating before submitting.');
      return;
    }

    // Validate and sanitize comment content
    const trimmedComment = comment.trim();
    if (trimmedComment) {
      const validation = validateReviewContent(trimmedComment);
      if (!validation.isValid) {
        Alert.alert(
          'Content Not Allowed',
          validation.reason || 'Your review contains inappropriate content. Please revise your review.',
          [{ text: 'OK' }]
        );
        return;
      }
      
      // Sanitize the comment
      const sanitizedComment = sanitizeText(trimmedComment);
      
      try {
        if (isEditing && reviewId) {
          await updateReview(reviewId, { rating, comment: sanitizedComment });
        } else {
          await submitReview({
            barberId,
            bookingId,
            rating,
            comment: sanitizedComment || undefined,
          });
        }
        
        onSuccess?.();
        onClose();
      } catch (error) {
        logger.error('Error submitting review:', error);
      }
    } else {
      // No comment, just submit rating
      try {
        if (isEditing && reviewId) {
          await updateReview(reviewId, { rating, comment: '' });
        } else {
          await submitReview({
            barberId,
            bookingId,
            rating,
            comment: undefined,
          });
        }
        
        onSuccess?.();
        onClose();
      } catch (error) {
        logger.error('Error submitting review:', error);
      }
    }
  };

  const renderStars = () => {
    return Array.from({ length: 5 }, (_, index) => (
      <TouchableOpacity
        key={index}
        onPress={() => setRating(index + 1)}
        style={tw`p-2`}
      >
        <Star
          size={32}
          fill={index < rating ? '#FFD700' : 'transparent'}
          color={index < rating ? '#FFD700' : '#6B7280'}
        />
      </TouchableOpacity>
    ));
  };

  return (
    <View style={tw`flex-1 bg-black/90 justify-end`}>
      <View style={tw`bg-white/10 border border-white/20 rounded-t-3xl p-6 max-h-96`}>
        <View style={tw`flex-row items-center justify-between mb-6`}>
          <Text style={tw`text-white text-xl font-bold`}>
            {isEditing ? 'Edit Review' : 'Write a Review'}
          </Text>
          <TouchableOpacity
            onPress={onClose}
            style={tw`p-2`}
          >
            <X size={24} color="#6B7280" />
          </TouchableOpacity>
        </View>

        <ScrollView showsVerticalScrollIndicator={false}>
          {/* Rating Section */}
          <View style={tw`mb-6`}>
            <Text style={tw`text-white/80 text-base font-medium mb-3`}>
              Rate your experience
            </Text>
            <View style={tw`flex-row justify-center`}>
              {renderStars()}
            </View>
            <Text style={tw`text-white/60 text-sm text-center mt-2`}>
              {rating === 0 && 'Tap to rate'}
              {rating === 1 && 'Poor'}
              {rating === 2 && 'Fair'}
              {rating === 3 && 'Good'}
              {rating === 4 && 'Very Good'}
              {rating === 5 && 'Excellent'}
            </Text>
          </View>

          {/* Comment Section */}
          <View style={tw`mb-6`}>
            <Text style={tw`text-white/80 text-base font-medium mb-3`}>
              Share your experience (optional)
            </Text>
            <TextInput
              style={tw`bg-white/5 border border-white/20 rounded-lg p-4 text-white text-base min-h-24`}
              placeholder="Tell us about your experience..."
              placeholderTextColor="#6B7280"
              value={comment}
              onChangeText={setComment}
              multiline
              textAlignVertical="top"
              maxLength={500}
            />
            <Text style={tw`text-white/40 text-xs text-right mt-2`}>
              {comment.length}/500
            </Text>
          </View>

          {/* Submit Button */}
          <TouchableOpacity
            style={tw`bg-blue-500 rounded-lg p-4 flex-row items-center justify-center ${
              rating === 0 ? 'opacity-50' : ''
            }`}
            onPress={handleSubmit}
            disabled={rating === 0 || submitting}
          >
            {submitting ? (
              <ActivityIndicator color="white" size="small" />
            ) : (
              <>
                <Send size={20} color="white" style={tw`mr-2`} />
                <Text style={tw`text-white font-semibold text-base`}>
                  {isEditing ? 'Update Review' : 'Submit Review'}
                </Text>
              </>
            )}
          </TouchableOpacity>
        </ScrollView>
      </View>
    </View>
  );
}
