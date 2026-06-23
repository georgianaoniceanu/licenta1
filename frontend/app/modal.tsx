import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { palette } from '@/constants/theme';

const TEAL   = palette.teal;
const NAVY   = palette.card;
const TEXT   = palette.text;
const TEXT2  = palette.textMuted;
const TEXT3  = palette.textMuted;
const BORDER = palette.border;
const CARD   = palette.card;
const BG     = palette.bg;

const RESEARCH = [
  { cite: 'Pallotti (2015)',          topic: 'CAF Framework — Complexity, Accuracy, Fluency' },
  { cite: 'Kolahi Ahari et al. (2025)', topic: 'Lexical diversity & syntactic complexity' },
  { cite: 'Alderson (2005)',           topic: 'Diagnostic testing cycle' },
  { cite: 'DeKeyser & Suzuki (2025)',  topic: 'Skill acquisition & SRS grading' },
  { cite: 'Cepeda et al. (2006)',      topic: 'Optimal spacing for long-term retention' },
  { cite: 'Ebbinghaus / SM-2',         topic: 'Spaced repetition algorithm' },
  { cite: 'Măchiță (2021)',            topic: 'Romanian phoneme error patterns, n=1,247' },
  { cite: 'Lee (2021)',                topic: 'Proficiency indicator calculation' },
  { cite: 'Council of Europe (2020)', topic: 'CEFR Global Scale descriptors' },
  { cite: 'Coxhead (2000)',            topic: 'Academic Word List (AWL)' },
  { cite: 'Davies — COCA',            topic: 'Corpus of Contemporary American English' },
  { cite: 'Zechner et al. (2009)',     topic: 'TOEFL iBT speaking scoring' },
];

const MODULES = [
  { icon: '', name: 'Accent DNA',      desc: 'IPA phoneme heatmap for Romanian learners' },
  { icon: '', name: 'Shadow Speaking', desc: 'Prosody matching — pitch, rhythm, stress' },
  { icon: '', name: 'Vocabulary Coach', desc: 'CEFR-calibrated word upgrade suggestions' },
  { icon: '', name: 'Practice Hub',    desc: 'Adaptive, retention, reading, listening' },
  { icon: '', name: 'Assessment',      desc: 'IELTS + Cambridge + CAF profile' },
  { icon: '', name: 'Progress',        desc: 'CEFR journey & skill indicator tracking' },
];

export default function AboutModal() {
  const router = useRouter();

  return (
    <View style={S.root}>
      <View style={S.handle} />

      <ScrollView contentContainerStyle={S.scroll} showsVerticalScrollIndicator={false}>

        {/* Header */}
        <View style={S.header}>
          <View style={S.logoRow}>
            <View style={S.logoBubble}>
              <Text style={S.logoText}></Text>
            </View>
            <View>
              <Text style={S.appName}>VocaFlow</Text>
              <Text style={S.appVersion}>v1.0.0 · Thesis Edition</Text>
            </View>
          </View>
          <Text style={S.tagline}>
            AI-powered English pronunciation studio for Romanian speakers.
          </Text>
        </View>

        {/* Modules */}
        <Text style={S.sectionLabel}>MODULES</Text>
        <View style={S.card}>
          {MODULES.map((m, i) => (
            <View key={m.name} style={[S.moduleRow, i < MODULES.length - 1 && S.rowBorder]}>
              <Text style={S.moduleIcon}>{m.icon}</Text>
              <View style={S.moduleText}>
                <Text style={S.moduleName}>{m.name}</Text>
                <Text style={S.moduleDesc}>{m.desc}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* Research */}
        <Text style={S.sectionLabel}>RESEARCH BASIS</Text>
        <View style={S.card}>
          {RESEARCH.map((r, i) => (
            <View key={r.cite} style={[S.researchRow, i < RESEARCH.length - 1 && S.rowBorder]}>
              <Text style={S.researchCite}>{r.cite}</Text>
              <Text style={S.researchTopic}>{r.topic}</Text>
            </View>
          ))}
        </View>

        {/* Stack */}
        <Text style={S.sectionLabel}>TECH STACK</Text>
        <View style={S.card}>
          {[
            ['Frontend', 'React Native + Expo Router'],
            ['Backend',  'FastAPI + Python'],
            ['Auth',     'Firebase Authentication'],
            ['DB',       'Firestore'],
            ['LLM',      'Groq (LLaMA 3)'],
            ['TTS',      'ElevenLabs'],
            ['ASR',      'Groq Whisper'],
          ].map(([k, v], i, arr) => (
            <View key={k} style={[S.stackRow, i < arr.length - 1 && S.rowBorder]}>
              <Text style={S.stackKey}>{k}</Text>
              <Text style={S.stackVal}>{v}</Text>
            </View>
          ))}
        </View>

        <TouchableOpacity style={S.closeBtn} onPress={() => router.back()}>
          <Text style={S.closeBtnText}>Close</Text>
        </TouchableOpacity>

        <View style={{ height: 32 }} />
      </ScrollView>
    </View>
  );
}

const S = StyleSheet.create({
  root:   { flex: 1, backgroundColor: BG },
  handle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: BORDER,
    alignSelf: 'center',
    marginTop: 12, marginBottom: 8,
  },
  scroll: { paddingHorizontal: 20 },

  header: { paddingVertical: 20 },
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 14 },
  logoBubble: {
    width: 52, height: 52, borderRadius: 16,
    backgroundColor: TEAL, justifyContent: 'center', alignItems: 'center',
  },
  logoText:   { fontSize: 26 },
  appName:    { fontSize: 22, fontWeight: '800', color: NAVY, letterSpacing: -0.5 },
  appVersion: { fontSize: 12, color: TEXT3, marginTop: 2 },
  tagline:    { fontSize: 14, color: TEXT2, lineHeight: 22 },

  sectionLabel: {
    fontSize: 10, fontWeight: '800', color: TEXT3,
    letterSpacing: 1.4, marginBottom: 8, marginTop: 20,
  },
  card: {
    backgroundColor: CARD, borderRadius: 16,
    borderWidth: 1, borderColor: BORDER,
    overflow: 'hidden',
  },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: BORDER },

  moduleRow:  { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12 },
  moduleIcon: { fontSize: 22, width: 28 },
  moduleText: { flex: 1 },
  moduleName: { fontSize: 14, fontWeight: '700', color: TEXT },
  moduleDesc: { fontSize: 12, color: TEXT2, marginTop: 1 },

  researchRow:   { padding: 14 },
  researchCite:  { fontSize: 12, fontWeight: '700', color: TEAL, marginBottom: 2 },
  researchTopic: { fontSize: 12, color: TEXT2 },

  stackRow: { flexDirection: 'row', justifyContent: 'space-between', padding: 14 },
  stackKey: { fontSize: 12, fontWeight: '700', color: TEXT },
  stackVal: { fontSize: 12, color: TEXT2 },

  closeBtn: {
    marginTop: 24, backgroundColor: TEAL, borderRadius: 14,
    paddingVertical: 16, alignItems: 'center',
  },
  closeBtnText: { color: '#fff', fontSize: 15, fontWeight: '800' },
});
