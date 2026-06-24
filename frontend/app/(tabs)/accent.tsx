import { useState, useRef, useEffect, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Platform,
  Animated,
  Dimensions,
  Easing,
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import { LinearGradient } from 'expo-linear-gradient';
import { API_URL } from '../../constants/api';
import { useLearnerProfile } from '../../context/LearnerProfile';
import { Colors, Animations } from '../../constants/theme';
import { Illustrations } from '@/constants/illustrations';
import { SectionHeader, SectionHero } from '@/components/section-header';
import { speakPhoneme, warmupVoices, playAudioAsset, stopAudioAsset, stopAllPlayback } from '@/utils/voiceProfiles';
import { getPhonemeAudio } from '@/constants/phonemeAudio';
import { getDemoAudio } from '@/constants/demoAudio';
import SavedSessions from '@/components/saved-sessions';
import type { AccentSession } from '@/utils/demoSessions';
import AsyncStorage from '@react-native-async-storage/async-storage';

// romanian_error: documented substitution patterns from Măchiță (2021)
// Interlanguage Theory (Selinker 1972) + Auditory Distance Model (Brannen 2011)
const PHONEME_EXERCISES = [
  {
    phoneme: '/u:/-/ʊ/',
    description: 'Tense vs Lax U',
    words: ['goose', 'book', 'food', 'look', 'pool'],
    minimal_pairs: [['goose', 'good'], ['fool', 'full'], ['pool', 'pull']],
    ipa: '/uː/ vs /ʊ/',
    articulation: 'For /uː/: lips tightly rounded, tongue raised and back. For /ʊ/: lips loosely rounded, tongue slightly lower.',
    practice_sentence: 'The cook put good food in the cool pool.',
    tip: 'Keep /u:/ tense (longer), /ʊ/ lax (shorter).',
    romanian_error: {
      substitute: 'Both collapsed into one sound close to Romanian /u/',
      why: 'Romanian has no tense-lax vowel distinction — both phonemes feel identical to L1 speakers (Interlanguage merging)',
    },
    cefr: 'B1',
    color: '#d62728',
  },
  {
    phoneme: '/i:/-/ɪ/',
    description: 'Tense vs Lax I',
    words: ['fleece', 'kit', 'see', 'sit', 'cheese'],
    minimal_pairs: [['seat', 'sit'], ['feel', 'fill'], ['sheep', 'ship']],
    ipa: '/iː/ vs /ɪ/',
    articulation: 'For /iː/: lips spread, tongue high and front. For /ɪ/: lips relaxed, tongue slightly lower.',
    practice_sentence: 'He still feels ill after eating six green beans.',
    tip: 'Minimal pairs: fleece/kit. Keep /i:/ forward and tense.',
    romanian_error: {
      substitute: 'Both merged into one category close to Romanian /i/',
      why: 'Same tense-lax merging as /uː/-/ʊ/ — Romanian /i/ sits between the two English phonemes, causing confusion',
    },
    cefr: 'B1',
    color: '#8B5CF6',
  },
  {
    phoneme: '/ð/',
    description: 'TH voiced',
    words: ['the', 'this', 'that', 'there', 'though'],
    minimal_pairs: [['this', 'dis'], ['they', 'day'], ['though', 'dough']],
    ipa: '/ð/',
    articulation: 'Place the tip of your tongue lightly between your upper and lower front teeth, then add voice (vibration in throat).',
    practice_sentence: 'This is the other thing that bothers them.',
    tip: 'NOT in Romanian — tongue BETWEEN teeth, add voice.',
    romanian_error: {
      substitute: '[d] — voiced dental stop',
      why: 'Auditory Distance Model (Brannen 2011): Romanian /d/ is dental, perceived as acoustically the closest substitute for /ð/. French speakers use [z]; Romanian speakers use [d].',
    },
    cefr: 'B2',
    color: '#8B5CF6',
  },
  {
    phoneme: '/θ/',
    description: 'TH unvoiced',
    words: ['think', 'three', 'through', 'thanks', 'thunder'],
    minimal_pairs: [['think', 'sink'], ['three', 'tree'], ['thumb', 'sum']],
    ipa: '/θ/',
    articulation: 'Place tongue between teeth (like /ð/) but WITHOUT voicing — just push air through.',
    practice_sentence: 'Think through three thousand theories thoroughly.',
    tip: 'Place tongue between teeth and blow air — no voice.',
    romanian_error: {
      substitute: '[t] — voiceless dental stop (occasionally [f])',
      why: 'Auditory Distance Model: Romanian /t/ is dental and perceived as the closest equivalent to /θ/. Unlike French speakers who prefer [f], Romanian speakers use [t] due to their richer dental consonant inventory.',
    },
    cefr: 'B2',
    color: '#8B5CF6',
  },
  {
    phoneme: '/æ/-/ɑ:/',
    description: 'Short A vs Back A',
    words: ['cat', 'bad', 'math', 'father', 'palm'],
    minimal_pairs: [['cat', 'cart'], ['bat', 'bar'], ['bad', 'bard']],
    ipa: '/æ/ vs /ɑː/',
    articulation: 'For /æ/: jaw drops significantly, front of tongue raised. For /ɑː/: jaw very open, tongue flat and back.',
    practice_sentence: 'My father parked the car after the bad crash.',
    tip: 'Open wider for /æ/, further back and lower for /ɑː/.',
    romanian_error: {
      substitute: '/æ/ → shifted toward Romanian /e/ (F2 too high, not open enough)',
      why: 'Interlanguage: /æ/ formant values fall between RP and Romanian /e/ — second best realised vowel, but still consistently undershoot the English target',
    },
    cefr: 'B2',
    color: '#0FBA9A',
  },
  {
    phoneme: '/ʌ/',
    description: 'Mid-central vowel',
    words: ['cup', 'blood', 'mud', 'sun', 'love'],
    minimal_pairs: [['cut', 'caught'], ['sun', 'son'], ['love', 'live']],
    ipa: '/ʌ/',
    articulation: 'Tongue in mid-central position, mouth half-open. More central and less open than Romanian /a/.',
    practice_sentence: 'The young monk suddenly jumped up in the muddy sun.',
    tip: 'More central and less open than Romanian /a/.',
    romanian_error: {
      substitute: 'Too open — closer to Romanian /a/ (F1 avg 786 Hz vs RP 623 Hz)',
      why: 'Romanian /a/ is more open and back; learners transfer L1 F1 values, producing a vowel that is too low and too back for English /ʌ/',
    },
    cefr: 'B1',
    color: '#0FBA9A',
  },
  {
    phoneme: '[ɫ] Dark L',
    description: 'Dark L at end',
    words: ['milk', 'wall', 'tell', 'field', 'small'],
    minimal_pairs: [['milk', 'milch'], ['feel', 'fill'], ['tall', 'tale']],
    ipa: '[ɫ]',
    articulation: 'Raise the back of the tongue toward the soft palate while tip touches upper teeth ridge. Sounds "darker" than clear /l/.',
    practice_sentence: 'The tall mill wall will fill with small hills.',
    tip: 'Position rule: clear /l/ at word start, dark [ɫ] at end or before consonant.',
    romanian_error: {
      substitute: 'Clear [l] in all positions',
      why: 'Romanian /l/ is always realised as clear [l] — dark [ɫ] does not exist in L1. Only 50% of Romanian learners produced it correctly even once.',
    },
    cefr: 'B2',
    color: '#0FBA9A',
  },
  {
    phoneme: '/ŋ/',
    description: 'NG sound',
    words: ['doing', 'sing', 'ring', 'thing', 'morning'],
    minimal_pairs: [['sing', 'sin'], ['ring', 'rin'], ['king', 'kin']],
    ipa: '/ŋ/',
    articulation: 'Back of tongue rises to touch soft palate (like /k/ or /g/ but with nasal air flow). NO extra /g/ sound after.',
    practice_sentence: 'Singing and dancing brings amazing energy every morning.',
    tip: 'Train final /ŋ/ WITHOUT adding extra [g] at the end.',
    romanian_error: {
      substitute: '[ŋg] — velar nasal always followed by a voiced velar stop',
      why: 'In Romanian, [ŋ] is only an allophone of /n/ before /k/ or /g/ — it never occurs standalone. 50% of learners always added [g]; 0% correct on the word-list task.',
    },
    cefr: 'B1',
    color: '#8B5CF6',
  },
  {
    phoneme: '[kʰ]',
    description: 'Aspirated K',
    words: ['keep', 'kind', 'kit', 'king', 'key'],
    minimal_pairs: [['keep', 'geep'], ['cold', 'gold'], ['Kate', 'gate']],
    ipa: '[kʰ]',
    articulation: 'Back of tongue rises to soft palate and releases with a burst of air (aspiration). Hold paper in front: it should flutter.',
    practice_sentence: 'The kind king kept a clean, cool, quiet castle.',
    tip: 'Aspiration at start of stressed syllable: release a puff of air (VOT 40–80ms).',
    romanian_error: {
      substitute: 'Over-aspirated — VOT often >40 ms (70% of Romanian learners)',
      why: 'English VOT increases from bilabial to velar stops. Romanian learners over-apply this English pattern at the velar place, producing bursts longer than the 30–40 ms English norm.',
    },
    cefr: 'C1',
    color: '#8B5CF6',
  },
  {
    phoneme: '/ə/',
    description: 'Schwa (unstressed)',
    words: ['about', 'sofa', 'comma', 'around', 'alone'],
    minimal_pairs: [['about', 'a boot'], ['the /ðə/', 'the /ðiː/']],
    ipa: '/ə/',
    articulation: 'Completely relaxed mouth and tongue in the middle position. The most natural, effortless sound in English.',
    practice_sentence: 'About a dozen of us arrived around eleven in the morning.',
    tip: 'Light, unstressed — never fully elide it; it glues the sentence together.',
    romanian_error: {
      substitute: 'Full vowel quality preserved in unstressed syllables',
      why: 'Romanian has no schwa reduction — every vowel keeps its full quality. English unstressed syllables collapse to /ə/, which feels unnatural to L1 Romanian speakers.',
    },
    cefr: 'B2',
    color: '#06b6d4',
  },
  {
    phoneme: '[pʰ]',
    description: 'Aspirated P',
    words: ['pen', 'put', 'pat', 'pick', 'peace'],
    minimal_pairs: [['pen', 'ben'], ['pet', 'bet'], ['peace', 'beast']],
    ipa: '[pʰ]',
    articulation: 'Lips pressed together, release with a burst of air. Hold a piece of paper: it should move clearly when you say "pen".',
    practice_sentence: 'Peter picked a pretty pink pepper plant in the park.',
    tip: 'English initial /p/ needs aspiration (VOT 50–100ms) — stronger puff than Romanian.',
    romanian_error: {
      substitute: 'Unaspirated [p] at word start',
      why: 'Romanian aspiration occurs only pre-pausally (after stops at the end of an utterance), never word-initially. Learners suppress initial aspiration by L1 transfer.',
    },
    cefr: 'C1',
    color: '#8B5CF6',
  },
  {
    phoneme: '[tʰ]',
    description: 'Aspirated T',
    words: ['tea', 'top', 'time', 'take', 'talk'],
    minimal_pairs: [['tea', 'dee'], ['time', 'dime'], ['ten', 'den']],
    ipa: '[tʰ]',
    articulation: 'Tongue tip behind upper teeth, release with strong air burst. The aspiration distinguishes /t/ from /d/ in initial position.',
    practice_sentence: 'Ten tiny turtles took time to talk to Tom today.',
    tip: 'Explicit aspiration at stressed word start — puff of air distinguishes it from /d/.',
    romanian_error: {
      substitute: 'Unaspirated [t] — the hardest allophone in the study',
      why: 'Only 1 out of 10 Romanian learners produced [tʰ] correctly (Măchiță 2021). Initial aspiration is absent in Romanian; L1 transfer fully suppresses the required VOT of 30–40 ms.',
    },
    cefr: 'C1',
    color: '#8B5CF6',
  },
];

type Feedback = {
  accuracy_score: number;
  transcribed_text: string;
  problematic_phonemes: { phoneme: string; example: string; severity: string }[];
  suggestions: { issue: string; fix: string }[];
  overall_feedback: string;
  intelligibility_only?: boolean;
  similarity?: { word: number; char: number };
  missed_words?: string[];
  alignment?: { expected: string; produced: string; ok: boolean }[];
  word_breakdown?: { word: string; correct: number; total: number; ok: boolean; phonemes?: { p: string; ok: boolean }[] }[];
  engine?: string;
};

type PracticeMode = 'word' | 'sentence';
type DiffFilter = 'ALL' | 'B1' | 'B2' | 'C1';

const ScoreRing = ({ score }: { score: number }) => {
  const color = score >= 88 ? '#0FBA9A' : score >= 70 ? '#8B5CF6' : '#EF4444';
  const label = score >= 88 ? 'Excellent' : score >= 70 ? 'Good' : 'Needs Work';
  return (
    <View style={scoreRingStyles.outer}>
      <View style={[scoreRingStyles.ring, { borderColor: color }]}>
        <Text style={[scoreRingStyles.value, { color }]}>{score}%</Text>
        <Text style={scoreRingStyles.sublabel}>Accuracy</Text>
      </View>
      <Text style={[scoreRingStyles.grade, { color }]}>{label}</Text>
    </View>
  );
};

const scoreRingStyles = StyleSheet.create({
  outer: { alignItems: 'center', gap: 6 },
  ring: {
    width: 100, height: 100, borderRadius: 50,
    borderWidth: 6,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.light.background,
  },
  value: { fontSize: 24, fontWeight: '800', letterSpacing: -1 },
  sublabel: { fontSize: 10, color: Colors.light.textSecondary, fontWeight: '600' },
  grade: { fontSize: 13, fontWeight: '700' },
});

// Phoneme Globe
// A rotating globe with the 12 phonemes in orbit, colour-coded by status:
//   green  = mastered (last score ≥ 75)
//   red    = problem  (attempted but low, or flagged weak in Accent DNA profile)
//   gold   = to cover (not attempted yet)
const { width: ACC_SCREEN_W } = Dimensions.get('window');
const GLOBE_BOX = Math.min(ACC_SCREEN_W - 48, 320);
const GLOBE_CENTER = GLOBE_BOX / 2;
const ORBIT_RADIUS = GLOBE_BOX * 0.40;
const CHIP = 44;
const GLOBE_D = Math.round(GLOBE_BOX * 0.46);   // central Earth diameter

const WORLD_MAP = require('../../assets/images/world_map.png');

// Spinning 3D Earth (equirectangular map scrolled inside a circular mask)
function SpinningGlobe() {
  const scroll = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(scroll, {
        toValue: 1, duration: 22000, easing: Easing.linear, useNativeDriver: true,
      })
    );
    loop.start();
    return () => loop.stop();
  }, []);

  const mapW = GLOBE_D * 2;   // equirectangular map is 2:1 → width = 2 × height
  const translateX = scroll.interpolate({ inputRange: [0, 1], outputRange: [0, -mapW] });

  return (
    <View style={[globeStyles.sphere, { width: GLOBE_D, height: GLOBE_D, borderRadius: GLOBE_D / 2 }]}>
      {/* Scrolling world map — two copies for a seamless loop */}
      <Animated.View
        style={{ flexDirection: 'row', width: mapW * 2, height: GLOBE_D, transform: [{ translateX }] }}
      >
        <Image source={WORLD_MAP} style={{ width: mapW, height: GLOBE_D }} resizeMode="cover" />
        <Image source={WORLD_MAP} style={{ width: mapW, height: GLOBE_D }} resizeMode="cover" />
      </Animated.View>

      {/* Limb darkening (left/right edges) → spherical curvature */}
      <LinearGradient
        colors={['rgba(2,8,20,0.65)', 'rgba(2,8,20,0)', 'rgba(2,8,20,0)', 'rgba(2,8,20,0.65)']}
        locations={[0, 0.26, 0.74, 1]}
        start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      {/* Top highlight + bottom shadow → lit-from-above sphere */}
      <LinearGradient
        colors={['rgba(255,255,255,0.28)', 'rgba(255,255,255,0)', 'rgba(2,8,20,0.45)']}
        locations={[0, 0.42, 1]}
        start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
    </View>
  );
}

