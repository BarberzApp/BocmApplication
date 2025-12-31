import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  getLocationPreferences,
  saveLocationPreferences,
  setLocationEnabled,
  updateLastLocation,
  clearLocationPreferences,
  getLastLocation,
  StoredLocationPrefs,
} from '../app/shared/lib/locationPreferences';

jest.mock('@react-native-async-storage/async-storage');

const mockedAsyncStorage = AsyncStorage as jest.Mocked<typeof AsyncStorage>;

describe('locationPreferences', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getLocationPreferences', () => {
    it('should return null when no preferences are stored', async () => {
      mockedAsyncStorage.getItem.mockResolvedValue(null);
      const result = await getLocationPreferences();
      expect(result).toBeNull();
    });

    it('should return stored preferences', async () => {
      const prefs: StoredLocationPrefs = {
        locationEnabled: true,
        lastLocation: {
          lat: 40.7128,
          lon: -74.006,
          timestamp: Date.now(),
        },
      };
      mockedAsyncStorage.getItem.mockResolvedValue(JSON.stringify(prefs));
      const result = await getLocationPreferences();
      expect(result).toEqual(prefs);
    });

    it('should remove stale location data', async () => {
      const stalePrefs: StoredLocationPrefs = {
        locationEnabled: true,
        lastLocation: {
          lat: 40.7128,
          lon: -74.006,
          timestamp: Date.now() - 25 * 60 * 60 * 1000, // 25 hours ago
        },
      };
      mockedAsyncStorage.getItem.mockResolvedValue(JSON.stringify(stalePrefs));
      mockedAsyncStorage.setItem.mockResolvedValue();
      
      const result = await getLocationPreferences();
      expect(result?.lastLocation).toBeUndefined();
      expect(mockedAsyncStorage.setItem).toHaveBeenCalled();
    });
  });

  describe('saveLocationPreferences', () => {
    it('should save preferences to AsyncStorage', async () => {
      const prefs: StoredLocationPrefs = {
        locationEnabled: true,
      };
      mockedAsyncStorage.setItem.mockResolvedValue();
      
      await saveLocationPreferences(prefs);
      expect(mockedAsyncStorage.setItem).toHaveBeenCalledWith(
        '@bocm_location_preferences',
        JSON.stringify(prefs)
      );
    });
  });

  describe('setLocationEnabled', () => {
    it('should enable location and preserve last location', async () => {
      const existingPrefs: StoredLocationPrefs = {
        locationEnabled: false,
        lastLocation: {
          lat: 40.7128,
          lon: -74.006,
          timestamp: Date.now(),
        },
      };
      mockedAsyncStorage.getItem.mockResolvedValue(JSON.stringify(existingPrefs));
      mockedAsyncStorage.setItem.mockResolvedValue();
      
      await setLocationEnabled(true);
      expect(mockedAsyncStorage.setItem).toHaveBeenCalledWith(
        '@bocm_location_preferences',
        expect.stringContaining('"locationEnabled":true')
      );
    });

    it('should disable location and clear last location', async () => {
      const existingPrefs: StoredLocationPrefs = {
        locationEnabled: true,
        lastLocation: {
          lat: 40.7128,
          lon: -74.006,
          timestamp: Date.now(),
        },
      };
      mockedAsyncStorage.getItem.mockResolvedValue(JSON.stringify(existingPrefs));
      mockedAsyncStorage.setItem.mockResolvedValue();
      
      await setLocationEnabled(false);
      const callArgs = mockedAsyncStorage.setItem.mock.calls[0][1];
      const savedPrefs = JSON.parse(callArgs as string);
      expect(savedPrefs.locationEnabled).toBe(false);
      expect(savedPrefs.lastLocation).toBeUndefined();
    });
  });

  describe('updateLastLocation', () => {
    it('should update location and enable location preference', async () => {
      mockedAsyncStorage.getItem.mockResolvedValue(null);
      mockedAsyncStorage.setItem.mockResolvedValue();
      
      await updateLastLocation({ lat: 40.7128, lon: -74.006 });
      
      const callArgs = mockedAsyncStorage.setItem.mock.calls[0][1];
      const savedPrefs = JSON.parse(callArgs as string);
      expect(savedPrefs.locationEnabled).toBe(true);
      expect(savedPrefs.lastLocation).toEqual({
        lat: 40.7128,
        lon: -74.006,
        timestamp: expect.any(Number),
      });
    });
  });

  describe('getLastLocation', () => {
    it('should return last location if fresh', async () => {
      const prefs: StoredLocationPrefs = {
        locationEnabled: true,
        lastLocation: {
          lat: 40.7128,
          lon: -74.006,
          timestamp: Date.now() - 1000, // 1 second ago
        },
      };
      mockedAsyncStorage.getItem.mockResolvedValue(JSON.stringify(prefs));
      
      const result = await getLastLocation();
      expect(result).toEqual({ lat: 40.7128, lon: -74.006 });
    });

    it('should return null if location is stale', async () => {
      const prefs: StoredLocationPrefs = {
        locationEnabled: true,
        lastLocation: {
          lat: 40.7128,
          lon: -74.006,
          timestamp: Date.now() - 25 * 60 * 60 * 1000, // 25 hours ago
        },
      };
      mockedAsyncStorage.getItem.mockResolvedValue(JSON.stringify(prefs));
      mockedAsyncStorage.setItem.mockResolvedValue();
      
      const result = await getLastLocation();
      expect(result).toBeNull();
    });

    it('should return null if no location stored', async () => {
      mockedAsyncStorage.getItem.mockResolvedValue(null);
      const result = await getLastLocation();
      expect(result).toBeNull();
    });
  });

  describe('clearLocationPreferences', () => {
    it('should remove preferences from AsyncStorage', async () => {
      mockedAsyncStorage.removeItem.mockResolvedValue();
      await clearLocationPreferences();
      expect(mockedAsyncStorage.removeItem).toHaveBeenCalledWith('@bocm_location_preferences');
    });
  });
});

