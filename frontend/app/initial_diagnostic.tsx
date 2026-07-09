/**
 * Initial Diagnostic Screen
 *
 * Shown once, immediately after onboarding completion.
 * The learner writes a short text response to a domain-appropriate prompt.
 * The backend computes all 10 proficiency indicators and returns the baseline diagnosis.
 *
 * Research Foundation:
 * - Knoch (2009) / Alderson (2005): diagnostic tasks focus on specific abilities,
 *   not global impressions. The prompt is tailored to the learner's declared domain.
 * - Dimova (2022) / Fulcher (2003): performance-based task design — monologic
 *   (narration, description, argumentation) and interactional (conversation) types.
 * - Pallotti (2015) CAF: the 10 indicators cover Complexity, Accuracy, Fluency.
 * - Kolahi Ahari et al. (2025): lexical diversity, syntactic complexity, cohesion are
 *   the strongest predictors of L2 speaking proficiency.
 */

import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  StatusBar,
  Image,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { Colors, Spacing, BorderRadius, palette } from '@/constants/theme';
import { API_URL } from '@/constants/api';
import { getFreshToken } from '@/utils/auth';
import { Illustrations } from '@/constants/illustrations';

// TYPES

interface IndicatorResult {
  name: string;
  value: number;
  normalized: number;   // 0-100
  cefr_level: string;
  severity: string;
  sources?: string[];   // academic bibliography per indicator
  measured?: boolean;   // false = imputed (speech metrics on a text-only diagnostic)
}

interface DiagnosisResult {
  predicted_cefr: string;
  overall_score: number;
  indicators: IndicatorResult[];
  critical_areas: string[];
  strengths: string[];
  priority_recommendations: string[];
  exam_specific_scores: Record<string, number>;
  // RF corpus model prediction (S&I Corpus 2025, Knill et al. 2025)
  rf_predicted_cefr?: string;
  caf_cefr?: string;   // CAF-composite band (from overall_score) — independent cross-check
  rf_confidence?: number;
  rf_probabilities?: Record<string, number>;
}

interface VocabProfile {
  distribution: Record<string, number>;
  vocab_cefr_level: string;
  highest_level_words: string[];
}

interface LearnerCluster {
  cluster_id: number;
  cluster_name: string;
  label: string;
  cefr_band: string;
  description: string;
  caf_profile: { complexity: string; accuracy: string; fluency: string };
  strengths: string[];
  focus_areas: string[];
  recommended_modules: string[];
  learning_tip: string;
  confidence: number;
}

interface RomanianErrors {
  error_count: number;
  severity_score: number;
  categories: Record<string, number>;
  errors: Array<{ error_type: string; message: string; severity: number; occurrences: number }>;
}

// INDICATOR DISPLAY CONFIG

const INDICATOR_LABELS: Record<string, string> = {
  lexical_diversity:        'Vocabulary Range',
  lexical_sophistication:   'Word Sophistication',
  word_length:              'Word Complexity',
  sentence_complexity:      'Sentence Length',
  subordination_ratio:      'Subordination',
  syntactic_complexity:     'Syntactic Richness',
  articulation_rate:        'Speech Rate',
  pause_frequency:          'Fluency',
  cohesion_score:           'Coherence',
  morphosyntactic_accuracy: 'Grammar Accuracy',
};

const SEVERITY_COLOR: Record<string, string> = {
  '🔴 CRITICAL': '#ef4444',
  '🟡 HIGH':     '#f59e0b',
  '🟢 MEDIUM':   '#10b981',
  '🟢 LOW':      '#10b981',
};

// COMPONENT

type Phase = 'prompt' | 'writing' | 'analyzing' | 'results';

