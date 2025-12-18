import { useAuthStore, useUser, useIsAuthenticated, useIsLoading, useAuthStatus, useIsInitialized } from '@/shared/stores/auth-store'
import { useToast } from '@/shared/components/ui/use-toast'
import { useEffect } from 'react'
import { supabase } from '@/shared/lib/supabase'
import { logger } from '@/shared/lib/logger'

// Utility function to determine redirect path based on user profile
export const getRedirectPath = async (userId: string) => {
  try {
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('role, location, email, phone')
      .eq('id', userId)
      .maybeSingle()
    
    if (error || !profile) {
      logger.error('Profile fetch error', error)
      return '/'
    }

    // If user has no role, redirect to select-role page
    if (!profile.role) {
      return '/select-role'
    }

    // Super admin email check
    if (profile.email === 'primbocm@gmail.com') {
      return '/super-admin'
    } else if (profile.role === 'barber') {
      // Check barber completion percentage
      try {
        const { data: barber, error: barberError } = await supabase
          .from('barbers')
          .select('id, business_name, bio, specialties')
          .eq('user_id', userId)
          .maybeSingle()

        if (barberError) {
          logger.error('Barber fetch error', barberError)
          return '/barber/onboarding'
        }

        // Calculate completion percentage
        const totalFields = 6; // business_name, bio, specialties, phone, location, services
        let completedFields = 0;
        
        if (barber?.business_name) completedFields++;
        if (barber?.bio) completedFields++;
        if (barber?.specialties && barber.specialties.length > 0) completedFields++;
        if (profile?.phone) completedFields++;
        if (profile?.location) completedFields++;
        
        // Check for services
        if (barber?.id) {
          const { data: services } = await supabase
            .from('services')
            .select('id')
            .eq('barber_id', barber.id);
          if (services && services.length > 0) completedFields++;
        }
        
        const completionPercentage = (completedFields / totalFields) * 100;
        
        logger.debug('Login redirect: Barber completion percentage', { 
          completedFields, 
          totalFields, 
          completionPercentage 
        });

        // Always redirect to onboarding for barbers
        logger.debug('Login redirect: Redirecting to onboarding');
        return '/barber/onboarding'
      } catch (error) {
        logger.error('Error checking barber completion', error)
        return '/barber/onboarding'
      }
    } else if (profile.location) {
      return '/browse'
    } else {
      return '/client/onboarding'
    }
  } catch (error) {
    logger.error('Error determining redirect path', error)
    return '/'
  }
}

export const useAuth = () => {
  const { toast } = useToast()
  const {
    user,
    isLoading,
    status,
    isInitialized,
    login: loginAction,
    register: registerAction,
    logout: logoutAction,
    updateProfile: updateProfileAction,
    addToFavorites: addToFavoritesAction,
    removeFromFavorites: removeFromFavoritesAction,
    initialize
  } = useAuthStore()

  // Initialize auth on mount
  useEffect(() => {
    if (!isInitialized) {
      initialize()
    }
  }, [isInitialized, initialize])

  const login = async (email: string, password: string): Promise<boolean> => {
    try {
      logger.debug('Login hook called', { email })
      const success = await loginAction(email, password)
      
      if (success) {
        logger.debug('Login hook: Success')
        // Don't show toast here, let the page handle it
        return true
      } else {
        logger.debug('Login hook: Failed')
        // Don't show toast here, let the page handle it
        return false
      }
    } catch (error) {
      logger.error('Login hook error', error)
      // Don't show toast here, let the page handle it
      return false
    }
  }

  const loginWithRedirect = async (email: string, password: string): Promise<boolean> => {
    try {
      const success = await loginAction(email, password)
      if (success) {
        // Get the current user from Supabase session
        const { data: { session } } = await supabase.auth.getSession()
        if (session?.user) {
          // Check for stored redirect URL first
          const redirectUrl = sessionStorage.getItem('redirectAfterLogin')
          if (redirectUrl) {
            sessionStorage.removeItem('redirectAfterLogin')
            window.location.href = redirectUrl
            return true
          }

          // Determine redirect path based on user profile
          const redirectPath = await getRedirectPath(session.user.id)
          window.location.href = redirectPath
          return true
        }
      }
      return success
    } catch (error) {
      logger.error('Login with redirect error', error)
      return false
    }
  }

  const register = async (name: string, email: string, password: string, role: "client" | "barber", businessName?: string): Promise<boolean> => {
    try {
      const success = await registerAction(name, email, password, role, businessName)
      if (success) {
        toast({
          title: "Registration successful",
          description: role === 'barber' 
            ? "Welcome to BOCM! Please complete your business profile setup."
            : "Welcome to BOCM!",
        })
      } else {
        toast({
          title: "Registration failed",
          description: "Failed to create account. Please try again.",
          variant: "destructive",
        })
      }
      return success
    } catch (error) {
      toast({
        title: "Registration failed",
        description: error instanceof Error ? error.message : "An unexpected error occurred",
        variant: "destructive",
      })
      return false
    }
  }

  const logout = async () => {
    try {
      await logoutAction()
      toast({
        title: "Logged out",
        description: "You have been successfully logged out",
      })
    } catch (error) {
      toast({
        title: "Logout failed",
        description: "There was an error logging out. Please try again.",
        variant: "destructive",
      })
    }
  }

  const updateProfile = async (data: Partial<import('@/shared/stores/auth-store').User>) => {
    try {
      await updateProfileAction(data)
      toast({
        title: "Profile updated",
        description: "Your changes have been saved successfully",
      })
    } catch (error) {
      toast({
        title: "Profile update failed",
        description: "An unexpected error occurred",
        variant: "destructive",
      })
    }
  }

  const addToFavorites = async (barberId: string) => {
    try {
      await addToFavoritesAction(barberId)
      toast({
        title: "Added to favorites",
        description: "Barber added to your favorites",
      })
    } catch (error) {
      toast({
        title: "Failed to add to favorites",
        description: "An unexpected error occurred",
        variant: "destructive",
      })
    }
  }

  const removeFromFavorites = async (barberId: string) => {
    try {
      await removeFromFavoritesAction(barberId)
      toast({
        title: "Removed from favorites",
        description: "Barber removed from your favorites",
      })
    } catch (error) {
      toast({
        title: "Failed to remove from favorites",
        description: "An unexpected error occurred",
        variant: "destructive",
      })
    }
  }

  return {
    user,
    isLoading,
    status,
    isInitialized,
    login,
    loginWithRedirect,
    register,
    logout,
    updateProfile,
    addToFavorites,
    removeFromFavorites,
    getRedirectPath
  }
}

// Export individual selectors for better performance
export { useUser, useIsAuthenticated, useIsLoading, useAuthStatus, useIsInitialized } 