import { MutableRefObject } from 'react';
import { supabase } from '../lib/supabase';
import { logger } from '../lib/logger';

type Service = { name: string; price: number; duration: number };

type FormData = {
  businessName: string;
  phone: string;
  location: string;
  bio: string;
  specialties: string[];
  services: Service[];
  stripeConnected: boolean;
  socialMedia: {
    instagram: string;
    twitter: string;
    tiktok: string;
    facebook: string;
  };
};

type SetFormData = React.Dispatch<React.SetStateAction<FormData>>;
type SetStripeStatus = React.Dispatch<React.SetStateAction<string | null>>;

interface PrefillDeps {
  userId: string;
  userProfile: any;
  setFormData: SetFormData;
  setStripeStatus: SetStripeStatus;
  prefillDoneRef: MutableRefObject<boolean>;
}

/**
 * Centralized, single-run prefill helper for barber onboarding.
 * - Runs once per mount via prefillDoneRef.
 * - Merges server values only into empty fields to avoid clobbering user input.
 * - Returns also Stripe status.
 */
export const runBarberPrefillOnce = async ({
  userId,
  userProfile,
  setFormData,
  setStripeStatus,
  prefillDoneRef,
}: PrefillDeps) => {
  if (prefillDoneRef.current) return;

  try {
    logger.log('Prefill: fetching profile data for user', { userId });

    // Barber row
    const { data: barberData, error: barberError } = await supabase
      .from('barbers')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (barberError && barberError.code !== 'PGRST116') {
      logger.error('Prefill: barber fetch error', barberError);
    }

    // Profile row
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('phone, location, name')
      .eq('id', userId)
      .single();
    const barberBusinessName =
      barberData?.business_name ||
      profile?.name ||
      userProfile?.business_name ||
      userProfile?.name ||
      '';
    const barberBio = barberData?.bio || '';
    const barberSpecialties = barberData?.specialties || [];
    const barberSocial = {
      instagram: barberData?.instagram || '',
      twitter: barberData?.twitter || '',
      tiktok: barberData?.tiktok || '',
      facebook: barberData?.facebook || '',
    };


    if (profileError && profileError.code !== 'PGRST116') {
      logger.error('Prefill: profile fetch error', profileError);
    }

    // Services
    let services: Service[] = [];
    if (barberData?.id) {
      const { data: existingServices, error: servicesError } = await supabase
        .from('services')
        .select('name, price, duration')
        .eq('barber_id', barberData.id);

      if (servicesError) {
        logger.error('Prefill: services fetch error', servicesError);
      } else if (Array.isArray(existingServices)) {
        services = existingServices.map((s) => ({
          name: s.name || '',
          price: typeof s.price === 'number' ? s.price : 0,
          duration: typeof s.duration === 'number' ? s.duration : 30,
        }));
      }
    }

    // Merge once; only fill blanks (check for empty strings, not just falsy values).
    setFormData((prev) => {
      const resolvedServices = services.length > 0 ? services : prev.services;
      return {
        ...prev,
        businessName: (prev.businessName && prev.businessName.trim()) ? prev.businessName : barberBusinessName,
        bio: (prev.bio && prev.bio.trim()) ? prev.bio : barberBio,
        specialties: prev.specialties.length > 0 ? prev.specialties : barberSpecialties,
        socialMedia: {
          instagram: (prev.socialMedia.instagram && prev.socialMedia.instagram.trim()) ? prev.socialMedia.instagram : barberSocial.instagram,
          twitter: (prev.socialMedia.twitter && prev.socialMedia.twitter.trim()) ? prev.socialMedia.twitter : barberSocial.twitter,
          tiktok: (prev.socialMedia.tiktok && prev.socialMedia.tiktok.trim()) ? prev.socialMedia.tiktok : barberSocial.tiktok,
          facebook: (prev.socialMedia.facebook && prev.socialMedia.facebook.trim()) ? prev.socialMedia.facebook : barberSocial.facebook,
        },
        phone: (prev.phone && prev.phone.trim()) ? prev.phone : (profile?.phone || ''),
        location: (prev.location && prev.location.trim()) ? prev.location : (profile?.location || ''),
        services: resolvedServices,
        stripeConnected: prev.stripeConnected || barberData?.stripe_account_status === 'active',
      };
    });

    if (barberData?.stripe_account_id) {
      setStripeStatus(barberData?.stripe_account_status || null);
    } else {
      setStripeStatus(null);
    }

    prefillDoneRef.current = true;
  } catch (error) {
    logger.error('Prefill: unexpected error', error);
  }
};

export default runBarberPrefillOnce;

