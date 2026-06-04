"""
Test-Specific Feedback Templates Engine
Generates customized feedback based on indicator scores and target test
Based on: TEST_SPECIFIC_FEEDBACK_TEMPLATES.md + Shabani & Panahi (2020)

Input: Indicator score, learner's example, target test, CEFR level
Output: Structured feedback with diagnosis + test-specific guidance + exercises
"""

from dataclasses import dataclass
from typing import Dict, List, Optional
from enum import Enum
import json


class TargetTest(Enum):
    """Standardized tests"""
    IELTS = "IELTS"
    TOEFL = "TOEFL"
    CAMBRIDGE = "CAMBRIDGE"
    GENERAL = "GENERAL"


class CEFRLevel(Enum):
    A2 = "A2"
    B1 = "B1"
    B2 = "B2"
    C1 = "C1"
    C2 = "C2"


class Severity(Enum):
    """Feedback severity levels"""
    GREEN = "✅"     # Acceptable
    YELLOW = "🟡"   # Needs improvement
    RED = "🔴"      # Critical


@dataclass
class FeedbackSection:
    """One section of feedback (e.g., diagnosis, recommendation)"""
    title: str
    content: str
    emoji: str = "📋"


@dataclass
class LearnerExample:
    """Example from learner's actual work"""
    text: str
    issue_description: str
    correct_version: Optional[str] = None


@dataclass
class PracticeSuggestion:
    """Recommended practice exercise"""
    module: str  # e.g., "Grammar Module"
    activity: str  # e.g., "Complex Sentences"
    duration_minutes: int
    notes: str = ""


@dataclass
class IndicatorFeedback:
    """Complete feedback for one indicator"""
    indicator_name: str
    test_context: str  # Why this matters for their test
    learner_score: float
    target_score: float
    severity: Severity
    diagnosis: str
    examples: List[LearnerExample]
    test_specific_insight: str
    strategy: str
    practice_suggestions: List[PracticeSuggestion]
    expected_improvement: Dict[str, str]  # e.g., {"score": "0.45 → 0.65"}
    
    def to_markdown(self) -> str:
        """Convert to markdown for display"""
        md = f"""
## {self.severity.value} {self.indicator_name}

**Test Context**: {self.test_context}

**Your Score**: {self.learner_score:.2f} (Target: {self.target_score:.2f})

**Severity**: {self.severity.name}

### DIAGNOSIS
{self.diagnosis}

### EXAMPLES FROM YOUR WORK
"""
        for ex in self.examples:
            md += f"\n**Issue**: {ex.issue_description}\n"
            md += f"```\n{ex.text}\n```\n"
            if ex.correct_version:
                md += f"\n**Corrected**:\n```\n{ex.correct_version}\n```\n"
        
        md += f"""
### {self.target_score}'S INSIGHT
{self.test_specific_insight}

### STRATEGY
{self.strategy}

### PRACTICE RECOMMENDATIONS
"""
        for ps in self.practice_suggestions:
            md += f"→ {ps.module}: {ps.activity} ({ps.duration_minutes} min)"
            if ps.notes:
                md += f" - {ps.notes}"
            md += "\n"
        
        md += f"\n### EXPECTED IMPROVEMENT\n"
        for metric, improvement in self.expected_improvement.items():
            md += f"- {metric}: {improvement}\n"
        
        return md


