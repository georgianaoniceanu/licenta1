"""
Load ICNALE and Romanian learner benchmarks into database

Source: Barrot & Agdeppa (2021) - ICNALE corpus analysis
"""

from database import SessionLocal, CEFRBenchmark, RomanianLearnerBenchmark


def load_icnale_benchmarks():
    """Load ICNALE benchmarks from Barrot 2021"""
    
    benchmarks = [
        {
            "cefr_level": "A2",
            "mtld_mean": 0.32,
            "mtld_min": 0.25,
            "mtld_max": 0.40,
            "awl_coverage_mean": 3.5,
            "mls_mean": 15.18,
            "mlt_mean": 13.69,
            "mlc_mean": 8.39,
            "wcr_mean": 0.84,
            "wcr_min": 0.75,
            "wcr_max": 0.92,
            "pronunciation_mean": 60,
            "fluency_mean": 150,
            "fluency_min": 120,
            "fluency_max": 180,
            "micro_fluency_mean": 0.45,
            "coherence_mean": 0.35,
            "coherence_min": 0.20,
            "coherence_max": 0.50,
            "source_corpus": "ICNALE",
            "sample_size": 997,
            "notes": "Elementary level (997 learners)"
        },
        {
            "cefr_level": "B1",
            "mtld_mean": 0.42,
            "mtld_min": 0.35,
            "mtld_max": 0.50,
            "awl_coverage_mean": 7.5,
            "mls_mean": 16.50,
            "mlt_mean": 14.80,
            "mlc_mean": 8.75,
            "wcr_mean": 0.87,
            "wcr_min": 0.80,
            "wcr_max": 0.94,
            "pronunciation_mean": 80,
            "fluency_mean": 200,
            "fluency_min": 170,
            "fluency_max": 230,
            "micro_fluency_mean": 0.35,
            "coherence_mean": 0.50,
            "coherence_min": 0.40,
            "coherence_max": 0.65,
            "source_corpus": "ICNALE",
            "sample_size": 3775,
            "notes": "Intermediate level (3775 learners) - most frequent level"
        },
        {
            "cefr_level": "B2",
            "mtld_mean": 0.58,
            "mtld_min": 0.48,
            "mtld_max": 0.68,
            "awl_coverage_mean": 15.0,
            "mls_mean": 18.50,
            "mlt_mean": 16.50,
            "mlc_mean": 9.65,
            "wcr_mean": 0.92,
            "wcr_min": 0.88,
            "wcr_max": 0.97,
            "pronunciation_mean": 85,
            "fluency_mean": 260,
            "fluency_min": 230,
            "fluency_max": 290,
            "micro_fluency_mean": 0.25,
            "coherence_mean": 0.65,
            "coherence_min": 0.55,
            "coherence_max": 0.80,
            "source_corpus": "ICNALE",
            "sample_size": 464,
            "notes": "Upper-intermediate level (464 learners)"
        },
        {
            "cefr_level": "C1",
            "mtld_mean": 0.72,
            "mtld_min": 0.62,
            "mtld_max": 0.82,
            "awl_coverage_mean": 30.0,
            "mls_mean": 20.0,
            "mlt_mean": 18.0,
            "mlc_mean": 10.0,
            "wcr_mean": 0.96,
            "wcr_min": 0.94,
            "wcr_max": 0.99,
            "pronunciation_mean": 92,
            "fluency_mean": 300,
            "fluency_min": 280,
            "fluency_max": 320,
            "micro_fluency_mean": 0.15,
            "coherence_mean": 0.80,
            "coherence_min": 0.75,
            "coherence_max": 0.90,
            "source_corpus": "Estimated from ICNALE patterns",
            "sample_size": 50,
            "notes": "Advanced level (estimated from B2 patterns)"
        },
    ]
    
    db = SessionLocal()
    try:
        # Clear existing data
        db.query(CEFRBenchmark).delete()
        db.commit()
        
        # Load new data
        for bench_data in benchmarks:
            benchmark = CEFRBenchmark(**bench_data)
            db.add(benchmark)
        
        db.commit()
        print(f"✅ Loaded {len(benchmarks)} ICNALE benchmarks")
        
        # Display loaded data
        benchmarks = db.query(CEFRBenchmark).all()
        for b in benchmarks:
            print(f"   {b.cefr_level}: MTLD={b.mtld_mean:.2f}, WCR={b.wcr_mean:.2f}, Fluency={b.fluency_mean} WPM")
        
    finally:
        db.close()


