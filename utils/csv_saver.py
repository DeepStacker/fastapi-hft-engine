import asyncio
import pandas as pd
import logging
from pathlib import Path
from typing import List, Dict, Any

logger = logging.getLogger(__name__)

# Define output directory relative to this file's location
# Adjust if OUTPUT_DIR needs to be configured globally
OUTPUT_DIR = Path(__file__).parent.parent / "output"
OUTPUT_DIR.mkdir(exist_ok=True) # Ensure directory exists

async def save_to_csv(data: List[Dict[str, Any]], symbol_sid: int, data_type: str):
    """Save data to CSV file asynchronously"""
    if not data:
        logger.warning(f"No data provided to save for {symbol_sid}_{data_type}")
        return
    try:
        df = pd.DataFrame(data)
        filename = f"{symbol_sid}_{data_type}_data.csv"
        filepath = OUTPUT_DIR / filename
        # Use asyncio.to_thread for blocking I/O
        await asyncio.to_thread(df.to_csv, filepath, index=False)
        logger.info(f"Data saved to {filepath}")
    except Exception as e:
        logger.error(f"Error saving CSV to {filepath}: {e}", exc_info=True)

