# You're The Hero! - Implementation Plan

## Project Overview
A web application that allows children (ages 5-13) to create personalized audio stories where they are the hero, delivered directly to their Yoto player.

## Core Workflow
1. User authenticates with Yoto account
2. User enters child's name, adventure type, special skill, and story preferences
3. AI generates a safe, personalized story
4. Story is converted to audio using ElevenLabs TTS
5. Audio is uploaded to user's Yoto library in a "You're The Hero!" playlist

## Tech Stack
- **Framework**: Next.js 14+ with TypeScript (App Router)
- **Hosting**: Vercel
- **Styling**: Tailwind CSS
- **APIs**: Yoto, OpenAI/Claude, ElevenLabs
- **Auth**: Yoto OAuth (device flow or web flow)
- **Testing**: Jest + React Testing Library
- **Environment**: dotenv for secrets management
- **Database**: None for prototype (stateless)

## Development Principles
1. **Test-Driven Development**: Write tests first, implement features, ensure tests pass
2. **Minimal file creation**: Only add files when functionality requires them
3. **No commits without passing tests**: Always run `npm test` before committing
4. **Environment security**: All secrets in `.env.local` via dotenv

## Implementation Phases

### Phase 0: Project Setup
```bash
npx create-next-app@latest yotohero --typescript --tailwind --app
cd yotohero
npm install --save-dev jest @testing-library/react @testing-library/jest-dom jest-environment-jsdom
npm install dotenv
```

**Setup files to create**:
- `.env.local` (git ignored)
- `.env.example` (template for required vars)
- `jest.config.js`
- `jest.setup.js`

### Phase 1: Authentication with Yoto

**Test First**:
```typescript
// __tests__/api/auth/yoto.test.ts
describe('Yoto Authentication', () => {
  it('should initialize device auth flow')
  it('should poll for token successfully')
  it('should handle token refresh')
  it('should validate token expiry')
})
```

**Then Implement**:
- Yoto OAuth using device flow (from docs)
- Token management with refresh
- Session handling

**Environment Variables**:
```env
# .env.local
YOTO_CLIENT_ID=your_client_id_here
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=generate_random_secret
```

### Phase 2: Story Input Interface

**Test First**:
```typescript
// __tests__/components/StoryForm.test.tsx
describe('Story Form', () => {
  it('should validate child name is required')
  it('should sanitize special characters from inputs')
  it('should limit input lengths appropriately')
  it('should prevent form submission with invalid data')
})
```

**Then Build**:
- Single form component with all inputs
- Client-side validation
- Input sanitization

### Phase 3: Story Generation with Safety

**Test First**:
```typescript
// __tests__/lib/safety.test.ts
describe('Content Safety', () => {
  it('should detect inappropriate terms in input')
  it('should sanitize injection attempts')
  it('should validate story length (450-550 words)')
  it('should flag inappropriate generated content')
})

// __tests__/api/story/generate.test.ts
describe('Story Generation API', () => {
  it('should generate story with valid inputs')
  it('should reject inappropriate inputs')
  it('should handle API failures gracefully')
})
```

**Then Implement**:
- Safety validation functions
- LLM integration (OpenAI/Claude)
- Post-generation content checks

**Environment Variables**:
```env
OPENAI_API_KEY=sk-...
# or
ANTHROPIC_API_KEY=sk-ant-...
```

### Phase 4: Text-to-Speech Integration

**Test First**:
```typescript
// __tests__/api/story/narrate.test.ts
describe('TTS Integration', () => {
  it('should convert text to audio successfully')
  it('should handle voice selection')
  it('should validate audio duration (~3 min)')
  it('should handle TTS API failures')
})
```

**Then Implement**:
- ElevenLabs API integration
- Voice selection logic
- Audio validation

**Environment Variables**:
```env
ELEVENLABS_API_KEY=your_api_key
ELEVENLABS_VOICE_IDS=voice1,voice2,voice3
```

### Phase 5: Yoto Library Integration

**Test First**:
```typescript
// __tests__/lib/yoto-api.test.ts
describe('Yoto API Integration', () => {
  it('should check for existing playlist')
  it('should create playlist if not exists')
  it('should upload audio successfully')
  it('should add track to playlist')
  it('should handle upload failures with retry')
})
```

**Then Implement**:
- Yoto API wrapper functions
- Playlist management
- Audio upload with retry logic

### Phase 6: Integration & E2E Testing

**Test Complete Flow**:
```typescript
// __tests__/e2e/story-creation.test.ts
describe('Complete Story Creation', () => {
  it('should complete full workflow from login to Yoto upload')
  it('should handle failures at each step gracefully')
  it('should enforce rate limiting')
})
```