type PhonemeStatus = 'mastered' | 'problem' | 'todo';

function phonemeStatus(
  phoneme: string,
  history: number[] | undefined,
  weak: string[],
): PhonemeStatus {
  const last = history && history.length ? history[history.length - 1] : undefined;
  if (last !== undefined) return last >= 75 ? 'mastered' : 'problem';
  if (weak.includes(phoneme)) return 'problem';
  return 'todo';
}

const STATUS_COLOR: Record<PhonemeStatus, string> = {
  mastered: '#0FBA9A',
  problem:  '#EF4444',
  todo:     '#8B5CF6',
};

function shortGlyph(phoneme: string): string {
  return phoneme.replace(/[\[\]\/]/g, '').split(/[\s-]/)[0] || phoneme;
}

function sentencesFor(ex: typeof PHONEME_EXERCISES[number]): string[] {
  return PHONEME_PRACTICE[ex.phoneme] ?? [ex.practice_sentence];
}

// Practice sentences per phoneme — dense in the target sound for shadowing.
const PHONEME_PRACTICE: Record<string, string[]> = {
  '/u:/-/ʊ/': [
    'The cook put good food in the cool pool.',
    'Look at the blue moon through the window.',
    'She took two books from the school room.',
    'Could you choose a good fruit juice?',
    'The wolf stood in the woods looking at the moon.',
  ],
  '/i:/-/ɪ/': [
    'He still feels ill after eating six green beans.',
    'Please sit in this seat and read the sheet.',
    'The little kitten sleeps in the green field.',
    'It is easy to see the big city lights.',
    'Three thin trees grew near the deep stream.',
  ],
  '/ð/': [
    'This is the other thing that bothers them.',
    'They gathered together with their mother and father.',
    'The weather there is better than the weather here.',
    'Either this one or that other one will do.',
    'Breathe smoothly and soothe yourself.',
  ],
  '/θ/': [
    'Think through three thousand theories thoroughly.',
    'Thank you for the birthday gift, Beth.',
    'The author thought about the truth of the myth.',
    'Three thick thorns hurt the thumb.',
    'Both paths through the forest are worth it.',
  ],
  '/æ/-/ɑ:/': [
    'My father parked the car after the bad crash.',
    'The cat sat on a mat near the calm garden.',
    'Pat had a chance to grab the last apple.',
    "Mark's car cannot start in the cold dark.",
    'The fast cab passed the large park.',
  ],
  '/ʌ/': [
    'The young monk suddenly jumped up in the muddy sun.',
    'My brother loves to run under the sun.',
    'Such a lucky duck won the money.',
    'The hungry cousin must hurry up.',
    'Trust your gut and stay tough.',
  ],
  '[ɫ] Dark L': [
    'The tall mill wall will fill with small hills.',
    'Bill felt the cold metal in the hall.',
    'Call Bill to fill the bottle well.',
    'The bell fell on the cold wall.',
    'Pull the heavy ball down the hill.',
  ],
  '/ŋ/': [
    'Singing and dancing brings amazing energy every morning.',
    'The king is bringing a strong young singer.',
    'Running and jumping make my lungs strong.',
    'Long mornings of working bring nothing.',
    'The ringing bell kept ringing all evening.',
  ],
  '[kʰ]': [
    'The kind king kept a clean, cool, quiet castle.',
    'Kate can quickly cook a clean cake.',
    'The clever kid kicked the cold can.',
    'Keep the key in a quiet corner.',
    "Carl's car key is cracked.",
  ],
  '/ə/': [
    'About a dozen of us arrived around eleven in the morning.',
    'The teacher gave a banana to the woman.',
    'A famous problem about the camera appeared.',
    'Around seven, the children awoke alone.',
    'The doctor sent a letter to the manager.',
  ],
  '[pʰ]': [
    'Peter picked a pretty pink pepper plant in the park.',
    'Paul put a paper plate on the porch.',
    'The puppy played with a purple pillow.',
    'Please pass the perfect pepperoni pizza.',
    'Pam paid for the expensive purple paint.',
  ],
  '[tʰ]': [
    'Ten tiny turtles took time to talk to Tom today.',
    'Tom took two tickets to the theater.',
    'The teacher told the students to take notes.',
    'Tina tried to type the title twice.',
    'Take time to taste the tea.',
  ],
};