class GrammarAccuracyFeedback:
    """Feedback templates for WCR (Word-level Correct Ratio) indicator"""
    
    @staticmethod
    def generate_ielts(
        wcr_score: float,
        cefr_level: CEFRLevel,
        examples: List[LearnerExample]
    ) -> IndicatorFeedback:
        """IELTS-specific grammar feedback (values range & complexity emphasis)"""
        
        targets = {
            CEFRLevel.A2: 0.84,
            CEFRLevel.B1: 0.87,
            CEFRLevel.B2: 0.92,
            CEFRLevel.C1: 0.96,
        }
        target_score = targets.get(cefr_level, 0.87)
        
        severity = Severity.RED if wcr_score < target_score * 0.7 else (
            Severity.YELLOW if wcr_score < target_score else Severity.GREEN
        )
        
        return IndicatorFeedback(
            indicator_name="Grammatical Accuracy (WCR)",
            test_context="IELTS 'Grammatical Range' (25% of score) values RANGE over perfection. Simple sentences = Band 6-7. Complex sentences with occasional errors = Band 8-9.",
            learner_score=wcr_score,
            target_score=target_score,
            severity=severity,
            diagnosis=f"""Your writing has {(1-wcr_score)*100:.0f} errors per 100 clauses.
Common error types likely include:
- Tense errors (incorrect auxiliary, aspect confusion)
- Subject-verb agreement issues
- Article usage (the/a/∅)
- Word order problems
- Sentence fragments

IELTS values STRUCTURE over perfection. Your goal is to use COMPLEX sentences with OCCASIONAL errors, not simple sentences with zero errors.""",
            examples=examples or [
                LearnerExample(
                    text="I was wanting to become an engineer.",
                    issue_description="Incorrect auxiliary tense",
                    correct_version="I want to become an engineer. / I have always wanted to become an engineer."
                ),
                LearnerExample(
                    text="The advantages of technology is numerous.",
                    issue_description="Subject-verb disagreement (plural subject, singular verb)",
                    correct_version="The advantages of technology are numerous."
                ),
            ],
            test_specific_insight=f"""IELTS examiners distinguish between:
- Band 6-7: Simple sentences, mostly correct
- Band 8-9: Complex sentences, occasional errors acceptable

You're currently at {wcr_score:.0%}. Strategy:
1. DON'T simplify to avoid errors
2. KEEP complex structures
3. FIX specific error types (tense, agreement, articles)

Example progression:
WRONG: "I was wanting..."
BASIC: "I want..."
IELTS BAND 8: "Having harbored a lifelong ambition, I sought to pursue engineering..."
(Complex structure, shows range, occasional risk acceptable)""",
            strategy="""Week 1-2: FIX tense + agreement errors (foundational)
Week 3-4: ADD dependent clauses (if I had..., because the..., although...)
Week 5-6: Integrate both (complex structures + high accuracy)

Target: Complex sentences with 75%+ accuracy, not simple sentences with 100% accuracy.""",
            practice_suggestions=[
                PracticeSuggestion("Grammar Module", "Reducing Tense Errors", 15),
                PracticeSuggestion("Grammar Module", "Subject-Verb Agreement", 15),
                PracticeSuggestion("Shadow Speaking", "Read academic articles aloud", 20, "Absorbs correct structures naturally"),
                PracticeSuggestion("SRS Module", "Tense + agreement flashcards", 10),
            ],
            expected_improvement={
                "WCR": f"{wcr_score:.2f} → {wcr_score + 0.15:.2f}",
                "IELTS Grammatical Range Band": "+1 point"
            }
        )
    
    @staticmethod
    def generate_toefl(
        wcr_score: float,
        cefr_level: CEFRLevel,
        examples: List[LearnerExample]
    ) -> IndicatorFeedback:
        """TOEFL-specific grammar feedback (functional communication focus)"""
        
        targets = {
            CEFRLevel.A2: 0.80,
            CEFRLevel.B1: 0.85,
            CEFRLevel.B2: 0.90,
            CEFRLevel.C1: 0.95,
        }
        target_score = targets.get(cefr_level, 0.85)
        
        severity = Severity.RED if wcr_score < target_score * 0.7 else (
            Severity.YELLOW if wcr_score < target_score else Severity.GREEN
        )
        
        return IndicatorFeedback(
            indicator_name="Grammatical Accuracy (WCR)",
            test_context="TOEFL 'Language Use' (25-40% of score) values FUNCTIONAL communication. Errors that block meaning = major penalty. Small errors = minor penalty.",
            learner_score=wcr_score,
            target_score=target_score,
            severity=severity,
            diagnosis=f"""Your writing has {(1-wcr_score)*100:.0f} errors per 100 clauses.
TOEFL cares about what MATTERS:
- Tense errors = SERIOUS (meaning confusion)
- Subject-verb disagreement = SERIOUS
- Missing articles = LESS serious (native speakers omit articles informally)
- Word order = MODERATE""",
            examples=examples or [
                LearnerExample(
                    text="Technology is good. It's good for education.",
                    issue_description="Vague word choice + error",
                    correct_version="Technology enhances education. Wearables improve healthcare."
                ),
            ],
            test_specific_insight=f"""TOEFL scorers weight PRECISION over variety:
- Using "good" = vague (loses points)
- Using different verbs for different concepts = shows understanding

Your errors priority:
1. CRITICAL: Tense errors (15% of your errors) → FIX FIRST
2. IMPORTANT: Subject-verb agreement (20%) → FIX SECOND
3. ACCEPTABLE: Article omission (30%) → lower priority

TOEFL AI scoring also considers: Can the AI understand your meaning? Yes = points.""",
            strategy="""Week 1: FIX tense errors (biggest impact for TOEFL understanding)
Week 2: FIX subject-verb agreement
Week 3: ADD sentence variety (show control of multiple structures)

Ignore article perfection - TOEFL readers expect this from non-natives.""",
            practice_suggestions=[
                PracticeSuggestion("Grammar Module", "Tense Consistency", 20, "PRIORITY"),
                PracticeSuggestion("Grammar Module", "Subject-Verb Agreement", 15),
                PracticeSuggestion("Discourse Module", "Varying Sentence Types", 15),
                PracticeSuggestion("SRS Module", "Verb tense flashcards", 10),
            ],
            expected_improvement={
                "WCR": f"{wcr_score:.2f} → {wcr_score + 0.20:.2f}",
                "TOEFL Writing Score": "+1-2 points (out of 30)"
            }
        )
    
    @staticmethod
    def generate_cambridge(
        wcr_score: float,
        cefr_level: CEFRLevel,
        examples: List[LearnerExample]
    ) -> IndicatorFeedback:
        """Cambridge-specific grammar feedback (near-native accuracy + sophistication)"""
        
        targets = {
            CEFRLevel.B2: 0.88,
            CEFRLevel.C1: 0.95,
            CEFRLevel.C2: 0.99,
        }
        target_score = targets.get(cefr_level, 0.95)
        
        severity = Severity.RED if wcr_score < target_score * 0.7 else (
            Severity.YELLOW if wcr_score < target_score else Severity.GREEN
        )
        
        return IndicatorFeedback(
            indicator_name="Grammatical Accuracy (WCR)",
            test_context="Cambridge expects NEAR-NATIVE accuracy (CAE = C1, CPE = C2). Not just correct, but SOPHISTICATED. Word 'good' immediately signals: NOT Cambridge level.",
            learner_score=wcr_score,
            target_score=target_score,
            severity=severity,
            diagnosis=f"""Your writing has {(1-wcr_score)*100:.0f} errors per 100 clauses.
Cambridge examiners immediately notice:
- "good" as standalone word = Band 5-6, NOT CAE
- "think" without specification = vague
- Tense errors = shows incomplete internalization
- Agreement errors = lack of precision""",
            examples=examples or [
                LearnerExample(
                    text="This approach is important.",
                    issue_description="Common word (Band 6 level), not Cambridge",
                    correct_version="This multifaceted approach proves instrumental in achieving..."
                ),
                LearnerExample(
                    text="I was wanting to become a doctor.",
                    issue_description="Incorrect auxiliary + article article",
                    correct_version="I have long harbored an aspiration to pursue medicine."
                ),
            ],
            test_specific_insight="""Cambridge expects BOTH:
1. Grammatical ACCURACY: Tense 100%, agreement 100%, articles 95%+
2. Grammatical RANGE: Complex structures, sophisticated constructions

Band 6: "This is important" (correct, simple)
Band 9: "Instrumental to the implementation..." (advanced + correct)""",
            strategy="""Week 1-2: FIX basic errors (tense, agreement, articles)
Week 3-4: ADD advanced structures (conditionals, passive voice, clefts)
Week 5-6: INTEGRATE both (advanced structures with perfect accuracy)

Example upgrade:
"Because technology is everywhere, it changes..." (B2)
→ "By virtue of technology's ubiquity, societies undergo..." (C1)""",
            practice_suggestions=[
                PracticeSuggestion("Grammar Module", "Advanced Structures with Accuracy", 30, "PRIORITY for Cambridge"),
                PracticeSuggestion("Vocabulary Coach", "Academic Collocations", 20),
                PracticeSuggestion("Discourse Module", "Embedding sophistication", 20),
                PracticeSuggestion("Shadow Speaking", "Academic articles + TED talks", 25),
            ],
            expected_improvement={
                "WCR": f"{wcr_score:.2f} → {wcr_score + 0.20:.2f}",
                "Cambridge Language Band": "+1 point",
                "Advanced Structures": "2-3 per essay (from {current})"
            }
        )


