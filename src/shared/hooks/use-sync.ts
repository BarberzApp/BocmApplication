import { useCallback } from 'react'
import { supabase } from '@/shared/lib/supabase'
import type { Booking } from '@/shared/types'
import { logger } from '@/shared/lib/logger'

export function useSync() {
  const getBooking = useCallback(async (bookingId: string): Promise<Booking | null> => {
    const { data, error } = await supabase
      .from('bookings')
      .select('*')
      .eq('id', bookingId)
      .single()

    if (error) {
      logger.error('Error fetching booking', error)
      return null
    }

    return data
  }, [])

  const createBooking = useCallback(async (booking: Partial<Booking>): Promise<Booking> => {
    const { data, error } = await supabase
      .from('bookings')
      .insert(booking)
      .select()
      .single()

    if (error) {
      logger.error('Error creating booking', error)
      throw error
    }

    return data
  }, [])

  return {
    syncService: {
      getBooking,
      createBooking,
    }
  }
} 