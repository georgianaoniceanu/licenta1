"""
Onboarding Service — Initial Learner Profiling

Research Foundation:
───────────────────────────────────────────────────────────────────────────────
1. CEFR Global Scale (Council of Europe, 2001; 2020)
   - Self-assessment grids use "can-do" descriptors at each CEFR level.
   - Present-Thomas, Weltens & de Jong (2013) demonstrate self-assessment as
     a valid learner-centered proficiency classification method.
   Source: globalscale.pdf / CEFR Descriptors (2020).xlsx

2. Alderson (2005) — Diagnostic Assessment
   - Diagnostic tests should identify SPECIFIC strengths and weaknesses rather
     than global abilities. Questions must map to specific linguistic indicators.
   Source: Knoch (2009), Diagnostic_assessment_of_writing_A_comparison_of_t.txt

3. CAF Framework — Pallotti (2015)
   - Three independent dimensions: Complexity, Accuracy, Fluency.
   - Onboarding must capture which dimension the learner perceives as weakest
     for the dual-diagnosis comparison with system measurements.
   Source: 21Routledge-Pallotti-CAF in SLA-LT-preprint.txt

4. Kolahi Ahari et al. (2025) — L2 Speaking Proficiency Indicators
   - Lexical diversity, sophistication, syntactic complexity, cohesion explain
     34% of speaking proficiency variance. Self-reported weak areas in these
     dimensions are used to initialize the dual-diagnosis.
   Source: 10.22034_ijlt.2025.492133.1395.txt

5. Davies (COCA) — Genre-based Domain Taxonomy
   - COCA genre (spoken, academic, newspaper, fiction, magazine, web, blog, movies, tv)
     determines which CAF indicators carry most weight.
     Users declare their target register/context at onboarding.
   Source: Davies, M. (2008-) The Corpus of Contemporary American English (COCA).
           Available online at https://www.english-corpora.org/coca/

6. Skehan (1998) — Individual Differences in SLA
   - Learning pace, study time, and motivation significantly affect development
     rate. These are collected here and feed into the learning curve predictor.
   Source: Peter_Skehan.txt / learning_curves.py

Onboarding Flow (6 steps):
   Step 1 — CEFR Self-Assessment (can-do descriptors)
   Step 2 — Learning Goals (CAF + lexical dimensions)
   Step 3 — Domain Focus (spoken/academic/newspaper/fiction/magazine/web/blog/movies/tv)
   Step 4 — Target Exam  (Cambridge / TOEFL / IELTS / PTE / General)
   Step 5 — Perceived Weak Areas  (maps directly to the 10 assessment indicators)
   Step 6 — Study Intensity (Skehan: time on task affects rate of development)
"""

from dataclasses import dataclass, field, asdict
from typing import List, Optional, Dict
from datetime import datetime
from app.services.firestore import db


# ─────────────────────────────────────────────────────────────────────────────
# DATA MODELS
# ─────────────────────────────────────────────────────────────────────────────

@dataclass
class OnboardingData:
    """
    Complete onboarding profile collected from the learner.

    Feeds into:
    - DualDiagnosis: self_perceived_cefr vs system measurement
    - ModuleRecommender: target_exam + domain → indicator weights
    - AssessmentWorkflow: perceived_weak_areas → pain_points list
    - LearningCurvePredictor: daily_study_minutes + motivation
    """
    user_id: str

    # Step 1 — Self-assessed CEFR level (Present-Thomas et al. 2013)
    self_assessed_cefr: str               # A1 | A2 | B1 | B2 | C1 | C2

    # Step 2 — Primary learning goal (CAF framework, Pallotti 2015)
    primary_goal: str                     # vocabulary | pronunciation | grammar |
                                          # fluency | complexity | coherence

    # Step 3 — Domain focus (Davies COCA genres)
    target_domain: str                    # spoken | fiction | academic | newspaper |
                                          # magazine | web | blog | movies | tv

    # Step 4 — Target international exam
    target_exam: str                      # cambridge_fce | cambridge_cae |
                                          # cambridge_cpe | toefl_ibt |
                                          # ielts_general | ielts_academic |
                                          # pte_core | general

    # Step 5 — Perceived weak areas (Alderson 2005: specific not global)
    # Maps to the 10 assessment indicators for dual-diagnosis
    perceived_weak_areas: List[str]       # e.g. ["vocabulary", "pronunciation", "fluency"]

    # Step 6 — Study intensity (Skehan 1998: time on task)
    daily_study_minutes: int              # 10 | 20 | 30 | 60

    # Real per-skill self-rating (area -> 1-5). Powers honest Dual Diagnosis.
    # Default empty for accounts onboarded before this step existed.
    self_ratings: Dict[str, int] = field(default_factory=dict)

    # Timestamps
    completed_at: str = field(default_factory=lambda: datetime.utcnow().isoformat())
    is_completed: bool = True

    def to_dict(self) -> Dict:
        return asdict(self)


