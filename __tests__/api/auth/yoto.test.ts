// Mock environment variables
const mockEnv = {
  YOTO_CLIENT_ID: 'test-client-id',
  NEXTAUTH_URL: 'http://localhost:3000',
  NEXTAUTH_SECRET: 'test-secret',
  NODE_ENV: 'test' as const
};

// Mock fetch for API calls
global.fetch = jest.fn();

describe('Yoto Authentication', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...mockEnv };
  });

  describe('PKCE Auth Flow', () => {
    it('should generate PKCE challenge', async () => {
      jest.resetModules();
      const { generatePKCEChallenge } = await import('@/lib/auth/yoto');
      
      const result = await generatePKCEChallenge();
      
      expect(result).toHaveProperty('codeVerifier');
      expect(result).toHaveProperty('codeChallenge');
      expect(typeof result.codeVerifier).toBe('string');
      expect(typeof result.codeChallenge).toBe('string');
    });

    it('should build auth URL correctly', async () => {
      jest.resetModules();
      const { buildAuthURL } = await import('@/lib/auth/yoto');
      
      const clientId = 'test-client-id';
      const redirectUri = 'http://localhost:3000/auth/callback';
      const codeChallenge = 'test-challenge';
      
      const authUrl = buildAuthURL(clientId, redirectUri, codeChallenge);
      
      expect(authUrl).toContain('https://login.yotoplay.com/authorize');
      expect(authUrl).toContain('client_id=test-client-id');
      expect(authUrl).toContain('code_challenge=test-challenge');
      expect(authUrl).toContain('response_type=code');
    });

    it('should exchange code for tokens successfully', async () => {
      const mockTokenResponse = {
        access_token: 'test-access-token',
        refresh_token: 'test-refresh-token',
        expires_in: 3600,
        token_type: 'Bearer'
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockTokenResponse
      });

      jest.resetModules();
      const { exchangeCodeForTokens } = await import('@/lib/auth/yoto');
      
      const result = await exchangeCodeForTokens(
        'test-client-id',
        'test-auth-code',
        'test-code-verifier',
        'http://localhost:3000/auth/callback'
      );
      
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/oauth/token'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/x-www-form-urlencoded'
          })
        })
      );
      
      expect(result).toEqual(mockTokenResponse);
    });

    it('should handle token refresh', async () => {
      const mockRefreshResponse = {
        access_token: 'new-access-token',
        refresh_token: 'new-refresh-token',
        expires_in: 3600,
        token_type: 'Bearer'
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockRefreshResponse
      });

      jest.resetModules();
      const { refreshAccessToken } = await import('@/lib/auth/yoto');
      
      const result = await refreshAccessToken('old-refresh-token', 'test-client-id');
      
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/oauth/token'),
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('grant_type=refresh_token')
        })
      );
      
      expect(result).toEqual(mockRefreshResponse);
    });

    it('should validate token expiry correctly', async () => {
      jest.resetModules();
      const { isTokenExpired } = await import('@/lib/auth/yoto');
      
      // Create a mock JWT token (expired)
      const expiredToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJleHAiOjEwMDAwMDAwMDB9.invalidSignature';
      expect(isTokenExpired(expiredToken)).toBe(true);
      
      // Create a mock JWT token (valid for long time) 
      const futureTimestamp = Math.floor(Date.now() / 1000) + 3600; // 1 hour from now
      const validToken = `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.${btoa(JSON.stringify({ exp: futureTimestamp }))}.invalidSignature`;
      expect(isTokenExpired(validToken)).toBe(false);
      
      // Token expiring soon (4 minutes from now, within 5 min buffer)
      const soonTimestamp = Math.floor(Date.now() / 1000) + 240; // 4 minutes from now
      const expiringSoonToken = `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.${btoa(JSON.stringify({ exp: soonTimestamp }))}.invalidSignature`;
      expect(isTokenExpired(expiringSoonToken)).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should handle token exchange failure', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: async () => JSON.stringify({ error: 'invalid_client', error_description: 'Invalid client' })
      });

      jest.resetModules();
      const { exchangeCodeForTokens } = await import('@/lib/auth/yoto');
      
      await expect(
        exchangeCodeForTokens('invalid-client-id', 'test-code', 'test-verifier', 'http://localhost:3000/auth/callback')
      ).rejects.toThrow('Token exchange failed');
    });

    it('should handle refresh token failure', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: async () => JSON.stringify({ error: 'invalid_grant', error_description: 'Invalid refresh token' })
      });

      jest.resetModules();
      const { refreshAccessToken } = await import('@/lib/auth/yoto');
      
      await expect(refreshAccessToken('invalid-token', 'test-client-id')).rejects.toThrow('Token refresh failed');
    });

    it('should handle ensureValidToken with missing token', async () => {
      jest.resetModules();
      const { ensureValidToken } = await import('@/lib/auth/yoto');
      
      await expect(ensureValidToken({})).rejects.toThrow('No access token available');
      await expect(ensureValidToken(null)).rejects.toThrow('No access token available');
    });
  });
});