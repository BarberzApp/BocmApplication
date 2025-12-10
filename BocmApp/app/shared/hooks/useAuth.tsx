// hooks/useAuth.ts
import { useState, useEffect, createContext, useContext, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';
import { User } from '@supabase/supabase-js';
import { logger } from '../lib/logger';
import { withTimeout } from '../lib/errorRecovery';
import { Alert } from 'react-native';

// Types
export type UserRole = 'client' | 'barber';

export type UserProfile = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  phone?: string;
  location?: string;
  bio?: string;
  favorites?: string[];
  join_date?: string;
  created_at?: string;
  updated_at?: string;
  username?: string;
  business_name?: string;
};

interface AuthContextType {
  user: User | null;
  userProfile: UserProfile | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  register: (name: string, email: string, password: string, role: UserRole, businessName?: string) => Promise<boolean | 'needs-confirmation' | 'already-exists'>;
  logout: () => Promise<void>;
  updateProfile: (data: Partial<UserProfile>) => Promise<void>;
  addToFavorites: (barberId: string) => Promise<void>;
  removeFromFavorites: (barberId: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }): React.ReactElement {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check if user is logged in
    checkUser();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setUser(session?.user ?? null);
      
      if (session?.user) {
        await fetchUserProfile(session.user.id);
        await AsyncStorage.setItem('user', JSON.stringify(session.user));
      } else {
        setUserProfile(null);
        await AsyncStorage.removeItem('user');
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const checkUser = async () => {
    try {
      logger.log('🔍 Checking user session...');
      
      // Add 10-second timeout to session check
      const sessionPromise = supabase.auth.getSession();
      
      const { data: { session } } = await withTimeout(sessionPromise, {
        timeout: 10000, // 10 seconds
        timeoutMessage: 'Session check timed out',
      });
      
      setUser(session?.user ?? null);
      
      if (session?.user) {
        logger.log('✅ Session found, fetching profile...');
        await fetchUserProfile(session.user.id);
      } else {
        logger.log('❌ No active session found');
      }
    } catch (error: any) {
      logger.error('Error checking user session:', error);
      
      // Check if it's a timeout error
      if (error.message?.includes('timed out') || error.message?.includes('timeout')) {
        logger.warn('⏱️ Session check timed out after 10 seconds');
        
        // Clear user state FIRST (so app redirects to login)
        setUser(null);
        setUserProfile(null);
        
        // Clear stale data from storage
        AsyncStorage.removeItem('user').catch(e => 
          logger.error('Failed to clear storage:', e)
        );
        
        // Show toast notification AFTER clearing state
        // This prevents any retry attempts
        setTimeout(() => {
          Alert.alert(
            'Session Not Found',
            'Unable to verify your session. Please log in again.',
            [{ text: 'OK' }]
          );
        }, 100); // Small delay to ensure state is cleared first
      } else {
        // For other errors, just clear the state
        setUser(null);
        setUserProfile(null);
      }
    } finally {
      // ALWAYS set loading to false, even on timeout
      // This allows the app to show login screen immediately
      setLoading(false);
    }
  };

  const fetchUserProfile = async (userId: string) => {
    try {
      logger.log('📋 Fetching profile for user:', userId);
      let profile = null;
      let profileError = null;
      const maxRetries = 3;
      const retryDelay = 1000; // 1 second

      for (let i = 0; i < maxRetries; i++) {
        logger.log(`📋 Fetching profile - Attempt ${i + 1}/${maxRetries}...`);
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', userId)
          .maybeSingle(); // Use maybeSingle() instead of single() to handle no rows

        if (data) {
          profile = data;
          logger.log('✅ Profile fetched successfully');
          break;
        }

        if (error && error.code !== 'PGRST116') {
          // If it's not a "not found" error, break immediately
          profileError = error;
          logger.error('❌ Profile fetch error:', error);
          break;
        }

        // Wait before retrying only if we haven't found the profile yet
        if (i < maxRetries - 1 && !data) {
          await new Promise(resolve => setTimeout(resolve, retryDelay));
        }
      }

      if (!profile) {
        // Don't log as error if profile doesn't exist yet (user might not be confirmed)
        logger.log('❌ Profile not found for user:', userId);
        setUserProfile(null);
        return;
      }

      // Check if profile is complete
      if (!profile.role || !profile.username) {
        logger.log('⚠️ Profile incomplete, needs completion');
      }

      setUserProfile({
        id: userId,
        name: profile.name,
        email: profile.email,
        role: profile.role,
        phone: profile.phone,
        location: profile.location,
        bio: profile.bio,
        favorites: profile.favorites,
        join_date: profile.join_date,
        created_at: profile.created_at,
        updated_at: profile.updated_at,
        username: profile.username,
        business_name: profile.business_name,
      });

      // Ensure barber row exists after confirmation
      if (profile.role === 'barber') {
        logger.log('💈 Checking for barber row...');
        const { data: barber } = await supabase
          .from('barbers')
          .select('id')
          .eq('user_id', userId)
          .maybeSingle(); // Use maybeSingle() here too
          
        if (!barber) {
          logger.log('💈 Creating barber row...');
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
            logger.error('❌ Failed to create barber profile after confirmation:', insertError);
          } else {
            logger.log('✅ Barber row created successfully');
          }
        } else {
          logger.log('✅ Barber row already exists');
        }
      }
    } catch (error) {
      logger.error('❌ Error in fetchUserProfile:', error);
      setUserProfile(null);
    }
  };

  const login = async (email: string, password: string): Promise<boolean> => {
    try {
      logger.log('🔐 Starting login process for:', email);
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) {
        logger.error('❌ Login error:', authError);
        return false;
      }

      if (!authData.user) {
        logger.error('❌ No user data returned');
        return false;
      }

      logger.log('✅ Authentication successful for user:', authData.user.id);

      // Fetch profile with optimized query and retry
      let profile = null;
      let retries = 3;
      
      while (retries > 0) {
        logger.log(`📋 Fetching profile - Attempt ${4 - retries}/3...`);
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', authData.user.id)
          .maybeSingle();
        
        if (data) {
          profile = data;
          logger.log('✅ Profile fetched successfully');
          break;
        }
        
        logger.log('❌ Profile fetch attempt failed:', error);
        retries--;
        if (retries > 0) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      if (!profile) {
        logger.error('❌ Could not fetch profile after retries');
        return false;
      }

      // Check if profile is complete
      if (!profile.role || !profile.username) {
        logger.log('⚠️ Profile incomplete, user needs to complete registration');
        // Still set the user state but return false to trigger redirect
        setUser(authData.user);
        await AsyncStorage.setItem('user', JSON.stringify(authData.user));
        return false;
      }

      // Ensure barber row exists for barber users
      if (profile.role === 'barber') {
        logger.log('💈 Checking for barber row...');
        const { data: existingBarber } = await supabase
          .from('barbers')
          .select('id')
          .eq('user_id', authData.user.id)
          .maybeSingle();

        if (!existingBarber) {
          logger.log('💈 Creating barber row...');
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
            logger.error('❌ Failed to create barber row:', insertError);
          } else {
            logger.log('✅ Barber row created successfully');
          }
        }
      }

      setUser(authData.user);
      setUserProfile({
        id: authData.user.id,
        name: profile.name,
        email: profile.email,
        role: profile.role,
        phone: profile.phone,
        location: profile.location,
        bio: profile.bio,
        favorites: profile.favorites,
        join_date: profile.join_date,
        created_at: profile.created_at,
        updated_at: profile.updated_at,
        username: profile.username,
        business_name: profile.business_name,
      });

      await AsyncStorage.setItem('user', JSON.stringify(authData.user));
      logger.log('✅ Login successful for user:', profile.email);
      
      return true;
    } catch (error) {
      logger.error('❌ Login error:', error);
      return false;
    }
  };

  const register = async (
    name: string, 
    email: string, 
    password: string, 
    role: UserRole,
    businessName?: string
  ): Promise<boolean | 'needs-confirmation' | 'already-exists'> => {
    try {
      logger.log('=== Registration Process Started ===');
      logger.log('Registration Data:', { name, email, role, businessName });
      
      // Create auth user with role in metadata
      logger.log('Creating auth user...');
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            name,
            role,
            business_name: businessName,
          },
        },
      });

      if (authError) {
        logger.error('Auth Error:', authError);
        
        // Check for user already registered error
        if (authError.message?.includes('User already registered') || 
            authError.status === 400) {
          // Try to check if user exists but needs confirmation
          logger.log('User may already exist, checking confirmation status...');
          
          // Return needs-confirmation since the user exists but may not be confirmed
          return 'already-exists';
        }
        
        return false;
      }

      logger.log('Auth Data:', authData);

      // Check if this is a repeated signup (user already exists)
      if (!authError && authData.user && authData.user.identities?.length === 0) {
        // For repeated signups, check if user exists in profiles
        const { data: existingProfile } = await supabase
          .from('profiles')
          .select('*')
          .eq('email', email)
          .single();

        if (existingProfile) {
          logger.log('User already exists with this email');
          return 'already-exists';
        } else {
          logger.log('Email confirmation required for new user');
          return 'needs-confirmation';
        }
      }

      if (!authData.user) {
        logger.error('No user returned from signup');
        return false;
      }

      // Check if email confirmation is required
      if (!authData.session) {
        logger.log('Email confirmation required');
        return 'needs-confirmation';
      }

      // Try to fetch the profile with retries
      let profile = null;
      let profileError = null;
      let retries = 3;
      
      while (retries > 0) {
        logger.log(`Fetching profile - Attempt ${4 - retries}/3...`);
        const result = await supabase
          .from('profiles')
          .select('*')
          .eq('id', authData.user.id)
          .single();
          
        if (result.data) {
          profile = result.data;
          logger.log('Profile fetched successfully:', profile);
          break;
        }
        
        profileError = result.error;
        logger.log('Profile fetch attempt failed:', profileError);
        retries--;
        if (retries > 0) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      if (profileError || !profile) {
        logger.error('Profile Creation Failed:', profileError);
        // If profile doesn't exist, it might not be auto-created, so create it manually
        const { error: createProfileError } = await supabase
          .from('profiles')
          .insert({
            id: authData.user.id,
            email: authData.user.email,
            name,
            role,
            username: email.split('@')[0], // Generate username from email
            business_name: businessName,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });

        if (createProfileError) {
          logger.error('Manual profile creation failed:', createProfileError);
          return false;
        }

        // Try to fetch the newly created profile
        const { data: newProfile, error: newProfileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', authData.user.id)
          .single();

        if (newProfileError || !newProfile) {
          logger.error('Failed to fetch newly created profile:', newProfileError);
          return false;
        }

        profile = newProfile;
      }

      // For barbers, create a business profile
      if (role === 'barber' && businessName) {
        logger.log('Creating business profile...');
        const { error: businessError } = await supabase
          .from('barbers')
          .insert({
            user_id: authData.user.id,
            business_name: businessName,
            status: 'pending',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });

        if (businessError) {
          logger.error('Business Profile Creation Failed:', businessError);
          // Don't fail the registration, just log the error
        } else {
          logger.log('Business profile created successfully');
        }
      }

      // Set user state
      logger.log('Setting user state...');
      setUser(authData.user);
      setUserProfile({
        id: authData.user.id,
        name: profile.name,
        email: profile.email,
        role: profile.role,
        phone: profile.phone,
        location: profile.location,
        bio: profile.bio,
        favorites: profile.favorites,
        join_date: profile.join_date,
        created_at: profile.created_at,
        updated_at: profile.updated_at,
        username: profile.username,
        business_name: profile.business_name,
      });

      await AsyncStorage.setItem('user', JSON.stringify(authData.user));
      logger.log('Registration completed successfully');

      return true;
    } catch (error) {
      logger.error('Registration Process Failed:', error);
      return false;
    }
  };

  const logout = async () => {
    try {
      await supabase.auth.signOut();
      setUser(null);
      setUserProfile(null);
      await AsyncStorage.removeItem('user');
    } catch (error) {
      logger.error('Logout error:', error);
    }
  };

  const updateProfile = async (data: Partial<UserProfile>) => {
    if (!user || !userProfile) return;

    try {
      // Update profile data
      const profileData = {
        name: data.name,
        email: data.email,
        phone: data.phone,
        location: data.location,
        bio: data.bio,
        favorites: data.favorites,
        updated_at: new Date().toISOString(),
      };

      const { error: profileError } = await supabase
        .from('profiles')
        .update(profileData)
        .eq('id', user.id);

      if (profileError) throw profileError;

      // Update local state
      setUserProfile(prev => prev ? { ...prev, ...data } : null);

      logger.log('Profile updated successfully');
    } catch (error) {
      logger.error('Profile update error:', error);
      throw error;
    }
  };

  const addToFavorites = async (barberId: string) => {
    if (!userProfile) return;

    try {
      const favorites = userProfile.favorites || [];
      if (!favorites.includes(barberId)) {
        const updatedFavorites = [...favorites, barberId];
        await updateProfile({ favorites: updatedFavorites });
      }
    } catch (error) {
      logger.error('Add to favorites error:', error);
      throw error;
    }
  };

  const removeFromFavorites = async (barberId: string) => {
    if (!userProfile || !userProfile.favorites) return;

    try {
      const updatedFavorites = userProfile.favorites.filter((id) => id !== barberId);
      await updateProfile({ favorites: updatedFavorites });
    } catch (error) {
      logger.error('Remove from favorites error:', error);
      throw error;
    }
  };

  return (
    <AuthContext.Provider 
      value={{ 
        user, 
        userProfile,
        loading, 
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
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}