class LexicalDiversityFeedback:
    """Feedback templates for MTLD (Lexical Diversity) indicator"""
    
    @staticmethod
    def generate_ielts(
        mtld_score: float,
        examples: List[LearnerExample] = None
    ) -> IndicatorFeedback:
        """IELTS values variety + paraphrasing"""
        
        return IndicatorFeedback(
            indicator_name="Lexical Diversity (MTLD)",
            test_context="IELTS 'Lexical Range' (25%) measures: word variety + paraphrasing ability. Repeating 'important' 8 times = lower band. Paraphrasing = higher band.",
            learner_score=mtld_score,
            target_score=0.50,
            severity=Severity.YELLOW if mtld_score < 0.45 else Severity.GREEN,
            diagnosis=f"""Your MTLD = {mtld_score:.2f} (you're at B1 range).
IELTS cares about:
1. Technical terms OK to repeat (technology, environment, society)
2. Common words MUST be varied (good, important, think, get)

Your repeating words likely:
- "important" (8x) → swap with: crucial, essential, critical, vital, significant
- "good" (6x) → swap with: beneficial, positive, valuable, advantageous
- "think" (5x) → swap with: believe, consider, argue, suggest, maintain""",
            examples=examples or [],
            test_specific_insight="""IELTS examiners distinguish:
Band 6: "The use of technology is important" (repeats idea + word)
Band 8: "The implementation of digital tools is crucial" (same idea, different vocabulary)

You're showing ability to vary, just need to reduce repetition.""",
            strategy="""Identify your top 5 repeated words.
Replace EACH with synonym:
- "important" → Write it once, use "essential", "critical", "vital" elsewhere
- "good" → "beneficial in X context", "positive for Y outcome", "valuable because Z"

Target: Your essay uses each key term only 1-2 times maximum.""",
            practice_suggestions=[
                PracticeSuggestion("Vocabulary Coach", "Avoiding Common Word Repetition", 15),
                PracticeSuggestion("SRS Module", "Synonym flashcards", 10, "Your top 5 repeated words"),
            ],
            expected_improvement={
                "MTLD": f"{mtld_score:.2f} → 0.50",
                "IELTS Lexical Range Band": "+1 point (if other areas maintained)"
            }
        )
    
    @staticmethod
    def generate_toefl(
        mtld_score: float,
        examples: List[LearnerExample] = None
    ) -> IndicatorFeedback:
        """TOEFL values precision over variety"""
        
        return IndicatorFeedback(
            indicator_name="Lexical Diversity (MTLD)",
            test_context="TOEFL 'Language Use' cares about PRECISION: Using specific verbs > repeating 'good'. 3 different words = shows understanding.",
            learner_score=mtld_score,
            target_score=0.48,
            severity=Severity.YELLOW if mtld_score < 0.45 else Severity.GREEN,
            diagnosis=f"""Your MTLD = {mtld_score:.2f}.
TOEFL scores vocabulary by:
1. PRECISION: Technical word used correctly = points
2. VARIETY: Same idea expressed 3 ways = shows understanding
3. VAGUENESS PENALTY: "good", "bad", "thing" = points lost""",
            examples=examples or [],
            test_specific_insight="""Repetitive example (TOEFL loses points):
"Technology is good. It's good for education. Good for health."

Better (TOEFL gains points):
"Smartphones enhance learning. Wearables track health. AI automates diagnosis."
(Different verbs + different impacts = shows specific understanding)""",
            strategy="""Instead of varying synonyms, show DIFFERENT USES:
- Same technology, different contexts
- Different impacts, different verbs
- Results in better TOEFL scores""",
            practice_suggestions=[
                PracticeSuggestion("Vocabulary Coach", "Precise Verbs for Academic Writing", 15),
                PracticeSuggestion("SRS Module", "Synonym expansions (focused)", 10),
            ],
            expected_improvement={
                "MTLD": f"{mtld_score:.2f} → 0.48",
                "TOEFL Writing Score": "+1-2 points"
            }
        )