# ─────────────────────────────────────────────────────────────────────────────
# QUESTION DEFINITIONS (used by frontend to render each step)
# ─────────────────────────────────────────────────────────────────────────────

# Step 1 — CEFR self-assessment
# Can-do descriptors from CEFR Global Scale (Council of Europe 2001/2020)
CEFR_OPTIONS = [
    {
        "value": "A1",
        "label": "A1 — Beginner",
        "description": "I can understand and use very basic phrases. I can introduce myself.",
        "source": "CEFR Global Scale, Council of Europe (2001/2020)"
    },
    {
        "value": "A2",
        "label": "A2 — Elementary",
        "description": "I understand frequently used expressions. I can communicate in simple, routine tasks.",
        "source": "CEFR Global Scale, Council of Europe (2001/2020)"
    },
    {
        "value": "B1",
        "label": "B1 — Intermediate",
        "description": "I can deal with most travel situations. I can describe experiences and briefly give reasons.",
        "source": "CEFR Global Scale, Council of Europe (2001/2020)"
    },
    {
        "value": "B2",
        "label": "B2 — Upper-Intermediate",
        "description": "I understand complex texts. I interact with fluency that makes conversation with native speakers possible.",
        "source": "CEFR Global Scale, Council of Europe (2001/2020)"
    },
    {
        "value": "C1",
        "label": "C1 — Advanced",
        "description": "I express myself fluently and spontaneously. I use language effectively for academic and professional purposes.",
        "source": "CEFR Global Scale, Council of Europe (2001/2020)"
    },
    {
        "value": "C2",
        "label": "C2 — Proficient",
        "description": "I understand virtually everything. I can express myself precisely in complex situations.",
        "source": "CEFR Global Scale, Council of Europe (2001/2020)"
    },
]

# Step 2 — Primary learning goal
# Based on CAF dimensions (Pallotti 2015) + lexical indicators (Ahari et al. 2025)
GOAL_OPTIONS = [
    {
        "value": "vocabulary",
        "label": "Vocabulary Range",
        "description": "Use a wider variety of words; avoid repeating the same expressions.",
        "indicator": "lexical_diversity",
        "caf_dimension": "Complexity (Lexical)",
        "source": "Pallotti (2015); Kolahi Ahari et al. (2025) — lexical diversity explains largest variance in speaking proficiency"
    },
    {
        "value": "pronunciation",
        "label": "Pronunciation Accuracy",
        "description": "Produce sounds correctly, especially problematic phonemes.",
        "indicator": "articulation_rate",
        "caf_dimension": "Accuracy (Phonological)",
        "source": "Saito (2012) — pronunciation instruction meta-analysis; Măchiță (2021) — Romanian learner phoneme errors"
    },
    {
        "value": "grammar",
        "label": "Grammar & Accuracy",
        "description": "Produce error-free clauses; correct verb tenses and agreement.",
        "indicator": "morphosyntactic_accuracy",
        "caf_dimension": "Accuracy (Morphosyntactic)",
        "source": "Pallotti (2015) — accuracy dimension; Li & Shintani (2010) — corrective feedback d=0.48 effect"
    },
    {
        "value": "fluency",
        "label": "Speaking Fluency",
        "description": "Speak more smoothly, with fewer hesitations and pauses.",
        "indicator": "pause_frequency",
        "caf_dimension": "Fluency (Breakdown)",
        "source": "Pallotti (2015) — fluency: speed, breakdown, repair; Zechner et al. (2009) — TOEFL silence features"
    },
    {
        "value": "complexity",
        "label": "Sentence Complexity",
        "description": "Build longer, more varied sentences with subordinate clauses.",
        "indicator": "syntactic_complexity",
        "caf_dimension": "Complexity (Syntactic)",
        "source": "Kolahi Ahari et al. (2025) — syntactic complexity in L2 proficiency; Lee (2021) — genre effects on syntactic complexity"
    },
    {
        "value": "coherence",
        "label": "Discourse & Coherence",
        "description": "Connect ideas clearly using discourse markers and transitions.",
        "indicator": "cohesion_score",
        "caf_dimension": "Complexity (Discursive)",
        "source": "Kolahi Ahari et al. (2025) — cohesion predicts speaking proficiency; Kyle & Crossley (2016) — TAACO cohesion tool"
    },
]

