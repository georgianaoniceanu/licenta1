/**
 * Practice Hub — four structured exercise modes
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *   • Adaptive   — SM-2 spaced repetition (Wozniak 1987) on Academic Word List
 *                  (Coxhead 2000). Word selection: overdue reviews first, then
 *                  new words by AWL sublist order. No AI — all content from
 *                  vocabulary_enriched.json. Grade derived from correctness +
 *                  response time (DeKeyser & Suzuki 2025).
 *
 *   • Retention  — Real SM-2 state from Firestore: due / learning / mastered /
 *                  new word counts + word chips. Mastery threshold: interval
 *                  ≥ 21 days (Cepeda et al. 2006).
 *
 *   • Reading    — CEFR-calibrated passage + 5 multiple-choice questions
 *                  (Cambridge ESOL reading-test framework). LLM-generated.
 *
 *   • Listening  — TTS reads a sentence; learner transcribes; system scores
 *                  word-level accuracy (SequenceMatcher diff). LLM sentence.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { useEffect, useMemo, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  ActivityIndicator, TextInput, Platform, Alert,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { PRACTICE_ENDPOINTS, VOCABULARY_ENDPOINTS } from '@/constants/api';
import { getFreshToken } from '@/utils/auth';

// ─── Types ──────────────────────────────────────────────────────────────────
type Mode = 'adaptive' | 'retention' | 'reading' | 'listening';

// SM-2 vocabulary exercise card returned by GET /vocabulary/exercise
type ExerciseCard = {
  vocab_id: string;
  word: string;
  pronunciation: string;
  definition: string;
  example_sentence: string;
  synonyms: string[];
  difficulty: string;
  category: string;
  sublist: number;
  exercise_format: 'word_to_def' | 'def_to_word';
  question: string;        // main text displayed prominently
  instruction: string;     // "Which definition is correct?" etc.
  options: string[];       // 4 choices (definitions or words depending on format)
  correct_index: number;
  correct_answer: string;  // sent to /submit as the `answer` field when correct
  is_new: boolean;
  sm2_interval: number;    // 0 = never reviewed
  sm2_next_review: string | null;
  attempts: number;
};

// Result from POST /vocabulary/submit
type SubmitResult = {
  is_correct: boolean;
  grade: number;           // SM-2 grade 2–5
  accuracy: number;
  mastery_level: string;
  sm2_interval: number;    // days until next review
  sm2_next_review: string;
  message: string;
};

// State from GET /vocabulary/srs-state
type SRSWord = { vocab_id: string; word: string; interval: number; next_review: string | null; attempts: number };
type SRSState = {
  due_count: number;
  learning_count: number;
  mastered_count: number;
  new_count: number;
  total_bank: number;
  due: SRSWord[];
  learning: SRSWord[];
  mastered: SRSWord[];
};

type ReadingPassage = {
  title: string;
  passage: string;
  word_count: number;
  questions: Array<{
    type: 'literal' | 'inferential' | 'vocabulary';
    question: string;
    options: Record<'A' | 'B' | 'C' | 'D', string>;
    correct: 'A' | 'B' | 'C' | 'D';
    explanation: string;
  }>;
};

// ─── Helpers ────────────────────────────────────────────────────────────────

async function loadJSON<T>(key: string, def: T): Promise<T> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? JSON.parse(raw) : def;
  } catch { return def; }
}


function pickCEFR(cafSessions: any[]): string {
  if (!cafSessions || !cafSessions.length) return 'B1';
  return cafSessions[cafSessions.length - 1]?.cefr || 'B1';
}

// ─── Component ──────────────────────────────────────────────────────────────
export default function PracticeScreen() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>('adaptive');

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} activeOpacity={0.7}>
          <Text style={styles.backText}>←  Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>🎯 Practice Hub</Text>
      </View>

      <View style={styles.tabBar}>
        {([
          { k: 'adaptive',  label: '⚡ Adaptive' },
          { k: 'retention', label: '🧠 Retention' },
          { k: 'reading',   label: '📖 Reading' },
          { k: 'listening', label: '🎧 Listening' },
        ] as { k: Mode; label: string }[]).map(t => (
          <TouchableOpacity
            key={t.k}
            style={[styles.tab, mode === t.k && styles.tabActive]}
            onPress={() => setMode(t.k)}
            activeOpacity={0.85}
          >
            <Text style={[styles.tabText, mode === t.k && styles.tabTextActive]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {mode === 'adaptive'  && <AdaptiveBlock />}
        {mode === 'retention' && <RetentionBlock />}
        {mode === 'reading'   && <ReadingBlock />}
        {mode === 'listening' && <ListeningBlock />}
      </ScrollView>
    </View>
  );
}

// ─── Adaptive (SM-2 vocabulary exercise runner) ──────────────────────────────
//
// Exercise selection: SM-2 algorithm (Wozniak 1987).
//   Priority 1 — overdue reviews (sm2_next_review ≤ today), earliest first
//   Priority 2 — new AWL words, sublist 1 → 10 (most common first)
//   Priority 3 — least-known practiced word (lowest interval)
//
// All content comes from vocabulary_enriched.json (411 AWL words).
// No AI generation — structure is static and deterministic.
//
// Exercise format: word → pick correct definition from 4 options.
// Grade mapping (DeKeyser & Suzuki 2025):
//   correct + RT < 2s → grade 5 (automatized)
//   correct + RT < 5s → grade 4
//   correct + RT ≥ 5s → grade 3
//   wrong             → grade 2 (resets interval to 1 day)

function AdaptiveBlock() {
  const [loading, setLoading]     = useState(false);
  const [card, setCard]           = useState<ExerciseCard | null>(null);
  const [selected, setSelected]   = useState<number | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [result, setResult]       = useState<SubmitResult | null>(null);
  const [startMs, setStartMs]     = useState(0);
  const [session, setSession]     = useState({ correct: 0, total: 0 });
  const [isDemo, setIsDemo]       = useState(false);

  useEffect(() => {
    AsyncStorage.getItem('active_demo_preset').then(v => {
      if (v) setIsDemo(true);
      else loadCard();
    });
  }, []);

  const loadCard = async () => {
    setLoading(true);
    setSelected(null);
    setSubmitted(false);
    setResult(null);
    try {
      const token = await getFreshToken();
      if (!token) { Alert.alert('Auth', 'Please sign in again.'); return; }
      const r = await fetch(VOCABULARY_ENDPOINTS.EXERCISE, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!r.ok) throw new Error(`Backend ${r.status}`);
      const j = await r.json();
      setCard(j.data ?? j);
      setStartMs(Date.now());
    } catch (e: any) {
      Alert.alert('Error', e?.message || String(e));
    } finally { setLoading(false); }
  };

  const pick = async (idx: number) => {
    if (!card || submitted) return;
    const rt = Date.now() - startMs;
    setSelected(idx);
    setSubmitted(true);
    const isCorrect = idx === card.correct_index;
    setSession(s => ({ correct: s.correct + (isCorrect ? 1 : 0), total: s.total + 1 }));

    try {
      const token = await getFreshToken();
      if (!token) return;
      const r = await fetch(VOCABULARY_ENDPOINTS.SUBMIT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          vocab_id:         card.vocab_id,
          exercise_type:    'multiple_choice',
          answer:           card.options[idx],
          correct_answer:   card.correct_answer,
          response_time_ms: rt,
        }),
      });
      if (r.ok) {
        const j = await r.json();
        setResult(j.data ?? j);
      }
    } catch {}
  };

  const diffLabel = (ivl: number) => {
    if (ivl <= 0)  return 'New word';
    if (ivl === 1) return 'Review: tomorrow';
    return `Review: in ${ivl} days`;
  };

  if (isDemo) {
    return (
      <View style={styles.demoNotice}>
        <Text style={styles.demoNoticeTitle}>⚡ Adaptive Practice</Text>
        <Text style={styles.demoNoticeText}>
          SM-2 spaced repetition exercises (Wozniak 1987) run against the live backend vocabulary engine.
          Sign in with a real account to practice Academic Word List (AWL) cards selected by your personal SM-2 schedule.
        </Text>
        <Text style={[styles.demoNoticeText, { marginTop: 8 }]}>
          Your demo profile shows {'→'} use the Retention tab to see your SM-2 state snapshot.
        </Text>
      </View>
    );
  }

  return (
    <View>
      <View style={styles.srsInfo}>
        <Text style={styles.srsInfoText}>
          SM-2 spaced repetition (Wozniak 1987). Overdue cards appear first,
          then new AWL words by sublist. No AI — all content from
          Academic Word List (Coxhead 2000).
        </Text>
        {session.total > 0 && (
          <Text style={styles.sessionCounter}>
            Session: {session.correct}/{session.total} correct
          </Text>
        )}
      </View>

      {loading && <ActivityIndicator color="#0FBA9A" style={{ marginVertical: 24 }} />}

      {card && !loading && (
        <View style={styles.exerciseCard}>
          {/* ── Question header ──────────────────────────────────────────── */}
          <View style={styles.wordHeader}>
            <View style={{ flex: 1 }}>
              <Text style={card.exercise_format === 'word_to_def' ? styles.wordText : styles.defText}>
                {card.question}
              </Text>
              {card.exercise_format === 'word_to_def' && !!card.pronunciation && (
                <Text style={styles.wordPron}>{card.pronunciation}</Text>
              )}
            </View>
            <View style={styles.badgeRow}>
              <View style={styles.badge}>
                <Text style={styles.badgeText}>AWL {card.sublist}</Text>
              </View>
              <View style={[styles.badge, { backgroundColor: '#F1F5F9' }]}>
                <Text style={[styles.badgeText, { color: '#475569' }]}>{card.difficulty}</Text>
              </View>
            </View>
          </View>

          <Text style={styles.exerciseInstruction}>{card.instruction}</Text>

          {/* ── Options ──────────────────────────────────────────────────── */}
          {card.options.map((opt, i) => {
            const isSelected = selected === i;
            const isCorrect  = submitted && i === card.correct_index;
            const isWrong    = submitted && isSelected && i !== card.correct_index;
            return (
              <TouchableOpacity
                key={i}
                style={[
                  styles.option,
                  isSelected && styles.optionSelected,
                  isCorrect  && styles.optionCorrect,
                  isWrong    && styles.optionWrong,
                ]}
                onPress={() => pick(i)}
                disabled={submitted}
                activeOpacity={0.8}
              >
                <Text style={styles.optionLetter}>{String.fromCharCode(65 + i)}.</Text>
                <Text style={styles.optionText}>{opt}</Text>
              </TouchableOpacity>
            );
          })}

          {/* ── Post-submit feedback ─────────────────────────────────────── */}
          {submitted && (
            <View style={styles.feedbackBox}>
              {result ? (
                <>
                  <Text style={[styles.feedbackMain,
                    { color: result.is_correct ? '#10B981' : '#EF4444' }]}>
                    {result.is_correct ? 'Correct' : 'Incorrect'}
                    {result.is_correct && result.grade === 5 ? ' — automatized recall' : ''}
                  </Text>
                  <Text style={styles.feedbackSub}>{diffLabel(result.sm2_interval)}</Text>
                </>
              ) : (
                <Text style={styles.feedbackMain}>
                  {selected === card.correct_index ? 'Correct' : 'Incorrect'}
                </Text>
              )}
              {card.example_sentence ? (
                <Text style={styles.exampleSentence}>"{card.example_sentence}"</Text>
              ) : null}
              {card.synonyms?.length > 0 && (
                <Text style={styles.synonyms}>Synonyms: {card.synonyms.join(', ')}</Text>
              )}
            </View>
          )}
        </View>
      )}

      {submitted && (
        <TouchableOpacity style={styles.primaryBtn} onPress={loadCard} activeOpacity={0.85}>
          <Text style={styles.primaryBtnText}>Next word →</Text>
        </TouchableOpacity>
      )}

      {!card && !loading && (
        <TouchableOpacity style={styles.primaryBtn} onPress={loadCard} activeOpacity={0.85}>
          <Text style={styles.primaryBtnText}>Start practice</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// ─── Retention (SM-2 state viewer) ──────────────────────────────────────────
//
// Shows the user's real SM-2 schedule from Firestore — no synthetic proxies.
//
// Category definitions (Wozniak 1987 / Cepeda et al. 2006):
//   due      — next_review ≤ today; card is overdue or ready
//   learning — reviewed ≥ 1 time; interval < 21 days
//   mastered — interval ≥ 21 days (long-term memory threshold)
//   new      — never attempted; AWL sublist order

function RetentionBlock() {
  const [loading, setLoading] = useState(true);
  const [state, setState] = useState<SRSState | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const demoPreset = await AsyncStorage.getItem('active_demo_preset');
      if (demoPreset) {
        const raw = await AsyncStorage.getItem('demo_srs_state');
        if (raw) {
          const demo = JSON.parse(raw);
          setState({ ...demo, due: [], learning: [], mastered: [] });
        }
        setLoading(false);
        return;
      }
      const token = await getFreshToken();
      if (!token) throw new Error('not authenticated');
      const r = await fetch(VOCABULARY_ENDPOINTS.SRS_STATE, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!r.ok) throw new Error(`Backend ${r.status}`);
      const j = await r.json();
      setState(j.data ?? j);
    } catch (e: any) {
      Alert.alert('Error', e?.message || String(e));
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const practiced = state
    ? state.due_count + state.learning_count + state.mastered_count
    : 0;
  const total = state?.total_bank ?? 0;
  const pct   = total > 0 ? Math.round(practiced / total * 100) : 0;

  return (
    <View>
      <Text style={styles.modeIntro}>
        Your SM-2 review schedule across all{' '}
        <Text style={styles.bold}>{total} AWL words</Text> (Coxhead 2000).
        Mastery threshold: interval ≥ 21 days (Cepeda et al. 2006).
      </Text>

      <TouchableOpacity style={styles.primaryBtn} onPress={load} disabled={loading}>
        {loading
          ? <ActivityIndicator color="#fff" />
          : <Text style={styles.primaryBtnText}>Refresh</Text>}
      </TouchableOpacity>

      {state && (
        <>
          {/* ── Stats row ───────────────────────────────────────────────── */}
          <View style={styles.retentionSummary}>
            <View style={styles.retentionStat}>
              <Text style={[styles.retentionNum, { color: '#EF4444' }]}>{state.due_count}</Text>
              <Text style={styles.retentionLbl}>Due now</Text>
            </View>
            <View style={styles.retentionStat}>
              <Text style={[styles.retentionNum, { color: '#F59E0B' }]}>{state.learning_count}</Text>
              <Text style={styles.retentionLbl}>Learning</Text>
            </View>
            <View style={styles.retentionStat}>
              <Text style={[styles.retentionNum, { color: '#10B981' }]}>{state.mastered_count}</Text>
              <Text style={styles.retentionLbl}>Mastered</Text>
            </View>
            <View style={styles.retentionStat}>
              <Text style={[styles.retentionNum, { color: '#94A3B8' }]}>{state.new_count}</Text>
              <Text style={styles.retentionLbl}>New</Text>
            </View>
          </View>

          {/* ── Progress bar ────────────────────────────────────────────── */}
          <View style={styles.retentionRateRow}>
            <Text style={styles.retentionRateLbl}>Practiced {practiced}/{total} words</Text>
            <Text style={styles.retentionRateNum}>{pct}%</Text>
          </View>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${pct}%` as any }]} />
          </View>

          <SRSSection title="Due now" color="#EF4444" items={state.due}
            meta={w => w.next_review ? `due ${w.next_review}` : 'overdue'}
            emptyMsg="No cards due — great job staying current." />
          <SRSSection title="Learning" color="#F59E0B" items={state.learning}
            meta={w => `${w.interval}d interval`}
            emptyMsg="Practice some words in the Adaptive tab to start learning." />
          <SRSSection title="Mastered (≥21d)" color="#10B981" items={state.mastered}
            meta={w => `${w.interval}d interval`}
            emptyMsg="Words with interval ≥ 21 days will appear here." />
        </>
      )}
    </View>
  );
}

function SRSSection({
  title, color, items, meta, emptyMsg,
}: {
  title: string; color: string;
  items: SRSWord[]; meta: (w: SRSWord) => string; emptyMsg: string;
}) {
  return (
    <View style={styles.retentionSection}>
      <Text style={[styles.retentionSectionTitle, { color }]}>
        {title}  ({items.length})
      </Text>
      {items.length === 0 ? (
        <Text style={styles.retentionEmpty}>{emptyMsg}</Text>
      ) : (
        <View style={styles.chipsWrap}>
          {items.map((w, i) => (
            <View key={i} style={styles.wordChip}>
              <Text style={styles.wordChipText}>{w.word}</Text>
              <Text style={styles.wordChipMeta}>{meta(w)}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

// ─── Reading ────────────────────────────────────────────────────────────────
function ReadingBlock() {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<ReadingPassage | null>(null);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const [isDemo, setIsDemo] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem('active_demo_preset').then(v => { if (v) setIsDemo(true); });
  }, []);

  if (isDemo) {
    return (
      <View style={styles.demoNotice}>
        <Text style={styles.demoNoticeTitle}>📖 Reading Comprehension</Text>
        <Text style={styles.demoNoticeText}>
          CEFR-calibrated passages with comprehension questions are generated by the AI backend (Cambridge ESOL framework).
          Sign in with a real account to access this feature.
        </Text>
      </View>
    );
  }

  const generate = async () => {
    setLoading(true); setData(null); setAnswers({}); setSubmitted(false);
    try {
      const token = await getFreshToken();
      if (!token) throw new Error('not authenticated');
      const caf = await loadJSON<any[]>('vf_caf_sessions', []);
      const r = await fetch(PRACTICE_ENDPOINTS.READING, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ cefr_level: pickCEFR(caf) }),
      });
      if (!r.ok) throw new Error(`Backend ${r.status}`);
      const j = await r.json();
      setData(j.data);
    } catch (e: any) {
      Alert.alert('Reading error', e?.message || String(e));
    } finally { setLoading(false); }
  };

  const correctCount = useMemo(() => {
    if (!data) return 0;
    let n = 0;
    data.questions.forEach((q, i) => { if (answers[i] === q.correct) n++; });
    return n;
  }, [data, answers]);

  return (
    <View>
      <Text style={styles.modeIntro}>
        CEFR-calibrated passage with 5 mixed comprehension questions
        (literal + inferential + vocabulary).
      </Text>

      <TouchableOpacity style={styles.primaryBtn} onPress={generate} disabled={loading}>
        {loading
          ? <ActivityIndicator color="#fff" />
          : <Text style={styles.primaryBtnText}>{data ? '🔄  New passage' : '📖  Generate passage'}</Text>}
      </TouchableOpacity>

      {data && (
        <>
          <View style={styles.passageCard}>
            <Text style={styles.passageTitle}>{data.title}</Text>
            <Text style={styles.passageMeta}>{data.word_count} words</Text>
            <Text style={styles.passageText}>{data.passage}</Text>
          </View>

          {data.questions.map((q, i) => (
            <View key={i} style={styles.questionCard}>
              <Text style={styles.questionType}>{q.type.toUpperCase()}</Text>
              <Text style={styles.questionText}>Q{i + 1}. {q.question}</Text>
              {(['A', 'B', 'C', 'D'] as const).map(opt => {
                const isSelected = answers[i] === opt;
                const isCorrect  = submitted && opt === q.correct;
                const isWrong    = submitted && isSelected && opt !== q.correct;
                return (
                  <TouchableOpacity
                    key={opt}
                    style={[
                      styles.option,
                      isSelected && styles.optionSelected,
                      isCorrect && styles.optionCorrect,
                      isWrong && styles.optionWrong,
                    ]}
                    onPress={() => !submitted && setAnswers({ ...answers, [i]: opt })}
                    disabled={submitted}
                  >
                    <Text style={styles.optionLetter}>{opt}.</Text>
                    <Text style={styles.optionText}>{q.options[opt]}</Text>
                  </TouchableOpacity>
                );
              })}
              {submitted && (
                <Text style={styles.questionExplanation}>{q.explanation}</Text>
              )}
            </View>
          ))}

          {!submitted ? (
            <TouchableOpacity
              style={[styles.primaryBtn, Object.keys(answers).length !== data.questions.length && { opacity: 0.5 }]}
              disabled={Object.keys(answers).length !== data.questions.length}
              onPress={() => setSubmitted(true)}
            >
              <Text style={styles.primaryBtnText}>✓  Submit answers</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.scoreCard}>
              <Text style={styles.scoreLabel}>Score</Text>
              <Text style={[styles.scoreNum, {
                color: correctCount >= 4 ? '#10B981' : correctCount >= 2 ? '#F59E0B' : '#EF4444',
              }]}>{correctCount} / {data.questions.length}</Text>
              <Text style={styles.scoreSub}>
                {correctCount >= 4 ? 'Excellent comprehension'
                  : correctCount >= 2 ? 'Solid understanding — review explanations'
                  : 'Try the passage again, focusing on details'}
              </Text>
            </View>
          )}
        </>
      )}
    </View>
  );
}

// ─── Listening ──────────────────────────────────────────────────────────────
function ListeningBlock() {
  const [loading, setLoading] = useState(false);
  const [isDemo, setIsDemo] = useState(false);
  const [sentence, setSentence] = useState<string | null>(null);
  const [audioB64, setAudioB64] = useState<string | null>(null);
  const [typed, setTyped] = useState('');
  const [score, setScore] = useState<any>(null);
  const [scoring, setScoring] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem('active_demo_preset').then(v => { if (v) setIsDemo(true); });
  }, []);

  if (isDemo) {
    return (
      <View style={styles.demoNotice}>
        <Text style={styles.demoNoticeTitle}>🎧 Listening Transcription</Text>
        <Text style={styles.demoNoticeText}>
          TTS-generated sentences scored by word-level diff (SequenceMatcher) require the AI backend.
          Sign in with a real account to access this feature.
        </Text>
      </View>
    );
  }

  const generate = async () => {
    setLoading(true); setSentence(null); setAudioB64(null); setTyped(''); setScore(null);
    try {
      const token = await getFreshToken();
      if (!token) throw new Error('not authenticated');
      const caf = await loadJSON<any[]>('vf_caf_sessions', []);
      const r = await fetch(PRACTICE_ENDPOINTS.LISTENING_GENERATE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ cefr_level: pickCEFR(caf) }),
      });
      if (!r.ok) throw new Error(`Backend ${r.status}`);
      const j = await r.json();
      setSentence(j.data.sentence);
      setAudioB64(j.data.audio_base64 || null);
    } catch (e: any) {
      Alert.alert('Listening error', e?.message || String(e));
    } finally { setLoading(false); }
  };

  const playAudio = () => {
    if (!audioB64) return;
    if (Platform.OS === 'web') {
      try {
        const binary = atob(audioB64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        const blob = new Blob([bytes], { type: 'audio/mpeg' });
        const url = URL.createObjectURL(blob);
        const a = new window.Audio(url);
        a.onended = () => { try { URL.revokeObjectURL(url); } catch {} };
        a.play().catch(() => {});
      } catch {}
    }
  };

  const checkAnswer = async () => {
    if (!sentence || !typed.trim()) return;
    setScoring(true);
    try {
      const token = await getFreshToken();
      const r = await fetch(PRACTICE_ENDPOINTS.LISTENING_SCORE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ target: sentence, transcription: typed }),
      });
      if (!r.ok) throw new Error(`Backend ${r.status}`);
      const j = await r.json();
      setScore(j.data);
    } catch (e: any) {
      Alert.alert('Score error', e?.message || String(e));
    } finally { setScoring(false); }
  };

  return (
    <View>
      <Text style={styles.modeIntro}>
        Listen to a sentence (TTS), then transcribe it. The system shows you the
        word-level diff between what you typed and what was said.
      </Text>

      <TouchableOpacity style={styles.primaryBtn} onPress={generate} disabled={loading}>
        {loading
          ? <ActivityIndicator color="#fff" />
          : <Text style={styles.primaryBtnText}>{sentence ? '🔄  New sentence' : '🎧  Generate sentence'}</Text>}
      </TouchableOpacity>

      {audioB64 && (
        <TouchableOpacity style={styles.secondaryBtn} onPress={playAudio}>
          <Text style={styles.secondaryBtnText}>▶  Play sentence</Text>
        </TouchableOpacity>
      )}
      {sentence && !audioB64 && (
        <Text style={styles.noAudioHint}>(No TTS available — read the sentence below as a fallback)</Text>
      )}

      {sentence && (
        <>
          <Text style={styles.field}>Type what you hear:</Text>
          <TextInput
            style={styles.input}
            value={typed}
            onChangeText={setTyped}
            placeholder="Type the sentence here..."
            placeholderTextColor="#94A3B8"
            multiline
          />
          <TouchableOpacity
            style={[styles.primaryBtn, (!typed.trim() || scoring) && { opacity: 0.5 }]}
            onPress={checkAnswer}
            disabled={!typed.trim() || scoring}
          >
            {scoring ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryBtnText}>✓  Check</Text>}
          </TouchableOpacity>
        </>
      )}

      {score && (
        <View style={styles.scoreCard}>
          <Text style={styles.scoreLabel}>Word accuracy</Text>
          <Text style={[styles.scoreNum, {
            color: score.score >= 80 ? '#10B981' : score.score >= 50 ? '#F59E0B' : '#EF4444',
          }]}>{score.score}%</Text>
          <Text style={styles.scoreSub}>
            {score.matched_count} / {score.target_word_count} words matched · char similarity {score.char_similarity}%
          </Text>
          {score.missed?.length > 0 && (
            <Text style={[styles.scoreDetail, { color: '#EF4444' }]}>
              Missed: {score.missed.join(', ')}
            </Text>
          )}
          {score.extra?.length > 0 && (
            <Text style={[styles.scoreDetail, { color: '#F59E0B' }]}>
              Extra (not in original): {score.extra.join(', ')}
            </Text>
          )}
          <Text style={styles.targetLabel}>Original sentence:</Text>
          <Text style={styles.targetText}>{sentence}</Text>
        </View>
      )}
    </View>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F8FAFC' },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    paddingHorizontal: 20, paddingTop: 18, paddingBottom: 8,
  },
  backBtn: {
    paddingHorizontal: 14, paddingVertical: 9, borderRadius: 11,
    borderWidth: 1.5, borderColor: '#0FBA9A', backgroundColor: '#FFFFFF',
  },
  backText: { color: '#0FBA9A', fontSize: 14, fontWeight: '700', letterSpacing: 0.2 },
  title: { fontSize: 24, fontWeight: '800', color: '#0F172A', letterSpacing: -0.4 },

  tabBar: {
    flexDirection: 'row', gap: 6,
    paddingHorizontal: 20, paddingVertical: 10,
    backgroundColor: '#F8FAFC',
  },
  tab: {
    flex: 1, paddingVertical: 10, borderRadius: 12,
    backgroundColor: '#E2E8F0', borderWidth: 1.5, borderColor: '#94A3B8',
    alignItems: 'center',
  },
  tabActive: {
    backgroundColor: '#0FBA9A', borderColor: '#0FBA9A',
    shadowColor: '#0FBA9A', shadowOpacity: 0.3, shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 }, elevation: 3,
  },
  tabText: { fontSize: 12, fontWeight: '700', color: '#1E293B' },
  tabTextActive: { color: '#fff', fontWeight: '800' },

  scroll: { paddingHorizontal: 20, paddingVertical: 14, paddingBottom: 60 },

  modeIntro: { fontSize: 13, color: '#475569', lineHeight: 19, marginBottom: 14 },
  bold: { fontWeight: '800', color: '#0F172A' },

  primaryBtn: {
    backgroundColor: '#0FBA9A',
    paddingVertical: 13, borderRadius: 12, alignItems: 'center',
    marginBottom: 12,
    shadowColor: '#0FBA9A', shadowOpacity: 0.3, shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 }, elevation: 4,
  },
  primaryBtnText: { color: '#fff', fontSize: 14, fontWeight: '800', letterSpacing: 0.3 },

  secondaryBtn: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 11, borderRadius: 12, alignItems: 'center',
    borderWidth: 1.5, borderColor: '#0FBA9A',
    marginBottom: 12,
  },
  secondaryBtnText: { color: '#0FBA9A', fontSize: 13, fontWeight: '800' },

  // Adaptive — SM-2 exercise runner
  srsInfo: {
    backgroundColor: '#ECFDF5', borderRadius: 12, padding: 12,
    borderWidth: 1, borderColor: '#A7F3D0', marginBottom: 14,
  },
  srsInfoText: { fontSize: 12, color: '#065F46', lineHeight: 18 },
  sessionCounter: {
    fontSize: 13, fontWeight: '800', color: '#0FBA9A', marginTop: 6,
  },

  exerciseCard: {
    backgroundColor: '#FFFFFF', borderRadius: 14, padding: 16, marginBottom: 12,
    borderWidth: 1, borderColor: '#E5E7EB',
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 }, elevation: 2,
  },
  wordHeader: {
    flexDirection: 'row', alignItems: 'flex-start',
    justifyContent: 'space-between', marginBottom: 14,
  },
  wordText: { fontSize: 26, fontWeight: '900', color: '#0F172A', letterSpacing: -0.5 },
  defText:  { fontSize: 15, fontWeight: '600', color: '#0F172A', lineHeight: 22 },
  wordPron: { fontSize: 13, color: '#64748B', marginTop: 2, fontStyle: 'italic' },
  badgeRow: { flexDirection: 'row', gap: 6, flexShrink: 0 },
  badge: {
    backgroundColor: '#0FBA9A', borderRadius: 8,
    paddingHorizontal: 8, paddingVertical: 4,
  },
  badgeText: { fontSize: 10, fontWeight: '800', color: '#fff', letterSpacing: 0.4 },
  exerciseInstruction: { fontSize: 13, color: '#64748B', marginBottom: 10, lineHeight: 18 },

  feedbackBox: {
    marginTop: 14, padding: 12, backgroundColor: '#F8FAFC',
    borderRadius: 10, borderWidth: 1, borderColor: '#E2E8F0',
  },
  feedbackMain: { fontSize: 15, fontWeight: '800', marginBottom: 2 },
  feedbackSub: { fontSize: 12, color: '#64748B', marginBottom: 6 },
  exampleSentence: { fontSize: 13, color: '#0F172A', fontStyle: 'italic', lineHeight: 19, marginTop: 4 },
  synonyms: { fontSize: 11, color: '#94A3B8', marginTop: 6 },

  // Retention
  retentionSummary: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  retentionStat: {
    flex: 1, alignItems: 'center', padding: 12,
    backgroundColor: '#FFFFFF', borderRadius: 12, borderWidth: 1, borderColor: '#E5E7EB',
  },
  retentionNum: { fontSize: 26, fontWeight: '800' },
  retentionLbl: { fontSize: 10, color: '#64748B', textAlign: 'center', marginTop: 2, fontWeight: '600' },
  retentionRateRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: '#FFFFFF', borderRadius: 12, padding: 14,
    borderWidth: 1, borderColor: '#E5E7EB', marginBottom: 14,
  },
  retentionRateLbl: { fontSize: 13, fontWeight: '700', color: '#0F172A' },
  retentionRateNum: { fontSize: 18, fontWeight: '800', color: '#0FBA9A' },

  progressTrack: {
    height: 6, backgroundColor: '#E2E8F0', borderRadius: 3, marginBottom: 16,
  },
  progressFill: {
    height: 6, backgroundColor: '#0FBA9A', borderRadius: 3,
  },

  retentionSection: { marginBottom: 14 },
  retentionSectionTitle: { fontSize: 13, fontWeight: '800', marginBottom: 6 },
  retentionEmpty: { fontSize: 11, color: '#94A3B8', fontStyle: 'italic' },
  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  wordChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#FFFFFF', borderRadius: 999,
    paddingHorizontal: 10, paddingVertical: 6,
    borderWidth: 1, borderColor: '#E5E7EB',
  },
  wordChipText: { fontSize: 12, fontWeight: '700', color: '#0F172A' },
  wordChipMeta: { fontSize: 10, color: '#94A3B8', fontWeight: '700' },

  // Reading
  passageCard: {
    backgroundColor: '#FFFFFF', borderRadius: 14, padding: 16, marginBottom: 14,
    borderWidth: 1, borderColor: '#E5E7EB',
  },
  passageTitle: { fontSize: 16, fontWeight: '800', color: '#0F172A', marginBottom: 4 },
  passageMeta: { fontSize: 11, color: '#94A3B8', marginBottom: 10, fontStyle: 'italic' },
  passageText: { fontSize: 14, color: '#0F172A', lineHeight: 22 },

  questionCard: {
    backgroundColor: '#FFFFFF', borderRadius: 12, padding: 14, marginBottom: 10,
    borderWidth: 1, borderColor: '#E5E7EB',
  },
  questionType: { fontSize: 10, fontWeight: '800', color: '#0FBA9A', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 4 },
  questionText: { fontSize: 13, fontWeight: '700', color: '#0F172A', marginBottom: 10 },
  option: {
    flexDirection: 'row', gap: 8,
    paddingHorizontal: 12, paddingVertical: 10,
    borderRadius: 10, marginVertical: 3,
    borderWidth: 1.5, borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
  },
  optionSelected: { borderColor: '#0FBA9A', backgroundColor: '#ECFDF5' },
  optionCorrect:  { borderColor: '#10B981', backgroundColor: '#D1FAE5' },
  optionWrong:    { borderColor: '#EF4444', backgroundColor: '#FEE2E2' },
  optionLetter: { fontSize: 13, fontWeight: '800', color: '#0F172A', width: 18 },
  optionText: { flex: 1, fontSize: 13, color: '#0F172A', lineHeight: 18 },
  questionExplanation: {
    fontSize: 12, color: '#64748B', marginTop: 8,
    fontStyle: 'italic', paddingTop: 8,
    borderTopWidth: 1, borderTopColor: '#F1F5F9',
  },

  scoreCard: {
    backgroundColor: '#FFFFFF', borderRadius: 12, padding: 16, marginVertical: 14,
    borderWidth: 1.5, borderColor: '#0FBA9A', alignItems: 'center',
  },
  scoreLabel: { fontSize: 11, fontWeight: '800', color: '#64748B', letterSpacing: 0.6, textTransform: 'uppercase' },
  scoreNum: { fontSize: 36, fontWeight: '900', marginVertical: 6 },
  scoreSub: { fontSize: 12, color: '#475569', textAlign: 'center' },
  scoreDetail: { fontSize: 11, marginTop: 8, fontWeight: '700' },
  targetLabel: { fontSize: 10, fontWeight: '800', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 0.6, marginTop: 10 },
  targetText: { fontSize: 13, color: '#0F172A', fontWeight: '600', marginTop: 4, textAlign: 'center' },

  // Demo notice
  demoNotice: {
    backgroundColor: '#EFF6FF', borderRadius: 14, padding: 18,
    borderWidth: 1, borderColor: '#BFDBFE', marginBottom: 12,
  },
  demoNoticeTitle: { fontSize: 15, fontWeight: '800', color: '#1E40AF', marginBottom: 8 },
  demoNoticeText: { fontSize: 13, color: '#1D4ED8', lineHeight: 19 },

  // Listening
  noAudioHint: { fontSize: 11, color: '#94A3B8', fontStyle: 'italic', textAlign: 'center', marginBottom: 8 },
  field: { fontSize: 12, fontWeight: '700', color: '#475569', marginTop: 8, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.4 },
  input: {
    backgroundColor: '#FFFFFF', borderRadius: 10, padding: 12,
    borderWidth: 1.5, borderColor: '#CBD5E1',
    fontSize: 14, color: '#0F172A', marginBottom: 10,
    minHeight: 80, textAlignVertical: 'top',
  },
});
