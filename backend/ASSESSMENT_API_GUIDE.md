# Assessment, Recommendation & Feedback System

Complete integration of module recommendations, test-specific feedback, and pilot study management.

## 📦 Components Created

### Backend Routes (`backend/app/routes/assessment.py`)

#### 1. POST `/assessment/recommend`
Get personalized module recommendations based on assessment indicators.

**Request:**
```json
{
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
}
```

**Response:**
```json
{
  "user_id": "user123",
  "cefr_level": "B1",
  "target_test": "IELTS",
  "recommendations": [
    {
      "rank": 1,
      "module_name": "Grammar Fundamentals",
      "severity_score": 0.48,
      "target_indicators": ["WCR", "MLT", "MLC"],
      "estimated_hours": 10,
      "expected_improvement": {"WCR": 0.15, "MLT": 0.2},
      "rationale": "Your grammatical accuracy is 20% below B1 threshold...",
      "priority_level": "HIGH"
    },
    ...
  ],
  "critical_gaps": [
    {
      "indicator": "WCR",
      "learner_score": 0.45,
      "threshold": 0.60,
      "severity": 0.48
    }
  ],
  "timestamp": "2026-04-30T10:30:00"
}
```

---

#### 2. POST `/assessment/feedback`
Generate test-specific feedback for each indicator.

**Request:**
```json
{
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
  "target_test": "IELTS"
}
```

**Response:**
```json
{
  "user_id": "user123",
  "cefr_level": "B1",
  "target_test": "IELTS",
  "feedback_by_indicator": {
    "WCR": {
      "indicator": "WCR",
      "learner_score": 0.45,
      "target_score": 0.60,
      "severity": "🔴 CRITICAL",
      "diagnosis": "Your sentences contain multiple grammatical errors...",
      "learner_examples": [
        {
          "text": "I goes to the store",
          "issue_description": "Subject-verb agreement error",
          "correct_version": "I go to the store"
        }
      ],
      "test_specific_insight": "For IELTS, grammar accuracy matters in Task Achievement...",
      "strategy": "Focus on present simple + past simple conjugation patterns...",
      "timeline_weeks": 6,
      "practice_suggestions": [
        {
          "module": "Grammar Fundamentals",
          "activity": "Tense mastery exercises",
          "duration_minutes": 30,
          "notes": "Focus on simple tenses first"
        }
      ],
      "expected_improvement": "0.45 → 0.65",
      "markdown_output": "Full formatted markdown..."
    }
  },
  "overall_diagnosis": "Based on IELTS rubric: 2 indicators need attention",
  "priority_order": ["WCR", "Coherence"],
  "timestamp": "2026-04-30T10:30:00"
}
```

---

#### 3. POST `/assessment/enroll`
Enroll new participant in pilot study.

**Request:**
```json
{
  "l1": "Romanian",
  "cefr_baseline_level": "B1",
  "target_test": "IELTS",
  "recruitment_method": "University"
}
```

**Response:**
```json
{
  "participant_id": "P001",
  "status": "consented",
  "enrollment_date": "2026-04-30T10:30:00",
  "message": "Successfully enrolled. Your anonymous ID is P001..."
}
```

---

#### 4. POST `/assessment/baseline`
Submit baseline assessment.

**Request:**
```json
{
  "participant_id": "P001",
  "indicators": {
    "mtld": 0.40,
    "awl_percent": 0.08,
    "mls": 15.5,
    "mlt": 14.2,
    "mlc": 8.6,
    "wcr": 0.45,
    "pronunciation": 0.68,
    "fluency_wpm": 140,
    "micro_fluency": 0.35,
    "coherence": 0.42
  },
  "system_cefr_prediction": "B1",
  "writing_sample": "Optional essay text..."
}
```

---

#### 5. POST `/assessment/posttest`
Submit post-test assessment and official score.

**Request:**
```json
{
  "participant_id": "P001",
  "indicators": { ... },
  "system_cefr_prediction": "B1",
  "official_test": "IELTS",
  "official_cefr_band": "B1"
}
```

---

#### 6. GET `/assessment/progress/{participant_id}`
Get participant's study progress.

**Response:**
```json
{
  "participant_id": "P001",
  "status": "baseline_completed",
  "group_assignment": "treatment",
  "baseline_cefr": "B1",
  "posttest_cefr": null,
  "improvement": null,
  "adherence_percentage": 0.0,
  "phase": "Phase 3: Treatment/Control"
}
```

---

#### 7. GET `/assessment/validation-report`
Get pilot study validation results (Pearson r ≥ 0.75 target).

**Response:**
```json
{
  "study_name": "English Diagnostic System Validation - Romanian Learners",
  "sample_size": 50,
  "complete_participants": 48,
  "correlation_r": 0.78,
  "p_value": 0.001,
  "status": "VALID",
  "by_cefr_level": {
    "B1": {
      "n": 15,
      "r": 0.82,
      "mean_system": 2.1,
      "mean_official": 2.0
    },
    "B2": {
      "n": 20,
      "r": 0.75,
      "mean_system": 2.9,
      "mean_official": 2.8
    }
  },
  "success_criteria": {
    "target_r": 0.75,
    "achieved_r": 0.78,
    "min_participants": 50,
    "achieved_participants": 48,
    "passed": true
  }
}
```

---

## 🎨 Frontend Components

### 1. `ModuleRecommendationCard` (`module-recommendation-card.tsx`)

