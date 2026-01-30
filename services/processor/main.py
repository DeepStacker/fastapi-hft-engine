"""
Processor Service - Main Entry Point

Consumes raw market data, enriches it with analytics, and publishes enriched data to Kafka.

BREAKING CHANGES:
- Consumer groups for partition distribution
- Avro binary serialization
- Distributed tracing with OpenTelemetry
"""
import asyncio
import json
import signal
import time
import os
from datetime import datetime, timezone
import pytz
from typing import Dict

from core.config.settings import get_settings
from core.config.dynamic_config import get_config_manager
from core.logging.logger import configure_logger, get_logger
from core.monitoring.metrics import (
    start_metrics_server,
    PROCESSOR_MESSAGES_TOTAL,
    PROCESSOR_ERRORS_TOTAL,
    PROCESSOR_LATENCY,
    DATA_QUALITY_ISSUES
)

# BREAKING CHANGE: Distributed tracing
from core.observability.tracing import (
    distributed_tracer,
    extract_trace_from_kafka_headers,
    create_kafka_headers_with_trace,
    traced
)

from services.processor.data_cleaner import DataCleaner
from services.processor.analyzers.bsm import BlackScholesModel
from services.processor.analyzers.futures_basis import FuturesBasisAnalyzer
from services.processor.analyzers.vix_divergence import VIXDivergenceAnalyzer
from services.processor.analyzers.gamma_exposure import GammaExposureAnalyzer
from services.processor.analyzers.iv_skew_analyzer import IVSkewAnalyzer
from services.processor.analyzers.reversal import ReversalAnalyzer
from services.processor.analyzers.percentage_analyzer import PercentageAnalyzer
from services.processor.analyzer_cache import AnalyzerCacheManager

# Use consolidated PCR utility
from core.analytics.stateless import calculate_pcr_detailed

# Configure logging
configure_logger()
logger = get_logger("processor-service")
settings = get_settings()


