'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface TokenData {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in?: number;
}

export default function SuccessPage() {
  const [tokenData, setTokenData] = useState<TokenData | null>(null);

  useEffect(() => {
    // Get token from localStorage
    const storedToken = localStorage.getItem('yoto_token');
    if (storedToken) {
      try {
        setTokenData(JSON.parse(storedToken));
      } catch (err) {
        console.error('Error parsing token:', err);
      }
    }
  }, []);

  const testApiCall = async () => {
    if (!tokenData) return;

    try {
      const response = await fetch('/api/yoto/test', {
        headers: {
          'Authorization': `Bearer ${tokenData.access_token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        alert('API call successful! Check console for details.');
        console.log('Yoto API response:', data);
      } else {
        alert('API call failed. Check console for details.');
        console.error('API call failed:', await response.text());
      }
    } catch (error) {
      alert('API call error. Check console for details.');
      console.error('API call error:', error);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full mx-auto space-y-8">
        <div className="bg-white shadow rounded-lg p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <svg className="h-12 w-12 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="ml-4">
              <h3 className="text-lg font-medium text-gray-900">
                Successfully Connected!
              </h3>
              <p className="mt-1 text-sm text-gray-500">
                Your Yoto account has been connected using OAuth2 with PKCE.
              </p>
            </div>
          </div>
          
          <div className="mt-6 space-y-4">
            <button
              onClick={testApiCall}
              disabled={!tokenData}
              className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
            >
              Test API Call
            </button>
            
            <Link
              href="/"
              className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              Continue to Create Stories
            </Link>

            <button
              onClick={() => {
                localStorage.removeItem('yoto_token');
                window.location.href = '/auth';
              }}
              className="w-full flex justify-center py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              Disconnect Account
            </button>
          </div>

          {tokenData && (
            <details className="mt-6">
              <summary className="cursor-pointer text-sm text-gray-500">
                Token Details (Debug)
              </summary>
              <pre className="mt-2 text-xs bg-gray-50 p-2 rounded overflow-auto">
                {JSON.stringify({
                  ...tokenData,
                  access_token: tokenData.access_token.substring(0, 20) + '...',
                  refresh_token: tokenData.refresh_token ? tokenData.refresh_token.substring(0, 20) + '...' : undefined
                }, null, 2)}
              </pre>
            </details>
          )}
        </div>
      </div>
    </div>
  );
}