# Step 3 — Domain focus
# Uses COCA (Davies) genre taxonomy — 9 register-based domains from the
# Corpus of Contemporary American English (lemmas_60k_subgenres.xlsx).
# Each domain foregrounds different CAF indicators.
# Source: Davies, M. — COCA; Tauroza & Allison (1990) — register WPM norms.
DOMAIN_OPTIONS = [
    {
        "value": "spoken",
        "label": "Spoken English (TV / Radio)",
        "description": "Live interviews, talk shows, news broadcasts, informal dialogue.",
        "key_indicators": ["Fluency (WPM)", "Pronunciation", "Pause Rate"],
        "source": "Davies (COCA) — Spoken sub-corpus; Tauroza & Allison (1990) — spoken register norms"
    },
    {
        "value": "academic",
        "label": "Academic & Professional",
        "description": "Scholarly articles, lectures, formal presentations, science and law.",
        "key_indicators": ["AWL%", "Syntactic Complexity (MLS)", "Grammar Accuracy (WCR)"],
        "source": "Davies (COCA) — Academic sub-corpus; Coxhead (2000) — Academic Word List"
    },
    {
        "value": "newspaper",
        "label": "News & Opinion",
        "description": "National/local news, editorials, opinion columns, financial reporting.",
        "key_indicators": ["Coherence", "Lexical Range (MTLD)", "Sentence Complexity"],
        "source": "Davies (COCA) — Newspaper sub-corpus; Fulcher (2003) — opinion task design"
    },
    {
        "value": "fiction",
        "label": "Fiction & Storytelling",
        "description": "Novels, short stories, screenplays, creative narrative writing.",
        "key_indicators": ["Fluency", "Coherence", "Past Tense Accuracy (WCR)"],
        "source": "Davies (COCA) — Fiction sub-corpus; COCA frequency profiles"
    },
    {
        "value": "magazine",
        "label": "Magazine & Lifestyle",
        "description": "Feature articles, sports, science journalism, lifestyle writing.",
        "key_indicators": ["Lexical Diversity (MTLD)", "AWL%", "Descriptive Richness"],
        "source": "Davies (COCA) — Magazine sub-corpus; COCA frequency profiles"
    },
    {
        "value": "web",
        "label": "Web & Instructional",
        "description": "Informational websites, how-to guides, reviews, online articles.",
        "key_indicators": ["Coherence", "Accuracy (WCR)", "Vocabulary Range"],
        "source": "Davies (COCA) — Web sub-corpus; COCA frequency profiles"
    },
    {
        "value": "blog",
        "label": "Blog & Personal Writing",
        "description": "Personal blogs, opinion pieces, informal argumentative writing.",
        "key_indicators": ["Fluency", "Coherence", "Personal Voice (MTLD)"],
        "source": "Davies (COCA) — Blog sub-corpus; COCA frequency profiles"
    },
    {
        "value": "movies",
        "label": "Movies & Film Dialogue",
        "description": "Film scripts across all genres — drama, comedy, action, sci-fi.",
        "key_indicators": ["Pronunciation", "Fluency", "Expressive Delivery"],
        "source": "Davies (COCA) — Movies sub-corpus; COCA frequency profiles"
    },
    {
        "value": "tv",
        "label": "TV Shows",
        "description": "Television drama, comedy, reality TV, crime shows.",
        "key_indicators": ["Pronunciation", "Micro-Fluency", "Coherence"],
        "source": "Davies (COCA) — TV sub-corpus; COCA frequency profiles"
    },
]

