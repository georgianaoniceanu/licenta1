/**
 * Home Dashboard — Personalized learner overview
 *
 * Research Foundation:
 * ─────────────────────────────────────────────────────────────────────────────
 * Predicted CEFR & overall score: Assessment Indicators Calculator
 *   (Ahari et al. 2025; Lee 2021; CAF framework — Pallotti 2015)
 *
 * Re-assessment tracking: quantitative progress comparison
 *   (Norris & Ortega 2009; Alderson 2005 diagnostic cycle)
 *
 * Module recommendations: indicator-to-module gap mapping
 *   (Module Effectiveness — module_effectiveness.py)
 *
 * Dual Diagnosis badge: self-perception vs. system measurement
 *   (Alderson 2005; Present-Thomas et al. 2013)
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  SafeAreaView,
  Animated,
  ActivityIndicator,
  RefreshControl,
  Dimensions,
  Alert,
  Modal,
  Pressable,
} from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getAuth, signOut } from 'firebase/auth';
import { getFreshToken } from '@/utils/auth';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { API_URL } from '@/constants/api';
import { getStreak, type StreakData } from '@/utils/streak';
import { loadDemoProfile, clearDemoData, getJobDemoUsers, type DemoPreset, type JobPreset, type AnyPreset } from '@/utils/demoMode';
import { JOBS_BY_ID } from '@/constants/jobsDatabase';
import { warmupVoices } from '@/utils/voiceProfiles';
import { useLanguage } from '@/context/Language';
import { useLearnerProfile } from '@/context/LearnerProfile';
import { tr } from '@/constants/translations';

const { width } = Dimensions.get('window');

// ─── Types ────────────────────────────────────────────────────────────────────

type Indicator = {
  name: string;
  normalized: number;
  score?: number;
  severity: 'critical' | 'moderate' | 'acceptable' | 'strong';
  cefr_level: string;
  interpretation?: string;
};

type BaselineDiagnosis = {
  predicted_cefr: string;
  overall_score: number;
  indicators: Indicator[];
  critical_areas: string[];
  strengths: string[];
  priority_recommendations: string[];
};

type OnboardingProfile = {
  self_assessed_cefr?: string;
  primary_goal?: string;
  target_domain?: string;
  target_exam?: string;
  perceived_weak_areas?: string[];
  daily_study_minutes?: number;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const BG     = '#F8FAFC';
const CARD   = '#FFFFFF';
const BORDER = '#E8ECF0';
const TEAL   = '#0FBA9A';
const CORAL  = '#FF6B47';
const PURPLE = '#7C6FFF';
const NAVY   = '#0A1628';
const TEXT   = '#1E293B';
const TEXT2  = '#64748B';
const TEXT3  = '#94A3B8';

const SEVERITY_COLORS: Record<string, string> = {
  critical:   '#EF4444',
  moderate:   '#F59E0B',
  acceptable: '#0FBA9A',
  strong:     '#7C6FFF',
};

const CEFR_COLORS: Record<string, string> = {
  A1: '#94A3B8',
  A2: '#64748B',
  B1: '#3B82F6',
  B2: '#8B5CF6',
  C1: '#F59E0B',
  C2: '#1EE8B5',
};


// ─── Animated Waveform ────────────────────────────────────────────────────────

const WAVE_HEIGHTS = [14, 28, 44, 24, 38, 52, 20, 40, 32, 48, 26, 36, 18, 46, 30, 42, 22, 34, 50, 26, 16, 44, 28, 38];

const WaveBar = ({ maxH, delay, color }: { maxH: number; delay: number; color: string }) => {
  const anim = useRef(new Animated.Value(0.3)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 1, duration: 580 + delay * 1.4, delay, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0.25, duration: 580 + delay * 1.4, useNativeDriver: true }),
      ])
    ).start();
  }, []);
  return (
    <Animated.View
      style={{
        width: 3,
        height: maxH,
        borderRadius: 2,
        backgroundColor: color,
        marginHorizontal: 1.5,
        transform: [{ scaleY: anim }],
        opacity: anim.interpolate({ inputRange: [0.25, 1], outputRange: [0.35, 0.9] }),
      }}
    />
  );
};

const AnimatedWaveform = () => (
  <View style={{ flexDirection: 'row', alignItems: 'center', height: 56 }}>
    {WAVE_HEIGHTS.map((h, i) => (
      <WaveBar key={i} maxH={h} delay={i * 50} color={i % 2 === 0 ? TEAL : CORAL} />
    ))}
  </View>
);

// ─── Indicator info definitions ──────────────────────────────────────────────

type IndicatorInfo = { eli5: string; plain: string; formula: string; studies: string; rationale: string };

const INDICATOR_INFO: Record<string, IndicatorInfo> = {
  'Vocabulary Range': {
    eli5: 'Imagine you have a bag of words. This measures how many DIFFERENT words are in your bag. If you keep saying "good" instead of "excellent", "great", "outstanding" — your bag looks small. A bigger, more varied bag = higher score.',
    plain: 'How many different words you use relative to total words spoken.',
    formula: 'D index (VOCD) — probability-based estimate of lexical diversity corrected for text length; or Type-Token Ratio (TTR) normalized to 50-word samples.',
    studies: 'Malvern, Richards, Chipere & Durán (2004) — Lexical Diversity and Language Development; Jarvis (2013) — Defining and Measuring Lexical Diversity; Lee (2021) — CEFR alignment of spoken metrics.',
    rationale: 'CEFR descriptors explicitly require broader vocabulary at each level (A2: everyday topics → C1: broad lexical repertoire). D-index is robust across text lengths and validated on L2 English learner corpora.',
  },
  'Word Sophistication': {
    eli5: 'Not just HOW MANY different words, but HOW ADVANCED they are. Saying "use" is basic. Saying "utilise" or "leverage" is sophisticated. This score rewards you for picking rarer, more advanced words — the ones you\'d find in a newspaper or academic text.',
    plain: 'Proportion of advanced, low-frequency words in your speech.',
    formula: 'Lexical Frequency Profile (LFP) — percentage of words outside the 2,000 most frequent English words (Nation BNC lists); high % = more sophisticated.',
    studies: 'Laufer & Nation (1995) — Vocabulary Size and Use; Schmitt (2010) — Vocabulary in Language Teaching; Nation (2006) — How large a vocabulary is needed for reading and listening.',
    rationale: 'High-frequency words dominate A2/B1 output; B2/C1 speakers use significantly more low-frequency vocabulary. LFP is used in automatic IELTS and Cambridge writing scoring.',
  },
  'Sentence Length': {
    eli5: 'Short sentences are easy. "I went. I saw. I left." Long sentences pack more information: "I went to the market, which was crowded, because I needed ingredients for the dinner I was planning." This score measures whether you can build longer, information-rich sentences.',
    plain: 'Average number of words per sentence or T-unit.',
    formula: 'Mean Length of T-Unit (MLTU) — each T-unit = one independent clause + subordinate clauses; measured in words per unit from transcribed speech.',
    studies: 'Hunt (1965) — Grammatical Structures Written at Three Grade Levels; Ortega (2003) — Syntactic complexity and L2 proficiency; Lee (2021).',
    rationale: 'Longer T-units correlate with CEFR level in learner corpora (Ortega 2003). They indicate the ability to embed information — a key B2+ discourse marker.',
  },
  'Subordination': {
    eli5: 'Can you connect ideas using words like "because", "although", "which", "even though", "despite"? A beginner says: "I was tired. I went to bed." An advanced speaker says: "Although I had planned to study, I went to bed because I was exhausted." This score counts those connectors.',
    plain: 'How often you use subordinate clauses — "because", "although", "which", "that"…',
    formula: 'Subordination Ratio = total clauses ÷ T-units; includes relative, adverbial, and complement clauses detected via dependency parsing.',
    studies: 'Norris & Ortega (2009) — Towards an organic approach to CAF in instructed SLA; Pallotti (2014) — A simple view of linguistic complexity.',
    rationale: 'One of the most robust syntactic complexity metrics. Distinguishes B1 (low subordination) from B2/C1 (frequent complex embedding). Used in automated CAE essay scoring.',
  },
  'Syntactic Richness': {
    eli5: 'Think of it as "how fancy is your sentence structure". Basic: "The dog ran." Richer: "The exhausted dog, chased by the neighbour\'s cat, ran across the freshly mown garden." More detail packed into the noun phrases = richer syntax = higher score.',
    plain: 'Variety and density of syntactic structures per sentence.',
    formula: 'Complex Nominal ratio — number of noun phrases with modifiers or embedded clauses per T-unit, via NLP constituency parser.',
    studies: 'Lu (2010) — Automatic analysis of syntactic complexity in second language writing; Ortega (2003).',
    rationale: 'Captures noun phrase density — orthogonal to subordination. Correlates with IELTS Writing Band 6.5+ and is used in the e-rater automated scoring system.',
  },
  'Speech Rate': {
    eli5: 'Simply: how fast you speak, not counting the pauses. Native English speakers fire off about 4–5 syllables every second. If you speak much slower, it signals that you\'re searching for words mid-sentence. Faster (up to a natural limit) = more automatic = higher score.',
    plain: 'How many words you produce per second, pauses excluded.',
    formula: 'Articulation Rate = syllables per second during fluent speech segments (silent pauses > 200 ms excluded); measured via forced-alignment on the audio signal.',
    studies: 'Cucchiarini, Strik & Boves (2002) — Quantitative assessment of second language learners\' fluency; de Jong & Wempe (2009) — Praat script for syllable nuclei detection.',
    rationale: 'Native English speakers average 4–5 syllables/second. L2 learners slow down due to lexical retrieval difficulty. Articulation rate is the primary IELTS Fluency & Coherence sub-criterion.',
  },
  'Fluency': {
    eli5: 'This counts your "ums", "uhs", "like", and awkward pauses. Every time you say "um" you lose points. Think of it as measuring how smooth the river of your speech is — no rocks (fillers), no dams (long pauses). The smoother, the higher.',
    plain: 'How smoothly you speak — fewer "um/uh" and false starts = higher score.',
    formula: 'Fluency = 100 − (pause_rate × 70 + filler_rate × 30); pause_rate = pauses > 200 ms per minute; filler_rate = "um", "uh", "like", "you know" per 100 words.',
    studies: 'Lennon (1990) — Investigating fluency in EFL; Segalowitz (2010) — Cognitive Bases of Second Language Fluency; IELTS band descriptors (Cambridge ESOL 2024).',
    rationale: 'Pause and disfluency frequency maps directly to IELTS Fluency & Coherence bands 4–8. Reducing filler words is the single highest-ROI intervention for band improvement.',
  },
  'Coherence': {
    eli5: 'Imagine your speech as a necklace. Each sentence is a bead. Coherence measures how well the beads are connected — do your ideas flow naturally from one to the next, or do they just fall on the floor randomly? Words like "however", "therefore", "as a result" are the thread.',
    plain: 'How well your ideas connect and flow as a whole.',
    formula: 'Coh-Metrix Referential Cohesion score — measures pronoun–antecedent links, lexical repetition, and connective use ("however", "therefore", "in addition") across sentences.',
    studies: 'McNamara & Graesser (2012) — Coh-Metrix: An Automated Tool for NLP; Crossley & McNamara (2010) — Cohesion, coherence, and expert evaluations of writing proficiency.',
    rationale: 'Coherence distinguishes B1 (basic cohesion) from C1 (full discourse organisation). It is one of the four Cambridge Writing criteria and correlates r = 0.61 with expert rater scores.',
  },
  'Grammar Accuracy': {
    eli5: 'Did you say "I go to school yesterday" instead of "I went"? Did you skip the article ("I have car" instead of "I have a car")? This score penalises those mistakes, with trickier errors (wrong tense, false friends) counting more than small ones (missing "the").',
    plain: 'Correctness of verb tenses, articles, prepositions, and word order.',
    formula: 'Weighted error score: 100 − (Σ errors × weight); articles/prepositions weight ×1, tense errors ×2, structural errors ×3. Errors detected by a Romanian-interference grammar model.',
    studies: 'Ellis (1994) — The Study of Second Language Acquisition; Pungă & Pârlog (2015) — Romanian EFL Learner Language; Norris & Ortega (2009).',
    rationale: 'Romanian speakers show predictable L1-transfer errors (missing articles, wrong prepositions, false friends). Severity weighting mirrors the IELTS Grammatical Range & Accuracy criterion.',
  },
  'Vocabulary Level': {
    eli5: 'Not just whether you use varied or advanced words — but what CEFR level those words belong to. Every English word has been assigned an A1–C2 level by Cambridge researchers. This score averages the CEFR level of all the words you actually said. Mostly A2 words → A2 score. Mix of B2/C1 words → much higher.',
    plain: 'The CEFR level of the vocabulary you actually use in speech.',
    formula: 'Proportion of words at each CEFR band (A1–C2) from the English Vocabulary Profile (EVP); overall level = frequency-weighted average mapped to the 0–100 scale.',
    studies: 'Capel (2010) — A1–B2 vocabulary: insights and issues arising from the English Profile; Nation & Waring (1997) — Vocabulary size, text coverage, and word lists; Lee (2021).',
    rationale: 'The Cambridge English Vocabulary Profile maps 7,500+ words to CEFR levels using learner corpus evidence. Gives a direct, evidence-based CEFR assignment for vocabulary rather than relying on frequency alone.',
  },
};

function resolveInfo(name: string): IndicatorInfo | null {
  if (INDICATOR_INFO[name]) return INDICATOR_INFO[name];
  // Fuzzy match for backend long names (e.g. "Lexical Diversity (D Index / VOCD)")
  const clean = name.replace(/\s*\([^)]*\)\s*/g, '').trim();
  return INDICATOR_INFO[clean] ?? null;
}

