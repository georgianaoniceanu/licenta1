import { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Animated,
  Platform,
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Feather } from '@expo/vector-icons';
import { Colors } from '../../constants/theme';
import { VOCABULARY_ENDPOINTS } from '@/constants/api';
import { getFreshToken } from '@/utils/auth';
import { Illustrations } from '@/constants/illustrations';
import { SectionHeader, SectionHero } from '@/components/section-header';
import {
  isSpeechAvailable, warmupVoices, playRecordingOrTTS, stopAllPlayback,
} from '@/utils/voiceProfiles';
import { getDemoAudio } from '@/constants/demoAudio';
import { palette } from '@/constants/theme';

// Types
type ExamSession = {
  ts: number;
  ielts_overall: number;
  cambridge_level: string;
  cambridge_exam: string;
  ielts: { fluency_coherence: number; lexical_resource: number; grammatical_accuracy: number; pronunciation: number; band_label: string };
};
type CAFEntry = { ts: number; C: number; A: number; F: number; cefr: string; wps: number };
type GrammarSession = { ts: number; severity_score: number; error_count: number; categories: Record<string, number> };
type GenreSession = { ts: number; dominant_genre: string | null; cefr_level: string; cefr_score: number; input_mode: string };
type ShadowSession = { ts: number; category: string; difficulty: string; score: number; transcribed: string; target_text: string; audio_id?: string };

type UnifiedSession =
  | { kind: 'exam';    ts: number; data: ExamSession }
  | { kind: 'caf';     ts: number; data: CAFEntry }
  | { kind: 'grammar'; ts: number; data: GrammarSession }
  | { kind: 'genre';   ts: number; data: GenreSession }
  | { kind: 'shadow';  ts: number; data: ShadowSession };

// Helpers
const TEAL   = palette.teal;
const PURPLE = palette.purple;
const CORAL  = palette.purple;
const AMBER  = palette.purple;

const CEFR_COLOR: Record<string, string> = {
  A1: '#94A3B8', A2: '#64748B', B1: '#8B5CF6', B2: '#8B5CF6', C1: '#8B5CF6', C2: '#0FBA9A',
};