// Common spellings of each phoneme (American English, source: Rachel's English
// sound chart). Helps learners recognise the sound across different spellings.
const PHONEME_SPELLINGS: Record<string, { pattern: string; example: string }[]> = {
  '/u:/-/ʊ/': [
    { pattern: 'oo', example: 'too / wood' }, { pattern: 'o', example: 'do / wolf' },
    { pattern: 'ou', example: 'you / could' }, { pattern: 'u', example: 'flute / sugar' },
    { pattern: 'ue', example: 'blue' }, { pattern: 'ui', example: 'juice / build' },
  ],
  '/i:/-/ɪ/': [
    { pattern: 'ee', example: 'weep / been' }, { pattern: 'ea', example: 'heat' },
    { pattern: 'e', example: 'be / pretty' }, { pattern: 'ie', example: 'brief' },
    { pattern: 'y', example: 'melody / symbol' }, { pattern: 'i', example: 'police / him' },
  ],
  '/ð/': [
    { pattern: 'th', example: 'those / this' },
  ],
  '/θ/': [
    { pattern: 'th', example: 'thanks / thin' },
  ],
  '/æ/-/ɑ:/': [
    { pattern: 'a', example: 'bat / father' }, { pattern: 'ai', example: 'plaid' },
    { pattern: 'au', example: 'aunt' }, { pattern: 'ea', example: 'heart' },
    { pattern: 'o', example: 'body' },
  ],
  '/ʌ/': [
    { pattern: 'u', example: 'up' }, { pattern: 'o', example: 'love' },
    { pattern: 'oo', example: 'blood' }, { pattern: 'ou', example: 'trouble' },
    { pattern: 'oe', example: 'does' },
  ],
  '[ɫ] Dark L': [
    { pattern: 'l', example: 'love' }, { pattern: 'll', example: 'million' },
  ],
  '/ŋ/': [
    { pattern: 'ng', example: 'ring' }, { pattern: 'n + k', example: 'think' },
    { pattern: 'n + g', example: 'anger' },
  ],
  '[kʰ]': [
    { pattern: 'c', example: 'cap' }, { pattern: 'k', example: 'king' },
    { pattern: 'ck', example: 'back' }, { pattern: 'ch', example: 'choir' },
    { pattern: 'q', example: 'quiet' },
  ],
  '/ə/': [
    { pattern: 'a', example: 'about' }, { pattern: 'e', example: 'anthem' },
    { pattern: 'i', example: 'possible' }, { pattern: 'o', example: 'bottom' },
    { pattern: 'ou', example: 'jealous' }, { pattern: 'u', example: 'autumn' },
  ],
  '[pʰ]': [
    { pattern: 'p', example: 'pear' }, { pattern: 'pp', example: 'happy' },
  ],
  '[tʰ]': [
    { pattern: 't', example: 'tap' }, { pattern: 'ed', example: 'tripped' },
    { pattern: 'tt', example: 'better' },
  ],
};

// TTS cues to pronounce each phoneme in isolation (American voice).
// Vowels render cleanly; consonants use a minimal schwa so the sound is produced.
const PHONEME_CUE: Record<string, string> = {
  '/u:/-/ʊ/':   'oooo',
  '/i:/-/ɪ/':   'eee',
  '/ð/':        'thuh',   // voiced TH
  '/θ/':        'th',     // unvoiced TH
  '/æ/-/ɑ:/':   'aaa',
  '/ʌ/':        'uhh',
  '[ɫ] Dark L': 'ull',
  '/ŋ/':        'ng',
  '[kʰ]':       'kuh',
  '/ə/':        'uh',
  '[pʰ]':       'puh',
  '[tʰ]':       'tuh',
};

function PhonemeGlobe({
  exercises, attemptHistory, weakPhonemes, onSelect,
}: {
  exercises: typeof PHONEME_EXERCISES;
  attemptHistory: Record<string, number[]>;
  weakPhonemes: string[];
  onSelect: (ex: typeof PHONEME_EXERCISES[number]) => void;
}) {
  const spin = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(spin, {
        toValue: 1, duration: 60000, easing: Easing.linear, useNativeDriver: true,
      })
    );
    loop.start();
    return () => loop.stop();
  }, []);

  const rotate        = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const counterRotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '-360deg'] });

  const counts = exercises.reduce(
    (acc, ex) => {
      const s = phonemeStatus(ex.phoneme, attemptHistory[ex.phoneme], weakPhonemes);
      acc[s]++; return acc;
    },
    { mastered: 0, problem: 0, todo: 0 } as Record<PhonemeStatus, number>,
  );

  return (
    <View style={globeStyles.wrap}>
      <View style={{ width: GLOBE_BOX, height: GLOBE_BOX, alignSelf: 'center' }}>
        {/* Central spinning Earth */}
        <View style={{ position: 'absolute', left: GLOBE_CENTER - GLOBE_D / 2, top: GLOBE_CENTER - GLOBE_D / 2 }}>
          <SpinningGlobe />
        </View>

        {/* Orbiting phonemes (ring rotates; chips counter-rotate to stay upright) */}
        <Animated.View style={[StyleSheet.absoluteFill, { transform: [{ rotate }] }]} pointerEvents="box-none">
          {exercises.map((ex, i) => {
            const angle = (i / exercises.length) * 2 * Math.PI - Math.PI / 2;
            const x = GLOBE_CENTER + ORBIT_RADIUS * Math.cos(angle) - CHIP / 2;
            const y = GLOBE_CENTER + ORBIT_RADIUS * Math.sin(angle) - CHIP / 2;
            const status = phonemeStatus(ex.phoneme, attemptHistory[ex.phoneme], weakPhonemes);
            const color = STATUS_COLOR[status];
            return (
              <Animated.View
                key={ex.phoneme}
                style={{ position: 'absolute', left: x, top: y, transform: [{ rotate: counterRotate }] }}
              >
                <TouchableOpacity
                  style={[globeStyles.chip, { borderColor: color, backgroundColor: color + '22' }]}
                  onPress={() => onSelect(ex)}
                  activeOpacity={0.7}
                >
                  <Text style={[globeStyles.chipText, { color }]}>{shortGlyph(ex.phoneme)}</Text>
                </TouchableOpacity>
              </Animated.View>
            );
          })}
        </Animated.View>
      </View>

      {/* Legend */}
      <View style={globeStyles.legend}>
        <View style={globeStyles.legendItem}>
          <View style={[globeStyles.legendDot, { backgroundColor: STATUS_COLOR.mastered }]} />
          <Text style={globeStyles.legendText}>Mastered {counts.mastered}</Text>
        </View>
        <View style={globeStyles.legendItem}>
          <View style={[globeStyles.legendDot, { backgroundColor: STATUS_COLOR.problem }]} />
          <Text style={globeStyles.legendText}>Needs work {counts.problem}</Text>
        </View>
        <View style={globeStyles.legendItem}>
          <View style={[globeStyles.legendDot, { backgroundColor: STATUS_COLOR.todo }]} />
          <Text style={globeStyles.legendText}>To explore {counts.todo}</Text>
        </View>
      </View>

      {/* Source attribution */}
      <Text style={globeStyles.source}>
        Globe map: Wikimedia Commons (CC BY-SA)
      </Text>
    </View>
  );
}

const globeStyles = StyleSheet.create({
  wrap: {
    backgroundColor: '#060D1A',
    borderRadius: 20,
    paddingVertical: 16,
    marginBottom: 20,
    overflow: 'hidden',
  },
  sphere: {
    overflow: 'hidden',
    backgroundColor: '#0A2540',
    borderWidth: 2.5,
    borderColor: '#8B5CF6',
    shadowColor: '#0FBA9A',
    shadowOpacity: 0.6,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 0 },
    elevation: 10,
  },

  chip: {
    width: CHIP, height: CHIP, borderRadius: CHIP / 2,
    borderWidth: 1.5,
    alignItems: 'center', justifyContent: 'center',
  },
  chipText: { fontSize: 15, fontWeight: '800', fontFamily: Platform.OS === 'ios' ? undefined : 'monospace' },

  legend: { flexDirection: 'row', justifyContent: 'center', gap: 16, marginTop: 8, flexWrap: 'wrap' },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot: { width: 9, height: 9, borderRadius: 5 },
  legendText: { color: '#C7D2E0', fontSize: 11, fontWeight: '700' },
  source: { color: '#5A6B82', fontSize: 9, fontStyle: 'italic', textAlign: 'center', marginTop: 8 },
});

