// DEPRECATED: This file is no longer used. Auth is now managed via Zustand in use-auth-zustand.ts.
// You can safely delete this file.

"use client"

import { createContext, useContext, useEffect, useState } from "react"
import { supabase } from '@/shared/lib/supabase'
import { useToast } from "@/shared/components/ui/use-toast"
import { logger } from '@/shared/lib/logger'

// Types
export type UserRole = "client" | "barber"

export type User = {
  id: string
  name: string
  email: string
  role?: "client" | "barber" // Make role optional to handle OAuth users without roles
  username?: string
  phone?: string
  location?: string
  description?: string
  bio?: string
  favorites?: string[]
  joinDate?: string
  createdAt?: string
  updatedAt?: string
  barberId?: string
  specialties?: string[]
  priceRange?: string
  nextAvailable?: string
}

interface AuthContextType {
  user: User | null
  isLoading: boolean
  status: "loading" | "authenticated" | "unauthenticated"
  login: (email: string, password: string) => Promise<boolean>
  register: (name: string, email: string, password: string, role: UserRole, businessName?: string) => Promise<boolean>
  logout: () => void
  updateProfile: (data: Partial<User>) => void
  addToFavorites: (barberId: string) => void
  removeFromFavorites: (barberId: string) => void
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  isLoading: true,
  status: "loading",
  login: async () => false,
  register: async () => false,
  logout: () => {},
  updateProfile: () => {},
  addToFavorites: () => {},
  removeFromFavorites: () => {},
})

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const { toast } = useToast()

  useEffect(() => {
    let mounted = true

    const fetchUserProfile = async (userId: string) => {
      try {
        let profile = null;
        let profileError = null;
        const maxRetries = 3;
        const retryDelay = 1000; // 1 second

        for (let i = 0; i < maxRetries; i++) {
          const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', userId)
            .single();

          if (data) {
            profile = data;
            break;
          }

          if (error) {
            profileError = error;
            // If it's not a "not found" error, break immediately
            if (error.code !== 'PGRST116') {
              break;
            }
          }

          // Wait before retrying
          if (i < maxRetries - 1) {
            await new Promise(resolve => setTimeout(resolve, retryDelay));
          }
        }

        if (!profile) {
          logger.error('Error fetching user profile', profileError);
          if (mounted) {
            setUser(null);
            setIsLoading(false);
          }
          return;
        }

        if (mounted) {
          setUser({
            id: profile.id,
            name: profile.name,
            email: profile.email,
            role: profile.role || undefined, // Handle null/empty role
            username: profile.username,
            phone: profile.phone,
            location: profile.location,
            description: profile.bio,
            bio: profile.bio,
            favorites: profile.favorites,
            joinDate: profile.join_date,
            createdAt: profile.created_at,
            updatedAt: profile.updated_at
          });
          setIsLoading(false);
        }

        // Ensure barber row exists after confirmation
        if (profile.role === 'barber') {
          const { data: barber, error: barberError } = await supabase
            .from('barbers')
            .select('id')
            .eq('user_id', userId)
            .maybeSingle();
          if (!barber) {
            // Debugging: log current session user id and user_id to insert
            const { data: sessionData } = await supabase.auth.getSession();
            logger.debug('Current session user id', { userId: sessionData?.session?.user?.id });
            logger.debug('user_id to insert', { userId });
            const { error: insertError } = await supabase
              .from('barbers')
              .insert({
                user_id: userId,
                business_name: profile.business_name || '',
                status: 'pending',
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              });
            if (insertError) {
              logger.error('Failed to create barber profile after confirmation', insertError);
              if (mounted) {
                toast({
                  title: "Barber profile creation failed",
                  description: insertError.message,
                  variant: "destructive",
                });
              }
            }
          }
        }
      } catch (error) {
        logger.error('Error in fetchUserProfile', error);
        if (mounted) {
          setUser(null);
          setIsLoading(false);
        }
      }
    };

    const initializeAuth = async () => {
      try {
        // Check current session from Supabase (this handles refresh tokens automatically)
        const { data: { session } } = await supabase.auth.getSession()
        
        if (session?.user) {
          logger.debug('Found existing session for user', { email: session.user.email })
          await fetchUserProfile(session.user.id)
        } else {
          logger.debug('No active session found')
          if (mounted) {
            setUser(null)
            setIsLoading(false)
          }
        }
      } catch (error) {
        logger.error('Auth initialization error', error)
        if (mounted) {
          setUser(null)
          setIsLoading(false)
        }
      }
    }

    initializeAuth()

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return

      logger.debug('Auth state change', { event, email: session?.user?.email })

      if (event === 'SIGNED_IN' && session?.user) {
        logger.debug('User signed in', { email: session.user.email })
        // Don't set loading to true here as it might conflict with login function
        await fetchUserProfile(session.user.id)
      } else if (event === 'SIGNED_OUT') {
        logger.debug('User signed out')
        if (mounted) {
          setUser(null)
          setIsLoading(false)
        }
      } else if (event === 'TOKEN_REFRESHED' && session?.user) {
        logger.debug('Token refreshed for user', { email: session.user.email })
        // Token was refreshed, ensure user is still set
        if (mounted && !user) {
          await fetchUserProfile(session.user.id)
        }
      } else if (event === 'USER_UPDATED' && session?.user) {
        logger.debug('User updated', { email: session.user.email })
        await fetchUserProfile(session.user.id)
      }
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, []) // Empty dependency array since fetchUserProfile is now defined inside

  const login = async (email: string, password: string): Promise<boolean> => {
    try {
      // Set loading state during login
      setIsLoading(true)
      
      // 1. First authenticate the user with rate limiting check
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({ 
        email, 
        password 
      });

      if (authError) {
        logger.error('Auth error', authError);
        
        // Handle specific error cases
        let errorMessage = authError.message;
        if (authError.message.includes('Invalid login credentials')) {
          errorMessage = 'Invalid email or password';
        } else if (authError.message.includes('Email not confirmed')) {
          errorMessage = 'Please verify your email address first';
        } else if (authError.message.includes('Too many requests')) {
          errorMessage = 'Too many login attempts. Please try again later';
        }

        toast({
          title: "Login failed",
          description: errorMessage,
          variant: "destructive",
        });
        return false;
      }

      if (!authData.user) {
        toast({
          title: "Login failed",
          description: "Invalid credentials",
          variant: "destructive",
        });
        return false;
      }

      // 2. Fetch profile with optimized query
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', authData.user.id)
        .maybeSingle();

      if (profileError || !profile) {
        logger.error('Profile fetch error', profileError);
        toast({
          title: "Login failed",
          description: "Failed to load user profile. Please try again.",
          variant: "destructive",
        });
        return false;
      }

      // 3. Set user state
      setUser({
        id: authData.user.id,
        name: profile.name,
        email: profile.email,
        role: profile.role || undefined, // Handle null/empty role
        username: profile.username,
        phone: profile.phone,
        location: profile.location,
        description: profile.bio,
        bio: profile.bio,
        favorites: profile.favorites,
        joinDate: profile.join_date,
        createdAt: profile.created_at,
        updatedAt: profile.updated_at
      });

      logger.debug('Login successful for user', { email: profile.email });
      toast({
        title: "Login successful",
        description: `Welcome back, ${profile.name}!`,
      });

      return true;
    } catch (error) {
      logger.error('Login process failed', error);
      toast({
        title: "Login failed",
        description: error instanceof Error ? error.message : "An unexpected error occurred",
        variant: "destructive",
      });
      return false;
    } finally {
      // Always ensure loading is set to false
      setIsLoading(false);
    }
  };

  const register = async (name: string, email: string, password: string, role: UserRole, businessName?: string): Promise<boolean> => {
    try {
      logger.debug('Registration Process Started', { name, email, role, hasBusinessName: !!businessName });
      
      // Create auth user with role in metadata
      logger.debug('Creating auth user');
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            name,
            role,
            business_name: businessName,
          }
        },
      });

      if (authError) {
        logger.error('Auth Error', authError);
        toast({
          title: "Registration failed",
          description: authError.message,
          variant: "destructive",
        });
        return false;
      }

      logger.debug('Auth Data', { userId: authData.user?.id, hasUser: !!authData.user });

      if (authData.user) {
        // Check if email confirmation is required
        if (authData.user.identities?.length === 0) {
          logger.debug('Email confirmation required');
          toast({
            title: "Check your email to confirm your account",
            description: "We've sent you a confirmation email. Please verify your email address to complete registration. You won't be able to log in until you confirm.",
            variant: "default",
          });
          return true;
        }

        // Try to fetch the profile with retries
        let profile = null;
        let profileError = null;
        let retries = 3;
        
        while (retries > 0) {
          logger.debug(`Fetching profile - Attempt ${4 - retries}/3`);
          const result = await supabase
            .from('profiles')
            .select('*')
            .eq('id', authData.user.id)
            .maybeSingle();
            
          if (result.data) {
            profile = result.data;
            logger.debug('Profile fetched successfully', { userId: profile.id });
            break;
          }
          
          profileError = result.error;
          logger.warn('Profile fetch attempt failed', profileError);
          retries--;
          if (retries > 0) {
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        }

        if (profileError || !profile) {
          logger.error('Profile Creation Failed', profileError);
          toast({
            title: "Registration failed",
            description: "Failed to create user profile. Please try again.",
            variant: "destructive",
          });
          return false;
        }

        // For barbers, create a business profile
        if (role === 'barber' && businessName) {
          logger.debug('Creating business profile');
          const { error: businessError } = await supabase
            .from('barbers')
            .insert({
              id: authData.user.id,
              user_id: authData.user.id,
              business_name: businessName,
              status: 'pending',
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            });

          if (businessError) {
            logger.error('Business Profile Creation Failed', businessError);
            toast({
              title: "Registration warning",
              description: "Account created but business profile setup failed. Please complete setup in your profile.",
              variant: "destructive",
            });
          } else {
            logger.debug('Business profile created successfully');
          }
        }

        // Set user state
        logger.debug('Setting user state');
        setUser({
          id: authData.user.id,
          name: profile.name,
          email: profile.email,
          role: profile.role || undefined, // Handle null/empty role
          username: profile.username,
          phone: profile.phone,
          location: profile.location,
          description: profile.bio,
          bio: profile.bio,
          favorites: profile.favorites,
          joinDate: profile.join_date,
          createdAt: profile.created_at,
          updatedAt: profile.updated_at
        });

        logger.debug('Registration completed successfully');
        toast({
          title: "Registration successful",
          description: role === 'barber' 
            ? "Welcome to BOCM! Please complete your business profile setup."
            : "Welcome to BOCM!",
        });

        // Redirect barbers to onboarding page
        if (role === 'barber') {
          logger.debug('Redirecting to onboarding page');
          window.location.href = '/barber/onboarding';
        }

        return true;
      }

      return false;
    } catch (error) {
      logger.error('Registration Process Failed', error);
      toast({
        title: "Registration failed",
        description: error instanceof Error ? error.message : "An unexpected error occurred",
        variant: "destructive",
      });
      return false;
    }
  };

  const logout = async () => {
    try {
      // Sign out from Supabase
      await supabase.auth.signOut();
      
      // Reset user state
      setUser(null);
      
      toast({
        title: "Logged out",
        description: "You have been successfully logged out",
      });
    } catch (error) {
      logger.error('Logout error', error);
      toast({
        title: "Logout failed",
        description: "There was an error logging out. Please try again.",
        variant: "destructive",
      });
    }
  };

  const updateProfile = async (data: Partial<User>) => {
    if (!user) return;

    try {
      // Update profile data
      const profileData = {
        name: data.name,
        email: data.email,
        phone: data.phone,
        location: data.location,
        description: data.description,
        bio: data.bio,
        favorites: data.favorites,
        updated_at: new Date().toISOString(),
      };

      const { error: profileError } = await supabase
        .from('profiles')
        .update(profileData)
        .eq('id', user.id);

      if (profileError) throw profileError;

      // Update user state
      setUser(prev => prev ? { ...prev, ...data } : null);

      toast({
        title: "Profile updated",
        description: "Your changes have been saved successfully",
      });
    } catch (error) {
      logger.error('Profile update error', error);
      toast({
        title: "Profile update failed",
        description: "An unexpected error occurred",
        variant: "destructive",
      });
    }
  };

  const addToFavorites = async (barberId: string) => {
    if (!user) return;

    try {
      const favorites = user.favorites || [];
      if (!favorites.includes(barberId)) {
        const updatedFavorites = [...favorites, barberId];
        await updateProfile({ favorites: updatedFavorites });
      }
    } catch (error) {
      logger.error('Add to favorites error', error);
      toast({
        title: "Failed to add to favorites",
        description: "An unexpected error occurred",
        variant: "destructive",
      });
    }
  };

  const removeFromFavorites = async (barberId: string) => {
    if (!user || !user.favorites) return;

    try {
      const updatedFavorites = user.favorites.filter((id) => id !== barberId);
      await updateProfile({ favorites: updatedFavorites });
    } catch (error) {
      logger.error('Remove from favorites error', error);
      toast({
        title: "Failed to remove from favorites",
        description: "An unexpected error occurred",
        variant: "destructive",
      });
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        status: isLoading ? "loading" : user ? "authenticated" : "unauthenticated",
        login,
        register,
        logout,
        updateProfile,
        addToFavorites,
        removeFromFavorites,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}
