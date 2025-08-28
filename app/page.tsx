'use client';

import { useEffect } from 'react';
import { useAuth } from '@/lib/hooks/useAuth';
import StoryForm from '@/components/StoryForm';

export default function Home() {
  const { isAuthenticated, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      // Redirect to auth page if not authenticated
      window.location.href = '/auth';
    }
  }, [isAuthenticated, isLoading]);

  // Show loading spinner while checking authentication
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // Show nothing while redirecting
  if (!isAuthenticated) {
    return null;
  }

  // Show the story creation interface
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            You&apos;re The Hero! 🦸‍♂️
          </h1>
          <p className="text-xl text-gray-600">
            Create personalized audio stories for your child&apos;s Yoto player
          </p>
        </div>
        
        <StoryForm />
      </div>
    </div>
  );
}
