from firebase_admin import auth

def verify_token(token: str) -> dict:
    """Verify Firebase ID token and return decoded user data."""
    decoded_token = auth.verify_id_token(token)
    return decoded_token

def get_user_email(uid: str) -> str:
    """Get user email from Firebase Auth user record."""
    try:
        user = auth.get_user(uid)
        return user.email
    except Exception as e:
        return None