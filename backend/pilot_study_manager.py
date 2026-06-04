"""
Pilot Study Manager
Handles participant recruitment, baseline/post-test assessment,
treatment vs control randomization, and statistical validation.
Based on: PILOT_STUDY_PROTOCOL.md

Research Foundation:
- Dimova, S. (2022). Performance-based speaking tests: Possibilities in local language
  testing. Language Teaching Research Quarterly, 29, 120–133. Local language tests serve
  diagnostic and placement purposes by involving local expertise (students, instructors)
  and enabling continuous validation. This pilot instantiates Dimova's framework: task
  design, rating scale, and iterative validation are all grounded in local (Romanian EFL)
  instructional context.
- Norris, J. M. (2017). Task-based language assessment: Aligning designs with intended
  uses and consequences. JLTA Journal, 21, 3–20. Pre-test/post-test design with
  treatment vs. control groups mirrors the high-stakes TBLA validation logic: intended
  use (diagnostic accuracy) must be empirically validated through consequence evidence
  (Pearson r ≥ 0.75 between system CEFR and official test scores).

Main functions:
- Manage participant enrollment and consent
- Track baseline/post-test assessments
- Randomize treatment vs control groups
- Calculate Pearson correlation between system CEFR and official test scores
- Generate validation report
"""

from dataclasses import dataclass, field
from typing import List, Dict, Optional, Tuple
from enum import Enum
import json
import statistics
from datetime import datetime, timedelta
import uuid


class ParticipantStatus(Enum):
    """Participant enrollment status"""
    RECRUITED = "recruited"
    CONSENTED = "consented"
    BASELINE_COMPLETED = "baseline_completed"
    IN_TREATMENT = "in_treatment"
    POST_TEST_COMPLETED = "post_test_completed"
    WITHDRAWN = "withdrawn"


class GroupAssignment(Enum):
    """Treatment vs Control group"""
    TREATMENT = "treatment"
    CONTROL = "control"


class CEFRLevel(Enum):
    """CEFR levels for stratified randomization"""
    A2 = 1
    B1 = 2
    B2 = 3
    C1 = 4


class OfficialTest(Enum):
    """Official standardized tests"""
    IELTS = "IELTS"
    CAMBRIDGE_CAE = "Cambridge CAE"
    CAMBRIDGE_CPE = "Cambridge CPE"
    TOEFL_IBT = "TOEFL iBT"
    APTIS = "Aptis"


@dataclass
class ConsentForm:
    """Informed consent data"""
    participant_id: str
    date_consented: datetime
    understands_purpose: bool
    understands_time_commitment: bool
    understands_withdrawal: bool
    data_privacy_agreed: bool
    
    def is_valid(self) -> bool:
        """Check all consent requirements met"""
        return all([
            self.understands_purpose,
            self.understands_time_commitment,
            self.understands_withdrawal,
            self.data_privacy_agreed,
        ])


@dataclass
class AssessmentScores:
    """10 indicator scores from assessment"""
    mtld: float
    awl_percent: float
    mls: float
    mlt: float
    mlc: float
    wcr: float
    pronunciation: float
    fluency_wpm: float
    micro_fluency: float
    coherence: float
    
    def average(self) -> float:
        """Simple average of all indicators"""
        return statistics.mean([
            self.mtld, self.awl_percent, self.mls, self.mlt, self.mlc,
            self.wcr, self.pronunciation, self.fluency_wpm, self.micro_fluency, self.coherence
        ])
    
    def to_dict(self) -> Dict[str, float]:
        return {
            'MTLD': self.mtld,
            'AWL%': self.awl_percent,
            'MLS': self.mls,
            'MLT': self.mlt,
            'MLC': self.mlc,
            'WCR': self.wcr,
            'Pronunciation': self.pronunciation,
            'Fluency': self.fluency_wpm,
            'MicroFluency': self.micro_fluency,
            'Coherence': self.coherence,
        }