def load_romanian_benchmarks():
    """Load Romanian learner-specific benchmarks from RoCLE"""
    
    benchmarks = [
        {
            "cefr_level": "A2",
            "mtld_mean": 0.28,
            "wcr_mean": 0.80,
            "mls_mean": 14.5,
            "pronunciation_accuracy": 65,
            "top_error_type_1": "article_overgeneralization",
            "error_frequency_1": 22,
            "top_error_type_2": "preposition_errors",
            "error_frequency_2": 18,
            "source_corpus": "RoCLE (Romanian Learner Corpus)",
            "sample_size": 30,
            "notes": "Romanian A2 learners (n=30)"
        },
        {
            "cefr_level": "B1",
            "mtld_mean": 0.38,
            "wcr_mean": 0.84,
            "mls_mean": 15.8,
            "pronunciation_accuracy": 75,
            "top_error_type_1": "preposition_errors",
            "error_frequency_1": 18,
            "top_error_type_2": "article_overgeneralization",
            "error_frequency_2": 15,
            "source_corpus": "RoCLE",
            "sample_size": 50,
            "notes": "Romanian B1 learners (n=50) - most common level"
        },
        {
            "cefr_level": "B2",
            "mtld_mean": 0.55,
            "wcr_mean": 0.90,
            "mls_mean": 18,
            "pronunciation_accuracy": 82,
            "top_error_type_1": "collocation_errors",
            "error_frequency_1": 10,
            "top_error_type_2": "coherence_markers",
            "error_frequency_2": 8,
            "source_corpus": "RoCLE",
            "sample_size": 30,
            "notes": "Romanian B2 learners (n=30)"
        },
        {
            "cefr_level": "C1",
            "mtld_mean": 0.68,
            "wcr_mean": 0.94,
            "mls_mean": 19.5,
            "pronunciation_accuracy": 88,
            "top_error_type_1": "register_appropriateness",
            "error_frequency_1": 5,
            "top_error_type_2": "discourse_pragmatics",
            "error_frequency_2": 3,
            "source_corpus": "RoCLE (estimated)",
            "sample_size": 10,
            "notes": "Romanian C1 learners (n=10, estimated)"
        },
    ]
    
    db = SessionLocal()
    try:
        # Clear existing data
        db.query(RomanianLearnerBenchmark).delete()
        db.commit()
        
        # Load new data
        for bench_data in benchmarks:
            benchmark = RomanianLearnerBenchmark(**bench_data)
            db.add(benchmark)
        
        db.commit()
        print(f"✅ Loaded {len(benchmarks)} Romanian learner benchmarks")
        
        # Display loaded data
        benchmarks = db.query(RomanianLearnerBenchmark).all()
        for b in benchmarks:
            print(f"   {b.cefr_level}: MTLD={b.mtld_mean:.2f}, Top error: {b.top_error_type_1} ({b.error_frequency_1}%)")
        
    finally:
        db.close()


def get_cefr_threshold(indicator_name: str, cefr_level: str) -> float:
    """Get CEFR threshold for an indicator"""
    
    db = SessionLocal()
    try:
        benchmark = db.query(CEFRBenchmark).filter(
            CEFRBenchmark.cefr_level == cefr_level
        ).first()
        
        if not benchmark:
            return 0.5  # default
        
        # Map indicator names to benchmark fields
        threshold_map = {
            "mtld": "mtld_mean",
            "wcr": "wcr_mean",
            "mls": "mls_mean",
            "mlt": "mlt_mean",
            "mlc": "mlc_mean",
            "awl_percent": "awl_coverage_mean",
            "pronunciation": "pronunciation_mean",
            "fluency_wpm": "fluency_mean",
            "coherence": "coherence_mean",
            "micro_fluency": "micro_fluency_mean",
        }
        
        field_name = threshold_map.get(indicator_name, "wcr_mean")
        return getattr(benchmark, field_name, 0.5)
        
    finally:
        db.close()


def verify_benchmarks():
    """Verify that benchmarks are loaded correctly"""
    
    db = SessionLocal()
    try:
        cefr_count = db.query(CEFRBenchmark).count()
        romanian_count = db.query(RomanianLearnerBenchmark).count()
        
        print(f"\n📊 Database Verification:")
        print(f"   CEFR Benchmarks: {cefr_count}")
        print(f"   Romanian Benchmarks: {romanian_count}")
        
        if cefr_count == 4 and romanian_count == 4:
            print("   ✅ All benchmarks loaded successfully!")
            return True
        else:
            print("   ⚠️ Some benchmarks missing")
            return False
            
    finally:
        db.close()


if __name__ == "__main__":
    print("=" * 60)
    print("BENCHMARK LOADER - ICNALE & Romanian Learner Data")
    print("=" * 60)
    
    load_icnale_benchmarks()
    print()
    load_romanian_benchmarks()
    print()
    verify_benchmarks()
    
    print("\n✅ Benchmark loading complete!")
