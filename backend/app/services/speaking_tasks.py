"""
Speaking task bank — original prompts organised by each exam's public structure.

Data lives in app/data/speaking_tasks.json. Only the test FORMAT (parts, timing,
task types) comes from the exam boards' public descriptions; every prompt is
original, so nothing copyrighted is reproduced.

This is the curated backbone that complements the LLM adaptive generator in
practice.py: fixed, reproducible, exam-format-correct tasks the committee can
inspect, while the LLM covers the long tail of per-learner personalisation.
"""

import json
import os
from functools import lru_cache
from typing import Any, Dict, List, Optional

_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "speaking_tasks.json")

# Exam keys that come from onboarding (EXAM_FOCUS on the frontend).
VALID_EXAMS = {
    "ielts_academic", "ielts_general", "toefl_ibt",
    "cambridge_fce", "cambridge_cae", "cambridge_cpe",
    "pte_core", "general",
}


@lru_cache(maxsize=1)
def _load() -> Dict[str, Any]:
    with open(_PATH, encoding="utf-8") as f:
        return json.load(f)


def _resolve(exam: str) -> str:
    """Map an exam key to the key that actually holds the tasks (handles aliases)."""
    data = _load()
    entry = data.get(exam)
    if isinstance(entry, dict) and entry.get("alias_of"):
        return entry["alias_of"]
    return exam


def list_exams() -> List[str]:
    data = _load()
    return [k for k in data.keys() if not k.startswith("_")]


def get_speaking_tasks(exam: str, level: Optional[str] = None) -> Dict[str, Any]:
    """
    Return the exam's speaking structure with its tasks.

    Parameters
    ----------
    exam  : one of VALID_EXAMS (unknown values fall back to 'general')
    level : optional CEFR level (e.g. 'B2'). When given, each part's tasks are
            filtered to that level; if a part has no task at that level, all of
            its tasks are returned so the part is never empty.
    """
    data = _load()
    if exam not in data or exam.startswith("_"):
        exam = "general"

    source_key = _resolve(exam)
    entry = data.get(source_key, data["general"])
    parts = entry.get("parts", [])

    out_parts: List[Dict[str, Any]] = []
    for part in parts:
        tasks = part.get("tasks", [])
        if level:
            matched = [t for t in tasks if t.get("level") == level]
            tasks = matched if matched else tasks
        out_parts.append({**part, "tasks": tasks})

    return {
        "exam": exam,
        "exam_name": entry.get("exam_name", exam),
        "total_time": entry.get("total_time"),
        "note": data.get(exam, {}).get("note") if isinstance(data.get(exam), dict) else None,
        "ai_scored": entry.get("ai_scored", False),
        "parts": out_parts,
        "source": "Task FORMAT from the exam board's public test description; all prompts are original (no copyrighted items).",
    }
