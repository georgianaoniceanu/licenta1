from app.services.vocabulary_coach import generate_phonetic_breakdown

# Test 1: Words in CMU dictionary
result1 = generate_phonetic_breakdown("discuss", "discus")
print("Test 1 (discuss vs discus):")
print(f"  target: {result1['target_ipa']}")
print(f"  user: {result1['user_ipa']}")
print(f"  source: {result1['_ipa_source']}")
print()

# Test 2: Word not in dictionary
result2 = generate_phonetic_breakdown("analyse", "analyze")
print("Test 2 (analyse vs analyze):")
print(f"  target: {result2['target_ipa']}")
print(f"  user: {result2['user_ipa']}")
print(f"  source: {result2['_ipa_source']}")
