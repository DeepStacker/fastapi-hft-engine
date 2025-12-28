# Stockify Trading Platform - FastAPI Backend

A professional real-time options trading analysis platform built with FastAPI, PostgreSQL, and Redis.

## 🚀 Features

- **Real-time Options Data**: Live streaming via WebSocket with msgpack encoding
- **Advanced Greeks Calculation**: All standard + advanced Greeks (Vanna, Vomma, Charm, Speed, Zomma, Color, Ultima)
- **Reversal Detection**: AI-powered reversal point prediction with confidence scores
- **Admin Configuration**: Dynamic system configuration from UI
- **Firebase Authentication**: Secure user authentication with role-based access
- **Redis Caching**: High-performance caching layer
- **PostgreSQL Database**: Robust async database with connection pooling

## 📁 Project Structure

```
Backend/
├── app/
│   ├── api/
│   │   ├── v1/                  # REST API endpoints
│   │   │   ├── auth.py          # Authentication endpoints
│   │   │   ├── users.py         # User management (admin)
│   │   │   ├── options.py       # Options data endpoints
│   │   │   ├── admin.py         # Admin configuration
│   │   │   └── health.py        # Health check
│   │   └── websocket/           # WebSocket handling
│   │       ├── manager.py       # Connection manager
│   │       └── handlers.py      # Stream handlers
│   ├── cache/
│   │   └── redis.py             # Redis caching layer
│   ├── config/
│   │   ├── settings.py          # Pydantic settings
│   │   └── database.py          # Async SQLAlchemy setup
│   ├── core/
│   │   ├── dependencies.py      # FastAPI dependencies
│   │   ├── exceptions.py        # Custom exceptions
│   │   ├── middleware.py        # Request middleware
│   │   └── security.py          # Firebase auth
│   ├── models/
│   │   ├── user.py              # User model
│   │   └── config.py            # SystemConfig, TradingInstrument
│   ├── repositories/            # Data access layer
│   ├── schemas/                 # Pydantic schemas
│   ├── services/                # Business logic
│   │   ├── bsm.py               # Black-Scholes Model
│   │   ├── greeks.py            # Greeks calculations
│   │   ├── reversal.py          # Reversal detection
│   │   ├── dhan_client.py       # Dhan API client
│   │   └── options.py           # Options service
│   ├── utils/                   # Utilities
│   └── main.py                  # Application entry point
├── alembic/                     # Database migrations
├── docker-compose.yml           # PostgreSQL + Redis
├── requirements.txt             # Python dependencies
└── .env.example                 # Environment template
```

## 🛠️ Quick Start

### 1. Prerequisites

- Python 3.11+
- PostgreSQL 16+
- Redis 7+
- Firebase project (for authentication)

### 2. Setup

```bash
# Clone and navigate to Backend
cd Backend

# Create virtual environment
python -m venv venv
venv\Scripts\activate  # Windows
# source venv/bin/activate  # Linux/Mac

# Install dependencies
pip install -r requirements.txt

# Copy environment file
copy .env.example .env
# Update .env with your configuration
```

### 3. Start Services (Docker)

```bash
# Start PostgreSQL and Redis
docker-compose up -d
```

### 4. Initialize Database

```bash
# Create initial migration
alembic revision --autogenerate -m "Initial migration"

# Apply migrations
alembic upgrade head
```

### 5. Run Application

```bash
# Development mode with auto-reload
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# Or use the run script
run.bat
```

### 6. Access API

- **API Docs**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc
- **Health Check**: http://localhost:8000/health

## 📡 API Endpoints

### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/auth/verify` | Verify Firebase token |
| GET | `/api/v1/auth/profile` | Get user profile |
| PUT | `/api/v1/auth/profile` | Update profile |
| POST | `/api/v1/auth/logout` | Logout user |

### Options Data
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/options/expiry/{symbol}` | Get expiry dates |
| GET | `/api/v1/options/chain/{symbol}/{expiry}` | Get option chain |
| GET | `/api/v1/options/live` | Get live data (REST) |
| POST | `/api/v1/options/percentage` | Get % analysis |
| POST | `/api/v1/options/iv` | Get IV analysis |
| POST | `/api/v1/options/delta` | Get delta analysis |
| POST | `/api/v1/options/future` | Get futures data |

### Admin (Requires Admin Role)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/admin/config` | List configurations |
| POST | `/api/v1/admin/config` | Create config |
| PUT | `/api/v1/admin/config/{key}` | Update config |
| DELETE | `/api/v1/admin/config/{key}` | Delete config |
| GET | `/api/v1/admin/instruments` | List instruments |
| POST | `/api/v1/admin/instruments` | Create instrument |
| POST | `/api/v1/admin/cache/clear` | Clear cache |

### WebSocket
| Endpoint | Description |
|----------|-------------|
| `ws://localhost:8000/ws/options` | Live options streaming |

## 🔌 WebSocket Usage

```javascript
const ws = new WebSocket('ws://localhost:8000/ws/options');

ws.onopen = () => {
  // Subscribe to live data
  ws.send(JSON.stringify({
    type: 'subscribe',
    sid: 'NIFTY',
    exp_sid: '1734019200'  // Unix timestamp
  }));
};

ws.onmessage = (event) => {
  // Data is msgpack encoded
  const data = msgpack.decode(new Uint8Array(event.data));
  console.log(data);
};
```

## 🔧 Configuration

All configuration is managed via environment variables. See `.env.example` for available options.

Key configurations:
- `DATABASE_URL`: PostgreSQL connection string
- `REDIS_URL`: Redis connection string
- `FIREBASE_CREDENTIALS_PATH`: Path to Firebase service account JSON

## 🧪 Testing

```bash
# Run tests
pytest

# Run with coverage
pytest --cov=app --cov-report=html
```

## 📦 Migration from Flask

This FastAPI backend replaces the legacy Flask implementation. Key improvements:

| Feature | Flask (Old) | FastAPI (New) |
|---------|-------------|---------------|
| Database | SQLite | PostgreSQL (async) |
| Caching | None | Redis |
| Validation | Manual | Pydantic |
| Documentation | Manual | Auto (OpenAPI) |
| WebSocket | Flask-SocketIO | Native FastAPI |
| Type Safety | None | Full typing |
| Performance | Sync | Async |

## 📄 License

MIT License
