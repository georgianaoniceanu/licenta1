/**
 * Demo Mode — three realistic learner profiles for thesis presentation.
 *
 * WEAK   (slab)      A2 baseline  → B1 current  (32 → 46 pts, +14)
 * MEDIUM (mediu)     B1 baseline  → B2 current  (50 → 68 pts, +18)
 * STRONG (avansat)   B2 baseline  → C1 current  (72 → 88 pts, +16)
 *
 * Each profile populates:
 *   baselineDiagnosis / baselineDiagnosisOriginal
 *   vf_caf_sessions, vf_exam_sessions, vf_grammar_sessions, vf_genre_sessions
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { JOBS_BY_ID, type Industry } from '@/constants/jobsDatabase';
import { accentSessionsFor, vocabSessionsFor, phonemeScoresFor } from './demoSessions';

export type DemoPreset = 'weak' | 'medium' | 'strong';
export type JobPreset  = 'ana' | 'mihai' | 'elena' | 'radu' | 'sorin' | 'diana';
export type AnyPreset  = DemoPreset | JobPreset;

/**
 * Controls whether the demo / persona pickers are shown in the UI (e.g. on the
 * Home dashboard). Keep `true` for thesis presentations; set to `false` for a
 * clean production look or screenshots.
 */
export const SHOW_DEMO_PROFILES = true;

// Helpers
const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.now();
const tsBack = (d: number) => NOW - d * DAY;
const ramp   = (start: number, end: number, n: number, i: number) =>
  Math.round(start + (end - start) * (i / (n - 1)));

// Demo isolation: backup / restore real user data
// When a demo profile is loaded it overwrites the same AsyncStorage keys used
// by the real account.  We back up those keys before the first demo load and
// restore them when the demo is cleared so the real user's progress is never
// lost by switching profiles during a thesis presentation.

const REAL_BACKUP_PREFIX = '__real_backup__';
const REAL_BACKUP_MANIFEST = '__real_backup_manifest__';

// Every key that loadDemoProfile may overwrite.
const DEMO_OVERWRITE_KEYS: readonly string[] = [
  'baselineDiagnosis', 'baselineDiagnosisOriginal',
  'rawIndicators',
  'vf_caf_sessions', 'vf_exam_sessions', 'vf_grammar_sessions',
  'vf_genre_sessions', 'vf_shadow_sessions', 'vf_accent_sessions',
  'vf_vocab_sessions', 'vf_phoneme_scores',
  'userTargetExam', 'userPrimaryGoal', 'userJob', 'userIndustry',
  'userCurrentCEFR', 'userDomain', 'userIntensity', 'userWeaknesses',
  'userDisplayName',
  'learner_profile_anonymous', 'demo_rt_stats', 'demo_srs_state',
] as const;

async function _backupRealData(): Promise<void> {
  // Only backup if we're not already in demo mode (don't backup demo data)
  const alreadyDemo = await AsyncStorage.getItem('active_demo_preset');
  if (alreadyDemo) return;

  const pairs = await AsyncStorage.multiGet(DEMO_OVERWRITE_KEYS as unknown as string[]);
  const existing: Array<[string, string]> = pairs
    .filter(([, v]) => v !== null)
    .map(([k, v]) => [REAL_BACKUP_PREFIX + k, v as string]);

  // Record which keys had values (so we know what to restore vs. delete later)
  const manifest = pairs
    .filter(([, v]) => v !== null)
    .map(([k]) => k)
    .join(',');

  if (existing.length > 0) {
    await AsyncStorage.multiSet(existing);
  }
  await AsyncStorage.setItem(REAL_BACKUP_MANIFEST, manifest);
}

async function _restoreRealData(): Promise<void> {
  const manifest = await AsyncStorage.getItem(REAL_BACKUP_MANIFEST);
  if (!manifest) return;

  const backedUpKeys = manifest.split(',').filter(Boolean);
  const backupKeys   = backedUpKeys.map(k => REAL_BACKUP_PREFIX + k);

  // Read backup values
  const pairs = await AsyncStorage.multiGet(backupKeys);
  const restorePairs: Array<[string, string]> = pairs
    .filter(([, v]) => v !== null)
    .map(([bk, v]) => [bk.replace(REAL_BACKUP_PREFIX, ''), v as string]);

  if (restorePairs.length > 0) {
    await AsyncStorage.multiSet(restorePairs);
  }

  // Remove keys that had NO value before the demo (so we leave a clean state)
  const keysWithBackup = new Set(backedUpKeys);
  const keysToRemove   = (DEMO_OVERWRITE_KEYS as unknown as string[]).filter(
    k => !keysWithBackup.has(k),
  );
  const cleanupKeys = [...keysToRemove, ...backupKeys, REAL_BACKUP_MANIFEST];
  await AsyncStorage.multiRemove(cleanupKeys);
}

// Indicator template (same 10 for all profiles, values shift)
type Severity = 'critical' | 'moderate' | 'acceptable' | 'strong';

const indicatorNames = [
  'Vocabulary Range',
  'Word Sophistication',
  'Sentence Length',
  'Subordination',
  'Syntactic Richness',
  'Speech Rate',
  'Fluency',
  'Coherence',
  'Grammar Accuracy',
  'Vocabulary Level',
] as const;

function severityFor(v: number): Severity {
  if (v < 45) return 'critical';
  if (v < 62) return 'moderate';
  if (v < 78) return 'acceptable';
  return 'strong';
}

function cefrFor(v: number): string {
  if (v < 25) return 'A1';
  if (v < 40) return 'A2';
  if (v < 55) return 'B1';
  if (v < 72) return 'B2';
  if (v < 85) return 'C1';
  return 'C2';
}

