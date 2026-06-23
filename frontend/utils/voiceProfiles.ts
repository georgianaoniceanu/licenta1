/**
 * Voice Profiles — per-user voice characteristics for demo playback.
 *
 * Each of the 9 demo presets (3 level-based + 6 job personas) has a distinct
 * voice profile (rate, pitch, accent, gender preference) used at playback time
 * via the Web Speech API (SpeechSynthesisUtterance).
 *
 * The voice profile is intentionally distinctive so the committee can hear
 * each persona as a believably different speaker.
 *
 * Audio synthesis happens at runtime — no audio files bundled. On native
 * platforms the fallback returns false and the caller should show a text-only
 * indicator.
 *
 * Theoretical basis:
 *   DeKeyser & Suzuki (2025): speech rate (WPS) and prosodic features
 *   correlate strongly with proficiency — a slower hesitant speaker
 *   demonstrates the same linguistic content with a markedly different
 *   acoustic signature. Voice profiles encode this.
 */

import { Platform } from 'react-native';
import { Audio } from 'expo-av';

export interface VoiceProfile {
  rate: number;                          // 0.5–1.5  — Speech rate multiplier
  pitch: number;                         // 0.8–1.3  — Pitch (1.0 = neutral)
  preferredGender: 'male' | 'female';    // Voice gender preference
  accent: 'en-US' | 'en-GB' | 'en-AU';   // BCP-47 lang code
  description: string;                   // Human-readable summary for UI
}

/**
 * Voice profiles for every demo preset. Designed to be acoustically distinct
 * so the committee can hear each persona as a recognisably different speaker.
 *
 *   - weak/medium/strong: differentiate by RATE — slower = less proficient
 *   - Personas: differentiate by RATE + GENDER + ACCENT for variety
 */
export const USER_VOICES: Record<string, VoiceProfile> = {
  // Level-based (existing 3 demos)
  weak:   { rate: 0.75, pitch: 1.05, preferredGender: 'female', accent: 'en-US',
            description: 'Slow, hesitant — A2 learner' },
  medium: { rate: 0.95, pitch: 1.00, preferredGender: 'male',   accent: 'en-US',
            description: 'Average pace — B1 / B2 learner' },
  strong: { rate: 1.10, pitch: 0.95, preferredGender: 'female', accent: 'en-GB',
            description: 'Confident, near-native rate — C1 learner' },

  // Job personas (6 fictional users)
  ana:    { rate: 0.72, pitch: 1.18, preferredGender: 'female', accent: 'en-US',
            description: 'Young, hesitant — A1→A2 medical student' },
  mihai:  { rate: 1.00, pitch: 0.95, preferredGender: 'male',   accent: 'en-US',
            description: 'Technical, steady — B1→B2 developer' },
  elena:  { rate: 0.95, pitch: 1.08, preferredGender: 'female', accent: 'en-GB',
            description: 'Precise, articulate — B2→C1 lawyer' },
  radu:   { rate: 1.18, pitch: 0.90, preferredGender: 'male',   accent: 'en-US',
            description: 'Fast, fluent — C1→C2 journalist' },
  sorin:  { rate: 0.90, pitch: 1.02, preferredGender: 'male',   accent: 'en-US',
            description: 'Persuasive, confident — B1→B2 marketer' },
  diana:  { rate: 1.05, pitch: 1.12, preferredGender: 'female', accent: 'en-US',
            description: 'Crisp, professional — B2→C1 analyst' },
};

// Speech engine state

let _voicesCache: SpeechSynthesisVoice[] = [];
let _voicesReady = false;

/** Warm up the voices list — call once on app mount on web. */
export function warmupVoices(): void {
  if (!isSpeechAvailable()) return;
  try {
    const synth = window.speechSynthesis;
    _voicesCache = synth.getVoices();
    if (_voicesCache.length === 0 && 'onvoiceschanged' in synth) {
      synth.onvoiceschanged = () => {
        _voicesCache = synth.getVoices();
        _voicesReady = true;
      };
    } else {
      _voicesReady = true;
    }
  } catch {}
}

/** Returns true on web, false on native (no Web Speech API). */
export function isSpeechAvailable(): boolean {
  return (
    Platform.OS === 'web' &&
    typeof window !== 'undefined' &&
    typeof window.speechSynthesis !== 'undefined'
  );
}

// Voice picking heuristics

const FEMALE_NAME_REGEX = /(female|woman|samantha|victoria|karen|moira|tessa|fiona|allison|ava|nicki|susan|veena|kate|amy|joanna|salli|kimberly|emma|amelia|libby|ivy|kendra)/i;
const MALE_NAME_REGEX   = /(male|man|alex|daniel|david|fred|tom|aaron|rishi|oliver|arthur|sergei|brian|matthew|joey|justin|kevin|russell|geraint|liam)/i;

function pickVoice(profile: VoiceProfile): SpeechSynthesisVoice | undefined {
  if (!_voicesCache.length && isSpeechAvailable()) {
    try { _voicesCache = window.speechSynthesis.getVoices(); } catch {}
  }
  if (!_voicesCache.length) return undefined;

  const accentPrefix = profile.accent.split('-')[0]; // "en"
  const languageFull = profile.accent;               // "en-US"

  // Prefer exact accent match
  const exactAccent = _voicesCache.filter(v => v.lang === languageFull);
  const sameLang    = _voicesCache.filter(v => v.lang.startsWith(accentPrefix));
  const pool = exactAccent.length > 0 ? exactAccent : sameLang;

  const regex = profile.preferredGender === 'female' ? FEMALE_NAME_REGEX : MALE_NAME_REGEX;
  const genderMatch = pool.find(v => regex.test(v.name));
  if (genderMatch) return genderMatch;

  // Fallback: first matching language voice, or first voice in any English
  return pool[0] ?? _voicesCache.find(v => v.lang.startsWith('en'));
}

