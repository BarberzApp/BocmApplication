// Content Moderation Service
// This service provides multiple layers of content moderation
import { logger } from './logger';

export interface ModerationResult {
  isAppropriate: boolean;
  confidence: number;
  flags: string[];
  suggestions?: string[];
}

export interface ContentValidation {
  isValid: boolean;
  issues: string[];
  suggestions?: string[];
}

// Explicit content keywords (expandable list)
const EXPLICIT_KEYWORDS = [
  'fuck', 'shit', 'bitch', 'ass', 'dick', 'pussy', 'cock', 'cunt', 'whore', 'slut',
  'nigger', 'faggot', 'retard', 'idiot', 'stupid', 'dumb', 'moron', 'bastard',
  'motherfucker', 'fucker', 'shitty', 'fucking', 'damn', 'hell'
];

// Spam patterns
const SPAM_PATTERNS = [
  /\b[A-Z]{3,}\b/g, // ALL CAPS
  /!{3,}/g, // Multiple exclamation marks
  /\?{3,}/g, // Multiple question marks
  /\.{3,}/g, // Multiple dots
  /\*{3,}/g, // Multiple asterisks
];

// Aggressive language patterns
const AGGRESSIVE_WORDS = [
  'hate', 'terrible', 'awful', 'worst', 'horrible', 'disgusting', 'useless',
  'worthless', 'pathetic', 'ridiculous', 'stupid', 'idiot', 'moron'
];

// Client-side content validation
export function validateContent(text: string): ContentValidation {
  const issues: string[] = [];
  const suggestions: string[] = [];
  
  // Check length
  if (text.length < 10) {
    issues.push('Review must be at least 10 characters long');
    suggestions.push('Please provide more details about your experience');
  }
  if (text.length > 500) {
    issues.push('Review must be less than 500 characters');
    suggestions.push('Please keep your review concise');
  }

  // Check for explicit keywords
  const lowerText = text.toLowerCase();
  const foundExplicit = EXPLICIT_KEYWORDS.filter(word => lowerText.includes(word));
  if (foundExplicit.length > 0) {
    issues.push(`Contains inappropriate language`);
    suggestions.push('Please use respectful language in your review');
  }

  // Check for spam patterns
  const spamFound = SPAM_PATTERNS.some(pattern => pattern.test(text));
  if (spamFound) {
    issues.push('Contains spam-like patterns (excessive caps, punctuation)');
    suggestions.push('Please write your review in a natural, respectful tone');
  }

  // Check for repetitive characters
  if (/(.)\1{4,}/.test(text)) {
    issues.push('Contains too many repetitive characters');
    suggestions.push('Please avoid excessive repetition');
  }

  // Check for aggressive language
  const aggressiveCount = AGGRESSIVE_WORDS.filter(word => lowerText.includes(word)).length;
  if (aggressiveCount > 2) {
    issues.push('Contains overly negative language');
    suggestions.push('Please provide constructive feedback');
  }

  // Check for minimum meaningful content
  const words = text.trim().split(/\s+/).filter(word => word.length > 0);
  if (words.length < 3) {
    issues.push('Review is too short');
    suggestions.push('Please provide more details about your experience');
  }

  return {
    isValid: issues.length === 0,
    issues,
    suggestions
  };
}

// AI-powered content moderation (placeholder for OpenAI integration)
export async function moderateContentWithAI(text: string): Promise<ModerationResult> {
  // This would integrate with OpenAI's content moderation API
  // For now, we'll use an enhanced heuristic approach
  
  const lowerText = text.toLowerCase();
  const flags: string[] = [];
  let confidence = 0.8; // Base confidence
  const suggestions: string[] = [];

  // Check for explicit content
  const explicitCount = EXPLICIT_KEYWORDS.filter(word => lowerText.includes(word)).length;
  if (explicitCount > 0) {
    flags.push('explicit_language');
    confidence -= 0.4;
    suggestions.push('Please remove inappropriate language');
  }

  // Check for aggressive language
  const aggressiveCount = AGGRESSIVE_WORDS.filter(word => lowerText.includes(word)).length;
  if (aggressiveCount > 2) {
    flags.push('aggressive_tone');
    confidence -= 0.2;
    suggestions.push('Please provide more constructive feedback');
  }

  // Check for spam indicators
  if (SPAM_PATTERNS.some(pattern => pattern.test(text))) {
    flags.push('spam_patterns');
    confidence -= 0.3;
    suggestions.push('Please write in a natural tone');
  }

  // Check for repetitive content
  if (/(.)\1{4,}/.test(text)) {
    flags.push('repetitive_content');
    confidence -= 0.2;
    suggestions.push('Please avoid excessive repetition');
  }

  // Check for context appropriateness
  const reviewKeywords = ['haircut', 'cut', 'style', 'barber', 'service', 'appointment', 'experience'];
  const hasReviewContext = reviewKeywords.some(keyword => lowerText.includes(keyword));
  if (!hasReviewContext && text.length > 20) {
    flags.push('off_topic');
    confidence -= 0.1;
    suggestions.push('Please focus on your barber service experience');
  }

  return {
    isAppropriate: confidence > 0.5,
    confidence,
    flags,
    suggestions
  };
}

// Real-time moderation for UI feedback
export function getModerationStatus(text: string): 'clean' | 'flagged' | 'checking' {
  if (!text || text.length === 0) return 'clean';
  
  const validation = validateContent(text);
  return validation.isValid ? 'clean' : 'flagged';
}

// OpenAI Content Moderation API integration (future implementation)
export async function moderateWithOpenAI(text: string): Promise<ModerationResult> {
  // This would be the actual OpenAI integration
  // For now, return the heuristic result
  
  try {
    // Example OpenAI API call (commented out for now)
    /*
    const response = await fetch('https://api.openai.com/v1/moderations', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        input: text,
        model: 'text-moderation-latest'
      })
    });

    const result = await response.json();
    const moderation = result.results[0];

    return {
      isAppropriate: !moderation.flagged,
      confidence: 1 - moderation.category_scores.hate - moderation.category_scores.sexual - moderation.category_scores.violence,
      flags: Object.keys(moderation.categories).filter(key => moderation.categories[key]),
      suggestions: moderation.flagged ? ['Content flagged by AI moderation'] : []
    };
    */

    // Fallback to heuristic moderation
    return await moderateContentWithAI(text);
  } catch (error) {
    logger.error('OpenAI moderation failed, falling back to heuristic', error);
    return await moderateContentWithAI(text);
  }
}

// Content sanitization (removes or replaces inappropriate content)
export function sanitizeContent(text: string): string {
  let sanitized = text;
  
  // Replace explicit words with asterisks
  EXPLICIT_KEYWORDS.forEach(word => {
    const regex = new RegExp(`\\b${word}\\b`, 'gi');
    sanitized = sanitized.replace(regex, '*'.repeat(word.length));
  });
  
  // Remove excessive punctuation
  sanitized = sanitized.replace(/!{3,}/g, '!');
  sanitized = sanitized.replace(/\?{3,}/g, '?');
  sanitized = sanitized.replace(/\.{3,}/g, '...');
  
  // Remove excessive caps
  sanitized = sanitized.replace(/\b[A-Z]{3,}\b/g, (match) => match.toLowerCase());
  
  return sanitized;
} 