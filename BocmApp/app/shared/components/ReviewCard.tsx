import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Star, MessageSquare, Calendar, Flag } from 'lucide-react-native';
import tw from 'twrnc';
import { Review } from '../types';
import { Avatar } from './ui';
import { ReportContentModal } from './ReportContentModal';
import { useAuth } from '../hooks/useAuth';

interface ReviewCardProps {
  review: Review;
  onPress?: () => void;
  showActions?: boolean;
  onEdit?: () => void;
  onDelete?: () => void;
}

export function ReviewCard({ 
  review, 
  onPress, 
  showActions = false, 
  onEdit, 
  onDelete 
}: ReviewCardProps) {
  const { user } = useAuth();
  const [showReportModal, setShowReportModal] = useState(false);
  const isOwnReview = user?.id === review.client_id;

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const renderStars = (rating: number) => {
    return Array.from({ length: 5 }, (_, index) => (
      <Star
        key={index}
        size={16}
        fill={index < rating ? '#FFD700' : 'transparent'}
        color={index < rating ? '#FFD700' : '#6B7280'}
        style={tw`mr-1`}
      />
    ));
  };

  return (
    <>
    <TouchableOpacity
      style={tw`bg-white/5 border border-white/10 rounded-lg p-4 mb-3`}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={tw`flex-row items-start justify-between`}>
        <View style={tw`flex-row items-center flex-1`}>
          <Avatar
            src={review.client?.avatar_url}
            size="sm"
            style={tw`mr-3`}
          />
          <View style={tw`flex-1`}>
            <Text style={tw`text-white font-semibold text-base`}>
              {review.client?.name || 'Anonymous'}
            </Text>
            <View style={tw`flex-row items-center mt-1`}>
              {renderStars(review.rating)}
              <Text style={tw`text-white/60 text-sm ml-2`}>
                {review.rating}.0
              </Text>
            </View>
          </View>
        </View>
        
        <View style={tw`items-end`}>
          <View style={tw`flex-row items-center`}>
            <Calendar size={14} color="#6B7280" />
            <Text style={tw`text-white/40 text-xs ml-1`}>
              {formatDate(review.created_at)}
            </Text>
          </View>
          
          {review.booking?.service?.name && (
            <Text style={tw`text-white/60 text-xs mt-1`}>
              {review.booking.service.name}
            </Text>
          )}
        </View>
      </View>

      {review.comment && (
        <View style={tw`mt-3`}>
          <View style={tw`flex-row items-center mb-2`}>
            <MessageSquare size={14} color="#6B7280" />
            <Text style={tw`text-white/40 text-xs ml-1`}>Review</Text>
          </View>
          <Text style={tw`text-white/80 text-sm leading-5`}>
            {review.comment}
          </Text>
        </View>
      )}

      {showActions && (onEdit || onDelete) && (
        <View style={tw`flex-row justify-end mt-3 pt-3 border-t border-white/10`}>
          {onEdit && (
            <TouchableOpacity
              style={tw`bg-blue-500/20 px-3 py-1 rounded mr-2`}
              onPress={onEdit}
            >
              <Text style={tw`text-blue-400 text-xs font-medium`}>Edit</Text>
            </TouchableOpacity>
          )}
          {onDelete && (
            <TouchableOpacity
              style={tw`bg-red-500/20 px-3 py-1 rounded`}
              onPress={onDelete}
            >
              <Text style={tw`text-red-400 text-xs font-medium`}>Delete</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {review.is_verified && (
        <View style={tw`absolute top-2 right-2 bg-green-500/20 px-2 py-1 rounded-full`}>
          <Text style={tw`text-green-400 text-xs font-medium`}>✓ Verified</Text>
        </View>
      )}

      {/* Report Button - Show for non-own reviews */}
      {!isOwnReview && (
        <TouchableOpacity
          style={tw`absolute top-2 left-2 bg-red-500/20 px-2 py-1 rounded-full flex-row items-center`}
          onPress={(e) => {
            e.stopPropagation();
            setShowReportModal(true);
          }}
        >
          <Flag size={12} color="#ef4444" />
          <Text style={tw`text-red-400 text-xs font-medium ml-1`}>Report</Text>
        </TouchableOpacity>
      )}
    </TouchableOpacity>
    
    {/* Report Modal */}
    <ReportContentModal
      visible={showReportModal}
      onClose={() => setShowReportModal(false)}
      contentType="review"
      contentId={review.id}
      reportedUserId={review.client_id}
      contentDescription={`Review by ${review.client?.name || 'Anonymous'}: ${review.comment?.substring(0, 100) || 'No comment'}...`}
    />
    </>
  );
}
