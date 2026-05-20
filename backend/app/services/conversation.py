from groq import Groq
from dotenv import load_dotenv
import os

load_dotenv()
client = Groq(api_key=os.getenv("GROQ_API_KEY"))

conversation_history = {}

def chat_with_avatar(user_id: str, user_message: str) -> str:
    if user_id not in conversation_history:
        conversation_history[user_id] = [
            {
                "role": "system",
                "content": """You are an English conversation partner helping Romanian speakers practice English at B1-C1 level.
                Keep responses short (2-3 sentences max).
                Correct major grammar or vocabulary mistakes naturally in your response.
                Be encouraging and friendly.
                Always respond in English."""
            }
        ]
    
    conversation_history[user_id].append({
        "role": "user",
        "content": user_message
    })
    
    response = client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=conversation_history[user_id]
    )
    
    assistant_message = response.choices[0].message.content
    
    conversation_history[user_id].append({
        "role": "assistant",
        "content": assistant_message
    })
    
    # Limitam istoricul la 20 mesaje
    if len(conversation_history[user_id]) > 20:
        conversation_history[user_id] = [conversation_history[user_id][0]] + conversation_history[user_id][-18:]
    
    return assistant_message