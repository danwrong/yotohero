// Enhanced safety utilities for story content validation
import { profanity } from '@2toad/profanity';
import { readFileSync } from 'fs';
import { join } from 'path';
import { safetyLogger } from './logger';
import { OpenAIError, ConfigurationError, ContentSafetyError, normalizeError } from './errors';

// AI-powered content suitability rating threshold (1-10 scale)
const SUITABILITY_THRESHOLD = 7;

// Load the content safety prompt template
function loadContentSafetyPrompt(): string {
  try {
    const promptPath = join(process.cwd(), 'prompts', 'content-safety-check.md');
    return readFileSync(promptPath, 'utf-8');
  } catch (error) {
    safetyLogger.warn('Failed to load content safety prompt file, using fallback', { 
      error: error instanceof Error ? error.message : String(error),
      promptPath: join(process.cwd(), 'prompts', 'content-safety-check.md')
    });
    // Fallback to inline prompt if file can't be loaded
    return `You are a content moderator for children's stories. Rate the following story content for suitability for children ages 5-13 on a scale of 1-10, where:

1-3: Completely inappropriate (violence, adult themes, scary content, profanity)
4-6: Questionable content (mild adult themes, slightly scary, complex topics)
7-8: Generally appropriate with minor concerns
9-10: Perfectly suitable for young children

Story content to evaluate:
---
{{STORY_CONTENT}}
---

Respond with a JSON object in this exact format:
{
  "score": [number from 1-10],
  "reasoning": "[brief explanation of why you gave this score]",
  "concerns": "[any specific concerns, or 'none' if no concerns]"
}`;
  }
}

// Common injection patterns to detect
const INJECTION_PATTERNS = [
  /<script[^>]*>.*?<\/script>/gi,
  /javascript:/gi,
  /on\w+\s*=/gi,
  /data:text\/html/gi,
  /vbscript:/gi,
  /expression\s*\(/gi,
  /url\s*\(/gi,
];

// SQL injection patterns
const SQL_PATTERNS = [
  /(['";]|--|\*|\/\*|\*\/)/g,
  /(union|select|insert|update|delete|drop|create|alter|exec|execute)/gi,
  /(script|iframe|object|embed|form)/gi,
];

/**
 * Enhanced sanitization for user input
 */
export function sanitizeInput(input: string): string {
  if (!input || typeof input !== 'string') {
    return '';
  }

  let sanitized = input.trim();

  // Remove script tags and other injection patterns
  INJECTION_PATTERNS.forEach(pattern => {
    sanitized = sanitized.replace(pattern, '');
  });

  // Remove SQL injection attempts
  SQL_PATTERNS.forEach(pattern => {
    sanitized = sanitized.replace(pattern, '');
  });

  // Remove potentially dangerous HTML tags
  sanitized = sanitized.replace(/<[^>]*>/g, '');

  // Normalize whitespace
  sanitized = sanitized.replace(/\s+/g, ' ').trim();

  return sanitized;
}

/**
 * Uses OpenAI to rate content suitability for children ages 5-13
 */
async function rateContentSuitability(content: string): Promise<{
  score: number;
  reasoning: string;
  isAppropriate: boolean;
}> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new ConfigurationError('OpenAI API key not configured for content moderation');
  }

  // Load the prompt template and replace the placeholder with actual content
  const promptTemplate = loadContentSafetyPrompt();
  const moderationPrompt = promptTemplate.replace('{{STORY_CONTENT}}', content);

  safetyLogger.debug('Starting AI content moderation', { 
    contentLength: content.length,
    wordCount: content.split(/\s+/).length 
  });

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{
          role: 'user',
          content: moderationPrompt
        }],
        max_tokens: 200,
        temperature: 0.1, // Low temperature for consistent scoring
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new OpenAIError(`Content moderation failed: ${response.status} ${response.statusText}`, {
        status: response.status,
        responseBody: errorText
      });
    }

    const data = await response.json();
    const responseText = data.choices[0]?.message?.content || '';
    
    // Parse the JSON response
    const result = JSON.parse(responseText);
    const isAppropriate = result.score >= SUITABILITY_THRESHOLD;
    
    safetyLogger.info('AI content moderation completed', {
      score: result.score,
      isAppropriate,
      reasoning: result.reasoning
    });
    
    return {
      score: result.score,
      reasoning: result.reasoning + (result.concerns !== 'none' ? ` Concerns: ${result.concerns}` : ''),
      isAppropriate
    };

  } catch (error) {
    const normalizedError = normalizeError(error, 'Content moderation service error');
    safetyLogger.error('Content suitability rating failed', { 
      error: normalizedError.message,
      context: normalizedError.context 
    });
    
    // Fallback: if AI moderation fails, be conservative and reject
    return {
      score: 1,
      reasoning: 'Unable to verify content safety due to moderation service error',
      isAppropriate: false
    };
  }
}

