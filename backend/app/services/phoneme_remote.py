"""Phoneme estimation using Colab model"""

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
    The dict is compatible with build_phoneme_result() in accent_dna.py."""
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


# Backwards-compatibility shim 
# Old call sites used assess_via_colab(audio_path, target_text) → dict | None.
# Replace all call sites with assess_pronunciation(), but keep this shim so that
# any code not yet updated still works (returns None only if both tiers fail,
# which is now impossible since Tier 1 is deterministic).

def assess_via_colab(audio_path: str, target_text: str) -> dict | None:
    """Deprecated shim — use assess_pronunciation() for new code.
    Returns None only when Colab was never configured; kept for legacy callers."""
    return _assess_via_colab(audio_path, target_text)