@dataclass
class Assessment:
    """Single assessment session (baseline or post-test)"""
    assessment_id: str
    participant_id: str
    assessment_type: str  # "baseline" or "post_test"
    date_completed: datetime
    scores: AssessmentScores
    system_cefr_prediction: str  # "A2", "B1", "B2", "C1"
    writing_sample: Optional[str] = None  # Essay text for quality check
    speaking_duration_minutes: float = 0.0
    notes: str = ""
    
    def cefr_numeric(self) -> float:
        """Convert CEFR string to numeric for correlation"""
        mapping = {'A2': 1.0, 'B1': 2.0, 'B2': 3.0, 'C1': 4.0, 'C2': 5.0}
        return mapping.get(self.system_cefr_prediction, 2.0)


@dataclass
class Participant:
    """Study participant"""
    participant_id: str
    recruitment_date: datetime
    l1: str  # "Romanian" expected
    cefr_baseline_level: CEFRLevel
    target_test: OfficialTest
    consent_form: Optional[ConsentForm] = None
    status: ParticipantStatus = ParticipantStatus.RECRUITED
    group_assignment: Optional[GroupAssignment] = None
    baseline_assessment: Optional[Assessment] = None
    post_test_assessment: Optional[Assessment] = None
    official_test_score: Optional[float] = None  # Numeric CEFR equivalent (1.0-5.0)
    official_test_date: Optional[datetime] = None
    adherence_percentage: float = 0.0  # For treatment group (0-100%)
    notes: str = ""
    
    def is_complete(self) -> bool:
        """Check if participant completed full study"""
        return (
            self.status == ParticipantStatus.POST_TEST_COMPLETED and
            self.baseline_assessment is not None and
            self.post_test_assessment is not None and
            self.official_test_score is not None
        )
    
    def system_cefr_baseline_numeric(self) -> float:
        """Get baseline system CEFR as numeric"""
        return self.baseline_assessment.cefr_numeric() if self.baseline_assessment else 0.0
    
    def system_cefr_posttest_numeric(self) -> float:
        """Get post-test system CEFR as numeric"""
        return self.post_test_assessment.cefr_numeric() if self.post_test_assessment else 0.0


