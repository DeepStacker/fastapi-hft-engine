import os
from dotenv import load_dotenv
from pydantic_settings import BaseSettings
from pydantic import Extra
from typing import Optional
import json

load_dotenv()

class Settings(BaseSettings):
    # --- Core Settings ---
    PROJECT_NAME: str = "Stockify RestAPI"
    API_V1_STR: str = "/api/v1"

    # --- Database ---
    # Replace 'your_database_name' with the actual name of the database you want to use.
    DATABASE_URL: str = os.getenv("DATABASE_URL", "mysql+aiomysql://root:Shivam%40977140@localhost:3306/test_db") # Ensure password characters are URL-encoded if necessary (@ becomes %40)

    # --- Security ---
    SECRET_KEY: str = os.getenv("SECRET_KEY", "a_very_insecure_default_secret_key_replace_me")
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7  # 7 days
    PASSWORD_RESET_TOKEN_EXPIRE_MINUTES = 60 # Password reset token lifetime (e.g., 1 hour)


    # --- Firebase Configuration ---
    FIREBASE_API_KEY: str
    FIREBASE_AUTH_DOMAIN: str
    FIREBASE_DATABASE_URL: str
    FIREBASE_PROJECT_ID: str = "true-false-c6b46"
    FIREBASE_STORAGE_BUCKET: str
    FIREBASE_MESSAGING_SENDER_ID: str
    FIREBASE_APP_ID: str
    FIREBASE_MEASUREMENT_ID: str
    FIREBASE_CREDENTIALS_JSON: Optional[str] = None

    # Firebase Service Account Credentials
    FIREBASE_PRIVATE_KEY: str
    FIREBASE_CLIENT_EMAIL: str
    FIREBASE_CLIENT_ID: str
    FIREBASE_CLIENT_CERT_URL: str

    @property
    def firebase_config(self) -> dict:
        """Returns Firebase configuration as a dictionary"""
        return {
            "apiKey": self.FIREBASE_API_KEY,
            "authDomain": self.FIREBASE_AUTH_DOMAIN,
            "databaseURL": self.FIREBASE_DATABASE_URL,
            "projectId": self.FIREBASE_PROJECT_ID,
            "storageBucket": self.FIREBASE_STORAGE_BUCKET,
            "messagingSenderId": self.FIREBASE_MESSAGING_SENDER_ID,
            "appId": self.FIREBASE_APP_ID,
            "measurementId": self.FIREBASE_MEASUREMENT_ID
        }

    class Config:
        case_sensitive = True
        env_file = '.env'
        extra = Extra.ignore

settings = Settings()

