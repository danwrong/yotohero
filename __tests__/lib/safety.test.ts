import {
  sanitizeInput,
  validateStoryContent,
  checkProfanity,
  validateStoryLength,
  validateContentSafety,
  validateContentSafetyWithAI
} from '@/lib/utils/safety';

describe('Content Safety', () => {
  describe('Input Sanitization', () => {
    it('should detect profanity in input', () => {
      expect(checkProfanity('This story has damn monsters')).toBe(true);
      expect(checkProfanity('A fucking adventure')).toBe(true);
      expect(checkProfanity('This is a nice happy story')).toBe(false);
    });

    it('should sanitize injection attempts', () => {
      const maliciousInput = '<script>alert("xss")</script>Emma goes on an adventure';
      const sanitized = sanitizeInput(maliciousInput);
      
      expect(sanitized).not.toContain('<script>');
      expect(sanitized).not.toContain('alert');
      expect(sanitized).toContain('Emma goes on an adventure');
    });

    it('should handle SQL injection attempts', () => {
      const sqlInjection = "Emma'; DROP TABLE stories; --";
      const sanitized = sanitizeInput(sqlInjection);
      
      expect(sanitized).not.toContain(';');
      expect(sanitized).not.toContain('--');
      expect(sanitized).not.toContain('DROP');
    });

    it('should normalize excessive whitespace', () => {
      const messyInput = '   Emma    goes   on    an   adventure   ';
      const sanitized = sanitizeInput(messyInput);
      
      expect(sanitized).toBe('Emma goes on an adventure');
    });
  });

  describe('Story Content Validation', () => {
    it('should validate story has minimum length', () => {
      const shortStory = 'Emma went to the forest. The end.'; // ~8 words
      const goodStory = 'word '.repeat(150) + 'The end.'; // ~151 words
      const longStory = 'word '.repeat(1200) + 'The end.'; // ~1201 words

      expect(validateStoryLength(shortStory)).toBe(false);
      expect(validateStoryLength(goodStory)).toBe(true);
      expect(validateStoryLength(longStory)).toBe(true); // No max limit now
    });

    it('should flag profanity in generated content', () => {
      const profanityStory = 'Emma encountered a damn monster that was really bad.';
      const profanityStory2 = 'Emma fought the dragon and said shit when it was difficult.';
      const inappropriateStory = 'Emma went to the fucking forest and had a hell of a time.';
      const goodStory = 'Emma discovered a magical garden where she helped friendly flowers grow by singing to them.';

      expect(checkProfanity(profanityStory)).toBe(true);
      expect(checkProfanity(profanityStory2)).toBe(true);
      expect(checkProfanity(inappropriateStory)).toBe(true);
      expect(checkProfanity(goodStory)).toBe(false);
    });

    it('should validate content using legacy function', () => {
      const validStory = 'word '.repeat(120) + 'Emma discovered a magical garden where she helped friendly flowers grow by singing to them.'; // ~135 words
      const invalidStory = 'Emma encountered a damn monster that was really bad.';
      
      const validResult = validateContentSafety(validStory);
      const invalidResult = validateContentSafety(invalidStory);
      
      expect(validResult.isValid).toBe(true);
      expect(validResult.issues).toEqual([]);
      expect(validResult.wordCount).toBeGreaterThan(0);
      
      expect(invalidResult.isValid).toBe(false);
      expect(invalidResult.issues.length).toBeGreaterThan(0);
      expect(invalidResult.wordCount).toBeGreaterThan(0);
    });

    it('should validate content with AI when configured', async () => {
      // Mock OpenAI API response for testing
      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{
            message: {
              content: JSON.stringify({
                score: 9,
                reasoning: "This is a wholesome children's story with positive themes",
                concerns: "none"
              })
            }
          }]
        })
      });

      const story = 'word '.repeat(120) + 'Emma discovered a magical garden where she helped friendly flowers grow by singing to them.'; // ~135 words
      
      // Skip AI validation in test environment unless OPENAI_API_KEY is set
      if (!process.env.OPENAI_API_KEY) {
        const result = validateContentSafety(story);
        expect(result.isValid).toBe(true);
        return;
      }

      const result = await validateContentSafetyWithAI(story);
      expect(result.isValid).toBe(true);
      expect(result.aiRating?.score).toBeGreaterThanOrEqual(7);
    }, 10000);

    it('should validate complete story content', () => {
      // Create a valid story with 450+ words
      const validStoryParts = [
        'Emma discovered a magical forest where talking animals lived in harmony and peace.',
        'She used her special gift of understanding animal languages to help a lost baby deer find its beloved mother.',
        'Along the way through the enchanted woodland, she met a wise old owl who taught her about the importance of patience and kindness.',
        'With the help of her wonderful new forest friends, including cheerful rabbits and singing birds, Emma guided the baby deer through the peaceful woodland paths.',
        'The magical forest was filled with sparkling crystal streams and colorful dancing flowers that swayed gently in the warm breeze.',
        'Every step of their amazing journey brought exciting new discoveries and wonderful lasting friendships that would be treasured forever.',
        'The playful rabbits showed Emma secret hidden meadows where the sweetest berries grew in abundance throughout the seasons.',
        'The beautiful birds sang melodious songs that made everyone feel happy, peaceful, and filled with joy and wonder.',
        'As they traveled deeper into the heart of the enchanted forest, they met a family of friendly squirrels who eagerly offered to help.',
        'The helpful squirrels had seen the mother deer near a crystal clear pond where she came to drink fresh water every morning.',
        'Emma and her new animal friends hurried excitedly to the sparkling pond, their hearts full of hope, excitement, and anticipation.',
        'The journey through the forest taught Emma many valuable lessons about cooperation, friendship, and helping others in need.',
        'When they finally found the mother deer grazing peacefully in a sunny meadow, there was great joy and celebration among all the forest creatures.',
        'The baby deer ran to its loving mother with tiny leaps of pure happiness and relief, reunited at last after their separation.',
        'Emma felt incredibly proud of her good deed and promised to visit her wonderful new friends often in the magical forest.',
        'The grateful forest animals thanked her with a beautiful harmonious song that echoed through the tall trees and filled the air.',
        'They gave her a special flower crown made from the most beautiful blooms and petals in the entire magical forest.',
        'As Emma walked home through the golden sunset, she carried with her the warm feeling of having helped others in their time of need.',
        'She had learned that kindness and compassion always find a way to make the world a better and more beautiful place.',
        'Her adventure in the magical forest had taught her that every creature, no matter how big or small, deserves love and care.',
        'The precious friendship she had made with the forest animals would last forever in her heart and memory.',
        'From that day forward, Emma always remembered to be gentle and kind with all living things in nature.',
        'She would return to the magical forest many times to play and have adventures with her dear animal friends.',
        'Each visit brought new exciting adventures and important lessons about caring for others and protecting the natural world.',
        'The magical forest had become her second home, a place filled with love, wonder, and wonderful memories that would last a lifetime.'
      ];
      
      const validStory = validStoryParts.join(' ');

      const invalidStory = 'Emma encountered scary monsters in a violent battle where people got hurt and blood was everywhere.';

      // Debug the validation
      const { isValid, issues, wordCount } = validateContentSafety(validStory);
      console.log('Validation result:', { isValid, issues, wordCount });
      
      expect(validateStoryContent(validStory)).toBe(true);
      expect(validateStoryContent(invalidStory)).toBe(false);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty or null inputs', () => {
      expect(checkProfanity('')).toBe(false);
      expect(checkProfanity(null as any)).toBe(false);
      expect(checkProfanity(undefined as any)).toBe(false);
      
      expect(sanitizeInput('')).toBe('');
      expect(sanitizeInput(null as any)).toBe('');
      expect(sanitizeInput(undefined as any)).toBe('');
    });

    it('should handle very long inputs without crashing', () => {
      const veryLongInput = 'word '.repeat(10000);
      expect(() => sanitizeInput(veryLongInput)).not.toThrow();
      expect(() => checkProfanity(veryLongInput)).not.toThrow();
    });

    it('should handle special characters and unicode', () => {
      const unicodeInput = 'Emma met a friend named José in the café 🌟';
      const sanitized = sanitizeInput(unicodeInput);
      
      expect(sanitized).toContain('Emma');
      expect(sanitized).toContain('José');
      // Should preserve safe unicode but remove potentially dangerous chars
    });

    it('should be case insensitive for profanity', () => {
      expect(checkProfanity('DAMN monster')).toBe(true);
      expect(checkProfanity('fucking FIGHT')).toBe(true);
      expect(checkProfanity('SHIT Monster')).toBe(true);
    });
  });

  describe('Performance', () => {
    it('should process content efficiently', () => {
      const mediumStory = 'word '.repeat(500).trim();
      const startTime = Date.now();
      
      validateStoryContent(mediumStory);
      checkProfanity(mediumStory);
      sanitizeInput(mediumStory);
      
      const endTime = Date.now();
      expect(endTime - startTime).toBeLessThan(100); // Should complete within 100ms
    });
  });
});