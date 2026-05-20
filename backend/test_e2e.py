#!/usr/bin/env python
"""
End-to-End Testing Script
Tests complete workflow: Database → Benchmarks → Assessment → Recommendations → Feedback → Pilot Study

Run: python test_e2e.py
"""

import sys
import os
import json
from datetime import datetime
from typing import Dict, Any

# Add backend to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from database import init_db, SessionLocal, CEFRBenchmark, RomanianLearnerBenchmark, Assessment, AssessmentIndicators, ProficiencyPrediction, User, PilotStudyParticipant
from load_benchmarks import load_icnale_benchmarks, load_romanian_benchmarks, verify_benchmarks
from module_recommendation_algorithm import ModuleRecommender, AssessmentIndicators as AlgoIndicators, CEFRLevel
from feedback_templates import generate_feedback
from pilot_study_manager import PilotStudyManager, AssessmentScores, OfficialTest, CEFRLevel as StudyCEFRLevel


class E2ETestSuite:
    """End-to-end testing suite"""
    
    def __init__(self):
        self.passed = 0
        self.failed = 0
        self.results = []
    
    def test(self, name: str, func):
        """Run a test and track results"""
        print(f"\n{'='*70}")
        print(f"TEST: {name}")
        print(f"{'='*70}")
        
        try:
            result = func()
            self.passed += 1
            self.results.append({"test": name, "status": "PASS", "result": result})
            print(f"✅ PASSED")
            return result
        except Exception as e:
            self.failed += 1
            self.results.append({"test": name, "status": "FAIL", "error": str(e)})
            print(f"❌ FAILED: {e}")
            import traceback
            traceback.print_exc()
            return None
    
    def report(self):
        """Print test report"""
        print(f"\n{'='*70}")
        print(f"TEST REPORT")
        print(f"{'='*70}")
        print(f"✅ Passed: {self.passed}")
        print(f"❌ Failed: {self.failed}")
        print(f"📊 Total: {self.passed + self.failed}")
        
        if self.failed == 0:
            print("\n🎉 ALL TESTS PASSED!")
        
        return {"passed": self.passed, "failed": self.failed, "details": self.results}


# ============================================================================
# TEST CASES
# ============================================================================

def test_database_initialization():
    """Test 1: Database initialization"""
    init_db()
    db = SessionLocal()
    try:
        # Check if tables exist by counting
        user_count = db.query(User).count()
        assessment_count = db.query(Assessment).count()
        print(f"   Users: {user_count}")
        print(f"   Assessments: {assessment_count}")
        return True
    finally:
        db.close()


def test_benchmark_loading():
    """Test 2: Load ICNALE benchmarks"""
    load_icnale_benchmarks()
    
    db = SessionLocal()
    try:
        benchmarks = db.query(CEFRBenchmark).all()
        assert len(benchmarks) > 0, "No benchmarks loaded"
        
        # Check A2, B1, B2 exist
        levels = [b.cefr_level for b in benchmarks]
        print(f"   Loaded levels: {levels}")
        
        for level in ["A2", "B1", "B2"]:
            benchmark = db.query(CEFRBenchmark).filter(CEFRBenchmark.cefr_level == level).first()
            assert benchmark is not None, f"Missing benchmark for {level}"
            assert benchmark.wcr_mean > 0, f"Invalid WCR for {level}"
            print(f"   ✓ {level}: WCR={benchmark.wcr_mean:.2f}, Fluency={benchmark.fluency_mean} WPM")
        
        return len(benchmarks)
    finally:
        db.close()


def test_romanian_benchmarks():
    """Test 3: Load Romanian learner benchmarks"""
    load_romanian_benchmarks()
    
    db = SessionLocal()
    try:
        benchmarks = db.query(RomanianLearnerBenchmark).all()
        assert len(benchmarks) > 0, "No Romanian benchmarks loaded"
        
        levels = [b.cefr_level for b in benchmarks]
        print(f"   Loaded levels: {levels}")
        
        # Check top error patterns
        b1_bench = db.query(RomanianLearnerBenchmark).filter(
            RomanianLearnerBenchmark.cefr_level == "B1"
        ).first()
        
        if b1_bench:
            print(f"   B1 Top Error 1: {b1_bench.top_error_type_1} ({b1_bench.error_frequency_1}%)")
            print(f"   B1 Top Error 2: {b1_bench.top_error_type_2} ({b1_bench.error_frequency_2}%)")
        
        return len(benchmarks)
    finally:
        db.close()


