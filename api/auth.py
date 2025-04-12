from fastapi import APIRouter, Depends, HTTPException, status, Request, Response
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from fastapi.responses import HTMLResponse
from typing import Optional, Dict, Union
import logging
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel
from datetime import timedelta

# Import Firebase Admin auth
from firebase_admin import auth

# Import DB session dependency and CRUD
from core.database import get_db
from crud import user_crud
from models import db_models
# Import Pydantic models
from models.user import (
    UserCreate, UserPublic, UserPreferences,
    PasswordChange, PasswordResetRequest, PasswordResetPerform
)
# Import security functions
from core.security import (
    get_password_hash, verify_password, create_token_pair, verify_token,
    blacklist_token, create_password_reset_token, verify_password_reset_token,
    TokenPayload # Import TokenPayload
)
from core.config import settings

logger = logging.getLogger(__name__)
router = APIRouter()

# --- Token Model Definition (for manual JWT) ---
class Token(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str

# --- Custom Bearer Token Scheme ---
class BearerTokenScheme(OAuth2PasswordBearer):
    async def __call__(self, request: Request) -> Optional[str]:
        authorization = request.headers.get("Authorization")
        if not authorization:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Not authenticated",
                headers={"WWW-Authenticate": "Bearer"},
            )
        scheme, _, token = authorization.partition(" ")
        if scheme.lower() != "bearer":
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid authentication scheme. Use Bearer",
                headers={"WWW-Authenticate": "Bearer"},
            )
        return token

# --- OAuth2 Scheme --- (Used by both dependencies)
oauth2_scheme = BearerTokenScheme(tokenUrl="/auth/token")

