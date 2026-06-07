/**
 * Re-Assessment Screen — Progress Measurement
 * ─────────────────────────────────────────────────────────────────────────────
 * Research Foundation:
 *   Norris & Ortega (2009): Syntactic complexity measurement validation —
 *   re-assessment must use the same 10 standardized indicators as baseline
 *   to ensure comparability and effect-size calculation.
 *
 *   Li & Shintani (2010): Targeted intervention produces effect size d=0.48
 *   on average. Re-assessment after module practice quantifies this effect.
 *
 *   Alderson (2005): Diagnostic cycle — diagnosis → intervention → re-diagnosis
 *   is the cornerstone of evidence-based language teaching.
 *
 *   Dimova (2022) / Fulcher (2003): Task domain must remain consistent across
 *   baseline and re-assessment for valid comparison.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Flow:
 *   1. Load baseline diagnosis from AsyncStorage (saved at initial diagnostic)
 *   2. User writes new text → POST /assessment/analyze-text → 10 new indicators
 *   3. POST /assessment/reassess → delta per indicator + CEFR progression
 *   4. Visualize improvement bars with before/after comparison
 *   5. Save new baseline to AsyncStorage for next re-assessment cycle
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Animated,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getAuth } from 'firebase/auth';
import { API_URL } from '@/constants/api';
import { getFreshToken } from '@/utils/auth';

// ── Theme ─────────────────────────────────────────────────────────────────────
const BG    = '#060D1A';
const CARD  = '#0F1B2D';
const CARD2 = '#060D1A';
const TEAL  = '#0FBA9A';
const CORAL = '#8B5CF6';
const AMBER = '#8B5CF6';
const TEXT  = '#F0F6FF';
const TEXT2 = '#94A3B8';
const BORDER = 'rgba(255,255,255,0.08)';

// ── Types ─────────────────────────────────────────────────────────────────────
type Phase = 'overview' | 'writing' | 'analyzing' | 'results';

type Indicator = {
  indicator: string;
  name: string;
  score: number;
  severity: string;
  cefr_level: string;
};

type Baseline = {
  predicted_cefr: string;
  overall_score: number;
  indicators: Indicator[];
};

type ReassessResult = {
  baseline_overall: number;
  current_overall: number;
  overall_improvement_points: number;
  baseline_cefr: string;
  current_cefr: string;
  cefr_advanced: boolean;
  indicator_improvements: Record<string, number>;
  most_improved_areas: string[];
  still_critical_areas: string[];
  progress_summary: string;
};

// ── Domain prompts ────────────────────────────────────────────────────────────
const DOMAINS = [
  { id: 'description',   label: 'Description',   prompt: 'Describe a place, person, or experience you know well. Be specific and detailed.' },
  { id: 'argumentation', label: 'Argumentation', prompt: 'Write your opinion on: Should social media be regulated by governments? Give reasons and examples.' },
  { id: 'narration',     label: 'Narration',      prompt: 'Tell a story about a challenge you faced and how you overcame it.' },
  { id: 'academic',      label: 'Academic',       prompt: 'Discuss the impact of technology on modern education, citing specific changes and effects.' },
];

const CEFR_ORDER = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

// ── Delta Bar component ───────────────────────────────────────────────────────
const DeltaBar = ({
  name,
  baseline,
  current,
  delta,
  index,
}: {
  name: string;
  baseline: number;
  current: number;
  delta: number;
  index: number;
}) => {
  const baseAnim = useRef(new Animated.Value(0)).current;
  const currAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(baseAnim, {
        toValue: Math.min(baseline, 100) / 100,
        duration: 600,
        delay: 100 + index * 60,
        useNativeDriver: false,
      }),
      Animated.timing(currAnim, {
        toValue: Math.min(current, 100) / 100,
        duration: 800,
        delay: 200 + index * 60,
        useNativeDriver: false,
      }),
    ]).start();
  }, []);

  const improved = delta >= 0;
  const deltaColor = delta > 5 ? TEAL : delta < -5 ? CORAL : AMBER;

  return (
    <View style={D.wrap}>
      <View style={D.header}>
        <Text style={D.name} numberOfLines={1}>{name}</Text>
        <View style={[D.deltaBadge, { backgroundColor: deltaColor + '20' }]}>
          <Text style={[D.deltaText, { color: deltaColor }]}>
            {improved ? '+' : ''}{delta.toFixed(1)}
          </Text>
        </View>
      </View>

      {/* Baseline bar */}
      <View style={D.row}>
        <Text style={D.rowLabel}>Before</Text>
        <View style={D.track}>
          <Animated.View style={[D.fill, {
            backgroundColor: '#8BA0B8',
            width: baseAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
          }]} />
        </View>
        <Text style={[D.pct, { color: TEXT2 }]}>{Math.round(baseline)}</Text>
      </View>

      {/* Current bar */}
      <View style={D.row}>
        <Text style={D.rowLabel}>After</Text>
        <View style={D.track}>
          <Animated.View style={[D.fill, {
            backgroundColor: TEAL,
            width: currAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
          }]} />
        </View>
        <Text style={[D.pct, { color: TEAL }]}>{Math.round(current)}</Text>
      </View>
    </View>
  );
};

