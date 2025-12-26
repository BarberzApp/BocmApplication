/**
 * Location utility functions for calculating distances and sorting by location
 */

export interface Location {
  latitude: number;
  longitude: number;
}

export interface SortableItem {
  distance?: number;
  [key: string]: any;
}

/**
 * Calculate distance between two coordinates using Haversine formula
 * @param lat1 Latitude of first point
 * @param lon1 Longitude of first point
 * @param lat2 Latitude of second point
 * @param lon2 Longitude of second point
 * @returns Distance in miles
 */
export function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  // Validate coordinates
  if (
    typeof lat1 !== 'number' ||
    typeof lon1 !== 'number' ||
    typeof lat2 !== 'number' ||
    typeof lon2 !== 'number' ||
    isNaN(lat1) ||
    isNaN(lon1) ||
    isNaN(lat2) ||
    isNaN(lon2)
  ) {
    return Infinity; // Return Infinity for invalid coordinates
  }

  // Check if coordinates are within valid ranges
  if (
    lat1 < -90 || lat1 > 90 ||
    lon1 < -180 || lon1 > 180 ||
    lat2 < -90 || lat2 > 90 ||
    lon2 < -180 || lon2 > 180
  ) {
    return Infinity;
  }

  // Haversine formula - optimized and validated
  const R = 3959; // Earth's radius in miles
  const lat1Rad = (lat1 * Math.PI) / 180;
  const lat2Rad = (lat2 * Math.PI) / 180;
  const dLat = lat2Rad - lat1Rad;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1Rad) *
      Math.cos(lat2Rad) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;
  
  // Validate result
  if (isNaN(distance) || !isFinite(distance) || distance < 0) {
    return Infinity;
  }
  
  return distance;
}

/**
 * Calculate distance from user location to an item with coordinates
 * @param userLocation User's current location
 * @param itemLocation Item's location (can be undefined)
 * @returns Distance in miles, or undefined if item has no coordinates
 */
export function getDistanceToItem(
  userLocation: Location,
  itemLocation?: Location
): number | undefined {
  if (!itemLocation?.latitude || !itemLocation?.longitude) {
    return undefined;
  }

  return calculateDistance(
    userLocation.latitude,
    userLocation.longitude,
    itemLocation.latitude,
    itemLocation.longitude
  );
}

/**
 * Sort items by distance (items with undefined distance go to the end)
 * @param items Array of items with optional distance property
 * @returns Sorted array (closest first)
 */
export function sortByDistance<T extends SortableItem>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    // Both have distances - sort by distance
    if (a.distance !== undefined && b.distance !== undefined) {
      return a.distance - b.distance;
    }
    // Items with distances come first
    if (a.distance !== undefined) return -1;
    if (b.distance !== undefined) return 1;
    // Both undefined - maintain original order
    return 0;
  });
}

/**
 * Format distance for display
 * @param distance Distance in miles
 * @returns Formatted string (e.g., "0.5 mi", "1.2 mi", "10 mi")
 */
export function formatDistance(distance: number): string {
  if (distance < 0.1) {
    // For very short distances, show in feet
    const feet = Math.round(distance * 5280);
    return `${feet} ft`;
  } else if (distance < 1) {
    // For distances less than 1 mile, show with 1 decimal place
    return `${distance.toFixed(1)} mi`;
  } else if (distance < 10) {
    // For distances 1-10 miles, show with 1 decimal place
    return `${distance.toFixed(1)} mi`;
  } else {
    // For longer distances, round to nearest mile
    return `${Math.round(distance)} mi`;
  }
}

