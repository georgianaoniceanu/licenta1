/**
 * Pre-saved practice sessions for the demo users, per module.
 *
 *   Accent DNA  → vf_accent_sessions   (AccentSession[])
 *   Vocabulary  → vf_vocab_sessions    (VocabSession[])
 *   Shadow      → vf_shadow_sessions    (handled in demoMode.ts)
 *
 * Each demo persona gets a handful of realistic, level-appropriate sessions so
 * that opening a module already shows "words/phrases I practised" with results
 * I can tap into. Real users append to the same keys as they practise.
 */

import type { AnyPreset } from './demoMode';

// ── Types ────────────────────────────────────────────────────────────────────
export type WordBreakdown = { word: string; correct: number; total: number; ok: boolean };

/** Full Accent DNA feedback (matches the Feedback type rendered in accent.tsx). */
export type AccentFeedback = {
  accuracy_score: number;
  transcribed_text: string;
  problematic_phonemes: { phoneme: string; example: string; severity: string }[];
  suggestions: { issue: string; fix: string }[];
  overall_feedback: string;
  alignment: { expected: string; produced: string; ok: boolean }[];
  word_breakdown: WordBreakdown[];
  engine: string;
  intelligibility_only: boolean;
};

export type AccentSession = {
  ts: number;
  target_text: string;
  accuracy_score: number;
  problematic_phonemes: string[];   // bare glyphs, for the card meta
  exercisePhoneme?: string;         // maps to a PHONEME_EXERCISES key
  audioId?: string;                 // bundled recording (cloned voice)
  feedback: AccentFeedback;         // full result for the results view
};

export type VocabHighlight = { word: string; level: string };
export type VocabSuggestion = { original: string; better: string; why: string };

export type VocabMode = 'record' | 'type' | 'upload';

/** A saved Vocabulary session: card metadata + a FULL result for the Results screen. */
export type VocabSession = {
  ts: number;
  topic: string;
  promptId: number;
  mode: VocabMode;       // record (speaking) / type / upload (audio)
  text: string;          // the answer that was analysed
  level: string;         // overall CEFR (card)
  score: number;         // overall 0-100 (card bubble)
  audioId?: string;      // bundled recording id (speaking/upload sessions)
  result: any;           // full AnalysisResult-compatible object (Results screen)
};

// ── Helpers ──────────────────────────────────────────────────────────────────
const DAY = 86_400_000;
const daysAgo = (n: number) => Date.now() - n * DAY;