# --- Combined Authentication Dependency --- (Handles Firebase or JWT)
async def get_current_active_user(
    request: Request,
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db)
) -> db_models.User:
    """
    Dependency to get the current user, handling both Firebase and JWT tokens.
    Prioritizes Firebase token verification if available and initialized.
    Falls back to JWT verification.
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    user: Optional[db_models.User] = None

    # 1. Try Firebase Verification (if initialized)
    if request.app.state.firebase_initialized:
        try:
            decoded_token = auth.verify_id_token(token, check_revoked=True)
            firebase_uid = decoded_token.get("uid")
            email = decoded_token.get("email")
            if firebase_uid:
                user = await user_crud.get_or_create_firebase_user(db, uid=firebase_uid, email=email)
        except auth.RevokedIdTokenError:
            logger.warning(f"Firebase token revoked.")
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token has been revoked.")
        except auth.UserDisabledError:
            logger.warning(f"Firebase user disabled.")
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Firebase user account is disabled.")
        except auth.InvalidIdTokenError:
            logger.debug("Token is not a valid Firebase token, trying JWT.")
            # Fall through to JWT verification
            pass
        except Exception as e:
            logger.error(f"Unexpected error during Firebase verification: {e}", exc_info=True)
            # Fall through to JWT verification as a precaution, or raise 500?
            pass

    # 2. Try JWT Verification (if user not found via Firebase or Firebase failed/not init)
    if user is None:
        redis_client = request.app.state.redis
        if not redis_client:
             logger.error("Redis client not available for JWT verification.")
             raise credentials_exception # Cannot verify JWT without Redis for blacklist

        token_data: Optional[TokenPayload] = await verify_token(token, redis_client)
        if token_data and token_data.sub and token_data.type == 'access':
            # Find user based on JWT subject (username)
            user = await user_crud.get_user_by_username(db=db, username=token_data.sub)
        else:
            logger.debug("JWT verification failed or token type is not 'access'.")

    # 3. Final Checks
    if user is None:
        logger.debug("Could not identify user from token (neither Firebase nor JWT).")
        raise credentials_exception

    if user.disabled:
        logger.warning(f"Authentication attempt by disabled user: {user.username}")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Inactive user")

    return user

# --- Manual Authentication Endpoints --- (Restored)

@router.post("/auth/register", response_model=UserPublic, status_code=status.HTTP_201_CREATED)
async def register_user(
    user_in: UserCreate,
    db: AsyncSession = Depends(get_db)
):
    """Registers a new user with username, email, password (manual)."""
    # Check username uniqueness
    if await user_crud.get_user_by_username(db, username=user_in.username):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username already registered",
        )
    # Check email uniqueness
    if await user_crud.get_user_by_email(db, email=user_in.email):
         raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered",
        )

    hashed_password = get_password_hash(user_in.password)
    try:
        user_db = await user_crud.create_user(db=db, user=user_in, hashed_password=hashed_password)
    except ValueError as e:
         logger.error(f"Error creating user: {e}")
         raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="User with this username or email might already exist.",
        )
    except Exception as e:
        logger.error(f"Unexpected error creating user: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An internal error occurred during registration.",
        )

    logger.info(f"User registered manually: {user_db.username}")
    return user_db

@router.post("/auth/token", response_model=Token)
async def login_for_access_token(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: AsyncSession = Depends(get_db)
):
    """Provides JWT access/refresh token pair for valid username/email and password."""
    user = await user_crud.get_user_by_username_or_email(db, identifier=form_data.username)

    # Ensure user exists and has a password (i.e., not a Firebase-only user)
    if not user or not user.hashed_password or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username/email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    if user.disabled:
         raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Inactive user")

    # Create JWT token pair
    tokens = await create_token_pair(user.username)
    logger.info(f"User logged in manually: {user.username}")
    return tokens

@router.post("/auth/refresh", response_model=Token)
async def refresh_jwt_token(
    request: Request,
    refresh_token: str = Depends(oauth2_scheme), # Get refresh token from header
    db: AsyncSession = Depends(get_db)
):
    """Creates new JWT token pair using a valid JWT refresh token."""
    redis_client = request.app.state.redis
    if not redis_client:
        raise HTTPException(status_code=503, detail="Token service unavailable (Redis)")

    token_data = await verify_token(refresh_token, redis_client)

    if not token_data or token_data.type != "refresh" or not token_data.sub or not token_data.jti or not token_data.exp:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Check if user still exists and is active
    user = await user_crud.get_user_by_username(db, username=token_data.sub)
    if not user or user.disabled:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User associated with token is invalid or disabled",
        )

    # Create new token pair
    new_tokens = await create_token_pair(token_data.sub)

    # Blacklist the used refresh token
    await blacklist_token(token_data.jti, token_data.exp, redis_client)

    logger.info(f"JWT token refreshed for user: {token_data.sub}")
    return new_tokens

@router.post("/auth/logout")
async def logout(
    request: Request,
    token: str = Depends(oauth2_scheme),
):
    """Logout endpoint that blacklists the current JWT access or refresh token."""
    redis_client = request.app.state.redis
    if not redis_client:
        raise HTTPException(status_code=503, detail="Token service unavailable (Redis)")

    token_data = await verify_token(token, redis_client) # Verify without checking type initially

    if token_data and token_data.jti and token_data.exp:
        # Blacklist the current token (access or refresh)
        await blacklist_token(token_data.jti, token_data.exp, redis_client)
        logger.info(f"Token blacklisted for user {token_data.sub} (JTI: {token_data.jti})")
        return {"message": "Successfully logged out"}
    else:
        # Token was already invalid or couldn't be parsed
        logger.warning("Logout attempt with invalid token.")
        # Still return success to avoid leaking token validity info
        return {"message": "Logout processed (token invalid)"}


# --- Password Management Endpoints --- (Restored)

@router.post("/users/me/change-password", status_code=status.HTTP_204_NO_CONTENT)
async def change_current_user_password(
    password_data: PasswordChange,
    current_user: db_models.User = Depends(get_current_active_user), # Use combined dependency
    db: AsyncSession = Depends(get_db)
):
    """Allows the currently authenticated user to change their manual password."""
    # Ensure the user has a password (i.e., not Firebase-only)
    if not current_user.hashed_password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password change not applicable for this account type.",
        )
    if not verify_password(password_data.current_password, current_user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Incorrect current password",
        )
    await user_crud.update_user_password(db=db, db_user=current_user, new_password=password_data.new_password)
    logger.info(f"User '{current_user.username}' changed their password.")
    return Response(status_code=status.HTTP_204_NO_CONTENT)

@router.post("/auth/forgot-password")
async def forgot_password(
    request_data: PasswordResetRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    Initiates the password reset process for manual accounts.
    Sends a reset token via email (conceptual).
    """
    user = await user_crud.get_user_by_email(db, email=request_data.email)
    # Only proceed if user exists and has a password (is a manual user)
    if user and user.hashed_password:
        reset_token = create_password_reset_token(email=request_data.email)
        # --- !!! Email Sending Logic Placeholder !!! ---
        print(f"--- Password Reset Email (Simulation) ---")
        print(f"To: {request_data.email}")
        print(f"Subject: Reset Your Password")
        print(f"Body: Click the link: /auth/reset-password?token={reset_token}")
        print(f"---------------------------------------")
        logger.info(f"Password reset token generated for email: {request_data.email}")
        # --- End Placeholder ---
    else:
        logger.warning(f"Password reset requested for non-existent or non-manual email: {request_data.email}")

    # Always return a generic success message
    return {"message": "If an account with that email exists and requires a password reset, a link has been sent."}

