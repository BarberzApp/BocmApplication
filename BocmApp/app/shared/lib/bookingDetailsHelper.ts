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
 */
export function getBookingPricingData(booking: {
  price?: number; // Total charged (basePrice + addonTotal + platformFee)
  platform_fee?: number;
  barber_payout?: number;
  addon_total?: number;
}, servicePrice?: number): BookingPricingData {
  // Use stored booking values for historical accuracy
  const totalCharged = booking.price || 0;
  const addonTotal = booking.addon_total || 0;
  const platformFee = booking.platform_fee || 0;
  
  // Calculate base service price from stored booking data
  // basePrice = totalCharged - addonTotal - platformFee
  // This ensures we use the historical price, not the current service price
  const basePrice = Math.max(0, totalCharged - addonTotal - platformFee);
  
  // If basePrice calculation seems wrong (e.g., totalCharged is 0), fallback to servicePrice
  // This handles edge cases where booking data might be incomplete
  const historicalBasePrice = basePrice > 0 ? basePrice : (servicePrice || 0);
  
  // Calculate barber payout: prefer stored value, otherwise calculate
  const barberPayout = typeof booking.barber_payout === 'number' 
    ? booking.barber_payout 
    : historicalBasePrice + addonTotal + (platformFee * 0.40); // 40% of platform fee goes to barber
  
  // Use calculated total if we have all components, otherwise use stored price
  const finalTotalCharged = totalCharged > 0 
    ? totalCharged 
    : calculateTotalCharged(historicalBasePrice, addonTotal, platformFee);
  
  return {
    basePrice: historicalBasePrice,
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
 */
export function getClientBookingDetails(
  booking: {
    price?: number;
    platform_fee?: number;
    addon_total?: number;
  },
  servicePrice?: number
): BookingDetailsBreakdown {
  const pricing = getBookingPricingData(booking, servicePrice);
  
  return {
    servicePrice: pricing.basePrice,
    addons: pricing.addonTotal,
    platformFee: pricing.platformFee,
    total: pricing.totalCharged,
  };
}

/**
 * Get booking details breakdown for BARBER view
 * Shows: Service Price, Add-ons, Platform Fee, Your Payout
 * Uses historical booking data for accuracy
 */
export function getBarberBookingDetails(
  booking: {
    price?: number;
    platform_fee?: number;
    barber_payout?: number;
    addon_total?: number;
  },
  servicePrice?: number
): BookingDetailsBreakdown {
  const pricing = getBookingPricingData(booking, servicePrice);
  
  return {
    servicePrice: pricing.basePrice,
    addons: pricing.addonTotal,
    platformFee: pricing.platformFee,
    total: pricing.totalCharged,
    barberPayout: pricing.barberPayout,
  };
}

