import { 
  calculateFeeBreakdown, 
  calculateBarberPayout, 
  calculatePlatformFee,
  PLATFORM_FEE_CENTS,
  STRIPE_FEE_CENTS,
  BOCM_SHARE_PERCENTAGE,
  BARBER_SHARE_PERCENTAGE
} from '../fee-calculator'

describe('Fee Calculator', () => {
  describe('calculateFeeBreakdown', () => {
    it('should calculate correct fee breakdown accounting for Stripe fee', () => {
      const breakdown = calculateFeeBreakdown()
      
      // Customer pays $3.38
      expect(breakdown.platformFee).toBe(338) // $3.38 in cents
      
      // Stripe takes $0.38
      expect(breakdown.stripeFee).toBe(38) // $0.38 in cents
      
      // Net after Stripe: $3.38 - $0.38 = $3.00
      expect(breakdown.netAfterStripe).toBe(300) // $3.00 in cents
      
      // BOCM gets 60% of net: $3.00 * 0.60 = $1.80
      expect(breakdown.bocmShare).toBe(180) // $1.80 in cents
      
      // Barber gets 40% of net: $3.00 * 0.40 = $1.20
      expect(breakdown.barberShare).toBe(120) // $1.20 in cents
    })

    it('should ensure bocmShare + barberShare equals netAfterStripe', () => {
      const breakdown = calculateFeeBreakdown()
      
      // The shares should add up to the net amount after Stripe
      expect(breakdown.bocmShare + breakdown.barberShare).toBe(breakdown.netAfterStripe)
      expect(breakdown.bocmShare + breakdown.barberShare).toBe(300) // $3.00
    })

    it('should ensure platformFee equals stripeFee + netAfterStripe', () => {
      const breakdown = calculateFeeBreakdown()
      
      // Total should equal Stripe fee + net amount
      expect(breakdown.platformFee).toBe(breakdown.stripeFee + breakdown.netAfterStripe)
      expect(breakdown.platformFee).toBe(338) // $3.38
    })

    it('should calculate correct percentages', () => {
      const breakdown = calculateFeeBreakdown()
      
      // BOCM should get 60% of net
      const expectedBocmShare = Math.round(breakdown.netAfterStripe * BOCM_SHARE_PERCENTAGE)
      expect(breakdown.bocmShare).toBe(expectedBocmShare)
      
      // Barber should get 40% of net
      const expectedBarberShare = Math.round(breakdown.netAfterStripe * BARBER_SHARE_PERCENTAGE)
      expect(breakdown.barberShare).toBe(expectedBarberShare)
    })
  })

  describe('calculateBarberPayout', () => {
    it('should return barber share for fee-only payments', () => {
      const payout = calculateBarberPayout(5000, 'fee') // $50 service price
      
      // For fee-only, barber only gets their share of the fee ($1.20)
      // Service is paid directly at appointment, not through Stripe
      expect(payout).toBe(120) // $1.20 in cents
    })

    it('should return service price + barber share for full payments', () => {
      const servicePriceCents = 5000 // $50
      const payout = calculateBarberPayout(servicePriceCents, 'full')
      
      // For full payments, barber gets service + their share of fee
      const { barberShare } = calculateFeeBreakdown()
      expect(payout).toBe(servicePriceCents + barberShare)
      expect(payout).toBe(5120) // $50 + $1.20 = $51.20
    })

    it('should handle zero service price for fee-only payments', () => {
      const payout = calculateBarberPayout(0, 'fee')
      
      // Should still return barber share of fee
      expect(payout).toBe(120) // $1.20
    })
  })

  describe('calculatePlatformFee', () => {
    it('should return BOCM share for fee-only payments', () => {
      const platformFee = calculatePlatformFee('fee')
      
      // Platform gets 60% of net after Stripe
      expect(platformFee).toBe(180) // $1.80 in cents
    })

    it('should return BOCM share for full payments', () => {
      const platformFee = calculatePlatformFee('full')
      
      // Platform always gets their share (60% of net)
      expect(platformFee).toBe(180) // $1.80 in cents
    })

    it('should match bocmShare from calculateFeeBreakdown', () => {
      const platformFee = calculatePlatformFee('fee')
      const { bocmShare } = calculateFeeBreakdown()
      
      expect(platformFee).toBe(bocmShare)
      expect(platformFee).toBe(180) // $1.80
    })
  })

  describe('Fee Breakdown Summary', () => {
    it('should provide correct fee breakdown summary', () => {
      const breakdown = calculateFeeBreakdown()
      
      // Summary:
      // Customer pays: $3.38
      // Stripe fee: $0.38
      // Net after Stripe: $3.00
      // BOCM receives: $1.80 (60%)
      // Barber receives: $1.20 (40%)
      
      expect(breakdown.platformFee).toBe(338) // $3.38
      expect(breakdown.stripeFee).toBe(38) // $0.38
      expect(breakdown.netAfterStripe).toBe(300) // $3.00
      expect(breakdown.bocmShare).toBe(180) // $1.80
      expect(breakdown.barberShare).toBe(120) // $1.20
      
      // Verify math
      expect(breakdown.bocmShare + breakdown.barberShare).toBe(breakdown.netAfterStripe)
      expect(breakdown.stripeFee + breakdown.netAfterStripe).toBe(breakdown.platformFee)
    })
  })
})

