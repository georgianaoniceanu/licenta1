"""
Simple in-memory TTL cache for API responses
─────────────────────────────────────────────────────────────────────────────
Purpose: reduce calls to expensive external APIs (Groq LLM, ElevenLabs)
during demos / development. Identical text inputs produce identical outputs,
so we cache them by hash for a configurable TTL (default 1 hour).

This is a process-local cache — it lives in RAM and dies when the server
restarts. Sufficient for thesis demonstrations and dev work. For production
multi-worker deploys, swap to Redis.
─────────────────────────────────────────────────────────────────────────────
"""

import hashlib
import json
import time
from typing import Any, Callable, Dict, Tuple, Optional
import functools


class TTLCache:
    def __init__(self, default_ttl: int = 3600, max_size: int = 500):
        self._store: Dict[str, Tuple[float, Any]] = {}
        self.default_ttl = default_ttl
        self.max_size = max_size
        # Stats for /health
        self.hits = 0
        self.misses = 0

    def _now(self) -> float:
        return time.time()

    def _evict_expired(self) -> None:
        now = self._now()
        expired = [k for k, (exp, _) in self._store.items() if exp < now]
        for k in expired:
            self._store.pop(k, None)

    def _evict_oldest_if_full(self) -> None:
        if len(self._store) >= self.max_size:
            oldest_key = min(self._store.keys(), key=lambda k: self._store[k][0])
            self._store.pop(oldest_key, None)

    def get(self, key: str) -> Optional[Any]:
        entry = self._store.get(key)
        if not entry:
            self.misses += 1
            return None
        exp, value = entry
        if exp < self._now():
            self._store.pop(key, None)
            self.misses += 1
            return None
        self.hits += 1
        return value

    def set(self, key: str, value: Any, ttl: Optional[int] = None) -> None:
        self._evict_expired()
        self._evict_oldest_if_full()
        ttl = ttl if ttl is not None else self.default_ttl
        self._store[key] = (self._now() + ttl, value)

    def clear(self) -> None:
        self._store.clear()

    def stats(self) -> Dict[str, Any]:
        total = self.hits + self.misses
        return {
            "size": len(self._store),
            "max_size": self.max_size,
            "hits": self.hits,
            "misses": self.misses,
            "hit_rate": round(self.hits / total * 100, 1) if total else 0.0,
        }


# Global cache instance — used across services
CACHE = TTLCache(default_ttl=3600, max_size=500)


def make_key(namespace: str, *parts: Any) -> str:
    """Stable hash key from arbitrary parts (lists, dicts, strings, …)."""
    blob = json.dumps([namespace, *parts], sort_keys=True, default=str)
    return hashlib.sha256(blob.encode("utf-8")).hexdigest()


def cached(namespace: str, ttl: Optional[int] = None):
    """
    Decorator: cache the return value of a function by its arguments.
    Skips caching automatically if the function raises.

    Usage:
        @cached("vocab_suggestions", ttl=3600)
        def analyze_vocabulary(user_id, text):
            ...
    """
    def decorator(fn: Callable):
        @functools.wraps(fn)
        def wrapper(*args, **kwargs):
            key = make_key(namespace, args, kwargs)
            hit = CACHE.get(key)
            if hit is not None:
                return hit
            result = fn(*args, **kwargs)
            try:
                CACHE.set(key, result, ttl=ttl)
            except Exception:
                pass  # never let cache writes break the call
            return result
        return wrapper
    return decorator
