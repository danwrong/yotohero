import { NextRequest, NextResponse } from 'next/server';
import { generateAudio, getDefaultVoiceId, isValidVoiceId, validateTextLength } from '@/lib/tts/elevenlabs';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { text, voiceId } = body;

    // Validate required fields
    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      return NextResponse.json(
        { error: 'Text content is required for audio generation' },
        { status: 400 }
      );
    }

    // Validate text length (only enforce reasonable maximum)
    if (!validateTextLength(text)) {
      const wordCount = text.trim().split(/\s+/).length;
      return NextResponse.json(
        { 
          error: `Text too long for audio generation. Current: ${wordCount} words. Maximum: 1000 words allowed.`
        },
        { status: 400 }
      );
    }

    // Determine voice to use
    let selectedVoiceId = voiceId;
    
    if (!selectedVoiceId) {
      selectedVoiceId = getDefaultVoiceId();
      if (!selectedVoiceId) {
        return NextResponse.json(
          { error: 'No voices configured for text-to-speech' },
          { status: 500 }
        );
      }
    } else if (!isValidVoiceId(selectedVoiceId)) {
      return NextResponse.json(
        { error: `Invalid voice selection. Available voices: ${process.env.ELEVENLABS_VOICE_IDS}` },
        { status: 400 }
      );
    }

    console.log(`Generating audio for ${text.trim().split(/\s+/).length} words using voice: ${selectedVoiceId}`);

    // Generate audio using ElevenLabs
    const result = await generateAudio(text, selectedVoiceId);

    if (!result.success) {
      console.error('Audio generation failed:', result.error);
      return NextResponse.json(
        { error: `Failed to generate audio: ${result.error}` },
        { status: 500 }
      );
    }

    console.log(`Audio generated successfully: ${result.audioBuffer?.byteLength} bytes`);

    // Return audio as MP3 response
    return new NextResponse(result.audioBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'audio/mpeg',
        'Content-Disposition': 'attachment; filename="story-audio.mp3"',
        'Cache-Control': 'public, max-age=31536000', // Cache for 1 year
      }
    });

  } catch (error) {
    console.error('Story narration API error:', error);
    return NextResponse.json(
      { error: 'Internal server error during audio generation' },
      { status: 500 }
    );
  }
}