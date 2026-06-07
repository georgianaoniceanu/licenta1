import { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Platform,
  Animated,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Audio } from 'expo-av';
import { Feather } from '@expo/vector-icons';
import { API_URL } from '../../constants/api';
import { Colors, Animations } from '../../constants/theme';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLearnerProfile } from '../../context/LearnerProfile';
import SavedSessions from '@/components/saved-sessions';

type SavedShadow = {
  ts: number; category: string; difficulty: string; score: number;
  target_text: string; transcribed: string; audio_id?: string;
};

const FRAGMENTS = [
  {
    id: '1',
    category: 'Professional',
    text: "I'd like to take this opportunity to present our quarterly results.",
    difficulty: 'B2',
    focus: 'Connected speech & rhythm',
    tips: "Notice how 'd like to blends into /dlaɪktə/. The word 'opportunity' stresses the 3rd syllable: op-por-TU-ni-ty.",
    phoneme_targets: ['/ð/', '[tʰ]', '/ə/'],
  },
  {
    id: '2',
    category: 'Casual',
    text: "What are you up to this weekend? I was thinking we could grab a coffee.",
    difficulty: 'B1',
    focus: 'Natural contractions',
    tips: "'What are you' contracts to /wɒtʃə/ in fast speech. 'I was thinking' uses schwa: /aɪ wəz θɪŋkɪŋ/.",
    phoneme_targets: ['/ð/', '/θ/', '/ŋ/', '/u:/-/ʊ/'],
  },
  {
    id: '3',
    category: 'Academic',
    text: "The data suggests a strong correlation between the two variables.",
    difficulty: 'C1',
    focus: 'Stress & intonation',
    tips: "'Data' can be /ˈdeɪtə/ (British) or /ˈdætə/ (American). Stress 'correlation': cor-re-LA-tion.",
    phoneme_targets: ['/ð/', '/ŋ/', '/u:/-/ʊ/', '/i:/-/ɪ/'],
  },
  {
    id: '4',
    category: 'Travel',
    text: "Could you recommend a good restaurant around here? Something not too expensive.",
    difficulty: 'B1',
    focus: 'Question intonation',
    tips: "Questions with 'could you' rise at the end. 'Restaurant' is often 3 syllables: REST-rant in casual speech.",
    phoneme_targets: ['/u:/-/ʊ/', '/ʌ/', '/θ/', '/ŋ/'],
  },
  {
    id: '5',
    category: 'Business',
    text: "I appreciate your feedback and I'll take it into consideration going forward.",
    difficulty: 'B2',
    focus: 'Formal connected speech',
    tips: "'I'll take it into' blends fluidly. 'Consideration' stresses the 4th syllable: con-sid-er-A-tion.",
    phoneme_targets: ['/i:/-/ɪ/', '[tʰ]', '/ŋ/', '/ə/'],
  },
  {
    id: '6',
    category: 'Healthcare',
    text: "I'd like to schedule an appointment with the doctor for next Monday if possible.",
    difficulty: 'B1',
    focus: 'Polite requests',
    tips: "'Schedule' is /ˈʃedʒuːl/ (British) or /ˈskɛdʒuːl/ (American). 'Appointment' stresses the 2nd syllable.",
    phoneme_targets: ['/ð/', '/ə/', '/i:/-/ɪ/'],
  },
  {
    id: '7',
    category: 'Negotiation',
    text: "I think we can find a solution that works for both parties if we're flexible.",
    difficulty: 'B2',
    focus: 'Diplomatic language',
    tips: "'We're flexible' — the schwa in 'flexible' /ˈflɛksɪbəl/. Stress 'solution': so-LU-tion.",
    phoneme_targets: ['/θ/', '/ð/', '/u:/-/ʊ/', '/ə/'],
  },
  {
    id: '8',
    category: 'Academic',
    text: "The evidence strongly supports the hypothesis, although further research is needed.",
    difficulty: 'C1',
    focus: 'Academic hedging',
    tips: "'Although' introduces a contrast — rise-fall intonation. 'Hypothesis' stresses the 2nd syllable: hy-POTH-e-sis.",
    phoneme_targets: ['/ð/', '/θ/', '/ŋ/', '/i:/-/ɪ/'],
  },
  {
    id: '9',
    category: 'Tech Support',
    text: "Could you walk me through how to set up the new software on my computer?",
    difficulty: 'B1',
    focus: 'Phrasal verbs & linking',
    tips: "'Walk me through' — phrasal verb with natural linking. 'Set up' is stressed on 'up' as a particle.",
    phoneme_targets: ['/θ/', '/ð/', '/u:/-/ʊ/', '[ɫ] Dark L'],
  },
  {
    id: '10',
    category: 'Storytelling',
    text: "I was walking home when I suddenly realized I had completely forgotten my keys.",
    difficulty: 'B2',
    focus: 'Past narrative rhythm',
    tips: "Past continuous 'was walking' sets the scene. 'Suddenly' carries extra stress for dramatic effect.",
    phoneme_targets: ['[ɫ] Dark L', '/ŋ/', '/i:/-/ɪ/', '/ə/'],
  },
];

type ProsodyResult = {
  prosody_score?: number;
  pitch_score?: number;
  rhythm_score?: number;
  energy_score?: number;
};

type WpmAssessment = {
  label: 'too_slow' | 'ideal' | 'slightly_fast' | 'too_fast';
  message: string;
  target?: string;
};

type WordBreakdown = {
  word: string;
  ok: boolean;
  correct: number;
  total: number;
  phonemes: { p: string; ok: boolean }[];
};

type Feedback = {
  accuracy_score: number;
  transcribed_text: string;
  missing_words: string[];
  extra_words: string[];
  fluency_feedback: string;
  connected_speech_tips: string;
  phoneme_score?: number;
  prosody?: ProsodyResult;
  wpm?: number;
  wpm_assessment?: WpmAssessment;
  word_breakdown?: WordBreakdown[];
};

type SessionEntry = { category: string; score: number };
type ShadowStorageEntry = {
  ts: number;
  category: string;
  difficulty: string;
  score: number;
  transcribed: string;
  target_text: string;
};

