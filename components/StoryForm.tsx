'use client';

import { useState } from 'react';
import { useAuth } from '@/lib/hooks/useAuth';
import {
  sanitizeInput,
  validateChildName,
  validateAdventureType,
  validateSpecialSkill,
  validateStorySetting
} from '@/lib/utils/sanitization';

interface StoryFormData {
  childName: string;
  adventureType: string;
  specialSkill: string;
  storySetting: string;
}

interface FormErrors {
  childName?: string;
  adventureType?: string;
  specialSkill?: string;
  storySetting?: string;
  general?: string;
}

interface GeneratedStory {
  story: string;
  wordCount: number;
  metadata: {
    childName: string;
    adventureType: string;
    specialSkill?: string;
    storySetting?: string;
    generatedAt: string;
  };
}

const ADVENTURE_TYPES = [
  { value: '', label: 'Choose an adventure...' },
  { value: 'magical-forest', label: '🌲 Magical Forest' },
  { value: 'space-adventure', label: '🚀 Space Adventure' },
  { value: 'underwater-journey', label: '🌊 Underwater Journey' },
  { value: 'fairy-tale-castle', label: '🏰 Fairy Tale Castle' },
  { value: 'animal-safari', label: '🦁 Animal Safari' },
  { value: 'pirate-treasure', label: '🏴‍☠️ Pirate Treasure Hunt' },
  { value: 'superhero-city', label: '🦸‍♂️ Superhero City' },
  { value: 'time-travel', label: '⏰ Time Travel Adventure' },
];

