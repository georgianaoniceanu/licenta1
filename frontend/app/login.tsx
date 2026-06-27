/**
 * Landing + Auth — VocaFlow
 * Premium editorial design: floating geometry, live waveform, glassmorphism, staggered entries.
 */

import { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, StatusBar,
  KeyboardAvoidingView, Platform, TouchableOpacity,
  Animated, TextInput, ActivityIndicator, Dimensions, Image,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '@/config/firebase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { API_URL } from '../constants/api';

const { width: W } = Dimensions.get('window');
const isTablet = W >= 760;

const C = {
  text:    '#F0F6FF',
  muted:   '#8BA0B8',
  lite:    '#64748B',
  card:    '#0F1B2D',
  border:  'rgba(255,255,255,0.10)',
  teal:    '#0FBA9A',
  tealD:   '#0AA088',
  coral:   '#E8713A',
  amber:   '#F59E0B',
  amberBg: 'rgba(245,158,11,0.15)',
  purple:  '#8B5CF6',
  red:     '#EF4444',
  green:   '#10B981',
  greenL:  'rgba(16,185,129,0.18)',
  navy:    '#7C3AED',   // repurposed as the primary CTA colour on the dark theme
};

// Deterministic waveform heights
const WAVE_H = [10,32,50,22,58,16,44,28,54,14,40,26,48,18,36,24,46,34,12,42,20,38,56,16,28];

// Sub-components

/** Animated waveform — each bar pulses independently */
function LiveWaveform() {
  const anims = useRef(WAVE_H.map(h => new Animated.Value(h * 0.25))).current;

  useEffect(() => {
    anims.forEach((anim, i) => {
      const maxH = WAVE_H[i];
      const dur  = 480 + (i * 73) % 520;
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(anim, { toValue: maxH,         duration: dur, useNativeDriver: false }),
          Animated.timing(anim, { toValue: maxH * 0.12,  duration: dur, useNativeDriver: false }),
        ])
      );
      setTimeout(() => loop.start(), (i * 58) % 900);
    });
  }, []);

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', height: 62 }}>
      {anims.map((anim, i) => (
        <Animated.View
          key={i}
          style={{ width: 5, borderRadius: 3, height: anim, backgroundColor: i % 2 === 0 ? C.coral : C.teal }}
        />
      ))}
    </View>
  );
}

/** Slowly floating geometric blob */
function FloatBlob({ size, color, style, delay = 0 }: { size: number; color: string; style: any; delay?: number }) {
  const y = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    setTimeout(() => {
      Animated.loop(
        Animated.sequence([
          Animated.timing(y, { toValue: -20, duration: 4200, useNativeDriver: true }),
          Animated.timing(y, { toValue: 0,   duration: 4200, useNativeDriver: true }),
        ])
      ).start();
    }, delay);
  }, []);
  return (
    <Animated.View style={[{ position: 'absolute', width: size, height: size, borderRadius: size / 2, backgroundColor: color, transform: [{ translateY: y }] }, style]} />
  );
}

/** Static dot grid */
function DotsGrid({ rows, cols, gap, color, style }: { rows: number; cols: number; gap: number; color: string; style: any }) {
  return (
    <View style={[{ position: 'absolute', flexDirection: 'row', flexWrap: 'wrap', width: cols * (gap + 4) }, style]}>
      {Array.from({ length: rows * cols }).map((_, i) => (
        <View key={i} style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: color, margin: gap / 2 }} />
      ))}
    </View>
  );
}

/** Small accent cross */
function AccentCross({ color, style }: { color: string; style: any }) {
  return (
    <View style={[{ position: 'absolute' }, style]}>
      <View style={{ width: 18, height: 2.5, backgroundColor: color, borderRadius: 1.5 }} />
      <View style={{ width: 2.5, height: 18, backgroundColor: color, borderRadius: 1.5, position: 'absolute', top: -7.5, left: 7.75 }} />
    </View>
  );
}

// Feature visuals (diverse styles)

// Accent DNA — vertical phoneme bar chart
function AccentVisual() {
  const phonemes = [
    { ipa: '/θ/', ex: 'think', pct: 92, c: '#FF5733' },
    { ipa: '/ð/', ex: 'this',  pct: 88, c: '#E91E8C' },
    { ipa: '/w/', ex: 'what',  pct: 76, c: '#7C3AED' },
    { ipa: '/æ/', ex: 'cat',   pct: 71, c: '#F59E0B' },
    { ipa: '/ɪ/', ex: 'kit',   pct: 68, c: '#10B981' },
    { ipa: '/ŋ/', ex: 'sing',  pct: 54, c: '#06B6D4' },
  ];
  return (
    <View style={FV.visualPad}>
      <Text style={FV.vizLabel}>PHONEME ERROR RATE — ROMANIAN SPEAKERS</Text>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8, height: 88, marginTop: 12 }}>
        {phonemes.map(p => (
          <View key={p.ipa} style={{ flex: 1, alignItems: 'center', gap: 4, height: '100%', justifyContent: 'flex-end' }}>
            <Text style={{ fontSize: 9, fontWeight: '800', color: p.c }}>{p.pct}%</Text>
            <View style={{ width: '100%', height: (p.pct / 100) * 62, backgroundColor: p.c, borderRadius: 6, opacity: 0.82 }} />
          </View>
        ))}
      </View>
      <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
        {phonemes.map(p => (
          <View key={p.ipa} style={{ flex: 1, alignItems: 'center', gap: 2 }}>
            <Text style={{ fontSize: 11, fontWeight: '900', color: p.c, fontFamily: Platform.select({ ios: 'Menlo', default: 'monospace' }) }}>{p.ipa}</Text>
            <Text style={{ fontSize: 8, color: '#94A3B8', textAlign: 'center' }}>{p.ex}</Text>
          </View>
        ))}
      </View>
      <Text style={FV.vizCite}>Error rate among learners · Măchiță (2021), n=1,247</Text>
    </View>
  );
}

