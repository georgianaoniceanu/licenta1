import { useState, useCallback } from 'react';
import { VOCABULARY_ENDPOINTS } from '@/constants/api';

export interface LexicalPattern {
  word: string;
  better_alternative: string;
  frequency: number;
  explanation: string;
}

export interface VocabularyAnalysis {
  improved_text: string;
  suggestions: Array<{
    original: string;
    suggestion: string;
    explanation: string;
  }>;
}

/**
 * Hook for vocabulary coach operations
 * Handles text analysis, pattern retrieval, and pattern-based personalization
 */
export const useVocabularyCoach = () => {
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzingError, setAnalyzingError] = useState<string | null>(null);
  const [patterns, setPatterns] = useState<LexicalPattern[]>([]);
  const [patternsLoading, setPatternsLoading] = useState(false);
  const [patternsError, setPatternsError] = useState<string | null>(null);

  /**
   * Analyze text and auto-track generic word patterns
   * Saves detected patterns to Firestore for personalization
   */
  const analyzeText = useCallback(
    async (text: string, token: string | undefined): Promise<VocabularyAnalysis | null> => {
      if (!token) {
        setAnalyzingError('Authentication required');
        return null;
      }

      setAnalyzing(true);
      setAnalyzingError(null);

      try {
        const response = await fetch(VOCABULARY_ENDPOINTS.ANALYZE, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ text }),
        });

        if (!response.ok) {
          throw new Error('Failed to analyze text');
        }

        const data = await response.json();
        return data.data;
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        setAnalyzingError(message);
        return null;
      } finally {
        setAnalyzing(false);
      }
    },
    []
  );

  /**
   * Fetch user's detected generic word patterns
   * Sorted by frequency (highest first)
   * Used to demonstrate thesis validation and personalization
   */
  const fetchPatterns = useCallback(
    async (token: string | undefined) => {
      if (!token) {
        setPatternsError('Authentication required');
        return;
      }

      setPatternsLoading(true);
      setPatternsError(null);

      try {
        const response = await fetch(VOCABULARY_ENDPOINTS.PATTERNS, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          throw new Error('Failed to fetch patterns');
        }

        const data = await response.json();
        setPatterns(data.data || []);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        setPatternsError(message);
        setPatterns([]);
      } finally {
        setPatternsLoading(false);
      }
    },
    []
  );

  return {
    // Text analysis
    analyzeText,
    analyzing,
    analyzingError,

    // Lexical patterns
    patterns,
    patternsLoading,
    patternsError,
    fetchPatterns,
  };
};
