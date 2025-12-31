/**
 * Helper functions for calculating and displaying booking details
 * Separates client view from barber view pricing breakdown
 */

export interface BookingPricingData {
  basePrice: number;
  addonTotal: number;
  platformFee: number;
  barberPayout: number;
  totalCharged: number;
}

export interface BookingDetailsBreakdown {
  servicePrice: number;
  addons: number;
  platformFee: number;
  total: number;
  // For barber view only
  barberPayout?: number;
}

/**
 * Calculate total charged to client
 * Total = basePrice + addonTotal + platformFee
 */
export function calculateTotalCharged(
  basePrice: number,
  addonTotal: number,
  platformFee: number
): number {
  return basePrice + addonTotal + platformFee;
}

/**
 * Get booking pricing breakdown for display
 * Uses historical booking data, not current service prices
 * This ensures historical accuracy even if service prices change
 * 
 * IMPORTANT: The price field semantics vary by booking type:
 * - Fee-only bookings: price = platform_fee + barber_payout (platform fee only, ~$3.38)
 * - Developer bookings: price = service_price + addon_total (full price, no platform fee)
 * 
 * Service price is stored separately in service_price field for historical accuracy.
 */
export function getBookingPricingData(booking: {
  price?: number; // Total charged (platform_fee + barber_payout for fee-only bookings)
  platform_fee?: number;
  barber_payout?: number;
  addon_total?: number;
}, servicePrice?: number): BookingPricingData {
  const addonTotal = booking.addon_total || 0;
  const platformFee = booking.platform_fee || 0;
  const barberPayout = booking.barber_payout || 0;
  const totalCharged = booking.price || 0;
  
  // Service price is NOT included in the booking.price field
  // It's paid directly to the barber at the appointment
  // We need to get it from the service table or use the provided servicePrice
  // If servicePrice is not provided, we cannot calculate it from booking.price
  // because booking.price = platform_fee + barber_payout (not service + platform_fee)
  const basePrice = servicePrice || 0;
  
  // For fee-only bookings (current model):
  // - Customer pays: platform_fee + barber_payout = $3.38 (platform fee only)
  // - Service price is paid directly to barber at appointment
  // - Total charged = platform_fee + barber_payout
  
  // Calculate total charged: if we have service price, it's service + addons + platform fee
  // Otherwise, it's just the platform fee split (platform_fee + barber_payout)
  const finalTotalCharged = basePrice > 0
    ? calculateTotalCharged(basePrice, addonTotal, platformFee)
    : totalCharged || (platformFee + barberPayout);
  
  return {
    basePrice,
    addonTotal,
    platformFee,
    barberPayout,
    totalCharged: finalTotalCharged,
  };
}

/**
 * Get booking details breakdown for CLIENT view
 * Shows: Service Price, Add-ons, Platform Fee, Total Charged
 * Does NOT show barber payout
 * Uses historical booking data for accuracy
 * 
 * IMPORTANT:
 * - Fee-only bookings: customer pays platform fee only (price = platform_fee + barber_payout)
 *   Service price is paid directly to barber at appointment
 * - Developer bookings: no platform fee, price = service_price + addon_total
 * 
 * The `price` field represents what was charged via Stripe (platform fee for fee-only, full amount for others).
 * The `platform_fee` field in the database is BOCM's share of the platform fee split.
 */
export function getClientBookingDetails(
  booking: {
    price?: number; // Total platform fee charged to customer
    platform_fee?: number; // BOCM's share (not the total platform fee)
    barber_payout?: number; // Barber's share (for detecting old bookings)
    addon_total?: number;
  },
  servicePrice?: number
): BookingDetailsBreakdown {
  const pricing = getBookingPricingData(booking, servicePrice);
  
  // Check if this is a developer booking (all fees are 0)
  const isDeveloperBooking = (booking.price || 0) === 0 && 
                            (booking.platform_fee || 0) === 0;
  
  // Check if this is an old booking (price > $5 indicates it's likely the service price, not platform fee)
  // Old bookings were created before fee-only model, so price = service price, not platform fee
  const isOldBooking = (booking.price || 0) > 5 && 
                       ((booking.platform_fee || 0) === 0 && (booking.barber_payout || 0) === 0);
  
  // For developer bookings, there's no platform fee charged
  
  let platformFeeCharged = 0;
  if (!isDeveloperBooking && !isOldBooking) {
    const platformFeeFromFields = (booking.platform_fee || 0) + (booking.barber_payout || 0);
    // Use the sum of platform_fee + barber_payout (which equals price for fee-only bookings)
    // Fallback to price if sum is 0, but only if price is reasonable (<= $5, which is close to $3.38)
    platformFeeCharged = platformFeeFromFields > 0 
      ? platformFeeFromFields 
      : ((booking.price || 0) <= 5 ? (booking.price || 0) : 0);
  }
  
  // Total is service price (paid at appointment) + addons + platform fee (if any)
  // For developer bookings, total = service_price + addons (no platform fee)
  const total = (servicePrice || 0) + (booking.addon_total || 0) + platformFeeCharged;
  
  return {
    servicePrice: pricing.basePrice,
    addons: pricing.addonTotal,
    platformFee: platformFeeCharged, // What customer paid via Stripe (0 for developer bookings)
    total,
  };
}

