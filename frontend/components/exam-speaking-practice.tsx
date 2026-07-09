/**
 * Exam-driven speaking practice for the Practice Hub.
 *
 * Shows ONLY the exam the user chose at onboarding (userTargetExam), laid out
 * in that exam's real public structure (parts → tasks). Each task runs a guided
 * flow: cue card → prep countdown → record (speak limit) → transcribe → score.
 * Scoring reuses the same pipeline as the Exam Profile screen.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  ActivityIndicator, Platform, Alert,
} from 'react-native';
import { Audio } from 'expo-av';
import { Feather } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { palette } from '@/constants/theme';
import { API_URL, PRACTICE_ENDPOINTS, VOCABULARY_ENDPOINTS } from '@/constants/api';
import { getFreshToken } from '@/utils/auth';

const { bg: BG, card: CARD, teal: TEAL, purple: PURPLE, text: TEXT, textMuted: MUTED, border: LINE } = palette;

const CEFR_COLOR: Record<string, string> = {
  A1: '#94A3B8', A2: '#64748B', B1: '#8B5CF6', B2: '#8B5CF6', C1: '#8B5CF6', C2: '#0FBA9A',
};

const FILLER_WORDS = new Set([
  'uh','um','erm','er','ah','like','you know','basically','literally',
  'actually','right','okay','so','well','just','hmm',
]);

interface Task {
  id: string; level: string; topic: string; prompt: string;
  bullets?: string[]; follow_ups?: string[]; follow_up?: string; tip?: string;
}
interface Part {
  id: string; name: string; description: string; format: string;
  prep_seconds: number; speak_seconds: number;
  image_based_in_exam?: boolean; requires_passage?: boolean; tasks: Task[];
}
interface ExamData {
  exam: string; exam_name: string; total_time?: string; note?: string;
  ai_scored?: boolean; parts: Part[]; source: string;
}
interface CritBar { label: string; val: number; color: string }
interface CamCrit { label: string; level: string; descriptor: string }
interface ScoreResult {
  examKey: string;
  cefrLevel: string;
  wps: number; pronMeasured: boolean; transcript: string; words: number;
  ielts: { overall: number; band_label: string; criteria: CritBar[] };
  cambridge?: { level: string; advice: string; criteria: CamCrit[] };
  pte?: { score: number; range: string; clb: number | null; cefr: string };
}

// Which result layout to show for each exam family.
const examFamily = (k: string): 'ielts' | 'cambridge' | 'pte' | 'cefr' =>
  k.startsWith('cambridge') ? 'cambridge'
  : k === 'pte_core' ? 'pte'
  : k.startsWith('ielts') ? 'ielts'
  : 'cefr'; // toefl_ibt, general → CEFR is the honest anchor (no native numeric score here)

type Phase = 'browse' | 'card' | 'prep' | 'recording' | 'transcribing' | 'scoring' | 'result';

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
const authHeaders = (t: string | null): Record<string, string> => (t ? { Authorization: `Bearer ${t}` } : {});

export function ExamSpeakingPractice() {
  const [exam, setExam] = useState<ExamData | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  const [active, setActive] = useState<{ part: Part; task: Task } | null>(null);
  const [phase, setPhase] = useState<Phase>('browse');
  const [countdown, setCountdown] = useState(0);
  const [statusMsg, setStatusMsg] = useState('');
  const [result, setResult] = useState<ScoreResult | null>(null);

  const recordingRef = useRef<Audio.Recording | null>(null);
  const audioUriRef = useRef<string | null>(null);
  const durationRef = useRef(0);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Load the chosen exam's tasks
  useEffect(() => {
    (async () => {
      try {
        const token = await getFreshToken();

        // Resolve the target exam: AsyncStorage first (fast), else fall back to
        // the authoritative backend profile (target chosen at onboarding) and
        // cache it for next time. This avoids defaulting to "general" on a
        // device where AsyncStorage was never populated.
        let examKey = (await AsyncStorage.getItem('userTargetExam')) || '';
        if (!examKey) {
          try {
            const pr = await fetch(`${API_URL}/auth/onboarding`, { headers: authHeaders(token) });
            if (pr.ok) {
              const prof = await pr.json();
              examKey = (prof?.target_exam as string) || '';
              if (examKey) AsyncStorage.setItem('userTargetExam', examKey);
            }
          } catch {}
        }
        if (!examKey) examKey = 'general';

        let level: string | null = null;
        try {
          const diag = await AsyncStorage.getItem('baselineDiagnosis');
          if (diag) level = JSON.parse(diag)?.cefr ?? null;
        } catch {}
        const url = `${PRACTICE_ENDPOINTS.SPEAKING_TASKS}?exam=${encodeURIComponent(examKey)}${level ? `&level=${level}` : ''}`;
        const r = await fetch(url, { headers: authHeaders(token) });
        const j = await r.json();
        if (j?.success && j.data) setExam(j.data);
        else setErr('Could not load exam tasks.');
      } catch {
        setErr('Backend unreachable.');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const clearTick = () => { if (tickRef.current) { clearInterval(tickRef.current); tickRef.current = null; } };
  useEffect(() => () => clearTick(), []);

  const reset = () => {
    clearTick();
    recordingRef.current = null;
    audioUriRef.current = null;
    durationRef.current = 0;
    setResult(null);
    setStatusMsg('');
    setCountdown(0);
  };

  const openTask = (part: Part, task: Task) => { reset(); setActive({ part, task }); setPhase('card'); };
  const backToBrowse = () => { reset(); setActive(null); setPhase('browse'); };

  // ── Recording lifecycle ─────────────────────────────────────────────────────
  const startRecording = useCallback(async () => {
    if (!active) return;
    try {
      await Audio.requestPermissionsAsync();
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      const { recording } = await Audio.Recording.createAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      recordingRef.current = recording;
      durationRef.current = 0;
      setPhase('recording');
      const limit = active.part.speak_seconds || 120;
      setCountdown(limit);
      tickRef.current = setInterval(() => {
        durationRef.current += 1;
        setCountdown(c => {
          if (c <= 1) { stopAndScore(); return 0; }
          return c - 1;
        });
      }, 1000);
    } catch {
      Alert.alert('Error', 'Could not start recording. Check microphone permissions.');
      setPhase('card');
    }
  }, [active]);

  // ── Prep countdown → auto-start recording ───────────────────────────────────
  const startPrep = () => {
    if (!active) return;
    const prep = active.part.prep_seconds || 0;
    if (prep <= 0) { startRecording(); return; }
    setPhase('prep');
    setCountdown(prep);
    tickRef.current = setInterval(() => {
      setCountdown(c => {
        if (c <= 1) { clearTick(); startRecording(); return 0; }
        return c - 1;
      });
    }, 1000);
  };

  const stopAndScore = useCallback(async () => {
    clearTick();
    const rec = recordingRef.current;
    if (!rec) return;
    setPhase('transcribing');
    setStatusMsg('Transcribing…');
    try {
      await rec.stopAndUnloadAsync();
      const uri = rec.getURI()!;
      recordingRef.current = null;
      audioUriRef.current = uri;

      const token = await getFreshToken();
      const authHdr = authHeaders(token);

      // 1) Transcribe
      const fd = new FormData();
      if (Platform.OS === 'web') {
        const blob = await (await fetch(uri)).blob();
        const ext = ((blob.type.split('/')[1] || 'webm').split(';')[0]) || 'webm';
        fd.append('file', blob, `speech.${ext}`);
      } else {
        fd.append('file', { uri, type: 'audio/m4a', name: 'speech.m4a' } as any);
      }
      const tr = await fetch(VOCABULARY_ENDPOINTS.TRANSCRIBE, { method: 'POST', headers: authHdr, body: fd });
      const tj = await tr.json();
      const transcript: string = tj?.data?.transcribed_text?.trim() || '';
      if (!transcript) { setStatusMsg('No speech detected — try again.'); setPhase('card'); return; }

      setPhase('scoring');
      setStatusMsg('Scoring…');
      await scoreTranscript(transcript, token);
    } catch {
      setStatusMsg('Could not process the recording. Check your connection.');
      setPhase('card');
    }
  }, [active]);

  const scoreTranscript = async (transcript: string, token: string | null) => {
    const authHdr: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
    const post = async (url: string, body: any) => {
      const r = await fetch(url, { method: 'POST', headers: authHdr, body: JSON.stringify(body) });
      return r.json();
    };

    const words = transcript.split(/\s+/).filter(Boolean);
    const sentences = transcript.split(/[.!?]+/).filter(s => s.trim().length > 3);
    const fillers = words.filter(w => FILLER_WORDS.has(w.toLowerCase().replace(/[^a-z]/g, '')));
    const mls = words.length / Math.max(sentences.length, 1);
    const fillerRate = (fillers.length / Math.max(words.length, 1)) * 100;
    const dur = durationRef.current;
    const wps = dur > 0 ? words.length / dur : 1.5;

    // CEFR vocabulary distribution
    let distribution: Record<string, number> = {};
    try {
      const cefr = await post(VOCABULARY_ENDPOINTS.CLASSIFY_TEXT, { text: transcript });
      distribution = cefr?.data?.distribution ?? {};
    } catch {}

    // Pronunciation via Accent ADN (only trusted when the acoustic engine ran)
    let pronScore = 0, pronMeasured = false;
    if (audioUriRef.current) {
      try {
        const afd = new FormData();
        const uri = audioUriRef.current;
        if (Platform.OS === 'web') {
          const blob = await (await fetch(uri)).blob();
          const ext = ((blob.type.split('/')[1] || 'webm').split(';')[0]) || 'webm';
          afd.append('audio', blob, `speech.${ext}`);
        } else {
          afd.append('audio', { uri, type: 'audio/m4a', name: 'speech.m4a' } as any);
        }
        afd.append('target_text', transcript);
        const ar = await fetch(`${API_URL}/accent/analyze`, {
          method: 'POST', headers: authHeaders(token), body: afd,
        });
        const aj = await ar.json();
        if (aj?.engine_tier === 'colab-wav2vec2' && typeof aj.accuracy_score === 'number') {
          pronScore = aj.accuracy_score; pronMeasured = true;
        }
      } catch {}
    }

    const ep = await post(VOCABULARY_ENDPOINTS.EXAM_PROFILE, {
      text: transcript,
      pronunciation_score: pronScore,
      pronunciation_measured: pronMeasured,
      wps: parseFloat(wps.toFixed(2)),
      filler_rate: fillerRate,
      mls: parseFloat(mls.toFixed(1)),
      cefr_distribution: distribution,
      input_mode: 'speaking',
    });
    const p = ep?.data;
    if (!p) { setStatusMsg('Scoring failed.'); setPhase('card'); return; }

    const ieltsCrit: CritBar[] = ([
      { label: 'Fluency', val: p.ielts.fluency_coherence, color: PURPLE },
      { label: 'Lexical', val: p.ielts.lexical_resource, color: PURPLE },
      { label: 'Grammar', val: p.ielts.grammatical_accuracy, color: TEAL },
      { label: 'Pronunciation', val: p.ielts.pronunciation, color: PURPLE },
    ] as { label: string; val: number | null; color: string }[])
      .filter(c => c.val != null) as CritBar[];

    const ca = p.cambridge_assessment;
    const camCrit: CamCrit[] = ca
      ? ([
          { key: 'pronunciation_fluency', label: 'Pronunciation & Fluency' },
          { key: 'language_resource', label: 'Language Resource' },
          { key: 'discourse_management', label: 'Discourse Management' },
        ] as { key: string; label: string }[])
          .map(m => ({ label: m.label, level: ca.criteria?.[m.key]?.level, descriptor: ca.criteria?.[m.key]?.descriptor }))
          .filter(c => c.level && c.level !== '—') as CamCrit[]
      : [];

    setResult({
      examKey: exam?.exam ?? 'general',
      cefrLevel: p.cambridge?.level ?? 'B1',
      wps, pronMeasured, transcript, words: words.length,
      ielts: { overall: p.ielts.overall, band_label: p.ielts.band_label, criteria: ieltsCrit },
      cambridge: ca ? { level: ca.overall_level, advice: ca.advice, criteria: camCrit } : undefined,
      pte: p.pte_core
        ? { score: p.pte_core.speaking_score, range: p.pte_core.score_range, clb: p.pte_core.clb_level ?? null, cefr: p.pte_core.cefr_equivalent }
        : undefined,
    });
    setPhase('result');
  };

  // ── Render ──────────────────────────────────────────────────────────────────
  if (loading) return <View style={s.center}><ActivityIndicator color={TEAL} /></View>;
  if (err) return <View style={s.center}><Text style={s.muted}>{err}</Text></View>;
  if (!exam) return null;

  // Task runner view
  if (active && phase !== 'browse') {
    const { part, task } = active;
    const cefrColor = result ? (CEFR_COLOR[result.cefrLevel] ?? TEAL) : TEAL;
    return (
      <ScrollView contentContainerStyle={s.runner} showsVerticalScrollIndicator={false}>
        <TouchableOpacity style={s.runnerBack} onPress={backToBrowse}>
          <Feather name="x" size={18} color={MUTED} />
          <Text style={s.runnerBackText}>Close</Text>
        </TouchableOpacity>
        <Text style={s.partTag}>{exam.exam_name} · {part.name}</Text>

        {/* Cue card */}
        <View style={s.cueCard}>
          <View style={s.cueTopRow}>
            <Text style={s.cueTopic}>{task.topic}</Text>
            <View style={[s.lvlBadge, { backgroundColor: (CEFR_COLOR[task.level] ?? TEAL) + '22' }]}>
              <Text style={[s.lvlBadgeText, { color: CEFR_COLOR[task.level] ?? TEAL }]}>{task.level}</Text>
            </View>
          </View>
          <Text style={s.cuePrompt}>{task.prompt}</Text>
          {!!task.bullets?.length && task.bullets.map((b, i) => (
            <Text key={i} style={s.cueBullet}>{b}</Text>
          ))}
          {part.image_based_in_exam && (
            <Text style={s.cueNote}>Image-based in the real exam — described in words here.</Text>
          )}
          {!!task.tip && <Text style={s.cueTip}>💡 {task.tip}</Text>}
        </View>

        {/* Phase-specific control */}
        {phase === 'card' && (
          <View style={s.runBox}>
            <Text style={s.runMeta}>
              {part.prep_seconds > 0 ? `${part.prep_seconds}s prep · ` : ''}up to {fmt(part.speak_seconds)} speaking
            </Text>
            <TouchableOpacity style={s.primaryBtn} onPress={startPrep}>
              <Feather name="play" size={16} color="#fff" />
              <Text style={s.primaryBtnText}>{part.prep_seconds > 0 ? 'Start preparation' : 'Start speaking'}</Text>
            </TouchableOpacity>
          </View>
        )}

        {phase === 'prep' && (
          <View style={s.runBox}>
            <Text style={s.bigTimer}>{fmt(countdown)}</Text>
            <Text style={s.runMeta}>Preparation — recording starts automatically</Text>
            <TouchableOpacity style={s.ghostBtn} onPress={() => { clearTick(); startRecording(); }}>
              <Text style={s.ghostBtnText}>Skip to recording</Text>
            </TouchableOpacity>
          </View>
        )}

        {phase === 'recording' && (
          <View style={s.runBox}>
            <Text style={[s.bigTimer, { color: palette.danger }]}>{fmt(countdown)}</Text>
            <Text style={s.runMeta}>Recording… speak now</Text>
            <TouchableOpacity style={[s.primaryBtn, { backgroundColor: palette.danger }]} onPress={stopAndScore}>
              <Feather name="square" size={16} color="#fff" />
              <Text style={s.primaryBtnText}>Stop & score</Text>
            </TouchableOpacity>
          </View>
        )}

        {(phase === 'transcribing' || phase === 'scoring') && (
          <View style={s.runBox}>
            <ActivityIndicator color={TEAL} />
            <Text style={s.runMeta}>{statusMsg}</Text>
          </View>
        )}

        {phase === 'result' && result && (() => {
          const f = examFamily(result.examKey);
          return (
          <View style={s.resultBox}>
            <View style={s.resultTop}>
              {f === 'ielts' && (
                <View style={s.bandCircle}>
                  <Text style={s.bandNum}>{result.ielts.overall}</Text>
                  <Text style={s.bandMax}>/9</Text>
                </View>
              )}
              {f === 'pte' && result.pte && (
                <View style={[s.bandCircle, { borderColor: PURPLE }]}>
                  <Text style={[s.bandNum, { color: PURPLE }]}>{result.pte.score}</Text>
                  <Text style={s.bandMax}>/90</Text>
                </View>
              )}
              {(f === 'cambridge' || f === 'cefr') && (
                <View style={[s.bandCircle, { borderColor: cefrColor }]}>
                  <Text style={[s.bandNum, { color: cefrColor, fontSize: 22 }]}>
                    {f === 'cambridge' ? (result.cambridge?.level ?? result.cefrLevel) : result.cefrLevel}
                  </Text>
                </View>
              )}
              <View style={{ flex: 1 }}>
                <Text style={s.bandLabel}>
                  {f === 'ielts' ? result.ielts.band_label
                    : f === 'pte' ? `PTE Core ${result.pte?.range ?? ''}`
                    : f === 'cambridge' ? 'Cambridge level'
                    : 'CEFR level'}
                </Text>
                <Text style={s.muted}>{exam.exam_name}</Text>
              </View>
              <View style={[s.lvlBadge, { backgroundColor: cefrColor + '22' }]}>
                <Text style={[s.lvlBadgeText, { color: cefrColor }]}>{result.cefrLevel}</Text>
              </View>
            </View>

            {/* IELTS / TOEFL / general → criterion bars (/9) */}
            {(f === 'ielts' || f === 'cefr') && result.ielts.criteria.map(c => (
              <View key={c.label} style={s.critRow}>
                <Text style={s.critLabel}>{c.label}</Text>
                <View style={s.critTrack}>
                  <View style={[s.critFill, { width: `${(c.val / 9) * 100}%`, backgroundColor: c.color }]} />
                </View>
                <Text style={[s.critVal, { color: c.color }]}>{c.val}</Text>
              </View>
            ))}
            {f === 'cefr' && (
              <Text style={s.metaLine}>
                Estimated against CEFR — {exam.exam_name} has no direct numeric score in this system; the bars above are sub-skill indicators.
              </Text>
            )}

            {/* Cambridge → 3-criterion rubric with levels */}
            {f === 'cambridge' && (
              <>
                {!!result.cambridge?.advice && <Text style={s.metaLine}>{result.cambridge.advice}</Text>}
                {result.cambridge?.criteria.map(c => (
                  <View key={c.label} style={s.camCrit}>
                    <View style={s.camCritHead}>
                      <Text style={s.critLabel2}>{c.label}</Text>
                      <View style={[s.lvlBadge, { backgroundColor: (CEFR_COLOR[c.level] ?? TEAL) + '22' }]}>
                        <Text style={[s.lvlBadgeText, { color: CEFR_COLOR[c.level] ?? TEAL }]}>{c.level}</Text>
                      </View>
                    </View>
                    <Text style={s.camCritDesc}>{c.descriptor}</Text>
                  </View>
                ))}
              </>
            )}

            {/* PTE → range / CLB / CEFR */}
            {f === 'pte' && result.pte && (
              <Text style={s.metaLine}>
                Score range {result.pte.range}{result.pte.clb ? ` · CLB ${result.pte.clb}` : ''} · CEFR {result.pte.cefr}
              </Text>
            )}

            <Text style={s.metaLine}>
              {result.words} words · {result.wps.toFixed(1)} words/sec
              {!result.pronMeasured ? ' · pronunciation not scored (acoustic engine offline)' : ''}
            </Text>

            <Text style={s.transcriptLabel}>Your answer</Text>
            <Text style={s.transcript}>{result.transcript}</Text>

            <View style={s.resultBtns}>
              <TouchableOpacity style={s.ghostBtn} onPress={() => { reset(); setPhase('card'); }}>
                <Text style={s.ghostBtnText}>Try again</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.primaryBtn} onPress={backToBrowse}>
                <Text style={s.primaryBtnText}>Done</Text>
              </TouchableOpacity>
            </View>
          </View>
          );
        })()}
      </ScrollView>
    );
  }

  // Browse view — big exam name + parts/tasks
  return (
    <ScrollView contentContainerStyle={s.browse} showsVerticalScrollIndicator={false}>
      <Text style={s.examName}>{exam.exam_name}</Text>
      <Text style={s.examSub}>
        {exam.parts.length} part{exam.parts.length > 1 ? 's' : ''}{exam.total_time ? ` · ${exam.total_time}` : ''}
      </Text>
      {!!exam.note && <Text style={s.examNote}>{exam.note}</Text>}

      {exam.parts.map(part => (
        <View key={part.id} style={s.partBlock}>
          <Text style={s.partName}>{part.name}</Text>
          <Text style={s.partDesc}>{part.description}</Text>
          {part.tasks.map(task => (
            <TouchableOpacity key={task.id} style={s.taskCard} onPress={() => openTask(part, task)} activeOpacity={0.8}>
              <View style={{ flex: 1 }}>
                <Text style={s.taskTopic}>{task.topic}</Text>
                <Text style={s.taskPrompt} numberOfLines={2}>{task.prompt}</Text>
              </View>
              <View style={[s.lvlBadge, { backgroundColor: (CEFR_COLOR[task.level] ?? TEAL) + '22' }]}>
                <Text style={[s.lvlBadgeText, { color: CEFR_COLOR[task.level] ?? TEAL }]}>{task.level}</Text>
              </View>
              <Feather name="chevron-right" size={18} color={MUTED} />
            </TouchableOpacity>
          ))}
        </View>
      ))}

      <Text style={s.sourceNote}>{exam.source}</Text>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  center: { paddingVertical: 40, alignItems: 'center' },
  muted: { color: MUTED, fontSize: 13 },

  browse: { paddingBottom: 24 },
  examName: { fontSize: 26, fontWeight: '900', color: TEXT, letterSpacing: -0.5 },
  examSub: { fontSize: 13, color: TEAL, fontWeight: '700', marginTop: 4 },
  examNote: { fontSize: 12, color: MUTED, marginTop: 8, lineHeight: 17, fontStyle: 'italic' },

  partBlock: { marginTop: 20 },
  partName: { fontSize: 15, fontWeight: '800', color: TEXT },
  partDesc: { fontSize: 12, color: MUTED, marginTop: 3, lineHeight: 17, marginBottom: 10 },

  taskCard: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: CARD, borderRadius: 12, borderWidth: 1, borderColor: LINE,
    padding: 14, marginBottom: 8,
  },
  taskTopic: { fontSize: 14, fontWeight: '700', color: TEXT },
  taskPrompt: { fontSize: 12, color: MUTED, marginTop: 3, lineHeight: 16 },

  lvlBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  lvlBadgeText: { fontSize: 12, fontWeight: '800' },

  sourceNote: { fontSize: 10, color: MUTED, marginTop: 22, fontStyle: 'italic', lineHeight: 14 },

  // Runner
  runner: { paddingBottom: 24 },
  runnerBack: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', paddingVertical: 6 },
  runnerBackText: { color: MUTED, fontSize: 13, fontWeight: '600' },
  partTag: { fontSize: 12, fontWeight: '800', color: TEAL, marginTop: 4, marginBottom: 10 },

  cueCard: { backgroundColor: CARD, borderRadius: 14, borderWidth: 1, borderColor: LINE, borderLeftWidth: 4, borderLeftColor: PURPLE, padding: 16 },
  cueTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  cueTopic: { fontSize: 16, fontWeight: '800', color: TEXT },
  cuePrompt: { fontSize: 15, color: TEXT, lineHeight: 22, fontWeight: '600' },
  cueBullet: { fontSize: 13, color: MUTED, lineHeight: 19, marginTop: 4, marginLeft: 4 },
  cueNote: { fontSize: 11, color: MUTED, fontStyle: 'italic', marginTop: 8 },
  cueTip: { fontSize: 12, color: TEAL, marginTop: 12, lineHeight: 17 },

  runBox: { alignItems: 'center', marginTop: 20, gap: 12 },
  runMeta: { fontSize: 12, color: MUTED, textAlign: 'center' },
  bigTimer: { fontSize: 48, fontWeight: '900', color: TEAL, letterSpacing: 1 },

  primaryBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: TEAL, borderRadius: 12, paddingVertical: 13, paddingHorizontal: 22 },
  primaryBtnText: { color: '#fff', fontSize: 14, fontWeight: '800' },
  ghostBtn: { borderRadius: 12, paddingVertical: 11, paddingHorizontal: 18, borderWidth: 1, borderColor: LINE },
  ghostBtnText: { color: MUTED, fontSize: 13, fontWeight: '700' },

  // Result
  resultBox: { marginTop: 18, gap: 10 },
  resultTop: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: CARD, borderRadius: 14, borderWidth: 1, borderColor: LINE, padding: 16 },
  bandCircle: { width: 64, height: 64, borderRadius: 32, borderWidth: 2, borderColor: TEAL, alignItems: 'center', justifyContent: 'center' },
  bandNum: { fontSize: 24, fontWeight: '900', color: TEAL, lineHeight: 26 },
  bandMax: { fontSize: 10, color: MUTED },
  bandLabel: { fontSize: 15, fontWeight: '800', color: TEXT },

  critRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  critLabel: { width: 100, fontSize: 12, color: TEXT, fontWeight: '600' },
  critTrack: { flex: 1, height: 8, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 4, overflow: 'hidden' },
  critFill: { height: '100%', borderRadius: 4 },
  critVal: { width: 28, fontSize: 13, fontWeight: '800', textAlign: 'right' },

  camCrit: { backgroundColor: CARD, borderRadius: 10, borderWidth: 1, borderColor: LINE, padding: 12 },
  camCritHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  critLabel2: { fontSize: 13, fontWeight: '700', color: TEXT },
  camCritDesc: { fontSize: 12, color: MUTED, lineHeight: 17 },

  metaLine: { fontSize: 11, color: MUTED, fontStyle: 'italic', marginTop: 4, lineHeight: 15 },
  transcriptLabel: { fontSize: 12, fontWeight: '700', color: MUTED, marginTop: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  transcript: { fontSize: 13, color: TEXT, lineHeight: 20, backgroundColor: CARD, borderRadius: 10, borderWidth: 1, borderColor: LINE, padding: 12, fontStyle: 'italic' },
  resultBtns: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 6 },
});
