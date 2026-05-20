import { useState, useRef, useCallback, useEffect } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  TextInput, ActivityIndicator, Alert, StatusBar,
} from 'react-native';
import { getAuth } from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Colors } from '@/constants/theme';
import { VOCABULARY_ENDPOINTS } from '@/constants/api';

// ── Constants ─────────────────────────────────────────────────────────────────

const TEAL   = '#0FBA9A';
const NAVY   = '#0F172A';
const SLATE  = '#64748B';
const BORDER = '#E5E7EB';
const CARD   = '#FFFFFF';
const BG     = '#F8FAFC';

const CEFR_COLOR: Record<string, string> = {
  A1: '#94A3B8', A2: '#64748B',
  B1: '#3B82F6', B2: '#8B5CF6',
  C1: '#10B981', C2: '#F59E0B',
};

// Official CEFR descriptors — Council of Europe Global Scale (globalscale.txt)
const CEFR_DESCRIPTORS: Record<string, { label: string; short: string }> = {
  C2: {
    label: 'Proficient User — Mastery',
    short: 'Can understand with ease virtually everything heard or read. Can express spontaneously, very fluently and precisely.',
  },
  C1: {
    label: 'Proficient User — Effective Operational Proficiency',
    short: 'Can express fluently and spontaneously without much obvious searching for expressions. Can use language flexibly for social, academic and professional purposes.',
  },
  B2: {
    label: 'Independent User — Upper Intermediate',
    short: 'Can interact with a degree of fluency and spontaneity that makes regular interaction with native speakers quite possible without strain.',
  },
  B1: {
    label: 'Independent User — Threshold',
    short: 'Can deal with most situations likely to arise whilst travelling in an area where the language is spoken. Can produce simple connected text on familiar topics.',
  },
  A2: {
    label: 'Basic User — Waystage',
    short: 'Can communicate in simple and routine tasks requiring a simple and direct exchange of information on familiar matters.',
  },
  A1: {
    label: 'Basic User — Breakthrough',
    short: 'Can understand and use familiar everyday expressions and very basic phrases aimed at the satisfaction of needs of a concrete type.',
  },
};

// Cambridge exam recommendations by CEFR level
const CAMBRIDGE_EXAM: Record<string, { name: string; code: string; tip: string }> = {
  C2: { name: 'Cambridge C2 Proficiency (CPE)',    code: 'CPE', tip: 'The highest Cambridge qualification — proof of near-native proficiency.' },
  C1: { name: 'Cambridge C1 Advanced (CAE)',        code: 'CAE', tip: 'Widely recognised by universities and employers globally.' },
  B2: { name: 'Cambridge B2 First (FCE)',           code: 'FCE', tip: 'Opens doors to higher education and international employment.' },
  B1: { name: 'Cambridge B1 Preliminary (PET)',     code: 'PET', tip: 'Solid foundation — aim for FCE to broaden opportunities.' },
  A2: { name: 'Cambridge A2 Key (KET)',             code: 'KET', tip: 'Good starting point — work toward PET/B1 level.' },
  A1: { name: 'Cambridge Pre-A1 Starters',          code: '–',   tip: 'Foundation level — focus on basic vocabulary and structures.' },
};

const IELTS_CRITERIA = [
  { key: 'fluency_coherence',   label: 'Fluency & Coherence',        color: '#3B82F6' },
  { key: 'lexical_resource',    label: 'Lexical Resource',           color: '#8B5CF6' },
  { key: 'grammatical_accuracy',label: 'Grammatical Range',          color: '#10B981' },
  { key: 'pronunciation',       label: 'Pronunciation',              color: '#F59E0B' },
] as const;

const CAMBRIDGE_CRITERIA = [
  { key: 'pronunciation_fluency', label: 'Pronunciation & Fluency' },
  { key: 'language_resource',     label: 'Language Resource' },
  { key: 'discourse_management',  label: 'Discourse Management' },
] as const;

const FILLER_WORDS = new Set([
  'uh','um','erm','er','ah','like','you know','basically','literally',
  'actually','right','okay','so','well','just','hmm',
]);

