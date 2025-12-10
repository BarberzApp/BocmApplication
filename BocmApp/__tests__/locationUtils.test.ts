import {
  calculateDistance,
  getDistanceToItem,
  sortByDistance,
  formatDistance,
  Location,
} from '../app/shared/lib/locationUtils';

describe('locationUtils', () => {
  describe('calculateDistance', () => {
    it('should calculate distance correctly for long and short distances', () => {
      // Long distance: NY to LA (~3936 km)
      expect(calculateDistance(40.7128, -74.006, 34.0522, -118.2437)).toBeCloseTo(3936, 0);
      
      // Short distance: ~1.1 km
      expect(calculateDistance(40.7128, -74.006, 40.7228, -74.006)).toBeCloseTo(1.1, 0.1);
      
      // Identical coordinates
      expect(calculateDistance(40.7128, -74.006, 40.7128, -74.006)).toBe(0);
    });

    it('should return Infinity for invalid inputs', () => {
      expect(calculateDistance(100, -74.006, 40.7128, -74.006)).toBe(Infinity); // Invalid lat
      expect(calculateDistance(40.7128, -200, 40.7128, -74.006)).toBe(Infinity); // Invalid lon
      expect(calculateDistance(NaN, -74.006, 40.7128, -74.006)).toBe(Infinity); // NaN
      // @ts-ignore - Testing invalid input
      expect(calculateDistance('invalid', -74.006, 40.7128, -74.006)).toBe(Infinity); // Non-number
    });
  });

  describe('getDistanceToItem', () => {
    const userLocation: Location = { latitude: 40.7128, longitude: -74.006 };

    it('should calculate distance for valid coordinates and return undefined for invalid/missing', () => {
      const validLocation: Location = { latitude: 40.7228, longitude: -74.006 };
      expect(getDistanceToItem(userLocation, validLocation)).toBeCloseTo(1.1, 0.1);
      
      expect(getDistanceToItem(userLocation, undefined)).toBeUndefined();
      expect(getDistanceToItem(userLocation, { latitude: NaN, longitude: -74.006 })).toBeUndefined();
    });
  });

  describe('sortByDistance', () => {
    it('should sort closest to farthest and handle undefined distances', () => {
      // Test closest to farthest sorting
      const items1 = [
        { id: 1, distance: 5 },
        { id: 2, distance: 1 },
        { id: 3, distance: 10 },
        { id: 4, distance: 2 },
      ];
      const sorted1 = sortByDistance(items1);
      expect(sorted1.map(i => i.id)).toEqual([2, 4, 1, 3]); // Closest first
      expect(items1[0].id).toBe(1); // Original not mutated

      // Test undefined distances go to end
      const items2 = [
        { id: 1, distance: 5 },
        { id: 2, distance: undefined },
        { id: 3, distance: 1 },
      ];
      const sorted2 = sortByDistance(items2);
      expect(sorted2.map(i => i.id)).toEqual([3, 1, 2]); // Undefined at end

      // Test edge cases
      expect(sortByDistance([])).toEqual([]);
      expect(sortByDistance([{ id: 1, distance: undefined }])).toEqual([{ id: 1, distance: undefined }]);
    });
  });

  describe('formatDistance', () => {
    it('should format all distance ranges correctly', () => {
      // Small distances (meters)
      expect(formatDistance(0.001)).toBe('1m');
      expect(formatDistance(0.05)).toBe('50m');
      expect(formatDistance(0.1)).toBe('100m');
      expect(formatDistance(0.9)).toBe('900m');
      
      // Medium distances (km with decimal)
      expect(formatDistance(1.2)).toBe('1.2km');
      expect(formatDistance(5.7)).toBe('5.7km');
      expect(formatDistance(9.9)).toBe('9.9km');
      
      // Large distances (km rounded)
      expect(formatDistance(10)).toBe('10km');
      expect(formatDistance(25.7)).toBe('26km');
      expect(formatDistance(100.3)).toBe('100km');
    });
  });
});

