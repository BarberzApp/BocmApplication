/**
 * Simple utility to check if booking times overlap
 * Used for client-side validation before submitting booking
 */
export function isBookingConflict(
  start1: Date,
  end1: Date,
  start2: Date,
  end2: Date
): boolean {
  return start1 < end2 && end1 > start2
}

/**
 * Calculate booking end time from start time and duration
 */
export function calculateBookingEnd(start: Date, durationMinutes: number): Date {
  return new Date(start.getTime() + durationMinutes * 60000)
}

