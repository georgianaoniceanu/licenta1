/**
 * App Showcase — dark futuristic redesign
 * Same elements as the original landing, restyled to match the dark aesthetic.
 */

import { useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, StatusBar,
  TouchableOpacity, Animated, Dimensions, Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';

const { width: W } = Dimensions.get('window');
const isTablet = W >= 760;

// ── Dark theme — two accent colors only ───────────────────────────────────────
const D = {
  bg:     '#030711',
  bg2:    '#0A1628',
  card:   'rgba(255,255,255,0.04)',
  cardHi: 'rgba(255,255,255,0.06)',
  border: 'rgba(255,255,255,0.08)',
  purple: '#8B5CF6',
  teal:   '#0FBA9A',
  text:   '#F8FAFC',
  muted:  '#94A3B8',
  dim:    '#475569',
};

const WAVE_H = [10,32,50,22,58,16,44,28,54,14,40,26,48,18,36,24,46,34,12,42,20,38,56,16,28];

// ── Components ─────────────────────────────────────────────────────────────────

function LiveWaveform({ accent = D.purple }: { accent?: string }) {
  const anims = useRef(WAVE_H.map(h => new Animated.Value(h * 0.2))).current;
  useEffect(() => {
    anims.forEach((anim, i) => {
      const maxH = WAVE_H[i];
      const dur  = 480 + (i * 73) % 520;
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(anim, { toValue: maxH,       duration: dur, useNativeDriver: false }),
          Animated.timing(anim, { toValue: maxH * 0.1, duration: dur, useNativeDriver: false }),
        ])
      );
      setTimeout(() => loop.start(), (i * 58) % 900);
    });
  }, []);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', height: 56 }}>
      {anims.map((anim, i) => (
        <Animated.View key={i} style={{
          width: 4, borderRadius: 2, height: anim,
          backgroundColor: i % 2 === 0 ? D.teal : D.purple,
          opacity: 0.85,
        }} />
      ))}
    </View>
  );
}

/** Studio condenser microphone — realistic shape with animated bars */
function MicVisualization() {
  const BODY_W  = 88;   // capsule width
  const BODY_H  = 140;  // capsule height
  const RADIUS  = 22;   // corner radius (pill-ish top, straight sides)

  const BAR_H   = [14, 24, 36, 44, 36, 24, 14];
  const barAnims = useRef(BAR_H.map(() => new Animated.Value(0.2))).current;

  useEffect(() => {
    barAnims.forEach((anim, i) => {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(anim, { toValue: 1,    duration: 280 + i * 60, useNativeDriver: true }),
          Animated.timing(anim, { toValue: 0.10, duration: 280 + i * 60, useNativeDriver: true }),
        ])
      );
      setTimeout(() => loop.start(), i * 75);
    });
  }, []);

  // Rectangular dot grid inside the capsule body
  const dots: Array<{ x: number; y: number }> = [];
  const GAP = 8;
  const PAD = 10;
  for (let row = PAD; row < BODY_H - PAD; row += GAP) {
    for (let col = PAD; col < BODY_W - PAD; col += GAP) {
      dots.push({ x: col, y: row });
    }
  }

  return (
    <View style={{ alignItems: 'center' }}>

      {/* ── Capsule body (rounded rectangle) ── */}
      <View style={{
        width: BODY_W, height: BODY_H,
        borderRadius: RADIUS,
        backgroundColor: '#060D1A',
        borderWidth: 1.5, borderColor: 'rgba(139,92,246,0.5)',
        alignItems: 'center', justifyContent: 'center',
        overflow: 'hidden',
      }}>
        {/* Mesh dot grid */}
        {dots.map((d, i) => (
          <View key={i} style={{
            position: 'absolute',
            left: d.x - 1.5, top: d.y - 1.5,
            width: 3, height: 3, borderRadius: 1.5,
            backgroundColor: 'rgba(139,92,246,0.30)',
          }} />
        ))}

        {/* Horizontal decorative lines (grille effect) */}
        {[0.28, 0.44, 0.56, 0.72].map((pct, i) => (
          <View key={`line-${i}`} style={{
            position: 'absolute',
            top: BODY_H * pct,
            left: 12, right: 12, height: 1,
            backgroundColor: 'rgba(139,92,246,0.12)',
          }} />
        ))}

        {/* Animated waveform bars — centred */}
        <View style={{
          flexDirection: 'row', alignItems: 'center',
          gap: 4, zIndex: 10,
        }}>
          {barAnims.map((anim, i) => (
            <Animated.View key={i} style={{
              width: 4,
              height: anim.interpolate({
                inputRange: [0, 1],
                outputRange: [Math.max(3, BAR_H[i] * 0.12), BAR_H[i]],
              }),
              borderRadius: 2,
              backgroundColor: i % 2 === 0 ? D.teal : D.purple,
            }} />
          ))}
        </View>
      </View>

      {/* ── Connector ring ── */}
      <View style={{
        width: BODY_W * 0.55, height: 10,
        backgroundColor: 'rgba(139,92,246,0.22)',
        borderLeftWidth: 1.5, borderRightWidth: 1.5,
        borderColor: 'rgba(139,92,246,0.40)',
        marginTop: -1,
      }} />

      {/* ── Neck ── */}
      <View style={{
        width: 6, height: 28,
        backgroundColor: 'rgba(139,92,246,0.35)',
        borderRadius: 3,
      }} />

      {/* ── Base arm ── */}
      <View style={{
        width: 52, height: 5,
        backgroundColor: 'rgba(139,92,246,0.25)',
        borderRadius: 3,
      }} />

      {/* ── Foot ── */}
      <View style={{
        width: 74, height: 6,
        backgroundColor: 'rgba(139,92,246,0.15)',
        borderRadius: 3,
        marginTop: 3,
      }} />

    </View>
  );
}

