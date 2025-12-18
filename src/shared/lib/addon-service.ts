import { supabase } from './supabase'
import { ServiceAddon, BookingAddon, CreateServiceAddonInput, UpdateServiceAddonInput } from '@/shared/types/addon'
import { logger } from './logger'

export class AddonService {
  // Get all add-ons for a barber
  static async getBarberAddons(barberId: string): Promise<ServiceAddon[]> {
    try {
      const { data, error } = await supabase
        .from('service_addons')
        .select('*')
        .eq('barber_id', barberId)
        .eq('is_active', true)
        .order('name')

      if (error) throw error
      return data || []
    } catch (error) {
      logger.error('Error fetching barber add-ons', error)
      throw error
    }
  }

  // Create a new add-on
  static async createAddon(addon: CreateServiceAddonInput): Promise<ServiceAddon> {
    try {
      const { data, error } = await supabase
        .from('service_addons')
        .insert(addon)
        .select()
        .single()

      if (error) throw error
      return data
    } catch (error) {
      logger.error('Error creating add-on', error)
      throw error
    }
  }

  // Update an add-on
  static async updateAddon(id: string, updates: UpdateServiceAddonInput): Promise<ServiceAddon> {
    try {
      const { data, error } = await supabase
        .from('service_addons')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      return data
    } catch (error) {
      logger.error('Error updating add-on', error)
      throw error
    }
  }

  // Delete an add-on
  static async deleteAddon(id: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('service_addons')
        .delete()
        .eq('id', id)

      if (error) throw error
    } catch (error) {
      logger.error('Error deleting add-on', error)
      throw error
    }
  }

  // Get add-ons for a specific booking
  static async getBookingAddons(bookingId: string): Promise<BookingAddon[]> {
    try {
      const { data, error } = await supabase
        .from('booking_addons')
        .select(`
          *,
          addon:addon_id(*)
        `)
        .eq('booking_id', bookingId)

      if (error) throw error
      return data || []
    } catch (error) {
      logger.error('Error fetching booking add-ons', error)
      throw error
    }
  }

  // Add add-ons to a booking
  static async addAddonsToBooking(bookingId: string, addonIds: string[]): Promise<void> {
    try {
      // First, get the add-on details to get their prices
      const { data: addons, error: addonsError } = await supabase
        .from('service_addons')
        .select('id, price')
        .in('id', addonIds)

      if (addonsError) throw addonsError

      // Create booking add-on records
      const bookingAddons = addons.map(addon => ({
        booking_id: bookingId,
        addon_id: addon.id,
        price: addon.price
      }))

      const { error: insertError } = await supabase
        .from('booking_addons')
        .insert(bookingAddons)

      if (insertError) throw insertError
    } catch (error) {
      logger.error('Error adding add-ons to booking', error)
      throw error
    }
  }

  // Remove add-ons from a booking
  static async removeAddonsFromBooking(bookingId: string, addonIds: string[]): Promise<void> {
    try {
      const { error } = await supabase
        .from('booking_addons')
        .delete()
        .eq('booking_id', bookingId)
        .in('addon_id', addonIds)

      if (error) throw error
    } catch (error) {
      logger.error('Error removing add-ons from booking', error)
      throw error
    }
  }

  // Calculate total add-on cost for a booking
  static async calculateAddonTotal(bookingId: string): Promise<number> {
    try {
      const { data, error } = await supabase
        .from('booking_addons')
        .select('price')
        .eq('booking_id', bookingId)

      if (error) throw error
      
      return data?.reduce((total, addon) => total + addon.price, 0) || 0
    } catch (error) {
      logger.error('Error calculating add-on total', error)
      throw error
    }
  }
} 