// Custom hook for managing location-based features
import { useState, useEffect, useCallback } from 'react';
import * as Location from 'expo-location';
import { Alert, Linking } from 'react-native';
import { getLocationPreferences, setLocationEnabled, getLastLocation, updateLastLocation } from '../lib/locationPreferences';
import { logger } from '../lib/logger';

export interface UseLocationReturn {
  // State
  userLocation: Location.LocationObject | null;
  locationPermission: Location.PermissionStatus | null;
  locationLoading: boolean;
  useLocation: boolean;
  
  // Actions
  toggleLocation: () => Promise<void>;
  getUserLocation: () => Promise<void>;
  requestLocationPermission: () => Promise<boolean>;
  loadLocationPreferences: () => Promise<void>;
}

export function useLocationManager(): UseLocationReturn {
  const [userLocation, setUserLocation] = useState<Location.LocationObject | null>(null);
  const [locationPermission, setLocationPermission] = useState<Location.PermissionStatus | null>(null);
  const [locationLoading, setLocationLoading] = useState(false);
  const [useLocation, setUseLocation] = useState(false);

  // Load location preferences on mount
  const loadLocationPreferences = useCallback(async () => {
    try {
      const prefs = await getLocationPreferences();
      if (prefs?.locationEnabled) {
        setUseLocation(true);
        
        // Try to use last known location if available
        const lastLoc = await getLastLocation();
        if (lastLoc) {
          // Create a LocationObject-like structure
          setUserLocation({
            coords: {
              latitude: lastLoc.lat,
              longitude: lastLoc.lon,
              altitude: null,
              accuracy: 100, // Assume 100m accuracy for cached location
              altitudeAccuracy: null,
              heading: null,
              speed: null,
            },
            timestamp: Date.now(),
          });
          logger.log('Loaded cached location:', lastLoc);
        }
      }
    } catch (error) {
      logger.error('Error loading location preferences:', error);
    }
  }, []);

  // Request location permission
  const requestLocationPermission = useCallback(async (): Promise<boolean> => {
    try {
      setLocationLoading(true);
      
      // Check if location services are enabled
      const servicesEnabled = await Location.hasServicesEnabledAsync();
      if (!servicesEnabled) {
        Alert.alert(
          'Location Services Disabled',
          'Please enable location services in your device settings to use this feature.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Open Settings', onPress: () => Linking.openSettings() }
          ]
        );
        return false;
      }
      
      // Request permission
      const { status } = await Location.requestForegroundPermissionsAsync();
      setLocationPermission(status);
      
      if (status !== 'granted') {
        Alert.alert(
          'Location Permission Required',
          'Location permission is required to find barbers near you. Please grant permission in settings.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Open Settings', onPress: () => Linking.openSettings() }
          ]
        );
        return false;
      }
      
      logger.log('Location permission granted');
      return true;
    } catch (error) {
      logger.error('Error requesting location permission:', error);
      Alert.alert('Error', 'Failed to get location permission. Please try again.');
      return false;
    } finally {
      setLocationLoading(false);
    }
  }, []);

  // Get user's current location
  const getUserLocation = useCallback(async () => {
    try {
      setLocationLoading(true);
      
      const hasPermission = await requestLocationPermission();
      if (!hasPermission) return;
      
      logger.log('Getting current location...');
      
      // Get current location with better accuracy settings
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
        timeInterval: 10000,
        distanceInterval: 5,
      });
      
      // Check if location accuracy is reasonable (less than 100 meters)
      if (location.coords.accuracy && location.coords.accuracy > 100) {
        logger.warn(`Low location accuracy: ${location.coords.accuracy}m`);
        Alert.alert(
          'Low Location Accuracy',
          'Your location accuracy is low. For better results, try moving to an open area or enabling GPS.',
          [{ text: 'OK' }]
        );
      }
      
      setUserLocation(location);
      setUseLocation(true);
      
      // Save location preferences
      await updateLastLocation({
        lat: location.coords.latitude,
        lon: location.coords.longitude,
      });
      await setLocationEnabled(true);
      
      logger.log('User location obtained and saved:', {
        lat: location.coords.latitude,
        lon: location.coords.longitude,
        accuracy: location.coords.accuracy,
      });
      
      // Show success feedback
      Alert.alert(
        'Location Updated',
        'Your location has been updated. Results are now sorted by distance.',
        [{ text: 'OK' }]
      );
      
    } catch (error) {
      logger.error('Error getting user location:', error);
      Alert.alert(
        'Location Error', 
        'Failed to get your current location. Please check your GPS settings and try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setLocationLoading(false);
    }
  }, [requestLocationPermission]);

  // Toggle location on/off
  const toggleLocation = useCallback(async () => {
    if (useLocation) {
      // Turn off location
      logger.log('Turning off location');
      setUseLocation(false);
      setUserLocation(null);
      await setLocationEnabled(false);
    } else {
      // Turn on location
      logger.log('Turning on location');
      await getUserLocation();
    }
  }, [useLocation, getUserLocation]);

  return {
    // State
    userLocation,
    locationPermission,
    locationLoading,
    useLocation,
    
    // Actions
    toggleLocation,
    getUserLocation,
    requestLocationPermission,
    loadLocationPreferences,
  };
}