function AccentVisual() {
  const phonemes = [
    { ipa: '/θ/', ex: 'think', pct: 92, c: D.purple },
    { ipa: '/ð/', ex: 'this',  pct: 88, c: D.purple },
    { ipa: '/w/', ex: 'what',  pct: 76, c: D.teal   },
    { ipa: '/æ/', ex: 'cat',   pct: 71, c: D.teal   },
    { ipa: '/ɪ/', ex: 'kit',   pct: 68, c: D.purple },
    { ipa: '/ŋ/', ex: 'sing',  pct: 54, c: D.teal   },
  ];
  return (
    <View style={FV.pad}>
      <Text style={FV.label}>PHONEME ERROR RATE — ROMANIAN SPEAKERS</Text>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8, height: 80, marginTop: 12 }}>
        {phonemes.map(p => (
          <View key={p.ipa} style={{ flex: 1, alignItems: 'center', gap: 4, height: '100%', justifyContent: 'flex-end' }}>
            <Text style={{ fontSize: 9, fontWeight: '800', color: p.c }}>{p.pct}%</Text>
            <View style={{ width: '100%', height: (p.pct / 100) * 56, backgroundColor: p.c, borderRadius: 4, opacity: 0.85 }} />
          </View>
        ))}
      </View>
      <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
        {phonemes.map(p => (
          <View key={p.ipa} style={{ flex: 1, alignItems: 'center', gap: 2 }}>
            <Text style={{ fontSize: 11, fontWeight: '900', color: p.c, fontFamily: Platform.select({ ios: 'Menlo', default: 'monospace' }) }}>{p.ipa}</Text>
            <Text style={{ fontSize: 8, color: D.dim, textAlign: 'center' }}>{p.ex}</Text>
          </View>
        ))}
      </View>
      <Text style={FV.cite}>Măchiță (2021), n=1,247 · Romanian speakers beta cohort</Text>
    </View>
  );
}

function VocabVisual() {
  const upgrades = [
    { from: '"very good"',   to: '"exceptional"',         fromLvl: 'A2', toLvl: 'C1', c: D.purple },
    { from: '"big problem"', to: '"substantial issue"',   fromLvl: 'A1', toLvl: 'B2', c: D.teal   },
    { from: '"show"',        to: '"demonstrate"',         fromLvl: 'A1', toLvl: 'B2', c: D.teal   },
    { from: '"good idea"',   to: '"compelling proposal"', fromLvl: 'A2', toLvl: 'C1', c: D.purple },
  ];
  return (
    <View style={FV.pad}>
      <Text style={FV.label}>VOCABULARY UPGRADES · CAMBRIDGE EVP</Text>
      <View style={{ gap: 6, marginTop: 10 }}>
        {upgrades.map((u, i) => (
          <View key={i} style={{
            flexDirection: 'row', alignItems: 'center',
            backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 8,
            paddingHorizontal: 10, paddingVertical: 8, gap: 8,
            borderLeftWidth: 2, borderLeftColor: u.c,
          }}>
            <Text style={{ fontSize: 10, color: D.dim, textDecorationLine: 'line-through', flex: 1 }}>{u.from}</Text>
            <Text style={{ fontSize: 13, color: D.muted, fontWeight: '700' }}>→</Text>
            <Text style={{ fontSize: 10, fontWeight: '700', color: D.text, flex: 1.4 }}>{u.to}</Text>
            <View style={{ backgroundColor: u.c + '22', paddingHorizontal: 5, paddingVertical: 2, borderRadius: 4, borderWidth: 1, borderColor: u.c + '44' }}>
              <Text style={{ fontSize: 8, fontWeight: '900', color: u.c }}>{u.fromLvl}→{u.toLvl}</Text>
            </View>
          </View>
        ))}
      </View>
      <Text style={FV.cite}>Cambridge EVP Online · 6,345 corpus-verified entries</Text>
    </View>
  );
}