// Public API

export interface SpeakOptions {
  text: string;
  preset?: string | null;     // demo preset key (e.g. 'ana', 'mihai')
  onStart?: () => void;
  onEnd?: () => void;
  onError?: (msg?: string) => void;
}

/**
 * Speak the given text using the preset's voice profile.
 * Returns true if playback started, false if speech is unavailable.
 */
export function speakAsUser(opts: SpeakOptions): boolean {
  if (!isSpeechAvailable()) {
    opts.onError?.('Speech synthesis is only available on web for now.');
    return false;
  }

  try {
    window.speechSynthesis.cancel();
  } catch {}

  const profile =
    opts.preset && USER_VOICES[opts.preset]
      ? USER_VOICES[opts.preset]
      : USER_VOICES.medium;

  const utter = new SpeechSynthesisUtterance(opts.text);
  utter.rate  = profile.rate;
  utter.pitch = profile.pitch;
  utter.lang  = profile.accent;

  const voice = pickVoice(profile);
  if (voice) utter.voice = voice;

  utter.onstart = () => opts.onStart?.();
  utter.onend   = () => opts.onEnd?.();
  utter.onerror = (e) => opts.onError?.((e as any)?.error ?? 'speech-error');

  try {
    window.speechSynthesis.speak(utter);
    return true;
  } catch (e: any) {
    opts.onError?.(e?.message ?? String(e));
    return false;
  }
}

/**
 * Speak an isolated phoneme cue with a clear American (en-US) voice, slowly.
 * Used by the Accent DNA globe — pronounces the sound, not example words.
 */
export function speakPhoneme(cue: string): boolean {
  if (!isSpeechAvailable()) return false;
  try { window.speechSynthesis.cancel(); } catch {}

  const utter = new SpeechSynthesisUtterance(cue);
  utter.lang  = 'en-US';
  utter.rate  = 0.6;   // slow for clarity
  utter.pitch = 1.0;

  if (!_voicesCache.length) {
    try { _voicesCache = window.speechSynthesis.getVoices(); } catch {}
  }
  // Prefer a US English voice, ideally a natural one
  const usVoices = _voicesCache.filter(v => v.lang === 'en-US');
  const preferred =
    usVoices.find(v => /(samantha|alex|ava|joanna|matthew|google us english)/i.test(v.name)) ||
    usVoices[0] ||
    _voicesCache.find(v => v.lang.startsWith('en'));
  if (preferred) utter.voice = preferred;

  try { window.speechSynthesis.speak(utter); return true; }
  catch { return false; }
}

/** Stop any ongoing speech synthesis. */
export function stopSpeaking(): void {
  if (!isSpeechAvailable()) return;
  try {
    window.speechSynthesis.cancel();
  } catch {}
}

/** Returns the voice profile for a preset, or a default. */
export function getVoiceProfile(preset?: string | null): VoiceProfile {
  if (preset && USER_VOICES[preset]) return USER_VOICES[preset];
  return USER_VOICES.medium;
}

// Bundled audio playback (real recordings via expo-av)

let _currentSound: Audio.Sound | null = null;

/**
 * Play a bundled audio asset (require()'d MP3) via expo-av.
 * Works on web and native. Returns true if playback started.
 */
export async function playAudioAsset(
  assetModule: any,
  cbs?: { onStart?: () => void; onEnd?: () => void; onError?: (msg?: string) => void },
): Promise<boolean> {
  if (!assetModule) {
    cbs?.onError?.('no-asset');
    return false;
  }
  try {
    await stopAudioAsset();
    const { sound } = await Audio.Sound.createAsync(assetModule, { shouldPlay: true });
    _currentSound = sound;
    cbs?.onStart?.();
    sound.setOnPlaybackStatusUpdate((status: any) => {
      if (status?.isLoaded && status.didJustFinish) {
        cbs?.onEnd?.();
        sound.unloadAsync().catch(() => {});
        if (_currentSound === sound) _currentSound = null;
      }
    });
    return true;
  } catch (e: any) {
    cbs?.onError?.(e?.message ?? String(e));
    return false;
  }
}

/** Stop any bundled audio currently playing. */
export async function stopAudioAsset(): Promise<void> {
  if (_currentSound) {
    const s = _currentSound;
    _currentSound = null;
    try { await s.stopAsync(); } catch {}
    try { await s.unloadAsync(); } catch {}
  }
}

/**
 * Unified playback: prefer a real bundled recording, fall back to TTS.
 * Returns true if any playback started.
 */
export async function playRecordingOrTTS(opts: {
  audioModule?: any | null;
  text: string;
  preset?: string | null;
  onStart?: () => void;
  onEnd?: () => void;
  onError?: (msg?: string) => void;
}): Promise<boolean> {
  if (opts.audioModule) {
    return playAudioAsset(opts.audioModule, {
      onStart: opts.onStart, onEnd: opts.onEnd, onError: opts.onError,
    });
  }
  // Fallback: synthesized voice
  return speakAsUser({
    text: opts.text, preset: opts.preset,
    onStart: opts.onStart, onEnd: opts.onEnd, onError: opts.onError,
  });
}

/** Stop everything — both TTS and bundled audio. */
export function stopAllPlayback(): void {
  stopSpeaking();
  void stopAudioAsset();
}