function buildIndicators(baseValues: number[]) {
  return indicatorNames.map((name, i) => ({
    name,
    value:      baseValues[i],
    normalized: baseValues[i],
    cefr_level: cefrFor(baseValues[i]),
    severity:   severityFor(baseValues[i]),
    sources:    ['Kolahi Ahari et al. (2025)'],
  }));
}

// Profile definitions

// WEAK: A2 → B1
//  original: score 32, current: score 46
const WEAK_ORIGINAL_VALS = [30, 25, 38, 28, 32, 48, 35, 30, 40, 32];
const WEAK_CURRENT_VALS  = WEAK_ORIGINAL_VALS.map(v => v + 14);

const WEAK_ORIGINAL = {
  predicted_cefr: 'A2',
  overall_score:  32,
  indicators: buildIndicators(WEAK_ORIGINAL_VALS),
  critical_areas: ['Word Sophistication', 'Subordination', 'Vocabulary Range', 'Coherence'],
  strengths: ['Speech Rate'],
  priority_recommendations: [
    'Start with B1 vocabulary using the Vocabulary Coach',
    'Practise forming longer sentences with subordinate clauses',
    'Focus on grammar accuracy — articles and prepositions',
  ],
  exam_specific_scores: { cambridge_cae: 28, toefl_ibt: 30, ielts_academic: 30 },
};

const WEAK_CURRENT = {
  predicted_cefr: 'B1',
  overall_score:  46,
  indicators: buildIndicators(WEAK_CURRENT_VALS),
  critical_areas: ['Word Sophistication', 'Subordination', 'Coherence'],
  strengths: ['Speech Rate', 'Vocabulary Level'],
  priority_recommendations: [
    'Continue B1→B2 vocabulary expansion',
    'Reduce filler words to improve Fluency score',
  ],
  exam_specific_scores: { cambridge_cae: 44, toefl_ibt: 46, ielts_academic: 43 },
};

// MEDIUM: B1 → B2  (original demo data, preserved exactly)
const MED_ORIGINAL_VALS = [45, 38, 55, 40, 50, 60, 52, 48, 55, 50];
const MED_CURRENT_VALS  = MED_ORIGINAL_VALS.map(v => v + 18);

const MED_ORIGINAL = {
  predicted_cefr: 'B1',
  overall_score:  50,
  indicators: buildIndicators(MED_ORIGINAL_VALS),
  critical_areas: ['Word Sophistication', 'Subordination', 'Coherence'],
  strengths: ['Speech Rate'],
  priority_recommendations: [
    'Practise C1-level vocabulary with the Vocabulary Coach',
    'Build longer sentences using subordinate clauses',
    'Use connectives (however, therefore, additionally) for cohesion',
  ],
  exam_specific_scores: { cambridge_cae: 52, toefl_ibt: 55, ielts_academic: 50 },
};

const MED_CURRENT = {
  predicted_cefr: 'B2',
  overall_score:  68,
  indicators: buildIndicators(MED_CURRENT_VALS),
  critical_areas: ['Word Sophistication'],
  strengths: ['Speech Rate', 'Fluency', 'Vocabulary Level'],
  priority_recommendations: [
    'Continue C1-level vocabulary practice',
    'Aim for Cambridge Advanced (CAE) — only 8 points to go',
  ],
  exam_specific_scores: { cambridge_cae: 70, toefl_ibt: 75, ielts_academic: 67 },
};

// STRONG: B2 → C1
const STRONG_ORIGINAL_VALS = [68, 62, 74, 70, 72, 80, 75, 70, 78, 72];
const STRONG_CURRENT_VALS  = STRONG_ORIGINAL_VALS.map(v => Math.min(98, v + 16));

const STRONG_ORIGINAL = {
  predicted_cefr: 'B2',
  overall_score:  72,
  indicators: buildIndicators(STRONG_ORIGINAL_VALS),
  critical_areas: ['Word Sophistication'],
  strengths: ['Speech Rate', 'Fluency', 'Grammar Accuracy', 'Coherence'],
  priority_recommendations: [
    'Target C2 vocabulary range to reach native-like precision',
    'Fine-tune prosody with Shadow Speaking',
  ],
  exam_specific_scores: { cambridge_cae: 74, toefl_ibt: 82, ielts_academic: 70 },
};

const STRONG_CURRENT = {
  predicted_cefr: 'C1',
  overall_score:  88,
  indicators: buildIndicators(STRONG_CURRENT_VALS),
  critical_areas: [],
  strengths: ['Speech Rate', 'Fluency', 'Grammar Accuracy', 'Coherence', 'Vocabulary Level'],
  priority_recommendations: [
    'Push into C2 — focus on idiomatic accuracy and register flexibility',
  ],
  exam_specific_scores: { cambridge_cae: 90, toefl_ibt: 108, ielts_academic: 87 },
};

// Session builders (parametric)

function buildCAF(startC: number, endC: number, startA: number, endA: number,
                  startF: number, endF: number, startCefr: string, endCefr: string) {
  const N = 12;
  return Array.from({ length: N }, (_, i) => ({
    ts:   tsBack(N - 1 - i),
    C:    ramp(startC, endC, N, i),
    A:    ramp(startA, endA, N, i),
    F:    ramp(startF, endF, N, i),
    cefr: i < Math.floor(N * 0.6) ? startCefr : endCefr,
    wps:  parseFloat((1.4 + i * 0.09).toFixed(2)),
  }));
}

