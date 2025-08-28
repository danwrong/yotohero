import fs from 'fs';
import path from 'path';
import { validateContentSafetyWithAI } from '@/lib/utils/safety';

interface StoryRequest {
  childName: string;
  adventureType: string;
  specialSkill?: string;
  storySetting?: string;
}

interface StoryResponse {
  story: string;
  wordCount: number;
  safetyCheck: {
    isValid: boolean;
    issues: string[];
  };
  metadata: {
    childName: string;
    adventureType: string;
    specialSkill?: string;
    storySetting?: string;
    generatedAt: string;
  };
}

/**
 * Loads the story prompt template from the markdown file
 */
function loadPromptTemplate(): string {
  const templatePath = path.join(process.cwd(), 'prompts', 'story-template.md');
  return fs.readFileSync(templatePath, 'utf-8');
}

/**
 * Replaces template variables with actual values
 */
function buildPrompt(request: StoryRequest): string {
  let template = loadPromptTemplate();
  
  // Replace template variables
  template = template.replace(/\{\{childName\}\}/g, request.childName);
  template = template.replace(/\{\{adventureType\}\}/g, request.adventureType);
  template = template.replace(/\{\{specialSkill\}\}/g, request.specialSkill || 'being helpful and kind');
  template = template.replace(/\{\{storySetting\}\}/g, request.storySetting || 'a magical place perfect for adventure');
  
  return template;
}

/**
 * Calls OpenAI API to generate story
 */
async function generateWithOpenAI(prompt: string): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OpenAI API key not configured');
  }

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are a professional children\'s story writer. Follow the instructions exactly and create safe, appropriate content for ages 5-13.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      max_tokens: 800,
      temperature: 0.7,
      presence_penalty: 0.1,
      frequency_penalty: 0.1,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`OpenAI API error: ${error.error?.message || 'Unknown error'}`);
  }

  const data = await response.json();
  return data.choices[0]?.message?.content || '';
}

/**
 * Calls Anthropic Claude API to generate story
 */
async function generateWithClaude(prompt: string): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('Anthropic API key not configured');
  }

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-3-haiku-20240307',
      max_tokens: 800,
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ],
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Claude API error: ${error.error?.message || 'Unknown error'}`);
  }

  const data = await response.json();
  return data.content[0]?.text || '';
}

/**
 * Generates a story using the configured AI provider
 */
async function generateStoryContent(request: StoryRequest): Promise<string> {
  const prompt = buildPrompt(request);
  
  console.log('Generated prompt for story creation:', {
    childName: request.childName,
    adventureType: request.adventureType,
    promptLength: prompt.length
  });

  // Try OpenAI first, then Claude as fallback
  try {
    if (process.env.OPENAI_API_KEY) {
      console.log('Using OpenAI for story generation');
      return await generateWithOpenAI(prompt);
    } else if (process.env.ANTHROPIC_API_KEY) {
      console.log('Using Claude for story generation');
      return await generateWithClaude(prompt);
    } else {
      throw new Error('No AI API key configured. Please set OPENAI_API_KEY or ANTHROPIC_API_KEY');
    }
  } catch (error) {
    console.error('Primary AI provider failed:', error);
    
    // Try fallback provider if available
    try {
      if (process.env.ANTHROPIC_API_KEY && !process.env.OPENAI_API_KEY) {
        console.log('Trying Claude as fallback');
        return await generateWithClaude(prompt);
      } else if (process.env.OPENAI_API_KEY && !process.env.ANTHROPIC_API_KEY) {
        console.log('Trying OpenAI as fallback');
        return await generateWithOpenAI(prompt);
      }
    } catch (fallbackError) {
      console.error('Fallback AI provider also failed:', fallbackError);
    }
    
    throw error;
  }
}

/**
 * Generates a mock story for testing purposes only
 * This should NOT be used in production - only for tests
 */
export function generateMockStory(request: StoryRequest): string {
  const { childName, adventureType, specialSkill = 'being kind and helpful' } = request;
  
  const adventureDescriptions = {
    'magical-forest': 'enchanted woodland filled with talking animals',
    'space-adventure': 'journey through colorful planets and friendly aliens',
    'underwater-journey': 'ocean adventure with sea creatures and coral cities',
    'fairy-tale-castle': 'magical castle with helpful wizards and floating objects',
    'animal-safari': 'wildlife adventure meeting gentle animals',
    'pirate-treasure': 'treasure hunt with friendly pirates and maps',
    'superhero-city': 'city where heroes help others and solve problems',
    'time-travel': 'journey through time meeting historical figures'
  } as const;

  const setting = adventureDescriptions[adventureType as keyof typeof adventureDescriptions] || 'magical place';

  return `${childName} woke up one sunny morning feeling excited about the day ahead. Little did she know that today would bring the most amazing adventure of her life! As she stepped outside, a shimmering portal appeared before her, leading to a wonderful ${setting}.

With her special gift of ${specialSkill}, ${childName} bravely stepped through the magical doorway. The world on the other side was more beautiful than anything she had ever imagined. Colorful butterflies danced through the air, and gentle melodies filled the atmosphere with joy and wonder.

Soon, ${childName} met a friendly companion who needed her help. Using her incredible ability of ${specialSkill}, she was able to solve the problem in a creative and kind way that made everyone happy. Her new friend was so grateful and showed her the most amazing secrets of this magical place.

Together, they embarked on a peaceful quest to help other creatures in need. ${childName}'s ${specialSkill} proved to be exactly what was needed to bring harmony and happiness to everyone they met. She learned valuable lessons about friendship, kindness, and believing in herself.

As the day drew to a close, ${childName} realized it was time to return home. Her new friends thanked her with a celebration filled with music, laughter, and joy. They promised that she could return anytime she wanted to visit this special place.

With a heart full of happy memories and new confidence in her abilities, ${childName} stepped back through the portal to her own world. She knew that whenever she needed to remember how special and capable she was, she could think back to this wonderful adventure.

From that day forward, ${childName} approached each day with excitement and kindness, knowing that her gift of ${specialSkill} could always help make the world a better place. The magical adventure had taught her that being helpful and caring was the greatest superpower of all.

The End.`;
}

/**
 * Main story generation function with safety validation
 */
export async function generateStory(request: StoryRequest): Promise<StoryResponse> {
  console.log('Starting story generation for:', request.childName);
  
  try {
    // Generate the story content using AI
    const storyContent = await generateStoryContent(request);
    
    if (!storyContent || storyContent.trim().length === 0) {
      throw new Error('AI generated empty story content');
    }

    // Validate safety and content using AI-powered moderation
    const safetyCheck = await validateContentSafetyWithAI(storyContent);
    
    console.log('Story safety validation:', {
      isValid: safetyCheck.isValid,
      wordCount: safetyCheck.wordCount,
      issues: safetyCheck.issues,
      aiRating: safetyCheck.aiRating
    });

    // If story fails safety check, throw an error with details
    if (!safetyCheck.isValid) {
      console.warn('Generated story failed safety validation:', safetyCheck.issues);
      throw new Error(`Generated story failed safety validation: ${safetyCheck.issues.join(', ')}`);
    }

    return {
      story: storyContent.trim(),
      wordCount: safetyCheck.wordCount,
      safetyCheck: {
        isValid: safetyCheck.isValid,
        issues: safetyCheck.issues
      },
      metadata: {
        childName: request.childName,
        adventureType: request.adventureType,
        specialSkill: request.specialSkill,
        storySetting: request.storySetting,
        generatedAt: new Date().toISOString()
      }
    };

  } catch (error) {
    console.error('Story generation failed:', error);
    throw new Error(`Failed to generate story: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}