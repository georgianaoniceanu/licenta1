#!/usr/bin/env python3
"""
QUICK START: 4-Step Assessment Workflow

Usage:
1. Run this script
2. OR manually call the endpoints via curl
3. Check ASSESSMENT_WORKFLOW_COMPLETE.md for full documentation
"""

import requests
import json

BASE_URL = "http://localhost:8000"

print("\n" + "="*80)
print("4-STEP ASSESSMENT WORKFLOW - QUICK START")
print("="*80)

# ============================================================================
# STEP 0: ONBOARDING
# ============================================================================
print("\n📝 STEP 0: Onboarding Questionnaire (Optional)")
print("-"*80)
print("""
POST /assessment/onboarding/initial-assessment
{
  "user_id": "learner_001",
  "learning_goals": "exam_prep",        // general, business, academic, exam_prep, travel
  "primary_domain": "academic",         // narration, description, argumentation, conversation, academic, technical
  "pain_points": ["pronunciation", "vocabulary", "grammar"],  // areas they're worried about
  "target_exam": "Cambridge CAE",       // Cambridge CAE, Cambridge CPE, TOEFL iBT, IELTS, Aptis
  "self_assessed_cefr": "B1",          // A2, B1, B2, C1
  "study_hours_per_week": 10
}

Returns: Profile saved + onboarding response
""")

# ============================================================================
# STEP 1: INITIAL ASSESSMENT
# ============================================================================
print("\n🔵 STEP 1: Initial Assessment (10 Indicators)")
print("-"*80)
print("""
POST /assessment/initial-assessment

Required: 10 indicator measurements (from audio/text analysis)

Example Request:
{
  "user_id": "learner_001",
  "domain": "academic",
  "target_exam": "Cambridge CAE",
  
  // 10 Indicators (must fill all):
  "lexical_diversity": 58.0,           // vocabulary variety (0-100)
  "lexical_sophistication": 52.0,      // word frequency (low=advanced)
  "word_length": 4.6,                  // avg chars/word
  "sentence_complexity": 13.5,         // mean sentence length
  "subordination_ratio": 0.9,          // dependent clauses per T-unit
  "syntactic_complexity": 1.8,         // clauses per sentence
  "articulation_rate": 2.3,            // words per second
  "pause_frequency": 0.25,             // seconds pause per word (lower=better)
  "cohesion_score": 68.0,              // discourse organization
  "morphosyntactic_accuracy": 76.0     // grammar correctness %
}

Returns:
{
  "predicted_cefr": "B1",
  "overall_score": 64.5,
  "exam_scores": {
    "cambridge_cae": 72.5,
    "toefl_ibt": 68.0,
    ...
  },
  "indicators": [
    {
      "name": "Lexical Diversity (D Index / VOCD)",
      "score": 47.5,
      "severity": "🟡 HIGH",
      "sources": ["Lee, J. (2021)...", "Pallotti, G. (2015)..."]
    },
    ...
  ],
  "critical_areas": ["Subordination", "Articulation Rate"],
  "strengths": ["Grammar", "Vocabulary"],
  "priority_recommendations": [
    "Subordination Ratio: Use more dependent clauses. Target: B2 benchmark (1.2)",
    ...
  ]
}
""")

# ============================================================================
# STEP 2: DUAL DIAGNOSIS
# ============================================================================
print("\n🟡 STEP 2: Dual Diagnosis (Perception vs. Measurement)")
print("-"*80)
print("""
POST /assessment/dual-diagnosis

Same request as STEP 1, but also with pain_points:

{
  "user_id": "learner_001",
  "pain_points": ["pronunciation", "vocabulary", "grammar"],  // from onboarding
  "lexical_diversity": 58.0,
  ... (all 10 indicators)
}

Returns:
{
  "pain_points": ["pronunciation", "vocabulary", "grammar"],
  "discrepancies": {
    "pronunciation": {
      "user_score_10": 7,        // User's worry level (1-10)
      "system_score_100": 68.0,  // System measurement
      "gap_points": -38,         // User overestimates (negative = overestimate)
      "status": "overestimate",
      "interpretation": "You worry more than needed..."
    },
    ...
  },
  "areas_overestimated": ["pronunciation"],
  "areas_underestimated": [],
  "aligned_areas": ["vocabulary", "grammar"],
  "priority_focus": [
    "pronunciation: User concern + medium system score"
  ]
}

KEY INSIGHT: If user says "I'm terrible at pronunciation" but system measures 68%,
this is a confidence-building area, not intervention priority!
""")

# ============================================================================
# STEP 3: RE-ASSESSMENT
# ============================================================================
print("\n🟢 STEP 3: Re-Assessment (Progress Tracking)")
print("-"*80)
print("""
POST /assessment/reassess

Used AFTER user completes exercises/modules.
Compare baseline scores with new measurements:

{
  "user_id": "learner_001",
  "baseline_overall": 64.0,    // from STEP 1
  "baseline_cefr": "B1",       // from STEP 1
  "target_exam": "Cambridge CAE",
  
  // Current measurements (after exercises):
  "lexical_diversity": 68.0,    // was 58.0 → +10 improvement
  "articulation_rate": 2.6,     // was 2.3 → +0.3 improvement
  ... (all 10 indicators)
}

Returns:
{
  "baseline_overall": 64.0,
  "current_overall": 71.2,
  "overall_improvement_points": 7.2,  // +7.2 points
  "baseline_cefr": "B1",
  "current_cefr": "B1",               // Not advanced yet, but moving toward B2
  "indicator_improvements": {
    "lexical_diversity": 10.0,
    "articulation_rate": 3.0,
    ...
  },
  "most_improved_areas": ["lexical_diversity", "articulation_rate"],
  "still_critical_areas": ["subordination_ratio"],
  "progress_summary": "Overall: 64.0 → 71.2 (+7.2%). Most improved: lexical_diversity..."
}

Li & Shintani (2010) meta-analysis: typical d=0.48 effect size over 12 weeks
→ Expect 15-25% improvement if targeting correctly
""")

