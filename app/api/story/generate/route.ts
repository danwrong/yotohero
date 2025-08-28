import { NextRequest, NextResponse } from 'next/server';
import { generateStory } from '@/lib/ai/story-generator';
import { sanitizeInput, validateChildName, validateAdventureType, validateSpecialSkill, validateStorySetting } from '@/lib/utils/sanitization';

interface StoryRequest {
  childName: string;
  adventureType: string;
  specialSkill?: string;
  storySetting?: string;
}

export async function POST(request: NextRequest) {
  try {
    console.log('Story generation API called');
    
    const body: StoryRequest = await request.json();
    console.log('Story request received:', {
      ...body,
      childName: body.childName ? body.childName.substring(0, 5) + '...' : 'MISSING'
    });

    // Validate required fields
    if (!body.childName || !body.adventureType) {
      return NextResponse.json(
        { error: 'Child name and adventure type are required' },
        { status: 400 }
      );
    }

    // Sanitize all inputs
    const sanitizedRequest: StoryRequest = {
      childName: sanitizeInput(body.childName),
      adventureType: sanitizeInput(body.adventureType),
      specialSkill: body.specialSkill ? sanitizeInput(body.specialSkill) : undefined,
      storySetting: body.storySetting ? sanitizeInput(body.storySetting) : undefined,
    };

    console.log('Inputs sanitized successfully');

    // Validate sanitized inputs
    if (!validateChildName(sanitizedRequest.childName)) {
      return NextResponse.json(
        { error: 'Invalid child name. Please use only letters, spaces, hyphens, and apostrophes (2-20 characters).' },
        { status: 400 }
      );
    }

    if (!validateAdventureType(sanitizedRequest.adventureType)) {
      return NextResponse.json(
        { error: 'Invalid adventure type selected.' },
        { status: 400 }
      );
    }

    if (sanitizedRequest.specialSkill && !validateSpecialSkill(sanitizedRequest.specialSkill)) {
      return NextResponse.json(
        { error: 'Special skill contains inappropriate content or is too long.' },
        { status: 400 }
      );
    }

    if (sanitizedRequest.storySetting && !validateStorySetting(sanitizedRequest.storySetting)) {
      return NextResponse.json(
        { error: 'Story setting contains inappropriate content or is too long.' },
        { status: 400 }
      );
    }

    console.log('Input validation passed, generating story...');

    // Generate the story
    const storyResponse = await generateStory(sanitizedRequest);

    console.log('Story generated successfully:', {
      wordCount: storyResponse.wordCount,
      safetyValid: storyResponse.safetyCheck.isValid,
      issues: storyResponse.safetyCheck.issues
    });

    // If story fails safety check, return error
    if (!storyResponse.safetyCheck.isValid) {
      console.error('Generated story failed safety validation:', storyResponse.safetyCheck.issues);
      return NextResponse.json(
        { 
          error: 'Generated story did not meet safety requirements. Please try again.',
          details: storyResponse.safetyCheck.issues
        },
        { status: 422 }
      );
    }

    // Return successful story
    return NextResponse.json({
      success: true,
      story: storyResponse.story,
      wordCount: storyResponse.wordCount,
      metadata: storyResponse.metadata
    });

  } catch (error) {
    console.error('Story generation API error:', error);
    
    // Return appropriate error based on the type
    if (error instanceof Error) {
      if (error.message.includes('API key')) {
        return NextResponse.json(
          { error: 'Story generation service is not configured properly. Please check your API keys.' },
          { status: 503 }
        );
      }
      
      if (error.message.includes('API error') || error.message.includes('insufficient permissions')) {
        return NextResponse.json(
          { error: 'Story generation service is temporarily unavailable. Please check your API permissions.' },
          { status: 503 }
        );
      }
      
      if (error.message.includes('safety validation')) {
        return NextResponse.json(
          { error: 'Unable to generate appropriate content with the provided inputs. Please try different adventure details.' },
          { status: 422 }
        );
      }
    }

    return NextResponse.json(
      { error: 'Failed to generate story. Please try again later.' },
      { status: 500 }
    );
  }
}