export default function InitialDiagnosticScreen() {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>('prompt');
  const [prompt, setPrompt] = useState<{ title: string; instruction: string; hint: string } | null>(null);
  const [domain, setDomain] = useState('description');
  const [cefr, setCefr] = useState('B1');
  const [text, setText] = useState('');
  const [wordCount, setWordCount] = useState(0);
  const [diagnosis, setDiagnosis] = useState<DiagnosisResult | null>(null);
  const [vocabProfile, setVocabProfile] = useState<VocabProfile | null>(null);
  const [romanianErrors, setRomanianErrors] = useState<RomanianErrors | null>(null);
  const [idl, setIdl] = useState<number | null>(null);
  const [learnerCluster, setLearnerCluster] = useState<LearnerCluster | null>(null);
  const [error, setError] = useState('');

  // Load domain and CEFR from onboarding answers
  useEffect(() => {
    loadOnboardingData();
  }, []);

  const loadOnboardingData = async () => {
    try {
      const token = await getFreshToken();
      if (!token) return;

      const res = await fetch(`${API_URL}/auth/onboarding`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        // /auth/onboarding returns the profile FLAT (fields at top level),
        // not nested under .profile — read the fields directly.
        const d = data.target_domain || 'description';
        const c = data.self_assessed_cefr || 'B1';
        setDomain(d);
        setCefr(c);
        fetchPrompt(d, token);
      }
    } catch (e) {
      // fallback to description
      fetchPrompt('description', null);
    }
  };

  const fetchPrompt = async (d: string, token: string | null) => {
    try {
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`${API_URL}/assessment/diagnostic-prompt?domain=${d}`, { headers });
      if (res.ok) {
        const data = await res.json();
        setPrompt(data);
      }
    } catch (e) {
      setPrompt({
        title: 'Writing Task',
        instruction: 'Write about a topic of your choice in English. Try to include varied vocabulary and clear sentence structure.',
        hint: 'Aim for 150 words.',
      });
    }
  };

  const handleTextChange = (val: string) => {
    setText(val);
    setWordCount(val.trim() ? val.trim().split(/\s+/).length : 0);
  };

  const handleSubmit = async () => {
    if (wordCount < 50) {
      setError('Please write at least 50 words for a reliable diagnosis.');
      return;
    }
    setError('');
    setPhase('analyzing');

    try {
      const token = await getFreshToken();

      // Step 1: Compute 10 indicators from text
      const analyzeRes = await fetch(`${API_URL}/assessment/analyze-text`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          text,
          domain,
          self_assessed_cefr: cefr,
        }),
      });

      if (!analyzeRes.ok) throw new Error('Analysis failed');
      const analyzed = await analyzeRes.json();
      const rawIndicators = analyzed.indicators as Record<string, number>;

      // Step 2: Run full initial assessment with computed indicators
      const userId = (await AsyncStorage.getItem('userEmail')) || 'unknown';
      const assessRes = await fetch(`${API_URL}/assessment/initial-assessment`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          user_id: userId,
          domain,
          ...rawIndicators,
        }),
      });

      if (!assessRes.ok) throw new Error('Assessment failed');
      const assessData = await assessRes.json();

      // Map response into local DiagnosisResult shape
      const result: DiagnosisResult = {
        predicted_cefr: assessData.predicted_cefr || 'B1',
        overall_score: assessData.overall_score || 50,
        indicators: (assessData.indicators || []).map((ind: any) => ({
          name: INDICATOR_LABELS[ind.indicator] || ind.indicator,
          value: ind.measured_value,
          normalized: ind.score ?? ind.normalized_score ?? 0,
          cefr_level: ind.cefr_level,
          severity: ind.severity,
          sources: ind.sources || [],
          measured: ind.measured ?? true,
        })),
        critical_areas: assessData.critical_areas || [],
        strengths: assessData.strengths || [],
        priority_recommendations: assessData.priority_recommendations || [],
        // backend returns "exam_scores" key
        exam_specific_scores: assessData.exam_scores || assessData.exam_specific_scores || {},
        // RF corpus model prediction (Cambridge S&I Corpus 2025)
        rf_predicted_cefr:  assessData.rf_predicted_cefr  ?? undefined,
        caf_cefr:           assessData.caf_cefr           ?? undefined,
        rf_confidence:      assessData.rf_confidence      ?? undefined,
        rf_probabilities:   assessData.rf_probabilities   ?? undefined,
      };

      // Preserve the very first baseline so Progress can always show the original starting point
      const existingBaseline = await AsyncStorage.getItem('baselineDiagnosis');
      if (existingBaseline && !await AsyncStorage.getItem('baselineDiagnosisOriginal')) {
        await AsyncStorage.setItem('baselineDiagnosisOriginal', existingBaseline);
      }
      await AsyncStorage.setItem('baselineDiagnosis', JSON.stringify(result));
      await AsyncStorage.setItem('rawIndicators', JSON.stringify(rawIndicators));
      await AsyncStorage.setItem('diagnosticCompleted', 'true');

      // Store enriched data for results display
      setVocabProfile(analyzed.vocabulary_profile || null);
      setRomanianErrors(analyzed.romanian_interference || null);
      setIdl(analyzed.idl || null);
      // Cluster can come from either analyze-text or initial-assessment
      setLearnerCluster(assessData.learner_cluster || analyzed.learner_cluster || null);
      setDiagnosis(result);
      setPhase('results');
    } catch (e: any) {
      console.error('Diagnostic error:', e);
      // Store a flag so user can retry later; don't block access
      await AsyncStorage.setItem('diagnosticCompleted', 'pending');
      router.replace('/(tabs)');
    }
  };

  const handleContinue = async () => {
    router.replace('/(tabs)');
  };

  // PHASE: PROMPT
  if (phase === 'prompt') {
    return (
      <View style={[styles.container, { backgroundColor: BG }]}>
        <StatusBar barStyle="light-content" backgroundColor={BG} />
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.topBadge}>
            <Text style={styles.badgeText}>Initial Diagnosis</Text>
          </View>

          <Text style={styles.mainTitle}>Your Starting Point</Text>
          <Text style={styles.mainSubtitle}>
            This short writing task lets us measure your current level across all 10 proficiency indicators.
            It takes about 10 minutes.
          </Text>

          <Image source={Illustrations.diagnostic} style={styles.hero} resizeMode="contain" />

          {prompt && (
            <View style={styles.promptCard}>
              <Text style={styles.promptLabel}>TASK</Text>
              <Text style={styles.promptTitle}>{prompt.title}</Text>
              <Text style={styles.promptInstruction}>{prompt.instruction}</Text>
              <View style={styles.hintRow}>
                <Feather name="info" size={14} color={TINT} />
                <Text style={styles.hintText}>{prompt.hint}</Text>
              </View>
            </View>
          )}

          <View style={styles.infoGrid}>
            {[
              { icon: 'bar-chart-2', label: '10 indicators', sub: 'measured from your text' },
              { icon: 'target', label: 'CEFR level', sub: 'predicted automatically' },
              { icon: 'search', label: 'Dual Diagnosis', sub: 'perception vs. measurement' },
              { icon: 'clipboard', label: 'Module plan', sub: 'personalised for you' },
            ].map(item => (
              <View key={item.label} style={styles.infoCard}>
                <Feather name={item.icon as any} size={20} color={TINT} style={{ marginBottom: 4 }} />
                <Text style={styles.infoLabel}>{item.label}</Text>
                <Text style={styles.infoSub}>{item.sub}</Text>
              </View>
            ))}
          </View>

          <TouchableOpacity style={styles.primaryBtn} onPress={() => setPhase('writing')} activeOpacity={0.8}>
            <Text style={styles.primaryBtnText}>Start Writing</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => router.replace('/(tabs)')} activeOpacity={0.7}>
            <Text style={styles.skipLink}>Skip for now — do it later</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    );
  }

  // PHASE: WRITING
  if (phase === 'writing') {
    return (
      <View style={[styles.container, { backgroundColor: BG }]}>
        <StatusBar barStyle="light-content" backgroundColor={BG} />
        <View style={styles.writingHeader}>
          <TouchableOpacity onPress={() => setPhase('prompt')} style={styles.backBtn}>
            <Feather name="chevron-left" size={18} color={TINT} />
            <Text style={styles.backBtnText}>Back</Text>
          </TouchableOpacity>
          <View style={[styles.wordCountBadge, wordCount >= 50 && styles.wordCountReady]}>
            <Text style={styles.wordCountText}>{wordCount} words{wordCount >= 50 ? '' : ' / 50 min'}</Text>
            {wordCount >= 50 && <Feather name="check" size={12} color={TINT} style={{ marginLeft: 4 }} />}
          </View>
        </View>

        {prompt && (
          <View style={styles.miniPrompt}>
            <Text style={styles.miniPromptText}>{prompt.instruction}</Text>
          </View>
        )}

        <TextInput
          style={styles.textInput}
          multiline
          placeholder="Start writing here..."
          placeholderTextColor={Colors.light.textSecondary}
          value={text}
          onChangeText={handleTextChange}
          textAlignVertical="top"
          autoFocus
        />

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <View style={styles.writingFooter}>
          <TouchableOpacity
            style={[styles.primaryBtn, styles.analyzeBtn, wordCount < 50 && styles.primaryBtnDisabled]}
            onPress={handleSubmit}
            disabled={wordCount < 50}
            activeOpacity={0.8}
          >
            <Text style={styles.primaryBtnText}>Analyse My Writing</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // PHASE: ANALYZING
  if (phase === 'analyzing') {
    return (
      <View style={[styles.container, styles.centred, { backgroundColor: BG }]}>
        <StatusBar barStyle="light-content" />
        <ActivityIndicator size="large" color={Colors.light.tint} />
        <Text style={styles.analyzingTitle}>Analysing your text...</Text>
        <Text style={styles.analyzingSubtitle}>
          Computing all 10 proficiency indicators:{'\n'}
          lexical diversity · syntax · cohesion · fluency · accuracy
        </Text>
      </View>
    );
  }

  // PHASE: RESULTS
  if (phase === 'results' && diagnosis) {
    return (
      <View style={[styles.container, { backgroundColor: BG }]}>
        <StatusBar barStyle="light-content" backgroundColor={BG} />
        <ScrollView contentContainerStyle={styles.scrollContent}>

          {/* Header */}
          <View style={styles.resultHeader}>
            <Text style={styles.resultCefr}>{diagnosis.predicted_cefr}</Text>
            <Text style={styles.resultCefrLabel}>Predicted CEFR Level</Text>
            <View style={styles.scoreCircle}>
              <Text style={styles.scoreNumber}>{Math.round(diagnosis.overall_score)}</Text>
              <Text style={styles.scoreMax}>/100</Text>
            </View>
            <Text style={styles.scoreLabel}>Overall proficiency score</Text>
          </View>

          {/* Second opinion: Ordinal LR + SVM ensemble */}
          {diagnosis.rf_predicted_cefr && (() => {
            // Real cross-check: the CAF composite band (from the 0-100 score) vs the
            // ordinal model. Map the 6-level CAF band onto the model's 4 classes first.
            const to4 = (b?: string) =>
              !b ? '' : (b === 'A1' || b === 'A2') ? 'A2'
                      : (b === 'C1' || b === 'C2' || b === 'C1-C2') ? 'C1-C2'
                      : b; // B1, B2
            const cafBand = diagnosis.caf_cefr;            // independent: CAF composite
            const ordBand = diagnosis.rf_predicted_cefr;   // independent: ordinal model
            const agree   = !!cafBand && to4(cafBand) === ordBand;
            const conf       = diagnosis.rf_confidence ?? 0;
            const LEVEL_DESC: Record<string, string> = {
              'A2': 'Elementary',
              'B1': 'Intermediate',
              'B2': 'Upper-Intermediate',
              'C1-C2': 'Advanced',
            };
            return (
              <View style={styles.rfCard}>
                <View style={styles.rfHeader}>
                  <Feather name="search" size={20} color={TINT} style={{ marginTop: 2 }} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rfTitle}>Cross-check · Ordinal model</Text>
                    <Text style={styles.rfSub}>
                      Ordinal Logistic Regression + SVM ensemble — respects the A2→C2 ordering
                    </Text>
                  </View>
                </View>

                {/* Big level display */}
                <View style={styles.rfLevelRow}>
                  <View style={[styles.rfLevelBox, { borderColor: TINT + '50', backgroundColor: TINT + '10' }]}>
                    <Text style={[styles.rfLevelBig, { color: TINT }]}>{diagnosis.rf_predicted_cefr}</Text>
                    <Text style={styles.rfLevelName}>{LEVEL_DESC[diagnosis.rf_predicted_cefr] ?? ''}</Text>
                  </View>
                  <View style={styles.rfLevelRight}>
                    <Text style={styles.rfConfSub}>
                      Confidence: <Text style={{ fontWeight: '800', color: TINT }}>{Math.round(conf * 100)}%</Text>
                    </Text>
                    <View style={styles.rfConfTrack}>
                      <View style={[styles.rfConfFill, { width: `${Math.round(conf * 100)}%` as any }]} />
                    </View>
                    <Text style={styles.rfConfHint}>
                      {conf >= 0.65 ? 'Strong match' : conf >= 0.45 ? 'Good match' : 'Close call'}
                    </Text>
                  </View>
                </View>

                {/* Agreement chip */}
                <View style={[styles.rfAgreePill, { backgroundColor: agree ? TINT + '15' : '#F59E0B15' }]}>
                  <Feather name={agree ? 'check-circle' : 'help-circle'} size={14} color={agree ? TINT : '#B45309'} />
                  <Text style={[styles.rfAgreeMsg, { color: agree ? TINT : '#B45309' }]}>
                    {agree
                      ? `Both methods agree — CAF composite (${cafBand}) and the ordinal model (${ordBand})`
                      : `Methods differ — CAF composite says ${cafBand ?? '—'}, ordinal model says ${ordBand}; your true level is likely between these`}
                  </Text>
                </View>
              </View>
            );
          })()}

          {/* Exam mapping via OFFICIAL CEFR concordance (not a rescaled CAF score).
              Cambridge English Scale + IELTS: "The methodology behind the Cambridge
              English Scale" (2015), which aligns Cambridge exams, IELTS and CEFR on one
              scale. TOEFL iBT totals summed from Tannenbaum & Wylie (2008), ETS RR-08-34,
              Table 18. */}
          {(() => {
            const CEFR_EXAM: Record<string, { cambridge: string; toefl: string; ielts: string }> = {
              A2: { cambridge: '120–139', toefl: '24–56',  ielts: '4.0' },
              B1: { cambridge: '140–159', toefl: '57–86',  ielts: '4.0–5.0' },
              B2: { cambridge: '160–179', toefl: '87–109', ielts: '5.5–6.5' },
              C1: { cambridge: '180–199', toefl: '110–120', ielts: '7.0–8.0' },
              C2: { cambridge: '200–230', toefl: '110–120', ielts: '8.5–9.0' },
            };
            const ORD: Record<string, number> = { A1: 1, A2: 2, B1: 3, B2: 4, C1: 5, C2: 6 };
            const levels = (diagnosis.predicted_cefr || '').match(/[ABC][12]/g) || [];
            const lvl = levels[0] || ''; // lower bound of the predicted band
            const map = CEFR_EXAM[lvl] || null;
            if (!map) return null;
            const exams = [
              { label: 'Cambridge\nEnglish Scale', range: map.cambridge, color: '#7C6FFF' },
              { label: 'TOEFL\niBT', range: map.toefl, color: '#F59E0B' },
              { label: 'IELTS\nAcademic', range: map.ielts, color: '#10B981' },
            ];
            const pct = ((ORD[lvl] ?? 1) / 6) * 100;
            return (
              <View style={styles.examCard}>
                <Text style={styles.sectionTitle}>International Exam Mapping</Text>
                <Text style={styles.examSubtitle}>
                  Official CEFR concordance for level {lvl} — not estimated from your score
                </Text>
                <View style={styles.examRow}>
                  {exams.map(({ label, range, color }) => (
                    <View key={label} style={styles.examBox}>
                      <View style={[styles.examArc, { borderColor: color }]}>
                        <Text style={[styles.examScore, { color, fontSize: 18 }]}>{range}</Text>
                      </View>
                      <View style={styles.examBarTrack}>
                        <View style={[styles.examBarFill, { width: `${pct}%`, backgroundColor: color }]} />
                      </View>
                      <Text style={styles.examLabel}>{label}</Text>
                    </View>
                  ))}
                </View>
                <Text style={styles.examNote}>
                  Cambridge English Scale &amp; IELTS: Cambridge English Scale methodology (2015), which
                  aligns Cambridge exams, IELTS and CEFR on one scale · TOEFL: Tannenbaum &amp; Wylie (2008), ETS RR-08-34
                </Text>
              </View>
            );
          })()}

          {/* Indicator bars */}
          <Text style={styles.sectionTitle}>10 Indicator Breakdown</Text>
          <Text style={styles.examSubtitle}>
            CAF Framework — Pallotti (2015) · Lee (2021) · Zechner et al. (2009)
          </Text>
          {diagnosis.indicators.map(ind => (
            <View key={ind.name} style={styles.indicatorRow}>
              <View style={styles.indicatorLabelRow}>
                <Text style={styles.indicatorName}>{ind.name}</Text>
                {ind.measured === false ? (
                  <Text style={[styles.indicatorCefr, { color: Colors.light.textSecondary }]}>—</Text>
                ) : (
                  <Text style={[styles.indicatorCefr, { color: SEVERITY_COLOR[ind.severity] || Colors.light.tint }]}>
                    {ind.cefr_level}
                  </Text>
                )}
              </View>
              {ind.measured === false ? (
                <Text style={styles.notMeasured}>
                  Not measured — needs a speaking session (text diagnostic can’t measure speech)
                </Text>
              ) : (
                <>
                  <View style={styles.barBg}>
                    <View style={[styles.barFill, {
                      width: `${ind.normalized}%`,
                      backgroundColor: SEVERITY_COLOR[ind.severity] || Colors.light.tint,
                    }]} />
                  </View>
                  <View style={styles.indicatorFooter}>
                    <Text style={styles.barPct}>{Math.round(ind.normalized)}%</Text>
                    {ind.sources && ind.sources.length > 0 && (
                      <Text style={styles.indicatorSource} numberOfLines={1}>
                        {ind.sources[0]}
                      </Text>
                    )}
                  </View>
                </>
              )}
            </View>
          ))}

          {/* Offer to actually measure the speech metrics that text can't capture */}
          {diagnosis.indicators.some(i => i.measured === false) && (
            <TouchableOpacity
              style={styles.measureSpeechBtn}
              onPress={() => router.push('/(tabs)/shadow')}
              activeOpacity={0.85}
            >
              <Feather name="mic" size={16} color="#fff" />
              <Text style={styles.measureSpeechText}>
                Record a speaking sample to measure Fluency &amp; Speech Rate
              </Text>
              <Feather name="arrow-right" size={15} color="#fff" />
            </TouchableOpacity>
          )}

          {/* Priority areas */}
          {diagnosis.critical_areas.length > 0 && (
            <>
              <Text style={styles.sectionTitle}>Focus Areas</Text>
              {diagnosis.critical_areas.slice(0, 3).map(area => (
                <View key={area} style={styles.focusCard}>
                  <Feather name="alert-triangle" size={15} color="#ef4444" />
                  <Text style={styles.focusText}>{area}</Text>
                </View>
              ))}
            </>
          )}

          {/* Strengths */}
          {diagnosis.strengths.length > 0 && (
            <>
              <Text style={styles.sectionTitle}>Strengths</Text>
              {diagnosis.strengths.slice(0, 2).map(s => (
                <View key={s} style={styles.strengthCard}>
                  <Feather name="check-circle" size={15} color="#10b981" />
                  <Text style={styles.focusText}>{s}</Text>
                </View>
              ))}
            </>
          )}

          {/* Learner Cluster Profile (Goldshtein et al. 2024) */}
          {learnerCluster && (
            <View style={[styles.enrichCard, styles.clusterCard]}>
              <View style={styles.clusterHeader}>
                <View style={styles.clusterBadge}>
                  <Text style={styles.clusterBadgeText}>{learnerCluster.cefr_band}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.clusterName}>{learnerCluster.cluster_name}</Text>
                  <Text style={styles.clusterLabel}>{learnerCluster.label}</Text>
                </View>
                <View style={styles.confidenceBadge}>
                  <Text style={styles.confidenceText}>
                    {Math.round(learnerCluster.confidence * 100)}%
                  </Text>
                  <Text style={styles.confidenceLabel}>match</Text>
                </View>
              </View>

              <Text style={styles.clusterDesc}>{learnerCluster.description}</Text>

              {/* CAF radar summary */}
              <View style={styles.cafRow}>
                {(['complexity', 'accuracy', 'fluency'] as const).map(dim => {
                  const val = learnerCluster.caf_profile[dim];
                  const color = val === 'high' ? '#10B981' : val === 'medium' ? '#F59E0B' : '#EF4444';
                  return (
                    <View key={dim} style={[styles.cafChip, { borderColor: color }]}>
                      <Text style={[styles.cafChipVal, { color }]}>{val.toUpperCase()}</Text>
                      <Text style={styles.cafChipDim}>{dim}</Text>
                    </View>
                  );
                })}
              </View>

              <Text style={styles.clusterTip}>{learnerCluster.learning_tip}</Text>
              <Text style={styles.enrichSource}>
                Goldshtein et al. (2024) · Yan et al. (2020) · Pallotti (2015) CAF
              </Text>
            </View>
          )}

          {/* Syntactic Maturity Composite — author-defined, NOT Neumanova's IDL */}
          {idl != null && (
            <View style={styles.enrichCard}>
              <Text style={styles.enrichTitle}>Syntactic Maturity Composite</Text>
              <Text style={styles.enrichSource}>Author-defined index (complexity × accuracy)</Text>
              <Text style={styles.idlValue}>{idl.toFixed(2)}</Text>
              <Text style={styles.enrichNote}>
                Composite = (MLS × Subordination) ÷ (1 + Error Rate).
                Higher = more syntactically complex and accurate. A custom blend of three
                indicators above — not a separately validated metric.
              </Text>
            </View>
          )}

          {/* EVP Vocabulary Profile */}
          {vocabProfile && (
            <View style={styles.enrichCard}>
              <Text style={styles.enrichTitle}>Vocabulary Level Distribution</Text>
              <Text style={styles.enrichSource}>
                EVP (Cambridge) · NAWL · new-GSL (Brezina &amp; Gablasova 2015)
              </Text>
              <View style={styles.vocabBars}>
                {(['A1','A2','B1','B2','C1','C2'] as const).map(lvl => {
                  const pct = vocabProfile.distribution[lvl] ?? 0;
                  const colors: Record<string, string> = {
                    A1: '#94A3B8', A2: '#64748B', B1: '#3B82F6',
                    B2: '#8B5CF6', C1: '#F59E0B', C2: '#10B981',
                  };
                  return (
                    <View key={lvl} style={styles.vocabBarRow}>
                      <Text style={styles.vocabBarLabel}>{lvl}</Text>
                      <View style={styles.vocabBarTrack}>
                        <View style={[styles.vocabBarFill, { width: `${pct}%`, backgroundColor: colors[lvl] }]} />
                      </View>
                      <Text style={styles.vocabBarPct}>{pct}%</Text>
                    </View>
                  );
                })}
              </View>
              {vocabProfile.highest_level_words.length > 0 && (
                <Text style={styles.enrichNote}>
                  Advanced words: {vocabProfile.highest_level_words.slice(0, 6).join(', ')}
                </Text>
              )}
            </View>
          )}

          {/* Romanian L1 Interference Errors (Pungă & Pârlog 2015) */}
          {romanianErrors && romanianErrors.error_count > 0 && (
            <View style={styles.enrichCard}>
              <Text style={styles.enrichTitle}>Romanian L1 Interference</Text>
              <Text style={styles.enrichSource}>Pungă &amp; Pârlog (2015) — rule-based detection</Text>
              <View style={styles.romanianRow}>
                <View style={styles.romanianMetric}>
                  <Text style={[styles.romanianScore, { color: romanianErrors.severity_score > 75 ? '#10b981' : romanianErrors.severity_score > 50 ? '#f59e0b' : '#ef4444' }]}>
                    {Math.round(romanianErrors.severity_score)}
                  </Text>
                  <Text style={styles.romanianMetricLabel}>Interference{'\n'}Score /100</Text>
                </View>
                <View style={{ flex: 1 }}>
                  {romanianErrors.errors.slice(0, 3).map((e, i) => (
                    <Text key={i} style={styles.romanianError}>• {e.message}</Text>
                  ))}
                </View>
              </View>
            </View>
          )}
          {romanianErrors && romanianErrors.error_count === 0 && (
            <View style={styles.enrichCard}>
              <Text style={styles.enrichTitle}>Romanian L1 Interference</Text>
              <Text style={styles.enrichSource}>Pungă &amp; Pârlog (2015)</Text>
              <Text style={[styles.enrichNote, { color: '#10b981' }]}>
                No common Romanian interference errors detected.
              </Text>
            </View>
          )}

          <Image source={Illustrations.celebration} style={styles.footerArt} resizeMode="contain" />

          <TouchableOpacity style={[styles.primaryBtn, { marginTop: Spacing.xl }]} onPress={handleContinue} activeOpacity={0.8}>
            <Text style={styles.primaryBtnText}>Go to My Learning Plan</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    );
  }

  return null;
}

