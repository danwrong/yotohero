'use client';

import { useState, useEffect } from 'react';
import { generatePKCEChallenge, buildAuthURL } from '@/lib/auth/yoto';

export default function AuthPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Check if user is returning from callback
  useEffect(() => {
    // If there's a token in localStorage, redirect to success page
    const token = localStorage.getItem('yoto_token');
    if (token) {
      window.location.href = '/auth/success';
    }
  }, []);

  const initiateLogin = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Generate PKCE challenge
      const { codeVerifier, codeChallenge } = await generatePKCEChallenge();
      
      // Store code verifier in session storage
      sessionStorage.setItem('pkce_code_verifier', codeVerifier);
      
      // Get client ID and redirect URI
      const clientId = process.env.NEXT_PUBLIC_YOTO_CLIENT_ID || '';
      const redirectUri = `${window.location.origin}/auth/callback`;
      
      console.log('Auth initialization:', {
        clientId: clientId.substring(0, 10) + '...',
        redirectUri,
        codeChallenge: codeChallenge.substring(0, 10) + '...'
      });
      
      if (!clientId) {
        throw new Error('YOTO_CLIENT_ID is not configured');
      }
      
      // Build auth URL and redirect
      const authUrl = buildAuthURL(clientId, redirectUri, codeChallenge);
      
      console.log('Redirecting to auth URL:', authUrl);
      
      // Redirect to Yoto login
      window.location.href = authUrl;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full mx-auto space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Connect Your Yoto Account
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Authenticate to upload stories to your Yoto library
          </p>
        </div>

        <div className="bg-white shadow rounded-lg p-6">
          <div className="space-y-6">
            <div className="text-center">
              <svg className="mx-auto h-12 w-12 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              <h3 className="mt-4 text-lg font-medium text-gray-900">
                Secure OAuth Authentication
              </h3>
              <p className="mt-2 text-sm text-gray-500">
                You&apos;ll be redirected to Yoto&apos;s secure login page to authenticate. Your credentials are never shared with our app.
              </p>
            </div>

            <button
              onClick={initiateLogin}
              disabled={loading}
              className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
            >
              {loading ? 'Redirecting to Yoto...' : 'Connect with Yoto'}
            </button>

            <div className="text-xs text-gray-400 text-center">
              <p>This will redirect you to login.yotoplay.com</p>
            </div>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
            <p className="font-medium">Error</p>
            <p className="text-sm">{error}</p>
          </div>
        )}
      </div>
    </div>
  );
}