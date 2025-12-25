import { useCallback, useEffect, useState, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './useAuth';
import { useToast } from '../components/ui/use-toast';
import { notificationService } from '../lib/notifications';
import { logger } from '../lib/logger';

export interface VideoCut {
  id: string;
  barber_id: string;
  title: string;
  description?: string;
  url: string;
  thumbnail?: string;
  category: string;
  duration: number;
  views: number;
  likes: number;
  shares: number;
  tags: string[];
  is_featured: boolean;
  is_public: boolean;
  created_at: string;
  updated_at: string;
  comments_count?: number;
}

export interface CutAnalytics {
  total_views: number;
  total_likes: number;
  total_shares: number;
  engagement_rate: number;
  top_performing_category: string;
  recent_uploads: number;
  category_breakdown: Record<string, { views: number; likes: number; count: number }>;
}

const defaultAnalytics: CutAnalytics = {
  total_views: 0,
  total_likes: 0,
  total_shares: 0,
  engagement_rate: 0,
  top_performing_category: 'hair-styling',
  recent_uploads: 0,
  category_breakdown: {},
};

export interface CreateCutData {
  title: string;
  description?: string;
  url: string;
  thumbnail?: string;
  category: string;
  duration: number;
  tags: string[];
  is_featured?: boolean;
  is_public?: boolean;
}

export function useCuts() {
  const [cuts, setCuts] = useState<VideoCut[]>([]);
  const [analytics, setAnalytics] = useState<CutAnalytics>(defaultAnalytics);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();
  const hasInitialized = useRef(false);

  // Calculate analytics from cuts data
  const calculateAnalytics = useCallback((cutsData: VideoCut[]) => {
    const totalViews = cutsData.reduce((sum, cut) => sum + cut.views, 0);
    const totalLikes = cutsData.reduce((sum, cut) => sum + cut.likes, 0);
    const totalShares = cutsData.reduce((sum, cut) => sum + cut.shares, 0);
    const engagementRate = totalViews > 0 ? ((totalLikes + totalShares) / totalViews) * 100 : 0;

    // Category breakdown
    const categoryBreakdown = cutsData.reduce((acc, cut) => {
      if (!acc[cut.category]) {
        acc[cut.category] = { views: 0, likes: 0, count: 0 };
      }
      acc[cut.category].views += cut.views;
      acc[cut.category].likes += cut.likes;
      acc[cut.category].count += 1;
      return acc;
    }, {} as Record<string, { views: number; likes: number; count: number }>);

    // Top performing category
    const topCategory = Object.entries(categoryBreakdown).sort(([, a], [, b]) => b.views - a.views)[0]?.[0] || 'hair-styling';

    // Recent uploads (last 7 days)
    const recentUploads = cutsData.filter((cut) => {
      const daysAgo = (Date.now() - new Date(cut.created_at).getTime()) / (1000 * 60 * 60 * 24);
      return daysAgo <= 7;
    }).length;

    setAnalytics({
      total_views: totalViews,
      total_likes: totalLikes,
      total_shares: totalShares,
      engagement_rate: engagementRate,
      top_performing_category: topCategory,
      recent_uploads: recentUploads,
      category_breakdown: categoryBreakdown,
    });
  }, []);

  // Fetch cuts for current barber
  const fetchCuts = useCallback(async () => {
    if (!user) return;

    try {
      setLoading(true);
      logger.log('Fetching cuts for user:', user.id);

      // Get barber ID
      const { data: barberData, error: barberError } = await supabase
        .from('barbers')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (barberError) {
        logger.error('Error fetching barber data:', barberError);
        throw barberError;
      }

      logger.log('Found barber data:', barberData);

      // Fetch cuts
      const { data: cutsData, error: cutsError } = await supabase
        .from('cuts')
        .select('*')
        .eq('barber_id', barberData.id)
        .order('created_at', { ascending: false });

      if (cutsError) {
        logger.error('Error fetching cuts data:', cutsError);
        throw cutsError;
      }

      logger.log('Found cuts data:', cutsData);

      setCuts(cutsData || []);

      // Calculate analytics
      if (cutsData && cutsData.length > 0) {
        calculateAnalytics(cutsData);
      }
    } catch (error) {
      logger.error('Error fetching cuts:', error);
      toast({
        title: 'Error',
        description: 'Failed to load your cuts.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [user, toast, calculateAnalytics]);

  // Create new cut
  const createCut = useCallback(
    async (cutData: CreateCutData) => {
      if (!user) {
        toast({
          title: 'Error',
          description: 'You must be logged in to create cuts.',
          variant: 'destructive',
        });
        return null;
      }

      try {
        setUploading(true);

        // Get barber ID
        const { data: barberData, error: barberError } = await supabase
          .from('barbers')
          .select('id')
          .eq('user_id', user.id)
          .single();

        if (barberError) throw barberError;

        // Create cut
        const { data: newCut, error: createError } = await supabase
          .from('cuts')
          .insert({
            barber_id: barberData.id,
            ...cutData,
            is_featured: cutData.is_featured ?? false,
            is_public: cutData.is_public ?? true,
          })
          .select()
          .single();

        if (createError) throw createError;

        setCuts((prev) => [newCut, ...prev]);

        // Send cut creation notification
        try {
          await notificationService.sendCutCreatedNotification(
            newCut.id,
            cutData.title
          );
          logger.log('✅ Cut creation notification sent');
        } catch (notificationError) {
          logger.error('❌ Error sending cut creation notification:', notificationError);
          // Don't fail the cut creation if notification fails
        }

        toast({
          title: 'Success',
          description: 'Cut created successfully!',
        });

        return newCut;
      } catch (error) {
        logger.error('Error creating cut:', error);
        toast({
          title: 'Error',
          description: 'Failed to create cut. Please try again.',
          variant: 'destructive',
        });
        return null;
      } finally {
        setUploading(false);
      }
    },
    [user, toast]
  );

  // Update cut
  const updateCut = useCallback(
    async (cutId: string, updates: Partial<CreateCutData>) => {
      try {
        const { data: updatedCut, error } = await supabase
          .from('cuts')
          .update({
            ...updates,
            updated_at: new Date().toISOString(),
          })
          .eq('id', cutId)
          .select()
          .single();

        if (error) throw error;

        setCuts((prev) =>
          prev.map((cut) => (cut.id === cutId ? updatedCut : cut))
        );

        toast({
          title: 'Success',
          description: 'Cut updated successfully!',
        });

        return updatedCut;
      } catch (error) {
        logger.error('Error updating cut:', error);
        toast({
          title: 'Error',
          description: 'Failed to update cut. Please try again.',
          variant: 'destructive',
        });
        return null;
      }
    },
    [toast]
  );

  // Delete cut
  const deleteCut = useCallback(
    async (cutId: string) => {
      try {
        const { error } = await supabase.from('cuts').delete().eq('id', cutId);

        if (error) throw error;

        setCuts((prev) => prev.filter((cut) => cut.id !== cutId));

        toast({
          title: 'Success',
          description: 'Cut deleted successfully!',
        });
      } catch (error) {
        logger.error('Error deleting cut:', error);
        toast({
          title: 'Error',
          description: 'Failed to delete cut. Please try again.',
          variant: 'destructive',
        });
      }
    },
    [toast]
  );

  // Track view
  const trackView = useCallback(
    async (cutId: string) => {
      if (!user) return;

      try {
        // Check if user already viewed this cut
        const { data: existingView } = await supabase
          .from('cut_analytics')
          .select('id')
          .eq('cut_id', cutId)
          .eq('user_id', user.id)
          .eq('action_type', 'view')
          .single();

        if (!existingView) {
          // Record view
          await supabase
            .from('cut_analytics')
            .insert({
              cut_id: cutId,
              user_id: user.id,
              action_type: 'view',
            });

          // Update local state
          setCuts((prev) =>
            prev.map((cut) =>
              cut.id === cutId ? { ...cut, views: cut.views + 1 } : cut
            )
          );
        }
      } catch (error) {
        logger.error('Error tracking view:', error);
      }
    },
    [user]
  );

  // Track like
  const trackLike = useCallback(
    async (cutId: string) => {
      if (!user) return;

      try {
        // Check if user already liked this cut
        const { data: existingLike } = await supabase
          .from('cut_analytics')
          .select('id')
          .eq('cut_id', cutId)
          .eq('user_id', user.id)
          .eq('action_type', 'like')
          .single();

        if (existingLike) {
          // Unlike
          await supabase.from('cut_analytics').delete().eq('id', existingLike.id);

          setCuts((prev) =>
            prev.map((cut) =>
              cut.id === cutId
                ? { ...cut, likes: Math.max(0, cut.likes - 1) }
                : cut
            )
          );
        } else {
          // Like
          await supabase
            .from('cut_analytics')
            .insert({
              cut_id: cutId,
              user_id: user.id,
              action_type: 'like',
            });

          setCuts((prev) =>
            prev.map((cut) =>
              cut.id === cutId ? { ...cut, likes: cut.likes + 1 } : cut
            )
          );
        }
      } catch (error) {
        logger.error('Error tracking like:', error);
      }
    },
    [user]
  );

  // Track share
  const trackShare = useCallback(
    async (cutId: string) => {
      if (!user) return;

      try {
        await supabase
          .from('cut_analytics')
          .insert({
            cut_id: cutId,
            user_id: user.id,
            action_type: 'share',
          });

        setCuts((prev) =>
          prev.map((cut) =>
            cut.id === cutId ? { ...cut, shares: cut.shares + 1 } : cut
          )
        );
      } catch (error) {
        logger.error('Error tracking share:', error);
      }
    },
    [user]
  );

  // Get cut by ID
  const getCutById = useCallback(
    (cutId: string) => {
      return cuts.find((cut) => cut.id === cutId);
    },
    [cuts]
  );

  // Get cuts by category
  const getCutsByCategory = useCallback(
    (category: string) => {
      if (category === 'all') return cuts;
      return cuts.filter((cut) => cut.category === category);
    },
    [cuts]
  );

  // Get featured cuts
  const getFeaturedCuts = useCallback(() => {
    return cuts.filter((cut) => cut.is_featured);
  }, [cuts]);

  // Toggle cut featured status
  const toggleFeatured = useCallback(
    async (cutId: string) => {
      const cut = getCutById(cutId);
      if (!cut) return;

      await updateCut(cutId, { is_featured: !cut.is_featured });
    },
    [getCutById, updateCut]
  );

  // Toggle cut public status
  const togglePublic = useCallback(
    async (cutId: string) => {
      const cut = getCutById(cutId);
      if (!cut) return;

      await updateCut(cutId, { is_public: !cut.is_public });
    },
    [getCutById, updateCut]
  );

  // Load cuts on mount
  useEffect(() => {
    if (hasInitialized.current) return; // Prevent infinite loops
    hasInitialized.current = true;
    fetchCuts();
  }, [fetchCuts]);

  // Manual refresh function that doesn't trigger infinite loops
  const refreshCuts = useCallback(async () => {
    if (!user) return;

    try {
      setLoading(true);

      // Get barber ID
      const { data: barberData, error: barberError } = await supabase
        .from('barbers')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (barberError) throw barberError;

      // Fetch cuts
      const { data: cutsData, error: cutsError } = await supabase
        .from('cuts')
        .select('*')
        .eq('barber_id', barberData.id)
        .order('created_at', { ascending: false });

      if (cutsError) throw cutsError;

      setCuts(cutsData || []);

      // Calculate analytics
      if (cutsData && cutsData.length > 0) {
        calculateAnalytics(cutsData);
      }
    } catch (error) {
      logger.error('Error refreshing cuts:', error);
      toast({
        title: 'Error',
        description: 'Failed to refresh cuts.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [user, toast, calculateAnalytics]);

  return {
    cuts,
    analytics,
    loading,
    uploading,
    createCut,
    updateCut,
    deleteCut,
    trackView,
    trackLike,
    trackShare,
    getCutById,
    getCutsByCategory,
    getFeaturedCuts,
    toggleFeatured,
    togglePublic,
    refreshCuts,
  };
} 