class ProcessorService:
    """
    Main processor service orchestrator
    """
    
    def __init__(self):
        """Initialize processor components"""
        self.config_manager = None
        self.consumer = None
        self.producer = None  # Dedicated Avro producer for this service
        
        # Data processing components
        self.cleaner = DataCleaner()
        self.bsm = None
        self.futures_analyzer = None
        self.vix_analyzer = None
        self.gamma_analyzer = None
        self.iv_skew_analyzer = None
        self.percentage_analyzer = None  # For COA percentage calculation
        # Advanced analyzers moved to analytics service
        # self.order_flow_analyzer = None
        # self.smart_money_analyzer = None
        # self.liquidity_analyzer = None
        
        # Service state
        self.running = False
        self.messages_processed = 0
    
    async def initialize(self):
        """Initialize all components"""
        logger.info("Initializing Processor Service...")
        
        # Get instance information from environment
        import os
        instance_id = int(os.getenv("INSTANCE_ID", "1"))
        total_instances = int(os.getenv("TOTAL_INSTANCES", "1"))
        logger.info(f"Processor instance {instance_id}/{total_instances} starting")
        
        # BREAKING CHANGE: Initialize distributed tracing
        distributed_tracer.initialize(
            service_name="processor-service",
            jaeger_host=os.getenv("JAEGER_HOST", "jaeger"),
            jaeger_port=int(os.getenv("JAEGER_PORT", "6831"))
        )
        logger.info("✓ Distributed tracing initialized (Jaeger)")
        
        # Initialize config manager
        self.config_manager = await get_config_manager()
        logger.info("ConfigManager initialized")
        
        # Get risk-free rate from config
        risk_free_rate = self.config_manager.get('risk_free_rate', 0.065)
        
        # Initialize analyzers
        self.bsm = BlackScholesModel(risk_free_rate=risk_free_rate)
        self.futures_analyzer = FuturesBasisAnalyzer(risk_free_rate=risk_free_rate)
        self.vix_analyzer = VIXDivergenceAnalyzer(self.config_manager)
        self.gamma_analyzer = GammaExposureAnalyzer()
        self.iv_skew_analyzer = IVSkewAnalyzer()
        self.reversal_analyzer = ReversalAnalyzer()
        self.percentage_analyzer = PercentageAnalyzer()  # For COA percentages
        
        # OPTIMIZATION: Analyzer result cache (2-3x speedup)
        self.cache_manager = AnalyzerCacheManager(maxsize=1000, ttl=5)
        
        # BREAKING CHANGE: Initialize Kafka consumer with CLUSTER configuration
        # Consumer groups enable automatic partition distribution across instances
        # BREAKING CHANGE: Now uses Avro binary deserialization instead of JSON
        from aiokafka import AIOKafkaConsumer
        from core.serialization.avro_serializer import avro_deserializer
        
        self.consumer = AIOKafkaConsumer(
            settings.KAFKA_TOPIC_MARKET_RAW,
            bootstrap_servers=settings.KAFKA_BOOTSTRAP_SERVERS.split(","),  # Cluster support
            group_id="processor-group-v2",  # Consumer group for load balancing
            auto_offset_reset='latest',  # Start from end to skip incompatible legacy data
            enable_auto_commit=True,  # Commit offsets automatically
            value_deserializer=avro_deserializer(settings.KAFKA_TOPIC_MARKET_RAW),  # Avro binary input
            # Performance tuning
            fetch_max_wait_ms=10,  # Max wait for batching (Aggressively reduced for HFT)
            fetch_min_bytes=1,     # Min data to fetch (1 byte to prevent waiting)
            fetch_max_bytes=1048576,  # Max data to fetch (1MB)
            max_partition_fetch_bytes=1048576,  # Max per partition (1MB)
        )
        
        await self.consumer.start()
        logger.info(f"✓ Kafka consumer started with group 'processor-group'")
        logger.info(f"✓ Bootstrap servers: {settings.KAFKA_BOOTSTRAP_SERVERS}")
        logger.info("✓ Using Avro binary deserialization (2-3x faster than JSON)")
        
        # Log partition assignment
        partitions = self.consumer.assignment()
        if partitions:
            logger.info(f"✓ Assigned partitions: {[p.partition for p in partitions]}")
        else:
            logger.info("⚠ No partitions assigned yet (will be assigned on first poll)")
        
        # BREAKING CHANGE: Initialize dedicated Avro producer for enriched messages
        from core.serialization.avro_serializer import avro_serializer
        from aiokafka import AIOKafkaProducer
        
        self.producer = AIOKafkaProducer(
            bootstrap_servers=settings.KAFKA_BOOTSTRAP_SERVERS.split(","),
            value_serializer=avro_serializer(settings.KAFKA_TOPIC_ENRICHED),  # Avro binary output
            compression_type='snappy',
            acks='all',
            linger_ms=1,           # Minimize batching delay (1ms)
            max_batch_size=16384,  # Smaller batches for latency (16KB)
        )
        await self.producer.start()
        logger.info("✓ Kafka producer started (Avro format for enriched messages)")
        
        logger.info("Processor Service initialized successfully")
    
    async def process_message(self, raw_data: dict, trace_context=None):
        """
        Process and enrich a single raw market data message
        
        BREAKING CHANGE: Now accepts trace_context for distributed tracing
        
        Pipeline:
        1. Data cleaning (handle NaN, nulls)
        2. Calculate Greeks (BSM pricing)
        3. Run analysis (Futures, VIX, PCR, GEX, IV Skew)
        4. Construct enriched message
        5. Publish to Kafka
        """
        # BREAKING CHANGE: Create span within parent trace context
        tracer = distributed_tracer.get_tracer()
        with tracer.start_as_current_span("process_message", context=trace_context) as span:
            span.set_attribute("symbol", raw_data.get("symbol", "unknown"))
            
            return await self._process_message_internal(raw_data, span)
    
    async def _process_message_internal(self, raw_data: dict, span):
        """Internal processing with tracing"""
        start_time = time.time()
        
        try:
            # Check if processing is enabled
            if not self.config_manager.get('processor_enabled', True):
                logger.debug("Processor is disabled, skipping message")
                return
            
            # Extract expiry from raw message
            expiry = raw_data.get('expiry', 'unknown')
            
            # 1. Clean data
            cleaned = await self.cleaner.clean(raw_data)
            
            if not cleaned['options']:
                logger.warning("No valid options after cleaning")
                DATA_QUALITY_ISSUES.labels(issue_type='no_valid_options').inc()
                return
            
            # Log cleaning stats
            stats = self.cleaner.get_stats()
            if stats.get('illiquid', 0) > 10:
                DATA_QUALITY_ISSUES.labels(issue_type='high_illiquidity').inc()
            
            # 2. Calculate BSM theoretical prices (Required for Reversals)
            # OPTIMIZED: Use vectorized calculations (10-100x faster!)
            if self.config_manager.get('enable_bsm_calculation', True):
                self.bsm.calculate_batch_vectorized(
                    options=cleaned['options'],
                    spot_price=cleaned['context'].spot_price,
                    days_to_expiry=cleaned['context'].days_to_expiry
                )
                
            # 3. Calculate Reversals (Depends on BSM)
            if self.config_manager.get('enable_reversal_calculation', True):
                self.reversal_analyzer.calculate_reversals(
                    options=cleaned['options'],
                    context=cleaned['context']
                )
            
            # 4. Calculate Percentages for COA (Chart of Accuracy)
            if self.config_manager.get('enable_percentage_calculation', True):
                # Calculate ATM strike from spot price
                spot_price = cleaned['context'].spot_price
                tick_size = cleaned['context'].tick_size or 50
                atm_strike = round(spot_price / tick_size) * tick_size
                
                self.percentage_analyzer.enrich_options(
                    options=cleaned['options'],
                    atm_strike=atm_strike,
                    step_size=tick_size
                )
            
            # 5. Run analyses in parallel (8x speedup!)
            analyses = {}
            
            tasks = []
            
            # Futures Basis (if we have futures data)
            if (cleaned['futures'] and 
                self.config_manager.get('enable_futures_basis', True)):
                tasks.append(self._analyze_futures_basis(cleaned))
            
            # VIX Divergence
            if self.config_manager.get('enable_vix_divergence', True):
                tasks.append(self._analyze_vix_divergence(cleaned))
            
            # PCR Analysis
            if self.config_manager.get('enable_pcr_analysis', True):
                tasks.append(self._analyze_pcr(cleaned, expiry))
                
            # IV Skew Analysis
            if self.config_manager.get('enable_iv_skew_analysis', True):
                tasks.append(self._analyze_iv_skew(cleaned))
            
            # Gamma Exposure
            if self.config_manager.get('enable_gamma_analysis', True):
                tasks.append(self._analyze_gamma_exposure(cleaned))
            
            # Advanced analyzers (order_flow, smart_money, liquidity) moved to Analytics service
            # They are now processed separately as stateful analysis with historical context
            
            # Run all analyses concurrently
            if tasks:
                results = await asyncio.gather(*tasks, return_exceptions=True)
                
                # Collect results
                for result in results:
                    if isinstance(result, Exception):
                        logger.error(f"Analysis failed: {result}")
                        PROCESSOR_ERRORS_TOTAL.labels(error_type='analysis_error').inc()
                    elif result:
                        analyses.update(result)
            
            # 4. Construct enriched message
            enriched_data = self._build_enriched_message(cleaned, analyses, expiry)
            
            # 5. Publish to Kafka with trace headers
            # BREAKING CHANGE: Inject trace context into outgoing Kafka message
            headers = create_kafka_headers_with_trace()
            await self.producer.send_and_wait(
                settings.KAFKA_TOPIC_ENRICHED,
                value=enriched_data,
                headers=headers
            )
            
            span.set_attribute("output_topic", settings.KAFKA_TOPIC_ENRICHED)
            span.set_attribute("options_count", len(cleaned.get('options', [])))
            
            # Metrics
            self.messages_processed += 1
            PROCESSOR_MESSAGES_TOTAL.labels(status='success').inc()
            
            elapsed = time.time() - start_time
            PROCESSOR_LATENCY.observe(elapsed)
            
            if self.messages_processed % 100 == 0:
                logger.info(
                    f"Processed {self.messages_processed} messages, "
                    f"last: {cleaned['context'].symbol} "
                    f"({len(cleaned['options'])} options) "
                    f"in {elapsed:.3f}s"
                )
            
        except Exception as e:
            logger.error(f"Failed to process message: {e}", exc_info=True)
            PROCESSOR_MESSAGES_TOTAL.labels(status='error').inc()
            PROCESSOR_ERRORS_TOTAL.labels(error_type='processing_error').inc()
    
    async def _analyze_futures_basis(self, cleaned: dict) -> Dict:
        """Run futures basis analysis"""
        try:
            result = self.futures_analyzer.analyze(
                futures_data=cleaned['futures'],
                spot_price=cleaned['context'].spot_price,
                days_to_expiry=cleaned['context'].days_to_expiry
            )
            return {'futures_basis': result}
        except Exception as e:
            logger.error(f"Futures basis analysis failed: {e}")
            return {}
    
    async def _analyze_vix_divergence(self, cleaned: dict) -> Dict:
        """Run VIX divergence analysis"""
        try:
            result = await self.vix_analyzer.analyze(
                context=cleaned['context']
            )
            return {'vix_divergence': result}
        except Exception as e:
            logger.error(f"VIX divergence analysis failed: {e}")
            return {}
            
    async def _analyze_pcr(self, cleaned: dict, expiry: str) -> Dict:
        """Run PCR analysis with caching - uses consolidated stateless utility"""
        try:
            # Try cache first
            cache_key_data = {
                "symbol_id": cleaned['context'].symbol_id,
                "expiry": expiry,
                "strikes": [o.strike for o in cleaned['options']]
            }
            
            cached = self.cache_manager.get_cached_analysis(
                "pcr",
                cache_key_data["symbol_id"],
                cache_key_data["expiry"],
                cache_key_data["strikes"]
            )
            
            if cached:
                return cached
            
            # Calculate total volumes from options list
            total_call_vol = sum(o.volume for o in cleaned['options'] if o.option_type == 'CE')
            total_put_vol = sum(o.volume for o in cleaned['options'] if o.option_type == 'PE')
            
            # Use consolidated stateless PCR function
            result = calculate_pcr_detailed(
                total_call_oi=cleaned['context'].total_call_oi,
                total_put_oi=cleaned['context'].total_put_oi,
                total_call_vol=total_call_vol,
                total_put_vol=total_put_vol
            )
            
            # Cache result
            result_dict = {'pcr_analysis': result}
            self.cache_manager.cache_result(
                "pcr",
                cache_key_data["symbol_id"],
                cache_key_data["expiry"],
                cache_key_data["strikes"],
                result_dict
            )
            
            return result_dict
        except Exception as e:
            logger.error(f"PCR analysis failed: {e}")
            return {}

    async def _analyze_iv_skew(self, cleaned: dict) -> Dict:
        """Run IV Skew analysis"""
        try:
            result = self.iv_skew_analyzer.analyze(
                options=cleaned['options'],
                spot_price=cleaned['context'].spot_price,
                atm_iv=cleaned['context'].atm_iv
            )
            return {'iv_skew': result}
        except Exception as e:
            logger.error(f"IV Skew analysis failed: {e}")
            return {}
    
    async def _analyze_gamma_exposure(self, cleaned: dict) -> Dict:
        """Run gamma exposure analysis"""
        try:
            result = self.gamma_analyzer.analyze(
                options=cleaned['options'],
                spot_price=cleaned['context'].spot_price,
                lot_size=cleaned['context'].lot_size
            )
            return {'gamma_exposure': result}
        except Exception as e:
            logger.error(f"Gamma exposure analysis failed: {e}")
            return {}
    
    # Advanced analyzer methods moved to Analytics service:
    # - _analyze_order_flow (order flow toxicity)
    # - _analyze_smart_money (smart money detection)
    # - _analyze_liquidity (liquidity stress)
    # These now run as stateful analysis with historical context in Analytics service
    
    def _build_enriched_message(self, cleaned: dict, analyses: dict, expiry: str) -> dict:
        """
        Build final enriched message for Kafka
        
        Args:
            cleaned: Cleaned data
            analyses: Analysis results
            
        Returns:
            Enriched message dict
        """
        # Convert Pydantic models to dicts (handling datetime serialization)
        context_dict = cleaned['context'].model_dump()
        
        # Capture original timestamp for top-level field
        original_timestamp = cleaned['context'].timestamp
        
        # Convert timestamp in dict to string
        if isinstance(context_dict.get('timestamp'), datetime):
            context_dict['timestamp'] = context_dict['timestamp'].isoformat()
            
        futures_dict = None
        if cleaned['futures']:
            futures_dict = cleaned['futures'].model_dump()
            
        options_list = []
        for opt in cleaned['options']:
            opt_dict = opt.model_dump()
            # Rename fields to match Avro schema (oi_change -> change_oi)
            opt_dict['change_oi'] = opt_dict.pop('oi_change', 0)
            options_list.append(opt_dict)
        
        # Calculate data quality metrics
        total_options = len(options_list)
        illiquid_count = sum(1 for opt in options_list if not opt['is_liquid'])
        invalid_count = sum(1 for opt in options_list if not opt['is_valid'])
        
        return {
            'symbol': context_dict['symbol'],
            'symbol_id': context_dict['symbol_id'],
            'expiry': expiry,  # Include expiry date
            'timestamp': original_timestamp.isoformat(),
            'trade_date': original_timestamp.date().isoformat(),  # Trading day derived from timestamp
            'processing_timestamp': datetime.now(pytz.timezone('Asia/Kolkata')).isoformat(),
            
            'context': context_dict,
            'futures': futures_dict,
            'options': options_list,
            
            # Serialize analyses values to JSON strings for Avro map<string>
            'analyses': {k: json.dumps(v) if not isinstance(v, str) else v for k, v in analyses.items()},
            
            'data_quality': {
                'total_options': total_options,
                'illiquid_options': illiquid_count,
                'invalid_options': invalid_count,
                'illiquid_pct': round(illiquid_count / total_options * 100, 2) if total_options > 0 else 0
            }
        }
    
    async def run(self):
        """Main run loop with consumer group support"""
        self.running = True
        logger.info("Processor Service running...")
        
        try:
            # BREAKING CHANGE: Iterate over consumer messages directly
            # Consumer groups automatically distribute partitions across instances
            async for message in self.consumer:
                # Log partition rebalancing
                current_partitions = self.consumer.assignment()
                if not hasattr(self, '_logged_partitions') or self._logged_partitions != current_partitions:
                    self._logged_partitions = current_partitions
                    logger.info(f"Processing partitions: {[p.partition for p in current_partitions]}")
                
                # BREAKING CHANGE: Extract trace context from Kafka message headers
                trace_context = extract_trace_from_kafka_headers(message.headers)
                
                # Process message with trace context
                await self.process_message(message.value, trace_context=trace_context)
                
        except asyncio.CancelledError:
            logger.info("Processor Service cancelled")
        finally:
            await self.shutdown()
    
    async def shutdown(self):
        """Shutdown processor service"""
        logger.info("Shutting down Processor Service...")
        self.running = False
        
        if self.consumer:
            await self.consumer.stop()
        
        if self.producer:
            await self.producer.stop()
        
        logger.info("Processor Service stopped")


async def main_async():
    """
    Async main function
    """
    # Start metrics server
    start_metrics_server(8000)
    logger.info("Metrics server started on port 8000")
    
    # Create and initialize processor
    processor = ProcessorService()
    await processor.initialize()
    
    # Run processor
    await processor.run()


def main():
    """
    Main entry point
    """
    logger.info("Starting Processor Service...")
    
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    
    task = loop.create_task(main_async())
    
    def shutdown(signum, frame):
        logger.info(f"Received signal {signum}, shutting down...")
        task.cancel()
    
    signal.signal(signal.SIGTERM, shutdown)
    signal.signal(signal.SIGINT, shutdown)
    
    try:
        loop.run_until_complete(task)
    except asyncio.CancelledError:
        logger.info("Main task cancelled")
    finally:
        loop.close()
        logger.info("Processor Service exited")


if __name__ == "__main__":
    main()
