import { NextRequest, NextResponse } from 'next/server';
import { generateAudio, getRandomVoiceId } from '@/lib/tts/elevenlabs';
import { uploadStoryToYoto } from '@/lib/yoto/library';
import { ensureValidToken } from '@/lib/auth/yoto';
import { apiLogger } from '@/lib/utils/logger';
import { AuthenticationError, ValidationError, isAppError, normalizeError } from '@/lib/utils/errors';

export async function POST(request: NextRequest) {
  const requestId = Math.random().toString(36).substr(2, 9);
  apiLogger.info('Send to Yoto workflow started', { requestId });

  try {
    // Get the authorization header for Yoto
    const authHeader = request.headers.get('authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      const error = new AuthenticationError('Authorization header missing or invalid');
      apiLogger.warn('Send to Yoto: Authentication failed', { requestId });
      return NextResponse.json(
        { error: error.userMessage },
        { status: error.statusCode }
      );
    }

    // Parse the complete token data (should include refresh_token)
    let tokenData;
    try {
      const tokenString = authHeader.substring(7); // Remove 'Bearer ' prefix
      tokenData = JSON.parse(tokenString);
    } catch (error) {
      // Fallback: treat as simple access token string
      tokenData = { access_token: authHeader.substring(7) };
    }

    apiLogger.debug('Token data received', { 
      requestId,
      hasAccessToken: !!tokenData.access_token,
      hasRefreshToken: !!tokenData.refresh_token
    });

    // Ensure we have a valid access token (automatically refresh if needed)
    const validAccessToken = await ensureValidToken(tokenData);
    
    const body = await request.json();
    const { story, storyMetadata, voiceId } = body;

    // Validate required fields
    if (!story || typeof story !== 'string') {
      const error = new ValidationError('story text is required');
      apiLogger.warn('Send to Yoto: Missing story text', { requestId });
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode }
      );
    }

    if (!storyMetadata || !storyMetadata.childName || !storyMetadata.adventureType) {
      const error = new ValidationError('storyMetadata with childName and adventureType is required');
      apiLogger.warn('Send to Yoto: Missing story metadata', { requestId, storyMetadata });
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode }
      );
    }

    // Select voice: use provided voiceId or random selection
    const selectedVoiceId = voiceId || getRandomVoiceId();
    
    if (!selectedVoiceId) {
      const error = new ValidationError('No voices configured in ELEVENLABS_VOICE_IDS');
      apiLogger.error('Send to Yoto: No voices configured', { requestId });
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    apiLogger.info('Send to Yoto workflow parameters validated', {
      requestId,
      storyLength: story.length,
      childName: storyMetadata.childName,
      adventureType: storyMetadata.adventureType,
      voiceId: selectedVoiceId
    });

    // Step 1: Upload to Yoto "You're The Hero!" card (handles TTS generation + caching internally)
    apiLogger.info('Uploading story to Yoto library (with smart caching)', { requestId });
    const yotoResult = await uploadStoryToYoto(story, storyMetadata, validAccessToken);

    if (!yotoResult.success) {
      apiLogger.error('Yoto upload failed', { requestId, error: yotoResult.error });
      return NextResponse.json(
        { error: `Yoto upload failed: ${yotoResult.error}` },
        { status: 500 }
      );
    }

    apiLogger.info('Send to Yoto workflow completed successfully', { 
      requestId, 
      cardId: yotoResult.cardId 
    });

    // Return success response
    return NextResponse.json({
      success: true,
      message: 'Story added to your Yoto library successfully!',
      story: {
        title: storyMetadata.title || `${storyMetadata.childName}'s ${storyMetadata.adventureType.replace('-', ' ')} Adventure`,
        wordCount: story.trim().split(/\s+/).length,
      },
      audio: {
        duration: yotoResult.transcodeInfo?.transcodedInfo?.duration || 0,
        fileSize: yotoResult.transcodeInfo?.transcodedInfo?.fileSize || 0,
        readableFileSize: Math.round(((yotoResult.transcodeInfo?.transcodedInfo?.fileSize || 0) / 1024 / 1024) * 10) / 10,
      },
      yoto: {
        cardId: yotoResult.cardId,
        cardTitle: "You're The Hero!",
        message: 'Added to your Yoto library - check your Yoto app!'
      }
    });

  } catch (error) {
    const normalizedError = normalizeError(error, 'Send to Yoto workflow error');
    apiLogger.error('Send to Yoto workflow failed with unexpected error', {
      requestId,
      error: normalizedError.message,
      context: normalizedError.context
    });

    // Return appropriate error response based on error type
    if (isAppError(normalizedError)) {
      return NextResponse.json(
        { error: normalizedError.userMessage },
        { status: normalizedError.statusCode }
      );
    }

    // Fallback for unexpected errors
    return NextResponse.json(
      { error: 'An unexpected error occurred during the workflow' },
      { status: 500 }
    );
  }
}