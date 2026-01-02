export const CARRIER_OPTIONS = [
  { value: 'verizon', label: 'Verizon' },
  { value: 'att', label: 'AT&T' },
  { value: 'tmobile', label: 'T-Mobile' },
  { value: 'sprint', label: 'Sprint' },
  { value: 'boost', label: 'Boost Mobile' },
  { value: 'uscellular', label: 'US Cellular' },
  { value: 'cricket', label: 'Cricket' },
  { value: 'metro', label: 'MetroPCS' },
  { value: 'googlefi', label: 'Google Fi' },
] as const

export const PRICE_RANGES = [
  { value: 'Budget ($15-$30)', label: 'Budget ($15-$30)', description: 'Budget ($15-$30) - Affordable services for everyone' },
  { value: 'Mid-range ($30-$60)', label: 'Mid-range ($30-$60)', description: 'Mid-range ($30-$60) - Quality services at fair prices' },
  { value: 'Premium ($60+)', label: 'Premium ($60+)', description: 'Premium ($60+) - High-end services and expertise' }
] as const

/**
 * Extracts social media handle from URL or returns formatted handle
 * @param input - URL string or handle (e.g., "https://instagram.com/username" or "@username" or "username")
 * @returns Formatted handle with @ prefix (e.g., "@username")
 */
export function extractHandle(input: string): string {
  if (!input) return '';
  input = input.trim();
  
  // If input is a URL, extract the handle
  try {
    const url = new URL(input);
    const pathParts = url.pathname.split('/').filter(Boolean);
    if (pathParts.length > 0) {
      let handle = pathParts[pathParts.length - 1];
      // For TikTok, handle may be prefixed with '@'
      if (handle.startsWith('@')) handle = handle.slice(1);
      return '@' + handle;
    }
  } catch {
    // Not a URL, fall through
  }
  
  // If input starts with @, return as-is, else add @
  if (input.startsWith('@')) return input;
  return '@' + input;
}

