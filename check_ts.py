
from datetime import datetime
import pytz

try:
    ts = 1767767400
    tz = pytz.timezone('Asia/Kolkata')
    dt = datetime.fromtimestamp(ts, tz)
    print(f"Timestamp: {ts}")
    print(f"DateTime (IST): {dt}")
    print(f"Date String: {dt.strftime('%Y-%m-%d')}")
    
    ts_later = 1768372200
    dt_later = datetime.fromtimestamp(ts_later, tz)
    print(f"Timestamp: {ts_later}")
    print(f"DateTime (IST): {dt_later}")
    print(f"Date String: {dt_later.strftime('%Y-%m-%d')}")
except Exception as e:
    print(f"Error: {e}")
