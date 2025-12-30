# Cross-Service Contracts

## Kafka Message Schemas

### Topic: `market.raw`
Raw market data from Dhan API.

```json
{
  "symbol_id": 13,
  "symbol": "NIFTY",
  "expiry": "2024-01-25",
  "timestamp": "2024-01-15T10:30:00+05:30",
  "spot": {
    "ltp": 21500.50,
    "change": 150.25,
    "change_pct": 0.70
  },
  "options": [
    {
      "strike": 21500,
      "option_type": "CE",
      "ltp": 125.50,
      "oi": 1500000,
      "volume": 250000,
      "bid": 124.50,
      "ask": 126.00
    }
  ]
}
```

### Topic: `market.enriched`
Enriched data with Greeks and analytics.

```json
{
  "symbol_id": 13,
  "timestamp": "2024-01-15T10:30:00+05:30",
  "context": {
    "spot_price": 21500.50,
    "atm_strike": 21500,
    "total_call_oi": 15000000,
    "total_put_oi": 12000000,
    "pcr_ratio": 0.80
  },
  "options": [
    {
      "strike": 21500,
      "option_type": "CE",
      "ltp": 125.50,
      "oi": 1500000,
      "volume": 250000,
      "delta": 0.52,
      "gamma": 0.0015,
      "theta": -12.5,
      "vega": 18.2,
      "iv": 15.5,
      "buildup_type": "long_buildup"
    }
  ],
  "analyses": {
    "pcr": {"oi": 0.80, "volume": 0.75},
    "gex": {"net_gamma": 1500000},
    "max_pain": 21500
  }
}
```

---

## Redis Key Patterns

| Pattern | Type | TTL | Description |
|---------|------|-----|-------------|
| `latest:{symbol_id}` | Hash | 60s | Latest market snapshot |
| `oc:{symbol}:{expiry}` | Hash | 5s | Live option chain |
| `user:{firebase_uid}` | Hash | 24h | User session/cache |
| `config:{key}` | String | 1h | Dynamic config values |
| `historical:snapshot:{symbol}:{date}:{time}` | JSON | 30d | Historical snapshots |
| `historical:dates:{symbol}` | List | 30d | Available dates |
| `rate_limit:{ip}:{endpoint}` | String | 60s | Rate limiting counter |

---

## WebSocket Events

### Client → Server
```json
{"action": "subscribe", "symbol": "NIFTY", "expiry": "2024-01-25"}
{"action": "unsubscribe", "symbol": "NIFTY"}
```

### Server → Client
```json
{"type": "data", "symbol": "NIFTY", "data": {...}}
{"type": "error", "message": "Rate limit exceeded"}
{"type": "heartbeat", "timestamp": 1705312200}
```