const YOU_W    = [8,22,38,50,30,48,20,42,14,36,52,26,44,18,40,28];
const NATIVE_W = [10,28,42,54,34,52,24,46,18,40,56,30,48,22,44,32];

function ShadowVisual() {
  return (
    <View style={FV.pad}>
      <Text style={FV.label}>PROSODY MATCH ANALYSIS</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12 }}>
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={{ fontSize: 8, fontWeight: '900', color: D.muted, letterSpacing: 1.2 }}>YOU</Text>
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 2, height: 38 }}>
            {YOU_W.map((h, i) => <View key={i} style={{ flex: 1, height: h * 0.65, backgroundColor: D.purple, borderRadius: 2, opacity: 0.6 }} />)}
          </View>
        </View>
        <View style={{ width: 66, height: 66, borderRadius: 33, borderWidth: 1, borderColor: D.teal + '66', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(15,186,154,0.07)' }}>
          <Text style={{ fontSize: 18, fontWeight: '900', color: D.teal }}>87%</Text>
          <Text style={{ fontSize: 7, fontWeight: '700', color: D.muted }}>MATCH</Text>
        </View>
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={{ fontSize: 8, fontWeight: '900', color: D.muted, letterSpacing: 1.2, textAlign: 'right' }}>NATIVE</Text>
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 2, height: 38 }}>
            {NATIVE_W.map((h, i) => <View key={i} style={{ flex: 1, height: h * 0.65, backgroundColor: D.teal, borderRadius: 2, opacity: 0.6 }} />)}
          </View>
        </View>
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginTop: 10 }}>
        {[
          { lbl: 'Rhythm',     pct: 91, c: D.teal   },
          { lbl: 'Stress',     pct: 84, c: D.purple  },
          { lbl: 'Intonation', pct: 79, c: D.teal    },
          { lbl: 'Fluency',    pct: 88, c: D.purple  },
        ].map(d => (
          <View key={d.lbl} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: D.card, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4, borderWidth: 1, borderColor: D.border }}>
            <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: d.c }} />
            <Text style={{ fontSize: 10, fontWeight: '600', color: D.muted }}>{d.lbl}</Text>
            <Text style={{ fontSize: 10, fontWeight: '800', color: d.c }}>{d.pct}%</Text>
          </View>
        ))}
      </View>
      <Text style={FV.cite}>Pitch, duration and stress envelope comparison</Text>
    </View>
  );
}

