from fastapi import APIRouter, HTTPException, Header
from app.services.auth import verify_token, get_user_email
from app.services.firestore import get_user_sessions, delete_user_progress
from app.services.onboarding import (
    OnboardingData,
    get_onboarding_questions,
    save_onboarding,
    get_onboarding,
    is_onboarding_complete,
)
from pydantic import BaseModel
from typing import List, Dict

router = APIRouter()


class TokenInput(BaseModel):
    token: str


class OnboardingInput(BaseModel):
    self_assessed_cefr: str
    primary_goal: str
    target_domain: str
    target_exam: str
    perceived_weak_areas: List[str]
    daily_study_minutes: int
    self_ratings: Dict[str, int] = {}


@router.post("/verify")
async def verify(input: TokenInput):
    try:
        user = verify_token(input.token)
        uid = user["uid"]
        email = get_user_email(uid)
        onboarding_done = is_onboarding_complete(uid)
        return {"uid": uid, "email": email, "onboarding_completed": onboarding_done}
    except Exception as e:
        raise HTTPException(status_code=401, detail="Token invalid")


@router.post("/reset-progress")
async def reset_progress(authorization: str = Header(None)):
    """Delete the authenticated user's practice sessions + assessment history from
    Firestore (keeps the account + onboarding). Powers Settings → Reset progress."""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Unauthorized")
    try:
        token = authorization.replace("Bearer ", "")
        user = verify_token(token)
        deleted = delete_user_progress(user["uid"])
        return {"status": "reset", "deleted": deleted}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/history")
async def get_history(authorization: str = Header(None)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Unauthorized")
    try:
        token = authorization.replace("Bearer ", "")
        user = verify_token(token)
        sessions = get_user_sessions(user["uid"])
        return {"sessions": sessions}
    except Exception as e:
        raise HTTPException(status_code=401, detail="Token invalid")


# ─────────────────────────────────────────────────────────────────────────────
# ONBOARDING ENDPOINTS
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/onboarding/questions")
async def get_questions():
    """
    Return the full onboarding question structure (all 6 steps).
    Research-backed questions covering CEFR self-assessment, CAF goals,
    domain focus, target exam, weak areas, and study intensity.
    """
    return get_onboarding_questions()


@router.post("/onboarding")
async def submit_onboarding(
    body: OnboardingInput,
    authorization: str = Header(None),
):
    """
    Save onboarding answers for authenticated user.
    Called once after account creation, before first use of the app.
    Saves to Firestore and marks onboarding_completed = True on user document.
    """
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Unauthorized")
    try:
        token = authorization.replace("Bearer ", "")
        user = verify_token(token)
        uid = user["uid"]

        data = OnboardingData(
            user_id=uid,
            self_assessed_cefr=body.self_assessed_cefr,
            primary_goal=body.primary_goal,
            target_domain=body.target_domain,
            target_exam=body.target_exam,
            perceived_weak_areas=body.perceived_weak_areas,
            daily_study_minutes=body.daily_study_minutes,
            self_ratings=body.self_ratings,
        )

        success = save_onboarding(data)
        if not success:
            raise HTTPException(status_code=500, detail="Failed to save onboarding")

        return {
            "status": "completed",
            "user_id": uid,
            "onboarding": data.to_dict(),
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/onboarding")
async def get_my_onboarding(authorization: str = Header(None)):
    """Retrieve the saved onboarding profile for the authenticated user."""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Unauthorized")
    try:
        token = authorization.replace("Bearer ", "")
        user = verify_token(token)
        profile = get_onboarding(user["uid"])
        if not profile:
            return {"onboarding_completed": False}
        # Return the profile FLAT (fields at top level) — every frontend consumer
        # reads e.g. response.target_exam directly, not response.profile.target_exam.
        return {"onboarding_completed": True, **profile}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
