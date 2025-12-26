// Fee calculation utilities
export const PLATFORM_FEE_CENTS = 338 // $3.38 in cents (what customer pays)
export const STRIPE_FEE_CENTS = 38 // $0.38 in cents (Stripe's fee: 2.9% + $0.30)
export const BOCM_SHARE_PERCENTAGE = 0.60 // 60%
export const BARBER_SHARE_PERCENTAGE = 0.40 // 40%

export interface FeeBreakdown {
  platformFee: number // Total platform fee in cents ($3.38)
  stripeFee: number // Stripe's fee in cents ($0.38) - absorbed by platform
  netAfterStripe: number // Net amount after Stripe fee in cents ($3.00)
  bocmShare: number // Platform's gross share in cents (60% of net = $1.80)
  bocmNetShare: number // Platform's net share after Stripe fee (60% of net - Stripe fee = $1.42)
  barberShare: number // Barber's share in cents (40% of net = $1.20)
}

export function calculateFeeBreakdown(): FeeBreakdown {
  // Stripe takes $0.38 from the $3.38 payment (this is a platform cost)
  const netAfterStripe = PLATFORM_FEE_CENTS - STRIPE_FEE_CENTS // $3.00 = 300 cents
  
  // Split the net amount 60/40
  const bocmShare = Math.round(netAfterStripe * BOCM_SHARE_PERCENTAGE) // 60% = $1.80 = 180 cents
  const barberShare = Math.round(netAfterStripe * BARBER_SHARE_PERCENTAGE) // 40% = $1.20 = 120 cents
  
  // BOCM absorbs the Stripe fee as a platform cost
  const bocmNetShare = bocmShare - STRIPE_FEE_CENTS // $1.80 - $0.38 = $1.42

  return {
    platformFee: PLATFORM_FEE_CENTS, // $3.38
    stripeFee: STRIPE_FEE_CENTS, // $0.38 (absorbed by platform)
    netAfterStripe, // $3.00
    bocmShare, // $1.80 (60% of net, before Stripe fee)
    bocmNetShare, // $1.42 (platform's net after absorbing Stripe fee)
    barberShare // $1.20 (40% of net)
  }
}

export function calculateBarberPayout(servicePriceCents: number, paymentType: 'fee' | 'full'): number {
  const { barberShare } = calculateFeeBreakdown()
  
  if (paymentType === 'fee') {
    // For fee-only payments, barber only gets their share of the fee after Stripe
    // Service and addons are paid directly to barber at appointment
    return barberShare // $1.20 (40% of net $3.00)
  } else {
    // For full payments, barber gets service price + their share of the fee
    return servicePriceCents + barberShare
  }
}

export function calculatePlatformFee(paymentType: 'fee' | 'full'): number {
  const { bocmNetShare } = calculateFeeBreakdown()
  
  // Platform gets their net share after absorbing Stripe fee
  return bocmNetShare // $1.42 (60% of net $3.00 minus $0.38 Stripe fee)
} 