@router.post("/auth/reset-password", status_code=status.HTTP_204_NO_CONTENT)
async def reset_password(
    reset_data: PasswordResetPerform,
    db: AsyncSession = Depends(get_db)
):
    """Resets the user's manual password using a valid reset token."""
    email = verify_password_reset_token(reset_data.token)
    if not email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired password reset token",
        )

    user = await user_crud.get_user_by_email(db, email=email)
    # Ensure user exists and is a manual user
    if not user or not user.hashed_password:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User associated with token not found or not applicable for password reset.",
        )
    if user.disabled:
         raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot reset password for an inactive user")

    await user_crud.update_user_password(db=db, db_user=user, new_password=reset_data.new_password)
    logger.info(f"Password reset successfully for user: {user.username} (via email: {email})")
    # Optional: Add logic here to blacklist the used reset token if needed
    # (e.g., by adding its payload/jti to the main blacklist)

    return Response(status_code=status.HTTP_204_NO_CONTENT)

@router.get("/users/me", response_model=UserPublic)
async def read_users_me(
    current_user: db_models.User = Depends(get_current_active_user) # Use combined dependency
):
    """Returns the current authenticated user's public information from local DB."""
    # Pydantic model validates from attributes
    return current_user

@router.get("/login", response_class=HTMLResponse)
async def login_page():
    """Serves a simple login page with Google Sign-in."""
    html = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <title>Login with Google</title>
        <script src="https://www.gstatic.com/firebasejs/9.6.1/firebase-app-compat.js"></script>
        <script src="https://www.gstatic.com/firebasejs/9.6.1/firebase-auth-compat.js"></script>
    </head>
    <body>
        <h2>Login with Google</h2>
        <button id="googleLogin">Sign in with Google</button>
        <div id="userInfo" style="display:none;">
            <p>Logged in as: <span id="userEmail"></span></p>
            <p>ID Token: <textarea id="idToken" rows="5" cols="50" readonly></textarea></p>
            <button id="logoutBtn">Logout</button>
        </div>

        <script>
            // Firebase configuration
            const firebaseConfig = {{
                apiKey: "{settings.FIREBASE_API_KEY}",
                authDomain: "{settings.FIREBASE_AUTH_DOMAIN}",
                projectId: "{settings.FIREBASE_PROJECT_ID}",
                storageBucket: "{settings.FIREBASE_STORAGE_BUCKET}",
                messagingSenderId: "{settings.FIREBASE_MESSAGING_SENDER_ID}",
                appId: "{settings.FIREBASE_APP_ID}",
                measurementId: "{settings.FIREBASE_MEASUREMENT_ID}"
            }};

            // Initialize Firebase
            firebase.initializeApp(firebaseConfig);

            // Get elements
            const googleBtn = document.getElementById('googleLogin');
            const userInfo = document.getElementById('userInfo');
            const userEmail = document.getElementById('userEmail');
            const idTokenArea = document.getElementById('idToken');
            const logoutBtn = document.getElementById('logoutBtn');

            // Google sign-in provider
            const provider = new firebase.auth.GoogleAuthProvider();

            // Add click event for Google sign-in
            googleBtn.addEventListener('click', () => {{
                firebase.auth().signInWithPopup(provider)
                    .catch((error) => {{
                        console.error('Error:', error);
                        alert('Login failed: ' + error.message);
                    }});
            }});

            // Add click event for logout
            logoutBtn.addEventListener('click', () => {{
                firebase.auth().signOut()
                    .then(() => {{
                        userInfo.style.display = 'none';
                        googleBtn.style.display = 'block';
                    }})
                    .catch((error) => {{
                        console.error('Error:', error);
                        alert('Logout failed: ' + error.message);
                    }});
            }});

            // Listen for auth state changes
            firebase.auth().onAuthStateChanged((user) => {{
                if (user) {{
                    // User is signed in
                    userEmail.textContent = user.email;
                    user.getIdToken(true)
                        .then((idToken) => {{
                            idTokenArea.value = idToken;
                        }});
                    userInfo.style.display = 'block';
                    googleBtn.style.display = 'none';

                    // Example of how to use the token with your API
                    console.log('You can now use this token in the Authorization header:');
                    console.log('Authorization: Bearer ' + idToken);
                }} else {{
                    // User is signed out
                    userInfo.style.display = 'none';
                    googleBtn.style.display = 'block';
                }}
            }});
        </script>
    </body>
    </html>
    """
    return html

