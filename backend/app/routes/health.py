"""
Health endpoint - quick liveness check for all external dependencies.

GET /health  ->  {
  "ok": true,
  "checks": {
    "groq":       { "ok": true,  "latency_ms": 230 },
    "elevenlabs": { "ok": true,  "latency_ms": 410 },
    "firebase":   { "ok": true,  "latency_ms": 12 },
  },
  "cache": { size, hits, misses, hit_rate },
  "now": "2026-05-10T15:24:18Z"
}

Use this before a thesis demonstration to confirm everything is reachable
and your API quotas are not exhausted.
"""

import os
import time
from datetime import datetime, timezone
from fastapi import APIRouter
import requests

from app.services.cache import CACHE

router = APIRouter()


def _check_groq() -> dict:
    """Minimal Groq call — list available models. Fast, cheap, doesn't burn LLM quota."""
    key = os.getenv("GROQ_API_KEY")
    if not key:
        return {"ok": False, "error": "GROQ_API_KEY not set"}
    start = time.time()
    try:
        r = requests.get(
            "https://api.groq.com/openai/v1/models",
            headers={"Authorization": f"Bearer {key}"},
            timeout=6,
        )
        latency = round((time.time() - start) * 1000)
        if r.status_code == 200:
            return {"ok": True, "latency_ms": latency}
        return {"ok": False, "error": f"HTTP {r.status_code}", "latency_ms": latency}
    except requests.exceptions.Timeout:
        return {"ok": False, "error": "timeout (6s)"}
    except Exception as e:
        return {"ok": False, "error": str(e)[:120]}


def _check_elevenlabs() -> dict:
    """
    Verify ElevenLabs is reachable with the configured key.
    Tries /user/subscription first (richest info — shows quota), falls back to
    /voices which only needs voices_read permission. A restricted scoped key
    (TTS-only) is still considered OK if it can list voices.
    """
    key = os.getenv("ELEVENLABS_API_KEY")
    if not key:
        return {"ok": False, "error": "ELEVENLABS_API_KEY not set"}

    headers = {"xi-api-key": key}
    start = time.time()
    try:
        # Preferred: subscription info gives us quota numbers
        r = requests.get(
            "https://api.elevenlabs.io/v1/user/subscription",
            headers=headers, timeout=6,
        )
        latency = round((time.time() - start) * 1000)
        if r.status_code == 200:
            data = r.json()
            return {
                "ok": True,
                "latency_ms": latency,
                "characters_used": data.get("character_count"),
                "characters_limit": data.get("character_limit"),
            }
        # 401 = bad key. 403 = key valid but missing this permission — try /voices
        if r.status_code == 403:
            start2 = time.time()
            r2 = requests.get(
                "https://api.elevenlabs.io/v1/voices",
                headers=headers, timeout=6,
            )
            latency2 = round((time.time() - start2) * 1000)
            if r2.status_code == 200:
                return {
                    "ok": True,
                    "latency_ms": latency2,
                    "note": "scoped key (no quota info)",
                }
            return {"ok": False, "error": f"HTTP {r2.status_code}", "latency_ms": latency2}
        return {"ok": False, "error": f"HTTP {r.status_code}", "latency_ms": latency}
    except requests.exceptions.Timeout:
        return {"ok": False, "error": "timeout (6s)"}
    except Exception as e:
        return {"ok": False, "error": str(e)[:120]}


def _check_firebase() -> dict:
    """Verify Firebase Admin SDK is initialised."""
    try:
        import firebase_admin
        if firebase_admin._apps:
            return {"ok": True, "latency_ms": 0}
        return {"ok": False, "error": "Firebase Admin not initialised"}
    except Exception as e:
        return {"ok": False, "error": str(e)[:120]}


@router.get("/health")
def health():
    checks = {
        "groq":       _check_groq(),
        "elevenlabs": _check_elevenlabs(),
        "firebase":   _check_firebase(),
    }
    all_ok = all(c.get("ok") for c in checks.values())
    return {
        "ok": all_ok,
        "checks": checks,
        "cache": CACHE.stats(),
        "now": datetime.now(timezone.utc).isoformat(),
    }


@router.post("/health/cache/clear")
def clear_cache():
    """Wipe the response cache (useful when debugging an LLM prompt change)."""
    CACHE.clear()
    return {"ok": True, "message": "Cache cleared"}