/** Build a deterministic per-word breakdown where ~score% of words are "ok". */
function wb(text: string, score: number): WordBreakdown[] {
  const words = text.replace(/[.,!?;:"']/g, '').split(/\s+/).filter(Boolean);
  return words.map((w, i) => {
    const total = Math.max(1, Math.round(w.length / 2));
    const r = (i * 37 + w.length * 13 + 7) % 100;     // deterministic spread
    const ok = r < score;
    return { word: w, total, correct: ok ? total : Math.max(0, total - 1), ok };
  });
}

const PROBLEM_EXAMPLE: Record<string, string> = {
  'θ': 'think, three, both', 'ð': 'this, the, mother', 'v': 'very, save, vein',
  'w': 'we, worth, would', 'ɪ': 'ship, it, this', 'i': 'sheep, see, need',
  'æ': 'cat, bad, apple', 'ʌ': 'cup, but, money', 'ŋ': 'sing, thing, going',
  'ə': 'about, sofa, the', 'z': 'zoo, is, easy', 'ɔ': 'thought, more, north',
  'r': 'red, very, story', 'ɜ': 'bird, work, learn', 'ʒ': 'measure, vision',
};
const PROBLEM_FIX: Record<string, string> = {
  'θ': 'Put your tongue between your teeth and push air out — don\'t replace it with /t/.',
  'ð': 'Voice "th" with the tongue between the teeth — avoid the Romanian /d/.',
  'v': 'Bite your lower lip lightly and voice it — keep it distinct from /w/.',
  'w': 'Round your lips without touching your teeth — keep it distinct from /v/.',
  'ɪ': 'Keep it short and lax — don\'t lengthen it into /iː/.',
  'i': 'Hold the long /iː/ and smile slightly — longer than /ɪ/.',
  'æ': 'Open your mouth wider and lower the jaw for /æ/.',
  'ʌ': 'Relax to a short, central vowel — avoid the Romanian /a/.',
  'ŋ': 'Let the sound resonate in the nose; don\'t add a hard /g/.',
  'ə': 'Reduce unstressed vowels to a relaxed schwa.',
  'z': 'Voice the /z/ — buzz it, don\'t devoice to /s/.',
  'ɔ': 'Round the lips for the open /ɔː/.',
  'r': 'Curl the tongue back without tapping — avoid the Romanian rolled /r/.',
  'ɜ': 'A central, long vowel with neutral lips.',
  'ʒ': 'A soft "zh" — voice it gently.',
};
const PROBLEM_TO_EXERCISE: Record<string, string> = {
  'θ': '/θ/', 'ð': '/ð/', 'ŋ': '/ŋ/', 'ə': '/ə/', 'ʌ': '/ʌ/',
  'æ': '/æ/-/ɑ:/', 'ɪ': '/i:/-/ɪ/', 'i': '/i:/-/ɪ/', 'u': '/u:/-/ʊ/', 'ʊ': '/u:/-/ʊ/',
};

function accent(daysBack: number, text: string, score: number, problems: string[], audioId?: string): AccentSession {
  const severity = score >= 80 ? 'low' : score >= 60 ? 'medium' : 'high';
  const overall =
    score >= 85 ? 'Excellent control of the target sounds — your rhythm and clarity are near native-like. Keep maintaining these contrasts.'
    : score >= 70 ? 'Good job — most sounds were clear. Focus on the highlighted phonemes to push toward native-like accuracy.'
    : score >= 55 ? 'Understandable, but several Romanian-transfer substitutions remain. Drill the highlighted sounds with minimal pairs.'
    : 'Several target sounds were substituted (typical L1 transfer). Slow down and practise the highlighted phonemes one at a time.';

  const feedback: AccentFeedback = {
    accuracy_score: score,
    transcribed_text: text,
    problematic_phonemes: problems.map((p) => ({
      phoneme: `/${p}/`,
      example: PROBLEM_EXAMPLE[p] || `words with /${p}/`,
      severity,
    })),
    suggestions: problems.slice(0, 3).map((p) => ({
      issue: `The /${p}/ sound was unclear`,
      fix: PROBLEM_FIX[p] || `Practise minimal pairs that contrast /${p}/.`,
    })),
    overall_feedback: overall,
    alignment: [{ expected: text, produced: text, ok: true }],  // non-empty → readable "phoneme" path
    word_breakdown: wb(text, score),
    engine: 'wav2vec2-espeak (phoneme recognition)',
    intelligibility_only: false,
  };

  return {
    ts: daysAgo(daysBack),
    target_text: text,
    accuracy_score: score,
    problematic_phonemes: problems,
    exercisePhoneme: problems.map((p) => PROBLEM_TO_EXERCISE[p]).find(Boolean),
    audioId,
    feedback,
  };
}

// ── Full Vocabulary result builder ───────────────────────────────────────────
// Produces a complete AnalysisResult-compatible object so a saved session opens
// the full Results screen (Words / Speaking / Phonetics / Exercise / Grammar /
// Exam tabs + metrics + improved version), exactly like a fresh analysis.

const PROMPT_ID: Record<string, number> = {
  'Hobby & Interests': 1, 'Travel Experience': 2, 'Career Goals': 3, 'Daily Routine': 4,
  'Learning a Skill': 5, 'Personal Achievement': 6, 'Global Issue': 7, 'Technology Impact': 8,
  'An Important Relationship': 9, 'Future Plans': 10,
};

const LEVEL_ORDER = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

function ieltsBand(score: number): number {
  const b = Math.max(2, Math.min(9, score / 100 * 9));
  return Math.round(b * 2) / 2;          // nearest 0.5
}
function bandLabel(b: number): string {
  if (b >= 8.5) return 'Expert User';
  if (b >= 7.5) return 'Very Good User';
  if (b >= 6.5) return 'Competent User';
  if (b >= 5.5) return 'Modest User';
  if (b >= 4.5) return 'Limited User';
  return 'Basic User';
}

type VocabSpec = {
  daysBack: number;
  topic: string;
  mode: VocabMode;
  text: string;
  level: string;
  score: number;
  improved: string;
  highlights: [string, string][];          // [word, CEFR]
  suggestions: [string, string, string][]; // [original, better, why]
  grammar: [string, string, 1 | 2 | 3][];  // [error_type, message, severity]
  genre: { group: string; subcat: string; label: string; desc: string };
  audioId?: string;                        // bundled recording (speaking/upload)
};

function buildVocabResult(spec: VocabSpec): VocabSession {
  const speaking = spec.mode !== 'type';
  const words = spec.text.replace(/[.,!?;:"']/g, '').split(/\s+/).filter(Boolean);
  const wordCount = words.length;
  const sentenceCount = Math.max(1, (spec.text.match(/[.!?]+/g) || []).length);
  const mls = Math.max(1, Math.round(wordCount / sentenceCount));
  const wps = speaking ? Math.round((1.6 + spec.score / 100 * 1.4) * 10) / 10 : 0;
  const fillerRate = speaking ? Math.max(0, Math.min(14, Math.round((100 - spec.score) / 8))) : 0;
  const fillerCount = Math.round(wordCount * fillerRate / 100);

  // ── CEFR distribution (percentages) + per-word tags ──
  const levelOf: Record<string, string> = {};
  spec.highlights.forEach(([w, l]) => { levelOf[w.toLowerCase()] = l; });
  const counts: Record<string, number> = { A1: 0, A2: 0, B1: 0, B2: 0, C1: 0, C2: 0 };
  const word_tags = words.map((w) => {
    const lvl = levelOf[w.toLowerCase()] || 'A1';
    counts[lvl] = (counts[lvl] || 0) + 1;
    return { word: w, level: lvl };
  });
  const b2plus = (counts.B2 || 0) + (counts.C1 || 0) + (counts.C2 || 0);
  const b2plus_pct = Math.round(100 * b2plus / Math.max(1, wordCount));
  // distribution is stored as PERCENTAGES (the Results legend renders "{lvl} {pct}%")
  const distribution: Record<string, number> = {};
  LEVEL_ORDER.forEach((l) => {
    if (counts[l] > 0) distribution[l] = Math.round(100 * counts[l] / Math.max(1, wordCount));
  });
  const highest_level_words = spec.highlights
    .filter(([, l]) => LEVEL_ORDER.indexOf(l) >= 3)
    .map(([w]) => w);

  // ── Exam profile ──
  const band = ieltsBand(spec.score);
  const exam_profile = {
    mode: speaking ? 'speaking' : 'writing',
    fluency_coherence_label: speaking ? 'Fluency & Coherence' : 'Coherence & Cohesion',
    indicators: {
      mtld: Math.round(30 + spec.score / 2),
      lexical_density: Math.round(44 + spec.score / 10),                              // ~44-53 (%)
      subordination_index: Math.round((1 + spec.score / 100) * 100) / 100,           // ~1.0-2.0
      syntactic_error_rate: Math.round(spec.grammar.length / Math.max(1, wordCount) * 1000) / 10, // per 100w
      connective_density: Math.round((2 + spec.score / 40) * 10) / 10,               // ~2-4.5 per 100w
      wps, filler_rate: fillerRate, mls,
      pronunciation_score: speaking ? spec.score : 0,
      b2plus_pct, word_count: wordCount, sentence_count: sentenceCount,
    },
    ielts: {
      fluency_coherence: Math.max(2, band - 0.5),
      lexical_resource: band,
      grammatical_accuracy: Math.max(2, band - (spec.grammar.length > 0 ? 0.5 : 0)),
      pronunciation: speaking ? band : band - 0.5,
      overall: band,
      band_label: bandLabel(band),
    },
    cambridge: {
      level: spec.level,
      exam: spec.level >= 'C1' ? 'CAE / CPE' : spec.level >= 'B2' ? 'FCE / CAE' : spec.level >= 'B1' ? 'PET / FCE' : 'KET / PET',
      description: `Vocabulary and structures consistent with CEFR ${spec.level}.`,
    },
    sources: [
      'IELTS Speaking Band Descriptors (British Council / Cambridge ESOL 2024)',
      'MTLD: McCarthy & Jarvis (2010)',
      'Foster & Tavakoli (2009) — fluency measures',
    ],
  };

  // ── Genre profile ──
  const dist_groups: Record<string, number> = {
    SPOK: 6, FIC: 5, MAG: 8, NEWS: 8, ACAD: 10, Web: 7, Blog: 6, Mov: 3, TV: 3,
  };
  dist_groups[spec.genre.group] = 40;
  const genre_profile = {
    distribution_groups: dist_groups,
    distribution_subcats: { [spec.genre.subcat]: 42 },
    top_subcategories: [
      { name: spec.genre.subcat, group: spec.genre.group, pct: 42 },
    ],
    dominant_group: spec.genre.group,
    dominant_label: spec.genre.label,
    dominant_description: spec.genre.desc,
    dominant_subcategory: spec.genre.subcat,
    matched_words: Math.round(wordCount * 0.6),
    total_words: wordCount,
    coverage: Math.round(60),
    group_breakdown: { [spec.genre.group]: [{ name: spec.genre.subcat, pct: 42 }] } as Record<string, { name: string; pct: number }[]>,
    source: 'COCA 96-subgenre register model (Davies 2008; Biber & Conrad 2019)',
  };

  // ── Romanian errors ──
  const categories: Record<string, number> = {};
  spec.grammar.forEach(([type]) => { categories[type] = (categories[type] || 0) + 1; });
  const severity_score = Math.max(0, Math.min(100, 100 - spec.grammar.reduce((a, [, , s]) => a + s * 8, 0)));
  const romanian_errors = {
    errors: spec.grammar.map(([error_type, message, severity]) => ({
      error_type, message, severity, occurrences: 1,
      source: 'Măchiță (2021); Romanian-English transfer',
    })),
    highlights: [] as any[],
    error_count: spec.grammar.length,
    severity_score,
    categories,
    research: 'Măchiță, O.-M. (2021); Swan & Smith (2001) Learner English.',
  };

  // ── Suggestions / improved text / word family / exercise ──
  const suggestions = spec.suggestions.map(([original_word, better_alternative, explanation]) => ({
    original_word, better_alternative, explanation,
  }));
  const targetWord = spec.highlights[0]?.[0] || words[0] || 'word';
  const word_family = {
    target_word: targetWord,
    related_forms: [
      { form: targetWord, part_of_speech: 'noun', definition: `Core form of "${targetWord}".`, pronunciation: `/${targetWord}/`, example_sentence: spec.text },
      { form: `${targetWord}s`, part_of_speech: 'noun (pl.)', definition: `Plural of "${targetWord}".`, pronunciation: `/${targetWord}z/`, example_sentence: `Several ${targetWord}s were noted.` },
    ],
  };
  const personalized_exercise = {
    exercise_type: 'Gap fill',
    difficulty: spec.level,
    focus_area: spec.suggestions[0] ? `Upgrade "${spec.suggestions[0][0]}"` : 'Lexical range',
    word: spec.suggestions[0]?.[1] || targetWord,
    target_word: spec.suggestions[0]?.[1] || targetWord,
    context: `Use a stronger synonym in: "${spec.text}"`,
    example_sentence: spec.improved,
    personalization_score: Math.min(1, 0.6 + spec.score / 300),
  };

  // ── Speech-only sections (record / upload) ──
  const speechSections = speaking ? {
    pronunciation_score: spec.score,
    emotion_analysis: {
      detected_emotion: (spec.score >= 80 ? 'confident' : spec.score >= 60 ? 'enthusiastic' : 'hesitant') as
        'confident' | 'hesitant' | 'enthusiastic' | 'nervous' | 'neutral',
      confidence_level: (spec.score >= 80 ? 'high' : spec.score >= 60 ? 'medium' : 'low') as 'low' | 'medium' | 'high',
      indicators: spec.score >= 80
        ? ['Steady pace', 'Few hesitations', 'Clear stress patterns']
        : ['Some hesitation before content words', 'Occasional self-correction'],
    },
    speech_quality: {
      pace: (wps < 1.8 ? 'slow' : wps > 2.8 ? 'fast' : 'good') as 'slow' | 'good' | 'fast',
      clarity: (spec.score >= 85 ? 'excellent' : spec.score >= 70 ? 'good' : spec.score >= 55 ? 'fair' : 'poor') as 'poor' | 'fair' | 'good' | 'excellent',
      rhythm: (spec.score >= 80 ? 'natural' : spec.score >= 60 ? 'irregular' : 'choppy') as 'choppy' | 'irregular' | 'natural' | 'fluid',
      accent_strength: (spec.score >= 88 ? 'native-like' : spec.score >= 72 ? 'light' : spec.score >= 55 ? 'moderate' : 'heavy') as 'heavy' | 'moderate' | 'light' | 'native-like',
    },
    phonetic_breakdown: {
      target_ipa: '/ˈtɑːrɡɪt/',
      user_ipa: '/ˈtarɡet/',
      phoneme_errors: spec.score >= 85 ? [] : [
        { position: 'word-initial', target_phoneme: 'θ', user_phoneme: 't', explanation: 'Romanian lacks /θ/; substituted with /t/ (Măchiță 2021).' },
        { position: 'word-medial', target_phoneme: 'ð', user_phoneme: 'd', explanation: '/ð/ → /d/ is the most frequent Romanian substitution.' },
      ],
    },
  } : {};

  const result: any = {
    improved_text: spec.improved,
    suggestions,
    corrections: spec.grammar.length
      ? `Reviewed ${spec.grammar.length} point(s): ${spec.grammar.map(g => g[0].replace(/_/g, ' ')).join(', ')}.`
      : 'No major grammar issues detected.',
    word_family,
    personalized_exercise,
    cefr_data: {
      distribution,
      vocab_cefr_level: spec.level,
      highest_level_words,
      word_tags,
    },
    speech_metrics: { wps, filler_rate: fillerRate, filler_count: fillerCount, mls, word_count: wordCount },
    exam_profile,
    romanian_errors,
    genre_profile,
    ...speechSections,
  };

  return {
    ts: daysAgo(spec.daysBack),
    topic: spec.topic,
    promptId: PROMPT_ID[spec.topic] ?? 3,
    mode: spec.mode,
    text: spec.text,
    level: spec.level,
    score: spec.score,
    audioId: spec.mode !== 'type' ? spec.audioId : undefined,
    result,
  };
}

// ── Accent DNA sessions ──────────────────────────────────────────────────────
const ACCENT: Record<AnyPreset, AccentSession[]> = {
  weak: [
    accent(1, 'I think this is the right answer.', 46, ['θ', 'ð', 'ɪ']),
    accent(3, 'The weather is very warm today.', 50, ['v', 'w', 'ð']),
    accent(6, 'She thought about the whole thing.', 43, ['θ', 'ð']),
  ],
  medium: [
    accent(1, 'They gathered together for the meeting.', 70, ['ð', 'ɜ']),
    accent(3, 'This method works through repetition.', 74, ['θ', 'ð', 'w']),
    accent(6, 'We should think about the future.', 72, ['θ', 'ð', 'ʊ']),
  ],
  strong: [
    accent(1, 'The thorough analysis revealed the truth.', 88, ['θ', 'ð']),
    accent(3, 'Whether they agree is another matter.', 90, ['ð', 'w']),
    accent(6, 'Three thousand words within the hour.', 86, ['θ', 'r', 'ð']),
  ],
  ana: [
    accent(1, 'I think the third patient needs the treatment.', 46, ['θ', 'ð', 'æ'], 'ana_accent_1'),
    accent(3, 'She measures the temperature very carefully.', 52, ['v', 'ʒ', 'r'], 'ana_accent_2'),
    accent(6, 'The vein is visible above the wrist.', 41, ['v', 'w', 'ɪ'], 'ana_accent_3'),
  ],
  mihai: [
    accent(1, 'The algorithm throughput improved this month.', 74, ['θ', 'ð', 'ʌ'], 'mihai_accent_1'),
    accent(3, 'We should refactor the whole database layer.', 78, ['w', 'ð', 'æ'], 'mihai_accent_2'),
    accent(6, 'This version handles thousands of requests.', 71, ['θ', 'z', 'ɪ'], 'mihai_accent_3'),
  ],
  elena: [
    accent(1, 'The defendant breached the third clause.', 84, ['θ', 'ð'], 'elena_accent_1'),
    accent(3, 'They thoroughly reviewed the legal documents.', 86, ['θ', 'ð', 'r'], 'elena_accent_2'),
    accent(6, 'The verdict was based on the witness.', 81, ['v', 'w', 'ɪ'], 'elena_accent_3'),
  ],
  radu: [
    accent(1, 'The authorities gathered further evidence.', 92, ['ð', 'ɜ'], 'radu_accent_1'),
    accent(3, 'Thousands marched through the northern districts.', 94, ['θ', 'ð', 'ɔ'], 'radu_accent_2'),
    accent(6, 'Whether the theory holds remains unclear.', 90, ['ð', 'θ', 'w'], 'radu_accent_3'),
  ],
  sorin: [
    accent(1, 'Our brand growth was worth the investment.', 70, ['w', 'θ', 'ɔ'], 'sorin_accent_1'),
    accent(3, 'We value three things above everything.', 66, ['v', 'θ', 'ð'], 'sorin_accent_2'),
    accent(6, 'This launch will reach the whole market.', 72, ['ð', 'w', 'ɪ'], 'sorin_accent_3'),
  ],
  diana: [
    accent(1, 'The quarterly earnings exceeded the forecast.', 83, ['ɔ', 'r', 'ð'], 'diana_accent_1'),
    accent(3, 'Both investors withdrew their shares.', 85, ['θ', 'ð', 'w'], 'diana_accent_2'),
    accent(6, 'The interest rate rose three percent.', 80, ['θ', 'r', 'ɪ'], 'diana_accent_3'),
  ],
};

// ── Vocabulary sessions (full results) ───────────────────────────────────────
const VOCAB: Record<AnyPreset, VocabSession[]> = {
  weak: [
    buildVocabResult({ daysBack: 2, topic: 'Daily Routine', mode: 'type', level: 'A2', score: 48,
      text: 'I wake up early and I go to work. My day is normal and I am happy.',
      improved: 'I wake up early and commute to work. My day is fairly routine, and I feel content.',
      highlights: [['routine', 'A2'], ['normal', 'A2']],
      suggestions: [['happy', 'content', 'A slightly higher-register synonym'], ['go to work', 'commute', 'A more precise single verb']],
      grammar: [['run_on', 'Two short clauses joined by "and" — vary your connectors', 1]],
      genre: { group: 'Blog', subcat: 'Blog:Pers', label: 'Personal Blog', desc: 'Everyday personal writing' } }),
    buildVocabResult({ daysBack: 4, topic: 'Hobby & Interests', mode: 'record', level: 'A2', score: 44,
      text: 'I like to watch movies. It is fun and good for me to relax.',
      improved: 'I enjoy watching films; it is an enjoyable and beneficial way to relax.',
      highlights: [['relax', 'A2'], ['movies', 'A1']],
      suggestions: [['fun', 'enjoyable', 'Less casual, B1-level'], ['good', 'beneficial', 'More precise adjective']],
      grammar: [['word_choice', '"good" is vague — choose a precise adjective', 1]],
      genre: { group: 'Blog', subcat: 'Blog:Pers', label: 'Personal Blog', desc: 'Everyday personal writing' } }),
  ],
  medium: [
    buildVocabResult({ daysBack: 2, topic: 'Career Goals', mode: 'record', level: 'B1', score: 68,
      text: 'I want to develop my skills and gain experience so I can advance in my field.',
      improved: 'I aim to develop my skills and gain experience so that I can advance in my profession.',
      highlights: [['develop', 'B1'], ['experience', 'B1'], ['advance', 'B2']],
      suggestions: [['want', 'aim', 'Stronger, goal-oriented verb'], ['field', 'profession', 'More formal register']],
      grammar: [],
      genre: { group: 'Web', subcat: 'Web:Info', label: 'Informational', desc: 'Informational web prose' } }),
    buildVocabResult({ daysBack: 5, topic: 'Technology Impact', mode: 'type', level: 'B1', score: 72,
      text: 'Technology has changed how we communicate and made work more efficient.',
      improved: 'Technology has transformed how we communicate and rendered work far more efficient.',
      highlights: [['communicate', 'B1'], ['efficient', 'B2']],
      suggestions: [['changed', 'transformed', 'More impactful, C1-level'], ['made', 'rendered', 'Higher academic register']],
      grammar: [],
      genre: { group: 'MAG', subcat: 'MAG:Sci/Tech', label: 'Science & Technology', desc: 'Popular science magazine' } }),
  ],
  strong: [
    buildVocabResult({ daysBack: 2, topic: 'Global Issue', mode: 'record', level: 'C1', score: 90,
      text: 'Climate change poses a profound threat that demands coordinated international action.',
      improved: 'Climate change poses a profound peril that demands coordinated international intervention.',
      highlights: [['profound', 'C1'], ['coordinated', 'C1'], ['demands', 'B2']],
      suggestions: [['threat', 'peril', 'Vivid C2 synonym'], ['action', 'intervention', 'More precise policy term']],
      grammar: [],
      genre: { group: 'ACAD', subcat: 'ACAD:Phil/Rel', label: 'Philosophy & Religion', desc: 'Abstract argumentation' } }),
    buildVocabResult({ daysBack: 5, topic: 'Personal Achievement', mode: 'upload', level: 'C1', score: 88,
      text: 'Completing the marathon was a defining accomplishment that bolstered my resilience.',
      improved: 'Completing the marathon was a defining accomplishment that bolstered my resilience.',
      highlights: [['defining', 'C1'], ['bolstered', 'C1'], ['resilience', 'C1']],
      suggestions: [['big', 'monumental', 'Stronger intensity'], ['hard', 'gruelling', 'More vivid C2 adjective']],
      grammar: [],
      genre: { group: 'Blog', subcat: 'Blog:Pers', label: 'Personal Blog', desc: 'Reflective personal narrative' } }),
  ],
  ana: [
    buildVocabResult({ daysBack: 2, topic: 'Daily Routine', mode: 'type', level: 'A2', score: 50,
      text: 'I work at the hospital and I help the patients every day with care.',
      improved: 'I work at the hospital, where I assist patients daily with great care.',
      highlights: [['hospital', 'A1'], ['patients', 'B1'], ['care', 'A2']],
      suggestions: [['help', 'assist', 'More professional verb'], ['every day', 'daily', 'More concise']],
      grammar: [['article_omission', 'Missing article before a singular countable noun', 2]],
      genre: { group: 'ACAD', subcat: 'ACAD:Medicine', label: 'Medicine', desc: 'Medical / clinical register' } }),
    buildVocabResult({ daysBack: 4, topic: 'Career Goals', mode: 'record', level: 'A2', score: 46, audioId: 'ana_vocab_1',
      text: 'I want to be a good doctor and learn new things about medicine.',
      improved: 'I aspire to be a competent doctor and to learn new procedures in medicine.',
      highlights: [['medicine', 'B1'], ['doctor', 'A1']],
      suggestions: [['good', 'competent', 'More precise, professional'], ['things', 'procedures', 'Domain-specific noun']],
      grammar: [['word_choice', '"things" is vague in a professional context', 1]],
      genre: { group: 'ACAD', subcat: 'ACAD:Medicine', label: 'Medicine', desc: 'Medical / clinical register' } }),
  ],
  mihai: [
    buildVocabResult({ daysBack: 2, topic: 'Technology Impact', mode: 'record', level: 'B2', score: 76, audioId: 'mihai_vocab_1',
      text: 'Cloud computing lets teams deploy software faster and scale their systems easily.',
      improved: 'Cloud computing enables teams to deploy software faster and scale their systems seamlessly.',
      highlights: [['deploy', 'B2'], ['scale', 'B2'], ['systems', 'B1']],
      suggestions: [['lets', 'enables', 'More formal verb'], ['easily', 'seamlessly', 'Higher-register adverb']],
      grammar: [['word_choice', '"lets" is informal for technical writing', 1]],
      genre: { group: 'ACAD', subcat: 'ACAD:Sci/Tech', label: 'Science & Technology', desc: 'STEM technical register' } }),
    buildVocabResult({ daysBack: 5, topic: 'Career Goals', mode: 'type', level: 'B1', score: 73,
      text: 'I aim to become a senior engineer and lead a team of developers.',
      improved: 'I aim to progress to a senior engineer role and spearhead a team of developers.',
      highlights: [['senior', 'B1'], ['developers', 'B1']],
      suggestions: [['become', 'progress to', 'More dynamic phrasing'], ['lead', 'spearhead', 'Stronger C1 verb']],
      grammar: [],
      genre: { group: 'Web', subcat: 'Web:Info', label: 'Informational', desc: 'Informational web prose' } }),
  ],
  elena: [
    buildVocabResult({ daysBack: 2, topic: 'Global Issue', mode: 'type', level: 'C1', score: 86,
      text: 'Data privacy regulation must balance individual rights against commercial interests.',
      improved: 'Data-privacy regulation must reconcile individual entitlements with commercial interests.',
      highlights: [['regulation', 'B2'], ['commercial', 'B2'], ['interests', 'B1']],
      suggestions: [['balance', 'reconcile', 'More precise legal verb'], ['rights', 'entitlements', 'Formal legal term']],
      grammar: [],
      genre: { group: 'ACAD', subcat: 'ACAD:Law/PolSci', label: 'Law & Political Science', desc: 'Legal / policy register' } }),
    buildVocabResult({ daysBack: 5, topic: 'Career Goals', mode: 'record', level: 'B2', score: 84, audioId: 'elena_vocab_1',
      text: 'I intend to specialise in corporate law and represent clients in negotiations.',
      improved: 'I aspire to specialise in corporate law and represent stakeholders in negotiations.',
      highlights: [['specialise', 'B2'], ['negotiations', 'B2'], ['represent', 'B1']],
      suggestions: [['intend', 'aspire', 'More aspirational verb'], ['clients', 'stakeholders', 'Broader professional term']],
      grammar: [['spelling', '"specialise" (BrE) vs "specialize" (AmE) — stay consistent', 1]],
      genre: { group: 'ACAD', subcat: 'ACAD:Law/PolSci', label: 'Law & Political Science', desc: 'Legal / policy register' } }),
  ],
  radu: [
    buildVocabResult({ daysBack: 2, topic: 'Global Issue', mode: 'record', level: 'C1', score: 93, audioId: 'radu_vocab_1',
      text: 'Press freedom is being eroded as authorities increasingly suppress dissent worldwide.',
      improved: 'Press freedom is under siege as authorities increasingly suppress dissent across the globe.',
      highlights: [['eroded', 'C1'], ['suppress', 'C1'], ['dissent', 'C1']],
      suggestions: [['being eroded', 'under siege', 'Vivid journalistic idiom'], ['worldwide', 'across the globe', 'Stylistic variety']],
      grammar: [],
      genre: { group: 'NEWS', subcat: 'NEWS:Editorial', label: 'Editorial', desc: 'Opinion / editorial journalism' } }),
    buildVocabResult({ daysBack: 5, topic: 'Technology Impact', mode: 'upload', level: 'C1', score: 91, audioId: 'radu_shadow_2',
      text: 'Social media has reshaped public discourse, amplifying both insight and misinformation.',
      improved: 'Social media has reshaped public discourse, amplifying nuance and misinformation alike.',
      highlights: [['reshaped', 'C1'], ['discourse', 'C1'], ['amplifying', 'C1']],
      suggestions: [['both', 'alike', 'More elegant phrasing'], ['insight', 'nuance', 'Sharper noun']],
      grammar: [],
      genre: { group: 'NEWS', subcat: 'NEWS:News_Natl', label: 'National News', desc: 'News reporting register' } }),
  ],
  sorin: [
    buildVocabResult({ daysBack: 2, topic: 'Technology Impact', mode: 'record', level: 'B1', score: 71, audioId: 'sorin_vocab_1',
      text: 'Digital marketing helps us reach customers and grow our brand awareness quickly.',
      improved: 'Digital marketing enables us to reach customers and grow brand awareness rapidly.',
      highlights: [['awareness', 'B2'], ['customers', 'A2']],
      suggestions: [['helps', 'enables', 'More formal'], ['quickly', 'rapidly', 'Higher register']],
      grammar: [['word_choice', '"helps us reach" → "enables us to reach"', 1]],
      genre: { group: 'Blog', subcat: 'Blog:Prom', label: 'Promotional', desc: 'Marketing / promotional copy' } }),
    buildVocabResult({ daysBack: 5, topic: 'Career Goals', mode: 'upload', level: 'B1', score: 67, audioId: 'sorin_shadow_2',
      text: 'I want to become a marketing director and manage bigger campaigns.',
      improved: 'I aspire to become a marketing director and manage larger-scale campaigns.',
      highlights: [['campaigns', 'B1'], ['manage', 'B1']],
      suggestions: [['bigger', 'larger-scale', 'More professional'], ['want', 'aspire', 'Stronger verb']],
      grammar: [],
      genre: { group: 'MAG', subcat: 'MAG:Soc/Arts', label: 'Society & Arts', desc: 'Society / lifestyle register' } }),
  ],
  diana: [
    buildVocabResult({ daysBack: 2, topic: 'Career Goals', mode: 'type', level: 'B2', score: 84,
      text: 'I analyse financial data to forecast trends and advise on investment decisions.',
      improved: 'I analyse financial data to forecast trends and counsel on investment allocations.',
      highlights: [['forecast', 'B2'], ['trends', 'B1'], ['investment', 'B1']],
      suggestions: [['advise', 'counsel', 'More formal verb'], ['decisions', 'allocations', 'Precise finance term']],
      grammar: [],
      genre: { group: 'ACAD', subcat: 'ACAD:Business', label: 'Business', desc: 'Business / finance register' } }),
    buildVocabResult({ daysBack: 5, topic: 'Global Issue', mode: 'record', level: 'C1', score: 85, audioId: 'diana_vocab_1',
      text: 'Inflation undermines purchasing power and erodes household savings over time.',
      improved: 'Inflation undermines purchasing power and erodes household reserves in the long run.',
      highlights: [['undermines', 'C1'], ['erodes', 'C1'], ['purchasing', 'B2']],
      suggestions: [['over time', 'in the long run', 'Common economics idiom'], ['savings', 'reserves', 'Higher register']],
      grammar: [],
      genre: { group: 'MAG', subcat: 'MAG:Financial', label: 'Financial', desc: 'Financial reporting register' } }),
  ],
};

// ── Per-phoneme scores (drive the Accent DNA globe colours) ──────────────────
// Keys MUST match PHONEME_EXERCISES[].phoneme in app/(tabs)/accent.tsx.
// last score >= 75 → "Mastered" (green); < 75 → "Needs work" (red);
// omitted phoneme → "To explore" (yellow).
const PHONEME_SCORES: Record<AnyPreset, Record<string, number>> = {
  weak: { '/θ/': 44, '/ð/': 40, '/i:/-/ɪ/': 50, '/æ/-/ɑ:/': 47, '/ʌ/': 55, '/ŋ/': 76, '/ə/': 72 },
  medium: { '/θ/': 62, '/ð/': 58, '/i:/-/ɪ/': 72, '/u:/-/ʊ/': 68, '/æ/-/ɑ:/': 70, '/ŋ/': 82, '/ə/': 80, '[kʰ]': 78, '/ʌ/': 74 },
  strong: { '/θ/': 86, '/ð/': 82, '/i:/-/ɪ/': 90, '/u:/-/ʊ/': 88, '/æ/-/ɑ:/': 84, '/ʌ/': 87, '/ŋ/': 92, '/ə/': 90, '[kʰ]': 89, '[tʰ]': 80 },
  ana: { '/θ/': 42, '/ð/': 38, '/i:/-/ɪ/': 48, '/u:/-/ʊ/': 52, '/æ/-/ɑ:/': 45, '/ə/': 70, '[tʰ]': 40, '/ŋ/': 78 },
  mihai: { '/θ/': 66, '/ð/': 60, '/i:/-/ɪ/': 74, '/u:/-/ʊ/': 78, '/ŋ/': 84, '/ə/': 82, '[kʰ]': 80, '[tʰ]': 72, '/ʌ/': 76 },
  elena: { '/θ/': 78, '/ð/': 74, '/i:/-/ɪ/': 82, '/u:/-/ʊ/': 80, '/æ/-/ɑ:/': 76, '/ʌ/': 84, '/ŋ/': 88, '/ə/': 86, '[kʰ]': 85, '[tʰ]': 72 },
  radu: { '/θ/': 88, '/ð/': 84, '/i:/-/ɪ/': 90, '/u:/-/ʊ/': 88, '/æ/-/ɑ:/': 86, '/ʌ/': 89, '/ŋ/': 92, '/ə/': 90, '[kʰ]': 91, '[pʰ]': 87, '[tʰ]': 85 },
  sorin: { '/θ/': 64, '/ð/': 62, '/i:/-/ɪ/': 70, '/u:/-/ʊ/': 72, '/æ/-/ɑ:/': 68, '/ŋ/': 80, '/ə/': 78, '[pʰ]': 74 },
  diana: { '/θ/': 80, '/ð/': 72, '/i:/-/ɪ/': 84, '/u:/-/ʊ/': 82, '/æ/-/ɑ:/': 78, '/ŋ/': 88, '/ə/': 86, '[kʰ]': 84, '/ʌ/': 81 },
};

// ── Public API ───────────────────────────────────────────────────────────────
export function accentSessionsFor(preset: AnyPreset): AccentSession[] {
  return ACCENT[preset] ?? [];
}
export function vocabSessionsFor(preset: AnyPreset): VocabSession[] {
  return VOCAB[preset] ?? [];
}
/** Per-phoneme last scores (single-element history arrays) for the globe. */
export function phonemeScoresFor(preset: AnyPreset): Record<string, number[]> {
  const flat = PHONEME_SCORES[preset] ?? {};
  const out: Record<string, number[]> = {};
  for (const k of Object.keys(flat)) out[k] = [flat[k]];
  return out;
}
