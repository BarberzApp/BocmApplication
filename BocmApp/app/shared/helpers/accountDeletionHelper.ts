import { useCallback, useMemo, useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '../lib/supabase';
import { useToast } from '../components/ui/use-toast';
import { useAuth } from '../hooks/useAuth';

interface AccountDeletionHelperOptions {
  barberId?: string;
}

/**
 * Encapsulates account deletion flow so the page stays small.
 * Flow:
 * 1) requestDelete -> shows warning toast and reveals confirmation input.
 * 2) user types "YES" (all caps) -> deleteAccount executes destructive cleanup.
 */
export const useAccountDeletionHelper = ({ barberId }: AccountDeletionHelperOptions = {}) => {
  const navigation = useNavigation();
  const { user, logout } = useAuth();
  const { toast } = useToast();

  const [isConfirming, setIsConfirming] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [confirmText, setConfirmText] = useState('');

  const isConfirmed = useMemo(() => confirmText.trim() === 'YES', [confirmText]);

  const requestDelete = useCallback(() => {
    toast({
      title: 'Delete account?',
      description: 'Type YES (all caps) below to confirm. This cannot be undone.',
      variant: 'warning',
      duration: 5000,
    });
    setIsConfirming(true);
  }, [toast]);

  const deleteAccount = useCallback(async () => {
    if (!user) {
      toast({
        title: 'Not signed in',
        description: 'Please log in again before deleting your account.',
        variant: 'warning',
      });
      return;
    }

    if (!isConfirmed) {
      toast({
        title: 'Confirmation required',
        description: 'Please type YES in all caps to proceed.',
        variant: 'warning',
      });
      return;
    }

    setIsDeleting(true);

    try {
      // Clean up barber-owned data first (if applicable)
      if (barberId) {
        await supabase.from('services').delete().eq('barber_id', barberId);
        await supabase.from('availability').delete().eq('barber_id', barberId);
        await supabase.from('addons').delete().eq('barber_id', barberId);
        await supabase.from('barbers').delete().eq('id', barberId);
        await supabase.from('bookings').delete().eq('barber_id', barberId);
      }

      // Remove client-side bookings and profile
      await supabase.from('bookings').delete().eq('client_id', user.id);
      await supabase.from('profiles').delete().eq('id', user.id);

      // Sign out locally
      await logout();

      toast({
        title: 'Account deleted',
        description: 'Your account and data have been removed.',
        variant: 'success',
      });

      navigation.reset({
        index: 0,
        routes: [{ name: 'Login' as never }],
      });
    } catch (error: any) {
      toast({
        title: 'Delete failed',
        description: error?.message ?? 'Could not delete your account.',
        variant: 'destructive',
      });
    } finally {
      setIsDeleting(false);
      setIsConfirming(false);
      setConfirmText('');
    }
  }, [barberId, isConfirmed, logout, navigation, toast, user]);

  return {
    isConfirming,
    isDeleting,
    confirmText,
    setConfirmText,
    requestDelete,
    deleteAccount,
    isConfirmed,
  };
};

export default useAccountDeletionHelper;

