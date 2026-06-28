import { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  ActivityIndicator,
  Image,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Illustrations } from '@/constants/illustrations';
import { SectionHeader, SectionHero } from '@/components/section-header';
import { useFocusEffect } from '@react-navigation/native';
import { useLearnerProfile } from '../../context/LearnerProfile';
import { Colors } from '../../constants/theme';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL, VOCABULARY_ENDPOINTS } from '@/constants/api';
import { downloadReportPDF } from '@/utils/pdfReport';
import { getFreshToken } from '@/utils/auth';

const { width } = Dimensions.get('window');

type RTStats = {
  avg_rt_ms: number | null;
  cv: number | null;
  trend: number[];
  total_responses: number;
  interpretation: string;
  research?: string;
};

type CAFEntry = {
  ts: number;
  C: number;   // Complexity 0–100 (MLS-based)
  A: number;   // Accuracy 0–100 (pronunciation score)
  F: number;   // Fluency 0–100 (filler-rate-based)
  cefr: string;
  wps: number;
};

type ExamSession = {
  ts: number;
  ielts_overall: number;
  cambridge_level: string;
  cambridge_exam: string;
  ielts: {
    fluency_coherence: number;
    lexical_resource: number;
    grammatical_accuracy: number;
    pronunciation: number;
    overall: number;
    band_label: string;
  };
};

type GrammarSession = {
  ts: number;
  severity_score: number;
  error_count: number;
  categories: Record<string, number>;
};

type AccentSession = { ts: number; accuracy_score: number };
type ShadowSession = { ts: number; score: number };

type CocaGroup = 'SPOK' | 'FIC' | 'MAG' | 'NEWS' | 'ACAD' | 'Web' | 'Blog' | 'Mov' | 'TV';

type GenreSession = {
  ts: number;
  dominant_genre: CocaGroup | null;
  dominant_subcategory: string | null;
  distribution: Record<string, number>;
  cefr_level: string;
  cefr_score: number;
  input_mode: 'speaking' | 'writing';
};

type BaselineDiagnosis = {
  predicted_cefr: string;
  overall_score: number;
  indicators: Array<{
    name: string;
    normalized: number;
    cefr_level: string;
    severity: string;
  }>;
  exam_specific_scores: Record<string, number>;
};

type SRSState = {
  due_count: number;
  learning_count: number;
  mastered_count: number;
  new_count: number;
  total_bank: number;
};

// Strip "(D Index / VOCD)" style parentheticals from backend indicator names
function shortIndName(name: string): string {
  return name.replace(/\s*\([^)]*\)\s*/g, '').trim();
}

const INDICATOR_PLAIN: Record<string, string> = {
  'Lexical Diversity':        'Range of different words you use',
  'Lexical Sophistication':   'How advanced your vocabulary is',
  'Average Word Length':      'Longer words = more sophisticated register',
  'Sentence Complexity':      'How long and varied your sentences are',
  'Subordination Ratio':      'Use of clauses like "because", "although", "which…"',
  'Syntactic Complexity':     'Number of clauses packed into each sentence',
  'Articulation Rate':        'How many words you speak per second',
  'Pause/Disfluency Rate':    'How often you pause or say "um / uh"',
  'Cohesion & Coherence':     'How well your ideas are connected and flow',
  'Morphosyntactic Accuracy': 'Grammar and tense correctness',
};

const CEFR_COLOR: Record<string, string> = {
  A1: '#94A3B8', A2: '#64748B', B1: '#8B5CF6', B2: '#8B5CF6', C1: '#8B5CF6', C2: '#0FBA9A',
};

// IELTS Speaking Band Descriptors — British Council / Cambridge ESOL (2024)
// Qualitative speaking-specific descriptors from ielts-guide-for-test-takers.txt
const IELTS_BAND_DESC: Record<number, string> = {
  9: 'Speaks fluently without effort. Cohesive features are used naturally. Fully develops all topics.',
  8: 'Speaks fluently with only occasional repetition. Uses a wide range of vocabulary and grammar accurately.',
  7: 'Speaks at length without noticeable effort; uses cohesive devices, though with some inaccuracy. Ideas are clearly presented.',
  6: 'Willing to speak at length but may lose coherence. Uses a range of connectives; some repetition or self-correction.',
  5: 'Maintains flow but uses repetition and slow speech at times. Limited range of connectives and discourse markers.',
  4: 'Cannot respond without noticeable pauses. Limited ability to link ideas; often loses coherence in longer responses.',
  3: 'Speaks with long pauses. Gives only simple responses; limited ability to link sentences.',
  2: 'Pauses lengthily before most words. Little communication possible.',
  1: 'No communication possible. No rateable language.',
};

// CEFR Can-Do Statements — Council of Europe Global Scale (2020)
// From globalscale.txt: overall spoken interaction descriptors
const CEFR_CAN_DO: Record<string, string> = {
  C2: 'Can express themselves spontaneously, very fluently and precisely with fine shades of meaning in complex situations.',
  C1: 'Can express ideas fluently and spontaneously without much searching. Uses language flexibly for academic and professional purposes.',
  B2: 'Can interact with a degree of fluency and spontaneity on a wide range of topics. Can explain a viewpoint and discuss advantages/disadvantages.',
  B1: 'Can deal with most situations likely to arise during travel. Can describe experiences and briefly justify opinions.',
  A2: 'Can communicate in simple and routine tasks on familiar topics. Can describe immediate environment and everyday matters.',
  A1: 'Can understand and use familiar everyday expressions. Can interact in a simple way if the other person speaks slowly.',
};

const CAF_META = [
  { key: 'C' as const, label: 'Complexity', hint: 'How varied and complex your sentences are', color: '#8B5CF6' },
  { key: 'A' as const, label: 'Accuracy', hint: 'How clearly you pronounce words', color: '#0FBA9A' },
  { key: 'F' as const, label: 'Fluency', hint: 'How smoothly you speak (less "um/uh" = higher score)', color: '#8B5CF6' },
];

// Chart helpers (pure View/StyleSheet — no SVG or external libraries)
// Each line segment is a View rotated with Math.atan2 to align between two points.
// Positioned absolutely on a containing View sized to chartWidth × height.
const CHART_W = Math.min(width, 900) - 80; // capped to the 900px content column − (2×20 scroll pad + 2×20 card pad)

function LineChart({
  data,
  chartWidth = CHART_W,
  height = 90,
  color = '#0FBA9A',
  minY,
  maxY,
  showGrid = false,
}: {
  data: number[];
  chartWidth?: number;
  height?: number;
  color?: string;
  minY?: number;
  maxY?: number;
  showGrid?: boolean;
}) {
  if (data.length < 2) return null;
  const padX = 8;
  const padY = 10;
  const min = minY ?? Math.min(...data);
  const max = maxY ?? Math.max(...data);
  const range = max - min || 1;
  const pts = data.map((v, i) => ({
    x: padX + (i / (data.length - 1)) * (chartWidth - 2 * padX),
    y: padY + (1 - (v - min) / range) * (height - 2 * padY),
  }));
  return (
    <View style={{ width: chartWidth, height, position: 'relative' }}>
      {showGrid && [0.25, 0.5, 0.75].map((f, gi) => (
        <View key={gi} style={{
          position: 'absolute', left: 0, right: 0,
          top: padY + (1 - f) * (height - 2 * padY),
          height: 1, backgroundColor: '#0F1B2D',
        }} />
      ))}
      {pts.slice(0, -1).map((p, i) => {
        const q = pts[i + 1];
        const dx = q.x - p.x;
        const dy = q.y - p.y;
        const len = Math.sqrt(dx * dx + dy * dy);
        const angle = Math.atan2(dy, dx) * (180 / Math.PI);
        return (
          <View key={i} style={{
            position: 'absolute',
            left: (p.x + q.x) / 2 - len / 2,
            top: (p.y + q.y) / 2 - 1.5,
            width: len, height: 3,
            backgroundColor: color, borderRadius: 1.5,
            transform: [{ rotate: `${angle}deg` }],
          }} />
        );
      })}
      {pts.map((p, i) => (
        <View key={i} style={{
          position: 'absolute',
          left: p.x - 4.5, top: p.y - 4.5,
          width: 9, height: 9, borderRadius: 4.5,
          backgroundColor: color,
          borderWidth: 2, borderColor: '#fff',
        }} />
      ))}
    </View>
  );
}

type LineSeries = { data: number[]; color: string; label: string };

function MultiLineChart({
  series,
  chartWidth = CHART_W,
  height = 90,
  minY,
  maxY,
}: {
  series: LineSeries[];
  chartWidth?: number;
  height?: number;
  minY?: number;
  maxY?: number;
}) {
  const allData = series.flatMap(s => s.data);
  if (allData.length === 0) return null;
  const padX = 8;
  const padY = 10;
  const min = minY ?? Math.min(...allData);
  const max = maxY ?? Math.max(...allData);
  const range = max - min || 1;
  return (
    <View style={{ width: chartWidth, height, position: 'relative' }}>
      {[0.25, 0.5, 0.75].map((f, gi) => (
        <View key={gi} style={{
          position: 'absolute', left: 0, right: 0,
          top: padY + (1 - f) * (height - 2 * padY),
          height: 1, backgroundColor: '#0F1B2D',
        }} />
      ))}
      {series.map((s, si) => {
        if (s.data.length < 2) return null;
        const pts = s.data.map((v, i) => ({
          x: padX + (i / (s.data.length - 1)) * (chartWidth - 2 * padX),
          y: padY + (1 - (v - min) / range) * (height - 2 * padY),
        }));
        return (
          <View key={si} style={{ position: 'absolute', top: 0, left: 0, width: chartWidth, height }}>
            {pts.slice(0, -1).map((p, i) => {
              const q = pts[i + 1];
              const dx = q.x - p.x;
              const dy = q.y - p.y;
              const len = Math.sqrt(dx * dx + dy * dy);
              const angle = Math.atan2(dy, dx) * (180 / Math.PI);
              return (
                <View key={i} style={{
                  position: 'absolute',
                  left: (p.x + q.x) / 2 - len / 2,
                  top: (p.y + q.y) / 2 - 1.5,
                  width: len, height: 3,
                  backgroundColor: s.color, borderRadius: 1.5,
                  transform: [{ rotate: `${angle}deg` }],
                }} />
              );
            })}
            {pts.map((p, i) => (
              <View key={i} style={{
                position: 'absolute',
                left: p.x - 3.5, top: p.y - 3.5,
                width: 7, height: 7, borderRadius: 3.5,
                backgroundColor: s.color,
                borderWidth: 1.5, borderColor: '#fff',
              }} />
            ))}
          </View>
        );
      })}
    </View>
  );
}

