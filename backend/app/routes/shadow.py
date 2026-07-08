from fastapi import APIRouter, UploadFile, File, Form, Header, HTTPException
from fastapi.responses import StreamingResponse, JSONResponse
from pydantic import BaseModel
from app.services.shadow_speaking import transcribe_audio_with_timestamps, analyze_fluency
from app.services.phoneme_remote import assess_pronunciation
from app.services.prosody_remote import assess_prosody
from app.services.tts import text_to_speech, text_to_speech_wav
from app.services.firestore import save_shadow_session, get_shadow_sessions
from app.services.coca_genre_classifier import classify_text_genre
from app.services.auth import verify_token
import logging
import tempfile
import os
import io

logger = logging.getLogger(__name__)

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
        # 1) Transcribe with timestamps → text + WPM (de Jong & Wempe 2009).
        #    Guard invalid clips: an empty/corrupt recording makes Whisper (Groq)
        #    return a 400, which would otherwise surface to the user as a 500 crash.
        if len(content) < 1000:
            return JSONResponse(
                {"error": "Recording is empty or too short — please record again."},
                status_code=400,
            )
        try:
            ts_result = transcribe_audio_with_timestamps(tmp_path)
        except Exception as _asr_err:
            logger.warning("Shadow transcription failed (invalid audio?): %s", _asr_err)
            return JSONResponse(
                {"error": "Could not process the audio. Please record again — make sure the clip isn't empty, too short, or corrupted."},
                status_code=400,
            )
        transcribed = ts_result["text"]
        wpm         = ts_result["wpm"]

        # 2) Classify COCA genre of the target text → genre-specific WPM norms
        genre = "_default"
        try:
            genre_info = classify_text_genre(original_text)
            detected   = genre_info.get("dominant_group")
            if detected:
                genre = detected
        except Exception as _genre_err:
            logger.warning("Genre classification failed: %s", _genre_err)

        # 3) Phoneme scoring — always available via local CMU-dict PER (Tier 1),
        #    optionally upgraded to wav2vec2 via Colab (Tier 2, set COLAB_PHONEME_URL).
        #    assess_pronunciation() never returns None — guaranteed by Tier 1.
        try:
            phoneme_result = assess_pronunciation(tmp_path, original_text, transcribed)
            # Only use phoneme_score when it comes from real acoustic analysis (wav2vec2).
            # The local CMU-dict fallback compares transcribed text, not audio — it gives
            # inflated scores whenever Whisper transcribes correctly regardless of pronunciation.
            if phoneme_result.get("_tier") == "colab-wav2vec2":
                phoneme_score = int(phoneme_result.get("accuracy_score", 0))
            else:
                phoneme_score = None
        except Exception as _ph_err:
            logger.warning("Phoneme scoring failed unexpectedly: %s", _ph_err)
            phoneme_score = None

        # 4) Prosody analysis — pitch contour, rhythm, energy envelope.
        #    Generates native TTS audio to compare against learner recording.
        #    Runs when COLAB_PROSODY_URL is set (Tier 1: parselmouth + DTW)
        #    or always via local librosa fallback (Tier 2).
        prosody_result = None
        native_wav_path = None
        try:
            # Use PCM format directly from ElevenLabs → save as WAV → no ffmpeg needed
            native_wav_bytes = text_to_speech_wav(original_text)
            with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as ntmp:
                ntmp.write(native_wav_bytes)
                native_wav_path = ntmp.name
            prosody_result = assess_prosody(tmp_path, native_wav_path)
        except Exception as _pros_err:
            logger.warning("Prosody analysis failed: %s", _pros_err, exc_info=True)
        finally:
            if native_wav_path:
                try:
                    os.unlink(native_wav_path)
                except Exception:
                    pass

        # 5) Full fluency analysis: word accuracy + WPM + pause detection + phoneme + prosody
        result = analyze_fluency(
            transcribed=transcribed,
            original=original_text,
            wpm=wpm,
            phoneme_score=phoneme_score,
            segments=ts_result.get("segments", []),
            duration_s=ts_result["duration_s"],
            genre=genre,
            prosody_result=prosody_result,
        )
        result["transcribed_text"] = transcribed
        result["duration_s"]       = ts_result["duration_s"]
        if phoneme_result:
            result["word_breakdown"] = phoneme_result.get("word_breakdown", [])

        if authorization and authorization.startswith("Bearer "):
            try:
                token = authorization.replace("Bearer ", "")
                user = verify_token(token)
                save_shadow_session(
                    user_id=user["uid"],
                    original_text=original_text,
                    transcribed=transcribed,
                    score=result["accuracy_score"],
                    wpm=wpm,
                    word_accuracy=result["word_accuracy"],
                    phoneme_score=phoneme_score,
                    pause_count=result["pause_analysis"]["pause_count"],
                    pause_rate_per_min=result["pause_analysis"]["pause_rate_per_min"],
                    fluency_label=result["pause_analysis"]["fluency_label"],
                    genre=genre,
                    duration_s=ts_result["duration_s"],
                )
            except Exception as _save_err:
                logger.warning("Could not save shadow session: %s", _save_err)

        return result
    finally:
        os.unlink(tmp_path)