# Step 4 — Target exam
# Mapped to exam-specific indicator weights in assessment_indicators.py
EXAM_OPTIONS = [
    {
        "value": "general",
        "label": "General Improvement",
        "description": "No specific exam — improve overall English.",
        "source": "Equal weighting across all 10 indicators"
    },
    {
        "value": "ielts_academic",
        "label": "IELTS Academic",
        "description": "International English Language Testing System.",
        "key_criteria": ["Lexical Resource", "Coherence & Cohesion", "Grammatical Range", "Pronunciation"],
        "source": "IELTS Guide for Test Takers (IDP); ielts-guide-for-test-takers.txt"
    },
    {
        "value": "ielts_general",
        "label": "IELTS General Training",
        "description": "IELTS for migration and workplace purposes.",
        "source": "IELTS Guide for Test Takers (IDP)"
    },
    {
        "value": "toefl_ibt",
        "label": "TOEFL iBT",
        "description": "Test of English as a Foreign Language — Internet-Based Test.",
        "key_criteria": ["Language Use", "Organization", "Delivery", "Vocabulary"],
        "source": "Zechner et al. (2009) — TOEFL iBT automated speaking assessment features"
    },
    {
        "value": "cambridge_fce",
        "label": "Cambridge FCE (B2 First)",
        "description": "Cambridge B2 First Certificate in English.",
        "source": "Cambridge CEFR alignment; English Profile — EVP Online.txt"
    },
    {
        "value": "cambridge_cae",
        "label": "Cambridge CAE (C1 Advanced)",
        "description": "Cambridge C1 Advanced Certificate.",
        "source": "Cambridge CEFR alignment; English Profile — EVP Online.txt"
    },
    {
        "value": "cambridge_cpe",
        "label": "Cambridge CPE (C2 Proficiency)",
        "description": "Cambridge C2 Proficiency — highest Cambridge certificate.",
        "source": "Cambridge CEFR alignment"
    },
    {
        "value": "pte_core",
        "label": "PTE Core",
        "description": "Pearson Test of English — Core (for Canada immigration).",
        "source": "PTE Core scoring criteria; PTE Core scoring _ Pearson PTE.txt"
    },
]

# Step 5 — Perceived weak areas (multi-select, max 3)
# Maps to assessment_indicators.py indicator types for dual-diagnosis
# Based on Alderson (2005): diagnostic tests focus on SPECIFIC abilities
WEAK_AREA_OPTIONS = [
    {
        "value": "vocabulary",
        "label": "Vocabulary Range",
        "description": "I tend to repeat the same words.",
        "indicator_type": "lexical_diversity",
        "source": "Kolahi Ahari et al. (2025) — lexical diversity as proficiency predictor"
    },
    {
        "value": "word_choice",
        "label": "Word Sophistication",
        "description": "I use simple/common words instead of more precise ones.",
        "indicator_type": "lexical_sophistication",
        "source": "Lee (2021) — word frequency as sophistication measure"
    },
    {
        "value": "pronunciation",
        "label": "Pronunciation",
        "description": "My sounds are sometimes unclear or incorrect.",
        "indicator_type": "articulation_rate",
        "source": "Măchiță (2021) — Romanian L2 phoneme error patterns"
    },
    {
        "value": "fluency",
        "label": "Fluency / Hesitations",
        "description": "I pause a lot, use fillers (um, uh), or speak too slowly.",
        "indicator_type": "pause_frequency",
        "source": "Pallotti (2015) — fluency: breakdown dimension; Zechner et al. (2009)"
    },
    {
        "value": "grammar",
        "label": "Grammar Accuracy",
        "description": "I make errors in verb tenses, agreement, or sentence structure.",
        "indicator_type": "morphosyntactic_accuracy",
        "source": "Li & Shintani (2010) — corrective feedback effectiveness; Pallotti (2015) — accuracy"
    },
    {
        "value": "sentence_length",
        "label": "Short/Simple Sentences",
        "description": "My sentences are short and simple; I struggle to combine ideas.",
        "indicator_type": "sentence_complexity",
        "source": "Lee (2021) — Mean Length of Sentence (MLS) as complexity measure"
    },
    {
        "value": "complex_structures",
        "label": "Complex Sentence Structures",
        "description": "I rarely use subordinate clauses or complex grammatical structures.",
        "indicator_type": "subordination_ratio",
        "source": "Pallotti (2015) — syntactic complexity; Lee (2021) — DC/C ratio"
    },
    {
        "value": "coherence",
        "label": "Connecting Ideas (Coherence)",
        "description": "My ideas don't flow well; I lack transitions and discourse markers.",
        "indicator_type": "cohesion_score",
        "source": "Kolahi Ahari et al. (2025) — cohesion in L2 proficiency; Kyle & Crossley (2016) — TAACO"
    },
]