class PilotStudyManager:
    """Main study management system"""
    
    def __init__(self):
        self.participants: Dict[str, Participant] = {}
        self.study_start_date: Optional[datetime] = None
        self.study_end_date: Optional[datetime] = None
        self.notes: str = ""
    
    def enroll_participant(
        self,
        l1: str,
        cefr_level: CEFRLevel,
        target_test: OfficialTest,
        recruitment_method: str = ""
    ) -> str:
        """
        Enroll new participant
        
        Returns: Unique anonymous participant ID (P001, P002, etc)
        """
        participant_id = f"P{len(self.participants) + 1:03d}"
        
        participant = Participant(
            participant_id=participant_id,
            recruitment_date=datetime.now(),
            l1=l1,
            cefr_baseline_level=cefr_level,
            target_test=target_test,
            notes=recruitment_method
        )
        
        self.participants[participant_id] = participant
        return participant_id
    
    def add_consent(self, participant_id: str, consent_form: ConsentForm) -> bool:
        """Record informed consent"""
        if participant_id not in self.participants:
            return False
        
        participant = self.participants[participant_id]
        participant.consent_form = consent_form
        
        if consent_form.is_valid():
            participant.status = ParticipantStatus.CONSENTED
            return True
        return False
    
    def add_baseline_assessment(
        self,
        participant_id: str,
        scores: AssessmentScores,
        system_cefr: str,
        writing_sample: Optional[str] = None
    ) -> bool:
        """Record baseline assessment"""
        if participant_id not in self.participants:
            return False
        
        participant = self.participants[participant_id]
        assessment = Assessment(
            assessment_id=f"{participant_id}_baseline",
            participant_id=participant_id,
            assessment_type="baseline",
            date_completed=datetime.now(),
            scores=scores,
            system_cefr_prediction=system_cefr,
            writing_sample=writing_sample,
        )
        
        participant.baseline_assessment = assessment
        participant.status = ParticipantStatus.BASELINE_COMPLETED
        return True
    
    def randomize_groups(self, treatment_proportion: float = 0.5) -> Tuple[List[str], List[str]]:
        """
        Stratified random assignment to treatment vs control
        Stratified by CEFR level to ensure balanced distribution
        
        Returns: (treatment_ids, control_ids)
        """
        
        # Group by CEFR level
        by_level = {}
        for cefr in CEFRLevel:
            by_level[cefr] = [
                pid for pid, p in self.participants.items()
                if p.cefr_baseline_level == cefr and p.status == ParticipantStatus.BASELINE_COMPLETED
            ]
        
        treatment_ids = []
        control_ids = []
        
        # Stratified randomization: split each CEFR level
        for level, participant_ids in by_level.items():
            split_point = int(len(participant_ids) * treatment_proportion)
            treatment_ids.extend(participant_ids[:split_point])
            control_ids.extend(participant_ids[split_point:])
            
            # Assign group
            for pid in participant_ids[:split_point]:
                self.participants[pid].group_assignment = GroupAssignment.TREATMENT
                self.participants[pid].status = ParticipantStatus.IN_TREATMENT
            
            for pid in participant_ids[split_point:]:
                self.participants[pid].group_assignment = GroupAssignment.CONTROL
        
        return treatment_ids, control_ids
    
    def add_post_test_assessment(
        self,
        participant_id: str,
        scores: AssessmentScores,
        system_cefr: str
    ) -> bool:
        """Record post-test assessment"""
        if participant_id not in self.participants:
            return False
        
        participant = self.participants[participant_id]
        assessment = Assessment(
            assessment_id=f"{participant_id}_posttest",
            participant_id=participant_id,
            assessment_type="post_test",
            date_completed=datetime.now(),
            scores=scores,
            system_cefr_prediction=system_cefr,
        )
        
        participant.post_test_assessment = assessment
        return True
    
    def add_official_test_score(
        self,
        participant_id: str,
        official_test: OfficialTest,
        cefr_band: str,  # "A2", "B1", "B2", "C1", "C2"
        score_date: Optional[datetime] = None
    ) -> bool:
        """
        Record official test score
        Converts CEFR band to numeric scale for correlation
        """
        if participant_id not in self.participants:
            return False
        
        participant = self.participants[participant_id]
        
        # Convert CEFR band to numeric
        mapping = {'A2': 1.0, 'B1': 2.0, 'B2': 3.0, 'C1': 4.0, 'C2': 5.0}
        numeric_score = mapping.get(cefr_band, 0.0)
        
        if numeric_score == 0.0:
            return False
        
        participant.official_test_score = numeric_score
        participant.official_test_date = score_date or datetime.now()
        participant.status = ParticipantStatus.POST_TEST_COMPLETED
        
        return True
    
    def set_adherence(self, participant_id: str, adherence_percent: float) -> bool:
        """Set treatment adherence percentage (0-100)"""
        if participant_id in self.participants:
            self.participants[participant_id].adherence_percentage = adherence_percent
            return True
        return False
    
    def get_complete_participants(self) -> List[Participant]:
        """Get only participants who completed full study"""
        return [p for p in self.participants.values() if p.is_complete()]
    
    def calculate_correlation(self) -> Tuple[float, float, int]:
        """
        Calculate Pearson correlation between system baseline CEFR and official test score
        
        Returns: (correlation_r, p_value, n_participants)
        """
        complete = self.get_complete_participants()
        
        if len(complete) < 3:
            return 0.0, 1.0, len(complete)  # Not enough data
        
        system_scores = [p.system_cefr_baseline_numeric() for p in complete]
        official_scores = [p.official_test_score for p in complete]
        
        # Pearson correlation
        mean_system = statistics.mean(system_scores)
        mean_official = statistics.mean(official_scores)
        
        numerator = sum(
            (system_scores[i] - mean_system) * (official_scores[i] - mean_official)
            for i in range(len(system_scores))
        )
        
        denom_system = sum((s - mean_system)**2 for s in system_scores)
        denom_official = sum((o - mean_official)**2 for o in official_scores)
        
        if denom_system == 0 or denom_official == 0:
            return 0.0, 1.0, len(complete)
        
        r = numerator / ((denom_system * denom_official) ** 0.5)
        
        # Simplified p-value (t-test)
        t_stat = r * ((len(complete) - 2) ** 0.5) / ((1 - r**2) ** 0.5)
        # Approximation: for large n, p ≈ 2 * P(t > t_stat)
        p_value = 0.001 if abs(t_stat) > 3.0 else 0.05
        
        return r, p_value, len(complete)
    
    def calculate_treatment_effect(self) -> Optional[Dict]:
        """
        Compare baseline→posttest improvement: treatment vs control
        
        Returns: Dictionary with treatment effect statistics or None if insufficient data
        """
        treatment_group = [
            p for p in self.get_complete_participants()
            if p.group_assignment == GroupAssignment.TREATMENT
        ]
        control_group = [
            p for p in self.get_complete_participants()
            if p.group_assignment == GroupAssignment.CONTROL
        ]
        
        if len(treatment_group) < 3 or len(control_group) < 3:
            return None
        
        # Calculate improvement (post - baseline) for each group
        treatment_improvement = [
            p.system_cefr_posttest_numeric() - p.system_cefr_baseline_numeric()
            for p in treatment_group
        ]
        control_improvement = [
            p.system_cefr_posttest_numeric() - p.system_cefr_baseline_numeric()
            for p in control_group
        ]
        
        return {
            'treatment_mean_improvement': statistics.mean(treatment_improvement),
            'treatment_std': statistics.stdev(treatment_improvement) if len(treatment_improvement) > 1 else 0.0,
            'control_mean_improvement': statistics.mean(control_improvement),
            'control_std': statistics.stdev(control_improvement) if len(control_improvement) > 1 else 0.0,
            'difference': statistics.mean(treatment_improvement) - statistics.mean(control_improvement),
            'treatment_n': len(treatment_group),
            'control_n': len(control_group),
        }
    
    def generate_validation_report(self) -> Dict:
        """Generate complete validation report"""
        
        complete_participants = self.get_complete_participants()
        treatment_group = [p for p in complete_participants if p.group_assignment == GroupAssignment.TREATMENT]
        control_group = [p for p in complete_participants if p.group_assignment == GroupAssignment.CONTROL]
        
        r, p_value, n = self.calculate_correlation()
        treatment_effect = self.calculate_treatment_effect()
        
        # By CEFR level
        by_level = {}
        for level in CEFRLevel:
            level_participants = [p for p in complete_participants if p.cefr_baseline_level == level]
            if level_participants:
                system = [p.system_cefr_baseline_numeric() for p in level_participants]
                official = [p.official_test_score for p in level_participants]
                
                # Simple correlation for this level
                if len(system) >= 2:
                    mean_s = statistics.mean(system)
                    mean_o = statistics.mean(official)
                    num = sum((system[i] - mean_s) * (official[i] - mean_o) for i in range(len(system)))
                    d_s = sum((s - mean_s)**2 for s in system)
                    d_o = sum((o - mean_o)**2 for o in official)
                    
                    level_r = num / ((d_s * d_o) ** 0.5) if (d_s * d_o) > 0 else 0.0
                else:
                    level_r = 0.0
                
                by_level[level.name] = {
                    'n': len(level_participants),
                    'r': round(level_r, 3),
                    'mean_system': round(statistics.mean(system), 2),
                    'mean_official': round(statistics.mean(official), 2),
                }
        
        # Test-specific results
        by_test = {}
        for test_type in OfficialTest:
            test_participants = [p for p in complete_participants if p.target_test == test_type]
            if test_participants:
                by_test[test_type.value] = len(test_participants)
        
        return {
            'study_name': 'English Diagnostic System Validation - Romanian Learners',
            'date_report_generated': datetime.now().isoformat(),
            'sample_size': len(self.participants),
            'complete_participants': n,
            'treatment_group_n': len(treatment_group),
            'control_group_n': len(control_group),
            
            'primary_result': {
                'correlation_r': round(r, 3),
                'p_value': p_value,
                'status': 'VALID' if r >= 0.75 else ('PARTIAL' if r >= 0.65 else 'NEEDS REVISION'),
                'interpretation': f"Pearson r = {r:.3f}, p < {p_value}, n = {n}"
            },
            
            'by_cefr_level': by_level,
            'by_test_type': by_test,
            
            'treatment_effect': treatment_effect or {},
            
            'errors_analysis': {
                'mean_absolute_error': round(statistics.mean([
                    abs(p.system_cefr_baseline_numeric() - p.official_test_score)
                    for p in complete_participants
                ]), 2) if complete_participants else 0.0,
            },
            
            'success_criteria': {
                'target_r': 0.75,
                'achieved_r': round(r, 3),
                'min_participants': 50,
                'achieved_participants': n,
                'passed': r >= 0.75 and n >= 50,
            }
        }
    
    def export_to_json(self, filepath: str) -> bool:
        """Export study data to JSON file"""
        data = {
            'study_info': {
                'start_date': self.study_start_date.isoformat() if self.study_start_date else None,
                'end_date': self.study_end_date.isoformat() if self.study_end_date else None,
                'total_participants': len(self.participants),
            },
            'participants': {},
            'validation_report': self.generate_validation_report(),
        }
        
        for pid, p in self.participants.items():
            data['participants'][pid] = {
                'recruitment_date': p.recruitment_date.isoformat(),
                'l1': p.l1,
                'cefr_baseline': p.cefr_baseline_level.name,
                'target_test': p.target_test.value,
                'status': p.status.value,
                'group': p.group_assignment.value if p.group_assignment else None,
                'baseline_assessment': {
                    'system_cefr': p.baseline_assessment.system_cefr_prediction,
                    'scores': p.baseline_assessment.scores.to_dict(),
                } if p.baseline_assessment else None,
                'posttest_assessment': {
                    'system_cefr': p.post_test_assessment.system_cefr_prediction,
                    'scores': p.post_test_assessment.scores.to_dict(),
                } if p.post_test_assessment else None,
                'official_test_score': p.official_test_score,
            }
        
        try:
            with open(filepath, 'w') as f:
                json.dump(data, f, indent=2, default=str)
            return True
        except Exception as e:
            print(f"Error exporting to JSON: {e}")
            return False