function buildExam(startIelts: number, endIelts: number) {
  const N = 12;
  return Array.from({ length: N }, (_, i) => {
    const overall      = parseFloat((startIelts + (endIelts - startIelts) * (i / (N - 1))).toFixed(1));
    const overallRound = Math.round(overall * 2) / 2;
    return {
      ts: tsBack(N - 1 - i),
      ielts_overall: overallRound,
      cambridge_level: overallRound >= 7.0 ? 'C1' : overallRound >= 5.5 ? 'B2' : overallRound >= 4.0 ? 'B1' : 'A2',
      cambridge_exam:  overallRound >= 7.0 ? 'Cambridge Advanced (CAE)'
                     : overallRound >= 5.5 ? 'Cambridge First (FCE)'
                     : overallRound >= 4.0 ? 'Cambridge Preliminary (PET)'
                     : 'Cambridge Key (KET)',
      ielts: {
        fluency_coherence:    Math.min(9, parseFloat((startIelts * 0.95 + i * ((endIelts - startIelts) / N)).toFixed(1))),
        lexical_resource:     Math.min(9, parseFloat((startIelts * 1.05 + i * ((endIelts - startIelts) / N)).toFixed(1))),
        grammatical_accuracy: Math.min(9, parseFloat((startIelts * 0.90 + i * ((endIelts - startIelts) / N)).toFixed(1))),
        pronunciation:        Math.min(9, parseFloat((startIelts + i * ((endIelts - startIelts) / N) * 0.9).toFixed(1))),
        overall: overallRound,
        band_label: overallRound >= 7.0 ? 'Good user'
                  : overallRound >= 6.0 ? 'Competent user'
                  : overallRound >= 5.0 ? 'Modest user' : 'Limited user',
      },
    };
  });
}

function buildGrammar(startScore: number, endScore: number, startErrors: number, endErrors: number) {
  const N = 8;
  return Array.from({ length: N }, (_, i) => {
    const score  = ramp(startScore, endScore, N, i);
    const errors = Math.max(endErrors, Math.round(startErrors - (startErrors - endErrors) * (i / (N - 1))));
    return {
      ts:             tsBack(N - 1 - i),
      severity_score: score,
      error_count:    errors,
      categories: {
        articles:        errors > 4 ? 2 : errors > 2 ? 1 : 0,
        prepositions:    errors > 3 ? 2 : errors > 1 ? 1 : 0,
        word_order:      errors > 5 ? 1 : 0,
        double_negation: errors > 6 ? 1 : 0,
        false_friends:   errors > 4 ? 1 : 0,
        tense:           errors > 3 ? 1 : 0,
        collocations:    errors > 2 ? 1 : 0,
      },
    };
  });
}

const GENRE_PATTERN = [
  { dom: 'ACAD', sub: 'ACAD:Sci/Tech',     score: 70 },
  { dom: 'ACAD', sub: 'ACAD:Humanities',   score: 75 },
  { dom: 'NEWS', sub: 'NEWS:News_Natl',    score: 68 },
  { dom: 'NEWS', sub: 'NEWS:Editorial',    score: 72 },
  { dom: 'MAG',  sub: 'MAG:Sci/Tech',      score: 65 },
  { dom: 'ACAD', sub: 'ACAD:Education',    score: 78 },
  { dom: 'FIC',  sub: 'FIC:Gen (Book)',    score: 55 },
  { dom: 'SPOK', sub: 'SPOK:CNN',          score: 50 },
  { dom: 'MAG',  sub: 'MAG:Soc/Arts',      score: 60 },
  { dom: 'ACAD', sub: 'ACAD:Geog/SocSci',  score: 76 },
];

function buildGenre(scoreOffset: number) {
  return GENRE_PATTERN.map((g, i) => {
    const s = Math.min(98, g.score + scoreOffset);
    return {
      ts:                   tsBack(GENRE_PATTERN.length - 1 - i),
      dominant_genre:       g.dom,
      dominant_subcategory: g.sub,
      distribution: {
        SPOK: g.dom === 'SPOK' ? 35 : 10,
        FIC:  g.dom === 'FIC'  ? 32 : 8,
        MAG:  g.dom === 'MAG'  ? 30 : 12,
        NEWS: g.dom === 'NEWS' ? 28 : 12,
        ACAD: g.dom === 'ACAD' ? 38 : 15,
        Web: 8, Blog: 7, Mov: 4, TV: 4,
      },
      cefr_level:  s >= 70 ? 'B2' : 'B1',
      cefr_score:  s,
      input_mode: (i % 3 === 0 ? 'writing' : 'speaking') as 'writing' | 'speaking',
    };
  });
}

// Learner profile snapshots

const LEARNER_PROFILES = {
  weak: {
    user_id: 'anonymous',
    current_level: 'beginner' as const,
    learning_pace: 'slow' as const,
    phoneme_stats: [],
    total_sessions: 12,
    average_accuracy: 48,
    total_words_practiced: 180,
    weak_phonemes: ['θ', 'ð', 'æ'],
    strong_phonemes: ['m', 'n', 'p'],
    learning_velocity: 1.5,
    accuracy_trend: -2,
    preferred_modality: 'auditory' as const,
    session_duration: 20,
    created_at: new Date(tsBack(90)).toISOString(),
    last_updated: new Date(tsBack(1)).toISOString(),
    last_session: new Date(tsBack(1)).toISOString(),
  },
  medium: {
    user_id: 'anonymous',
    current_level: 'intermediate' as const,
    learning_pace: 'normal' as const,
    phoneme_stats: [],
    total_sessions: 22,
    average_accuracy: 72,
    total_words_practiced: 520,
    weak_phonemes: ['θ', 'ð'],
    strong_phonemes: ['m', 'n', 'p', 'b', 'd'],
    learning_velocity: 2.4,
    accuracy_trend: 3,
    preferred_modality: 'auditory' as const,
    session_duration: 20,
    created_at: new Date(tsBack(90)).toISOString(),
    last_updated: new Date(tsBack(1)).toISOString(),
    last_session: new Date(tsBack(1)).toISOString(),
  },
  strong: {
    user_id: 'anonymous',
    current_level: 'advanced' as const,
    learning_pace: 'fast' as const,
    phoneme_stats: [],
    total_sessions: 38,
    average_accuracy: 88,
    total_words_practiced: 1240,
    weak_phonemes: ['θ'],
    strong_phonemes: ['m', 'n', 'p', 'b', 'd', 'f', 'v', 'k', 'g'],
    learning_velocity: 4.8,
    accuracy_trend: 6,
    preferred_modality: 'auditory' as const,
    session_duration: 20,
    created_at: new Date(tsBack(90)).toISOString(),
    last_updated: new Date(tsBack(1)).toISOString(),
    last_session: new Date(tsBack(1)).toISOString(),
  },
};

