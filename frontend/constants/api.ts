import Constants from 'expo-constants';

// Derive backend host from Metro bundler so the app works on both a physical
// device (phone gets the LAN IP automatically) and the PC (gets localhost).
// Override by setting EXPO_PUBLIC_API_URL in .env.local.
function resolveApiUrl(): string {
  if (process.env.EXPO_PUBLIC_API_URL) return process.env.EXPO_PUBLIC_API_URL;

  // Expo SDK exposes the Metro host in different places across versions.
  const raw: string =
    (Constants.expoGoConfig as any)?.debuggerHost ??           // SDK 49+ Expo Go
    (Constants.manifest2 as any)?.extra?.expoGo?.debuggerHost ?? // SDK 46-48
    (Constants as any).manifest?.debuggerHost ??               // SDK < 46
    Constants.expoConfig?.hostUri ??                           // last resort
    '';

  const host = raw.split(':')[0] || '127.0.0.1';
  return `http://${host}:8000`;
}

export const API_URL = resolveApiUrl();

/**
 * Vocabulary Coach Endpoints
 * - All endpoints require Bearer token in Authorization header
 * - Token obtained from Firebase Auth: await auth.currentUser?.getIdToken()
 * 
 * For web/custom URL, set EXPO_PUBLIC_API_URL environment variable
 */
export const VOCABULARY_ENDPOINTS = {
  // Get a personalized exercise (targets user's generic word patterns)
  EXERCISE: `${API_URL}/vocabulary/exercise`,
  
  // Submit answer and get feedback
  SUBMIT: `${API_URL}/vocabulary/submit`,
  
  // Analyze text and auto-track generic word patterns
  // NEW: Automatically saves patterns to Firestore for personalization
  ANALYZE: `${API_URL}/vocabulary/analyze`,
  
  // Get user's detected generic words sorted by frequency
  // NEW: Returns top patterns for thesis validation
  PATTERNS: `${API_URL}/vocabulary/patterns`,
  
  // Get overall progress (total attempts, correct answers, mastery breakdown)
  PROGRESS: `${API_URL}/vocabulary/progress`,
  
  // Get daily statistics for the past N days
  STATS: `${API_URL}/vocabulary/stats`,
  
  // Admin: Populate vocabulary bank with 570 academic words
  // NEW: Called once at deployment
  SEED: `${API_URL}/vocabulary/seed`,
  
  // Transcribe audio using Groq Whisper (backend)
  // NEW: Sends audio file, returns transcribed text
  TRANSCRIBE: `${API_URL}/vocabulary/transcribe`,
  
  // FEATURE 24: Generate context-aware pronunciation sentences
  // Personalizes exercises based on user interests and difficulty
  GENERATE_CONTEXT_SENTENCE: `${API_URL}/vocabulary/generate-context-aware-sentence`,
  
  // FEATURE 25: Analyze pronunciation with emotion & confidence detection
  // Returns: pronunciation score, emotion analysis, speech quality metrics
  ANALYZE_PRONUNCIATION_WITH_EMOTION: `${API_URL}/vocabulary/analyze-pronunciation-with-emotion`,
  
  // FEATURE 16: Generate phonetic breakdown using IPA
  // Shows exact phoneme differences between target and user pronunciation
  PHONETIC_BREAKDOWN: `${API_URL}/vocabulary/phonetic-breakdown`,
  
  // FEATURE 17: Generate word family drilling exercises
  // Related word forms: noun, verb, adjective, gerund, etc.
  WORD_FAMILY: `${API_URL}/vocabulary/word-family`,
  
  // FEATURE 15: Generate highly personalized exercises
  // Based on: weak areas, difficulty, learning style, time available
  PERSONALIZED_EXERCISE: `${API_URL}/vocabulary/personalized-exercise`,
  
  // FEATURE 14: Analyze recording quality in real-time
  // Detects: silence, noise, amplitude, quality issues
  ANALYZE_RECORDING_QUALITY: `${API_URL}/vocabulary/analyze-recording-quality`,

  // CEFR Vocabulary Classification (EVP / new-GSL / AWL / NAWL / AVL)
  // Returns: distribution A1–C2, vocab_cefr_level, word_tags [{word, level}]
  CLASSIFY_TEXT: `${API_URL}/vocabulary/classify-text`,

  // Exam Profile: IELTS bands (1–9) + Cambridge CEFR level
  // Indicators: MTLD, Lexical Density, Subordination Index + client metrics
  // Sources: McCarthy & Jarvis (2010); Halliday (1989); Hunt (1965); IELTS descriptors
  EXAM_PROFILE: `${API_URL}/vocabulary/exam-profile`,

  // Romanian Interference Error Detector — Pungă & Pârlog (2015) + Popescu (2013)
  // 7 categories: articles, prepositions, word order, double negation, false friends, tense, collocations
  // Returns: errors[], error_count, severity_score, categories{}
  DETECT_ERRORS: `${API_URL}/vocabulary/detect-errors`,

  // COCA Genre Classifier — Davies (Corpus of Contemporary American English)
  // 5 top-level domains: SPOK / FIC / MAG / NEWS / ACAD
  // Returns: distribution, dominant_genre, coverage, genre_words
  CLASSIFY_GENRE: `${API_URL}/vocabulary/classify-genre`,

  // Persist a completed speaking/writing session to Firestore
  SAVE_SESSION: `${API_URL}/vocabulary/save-session`,

  // SM-2 review state: due / learning / mastered / new word counts + lists
  // Used by Practice Hub Retention tab
  SRS_STATE: `${API_URL}/vocabulary/srs-state`,

  // All speaking sessions from Firestore (survives app reinstall)
  // Used by History screen as fallback/supplement to AsyncStorage
  SESSIONS: `${API_URL}/vocabulary/sessions`,
};

// Health check endpoint — verifies external APIs (Groq, ElevenLabs, Firebase)
// Use before a demo to confirm everything is reachable + quota is not exhausted.
export const HEALTH_ENDPOINT = `${API_URL}/health`;

// Practice hub — closes the diagnostic ⇄ intervention loop
// Adaptive: LLM exercises targeting the user's weakest measured indicator
// Retention: Cepeda (2006) spaced re-use tracking
// Reading / Listening: 3rd and 4th skill coverage
export const PRACTICE_ENDPOINTS = {
  ADAPTIVE:           `${API_URL}/practice/adaptive`,
  WORD_RETENTION:     `${API_URL}/practice/word-retention`,
  READING:            `${API_URL}/practice/reading`,
  LISTENING_GENERATE: `${API_URL}/practice/listening/generate`,
  LISTENING_SCORE:    `${API_URL}/practice/listening/score`,
};