def test_module_recommendation():
    """Test 4: Module recommendation algorithm"""
    
    # Create sample indicators (B1 learner, IELTS)
    indicators = AlgoIndicators(
        mtld=0.40,          # Below B1 mean (0.42)
        awl_percent=0.08,   # Below B1 mean
        mls=15.5,           # Below B1 mean (16.50)
        mlt=14.2,           # Below B1 mean (14.80)
        mlc=8.6,            # Below B1 mean (8.75)
        wcr=0.45,           # CRITICAL - way below B1 (0.87)
        pronunciation=0.68, # Below B1 (0.80)
        fluency_wpm=140,    # Below B1 (200)
        micro_fluency=0.35, # OK for B1
        coherence=0.42      # Below B1 (0.50)
    )
    
    recommender = ModuleRecommender(
        cefr_level=CEFRLevel.B1,
        target_test="IELTS"
    )
    
    recommendations = recommender.recommend(indicators, limit=3)
    
    print(f"   Generated {len(recommendations)} recommendations:")
    for rec in recommendations:
        print(f"   #{rec.rank}: {rec.module_name} (severity={rec.severity_score:.2f})")
    
    assert len(recommendations) > 0, "No recommendations generated"
    assert recommendations[0].rank == 1, "Ranking incorrect"
    
    return recommendations


def test_feedback_generation():
    """Test 5: Test-specific feedback generation"""
    
    # Generate IELTS feedback for WCR (0.45)
    feedback_ielts = generate_feedback(
        indicator_name="WCR",
        learner_score=0.45,
        target_test="IELTS",
        cefr_level="B1",
        examples=[]
    )
    
    print(f"   IELTS WCR Feedback:")
    print(f"   - Diagnosis: {feedback_ielts.diagnosis[:80]}...")
    print(f"   - Strategy: {feedback_ielts.strategy[:80]}...")
    print(f"   - Timeline: {feedback_ielts.timeline_weeks} weeks")
    
    # Generate TOEFL feedback for same indicator
    feedback_toefl = generate_feedback(
        indicator_name="WCR",
        learner_score=0.45,
        target_test="TOEFL_IBT",
        cefr_level="B1",
        examples=[]
    )
    
    # They should be different
    assert feedback_ielts.diagnosis != feedback_toefl.diagnosis, "Feedback should vary by test"
    
    print(f"   TOEFL WCR Feedback differs: ✓")
    
    return feedback_ielts


def test_pilot_study_workflow():
    """Test 6: Pilot study enrollment & tracking"""
    
    manager = PilotStudyManager()
    manager.study_start_date = datetime.now()
    
    # 1. Enroll participant
    p1_id = manager.enroll_participant("Romanian", StudyCEFRLevel.B1, OfficialTest.IELTS)
    print(f"   Enrolled: {p1_id}")
    
    # 2. Add baseline assessment
    baseline_scores = AssessmentScores(
        mtld=0.40, awl_percent=0.08, mls=15.5, mlt=14.2, mlc=8.6,
        wcr=0.45, pronunciation=0.68, fluency_wpm=140, micro_fluency=0.35, coherence=0.42
    )
    
    manager.add_baseline_assessment(p1_id, baseline_scores, "B1")
    print(f"   Baseline recorded")
    
    # 3. Add post-test assessment
    posttest_scores = AssessmentScores(
        mtld=0.48, awl_percent=0.12, mls=16.5, mlt=15.0, mlc=8.9,
        wcr=0.62, pronunciation=0.75, fluency_wpm=150, micro_fluency=0.30, coherence=0.50
    )
    
    manager.add_post_test_assessment(p1_id, posttest_scores, "B1")
    print(f"   Post-test recorded")
    
    # 4. Add official test score
    manager.add_official_test_score(p1_id, OfficialTest.IELTS, "B1")
    print(f"   Official score: B1")
    
    # 5. Generate validation report
    report = manager.generate_validation_report()
    print(f"   Sample size: {report['complete_participants']}")
    print(f"   Correlation r: {report['primary_result']['correlation_r']:.3f}")
    print(f"   Status: {report['primary_result']['status']}")
    
    return report


