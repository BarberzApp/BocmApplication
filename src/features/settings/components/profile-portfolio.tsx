import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/shared/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/shared/components/ui/avatar';
import { PortfolioEditor } from './portfolio-editor';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/shared/components/ui/dialog';
import { Input } from '@/shared/components/ui/input';
import { Textarea } from '@/shared/components/ui/textarea';
import { Label } from '@/shared/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select';
import { Badge } from '@/shared/components/ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/shared/components/ui/dropdown-menu';
import { Switch } from '@/shared/components/ui/switch';
import { Play, Instagram, Twitter, Facebook, Edit3, Upload, Video, Plus, X, Loader2, Sparkles, MapPin, Filter, Camera, MoreVertical, Star, Trash2, Edit, Eye, EyeOff, GripVertical, Heart, MessageCircle, Image as ImageIcon, Video as VideoIcon, ArrowLeft, ArrowRight, User, Calendar, Building, Share2, Award, Phone, ExternalLink } from 'lucide-react';
import { useAuth } from '@/shared/hooks/use-auth-zustand';
import { supabase } from '@/shared/lib/supabase';
import { useToast } from '@/shared/components/ui/use-toast';
import { BarberProfileSettings } from './barber-profile-settings';
import { useCuts } from '@/shared/hooks/use-cuts';
import Cropper, { Area } from 'react-easy-crop';
import getCroppedImg from '@/shared/lib/crop-image';
import { useData } from '@/shared/hooks/use-data';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/shared/components/ui/tabs';
import { cn } from '@/lib/utils';
import { BookingForm } from '@/shared/components/booking/booking-form';
import { Progress } from '@/shared/components/ui/progress';
import { logger } from '@/shared/lib/logger';

interface UserProfile {
  id: string;
  name: string;
  email: string;
  username?: string;
  avatar_url?: string;
  bio?: string;
  location?: string;
  phone?: string;
  coverphoto?: string; // Fix: match database column name
}

// Update PortfolioItem type
type PortfolioItem = {
  id: string;
  type: 'image' | 'video';
  url: string;
  title?: string;
  likes?: number;
  comments?: number;
};
// Update BarberProfile type
interface BarberProfile {
  id: string;
  user_id: string;
  bio?: string;
  business_name?: string;
  specialties?: string[];
  instagram?: string;
  twitter?: string;
  facebook?: string;
  portfolio?: string[];
  featured_portfolio?: string;
  services?: Array<{
    id: string;
    name: string;
    price: number;
    duration: string;
    description: string;
  }>;
  reviews?: Array<{
    id: string;
    user: string;
    avatar: string;
    rating: number;
    comment: string;
    date: string;
  }>;
}