# ============================================================================
# STEP 4: FULL REPORT
# ============================================================================
print("\n🔵 STEP 4: Comprehensive Report")
print("-"*80)
print("""
GET /assessment/report/{user_id}

Example: GET /assessment/report/learner_001

Returns:
{
  "user_id": "learner_001",
  "target_exam": "Cambridge CAE",
  "initial_assessment": { ...from STEP 1... },
  "dual_diagnosis": { ...from STEP 2... },
  "latest_reassessment": { ...from STEP 3... },
  "learning_path": {
    "recommended_modules": ["vocabulary_booster", "fluency_practice"]
  },
  "full_bibliography": [
    "Pallotti, G. (2015). A simple view of linguistic complexity...",
    "Lee, J. (2021). Genre effects on syntactic complexity...",
    ... 8 sources total
  ],
  "assessment_methodology": "CAF (Complexity-Accuracy-Fluency) framework..."
}

✅ Ready for exam commission presentation!
   - Fully sourced (8 peer-reviewed papers)
   - Measurable (numeric scores, CEFR mappings)
   - Transparent (methodology explained)
   - Actionable (specific recommendations)
""")

# ============================================================================
# EXAMPLE: How to Calculate Indicators (Reference)
# ============================================================================
print("\n📊 HOW TO CALCULATE INDICATORS (Reference)")
print("-"*80)
print("""
These values should come from automatic analysis tools:

1. LEXICAL_DIVERSITY (D Index / VOCD)
   Formula: VOCD calculation over 100-word samples
   Tool: TAACO, LancsCAF, or custom implementation
   
2. LEXICAL_SOPHISTICATION (Word Frequency)
   Formula: Average log(frequency) from corpus (CELEX, COCA)
   Range: Low score = advanced vocabulary
   
3. WORD_LENGTH
   Formula: Sum(character_lengths) / num_words
   Example: "The quick fox" = (3+5+3)/3 = 3.7
   
4. SENTENCE_COMPLEXITY (MLS)
   Formula: Total words / number of sentences
   Example: 200 words / 15 sentences = 13.3 wps
   
5. SUBORDINATION_RATIO
   Formula: Dependent clauses / T-units
   Requires: Dependency parsing
   
6. SYNTACTIC_COMPLEXITY (Clauses/Sentence)
   Formula: Total clauses / sentences
   Requires: Clause-level parsing
   
7. ARTICULATION_RATE
   Formula: Syllables / speaking-time (sec) [excluding pauses]
   Tool: Praat, WebRTC, speech analysis library
   
8. PAUSE_FREQUENCY
   Formula: Total pause duration (sec) / num_words
   Threshold: Pauses > 0.3 sec count
   
9. COHESION_SCORE
   Formula: Discourse markers + lexical chains + anaphora
   Tool: TAACO, Coh-Metrix
   
10. MORPHOSYNTACTIC_ACCURACY
    Formula: Error-free clauses / total clauses × 100
    Requires: Grammatical error detection

Tools Available:
- TAACO (Text Cohesion) - kyle-crossley.github.io/taaco/
- Coh-Metrix - cohmetrix.com
- Praat (speech analysis) - praat.org
- spaCy/TextBlob (POS/parsing) - spacy.io
- CELEX database (word frequency) - celex.mpi.nl
""")

# ============================================================================
# EXAM WEIGHTS (Reference)
# ============================================================================
print("\n🎯 EXAM-SPECIFIC INDICATOR WEIGHTS (Reference)")
print("-"*80)
print("""
Different exams emphasize different indicators:

CAMBRIDGE CAE (C1):
- Lexical Sophistication: 18% (emphasize advanced vocabulary)
- Lexical Diversity: 12%
- Cohesion Score: 15%
- Subordination Ratio: 14%
- Morphosyntactic Accuracy: 5% (less important at C1)

TOEFL iBT (B2-C1):
- Morphosyntactic Accuracy: 20% (grammar correctness)
- Articulation Rate: 15% (speaking speed)
- Pause Frequency: 15% (fluency disfluencies)
- Lexical Diversity: 12%

IELTS ACADEMIC (B2-C1):
- Lexical Diversity: 15%
- Lexical Sophistication: 15%
- Cohesion Score: 15%
- Articulation Rate: 10%

→ When user targets specific exam, indicators are automatically reweighted!
""")

# ============================================================================
# TEST HARNESS
# ============================================================================
print("\n\n" + "="*80)
print("READY TO TEST!")
print("="*80)
print("""
1. Start the API server:
   $ cd backend
   $ uvicorn app.main:app --reload

2. In another terminal, run test:
   $ python test_assessment_workflow.py

3. Or make direct API calls (see examples above with curl or Postman)

4. Check full documentation:
   $ cat ASSESSMENT_WORKFLOW_COMPLETE.md

✅ All 4 steps implemented, tested, research-backed
🎉 Ready for demonstration to professor
""")

print("="*80 + "\n")