# Step 6 — Daily study intensity
# Based on Skehan (1998): time on task significantly affects learning rate
STUDY_TIME_OPTIONS = [
    {
        "value": 10,
        "label": "10 minutes / day",
        "description": "Quick daily practice — maintains momentum.",
        "motivation_factor": 0.5,
        "source": "Skehan (1998) — motivation and time affect development rate"
    },
    {
        "value": 20,
        "label": "20 minutes / day",
        "description": "Recommended minimum for steady progress.",
        "motivation_factor": 0.7,
        "source": "Skehan (1998) — individual differences in SLA"
    },
    {
        "value": 30,
        "label": "30 minutes / day",
        "description": "Good balance — covers all key modules.",
        "motivation_factor": 0.85,
        "source": "Skehan (1998)"
    },
    {
        "value": 60,
        "label": "60+ minutes / day",
        "description": "Intensive practice — fastest CEFR progression.",
        "motivation_factor": 1.0,
        "source": "Skehan (1998) — high motivation multiplier: 1.40x development rate"
    },
]


# ─────────────────────────────────────────────────────────────────────────────
# ONBOARDING QUESTIONS (full structure returned to frontend)
# ─────────────────────────────────────────────────────────────────────────────

def get_onboarding_questions() -> Dict:
    """
    Returns the full onboarding question structure.
    Each step has a title, subtitle, research note, and options.
    """
    return {
        "total_steps": 6,
        "research_framework": (
            "This onboarding follows the diagnostic assessment framework "
            "(Alderson, 2005; Knoch, 2009) combined with CEFR self-assessment "
            "(Present-Thomas et al., 2013) and CAF proficiency dimensions "
            "(Pallotti, 2015)."
        ),
        "steps": [
            {
                "step": 1,
                "key": "self_assessed_cefr",
                "title": "What is your current English level?",
                "subtitle": (
                    "Choose the description that best matches what you can currently do. "
                    "Be honest — this helps us set the right starting point."
                ),
                "type": "single_select",
                "required": True,
                "research_note": (
                    "Self-assessment using CEFR 'can-do' descriptors is a validated "
                    "learner-centered proficiency classification method "
                    "(Present-Thomas, Weltens & de Jong, 2013, DUJAL)."
                ),
                "options": CEFR_OPTIONS,
            },
            {
                "step": 2,
                "key": "primary_goal",
                "title": "What is your main learning goal?",
                "subtitle": "Pick the area you most want to improve.",
                "type": "single_select",
                "required": True,
                "research_note": (
                    "Goals map to the CAF framework dimensions: Complexity, Accuracy, Fluency "
                    "(Pallotti, 2015) and lexical indicators "
                    "(Ahari et al., 2025 — explaining 34% of proficiency variance)."
                ),
                "options": GOAL_OPTIONS,
            },
            {
                "step": 3,
                "key": "target_domain",
                "title": "Which context will you use English in most?",
                "subtitle": "This personalises which skills matter most for you.",
                "type": "single_select",
                "required": True,
                "research_note": (
                    "COCA genre determines indicator weighting (Davies COCA; Pallotti 2009 CAF): "
                    "spoken/movies prioritise fluency and pronunciation; "
                    "academic/newspaper emphasise grammar accuracy and lexical range; "
                    "fiction/blog prioritise coherence and lexical diversity."
                ),
                "options": DOMAIN_OPTIONS,
            },
            {
                "step": 4,
                "key": "target_exam",
                "title": "Are you preparing for an English exam?",
                "subtitle": "We'll align your feedback to that exam's scoring criteria.",
                "type": "single_select",
                "required": True,
                "research_note": (
                    "International exams weight indicators differently: IELTS emphasises "
                    "Coherence & Cohesion; TOEFL iBT emphasises Language Use and Delivery "
                    "(Zechner et al., 2009). Indicator weights shift accordingly."
                ),
                "options": EXAM_OPTIONS,
            },
            {
                "step": 5,
                "key": "perceived_weak_areas",
                "title": "Where do you feel you struggle most?",
                "subtitle": "Select up to 3 areas. This starts your personal diagnosis.",
                "type": "multi_select",
                "max_selections": 3,
                "required": True,
                "research_note": (
                    "Diagnostic assessment identifies specific strengths and weaknesses rather "
                    "than global abilities (Alderson, 2005). Your selections will be compared "
                    "against system measurements to produce your Dual Diagnosis."
                ),
                "options": WEAK_AREA_OPTIONS,
            },
            {
                "step": 6,
                "key": "daily_study_minutes",
                "title": "How much time can you study each day?",
                "subtitle": "Even 10 minutes daily builds lasting habits.",
                "type": "single_select",
                "required": True,
                "research_note": (
                    "Time on task is a key individual difference factor affecting language "
                    "development rate. High motivation and study time yield up to 1.40× "
                    "faster CEFR progression (Skehan, 1998)."
                ),
                "options": STUDY_TIME_OPTIONS,
            },
        ],
    }


