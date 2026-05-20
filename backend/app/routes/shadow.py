from fastapi import APIRouter, UploadFile, File, Form, Header, HTTPException
from fastapi.responses import StreamingResponse, JSONResponse
from pydantic import BaseModel
from app.services.shadow_speaking import transcribe_audio, analyze_fluency
from app.services.tts import text_to_speech
from app.services.firestore import save_shadow_session
from app.services.auth import verify_token
import tempfile
import os
import io

router = APIRouter()


class GenerateAudioRequest(BaseModel):
    text: str
    voice_id: str = "EXAVITQu4vr4xnSDxMaL"


@router.post("/generate-audio")
async def generate_audio(request: GenerateAudioRequest):
    """
    Generate audio from text using ElevenLabs TTS.
    Returns MP3 audio stream with proper headers.
    """
    try:
        text = request.text
        voice_id = request.voice_id

        if not text or not text.strip():
            return JSONResponse(
                {"error": "Text is required and cannot be empty"}, 
                status_code=400
            )

        print(f"[SHADOW] Generating audio for: {text[:50]}...")
        audio_data = text_to_speech(text, voice_id)
        print(f"[SHADOW] Generated audio: {len(audio_data)} bytes")

        if not audio_data or len(audio_data) == 0:
            print("[SHADOW ERROR] Audio data is empty!")
            return JSONResponse(
                {"error": "Failed to generate audio data"}, 
                status_code=500
            )

        return StreamingResponse(
            io.BytesIO(audio_data),
            media_type="audio/mpeg",
            headers={
                "Content-Type": "audio/mpeg",
                "Content-Length": str(len(audio_data)),
                "Cache-Control": "no-cache, no-store, must-revalidate",
            }
        )
    except ValueError as e:
        print(f"[SHADOW ERROR] Validation error: {str(e)}")
        return JSONResponse(
            {"error": f"Invalid input: {str(e)}"}, 
            status_code=400
        )
    except RuntimeError as e:
        print(f"[SHADOW ERROR] TTS error: {str(e)}")
        return JSONResponse(
            {"error": f"Audio generation failed: {str(e)}"}, 
            status_code=500
        )
    except Exception as e:
        print(f"[SHADOW ERROR] Unexpected error: {str(e)}")
        import traceback
        traceback.print_exc()
        return JSONResponse(
            {"error": f"Server error: {str(e)}"}, 
            status_code=500
        )

@router.post("/analyze")
async def analyze_shadow(
    audio: UploadFile = File(...),
    original_text: str = Form(...),
    authorization: str = Header(None)
):
    with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as tmp:
        content = await audio.read()
        tmp.write(content)
        tmp_path = tmp.name

    try:
        transcribed = transcribe_audio(tmp_path)
        result = analyze_fluency(transcribed, original_text)
        result["transcribed_text"] = transcribed

        if authorization and authorization.startswith("Bearer "):
            try:
                token = authorization.replace("Bearer ", "")
                user = verify_token(token)
                save_shadow_session(
                    user_id=user["uid"],
                    original_text=original_text,
                    transcribed=transcribed,
                    score=result["accuracy_score"]
                )
            except:
                pass

        return result
    finally:
        os.unlink(tmp_path)