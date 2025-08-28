// Yoto Library Integration - Upload stories to "You're The Hero!" card
import iconConfig from '@/config/yoto-icons.json';
import { yotoLogger } from '../utils/logger';
import { YotoAPIError, ConfigurationError, normalizeError } from '../utils/errors';
import { createHash } from 'crypto';
import { promises as fs } from 'fs';
import { join } from 'path';

const YOTO_API_BASE_URL = 'https://api.yotoplay.com';

// Development Yoto hash caching
const HASH_CACHE_DIR = join(process.cwd(), '.next', 'yoto-hash-cache');
const isDevelopment = process.env.NODE_ENV === 'development';

interface CachedTranscode {
  transcodedSha256: string;
  transcodedInfo: {
    duration: number;
    fileSize: number;
    channels: string;
    format: string;
  };
  createdAt: string;
}

/**
 * Generate cache key for story text
 */
function getStoryHashCacheKey(storyText: string): string {
  return createHash('md5').update(storyText.trim()).digest('hex');
}

/**
 * Get cached Yoto transcode hash if exists (development only)
 */
async function getCachedTranscode(cacheKey: string): Promise<CachedTranscode | null> {
  if (!isDevelopment) return null;

  try {
    await fs.mkdir(HASH_CACHE_DIR, { recursive: true });
    const cacheFile = join(HASH_CACHE_DIR, `${cacheKey}.json`);
    const cacheData = await fs.readFile(cacheFile, 'utf-8');
    const cached = JSON.parse(cacheData);
    
    yotoLogger.info('Using cached Yoto transcode hash (saved TTS + upload)', { 
      cacheKey, 
      sha256: cached.transcodedSha256,
      age: new Date().getTime() - new Date(cached.createdAt).getTime()
    });
    
    return cached;
  } catch (error) {
    // Cache miss - file doesn't exist or invalid
    return null;
  }
}

/**
 * Save Yoto transcode hash to cache (development only)
 */
async function cacheTranscode(cacheKey: string, transcodedAudio: any): Promise<void> {
  if (!isDevelopment) return;

  try {
    await fs.mkdir(HASH_CACHE_DIR, { recursive: true });
    const cacheFile = join(HASH_CACHE_DIR, `${cacheKey}.json`);
    
    const cacheData: CachedTranscode = {
      transcodedSha256: transcodedAudio.transcodedSha256,
      transcodedInfo: transcodedAudio.transcodedInfo,
      createdAt: new Date().toISOString()
    };
    
    await fs.writeFile(cacheFile, JSON.stringify(cacheData, null, 2));
    
    yotoLogger.info('Cached Yoto transcode hash for future use', { 
      cacheKey,
      sha256: cacheData.transcodedSha256,
      cacheFile: cacheFile.replace(process.cwd(), '.')
    });
  } catch (error) {
    yotoLogger.warn('Failed to cache Yoto transcode hash', { 
      cacheKey, 
      error: error instanceof Error ? error.message : String(error) 
    });
  }
}

function toTitleCase(str: string): string {
  return str.replace(/\w\S*/g, (txt) => 
    txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase()
  );
}

function getIconForAdventureType(adventureType: string): string | null {
  const config = iconConfig.adventureTypeIcons[adventureType as keyof typeof iconConfig.adventureTypeIcons] || iconConfig.adventureTypeIcons.default;
  const iconUri = config.icon16x16;
  
  // Don't return placeholder values
  if (iconUri.includes('PLACEHOLDER')) {
    yotoLogger.warn('Using placeholder icon for adventure type', { 
      adventureType,
      iconUri,
      message: 'Please update config/yoto-icons.json with actual icon URIs'
    });
    return null;
  }
  
  return iconUri;
}

export interface YotoUploadResult {
  success: boolean;
  cardId?: string;
  error?: string;
  transcodeInfo?: any;
}

export interface StoryMetadata {
  childName: string;
  adventureType: string;
  specialSkill: string;
  title?: string;
}

/**
 * Upload audio file to Yoto and get transcoding information
 */