# ─────────────────────────────────────────────────────────────────────────────
# FIRESTORE PERSISTENCE
# ─────────────────────────────────────────────────────────────────────────────

def save_onboarding(data: OnboardingData) -> bool:
    """Persist onboarding data to Firestore under users/{user_id}/onboarding."""
    try:
        user_ref = db.collection("users").document(data.user_id)
        user_ref.collection("onboarding").document("profile").set(data.to_dict())
        # Also mark at the user level for quick lookup
        user_ref.set({"onboarding_completed": True, "onboarding_at": data.completed_at}, merge=True)
        return True
    except Exception as e:
        print(f"Error saving onboarding: {e}")
        return False


def get_onboarding(user_id: str) -> Optional[Dict]:
    """Retrieve saved onboarding profile for a user."""
    try:
        doc = db.collection("users").document(user_id) \
                 .collection("onboarding").document("profile").get()
        if doc.exists:
            return doc.to_dict()
        return None
    except Exception as e:
        print(f"Error getting onboarding: {e}")
        return None


def is_onboarding_complete(user_id: str) -> bool:
    """Quick check whether the user has completed onboarding."""
    try:
        doc = db.collection("users").document(user_id).get()
        if doc.exists:
            return doc.to_dict().get("onboarding_completed", False)
        return False
    except Exception as e:
        print(f"Error checking onboarding: {e}")
        return False


# ─────────────────────────────────────────────────────────────────────────────
# INDICATOR MAPPING (for dual-diagnosis integration)
# ─────────────────────────────────────────────────────────────────────────────

# Maps perceived_weak_areas values → indicator_type names used in assessment_indicators.py
WEAK_AREA_TO_INDICATOR = {
    "vocabulary":        "lexical_diversity",
    "word_choice":       "lexical_sophistication",
    "pronunciation":     "articulation_rate",
    "fluency":           "pause_frequency",
    "grammar":           "morphosyntactic_accuracy",
    "sentence_length":   "sentence_complexity",
    "complex_structures": "subordination_ratio",
    "coherence":         "cohesion_score",
}


def get_pain_points_for_assessment(onboarding: Dict) -> List[str]:
    """
    Convert onboarding perceived_weak_areas to indicator names
    for use in AssessmentWorkflowEngine.run_dual_diagnosis().
    """
    weak_areas = onboarding.get("perceived_weak_areas", [])
    return [
        WEAK_AREA_TO_INDICATOR.get(area, area)
        for area in weak_areas
        if area in WEAK_AREA_TO_INDICATOR
    ]