const RT_STATS = {
  weak: {
    avg_rt_ms: 1850, cv: 0.42,
    trend: [2200, 2100, 2000, 1950, 1900, 1850],
    total_responses: 72,
    interpretation: 'Still building automaticity — response times are high. Consistent vocabulary drills will gradually speed up word recognition.',
    research: 'DeKeyser & Suzuki (2025): procedural knowledge becomes automatic through repeated practice.',
  },
  medium: {
    avg_rt_ms: 1320, cv: 0.28,
    trend: [1650, 1580, 1500, 1420, 1360, 1320],
    total_responses: 186,
    interpretation: 'Good progress — responses are becoming faster and more consistent. You are in the consolidation phase.',
    research: 'DeKeyser & Suzuki (2025): Skill Acquisition Theory predicts gradual automatization through practice.',
  },
  strong: {
    avg_rt_ms: 890, cv: 0.15,
    trend: [1100, 1050, 980, 930, 900, 890],
    total_responses: 312,
    interpretation: 'Excellent automaticity — fast, consistent responses indicate well-consolidated vocabulary knowledge (< 1000 ms threshold).',
    research: 'DeKeyser & Suzuki (2025): sub-1000 ms with CV < 0.20 indicates automatized lexical access.',
  },
};

const SRS_STATES = {
  weak:   { due_count: 8,  learning_count: 15, mastered_count: 4,   new_count: 45, total_bank: 72  },
  medium: { due_count: 3,  learning_count: 28, mastered_count: 42,  new_count: 18, total_bank: 91  },
  strong: { due_count: 1,  learning_count: 12, mastered_count: 108, new_count: 5,  total_bank: 126 },
};

// Shadow speaking sessions

const SHADOW_CATEGORIES = ['Daily Conversation', 'News Report', 'Academic Lecture', 'Business Meeting'];
const SHADOW_DIFFICULTIES = ['B1', 'B2', 'C1'] as const;

const SHADOW_TARGETS = [
  'The weather has been unusually warm for this time of year, and many people are enjoying outdoor activities.',
  'Scientists have discovered a new species of deep-sea fish that can produce its own light using bioluminescence.',
  'The committee will meet on Thursday to discuss the proposed changes to the annual budget allocations.',
  'Research suggests that learning a second language can significantly improve cognitive flexibility and memory.',
  'The local government announced plans to expand public transportation in order to reduce traffic congestion.',
  'She carefully explained the procedure to the medical students, emphasizing the importance of precision.',
];

const TRANSCRIBED_WEAK = [
  'The weather has been unusually warm for this time of year and many people enjoying outdoor activities.',
  'Scientists have discover a new species of deep sea fish that can produce its own light.',
  'The committee will meet on Thursday to discuss proposed changes to the annual budget.',
  'Research suggest that learning a second language can improve cognitive flexibility and memory.',
  'The local government announced plans to expand public transportation to reduce traffic.',
  'She carefully explained the procedure to the medical students about importance of precision.',
];

const TRANSCRIBED_MEDIUM = [
  'The weather has been unusually warm for this time of year, and many people are enjoying outdoor activities.',
  'Scientists have discovered a new species of deep-sea fish that can produce its own light using bioluminescence.',
  'The committee will meet on Thursday to discuss the proposed changes to the annual budget allocations.',
  'Research suggests that learning a second language can significantly improve cognitive flexibility and memory.',
  'The local government announced plans to expand public transportation to reduce traffic congestion.',
  'She carefully explained the procedure to the medical students, emphasizing the importance of precision.',
];

function buildShadow(
  scores: number[],
  difficulties: (typeof SHADOW_DIFFICULTIES)[number][],
  transcribed: string[],
) {
  const N = scores.length;
  return Array.from({ length: N }, (_, i) => ({
    ts: tsBack(N - 1 - i),
    category: SHADOW_CATEGORIES[i % SHADOW_CATEGORIES.length],
    difficulty: difficulties[i % difficulties.length],
    score: scores[i],
    target_text: SHADOW_TARGETS[i % SHADOW_TARGETS.length],
    transcribed: transcribed[i % transcribed.length],
  }));
}

const SHADOW_SESSIONS = {
  weak:   buildShadow([42, 38, 45, 50, 47, 52], ['B1', 'B1', 'B1', 'B2', 'B1', 'B2'], TRANSCRIBED_WEAK),
  medium: buildShadow([65, 70, 68, 74, 72, 78], ['B1', 'B2', 'B2', 'B2', 'B2', 'C1'], TRANSCRIBED_MEDIUM),
  strong: buildShadow([84, 88, 86, 90, 92, 89], ['B2', 'C1', 'C1', 'C1', 'C1', 'C1'], TRANSCRIBED_MEDIUM),
};