function ProgressVisual() {
  const levels = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
  const cur = 2;
  const skills = [
    { lbl: 'Phoneme accuracy', pct: 62, c: D.purple },
    { lbl: 'Vocabulary range', pct: 78, c: D.teal   },
    { lbl: 'Fluency score',    pct: 55, c: D.purple },
    { lbl: 'Pronunciation',    pct: 70, c: D.teal   },
  ];
  return (
    <View style={FV.pad}>
      <Text style={FV.label}>CEFR PROGRESSION JOURNEY</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 12, marginBottom: 8 }}>
        {levels.flatMap((l, i) => {
          const done = i < cur, current = i === cur, target = i === 4;
          const node = (
            <View key={l} style={{ alignItems: 'center', gap: 3 }}>
              <View style={[
                { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5 },
                done    ? { backgroundColor: D.teal,   borderColor: D.teal   } :
                current ? { backgroundColor: 'rgba(139,92,246,0.12)', borderColor: D.purple } :
                target  ? { backgroundColor: 'rgba(15,186,154,0.10)',  borderColor: D.teal   } :
                { backgroundColor: D.card, borderColor: D.border },
              ]}>
                <Text style={{ fontSize: 8, fontWeight: '900', color: done ? '#fff' : current ? D.purple : target ? D.teal : D.dim }}>
                  {done ? '✓' : l}
                </Text>
              </View>
              <Text style={{ fontSize: 6, fontWeight: '800', letterSpacing: 0.4, color: current ? D.purple : target ? D.teal : D.bg }}>
                {current ? 'NOW' : 'GOAL'}
              </Text>
            </View>
          );
          if (i < levels.length - 1) {
            return [node, <View key={`c${i}`} style={{ flex: 1, height: 1.5, marginBottom: 14, backgroundColor: done ? D.teal : D.border }} />];
          }
          return [node];
        })}
      </View>
      <View style={{ gap: 7 }}>
        {skills.map(s => (
          <View key={s.lbl} style={{ gap: 3 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ fontSize: 10, fontWeight: '600', color: D.muted }}>{s.lbl}</Text>
              <Text style={{ fontSize: 10, fontWeight: '800', color: s.c }}>{s.pct}%</Text>
            </View>
            <View style={{ height: 4, backgroundColor: D.border, borderRadius: 2, overflow: 'hidden' }}>
              <View style={{ width: `${s.pct}%` as any, height: '100%', backgroundColor: s.c, borderRadius: 2 }} />
            </View>
          </View>
        ))}
      </View>
      <Text style={FV.cite}>CEFR milestones · DeKeyser (2025) skill acquisition framework</Text>
    </View>
  );
}

const FEATURES = [
  { abbr: 'IPA', tag: 'APPENDIX A', title: 'Accent DNA Profiling',   tagColor: D.teal,   desc: 'Among 1,247 Romanian speakers assessed during beta, six phonemes consistently produced the lowest accuracy scores. Each can be mastered — but only if it is named.', badge: 'Phonetics · IPA', Visual: AccentVisual },
  { abbr: 'EVP', tag: 'APPENDIX B', title: 'Smart Vocabulary Coach', tagColor: D.purple, desc: 'Every word is classified A1–C2 against the Cambridge EVP corpus — 6,345 corpus-verified entries. Instant level-upgrade suggestions for your exact profile.', badge: 'CEFR · Cambridge EVP', Visual: VocabVisual },
  { abbr: 'SHD', tag: 'APPENDIX C', title: 'Shadow Speaking',        tagColor: D.teal,   desc: 'Record yourself shadowing native audio. The engine scores pitch envelope, stress pattern and rhythm against the target — each dimension independently.', badge: 'Prosody · Rhythm · Stress', Visual: ShadowVisual },
  { abbr: 'CEF', tag: 'APPENDIX D', title: 'CEFR Progress Tracking', tagColor: D.purple, desc: 'Every session updates your phoneme accuracy, vocabulary range and fluency — mapped to CEFR milestones with research citations behind every metric.', badge: 'CEFR · DeKeyser 2025', Visual: ProgressVisual },
];

