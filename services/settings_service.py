import logging
from sqlalchemy.ext.asyncio import AsyncSession

from crud import user_crud
from models.user import UserPreferences
from models.db_models import User as UserInDBModel

logger = logging.getLogger(__name__)

async def update_user_settings(
    db: AsyncSession,
    current_user: UserInDBModel,
    preferences: UserPreferences
) -> UserPreferences:
    """
    Updates user preferences in the database.

    Returns the updated UserPreferences model.
    Raises ValueError or other DB exceptions on failure.
    """
    try:
        updated_user = await user_crud.update_user_prefs(db=db, db_user=current_user, preferences=preferences)
        logger.info(f"Service updated preferences for user '{current_user.username}'")

        # Parse preferences back from DB model (assuming JSON storage)
        if isinstance(updated_user.preferences, dict):
             return UserPreferences(**updated_user.preferences)
        else:
             # Handle cases where preferences might not be a dict (e.g., error, different storage)
             logger.error(f"Preferences for user '{current_user.username}' were not stored as dict after update.")
             # Return the input preferences as a fallback, or raise an error
             # raise ValueError("Failed to retrieve updated preferences correctly.")
             return preferences # Or return the input as best effort

    except Exception as e:
        logger.error(f"Service error updating preferences for user '{current_user.username}': {e}", exc_info=True)
        # Re-raise the exception to be handled by the route
        raise

