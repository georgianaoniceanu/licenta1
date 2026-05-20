#!/usr/bin/env python3
"""Test domain-specific and Măchiță pronunciation features via API"""

import requests
import json

API_URL = "http://127.0.0.1:8000"

print("\n" + "=" * 80)
print("TESTING VOCAFLOW API - DOMAIN-SPECIFIC & MĂCHIȚĂ FEATURES")
print("=" * 80)

# Sample test data
test_indicators = {
    "mtld": 0.45,
    "awl_percent": 0.08,
    "mls": 15.0,
    "mlt": 13.5,
    "mlc": 8.0,
    "wcr": 0.85,
    "pronunciation": 0.70,
    "fluency_wpm": 150,
    "micro_fluency": 0.3,
    "coherence": 0.45,
}

headers = {"user-id": "test_user_123"}

# Test 1: Get available domains
print("\n✅ Test 1: GET /assessment/domains")
try:
    response = requests.get(f"{API_URL}/assessment/domains", timeout=5)
    if response.status_code == 200:
        data = response.json()
        print(f"   Found {len(data['domains'])} domains:")
        for domain in data['domains']:
            print(f"   • {domain['id']:15s} - {domain['name']}")
    else:
        print(f"   ❌ Status {response.status_code}")
except Exception as e:
    print(f"   ❌ Error: {e}")

# Test 2: Get pronunciation patterns from Măchiță
print("\n✅ Test 2: GET /accent/romanian-patterns")
try:
    response = requests.get(f"{API_URL}/accent/romanian-patterns", timeout=5)
    if response.status_code == 200:
        data = response.json()
        print(f"   Source: {data.get('source', 'N/A')}")
        patterns = data.get('patterns', {})
        print(f"   Loaded {len(patterns)} Romanian phoneme patterns:")
        for phoneme in list(patterns.keys())[:3]:
            print(f"   • {phoneme}")
    else:
        print(f"   ❌ Status {response.status_code}")
except Exception as e:
    print(f"   ❌ Error: {e}")

# Test 3: Recommendations for Description domain
print("\n✅ Test 3: POST /assessment/recommend (Description domain)")
try:
    payload = {
        "indicators": test_indicators,
        "cefr_level": "B1",
        "target_test": "IELTS",
        "domain": "description",
        "limit": 3
    }
    response = requests.post(
        f"{API_URL}/assessment/recommend",
        json=payload,
        headers=headers,
        timeout=10
    )
    if response.status_code == 200:
        data = response.json()
        print(f"   ✅ Got recommendations for {data['cefr_level']} {data['target_test']}")
        print(f"   Domain: description")
        for rec in data['recommendations'][:3]:
            print(f"   {rec['rank']}. {rec['module_name']:25s} (severity: {rec['severity_score']:.2f})")
    else:
        print(f"   Status: {response.status_code}")
        print(f"   Response: {response.text[:200]}")
except Exception as e:
    print(f"   ⚠️  Error: {e}")

# Test 4: Recommendations for Argumentation domain
print("\n✅ Test 4: POST /assessment/recommend (Argumentation domain)")
try:
    payload = {
        "indicators": test_indicators,
        "cefr_level": "B1",
        "target_test": "IELTS",
        "domain": "argumentation",
        "limit": 3
    }
    response = requests.post(
        f"{API_URL}/assessment/recommend",
        json=payload,
        headers=headers,
        timeout=10
    )
    if response.status_code == 200:
        data = response.json()
        print(f"   ✅ Got recommendations for {data['cefr_level']} {data['target_test']}")
        print(f"   Domain: argumentation")
        for rec in data['recommendations'][:3]:
            print(f"   {rec['rank']}. {rec['module_name']:25s} (severity: {rec['severity_score']:.2f})")
    else:
        print(f"   Status: {response.status_code}")
except Exception as e:
    print(f"   ⚠️  Error: {e}")

# Test 5: Get specific phoneme pattern
print("\n✅ Test 5: GET /accent/phoneme/θ")
try:
    response = requests.get(f"{API_URL}/accent/phoneme/%2Fθ%2F", timeout=5)
    if response.status_code == 200:
        data = response.json()
        phoneme = data.get('phoneme', 'N/A')
        error_rate = data.get('error_rate', 0)
        print(f"   Phoneme: {phoneme}")
        print(f"   Error rate for Romanian learners: {error_rate}%")
        if 'substitutions' in data:
            print(f"   Common substitutions:")
            for sub, info in list(data['substitutions'].items())[:2]:
                print(f"   • {sub}: {info.get('frequency', 0)}%")
    else:
        print(f"   Status: {response.status_code}")
except Exception as e:
    print(f"   ⚠️  Error: {e}")

print("\n" + "=" * 80)
print("✅ API TESTS COMPLETE")
print("=" * 80 + "\n")