class VocabularyCoverageFeedback:
    """Feedback for AWL (Academic Word List) coverage indicator"""
    
    @staticmethod
    def generate_feedback(
        awl_score: float,
        target_test: TargetTest,
        cefr_level: CEFRLevel
    ) -> IndicatorFeedback:
        """Academic vocabulary coverage (0-100%)"""
        
        cefr_targets = {
            CEFRLevel.A2: 5.0,
            CEFRLevel.B1: 10.0,
            CEFRLevel.B2: 15.0,
            CEFRLevel.C1: 25.0,
            CEFRLevel.C2: 35.0,
        }
        target = cefr_targets.get(cefr_level, 15.0)
        
        return IndicatorFeedback(
            indicator_name="Vocabulary Coverage (AWL %)",
            test_context="Academic writing uses 15-25% Academic Word List. General conversation uses <5%. Domain matters: academic essays need higher AWL, daily narration needs lower AWL.",
            learner_score=awl_score,
            target_score=target,
            severity=Severity.RED if awl_score < target * 0.5 else (Severity.YELLOW if awl_score < target else Severity.GREEN),
            diagnosis=f"""Your essays use {awl_score:.1f}% Academic Word List (target: {target:.1f}%).
Current pattern: You're using {awl_score:.0f}% academic vocabulary.

Band indicator:
- <5%: General/narrative (Band 5-6 vocabulary range)
- 5-10%: Developing academic vocabulary
- 10-20%: Good academic vocabulary
- 20%+: Excellent academic range""",
            examples=[
                LearnerExample(
                    text="The internet makes education possible for more people.",
                    issue_description="Simple vocabulary (no academic terms)",
                    correct_version="The internet facilitates access to educational resources, thereby enabling broader participation."
                ),
                LearnerExample(
                    text="Climate change affects the environment.",
                    issue_description="General vocabulary",
                    correct_version="Anthropogenic climate change precipitates environmental degradation across multiple ecological systems."
                ),
            ],
            test_specific_insight=f"""Test expectations for {target_test.value}:
- IELTS academic: 12-18% AWL for Band 7-8
- TOEFL: 10-15% AWL for high scores
- Cambridge: 15-25% AWL for C1-C2 levels

Current: {awl_score:.1f}% → Gap: {max(0, target - awl_score):.1f}%""",
            strategy=f"""Step 1: Learn 20-30 key academic words for your domain
Step 2: Replace common words with academic synonyms
- "make" → facilitate, enable, promote, contribute to
- "use" → utilize, employ, leverage, harness
- "show" → demonstrate, illustrate, exhibit, reveal
- "have" → possess, exhibit, display, manifest

Step 3: Target {target:.0f}% by end of this cycle.""",
            practice_suggestions=[
                PracticeSuggestion("Vocabulary Coach", f"Academic Word List ({cefr_level.value})", 20),
                PracticeSuggestion("SRS Module", "Academic synonyms", 15),
                PracticeSuggestion("Shadow Speaking", "Read academic sources", 25),
            ],
            expected_improvement={
                "AWL %": f"{awl_score:.1f}% → {min(awl_score + 5.0, target + 5.0):.1f}%",
                "Essay vocabulary band": "+1 point"
            }
        )


