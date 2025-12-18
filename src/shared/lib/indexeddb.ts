import { Booking } from '@/shared/types/booking';
import { logger } from './logger';

const DB_NAME = 'bocm-db';
const DB_VERSION = 1;
const BOOKINGS_STORE = 'bookings';

export class IndexedDBService {
  private db: IDBDatabase | null = null;

  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(BOOKINGS_STORE)) {
          db.createObjectStore(BOOKINGS_STORE, { keyPath: 'id' });
        }
      };
    });
  }

  async saveBooking(booking: Booking): Promise<void> {
    if (!this.db) await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(BOOKINGS_STORE, 'readwrite');
      const store = transaction.objectStore(BOOKINGS_STORE);
      const request = store.put(booking);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  async getBooking(id: string): Promise<Booking | null> {
    if (!this.db) await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(BOOKINGS_STORE, 'readonly');
      const store = transaction.objectStore(BOOKINGS_STORE);
      const request = store.get(id);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result || null);
    });
  }

  async getAllBookings(): Promise<Booking[]> {
    if (!this.db) await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(BOOKINGS_STORE, 'readonly');
      const store = transaction.objectStore(BOOKINGS_STORE);
      const request = store.getAll();

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
    });
  }

  async deleteBooking(id: string): Promise<void> {
    // Validate input
    if (!id || typeof id !== 'string') {
      throw new Error('Invalid booking ID provided for IndexedDB deletion');
    }

    if (!this.db) await this.init();
    
    // Check if booking exists before deletion
    const existingBooking = await this.getBooking(id);
    if (!existingBooking) {
      logger.warn(`Attempted to delete non-existent booking from IndexedDB: ${id}`);
      return;
    }

    logger.debug(`Deleting booking ${id} from IndexedDB`);
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(BOOKINGS_STORE, 'readwrite');
      const store = transaction.objectStore(BOOKINGS_STORE);
      const request = store.delete(id);

      request.onerror = () => {
        logger.error(`Failed to delete booking ${id} from IndexedDB`, request.error);
        reject(request.error);
      };
      request.onsuccess = () => {
        logger.debug(`Successfully deleted booking ${id} from IndexedDB`);
        resolve();
      };
    });
  }

  async clearAllBookings(): Promise<void> {
    logger.warn('CLEARING ALL BOOKINGS FROM INDEXEDDB - This is a destructive operation!');
    
    if (!this.db) await this.init();
    
    // Get count before clearing for logging
    const allBookings = await this.getAllBookings();
    const bookingCount = allBookings.length;
    
    if (bookingCount === 0) {
      logger.debug('No bookings to clear from IndexedDB');
      return;
    }
    
    logger.debug(`Clearing ${bookingCount} bookings from IndexedDB`);
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(BOOKINGS_STORE, 'readwrite');
      const store = transaction.objectStore(BOOKINGS_STORE);
      const request = store.clear();

      request.onerror = () => {
        logger.error('Failed to clear bookings from IndexedDB', request.error);
        reject(request.error);
      };
      request.onsuccess = () => {
        logger.debug(`Successfully cleared ${bookingCount} bookings from IndexedDB`);
        resolve();
      };
    });
  }
}

export const indexedDBService = new IndexedDBService(); 