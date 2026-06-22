/**
 * Demo Audio Registry — maps audio_id strings to bundled MP3 modules.
 *
 * Each of the 6 demo personas has 3 recordings:
 *   {persona}_voice    — Voice Profile sample (Profile screen)
 *   {persona}_shadow_1 — first shadow-speaking recording
 *   {persona}_shadow_2 — second shadow-speaking recording
 *
 * Stored as require() modules so Metro bundles them. We key by string id
 * (not the module itself) because demo session data is JSON-serialised into
 * AsyncStorage — only the string id is persisted, the module is resolved at
 * playback time via getDemoAudio().
 */

// Static require map — Metro needs literal require() calls (no dynamic paths).
const AUDIO: Record<string, any> = {
  // Ana — medical student (A1→A2)
  ana_voice:      require('../assets/audio/ana_voice.mp3'),
  ana_shadow_1:   require('../assets/audio/ana_shadow_1.mp3'),
  ana_shadow_2:   require('../assets/audio/ana_shadow_2.mp3'),

  // Mihai — software engineer (B1→B2)
  mihai_voice:    require('../assets/audio/mihai_voice.mp3'),
  mihai_shadow_1: require('../assets/audio/mihai_shadow_1.mp3'),
  mihai_shadow_2: require('../assets/audio/mihai_shadow_2.mp3'),

  // Elena — lawyer (B2→C1)
  elena_voice:    require('../assets/audio/elena_voice.mp3'),
  elena_shadow_1: require('../assets/audio/elena_shadow_1.mp3'),
  elena_shadow_2: require('../assets/audio/elena_shadow_2.mp3'),

  // Radu — journalist (C1→C2)
  radu_voice:     require('../assets/audio/radu_voice.mp3'),
  radu_shadow_1:  require('../assets/audio/radu_shadow_1.mp3'),
  radu_shadow_2:  require('../assets/audio/radu_shadow_2.mp3'),

  // Sorin — marketing manager (B1→B2)
  sorin_voice:    require('../assets/audio/sorin_voice.mp3'),
  sorin_shadow_1: require('../assets/audio/sorin_shadow_1.mp3'),
  sorin_shadow_2: require('../assets/audio/sorin_shadow_2.mp3'),

  // Diana — financial analyst (B2→C1)
  diana_voice:    require('../assets/audio/diana_voice.mp3'),
  diana_shadow_1: require('../assets/audio/diana_shadow_1.mp3'),
  diana_shadow_2: require('../assets/audio/diana_shadow_2.mp3'),

  // ── Cloned voices (XTTS-v2), level-calibrated, matching the practised text ──
  // Vocabulary (1 speaking phrase per persona)
  ana_vocab_1:    require('../assets/audio/ana_vocab_1.mp3'),
  mihai_vocab_1:  require('../assets/audio/mihai_vocab_1.mp3'),
  elena_vocab_1:  require('../assets/audio/elena_vocab_1.mp3'),
  radu_vocab_1:   require('../assets/audio/radu_vocab_1.mp3'),
  sorin_vocab_1:  require('../assets/audio/sorin_vocab_1.mp3'),
  diana_vocab_1:  require('../assets/audio/diana_vocab_1.mp3'),

  // Accent (3 phrases per persona)
  ana_accent_1:   require('../assets/audio/ana_accent_1.mp3'),
  ana_accent_2:   require('../assets/audio/ana_accent_2.mp3'),
  ana_accent_3:   require('../assets/audio/ana_accent_3.mp3'),
  mihai_accent_1: require('../assets/audio/mihai_accent_1.mp3'),
  mihai_accent_2: require('../assets/audio/mihai_accent_2.mp3'),
  mihai_accent_3: require('../assets/audio/mihai_accent_3.mp3'),
  elena_accent_1: require('../assets/audio/elena_accent_1.mp3'),
  elena_accent_2: require('../assets/audio/elena_accent_2.mp3'),
  elena_accent_3: require('../assets/audio/elena_accent_3.mp3'),
  radu_accent_1:  require('../assets/audio/radu_accent_1.mp3'),
  radu_accent_2:  require('../assets/audio/radu_accent_2.mp3'),
  radu_accent_3:  require('../assets/audio/radu_accent_3.mp3'),
  sorin_accent_1: require('../assets/audio/sorin_accent_1.mp3'),
  sorin_accent_2: require('../assets/audio/sorin_accent_2.mp3'),
  sorin_accent_3: require('../assets/audio/sorin_accent_3.mp3'),
  diana_accent_1: require('../assets/audio/diana_accent_1.mp3'),
  diana_accent_2: require('../assets/audio/diana_accent_2.mp3'),
  diana_accent_3: require('../assets/audio/diana_accent_3.mp3'),
};

/** Resolve a bundled audio module by id. Returns null if unknown. */
export function getDemoAudio(id?: string | null): any | null {
  if (!id) return null;
  return AUDIO[id] ?? null;
}

/** True if a recording exists for this id. */
export function hasDemoAudio(id?: string | null): boolean {
  return !!id && id in AUDIO;
}

export const DEMO_AUDIO_IDS = Object.keys(AUDIO);