/**
 * Get booking details breakdown for BARBER view
 * Shows: Service Price, Add-ons, Platform Fee, Your Payout
 * Uses historical booking data for accuracy
 * 
 * IMPORTANT: For barbers, the payout includes:
 * - Service price (paid directly at appointment)
 * - Add-ons (paid directly at appointment)
 * - Barber's share from platform fee (barber_payout from database)
 * 
 * For developer bookings (price = 0, platform_fee = 0, barber_payout = 0), 
 * the barber receives service_price + addon_total (no platform fee split).
 */
export function getBarberBookingDetails(
  booking: {
    price?: number; // Total platform fee charged to customer
    platform_fee?: number; // BOCM's share
    barber_payout?: number; // Barber's share from platform fee
    addon_total?: number;
  },
  servicePrice?: number
): BookingDetailsBreakdown {
  const pricing = getBookingPricingData(booking, servicePrice);
  
  // Check if this is a developer booking (all fees are 0)
  const isDeveloperBooking = (booking.price || 0) === 0 && 
                            (booking.platform_fee || 0) === 0 &&
                            (booking.barber_payout || 0) === 0;
  
  // For barber view:
  // - Service price: what customer pays at appointment
  // - Platform fee: what customer paid via Stripe (0 for developer bookings)
  // - Barber payout: service + addons (at appointment) + barber_payout (from platform fee, 0 for developer)
  const servicePriceAtAppointment = servicePrice || 0;
  const addonsAtAppointment = booking.addon_total || 0;
  const platformFeeShare = booking.barber_payout || 0;
  
  // Check if this is an old booking (price > $5 indicates it's likely the service price, not platform fee)
  // Old bookings were created before fee-only model, so price = service price, not platform fee
  const isOldBooking = (booking.price || 0) > 5 && 
                       ((booking.platform_fee || 0) === 0 && (booking.barber_payout || 0) === 0);
  
  // For developer bookings, there's no platform fee
  // For old bookings (pre fee-only model), no platform fee was charged
  // For regular bookings, calculate platform fee charged to customer
  // Note: For fee-only bookings, price = platform_fee + barber_payout (total platform fee charged, ~$3.38)
  let validatedPlatformFee = 0;
  if (!isDeveloperBooking && !isOldBooking) {
    const platformFeeCharged = (booking.platform_fee || 0) + (booking.barber_payout || 0);
    // Use the sum of platform_fee + barber_payout (which equals price for fee-only bookings)
    // Fallback to price if sum is 0, but only if price is reasonable (<= $5, which is close to $3.38)
    validatedPlatformFee = platformFeeCharged > 0 
      ? platformFeeCharged 
      : ((booking.price || 0) <= 5 ? (booking.price || 0) : 0);
  }
  
  // For developer bookings, barber gets full service price + addons (no platform fee split)
  // For regular bookings, barber gets service + addons + their share of platform fee
  const totalBarberPayout = servicePriceAtAppointment + addonsAtAppointment + platformFeeShare;
  
  // Total charged to customer = service + addons (at appointment) + platform fee (via Stripe, if any)
  const totalCharged = servicePriceAtAppointment + addonsAtAppointment + validatedPlatformFee;
  
  return {
    servicePrice: servicePriceAtAppointment,
    addons: addonsAtAppointment,
    platformFee: validatedPlatformFee, // Total platform fee charged (0 for developer bookings)
    total: totalCharged,
    barberPayout: totalBarberPayout,
  };
}