function formatDate(ts: number) {
  return new Date(ts).toLocaleDateString('ro-RO', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

// Session cards
function ExamCard({ data }: { data: ExamSession }) {
  const levelColor = CEFR_COLOR[data.cambridge_level] ?? '#8B5CF6';
  return (
    <View style={[S.card, { borderTopColor: TEAL }]}>
      <View style={S.cardRow}>
        <View style={[S.badge, { backgroundColor: TEAL + '20' }]}>
          <Text style={[S.badgeText, { color: TEAL }]}>Exam Profile</Text>
        </View>
        <Text style={S.dateText}>{formatDate(data.ts)}</Text>
      </View>
      <View style={S.cardBody}>
        <View style={S.examBandRow}>
          <View style={[S.bandCircle, { borderColor: TEAL }]}>
            <Text style={[S.bandNum, { color: TEAL }]}>{data.ielts_overall}</Text>
            <Text style={S.bandSub}>/9</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={S.examBandLabel}>{data.ielts.band_label}</Text>
            <View style={[S.cefrPill, { backgroundColor: levelColor + '22' }]}>
              <Text style={[S.cefrPillText, { color: levelColor }]}>{data.cambridge_level}</Text>
              <Text style={S.cefrExamName}>{data.cambridge_exam}</Text>
            </View>
          </View>
        </View>
        <View style={S.miniGrid}>
          {[
            { label: 'Fluency',       val: data.ielts.fluency_coherence,    color: CORAL },
            { label: 'Lexical',       val: data.ielts.lexical_resource,     color: PURPLE },
            { label: 'Grammar',       val: data.ielts.grammatical_accuracy, color: TEAL },
            { label: 'Pronunciation', val: data.ielts.pronunciation,        color: AMBER },
          ].map(({ label, val, color }) => (
            <View key={label} style={S.miniCell}>
              <Text style={[S.miniVal, { color }]}>{val}</Text>
              <Text style={S.miniLabel}>{label}</Text>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

function CAFCard({ data }: { data: CAFEntry }) {
  const cefrColor = CEFR_COLOR[data.cefr] ?? '#8B5CF6';
  return (
    <View style={[S.card, { borderTopColor: PURPLE }]}>
      <View style={S.cardRow}>
        <View style={[S.badge, { backgroundColor: PURPLE + '20' }]}>
          <Text style={[S.badgeText, { color: PURPLE }]}>CAF Profile</Text>
        </View>
        <Text style={S.dateText}>{formatDate(data.ts)}</Text>
      </View>
      <View style={S.cardBody}>
        <View style={S.miniGrid}>
          {[
            { label: 'Complexity', val: `${data.C}%`, color: PURPLE },
            { label: 'Accuracy',   val: `${data.A}%`, color: TEAL },
            { label: 'Fluency',    val: `${data.F}%`, color: CORAL },
            { label: 'Words/sec',  val: String(data.wps), color: AMBER },
          ].map(({ label, val, color }) => (
            <View key={label} style={S.miniCell}>
              <Text style={[S.miniVal, { color }]}>{val}</Text>
              <Text style={S.miniLabel}>{label}</Text>
            </View>
          ))}
        </View>
        <View style={[S.cefrPill, { backgroundColor: cefrColor + '22', alignSelf: 'flex-start', marginTop: 4 }]}>
          <Text style={[S.cefrPillText, { color: cefrColor }]}>{data.cefr}</Text>
          <Text style={S.cefrExamName}>Vocab Level</Text>
        </View>
      </View>
    </View>
  );
}

function GrammarCard({ data }: { data: GrammarSession }) {
  const scoreColor = data.severity_score >= 80 ? Colors.light.success
    : data.severity_score >= 55 ? Colors.light.warning : Colors.light.error;

  const topCat = Object.entries(data.categories)
    .filter(([, n]) => n > 0)
    .sort(([, a], [, b]) => b - a)[0];

  const CAT_LABELS: Record<string, string> = {
    articles: 'Articles', prepositions: 'Prepositions', word_order: 'Word Order',
    double_negation: 'Double Negation', false_friends: 'False Friends',
    tense: 'Tense / Aspect', collocations: 'Collocations',
  };

  return (
    <View style={[S.card, { borderTopColor: AMBER }]}>
      <View style={S.cardRow}>
        <View style={[S.badge, { backgroundColor: AMBER + '20' }]}>
          <Text style={[S.badgeText, { color: AMBER }]}>Grammar</Text>
        </View>
        <Text style={S.dateText}>{formatDate(data.ts)}</Text>
      </View>
      <View style={[S.cardBody, { flexDirection: 'row', alignItems: 'center', gap: 16 }]}>
        <View style={[S.scoreRing, { borderColor: scoreColor }]}>
          <Text style={[S.scoreRingNum, { color: scoreColor }]}>{Math.round(data.severity_score)}</Text>
          <Text style={S.scoreRingSub}>/100</Text>
        </View>
        <View style={{ flex: 1, gap: 6 }}>
          <Text style={S.grammarErrLabel}>
            {data.error_count === 0 ? 'No errors detected' : `${data.error_count} error type${data.error_count !== 1 ? 's' : ''}`}
          </Text>
          {topCat && (
            <View style={[S.topCatBadge, { backgroundColor: AMBER + '20' }]}>
              <Text style={[S.topCatText, { color: AMBER }]}>
                Top: {CAT_LABELS[topCat[0]] ?? topCat[0]} ×{topCat[1]}
              </Text>
            </View>
          )}
        </View>
      </View>
    </View>
  );
}

function GenreCard({ data }: { data: GenreSession }) {
  const GENRE_COLOR: Record<string, string> = {
    SPOK: '#0FBA9A', FIC: '#8B5CF6', MAG: '#8B5CF6', NEWS: '#8B5CF6', ACAD: '#0FBA9A',
    Web: '#8B5CF6', Blog: '#8B5CF6', Mov: '#EF4444', TV: '#8B5CF6',
  };
  const GENRE_LABEL: Record<string, string> = {
    SPOK: 'Spoken', FIC: 'Fiction', MAG: 'Magazine', NEWS: 'News', ACAD: 'Academic',
    Web: 'Web', Blog: 'Blog', Mov: 'Movies', TV: 'TV',
  };
  const GENRE_ICON: Record<string, string> = {
    SPOK: '', FIC: '', MAG: '', NEWS: '', ACAD: '',
    Web: '', Blog: '', Mov: '', TV: '',
  };
  const genreColor = data.dominant_genre ? GENRE_COLOR[data.dominant_genre] ?? '#8B5CF6' : '#8B5CF6';
  const cefrColor  = CEFR_COLOR[data.cefr_level] ?? '#8B5CF6';

  return (
    <View style={[S.card, { borderTopColor: '#0FBA9A' }]}>
      <View style={S.cardRow}>
        <View style={[S.badge, { backgroundColor: '#0FBA9A20' }]}>
          <Text style={[S.badgeText, { color: '#0FBA9A' }]}>Domain</Text>
        </View>
        <Text style={S.dateText}>{formatDate(data.ts)}</Text>
      </View>
      <View style={[S.cardBody, { flexDirection: 'row', alignItems: 'center', gap: 14 }]}>
        <View style={[S.genreIcon, { backgroundColor: genreColor + '20' }]}>
          <Text style={{ fontSize: 22 }}>
            {data.dominant_genre ? GENRE_ICON[data.dominant_genre] ?? '' : ''}
          </Text>
        </View>
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={[S.genreLabel, { color: genreColor }]}>
            {data.dominant_genre ? GENRE_LABEL[data.dominant_genre] ?? data.dominant_genre : 'Unknown'}
          </Text>
          <Text style={S.genreMode}>{data.input_mode === 'speaking' ? 'Speaking' : 'Writing'}</Text>
          <View style={[S.cefrPill, { backgroundColor: cefrColor + '22', alignSelf: 'flex-start' }]}>
            <Text style={[S.cefrPillText, { color: cefrColor }]}>{data.cefr_level}</Text>
            <Text style={S.cefrExamName}>CEFR · {Math.round(data.cefr_score)}/100</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

const SKY = palette.info;
const DIFF_COLORS: Record<string, string> = { B1: '#0FBA9A', B2: '#8B5CF6', C1: '#EF4444' };

function ShadowCard({ data, activeDemoPreset }: { data: ShadowSession; activeDemoPreset: string | null }) {
  const scoreColor = data.score >= 80 ? '#0FBA9A' : data.score >= 60 ? '#8B5CF6' : '#EF4444';
  const [playing, setPlaying] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const audioModule = getDemoAudio(data.audio_id);
  // Playback is possible if there's a real recording OR speech synthesis is available
  const canPlay = !!audioModule || isSpeechAvailable();

  // Waveform bars animation
  const waveAnims = useRef(Array.from({ length: 5 }, () => new Animated.Value(0.3))).current;
  useEffect(() => {
    if (!playing) {
      waveAnims.forEach(a => a.setValue(0.3));
      return;
    }
    const loops = waveAnims.map((v, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.timing(v, { toValue: 1,    duration: 280 + i * 70, useNativeDriver: true }),
          Animated.timing(v, { toValue: 0.25, duration: 280 + i * 70, useNativeDriver: true }),
        ])
      )
    );
    loops.forEach((l, i) => setTimeout(() => l.start(), i * 60));
    return () => loops.forEach(l => l.stop());
  }, [playing]);

  // Stop on unmount
  useEffect(() => () => { stopAllPlayback(); }, []);

  const togglePlay = () => {
    if (playing) {
      stopAllPlayback();
      setPlaying(false);
      return;
    }
    void playRecordingOrTTS({
      audioModule,
      text: data.transcribed,
      preset: activeDemoPreset,
      onStart: () => setPlaying(true),
      onEnd:   () => setPlaying(false),
      onError: () => setPlaying(false),
    });
  };

  return (
    <View style={[S.card, { borderTopColor: SKY }]}>
      <View style={S.cardRow}>
        <View style={[S.badge, { backgroundColor: SKY + '20' }]}>
          <Text style={[S.badgeText, { color: SKY }]}>Shadow Speaking</Text>
        </View>
        <Text style={S.dateText}>{formatDate(data.ts)}</Text>
      </View>
      <View style={[S.cardBody, { flexDirection: 'row', alignItems: 'center', gap: 14 }]}>
        <View style={[S.scoreRing, { borderColor: scoreColor }]}>
          <Text style={[S.scoreRingNum, { color: scoreColor }]}>{data.score}</Text>
          <Text style={S.scoreRingSub}>%</Text>
        </View>
        <View style={{ flex: 1, gap: 6 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text style={[S.badgeText, { color: Colors.light.text, fontSize: 14 }]}>{data.category}</Text>
            <View style={[S.badge, { backgroundColor: (DIFF_COLORS[data.difficulty] ?? '#8B5CF6') + '25', paddingVertical: 2 }]}>
              <Text style={[S.badgeText, { color: DIFF_COLORS[data.difficulty] ?? '#8B5CF6' }]}>{data.difficulty}</Text>
            </View>
          </View>
          <Text style={[S.dateText, { fontSize: 12 }]} numberOfLines={2}>"{data.target_text}"</Text>
        </View>
      </View>

      {/* Recording playback bar */}
      <View style={S.recordingBar}>
        <TouchableOpacity
          style={[S.playBtn, { backgroundColor: playing ? '#EF4444' : SKY }]}
          onPress={togglePlay}
          disabled={!canPlay}
          activeOpacity={0.8}
        >
          <Feather name={playing ? 'square' : 'play'} size={14} color="#fff" />
        </TouchableOpacity>

        {/* Waveform */}
        <View style={S.waveform}>
          {waveAnims.map((v, i) => (
            <Animated.View
              key={i}
              style={[
                S.waveBar,
                {
                  backgroundColor: playing ? SKY : 'rgba(255,255,255,0.06)',
                  transform: [{ scaleY: v }],
                },
              ]}
            />
          ))}
        </View>

        {audioModule && (
          <View style={S.realBadge}>
            <Text style={S.realBadgeText}>REC</Text>
          </View>
        )}

        <TouchableOpacity onPress={() => setExpanded(e => !e)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={[S.expandLabel, { color: SKY }]}>
            {expanded ? 'Hide' : 'Transcript'}
          </Text>
        </TouchableOpacity>
      </View>

      {!canPlay && Platform.OS !== 'web' && (
        <Text style={S.audioFallback}>
          Audio playback is available in the web build.
        </Text>
      )}

      {expanded && (
        <View style={S.transcriptBox}>
          <Text style={S.transcriptLabel}>TARGET</Text>
          <Text style={S.transcriptTarget}>{data.target_text}</Text>
          <Text style={[S.transcriptLabel, { marginTop: 8 }]}>RECORDED</Text>
          <Text style={S.transcriptRecorded}>{data.transcribed}</Text>
        </View>
      )}
    </View>
  );
}

// Firestore session expansion
// Each Firestore "speaking" session has caf/exam/grammar/genre sub-objects.
// Expand each into individual UnifiedSession entries matching the AsyncStorage format.
function expandFirestoreSessions(sessions: any[]): UnifiedSession[] {
  const result: UnifiedSession[] = [];
  for (const s of sessions) {
    const ts: number = s.ts ?? 0;
    if (!ts) continue;
    if (s.exam && s.exam.ielts_overall != null) {
      result.push({ kind: 'exam', ts, data: { ts, ...s.exam } as ExamSession });
    }
    if (s.caf && s.caf.C != null) {
      result.push({ kind: 'caf', ts, data: { ts, ...s.caf } as CAFEntry });
    }
    if (s.grammar && s.grammar.severity_score != null) {
      result.push({ kind: 'grammar', ts, data: { ts, ...s.grammar } as GrammarSession });
    }
    if (s.genre && s.genre.dominant_genre != null) {
      result.push({ kind: 'genre', ts, data: { ts, ...s.genre } as GenreSession });
    }
  }
  return result;
}

// Screen
export default function HistoryScreen() {
  const router = useRouter();
  const [sessions, setSessions] = useState<UnifiedSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeDemoPreset, setActiveDemoPreset] = useState<string | null>(null);

  // Warm up Web Speech voices on mount (web only)
  useEffect(() => { warmupVoices(); return () => { stopAllPlayback(); }; }, []);

  const load = useCallback(async () => {
    try {
      // 1. AsyncStorage (fast, works offline)
      const [rawExam, rawCaf, rawGrammar, rawGenre, rawShadow, rawDemo] = await Promise.all([
        AsyncStorage.getItem('vf_exam_sessions'),
        AsyncStorage.getItem('vf_caf_sessions'),
        AsyncStorage.getItem('vf_grammar_sessions'),
        AsyncStorage.getItem('vf_genre_sessions'),
        AsyncStorage.getItem('vf_shadow_sessions'),
        AsyncStorage.getItem('active_demo_preset'),
      ]);
      setActiveDemoPreset(rawDemo);

      const fromStorage: UnifiedSession[] = [
        ...(rawExam    ? (JSON.parse(rawExam)    as ExamSession[]).map(d => ({ kind: 'exam'    as const, ts: d.ts, data: d })) : []),
        ...(rawCaf     ? (JSON.parse(rawCaf)     as CAFEntry[]).map(d => ({ kind: 'caf'     as const, ts: d.ts, data: d })) : []),
        ...(rawGrammar ? (JSON.parse(rawGrammar) as GrammarSession[]).map(d => ({ kind: 'grammar' as const, ts: d.ts, data: d })) : []),
        ...(rawGenre   ? (JSON.parse(rawGenre)   as GenreSession[]).map(d => ({ kind: 'genre'   as const, ts: d.ts, data: d })) : []),
        ...(rawShadow  ? (JSON.parse(rawShadow)  as ShadowSession[]).map(d => ({ kind: 'shadow'  as const, ts: d.ts, data: d })) : []),
      ];

      // 2. Firestore (survives reinstall)
      let fromFirestore: UnifiedSession[] = [];
      try {
        const token = await getFreshToken();
        if (token) {
          const r = await fetch(VOCABULARY_ENDPOINTS.SESSIONS, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (r.ok) {
            const j = await r.json();
            fromFirestore = expandFirestoreSessions(j.data ?? []);
          }
        }
      } catch {
        // Firestore unreachable — continue with AsyncStorage only
      }

      // 3. Merge: dedup by kind+ts, sort newest first
      const storageKeys = new Set(fromStorage.map(s => `${s.kind}:${s.ts}`));
      const merged = [
        ...fromStorage,
        ...fromFirestore.filter(s => !storageKeys.has(`${s.kind}:${s.ts}`)),
      ].sort((a, b) => b.ts - a.ts);

      setSessions(merged);
    } catch (e) {
      console.error('History load error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = () => { setRefreshing(true); load(); };

  return (
    <View style={S.root}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={S.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={TEAL} />}
      >
        <View style={S.header}>
          <TouchableOpacity style={S.backBtn} onPress={() => router.back()}>
            <Feather name="chevron-left" size={18} color={TEAL} />
            <Text style={S.backText}>Back</Text>
          </TouchableOpacity>
        </View>

        <SectionHero
          art={Illustrations.audioFiles}
          title="Session History"
          subtitle="All your practice sessions · pull to refresh."
        />

        {loading && <ActivityIndicator color={TEAL} size="large" style={{ marginTop: 40 }} />}

        {!loading && sessions.length === 0 && (
          <View style={S.empty}>
            <Image source={Illustrations.emptyHistory} style={S.emptyArt} resizeMode="contain" />
            <Text style={S.emptyTitle}>No sessions yet</Text>
            <Text style={S.emptySubtitle}>
              Complete a Vocabulary speaking session to see your history here.
            </Text>
            <TouchableOpacity style={S.startBtn} onPress={() => router.push('/(tabs)/vocabulary' as any)}>
              <Text style={S.startBtnText}>Go to Vocabulary →</Text>
            </TouchableOpacity>
          </View>
        )}

        {sessions.map((s, i) => {
          if (s.kind === 'exam')    return <ExamCard    key={`exam-${s.ts}-${i}`}    data={s.data} />;
          if (s.kind === 'caf')     return <CAFCard     key={`caf-${s.ts}-${i}`}     data={s.data} />;
          if (s.kind === 'grammar') return <GrammarCard key={`grammar-${s.ts}-${i}`} data={s.data} />;
          if (s.kind === 'genre')   return <GenreCard   key={`genre-${s.ts}-${i}`}   data={s.data} />;
          if (s.kind === 'shadow')  return <ShadowCard  key={`shadow-${s.ts}-${i}`}  data={s.data} activeDemoPreset={activeDemoPreset} />;
          return null;
        })}

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

// Styles
const S = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.light.background },
  scroll: { paddingHorizontal: 20, paddingTop: 56, maxWidth: 900, width: '100%', alignSelf: 'center' },

  header: { flexDirection: 'row', marginBottom: 20 },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 1, paddingVertical: 6, paddingRight: 12 },
  backText: { color: TEAL, fontSize: 15, fontWeight: '600' },

  pageTitle: { color: Colors.light.text, fontSize: 26, fontWeight: '800', letterSpacing: -0.4, marginBottom: 4 },
  pageSubtitle: { color: Colors.light.textSecondary, fontSize: 13, marginBottom: 24 },

  empty: { alignItems: 'center', paddingTop: 60, gap: 12 },
  emptyIcon: { fontSize: 48 },
  emptyArt: { width: 250, height: 185, marginBottom: 4 },
  cornerArtTR: { position: 'absolute', top: 60, right: -26, width: 220, height: 220, opacity: 1, zIndex: 3, elevation: 3, backgroundColor: 'rgba(139,92,246,0.22)', borderTopLeftRadius: 110, borderBottomRightRadius: 110, borderTopRightRadius: 38, borderBottomLeftRadius: 38, pointerEvents: 'none' },
  cornerArtBL: { position: 'absolute', bottom: 20, left: -26, width: 220, height: 220, opacity: 1, zIndex: 3, elevation: 3, backgroundColor: 'rgba(139,92,246,0.22)', borderTopLeftRadius: 110, borderBottomRightRadius: 110, borderTopRightRadius: 38, borderBottomLeftRadius: 38, pointerEvents: 'none' },
  emptyTitle: { color: Colors.light.text, fontSize: 18, fontWeight: '700' },
  emptySubtitle: { color: Colors.light.textSecondary, fontSize: 14, textAlign: 'center', lineHeight: 20 },
  startBtn: { marginTop: 8, backgroundColor: TEAL, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 14 },
  startBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },

  card: {
    backgroundColor: Colors.light.surface,
    borderRadius: 16, borderWidth: 1,
    borderColor: Colors.light.border,
    borderTopWidth: 3, marginBottom: 14, overflow: 'hidden',
  },
  cardRow: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', padding: 14,
    borderBottomWidth: 1, borderBottomColor: Colors.light.border,
  },
  badge: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20 },
  badgeText: { fontSize: 12, fontWeight: '700' },
  dateText: { color: Colors.light.textSecondary, fontSize: 12 },
  cardBody: { padding: 14, gap: 10 },

  // Exam
  examBandRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  bandCircle: {
    width: 56, height: 56, borderRadius: 28, borderWidth: 3,
    justifyContent: 'center', alignItems: 'center',
    flexDirection: 'row', paddingBottom: 3,
    backgroundColor: Colors.light.background,
  },
  bandNum: { fontSize: 20, fontWeight: '900' },
  bandSub: { fontSize: 10, color: Colors.light.textLight, alignSelf: 'flex-end', marginBottom: 1 },
  examBandLabel: { fontSize: 13, fontWeight: '700', color: Colors.light.text, marginBottom: 4 },
  cefrPill: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4, alignSelf: 'flex-start' },
  cefrPillText: { fontSize: 14, fontWeight: '800' },
  cefrExamName: { fontSize: 11, color: Colors.light.textSecondary },

  miniGrid: { flexDirection: 'row', gap: 8 },
  miniCell: { flex: 1, alignItems: 'center', backgroundColor: Colors.light.background, borderRadius: 10, paddingVertical: 10, gap: 3 },
  miniVal: { fontSize: 16, fontWeight: '800' },
  miniLabel: { fontSize: 9, color: Colors.light.textSecondary, fontWeight: '600', textTransform: 'uppercase' },

  // Score ring (grammar)
  scoreRing: {
    width: 62, height: 62, borderRadius: 31, borderWidth: 3,
    justifyContent: 'center', alignItems: 'center',
    flexDirection: 'row', paddingBottom: 3,
    backgroundColor: Colors.light.background,
  },
  scoreRingNum: { fontSize: 18, fontWeight: '900' },
  scoreRingSub: { fontSize: 10, color: Colors.light.textLight, alignSelf: 'flex-end', marginBottom: 1 },
  grammarErrLabel: { fontSize: 13, fontWeight: '600', color: Colors.light.text },
  topCatBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, alignSelf: 'flex-start' },
  topCatText: { fontSize: 12, fontWeight: '700' },

  // Genre
  genreIcon: { width: 52, height: 52, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  genreLabel: { fontSize: 15, fontWeight: '800' },
  genreMode: { fontSize: 12, color: Colors.light.textSecondary },

  // Shadow recording playback
  recordingBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingBottom: 12,
    paddingTop: 4,
  },
  playBtn: {
    width: 36, height: 36, borderRadius: 18,
    justifyContent: 'center', alignItems: 'center',
    shadowColor: '#000', shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 2 }, shadowRadius: 4, elevation: 2,
  },
  waveform: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-evenly',
    height: 28,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 14,
    paddingHorizontal: 12,
  },
  waveBar: {
    width: 3,
    height: 22,
    borderRadius: 2,
  },
  expandLabel: { fontSize: 12, fontWeight: '700' },
  realBadge: {
    backgroundColor: '#EF4444',
    borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1,
  },
  realBadgeText: { fontSize: 8, fontWeight: '900', color: '#fff', letterSpacing: 0.5 },
  audioFallback: {
    fontSize: 10, color: Colors.light.textLight,
    fontStyle: 'italic',
    paddingHorizontal: 14, paddingBottom: 8,
  },

  // Transcript expanded view
  transcriptBox: {
    marginHorizontal: 14, marginBottom: 12,
    padding: 12,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 10,
    borderWidth: 1, borderColor: Colors.light.border,
  },
  transcriptLabel: {
    fontSize: 9, fontWeight: '900',
    color: Colors.light.textSecondary,
    letterSpacing: 1, marginBottom: 4,
  },
  transcriptTarget: {
    fontSize: 12, color: Colors.light.text,
    lineHeight: 17, fontStyle: 'italic',
  },
  transcriptRecorded: {
    fontSize: 12, color: Colors.light.text,
    lineHeight: 17, fontWeight: '600',
  },
});
