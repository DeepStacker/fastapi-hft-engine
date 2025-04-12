from fastapi import WebSocket, WebSocketDisconnect
from typing import Dict, List
import asyncio
import orjson
from redis_cache import redis

class ConnectionManager:
    def __init__(self):
        self.active: Dict[str, List[WebSocket]] = {}

    async def connect(self, inst: str, ws: WebSocket):
        await ws.accept()
        self.active.setdefault(inst, []).append(ws)

    def disconnect(self, inst: str, ws: WebSocket):
        self.active[inst].remove(ws)

    async def broadcast(self, inst: str, msg: dict):
        conns = list(self.active.get(inst, []))
        for ws in conns:
            try:
                await ws.send_json(msg)
            except:
                self.disconnect(inst, ws)

manager = ConnectionManager()

async def redis_subscriber():
    pubsub = redis.pubsub()
    await pubsub.psubscribe("live:*")
    async for msg in pubsub.listen():
        if msg["type"] == "pmessage":
            channel = msg["channel"].decode()
            inst = channel.split("live:")[1]
            data = orjson.loads(msg["data"])
            await manager.broadcast(inst, data)
