import pkceChallenge from 'pkce-challenge';
import { jwtDecode } from 'jwt-decode';
import { yotoLogger } from '../utils/logger';
import { AuthenticationError, ConfigurationError, YotoAPIError } from '../utils/errors';

interface TokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in?: number;
  token_type: string;
}

interface TokenWithExpiry {
  expires_at: number;
}

interface JWTPayload {
  exp: number;
  [key: string]: any;
}

const YOTO_AUTH_BASE_URL = 'https://login.yotoplay.com';
const YOTO_API_BASE_URL = 'https://api.yotoplay.com';

export async function generatePKCEChallenge() {
  const { code_verifier, code_challenge } = await pkceChallenge();
  return { codeVerifier: code_verifier, codeChallenge: code_challenge };
}

export function buildAuthURL(clientId: string, redirectUri: string, codeChallenge: string): string {
  const authUrl = `${YOTO_AUTH_BASE_URL}/authorize`;
  const params = new URLSearchParams({
    audience: YOTO_API_BASE_URL,
    scope: 'offline_access library:read library:write',
    response_type: 'code',
    client_id: clientId,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
    redirect_uri: redirectUri,
  });

  console.log('Built authorization URL:', `${authUrl}?${params.toString()}`);
  return `${authUrl}?${params.toString()}`;
}

export async function exchangeCodeForTokens(
  clientId: string,
  code: string,
  codeVerifier: string,
  redirectUri: string
): Promise<TokenResponse> {
  // Try method 1: Client ID in body (current approach)
  console.log('Attempting token exchange - Method 1: Client ID in body');
  let tokenParams = {
    grant_type: 'authorization_code',
    client_id: clientId,
    code_verifier: codeVerifier,
    code: code,
    redirect_uri: redirectUri,
  };

  console.log('Making token exchange request to:', `${YOTO_AUTH_BASE_URL}/oauth/token`);
  console.log('Token exchange params:', {
    ...tokenParams,
    code: code.substring(0, 10) + '...',
    code_verifier: codeVerifier.substring(0, 10) + '...',
    client_id: clientId.substring(0, 10) + '...'
  });

  let response = await fetch(`${YOTO_AUTH_BASE_URL}/oauth/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams(tokenParams).toString(),
  });

  console.log('Token exchange response status:', response.status, response.statusText);

  // If first method fails with 401, try method 2: Client credentials in Authorization header
  if (!response.ok && response.status === 401) {
    console.log('Method 1 failed, trying Method 2: Client ID in Authorization header');
    
    // Remove client_id from body params
    const paramsWithoutClientId = {
      grant_type: 'authorization_code',
      code_verifier: codeVerifier,
      code: code,
      redirect_uri: redirectUri,
    };

    // Try with client secret if available
    const clientSecret = process.env.YOTO_CLIENT_SECRET;
    const authHeader = clientSecret 
      ? `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`
      : `Basic ${Buffer.from(`${clientId}:`).toString('base64')}`;
    
    console.log('Using client secret:', clientSecret ? 'YES' : 'NO');
    
    response = await fetch(`${YOTO_AUTH_BASE_URL}/oauth/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': authHeader,
      },
      body: new URLSearchParams(paramsWithoutClientId).toString(),
    });

    console.log('Method 2 response status:', response.status, response.statusText);
  }

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Token exchange error response:', errorText);
    
    let error;
    try {
      error = JSON.parse(errorText);
    } catch {
      error = { error: 'invalid_response', error_description: errorText };
    }
    
    throw new Error(`Token exchange failed: ${error.error || 'Unknown error'}${error.error_description ? ` - ${error.error_description}` : ''}`);
  }

  const tokens = await response.json();
  console.log('Token exchange successful, received tokens');
  return tokens;
}

export async function refreshAccessToken(refreshToken: string, clientId: string): Promise<TokenResponse> {
  yotoLogger.info('Refreshing Yoto access token');
  
  const response = await fetch(`${YOTO_AUTH_BASE_URL}/oauth/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: clientId,
      refresh_token: refreshToken,
    }).toString(),
  });

  if (!response.ok) {
    const errorText = await response.text();
    let error;
    try {
      error = JSON.parse(errorText);
    } catch {
      error = { error: 'invalid_response', error_description: errorText };
    }
    
    yotoLogger.error('Token refresh failed', {
      status: response.status,
      error: error.error,
      description: error.error_description
    });
    
    throw new AuthenticationError(`Token refresh failed: ${error.error || 'Unknown error'}`);
  }

  const tokens = await response.json();
  yotoLogger.info('Token refresh successful');
  return tokens;
}

/**
 * Check if a token is expired or will expire soon (within 5 minutes)
 */
export function isTokenExpired(accessToken: string): boolean {
  try {
    const decoded = jwtDecode<JWTPayload>(accessToken);
    const expiryTime = decoded.exp * 1000; // Convert to milliseconds
    const currentTime = Date.now();
    const fiveMinutesInMs = 5 * 60 * 1000; // 5 minutes buffer
    
    return expiryTime <= (currentTime + fiveMinutesInMs);
  } catch (error) {
    yotoLogger.warn('Failed to decode token, assuming expired', { 
      error: error instanceof Error ? error.message : String(error) 
    });
    return true; // If we can't decode it, assume it's expired
  }
}

/**
 * Automatically refresh token if needed, return valid access token
 */
export async function ensureValidToken(tokenData: any): Promise<string> {
  if (!tokenData?.access_token) {
    throw new AuthenticationError('No access token available');
  }

  // Check if token needs refresh
  if (!isTokenExpired(tokenData.access_token)) {
    yotoLogger.debug('Access token is still valid');
    return tokenData.access_token;
  }

  // Token is expired, try to refresh
  if (!tokenData.refresh_token) {
    throw new AuthenticationError('Token expired and no refresh token available');
  }

  const clientId = process.env.YOTO_CLIENT_ID;
  if (!clientId) {
    throw new ConfigurationError('YOTO_CLIENT_ID not configured');
  }

  yotoLogger.info('Access token expired, attempting refresh');
  
  try {
    const refreshedTokens = await refreshAccessToken(tokenData.refresh_token, clientId);
    
    // Update the stored token data
    // Note: In a real app, you'd save this to your storage mechanism
    // For now, we'll just return the new access token
    yotoLogger.info('Token refresh successful, updated access token');
    
    return refreshedTokens.access_token;
  } catch (error) {
    yotoLogger.error('Failed to refresh token', { 
      error: error instanceof Error ? error.message : String(error) 
    });
    throw new AuthenticationError('Token refresh failed - please re-authenticate');
  }
}

export function calculateTokenExpiry(expiresIn: number): number {
  return Date.now() + (expiresIn * 1000);
}