class SyntacticComplexityFeedback:
    """Feedback for syntactic complexity indicators (MLS, MLT, MLC)"""
    
    @staticmethod
    def generate_mls_feedback(
        mls_score: float,
        target_test: TargetTest,
        cefr_level: CEFRLevel
    ) -> IndicatorFeedback:
        """Mean Length of Sentence (words/sentence)"""
        
        cefr_targets = {
            CEFRLevel.A2: 9.0,
            CEFRLevel.B1: 12.0,
            CEFRLevel.B2: 15.0,
            CEFRLevel.C1: 18.0,
            CEFRLevel.C2: 20.0,
        }
        target = cefr_targets.get(cefr_level, 15.0)
        
        return IndicatorFeedback(
            indicator_name="Sentence Complexity (MLS)",
            test_context="Longer sentences show complexity, but quality matters. 8-word sentences = simplistic. 15+ word sentences = sophisticated. Target balance: 60-80% complex sentences.",
            learner_score=mls_score,
            target_score=target,
            severity=Severity.RED if mls_score < target * 0.5 else (Severity.YELLOW if mls_score < target else Severity.GREEN),
            diagnosis=f"""Your average sentence length: {mls_score:.1f} words (target: {target:.1f}).
At {mls_score:.1f} words/sentence, you're using primarily simple structures.""",
            examples=[
                LearnerExample(
                    text="I like technology. It helps people. People use it every day.",
                    issue_description="All simple sentences (3-4 words each)",
                    correct_version="Technology, which pervades modern society, fundamentally enhances human capability across multiple domains."
                ),
            ],
            test_specific_insight=f"""Complex sentence progression:
B1: Mix of simple (7-8w) + compound (12-15w)
B2: Mostly complex (15-18w) with subordinate clauses
C1: Sophisticated structures (18-22w) with embedded clauses""",
            strategy="""Technique: Add subordinate clauses
"Technology helps people." (5w)
→ "Although technology initially overwhelms some users, it ultimately helps them." (13w)
→ "Technology, which continuously evolves, helps people who embrace innovation." (11w)

Target practice: Write 5 sentences ≥ 15 words each.""",
            practice_suggestions=[
                PracticeSuggestion("Grammar Module", "Complex sentences (subordination)", 20),
                PracticeSuggestion("Discourse Module", "Relative clauses", 15),
            ],
            expected_improvement={
                "MLS": f"{mls_score:.1f} → {mls_score + 3.0:.1f}",
                "Complexity band": "+1 level"
            }
        )
    
    @staticmethod
    def generate_mlt_feedback(
        mlt_score: float,
        target_test: TargetTest,
        cefr_level: CEFRLevel
    ) -> IndicatorFeedback:
        """Mean Length of T-unit"""
        
        cefr_targets = {
            CEFRLevel.A2: 13.7,
            CEFRLevel.B1: 15.0,
            CEFRLevel.B2: 17.0,
            CEFRLevel.C1: 19.0,
            CEFRLevel.C2: 21.0,
        }
        target = cefr_targets.get(cefr_level, 17.0)
        
        return IndicatorFeedback(
            indicator_name="T-unit Complexity (MLT)",
            test_context="T-units measure structural sophistication (main clause + all subordinates). Higher MLT = ability to integrate complex ideas.",
            learner_score=mlt_score,
            target_score=target,
            severity=Severity.RED if mlt_score < target * 0.5 else (Severity.YELLOW if mlt_score < target else Severity.GREEN),
            diagnosis=f"""Your T-unit length: {mlt_score:.1f} words (target: {target:.1f}).
This indicates moderate syntactic complexity. To reach {cefr_level.value}, integrate more subordination.""",
            examples=[],
            test_specific_insight=f"""T-unit structure shows idea integration:
B1: Simple + 1 subordinate = {cefr_targets[CEFRLevel.B1]:.0f}w average
B2: Main + 2-3 subordinates = {cefr_targets[CEFRLevel.B2]:.0f}w average
C1: Complex nesting = {cefr_targets[CEFRLevel.C1]:.0f}w+ average""",
            strategy="Add dependent clauses: (when, because, although, if, which, that, while)",
            practice_suggestions=[
                PracticeSuggestion("Grammar Module", "Subordinate clauses", 20),
            ],
            expected_improvement={
                "MLT": f"{mlt_score:.1f} → {mlt_score + 2.5:.1f}"
            }
        )
    
    @staticmethod
    def generate_mlc_feedback(
        mlc_score: float,
        target_test: TargetTest,
        cefr_level: CEFRLevel
    ) -> IndicatorFeedback:
        """Mean Length of Clause"""
        
        cefr_targets = {
            CEFRLevel.A2: 8.4,
            CEFRLevel.B1: 8.6,
            CEFRLevel.B2: 9.9,
            CEFRLevel.C1: 10.5,
            CEFRLevel.C2: 11.0,
        }
        target = cefr_targets.get(cefr_level, 9.9)
        
        return IndicatorFeedback(
            indicator_name="Clause Complexity (MLC)",
            test_context="Clauses are basic units. Longer clauses = more information per unit = sophistication.",
            learner_score=mlc_score,
            target_score=target,
            severity=Severity.RED if mlc_score < target * 0.5 else (Severity.YELLOW if mlc_score < target else Severity.GREEN),
            diagnosis=f"""Your clause length: {mlc_score:.1f} words (target: {target:.1f}).""",
            examples=[],
            test_specific_insight="Higher MLC = more information density per clause",
            strategy="Expand clauses with modifiers: adverbs, prepositional phrases, adjectives",
            practice_suggestions=[
                PracticeSuggestion("Grammar Module", "Clause expansion", 15),
            ],
            expected_improvement={
                "MLC": f"{mlc_score:.1f} → {mlc_score + 1.0:.1f}"
            }
        )