// Vocabulary Coach — word upgrade cards with left border
function VocabVisual() {
  const upgrades = [
    { from: '"very good"',   to: '"exceptional"',         fromLvl: 'A2', toLvl: 'C1', c: '#7C3AED' },
    { from: '"big problem"', to: '"substantial issue"',   fromLvl: 'A1', toLvl: 'B2', c: '#3B82F6' },
    { from: '"show"',        to: '"demonstrate"',         fromLvl: 'A1', toLvl: 'B2', c: '#3B82F6' },
    { from: '"good idea"',   to: '"compelling proposal"', fromLvl: 'A2', toLvl: 'C1', c: '#7C3AED' },
  ];
  return (
    <View style={FV.visualPad}>
      <Text style={FV.vizLabel}>VOCABULARY UPGRADES · CAMBRIDGE EVP</Text>
      <View style={{ gap: 7, marginTop: 10 }}>
        {upgrades.map((u, i) => (
          <View key={i} style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9, gap: 8, borderLeftWidth: 3, borderLeftColor: u.c }}>
            <Text style={{ fontSize: 11, color: '#94A3B8', textDecorationLine: 'line-through', flex: 1 }}>{u.from}</Text>
            <Feather name="arrow-right" size={14} color="#CBD5E1" />
            <Text style={{ fontSize: 11, fontWeight: '700', color: '#CBD5E1', flex: 1.4 }}>{u.to}</Text>
            <View style={{ backgroundColor: u.c + '1A', paddingHorizontal: 6, paddingVertical: 3, borderRadius: 6, borderWidth: 1, borderColor: u.c + '35' }}>
              <Text style={{ fontSize: 9, fontWeight: '900', color: u.c }}>{u.fromLvl}→{u.toLvl}</Text>
            </View>
          </View>
        ))}
      </View>
      <Text style={FV.vizCite}>Source: Cambridge EVP Online · 6,345 corpus-verified entries</Text>
    </View>
  );
}

// Shadow Speaking — score circle + waveforms + dimension pills
const YOU_W    = [8,22,38,50,30,48,20,42,14,36,52,26,44,18,40,28];
const NATIVE_W = [10,28,42,54,34,52,24,46,18,40,56,30,48,22,44,32];

function ShadowVisual() {
  return (
    <View style={FV.visualPad}>
      <Text style={FV.vizLabel}>PROSODY MATCH ANALYSIS</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12 }}>
        {/* YOU waveform */}
        <View style={{ flex: 1, gap: 5 }}>
          <Text style={{ fontSize: 8, fontWeight: '900', color: '#E8713A', letterSpacing: 1.2 }}>YOU</Text>
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 2, height: 42 }}>
            {YOU_W.map((h, i) => (
              <View key={i} style={{ flex: 1, height: h * 0.72, backgroundColor: '#E8713A', borderRadius: 2, opacity: 0.8 }} />
            ))}
          </View>
        </View>
        {/* Central score circle */}
        <View style={{ width: 70, height: 70, borderRadius: 35, borderWidth: 2.5, borderColor: '#0FBA9A', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(15,186,154,0.08)' }}>
          <Text style={{ fontSize: 20, fontWeight: '900', color: '#0FBA9A', lineHeight: 22 }}>87%</Text>
          <Text style={{ fontSize: 8, fontWeight: '700', color: '#64748B' }}>MATCH</Text>
        </View>
        {/* NATIVE waveform */}
        <View style={{ flex: 1, gap: 5 }}>
          <Text style={{ fontSize: 8, fontWeight: '900', color: '#0FBA9A', letterSpacing: 1.2, textAlign: 'right' }}>NATIVE</Text>
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 2, height: 42 }}>
            {NATIVE_W.map((h, i) => (
              <View key={i} style={{ flex: 1, height: h * 0.72, backgroundColor: '#0FBA9A', borderRadius: 2, opacity: 0.8 }} />
            ))}
          </View>
        </View>
      </View>
      {/* Dimension pills */}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 12 }}>
        {[
          { lbl: 'Rhythm',     pct: 91, c: '#0FBA9A' },
          { lbl: 'Stress',     pct: 84, c: '#F59E0B' },
          { lbl: 'Intonation', pct: 79, c: '#E8713A' },
          { lbl: 'Fluency',    pct: 88, c: '#7C3AED' },
        ].map(d => (
          <View key={d.lbl} style={{ flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: d.c + '12', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1, borderColor: d.c + '30' }}>
            <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: d.c }} />
            <Text style={{ fontSize: 11, fontWeight: '700', color: '#94A3B8' }}>{d.lbl}</Text>
            <Text style={{ fontSize: 11, fontWeight: '900', color: d.c }}>{d.pct}%</Text>
          </View>
        ))}
      </View>
      <Text style={FV.vizCite}>Prosody · pitch, duration and stress envelope comparison</Text>
    </View>
  );
}