// Persona shadow sessions (with real audio recordings)
// Each persona has 2 recordings stored in assets/audio. The audio_id field
// resolves to a bundled MP3 at playback time (see constants/demoAudio.ts).

type PersonaShadow = {
  ts: number;
  category: string;
  difficulty: string;
  score: number;
  target_text: string;
  transcribed: string;
  audio_id: string;
};

const PERSONA_SHADOW_SESSIONS: Record<JobPreset, PersonaShadow[]> = {
  ana: [
    {
      ts: tsBack(2), category: 'Daily Conversation', difficulty: 'B1', score: 44,
      target_text: 'Scientists have discovered a new species of deep-sea fish that can produce its own light.',
      transcribed: 'Scientists have discover a new species of deep sea fish that can produce its own light.',
      audio_id: 'ana_shadow_1',
    },
    {
      ts: tsBack(5), category: 'Daily Conversation', difficulty: 'B1', score: 36,
      target_text: 'She carefully explained the procedure to the medical students about the importance of precision.',
      transcribed: 'She carefully explain the procedure to the medical students about importance of precision.',
      audio_id: 'ana_shadow_2',
    },
  ],
  mihai: [
    {
      ts: tsBack(2), category: 'Academic Lecture', difficulty: 'B2', score: 78,
      target_text: 'Scientists have discovered a new species of deep-sea fish that can produce its own light using bioluminescence.',
      transcribed: 'Scientists have discovered a new species of deep-sea fish that can produce its own light using bioluminescence.',
      audio_id: 'mihai_shadow_1',
    },
    {
      ts: tsBack(5), category: 'News Report', difficulty: 'B2', score: 68,
      target_text: 'Research suggests that learning a second language can improve cognitive flexibility and memory.',
      transcribed: 'Research suggests that learning a second language can improve cognitive flexibility and memory.',
      audio_id: 'mihai_shadow_2',
    },
  ],
  elena: [
    {
      ts: tsBack(2), category: 'Business Meeting', difficulty: 'B2', score: 84,
      target_text: 'The committee will meet on Thursday to discuss the proposed changes to the annual budget allocations.',
      transcribed: 'The committee will meet on Thursday to discuss the proposed changes to the annual budget allocations.',
      audio_id: 'elena_shadow_1',
    },
    {
      ts: tsBack(5), category: 'News Report', difficulty: 'C1', score: 79,
      target_text: 'The local government announced plans to expand public transportation in order to reduce traffic congestion.',
      transcribed: 'The local government announced plans to expand public transportation in order to reduce traffic congestion.',
      audio_id: 'elena_shadow_2',
    },
  ],
  radu: [
    {
      ts: tsBack(2), category: 'News Report', difficulty: 'C1', score: 94,
      target_text: 'The committee will meet on Thursday to discuss the proposed changes to the annual budget allocations.',
      transcribed: 'The committee will meet on Thursday to discuss the proposed changes to the annual budget allocations.',
      audio_id: 'radu_shadow_1',
    },
    {
      ts: tsBack(5), category: 'Academic Lecture', difficulty: 'C1', score: 90,
      target_text: 'Research suggests that learning a second language can significantly improve cognitive flexibility and memory.',
      transcribed: 'Research suggests that learning a second language can significantly improve cognitive flexibility and memory.',
      audio_id: 'radu_shadow_2',
    },
  ],
  sorin: [
    {
      ts: tsBack(2), category: 'Daily Conversation', difficulty: 'B1', score: 70,
      target_text: 'The weather has been unusually warm for this time of year, and many people are enjoying outdoor activities.',
      transcribed: 'The weather has been unusually warm for this time of year, and many people are enjoying outdoor activities.',
      audio_id: 'sorin_shadow_1',
    },
    {
      ts: tsBack(5), category: 'Business Meeting', difficulty: 'B2', score: 64,
      target_text: 'The local government announced plans to expand public transportation to reduce traffic congestion.',
      transcribed: 'The local government announced plans to expand public transportation to reduce traffic congestion.',
      audio_id: 'sorin_shadow_2',
    },
  ],
  diana: [
    {
      ts: tsBack(2), category: 'Business Meeting', difficulty: 'B2', score: 85,
      target_text: 'The committee will meet on Thursday to discuss the proposed changes to the annual budget allocations.',
      transcribed: 'The committee will meet on Thursday to discuss the proposed changes to the annual budget allocations.',
      audio_id: 'diana_shadow_1',
    },
    {
      ts: tsBack(5), category: 'Academic Lecture', difficulty: 'C1', score: 80,
      target_text: 'Scientists have discovered a new species of deep-sea fish that can produce its own light using bioluminescence.',
      transcribed: 'Scientists have discovered a new species of deep-sea fish that can produce its own light using bioluminescence.',
      audio_id: 'diana_shadow_2',
    },
  ],
};

// Profile assembly