class CoherenceFeedback:
    """Feedback for coherence and discourse structure"""
    
    @staticmethod
    def generate_feedback(
        coherence_score: float,
        target_test: TargetTest,
        cefr_level: CEFRLevel
    ) -> IndicatorFeedback:
        """Coherence (0-1 scale)"""
        
        return IndicatorFeedback(
            indicator_name="Discourse Coherence",
            test_context=f"{target_test.value} scoring: Coherence is 20-25% of score. Ideas must flow logically. Transitions ('however', 'therefore') are critical.",
            learner_score=coherence_score,
            target_score=0.85,
            severity=Severity.RED if coherence_score < 0.60 else (Severity.YELLOW if coherence_score < 0.75 else Severity.GREEN),
            diagnosis=f"""Coherence score: {coherence_score:.2f}/1.0
This measures logical flow and connectivity of ideas.""",
            examples=[
                LearnerExample(
                    text="Social media is important. It is bad. People use it.",
                    issue_description="Ideas disconnected, no flow",
                    correct_version="Although social media provides valuable connectivity, excessive use precipitates mental health concerns. Consequently, users must establish healthy boundaries."
                ),
            ],
            test_specific_insight="""Coherence markers:
- Weak: Random sentence order, missing transitions
- Strong: Topic sentences, logical progression, discourse markers
- Excellent: Sophisticated transitions, parallel structure""",
            strategy="""1. Start each paragraph with topic sentence
2. Use transition words: however, therefore, furthermore, in contrast, hence
3. Ensure each sentence supports main idea
4. End with conclusion that ties ideas together""",
            practice_suggestions=[
                PracticeSuggestion("Discourse Module", "Paragraph organization", 20),
                PracticeSuggestion("Discourse Module", "Transition words", 15),
            ],
            expected_improvement={
                "Coherence": f"{coherence_score:.2f} → 0.85+",
                f"{target_test.value} Coherence band": "+1 point"
            }
        )


class PronunciationFeedback:
    """Feedback for pronunciation accuracy"""
    
    @staticmethod
    def generate_feedback(
        pronunciation_score: float,
        target_test: TargetTest,
        cefr_level: CEFRLevel
    ) -> IndicatorFeedback:
        """Pronunciation intelligibility (0-1 scale)"""
        
        cefr_targets = {
            CEFRLevel.A2: 0.70,
            CEFRLevel.B1: 0.80,
            CEFRLevel.B2: 0.90,
            CEFRLevel.C1: 0.95,
            CEFRLevel.C2: 0.98,
        }
        target = cefr_targets.get(cefr_level, 0.85)
        
        return IndicatorFeedback(
            indicator_name="Pronunciation Intelligibility",
            test_context="Speaking tests score pronunciation as part of overall intelligibility. Native accent NOT required. Clear, consistent pronunciation = high marks.",
            learner_score=pronunciation_score,
            target_score=target,
            severity=Severity.RED if pronunciation_score < target * 0.7 else (Severity.YELLOW if pronunciation_score < target else Severity.GREEN),
            diagnosis=f"""Pronunciation intelligibility: {pronunciation_score:.0%}
Common Romanian → English errors:
- /θ/ → [t]: "think" sounds like "tink"
- /ə/ → missing: "about" sounds like "aboot"
- Vowel length: /iː/ vs /ɪ/ confusion
- Aspiration: /p/ /t/ /k/ need stronger breath""",
            examples=[
                LearnerExample(
                    text="think",
                    issue_description="/θ/ produced as [t]",
                    correct_version="Teeth together, tongue between teeth, air through"
                ),
            ],
            test_specific_insight=f"""{target_test.value} pronunciation standards:
- Not native accent required
- Consistent pronunciation important
- Intelligibility: Native speaker understands on first hearing
- {cefr_level.value} target: {target:.0%} accuracy""",
            strategy="""Prioritize (% impact):
1. Th-sounds (/θ/, /ð/): 15%
2. Word stress: 20%
3. Vowel length: 15%
4. Connected speech: 10%""",
            practice_suggestions=[
                PracticeSuggestion("Accent DNA Module", "Romanian-specific errors", 20),
                PracticeSuggestion("Shadow Speaking", "Mimic native speakers", 15),
                PracticeSuggestion("Praat Analysis", "Formant visualization", 10),
            ],
            expected_improvement={
                "Intelligibility": f"{pronunciation_score:.0%} → {min(target + 0.05, 1.0):.0%}",
                "IELTS Speaking Pronunciation band": "+1 point"
            }
        )


