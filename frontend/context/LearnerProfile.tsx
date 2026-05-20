import React, { createContext, useState, useContext, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface PhonemeStats {
  phoneme: string;
  attempts: number;
  correct_attempts: number;
  accuracy: number; // 0-100
  last_practiced: string;
}

export interface LearnerAdaptiveProfile {
  // User ID
  user_id: string;

  // Current difficulty level
  current_level: 'beginner' | 'intermediate' | 'advanced';

  // Learning pace (auto-adjusted)
  learning_pace: 'slow' | 'normal' | 'fast';

  // Phoneme performance tracking
  phoneme_stats: PhonemeStats[];

  // Overall metrics
  total_sessions: number;
  average_accuracy: number;
  total_words_practiced: number;

  // Weak areas (updated dynamically)
  weak_phonemes: string[];
  strong_phonemes: string[];

  // Learning velocity
  learning_velocity: number; // words per hour
  accuracy_trend: number; // -10 to +10 (trend)

  // Preferences
  preferred_modality: 'auditory' | 'reading' | 'kinesthetic';
  session_duration: number; // minutes

  // Timestamps
  created_at: string;
  last_updated: string;
  last_session: string;
}

interface LearnerProfileContextType {
  profile: LearnerAdaptiveProfile;
  updatePhonemePerformance: (phoneme: string, accuracy: number) => void;
  updateSessionMetrics: (wordsCount: number, sessionDuration: number) => void;
  getAdaptiveDifficulty: () => 'beginner' | 'intermediate' | 'advanced';
  getWeakPhonemes: () => string[];
  getStrongPhonemes: () => string[];
  loadProfile: (userId: string) => Promise<void>;
  saveProfile: () => Promise<void>;
}

const LearnerProfileContext = createContext<LearnerProfileContextType | undefined>(undefined);

const DEFAULT_PROFILE: LearnerAdaptiveProfile = {
  user_id: '',
  current_level: 'beginner',
  learning_pace: 'normal',
  phoneme_stats: [],
  total_sessions: 0,
  average_accuracy: 0,
  total_words_practiced: 0,
  weak_phonemes: [],
  strong_phonemes: [],
  learning_velocity: 0,
  accuracy_trend: 0,
  preferred_modality: 'auditory',
  session_duration: 20,
  created_at: new Date().toISOString(),
  last_updated: new Date().toISOString(),
  last_session: new Date().toISOString(),
};

export const LearnerProfileProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [profile, setProfile] = useState<LearnerAdaptiveProfile>(DEFAULT_PROFILE);

  // Auto-load profile on mount with anonymous user
  useEffect(() => {
    const initProfile = async () => {
      try {
        const stored = await AsyncStorage.getItem('learner_profile_anonymous');
        if (stored) {
          setProfile(JSON.parse(stored));
        } else {
          const newProfile = { ...DEFAULT_PROFILE, user_id: 'anonymous' };
          setProfile(newProfile);
          await AsyncStorage.setItem(
            'learner_profile_anonymous',
            JSON.stringify(newProfile)
          );
        }
      } catch (error) {
        console.error('Error initializing profile:', error);
        setProfile({ ...DEFAULT_PROFILE, user_id: 'anonymous' });
      }
    };

    initProfile();
  }, []);

  // Load profile from AsyncStorage
  const loadProfile = async (userId: string) => {
    try {
      const stored = await AsyncStorage.getItem(`learner_profile_${userId}`);
      if (stored) {
        setProfile(JSON.parse(stored));
      } else {
        const newProfile = { ...DEFAULT_PROFILE, user_id: userId };
        setProfile(newProfile);
        await AsyncStorage.setItem(
          `learner_profile_${userId}`,
          JSON.stringify(newProfile)
        );
      }
    } catch (error) {
      console.error('Error loading profile:', error);
      const newProfile = { ...DEFAULT_PROFILE, user_id: userId };
      setProfile(newProfile);
    }
  };

  // Save profile to AsyncStorage
  const saveProfile = async () => {
    if (!profile) return;
    try {
      await AsyncStorage.setItem(
        `learner_profile_${profile.user_id}`,
        JSON.stringify(profile)
      );
    } catch (error) {
      console.error('Error saving profile:', error);
    }
  };

  // Update performance for a specific phoneme
  const updatePhonemePerformance = (phoneme: string, accuracy: number) => {
    if (!profile) return;

    const updatedProfile = { ...profile };
    const statIndex = updatedProfile.phoneme_stats.findIndex((p) => p.phoneme === phoneme);

    if (statIndex >= 0) {
      const stat = updatedProfile.phoneme_stats[statIndex];
      stat.attempts += 1;
      if (accuracy >= 75) stat.correct_attempts += 1;
      stat.accuracy = (stat.correct_attempts / stat.attempts) * 100;
      stat.last_practiced = new Date().toISOString();
    } else {
      updatedProfile.phoneme_stats.push({
        phoneme,
        attempts: 1,
        correct_attempts: accuracy >= 75 ? 1 : 0,
        accuracy: accuracy >= 75 ? 100 : 0,
        last_practiced: new Date().toISOString(),
      });
    }

    // Recalculate weak/strong phonemes
    updatedProfile.weak_phonemes = updatedProfile.phoneme_stats
      .filter((p) => p.accuracy < 60)
      .map((p) => p.phoneme);

    updatedProfile.strong_phonemes = updatedProfile.phoneme_stats
      .filter((p) => p.accuracy >= 85)
      .map((p) => p.phoneme);

    // Update average accuracy
    const totalAccuracy = updatedProfile.phoneme_stats.reduce((sum, p) => sum + p.accuracy, 0);
    updatedProfile.average_accuracy = updatedProfile.phoneme_stats.length
      ? totalAccuracy / updatedProfile.phoneme_stats.length
      : 0;

    updatedProfile.last_updated = new Date().toISOString();

    setProfile(updatedProfile);
  };

  // Update session metrics
  const updateSessionMetrics = (wordsCount: number, sessionDuration: number) => {
    if (!profile) return;

    const updatedProfile = { ...profile };
    updatedProfile.total_sessions += 1;
    updatedProfile.total_words_practiced += wordsCount;
    updatedProfile.learning_velocity = updatedProfile.total_words_practiced / (updatedProfile.total_sessions * updatedProfile.session_duration);
    updatedProfile.last_session = new Date().toISOString();

    // Adjust learning pace based on accuracy trend
    if (updatedProfile.average_accuracy > 85) {
      updatedProfile.learning_pace = 'fast';
    } else if (updatedProfile.average_accuracy < 60) {
      updatedProfile.learning_pace = 'slow';
    } else {
      updatedProfile.learning_pace = 'normal';
    }

    updatedProfile.last_updated = new Date().toISOString();
    setProfile(updatedProfile);
  };

  // Adaptive difficulty calculator
  const getAdaptiveDifficulty = (): 'beginner' | 'intermediate' | 'advanced' => {
    if (!profile) return 'beginner';

    // Rule 1: If accuracy > 85%, increase difficulty
    if (profile.average_accuracy > 85) {
      return 'advanced';
    }

    // Rule 2: If accuracy 60-85%, stay at intermediate
    if (profile.average_accuracy >= 60) {
      return 'intermediate';
    }

    // Rule 3: If accuracy < 60%, go back to beginner
    return 'beginner';
  };

  // Get weak phonemes (top 3 to focus on)
  const getWeakPhonemes = (): string[] => {
    if (!profile || profile.phoneme_stats.length === 0) return [];

    return profile.phoneme_stats
      .sort((a, b) => a.accuracy - b.accuracy)
      .slice(0, 3)
      .map((p) => p.phoneme);
  };

  // Get strong phonemes (mastered)
  const getStrongPhonemes = (): string[] => {
    if (!profile) return [];

    return profile.phoneme_stats
      .filter((p) => p.accuracy >= 90)
      .map((p) => p.phoneme);
  };

  const value: LearnerProfileContextType = {
    profile,
    updatePhonemePerformance,
    updateSessionMetrics,
    getAdaptiveDifficulty,
    getWeakPhonemes,
    getStrongPhonemes,
    loadProfile,
    saveProfile,
  };

  return (
    <LearnerProfileContext.Provider value={value}>
      {children}
    </LearnerProfileContext.Provider>
  );
};

export const useLearnerProfile = (): LearnerProfileContextType => {
  const context = useContext(LearnerProfileContext);
  if (!context) {
    throw new Error('useLearnerProfile must be used within LearnerProfileProvider');
  }
  return context;
};
