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
 *                  (Cambridge ESOL reading-test framework). LLM or local bank.
 *
 *   • Grammar    — Romanian L1-interference drills (Neumanová 2021): articles,
 *                  prepositions, tense, word order, double negation,
 *                  collocations, false friends, agreement. Static local bank,
 *                  targets the Grammar Accuracy indicator.
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
import {
  LOCAL_VOCAB_CARDS, buildVocabMCQ,
  pickReadingPassage, pickGrammarItem, GRAMMAR_CATEGORY_LABEL,
  type LocalGrammarItem,
} from '@/constants/practiceContent';

// ─── Types ──────────────────────────────────────────────────────────────────
type Mode = 'adaptive' | 'retention' | 'reading' | 'grammar' | 'targeted';

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

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.tabBarOuter}
        contentContainerStyle={styles.tabBar}
      >
        {([
          { k: 'adaptive',  label: '⚡ Adaptive' },
          { k: 'retention', label: '🧠 Retention' },
          { k: 'reading',   label: '📖 Reading' },
          { k: 'grammar',   label: '✏️ Grammar' },
          { k: 'targeted',  label: '🎯 Targeted' },
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
      </ScrollView>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {mode === 'adaptive'  && <AdaptiveBlock />}
        {mode === 'retention' && <RetentionBlock />}
        {mode === 'reading'   && <ReadingBlock />}
        {mode === 'grammar'   && <GrammarBlock />}
        {mode === 'targeted'  && <TargetedBlock />}
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
      if (v) { setIsDemo(true); loadLocalCard(); }
      else loadCard();
    });
  }, []);

  // Build an ExerciseCard from the local AWL bank (offline / demo).
  const loadLocalCard = () => {
    setSelected(null); setSubmitted(false); setResult(null);
    const lc = LOCAL_VOCAB_CARDS[Math.floor(Math.random() * LOCAL_VOCAB_CARDS.length)];
    const { options, correctIndex } = buildVocabMCQ(lc);
    setCard({
      vocab_id: `local_${lc.word}`,
      word: lc.word,
      pronunciation: lc.pronunciation,
      definition: lc.definition,
      example_sentence: lc.example_sentence,
      synonyms: lc.synonyms,
      difficulty: lc.difficulty,
      category: 'AWL',
      sublist: lc.sublist,
      exercise_format: 'word_to_def',
      question: lc.word,
      instruction: 'Which definition is correct?',
      options,
      correct_index: correctIndex,
      correct_answer: lc.definition,
      is_new: true,
      sm2_interval: 0,
      sm2_next_review: null,
      attempts: 0,
    });
    setStartMs(Date.now());
  };

  const loadCard = async () => {
    setLoading(true);
    setSelected(null);
    setSubmitted(false);
    setResult(null);
    try {
      const token = await getFreshToken();
      if (!token) { loadLocalCard(); return; }   // offline fallback
      const r = await fetch(VOCABULARY_ENDPOINTS.EXERCISE, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!r.ok) throw new Error(`Backend ${r.status}`);
      const j = await r.json();
      setCard(j.data ?? j);
      setStartMs(Date.now());
    } catch {
      loadLocalCard();   // backend unreachable → use local bank
    } finally { setLoading(false); }
  };

  const pick = async (idx: number) => {
    if (!card || submitted) return;
    const rt = Date.now() - startMs;
    setSelected(idx);
    setSubmitted(true);
    const isCorrect = idx === card.correct_index;
    setSession(s => ({ correct: s.correct + (isCorrect ? 1 : 0), total: s.total + 1 }));

    // Demo / local cards: compute SM-2-style feedback locally, no backend.
    if (isDemo || card.vocab_id.startsWith('local_')) {
      const grade = !isCorrect ? 2 : rt < 2000 ? 5 : rt < 5000 ? 4 : 3;
      const interval = grade <= 2 ? 1 : grade === 3 ? 1 : grade === 4 ? 3 : 6;
      setResult({
        is_correct: isCorrect,
        grade,
        accuracy: isCorrect ? 100 : 0,
        mastery_level: isCorrect ? 'learning' : 'new',
        sm2_interval: interval,
        sm2_next_review: new Date(Date.now() + interval * 86400000).toISOString(),
        message: isCorrect ? 'Correct' : 'Incorrect',
      });
      return;
    }

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

  const nextCard = () => { if (isDemo) loadLocalCard(); else loadCard(); };

  const diffLabel = (ivl: number) => {
    if (ivl <= 0)  return 'New word';
    if (ivl === 1) return 'Review: tomorrow';
    return `Review: in ${ivl} days`;
  };

  return (
    <View>
      <View style={styles.srsInfo}>
        <Text style={styles.srsInfoText}>
          {isDemo
            ? 'Demo mode — practising the Academic Word List (Coxhead 2000) offline. Word→definition multiple choice, graded by response time (DeKeyser & Suzuki 2025).'
            : 'SM-2 spaced repetition (Wozniak 1987). Overdue cards appear first, then new AWL words by sublist. No AI — all content from Academic Word List (Coxhead 2000).'}
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
              <View style={[styles.badge, { backgroundColor: 'rgba(255,255,255,0.08)' }]}>
                <Text style={[styles.badgeText, { color: '#94A3B8' }]}>{card.difficulty}</Text>
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
                    { color: result.is_correct ? '#0FBA9A' : '#EF4444' }]}>
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
        <TouchableOpacity style={styles.primaryBtn} onPress={nextCard} activeOpacity={0.85}>
          <Text style={styles.primaryBtnText}>Next word →</Text>
        </TouchableOpacity>
      )}

      {!card && !loading && (
        <TouchableOpacity style={styles.primaryBtn} onPress={nextCard} activeOpacity={0.85}>
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
              <Text style={[styles.retentionNum, { color: '#8B5CF6' }]}>{state.learning_count}</Text>
              <Text style={styles.retentionLbl}>Learning</Text>
            </View>
            <View style={styles.retentionStat}>
              <Text style={[styles.retentionNum, { color: '#0FBA9A' }]}>{state.mastered_count}</Text>
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
          <SRSSection title="Learning" color="#8B5CF6" items={state.learning}
            meta={w => `${w.interval}d interval`}
            emptyMsg="Practice some words in the Adaptive tab to start learning." />
          <SRSSection title="Mastered (≥21d)" color="#0FBA9A" items={state.mastered}
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

  const correctCount = useMemo(() => {
    if (!data) return 0;
    let n = 0;
    data.questions.forEach((q, i) => { if (answers[i] === q.correct) n++; });
    return n;
  }, [data, answers]);

  const loadLocalPassage = async () => {
    setLoading(true); setData(null); setAnswers({}); setSubmitted(false);
    const caf = await loadJSON<any[]>('vf_caf_sessions', []);
    const p = pickReadingPassage(pickCEFR(caf));
    setData({ title: p.title, passage: p.passage, word_count: p.word_count, questions: p.questions });
    setLoading(false);
  };

  const generate = async () => {
    if (isDemo) { loadLocalPassage(); return; }
    setLoading(true); setData(null); setAnswers({}); setSubmitted(false);
    try {
      const token = await getFreshToken();
      if (!token) { await loadLocalPassage(); return; }
      const caf = await loadJSON<any[]>('vf_caf_sessions', []);
      const r = await fetch(PRACTICE_ENDPOINTS.READING, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ cefr_level: pickCEFR(caf) }),
      });
      if (!r.ok) throw new Error(`Backend ${r.status}`);
      const j = await r.json();
      setData(j.data);
    } catch {
      await loadLocalPassage();   // backend unreachable → local passage
    } finally { setLoading(false); }
  };

  return (
    <View>
      <Text style={styles.modeIntro}>
        {isDemo
          ? 'Demo mode — offline CEFR-calibrated passage with 5 comprehension questions (literal + inferential + vocabulary).'
          : 'CEFR-calibrated passage with 5 mixed comprehension questions (literal + inferential + vocabulary).'}
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
                color: correctCount >= 4 ? '#0FBA9A' : correctCount >= 2 ? '#8B5CF6' : '#EF4444',
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

// ─── Grammar (Romanian L1 interference drills) ───────────────────────────────
//
// Targets the Grammar Accuracy indicator (Neumanová 2021 error analysis).
// Each item is a documented Romanian→English transfer error: articles,
// prepositions, tense, word order, double negation, collocations,
// false friends, agreement. No AI — static, deterministic bank.
function GrammarBlock() {
  const [item, setItem] = useState<LocalGrammarItem | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [session, setSession] = useState({ correct: 0, total: 0 });

  const loadItem = async () => {
    setSelected(null); setSubmitted(false);
    const caf = await loadJSON<any[]>('vf_caf_sessions', []);
    setItem(pickGrammarItem(pickCEFR(caf)));
  };

  useEffect(() => { loadItem(); }, []);

  const pick = (idx: number) => {
    if (!item || submitted) return;
    setSelected(idx);
    setSubmitted(true);
    setSession(s => ({
      correct: s.correct + (idx === item.correctIndex ? 1 : 0),
      total: s.total + 1,
    }));
  };

  const isCorrect = item ? selected === item.correctIndex : false;

  return (
    <View>
      <View style={styles.srsInfo}>
        <Text style={styles.srsInfoText}>
          Romanian L1-interference grammar drills (Neumanová 2021). Each item targets a
          documented transfer error — articles, prepositions, tense, word order,
          double negation, collocations, false friends and agreement.
        </Text>
        {session.total > 0 && (
          <Text style={styles.sessionCounter}>
            Session: {session.correct}/{session.total} correct
          </Text>
        )}
      </View>

      {item && (
        <View style={styles.exerciseCard}>
          <View style={styles.wordHeader}>
            <Text style={styles.defText}>{item.prompt.replace('___', '_____')}</Text>
            <View style={styles.badgeRow}>
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{GRAMMAR_CATEGORY_LABEL[item.category]}</Text>
              </View>
              <View style={[styles.badge, { backgroundColor: 'rgba(255,255,255,0.08)' }]}>
                <Text style={[styles.badgeText, { color: '#94A3B8' }]}>{item.cefr}</Text>
              </View>
            </View>
          </View>

          <Text style={styles.exerciseInstruction}>Choose the option that completes the sentence correctly.</Text>

          {item.options.map((opt, i) => {
            const isSel = selected === i;
            const ok    = submitted && i === item.correctIndex;
            const wrong = submitted && isSel && i !== item.correctIndex;
            return (
              <TouchableOpacity
                key={i}
                style={[
                  styles.option,
                  isSel  && styles.optionSelected,
                  ok     && styles.optionCorrect,
                  wrong  && styles.optionWrong,
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

          {submitted && (
            <View style={styles.feedbackBox}>
              <Text style={[styles.feedbackMain, { color: isCorrect ? '#0FBA9A' : '#EF4444' }]}>
                {isCorrect ? 'Correct' : 'Incorrect'}
              </Text>
              <Text style={styles.exampleSentence}>
                {item.prompt.replace('___', item.options[item.correctIndex])}
              </Text>
              <Text style={styles.grammarRule}>✓ {item.explanation}</Text>
              <View style={styles.l1NoteBox}>
                <Text style={styles.l1NoteLabel}>🇷🇴 ROMANIAN L1 NOTE</Text>
                <Text style={styles.l1NoteText}>{item.l1_note}</Text>
              </View>
            </View>
          )}
        </View>
      )}

      {submitted && (
        <TouchableOpacity style={styles.primaryBtn} onPress={loadItem} activeOpacity={0.85}>
          <Text style={styles.primaryBtnText}>Next question →</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// ─── Targeted (LLM exercises targeting the user's weakest CAF indicator) ─────
//
// Reads the baseline diagnosis from AsyncStorage, finds the lowest-scoring
// CAF indicator, maps it to an IELTS criterion, then calls POST /practice/adaptive
// to get 5 LLM-generated exercises (llama-3.3-70b) aimed at exactly that gap.
//
// Exercise types:
//   fill_blank  — sentence with a blank; user writes; reveal shows expected
//   rewrite     — sentence to rewrite; user writes; reveal shows model answer
//   speak_aloud — sentence/task to say aloud; no text input; "Got it" advances
//   collocation — collocation exercise; user writes; reveal shows correct phrase
//   translate   — Romanian→English; user writes; reveal shows translation
//
// weakest_category defaults to "collocations" (Romanian L1 errors not persisted).
// Reference: Alderson (2005) — assessment must close the gap between diagnosis
// and instruction.

// Maps indicator key → IELTS criterion used by /practice/adaptive
const INDICATOR_CRITERION: Record<string, string> = {
  lexical_diversity:        'lexical_resource',
  lexical_sophistication:   'lexical_resource',
  word_length:              'lexical_resource',
  sentence_complexity:      'grammatical_range_and_accuracy',
  subordination_ratio:      'grammatical_range_and_accuracy',
  syntactic_complexity:     'grammatical_range_and_accuracy',
  morphosyntactic_accuracy: 'grammatical_range_and_accuracy',
  articulation_rate:        'fluency_and_coherence',
  pause_frequency:          'fluency_and_coherence',
  cohesion_score:           'coherence_and_cohesion',
};

// Maps human label (stored in baselineDiagnosis.indicators[].name) → indicator key
const LABEL_TO_KEY: Record<string, string> = {
  'Vocabulary Range':   'lexical_diversity',
  'Word Sophistication':'lexical_sophistication',
  'Word Complexity':    'word_length',
  'Sentence Length':    'sentence_complexity',
  'Subordination':      'subordination_ratio',
  'Syntactic Richness': 'syntactic_complexity',
  'Speech Rate':        'articulation_rate',
  'Fluency':            'pause_frequency',
  'Coherence':          'cohesion_score',
  'Grammar Accuracy':   'morphosyntactic_accuracy',
};

const EX_TYPE_LABEL: Record<string, string> = {
  fill_blank:  'Fill in the Blank',
  rewrite:     'Rewrite the Sentence',
  speak_aloud: 'Speak Aloud',
  collocation: 'Collocation',
  translate:   'Translate',
};

type AdaptiveExercise = {
  type: string;
  instruction: string;
  prompt: string;
  expected: string;
  explanation: string;
};

function TargetedBlock() {
  const [loadingDiag, setLoadingDiag] = useState(true);
  const [cefrLevel, setCefrLevel]       = useState<string | null>(null);
  const [weakestLabel, setWeakestLabel] = useState<string>('');
  const [criterion, setCriterion]       = useState<string>('lexical_resource');
  const [noDiag, setNoDiag]             = useState(false);

  const [loading, setLoading]     = useState(false);
  const [exercises, setExercises] = useState<AdaptiveExercise[]>([]);
  const [idx, setIdx]             = useState(0);
  const [userAnswer, setUserAnswer] = useState('');
  const [revealed, setRevealed]   = useState(false);
  const [done, setDone]           = useState(false);

  // Load baseline diagnosis on mount
  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem('baselineDiagnosis');
        if (!raw) { setNoDiag(true); setLoadingDiag(false); return; }
        const diag = JSON.parse(raw);
        setCefrLevel(diag.cefr || 'B1');

        const inds: { name: string; normalized: number }[] = diag.indicators || [];
        if (inds.length === 0) {
          setWeakestLabel('Vocabulary Range');
          setCriterion('lexical_resource');
          setLoadingDiag(false);
          return;
        }
        // Find the lowest-scoring indicator
        const weakest = inds.reduce((a, b) => b.normalized < a.normalized ? b : a);
        setWeakestLabel(weakest.name);
        const key = LABEL_TO_KEY[weakest.name] || 'lexical_diversity';
        setCriterion(INDICATOR_CRITERION[key] || 'lexical_resource');
      } catch {
        setNoDiag(true);
      } finally {
        setLoadingDiag(false);
      }
    })();
  }, []);

  const fetchExercises = async () => {
    if (!cefrLevel) return;
    setLoading(true);
    setExercises([]);
    setIdx(0);
    setUserAnswer('');
    setRevealed(false);
    setDone(false);
    try {
      const token = await getFreshToken();
      if (!token) throw new Error('Not authenticated');
      const r = await fetch(PRACTICE_ENDPOINTS.ADAPTIVE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          cefr_level:        cefrLevel,
          weakest_category:  'collocations',
          weakest_criterion: criterion,
          target_exam:       'general',
        }),
      });
      if (!r.ok) throw new Error(`Backend ${r.status}`);
      const j = await r.json();
      const exs: AdaptiveExercise[] = j.data?.exercises || j.exercises || [];
      if (exs.length === 0) throw new Error('No exercises returned');
      setExercises(exs);
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Could not load exercises. Try again.');
    } finally { setLoading(false); }
  };

  const advance = () => {
    if (idx + 1 >= exercises.length) {
      setDone(true);
    } else {
      setIdx(i => i + 1);
      setUserAnswer('');
      setRevealed(false);
    }
  };

  if (loadingDiag) {
    return <ActivityIndicator color="#0FBA9A" style={{ marginVertical: 40 }} />;
  }

  if (noDiag) {
    return (
      <View style={styles.targetedNoDiag}>
        <Text style={styles.targetedNoDiagTitle}>No diagnosis yet</Text>
        <Text style={styles.targetedNoDiagText}>
          Complete the Initial Diagnostic first. These exercises are personalised
          to your weakest measured language area.
        </Text>
      </View>
    );
  }

  const ex = exercises[idx];
  const isSpeakAloud = ex?.type === 'speak_aloud';

  return (
    <View>
      {/* ── Info header ─────────────────────────────────────────────────── */}
      <View style={styles.targetedHeader}>
        <Text style={styles.targetedHeaderTitle}>Targeted Practice</Text>
        <Text style={styles.targetedHeaderSub}>
          AI-generated exercises personalised to your weakest language area
        </Text>
        {!!weakestLabel && (
          <View style={styles.targetedTag}>
            <Text style={styles.targetedTagText}>📌 Targeting: {weakestLabel}</Text>
          </View>
        )}
        {!!cefrLevel && (
          <View style={[styles.targetedTag, styles.targetedTagCefr]}>
            <Text style={[styles.targetedTagText, { color: '#4338CA' }]}>
              Level: {cefrLevel}
            </Text>
          </View>
        )}
      </View>

      {/* ── Generate button ─────────────────────────────────────────────── */}
      {exercises.length === 0 && !loading && (
        <TouchableOpacity style={styles.primaryBtn} onPress={fetchExercises} activeOpacity={0.85}>
          <Text style={styles.primaryBtnText}>✨  Generate exercises</Text>
        </TouchableOpacity>
      )}

      {loading && (
        <View style={styles.targetedLoadingBox}>
          <ActivityIndicator color="#0FBA9A" />
          <Text style={styles.targetedLoadingText}>AI is generating exercises for you…</Text>
        </View>
      )}

      {/* ── Done state ──────────────────────────────────────────────────── */}
      {done && (
        <View style={styles.targetedDoneCard}>
          <Text style={styles.targetedDoneEmoji}>🎉</Text>
          <Text style={styles.targetedDoneTitle}>Set complete!</Text>
          <Text style={styles.targetedDoneSub}>
            You finished all {exercises.length} exercises targeting your{' '}
            {weakestLabel.toLowerCase()} skills.
          </Text>
          <TouchableOpacity
            style={[styles.primaryBtn, { marginTop: 16, marginBottom: 0 }]}
            onPress={fetchExercises}
            activeOpacity={0.85}
          >
            <Text style={styles.primaryBtnText}>✨  New set</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ── Active exercise ─────────────────────────────────────────────── */}
      {!done && ex && (
        <>
          {/* Step dots */}
          <View style={styles.targetedStepRow}>
            {exercises.map((_, i) => (
              <View
                key={i}
                style={[
                  styles.targetedStepDot,
                  i < idx  && styles.targetedStepDotDone,
                  i === idx && styles.targetedStepDotActive,
                ]}
              />
            ))}
          </View>

          <View style={styles.targetedExCard}>
            {/* Type tag + counter */}
            <View style={styles.targetedTypeRow}>
              <View style={styles.targetedTypeTag}>
                <Text style={styles.targetedTypeText}>
                  {EX_TYPE_LABEL[ex.type] || ex.type.replace('_', ' ').toUpperCase()}
                </Text>
              </View>
              <Text style={styles.targetedStepLabel}>{idx + 1} / {exercises.length}</Text>
            </View>

            {/* Instruction */}
            <Text style={styles.targetedInstruction}>{ex.instruction}</Text>

            {/* Prompt */}
            <Text style={styles.targetedPrompt}>{ex.prompt}</Text>

            {/* Input or "Got it" — only shown before reveal */}
            {!revealed && (
              isSpeakAloud ? (
                <TouchableOpacity
                  style={[styles.primaryBtn, { marginTop: 12, marginBottom: 0 }]}
                  onPress={advance}
                  activeOpacity={0.85}
                >
                  <Text style={styles.primaryBtnText}>✓  Got it</Text>
                </TouchableOpacity>
              ) : (
                <>
                  <TextInput
                    style={styles.targetedInput}
                    placeholder="Type your answer…"
                    placeholderTextColor="#94A3B8"
                    value={userAnswer}
                    onChangeText={setUserAnswer}
                    multiline
                    textAlignVertical="top"
                  />
                  <TouchableOpacity
                    style={styles.targetedRevealBtn}
                    onPress={() => setRevealed(true)}
                    activeOpacity={0.85}
                  >
                    <Text style={styles.targetedRevealText}>Reveal answer</Text>
                  </TouchableOpacity>
                </>
              )
            )}

            {/* Revealed answer */}
            {revealed && (
              <View style={styles.targetedAnswerBox}>
                <Text style={styles.targetedAnswerLabel}>EXPECTED ANSWER</Text>
                <Text style={styles.targetedAnswerText}>{ex.expected}</Text>
                {!!ex.explanation && (
                  <>
                    <Text style={[styles.targetedAnswerLabel, { marginTop: 10 }]}>WHY</Text>
                    <Text style={styles.targetedExplanation}>{ex.explanation}</Text>
                  </>
                )}
                <TouchableOpacity
                  style={[styles.primaryBtn, { marginTop: 14, marginBottom: 0 }]}
                  onPress={advance}
                  activeOpacity={0.85}
                >
                  <Text style={styles.primaryBtnText}>
                    {idx + 1 < exercises.length ? 'Next →' : 'Finish ✓'}
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </>
      )}
    </View>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#060D1A' },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    paddingHorizontal: 20, paddingTop: 18, paddingBottom: 8,
  },
  backBtn: {
    paddingHorizontal: 14, paddingVertical: 9, borderRadius: 11,
    borderWidth: 1.5, borderColor: '#0FBA9A', backgroundColor: '#0F1B2D',
  },
  backText: { color: '#0FBA9A', fontSize: 14, fontWeight: '700', letterSpacing: 0.2 },
  title: { fontSize: 24, fontWeight: '800', color: '#F0F6FF', letterSpacing: -0.4 },

  tabBarOuter: { backgroundColor: '#060D1A' },
  tabBar: {
    flexDirection: 'row', gap: 6,
    paddingHorizontal: 20, paddingVertical: 10,
  },
  tab: {
    minWidth: 86, paddingVertical: 10, paddingHorizontal: 10, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
  },
  tabActive: {
    backgroundColor: '#0FBA9A', borderColor: '#0FBA9A',
    shadowColor: '#0FBA9A', shadowOpacity: 0.3, shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 }, elevation: 3,
  },
  tabText: { fontSize: 12, fontWeight: '700', color: '#94A3B8' },
  tabTextActive: { color: '#fff', fontWeight: '800' },

  scroll: { paddingHorizontal: 20, paddingVertical: 14, paddingBottom: 60 },

  modeIntro: { fontSize: 13, color: '#94A3B8', lineHeight: 19, marginBottom: 14 },
  bold: { fontWeight: '800', color: '#F0F6FF' },

  primaryBtn: {
    backgroundColor: '#0FBA9A',
    paddingVertical: 13, borderRadius: 12, alignItems: 'center',
    marginBottom: 12,
    shadowColor: '#0FBA9A', shadowOpacity: 0.3, shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 }, elevation: 4,
  },
  primaryBtnText: { color: '#fff', fontSize: 14, fontWeight: '800', letterSpacing: 0.3 },

  secondaryBtn: {
    backgroundColor: '#0F1B2D',
    paddingVertical: 11, borderRadius: 12, alignItems: 'center',
    borderWidth: 1.5, borderColor: '#0FBA9A',
    marginBottom: 12,
  },
  secondaryBtnText: { color: '#0FBA9A', fontSize: 13, fontWeight: '800' },

  // Adaptive — SM-2 exercise runner
  srsInfo: {
    backgroundColor: 'rgba(15,186,154,0.12)', borderRadius: 12, padding: 12,
    borderWidth: 1, borderColor: 'rgba(15,186,154,0.25)', marginBottom: 14,
  },
  srsInfoText: { fontSize: 12, color: '#0FBA9A', lineHeight: 18 },
  sessionCounter: {
    fontSize: 13, fontWeight: '800', color: '#0FBA9A', marginTop: 6,
  },

  exerciseCard: {
    backgroundColor: '#0F1B2D', borderRadius: 14, padding: 16, marginBottom: 12,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 }, elevation: 2,
  },
  wordHeader: {
    flexDirection: 'row', alignItems: 'flex-start',
    justifyContent: 'space-between', marginBottom: 14,
  },
  wordText: { fontSize: 26, fontWeight: '900', color: '#F0F6FF', letterSpacing: -0.5 },
  defText:  { fontSize: 15, fontWeight: '600', color: '#F0F6FF', lineHeight: 22 },
  wordPron: { fontSize: 13, color: '#94A3B8', marginTop: 2, fontStyle: 'italic' },
  badgeRow: { flexDirection: 'row', gap: 6, flexShrink: 0 },
  badge: {
    backgroundColor: '#0FBA9A', borderRadius: 8,
    paddingHorizontal: 8, paddingVertical: 4,
  },
  badgeText: { fontSize: 10, fontWeight: '800', color: '#fff', letterSpacing: 0.4 },
  exerciseInstruction: { fontSize: 13, color: '#94A3B8', marginBottom: 10, lineHeight: 18 },

  feedbackBox: {
    marginTop: 14, padding: 12, backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  feedbackMain: { fontSize: 15, fontWeight: '800', marginBottom: 2 },
  feedbackSub: { fontSize: 12, color: '#94A3B8', marginBottom: 6 },
  exampleSentence: { fontSize: 13, color: '#F0F6FF', fontStyle: 'italic', lineHeight: 19, marginTop: 4 },
  synonyms: { fontSize: 11, color: '#94A3B8', marginTop: 6 },

  // Grammar feedback
  grammarRule: { fontSize: 13, color: '#0FBA9A', fontWeight: '600', lineHeight: 19, marginTop: 8 },
  l1NoteBox: {
    marginTop: 10, padding: 10, borderRadius: 8,
    backgroundColor: 'rgba(139,92,246,0.12)', borderWidth: 1, borderColor: 'rgba(139,92,246,0.35)',
  },
  l1NoteLabel: { fontSize: 9, fontWeight: '900', color: '#8B5CF6', letterSpacing: 0.6, marginBottom: 3 },
  l1NoteText: { fontSize: 12, color: '#8B5CF6', lineHeight: 17 },

  // Retention
  retentionSummary: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  retentionStat: {
    flex: 1, alignItems: 'center', padding: 12,
    backgroundColor: '#0F1B2D', borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  retentionNum: { fontSize: 26, fontWeight: '800' },
  retentionLbl: { fontSize: 10, color: '#94A3B8', textAlign: 'center', marginTop: 2, fontWeight: '600' },
  retentionRateRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: '#0F1B2D', borderRadius: 12, padding: 14,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', marginBottom: 14,
  },
  retentionRateLbl: { fontSize: 13, fontWeight: '700', color: '#F0F6FF' },
  retentionRateNum: { fontSize: 18, fontWeight: '800', color: '#0FBA9A' },

  progressTrack: {
    height: 6, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 3, marginBottom: 16,
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
    backgroundColor: '#0F1B2D', borderRadius: 999,
    paddingHorizontal: 10, paddingVertical: 6,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  wordChipText: { fontSize: 12, fontWeight: '700', color: '#F0F6FF' },
  wordChipMeta: { fontSize: 10, color: '#94A3B8', fontWeight: '700' },

  // Reading
  passageCard: {
    backgroundColor: '#0F1B2D', borderRadius: 14, padding: 16, marginBottom: 14,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  passageTitle: { fontSize: 16, fontWeight: '800', color: '#F0F6FF', marginBottom: 4 },
  passageMeta: { fontSize: 11, color: '#94A3B8', marginBottom: 10, fontStyle: 'italic' },
  passageText: { fontSize: 14, color: '#F0F6FF', lineHeight: 22 },

  questionCard: {
    backgroundColor: '#0F1B2D', borderRadius: 12, padding: 14, marginBottom: 10,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  questionType: { fontSize: 10, fontWeight: '800', color: '#0FBA9A', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 4 },
  questionText: { fontSize: 13, fontWeight: '700', color: '#F0F6FF', marginBottom: 10 },
  option: {
    flexDirection: 'row', gap: 8,
    paddingHorizontal: 12, paddingVertical: 10,
    borderRadius: 10, marginVertical: 3,
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  optionSelected: { borderColor: '#0FBA9A', backgroundColor: 'rgba(15,186,154,0.12)' },
  optionCorrect:  { borderColor: '#0FBA9A', backgroundColor: 'rgba(15,186,154,0.15)' },
  optionWrong:    { borderColor: '#EF4444', backgroundColor: 'rgba(239,68,68,0.12)' },
  optionLetter: { fontSize: 13, fontWeight: '800', color: '#F0F6FF', width: 18 },
  optionText: { flex: 1, fontSize: 13, color: '#F0F6FF', lineHeight: 18 },
  questionExplanation: {
    fontSize: 12, color: '#94A3B8', marginTop: 8,
    fontStyle: 'italic', paddingTop: 8,
    borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.08)',
  },

  scoreCard: {
    backgroundColor: '#0F1B2D', borderRadius: 12, padding: 16, marginVertical: 14,
    borderWidth: 1.5, borderColor: '#0FBA9A', alignItems: 'center',
  },
  scoreLabel: { fontSize: 11, fontWeight: '800', color: '#94A3B8', letterSpacing: 0.6, textTransform: 'uppercase' },
  scoreNum: { fontSize: 36, fontWeight: '900', marginVertical: 6 },
  scoreSub: { fontSize: 12, color: '#94A3B8', textAlign: 'center' },
  scoreDetail: { fontSize: 11, marginTop: 8, fontWeight: '700' },
  targetLabel: { fontSize: 10, fontWeight: '800', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 0.6, marginTop: 10 },
  targetText: { fontSize: 13, color: '#F0F6FF', fontWeight: '600', marginTop: 4, textAlign: 'center' },

  // Demo notice
  demoNotice: {
    backgroundColor: 'rgba(59,130,246,0.10)', borderRadius: 14, padding: 18,
    borderWidth: 1, borderColor: 'rgba(59,130,246,0.25)', marginBottom: 12,
  },
  demoNoticeTitle: { fontSize: 15, fontWeight: '800', color: '#8B5CF6', marginBottom: 8 },
  demoNoticeText: { fontSize: 13, color: '#8B5CF6', lineHeight: 19 },

  // Listening
  noAudioHint: { fontSize: 11, color: '#94A3B8', fontStyle: 'italic', textAlign: 'center', marginBottom: 8 },
  field: { fontSize: 12, fontWeight: '700', color: '#94A3B8', marginTop: 8, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.4 },
  input: {
    backgroundColor: '#0F1B2D', borderRadius: 10, padding: 12,
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.15)',
    fontSize: 14, color: '#F0F6FF', marginBottom: 10,
    minHeight: 80, textAlignVertical: 'top',
  },

  // Targeted
  targetedNoDiag: {
    backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 14, padding: 24, alignItems: 'center',
  },
  targetedNoDiagTitle: { fontSize: 17, fontWeight: '800', color: '#F0F6FF', marginBottom: 8 },
  targetedNoDiagText: { fontSize: 13, color: '#94A3B8', lineHeight: 19, textAlign: 'center' },

  targetedHeader: {
    backgroundColor: 'rgba(15,186,154,0.12)', borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: 'rgba(15,186,154,0.25)', marginBottom: 14, gap: 6,
  },
  targetedHeaderTitle: { fontSize: 16, fontWeight: '800', color: '#F0F6FF' },
  targetedHeaderSub: { fontSize: 12, color: '#94A3B8', lineHeight: 17 },
  targetedTag: {
    alignSelf: 'flex-start', backgroundColor: 'rgba(15,186,154,0.15)', borderRadius: 999,
    paddingHorizontal: 10, paddingVertical: 4,
    borderWidth: 1, borderColor: 'rgba(15,186,154,0.35)',
  },
  targetedTagCefr: { backgroundColor: 'rgba(139,92,246,0.15)', borderColor: 'rgba(139,92,246,0.35)' },
  targetedTagText: { fontSize: 11, fontWeight: '700', color: '#0FBA9A' },

  targetedLoadingBox: {
    flexDirection: 'row', gap: 12, alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 12, padding: 14, marginBottom: 12,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  targetedLoadingText: { fontSize: 13, color: '#94A3B8' },

  targetedDoneCard: {
    backgroundColor: '#0F1B2D', borderRadius: 14, padding: 22,
    alignItems: 'center', borderWidth: 1.5, borderColor: '#0FBA9A',
  },
  targetedDoneEmoji: { fontSize: 40, marginBottom: 8 },
  targetedDoneTitle: { fontSize: 20, fontWeight: '900', color: '#F0F6FF', marginBottom: 6 },
  targetedDoneSub: { fontSize: 13, color: '#94A3B8', textAlign: 'center', lineHeight: 19 },

  targetedStepRow: {
    flexDirection: 'row', gap: 6, marginBottom: 12, justifyContent: 'center',
  },
  targetedStepDot: {
    width: 10, height: 10, borderRadius: 5, backgroundColor: 'rgba(255,255,255,0.08)',
  },
  targetedStepDotDone:   { backgroundColor: 'rgba(15,186,154,0.45)' },
  targetedStepDotActive: { backgroundColor: '#0FBA9A', width: 24, borderRadius: 5 },

  targetedExCard: {
    backgroundColor: '#0F1B2D', borderRadius: 14, padding: 16, marginBottom: 12,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 }, elevation: 2,
  },
  targetedTypeRow: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', marginBottom: 10,
  },
  targetedTypeTag: {
    backgroundColor: 'rgba(15,186,154,0.12)', borderRadius: 8,
    paddingHorizontal: 8, paddingVertical: 4,
    borderWidth: 1, borderColor: 'rgba(15,186,154,0.30)',
  },
  targetedTypeText: {
    fontSize: 10, fontWeight: '800', color: '#0FBA9A', letterSpacing: 0.5,
  },
  targetedStepLabel: { fontSize: 11, color: '#94A3B8', fontWeight: '700' },

  targetedInstruction: {
    fontSize: 13, color: '#94A3B8', marginBottom: 10, lineHeight: 18,
  },
  targetedPrompt: {
    fontSize: 15, fontWeight: '700', color: '#F0F6FF', lineHeight: 22, marginBottom: 12,
    paddingVertical: 10, paddingHorizontal: 12,
    backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 10,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  targetedInput: {
    backgroundColor: '#0F1B2D', borderRadius: 10, padding: 12,
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.15)',
    fontSize: 14, color: '#F0F6FF', marginBottom: 10,
    minHeight: 70, textAlignVertical: 'top',
  },
  targetedRevealBtn: {
    backgroundColor: '#8B5CF6',
    paddingVertical: 11, borderRadius: 12, alignItems: 'center',
  },
  targetedRevealText: { color: '#fff', fontSize: 13, fontWeight: '800' },

  targetedAnswerBox: {
    marginTop: 12, padding: 12,
    backgroundColor: 'rgba(15,186,154,0.10)', borderRadius: 10,
    borderWidth: 1, borderColor: 'rgba(15,186,154,0.30)',
  },
  targetedAnswerLabel: {
    fontSize: 9, fontWeight: '900', color: '#0FBA9A', letterSpacing: 0.8, marginBottom: 4,
  },
  targetedAnswerText: {
    fontSize: 14, fontWeight: '700', color: '#F0F6FF', lineHeight: 21,
  },
  targetedExplanation: { fontSize: 12, color: '#94A3B8', lineHeight: 18 },
});