class FluencyFeedback:
    """Feedback for speech fluency (articulation rate and pausing)"""
    
    @staticmethod
    def generate_articulation_feedback(
        articulation_score: float,
        target_test: TargetTest,
        cefr_level: CEFRLevel
    ) -> IndicatorFeedback:
        """Articulation rate (words/second)"""
        
        cefr_targets = {
            CEFRLevel.A2: 1.5,
            CEFRLevel.B1: 2.0,
            CEFRLevel.B2: 2.5,
            CEFRLevel.C1: 3.0,
            CEFRLevel.C2: 3.5,
        }
        target = cefr_targets.get(cefr_level, 2.5)
        
        return IndicatorFeedback(
            indicator_name="Articulation Rate",
            test_context="Speed of clear speech (excluding pauses). 1-2 w/s = slow (B1). 3+ w/s = native-like (C1+). Quality > quantity.",
            learner_score=articulation_score,
            target_score=target,
            severity=Severity.RED if articulation_score < target * 0.5 else (Severity.YELLOW if articulation_score < target else Severity.GREEN),
            diagnosis=f"""Your articulation rate: {articulation_score:.1f} w/s (target: {target:.1f}).
At {articulation_score:.1f} w/s, your speech is {'clear but cautious' if articulation_score < 2.5 else 'well-paced'}.""",
            examples=[],
            test_specific_insight=f"""Fluency perception:
- <1.5 w/s: Hesitant, struggling
- 1.5-2.5 w/s: Deliberate, controlled {cefr_level.value}
- 2.5-3.5 w/s: Natural, confident
- 3.5+ w/s: Native-like""",
            strategy="""To increase articulation rate WITHOUT sacrificing clarity:
1. Practice chunking: speak in phrases, not word-by-word
2. Reduce filler pauses (um, uh, like)
3. Increase breath efficiency
4. Practice shadowing native speakers""",
            practice_suggestions=[
                PracticeSuggestion("Shadow Speaking", "Match native speaker pace", 20),
                PracticeSuggestion("Exercises Module", "Fluency drills", 15),
            ],
            expected_improvement={
                "Articulation rate": f"{articulation_score:.1f} → {articulation_score + 0.5:.1f} w/s",
                "Fluency band": "+1 point"
            }
        )
    
    @staticmethod
    def generate_pause_feedback(
        pause_frequency: float,
        target_test: TargetTest,
        cefr_level: CEFRLevel
    ) -> IndicatorFeedback:
        """Micro-fluency (pause patterns)"""
        
        return IndicatorFeedback(
            indicator_name="Micro-Fluency (Pausing)",
            test_context="Natural pausing shows thinking + planning. Too many pauses = hesitation. Few pauses = over-rehearsed. Ideal: pauses at clause boundaries.",
            learner_score=pause_frequency,
            target_score=0.15,
            severity=Severity.RED if pause_frequency > 0.35 else (Severity.YELLOW if pause_frequency > 0.20 else Severity.GREEN),
            diagnosis=f"""Your pause frequency: {pause_frequency:.0%}
{pause_frequency:.0%} of speech is pauses.

Pattern analysis:
- 5-10%: Natural pausing (native-like)
- 10-20%: Some hesitation (B2 level)
- 20-35%: Frequent pausing (B1 level)
- 35%+: Excessive hesitation (A2 level)""",
            examples=[],
            test_specific_insight=f"""Examiner perception:
- Pauses at clause boundaries = planning (positive)
- Random mid-phrase pauses = struggling (negative)
- Fluent speech with minimal pauses = confident""",
            strategy="""To reduce unnecessary pauses:
1. Prepare topic: know what you want to say
2. Use transition markers: "Well...", "You see..."
3. Speak in complete thoughts, not fragments
4. Avoid filler words: um, uh, like, you know""",
            practice_suggestions=[
                PracticeSuggestion("Exercises Module", "Fluency without pauses", 15),
                PracticeSuggestion("Conversation Module", "Planned responses", 20),
            ],
            expected_improvement={
                "Pause frequency": f"{pause_frequency:.0%} → 12%",
                "Fluency perception": "+1 band"
            }
        )


