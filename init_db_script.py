import asyncio
import logging
from db import init_db

logging.basicConfig(level=logging.INFO)

async def main():
    await init_db()

if __name__ == "__main__":
    asyncio.run(main())