// Progress — CEFR roadmap + horizontal skill bars
function ProgressVisual() {
  const levels = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
  const cur = 2;
  const skills = [
    { lbl: 'Phoneme accuracy', pct: 62, c: '#E8713A' },
    { lbl: 'Vocabulary range', pct: 78, c: '#7C3AED' },
    { lbl: 'Fluency score',    pct: 55, c: '#0FBA9A' },
    { lbl: 'Pronunciation',    pct: 70, c: '#F59E0B' },
  ];
  return (
    <View style={FV.visualPad}>
      <Text style={FV.vizLabel}>CEFR PROGRESSION JOURNEY</Text>
      {/* Journey roadmap */}
      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 12, marginBottom: 4 }}>
        {levels.flatMap((l, i) => {
          const done    = i < cur;
          const current = i === cur;
          const target  = i === 4;
          const node = (
            <View key={l} style={{ alignItems: 'center', gap: 3 }}>
              <View style={[
                { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', borderWidth: 2 },
                done    ? { backgroundColor: '#10B981', borderColor: '#10B981' }               :
                current ? { backgroundColor: 'rgba(245,158,11,0.15)', borderColor: '#D97706' }               :
                target  ? { backgroundColor: 'rgba(15,186,154,0.10)', borderColor: '#0FBA9A' } :
                { backgroundColor: 'rgba(255,255,255,0.05)', borderColor: 'rgba(255,255,255,0.12)' },
              ]}>
                {done
                  ? <Feather name="check" size={11} color="#fff" />
                  : <Text style={{ fontSize: 9, fontWeight: '900', color: current ? '#D97706' : target ? '#0FBA9A' : '#CBD5E1' }}>{l}</Text>}
              </View>
              <Text style={{ fontSize: 7, fontWeight: '800', letterSpacing: 0.4, color: current ? '#D97706' : target ? '#0FBA9A' : 'transparent' }}>
                {current ? 'NOW' : 'GOAL'}
              </Text>
            </View>
          );
          if (i < levels.length - 1) {
            return [node, <View key={`c${i}`} style={{ flex: 1, height: 2, marginBottom: 14, backgroundColor: done ? '#10B981' : 'rgba(255,255,255,0.12)' }} />];
          }
          return [node];
        })}
      </View>
      {/* Skill bars */}
      <View style={{ gap: 8 }}>
        {skills.map(s => (
          <View key={s.lbl} style={{ gap: 3 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ fontSize: 10, fontWeight: '600', color: '#8BA0B8' }}>{s.lbl}</Text>
              <Text style={{ fontSize: 10, fontWeight: '800', color: s.c }}>{s.pct}%</Text>
            </View>
            <View style={{ height: 6, backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: 3, overflow: 'hidden' }}>
              <View style={{ width: `${s.pct}%` as any, height: '100%', backgroundColor: s.c, borderRadius: 3 }} />
            </View>
          </View>
        ))}
      </View>
      <Text style={FV.vizCite}>CEFR milestones · DeKeyser (2025) skill acquisition framework</Text>
    </View>
  );
}

