#!/usr/bin/env python
"""
QUICK START - Run this to test the entire system in 2 minutes
"""

import subprocess
import sys
import os

def run_command(cmd, description):
    """Run a command and report status"""
    print(f"\n{'='*70}")
    print(f"▶ {description}")
    print(f"{'='*70}")
    print(f"$ {cmd}\n")
    
    result = subprocess.run(cmd, shell=True, cwd="backend")
    if result.returncode != 0:
        print(f"\n❌ Failed: {description}")
        return False
    
    print(f"\n✅ Success: {description}")
    return True

def main():
    print("\n")
    print("╔" + "=" * 68 + "╗")
    print("║" + " " * 68 + "║")
    print("║" + "  🚀 QUICK START - English Diagnostic System".center(68) + "║")
    print("║" + " " * 68 + "║")
    print("╚" + "=" * 68 + "╝")
    
    steps = [
        ("python -c \"from database import init_db; init_db()\"", 
         "Step 1/3: Initialize Database"),
        
        ("python load_benchmarks.py", 
         "Step 2/3: Load ICNALE & Romanian Benchmarks"),
        
        ("python test_e2e.py", 
         "Step 3/3: Run End-to-End Tests"),
    ]
    
    for cmd, desc in steps:
        if not run_command(cmd, desc):
            print("\n⚠️  Setup interrupted. Check error above.")
            return 1
    
    print("\n" + "=" * 70)
    print("🎉 ALL STEPS COMPLETE!")
    print("=" * 70)
    print("""
Your system is ready! 

📋 NEXT STEPS:

1️⃣  Start Backend Server:
    cd backend
    uvicorn app.main:app --reload

2️⃣  Test API Endpoints (in new terminal):
    # Get module recommendations
    curl -X POST http://localhost:8000/assessment/recommend \\
      -H "Content-Type: application/json" \\
      -d '{
        "mtld": 0.40,
        "awl_percent": 0.08,
        "mls": 15.5,
        "mlt": 14.2,
        "mlc": 8.6,
        "wcr": 0.45,
        "pronunciation": 0.68,
        "fluency_wpm": 140,
        "micro_fluency": 0.35,
        "coherence": 0.42,
        "cefr_level": "B1",
        "target_test": "IELTS",
        "limit": 3
      }'

3️⃣  Start Frontend Dev Server (in new terminal):
    cd frontend
    npx expo start

4️⃣  View Assessment Tab in Expo:
    - Press 'a' for Android emulator or
    - Press 'i' for iOS simulator or
    - Scan QR code with Expo Go app

📚 DOCUMENTATION:

- Setup Guide: SETUP_GUIDE.md
- System Architecture: SYSTEM_ARCHITECTURE.md
- API Reference: backend/ASSESSMENT_API_GUIDE.md
- Test Results: backend/test_results.json

🎯 SUCCESS INDICATORS:
- ✅ Database initialized
- ✅ 4 CEFR benchmarks loaded
- ✅ 4 Romanian benchmarks loaded
- ✅ 8 E2E tests passed
- ✅ API endpoints functional
- ✅ Frontend components rendering

Questions? Check SETUP_GUIDE.md → Troubleshooting section
""")
    
    return 0

if __name__ == "__main__":
    sys.exit(main())