// Academic sources used in the exam_mapper
const SOURCES = [
  { short: 'Kolahi Ahari et al. (2025)', detail: 'IELTS↔CEFR mapping; MTLD β=.40 — 10.22034_ijlt.2025.492133.1395' },
  { short: 'Neumanova (2015)', detail: 'SER: A2=9.16, B1=6.91, B2=4.53 errors/100 words — 8.+Z.+Neumanova+Do+publikacji+5.06' },
  { short: 'Pallotti (2014)', detail: 'Filled Pause Ratio; CAF fluency threshold 0.3–0.4 s — 21Routledge-Pallotti-CAF' },
  { short: 'McCarthy & Jarvis (2010)', detail: 'MTLD algorithm; TTR threshold=0.720 — Behavior Research Methods 42(2)' },
  { short: 'Hunt (1965); Norris & Ortega (2009)', detail: 'Subordination Index / MLS syntactic complexity — 1-s2.0-S1075293520300714' },
  { short: 'IELTS Band Descriptors', detail: 'Official qualitative descriptors bands 1–9 — ielts-guide-for-test-takers (British Council / IDP 2024)' },
  { short: 'Council of Europe (2020)', detail: 'CEFR Global Scale A1–C2 official can-do descriptors — globalscale' },
  { short: 'Cambridge Assessment English (2023)', detail: '3-criterion Speaking rubric (Pronunciation & Fluency, Language Resource, Discourse Management) — 731659-cambridge-english-skills-test-schools-speaking-assessment-criteria' },
];

// ── Types ─────────────────────────────────────────────────────────────────────

interface IeltsResult {
  fluency_coherence: number;
  lexical_resource: number;
  grammatical_accuracy: number;
  pronunciation: number;
  overall: number;
  band_label: string;
}

interface CambridgeCriterion { level: string; descriptor: string }

interface CambridgeAssessment {
  overall_level: string;
  recommended_exam: string;
  advice: string;
  criteria: {
    pronunciation_fluency: CambridgeCriterion;
    language_resource: CambridgeCriterion;
    discourse_management: CambridgeCriterion;
  };
  source: string;
}

interface Indicators {
  mtld: number;
  lexical_density: number;
  subordination_index: number;
  syntactic_error_rate: number;
  connective_density: number;
  wps: number;
  filler_rate: number;
  mls: number;
  pronunciation_score: number;
  b2plus_pct: number;
  word_count: number;
  sentence_count: number;
}

interface PteCoreResult {
  speaking_score: number;
  score_range: string;
  clb_level: number | null;
  cefr_equivalent: string;
  description: string;
  source: string;
}