const FEATURES = [
  {
    icon: 'mic',
    appendix: 'APPENDIX A',
    title: 'Accent DNA Profiling',
    desc: 'Among 1,247 Romanian speakers assessed during beta, these six English phonemes consistently produced the lowest accuracy scores. Each can be mastered — but only if it is named.',
    tag: 'Phonetics · IPA Analysis',
    tagColor: '#0FBA9A',
    Visual: AccentVisual,
  },
  {
    icon: 'book-open',
    appendix: 'APPENDIX B',
    title: 'Smart Vocabulary Coach',
    desc: 'Every word you use is classified A1–C2 against the Cambridge EVP corpus — 6,345 entries of corpus-verified vocabulary. See your distribution and get instant level-upgrade suggestions.',
    tag: 'CEFR · Cambridge EVP',
    tagColor: '#7C3AED',
    Visual: VocabVisual,
  },
  {
    icon: 'volume-2',
    appendix: 'APPENDIX C',
    title: 'Shadow Speaking',
    desc: 'Record yourself shadowing native audio. The engine compares your pitch envelope, stress pattern and rhythm against the target — and scores each dimension independently.',
    tag: 'Prosody · Rhythm · Stress',
    tagColor: '#E8713A',
    Visual: ShadowVisual,
  },
  {
    icon: 'trending-up',
    appendix: 'APPENDIX D',
    title: 'CEFR Progress Tracking',
    desc: 'Track your journey from B1 to C1. Every session updates your phoneme accuracy, vocabulary range and fluency score — all mapped to CEFR milestones with research citations.',
    tag: 'CEFR · DeKeyser 2025',
    tagColor: '#D97706',
    Visual: ProgressVisual,
  },
];

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [showAuth, setShowAuth] = useState(false);
  const [showForgot, setShowForgot] = useState(false);
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [banner, setBanner] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const router = useRouter();

  const scrollRef   = useRef<any>(null);
  const authCardRef = useRef<any>(null);

  // Staggered entrance animations
  const heroA    = useRef(new Animated.Value(0)).current;
  const heroY    = useRef(new Animated.Value(36)).current;
  const previewA = useRef(new Animated.Value(0)).current;
  const previewY = useRef(new Animated.Value(24)).current;
  const statsA   = useRef(new Animated.Value(0)).current;
  const statsY   = useRef(new Animated.Value(16)).current;
  const formA    = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.timing(heroA, { toValue: 1, duration: 680, useNativeDriver: true }),
        Animated.timing(heroY, { toValue: 0, duration: 680, useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.timing(previewA, { toValue: 1, duration: 580, useNativeDriver: true }),
        Animated.timing(previewY, { toValue: 0, duration: 580, useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.timing(statsA, { toValue: 1, duration: 480, useNativeDriver: true }),
        Animated.timing(statsY, { toValue: 0, duration: 480, useNativeDriver: true }),
      ]),
    ]).start();
  }, []);

  useEffect(() => {
    Animated.timing(formA, { toValue: showAuth ? 1 : 0, duration: 300, useNativeDriver: true }).start();
  }, [showAuth]);

  // Auth logic
  const openAuth = (login: boolean) => {
    setIsLogin(login);
    setShowAuth(true);
    // Give React one frame to render the auth card, then scroll to it
    setTimeout(() => {
      if (Platform.OS === 'web') {
        // authCardRef.current is the real DOM node in RN Web — scrollIntoView is reliable
        authCardRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
      } else {
        scrollRef.current?.scrollToEnd({ animated: true });
      }
    }, 80);
  };

  const validateEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

  const handleForgotPassword = async () => {
    if (!email) return setEmailError('Enter your email first');
    if (!validateEmail(email)) return setEmailError('Please enter a valid email');
    try {
      await sendPasswordResetEmail(auth, email);
      setBanner({ type: 'success', text: 'Reset email sent — check your inbox.' });
      setShowForgot(false);
    } catch (error: any) {
      const msg = error?.code === 'auth/user-not-found'
        ? 'No account found with this email.'
        : 'Could not send reset email. Try again.';
      setBanner({ type: 'error', text: msg });
    }
  };

  const handleAuth = async () => {
    setEmailError(''); setPasswordError(''); setBanner(null);
    if (!email)               return setEmailError('Email is required');
    if (!validateEmail(email)) return setEmailError('Please enter a valid email');
    if (!password)            return setPasswordError('Password is required');
    if (password.length < 6)  return setPasswordError('Password must be at least 6 characters');
    if (!isLogin && password !== confirmPassword) return setPasswordError('Passwords do not match');

    setLoading(true);
    try {
      const cred = isLogin
        ? await signInWithEmailAndPassword(auth, email, password)
        : await createUserWithEmailAndPassword(auth, email, password);
      const token = await cred.user.getIdToken();

      const candidates = [
        API_URL,
        Platform.OS === 'web' ? 'http://127.0.0.1:8000' : 'http://10.0.2.2:8000',
        'http://localhost:8000',
      ].filter((v, i, a) => a.indexOf(v) === i);

      let response: Response | null = null;
      let lastErr: any = null;
      for (const base of candidates) {
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), 5000);
        try {
          response = await fetch(`${base}/auth/verify`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token }),
            signal: ctrl.signal,
          });
          if (response.ok || response.status !== 0) break;
        } catch (e) { lastErr = e; }
        finally { clearTimeout(t); }
      }
      if (!response) throw lastErr || new Error('Backend unreachable');
      if (!response.ok) throw new Error(`Auth failed (${response.status})`);

      const data = await response.json();
      await AsyncStorage.setItem('authToken', token);
      await AsyncStorage.setItem('userEmail', data.email || email);

      if (!isLogin) {
        setBanner({ type: 'success', text: 'Account created — setting up your profile…' });
        setTimeout(() => router.replace('/onboarding'), 500);
      } else {
        setBanner({ type: 'success', text: 'Welcome back!' });
        setTimeout(() => router.replace(data.onboarding_completed ? '/(tabs)' : '/onboarding'), 400);
      }
    } catch (error: any) {
      setLoading(false);
      let msg = error?.message || 'Authentication failed';
      if (error?.code === 'auth/email-already-in-use')  msg = 'Email already in use — try signing in.';
      else if (error?.code === 'auth/invalid-email')     msg = 'Invalid email address';
      else if (error?.code === 'auth/weak-password')     msg = 'Password too weak (min. 6 characters)';
      else if (error?.code === 'auth/user-not-found')    msg = 'No account found — please sign up';
      else if (error?.code === 'auth/wrong-password')    msg = 'Incorrect password';
      else if (String(error?.message || '').includes('Network request failed'))
        msg = `Backend unreachable (${API_URL})`;
      setBanner({ type: 'error', text: msg });
    }
  };

  // Render
  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
      <View style={{ flex: 1, overflow: 'hidden' }}>

        {/* Background gradient */}
        <LinearGradient
          colors={['#060D1A', '#0A1628', '#0F1B2D', '#0A1426', '#0B1020']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFillObject}
        />

        {/* Geometric decoration (fixed background layer) */}
        {/* Teal large blob — top right */}
        <FloatBlob size={260} color="rgba(15,186,154,0.13)" style={{ top: -80, right: -80 }} delay={0} />
        {/* Coral blob — mid left */}
        <FloatBlob size={160} color="rgba(232,113,58,0.11)" style={{ top: 260, left: -60 }} delay={1000} />
        {/* Small teal blob — lower right */}
        <FloatBlob size={110} color="rgba(15,186,154,0.10)" style={{ top: 540, right: -20 }} delay={2000} />
        {/* Small purple blob — bottom left */}
        <FloatBlob size={80}  color="rgba(124,58,237,0.08)" style={{ top: 700, left: 40 }} delay={600} />

        {/* Decorative rings (static outlines) */}
        <View style={[G.ring, { width: 200, height: 200, borderRadius: 100, top: 60, right: -30, borderColor: 'rgba(15,186,154,0.18)' }]} />
        <View style={[G.ring, { width: 80,  height: 80,  borderRadius: 40,  top: 370, left: 20, borderColor: 'rgba(232,113,58,0.20)' }]} />
        <View style={[G.ring, { width: 50,  height: 50,  borderRadius: 25,  top: 520, right: 50, borderColor: 'rgba(124,58,237,0.16)' }]} />

        {/* Dots grids */}
        <DotsGrid rows={5} cols={4} gap={12} color="rgba(15,186,154,0.28)" style={{ top: 130, right: 20 }} />
        <DotsGrid rows={3} cols={3} gap={10} color="rgba(232,113,58,0.20)" style={{ top: 430, left: 16 }} />

        {/* Accent crosses */}
        <AccentCross color="rgba(15,186,154,0.32)" style={{ top: 380, right: 32 }} />
        <AccentCross color="rgba(232,113,58,0.28)" style={{ top: 580, left: 60 }} />

        {/* Banner */}
        <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />
        {banner && (
          <View style={[S.banner, { backgroundColor: banner.type === 'success' ? C.green : C.red }]}>
            <Text style={S.bannerText}>{banner.text}</Text>
          </View>
        )}

        {/* Scrollable content */}
        <ScrollView
          ref={scrollRef}
          style={{ flex: 1 }}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={S.scroll}
          keyboardShouldPersistTaps="handled"
        >

          {/* Nav */}
          <View style={S.nav}>
            <View style={{ backgroundColor: '#060D1A', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 7 }}>
              <Image source={require('../assets/images/logo.png')} style={{ width: 132, height: 44 }} resizeMode="contain" />
            </View>
            <TouchableOpacity style={S.navBtn} onPress={() => openAuth(true)}>
              <Text style={S.navBtnText}>Log In</Text>
            </TouchableOpacity>
          </View>

          {/* Hero */}
          <Animated.View style={[S.hero, { opacity: heroA, transform: [{ translateY: heroY }] }]}>

            {/* Eyebrow tag */}
            <View style={S.eyebrow}>
              <View style={S.eyebrowDot} />
              <Text style={S.eyebrowText}>Pronunciation Studio · Romanian Learners</Text>
            </View>

            {/* Headline */}
            <Text style={S.headline}>
              {'The quiet craft\nof '}
              <Text style={S.hlSpeaking}>speaking</Text>
              {'\nanother '}
              <Text style={S.hlTongue}>tongue.</Text>
            </Text>

            {/* Sub */}
            <Text style={S.description}>
              We map the precise phonemes that keep you from sounding native — then we drill them, one breath at a time.
            </Text>

            {/* Editorial note */}
            <View style={S.editorialCard}>
              <View style={S.editorialAccent} />
              <View style={S.editorialBody}>
                <Text style={S.editorialLabel}>EDITORIAL NOTE</Text>
                <Text style={S.editorialText}>
                  No grammar correction. No quizzes. Only vocabulary, rhythm, and the muscles of your mouth.
                </Text>
              </View>
            </View>

            {/* CTAs */}
            <View style={S.ctaRow}>
              <TouchableOpacity style={S.ctaDark} onPress={() => openAuth(false)} activeOpacity={0.85}>
                <Text style={S.ctaDarkText}>Begin the assessment</Text>
                <Feather name="arrow-up-right" size={16} color="#fff" style={{ marginLeft: 4 }} />
              </TouchableOpacity>
              <TouchableOpacity style={S.ctaCoral} onPress={() => openAuth(true)} activeOpacity={0.85}>
                <Text style={S.ctaCoralPlay}>▷</Text>
                <Text style={S.ctaCoralText}>Sign In</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>

          {/* App preview */}
          <Animated.View style={[S.previewWrap, { opacity: previewA, transform: [{ translateY: previewY }] }]}>
            <View style={S.previewWindow}>

              {/* Title bar */}
              <View style={S.titleBar}>
                <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
                  <View style={[S.trafficDot, { backgroundColor: '#FF5F57' }]} />
                  <View style={[S.trafficDot, { backgroundColor: '#FEBC2E' }]} />
                  <View style={[S.trafficDot, { backgroundColor: '#28C840' }]} />
                </View>
                <Text style={S.titleBarLabel}>VocaFlow Practice</Text>
                <View style={S.aiFeedbackBadge}>
                  <View style={[S.aiFeedbackDot]} />
                  <Text style={S.aiFeedbackText}>AI Feedback</Text>
                </View>
              </View>

              {/* Waveform */}
              <View style={S.waveCard}>
                <View style={S.waveHeader}>
                  <Text style={S.waveLabel}>LIVE AUDIO</Text>
                  <Text style={S.waveTime}>00:00:14</Text>
                </View>
                <LiveWaveform />
              </View>

              {/* Streak */}
              <View style={S.streak}>
                <Feather name="zap" size={12} color="#fff" />
                <Text style={S.streakText}>12-day streak</Text>
              </View>

              {/* Accent DNA */}
              <View style={S.featureCard}>
                <View style={S.featureRow}>
                  <View style={[S.featureIcon, { backgroundColor: 'rgba(15,186,154,0.15)' }]}>
                    <Feather name="mic" size={18} color={C.coral} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={S.featureTitle}>Accent DNA</Text>
                    <Text style={S.featureSub}>Your phonetic profile</Text>
                  </View>
                  <View style={S.deltaBadge}><Text style={S.deltaText}>+12%</Text></View>
                </View>
                <View style={S.phonemeRow}>
                  {[
                    { ipa: '/θ/', score: 78, color: C.amber },
                    { ipa: '/ð/', score: 72, color: C.amber },
                    { ipa: '/æ/', score: 88, color: C.green },
                    { ipa: '/w/', score: 45, color: C.red },
                    { ipa: '/ɹ/', score: 52, color: C.red },
                  ].map((p, i) => (
                    <View key={i} style={S.phonemeCol}>
                      <View style={S.phonemeBarBg}>
                        <View style={[S.phonemeBarFill, { height: `${p.score}%` as any, backgroundColor: p.color }]} />
                      </View>
                      <Text style={S.phonemeIpa}>{p.ipa}</Text>
                    </View>
                  ))}
                </View>
              </View>

              {/* Vocabulary Coach */}
              <View style={S.featureCard}>
                <View style={S.featureRow}>
                  <View style={[S.featureIcon, { backgroundColor: 'rgba(232,113,58,0.15)' }]}>
                    <Feather name="cpu" size={18} color={C.purple} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={S.featureTitle}>Vocabulary Coach</Text>
                    <Text style={S.featureSub}>Smart suggestions</Text>
                  </View>
                </View>
                <View style={S.suggRow}>
                  <Text style={S.suggStrike}>"very good"</Text>
                  <Feather name="arrow-right" size={13} color={C.lite} style={S.suggArrow} />
                  <Text style={S.suggGood}>"excellent"</Text>
                  <Text style={S.suggDim}>, "outstanding"</Text>
                </View>
              </View>

            </View>
          </Animated.View>

          {/* Stats */}
          <Animated.View style={[S.statsRow, { opacity: statsA, transform: [{ translateY: statsY }] }]}>
            {[
              { value: '1,247', label: 'ROMANIAN\nSPEAKERS', color: C.teal },
              { value: '42',    label: 'PHONEMES\nMAPPED',   color: C.coral },
              { value: 'B1→C1', label: 'TARGET\nBAND',       color: C.purple },
            ].map((s, i) => (
              <View key={i} style={[S.statCard, { borderTopColor: s.color }]}>
                <Text style={S.statValue}>{s.value}</Text>
                <Text style={S.statLabel}>{s.label}</Text>
              </View>
            ))}
          </Animated.View>

          {/* Features section */}
          <View style={FS.section}>
            <Text style={FS.sectionEye}>WHAT MAKES VOCAFLOW DIFFERENT</Text>
            <Text style={FS.sectionTitle}>Built around the science{'\n'}of pronunciation.</Text>
            <Text style={FS.sectionSub}>Four interlocking modules that target exactly what Romanian speakers struggle with in English.</Text>
          </View>

          {FEATURES.map((feat) => {
            const Visual = feat.Visual;
            return (
              <View key={feat.title} style={FS.featureCard}>
                {/* Graphic header — editorial research-table style */}
                <View style={[FS.featureHeader, { borderBottomColor: feat.tagColor + '22' }]}>
                  <View style={[FS.cornerTag, { backgroundColor: feat.tagColor }]}>
                    <Text style={FS.cornerTagText}>{feat.appendix}</Text>
                  </View>
                  <Visual />
                </View>

                {/* Text body */}
                <View style={FS.featureBody}>
                  <View style={FS.featureTitleRow}>
                    <View style={[FS.featureIconBox, { backgroundColor: feat.tagColor + '20' }]}>
                      <Feather name={feat.icon as any} size={20} color={feat.tagColor} />
                    </View>
                    <Text style={FS.featureTitle}>{feat.title}</Text>
                  </View>
                  <Text style={FS.featureDesc}>{feat.desc}</Text>
                  <View style={[FS.featureTag, { backgroundColor: feat.tagColor + '16' }]}>
                    <Text style={[FS.featureTagText, { color: feat.tagColor }]}>{feat.tag}</Text>
                  </View>
                </View>
              </View>
            );
          })}

          {/* Auth form */}
          {showAuth && (
            <Animated.View ref={authCardRef} style={[S.authCard, { opacity: formA }]}>
              <View style={S.authHeader}>
                <Text style={S.authTitle}>{isLogin ? 'Welcome back' : 'Create account'}</Text>
                <TouchableOpacity onPress={() => setShowAuth(false)}>
                  <Feather name="x" size={20} color={C.muted} />
                </TouchableOpacity>
              </View>
              <Image
                source={require('../assets/icons/undraw_secure-login_m11a-removebg-preview.png')}
                style={S.authArt}
                resizeMode="contain"
              />
              <View style={S.tabs}>
                {(['login', 'signup'] as const).map((mode) => {
                  const active = (mode === 'login') === isLogin;
                  return (
                    <TouchableOpacity key={mode} style={[S.tab, active && S.tabActive]} onPress={() => setIsLogin(mode === 'login')}>
                      <Text style={[S.tabText, active && S.tabTextActive]}>{mode === 'login' ? 'Sign In' : 'Sign Up'}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              <View style={S.field}>
                <Text style={S.label}>Email</Text>
                <TextInput
                  style={[S.input, emailError ? S.inputError : null]}
                  value={email} onChangeText={(t) => { setEmail(t); setEmailError(''); }}
                  placeholder="you@example.com" placeholderTextColor={C.lite}
                  keyboardType="email-address" autoCapitalize="none" autoComplete="email"
                />
                {emailError ? <Text style={S.errorText}>{emailError}</Text> : null}
              </View>
              <View style={S.field}>
                <Text style={S.label}>Password</Text>
                <TextInput
                  style={[S.input, passwordError ? S.inputError : null]}
                  value={password} onChangeText={(t) => { setPassword(t); setPasswordError(''); }}
                  placeholder="••••••••" placeholderTextColor={C.lite}
                  secureTextEntry autoComplete={isLogin ? 'current-password' : 'new-password'}
                />
              </View>
              {!isLogin && (
                <View style={S.field}>
                  <Text style={S.label}>Confirm Password</Text>
                  <TextInput
                    style={[S.input, passwordError ? S.inputError : null]}
                    value={confirmPassword} onChangeText={setConfirmPassword}
                    placeholder="••••••••" placeholderTextColor={C.lite} secureTextEntry
                  />
                </View>
              )}
              {passwordError ? <Text style={S.errorText}>{passwordError}</Text> : null}

              {isLogin && !showForgot && (
                <TouchableOpacity onPress={() => setShowForgot(true)} style={S.forgotBtn}>
                  <Text style={S.forgotText}>Forgot password?</Text>
                </TouchableOpacity>
              )}

              {showForgot && (
                <View style={S.forgotCard}>
                  <Text style={S.forgotCardTitle}>Reset Password</Text>
                  <Text style={S.forgotCardDesc}>
                    Enter your email and we'll send you a reset link.
                  </Text>
                  <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
                    <TouchableOpacity style={[S.submitBtn, { flex: 1, marginTop: 0, marginBottom: 0 }]} onPress={handleForgotPassword}>
                      <Text style={S.submitBtnText}>Send Reset Email</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[S.submitBtn, { flex: 0.4, marginTop: 0, marginBottom: 0, backgroundColor: C.border }]}
                      onPress={() => setShowForgot(false)}
                    >
                      <Text style={[S.submitBtnText, { color: C.muted }]}>Cancel</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              <TouchableOpacity style={[S.submitBtn, loading && { opacity: 0.7 }, showForgot && { display: 'none' }]} onPress={handleAuth} disabled={loading}>
                {loading
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Text style={S.submitBtnText}>{isLogin ? 'Sign In' : 'Create Account'}</Text>}
              </TouchableOpacity>
              <Text style={S.legal}>By continuing you agree to our Terms and Privacy Policy.</Text>
            </Animated.View>
          )}

          {/* Footer */}
          <View style={S.footer}>
            <Text style={S.footerText}>Built on academic research · IELTS · Cambridge · COCA · CEFR</Text>
          </View>

        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}

// Shared geometry style
const G = StyleSheet.create({
  ring: { position: 'absolute', borderWidth: 1.5 },
});

const S = StyleSheet.create({
  scroll: {
    paddingBottom: 72,
    paddingHorizontal: isTablet ? 60 : 22,
    maxWidth: 960,
    alignSelf: 'center',
    width: '100%',
  },
  banner: {
    paddingTop: Platform.OS === 'ios' ? 54 : 18,
    paddingBottom: 14, paddingHorizontal: 24,
    alignItems: 'center',
  },
  bannerText: { color: '#fff', fontSize: 14, fontWeight: '700' },

  // Nav
  nav: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: Platform.OS === 'ios' ? 64 : 46, paddingBottom: 16,
  },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  logoBox: { width: 38, height: 38, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  logoEmoji: { fontSize: 20 },
  brand: { fontSize: 22, fontWeight: '800', color: C.text, letterSpacing: -0.6 },
  navBtn: {
    paddingHorizontal: 18, paddingVertical: 9, borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.75)',
    borderWidth: 1, borderColor: 'rgba(15,186,154,0.28)',
  },
  navBtnText: { fontSize: 13, fontWeight: '700', color: C.text },

  // Hero
  hero: { marginTop: 16, marginBottom: 36 },
  authArt: { width: 190, height: 130, alignSelf: 'center', marginTop: 6, marginBottom: 10 },

  eyebrow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 18 },
  eyebrowDot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: C.teal },
  eyebrowText: { fontSize: 12, fontWeight: '700', color: C.teal, letterSpacing: 0.4 },

  headline: {
    fontSize: isTablet ? 62 : 46,
    fontWeight: '900',
    color: C.text,
    lineHeight: isTablet ? 74 : 56,
    letterSpacing: -2,
    marginBottom: 22,
  },
  hlSpeaking: { fontStyle: 'italic', backgroundColor: C.amberBg, color: C.text },
  hlTongue:   { color: C.teal, fontStyle: 'normal' },

  description: {
    fontSize: 16, color: C.muted, lineHeight: 27,
    maxWidth: 460, marginBottom: 28,
  },

  // Editorial note card — glassmorphism
  editorialCard: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.62)',
    borderRadius: 8,
    overflow: 'hidden',
    marginBottom: 30,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.85)',
    ...(Platform.OS === 'web' ? ({ backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)' } as any) : {}),
  },
  editorialAccent: { width: 4, backgroundColor: C.purple },
  editorialBody:   { flex: 1, paddingHorizontal: 16, paddingVertical: 16 },
  editorialLabel:  { fontSize: 10, fontWeight: '800', letterSpacing: 1.8, color: C.teal, marginBottom: 7 },
  editorialText:   { fontSize: 14, color: C.muted, lineHeight: 22 },

  // CTAs
  ctaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  ctaDark: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: C.navy,
    paddingHorizontal: 24, paddingVertical: 17, borderRadius: 10,
    shadowColor: C.navy, shadowOpacity: 0.38, shadowRadius: 14, shadowOffset: { width: 0, height: 7 }, elevation: 7,
  },
  ctaDarkText:  { color: '#fff', fontSize: 15, fontWeight: '800' },
  ctaDarkArrow: { color: 'rgba(255,255,255,0.7)', fontSize: 18, fontWeight: '700' },
  ctaCoral: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 20, paddingVertical: 17, borderRadius: 10,
    borderWidth: 1.5, borderColor: C.coral,
    backgroundColor: 'rgba(255,255,255,0.42)',
  },
  ctaCoralPlay: { fontSize: 13, color: C.coral, fontWeight: '900' },
  ctaCoralText: { fontSize: 15, fontWeight: '700', color: C.coral },

  // Preview window
  previewWrap: { marginBottom: 32 },
  previewWindow: {
    backgroundColor: 'rgba(255,255,255,0.97)',
    borderRadius: 22,
    padding: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.9)',
    shadowColor: '#0A1628',
    shadowOpacity: 0.15,
    shadowRadius: 48,
    shadowOffset: { width: 0, height: 20 },
    elevation: 12,
    gap: 14,
  },

  // Title bar
  titleBar: {
    flexDirection: 'row', alignItems: 'center',
    paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  trafficDot: { width: 10, height: 10, borderRadius: 5 },
  titleBarLabel: { flex: 1, marginLeft: 12, fontSize: 12, fontWeight: '700', color: C.muted },
  aiFeedbackBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: 'rgba(16,185,129,0.10)',
    borderWidth: 1, borderColor: 'rgba(16,185,129,0.22)',
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999,
  },
  aiFeedbackDot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: C.green },
  aiFeedbackText: { fontSize: 11, fontWeight: '700', color: C.green },

  // Wave card
  waveCard: {
    backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)', gap: 10,
  },
  waveHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  waveLabel:  { fontSize: 10, fontWeight: '800', color: C.muted, letterSpacing: 1.5 },
  waveTime:   { fontSize: 12, fontWeight: '700', color: C.text },

  // Streak
  streak: {
    alignSelf: 'flex-start', backgroundColor: C.coral,
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999,
    shadowColor: C.coral, shadowOpacity: 0.32, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 4,
  },
  streakText: { color: '#fff', fontSize: 12, fontWeight: '800' },

  // Feature cards
  featureCard: {
    backgroundColor: C.card, borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)', gap: 12,
  },
  featureRow:  { flexDirection: 'row', alignItems: 'center', gap: 12 },
  featureIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  featureTitle: { fontSize: 14, fontWeight: '800', color: C.text },
  featureSub:   { fontSize: 11, color: C.muted, marginTop: 1 },
  deltaBadge: { backgroundColor: C.greenL, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  deltaText:  { fontSize: 11, fontWeight: '800', color: C.green },

  phonemeRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  phonemeCol: { flex: 1, alignItems: 'center', gap: 6 },
  phonemeBarBg: {
    width: '100%', height: 60, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.06)',
    overflow: 'hidden', justifyContent: 'flex-end',
  },
  phonemeBarFill: { width: '100%', borderRadius: 8 },
  phonemeIpa: {
    fontSize: 11, fontWeight: '700', color: C.muted,
    fontFamily: Platform.select({ ios: 'Menlo', default: 'monospace' }),
  },

  suggRow:    { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 },
  suggStrike: { fontSize: 13, color: C.red, textDecorationLine: 'line-through', fontWeight: '600' },
  suggArrow:  { fontSize: 14, color: C.lite, fontWeight: '700' },
  suggGood:   { fontSize: 13, color: C.green, fontWeight: '700' },
  suggDim:    { fontSize: 13, color: C.muted, fontWeight: '600' },

  // Stats
  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 44 },
  statCard: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.80)',
    borderRadius: 12, borderTopWidth: 3, borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.88)',
    paddingHorizontal: isTablet ? 20 : 12, paddingVertical: 18,
  },
  statValue: { fontSize: isTablet ? 34 : 22, fontWeight: '900', color: C.text, letterSpacing: -0.8, marginBottom: 5 },
  statLabel: { fontSize: 9, fontWeight: '700', color: C.muted, letterSpacing: 0.7, lineHeight: 13 },

  // Auth form
  authCard: {
    backgroundColor: C.card, borderRadius: 20, padding: 24,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', marginBottom: 36,
    shadowColor: '#0F172A', shadowOpacity: 0.10, shadowRadius: 30,
    shadowOffset: { width: 0, height: 14 }, elevation: 6,
  },
  authHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  authTitle:  { fontSize: 20, fontWeight: '800', color: C.text },
  authClose:  { fontSize: 18, color: C.lite, padding: 4 },

  tabs: { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 10, padding: 4, marginBottom: 20 },
  tab:  { flex: 1, paddingVertical: 9, alignItems: 'center', borderRadius: 7 },
  tabActive: {
    backgroundColor: C.card,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, shadowOffset: { width: 0, height: 1 }, elevation: 1,
  },
  tabText:       { fontSize: 13, fontWeight: '600', color: C.muted },
  tabTextActive: { color: C.text, fontWeight: '800' },

  field: { marginBottom: 16 },
  label: { fontSize: 12, fontWeight: '700', color: C.muted, marginBottom: 6, letterSpacing: 0.3 },
  input: {
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.12)', borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 13,
    fontSize: 15, color: C.text, backgroundColor: C.card,
  },
  inputError: { borderColor: C.red },
  errorText:  { fontSize: 12, color: C.red, marginTop: 4, fontWeight: '600' },

  submitBtn: {
    backgroundColor: C.teal, paddingVertical: 16, borderRadius: 10,
    alignItems: 'center', marginTop: 8, marginBottom: 14,
    shadowColor: C.teal, shadowOpacity: 0.32, shadowRadius: 12, shadowOffset: { width: 0, height: 5 }, elevation: 5,
  },
  submitBtnText: { color: '#fff', fontSize: 15, fontWeight: '800' },
  legal: { fontSize: 11, color: C.lite, textAlign: 'center', lineHeight: 16 },

  forgotBtn:  { alignSelf: 'flex-end', marginBottom: 8, marginTop: -4 },
  forgotText: { fontSize: 12, color: C.teal, fontWeight: '700' },
  forgotCard: {
    backgroundColor: 'rgba(15,186,154,0.06)',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(15,186,154,0.22)',
    marginBottom: 12,
  },
  forgotCardTitle: { fontSize: 15, fontWeight: '800', color: C.text, marginBottom: 4 },
  forgotCardDesc:  { fontSize: 13, color: C.muted, lineHeight: 19 },

  // Footer
  footer: { paddingTop: 16, alignItems: 'center' },
  footerText: { fontSize: 11, color: 'rgba(10,22,40,0.36)', textAlign: 'center', lineHeight: 17 },
});

