"""
Database models using SQLAlchemy
Supports both SQLite (dev) and PostgreSQL/Oracle (prod)
"""

from sqlalchemy import create_engine, Column, Integer, String, Float, DateTime, Boolean, Text, JSON, ForeignKey, UniqueConstraint
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship, sessionmaker
from datetime import datetime
import os

# Database configuration
DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "sqlite:///./assessments.db"  # SQLite for development
)

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False} if "sqlite" in DATABASE_URL else {}
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


# ============================================================================
# 1. USERS
# ============================================================================

class User(Base):
    __tablename__ = "users"
    
    user_id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    first_name = Column(String(100))
    last_name = Column(String(100))
    native_language = Column(String(50), default="Romanian")
    self_assessed_level = Column(String(5))  # A2, B1, B2, C1
    preferred_language = Column(String(2), default="en")
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    assessments = relationship("Assessment", back_populates="user", cascade="all, delete-orphan")
    pilot_participants = relationship("PilotStudyParticipant", back_populates="user")


# ============================================================================
# 2. ASSESSMENTS
# ============================================================================

class Assessment(Base):
    __tablename__ = "assessments"
    
    assessment_id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.user_id"), nullable=False)
    
    assessment_type = Column(String(20))  # "writing", "speaking", "mixed"
    task_name = Column(String(200))
    
    # Domain type (new field for domain-specific assessment)
    domain_type = Column(String(20), default="spoken")  # COCA genre: spoken, academic, newspaper, fiction, magazine, web, blog, movies, tv
    
    # Input data
    text_input = Column(Text)  # For writing
    transcript = Column(Text)  # For speaking (ASR)
    word_count = Column(Integer)
    
    # Metadata
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    completed_at = Column(DateTime)
    duration_minutes = Column(Integer)
    
    self_reported_level = Column(String(5))
    status = Column(String(20), default="pending")  # pending, processing, completed
    
    # Relationships
    user = relationship("User", back_populates="assessments")
    indicators = relationship("AssessmentIndicators", back_populates="assessment", uselist=False, cascade="all, delete-orphan")
    prediction = relationship("ProficiencyPrediction", back_populates="assessment", uselist=False, cascade="all, delete-orphan")


# ============================================================================
# 3. ASSESSMENT INDICATORS (10 measures)
# ============================================================================

class AssessmentIndicators(Base):
    __tablename__ = "assessment_indicators"
    
    indicator_id = Column(Integer, primary_key=True, index=True)
    assessment_id = Column(Integer, ForeignKey("assessments.assessment_id"), unique=True, nullable=False)
    
    # 1. Lexical Diversity
    mtld = Column(Float)  # MTLD score
    
    # 2. Academic Vocabulary
    awl_percent = Column(Float)  # % AWL words
    
    # 3-5. Syntactic Complexity
    mls = Column(Float)  # Mean Length of Sentence
    mlt = Column(Float)  # Mean Length of T-unit
    mlc = Column(Float)  # Mean Length of Clause
    
    # 6. Grammatical Accuracy
    wcr = Column(Float)  # Word Correct Ratio (0-1)
    
    # 7. Pronunciation
    pronunciation = Column(Float)  # Intelligibility % (0-1)
    
    # 8. Fluency
    fluency_wpm = Column(Float)  # Words per minute
    
    # 9. Micro-fluency
    micro_fluency = Column(Float)  # Pause ratio (0-1)
    
    # 10. Coherence
    coherence = Column(Float)  # LSA score (0-1)
    
    # Metadata
    processing_timestamp = Column(DateTime, default=datetime.utcnow)
    confidence_score = Column(Float, default=0.0)
    
    # Relationships
    assessment = relationship("Assessment", back_populates="indicators")


# ============================================================================
# 4. PROFICIENCY PREDICTIONS
# ============================================================================

class ProficiencyPrediction(Base):
    __tablename__ = "proficiency_predictions"
    
    prediction_id = Column(Integer, primary_key=True, index=True)
    assessment_id = Column(Integer, ForeignKey("assessments.assessment_id"), nullable=False)
    
    predicted_cefr_level = Column(String(5))  # A2, B1, B2, C1
    prediction_confidence = Column(Float)
    
    ielts_predicted_band = Column(Float)  # 1.0-9.0
    pte_predicted_score = Column(Integer)  # 10-90
    
    weighted_score = Column(Float)  # 0-1.0 aggregate
    component_scores = Column(JSON)  # {"accuracy": 0.86, ...}
    
    percentile_among_romanian_learners = Column(Integer)
    
    predicted_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    assessment = relationship("Assessment", back_populates="prediction")


# ============================================================================
# 5. STATISTICAL BENCHMARKS
# ============================================================================

