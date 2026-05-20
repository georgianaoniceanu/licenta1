import os
from elevenlabs.client import ElevenLabs
from dotenv import load_dotenv

load_dotenv()

# Initialize ElevenLabs client
api_key = os.getenv("ELEVENLABS_API_KEY")
if not api_key:
    raise RuntimeError("ELEVENLABS_API_KEY not found in environment variables")

print(f"[TTS] API Key loaded: {api_key[:10]}...")
client = ElevenLabs(api_key=api_key)


def text_to_speech(text: str, voice_id: str = "EXAVITQu4vr4xnSDxMaL") -> bytes:
    """
    Generate audio from text using ElevenLabs TTS.
    Default voice: Sarah (clear, professional English speaker)
    
    Args:
        text: Text to convert to speech
        voice_id: ElevenLabs voice ID (default: Sarah)
    
    Returns:
        bytes: Audio data in MP3 format
    """
    if not text or not text.strip():
        raise ValueError("Text cannot be empty")
    
    try:
        print(f"[TTS] Generating audio for: {text[:50]}...")
        print(f"[TTS] Using voice: {voice_id}")
        print(f"[TTS] Using model: eleven_turbo_v2")
        
        audio_generator = client.text_to_speech.convert(
            voice_id=voice_id,
            text=text,
            model_id="eleven_turbo_v2",
            output_format="mp3_44100_128"
        )
        
        # Collect all audio chunks
        audio_data = b""
        chunk_count = 0
        for chunk in audio_generator:
            audio_data += chunk
            chunk_count += 1
            print(f"[TTS] Chunk {chunk_count}: {len(chunk)} bytes")
        
        print(f"[TTS] Total chunks received: {chunk_count}")
        print(f"[TTS] Generated {len(audio_data)} bytes of audio")
        
        if len(audio_data) == 0:
            raise RuntimeError("ElevenLabs returned empty audio data - check API key and text")
        
        # Verify it looks like MP3 (should start with FF FB or FF FA for MPEG)
        if audio_data[:2] not in [b'\xff\xfb', b'\xff\xfa', b'ID3']:
            print(f"[TTS WARNING] Audio doesn't look like valid MP3. First bytes: {audio_data[:4].hex()}")
        
        return audio_data
    except Exception as e:
        error_msg = f"ElevenLabs TTS error: {str(e)}"
        print(f"[TTS ERROR] {error_msg}")
        import traceback
        traceback.print_exc()
        raise RuntimeError(error_msg)


def get_available_voices() -> dict:
    """Get list of available voices from ElevenLabs"""
    try:
        voices = client.voices.get_all()
        return {voice.voice_id: voice.name for voice in voices.voices}
    except Exception as e:
        raise RuntimeError(f"Error fetching voices: {str(e)}")