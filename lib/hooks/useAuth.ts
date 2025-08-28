import { useState, useEffect } from 'react';
import { isTokenExpired } from '@/lib/auth/yoto';

interface TokenData {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in?: number;
}

interface UseAuthReturn {
  isAuthenticated: boolean;
  isLoading: boolean;
  token: TokenData | null;
  logout: () => void;
}

export function useAuth(): UseAuthReturn {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [token, setToken] = useState<TokenData | null>(null);

  useEffect(() => {
    const checkAuth = () => {
      try {
        const storedToken = localStorage.getItem('yoto_token');
        
        if (!storedToken) {
          setIsAuthenticated(false);
          setToken(null);
          setIsLoading(false);
          return;
        }

        const tokenData: TokenData = JSON.parse(storedToken);
        
        // Check if token is expired
        if (!tokenData.access_token || isTokenExpired(tokenData.access_token)) {
          // Token is expired, remove it
          localStorage.removeItem('yoto_token');
          setIsAuthenticated(false);
          setToken(null);
          setIsLoading(false);
          return;
        }

        // Token is valid
        setToken(tokenData);
        setIsAuthenticated(true);
        setIsLoading(false);
      } catch (error) {
        console.error('Error checking authentication:', error);
        // Invalid token data, remove it
        localStorage.removeItem('yoto_token');
        setIsAuthenticated(false);
        setToken(null);
        setIsLoading(false);
      }
    };

    checkAuth();

    // Listen for storage changes (e.g., login in another tab)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'yoto_token') {
        checkAuth();
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  const logout = () => {
    localStorage.removeItem('yoto_token');
    setIsAuthenticated(false);
    setToken(null);
    // Redirect to login
    window.location.href = '/auth';
  };

  return {
    isAuthenticated,
    isLoading,
    token,
    logout
  };
}