async function uploadAudioToYoto(audioBuffer: ArrayBuffer, accessToken: string): Promise<{
  success: boolean;
  transcodedAudio?: any;
  error?: string;
}> {
  yotoLogger.info('Starting audio upload to Yoto', { 
    audioSizeBytes: audioBuffer.byteLength,
    audioSizeMB: Math.round((audioBuffer.byteLength / 1024 / 1024) * 100) / 100
  });

  try {
    // Step 1: Get upload URL
    yotoLogger.debug('Requesting upload URL from Yoto API');
    const uploadUrlResponse = await fetch(
      `${YOTO_API_BASE_URL}/media/transcode/audio/uploadUrl`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/json',
        },
      }
    );

    if (!uploadUrlResponse.ok) {
      const errorText = await uploadUrlResponse.text();
      throw new YotoAPIError(`Failed to get upload URL: ${uploadUrlResponse.status}`, {
        status: uploadUrlResponse.status,
        responseBody: errorText
      });
    }

    const {
      upload: { uploadUrl: audioUploadUrl, uploadId },
    } = await uploadUrlResponse.json();

    if (!audioUploadUrl) {
      throw new YotoAPIError('Upload URL not provided in response');
    }

    yotoLogger.info('Upload URL received, uploading audio file', { 
      uploadId,
      audioSizeBytes: audioBuffer.byteLength
    });

    // Step 2: Upload the audio file
    const uploadResponse = await fetch(audioUploadUrl, {
      method: 'PUT',
      body: new Blob([audioBuffer], { type: 'audio/mpeg' }),
      headers: {
        'Content-Type': 'audio/mpeg',
      },
    });

    if (!uploadResponse.ok) {
      throw new YotoAPIError(`Audio upload failed: ${uploadResponse.status}`);
    }

    yotoLogger.info('Audio uploaded successfully, waiting for transcoding', { uploadId });

    // Step 3: Wait for transcoding
    let transcodedAudio = null;
    let attempts = 0;
    const maxAttempts = 60; // 30 seconds max wait

    while (attempts < maxAttempts) {
      const transcodeResponse = await fetch(
        `${YOTO_API_BASE_URL}/media/upload/${uploadId}/transcoded?loudnorm=false`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Accept': 'application/json',
          },
        }
      );

      if (transcodeResponse.ok) {
        const data = await transcodeResponse.json();

        if (data.transcode.transcodedSha256) {
          yotoLogger.info('Audio transcoding completed', { 
            uploadId,
            sha256: data.transcode.transcodedSha256,
            attempts: attempts + 1
          });
          transcodedAudio = data.transcode;
          break;
        }
      }

      await new Promise((resolve) => setTimeout(resolve, 500));
      attempts++;
      
      if (attempts % 10 === 0) { // Log every 5 seconds
        yotoLogger.debug('Still waiting for transcoding', { uploadId, attempts, maxAttempts });
      }
    }

    if (!transcodedAudio) {
      throw new YotoAPIError('Transcoding timed out after 30 seconds', { uploadId, attempts });
    }

    return {
      success: true,
      transcodedAudio
    };

  } catch (error) {
    const normalizedError = normalizeError(error, 'Audio upload to Yoto failed');
    yotoLogger.error('Audio upload to Yoto failed', {
      error: normalizedError.message,
      context: normalizedError.context,
      audioSizeBytes: audioBuffer.byteLength
    });
    return {
      success: false,
      error: normalizedError.message
    };
  }
}

/**
 * Get existing "You're The Hero!" card or return null if it doesn't exist
 */
