import AsyncStorage from '@react-native-async-storage/async-storage';
import { logger } from './logger';

export type Coords = { lat: number; lon: number };

export type StoredLocationPrefs = {
  locationEnabled: boolean;
  lastLocation?: {
    lat: number;
    lon: number;
    timestamp: number; // Date.now() when saved
  };
};

const LOCATION_PREFS_KEY = '@bocm_location_preferences';
const LOCATION_MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Get stored location preferences
 */
export async function getLocationPreferences(): Promise<StoredLocationPrefs | null> {
  try {
    const stored = await AsyncStorage.getItem(LOCATION_PREFS_KEY);
    if (!stored) return null;

    const prefs: StoredLocationPrefs = JSON.parse(stored);
    
    // Check if last location is too old
    if (prefs.lastLocation) {
      const age = Date.now() - prefs.lastLocation.timestamp;
      if (age > LOCATION_MAX_AGE_MS) {
        // Location is stale, remove it but keep the preference
        prefs.lastLocation = undefined;
        await saveLocationPreferences(prefs);
      }
    }

    return prefs;
  } catch (error) {
    logger.error('Error getting location preferences:', error);
    return null;
  }
}

/**
 * Save location preferences
 */
export async function saveLocationPreferences(prefs: StoredLocationPrefs): Promise<void> {
  try {
    await AsyncStorage.setItem(LOCATION_PREFS_KEY, JSON.stringify(prefs));
  } catch (error) {
    logger.error('Error saving location preferences:', error);
    throw error;
  }
}

/**
 * Update location enabled state
 */
export async function setLocationEnabled(enabled: boolean): Promise<void> {
  const prefs = await getLocationPreferences() || { locationEnabled: false };
  prefs.locationEnabled = enabled;
  
  // If disabling, clear last location
  if (!enabled) {
    prefs.lastLocation = undefined;
  }
  
  await saveLocationPreferences(prefs);
}

/**
 * Update last known location
 */
export async function updateLastLocation(coords: Coords): Promise<void> {
  const prefs = await getLocationPreferences() || { locationEnabled: false };
  prefs.lastLocation = {
    lat: coords.lat,
    lon: coords.lon,
    timestamp: Date.now(),
  };
  prefs.locationEnabled = true; // Auto-enable when location is saved
  await saveLocationPreferences(prefs);
}

/**
 * Clear location preferences
 */
export async function clearLocationPreferences(): Promise<void> {
  try {
    await AsyncStorage.removeItem(LOCATION_PREFS_KEY);
  } catch (error) {
    logger.error('Error clearing location preferences:', error);
  }
}

/**
 * Get last known location if it's still fresh
 */
export async function getLastLocation(): Promise<Coords | null> {
  const prefs = await getLocationPreferences();
  if (!prefs?.lastLocation) return null;

  const age = Date.now() - prefs.lastLocation.timestamp;
  if (age > LOCATION_MAX_AGE_MS) {
    return null; // Location is stale
  }

  return {
    lat: prefs.lastLocation.lat,
    lon: prefs.lastLocation.lon,
  };
}

