// ElevenLabs Text-to-Speech integration for story narration
import { ttsLogger } from '../utils/logger';
import { ElevenLabsError, ConfigurationError, ValidationError } from '../utils/errors';
import { createHash } from 'crypto';
import { promises as fs } from 'fs';
import { join } from 'path';

export interface TTSResult {
  success: boolean;
  audioBuffer?: ArrayBuffer;
  error?: string;
  fromCache?: boolean;
}

// Remove audio caching - we'll cache Yoto SHA256 hashes instead

/**
 * Generate audio from text using ElevenLabs TTS
 */
export async function generateAudio(text: string, voiceId: string): Promise<TTSResult> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  
  if (!apiKey) {
    const error = new ConfigurationError('ElevenLabs API key not configured');
    ttsLogger.error('TTS generation failed: missing API key');
    return {
      success: false,
      error: error.userMessage
    };
  }

  if (!validateTextLength(text)) {
    const error = new ValidationError('Text length invalid for TTS generation');
    ttsLogger.warn('TTS generation failed: invalid text length', { 
      textLength: text?.length || 0,
      wordCount: text?.split(/\s+/).length || 0
    });
    return {
      success: false,
      error: error.message
    };
  }

  ttsLogger.info('Starting TTS generation', {
    voiceId,
    textLength: text.length,
    wordCount: text.split(/\s+/).length
  });

  try {
    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
      method: 'POST',
      headers: {
        'xi-api-key': apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        text: text,
        model_id: 'eleven_monolingual_v1', // Good quality model for English
        voice_settings: {
          stability: 0.7,        // Balanced stability for storytelling
          similarity_boost: 0.8, // High similarity to voice
          style: 0.3,           // Moderate style for child-friendly narration
          use_speaker_boost: true // Enhance voice clarity
        }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      const error = new ElevenLabsError(`TTS API error: ${response.status} ${response.statusText}`, {
        status: response.status,
        voiceId,
        responseBody: errorText
      });
      ttsLogger.error('TTS generation failed: API error', {
        status: response.status,
        statusText: response.statusText,
        voiceId,
        error: errorText
      });
      return {
        success: false,
        error: error.userMessage
      };
    }

    const audioBuffer = await response.arrayBuffer();
    
    ttsLogger.info('TTS generation completed successfully', {
      voiceId,
      audioSizeBytes: audioBuffer.byteLength,
      audioSizeMB: Math.round((audioBuffer.byteLength / 1024 / 1024) * 100) / 100
    });
    
    return {
      success: true,
      audioBuffer,
      fromCache: false
    };

  } catch (error) {
    const elevenlabsError = new ElevenLabsError(
      error instanceof Error ? error.message : 'Unknown TTS error', 
      { voiceId, originalError: error }
    );
    ttsLogger.error('TTS generation failed: unexpected error', {
      voiceId,
      error: elevenlabsError.message,
      context: elevenlabsError.context
    });
    return {
      success: false,
      error: elevenlabsError.userMessage
    };
  }
}

/**
 * Get list of available voices from environment configuration
 */
export function getAvailableVoices(): string[] {
  const voiceIds = process.env.ELEVENLABS_VOICE_IDS;
  if (!voiceIds) {
    return [];
  }
  return voiceIds.split(',').map(id => id.trim()).filter(id => id.length > 0);
}

/**
 * Validate text length is appropriate for audio generation
 * Only enforce maximum length to prevent excessively long audio files
 */
export function validateTextLength(text: string): boolean {
  if (!text || typeof text !== 'string') {
    return false;
  }

  const words = text.trim().split(/\s+/).filter(word => word.length > 0);
  const wordCount = words.length;

  // Allow any text with 1+ words, up to 1000 words (reasonable maximum)
  return wordCount >= 1 && wordCount <= 1000;
}

/**
 * Get the default voice ID (first available voice)
 */
export function getDefaultVoiceId(): string | null {
  const voices = getAvailableVoices();
  return voices.length > 0 ? voices[0] : null;
}

/**
 * Validate if a voice ID is available in configuration
 */
export function isValidVoiceId(voiceId: string): boolean {
  return getAvailableVoices().includes(voiceId);
}

/**
 * Get a random voice ID from available voices
 */
export function getRandomVoiceId(): string | null {
  const voices = getAvailableVoices();
  if (voices.length === 0) {
    return null;
  }
  const randomIndex = Math.floor(Math.random() * voices.length);
  return voices[randomIndex];
}