async function getHeroCard(accessToken: string): Promise<any | null> {
  try {
    yotoLogger.info('Checking for existing "You\'re The Hero!" card');
    
    const response = await fetch(`${YOTO_API_BASE_URL}/content/mine`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new YotoAPIError(`Failed to get user content: ${response.status}`, {
        status: response.status,
        responseBody: errorText
      });
    }

    const data = await response.json();
    yotoLogger.debug('Retrieved user content from Yoto', { 
      cardCount: data.cards?.length || 0 
    });
    
    // Look for existing "You're The Hero!" card
    const HERO_CARD_TITLE = "You're The Hero!";
    const existingCards = data.cards?.filter((card: any) => 
      card.title === HERO_CARD_TITLE
    ) || [];
    
    if (existingCards.length > 0) {
      // If multiple cards exist, use the most recent one
      const mostRecentCard = existingCards.sort((a: any, b: any) => 
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      )[0];
      
      const cardId = mostRecentCard.cardId || mostRecentCard.id;
      yotoLogger.info('Found existing "You\'re The Hero!" card', {
        cardCount: existingCards.length,
        selectedCardId: cardId,
        createdAt: mostRecentCard.createdAt
      });
      
      // Get full card details including chapters
      const fullCardResponse = await fetch(`${YOTO_API_BASE_URL}/content/${cardId}`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/json',
        },
      });
      
      if (fullCardResponse.ok) {
        const fullCardData = await fullCardResponse.json();
        yotoLogger.debug('Full card details retrieved successfully', { cardId });
        // The API returns data nested under 'card' property
        const fullCard = fullCardData.card || fullCardData;
        // Ensure the card has the correct ID field
        if (!fullCard.cardId && !fullCard.id) {
          fullCard.cardId = cardId;
        }
        return fullCard;
      } else {
        yotoLogger.warn('Failed to get full card details, using basic card info', { 
          cardId,
          status: fullCardResponse.status 
        });
        // Ensure the basic card has the correct ID field  
        if (!mostRecentCard.cardId && !mostRecentCard.id) {
          mostRecentCard.cardId = cardId;
        }
        return mostRecentCard;
      }
    }
    
    yotoLogger.info('No existing "You\'re The Hero!" card found');
    return null;

  } catch (error) {
    const normalizedError = normalizeError(error, 'Error checking for existing card');
    yotoLogger.error('Failed to check for existing Hero card', {
      error: normalizedError.message,
      context: normalizedError.context
    });
    return null; // Don't fail the whole process if we can't check
  }
}

/**
 * Create a new chapter from story metadata and transcoded audio
 */
function createChapterFromStory(
  storyMetadata: StoryMetadata,
  transcodedAudio: any,
  chapterNumber: number
): any {
  const mediaInfo = transcodedAudio.transcodedInfo;
  const adventureTypeFormatted = storyMetadata.adventureType.replace(/-/g, ' ');
  const storyTitle = storyMetadata.title || `${storyMetadata.childName}'s ${toTitleCase(adventureTypeFormatted)} Adventure`;
  const titleCaseTitle = toTitleCase(storyTitle);
  
  // Use the provided icon hash for all chapters
  const chapterIcon = 'yoto:#gTMbacpoeSMYqc9fNLJnxPjylraNG6jIrYEWevyzYbA';
  
  return {
    key: chapterNumber.toString().padStart(2, '0'),
    title: titleCaseTitle,
    overlayLabel: chapterNumber.toString(),
    tracks: [
      {
        key: '01',
        title: titleCaseTitle,
        trackUrl: `yoto:#${transcodedAudio.transcodedSha256}`,
        duration: mediaInfo?.duration,
        fileSize: mediaInfo?.fileSize,
        channels: mediaInfo?.channels,
        format: mediaInfo?.format,
        type: 'audio',
        overlayLabel: '1',
      },
    ],
    display: {
      icon16x16: chapterIcon
    }
  };
}

/**
 * Create new "You're The Hero!" card with first story
 */
