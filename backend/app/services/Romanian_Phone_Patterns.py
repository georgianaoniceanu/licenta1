"""
Romanian Phonological Transfer Patterns in English (L2) Acquisition

Based on: Măchiță, O.-M. (2021). The Acquisition of English Phonology 
by Romanian and French Learners of English. University of Bucharest.

This module maps specific phonological errors expected from Romanian speakers learning English.
"""

# ============================================================================
# 1. VOWEL SYSTEMS - Tense-Lax Confusion
# ============================================================================

VOWEL_DIFFICULTIES = {
    "/i:/ vs /ɪ/": {
        "description": "Long vs Short 'ee' sound (fleece vs kit)",
        "romanian_issue": "Romanian lacks tense-lax distinction - vowels are only qualitative",
        "error_pattern": "Merge into intermediate category, usually too relaxed",
        "difficulty_score": 95,  # Very hard
        "romanian_speaker_error_rate": 0.90,  # 90% make this error
        "example_pairs": [
            {"english": "fleece /fliːs/", "romanian_produces": "flɪs"},
            {"english": "kit /kɪt/", "romanian_produces": "kiːt"}
        ],
        "correction_focus": "Keep /i:/ tense and forward, /ɪ/ lax and central"
    },
    
    "/u:/ vs /ʊ/": {
        "description": "Long vs Short 'oo' sound (goose vs foot)",
        "romanian_issue": "No duration/tension distinction in Romanian vocalic system (7 monophthongs)",
        "error_pattern": "Produce intermediate sound, studies show NO Romanian reached RP standard",
        "difficulty_score": 100,  # MOST DIFFICULT
        "romanian_speaker_error_rate": 1.0,  # 100% - none reach RP standard
        "example_pairs": [
            {"english": "goose /ɡuːs/", "romanian_produces": "ɡʊs (too relaxed)"},
            {"english": "foot /fʊt/", "romanian_produces": "fuːt (too tense)"}
        ],
        "correction_focus": "THIS IS THE HARDEST - use visual mouth position and duration (goose = longer, tenser)"
    },
    
    "/æ/ vs /ɑ:/": {
        "description": "Short 'a' vs Long 'ah' (cat vs father)",
        "romanian_issue": "Influenced by Romanian /a/ and /e/ sounds",
        "error_pattern": "/æ/ pulled toward Romanian /e/, /ɑ:/ influenced by Romanian /a/",
        "difficulty_score": 65,
        "romanian_speaker_error_rate": 0.55,
        "example_pairs": [
            {"english": "cat /kæt/", "romanian_produces": "ket (too high)"},
            {"english": "father /ˈfɑðə/", "romanian_produces": "fata (too close to Romanian)"}
        ],
        "correction_focus": "Open mouth wider for /æ/, further back for /ɑ:/"
    },

    "/ʌ/": {
        "description": "Schwa in stressed position (cup, hut)",
        "romanian_issue": "Influenced directly by Romanian /a/ sound",
        "error_pattern": "Produce too open, more like /a/",
        "difficulty_score": 70,
        "romanian_speaker_error_rate": 0.65,
        "correction_focus": "More central, less open than /a/"
    },

    "/ə/": {
        "description": "Schwa in unstressed (about, sofa)",
        "romanian_issue": "Romanian has /ə/ too, but different distribution",
        "error_pattern": "Over-reduce, too weak",
        "difficulty_score": 45,
        "romanian_speaker_error_rate": 0.40,
        "correction_focus": "Keep unstressed syllables light but not completely elided"
    }
}


# ============================================================================
# 2. CONSONANT SYSTEMS - Missing Phonemes
# ============================================================================