const D = StyleSheet.create({
  wrap: { backgroundColor: CARD2, borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: BORDER },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  name: { fontSize: 13, fontWeight: '700', color: TEXT, flex: 1, marginRight: 8 },
  deltaBadge: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 },
  deltaText: { fontSize: 12, fontWeight: '800' },
  row: { flexDirection: 'row', alignItems: 'center', marginBottom: 5, gap: 8 },
  rowLabel: { fontSize: 10, color: TEXT2, width: 36, fontWeight: '600' },
  track: { flex: 1, height: 6, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 3, overflow: 'hidden' },
  fill: { height: 6, borderRadius: 3 },
  pct: { fontSize: 11, fontWeight: '700', width: 28, textAlign: 'right' },
});

// ── Main Screen ───────────────────────────────────────────────────────────────
export default function AssessmentScreen() {
  const auth = getAuth();
  const [phase,      setPhase]      = useState<Phase>('overview');
  const [baseline,   setBaseline]   = useState<Baseline | null>(null);
  const [domain,     setDomain]     = useState(DOMAINS[0]);
  const [text,       setText]       = useState('');
  const [wordCount,  setWordCount]  = useState(0);
  const [result,     setResult]     = useState<ReassessResult | null>(null);
  const [newInds,    setNewInds]    = useState<Indicator[]>([]);
  const [error,      setError]      = useState('');

  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    AsyncStorage.getItem('baselineDiagnosis').then((raw) => {
      if (raw) setBaseline(JSON.parse(raw));
    });
  }, []);

  const handleTextChange = (val: string) => {
    setText(val);
    setWordCount(val.trim().split(/\s+/).filter(Boolean).length);
  };

  const runReassessment = useCallback(async () => {
    setPhase('analyzing');
    setError('');
    try {
      const token = await getFreshToken();

      // Step 1: analyze new text → get 10 indicators
      const analyzeRes = await fetch(`${API_URL}/assessment/analyze-text`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ text, domain: domain.id }),
      });
      if (!analyzeRes.ok) throw new Error('Text analysis failed');
      const analyzed = await analyzeRes.json();
      const rawIndicators = analyzed.indicators as Record<string, number>;

      // Step 2: run full assessment to get scored indicators
      const userId = auth.currentUser?.uid ?? (await AsyncStorage.getItem('userEmail')) ?? 'unknown';
      const assessRes = await fetch(`${API_URL}/assessment/initial-assessment`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ user_id: userId, domain: domain.id, ...rawIndicators }),
      });
      if (!assessRes.ok) throw new Error('Assessment failed');
      const assessData = await assessRes.json();

      const scoredInds: Indicator[] = (assessData.indicators || []).map((ind: any) => ({
        indicator: ind.indicator,
        name: ind.name,
        score: ind.score ?? ind.normalized_score ?? 0,
        severity: ind.severity,
        cefr_level: ind.cefr_level,
      }));
      setNewInds(scoredInds);

      // Step 3: reassess — compare with stored baseline
      const bl = baseline!;
      const reassessRes = await fetch(`${API_URL}/assessment/reassess`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          user_id: userId,
          baseline_overall: bl.overall_score,
          baseline_cefr: bl.predicted_cefr,
          ...rawIndicators,
        }),
      });
      if (!reassessRes.ok) throw new Error('Re-assessment comparison failed');
      const reassessData: ReassessResult = await reassessRes.json();
      setResult(reassessData);

      // Save updated baseline
      const updated: Baseline = {
        predicted_cefr: assessData.predicted_cefr || bl.predicted_cefr,
        overall_score: assessData.overall_score || bl.overall_score,
        indicators: scoredInds,
      };
      await AsyncStorage.setItem('baselineDiagnosis', JSON.stringify(updated));
      await AsyncStorage.setItem('rawIndicators', JSON.stringify(rawIndicators));

      setPhase('results');
      Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }).start();
    } catch (e: any) {
      setError(e.message ?? 'Unknown error');
      setPhase('writing');
    }
  }, [text, domain, baseline]);

  // ── PHASE: overview ────────────────────────────────────────────────────────
  if (phase === 'overview') {
    const hasBl = baseline != null;
    const blCefrIdx = hasBl ? CEFR_ORDER.indexOf(baseline!.predicted_cefr) : -1;

    return (
      <View style={S.root}>
        <View style={S.hero}>
          <Text style={S.heroTitle}>Re-Assessment</Text>
          <Text style={S.heroSub}>Alderson (2005) Diagnostic Cycle</Text>
        </View>

        <ScrollView contentContainerStyle={S.scroll} showsVerticalScrollIndicator={false}>

          {/* Baseline card */}
          {hasBl ? (
            <View style={S.baseCard}>
              <Text style={S.baseLabel}>Your Baseline</Text>
              <View style={S.baseRow}>
                <View style={[S.cefrBubble, { backgroundColor: TEAL + '20', borderColor: TEAL + '40' }]}>
                  <Text style={[S.cefrText, { color: TEAL }]}>{baseline!.predicted_cefr}</Text>
                </View>
                <View style={S.baseRight}>
                  <Text style={S.baseScore}>{Math.round(baseline!.overall_score)}<Text style={S.baseScoreMax}>/100</Text></Text>
                  <Text style={S.baseScoreLabel}>Overall proficiency</Text>
                </View>
              </View>

              {/* CEFR progress bar */}
              <View style={S.cefrTrack}>
                {CEFR_ORDER.map((level, i) => (
                  <View
                    key={level}
                    style={[
                      S.cefrStep,
                      { backgroundColor: i <= blCefrIdx ? TEAL : 'rgba(255,255,255,0.08)' },
                    ]}
                  >
                    <Text style={[S.cefrStepText, { color: i <= blCefrIdx ? '#fff' : TEXT2 }]}>
                      {level}
                    </Text>
                  </View>
                ))}
              </View>
              <Text style={S.baseNote}>
                Norris &amp; Ortega (2009): re-assessment uses the same 10 indicators as baseline
              </Text>
            </View>
          ) : (
            <View style={S.noBaseCard}>
              <Feather name="alert-circle" size={28} color={AMBER} />
              <Text style={S.noBaseTitle}>No Baseline Found</Text>
              <Text style={S.noBaseDesc}>
                Complete the Initial Diagnostic first to establish your baseline scores.
              </Text>
            </View>
          )}

          {/* Domain picker */}
          <Text style={S.sectionTitle}>Select Task Domain</Text>
          <Text style={S.sectionSub}>
            Dimova (2022): domain must match your original assessment for valid comparison
          </Text>
          {DOMAINS.map((d) => (
            <TouchableOpacity
              key={d.id}
              style={[S.domainCard, domain.id === d.id && { borderColor: TEAL, backgroundColor: TEAL + '0D' }]}
              onPress={() => setDomain(d)}
              activeOpacity={0.8}
            >
              <View style={S.domainLeft}>
                {domain.id === d.id
                  ? <Feather name="check-circle" size={18} color={TEAL} />
                  : <Feather name="circle" size={18} color={TEXT2} />
                }
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[S.domainLabel, domain.id === d.id && { color: TEAL }]}>{d.label}</Text>
                <Text style={S.domainPromptPreview} numberOfLines={1}>{d.prompt}</Text>
              </View>
            </TouchableOpacity>
          ))}

          {/* Start button */}
          <TouchableOpacity
            onPress={() => hasBl ? setPhase('writing') : null}
            disabled={!hasBl}
            activeOpacity={0.85}
          >
            <View style={[S.startBtn, !hasBl && { backgroundColor: 'rgba(255,255,255,0.08)' }]}>
              <Text style={[S.startBtnText, !hasBl && { color: '#94A3B8' }]}>
                {hasBl ? 'Start Re-Assessment' : 'Complete Initial Diagnostic First'}
              </Text>
              {hasBl && <Feather name="arrow-right" size={18} color="#fff" />}
            </View>
          </TouchableOpacity>

          <View style={{ height: 40 }} />
        </ScrollView>
      </View>
    );
  }

  // ── PHASE: writing ─────────────────────────────────────────────────────────
  if (phase === 'writing') {
    const ready = wordCount >= 80;
    return (
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1, backgroundColor: BG }}
      >
        {/* Header */}
        <View style={S.writeHeader}>
          <TouchableOpacity onPress={() => setPhase('overview')} style={S.backBtn}>
            <Feather name="arrow-left" size={20} color={TEXT} />
          </TouchableOpacity>
          <Text style={S.writeTitle}>{domain.label} Task</Text>
          <View style={[S.wordBadge, ready && { backgroundColor: TEAL + '25', borderColor: TEAL + '50' }]}>
            <Text style={[S.wordBadgeText, ready && { color: TEAL }]}>{wordCount} words</Text>
          </View>
        </View>

        {/* Prompt */}
        <View style={S.promptBox}>
          <Text style={S.promptLabel}>TASK</Text>
          <Text style={S.promptText}>{domain.prompt}</Text>
          <Text style={S.promptHint}>Write at least 80 words for a valid re-assessment.</Text>
        </View>

        {/* Error */}
        {error !== '' && <Text style={S.errorText}>{error}</Text>}

        {/* Text input */}
        <TextInput
          style={S.textInput}
          value={text}
          onChangeText={handleTextChange}
          multiline
          placeholder="Write your response here..."
          placeholderTextColor={TEXT2 + '60'}
          textAlignVertical="top"
        />

        {/* Submit */}
        <View style={S.writeFooter}>
          <TouchableOpacity
            onPress={runReassessment}
            disabled={!ready}
            activeOpacity={0.85}
          >
            <View style={[S.startBtn, !ready && { backgroundColor: 'rgba(255,255,255,0.08)' }]}>
              <Text style={[S.startBtnText, !ready && { color: '#94A3B8' }]}>
                {ready ? 'Analyse My Progress' : `Need ${80 - wordCount} more words`}
              </Text>
              {ready && <Feather name="zap" size={16} color="#fff" />}
            </View>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    );
  }

  // ── PHASE: analyzing ───────────────────────────────────────────────────────
  if (phase === 'analyzing') {
    return (
      <View style={[S.root, { justifyContent: 'center', alignItems: 'center', gap: 20 }]}>
        <ActivityIndicator size="large" color={TEAL} />
        <Text style={{ fontSize: 17, fontWeight: '700', color: TEXT }}>Analysing your progress...</Text>
        <Text style={{ fontSize: 13, color: TEXT2, textAlign: 'center', paddingHorizontal: 32 }}>
          Computing all 10 proficiency indicators{'\n'}and comparing with your baseline
        </Text>
      </View>
    );
  }

  // ── PHASE: results ─────────────────────────────────────────────────────────
  if (phase === 'results' && result && baseline) {
    const improved = result.overall_improvement_points > 0;
    const unchanged = Math.abs(result.overall_improvement_points) <= 1;
    const progressColor = unchanged ? AMBER : improved ? TEAL : CORAL;

    // Build per-indicator comparison
    const indMap: Record<string, Indicator> = {};
    baseline.indicators.forEach((i) => { indMap[i.name] = i; });
    const newIndMap: Record<string, Indicator> = {};
    newInds.forEach((i) => { newIndMap[i.name] = i; });

    const comparisons = newInds.map((ind) => {
      const before = indMap[ind.name]?.score ?? 50;
      const after  = ind.score;
      const delta  = result.indicator_improvements[ind.indicator] ?? (after - before);
      return { name: ind.name, baseline: before, current: after, delta };
    }).sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));

    return (
      <View style={S.root}>
        <ScrollView contentContainerStyle={S.scroll} showsVerticalScrollIndicator={false}>
          <Animated.View style={{ opacity: fadeAnim }}>

            {/* Hero — Overall progress */}
            <View style={[S.resultHero, { borderColor: progressColor + '35' }]}>
              <Text style={S.resultHeroLabel}>Progress Since Baseline</Text>
              <View style={S.resultScoreRow}>
                <View style={S.resultScore}>
                  <Text style={[S.resultBig, { color: TEXT2 }]}>{Math.round(result.baseline_overall)}</Text>
                  <Text style={S.resultSmall}>Before</Text>
                </View>
                <Feather name="arrow-right" size={24} color={progressColor} />
                <View style={S.resultScore}>
                  <Text style={[S.resultBig, { color: TEAL }]}>{Math.round(result.current_overall)}</Text>
                  <Text style={S.resultSmall}>After</Text>
                </View>
              </View>

              <View style={[S.improvBadge, { backgroundColor: progressColor + '20', borderColor: progressColor + '40' }]}>
                <Text style={[S.improvText, { color: progressColor }]}>
                  {improved ? '+' : ''}{result.overall_improvement_points.toFixed(1)} points{' '}
                  {improved ? '↑' : unchanged ? '→' : '↓'}
                </Text>
              </View>

              {/* CEFR advancement */}
              {result.cefr_advanced && (
                <View style={S.cefrAdvance}>
                  <Feather name="award" size={16} color={TEAL} />
                  <Text style={S.cefrAdvanceText}>
                    CEFR Advanced: {result.baseline_cefr} → {result.current_cefr}
                  </Text>
                </View>
              )}
              {!result.cefr_advanced && (
                <Text style={S.cefrNoAdvance}>
                  {result.baseline_cefr} → {result.current_cefr} · Keep practicing to advance
                </Text>
              )}
            </View>

            {/* Per-indicator comparison */}
            <Text style={[S.sectionTitle, { paddingHorizontal: 0, marginTop: 4 }]}>
              Indicator Comparison
            </Text>
            <Text style={[S.sectionSub, { paddingHorizontal: 0, marginBottom: 14 }]}>
              Li &amp; Shintani (2010): targeted practice — effect size d=0.48
            </Text>
            {comparisons.map((c, i) => (
              <DeltaBar key={c.name} name={c.name} baseline={c.baseline} current={c.current} delta={c.delta} index={i} />
            ))}

            {/* Most improved */}
            {result.most_improved_areas.length > 0 && (
              <View style={[S.areaCard, { borderColor: TEAL + '30', backgroundColor: TEAL + '08' }]}>
                <View style={S.areaHeader}>
                  <Feather name="trending-up" size={15} color={TEAL} />
                  <Text style={[S.areaTitle, { color: TEAL }]}>Most Improved</Text>
                </View>
                {result.most_improved_areas.map((a, i) => (
                  <View key={i} style={S.bulletRow}>
                    <View style={[S.bullet, { backgroundColor: TEAL }]} />
                    <Text style={S.bulletText}>{a}</Text>
                  </View>
                ))}
              </View>
            )}

            {/* Still critical */}
            {result.still_critical_areas.length > 0 && (
              <View style={[S.areaCard, { borderColor: CORAL + '30', backgroundColor: CORAL + '08' }]}>
                <View style={S.areaHeader}>
                  <Feather name="alert-circle" size={15} color={CORAL} />
                  <Text style={[S.areaTitle, { color: CORAL }]}>Still Needs Work</Text>
                </View>
                {result.still_critical_areas.map((a, i) => (
                  <View key={i} style={S.bulletRow}>
                    <View style={[S.bullet, { backgroundColor: CORAL }]} />
                    <Text style={S.bulletText}>{a}</Text>
                  </View>
                ))}
              </View>
            )}

            {/* Summary */}
            <View style={S.summaryCard}>
              <Feather name="book-open" size={14} color={TEXT2} />
              <Text style={S.summaryText}>{result.progress_summary}</Text>
            </View>

            {/* Actions */}
            <TouchableOpacity onPress={() => { setPhase('overview'); setResult(null); setText(''); setWordCount(0); }} activeOpacity={0.85}>
              <View style={S.startBtn}>
                <Text style={S.startBtnText}>New Re-Assessment</Text>
                <Feather name="refresh-cw" size={16} color="#fff" />
              </View>
            </TouchableOpacity>

            <View style={{ height: 40 }} />
          </Animated.View>
        </ScrollView>
      </View>
    );
  }

  return null;
}

