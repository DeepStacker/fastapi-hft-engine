"""
Security utilities - Firebase token verification and authentication
"""
import logging
import time
from typing import Optional, Dict, Any
from datetime import datetime

import firebase_admin
from firebase_admin import credentials, auth
from firebase_admin.auth import InvalidIdTokenError, ExpiredIdTokenError

from app.config.settings import settings

logger = logging.getLogger(__name__)

# Initialize Firebase Admin SDK
_firebase_app: Optional[firebase_admin.App] = None

# Rate limiting for token error logs (to prevent log spam)
_last_token_error_log = 0
_TOKEN_ERROR_LOG_INTERVAL = 60  # Only log token errors once per minute


def _log_token_error_throttled(message: str) -> None:
    """Log token errors at most once per minute to prevent log spam."""
    global _last_token_error_log
    current_time = time.time()
    if current_time - _last_token_error_log >= _TOKEN_ERROR_LOG_INTERVAL:
        logger.warning(message)
        _last_token_error_log = current_time


def init_firebase() -> None:
    """Initialize Firebase Admin SDK"""
    global _firebase_app
    
    if _firebase_app is not None:
        return
    
    try:
        # Try to load from environment variable JSON string first
        if settings.FIREBASE_CREDENTIALS_JSON:
            import json
            cred_dict = json.loads(settings.FIREBASE_CREDENTIALS_JSON)
            cred = credentials.Certificate(cred_dict)
            logger.info("Firebase Admin SDK initialized from environment variable")
        else:
            # Fallback to file path
            cred_path = settings.FIREBASE_CREDENTIALS_PATH
            cred = credentials.Certificate(cred_path)
            logger.info(f"Firebase Admin SDK initialized from file: {cred_path}")
            
        _firebase_app = firebase_admin.initialize_app(cred)
        logger.info("Firebase Admin SDK initialized successfully")
    except Exception as e:
        logger.error(f"Failed to initialize Firebase Admin SDK: {e}")
        # Allow app to run without Firebase in development
        if settings.is_production:
            raise


def verify_firebase_token(token: str) -> Optional[Dict[str, Any]]:
    """
    Verify Firebase ID token and return decoded token data.
    
    Args:
        token: Firebase ID token string
        
    Returns:
        Decoded token dictionary if valid, None otherwise
    """
    if _firebase_app is None:
        init_firebase()
    
    if _firebase_app is None:
        logger.warning("Firebase not initialized, skipping token verification")
        # In development, allow bypass with mock data
        if settings.is_development:
            return {
                "uid": "dev-user-uid",
                "email": "dev@example.com",
                "email_verified": True,
            }
        return None
    
    try:
        decoded_token = auth.verify_id_token(token, check_revoked=True)
        return {
            "uid": decoded_token.get("uid"),
            "email": decoded_token.get("email"),
            "email_verified": decoded_token.get("email_verified", False),
            "name": decoded_token.get("name"),
            "picture": decoded_token.get("picture"),
            "sign_in_provider": decoded_token.get("firebase", {}).get("sign_in_provider"),
            "auth_time": decoded_token.get("auth_time"),
        }
    except ExpiredIdTokenError:
        _log_token_error_throttled("Firebase token expired")
        return None
    except InvalidIdTokenError as e:
        _log_token_error_throttled(f"Invalid Firebase token: {e}")
        return None
    except Exception as e:
        _log_token_error_throttled(f"Error verifying Firebase token: {e}")
        # In development, try to decode token payload without verification
        if settings.is_development:
            try:
                # Decode JWT payload without verification (Header.Payload.Signature)
                import base64
                import json
                parts = token.split('.')
                if len(parts) >= 2:
                    # Add padding if needed
                    payload = parts[1]
                    padding = 4 - len(payload) % 4
                    if padding != 4:
                        payload += '=' * padding
                    decoded_payload = json.loads(base64.urlsafe_b64decode(payload))
                    
                    email = decoded_payload.get("email")
                    uid = decoded_payload.get("user_id") or decoded_payload.get("sub") or decoded_payload.get("uid")
                    
                    if email and uid:
                        # Extract successful in dev mode - no need to log every time
                        return {
                            "uid": uid,
                            "email": email,
                            "email_verified": decoded_payload.get("email_verified", True),
                            "name": decoded_payload.get("name", ""),
                            "picture": decoded_payload.get("picture"),
                            "sign_in_provider": decoded_payload.get("firebase", {}).get("sign_in_provider", "google.com"),
                        }
            except Exception as decode_error:
                logger.warning(f"DEV MODE: Failed to decode token: {decode_error}")
            
            # Only use mock user as last resort
            logger.warning("DEV MODE: Using mock user as fallback")
            return {
                "uid": "dev-user-uid",
                "email": "dev@example.com",
                "email_verified": True,
                "name": "Dev User",
                "picture": None,
            }
            
        logger.error(f"Error verifying Firebase token: {e}. Token: {token[:10]}...", exc_info=True)
        return None


def revoke_user_tokens(uid: str) -> bool:
    """
    Revoke all refresh tokens for a user.
    
    Args:
        uid: Firebase user UID
        
    Returns:
        True if successful, False otherwise
    """
    if _firebase_app is None:
        init_firebase()
    
    try:
        auth.revoke_refresh_tokens(uid)
        logger.info(f"Revoked tokens for user: {uid}")
        return True
    except Exception as e:
        logger.error(f"Failed to revoke tokens for user {uid}: {e}")
        return False


def get_firebase_user(uid: str) -> Optional[Dict[str, Any]]:
    """
    Get Firebase user by UID.
    
    Args:
        uid: Firebase user UID
        
    Returns:
        User data dictionary if found, None otherwise
    """
    if _firebase_app is None:
        init_firebase()
    
    try:
        user = auth.get_user(uid)
        return {
            "uid": user.uid,
            "email": user.email,
            "email_verified": user.email_verified,
            "display_name": user.display_name,
            "photo_url": user.photo_url,
            "disabled": user.disabled,
            "provider_data": [
                {"provider_id": p.provider_id, "email": p.email}
                for p in user.provider_data
            ],
        }
    except Exception as e:
        logger.error(f"Failed to get Firebase user {uid}: {e}")
        return None
