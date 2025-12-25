import { theme } from '../lib/theme';

/**
 * Generates initials from a name
 * @param name - Full name or username
 * @returns Initials (max 2 characters)
 */
export function getInitials(name?: string | null): string {
  if (!name || name.trim().length === 0) {
    return 'U';
  }

  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) {
    return parts[0].charAt(0).toUpperCase();
  }

  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

/**
 * Generates a deterministic color based on a string (name)
 * This ensures the same name always gets the same color
 * @param str - String to generate color from
 * @returns Hex color string
 */
export function getColorFromString(str?: string | null): string {
  if (!str || str.length === 0) {
    return theme.colors.secondary; // Default saffron brown
  }

  // Generate a hash from the string
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }

  // Use theme colors as base palette
  const colors = [
    theme.colors.secondary, // Saffron brown
    theme.colors.accent, // Coffee brown
    '#8B4513', // Saddle brown
    '#A0522D', // Sienna
    '#CD853F', // Peru
    '#D2691E', // Chocolate
    '#B8860B', // Dark goldenrod
    '#DAA520', // Goldenrod
  ];

  // Use hash to select a color from the palette
  const index = Math.abs(hash) % colors.length;
  return colors[index];
}

/**
 * Gets gradient colors for cover photo based on name
 * @param name - Name to generate gradient from
 * @returns Array of two color strings for gradient
 */
export function getCoverGradientColors(name?: string | null): string[] {
  const baseColor = getColorFromString(name);
  
  // Create a darker and lighter variant for gradient
  // Simple approach: use theme gradients or create variations
  const gradients = [
    [theme.colors.secondary, theme.colors.accent],
    ['#272a2f', '#2d2a26'],
    ['#c78e3f', '#8d7250'],
    ['#8d7250', '#c78e3f'],
    ['#2d2a26', '#272a2f'],
  ];

  if (!name) {
    return gradients[0];
  }

  // Use hash to select gradient
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % gradients.length;
  return gradients[index];
}

/**
 * Avatar fallback props for rendering
 */
export interface AvatarFallbackProps {
  initials: string;
  backgroundColor: string;
  textColor?: string;
}

/**
 * Gets avatar fallback props
 * @param name - User name
 * @returns Avatar fallback props
 */
export function getAvatarFallbackProps(name?: string | null): AvatarFallbackProps {
  return {
    initials: getInitials(name),
    backgroundColor: getColorFromString(name),
    textColor: theme.colors.foreground,
  };
}

/**
 * Cover photo fallback props
 */
export interface CoverFallbackProps {
  gradientColors: string[];
}

/**
 * Gets cover photo fallback props
 * @param name - User name
 * @returns Cover photo fallback props
 */
export function getCoverFallbackProps(name?: string | null): CoverFallbackProps {
  return {
    gradientColors: getCoverGradientColors(name),
  };
}

