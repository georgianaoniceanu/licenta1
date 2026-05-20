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
import { API_URL } from '../../constants/api';
import { useLearnerProfile } from '../../context/LearnerProfile';
import { Colors, Animations } from '../../constants/theme';

// romanian_error: documented substitution patterns from Măchiță (2021)
// Interlanguage Theory (Selinker 1972) + Auditory Distance Model (Brannen 2011)
const PHONEME_EXERCISES = [
  {
    phoneme: '/u:/-/ʊ/',
    description: 'Tense vs Lax U',
    words: ['goose', 'book', 'food', 'look', 'pool'],
    minimal_pairs: [['goose', 'good'], ['fool', 'full'], ['pool', 'pull']],
    ipa: '/uː/ vs /ʊ/',
    articulation: 'For /uː/: lips tightly rounded, tongue raised and back. For /ʊ/: lips loosely rounded, tongue slightly lower.',
    practice_sentence: 'The cook put good food in the cool pool.',
    tip: 'Keep /u:/ tense (longer), /ʊ/ lax (shorter).',
    romanian_error: {
      substitute: 'Both collapsed into one sound close to Romanian /u/',
      why: 'Romanian has no tense-lax vowel distinction — both phonemes feel identical to L1 speakers (Interlanguage merging)',
    },
    cefr: 'B1',
    color: '#d62728',
  },
  {
    phoneme: '/i:/-/ɪ/',
    description: 'Tense vs Lax I',
    words: ['fleece', 'kit', 'see', 'sit', 'cheese'],
    minimal_pairs: [['seat', 'sit'], ['feel', 'fill'], ['sheep', 'ship']],
    ipa: '/iː/ vs /ɪ/',
    articulation: 'For /iː/: lips spread, tongue high and front. For /ɪ/: lips relaxed, tongue slightly lower.',
    practice_sentence: 'He still feels ill after eating six green beans.',
    tip: 'Minimal pairs: fleece/kit. Keep /i:/ forward and tense.',
    romanian_error: {
      substitute: 'Both merged into one category close to Romanian /i/',
      why: 'Same tense-lax merging as /uː/-/ʊ/ — Romanian /i/ sits between the two English phonemes, causing confusion',
    },
    cefr: 'B1',
    color: '#ff6b35',
  },
  {
    phoneme: '/ð/',
    description: 'TH voiced',
    words: ['the', 'this', 'that', 'there', 'though'],
    minimal_pairs: [['this', 'dis'], ['they', 'day'], ['though', 'dough']],
    ipa: '/ð/',
    articulation: 'Place the tip of your tongue lightly between your upper and lower front teeth, then add voice (vibration in throat).',
    practice_sentence: 'This is the other thing that bothers them.',
    tip: 'NOT in Romanian — tongue BETWEEN teeth, add voice.',
    romanian_error: {
      substitute: '[d] — voiced dental stop',
      why: 'Auditory Distance Model (Brannen 2011): Romanian /d/ is dental, perceived as acoustically the closest substitute for /ð/. French speakers use [z]; Romanian speakers use [d].',
    },
    cefr: 'B2',
    color: '#ffa500',
  },
  {
    phoneme: '/θ/',
    description: 'TH unvoiced',
    words: ['think', 'three', 'through', 'thanks', 'thunder'],
    minimal_pairs: [['think', 'sink'], ['three', 'tree'], ['thumb', 'sum']],
    ipa: '/θ/',
    articulation: 'Place tongue between teeth (like /ð/) but WITHOUT voicing — just push air through.',
    practice_sentence: 'Think through three thousand theories thoroughly.',
    tip: 'Place tongue between teeth and blow air — no voice.',
    romanian_error: {
      substitute: '[t] — voiceless dental stop (occasionally [f])',
      why: 'Auditory Distance Model: Romanian /t/ is dental and perceived as the closest equivalent to /θ/. Unlike French speakers who prefer [f], Romanian speakers use [t] due to their richer dental consonant inventory.',
    },
    cefr: 'B2',
    color: '#ffd700',
  },
  {
    phoneme: '/æ/-/ɑ:/',
    description: 'Short A vs Back A',
    words: ['cat', 'bad', 'math', 'father', 'palm'],
    minimal_pairs: [['cat', 'cart'], ['bat', 'bar'], ['bad', 'bard']],
    ipa: '/æ/ vs /ɑː/',
    articulation: 'For /æ/: jaw drops significantly, front of tongue raised. For /ɑː/: jaw very open, tongue flat and back.',
    practice_sentence: 'My father parked the car after the bad crash.',
    tip: 'Open wider for /æ/, further back and lower for /ɑː/.',
    romanian_error: {
      substitute: '/æ/ → shifted toward Romanian /e/ (F2 too high, not open enough)',
      why: 'Interlanguage: /æ/ formant values fall between RP and Romanian /e/ — second best realised vowel, but still consistently undershoot the English target',
    },
    cefr: 'B2',
    color: '#90ee90',
  },
  {
    phoneme: '/ʌ/',
    description: 'Mid-central vowel',
    words: ['cup', 'blood', 'mud', 'sun', 'love'],
    minimal_pairs: [['cut', 'caught'], ['sun', 'son'], ['love', 'live']],
    ipa: '/ʌ/',
    articulation: 'Tongue in mid-central position, mouth half-open. More central and less open than Romanian /a/.',
    practice_sentence: 'The young monk suddenly jumped up in the muddy sun.',
    tip: 'More central and less open than Romanian /a/.',
    romanian_error: {
      substitute: 'Too open — closer to Romanian /a/ (F1 avg 786 Hz vs RP 623 Hz)',
      why: 'Romanian /a/ is more open and back; learners transfer L1 F1 values, producing a vowel that is too low and too back for English /ʌ/',
    },
    cefr: 'B1',
    color: '#86efac',
  },
  {
    phoneme: '[ɫ] Dark L',
    description: 'Dark L at end',
    words: ['milk', 'wall', 'tell', 'field', 'small'],
    minimal_pairs: [['milk', 'milch'], ['feel', 'fill'], ['tall', 'tale']],
    ipa: '[ɫ]',
    articulation: 'Raise the back of the tongue toward the soft palate while tip touches upper teeth ridge. Sounds "darker" than clear /l/.',
    practice_sentence: 'The tall mill wall will fill with small hills.',
    tip: 'Position rule: clear /l/ at word start, dark [ɫ] at end or before consonant.',
    romanian_error: {
      substitute: 'Clear [l] in all positions',
      why: 'Romanian /l/ is always realised as clear [l] — dark [ɫ] does not exist in L1. Only 50% of Romanian learners produced it correctly even once.',
    },
    cefr: 'B2',
    color: '#4ade80',
  },
  {
    phoneme: '/ŋ/',
    description: 'NG sound',
    words: ['doing', 'sing', 'ring', 'thing', 'morning'],
    minimal_pairs: [['sing', 'sin'], ['ring', 'rin'], ['king', 'kin']],
    ipa: '/ŋ/',
    articulation: 'Back of tongue rises to touch soft palate (like /k/ or /g/ but with nasal air flow). NO extra /g/ sound after.',
    practice_sentence: 'Singing and dancing brings amazing energy every morning.',
    tip: 'Train final /ŋ/ WITHOUT adding extra [g] at the end.',
    romanian_error: {
      substitute: '[ŋg] — velar nasal always followed by a voiced velar stop',
      why: 'In Romanian, [ŋ] is only an allophone of /n/ before /k/ or /g/ — it never occurs standalone. 50% of learners always added [g]; 0% correct on the word-list task.',
    },
    cefr: 'B1',
    color: '#a855f7',
  },
  {
    phoneme: '[kʰ]',
    description: 'Aspirated K',
    words: ['keep', 'kind', 'kit', 'king', 'key'],
    minimal_pairs: [['keep', 'geep'], ['cold', 'gold'], ['Kate', 'gate']],
    ipa: '[kʰ]',
    articulation: 'Back of tongue rises to soft palate and releases with a burst of air (aspiration). Hold paper in front: it should flutter.',
    practice_sentence: 'The kind king kept a clean, cool, quiet castle.',
    tip: 'Aspiration at start of stressed syllable: release a puff of air (VOT 40–80ms).',
    romanian_error: {
      substitute: 'Over-aspirated — VOT often >40 ms (70% of Romanian learners)',
      why: 'English VOT increases from bilabial to velar stops. Romanian learners over-apply this English pattern at the velar place, producing bursts longer than the 30–40 ms English norm.',
    },
    cefr: 'C1',
    color: '#4f6ef7',
  },
  {
    phoneme: '/ə/',
    description: 'Schwa (unstressed)',
    words: ['about', 'sofa', 'comma', 'around', 'alone'],
    minimal_pairs: [['about', 'a boot'], ['the /ðə/', 'the /ðiː/']],
    ipa: '/ə/',
    articulation: 'Completely relaxed mouth and tongue in the middle position. The most natural, effortless sound in English.',
    practice_sentence: 'About a dozen of us arrived around eleven in the morning.',
    tip: 'Light, unstressed — never fully elide it; it glues the sentence together.',
    romanian_error: {
      substitute: 'Full vowel quality preserved in unstressed syllables',
      why: 'Romanian has no schwa reduction — every vowel keeps its full quality. English unstressed syllables collapse to /ə/, which feels unnatural to L1 Romanian speakers.',
    },
    cefr: 'B2',
    color: '#06b6d4',
  },
  {
    phoneme: '[pʰ]',
    description: 'Aspirated P',
    words: ['pen', 'put', 'pat', 'pick', 'peace'],
    minimal_pairs: [['pen', 'ben'], ['pet', 'bet'], ['peace', 'beast']],
    ipa: '[pʰ]',
    articulation: 'Lips pressed together, release with a burst of air. Hold a piece of paper: it should move clearly when you say "pen".',
    practice_sentence: 'Peter picked a pretty pink pepper plant in the park.',
    tip: 'English initial /p/ needs aspiration (VOT 50–100ms) — stronger puff than Romanian.',
    romanian_error: {
      substitute: 'Unaspirated [p] at word start',
      why: 'Romanian aspiration occurs only pre-pausally (after stops at the end of an utterance), never word-initially. Learners suppress initial aspiration by L1 transfer.',
    },
    cefr: 'C1',
    color: '#ec4899',
  },
  {
    phoneme: '[tʰ]',
    description: 'Aspirated T',
    words: ['tea', 'top', 'time', 'take', 'talk'],
    minimal_pairs: [['tea', 'dee'], ['time', 'dime'], ['ten', 'den']],
    ipa: '[tʰ]',
    articulation: 'Tongue tip behind upper teeth, release with strong air burst. The aspiration distinguishes /t/ from /d/ in initial position.',
    practice_sentence: 'Ten tiny turtles took time to talk to Tom today.',
    tip: 'Explicit aspiration at stressed word start — puff of air distinguishes it from /d/.',
    romanian_error: {
      substitute: 'Unaspirated [t] — the hardest allophone in the study',
      why: 'Only 1 out of 10 Romanian learners produced [tʰ] correctly (Măchiță 2021). Initial aspiration is absent in Romanian; L1 transfer fully suppresses the required VOT of 30–40 ms.',
    },
    cefr: 'C1',
    color: '#f59e0b',
  },
];

