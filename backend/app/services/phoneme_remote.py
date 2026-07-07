"""
Phoneme Assessment — Primary: local CMU-dict scorer; Optional: Colab upgrade
=============================================================================

Architecture (two-tier, always available)
------------------------------------------
Tier 1 (ALWAYS ON):
  phoneme_local.score_pronunciation(original_text, transcribed_text)
  → CMU Pronouncing Dictionary + Levenshtein PER
  → deterministic, no network, no GPU, startup-time import only
  → available 100% of the time

Tier 2 (OPTIONAL — higher acoustic precision):
  Google Colab notebook (backend/colab/phoneme_assessment_colab.py)
  exposed via Cloudflare tunnel → wav2vec2-xlsr-53-espeak-cv-ft phoneme recognition
  Set COLAB_PHONEME_URL in .env to enable. When reachable, replaces
  Tier 1 with genuine audio-level phoneme transcription.

When COLAB_PHONEME_URL is unset or the Colab server is down,
Tier 1 handles all requests transparently. The system never degrades
to "unavailable" — it degrades gracefully to a slightly less precise
(but still scientifically grounded) text-based PER score.

Upgrade path for production
----------------------------
Replace Tier 2 with any of:
  - Azure Cognitive Services Pronunciation Assessment API
  - Google Cloud Speech-to-Text with word confidence scores
  - SpeechBrain (GPU inference on the same server)
  - Self-hosted wav2vec2 via FastAPI + Docker

This file is the only place that needs to change for any upgrade —
all consumers (accent.py, shadow.py) call assess_pronunciation() here.
"""

import os
import logging
import requests

from app.services.phoneme_local import score_pronunciation as _local_score

logger = logging.getLogger(__name__)


def _colab_url() -> str:
    return os.getenv("COLAB_PHONEME_URL", "").strip().rstrip("/")


def _assess_via_colab(audio_path: str, target_text: str) -> dict | None:
    """
    POST audio + target to the optional Colab wav2vec2-espeak server.
    Returns the raw result dict, or None if server is not configured / unreachable.
    This is Tier 2 — used only when COLAB_PHONEME_URL is set and healthy.
    """
    url = _colab_url()
    if not url:
        return None
    try:
        with open(audio_path, "rb") as f:
            files = {"audio": (os.path.basename(audio_path), f, "application/octet-stream")}
            data  = {"target_text": target_text}
            r = requests.post(f"{url}/assess", files=files, data=data, timeout=40)
        if r.status_code != 200:
            logger.warning("Colab phoneme server HTTP %s", r.status_code)
            return None
        result = r.json()
        if "accuracy_score" not in result:
            return None
        return result
    except Exception as exc:
        logger.warning("Colab phoneme server unavailable: %s", exc)
        return None


def assess_pronunciation(audio_path: str, original_text: str, transcribed_text: str) -> dict:
    """
    Primary entry point for phoneme-level pronunciation assessment.

    Always returns a result dict (never raises, never returns None).
    The dict is compatible with build_phoneme_result() in accent_dna.py.

    Parameters
    ----------
    audio_path      : path to the learner's audio file (WAV/MP3)
    original_text   : target text the learner should have said
    transcribed_text: Whisper ASR transcription of the learner's audio

    Returns
    -------
    dict with keys: accuracy_score, errors, expected_phonemes,
                    produced_phonemes, alignment, word_breakdown, engine, ...
    """
    # Tier 2: try Colab first (optional, higher acoustic precision)
    if _colab_url():
        colab = _assess_via_colab(audio_path, original_text)
        if colab:
            colab["_tier"] = "colab-wav2vec2"
            return colab

    # Tier 1: always-available local CMU-dict scorer (deterministic, zero-downtime)
    result = _local_score(original_text, transcribed_text)
    result["_tier"] = "local-cmudict-per"
    return result


# ── Backwards-compatibility shim ──────────────────────────────────────────────
# Old call sites used assess_via_colab(audio_path, target_text) → dict | None.
# Replace all call sites with assess_pronunciation(), but keep this shim so that
# any code not yet updated still works (returns None only if both tiers fail,
# which is now impossible since Tier 1 is deterministic).

def assess_via_colab(audio_path: str, target_text: str) -> dict | None:
    """
    Deprecated shim — use assess_pronunciation() for new code.
    Returns None only when Colab was never configured; kept for legacy callers.
    """
    return _assess_via_colab(audio_path, target_text)
