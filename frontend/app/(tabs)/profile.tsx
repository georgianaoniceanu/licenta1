import { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Animated,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { signOut } from 'firebase/auth';
import { auth } from '@/config/firebase';
import { getFreshToken } from '@/utils/auth';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { API_URL, ASSESSMENT_ENDPOINTS } from '@/constants/api';
import {
  isSpeechAvailable, warmupVoices, getVoiceProfile,
  playRecordingOrTTS, stopAllPlayback,
} from '@/utils/voiceProfiles';
import { JOBS_BY_ID } from '@/constants/jobsDatabase';
import { getDemoAudio } from '@/constants/demoAudio';
import { palette } from '@/constants/theme';

// Types

type Indicator = {
  name: string;
  normalized: number;
  score?: number;
  severity: 'critical' | 'moderate' | 'acceptable' | 'strong';
  cefr_level: string;
};

type BaselineDiagnosis = {
  predicted_cefr: string;
  overall_score: number;
  indicators: Indicator[];
  critical_areas: string[];
  strengths: string[];
  // RF corpus model (Cambridge S&I Corpus 2025)
  rf_predicted_cefr?: string;
  rf_confidence?: number;
  rf_probabilities?: Record<string, number>;
};

type OnboardingProfile = {
  self_assessed_cefr?: string;
  primary_goal?: string;
  target_domain?: string;
  target_exam?: string;
  perceived_weak_areas?: string[];
  daily_study_minutes?: number;
};

type AssessmentRecord = {
  id?: string;
  ts: number;
  cefr: string;
  overall_score: number;
  domain?: string;
  rf_predicted_cefr?: string;
};

// Palette

const BG     = palette.bg;
const CARD   = palette.card;
const BORDER = palette.border;
const TEAL   = palette.teal;
const CORAL  = palette.purple;
const PURPLE = palette.purple;
const NAVY   = palette.bgElevated;
const TEXT   = palette.text;
const TEXT2  = palette.textMuted;
const TEXT3  = palette.textMuted;

const CEFR_COLORS: Record<string, string> = {
  A1: '#94A3B8', A2: '#64748B', B1: '#8B5CF6',
  B2: '#8B5CF6', C1: '#8B5CF6', C2: '#0FBA9A',
  'C1-C2': '#8B5CF6',   // RF model groups C1 and C2 together
};

const SEVERITY_COLORS: Record<string, string> = {
  critical: '#EF4444', moderate: '#8B5CF6', acceptable: '#0FBA9A', strong: '#8B5CF6',
};

// Helpers

function initials(name: string): string {
  return name
    .split(' ')
    .slice(0, 2)
    .map(w => w[0]?.toUpperCase() ?? '')
    .join('');
}

// Row components

const InfoRow = ({ icon, label, value }: { icon: string; label: string; value: string }) => (
  <View style={R.row}>
    <Text style={R.icon}>{icon}</Text>
    <View style={R.textCol}>
      <Text style={R.label}>{label}</Text>
      <Text style={R.value}>{value}</Text>
    </View>
  </View>
);

const R = StyleSheet.create({
  row:     { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 10 },
  icon:    { fontSize: 20, width: 28, textAlign: 'center' },
  textCol: { flex: 1, gap: 1 },
  label:   { fontSize: 11, color: TEXT3, fontWeight: '600', letterSpacing: 0.4 },
  value:   { fontSize: 14, color: TEXT, fontWeight: '600' },
});

const QuickLink = ({ icon, label, route, color }: {
  icon: string; label: string; route: string; color: string;
}) => {
  const router = useRouter();
  return (
    <TouchableOpacity
      style={[QL.card, { borderColor: color + '28' }]}
      onPress={() => router.push(route as any)}
      activeOpacity={0.7}
    >
      <View style={[QL.iconWrap, { backgroundColor: color + '14' }]}>
        <Feather name={icon as any} size={16} color={color} />
      </View>
      <Text style={QL.label}>{label}</Text>
      <Feather name="chevron-right" size={14} color={TEXT3} />
    </TouchableOpacity>
  );
};

const QL = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: CARD,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    marginBottom: 10,
    gap: 12,
  },
  iconWrap: {
    width: 36, height: 36, borderRadius: 10,
    justifyContent: 'center', alignItems: 'center',
  },
  label: { flex: 1, fontSize: 14, fontWeight: '600', color: TEXT },
});

// Main Screen

// Voice Profile Card