CONSONANT_DIFFICULTIES = {
    "/θ/": {
        "description": "Unvoiced dental fricative (think, math)",
        "romanian_issue": "DOES NOT EXIST in Romanian - no dental fricatives at all",
        "error_pattern": "STOPPING - substitute with /t/ (think → tink)",
        "difficulty_score": 90,
        "romanian_speaker_error_rate": 0.90,  # 90% make this error
        "success_rate_consistent": 0.10,  # Only 10% produce correctly consistently
        "phonological_model": "Auditory Distance Model - chose closest Romanian sound = /t/",
        "correction_strategy": "Explicit instruction: place tongue BETWEEN teeth, not behind",
        "example_pairs": [
            {"english": "think /θɪŋk/", "romanian_produces": "tink /tɪŋk/"},
            {"english": "math /mæθ/", "romanian_produces": "mat /mæt/"}
        ]
    },

    "/ð/": {
        "description": "Voiced dental fricative (this, father)",
        "romanian_issue": "DOES NOT EXIST in Romanian",
        "error_pattern": "STOPPING - substitute with /d/ (this → dis)",
        "difficulty_score": 95,
        "romanian_speaker_error_rate": 0.95,
        "success_rate_consistent": 0.05,  # Only 5% produce correctly
        "phonological_model": "Auditory Distance Model - closest is /d/",
        "correction_strategy": "Same as /θ/ - tongue between teeth, add voice",
        "example_pairs": [
            {"english": "this /ðɪs/", "romanian_produces": "dis /dɪs/"},
            {"english": "father /ˈfɑðə/", "romanian_produces": "fada /ˈfɑdə/"}
        ]
    },

    "/ŋ/": {
        "description": "Velar nasal (singer, doing)",
        "romanian_issue": "EXISTS in Romanian but [ŋ] is ALOPHONE of /n/ only before /k,g/",
        "error_pattern": "Distributive limitation: Romanians add [g] or [k] after /ŋ/ → 'doing-g'",
        "difficulty_score": 75,
        "romanian_speaker_error_rate": 0.50,  # 50% add extra /g/ or /k/
        "phonological_model": "Deep-rooted fossilized pattern from L1 - /ŋ/ must be followed by stop",
        "correction_strategy": "Train final /ŋ/ without following consonant",
        "example_pairs": [
            {"english": "doing /ˈduːɪŋ/", "romanian_produces": "duin-g /ˈduːɪŋg/"},
            {"english": "singer /ˈsɪŋə/", "romanian_produces": "singa /ˈsɪŋɡə/"}
        ]
    }
}


# ============================================================================
# 3. ALLOPHONES - Positional Variations
# ============================================================================

ALLOPHONE_DIFFICULTIES = {
    "Dark L [ɫ]": {
        "description": "Velarized L in final position (milk, feel)",
        "romanian_issue": "Romanian /l/ is always CLEAR, never velarized",
        "error_pattern": "Substitute clear [l] for dark [ɫ]",
        "difficulty_score": 70,
        "romanian_speaker_error_rate": 0.60,
        "success_rate": 0.05,  # Very low success - 50% NEVER produce dark L
        "correction_strategy": "Show acoustic difference: pull back the back of tongue for final /l/",
        "example_pairs": [
            {"english": "milk /mɪɫk/", "romanian_produces": "milk /mɪlk/ (too clear)"},
            {"english": "feel /fiːɫ/", "romanian_produces": "feel /fiːl/ (too clear)"}
        ]
    },

    "Aspirated Stops [pʰ, tʰ, kʰ]": {
        "description": "Aspiration on voiceless stops at word start",
        "romanian_issue": "Aspiration only appears pre-pausally in Romanian (at end), not at start",
        "error_pattern": "TWO issues: (1) sometimes suppress, (2) 70% OVER-ASPIRATE (too much)",
        "difficulty_score": 80,
        "romanian_speaker_error_rate": 0.70,  # 70% over-aspirate
        "success_rate": 0.30,  # 30% get it right
        "specific_issue_kh": "Produce [kh] too much (VOT > 40ms, exceeds English norm)",
        "specific_issue_th": "Produce [th] extremely rarely",
        "correction_strategy": "VOT (Voice Onset Time) training - show waveforms",
        "example_pairs": [
            {"english": "pen /pʰɛn/", "romanian_produces": "phen (too much aspiration)"},
            {"english": "time /tʰaɪm/", "romanian_produces": "taim (no aspiration)"},
            {"english": "come /kʰʌm/", "romanian_produces": "khum (over-aspirated)"}
        ]
    }
}