async function createHeroCard(
  storyMetadata: StoryMetadata,
  transcodedAudio: any,
  accessToken: string
): Promise<YotoUploadResult> {
  try {
    const HERO_CARD_TITLE = "You're The Hero!";
    console.log(`Creating new "${HERO_CARD_TITLE}" card...`);
    
    const mediaInfo = transcodedAudio.transcodedInfo;
    const chapters = [createChapterFromStory(storyMetadata, transcodedAudio, 1)];

    // Simplify payload to match working cards
    const content = {
      title: HERO_CARD_TITLE,  // Always use the constant card title
      content: {
        chapters,
        playbackType: 'linear',
        config: {
          resumeTimeout: 2592000
        }
      },
      metadata: {
        media: {
          duration: mediaInfo?.duration,
          fileSize: mediaInfo?.fileSize,
          readableFileSize: Math.round((mediaInfo?.fileSize / 1024 / 1024) * 10) / 10,
        },
      },
    };

    console.log('Card creation request payload:', JSON.stringify(content, null, 2));

    const createResponse = await fetch(`${YOTO_API_BASE_URL}/content`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(content),
    });

    if (!createResponse.ok) {
      const errorText = await createResponse.text();
      throw new Error(`Failed to create card: ${errorText}`);
    }

    const result = await createResponse.json();
    yotoLogger.info('Card creation successful', { 
      cardId: result.cardId || result.card?.cardId || result.id,
      title: HERO_CARD_TITLE 
    });

    return {
      success: true,
      cardId: result.cardId || result.card?.cardId || result.id, // Handle nested response structure
      transcodeInfo: transcodedAudio
    };

  } catch (error) {
    const normalizedError = normalizeError(error, 'Failed to create Hero card');
    yotoLogger.error('Failed to create Hero card', {
      error: normalizedError.message,
      context: normalizedError.context
    });
    return {
      success: false,
      error: normalizedError.message
    };
  }
}

/**
 * Update existing "You're The Hero!" card with new story chapter
 */
