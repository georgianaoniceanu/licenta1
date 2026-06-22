/**
 * Phoneme Audio Registry — recorded clips for 100% accurate phoneme playback.
 *
 * The Accent DNA globe plays the real recording for a phoneme when available,
 * and falls back to Web Speech (TTS) otherwise.
 *
 * HOW TO ENABLE REAL AUDIO:
 *   1. Add 12 MP3 files to  frontend/assets/audio/  (American English IPA,
 *      ~0.8–1.5s each). Filenames must match the comments below.
 *   2. Uncomment the matching require() line for each file you added.
 *   3. Restart Metro with a clean cache:  npx expo start -c
 *
 * Until a file is added + uncommented, that phoneme uses the TTS fallback.
 *
 * Keys MUST match the `phoneme` field in PHONEME_EXERCISES (accent.tsx).
 */

const PHONEME_AUDIO: Record<string, any> = {
  // '/u:/-/ʊ/':   require('../assets/audio/phoneme_uu_uh.mp3'),     // tense /uː/ then lax /ʊ/
  // '/i:/-/ɪ/':   require('../assets/audio/phoneme_ii_ih.mp3'),     // tense /iː/ then lax /ɪ/
  // '/ð/':        require('../assets/audio/phoneme_voiced_th.mp3'), // voiced TH
  // '/θ/':        require('../assets/audio/phoneme_unvoiced_th.mp3'),// unvoiced TH
  // '/æ/-/ɑ:/':   require('../assets/audio/phoneme_ae_aa.mp3'),      // /æ/ then /ɑː/
  // '/ʌ/':        require('../assets/audio/phoneme_uh.mp3'),
  // '[ɫ] Dark L': require('../assets/audio/phoneme_dark_l.mp3'),
  // '/ŋ/':        require('../assets/audio/phoneme_ng.mp3'),
  // '[kʰ]':       require('../assets/audio/phoneme_k.mp3'),          // aspirated K
  // '/ə/':        require('../assets/audio/phoneme_schwa.mp3'),
  // '[pʰ]':       require('../assets/audio/phoneme_p.mp3'),          // aspirated P
  // '[tʰ]':       require('../assets/audio/phoneme_t.mp3'),          // aspirated T
};

/** Resolve the recorded clip for a phoneme, or null to use the TTS fallback. */
export function getPhonemeAudio(phoneme: string): any | null {
  return PHONEME_AUDIO[phoneme] ?? null;
}

/** True if a real recording exists for this phoneme. */
export function hasPhonemeAudio(phoneme: string): boolean {
  return phoneme in PHONEME_AUDIO;
}