def generate_feedback(
    indicator_name: str,
    score: float,
    target_test: TargetTest,
    cefr_level: CEFRLevel,
    examples: List[LearnerExample] = None,
    domain: str = None
) -> Optional[IndicatorFeedback]:
    """
    Main function: Generate feedback for an indicator
    
    Args:
        indicator_name: e.g., "WCR", "MTLD", "Pronunciation"
        score: Learner's score for this indicator
        target_test: TargetTest enum (IELTS, TOEFL, CAMBRIDGE, GENERAL)
        cefr_level: CEFRLevel enum (A2, B1, B2, C1, C2)
        examples: Optional learner examples to include in feedback
        domain: Optional COCA genre domain (spoken, academic, newspaper, fiction, magazine, web, blog, movies, tv) for error pattern context
    
    Returns:
        IndicatorFeedback object or None if not implemented
    """
    
    ind = indicator_name.upper()
    
    # Grammar Accuracy (WCR)
    if ind == "WCR":
        if target_test == TargetTest.IELTS:
            return GrammarAccuracyFeedback.generate_ielts(score, cefr_level, examples)
        elif target_test == TargetTest.TOEFL:
            return GrammarAccuracyFeedback.generate_toefl(score, cefr_level, examples)
        elif target_test == TargetTest.CAMBRIDGE:
            return GrammarAccuracyFeedback.generate_cambridge(score, cefr_level, examples)
    
    # Lexical Diversity (MTLD)
    elif ind == "MTLD":
        if target_test == TargetTest.IELTS:
            return LexicalDiversityFeedback.generate_ielts(score, examples)
        elif target_test == TargetTest.TOEFL:
            return LexicalDiversityFeedback.generate_toefl(score, examples)
        else:
            return LexicalDiversityFeedback.generate_ielts(score, examples)  # default
    
    # Vocabulary Coverage (AWL)
    elif ind == "AWL":
        return VocabularyCoverageFeedback.generate_feedback(score, target_test, cefr_level)
    
    # Syntactic Complexity
    elif ind == "MLS":
        return SyntacticComplexityFeedback.generate_mls_feedback(score, target_test, cefr_level)
    elif ind == "MLT":
        return SyntacticComplexityFeedback.generate_mlt_feedback(score, target_test, cefr_level)
    elif ind == "MLC":
        return SyntacticComplexityFeedback.generate_mlc_feedback(score, target_test, cefr_level)
    
    # Coherence
    elif ind == "COHERENCE":
        return CoherenceFeedback.generate_feedback(score, target_test, cefr_level)
    
    # Pronunciation
    elif ind == "PRONUNCIATION":
        return PronunciationFeedback.generate_feedback(score, target_test, cefr_level)
    
    # Articulation Rate
    elif ind == "ARTICULATION":
        return FluencyFeedback.generate_articulation_feedback(score, target_test, cefr_level)
    
    # Micro-Fluency (Pausing)
    elif ind == "MICRO-FLUENCY":
        return FluencyFeedback.generate_pause_feedback(score, target_test, cefr_level)
    
    return None


def get_domain_error_patterns(domain: str) -> Dict[str, List[Dict]]:
    """
    Get domain-specific error patterns from corpus analysis
    
    Used to contextualize feedback within learner's domain of practice
    """
    
    try:
        from app.services.pos_error_patterns import POSErrorPatternManager

        manager = POSErrorPatternManager()
        error_patterns = manager.get_errors_by_domain(domain.lower(), sort_by_frequency=True)
        
        # Format for inclusion in feedback
        formatted_patterns = []
        for pattern in error_patterns[:5]:  # Top 5 error patterns for domain
            formatted_patterns.append({
                "error_id": pattern.error_id,
                "pos_tag": pattern.pos_tag.value,
                "error_type": pattern.error_type.value,
                "frequency_percentage": pattern.frequency_percentage,
                "example_correct": pattern.example_correct,
                "example_incorrect": pattern.example_incorrect,
                "correction_rules": pattern.correction_rules,
            })
        
        return {
            "domain": domain,
            "top_error_patterns": formatted_patterns,
            "total_patterns": len(error_patterns)
        }
    
    except Exception as e:
        # Return empty if pos_error_patterns not available
        return {
            "domain": domain,
            "top_error_patterns": [],
            "total_patterns": 0
        }


# Example usage
if __name__ == "__main__":
    # Generate IELTS-specific grammar feedback
    feedback = generate_feedback(
        indicator_name="WCR",
        score=0.45,
        target_test=TargetTest.IELTS,
        cefr_level=CEFRLevel.B1,
        examples=[
            LearnerExample(
                text="I was wanting to become an engineer.",
                issue_description="Incorrect auxiliary tense",
                correct_version="I want to become an engineer."
            )
        ],
        domain="academic"
    )
    
    if feedback:
        print(feedback.to_markdown())
        print("\n" + "="*60)
        print(f"Expected Improvement: {feedback.expected_improvement}")
    
    # Get domain-specific error patterns
    print("\n" + "="*60)
    print("Domain Error Patterns:")
    patterns = get_domain_error_patterns("academic")
    print(json.dumps(patterns, indent=2))
