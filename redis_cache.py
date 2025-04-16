import orjson
import redis.asyncio as aioredis
from config import REDIS_URLS, FETCH_INTERVAL, REDIS_FETCH_INTERVAL

redis = aioredis.from_url(REDIS_URLS, decode_responses=False)

async def cache_latest(inst: str, payload: dict):
    """Cache latest snapshot JSON (TTL slightly > interval)."""
    await redis.set(f"latest:{inst}", orjson.dumps(payload), ex=int(REDIS_FETCH_INTERVAL**2))

async def publish_live(inst: str, payload: dict):
    """Publish to Redis Pub/Sub channel."""
    await redis.publish(f"live:{inst}", orjson.dumps(payload))

async def get_latest(inst: str):
    raw = await redis.get(f"latest:{inst}")
    return orjson.loads(raw) if raw else None