export default function StoryForm() {
  const { logout } = useAuth();
  const [formData, setFormData] = useState<StoryFormData>({
    childName: '',
    adventureType: '',
    specialSkill: '',
    storySetting: '',
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [generatedStory, setGeneratedStory] = useState<GeneratedStory | null>(null);
  const [isSendingToYoto, setIsSendingToYoto] = useState(false);

  const handleInputChange = (field: keyof StoryFormData, value: string) => {
    const sanitizedValue = sanitizeInput(value);
    setFormData(prev => ({
      ...prev,
      [field]: sanitizedValue
    }));
    
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({
        ...prev,
        [field]: undefined
      }));
    }
  };

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    // Validate child name
    if (!formData.childName.trim()) {
      newErrors.childName = "Child's name is required";
    } else if (formData.childName.length < 2 || formData.childName.length > 20) {
      newErrors.childName = "Name must be between 2 and 20 characters";
    } else if (!validateChildName(formData.childName)) {
      newErrors.childName = "Please enter a valid name using only letters, spaces, hyphens, and apostrophes";
    }

    // Validate adventure type
    if (!formData.adventureType) {
      newErrors.adventureType = "Please choose an adventure type";
    } else if (!validateAdventureType(formData.adventureType)) {
      newErrors.adventureType = "Please select a valid adventure type";
    }

    // Validate optional fields
    if (formData.specialSkill && !validateSpecialSkill(formData.specialSkill)) {
      newErrors.specialSkill = "Special skill contains inappropriate content or is too long";
    }

    if (formData.storySetting && !validateStorySetting(formData.storySetting)) {
      newErrors.storySetting = "Story setting contains inappropriate content or is too long";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);
    setErrors({});

    try {
      const response = await fetch('/api/story/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        throw new Error('Failed to create story');
      }

      const result = await response.json();
      
      // Set the generated story data
      setGeneratedStory({
        story: result.story,
        wordCount: result.wordCount,
        metadata: result.metadata
      });
      
      setSuccess(true);
      
      // Clear success message after 5 seconds
      setTimeout(() => setSuccess(false), 5000);
      
    } catch (error) {
      console.error('Story creation error:', error);
      setErrors({
        general: 'Failed to create story. Please try again.'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSendToYoto = async () => {
    if (!generatedStory) return;

    setIsSendingToYoto(true);
    setErrors({}); // Clear any previous errors
    
    try {
      // Get Yoto access token from localStorage (set during auth)
      const storedToken = localStorage.getItem('yoto_token');
      
      if (!storedToken) {
        throw new Error('Please authenticate with Yoto first. Redirecting to login...');
      }

      // Parse the full token object 
      let tokenData;
      try {
        tokenData = JSON.parse(storedToken);
        
        if (!tokenData.access_token) {
          throw new Error('Invalid token data - missing access_token');
        }
        
        console.log('Authentication token found, attempting Yoto upload...');
      } catch (parseError) {
        console.error('Token parsing error:', parseError);
        throw new Error('Invalid authentication token. Please log in again.');
      }

      const response = await fetch('/api/story/send-to-yoto', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${JSON.stringify(tokenData)}`  // Send complete token data
        },
        body: JSON.stringify({
          story: generatedStory.story,
          storyMetadata: {
            childName: generatedStory.metadata.childName,
            adventureType: generatedStory.metadata.adventureType,
            specialSkill: generatedStory.metadata.specialSkill,
            title: `${generatedStory.metadata.childName}'s ${generatedStory.metadata.adventureType.replace('-', ' ')} Adventure`
          },
          voiceId: 'Xb7hH8MSUJpSbSDYk0k2' // Use the configured voice ID
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP ${response.status}: Failed to send to Yoto`);
      }

      const result = await response.json();
      
      // Show success message with details
      alert(
        `🎉 Story sent to Yoto successfully!\n\n` +
        `📖 Title: ${result.story.title}\n` +
        `🎵 Audio: ${result.audio.readableFileSize}MB\n` +
        `📱 Added to: ${result.yoto.cardTitle}\n\n` +
        `Check your Yoto app to find your new story!`
      );
      
    } catch (error) {
      console.error('Failed to send to Yoto:', error);
      
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      
      // Handle specific error cases
      if (errorMessage.includes('authenticate') || errorMessage.includes('Authorization')) {
        setErrors({
          general: 'Authentication required. Please log in to your Yoto account first.'
        });
        // Optionally redirect to auth page after a delay
        setTimeout(() => {
          window.location.href = '/auth';
        }, 3000);
      } else {
        setErrors({
          general: `Failed to send story to Yoto: ${errorMessage}`
        });
      }
    } finally {
      setIsSendingToYoto(false);
    }
  };

  const handleCreateNewStory = () => {
    setGeneratedStory(null);
    setSuccess(false);
    setFormData({
      childName: '',
      adventureType: '',
      specialSkill: '',
      storySetting: '',
    });
    setErrors({});
  };

  // If we have a generated story, show the story preview instead of the form
  if (generatedStory) {
    return (
      <div className="max-w-2xl mx-auto">
        {/* Story Preview */}
        <div className="bg-white shadow rounded-lg p-6">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h3 className="text-2xl font-bold text-gray-900">
                {generatedStory.metadata.childName}&apos;s Adventure 📖
              </h3>
              <p className="text-sm text-gray-600">
                {generatedStory.wordCount} words • Generated on{' '}
                {new Date(generatedStory.metadata.generatedAt).toLocaleDateString()}
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleCreateNewStory}
                className="text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1 rounded-md"
              >
                Create New Story
              </button>
              <button
                onClick={logout}
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                Logout
              </button>
            </div>
          </div>

          <div className="prose max-w-none mb-6">
            <div className="bg-gray-50 rounded-lg p-4 max-h-96 overflow-y-auto">
              {generatedStory.story.split('\n').map((paragraph, index) => (
                <p key={index} className="mb-3 text-gray-800 leading-relaxed">
                  {paragraph}
                </p>
              ))}
            </div>
          </div>

          {/* Error Display */}
          {errors.general && (
            <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
              <p className="font-medium">Error</p>
              <p className="text-sm">{errors.general}</p>
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={handleSendToYoto}
              disabled={isSendingToYoto}
              className="flex-1 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-400 text-white font-medium py-3 px-4 rounded-lg transition duration-200 flex items-center justify-center"
            >
              {isSendingToYoto ? (
                <>
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Creating Audio & Uploading...
                </>
              ) : (
                'Send to Yoto Player 🎧'
              )}
            </button>
            
            <button
              onClick={() => {
                navigator.clipboard.writeText(generatedStory.story);
                alert('Story copied to clipboard! 📋');
              }}
              className="bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium py-3 px-4 rounded-lg transition duration-200"
            >
              Copy Text 📋
            </button>
          </div>

          <div className="mt-4 text-xs text-gray-500 text-center">
            <p>
              Adventure: {ADVENTURE_TYPES.find(t => t.value === generatedStory.metadata.adventureType)?.label || generatedStory.metadata.adventureType}
              {generatedStory.metadata.specialSkill && (
                <span> • Special Skill: {generatedStory.metadata.specialSkill}</span>
              )}
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Show the form if no story is generated
  return (
    <div className="max-w-2xl mx-auto">
      <div className="bg-white shadow rounded-lg p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-gray-900">
            Create Your Story
          </h2>
          <button
            onClick={logout}
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            Logout
          </button>
        </div>

        {success && (
          <div className="mb-6 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded">
            <p className="font-medium">Story created successfully! 🎉</p>
            <p className="text-sm">Your personalized story has been sent to your Yoto library.</p>
          </div>
        )}

        {errors.general && (
          <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
            <p>{errors.general}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Child's Name */}
          <div>
            <label htmlFor="childName" className="block text-sm font-medium text-gray-700">
              Child&apos;s Name *
            </label>
            <input
              type="text"
              id="childName"
              required
              maxLength={20}
              value={formData.childName}
              onChange={(e) => handleInputChange('childName', e.target.value)}
              className={`mt-1 block w-full border rounded-md shadow-sm px-3 py-2 text-gray-900 bg-white ${
                errors.childName 
                  ? 'border-red-300 focus:border-red-500 focus:ring-red-500' 
                  : 'border-gray-300 focus:border-indigo-500 focus:ring-indigo-500'
              }`}
              placeholder="Enter your child's name"
              aria-describedby="childName-error"
            />
            {errors.childName && (
              <p id="childName-error" className="mt-1 text-sm text-red-600">
                {errors.childName}
              </p>
            )}
          </div>

          {/* Adventure Type */}
          <div>
            <label htmlFor="adventureType" className="block text-sm font-medium text-gray-700">
              Adventure Type *
            </label>
            <select
              id="adventureType"
              required
              value={formData.adventureType}
              onChange={(e) => handleInputChange('adventureType', e.target.value)}
              className={`mt-1 block w-full border rounded-md shadow-sm px-3 py-2 text-gray-900 bg-white ${
                errors.adventureType 
                  ? 'border-red-300 focus:border-red-500 focus:ring-red-500' 
                  : 'border-gray-300 focus:border-indigo-500 focus:ring-indigo-500'
              }`}
              aria-describedby="adventureType-error"
            >
              {ADVENTURE_TYPES.map(type => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
            {errors.adventureType && (
              <p id="adventureType-error" className="mt-1 text-sm text-red-600">
                {errors.adventureType}
              </p>
            )}
          </div>

          {/* Special Skill */}
          <div>
            <label htmlFor="specialSkill" className="block text-sm font-medium text-gray-700">
              Special Skill or Power (Optional)
            </label>
            <input
              type="text"
              id="specialSkill"
              maxLength={50}
              value={formData.specialSkill}
              onChange={(e) => handleInputChange('specialSkill', e.target.value)}
              className={`mt-1 block w-full border rounded-md shadow-sm px-3 py-2 text-gray-900 bg-white ${
                errors.specialSkill 
                  ? 'border-red-300 focus:border-red-500 focus:ring-red-500' 
                  : 'border-gray-300 focus:border-indigo-500 focus:ring-indigo-500'
              }`}
              placeholder="e.g., flying, magic, super strength"
              aria-describedby="specialSkill-error"
            />
            {errors.specialSkill && (
              <p id="specialSkill-error" className="mt-1 text-sm text-red-600">
                {errors.specialSkill}
              </p>
            )}
            <p className="mt-1 text-xs text-gray-500">
              What special ability would your child have in this adventure?
            </p>
          </div>

          {/* Story Setting */}
          <div>
            <label htmlFor="storySetting" className="block text-sm font-medium text-gray-700">
              Story Setting (Optional)
            </label>
            <input
              type="text"
              id="storySetting"
              maxLength={100}
              value={formData.storySetting}
              onChange={(e) => handleInputChange('storySetting', e.target.value)}
              className={`mt-1 block w-full border rounded-md shadow-sm px-3 py-2 text-gray-900 bg-white ${
                errors.storySetting 
                  ? 'border-red-300 focus:border-red-500 focus:ring-red-500' 
                  : 'border-gray-300 focus:border-indigo-500 focus:ring-indigo-500'
              }`}
              placeholder="e.g., a peaceful village, a bustling city, a mysterious island"
              aria-describedby="storySetting-error"
            />
            {errors.storySetting && (
              <p id="storySetting-error" className="mt-1 text-sm text-red-600">
                {errors.storySetting}
              </p>
            )}
            <p className="mt-1 text-xs text-gray-500">
              Where does the adventure take place? (Optional - we&apos;ll choose if left blank)
            </p>
          </div>

          {/* Submit Button */}
          <div>
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <>
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Creating your story...
                </>
              ) : (
                'Create Story 🎬'
              )}
            </button>
          </div>
        </form>

        <div className="mt-6 text-center text-sm text-gray-500">
          <p>Stories are approximately 3-5 minutes long and perfect for bedtime! 🌙</p>
        </div>
      </div>
    </div>
  );
}