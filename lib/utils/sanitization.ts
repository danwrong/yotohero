// Common inappropriate terms to block in child content
const BLOCKED_TERMS = [
  // Add terms here as needed - keeping minimal for family-friendly stories
  'inappropriate',
  'violent',
  'scary',
  'adult'
];

// Common injection patterns to detect
const INJECTION_PATTERNS = [
  /<script[^>]*>.*?<\/script>/gi,
  /javascript:/gi,
  /on\w+\s*=/gi,
  /data:text\/html/gi,
  /vbscript:/gi,
];

/**
 * Sanitizes user input by removing potentially dangerous characters and patterns
 */
export function sanitizeInput(input: string): string {
  if (!input || typeof input !== 'string') {
    return '';
  }

  let sanitized = input;

  // Remove script tags and other injection patterns
  INJECTION_PATTERNS.forEach(pattern => {
    sanitized = sanitized.replace(pattern, '');
  });

  // Remove potentially dangerous HTML tags
  sanitized = sanitized.replace(/<[^>]*>/g, '');

  // Remove SQL injection attempts while preserving spaces
  // Remove SQL comments
  sanitized = sanitized.replace(/(--|\/\*|\*\/)/g, '');
  
  // For form inputs, we want to preserve apostrophes (for names like O'Connor)
  // but remove semicolons and quotes that could be used for injection
  sanitized = sanitized.replace(/[";]/g, '');

  // Normalize multiple spaces to single space (but keep single spaces)
  sanitized = sanitized.replace(/\s{2,}/g, ' ');

  return sanitized;
}

/**
 * Validates that a child's name contains only appropriate characters
 */
export function validateChildName(name: string): boolean {
  if (!name || typeof name !== 'string') {
    return false;
  }

  const sanitized = sanitizeInput(name);
  
  // Must be between 2 and 20 characters
  if (sanitized.length < 2 || sanitized.length > 20) {
    return false;
  }

  // Should only contain letters, spaces, hyphens, and apostrophes
  const namePattern = /^[a-zA-Z\s\-']+$/;
  if (!namePattern.test(sanitized)) {
    return false;
  }

  // Check against blocked terms
  if (checkBlocklist(sanitized)) {
    return false;
  }

  return true;
}

/**
 * Checks if text contains inappropriate terms for children's content
 */
export function checkBlocklist(text: string): boolean {
  if (!text || typeof text !== 'string') {
    return false;
  }

  const lowercaseText = text.toLowerCase();
  
  return BLOCKED_TERMS.some(term => 
    lowercaseText.includes(term.toLowerCase())
  );
}

/**
 * Validates story content for appropriateness and length
 */
export function validateStoryContent(story: string): boolean {
  if (!story || typeof story !== 'string') {
    return false;
  }

  const sanitized = sanitizeInput(story);
  
  // Story should be between 100 and 1000 words for reasonable length
  const wordCount = sanitized.split(/\s+/).filter(word => word.length > 0).length;
  if (wordCount < 100 || wordCount > 1000) {
    return false;
  }

  // Check for inappropriate content
  if (checkBlocklist(sanitized)) {
    return false;
  }

  return true;
}

/**
 * Validates adventure type selection
 */
export function validateAdventureType(adventureType: string): boolean {
  const validTypes = [
    'magical-forest',
    'space-adventure',
    'underwater-journey',
    'fairy-tale-castle',
    'animal-safari',
    'pirate-treasure',
    'superhero-city',
    'time-travel'
  ];

  return validTypes.includes(adventureType);
}

/**
 * Validates special skill input
 */
export function validateSpecialSkill(skill: string): boolean {
  if (!skill || typeof skill !== 'string') {
    return true; // Optional field
  }

  const sanitized = sanitizeInput(skill);
  
  // Should be reasonable length
  if (sanitized.length > 50) {
    return false;
  }

  // Check for inappropriate content
  if (checkBlocklist(sanitized)) {
    return false;
  }

  return true;
}

/**
 * Validates story setting input
 */
export function validateStorySetting(setting: string): boolean {
  if (!setting || typeof setting !== 'string') {
    return true; // Optional field
  }

  const sanitized = sanitizeInput(setting);
  
  // Should be reasonable length
  if (sanitized.length > 100) {
    return false;
  }

  // Check for inappropriate content
  if (checkBlocklist(sanitized)) {
    return false;
  }

  return true;
}