// ─── Indicator Bar Row ────────────────────────────────────────────────────────

const IndicatorRow = ({ item, index, onInfo }: { item: Indicator; index: number; onInfo: () => void }) => {
  const barAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(barAnim, {
      toValue: (item.normalized ?? item.score ?? 0) / 100,
      duration: 700 + index * 60,
      delay: 300 + index * 45,
      useNativeDriver: false,
    }).start();
  }, []);
  const color = SEVERITY_COLORS[item.severity] ?? TEAL;
  return (
    <View style={IR.row}>
      <TouchableOpacity style={IR.nameWrap} onPress={onInfo} activeOpacity={0.6} hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}>
        <Text style={IR.name} numberOfLines={1}>{item.name}</Text>
        <Feather name="info" size={11} color={TEXT2} style={{ marginLeft: 3, opacity: 0.7 }} />
      </TouchableOpacity>
      <View style={IR.barWrap}>
        <Animated.View
          style={[
            IR.bar,
            {
              backgroundColor: color,
              width: barAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
            },
          ]}
        />
      </View>
      <View style={[IR.tag, { backgroundColor: color + '18' }]}>
        <Text style={[IR.tagText, { color }]}>{item.cefr_level}</Text>
      </View>
    </View>
  );
};

const IR = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 11,
    gap: 10,
  },
  nameWrap: {
    width: 112,
    flexDirection: 'row',
    alignItems: 'center',
  },
  name: {
    fontSize: 12,
    color: TEXT2,
    fontWeight: '500',
    flexShrink: 1,
  },
  barWrap: {
    flex: 1,
    height: 6,
    backgroundColor: '#F1F5F9',
    borderRadius: 3,
    overflow: 'hidden',
  },
  bar: {
    height: 6,
    borderRadius: 3,
  },
  tag: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    minWidth: 30,
    alignItems: 'center',
  },
  tagText: {
    fontSize: 10,
    fontWeight: '800',
  },
});

