"""
Community Module - Database Seeding Script

Run this script to create default community rooms.
Usage: python -m app.scripts.seed_community
"""
import asyncio
import logging
from sqlalchemy import select

from core.database.db import async_session_factory
from core.database.community_models import (
    CommunityRoomDB,
    RoomType,
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Default rooms to create
DEFAULT_ROOMS = [
    {
        "slug": "market-outlook",
        "name": "Market Outlook",
        "description": "Official market insights from analysts. Daily/weekly market outlook, OI interpretation, volatility analysis.",
        "room_type": RoomType.MARKET_OUTLOOK,
        "is_read_only": True,
        "min_reputation_to_post": 0,
        "post_cooldown_seconds": 0,
        "allowed_roles": ["admin", "analyst"],
    },
    {
        "slug": "signal-discussion",
        "name": "Signal Discussion",
        "description": "Discuss live signals and their outcomes. Auto-created threads for each signal.",
        "room_type": RoomType.SIGNAL_DISCUSSION,
        "is_read_only": False,
        "min_reputation_to_post": 0,
        "post_cooldown_seconds": 60,
        "allowed_roles": ["user", "verified_trader", "analyst", "admin"],
    },
    {
        "slug": "trade-breakdown",
        "name": "Trade Breakdown & Learning",
        "description": "Share completed trades with structured analysis. No live trade calls allowed.",
        "room_type": RoomType.TRADE_BREAKDOWN,
        "is_read_only": False,
        "min_reputation_to_post": 10,
        "post_cooldown_seconds": 120,
        "allowed_roles": ["user", "verified_trader", "analyst", "admin"],
    },
    {
        "slug": "strategy-insights",
        "name": "Strategy & Option Chain Insights",
        "description": "Analysis-only discussion. OI behavior, Greeks shifts, volatility regimes, structure changes.",
        "room_type": RoomType.STRATEGY_INSIGHTS,
        "is_read_only": False,
        "min_reputation_to_post": 5,
        "post_cooldown_seconds": 90,
        "allowed_roles": ["user", "verified_trader", "analyst", "admin"],
    },
    {
        "slug": "feedback",
        "name": "Platform Feedback & Feature Requests",
        "description": "Bug reports, feature suggestions, and platform improvements.",
        "room_type": RoomType.FEEDBACK,
        "is_read_only": False,
        "min_reputation_to_post": 0,
        "post_cooldown_seconds": 300,
        "allowed_roles": ["user", "verified_trader", "analyst", "admin"],
    },
]


async def seed_community_rooms():
    """Seed default community rooms."""
    async with async_session_factory() as session:
        try:
            for room_data in DEFAULT_ROOMS:
                # Check if room already exists
                result = await session.execute(
                    select(CommunityRoomDB).where(CommunityRoomDB.slug == room_data["slug"])
                )
                existing = result.scalar_one_or_none()
                
                if existing:
                    logger.info(f"Room '{room_data['slug']}' already exists, skipping...")
                    continue
                
                # Create room
                room = CommunityRoomDB(**room_data)
                session.add(room)
                logger.info(f"Created room: {room_data['name']} ({room_data['slug']})")
            
            await session.commit()
            logger.info("Community rooms seeding completed!")
            
        except Exception as e:
            await session.rollback()
            logger.error(f"Failed to seed community rooms: {e}")
            raise


async def main():
    """Main entry point."""
    logger.info("Starting community rooms seeding...")
    await seed_community_rooms()


if __name__ == "__main__":
    asyncio.run(main())