export default function ProgressScreen() {
  const router = useRouter();
  const { profile } = useLearnerProfile();
  const [rtStats, setRtStats] = useState<RTStats | null>(null);
  const [rtLoading, setRtLoading] = useState(true);
  const [cafSessions, setCafSessions] = useState<CAFEntry[]>([]);
  const [examSessions, setExamSessions] = useState<ExamSession[]>([]);
  const [baseline, setBaseline] = useState<BaselineDiagnosis | null>(null);
  const [originalBaseline, setOriginalBaseline] = useState<BaselineDiagnosis | null>(null);
  const [grammarSessions, setGrammarSessions] = useState<GrammarSession[]>([]);
  const [accentSessions, setAccentSessions] = useState<AccentSession[]>([]);
  const [shadowSessions, setShadowSessions] = useState<ShadowSession[]>([]);
  const [genreSessions, setGenreSessions] = useState<GenreSession[]>([]);
  const [srsState, setSrsState] = useState<SRSState | null>(null);
  const [exporting, setExporting] = useState(false);

  useFocusEffect(useCallback(() => {
    (async () => {
      setRtStats(null);
      setRtLoading(true);

      // When a demo preset is active, skip live API calls and use demo data.
      const demoPreset = await AsyncStorage.getItem('active_demo_preset');
      const isDemo = !!demoPreset;

      if (isDemo) {
        try {
          const raw = await AsyncStorage.getItem('demo_rt_stats');
          if (raw) setRtStats(JSON.parse(raw));
        } catch {}
        setRtLoading(false);
      } else {
        try {
          const token = await getFreshToken();
          if (token) {
            const res = await fetch(`${API_URL}/vocabulary/rt-stats`, {
              headers: { Authorization: `Bearer ${token}` },
            });
            if (res.ok) setRtStats(await res.json());
          }
        } catch (e) {
          console.error('RT stats error:', e);
        } finally {
          setRtLoading(false);
        }
      }

      // AsyncStorage (fast, offline-capable)
      // Track local arrays so Firestore merge can reference them directly
      // without relying on React state timing.
      let localCaf: CAFEntry[] = [];
      let localExam: ExamSession[] = [];
      let localGrammar: GrammarSession[] = [];
      let localGenre: GenreSession[] = [];

      try {
        const raw = await AsyncStorage.getItem('vf_caf_sessions');
        if (raw) { localCaf = JSON.parse(raw); setCafSessions(localCaf); }
      } catch {}

      try {
        const rawExam = await AsyncStorage.getItem('vf_exam_sessions');
        if (rawExam) { localExam = JSON.parse(rawExam); setExamSessions(localExam); }
      } catch {}

      try {
        const rawBaseline = await AsyncStorage.getItem('baselineDiagnosis');
        if (rawBaseline) setBaseline(JSON.parse(rawBaseline));
        const rawOriginal = await AsyncStorage.getItem('baselineDiagnosisOriginal');
        if (rawOriginal) setOriginalBaseline(JSON.parse(rawOriginal));
      } catch {}

      try {
        const rawGr = await AsyncStorage.getItem('vf_grammar_sessions');
        if (rawGr) { localGrammar = JSON.parse(rawGr); setGrammarSessions(localGrammar); }
      } catch {}

      try {
        const rawGn = await AsyncStorage.getItem('vf_genre_sessions');
        if (rawGn) { localGenre = JSON.parse(rawGn); setGenreSessions(localGenre); }
      } catch {}

      // Accent ADN + Shadow Speaking sessions (stored newest-first in each module).
      // Read the local cache first, then re-hydrate from Firestore — the local cache
      // can be cleared on sign-out, but the sessions themselves live in the cloud
      // ('sessions' collection, types 'accent'/'shadow'). Re-seed the local cache so
      // every screen sees the cloud history again.
      let localAcc: AccentSession[] = [];
      let localSh: ShadowSession[] = [];
      try { const r = await AsyncStorage.getItem('vf_accent_sessions'); if (r) localAcc = JSON.parse(r); } catch {}
      try { const r = await AsyncStorage.getItem('vf_shadow_sessions'); if (r) localSh = JSON.parse(r); } catch {}
      if (localAcc.length) setAccentSessions(localAcc);
      if (localSh.length) setShadowSessions(localSh);

      if (!isDemo) {
        try {
          const hToken = await getFreshToken();
          if (hToken) {
            const hRes = await fetch(`${API_URL}/auth/history`, { headers: { Authorization: `Bearer ${hToken}` } });
            if (hRes.ok) {
              const { sessions = [] } = await hRes.json();
              const toTs = (s: any) => s.ts ?? (s.created_at ? Date.parse(s.created_at) : 0);
              const dedupe = <T extends { ts: number }>(a: T[], b: T[]): T[] => {
                const seen = new Set(a.map(x => x.ts));
                return [...a, ...b.filter(x => !seen.has(x.ts))].sort((x, y) => y.ts - x.ts);
              };
              const cloudAcc: AccentSession[] = sessions
                .filter((s: any) => s.type === 'accent' && s.accuracy_score != null)
                .map((s: any) => ({ ts: toTs(s), accuracy_score: Number(s.accuracy_score) }))
                .filter((s: AccentSession) => s.ts > 0);
              const cloudSh: ShadowSession[] = sessions
                .filter((s: any) => s.type === 'shadow' && (s.score != null || s.accuracy_score != null))
                .map((s: any) => ({ ts: toTs(s), score: Number(s.score ?? s.accuracy_score) }))
                .filter((s: ShadowSession) => s.ts > 0);
              if (cloudAcc.length) {
                const merged = dedupe(localAcc, cloudAcc);
                setAccentSessions(merged);
                AsyncStorage.setItem('vf_accent_sessions', JSON.stringify(merged.slice(0, 50))).catch(() => {});
              }
              if (cloudSh.length) {
                const merged = dedupe(localSh, cloudSh);
                setShadowSessions(merged);
                AsyncStorage.setItem('vf_shadow_sessions', JSON.stringify(merged.slice(0, 50))).catch(() => {});
              }
            }
          }
        } catch {}
      }

      // Firestore merge (survives reinstall — same /sessions endpoint)
      // Merges remote sessions not already in AsyncStorage, sorts ascending
      // so charts render chronological left→right progression.
      try {
        const fsToken = await getFreshToken();
        if (fsToken) {
          const fsRes = await fetch(VOCABULARY_ENDPOINTS.SESSIONS, {
            headers: { Authorization: `Bearer ${fsToken}` },
          });
          if (fsRes.ok) {
            const { data: fsSessions = [] } = await fsRes.json();

            const fsCaf: CAFEntry[] = [];
            const fsExam: ExamSession[] = [];
            const fsGrammar: GrammarSession[] = [];
            const fsGenre: GenreSession[] = [];

            for (const s of fsSessions) {
              const ts: number = s.ts ?? 0;
              if (!ts) continue;
              if (s.caf?.C != null) fsCaf.push({ ts, ...s.caf } as CAFEntry);
              if (s.exam?.ielts_overall != null) fsExam.push({ ts, ...s.exam } as ExamSession);
              if (s.grammar?.severity_score != null) fsGrammar.push({ ts, ...s.grammar } as GrammarSession);
              if (s.genre?.dominant_genre != null) fsGenre.push({ ts, ...s.genre } as GenreSession);
            }

            // Merge helper: deduplicate by ts, sort ascending (oldest → newest for charts)
            const merge = <T extends { ts: number }>(local: T[], remote: T[]): T[] => {
              const seen = new Set(local.map(s => s.ts));
              return [...local, ...remote.filter(s => !seen.has(s.ts))].sort((a, b) => a.ts - b.ts);
            };

            if (fsCaf.length > 0) setCafSessions(merge(localCaf, fsCaf));
            if (fsExam.length > 0) setExamSessions(merge(localExam, fsExam));
            if (fsGrammar.length > 0) setGrammarSessions(merge(localGrammar, fsGrammar));
            if (fsGenre.length > 0) setGenreSessions(merge(localGenre, fsGenre));
          }
        }
      } catch {}

      // SM-2 SRS state
      if (isDemo) {
        try {
          const raw = await AsyncStorage.getItem('demo_srs_state');
          if (raw) setSrsState(JSON.parse(raw));
        } catch {}
      } else {
        try {
          const srsToken = await getFreshToken();
          if (srsToken) {
            const srsRes = await fetch(VOCABULARY_ENDPOINTS.SRS_STATE, {
              headers: { Authorization: `Bearer ${srsToken}` },
            });
            if (srsRes.ok) setSrsState((await srsRes.json()).data);
          }
        } catch {}
      }
    })();
  }, []));

  const getAccuracyColor = (accuracy: number) => {
    if (accuracy >= 85) return Colors.light.success;
    if (accuracy >= 60) return Colors.light.warning;
    return Colors.light.error;
  };

  const renderAccuracyBar = (accuracy: number) => {
    return (
      <View style={styles.accuracyBarContainer}>
        <View
          style={[
            styles.accuracyBarFill,
            {
              width: `${Math.min(accuracy, 100)}%`,
              backgroundColor: getAccuracyColor(accuracy),
            },
          ]}
        />
      </View>
    );
  };

  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} activeOpacity={0.7}>
            <Feather name="chevron-left" size={18} color="#0FBA9A" />
            <Text style={styles.backText}>Back</Text>
          </TouchableOpacity>
          <Text style={styles.pageTitle}>Learning Progress</Text>
          <TouchableOpacity
            style={[styles.exportBtn, exporting && { opacity: 0.7 }]}
            onPress={async () => {
              if (exporting) return;
              setExporting(true);
              try {
                await downloadReportPDF();
              } catch (e) {
                console.error('Export failed:', e);
              } finally {
                setExporting(false);
              }
            }}
            disabled={exporting}
            activeOpacity={0.85}
          >
            {exporting
              ? <ActivityIndicator size="small" color="#fff" />
              : <Text style={styles.exportBtnText}>Download PDF</Text>}
          </TouchableOpacity>
        </View>

        <SectionHero
          art={Illustrations.progressOverview}
          title="Learning Progress"
          subtitle="Track how your English has grown since the baseline."
        />

        {/* Baseline vs. Now */}
        {/* Alderson (2005) diagnostic: measure from a known starting point */}
        {baseline && (() => {
          // Use the original (first-ever) baseline as START when re-diagnostic was done
          const startBaseline = originalBaseline ?? baseline;
          const isRerun = !!originalBaseline;

          // Current overall: from exam sessions (ielts_overall/9*100) or CAF average
          const currentScore = examSessions.length > 0
            ? Math.round(
                examSessions.slice(-5).reduce((s, e) => s + e.ielts_overall, 0)
                / Math.min(examSessions.length, 5) / 9 * 100
              )
            : cafSessions.length > 0
            ? Math.round(
                cafSessions.slice(-5).reduce((s, e) => s + (e.C + e.A + e.F) / 3, 0)
                / Math.min(cafSessions.length, 5)
              )
            : null;

          const currentCefr = examSessions.length > 0
            ? examSessions[examSessions.length - 1].cambridge_level
            : cafSessions.length > 0
            ? cafSessions[cafSessions.length - 1].cefr
            : null;

          const delta = currentScore !== null ? currentScore - Math.round(startBaseline.overall_score) : null;

          const CEFR_ORDER = ['A1','A2','B1','B2','C1','C2'];
          const baseIdx = CEFR_ORDER.indexOf(startBaseline.predicted_cefr);
          const currIdx = currentCefr ? CEFR_ORDER.indexOf(currentCefr) : -1;
          const cefrDelta = currIdx >= 0 ? currIdx - baseIdx : 0;

          const EXAM_MAP = [
            { key: 'ielts_academic', label: 'IELTS', max: 9, color: '#0FBA9A',
              current: examSessions.length > 0
                ? examSessions.slice(-3).reduce((s, e) => s + e.ielts_overall, 0) / Math.min(examSessions.length, 3)
                : null,
              baseRaw: startBaseline.exam_specific_scores?.ielts_academic,
              toNative: (v: number) => ((v / 100) * 9).toFixed(1),
            },
            { key: 'cambridge_cae', label: 'Cambridge', max: 100, color: '#8B5CF6',
              current: null,
              baseRaw: startBaseline.exam_specific_scores?.cambridge_cae,
              toNative: (v: number) => Math.round(v).toString(),
            },
          ];

          return (
            <View style={styles.baselineCard}>
              <View style={styles.baselineCardHeader}>
                <Text style={styles.cardTitle}>Progress Since Baseline</Text>
                {isRerun && (
                  <View style={styles.rerunBadge}>
                    <Text style={styles.rerunBadgeText}>Re-diagnosed</Text>
                  </View>
                )}
              </View>
              <Text style={styles.baselineSubtitle}>
                Alderson (2005) diagnostic assessment · Knoch (2009) formative evaluation
              </Text>

              {/* Score comparison row */}
              <View style={styles.baselineScoreRow}>
                {/* Baseline score */}
                <View style={styles.baselineScoreBox}>
                  <Text style={styles.baselineScoreLabel}>START</Text>
                  <View style={[styles.baselineCircle, { borderColor: '#64748B' }]}>
                    <View style={styles.baselineCircleInner}>
                      <Text style={[styles.baselineCircleNum, { color: '#64748B' }]}>
                        {Math.round(startBaseline.overall_score)}
                      </Text>
                      <Text style={styles.baselineCircleMax}>/100</Text>
                    </View>
                  </View>
                  <View style={[styles.cefrBadge, {
                    backgroundColor: (CEFR_COLOR[startBaseline.predicted_cefr] ?? '#64748B') + '20',
                    borderColor: (CEFR_COLOR[startBaseline.predicted_cefr] ?? '#64748B') + '50',
                  }]}>
                    <Text style={[styles.cefrBadgeText, { color: CEFR_COLOR[startBaseline.predicted_cefr] ?? '#64748B' }]}>
                      {startBaseline.predicted_cefr}
                    </Text>
                  </View>
                </View>

                {/* Arrow + delta */}
                <View style={styles.baselineDeltaCol}>
                  {delta !== null ? (
                    <>
                      <View style={[styles.deltaBadge, {
                        backgroundColor: delta >= 0 ? '#0FBA9A18' : '#ef444418',
                        borderColor: delta >= 0 ? '#0FBA9A50' : '#ef444450',
                      }]}>
                        <Text style={[styles.deltaText, { color: delta >= 0 ? '#0FBA9A' : '#ef4444' }]}>
                          {delta >= 0 ? '+' : ''}{delta}pts
                        </Text>
                      </View>
                      {cefrDelta !== 0 && (
                        <Text style={[styles.cefrDeltaText, { color: cefrDelta > 0 ? '#0FBA9A' : '#ef4444' }]}>
                          {cefrDelta > 0 ? `+${cefrDelta}` : cefrDelta} CEFR
                        </Text>
                      )}
                      <Text style={styles.baselineArrow}>→</Text>
                    </>
                  ) : (
                    <Text style={styles.baselineArrow}>→</Text>
                  )}
                </View>

                {/* Current score */}
                <View style={styles.baselineScoreBox}>
                  <Text style={styles.baselineScoreLabel}>NOW</Text>
                  {currentScore !== null ? (
                    <>
                      <View style={[styles.baselineCircle, { borderColor: Colors.light.tint }]}>
                        <View style={styles.baselineCircleInner}>
                          <Text style={[styles.baselineCircleNum, { color: Colors.light.tint }]}>
                            {currentScore}
                          </Text>
                          <Text style={styles.baselineCircleMax}>/100</Text>
                        </View>
                      </View>
                      {currentCefr && (
                        <View style={[styles.cefrBadge, {
                          backgroundColor: (CEFR_COLOR[currentCefr] ?? '#8B5CF6') + '20',
                          borderColor: (CEFR_COLOR[currentCefr] ?? '#8B5CF6') + '50',
                        }]}>
                          <Text style={[styles.cefrBadgeText, { color: CEFR_COLOR[currentCefr] ?? '#8B5CF6' }]}>
                            {currentCefr}
                          </Text>
                        </View>
                      )}
                    </>
                  ) : (
                    <View style={[styles.baselineCircle, { borderColor: Colors.light.border, borderStyle: 'dashed' }]}>
                      <Text style={styles.baselineCircleEmpty}>?</Text>
                    </View>
                  )}
                  {currentScore === null && (
                    <Text style={styles.baselineNoData}>Do a session</Text>
                  )}
                </View>
              </View>

              {/* Exam score comparison — circles */}
              {EXAM_MAP.some(e => e.baseRaw != null) && (
                <View style={styles.baselineExamRow}>
                  {EXAM_MAP.map((exam, idx) => {
                    if (exam.baseRaw == null) return null;
                    const baseNative = exam.toNative(exam.baseRaw);
                    const currNative = exam.current !== null ? exam.toNative((exam.current / 9) * 100) : null;
                    return (
                      <View key={exam.key} style={[
                        styles.baselineExamBox,
                        idx > 0 && { borderLeftWidth: 1, borderLeftColor: Colors.light.border },
                      ]}>
                        <Text style={[styles.baselineExamLabel, { color: exam.color }]}>{exam.label}</Text>
                        <View style={styles.baselineExamCompare}>
                          {/* START circle */}
                          <View style={styles.examMiniCircleWrap}>
                            <View style={[styles.examMiniCircle, { borderColor: Colors.light.textLight }]}>
                              <View style={styles.examMiniInner}>
                                <Text style={[styles.examMiniNum, { color: Colors.light.textSecondary }]}>{baseNative}</Text>
                                <Text style={styles.examMiniMax}>/{exam.max}</Text>
                              </View>
                            </View>
                            <Text style={styles.examMiniCircleLabel}>START</Text>
                          </View>
                          <Text style={styles.baselineExamArrow}>→</Text>
                          {/* NOW circle */}
                          <View style={styles.examMiniCircleWrap}>
                            <View style={[styles.examMiniCircle, { borderColor: currNative != null ? exam.color : Colors.light.border }]}>
                              <View style={styles.examMiniInner}>
                                <Text style={[styles.examMiniNum, { color: currNative != null ? exam.color : Colors.light.textLight }]}>
                                  {currNative ?? '—'}
                                </Text>
                                {currNative != null && <Text style={styles.examMiniMax}>/{exam.max}</Text>}
                              </View>
                            </View>
                            <Text style={styles.examMiniCircleLabel}>NOW</Text>
                          </View>
                        </View>
                      </View>
                    );
                  })}
                </View>
              )}

              {/* Baseline indicator mini-bars (top 4 by score) */}
              <View style={styles.baselineIndicatorsSection}>
                <Text style={styles.baselineIndicatorsTitle}>Starting indicator profile</Text>
                {startBaseline.indicators.slice(0, 4).map((ind, i) => {
                  const short = shortIndName(ind.name);
                  const hint = INDICATOR_PLAIN[short];
                  return (
                    <View key={i} style={{ marginBottom: 8 }}>
                      <View style={styles.baselineIndRow}>
                        <Text style={styles.baselineIndLabel} numberOfLines={1}>{short}</Text>
                        <View style={styles.baselineIndBarBg}>
                          <View style={[styles.baselineIndBarFill, {
                            width: `${ind.normalized}%` as any,
                            backgroundColor: Colors.light.tint,
                            opacity: 0.75,
                          }]} />
                        </View>
                        <Text style={styles.baselineIndPct}>{Math.round(ind.normalized)}%</Text>
                      </View>
                      {hint && <Text style={styles.baselineIndHint}>{hint}</Text>}
                    </View>
                  );
                })}
              </View>

              {currentScore === null && (
                <Text style={styles.baselineHint}>
                  Complete a speaking session in Vocabulary to track your improvement.
                </Text>
              )}

              {/* Re-run Diagnostic */}
              <TouchableOpacity
                style={styles.rerunBtn}
                onPress={async () => {
                  await AsyncStorage.setItem('diagnosticCompleted', 'pending');
                  router.push('/initial_diagnostic' as any);
                }}
                activeOpacity={0.8}
              >
                <Text style={styles.rerunBtnText}>Re-run Diagnostic →</Text>
              </TouchableOpacity>
              <Text style={styles.rerunHint}>
                Alderson (2005): re-testing with the same diagnostic measures real improvement.
              </Text>
            </View>
          );
        })()}

        {/* Overall Stats */}
        <View style={styles.overallCard}>
          <Text style={styles.cardTitle}>Overall Performance</Text>

          {/* Average Accuracy */}
          <View style={styles.statBlock}>
            <Text style={styles.statLabel}>Average Accuracy</Text>
            <Text
              style={[
                styles.statValue,
                { color: getAccuracyColor(profile.average_accuracy) },
              ]}
            >
              {Math.round(profile.average_accuracy)}%
            </Text>
            {renderAccuracyBar(profile.average_accuracy)}
          </View>

          {/* Total Sessions */}
          <View style={styles.statRow}>
            <View style={styles.statItem}>
              <Text style={styles.statSmallLabel}>Sessions Completed</Text>
              <Text style={styles.statSmallValue}>{profile.total_sessions}</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statSmallLabel}>Words Practiced</Text>
              <Text style={styles.statSmallValue}>{profile.total_words_practiced}</Text>
            </View>
          </View>

          {/* Learning Pace */}
          <View style={styles.paceBlock}>
            <Text style={styles.statLabel}>Learning Pace</Text>
            <View style={styles.paceDisplay}>
              <View
                style={[
                  styles.paceBadge,
                  {
                    backgroundColor:
                      profile.learning_pace === 'fast'
                        ? Colors.light.success + '40'
                        : profile.learning_pace === 'normal'
                          ? Colors.light.warning + '40'
                          : Colors.light.error + '40',
                  },
                ]}
              >
                <Text
                  style={[
                    styles.paceBadgeText,
                    {
                      color:
                        profile.learning_pace === 'fast'
                          ? Colors.light.success
                          : profile.learning_pace === 'normal'
                            ? Colors.light.warning
                            : Colors.light.error,
                    },
                  ]}
                >
                  {profile.learning_pace.toUpperCase()}
                </Text>
              </View>
              <Text style={styles.paceDescription}>
                {profile.learning_pace === 'fast'
                  ? 'Progressing quickly! '
                  : profile.learning_pace === 'normal'
                    ? 'Steady progress. Keep practicing!'
                    : 'Take your time. Practice makes perfect! '}
              </Text>
            </View>
          </View>
        </View>

        {/* Tips */}
        <View style={styles.tipsCard}>
          <Text style={styles.cardTitle}>Improvement Tips</Text>
          <View style={styles.tipItem}>
            <Text style={styles.tipNumber}>1</Text>
            <View style={styles.tipContent}>
              <Text style={styles.tipTitle}>Check Accent DNA for phoneme details</Text>
              <Text style={styles.tipText}>
                View which sounds need improvement and track your progress per phoneme.
              </Text>
            </View>
          </View>
          <View style={styles.tipItem}>
            <Text style={styles.tipNumber}>2</Text>
            <View style={styles.tipContent}>
              <Text style={styles.tipTitle}>Practice consistently</Text>
              <Text style={styles.tipText}>
                Regular exercises help your brain adjust to new English sounds.
              </Text>
            </View>
          </View>
          <View style={styles.tipItem}>
            <Text style={styles.tipNumber}>3</Text>
            <View style={styles.tipContent}>
              <Text style={styles.tipTitle}>Use Shadow Speaking</Text>
              <Text style={styles.tipText}>
                Practice pronunciation with native speakers for better fluency.
              </Text>
            </View>
          </View>
        </View>

        {/* Skill Acquisition — RT/CV Card */}
        <View style={styles.rtCard}>
          <Text style={styles.cardTitle}>Automatization Index</Text>
          <Text style={styles.cardDescription}>
            How fast and consistently you recognise words. As vocabulary becomes automatic, responses get quicker and steadier.
          </Text>
          <Text style={styles.rtSubtitle}>
            DeKeyser &amp; Suzuki (2025) — Skill Acquisition Theory
          </Text>
          {rtLoading ? (
            <ActivityIndicator color={Colors.light.tint} style={{ marginTop: 12 }} />
          ) : rtStats?.avg_rt_ms != null ? (
            <>
              <View style={styles.rtMetricRow}>
                <View style={styles.rtMetric}>
                  <Text style={styles.rtMetricValue}>{rtStats.avg_rt_ms}ms</Text>
                  <Text style={styles.rtMetricLabel}>Avg Response{'\n'}Time</Text>
                </View>
                <View style={styles.rtMetric}>
                  <Text style={styles.rtMetricValue}>
                    {rtStats.cv != null ? (rtStats.cv * 100).toFixed(0) + '%' : '—'}
                  </Text>
                  <Text style={styles.rtMetricLabel}>Consistency{'\n'}(lower = steadier)</Text>
                </View>
                <View style={styles.rtMetric}>
                  <Text style={styles.rtMetricValue}>{rtStats.total_responses ?? 0}</Text>
                  <Text style={styles.rtMetricLabel}>Total{'\n'}Responses</Text>
                </View>
              </View>
              {rtStats.trend.length > 1 && (
                <View style={styles.trendContainer}>
                  <Text style={styles.trendLabel}>RT Trend (session averages)</Text>
                  <View style={styles.trendBars}>
                    {rtStats.trend.map((val, i) => {
                      const maxVal = Math.max(...rtStats.trend);
                      const pct = maxVal > 0 ? (val / maxVal) : 0;
                      const isLast = i === rtStats.trend.length - 1;
                      return (
                        <View key={i} style={styles.trendBarWrap}>
                          <View
                            style={[
                              styles.trendBar,
                              {
                                height: Math.max(8, pct * 56),
                                backgroundColor: isLast ? Colors.light.tint : Colors.light.tint + '55',
                              },
                            ]}
                          />
                          <Text style={styles.trendBarLabel}>{i + 1}</Text>
                        </View>
                      );
                    })}
                  </View>
                  <Text style={styles.trendNote}>
                    Bars going down = faster responses = automatization
                  </Text>
                </View>
              )}
              <Text style={styles.rtInterpretation}>{rtStats.interpretation}</Text>
            </>
          ) : (
            <Text style={styles.rtNoData}>
              Complete vocabulary or SRS exercises to track automatization.
            </Text>
          )}
        </View>

        {/* CAF Profile Card */}
        {/* Research: Pallotti (2014); Skehan (1998); Yan et al. (2020) */}
        <View style={styles.cafCard}>
          <Text style={styles.cardTitle}>CAF Profile</Text>
          <Text style={styles.cardDescription}>
            Three key dimensions of spoken language: how complex, accurate and fluent you sound. All three improving together = real progress.
          </Text>
          <Text style={styles.cafSubtitle}>
            Pallotti (2014) · Skehan (1998) — Complexity · Accuracy · Fluency
          </Text>

          {cafSessions.length === 0 ? (
            <Text style={styles.rtNoData}>
              Complete a Vocabulary speaking session to track your CAF profile.
            </Text>
          ) : (() => {
            const latest = cafSessions[cafSessions.length - 1];
            const avgOf = (key: 'C' | 'A' | 'F') =>
              Math.round(cafSessions.slice(-5).reduce((s, e) => s + e[key], 0) / Math.min(cafSessions.length, 5));

            return (
              <>
                {/* Dimension bars */}
                {CAF_META.map(({ key, label, hint, color }) => {
                  const val = avgOf(key);
                  return (
                    <View key={key} style={styles.cafDimRow}>
                      <View style={styles.cafDimHeader}>
                        <Text style={styles.cafDimLabel}>{label}</Text>
                        <Text style={[styles.cafDimValue, { color }]}>{val}%</Text>
                      </View>
                      <View style={styles.cafBarBg}>
                        <View style={[styles.cafBarFill, { width: `${val}%` as any, backgroundColor: color }]} />
                      </View>
                      <Text style={styles.cafDimHint}>{hint}</Text>
                    </View>
                  );
                })}

                {/* Vocab CEFR level + WPS */}
                <View style={styles.cafStatRow}>
                  <View style={[styles.cafStatChip, {
                    backgroundColor: (CEFR_COLOR[latest.cefr] ?? '#8B5CF6') + '20',
                  }]}>
                    <Text style={[styles.cafStatValue, { color: CEFR_COLOR[latest.cefr] ?? '#8B5CF6' }]}>
                      {latest.cefr}
                    </Text>
                    <Text style={styles.cafStatLabel}>Vocab Level</Text>
                  </View>
                  <View style={styles.cafStatChip}>
                    <Text style={styles.cafStatValue}>{latest.wps}</Text>
                    <Text style={styles.cafStatLabel}>Words/sec</Text>
                  </View>
                  <View style={styles.cafStatChip}>
                    <Text style={styles.cafStatValue}>{cafSessions.length}</Text>
                    <Text style={styles.cafStatLabel}>Sessions</Text>
                  </View>
                </View>

                {/* CAF line chart — all sessions, 3 coloured lines */}
                {cafSessions.length > 1 && (
                  <View style={styles.chartSection}>
                    <Text style={styles.chartTitle}>C · A · F dimensions over time</Text>
                    <MultiLineChart
                      series={CAF_META.map(m => ({
                        data: cafSessions.map(s => s[m.key]),
                        color: m.color,
                        label: m.label,
                      }))}
                      minY={0}
                      maxY={100}
                    />
                    <View style={styles.chartLegend}>
                      {CAF_META.map(m => (
                        <View key={m.key} style={styles.legendItem}>
                          <View style={[styles.legendDot, { backgroundColor: m.color }]} />
                          <Text style={styles.legendLabel}>{m.label}</Text>
                        </View>
                      ))}
                    </View>
                    <Text style={styles.chartNote}>
                      Pallotti (2014): upward trend in all three dimensions = language development
                    </Text>
                  </View>
                )}
              </>
            );
          })()}
        </View>

        {/* Exam Readiness Card */}
        {/* IELTS Band Descriptors (Cambridge ESOL 2024); CEFR official conversion */}
        <View style={styles.examCard}>
          <Text style={styles.cardTitle}>Exam Readiness</Text>
          <Text style={styles.cardDescription}>
            Estimates your IELTS Speaking band (1–9) and Cambridge CEFR level based on your sessions. Includes a plain-language description of what your band means in practice.
          </Text>
          <Text style={styles.rtSubtitle}>
            IELTS Speaking bands · Cambridge CEFR (British Council / Cambridge ESOL 2024)
          </Text>

          {examSessions.length === 0 ? (
            <Text style={styles.rtNoData}>
              Complete a Vocabulary speaking session to estimate your IELTS band.
            </Text>
          ) : (() => {
            const latest = examSessions[examSessions.length - 1];
            const avgBand = Math.round(
              examSessions.slice(-5).reduce((s, e) => s + e.ielts_overall, 0)
              / Math.min(examSessions.length, 5) * 2
            ) / 2;

            const CRITERIA = [
              { key: 'fluency_coherence' as const, label: 'Fluency', color: '#8B5CF6' },
              { key: 'lexical_resource' as const,  label: 'Lexical', color: '#8B5CF6' },
              { key: 'grammatical_accuracy' as const, label: 'Grammar', color: '#0FBA9A' },
              { key: 'pronunciation' as const,     label: 'Pronunciation', color: '#8B5CF6' },
            ];

            return (
              <>
                {/* Overall band + Cambridge level */}
                <View style={styles.examOverallRow}>
                  <View style={styles.examBandCircle}>
                    <View style={styles.examBandInner}>
                      <Text style={styles.examBandNum}>{avgBand}</Text>
                      <Text style={styles.examBandSlash}>/9</Text>
                    </View>
                  </View>
                  <View style={styles.examOverallInfo}>
                    <Text style={styles.examBandLabel}>{latest.ielts.band_label}</Text>
                    <Text style={styles.examBandSub}>Avg last 5 sessions · IELTS Speaking</Text>
                    <View style={[styles.examCambridge, {
                      backgroundColor: (CEFR_COLOR[latest.cambridge_level] ?? '#8B5CF6') + '22',
                    }]}>
                      <Text style={[styles.examCambridgeLevel, {
                        color: CEFR_COLOR[latest.cambridge_level] ?? '#8B5CF6',
                      }]}>{latest.cambridge_level}</Text>
                      <Text style={styles.examCambridgeExam}>{latest.cambridge_exam}</Text>
                    </View>
                  </View>
                </View>

                {/* IELTS Band concrete descriptor */}
                <View style={styles.examDescCard}>
                  <Text style={styles.examDescTitle}>
                    Band {avgBand} — what this means for your speaking:
                  </Text>
                  <Text style={styles.examDescText}>
                    {IELTS_BAND_DESC[Math.round(avgBand)] ?? IELTS_BAND_DESC[Math.floor(avgBand)] ?? ''}
                  </Text>
                  <Text style={styles.examDescSource}>
                    British Council / Cambridge ESOL (2024) — official IELTS band descriptors
                  </Text>
                </View>

                {/* CEFR Can-Do statement */}
                <View style={[styles.examCanDoCard, {
                  borderLeftColor: CEFR_COLOR[latest.cambridge_level] ?? '#8B5CF6',
                  backgroundColor: (CEFR_COLOR[latest.cambridge_level] ?? '#8B5CF6') + '0D',
                }]}>
                  <Text style={[styles.examCanDoLevel, { color: CEFR_COLOR[latest.cambridge_level] ?? '#8B5CF6' }]}>
                    {latest.cambridge_level} — what you can do:
                  </Text>
                  <Text style={styles.examCanDoText}>
                    {CEFR_CAN_DO[latest.cambridge_level] ?? ''}
                  </Text>
                  <Text style={styles.examDescSource}>
                    Council of Europe — CEFR Global Scale (2020)
                  </Text>
                </View>

                {/* 4 criteria bars */}
                {CRITERIA.map(({ key, label, color }) => {
                  const val = latest.ielts[key];
                  const criteriaDesc: Record<string, string> = {
                    fluency_coherence:    'How smoothly and coherently you speak',
                    lexical_resource:     'Range and accuracy of vocabulary used',
                    grammatical_accuracy: 'Accuracy and range of grammar structures',
                    pronunciation:        'Clarity of sounds, stress and intonation',
                  };
                  return (
                    <View key={key} style={styles.examCriteriaRow}>
                      <View style={styles.examCriteriaHeader}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.examCriteriaLabel}>{label}</Text>
                          <Text style={styles.examCriteriaHint}>{criteriaDesc[key]}</Text>
                        </View>
                        <Text style={[styles.examCriteriaValue, { color }]}>{val}/9</Text>
                      </View>
                      <View style={styles.cafBarBg}>
                        <View style={[styles.cafBarFill, {
                          width: `${(val / 9) * 100}%` as any,
                          backgroundColor: color,
                        }]} />
                      </View>
                    </View>
                  );
                })}

                {/* IELTS band line chart — all sessions */}
                {examSessions.length > 1 && (
                  <View style={styles.chartSection}>
                    <View style={styles.chartHeaderRow}>
                      <Text style={styles.chartTitle}>IELTS band over time</Text>
                      <Text style={styles.chartYLabel}>Scale 1 – 9</Text>
                    </View>
                    <LineChart
                      data={examSessions.map(e => e.ielts_overall)}
                      color={Colors.light.tint}
                      minY={1}
                      maxY={9}
                      showGrid
                    />
                    <Text style={styles.chartNote}>
                      Cambridge ESOL (2024): band 6.5+ typically required for university admission
                    </Text>
                  </View>
                )}
              </>
            );
          })()}
        </View>

        {/* Grammar Accuracy Trend */}
        {/* Pungă & Pârlog (2015): L1 Romanian interference decreases with practice */}
        <View style={styles.grammarTrendCard}>
          <Text style={styles.cardTitle}>Grammar Accuracy Trend</Text>
          <Text style={styles.cardDescription}>
            Detects grammar mistakes typical for Romanian speakers: wrong articles, prepositions, word order, false friends and tense errors. Higher score = fewer mistakes.
          </Text>
          <Text style={styles.rtSubtitle}>
            Pungă &amp; Pârlog (2015) · Romanian L1 interference error rate
          </Text>

          {grammarSessions.length === 0 ? (
            <Text style={styles.rtNoData}>
              Complete a Vocabulary speaking session to track grammar interference errors.
            </Text>
          ) : (() => {
            const latest = grammarSessions[grammarSessions.length - 1];
            const avgScore = Math.round(
              grammarSessions.slice(-5).reduce((s, e) => s + e.severity_score, 0)
              / Math.min(grammarSessions.length, 5)
            );
            const scoreColor = avgScore >= 80 ? Colors.light.success
              : avgScore >= 55 ? Colors.light.warning : Colors.light.error;

            // Most frequent error category
            const topCategory = Object.entries(latest.categories)
              .filter(([, n]) => n > 0)
              .sort(([, a], [, b]) => b - a)[0];

            const CAT_LABELS: Record<string, string> = {
              articles: 'Articles', prepositions: 'Prepositions',
              word_order: 'Word Order', double_negation: 'Double Negation',
              false_friends: 'False Friends', tense: 'Tense / Aspect',
              collocations: 'Collocations',
            };

            return (
              <>
                {/* Score + error count row */}
                <View style={styles.grammarScoreRow}>
                  <View style={styles.grammarScoreBox}>
                    <Text style={[styles.grammarBigScore, { color: scoreColor }]}>{avgScore}</Text>
                    <Text style={styles.grammarScoreLabel}>Accuracy{'\n'}Score /100</Text>
                  </View>
                  <View style={styles.grammarScoreBox}>
                    <Text style={[styles.grammarBigScore, {
                      color: latest.error_count === 0 ? Colors.light.success : Colors.light.warning,
                    }]}>{latest.error_count}</Text>
                    <Text style={styles.grammarScoreLabel}>Error Types{'\n'}(latest)</Text>
                  </View>
                  <View style={styles.grammarScoreBox}>
                    <Text style={styles.grammarBigScore}>{grammarSessions.length}</Text>
                    <Text style={styles.grammarScoreLabel}>Sessions{'\n'}Tracked</Text>
                  </View>
                </View>

                {/* Top category */}
                {topCategory && (
                  <View style={styles.grammarTopCatRow}>
                    <Text style={styles.grammarTopCatLabel}>Most frequent error:</Text>
                    <View style={styles.grammarTopCatBadge}>
                      <Text style={styles.grammarTopCatText}>
                        {CAT_LABELS[topCategory[0]] ?? topCategory[0]} ×{topCategory[1]}
                      </Text>
                    </View>
                  </View>
                )}

                {/* Grammar accuracy line chart — all sessions */}
                {grammarSessions.length > 1 && (
                  <View style={styles.chartSection}>
                    <Text style={styles.chartTitle}>Accuracy score over time (higher = fewer errors)</Text>
                    <LineChart
                      data={grammarSessions.map(g => g.severity_score)}
                      color={Colors.light.warning}
                      minY={0}
                      maxY={100}
                      showGrid
                    />
                    <Text style={styles.chartNote}>
                      Pungă &amp; Pârlog (2015): L1 Romanian interference diminishes with consistent practice
                    </Text>
                  </View>
                )}
              </>
            );
          })()}
        </View>

        {/* Speaking Practice Trend — Accent ADN + Shadow Speaking */}
        <View style={styles.grammarTrendCard}>
          <Text style={styles.cardTitle}>Speaking Practice Trend</Text>
          <Text style={styles.cardDescription}>
            Accuracy over time from your Accent ADN (pronunciation) and Shadow Speaking (fluency) sessions.
          </Text>

          {accentSessions.length === 0 && shadowSessions.length === 0 ? (
            <Text style={styles.rtNoData}>
              Practise in Accent ADN or Shadow Speaking to see your trend here.
            </Text>
          ) : (
            <>
              {accentSessions.length > 0 && (() => {
                const series = [...accentSessions].reverse().map(s => s.accuracy_score);
                const avg = Math.round(series.slice(-5).reduce((a, v) => a + v, 0) / Math.min(series.length, 5));
                return (
                  <View style={styles.chartSection}>
                    <Text style={styles.chartTitle}>Accent ADN — pronunciation accuracy (avg {avg}%)</Text>
                    {series.length > 1
                      ? <LineChart data={series} color="#8B5CF6" minY={0} maxY={100} showGrid />
                      : <Text style={styles.chartNote}>One session so far — practise more to see a trend.</Text>}
                  </View>
                );
              })()}
              {shadowSessions.length > 0 && (() => {
                const series = [...shadowSessions].reverse().map(s => s.score);
                const avg = Math.round(series.slice(-5).reduce((a, v) => a + v, 0) / Math.min(series.length, 5));
                return (
                  <View style={styles.chartSection}>
                    <Text style={styles.chartTitle}>Shadow Speaking — fluency accuracy (avg {avg}%)</Text>
                    {series.length > 1
                      ? <LineChart data={series} color="#0FBA9A" minY={0} maxY={100} showGrid />
                      : <Text style={styles.chartNote}>One session so far — practise more to see a trend.</Text>}
                  </View>
                );
              })()}
            </>
          )}
        </View>

        {/* SM-2 Vocabulary Progress */}
        {/* Wozniak (1987): SM-2 EF-driven interval growth */}
        {/* Cepeda et al. (2006): ≥21-day interval = long-term retention */}
        <View style={styles.srsCard}>
          <Text style={styles.cardTitle}>Vocabulary Retention</Text>
          <Text style={styles.cardDescription}>
            Tracks which words you've truly memorised using spaced repetition. Words you answer correctly move to longer review intervals until they're permanently stored.
          </Text>
          <Text style={styles.rtSubtitle}>
            Wozniak (1987) SM-2 · Cepeda et al. (2006) spaced repetition
          </Text>
          {srsState == null ? (
            <Text style={styles.rtNoData}>
              Complete SRS exercises in Practice Hub to track vocabulary retention.
            </Text>
          ) : (() => {
            const { due_count, learning_count, mastered_count, new_count, total_bank } = srsState;
            const total = total_bank || 1;
            const masteredPct = (mastered_count / total) * 100;
            const learningPct = (learning_count / total) * 100;
            const duePct = (due_count / total) * 100;
            return (
              <>
                {/* 4-cell stat row */}
                <View style={styles.srsStatRow}>
                  <View style={[styles.srsStatChip, { backgroundColor: '#ef444420' }]}>
                    <Text style={[styles.srsStatNum, { color: '#ef4444' }]}>{due_count}</Text>
                    <Text style={styles.srsStatLabel}>Due{'\n'}Today</Text>
                  </View>
                  <View style={[styles.srsStatChip, { backgroundColor: Colors.light.tint + '20' }]}>
                    <Text style={[styles.srsStatNum, { color: Colors.light.tint }]}>{learning_count}</Text>
                    <Text style={styles.srsStatLabel}>In{'\n'}Learning</Text>
                  </View>
                  <View style={[styles.srsStatChip, { backgroundColor: '#0FBA9A20' }]}>
                    <Text style={[styles.srsStatNum, { color: '#0FBA9A' }]}>{mastered_count}</Text>
                    <Text style={styles.srsStatLabel}>Mastered{'\n'}(21+ days)</Text>
                  </View>
                  <View style={[styles.srsStatChip, { backgroundColor: '#64748B20' }]}>
                    <Text style={[styles.srsStatNum, { color: '#64748B' }]}>{new_count}</Text>
                    <Text style={styles.srsStatLabel}>New{'\n'}Words</Text>
                  </View>
                </View>

                {/* Stacked progress bar: mastered | learning | due | unseen */}
                <View style={styles.srsStackBarBg}>
                  <View style={[styles.srsStackSegment, {
                    width: `${masteredPct}%` as any,
                    backgroundColor: '#0FBA9A',
                  }]} />
                  <View style={[styles.srsStackSegment, {
                    width: `${learningPct}%` as any,
                    backgroundColor: Colors.light.tint,
                  }]} />
                  <View style={[styles.srsStackSegment, {
                    width: `${duePct}%` as any,
                    backgroundColor: '#ef4444',
                  }]} />
                </View>
                <View style={styles.chartLegend}>
                  {[
                    { color: '#0FBA9A', label: 'Mastered' },
                    { color: Colors.light.tint, label: 'Learning' },
                    { color: '#ef4444', label: 'Due' },
                    { color: Colors.light.border, label: 'Not started' },
                  ].map(({ color, label }) => (
                    <View key={label} style={styles.legendItem}>
                      <View style={[styles.legendDot, { backgroundColor: color }]} />
                      <Text style={styles.legendLabel}>{label}</Text>
                    </View>
                  ))}
                </View>

                <Text style={styles.srsSummary}>
                  {due_count + learning_count + mastered_count} of {total_bank} AWL words practiced · {mastered_count} mastered
                </Text>
                <Text style={styles.srsSource}>
                  Cepeda et al. (2006): spacing effect — ≥21-day interval predicts long-term retention.
                </Text>
              </>
            );
          })()}
        </View>

        {/* Performance by Domain (COCA) */}
        {/* Davies — Corpus of Contemporary American English. Identifies which
            register the user performs best in (Academic, News, Fiction, etc.). */}
        <View style={styles.domainCard}>
          <Text style={styles.cardTitle}>Performance by Domain</Text>
          <Text style={styles.cardDescription}>
            Shows which topic area (Academic, News, Fiction…) you speak most naturally in — useful for targeted practice.
          </Text>
          <Text style={styles.rtSubtitle}>
            COCA — Davies (Corpus of Contemporary American English) — 5 top-level genres
          </Text>

          {genreSessions.length === 0 ? (
            <Text style={styles.rtNoData}>
              Complete a Vocabulary speaking or writing session to see which domain
              your vocabulary aligns with.
            </Text>
          ) : (() => {
            const GENRE_COLOR: Record<string, string> = {
              SPOK: '#0FBA9A', FIC: '#8B5CF6', MAG: '#8B5CF6',
              NEWS: '#8B5CF6', ACAD: '#0FBA9A',
              Web: '#8B5CF6', Blog: '#8B5CF6', Mov: '#EF4444', TV: '#8B5CF6',
            };
            const GENRE_ICON: Record<string, React.ComponentProps<typeof Feather>['name']> = {
              SPOK: 'mic', FIC: 'book-open', MAG: 'file-text', NEWS: 'rss',
              ACAD: 'award', Web: 'globe', Blog: 'edit-3', Mov: 'film', TV: 'monitor',
            };
            const GENRE_LABEL: Record<string, string> = {
              SPOK: 'Spoken', FIC: 'Fiction', MAG: 'Magazine',
              NEWS: 'News', ACAD: 'Academic',
              Web: 'Web', Blog: 'Blog', Mov: 'Movies', TV: 'TV',
            };
            const ALL_GROUPS: CocaGroup[] = ['SPOK','FIC','MAG','NEWS','ACAD','Web','Blog','Mov','TV'];

            // Aggregate average CEFR-derived score per dominant genre
            const byGenre: Record<string, { count: number; totalScore: number }> = {};
            for (const s of genreSessions) {
              if (!s.dominant_genre) continue;
              const key = s.dominant_genre;
              if (!byGenre[key]) byGenre[key] = { count: 0, totalScore: 0 };
              byGenre[key].count += 1;
              byGenre[key].totalScore += s.cefr_score;
            }

            const sorted = Object.entries(byGenre)
              .map(([g, v]) => ({ g, avg: Math.round(v.totalScore / v.count), count: v.count }))
              .sort((a, b) => b.avg - a.avg);

            const best = sorted[0];
            const weakest = sorted[sorted.length - 1];

            return (
              <>
                {/* Strongest / weakest summary */}
                {sorted.length >= 2 && (
                  <View style={styles.domainSummaryRow}>
                    <View style={[styles.domainSummaryBox, {
                      borderLeftColor: GENRE_COLOR[best.g],
                    }]}>
                      <Text style={styles.domainSummaryLabel}>STRONGEST</Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                        <Feather name={GENRE_ICON[best.g]} size={13} color={GENRE_COLOR[best.g]} />
                        <Text style={[styles.domainSummaryGenre, { color: GENRE_COLOR[best.g] }]}>{GENRE_LABEL[best.g]}</Text>
                      </View>
                      <Text style={styles.domainSummaryScore}>{best.avg}/100</Text>
                    </View>
                    <View style={[styles.domainSummaryBox, { borderLeftColor: GENRE_COLOR[weakest.g] }]}>
                      <Text style={styles.domainSummaryLabel}>WEAKEST</Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                        <Feather name={GENRE_ICON[weakest.g]} size={13} color={GENRE_COLOR[weakest.g]} />
                        <Text style={[styles.domainSummaryGenre, { color: GENRE_COLOR[weakest.g] }]}>{GENRE_LABEL[weakest.g]}</Text>
                      </View>
                      <Text style={styles.domainSummaryScore}>{weakest.avg}/100</Text>
                    </View>
                  </View>
                )}

                {/* Bar per genre — average CEFR-derived score (all 9 COCA top-level groups) */}
                {ALL_GROUPS.map(g => {
                  const data = byGenre[g];
                  if (!data) {
                    return (
                      <View key={g} style={styles.domainBarRow}>
                        <View style={styles.domainBarLabelRow}>
                          <Feather name={GENRE_ICON[g]} size={12} color={Colors.light.textSecondary} />
                          <Text style={styles.domainBarLabel}>{GENRE_LABEL[g]}</Text>
                        </View>
                        <View style={styles.cafBarBg}>
                          <View style={[styles.cafBarFill, { width: '0%' as any, backgroundColor: Colors.light.border }]} />
                        </View>
                        <Text style={styles.domainBarPct}>—</Text>
                      </View>
                    );
                  }
                  const avg = Math.round(data.totalScore / data.count);
                  return (
                    <View key={g} style={styles.domainBarRow}>
                      <View style={styles.domainBarLabelRow}>
                        <Feather name={GENRE_ICON[g]} size={12} color={GENRE_COLOR[g]} />
                        <Text style={styles.domainBarLabel}>{GENRE_LABEL[g]}</Text>
                      </View>
                      <View style={styles.cafBarBg}>
                        <View style={[styles.cafBarFill, { width: `${avg}%` as any, backgroundColor: GENRE_COLOR[g] }]} />
                      </View>
                      <Text style={[styles.domainBarPct, { color: GENRE_COLOR[g] }]}>{avg}</Text>
                    </View>
                  );
                })}

                <Text style={styles.domainHint}>
                  Score derived from CEFR vocabulary level achieved when speaking/writing
                  on each domain ({genreSessions.length} session{genreSessions.length !== 1 ? 's' : ''}).
                  Greyed bars = no session in that domain yet.
                </Text>
              </>
            );
          })()}
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.light.background,
  },
  rtCard: {
    backgroundColor: Colors.light.surface ?? '#0F1B2D',
    borderRadius: 12,
    padding: 20,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: Colors.light.tint + '40',
  },
  rtSubtitle: {
    fontSize: 11,
    color: '#AAA',
    fontStyle: 'italic',
    marginTop: 2,
    marginBottom: 14,
  },
  rtMetricRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  rtMetric: {
    alignItems: 'center',
    flex: 1,
  },
  rtMetricValue: {
    fontSize: 22,
    fontWeight: '800',
    color: Colors.light.tint,
  },
  rtMetricLabel: {
    fontSize: 11,
    color: '#888',
    marginTop: 2,
    textAlign: 'center',
  },
  trendContainer: {
    marginTop: 8,
    marginBottom: 12,
  },
  trendLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
    marginBottom: 8,
  },
  trendBars: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: 72,
    gap: 4,
  },
  trendBarWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  trendBar: {
    width: '100%',
    borderRadius: 3,
    minHeight: 8,
  },
  trendBarLabel: {
    fontSize: 9,
    color: '#AAA',
    marginTop: 3,
  },
  trendNote: {
    fontSize: 10,
    color: '#AAA',
    fontStyle: 'italic',
    marginTop: 6,
    textAlign: 'center',
  },
  rtInterpretation: {
    fontSize: 13,
    color: Colors.light.text,
    fontWeight: '500',
    textAlign: 'center',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#EEE',
  },
  rtNoData: {
    fontSize: 13,
    color: '#888',
    textAlign: 'center',
    paddingVertical: 12,
  },
  cornerArtTR: { position: 'absolute', top: 64, right: -26, width: 220, height: 220, opacity: 1, zIndex: 3, elevation: 3, backgroundColor: 'rgba(139,92,246,0.22)', borderTopLeftRadius: 110, borderBottomRightRadius: 110, borderTopRightRadius: 38, borderBottomLeftRadius: 38, pointerEvents: 'none' },
  cornerArtBL: { position: 'absolute', bottom: 20, left: -26, width: 220, height: 220, opacity: 1, zIndex: 3, elevation: 3, backgroundColor: 'rgba(139,92,246,0.22)', borderTopLeftRadius: 110, borderBottomRightRadius: 110, borderTopRightRadius: 38, borderBottomLeftRadius: 38, pointerEvents: 'none' },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 56,
    paddingBottom: 20,
    maxWidth: 900,
    width: '100%',
    alignSelf: 'center',
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 28,
  },
  exportBtn: {
    backgroundColor: '#0FBA9A',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    shadowColor: '#0FBA9A',
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  exportBtnText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    alignSelf: 'flex-start',
    paddingLeft: 10,
    paddingRight: 16,
    paddingVertical: 9,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: '#0FBA9A',
    backgroundColor: '#0F1B2D',
  },
  backText: {
    color: '#0FBA9A',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  pageTitle: {
    color: Colors.light.text,
    fontSize: 24,
    fontWeight: '700',
    marginLeft: 12,
  },

  overallCard: {
    backgroundColor: Colors.light.surface,
    borderRadius: 12,
    padding: 20,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: Colors.light.tint + '40',
  },

  cardTitle: {
    color: Colors.light.text,
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 16,
  },

  cardSubtitle: {
    color: Colors.light.textSecondary,
    fontSize: 13,
    marginBottom: 16,
  },

  cardDescription: {
    fontSize: 13,
    color: Colors.light.text,
    lineHeight: 18,
    marginTop: -8,
    marginBottom: 4,
    opacity: 0.75,
  },

  statBlock: {
    marginBottom: 24,
  },

  statLabel: {
    color: Colors.light.textLight,
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 8,
  },

  statValue: {
    fontSize: 36,
    fontWeight: '700',
    marginBottom: 12,
  },

  accuracyBarContainer: {
    height: 8,
    backgroundColor: Colors.light.border,
    borderRadius: 4,
    overflow: 'hidden',
  },

  accuracyBarFill: {
    height: '100%',
    borderRadius: 4,
  },

  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
  },

  statItem: {
    flex: 1,
    marginRight: 12,
  },

  statSmallLabel: {
    color: Colors.light.textSecondary,
    fontSize: 12,
    marginBottom: 6,
  },

  statSmallValue: {
    color: Colors.light.text,
    fontSize: 24,
    fontWeight: '700',
  },

  paceBlock: {
    marginTop: 20,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: Colors.light.tint + '40',
  },

  paceDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  paceBadge: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginRight: 12,
  },

  paceBadgeText: {
    fontSize: 12,
    fontWeight: '700',
  },

  paceDescription: {
    color: Colors.light.textLight,
    fontSize: 13,
    flex: 1,
  },

  phonemeCard: {
    backgroundColor: Colors.light.surface,
    borderRadius: 12,
    padding: 20,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: Colors.light.tint + '40',
  },

  phonemeItem: {
    marginBottom: 16,
    paddingLeft: 12,
    paddingVertical: 12,
  },

  phonemeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },

  phonemeLabel: {
    color: Colors.light.text,
    fontSize: 15,
    fontWeight: '600',
  },

  phonemeAccuracy: {
    fontSize: 14,
    fontWeight: '700',
  },

  phonemeDetails: {
    color: Colors.light.textSecondary,
    fontSize: 12,
    marginBottom: 8,
  },

  tipsCard: {
    backgroundColor: Colors.light.surface,
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },

  tipItem: {
    flexDirection: 'row',
    marginBottom: 16,
  },

  tipNumber: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#8B5CF6' + '30',
    color: '#8B5CF6',
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 32,
    marginRight: 12,
  },

  tipContent: {
    flex: 1,
  },

  tipTitle: {
    color: Colors.light.text,
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },

  tipText: {
    color: Colors.light.textSecondary,
    fontSize: 12,
    lineHeight: 18,
  },

  // CAF Card
  cafCard: {
    backgroundColor: Colors.light.surface,
    borderRadius: 12,
    padding: 20,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: Colors.light.tint + '40',
    gap: 16,
  },
  cafSubtitle: {
    fontSize: 11,
    color: '#AAA',
    fontStyle: 'italic',
    marginTop: -10,
    marginBottom: -4,
  },
  cafDimRow: { gap: 5 },
  cafDimHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cafDimLabel: { fontSize: 13, fontWeight: '700', color: Colors.light.text },
  cafDimValue: { fontSize: 16, fontWeight: '800' },
  cafBarBg: { height: 10, backgroundColor: Colors.light.border, borderRadius: 5, overflow: 'hidden' },
  cafBarFill: { height: '100%', borderRadius: 5 },
  cafDimHint: { fontSize: 11, color: Colors.light.textLight, fontStyle: 'italic' },

  cafStatRow: { flexDirection: 'row', gap: 8 },
  cafStatChip: {
    flex: 1, alignItems: 'center', gap: 3,
    backgroundColor: Colors.light.border + '40',
    borderRadius: 10, paddingVertical: 10,
  },
  cafStatValue: { fontSize: 18, fontWeight: '800', color: Colors.light.tint },
  cafStatLabel: { fontSize: 10, color: Colors.light.textLight, fontWeight: '600', textTransform: 'uppercase' },

  // Exam Readiness Card
  examCard: {
    backgroundColor: Colors.light.surface ?? '#0F1B2D',
    borderRadius: 12, padding: 20, marginBottom: 24,
    borderWidth: 1, borderColor: Colors.light.tint + '40', gap: 14,
  },
  examOverallRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  examBandCircle: {
    width: 68, height: 68, borderRadius: 34,
    backgroundColor: Colors.light.tint + '18',
    borderWidth: 2, borderColor: Colors.light.tint + '50',
    justifyContent: 'center', alignItems: 'center',
  },
  examBandInner: {
    flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center',
  },
  examBandNum: { fontSize: 28, fontWeight: '900', color: Colors.light.tint },
  examBandSlash: { fontSize: 12, fontWeight: '600', color: Colors.light.textLight, marginBottom: 2 },
  examOverallInfo: { flex: 1, gap: 4 },
  examBandLabel: { fontSize: 15, fontWeight: '700', color: Colors.light.text },
  examBandSub: { fontSize: 11, color: Colors.light.textSecondary },
  examCambridge: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5, marginTop: 2 },
  examCambridgeLevel: { fontSize: 16, fontWeight: '800' },
  examCambridgeExam: { fontSize: 11, color: Colors.light.textSecondary, flex: 1 },
  examCriteriaRow: { gap: 4 },
  examCriteriaHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  examCriteriaLabel: { fontSize: 12, fontWeight: '600', color: Colors.light.text },
  examCriteriaHint: { fontSize: 10, color: Colors.light.textSecondary, marginTop: 1 },
  examCriteriaValue: { fontSize: 14, fontWeight: '800', minWidth: 36, textAlign: 'right' as any },

  examDescCard: {
    backgroundColor: Colors.light.background,
    borderRadius: 10, padding: 12,
    borderWidth: 1, borderColor: Colors.light.border, gap: 6,
  },
  examDescTitle: { fontSize: 11, fontWeight: '800', color: Colors.light.text, textTransform: 'uppercase' as any, letterSpacing: 0.4 },
  examDescText: { fontSize: 13, color: Colors.light.textSecondary, lineHeight: 19 },
  examDescSource: { fontSize: 10, color: Colors.light.textLight, fontStyle: 'italic', marginTop: 2 },

  examCanDoCard: {
    borderRadius: 10, padding: 12, borderLeftWidth: 3, gap: 5,
  },
  examCanDoLevel: { fontSize: 11, fontWeight: '800', textTransform: 'uppercase' as any, letterSpacing: 0.4 },
  examCanDoText: { fontSize: 13, color: Colors.light.textSecondary, lineHeight: 19 },

  // Baseline vs. Now Card
  baselineCard: {
    backgroundColor: Colors.light.surface,
    borderRadius: 16, overflow: 'hidden',
    marginBottom: 24,
    borderWidth: 1, borderColor: Colors.light.tint + '35',
  },
  baselineCardHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 18, paddingBottom: 4,
  },
  baselineSubtitle: {
    fontSize: 11, color: Colors.light.textLight, fontStyle: 'italic',
    paddingHorizontal: 20, paddingBottom: 16,
  },
  rerunBadge: {
    backgroundColor: Colors.light.tint + '18', borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 4,
    borderWidth: 1, borderColor: Colors.light.tint + '40',
  },
  rerunBadgeText: { fontSize: 11, fontWeight: '700', color: Colors.light.tint },

  // Score row
  baselineScoreRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 20,
    borderTopWidth: 1, borderBottomWidth: 1,
    borderColor: Colors.light.border,
    backgroundColor: Colors.light.background,
  },
  baselineScoreBox: { flex: 1, alignItems: 'center', gap: 10 },
  baselineScoreLabel: {
    fontSize: 10, fontWeight: '900', letterSpacing: 2,
    color: Colors.light.textSecondary,
  },
  baselineCircle: {
    width: 84, height: 84, borderRadius: 42,
    borderWidth: 3,
    justifyContent: 'center', alignItems: 'center',
    backgroundColor: Colors.light.surface,
  },
  baselineCircleInner: {
    flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center',
  },
  baselineCircleNum: { fontSize: 30, fontWeight: '900', lineHeight: 34 },
  baselineCircleMax: { fontSize: 12, color: Colors.light.textLight, marginBottom: 3 },
  baselineCircleEmpty: { fontSize: 28, fontWeight: '800', color: Colors.light.border },

  cefrBadge: {
    paddingHorizontal: 16, paddingVertical: 5, borderRadius: 8,
    borderWidth: 1, borderColor: 'transparent',
  },
  cefrBadgeText: { fontSize: 16, fontWeight: '900' },

  // Delta centre column
  baselineDeltaCol: { alignItems: 'center', gap: 6, paddingHorizontal: 8 },
  deltaBadge: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10,
    borderWidth: 1,
  },
  deltaText: { fontSize: 14, fontWeight: '900' },
  cefrDeltaText: { fontSize: 11, fontWeight: '700' },
  baselineArrow: { fontSize: 20, color: Colors.light.textLight },
  baselineNoData: { fontSize: 10, color: Colors.light.textLight, textAlign: 'center' },

  // Exam comparison row
  baselineExamRow: { flexDirection: 'row', borderBottomWidth: 1, borderColor: Colors.light.border },
  baselineExamBox: {
    flex: 1, alignItems: 'center', paddingVertical: 18, gap: 10,
  },
  baselineExamLabel: { fontSize: 11, fontWeight: '800', letterSpacing: 0.8 },
  baselineExamCompare: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  baselineExamBase: { fontSize: 18, fontWeight: '700', color: Colors.light.textSecondary },
  baselineExamArrow: { fontSize: 14, color: Colors.light.textLight, fontWeight: '600' },
  baselineExamCurrent: { fontSize: 22, fontWeight: '900' },
  baselineExamMax: { fontSize: 10, color: Colors.light.textLight },

  examMiniCircleWrap: { alignItems: 'center', gap: 4 },
  examMiniCircle: {
    width: 58, height: 58, borderRadius: 29,
    borderWidth: 2.5,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.light.background,
  },
  examMiniInner: {
    flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center',
  },
  examMiniNum: { fontSize: 18, fontWeight: '900', lineHeight: 22 },
  examMiniMax: { fontSize: 9, color: Colors.light.textLight, marginBottom: 2 },
  examMiniCircleLabel: {
    fontSize: 9, fontWeight: '800', letterSpacing: 1.2,
    color: Colors.light.textLight,
  },

  // Indicator bars
  baselineIndicatorsSection: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 6, gap: 10 },
  baselineIndicatorsTitle: {
    fontSize: 10, fontWeight: '800', letterSpacing: 1.4,
    color: Colors.light.textSecondary, textTransform: 'uppercase',
    marginBottom: 2,
  },
  baselineIndRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  baselineIndLabel: { fontSize: 12, color: Colors.light.textSecondary, width: 130 },
  baselineIndBarBg: {
    flex: 1, height: 7, backgroundColor: Colors.light.border,
    borderRadius: 4, overflow: 'hidden',
  },
  baselineIndBarFill: { height: '100%', borderRadius: 4 },
  baselineIndPct: {
    fontSize: 12, fontWeight: '800', color: Colors.light.textSecondary,
    width: 36, textAlign: 'right',
  },
  baselineIndHint: {
    fontSize: 10, color: Colors.light.textLight,
    fontStyle: 'italic', paddingLeft: 140,
  },

  baselineHint: {
    fontSize: 12, color: Colors.light.textSecondary,
    textAlign: 'center', fontStyle: 'italic',
    paddingHorizontal: 20,
  },

  // Re-run button
  rerunBtn: {
    marginHorizontal: 20, marginTop: 16, marginBottom: 4,
    backgroundColor: Colors.light.tint + '12',
    borderWidth: 1, borderColor: Colors.light.tint + '60',
    borderRadius: 12, paddingVertical: 13,
    alignItems: 'center', flexDirection: 'row',
    justifyContent: 'center', gap: 8,
  },
  rerunBtnText: { fontSize: 14, fontWeight: '700', color: Colors.light.tint },
  rerunHint: {
    fontSize: 10, color: Colors.light.textLight,
    textAlign: 'center', fontStyle: 'italic',
    paddingHorizontal: 20, paddingBottom: 16,
  },

  // Grammar Trend Card
  grammarTrendCard: {
    backgroundColor: Colors.light.surface,
    borderRadius: 12, padding: 20, marginBottom: 24,
    borderWidth: 1, borderColor: Colors.light.warning + '40', gap: 14,
  },
  grammarScoreRow: { flexDirection: 'row', justifyContent: 'space-between' },
  grammarScoreBox: { flex: 1, alignItems: 'center', gap: 4 },
  grammarBigScore: { fontSize: 30, fontWeight: '800', color: Colors.light.tint },
  grammarScoreLabel: { fontSize: 10, color: Colors.light.textSecondary, textAlign: 'center', lineHeight: 14 },

  grammarTopCatRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  grammarTopCatLabel: { fontSize: 12, color: Colors.light.textSecondary },
  grammarTopCatBadge: {
    backgroundColor: Colors.light.warning + '20',
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8,
  },
  grammarTopCatText: { fontSize: 12, fontWeight: '700', color: Colors.light.warning },

  // Performance by Domain (COCA)
  domainCard: {
    backgroundColor: Colors.light.surface,
    borderRadius: 12, padding: 20, marginBottom: 24,
    borderWidth: 1, borderColor: Colors.light.tint + '40', gap: 12,
  },
  domainSummaryRow: { flexDirection: 'row', gap: 10, marginBottom: 4 },
  domainSummaryBox: {
    flex: 1, padding: 10, borderRadius: 10,
    backgroundColor: Colors.light.border + '30',
    borderLeftWidth: 4, gap: 3,
  },
  domainSummaryLabel: { fontSize: 9, fontWeight: '800', color: Colors.light.textSecondary, letterSpacing: 1 },
  domainSummaryGenre: { fontSize: 13, fontWeight: '800' },
  domainSummaryScore: { fontSize: 13, fontWeight: '700', color: Colors.light.text },

  domainBarRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  domainBarLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 6, width: 100 },
  domainBarLabel: { fontSize: 12, fontWeight: '700', color: Colors.light.text },
  domainBarPct: { fontSize: 13, fontWeight: '800', width: 32, textAlign: 'right' },

  domainHint: { fontSize: 10, color: Colors.light.textLight, fontStyle: 'italic', textAlign: 'center', lineHeight: 14 },

  // SM-2 Vocabulary Retention Card
  srsCard: {
    backgroundColor: Colors.light.surface,
    borderRadius: 12, padding: 20, marginBottom: 24,
    borderWidth: 1, borderColor: '#0FBA9A' + '40', gap: 12,
  },
  srsStatRow: { flexDirection: 'row', gap: 8 },
  srsStatChip: {
    flex: 1, alignItems: 'center', borderRadius: 10,
    paddingVertical: 10, gap: 3,
  },
  srsStatNum: { fontSize: 22, fontWeight: '800' },
  srsStatLabel: {
    fontSize: 9, color: Colors.light.textSecondary,
    textAlign: 'center', lineHeight: 13,
  },

  srsStackBarBg: {
    flexDirection: 'row', height: 12,
    backgroundColor: Colors.light.border,
    borderRadius: 6, overflow: 'hidden',
  },
  srsStackSegment: { height: '100%' },

  srsSummary: { fontSize: 12, color: Colors.light.textSecondary, textAlign: 'center' },
  srsSource: { fontSize: 10, color: Colors.light.textLight, fontStyle: 'italic', textAlign: 'center' },

  // Shared line-chart styles
  chartSection: { gap: 8 },
  chartHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  chartTitle: { fontSize: 12, fontWeight: '700', color: Colors.light.textSecondary },
  chartYLabel: { fontSize: 10, color: Colors.light.textLight },
  chartNote: { fontSize: 10, color: '#AAA', fontStyle: 'italic' },
  chartLegend: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendLabel: { fontSize: 10, color: Colors.light.textSecondary },
});
