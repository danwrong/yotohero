import { generateAudio, getAvailableVoices, validateTextLength } from '@/lib/tts/elevenlabs';

// Mock fetch for ElevenLabs API
const mockFetch = jest.fn();
global.fetch = mockFetch;

describe('ElevenLabs TTS Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.ELEVENLABS_API_KEY = 'test-api-key';
    process.env.ELEVENLABS_VOICE_IDS = 'voice1,voice2,voice3';
  });

  afterEach(() => {
    delete process.env.ELEVENLABS_API_KEY;
    delete process.env.ELEVENLABS_VOICE_IDS;
  });

  describe('Audio Generation', () => {
    it('should generate audio from text successfully', async () => {
      const mockAudioBuffer = new ArrayBuffer(1000);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        arrayBuffer: () => Promise.resolve(mockAudioBuffer)
      });

      const result = await generateAudio('Test story content', 'voice1');

      expect(result.success).toBe(true);
      expect(result.audioBuffer).toEqual(mockAudioBuffer);
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

    it('should use correct TTS settings for child narration', async () => {
      const mockAudioBuffer = new ArrayBuffer(1000);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        arrayBuffer: () => Promise.resolve(mockAudioBuffer)
      });

      await generateAudio('Test story content', 'voice1');

      const callArgs = mockFetch.mock.calls[0][1];
      const requestBody = JSON.parse(callArgs.body);

      expect(requestBody).toEqual({
        text: 'Test story content',
        model_id: 'eleven_monolingual_v1',
        voice_settings: {
          stability: 0.7,
          similarity_boost: 0.8,
          style: 0.3,
          use_speaker_boost: true
        }
      });
    });

    it('should handle API errors gracefully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized'
      });

      const result = await generateAudio('Test content', 'voice1');

      expect(result.success).toBe(false);
      expect(result.error).toBe('External service temporarily unavailable. Please try again.');
    });

    it('should handle network errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await generateAudio('Test content', 'voice1');

      expect(result.success).toBe(false);
      expect(result.error).toBe('External service temporarily unavailable. Please try again.');
    });

    it('should require API key configuration', async () => {
      delete process.env.ELEVENLABS_API_KEY;

      const result = await generateAudio('Test content', 'voice1');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Service temporarily unavailable due to configuration issues.');
    });
  });

  describe('Voice Management', () => {
    it('should return available voices from environment', () => {
      const voices = getAvailableVoices();
      expect(voices).toEqual(['voice1', 'voice2', 'voice3']);
    });

    it('should handle missing voice configuration', () => {
      delete process.env.ELEVENLABS_VOICE_IDS;

      const voices = getAvailableVoices();
      expect(voices).toEqual([]);
    });

    it('should validate voice selection', () => {
      expect(getAvailableVoices().includes('voice1')).toBe(true);
      expect(getAvailableVoices().includes('invalid-voice')).toBe(false);
    });
  });

  describe('Text Validation', () => {
    it('should accept any reasonable text length', () => {
      const shortText = 'Hello world';
      const mediumText = 'word '.repeat(500).trim();
      const longText = 'word '.repeat(900).trim();
      
      expect(validateTextLength(shortText)).toBe(true);
      expect(validateTextLength(mediumText)).toBe(true);
      expect(validateTextLength(longText)).toBe(true);
    });

    it('should reject extremely long text', () => {
      const extremelyLongText = 'word '.repeat(1100).trim();
      expect(validateTextLength(extremelyLongText)).toBe(false);
    });

    it('should handle empty or null text', () => {
      expect(validateTextLength('')).toBe(false);
      expect(validateTextLength(null as any)).toBe(false);
      expect(validateTextLength(undefined as any)).toBe(false);
    });
  });
});