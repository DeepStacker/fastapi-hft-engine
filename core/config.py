import os
from dotenv import load_dotenv
from pydantic_settings import BaseSettings
from pydantic import Extra # Import Extra

load_dotenv()

class Settings(BaseSettings):
    # --- Core Settings ---
    PROJECT_NAME: str = "Stockify RestAPI"
    API_V1_STR: str = "/api/v1" # Example API prefix

    # --- Database ---
    # Update DATABASE_URL for MySQL using aiomysql driver
    # Format: mysql+aiomysql://<user>:<password>@<host>[:<port>]/<database>
    # Replace 'your_database_name' with the actual name of the database you want to use.
    DATABASE_URL: str = os.getenv("DATABASE_URL", "mysql+aiomysql://root:Shivam%40977140@localhost:3306/test_db") # Ensure password characters are URL-encoded if necessary (@ becomes %40)

    # --- Security ---
    SECRET_KEY: str = os.getenv("SECRET_KEY", "a_very_insecure_default_secret_key_replace_me")
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30

    class Config:
        case_sensitive = True
        env_file = '.env'
        extra = Extra.ignore # Add this line to ignore extra environment variables

settings = Settings()