const PROFILES = {
  weak: {
    original: WEAK_ORIGINAL,
    current:  WEAK_CURRENT,
    caf:      buildCAF(25, 42, 35, 54, 30, 48, 'A2', 'B1'),
    exam:     buildExam(3.0, 4.5),
    grammar:  buildGrammar(42, 68, 8, 3),
    genre:    buildGenreFromJob('marketing-manager', 45),
    exam_goal: 'cambridge_pet',
    goal:      'pronunciation',
    jobId:    'marketing-manager',
    industry: 'sales_marketing',
  },
  medium: {
    original: MED_ORIGINAL,
    current:  MED_CURRENT,
    caf:      buildCAF(45, 70, 60, 84, 55, 78, 'B1', 'B2'),
    exam:     buildExam(4.5, 7.0),
    grammar:  buildGrammar(58, 86, 5, 1),
    genre:    buildGenreFromJob('software-engineer', 65),
    exam_goal: 'cambridge_cae',
    goal:      'vocabulary',
    jobId:    'software-engineer',
    industry: 'tech',
  },
  strong: {
    original: STRONG_ORIGINAL,
    current:  STRONG_CURRENT,
    caf:      buildCAF(70, 88, 78, 93, 72, 90, 'B2', 'C1'),
    exam:     buildExam(6.5, 8.0),
    grammar:  buildGrammar(80, 96, 2, 0),
    genre:    buildGenreFromJob('lawyer', 85),
    exam_goal: 'cambridge_cpe',
    goal:      'fluency',
    jobId:    'lawyer',
    industry: 'law_government',
  },
} as const;

// Job-based user blueprints (6 fictional users)

export interface JobUserBlueprint {
  name: string;
  age: number;
  avatar: string;        // emoji
  bio: string;           // 1-line description for picker
  rangeLabel: string;    // "A2 → B1"

  // Onboarding answers
  jobId: string;
  industry: Industry;
  cefr: string;           // current CEFR self-assessment
  primaryGoal: string;
  domain: string;
  targetExam: string;
  weaknesses: string[];
  intensity: string;

  // Diagnosis numbers
  originalValues: number[];   // 10 indicator values (baseline)
  currentValues:  number[];   // 10 indicator values (now)
  cefrOriginal: string;
  cefrCurrent:  string;
}

export const JOB_USERS: Record<JobPreset, JobUserBlueprint> = {
  ana: {
    name: 'Ana', age: 22, avatar: '‍',
    bio: 'Medical student — beginner, just starting English',
    rangeLabel: 'A1 → A2',
    jobId: 'physician', industry: 'healthcare',
    cefr: 'A1', primaryGoal: 'grammar', domain: 'academic',
    targetExam: 'ielts_academic',
    weaknesses: ['grammar', 'vocabulary'], intensity: 'medium',
    originalValues: [18, 14, 24, 16, 20, 32, 22, 18, 26, 20],
    currentValues:  [30, 26, 36, 28, 32, 44, 34, 30, 38, 32],
    cefrOriginal: 'A1', cefrCurrent: 'A2',
  },
  mihai: {
    name: 'Mihai', age: 28, avatar: '‍',
    bio: 'Senior dev — better PR descriptions and tech writing',
    rangeLabel: 'B1 → B2',
    jobId: 'software-engineer', industry: 'tech',
    cefr: 'B1', primaryGoal: 'vocabulary', domain: 'argumentation',
    targetExam: 'cambridge_cae',
    weaknesses: ['vocabulary', 'complexity'], intensity: 'high',
    originalValues: [44, 38, 55, 40, 48, 60, 52, 46, 55, 50],
    currentValues:  [62, 55, 70, 58, 65, 75, 68, 62, 70, 65],
    cefrOriginal: 'B1', cefrCurrent: 'B2',
  },
  elena: {
    name: 'Elena', age: 31, avatar: '‍',
    bio: 'Corporate lawyer drafting cross-border contracts',
    rangeLabel: 'B2 → C1',
    jobId: 'lawyer', industry: 'law_government',
    cefr: 'B2', primaryGoal: 'coherence', domain: 'argumentation',
    targetExam: 'cambridge_cae',
    weaknesses: ['coherence', 'complexity'], intensity: 'high',
    originalValues: [62, 58, 68, 64, 65, 72, 68, 65, 72, 65],
    currentValues:  [78, 72, 82, 80, 78, 82, 78, 80, 84, 78],
    cefrOriginal: 'B2', cefrCurrent: 'C1',
  },
  radu: {
    name: 'Radu', age: 26, avatar: '‍',
    bio: 'Journalist targeting international wire services',
    rangeLabel: 'C1 → C2',
    jobId: 'journalist', industry: 'media',
    cefr: 'C1', primaryGoal: 'fluency', domain: 'narration',
    targetExam: 'cambridge_cpe',
    weaknesses: ['fluency', 'pronunciation'], intensity: 'high',
    originalValues: [72, 65, 78, 72, 75, 82, 78, 72, 80, 75],
    currentValues:  [88, 84, 90, 88, 88, 92, 90, 88, 90, 88],
    cefrOriginal: 'C1', cefrCurrent: 'C2',
  },
  sorin: {
    name: 'Sorin', age: 35, avatar: '‍',
    bio: 'Marketing manager pitching to international clients',
    rangeLabel: 'B1 → B2',
    jobId: 'marketing-manager', industry: 'sales_marketing',
    cefr: 'B1', primaryGoal: 'pronunciation', domain: 'argumentation',
    targetExam: 'ielts_general',
    weaknesses: ['pronunciation', 'fluency'], intensity: 'medium',
    originalValues: [42, 35, 52, 40, 45, 58, 50, 44, 55, 48],
    currentValues:  [60, 52, 65, 55, 60, 72, 65, 60, 68, 62],
    cefrOriginal: 'B1', cefrCurrent: 'B2',
  },
  diana: {
    name: 'Diana', age: 24, avatar: '‍',
    bio: 'Financial analyst climbing the corporate ladder',
    rangeLabel: 'B2 → C1',
    jobId: 'financial-analyst', industry: 'finance',
    cefr: 'B2', primaryGoal: 'complexity', domain: 'academic',
    targetExam: 'cambridge_cae',
    weaknesses: ['complexity', 'vocabulary'], intensity: 'high',
    originalValues: [65, 58, 70, 62, 68, 72, 70, 68, 75, 68],
    currentValues:  [80, 75, 85, 78, 82, 80, 78, 80, 82, 80],
    cefrOriginal: 'B2', cefrCurrent: 'C1',
  },
};

