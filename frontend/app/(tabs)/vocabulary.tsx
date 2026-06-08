import { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  StatusBar,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
  TextInput,
  Alert,
  Platform,
  Animated,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { auth } from '@/config/firebase';
import { getFreshToken } from '@/utils/auth';
import { Audio } from 'expo-av';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Colors, Spacing, Animations } from '@/constants/theme';
import { VOCABULARY_ENDPOINTS } from '@/constants/api';
import Button from '@/components/ui/button';
import SavedSessions from '@/components/saved-sessions';
import type { VocabSession } from '@/utils/demoSessions';
import { getDemoAudio } from '@/constants/demoAudio';
import { playAudioAsset, stopAudioAsset } from '@/utils/voiceProfiles';

const { width } = Dimensions.get('window');

interface SuggestionCard {
  original_word: string;
  better_alternative: string;
  explanation: string;
}

interface SpeechQuality {
  pace: 'slow' | 'good' | 'fast';
  clarity: 'poor' | 'fair' | 'good' | 'excellent';
  rhythm: 'choppy' | 'irregular' | 'natural' | 'fluid';
  accent_strength: 'heavy' | 'moderate' | 'light' | 'native-like';
}

interface PhonemeError {
  position: string;
  target_phoneme: string;
  user_phoneme: string;
  explanation: string;
}

interface PhoneticBreakdown {
  target_ipa: string;
  user_ipa: string;
  phoneme_errors?: PhonemeError[];
}

interface WordForm {
  form: string;
  part_of_speech: string;
  definition: string;
  pronunciation: string;
  example_sentence: string;
}

interface WordFamily {
  target_word: string;
  related_forms: WordForm[];
}

interface PersonalizedExercise {
  exercise_type: string;
  difficulty: string;
  focus_area: string;
  word: string;
  context: string;
  personalization_score: number;
  target_word?: string;
  example_sentence?: string;
}

interface CefrData {
  distribution: Record<string, number>;
  vocab_cefr_level: string;
  highest_level_words: string[];
  word_tags: Array<{ word: string; level: string }>;
}

interface CambridgeCriterion {
  level: string;          // A1/A2/B1/B2/C1 (or '—' for N/A)
  descriptor: string;
}

interface CambridgeAssessment {
  overall_level: string;
  recommended_exam: string;
  advice: string;
  criteria: {
    pronunciation_fluency: CambridgeCriterion;
    language_resource:     CambridgeCriterion;
    discourse_management:  CambridgeCriterion;
  };
  source: string;
}

interface ExamProfile {
  mode?: 'speaking' | 'writing';
  fluency_coherence_label?: string;
  indicators: {
    mtld: number; lexical_density: number; subordination_index: number;
    syntactic_error_rate?: number; connective_density?: number;
    wps: number; filler_rate: number; mls: number;
    pronunciation_score: number; b2plus_pct: number;
    word_count: number; sentence_count: number;
  };
  ielts: {
    fluency_coherence: number; lexical_resource: number;
    grammatical_accuracy: number; pronunciation: number;
    overall: number; band_label: string;
  };
  cambridge: { level: string; exam: string; description: string };
  cambridge_assessment?: CambridgeAssessment;
  pte_core?: {
    speaking_score: number;
    score_range: string;
    clb_level: number | null;
    cefr_equivalent: string;
    description: string;
    source: string;
  };
  sources: string[];
}

type CocaGroup = 'SPOK' | 'FIC' | 'MAG' | 'NEWS' | 'ACAD' | 'Web' | 'Blog' | 'Mov' | 'TV';

interface GenreSubcat {
  name: string;     // "ACAD:Sci/Tech"
  group: CocaGroup;
  pct: number;
}

interface GenreProfile {
  distribution_groups: Record<CocaGroup, number>;
  distribution_subcats: Record<string, number>;   // all 96 subcats with non-zero
  top_subcategories: GenreSubcat[];
  dominant_group: CocaGroup | null;
  dominant_label: string | null;
  dominant_description: string | null;
  dominant_subcategory: string | null;
  matched_words: number;
  total_words: number;
  coverage: number;
  group_breakdown: Record<CocaGroup, Array<{ name: string; pct: number }>>;
  source: string;
}

interface RomanianError {
  error_type: string;
  message: string;
  severity: 1 | 2 | 3;
  occurrences: number;
  source: string;
}

interface RomanianErrorHighlight {
  start: number;
  end: number;
  matched_text: string;
  error_type: string;
  category: string;
  severity: 1 | 2 | 3;
  message: string;
}

interface RomanianErrors {
  errors: RomanianError[];
  highlights: RomanianErrorHighlight[];
  error_count: number;
  severity_score: number;
  categories: Record<string, number>;
  research: string;
}

interface SpeechMetrics {
  wps: number;
  filler_rate: number;
  filler_count: number;
  mls: number;
  word_count: number;
}

interface AnalysisResult {
  improved_text: string;
  suggestions: SuggestionCard[];
  pronunciation_score?: number;
  corrections?: string;
  speech_quality?: SpeechQuality;
  phonetic_breakdown?: PhoneticBreakdown;
  word_family?: WordFamily;
  personalized_exercise?: PersonalizedExercise;
  cefr_data?: CefrData;
  speech_metrics?: SpeechMetrics;
  exam_profile?: ExamProfile;
  romanian_errors?: RomanianErrors;
  genre_profile?: GenreProfile;
}

type ResultTab = 'words' | 'pronunciation' | 'phonetics' | 'exercise' | 'grammar' | 'exam';

type FeatherName = React.ComponentProps<typeof Feather>['name'];
const SPEAKING_PROMPTS: { id: number; icon: FeatherName; title: string; prompt: string }[] = [
  { id: 1,  icon: 'heart',       title: 'Hobby & Interests',       prompt: 'Talk about your favorite hobby and why you enjoy it. (60–90 seconds)' },
  { id: 2,  icon: 'compass',     title: 'Travel Experience',        prompt: 'Describe a memorable travel experience or dream destination. (60–90 seconds)' },
  { id: 3,  icon: 'briefcase',   title: 'Career Goals',             prompt: 'What career goals do you have and how do you plan to achieve them? (60–90 seconds)' },
  { id: 4,  icon: 'sun',         title: 'Daily Routine',            prompt: 'Describe your typical day and what makes it meaningful. (60–90 seconds)' },
  { id: 5,  icon: 'book-open',   title: 'Learning a Skill',         prompt: 'What skill would you like to learn and why? (60–90 seconds)' },
  { id: 6,  icon: 'award',       title: 'Personal Achievement',     prompt: 'Share an achievement you are proud of and what you learned. (60–90 seconds)' },
  { id: 7,  icon: 'globe',       title: 'Global Issue',             prompt: 'Describe a global issue you care about and how it affects people. (60–90 seconds)' },
  { id: 8,  icon: 'smartphone',  title: 'Technology Impact',        prompt: 'How has technology changed your life or work? What are the benefits and drawbacks? (60–90 seconds)' },
  { id: 9,  icon: 'users',       title: 'An Important Relationship', prompt: 'Talk about someone who has influenced you significantly and why. (60–90 seconds)' },
  { id: 10, icon: 'trending-up', title: 'Future Plans',             prompt: 'Where do you see yourself in five years? What steps are you taking to get there? (60–90 seconds)' },
];

const CEFR_COLOR: Record<string, string> = {
  A1: '#94A3B8', A2: '#64748B', B1: '#8B5CF6', B2: '#8B5CF6', C1: '#8B5CF6', C2: '#0FBA9A',
};

const MODE_LABEL: Record<'record' | 'type' | 'upload', string> = {
  record: 'Speaking', type: 'Typed', upload: 'Uploaded audio',
};

// IELTS Speaking Band Descriptors — British Council / Cambridge ESOL (2024)
const IELTS_BAND_DESC: Record<number, string> = {
  9: 'Speaks fluently without effort. Cohesive features are used naturally. Fully develops all topics.',
  8: 'Speaks fluently with only occasional repetition. Uses a wide range of vocabulary and grammar accurately.',
  7: 'Speaks at length without noticeable effort; uses cohesive devices, though with some inaccuracy.',
  6: 'Willing to speak at length but may lose coherence. Uses a range of connectives; some repetition.',
  5: 'Maintains flow but uses repetition and slow speech. Limited range of connectives.',
  4: 'Cannot respond without noticeable pauses. Limited ability to link ideas; often loses coherence.',
  3: 'Speaks with long pauses. Gives only simple responses; very limited ability to link sentences.',
  2: 'Pauses lengthily before most words. Little communication possible.',
  1: 'No communication possible. No rateable language.',
};

// CEFR Can-Do Statements — Council of Europe Global Scale (2020)
const CEFR_CAN_DO: Record<string, string> = {
  C2: 'Can express themselves spontaneously, very fluently and precisely with fine shades of meaning.',
  C1: 'Can express ideas fluently without much searching. Uses language flexibly for academic and professional purposes.',
  B2: 'Can interact with fluency and spontaneity on a wide range of topics. Can explain and discuss advantages/disadvantages.',
  B1: 'Can deal with most everyday situations. Can describe experiences and briefly justify opinions.',
  A2: 'Can communicate in simple routine tasks on familiar topics. Can describe immediate environment.',
  A1: 'Can understand and use familiar everyday expressions. Can interact in a simple way.',
};

type ExamKey = 'ielts_academic' | 'ielts_general' | 'cambridge_fce' | 'cambridge_cae' | 'cambridge_cpe' | 'toefl_ibt' | 'pte_core' | 'general';
type CriteriaKey = 'fluency_coherence' | 'lexical_resource' | 'grammatical_accuracy' | 'pronunciation';

const EXAM_FOCUS: Record<ExamKey, {
  label: string; color: string; icon: string;
  priority: CriteriaKey[];
  weights: Record<CriteriaKey, number>;
  tip: string;
}> = {
  ielts_academic: {
    label: 'IELTS Academic', color: '#0FBA9A', icon: 'file-text' as FeatherName,
    priority: ['fluency_coherence', 'lexical_resource', 'grammatical_accuracy', 'pronunciation'],
    weights: { fluency_coherence: 25, lexical_resource: 25, grammatical_accuracy: 25, pronunciation: 25 },
    tip: 'All 4 criteria carry equal weight (25%). Fluency & Coherence is hardest to improve quickly — prioritise it.',
  },
  ielts_general: {
    label: 'IELTS General', color: '#0FBA9A', icon: 'file-text' as FeatherName,
    priority: ['fluency_coherence', 'lexical_resource', 'grammatical_accuracy', 'pronunciation'],
    weights: { fluency_coherence: 25, lexical_resource: 25, grammatical_accuracy: 25, pronunciation: 25 },
    tip: 'Same criteria as IELTS Academic Speaking. Aim for Band 6+ for visa and migration purposes.',
  },
  cambridge_fce: {
    label: 'Cambridge B2 First (FCE)', color: '#8B5CF6', icon: 'award' as FeatherName,
    priority: ['grammatical_accuracy', 'lexical_resource', 'fluency_coherence', 'pronunciation'],
    weights: { grammatical_accuracy: 35, lexical_resource: 30, fluency_coherence: 20, pronunciation: 15 },
    tip: 'FCE prioritises Grammar (35%) and Vocabulary (30%). Improve B2-level word use and complex sentence structures.',
  },
  cambridge_cae: {
    label: 'Cambridge C1 Advanced (CAE)', color: '#8B5CF6', icon: 'award' as FeatherName,
    priority: ['grammatical_accuracy', 'lexical_resource', 'fluency_coherence', 'pronunciation'],
    weights: { grammatical_accuracy: 35, lexical_resource: 35, fluency_coherence: 20, pronunciation: 10 },
    tip: 'CAE demands C1-level vocabulary (high MTLD) and complex grammatical structures. Pronunciation is less weighted.',
  },
  cambridge_cpe: {
    label: 'Cambridge C2 Proficiency (CPE)', color: '#8B5CF6', icon: 'star' as FeatherName,
    priority: ['lexical_resource', 'grammatical_accuracy', 'fluency_coherence', 'pronunciation'],
    weights: { lexical_resource: 40, grammatical_accuracy: 35, fluency_coherence: 15, pronunciation: 10 },
    tip: 'CPE requires near-native lexical precision. MTLD and B2+ vocabulary % are the critical indicators.',
  },
  toefl_ibt: {
    label: 'TOEFL iBT', color: '#8B5CF6', icon: 'book' as FeatherName,
    priority: ['fluency_coherence', 'grammatical_accuracy', 'lexical_resource', 'pronunciation'],
    weights: { fluency_coherence: 35, grammatical_accuracy: 25, lexical_resource: 25, pronunciation: 15 },
    tip: 'TOEFL rates Delivery (fluency) and Language Use most. Reduce fillers and improve Words/sec.',
  },
  pte_core: {
    label: 'PTE Core', color: '#8B5CF6', icon: 'globe' as FeatherName,
    priority: ['fluency_coherence', 'pronunciation', 'lexical_resource', 'grammatical_accuracy'],
    weights: { fluency_coherence: 30, pronunciation: 25, lexical_resource: 25, grammatical_accuracy: 20 },
    tip: 'PTE is AI-scored. Natural pacing (WPS) and Pronunciation clarity are most critical.',
  },
  general: {
    label: 'General English', color: '#64748B', icon: 'layers' as FeatherName,
    priority: ['fluency_coherence', 'lexical_resource', 'grammatical_accuracy', 'pronunciation'],
    weights: { fluency_coherence: 30, lexical_resource: 30, grammatical_accuracy: 25, pronunciation: 15 },
    tip: 'Focus on vocabulary range and fluency for all-round improvement.',
  },
};

const FILLER_WORDS = new Set([
  'um', 'uh', 'er', 'ah', 'hmm', 'like', 'basically', 'literally',
  'actually', 'right', 'well', 'okay', 'yeah', 'you', 'know', 'mean',
]);

