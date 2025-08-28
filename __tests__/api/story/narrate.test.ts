import { generateAudio, validateTextLength, isValidVoiceId, getAvailableVoices, getDefaultVoiceId } from '@/lib/tts/elevenlabs';

// Mock ElevenLabs API
const mockElevenLabsResponse = {
  ok: true,
  arrayBuffer: () => Promise.resolve(new ArrayBuffer(1000))
};

const mockFetch = jest.fn().mockResolvedValue(mockElevenLabsResponse);
global.fetch = mockFetch;

describe('TTS Integration API Logic', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.ELEVENLABS_API_KEY = 'test-api-key';
    process.env.ELEVENLABS_VOICE_IDS = 'voice1,voice2,voice3';
  });

  afterEach(() => {
    delete process.env.ELEVENLABS_API_KEY;
    delete process.env.ELEVENLABS_VOICE_IDS;
  });

  describe('Audio Generation Flow', () => {
    it('should convert valid story text to audio successfully', async () => {
      const storyText = 'Emma discovered a magical forest where talking animals lived in harmony and peace. '.repeat(20); // ~400+ words
      
      const result = await generateAudio(storyText, 'voice1');
      
      expect(result.success).toBe(true);
      expect(result.audioBuffer).toBeDefined();
      expect(result.audioBuffer?.byteLength).toBe(1000);
      
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.elevenlabs.io/v1/text-to-speech/voice1',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'xi-api-key': 'test-api-key',
            'Content-Type': 'application/json'
          })
        })
      );
    });

    it('should use appropriate TTS settings for children stories', async () => {
      const storyText = 'word '.repeat(500); // Valid length
      
      await generateAudio(storyText, 'voice2');

      const callArgs = mockFetch.mock.calls[0][1];
      const requestBody = JSON.parse(callArgs.body);

      expect(requestBody).toEqual({
        text: storyText,
        model_id: 'eleven_monolingual_v1',
        voice_settings: {
          stability: 0.7,
          similarity_boost: 0.8,
          style: 0.3,
          use_speaker_boost: true
        }
      });
    });

    it('should handle ElevenLabs API errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized'
      });

      const storyText = 'word '.repeat(500);
      const result = await generateAudio(storyText, 'voice1');

      expect(result.success).toBe(false);
      expect(result.error).toContain('External service temporarily unavailable');
    });
  });

  describe('Voice Validation', () => {
    it('should validate voice selection against available voices', () => {
      expect(isValidVoiceId('voice1')).toBe(true);
      expect(isValidVoiceId('voice2')).toBe(true);
      expect(isValidVoiceId('invalid-voice')).toBe(false);
    });

    it('should return first voice as default', () => {
      expect(getDefaultVoiceId()).toBe('voice1');
    });

    it('should return available voices from configuration', () => {
      expect(getAvailableVoices()).toEqual(['voice1', 'voice2', 'voice3']);
    });
  });

  describe('Text Validation for Audio', () => {
    it('should accept any reasonable text length', () => {
      const shortText = 'Hello world';
      const mediumText = 'word '.repeat(500);
      const longText = 'word '.repeat(900);
      
      expect(validateTextLength(shortText)).toBe(true);
      expect(validateTextLength(mediumText)).toBe(true);
      expect(validateTextLength(longText)).toBe(true);
    });

    it('should reject extremely long text', () => {
      const extremelyLongText = 'word '.repeat(1100);
      expect(validateTextLength(extremelyLongText)).toBe(false);
    });

    it('should handle edge cases', () => {
      expect(validateTextLength('')).toBe(false);
      expect(validateTextLength(null as any)).toBe(false);
      expect(validateTextLength(undefined as any)).toBe(false);
    });
  });

  describe('Configuration Validation', () => {
    it('should require API key for audio generation', async () => {
      delete process.env.ELEVENLABS_API_KEY;

      const storyText = 'word '.repeat(500);
      const result = await generateAudio(storyText, 'voice1');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Service temporarily unavailable due to configuration issues');
    });

    it('should handle missing voice configuration', () => {
      delete process.env.ELEVENLABS_VOICE_IDS;
      
      expect(getAvailableVoices()).toEqual([]);
      expect(getDefaultVoiceId()).toBeNull();
    });
  });
});