// Job profile builders

function avgOf(arr: number[]): number {
  return Math.round(arr.reduce((a, b) => a + b, 0) / arr.length);
}

function userTier(u: JobUserBlueprint): DemoPreset {
  const score = avgOf(u.currentValues);
  if (score < 55) return 'weak';
  if (score < 75) return 'medium';
  return 'strong';
}

function buildDiagnosisFor(u: JobUserBlueprint, which: 'original' | 'current') {
  const vals = which === 'current' ? u.currentValues : u.originalValues;
  const score = avgOf(vals);
  const cefr  = which === 'current' ? u.cefrCurrent : u.cefrOriginal;
  const indicators = buildIndicators(vals);

  const critical = indicators
    .filter(i => i.severity === 'critical' || i.severity === 'moderate')
    .slice(0, 4)
    .map(i => i.name);
  const strengths = indicators
    .filter(i => i.severity === 'strong')
    .slice(0, 3)
    .map(i => i.name);

  return {
    predicted_cefr: cefr,
    overall_score: score,
    indicators,
    critical_areas: critical,
    strengths,
    priority_recommendations: [
      `Focus on ${u.primaryGoal} for your role as ${JOBS_BY_ID[u.jobId]?.title ?? 'professional'}`,
      `Practise ${u.domain} tasks to reach ${u.cefrCurrent}`,
      `Aim for ${u.targetExam.replace('_', ' ').toUpperCase()}`,
    ],
    exam_specific_scores: {
      cambridge_cae: Math.max(20, score - 4),
      toefl_ibt:     Math.max(20, score + 2),
      ielts_academic: Math.max(20, score - 6),
    },
  };
}

/**
 * Build genre sessions reflecting the user's job — sessions are dominated by
 * the job's essential COCA subgenres, with a few "important" ones mixed in.
 */
function buildGenreFromJob(jobId: string, scoreBase: number): any[] {
  const job = JOBS_BY_ID[jobId];
  if (!job) return [];
  // Demo learners have PARTIAL exposure — not a finished syllabus. They've
  // practised their secondary (important) registers plus about half of their
  // core (essential) registers; the remaining essentials stay as visible gaps.
  // This is what makes the Coverage Map meaningful: without leaving gaps, every
  // JOB code would count as "covered", so the JOB∩EXAM∩GOAL centre (URGENT)
  // could never contain an un-covered subgenre and would always read 0.
  const practisedEssential = job.essential.filter((_, i) => i % 2 === 0);
  const codes = [...practisedEssential, ...job.important];

  return codes.map((code, i) => {
    const [dom] = code.split(':');
    // Deterministic pseudo-random variation
    const noise = ((i * 7) % 11) - 5;
    const score = Math.max(35, Math.min(95, scoreBase + noise));

    const distribution: Record<string, number> = {
      SPOK: 8, FIC: 6, MAG: 10, NEWS: 10, ACAD: 12, Web: 8, Blog: 7, Mov: 4, TV: 4,
    };
    // Boost the dominant domain
    distribution[dom] = 38;

    return {
      ts: tsBack(codes.length - 1 - i),
      dominant_genre: dom,
      dominant_subcategory: code,
      distribution,
      cefr_level: score >= 70 ? 'B2' : score >= 55 ? 'B1' : 'A2',
      cefr_score: score,
      input_mode: (i % 3 === 0 ? 'writing' : 'speaking') as 'writing' | 'speaking',
    };
  });
}

function buildJobProfile(preset: JobPreset) {
  const u = JOB_USERS[preset];
  const tier = userTier(u);
  const currentScore = avgOf(u.currentValues);
  const originalScore = avgOf(u.originalValues);

  // CAF parametrised by user's tier (rough boundaries)
  const cafStart = Math.max(15, originalScore - 15);
  const cafEnd   = Math.min(98, currentScore + 5);
  const caf = buildCAF(
    cafStart, cafEnd,             // Complexity
    cafStart + 5, cafEnd + 5,     // Accuracy
    cafStart + 3, cafEnd + 3,     // Fluency
    u.cefrOriginal, u.cefrCurrent,
  );

  // IELTS overall: map score → band  (rough proportional mapping)
  const ieltsStart = Math.max(2.0, originalScore / 100 * 9);
  const ieltsEnd   = Math.max(ieltsStart + 0.5, Math.min(9.0, currentScore / 100 * 9));
  const exam = buildExam(ieltsStart, ieltsEnd);

  // Grammar: severity_score grows with proficiency, errors drop
  const grammar = buildGrammar(
    Math.max(30, originalScore - 5),
    Math.min(98, currentScore + 5),
    Math.max(2, 12 - Math.round(originalScore / 10)),
    Math.max(0,  8 - Math.round(currentScore / 12)),
  );

  return {
    user: u,
    original: buildDiagnosisFor(u, 'original'),
    current:  buildDiagnosisFor(u, 'current'),
    caf,
    exam,
    grammar,
    genre: buildGenreFromJob(u.jobId, currentScore),
    shadow: PERSONA_SHADOW_SESSIONS[preset],
    learner_profile: {
      ...LEARNER_PROFILES[tier],
      total_words_practiced: LEARNER_PROFILES[tier].total_words_practiced,
    },
    rt_stats: RT_STATS[tier],
    srs_state: SRS_STATES[tier],
    exam_goal: u.targetExam,
    goal: u.primaryGoal,
  };
}

