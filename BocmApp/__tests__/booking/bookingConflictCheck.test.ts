import { isBookingConflict, calculateBookingEnd } from '../app/shared/lib/bookingConflictCheck'

describe('bookingConflictCheck', () => {
  describe('isBookingConflict', () => {
    it('should return false for non-overlapping bookings', () => {
      const start1 = new Date('2024-01-01T10:00:00Z')
      const end1 = new Date('2024-01-01T11:00:00Z')
      const start2 = new Date('2024-01-01T12:00:00Z')
      const end2 = new Date('2024-01-01T13:00:00Z')

      expect(isBookingConflict(start1, end1, start2, end2)).toBe(false)
    })

    it('should return true for overlapping bookings', () => {
      const start1 = new Date('2024-01-01T10:00:00Z')
      const end1 = new Date('2024-01-01T11:00:00Z')
      const start2 = new Date('2024-01-01T10:30:00Z')
      const end2 = new Date('2024-01-01T11:30:00Z')

      expect(isBookingConflict(start1, end1, start2, end2)).toBe(true)
    })

    it('should return true for exactly overlapping bookings', () => {
      const start1 = new Date('2024-01-01T10:00:00Z')
      const end1 = new Date('2024-01-01T11:00:00Z')
      const start2 = new Date('2024-01-01T10:00:00Z')
      const end2 = new Date('2024-01-01T11:00:00Z')

      expect(isBookingConflict(start1, end1, start2, end2)).toBe(true)
    })

    it('should return true when booking starts before and ends during another', () => {
      const start1 = new Date('2024-01-01T10:00:00Z')
      const end1 = new Date('2024-01-01T10:30:00Z')
      const start2 = new Date('2024-01-01T10:15:00Z')
      const end2 = new Date('2024-01-01T11:00:00Z')

      expect(isBookingConflict(start1, end1, start2, end2)).toBe(true)
    })
  })

  describe('calculateBookingEnd', () => {
    it('should calculate end time correctly for 60 minute booking', () => {
      const start = new Date('2024-01-01T10:00:00Z')
      const end = calculateBookingEnd(start, 60)

      expect(end.getTime()).toBe(start.getTime() + 60 * 60000)
    })

    it('should calculate end time correctly for 30 minute booking', () => {
      const start = new Date('2024-01-01T10:00:00Z')
      const end = calculateBookingEnd(start, 30)

      expect(end.getTime()).toBe(start.getTime() + 30 * 60000)
    })

    it('should handle 0 duration', () => {
      const start = new Date('2024-01-01T10:00:00Z')
      const end = calculateBookingEnd(start, 0)

      expect(end.getTime()).toBe(start.getTime())
    })
  })
})