// STYLES

// VocaFlow dark palette — single source of truth in theme.ts
const TINT = palette.teal;
const TINT_LIGHT = 'rgba(15,186,154,0.12)';
const CARD = palette.card;
const BORDER = palette.border;
const BG = palette.bg;
const TEXT = palette.text;
const TEXT_MUTED = palette.textMuted;
const TRACK = 'rgba(255,255,255,0.10)';   // progress/track backgrounds
const SURFACE = palette.bgElevated;        // subtle raised surface

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  centred: { justifyContent: 'center', alignItems: 'center' },
  scrollContent: { paddingHorizontal: Spacing.lg, paddingTop: Platform.OS === 'ios' ? 60 : 40, paddingBottom: 60 },

  topBadge: {
    alignSelf: 'flex-start', backgroundColor: TINT + '20',
    borderRadius: BorderRadius.round, paddingHorizontal: Spacing.md, paddingVertical: 4,
    marginBottom: Spacing.lg,
  },
  badgeText: { fontSize: 12, color: TINT, fontWeight: '600' },

  mainTitle: { fontSize: 28, fontWeight: '700', color: Colors.light.text, marginBottom: Spacing.sm },
  mainSubtitle: { fontSize: 14, color: Colors.light.textSecondary, lineHeight: 20, marginBottom: Spacing.xl },
  hero: { width: '88%', height: 170, alignSelf: 'center', marginBottom: Spacing.xl },
  footerArt: { width: '78%', height: 150, alignSelf: 'center', marginTop: Spacing.lg },

  promptCard: {
    backgroundColor: CARD, borderRadius: BorderRadius.lg, padding: Spacing.lg,
    borderWidth: 1, borderColor: TINT + '40', marginBottom: Spacing.xl,
  },
  promptLabel: { fontSize: 10, fontWeight: '700', color: TINT, letterSpacing: 1.5, marginBottom: 6 },
  promptTitle: { fontSize: 18, fontWeight: '700', color: Colors.light.text, marginBottom: Spacing.sm },
  promptInstruction: { fontSize: 14, color: Colors.light.text, lineHeight: 22, marginBottom: Spacing.md },
  hintRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
  hintIcon: { fontSize: 14 },
  hintText: { fontSize: 12, color: Colors.light.textSecondary, flex: 1 },

  infoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginBottom: Spacing.xl },
  infoCard: { width: '48%', backgroundColor: CARD, borderRadius: BorderRadius.md, padding: Spacing.md, borderWidth: 1, borderColor: BORDER },
  infoIcon: { fontSize: 22, marginBottom: 4 },
  infoLabel: { fontSize: 13, fontWeight: '700', color: Colors.light.text },
  infoSub: { fontSize: 11, color: Colors.light.textSecondary },

  primaryBtn: {
    backgroundColor: TINT, borderRadius: BorderRadius.md,
    paddingVertical: Spacing.md, alignItems: 'center', marginBottom: Spacing.md,
    shadowColor: TINT, shadowOpacity: 0.3, shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 }, elevation: 4,
  },
  primaryBtnDisabled: { backgroundColor: BORDER },
  primaryBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },

  // Enriched result cards
  enrichCard: {
    backgroundColor: CARD,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: BORDER,
  },
  enrichTitle: { fontSize: 14, fontWeight: '700', color: Colors.light.text, marginBottom: 2 },
  enrichSource: { fontSize: 10, color: Colors.light.textSecondary, fontStyle: 'italic', marginBottom: Spacing.sm },
  enrichNote: { fontSize: 12, color: Colors.light.textSecondary, marginTop: Spacing.sm, lineHeight: 17 },
  idlValue: { fontSize: 36, fontWeight: '800', color: TINT, textAlign: 'center', paddingVertical: Spacing.sm },
  vocabBars: { gap: 6 },
  vocabBarRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  vocabBarLabel: { fontSize: 11, fontWeight: '700', color: Colors.light.text, width: 24 },
  vocabBarTrack: { flex: 1, height: 10, backgroundColor: TRACK, borderRadius: 5, overflow: 'hidden' },
  vocabBarFill: { height: 10, borderRadius: 5 },
  vocabBarPct: { fontSize: 11, color: Colors.light.textSecondary, width: 36, textAlign: 'right' },
  romanianRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.md },
  romanianMetric: { alignItems: 'center', minWidth: 60 },
  romanianScore: { fontSize: 32, fontWeight: '800' },
  romanianMetricLabel: { fontSize: 10, color: Colors.light.textSecondary, textAlign: 'center', lineHeight: 14 },
  romanianError: { fontSize: 12, color: Colors.light.textSecondary, marginBottom: 4, lineHeight: 17 },

  // Cluster card
  clusterCard: { borderColor: TINT + '80', borderWidth: 1.5 },
  clusterHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.sm },
  clusterBadge: {
    backgroundColor: TINT, borderRadius: BorderRadius.sm,
    paddingHorizontal: 8, paddingVertical: 3,
  },
  clusterBadgeText: { fontSize: 11, fontWeight: '800', color: '#fff' },
  clusterName: { fontSize: 15, fontWeight: '800', color: Colors.light.text },
  clusterLabel: { fontSize: 11, color: Colors.light.textSecondary, marginTop: 1 },
  confidenceBadge: { alignItems: 'center' },
  confidenceText: { fontSize: 20, fontWeight: '800', color: TINT },
  confidenceLabel: { fontSize: 10, color: Colors.light.textSecondary },
  clusterDesc: { fontSize: 13, color: Colors.light.textSecondary, lineHeight: 19, marginBottom: Spacing.md },
  cafRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.md },
  cafChip: {
    flex: 1, alignItems: 'center', paddingVertical: 6,
    borderWidth: 1.5, borderRadius: BorderRadius.sm,
    backgroundColor: SURFACE,
  },
  cafChipVal: { fontSize: 12, fontWeight: '800' },
  cafChipDim: { fontSize: 10, color: Colors.light.textSecondary, marginTop: 2, textTransform: 'capitalize' },
  clusterTip: {
    fontSize: 12, color: Colors.light.text, fontStyle: 'italic',
    lineHeight: 18, paddingTop: Spacing.sm,
    borderTopWidth: 1, borderTopColor: BORDER,
  },
  skipLink: { textAlign: 'center', color: Colors.light.textSecondary, fontSize: 13 },

  // Writing phase
  writingHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg, paddingTop: Platform.OS === 'ios' ? 56 : 40, paddingBottom: Spacing.sm,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingLeft: 10,
    paddingRight: 16,
    paddingVertical: 9,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: TINT,
    backgroundColor: CARD,
  },
  backBtnText: {
    color: TINT,
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  wordCountBadge: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: BORDER, borderRadius: BorderRadius.round,
    paddingHorizontal: Spacing.md, paddingVertical: 4,
  },
  wordCountReady: { backgroundColor: TINT + '30' },
  wordCountText: { fontSize: 12, color: Colors.light.text, fontWeight: '600' },
  miniPrompt: {
    marginHorizontal: Spacing.lg, marginBottom: Spacing.sm,
    backgroundColor: CARD, borderRadius: BorderRadius.sm,
    padding: Spacing.sm, borderLeftWidth: 3, borderLeftColor: TINT,
  },
  miniPromptText: { fontSize: 12, color: Colors.light.textSecondary, lineHeight: 17 },
  textInput: {
    flex: 1, marginHorizontal: Spacing.lg, backgroundColor: CARD,
    borderRadius: BorderRadius.md, borderWidth: 1, borderColor: BORDER,
    padding: Spacing.md, color: Colors.light.text, fontSize: 15, lineHeight: 24,
  },
  errorText: { color: '#ef4444', fontSize: 12, marginHorizontal: Spacing.lg, marginTop: 4 },
  writingFooter: { padding: Spacing.lg },
  analyzeBtn: { marginBottom: 0 },

  // Analyzing phase
  analyzingTitle: { fontSize: 20, fontWeight: '700', color: Colors.light.text, marginTop: Spacing.xl, textAlign: 'center' },
  analyzingSubtitle: { fontSize: 13, color: Colors.light.textSecondary, marginTop: Spacing.sm, textAlign: 'center', lineHeight: 20 },

  // Results phase
  resultHeader: { alignItems: 'center', marginBottom: Spacing.xl },
  resultCefr: { fontSize: 64, fontWeight: '800', color: TINT },
  resultCefrLabel: { fontSize: 14, color: Colors.light.textSecondary, marginBottom: Spacing.lg },
  scoreCircle: { flexDirection: 'row', alignItems: 'baseline', gap: 4 },
  scoreNumber: { fontSize: 48, fontWeight: '800', color: Colors.light.text },
  scoreMax: { fontSize: 22, color: Colors.light.textSecondary },
  scoreLabel: { fontSize: 13, color: Colors.light.textSecondary, marginTop: 4 },

  sectionTitle: { fontSize: 16, fontWeight: '700', color: Colors.light.text, marginBottom: Spacing.md, marginTop: Spacing.lg },

  indicatorRow: { marginBottom: Spacing.md },
  indicatorLabelRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  indicatorName: { fontSize: 13, color: Colors.light.text, fontWeight: '500' },
  indicatorCefr: { fontSize: 12, fontWeight: '700' },
  barBg: { height: 8, backgroundColor: BORDER, borderRadius: 4, overflow: 'hidden' },
  barFill: { height: 8, borderRadius: 4 },
  indicatorFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 2 },
  barPct: { fontSize: 11, color: Colors.light.textSecondary },
  indicatorSource: { fontSize: 10, color: Colors.light.textSecondary, fontStyle: 'italic', flex: 1, textAlign: 'right', marginLeft: 8 },
  notMeasured: { fontSize: 11, color: Colors.light.textSecondary, fontStyle: 'italic', marginTop: 2 },
  measureSpeechBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: TINT,
    borderRadius: 12,
    paddingVertical: 13,
    paddingHorizontal: 16,
    marginTop: 14,
    marginBottom: 4,
  },
  measureSpeechText: { color: '#fff', fontSize: 13, fontWeight: '700', flexShrink: 1, textAlign: 'center' },

  // Exam scores
  examCard: { marginBottom: Spacing.md },
  examSubtitle: { fontSize: 11, color: Colors.light.textSecondary, fontStyle: 'italic', marginBottom: Spacing.md, marginTop: -6 },
  examRow: { flexDirection: 'row', gap: 10, marginBottom: Spacing.sm },
  examBox: { flex: 1, alignItems: 'center', gap: 6 },
  examArc: {
    width: 72, height: 72, borderRadius: 36,
    borderWidth: 3, justifyContent: 'center', alignItems: 'center',
    backgroundColor: SURFACE,
  },
  examScore: { fontSize: 20, fontWeight: '800', lineHeight: 24 },
  examMax: { fontSize: 10, color: Colors.light.textSecondary, lineHeight: 13 },
  examBarTrack: { width: '100%', height: 4, backgroundColor: BORDER, borderRadius: 2, overflow: 'hidden' },
  examBarFill: { height: 4, borderRadius: 2 },
  examLabel: { fontSize: 11, fontWeight: '700', color: Colors.light.text, textAlign: 'center', lineHeight: 15 },
  examNote: { fontSize: 10, color: Colors.light.textSecondary, fontStyle: 'italic', textAlign: 'center' },

  // RF "cross-checked with real learners" card
  rfCard: {
    backgroundColor: CARD, borderRadius: BorderRadius.md,
    padding: Spacing.md, marginBottom: Spacing.md,
    borderWidth: 1.5, borderColor: TINT + '35',
  },
  rfHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 14 },
  rfEmoji:  { fontSize: 20, marginTop: 2 },
  rfTitle:  { fontSize: 14, fontWeight: '800', color: Colors.light.text },
  rfSub:    { fontSize: 11, color: Colors.light.textSecondary, marginTop: 3, lineHeight: 16 },

  rfLevelRow: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 14 },
  rfLevelBox: {
    width: 80, height: 80, borderRadius: 18,
    borderWidth: 2, justifyContent: 'center', alignItems: 'center',
  },
  rfLevelBig:  { fontSize: 22, fontWeight: '900' },
  rfLevelName: { fontSize: 9, fontWeight: '700', color: Colors.light.textSecondary, marginTop: 2, textAlign: 'center' },

  rfLevelRight: { flex: 1, gap: 6 },
  rfConfSub:    { fontSize: 12, color: Colors.light.text },
  rfConfTrack:  { height: 8, backgroundColor: TRACK, borderRadius: 4, overflow: 'hidden' },
  rfConfFill:   { height: 8, backgroundColor: TINT, borderRadius: 4 },
  rfConfHint:   { fontSize: 11, color: Colors.light.textSecondary, fontStyle: 'italic' },

  rfAgreePill: {
    flexDirection: 'row', alignItems: 'flex-start',
    gap: 8, borderRadius: 12, padding: 12,
  },
  rfAgreeMsg: { flex: 1, fontSize: 12, lineHeight: 18, fontWeight: '600' },

  focusCard: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    backgroundColor: '#ef444420', borderRadius: BorderRadius.sm,
    padding: Spacing.sm, marginBottom: 6,
  },
  strengthCard: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    backgroundColor: '#10b98120', borderRadius: BorderRadius.sm,
    padding: Spacing.sm, marginBottom: 6,
  },
  focusIcon: { fontSize: 16 },
  focusText: { fontSize: 13, color: Colors.light.text, flex: 1 },
});
