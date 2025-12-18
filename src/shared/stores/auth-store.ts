import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'
import { supabase } from '@/shared/lib/supabase'
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
  avatar_url?: string
}

interface AuthState {
  user: User | null
  isLoading: boolean
  status: "loading" | "authenticated" | "unauthenticated"
  isInitialized: boolean
  showLoginModal: boolean
}

interface AuthActions {
  // Actions
  login: (email: string, password: string) => Promise<boolean>
  register: (name: string, email: string, password: string, role: UserRole, businessName?: string) => Promise<boolean>
  logout: () => Promise<void>
  updateProfile: (data: Partial<User>) => Promise<void>
  addToFavorites: (barberId: string) => Promise<void>
  removeFromFavorites: (barberId: string) => Promise<void>
  
  // Internal state setters
  setUser: (user: User | null) => void
  setLoading: (loading: boolean) => void
  setStatus: (status: "loading" | "authenticated" | "unauthenticated") => void
  setInitialized: (initialized: boolean) => void
  setShowLoginModal: (show: boolean) => void
  
  // Initialize auth state
  initialize: () => Promise<void>
  fetchUserProfile: (userId: string) => Promise<void>
}

type AuthStore = AuthState & AuthActions

export const useAuthStore = create<AuthStore>()(
  subscribeWithSelector((set, get) => ({
    // Initial state
    user: null,
    isLoading: true,
    status: "loading",
    isInitialized: false,
    showLoginModal: false,

    // State setters
    setUser: (user) => set({ user }),
    setLoading: (loading) => set({ isLoading: loading }),
    setStatus: (status) => set({ status }),
    setInitialized: (initialized) => set({ isInitialized: initialized }),
    setShowLoginModal: (show) => set({ showLoginModal: show }),

    // Initialize auth state
    initialize: async () => {
      try {
        logger.debug('[AUTH] initialize: starting')
        set({ isLoading: true, status: "loading" })
        
        // Check current session from Supabase
        const { data: { session } } = await supabase.auth.getSession()
        logger.debug('[AUTH] initialize: session', { hasSession: !!session, userEmail: session?.user?.email })
        
        if (session?.user) {
          logger.debug('[AUTH] initialize: found session for user', { email: session.user.email })
          await get().fetchUserProfile(session.user.id)
        } else {
          logger.debug('[AUTH] initialize: no active session found')
          set({ 
            user: null, 
            isLoading: false, 
            status: "unauthenticated",
            isInitialized: true 
          })
        }

        // Listen for auth state changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
          logger.debug('[AUTH] onAuthStateChange', { event, userEmail: session?.user?.email })

          if (event === 'SIGNED_IN' && session?.user) {
            logger.debug('[AUTH] onAuthStateChange: user signed in', { email: session.user.email })
            await get().fetchUserProfile(session.user.id)
          } else if (event === 'SIGNED_OUT') {
            logger.debug('[AUTH] onAuthStateChange: user signed out')
            set({ 
              user: null, 
              isLoading: false, 
              status: "unauthenticated" 
            })
          } else if (event === 'TOKEN_REFRESHED' && session?.user) {
            logger.debug('[AUTH] onAuthStateChange: token refreshed for user', { email: session.user.email })
            if (!get().user) {
              await get().fetchUserProfile(session.user.id)
            }
          } else if (event === 'USER_UPDATED' && session?.user) {
            logger.debug('[AUTH] onAuthStateChange: user updated', { email: session.user.email })
            await get().fetchUserProfile(session.user.id)
          }
        })

        // Note: Supabase handles subscription cleanup automatically
        logger.debug('[AUTH] initialize: complete')
        
      } catch (error) {
        logger.error('[AUTH] initialize: error', error)
        set({ 
          user: null, 
          isLoading: false, 
          status: "unauthenticated",
          isInitialized: true 
        })
      }
    },

    // Fetch user profile
    fetchUserProfile: async (userId: string) => {
      try {
        logger.debug('[AUTH] fetchUserProfile: start', { userId })
        let profile = null;
        let profileError = null;
        const maxRetries = 3;
        const retryDelay = 1000;

        for (let i = 0; i < maxRetries; i++) {
          const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', userId)
            .single();

          logger.debug(`[AUTH] fetchUserProfile: attempt ${i+1}`, { hasData: !!data, error: error?.message })

          if (data) {
            profile = data;
            break;
          }

          if (error) {
            profileError = error;
            if (error.code !== 'PGRST116') {
              break;
            }
          }

          if (i < maxRetries - 1) {
            logger.debug(`[AUTH] fetchUserProfile: retrying in ${retryDelay}ms`)
            await new Promise(resolve => setTimeout(resolve, retryDelay));
          }
        }

        if (!profile) {
          logger.error('[AUTH] fetchUserProfile: failed after retries', profileError)
          set({ 
            user: null, 
            isLoading: false, 
            status: "unauthenticated" 
          });
          return;
        }

        const user: User = {
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
          updatedAt: profile.updated_at,
          avatar_url: profile.avatar_url
        };

        set({ 
          user, 
          isLoading: false, 
          status: "authenticated",
          isInitialized: true 
        });
        logger.debug('[AUTH] fetchUserProfile: success', { userId: user.id, email: user.email, role: user.role })

        // Ensure barber row exists after confirmation
        if (profile.role === 'barber') {
          const { data: barber, error: barberError } = await supabase
            .from('barbers')
            .select('id')
            .eq('user_id', userId)
            .maybeSingle();
          if (!barber) {
            const { data: sessionData } = await supabase.auth.getSession();
            logger.debug('Creating barber profile', { sessionUserId: sessionData?.session?.user?.id, userId })
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
              logger.error('Failed to create barber profile after confirmation', insertError)
            }
          }
        }
      } catch (error) {
        logger.error('Error in fetchUserProfile', error)
        set({ 
          user: null, 
          isLoading: false, 
          status: "unauthenticated" 
        });
      }
    },

    // Login
    login: async (email: string, password: string): Promise<boolean> => {
      try {
        set({ isLoading: true, status: "loading" })
        logger.debug('Starting login process', { email })
        
        // Step 1: Authenticate with Supabase
        const { data: authData, error: authError } = await supabase.auth.signInWithPassword({ 
          email, 
          password 
        });

        if (authError) {
          logger.error('Auth error', authError)
          set({ isLoading: false, status: "unauthenticated" })
          return false;
        }

        if (!authData.user) {
          logger.error('No user data returned from auth')
          set({ isLoading: false, status: "unauthenticated" })
          return false;
        }

        logger.debug('Authentication successful', { userId: authData.user.id })

        // Step 2: Fetch profile with retry mechanism
        let profile = null;
        let profileError = null;
        let retries = 3;
        
        while (retries > 0) {
          logger.debug(`Fetching profile - Attempt ${4 - retries}/3`)
          const result = await supabase
            .from('profiles')
            .select('*')
            .eq('id', authData.user.id)
            .maybeSingle();
            
          if (result.data) {
            profile = result.data;
            logger.debug('Profile fetched successfully', { userId: profile.id })
            break;
          }
          
          profileError = result.error;
          logger.debug('Profile fetch attempt failed', { error: profileError?.message })
          retries--;
          if (retries > 0) {
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        }

        if (profileError || !profile) {
          logger.error('Profile fetch error after all retries', profileError)
          set({ isLoading: false, status: "unauthenticated" })
          return false;
        }

        // Step 3: Check if profile is complete
        if (!profile.role || !profile.username) {
          logger.debug('Profile incomplete, user needs to complete registration')
          set({ isLoading: false, status: "unauthenticated" })
          return false;
        }

        // Step 4: Ensure barber row exists if user is a barber
        if (profile.role === 'barber') {
          logger.debug('Checking for barber row')
          const { data: existingBarber, error: barberCheckError } = await supabase
            .from('barbers')
            .select('id')
            .eq('user_id', authData.user.id)
            .maybeSingle();

          if (barberCheckError) {
            logger.error('Error checking barber row', barberCheckError)
            // Continue anyway, don't fail login for this
          }

          if (!existingBarber) {
            logger.debug('Creating barber row')
            const { error: insertError } = await supabase
              .from('barbers')
              .insert({
                user_id: authData.user.id,
                business_name: profile.business_name || '',
                status: 'pending',
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              });

            if (insertError) {
              logger.error('Failed to create barber row', insertError)
              // Continue anyway, don't fail login for this
            } else {
              logger.debug('Barber row created successfully')
            }
          } else {
            logger.debug('Barber row already exists')
          }
        }

        // Step 5: Set user state
        const user: User = {
          id: authData.user.id,
          name: profile.name,
          email: profile.email,
          role: profile.role || undefined,
          username: profile.username,
          phone: profile.phone,
          location: profile.location,
          description: profile.bio,
          bio: profile.bio,
          favorites: profile.favorites,
          joinDate: profile.join_date,
          createdAt: profile.created_at,
          updatedAt: profile.updated_at,
          avatar_url: profile.avatar_url
        };

        set({ 
          user, 
          isLoading: false, 
          status: "authenticated",
          isInitialized: true
        });

        logger.debug('Login successful', { email: profile.email })
        return true;
      } catch (error) {
        logger.error('Login process failed', error)
        set({ isLoading: false, status: "unauthenticated" })
        return false;
      }
    },

    // Register
    register: async (name: string, email: string, password: string, role: UserRole, businessName?: string): Promise<boolean> => {
      try {
        logger.debug('Registration Process Started', { name, email, role, businessName })
        
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
        logger.debug('Raw signUp response', { hasUser: !!authData.user, hasError: !!authError })

        if (authError) {
          logger.error('Auth Error', authError)
          return false;
        }

        logger.debug('Auth Data', { userId: authData.user?.id })

        if (authData.user) {
          logger.debug('authData.user exists', { userId: authData.user.id })
          if (authData.user.identities?.length === 0) {
            logger.debug('Email confirmation required')
            return true;
          }

          // Try to fetch the profile with retries
          let profile = null;
          let profileError = null;
          let retries = 3;
          
          while (retries > 0) {
            logger.debug(`Fetching profile - Attempt ${4 - retries}/3`)
            const result = await supabase
              .from('profiles')
              .select('*')
              .eq('id', authData.user.id)
              .single();
              
            if (result.data) {
              profile = result.data;
              logger.debug('Profile fetched successfully', { userId: profile.id })
              break;
            }
            
            profileError = result.error;
            logger.debug('Profile fetch attempt failed', { error: profileError?.message })
            retries--;
            if (retries > 0) {
              await new Promise(resolve => setTimeout(resolve, 1000));
            }
          }

          logger.debug('Profile after fetch loop', { hasProfile: !!profile, hasError: !!profileError })

          if (profileError || !profile) {
            logger.error('Profile Creation Failed', profileError)
            return false;
          }

          // For barbers, create a business profile
          if (role === 'barber' && businessName) {
            logger.debug('Creating business profile')
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
              logger.error('Business Profile Creation Failed', businessError)
            } else {
              logger.debug('Business profile created successfully')
            }
          }

          const user: User = {
            id: authData.user.id,
            name: profile.name,
            email: profile.email,
            role: profile.role,
            username: profile.username,
            phone: profile.phone,
            location: profile.location,
            description: profile.bio,
            bio: profile.bio,
            favorites: profile.favorites,
            joinDate: profile.join_date,
            createdAt: profile.created_at,
            updatedAt: profile.updated_at
          };

          set({ 
            user, 
            isLoading: false, 
            status: "authenticated" 
          });

          logger.debug('Registration completed successfully')
          return true;
        }

        logger.debug('No authData.user, returning false')
        return false;
      } catch (error) {
        logger.error('Registration Process Failed', error)
        return false;
      }
    },

    // Logout
    logout: async () => {
      try {
        await supabase.auth.signOut();
        set({ 
          user: null, 
          isLoading: false, 
          status: "unauthenticated" 
        });
      } catch (error) {
        logger.error('Logout error', error)
      }
    },

    // Update profile
    updateProfile: async (data: Partial<User>) => {
      const { user } = get();
      if (!user) return;

      try {
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

        set({ user: { ...user, ...data } });
      } catch (error) {
        logger.error('Profile update error', error)
        throw error;
      }
    },

    // Add to favorites
    addToFavorites: async (barberId: string) => {
      const { user, updateProfile } = get();
      if (!user) return;

      try {
        const favorites = user.favorites || [];
        if (!favorites.includes(barberId)) {
          const updatedFavorites = [...favorites, barberId];
          await updateProfile({ favorites: updatedFavorites });
        }
      } catch (error) {
        logger.error('Add to favorites error', error)
        throw error;
      }
    },

    // Remove from favorites
    removeFromFavorites: async (barberId: string) => {
      const { user, updateProfile } = get();
      if (!user || !user.favorites) return;

      try {
        const updatedFavorites = user.favorites.filter((id) => id !== barberId);
        await updateProfile({ favorites: updatedFavorites });
      } catch (error) {
        logger.error('Remove from favorites error', error)
        throw error;
      }
    },
  }))
)

// Selectors for better performance
export const useUser = () => useAuthStore((state) => state.user)
export const useIsAuthenticated = () => useAuthStore((state) => state.status === "authenticated")
export const useIsLoading = () => useAuthStore((state) => state.isLoading)
export const useAuthStatus = () => useAuthStore((state) => state.status)
export const useIsInitialized = () => useAuthStore((state) => state.isInitialized) 
export const useShowLoginModal = () => useAuthStore((state) => state.showLoginModal) 