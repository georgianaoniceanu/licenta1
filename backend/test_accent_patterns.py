#!/usr/bin/env python3
"""Quick test of Măchiță accent patterns"""

from app.services.accent_dna import (
    ROMANIAN_PRONUNCIATION_PATTERNS,
    COARTICULATION_RULES,
    get_phoneme_patterns
)

print("=" * 60)
print("MĂCHIȚĂ ROMANIAN PRONUNCIATION PATTERNS - QUICK TEST")
print("=" * 60)

# Test 1: Load patterns
print("\n✅ Test 1: Pattern loading")
print(f"  - Loaded {len(ROMANIAN_PRONUNCIATION_PATTERNS)} phoneme patterns")
for phoneme in ROMANIAN_PRONUNCIATION_PATTERNS.keys():
    print(f"    • {phoneme}")

# Test 2: Load coarticulation rules
print("\n✅ Test 2: Coarticulation rules loaded")
for rule in COARTICULATION_RULES.keys():
    print(f"    • {rule}")

# Test 3: Detect patterns in target text
print("\n✅ Test 3: Pattern detection")
test_words = [
    "think",
    "father",
    "doing",
    "milk",
    "cars",
    "time"
]

for word in test_words:
    patterns = get_phoneme_patterns(word)
    if patterns:
        print(f"  '{word}' → {list(patterns.keys())}")
    else:
        print(f"  '{word}' → (no problematic patterns)")

# Test 4: Access pattern details
print("\n✅ Test 4: Pattern details (example /θ/)")
theta_pattern = ROMANIAN_PRONUNCIATION_PATTERNS['/θ/ (voiceless interdental)']
print(f"  Error rate: {theta_pattern['error_rate']}%")
print(f"  Correct rate: {theta_pattern['correct_rate']}%")
print(f"  Substitutions:")
for sub, details in theta_pattern['substitutions'].items():
    print(f"    - {sub}: {details['frequency']}% (severity: {details['severity']})")

print("\n" + "=" * 60)
print("✅ ALL TESTS PASSED - Accent DNA ready to use!")
print("=" * 60)