export default function ProfilePortfolio() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [barberProfile, setBarberProfile] = useState<BarberProfile | null>(null);
  const [portfolio, setPortfolio] = useState<PortfolioItem[]>([]);
  const [openDialog, setOpenDialog] = useState<null | 'profile' | 'portfolio' | 'video' | 'upload' | 'edit-cut' | 'portfolio-upload' | 'services' | 'addons'>(null);
  const [selectedCut, setSelectedCut] = useState<any>(null);
  const [editingCut, setEditingCut] = useState<any>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [avatarLoading, setAvatarLoading] = useState(false);
  const [uploadForm, setUploadForm] = useState({
    title: '',
    description: '',
    tags: ''
  });
  const [selectedVideoFile, setSelectedVideoFile] = useState<File | null>(null);
  const [videoPreviewUrl, setVideoPreviewUrl] = useState<string | null>(null);
  const editProfileButtonRef = useRef<HTMLButtonElement>(null);
  const editPortfolioButtonRef = useRef<HTMLButtonElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const avatarFileInputRef = useRef<HTMLInputElement>(null);
  // Remove duplicate cuts state - use only useCuts hook
  const [showLocationFilter, setShowLocationFilter] = useState(false);
  const [locationFilter, setLocationFilter] = useState({
    city: '',
    state: '',
    range: 50,
    useCurrentLocation: false
  });
  const [userLocation, setUserLocation] = useState<{lat: number, lng: number} | null>(null);
  // Only use useCuts hook if user is a barber
  const cutsHook = useCuts();
  const cuts = barberProfile ? cutsHook.cuts : [];
  const analytics = barberProfile ? cutsHook.analytics : null;
  const refreshCuts = barberProfile ? cutsHook.refreshCuts : () => {};
  const cutsLoading = barberProfile ? cutsHook.loading : false;
  const createCut = barberProfile ? cutsHook.createCut : null;
  
  // Debug logging
  useEffect(() => {
    logger.debug('Profile Portfolio - State', { 
      cutsCount: cuts?.length, 
      cutsLoading, 
      userId: user?.id, 
      barberProfileId: barberProfile?.id 
    })
  }, [cuts, cutsLoading, user, barberProfile])

  // Test database connection
  useEffect(() => {
    const testConnection = async () => {
      try {
        const { data, error } = await supabase
          .from('cuts')
          .select('count')
          .limit(1)
        
        if (error) {
          logger.error('Database connection test failed', error)
        } else {
          logger.debug('Database connection test successful')
        }
      } catch (error) {
        logger.error('Database connection test error', error)
      }
    }

    testConnection()
  }, [])

  // Fetch services
  const fetchServices = useCallback(async () => {
    if (!barberProfile?.id) return

    try {
      setServicesLoading(true)
      logger.debug('Fetching services for barber', { barberId: barberProfile.id })
      
      const { data: servicesData, error: servicesError } = await supabase
        .from('services')
        .select('*')
        .eq('barber_id', barberProfile.id)
        .order('created_at', { ascending: false })

      if (servicesError) {
        logger.error('Error fetching services', servicesError)
        throw servicesError
      }

      logger.debug('Found services data', { count: servicesData?.length })
      setServices(servicesData || [])

    } catch (error) {
      logger.error('Error fetching services', error)
      toast({
        title: 'Error',
        description: 'Failed to load services.',
        variant: 'destructive',
      })
    } finally {
      setServicesLoading(false)
    }
  }, [barberProfile?.id, toast])

  // Fetch add-ons
  const fetchAddons = useCallback(async () => {
    if (!barberProfile?.id) return

    try {
      setAddonsLoading(true)
      logger.debug('Fetching add-ons for barber', { barberId: barberProfile.id })
      
      const { data: addonsData, error: addonsError } = await supabase
        .from('service_addons')
        .select('*')
        .eq('barber_id', barberProfile.id)
        .order('created_at', { ascending: false })

      if (addonsError) {
        logger.error('Error fetching add-ons', addonsError)
        throw addonsError
      }

      logger.debug('Found add-ons data', { count: addonsData?.length })
      setAddons(addonsData || [])

    } catch (error) {
      logger.error('Error fetching add-ons', error)
      toast({
        title: 'Error',
        description: 'Failed to load add-ons.',
        variant: 'destructive',
      })
    } finally {
      setAddonsLoading(false)
    }
  }, [barberProfile?.id, toast])

  // Fetch services and add-ons when barber profile is loaded
  useEffect(() => {
    if (barberProfile?.id) {
      fetchServices()
      fetchAddons()
    }
  }, [barberProfile?.id, fetchServices, fetchAddons])

  // Handle booking service
  const handleBookService = (service: any) => {
    setSelectedBookingDate(new Date())
    setBookingFormOpen(true)
  }

  // Handle add to booking (for add-ons)
  const handleAddToBooking = (addon: any) => {
    setSelectedBookingDate(new Date())
    setBookingFormOpen(true)
  }

  // Handle booking created
  const handleBookingCreated = (booking: any) => {
    setBookingFormOpen(false)
    toast({
      title: 'Booking Confirmed!',
      description: 'Your appointment has been scheduled successfully.',
    })
  }
  const [statsDialogOpen, setStatsDialogOpen] = useState(false);
  const [statsDialogCut, setStatsDialogCut] = useState<any>(null);
  const [comments, setComments] = useState<any[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [cropDialogOpen, setCropDialogOpen] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [portfolioModalOpen, setPortfolioModalOpen] = useState(false);
  const [selectedPortfolioItem, setSelectedPortfolioItem] = useState<PortfolioItem | null>(null);
  // Cover photo cropping state
  const [coverCropDialogOpen, setCoverCropDialogOpen] = useState(false);
  const [selectedCoverImage, setSelectedCoverImage] = useState<string | null>(null);
  const [coverCrop, setCoverCrop] = useState({ x: 0, y: 0 });
  const [coverZoom, setCoverZoom] = useState(1);
  const [coverCroppedAreaPixels, setCoverCroppedAreaPixels] = useState<Area | null>(null);
  // Starred/featured portfolio logic
  const [featuredId, setFeaturedId] = useState<string | null>(barberProfile?.featured_portfolio || null);
  // Services state
  const [services, setServices] = useState<any[]>([]);
  const [servicesLoading, setServicesLoading] = useState(false);
  const [addons, setAddons] = useState<any[]>([]);
  const [addonsLoading, setAddonsLoading] = useState(false);
  // Booking state
  const [bookingFormOpen, setBookingFormOpen] = useState(false);
  const [selectedBookingDate, setSelectedBookingDate] = useState<Date>(new Date());


  const onCropComplete = useCallback((_: Area, croppedAreaPixels: Area) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const onCoverCropComplete = useCallback((_: Area, croppedAreaPixels: Area) => {
    setCoverCroppedAreaPixels(croppedAreaPixels);
  }, []);

  // Get user's current location
  const getCurrentLocation = useCallback(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude
          });
        },
        (error) => {
          logger.error('Error getting location', error)
          toast({
            title: 'Location Error',
            description: 'Could not get your current location.',
            variant: 'destructive',
          });
        }
      );
    }
  }, [toast]);

  // Calculate distance between two points
  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 3959; // Earth's radius in miles
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };

  // Remove fetchUserCuts function - no longer needed

  // Remove handleLocationFilter and clearLocationFilter functions - no longer needed

  // Fetch user profile data
  useEffect(() => {
    const fetchProfileData = async () => {
      if (!user) return;

      try {
        setLoading(true);
        logger.debug('Fetching profile data for user', { userId: user.id })
        
        // Fetch profile and barber data in parallel
        const [profileResult, barberResult] = await Promise.all([
          supabase
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .single(),
          supabase
            .from('barbers')
            .select('*')
            .eq('user_id', user.id)
            .single()
        ]);

        logger.debug('Profile fetch result', { hasData: !!profileResult.data, hasError: !!profileResult.error })
        logger.debug('Barber fetch result', { hasData: !!barberResult.data, hasError: !!barberResult.error })

        if (profileResult.error) {
          logger.error('Profile fetch error', profileResult.error)
        }

        if (barberResult.error) {
          logger.error('Barber fetch error', barberResult.error)
        }

        if (profileResult.data) {
          setProfile(profileResult.data);
        }

        if (barberResult.data) {
          setBarberProfile(barberResult.data);
          
          // Convert portfolio URLs to PortfolioItem format
          if (barberResult.data.portfolio) {
            const portfolioItems: PortfolioItem[] = barberResult.data.portfolio.map((url: string, index: number) => ({
              id: `item-${index}`,
              type: url.includes('.mp4') || url.includes('.mov') || url.includes('.avi') ? 'video' : 'image',
              url
            }));
            setPortfolio(portfolioItems);
          }
          // Remove fetchUserCuts call - useCuts hook handles this
        } else {
          // User is not a barber - they are a client
          logger.debug('User is a client (no barber profile found)', { userId: user.id })
          setBarberProfile(null); // Explicitly set to null to ensure client interface
        }
      } catch (error) {
        logger.error('Error fetching profile data', error)
        toast({
          title: 'Error',
          description: 'Failed to load profile data.',
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    };

    fetchProfileData();
  }, [user, toast]);

  // Stats and socials based on real data
  const profileStats = [
    { label: 'Posts', value: cuts.length },
  ];

  const socials = [
    { icon: Instagram, href: barberProfile?.instagram, color: 'text-[#E1306C]' },
    { icon: Twitter, href: barberProfile?.twitter, color: 'text-[#1DA1F2]' },
    { icon: Facebook, href: barberProfile?.facebook, color: 'text-[#1877F3]' },
  ].filter(social => social.href); // Only show socials that have URLs

  const handleEditProfile = () => {
    setOpenDialog('profile');
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    try {
      if (!e.target.files || !e.target.files[0]) return;
      const file = e.target.files[0];
      
      if (!file.type.startsWith('image/')) {
        toast({
          title: 'Invalid file type',
          description: 'Please select an image file.',
          variant: 'destructive',
        });
        return;
      }
      
      if (file.size > 5 * 1024 * 1024) {
        toast({
          title: 'File too large',
          description: 'Please select an image smaller than 5MB.',
          variant: 'destructive',
        });
        return;
      }
      
      setSelectedImage(URL.createObjectURL(file));
      setCropDialogOpen(true);
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to load image.', variant: 'destructive' });
    }
  };

  const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    try {
      if (!e.target.files || !e.target.files[0]) return;
      const file = e.target.files[0];
      
      if (!file.type.startsWith('image/')) {
        toast({
          title: 'Invalid file type',
          description: 'Please select an image file.',
          variant: 'destructive',
        });
        return;
      }
      
      if (file.size > 5 * 1024 * 1024) {
        toast({
          title: 'File too large',
          description: 'Please select an image smaller than 5MB.',
          variant: 'destructive',
        });
        return;
      }
      
      // Open cropping dialog instead of uploading directly
      setSelectedCoverImage(URL.createObjectURL(file));
      setCoverCropDialogOpen(true);
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to load image.', variant: 'destructive' });
    }
  };

  const handleCoverCropSave = async () => {
    if (!selectedCoverImage || !coverCroppedAreaPixels) return;
    setLoading(true);
    try {
      const croppedBlob = await getCroppedImg(selectedCoverImage, coverCroppedAreaPixels);
      const fileExt = 'jpeg';
      const fileName = `${user?.id}/cover/${Date.now()}.${fileExt}`;
      const { data, error } = await supabase.storage.from('portfolio').upload(fileName, croppedBlob, { contentType: 'image/jpeg' });
      if (error) throw error;
      const { data: { publicUrl } } = supabase.storage.from('portfolio').getPublicUrl(fileName);
      const { error: updateError } = await supabase.from('profiles').update({ coverphoto: publicUrl }).eq('id', user?.id);
      if (updateError) throw updateError;
      setProfile(prev => prev ? { ...prev, coverphoto: publicUrl } : null);
      toast({ title: 'Success', description: 'Cover photo updated successfully!' });
      setCoverCropDialogOpen(false);
      setSelectedCoverImage(null);
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to upload cropped cover image.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handlePortfolioUpload = async (file: File) => {
    try {
      if (!barberProfile) return;
      
      setLoading(true);
      
      // Upload to Supabase Storage
      const fileExt = file.name.split('.').pop();
      const fileName = `${user?.id}/portfolio/${Date.now()}.${fileExt}`;
      const { data, error } = await supabase.storage
        .from('portfolio')
        .upload(fileName, file);

      if (error) throw error;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('portfolio')
        .getPublicUrl(fileName);

      // Add to portfolio array
      const newPortfolioItem: PortfolioItem = {
        id: `item-${Date.now()}`,
        type: file.type.startsWith('video/') ? 'video' : 'image',
        url: publicUrl,
        title: file.name.replace(/\.[^/.]+$/, ''),
        likes: 0,
        comments: 0
      };

      setPortfolio(prev => [newPortfolioItem, ...prev]);
      
      // Update barber profile
      const updatedPortfolio = [publicUrl, ...(barberProfile.portfolio || [])];
      const { error: updateError } = await supabase
        .from('barbers')
        .update({ portfolio: updatedPortfolio })
        .eq('id', barberProfile.id);

      if (updateError) throw updateError;

      toast({
        title: 'Success',
        description: 'Portfolio item uploaded successfully!',
      });
    } catch (error) {
      logger.error('Error uploading portfolio item', error)
      toast({
        title: 'Error',
        description: 'Failed to upload portfolio item. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCropSave = async () => {
    if (!selectedImage || !croppedAreaPixels) return;
      setAvatarLoading(true);
    try {
      const croppedBlob = await getCroppedImg(selectedImage, croppedAreaPixels);
      const fileExt = 'jpeg';
      const fileName = `${user?.id}/${Date.now()}.${fileExt}`;
      const { data, error } = await supabase.storage.from('avatars').upload(fileName, croppedBlob, { contentType: 'image/jpeg' });
      if (error) throw error;
      const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(fileName);
      const { error: updateError } = await supabase.from('profiles').update({ avatar_url: publicUrl }).eq('id', user?.id);
      if (updateError) throw updateError;
      setProfile(prev => prev ? { ...prev, avatar_url: publicUrl } : null);
      toast({ title: 'Success', description: 'Profile picture updated successfully!' });
      setCropDialogOpen(false);
      setSelectedImage(null);
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to upload cropped image.', variant: 'destructive' });
    } finally {
      setAvatarLoading(false);
    }
  };

  const handleVideoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (files.length === 0) return

    const file = files[0]
    
    // Validate file type
    if (!file.type.startsWith('video/')) {
      toast({
        title: 'Invalid file type',
        description: 'Please select a video file.',
        variant: 'destructive',
      })
      return
    }

    // Validate file size (270MB limit for videos)
    if (file.size > 270 * 1024 * 1024) {
      toast({
        title: 'File too large',
        description: 'Please select a video smaller than 270MB.',
        variant: 'destructive',
      })
      return
    }

    setSelectedVideoFile(file);
    setVideoPreviewUrl(URL.createObjectURL(file));
  };

  const handlePostCut = async () => {
    if (!selectedVideoFile || !barberProfile) return;

    setUploading(true);

    try {
      // Upload to Supabase Storage
      const fileExt = selectedVideoFile.name.split('.').pop()
      const fileName = `${user?.id}/cuts/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`
      
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('portfolio')
        .upload(fileName, selectedVideoFile)

      if (uploadError) throw uploadError

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('portfolio')
        .getPublicUrl(fileName)

      // Insert into cuts table
      const { error: insertError } = await supabase
        .from('cuts')
        .insert({
          barber_id: barberProfile.id,
          title: uploadForm.title || selectedVideoFile.name.replace(/\.[^/.]+$/, ''),
          description: uploadForm.description,
          url: publicUrl,
          category: 'hair-styling',
          tags: uploadForm.tags.split(',').map(t => t.trim()).filter(Boolean),
          location_name: profile?.location || '',
          city: profile?.location?.split(',')[1]?.trim() || '',
          state: profile?.location?.split(',')[2]?.trim() || '',
          latitude: null,
          longitude: null,
          is_featured: false,
          is_public: true
        })

      if (insertError) throw insertError
      
      toast({
        title: 'Success',
        description: 'Cut posted successfully!',
      })
      
      // Refresh cuts
      refreshCuts(); // Use refreshCuts from useCuts
      
      // Reset form and close dialog
      setOpenDialog(null)
      setUploadForm({
        title: '',
        description: '',
        tags: ''
      })
      setSelectedVideoFile(null);
      setVideoPreviewUrl(null);

    } catch (error) {
      logger.error('Error posting cut', error)
      toast({
        title: 'Error',
        description: 'Failed to post cut. Please try again.',
        variant: 'destructive',
      })
    } finally {
      setUploading(false)
    }
  }

  const handleEditCut = (cut: any) => {
    setEditingCut(cut);
    setUploadForm({
      title: cut.title || '',
      description: cut.description || '',
      tags: cut.tags?.join(', ') || ''
    });
    setOpenDialog('edit-cut');
  };

  const handleUpdateCut = async () => {
    if (!editingCut || !barberProfile) return;

    try {
      setUploading(true);
      
      const { error: updateError } = await supabase
        .from('cuts')
        .update({
          title: uploadForm.title,
          description: uploadForm.description,
          category: 'hair-styling',
          tags: uploadForm.tags.split(',').map(t => t.trim()).filter(Boolean),
          location_name: profile?.location || '',
          city: profile?.location?.split(',')[1]?.trim() || '',
          state: profile?.location?.split(',')[2]?.trim() || '',
          latitude: null,
          longitude: null,
          updated_at: new Date().toISOString()
        })
        .eq('id', editingCut.id);

      if (updateError) throw updateError;

      toast({
        title: 'Success',
        description: 'Cut updated successfully!',
      });

      // Refresh cuts
      refreshCuts(); // Use refreshCuts from useCuts
      setOpenDialog(null);
      setEditingCut(null);
      setUploadForm({
        title: '',
        description: '',
        tags: ''
      });
    } catch (error) {
      logger.error('Error updating cut', error)
      toast({
        title: 'Error',
        description: 'Failed to update cut. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteCut = async (cutId: string) => {
    if (!barberProfile) return;

    try {
      const { error: deleteError } = await supabase
        .from('cuts')
        .delete()
        .eq('id', cutId);

      if (deleteError) throw deleteError;

      toast({
        title: 'Success',
        description: 'Cut deleted successfully!',
      });

      // Refresh cuts
      refreshCuts(); // Use refreshCuts from useCuts
    } catch (error) {
      logger.error('Error deleting cut', error)
      toast({
        title: 'Error',
        description: 'Failed to delete cut. Please try again.',
        variant: 'destructive',
      });
    }
  };

  const handleToggleCutVisibility = async (cutId: string, isPublic: boolean) => {
    if (!barberProfile) return;

    try {
      const { error: updateError } = await supabase
        .from('cuts')
        .update({ is_public: !isPublic })
        .eq('id', cutId);

      if (updateError) throw updateError;

      toast({
        title: 'Success',
        description: `Cut ${!isPublic ? 'published' : 'made private'} successfully!`,
      });

      // Refresh cuts
      refreshCuts(); // Use refreshCuts from useCuts
    } catch (error) {
      logger.error('Error updating cut visibility', error)
      toast({
        title: 'Error',
        description: 'Failed to update cut visibility. Please try again.',
        variant: 'destructive',
      });
    }
  };

  const handleToggleFeatured = async (cutId: string, isFeatured: boolean) => {
    if (!barberProfile) return;

    try {
      const { error: updateError } = await supabase
        .from('cuts')
        .update({ is_featured: !isFeatured })
        .eq('id', cutId);

      if (updateError) throw updateError;

      toast({
        title: 'Success',
        description: `Cut ${!isFeatured ? 'featured' : 'unfeatured'} successfully!`,
      });

      // Refresh cuts
      refreshCuts(); // Use refreshCuts from useCuts
    } catch (error) {
      logger.error('Error updating cut featured status', error)
      toast({
        title: 'Error',
        description: 'Failed to update cut featured status. Please try again.',
        variant: 'destructive',
      });
    }
  };

  const handleProfileUpdate = async (updatedData: any) => {
    try {
      // Update profile data
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          name: updatedData.name,
          bio: updatedData.bio,
          location: updatedData.location,
          phone: updatedData.phone,
          updated_at: new Date().toISOString()
        })
        .eq('id', user?.id);

      if (profileError) throw profileError;

      // Update barber profile data
      if (barberProfile) {
        const { error: barberError } = await supabase
          .from('barbers')
          .update({
            bio: updatedData.bio,
            instagram: updatedData.instagram,
            twitter: updatedData.twitter,
            facebook: updatedData.facebook,
            updated_at: new Date().toISOString()
          })
          .eq('user_id', user?.id);

        if (barberError) throw barberError;
      }

      // Refresh profile data
      const [profileResult, barberResult] = await Promise.all([
        supabase
          .from('profiles')
          .select('*')
          .eq('id', user?.id)
          .single(),
        supabase
          .from('barbers')
          .select('*')
          .eq('user_id', user?.id)
          .single()
      ]);

      if (profileResult.data) setProfile(profileResult.data);
      if (barberResult.data) setBarberProfile(barberResult.data);

      toast({
        title: 'Success',
        description: 'Profile updated successfully!',
      });
    } catch (error) {
      logger.error('Error updating profile', error)
      toast({
        title: 'Error',
        description: 'Failed to update profile.',
        variant: 'destructive',
      });
    }
  };

  const openStatsDialog = async (cut: any) => {
    setStatsDialogCut(cut);
    setStatsDialogOpen(true);
    setCommentsLoading(true);
    // Fetch comments for this cut
    const { data, error } = await supabase
      .from('cut_comments')
      .select('*')
      .eq('cut_id', cut.id)
      .order('created_at', { ascending: false });
    setComments(data || []);
    setCommentsLoading(false);
  };

  const closeStatsDialog = () => {
    setStatsDialogOpen(false);
    setStatsDialogCut(null);
    setComments([]);
  };

  // Starred/featured portfolio logic
  const handleStarPortfolio = async (item: PortfolioItem) => {
    if (!barberProfile) return;
    setFeaturedId(item.id);
    // Update backend
    await supabase.from('barbers').update({ featured_portfolio: item.id }).eq('id', barberProfile.id);
  };
  // Delete portfolio item
  const handleDeletePortfolio = async (item: PortfolioItem) => {
    if (!window.confirm('Are you sure you want to delete this item?')) return;
    // Remove from state
    setPortfolio(prev => prev.filter(i => i.id !== item.id));
    // Remove from backend
    if (barberProfile) {
      const newUrls = portfolio.filter(i => i.id !== item.id).map(i => i.url);
      await supabase.from('barbers').update({ portfolio: newUrls }).eq('id', barberProfile.id);
      // If deleted item was featured, clear featured_portfolio
      if (featuredId === item.id) {
        setFeaturedId(null);
        await supabase.from('barbers').update({ featured_portfolio: null }).eq('id', barberProfile.id);
      }
    }
    setPortfolioModalOpen(false);
  };

  const isOwner = true; // Always true for now, since this is the user's own profile

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-white">
        <div className="text-xl font-bebas font-bold animate-pulse text-white">Loading profile...</div>
      </div>
    );
  }

  // Main layout and header (new design)
  return (
    <div className="min-h-screen bg-background text-white pb-32">
      {/* Cover Photo */}
      <div className="relative h-48 sm:h-64 md:h-80 w-full">
        {profile?.coverphoto ? (
          <img
            src={profile.coverphoto}
            alt="Cover"
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-saffron/20 via-purple-500/20 to-saffron/20 relative">
          </div>
        )}
        {/* Glassy overlay */}
        <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" />
        {/* Cover photo upload button */}
        {isOwner && (
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-2 right-2 bg-black/30 text-white hover:bg-black/50"
            onClick={() => document.getElementById('cover-upload')?.click()}
          >
            <Camera className="h-5 w-5" />
          </Button>
        )}
        {/* Avatar */}
        <div className="absolute left-1/2 -bottom-16 transform -translate-x-1/2 z-10">
          <Avatar className="h-32 w-32 border-4 border-black shadow-xl">
            <AvatarImage src={profile?.avatar_url || '/placeholder.svg'} alt={profile?.name || 'Avatar'} />
            <AvatarFallback>{profile?.name?.charAt(0) || 'U'}</AvatarFallback>
          </Avatar>
          {/* Avatar upload button */}
          {isOwner && (
            <Button
              variant="ghost"
              size="icon"
              className="absolute -bottom-1 -right-1 h-8 w-8 bg-white text-black hover:bg-white/90 rounded-full"
              onClick={() => avatarFileInputRef.current?.click()}
              disabled={avatarLoading}
            >
              {avatarLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Camera className="h-4 w-4" />
              )}
            </Button>
          )}
        </div>
      </div>

      {/* Hidden file inputs */}
      <input
        ref={avatarFileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleAvatarUpload}
        disabled={avatarLoading}
      />
      <input
        id="cover-upload"
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleCoverUpload}
      />

      {/* Name, Username, Stats */}
      <div className="pt-20 pb-6 px-4 text-center">
        <h1 className="text-3xl font-bebas font-bold mb-1 text-white">{profile?.name || 'Your Name'}</h1>
        <div className="text-secondary text-lg font-semibold mb-2">@{profile?.username || profile?.name?.toLowerCase().replace(/\s+/g, '') || 'username'}</div>
        {/* City and State */}
        {profile?.location && (
          <div className="text-white/70 text-base font-medium mb-2 font-pacifico">
            {(() => {
              const parts = profile.location.split(',').map(s => s.trim());
              logger.debug('Location parts', { parts })
              
              if (parts.length >= 8) {
                // For old Nominatim format: pull parts 1, 2, and 8 (0-indexed)
                const street = parts[0];
                const city = parts[1];
                const state = parts[6];
                return `${street}, ${city}, ${state}`;
              } else if (parts.length >= 4) {
                // For format: "88 Doe Court, Wynwood Drive, South Brunswick, NJ"
                // Show: "South Brunswick, NJ" (second-to-last and last parts)
                const city = parts[parts.length - 2];
                const state = parts[parts.length - 1];
                return `${city}, ${state}`;
              } else if (parts.length >= 3) {
                // For format: "88 Doe Court, South Brunswick, NJ"
                // Show: "South Brunswick, NJ" (city and state)
                const city = parts[1];
                const state = parts[2];
                return `${city}, ${state}`;
              } else if (parts.length >= 2) {
                // Fallback for shorter formats
                const city = parts[0];
                const state = parts[1];
                return `${city}, ${state}`;
              } else {
                return profile.location;
              }
            })()}
          </div>
        )}
        {/* Stats Row */}
        <div className="flex justify-center gap-10 mt-4 w-full">
          <div className="flex flex-col items-center">
            <span className="font-bold text-2xl text-white">{cuts.length}</span>
            <span className="text-xs text-white/60 uppercase tracking-wide">Cuts</span>
          </div>
          <div className="flex flex-col items-center">
            <span className="font-bold text-2xl text-white">{portfolio.length}</span>
            <span className="text-xs text-white/60 uppercase tracking-wide">Portfolio</span>
          </div>
        </div>
      </div>
      {/* Tabs Section (modern, mobile-first) */}
      <div className="max-w-3xl mx-auto w-full px-2 sm:px-4">
        <Tabs defaultValue="portfolio" className="w-full">
          <TabsList className="w-full flex justify-between bg-white/5 border border-white/10 backdrop-blur-xl p-1 rounded-lg mb-6 sticky top-0 z-20">
            <TabsTrigger value="portfolio" className="flex-1 rounded-md text-sm data-[state=active]:bg-secondary data-[state=active]:text-primary">Portfolio</TabsTrigger>
            <TabsTrigger value="reels" className="flex-1 rounded-md text-sm data-[state=active]:bg-secondary data-[state=active]:text-primary">
              <div className="flex items-center gap-2">
                <VideoIcon className="h-4 w-4" />
                Cuts
                {cutsLoading && <Loader2 className="h-3 w-3 animate-spin" />}
              </div>
            </TabsTrigger>
            <TabsTrigger value="services" className="flex-1 rounded-md text-sm data-[state=active]:bg-secondary data-[state=active]:text-primary">Services</TabsTrigger>
            <TabsTrigger value="reviews" className="flex-1 rounded-md text-sm data-[state=active]:bg-secondary data-[state=active]:text-primary">Reviews</TabsTrigger>
          </TabsList>

          {/* Reels Tab */}
          <TabsContent value="reels">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-white font-bebas font-bold text-xl">Your Cuts ({cuts.length})</h3>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={refreshCuts}
                  disabled={cutsLoading}
                  className="text-white/60 hover:text-white"
                >
                  <Loader2 className={cn("h-4 w-4", cutsLoading && "animate-spin")} />
                </Button>
                {isOwner && (
                  <Button
                    onClick={() => setOpenDialog('upload')}
                    size="sm"
                    className="bg-secondary text-primary hover:bg-secondary/90"
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    Upload Cut
                  </Button>
                )}
              </div>
            </div>
            
            {cutsLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="text-center">
                  <Loader2 className="h-8 w-8 animate-spin text-secondary mx-auto mb-4" />
                  <p className="text-white/60">Loading your cuts...</p>
                </div>
              </div>
            ) : cuts.length === 0 ? (
              <div className="text-center py-12">
                <div className="bg-white/5 border border-white/10 rounded-xl p-8 max-w-md mx-auto">
                  <VideoIcon className="h-12 w-12 text-white/40 mx-auto mb-4" />
                  <h3 className="text-white font-bebas font-bold text-xl mb-2">No cuts yet</h3>
                  <p className="text-white/60 text-sm mb-6">
                    Start sharing your work by uploading your first cut
                  </p>
                  {isOwner && (
                    <div className="space-y-3">
                      <Button
                        onClick={() => setOpenDialog('upload')}
                        className="bg-secondary text-primary hover:bg-secondary/90 w-full"
                      >
                        <Upload className="h-4 w-4 mr-2" />
                        Upload First Cut
                      </Button>
                      <Button
                        onClick={async () => {
                          if (!createCut) return;
                          try {
                            const testCut = await createCut({
                              title: 'Test Cut',
                              description: 'This is a test cut',
                              url: 'https://sample-videos.com/zip/10/mp4/SampleVideo_1280x720_1mb.mp4',
                              category: 'hair-styling',
                              duration: 30,
                              tags: ['test', 'demo'],
                              is_public: true
                            })
                            if (testCut) {
                              toast({
                                title: 'Success',
                                description: 'Test cut created successfully!',
                              })
                            }
                          } catch (error) {
                            logger.error('Error creating test cut', error)
                            toast({
                              title: 'Error',
                              description: 'Failed to create test cut.',
                              variant: 'destructive',
                            })
                          }
                        }}
                        variant="outline"
                        className="w-full border-white/20 text-white hover:bg-white/10"
                      >
                        Create Test Cut
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2">
                {cuts.map((cut) => (
                  <div 
                    key={cut.id} 
                    className="relative aspect-[4/5] bg-gray-800 rounded-lg overflow-hidden group cursor-pointer"
                    onMouseEnter={(e) => {
                      const video = e.currentTarget.querySelector('video') as HTMLVideoElement;
                      if (video) {
                        video.play().catch(() => {
                          // Auto-play might be blocked
                        });
                      }
                    }}
                    onMouseLeave={(e) => {
                      const video = e.currentTarget.querySelector('video') as HTMLVideoElement;
                      if (video) {
                        video.pause();
                      }
                    }}
                    onClick={() => {
                      setSelectedCut(cut);
                      setOpenDialog('video');
                    }}
                  >
                    {cut.thumbnail ? (
                      <img 
                        src={cut.thumbnail} 
                        alt={cut.title} 
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <video 
                        src={cut.url} 
                        className="w-full h-full object-cover"
                        muted 
                        playsInline 
                        preload="metadata"
                      />
                    )}
                    {/* Overlay with stats */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                      <div className="absolute bottom-2 left-2 right-2">
                        <div className="flex items-center justify-between text-white text-xs">
                          <div className="flex items-center gap-2">
                            <Heart className="h-3 w-3" />
                            <span>{cut.likes || 0}</span>
                          </div>
                                                     <div className="flex items-center gap-2">
                             <MessageCircle className="h-3 w-3" />
                             <span>{cut.comments_count || 0}</span>
                           </div>
                        </div>
                      </div>
                    </div>
                    {/* Owner controls */}
                    {isOwner && (
                      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0 bg-black/50 hover:bg-black/70 text-white"
                            >
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="bg-black/90 border-white/20">
                            <DropdownMenuItem
                              onClick={() => handleEditCut(cut)}
                              className="text-white hover:bg-white/10"
                            >
                              <Edit className="h-4 w-4 mr-2" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleToggleCutVisibility(cut.id, !cut.is_public)}
                              className="text-white hover:bg-white/10"
                            >
                              {cut.is_public ? (
                                <>
                                  <EyeOff className="h-4 w-4 mr-2" />
                                  Make Private
                                </>
                              ) : (
                                <>
                                  <Eye className="h-4 w-4 mr-2" />
                                  Make Public
                                </>
                              )}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleToggleFeatured(cut.id, !cut.is_featured)}
                              className="text-white hover:bg-white/10"
                            >
                              {cut.is_featured ? (
                                <>
                                  <Star className="h-4 w-4 mr-2" />
                                  Remove from Featured
                                </>
                              ) : (
                                <>
                                  <Star className="h-4 w-4 mr-2" />
                                  Add to Featured
                                </>
                              )}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => openStatsDialog(cut)}
                              className="text-white hover:bg-white/10"
                            >
                              <Award className="h-4 w-4 mr-2" />
                              View Stats
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleDeleteCut(cut.id)}
                              className="text-red-400 hover:bg-red-400/10"
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Portfolio Tab */}
          <TabsContent value="portfolio">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-white font-bebas font-bold text-xl">Portfolio ({portfolio.length})</h3>
              {isOwner && (
                <Button
                  onClick={() => setOpenDialog('portfolio-upload')}
                  size="sm"
                  className="bg-secondary text-primary hover:bg-secondary/90"
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Add to Portfolio
                </Button>
              )}
            </div>
            
            {portfolio.length === 0 ? (
              <div className="text-center py-12">
                <div className="bg-white/5 border border-white/10 rounded-xl p-8 max-w-md mx-auto">
                  <ImageIcon className="h-12 w-12 text-white/40 mx-auto mb-4" />
                  <h3 className="text-white font-bebas font-bold text-xl mb-2">No portfolio items yet</h3>
                  <p className="text-white/60 text-sm mb-6">
                    Showcase your best work by adding photos and videos to your portfolio
                  </p>
                  {isOwner && (
                    <Button
                      onClick={() => setOpenDialog('portfolio-upload')}
                      className="bg-secondary text-primary hover:bg-secondary/90 w-full"
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      Add First Portfolio Item
                    </Button>
                  )}
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2">
                {portfolio.map((item) => (
                  <div key={item.id} className="relative aspect-square bg-gray-800 rounded-lg overflow-hidden group">
                    {item.type === 'image' ? (
                      <img src={item.url} alt={item.title || 'Portfolio'} className="w-full h-full object-cover" />
                    ) : (
                      <video src={item.url} className="w-full h-full object-cover" controls={false} muted playsInline preload="metadata" />
                    )}
                    {/* Delete button (visible on hover) */}
                    <button
                      className="absolute top-2 right-2 bg-white/90 hover:bg-red-600 text-red-600 hover:text-white rounded-full p-1.5 shadow-lg focus:outline-none border-2 border-white/40 transition-colors opacity-0 group-hover:opacity-100"
                      onClick={() => handleDeletePortfolio(item)}
                      aria-label="Delete portfolio item"
                      type="button"
                    >
                      <Trash2 className="h-5 w-5" />
                    </button>
                    <div className="absolute bottom-2 left-2 right-2">
                      <div className="flex items-center justify-between text-white text-xs">
                        <div className="flex items-center gap-2">
                          <Heart className="h-3 w-3" />
                          <span>{item.likes || 0}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <MessageCircle className="h-3 w-3" />
                          <span>{item.comments || 0}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Services Tab */}
          <TabsContent value="services">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-white font-bebas font-bold text-xl">Services & Add-ons</h3>
              {isOwner && (
                <div className="flex gap-2">
                  <Button
                    onClick={() => setOpenDialog('addons')}
                    size="sm"
                    variant="outline"
                    className="border-white/20 text-white hover:bg-white/10 px-2 py-1 text-xs"
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    Add-on
                  </Button>
                  <Button
                    onClick={() => setOpenDialog('services')}
                    size="sm"
                    variant="outline"
                    className="border-white/20 text-white hover:bg-white/10 px-2 py-1 text-xs"
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    Add Service
                  </Button>
                </div>
              )}
            </div>
            
            {/* Sub-tabs for Services and Add-ons */}
            <Tabs defaultValue="services" className="w-full">
              <TabsList className="w-full flex bg-white/5 border border-white/10 p-1 rounded-lg mb-4">
                <TabsTrigger value="services" className="flex-1 rounded-md text-sm data-[state=active]:bg-secondary data-[state=active]:text-primary">
                  Services ({services.length})
                </TabsTrigger>
                <TabsTrigger value="addons" className="flex-1 rounded-md text-sm data-[state=active]:bg-secondary data-[state=active]:text-primary">
                  Add-ons ({addons.length})
                </TabsTrigger>
              </TabsList>

              {/* Services Sub-tab */}
              <TabsContent value="services">
                {servicesLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="text-center">
                                        <Loader2 className="h-8 w-8 animate-spin text-secondary mx-auto mb-4" />
                  <p className="text-white/60">Loading services...</p>
                    </div>
                  </div>
                ) : services.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="bg-white/5 border border-white/10 rounded-xl p-8 max-w-md mx-auto">
                      <Building className="h-12 w-12 text-white/40 mx-auto mb-4" />
                      <h3 className="text-white font-bebas font-bold text-xl mb-2">No services yet</h3>
                      <p className="text-white/60 text-sm mb-6">
                        Add your services to let clients know what you offer
                      </p>
                      {isOwner && (
                        <Button
                          onClick={() => setOpenDialog('services')}
                          className="bg-secondary text-primary hover:bg-secondary/90"
                        >
                          <Plus className="h-4 w-4 mr-2" />
                          Add First Service
                        </Button>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {services.map((service) => (
                      <div key={service.id} className="bg-white/5 border border-white/10 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-2">
                          <h3 className="font-semibold text-white">{service.name}</h3>
                          <div className="text-right">
                            <div className="font-bold text-white">${service.price}</div>
                            <div className="text-white/70 text-sm">{service.duration}</div>
                          </div>
                        </div>
                        {service.description && (
                          <p className="text-white/80 text-sm mb-3">{service.description}</p>
                        )}
                        <Button 
                          onClick={() => handleBookService(service)}
                          className="w-full bg-secondary text-primary hover:bg-secondary/90"
                        >
                          Book This Service
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>

              {/* Add-ons Sub-tab */}
              <TabsContent value="addons">
                {addonsLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="text-center">
                                        <Loader2 className="h-8 w-8 animate-spin text-secondary mx-auto mb-4" />
                  <p className="text-white/60">Loading add-ons...</p>
                    </div>
                  </div>
                ) : addons.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="bg-white/5 border border-white/10 rounded-xl p-8 max-w-md mx-auto">
                      <Plus className="h-12 w-12 text-white/40 mx-auto mb-4" />
                      <h3 className="text-white font-bebas font-bold text-xl mb-2">No add-ons yet</h3>
                      <p className="text-white/60 text-sm mb-6">
                        Add extra services that clients can choose from
                      </p>
                      {isOwner && (
                        <Button
                          onClick={() => setOpenDialog('addons')}
                          className="bg-secondary text-primary hover:bg-secondary/90"
                        >
                          <Plus className="h-4 w-4 mr-2" />
                          Add First Add-on
                        </Button>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {addons.map((addon) => (
                      <div key={addon.id} className="bg-white/5 border border-white/10 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-2">
                          <h3 className="font-semibold text-white">{addon.name}</h3>
                          <div className="text-right">
                            <div className="font-bold text-white">${addon.price}</div>
                            <div className="text-white/70 text-sm">{addon.duration || 'Quick add-on'}</div>
                          </div>
                        </div>
                        {addon.description && (
                          <p className="text-white/80 text-sm mb-3">{addon.description}</p>
                        )}
                        <Button 
                          onClick={() => handleAddToBooking(addon)}
                          className="w-full bg-secondary text-primary hover:bg-secondary/90"
                        >
                          Add to Booking
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </TabsContent>


        </Tabs>
      </div>
      {/* Upload Dialog */}
      <Dialog open={openDialog === 'upload'} onOpenChange={open => {
        setOpenDialog(open ? 'upload' : null);
        if (!open) {
          setUploadForm({
            title: '',
            description: '',
            tags: ''
          });
          setSelectedVideoFile(null);
          setVideoPreviewUrl(null);
        }
      }}>
        <DialogContent className="max-w-md w-full bg-white/5 border border-white/10 backdrop-blur-xl rounded-2xl shadow-2xl p-6 overflow-y-auto max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-white">Upload New Cut</DialogTitle>
            <DialogDescription className="text-white/80">
              Share your latest work with the community
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6">
            {/* Video Selection */}
            <div>
              <Label htmlFor="video-upload" className="text-white font-medium mb-2 block">
                Select Video File
              </Label>
              <div className="border-2 border-dashed border-white/20 rounded-xl p-8 text-center hover:border-secondary/50 transition-colors">
                <input
                  ref={fileInputRef}
                  id="video-upload"
                  type="file"
                  accept="video/*"
                  onChange={handleVideoSelect}
                  className="hidden"
                  disabled={uploading}
                />
                <Button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="bg-secondary text-primary font-bold rounded-xl px-8 py-3 mb-4"
                >
                  {uploading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Uploading...
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4 mr-2" />
                      Choose Video
                    </>
                  )}
                </Button>
                <p className="text-white/60 text-sm">
                  MP4, MOV, or AVI up to 270MB
                </p>
              </div>
            </div>
            {/* Video Preview */}
            {videoPreviewUrl && (
              <div className="bg-white/5 rounded-xl p-4">
                <h4 className="text-white font-medium mb-3">Video Preview</h4>
                <div className="aspect-video rounded-lg overflow-hidden">
                  <video src={videoPreviewUrl} className="w-full h-full object-cover" controls />
                </div>
              </div>
            )}
            {/* Form Fields */}
            {selectedVideoFile && (
              <div className="space-y-4">
                <div>
                  <Label htmlFor="title" className="text-white font-medium mb-2 block">
                    Title
                  </Label>
                  <Input
                    id="title"
                    placeholder="Enter video title"
                    value={uploadForm.title}
                    onChange={(e) => setUploadForm(prev => ({ ...prev, title: e.target.value }))}
                    className="bg-white/10 border-white/20 text-white placeholder:text-white/40"
                  />
                </div>
                <div>
                  <Label htmlFor="description" className="text-white font-medium mb-2 block">
                    Description
                  </Label>
                  <Textarea
                    id="description"
                    placeholder="Describe your video content..."
                    value={uploadForm.description}
                    onChange={(e) => setUploadForm(prev => ({ ...prev, description: e.target.value }))}
                    className="bg-white/10 border-white/20 text-white placeholder:text-white/40 min-h-[100px]"
                  />
                </div>
                <div>
                  <Label htmlFor="tags" className="text-white font-medium mb-2 block">
                    Tags
                  </Label>
                  <Input
                    id="tags"
                    placeholder="Add tags separated by commas"
                    value={uploadForm.tags}
                    onChange={(e) => setUploadForm(prev => ({ ...prev, tags: e.target.value }))}
                    className="bg-white/10 border-white/20 text-white placeholder:text-white/40"
                  />
                  <p className="text-white/40 text-xs mt-1">Example: fade, tutorial, classic</p>
                </div>
                {/* Post Button */}
                <div className="flex gap-3 pt-4">
                  <Button
                    onClick={handlePostCut}
                    disabled={uploading}
                    className="flex-1 bg-secondary text-primary font-bold rounded-xl px-6 py-3 hover:bg-secondary/90"
                  >
                    {uploading ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Posting...
                      </>
                    ) : (
                      <>
                        <Upload className="h-4 w-4 mr-2" />
                        Post Cut
                      </>
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setOpenDialog(null)}
                    className="border-white/20 text-white hover:bg-white/10 rounded-xl px-6 py-3"
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Cut Dialog */}
      <Dialog open={openDialog === 'edit-cut'} onOpenChange={open => {
        setOpenDialog(open ? 'edit-cut' : null);
        if (!open) {
          setEditingCut(null);
          setUploadForm({
            title: '',
            description: '',
            tags: ''
          });
        }
      }}>
        <DialogContent className="max-w-2xl w-full bg-white/5 border border-white/10 backdrop-blur-xl rounded-2xl shadow-2xl p-8 overflow-y-auto max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bebas text-white">Edit Cut</DialogTitle>
            <DialogDescription className="text-white/80">
              Update your cut information and settings
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6">
            {/* Video Preview */}
            {editingCut && (
              <div className="bg-white/5 rounded-2xl p-4">
                <h4 className="text-white font-medium mb-3">Video Preview</h4>
                <div className="aspect-video rounded-xl overflow-hidden">
                  <video src={editingCut.url} className="w-full h-full object-cover" controls />
                </div>
              </div>
            )}
            
            <div>
              <Label htmlFor="edit-title" className="text-white font-medium mb-2 block">
                Title
              </Label>
              <Input
                id="edit-title"
                placeholder="Enter video title"
                value={uploadForm.title}
                onChange={(e) => setUploadForm(prev => ({ ...prev, title: e.target.value }))}
                className="bg-white/10 border-white/20 text-white placeholder:text-white/40"
              />
            </div>

            <div>
              <Label htmlFor="edit-description" className="text-white font-medium mb-2 block">
                Description
              </Label>
              <Textarea
                id="edit-description"
                placeholder="Describe your video content..."
                value={uploadForm.description}
                onChange={(e) => setUploadForm(prev => ({ ...prev, description: e.target.value }))}
                className="bg-white/10 border-white/20 text-white placeholder:text-white/40 min-h-[100px]"
              />
            </div>

            <div>
              <Label htmlFor="edit-tags" className="text-white font-medium mb-2 block">
                Tags
              </Label>
              <Input
                id="edit-tags"
                placeholder="Add tags separated by commas"
                value={uploadForm.tags}
                onChange={(e) => setUploadForm(prev => ({ ...prev, tags: e.target.value }))}
                className="bg-white/10 border-white/20 text-white placeholder:text-white/40"
              />
              <p className="text-white/40 text-xs mt-1">Example: fade, tutorial, classic</p>
            </div>

            <div className="flex items-center justify-between p-4 bg-white/5 rounded-xl border border-white/10">
              <div className="flex items-center gap-3">
                <Switch
                  checked={editingCut?.is_featured || false}
                  onCheckedChange={async (checked) => {
                    if (!editingCut) return;
                    try {
                      const { error } = await supabase
                        .from('cuts')
                        .update({ is_featured: checked })
                        .eq('id', editingCut.id);
                      
                      if (error) throw error;
                      
                      setEditingCut((prev: any) => prev ? { ...prev, is_featured: checked } : prev);
                      // Refresh cuts list
                      refreshCuts(); // Use refreshCuts from useCuts
                      
                      toast({
                        title: 'Success',
                        description: `Cut ${checked ? 'featured' : 'unfeatured'} successfully!`,
                      });
                    } catch (error) {
                      logger.error('Error updating featured status', error)
                      toast({
                        title: 'Error',
                        description: 'Failed to update featured status. Please try again.',
                        variant: 'destructive',
                      });
                    }
                  }}
                  id="feature-cut-toggle"
                  className="data-[state=checked]:bg-secondary data-[state=unchecked]:bg-white/20 border-white/30"
                />
                <Label htmlFor="feature-cut-toggle" className="text-white font-medium flex items-center gap-2">
                                      <Star className="h-4 w-4 text-secondary" />
                  Feature this cut
                </Label>
              </div>
              {editingCut?.is_featured && (
                                    <Badge variant="secondary" className="bg-secondary/20 text-secondary border-secondary/30">
                  Currently Featured
                </Badge>
              )}
            </div>


            {/* Action Buttons */}
            <div className="flex gap-3 pt-4">
              <Button
                onClick={handleUpdateCut}
                disabled={uploading}
                className="flex-1 bg-secondary text-primary font-bold rounded-xl px-6 py-3 hover:bg-secondary/90"
              >
                {uploading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Updating...
                  </>
                ) : (
                  <>
                    <Edit className="h-4 w-4 mr-2" />
                    Update Cut
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                onClick={() => setOpenDialog(null)}
                className="border-white/20 text-white hover:bg-white/10 rounded-xl px-6 py-3"
              >
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Video Modal */}
      <Dialog open={openDialog === 'video'} onOpenChange={open => {
        setOpenDialog(open ? 'video' : null);
        if (!open && editPortfolioButtonRef.current) editPortfolioButtonRef.current.focus();
      }}>
        <DialogContent className="max-w-lg w-full flex flex-col items-center bg-darkpurple/90 border border-white/10 backdrop-blur-xl rounded-3xl shadow-2xl">
          <DialogDescription className="sr-only">
            Video player for portfolio content
          </DialogDescription>
          {videoUrl && (
            <video src={videoUrl} controls autoPlay className="w-full rounded-lg" style={{ maxHeight: 400 }} />
          )}
        </DialogContent>
      </Dialog>
      {/* Portfolio Editor Modal */}
      <PortfolioEditor
        initialItems={portfolio}
        open={openDialog === 'portfolio'}
        onClose={() => {
          setOpenDialog(null);
          if (editPortfolioButtonRef.current) editPortfolioButtonRef.current.focus();
        }}
        onSave={async (items) => {
          setPortfolio(items);
          // Refresh profile data to get updated portfolio
          if (user) {
            try {
              const { data: barberResult } = await supabase
                .from('barbers')
                .select('portfolio')
                .eq('user_id', user.id)
                .single();
              if (barberResult?.portfolio) {
                const portfolioItems: PortfolioItem[] = barberResult.portfolio.map((url: string, index: number) => ({
                  id: `item-${index}`,
                  type: url.includes('.mp4') || url.includes('.mov') || url.includes('.avi') ? 'video' : 'image',
                  url
                }));
                setPortfolio(portfolioItems);
              }
            } catch (error) {
              logger.error('Error refreshing portfolio', error)
            }
          }
        }}
      />
      {/* Profile Editor Modal */}
      <ProfileEditorModal
        open={openDialog === 'profile'}
        onClose={() => {
          setOpenDialog(null);
          if (editProfileButtonRef.current) editProfileButtonRef.current.focus();
        }}
        onProfileUpdated={async () => {
          // Refresh profile data after save
          if (user) {
            try {
              setLoading(true);
              const [profileResult, barberResult] = await Promise.all([
                supabase
                  .from('profiles')
                  .select('*')
                  .eq('id', user.id)
                  .single(),
                supabase
                  .from('barbers')
                  .select('*')
                  .eq('user_id', user.id)
                  .single()
              ]);
              if (profileResult.data) setProfile(profileResult.data);
              if (barberResult.data) setBarberProfile(barberResult.data);
            } catch (error) {
              logger.error('Error refreshing profile', error)
            } finally {
              setLoading(false);
            }
          }
        }}
      />
      {/* Location Filter Dialog */}
      <Dialog open={showLocationFilter} onOpenChange={setShowLocationFilter}>
        <DialogContent className="max-w-md w-full bg-darkpurple/90 border border-white/10 backdrop-blur-xl rounded-3xl shadow-2xl p-8 max-h-[90vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bebas text-white">Filter My Cuts</DialogTitle>
            <DialogDescription className="text-white/80">
              Filter your cuts by location
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6 overflow-y-auto max-h-[calc(90vh-200px)] pr-2">
            <div className="space-y-4">
              <div>
                <Label htmlFor="city" className="text-white font-medium mb-2 block">
                  City
                </Label>
                <Input
                  id="city"
                  placeholder="Enter city name"
                  value={locationFilter.city}
                  onChange={(e) => setLocationFilter(prev => ({ ...prev, city: e.target.value }))}
                  className="bg-white/10 border-white/20 text-white placeholder:text-white/40"
                />
              </div>
              
              <div>
                <Label htmlFor="state" className="text-white font-medium mb-2 block">
                  State/Province
                </Label>
                <Input
                  id="state"
                  placeholder="Enter state or province"
                  value={locationFilter.state}
                  onChange={(e) => setLocationFilter(prev => ({ ...prev, state: e.target.value }))}
                  className="bg-white/10 border-white/20 text-white placeholder:text-white/40"
                />
              </div>
              
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="useCurrentLocation"
                    checked={locationFilter.useCurrentLocation}
                    onChange={(e) => setLocationFilter(prev => ({ ...prev, useCurrentLocation: e.target.checked }))}
                    className="rounded border-white/20 bg-white/10 text-secondary focus:ring-secondary"
                  />
                  <Label htmlFor="useCurrentLocation" className="text-white font-medium">
                    Use my current location
                  </Label>
                </div>
                
                {locationFilter.useCurrentLocation && (
                  <div>
                    <Label htmlFor="range" className="text-white font-medium mb-2 block">
                      Range (miles)
                    </Label>
                    <Select 
                      value={locationFilter.range.toString()} 
                      onValueChange={(value) => setLocationFilter(prev => ({ ...prev, range: parseInt(value) }))}
                    >
                      <SelectTrigger className="bg-white/10 border-white/20 text-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-darkpurple border-white/20">
                        <SelectItem value="10" className="text-white">10 miles</SelectItem>
                        <SelectItem value="25" className="text-white">25 miles</SelectItem>
                        <SelectItem value="50" className="text-white">50 miles</SelectItem>
                        <SelectItem value="100" className="text-white">100 miles</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            </div>
            
            <div className="flex gap-3 pt-4 border-t border-white/10">
              <Button
                onClick={() => {
                  setShowLocationFilter(false);
                }}
                className="bg-secondary text-primary font-bold rounded-xl px-6 py-3 flex-1"
              >
                Apply Filter
              </Button>
              <Button
                onClick={() => {
                  setLocationFilter({
                    city: '',
                    state: '',
                    range: 50,
                    useCurrentLocation: false
                  });
                  setUserLocation(null);
                  setShowLocationFilter(false);
                }}
                variant="outline"
                className="border-white/20 text-white rounded-xl px-6 py-3"
              >
                Clear
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      {/* Stats Dialog */}
      <Dialog open={statsDialogOpen} onOpenChange={closeStatsDialog}>
        <DialogContent className="max-w-md w-full bg-darkpurple/90 border border-white/10 backdrop-blur-xl rounded-3xl shadow-2xl p-0 overflow-hidden">
          {statsDialogCut && (
            <>
              <DialogHeader>
                <div className="flex flex-col items-center justify-center text-center py-2">
                  <span className="text-2xl font-extrabold text-white tracking-wide mb-1">{statsDialogCut.title || 'Cut Stats'}</span>
                  {statsDialogCut.id && (
                    <span className="text-xs text-white/40">ID: {statsDialogCut.id}</span>
                  )}
                </div>
                <div className="w-full h-px bg-white/10 my-2" />
              </DialogHeader>
              <div className="p-6 space-y-4">
                {/* Video Preview */}
                <div className="rounded-xl overflow-hidden aspect-video bg-black/40 mb-2">
                  <video
                    src={statsDialogCut.url}
                    className="w-full h-full object-cover"
                    controls
                    poster=""
                    onPlay={async () => {
                      // Increment view count in DB and update UI
                      await supabase
                        .from('cuts')
                        .update({ views: (statsDialogCut.views || 0) + 1 })
                        .eq('id', statsDialogCut.id);
                      setStatsDialogCut((prev: any) => prev ? { ...prev, views: (prev.views || 0) + 1 } : prev);
                    }}
                  />
                </div>
                {/* Posted Date */}
                <div className="text-xs text-white/60 mb-2">
                  Posted: {statsDialogCut.created_at ? new Date(statsDialogCut.created_at).toLocaleDateString() : 'Unknown'}
                </div>
                {/* Stats Row */}
                <div className="flex items-center justify-between gap-4 mb-4">
                                      <span className="flex flex-col items-center text-white"><Eye className="h-6 w-6 text-secondary mb-1" /><span className="text-lg font-bold">{statsDialogCut.views}</span><span className="text-xs text-white/60">Views</span></span>
                  <button
                    className="flex flex-col items-center text-white focus:outline-none"
                    onClick={async () => {
                      await supabase
                        .from('cuts')
                        .update({ likes: (statsDialogCut.likes || 0) + 1 })
                        .eq('id', statsDialogCut.id);
                      setStatsDialogCut((prev: any) => prev ? { ...prev, likes: (prev.likes || 0) + 1 } : prev);
                    }}
                  >
                    <Heart className="h-6 w-6 text-red-400 mb-1" />
                    <span className="text-lg font-bold">{statsDialogCut.likes}</span>
                    <span className="text-xs text-white/60">Likes</span>
                  </button>
                  <span className="flex flex-col items-center text-white"><MessageCircle className="h-6 w-6 text-blue-400 mb-1" /><span className="text-lg font-bold">{statsDialogCut.comments_count || 0}</span><span className="text-xs text-white/60">Comments</span></span>
                </div>
                {/* Comments Section */}
                <div className="bg-white/5 rounded-xl p-4 max-h-60 overflow-y-auto">
                  <h4 className="text-white font-semibold mb-2 text-sm">Comments</h4>
                  {commentsLoading ? (
                    <div className="flex items-center gap-2 text-white/60 text-sm"><Loader2 className="h-4 w-4 animate-spin" /> Loading comments...</div>
                  ) : comments.length === 0 ? (
                    <div className="text-white/60 text-sm">No comments yet.</div>
                  ) : (
                    <ul className="space-y-3">
                      {comments.map((c) => (
                        <li key={c.id} className="text-white/90 text-sm border-b border-white/10 pb-2">
                          <span className="font-semibold text-secondary">{c.user_name || 'User'}</span>
                          <span className="text-white/50 text-xs ml-2">{c.created_at ? new Date(c.created_at).toLocaleString() : ''}</span>
                          <div>{c.comment}</div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
      {/* Cropping Dialog */}
      <Dialog open={cropDialogOpen} onOpenChange={setCropDialogOpen}>
        <DialogContent className="max-w-[400px] bg-darkpurple/95 border border-white/10">
          <DialogHeader>
            <DialogTitle className="text-lg font-bebas text-white">Crop Profile Photo</DialogTitle>
          </DialogHeader>
          {selectedImage && (
            <div className="relative w-full h-64 bg-white/5 rounded-xl overflow-hidden">
              <Cropper
                image={selectedImage}
                crop={crop}
                zoom={zoom}
                aspect={1}
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={onCropComplete}
              />
            </div>
          )}
          <div className="flex gap-3 mt-4">
            <Button onClick={() => setCropDialogOpen(false)} variant="outline" className="flex-1">Cancel</Button>
            <Button onClick={handleCropSave} className="flex-1 bg-secondary text-white font-bold">Save</Button>
          </div>
        </DialogContent>
      </Dialog>
      
      {/* Cover Photo Cropping Dialog */}
      <Dialog open={coverCropDialogOpen} onOpenChange={setCoverCropDialogOpen}>
        <DialogContent className="max-w-[600px] bg-white/5 border border-white/10 backdrop-blur-xl rounded-2xl shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-white">Crop Cover Photo</DialogTitle>
            <DialogDescription className="text-white/80">
              Adjust your cover photo to fit the banner (16:9 ratio)
            </DialogDescription>
          </DialogHeader>
          {selectedCoverImage && (
            <div className="relative w-full h-80 bg-white/5 rounded-xl overflow-hidden">
              <Cropper
                image={selectedCoverImage}
                crop={coverCrop}
                zoom={coverZoom}
                aspect={16/9}
                onCropChange={setCoverCrop}
                onZoomChange={setCoverZoom}
                onCropComplete={onCoverCropComplete}
              />
            </div>
          )}
          <div className="flex gap-3 mt-4">
            <Button onClick={() => setCoverCropDialogOpen(false)} variant="outline" className="flex-1 border-white/20 text-white hover:bg-white/10">Cancel</Button>
            <Button onClick={handleCoverCropSave} className="flex-1 bg-secondary text-primary font-bold">Save Cover</Button>
          </div>
        </DialogContent>
      </Dialog>
      


      {/* Services Dialog */}
      <Dialog open={openDialog === 'services'} onOpenChange={open => {
        setOpenDialog(open ? 'services' : null);
      }}>
        <DialogContent className="max-w-md w-full bg-white/5 border border-white/10 backdrop-blur-xl rounded-2xl shadow-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-white">Add Service</DialogTitle>
            <DialogDescription className="text-white/80">
              Add a new service to your offerings
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6">
            <div>
              <Label htmlFor="service-name" className="text-white font-medium mb-2 block">
                Service Name
              </Label>
              <Input
                id="service-name"
                placeholder="e.g., Haircut, Beard Trim"
                className="bg-white/10 border-white/20 text-white placeholder:text-white/50"
              />
            </div>
            <div>
              <Label htmlFor="service-price" className="text-white font-medium mb-2 block">
                Price ($)
              </Label>
              <Input
                id="service-price"
                type="number"
                placeholder="25"
                className="bg-white/10 border-white/20 text-white placeholder:text-white/50"
              />
            </div>
            <div>
              <Label htmlFor="service-duration" className="text-white font-medium mb-2 block">
                Duration
              </Label>
              <Input
                id="service-duration"
                placeholder="30 minutes"
                className="bg-white/10 border-white/20 text-white placeholder:text-white/50"
              />
            </div>
            <div>
              <Label htmlFor="service-description" className="text-white font-medium mb-2 block">
                Description (Optional)
              </Label>
              <Textarea
                id="service-description"
                placeholder="Describe what's included in this service..."
                className="bg-white/10 border-white/20 text-white placeholder:text-white/50"
                rows={3}
                style={{ whiteSpace: 'pre-wrap' }}
              />
            </div>
            <div className="flex gap-3 pt-4">
              <Button
                onClick={() => setOpenDialog(null)}
                variant="outline"
                className="flex-1 border-white/20 text-white hover:bg-white/10"
              >
                Cancel
              </Button>
              <Button
                onClick={() => {
                  // TODO: Implement service creation
                  toast({
                    title: 'Coming Soon',
                    description: 'Service creation will be available soon!',
                  })
                  setOpenDialog(null)
                }}
                className="flex-1 bg-secondary text-primary hover:bg-secondary/90"
              >
                Add Service
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add-ons Dialog */}
      <Dialog open={openDialog === 'addons'} onOpenChange={open => {
        setOpenDialog(open ? 'addons' : null);
      }}>
        <DialogContent className="max-w-md w-full bg-white/5 border border-white/10 backdrop-blur-xl rounded-2xl shadow-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-white">Add Add-on</DialogTitle>
            <DialogDescription className="text-white/80">
              Add an extra service that clients can choose from
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6">
            <div>
              <Label htmlFor="addon-name" className="text-white font-medium mb-2 block">
                Add-on Name
              </Label>
              <Input
                id="addon-name"
                placeholder="e.g., Beard Oil, Hair Styling"
                className="bg-white/10 border-white/20 text-white placeholder:text-white/50"
              />
            </div>
            <div>
              <Label htmlFor="addon-price" className="text-white font-medium mb-2 block">
                Price ($)
              </Label>
              <Input
                id="addon-price"
                type="number"
                placeholder="5"
                className="bg-white/10 border-white/20 text-white placeholder:text-white/50"
              />
            </div>
            <div>
              <Label htmlFor="addon-duration" className="text-white font-medium mb-2 block">
                Duration (Optional)
              </Label>
              <Input
                id="addon-duration"
                placeholder="5 minutes"
                className="bg-white/10 border-white/20 text-white placeholder:text-white/50"
              />
            </div>
            <div>
              <Label htmlFor="addon-description" className="text-white font-medium mb-2 block">
                Description (Optional)
              </Label>
              <Textarea
                id="addon-description"
                placeholder="Describe what's included in this add-on..."
                className="bg-white/10 border-white/20 text-white placeholder:text-white/50"
                rows={3}
                style={{ whiteSpace: 'pre-wrap' }}
              />
            </div>
            <div className="flex gap-3 pt-4">
              <Button
                onClick={() => setOpenDialog(null)}
                variant="outline"
                className="flex-1 border-white/20 text-white hover:bg-white/10"
              >
                Cancel
              </Button>
              <Button
                onClick={() => {
                  // TODO: Implement addon creation
                  toast({
                    title: 'Coming Soon',
                    description: 'Add-on creation will be available soon!',
                  })
                  setOpenDialog(null)
                }}
                className="flex-1 bg-secondary text-primary hover:bg-secondary/90"
              >
                Add Add-on
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Portfolio Upload Dialog */}
      <Dialog open={openDialog === 'portfolio-upload'} onOpenChange={open => {
        setOpenDialog(open ? 'portfolio-upload' : null);
      }}>
        <DialogContent className="max-w-md w-full bg-white/5 border border-white/10 backdrop-blur-xl rounded-2xl shadow-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-white">Add to Portfolio</DialogTitle>
            <DialogDescription className="text-white/80">
              Upload photos or videos to your portfolio
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6">
            <div>
              <Label htmlFor="portfolio-upload" className="text-white font-medium mb-2 block">
                Select File
              </Label>
              <div className="border-2 border-dashed border-white/20 rounded-xl p-8 text-center hover:border-secondary/50 transition-colors">
                <input
                  id="portfolio-upload"
                  type="file"
                  accept="image/*,video/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      handlePortfolioUpload(file);
                      setOpenDialog(null);
                    }
                  }}
                  className="hidden"
                />
                <Button
                  onClick={() => document.getElementById('portfolio-upload')?.click()}
                  className="bg-secondary text-primary font-bold rounded-xl px-8 py-3 mb-4"
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Choose File
                </Button>
                <p className="text-white/60 text-sm">
                  Images or videos up to 270MB
                </p>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      
      {/* Existing Booking Form */}
      {barberProfile && (
        <BookingForm
          isOpen={bookingFormOpen}
          onClose={() => setBookingFormOpen(false)}
          selectedDate={selectedBookingDate}
          barberId={barberProfile.id}
          onBookingCreated={handleBookingCreated}
        />
      )}
      
      {/* Indeterminate Progress Bar for Portfolio Upload */}
      {uploading && (
        <div className="w-full mb-4">
          <Progress value={100} className="h-2 animate-pulse bg-white/10" />
          <div className="text-xs text-white/60 text-center mt-1">Uploading to portfolio...</div>
        </div>
      )}
    </div>
  );
}

function ProfileEditorModal({ open, onClose, onProfileUpdated }: { open: boolean; onClose: () => void; onProfileUpdated: () => void }) {
  const [formKey, setFormKey] = useState(0);
  
  useEffect(() => {
    if (open) {
      setFormKey(prev => prev + 1);
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl w-full p-0 overflow-y-auto max-h-[90vh]">
        <div className="p-6">
          <BarberProfileSettings
            key={formKey}
            onSave={() => {
              onProfileUpdated();
              onClose();
            }}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
} 