const DIFF_COLORS: Record<string, string> = {
  B1: '#0FBA9A',
  B2: '#8B5CF6',
  C1: '#EF4444',
};
const SPEED_OPTIONS = [0.75, 1.0, 1.25] as const;
type Speed = typeof SPEED_OPTIONS[number];

export default function ShadowSpeakingScreen() {
  const router = useRouter();
  const { getWeakPhonemes } = useLearnerProfile();
  const [selectedFragment, setSelectedFragment] = useState(FRAGMENTS[0]);
  const [diffFilter, setDiffFilter] = useState<'ALL' | 'B1' | 'B2' | 'C1'>('ALL');
  const [step, setStep] = useState<'listen' | 'record' | 'feedback'>('listen');
  const [isRecording, setIsRecording] = useState(false);
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [error, setError] = useState('');
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [audioLoading, setAudioLoading] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<Speed>(1.0);
  const [listenCount, setListenCount] = useState(0);
  const [sessionScores, setSessionScores] = useState<SessionEntry[]>([]);

  const feedbackOpacity = useRef(new Animated.Value(0)).current;
  const feedbackScale = useRef(new Animated.Value(0.95)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const pulseOpacity = useRef(new Animated.Value(0.6)).current;

  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);

  const recordingRef = useRef<Audio.Recording | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const audioRef = useRef<Audio.Sound | null>(null);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (feedback) {
      Animated.parallel([
        Animated.timing(feedbackOpacity, { toValue: 1, duration: Animations.normal, useNativeDriver: true }),
        Animated.spring(feedbackScale, { toValue: 1, speed: 15, bounciness: 8, useNativeDriver: true }),
      ]).start();
    } else {
      feedbackOpacity.setValue(0);
      feedbackScale.setValue(0.95);
    }
  }, [feedback]);

  useEffect(() => {
    if (isRecording) {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.parallel([
            Animated.timing(pulseAnim, { toValue: 1.4, duration: 700, useNativeDriver: true }),
            Animated.timing(pulseOpacity, { toValue: 0.1, duration: 700, useNativeDriver: true }),
          ]),
          Animated.parallel([
            Animated.timing(pulseAnim, { toValue: 1, duration: 700, useNativeDriver: true }),
            Animated.timing(pulseOpacity, { toValue: 0.6, duration: 700, useNativeDriver: true }),
          ]),
        ])
      );
      loop.start();
      return () => loop.stop();
    } else {
      pulseAnim.setValue(1);
      pulseOpacity.setValue(0.6);
    }
  }, [isRecording]);

  const filteredFragments = diffFilter === 'ALL'
    ? FRAGMENTS
    : FRAGMENTS.filter(f => f.difficulty === diffFilter);

  const weakPhonemes = getWeakPhonemes();
  const recommendedFragments = weakPhonemes.length > 0
    ? FRAGMENTS.filter(f => f.phoneme_targets.some(p => weakPhonemes.includes(p))).slice(0, 3)
    : [];

  const startRecording = async () => {
    setFeedback(null);
    setError('');

    if (Platform.OS === 'web') {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const mediaRecorder = new MediaRecorder(stream);
        mediaRecorderRef.current = mediaRecorder;
        chunksRef.current = [];
        mediaRecorder.ondataavailable = (e) => chunksRef.current.push(e.data);
        mediaRecorder.start();
        setIsRecording(true);
      } catch {
        setError('Microphone access denied.');
      }
    } else {
      try {
        await Audio.requestPermissionsAsync();
        await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
        const { recording } = await Audio.Recording.createAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
        recordingRef.current = recording;
        setIsRecording(true);
      } catch {
        setError('Could not start recording.');
      }
    }
  };

  // Shared analysis routine — used by both live recording and file upload.
  const analyzeBlob = async (audioBlob: Blob, filename = 'recording.wav') => {
    try {
      const formData = new FormData();
      formData.append('audio', audioBlob, filename);
      formData.append('original_text', selectedFragment.text);

      const response = await fetch(`${API_URL}/shadow/analyze`, {
        method: 'POST',
        body: formData,
      });
      const data = await response.json();
      setFeedback(data);
      setStep('feedback');
      setSessionScores(prev => [
        ...prev.slice(-4),
        { category: selectedFragment.category, score: data.accuracy_score },
      ]);
      // Persist to AsyncStorage (Option 1)
      try {
        const entry: ShadowStorageEntry = {
          ts: Date.now(),
          category: selectedFragment.category,
          difficulty: selectedFragment.difficulty,
          score: data.accuracy_score,
          transcribed: data.transcribed_text,
          target_text: selectedFragment.text,
        };
        const raw = await AsyncStorage.getItem('vf_shadow_sessions');
        const existing: ShadowStorageEntry[] = raw ? JSON.parse(raw) : [];
        await AsyncStorage.setItem(
          'vf_shadow_sessions',
          JSON.stringify([entry, ...existing].slice(0, 50))
        );
      } catch {}
    } catch {
      setError('Could not analyze. Make sure the backend is running.');
    } finally {
      setLoading(false);
    }
  };

  const stopAndAnalyze = async () => {
    setIsRecording(false);
    setLoading(true);

    try {
      let audioBlob: Blob;

      if (Platform.OS === 'web') {
        const mediaRecorder = mediaRecorderRef.current!;
        await new Promise<void>((resolve) => {
          mediaRecorder.onstop = () => resolve();
          mediaRecorder.stop();
          mediaRecorder.stream.getTracks().forEach((t) => t.stop());
        });
        audioBlob = new Blob(chunksRef.current, { type: 'audio/webm' });
      } else {
        await recordingRef.current!.stopAndUnloadAsync();
        const uri = recordingRef.current!.getURI()!;
        const res = await fetch(uri);
        audioBlob = await res.blob();
        recordingRef.current = null;
      }

      await analyzeBlob(audioBlob);
    } catch {
      setError('Could not analyze. Make sure the backend is running.');
      setLoading(false);
    }
  };

  // ── Upload a pre-recorded audio file instead of recording live ────────────
  const openFilePicker = () => {
    if (Platform.OS === 'web') {
      fileInputRef.current?.click();
    } else {
      setError('Upload is available in the web version. Use the microphone on mobile.');
    }
  };

  const handleFileSelected = async (e: any) => {
    const file: File | undefined = e?.target?.files?.[0];
    if (e?.target) e.target.value = '';   // allow re-selecting the same file
    if (!file) return;

    if (!file.type.startsWith('audio/') && !/\.(mp3|wav|m4a|ogg|webm|flac|aac)$/i.test(file.name)) {
      setError('Please select an audio file (MP3, WAV, M4A, OGG, WebM).');
      return;
    }
    if (file.size > 15 * 1024 * 1024) {
      setError('File too large (max 15 MB). Trim the clip and try again.');
      return;
    }

    setError('');
    setFeedback(null);
    setUploadedFileName(file.name);
    setLoading(true);
    await analyzeBlob(file, file.name);
  };

  const reset = () => {
    setFeedback(null);
    setError('');
    setStep('listen');
    setListenCount(0);
    setUploadedFileName(null);
  };

  const playFragmentAudio = async () => {
    setAudioLoading(true);
    try {
      if (Platform.OS === 'web') {
        const response = await fetch(`${API_URL}/shadow/generate-audio`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: selectedFragment.text }),
        });
        if (!response.ok) throw new Error(`Backend returned ${response.status}`);

        const audioBlob = await response.blob();
        const finalBlob = audioBlob.type ? audioBlob : new Blob([audioBlob], { type: 'audio/mpeg' });
        if (finalBlob.size === 0) throw new Error('Received empty audio');

        const audioUrl = URL.createObjectURL(finalBlob);
        if (audioPlayerRef.current) {
          audioPlayerRef.current.pause();
          audioPlayerRef.current.src = '';
        }

        const audio = new (window as any).Audio();
        audio.onerror = () => setError('Audio format error');
        audio.onplay = () => setIsPlayingAudio(true);
        audio.onpause = () => setIsPlayingAudio(false);
        audio.onended = () => {
          setIsPlayingAudio(false);
          setListenCount(c => c + 1);
        };
        audioPlayerRef.current = audio;
        audio.src = audioUrl;
        audio.playbackRate = playbackSpeed;
        await audio.play();
      } else {
        const response = await fetch(`${API_URL}/shadow/generate-audio`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: selectedFragment.text }),
        });
        if (!response.ok) throw new Error('Failed to generate audio');

        const audioBlob = await response.blob();
        const reader = new FileReader();
        reader.onload = async () => {
          const base64 = reader.result as string;
          const audioUri = `data:audio/mpeg;base64,${base64.split(',')[1]}`;
          if (audioRef.current) await audioRef.current.unloadAsync();
          const { sound } = await Audio.Sound.createAsync({ uri: audioUri });
          audioRef.current = sound;
          await sound.setRateAsync(playbackSpeed, true);
          setIsPlayingAudio(true);
          await sound.playAsync();
          sound.setOnPlaybackStatusUpdate((status) => {
            if (status.isLoaded && !status.isPlaying && status.didJustFinish) {
              setIsPlayingAudio(false);
              setListenCount(c => c + 1);
            }
          });
        };
        reader.readAsDataURL(audioBlob);
      }
    } catch (e) {
      setError(`Audio error: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setAudioLoading(false);
    }
  };

  const stopAudio = async () => {
    if (Platform.OS === 'web' && audioPlayerRef.current) {
      audioPlayerRef.current.pause();
      audioPlayerRef.current.currentTime = 0;
    } else if (audioRef.current) {
      await audioRef.current.pauseAsync();
      await audioRef.current.setPositionAsync(0);
    }
    setIsPlayingAudio(false);
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return '#0FBA9A';
    if (score >= 60) return '#8B5CF6';
    return '#EF4444';
  };

  const getWordDiff = (original: string, transcribed: string) => {
    const clean = (s: string) => s.toLowerCase().replace(/[.,!?;:"]/g, '').split(/\s+/).filter(Boolean);
    const origWords = clean(original);
    const saidWords = new Set(clean(transcribed));
    return origWords.map(w => ({ word: w, hit: saidWords.has(w) }));
  };

  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.headerBadge}>Shadow Speaking</Text>
        </View>

        <Text style={styles.pageTitle}>Shadow Speaking</Text>
        <Text style={styles.pageSubtitle}>
          Listen to a native speaker, then mirror their rhythm and flow.
        </Text>

        {/* Previously practised fragments (saved sessions for this user) */}
        <SavedSessions<SavedShadow>
          storageKey="vf_shadow_sessions"
          title="🎙 Practised fragments"
          accent={Colors.light.tint}
          getLabel={(s) => s.target_text}
          getScore={(s) => s.score}
          getTs={(s) => s.ts}
          getMeta={(s) => `${s.category} · ${s.difficulty}`}
          renderDetail={(s) => (
            <>
              <Text style={styles.savedTranscribed}>
                You said: <Text style={styles.transcribedText}>&quot;{s.transcribed}&quot;</Text>
              </Text>
              <Text style={styles.savedDetailLabel}>Word match</Text>
              <View style={styles.wordDiffRow}>
                {getWordDiff(s.target_text, s.transcribed).map((item, i) => (
                  <View key={i} style={[styles.wordDiffChip, { backgroundColor: item.hit ? '#0FBA9A20' : '#EF444420', borderColor: item.hit ? '#0FBA9A40' : '#EF444440' }]}>
                    <Text style={[styles.wordDiffText, { color: item.hit ? '#0FBA9A' : '#EF4444' }]}>{item.word}</Text>
                  </View>
                ))}
              </View>
            </>
          )}
        />

        {/* Session Score History */}
        {sessionScores.length > 0 && (
          <View style={styles.sessionHistoryBar}>
            <Text style={styles.sessionHistoryLabel}>Session:</Text>
            {sessionScores.map((s, i) => (
              <View key={i} style={[styles.sessionChip, { backgroundColor: getScoreColor(s.score) + '20', borderColor: getScoreColor(s.score) }]}>
                <Text style={[styles.sessionChipScore, { color: getScoreColor(s.score) }]}>{s.score}%</Text>
                <Text style={styles.sessionChipCat}>{s.category.slice(0, 4)}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Recommended fragments (Option 2) */}
        {recommendedFragments.length > 0 && (
          <View style={styles.recommendedSection}>
            <View style={styles.cardHeader}>
              <Feather name="star" size={13} color={Colors.light.tint} />
              <Text style={styles.recommendedLabel}>Recommended for you</Text>
            </View>
            <Text style={styles.recommendedSublabel}>Based on your weak phonemes from Accent DNA</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.recommendedScroll}>
              {recommendedFragments.map(f => {
                const matching = f.phoneme_targets.filter(p => weakPhonemes.includes(p));
                return (
                  <TouchableOpacity
                    key={f.id}
                    style={[
                      styles.recommendedChip,
                      selectedFragment.id === f.id && styles.recommendedChipActive,
                    ]}
                    onPress={() => { setSelectedFragment(f); reset(); }}
                  >
                    <Text style={[styles.recommendedChipCategory, selectedFragment.id === f.id && { color: '#fff' }]}>
                      {f.category}
                    </Text>
                    <View style={[styles.diffBadge, { backgroundColor: DIFF_COLORS[f.difficulty] + '25' }]}>
                      <Text style={[styles.diffText, { color: DIFF_COLORS[f.difficulty] }]}>{f.difficulty}</Text>
                    </View>
                    <View style={styles.recommendedTags}>
                      {matching.slice(0, 2).map(p => (
                        <View key={p} style={styles.recommendedPhonemeTag}>
                          <Text style={styles.recommendedPhonemeText}>{p}</Text>
                        </View>
                      ))}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        )}

        {/* Difficulty filter */}
        <View style={styles.filterRow}>
          {(['ALL', 'B1', 'B2', 'C1'] as const).map(d => (
            <TouchableOpacity
              key={d}
              style={[styles.filterChip, diffFilter === d && styles.filterChipActive]}
              onPress={() => setDiffFilter(d)}
            >
              <Text style={[styles.filterChipText, diffFilter === d && styles.filterChipTextActive]}>{d}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Fragment selector */}
        <Text style={styles.sectionLabel}>SELECT FRAGMENT</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.fragmentScroll}>
          {filteredFragments.map((f) => (
            <TouchableOpacity
              key={f.id}
              style={[
                styles.fragmentChip,
                selectedFragment.id === f.id && styles.fragmentChipActive,
              ]}
              onPress={() => {
                setSelectedFragment(f);
                reset();
              }}
            >
              <Text style={[styles.fragmentChipCategory, selectedFragment.id === f.id && styles.fragmentChipCategoryActive]}>
                {f.category}
              </Text>
              <View style={[styles.diffBadge, { backgroundColor: DIFF_COLORS[f.difficulty] + '25' }]}>
                <Text style={[styles.diffText, { color: DIFF_COLORS[f.difficulty] }]}>{f.difficulty}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Fragment card */}
        <View style={styles.fragmentCard}>
          <View style={styles.fragmentCardTop}>
            <View style={styles.cardHeader}>
              <Feather name="target" size={12} color={Colors.light.tint} />
              <Text style={styles.focusLabel}>{selectedFragment.focus}</Text>
            </View>
            <View style={[styles.diffBadgeLg, { backgroundColor: DIFF_COLORS[selectedFragment.difficulty] + '20', borderColor: DIFF_COLORS[selectedFragment.difficulty] }]}>
              <Text style={[styles.diffTextLg, { color: DIFF_COLORS[selectedFragment.difficulty] }]}>{selectedFragment.difficulty}</Text>
            </View>
          </View>
          <Text style={styles.fragmentText}>"{selectedFragment.text}"</Text>
          <View style={styles.fragmentTipRow}>
            <Feather name="info" size={13} color={Colors.light.textSecondary} style={{ marginTop: 1 }} />
            <Text style={styles.fragmentTip}>{selectedFragment.tips}</Text>
          </View>
        </View>

        {/* Steps */}
        <View style={styles.stepsRow}>
          {(['listen', 'record', 'feedback'] as const).map((s, i) => {
            const done = (step === 'record' && s === 'listen') || (step === 'feedback' && s !== 'feedback');
            return (
              <View key={s} style={styles.stepItem}>
                <View style={[styles.stepDot, step === s && styles.stepDotActive, done && styles.stepDotDone]}>
                  <Text style={[styles.stepDotText, (step === s || done) && styles.stepDotTextActive]}>{done ? '✓' : i + 1}</Text>
                </View>
                <Text style={[styles.stepLabel, step === s && styles.stepLabelActive]}>
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </Text>
              </View>
            );
          })}
        </View>

        {/* Step 1: Listen */}
        {step === 'listen' && (
          <View style={styles.stepCard}>
            <Text style={styles.stepTitle}>🎧 Step 1: Listen to Native Speaker</Text>
            <Text style={styles.stepDescription}>
              Play the audio and pay close attention to{' '}
              <Text style={styles.focusHighlight}>{selectedFragment.focus}</Text>.
              Listen multiple times before moving on.
            </Text>

            {/* Speed Control */}
            <View style={styles.speedRow}>
              <Text style={styles.speedLabel}>Playback speed:</Text>
              <View style={styles.speedChips}>
                {SPEED_OPTIONS.map(s => (
                  <TouchableOpacity
                    key={s}
                    style={[styles.speedChip, playbackSpeed === s && styles.speedChipActive]}
                    onPress={() => setPlaybackSpeed(s)}
                  >
                    <Text style={[styles.speedChipText, playbackSpeed === s && styles.speedChipTextActive]}>
                      {s}x
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.audioSection}>
              <TouchableOpacity
                style={[styles.playBtn, isPlayingAudio && styles.playBtnActive]}
                onPress={isPlayingAudio ? stopAudio : playFragmentAudio}
                disabled={audioLoading}
              >
                {audioLoading ? (
                  <ActivityIndicator color="#fff" size="large" />
                ) : (
                  <>
                    <Text style={styles.playIcon}>{isPlayingAudio ? '⏸' : '▶'}</Text>
                    <Text style={styles.playBtnText}>
                      {isPlayingAudio ? 'Pause' : 'Play Audio'}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
              {listenCount > 0 && (
                <Text style={styles.listenCount}>Listened {listenCount}× </Text>
              )}
            </View>

            <TouchableOpacity style={styles.nextBtn} onPress={() => setStep('record')}>
              <Text style={styles.nextBtnText}>Ready to Record →</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Step 2: Record */}
        {step === 'record' && (
          <View style={styles.stepCard}>
            <Text style={styles.stepTitle}>🎙 Step 2: Shadow it</Text>
            <Text style={styles.stepDescription}>
              Say the fragment out loud, matching the rhythm and natural flow you heard.
            </Text>

            <View style={styles.recordSection}>
              <View style={styles.recordBtnWrapper}>
                <Animated.View
                  style={[
                    styles.pulseBg,
                    {
                      transform: [{ scale: pulseAnim }],
                      opacity: pulseOpacity,
                    },
                  ]}
                />
                <TouchableOpacity
                  style={[styles.recordBtn, isRecording && styles.recordBtnActive]}
                  onPress={isRecording ? stopAndAnalyze : startRecording}
                  disabled={loading}
                >
                  {loading ? (
                    <ActivityIndicator color="#fff" size="large" />
                  ) : (
                    <>
                      <Text style={styles.recordIcon}>{isRecording ? '⏹' : '🎙'}</Text>
                      <Text style={styles.recordBtnText}>
                        {isRecording ? 'Stop & Analyze' : 'Start Recording'}
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>

              {isRecording && (
                <View style={styles.recordingIndicator}>
                  <View style={styles.recordingDot} />
                  <Text style={styles.recordingText}>Recording... speak now!</Text>
                </View>
              )}
            </View>

            {/* ── Upload alternative ─────────────────────────────────────── */}
            {!isRecording && (
              <>
                <View style={styles.uploadDivider}>
                  <View style={styles.uploadDividerLine} />
                  <Text style={styles.uploadDividerText}>or</Text>
                  <View style={styles.uploadDividerLine} />
                </View>

                {Platform.OS === 'web' && (
                  // @ts-ignore — RN-Web renders DOM input
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="audio/*,.mp3,.wav,.m4a,.ogg,.webm,.flac,.aac"
                    onChange={handleFileSelected}
                    style={{ display: 'none' }}
                  />
                )}

                <TouchableOpacity
                  style={styles.uploadBtn}
                  onPress={openFilePicker}
                  disabled={loading}
                  activeOpacity={0.85}
                >
                  <Text style={styles.uploadBtnText}>📁  Upload a recording instead</Text>
                </TouchableOpacity>

                {uploadedFileName && (
                  <Text style={styles.uploadFileName} numberOfLines={1}>📎 {uploadedFileName}</Text>
                )}
                {Platform.OS !== 'web' && (
                  <Text style={styles.uploadHint}>Upload works in the web version.</Text>
                )}
              </>
            )}

            {error ? <Text style={styles.errorText}>{error}</Text> : null}

            <TouchableOpacity style={styles.goBackStep} onPress={() => setStep('listen')}>
              <Text style={styles.goBackStepText}>← Re-listen</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Step 3: Feedback */}
        {step === 'feedback' && feedback && (
          <Animated.View
            style={[styles.feedbackSection, { opacity: feedbackOpacity, transform: [{ scale: feedbackScale }] }]}
          >
            <Text style={styles.stepTitle}>Step 3: Your Results</Text>

            {/* Score ring */}
            <View style={styles.scoreCard}>
              <View style={[styles.scoreRing, { borderColor: getScoreColor(feedback.accuracy_score) }]}>
                <Text style={[styles.scoreValue, { color: getScoreColor(feedback.accuracy_score) }]}>
                  {feedback.accuracy_score}%
                </Text>
                <Text style={styles.scoreRingLabel}>Overall</Text>
              </View>
              <View style={styles.scoreMeta}>
                <View style={styles.cardHeader}>
                  <Feather
                    name={feedback.accuracy_score >= 80 ? 'award' : feedback.accuracy_score >= 60 ? 'thumbs-up' : 'trending-up'}
                    size={14}
                    color={getScoreColor(feedback.accuracy_score)}
                  />
                  <Text style={[styles.scoreGradeLabel, { color: getScoreColor(feedback.accuracy_score) }]}>
                    {feedback.accuracy_score >= 80 ? 'Excellent' : feedback.accuracy_score >= 60 ? 'Good' : 'Keep Practicing'}
                  </Text>
                </View>
                {feedback.phoneme_score != null && (
                  <View style={styles.cardHeader}>
                    <Feather name="mic" size={12} color={getScoreColor(feedback.phoneme_score)} />
                    <Text style={[styles.phonemeScoreLabel, { color: getScoreColor(feedback.phoneme_score) }]}>
                      Pronunciation: {feedback.phoneme_score}/100
                    </Text>
                  </View>
                )}
                <Text style={styles.transcribedLabel}>
                  You said:{' '}
                  <Text style={styles.transcribedText}>"{feedback.transcribed_text}"</Text>
                </Text>
              </View>
            </View>

            {/* Word-by-word comparison */}
            <View style={styles.wordDiffCard}>
              <View style={styles.cardHeader}>
                <Feather name="align-left" size={14} color={Colors.light.tint} />
                <Text style={styles.feedbackCardTitle}>Word Match</Text>
              </View>
              <View style={styles.wordDiffRow}>
                {getWordDiff(selectedFragment.text, feedback.transcribed_text).map((item, i) => (
                  <View key={i} style={[styles.wordDiffChip, { backgroundColor: item.hit ? '#0FBA9A20' : '#EF444420', borderColor: item.hit ? '#0FBA9A40' : '#EF444440' }]}>
                    <Text style={[styles.wordDiffText, { color: item.hit ? '#0FBA9A' : '#EF4444' }]}>{item.word}</Text>
                  </View>
                ))}
              </View>
            </View>

            {/* Fluency feedback */}
            <View style={styles.feedbackCard}>
              <View style={styles.cardHeader}>
                <Feather name="message-square" size={14} color={Colors.light.tint} />
                <Text style={styles.feedbackCardTitle}>Fluency Feedback</Text>
              </View>
              <Text style={styles.feedbackCardText}>{feedback.fluency_feedback}</Text>
            </View>

            {/* Connected speech tip */}
            <View style={styles.tipCard}>
              <View style={styles.cardHeader}>
                <Feather name="link-2" size={14} color={Colors.light.tint} />
                <Text style={styles.feedbackCardTitle}>Connected Speech</Text>
              </View>
              <Text style={styles.feedbackCardText}>{feedback.connected_speech_tips}</Text>
            </View>

            {/* Fragment pronunciation tip */}
            <View style={styles.pronunciationTipCard}>
              <View style={styles.cardHeader}>
                <Feather name="volume-2" size={14} color={Colors.light.tint} />
                <Text style={styles.feedbackCardTitle}>Pronunciation Note</Text>
              </View>
              <Text style={styles.feedbackCardText}>{selectedFragment.tips}</Text>
            </View>

            {/* WPM card */}
            {feedback.wpm != null && feedback.wpm > 0 && (
              <View style={styles.feedbackCard}>
                <View style={styles.cardHeader}>
                  <Feather name="clock" size={14} color={Colors.light.tint} />
                  <Text style={styles.feedbackCardTitle}>Speaking Rate</Text>
                </View>
                <Text style={[styles.wpmValue, {
                  color: feedback.wpm_assessment?.label === 'ideal' ? '#0FBA9A'
                    : feedback.wpm_assessment?.label === 'too_slow' ? '#F59E0B'
                    : '#EF4444',
                }]}>
                  {feedback.wpm} WPM
                </Text>
                {feedback.wpm_assessment?.message && (
                  <Text style={styles.feedbackCardText}>{feedback.wpm_assessment.message}</Text>
                )}
              </View>
            )}

            {/* Prosody card */}
            {feedback.prosody && (
              <View style={styles.feedbackCard}>
                <View style={styles.cardHeader}>
                  <Feather name="activity" size={14} color={Colors.light.tint} />
                  <Text style={styles.feedbackCardTitle}>Prosody</Text>
                </View>
                {([
                  { label: 'Pitch', value: feedback.prosody.pitch_score },
                  { label: 'Rhythm', value: feedback.prosody.rhythm_score },
                  { label: 'Energy', value: feedback.prosody.energy_score },
                ] as { label: string; value?: number }[]).map(({ label, value }) =>
                  value != null ? (
                    <View key={label} style={styles.prosodyRow}>
                      <Text style={styles.prosodyLabel}>{label}</Text>
                      <View style={styles.prosodyBarBg}>
                        <View style={[styles.prosodyBarFill, {
                          width: `${value}%` as any,
                          backgroundColor: value >= 70 ? '#0FBA9A' : value >= 45 ? '#F59E0B' : '#EF4444',
                        }]} />
                      </View>
                      <Text style={styles.prosodyScore}>{value}</Text>
                    </View>
                  ) : null
                )}
              </View>
            )}

            {/* Phoneme word breakdown */}
            {feedback.word_breakdown && feedback.word_breakdown.length > 0 && (
              <View style={styles.feedbackCard}>
                <View style={styles.cardHeader}>
                  <Feather name="mic" size={14} color={Colors.light.tint} />
                  <Text style={styles.feedbackCardTitle}>Phoneme Accuracy</Text>
                </View>
                <View style={styles.wordBreakdownRow}>
                  {feedback.word_breakdown.map((wb, i) => (
                    <View key={i} style={[styles.wbChip, {
                      backgroundColor: wb.ok ? '#0FBA9A20' : '#EF444420',
                      borderColor: wb.ok ? '#0FBA9A40' : '#EF444440',
                    }]}>
                      <Text style={[styles.wbWord, { color: wb.ok ? '#0FBA9A' : '#EF4444' }]}>
                        {wb.word}
                      </Text>
                      {!wb.ok && wb.total > 0 && (
                        <Text style={styles.wbScore}>{wb.correct}/{wb.total}</Text>
                      )}
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* Missing words */}
            {feedback.missing_words?.length > 0 && (
              <View style={styles.wordsCard}>
                <View style={styles.cardHeader}>
                  <Feather name="alert-triangle" size={14} color={Colors.light.warning} />
                  <Text style={styles.feedbackCardTitle}>Missed Words</Text>
                </View>
                <View style={styles.wordsRow}>
                  {feedback.missing_words.map((w, i) => (
                    <View key={i} style={styles.missingWordChip}>
                      <Text style={styles.missingWordText}>{w}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* Extra words */}
            {feedback.extra_words?.length > 0 && (
              <View style={[styles.wordsCard, styles.extraWordsCard]}>
                <View style={styles.cardHeader}>
                  <Feather name="plus-circle" size={14} color={Colors.light.textSecondary} />
                  <Text style={styles.feedbackCardTitle}>Extra Words</Text>
                </View>
                <View style={styles.wordsRow}>
                  {feedback.extra_words.map((w, i) => (
                    <View key={i} style={styles.extraWordChip}>
                      <Text style={styles.extraWordText}>{w}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            <View style={styles.actionRow}>
              <TouchableOpacity style={styles.tryAgainBtn} onPress={reset}>
                <Feather name="refresh-cw" size={14} color={Colors.light.tint} />
                <Text style={styles.tryAgainText}>Try Again</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.newFragmentBtn}
                onPress={() => {
                  const others = FRAGMENTS.filter((f) => f.id !== selectedFragment.id);
                  setSelectedFragment(others[Math.floor(Math.random() * others.length)]);
                  reset();
                }}
              >
                <Text style={styles.newFragmentText}>Next Fragment</Text>
                <Feather name="arrow-right" size={14} color="#fff" />
              </TouchableOpacity>
            </View>
          </Animated.View>
        )}

        <View style={{ height: 48 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.light.background },
  scrollContent: { paddingHorizontal: 20, paddingTop: 56 },

  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
  backBtn: { paddingVertical: 6, paddingRight: 12 },
  backText: { color: Colors.light.tint, fontSize: 15, fontWeight: '600' },
  headerBadge: { fontSize: 13, fontWeight: '700', color: Colors.light.tint },

  pageTitle: { color: Colors.light.text, fontSize: 26, fontWeight: '700', letterSpacing: -0.4, marginBottom: 6 },
  pageSubtitle: { color: Colors.light.textSecondary, fontSize: 14, lineHeight: 20, marginBottom: 16 },

  sessionHistoryBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
    flexWrap: 'wrap',
  },
  sessionHistoryLabel: { color: Colors.light.textSecondary, fontSize: 12, fontWeight: '600' },
  sessionChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
  },
  sessionChipScore: { fontSize: 13, fontWeight: '800' },
  sessionChipCat: { fontSize: 9, color: Colors.light.textSecondary, fontWeight: '600' },

  wpmValue: { fontSize: 28, fontWeight: '800', marginBottom: 4 },

  prosodyRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  prosodyLabel: { width: 52, fontSize: 12, fontWeight: '600', color: Colors.light.textSecondary },
  prosodyBarBg: { flex: 1, height: 8, backgroundColor: Colors.light.border, borderRadius: 4, overflow: 'hidden' },
  prosodyBarFill: { height: '100%', borderRadius: 4 },
  prosodyScore: { width: 28, fontSize: 12, fontWeight: '700', color: Colors.light.text, textAlign: 'right' },

  wordBreakdownRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  wbChip: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, borderWidth: 1, alignItems: 'center' },
  wbWord: { fontSize: 13, fontWeight: '600' },
  wbScore: { fontSize: 10, color: Colors.light.textSecondary, marginTop: 1 },

  filterRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.light.border,
    backgroundColor: Colors.light.surface,
  },
  filterChipActive: { backgroundColor: Colors.light.tint, borderColor: Colors.light.tint },
  filterChipText: { fontSize: 12, fontWeight: '700', color: Colors.light.textSecondary },
  filterChipTextActive: { color: '#fff' },

  sectionLabel: { color: Colors.light.textSecondary, fontSize: 11, fontWeight: '700', letterSpacing: 1, marginBottom: 10 },
  fragmentScroll: { marginBottom: 20 },
  fragmentChip: {
    backgroundColor: Colors.light.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.light.border,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginRight: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  fragmentChipActive: { borderColor: Colors.light.tint, backgroundColor: Colors.light.tint + '12' },
  fragmentChipCategory: { color: Colors.light.textSecondary, fontSize: 13, fontWeight: '600' },
  fragmentChipCategoryActive: { color: Colors.light.tint },
  diffBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  diffText: { fontSize: 10, fontWeight: '700' },

  fragmentCard: {
    backgroundColor: Colors.light.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colors.light.border,
    overflow: 'hidden',
    marginBottom: 24,
    shadowColor: Colors.light.tint,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  fragmentCardTop: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
    padding: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  focusLabel: { color: Colors.light.tint, fontSize: 12, fontWeight: '600', flex: 1 },
  diffBadgeLg: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, borderWidth: 1 },
  diffTextLg: { fontSize: 11, fontWeight: '700' },
  fragmentText: { color: Colors.light.text, fontSize: 16, lineHeight: 24, fontWeight: '500', padding: 18 },
  fragmentTipRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 14, paddingBottom: 14, paddingTop: 4 },
  fragmentTip: { flex: 1, color: Colors.light.textSecondary, fontSize: 12, lineHeight: 17, fontStyle: 'italic' },

  stepsRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 24, marginBottom: 24 },
  stepItem: { alignItems: 'center', gap: 6 },
  stepDot: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: Colors.light.surface,
    borderWidth: 1, borderColor: Colors.light.border,
    alignItems: 'center', justifyContent: 'center',
  },
  stepDotActive: { backgroundColor: Colors.light.tint, borderColor: Colors.light.tint },
  stepDotDone: { backgroundColor: Colors.light.success + '30', borderColor: Colors.light.success },
  stepDotText: { color: Colors.light.textSecondary, fontSize: 12, fontWeight: '700' },
  stepDotTextActive: { color: '#fff' },
  stepLabel: { color: Colors.light.textSecondary, fontSize: 11, fontWeight: '600' },
  stepLabelActive: { color: Colors.light.tint },

  stepCard: {
    backgroundColor: Colors.light.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colors.light.border,
    padding: 20,
    gap: 14,
    shadowColor: Colors.light.tint,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  stepTitle: { color: Colors.light.text, fontSize: 16, fontWeight: '700' },
  stepDescription: { color: Colors.light.textSecondary, fontSize: 14, lineHeight: 21 },
  focusHighlight: { color: Colors.light.tint, fontWeight: '600' },

  speedRow: { flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  speedLabel: { fontSize: 13, color: Colors.light.textSecondary, fontWeight: '600' },
  speedChips: { flexDirection: 'row', gap: 8 },
  speedChip: {
    paddingHorizontal: 14, paddingVertical: 6, borderRadius: 10,
    borderWidth: 1, borderColor: Colors.light.border,
    backgroundColor: Colors.light.surface,
  },
  speedChipActive: { backgroundColor: Colors.light.tint, borderColor: Colors.light.tint },
  speedChipText: { fontSize: 12, fontWeight: '700', color: Colors.light.textSecondary },
  speedChipTextActive: { color: '#fff' },

  audioSection: { alignItems: 'center', gap: 12 },
  playBtn: {
    width: 130, height: 130, borderRadius: 65,
    backgroundColor: Colors.light.tint,
    alignItems: 'center', justifyContent: 'center',
    gap: 4,
    shadowColor: Colors.light.tint,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 8,
  },
  playBtnActive: { backgroundColor: Colors.light.success },
  playIcon: { fontSize: 36 },
  playBtnText: { color: '#fff', fontSize: 12, fontWeight: '700', textAlign: 'center' },
  listenCount: { color: Colors.light.tint, fontSize: 12, fontWeight: '700' },

  nextBtn: {
    backgroundColor: Colors.light.tint,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  nextBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },

  recordSection: { alignItems: 'center', paddingVertical: 8, gap: 16 },
  recordBtnWrapper: { alignItems: 'center', justifyContent: 'center', width: 140, height: 140 },
  pulseBg: {
    position: 'absolute',
    width: 130, height: 130, borderRadius: 65,
    backgroundColor: Colors.light.error,
  },
  recordBtn: {
    width: 120, height: 120, borderRadius: 60,
    backgroundColor: Colors.light.tint,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: Colors.light.tint,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
    gap: 4,
  },
  recordBtnActive: { backgroundColor: Colors.light.error },
  recordIcon: { fontSize: 32, color: '#fff' },
  recordBtnText: { color: '#fff', fontSize: 11, fontWeight: '700', textAlign: 'center' },
  recordingIndicator: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  recordingDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.light.error },
  recordingText: { color: Colors.light.error, fontSize: 13, fontWeight: '600' },

  goBackStep: { alignItems: 'center', paddingVertical: 8 },
  goBackStepText: { color: Colors.light.textSecondary, fontSize: 13, fontWeight: '600' },

  // Upload alternative
  uploadDivider: { flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 4 },
  uploadDividerLine: { flex: 1, height: 1, backgroundColor: Colors.light.border },
  uploadDividerText: { fontSize: 12, color: Colors.light.textSecondary, fontWeight: '600' },
  uploadBtn: {
    alignItems: 'center', justifyContent: 'center',
    paddingVertical: 13, borderRadius: 14,
    borderWidth: 1.5, borderColor: Colors.light.tint + '60',
    borderStyle: 'dashed',
    backgroundColor: Colors.light.tint + '0C',
  },
  uploadBtnText: { color: Colors.light.tint, fontSize: 14, fontWeight: '700' },
  uploadFileName: { color: Colors.light.tint, fontSize: 12, fontWeight: '600', textAlign: 'center' },
  uploadHint: { color: Colors.light.textLight, fontSize: 11, fontStyle: 'italic', textAlign: 'center' },

  errorText: { color: Colors.light.error, fontSize: 13, textAlign: 'center' },

  feedbackSection: { gap: 14 },

  scoreCard: {
    backgroundColor: Colors.light.surface,
    borderRadius: 18,
    padding: 20,
    borderWidth: 1,
    borderColor: Colors.light.border,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    shadowColor: Colors.light.tint,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  scoreRing: {
    width: 90, height: 90, borderRadius: 45,
    borderWidth: 5,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.light.background,
  },
  scoreValue: { fontSize: 22, fontWeight: '800', letterSpacing: -1 },
  scoreRingLabel: { fontSize: 10, color: Colors.light.textSecondary, fontWeight: '600' },
  scoreMeta: { flex: 1, gap: 6 },
  scoreGradeLabel: { fontSize: 16, fontWeight: '700', color: Colors.light.text },
  phonemeScoreLabel: { fontSize: 13, fontWeight: '600' },
  transcribedLabel: { color: Colors.light.textSecondary, fontSize: 12 },
  transcribedText: { color: Colors.light.text, fontWeight: '600' },

  wordDiffCard: {
    backgroundColor: Colors.light.surface,
    borderRadius: 14, padding: 16, borderWidth: 1, borderColor: Colors.light.border, gap: 10,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 },
  wordDiffRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  wordDiffChip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, borderWidth: 1 },
  wordDiffText: { fontSize: 13, fontWeight: '600' },

  savedTranscribed: { color: Colors.light.textSecondary, fontSize: 13, lineHeight: 19 },
  savedDetailLabel: { fontSize: 11, fontWeight: '700', color: Colors.light.textSecondary },

  feedbackCard: {
    backgroundColor: Colors.light.surface,
    borderRadius: 14, padding: 16, borderWidth: 1,
    borderColor: Colors.light.success + '25', gap: 8,
  },
  tipCard: {
    backgroundColor: Colors.light.surface,
    borderRadius: 14, padding: 16, borderWidth: 1,
    borderColor: Colors.light.tint + '25', gap: 8,
  },
  pronunciationTipCard: {
    backgroundColor: Colors.light.tint + '08',
    borderRadius: 14, padding: 16, borderWidth: 1,
    borderColor: Colors.light.tint + '20', gap: 8,
  },
  feedbackCardTitle: { color: Colors.light.text, fontSize: 14, fontWeight: '700' },
  feedbackCardText: { color: Colors.light.textSecondary, fontSize: 13, lineHeight: 20 },

  wordsCard: {
    backgroundColor: Colors.light.surface,
    borderRadius: 14, padding: 16, borderWidth: 1,
    borderColor: Colors.light.error + '20', gap: 10,
  },
  extraWordsCard: { borderColor: Colors.light.warning + '30' },
  wordsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  missingWordChip: {
    backgroundColor: Colors.light.error + '15',
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10,
    borderWidth: 1, borderColor: Colors.light.error + '30',
  },
  missingWordText: { color: Colors.light.error, fontSize: 13, fontWeight: '600' },
  extraWordChip: {
    backgroundColor: Colors.light.warning + '15',
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10,
    borderWidth: 1, borderColor: Colors.light.warning + '30',
  },
  extraWordText: { color: Colors.light.warning, fontSize: 13, fontWeight: '600' },

  actionRow: { flexDirection: 'row', gap: 12 },
  tryAgainBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 14,
    borderRadius: 14, borderWidth: 2, borderColor: Colors.light.tint,
  },
  tryAgainText: { color: Colors.light.tint, fontSize: 14, fontWeight: '700' },
  newFragmentBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 14,
    borderRadius: 14, backgroundColor: Colors.light.tint,
  },
  newFragmentText: { color: '#fff', fontSize: 14, fontWeight: '700' },

  // Recommended section (Option 2)
  recommendedSection: {
    backgroundColor: Colors.light.tint + '0C',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.light.tint + '30',
    padding: 14,
    marginBottom: 16,
    gap: 6,
  },
  recommendedLabel: { color: Colors.light.tint, fontSize: 13, fontWeight: '800' },
  recommendedSublabel: { color: Colors.light.textSecondary, fontSize: 11, marginBottom: 4 },
  recommendedScroll: { marginHorizontal: -4 },
  recommendedChip: {
    backgroundColor: Colors.light.surface,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: Colors.light.tint + '50',
    paddingHorizontal: 12,
    paddingVertical: 9,
    marginRight: 10,
    gap: 5,
    minWidth: 120,
  },
  recommendedChipActive: { backgroundColor: Colors.light.tint, borderColor: Colors.light.tint },
  recommendedChipCategory: { color: Colors.light.text, fontSize: 13, fontWeight: '700' },
  recommendedTags: { flexDirection: 'row', gap: 4, flexWrap: 'wrap' },
  recommendedPhonemeTag: {
    backgroundColor: '#8B5CF620',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  recommendedPhonemeText: { color: '#8B5CF6', fontSize: 10, fontWeight: '700' },
});