const JOB_PROFILES = {
  ana:    buildJobProfile('ana'),
  mihai:  buildJobProfile('mihai'),
  elena:  buildJobProfile('elena'),
  radu:   buildJobProfile('radu'),
  sorin:  buildJobProfile('sorin'),
  diana:  buildJobProfile('diana'),
} as const;

// Public API

function isJobPreset(p: AnyPreset): p is JobPreset {
  return p === 'ana' || p === 'mihai' || p === 'elena' || p === 'radu' || p === 'sorin' || p === 'diana';
}

export async function loadDemoProfile(preset: AnyPreset): Promise<void> {
  // Back up the real user's data before the first demo load.
  // If a demo is already active (switching between presets), the backup
  // from the first load is preserved — we don't overwrite it.
  await _backupRealData();

  if (isJobPreset(preset)) {
    const p = JOB_PROFILES[preset];
    const u = p.user;
    const writes: Array<[string, string]> = [
      ['baselineDiagnosis',         JSON.stringify(p.current)],
      ['baselineDiagnosisOriginal', JSON.stringify(p.original)],
      ['vf_caf_sessions',           JSON.stringify(p.caf)],
      ['vf_exam_sessions',          JSON.stringify(p.exam)],
      ['vf_grammar_sessions',       JSON.stringify(p.grammar)],
      ['vf_genre_sessions',         JSON.stringify(p.genre)],
      ['vf_shadow_sessions',        JSON.stringify(p.shadow)],
      ['vf_accent_sessions',        JSON.stringify(accentSessionsFor(preset))],
      ['vf_vocab_sessions',         JSON.stringify(vocabSessionsFor(preset))],
      ['vf_phoneme_scores',         JSON.stringify(phonemeScoresFor(preset))],
      ['userTargetExam',            p.exam_goal],
      ['userPrimaryGoal',           p.goal],
      ['userJob',                   u.jobId],
      ['userIndustry',              u.industry],
      ['userCurrentCEFR',           u.cefr],
      ['userDomain',                u.domain],
      ['userIntensity',             u.intensity],
      ['userWeaknesses',            JSON.stringify(u.weaknesses)],
      ['userDisplayName',           u.name],
      ['onboardingCompleted',       'true'],
      ['diagnosticCompleted',       'true'],
      ['active_demo_preset',        preset],
      ['learner_profile_anonymous', JSON.stringify(p.learner_profile)],
      ['demo_rt_stats',             JSON.stringify(p.rt_stats)],
      ['demo_srs_state',            JSON.stringify(p.srs_state)],
    ];
    await Promise.all(writes.map(([k, v]) => AsyncStorage.setItem(k, v)));
    return;
  }

  const p = PROFILES[preset];
  const writes: Array<[string, string]> = [
    ['baselineDiagnosis',         JSON.stringify(p.current)],
    ['baselineDiagnosisOriginal', JSON.stringify(p.original)],
    ['vf_caf_sessions',           JSON.stringify(p.caf)],
    ['vf_exam_sessions',          JSON.stringify(p.exam)],
    ['vf_grammar_sessions',       JSON.stringify(p.grammar)],
    ['vf_genre_sessions',         JSON.stringify(p.genre)],
    ['userTargetExam',            p.exam_goal],
    ['userPrimaryGoal',           p.goal],
    ['userJob',                   p.jobId],
    ['userIndustry',              p.industry],
    ['onboardingCompleted',       'true'],
    ['diagnosticCompleted',       'true'],
    ['active_demo_preset',        preset],
    ['learner_profile_anonymous', JSON.stringify(LEARNER_PROFILES[preset])],
    ['demo_rt_stats',             JSON.stringify(RT_STATS[preset])],
    ['demo_srs_state',            JSON.stringify(SRS_STATES[preset])],
    ['vf_shadow_sessions',        JSON.stringify(SHADOW_SESSIONS[preset])],
    ['vf_accent_sessions',        JSON.stringify(accentSessionsFor(preset))],
    ['vf_vocab_sessions',         JSON.stringify(vocabSessionsFor(preset))],
    ['vf_phoneme_scores',         JSON.stringify(phonemeScoresFor(preset))],
  ];
  await Promise.all(writes.map(([k, v]) => AsyncStorage.setItem(k, v)));
}

/** Legacy alias — loads the medium profile */
export async function loadDemoData(): Promise<void> {
  return loadDemoProfile('medium');
}

export async function clearDemoData(): Promise<void> {
  // Restore the real user's data from backup (if any) before clearing demo.
  // _restoreRealData also removes the backup keys after restoring.
  await _restoreRealData();

  // Remove the demo flag and any remaining demo-only keys that were never
  // backed up (i.e. keys the real user never had before the demo).
  // Note: DEMO_OVERWRITE_KEYS were already handled by _restoreRealData;
  // we only need to clear the demo flag and per-demo extras here.
  await AsyncStorage.removeItem('active_demo_preset');
}

export async function getActiveDemoPreset(): Promise<AnyPreset | null> {
  const v = await AsyncStorage.getItem('active_demo_preset');
  if (v === 'weak' || v === 'medium' || v === 'strong') return v;
  if (v === 'ana' || v === 'mihai' || v === 'elena' ||
      v === 'radu' || v === 'sorin' || v === 'diana') return v;
  return null;
}

/** Returns true if the active demo is one of the 6 job-based profiles. */
export async function isActiveJobDemo(): Promise<boolean> {
  const v = await getActiveDemoPreset();
  return v !== null && isJobPreset(v);
}

/** Pretty list of job demo users for picker UI. */
export function getJobDemoUsers(): Array<{ key: JobPreset; user: JobUserBlueprint }> {
  return (Object.keys(JOB_USERS) as JobPreset[]).map(key => ({
    key,
    user: JOB_USERS[key],
  }));
}