# ============================================================================
# 4. COMBINED DIFFICULTY MATRIX
# ============================================================================

ROMANIAN_SPEAKER_PHONEME_RANKING = [
    # High Difficulty (90+)
    {"phoneme": "/u:/ vs /ʊ/", "issue": "Tense-Lax", "difficulty": 100, "error_rate": 1.0},
    {"phoneme": "/ð/", "issue": "Missing Fricative", "difficulty": 95, "error_rate": 0.95},
    {"phoneme": "/θ/", "issue": "Missing Fricative", "difficulty": 90, "error_rate": 0.90},
    
    # Medium-High Difficulty (70-90)
    {"phoneme": "/ŋ/", "issue": "Alophone Constraint", "difficulty": 75, "error_rate": 0.50},
    {"phoneme": "/i:/ vs /ɪ/", "issue": "Tense-Lax", "difficulty": 95, "error_rate": 0.90},
    {"phoneme": "Dark L [ɫ]", "issue": "Alophone Position", "difficulty": 70, "error_rate": 0.60},
    {"phoneme": "Aspirated [kʰ]", "issue": "Alophone Process", "difficulty": 80, "error_rate": 0.70},
    
    # Medium Difficulty (50-70)
    {"phoneme": "/ʌ/", "issue": "Vowel Influence", "difficulty": 70, "error_rate": 0.65},
    {"phoneme": "/æ/", "issue": "Vowel Influence", "difficulty": 65, "error_rate": 0.55},
    
    # Lower Difficulty (<50)
    {"phoneme": "/ə/", "issue": "Vowel Distribution", "difficulty": 45, "error_rate": 0.40},
]


# ============================================================================
# 5. INTERVENTION STRATEGIES PER PHONEME
# ============================================================================

INTERVENTION_STRATEGIES = {
    "/u:/ vs /ʊ/": {
        "level": "CRITICAL",
        "strategy": "Multi-modal approach",
        "steps": [
            "1. Visual: Show mouth position (rounded lips, tongue back)",
            "2. Duration: /u:/ = 200ms+, /ʊ/ = 100ms",
            "3. Tension: /u:/ = tense lips, /ʊ/ = relaxed",
            "4. Contrast drilling: goose/foot, loose/look, choose/put",
            "5. Spectrograms: Show formant values F1/F2 differences"
        ]
    },
    
    "/θ/ and /ð/": {
        "level": "CRITICAL",
        "strategy": "Explicit articulatory instruction",
        "steps": [
            "1. Mirror: Show tongue placement (BETWEEN teeth, not behind)",
            "2. Tactile: Feel air flow on paper between teeth",
            "3. Contrast with /t,d/: Think-Tink comparison",
            "4. Minimal pairs: thin/tin, this/dis, weather/wether",
            "5. Slow-motion video of speaker"
        ]
    },
    
    "/ŋ/": {
        "level": "HIGH",
        "strategy": "Distributive constraint breaking",
        "steps": [
            "1. Explain: /ŋ/ can END words without /g/ or /k/",
            "2. Contrast: sing (ends with /ŋ/), singling (has /ŋ/ + /g/)",
            "3. Final position only: doing, singing, ring, wing",
            "4. Acoustic: Show no /g/ or /k/ in spectrogram",
            "5. Feedback: Record self, verify no trailing [g]"
        ]
    },
    
    "Dark L [ɫ]": {
        "level": "MEDIUM",
        "strategy": "Positional allophones",
        "steps": [
            "1. Explain position rule: Clear L at START (light), Dark L at END (dark)",
            "2. Tongue position: Light = forward, Dark = retract back of tongue",
            "3. Contrast: lee vs feel, low vs oil (initial vs final /l/)",
            "4. Visual: Articulatory diagrams",
            "5. Recordings: Listen to native English 'dark L' in audio"
        ]
    },
    
    "Aspiration": {
        "level": "MEDIUM",
        "strategy": "VOT (Voice Onset Time) training",
        "steps": [
            "1. Explain: Aspiration = brief silence before voicing starts",
            "2. English norms: /p,t,k/ at word-start = 50-100ms VOT",
            "3. Over-aspiration detection: Real-time spectrograms",
            "4. Minimal VOT pairs: Contrast with languages that lack aspiration",
            "5. Ear training: Listen & repeat native examples"
        ]
    }
}


