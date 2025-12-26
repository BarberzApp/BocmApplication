/**
 * Content moderation utilities for filtering explicit and inappropriate content
 */

// List of inappropriate/explicit words and phrases (basic list - should be expanded)
const INAPPROPRIATE_WORDS = [
  // Explicit language
  'fuck', 'fucking', 'fucked', 'fucker',
  'shit', 'shitting', 'shitted',
  'damn', 'damned',
  'bitch', 'bitches',
  'asshole', 'ass',
  'bastard',
  'crap',
  'piss', 'pissing',
  'hell',
  
  // Hate speech and discriminatory terms
  'nigger', 'nigga',
  'retard', 'retarded',
  'gay', 'fag', 'faggot', // Context-dependent, but being conservative
  'tranny',
  
  // Sexual content
  'sex', 'sexual', 'porn', 'pornography', 'xxx',
  'nude', 'naked', 'nudity',
  'dick', 'cock', 'penis', 'pussy', 'vagina',
  
  // Violence
  'kill', 'killing', 'murder', 'murdering',
  'rape', 'raping', 'raped',
  'suicide', 'suicidal',
  
  // Spam/scam indicators
  'click here', 'buy now', 'limited time',
  'free money', 'get rich quick',
];

// Patterns for detecting inappropriate content
const INAPPROPRIATE_PATTERNS = [
  /(?:^|\s)([a-z0-9]+(?:\.(?:com|net|org|io)){1,})/gi, // URLs
  /(?:^|\s)(\+?1?[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g, // Phone numbers
  /(?:^|\s)([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g, // Email addresses
];

/**
 * Check if text contains inappropriate content
 * @param text Text to check
 * @returns Object with isInappropriate flag and reason if found
 */
export function checkTextContent(text: string): {
  isInappropriate: boolean;
  reason?: string;
  detectedWords?: string[];
} {
  if (!text || text.trim().length === 0) {
    return { isInappropriate: false };
  }

  const lowerText = text.toLowerCase();
  const detectedWords: string[] = [];
  
  // Check for inappropriate words
  for (const word of INAPPROPRIATE_WORDS) {
    // Use word boundaries to avoid false positives (e.g., "class" containing "ass")
    const regex = new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
    if (regex.test(lowerText)) {
      detectedWords.push(word);
    }
  }
  
  // Check for suspicious patterns (URLs, emails, phone numbers)
  const suspiciousPatterns: string[] = [];
  for (const pattern of INAPPROPRIATE_PATTERNS) {
    if (pattern.test(text)) {
      suspiciousPatterns.push('suspicious content');
    }
  }
  
  if (detectedWords.length > 0 || suspiciousPatterns.length > 0) {
    return {
      isInappropriate: true,
      reason: detectedWords.length > 0 
        ? `Content contains inappropriate language`
        : 'Content contains suspicious patterns (URLs, emails, or phone numbers)',
      detectedWords: detectedWords.length > 0 ? detectedWords : undefined,
    };
  }
  
  return { isInappropriate: false };
}

/**
 * Validate image file for basic safety checks
 * Note: For production, you should integrate with an image moderation API
 * (e.g., Google Cloud Vision API, AWS Rekognition, or similar)
 * 
 * @param fileUri Local file URI
 * @param fileSize File size in bytes
 * @param mimeType MIME type of the file
 * @returns Object with isValid flag and reason if invalid
 */
export async function validateImageContent(
  fileUri: string,
  fileSize: number,
  mimeType: string
): Promise<{
  isValid: boolean;
  reason?: string;
}> {
  // Check file size (max 10MB)
  const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
  if (fileSize > MAX_FILE_SIZE) {
    return {
      isValid: false,
      reason: 'Image file is too large. Maximum size is 10MB.',
    };
  }
  
  // Check file type
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
  if (!allowedTypes.includes(mimeType.toLowerCase())) {
    return {
      isValid: false,
      reason: 'Invalid file type. Only JPEG, PNG, WebP, and GIF images are allowed.',
    };
  }
  
  // Check minimum file size (to avoid empty/corrupted files)
  const MIN_FILE_SIZE = 100; // 100 bytes
  if (fileSize < MIN_FILE_SIZE) {
    return {
      isValid: false,
      reason: 'Image file appears to be corrupted or empty.',
    };
  }
  
  // TODO: For production, integrate with image moderation API here
  // Example services:
  // - Google Cloud Vision API (SafeSearch detection)
  // - AWS Rekognition (Content Moderation)
  // - Azure Content Moderator
  // - Cloudinary Moderation
  // 
  // These services can detect:
  // - Adult content
  // - Violence
  // - Racy content
  // - Medical content
  // - Spoof content
  
  return { isValid: true };
}

/**
 * Sanitize text by removing potentially harmful content
 * @param text Text to sanitize
 * @returns Sanitized text
 */
export function sanitizeText(text: string): string {
  if (!text) return '';
  
  // Remove HTML tags
  let sanitized = text.replace(/<[^>]*>/g, '');
  
  // Remove script tags and their content
  sanitized = sanitized.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  
  // Remove URLs (basic pattern)
  sanitized = sanitized.replace(/https?:\/\/[^\s]+/g, '');
  
  // Trim whitespace
  sanitized = sanitized.trim();
  
  return sanitized;
}

/**
 * Check if review content is appropriate
 * Combines text checking and basic validation
 */
export function validateReviewContent(comment: string): {
  isValid: boolean;
  reason?: string;
} {
  if (!comment || comment.trim().length === 0) {
    return { isValid: true }; // Empty comments are allowed
  }
  
  // Check length
  if (comment.length > 500) {
    return {
      isValid: false,
      reason: 'Review comment is too long. Maximum length is 500 characters.',
    };
  }
  
  // Check for inappropriate content
  const contentCheck = checkTextContent(comment);
  if (contentCheck.isInappropriate) {
    return {
      isValid: false,
      reason: contentCheck.reason || 'Review contains inappropriate content.',
    };
  }
  
  return { isValid: true };
}

