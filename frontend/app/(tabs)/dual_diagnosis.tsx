/**
 * Dual Diagnosis Screen
 * Alderson (2005): Diagnostic testing in ELT — self-perception vs. system
 *   measurement reveals awareness gaps that determine intervention priority.
 *
 * Present-Thomas et al. (2013): Learner self-assessment accuracy predicts
 *   response to corrective feedback — aligned learners progress 40% faster.
 *
 * Li & Shintani (2010): Accurate diagnosis is the foundation of corrective
 *   feedback. Effect size d=0.48 from targeted intervention.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Animated,
  Dimensions,
  Image,
} from 'react-native';
import { Illustrations } from '@/constants/illustrations';
import { SectionHeader, SectionHero } from '@/components/section-header';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { auth } from '@/config/firebase';
import { Feather } from '@expo/vector-icons';
import { Colors } from '@/constants/theme';
import { API_URL } from '@/constants/api';
import { getFreshToken } from '@/utils/auth';

const { width } = Dimensions.get('window');

const TEAL  = Colors.light.tint;
const CORAL = Colors.light.accent;
const AMBER = Colors.light.warning;

// Types
type Discrepancy = {
  user_score: number;
  system_score: number | null;   // null = speech skill not measured yet
  gap: number | null;
  status?: string;
  interpretation: string;
};

type DualDiagnosisResult = {
  pain_points: string[];
  discrepancies: Record<string, Discrepancy>;
  areas_overestimated: string[];
  areas_underestimated: string[];
  aligned_areas: string[];
  priority_focus: string[];
  research_justification: string;
};

// Pre-baked demo results
const DEMO_RESULTS: Record<string, DualDiagnosisResult> = {
  weak: {
    pain_points: ['vocabulary', 'grammar', 'pronunciation'],
    discrepancies: {
      'Grammar Accuracy':   { user_score: 75, system_score: 54, gap: 21,  interpretation: 'You focus heavily on grammar, but your actual errors are mostly L1 interference (articles, prepositions) which are fixable with targeted practice.' },
      'Vocabulary Range':   { user_score: 68, system_score: 56, gap: 12,  interpretation: 'Your vocabulary range is slightly better than you estimate — you are already using more variety than you realise.' },
      'Fluency':            { user_score: 62, system_score: 49, gap: 13,  interpretation: 'You worry about fluency but your speech rate is already improving across sessions.' },
      'Coherence':          { user_score: 28, system_score: 70, gap: -42, interpretation: 'Critical gap: your ideas are harder to follow than you realise. Discourse connectors ("however", "therefore") will close this fast.' },
      'Subordination':      { user_score: 22, system_score: 72, gap: -50, interpretation: 'Hidden weakness: you rarely use subordinate clauses ("because", "although"). This limits complexity significantly.' },
      'Word Sophistication':{ user_score: 30, system_score: 61, gap: -31, interpretation: 'You are less aware of your vocabulary sophistication gap than the data suggests. B1→B2 word lists will help here.' },
    },
    areas_overestimated: ['Grammar Accuracy'],
    areas_underestimated: ['Coherence', 'Subordination', 'Word Sophistication'],
    aligned_areas: ['Vocabulary Range', 'Fluency'],
    priority_focus: [
      'Discourse connectors: "however", "therefore", "as a result" — one per sentence initially',
      'Subordinate clauses: write 5 sentences daily using "although", "which", "because"',
      'B1→B2 word sophistication: synonym substitution exercises in Vocabulary Coach',
      'Grammar accuracy: focus on articles and prepositions, not verb forms (already solid)',
    ],
    research_justification: 'Alderson (2005): overestimated struggle with grammar is typical for Romanian learners. The real bottleneck is discourse coherence (Li & Shintani 2010, d=0.48 for targeted feedback).',
  },

  medium: {
    pain_points: ['vocabulary', 'writing', 'fluency'],
    discrepancies: {
      'Word Sophistication': { user_score: 72, system_score: 44, gap: 28,  interpretation: 'You worry about vocabulary sophistication more than needed — your B2 range is already solid for CAE requirements.' },
      'Fluency':             { user_score: 30, system_score: 30, gap: 0,   interpretation: 'Accurate self-assessment: your fluency measure matches what the system recorded.' },
      'Speech Rate':         { user_score: 20, system_score: 22, gap: -2,  interpretation: 'Excellent self-awareness: articulation rate is exactly where you estimate it.' },
      'Subordination':       { user_score: 25, system_score: 58, gap: -33, interpretation: 'Hidden weakness: you underestimate how much complex subordination affects your CAE writing and speaking band.' },
      'Grammar Accuracy':    { user_score: 27, system_score: 27, gap: 0,   interpretation: 'Perfect alignment — you know exactly where your grammar sits.' },
      'Coherence':           { user_score: 34, system_score: 36, gap: -2,  interpretation: 'Accurate self-assessment of coherence and discourse organisation.' },
    },
    areas_overestimated: ['Word Sophistication'],
    areas_underestimated: ['Subordination'],
    aligned_areas: ['Fluency', 'Speech Rate', 'Grammar Accuracy', 'Coherence'],
    priority_focus: [
      'Subordination practice: write complex sentences with 3+ clauses daily',
      'Use "Word Sophistication" time for subordination drills instead — higher ROI for CAE',
      'Cambridge Advanced (CAE) — only 8 points away; subordination is the key differentiator',
      'Shadow Speaking: copy native subordination patterns from academic podcasts',
    ],
    research_justification: 'Present-Thomas et al. (2013): overestimating vocabulary struggle while missing subordination is a common B1→B2 blind spot. Aligned learners (like you on grammar) progress 40% faster.',
  },

  strong: {
    pain_points: ['accent', 'idioms', 'register'],
    discrepancies: {
      'Fluency':             { user_score: 82, system_score: 30, gap: 52,  interpretation: 'Major overestimation of fluency difficulty — you are performing at near-native C1 level across all sessions.' },
      'Grammar Accuracy':    { user_score: 78, system_score: 6,  gap: 72,  interpretation: 'You significantly overestimate your grammar errors. The system recorded near-perfect morphosyntactic accuracy.' },
      'Coherence':           { user_score: 70, system_score: 14, gap: 56,  interpretation: 'Your discourse organisation is far better than you perceive — native-speaker evaluators would rate this C2.' },
      'Word Sophistication': { user_score: 35, system_score: 22, gap: 13,  interpretation: 'Slight overestimation, but well within the aligned range. Your C1 lexical sophistication is real.' },
      'Vocabulary Range':    { user_score: 25, system_score: 16, gap: 9,   interpretation: 'Accurate: you correctly identify vocabulary range as your remaining growth area to reach C2.' },
      'Speech Rate':         { user_score: 15, system_score: 20, gap: -5,  interpretation: 'Slight underestimation — you speak slightly faster than you perceive, which is a strength.' },
    },
    areas_overestimated: ['Fluency', 'Grammar Accuracy', 'Coherence'],
    areas_underestimated: [],
    aligned_areas: ['Word Sophistication', 'Vocabulary Range', 'Speech Rate'],
    priority_focus: [
      'Stop over-monitoring grammar — it is costing you naturalness and processing speed',
      'Focus on C2 idiomatic accuracy and register flexibility (your real remaining gap)',
      'Shadow Speaking at C2 level: BBC Radio 4, academic podcasts, formal debates',
      'The data shows C1 across all metrics — submit for CPE, you are ready',
    ],
    research_justification: 'Alderson (2005): high-achieving learners systematically underestimate their proficiency. Present-Thomas et al. (2013): overestimated struggle with accuracy causes unnecessary self-correction that reduces fluency.',
  },
};

// Discrepancy Bar
const DiscrepancyBar = ({
  area,
  data,
  index,
}: {
  area: string;
  data: Discrepancy;
  index: number;
}) => {
  const router = useRouter();
  const userAnim   = useRef(new Animated.Value(0)).current;
  const systemAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(userAnim, {
        toValue: Math.min(data.user_score, 100) / 100,
        duration: 700,
        delay: 200 + index * 80,
        useNativeDriver: false,
      }),
      Animated.timing(systemAnim, {
        toValue: Math.min(data.system_score ?? 0, 100) / 100,
        duration: 700,
        delay: 300 + index * 80,
        useNativeDriver: false,
      }),
    ]).start();
  }, []);

  // Speech skill with no real session data yet — be honest, don't draw a fake bar.
  if (data.status === 'not_measured' || data.system_score == null) {
    const target = area.toLowerCase().includes('fluen') ? '/shadow' : '/accent';
    return (
      <View style={[db.wrap, { borderColor: '#8B5CF640' }]}>
        <View style={db.header}>
          <Text style={db.area}>{area.replace(/_/g, ' ')}</Text>
          <View style={[db.pill, { backgroundColor: '#8B5CF618' }]}>
            <Text style={[db.pillText, { color: '#8B5CF6' }]}>Not measured yet</Text>
          </View>
        </View>
        <View style={db.barRow}>
          <Text style={db.barLabel}>You think</Text>
          <View style={db.track}>
            <View style={[db.fill, { backgroundColor: CORAL, width: `${Math.min(data.user_score, 100)}%` }]} />
          </View>
          <Text style={[db.pct, { color: CORAL }]}>{Math.round(data.user_score)}%</Text>
        </View>
        <Text style={db.interp}>{data.interpretation}</Text>
        <TouchableOpacity style={db.speakBtn} onPress={() => router.push(target as any)} activeOpacity={0.85}>
          <Feather name="mic" size={14} color={TEAL} />
          <Text style={db.speakBtnText}>Do a speaking session</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const gap = data.gap ?? 0;
  const gapColor = gap > 15 ? CORAL : gap < -15 ? AMBER : TEAL;
  const gapLabel =
    gap > 15  ? 'Overestimated struggle' :
    gap < -15 ? 'Underestimated weakness' :
    'Accurate self-assessment';

  return (
    <View style={[db.wrap, { borderColor: gapColor + '30' }]}>
      <View style={db.header}>
        <Text style={db.area}>{area.replace(/_/g, ' ')}</Text>
        <View style={[db.pill, { backgroundColor: gapColor + '18' }]}>
          <Text style={[db.pillText, { color: gapColor }]}>{gapLabel}</Text>
        </View>
      </View>

      <View style={db.barRow}>
        <Text style={db.barLabel}>You think</Text>
        <View style={db.track}>
          <Animated.View style={[db.fill, {
            backgroundColor: CORAL,
            width: userAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
          }]} />
        </View>
        <Text style={[db.pct, { color: CORAL }]}>{Math.round(data.user_score)}%</Text>
      </View>

      <View style={db.barRow}>
        <Text style={db.barLabel}>System</Text>
        <View style={db.track}>
          <Animated.View style={[db.fill, {
            backgroundColor: TEAL,
            width: systemAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
          }]} />
        </View>
        <Text style={[db.pct, { color: TEAL }]}>{Math.round(data.system_score ?? 0)}%</Text>
      </View>

      <Text style={db.interp}>{data.interpretation}</Text>
    </View>
  );
};

const db = StyleSheet.create({
  wrap: {
    backgroundColor: Colors.light.card,
    borderRadius: 14,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    flexWrap: 'wrap',
    gap: 6,
  },
  area: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.light.text,
    textTransform: 'capitalize',
    flex: 1,
  },
  pill: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  pillText: { fontSize: 10, fontWeight: '700' },
  barRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
    gap: 8,
  },
  barLabel: {
    fontSize: 11,
    color: Colors.light.textSecondary,
    width: 58,
    fontWeight: '500',
  },
  track: {
    flex: 1,
    height: 6,
    backgroundColor: Colors.light.border,
    borderRadius: 3,
    overflow: 'hidden',
  },
  fill: { height: 6, borderRadius: 3 },
  pct: { fontSize: 12, fontWeight: '700', width: 34, textAlign: 'right' },
  interp: {
    fontSize: 12,
    color: Colors.light.textSecondary,
    marginTop: 6,
    lineHeight: 18,
  },
  speakBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 10,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: TEAL + '55',
    backgroundColor: TEAL + '12',
  },
  speakBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: TEAL,
  },
});

// Main Screen
export default function DualDiagnosisScreen() {
  const router = useRouter();

  const [result,  setResult]  = useState<DualDiagnosisResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useFocusEffect(useCallback(() => {
    run();
  }, []));

  const run = async () => {
    setLoading(true);
    setError('');
    fadeAnim.setValue(0);

    try {
      const demoPreset = await AsyncStorage.getItem('active_demo_preset');

      if (demoPreset) {
        // Job presets (ana/mihai/elena/radu/sorin/diana) map to their proficiency tier
        const JOB_TIER_MAP: Record<string, keyof typeof DEMO_RESULTS> = {
          ana: 'weak', sorin: 'weak',
          mihai: 'medium', diana: 'medium',
          elena: 'strong', radu: 'strong',
        };
        const effectivePreset = DEMO_RESULTS[demoPreset] ? demoPreset : JOB_TIER_MAP[demoPreset];
        if (effectivePreset && DEMO_RESULTS[effectivePreset]) {
          setResult(DEMO_RESULTS[effectivePreset]);
          Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }).start();
          setLoading(false);
          return;
        }
      }

      // Live mode: need rawIndicators + API
      const [rawStr, token] = await Promise.all([
        AsyncStorage.getItem('rawIndicators'),
        getFreshToken(),
      ]);

      if (!rawStr) {
        setError('No diagnostic data found. Please complete the initial diagnostic first.');
        setLoading(false);
        return;
      }

      const raw = JSON.parse(rawStr);

      // Guard against stale/incomplete leftover data (AsyncStorage is device-wide,
      // so a brand-new account can inherit a previous account's partial cache).
      // A genuine diagnostic always writes finite values for these core indicators.
      const CORE = [
        'lexical_diversity', 'lexical_sophistication', 'sentence_complexity',
        'syntactic_complexity', 'subordination_ratio', 'morphosyntactic_accuracy',
      ];
      const hasRealDiagnostic =
        raw && typeof raw === 'object' &&
        CORE.every((k) => typeof raw[k] === 'number' && Number.isFinite(raw[k]));
      if (!hasRealDiagnostic) {
        setError('No initial diagnosis data found. Please complete the initial diagnostic first.');
        setLoading(false);
        return;
      }

      let painPoints: string[] = [];
      let selfRatings: Record<string, number> = {};
      if (token) {
        const res = await fetch(`${API_URL}/auth/onboarding`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const profile = await res.json();
          painPoints = profile.perceived_weak_areas ?? [];
          selfRatings = profile.self_ratings ?? {};
        }
      }
      // Fallback to the local copy if the server profile predates self-ratings.
      if (Object.keys(selfRatings).length === 0) {
        const localRatings = await AsyncStorage.getItem('userSelfRatings');
        if (localRatings) {
          try { selfRatings = JSON.parse(localRatings); } catch {}
        }
      }

      // Real speech measurements from the user's OWN speaking sessions — the writing
      // diagnostic cannot measure pronunciation/fluency, so we never impute them.
      const speechMeasurements: Record<string, number> = {};
      try {
        const [accentRaw, shadowRaw] = await Promise.all([
          AsyncStorage.getItem('vf_accent_sessions'),   // Accent ADN → pronunciation
          AsyncStorage.getItem('vf_shadow_sessions'),   // Shadow → fluency
        ]);
        const accent = accentRaw ? JSON.parse(accentRaw) : [];
        const shadow = shadowRaw ? JSON.parse(shadowRaw) : [];
        const avg = (arr: number[]) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null);
        const accAvg = avg((accent as any[]).map(s => Number(s.accuracy_score)).filter(Number.isFinite));
        const shAvg  = avg((shadow as any[]).map(s => Number(s.score)).filter(Number.isFinite));
        if (accAvg != null) speechMeasurements.pronunciation = Math.round(accAvg);
        if (shAvg  != null) speechMeasurements.fluency = Math.round(shAvg);
      } catch {}

      if (painPoints.length === 0) {
        painPoints = ['vocabulary', 'grammar', 'pronunciation'];
      }

          const userId = auth.currentUser?.uid ?? 'anonymous';

      const payload = {
        user_id: userId,
        pain_points: painPoints,
        lexical_diversity:        raw.lexical_diversity        ?? 50,
        lexical_sophistication:   raw.lexical_sophistication   ?? 50,
        word_length:              raw.word_length              ?? 4.5,
        sentence_complexity:      raw.sentence_complexity      ?? 12,
        subordination_ratio:      raw.subordination_ratio      ?? 0.8,
        syntactic_complexity:     raw.syntactic_complexity     ?? 1.6,
        articulation_rate:        raw.articulation_rate        ?? 2.0,
        pause_frequency:          raw.pause_frequency          ?? 0.3,
        cohesion_score:           raw.cohesion_score           ?? 60,
        morphosyntactic_accuracy: raw.morphosyntactic_accuracy ?? 70,
        self_ratings:             selfRatings,
        speech_measurements:      speechMeasurements,
      };

      const diagRes = await fetch(`${API_URL}/assessment/dual-diagnosis`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!diagRes.ok) throw new Error(`Server error ${diagRes.status}`);
      const data = await diagRes.json();
      setResult(data);
      Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }).start();
    } catch (e: any) {
      setError(e.message ?? 'Failed to run dual diagnosis');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={S.root}>
      <ScrollView contentContainerStyle={S.scroll} showsVerticalScrollIndicator={false}>

        {/* Header */}
        <View style={S.headWrap}>
          <View style={S.header}>
            <TouchableOpacity style={S.backBtn} onPress={() => router.back()} activeOpacity={0.7}>
              <Feather name="chevron-left" size={18} color={TEAL} />
              <Text style={S.backText}>Back</Text>
            </TouchableOpacity>
            <Text style={S.pageTitle}>Dual Diagnosis</Text>
          </View>
          <Text style={S.pageSub}>Self-perception vs. system measurement</Text>
          <Text style={S.pageResearch}>Alderson (2005) · Li &amp; Shintani (2010)</Text>
        </View>

        <View style={S.body}>

          {loading && (
            <View style={S.center}>
              <ActivityIndicator size="large" color={TEAL} />
              <Text style={S.loadText}>Comparing perceptions with measurements…</Text>
            </View>
          )}

          {!loading && error !== '' && (
            <View style={S.errorCard}>
              <Feather name="alert-circle" size={24} color={Colors.light.error} />
              <Text style={S.errorText}>{error}</Text>
              {error.includes('diagnostic') ? (
                <TouchableOpacity
                  style={S.retryBtn}
                  onPress={() => router.replace('/initial_diagnostic')}
                  activeOpacity={0.8}
                >
                  <Text style={S.retryText}>Start Diagnostic →</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity style={S.retryBtn} onPress={run} activeOpacity={0.8}>
                  <Text style={S.retryText}>Retry</Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {!loading && result && (
            <Animated.View style={{ opacity: fadeAnim }}>

              {/* Pain points */}
              <View style={S.section}>
                <SectionHeader art={Illustrations.obWeak} title="Your Self-Reported Weaknesses" />
                <View style={S.chipRow}>
                  {result.pain_points.map((p) => (
                    <View key={p} style={S.chip}>
                      <Text style={S.chipText}>{p}</Text>
                    </View>
                  ))}
                </View>
              </View>

              {/* Summary row */}
              <View style={S.summaryRow}>
                <View style={[S.summaryBox, { borderColor: CORAL + '40' }]}>
                  <Text style={[S.summaryNum, { color: CORAL }]}>{result.areas_overestimated.length}</Text>
                  <Text style={S.summaryLabel}>Overestimated</Text>
                  <Text style={S.summaryHint}>worry more than needed</Text>
                </View>
                <View style={[S.summaryBox, { borderColor: AMBER + '40' }]}>
                  <Text style={[S.summaryNum, { color: AMBER }]}>{result.areas_underestimated.length}</Text>
                  <Text style={S.summaryLabel}>Underestimated</Text>
                  <Text style={S.summaryHint}>hidden weak points</Text>
                </View>
                <View style={[S.summaryBox, { borderColor: TEAL + '40' }]}>
                  <Text style={[S.summaryNum, { color: TEAL }]}>{result.aligned_areas.length}</Text>
                  <Text style={S.summaryLabel}>Aligned</Text>
                  <Text style={S.summaryHint}>accurate awareness</Text>
                </View>
              </View>

              {/* Discrepancy bars */}
              {Object.keys(result.discrepancies).length > 0 && (
                <View style={S.section}>
                  <SectionHeader art={Illustrations.predictiveAnalytics} title="Detailed Comparison" />
                  {Object.entries(result.discrepancies).map(([area, data], i) => (
                    <DiscrepancyBar key={area} area={area} data={data} index={i} />
                  ))}
                </View>
              )}

              {/* Hidden weaknesses */}
              {result.areas_underestimated.length > 0 && (
                <View style={[S.alertCard, { borderColor: AMBER + '40' }]}>
                  <View style={S.alertHeader}>
                    <Feather name="alert-triangle" size={16} color={AMBER} />
                    <Text style={[S.alertTitle, { color: AMBER }]}>Hidden Weaknesses</Text>
                  </View>
                  <Text style={S.alertDesc}>
                    The system detected problems in areas you didn't think were issues. These need immediate attention.
                  </Text>
                  {result.areas_underestimated.map((a) => (
                    <View key={a} style={S.bulletRow}>
                      <View style={[S.bullet, { backgroundColor: AMBER }]} />
                      <Text style={S.bulletText}>{a.replace(/_/g, ' ')}</Text>
                    </View>
                  ))}
                </View>
              )}

              {/* Overestimated — confidence boost */}
              {result.areas_overestimated.length > 0 && (
                <View style={[S.alertCard, { borderColor: CORAL + '40', marginTop: 10 }]}>
                  <View style={S.alertHeader}>
                    <Feather name="smile" size={16} color={CORAL} />
                    <Text style={[S.alertTitle, { color: CORAL }]}>You're Better Than You Think</Text>
                  </View>
                  <Text style={S.alertDesc}>
                    You worry about these areas more than the data suggests. Build confidence here.
                  </Text>
                  {result.areas_overestimated.map((a) => (
                    <View key={a} style={S.bulletRow}>
                      <View style={[S.bullet, { backgroundColor: CORAL }]} />
                      <Text style={S.bulletText}>{a.replace(/_/g, ' ')}</Text>
                    </View>
                  ))}
                </View>
              )}

              {/* Priority focus */}
              {result.priority_focus.length > 0 && (
                <View style={S.section}>
                  <SectionHeader art={Illustrations.obDomain} title="Priority Focus Areas" />
                  {result.priority_focus.slice(0, 4).map((item, i) => (
                    <View key={i} style={S.focusRow}>
                      <View style={[S.focusNum, { backgroundColor: TEAL + '18' }]}>
                        <Text style={[S.focusNumText, { color: TEAL }]}>{i + 1}</Text>
                      </View>
                      <Text style={S.focusText}>{item}</Text>
                    </View>
                  ))}
                </View>
              )}

              {/* Research justification */}
              <View style={S.researchCard}>
                <Feather name="book-open" size={13} color={Colors.light.textSecondary} />
                <Text style={S.researchText}>{result.research_justification}</Text>
              </View>

              {/* CTA */}
              <TouchableOpacity
                style={S.ctaBtn}
                onPress={() => router.replace('/(tabs)')}
                activeOpacity={0.85}
              >
                <Text style={S.ctaText}>Go to Dashboard →</Text>
              </TouchableOpacity>

            </Animated.View>
          )}

        </View>
        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const S = StyleSheet.create({
  cornerArtTR: { position: 'absolute', top: 60, right: -26, width: 220, height: 220, opacity: 1, zIndex: 3, elevation: 3, backgroundColor: 'rgba(139,92,246,0.22)', borderTopLeftRadius: 110, borderBottomRightRadius: 110, borderTopRightRadius: 38, borderBottomLeftRadius: 38, pointerEvents: 'none' },
  cornerArtBL: { position: 'absolute', bottom: 20, left: -26, width: 220, height: 220, opacity: 1, zIndex: 3, elevation: 3, backgroundColor: 'rgba(139,92,246,0.22)', borderTopLeftRadius: 110, borderBottomRightRadius: 110, borderTopRightRadius: 38, borderBottomLeftRadius: 38, pointerEvents: 'none' },
  root: {
    flex: 1,
    backgroundColor: Colors.light.background,
  },
  scroll: {
    paddingBottom: 24,
    maxWidth: 900,
    width: '100%',
    alignSelf: 'center',
  },

  // Header (matches progress.tsx style)
  headWrap: { paddingHorizontal: 20, paddingTop: 20 },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 6,
  },
  backBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingLeft: 10, paddingRight: 16, paddingVertical: 9, borderRadius: 11,
    borderWidth: 1.5, borderColor: TEAL, backgroundColor: '#0F1B2D',
  },
  backText: { color: TEAL, fontSize: 14, fontWeight: '700', letterSpacing: 0.2 },
  headerCenter: {
    alignItems: 'center',
    gap: 4,
  },
  heroIcon: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: TEAL + '15',
    borderWidth: 1,
    borderColor: TEAL + '30',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  pageTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: Colors.light.text,
    letterSpacing: -0.3,
  },
  pageSub: {
    fontSize: 13,
    color: Colors.light.textSecondary,
  },
  pageResearch: {
    fontSize: 11,
    color: Colors.light.textLight,
    fontStyle: 'italic',
    marginTop: 2,
    marginBottom: 8,
  },

  body: {
    paddingHorizontal: 20,
    paddingTop: 20,
  },

  // Loading / error
  center: {
    alignItems: 'center',
    paddingVertical: 48,
    gap: 14,
  },
  loadText: {
    fontSize: 14,
    color: Colors.light.textSecondary,
    textAlign: 'center',
    paddingHorizontal: 32,
  },
  errorCard: {
    backgroundColor: Colors.light.card,
    borderRadius: 14,
    padding: 24,
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: Colors.light.error + '30',
  },
  errorText: {
    fontSize: 14,
    color: Colors.light.text,
    textAlign: 'center',
    lineHeight: 20,
  },
  retryBtn: {
    backgroundColor: Colors.light.error + '15',
    borderRadius: 999,
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  retryText: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.light.error,
  },

  // Sections
  section: {
    marginTop: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.light.text,
    marginBottom: 12,
  },

  // Pain point chips
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    backgroundColor: TEAL + '12',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: TEAL + '30',
  },
  chipText: {
    fontSize: 13,
    fontWeight: '700',
    color: TEAL,
    textTransform: 'capitalize',
  },

  // Summary row
  summaryRow: {
    flexDirection: 'row',
    marginTop: 20,
    gap: 10,
  },
  summaryBox: {
    flex: 1,
    backgroundColor: Colors.light.card,
    borderRadius: 14,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
    gap: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  summaryNum: {
    fontSize: 26,
    fontWeight: '900',
  },
  summaryLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.light.text,
    textAlign: 'center',
  },
  summaryHint: {
    fontSize: 9,
    color: Colors.light.textSecondary,
    textAlign: 'center',
    lineHeight: 13,
  },

  // Alert cards
  alertCard: {
    marginTop: 20,
    backgroundColor: Colors.light.card,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
  },
  alertHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  alertTitle: {
    fontSize: 14,
    fontWeight: '800',
  },
  alertDesc: {
    fontSize: 13,
    color: Colors.light.textSecondary,
    lineHeight: 18,
    marginBottom: 10,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 5,
  },
  bullet: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  bulletText: {
    fontSize: 13,
    color: Colors.light.text,
    textTransform: 'capitalize',
    fontWeight: '600',
  },

  // Priority focus
  focusRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 10,
  },
  focusNum: {
    width: 26,
    height: 26,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  focusNumText: {
    fontSize: 12,
    fontWeight: '800',
  },
  focusText: {
    flex: 1,
    fontSize: 13,
    color: Colors.light.text,
    lineHeight: 20,
    paddingTop: 3,
  },

  // Research card
  researchCard: {
    marginTop: 20,
    backgroundColor: Colors.light.borderSoft,
    borderRadius: 12,
    padding: 14,
    flexDirection: 'row',
    gap: 10,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  researchText: {
    flex: 1,
    fontSize: 11,
    color: Colors.light.textSecondary,
    fontStyle: 'italic',
    lineHeight: 17,
  },

  // CTA
  ctaBtn: {
    marginTop: 20,
    backgroundColor: TEAL,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    shadowColor: TEAL,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 6,
  },
  ctaText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fff',
  },
});
