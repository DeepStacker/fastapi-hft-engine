import asyncio
import logging
from sqlalchemy import select
from core.database.db import async_session_factory
from services.api_gateway.models import APITier, DEFAULT_TIERS

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("seed_tiers")

async def seed_tiers():
    """Seed database with default API tiers"""
    logger.info("Seeding API tiers...")
    
    async with async_session_factory() as session:
        for tier_data in DEFAULT_TIERS:
            # Check if tier exists
            stmt = select(APITier).where(APITier.tier_name == tier_data['tier_name'])
            result = await session.execute(stmt)
            existing_tier = result.scalar_one_or_none()
            
            if existing_tier:
                logger.info(f"Tier '{tier_data['tier_name']}' already exists. Skipping.")
                continue
            
            # Create new tier
            new_tier = APITier(**tier_data)
            session.add(new_tier)
            logger.info(f"Added tier '{tier_data['tier_name']}'")
        
        await session.commit()
        logger.info("API tiers seeding complete!")

if __name__ == "__main__":
    asyncio.run(seed_tiers())
