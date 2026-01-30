
import asyncio
import os
import sys
import json
import time
import random
from datetime import datetime
import pytz
from typing import Dict, Any

# Ensure project root is in python path
sys.path.append(os.getcwd())

from aiokafka import AIOKafkaProducer, AIOKafkaConsumer
from redis.asyncio import Redis, from_url

# Import project utilities
from core.serialization.avro_serializer import avro_serializer, avro_deserializer
from core.config.settings import get_settings
from core.logging.logger import configure_logger, get_logger

# Configure logging
configure_logger()
logger = get_logger("benchmark")
settings = get_settings()

# Benchmark Config
PROBE_SYMBOL = "BENCHMARK_PROBE"
PROBE_SYMBOL_ID = 999999
NUM_PROBES = 10
INTERVAL_SEC = 2.0

async def listen_kafka_enriched(stop_event: asyncio.Event, results: Dict[str, Any]):
    """Listen to market.enriched topic for probe messages"""
    logger.info(f"Starting Kafka Consumer on {settings.KAFKA_TOPIC_ENRICHED}...")
    
    # Custom deserializer that handles errors gracefully
    deserializer_func = avro_deserializer(settings.KAFKA_TOPIC_ENRICHED)
    
    consumer = AIOKafkaConsumer(
        settings.KAFKA_TOPIC_ENRICHED,
        bootstrap_servers=settings.KAFKA_BOOTSTRAP_SERVERS.split(","),
        group_id=f"benchmark-group-{random.randint(1000, 9999)}",
        auto_offset_reset='latest',
        value_deserializer=deserializer_func
    )
    
    await consumer.start()
    try:
        async for msg in consumer:
            if stop_event.is_set():
                break
                
            data = msg.value
            if not data:
                continue
                
            # Check if this is our probe
            if data.get('symbol') == PROBE_SYMBOL:
                probe_id = data.get('context', {}).get('probe_id')
                if probe_id:
                    arrival_time = time.time()
                    
                    if probe_id not in results:
                        results[probe_id] = {}
                        
                    results[probe_id]['kafka_enriched_arrival'] = arrival_time
                    logger.info(f"[Kafka] Probe {probe_id} arrived at {arrival_time:.4f}")
                    
    except Exception as e:
        logger.error(f"Kafka consumer error: {e}")
    finally:
        await consumer.stop()

async def listen_redis_pubsub(stop_event: asyncio.Event, results: Dict[str, Any]):
    """Listen to Redis channel for probe messages"""
    redis_url = settings.REDIS_URL
    logger.info(f"Starting Redis Subscriber on {redis_url}...")
    
    redis = await from_url(redis_url, decode_responses=True)
    pubsub = redis.pubsub()
    
    # Subscribe to channel pattern
    channel = f"live:option_chain:{PROBE_SYMBOL_ID}"
    await pubsub.subscribe(channel)
    logger.info(f"Subscribed to Redis channel: {channel}")
    
    try:
        while not stop_event.is_set():
            message = await pubsub.get_message(ignore_subscribe_messages=True, timeout=1.0)
            
            if message:
                if message['type'] == 'message':
                    data_str = message['data']
                    try:
                        data = json.loads(data_str)
                        
                        if data.get('symbol') == PROBE_SYMBOL:
                            probe_id = data.get('context', {}).get('probe_id')
                            
                            if probe_id:
                                arrival_time = time.time()
                                if probe_id not in results:
                                    results[probe_id] = {}
                                    
                                results[probe_id]['redis_arrival'] = arrival_time
                                logger.info(f"[Redis] Probe {probe_id} arrived at {arrival_time:.4f}")
                                
                    except json.JSONDecodeError:
                        pass
            
            # Small sleep to prevent tight loop if timeout behavior varies
            await asyncio.sleep(0.01)
            
    except Exception as e:
        logger.error(f"Redis listener error: {e}")
    finally:
        await redis.close()