## Testing Strategy

### Unit Tests
- All utility functions (sanitization, validation)
- API route handlers
- React components

### Integration Tests  
- API endpoints with mocked external services
- Auth flow with token management
- File upload processes

### Test Commands
```bash
# Run all tests
npm test

# Run tests in watch mode
npm test -- --watch

# Run tests with coverage
npm test -- --coverage

# Run specific test file
npm test -- safety.test.ts
```

### Pre-Commit Checklist
```bash
# ALWAYS run before committing:
npm test          # All tests must pass
npm run lint      # No linting errors
npm run typecheck # No TypeScript errors
npm run build     # Build succeeds

# Only commit if ALL checks pass
```

## Security & Safety Measures

### Environment Security
```javascript
// Use dotenv for all secrets
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

// Never commit .env.local
// Always update .env.example with new vars (without values)
```

### Required `.env.example`:
```env
YOTO_CLIENT_ID=
NEXTAUTH_URL=
NEXTAUTH_SECRET=
OPENAI_API_KEY=
ELEVENLABS_API_KEY=
ELEVENLABS_VOICE_IDS=
```

### Content Safety Testing
Write tests for these scenarios:
1. Inappropriate language in inputs
2. SQL injection attempts  
3. Script injection attempts
4. Oversized inputs
5. Adult themes in generated content
6. Violence/scary content detection

### Input Sanitization
```typescript
// Test these functions thoroughly:
function sanitizeInput(input: string): string
function validateChildName(name: string): boolean
function checkBlocklist(text: string): boolean
function validateStoryContent(story: string): boolean
```

## API Rate Limits & Costs
- **OpenAI**: ~$0.01 per story (500 words)
- **ElevenLabs**: ~$0.03 per story (3 min audio)  
- **Yoto**: Check API limits in developer dashboard
- **Total cost**: ~$0.04 per story
- **Rate limit**: 5 stories per session (configurable)

## Development Workflow

### For Each Feature:
1. **Write failing tests** for the feature
2. **Implement** minimum code to pass tests
3. **Refactor** if needed (tests still pass)
4. **Run full test suite** before moving on
5. **Only commit** when all tests pass

### Branch Strategy
```bash
# Create feature branch
git checkout -b feature/auth-implementation

# After tests pass
npm test && npm run lint && npm run typecheck && npm run build

# Only if all pass, commit
git add .
git commit -m "Add Yoto auth with passing tests"
```

## Testing Utilities to Create

```typescript
// test-utils/mock-data.ts
export const mockStoryInput = {...}
export const mockYotoTokens = {...}
export const mockAudioFile = Buffer.from(...)

// test-utils/mock-apis.ts
export const mockYotoAPI = jest.fn()
export const mockOpenAI = jest.fn()
export const mockElevenLabs = jest.fn()
```

## Monitoring & Debugging

### Test Coverage Goals
- Minimum 80% coverage overall
- 100% coverage for safety functions
- 100% coverage for auth functions
- 90% coverage for API routes

### Debug Environment Variables
```env
# .env.local (development only)
DEBUG_YOTO_API=true
DEBUG_STORY_GENERATION=true
LOG_SAFETY_CHECKS=true
```

## Commands Reference
```bash
# Development
npm run dev

# Testing (ALWAYS before commit)
npm test                    # Run all tests
npm test -- --coverage     # Check coverage
npm test -- --watch        # Watch mode

# Code Quality (ALWAYS before commit)  
npm run lint               # ESLint
npm run typecheck         # TypeScript
npm run build             # Production build

# Commit only if all pass
git add . && git commit -m "message"
```

## Implementation Order

1. **Setup & Configuration**
   - Initialize project
   - Configure Jest + dotenv
   - Create `.env.local` and `.env.example`
   - Write auth tests

2. **Authentication**
   - Implement Yoto OAuth (TDD)
   - Token management (TDD)
   - Write and pass all auth tests

3. **Story Form**
   - Write form validation tests
   - Build form component
   - Add sanitization with tests

4. **Story Generation**
   - Write safety tests first
   - Implement generation + safety
   - Pass all content tests

5. **TTS Integration**  
   - Mock ElevenLabs in tests
   - Implement TTS
   - Validate audio generation

6. **Yoto Upload**
   - Mock Yoto API in tests
   - Implement upload flow
   - Full integration test

Remember: **NO COMMITS unless `npm test && npm run lint && npm run typecheck && npm run build` all succeed!**