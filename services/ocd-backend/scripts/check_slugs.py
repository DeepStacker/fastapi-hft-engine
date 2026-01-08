
import asyncio
from sqlalchemy import select
from app.config.database import async_session
from core.database.community_models import CommunityRoomDB

async def list_slugs():
    async with async_session() as db:
        result = await db.execute(select(CommunityRoomDB.slug, CommunityRoomDB.name))
        rooms = result.all()
        print("--- DB SLUGS ---")
        for slug, name in rooms:
            print(f"Slug: '{slug}', Name: '{name}'")
        print("----------------")

if __name__ == "__main__":
    asyncio.run(list_slugs())