async def run_benchmark():
    """Run End-to-End Latency Benchmark"""
    logger.info("Initializing Benchmark...")
    
    # Initialize Producer
    producer = AIOKafkaProducer(
        bootstrap_servers=settings.KAFKA_BOOTSTRAP_SERVERS.split(","),
        value_serializer=avro_serializer(settings.KAFKA_TOPIC_MARKET_RAW)
    )
    await producer.start()
    logger.info("Kafka Producer started")
    
    stop_event = asyncio.Event()
    results = {}
    
    # Start Listeners
    listeners = [
        asyncio.create_task(listen_kafka_enriched(stop_event, results)),
        asyncio.create_task(listen_redis_pubsub(stop_event, results))
    ]
    
    # Give listeners time to connect
    await asyncio.sleep(2)
    
    logger.info(f"Starting Probes (Count: {NUM_PROBES}, Interval: {INTERVAL_SEC}s)")
    
    for i in range(NUM_PROBES):
        probe_id = f"probe_{i}_{int(time.time())}"
        send_time = time.time()
        
        results[probe_id] = {
            'send_time': send_time
        }
        
        # Construct Dummy Message fitting schema
        # Enforce valid option data so Processor doesn't drop it
        strike_price = "10000.0"
        option_data = {
            "ce": {
                "ltp": 150.0,
                "bid": 149.0,
                "ask": 151.0,
                "vol": 5000,
                "OI": 2000,
                "iv": 15.5
            },
            "pe": {
                "ltp": 80.0,
                "bid": 79.0,
                "ask": 81.0,
                "vol": 4000,
                "OI": 3000,
                "iv": 16.2
            }
        }
        
        # Serialize inner dicts to JSON strings as per ingestion service pattern
        # because Avro schema uses map<string> for option_chain values
        option_chain_serialized = {
            strike_price: json.dumps(option_data)
        }

        message = {
            "symbol": PROBE_SYMBOL,
            "symbol_id": PROBE_SYMBOL_ID,
            "segment_id": 0,
            "expiry": datetime.now().date().isoformat(),
            "timestamp": datetime.now(pytz.timezone('Asia/Kolkata')).isoformat(),
            "option_chain": option_chain_serialized,
            "futures_list": {},
            "global_context": {
                "spot_ltp": 10000.0,
                "spot_volume": 100000,
                "spot_change": 10.0,
                "spot_pct_change": 0.1,
                "atm_iv": 12.5,
                "atm_iv_pct_change": 0.0,
                "total_call_oi": 50000,
                "total_put_oi": 60000,
                "pcr_ratio": 1.2,
                "option_lot_size": 50,
                "days_to_expiry": 5,
                "max_pain_strike": 10000.0,
                # Inject ID here
                "probe_id": probe_id 
            }
        }
        
        try:
            # We must adhere to avro schema. If 'probe_id' is not in schema, this might fail or be ignored.
            # If schema is strict, we might need to rely on 'raw_data' or 'global_context' having flexible fields.
            # Checking ingestion service: global_context seems to map to fixed Avro fields.
            # BUT: Processor keeps 'context' as is. If Avro schema has 'map<string>' or 'raw_data', we are good.
            # Let's assume 'global_context' maps to a record. We might need to trick it.
            # Actually, `market_data_raw.avsc` likely defines specific fields. 
            # If so, we might need to piggyback on an existing string field if we can't add new ones.
            # Let's try to put probe_id in `timestamp` or `expiry` if needed, but `context` usually flows through.
            # Let's hope global_context is flexible or we can attach headers.
            # Wait! Kafka headers are separate. Trace context uses headers. 
            # Benchmarking via Headers is CLEANER.
            
            # Using Headers for Probe ID
            headers = [
                ("benchmark_probe_id", probe_id.encode('utf-8')),
                ("benchmark_send_time", str(send_time).encode('utf-8'))
            ]
            
            await producer.send_and_wait(
                settings.KAFKA_TOPIC_MARKET_RAW,
                value=message,
                key=str(PROBE_SYMBOL_ID).encode('utf-8'),
                headers=headers
            )
            logger.info(f"Sent Probe {probe_id}")
            
        except Exception as e:
            logger.error(f"Failed to send probe: {e}")
        
        await asyncio.sleep(INTERVAL_SEC)

    logger.info("Probes finished. Waiting for trailing messages...")
    await asyncio.sleep(5)
    
    stop_event.set()
    await asyncio.gather(*listeners)
    await producer.stop()
    
    # Calculate Stats
    print("\n" + "="*50)
    print(f"BENCHMARK RESULTS ({NUM_PROBES} probes)")
    print("="*50)
    
    latencies_processor = []
    latencies_e2e = []
    
    for pid, times in results.items():
        start = times.get('send_time')
        kafka_in = times.get('kafka_enriched_arrival')
        redis_in = times.get('redis_arrival')
        
        if start and kafka_in:
            lat = (kafka_in - start) * 1000
            latencies_processor.append(lat)
            print(f"Probe {pid}: Processor Latency = {lat:.2f}ms")
            
        if start and redis_in:
            lat = (redis_in - start) * 1000
            latencies_e2e.append(lat)
            print(f"Probe {pid}: E2E Latency       = {lat:.2f}ms")

    if latencies_processor:
        avg_proc = sum(latencies_processor) / len(latencies_processor)
        print(f"\nAvg Processor Latency: {avg_proc:.2f}ms")
        
    if latencies_e2e:
        avg_e2e = sum(latencies_e2e) / len(latencies_e2e)
        print(f"Avg E2E Latency:       {avg_e2e:.2f}ms")
    else:
        print("\nNo E2E Latency data captured (Realtime service might not be running or failed to forward probe)")

if __name__ == "__main__":
    try:
        asyncio.run(run_benchmark())
    except KeyboardInterrupt:
        pass