/**
 * Checks for profanity using the @2toad/profanity library
 */
export function checkProfanity(text: string): boolean {
  if (!text || typeof text !== 'string') {
    return false;
  }
  return profanity.exists(text);
}


/**
 * Validates story length - now just checks that story exists
 * Word count limits removed - we trust the AI to generate appropriate length
 */
export function validateStoryLength(story: string): boolean {
  if (!story || typeof story !== 'string') {
    return false;
  }

  // Just check that we have some content (at least 100 words for a story)
  const words = story.trim().split(/\s+/).filter(word => word.length > 0);
  const wordCount = words.length;

  // Minimal check - just ensure we have a story, not a sentence
  return wordCount >= 100;
}

/**
 * Validates complete story content for appropriateness and length
 */
export function validateStoryContent(story: string): boolean {
  if (!story || typeof story !== 'string') {
    return false;
  }

  const sanitized = sanitizeInput(story);
  
  // Check length
  if (!validateStoryLength(sanitized)) {
    return false;
  }

  // Check for inappropriate content
  if (checkProfanity(sanitized)) {
    return false;
  }

  return true;
}

/**
 * AI-powered comprehensive content safety check
 */
export async function validateContentSafetyWithAI(content: string): Promise<{
  isValid: boolean;
  issues: string[];
  wordCount: number;
  aiRating?: {
    score: number;
    reasoning: string;
  };
}> {
  safetyLogger.debug('Starting comprehensive content safety validation', { 
    contentLength: content?.length || 0 
  });

  const issues: string[] = [];
  let wordCount = 0;

  if (!content || typeof content !== 'string') {
    const error = 'Content is empty or invalid';
    issues.push(error);
    safetyLogger.warn('Content validation failed: empty input');
    return { isValid: false, issues, wordCount };
  }

  const sanitized = sanitizeInput(content);
  const words = sanitized.trim().split(/\s+/).filter(word => word.length > 0);
  wordCount = words.length;

  // Check word count - just ensure we have a real story
  if (wordCount < 100) {
    const issue = `Story too short: ${wordCount} words (minimum 100 for a real story)`;
    issues.push(issue);
    safetyLogger.info('Content validation: story too short', { wordCount });
  }
  // No maximum limit - we trust the AI to generate appropriate length

  // Check for profanity using @2toad/profanity library
  if (checkProfanity(sanitized)) {
    const issue = 'Contains inappropriate language';
    issues.push(issue);
    safetyLogger.warn('Content validation: profanity detected');
  }

  // Use AI-powered content moderation for nuanced safety check
  let aiRating;
  try {
    aiRating = await rateContentSuitability(sanitized);
    
    if (!aiRating.isAppropriate) {
      const issue = `Content not suitable for children ages 5-13 (AI Score: ${aiRating.score}/10). ${aiRating.reasoning}`;
      issues.push(issue);
      safetyLogger.warn('Content validation: AI moderation failed', {
        score: aiRating.score,
        reasoning: aiRating.reasoning
      });
    }
  } catch (error) {
    const normalizedError = normalizeError(error, 'AI content moderation failed');
    const issue = 'Unable to verify content safety - please review manually';
    issues.push(issue);
    safetyLogger.error('AI content moderation error during validation', {
      error: normalizedError.message,
      context: normalizedError.context
    });
  }

  const isValid = issues.length === 0;
  safetyLogger.info('Content safety validation completed', {
    isValid,
    wordCount,
    issueCount: issues.length,
    aiScore: aiRating?.score
  });

  return {
    isValid,
    issues,
    wordCount,
    aiRating: aiRating ? { score: aiRating.score, reasoning: aiRating.reasoning } : undefined
  };
}

/**
 * Legacy validation function for backward compatibility (uses basic checks only)
 */
export function validateContentSafety(content: string): {
  isValid: boolean;
  issues: string[];
  wordCount: number;
} {
  const issues: string[] = [];
  let wordCount = 0;

  if (!content || typeof content !== 'string') {
    issues.push('Content is empty or invalid');
    return { isValid: false, issues, wordCount };
  }

  const sanitized = sanitizeInput(content);
  const words = sanitized.trim().split(/\s+/).filter(word => word.length > 0);
  wordCount = words.length;

  // Check word count - just ensure we have a real story
  if (wordCount < 100) {
    issues.push(`Story too short: ${wordCount} words (minimum 100 for a real story)`);
  }
  // No maximum limit - we trust the AI to generate appropriate length

  // Check for inappropriate content using profanity library
  if (checkProfanity(sanitized)) {
    issues.push('Contains inappropriate terms for children');
  }

  return {
    isValid: issues.length === 0,
    issues,
    wordCount
  };
}