type Feedback = {
  accuracy_score: number;
  transcribed_text: string;
  problematic_phonemes: { phoneme: string; example: string; severity: string }[];
  suggestions: { issue: string; fix: string }[];
  overall_feedback: string;
};

type PracticeMode = 'word' | 'sentence';
type DiffFilter = 'ALL' | 'B1' | 'B2' | 'C1';

const ScoreRing = ({ score }: { score: number }) => {
  const color = score >= 80 ? '#22c55e' : score >= 60 ? '#f59e0b' : '#f87171';
  const label = score >= 80 ? 'Excellent' : score >= 60 ? 'Good' : 'Needs Work';
  return (
    <View style={scoreRingStyles.outer}>
      <View style={[scoreRingStyles.ring, { borderColor: color }]}>
        <Text style={[scoreRingStyles.value, { color }]}>{score}%</Text>
        <Text style={scoreRingStyles.sublabel}>Accuracy</Text>
      </View>
      <Text style={[scoreRingStyles.grade, { color }]}>{label}</Text>
    </View>
  );
};

const scoreRingStyles = StyleSheet.create({
  outer: { alignItems: 'center', gap: 6 },
  ring: {
    width: 100, height: 100, borderRadius: 50,
    borderWidth: 6,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.light.background,
  },
  value: { fontSize: 24, fontWeight: '800', letterSpacing: -1 },
  sublabel: { fontSize: 10, color: Colors.light.textSecondary, fontWeight: '600' },
  grade: { fontSize: 13, fontWeight: '700' },
});

