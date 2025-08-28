import { NextRequest, NextResponse } from 'next/server';
import { exchangeCodeForTokens } from '@/lib/auth/yoto';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    console.log('Callback request received:', {
      ...body,
      code: body.code ? body.code.substring(0, 10) + '...' : 'MISSING',
      codeVerifier: body.codeVerifier ? body.codeVerifier.substring(0, 10) + '...' : 'MISSING'
    });

    const { code, codeVerifier, redirectUri } = body;
    
    if (!code) {
      console.error('Missing authorization code');
      return NextResponse.json(
        { error: 'Authorization code is required' },
        { status: 400 }
      );
    }
    
    if (!codeVerifier) {
      console.error('Missing PKCE code verifier');
      return NextResponse.json(
        { error: 'PKCE code verifier is required' },
        { status: 400 }
      );
    }

    const clientId = process.env.NEXT_PUBLIC_YOTO_CLIENT_ID;
    if (!clientId) {
      console.error('YOTO_CLIENT_ID not configured');
      return NextResponse.json(
        { error: 'YOTO_CLIENT_ID is not configured' },
        { status: 500 }
      );
    }

    console.log('Attempting token exchange with:', {
      clientId: clientId.substring(0, 10) + '...',
      redirectUri,
      codeLength: code.length,
      codeVerifierLength: codeVerifier.length
    });

    // Exchange authorization code for tokens
    const tokens = await exchangeCodeForTokens(
      clientId,
      code,
      codeVerifier,
      redirectUri
    );

    console.log('Token exchange successful');
    return NextResponse.json(tokens);
  } catch (error) {
    console.error('Token exchange failed:', error);
    
    // Enhanced error logging
    if (error instanceof Error) {
      console.error('Error details:', {
        message: error.message,
        stack: error.stack
      });
    }
    
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Token exchange failed' },
      { status: 500 }
    );
  }
}