// ── Styles ────────────────────────────────────────────────────────────────────
const S = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },
  scroll: { paddingHorizontal: 20, paddingBottom: 24 },

  // Hero
  hero: { paddingTop: 18, paddingBottom: 18, paddingHorizontal: 20, backgroundColor: CARD, borderBottomWidth: 1, borderBottomColor: BORDER },
  heroTitle: { fontSize: 22, fontWeight: '800', color: TEXT, letterSpacing: -0.5 },
  heroSub: { fontSize: 11, color: TEXT2, fontStyle: 'italic', marginTop: 3 },

  // Section titles
  sectionTitle: { fontSize: 16, fontWeight: '800', color: TEXT, marginTop: 20, marginBottom: 4 },
  sectionSub: { fontSize: 11, color: TEXT2, fontStyle: 'italic', marginBottom: 14 },

  // Baseline card
  baseCard: {
    backgroundColor: CARD, borderRadius: 20, padding: 18,
    borderWidth: 1, borderColor: BORDER, marginTop: 16,
  },
  baseLabel: { fontSize: 11, fontWeight: '800', color: TEXT2, letterSpacing: 1.5, marginBottom: 12 },
  baseRow: { flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 16 },
  cefrBubble: {
    width: 64, height: 64, borderRadius: 20,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1.5,
  },
  cefrText: { fontSize: 20, fontWeight: '900' },
  baseRight: { gap: 2 },
  baseScore: { fontSize: 40, fontWeight: '900', color: TEXT, lineHeight: 44 },
  baseScoreMax: { fontSize: 16, color: TEXT2, fontWeight: '400' },
  baseScoreLabel: { fontSize: 12, color: TEXT2 },
  cefrTrack: { flexDirection: 'row', gap: 4, marginBottom: 12 },
  cefrStep: { flex: 1, height: 26, borderRadius: 6, justifyContent: 'center', alignItems: 'center' },
  cefrStepText: { fontSize: 10, fontWeight: '800' },
  baseNote: { fontSize: 10, color: TEXT2, fontStyle: 'italic', lineHeight: 15 },

  // No baseline
  noBaseCard: {
    backgroundColor: AMBER + '10', borderRadius: 16, padding: 24,
    alignItems: 'center', gap: 10, borderWidth: 1, borderColor: AMBER + '30', marginTop: 16,
  },
  noBaseTitle: { fontSize: 16, fontWeight: '800', color: TEXT },
  noBaseDesc: { fontSize: 13, color: TEXT2, textAlign: 'center', lineHeight: 19 },

  // Domain picker
  domainCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: CARD, borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: BORDER, marginBottom: 8,
  },
  domainLeft: { width: 24, alignItems: 'center' },
  domainLabel: { fontSize: 14, fontWeight: '700', color: TEXT, marginBottom: 2 },
  domainPromptPreview: { fontSize: 11, color: TEXT2, lineHeight: 15 },

  // Start button
  startBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    borderRadius: 14, paddingVertical: 16, gap: 10, marginTop: 16,
    backgroundColor: TEAL,
    shadowColor: TEAL, shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3, shadowRadius: 14, elevation: 10,
  },
  startBtnText: { fontSize: 16, fontWeight: '700', color: '#fff' },

  // Writing phase
  writeHeader: {
    flexDirection: 'row', alignItems: 'center',
    paddingTop: Platform.OS === 'ios' ? 52 : 20,
    paddingBottom: 14, paddingHorizontal: 16, gap: 12,
    backgroundColor: CARD, borderBottomWidth: 1, borderBottomColor: BORDER,
  },
  backBtn: {
    width: 38, height: 38, borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.08)',
    justifyContent: 'center', alignItems: 'center',
  },
  writeTitle: { flex: 1, fontSize: 17, fontWeight: '800', color: TEXT },
  wordBadge: {
    borderRadius: 999, paddingHorizontal: 12, paddingVertical: 4,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1, borderColor: BORDER,
  },
  wordBadgeText: { fontSize: 12, fontWeight: '700', color: TEXT2 },
  promptBox: {
    backgroundColor: CARD, marginHorizontal: 16, borderRadius: 14,
    padding: 14, borderWidth: 1, borderColor: TEAL + '40',
    borderLeftWidth: 3, borderLeftColor: TEAL, marginBottom: 12,
  },
  promptLabel: { fontSize: 10, fontWeight: '800', color: TEAL, letterSpacing: 1.5, marginBottom: 6 },
  promptText: { fontSize: 14, color: TEXT, lineHeight: 21, marginBottom: 6 },
  promptHint: { fontSize: 11, color: TEXT2, fontStyle: 'italic' },
  errorText: { color: CORAL, fontSize: 12, paddingHorizontal: 16, marginBottom: 6 },
  textInput: {
    flex: 1, marginHorizontal: 16, backgroundColor: CARD,
    borderRadius: 14, borderWidth: 1, borderColor: BORDER,
    padding: 14, color: TEXT, fontSize: 15, lineHeight: 24,
  },
  writeFooter: { padding: 16 },

  // Results
  resultHero: {
    borderRadius: 20, padding: 20, borderWidth: 1,
    alignItems: 'center', gap: 10, marginTop: 16,
    backgroundColor: CARD,
  },
  resultHeroLabel: { fontSize: 12, fontWeight: '700', color: TEXT2, letterSpacing: 1 },
  resultScoreRow: { flexDirection: 'row', alignItems: 'center', gap: 20 },
  resultScore: { alignItems: 'center' },
  resultBig: { fontSize: 48, fontWeight: '900', lineHeight: 52 },
  resultSmall: { fontSize: 12, color: TEXT2, marginTop: 2 },
  improvBadge: {
    borderRadius: 999, paddingHorizontal: 18, paddingVertical: 7,
    borderWidth: 1,
  },
  improvText: { fontSize: 16, fontWeight: '800' },
  cefrAdvance: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: TEAL + '15', borderRadius: 999,
    paddingHorizontal: 14, paddingVertical: 6,
  },
  cefrAdvanceText: { fontSize: 13, fontWeight: '700', color: TEAL },
  cefrNoAdvance: { fontSize: 11, color: TEXT2, fontStyle: 'italic' },

  // Area cards
  areaCard: { borderRadius: 16, padding: 16, borderWidth: 1, marginBottom: 12, marginTop: 4 },
  areaHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  areaTitle: { fontSize: 14, fontWeight: '800' },
  bulletRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 6 },
  bullet: { width: 6, height: 6, borderRadius: 3 },
  bulletText: { fontSize: 13, color: TEXT, flex: 1, lineHeight: 19 },

  // Summary
  summaryCard: {
    flexDirection: 'row', gap: 10, backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 12, padding: 14, borderWidth: 1, borderColor: BORDER, marginBottom: 16,
  },
  summaryText: { flex: 1, fontSize: 12, color: TEXT2, fontStyle: 'italic', lineHeight: 18 },
});