# ============================================================================
# 6. DATA FOR HEATMAP VISUALIZATION
# ============================================================================

HEATMAP_DATA = {
    "title": "Romanian Speakers' English Phonological Difficulties",
    "subtitle": "Based on Măchiță (2021) - Actual error rates from research",
    "phonemes": [
        "/i:/-/ɪ/", "/u:/-/ʊ/", "/æ/-/ɑ:/", "/ʌ/", "/ə/",
        "/θ/", "/ð/", "/ŋ/", "[ɫ]", "[pʰ]", "[tʰ]", "[kʰ]"
    ],
    "error_types": ["Substitution", "Auditory Distance", "Alophone Constraint", "Over-Aspiration"],
    "data_matrix": [
        # Vowel errors
        [0.90, "Tense-Lax", "Merge", "-"],              # /i:/-/ɪ/
        [1.00, "Tense-Lax", "Merge", "-"],              # /u:/-/ʊ/
        [0.55, "Romanian /a,e/", "Fronting", "-"],      # /æ/-/ɑ:/
        [0.65, "Romanian /a/", "Lower", "-"],           # /ʌ/
        [0.40, "Distribution", "Weak", "-"],            # /ə/
        
        # Consonant errors
        [0.90, "Not in Romanian", "STOP → [t]", "-"],   # /θ/
        [0.95, "Not in Romanian", "STOP → [d]", "-"],   # /ð/
        [0.50, "Alophone → guttural", "Add [g/k]", "-"],# /ŋ/
        [0.60, "Always clear", "Clear → Dark", "-"],    # [ɫ]
        [0.30, "L1 pattern", "-", "No aspiration"],     # [pʰ]
        [0.30, "L1 pattern", "-", "Rare aspiration"],   # [tʰ]
        [0.70, "L1 pattern", "-", "OVER-aspiration"],   # [kʰ]
    ]
}


# ============================================================================
# 7. DIFFICULTY CLASSIFICATION FOR EXERCISES
# ============================================================================

PHONEME_EXERCISE_LEVELS = {
    "CRITICAL (Start here)": [
        {"phoneme": "/u:/-/ʊ/", "course_level": "A1-A2", "priority": 1},
        {"phoneme": "/θ/", "course_level": "A1-A2", "priority": 2},
        {"phoneme": "/ð/", "course_level": "A1-A2", "priority": 2},
    ],
    "HIGH (Essential)": [
        {"phoneme": "/i:/-/ɪ/", "course_level": "A2-B1", "priority": 3},
        {"phoneme": "/ŋ/", "course_level": "A2-B1", "priority": 4},
        {"phoneme": "/ʌ/", "course_level": "B1", "priority": 5},
    ],
    "MEDIUM (Important)": [
        {"phoneme": "Dark L [ɫ]", "course_level": "B1-B2", "priority": 6},
        {"phoneme": "Aspiration", "course_level": "B1-B2", "priority": 7},
        {"phoneme": "/æ/-/ɑ:/", "course_level": "B2", "priority": 8},
    ],
    "LOWER (Polish)": [
        {"phoneme": "/ə/", "course_level": "B2-C1", "priority": 9},
    ],
}

# (no side-effect prints — import-safe)