// Feature visual inner styles
const FV = StyleSheet.create({
  visualPad: { padding: 16, paddingTop: 40, gap: 0 },
  vizLabel:  { fontSize: 9, fontWeight: '800', color: '#94A3B8', letterSpacing: 1.4 },
  vizCite:   { fontSize: 9, color: '#94A3B8', fontStyle: 'italic', marginTop: 10, lineHeight: 13 },
});

// Features section layout styles
const FS = StyleSheet.create({
  section: { marginBottom: 28 },
  sectionEye: { fontSize: 10, fontWeight: '800', letterSpacing: 1.8, color: C.teal, marginBottom: 10 },
  sectionTitle: { fontSize: isTablet ? 40 : 32, fontWeight: '900', color: C.text, lineHeight: isTablet ? 50 : 40, letterSpacing: -1.2, marginBottom: 12 },
  sectionSub: { fontSize: 15, color: C.muted, lineHeight: 24, maxWidth: 420 },

  featureCard: {
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 20,
    overflow: 'hidden',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.9)',
    shadowColor: '#0A1628',
    shadowOpacity: 0.10,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: 12 },
    elevation: 8,
  },
  featureHeader: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderBottomWidth: 1,
    overflow: 'hidden',
  },
  cornerTag: {
    position: 'absolute', top: 0, right: 0,
    paddingHorizontal: 11, paddingVertical: 5,
    borderBottomLeftRadius: 10,
    zIndex: 10,
  },
  cornerTagText: { fontSize: 8, fontWeight: '900', color: '#fff', letterSpacing: 1.4 },

  featureBody: { padding: 20, gap: 12 },
  featureTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  featureIconBox: { width: 44, height: 44, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  featureTitle: { fontSize: 18, fontWeight: '900', color: C.text, flex: 1, letterSpacing: -0.5 },
  featureDesc: { fontSize: 14, color: C.muted, lineHeight: 22 },
  featureTag: { alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 5, borderRadius: 8 },
  featureTagText: { fontSize: 11, fontWeight: '800', letterSpacing: 0.3 },
});