async function updateHeroCard(
  existingCard: any,
  storyMetadata: StoryMetadata,
  transcodedAudio: any,
  accessToken: string
): Promise<YotoUploadResult> {
  try {
    console.log('Updating existing You\'re The Hero! card...');
    
    // Get existing chapters and add new one
    // First get the full card details if we don't have them
    let fullCard = existingCard;
    if (!existingCard.content || !existingCard.content.chapters) {
      const cardId = existingCard.cardId || existingCard.id;
      const fullCardResponse = await fetch(`${YOTO_API_BASE_URL}/content/${cardId}`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/json',
        },
      });
      
      if (fullCardResponse.ok) {
        const fullCardData = await fullCardResponse.json();
        console.log('Full existing card details:', JSON.stringify(fullCardData, null, 2));
        // The API returns data nested under 'card' property
        fullCard = fullCardData.card || fullCardData;
      }
    }
    
    const existingChapters = fullCard.content?.chapters || [];
    const nextChapterNumber = existingChapters.length + 1;
    yotoLogger.info('Adding new chapter to existing card', {
      existingChapterCount: existingChapters.length,
      newChapterNumber: nextChapterNumber
    });
    
    // Create the new chapter
    const newChapter = createChapterFromStory(storyMetadata, transcodedAudio, nextChapterNumber);

    // Clean existing chapters to match working structure
    const cleanExistingChapters = existingChapters.map((chapter: any) => ({
      key: chapter.key,
      title: chapter.title,
      overlayLabel: chapter.overlayLabel,
      tracks: chapter.tracks?.map((track: any) => ({
        key: track.key,
        title: track.title,
        trackUrl: track.trackUrl,
        duration: track.duration,
        fileSize: track.fileSize,
        channels: track.channels,
        format: track.format,
        type: track.type,
        overlayLabel: track.overlayLabel,
      })),
      display: {
        icon16x16: 'yoto:#gTMbacpoeSMYqc9fNLJnxPjylraNG6jIrYEWevyzYbA'
      }
    }));
    
    // Combine ALL chapters - existing + new
    const allChapters = [...cleanExistingChapters, newChapter];

    // Calculate updated metadata based on ALL chapters
    const mediaInfo = transcodedAudio.transcodedInfo;
    const existingDuration = fullCard.metadata?.media?.duration || 0;
    const existingFileSize = fullCard.metadata?.media?.fileSize || 0;
    const newDuration = existingDuration + (mediaInfo?.duration || 0);
    const newFileSize = existingFileSize + (mediaInfo?.fileSize || 0);
    
    // Use the full card if we fetched it, otherwise use the existing card
    const cardToUse = fullCard !== existingCard ? fullCard : existingCard;
    const cardId = cardToUse.cardId || cardToUse.id;
    
    yotoLogger.info('Preparing complete card update', {
      cardId,
      existingChapters: existingChapters.length,
      newChapter: nextChapterNumber,
      totalChapters: allChapters.length,
      newDuration,
      newFileSize
    });
    
    const HERO_CARD_TITLE = "You're The Hero!";
    
    // Complete card payload - ALL existing data + new chapter + updated metadata
    const updatePayload = {
      cardId: cardId,
      title: HERO_CARD_TITLE,
      content: {
        chapters: allChapters  // ALL chapters (existing + new) - removed playbackType and config
      },
      metadata: {
        media: {
          duration: newDuration,
          fileSize: newFileSize,
          readableFileSize: Math.round((newFileSize / 1024 / 1024) * 10) / 10,
        },
      },
    };
    
    yotoLogger.debug('Sending complete card update to Yoto API', {
      cardId,
      payloadSize: JSON.stringify(updatePayload).length,
      chapterCount: allChapters.length
    });
    
    // Log the complete payload for debugging
    console.log('COMPLETE UPDATE PAYLOAD FOR YOTO SUPPORT:');
    console.log(JSON.stringify(updatePayload, null, 2));
    
    const updateResponse = await fetch(`${YOTO_API_BASE_URL}/content`, {
      method: 'POST', // Same endpoint as creation, with cardId to specify update
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(updatePayload),
    });

    if (!updateResponse.ok) {
      const errorText = await updateResponse.text();
      throw new Error(`Failed to update card: ${errorText}`);
    }

    const result = await updateResponse.json();
    console.log('Card update response:', JSON.stringify(result, null, 2));
    console.log(`You're The Hero! card updated with chapter ${nextChapterNumber}`);

    return {
      success: true,
      cardId: result.cardId || result.id,
      transcodeInfo: transcodedAudio
    };

  } catch (error) {
    console.error('Failed to update Hero card:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Main function: Upload story audio to "You're The Hero!" card
 * Creates new card if it doesn't exist, otherwise adds as new chapter
 */
export async function uploadStoryToYoto(
  storyText: string,  // Changed from audioBuffer to storyText for caching
  storyMetadata: StoryMetadata,
  accessToken: string
): Promise<YotoUploadResult> {
  try {
    // Step 1: Check for cached transcode hash (development only)
    const cacheKey = getStoryHashCacheKey(storyText);
    let transcodedAudio = await getCachedTranscode(cacheKey);
    
    if (!transcodedAudio) {
      // Cache miss - need to generate audio and upload/transcode
      yotoLogger.info('Cache miss - generating audio and uploading to Yoto', { cacheKey });
      
      // Generate audio from text
      const { generateAudio, getRandomVoiceId } = await import('../tts/elevenlabs');
      const voiceId = getRandomVoiceId();
      
      if (!voiceId) {
        return {
          success: false,
          error: 'No voices configured for audio generation'
        };
      }
      
      const audioResult = await generateAudio(storyText, voiceId);
      if (!audioResult.success || !audioResult.audioBuffer) {
        return {
          success: false,
          error: audioResult.error || 'Audio generation failed'
        };
      }
      
      // Upload and transcode audio to Yoto
      const uploadResult = await uploadAudioToYoto(audioResult.audioBuffer, accessToken);
      if (!uploadResult.success) {
        return uploadResult;
      }
      
      transcodedAudio = uploadResult.transcodedAudio;
      
      // Cache the transcode result for future use
      await cacheTranscode(cacheKey, transcodedAudio);
    }

    // Step 2: Check for existing "You're The Hero!" card
    const existingCard = await getHeroCard(accessToken);

    // Step 3: Create new card or update existing one
    if (existingCard) {
      return await updateHeroCard(existingCard, storyMetadata, transcodedAudio, accessToken);
    } else {
      return await createHeroCard(storyMetadata, transcodedAudio, accessToken);
    }

  } catch (error) {
    const normalizedError = normalizeError(error, 'uploadStoryToYoto failed');
    yotoLogger.error('uploadStoryToYoto failed', {
      error: normalizedError.message,
      context: normalizedError.context
    });
    return {
      success: false,
      error: normalizedError.message
    };
  }
}