export default function VocabularyScreen() {
  const router = useRouter();

  const [targetExam, setTargetExam] = useState<ExamKey>('general');
  const [selectedPrompt, setSelectedPrompt] = useState<number | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [transcribedText, setTranscribedText] = useState('');
  const [transcriptionStatus, setTranscriptionStatus] = useState('');
  const [transcribing, setTranscribing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [manualText, setManualText] = useState('');
  const [inputMode, setInputMode] = useState<'record' | 'type' | 'upload'>('record');
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [recording, setRecording] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<ResultTab>('words');
  const [savedAudioId, setSavedAudioId] = useState<string | null>(null);
  const [savedAudioPlaying, setSavedAudioPlaying] = useState(false);
  const [audioUri, setAudioUri] = useState<string | null>(null);
  const [audioPlaying, setAudioPlaying] = useState(false);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const audioElRef = useRef<HTMLAudioElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const isWeb = Platform.OS === 'web';

  const resultsOpacity = useRef(new Animated.Value(0)).current;
  const resultsScale = useRef(new Animated.Value(0.95)).current;
  const waveValues = useRef(Array.from({ length: 5 }, () => new Animated.Value(0.3))).current;
  const waveLoops = useRef<Animated.CompositeAnimation[]>([]);
  const recordingTimeRef = useRef(0);

  useEffect(() => { recordingTimeRef.current = recordingTime; }, [recordingTime]);

  useEffect(() => {
    AsyncStorage.getItem('userTargetExam').then(val => {
      if (val && val in EXAM_FOCUS) setTargetExam(val as ExamKey);
    });
  }, []);

  useEffect(() => {
    AsyncStorage.getItem('active_demo_preset').then(v => {
      if (v) { setIsDemoMode(true); setInputMode('type'); }
    });
  }, []);

  const currentPrompt = selectedPrompt ? SPEAKING_PROMPTS.find(p => p.id === selectedPrompt) : null;

  useEffect(() => {
    if (analysisResult) {
      setActiveTab('words');
      Animated.parallel([
        Animated.timing(resultsOpacity, { toValue: 1, duration: Animations.normal, useNativeDriver: true }),
        Animated.spring(resultsScale, { toValue: 1, speed: 15, bounciness: 8, useNativeDriver: true }),
      ]).start();
    } else {
      resultsOpacity.setValue(0);
      resultsScale.setValue(0.95);
    }
  }, [analysisResult]);

  useEffect(() => {
    if (isRecording) {
      waveLoops.current = waveValues.map((v, i) =>
        Animated.loop(
          Animated.sequence([
            Animated.timing(v, { toValue: 1, duration: 350 + i * 60, useNativeDriver: true }),
            Animated.timing(v, { toValue: 0.15, duration: 350 + i * 60, useNativeDriver: true }),
          ])
        )
      );
      waveLoops.current.forEach((a, i) => setTimeout(() => a.start(), i * 100));
    } else {
      waveLoops.current.forEach(a => a.stop());
      waveValues.forEach(v => v.setValue(0.3));
    }
    return () => waveLoops.current.forEach(a => a.stop());
  }, [isRecording]);

  useEffect(() => {
    if (isWeb) return;
    (async () => {
      const { granted } = await Audio.requestPermissionsAsync();
      if (!granted) {
        Alert.alert('Permission Required', 'Microphone access is required to record audio');
      } else {
        await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      }
    })();
  }, [isWeb]);

  useEffect(() => {
    if (!isRecording) return;
    const interval = setInterval(() => setRecordingTime(prev => prev + 1), 1000);
    return () => clearInterval(interval);
  }, [isRecording]);

  const startRecording = useCallback(async () => {
    try {
      setRecordingTime(0);
      setIsRecording(true);
      setTranscriptionStatus('[🎤 Recording...]');
      setTranscribedText('');
      // Revoke previous blob URL to free memory
      if (audioUri && audioUri.startsWith('blob:')) {
        try { URL.revokeObjectURL(audioUri); } catch {}
      }
      setAudioUri(null);
      setAudioPlaying(false);

      if (isWeb) {
        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error('Microphone API not available. Use HTTPS or localhost.');
        }
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        // Pick a mime type the browser actually supports
        const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4'];
        const mimeType = candidates.find(t => (window as any).MediaRecorder?.isTypeSupported?.(t)) || '';
        const mediaRecorder = mimeType
          ? new MediaRecorder(stream, { mimeType })
          : new MediaRecorder(stream);
        const chunks: Blob[] = [];
        mediaRecorder.ondataavailable = (e) => { if (e.data && e.data.size > 0) chunks.push(e.data); };
        // Promise that resolves when onstop fires with the final blob
        const blobPromise = new Promise<Blob>((resolve, reject) => {
          mediaRecorder.onstop = () => {
            try {
              const type = mediaRecorder.mimeType || mimeType || 'audio/webm';
              resolve(new Blob(chunks, { type }));
            } catch (err) { reject(err); }
          };
          mediaRecorder.onerror = (e: any) => reject(e?.error || new Error('MediaRecorder error'));
        });
        mediaRecorder.start();
        (window as any).__mediaRecorder = mediaRecorder;
        (window as any).__audioStream = stream;
        (window as any).__blobPromise = blobPromise;
        (window as any).__mimeType = mediaRecorder.mimeType || mimeType || 'audio/webm';
      } else {
        const newRecording = new Audio.Recording();
        try {
          await newRecording.prepareToRecordAsync({
            android: { extension: '.m4a', outputFormat: 2, audioEncoder: 3, sampleRate: 44100, numberOfChannels: 2, bitRate: 128000 },
            ios: { extension: '.m4a', audioQuality: Audio.IOSAudioQuality.MAX, sampleRate: 44100, numberOfChannels: 2, bitRate: 128000, linearPCMBitDepth: 16, linearPCMIsBigEndian: false, linearPCMIsFloat: false },
            web: { mimeType: 'audio/webm', bitsPerSecond: 128000 },
          });
          await newRecording.startAsync();
          setRecording(newRecording);
        } catch {
          await newRecording.prepareToRecordAsync();
          await newRecording.startAsync();
          setRecording(newRecording);
        }
      }
    } catch (error) {
      setIsRecording(false);
      setTranscriptionStatus('');
      Alert.alert('Recording Failed', 'Could not start recording: ' + String(error));
    }
  }, [isWeb]);

  const stopRecording = useCallback(async () => {
    try {
      if (isWeb) {
        const mediaRecorder = (window as any).__mediaRecorder;
        const audioStream = (window as any).__audioStream;
        const blobPromise: Promise<Blob> | undefined = (window as any).__blobPromise;
        if (!mediaRecorder || !blobPromise) {
          setIsRecording(false);
          setTranscriptionStatus('⚠️ Recording was not started — try again.');
          return;
        }
        setIsRecording(false);
        setTranscriptionStatus('⏹ Finalizing audio…');
        try {
          mediaRecorder.stop();
        } catch {}
        audioStream?.getTracks().forEach((track: any) => track.stop());
        const blob = await blobPromise;
        if (!blob || blob.size === 0) {
          setTranscriptionStatus('⚠️ No audio captured. Check your microphone permission.');
          return;
        }
        // Save blob URL for in-app playback
        try {
          if (audioUri && audioUri.startsWith('blob:')) URL.revokeObjectURL(audioUri);
          setAudioUri(URL.createObjectURL(blob));
        } catch {}
        setTranscriptionStatus('📤 Sending to backend…');
        await sendAudioBlobToBackend(blob);
      } else {
        if (!recording) { setIsRecording(false); return; }
        await recording.stopAndUnloadAsync();
        const uri = recording.getURI();
        setIsRecording(false);
        setRecording(null);
        if (uri) {
          setAudioUri(uri);
          setTranscriptionStatus('📤 Sending to backend…');
          await sendAudioToBackend(uri);
        }
      }
    } catch (error) {
      setIsRecording(false);
      setTranscribedText('');
      setTranscriptionStatus('❌ ' + (error instanceof Error ? error.message : String(error)));
    }
  }, [recording, isWeb]);

  const sendAudioBlobToBackend = useCallback(async (blob: Blob) => {
    try {
      setTranscribing(true);
      const token = await getFreshToken();
      if (!token) {
        setTranscriptionStatus('❌ Not authenticated. Please sign in again.');
        setTranscribing(false);
        return;
      }

      // File extension matches the recorded/uploaded mime type
      const mime = (window as any).__mimeType || blob.type || 'audio/webm';
      const ext =
        mime.includes('mp4') || mime.includes('m4a')             ? 'm4a'
        : mime.includes('mpeg') || mime.includes('mp3')          ? 'mp3'
        : mime.includes('wav')                                   ? 'wav'
        : mime.includes('ogg')                                   ? 'ogg'
        : mime.includes('flac')                                  ? 'flac'
        : 'webm';
      const formData = new FormData();
      formData.append('file', blob, `recording.${ext}`);

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30000);
      const response = await fetch(VOCABULARY_ENDPOINTS.TRANSCRIBE, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!response.ok) {
        const errText = await response.text().catch(() => '');
        setTranscriptionStatus(`❌ Backend error ${response.status}${errText ? ': ' + errText.slice(0, 80) : ''}`);
        setTranscribing(false);
        return;
      }

      const data = await response.json();
      const text = data.data?.transcribed_text || data.transcribed_text || data.text || '';
      if (!text.trim()) {
        setTranscriptionStatus('⚠️ No speech detected. Try recording again — speak clearly for 5+ seconds.');
        setTranscribing(false);
        return;
      }
      setTranscribedText(text);
      setTranscriptionStatus('');
      setTranscribing(false);
    } catch (error: any) {
      setTranscribedText('');
      setTranscribing(false);
      const msg = error?.name === 'AbortError'
        ? 'Backend timed out (30s). Is the API server running?'
        : (error?.message || String(error));
      setTranscriptionStatus('❌ ' + msg);
    }
  }, [auth]);

  const sendAudioToBackend = useCallback(async (audioUri: string) => {
    try {
      setTranscribing(true);
      const token = await getFreshToken();
      if (!token) {
        setTranscriptionStatus('❌ Not authenticated. Please sign in again.');
        setTranscribing(false);
        return;
      }

      const formData = new FormData();
      formData.append('file', { uri: audioUri, name: 'recording.m4a', type: 'audio/m4a' } as any);

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30000);
      const response = await fetch(VOCABULARY_ENDPOINTS.TRANSCRIBE, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!response.ok) {
        const errText = await response.text().catch(() => '');
        setTranscriptionStatus(`❌ Backend error ${response.status}${errText ? ': ' + errText.slice(0, 80) : ''}`);
        setTranscribing(false);
        return;
      }

      const data = await response.json();
      const text = data.data?.transcribed_text || data.transcribed_text || data.text || '';
      if (!text.trim()) {
        setTranscriptionStatus('⚠️ No speech detected. Try recording again — speak clearly for 5+ seconds.');
        setTranscribing(false);
        return;
      }
      setTranscribedText(text);
      setTranscriptionStatus('');
      setTranscribing(false);
    } catch (error: any) {
      setTranscribedText('');
      setTranscribing(false);
      const msg = error?.name === 'AbortError'
        ? 'Backend timed out (30s). Is the API server running?'
        : (error?.message || String(error));
      setTranscriptionStatus('❌ ' + msg);
    }
  }, [auth]);

  const analyzeText = useCallback(async () => {
    const textToAnalyze = inputMode === 'type' ? manualText : transcribedText;
    if (!textToAnalyze.trim() || textToAnalyze.startsWith('[')) {
      Alert.alert('Invalid Input', 'Please provide actual text to analyze');
      return;
    }

    try {
      setLoading(true);
      const token = await getFreshToken();
      if (!token) { Alert.alert('Auth Error', 'Not authenticated'); return; }

      // ───────────────────────────────────────────────────────────────────────
      // Helper: POST JSON to endpoint, returns parsed data or null on error
      // ───────────────────────────────────────────────────────────────────────
      const post = async (url: string, body: any): Promise<any> => {
        try {
          const r = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify(body),
          });
          if (!r.ok) return null;
          return await r.json();
        } catch { return null; }
      };

      const isWriting = inputMode === 'type';
      const sourceText = isWriting ? manualText : transcribedText;
      const firstWord = textToAnalyze.trim().split(' ')[0].toLowerCase();

      // ───────────────────────────────────────────────────────────────────────
      // ROUND 1 — Independent calls fired in parallel
      //   No data dependencies between them; total time = max(individual times)
      //   instead of sum (~60% reduction over previous sequential flow).
      // ───────────────────────────────────────────────────────────────────────
      const round1 = await Promise.allSettled([
        // 0: Vocabulary suggestions (always required — first result expected)
        post(VOCABULARY_ENDPOINTS.ANALYZE, { text: textToAnalyze }),
        // 1: Phonetic IPA breakdown (audio modes + prompt only)
        (inputMode !== 'type' && transcribedText && currentPrompt)
          ? post(VOCABULARY_ENDPOINTS.PHONETIC_BREAKDOWN, {
              target_text: currentPrompt.prompt, transcribed_text: transcribedText,
            })
          : Promise.resolve(null),
        // 3: Word family
        (firstWord.length >= 2)
          ? post(VOCABULARY_ENDPOINTS.WORD_FAMILY, { target_word: firstWord })
          : Promise.resolve(null),
        // 4: Personalised exercise
        post(VOCABULARY_ENDPOINTS.PERSONALIZED_EXERCISE, {
          difficulty: 'intermediate', learning_style: 'pronunciation', time_available: 'medium',
        }),
        // 5: CEFR vocabulary classification
        sourceText && sourceText.trim().length > 0
          ? post(VOCABULARY_ENDPOINTS.CLASSIFY_TEXT, { text: sourceText })
          : Promise.resolve(null),
        // 6: COCA genre classification
        sourceText && sourceText.trim().length > 0
          ? post(VOCABULARY_ENDPOINTS.CLASSIFY_GENRE, { text: sourceText })
          : Promise.resolve(null),
        // 7: Romanian L1 error detector
        post(VOCABULARY_ENDPOINTS.DETECT_ERRORS, { text: textToAnalyze }),
      ]);

      const settled = (i: number) => round1[i].status === 'fulfilled' ? (round1[i] as any).value : null;
      const analyzeData = settled(0);
      const phoneticData = settled(1);
      const wordFamilyData = settled(2);
      const exerciseData = settled(3);
      const cefrData = settled(4);
      const genreData = settled(5);
      const errorsData = settled(6);

      // Hard-fail if the primary vocabulary analyzer failed (this is the only required call)
      if (!analyzeData) {
        Alert.alert('Analysis Error', 'Failed to analyze text. Check your connection.');
        return;
      }

      let finalResult: AnalysisResult = {
        ...(analyzeData.data || {}),
        suggestions: analyzeData.data?.suggestions || [],
      };
      if (phoneticData?.data) finalResult.phonetic_breakdown = phoneticData.data;
      if (wordFamilyData?.data) finalResult.word_family = wordFamilyData.data;
      if (exerciseData?.data) finalResult.personalized_exercise = exerciseData.data;
      if (cefrData?.data) finalResult.cefr_data = cefrData.data;
      if (genreData?.data) finalResult.genre_profile = genreData.data;
      if (errorsData?.data) finalResult.romanian_errors = errorsData.data;

      // ───────────────────────────────────────────────────────────────────────
      // Speech / writing metrics — purely client-side, instant
      // ───────────────────────────────────────────────────────────────────────
      let sm: SpeechMetrics | null = null;
      if (sourceText && sourceText.trim().length > 0) {
        const rawWords = sourceText.trim().split(/\s+/).filter(w => w.length > 0);
        const fillers = isWriting ? [] : rawWords.filter(w =>
          FILLER_WORDS.has(w.toLowerCase().replace(/[^a-z]/g, ''))
        );
        const sentences = sourceText.split(/[.!?]+/).filter(s => s.trim().length > 3);
        sm = {
          wps: !isWriting && recordingTimeRef.current > 0
            ? parseFloat((rawWords.length / recordingTimeRef.current).toFixed(2)) : 0,
          filler_rate: isWriting ? 0 : parseFloat(
            (fillers.length / Math.max(rawWords.length, 1) * 100).toFixed(1)
          ),
          filler_count: fillers.length,
          mls: parseFloat((rawWords.length / Math.max(sentences.length, 1)).toFixed(1)),
          word_count: rawWords.length,
        };
        finalResult.speech_metrics = sm;
      }

      // ───────────────────────────────────────────────────────────────────────
      // ROUND 2 — Exam profile depends on CEFR distribution from Round 1
      // ───────────────────────────────────────────────────────────────────────
      let examData: any = null;
      if (sm && sourceText) {
        examData = await post(VOCABULARY_ENDPOINTS.EXAM_PROFILE, {
          text: sourceText,
          pronunciation_score: finalResult.pronunciation_score ?? 0,
          wps: sm.wps,
          filler_rate: sm.filler_rate,
          mls: sm.mls,
          cefr_distribution: finalResult.cefr_data?.distribution ?? {},
          input_mode: isWriting ? 'writing' : 'speaking',
        });
        if (examData?.data) finalResult.exam_profile = examData.data;
      }

      // ───────────────────────────────────────────────────────────────────────
      // ROUND 3 — Persist sessions to AsyncStorage (parallel writes)
      // ───────────────────────────────────────────────────────────────────────
      if (sm) {
        const cefrLevel = finalResult.cefr_data?.vocab_cefr_level ?? 'B1';
        const cefrScore = { A1: 20, A2: 35, B1: 50, B2: 70, C1: 85, C2: 95 }[cefrLevel] ?? 50;
        const ts = Date.now();

        // Build all entries
        const cafEntry = {
          ts,
          C: Math.min(100, Math.round(sm.mls / 18 * 100)),
          A: isWriting ? 0 : (finalResult.pronunciation_score ?? 0),
          F: isWriting ? 75 : Math.max(0, Math.round(100 - sm.filler_rate * 4)),
          cefr: cefrLevel,
          wps: sm.wps,
        };
        const examEntry = examData?.data ? {
          ts,
          ielts_overall: examData.data.ielts.overall,
          cambridge_level: examData.data.cambridge.level,
          cambridge_exam: examData.data.cambridge.exam,
          ielts: examData.data.ielts,
          pte_core: examData.data.pte_core ?? null,
        } : null;
        const grammarEntry = errorsData?.data ? {
          ts,
          severity_score: errorsData.data.severity_score,
          error_count: errorsData.data.error_count,
          categories: errorsData.data.categories,
        } : null;
        const genreEntry = genreData?.data ? {
          ts,
          dominant_genre: genreData.data.dominant_group,
          dominant_subcategory: genreData.data.dominant_subcategory,
          distribution: genreData.data.distribution_groups,
          cefr_level: cefrLevel,
          cefr_score: cefrScore,
          input_mode: isWriting ? 'writing' : 'speaking',
        } : null;

        // Append-and-cap helper
        const append = async (key: string, entry: any, cap: number) => {
          if (!entry) return;
          try {
            const prev = await AsyncStorage.getItem(key);
            const arr = prev ? JSON.parse(prev) : [];
            arr.push(entry);
            await AsyncStorage.setItem(key, JSON.stringify(arr.slice(-cap)));
          } catch {}
        };

        // Run all writes in parallel (local cache + Firestore)
        await Promise.all([
          append('vf_caf_sessions', cafEntry, 20),
          append('vf_exam_sessions', examEntry, 20),
          append('vf_grammar_sessions', grammarEntry, 20),
          append('vf_genre_sessions', genreEntry, 30),
          post(VOCABULARY_ENDPOINTS.SAVE_SESSION, {
            ts,
            input_mode: isWriting ? 'writing' : 'speaking',
            caf: cafEntry ?? {},
            exam: examEntry ?? {},
            grammar: grammarEntry ?? {},
            genre: genreEntry ?? {},
          }).catch(() => {}),
        ]);
      }

      setAnalysisResult(finalResult);

      // Persist as a saved session (shows in "Practised answers")
      try {
        const savedText = isWriting ? manualText : transcribedText;
        const lvl = finalResult?.cefr_data?.vocab_cefr_level || 'B1';
        const overall = finalResult?.exam_profile?.ielts?.overall;
        const score = typeof overall === 'number' ? Math.round((overall / 9) * 100) : 60;
        const session = {
          ts: Date.now(),
          topic: currentPrompt?.title || 'Practice',
          promptId: selectedPrompt || 3,
          mode: inputMode,
          text: savedText,
          level: lvl,
          score,
          result: finalResult,
        };
        const raw = await AsyncStorage.getItem('vf_vocab_sessions');
        const arr = raw ? JSON.parse(raw) : [];
        await AsyncStorage.setItem('vf_vocab_sessions', JSON.stringify([session, ...arr].slice(0, 50)));
      } catch {}
    } catch {
      Alert.alert('Analysis Error', 'Failed to analyze text. Check your connection.');
    } finally {
      setLoading(false);
    }
  }, [inputMode, transcribedText, manualText, auth, currentPrompt]);

  const resetAnalysis = useCallback(() => {
    setAnalysisResult(null);
    setManualText('');
    setTranscribedText('');
    setTranscriptionStatus('');
    setSelectedPrompt(null);
    setInputMode('record');
    setIsRecording(false);
    setRecordingTime(0);
    setUploadedFileName(null);
    if (audioUri && audioUri.startsWith('blob:')) {
      try { URL.revokeObjectURL(audioUri); } catch {}
    }
    setAudioUri(null);
    setAudioPlaying(false);
    stopAudioAsset();
    setSavedAudioId(null);
    setSavedAudioPlaying(false);
  }, [audioUri]);

  // Stop any bundled recording when leaving the screen
  useEffect(() => () => { stopAudioAsset(); }, []);

  const toggleSavedAudio = useCallback(async () => {
    if (savedAudioPlaying) {
      await stopAudioAsset();
      setSavedAudioPlaying(false);
      return;
    }
    const mod = getDemoAudio(savedAudioId);
    if (!mod) return;
    await playAudioAsset(mod, {
      onStart: () => setSavedAudioPlaying(true),
      onEnd: () => setSavedAudioPlaying(false),
      onError: () => setSavedAudioPlaying(false),
    });
  }, [savedAudioId, savedAudioPlaying]);

  const togglePlayback = useCallback(() => {
    if (!audioUri) return;
    if (isWeb) {
      const el = audioElRef.current;
      if (!el) return;
      if (audioPlaying) { el.pause(); setAudioPlaying(false); }
      else {
        el.play().then(() => setAudioPlaying(true)).catch(() => setAudioPlaying(false));
      }
    }
  }, [audioUri, audioPlaying, isWeb]);

  // ── Audio file upload (for users who don't want to record live) ───────────
  const openFilePicker = useCallback(() => {
    if (isWeb) {
      fileInputRef.current?.click();
    } else {
      Alert.alert('Upload Audio', 'Audio upload is currently available in the web version. On mobile, please use the Microphone or Type options.');
    }
  }, [isWeb]);

  const handleFileSelected = useCallback(async (e: any) => {
    const file: File | undefined = e?.target?.files?.[0];
    // Reset the input so the same file can be re-selected later
    if (e?.target) e.target.value = '';
    if (!file) return;

    // Validate it's an audio file
    if (!file.type.startsWith('audio/') && !/\.(mp3|wav|m4a|ogg|webm|flac|aac)$/i.test(file.name)) {
      setTranscriptionStatus('⚠️ Please select an audio file (MP3, WAV, M4A, OGG, WebM).');
      return;
    }
    // Size guard — 15 MB
    if (file.size > 15 * 1024 * 1024) {
      setTranscriptionStatus('⚠️ File too large (max 15 MB). Trim the clip and try again.');
      return;
    }

    setUploadedFileName(file.name);
    setTranscribedText('');

    // Tell the backend uploader the correct mime type
    (window as any).__mimeType = file.type || 'audio/mpeg';

    // Create a playback URL
    try {
      if (audioUri && audioUri.startsWith('blob:')) URL.revokeObjectURL(audioUri);
      setAudioUri(URL.createObjectURL(file));
    } catch {}

    setTranscriptionStatus('📤 Uploading audio…');
    await sendAudioBlobToBackend(file);
  }, [audioUri, sendAudioBlobToBackend]);

  // ── Screen 1: Prompt Selection ─────────────────────────────────────
  if (!selectedPrompt) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="light-content" />
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Speaking Practice</Text>
          <Text style={styles.headerSubtitle}>Choose a topic and speak freely for 60–90 seconds</Text>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.promptsContainer}>
          {/* Previously practised answers — tap to open the full results */}
          <SavedSessions<VocabSession>
            storageKey="vf_vocab_sessions"
            title="Practised answers"
            accent={Colors.light.tint}
            getLabel={(s) => s.text}
            getScore={(s) => s.score}
            getTs={(s) => s.ts}
            getMeta={(s) => `${MODE_LABEL[s.mode]} · ${s.topic} · CEFR ${s.level}`}
            onPress={(s) => {
              setSelectedPrompt(s.promptId);
              setManualText(s.text);
              setTranscribedText(s.text);
              setInputMode(s.mode);
              setAnalysisResult(s.result as AnalysisResult);
              stopAudioAsset();
              setSavedAudioPlaying(false);
              setSavedAudioId(s.audioId ?? null);
            }}
          />

          {SPEAKING_PROMPTS.map(p => (
            <TouchableOpacity
              key={p.id}
              style={styles.promptCard}
              onPress={() => setSelectedPrompt(p.id)}
            >
              <View style={styles.promptIconWrap}>
                <Feather name={p.icon} size={20} color={Colors.light.tint} />
              </View>
              <View style={styles.promptTextWrap}>
                <Text style={styles.promptTitle}>{p.title}</Text>
                <Text style={styles.promptText}>{p.prompt}</Text>
              </View>
              <Text style={styles.promptCTA}>→</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    );
  }

  // ── Screen 2: Recording & Text Input ──────────────────────────────
  if (!analysisResult) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="light-content" />

        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => setSelectedPrompt(null)} style={styles.backBtn} activeOpacity={0.7}>
            <Text style={styles.backBtnText}>←  Back</Text>
          </TouchableOpacity>
          <Text style={[styles.topBarTitle, { flex: 1 }]}>{currentPrompt?.title}</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView showsVerticalScrollIndicator={false}>
          {/* Prompt Display */}
          <View style={styles.promptDisplay}>
            {currentPrompt && <Feather name={currentPrompt.icon} size={28} color={Colors.light.tint} style={{ marginBottom: 10 }} />}
            <Text style={styles.promptDisplayText}>{currentPrompt?.prompt}</Text>
          </View>

          {/* Demo banner */}
          {isDemoMode && (
            <View style={styles.demoBanner}>
              <Text style={styles.demoBannerTitle}>Demo Mode — Text / Upload Analysis</Text>
              <Text style={styles.demoBannerText}>
                Type at least 20 words, or use the 📁 Upload tab to analyse a pre-recorded audio file. Then tap Analyse for the full AI-powered vocabulary, grammar and exam profile.
              </Text>
            </View>
          )}

          {/* Input Mode Selector */}
          <View style={styles.modeSelector}>
            {(['record', 'upload', 'type'] as const).map(mode => (
              <TouchableOpacity
                key={mode}
                style={[styles.modeTab, inputMode === mode && styles.modeTabActive]}
                onPress={() => setInputMode(mode)}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Feather
                    name={mode === 'record' ? 'mic' : mode === 'upload' ? 'upload' : 'edit-3'}
                    size={13}
                    color={inputMode === mode ? Colors.light.tint : Colors.light.textSecondary}
                  />
                  <Text style={[styles.modeTabText, inputMode === mode && styles.modeTabTextActive]}>
                    {mode === 'record' ? 'Mic' : mode === 'upload' ? 'Upload' : 'Type'}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>

          {/* Recording Mode */}
          {inputMode === 'record' && (
            <View style={styles.recordingSection}>
              {/* Waveform + button */}
              <View style={styles.recordingControls}>
                <TouchableOpacity
                  style={[styles.recordBtn, isRecording && styles.recordBtnActive]}
                  onPress={isRecording ? stopRecording : startRecording}
                >
                  <Text style={styles.recordBtnText}>
                    {isRecording ? '⏹ Stop' : '● Record'}
                  </Text>
                </TouchableOpacity>

                <Text style={styles.recordingTimer}>
                  {Math.floor(recordingTime / 60)}:{String(recordingTime % 60).padStart(2, '0')}
                </Text>
              </View>

              {/* Animated Waveform */}
              {isRecording && (
                <View style={styles.waveformContainer}>
                  {waveValues.map((v, i) => (
                    <Animated.View
                      key={i}
                      style={[
                        styles.waveBar,
                        { transform: [{ scaleY: v }] },
                      ]}
                    />
                  ))}
                </View>
              )}

              {isRecording && (
                <View style={styles.qualityFeedbackBox}>
                  <View style={styles.qualityRow}>
                    <Text style={styles.qualityLabel}>Duration:</Text>
                    <Text style={recordingTime < 30 ? styles.qualityFeedbackWarning : styles.qualityFeedbackGood}>
                      {recordingTime < 30 ? `⏱️ Keep going (${30 - recordingTime}s more)` : `✓ Good length (${recordingTime}s)`}
                    </Text>
                  </View>
                  <View style={styles.qualityRow}>
                    <Text style={styles.qualityLabel}>Status:</Text>
                    <Text style={styles.qualityFeedbackActive}>🎤 Recording — speak clearly!</Text>
                  </View>
                </View>
              )}

              {transcribing && (
                <View style={styles.statusBox}>
                  <ActivityIndicator size="small" color={Colors.light.tint} />
                  <Text style={styles.statusText}>Processing audio...</Text>
                </View>
              )}

              {transcribedText && !isRecording && !transcribing && (
                <View style={styles.transcriptionBox}>
                  <Text style={styles.transcriptionLabel}>TRANSCRIBED</Text>
                  <Text style={styles.transcriptionText}>{transcribedText}</Text>
                  {audioUri && isWeb && (
                    <View style={styles.audioPlayerRow}>
                      <TouchableOpacity
                        onPress={togglePlayback}
                        style={[styles.audioPlayBtn, audioPlaying && { backgroundColor: Colors.light.error }]}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.audioPlayBtnText}>
                          {audioPlaying ? '⏸  Pause' : '▶  Play recording'}
                        </Text>
                      </TouchableOpacity>
                      <Text style={styles.audioHint}>Listen back to your speech</Text>
                      {/* Hidden HTML5 audio — controls programmatically via ref */}
                      {/* @ts-ignore */}
                      <audio
                        ref={audioElRef}
                        src={audioUri}
                        onEnded={() => setAudioPlaying(false)}
                        style={{ display: 'none' }}
                      />
                    </View>
                  )}
                </View>
              )}

              {transcriptionStatus && !isRecording && !transcribedText && !transcribing && (
                <View style={[
                  styles.statusBox,
                  transcriptionStatus.startsWith('❌') && { borderColor: Colors.light.error, backgroundColor: Colors.light.error + '10' },
                  transcriptionStatus.startsWith('⚠️') && { borderColor: Colors.light.warning, backgroundColor: Colors.light.warning + '10' },
                ]}>
                  <Text style={[
                    styles.statusText,
                    transcriptionStatus.startsWith('❌') && { color: Colors.light.error, fontWeight: '700' },
                  ]}>{transcriptionStatus}</Text>
                </View>
              )}
            </View>
          )}

          {/* Upload Mode */}
          {inputMode === 'upload' && (
            <View style={styles.recordingSection}>
              {/* Hidden HTML file input (web) */}
              {isWeb && (
                // @ts-ignore — RN-Web renders DOM input
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="audio/*,.mp3,.wav,.m4a,.ogg,.webm,.flac,.aac"
                  onChange={handleFileSelected}
                  style={{ display: 'none' }}
                />
              )}

              <View style={styles.uploadCard}>
                <Feather name="upload" size={32} color={Colors.light.tint} style={{ marginBottom: 8 }} />
                <Text style={styles.uploadTitle}>Upload an audio recording</Text>
                <Text style={styles.uploadDesc}>
                  MP3, WAV, M4A, OGG or WebM · max 15 MB.{'\n'}We&apos;ll transcribe and analyse it just like a live recording.
                </Text>

                <TouchableOpacity
                  style={styles.uploadBtn}
                  onPress={openFilePicker}
                  activeOpacity={0.85}
                  disabled={transcribing}
                >
                  <Text style={styles.uploadBtnText}>
                    {uploadedFileName ? '🔄  Choose a different file' : '⬆️  Choose audio file'}
                  </Text>
                </TouchableOpacity>

                {uploadedFileName && (
                  <Text style={styles.uploadFileName} numberOfLines={1}>
                    📎 {uploadedFileName}
                  </Text>
                )}

                {!isWeb && (
                  <Text style={styles.uploadFallback}>
                    Upload is available in the web version. On mobile use Microphone or Type.
                  </Text>
                )}
              </View>

              {transcribing && (
                <View style={styles.statusBox}>
                  <ActivityIndicator size="small" color={Colors.light.tint} />
                  <Text style={styles.statusText}>Transcribing uploaded audio...</Text>
                </View>
              )}

              {transcribedText && !transcribing && (
                <View style={styles.transcriptionBox}>
                  <Text style={styles.transcriptionLabel}>TRANSCRIBED</Text>
                  <Text style={styles.transcriptionText}>{transcribedText}</Text>
                  {audioUri && isWeb && (
                    <View style={styles.audioPlayerRow}>
                      <TouchableOpacity
                        onPress={togglePlayback}
                        style={[styles.audioPlayBtn, audioPlaying && { backgroundColor: Colors.light.error }]}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.audioPlayBtnText}>
                          {audioPlaying ? '⏸  Pause' : '▶  Play upload'}
                        </Text>
                      </TouchableOpacity>
                      <Text style={styles.audioHint}>Listen to the uploaded file</Text>
                      {/* @ts-ignore */}
                      <audio
                        ref={audioElRef}
                        src={audioUri}
                        onEnded={() => setAudioPlaying(false)}
                        style={{ display: 'none' }}
                      />
                    </View>
                  )}
                </View>
              )}

              {transcriptionStatus && !transcribing && !transcribedText && (
                <View style={[
                  styles.statusBox,
                  transcriptionStatus.startsWith('❌') && { borderColor: Colors.light.error, backgroundColor: Colors.light.error + '10' },
                  transcriptionStatus.startsWith('⚠️') && { borderColor: Colors.light.warning, backgroundColor: Colors.light.warning + '10' },
                ]}>
                  <Text style={[
                    styles.statusText,
                    transcriptionStatus.startsWith('❌') && { color: Colors.light.error, fontWeight: '700' },
                  ]}>{transcriptionStatus}</Text>
                </View>
              )}
            </View>
          )}

          {/* Type Mode */}
          {inputMode === 'type' && (
            <View style={styles.typeSection}>
              <TextInput
                style={styles.textInput}
                placeholder="Type or paste your text here..."
                placeholderTextColor={Colors.light.textLight}
                multiline
                numberOfLines={8}
                value={manualText}
                onChangeText={setManualText}
              />
              <Text style={styles.charCount}>{manualText.length} characters</Text>
            </View>
          )}

          {/* Analyze Button */}
          <View style={[styles.actionArea, (isRecording || transcribing) && styles.actionAreaDisabled]}>
            <Button
              label={loading ? 'Analyzing...' : 'Analyze Text'}
              onPress={analyzeText}
              disabled={isRecording || transcribing || loading || (inputMode === 'type' ? !manualText : !transcribedText)}
              variant="primary"
              style={styles.analyzeBtn}
            />
          </View>
        </ScrollView>
      </View>
    );
  }

  // ── Screen 3: Results ─────────────────────────────────────────────
  const pronunciationScore = analysisResult?.pronunciation_score ?? null;
  const suggestionCount = analysisResult?.suggestions?.length ?? 0;

  const grammarErrorCount = analysisResult?.romanian_errors?.error_count;

  const TABS: { key: ResultTab; label: string; icon: FeatherName; count?: number }[] = [
    { key: 'words',        label: 'Words',     icon: 'file-text',      count: suggestionCount > 0 ? suggestionCount : undefined },
    { key: 'pronunciation',label: 'Speaking',  icon: 'mic'             },
    { key: 'phonetics',    label: 'Phonetics', icon: 'activity'        },
    { key: 'exercise',     label: 'Exercise',  icon: 'zap'             },
    { key: 'grammar',      label: 'Grammar',   icon: 'alert-triangle',  count: grammarErrorCount && grammarErrorCount > 0 ? grammarErrorCount : undefined },
    { key: 'exam',         label: 'Exam',      icon: 'award'           },
  ];

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />

      <View style={styles.topBar}>
        <TouchableOpacity onPress={resetAnalysis} style={styles.backBtn} activeOpacity={0.7}>
          <Text style={styles.backBtnText}>←  Back</Text>
        </TouchableOpacity>
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={styles.topBarTitle}>Results</Text>
          <Text style={styles.resultModeBadge}>{MODE_LABEL[inputMode]}</Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      {/* Score summary card */}
      <View style={styles.scoreSummaryCard}>
        <View style={styles.scoreSummaryItem}>
          <Text style={styles.scoreSummaryValue}>
            {pronunciationScore !== null ? `${pronunciationScore}` : '—'}
          </Text>
          <Text style={styles.scoreSummaryLabel}>Pronunciation</Text>
        </View>
        <View style={styles.scoreDivider} />
        <View style={styles.scoreSummaryItem}>
          <Text style={[styles.scoreSummaryValue, { color: suggestionCount === 0 ? Colors.light.success : Colors.light.warning }]}>
            {suggestionCount}
          </Text>
          <Text style={styles.scoreSummaryLabel}>Suggestions</Text>
        </View>
      </View>

      {/* Play the saved recording (speaking / uploaded sessions) */}
      {savedAudioId && (
        <TouchableOpacity style={styles.playRecBtn} onPress={toggleSavedAudio} activeOpacity={0.85}>
          <Text style={styles.playRecIcon}>{savedAudioPlaying ? '⏸' : '▶'}</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.playRecText}>
              {savedAudioPlaying ? 'Playing recording…' : 'Play your recording'}
            </Text>
            <Text style={styles.playRecSub}>{MODE_LABEL[inputMode]} · original audio</Text>
          </View>
          <Text style={styles.playRecBadge}>REC</Text>
        </TouchableOpacity>
      )}

      {/* Speech Metrics Strip — Foster & Tavakoli (2009); Bao et al. (2026) */}
      {analysisResult?.speech_metrics && (
        <View style={styles.metricsStrip}>
          <View style={styles.metricChip}>
            <Text style={styles.metricChipValue}>{analysisResult.speech_metrics.wps}</Text>
            <Text style={styles.metricChipLabel}>WPS</Text>
          </View>
          <View style={styles.metricChipDivider} />
          <View style={styles.metricChip}>
            <Text style={[styles.metricChipValue, {
              color: analysisResult.speech_metrics.filler_rate > 10
                ? Colors.light.warning : Colors.light.success,
            }]}>
              {analysisResult.speech_metrics.filler_rate}%
            </Text>
            <Text style={styles.metricChipLabel}>Fillers</Text>
          </View>
          <View style={styles.metricChipDivider} />
          <View style={styles.metricChip}>
            <Text style={styles.metricChipValue}>{analysisResult.speech_metrics.mls}</Text>
            <Text style={styles.metricChipLabel}>MLS</Text>
          </View>
          <View style={styles.metricChipDivider} />
          {analysisResult.cefr_data ? (
            <View style={[styles.metricChip, {
              backgroundColor: CEFR_COLOR[analysisResult.cefr_data.vocab_cefr_level] + '18',
              borderRadius: 8, paddingHorizontal: 10,
            }]}>
              <Text style={[styles.metricChipValue, {
                color: CEFR_COLOR[analysisResult.cefr_data.vocab_cefr_level],
              }]}>
                {analysisResult.cefr_data.vocab_cefr_level}
              </Text>
              <Text style={styles.metricChipLabel}>Vocab</Text>
            </View>
          ) : (
            <View style={styles.metricChip}>
              <Text style={styles.metricChipValue}>{analysisResult.speech_metrics.word_count}</Text>
              <Text style={styles.metricChipLabel}>Words</Text>
            </View>
          )}
        </View>
      )}


      {/* Tabs */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabsScroll} contentContainerStyle={styles.tabsContent}>
        {TABS.map(tab => (
          <TouchableOpacity
            key={tab.key}
            style={[styles.tabBtn, activeTab === tab.key && styles.tabBtnActive]}
            onPress={() => setActiveTab(tab.key)}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
              <Feather
                name={tab.icon}
                size={13}
                color={activeTab === tab.key ? Colors.light.tint : Colors.light.textSecondary}
              />
              <Text style={[styles.tabBtnText, activeTab === tab.key && styles.tabBtnTextActive]}>
                {tab.label}{tab.count !== undefined ? ` (${tab.count})` : ''}
              </Text>
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <Animated.ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.resultsContent}
        style={{ opacity: resultsOpacity, transform: [{ scale: resultsScale }] }}
      >
        {/* ── Tab: Words ─────────────────────────────────────────── */}
        {activeTab === 'words' && (
          <>
            {/* CEFR Vocabulary Distribution — EVP / new-GSL / AWL / NAWL */}
            {analysisResult?.cefr_data && (
              <View style={styles.cefrCard}>
                <Text style={styles.sectionTitle}>Vocabulary Level Distribution</Text>

                {/* Stacked bar */}
                <View style={styles.cefrBar}>
                  {(Object.entries(analysisResult.cefr_data.distribution) as [string, number][])
                    .filter(([, pct]) => pct > 0)
                    .map(([lvl, pct]) => (
                      <View
                        key={lvl}
                        style={[styles.cefrBarSeg, {
                          flex: pct,
                          backgroundColor: CEFR_COLOR[lvl],
                        }]}
                      />
                    ))}
                </View>

                {/* Legend */}
                <View style={styles.cefrLegend}>
                  {(Object.entries(analysisResult.cefr_data.distribution) as [string, number][])
                    .filter(([, pct]) => pct > 0)
                    .map(([lvl, pct]) => (
                      <View key={lvl} style={styles.cefrLegendItem}>
                        <View style={[styles.cefrDot, { backgroundColor: CEFR_COLOR[lvl] }]} />
                        <Text style={styles.cefrLegendText}>{lvl} {pct}%</Text>
                      </View>
                    ))}
                </View>

                {/* Advanced words */}
                {analysisResult.cefr_data.highest_level_words.length > 0 && (
                  <View style={styles.advancedWordsBlock}>
                    <Text style={styles.advancedWordsLabel}>Advanced words you used</Text>
                    <View style={styles.wordChipsRow}>
                      {analysisResult.cefr_data.highest_level_words.map((w, i) => (
                        <View key={i} style={styles.wordChip}>
                          <Text style={styles.wordChipText}>{w}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                )}

                {/* Tagged transcript preview */}
                {analysisResult.cefr_data.word_tags.length > 0 && (
                  <View style={styles.taggedTranscript}>
                    <Text style={styles.advancedWordsLabel}>Your words — coloured by CEFR level</Text>
                    <View style={styles.taggedRow}>
                      {analysisResult.cefr_data.word_tags.map((t, i) => (
                        <View key={i} style={[styles.taggedWord, {
                          borderBottomColor: CEFR_COLOR[t.level],
                        }]}>
                          <Text style={styles.taggedWordText}>{t.word}</Text>
                          <Text style={[styles.taggedWordLevel, { color: CEFR_COLOR[t.level] }]}>
                            {t.level}
                          </Text>
                        </View>
                      ))}
                    </View>
                  </View>
                )}
              </View>
            )}

            <View style={styles.improvedSection}>
              <Text style={styles.sectionTitle}>✨ Improved Version</Text>
              <Text style={styles.improvedText}>{analysisResult?.improved_text}</Text>
            </View>

            <View style={styles.suggestionsSection}>
              <Text style={styles.sectionTitle}>
                Word Suggestions ({suggestionCount})
              </Text>

              {suggestionCount > 0 ? (
                <View style={styles.suggestionsList}>
                  {analysisResult.suggestions.map((s, idx) => (
                    <View key={idx} style={styles.suggestionCard}>
                      <View style={styles.wordPairRow}>
                        <View style={styles.originalWordBadge}>
                          <Text style={styles.originalWord}>{s.original_word}</Text>
                        </View>
                        <Text style={styles.arrow}>→</Text>
                        <View style={styles.betterWordBadge}>
                          <Text style={styles.betterWord}>{s.better_alternative}</Text>
                        </View>
                      </View>
                      <Text style={styles.suggestionExplanation}>{s.explanation}</Text>
                    </View>
                  ))}
                </View>
              ) : (
                <View style={styles.successBanner}>
                  <Text style={styles.successBannerText}>🌟 Great job! No weak words detected.</Text>
                </View>
              )}
            </View>
          </>
        )}

        {/* ── Tab: Pronunciation ─────────────────────────────────── */}
        {activeTab === 'pronunciation' && (
          <View style={styles.tabSection}>
            {pronunciationScore !== null ? (
              <>
                {/* Score bar */}
                <View style={styles.scoreCard}>
                  <View style={styles.scoreHeader}>
                    <Text style={styles.sectionTitle}>Pronunciation Score</Text>
                    <Text style={[styles.scoreBig, {
                      color: pronunciationScore >= 80 ? Colors.light.success :
                             pronunciationScore >= 60 ? Colors.light.warning : Colors.light.error,
                    }]}>{pronunciationScore}/100</Text>
                  </View>
                  <View style={styles.scoreBarBg}>
                    <View style={[styles.scoreBarFill, {
                      width: `${Math.min(pronunciationScore, 100)}%` as any,
                      backgroundColor: pronunciationScore >= 80 ? Colors.light.success :
                                       pronunciationScore >= 60 ? Colors.light.warning : Colors.light.error,
                    }]} />
                  </View>
                </View>



                {/* Speech Quality */}
                {analysisResult?.speech_quality && (
                  <View style={styles.qualityCard}>
                    <Text style={styles.sectionTitle}>Speech Quality</Text>
                    {([
                      ['Pace', analysisResult.speech_quality.pace],
                      ['Clarity', analysisResult.speech_quality.clarity],
                      ['Rhythm', analysisResult.speech_quality.rhythm],
                      ['Accent', analysisResult.speech_quality.accent_strength],
                    ] as [string, string][]).map(([label, val]) => (
                      <View key={label} style={styles.metricRow}>
                        <Text style={styles.metricLabel}>{label}</Text>
                        <View style={[styles.metricValueBadge, {
                          backgroundColor: ['good', 'excellent', 'natural', 'fluid', 'light', 'native-like'].includes(val)
                            ? Colors.light.success + '20'
                            : Colors.light.warning + '20',
                        }]}>
                          <Text style={[styles.metricValue, {
                            color: ['good', 'excellent', 'natural', 'fluid', 'light', 'native-like'].includes(val)
                              ? Colors.light.success
                              : Colors.light.warning,
                          }]}>{val}</Text>
                        </View>
                      </View>
                    ))}
                  </View>
                )}

                {/* Corrections */}
                {analysisResult?.corrections && (
                  <View style={styles.correctionsCard}>
                    <Text style={styles.sectionTitle}>Pronunciation Feedback</Text>
                    <Text style={styles.correctionsText}>{analysisResult.corrections}</Text>
                  </View>
                )}
              </>
            ) : (
              <View style={styles.emptyTab}>
                <Text style={styles.emptyTabText}>🎤 Record your speech to get pronunciation analysis.</Text>
              </View>
            )}
          </View>
        )}

        {/* ── Tab: Phonetics ─────────────────────────────────────── */}
        {activeTab === 'phonetics' && (
          <View style={styles.tabSection}>
            {analysisResult?.phonetic_breakdown ? (
              <>
                {/* ── IPA side-by-side ── */}
                <View style={styles.phoneticCard}>
                  <Text style={styles.sectionTitle}>📊 IPA Comparison</Text>
                  <View style={styles.phoneticComparison}>
                    <View style={styles.phoneticItem}>
                      <Text style={styles.phoneticLabel}>🎯 Target</Text>
                      <Text style={styles.phoneticIPA}>{analysisResult.phonetic_breakdown.target_ipa}</Text>
                    </View>
                    <Text style={styles.phoneticArrow}>→</Text>
                    <View style={styles.phoneticItem}>
                      <Text style={styles.phoneticLabel}>🎤 You said</Text>
                      <Text style={[styles.phoneticIPA, { color: (analysisResult.phonetic_breakdown.phoneme_errors?.length ?? 0) > 0 ? '#8B5CF6' : Colors.light.tint }]}>
                        {analysisResult.phonetic_breakdown.user_ipa}
                      </Text>
                    </View>
                  </View>
                  {(analysisResult.phonetic_breakdown.phoneme_errors?.length ?? 0) === 0 && (
                    <View style={styles.perfectRow}>
                      <Text style={styles.perfectText}>✅ Perfect match — no phoneme errors detected</Text>
                    </View>
                  )}
                </View>

                {/* ── Per-error correction cards ── */}
                {(analysisResult.phonetic_breakdown.phoneme_errors?.length ?? 0) > 0 && (
                  <>
                    <Text style={styles.errorsHeading}>
                      {analysisResult.phonetic_breakdown.phoneme_errors!.length} phoneme{analysisResult.phonetic_breakdown.phoneme_errors!.length > 1 ? 's' : ''} to correct
                    </Text>
                    {analysisResult.phonetic_breakdown.phoneme_errors!.map((err, i) => (
                      <View key={i} style={styles.correctionCard}>
                        {/* Header: position + phonemes */}
                        <View style={styles.correctionHeader}>
                          <View style={styles.correctionPosition}>
                            <Text style={styles.correctionPositionText}>📍 {err.position}</Text>
                          </View>
                          <View style={styles.correctionPhonemes}>
                            <View style={styles.phonemeChipWrong}>
                              <Text style={styles.phonemeChipText}>{err.user_phoneme}</Text>
                            </View>
                            <Text style={styles.correctionArrow}>→</Text>
                            <View style={styles.phonemeChipRight}>
                              <Text style={[styles.phonemeChipText, { color: Colors.light.tint }]}>{err.target_phoneme}</Text>
                            </View>
                          </View>
                        </View>

                        {/* What went wrong */}
                        <Text style={styles.correctionWhatLabel}>WHAT HAPPENED</Text>
                        <Text style={styles.correctionExplanation}>{err.explanation}</Text>

                        {/* How to fix */}
                        <View style={styles.correctionHowBox}>
                          <Text style={styles.correctionHowLabel}>HOW TO CORRECT</Text>
                          <Text style={styles.correctionHowText}>
                            {/θ|ð/.test(err.target_phoneme)
                              ? '👅 Place tongue tip lightly between upper and lower front teeth. For /θ/ blow air without voice; for /ð/ add vibration in the throat.'
                              : /æ/.test(err.target_phoneme)
                              ? '↕️ Drop your jaw further than for /e/. Feel the front of your tongue rise. Your mouth should look like a wide open smile.'
                              : /ŋ/.test(err.target_phoneme)
                              ? '↩️ Raise the back of your tongue to touch the soft palate (as in /k/ or /g/). Let air flow through the nose — no extra /g/ at the end.'
                              : /ə/.test(err.target_phoneme)
                              ? '😌 Completely relax your mouth. Tongue sits in the middle, lips neutral. This is the shortest, most unstressed sound in English.'
                              : /ɫ|dark.*l|l.*dark/i.test(err.target_phoneme)
                              ? '👅 Touch tongue tip to the ridge behind upper teeth AND raise the back of the tongue toward the soft palate simultaneously.'
                              : /ʌ/.test(err.target_phoneme)
                              ? '↕️ Open mouth slightly, tongue in the centre. Less open than Romanian /a/ — more like a quick, relaxed mid-central sound.'
                              : err.explanation.length > 0
                              ? `🔁 Practice the minimal pair: say the word with ${err.target_phoneme} repeatedly, exaggerating the sound before reducing it to natural speed.`
                              : '🎯 Record yourself again, focusing only on this sound.'}
                          </Text>
                        </View>
                      </View>
                    ))}
                  </>
                )}

                {(analysisResult?.word_family?.related_forms?.length ?? 0) > 0 && (
                  <View style={styles.wordFamilyCard}>
                    <Text style={styles.sectionTitle}>🔗 Word Family: {analysisResult?.word_family?.target_word}</Text>
                    {analysisResult!.word_family!.related_forms.map((form, i) => (
                      <View key={i} style={styles.wordFormItem}>
                        <View style={styles.wordFormHeader}>
                          <Text style={styles.wordFormBold}>{form.form}</Text>
                          <Text style={styles.wordFormPos}> ({form.part_of_speech})</Text>
                        </View>
                        <Text style={styles.wordFormDefinition}>{form.definition}</Text>
                        <Text style={styles.wordFormPronunciation}>🔊 {form.pronunciation}</Text>
                        <Text style={styles.wordFormExample}>✏️ {form.example_sentence}</Text>
                      </View>
                    ))}
                  </View>
                )}
              </>
            ) : (
              <View style={styles.emptyTab}>
                <Text style={styles.emptyTabText}>🔬 Record your speech to see phonetic breakdown and word family analysis.</Text>
              </View>
            )}
          </View>
        )}

        {/* ── Tab: Exercise ──────────────────────────────────────── */}
        {activeTab === 'exercise' && (
          <View style={styles.tabSection}>
            {analysisResult?.personalized_exercise ? (
              <View style={styles.exerciseCard}>
                <Text style={styles.sectionTitle}>💪 Personalized Exercise</Text>
                <View style={styles.exerciseMeta}>
                  <View style={styles.exerciseMetaItem}>
                    <Text style={styles.exerciseMetaLabel}>Type</Text>
                    <Text style={styles.exerciseMetaValue}>{analysisResult.personalized_exercise.exercise_type}</Text>
                  </View>
                  <View style={styles.exerciseMetaItem}>
                    <Text style={styles.exerciseMetaLabel}>Focus</Text>
                    <Text style={styles.exerciseMetaValue}>{analysisResult.personalized_exercise.focus_area}</Text>
                  </View>
                  <View style={styles.exerciseMetaItem}>
                    <Text style={styles.exerciseMetaLabel}>Relevance</Text>
                    <Text style={[styles.exerciseMetaValue, { color: Colors.light.tint }]}>
                      {Math.round(analysisResult.personalized_exercise.personalization_score * 100)}%
                    </Text>
                  </View>
                </View>
                <View style={styles.exerciseBody}>
                  <Text style={styles.exerciseWordLabel}>Practice Word</Text>
                  <Text style={styles.exerciseWord}>
                    {analysisResult.personalized_exercise.word || analysisResult.personalized_exercise.target_word}
                  </Text>
                  <Text style={styles.exerciseContext}>
                    {analysisResult.personalized_exercise.context || analysisResult.personalized_exercise.example_sentence}
                  </Text>
                </View>
              </View>
            ) : (
              <View style={styles.emptyTab}>
                <Text style={styles.emptyTabText}>💪 Complete an analysis to get your personalized exercise.</Text>
              </View>
            )}
          </View>
        )}

        {/* ── Tab: Grammar — Romanian Error Detector ─────────────── */}
        {activeTab === 'grammar' && (
          <View style={styles.tabSection}>
            {analysisResult?.romanian_errors ? (() => {
              const re = analysisResult.romanian_errors!;
              const SEVERITY_COLOR: Record<number, string> = { 1: '#0FBA9A', 2: '#8B5CF6', 3: '#ef4444' };
              const SEVERITY_LABEL: Record<number, string> = { 1: 'Minor', 2: 'Moderate', 3: 'Severe' };
              const CATEGORY_LABEL: Record<string, string> = {
                articles: 'Articles',
                prepositions: 'Prepositions',
                word_order: 'Word Order',
                double_negation: 'Double Negation',
                false_friends: 'False Friends',
                tense: 'Tense / Aspect',
                collocations: 'Collocations',
              };
              const scoreColor = re.severity_score >= 80 ? '#0FBA9A'
                : re.severity_score >= 55 ? '#8B5CF6' : '#ef4444';
              return (
                <>
                  {/* Overview card */}
                  <View style={styles.grammarOverviewCard}>
                    <View style={styles.grammarScoreCircle}>
                      <Text style={[styles.grammarScoreNumber, { color: scoreColor }]}>
                        {Math.round(re.severity_score)}
                      </Text>
                      <Text style={styles.grammarScoreMax}>/100</Text>
                    </View>
                    <View style={styles.grammarOverviewInfo}>
                      <Text style={styles.grammarOverviewTitle}>
                        {re.error_count === 0 ? 'No errors detected!' : `${re.error_count} error type${re.error_count !== 1 ? 's' : ''} detected`}
                      </Text>
                      <Text style={styles.grammarOverviewSub}>Grammar accuracy score</Text>
                      <Text style={styles.grammarOverviewSource}>Pungă & Pârlog (2015) pp.163–166</Text>
                    </View>
                  </View>

                  {/* Category breakdown chips */}
                  {Object.entries(re.categories).some(([, n]) => n > 0) && (
                    <View style={styles.grammarCategoryCard}>
                      <Text style={styles.sectionTitle}>Error Categories</Text>
                      <View style={styles.grammarCategoryRow}>
                        {Object.entries(re.categories)
                          .filter(([, n]) => n > 0)
                          .map(([cat, n]) => (
                            <View key={cat} style={styles.grammarCategoryChip}>
                              <Text style={styles.grammarCategoryCount}>{n}</Text>
                              <Text style={styles.grammarCategoryLabel}>{CATEGORY_LABEL[cat] ?? cat}</Text>
                            </View>
                          ))}
                      </View>
                    </View>
                  )}

                  {/* Inline highlighted transcript — segments where errors were detected */}
                  {re.highlights && re.highlights.length > 0 && (() => {
                    const sourceText = inputMode === 'type' ? manualText : transcribedText;
                    if (!sourceText) return null;
                    // Build text segments: [text, highlight, text, highlight, …]
                    const segments: Array<{ text: string; highlight?: RomanianErrorHighlight }> = [];
                    let cursor = 0;
                    for (const h of re.highlights) {
                      if (h.start > cursor) {
                        segments.push({ text: sourceText.slice(cursor, h.start) });
                      }
                      segments.push({ text: sourceText.slice(h.start, h.end), highlight: h });
                      cursor = h.end;
                    }
                    if (cursor < sourceText.length) {
                      segments.push({ text: sourceText.slice(cursor) });
                    }
                    return (
                      <View style={styles.grammarInlineCard}>
                        <Text style={styles.sectionTitle}>Your Text — Errors Underlined</Text>
                        <Text style={styles.grammarInlineHint}>
                          Tap a highlighted phrase to see the suggested correction.
                        </Text>
                        <View style={styles.grammarInlineWrap}>
                          {segments.map((seg, i) => seg.highlight ? (
                            <TouchableOpacity
                              key={i}
                              activeOpacity={0.7}
                              onPress={() => Alert.alert(
                                seg.highlight!.error_type.replace(/_/g, ' '),
                                `"${seg.text}"\n\n${seg.highlight!.message}`,
                              )}
                            >
                              <Text style={[styles.grammarInlineErr, {
                                borderBottomColor: SEVERITY_COLOR[seg.highlight.severity],
                                backgroundColor: SEVERITY_COLOR[seg.highlight.severity] + '22',
                              }]}>{seg.text}</Text>
                            </TouchableOpacity>
                          ) : (
                            <Text key={i} style={styles.grammarInlineOk}>{seg.text}</Text>
                          ))}
                        </View>
                        <View style={styles.grammarInlineLegend}>
                          <View style={styles.grammarInlineLegendItem}>
                            <View style={[styles.grammarInlineLegendDot, { backgroundColor: SEVERITY_COLOR[1] }]} />
                            <Text style={styles.grammarInlineLegendText}>Minor</Text>
                          </View>
                          <View style={styles.grammarInlineLegendItem}>
                            <View style={[styles.grammarInlineLegendDot, { backgroundColor: SEVERITY_COLOR[2] }]} />
                            <Text style={styles.grammarInlineLegendText}>Moderate</Text>
                          </View>
                          <View style={styles.grammarInlineLegendItem}>
                            <View style={[styles.grammarInlineLegendDot, { backgroundColor: SEVERITY_COLOR[3] }]} />
                            <Text style={styles.grammarInlineLegendText}>Severe</Text>
                          </View>
                        </View>
                      </View>
                    );
                  })()}

                  {/* Error cards */}
                  {re.errors.length > 0 ? (
                    <View style={styles.grammarErrorsCard}>
                      <Text style={styles.sectionTitle}>Detected Errors</Text>
                      {re.errors.map((err, idx) => (
                        <View key={idx} style={[styles.grammarErrorItem, {
                          borderLeftColor: SEVERITY_COLOR[err.severity],
                        }]}>
                          <View style={styles.grammarErrorHeader}>
                            <View style={[styles.grammarSeverityBadge, {
                              backgroundColor: SEVERITY_COLOR[err.severity] + '22',
                            }]}>
                              <Text style={[styles.grammarSeverityText, {
                                color: SEVERITY_COLOR[err.severity],
                              }]}>{SEVERITY_LABEL[err.severity]}</Text>
                            </View>
                            {err.occurrences > 1 && (
                              <View style={styles.grammarOccurrencesBadge}>
                                <Text style={styles.grammarOccurrencesText}>×{err.occurrences}</Text>
                              </View>
                            )}
                          </View>
                          <Text style={styles.grammarErrorMessage}>{err.message}</Text>
                          <Text style={styles.grammarErrorSource}>{err.source}</Text>
                        </View>
                      ))}
                    </View>
                  ) : (
                    <View style={styles.successBanner}>
                      <Text style={styles.successBannerText}>
                        No Romanian interference errors detected.
                      </Text>
                    </View>
                  )}

                  {/* Research note */}
                  <View style={styles.grammarResearchNote}>
                    <Text style={styles.grammarResearchText}>
                      This detector identifies L1 Romanian interference errors in English learner text
                      using rule-based patterns grounded in corpus research. The Syntactic Error Rate
                      (SER) from these results feeds the IELTS Grammatical Range band estimate.
                    </Text>
                  </View>
                </>
              );
            })() : (
              <View style={styles.emptyTab}>
                <Text style={styles.emptyTabText}>
                  ⚠️ Record your speech to detect Romanian interference errors in your English.
                </Text>
              </View>
            )}
          </View>
        )}

        {/* ── Tab: Exam Profile ──────────────────────────────────── */}
        {activeTab === 'exam' && (
          <View style={styles.tabSection}>
            {analysisResult?.exam_profile ? (() => {
              const ep = analysisResult.exam_profile!;
              const isWritingMode = ep.mode === 'writing';
              const cefrLevel = ep.cambridge.level;
              const cefrColor = CEFR_COLOR[cefrLevel] ?? '#0FBA9A';
              const focus = EXAM_FOCUS[targetExam] ?? EXAM_FOCUS.general;

              const CRITERIA_META: Record<CriteriaKey, { label: string; color: string }> = {
                fluency_coherence:    { label: isWritingMode ? 'Coherence & Cohesion' : 'Fluency & Coherence', color: '#8B5CF6' },
                lexical_resource:     { label: 'Lexical Resource',  color: '#8B5CF6' },
                grammatical_accuracy: { label: 'Grammatical Range', color: '#0FBA9A' },
                pronunciation:        { label: 'Pronunciation',     color: '#8B5CF6' },
              };
              const CRIT_META: Record<string, { label: string; color: string; icon: string }> = {
                pronunciation_fluency: { label: 'Pronunciation & Fluency', color: '#8B5CF6', icon: '🗣️' },
                language_resource:     { label: 'Language Resource',       color: '#8B5CF6', icon: '📚' },
                discourse_management:  { label: 'Discourse Management',    color: '#0FBA9A', icon: '🧩' },
              };
              const IELTS_CRITERIA = focus.priority
                .filter(key => !(isWritingMode && key === 'pronunciation'))
                .map(key => ({ key, ...CRITERIA_META[key], weight: focus.weights[key] }));

              const GENRE_COLOR: Record<CocaGroup, string> = {
                SPOK: '#0FBA9A', FIC: '#8B5CF6', MAG: '#8B5CF6', NEWS: '#8B5CF6', ACAD: '#0FBA9A',
                Web: '#8B5CF6', Blog: '#8B5CF6', Mov: '#EF4444', TV: '#8B5CF6',
              };
              const GENRE_ICON: Record<CocaGroup, string> = {
                SPOK: '🗣️', FIC: '📖', MAG: '📰', NEWS: '🗞️', ACAD: '🎓',
                Web: '🌐', Blog: '✍️', Mov: '🎬', TV: '📺',
              };
              const ALL_GROUPS: CocaGroup[] = ['SPOK','FIC','MAG','NEWS','ACAD','Web','Blog','Mov','TV'];

              return (
                <>
                  {/* Overall band summary */}
                  <View style={styles.examOverallCard}>
                    <View style={styles.examBandCircle}>
                      <Text style={styles.examBandNumber}>{ep.ielts.overall}</Text>
                      <Text style={styles.examBandMax}>/9</Text>
                    </View>
                    <View style={styles.examOverallInfo}>
                      <Text style={styles.examBandLabel}>{ep.ielts.band_label}</Text>
                      <Text style={styles.examBandSub}>
                        IELTS {isWritingMode ? 'Writing' : 'Speaking'} · {ep.cambridge.exam}
                      </Text>
                      {ep.pte_core && (
                        <Text style={styles.examBandSource}>
                          PTE Core {ep.pte_core.speaking_score}/90  ·  CLB {ep.pte_core.clb_level ?? '< 3'}
                        </Text>
                      )}
                    </View>
                    <View style={[styles.cambridgeBadge, { backgroundColor: cefrColor + '22' }]}>
                      <Text style={[styles.cambridgeBadgeText, { color: cefrColor }]}>{cefrLevel}</Text>
                    </View>
                  </View>

                  {/* IELTS band descriptor */}
                  <View style={styles.examInlineDescCard}>
                    <Text style={styles.examInlineDescTitle}>
                      Band {ep.ielts.overall} — what this means for your speaking:
                    </Text>
                    <Text style={styles.examInlineDescText}>
                      {IELTS_BAND_DESC[Math.round(ep.ielts.overall)] ?? IELTS_BAND_DESC[Math.floor(ep.ielts.overall)] ?? ''}
                    </Text>
                    <Text style={styles.examInlineDescSource}>
                      British Council / Cambridge ESOL (2024) — official IELTS speaking band descriptors
                    </Text>
                  </View>

                  {/* CEFR can-do */}
                  <View style={[styles.examInlineCanDoCard, { borderLeftColor: cefrColor, backgroundColor: cefrColor + '0D' }]}>
                    <Text style={[styles.examInlineCanDoLevel, { color: cefrColor }]}>
                      {cefrLevel} — what you can do:
                    </Text>
                    <Text style={styles.examInlineCanDoText}>{CEFR_CAN_DO[cefrLevel] ?? ''}</Text>
                    <Text style={styles.examInlineDescSource}>
                      Council of Europe — CEFR Global Scale (2020)
                    </Text>
                  </View>

                  {/* Exam focus banner */}
                  <View style={[styles.examFocusCard, { borderLeftColor: focus.color }]}>
                    <View style={styles.examFocusHeader}>
                      <Text style={styles.examFocusIcon}>{focus.icon}</Text>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.examFocusLabel}>Your Target Exam</Text>
                        <Text style={[styles.examFocusName, { color: focus.color }]}>{focus.label}</Text>
                      </View>
                    </View>
                    <Text style={styles.examFocusTip}>{focus.tip}</Text>
                  </View>

                  {/* 4 IELTS criteria bars */}
                  <View style={styles.examCriteriaCard}>
                    <Text style={styles.sectionTitle}>IELTS Criteria Breakdown</Text>
                    {IELTS_CRITERIA.map(({ key, label, color, weight }) => {
                      const val = ep.ielts[key];
                      const pct = (val / 9) * 100;
                      const isPriority = focus.priority[0] === key || focus.priority[1] === key;
                      return (
                        <View key={key} style={styles.examCriteriaRow}>
                          <View style={styles.examCriteriaHeader}>
                            <Text style={[styles.examCriteriaLabel, isPriority && { fontWeight: '800' }]}>
                              {isPriority ? '★ ' : ''}{label}
                            </Text>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                              <Text style={styles.examCriteriaWeight}>{weight}%</Text>
                              <Text style={[styles.examCriteriaValue, { color }]}>{val}/9</Text>
                            </View>
                          </View>
                          <View style={styles.examBarBg}>
                            <View style={[styles.examBarFill, { width: `${pct}%` as any, backgroundColor: color }]} />
                          </View>
                        </View>
                      );
                    })}
                  </View>

                  {/* PTE Core */}
                  {ep.pte_core && (
                    <View style={styles.examInlinePteCard}>
                      <Text style={styles.examInlinePteTitle}>PTE Core Speaking Estimate</Text>
                      <View style={styles.examInlinePteRow}>
                        <Text style={styles.examInlinePteScore}>{ep.pte_core.speaking_score}</Text>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.examInlinePteRange}>
                            Range: {ep.pte_core.score_range}  ·  CLB {ep.pte_core.clb_level ?? '< 3'}  ·  {ep.pte_core.cefr_equivalent}
                          </Text>
                          <View style={styles.examInlineBarTrack}>
                            <View style={[styles.examInlineBarFill, {
                              width: `${(ep.pte_core.speaking_score / 90) * 100}%` as any,
                              backgroundColor: '#8B5CF6',
                            }]} />
                          </View>
                        </View>
                      </View>
                      <Text style={styles.examInlinePteSource}>
                        Pearson PTE (2024) — CLB comparison table; Kolahi Ahari et al. (2025); Council of Europe Global Scale
                      </Text>
                    </View>
                  )}

                  {/* Cambridge ESOL 3-criterion (only when Cambridge target) */}
                  {ep.cambridge_assessment && targetExam.startsWith('cambridge') && (() => {
                    const ca = ep.cambridge_assessment!;
                    return (
                      <View style={styles.cambridgeAssessCard}>
                        <View style={styles.cambridgeAssessHeader}>
                          <Text style={styles.cambridgeAssessTitle}>Cambridge ESOL Speaking Assessment</Text>
                          <View style={[styles.cambridgeAssessBadge, {
                            backgroundColor: (CEFR_COLOR[ca.overall_level] ?? '#64748B') + '22',
                          }]}>
                            <Text style={[styles.cambridgeAssessBadgeText, {
                              color: CEFR_COLOR[ca.overall_level] ?? '#64748B',
                            }]}>{ca.overall_level}</Text>
                          </View>
                        </View>
                        <Text style={styles.cambridgeAssessSubtitle}>
                          Cambridge Assessment English (2023) — 3-criterion rubric
                        </Text>
                        <View style={styles.cambridgeRecBox}>
                          <Text style={styles.cambridgeRecLabel}>RECOMMENDED EXAM</Text>
                          <Text style={styles.cambridgeRecExam}>{ca.recommended_exam}</Text>
                          <Text style={styles.cambridgeRecAdvice}>{ca.advice}</Text>
                        </View>
                        {Object.entries(ca.criteria).map(([key, crit]) => {
                          const meta = CRIT_META[key];
                          if (!meta) return null;
                          const lvlColor = CEFR_COLOR[crit.level] ?? '#94A3B8';
                          return (
                            <View key={key} style={styles.cambridgeCritRow}>
                              <View style={styles.cambridgeCritHeader}>
                                <Text style={styles.cambridgeCritIcon}>{meta.icon}</Text>
                                <Text style={styles.cambridgeCritLabel}>{meta.label}</Text>
                                <View style={[styles.cambridgeCritLevelBadge, { backgroundColor: lvlColor + '22', borderColor: lvlColor }]}>
                                  <Text style={[styles.cambridgeCritLevelText, { color: lvlColor }]}>{crit.level}</Text>
                                </View>
                              </View>
                              <Text style={styles.cambridgeCritDesc}>{crit.descriptor}</Text>
                            </View>
                          );
                        })}
                        <Text style={styles.cambridgeAssessNote}>
                          Cambridge convention: overall level = lowest of the three criteria.
                        </Text>
                        <Text style={styles.cambridgeAssessSource}>{ca.source}</Text>
                      </View>
                    );
                  })()}

                  {/* Genre / Domain Profile */}
                  {analysisResult?.genre_profile && analysisResult.genre_profile.dominant_group && (() => {
                    const gp = analysisResult.genre_profile!;
                    const domGroup: CocaGroup = gp.dominant_group ?? 'ACAD';
                    return (
                      <View style={styles.genreCard}>
                        <Text style={styles.sectionTitle}>Genre / Domain Profile</Text>
                        <Text style={styles.genreSource}>
                          Davies — Corpus of Contemporary American English (96 sub-genres)
                        </Text>
                        <View style={[styles.genreDominant, {
                          backgroundColor: GENRE_COLOR[domGroup] + '15',
                          borderLeftColor: GENRE_COLOR[domGroup],
                        }]}>
                          <Text style={styles.genreDominantIcon}>{GENRE_ICON[domGroup]}</Text>
                          <View style={{ flex: 1 }}>
                            <Text style={[styles.genreDominantLabel, { color: GENRE_COLOR[domGroup] }]}>
                              {gp.dominant_label}
                            </Text>
                            <Text style={styles.genreDominantDesc}>{gp.dominant_description}</Text>
                            {gp.dominant_subcategory && (
                              <Text style={styles.genreSubcatBadge}>Top sub-genre: {gp.dominant_subcategory}</Text>
                            )}
                          </View>
                        </View>
                        {ALL_GROUPS.map(g => {
                          const pct = gp.distribution_groups[g] ?? 0;
                          return (
                            <View key={g} style={styles.genreRow}>
                              <Text style={styles.genreLabel}>{GENRE_ICON[g]} {g}</Text>
                              <View style={styles.examBarBg}>
                                <View style={[styles.examBarFill, {
                                  width: `${Math.min(pct, 100)}%` as any,
                                  backgroundColor: GENRE_COLOR[g],
                                }]} />
                              </View>
                              <Text style={[styles.genrePct, { color: GENRE_COLOR[g] }]}>{pct}%</Text>
                            </View>
                          );
                        })}
                        <Text style={styles.genreCoverage}>
                          Coverage: {gp.matched_words}/{gp.total_words} words ({gp.coverage}%)
                          {' '}· {Object.keys(gp.distribution_subcats).length} active sub-genres
                        </Text>
                      </View>
                    );
                  })()}

                  {/* Indicators table */}
                  <View style={styles.examIndicatorsCard}>
                    <Text style={styles.sectionTitle}>Measured Indicators</Text>
                    {([
                      ['MTLD', ep.indicators.mtld, 'Kolahi Ahari et al. (2025) β=.40', true],
                      ['Lexical Density', `${ep.indicators.lexical_density}%`, 'Neumanova (2015) spoken range 45.7–48.5%', true],
                      ['Subordination Index', ep.indicators.subordination_index, 'Hunt (1965); Norris & Ortega (2009)', true],
                      ['Syntax Error Rate', `${ep.indicators.syntactic_error_rate ?? '—'}/100w`, 'Neumanova (2015) B2=4.53, B1=6.91, A2=9.16', true],
                      ['B2+ Vocabulary', `${ep.indicators.b2plus_pct}%`, 'EVP Cambridge / Kolahi Ahari et al. (2025)', true],
                      ['Connective Density', `${ep.indicators.connective_density ?? 0}/100w`, 'Crossley, Kyle & McNamara (2016) TAACO', isWritingMode],
                      ['Words/sec (WPS)', ep.indicators.wps, 'Foster & Tavakoli (2009); Neumanova (2015) p<0.012', !isWritingMode],
                      ['Filler Rate', `${ep.indicators.filler_rate}%`, 'Pallotti (2014) Filled-Pause Ratio', !isWritingMode],
                      ['Mean Sentence Length', ep.indicators.mls, '1-s2.0-S1075293520300714 — MLS linearly progresses', true],
                    ] as Array<[string, string | number, string, boolean]>)
                      .filter(([, , , show]) => show)
                      .map(([label, value, source]) => (
                      <View key={label as string} style={styles.examIndicatorRow}>
                        <View style={styles.examIndicatorLeft}>
                          <Text style={styles.examIndicatorLabel}>{label as string}</Text>
                          <Text style={styles.examIndicatorSource}>{source as string}</Text>
                        </View>
                        <Text style={styles.examIndicatorValue}>{value as string | number}</Text>
                      </View>
                    ))}
                  </View>
                </>
              );
            })() : (
              <View style={styles.emptyTab}>
                <Text style={styles.emptyTabText}>
                  🎓 Record your speech to get your IELTS band estimate, CEFR level and Cambridge exam recommendation.
                </Text>
              </View>
            )}
          </View>
        )}

        <Button
          label="Choose Another Topic"
          onPress={resetAnalysis}
          variant="primary"
          style={styles.continueBtn}
        />
      </Animated.ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.light.background },

  // ── Prompt Selection ───────────────────────────────────────────────
  header: {
    paddingTop: 60, paddingHorizontal: Spacing.xl, paddingBottom: Spacing.xl,
    backgroundColor: Colors.light.background,
  },
  headerTitle: { fontSize: 28, fontWeight: '700', color: Colors.light.text, marginBottom: 6, letterSpacing: -0.4 },
  headerSubtitle: { fontSize: 14, color: Colors.light.textSecondary, lineHeight: 20 },
  promptsContainer: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 20, gap: 12 },
  promptCard: {
    backgroundColor: Colors.light.surface,
    borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: Colors.light.border,
    flexDirection: 'row', alignItems: 'center', gap: 14,
    shadowColor: Colors.light.tint,
    shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
  },
  promptIconWrap: {
    width: 44, height: 44, borderRadius: 12,
    backgroundColor: Colors.light.tint + '15',
    alignItems: 'center', justifyContent: 'center',
  },
  promptIcon: { fontSize: 22 },
  promptTextWrap: { flex: 1 },
  promptTitle: { fontSize: 15, fontWeight: '700', color: Colors.light.text, marginBottom: 4 },
  promptText: { fontSize: 12, color: Colors.light.textSecondary, lineHeight: 17 },
  promptCTA: { fontSize: 18, fontWeight: '700', color: Colors.light.tint },

  // ── Top Bar ────────────────────────────────────────────────────────
  topBar: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 20, paddingTop: 56, paddingBottom: 14,
    backgroundColor: Colors.light.background,
    justifyContent: 'space-between',
  },
  backBtn: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: Colors.light.tint,
    backgroundColor: Colors.light.card,
  },
  backBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.light.tint,
    letterSpacing: 0.2,
  },
  topBarTitle: { textAlign: 'center', fontSize: 17, fontWeight: '700', color: Colors.light.text },
  resultModeBadge: { fontSize: 11, fontWeight: '700', color: Colors.light.tint, marginTop: 1 },

  playRecBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    marginHorizontal: 16, marginTop: 12,
    backgroundColor: Colors.light.tint + '12',
    borderWidth: 1, borderColor: Colors.light.tint + '40',
    borderRadius: 14, paddingVertical: 12, paddingHorizontal: 14,
  },
  playRecIcon: { fontSize: 20, color: Colors.light.tint },
  playRecText: { fontSize: 14, fontWeight: '700', color: Colors.light.text },
  playRecSub: { fontSize: 11, color: Colors.light.textSecondary, marginTop: 1 },
  playRecBadge: {
    fontSize: 10, fontWeight: '800', color: '#EF4444',
    backgroundColor: 'rgba(239,68,68,0.08)', borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3,
    overflow: 'hidden',
  },

  // ── Recording Screen ───────────────────────────────────────────────
  promptDisplay: {
    marginHorizontal: 20, marginTop: 20,
    backgroundColor: Colors.light.surface,
    padding: 18, borderRadius: 14,
    borderLeftWidth: 3, borderLeftColor: Colors.light.tint,
    flexDirection: 'row', gap: 12, alignItems: 'flex-start',
  },
  promptDisplayIcon: { fontSize: 22 },
  promptDisplayText: { flex: 1, fontSize: 14, fontWeight: '600', color: Colors.light.textSecondary, lineHeight: 21 },

  modeSelector: {
    flexDirection: 'row', marginHorizontal: 20, marginTop: 20,
    backgroundColor: Colors.light.border + '40',
    borderRadius: 12, padding: 3, gap: 3,
  },
  modeTab: { flex: 1, paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
  modeTabActive: { backgroundColor: Colors.light.tint },
  modeTabText: { fontSize: 13, fontWeight: '600', color: Colors.light.textSecondary },
  modeTabTextActive: { color: '#fff' },

  recordingSection: { marginHorizontal: 20, marginTop: 20, gap: 14 },
  recordingControls: { alignItems: 'center', gap: 12 },

  // Upload mode
  uploadCard: {
    backgroundColor: Colors.light.surface,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: Colors.light.tint + '40',
    borderStyle: 'dashed',
    padding: 24,
    alignItems: 'center',
    gap: 8,
  },
  uploadIcon: { fontSize: 36, marginBottom: 4 },
  uploadTitle: { fontSize: 16, fontWeight: '800', color: Colors.light.text },
  uploadDesc: {
    fontSize: 12, color: Colors.light.textSecondary,
    textAlign: 'center', lineHeight: 18,
  },
  uploadBtn: {
    marginTop: 8,
    backgroundColor: Colors.light.tint,
    paddingVertical: 13, paddingHorizontal: 28,
    borderRadius: 14,
    shadowColor: Colors.light.tint,
    shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 10, elevation: 4,
  },
  uploadBtnText: { fontSize: 14, fontWeight: '800', color: '#fff' },
  uploadFileName: {
    marginTop: 6, fontSize: 12, fontWeight: '600',
    color: Colors.light.tint, maxWidth: '100%',
  },
  uploadFallback: {
    marginTop: 8, fontSize: 11, color: Colors.light.textLight,
    fontStyle: 'italic', textAlign: 'center',
  },
  recordBtn: {
    backgroundColor: Colors.light.tint,
    paddingVertical: 16, paddingHorizontal: 44,
    borderRadius: 16, marginBottom: 4,
    shadowColor: Colors.light.tint,
    shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 6,
  },
  recordBtnActive: { backgroundColor: Colors.light.error, shadowColor: Colors.light.error },
  recordBtnText: { fontSize: 16, fontWeight: '700', color: '#fff' },
  recordingTimer: { fontSize: 22, fontWeight: '700', color: Colors.light.tint, fontVariant: ['tabular-nums'] },

  waveformContainer: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    height: 50, gap: 6,
  },
  waveBar: {
    width: 5, height: 36, borderRadius: 3,
    backgroundColor: Colors.light.tint,
  },

  qualityFeedbackBox: {
    backgroundColor: Colors.light.success + '12',
    padding: 12, borderRadius: 12,
    borderLeftWidth: 3, borderLeftColor: Colors.light.success,
  },
  qualityRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  qualityLabel: { fontSize: 12, fontWeight: '600', color: Colors.light.textSecondary },
  qualityFeedbackWarning: { fontSize: 12, fontWeight: '600', color: Colors.light.warning },
  qualityFeedbackGood: { fontSize: 12, fontWeight: '600', color: Colors.light.success },
  qualityFeedbackActive: { fontSize: 12, fontWeight: '700', color: Colors.light.tint },

  statusBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: Colors.light.surface,
    padding: 14, borderRadius: 12, borderWidth: 1, borderColor: Colors.light.border,
  },
  statusText: { fontSize: 13, color: Colors.light.textSecondary, fontWeight: '500' },

  transcriptionBox: {
    backgroundColor: Colors.light.tint + '10',
    padding: 16, borderRadius: 14,
    borderWidth: 1, borderColor: Colors.light.tint + '30',
    gap: 8,
  },
  transcriptionLabel: { fontSize: 11, fontWeight: '700', color: Colors.light.tint, textTransform: 'uppercase', letterSpacing: 1 },
  transcriptionText: { fontSize: 14, color: Colors.light.text, lineHeight: 21 },
  audioPlayerRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    marginTop: 12, paddingTop: 12,
    borderTopWidth: 1, borderTopColor: Colors.light.tint + '30',
  },
  audioPlayBtn: {
    backgroundColor: Colors.light.tint,
    paddingHorizontal: 16, paddingVertical: 9,
    borderRadius: 11,
    shadowColor: Colors.light.tint, shadowOpacity: 0.25, shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 }, elevation: 3,
  },
  audioPlayBtnText: { color: '#fff', fontSize: 13, fontWeight: '800' },
  audioHint: { fontSize: 11, color: Colors.light.textLight, fontStyle: 'italic', flex: 1 },

  typeSection: { marginHorizontal: 20, marginTop: 20, gap: 8 },
  textInput: {
    backgroundColor: Colors.light.surface,
    borderWidth: 1, borderColor: Colors.light.border,
    borderRadius: 14, padding: 16,
    fontSize: 15, color: Colors.light.text,
    textAlignVertical: 'top', minHeight: 140,
  },
  charCount: { fontSize: 12, color: Colors.light.textLight, textAlign: 'right' },

  actionArea: { marginHorizontal: 20, marginVertical: 20 },
  actionAreaDisabled: { opacity: 0.5 },
  analyzeBtn: { height: 50, borderRadius: 14 },

  // ── Results Screen ─────────────────────────────────────────────────
  scoreSummaryCard: {
    marginHorizontal: 20, marginBottom: 8,
    backgroundColor: Colors.light.surface,
    borderRadius: 14, padding: 16,
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1, borderColor: Colors.light.border,
  },
  scoreSummaryItem: { flex: 1, alignItems: 'center', gap: 4 },
  scoreSummaryValue: { fontSize: 24, fontWeight: '800', color: Colors.light.tint },
  scoreSummaryLabel: { fontSize: 11, color: Colors.light.textSecondary, fontWeight: '600' },
  scoreDivider: { width: 1, height: 36, backgroundColor: Colors.light.border },

  tabsScroll: { flexGrow: 0, flexShrink: 0, marginVertical: 8 },
  tabsContent: { paddingHorizontal: 20, gap: 8, paddingVertical: 4, alignItems: 'center' },
  tabBtn: {
    paddingHorizontal: 16, paddingVertical: 9,
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.15)',  // clearly visible border on dark bg
    backgroundColor: 'rgba(255,255,255,0.08)', // subtle fill on dark bg
    minHeight: 38,
    justifyContent: 'center',
  },
  tabBtnActive: {
    backgroundColor: Colors.light.tint,
    borderColor: Colors.light.tint,
    shadowColor: Colors.light.tint,
    shadowOpacity: 0.35,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  tabBtnText: { fontSize: 13, fontWeight: '700', color: '#94A3B8' },
  tabBtnTextActive: { color: '#fff', fontWeight: '800' },

  resultsContent: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 20 },
  tabSection: { gap: 16 },

  sectionTitle: { fontSize: 15, fontWeight: '700', color: Colors.light.text, marginBottom: 12 },

  improvedSection: { marginBottom: 16 },
  improvedText: {
    fontSize: 15, lineHeight: 23, color: Colors.light.success,
    backgroundColor: Colors.light.success + '10',
    padding: 16, borderRadius: 14, fontWeight: '500',
    borderWidth: 1, borderColor: Colors.light.success + '30',
  },

  suggestionsSection: { marginBottom: 16 },
  suggestionsList: { gap: 12 },
  suggestionCard: {
    backgroundColor: Colors.light.surface,
    borderWidth: 1, borderColor: Colors.light.tint + '20',
    borderRadius: 14, padding: 16, gap: 10,
  },
  wordPairRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  originalWordBadge: {
    backgroundColor: Colors.light.error + '15',
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8,
  },
  originalWord: { fontSize: 13, fontWeight: '700', color: Colors.light.error },
  arrow: { fontSize: 14, color: Colors.light.textLight, fontWeight: '700' },
  betterWordBadge: {
    backgroundColor: Colors.light.success + '15',
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8,
  },
  betterWord: { fontSize: 14, fontWeight: '700', color: Colors.light.success },
  suggestionExplanation: { fontSize: 13, color: Colors.light.textSecondary, lineHeight: 20 },

  successBanner: {
    backgroundColor: Colors.light.success + '12',
    padding: 18, borderRadius: 14,
    borderWidth: 1, borderColor: Colors.light.success + '30',
    alignItems: 'center',
  },
  successBannerText: { fontSize: 15, fontWeight: '700', color: Colors.light.success },

  // Pronunciation tab
  scoreCard: {
    backgroundColor: Colors.light.surface,
    borderRadius: 14, padding: 16, gap: 12, borderWidth: 1, borderColor: Colors.light.border,
  },
  scoreHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  scoreBig: { fontSize: 22, fontWeight: '800' },
  scoreBarBg: { height: 10, backgroundColor: Colors.light.border, borderRadius: 5, overflow: 'hidden' },
  scoreBarFill: { height: '100%', borderRadius: 5 },

  confidenceLevel: { fontSize: 12, color: Colors.light.textLight, fontWeight: '500' },
  indicatorsList: {
    borderTopWidth: 1, borderTopColor: Colors.light.border, paddingTop: 12, gap: 4,
  },
  indicatorsLabel: {
    fontSize: 11, fontWeight: '700', color: Colors.light.textSecondary,
    textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4,
  },
  indicatorItem: { fontSize: 12, color: Colors.light.success, fontWeight: '500', lineHeight: 18 },

  qualityCard: {
    backgroundColor: Colors.light.surface,
    borderRadius: 14, padding: 16, borderWidth: 1, borderColor: Colors.light.border, gap: 2,
  },
  metricRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: Colors.light.border,
  },
  metricLabel: { fontSize: 13, fontWeight: '600', color: Colors.light.text },
  metricValueBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  metricValue: { fontSize: 13, fontWeight: '700', textTransform: 'capitalize' },

  correctionsCard: {
    backgroundColor: Colors.light.surface,
    borderRadius: 14, padding: 16, borderWidth: 1,
    borderLeftWidth: 4, borderColor: Colors.light.warning + '30', borderLeftColor: Colors.light.warning, gap: 8,
  },
  correctionsText: { fontSize: 13, color: Colors.light.textSecondary, lineHeight: 20 },

  // Phonetics tab
  phoneticCard: {
    backgroundColor: Colors.light.tint + '08',
    borderRadius: 14, padding: 16,
    borderLeftWidth: 4, borderLeftColor: Colors.light.tint,
    borderWidth: 1, borderColor: Colors.light.tint + '20', gap: 12,
  },
  phoneticComparison: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: Colors.light.surface, borderRadius: 10, padding: 12,
  },
  phoneticItem: { flex: 1 },
  phoneticLabel: { fontSize: 12, color: Colors.light.textSecondary, marginBottom: 4 },
  phoneticIPA: { fontSize: 16, fontWeight: '700', color: Colors.light.tint, fontFamily: 'monospace' },
  phoneticArrow: { fontSize: 20, color: Colors.light.tint, marginHorizontal: 8 },
  // IPA enhanced
  perfectRow: {
    backgroundColor: 'rgba(15,186,154,0.12)', borderRadius: 8, padding: 10, marginTop: 4,
  },
  perfectText: { fontSize: 13, color: '#0FBA9A', fontWeight: '600', textAlign: 'center' },
  errorsHeading: {
    fontSize: 13, fontWeight: '700', color: Colors.light.textSecondary,
    marginTop: 8, marginBottom: 6, letterSpacing: 0.3,
  },
  correctionCard: {
    backgroundColor: Colors.light.card, borderRadius: 14,
    borderWidth: 1, borderColor: '#FEE2E2', borderLeftWidth: 4, borderLeftColor: '#F87171',
    padding: 14, marginBottom: 12, gap: 8,
  },
  correctionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  correctionPosition: {},
  correctionPositionText: { fontSize: 11, color: Colors.light.textSecondary, fontWeight: '600' },
  correctionPhonemes: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  phonemeChipWrong: {
    backgroundColor: 'rgba(239,68,68,0.15)', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4,
  },
  phonemeChipRight: {
    backgroundColor: 'rgba(15,186,154,0.15)', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4,
  },
  phonemeChipText: { fontSize: 16, fontWeight: '800', color: '#EF4444', fontFamily: 'monospace' },
  correctionArrow: { fontSize: 16, color: Colors.light.textSecondary },
  correctionWhatLabel: {
    fontSize: 9, fontWeight: '800', color: '#EF4444', letterSpacing: 1, marginTop: 2,
  },
  correctionExplanation: { fontSize: 13, color: Colors.light.text, lineHeight: 19 },
  correctionHowBox: {
    backgroundColor: 'rgba(15,186,154,0.10)', borderRadius: 10, padding: 10, gap: 4,
  },
  correctionHowLabel: { fontSize: 9, fontWeight: '800', color: '#0FBA9A', letterSpacing: 1 },
  correctionHowText: { fontSize: 13, color: '#94A3B8', lineHeight: 20 },

  phonemeErrorsList: { gap: 8 },
  phonemeErrorsTitle: { fontSize: 13, fontWeight: '600', color: Colors.light.text, marginBottom: 4 },
  phonemeErrorItem: {
    backgroundColor: Colors.light.surface, borderRadius: 8, padding: 10,
    borderLeftWidth: 3, borderLeftColor: Colors.light.error, gap: 4,
  },
  phonemePosition: { fontSize: 12, fontWeight: '600', color: Colors.light.textSecondary },
  phonemeError: { fontSize: 13, fontWeight: '700', color: Colors.light.error, fontFamily: 'monospace' },
  phonemeExplanation: { fontSize: 12, color: Colors.light.textSecondary, lineHeight: 17 },

  wordFamilyCard: {
    backgroundColor: Colors.light.success + '10',
    borderRadius: 14, padding: 16,
    borderLeftWidth: 4, borderLeftColor: Colors.light.success,
    borderWidth: 1, borderColor: Colors.light.success + '25', gap: 10,
  },
  wordFormItem: {
    backgroundColor: Colors.light.surface, borderRadius: 10, padding: 12,
    borderLeftWidth: 3, borderLeftColor: Colors.light.success, gap: 4,
  },
  wordFormHeader: { flexDirection: 'row', alignItems: 'baseline' },
  wordFormBold: { fontSize: 14, fontWeight: '700', color: Colors.light.success },
  wordFormPos: { fontSize: 12, color: Colors.light.textSecondary },
  wordFormDefinition: { fontSize: 12, color: Colors.light.textSecondary, lineHeight: 17 },
  wordFormPronunciation: { fontSize: 11, color: Colors.light.tint, fontWeight: '500' },
  wordFormExample: { fontSize: 11, color: Colors.light.textSecondary, fontStyle: 'italic', lineHeight: 16 },

  // Exercise tab
  exerciseCard: {
    backgroundColor: Colors.light.warning + '10',
    borderRadius: 14, padding: 16,
    borderLeftWidth: 4, borderLeftColor: Colors.light.warning,
    borderWidth: 1, borderColor: Colors.light.warning + '25', gap: 12,
  },
  exerciseMeta: {
    flexDirection: 'row', backgroundColor: Colors.light.surface,
    borderRadius: 10, padding: 12, gap: 4,
  },
  exerciseMetaItem: { flex: 1, alignItems: 'center', gap: 2 },
  exerciseMetaLabel: { fontSize: 10, color: Colors.light.textSecondary, fontWeight: '600', textTransform: 'uppercase' },
  exerciseMetaValue: { fontSize: 11, fontWeight: '700', color: Colors.light.text, textAlign: 'center' },
  exerciseBody: { backgroundColor: Colors.light.surface, borderRadius: 10, padding: 14, gap: 8 },
  exerciseWordLabel: { fontSize: 11, fontWeight: '700', color: Colors.light.textSecondary, textTransform: 'uppercase' },
  exerciseWord: { fontSize: 22, fontWeight: '800', color: Colors.light.text },
  exerciseContext: { fontSize: 13, color: Colors.light.textSecondary, lineHeight: 20 },

  emptyTab: {
    backgroundColor: Colors.light.surface, borderRadius: 14,
    padding: 32, alignItems: 'center',
    borderWidth: 1, borderColor: Colors.light.border,
  },
  emptyTabText: { fontSize: 14, color: Colors.light.textSecondary, textAlign: 'center', lineHeight: 21 },

  noSuggestions: { fontSize: 14, color: Colors.light.success, fontWeight: '600', textAlign: 'center', paddingVertical: Spacing.lg },
  continueBtn: { height: 56, borderRadius: 16, marginTop: Spacing.xl, marginBottom: Spacing.xl },

  // ── Speech Metrics Strip ────────────────────────────────────────────────────
  metricsStrip: {
    flexDirection: 'row', alignItems: 'center',
    marginHorizontal: 20, marginBottom: 8,
    backgroundColor: Colors.light.surface,
    borderRadius: 12, paddingVertical: 10, paddingHorizontal: 16,
    borderWidth: 1, borderColor: Colors.light.border,
    gap: 4,
  },
  metricChip: { flex: 1, alignItems: 'center', gap: 2 },
  metricChipValue: { fontSize: 16, fontWeight: '800', color: Colors.light.tint },
  metricChipLabel: { fontSize: 9, fontWeight: '600', color: Colors.light.textLight, textTransform: 'uppercase', letterSpacing: 0.5 },
  metricChipDivider: { width: 1, height: 28, backgroundColor: Colors.light.border },

  // ── CEFR Distribution Card ──────────────────────────────────────────────────
  cefrCard: {
    backgroundColor: Colors.light.surface,
    borderRadius: 14, padding: 16, marginBottom: 16,
    borderWidth: 1, borderColor: Colors.light.border, gap: 12,
  },
  cefrBar: {
    flexDirection: 'row', height: 12, borderRadius: 6, overflow: 'hidden',
    backgroundColor: Colors.light.border,
  },
  cefrBarSeg: { height: '100%' },
  cefrLegend: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  cefrLegendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  cefrDot: { width: 8, height: 8, borderRadius: 4 },
  cefrLegendText: { fontSize: 12, fontWeight: '600', color: Colors.light.textSecondary },
  advancedWordsBlock: { gap: 8 },
  advancedWordsLabel: { fontSize: 12, fontWeight: '700', color: Colors.light.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5 },
  wordChipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  wordChip: {
    backgroundColor: '#8B5CF620', borderWidth: 1, borderColor: '#8B5CF640',
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8,
  },
  wordChipText: { fontSize: 13, fontWeight: '700', color: '#8B5CF6' },

  // ── Tagged Transcript ───────────────────────────────────────────────────────
  taggedTranscript: { gap: 8, paddingTop: 4 },
  taggedRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  taggedWord: {
    alignItems: 'center', paddingHorizontal: 4, paddingVertical: 2,
    borderBottomWidth: 2,
  },
  taggedWordText: { fontSize: 13, color: Colors.light.text, lineHeight: 18 },
  taggedWordLevel: { fontSize: 8, fontWeight: '700', letterSpacing: 0.3 },

  // ── Exam Profile Tab ────────────────────────────────────────────────────────
  examOverallCard: {
    flexDirection: 'row', alignItems: 'center', gap: 16,
    backgroundColor: Colors.light.surface, borderRadius: 14,
    padding: 20, marginBottom: 12,
    borderWidth: 1, borderColor: Colors.light.tint + '40',
  },
  examBandCircle: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: Colors.light.tint + '18',
    justifyContent: 'center',
    flexDirection: 'row', alignItems: 'flex-end' as any,
    paddingBottom: 8,
  },
  examBandNumber: { fontSize: 32, fontWeight: '800', color: Colors.light.tint },
  examBandMax: { fontSize: 14, fontWeight: '600', color: Colors.light.textLight, marginBottom: 2 },
  examOverallInfo: { flex: 1, gap: 3 },
  examBandLabel: { fontSize: 17, fontWeight: '700', color: Colors.light.text },
  examBandSub: { fontSize: 12, color: Colors.light.textSecondary },
  examBandSource: { fontSize: 10, color: Colors.light.textLight, fontStyle: 'italic' },

  cambridgeCard: {
    backgroundColor: Colors.light.surface, borderRadius: 14,
    padding: 16, marginBottom: 12,
    borderWidth: 1, borderColor: Colors.light.border,
    borderLeftWidth: 4, gap: 6,
  },
  cambridgeHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  cambridgeBadge: {
    paddingHorizontal: 12, paddingVertical: 5,
    borderRadius: 8,
  },
  cambridgeBadgeText: { fontSize: 18, fontWeight: '800' },
  cambridgeExam: { fontSize: 14, fontWeight: '700', color: Colors.light.text, flex: 1 },
  cambridgeDescription: { fontSize: 13, color: Colors.light.textSecondary, lineHeight: 19 },
  cambridgeSource: { fontSize: 10, color: Colors.light.textLight, fontStyle: 'italic' },

  examCriteriaCard: {
    backgroundColor: Colors.light.surface, borderRadius: 14,
    padding: 16, marginBottom: 12,
    borderWidth: 1, borderColor: Colors.light.border, gap: 14,
  },
  examCriteriaRow: { gap: 5 },
  examCriteriaHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  examCriteriaLabel: { fontSize: 13, fontWeight: '600', color: Colors.light.text },
  examCriteriaValue: { fontSize: 16, fontWeight: '800' },
  examCriteriaWeight: { fontSize: 10, fontWeight: '600', color: Colors.light.textLight },

  examFocusCard: {
    backgroundColor: Colors.light.surface, borderRadius: 14,
    padding: 14, marginBottom: 12,
    borderWidth: 1, borderColor: Colors.light.border,
    borderLeftWidth: 4, gap: 10,
  },
  examFocusHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  examFocusIcon: { fontSize: 22 },
  examFocusLabel: { fontSize: 10, fontWeight: '700', color: Colors.light.textSecondary, textTransform: 'uppercase', letterSpacing: 0.8 },
  examFocusName: { fontSize: 14, fontWeight: '800' },
  examFocusWeights: { flexDirection: 'row', gap: 6 },
  examFocusWeightChip: {
    flex: 1, alignItems: 'center', gap: 3,
    backgroundColor: Colors.light.border + '40',
    borderRadius: 8, paddingVertical: 8,
  },
  examFocusWeightPct: { fontSize: 15, fontWeight: '800' },
  examFocusWeightLabel: { fontSize: 9, color: Colors.light.textSecondary, textAlign: 'center', lineHeight: 13 },
  examFocusTip: { fontSize: 12, color: Colors.light.textSecondary, lineHeight: 18, fontStyle: 'italic' },

  // ── Cambridge ESOL Assessment Card ──────────────────────────────────────
  cambridgeAssessCard: {
    backgroundColor: Colors.light.surface, borderRadius: 14,
    padding: 16, marginBottom: 12,
    borderWidth: 1.5, borderColor: '#8B5CF640', gap: 10,
  },
  cambridgeAssessHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cambridgeAssessTitle: { fontSize: 15, fontWeight: '800', color: Colors.light.text, flex: 1 },
  cambridgeAssessBadge: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 10 },
  cambridgeAssessBadgeText: { fontSize: 18, fontWeight: '900' },
  cambridgeAssessSubtitle: { fontSize: 11, color: Colors.light.textLight, fontStyle: 'italic', marginTop: -6 },
  cambridgeRecBox: {
    backgroundColor: '#8B5CF615', borderRadius: 10, padding: 12,
    borderLeftWidth: 3, borderLeftColor: '#8B5CF6',
    gap: 2,
  },
  cambridgeRecLabel: { fontSize: 10, fontWeight: '800', color: '#8B5CF6', letterSpacing: 0.6 },
  cambridgeRecExam: { fontSize: 14, fontWeight: '800', color: Colors.light.text },
  cambridgeRecAdvice: { fontSize: 12, color: Colors.light.textSecondary, fontStyle: 'italic' },

  cambridgeCritRow: {
    paddingVertical: 10,
    borderTopWidth: 1, borderTopColor: Colors.light.border,
    gap: 6,
  },
  cambridgeCritHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cambridgeCritIcon: { fontSize: 18 },
  cambridgeCritLabel: { fontSize: 13, fontWeight: '700', color: Colors.light.text, flex: 1 },
  cambridgeCritLevelBadge: {
    paddingHorizontal: 10, paddingVertical: 3, borderRadius: 8, borderWidth: 1.5,
  },
  cambridgeCritLevelText: { fontSize: 13, fontWeight: '800' },
  cambridgeCritDesc: { fontSize: 12, color: Colors.light.textSecondary, lineHeight: 18 },

  cambridgeAssessNote: {
    fontSize: 11, color: Colors.light.textSecondary, fontStyle: 'italic',
    paddingTop: 8, borderTopWidth: 1, borderTopColor: Colors.light.border,
    lineHeight: 16,
  },
  cambridgeAssessSource: { fontSize: 10, color: Colors.light.textLight, fontStyle: 'italic' },

  // Genre / Domain Profile (COCA)
  genreCard: {
    backgroundColor: Colors.light.surface, borderRadius: 14,
    padding: 16, marginBottom: 12,
    borderWidth: 1, borderColor: Colors.light.border, gap: 10,
  },
  genreSource: { fontSize: 10, color: Colors.light.textLight, fontStyle: 'italic', marginTop: -8, marginBottom: 4 },
  genreDominant: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: 12, borderRadius: 10, borderLeftWidth: 4, marginBottom: 6,
  },
  genreDominantIcon: { fontSize: 24 },
  genreDominantLabel: { fontSize: 14, fontWeight: '800', marginBottom: 2 },
  genreDominantDesc: { fontSize: 11, color: Colors.light.textSecondary, lineHeight: 15 },
  genreRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  genreLabel: { fontSize: 11, fontWeight: '700', color: Colors.light.text, width: 78 },
  genrePct: { fontSize: 12, fontWeight: '800', width: 42, textAlign: 'right' },
  genreCoverage: { fontSize: 10, color: Colors.light.textLight, fontStyle: 'italic', marginTop: 4, textAlign: 'center' },
  genreSubcatBadge: { fontSize: 10, color: Colors.light.textLight, marginTop: 4, fontStyle: 'italic' },

  genreSubcatsSection: {
    marginTop: 8, paddingTop: 12,
    borderTopWidth: 1, borderTopColor: Colors.light.border,
    gap: 6,
  },
  genreSubcatsTitle: {
    fontSize: 11, fontWeight: '800', color: Colors.light.textSecondary,
    textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4,
  },
  genreSubcatRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  genreSubcatGroupDot: { width: 6, height: 6, borderRadius: 3 },
  genreSubcatName: { fontSize: 11, color: Colors.light.text, flex: 1.2 },
  genreSubcatBarBg: { flex: 1, height: 5, backgroundColor: Colors.light.border, borderRadius: 2.5, overflow: 'hidden' },
  genreSubcatBarFill: { height: '100%', borderRadius: 2.5 },
  genreSubcatPct: { fontSize: 10, fontWeight: '700', color: Colors.light.textSecondary, width: 36, textAlign: 'right' },
  examBarBg: { height: 8, backgroundColor: Colors.light.border, borderRadius: 4, overflow: 'hidden' },
  examBarFill: { height: '100%', borderRadius: 4 },

  examIndicatorsCard: {
    backgroundColor: Colors.light.surface, borderRadius: 14,
    padding: 16, marginBottom: 12,
    borderWidth: 1, borderColor: Colors.light.border, gap: 10,
  },
  examIndicatorRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: 1, borderBottomColor: Colors.light.border,
  },
  examIndicatorLeft: { flex: 1, gap: 2 },
  examIndicatorLabel: { fontSize: 13, fontWeight: '600', color: Colors.light.text },
  examIndicatorSource: { fontSize: 10, color: Colors.light.textLight, fontStyle: 'italic' },
  examIndicatorValue: { fontSize: 15, fontWeight: '800', color: Colors.light.tint },

  // ── Grammar / Romanian Error Detector Tab ──────────────────────────────────
  grammarOverviewCard: {
    flexDirection: 'row', alignItems: 'center', gap: 16,
    backgroundColor: Colors.light.surface, borderRadius: 14,
    padding: 20, marginBottom: 12,
    borderWidth: 1, borderColor: Colors.light.border,
  },
  grammarScoreCircle: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: Colors.light.border + '40',
    justifyContent: 'center',
    flexDirection: 'row', alignItems: 'flex-end' as any,
    paddingBottom: 8,
  },
  grammarScoreNumber: { fontSize: 28, fontWeight: '800' },
  grammarScoreMax: { fontSize: 13, fontWeight: '600', color: Colors.light.textLight, marginBottom: 2 },
  grammarOverviewInfo: { flex: 1, gap: 3 },
  grammarOverviewTitle: { fontSize: 15, fontWeight: '700', color: Colors.light.text },
  grammarOverviewSub: { fontSize: 12, color: Colors.light.textSecondary },
  grammarOverviewSource: { fontSize: 10, color: Colors.light.textLight, fontStyle: 'italic' },

  grammarCategoryCard: {
    backgroundColor: Colors.light.surface, borderRadius: 14,
    padding: 16, marginBottom: 12,
    borderWidth: 1, borderColor: Colors.light.border, gap: 12,
  },
  grammarCategoryRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  grammarCategoryChip: {
    backgroundColor: Colors.light.warning + '15',
    borderWidth: 1, borderColor: Colors.light.warning + '30',
    borderRadius: 10, paddingHorizontal: 12, paddingVertical: 6,
    alignItems: 'center', gap: 2,
  },
  grammarCategoryCount: { fontSize: 16, fontWeight: '800', color: Colors.light.warning },
  grammarCategoryLabel: { fontSize: 10, fontWeight: '600', color: Colors.light.textSecondary },

  grammarErrorsCard: {
    backgroundColor: Colors.light.surface, borderRadius: 14,
    padding: 16, marginBottom: 12,
    borderWidth: 1, borderColor: Colors.light.border, gap: 10,
  },
  grammarErrorItem: {
    borderLeftWidth: 4, borderRadius: 8,
    backgroundColor: Colors.light.background,
    padding: 12, gap: 6,
    borderWidth: 1, borderColor: Colors.light.border,
  },
  grammarErrorHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  grammarSeverityBadge: {
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6,
  },
  grammarSeverityText: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase' },
  grammarOccurrencesBadge: {
    backgroundColor: Colors.light.textLight + '20',
    paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6,
  },
  grammarOccurrencesText: { fontSize: 11, fontWeight: '700', color: Colors.light.textSecondary },
  grammarErrorMessage: { fontSize: 13, color: Colors.light.text, lineHeight: 19 },
  grammarErrorSource: { fontSize: 10, color: Colors.light.textLight, fontStyle: 'italic' },

  grammarResearchNote: {
    backgroundColor: Colors.light.tint + '08',
    borderRadius: 12, padding: 14,
    borderWidth: 1, borderColor: Colors.light.tint + '20',
  },
  grammarResearchText: { fontSize: 11, color: Colors.light.textSecondary, lineHeight: 17, fontStyle: 'italic' },

  // ── Inline error highlights on transcript ──────────────────────────────────
  grammarInlineCard: {
    backgroundColor: Colors.light.surface,
    borderRadius: 14, padding: 16, marginBottom: 12,
    borderWidth: 1, borderColor: Colors.light.border,
  },
  grammarInlineHint: {
    fontSize: 11, fontStyle: 'italic', color: Colors.light.textSecondary,
    marginTop: -8, marginBottom: 12,
  },
  grammarInlineWrap: {
    flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center',
    paddingVertical: 6, paddingHorizontal: 4,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1, borderColor: Colors.light.border,
  },
  grammarInlineOk: {
    fontSize: 14, lineHeight: 24, color: Colors.light.text,
  },
  grammarInlineErr: {
    fontSize: 14, lineHeight: 24, color: Colors.light.text,
    fontWeight: '700',
    borderBottomWidth: 2,
    paddingHorizontal: 3, borderRadius: 3,
  },
  grammarInlineLegend: {
    flexDirection: 'row', gap: 14, marginTop: 12,
    paddingTop: 10, borderTopWidth: 1, borderTopColor: Colors.light.border,
  },
  grammarInlineLegendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  grammarInlineLegendDot: { width: 10, height: 10, borderRadius: 5 },
  grammarInlineLegendText: { fontSize: 11, fontWeight: '600', color: Colors.light.textSecondary },

  // ── Inline Exam Profile Card ───────────────────────────────────────────────
  examInlineCard: {
    backgroundColor: Colors.light.surface, borderRadius: 14,
    borderWidth: 1, borderColor: Colors.light.border,
    marginHorizontal: 16, marginBottom: 8, padding: 14, gap: 10,
  },
  examInlineTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  examInlineCefrBadge: {
    width: 48, height: 48, borderRadius: 12, borderWidth: 1.5,
    justifyContent: 'center', alignItems: 'center',
  },
  examInlineCefrText: { fontSize: 18, fontWeight: '900' },
  examInlineCefrSub: { fontSize: 9, color: Colors.light.textSecondary, fontWeight: '600' },
  examInlineDivider: { width: 1, height: 36, backgroundColor: Colors.light.border },
  examInlineStat: { alignItems: 'center', flex: 1 },
  examInlineBandNum: { fontSize: 22, fontWeight: '900', color: '#0FBA9A' },
  examInlineStatSub: { fontSize: 10, color: Colors.light.textSecondary, fontWeight: '600' },
  examInlineExpandBtn: { paddingHorizontal: 10, paddingVertical: 6 },
  examInlineExpandText: { fontSize: 12, color: Colors.light.textSecondary, fontWeight: '700' },
  examInlineBars: { gap: 8 },
  examInlineBarItem: { gap: 3 },
  examInlineBarLabelRow: { flexDirection: 'row', justifyContent: 'space-between' },
  examInlineBarLabel: { fontSize: 11, fontWeight: '600', color: Colors.light.text },
  examInlineBarVal: { fontSize: 12, fontWeight: '800' },
  examInlineBarTrack: {
    height: 7, backgroundColor: Colors.light.border, borderRadius: 4, overflow: 'hidden',
  },
  examInlineBarFill: { height: '100%' as any, borderRadius: 4 },
  examInlinePteCard: {
    backgroundColor: 'rgba(139,92,246,0.10)', borderRadius: 10, padding: 12,
    borderWidth: 1, borderColor: 'rgba(139,92,246,0.25)', marginTop: 2,
  },
  examInlinePteTitle: {
    fontSize: 11, fontWeight: '800', color: '#8B5CF6',
    letterSpacing: 0.4, marginBottom: 8, textTransform: 'uppercase' as any,
  },
  examInlinePteRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  examInlinePteScore: { fontSize: 28, fontWeight: '900', color: '#8B5CF6' },
  examInlinePteRange: { fontSize: 11, color: Colors.light.textSecondary, marginBottom: 6 },
  examInlinePteSource: {
    fontSize: 10, color: Colors.light.textSecondary,
    fontStyle: 'italic', marginTop: 8, lineHeight: 14,
  },

  examInlineDescCard: {
    backgroundColor: Colors.light.background,
    borderRadius: 10, padding: 12,
    borderWidth: 1, borderColor: Colors.light.border, gap: 5, marginTop: 10,
  },
  examInlineDescTitle: {
    fontSize: 11, fontWeight: '800', color: Colors.light.text,
    textTransform: 'uppercase' as any, letterSpacing: 0.4,
  },
  examInlineDescText: { fontSize: 13, color: Colors.light.textSecondary, lineHeight: 19 },
  examInlineDescSource: { fontSize: 10, color: Colors.light.textLight, fontStyle: 'italic' },

  examInlineCanDoCard: {
    borderRadius: 10, padding: 12, borderLeftWidth: 3, gap: 5, marginTop: 6,
  },
  examInlineCanDoLevel: {
    fontSize: 11, fontWeight: '800', textTransform: 'uppercase' as any, letterSpacing: 0.4,
  },
  examInlineCanDoText: { fontSize: 13, color: Colors.light.textSecondary, lineHeight: 19 },

  // Demo Mode banner
  demoBanner: {
    marginHorizontal: 20, marginTop: 16,
    backgroundColor: 'rgba(139,92,246,0.10)', borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: 'rgba(139,92,246,0.25)',
  },
  demoBannerTitle: { fontSize: 13, fontWeight: '800', color: '#8B5CF6', marginBottom: 6 },
  demoBannerText: { fontSize: 12, color: '#8B5CF6', lineHeight: 18 },
});