export default function AccentDNAScreen() {
  const router = useRouter();
  const { updatePhonemePerformance, updateSessionMetrics } = useLearnerProfile();

  const [selectedExercise, setSelectedExercise] = useState(PHONEME_EXERCISES[0]);
  const [selectedWord, setSelectedWord] = useState(PHONEME_EXERCISES[0].words[0]);
  const [practiceMode, setPracticeMode] = useState<PracticeMode>('word');
  const [diffFilter, setDiffFilter] = useState<DiffFilter>('ALL');
  const [showHeatmap, setShowHeatmap] = useState(false);
  const [showArticulation, setShowArticulation] = useState(false);
  const [showMinimalPairs, setShowMinimalPairs] = useState(false);

  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [error, setError] = useState('');
  const [attemptHistory, setAttemptHistory] = useState<Record<string, number[]>>({});

  const feedbackOpacity = useRef(new Animated.Value(0)).current;
  const feedbackScale = useRef(new Animated.Value(0.95)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const pulseOpacity = useRef(new Animated.Value(0.6)).current;
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

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

  const filteredExercises = diffFilter === 'ALL'
    ? PHONEME_EXERCISES
    : PHONEME_EXERCISES.filter(e => e.cefr === diffFilter);

  const currentHistory = attemptHistory[selectedExercise.phoneme] || [];
  const targetText = practiceMode === 'word' ? selectedWord : selectedExercise.practice_sentence;

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
        const { recording: rec } = await Audio.Recording.createAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
        setRecording(rec);
        setIsRecording(true);
      } catch {
        setError('Could not start recording.');
      }
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
        await recording!.stopAndUnloadAsync();
        const uri = recording!.getURI()!;
        const res = await fetch(uri);
        audioBlob = await res.blob();
        setRecording(null);
      }

      const formData = new FormData();
      formData.append('audio', audioBlob, 'recording.wav');
      formData.append('target_text', targetText);

      const response = await fetch(`${API_URL}/accent/analyze`, {
        method: 'POST',
        body: formData,
      });
      const data = await response.json();
      setFeedback(data);

      setAttemptHistory(prev => {
        const key = selectedExercise.phoneme;
        const existing = prev[key] || [];
        return { ...prev, [key]: [...existing.slice(-4), data.accuracy_score] };
      });

      await updatePhonemePerformance(selectedExercise.phoneme, data.accuracy_score);
      await updateSessionMetrics(1, 0);
    } catch {
      setError('Could not analyze. Make sure the backend is running.');
    } finally {
      setLoading(false);
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return '#22c55e';
    if (score >= 60) return '#f59e0b';
    return '#f87171';
  };

  const getSeverityColor = (severity: string) => {
    if (severity === 'high') return '#f87171';
    if (severity === 'medium') return '#f59e0b';
    return '#22c55e';
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
          <Text style={styles.headerBadge}>🧬 Accent DNA</Text>
        </View>

        <Text style={styles.pageTitle}>Accent DNA</Text>
        <Text style={styles.pageSubtitle}>
          Romanian-English phoneme interference training. Target your exact weak spots.
        </Text>

        {/* Heatmap toggle */}
        <TouchableOpacity
          style={styles.heatmapToggleBtn}
          onPress={() => setShowHeatmap(!showHeatmap)}
        >
          <Text style={styles.heatmapToggleIcon}>🗺️</Text>
          <View style={styles.heatmapToggleContent}>
            <Text style={styles.heatmapToggleText}>
              {showHeatmap ? 'Hide' : 'Show'} Phoneme Overview
            </Text>
            <Text style={styles.heatmapToggleDesc}>All 12 phonemes — tap to jump to one</Text>
          </View>
          <Text style={styles.heatmapChevron}>{showHeatmap ? '▲' : '▼'}</Text>
        </TouchableOpacity>

        {/* Inline heatmap grid */}
        {showHeatmap && (
          <View style={styles.heatmapGrid}>
            {PHONEME_EXERCISES.map(ex => {
              const history = attemptHistory[ex.phoneme] || [];
              const lastScore = history[history.length - 1];
              return (
                <TouchableOpacity
                  key={ex.phoneme}
                  style={[styles.heatmapCell, { backgroundColor: ex.color + '20', borderColor: ex.color + '60' }]}
                  onPress={() => {
                    setSelectedExercise(ex);
                    setSelectedWord(ex.words[0]);
                    setFeedback(null);
                    setShowHeatmap(false);
                  }}
                >
                  <Text style={[styles.heatmapCellPhoneme, { color: ex.color }]}>{ex.phoneme}</Text>
                  <Text style={styles.heatmapCellCefr}>{ex.cefr}</Text>
                  {lastScore !== undefined && (
                    <Text style={[styles.heatmapCellScore, { color: getScoreColor(lastScore) }]}>{lastScore}%</Text>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* Difficulty filter */}
        <View style={styles.filterRow}>
          {(['ALL', 'B1', 'B2', 'C1'] as DiffFilter[]).map(d => (
            <TouchableOpacity
              key={d}
              style={[styles.filterChip, diffFilter === d && styles.filterChipActive]}
              onPress={() => setDiffFilter(d)}
            >
              <Text style={[styles.filterChipText, diffFilter === d && styles.filterChipTextActive]}>{d}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Phoneme selector */}
        <Text style={styles.sectionLabel}>SELECT PHONEME</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.phonemeScroll}>
          {filteredExercises.map((ex) => {
            const history = attemptHistory[ex.phoneme] || [];
            const lastScore = history[history.length - 1];
            return (
              <TouchableOpacity
                key={ex.phoneme}
                style={[
                  styles.phonemeChip,
                  selectedExercise.phoneme === ex.phoneme && {
                    backgroundColor: ex.color + '25',
                    borderColor: ex.color,
                  },
                ]}
                onPress={() => {
                  setSelectedExercise(ex);
                  setSelectedWord(ex.words[0]);
                  setFeedback(null);
                  setShowArticulation(false);
                  setShowMinimalPairs(false);
                }}
              >
                <Text style={[styles.phonemeChipText, selectedExercise.phoneme === ex.phoneme && { color: ex.color }]}>
                  {ex.phoneme}
                </Text>
                <Text style={styles.phonemeChipDesc}>{ex.description}</Text>
                <View style={styles.phonemeChipMeta}>
                  <Text style={[styles.phonemeChipCefr, { color: ex.color }]}>{ex.cefr}</Text>
                  {lastScore !== undefined && (
                    <Text style={[styles.phonemeChipScore, { color: getScoreColor(lastScore) }]}>{lastScore}%</Text>
                  )}
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Exercise card */}
        <View style={[styles.exerciseCard, { borderColor: selectedExercise.color + '50' }]}>
          <View style={[styles.cardAccentLine, { backgroundColor: selectedExercise.color }]} />
          <View style={styles.exerciseContent}>
            {/* IPA */}
            <View style={styles.ipaRow}>
              <View style={[styles.ipaBadge, { backgroundColor: selectedExercise.color + '20', borderColor: selectedExercise.color + '50' }]}>
                <Text style={[styles.ipaText, { color: selectedExercise.color }]}>{selectedExercise.ipa}</Text>
              </View>
              <View style={[styles.cefrBadge, { backgroundColor: selectedExercise.color + '15' }]}>
                <Text style={[styles.cefrText, { color: selectedExercise.color }]}>{selectedExercise.cefr}</Text>
              </View>
            </View>

            <Text style={styles.tipText}>💡 {selectedExercise.tip}</Text>

            {/* Romanian error pattern — Măchiță (2021) */}
            {selectedExercise.romanian_error && (
              <View style={styles.romanianErrorBox}>
                <View style={styles.romanianErrorHeader}>
                  <Text style={styles.romanianErrorIcon}>⚠️</Text>
                  <Text style={styles.romanianErrorTitle}>Typical Romanian error</Text>
                </View>
                <Text style={styles.romanianErrorSubstitute}>
                  {selectedExercise.romanian_error.substitute}
                </Text>
                <Text style={styles.romanianErrorWhy}>
                  {selectedExercise.romanian_error.why}
                </Text>
                <Text style={styles.romanianErrorSource}>
                  Măchiță (2021) · Selinker (1972) Interlanguage Theory · Brannen (2011) Auditory Distance Model
                </Text>
              </View>
            )}

            {/* Articulation guide — structured visual steps */}
            <TouchableOpacity
              style={styles.expandableHeader}
              onPress={() => setShowArticulation(!showArticulation)}
            >
              <Text style={styles.expandableTitle}>👄 Mouth Position Guide</Text>
              <Text style={styles.expandableChevron}>{showArticulation ? '▲' : '▼'}</Text>
            </TouchableOpacity>
            {showArticulation && (
              <View style={[styles.expandableBody, { borderColor: selectedExercise.color + '30', gap: 0 }]}>
                {selectedExercise.articulation
                  .split(/(?<=[.!?])\s+/)
                  .filter(s => s.trim().length > 4)
                  .map((sentence, i) => {
                    const s = sentence.trim();
                    const icon =
                      /tongue/i.test(s)              ? '👅' :
                      /lip/i.test(s)                 ? '👄' :
                      /teeth|dental|tooth/i.test(s)  ? '🦷' :
                      /air|breath|puff|aspir|paper|flutter/i.test(s) ? '💨' :
                      /voice|vibrat|throat/i.test(s) ? '🗣️' :
                      /jaw|mouth|open/i.test(s)      ? '↕️' :
                      /back.*tongue|tongue.*back|soft palate|velar/i.test(s) ? '↩️' : '▸';
                    const accent = selectedExercise.color;
                    return (
                      <View key={i} style={[styles.artStep, { borderLeftColor: accent }]}>
                        <Text style={styles.artStepIcon}>{icon}</Text>
                        <Text style={styles.artStepText}>{s}</Text>
                      </View>
                    );
                  })}
                <View style={[styles.artTipRow, { backgroundColor: selectedExercise.color + '12' }]}>
                  <Text style={styles.artTipLabel}>💡 KEY TIP</Text>
                  <Text style={[styles.artTipText, { color: selectedExercise.color }]}>{selectedExercise.tip}</Text>
                </View>
              </View>
            )}

            {/* Expandable minimal pairs */}
            <TouchableOpacity
              style={styles.expandableHeader}
              onPress={() => setShowMinimalPairs(!showMinimalPairs)}
            >
              <Text style={styles.expandableTitle}>🔀 Minimal Pairs</Text>
              <Text style={styles.expandableChevron}>{showMinimalPairs ? '▲' : '▼'}</Text>
            </TouchableOpacity>
            {showMinimalPairs && (
              <View style={[styles.expandableBody, { borderColor: selectedExercise.color + '30' }]}>
                {selectedExercise.minimal_pairs.map((pair, i) => (
                  <View key={i} style={styles.minimalPairRow}>
                    <View style={[styles.minimalPairWord, { backgroundColor: selectedExercise.color + '20' }]}>
                      <Text style={[styles.minimalPairText, { color: selectedExercise.color }]}>{pair[0]}</Text>
                    </View>
                    <Text style={styles.minimalPairVs}>vs</Text>
                    <View style={[styles.minimalPairWord, { backgroundColor: '#64748b20' }]}>
                      <Text style={[styles.minimalPairText, { color: '#64748b' }]}>{pair[1]}</Text>
                    </View>
                  </View>
                ))}
              </View>
            )}

            {/* Practice mode toggle */}
            <View style={styles.modeToggle}>
              <TouchableOpacity
                style={[styles.modeBtn, practiceMode === 'word' && styles.modeBtnActive]}
                onPress={() => { setPracticeMode('word'); setFeedback(null); }}
              >
                <Text style={[styles.modeBtnText, practiceMode === 'word' && styles.modeBtnTextActive]}>Single Word</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modeBtn, practiceMode === 'sentence' && styles.modeBtnActive]}
                onPress={() => { setPracticeMode('sentence'); setFeedback(null); }}
              >
                <Text style={[styles.modeBtnText, practiceMode === 'sentence' && styles.modeBtnTextActive]}>Full Sentence</Text>
              </TouchableOpacity>
            </View>

            {practiceMode === 'word' && (
              <>
                <Text style={styles.wordLabel}>Pick a word to practice:</Text>
                <View style={styles.wordsRow}>
                  {selectedExercise.words.map((word) => (
                    <TouchableOpacity
                      key={word}
                      style={[
                        styles.wordChip,
                        selectedWord === word && {
                          backgroundColor: selectedExercise.color + '25',
                          borderColor: selectedExercise.color,
                        },
                      ]}
                      onPress={() => { setSelectedWord(word); setFeedback(null); }}
                    >
                      <Text style={[styles.wordChipText, selectedWord === word && { color: selectedExercise.color }]}>
                        {word}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            )}

            {practiceMode === 'sentence' && (
              <View style={[styles.sentenceBox, { borderColor: selectedExercise.color + '40' }]}>
                <Text style={styles.sentenceLabel}>Practice sentence:</Text>
                <Text style={styles.sentenceText}>"{selectedExercise.practice_sentence}"</Text>
              </View>
            )}
          </View>
        </View>

        {/* Session attempt history */}
        {currentHistory.length > 0 && (
          <View style={styles.historyCard}>
            <Text style={styles.historyTitle}>📊 Your Attempts This Session</Text>
            <View style={styles.historyBars}>
              {currentHistory.map((score, i) => (
                <View key={i} style={styles.historyBarItem}>
                  <View style={styles.historyBarBg}>
                    <View
                      style={[
                        styles.historyBarFill,
                        { height: `${score}%` as any, backgroundColor: getScoreColor(score) },
                      ]}
                    />
                  </View>
                  <Text style={[styles.historyBarLabel, { color: getScoreColor(score) }]}>{score}%</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Recording section */}
        <View style={styles.recordSection}>
          <Text style={styles.recordInstruction}>
            Say:{' '}
            <Text style={styles.targetWord}>"{targetText}"</Text>
          </Text>

          <View style={styles.recordBtnWrapper}>
            <Animated.View
              style={[
                styles.pulseBg,
                { transform: [{ scale: pulseAnim }], opacity: pulseOpacity },
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
              <Text style={styles.recordingText}>Recording... speak clearly!</Text>
            </View>
          )}
        </View>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        {/* Feedback */}
        {feedback && (
          <Animated.View
            style={[styles.feedbackSection, { opacity: feedbackOpacity, transform: [{ scale: feedbackScale }] }]}
          >
            {/* Score ring */}
            <View style={styles.scoreCardOuter}>
              <ScoreRing score={feedback.accuracy_score} />
              <View style={styles.scoreCardMeta}>
                <Text style={styles.transcribedLabel}>
                  You said:{' '}
                  <Text style={styles.transcribedText}>"{feedback.transcribed_text}"</Text>
                </Text>
                <Text style={styles.targetLabel}>
                  Target:{' '}
                  <Text style={styles.targetTextDisplay}>"{targetText}"</Text>
                </Text>
              </View>
            </View>

            {/* Overall feedback */}
            <View style={styles.overallCard}>
              <Text style={styles.overallTitle}>📋 Overall Feedback</Text>
              <Text style={styles.overallText}>{feedback.overall_feedback}</Text>
            </View>

            {/* Problematic phonemes */}
            {feedback.problematic_phonemes?.length > 0 && (
              <View style={styles.issuesCard}>
                <Text style={styles.issuesTitle}>⚠️ Phonemes to Work On</Text>
                {feedback.problematic_phonemes.map((p, i) => (
                  <View key={i} style={[styles.phonemeIssueRow, { borderColor: getSeverityColor(p.severity) + '30' }]}>
                    <View style={[styles.phonemeIssueBadge, { backgroundColor: getSeverityColor(p.severity) + '20' }]}>
                      <Text style={[styles.phonemeIssueLabel, { color: getSeverityColor(p.severity) }]}>{p.phoneme}</Text>
                    </View>
                    <Text style={styles.phonemeExample}>{p.example}</Text>
                    <View style={[styles.severityBadge, { backgroundColor: getSeverityColor(p.severity) + '20' }]}>
                      <Text style={[styles.severityText, { color: getSeverityColor(p.severity) }]}>{p.severity}</Text>
                    </View>
                  </View>
                ))}
              </View>
            )}

            {/* Suggestions */}
            {feedback.suggestions?.length > 0 && (
              <View style={styles.suggestionsCard}>
                <Text style={styles.suggestionsTitle}>💡 How to Improve</Text>
                {feedback.suggestions.map((s, i) => (
                  <View key={i} style={styles.suggestionItem}>
                    <Text style={styles.suggestionIssue}>{s.issue}</Text>
                    <Text style={styles.suggestionFix}>→ {s.fix}</Text>
                  </View>
                ))}
              </View>
            )}

            <View style={styles.actionRow}>
              <TouchableOpacity
                style={styles.tryAgainBtn}
                onPress={() => { setFeedback(null); setError(''); }}
              >
                <Text style={styles.tryAgainText}>🔁 Try Again</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.nextWordBtn}
                onPress={() => {
                  const idx = selectedExercise.words.indexOf(selectedWord);
                  const next = selectedExercise.words[(idx + 1) % selectedExercise.words.length];
                  setSelectedWord(next);
                  setFeedback(null);
                }}
              >
                <Text style={styles.nextWordText}>Next Word →</Text>
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
  pageSubtitle: { color: Colors.light.textSecondary, fontSize: 14, lineHeight: 20, marginBottom: 20 },

  heatmapToggleBtn: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.light.surface,
    borderRadius: 14, borderWidth: 2, borderColor: Colors.light.tint,
    paddingHorizontal: 16, paddingVertical: 14,
    marginBottom: 16, gap: 12,
  },
  heatmapToggleIcon: { fontSize: 22 },
  heatmapToggleContent: { flex: 1 },
  heatmapToggleText: { color: Colors.light.text, fontSize: 14, fontWeight: '700' },
  heatmapToggleDesc: { color: Colors.light.textSecondary, fontSize: 12, marginTop: 2 },
  heatmapChevron: { color: Colors.light.tint, fontSize: 12, fontWeight: '700' },

  heatmapGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 8,
    marginBottom: 20,
    backgroundColor: Colors.light.surface,
    borderRadius: 16, padding: 14,
    borderWidth: 1, borderColor: Colors.light.border,
  },
  heatmapCell: {
    width: '30%', borderRadius: 10, borderWidth: 1,
    paddingVertical: 10, paddingHorizontal: 8, alignItems: 'center', gap: 2,
  },
  heatmapCellPhoneme: { fontSize: 13, fontWeight: '800' },
  heatmapCellCefr: { fontSize: 9, color: Colors.light.textSecondary, fontWeight: '600' },
  heatmapCellScore: { fontSize: 10, fontWeight: '700' },

  filterRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  filterChip: {
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 10,
    borderWidth: 1, borderColor: Colors.light.border, backgroundColor: Colors.light.surface,
  },
  filterChipActive: { backgroundColor: Colors.light.tint, borderColor: Colors.light.tint },
  filterChipText: { fontSize: 12, fontWeight: '700', color: Colors.light.textSecondary },
  filterChipTextActive: { color: '#fff' },

  sectionLabel: { color: Colors.light.textSecondary, fontSize: 11, fontWeight: '700', letterSpacing: 1, marginBottom: 10 },
  phonemeScroll: { marginBottom: 20 },
  phonemeChip: {
    backgroundColor: Colors.light.surface,
    borderRadius: 14, borderWidth: 1, borderColor: Colors.light.border,
    paddingHorizontal: 14, paddingVertical: 10, marginRight: 10, minWidth: 110,
  },
  phonemeChipText: { color: Colors.light.textSecondary, fontSize: 16, fontWeight: '700' },
  phonemeChipDesc: { color: Colors.light.textLight, fontSize: 10, marginTop: 2 },
  phonemeChipMeta: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  phonemeChipCefr: { fontSize: 10, fontWeight: '700' },
  phonemeChipScore: { fontSize: 10, fontWeight: '700' },

  exerciseCard: {
    backgroundColor: Colors.light.surface,
    borderRadius: 18, borderWidth: 1,
    overflow: 'hidden', marginBottom: 20,
  },
  cardAccentLine: { height: 4 },
  exerciseContent: { padding: 18, gap: 12 },

  ipaRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  ipaBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10, borderWidth: 1 },
  ipaText: { fontSize: 16, fontWeight: '800', fontFamily: 'monospace' },
  cefrBadge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10 },
  cefrText: { fontSize: 11, fontWeight: '700' },

  tipText: { color: Colors.light.textSecondary, fontSize: 13, lineHeight: 19 },

  expandableHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 8, borderTopWidth: 1, borderTopColor: Colors.light.border,
  },
  expandableTitle: { color: Colors.light.text, fontSize: 13, fontWeight: '700' },
  expandableChevron: { color: Colors.light.textSecondary, fontSize: 11 },
  expandableBody: {
    backgroundColor: Colors.light.background,
    borderRadius: 10, padding: 12, borderWidth: 1, gap: 6,
  },
  articulationText: { color: Colors.light.textSecondary, fontSize: 13, lineHeight: 19 },
  artStep: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    paddingVertical: 8, borderLeftWidth: 3, paddingLeft: 10, marginBottom: 4,
  },
  artStepIcon: { fontSize: 18, width: 24, textAlign: 'center', marginTop: 1 },
  artStepText: { flex: 1, fontSize: 13, color: Colors.light.text, lineHeight: 20 },
  artTipRow: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    borderRadius: 8, padding: 10, marginTop: 8,
  },
  artTipLabel: { fontSize: 10, fontWeight: '800', color: '#64748B', letterSpacing: 0.6, marginTop: 2 },
  artTipText: { flex: 1, fontSize: 13, fontWeight: '700', lineHeight: 19 },

  minimalPairRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  minimalPairWord: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  minimalPairText: { fontSize: 14, fontWeight: '700' },
  minimalPairVs: { color: Colors.light.textSecondary, fontSize: 12, fontWeight: '600' },

  modeToggle: {
    flexDirection: 'row', gap: 8,
    backgroundColor: Colors.light.background,
    borderRadius: 12, padding: 3,
  },
  modeBtn: {
    flex: 1, paddingVertical: 9, alignItems: 'center', borderRadius: 10,
  },
  modeBtnActive: { backgroundColor: Colors.light.tint },
  modeBtnText: { fontSize: 12, fontWeight: '700', color: Colors.light.textSecondary },
  modeBtnTextActive: { color: '#fff' },

  wordLabel: { color: Colors.light.textSecondary, fontSize: 12, fontWeight: '600' },
  wordsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  wordChip: {
    backgroundColor: Colors.light.surface,
    borderRadius: 10, borderWidth: 1, borderColor: Colors.light.border,
    paddingHorizontal: 14, paddingVertical: 8,
  },
  wordChipText: { color: Colors.light.textSecondary, fontSize: 14, fontWeight: '600' },

  sentenceBox: {
    backgroundColor: Colors.light.background,
    borderRadius: 12, borderWidth: 1,
    padding: 14, gap: 6,
  },
  sentenceLabel: { color: Colors.light.textSecondary, fontSize: 11, fontWeight: '700', textTransform: 'uppercase' },
  sentenceText: { color: Colors.light.text, fontSize: 14, lineHeight: 21, fontWeight: '500' },

  historyCard: {
    backgroundColor: Colors.light.surface,
    borderRadius: 14, padding: 16, borderWidth: 1, borderColor: Colors.light.border,
    marginBottom: 16, gap: 10,
  },
  historyTitle: { color: Colors.light.text, fontSize: 14, fontWeight: '700' },
  historyBars: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, height: 60 },
  historyBarItem: { alignItems: 'center', gap: 4, flex: 1 },
  historyBarBg: {
    width: '100%', height: 50,
    backgroundColor: Colors.light.border,
    borderRadius: 4, overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  historyBarFill: { width: '100%', borderRadius: 4 },
  historyBarLabel: { fontSize: 10, fontWeight: '700' },

  recordSection: { alignItems: 'center', marginBottom: 20, gap: 14 },
  recordInstruction: { color: Colors.light.textSecondary, fontSize: 14, textAlign: 'center' },
  targetWord: { color: Colors.light.text, fontWeight: '700', fontSize: 15 },
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
    gap: 4,
    shadowColor: Colors.light.tint,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  recordBtnActive: { backgroundColor: Colors.light.error },
  recordIcon: { fontSize: 32, color: '#fff' },
  recordBtnText: { color: '#fff', fontSize: 11, fontWeight: '700', textAlign: 'center' },
  recordingIndicator: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  recordingDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.light.error },
  recordingText: { color: Colors.light.error, fontSize: 13, fontWeight: '600' },

  errorText: { color: Colors.light.error, fontSize: 13, marginBottom: 12, textAlign: 'center' },

  feedbackSection: { gap: 14 },

  scoreCardOuter: {
    backgroundColor: Colors.light.surface,
    borderRadius: 18, padding: 20, borderWidth: 1, borderColor: Colors.light.border,
    flexDirection: 'row', alignItems: 'center', gap: 20,
  },
  scoreCardMeta: { flex: 1, gap: 6 },
  transcribedLabel: { color: Colors.light.textSecondary, fontSize: 13 },
  transcribedText: { color: Colors.light.text, fontWeight: '600' },
  targetLabel: { color: Colors.light.textSecondary, fontSize: 13 },
  targetTextDisplay: { color: Colors.light.tint, fontWeight: '600' },

  overallCard: {
    backgroundColor: Colors.light.surface,
    borderRadius: 14, padding: 16,
    borderWidth: 1, borderColor: Colors.light.success + '30', gap: 6,
  },
  overallTitle: { color: Colors.light.text, fontSize: 14, fontWeight: '700' },
  overallText: { color: Colors.light.textSecondary, fontSize: 13, lineHeight: 20 },

  issuesCard: {
    backgroundColor: Colors.light.surface,
    borderRadius: 14, padding: 16, borderWidth: 1, borderColor: Colors.light.warning + '25', gap: 10,
  },
  issuesTitle: { color: Colors.light.text, fontSize: 14, fontWeight: '700' },
  phonemeIssueRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    padding: 10, borderRadius: 10, borderWidth: 1,
    backgroundColor: Colors.light.background,
  },
  phonemeIssueBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  phonemeIssueLabel: { fontSize: 14, fontWeight: '700' },
  phonemeExample: { flex: 1, color: Colors.light.textSecondary, fontSize: 12 },
  severityBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  severityText: { fontSize: 11, fontWeight: '700' },

  suggestionsCard: {
    backgroundColor: Colors.light.surface,
    borderRadius: 14, padding: 16, borderWidth: 1, borderColor: Colors.light.tint + '20', gap: 10,
  },
  suggestionsTitle: { color: Colors.light.text, fontSize: 14, fontWeight: '700' },
  suggestionItem: {
    backgroundColor: Colors.light.background,
    borderRadius: 10, padding: 10, gap: 4,
  },
  suggestionIssue: { color: Colors.light.textSecondary, fontSize: 13 },
  suggestionFix: { color: Colors.light.tint, fontSize: 13, fontWeight: '600' },

  actionRow: { flexDirection: 'row', gap: 12 },
  tryAgainBtn: {
    flex: 1, alignItems: 'center', paddingVertical: 14,
    borderRadius: 14, borderWidth: 2, borderColor: Colors.light.tint,
  },
  tryAgainText: { color: Colors.light.tint, fontSize: 14, fontWeight: '700' },
  nextWordBtn: {
    flex: 1, alignItems: 'center', paddingVertical: 14,
    borderRadius: 14, backgroundColor: Colors.light.tint,
  },
  nextWordText: { color: '#fff', fontSize: 14, fontWeight: '700' },

  // ── Romanian error pattern block ─────────────────────────────────────────
  romanianErrorBox: {
    backgroundColor: '#f59e0b12',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#f59e0b40',
    borderLeftWidth: 3,
    borderLeftColor: '#f59e0b',
    padding: 12,
    gap: 5,
    marginTop: 4,
  },
  romanianErrorHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  romanianErrorIcon: { fontSize: 13 },
  romanianErrorTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#b45309',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  romanianErrorSubstitute: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.light.text,
  },
  romanianErrorWhy: {
    fontSize: 12,
    color: Colors.light.textSecondary,
    lineHeight: 17,
  },
  romanianErrorSource: {
    fontSize: 10,
    color: Colors.light.textLight,
    fontStyle: 'italic',
    marginTop: 2,
  },
});