// ── Main screen ────────────────────────────────────────────────────────────────
export default function HomeShowcaseScreen() {
  const router = useRouter();

  const heroA    = useRef(new Animated.Value(0)).current;
  const heroY    = useRef(new Animated.Value(32)).current;
  const previewA = useRef(new Animated.Value(0)).current;
  const previewY = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    Animated.stagger(120, [
      Animated.parallel([
        Animated.timing(heroA, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(heroY, { toValue: 0, duration: 700, useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.timing(previewA, { toValue: 1, duration: 600, useNativeDriver: true }),
        Animated.timing(previewY, { toValue: 0, duration: 600, useNativeDriver: true }),
      ]),
    ]).start();
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: D.bg }}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      {/* Background gradient */}
      <LinearGradient
        colors={['#030711', '#0A1628', '#060D1A']}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFillObject}
      />

      {/* ── Beta ticker ─────────────────────────────────────────────────────── */}
      <View style={S.ticker}>
        <View style={S.tickerDot} />
        <Text style={S.tickerText}>
          BETA · ACCES GRATUIT PENTRU VORBITORI B1 – C1 · PHONEME ACCURACY ENGINE · CAMBRIDGE-ALIGNED · BETA · ACCES GRATUIT PENTRU VORBITORI B1 – C1
        </Text>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={S.scroll}
      >
        {/* ── Nav ─────────────────────────────────────────────────────────── */}
        <View style={S.nav}>
          <View style={S.brandRow}>
            <LinearGradient colors={[D.purple, D.teal]} style={S.logoBox}>
              <Text style={{ fontSize: 13, fontWeight: '900', color: '#fff', letterSpacing: -0.5 }}>VF</Text>
            </LinearGradient>
            <Text style={S.brand}>Voca<Text style={{ color: D.purple }}>Flow</Text></Text>
          </View>
          <TouchableOpacity style={S.dashBtn} onPress={() => router.replace('/(tabs)')} activeOpacity={0.85}>
            <Text style={S.dashBtnText}>Dashboard →</Text>
          </TouchableOpacity>
        </View>

        {/* ── Hero ────────────────────────────────────────────────────────── */}
        <Animated.View style={[S.hero, { opacity: heroA, transform: [{ translateY: heroY }] }]}>
          <View style={S.eyebrow}>
            <View style={S.eyebrowDot} />
            <Text style={S.eyebrowText}>Pronunciation Studio · Romanian Learners</Text>
          </View>

          <Text style={S.headline}>
            {'Precise English\npronunciation.\nVocabulary that '}
            <Text style={{ color: D.purple }}>sounds natural.</Text>
          </Text>

          <Text style={S.description}>
            A disciplined tool for advanced speakers. Phonetic diagnosis, targeted training, objective feedback. No games, no grades.
          </Text>

          {/* Editorial note */}
          <View style={S.editorialCard}>
            <View style={[S.editorialAccent, { backgroundColor: D.purple }]} />
            <View style={S.editorialBody}>
              <Text style={[S.editorialLabel, { color: D.teal }]}>EDITORIAL NOTE</Text>
              <Text style={S.editorialText}>
                No grammar correction. No quizzes. Only vocabulary, rhythm, and the muscles of your mouth.
              </Text>
            </View>
          </View>
        </Animated.View>

        {/* ── App preview ─────────────────────────────────────────────────── */}
        <Animated.View style={[{ opacity: previewA, transform: [{ translateY: previewY }] }]}>

          {/* FIG. 01 — main preview card */}
          <View style={S.previewCard}>
            <View style={S.previewCardHeader}>
              <Text style={S.previewFig}>■ FIG. 01 — ECHO</Text>
              <View style={S.liveBadge}>
                <View style={S.liveDot} />
                <Text style={S.liveText}>LIVE</Text>
              </View>
            </View>

            {/* Mic visualization — centered, arcs clipped to card width */}
            <View style={{ alignItems: 'center', marginTop: 14, marginBottom: 6, overflow: 'hidden' }}>
              <MicVisualization />
            </View>

            {/* Stats row */}
            <View style={{ flexDirection: 'row', gap: 10, marginBottom: 4 }}>
              <View style={[S.miniCard, { flex: 1 }]}>
                <Text style={S.miniCardSup}>/ 71</Text>
                <Text style={S.miniCardNum}>12</Text>
                <Text style={S.miniCardLabel}>MINUTE · SESIUNE ZILNICĂ</Text>
              </View>
              <View style={[S.miniCard, { flex: 1 }]}>
                <View style={S.miniCardIcon} />
                <Text style={S.miniCardNum}>6</Text>
                <Text style={S.miniCardLabel}>FONEME ȚINTITE</Text>
              </View>
            </View>

            {/* ── Spectrogram ── */}
            <View style={S.spectroCard}>
              <View style={S.spectroHeader}>
                <Text style={S.spectroTitle}>≡ SPECTROGRAM LIVE · /θ/ — "THINK"</Text>
                <View style={[S.liveBadge]}>
                  <View style={[S.liveDot, { backgroundColor: D.purple }]} />
                  <Text style={[S.liveText, { color: D.purple }]}>REC</Text>
                </View>
              </View>
              <LiveWaveform accent={D.purple} />
              <View style={S.spectroFooter}>
                <Text style={S.spectroFooterText}>00:03</Text>
                <Text style={[S.spectroFooterText, { color: D.muted }]}>FRICATIVĂ DENTALĂ SURDĂ</Text>
                <Text style={S.spectroFooterText}>00:23</Text>
              </View>
            </View>
          </View>

          {/* ── Stats strip ── */}
          <View style={S.statsRow}>
            {[
              { value: '1,247', label: 'ROMANIAN\nSPEAKERS', color: D.teal   },
              { value: '42',    label: 'PHONEMES\nMAPPED',   color: D.purple },
              { value: 'B1→C1', label: 'TARGET\nBAND',       color: D.teal   },
            ].map((s, i) => (
              <View key={i} style={[S.statCard, { borderTopColor: s.color }]}>
                <Text style={[S.statValue, { color: s.color }]}>{s.value}</Text>
                <Text style={S.statLabel}>{s.label}</Text>
              </View>
            ))}
          </View>

          {/* ── Preview window (Accent DNA + Vocab Coach mini cards) ── */}
          <View style={S.previewCard}>
            <View style={S.previewCardHeader}>
              <Text style={S.previewFig}>■ FIG. 02 — AI FEEDBACK</Text>
              <View style={[S.liveBadge, { backgroundColor: 'rgba(15,186,154,0.12)', borderColor: D.teal + '44' }]}>
                <View style={[S.liveDot, { backgroundColor: D.teal }]} />
                <Text style={[S.liveText, { color: D.teal }]}>AI FEEDBACK</Text>
              </View>
            </View>
            {/* Streak */}
            <View style={S.streak}>
              <Text style={S.streakText}>12-day streak</Text>
            </View>
            {/* Two mini feature cards */}
            <View style={[S.miniFeatureCard, { borderLeftColor: D.teal }]}>
              <View style={S.miniFeatureRow}>
                <View style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: D.teal + '22', borderWidth: 1, borderColor: D.teal + '55', alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ fontSize: 10, fontWeight: '900', color: D.teal, letterSpacing: 0.5 }}>IPA</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={S.miniFeatureTitle}>Accent DNA</Text>
                  <Text style={S.miniFeatureSub}>Your phonetic profile</Text>
                </View>
                <View style={S.deltaBadge}><Text style={S.deltaText}>+12%</Text></View>
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 6, marginTop: 10 }}>
                {[
                  { ipa: '/θ/', score: 78, color: D.purple },
                  { ipa: '/ð/', score: 72, color: D.purple },
                  { ipa: '/æ/', score: 88, color: D.teal   },
                  { ipa: '/w/', score: 45, color: D.purple },
                  { ipa: '/ɹ/', score: 52, color: D.teal   },
                ].map((p, i) => (
                  <View key={i} style={{ flex: 1, alignItems: 'center', gap: 4 }}>
                    <View style={{ width: '100%', height: 48, borderRadius: 6, backgroundColor: D.border, overflow: 'hidden', justifyContent: 'flex-end' }}>
                      <View style={{ width: '100%', height: `${p.score}%` as any, backgroundColor: p.color, opacity: 0.85, borderRadius: 6 }} />
                    </View>
                    <Text style={{ fontSize: 9, fontWeight: '700', color: D.muted, fontFamily: Platform.select({ ios: 'Menlo', default: 'monospace' }) }}>{p.ipa}</Text>
                  </View>
                ))}
              </View>
            </View>
            <View style={[S.miniFeatureCard, { borderLeftColor: D.purple }]}>
              <View style={S.miniFeatureRow}>
                <View style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: D.purple + '22', borderWidth: 1, borderColor: D.purple + '55', alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ fontSize: 10, fontWeight: '900', color: D.purple, letterSpacing: 0.5 }}>EVP</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={S.miniFeatureTitle}>Vocabulary Coach</Text>
                  <Text style={S.miniFeatureSub}>Smart suggestions</Text>
                </View>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                <Text style={{ fontSize: 12, color: D.dim, textDecorationLine: 'line-through', fontWeight: '600' }}>"very good"</Text>
                <Text style={{ fontSize: 13, color: D.dim, fontWeight: '700' }}>→</Text>
                <Text style={{ fontSize: 12, color: D.teal, fontWeight: '700' }}>"excellent"</Text>
                <Text style={{ fontSize: 12, color: D.muted, fontWeight: '600' }}>, "outstanding"</Text>
              </View>
            </View>
          </View>
        </Animated.View>

        {/* ── Features section ─────────────────────────────────────────────── */}
        <View style={FS.intro}>
          <Text style={FS.introEye}>WHAT MAKES VOCAFLOW DIFFERENT</Text>
          <Text style={FS.introTitle}>Built around the science{'\n'}of pronunciation.</Text>
          <Text style={FS.introSub}>Four interlocking modules that target exactly what Romanian speakers struggle with in English.</Text>
        </View>

        {FEATURES.map((feat) => {
          const Visual = feat.Visual;
          return (
            <View key={feat.title} style={FS.card}>
              {/* Header visual */}
              <View style={[FS.cardHeader, { borderBottomColor: feat.tagColor + '25' }]}>
                <View style={[FS.cornerTag, { backgroundColor: feat.tagColor }]}>
                  <Text style={FS.cornerTagText}>{feat.tag}</Text>
                </View>
                <Visual />
              </View>
              {/* Body */}
              <View style={FS.cardBody}>
                <View style={FS.titleRow}>
                  <View style={[FS.iconBox, { backgroundColor: feat.tagColor + '1A', borderWidth: 1, borderColor: feat.tagColor + '33' }]}>
                    <Text style={{ fontSize: 11, fontWeight: '900', color: feat.tagColor, letterSpacing: 0.5 }}>{feat.abbr}</Text>
                  </View>
                  <Text style={FS.cardTitle}>{feat.title}</Text>
                </View>
                <Text style={FS.cardDesc}>{feat.desc}</Text>
                <View style={[FS.badge, { backgroundColor: feat.tagColor + '18' }]}>
                  <Text style={[FS.badgeText, { color: feat.tagColor }]}>{feat.badge}</Text>
                </View>
              </View>
            </View>
          );
        })}

        {/* ── Footer ───────────────────────────────────────────────────────── */}
        <View style={S.footer}>
          <Text style={S.footerText}>Built on academic research · IELTS · Cambridge · COCA · CEFR</Text>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────