// ─── Module Row ───────────────────────────────────────────────────────────────

const ModuleRow = ({
  label, subtitle, icon, route, color,
}: {
  label: string; subtitle: string; icon: string; route: string; color: string;
}) => {
  const router = useRouter();
  const pressAnim = useRef(new Animated.Value(1)).current;
  const onPressIn  = () => Animated.spring(pressAnim, { toValue: 0.97, useNativeDriver: true }).start();
  const onPressOut = () => Animated.spring(pressAnim, { toValue: 1,    useNativeDriver: true }).start();
  return (
    <TouchableOpacity
      onPress={() => router.push(route as any)}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      activeOpacity={1}
    >
      <Animated.View style={[MR.row, { transform: [{ scale: pressAnim }] }]}>
        <View style={[MR.iconWrap, { backgroundColor: color + '14' }]}>
          <Feather name={icon as any} size={18} color={color} />
        </View>
        <View style={MR.textCol}>
          <Text style={MR.label}>{label}</Text>
          <Text style={MR.subtitle}>{subtitle}</Text>
        </View>
        <Feather name="chevron-right" size={16} color={TEXT3} />
      </Animated.View>
    </TouchableOpacity>
  );
};

const MR = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: CARD,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: BORDER,
    marginBottom: 10,
    gap: 14,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  textCol: { flex: 1, gap: 2 },
  label:    { fontSize: 15, fontWeight: '700', color: TEXT },
  subtitle: { fontSize: 12, color: TEXT2 },
});

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function HomeScreen() {
  const router = useRouter();
  const auth   = getAuth();
  const user   = auth.currentUser;
  const { lang } = useLanguage();
  const { loadProfile } = useLearnerProfile();

  const TRAINING_MODULES = [
    { label: tr('modAccentDna', lang), subtitle: tr('modAccentSub', lang), icon: 'mic',      route: '/(tabs)/accent',     color: CORAL  },
    { label: tr('modShadow', lang),    subtitle: tr('modShadowSub', lang), icon: 'volume-2', route: '/(tabs)/shadow',     color: PURPLE },
    { label: tr('modVocabulary', lang),subtitle: tr('modVocabSub', lang), icon: 'book',     route: '/(tabs)/vocabulary', color: TEAL   },
  ];
  const TOOL_MODULES = [
    { label: tr('modPractice', lang),   subtitle: tr('modPracticeSub', lang),   icon: 'zap',         route: '/(tabs)/practice',   color: '#0FBA9A' },
    { label: tr('modProgress', lang),   subtitle: tr('modProgressSub', lang),   icon: 'bar-chart-2', route: '/(tabs)/progress',   color: '#F59E0B' },
    { label: tr('modAssessment', lang), subtitle: tr('modAssessmentSub', lang), icon: 'clipboard',   route: '/(tabs)/assessment', color: '#10B981' },
  ];

  const [diagnosis,       setDiagnosis]       = useState<BaselineDiagnosis | null>(null);
  const [profile,         setProfile]         = useState<OnboardingProfile | null>(null);
  const [loading,         setLoading]         = useState(true);
  const [refreshing,      setRefreshing]      = useState(false);
  const [streak,          setStreak]          = useState<StreakData>({ current: 0, best: 0 });
  const [showNotifBanner, setShowNotifBanner] = useState(false);
  const [demoLoading,     setDemoLoading]     = useState<AnyPreset | null>(null);
  const [infoIndicator,   setInfoIndicator]   = useState<string | null>(null);

  const fadeAnim = useRef(new Animated.Value(0)).current;

  const firstName =
    user?.displayName?.split(' ')[0] ||
    user?.email?.split('@')[0] ||
    'Learner';

  const loadData = useCallback(async () => {
    try {
      const [storedDiagnosis, originalDiagnosis, token, streakData, settingsRaw] = await Promise.all([
        AsyncStorage.getItem('baselineDiagnosis'),
        AsyncStorage.getItem('baselineDiagnosisOriginal'),
        getFreshToken(),
        getStreak(),
        AsyncStorage.getItem('app_settings'),
      ]);

      setStreak(streakData);

      // In-app notification banners
      const appSettings = settingsRaw ? JSON.parse(settingsRaw) : null;
      if (appSettings?.notifications?.dailyReminder) {
        const lastActive = await AsyncStorage.getItem('streak_last_active');
        const today = new Date().toISOString().slice(0, 10);
        if (lastActive !== today) {
          setShowNotifBanner(true);
        }
      }

      // Auto-recover: if main key was accidentally wiped but original backup exists
      let diagnosisRaw = storedDiagnosis;
      if (!diagnosisRaw && originalDiagnosis) {
        diagnosisRaw = originalDiagnosis;
        await AsyncStorage.setItem('baselineDiagnosis', originalDiagnosis);
        await AsyncStorage.setItem('diagnosticCompleted', 'true');
      }

      setDiagnosis(diagnosisRaw ? JSON.parse(diagnosisRaw) : null);
      if (token) {
        const res = await fetch(`${API_URL}/auth/onboarding`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) setProfile(await res.json());
      }
    } catch (e) {
      console.error('Dashboard load error:', e);
    } finally {
      setLoading(false);
      Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }).start();
    }
  }, []);

  useEffect(() => { loadData(); warmupVoices(); }, [loadData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  const handleLogout = () => {
    Alert.alert(tr('signOutTitle', lang), tr('signOutMsg', lang), [
      { text: tr('cancel', lang), style: 'cancel' },
      {
        text: tr('signOut', lang),
        style: 'destructive',
        onPress: async () => {
          await signOut(auth);
          await AsyncStorage.multiRemove(['authToken', 'onboardingCompleted']);
          router.replace('/login');
        },
      },
    ]);
  };

  if (loading) {
    return (
      <View style={S.loadingContainer}>
        <ActivityIndicator size="large" color={TEAL} />
        <Text style={S.loadingText}>{tr('loadingProfile', lang)}</Text>
      </View>
    );
  }

  const cefrColor  = diagnosis ? CEFR_COLORS[diagnosis.predicted_cefr] ?? TEAL : TEAL;
  const sortedInds = diagnosis
    ? [...diagnosis.indicators].sort((a, b) => (a.normalized ?? a.score ?? 0) - (b.normalized ?? b.score ?? 0))
    : [];

  return (
    <SafeAreaView style={S.root}>
      <StatusBar barStyle="dark-content" backgroundColor={BG} />

      <ScrollView
        contentContainerStyle={S.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={TEAL} />}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View style={{ opacity: fadeAnim }}>

          {/* ── Notification banner ── */}
          {showNotifBanner && (
            <TouchableOpacity
              style={S.notifBanner}
              onPress={() => setShowNotifBanner(false)}
              activeOpacity={0.85}
            >
              <Text style={S.notifBannerText}>{tr('practiceToday', lang)}</Text>
              <Feather name="x" size={14} color={TEAL} />
            </TouchableOpacity>
          )}

          {/* ── Header ── */}
          <View style={S.header}>
            <View style={S.headerLeft}>
              <Text style={S.eyebrow}>{tr('hello', lang)}, {firstName}</Text>
              {(() => {
                const lines = tr('yourDashboard', lang).split('\n');
                return (
                  <Text style={S.headline}>
                    {lines[0]}{'\n'}
                    <Text style={[S.headline, { color: TEAL }]}>{lines[1]}</Text>
                  </Text>
                );
              })()}
            </View>
            <View style={S.headerRight}>
              {streak.current > 0 && (
                <View style={S.streakBadge}>
                  <Text style={S.streakFire}>🔥</Text>
                  <Text style={S.streakNum}>{streak.current}</Text>
                </View>
              )}
              <TouchableOpacity onPress={handleLogout} style={S.logoutBtn}>
                <Feather name="log-out" size={16} color={TEXT2} />
              </TouchableOpacity>
            </View>
          </View>

          {/* ── Waveform card ── */}
          {diagnosis && (
            <View style={S.waveCard}>
              <View style={S.waveTop}>
                <View style={S.liveRow}>
                  <View style={S.liveDot} />
                  <Text style={S.liveLabel}>{tr('liveAudio', lang)}</Text>
                </View>
                <View style={[S.cefrBadge, { backgroundColor: cefrColor + '20', borderColor: cefrColor + '45' }]}>
                  <Text style={[S.cefrBadgeText, { color: cefrColor }]}>{diagnosis.predicted_cefr}</Text>
                </View>
              </View>
              <AnimatedWaveform />
            </View>
          )}

          {/* ── 3-stat strip ── */}
          {diagnosis ? (
            <View style={S.statsRow}>
              <View style={[S.statCard, { borderTopColor: TEAL }]}>
                <Text style={S.statValue}>{Math.round(diagnosis.overall_score)}</Text>
                <Text style={S.statLabel}>{tr('overallScore', lang)}</Text>
              </View>
              <View style={[S.statCard, { borderTopColor: cefrColor }]}>
                <Text style={[S.statValue, { color: cefrColor }]}>{diagnosis.predicted_cefr}</Text>
                <Text style={S.statLabel}>{tr('cefrLevel', lang)}</Text>
              </View>
              <View style={[S.statCard, { borderTopColor: CORAL }]}>
                <Text style={S.statValue}>
                  {profile?.daily_study_minutes ? `${profile.daily_study_minutes}m` : '—'}
                </Text>
                <Text style={S.statLabel}>{tr('dailyGoal', lang)}</Text>
              </View>
            </View>
          ) : (
            <>
              <TouchableOpacity
                style={S.emptyCard}
                onPress={() => router.push('/initial_diagnostic')}
                activeOpacity={0.8}
              >
                <LinearGradient colors={[TEAL + '20', TEAL + '08']} style={S.emptyInner}>
                  <Feather name="activity" size={28} color={TEAL} />
                  <Text style={S.emptyTitle}>{tr('takeDiagnostic', lang)}</Text>
                  <Text style={S.emptyDesc}>{tr('diagnosticDesc', lang)}</Text>
                  <View style={S.emptyBtn}>
                    <Text style={S.emptyBtnText}>{tr('start', lang)}</Text>
                    <Feather name="arrow-right" size={13} color={NAVY} />
                  </View>
                </LinearGradient>
              </TouchableOpacity>

            </>
          )}

          {/* ── Profile chips ── */}
          {profile && (profile.target_exam || profile.target_domain) && (
            <View style={S.chipRow}>
              {profile.target_exam && (
                <View style={S.chip}>
                  <Feather name="award" size={10} color={CORAL} />
                  <Text style={S.chipText}>{profile.target_exam}</Text>
                </View>
              )}
              {profile.target_domain && (
                <View style={S.chip}>
                  <Feather name="layers" size={10} color={CORAL} />
                  <Text style={S.chipText}>{profile.target_domain}</Text>
                </View>
              )}
            </View>
          )}

          {/* ── Proficiency DNA ── */}
          {sortedInds.length > 0 && (
            <View style={S.section}>
              <View style={S.sectionHead}>
                <Text style={S.sectionTitle}>{tr('proficiencyDna', lang)}</Text>
                <Text style={S.sectionMeta}>10 indicators · Lee (2021)</Text>
              </View>
              <View style={S.dnaCard}>
                {sortedInds.map((ind, i) => (
                  <IndicatorRow
                    key={(ind as any).indicator ?? ind.name ?? i}
                    item={ind}
                    index={i}
                    onInfo={() => setInfoIndicator(ind.name)}
                  />
                ))}
              </View>
            </View>
          )}

          {/* ── Focus Areas ── */}
          {diagnosis && diagnosis.critical_areas.length > 0 && (
            <View style={[S.section, S.alertCard]}>
              <View style={S.alertHeader}>
                <Feather name="alert-triangle" size={13} color="#FF4D6D" />
                <Text style={[S.sectionTitle, { color: '#FF4D6D', marginLeft: 6 }]}>{tr('focusAreas', lang)}</Text>
              </View>
              {diagnosis.critical_areas.slice(0, 3).map((area, i) => (
                <View key={i} style={S.bulletRow}>
                  <View style={[S.bullet, { backgroundColor: '#FF4D6D' }]} />
                  <Text style={S.bulletText}>{area}</Text>
                </View>
              ))}
            </View>
          )}

          {/* ── Strengths ── */}
          {diagnosis && diagnosis.strengths.length > 0 && (
            <View style={[S.section, S.strengthCard]}>
              <View style={S.alertHeader}>
                <Feather name="check-circle" size={13} color={TEAL} />
                <Text style={[S.sectionTitle, { color: TEAL, marginLeft: 6 }]}>{tr('strengths', lang)}</Text>
              </View>
              {diagnosis.strengths.slice(0, 2).map((s, i) => (
                <View key={i} style={S.bulletRow}>
                  <View style={[S.bullet, { backgroundColor: TEAL }]} />
                  <Text style={S.bulletText}>{s}</Text>
                </View>
              ))}
            </View>
          )}

          {/* ── Skill Training ── */}
          <View style={S.section}>
            <View style={S.sectionHead}>
              <Text style={S.sectionTitle}>{tr('skillTraining', lang)}</Text>
              <View style={S.stepPill}>
                <Text style={S.stepText}>{tr('step1', lang)}</Text>
              </View>
            </View>
            {TRAINING_MODULES.map(m => (
              <ModuleRow
                key={m.label}
                label={m.label}
                subtitle={m.subtitle}
                icon={m.icon}
                route={m.route}
                color={m.color}
              />
            ))}
          </View>

          {/* ── Tools ── */}
          <View style={S.section}>
            <View style={S.sectionHead}>
              <Text style={[S.sectionTitle, { color: TEXT2, fontSize: 14 }]}>{tr('tools', lang)}</Text>
            </View>
            {TOOL_MODULES.map(m => (
              <ModuleRow
                key={m.label}
                label={m.label}
                subtitle={m.subtitle}
                icon={m.icon}
                route={m.route}
                color={m.color}
              />
            ))}
          </View>

          {/* ── Re-assessment CTA ── */}
          {diagnosis && (
            <TouchableOpacity
              onPress={() => router.push('/initial_diagnostic')}
              activeOpacity={0.85}
            >
              <LinearGradient
                colors={['rgba(15,186,154,0.10)', 'rgba(15,186,154,0.04)']}
                style={S.reassessBtn}
              >
                <Feather name="refresh-cw" size={14} color={TEAL} />
                <Text style={S.reassessText}>{tr('takeReAssessment', lang)}</Text>
                <Feather name="arrow-right" size={14} color={TEAL} />
              </LinearGradient>
            </TouchableOpacity>
          )}

          {/* ── Demo profile switcher — always visible ── */}
          <View style={S.demoSwitcher}>
            <Text style={S.demoSwitcherLabel}>{tr('demoChoose', lang)}</Text>
            <View style={S.demoSwitcherRow}>
              {(
                [
                  { preset: 'weak'   as DemoPreset, emoji: '📉', color: '#EF4444', range: 'A2→B1' },
                  { preset: 'medium' as DemoPreset, emoji: '📈', color: PURPLE,    range: 'B1→B2' },
                  { preset: 'strong' as DemoPreset, emoji: '🏆', color: '#F59E0B', range: 'B2→C1' },
                ]
              ).map(({ preset, emoji, color, range }) => {
                const busy = demoLoading === preset;
                return (
                  <TouchableOpacity
                    key={preset}
                    style={[S.demoChip, { borderColor: color + '50', backgroundColor: color + '0D' }]}
                    activeOpacity={0.7}
                    disabled={demoLoading !== null}
                    onPress={async () => {
                      setDemoLoading(preset);
                      try {
                        await loadDemoProfile(preset);
                        await loadProfile('anonymous');
                        await loadData();
                      } finally {
                        setDemoLoading(null);
                      }
                    }}
                  >
                    <Text style={S.demoChipEmoji}>{busy ? '⏳' : emoji}</Text>
                    <Text style={[S.demoChipRange, { color }]}>{range}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* ── Persona-based demo profiles (6 fictional users with jobs) ── */}
            <Text style={[S.demoSwitcherLabel, { marginTop: 16 }]}>OR PICK A LEARNER PERSONA</Text>
            <View style={S.demoPersonaGrid}>
              {getJobDemoUsers().map(({ key, user }) => {
                const job = JOBS_BY_ID[user.jobId];
                const busy = demoLoading === key;
                const personaColor =
                  user.industry === 'tech'              ? '#7C6FFF' :
                  user.industry === 'healthcare'        ? '#EC4899' :
                  user.industry === 'finance'           ? '#10B981' :
                  user.industry === 'law_government'    ? '#6366F1' :
                  user.industry === 'media'             ? '#FF7A59' :
                  user.industry === 'sales_marketing'   ? '#FBBF24' :
                                                          '#64748B';
                return (
                  <TouchableOpacity
                    key={key}
                    style={[
                      S.personaCard,
                      { borderColor: personaColor + '40', backgroundColor: personaColor + '08' },
                    ]}
                    activeOpacity={0.75}
                    disabled={demoLoading !== null}
                    onPress={async () => {
                      setDemoLoading(key);
                      try {
                        await loadDemoProfile(key);
                        await loadProfile('anonymous');
                        await loadData();
                      } finally {
                        setDemoLoading(null);
                      }
                    }}
                  >
                    <Text style={S.personaAvatar}>{busy ? '⏳' : user.avatar}</Text>
                    <Text style={S.personaName}>{user.name}, {user.age}</Text>
                    <Text style={[S.personaJob, { color: personaColor }]} numberOfLines={1}>
                      {job?.title ?? user.jobId}
                    </Text>
                    <Text style={S.personaRange}>{user.rangeLabel}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          <View style={{ height: 48 }} />
        </Animated.View>
      </ScrollView>

      {/* ── Indicator info modal ── */}
      <Modal
        visible={infoIndicator !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setInfoIndicator(null)}
      >
        <Pressable style={S.modalOverlay} onPress={() => setInfoIndicator(null)}>
          <Pressable style={S.modalCard} onPress={() => {}}>
            {(() => {
              const info = infoIndicator ? resolveInfo(infoIndicator) : null;
              if (!info) return null;
              return (
                <>
                  <View style={S.modalHeader}>
                    <View style={S.modalIconWrap}>
                      <Feather name="activity" size={16} color={TEAL} />
                    </View>
                    <Text style={S.modalTitle}>{infoIndicator}</Text>
                    <TouchableOpacity onPress={() => setInfoIndicator(null)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                      <Feather name="x" size={18} color={TEXT2} />
                    </TouchableOpacity>
                  </View>

                  <View style={S.modalEli5}>
                    <Text style={S.modalEli5Label}>💡 IN PLAIN ENGLISH</Text>
                    <Text style={S.modalEli5Text}>{info.eli5}</Text>
                  </View>

                  <View style={S.modalSection}>
                    <Text style={S.modalSectionLabel}>FORMULA / HOW IT IS CALCULATED</Text>
                    <Text style={S.modalSectionBody}>{info.formula}</Text>
                  </View>

                  <View style={S.modalSection}>
                    <Text style={S.modalSectionLabel}>RESEARCH BASIS</Text>
                    <Text style={S.modalSectionBody}>{info.studies}</Text>
                  </View>

                  <View style={[S.modalSection, { marginBottom: 0 }]}>
                    <Text style={S.modalSectionLabel}>WHY IT WAS CHOSEN</Text>
                    <Text style={S.modalSectionBody}>{info.rationale}</Text>
                  </View>
                </>
              );
            })()}
          </Pressable>
        </Pressable>
      </Modal>

    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const S = StyleSheet.create({
  root:             { flex: 1, backgroundColor: BG },
  loadingContainer: { flex: 1, backgroundColor: BG, justifyContent: 'center', alignItems: 'center', gap: 12 },
  loadingText:      { fontSize: 14, color: TEXT2 },
  scroll:           { paddingHorizontal: 20, paddingBottom: 24 },

  // Notification banner
  notifBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: TEAL + '14',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: TEAL + '30',
    marginTop: 12,
    marginBottom: 4,
    gap: 8,
  },
  notifBannerText: { flex: 1, fontSize: 13, color: TEAL, fontWeight: '600' },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingTop: 24,
    paddingBottom: 22,
  },
  headerLeft:  { flex: 1 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },

  // Streak badge
  streakBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#FFF7ED',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: '#FED7AA',
  },
  streakFire: { fontSize: 14 },
  streakNum:  { fontSize: 14, fontWeight: '800', color: '#EA580C' },
  eyebrow: {
    fontSize: 13,
    color: TEXT2,
    fontWeight: '500',
    marginBottom: 6,
    letterSpacing: 0.2,
  },
  headline: {
    fontSize: 34,
    fontWeight: '800',
    color: TEXT,
    lineHeight: 40,
    letterSpacing: -1,
  },
  logoutBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: CARD,
    borderWidth: 1,
    borderColor: BORDER,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Waveform card
  waveCard: {
    backgroundColor: NAVY,
    borderRadius: 20,
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 12,
    marginBottom: 14,
  },
  waveTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  liveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: TEAL,
  },
  liveLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: TEXT3,
    letterSpacing: 1.4,
  },
  cefrBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
  },
  cefrBadgeText: {
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.5,
  },

  // Stats strip
  statsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 18,
  },
  statCard: {
    flex: 1,
    backgroundColor: CARD,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: BORDER,
    borderTopWidth: 3,
    alignItems: 'center',
    gap: 4,
  },
  statValue: {
    fontSize: 22,
    fontWeight: '800',
    color: TEXT,
    letterSpacing: -0.5,
  },
  statLabel: {
    fontSize: 9,
    fontWeight: '600',
    color: TEXT3,
    letterSpacing: 0.8,
    textAlign: 'center',
  },

  // Empty / no-diagnosis card
  emptyCard: {
    borderRadius: 20,
    overflow: 'hidden',
    marginBottom: 18,
    borderWidth: 1,
    borderColor: TEAL + '30',
    borderStyle: 'dashed',
  },
  emptyInner: { padding: 28, alignItems: 'center', gap: 10 },
  emptyTitle: { fontSize: 17, fontWeight: '800', color: TEXT },
  emptyDesc:  { fontSize: 13, color: TEXT2, textAlign: 'center', lineHeight: 19 },
  emptyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: TEAL,
    paddingHorizontal: 18,
    paddingVertical: 9,
    borderRadius: 999,
    marginTop: 4,
  },
  emptyBtnText: { fontSize: 13, fontWeight: '700', color: NAVY },


  // Demo profile switcher (always visible at page bottom)
  demoSwitcher: {
    marginTop: 24,
    borderTopWidth: 1,
    borderTopColor: BORDER,
    paddingTop: 16,
  },
  demoSwitcherLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: TEXT3,
    letterSpacing: 0.8,
    marginBottom: 10,
    textAlign: 'center',
  },
  demoSwitcherRow: {
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'center',
  },
  demoChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1.5,
  },
  demoChipEmoji: { fontSize: 16 },
  demoChipRange: { fontSize: 12, fontWeight: '800' },

  // Persona-based job demo profiles
  demoPersonaGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'space-between',
  },
  personaCard: {
    width: '31.5%',
    aspectRatio: 0.85,
    borderRadius: 14,
    borderWidth: 1.5,
    paddingVertical: 10,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  personaAvatar: { fontSize: 26, marginBottom: 2 },
  personaName: { fontSize: 12, fontWeight: '800', color: TEXT, textAlign: 'center' },
  personaJob: { fontSize: 9, fontWeight: '700', textAlign: 'center' },
  personaRange: { fontSize: 10, fontWeight: '700', color: TEXT2, marginTop: 2 },

  // Profile chips
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(255,107,71,0.10)',
    borderRadius: 999,
    paddingHorizontal: 11,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: 'rgba(255,107,71,0.22)',
  },
  chipText: { fontSize: 11, color: CORAL, fontWeight: '700', textTransform: 'capitalize' },

  // Sections
  section: { marginBottom: 24 },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: TEXT },
  sectionMeta:  { fontSize: 11, color: TEXT3 },

  stepPill: {
    backgroundColor: 'rgba(15,186,154,0.14)',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 999,
  },
  stepText: { fontSize: 9, fontWeight: '800', color: TEAL, letterSpacing: 0.8 },

  // DNA wrapper card
  dnaCard: {
    backgroundColor: CARD,
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: BORDER,
  },

  // Focus / strength banners
  alertCard: {
    backgroundColor: 'rgba(255,77,109,0.05)',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,77,109,0.15)',
  },
  strengthCard: {
    backgroundColor: 'rgba(15,186,154,0.05)',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(15,186,154,0.15)',
  },
  alertHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  bulletRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 6 },
  bullet:    { width: 6, height: 6, borderRadius: 3, marginTop: 6 },
  bulletText: { flex: 1, fontSize: 13, color: TEXT, lineHeight: 20 },

  // Re-assess CTA
  reassessBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    borderRadius: 16,
    paddingVertical: 15,
    borderWidth: 1,
    borderColor: TEAL + '28',
  },
  reassessText: { fontSize: 14, fontWeight: '700', color: TEAL },

  // Indicator info modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
    paddingHorizontal: 12,
    paddingBottom: 24,
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  modalIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 9,
    backgroundColor: TEAL + '15',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  modalEli5: {
    backgroundColor: TEAL + '10',
    borderRadius: 12,
    padding: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: TEAL + '25',
  },
  modalEli5Label: {
    fontSize: 9,
    fontWeight: '800',
    color: TEAL,
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  modalEli5Text: {
    fontSize: 13,
    color: '#0F172A',
    lineHeight: 20,
  },
  modalSection: {
    marginBottom: 14,
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  modalSectionLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: TEAL,
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  modalSectionBody: {
    fontSize: 12,
    color: '#334155',
    lineHeight: 18,
  },
});