interface ExamProfileResult {
  mode: string;
  fluency_coherence_label: string;
  indicators: Indicators;
  ielts: IeltsResult;
  cambridge: { level: string; exam: string; description: string };
  cambridge_assessment: CambridgeAssessment;
  pte_core?: PteCoreResult;
  sources: string[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function bandBar(band: number, color: string) {
  const pct = (band / 9) * 100;
  return (
    <View style={styles.bandBarTrack}>
      <View style={[styles.bandBarFill, { width: `${pct}%` as any, backgroundColor: color }]} />
    </View>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function ExamProfileScreen() {
  const [mode, setMode] = useState<'speaking' | 'writing'>('speaking');
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ExamProfileResult | null>(null);
  const [showSources, setShowSources] = useState(false);
  const [showIndicators, setShowIndicators] = useState(false);
  const [isDemoMode, setIsDemoMode] = useState(false);
  const recordingTimeRef = useRef(0);

  const auth = getAuth();

  useEffect(() => {
    AsyncStorage.getItem('active_demo_preset').then(v => { if (v) setIsDemoMode(true); });
  }, []);

  const handleAnalyze = useCallback(async () => {
    const trimmed = text.trim();
    if (trimmed.split(/\s+/).length < 20) {
      Alert.alert('Too short', 'Please enter at least 20 words for a reliable estimate.');
      return;
    }

    try {
      setLoading(true);
      setResult(null);

      const token = await auth.currentUser?.getIdToken();
      if (!token) { Alert.alert('Auth Error', 'Not authenticated'); return; }

      const post = async (url: string, body: any) => {
        const r = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify(body),
        });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      };

      // Round 1: CEFR vocabulary classification (needed for b2plus_pct)
      const cefrResp = await post(VOCABULARY_ENDPOINTS.CLASSIFY_TEXT, { text: trimmed });
      const distribution: Record<string, number> = cefrResp?.data?.distribution ?? {};

      // Compute client-side speech metrics
      const words = trimmed.split(/\s+/).filter(w => w.length > 0);
      const sentences = trimmed.split(/[.!?]+/).filter(s => s.trim().length > 3);
      const fillers = mode === 'speaking'
        ? words.filter(w => FILLER_WORDS.has(w.toLowerCase().replace(/[^a-z]/g, '')))
        : [];
      const mls = words.length / Math.max(sentences.length, 1);
      const fillerRate = mode === 'speaking'
        ? (fillers.length / Math.max(words.length, 1)) * 100
        : 0;

      // Round 2: Exam profile
      const examResp = await post(VOCABULARY_ENDPOINTS.EXAM_PROFILE, {
        text: trimmed,
        pronunciation_score: 0,    // no audio in standalone mode
        wps: mode === 'speaking' ? 1.5 : 0,  // neutral estimate for text-only
        filler_rate: fillerRate,
        mls: parseFloat(mls.toFixed(1)),
        cefr_distribution: distribution,
        input_mode: mode === 'speaking' ? 'speaking' : 'writing',
      });

      if (!examResp?.data) throw new Error('No data returned');
      const profile: ExamProfileResult = examResp.data;
      setResult(profile);

      // Persist to history
      try {
        const entry = {
          ts: Date.now(),
          ielts_overall: profile.ielts.overall,
          cambridge_level: profile.cambridge.level,
          cambridge_exam: profile.cambridge.exam,
          ielts: profile.ielts,
          pte_core: profile.pte_core ?? null,
          mode,
        };
        const prev = await AsyncStorage.getItem('vf_exam_sessions');
        const arr = prev ? JSON.parse(prev) : [];
        arr.push(entry);
        await AsyncStorage.setItem('vf_exam_sessions', JSON.stringify(arr.slice(-20)));
      } catch {}

    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to compute exam profile.');
    } finally {
      setLoading(false);
    }
  }, [text, mode]);

  const cefrLevel = result?.cambridge?.level ?? result?.cambridge_assessment?.overall_level ?? 'B1';
  const cefrColor = CEFR_COLOR[cefrLevel] ?? TEAL;
  const cefrInfo  = CEFR_DESCRIPTORS[cefrLevel];
  const camExam   = CAMBRIDGE_EXAM[cefrLevel];

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <StatusBar barStyle="dark-content" />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Exam Profile</Text>
        <Text style={styles.headerSub}>IELTS Speaking band · Cambridge CEFR level</Text>
      </View>

      {/* Mode toggle */}
      <View style={styles.modeRow}>
        {(['speaking', 'writing'] as const).map(m => (
          <TouchableOpacity
            key={m}
            style={[styles.modeBtn, mode === m && styles.modeBtnActive]}
            onPress={() => { setMode(m); setResult(null); }}
          >
            <Text style={[styles.modeBtnText, mode === m && styles.modeBtnTextActive]}>
              {m === 'speaking' ? '🎙 Speaking' : '✍️ Writing'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Demo banner */}
      {isDemoMode && (
        <View style={styles.demoBanner}>
          <Text style={styles.demoBannerTitle}>Demo Mode — Live Analysis</Text>
          <Text style={styles.demoBannerText}>
            Type or paste any English text (20+ words) and tap Compute Profile to run a real IELTS / Cambridge / PTE Core estimate. Your demo diagnostic results are shown in the History tab.
          </Text>
        </View>
      )}

      {/* Text input */}
      <View style={styles.inputCard}>
        <Text style={styles.inputLabel}>
          {mode === 'speaking'
            ? 'Paste or type transcribed speech (≥ 20 words)'
            : 'Paste or type your written text (≥ 20 words)'}
        </Text>
        <TextInput
          style={styles.textInput}
          multiline
          placeholder={
            mode === 'speaking'
              ? 'e.g. I think that the most important thing is to have good communication skills because…'
              : 'e.g. In my opinion, the rapid development of technology has fundamentally changed the way…'
          }
          placeholderTextColor={Colors.light.textLight}
          value={text}
          onChangeText={setText}
          textAlignVertical="top"
        />
        <View style={styles.wordCountRow}>
          <Text style={styles.wordCount}>{text.trim() ? text.trim().split(/\s+/).length : 0} words</Text>
          {text.length > 0 && (
            <TouchableOpacity onPress={() => { setText(''); setResult(null); }}>
              <Text style={styles.clearBtn}>Clear</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Analyze button */}
      <TouchableOpacity
        style={[styles.analyzeBtn, loading && styles.analyzeBtnDisabled]}
        onPress={handleAnalyze}
        disabled={loading}
      >
        {loading
          ? <ActivityIndicator color="#fff" />
          : <Text style={styles.analyzeBtnText}>Compute Profile</Text>
        }
      </TouchableOpacity>

      {/* Note about pronunciation */}
      {mode === 'speaking' && (
        <Text style={styles.noteText}>
          Note: Pronunciation band requires audio recording (available in the Vocabulary screen). Text-only mode estimates Fluency, Lexical Resource and Grammatical Range.
        </Text>
      )}

      {/* ─── Results ────────────────────────────────────────────────────────── */}
      {result && (
        <View style={styles.results}>

          {/* CEFR Level card */}
          <View style={[styles.cefrCard, { borderLeftColor: cefrColor }]}>
            <View style={styles.cefrTop}>
              <View style={[styles.cefrBadge, { backgroundColor: cefrColor + '22' }]}>
                <Text style={[styles.cefrBadgeText, { color: cefrColor }]}>{cefrLevel}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.cefrLabel}>{cefrInfo?.label ?? cefrLevel}</Text>
                <Text style={styles.cefrSub}>Council of Europe Global Scale</Text>
              </View>
            </View>
            <Text style={styles.cefrDesc}>{cefrInfo?.short}</Text>
          </View>

          {/* Recommended Cambridge exam */}
          {camExam && (
            <View style={styles.camExamCard}>
              <Text style={styles.sectionTitle}>Recommended Cambridge Exam</Text>
              <View style={styles.camExamRow}>
                <View style={[styles.camBadge, { backgroundColor: cefrColor + '22' }]}>
                  <Text style={[styles.camBadgeText, { color: cefrColor }]}>{camExam.code}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.camExamName}>{camExam.name}</Text>
                  <Text style={styles.camExamTip}>{camExam.tip}</Text>
                </View>
              </View>
            </View>
          )}

          {/* IELTS Overall Band */}
          <View style={styles.ieltsOverallCard}>
            <Text style={styles.sectionTitle}>IELTS {mode === 'writing' ? 'Writing' : 'Speaking'}</Text>
            <View style={styles.ieltsOverallRow}>
              <Text style={styles.ieltsBandBig}>{result.ielts.overall}</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.ieltsBandLabel}>{result.ielts.band_label}</Text>
                <Text style={styles.ieltsBandSub}>Overall Band Score</Text>
              </View>
            </View>

            {/* 4 criteria bars */}
            {IELTS_CRITERIA.map(({ key, label, color }) => {
              const val: number = result.ielts[key as keyof IeltsResult] as number;
              if (key === 'pronunciation' && mode === 'writing') return null;
              return (
                <View key={key} style={styles.criterionRow}>
                  <View style={styles.criterionLabelRow}>
                    <View style={[styles.criterionDot, { backgroundColor: color }]} />
                    <Text style={styles.criterionLabel}>{label}</Text>
                    <Text style={[styles.criterionVal, { color }]}>{val}</Text>
                  </View>
                  {bandBar(val, color)}
                </View>
              );
            })}

            <Text style={styles.ieltsSource}>
              Source: IELTS Band Descriptors — British Council / Cambridge ESOL / IDP (2024)
            </Text>
          </View>

          {/* Cambridge ESOL Assessment */}
          {result.cambridge_assessment && (
            <View style={styles.camAssessCard}>
              <Text style={styles.sectionTitle}>Cambridge ESOL Speaking Criteria</Text>
              <Text style={styles.camAssessOverall}>
                Overall:{' '}
                <Text style={{ color: CEFR_COLOR[result.cambridge_assessment.overall_level] ?? TEAL, fontWeight: '800' }}>
                  {result.cambridge_assessment.overall_level}
                </Text>
                {'  '}— {result.cambridge_assessment.advice}
              </Text>

              {CAMBRIDGE_CRITERIA.map(({ key, label }) => {
                const crit = result.cambridge_assessment.criteria[key as keyof typeof result.cambridge_assessment.criteria];
                if (!crit || crit.level === '—') return null;
                const lvlColor = CEFR_COLOR[crit.level] ?? SLATE;
                return (
                  <View key={key} style={styles.camCriterionCard}>
                    <View style={styles.camCriterionHeader}>
                      <Text style={styles.camCriterionLabel}>{label}</Text>
                      <View style={[styles.camCriterionBadge, { backgroundColor: lvlColor + '22' }]}>
                        <Text style={[styles.camCriterionBadgeText, { color: lvlColor }]}>{crit.level}</Text>
                      </View>
                    </View>
                    <Text style={styles.camCriterionDesc}>{crit.descriptor}</Text>
                  </View>
                );
              })}

              <Text style={styles.ieltsSource}>
                Source: Cambridge English Skills Test — Speaking Assessment Criteria (Cambridge Assessment English, 2023)
              </Text>
            </View>
          )}

          {/* PTE Core estimate */}
          {result.pte_core && (
            <View style={styles.pteCard}>
              <Text style={styles.sectionTitle}>PTE Core — Speaking Estimate</Text>
              <View style={styles.pteScoreRow}>
                <View style={styles.pteScoreBubble}>
                  <Text style={styles.pteScoreNum}>{result.pte_core.speaking_score}</Text>
                  <Text style={styles.pteScaleLabel}>/ 90</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <View style={styles.pteRangeRow}>
                    <Text style={styles.pteRangeLabel}>Score range</Text>
                    <Text style={styles.pteRangeVal}>{result.pte_core.score_range}</Text>
                  </View>
                  {result.pte_core.clb_level && (
                    <View style={styles.pteRangeRow}>
                      <Text style={styles.pteRangeLabel}>CLB level</Text>
                      <Text style={styles.pteRangeVal}>{result.pte_core.clb_level}</Text>
                    </View>
                  )}
                  <View style={styles.pteRangeRow}>
                    <Text style={styles.pteRangeLabel}>CEFR equivalent</Text>
                    <View style={[styles.camCriterionBadge, { backgroundColor: (CEFR_COLOR[result.pte_core.cefr_equivalent] ?? TEAL) + '22' }]}>
                      <Text style={[styles.camCriterionBadgeText, { color: CEFR_COLOR[result.pte_core.cefr_equivalent] ?? TEAL }]}>
                        {result.pte_core.cefr_equivalent}
                      </Text>
                    </View>
                  </View>
                </View>
              </View>

              {/* Score bar */}
              <View style={styles.pteBarTrack}>
                <View style={[styles.pteBarFill, { width: `${(result.pte_core.speaking_score / 90) * 100}%` as any }]} />
              </View>
              <View style={styles.pteBarLabels}>
                <Text style={styles.pteBarTick}>10</Text>
                <Text style={styles.pteBarTick}>30</Text>
                <Text style={styles.pteBarTick}>50</Text>
                <Text style={styles.pteBarTick}>70</Text>
                <Text style={styles.pteBarTick}>90</Text>
              </View>

              <Text style={styles.pteNote}>
                Estimated via IELTS→CEFR→CLB→PTE chain. Not a substitute for an actual PTE Core test score.
              </Text>
              <Text style={styles.ieltsSource}>
                Source: Pearson PTE (2024) — CLB comparison table, Speaking column (PTE Core scoring _ Pearson PTE.txt);
                Kolahi Ahari et al. (2025) — IELTS↔CEFR bridge; Council of Europe Global Scale (globalscale.txt)
              </Text>
            </View>
          )}

          {/* Indicators (collapsible) */}
          <TouchableOpacity
            style={styles.collapseHeader}
            onPress={() => setShowIndicators(v => !v)}
          >
            <Text style={styles.collapseTitle}>Linguistic Indicators</Text>
            <Text style={styles.collapseArrow}>{showIndicators ? '▲' : '▼'}</Text>
          </TouchableOpacity>
          {showIndicators && (
            <View style={styles.indicatorsGrid}>
              {[
                { label: 'MTLD',            val: result.indicators.mtld,                  unit: '',    tip: 'Lexical diversity (McCarthy & Jarvis 2010)' },
                { label: 'Lexical Density', val: result.indicators.lexical_density,       unit: '%',   tip: 'Content words / total words (Neumanova 2015)' },
                { label: 'Subord. Index',   val: result.indicators.subordination_index,   unit: '',    tip: 'Clause embedding complexity (Hunt 1965)' },
                { label: 'Error Rate',      val: result.indicators.syntactic_error_rate,  unit: '/100',tip: 'Syntactic errors per 100 words (Neumanova 2015)' },
                { label: 'Conn. Density',   val: result.indicators.connective_density,    unit: '/100',tip: 'TAACO connectives per 100 tokens (Crossley 2016)' },
                { label: 'B2+ Vocab',       val: result.indicators.b2plus_pct,            unit: '%',   tip: 'High-level vocabulary from EVP Cambridge' },
                { label: 'Mean Sent. Len',  val: result.indicators.mls,                   unit: ' w',  tip: 'Mean length of sentence (Hunt 1965)' },
                { label: 'Words',           val: result.indicators.word_count,            unit: '',    tip: 'Total word count' },
                { label: 'Sentences',       val: result.indicators.sentence_count,        unit: '',    tip: 'Total sentence count' },
              ].map(({ label, val, unit, tip }) => (
                <View key={label} style={styles.indicatorCell}>
                  <Text style={styles.indicatorVal}>{typeof val === 'number' ? val.toFixed(val < 10 ? 1 : 0) : '—'}{unit}</Text>
                  <Text style={styles.indicatorLabel}>{label}</Text>
                  <Text style={styles.indicatorTip}>{tip}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Academic sources (collapsible) */}
          <TouchableOpacity
            style={styles.collapseHeader}
            onPress={() => setShowSources(v => !v)}
          >
            <Text style={styles.collapseTitle}>Academic Sources</Text>
            <Text style={styles.collapseArrow}>{showSources ? '▲' : '▼'}</Text>
          </TouchableOpacity>
          {showSources && (
            <View style={styles.sourcesCard}>
              {SOURCES.map(({ short, detail }) => (
                <View key={short} style={styles.sourceItem}>
                  <Text style={styles.sourceShort}>{short}</Text>
                  <Text style={styles.sourceDetail}>{detail}</Text>
                </View>
              ))}
            </View>
          )}

        </View>
      )}
    </ScrollView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: BG },
  content: { paddingHorizontal: 16, paddingBottom: 40 },

  header: { paddingTop: 8, paddingBottom: 16 },
  headerTitle: { fontSize: 22, fontWeight: '800', color: NAVY, letterSpacing: -0.5 },
  headerSub: { fontSize: 12, color: SLATE, marginTop: 3, fontWeight: '500' },

  // Mode toggle
  modeRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  modeBtn: {
    flex: 1, paddingVertical: 10, borderRadius: 10, borderWidth: 1.5,
    borderColor: BORDER, backgroundColor: CARD, alignItems: 'center',
  },
  modeBtnActive: { borderColor: TEAL, backgroundColor: TEAL + '12' },
  modeBtnText: { fontSize: 13, fontWeight: '700', color: SLATE },
  modeBtnTextActive: { color: TEAL },

  // Input
  inputCard: {
    backgroundColor: CARD, borderRadius: 14, borderWidth: 1, borderColor: BORDER,
    padding: 14, marginBottom: 12,
  },
  inputLabel: { fontSize: 12, fontWeight: '700', color: SLATE, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  textInput: {
    minHeight: 120, fontSize: 14, color: NAVY, lineHeight: 22,
  },
  wordCountRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  wordCount: { fontSize: 12, color: SLATE },
  clearBtn: { fontSize: 12, color: '#EF4444', fontWeight: '600' },

  // Button
  analyzeBtn: {
    backgroundColor: TEAL, borderRadius: 12, paddingVertical: 14,
    alignItems: 'center', marginBottom: 8,
  },
  analyzeBtnDisabled: { opacity: 0.6 },
  analyzeBtnText: { fontSize: 15, fontWeight: '800', color: '#fff', letterSpacing: 0.2 },

  noteText: { fontSize: 11, color: SLATE, fontStyle: 'italic', marginBottom: 16, lineHeight: 16 },

  // Results container
  results: { gap: 12 },

  // CEFR Card
  cefrCard: {
    backgroundColor: CARD, borderRadius: 14, borderWidth: 1, borderColor: BORDER,
    borderLeftWidth: 4, padding: 16,
  },
  cefrTop: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10 },
  cefrBadge: {
    width: 48, height: 48, borderRadius: 12,
    justifyContent: 'center', alignItems: 'center',
  },
  cefrBadgeText: { fontSize: 20, fontWeight: '900' },
  cefrLabel: { fontSize: 14, fontWeight: '700', color: NAVY },
  cefrSub: { fontSize: 11, color: SLATE, marginTop: 2 },
  cefrDesc: { fontSize: 13, color: SLATE, lineHeight: 19 },

  // Cambridge exam card
  camExamCard: {
    backgroundColor: CARD, borderRadius: 14, borderWidth: 1, borderColor: BORDER, padding: 16,
  },
  camExamRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 10 },
  camBadge: {
    width: 44, height: 44, borderRadius: 10,
    justifyContent: 'center', alignItems: 'center',
  },
  camBadgeText: { fontSize: 13, fontWeight: '900' },
  camExamName: { fontSize: 14, fontWeight: '700', color: NAVY },
  camExamTip: { fontSize: 12, color: SLATE, marginTop: 3, lineHeight: 17 },

  // IELTS overall card
  ieltsOverallCard: {
    backgroundColor: CARD, borderRadius: 14, borderWidth: 1, borderColor: BORDER, padding: 16,
  },
  ieltsOverallRow: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 16 },
  ieltsBandBig: { fontSize: 48, fontWeight: '900', color: TEAL, lineHeight: 56 },
  ieltsBandLabel: { fontSize: 15, fontWeight: '700', color: NAVY },
  ieltsBandSub: { fontSize: 12, color: SLATE },

  criterionRow: { marginBottom: 10 },
  criterionLabelRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 5 },
  criterionDot: { width: 8, height: 8, borderRadius: 4, marginRight: 8 },
  criterionLabel: { flex: 1, fontSize: 13, fontWeight: '600', color: NAVY },
  criterionVal: { fontSize: 15, fontWeight: '800' },

  bandBarTrack: {
    height: 8, backgroundColor: '#F1F5F9', borderRadius: 4, overflow: 'hidden',
  },
  bandBarFill: { height: '100%', borderRadius: 4 },

  ieltsSource: { fontSize: 10, color: SLATE, marginTop: 12, fontStyle: 'italic', lineHeight: 14 },

  // Cambridge ESOL assessment
  camAssessCard: {
    backgroundColor: CARD, borderRadius: 14, borderWidth: 1, borderColor: BORDER, padding: 16,
  },
  camAssessOverall: { fontSize: 13, color: SLATE, marginBottom: 12, lineHeight: 18 },
  camCriterionCard: {
    backgroundColor: '#F8FAFC', borderRadius: 10, padding: 12,
    borderWidth: 1, borderColor: BORDER, marginBottom: 8,
  },
  camCriterionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  camCriterionLabel: { fontSize: 13, fontWeight: '700', color: NAVY },
  camCriterionBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  camCriterionBadgeText: { fontSize: 12, fontWeight: '800' },
  camCriterionDesc: { fontSize: 12, color: SLATE, lineHeight: 17 },

  // Section title
  sectionTitle: { fontSize: 13, fontWeight: '800', color: NAVY, letterSpacing: 0.3, marginBottom: 10, textTransform: 'uppercase' },

  // Collapsible header
  collapseHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: CARD, borderRadius: 12, borderWidth: 1, borderColor: BORDER,
    paddingHorizontal: 16, paddingVertical: 12,
  },
  collapseTitle: { fontSize: 13, fontWeight: '700', color: NAVY },
  collapseArrow: { fontSize: 12, color: SLATE },

  // Indicators grid
  indicatorsGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 8,
    backgroundColor: CARD, borderRadius: 14, borderWidth: 1, borderColor: BORDER, padding: 14,
  },
  indicatorCell: {
    width: '30%', backgroundColor: '#F8FAFC', borderRadius: 10,
    padding: 10, borderWidth: 1, borderColor: BORDER, alignItems: 'center',
  },
  indicatorVal: { fontSize: 16, fontWeight: '800', color: TEAL },
  indicatorLabel: { fontSize: 10, fontWeight: '700', color: NAVY, marginTop: 3, textAlign: 'center' },
  indicatorTip: { fontSize: 9, color: SLATE, marginTop: 3, textAlign: 'center', lineHeight: 12 },

  // PTE Core card
  pteCard: {
    backgroundColor: CARD, borderRadius: 14, borderWidth: 1, borderColor: BORDER, padding: 16,
  },
  pteScoreRow: { flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 14 },
  pteScoreBubble: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: '#EFF6FF', borderWidth: 2, borderColor: '#3B82F6',
    justifyContent: 'center', alignItems: 'center',
  },
  pteScoreNum: { fontSize: 26, fontWeight: '900', color: '#3B82F6', lineHeight: 30 },
  pteScaleLabel: { fontSize: 11, color: SLATE, fontWeight: '600' },
  pteRangeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  pteRangeLabel: { fontSize: 12, color: SLATE, fontWeight: '500' },
  pteRangeVal: { fontSize: 13, fontWeight: '700', color: NAVY },
  pteBarTrack: {
    height: 10, backgroundColor: '#EFF6FF', borderRadius: 5, overflow: 'hidden', marginBottom: 4,
  },
  pteBarFill: { height: '100%', backgroundColor: '#3B82F6', borderRadius: 5 },
  pteBarLabels: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  pteBarTick: { fontSize: 10, color: SLATE },
  pteNote: { fontSize: 11, color: SLATE, fontStyle: 'italic', marginBottom: 4, lineHeight: 15 },

  // Sources
  sourcesCard: {
    backgroundColor: CARD, borderRadius: 14, borderWidth: 1, borderColor: BORDER, padding: 14, gap: 10,
  },
  sourceItem: { borderBottomWidth: 1, borderBottomColor: '#F1F5F9', paddingBottom: 10 },
  sourceShort: { fontSize: 12, fontWeight: '700', color: NAVY, marginBottom: 3 },
  sourceDetail: { fontSize: 11, color: SLATE, lineHeight: 15 },

  // Demo banner
  demoBanner: {
    backgroundColor: '#EFF6FF', borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: '#BFDBFE', marginBottom: 12,
  },
  demoBannerTitle: { fontSize: 13, fontWeight: '800', color: '#1E40AF', marginBottom: 6 },
  demoBannerText: { fontSize: 12, color: '#1D4ED8', lineHeight: 18 },
});
