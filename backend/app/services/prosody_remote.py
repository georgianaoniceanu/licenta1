"""Prosody Assessment — Primary: Colab parselmouth+librosa; Fallback: local librosa


Architecture (two-tier, always available)

Tier 1 (OPTIONAL — full acoustic prosody):
  Google Colab notebook (backend/colab/prosody_analysis_colab.py)
  Exposed via Cloudflare tunnel → parselmouth (Praat) + librosa + DTW
  Set COLAB_PROSODY_URL in .env to enable.
  Measures: F0 pitch contour, onset-strength rhythm, RMS energy envelope.

Tier 2 (ALWAYS ON — lightweight local fallback):
  librosa-based approximation (no Praat, no external server).
  Uses librosa.yin() for pitch, onset_strength for rhythm, RMS for energy.
  Less accurate than Tier 1 but deterministic and always available.
  Returns score with a "local_fallback": True flag so the frontend can
  display a note explaining the reduced precision.

Scientific basis:
  Boersma & Weenink (2001) Praat — Glot International 5(9/10), 341-347.
  Sakoe & Chiba (1978) DTW — IEEE Trans ASSP 26(1), 43-49.
  Ramus et al. (1999) Rhythm metrics — Cognition 73(3), 265-292.
  Pallotti (2009) CAF framework — Applied Linguistics 30(4), 590-601.
"""

from __future__ import annotations
import os, math, logging
import numpy as np
import requests

logger = logging.getLogger(__name__)


def _colab_url() -> str:
    return os.getenv("COLAB_PROSODY_URL", "").strip().rstrip("/")



def _assess_via_colab(learner_path: str, native_path: str) -> dict | None:
    """
    POST both audio files to the Colab prosody server.
    Returns the result dict, or None if server is not configured / unreachable.
    """
    url = _colab_url()
    if not url:
        return None
    try:
        with open(learner_path, "rb") as fl, open(native_path, "rb") as fn:
            files = {
                "learner_audio": (os.path.basename(learner_path), fl, "audio/wav"),
                "native_audio":  (os.path.basename(native_path),  fn, "audio/wav"),
            }
            r = requests.post(f"{url}/prosody", files=files, timeout=60)
        if r.status_code != 200:
            logger.warning("Colab prosody server HTTP %s", r.status_code)
            return None
        result = r.json()
        if "prosody_score" not in result:
            return None
        result["_tier"] = "colab-parselmouth"
        return result
    except Exception as exc:
        logger.warning("Colab prosody server unavailable: %s", exc)
        return None


#Tier 2: local librosa fallback 

def _dtw_distance_1d(x: np.ndarray, y: np.ndarray) -> float:
    """Normalised DTW distance between two 1-D sequences."""
    n, m = len(x), len(y)
    if n == 0 or m == 0:
        return 1.0
    D = np.full((n + 1, m + 1), np.inf)
    D[0, 0] = 0.0
    for i in range(1, n + 1):
        for j in range(1, m + 1):
            D[i, j] = abs(x[i-1] - y[j-1]) + min(D[i-1, j], D[i, j-1], D[i-1, j-1])
    return float(D[n, m]) / (n + m)


