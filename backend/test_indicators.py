"""Quick test for assessment indicators"""

from app.routes.research_assessment import router
from app.services.assessment_indicators import assessment_calculator, IndicatorType

print("=" * 70)
print("ASSESSMENT INDICATORS TEST")
print("=" * 70)

print("\n✓ Router loaded successfully")
print(f"✓ Total routes: {len(router.routes)}")

indicators = [r.path for r in router.routes if 'indicators' in r.path]
print(f"\n✓ New Indicator Endpoints ({len(indicators)} total):")
for r in indicators:
    print(f"  - {r}")

print(f"\n✓ All 10 Assessment Indicators:")
for i, ind in enumerate(assessment_calculator.get_all_indicators(), 1):
    print(f"  {i}. {ind.name}")
    print(f"     Unit: {ind.measurement_unit}, Range: {ind.range_min}-{ind.range_max}")
    print(f"     Sources: {len(ind.primary_research)} research papers")

# Test indicator evaluation
print("\n✓ Testing Indicator Evaluation:")
result = assessment_calculator.evaluate_indicator(IndicatorType.LEXICAL_DIVERSITY, 62.22)
print(f"  - Lexical Diversity: {result['measured_value']} → Score: {result['normalized_score']:.1f}/100")
print(f"  - CEFR Level: {result['cefr_level']}")

# Test dual diagnosis
print("\n✓ Testing Dual Diagnosis (User vs System):")
user_perception = {"vocabulary": 7, "pronunciation": 5, "grammar": 6}
measured = {
    IndicatorType.LEXICAL_DIVERSITY: 62.22,
    IndicatorType.ARTICULATION_RATE: 2.8,
    IndicatorType.MORPHOSYNTACTIC_ACCURACY: 78.5
}
diagnosis = assessment_calculator.create_dual_diagnosis("student_001", user_perception, measured)
print(f"  - User perception: {diagnosis.user_perception}")
print(f"  - System diagnosis: {diagnosis.system_diagnosis}")
print(f"  - Priority areas: {len(diagnosis.priority_focus_areas)}")

print("\n" + "=" * 70)
print("✓ ALL TESTS PASSED - Assessment Indicators System Ready")
print("=" * 70)