def test_database_persistence():
    """Test 7: Data persistence to database"""
    
    db = SessionLocal()
    try:
        # Create a test user
        user = User(
            email=f"test_{datetime.now().timestamp()}@example.com",
            first_name="Test",
            last_name="User",
            native_language="Romanian",
            self_assessed_level="B1"
        )
        db.add(user)
        db.commit()
        
        user_id = user.user_id
        print(f"   Created user: {user_id}")
        
        # Create an assessment
        assessment = Assessment(
            user_id=user_id,
            assessment_type="writing",
            text_input="This is a test assessment.",
            word_count=5,
            status="completed"
        )
        db.add(assessment)
        db.commit()
        
        assessment_id = assessment.assessment_id
        print(f"   Created assessment: {assessment_id}")
        
        # Add indicators
        indicators = AssessmentIndicators(
            assessment_id=assessment_id,
            mtld=0.40,
            awl_percent=0.08,
            mls=15.5,
            mlt=14.2,
            mlc=8.6,
            wcr=0.45,
            pronunciation=0.68,
            fluency_wpm=140,
            micro_fluency=0.35,
            coherence=0.42
        )
        db.add(indicators)
        db.commit()
        
        print(f"   Created indicators for assessment")
        
        # Verify retrieval
        retrieved = db.query(Assessment).filter(Assessment.assessment_id == assessment_id).first()
        assert retrieved is not None, "Could not retrieve assessment"
        assert retrieved.indicators.wcr == 0.45, "Indicator data mismatch"
        
        print(f"   ✓ Data persisted and retrieved successfully")
        
        return True
        
    finally:
        db.close()


def test_benchmark_threshold_lookup():
    """Test 8: Threshold lookup for adaptive recommendations"""
    
    db = SessionLocal()
    try:
        # Get B1 thresholds
        b1_bench = db.query(CEFRBenchmark).filter(CEFRBenchmark.cefr_level == "B1").first()
        
        print(f"   B1 Thresholds:")
        print(f"   - WCR: {b1_bench.wcr_mean:.2f} (range: {b1_bench.wcr_min:.2f}-{b1_bench.wcr_max:.2f})")
        print(f"   - MTLD: {b1_bench.mtld_mean:.2f} (range: {b1_bench.mtld_min:.2f}-{b1_bench.mtld_max:.2f})")
        print(f"   - Fluency: {b1_bench.fluency_mean} WPM")
        
        # Learner at 0.45 WCR (45% below threshold)
        deficit = (b1_bench.wcr_mean - 0.45) / b1_bench.wcr_mean * 100
        print(f"   - Learner WCR: 0.45 ({deficit:.1f}% below threshold)")
        
        assert deficit > 40, "Deficit calculation incorrect"
        
        return b1_bench
        
    finally:
        db.close()


# ============================================================================
# MAIN TEST RUNNER
# ============================================================================

def main():
    """Run all tests"""
    
    print("\n")
    print("╔" + "=" * 68 + "╗")
    print("║" + " " * 68 + "║")
    print("║" + "  END-TO-END TEST SUITE".center(68) + "║")
    print("║" + "  English Diagnostic System - Romanian Learners".center(68) + "║")
    print("║" + " " * 68 + "║")
    print("╚" + "=" * 68 + "╝")
    
    suite = E2ETestSuite()
    
    # Run tests in sequence
    suite.test("Database Initialization", test_database_initialization)
    suite.test("Load ICNALE Benchmarks", test_benchmark_loading)
    suite.test("Load Romanian Benchmarks", test_romanian_benchmarks)
    suite.test("Module Recommendations", test_module_recommendation)
    suite.test("Feedback Generation", test_feedback_generation)
    suite.test("Pilot Study Workflow", test_pilot_study_workflow)
    suite.test("Database Persistence", test_database_persistence)
    suite.test("Benchmark Thresholds", test_benchmark_threshold_lookup)
    
    # Print report
    report = suite.report()
    
    # Save results
    with open("test_results.json", "w") as f:
        json.dump(report, f, indent=2, default=str)
    
    print(f"\n📊 Results saved to: test_results.json")
    
    return 0 if suite.failed == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
