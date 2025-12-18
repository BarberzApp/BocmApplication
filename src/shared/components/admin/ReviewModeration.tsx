import { useState, useEffect } from "react";
import { Button } from "@/shared/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Badge } from "@/shared/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/shared/components/ui/avatar";
import { StarRating } from "@/shared/components/ui/StarRating";
import { 
  CheckCircle, 
  XCircle, 
  Edit, 
  Eye, 
  Loader2,
  AlertTriangle,
  Shield
} from "lucide-react";
import { useToast } from "@/shared/components/ui/use-toast";
import { supabase } from "@/shared/lib/supabase";
import { sanitizeContent } from "@/shared/lib/contentModeration";
import { logger } from "@/shared/lib/logger";

interface Review {
  id: string;
  rating: number;
  comment: string;
  is_public: boolean;
  is_moderated: boolean;
  created_at: string;
  client: {
    name: string;
    avatar_url?: string;
  };
  barber: {
    name: string;
    avatar_url?: string;
  };
}

export function ReviewModeration() {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedReview, setSelectedReview] = useState<Review | null>(null);
  const [editingComment, setEditingComment] = useState("");
  const { toast } = useToast();

  useEffect(() => {
    fetchPendingReviews();
  }, []);

  const fetchPendingReviews = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('reviews')
        .select(`
          id,
          rating,
          comment,
          is_public,
          is_moderated,
          created_at,
          client:profiles!client_id(
            name,
            avatar_url
          ),
          barber:profiles!barber_id(
            name,
            avatar_url
          )
        `)
        .eq('is_moderated', false)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setReviews((data || []) as unknown as Review[]);
    } catch (error) {
      logger.error('Error fetching pending reviews', error);
      toast({
        title: "Error",
        description: "Failed to load pending reviews",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const approveReview = async (reviewId: string) => {
    try {
      const { error } = await supabase
        .from('reviews')
        .update({ 
          is_moderated: true,
          is_public: true 
        })
        .eq('id', reviewId);

      if (error) throw error;

      toast({
        title: "Review Approved",
        description: "The review has been approved and is now public",
      });

      // Remove from list
      setReviews(reviews.filter(r => r.id !== reviewId));
    } catch (error) {
      logger.error('Error approving review', error);
      toast({
        title: "Error",
        description: "Failed to approve review",
        variant: "destructive",
      });
    }
  };

  const rejectReview = async (reviewId: string) => {
    try {
      const { error } = await supabase
        .from('reviews')
        .update({ 
          is_moderated: true,
          is_public: false 
        })
        .eq('id', reviewId);

      if (error) throw error;

      toast({
        title: "Review Rejected",
        description: "The review has been rejected and is not public",
      });

      // Remove from list
      setReviews(reviews.filter(r => r.id !== reviewId));
    } catch (error) {
      logger.error('Error rejecting review', error);
      toast({
        title: "Error",
        description: "Failed to reject review",
        variant: "destructive",
      });
    }
  };

  const editReview = async (reviewId: string, newComment: string) => {
    try {
      const { error } = await supabase
        .from('reviews')
        .update({ 
          comment: newComment,
          is_moderated: true,
          is_public: true 
        })
        .eq('id', reviewId);

      if (error) throw error;

      toast({
        title: "Review Updated",
        description: "The review has been edited and approved",
      });

      // Remove from list
      setReviews(reviews.filter(r => r.id !== reviewId));
      setSelectedReview(null);
      setEditingComment("");
    } catch (error) {
      logger.error('Error editing review', error);
      toast({
        title: "Error",
        description: "Failed to edit review",
        variant: "destructive",
      });
    }
  };

  const sanitizeAndEdit = async (reviewId: string) => {
    const sanitized = sanitizeContent(editingComment);
    await editReview(reviewId, sanitized);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="w-8 h-8 animate-spin" />
        <span className="ml-2">Loading pending reviews...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Review Moderation</h2>
          <p className="text-white/60">Manage and moderate user reviews</p>
        </div>
        <Badge variant="secondary" className="text-sm">
          {reviews.length} pending reviews
        </Badge>
      </div>

      {reviews.length === 0 ? (
        <Card className="bg-white/5 border border-white/10">
          <CardContent className="p-8 text-center">
            <Shield className="w-12 h-12 text-green-400 mx-auto mb-4" />
            <h3 className="text-white font-semibold text-lg mb-2">All Caught Up!</h3>
            <p className="text-white/60">No pending reviews to moderate.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {reviews.map((review) => (
            <Card key={review.id} className="bg-white/5 border border-white/10">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={review.client.avatar_url} alt={review.client.name} />
                      <AvatarFallback className="bg-secondary text-primary">
                        {review.client.name?.charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <h4 className="text-white font-semibold">{review.client.name}</h4>
                      <p className="text-white/60 text-sm">Review for {review.barber.name}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <StarRating rating={review.rating} size={16} />
                    <span className="text-white/60 text-sm">{review.rating}/5</span>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="bg-white/5 p-4 rounded-lg">
                    <p className="text-white">{review.comment}</p>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">
                      {new Date(review.created_at).toLocaleDateString()}
                    </Badge>
                    <Badge variant="outline" className="text-xs">
                      {review.comment.length} characters
                    </Badge>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => approveReview(review.id)}
                      className="bg-green-600 hover:bg-green-700 text-white"
                    >
                      <CheckCircle className="w-4 h-4 mr-2" />
                      Approve
                    </Button>
                    
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setSelectedReview(review);
                        setEditingComment(review.comment);
                      }}
                      className="border-blue-500/30 text-blue-400 hover:bg-blue-500/10"
                    >
                      <Edit className="w-4 h-4 mr-2" />
                      Edit
                    </Button>
                    
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => rejectReview(review.id)}
                      className="border-red-500/30 text-red-400 hover:bg-red-500/10"
                    >
                      <XCircle className="w-4 h-4 mr-2" />
                      Reject
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Edit Modal */}
      {selectedReview && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <Card className="w-full max-w-md bg-black/95 border border-white/20">
            <CardHeader>
              <CardTitle className="text-white">Edit Review</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <textarea
                value={editingComment}
                onChange={(e) => setEditingComment(e.target.value)}
                className="w-full h-32 p-3 bg-white/5 border border-white/10 rounded-lg text-white resize-none"
                placeholder="Edit the review content..."
              />
              <div className="flex gap-2">
                <Button
                  onClick={() => sanitizeAndEdit(selectedReview.id)}
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                  <Shield className="w-4 h-4 mr-2" />
                  Sanitize & Approve
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setSelectedReview(null);
                    setEditingComment("");
                  }}
                  className="border-white/20 text-white"
                >
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
} 