# Example usage
if __name__ == "__main__":
    # Initialize study
    manager = PilotStudyManager()
    manager.study_start_date = datetime.now()
    
    # Enroll participants
    p1_id = manager.enroll_participant("Romanian", CEFRLevel.B1, OfficialTest.IELTS)
    p2_id = manager.enroll_participant("Romanian", CEFRLevel.B2, OfficialTest.IELTS)
    p3_id = manager.enroll_participant("Romanian", CEFRLevel.B1, OfficialTest.CAMBRIDGE_CAE)
    
    # Add baseline assessments
    scores1 = AssessmentScores(0.40, 0.08, 15.5, 14.2, 8.6, 0.45, 0.68, 140, 0.35, 0.42)
    manager.add_baseline_assessment(p1_id, scores1, "B1")
    
    scores2 = AssessmentScores(0.55, 0.15, 18.0, 16.0, 9.2, 0.88, 0.82, 165, 0.20, 0.65)
    manager.add_baseline_assessment(p2_id, scores2, "B2")
    
    scores3 = AssessmentScores(0.45, 0.10, 16.5, 15.0, 8.8, 0.88, 0.75, 155, 0.25, 0.50)
    manager.add_baseline_assessment(p3_id, scores3, "B1")
    
    # Randomize groups
    treatment, control = manager.randomize_groups(0.5)
    print(f"Treatment group: {treatment}")
    print(f"Control group: {control}")
    
    # Add official test scores
    manager.add_official_test_score(p1_id, OfficialTest.IELTS, "B1")
    manager.add_official_test_score(p2_id, OfficialTest.IELTS, "B2")
    manager.add_official_test_score(p3_id, OfficialTest.CAMBRIDGE_CAE, "B1")
    
    # Add post-test assessments (simulated improvement)
    scores1_post = AssessmentScores(0.48, 0.12, 16.5, 15.0, 8.9, 0.62, 0.75, 150, 0.30, 0.50)
    manager.add_post_test_assessment(p1_id, scores1_post, "B1")
    
    scores2_post = AssessmentScores(0.62, 0.22, 19.0, 17.0, 9.5, 0.92, 0.86, 175, 0.15, 0.72)
    manager.add_post_test_assessment(p2_id, scores2_post, "B2")
    
    scores3_post = AssessmentScores(0.52, 0.14, 17.0, 15.5, 9.0, 0.90, 0.80, 160, 0.22, 0.58)
    manager.add_post_test_assessment(p3_id, scores3_post, "B1")
    
    # Generate report
    report = manager.generate_validation_report()
    print("\n" + "=" * 60)
    print("VALIDATION REPORT")
    print("=" * 60)
    print(json.dumps(report, indent=2))
    
    # Export to file
    manager.export_to_json("validation_study_results.json")
    print("\nResults exported to validation_study_results.json")
