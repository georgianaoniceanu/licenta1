from fastapi import APIRouter, UploadFile, File, Header
from app.services.accent_dna import transcribe_audio
from app.services.conversation import chat_with_avatar
from app.services.auth import verify_token
from fastapi.responses import Response, JSONResponse
import tempfile
import os
import urllib.parse
from concurrent.futures import ThreadPoolExecutor, TimeoutError as FuturesTimeoutError

_EXECUTOR = ThreadPoolExecutor(max_workers=3)

# TTS is optional — if ElevenLabs is down or quota is exhausted we still want
# the chat (transcription + response) to work for the demo.
try:
    from app.services.tts import text_to_speech
    _TTS_AVAILABLE = True
except Exception as _tts_err:
    print(f"[conversation] TTS module disabled at import: {_tts_err}")
    text_to_speech = None  # type: ignore
    _TTS_AVAILABLE = False

router = APIRouter()


def _safe_header(value: str) -> str:
    """URL-encode a value so it can be put safely in an HTTP header."""
    return urllib.parse.quote(value or "")


@router.post("/chat")
async def chat(
    audio: UploadFile = File(...),
    authorization: str = Header(None)
):
    user_id = "anonymous"
    if authorization and authorization.startswith("Bearer "):
        try:
            token = authorization.replace("Bearer ", "")
            user = verify_token(token)
            user_id = user["uid"]
        except Exception:
            pass

    # Pick suffix from the uploaded filename so Whisper sees the correct format.
    # Web browsers send webm/ogg/m4a; native sends m4a.
    suffix = ".webm"
    if audio.filename:
        lower = audio.filename.lower()
        for ext in (".m4a", ".mp4", ".mp3", ".ogg", ".oga", ".wav", ".webm", ".flac"):
            if lower.endswith(ext):
                suffix = ext
                break

    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        content = await audio.read()
        tmp.write(content)
        tmp_path = tmp.name

    if not content or len(content) < 200:
        try:
            os.unlink(tmp_path)
        except Exception:
            pass
        return JSONResponse(
            status_code=200,
            content={
                "transcribed": "",
                "response": "",
                "audio_available": False,
                "error": "audio_too_short_or_empty",
            },
        )

    transcribed = ""
    response_text = ""
    print(f"[conversation] received audio: filename={audio.filename}, size={len(content)} bytes, suffix={suffix}")
    try:
        # ── 1. Transcribe (20s hard timeout) ──────────────────────────────
        try:
            future = _EXECUTOR.submit(transcribe_audio, tmp_path)
            transcribed = (future.result(timeout=20) or "")
            print(f"[conversation] Whisper returned: {repr(transcribed)[:200]}")
        except FuturesTimeoutError:
            print("[conversation] Whisper timeout (20s)")
            return JSONResponse(
                status_code=200,
                content={
                    "transcribed": "",
                    "response": "",
                    "audio_available": False,
                    "error": "transcription_timeout_20s",
                },
            )
        except Exception as e:
            print(f"[conversation] transcribe failed: {e}")
            import traceback; traceback.print_exc()
            return JSONResponse(
                status_code=200,
                content={
                    "transcribed": "",
                    "response": "",
                    "audio_available": False,
                    "error": f"transcription_failed: {str(e)[:160]}",
                },
            )

        if not transcribed.strip():
            return JSONResponse(
                status_code=200,
                content={
                    "transcribed": "",
                    "response": "",
                    "audio_available": False,
                    "error": "no_speech_detected",
                },
            )

        # ── 2. LLM response (20s hard timeout) ────────────────────────────
        try:
            future = _EXECUTOR.submit(chat_with_avatar, user_id, transcribed)
            response_text = (future.result(timeout=20) or "")
            print(f"[conversation] LLM returned: {response_text[:80]!r}")
        except FuturesTimeoutError:
            print("[conversation] LLM timeout (20s)")
            return JSONResponse(
                status_code=200,
                content={
                    "transcribed": transcribed,
                    "response": "",
                    "audio_available": False,
                    "error": "llm_timeout_20s",
                },
            )
        except Exception as e:
            print(f"[conversation] LLM failed: {e}")
            return JSONResponse(
                status_code=200,
                content={
                    "transcribed": transcribed,
                    "response": "",
                    "audio_available": False,
                    "error": f"llm_failed: {str(e)[:160]}",
                },
            )

        # ── 3. TTS (optional — never blocks the conversation) ─────────────
        # Hard 15s timeout: if ElevenLabs hangs we still return text response.
        audio_bytes = b""
        tts_error = None
        if _TTS_AVAILABLE and text_to_speech and response_text.strip():
            try:
                print(f"[conversation] TTS start: {response_text[:60]!r}")
                future = _EXECUTOR.submit(text_to_speech, response_text)
                audio_bytes = future.result(timeout=15)
                print(f"[conversation] TTS done: {len(audio_bytes)} bytes")
            except FuturesTimeoutError:
                tts_error = "tts_timeout_15s"
                print("[conversation] TTS timed out after 15s — returning text-only")
            except Exception as e:
                tts_error = str(e)[:160]
                print(f"[conversation] TTS failed (non-fatal): {e}")

        # Return audio if we have it, otherwise text-only JSON (still usable!)
        if audio_bytes:
            return Response(
                content=audio_bytes,
                media_type="audio/mpeg",
                headers={
                    "X-Transcribed": _safe_header(transcribed),
                    "X-Response": _safe_header(response_text),
                    "X-Audio-Available": "true",
                },
            )
        return JSONResponse(
            status_code=200,
            content={
                "transcribed": transcribed,
                "response": response_text,
                "audio_available": False,
                "tts_error": tts_error,
            },
        )
    finally:
        try:
            os.unlink(tmp_path)
        except Exception:
            pass