class CEFRBenchmark(Base):
    __tablename__ = "cefr_benchmarks"
    
    benchmark_id = Column(Integer, primary_key=True, index=True)
    cefr_level = Column(String(5), unique=True, nullable=False)  # A2, B1, B2, C1
    
    # Mean values for each indicator
    mtld_mean = Column(Float)
    awl_coverage_mean = Column(Float)
    mls_mean = Column(Float)
    mlt_mean = Column(Float)
    mlc_mean = Column(Float)
    wcr_mean = Column(Float)
    pronunciation_mean = Column(Float)
    fluency_mean = Column(Integer)
    micro_fluency_mean = Column(Float)
    coherence_mean = Column(Float)
    
    # Min/max ranges
    mtld_min = Column(Float)
    mtld_max = Column(Float)
    wcr_min = Column(Float)
    wcr_max = Column(Float)
    fluency_min = Column(Integer)
    fluency_max = Column(Integer)
    coherence_min = Column(Float)
    coherence_max = Column(Float)
    
    # Source
    source_corpus = Column(String(100))  # ICNALE, RoCLE, etc
    sample_size = Column(Integer)
    
    notes = Column(Text)


class RomanianLearnerBenchmark(Base):
    __tablename__ = "romanian_learner_benchmarks"
    
    benchmark_id = Column(Integer, primary_key=True, index=True)
    cefr_level = Column(String(5), unique=True, nullable=False)
    
    # Means for Romanian L1
    mtld_mean = Column(Float)
    wcr_mean = Column(Float)
    mls_mean = Column(Float)
    pronunciation_accuracy = Column(Float)
    
    # Top error patterns
    top_error_type_1 = Column(String(50))
    error_frequency_1 = Column(Float)
    top_error_type_2 = Column(String(50))
    error_frequency_2 = Column(Float)
    
    source_corpus = Column(String(100))
    sample_size = Column(Integer)
    notes = Column(Text)


# ============================================================================
# 6. PILOT STUDY TRACKING
# ============================================================================

class PilotStudyParticipant(Base):
    __tablename__ = "pilot_study_participants"
    
    participant_id = Column(String(10), primary_key=True, index=True)  # P001, P002, etc
    user_id = Column(Integer, ForeignKey("users.user_id"), nullable=True)
    
    # Recruitment info
    l1 = Column(String(50), default="Romanian")
    cefr_baseline_level = Column(String(5))  # A2, B1, B2, C1
    target_test = Column(String(50))  # IELTS, TOEFL_IBT, Cambridge_CAE, Cambridge_CPE
    recruitment_method = Column(String(100))
    recruitment_date = Column(DateTime, default=datetime.utcnow)
    
    # Study phase
    status = Column(String(20), default="recruited")  # recruited, consented, baseline_completed, in_treatment, post_test_completed
    group_assignment = Column(String(20))  # treatment, control
    
    # Consent
    consent_given = Column(Boolean, default=False)
    consent_date = Column(DateTime)
    
    # Assessments
    baseline_assessment_id = Column(Integer, ForeignKey("assessments.assessment_id"))
    posttest_assessment_id = Column(Integer, ForeignKey("assessments.assessment_id"))
    
    # Official test score
    official_test = Column(String(50))
    official_cefr_band = Column(String(5))
    official_test_score_numeric = Column(Float)  # Numeric equivalent (1.0-5.0)
    official_test_date = Column(DateTime)
    
    # Treatment adherence
    adherence_percentage = Column(Float, default=0.0)
    
    # Notes
    notes = Column(Text)
    
    # Relationships
    user = relationship("User", back_populates="pilot_participants")


# ============================================================================
# CREATE TABLES


# ============================================================================
# 7. ONBOARDING PROFILES
# ============================================================================

class OnboardingProfile(Base):
    __tablename__ = "onboarding_profiles"

    profile_id = Column(Integer, primary_key=True, index=True)
    user_identifier = Column(String(100), nullable=False)  # arbitrary user id or external id
    user_id = Column(Integer, ForeignKey("users.user_id"), nullable=True)

    learning_goal = Column(String(50))
    primary_domain = Column(String(50))
    pain_points = Column(JSON)  # list of pain points
    target_exam = Column(String(100))
    self_assessed_cefr = Column(String(5))
    study_hours_per_week = Column(Integer)
    previous_experience = Column(Text)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Optional relationship to user
    user = relationship("User")

# ============================================================================

def init_db():
    """Initialize database tables"""
    Base.metadata.create_all(bind=engine)
    print("✅ Database tables created successfully")


def get_db():
    """Dependency injection for database session"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


if __name__ == "__main__":
    init_db()