export default function AccentDNAScreen() {
  const router = useRouter();
  const { updatePhonemePerformance, updateSessionMetrics, getWeakPhonemes } = useLearnerProfile();

  const [selectedExercise, setSelectedExercise] = useState(PHONEME_EXERCISES[0]);
  const [selectedWord, setSelectedWord] = useState(PHONEME_EXERCISES[0].words[0]);
  const [selectedSentence, setSelectedSentence] = useState(PHONEME_EXERCISES[0].practice_sentence);
  const [practiceMode, setPracticeMode] = useState<PracticeMode>('word');
  const [diffFilter, setDiffFilter] = useState<DiffFilter>('ALL');
  const [showHeatmap, setShowHeatmap] = useState(false);
  const [showArticulation, setShowArticulation] = useState(false);
  const [showMinimalPairs, setShowMinimalPairs] = useState(false);
  const [showSpellings, setShowSpellings] = useState(false);
  const [expandedWord, setExpandedWord] = useState<number | null>(null);
  const [savedAudioId, setSavedAudioId] = useState<string | null>(null);
  const [savedAudioPlaying, setSavedAudioPlaying] = useState(false);

  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [error, setError] = useState('');
  const [attemptHistory, setAttemptHistory] = useState<Record<string, number[]>>({});
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);

  const feedbackOpacity = useRef(new Animated.Value(0)).current;
  const feedbackScale = useRef(new Animated.Value(0.95)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const pulseOpacity = useRef(new Animated.Value(0.6)).current;
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const scrollRef = useRef<ScrollView>(null);
  const exerciseYRef = useRef(0);

  // Warm up Web Speech voices on mount; stop any playback on unmount
  useEffect(() => { warmupVoices(); return () => { stopAllPlayback(); }; }, []);

  // Load saved per-phoneme scores (demo presets seed these) so the globe shows
  // mastered / needs-work / to-explore for the selected user.
  useFocusEffect(useCallback(() => {
    AsyncStorage.getItem('vf_phoneme_scores').then(raw => {
      if (!raw) return;
      try {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') setAttemptHistory(parsed);
      } catch {}
    });
  }, []));

  // Tap a phoneme on the globe → hear the isolated sound + scroll to explanation
  const playPhonemeSound = (ex: typeof PHONEME_EXERCISES[number]) => {
    const clip = getPhonemeAudio(ex.phoneme);
    if (clip) {
      void playAudioAsset(clip);                            // 100% accurate recording
    } else {
      speakPhoneme(PHONEME_CUE[ex.phoneme] ?? ex.phoneme);  // TTS fallback (American voice)
    }
  };

  const handleGlobeSelect = (ex: typeof PHONEME_EXERCISES[number]) => {
    setSelectedExercise(ex);
    setSelectedWord(ex.words[0]);
    setSelectedSentence(sentencesFor(ex)[0]);
    setFeedback(null);
    setShowArticulation(false);
    setShowMinimalPairs(false);
    setShowSpellings(false);
    playPhonemeSound(ex);
    // Scroll down to the exercise/explanation card
    setTimeout(() => {
      scrollRef.current?.scrollTo({ y: Math.max(0, exerciseYRef.current - 12), animated: true });
    }, 180);
  };

  useEffect(() => {
    if (feedback) {
      Animated.parallel([
        Animated.timing(feedbackOpacity, { toValue: 1, duration: Animations.normal, useNativeDriver: true }),
        Animated.spring(feedbackScale, { toValue: 1, speed: 15, bounciness: 8, useNativeDriver: true }),
      ]).start();
    } else {
      feedbackOpacity.setValue(0);
      feedbackScale.setValue(0.95);
    }
  }, [feedback]);

  useEffect(() => {
    if (isRecording) {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.parallel([
            Animated.timing(pulseAnim, { toValue: 1.4, duration: 700, useNativeDriver: true }),
            Animated.timing(pulseOpacity, { toValue: 0.1, duration: 700, useNativeDriver: true }),
          ]),
          Animated.parallel([
            Animated.timing(pulseAnim, { toValue: 1, duration: 700, useNativeDriver: true }),
            Animated.timing(pulseOpacity, { toValue: 0.6, duration: 700, useNativeDriver: true }),
          ]),
        ])
      );
      loop.start();
      return () => loop.stop();
    } else {
      pulseAnim.setValue(1);
      pulseOpacity.setValue(0.6);
    }
  }, [isRecording]);

  const filteredExercises = diffFilter === 'ALL'
    ? PHONEME_EXERCISES
    : PHONEME_EXERCISES.filter(e => e.cefr === diffFilter);

  const currentHistory = attemptHistory[selectedExercise.phoneme] || [];
  const targetText = practiceMode === 'word' ? selectedWord : selectedSentence;

  const toggleSavedAudio = async () => {
    if (savedAudioPlaying) {
      await stopAudioAsset();
      setSavedAudioPlaying(false);
      return;
    }
    const mod = getDemoAudio(savedAudioId);
    if (!mod) return;
    await playAudioAsset(mod, {
      onStart: () => setSavedAudioPlaying(true),
      onEnd: () => setSavedAudioPlaying(false),
      onError: () => setSavedAudioPlaying(false),
    });
  };

  const startRecording = async () => {
    setFeedback(null);
    setError('');

    if (Platform.OS === 'web') {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const mediaRecorder = new MediaRecorder(stream);
        mediaRecorderRef.current = mediaRecorder;
        chunksRef.current = [];
        mediaRecorder.ondataavailable = (e) => chunksRef.current.push(e.data);
        mediaRecorder.start();
        setIsRecording(true);
      } catch {
        setError('Microphone access denied.');
      }
    } else {
      try {
        await Audio.requestPermissionsAsync();
        await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
        const { recording: rec } = await Audio.Recording.createAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
        setRecording(rec);
        setIsRecording(true);
      } catch {
        setError('Could not start recording.');
      }
    }
  };

  // Shared analysis routine — used by both live recording and file upload.
  const analyzeBlob = async (audioBlob: Blob, filename = 'recording.wav') => {
    try {
      const formData = new FormData();
      formData.append('audio', audioBlob, filename);
      formData.append('target_text', targetText);

      const response = await fetch(`${API_URL}/accent/analyze`, {
        method: 'POST',
        body: formData,
      });
      const data = await response.json();
      setFeedback(data);
      setExpandedWord(null);

      setAttemptHistory(prev => {
        const key = selectedExercise.phoneme;
        const existing = prev[key] || [];
        const next = { ...prev, [key]: [...existing.slice(-4), data.accuracy_score] };
        AsyncStorage.setItem('vf_phoneme_scores', JSON.stringify(next)).catch(() => {});
        return next;
      });

      await updatePhonemePerformance(selectedExercise.phoneme, data.accuracy_score);
      await updateSessionMetrics(1, 0);

      // Persist as a saved session (shows up in "Practised phrases")
      try {
        const session: AccentSession = {
          ts: Date.now(),
          target_text: targetText,
          accuracy_score: data.accuracy_score ?? 0,
          problematic_phonemes: Array.isArray(data.problematic_phonemes)
            ? data.problematic_phonemes.map((p: any) => p?.phoneme ?? String(p)).filter(Boolean).slice(0, 6)
            : [],
          exercisePhoneme: selectedExercise.phoneme,
          feedback: data,                       // full results object
        };
        const raw = await AsyncStorage.getItem('vf_accent_sessions');
        const arr = raw ? JSON.parse(raw) : [];
        await AsyncStorage.setItem('vf_accent_sessions', JSON.stringify([session, ...arr].slice(0, 50)));
      } catch {}
    } catch {
      setError('Could not analyze. Make sure the backend is running.');
    } finally {
      setLoading(false);
    }
  };

  const stopAndAnalyze = async () => {
    setIsRecording(false);
    setLoading(true);

    try {
      let audioBlob: Blob;

      if (Platform.OS === 'web') {
        const mediaRecorder = mediaRecorderRef.current!;
        await new Promise<void>((resolve) => {
          mediaRecorder.onstop = () => resolve();
          mediaRecorder.stop();
          mediaRecorder.stream.getTracks().forEach((t) => t.stop());
        });
        audioBlob = new Blob(chunksRef.current, { type: 'audio/webm' });
      } else {
        await recording!.stopAndUnloadAsync();
        const uri = recording!.getURI()!;
        setRecording(null);

        // On native, send file directly — fetch(localUri).blob() doesn't work in Expo Go
        try {
          const formData = new FormData();
          formData.append('audio', { uri, type: 'audio/m4a', name: 'recording.m4a' } as any);
          formData.append('target_text', targetText);
          const response = await fetch(`${API_URL}/accent/analyze`, { method: 'POST', body: formData });
          const data = await response.json();
          setFeedback(data);
          // persist session
          try {
            const session: any = { ts: Date.now(), target_text: targetText, accuracy_score: data.accuracy_score ?? 0, problematic_phonemes: Array.isArray(data.problematic_phonemes) ? data.problematic_phonemes : [], feedback: data };
            const raw = await AsyncStorage.getItem('vf_accent_sessions');
            const existing = raw ? JSON.parse(raw) : [];
            await AsyncStorage.setItem('vf_accent_sessions', JSON.stringify([session, ...existing].slice(0, 50)));
          } catch {}
        } catch {
          setError('Could not analyze. Make sure the backend is running.');
        } finally {
          setLoading(false);
        }
        return;
      }

      await analyzeBlob(audioBlob);
    } catch {
      setError('Could not analyze. Make sure the backend is running.');
      setLoading(false);
    }
  };

  // Upload a pre-recorded audio file instead of recording live
  const openFilePicker = () => {
    if (Platform.OS === 'web') {
      fileInputRef.current?.click();
    } else {
      setError('Upload is available in the web version. Use the microphone on mobile.');
    }
  };

  const handleFileSelected = async (e: any) => {
    const file: File | undefined = e?.target?.files?.[0];
    if (e?.target) e.target.value = '';
    if (!file) return;

    if (!file.type.startsWith('audio/') && !/\.(mp3|wav|m4a|ogg|webm|flac|aac)$/i.test(file.name)) {
      setError('Please select an audio file (MP3, WAV, M4A, OGG, WebM).');
      return;
    }
    if (file.size > 15 * 1024 * 1024) {
      setError('File too large (max 15 MB). Trim the clip and try again.');
      return;
    }

    setError('');
    setFeedback(null);
    setUploadedFileName(file.name);
    setLoading(true);
    await analyzeBlob(file, file.name);
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return '#0FBA9A';
    if (score >= 60) return '#8B5CF6';
    return '#EF4444';
  };

  const getSeverityColor = (severity: string) => {
    if (severity === 'high') return '#EF4444';
    if (severity === 'medium') return '#8B5CF6';
    return '#0FBA9A';
  };

  return (
    <View style={styles.root}>
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Feather name="chevron-left" size={18} color={Colors.light.tint} />
            <Text style={styles.backText}>Back</Text>
          </TouchableOpacity>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Feather name="activity" size={14} color={Colors.light.tint} />
            <Text style={styles.headerBadge}>Accent DNA</Text>
          </View>
        </View>

        <SectionHero
          art={Illustrations.accent}
          title="Accent DNA"
          subtitle="Romanian-English phoneme interference training. Target your exact weak spots."
        />

        {/* Phoneme globe — visual map of progress */}
        <PhonemeGlobe
          exercises={PHONEME_EXERCISES}
          attemptHistory={attemptHistory}
          weakPhonemes={getWeakPhonemes()}
          onSelect={handleGlobeSelect}
        />

        {/* Heatmap toggle */}
        <TouchableOpacity
          style={styles.heatmapToggleBtn}
          onPress={() => setShowHeatmap(!showHeatmap)}
        >
          <Feather name="grid" size={18} color={Colors.light.tint} />
          <View style={styles.heatmapToggleContent}>
            <Text style={styles.heatmapToggleText}>
              {showHeatmap ? 'Hide' : 'Show'} Phoneme Overview
            </Text>
            <Text style={styles.heatmapToggleDesc}>All 12 phonemes — tap to jump to one</Text>
          </View>
          <Text style={styles.heatmapChevron}>{showHeatmap ? '▲' : '▼'}</Text>
        </TouchableOpacity>

        {/* Inline heatmap grid */}
        {showHeatmap && (
          <View style={styles.heatmapGrid}>
            {PHONEME_EXERCISES.map(ex => {
              const history = attemptHistory[ex.phoneme] || [];
              const lastScore = history[history.length - 1];
              return (
                <TouchableOpacity
                  key={ex.phoneme}
                  style={[styles.heatmapCell, { backgroundColor: ex.color + '20', borderColor: ex.color + '60' }]}
                  onPress={() => {
                    setSelectedExercise(ex);
                    setSelectedWord(ex.words[0]);
                    setSelectedSentence(sentencesFor(ex)[0]);
                    setFeedback(null);
                    setShowHeatmap(false);
                  }}
                >
                  <Text style={[styles.heatmapCellPhoneme, { color: ex.color }]}>{ex.phoneme}</Text>
                  <Text style={styles.heatmapCellCefr}>{ex.cefr}</Text>
                  {lastScore !== undefined && (
                    <Text style={[styles.heatmapCellScore, { color: getScoreColor(lastScore) }]}>{lastScore}%</Text>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* Previously practised — tap to open the full results */}
        <SavedSessions<AccentSession>
          storageKey="vf_accent_sessions"
          title="Practised phrases"
          accent={Colors.light.tint}
          getLabel={(s) => s.target_text}
          getScore={(s) => s.accuracy_score}
          getTs={(s) => s.ts}
          getMeta={(s) => s.problematic_phonemes.length
            ? `Tricky sounds: ${s.problematic_phonemes.join('  ')}`
            : undefined}
          onPress={(s) => {
            const ex = PHONEME_EXERCISES.find((e) => e.phoneme === s.exercisePhoneme);
            if (ex) setSelectedExercise(ex);
            setPracticeMode('sentence');
            setSelectedSentence(s.target_text);
            setFeedback(s.feedback as unknown as Feedback);
            setExpandedWord(null);
            setError('');
            stopAudioAsset();
            setSavedAudioPlaying(false);
            setSavedAudioId(s.audioId ?? null);
            setTimeout(() => {
              scrollRef.current?.scrollTo({ y: Math.max(0, exerciseYRef.current - 12), animated: true });
            }, 150);
          }}
        />

        {/* Difficulty filter */}
        <View style={styles.filterRow}>
          {(['ALL', 'B1', 'B2', 'C1'] as DiffFilter[]).map(d => (
            <TouchableOpacity
              key={d}
              style={[styles.filterChip, diffFilter === d && styles.filterChipActive]}
              onPress={() => setDiffFilter(d)}
            >
              <Text style={[styles.filterChipText, diffFilter === d && styles.filterChipTextActive]}>{d}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Phoneme selector */}
        <Text style={styles.sectionLabel}>SELECT PHONEME</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.phonemeScroll}>
          {filteredExercises.map((ex) => {
            const history = attemptHistory[ex.phoneme] || [];
            const lastScore = history[history.length - 1];
            return (
              <TouchableOpacity
                key={ex.phoneme}
                style={[
                  styles.phonemeChip,
                  selectedExercise.phoneme === ex.phoneme && {
                    backgroundColor: ex.color + '25',
                    borderColor: ex.color,
                  },
                ]}
                onPress={() => {
                  setSelectedExercise(ex);
                  setSelectedWord(ex.words[0]);
                  setSelectedSentence(sentencesFor(ex)[0]);
                  setFeedback(null);
                  setShowArticulation(false);
                  setShowMinimalPairs(false);
                  setShowSpellings(false);
                }}
              >
                <Text style={[styles.phonemeChipText, selectedExercise.phoneme === ex.phoneme && { color: ex.color }]}>
                  {ex.phoneme}
                </Text>
                <Text style={styles.phonemeChipDesc}>{ex.description}</Text>
                <View style={styles.phonemeChipMeta}>
                  <Text style={[styles.phonemeChipCefr, { color: ex.color }]}>{ex.cefr}</Text>
                  {lastScore !== undefined && (
                    <Text style={[styles.phonemeChipScore, { color: getScoreColor(lastScore) }]}>{lastScore}%</Text>
                  )}
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Exercise card */}
        <View
          style={[styles.exerciseCard, { borderColor: selectedExercise.color + '50' }]}
          onLayout={(e) => { exerciseYRef.current = e.nativeEvent.layout.y; }}
        >
          <View style={[styles.cardAccentLine, { backgroundColor: selectedExercise.color }]} />
          <View style={styles.exerciseContent}>
            {/* IPA */}
            <View style={styles.ipaRow}>
              <View style={[styles.ipaBadge, { backgroundColor: selectedExercise.color + '20', borderColor: selectedExercise.color + '50' }]}>
                <Text style={[styles.ipaText, { color: selectedExercise.color }]}>{selectedExercise.ipa}</Text>
              </View>
              <View style={[styles.cefrBadge, { backgroundColor: selectedExercise.color + '15' }]}>
                <Text style={[styles.cefrText, { color: selectedExercise.color }]}>{selectedExercise.cefr}</Text>
              </View>
            </View>

            <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
              <Feather name="zap" size={14} color={Colors.light.tint} style={{ marginTop: 2 }} />
              <Text style={[styles.tipText, { flex: 1 }]}>{selectedExercise.tip}</Text>
            </View>

            {/* Romanian error pattern — Măchiță (2021) */}
            {selectedExercise.romanian_error && (
              <View style={styles.romanianErrorBox}>
                <View style={styles.romanianErrorHeader}>
                  <Feather name="alert-triangle" size={14} color={Colors.light.warning} />
                  <Text style={styles.romanianErrorTitle}>Typical Romanian error</Text>
                </View>
                <Text style={styles.romanianErrorSubstitute}>
                  {selectedExercise.romanian_error.substitute}
                </Text>
                <Text style={styles.romanianErrorWhy}>
                  {selectedExercise.romanian_error.why}
                </Text>
                <Text style={styles.romanianErrorSource}>
                  Măchiță (2021) · Selinker (1972) Interlanguage Theory · Brannen (2011) Auditory Distance Model
                </Text>
              </View>
            )}

            {/* Articulation guide — structured visual steps */}
            <TouchableOpacity
              style={styles.expandableHeader}
              onPress={() => setShowArticulation(!showArticulation)}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
                <Feather name="mic" size={14} color={Colors.light.textSecondary} />
                <Text style={styles.expandableTitle}>Mouth Position Guide</Text>
              </View>
              <Text style={styles.expandableChevron}>{showArticulation ? '▲' : '▼'}</Text>
            </TouchableOpacity>
            {showArticulation && (
              <View style={[styles.expandableBody, { borderColor: selectedExercise.color + '30', gap: 0 }]}>
                {selectedExercise.articulation
                  .split(/(?<=[.!?])\s+/)
                  .filter(s => s.trim().length > 4)
                  .map((sentence, i) => {
                    const s = sentence.trim();
                    const icon: React.ComponentProps<typeof Feather>['name'] =
                      /tongue/i.test(s)              ? 'move' :
                      /lip/i.test(s)                 ? 'mic' :
                      /teeth|dental|tooth/i.test(s)  ? 'align-center' :
                      /air|breath|puff|aspir|paper|flutter/i.test(s) ? 'wind' :
                      /voice|vibrat|throat/i.test(s) ? 'volume-2' :
                      /jaw|mouth|open/i.test(s)      ? 'chevron-down' :
                      /back.*tongue|tongue.*back|soft palate|velar/i.test(s) ? 'corner-down-left' : 'arrow-right';
                    const accent = selectedExercise.color;
                    return (
                      <View key={i} style={[styles.artStep, { borderLeftColor: accent }]}>
                        <Feather name={icon} size={13} color={accent} />
                        <Text style={styles.artStepText}>{s}</Text>
                      </View>
                    );
                  })}
                <View style={[styles.artTipRow, { backgroundColor: selectedExercise.color + '12' }]}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                    <Feather name="zap" size={12} color={selectedExercise.color} />
                    <Text style={styles.artTipLabel}>KEY TIP</Text>
                  </View>
                  <Text style={[styles.artTipText, { color: selectedExercise.color }]}>{selectedExercise.tip}</Text>
                </View>
              </View>
            )}

            {/* Expandable minimal pairs */}
            <TouchableOpacity
              style={styles.expandableHeader}
              onPress={() => setShowMinimalPairs(!showMinimalPairs)}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
                <Feather name="shuffle" size={14} color={Colors.light.textSecondary} />
                <Text style={styles.expandableTitle}>Minimal Pairs</Text>
              </View>
              <Text style={styles.expandableChevron}>{showMinimalPairs ? '▲' : '▼'}</Text>
            </TouchableOpacity>
            {showMinimalPairs && (
              <View style={[styles.expandableBody, { borderColor: selectedExercise.color + '30' }]}>
                {selectedExercise.minimal_pairs.map((pair, i) => (
                  <View key={i} style={styles.minimalPairRow}>
                    <View style={[styles.minimalPairWord, { backgroundColor: selectedExercise.color + '20' }]}>
                      <Text style={[styles.minimalPairText, { color: selectedExercise.color }]}>{pair[0]}</Text>
                    </View>
                    <Text style={styles.minimalPairVs}>vs</Text>
                    <View style={[styles.minimalPairWord, { backgroundColor: '#64748b20' }]}>
                      <Text style={[styles.minimalPairText, { color: '#64748b' }]}>{pair[1]}</Text>
                    </View>
                  </View>
                ))}
              </View>
            )}

            {/* Expandable spellings — how this sound is written (Rachel's English) */}
            {PHONEME_SPELLINGS[selectedExercise.phoneme] && (
              <>
                <TouchableOpacity
                  style={styles.expandableHeader}
                  onPress={() => setShowSpellings(!showSpellings)}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
                    <Feather name="type" size={14} color={Colors.light.textSecondary} />
                    <Text style={styles.expandableTitle}>How this sound is spelled</Text>
                  </View>
                  <Text style={styles.expandableChevron}>{showSpellings ? '▲' : '▼'}</Text>
                </TouchableOpacity>
                {showSpellings && (
                  <View style={[styles.expandableBody, { borderColor: selectedExercise.color + '30' }]}>
                    {PHONEME_SPELLINGS[selectedExercise.phoneme].map((sp, i) => (
                      <View key={i} style={styles.spellingRow}>
                        <View style={[styles.spellingPattern, { backgroundColor: selectedExercise.color + '20' }]}>
                          <Text style={[styles.spellingPatternText, { color: selectedExercise.color }]}>{sp.pattern}</Text>
                        </View>
                        <Text style={styles.spellingExample}>{sp.example}</Text>
                      </View>
                    ))}
                    <Text style={styles.spellingSource}>Source: Rachel&apos;s English sound chart (American English)</Text>
                  </View>
                )}
              </>
            )}

            {/* Practice mode toggle */}
            <View style={styles.modeToggle}>
              <TouchableOpacity
                style={[styles.modeBtn, practiceMode === 'word' && styles.modeBtnActive]}
                onPress={() => { setPracticeMode('word'); setFeedback(null); }}
              >
                <Text style={[styles.modeBtnText, practiceMode === 'word' && styles.modeBtnTextActive]}>Single Word</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modeBtn, practiceMode === 'sentence' && styles.modeBtnActive]}
                onPress={() => { setPracticeMode('sentence'); setFeedback(null); }}
              >
                <Text style={[styles.modeBtnText, practiceMode === 'sentence' && styles.modeBtnTextActive]}>Full Sentence</Text>
              </TouchableOpacity>
            </View>

            {practiceMode === 'word' && (
              <>
                <Text style={styles.wordLabel}>Pick a word to practice:</Text>
                <View style={styles.wordsRow}>
                  {selectedExercise.words.map((word) => (
                    <TouchableOpacity
                      key={word}
                      style={[
                        styles.wordChip,
                        selectedWord === word && {
                          backgroundColor: selectedExercise.color + '25',
                          borderColor: selectedExercise.color,
                        },
                      ]}
                      onPress={() => { setSelectedWord(word); setFeedback(null); }}
                    >
                      <Text style={[styles.wordChipText, selectedWord === word && { color: selectedExercise.color }]}>
                        {word}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            )}

            {practiceMode === 'sentence' && (
              <>
                <Text style={styles.sentenceLabel}>Pick a sentence to practice:</Text>
                <View style={{ gap: 8 }}>
                  {sentencesFor(selectedExercise).map((s, i) => {
                    const selected = selectedSentence === s;
                    return (
                      <TouchableOpacity
                        key={i}
                        style={[
                          styles.sentenceOption,
                          { borderColor: selected ? selectedExercise.color : Colors.light.border },
                          selected && { backgroundColor: selectedExercise.color + '12' },
                        ]}
                        onPress={() => { setSelectedSentence(s); setFeedback(null); }}
                        activeOpacity={0.75}
                      >
                        <Text style={[
                          styles.sentenceOptionText,
                          selected && { color: selectedExercise.color, fontWeight: '600' },
                        ]}>
                          "{s}"
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </>
            )}
          </View>
        </View>

        {/* Session attempt history */}
        {currentHistory.length > 0 && (
          <View style={styles.historyCard}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <Feather name="bar-chart-2" size={15} color={Colors.light.tint} />
              <Text style={styles.historyTitle}>Your Attempts This Session</Text>
            </View>
            <View style={styles.historyBars}>
              {currentHistory.map((score, i) => (
                <View key={i} style={styles.historyBarItem}>
                  <View style={styles.historyBarBg}>
                    <View
                      style={[
                        styles.historyBarFill,
                        { height: `${score}%` as any, backgroundColor: getScoreColor(score) },
                      ]}
                    />
                  </View>
                  <Text style={[styles.historyBarLabel, { color: getScoreColor(score) }]}>{score}%</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Recording section */}
        <View style={styles.recordSection}>
          <Text style={styles.recordInstruction}>
            Say:{' '}
            <Text style={styles.targetWord}>"{targetText}"</Text>
          </Text>

          <View style={styles.recordBtnWrapper}>
            <Animated.View
              style={[
                styles.pulseBg,
                { transform: [{ scale: pulseAnim }], opacity: pulseOpacity },
              ]}
            />
            <TouchableOpacity
              style={[styles.recordBtn, isRecording && styles.recordBtnActive]}
              onPress={isRecording ? stopAndAnalyze : startRecording}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" size="large" />
              ) : (
                <>
                  <Feather name={isRecording ? 'square' : 'mic'} size={28} color="#fff" />
                  <Text style={styles.recordBtnText}>
                    {isRecording ? 'Stop & Analyze' : 'Start Recording'}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>

          {isRecording && (
            <View style={styles.recordingIndicator}>
              <View style={styles.recordingDot} />
              <Text style={styles.recordingText}>Recording... speak clearly!</Text>
            </View>
          )}

          {/* Upload alternative */}
          {!isRecording && (
            <View style={styles.uploadWrap}>
              <View style={styles.uploadDivider}>
                <View style={styles.uploadDividerLine} />
                <Text style={styles.uploadDividerText}>or</Text>
                <View style={styles.uploadDividerLine} />
              </View>

              {Platform.OS === 'web' && (
                // @ts-ignore — RN-Web renders DOM input
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="audio/*,.mp3,.wav,.m4a,.ogg,.webm,.flac,.aac"
                  onChange={handleFileSelected}
                  style={{ display: 'none' }}
                />
              )}

              <TouchableOpacity
                style={styles.uploadBtn}
                onPress={openFilePicker}
                disabled={loading}
                activeOpacity={0.85}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Feather name="upload" size={15} color={Colors.light.tint} />
                  <Text style={styles.uploadBtnText}>Upload a recording instead</Text>
                </View>
              </TouchableOpacity>

              {uploadedFileName && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Feather name="paperclip" size={12} color={Colors.light.textSecondary} />
                  <Text style={styles.uploadFileName} numberOfLines={1}>{uploadedFileName}</Text>
                </View>
              )}
              {Platform.OS !== 'web' && (
                <Text style={styles.uploadHint}>Upload works in the web version.</Text>
              )}
            </View>
          )}
        </View>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        {/* Feedback */}
        {feedback && (
          <Animated.View
            style={[styles.feedbackSection, { opacity: feedbackOpacity, transform: [{ scale: feedbackScale }] }]}
          >
            {/* Score ring */}
            <View style={styles.scoreCardOuter}>
              <ScoreRing score={feedback.accuracy_score} />
              <View style={styles.scoreCardMeta}>
                {feedback.alignment && feedback.alignment.length > 0 ? (
                  // Phoneme path — raw IPA isn't readable, so show the words they
                  // tried + let the colour-coded breakdown below tell the story.
                  <Text style={styles.targetLabel}>
                    You tried to say:{' '}
                    <Text style={styles.targetTextDisplay}>"{targetText}"</Text>
                  </Text>
                ) : (
                  <>
                    <Text style={styles.transcribedLabel}>
                      You said:{' '}
                      <Text style={styles.transcribedText}>"{feedback.transcribed_text}"</Text>
                    </Text>
                    <Text style={styles.targetLabel}>
                      Target:{' '}
                      <Text style={styles.targetTextDisplay}>"{targetText}"</Text>
                    </Text>
                    {feedback.similarity && (
                      <Text style={styles.similarityLine}>
                        Word match {feedback.similarity.word}% · sound match {feedback.similarity.char}%
                      </Text>
                    )}
                  </>
                )}
              </View>
            </View>

            {/* Play the saved recording (cloned voice, level-calibrated) */}
            {savedAudioId && (
              <TouchableOpacity style={styles.playRecBtn} onPress={toggleSavedAudio} activeOpacity={0.85}>
                <Feather name={savedAudioPlaying ? 'pause' : 'play'} size={18} color={Colors.light.tint} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.playRecText}>
                    {savedAudioPlaying ? 'Playing recording…' : 'Play your recording'}
                  </Text>
                  <Text style={styles.playRecSub}>How you pronounced this phrase</Text>
                </View>
                <Text style={styles.playRecBadge}>REC</Text>
              </TouchableOpacity>
            )}

            {/* Word-level breakdown (readable — no IPA unless you tap) */}
            {feedback.word_breakdown && feedback.word_breakdown.length > 0 && (
              <View style={styles.phonemeBreakdown}>
                <View style={styles.phonemeBreakdownHead}>
                  <Text style={styles.overallTitle}>Word Breakdown</Text>
                  {feedback.engine && (
                    <Text style={styles.engineBadge}>{feedback.engine}</Text>
                  )}
                </View>
                <Text style={styles.phonemeBreakdownHint}>
                  Green = pronounced well, red = needs work. Tap a word to see the sounds.
                </Text>
                <View style={styles.wordStrip}>
                  {feedback.word_breakdown.map((w, i) => {
                    const ratio = w.total > 0 ? w.correct / w.total : 1;
                    const color = w.ok ? '#0FBA9A' : ratio >= 0.5 ? '#8B5CF6' : '#EF4444';
                    const isOpen = expandedWord === i;
                    return (
                      <TouchableOpacity
                        key={i}
                        style={[styles.wordChip2, { borderColor: color, backgroundColor: color + '18' }]}
                        onPress={() => setExpandedWord(isOpen ? null : i)}
                        activeOpacity={0.7}
                      >
                        <Text style={[styles.wordChip2Text, { color }]}>{w.word}</Text>
                        {w.total > 0 && (
                          <Text style={styles.wordChip2Sub}>{w.correct}/{w.total}</Text>
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {/* Tapped word → show its sounds (IPA), colour-coded */}
                {expandedWord !== null && feedback.word_breakdown[expandedWord]?.phonemes && (
                  <View style={styles.wordDetail}>
                    <Text style={styles.wordDetailTitle}>
                      Sounds in “{feedback.word_breakdown[expandedWord].word}”:
                    </Text>
                    <View style={styles.phonemeStrip}>
                      {feedback.word_breakdown[expandedWord].phonemes!.map((ph, k) => (
                        <View key={k} style={ph.ok ? styles.phonemeChipOk : styles.phonemeChipBad}>
                          <Text style={ph.ok ? styles.phonemeChipOkText : styles.phonemeChipBadText}>{ph.p}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                )}
              </View>
            )}

            {/* Intelligibility note — honest scoring caveat */}
            {feedback.intelligibility_only && (
              <View style={styles.intelNote}>
                <Text style={styles.intelNoteText}>
                  Your speech was intelligible (the recogniser understood the words).
                  Exact phoneme accuracy can&apos;t be verified from speech recognition alone,
                  so the score reflects intelligibility — keep practising the highlighted sounds.
                </Text>
              </View>
            )}

            {/* Overall feedback */}
            <View style={styles.overallCard}>
              <Text style={styles.overallTitle}>Overall Feedback</Text>
              <Text style={styles.overallText}>{feedback.overall_feedback}</Text>
            </View>

            {/* Problematic phonemes */}
            {feedback.problematic_phonemes?.length > 0 && (
              <View style={styles.issuesCard}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
                  <Feather name="alert-triangle" size={14} color={Colors.light.warning} />
                  <Text style={styles.issuesTitle}>Phonemes to Work On</Text>
                </View>
                {feedback.problematic_phonemes.map((p, i) => (
                  <View key={i} style={[styles.phonemeIssueRow, { borderColor: getSeverityColor(p.severity) + '30' }]}>
                    <View style={[styles.phonemeIssueBadge, { backgroundColor: getSeverityColor(p.severity) + '20' }]}>
                      <Text style={[styles.phonemeIssueLabel, { color: getSeverityColor(p.severity) }]}>{p.phoneme}</Text>
                    </View>
                    <Text style={styles.phonemeExample}>{p.example}</Text>
                    <View style={[styles.severityBadge, { backgroundColor: getSeverityColor(p.severity) + '20' }]}>
                      <Text style={[styles.severityText, { color: getSeverityColor(p.severity) }]}>{p.severity}</Text>
                    </View>
                  </View>
                ))}
              </View>
            )}

            {/* Suggestions */}
            {feedback.suggestions?.length > 0 && (
              <View style={styles.suggestionsCard}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
                  <Feather name="zap" size={14} color={Colors.light.tint} />
                  <Text style={styles.suggestionsTitle}>How to Improve</Text>
                </View>
                {feedback.suggestions.map((s, i) => (
                  <View key={i} style={styles.suggestionItem}>
                    <Text style={styles.suggestionIssue}>{s.issue}</Text>
                    <Text style={styles.suggestionFix}>→ {s.fix}</Text>
                  </View>
                ))}
              </View>
            )}

            <View style={styles.actionRow}>
              <TouchableOpacity
                style={styles.tryAgainBtn}
                onPress={() => { setFeedback(null); setError(''); stopAudioAsset(); setSavedAudioPlaying(false); setSavedAudioId(null); }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
                  <Feather name="rotate-ccw" size={14} color={Colors.light.tint} />
                  <Text style={styles.tryAgainText}>Try Again</Text>
                </View>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.nextWordBtn}
                onPress={() => {
                  const idx = selectedExercise.words.indexOf(selectedWord);
                  const next = selectedExercise.words[(idx + 1) % selectedExercise.words.length];
                  setSelectedWord(next);
                  setFeedback(null);
                }}
              >
                <Text style={styles.nextWordText}>Next Word →</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        )}

        <View style={{ height: 48 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.light.background },
  scrollContent: { paddingHorizontal: 20, paddingTop: 56, maxWidth: 900, width: '100%', alignSelf: 'center' },

  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 1, paddingVertical: 6, paddingRight: 12 },
  backText: { color: Colors.light.tint, fontSize: 15, fontWeight: '600' },
  headerBadge: { fontSize: 13, fontWeight: '700', color: Colors.light.tint },

  pageTitle: { color: Colors.light.text, fontSize: 26, fontWeight: '700', letterSpacing: -0.4, marginBottom: 6 },
  pageSubtitle: { color: Colors.light.textSecondary, fontSize: 14, lineHeight: 20, marginBottom: 20 },
  moduleHero: { width: '88%', height: 165, alignSelf: 'center', marginBottom: 18 },

  heatmapToggleBtn: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.light.surface,
    borderRadius: 14, borderWidth: 2, borderColor: Colors.light.tint,
    paddingHorizontal: 16, paddingVertical: 14,
    marginBottom: 16, gap: 12,
  },
  heatmapToggleIcon: { fontSize: 22 },
  heatmapToggleContent: { flex: 1 },
  heatmapToggleText: { color: Colors.light.text, fontSize: 14, fontWeight: '700' },
  heatmapToggleDesc: { color: Colors.light.textSecondary, fontSize: 12, marginTop: 2 },
  heatmapChevron: { color: Colors.light.tint, fontSize: 12, fontWeight: '700' },

  heatmapGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 8,
    marginBottom: 20,
    backgroundColor: Colors.light.surface,
    borderRadius: 16, padding: 14,
    borderWidth: 1, borderColor: Colors.light.border,
  },
  heatmapCell: {
    width: '30%', borderRadius: 10, borderWidth: 1,
    paddingVertical: 10, paddingHorizontal: 8, alignItems: 'center', gap: 2,
  },
  heatmapCellPhoneme: { fontSize: 13, fontWeight: '800' },
  heatmapCellCefr: { fontSize: 9, color: Colors.light.textSecondary, fontWeight: '600' },
  heatmapCellScore: { fontSize: 10, fontWeight: '700' },

  filterRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  filterChip: {
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 10,
    borderWidth: 1, borderColor: Colors.light.border, backgroundColor: Colors.light.surface,
  },
  filterChipActive: { backgroundColor: Colors.light.tint, borderColor: Colors.light.tint },
  filterChipText: { fontSize: 12, fontWeight: '700', color: Colors.light.textSecondary },
  filterChipTextActive: { color: '#fff' },

  sectionLabel: { color: Colors.light.textSecondary, fontSize: 11, fontWeight: '700', letterSpacing: 1, marginBottom: 10 },
  phonemeScroll: { marginBottom: 20 },
  phonemeChip: {
    backgroundColor: Colors.light.surface,
    borderRadius: 14, borderWidth: 1, borderColor: Colors.light.border,
    paddingHorizontal: 14, paddingVertical: 10, marginRight: 10, minWidth: 110,
  },
  phonemeChipText: { color: Colors.light.textSecondary, fontSize: 16, fontWeight: '700' },
  phonemeChipDesc: { color: Colors.light.textLight, fontSize: 10, marginTop: 2 },
  phonemeChipMeta: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  phonemeChipCefr: { fontSize: 10, fontWeight: '700' },
  phonemeChipScore: { fontSize: 10, fontWeight: '700' },

  exerciseCard: {
    backgroundColor: Colors.light.surface,
    borderRadius: 18, borderWidth: 1,
    overflow: 'hidden', marginBottom: 20,
  },
  cardAccentLine: { height: 4 },
  exerciseContent: { padding: 18, gap: 12 },

  ipaRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  ipaBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10, borderWidth: 1 },
  ipaText: { fontSize: 16, fontWeight: '800', fontFamily: 'monospace' },
  cefrBadge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10 },
  cefrText: { fontSize: 11, fontWeight: '700' },

  tipText: { color: Colors.light.textSecondary, fontSize: 13, lineHeight: 19 },

  expandableHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 8, borderTopWidth: 1, borderTopColor: Colors.light.border,
  },
  expandableTitle: { color: Colors.light.text, fontSize: 13, fontWeight: '700' },
  expandableChevron: { color: Colors.light.textSecondary, fontSize: 11 },
  expandableBody: {
    backgroundColor: Colors.light.background,
    borderRadius: 10, padding: 12, borderWidth: 1, gap: 6,
  },
  articulationText: { color: Colors.light.textSecondary, fontSize: 13, lineHeight: 19 },
  artStep: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    paddingVertical: 8, borderLeftWidth: 3, paddingLeft: 10, marginBottom: 4,
  },
  artStepIcon: { fontSize: 18, width: 24, textAlign: 'center', marginTop: 1 },
  artStepText: { flex: 1, fontSize: 13, color: Colors.light.text, lineHeight: 20 },
  artTipRow: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    borderRadius: 8, padding: 10, marginTop: 8,
  },
  artTipLabel: { fontSize: 10, fontWeight: '800', color: '#64748B', letterSpacing: 0.6, marginTop: 2 },
  artTipText: { flex: 1, fontSize: 13, fontWeight: '700', lineHeight: 19 },

  minimalPairRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  minimalPairWord: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  minimalPairText: { fontSize: 14, fontWeight: '700' },
  minimalPairVs: { color: Colors.light.textSecondary, fontSize: 12, fontWeight: '600' },

  spellingRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 6 },
  spellingPattern: {
    minWidth: 48, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, alignItems: 'center',
  },
  spellingPatternText: { fontSize: 14, fontWeight: '800', fontFamily: Platform.OS === 'ios' ? undefined : 'monospace' },
  spellingExample: { flex: 1, fontSize: 13, color: Colors.light.textSecondary, fontWeight: '500' },
  spellingSource: { fontSize: 10, color: Colors.light.textLight, fontStyle: 'italic', marginTop: 6 },

  modeToggle: {
    flexDirection: 'row', gap: 8,
    backgroundColor: Colors.light.background,
    borderRadius: 12, padding: 3,
  },
  modeBtn: {
    flex: 1, paddingVertical: 9, alignItems: 'center', borderRadius: 10,
  },
  modeBtnActive: { backgroundColor: Colors.light.tint },
  modeBtnText: { fontSize: 12, fontWeight: '700', color: Colors.light.textSecondary },
  modeBtnTextActive: { color: '#fff' },

  wordLabel: { color: Colors.light.textSecondary, fontSize: 12, fontWeight: '600' },
  wordsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  wordChip: {
    backgroundColor: Colors.light.surface,
    borderRadius: 10, borderWidth: 1, borderColor: Colors.light.border,
    paddingHorizontal: 14, paddingVertical: 8,
  },
  wordChipText: { color: Colors.light.textSecondary, fontSize: 14, fontWeight: '600' },

  sentenceBox: {
    backgroundColor: Colors.light.background,
    borderRadius: 12, borderWidth: 1,
    padding: 14, gap: 6,
  },
  sentenceLabel: { color: Colors.light.textSecondary, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', marginBottom: 8 },
  sentenceText: { color: Colors.light.text, fontSize: 14, lineHeight: 21, fontWeight: '500' },
  sentenceOption: {
    backgroundColor: Colors.light.background,
    borderRadius: 12, borderWidth: 1.5,
    paddingHorizontal: 14, paddingVertical: 11,
  },
  sentenceOptionText: { color: Colors.light.text, fontSize: 14, lineHeight: 20 },

  historyCard: {
    backgroundColor: Colors.light.surface,
    borderRadius: 14, padding: 16, borderWidth: 1, borderColor: Colors.light.border,
    marginBottom: 16, gap: 10,
  },
  historyTitle: { color: Colors.light.text, fontSize: 14, fontWeight: '700' },
  historyBars: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, height: 60 },
  historyBarItem: { alignItems: 'center', gap: 4, flex: 1 },
  historyBarBg: {
    width: '100%', height: 50,
    backgroundColor: Colors.light.border,
    borderRadius: 4, overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  historyBarFill: { width: '100%', borderRadius: 4 },
  historyBarLabel: { fontSize: 10, fontWeight: '700' },

  recordSection: { alignItems: 'center', marginBottom: 20, gap: 14 },
  recordInstruction: { color: Colors.light.textSecondary, fontSize: 14, textAlign: 'center' },
  targetWord: { color: Colors.light.text, fontWeight: '700', fontSize: 15 },
  recordBtnWrapper: { alignItems: 'center', justifyContent: 'center', width: 140, height: 140 },
  pulseBg: {
    position: 'absolute',
    width: 130, height: 130, borderRadius: 65,
    backgroundColor: Colors.light.error,
  },
  recordBtn: {
    width: 120, height: 120, borderRadius: 60,
    backgroundColor: Colors.light.tint,
    alignItems: 'center', justifyContent: 'center',
    gap: 4,
    shadowColor: Colors.light.tint,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  recordBtnActive: { backgroundColor: Colors.light.error },
  recordIcon: { fontSize: 32, color: '#fff' },
  recordBtnText: { color: '#fff', fontSize: 11, fontWeight: '700', textAlign: 'center' },
  recordingIndicator: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  recordingDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.light.error },
  recordingText: { color: Colors.light.error, fontSize: 13, fontWeight: '600' },

  errorText: { color: Colors.light.error, fontSize: 13, marginBottom: 12, textAlign: 'center' },

  // Upload alternative
  uploadWrap: { width: '100%', gap: 8, marginTop: 4 },
  uploadDivider: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  uploadDividerLine: { flex: 1, height: 1, backgroundColor: Colors.light.border },
  uploadDividerText: { fontSize: 12, color: Colors.light.textSecondary, fontWeight: '600' },
  uploadBtn: {
    alignItems: 'center', justifyContent: 'center',
    paddingVertical: 13, borderRadius: 14,
    borderWidth: 1.5, borderColor: Colors.light.tint + '60',
    borderStyle: 'dashed',
    backgroundColor: Colors.light.tint + '0C',
  },
  uploadBtnText: { color: Colors.light.tint, fontSize: 14, fontWeight: '700' },
  uploadFileName: { color: Colors.light.tint, fontSize: 12, fontWeight: '600', textAlign: 'center' },
  uploadHint: { color: Colors.light.textLight, fontSize: 11, fontStyle: 'italic', textAlign: 'center' },

  feedbackSection: { gap: 14 },

  scoreCardOuter: {
    backgroundColor: Colors.light.surface,
    borderRadius: 18, padding: 20, borderWidth: 1, borderColor: Colors.light.border,
    flexDirection: 'row', alignItems: 'center', gap: 20,
  },
  scoreCardMeta: { flex: 1, gap: 6 },
  transcribedLabel: { color: Colors.light.textSecondary, fontSize: 13 },
  transcribedText: { color: Colors.light.text, fontWeight: '600' },
  targetLabel: { color: Colors.light.textSecondary, fontSize: 13 },
  targetTextDisplay: { color: Colors.light.tint, fontWeight: '600' },
  similarityLine: { color: Colors.light.textLight, fontSize: 11, fontWeight: '600', marginTop: 2 },

  intelNote: {
    backgroundColor: 'rgba(139,92,246,0.10)', borderRadius: 12,
    borderWidth: 1, borderColor: 'rgba(139,92,246,0.25)', padding: 12,
  },
  intelNoteText: { color: '#8B5CF6', fontSize: 12, lineHeight: 18 },

  phonemeBreakdown: {
    backgroundColor: Colors.light.surface,
    borderRadius: 14, padding: 16,
    borderWidth: 1, borderColor: Colors.light.border, gap: 8,
  },
  phonemeBreakdownHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  engineBadge: {
    fontSize: 9, fontWeight: '700', color: '#8B5CF6',
    backgroundColor: '#8B5CF615', borderRadius: 6,
    paddingHorizontal: 6, paddingVertical: 2,
  },
  phonemeBreakdownHint: { fontSize: 11, color: Colors.light.textSecondary, marginTop: -2 },
  phonemeStrip: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 2 },
  phonemeChipOk: {
    backgroundColor: '#0FBA9A18', borderWidth: 1, borderColor: '#0FBA9A55',
    borderRadius: 8, paddingHorizontal: 9, paddingVertical: 5,
  },
  phonemeChipOkText: { color: '#0FBA9A', fontSize: 14, fontWeight: '700', fontFamily: Platform.OS === 'ios' ? undefined : 'monospace' },
  phonemeChipBad: {
    backgroundColor: '#EF444418', borderWidth: 1, borderColor: '#EF444466',
    borderRadius: 8, paddingHorizontal: 9, paddingVertical: 5,
  },
  phonemeChipBadText: { color: '#EF4444', fontSize: 14, fontWeight: '800', fontFamily: Platform.OS === 'ios' ? undefined : 'monospace' },

  // Word-level breakdown
  wordStrip: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  wordChip2: {
    borderWidth: 1.5, borderRadius: 10,
    paddingHorizontal: 11, paddingVertical: 7, alignItems: 'center',
  },
  wordChip2Text: { fontSize: 15, fontWeight: '800' },
  wordChip2Sub: { fontSize: 9, color: Colors.light.textSecondary, fontWeight: '700', marginTop: 1 },
  wordDetail: {
    marginTop: 12, paddingTop: 12,
    borderTopWidth: 1, borderTopColor: Colors.light.border, gap: 8,
  },
  wordDetailTitle: { fontSize: 12, fontWeight: '700', color: Colors.light.text },

  // Saved recording play button
  playRecBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: Colors.light.tint + '12',
    borderWidth: 1, borderColor: Colors.light.tint + '40',
    borderRadius: 14, paddingVertical: 12, paddingHorizontal: 14,
  },
  playRecIcon: { fontSize: 20, color: Colors.light.tint },
  playRecText: { fontSize: 14, fontWeight: '700', color: Colors.light.text },
  playRecSub: { fontSize: 11, color: Colors.light.textSecondary, marginTop: 1 },
  playRecBadge: {
    fontSize: 10, fontWeight: '800', color: '#EF4444',
    backgroundColor: 'rgba(239,68,68,0.15)', borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3,
    overflow: 'hidden',
  },

  overallCard: {
    backgroundColor: Colors.light.surface,
    borderRadius: 14, padding: 16,
    borderWidth: 1, borderColor: Colors.light.success + '30', gap: 6,
  },
  overallTitle: { color: Colors.light.text, fontSize: 14, fontWeight: '700' },
  overallText: { color: Colors.light.textSecondary, fontSize: 13, lineHeight: 20 },

  issuesCard: {
    backgroundColor: Colors.light.surface,
    borderRadius: 14, padding: 16, borderWidth: 1, borderColor: Colors.light.warning + '25', gap: 10,
  },
  issuesTitle: { color: Colors.light.text, fontSize: 14, fontWeight: '700' },
  phonemeIssueRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    padding: 10, borderRadius: 10, borderWidth: 1,
    backgroundColor: Colors.light.background,
  },
  phonemeIssueBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  phonemeIssueLabel: { fontSize: 14, fontWeight: '700' },
  phonemeExample: { flex: 1, color: Colors.light.textSecondary, fontSize: 12 },
  severityBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  severityText: { fontSize: 11, fontWeight: '700' },

  suggestionsCard: {
    backgroundColor: Colors.light.surface,
    borderRadius: 14, padding: 16, borderWidth: 1, borderColor: Colors.light.tint + '20', gap: 10,
  },
  suggestionsTitle: { color: Colors.light.text, fontSize: 14, fontWeight: '700' },
  suggestionItem: {
    backgroundColor: Colors.light.background,
    borderRadius: 10, padding: 10, gap: 4,
  },
  suggestionIssue: { color: Colors.light.textSecondary, fontSize: 13 },
  suggestionFix: { color: Colors.light.tint, fontSize: 13, fontWeight: '600' },

  actionRow: { flexDirection: 'row', gap: 12 },
  tryAgainBtn: {
    flex: 1, alignItems: 'center', paddingVertical: 14,
    borderRadius: 14, borderWidth: 2, borderColor: Colors.light.tint,
  },
  tryAgainText: { color: Colors.light.tint, fontSize: 14, fontWeight: '700' },
  nextWordBtn: {
    flex: 1, alignItems: 'center', paddingVertical: 14,
    borderRadius: 14, backgroundColor: Colors.light.tint,
  },
  nextWordText: { color: '#fff', fontSize: 14, fontWeight: '700' },

  // Romanian error pattern block
  romanianErrorBox: {
    backgroundColor: '#8B5CF612',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#8B5CF640',
    borderLeftWidth: 3,
    borderLeftColor: '#8B5CF6',
    padding: 12,
    gap: 5,
    marginTop: 4,
  },
  romanianErrorHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  romanianErrorIcon: { fontSize: 13 },
  romanianErrorTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#8B5CF6',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  romanianErrorSubstitute: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.light.text,
  },
  romanianErrorWhy: {
    fontSize: 12,
    color: Colors.light.textSecondary,
    lineHeight: 17,
  },
  romanianErrorSource: {
    fontSize: 10,
    color: Colors.light.textLight,
    fontStyle: 'italic',
    marginTop: 2,
  },
});
