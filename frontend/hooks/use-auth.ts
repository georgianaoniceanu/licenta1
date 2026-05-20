import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';

interface AuthState {
  token: string | null;
  email: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}

export const useAuth = () => {
  const [authState, setAuthState] = useState<AuthState>({
    token: null,
    email: null,
    isLoading: true,
    isAuthenticated: false,
  });
  const router = useRouter();

  useEffect(() => {
    const loadAuthState = async () => {
      try {
        const token = await AsyncStorage.getItem('authToken');
        const email = await AsyncStorage.getItem('userEmail');
        
        setAuthState({
          token: token || null,
          email: email || null,
          isLoading: false,
          isAuthenticated: !!token,
        });
      } catch (error) {
        console.error('Failed to load auth state:', error);
        setAuthState(prev => ({ ...prev, isLoading: false }));
      }
    };

    loadAuthState();
  }, []);

  const logout = useCallback(async () => {
    try {
      await AsyncStorage.removeItem('authToken');
      await AsyncStorage.removeItem('userEmail');
      setAuthState({
        token: null,
        email: null,
        isLoading: false,
        isAuthenticated: false,
      });
      router.replace('/login');
    } catch (error) {
      console.error('Logout failed:', error);
    }
  }, [router]);

  const getAuthHeader = useCallback(() => {
    if (authState.token) {
      return {
        'Authorization': `Bearer ${authState.token}`,
        'Content-Type': 'application/json',
      };
    }
    return { 'Content-Type': 'application/json' };
  }, [authState.token]);

  return {
    ...authState,
    logout,
    getAuthHeader,
  };
};
