"use client"

import { indexedDBService } from './indexeddb';
import { Booking } from '@/shared/types/booking';
import { supabase } from './supabase';
import { deletionGuard } from './deletion-guard';
import { logger } from './logger';

interface OfflineBooking extends Booking {
  offline?: boolean;
}

class SyncService {
  private isOnline: boolean;
  private syncQueue: OfflineBooking[] = [];

  constructor() {
    // Initialize isOnline safely
    this.isOnline = typeof window !== 'undefined' ? navigator.onLine : true;
    
    // Only set up event listeners on the client side
    if (typeof window !== 'undefined') {
      this.setupEventListeners();
    }
  }

  private setupEventListeners() {
    if (typeof window === 'undefined') return;
    
    window.addEventListener('online', () => this.handleOnline());
    window.addEventListener('offline', () => this.handleOffline());
  }

  private handleOffline() {
    this.isOnline = false;
  }

  private handleOnline() {
    this.isOnline = true;
    this.syncOfflineBookings();
  }

  async saveBooking(booking: OfflineBooking): Promise<void> {
    if (this.isOnline) {
      try {
        await this.saveToServer(booking);
        await indexedDBService.saveBooking(booking);
      } catch (error) {
        booking.offline = true;
        await indexedDBService.saveBooking(booking);
        this.syncQueue.push(booking);
      }
    } else {
      booking.offline = true;
      await indexedDBService.saveBooking(booking);
      this.syncQueue.push(booking);
    }
  }

  private async saveToServer(booking: Booking): Promise<void> {
    const { error } = await supabase
      .from('bookings')
      .insert(booking);
    if (error) throw error;
  }

  private async syncOfflineBookings() {
    const offlineBookings = await indexedDBService.getAllBookings();
    const offlineBookingsToSync = offlineBookings.filter(booking => (booking as OfflineBooking).offline);

    for (const booking of offlineBookingsToSync) {
      try {
        await this.saveToServer(booking);
        (booking as OfflineBooking).offline = false;
        await indexedDBService.saveBooking(booking);
      } catch (error) {
        logger.error('Failed to sync booking', error);
      }
    }
  }

  async getBookings(): Promise<Booking[]> {
    const { data, error } = await supabase
      .from('bookings')
      .select(`
        *,
        barber:barber_id (
          id,
          name,
          image,
          location
        ),
        service:service_id (
          id,
          name,
          price
        )
      `)
      .order('date', { ascending: true })

    if (error) throw error
    return data || []
  }

  async createBooking(booking: Omit<Booking, 'id' | 'barber' | 'service' | 'client'>): Promise<Booking> {
    const { data, error } = await supabase
      .from('bookings')
      .insert(booking)
      .select('*, barber:barber_id(*), service:service_id(*), client:client_id(*)')
      .single()

    if (error) throw error
    return data
  }

  async cancelBooking(bookingId: string): Promise<void> {
    const { error } = await supabase
      .from('bookings')
      .update({ status: 'cancelled' })
      .eq('id', bookingId)

    if (error) throw error
  }

  async updateBooking(bookingId: string, updates: Partial<Booking>): Promise<Booking> {
    const { data, error } = await supabase
      .from('bookings')
      .update(updates)
      .eq('id', bookingId)
      .select(`
        *,
        barber:barber_id (
          id,
          name,
          image,
          location
        ),
        service:service_id (
          id,
          name,
          price
        )
      `)
      .single()

    if (error) throw error
    return data
  }

  async deleteBooking(id: string, reason: string = 'manual', source: string = 'sync_service'): Promise<void> {
    // Check with deletion guard first
    if (!deletionGuard.shouldAllowDeletion(id, reason, source)) {
      throw new Error(`Deletion prevented by deletion guard for booking ${id}`);
    }

    // Validate input
    if (!id || typeof id !== 'string') {
      throw new Error('Invalid booking ID provided for deletion');
    }

    // Check if booking exists before attempting deletion
    const existingBooking = await indexedDBService.getBooking(id);
    if (!existingBooking) {
      logger.warn(`Attempted to delete non-existent booking: ${id}`);
      return;
    }

    if (this.isOnline) {
      try {
        // First, try to delete from server
        const { error } = await supabase
          .from('bookings')
          .delete()
          .eq('id', id)
        
        if (error) {
          logger.error('Server deletion failed', error);
          throw error;
        }
        
        // Only delete from IndexedDB if server deletion succeeded
        await indexedDBService.deleteBooking(id);
        logger.debug(`Booking ${id} deleted successfully from both server and local storage`);
        
      } catch (error) {
        logger.error(`Failed to delete booking ${id} from server`, error);
        // Don't delete from IndexedDB if server deletion failed
        // This prevents data inconsistency
        throw new Error(`Failed to delete booking: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    } else {
      // Offline mode: only delete from local storage
      logger.debug(`Deleting booking ${id} from local storage only (offline mode)`);
      await indexedDBService.deleteBooking(id);
    }
  }
}

// Only create the service instance on the client side
export const syncService = typeof window !== 'undefined' ? new SyncService() : null; 