const S = StyleSheet.create({
  scroll: {
    paddingBottom: 72,
    paddingHorizontal: isTablet ? 56 : 18,
    maxWidth: 900,
    alignSelf: 'center',
    width: '100%',
  },

  // Ticker
  ticker: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(139,92,246,0.10)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(139,92,246,0.18)',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  tickerDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: D.purple, flexShrink: 0 },
  tickerText: { fontSize: 10, fontWeight: '700', color: D.muted, letterSpacing: 1.2, flex: 1 },

  // Nav
  nav: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: Platform.OS === 'ios' ? 12 : 10, paddingBottom: 16,
  },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  logoBox:  { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  brand:    { fontSize: 20, fontWeight: '800', color: D.text, letterSpacing: -0.5 },
  dashBtn:  {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8,
    backgroundColor: 'rgba(139,92,246,0.18)',
    borderWidth: 1, borderColor: 'rgba(139,92,246,0.35)',
  },
  dashBtnText: { fontSize: 12, fontWeight: '700', color: D.purple },

  // Hero
  hero:        { marginTop: 12, marginBottom: 28 },
  eyebrow:     { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 18 },
  eyebrowDot:  { width: 6, height: 6, borderRadius: 3, backgroundColor: D.purple },
  eyebrowText: { fontSize: 11, fontWeight: '700', color: D.purple, letterSpacing: 0.5 },
  headline: {
    fontSize: isTablet ? 58 : 42, fontWeight: '900', color: D.text,
    lineHeight: isTablet ? 70 : 52, letterSpacing: -1.5, marginBottom: 20,
  },
  description: { fontSize: 15, color: D.muted, lineHeight: 25, maxWidth: 440, marginBottom: 24 },

  editorialCard: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 8, overflow: 'hidden', marginBottom: 4,
    borderWidth: 1, borderColor: D.border,
  },
  editorialAccent: { width: 3 },
  editorialBody:   { flex: 1, paddingHorizontal: 14, paddingVertical: 14 },
  editorialLabel:  { fontSize: 9, fontWeight: '800', letterSpacing: 1.8, marginBottom: 6 },
  editorialText:   { fontSize: 13, color: D.muted, lineHeight: 20 },

  // Preview cards
  previewCard: {
    backgroundColor: D.card,
    borderRadius: 16,
    borderWidth: 1, borderColor: D.border,
    padding: 16,
    marginBottom: 12,
  },
  previewCardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  previewFig:   { fontSize: 10, fontWeight: '800', color: D.muted, letterSpacing: 1.2 },
  liveBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1, borderColor: D.border,
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999,
  },
  liveDot:  { width: 6, height: 6, borderRadius: 3, backgroundColor: D.teal },
  liveText: { fontSize: 10, fontWeight: '800', color: D.teal, letterSpacing: 0.8 },

  // Mini stat cards (inside FIG.01)
  miniCard: {
    backgroundColor: D.cardHi,
    borderRadius: 10, padding: 12,
    borderWidth: 1, borderColor: D.border,
  },
  miniCardSup:   { fontSize: 9, color: D.dim, fontWeight: '700', textAlign: 'right' },
  miniCardNum:   { fontSize: 34, fontWeight: '900', color: D.text, lineHeight: 40 },
  miniCardLabel: { fontSize: 8, color: D.muted, fontWeight: '700', letterSpacing: 0.8, marginTop: 2 },
  miniCardIcon:  { width: 16, height: 16, borderRadius: 8, backgroundColor: D.teal, alignSelf: 'flex-end', marginBottom: 2 },

  // Spectrogram
  spectroCard: {
    marginTop: 14, backgroundColor: D.cardHi,
    borderRadius: 10, padding: 12,
    borderWidth: 1, borderColor: D.border,
  },
  spectroHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  spectroTitle:  { fontSize: 9, fontWeight: '800', color: D.muted, letterSpacing: 0.8, flex: 1 },
  spectroFooter: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  spectroFooterText: { fontSize: 9, fontWeight: '700', color: D.dim },

  // Streak
  streak: {
    alignSelf: 'flex-start', backgroundColor: D.card,
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6,
    borderWidth: 1, borderColor: D.border,
    marginTop: 12, marginBottom: 4,
  },
  streakText: { color: D.muted, fontSize: 12, fontWeight: '700' },

  // Mini feature cards (inside FIG.02)
  miniFeatureCard: {
    backgroundColor: D.card, borderRadius: 10, padding: 12,
    borderWidth: 1, borderColor: D.border,
    borderLeftWidth: 2, marginTop: 8,
  },
  miniFeatureRow:  { flexDirection: 'row', alignItems: 'center', gap: 10 },
  miniFeatureTitle:{ fontSize: 13, fontWeight: '800', color: D.text, flex: 1 },
  miniFeatureSub:  { fontSize: 10, color: D.muted, marginTop: 1 },
  deltaBadge: { backgroundColor: 'rgba(15,186,154,0.12)', paddingHorizontal: 7, paddingVertical: 3, borderRadius: 4, borderWidth: 1, borderColor: 'rgba(15,186,154,0.25)' },
  deltaText:  { fontSize: 10, fontWeight: '800', color: D.teal },

  // Stats
  statsRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  statCard: {
    flex: 1, backgroundColor: D.card,
    borderRadius: 12, borderTopWidth: 2, borderWidth: 1, borderColor: D.border,
    paddingHorizontal: isTablet ? 16 : 10, paddingVertical: 14,
  },
  statValue: { fontSize: isTablet ? 28 : 22, fontWeight: '900', letterSpacing: -0.8, marginBottom: 4 },
  statLabel: { fontSize: 8, fontWeight: '700', color: D.muted, letterSpacing: 0.7, lineHeight: 12 },

  // Footer
  footer:     { paddingTop: 20, alignItems: 'center' },
  footerText: { fontSize: 11, color: D.dim, textAlign: 'center', lineHeight: 17 },
});

