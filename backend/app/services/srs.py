"""Spaced Repetition System (SRS) for vocabulary retention.

Uses SM-2 algorithm for adaptive review scheduling:
- easiness factor (EF): determines interval growth
- interval: days until next review
- repetitions: how many times correctly answered

Research Foundation:
- SM-2 algorithm for adaptive spaced repetition scheduling (easiness factor + interval growth).
- DeKeyser, R. M., & Suzuki, Y. (2025). Skill acquisition theory. In VanPatten et al.
  (Eds.), Theories in SLA: An introduction (4th ed., pp. 157–182). Routledge. [_PREPR2]
  Skill Acquisition Theory justifies the SRS design: declarative knowledge of vocabulary
  (form+meaning) must be proceduralized through repeated, spaced retrieval practice until
  automatization is achieved.
- Cepeda, N. J., Pashler, H., Vul, E., Wixted, J. T., & Rohrer, D. (2006). Distributed
  practice in verbal recall tasks: A review and quantitative synthesis. Psychological
  Bulletin, 132(3), 354–380. [Cepeda2006] Confirms spaced re-use as the strongest
  predictor of long-term lexical retention over massed practice."""

from datetime import datetime, timedelta
import json
from typing import Dict, List, Optional
from app.services.firestore import db

class SRSCard:
    """Represents a single flashcard in the SRS system."""
    
    def __init__(
        self,
        word_id: str,
        word: str,
        definition: str,
        easiness_factor: float = 2.5,  # Default EF
        interval: int = 1,  # Days until next review
        repetitions: int = 0,  # Times correct
        next_review: Optional[str] = None,  # ISO datetime
        quality_last: int = 0,  # Quality of last review (0-5)
        created_at: Optional[str] = None,
    ):
        self.word_id = word_id
        self.word = word
        self.definition = definition
        self.easiness_factor = easiness_factor
        self.interval = interval
        self.repetitions = repetitions
        self.next_review = next_review or datetime.now().isoformat()
        self.quality_last = quality_last
        self.created_at = created_at or datetime.now().isoformat()

    def to_dict(self) -> Dict:
        return {
            "word_id": self.word_id,
            "word": self.word,
            "definition": self.definition,
            "easiness_factor": self.easiness_factor,
            "interval": self.interval,
            "repetitions": self.repetitions,
            "next_review": self.next_review,
            "quality_last": self.quality_last,
            "created_at": self.created_at,
        }

    @staticmethod
    def from_dict(data: Dict) -> "SRSCard":
        return SRSCard(
            word_id=data.get("word_id"),
            word=data.get("word"),
            definition=data.get("definition"),
            easiness_factor=data.get("easiness_factor", 2.5),
            interval=data.get("interval", 1),
            repetitions=data.get("repetitions", 0),
            next_review=data.get("next_review"),
            quality_last=data.get("quality_last", 0),
            created_at=data.get("created_at"),
        )


def calculate_new_interval(
    easiness_factor: float,
    interval: int,
    repetitions: int,
    quality: int,
) -> tuple[int, float, int]:
    """
    SM-2 Algorithm for spacing.
    
    Quality: 0-5 score (0=blackout, 5=perfect)
    Returns: (new_interval, new_ease_factor, new_repetitions)
    """
    # Update ease factor
    new_ef = easiness_factor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02))
    new_ef = max(1.3, new_ef)  # EF never below 1.3
    
    # Calculate next interval
    if quality < 3:
        # Failed - reset to 1 day
        new_interval = 1
        new_reps = 0
    else:
        # Passed - increase interval
        if repetitions == 0:
            new_interval = 1
        elif repetitions == 1:
            new_interval = 3
        else:
            new_interval = int(interval * new_ef)
        new_reps = repetitions + 1
    
    return new_interval, new_ef, new_reps


def get_due_cards(user_id: str, limit: int = 20) -> List[SRSCard]:
    """Get cards due for review today."""
    try:
        user_ref = db.collection("users").document(user_id)
        srs_ref = user_ref.collection("srs_cards")
        
        now = datetime.now().isoformat()
        
        # Query cards where next_review <= now
        query = srs_ref.where("next_review", "<=", now).limit(limit)
        docs = query.stream()
        
        cards = [SRSCard.from_dict(doc.to_dict()) for doc in docs]
        return cards
    except Exception as e:
        print(f"Error getting due cards: {e}")
        return []


def add_card_to_srs(user_id: str, word_id: str, word: str, definition: str) -> bool:
    """Add a new word to user's SRS deck."""
    try:
        user_ref = db.collection("users").document(user_id)
        srs_ref = user_ref.collection("srs_cards").document(word_id)
        
        card = SRSCard(word_id, word, definition)
        srs_ref.set(card.to_dict())
        return True
    except Exception as e:
        print(f"Error adding card to SRS: {e}")
        return False


def update_card_after_review(
    user_id: str,
    word_id: str,
    quality: int,  # 0-5 score
) -> Optional[Dict]:
    """
    Update card after review session.
    quality: 0-5 (0=complete blackout, 5=perfect response)
    Returns updated card data or None if error.
    """
    try:
        user_ref = db.collection("users").document(user_id)
        srs_ref = user_ref.collection("srs_cards").document(word_id)
        
        card_doc = srs_ref.get()
        if not card_doc.exists:
            return None
        
        card_data = card_doc.to_dict()
        card = SRSCard.from_dict(card_data)
        
        # Calculate new values using SM-2
        new_interval, new_ef, new_reps = calculate_new_interval(
            easiness_factor=card.easiness_factor,
            interval=card.interval,
            repetitions=card.repetitions,
            quality=quality,
        )
        
        # Calculate next review date
        next_review_date = datetime.now() + timedelta(days=new_interval)
        
        # Update card
        card.easiness_factor = new_ef
        card.interval = new_interval
        card.repetitions = new_reps
        card.next_review = next_review_date.isoformat()
        card.quality_last = quality
        
        # Save to firestore
        srs_ref.update(card.to_dict())
        
        return card.to_dict()
    except Exception as e:
        print(f"Error updating card: {e}")
        return None


def get_srs_stats(user_id: str) -> Dict:
    """Get SRS deck statistics for user."""
    try:
        user_ref = db.collection("users").document(user_id)
        srs_ref = user_ref.collection("srs_cards")
        
        # Get all cards
        all_docs = list(srs_ref.stream())
        total_cards = len(all_docs)
        
        if total_cards == 0:
            return {
                "total_cards": 0,
                "due_today": 0,
                "average_easiness": 2.5,
                "total_reviews": 0,
                "retention_rate": 0,
            }
        
        due_cards = get_due_cards(user_id, limit=1000)
        
        total_reviews = sum(
            doc.to_dict().get("repetitions", 0) for doc in all_docs
        )
        
        avg_ef = sum(
            doc.to_dict().get("easiness_factor", 2.5) for doc in all_docs
        ) / total_cards
        
        # Retention = cards with multiple successful reviews
        successful_reviews = sum(
            1 for doc in all_docs 
            if doc.to_dict().get("repetitions", 0) >= 2
        )
        retention = (successful_reviews / total_cards * 100) if total_cards > 0 else 0
        
        return {
            "total_cards": total_cards,
            "due_today": len(due_cards),
            "average_easiness": round(avg_ef, 2),
            "total_reviews": total_reviews,
            "retention_rate": round(retention, 1),
        }
    except Exception as e:
        print(f"Error getting SRS stats: {e}")
        return {
            "total_cards": 0,
            "due_today": 0,
            "average_easiness": 2.5,
            "total_reviews": 0,
            "retention_rate": 0,
        }
