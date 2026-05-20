from groq import Groq
from dotenv import load_dotenv
import os

load_dotenv()
client = Groq(api_key=os.getenv("GROQ_API_KEY"))

def transcribe_audio(audio_file_path: str) -> str:
    with open(audio_file_path, "rb") as audio_file:
        transcription = client.audio.transcriptions.create(
            model="whisper-large-v3",
            file=audio_file,
            response_format="text"
        )
    return transcription

def analyze_fluency(transcribed: str, original: str) -> dict:
    response = client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[
            {
                "role": "system",
                "content": """You are a fluency coach for Romanian speakers learning English.
                Compare the transcribed speech with the original text and analyze fluency.
                Respond ONLY with a JSON object:
                {
                    "accuracy_score": 85,
                    "missing_words": ["word1", "word2"],
                    "extra_words": ["word1"],
                    "fluency_feedback": "brief feedback about rhythm and flow",
                    "connected_speech_tips": "specific tip about word connections"
                }"""
            },
            {
                "role": "user",
                "content": f"Original: '{original}'\nTranscribed: '{transcribed}'"
            }
        ]
    )
    import json
    return json.loads(response.choices[0].message.content)