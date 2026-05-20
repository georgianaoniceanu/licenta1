"""
SRS (Spaced Repetition System) Routes
Endpoints for managing vocabulary review schedules.
"""

from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel
from app.services.srs import (
    get_due_cards,
    add_card_to_srs,
    update_card_after_review,
    get_srs_stats,
)
from app.services.vocabulary_coach import _save_response_time, get_rt_stats
from app.services.auth import verify_token

router = APIRouter()


class AddCardPayload(BaseModel):
    word_id: str
    word: str
    definition: str


class ReviewCardPayload(BaseModel):
    word_id: str
    quality: int  # 0-5 score
    response_time_ms: int = 0  # DeKeyser & Suzuki (2025): RT measures automatization


def get_user_id_from_token(authorization: str):
    """Extract user_id from Bearer token."""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing authorization header")
    
    token = authorization.replace("Bearer ", "")
    user = verify_token(token)
    return user["uid"]


@router.get("/due")
async def get_due_reviews(authorization: str = Header(None), limit: int = 20):
    """
    Get cards due for review today.
    
    Returns up to `limit` cards (default 20) that are due for review now.
    Each card includes the word, definition, and spaced repetition metrics.
    """
    user_id = get_user_id_from_token(authorization)
    
    try:
        cards = get_due_cards(user_id, limit=limit)
        return {
            "success": True,
            "due_cards": [card.to_dict() for card in cards],
            "count": len(cards),
        }
    except Exception as e:
        return {
            "success": False,
            "error": str(e),
            "due_cards": [],
            "count": 0,
        }


@router.post("/add")
async def add_to_srs(
    payload: AddCardPayload,
    authorization: str = Header(None),
):
    """
    Add a new word to the user's SRS deck.
    
    The word will be scheduled for review starting tomorrow.
    """
    user_id = get_user_id_from_token(authorization)
    
    try:
        success = add_card_to_srs(
            user_id=user_id,
            word_id=payload.word_id,
            word=payload.word,
            definition=payload.definition,
        )
        
        if success:
            return {
                "success": True,
                "message": f"Added '{payload.word}' to your review deck",
            }
        else:
            return {
                "success": False,
                "error": "Could not add card to SRS",
            }
    except Exception as e:
        return {
            "success": False,
            "error": str(e),
        }


@router.post("/review")
async def review_card(
    payload: ReviewCardPayload,
    authorization: str = Header(None),
):
    """
    Mark a card as reviewed with quality score (0-5).
    
    Quality scoring:
    - 0: Complete blackout, no recollection
    - 1: Incorrect response, serious difficulty
    - 2: Incorrect response, but felt easy
    - 3: Correct response after serious difficulty
    - 4: Correct response after hesitation
    - 5: Correct response and perfect confidence
    
    Returns updated card with new review schedule.
    """
    user_id = get_user_id_from_token(authorization)
    
    if not 0 <= payload.quality <= 5:
        raise HTTPException(status_code=400, detail="Quality must be 0-5")
    
    try:
        updated_card = update_card_after_review(
            user_id=user_id,
            word_id=payload.word_id,
            quality=payload.quality,
        )
        if payload.response_time_ms > 0:
            _save_response_time(user_id, payload.response_time_ms, payload.quality >= 3)
        
        if updated_card:
            return {
                "success": True,
                "message": "Card reviewed successfully",
                "card": updated_card,
            }
        else:
            return {
                "success": False,
                "error": "Card not found",
            }
    except Exception as e:
        return {
            "success": False,
            "error": str(e),
        }


@router.get("/stats")
async def get_stats(authorization: str = Header(None)):
    """
    Get SRS deck statistics.
    
    Returns:
    - total_cards: total words in deck
    - due_today: cards due for review now
    - average_easiness: average easiness factor (2.5 is default)
    - total_reviews: total review sessions completed
    - retention_rate: % of cards mastered (reviewed 2+ times successfully)
    """
    user_id = get_user_id_from_token(authorization)
    
    try:
        stats = get_srs_stats(user_id)
        return {
            "success": True,
            "data": stats,
        }
    except Exception as e:
        return {
            "success": False,
            "error": str(e),
        }
