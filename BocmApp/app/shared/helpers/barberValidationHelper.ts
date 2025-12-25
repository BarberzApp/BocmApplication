import { validateServices, Service } from './barberServicesHelper';

interface FormData {
  businessName: string;
  phone: string;
  location: string;
  bio: string;
  specialties: string[];
  services: Service[];
  stripeConnected: boolean;
}

export const validateStep = (stepId: string, formData: FormData) => {
  const errors: Record<string, string> = {};

  if (stepId === 'business') {
    if (!formData.businessName.trim()) {
      errors.businessName = 'Business name is required';
    }
    if (!formData.phone.trim()) {
      errors.phone = 'Phone number is required';
    } else {
      const cleanedPhone = formData.phone.replace(/[^\d]/g, '');
      if (cleanedPhone.length < 10) {
        errors.phone = 'Please enter a valid phone number';
      }
    }
    if (!formData.location.trim()) {
      errors.location = 'Location is required';
    }
    if (!formData.bio.trim()) {
      errors.bio = 'Bio is required';
    }
  } else if (stepId === 'services') {
    Object.assign(errors, validateServices(formData.services));
  } else if (stepId === 'stripe') {
    // No validation required; optional step
  }

  return { errors, isValid: Object.keys(errors).length === 0 };
};

export default { validateStep };