@router.get("/cefr-speech")
async def shadow_cefr_speech(authorization: str = Header(None)):
    """Aggregate the user's Shadow sessions into the two SPEECH CEFR indicators
    (Speech Rate, Fluency) so the dashboard can replace the text diagnostic's
    'not measured' placeholders with real, audio-measured values."""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Unauthorized")
    try:
        token = authorization.replace("Bearer ", "")
        user = verify_token(token)
        sessions = get_shadow_sessions(user["uid"], limit=30)
        valid = [s for s in sessions if s.get("wpm")]
        if not valid:
            return {"n_sessions": 0}

        avg_wpm   = sum(s.get("wpm", 0) for s in valid) / len(valid)
        avg_pause = sum(s.get("pause_rate_per_min", 0) for s in valid) / len(valid)

        from app.services.assessment_indicators import assessment_calculator, IndicatorType
        wps = avg_wpm / 60.0                                   # words per second
        # pauses per syllable ≈ (pauses/min) / (syllables/min); syllables ≈ words×1.5
        pauses_per_syll = avg_pause / max(avg_wpm * 1.5, 1.0)

        sr = assessment_calculator.evaluate_indicator(IndicatorType.ARTICULATION_RATE, wps)
        fl = assessment_calculator.evaluate_indicator(IndicatorType.PAUSE_FREQUENCY, pauses_per_syll)
        return {
            "n_sessions": len(valid),
            "speech_rate": {"score": sr["normalized_score"], "cefr_level": sr["cefr_level"], "wps": round(wps, 2)},
            "fluency":     {"score": fl["normalized_score"], "cefr_level": fl["cefr_level"], "pauses_per_syllable": round(pauses_per_syll, 3)},
        }
    except HTTPException:
        raise
    except Exception as e:
        return {"n_sessions": 0, "error": str(e)}


@router.get("/progress")
async def shadow_progress(authorization: str = Header(None)):
    """
    Return the user's shadow speaking history (last 30 sessions) with trend data.

    Response shape:
    {
      "sessions": [
        {
          "id": "...",
          "created_at": "...",
          "accuracy_score": int,
          "word_accuracy": int,
          "phoneme_score": int | null,
          "wpm": int,
          "pause_count": int,
          "pause_rate_per_min": float,
          "fluency_label": str,
          "genre": str,
          "duration_s": float,
          "original_text": str
        }, ...
      ],
      "trend": {
        "accuracy_delta":   float,   # last session - first session (positive = improving)
        "avg_accuracy":     float,
        "avg_wpm":          float,
        "avg_pause_rate":   float,
        "total_sessions":   int,
        "total_practice_s": float
      }
    }
    """
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Authentication required")

    try:
        token = authorization.replace("Bearer ", "")
        user  = verify_token(token)
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid token")

    sessions = get_shadow_sessions(user["uid"], limit=30)

    # Compute trend metrics
    trend: dict = {
        "accuracy_delta":   0.0,
        "avg_accuracy":     0.0,
        "avg_wpm":          0.0,
        "avg_pause_rate":   0.0,
        "total_sessions":   len(sessions),
        "total_practice_s": 0.0,
    }

    if sessions:
        scores       = [s.get("accuracy_score", 0) for s in sessions]
        wpms         = [s.get("wpm", 0) for s in sessions if s.get("wpm", 0) > 0]
        pause_rates  = [s.get("pause_rate_per_min", 0.0) for s in sessions]
        durations    = [s.get("duration_s", 0.0) for s in sessions]

        trend["avg_accuracy"]     = round(sum(scores) / len(scores), 1)
        trend["avg_wpm"]          = round(sum(wpms) / len(wpms), 1) if wpms else 0.0
        trend["avg_pause_rate"]   = round(sum(pause_rates) / len(pause_rates), 2)
        trend["total_practice_s"] = round(sum(durations), 1)
        # sessions are newest-first → delta = newest - oldest
        trend["accuracy_delta"]   = round(scores[0] - scores[-1], 1)

    # Strip heavy fields for the list view (keep original_text short)
    slim_sessions = []
    for s in sessions:
        slim_sessions.append({
            "id":                 s.get("id"),
            "created_at":        s.get("created_at"),
            "accuracy_score":    s.get("accuracy_score"),
            "word_accuracy":     s.get("word_accuracy"),
            "phoneme_score":     s.get("phoneme_score"),
            "wpm":               s.get("wpm"),
            "pause_count":       s.get("pause_count"),
            "pause_rate_per_min":s.get("pause_rate_per_min"),
            "fluency_label":     s.get("fluency_label"),
            "genre":             s.get("genre"),
            "duration_s":        s.get("duration_s"),
            "original_text":     (s.get("original_text") or "")[:120],
        })

    return {"sessions": slim_sessions, "trend": trend}