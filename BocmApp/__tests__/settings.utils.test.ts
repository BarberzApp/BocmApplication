import { extractHandle, BARBER_SPECIALTIES, PRICE_RANGES, CARRIER_OPTIONS } from '../app/shared/utils/settings.utils';

describe('settings.utils', () => {
  describe('extractHandle', () => {
    it('should extract handle from full URL', () => {
      expect(extractHandle('https://instagram.com/username')).toBe('@username');
      expect(extractHandle('https://twitter.com/user123')).toBe('@user123');
      expect(extractHandle('https://tiktok.com/@testuser')).toBe('@testuser');
    });

    it('should handle handle with @ prefix', () => {
      expect(extractHandle('@username')).toBe('@username');
      expect(extractHandle('@test_user')).toBe('@test_user');
    });

    it('should add @ prefix if missing', () => {
      expect(extractHandle('username')).toBe('@username');
      expect(extractHandle('test_user_123')).toBe('@test_user_123');
    });

    it('should handle empty or whitespace input', () => {
      expect(extractHandle('')).toBe('');
      // Whitespace gets trimmed, then @ is added to empty string
      expect(extractHandle('  ')).toBe('@');
    });

    it('should handle URLs with multiple path segments', () => {
      expect(extractHandle('https://instagram.com/p/username')).toBe('@username');
      expect(extractHandle('https://site.com/path/to/user')).toBe('@user');
    });

    it('should trim whitespace from input', () => {
      expect(extractHandle('  username  ')).toBe('@username');
      expect(extractHandle('  @username  ')).toBe('@username');
    });
  });

  describe('BARBER_SPECIALTIES', () => {
    it('should contain all expected specialties', () => {
      expect(BARBER_SPECIALTIES).toContain('Barber');
      expect(BARBER_SPECIALTIES).toContain('Braider');
      expect(BARBER_SPECIALTIES).toContain('Stylist');
      expect(BARBER_SPECIALTIES).toContain('Nails');
      expect(BARBER_SPECIALTIES).toContain('Lash');
      expect(BARBER_SPECIALTIES).toContain('Brow');
      expect(BARBER_SPECIALTIES).toContain('Tattoo');
      expect(BARBER_SPECIALTIES).toContain('Piercings');
      expect(BARBER_SPECIALTIES).toContain('Dyeing');
    });

    it('should have exactly 9 specialties', () => {
      expect(BARBER_SPECIALTIES).toHaveLength(9);
    });
  });

  describe('PRICE_RANGES', () => {
    it('should contain all price range options', () => {
      expect(PRICE_RANGES).toHaveLength(3);
      expect(PRICE_RANGES[0].label).toBe('Budget ($15-$30)');
      expect(PRICE_RANGES[1].label).toBe('Mid-range ($30-$60)');
      expect(PRICE_RANGES[2].label).toBe('Premium ($60+)');
    });

    it('should have value and label for each option', () => {
      PRICE_RANGES.forEach(range => {
        expect(range).toHaveProperty('value');
        expect(range).toHaveProperty('label');
        expect(typeof range.value).toBe('string');
        expect(typeof range.label).toBe('string');
      });
    });
  });

  describe('CARRIER_OPTIONS', () => {
    it('should contain major carriers', () => {
      const carriers = CARRIER_OPTIONS.map(c => c.value);
      expect(carriers).toContain('verizon');
      expect(carriers).toContain('att');
      expect(carriers).toContain('tmobile');
      expect(carriers).toContain('sprint');
    });

    it('should have value and label for each carrier', () => {
      CARRIER_OPTIONS.forEach(carrier => {
        expect(carrier).toHaveProperty('value');
        expect(carrier).toHaveProperty('label');
        expect(typeof carrier.value).toBe('string');
        expect(typeof carrier.label).toBe('string');
      });
    });

    it('should have at least 9 carrier options', () => {
      expect(CARRIER_OPTIONS.length).toBeGreaterThanOrEqual(9);
    });
  });
});