Display individual recommended module with severity scoring.

```tsx
import { ModuleRecommendationCard } from '@/components/module-recommendation-card';

<ModuleRecommendationCard
  module={recommendation}
  onSelect={(module) => console.log('Selected:', module)}
/>
```

**Features:**
- Rank badge (#1, #2, #3)
- Severity score bar (colored by priority)
- Target indicators list
- Time estimate
- Expected improvement metrics
- Action button

---

### 2. `FeedbackPanel` (`feedback-panel.tsx`)

Expandable feedback panel with test-specific guidance.

```tsx
import { FeedbackPanel } from '@/components/feedback-panel';

<FeedbackPanel
  feedback={indicatorFeedback}
  expanded={false}
/>
```

**Features:**
- Collapsible header with score bar
- Diagnosis section
- Learner examples (incorrect → correct)
- Test-specific insight
- Improvement strategy
- Practice suggestions
- Expected improvement timeline
- Full markdown export

---

### 3. `AssessmentDashboard` (`assessment-dashboard.tsx`)

Complete assessment dashboard combining recommendations + feedback.

```tsx
import { AssessmentDashboard } from '@/components/assessment-dashboard';

<AssessmentDashboard
  userId="user123"
  indicators={assessmentIndicators}
  cefrLevel="B1"
  targetTest="IELTS"
  apiBaseUrl="http://localhost:8000"
/>
```

**Features:**
- Automatic data fetching from backend
- Summary stats (recommendations, critical gaps, total time)
- Tabbed interface (Modules | Feedback)
- Critical gaps warning box
- Module cards with interaction
- Feedback panels with full details
- Export & refresh buttons

---

### 4. `ParticipantEnrollmentFlow` (`participant-enrollment-flow.tsx`)

Multi-step enrollment flow for pilot study (4 steps).

```tsx
import { ParticipantEnrollmentFlow } from '@/components/participant-enrollment-flow';

<ParticipantEnrollmentFlow
  onEnrollmentComplete={(participantId) => console.log('ID:', participantId)}
  apiBaseUrl="http://localhost:8000"
/>
```

**Steps:**
1. **Welcome** - Study overview and benefits
2. **Information** - Select CEFR level + target test
3. **Consent** - Informed consent checkboxes
4. **Confirmation** - Show participant ID (P001)

---

## 🚀 Usage Examples

### Example 1: Display Recommendations
```tsx
import { AssessmentDashboard } from '@/components/assessment-dashboard';

export default function ResultsScreen() {
  const indicators = {
    mtld: 0.40, awl_percent: 0.08, mls: 15.5,
    mlt: 14.2, mlc: 8.6, wcr: 0.45, pronunciation: 0.68,
    fluency_wpm: 140, micro_fluency: 0.35, coherence: 0.42
  };

  return (
    <AssessmentDashboard
      userId={userId}
      indicators={indicators}
      cefrLevel="B1"
      targetTest="IELTS"
    />
  );
}
```

### Example 2: Just Recommendations
```tsx
import { ModuleRecommendationCard } from '@/components/module-recommendation-card';
import { useEffect, useState } from 'react';

export default function RecommendationsScreen() {
  const [modules, setModules] = useState([]);

  useEffect(() => {
    fetch('http://localhost:8000/assessment/recommend', {
      method: 'POST',
      headers: { 'user-id': 'user123' },
      body: JSON.stringify({...indicators, cefr_level: 'B1', target_test: 'IELTS'})
    })
    .then(r => r.json())
    .then(data => setModules(data.recommendations));
  }, []);

  return (
    <FlatList
      data={modules}
      renderItem={({ item }) => (
        <ModuleRecommendationCard
          module={item}
          onSelect={startModule}
        />
      )}
    />
  );
}
```

### Example 3: Pilot Study Enrollment
```tsx
import { ParticipantEnrollmentFlow } from '@/components/participant-enrollment-flow';

export default function StudyEnrollmentScreen() {
  return (
    <ParticipantEnrollmentFlow
      onEnrollmentComplete={(id) => {
        console.log('Enrolled:', id);
        // Navigate to baseline assessment
      }}
    />
  );
}
```

---

## 🔧 Integration Checklist

- [x] Backend routes (7 endpoints)
- [x] Schemas for request/response validation
- [x] Frontend components (4 reusable components)
- [ ] Database schema deployment (Oracle)
- [ ] Load ICNALE benchmarks
- [ ] Connect assessment scoring to routes
- [ ] Frontend page integration
- [ ] Test end-to-end flow

---

## 📊 Data Flow

```
User Assessment
    ↓
/assessment/recommend → ModuleRecommendationCard(s)
/assessment/feedback → FeedbackPanel(s)
    ↓
AssessmentDashboard (combines both)
    ↓
Pilot Study: ParticipantEnrollmentFlow
    ↓
/assessment/baseline (Week 2-3)
/assessment/posttest (Week 7)
    ↓
/assessment/validation-report (r ≥ 0.75?)
```

---

## 📝 Notes

- All indicators are normalized to 0-1.0 range
- CEFR thresholds from Barrot 2021 ICNALE analysis
- Test-specific weighting per Shabani & Panahi 2020
- Pilot study targets n ≥ 50, r ≥ 0.75 (p < 0.001)
- All participant data anonymized (P001, P002, etc)
- Component styling uses theme colors from context
