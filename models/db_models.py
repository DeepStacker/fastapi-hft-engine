from sqlalchemy import Column, Integer, String, Boolean, JSON, ForeignKey

# Import Base from your database setup file
from core.database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    # Add lengths to String columns for MySQL compatibility
    username = Column(String(100), unique=True, index=True, nullable=False) # Example length 100
    email = Column(String(255), unique=True, index=True, nullable=False) # Example length 255
    phone_no = Column(String(30), unique=True, index=True, nullable=True) # Example length 30
    full_name = Column(String(255), nullable=True) # Example length 255
    hashed_password = Column(String(255), nullable=False) # Length depends on hashing algorithm output, 255 is usually safe for bcrypt
    disabled = Column(Boolean, default=False)

    # Store preferences as JSON - This is the intended approach now
    preferences = Column(JSON, nullable=False, default={"default_strike_count": 20})

    # Remove any relationship definition for preferences if it exists
    # preferences = relationship("UserPreference", back_populates="owner", uselist=False, cascade="all, delete-orphan") # REMOVE THIS LINE if present

