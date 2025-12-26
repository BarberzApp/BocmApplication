import { useState, useEffect } from 'react';
import { useAuth } from './use-auth-zustand';
import { supabase } from '@/shared/lib/supabase';
import { logger } from '@/shared/lib/logger';

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'super_admin';
  avatar_url?: string;
}

export function useAdminAuth() {
  const { user } = useAuth();
  const [adminUser, setAdminUser] = useState<AdminUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);

  useEffect(() => {
    checkAdminStatus();
  }, [user]);

  const checkAdminStatus = async () => {
    if (!user) {
      setAdminUser(null);
      setIsAdmin(false);
      setIsSuperAdmin(false);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      // Check if user has admin role in profiles
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('id, name, email, role, avatar_url')
        .eq('id', user.id)
        .eq('role', 'admin')
        .single();

      if (profileData) {
        setAdminUser({
          id: profileData.id,
          name: profileData.name,
          email: profileData.email,
          role: 'admin',
          avatar_url: profileData.avatar_url
        });
        setIsAdmin(true);
        setIsSuperAdmin(false);
        setLoading(false);
        return;
      }

      // Check if user is super admin (check barbers table for is_developer)
      const { data: barberData, error: barberError } = await supabase
        .from('barbers')
        .select('id, user_id, is_developer')
        .eq('user_id', user.id)
        .eq('is_developer', true)
        .single();

      if (barberData) {
        // Get profile data for super admin
        const { data: superAdminProfile, error: superAdminError } = await supabase
          .from('profiles')
          .select('id, name, email, avatar_url')
          .eq('id', user.id)
          .single();

        if (superAdminProfile) {
          setAdminUser({
            id: superAdminProfile.id,
            name: superAdminProfile.name,
            email: superAdminProfile.email,
            role: 'super_admin',
            avatar_url: superAdminProfile.avatar_url
          });
          setIsAdmin(true);
          setIsSuperAdmin(true);
          setLoading(false);
          return;
        }
      }

      // User is not an admin
      setAdminUser(null);
      setIsAdmin(false);
      setIsSuperAdmin(false);
    } catch (error) {
      logger.error('Error checking admin status', error);
      setAdminUser(null);
      setIsAdmin(false);
      setIsSuperAdmin(false);
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    try {
      await supabase.auth.signOut();
      setAdminUser(null);
      setIsAdmin(false);
      setIsSuperAdmin(false);
    } catch (error) {
      logger.error('Error logging out', error);
    }
  };

  return {
    adminUser,
    isAdmin,
    isSuperAdmin,
    loading,
    logout,
    checkAdminStatus
  };
} 