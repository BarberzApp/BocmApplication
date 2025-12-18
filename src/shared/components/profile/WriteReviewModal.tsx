import { useState, useEffect, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/shared/components/ui/dialog";
import { Button } from "@/shared/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/shared/components/ui/avatar";
import { StarRating } from "@/shared/components/ui/StarRating";
import { MessageSquare, Loader2, AlertTriangle, Shield, CheckCircle, XCircle } from "lucide-react";
import { useToast } from "@/shared/components/ui/use-toast";
import { useAuth } from "@/shared/hooks/use-auth-zustand";
import { supabase } from "@/shared/lib/supabase";
import { validateContent, moderateContentWithAI, getModerationStatus } from "@/shared/lib/contentModeration";

interface WriteReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  barber: {
    id: string;
    name: string;
    image?: string;
  };
}

export function WriteReviewModal({ isOpen, onClose, barber }: WriteReviewModalProps) {
  const [rating, setRating] = useState(0);
  const [reviewText, setReviewText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [moderationStatus, setModerationStatus] = useState<'clean' | 'flagged' | 'checking'>('clean');
  const [validationIssues, setValidationIssues] = useState<string[]>([]);
  const [isContentValid, setIsContentValid] = useState(false);
  const [debouncedText, setDebouncedText] = useState("");
  const { toast } = useToast();
  const { user } = useAuth();

  // Debounced content validation
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedText(reviewText);
    }, 500); // 500ms debounce

    return () => clearTimeout(timer);
  }, [reviewText]);

  // Content validation effect
  useEffect(() => {
    if (debouncedText.length > 0) {
      const validation = validateContent(debouncedText);
      setValidationIssues(validation.issues);
      setIsContentValid(validation.isValid);
      setModerationStatus(getModerationStatus(debouncedText));
    } else {
      setValidationIssues([]);
      setIsContentValid(false);
      setModerationStatus('clean');
    }
  }, [debouncedText]);

  const handleSubmit = async () => {
    if (!rating || !reviewText.trim() || !user || !isContentValid) return;
    
    setIsSubmitting(true);
    setModerationStatus('checking');
    
    try {
      // Check if user is authenticated
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session) {
        throw new Error('You must be logged in to submit a review');
      }

      logger.debug('User session', { userId: session.user.id, email: session.user.email });

      // Final validation check
      const validation = validateContent(reviewText);
      if (!validation.isValid) {
        throw new Error(`Content validation failed: ${validation.issues.join(', ')}`);
      }

      // AI moderation
      const moderation = await moderateContentWithAI(reviewText);
      if (!moderation.isAppropriate) {
        setModerationStatus('flagged');
        throw new Error(`Content flagged as inappropriate: ${moderation.flags.join(', ')}`);
      }

      setModerationStatus('clean');

      logger.debug('Checking for completed booking', { userId: user.id, barberId: barber.id });

      // First, find the most recent completed booking between this client and barber
      const { data: booking, error: bookingError } = await supabase
        .from('bookings')
        .select('id, barber_id, status')
        .eq('client_id', user.id)
        .eq('barber_id', barber.id)
        .eq('status', 'completed')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      logger.debug('Completed booking query result', { booking, bookingError });

      if (bookingError || !booking) {
        logger.debug('No completed booking found, checking for any booking');
        
        // Check if there are any bookings with this barber at all
        const { data: anyBooking, error: anyBookingError } = await supabase
          .from('bookings')
          .select('id, status')
          .eq('client_id', user.id)
          .eq('barber_id', barber.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        logger.debug('Any booking query result', { anyBooking, anyBookingError });

        if (anyBookingError || !anyBooking) {
          throw new Error('You haven\'t booked any appointments with this barber yet. You can only review barbers you\'ve had appointments with.');
        } else {
          throw new Error(`You have a ${anyBooking.status} appointment with this barber, but you can only review completed appointments. Please wait until your appointment is completed.`);
        }
      }

      // Check if a review already exists for this booking
      const { data: existingReview, error: existingError } = await supabase
        .from('reviews')
        .select('id')
        .eq('booking_id', booking.id)
        .single();

      if (existingReview) {
        throw new Error('You have already reviewed this appointment');
      }

      // Save the review to the database
      const { error: reviewError } = await supabase
        .from('reviews')
        .insert({
          booking_id: booking.id,
          barber_id: barber.id,
          client_id: user.id,
          rating: rating,
          comment: reviewText.trim(),
          is_verified: true, // Since it's from a verified booking
          is_public: true,
          is_moderated: moderation.isAppropriate // Use AI moderation result
        });

      if (reviewError) {
        throw reviewError;
      }

      // Note: Barber stats are automatically updated by the database trigger

      toast({
        title: "Review submitted!",
        description: `Your review for ${barber.name} has been submitted successfully.`,
      });
      
      onClose();
      // Reset form
      setRating(0);
      setReviewText("");
      setModerationStatus('clean');
    } catch (error) {
      logger.error('Error submitting review', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to submit review. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    onClose();
    // Reset form
    setRating(0);
    setReviewText("");
    setModerationStatus('clean');
    setValidationIssues([]);
    setIsContentValid(false);
    setDebouncedText("");
  };

  // Real-time content validation
  const handleReviewTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value;
    setReviewText(text);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md w-full bg-background border border-white/10 backdrop-blur-xl rounded-2xl shadow-2xl">
        <DialogHeader className="pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-secondary/20 rounded-lg">
              <MessageSquare className="w-6 h-6 text-secondary" />
            </div>
            <div>
              <DialogTitle className="text-white text-xl font-bold">
                Write a Review
              </DialogTitle>
              <DialogDescription className="text-white/70 text-sm">
                Share your experience with {barber.name}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* Barber Info */}
          <div className="flex items-center gap-3 p-4 bg-white/5 rounded-xl border border-white/10">
            <Avatar className="h-12 w-12">
              <AvatarImage src={barber.image} alt={barber.name} />
              <AvatarFallback className="bg-secondary text-primary font-bold">
                {barber.name.split(" ").map(n => n[0]).join("")}
              </AvatarFallback>
            </Avatar>
            <div>
              <h3 className="font-semibold text-white">{barber.name}</h3>
              <p className="text-white/60 text-sm">Previous stylist</p>
            </div>
          </div>
          
          {/* Rating */}
          <div className="space-y-3">
            <label className="text-white/80 text-sm font-medium">Rating</label>
            <div className="flex items-center gap-2">
              <StarRating 
                rating={rating} 
                size={32} 
                interactive={true} 
                onRatingChange={setRating}
              />
            </div>
          </div>
          
          {/* Review Text */}
          <div className="space-y-3">
            <label className="text-white/80 text-sm font-medium">Review</label>
            <div className="relative">
              <textarea
                placeholder="Share your experience with this stylist..."
                className={`w-full h-24 px-3 py-2 bg-white/5 border rounded-lg text-white placeholder-white/40 focus:outline-none resize-none transition-colors ${
                  isContentValid && reviewText.length > 0
                    ? 'border-green-500/50 focus:border-green-500/70'
                    : validationIssues.length > 0
                    ? 'border-red-500/50 focus:border-red-500/70'
                    : 'border-white/10 focus:border-secondary/50'
                }`}
                value={reviewText}
                onChange={handleReviewTextChange}
                maxLength={500}
              />
              
              {/* Content Validation Status */}
              <div className="flex items-center justify-between mt-2">
                <div className="flex items-center gap-2">
                  {reviewText.length > 0 && (
                    <>
                      {isContentValid && moderationStatus === 'clean' && (
                        <div className="flex items-center gap-1 text-green-400 text-xs">
                          <CheckCircle className="w-3 h-3" />
                          Content looks good
                        </div>
                      )}
                      {!isContentValid && validationIssues.length > 0 && (
                        <div className="flex items-center gap-1 text-red-400 text-xs">
                          <XCircle className="w-3 h-3" />
                          {validationIssues[0]}
                        </div>
                      )}
                      {moderationStatus === 'flagged' && (
                        <div className="flex items-center gap-1 text-yellow-400 text-xs">
                          <AlertTriangle className="w-3 h-3" />
                          Content flagged
                        </div>
                      )}
                      {moderationStatus === 'checking' && (
                        <div className="flex items-center gap-1 text-secondary text-xs">
                          <Loader2 className="w-3 h-3 animate-spin" />
                          Checking content...
                        </div>
                      )}
                    </>
                  )}
                </div>
                <span className={`text-xs ${
                  reviewText.length > 450 ? 'text-red-400' : 'text-white/40'
                }`}>
                  {reviewText.length}/500
                </span>
              </div>
              
              {/* Validation Issues List */}
              {validationIssues.length > 0 && (
                <div className="mt-2 p-2 bg-red-500/10 border border-red-500/20 rounded-lg">
                  <div className="text-red-400 text-xs font-medium mb-1">Content Issues:</div>
                  <ul className="text-red-300 text-xs space-y-1">
                    {validationIssues.map((issue, index) => (
                      <li key={index} className="flex items-center gap-1">
                        <XCircle className="w-2 h-2 flex-shrink-0" />
                        {issue}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        </div>
        
        <div className="flex gap-3 pt-4">
          <Button
            variant="outline"
            className="flex-1 border-white/20 text-white hover:bg-white/10"
            onClick={handleCancel}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            className="flex-1 bg-secondary hover:bg-secondary/90 text-primary font-semibold"
            onClick={handleSubmit}
            disabled={!rating || !reviewText.trim() || isSubmitting || moderationStatus === 'flagged' || !isContentValid}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Submitting...
              </>
            ) : (
              'Submit Review'
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
} 