def _local_prosody(learner_path: str, native_path: str) -> dict:
    """
    Lightweight prosody approximation using librosa only (no Praat).

    Pitch: librosa.yin() — YIN fundamental frequency estimator
           (de Cheveigné & Kawahara 2002, JASA 111(4), 1917-1930)
    Rhythm: onset_strength envelope + tempo ratio
    Energy: short-time RMS correlation

    Less precise than parselmouth/DTW but deterministic and always available.
    """
    try:
        import librosa
    except ImportError:
        logger.error("librosa not installed — cannot compute local prosody")
        return _neutral_result("librosa not installed")

    SR = 22050
    HOP = 512

    try:
        logger.info("[prosody] loading learner: %s", learner_path)
        y_l, _ = librosa.load(learner_path, sr=SR, mono=True)
        logger.info("[prosody] learner loaded: %d samples", len(y_l))
        logger.info("[prosody] loading native: %s", native_path)
        y_n, _ = librosa.load(native_path,  sr=SR, mono=True)
        logger.info("[prosody] native loaded: %d samples", len(y_n))
    except Exception as e:
        logger.warning("[prosody] audio load failed: %s", e, exc_info=True)
        return _neutral_result(f"audio load failed: {e}")

    #Pitch via YIN 
    try:
        f0_l = librosa.yin(y_l, fmin=75, fmax=500, hop_length=HOP).astype(float)
        f0_n = librosa.yin(y_n, fmin=75, fmax=500, hop_length=HOP).astype(float)

        # YIN returns 0 for unvoiced — replace with NaN
        f0_l[f0_l < 80]  = np.nan
        f0_n[f0_n < 80]  = np.nan

        # Semitone normalisation
        def to_st(f0):
            mean = np.nanmean(f0[~np.isnan(f0)]) if np.any(~np.isnan(f0)) else 200.0
            return np.where(~np.isnan(f0), 12 * np.log2(np.maximum(f0, 1e-9) / mean), 0.0)

        st_l, st_n = to_st(f0_l), to_st(f0_n)
        # Learner and native clips differ in length, so mask each contour on its
        # OWN voiced frames — DTW then aligns the two unequal-length sequences.
        # (A shared element-wise mask would crash on the shape mismatch.)
        l_v = st_l[st_l != 0.0]
        n_v = st_n[st_n != 0.0]

        if len(l_v) >= 5 and len(n_v) >= 5:
            d = _dtw_distance_1d(l_v, n_v)
            pitch_score = max(0, min(100, round(100 * math.exp(-d / 1.5))))
        else:
            pitch_score = 50
    except Exception as e:
        logger.warning("Local pitch failed: %s", e)
        pitch_score = 50

    # Rhythm via onset strength 
    try:
        oenv_l = librosa.onset.onset_strength(y=y_l, sr=SR, hop_length=HOP)
        oenv_n = librosa.onset.onset_strength(y=y_n, sr=SR, hop_length=HOP)

        norm = lambda x: x / (np.max(x) + 1e-9)
        d_onset = _dtw_distance_1d(norm(oenv_l), norm(oenv_n))
        onset_sim = math.exp(-d_onset * 2)

        t_l = librosa.beat.tempo(onset_envelope=oenv_l, sr=SR, hop_length=HOP)[0]
        t_n = librosa.beat.tempo(onset_envelope=oenv_n, sr=SR, hop_length=HOP)[0]
        tempo_ratio = min(t_l, t_n) / max(t_l, t_n) if max(t_l, t_n) > 0 else 0.5

        rhythm_score = max(0, min(100, round((0.6 * onset_sim + 0.4 * tempo_ratio) * 100)))
    except Exception as e:
        logger.warning("Local rhythm failed: %s", e)
        rhythm_score = 50

    #Energy envelope 
    try:
        rms_l = librosa.feature.rms(y=y_l, frame_length=2048, hop_length=HOP)[0]
        rms_n = librosa.feature.rms(y=y_n, frame_length=2048, hop_length=HOP)[0]
        norm = lambda x: x / (np.max(x) + 1e-9)
        d_rms = _dtw_distance_1d(norm(rms_l), norm(rms_n))
        energy_score = max(0, min(100, round(math.exp(-d_rms * 3) * 100)))
    except Exception as e:
        logger.warning("Local energy failed: %s", e)
        energy_score = 50


    prosody_score = round(0.45 * pitch_score + 0.35 * rhythm_score + 0.20 * energy_score)

    return {
        "prosody_score":  prosody_score,
        "pitch_score":    pitch_score,
        "rhythm_score":   rhythm_score,
        "energy_score":   energy_score,
        "pitch_details":  {},
        "score_method":   "45% pitch (YIN/DTW) + 35% rhythm (onset) + 20% energy (RMS) — local fallback",
        "local_fallback": True,
        "_tier":          "local-librosa",
        "scientific_basis": {
            "pitch":  "de Cheveigné & Kawahara (2002) YIN, JASA 111(4); Sakoe & Chiba (1978) DTW",
            "rhythm": "Ramus et al. (1999) Cognition 73(3); Tauroza & Allison (1990) Applied Linguistics 11",
            "energy": "Boersma & Weenink (2001) Praat intensity analysis",
        },
    }


def _neutral_result(reason: str) -> dict:
    return {
        "prosody_score": 50, "pitch_score": 50,
        "rhythm_score": 50,  "energy_score": 50,
        "pitch_details": {}, "local_fallback": True,
        "_tier": "neutral", "error": reason,
        "score_method": "neutral (analysis unavailable)",
        "scientific_basis": {},
    }


# Public API 

def assess_prosody(learner_path: str, native_path: str) -> dict:
    """
    Primary entry point for prosody assessment.

    Always returns a result dict (never raises, never returns None).
    Tries Colab (Tier 1) first; falls back to local librosa (Tier 2).

    Parameters
    
    learner_path : path to learner's audio file
    native_path  : path to native/TTS reference audio file

    Returns
    
    dict with keys: prosody_score, pitch_score, rhythm_score, energy_score,
                    score_method, scientific_basis, _tier, [local_fallback]
    """
    if _colab_url():
        result = _assess_via_colab(learner_path, native_path)
        if result:
            return result

    return _local_prosody(learner_path, native_path)