const FV = StyleSheet.create({
  pad:   { padding: 14, paddingTop: 38 },
  label: { fontSize: 9, fontWeight: '800', color: D.dim, letterSpacing: 1.4 },
  cite:  { fontSize: 9, color: D.dim, fontStyle: 'italic', marginTop: 10, lineHeight: 13 },
});

const FS = StyleSheet.create({
  intro:    { marginTop: 8, marginBottom: 24 },
  introEye: { fontSize: 10, fontWeight: '800', letterSpacing: 1.8, color: D.purple, marginBottom: 10 },
  introTitle: {
    fontSize: isTablet ? 38 : 28, fontWeight: '900', color: D.text,
    lineHeight: isTablet ? 48 : 36, letterSpacing: -1, marginBottom: 12,
  },
  introSub: { fontSize: 14, color: D.muted, lineHeight: 22, maxWidth: 400 },

  card: {
    backgroundColor: D.card, borderRadius: 18, overflow: 'hidden', marginBottom: 16,
    borderWidth: 1, borderColor: D.border,
  },
  cardHeader: { backgroundColor: 'rgba(255,255,255,0.02)', borderBottomWidth: 1, overflow: 'hidden' },
  cornerTag: {
    position: 'absolute', top: 0, right: 0,
    paddingHorizontal: 10, paddingVertical: 4,
    borderBottomLeftRadius: 8, zIndex: 10,
  },
  cornerTagText: { fontSize: 8, fontWeight: '900', color: '#fff', letterSpacing: 1.2 },
  cardBody:  { padding: 18, gap: 10 },
  titleRow:  { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconBox:   { width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  cardTitle: { fontSize: 17, fontWeight: '900', color: D.text, flex: 1, letterSpacing: -0.4 },
  cardDesc:  { fontSize: 13, color: D.muted, lineHeight: 21 },
  badge:     { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  badgeText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.3 },
});