const VOICE_SAMPLE_BY_PRESET: Record<string, string> = {
  weak:   "I... I want to learn English. It is, uh, difficult sometimes.",
  medium: "I usually study English for about thirty minutes every day, and I think I'm improving.",
  strong: "Learning a second language is a long process, but consistent practice makes a real difference.",
  ana:    "I am studying medicine, and I need to read scientific papers written in English.",
  mihai:  "When I write code reviews, I try to be concise and precise about what needs to be improved.",
  elena:  "The contractual clauses were drafted to accommodate cross-border jurisdictional complexities.",
  radu:   "The summit produced no concrete agreement, though both sides described the talks as constructive.",
  sorin:  "We are launching a new campaign that targets European markets, focusing on customer engagement.",
  diana:  "The quarterly earnings exceeded analyst expectations, driven by strong performance in the Asian markets.",
};

function VoiceProfileCard({
  preset, displayName, jobId,
}: { preset: string | null; displayName: string; jobId: string | null }) {
  const profile = getVoiceProfile(preset);
  const [playing, setPlaying] = useState(false);
  const audioModule = getDemoAudio(preset ? `${preset}_voice` : null);
  const hasRealRecording = !!audioModule;
  const canPlay = hasRealRecording || isSpeechAvailable();
  const job = jobId ? JOBS_BY_ID[jobId] : null;

  // Stop playback on unmount
  useEffect(() => () => { stopAllPlayback(); }, []);

  // Waveform animation
  const waveAnims = useRef(Array.from({ length: 7 }, () => new Animated.Value(0.3))).current;
  useEffect(() => {
    if (!playing) {
      waveAnims.forEach(a => a.setValue(0.3));
      return;
    }
    const loops = waveAnims.map((v, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.timing(v, { toValue: 1,    duration: 300 + i * 50, useNativeDriver: true }),
          Animated.timing(v, { toValue: 0.25, duration: 300 + i * 50, useNativeDriver: true }),
        ])
      )
    );
    loops.forEach((l, i) => setTimeout(() => l.start(), i * 50));
    return () => loops.forEach(l => l.stop());
  }, [playing]);

  const sampleText = (preset && VOICE_SAMPLE_BY_PRESET[preset])
    || `Hi, I'm ${displayName}. I am working on improving my English.`;

  const handlePlay = () => {
    if (playing) {
      stopAllPlayback();
      setPlaying(false);
      return;
    }
    void playRecordingOrTTS({
      audioModule,
      text: sampleText,
      preset,
      onStart: () => setPlaying(true),
      onEnd:   () => setPlaying(false),
      onError: () => setPlaying(false),
    });
  };

  return (
    <View style={S.voiceCard}>
      <View style={S.voiceHeader}>
        <View style={S.voiceIconWrap}>
          <Feather name="mic" size={16} color={PURPLE} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={S.voiceTitle}>Voice Profile</Text>
          <Text style={S.voiceSubtitle}>{profile.description}</Text>
        </View>
        {hasRealRecording && (
          <View style={S.voiceRealBadge}>
            <Text style={S.voiceRealBadgeText}>REC</Text>
          </View>
        )}
      </View>

      <View style={S.voiceMetricsRow}>
        <VoiceMetric label="RATE"   value={`${profile.rate.toFixed(2)}×`} />
        <VoiceMetric label="PITCH"  value={profile.pitch.toFixed(2)} />
        <VoiceMetric label="ACCENT" value={profile.accent} />
        <VoiceMetric label="VOICE"  value={profile.preferredGender === 'female' ? 'Female' : 'Male'} />
      </View>

      {job && (
        <Text style={S.voiceJobLine}>
          Speaks like a typical <Text style={{ fontWeight: '800' }}>{job.title}</Text>
        </Text>
      )}

      <View style={S.voicePlayRow}>
        <TouchableOpacity
          style={[S.voicePlayBtn, { backgroundColor: playing ? '#EF4444' : PURPLE }]}
          onPress={handlePlay}
          disabled={!canPlay}
          activeOpacity={0.85}
        >
          <Feather name={playing ? 'square' : 'play'} size={16} color="#fff" />
          <Text style={S.voicePlayBtnText}>
            {playing ? 'Stop' : hasRealRecording ? 'Play recording' : 'Listen to sample'}
          </Text>
        </TouchableOpacity>

        <View style={S.voiceWaveform}>
          {waveAnims.map((v, i) => (
            <Animated.View
              key={i}
              style={[
                S.voiceWaveBar,
                {
                  backgroundColor: playing ? PURPLE : 'rgba(255,255,255,0.06)',
                  transform: [{ scaleY: v }],
                },
              ]}
            />
          ))}
        </View>
      </View>

      <Text style={S.voiceSampleText} numberOfLines={2}>"{sampleText}"</Text>

      {!canPlay && Platform.OS !== 'web' && (
        <Text style={S.voiceFallback}>
          Voice playback is available in the web build.
        </Text>
      )}
    </View>
  );
}

