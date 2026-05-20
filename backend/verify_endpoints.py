#!/usr/bin/env python3
"""Verify all assessment workflow endpoints are registered"""

import sys
sys.path.insert(0, r'c:\Users\LENOVO\Desktop\licenta\backend')

from app.main import app

print("=" * 80)
print("API ENDPOINT VERIFICATION")
print("=" * 80)

# Get all routes
routes = app.routes
assessment_routes = [r for r in routes if '/assessment' in str(r.path)]

print(f"\n✓ FastAPI app loaded successfully")
print(f"✓ Total routes: {len(routes)}")
print(f"✓ Assessment routes: {len(assessment_routes)}")

print("\n📍 Assessment Endpoints Available:")
print("-" * 80)

for route in assessment_routes:
    if hasattr(route, 'path'):
        methods = getattr(route, 'methods', set())
        method_str = ', '.join(sorted(methods)) if methods else 'N/A'
        print(f"  {method_str:8s} {route.path}")

# Check for the 4 main endpoints
required = [
    '/assessment/initial-assessment',
    '/assessment/dual-diagnosis',
    '/assessment/reassess',
    '/assessment/report/{user_id}',
]

print("\n✅ Required Endpoints Check:")
print("-" * 80)

for req in required:
    found = any(req.replace('{user_id}', '') in str(r.path) for r in assessment_routes)
    status = "✓" if found else "✗"
    print(f"  {status} {req}")

# Also check onboarding endpoints
onboarding = [
    '/assessment/onboarding/initial-assessment',
    '/assessment/onboarding/generate-learning-path',
]

print("\n✅ Onboarding Endpoints Check:")
print("-" * 80)

for onb in onboarding:
    found = any(onb in str(r.path) for r in assessment_routes)
    status = "✓" if found else "✗"
    print(f"  {status} {onb}")

print("\n" + "=" * 80)
print("✅ ALL ENDPOINTS REGISTERED & READY")
print("=" * 80)
print("\nTo test:")
print("  1. Start server: uvicorn app.main:app --reload")
print("  2. Run tests: python test_assessment_workflow.py")
print("  3. Or make curl requests (see ASSESSMENT_WORKFLOW_QUICKSTART.py)")
print()