function VoiceMetric({ label, value }: { label: string; value: string }) {
  return (
    <View style={S.voiceMetric}>
      <Text style={S.voiceMetricVal}>{value}</Text>
      <Text style={S.voiceMetricLbl}>{label}</Text>
    </View>
  );
}

export default function ProfileScreen() {
  const router = useRouter();
  const user   = auth.currentUser;

  const [diagnosis,  setDiagnosis]  = useState<BaselineDiagnosis | null>(null);
  const [profile,    setProfile]    = useState<OnboardingProfile | null>(null);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeDemoPreset, setActiveDemoPreset]  = useState<string | null>(null);
  const [demoDisplayName,  setDemoDisplayName]   = useState<string | null>(null);
  const [userJobId,        setUserJobId]         = useState<string | null>(null);
  const [assessmentHistory, setAssessmentHistory] = useState<AssessmentRecord[]>([]);

  // Use the demo's name when in a job-persona demo, otherwise the firebase name
  const displayName = demoDisplayName || user?.displayName || user?.email?.split('@')[0] || 'Learner';
  const email       = user?.email ?? '';
  const avatarLabel = initials(displayName);

  const loadData = useCallback(async () => {
    try {
      const [stored, storedOrig, token, demoPreset, demoName, jobId] = await Promise.all([
        AsyncStorage.getItem('baselineDiagnosis'),
        AsyncStorage.getItem('baselineDiagnosisOriginal'),
        getFreshToken(),
        AsyncStorage.getItem('active_demo_preset'),
        AsyncStorage.getItem('userDisplayName'),
        AsyncStorage.getItem('userJob'),
      ]);
      if (stored) setDiagnosis(JSON.parse(stored));
      setActiveDemoPreset(demoPreset);
      setDemoDisplayName(demoName);
      setUserJobId(jobId);

      if (token) {
        // Load onboarding profile and assessment history in parallel
        const [profileRes, histRes] = await Promise.all([
          fetch(`${API_URL}/auth/onboarding`,        { headers: { Authorization: `Bearer ${token}` } }),
          fetch(ASSESSMENT_ENDPOINTS.HISTORY,         { headers: { Authorization: `Bearer ${token}` } }),
        ]);
        if (profileRes.ok) setProfile(await profileRes.json());

        // Build history: Firestore records + AsyncStorage fallback entries
        let records: AssessmentRecord[] = [];
        if (histRes.ok) {
          const j = await histRes.json();
          records = (j.data ?? []).map((r: any) => ({
            id:              r.id,
            ts:              r.ts ?? 0,
            cefr:            r.cefr ?? '?',
            overall_score:   r.overall_score ?? 0,
            domain:          r.domain,
            rf_predicted_cefr: r.rf_predicted_cefr,
          }));
        }

        // Merge AsyncStorage baselines as fallback when Firestore is empty
        // (happens before the first post-update assessment)
        if (records.length === 0) {
          if (stored) {
            const d = JSON.parse(stored);
            records.push({
              ts: Date.now(), cefr: d.predicted_cefr ?? '?',
              overall_score: d.overall_score ?? 0,
            });
          }
          if (storedOrig) {
            const d = JSON.parse(storedOrig);
            records.push({
              ts: Date.now() - 86400000, cefr: d.predicted_cefr ?? '?',
              overall_score: d.overall_score ?? 0,
            });
          }
        }

        // Deduplicate by ts (Firestore may already include the current baseline)
        const seen = new Set<number>();
        records = records.filter(r => { if (seen.has(r.ts)) return false; seen.add(r.ts); return true; });
        setAssessmentHistory(records.slice(0, 20));
      } else {
        // Offline: build history from AsyncStorage only
        const records: AssessmentRecord[] = [];
        if (stored)     { const d = JSON.parse(stored);     records.push({ ts: Date.now(),             cefr: d.predicted_cefr ?? '?', overall_score: d.overall_score ?? 0 }); }
        if (storedOrig) { const d = JSON.parse(storedOrig); records.push({ ts: Date.now() - 86400000, cefr: d.predicted_cefr ?? '?', overall_score: d.overall_score ?? 0 }); }
        setAssessmentHistory(records);
      }
    } catch (e) {
      console.error('Profile load error:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { warmupVoices(); loadData(); return () => { stopAllPlayback(); }; }, [loadData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  const handleLogout = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
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
      <View style={S.loading}>
        <ActivityIndicator size="large" color={TEAL} />
      </View>
    );
  }

  const cefrColor    = diagnosis ? CEFR_COLORS[diagnosis.predicted_cefr] ?? TEAL : TEAL;
  const selfColor    = profile?.self_assessed_cefr ? CEFR_COLORS[profile.self_assessed_cefr] ?? TEXT3 : TEXT3;
  const criticalInds = diagnosis
    ? [...diagnosis.indicators]
        .sort((a, b) => (a.normalized ?? a.score ?? 0) - (b.normalized ?? b.score ?? 0))
        .slice(0, 4)
    : [];

  return (
    <SafeAreaView style={S.root}>
      <ScrollView
        contentContainerStyle={S.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={TEAL} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Page title */}
        <View style={S.pageHeader}>
          <Text style={S.pageTitle}>Profile</Text>
        </View>

        {/* Avatar card */}
        <LinearGradient colors={[NAVY, '#0F2440']} style={S.avatarCard}>
          <View style={S.avatarCircle}>
            <Text style={S.avatarText}>{avatarLabel}</Text>
          </View>
          <Text style={S.displayName}>{displayName}</Text>
          {email ? <Text style={S.email}>{email}</Text> : null}
          {diagnosis && (
            <View style={[S.cefrBadge, { backgroundColor: cefrColor + '22', borderColor: cefrColor + '50' }]}>
              <Text style={[S.cefrBadgeText, { color: cefrColor }]}>{diagnosis.predicted_cefr}</Text>
              <Text style={S.cefrBadgeSub}>Predicted CEFR</Text>
            </View>
          )}
        </LinearGradient>

        {/* Voice Profile card */}
        <VoiceProfileCard preset={activeDemoPreset} displayName={displayName} jobId={userJobId} />

        {/* 3-stat strip */}
        {diagnosis && (
          <View style={S.statsRow}>
            <View style={[S.statCard, { borderTopColor: TEAL }]}>
              <Text style={S.statValue}>{Math.round(diagnosis.overall_score)}</Text>
              <Text style={S.statLabel}>SCORE</Text>
            </View>
            <View style={[S.statCard, { borderTopColor: cefrColor }]}>
              <Text style={[S.statValue, { color: cefrColor }]}>{diagnosis.predicted_cefr}</Text>
              <Text style={S.statLabel}>LEVEL</Text>
            </View>
            <View style={[S.statCard, { borderTopColor: CORAL }]}>
              <Text style={S.statValue}>{diagnosis.indicators.length}</Text>
              <Text style={S.statLabel}>INDICATORS</Text>
            </View>
          </View>
        )}

        {/* Learning profile */}
        {profile && (
          <View style={S.section}>
            <Text style={S.sectionTitle}>Learning Profile</Text>
            <View style={S.card}>
              {profile.target_exam && (
                <InfoRow icon="" label="TARGET EXAM" value={profile.target_exam} />
              )}
              {profile.target_domain && (
                <InfoRow icon="" label="DOMAIN" value={profile.target_domain} />
              )}
              {profile.primary_goal && (
                <InfoRow icon="" label="PRIMARY GOAL" value={profile.primary_goal} />
              )}
              {profile.daily_study_minutes != null && (
                <InfoRow icon="" label="DAILY GOAL" value={`${profile.daily_study_minutes} min / day`} />
              )}
              {!profile.target_exam && !profile.target_domain && !profile.primary_goal && !profile.daily_study_minutes && (
                <Text style={S.emptyNote}>Complete onboarding to fill this section.</Text>
              )}
            </View>
          </View>
        )}

        {/* Self vs. Predicted */}
        {diagnosis && profile?.self_assessed_cefr && (
          <View style={S.section}>
            <Text style={S.sectionTitle}>Self vs. Predicted</Text>
            <View style={S.dualCard}>
              <View style={S.dualCol}>
                <Text style={S.dualMeta}>SELF-ASSESSED</Text>
                <Text style={[S.dualLevel, { color: selfColor }]}>{profile.self_assessed_cefr}</Text>
              </View>
              <Feather name="arrow-right" size={20} color={TEXT3} />
              <View style={S.dualCol}>
                <Text style={S.dualMeta}>PREDICTED</Text>
                <Text style={[S.dualLevel, { color: cefrColor }]}>{diagnosis.predicted_cefr}</Text>
              </View>
              <View style={S.dualNote}>
                <Text style={S.dualNoteText}>
                  {diagnosis.predicted_cefr === profile.self_assessed_cefr
                    ? 'Accurate self-assessment'
                    : CEFR_COLORS[diagnosis.predicted_cefr] !== CEFR_COLORS[profile.self_assessed_cefr]
                      ? 'Gap detected — see Focus Areas'
                      : 'Close to your estimate'}
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* Level verified by AI card */}
        {diagnosis?.rf_predicted_cefr && (() => {
          const agree   = diagnosis.rf_predicted_cefr === diagnosis.predicted_cefr;
          const conf    = diagnosis.rf_confidence ?? 0;
          const rfColor = CEFR_COLORS[diagnosis.rf_predicted_cefr] ?? TEAL;
          const LEVEL_DESC: Record<string, string> = {
            'A2': 'Elementary', 'B1': 'Intermediate',
            'B2': 'Upper-Intermediate', 'C1-C2': 'Advanced',
          };
          return (
            <View style={S.section}>
              <Text style={S.sectionTitle}>Level check · Ordinal model</Text>
              <View style={S.rfCard}>
                <View style={S.rfTopRow}>
                  <View style={S.rfTextCol}>
                    <Text style={S.rfHeading}>Cross-check via Ordinal LR + SVM</Text>
                    <Text style={S.rfBodyText}>
                      Ordinal Logistic Regression + SVM ensemble, trained on CEFR-calibrated pilot measurements (Agresti 2002).
                    </Text>
                  </View>
                  <View style={[S.rfBadge, { backgroundColor: rfColor + '18', borderColor: rfColor + '55' }]}>
                    <Text style={[S.rfBadgeLevel, { color: rfColor }]}>{diagnosis.rf_predicted_cefr}</Text>
                    <Text style={[S.rfBadgeDesc, { color: rfColor }]}>
                      {LEVEL_DESC[diagnosis.rf_predicted_cefr] ?? ''}
                    </Text>
                  </View>
                </View>

                {/* Confidence bar */}
                <View style={S.rfConfRow}>
                  <Text style={S.rfConfHint}>
                    Confidence: <Text style={{ fontWeight: '700', color: TEXT }}>{Math.round(conf * 100)}%</Text>
                  </Text>
                  <View style={S.rfConfTrack}>
                    <View style={[S.rfConfFill, { width: `${Math.round(conf * 100)}%` as any, backgroundColor: rfColor }]} />
                  </View>
                </View>

                {/* Agree / differ note */}
                <View style={[S.rfNotePill, { backgroundColor: agree ? TEAL + '10' : '#8B5CF610' }]}>
                  <Feather
                    name={agree ? 'check-circle' : 'info'}
                    size={14}
                    color={agree ? TEAL : '#8B5CF6'}
                  />
                  <Text style={[S.rfNoteText, { color: agree ? TEAL : '#8B5CF6' }]}>
                    {agree
                      ? `Both analyses agree — you're at ${diagnosis.predicted_cefr}`
                      : `One analysis says ${diagnosis.predicted_cefr}, another says ${diagnosis.rf_predicted_cefr} — your level is somewhere between these`}
                  </Text>
                </View>
              </View>
            </View>
          );
        })()}

        {/* Assessment History */}
        {assessmentHistory.length > 0 && (
          <View style={S.section}>
            <Text style={S.sectionTitle}>Assessment History</Text>
            <View style={S.card}>
              {assessmentHistory.map((rec, i) => {
                const c  = CEFR_COLORS[rec.cefr] ?? TEAL;
                const dt = new Date(rec.ts).toLocaleDateString('ro-RO', {
                  day: '2-digit', month: 'short', year: 'numeric',
                });
                const isLatest = i === 0;
                return (
                  <View
                    key={rec.id ?? rec.ts}
                    style={[S.histRow, i < assessmentHistory.length - 1 && S.histBorder]}
                  >
                    {/* Timeline dot + line */}
                    <View style={S.histDotCol}>
                      <View style={[S.histDot, { backgroundColor: c }]} />
                      {i < assessmentHistory.length - 1 && <View style={S.histLine} />}
                    </View>
                    {/* Content */}
                    <View style={S.histContent}>
                      <View style={S.histTop}>
                        <View style={[S.histCefrBadge, { backgroundColor: c + '18', borderColor: c + '44' }]}>
                          <Text style={[S.histCefrText, { color: c }]}>{rec.cefr}</Text>
                        </View>
                        {isLatest && (
                          <View style={S.histLatestTag}>
                            <Text style={S.histLatestTagText}>latest</Text>
                          </View>
                        )}
                        <Text style={S.histScore}>{Math.round(rec.overall_score)}%</Text>
                      </View>
                      <Text style={S.histDate}>{dt}{rec.domain ? ` · ${rec.domain}` : ''}</Text>
                    </View>
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {/* Weakest indicators */}
        {criticalInds.length > 0 && (
          <View style={S.section}>
            <Text style={S.sectionTitle}>Weakest Indicators</Text>
            <View style={S.card}>
              {criticalInds.map((ind, i) => {
                const color = SEVERITY_COLORS[ind.severity] ?? TEAL;
                const score = Math.round(ind.normalized ?? ind.score ?? 0);
                return (
                  <View
                    key={(ind as any).indicator ?? ind.name ?? i}
                    style={[S.indRow, i < criticalInds.length - 1 && S.indBorder]}
                  >
                    <View style={[S.indDot, { backgroundColor: color }]} />
                    <Text style={S.indName} numberOfLines={1}>{ind.name}</Text>
                    <Text style={[S.indScore, { color }]}>{score}</Text>
                    <View style={[S.indTag, { backgroundColor: color + '18' }]}>
                      <Text style={[S.indTagText, { color }]}>{ind.cefr_level}</Text>
                    </View>
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {/* Focus & Strengths */}
        {diagnosis && (diagnosis.critical_areas.length > 0 || diagnosis.strengths.length > 0) && (
          <View style={S.section}>
            <Text style={S.sectionTitle}>Focus & Strengths</Text>
            <View style={S.twoCol}>
              {diagnosis.critical_areas.length > 0 && (
                <View style={[S.miniCard, S.alertMini]}>
                  <View style={S.miniHeader}>
                    <Feather name="alert-triangle" size={12} color="#EF4444" />
                    <Text style={[S.miniTitle, { color: '#EF4444' }]}>Focus</Text>
                  </View>
                  {diagnosis.critical_areas.slice(0, 3).map((a, i) => (
                    <Text key={i} style={S.miniBullet} numberOfLines={2}>· {a}</Text>
                  ))}
                </View>
              )}
              {diagnosis.strengths.length > 0 && (
                <View style={[S.miniCard, S.strengthMini]}>
                  <View style={S.miniHeader}>
                    <Feather name="check-circle" size={12} color={TEAL} />
                    <Text style={[S.miniTitle, { color: TEAL }]}>Strengths</Text>
                  </View>
                  {diagnosis.strengths.slice(0, 3).map((s, i) => (
                    <Text key={i} style={S.miniBullet} numberOfLines={2}>· {s}</Text>
                  ))}
                </View>
              )}
            </View>
          </View>
        )}

        {/* Quick links */}
        <View style={S.section}>
          <Text style={S.sectionTitle}>Quick Links</Text>
          <QuickLink icon="activity"    label="Take Assessment"  route="/(tabs)/assessment" color={TEAL}   />
          <QuickLink icon="bar-chart-2" label="View Progress"    route="/(tabs)/progress"   color={PURPLE} />
          <QuickLink icon="settings"    label="Settings"         route="/(tabs)/settings"   color={TEXT2}  />
        </View>

        {/* Sign out */}
        <TouchableOpacity style={S.logoutBtn} onPress={handleLogout} activeOpacity={0.85}>
          <Feather name="log-out" size={16} color="#EF4444" />
          <Text style={S.logoutText}>Sign Out</Text>
        </TouchableOpacity>

        <View style={{ height: 48 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// Styles

const S = StyleSheet.create({
  root:    { flex: 1, backgroundColor: BG },
  loading: { flex: 1, backgroundColor: BG, justifyContent: 'center', alignItems: 'center' },
  scroll:  { paddingHorizontal: 20, paddingBottom: 24 },

  pageHeader: { paddingTop: 24, paddingBottom: 20 },
  pageTitle:  { fontSize: 34, fontWeight: '800', color: TEXT, letterSpacing: -1 },

  // Avatar card
  avatarCard: {
    borderRadius: 24,
    alignItems: 'center',
    paddingVertical: 32,
    paddingHorizontal: 20,
    marginBottom: 14,
    gap: 8,
  },
  avatarCircle: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 4,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  avatarText:  { fontSize: 26, fontWeight: '800', color: '#FFFFFF' },
  displayName: { fontSize: 20, fontWeight: '800', color: '#FFFFFF', letterSpacing: -0.5 },
  email:       { fontSize: 13, color: 'rgba(255,255,255,0.55)', marginTop: -2 },
  cefrBadge: {
    marginTop: 8,
    paddingHorizontal: 16, paddingVertical: 6,
    borderRadius: 999, borderWidth: 1,
    alignItems: 'center',
  },
  cefrBadgeText: { fontSize: 16, fontWeight: '800', letterSpacing: 1 },
  cefrBadgeSub:  { fontSize: 10, color: 'rgba(255,255,255,0.45)', marginTop: 1, letterSpacing: 0.5 },

  // Stats strip
  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 24 },
  statCard: {
    flex: 1, backgroundColor: CARD, borderRadius: 14,
    padding: 14, borderWidth: 1, borderColor: BORDER,
    borderTopWidth: 3, alignItems: 'center', gap: 4,
  },
  statValue: { fontSize: 22, fontWeight: '800', color: TEXT, letterSpacing: -0.5 },
  statLabel: { fontSize: 9, fontWeight: '600', color: TEXT3, letterSpacing: 0.8, textAlign: 'center' },

  // Sections
  section:      { marginBottom: 24 },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: TEXT, marginBottom: 12 },
  card: {
    backgroundColor: CARD, borderRadius: 18,
    paddingHorizontal: 18, paddingVertical: 6,
    borderWidth: 1, borderColor: BORDER,
  },
  emptyNote: { fontSize: 13, color: TEXT3, textAlign: 'center', paddingVertical: 16 },

  // Self vs. Predicted
  dualCard: {
    backgroundColor: CARD, borderRadius: 18,
    padding: 20, borderWidth: 1, borderColor: BORDER,
    flexDirection: 'row', alignItems: 'center', gap: 14,
    flexWrap: 'wrap',
  },
  dualCol:   { alignItems: 'center', gap: 4 },
  dualMeta:  { fontSize: 9, fontWeight: '700', color: TEXT3, letterSpacing: 1 },
  dualLevel: { fontSize: 28, fontWeight: '900', letterSpacing: -1 },
  dualNote: {
    width: '100%', marginTop: 8,
    paddingTop: 12, borderTopWidth: 1, borderTopColor: BORDER,
  },
  dualNoteText: { fontSize: 12, color: TEXT2, fontStyle: 'italic', textAlign: 'center' },

  // Weakest indicators
  indRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 12, gap: 10,
  },
  indBorder: { borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.08)' },
  indDot:    { width: 8, height: 8, borderRadius: 4 },
  indName:   { flex: 1, fontSize: 13, color: TEXT, fontWeight: '500' },
  indScore:  { fontSize: 15, fontWeight: '800', minWidth: 28, textAlign: 'right' },
  indTag: {
    paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6,
    minWidth: 30, alignItems: 'center',
  },
  indTagText: { fontSize: 10, fontWeight: '800' },

  // Two-column focus/strength
  twoCol: { flexDirection: 'row', gap: 10 },
  miniCard: {
    flex: 1, borderRadius: 16, padding: 14,
    borderWidth: 1, gap: 4,
  },
  alertMini:    { backgroundColor: 'rgba(255,77,109,0.05)', borderColor: 'rgba(255,77,109,0.18)' },
  strengthMini: { backgroundColor: 'rgba(15,186,154,0.05)', borderColor: 'rgba(15,186,154,0.18)' },
  miniHeader:   { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 6 },
  miniTitle:    { fontSize: 12, fontWeight: '800' },
  miniBullet:   { fontSize: 11, color: TEXT2, lineHeight: 16 },

  // Level-check card (RF model, user-friendly)
  rfCard: {
    backgroundColor: CARD, borderRadius: 18,
    padding: 16, borderWidth: 1, borderColor: BORDER,
  },
  rfTopRow:     { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 14 },
  rfTextCol:    { flex: 1 },
  rfHeading:    { fontSize: 14, fontWeight: '800', color: TEXT, marginBottom: 4 },
  rfBodyText:   { fontSize: 12, color: TEXT2, lineHeight: 18 },
  rfBadge: {
    alignItems: 'center', paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 14, borderWidth: 1.5, minWidth: 72,
  },
  rfBadgeLevel: { fontSize: 20, fontWeight: '900' },
  rfBadgeDesc:  { fontSize: 9, fontWeight: '700', marginTop: 2, textAlign: 'center' },
  rfConfRow:    { gap: 6, marginBottom: 12 },
  rfConfHint:   { fontSize: 12, color: TEXT2 },
  rfConfTrack:  { height: 8, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 4, overflow: 'hidden' },
  rfConfFill:   { height: 8, borderRadius: 4 },
  rfNotePill: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    borderRadius: 10, padding: 10,
  },
  rfNoteText:   { flex: 1, fontSize: 12, fontWeight: '500', lineHeight: 18 },

  // Assessment History timeline
  histRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingVertical: 10,
  },
  histBorder: {
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  histDotCol: { alignItems: 'center', width: 14 },
  histDot: {
    width: 12, height: 12, borderRadius: 6, marginTop: 3,
  },
  histLine: {
    width: 2, flex: 1, backgroundColor: BORDER,
    marginTop: 4, minHeight: 16,
  },
  histContent: { flex: 1, gap: 3 },
  histTop: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
  },
  histCefrBadge: {
    borderRadius: 8, borderWidth: 1,
    paddingHorizontal: 8, paddingVertical: 3,
  },
  histCefrText: { fontSize: 12, fontWeight: '800' },
  histLatestTag: {
    backgroundColor: TEAL + '18', borderRadius: 6,
    paddingHorizontal: 6, paddingVertical: 2,
  },
  histLatestTagText: {
    fontSize: 9, fontWeight: '800', color: TEAL, letterSpacing: 0.5,
  },
  histScore: {
    marginLeft: 'auto' as any, fontSize: 12, fontWeight: '700', color: TEXT2,
  },
  histDate: { fontSize: 11, color: TEXT3 },

  // Sign out
  logoutBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 10, backgroundColor: CARD, borderRadius: 16,
    paddingVertical: 15, borderWidth: 1.5, borderColor: '#EF444430',
  },
  logoutText: { fontSize: 14, fontWeight: '700', color: '#EF4444' },

  // Voice Profile card
  voiceCard: {
    backgroundColor: CARD,
    borderRadius: 16,
    borderWidth: 1, borderColor: PURPLE + '30',
    padding: 14,
    marginTop: 14, marginBottom: 4,
    gap: 10,
  },
  voiceHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  voiceIconWrap: {
    width: 32, height: 32, borderRadius: 10,
    backgroundColor: PURPLE + '15',
    justifyContent: 'center', alignItems: 'center',
  },
  voiceTitle: { fontSize: 14, fontWeight: '800', color: TEXT },
  voiceSubtitle: { fontSize: 11, color: TEXT2, marginTop: 1 },
  voiceRealBadge: {
    backgroundColor: '#EF4444',
    borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3,
  },
  voiceRealBadgeText: { fontSize: 9, fontWeight: '900', color: '#fff', letterSpacing: 0.5 },

  voiceMetricsRow: {
    flexDirection: 'row', gap: 6,
  },
  voiceMetric: {
    flex: 1, alignItems: 'center', gap: 2,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 8,
    paddingVertical: 8, paddingHorizontal: 4,
    borderWidth: 1, borderColor: BORDER,
  },
  voiceMetricVal: { fontSize: 13, fontWeight: '800', color: PURPLE },
  voiceMetricLbl: { fontSize: 8, fontWeight: '700', color: TEXT3, letterSpacing: 0.8 },

  voiceJobLine: { fontSize: 11, color: TEXT2 },

  voicePlayRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
  },
  voicePlayBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 9,
    borderRadius: 10,
  },
  voicePlayBtnText: { fontSize: 12, fontWeight: '800', color: '#fff' },
  voiceWaveform: {
    flex: 1, flexDirection: 'row',
    alignItems: 'center', justifyContent: 'space-evenly',
    height: 30,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 14,
    paddingHorizontal: 8,
  },
  voiceWaveBar: {
    width: 3, height: 22, borderRadius: 2,
  },
  voiceSampleText: {
    fontSize: 11, color: TEXT2, fontStyle: 'italic',
    marginTop: 2,
  },
  voiceFallback: {
    fontSize: 10, color: TEXT3, fontStyle: 'italic',
  },
});
